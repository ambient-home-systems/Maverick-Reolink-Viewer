"""Camera streams in our go2rtc: registered at runtime, counted while they run.

Each stream is one camera stream on one connection, named
``rv_<key>_<kind>`` (``key`` reveals no identifier; ``kind`` is sub, main or
ext). Sources follow the Phase 0 decision: RTSP for main and sub, HTTP-FLV for
ext (Reolink serves no ext over RTSP). The camera URL comes from the Reolink
integration's connection, through the scheduler, and goes straight to go2rtc's
API: it is never written to disk or sent to a browser.

A running stream is one connection to the camera, whoever watches it. The
first *hold* on a stream (a WebRTC session, an MSE feed) takes a slot of the
host's stream budget at live priority, and the last one gives it back. A
stream is registered again each time it starts from idle, so a reloaded
Reolink entry (new address or password) is picked up, and when go2rtc has
restarted since (it forgets its streams).

A **spare** hold (HD in a Wall tile, Phase 9 step 3) starts a stream only on
a slot free now (the scheduler's ``request_spare``), and is ended through its
``on_yield`` when the slot is asked back; once anyone holds the stream
otherwise, it keeps its slot as any other.
"""

import asyncio
from collections.abc import Callable
from dataclasses import dataclass, field
from functools import partial
import logging

from custom_components.reolink_viewer import bridge
from custom_components.reolink_viewer.bridge import LiveProtocol
from custom_components.reolink_viewer.devices import LIVE_PROTOCOLS, LiveSource
from custom_components.reolink_viewer.scheduler import Priority, Scheduler, StreamTicket
from homeassistant.core import HomeAssistant

from .go2rtc import Go2rtcError, Go2rtcServer

_LOGGER = logging.getLogger(__name__)

URL_TIMEOUT = 20.0
# A session waits this long for a stream slot before it fails.
SLOT_TIMEOUT = 15.0


class LiveError(Exception):
    """A live stream cannot be started."""


# Said to the browser (live/explain.ts reads "every stream slot" as busy).
SPARE_REFUSED = (
    "every stream slot of this host is in use (HD in a tile waits for a free one)"
)
YIELDED = "gave its stream slot back: every stream slot of this host is needed"


@dataclass(frozen=True, slots=True)
class LiveStream:
    """One stream (sub, main or ext) of one camera connection."""

    source: LiveSource
    kind: str

    @property
    def name(self) -> str:
        """Return go2rtc's name for it (reveals no identifier)."""
        return f"rv_{self.source.key}_{self.kind}"

    @property
    def protocol(self) -> LiveProtocol:
        """Return the protocol the camera is read with."""
        return LIVE_PROTOCOLS.get(self.kind, LiveProtocol.RTSP)


@dataclass(slots=True)
class _Running:
    holds: int = 0
    ticket: StreamTicket | None = None
    stream: LiveStream | None = None
    # go2rtc's generation the stream was registered in.
    generation: int = -1
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    # The spare holds' way to end the stream, by hold.
    yielders: dict[int, Callable[[], None]] = field(default_factory=dict)


class Hold:
    """A claim on a running stream; ``release()`` it once (later calls do nothing)."""

    def __init__(self, registry: StreamRegistry, stream: LiveStream) -> None:
        """Initialize (use StreamRegistry.async_hold)."""
        self._registry = registry
        self.stream = stream
        self.released = False

    def release(self) -> None:
        """Give the claim up."""
        if not self.released:
            self.released = True
            self._registry.release(self.stream, self)


class StreamRegistry:
    """The camera streams registered in go2rtc, and who holds them."""

    def __init__(
        self, hass: HomeAssistant, scheduler: Scheduler, server: Go2rtcServer
    ) -> None:
        """Initialize the registry."""
        self._hass = hass
        self._scheduler = scheduler
        self._server = server
        self._running: dict[str, _Running] = {}
        # Told when a stream starts from idle (the camera is awake then).
        self.on_start: Callable[[LiveStream], None] | None = None

    async def async_hold(
        self,
        stream: LiveStream,
        *,
        slot_timeout: float = SLOT_TIMEOUT,
        on_yield: Callable[[], None] | None = None,
    ) -> Hold:
        """Claim a stream: registered, and holding a stream slot while held.

        Given ``on_yield``, the hold is spare: a stream not running yet starts
        only on a free slot (else LiveError at once, before asking the camera
        anything), and ``on_yield`` is called to end it when the slot is asked
        back.
        """
        await self._server.async_ready()
        state = self._running.setdefault(stream.name, _Running())
        state.stream = stream
        async with state.lock:
            if state.holds == 0 and on_yield is not None:
                await self._start_spare(state, stream)
            else:
                if state.holds == 0 or state.generation != self._server.generation:
                    await self._register(stream)
                    state.generation = self._server.generation
                if state.holds == 0:
                    await self._take_slot(state, stream, slot_timeout)
                elif on_yield is None and state.ticket is not None:
                    # Held as any other from now on: never asked back.
                    state.ticket.keep()
            state.holds += 1
            hold = Hold(self, stream)
            if on_yield is not None:
                state.yielders[id(hold)] = on_yield
        return hold

    async def _take_slot(
        self, state: _Running, stream: LiveStream, slot_timeout: float
    ) -> None:
        ticket = self._scheduler.host(stream.source.entry_id).streams.request(
            Priority.LIVE
        )
        try:
            async with asyncio.timeout(slot_timeout):
                await ticket.wait()
        except TimeoutError:
            ticket.release()
            raise LiveError("every stream slot of this host is in use") from None
        state.ticket = ticket
        self._started(stream)

    async def _start_spare(self, state: _Running, stream: LiveStream) -> None:
        ticket = self._scheduler.host(stream.source.entry_id).streams.request_spare(
            Priority.LIVE, partial(self._yield, stream.name)
        )
        if ticket is None:
            raise LiveError(SPARE_REFUSED)
        try:
            await self._register(stream)
        except BaseException:
            ticket.release()
            raise
        state.generation = self._server.generation
        state.ticket = ticket
        self._started(stream)

    def _started(self, stream: LiveStream) -> None:
        if self.on_start is not None:
            try:
                self.on_start(stream)
            except Exception:  # a side job: the stream starts anyway
                _LOGGER.exception("Error when %s started", stream.name)

    def _yield(self, name: str) -> None:
        """End a spare stream whose slot is asked back (its holders end it)."""
        state = self._running.get(name)
        if state is None or state.ticket is None or not state.ticket.spare:
            return  # ended, or held as any other since
        _LOGGER.debug("%s gives its stream slot back", name)
        for on_yield in list(state.yielders.values()):
            try:
                on_yield()
            except Exception:
                _LOGGER.exception("Error ending %s for its slot", name)

    def release(self, stream: LiveStream, hold: Hold | None = None) -> None:
        """Give a hold up (use Hold.release)."""
        state = self._running.get(stream.name)
        if state is None or state.holds == 0:
            return
        if hold is not None:
            state.yielders.pop(id(hold), None)
        state.holds -= 1
        if state.holds == 0 and state.ticket is not None:
            state.ticket.release()
            state.ticket = None
            state.yielders.clear()
        else:
            self._lend_if_spare(stream, state)

    def lend(
        self, stream: LiveStream, hold: Hold, on_yield: Callable[[], None]
    ) -> None:
        """Make a hold spare again (``on_yield`` ends it); the slot too, if all are."""
        state = self._running.get(stream.name)
        if state is None or hold.released:
            return
        state.yielders[id(hold)] = on_yield
        self._lend_if_spare(stream, state)

    def _lend_if_spare(self, stream: LiveStream, state: _Running) -> None:
        if (
            state.ticket is not None
            and not state.ticket.spare
            and state.yielders
            and len(state.yielders) == state.holds
        ):
            # Only spare holds are left: its slot can be asked back again.
            state.ticket.lend(partial(self._yield, stream.name))

    async def _register(self, stream: LiveStream) -> None:
        source = stream.source
        host = bridge.async_get_host(self._hass, source.entry_id)
        url_stream = stream.kind
        try:
            url = await self._scheduler.run(
                source.entry_id,
                lambda: host.async_live_url(
                    source.channel, stream.protocol, url_stream
                ),
                priority=Priority.LIVE,
                timeout=URL_TIMEOUT,
                key=("live_url", source.entry_id, source.channel, stream.kind),
            )
        except TimeoutError:
            raise LiveError("the camera did not give its stream address") from None
        except bridge.BridgeError as err:
            raise LiveError(str(err)) from err
        if url is None:
            raise LiveError(f"this camera has no {stream.kind} stream")
        source_url = url.value
        if stream.protocol is LiveProtocol.RTSP:
            # No two-way audio (deferred): don't ask the camera for a backchannel.
            source_url += "#backchannel=0"
        try:
            await self._server.async_set_stream(stream.name, source_url)
        except Go2rtcError as err:
            raise LiveError(str(err)) from err

    def keep(self, stream: LiveStream, hold: Hold | None = None) -> None:
        """Hold a running stream's slot as any other (``hold`` is no longer spare)."""
        state = self._running.get(stream.name)
        if state is None:
            return
        if hold is not None:
            state.yielders.pop(id(hold), None)
        if state.ticket is not None:
            state.ticket.keep()

    def running(self) -> dict[str, int]:
        """Return the holds of each running stream (by go2rtc name)."""
        return {name: s.holds for name, s in self._running.items() if s.holds}

    def held(self, entry_id: str) -> list[LiveStream]:
        """Return a host's streams that hold a stream slot."""
        return [
            s.stream
            for s in self._running.values()
            if s.holds and s.stream is not None and s.stream.source.entry_id == entry_id
        ]

    async def async_shutdown(self) -> None:
        """Release every hold (go2rtc is stopping)."""
        for state in self._running.values():
            state.holds = 0
            state.yielders.clear()
            if state.ticket is not None:
                state.ticket.release()
                state.ticket = None

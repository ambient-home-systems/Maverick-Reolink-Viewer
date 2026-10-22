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
"""

import asyncio
from collections.abc import Callable
from dataclasses import dataclass, field
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
    # go2rtc's generation the stream was registered in.
    generation: int = -1
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)


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
            self._registry.release(self.stream)


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
        self, stream: LiveStream, *, slot_timeout: float = SLOT_TIMEOUT
    ) -> Hold:
        """Claim a stream: registered, and holding a stream slot while held."""
        await self._server.async_ready()
        state = self._running.setdefault(stream.name, _Running())
        async with state.lock:
            if state.holds == 0 or state.generation != self._server.generation:
                await self._register(stream)
                state.generation = self._server.generation
            if state.holds == 0:
                ticket = self._scheduler.host(stream.source.entry_id).streams.request(
                    Priority.LIVE
                )
                try:
                    async with asyncio.timeout(slot_timeout):
                        await ticket.wait()
                except TimeoutError:
                    ticket.release()
                    raise LiveError(
                        "every stream slot of this host is in use"
                    ) from None
                state.ticket = ticket
                if self.on_start is not None:
                    try:
                        self.on_start(stream)
                    except Exception:  # a side job: the stream starts anyway
                        _LOGGER.exception("Error when %s started", stream.name)
            state.holds += 1
        return Hold(self, stream)

    def release(self, stream: LiveStream) -> None:
        """Give a hold up (use Hold.release)."""
        state = self._running.get(stream.name)
        if state is None or state.holds == 0:
            return
        state.holds -= 1
        if state.holds == 0 and state.ticket is not None:
            state.ticket.release()
            state.ticket = None

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

    def running(self) -> dict[str, int]:
        """Return the holds of each running stream (by go2rtc name)."""
        return {name: s.holds for name, s in self._running.items() if s.holds}

    async def async_shutdown(self) -> None:
        """Release every hold (go2rtc is stopping)."""
        for state in self._running.values():
            state.holds = 0
            if state.ticket is not None:
                state.ticket.release()
                state.ticket = None

"""Camera streams in our go2rtc: registered at runtime, counted while they run.

Each stream is one camera stream on one connection, named
``rv_<key>_<kind>`` (``key`` reveals no identifier; ``kind`` is sub, main or
ext). Sources follow the Phase 0 decision: RTSP for main and sub, HTTP-FLV for
ext (Reolink serves no ext over RTSP). The camera URL comes from the Reolink
integration's connection, through the scheduler, and goes straight to go2rtc's
API: it is never written to disk or sent to a browser.

A running stream is one connection to the camera, whoever watches it. The
first *hold* on a stream (a browser session, a preload) takes a slot of the
host's stream budget at live priority, and the last one gives it back. A
stream is registered again each time it starts from idle, so a reloaded
Reolink entry (new address or password) or a restarted go2rtc is picked up.
"""

import asyncio
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
        self._preloads: dict[str, Hold] = {}
        self._remove_listener = server.add_listener(self._restarted)

    async def async_hold(
        self, stream: LiveStream, *, slot_timeout: float = SLOT_TIMEOUT
    ) -> Hold:
        """Claim a stream: registered, and holding a stream slot while held."""
        await self._server.async_ready()
        state = self._running.setdefault(stream.name, _Running())
        async with state.lock:
            if state.holds == 0:
                await self._register(stream)
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

    # ---- Keep warm (go2rtc preload) ----

    async def async_preload(self, stream: LiveStream, enabled: bool) -> None:
        """Keep a stream's camera connection open without a viewer, or stop."""
        if enabled:
            if stream.name in self._preloads:
                return
            hold = await self.async_hold(stream)
            try:
                await self._server.async_preload(stream.name, True)
            except Go2rtcError as err:
                hold.release()
                raise LiveError(str(err)) from err
            self._preloads[stream.name] = hold
            return
        if (held := self._preloads.pop(stream.name, None)) is None:
            return
        try:
            await self._server.async_preload(stream.name, False)
        except Go2rtcError as err:
            _LOGGER.debug("Ending a preload failed: %s", err)
        finally:
            held.release()

    def preloaded(self) -> list[str]:
        """Return the go2rtc names of the streams kept warm."""
        return list(self._preloads)

    def _restarted(self) -> None:
        """go2rtc started again: its streams and preloads are gone; restore them."""
        if self._preloads:
            self._hass.async_create_background_task(
                self._restore(list(self._preloads.values())),
                "reolink_viewer restore preloads",
            )

    async def _restore(self, holds: list[Hold]) -> None:
        for hold in holds:
            try:
                await self._register(hold.stream)
                await self._server.async_preload(hold.stream.name, True)
            except (LiveError, Go2rtcError) as err:
                _LOGGER.warning("Cannot keep a stream warm after a restart: %s", err)

    async def async_shutdown(self) -> None:
        """Release every hold (go2rtc is stopping)."""
        self._remove_listener()
        self._preloads.clear()
        for state in self._running.values():
            state.holds = 0
            if state.ticket is not None:
                state.ticket.release()
                state.ticket = None

"""Keep warm the cameras whose switch asks for it.

Each mains-powered camera has a "keep live view warm" switch (``switch.py``).
A camera kept warm has its sub stream's feed open all the time, through the
NVR where it has one, with its last key frame cached (``relay.py``): its tile
starts from that key frame at once, over MSE, instead of waiting up to 4 s
for the camera's next one.

The keeper compares the switches with the streams the relay keeps warm for
it, and opens or closes them: when a switch changes, once Home Assistant has
started, and every RECONCILE_S (a Reolink entry that loaded late, a camera
that was offline, a connection that changed). It keeps them warm as the
"setting" owner, so the live check turning its own warm streams off leaves
them alone.
"""

import asyncio
import contextlib
import logging

from custom_components.reolink_viewer import devices
from homeassistant.core import HomeAssistant, callback

from .relay import MseRelay
from .streams import LiveError, LiveStream

_LOGGER = logging.getLogger(__name__)

RECONCILE_S = 60.0
OWNER = "setting"


def keep_warm_unique_id(camera_id: str) -> str:
    """Return the unique id of a camera's keep-warm switch."""
    return f"{camera_id}_keep_warm"


class WarmKeeper:
    """Keeps the sub streams warm that the cameras' switches ask for."""

    def __init__(self, hass: HomeAssistant, relay: MseRelay) -> None:
        """Initialize (nothing runs until start)."""
        self._hass = hass
        self._relay = relay
        # Camera id -> what its switch asks for.
        self._wanted: dict[str, bool] = {}
        # The streams kept warm for the switches, by go2rtc name.
        self._mine: dict[str, LiveStream] = {}
        self._wake = asyncio.Event()
        self._task: asyncio.Task[None] | None = None

    @callback
    def want(self, camera_id: str, on: bool) -> None:
        """Note what a camera's switch asks for (reconciled at once if running)."""
        if self._wanted.get(camera_id) != on:
            self._wanted[camera_id] = on
            self._wake.set()

    @callback
    def start(self) -> None:
        """Start keeping streams warm (once Home Assistant has started)."""
        if self._task is None:
            self._task = self._hass.async_create_background_task(
                self._run(), "reolink_viewer keep live view warm"
            )

    async def _run(self) -> None:
        while True:
            self._wake.clear()
            try:
                await self.async_reconcile()
            except Exception:
                _LOGGER.exception("Cannot keep live view warm")
            with contextlib.suppress(TimeoutError):
                async with asyncio.timeout(RECONCILE_S):
                    await self._wake.wait()

    async def async_reconcile(self) -> None:
        """Open what the switches ask for and close what they no longer do."""
        sources = devices.async_image_sources(self._hass)
        want: dict[str, LiveStream] = {}
        for camera_id, on in self._wanted.items():
            source = sources.get(camera_id)
            if on and source is not None and not source.is_battery:
                stream = LiveStream(source, "sub")
                want[stream.name] = stream
        for name in [n for n in self._mine if n not in want]:
            stream = self._mine.pop(name)
            await self._relay.async_keep_warm(stream, False, owner=OWNER)
        warm = set(self._relay.warm_streams())
        todo = [
            s for name, s in want.items() if name not in warm or name not in self._mine
        ]
        await asyncio.gather(*(self._keep(stream) for stream in todo))

    async def _keep(self, stream: LiveStream) -> None:
        try:
            await self._relay.async_keep_warm(stream, True, owner=OWNER)
        except LiveError as err:
            _LOGGER.debug("Cannot keep %s warm yet: %s", stream.source.name, err)
            return
        self._mine[stream.name] = stream

    def warm_cameras(self) -> set[str]:
        """Return the cameras kept warm for their switch."""
        return {stream.source.camera_id for stream in self._mine.values()}

    async def async_shutdown(self) -> None:
        """Stop reconciling (the relay closes the feeds)."""
        if self._task is not None:
            self._task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._task
            self._task = None
        self._mine.clear()

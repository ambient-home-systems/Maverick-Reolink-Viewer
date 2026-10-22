"""Each camera's last picture, so a live tile shows one at once.

Home Assistant's snapshot took a median 0.43-0.77 s in the live checks (runs
5-13), and failed on some cameras in five of those nine runs: past the 0.5 s a
tile may wait. So the integration keeps each camera's last picture and serves
it from memory:

- a picture is the camera's snapshot at its sub stream's size, taken through
  the NVR where the camera has one; each is a scheduler job at thumbnail
  priority, so it never delays live view or playback;
- while a live page watches (``live/images``), a mains-powered camera's
  picture is taken again every REFRESH_S, and at once if it is older;
- a battery camera's is never taken in the background, so it can sleep: it is
  taken when one of its streams starts (the camera is awake then), and once if
  there is none at all;
- a camera that fails is left alone for RETRY_S (a battery camera until one of
  its streams starts);
- pictures are kept on disk too, so the first page after a restart has them.
"""

import asyncio
from collections.abc import Callable
import contextlib
from dataclasses import dataclass
import logging
from pathlib import Path
import time

from custom_components.reolink_viewer import bridge, devices
from custom_components.reolink_viewer.devices import LiveSource
from custom_components.reolink_viewer.scheduler import Priority, Scheduler
from homeassistant.core import HomeAssistant, callback

from .streams import LiveStream

_LOGGER = logging.getLogger(__name__)

REFRESH_S = 30.0
RETRY_S = 60.0
SNAPSHOT_TIMEOUT = 15.0
JPEG_MAGIC = b"\xff\xd8"


@dataclass(frozen=True, slots=True)
class CameraImage:
    """A camera's last picture: a JPEG, and when it was taken (epoch seconds)."""

    data: bytes
    taken: float


type Listener = Callable[[str, CameraImage], None]


class Watch:
    """A live page watching the pictures; ``close()`` it once."""

    def __init__(self, images: LiveImages, listener: Listener) -> None:
        """Initialize (use LiveImages.watch)."""
        self._images = images
        self.listener = listener
        self.closed = False

    def close(self) -> None:
        """Stop watching."""
        if not self.closed:
            self.closed = True
            self._images.unwatch(self)


class LiveImages:
    """The cameras' last pictures, taken while a live page watches."""

    def __init__(
        self, hass: HomeAssistant, scheduler: Scheduler, directory: Path
    ) -> None:
        """Initialize (call async_setup before use)."""
        self._hass = hass
        self._scheduler = scheduler
        self._dir = directory
        # By the source's key, which reveals no identifier (also the file name).
        self._images: dict[str, CameraImage] = {}
        self._failed: dict[str, float] = {}
        self._inflight: dict[str, asyncio.Task[CameraImage | None]] = {}
        self._watches: list[Watch] = []
        self._wake = asyncio.Event()
        self._task: asyncio.Task[None] | None = None

    async def async_setup(self) -> None:
        """Load the pictures kept on disk."""
        self._images = await self._hass.async_add_executor_job(self._load)

    def _load(self) -> dict[str, CameraImage]:
        self._dir.mkdir(parents=True, exist_ok=True)
        images = {}
        for path in self._dir.glob("*.jpg"):
            with contextlib.suppress(OSError):
                images[path.stem] = CameraImage(path.read_bytes(), path.stat().st_mtime)
        return images

    @callback
    def get(self, camera_id: str) -> CameraImage | None:
        """Return a camera's last picture, if there is one (no camera I/O)."""
        source = devices.async_image_sources(self._hass).get(camera_id)
        return None if source is None else self._images.get(source.key)

    @callback
    def images(self) -> dict[str, CameraImage]:
        """Return every camera's last picture, by camera id."""
        return {
            camera_id: image
            for camera_id, source in devices.async_image_sources(self._hass).items()
            if (image := self._images.get(source.key)) is not None
        }

    @callback
    def watch(self, listener: Listener) -> Watch:
        """Start watching: pictures are taken, and each new one is passed on."""
        watch = Watch(self, listener)
        self._watches.append(watch)
        if self._task is None or self._task.done():
            self._task = self._hass.async_create_background_task(
                self._run(), "reolink_viewer live images"
            )
        self._wake.set()
        return watch

    @callback
    def unwatch(self, watch: Watch) -> None:
        """Stop watching (use Watch.close); the last one stops the refreshes."""
        if watch in self._watches:
            self._watches.remove(watch)
        if not self._watches and self._task is not None:
            self._task.cancel()
            self._task = None

    @callback
    def stream_started(self, stream: LiveStream) -> None:
        """Take a battery camera's picture while one of its streams wakes it."""
        if not stream.source.is_battery:
            return
        source = devices.async_image_sources(self._hass).get(stream.source.camera_id)
        if source is not None:
            self._failed.pop(source.key, None)
            self._take(source.camera_id, source)

    async def _run(self) -> None:
        while self._watches:
            delay = REFRESH_S
            for camera_id, source in devices.async_image_sources(self._hass).items():
                due = self._due_in(source)
                if due is None:
                    continue
                if due <= 0:
                    self._take(camera_id, source)
                else:
                    delay = min(delay, due)
            self._wake.clear()
            with contextlib.suppress(TimeoutError):
                async with asyncio.timeout(delay):
                    await self._wake.wait()

    def _due_in(self, source: LiveSource) -> float | None:
        """Return the seconds until a picture is due, None if not in the background."""
        key = source.key
        if key in self._inflight:
            return None
        image = self._images.get(key)
        if source.is_battery:
            # Once if there is none; a failure waits for one of its streams.
            return 0.0 if image is None and key not in self._failed else None
        due = 0.0 if image is None else image.taken + REFRESH_S - time.time()
        if (failed := self._failed.get(key)) is not None:
            due = max(due, failed + RETRY_S - time.monotonic())
        return due

    def _take(self, camera_id: str, source: LiveSource) -> None:
        key = source.key
        if key in self._inflight:
            return
        task = self._hass.async_create_background_task(
            self._fetch(camera_id, source), f"reolink_viewer live image {key}"
        )
        self._inflight[key] = task
        task.add_done_callback(lambda _t: self._done(key, task))

    def _done(self, key: str, task: asyncio.Task[CameraImage | None]) -> None:
        if self._inflight.get(key) is task:
            del self._inflight[key]
        self._wake.set()

    async def _fetch(self, camera_id: str, source: LiveSource) -> CameraImage | None:
        key = source.key
        try:
            host = bridge.async_get_host(self._hass, source.entry_id)
            data = await self._scheduler.run(
                source.entry_id,
                lambda: host.async_snapshot(source.channel, "sub"),
                priority=Priority.THUMBNAILS,
                key=("live_image", source.channel),
                timeout=SNAPSHOT_TIMEOUT,
            )
            if not data or not data.startswith(JPEG_MAGIC):
                raise bridge.BridgeError("no picture (privacy mode?)")
        except asyncio.CancelledError:
            raise
        except Exception as err:  # noqa: BLE001 - kept as a failure, retried later
            self._failed[key] = time.monotonic()
            _LOGGER.debug("No picture from %s: %s", source.name, err)
            return None
        self._failed.pop(key, None)
        image = self._images[key] = CameraImage(data, time.time())
        for watch in list(self._watches):
            watch.listener(camera_id, image)
        try:
            await self._hass.async_add_executor_job(self._write, key, data)
        except OSError as err:
            _LOGGER.debug("Cannot keep the picture of %s: %s", source.name, err)
        return image

    def _write(self, key: str, data: bytes) -> None:
        tmp = self._dir / f".{key}.tmp"
        tmp.write_bytes(data)
        tmp.replace(self._dir / f"{key}.jpg")

    def stats(self) -> dict[str, int]:
        """Return how many pictures are kept, being taken and watched."""
        return {
            "images": len(self._images),
            "taking": len(self._inflight),
            "watches": len(self._watches),
        }

    async def async_shutdown(self) -> None:
        """Stop the refreshes and the pictures being taken."""
        self._watches.clear()
        tasks = [t for t in (self._task, *self._inflight.values()) if t is not None]
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        self._task = None
        self._inflight.clear()

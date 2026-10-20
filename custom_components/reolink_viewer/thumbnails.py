"""Timeline thumbnails from recordings (Baichuan ``snapshot_past``).

``snapshot_past`` answers in 160 to 490 ms on the RLN36 (hardware-matrix.md), so
hover previews and event-list thumbnails are fetched on demand:

- times are rounded down to a bucket (5 s to 5 min, chosen by the zoom level),
  so nearby hovers share one image;
- each image is a scheduler job at ``THUMBNAILS`` priority, de-duplicated
  while in flight: requests for the same bucket share one fetch, which runs
  on until the last of them goes away;
- images are cached on disk, least recently used first out above a size cap;
- a failure (e.g. no recording at that time) is remembered for a minute so
  hovering over a gap does not hammer the device.
"""

import asyncio
from collections import OrderedDict
from dataclasses import dataclass, field
from datetime import datetime
import logging
from pathlib import Path
import time

from homeassistant.core import HomeAssistant

from . import bridge
from .devices import PlaybackSource
from .scheduler import Priority, Scheduler
from .timeconv import from_ms

_LOGGER = logging.getLogger(__name__)

BUCKETS_S = (5, 10, 30, 60, 300)
SNAPSHOT_TIMEOUT = 15.0
NEGATIVE_TTL = 60.0
JPEG_MAGIC = b"\xff\xd8"


class ThumbnailError(Exception):
    """No thumbnail for that time."""


@dataclass(frozen=True, slots=True)
class ThumbKey:
    """One thumbnail: camera, stream and the start of its time bucket."""

    source: PlaybackSource
    stream: str
    bucket_ms: int

    @property
    def file_name(self) -> str:
        """Return the cache file name."""
        return f"{self.source.key}-{self.stream}-{self.bucket_ms}.jpg"


@dataclass(slots=True)
class _Fetch:
    """One shared fetch and how many requests wait on it."""

    task: asyncio.Task[bytes]
    waiters: int = field(default=0)


def bucket_of(when_ms: int, bucket_s: int) -> int:
    """Round a time down to its bucket; unknown sizes snap to the nearest allowed."""
    size = min(BUCKETS_S, key=lambda b: abs(b - bucket_s)) * 1000
    return when_ms - when_ms % size


class ThumbnailService:
    """Fetches and caches timeline thumbnails."""

    def __init__(
        self,
        hass: HomeAssistant,
        scheduler: Scheduler,
        directory: Path,
        max_bytes: int,
        ffmpeg_binary: str,
    ) -> None:
        """Initialize the service (call async_setup before use)."""
        self._hass = hass
        self._scheduler = scheduler
        self._dir = directory
        self._max_bytes = max_bytes
        self._ffmpeg = ffmpeg_binary
        self._index: OrderedDict[str, int] = OrderedDict()  # name -> size, LRU order
        self._total = 0
        self._inflight: dict[str, _Fetch] = {}
        self._failed: dict[str, float] = {}

    async def async_setup(self) -> None:
        """Index the cache directory, oldest first."""
        files = await self._hass.async_add_executor_job(self._scan)
        for name, size in files:
            self._index[name] = size
            self._total += size

    def _scan(self) -> list[tuple[str, int]]:
        self._dir.mkdir(parents=True, exist_ok=True)
        found = []
        for path in self._dir.glob("*.jpg"):
            stat = path.stat()
            found.append((stat.st_mtime, path.name, stat.st_size))
        return [(name, size) for _mtime, name, size in sorted(found)]

    def key(
        self, source: PlaybackSource, when_ms: int, bucket_s: int, stream: str
    ) -> ThumbKey:
        """Return the key of the thumbnail covering a time."""
        return ThumbKey(source, stream, bucket_of(when_ms, bucket_s))

    async def async_get(
        self, key: ThumbKey, priority: Priority = Priority.THUMBNAILS
    ) -> bytes:
        """Return the JPEG for a bucket, from cache or the device."""
        name = key.file_name
        if name in self._index:
            self._index.move_to_end(name)
            try:
                return await self._hass.async_add_executor_job(self._read, name)
            except FileNotFoundError:
                self._forget(name)
        if (failed_at := self._failed.get(name)) is not None:
            if _clock() - failed_at < NEGATIVE_TTL:
                raise ThumbnailError("no recording at that time")
            del self._failed[name]
        fetch = self._inflight.get(name)
        if fetch is None:
            fetch = _Fetch(
                self._hass.async_create_background_task(
                    self._fetch_and_store(key, priority),
                    f"reolink_viewer thumbnail {key.bucket_ms}",
                )
            )
            self._inflight[name] = fetch
            fetch.task.add_done_callback(lambda _t: self._done(name, fetch))
        fetch.waiters += 1
        try:
            # A request that goes away (the browser closed it) leaves the
            # fetch running for the others.
            return await asyncio.shield(fetch.task)
        finally:
            fetch.waiters -= 1
            if not fetch.waiters and not fetch.task.done():
                fetch.task.cancel()

    def _done(self, name: str, fetch: _Fetch) -> None:
        if self._inflight.get(name) is fetch:
            del self._inflight[name]
        if not fetch.task.cancelled():
            fetch.task.exception()  # retrieved: every waiter may have gone

    async def _fetch_and_store(self, key: ThumbKey, priority: Priority) -> bytes:
        name = key.file_name
        try:
            image = await self._fetch(key, priority)
        except asyncio.CancelledError:
            raise
        except Exception as err:
            self._failed[name] = _clock()
            raise ThumbnailError(f"snapshot failed: {type(err).__name__}") from err
        await self._store(name, image)
        return image

    async def _fetch(self, key: ThumbKey, priority: Priority) -> bytes:
        host = bridge.async_get_host(self._hass, key.source.entry_id)
        # Ask for the middle of the bucket: the nearest key frame is then in it.
        when: datetime = from_ms(key.bucket_ms + 1000)
        image = await self._scheduler.run(
            key.source.entry_id,
            lambda: host.async_snapshot_past(
                key.source.channel, when, key.stream, self._ffmpeg
            ),
            priority=priority,
            key=("thumb", key.source.channel, key.stream, key.bucket_ms),
            timeout=SNAPSHOT_TIMEOUT,
        )
        if not image.startswith(JPEG_MAGIC):
            raise ThumbnailError("not a JPEG")
        return image

    def _read(self, name: str) -> bytes:
        return (self._dir / name).read_bytes()

    async def _store(self, name: str, image: bytes) -> None:
        await self._hass.async_add_executor_job(self._write, name, image)
        self._index[name] = len(image)
        self._index.move_to_end(name)
        self._total += len(image)
        evict: list[str] = []
        while self._total > self._max_bytes and len(self._index) > 1:
            old, size = self._index.popitem(last=False)
            self._total -= size
            evict.append(old)
        if evict:
            await self._hass.async_add_executor_job(self._delete, evict)

    def _write(self, name: str, image: bytes) -> None:
        tmp = self._dir / f".{name}.tmp"
        tmp.write_bytes(image)
        tmp.replace(self._dir / name)

    def _delete(self, names: list[str]) -> None:
        for name in names:
            (self._dir / name).unlink(missing_ok=True)

    def _forget(self, name: str) -> None:
        self._total -= self._index.pop(name, 0)

    def stats(self) -> dict[str, int]:
        """Return cache statistics."""
        return {"files": len(self._index), "bytes": self._total}


def _clock() -> float:
    """Return a monotonic clock for the failure memory (a hook for tests)."""
    return time.monotonic()

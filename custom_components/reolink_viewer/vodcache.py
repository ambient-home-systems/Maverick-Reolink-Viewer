"""Disk cache of recordings, filled from the device and served while it fills.

The RLN36 ignores HTTP Range on DOWNLOAD but sends at 30 to 1000 times real time, as
a fragmented MP4 with its ``moov`` first (hardware-matrix.md). So each
recording is downloaded once, at full speed, into this cache; the browser is
served from the cache, with Range, by ``views.py``:

- a fill holds a slot of the host's **stream budget** (not a request slot) for
  as long as it downloads; prefetch fills have their own, smaller cap;
- readers can start as soon as the first bytes are on disk and follow the
  fill as it grows;
- one fill per recording, however many viewers;
- least-recently-used complete files are evicted above the size cap; files
  being filled or read are never evicted;
- the first fill of a camera's stream records its codec and size (from the
  ``moov``) for the browser's MediaCapabilities check;
- room is left after the ``moov`` for a segment index (``mp4index.py``),
  written once the file is complete, so browsers seek without reading the
  whole file first.

File I/O runs in the executor; device I/O goes through the scheduler.
"""

import asyncio
from collections.abc import AsyncIterator, Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime
import hashlib
import logging
import os
from pathlib import Path
import shutil
import struct
import time
from typing import Any

from aiohttp import ClientError, ClientSession, ClientTimeout

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from . import bridge
from .bridge import VodFile, VodMethod
from .devices import PlaybackSource
from .mp4 import BoxScanner
from .mp4index import build_index, free_box, plan_reserve
from .scheduler import Priority, Scheduler, StreamTicket
from .timeconv import from_ms

_LOGGER = logging.getLogger(__name__)

VOD_METHOD = VodMethod.DOWNLOAD
CHUNK = 256 * 1024
WRITE_BATCH = 1024 * 1024
URL_TIMEOUT = 20.0
CONNECT_TIMEOUT = 15.0
READ_TIMEOUT = 30.0
# Keep at least this much disk free (or the recording's estimated size).
MIN_FREE_BYTES = 2 * 1024**3
MEDIA_STORE_KEY = "reolink_viewer.media"
SUFFIX = ".mp4"
PART_SUFFIX = ".part"
# Part of each file's cache id: bumping it retires files of an older layout
# (they become unknown files, evicted first). 2: segment index added.
LAYOUT = 2


class VodCacheError(Exception):
    """A recording could not be cached."""


@dataclass(frozen=True, slots=True)
class Recording:
    """One recording to cache: which camera, stream and file."""

    source: PlaybackSource
    stream: str
    name: str
    start_ms: int
    end_ms: int
    size: int | None = None

    @property
    def cache_id(self) -> str:
        """Return the file name stem (reveals no identifier)."""
        raw = f"{LAYOUT}|{self.source.key}|{self.stream}|{self.name}"
        return hashlib.sha256(raw.encode()).hexdigest()[:32]


@dataclass(slots=True)
class Entry:
    """A cached recording: complete on disk, being filled, or failed."""

    recording: Recording
    path: Path
    written: int = 0
    complete: bool = False
    error: str | None = None
    readers: int = 0
    last_access: float = field(default_factory=time.monotonic)
    task: asyncio.Task[None] | None = None
    ticket: StreamTicket | None = None
    priority: Priority = Priority.PREFETCH
    timing: dict[str, Any] = field(default_factory=dict)
    changed: asyncio.Condition = field(default_factory=asyncio.Condition)

    @property
    def part_path(self) -> Path:
        """Return the path while filling."""
        return self.path.with_suffix(SUFFIX + PART_SUFFIX)

    @property
    def filling(self) -> bool:
        """Return True while a fill task runs."""
        return self.task is not None and not self.task.done()

    def public(self) -> dict[str, Any]:
        """Return debug information for the browser."""
        return {
            "complete": self.complete,
            "bytes": self.written,
            "error": self.error,
            **self.timing,
        }


class VodCache:
    """Recordings cached on disk."""

    def __init__(
        self,
        hass: HomeAssistant,
        scheduler: Scheduler,
        directory: Path,
        max_bytes: int,
        session: Callable[[], ClientSession],
    ) -> None:
        """Initialize the cache (call async_setup before use)."""
        self._hass = hass
        self._scheduler = scheduler
        self._dir = directory
        self._max_bytes = max_bytes
        self._session = session
        self._entries: dict[str, Entry] = {}
        self._media: dict[str, dict[str, Any]] = {}
        self._media_store: Store[dict[str, Any]] = Store(hass, 1, MEDIA_STORE_KEY)
        self._closed = False

    # ---- Setup and shutdown ----

    async def async_setup(self) -> None:
        """Create the directory, index complete files, drop partial ones."""
        loaded = await self._media_store.async_load()
        self._media = loaded if isinstance(loaded, dict) else {}
        found = await self._hass.async_add_executor_job(self._scan)
        _LOGGER.debug("VOD cache: %d files, %d bytes", len(found), sum(found.values()))

    def _scan(self) -> dict[str, int]:
        self._dir.mkdir(parents=True, exist_ok=True)
        found: dict[str, int] = {}
        for path in self._dir.iterdir():
            if path.name.endswith(PART_SUFFIX):
                path.unlink(missing_ok=True)
            elif path.suffix == SUFFIX:
                found[path.stem] = path.stat().st_size
        # Files from a previous run cannot be matched to recordings until asked
        # for; keep them on disk, counted by _disk_usage, evictable by age.
        return found

    async def async_shutdown(self) -> None:
        """Cancel fills and wait for them."""
        self._closed = True
        tasks = [e.task for e in self._entries.values() if e.task is not None]
        for task in tasks:
            task.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    # ---- Entries ----

    def entry(self, recording: Recording) -> Entry | None:
        """Return the entry of a recording, if known."""
        return self._entries.get(recording.cache_id)

    async def async_open(
        self, recording: Recording, priority: Priority = Priority.PLAYBACK
    ) -> Entry:
        """Return the recording's entry, starting or speeding up its fill."""
        if self._closed:
            raise VodCacheError("cache closed")
        cache_id = recording.cache_id
        entry = self._entries.get(cache_id)
        if entry is None or entry.error is not None:
            path = self._dir / f"{cache_id}{SUFFIX}"
            entry = Entry(recording, path, priority=priority)
            self._entries[cache_id] = entry
            if await self._hass.async_add_executor_job(path.exists):
                entry.written = (
                    await self._hass.async_add_executor_job(path.stat)
                ).st_size
                entry.complete = True
                entry.timing = {"cache": "disk"}
        entry.last_access = time.monotonic()
        if entry.complete:
            return entry
        if not entry.filling:
            entry.priority = priority
            entry.task = self._hass.async_create_background_task(
                self._fill(entry), f"reolink_viewer fill {cache_id[:8]}"
            )
        elif priority < entry.priority:
            entry.priority = priority
            if entry.ticket is not None:
                entry.ticket.raise_priority(priority)
        return entry

    async def _fill(self, entry: Entry) -> None:
        rec = entry.recording
        began = time.monotonic()
        entry.timing = {"cache": "fill", "priority": entry.priority.name.lower()}
        host_sched = self._scheduler.host(rec.source.entry_id)
        try:
            await self._check_space(rec)
            ticket = host_sched.streams.request(entry.priority)
            entry.ticket = ticket
            try:
                await ticket.wait()
                entry.timing["wait_ms"] = _ms(began)
                await self._download(entry)
            finally:
                ticket.release()
                entry.ticket = None
        except asyncio.CancelledError:
            entry.error = "cancelled"
            await self._discard_part(entry)
            raise
        except Exception as err:  # noqa: BLE001 - recorded, readers see it
            entry.error = _describe(err)
            _LOGGER.debug("Caching %s failed: %s", rec.cache_id[:8], entry.error)
            await self._discard_part(entry)
        else:
            entry.timing["fill_ms"] = _ms(began)
            await self._evict()
        finally:
            async with entry.changed:
                entry.changed.notify_all()

    async def _check_space(self, rec: Recording) -> None:
        usage = await self._hass.async_add_executor_job(shutil.disk_usage, self._dir)
        needed = max(MIN_FREE_BYTES, rec.size or 0)
        if usage.free < needed:
            await self._evict(extra=needed - usage.free)
            usage = await self._hass.async_add_executor_job(
                shutil.disk_usage, self._dir
            )
            if usage.free < needed:
                raise VodCacheError("not enough free disk space")

    async def _download(self, entry: Entry) -> None:
        rec = entry.recording
        host = bridge.async_get_host(self._hass, rec.source.entry_id)
        vod_file = VodFile(
            start=from_ms(rec.start_ms),
            end=from_ms(rec.end_ms),
            name=rec.name,
            stream=rec.stream,
            size=rec.size,
            triggers=(),
        )
        began = time.monotonic()
        _mime, url = await self._scheduler.run(
            rec.source.entry_id,
            lambda: host.async_vod_url(rec.source.channel, vod_file, VOD_METHOD),
            priority=Priority.PLAYBACK,
            timeout=URL_TIMEOUT,
        )
        scanner = BoxScanner(max_boxes=3)
        duration_s = (rec.end_ms - rec.start_ms) / 1000
        head = bytearray()
        planned = False
        index_at = reserve = 0
        fd = await self._hass.async_add_executor_job(_open_write, entry.part_path)
        try:
            async with self._session().get(
                url.value,
                timeout=ClientTimeout(
                    total=None, sock_connect=CONNECT_TIMEOUT, sock_read=READ_TIMEOUT
                ),
            ) as resp:
                if resp.status != 200:
                    raise VodCacheError(f"HTTP {resp.status}")
                entry.timing["headers_ms"] = _ms(began)
                buffer = bytearray()
                first = True
                async for received in resp.content.iter_chunked(CHUNK):
                    chunk = received
                    if first:
                        entry.timing["ttfb_ms"] = _ms(began)
                        first = False
                    if scanner.bytes_seen < 64 * 1024:
                        scanner.feed(chunk)
                    if not planned:
                        # Hold the first bytes until the index room is placed.
                        head += chunk
                        plan = plan_reserve(bytes(head), duration_s)
                        if plan is None:
                            continue
                        planned = True
                        if plan.insert_at is not None:
                            index_at, reserve = plan.insert_at, plan.reserve
                            head[index_at:index_at] = free_box(reserve)
                        else:
                            entry.timing["indexed"] = f"no: {plan.reason}"
                        chunk = bytes(head)
                    buffer += chunk
                    # Write small at first so playback can start at once.
                    if len(buffer) >= (WRITE_BATCH if entry.written else 64 * 1024):
                        await self._write(entry, fd, bytes(buffer))
                        buffer.clear()
                if not planned:
                    buffer += head
                if buffer:
                    await self._write(entry, fd, bytes(buffer))
            if reserve:
                await self._write_index(entry, fd, index_at, reserve)
        finally:
            await self._hass.async_add_executor_job(os.close, fd)
        if entry.written == 0:
            raise VodCacheError("empty recording")
        await self._hass.async_add_executor_job(entry.part_path.replace, entry.path)
        entry.complete = True
        seconds = max(time.monotonic() - began, 1e-3)
        entry.timing["mbit_s"] = round(entry.written * 8 / seconds / 1e6, 1)
        await self._remember_media(rec, scanner, entry.timing.get("indexed"))

    async def _write_index(
        self, entry: Entry, fd: int, index_at: int, reserve: int
    ) -> None:
        """Fill the room left after moov with the segment index."""
        try:
            index = await self._hass.async_add_executor_job(
                build_index, str(entry.part_path), index_at, reserve
            )
            if index is not None:
                await self._hass.async_add_executor_job(os.pwrite, fd, index, index_at)
        except (OSError, ValueError, IndexError, struct.error) as err:
            _LOGGER.debug("Indexing %s failed: %s", entry.recording.cache_id[:8], err)
            index = None
        entry.timing["indexed"] = "yes" if index is not None else "no: index not built"

    async def _write(self, entry: Entry, fd: int, data: bytes) -> None:
        await self._hass.async_add_executor_job(_write_all, fd, data)
        entry.written += len(data)
        async with entry.changed:
            entry.changed.notify_all()

    async def _discard_part(self, entry: Entry) -> None:
        await self._hass.async_add_executor_job(_unlink, entry.part_path)

    # ---- Reading ----

    async def async_wait(
        self, entry: Entry, *, offset: int = 0, complete: bool = False
    ) -> None:
        """Wait until ``offset`` bytes (or the whole file) are on disk."""
        async with entry.changed:
            await entry.changed.wait_for(
                lambda: (
                    entry.complete
                    or entry.error is not None
                    or (not complete and entry.written > offset)
                )
            )
        if entry.error is not None and not entry.complete:
            raise VodCacheError(entry.error)

    async def async_iter(
        self, entry: Entry, start: int = 0, stop: int | None = None
    ) -> AsyncIterator[bytes]:
        """Yield bytes [start, stop) as they become available."""
        entry.readers += 1
        entry.last_access = time.monotonic()
        fd: int | None = None
        try:
            pos = start
            while stop is None or pos < stop:
                if entry.complete and pos >= entry.written:
                    return
                await self.async_wait(entry, offset=pos)
                if fd is None:
                    path = entry.path if entry.complete else entry.part_path
                    try:
                        fd = await self._hass.async_add_executor_job(_open_read, path)
                    except FileNotFoundError:
                        # Renamed between the check and the open.
                        fd = await self._hass.async_add_executor_job(
                            _open_read, entry.path
                        )
                available = entry.written - pos
                if available <= 0:
                    continue
                size = min(CHUNK, available)
                if stop is not None:
                    size = min(size, stop - pos)
                data = await self._hass.async_add_executor_job(os.pread, fd, size, pos)
                if not data:
                    return
                pos += len(data)
                yield data
        finally:
            entry.readers -= 1
            entry.last_access = time.monotonic()
            if fd is not None:
                await self._hass.async_add_executor_job(os.close, fd)

    # ---- Eviction ----

    async def _evict(self, extra: int = 0) -> None:
        """Delete least-recently-used complete files until under the cap."""
        files = await self._hass.async_add_executor_job(self._disk_usage)
        total = sum(size for _path, size, _mtime in files)
        limit = self._max_bytes - extra
        if total <= limit:
            return
        protected = {
            e.path for e in self._entries.values() if e.readers or e.filling
        } | {e.part_path for e in self._entries.values()}
        access = {e.path: e.last_access for e in self._entries.values()}
        # Unknown files (previous runs) go first, oldest first; then by access.
        ordered = sorted(files, key=lambda f: (f[0] in access, access.get(f[0], f[2])))
        for path, size, _mtime in ordered:
            if total <= limit:
                break
            if path in protected:
                continue
            await self._hass.async_add_executor_job(_unlink, path)
            total -= size
            self._entries.pop(path.stem, None)

    def _disk_usage(self) -> list[tuple[Path, int, float]]:
        result = []
        for path in self._dir.iterdir():
            if path.suffix == SUFFIX:
                stat = path.stat()
                result.append((path, stat.st_size, stat.st_mtime))
        return result

    # ---- Media info ----

    async def _remember_media(
        self, rec: Recording, scanner: BoxScanner, indexed: str | None
    ) -> None:
        layout = await scanner.async_layout()
        video = next((t for t in layout.tracks if t.handler == "vide"), None)
        audio = next((t for t in layout.tracks if t.handler == "soun"), None)
        if video is None or video.codec is None:
            return
        info = {
            "codec": video.codec,
            "width": video.width,
            "height": video.height,
            "audio": audio.codec if audio is not None else None,
            "fragmented": layout.fragmented,
            "indexed": indexed,
            "seen": datetime.now(UTC).isoformat(),
        }
        self._media.setdefault(rec.source.key, {})[rec.stream] = info
        self._media_store.async_delay_save(lambda: self._media, 5)

    def media_info(self, source: PlaybackSource, stream: str) -> dict[str, Any] | None:
        """Return the codec and size last seen for a camera's stream."""
        return self._media.get(source.key, {}).get(stream)

    def stats(self) -> dict[str, Any]:
        """Return cache statistics for the debug panel."""
        return {
            "entries": len(self._entries),
            "filling": sum(1 for e in self._entries.values() if e.filling),
            "max_bytes": self._max_bytes,
        }


def _open_write(path: Path) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    return os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)


def _open_read(path: Path) -> int:
    return os.open(path, os.O_RDONLY)


def _write_all(fd: int, data: bytes) -> None:
    view = memoryview(data)
    while view:
        written = os.write(fd, view)
        view = view[written:]


def _unlink(path: Path) -> None:
    path.unlink(missing_ok=True)


def _describe(err: BaseException) -> str:
    if isinstance(err, TimeoutError):
        return "timeout"
    if isinstance(err, (VodCacheError, bridge.BridgeError)):
        return str(err)
    if isinstance(err, ClientError):
        return f"connection error ({type(err).__name__})"
    return type(err).__name__


def _ms(start: float) -> float:
    return round((time.monotonic() - start) * 1000, 1)

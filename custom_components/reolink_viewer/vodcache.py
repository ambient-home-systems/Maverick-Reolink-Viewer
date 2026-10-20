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
- disk use is accounted before bytes are written: the size cap and the
  free-space rule cover complete files, ``.part`` files, the rest each running
  fill expects (reserved once it holds its stream slot, checked then rather
  than when it queued) and the second copy a plain-MP4 rewrite writes;
- least-recently-used recordings are evicted to make that room, a recording's
  original and plain copy together as one unit; recordings being filled,
  rewritten, read, or still readable through a live URL (a *lease*: Range
  requests are not counted as readers) are never evicted;
- the first fill of a camera's stream records its codec and size (from the
  ``moov``) for the browser's MediaCapabilities check;
- room is left after the ``moov`` for a segment index (``mp4index.py``),
  written once the file is complete, so browsers seek without reading the
  whole file first;
- a complete recording is then rewritten as a plain MP4 (``remux.py``), one
  at a time: Chrome read the indexed fragmented files whole before playing.
  A URL keeps the file it was issued for (the original if the plain copy was
  not ready yet) for its whole life; the original is deleted once the last
  URL bound to it has expired.

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

from homeassistant.core import CALLBACK_TYPE, HomeAssistant, callback
from homeassistant.helpers.event import async_call_later
from homeassistant.helpers.storage import Store

from . import bridge
from .bridge import VodFile, VodMethod
from .devices import PlaybackSource
from .mp4 import BoxScanner
from .mp4index import (
    OffsetShifter,
    OffsetShiftError,
    build_index,
    free_box,
    has_index,
    index_room,
    plan_reserve,
)
from .remux import RemuxError, async_flatten, is_plain
from .scheduler import Priority, Scheduler, StreamTicket
from .timeconv import from_ms

_LOGGER = logging.getLogger(__name__)

VOD_METHOD = VodMethod.DOWNLOAD
CHUNK = 256 * 1024
WRITE_BATCH = 1024 * 1024
URL_TIMEOUT = 20.0
CONNECT_TIMEOUT = 15.0
READ_TIMEOUT = 30.0
# Keep at least this much disk free once every reserved byte is written.
MIN_FREE_BYTES = 2 * 1024**3
# A fill reserves the size the search gave, plus this share for the MP4 the
# device builds on the fly (and the index room). Without a size, the length at
# these bitrates (the highest seen are 8.5 Mbit/s main, 0.6 Mbit/s sub).
SIZE_MARGIN = 0.01
ESTIMATE_BITS_S = {"main": 10_000_000, "sub": 1_000_000}
# A fill that outgrows its reservation asks for at least this much more.
GROW_STEP = 64 * 1024**2
# A plain copy is about as large as the original (no moofs, a larger moov).
FLAT_MARGIN = 0.02
MEDIA_STORE_KEY = "reolink_viewer.media"
SUFFIX = ".mp4"
PART_SUFFIX = ".part"
FLAT_SUFFIX = ".flat.mp4"
# A lease outlasts its URL by this much; the original is deleted this long
# after the last lease bound to it ended.
LEASE_MARGIN_S = 60.0
DROP_MARGIN_S = 60.0
# Part of each file's cache id: bumping it retires files of an older layout
# (they become unknown files, evicted first). 2: segment index added.
# 3: also indexed when fragments use absolute offsets (the NVR's do).
LAYOUT = 3


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
    # When the plain MP4 became available (monotonic), or None.
    flat_at: float | None = None
    flattening: bool = False
    # False once the original was deleted (only the plain copy is left).
    has_original: bool = True
    # Live URLs can read this recording until lease_until; those bound to the
    # original (issued before the plain copy) until original_until (_clock).
    lease_until: float = 0.0
    original_until: float = 0.0

    @property
    def part_path(self) -> Path:
        """Return the path while filling."""
        return self.path.with_suffix(SUFFIX + PART_SUFFIX)

    @property
    def flat_path(self) -> Path:
        """Return the path of the plain MP4."""
        return self.path.with_name(self.path.stem + FLAT_SUFFIX)

    @property
    def filling(self) -> bool:
        """Return True while a fill task runs."""
        return self.task is not None and not self.task.done()

    def leased(self, now: float) -> bool:
        """Return True while a live URL can read this recording."""
        return self.lease_until > now

    def busy(self, now: float) -> bool:
        """Return True while the recording's files must stay on disk."""
        return bool(self.readers or self.filling or self.flattening or self.leased(now))

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
        *,
        ffmpeg_binary: str | None = None,
    ) -> None:
        """Initialize the cache (call async_setup before use)."""
        self._hass = hass
        self._ffmpeg = ffmpeg_binary
        self._flatten_lock = asyncio.Lock()
        self._flat_tasks: set[asyncio.Task[None]] = set()
        # Pending deletions of originals: cache id -> (entry, cancel).
        self._drop_timers: dict[str, tuple[Entry, CALLBACK_TYPE]] = {}
        # Bytes expected at a path that are not all on disk yet (fills and
        # rewrites), and the lock under which room is made for them.
        self._reserved: dict[Path, int] = {}
        self._space_lock = asyncio.Lock()
        self._usage: dict[str, int] = {}
        self._scheduler = scheduler
        self._dir = directory
        self._max_bytes = max_bytes
        self._session = session
        self._entries: dict[str, Entry] = {}
        self._media: dict[str, dict[str, Any]] = {}
        # Recordings whose offsets could not be shifted: cached without index.
        self._no_index: set[str] = set()
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
        names = {p.name for p in self._dir.iterdir()}
        for path in self._dir.iterdir():
            if path.name.endswith(PART_SUFFIX):
                path.unlink(missing_ok=True)
            elif path.name.endswith(FLAT_SUFFIX):
                found[path.name.removesuffix(FLAT_SUFFIX)] = path.stat().st_size
            elif path.suffix == SUFFIX:
                if path.stem + FLAT_SUFFIX in names:
                    # No URL from a previous run can still need the original.
                    path.unlink(missing_ok=True)
                else:
                    found[path.stem] = path.stat().st_size
        # Files from a previous run cannot be matched to recordings until asked
        # for; keep them on disk, counted by _disk_usage, evictable by age.
        return found

    async def async_shutdown(self) -> None:
        """Cancel fills and wait for them."""
        self._closed = True
        tasks = [e.task for e in self._entries.values() if e.task is not None]
        tasks += list(self._flat_tasks)
        for _entry, cancel in self._drop_timers.values():
            cancel()
        self._drop_timers.clear()
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
            found = await self._hass.async_add_executor_job(_on_disk, path)
            # Another call may have set the entry up while this one looked.
            current = self._entries.get(cache_id)
            if current is not None and current.error is None:
                entry = current
            else:
                failed = current if current is not None else entry
                entry = self._new_entry(recording, path, priority, failed, found)
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

    def _new_entry(
        self,
        recording: Recording,
        path: Path,
        priority: Priority,
        failed: Entry | None,
        found: tuple[str, int, bool] | None,
    ) -> Entry:
        entry = Entry(recording, path, priority=priority)
        if failed is not None:
            # URLs issued for the failed fill still read this recording.
            entry.lease_until = failed.lease_until
            entry.original_until = failed.original_until
        self._entries[recording.cache_id] = entry
        if found is None:
            return entry
        kind, size, indexed = found
        entry.written = size
        entry.complete = True
        if kind == "flat":
            entry.flat_at = 0.0  # every URL gets the plain file
            entry.has_original = False
            entry.timing = {"cache": "disk", "flat": "yes"}
        else:
            entry.timing = {"cache": "disk", "indexed": "yes" if indexed else "no"}
            self._start_flatten(entry)
        return entry

    def lease(self, entry: Entry, seconds: float) -> bool:
        """Keep a recording readable by a URL valid for ``seconds``.

        Returns True if the URL is bound to the plain copy, False if to the
        original (the plain copy is not ready yet). Neither the recording nor
        the file the URL is bound to is evicted or swapped while it lasts
        (plus a margin for a request sent just before it expires).
        """
        until = _clock() + seconds + LEASE_MARGIN_S
        entry.lease_until = max(entry.lease_until, until)
        flat = entry.flat_at is not None
        if not flat:
            entry.original_until = max(entry.original_until, until)
        return flat

    async def _fill(self, entry: Entry) -> None:
        rec = entry.recording
        began = time.monotonic()
        entry.timing = {"cache": "fill", "priority": entry.priority.name.lower()}
        host_sched = self._scheduler.host(rec.source.entry_id)
        try:
            ticket = host_sched.streams.request(entry.priority)
            entry.ticket = ticket
            try:
                await ticket.wait()
                entry.timing["wait_ms"] = _ms(began)
                # Checked now rather than when it queued: other fills may
                # have used the space meanwhile.
                await self._make_room(entry.part_path, expected_size(rec))
                await self._download(entry)
            finally:
                ticket.release()
                entry.ticket = None
                self._reserved.pop(entry.part_path, None)
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
            self._start_flatten(entry)
        finally:
            async with entry.changed:
                entry.changed.notify_all()

    # ---- Plain MP4 ----

    def served_path(self, entry: Entry, flat: bool) -> Path:
        """Return the file for a URL bound to the plain copy or the original.

        A URL keeps its file for its whole life (``lease``), so a playing
        video never sees its bytes change.
        """
        if flat or not entry.has_original:
            return entry.flat_path
        return entry.path

    def _start_flatten(self, entry: Entry) -> None:
        if self._ffmpeg is None:
            entry.timing["flat"] = "no: ffmpeg not found"
            return
        if self._closed:
            return
        if entry.flat_at is not None or entry.flattening:
            return
        entry.flattening = True
        task = self._hass.async_create_background_task(
            self._flatten(entry), f"reolink_viewer flatten {entry.path.stem[:8]}"
        )
        self._flat_tasks.add(task)
        task.add_done_callback(self._flat_tasks.discard)

    async def _flatten(self, entry: Entry) -> None:
        """Rewrite a complete recording as a plain MP4 (one at a time)."""
        assert self._ffmpeg is not None
        target = entry.flat_path
        part = target.with_name(target.name + PART_SUFFIX)
        # A deletion still pending from an older entry of this recording
        # must not hit this one's original.
        self._cancel_drop(entry.recording.cache_id)
        try:
            async with self._flatten_lock:
                try:
                    # The copy is a second file as large as the first.
                    await self._make_room(part, entry.written + _flat_extra(entry))
                except VodCacheError as err:
                    entry.timing["flat"] = f"no: {err}"
                    return
                began = time.monotonic()
                await async_flatten(self._ffmpeg, entry.path, part)
                if not await self._hass.async_add_executor_job(is_plain, part):
                    raise RemuxError("the result is not a plain MP4")
                await self._hass.async_add_executor_job(part.replace, target)
                self._reserved.pop(part, None)
                entry.flat_at = time.monotonic()
                entry.timing["flat"] = "yes"
                entry.timing["flat_ms"] = _ms(began)
        except (RemuxError, OSError) as err:
            entry.timing["flat"] = f"no: {err}"
            _LOGGER.debug("Plain MP4 of %s failed: %s", entry.path.stem[:8], err)
            await self._hass.async_add_executor_job(_unlink, part)
            return
        except BaseException:
            await self._hass.async_add_executor_job(_unlink, part)
            raise
        finally:
            self._reserved.pop(part, None)
            entry.flattening = False
        self._schedule_drop(entry)

    def _schedule_drop(self, entry: Entry) -> None:
        """Delete the original once no URL bound to it can be used."""
        if self._closed:
            return
        cache_id = entry.recording.cache_id
        self._cancel_drop(cache_id)
        delay = max(entry.original_until - _clock(), 0.0) + DROP_MARGIN_S
        cancel = async_call_later(self._hass, delay, self._drop_original(entry))
        self._drop_timers[cache_id] = (entry, cancel)

    def _cancel_drop(self, cache_id: str) -> None:
        if (pending := self._drop_timers.pop(cache_id, None)) is not None:
            pending[1]()

    def _drop_original(self, entry: Entry) -> Callable[[datetime], None]:
        @callback
        def drop(_now: datetime) -> None:
            cache_id = entry.recording.cache_id
            if (pending := self._drop_timers.get(cache_id)) and pending[0] is entry:
                del self._drop_timers[cache_id]
            # Only the entry that made the plain copy deletes its original.
            if self._entries.get(cache_id) is not entry or entry.flat_at is None:
                return
            if not entry.has_original:
                return
            if entry.original_until > _clock():
                self._schedule_drop(entry)
                return
            entry.has_original = False
            self._hass.async_add_executor_job(_unlink, entry.path)

        return drop

    # ---- Disk space ----

    async def _make_room(self, path: Path, size: int) -> None:
        """Reserve ``size`` bytes for the file at ``path``, evicting if needed.

        Raises VodCacheError (and reserves nothing) when the cap or the
        free-space rule cannot be kept.
        """
        async with self._space_lock:
            previous = self._reserved.get(path)
            self._reserved[path] = size
            made = False
            try:
                made = await self._evict_locked()
            finally:
                if not made:
                    if previous is None:
                        self._reserved.pop(path, None)
                    else:
                        self._reserved[path] = previous
            if not made:
                raise VodCacheError("not enough free disk space")

    async def _grow(self, entry: Entry, needed: int) -> None:
        """Reserve more for a fill that outgrew its reservation."""
        if needed <= self._reserved.get(entry.part_path, 0):
            return
        await self._make_room(entry.part_path, needed + max(needed // 20, GROW_STEP))

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
        planned = rec.cache_id in self._no_index
        if planned:
            entry.timing["indexed"] = "no: offsets could not be shifted before"
        index_at = reserve = 0
        shifter: OffsetShifter | None = None
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
                            rest = bytes(head[index_at:])
                            del head[index_at:]
                            head += free_box(reserve)
                            # Absolute data offsets after the room move with it.
                            shifter = OffsetShifter(reserve)
                            head += self._shift(rec, shifter, rest)
                        else:
                            entry.timing["indexed"] = f"no: {plan.reason}"
                        chunk = bytes(head)
                    elif shifter is not None:
                        chunk = self._shift(rec, shifter, chunk)
                    buffer += chunk
                    # Write small at first so playback can start at once.
                    if len(buffer) >= (WRITE_BATCH if entry.written else 64 * 1024):
                        await self._write(entry, fd, bytes(buffer))
                        buffer.clear()
                if not planned:
                    buffer += head
                if shifter is not None:
                    buffer += shifter.finish()
                if buffer:
                    await self._write(entry, fd, bytes(buffer))
            if reserve:
                await self._write_index(entry, fd, index_at, reserve)
        finally:
            await self._hass.async_add_executor_job(os.close, fd)
        if entry.written == 0:
            raise VodCacheError("empty recording")
        await self._hass.async_add_executor_job(entry.part_path.replace, entry.path)
        self._reserved.pop(entry.part_path, None)
        entry.complete = True
        seconds = max(time.monotonic() - began, 1e-3)
        entry.timing["mbit_s"] = round(entry.written * 8 / seconds / 1e6, 1)
        await self._remember_media(rec, scanner, entry.timing.get("indexed"))

    def _shift(self, rec: Recording, shifter: OffsetShifter, data: bytes) -> bytes:
        try:
            return shifter.feed(data)
        except OffsetShiftError as err:
            # The next fill of this recording leaves the file as it is.
            self._no_index.add(rec.cache_id)
            raise VodCacheError(f"cannot shift offsets for the index: {err}") from err

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
        await self._grow(entry, entry.written + len(data))
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

    async def _evict(self) -> bool:
        """Evict until the cap and the free-space rule hold; return if they do."""
        async with self._space_lock:
            return await self._evict_locked()

    async def _evict_locked(self) -> bool:
        """Delete least-recently-used recordings to make the reserved room.

        Everything on disk counts (``.part`` files too), plus what each
        reservation has still to write. A recording's original and plain copy
        go together; busy or leased recordings stay.
        """
        files = await self._hass.async_add_executor_job(self._disk_usage)
        disk = await self._hass.async_add_executor_job(shutil.disk_usage, self._dir)
        sizes = {path: size for path, size, _mtime in files}
        pending = sum(
            max(size - sizes.get(path, 0), 0) for path, size in self._reserved.items()
        )
        on_disk = sum(sizes.values())
        self._usage = {"disk": on_disk, "reserved": pending, "free": disk.free}
        # Deleting a file lowers the total and raises free space alike.
        need = max(
            on_disk + pending - self._max_bytes,
            MIN_FREE_BYTES - (disk.free - pending),
            0,
        )
        if not need:
            return True
        units: dict[str, list[tuple[Path, int]]] = {}
        newest: dict[str, float] = {}
        for path, size, mtime in files:
            if path.name.endswith(PART_SUFFIX):
                continue
            cache_id = _cache_id_of(path)
            units.setdefault(cache_id, []).append((path, size))
            newest[cache_id] = max(newest.get(cache_id, 0.0), mtime)
        now = _clock()
        protected = {cid for cid, e in self._entries.items() if e.busy(now)}
        protected |= {_cache_id_of(path) for path in self._reserved}

        def order(cache_id: str) -> tuple[bool, float]:
            # Unknown files (previous runs) first, oldest first; then by access.
            entry = self._entries.get(cache_id)
            if entry is None:
                return (False, newest[cache_id])
            return (True, entry.last_access)

        freed = 0
        for cache_id in sorted(units, key=order):
            if freed >= need:
                break
            if cache_id in protected:
                continue
            for path, size in units[cache_id]:
                await self._hass.async_add_executor_job(_unlink, path)
                freed += size
            # Forget it: it is fetched again when asked for.
            self._entries.pop(cache_id, None)
            self._cancel_drop(cache_id)
        self._usage["disk"] -= freed
        self._usage["free"] += freed
        return freed >= need

    def _disk_usage(self) -> list[tuple[Path, int, float]]:
        result = []
        for path in self._dir.iterdir():
            if path.suffix in (SUFFIX, PART_SUFFIX):
                try:
                    stat = path.stat()
                except FileNotFoundError:
                    continue  # deleted meanwhile (a failed fill's part file)
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
        now = _clock()
        return {
            "entries": len(self._entries),
            "filling": sum(1 for e in self._entries.values() if e.filling),
            "leased": sum(1 for e in self._entries.values() if e.leased(now)),
            "max_bytes": self._max_bytes,
            # As of the last time room was made: on disk, still to be written.
            **{f"{key}_bytes": value for key, value in self._usage.items()},
        }


def expected_size(rec: Recording) -> int:
    """Return the bytes a fill reserves for a recording."""
    seconds = max(rec.end_ms - rec.start_ms, 0) / 1000
    if rec.size:
        size = rec.size
    else:
        size = int(
            seconds * ESTIMATE_BITS_S.get(rec.stream, ESTIMATE_BITS_S["main"]) / 8
        )
    return size + int(size * SIZE_MARGIN) + index_room(seconds)


def _flat_extra(entry: Entry) -> int:
    return int(entry.written * FLAT_MARGIN)


def _on_disk(path: Path) -> tuple[str, int, bool] | None:
    """Return what a previous run left of a recording: plain copy or original."""
    flat = path.with_name(path.stem + FLAT_SUFFIX)
    if flat.exists():
        return "flat", flat.stat().st_size, False
    if path.exists():
        return "original", path.stat().st_size, has_index(str(path))
    return None


def _cache_id_of(path: Path) -> str:
    name = path.name.removesuffix(PART_SUFFIX)
    return name.removesuffix(FLAT_SUFFIX).removesuffix(SUFFIX)


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


def _clock() -> float:
    """Return the monotonic clock for leases (a hook for tests)."""
    return time.monotonic()

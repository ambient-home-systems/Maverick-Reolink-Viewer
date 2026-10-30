"""Disk cache of recordings, filled from the device and served while it fills.

The RLN36 ignores HTTP Range on DOWNLOAD but sends at 30 to 1000 times real time, as
a fragmented MP4 with its ``moov`` first (hardware-matrix.md). So each
recording is downloaded once, at full speed, into this cache; the browser is
served from the cache, with Range, by ``views.py``:

- a fill holds a slot of the host's **stream budget** (not a request slot) for
  as long as it downloads; prefetch fills have their own, smaller cap;
- readers can start as soon as the first bytes are on disk and follow the
  fill as it grows;
- one fill per recording, however many viewers; a recording still being
  written is fetched again once it has grown past the copy a start needs
  (each length is its own copy);
- disk use is accounted before bytes are written: the size cap and the
  free-space rule cover complete files, ``.part`` files, the rest each running
  fill expects (reserved once it holds its stream slot, checked then rather
  than when it queued) and the second copy a plain-MP4 rewrite writes;
- least-recently-used recordings are evicted to make that room, a recording's
  original and plain copy together as one unit; recordings being filled,
  rewritten or read are never evicted, nor those still readable through a live
  URL (a *lease*: Range requests are not counted as readers). The player
  releases a URL's lease when it moves on, and a fill behind a click may take
  the room of a lease no request has used for ``LEASE_IDLE_S``;
- the first fill of a camera's stream records its codec and size (from the
  ``moov``) for the browser's MediaCapabilities check;
- room is left after the ``moov`` for a segment index (``mp4index.py``),
  written once the file is complete;
- the MSE player reads the original as fragments made MSE-ready on the fly
  (``fmp4.py``), each as soon as it is on disk, so a start deep in a
  recording waits only for the bytes up to it;
- with the Phase 5b option on, a start well past what the download has
  reached is served from a cut the device sends of that moment
  (``baichuan_source.py``): its fragments in a file of their own beside the
  original, numbered from ``CUT_FIRST`` so a window's ``first`` says which
  file it reads; the download goes on, and any failure of the cut falls back
  to it;
- the file player (the fallback) gets a plain MP4 (``remux.py``), rewritten
  from the complete original when first asked for, one at a time: browsers
  read a fragmented file whole before playing it. The original is kept (the
  MSE player needs it); both go together when evicted.

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
from typing import Any, BinaryIO

from aiohttp import ClientError, ClientSession, ClientTimeout

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from . import bridge
from .baichuan_source import BaichuanSource, Cut, CutError
from .bridge import VodFile, VodMethod
from .devices import PlaybackSource
from .fmp4 import Fragment, FragmentError, FragmentIndex
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
from .remux import RemuxError, async_flatten, is_plain, moov_size
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
# A cut of a recording (Phase 5b): <cache id>.<n>.cut.mp4, this run only.
CUT_SUFFIX = ".cut.mp4"
# Window indices of a recording's n-th cut start at n times this (the
# original's below it), so a window asked of a cut since replaced is refused.
CUT_FIRST = 1_000_000
# A start is cut only this far past what the download has indexed (ms): a
# start closer than that is reached by the download about as soon.
DEEP_MARGIN_MS = 30_000
# A start this far past what a running cut has received waits for it (ms).
CUT_REACH_MS = 60_000
# A cut's first fragment must come within this long, else the download serves.
CUT_FIRST_WAIT_S = 6.0
# A lease outlasts its URL by this much.
LEASE_MARGIN_S = 60.0
# A fill behind a click (playback priority) may evict a recording whose
# leases no request has used for this long: the player that held it moved on
# without releasing them (e.g. the page was closed) or has long been paused.
LEASE_IDLE_S = 300.0
# Part of each file's cache id: bumping it retires files of an older layout
# (they become unknown files, evicted first). 2: segment index added.
# 3: also indexed when fragments use absolute offsets (the NVR's do).
# 4: the recording's end is part of the id, so a recording still being
# written is cached anew once it has grown past its copy.
# 5: the original is kept next to the plain copy (the MSE player reads it).
LAYOUT = 5
# A copy of a recording that has since grown still serves a start at least
# this long before the copy's end.
COVER_MARGIN_MS = 60_000
# Fragments are read and made MSE-ready in batches of about this many bytes.
FRAGMENT_BATCH = 4 * 1024 * 1024


class VodCacheError(Exception):
    """A recording could not be cached."""


@dataclass(frozen=True, slots=True)
class Window:
    """Fragments to send the MSE player: ``first`` is the first one's index."""

    first: int
    fragments: tuple[Fragment, ...]
    # The recording ends with these (it is complete and nothing follows).
    last: bool
    # Where the fragments are read from: the original ("file") or a cut.
    source: str = "file"

    @property
    def start_ms(self) -> float | None:
        """Return the media time the window starts at."""
        return self.fragments[0].start_ms if self.fragments else None

    @property
    def end_ms(self) -> float | None:
        """Return the media time the window ends at."""
        last = self.fragments[-1] if self.fragments else None
        return last.start_ms + last.duration_ms if last else None


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
        raw = f"{LAYOUT}|{self.source.key}|{self.stream}|{self.name}|{self.end_ms}"
        return hashlib.sha256(raw.encode()).hexdigest()[:32]

    @property
    def copy_key(self) -> str:
        """Return what copies of one recording, at any length, share."""
        return f"{self.source.key}|{self.stream}|{self.name}"


@dataclass(slots=True)
class Lease:
    """A URL that can still read a recording (see ``VodCache.lease``)."""

    # Until then (_clock): the URL's expiry plus a margin.
    until: float
    # When the URL was issued or last read (_clock).
    read_at: float

    def live(self, now: float, idle: float | None) -> bool:
        """Return True while it holds the recording (with ``idle``: and was used)."""
        return self.until > now and (idle is None or now - self.read_at <= idle)


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
    flat_task: asyncio.Task[None] | None = None
    # The live URLs that can read this recording, by token.
    leases: dict[str, Lease] = field(default_factory=dict)
    # The original's fragments found so far (the MSE player's reads).
    fragments: FragmentIndex | None = None
    index_lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    # The device's cut of a moment deep in it (Phase 5b), if one was made.
    cut: Cut | None = None
    cuts: int = 0
    cut_lock: asyncio.Lock = field(default_factory=asyncio.Lock)

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

    @property
    def flattening(self) -> bool:
        """Return True while the plain MP4 is being written."""
        return self.flat_task is not None and not self.flat_task.done()

    def leased(self, now: float, idle: float | None = None) -> bool:
        """Return True while a live URL can read this recording.

        With ``idle``, only URLs issued or read within that many seconds count.
        """
        return any(lease.live(now, idle) for lease in self.leases.values())

    def busy(self, now: float, idle: float | None = None) -> bool:
        """Return True while the recording's files must stay on disk."""
        return bool(
            self.readers or self.filling or self.flattening or self.leased(now, idle)
        )

    def public(self) -> dict[str, Any]:
        """Return debug information for the browser."""
        out = {
            "complete": self.complete,
            "bytes": self.written,
            "error": self.error,
            **self.timing,
        }
        if self.cut is not None:
            out["cut"] = self.cut.public()
        return out


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
        baichuan: BaichuanSource | None = None,
    ) -> None:
        """Initialize the cache (call async_setup before use)."""
        self._hass = hass
        self._baichuan = baichuan
        self._ffmpeg = ffmpeg_binary
        self._flatten_lock = asyncio.Lock()
        self._flat_tasks: set[asyncio.Task[None]] = set()
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
        # Each leased URL (by token): the recording it reads, and its lease.
        self._leases: dict[str, tuple[str, Lease]] = {}
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
            if path.name.endswith((PART_SUFFIX, CUT_SUFFIX)):
                # Cuts serve the viewers of one run only.
                path.unlink(missing_ok=True)
            elif path.name.endswith(FLAT_SUFFIX):
                cache_id = path.name.removesuffix(FLAT_SUFFIX)
                if cache_id + SUFFIX not in names:
                    # A plain copy without its original serves no MSE player.
                    path.unlink(missing_ok=True)
                    continue
                found[cache_id] = found.get(cache_id, 0) + path.stat().st_size
            elif path.suffix == SUFFIX:
                found[path.stem] = found.get(path.stem, 0) + path.stat().st_size
        # Files from a previous run cannot be matched to recordings until asked
        # for; keep them on disk, counted by _disk_usage, evictable by age.
        return found

    async def async_shutdown(self) -> None:
        """Cancel fills and wait for them."""
        self._closed = True
        tasks = [e.task for e in self._entries.values() if e.task is not None]
        tasks += list(self._flat_tasks)
        for task in tasks:
            task.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    # ---- Entries ----

    def entry(self, recording: Recording) -> Entry | None:
        """Return the entry of a recording, if known."""
        return self._entries.get(recording.cache_id)

    async def async_open(
        self,
        recording: Recording,
        priority: Priority = Priority.PLAYBACK,
        *,
        at: int | None = None,
        any_copy: bool = False,
    ) -> Entry:
        """Return the recording's entry, starting or speeding up its fill.

        A recording still being written grows between searches, and each
        length is its own copy. A copy made when it was shorter still serves
        a start at ``at`` (UTC ms) if it reaches far enough past it; with
        ``any_copy`` (prefetch) any copy will do, so warming does not fetch a
        growing recording again every minute.
        """
        if self._closed:
            raise VodCacheError("cache closed")
        cache_id = recording.cache_id
        entry = self._entries.get(cache_id)
        if (entry is None or entry.error is not None) and (
            copy := self._copy_for(recording, at, any_copy)
        ) is not None:
            entry = copy
            cache_id = copy.recording.cache_id
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

    def _copy_for(
        self, recording: Recording, at: int | None, any_copy: bool
    ) -> Entry | None:
        """Return the longest usable copy of the recording at another length."""
        if at is None and not any_copy:
            return None
        key = recording.copy_key
        copies = [
            e
            for e in self._entries.values()
            if e.error is None
            and e.recording.copy_key == key
            and (
                any_copy
                or (at is not None and e.recording.end_ms - COVER_MARGIN_MS >= at)
            )
        ]
        return max(copies, key=lambda e: e.recording.end_ms, default=None)

    def _new_entry(
        self,
        recording: Recording,
        path: Path,
        priority: Priority,
        failed: Entry | None,
        found: tuple[int, bool, bool] | None,
    ) -> Entry:
        entry = Entry(recording, path, priority=priority)
        if failed is not None:
            # URLs issued for the failed fill still read this recording.
            entry.leases = failed.leases
        self._entries[recording.cache_id] = entry
        if found is None:
            return entry
        size, indexed, flat = found
        entry.written = size
        entry.complete = True
        entry.timing = {"cache": "disk", "indexed": "yes" if indexed else "no"}
        if flat:
            entry.flat_at = 0.0
            entry.timing["flat"] = "yes"
        return entry

    async def async_peek(self, recording: Recording) -> dict[str, Any] | None:
        """Return what the cache holds of a recording, without fetching it.

        A copy made while the recording was shorter counts: a start it
        reaches plays from it (see ``async_open``).
        """
        entry = self._entries.get(recording.cache_id) or self._copy_for(
            recording, None, any_copy=True
        )
        if entry is not None:
            return entry.public()
        path = self._dir / f"{recording.cache_id}{SUFFIX}"
        found = await self._hass.async_add_executor_job(_on_disk, path)
        if found is None:
            return None
        size, _indexed, flat = found
        return {
            "complete": True,
            "bytes": size,
            "error": None,
            "cache": "disk",
            "flat": "yes" if flat else "not yet",
        }

    def lease(self, entry: Entry, seconds: float, token: str) -> None:
        """Keep a recording readable by the URL ``token``, valid for ``seconds``.

        Neither its original nor its plain copy is evicted while the lease
        lasts (plus a margin for a request sent just before it expires), and
        neither file is ever swapped. It ends early when released (the player
        moved on); a fill behind a click may evict it once it has not been
        used for ``LEASE_IDLE_S`` (see ``touch``).
        """
        now = _clock()
        self._prune_leases(now)
        lease = Lease(now + seconds + LEASE_MARGIN_S, now)
        entry.leases[token] = lease
        self._leases[token] = (entry.recording.cache_id, lease)

    def touch(self, token: str) -> None:
        """Note that the URL ``token`` was just used (a request read it).

        Call it after opening the recording: if an idle lease let it be
        evicted and it was fetched again, the new copy is leased again.
        """
        if (item := self._leases.get(token)) is None:
            return
        cache_id, lease = item
        lease.read_at = _clock()
        if (entry := self._entries.get(cache_id)) is not None:
            entry.leases.setdefault(token, lease)

    def release(self, token: str) -> None:
        """End the lease of the URL ``token`` (it keeps working, unleased).

        The last viewer leaving stops the recording's cut, if one runs.
        """
        if (item := self._leases.pop(token, None)) is None:
            return
        if (entry := self._entries.get(item[0])) is not None:
            entry.leases.pop(token, None)
            if not entry.leases and entry.cut is not None:
                self._hass.async_create_background_task(
                    self._end_cut(entry), "reolink_viewer end cut"
                )

    def _prune_leases(self, now: float) -> None:
        """Forget the leases that have ended."""
        for token, (cache_id, lease) in list(self._leases.items()):
            if lease.until <= now:
                del self._leases[token]
                if (entry := self._entries.get(cache_id)) is not None:
                    entry.leases.pop(token, None)

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
                await self._make_room(
                    entry.part_path, expected_size(rec), playback=_clicked(entry)
                )
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
            if entry.cut is not None and not entry.leases:
                # Whole now, and no viewer left: the cut is not needed.
                await self._end_cut(entry)
            await self._evict()
        finally:
            async with entry.changed:
                entry.changed.notify_all()

    # ---- Plain MP4 (the file player) ----

    def served_path(self, entry: Entry, flat: bool) -> Path:
        """Return the plain copy if asked for and made, else the original."""
        if flat and entry.flat_at is not None:
            return entry.flat_path
        return entry.path

    async def async_plain(self, entry: Entry) -> bool:
        """Make sure a complete recording has its plain copy; return if it has.

        The first call starts the rewrite and every call waits for it. A
        rewrite that failed is not tried again for this entry: its URLs keep
        getting the original.
        """
        if entry.flat_at is not None:
            return True
        if not entry.complete or self._closed:
            return False
        if entry.flat_task is None:
            if self._ffmpeg is None:
                entry.timing["flat"] = "no: ffmpeg not found"
                return False
            task = self._hass.async_create_background_task(
                self._flatten(entry), f"reolink_viewer flatten {entry.path.stem[:8]}"
            )
            entry.flat_task = task
            self._flat_tasks.add(task)
            task.add_done_callback(self._flat_tasks.discard)
        # A request that goes away leaves the rewrite running for the next.
        await asyncio.shield(entry.flat_task)
        return entry.flat_at is not None

    async def _flatten(self, entry: Entry) -> None:
        """Rewrite a complete recording as a plain MP4 (one at a time)."""
        assert self._ffmpeg is not None
        target = entry.flat_path
        part = target.with_name(target.name + PART_SUFFIX)
        try:
            async with self._flatten_lock:
                try:
                    # The copy is a second file as large as the first; only
                    # the file player asks for it.
                    await self._make_room(
                        part, entry.written + _flat_extra(entry), playback=True
                    )
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
                # What a browser reads before the first frame of a plain MP4.
                entry.timing[
                    "flat_moov_bytes"
                ] = await self._hass.async_add_executor_job(moov_size, target)
        except (RemuxError, OSError) as err:
            entry.timing["flat"] = f"no: {err}"
            _LOGGER.debug("Plain MP4 of %s failed: %s", entry.path.stem[:8], err)
            await self._hass.async_add_executor_job(_unlink, part)
        except BaseException:
            await self._hass.async_add_executor_job(_unlink, part)
            raise
        finally:
            self._reserved.pop(part, None)

    # ---- MSE fragments ----

    async def async_init(
        self, entry: Entry, *, at_ms: float | None = None, source: str | None = None
    ) -> tuple[bytes, str | None, str]:
        """Return an init segment (ftyp + moov), its MIME type and its source.

        ``source`` "cut": the cut's (a window from it follows); with ``at_ms``
        the source that will serve a start there (a cut may begin); else the
        original's.
        """
        if source == "cut":
            cut = entry.cut
            if cut is None or cut.index.init is None:
                raise VodCacheError("no cut of this recording")
            return cut.index.init, cut.index.mime, "cut"
        if at_ms is not None and source is None:
            cut = await self._cut_for(entry, at_ms)
            if cut is not None:
                return cut.index.init or b"", cut.index.mime, "cut"
        index, _complete = await self._await_index(entry, lambda i: i.init is not None)
        assert index.init is not None
        return index.init, index.mime, "file"

    async def async_window(
        self,
        entry: Entry,
        *,
        at_ms: float | None = None,
        first: int | None = None,
        max_ms: float,
        max_bytes: int,
    ) -> Window:
        """Return the fragments to send next, waiting for the first to be on disk.

        From ``first`` (an index), or from the sync fragment showing ``at_ms``
        (ms of media time). Then as many as are on disk, up to ``max_ms`` of
        media and ``max_bytes`` (at least one fragment).
        """

        if first is not None and first >= CUT_FIRST:
            cut = entry.cut
            if cut is None or first // CUT_FIRST != cut.generation:
                raise VodCacheError("that cut of the recording was replaced")
            return await self._cut_window(
                cut, first=first % CUT_FIRST, max_ms=max_ms, max_bytes=max_bytes
            )
        if first is None and (cut := await self._cut_for(entry, at_ms or 0.0)):
            return await self._cut_window(
                cut, at_ms=at_ms or 0.0, max_ms=max_ms, max_bytes=max_bytes
            )

        def start(index: FragmentIndex) -> int | None:
            if first is not None:
                return first if first < len(index.fragments) else None
            return index.find(at_ms or 0.0)

        index, complete = await self._await_index(entry, lambda i: start(i) is not None)
        begin = start(index)
        if begin is None:
            # The recording ends before that point.
            if first is None and index.fragments:
                begin = _last_sync(index)
            else:
                return Window(len(index.fragments), (), last=True)
        chosen: list[Fragment] = []
        media = 0.0
        size = 0
        for fragment in index.fragments[begin:]:
            if chosen and (media >= max_ms or size + fragment.size > max_bytes):
                break
            chosen.append(fragment)
            media += fragment.duration_ms
            size += fragment.size
        # Last only if the scan saw the whole file: the fill may have
        # completed since, with fragments past those scanned.
        last = complete and begin + len(chosen) == len(index.fragments)
        return Window(begin, tuple(chosen), last=last)

    async def async_read_window(
        self, entry: Entry, window: Window
    ) -> AsyncIterator[bytes]:
        """Yield the window's fragments, made MSE-ready, in batches."""
        index = entry.fragments
        candidates = self._candidates(entry)
        first = window.first
        cut = entry.cut
        if window.source == "cut":
            if cut is None:
                raise VodCacheError("no cut of this recording")
            index = cut.index
            candidates = (cut.path, cut.path)
            first %= CUT_FIRST
            cut.readers += 1
            cut.last_read = time.monotonic()
        assert index is not None
        entry.readers += 1
        entry.last_access = time.monotonic()
        try:
            batch: list[int] = []
            size = 0
            for i, fragment in enumerate(window.fragments, first):
                batch.append(i)
                size += fragment.size
                if size >= FRAGMENT_BATCH or i == first + len(window.fragments) - 1:
                    yield await self._hass.async_add_executor_job(
                        _read_fragments, candidates, index, batch
                    )
                    batch, size = [], 0
        except FragmentError as err:
            raise VodCacheError(f"not playable as fragments: {err}") from err
        except FileNotFoundError as err:
            # The fill failed and removed its file after the window was chosen.
            raise VodCacheError(entry.error or "recording file gone") from err
        finally:
            entry.readers -= 1
            entry.last_access = time.monotonic()
            if window.source == "cut" and cut is not None:
                cut.readers -= 1

    # ---- Cuts (Phase 5b) ----

    async def _cut_for(self, entry: Entry, at_ms: float) -> Cut | None:
        """Return the cut that serves a start at ``at_ms``, starting one if worth it.

        None when the option is off, the original can serve it now or will
        soon (within ``DEEP_MARGIN_MS`` of what is indexed), or the cut
        failed: the original serves it then (the Phase 2 path).
        """
        source = self._baichuan
        if source is None or not source.enabled or entry.complete:
            return None
        # One decision at a time per recording: concurrent starts share a cut.
        async with entry.cut_lock:
            cut = await self._choose_cut(entry, source, at_ms)
        return None if cut is None else await self._first_fragment(entry, cut, at_ms)

    async def _choose_cut(
        self, entry: Entry, source: BaichuanSource, at_ms: float
    ) -> Cut | None:
        """Return the cut covering ``at_ms``, a new one, or None (the original)."""
        indexed = await self._indexed_now(entry)
        if indexed is not None and indexed.find(at_ms) is not None:
            return None
        cut = entry.cut
        if cut is not None and cut.error is None and _covers(cut, at_ms):
            return cut
        reached = indexed.duration_ms if indexed is not None else 0.0
        if at_ms - reached < DEEP_MARGIN_MS:
            return None
        rec = entry.recording
        remaining = max(rec.end_ms - rec.start_ms - at_ms, 0)
        length = max(rec.end_ms - rec.start_ms, 1)
        size = int(expected_size(rec) * min(remaining / length + 0.01, 1.0))
        entry.cuts += 1
        path = entry.path.with_name(f"{rec.cache_id}.{entry.cuts}{CUT_SUFFIX}")
        try:
            cut = await source.async_start(
                entry_id=rec.source.entry_id,
                channel=rec.source.channel,
                stream=rec.stream,
                start_ms=rec.start_ms,
                end_ms=rec.end_ms,
                at_ms=at_ms,
                path=path,
                reserve=self._reserve_cut,
                size=size,
            )
        except CutError as err:
            entry.timing["cut_error"] = str(err)
            return None
        cut.generation = entry.cuts
        old, entry.cut = entry.cut, cut
        if cut.task is not None:
            cut.task.add_done_callback(lambda _t: self._reserved.pop(path, None))
        if old is not None and old.readers == 0:
            await self._hass.async_add_executor_job(_unlink, old.path)
        return cut

    async def _first_fragment(self, entry: Entry, cut: Cut, at_ms: float) -> Cut | None:
        """Wait for the cut to reach ``at_ms``; None (and stop it) if it fails."""
        try:
            await self._await_cut(
                cut, lambda i: i.find(at_ms) is not None, CUT_FIRST_WAIT_S
            )
        except CutError as err:
            entry.timing["cut_error"] = str(err)
            if self._baichuan is not None:
                await self._baichuan.async_stop(cut)
            return None
        if cut.index.find(at_ms) is None:
            # The cut ended before that point: the original serves it.
            entry.timing["cut_error"] = "the cut ended before that moment"
            return None
        entry.timing.pop("cut_error", None)
        return cut

    async def _await_cut(
        self, cut: Cut, ready: Callable[[FragmentIndex], bool], wait: float | None
    ) -> None:
        """Wait until ``ready(cut.index)`` or the cut ends; CutError on failure."""
        deadline = None if wait is None else time.monotonic() + wait
        async with cut.changed:
            while not ready(cut.index):
                if cut.error is not None:
                    raise CutError(cut.error)
                if cut.complete or not cut.running:
                    if cut.index.fragments:
                        return
                    raise CutError("the cut ended without a fragment")
                timeout = None if deadline is None else deadline - time.monotonic()
                if timeout is not None and timeout <= 0:
                    raise CutError(f"no fragment within {wait:.0f} s")
                try:
                    async with asyncio.timeout(timeout):
                        await cut.changed.wait()
                except TimeoutError:
                    continue

    async def _cut_window(
        self,
        cut: Cut,
        *,
        at_ms: float | None = None,
        first: int | None = None,
        max_ms: float,
        max_bytes: int,
    ) -> Window:
        """Return a window of the cut's fragments (like the original's)."""

        def start(index: FragmentIndex) -> int | None:
            if first is not None:
                return first if first < len(index.fragments) else None
            return index.find(at_ms or 0.0)

        try:
            await self._await_cut(cut, lambda i: start(i) is not None, None)
        except CutError as err:
            raise VodCacheError(f"cut failed: {err}") from err
        index = cut.index
        begin = start(index)
        base = CUT_FIRST * cut.generation
        if begin is None:
            # The cut ended before that point.
            return Window(base + len(index.fragments), (), True, "cut")
        chosen: list[Fragment] = []
        media = 0.0
        size = 0
        for fragment in index.fragments[begin:]:
            if chosen and (media >= max_ms or size + fragment.size > max_bytes):
                break
            chosen.append(fragment)
            media += fragment.duration_ms
            size += fragment.size
        last = cut.complete and begin + len(chosen) == len(index.fragments)
        return Window(base + begin, tuple(chosen), last, "cut")

    async def _indexed_now(self, entry: Entry) -> FragmentIndex | None:
        """Index what the original holds now, without waiting for more."""
        if not entry.written:
            return entry.fragments
        if entry.fragments is None:
            entry.fragments = FragmentIndex()
        try:
            async with entry.index_lock:
                await self._hass.async_add_executor_job(
                    _scan_fragments,
                    self._candidates(entry),
                    entry.fragments,
                    entry.written,
                )
        except FileNotFoundError:
            return None
        return entry.fragments if entry.fragments.error is None else None

    async def _reserve_cut(self, path: Path, size: int) -> None:
        try:
            await self._make_room(path, size, playback=True)
        except VodCacheError as err:
            raise CutError(str(err)) from err

    async def _end_cut(self, entry: Entry) -> None:
        """Stop the cut (the last viewer left); drop it once the original is whole."""
        cut = entry.cut
        if cut is None or entry.leases:
            return
        if self._baichuan is not None:
            await self._baichuan.async_stop(cut)
        if entry.complete and cut.readers == 0 and entry.cut is cut:
            entry.cut = None
            await self._hass.async_add_executor_job(_unlink, cut.path)

    async def _await_index(
        self, entry: Entry, ready: Callable[[FragmentIndex], bool]
    ) -> tuple[FragmentIndex, bool]:
        """Index the original as it fills until ``ready`` (or it is complete).

        Returns the index and whether the file was complete when the scan
        began (then the index holds every fragment).
        """
        if entry.fragments is None:
            entry.fragments = FragmentIndex()
        index = entry.fragments
        while True:
            if entry.error is not None and not entry.complete:
                raise VodCacheError(entry.error)
            written, complete = entry.written, entry.complete
            if written:
                try:
                    async with entry.index_lock:
                        await self._hass.async_add_executor_job(
                            _scan_fragments, self._candidates(entry), index, written
                        )
                except FileNotFoundError as err:
                    # The fill failed and removed its file meanwhile.
                    raise VodCacheError(entry.error or "recording file gone") from err
                if index.error is not None:
                    raise VodCacheError(f"not playable as fragments: {index.error}")
                if ready(index):
                    return index, complete
            if complete:
                if index.init is None:
                    raise VodCacheError("not playable as fragments: no moov")
                return index, complete
            await self.async_wait(entry, offset=written)

    def _candidates(self, entry: Entry) -> tuple[Path, Path]:
        """Where the original is: the part file while filling, then its name."""
        if entry.complete:
            return entry.path, entry.part_path
        return entry.part_path, entry.path

    # ---- Disk space ----

    async def _make_room(self, path: Path, size: int, *, playback: bool) -> None:
        """Reserve ``size`` bytes for the file at ``path``, evicting if needed.

        ``playback``: the room is for a click (not a prefetch), which may
        evict leases not used lately. Raises VodCacheError (and reserves
        nothing) when the cap or the free-space rule cannot be kept.
        """
        async with self._space_lock:
            previous = self._reserved.get(path)
            self._reserved[path] = size
            made = False
            try:
                made = await self._evict_locked(playback=playback)
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
        await self._make_room(
            entry.part_path,
            needed + max(needed // 20, GROW_STEP),
            playback=_clicked(entry),
        )

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
            return await self._evict_locked(playback=False)

    async def _evict_locked(self, *, playback: bool) -> bool:
        """Delete least-recently-used recordings to make the reserved room.

        Everything on disk counts (``.part`` files too), plus what each
        reservation has still to write. A recording's original and plain copy
        go together; busy or leased recordings stay (for ``playback``, only
        leases used within ``LEASE_IDLE_S``).
        """
        files, on_disk, pending, free = await self._measure()
        # Deleting a file lowers the total and raises free space alike.
        need = max(
            on_disk + pending - self._max_bytes,
            MIN_FREE_BYTES - (free - pending),
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
        idle = LEASE_IDLE_S if playback else None
        protected = {cid for cid, e in self._entries.items() if e.busy(now, idle)}
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
        self._usage["disk"] -= freed
        self._usage["free"] += freed
        return freed >= need

    async def _measure(self) -> tuple[list[tuple[Path, int, float]], int, int, int]:
        """Return the files, bytes on disk, bytes still to come and free space."""
        files = await self._hass.async_add_executor_job(self._disk_usage)
        disk = await self._hass.async_add_executor_job(shutil.disk_usage, self._dir)
        sizes = {path: size for path, size, _mtime in files}
        pending = sum(
            max(size - sizes.get(path, 0), 0) for path, size in self._reserved.items()
        )
        on_disk = sum(sizes.values())
        self._usage = {"disk": on_disk, "reserved": pending, "free": disk.free}
        return files, on_disk, pending, disk.free

    async def async_stats(self) -> dict[str, Any]:
        """Return cache statistics with the disk use measured now."""
        await self._measure()
        out = {
            **self.stats(),
            "min_free_bytes": MIN_FREE_BYTES,
            "rewriting": sum(1 for e in self._entries.values() if e.flattening),
        }
        if self._baichuan is not None:
            out["baichuan"] = self._baichuan.stats()
        return out

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


def _clicked(entry: Entry) -> bool:
    """Return True for a fill someone waits for (not a prefetch)."""
    return entry.priority <= Priority.PLAYBACK


def _flat_extra(entry: Entry) -> int:
    return int(entry.written * FLAT_MARGIN)


def _on_disk(path: Path) -> tuple[int, bool, bool] | None:
    """Return what a previous run left: the original's size, index, plain copy."""
    if not path.exists():
        return None
    flat = path.with_name(path.stem + FLAT_SUFFIX).exists()
    return path.stat().st_size, has_index(str(path)), flat


def _last_sync(index: FragmentIndex) -> int:
    """Return the last fragment that starts with a sync sample."""
    last = len(index.fragments) - 1
    while last > 0 and not index.fragments[last].sync:
        last -= 1
    return last


def _open_original(candidates: tuple[Path, Path]) -> BinaryIO:
    try:
        return candidates[0].open("rb")
    except FileNotFoundError:
        # Renamed between the check and the open.
        return candidates[1].open("rb")


def _scan_fragments(
    candidates: tuple[Path, Path], index: FragmentIndex, available: int
) -> None:
    with _open_original(candidates) as file:
        index.scan(file, available)


def _read_fragments(
    candidates: tuple[Path, Path], index: FragmentIndex, numbers: list[int]
) -> bytes:
    with _open_original(candidates) as file:
        return b"".join(index.read_fragment(file, i) for i in numbers)


def _cache_id_of(path: Path) -> str:
    name = path.name.removesuffix(PART_SUFFIX)
    if name.endswith(CUT_SUFFIX):
        return name.removesuffix(CUT_SUFFIX).split(".", 1)[0]
    return name.removesuffix(FLAT_SUFFIX).removesuffix(SUFFIX)


def _covers(cut: Cut, at_ms: float) -> bool:
    """Return whether a cut serves a start at ``at_ms`` (or soon will)."""
    start = cut.start_ms if cut.start_ms is not None else cut.asked_ms
    if at_ms < start:
        return False
    reached = cut.end_ms if cut.end_ms is not None else cut.asked_ms
    if cut.complete:
        return at_ms < reached
    return cut.running and at_ms <= reached + CUT_REACH_MS


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

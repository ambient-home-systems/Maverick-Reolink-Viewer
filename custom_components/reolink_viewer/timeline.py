"""Recording timeline: days with recordings, and one day's recordings and events.

A day search takes 1 to 5 s per channel (hardware-matrix.md), so results are
cached:

- past days permanently, in an HA ``Store`` per camera (the most recent
  ``MAX_STORED_DAYS`` days per stream);
- today in memory for ``TODAY_TTL`` seconds, then refreshed incrementally:
  only the time since the last search is searched again, from a little before
  it so a recording that was still being written is picked up whole;
- months (calendar dots): past months permanently, the current one for
  ``MONTH_TTL`` seconds.

Every device request is a scheduler job (``PLAYBACK`` priority for what the
user waits on, ``PREFETCH`` for warming), de-duplicated while in flight. All
times sent to the browser are UTC epoch milliseconds (``timeconv``).
"""

import asyncio
from calendar import monthrange
from collections import OrderedDict
from collections.abc import Awaitable, Callable
from dataclasses import asdict, dataclass, field
from datetime import date, datetime, timedelta
import logging
import time
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from . import bridge
from .devices import PlaybackSource
from .scheduler import Priority, Scheduler
from .timeconv import (
    DayConverter,
    Recording,
    epoch_ms,
    local_day_bounds,
    local_now,
    name_stamp,
    utc_candidates,
)

_LOGGER = logging.getLogger(__name__)

STORAGE_VERSION = 1
STORAGE_KEY = "reolink_viewer.timeline.{key}"
# Stored days of an older format are searched again (months are kept).
# 2: the NVR's per-type alarm records for one moment are merged into one event.
DAYS_FORMAT = 2
# Past days fetched in the background when the panel opens.
WARM_PAST_DAYS = 7
SAVE_DELAY = 10.0
MAX_STORED_DAYS = 120
MAX_MEMORY_DAYS = 400
TODAY_TTL = 60.0
MONTH_TTL = 600.0
# Re-search this much before the last search, for recordings still being written.
REFRESH_OVERLAP = timedelta(minutes=10)
# A day is final once searched this long after it ended.
DAY_SETTLE = timedelta(minutes=10)
SEARCH_TIMEOUT = 60.0
STREAMS = ("sub", "main")


class TimelineError(Exception):
    """A timeline search failed."""


@dataclass(slots=True)
class Segment:
    """One recording file, in UTC epoch milliseconds."""

    start: int
    end: int
    name: str
    size: int | None
    triggers: list[str]
    ambiguous: bool = False

    def public(self) -> dict[str, Any]:
        """Return what the browser gets (the file name stays on the server)."""
        return {
            "id": str(self.start),
            "start": self.start,
            "end": self.end,
            "triggers": self.triggers,
            "ambiguous": self.ambiguous,
        }


@dataclass(slots=True)
class Event:
    """One detection, in UTC epoch milliseconds."""

    start: int
    end: int
    types: list[str]
    segment: int | None
    ambiguous: bool = False

    def public(self) -> dict[str, Any]:
        """Return what the browser gets."""
        return {
            "start": self.start,
            "end": self.end,
            "types": self.types,
            "segment": str(self.segment) if self.segment is not None else None,
            "ambiguous": self.ambiguous,
        }


@dataclass(slots=True)
class Day:
    """One camera-local day of one stream."""

    date: str
    start: int
    end: int
    segments: list[Segment] = field(default_factory=list)
    events: list[Event] = field(default_factory=list)
    complete: bool = False
    searched_until: str | None = None  # wall clock, ISO
    fetched_at: float = 0.0
    events_error: str | None = None
    hint_source: str | None = None

    def to_dict(self) -> dict[str, Any]:
        """Serialize for the Store."""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Day:
        """Deserialize from the Store."""
        return cls(
            date=data["date"],
            start=data["start"],
            end=data["end"],
            segments=[Segment(**s) for s in data.get("segments", [])],
            events=[Event(**e) for e in data.get("events", [])],
            complete=data.get("complete", False),
            searched_until=data.get("searched_until"),
            fetched_at=data.get("fetched_at", 0.0),
            events_error=data.get("events_error"),
            hint_source=data.get("hint_source"),
        )

    def public(self, timing: dict[str, Any]) -> dict[str, Any]:
        """Return the day as sent to the browser."""
        return {
            "date": self.date,
            "start": self.start,
            "end": self.end,
            "segments": [s.public() for s in self.segments],
            "events": [e.public() for e in self.events],
            "complete": self.complete,
            "events_error": self.events_error,
            "hint_source": self.hint_source,
            "timing": timing,
        }

    def segment(self, segment_id: str) -> Segment | None:
        """Find a segment by its public id."""
        return next((s for s in self.segments if str(s.start) == segment_id), None)


def convert_search(
    search: bridge.DaySearch, tz: Any
) -> tuple[list[Segment], list[Event], str | None]:
    """Turn one search's wall-clock recordings and events into UTC."""
    recordings = [
        Recording(
            key=f.start_id,
            start=f.start,
            end=f.end,
            hints={"playback": f.playback, "name": name_stamp(f.name)},
        )
        for f in search.files
    ]
    conv = DayConverter(tz, recordings)
    segments: dict[int, Segment] = {}
    by_file: dict[str, int] = {}
    for file, rec in zip(search.files, recordings, strict=True):
        start, end = conv.recording(rec)
        segments[start.ms] = Segment(
            start=start.ms,
            end=end.ms,
            name=file.name,
            size=file.size,
            triggers=list(file.triggers),
            ambiguous=start.ambiguous or end.ambiguous,
        )
        by_file[file.start_id] = start.ms
    events = []
    for ev in search.events:
        start, end = conv.event(ev.start, ev.end, ev.file_id)
        events.append(
            Event(
                start=start.ms,
                end=end.ms,
                types=list(ev.types),
                segment=by_file.get(ev.file_id),
                ambiguous=start.ambiguous or end.ambiguous,
            )
        )
    ordered = sorted(segments.values(), key=lambda s: s.start)
    events.sort(key=lambda e: (e.start, e.end))
    return ordered, events, conv.hint_source


def merge_window(
    day: Day,
    segments: list[Segment],
    events: list[Event],
    window_start: int,
    *,
    keep_events: bool = False,
) -> None:
    """Replace what a refresh window covers with its new results.

    ``keep_events``: the window's event search failed, so the events found
    before are kept as they are.
    """
    kept = [s for s in day.segments if s.end < window_start]
    by_start = {s.start: s for s in kept}
    for seg in segments:
        by_start[seg.start] = seg
    day.segments = sorted(by_start.values(), key=lambda s: s.start)
    if keep_events:
        return
    old_events = [e for e in day.events if e.start < window_start]
    seen = {(e.start, e.end, tuple(e.types)) for e in old_events}
    new_events = [e for e in events if (e.start, e.end, tuple(e.types)) not in seen]
    day.events = sorted([*old_events, *new_events], key=lambda e: (e.start, e.end))


@dataclass(slots=True)
class WarmStatus:
    """Progress of one camera's background fetch of past days."""

    started: float = field(default_factory=time.monotonic)
    planned: list[str] = field(default_factory=list)
    done: list[str] = field(default_factory=list)
    failed: dict[str, str] = field(default_factory=dict)
    searching: str | None = None
    note: str | None = None
    finished: bool = False

    def describe(self, iso: str) -> str:
        """Describe what the fetch did for one day (playback check report)."""
        if iso in self.done:
            state = "fetched"
        elif iso == self.searching:
            state = "being fetched"
        elif iso in self.failed:
            state = f"failed ({self.failed[iso]})"
        elif iso in self.planned:
            state = "not reached yet"
        else:
            state = "not planned"
        parts = [
            f"{state}; started {round(time.monotonic() - self.started)} s ago",
            f"{len(self.done)} of {len(self.planned)} days fetched",
        ]
        if self.note:
            parts.append(self.note)
        if self.finished:
            parts.append("finished")
        return ", ".join(parts)


class TimelineService:
    """Searches and caches recording timelines."""

    def __init__(self, hass: HomeAssistant, scheduler: Scheduler) -> None:
        """Initialize the service."""
        self._hass = hass
        self._scheduler = scheduler
        self._memory: OrderedDict[tuple[str, str, str], Day] = OrderedDict()
        self._stores: dict[str, Store[dict[str, Any]]] = {}
        self._stored: dict[str, dict[str, Any]] = {}
        self._inflight: dict[tuple[Any, ...], asyncio.Future[Any]] = {}
        self._months: dict[tuple[str, int, int], tuple[float, list[int], bool]] = {}
        self._warming_past = False
        self._warm_status: dict[str, WarmStatus] = {}

    # ---- Storage ----

    async def _data(self, key: str) -> dict[str, Any]:
        if key not in self._stored:
            store: Store[dict[str, Any]] = Store(
                self._hass, STORAGE_VERSION, STORAGE_KEY.format(key=key)
            )
            self._stores[key] = store
            loaded = await store.async_load()
            data = loaded if isinstance(loaded, dict) else {}
            if data.get("format") != DAYS_FORMAT:
                for stream in STREAMS:
                    data.pop(stream, None)
                data["format"] = DAYS_FORMAT
            for name in (*STREAMS, "months"):
                data.setdefault(name, {})
            self._stored[key] = data
        return self._stored[key]

    def _save(self, key: str) -> None:
        data = self._stored[key]
        for stream in STREAMS:
            days = data[stream]
            for old in sorted(days)[:-MAX_STORED_DAYS]:
                del days[old]
        self._stores[key].async_delay_save(lambda: data, SAVE_DELAY)

    def _remember(self, mkey: tuple[str, str, str], day: Day) -> None:
        self._memory[mkey] = day
        self._memory.move_to_end(mkey)
        while len(self._memory) > MAX_MEMORY_DAYS:
            self._memory.popitem(last=False)

    # ---- Days ----

    async def _dedupe[T](
        self, key: tuple[Any, ...], factory: Callable[[], Awaitable[T]]
    ) -> T:
        if (pending := self._inflight.get(key)) is not None:
            result: T = await asyncio.shield(pending)
            return result
        future: asyncio.Future[T] = asyncio.get_running_loop().create_future()
        self._inflight[key] = future
        try:
            value = await factory()
        except BaseException as err:
            if not future.done():
                if isinstance(err, asyncio.CancelledError):
                    future.cancel()
                else:
                    future.set_exception(err)
                    future.exception()  # mark retrieved
            raise
        else:
            future.set_result(value)
            return value
        finally:
            self._inflight.pop(key, None)

    async def async_day(
        self,
        source: PlaybackSource,
        day: date,
        stream: str = "sub",
        priority: Priority = Priority.PLAYBACK,
        max_age: float = 0,
    ) -> tuple[Day, dict[str, Any]]:
        """Return one day of recordings and events, from cache when possible.

        Today is searched again after TODAY_TTL. With ``max_age``, a copy of
        today up to that many seconds old is returned at once instead (timing
        cache "stale"), for a caller that shows it and then asks again.
        """
        began = time.monotonic()
        host = bridge.async_get_host(self._hass, source.entry_id)
        tz = host.timezone()
        now_local = local_now(tz)
        iso = day.isoformat()
        mkey = (source.key, stream, iso)
        start_utc, end_utc = local_day_bounds(
            datetime.combine(day, datetime.min.time()), tz
        )
        empty = Day(iso, epoch_ms(start_utc), epoch_ms(end_utc))

        if day > now_local.date():
            return empty, {"cache": "future", "total_ms": _ms(began)}
        cached = self._memory.get(mkey)
        if cached is not None and cached.complete:
            self._memory.move_to_end(mkey)
            return cached, {"cache": "memory", "total_ms": _ms(began)}
        data = await self._data(source.key)
        if (stored := data[stream].get(iso)) is not None:
            day_data = Day.from_dict(stored)
            # A day stored by an older version despite a failed event search
            # is searched again.
            if day_data.complete and day_data.events_error is None:
                self._remember(mkey, day_data)
                return day_data, {"cache": "store", "total_ms": _ms(began)}

        is_today = day == now_local.date()
        if is_today and cached is not None:
            age = _wall_time() - cached.fetched_at
            # A copy whose event search failed is never current: it is searched
            # again at once (a caller accepting a stale copy still gets it first).
            if age < TODAY_TTL and cached.events_error is None:
                return cached, {"cache": "memory", "total_ms": _ms(began)}
            if age < max_age:
                timing = {"cache": "stale", "age_s": round(age), "total_ms": _ms(began)}
                return cached, timing

        async def fetch() -> tuple[Day, dict[str, Any]]:
            return await self._fetch_day(
                source,
                host,
                tz=tz,
                empty=empty,
                previous=cached if is_today else None,
                stream=stream,
                priority=priority,
            )

        result, timing = await self._dedupe(("day", *mkey), fetch)
        timing["total_ms"] = _ms(began)
        if not is_today and (warm := self._warm_status.get(source.key)) is not None:
            timing["warm"] = warm.describe(iso)
        return result, timing

    async def _fetch_day(
        self,
        source: PlaybackSource,
        host: bridge.ReolinkHostHandle,
        *,
        tz: Any,
        empty: Day,
        previous: Day | None,
        stream: str,
        priority: Priority,
    ) -> tuple[Day, dict[str, Any]]:
        now_local = local_now(tz)
        midnight = datetime.fromisoformat(empty.date)
        day_end_wall = midnight + timedelta(days=1) - timedelta(seconds=1)
        window_end = min(now_local, day_end_wall)
        window_start = midnight
        if previous is not None and previous.searched_until is not None:
            window_start = max(
                midnight,
                datetime.fromisoformat(previous.searched_until) - REFRESH_OVERLAP,
            )
        else:
            previous = None
        incremental = previous is not None
        searched = time.monotonic()
        started: list[float] = []

        async def job() -> bridge.DaySearch:
            started.append(time.monotonic())
            return await host.async_search_day(
                source.channel, window_start, window_end, stream
            )

        try:
            search = await self._scheduler.run(
                source.entry_id,
                job,
                priority=priority,
                key=("day", source.channel, stream, window_start, window_end),
                timeout=SEARCH_TIMEOUT,
            )
        except Exception as err:
            raise TimelineError(f"day search failed: {type(err).__name__}") from err
        search_ms = _ms(searched)
        segments, events, hint = convert_search(search, tz)
        failed = search.events_error is not None
        if previous is not None:
            day = previous
            window_ms = epoch_ms(utc_candidates(window_start, tz)[0])
            merge_window(day, segments, events, window_ms, keep_events=failed)
        else:
            day = Day(empty.date, empty.start, empty.end, segments, events)
        day.events_error = search.events_error
        day.hint_source = hint or day.hint_source
        # After a failed event search the window is searched again next time
        # (from the start of the day if nothing was searched before), and the
        # day is not final, so it is neither kept for good nor stored.
        if not failed:
            day.searched_until = window_end.isoformat()
        day.fetched_at = _wall_time()
        day.complete = now_local >= day_end_wall + DAY_SETTLE and not failed
        self._remember((source.key, stream, empty.date), day)
        if day.complete:
            data = await self._data(source.key)
            data[stream][day.date] = day.to_dict()
            self._save(source.key)
        timing = {
            "cache": "incremental" if incremental else "fresh",
            "search_ms": search_ms,
            "queue_ms": round((started[0] - searched) * 1000, 1) if started else None,
            **search.timing,
            "segments": len(day.segments),
        }
        return day, timing

    # ---- Months ----

    async def async_days(
        self,
        source: PlaybackSource,
        year: int,
        month: int,
        priority: Priority = Priority.PLAYBACK,
    ) -> tuple[list[int], dict[str, Any]]:
        """Return the days of a month that have recordings."""
        began = time.monotonic()
        host = bridge.async_get_host(self._hass, source.entry_id)
        tz = host.timezone()
        today = local_now(tz).date()
        if (year, month) > (today.year, today.month):
            return [], {"cache": "future", "total_ms": _ms(began)}
        mkey = (source.key, year, month)
        month_id = f"{year:04d}-{month:02d}"
        if (hit := self._months.get(mkey)) is not None:
            fetched, days, final = hit
            if final or _clock() - fetched < MONTH_TTL:
                return days, {"cache": "memory", "total_ms": _ms(began)}
        data = await self._data(source.key)
        if (stored := data["months"].get(month_id)) is not None:
            self._months[mkey] = (_clock(), list(stored), True)
            return list(stored), {"cache": "store", "total_ms": _ms(began)}

        last = monthrange(year, month)[1]
        start = datetime(year, month, 1)
        end = datetime(year, month, last, 23, 59, 59)

        async def fetch() -> list[int]:
            try:
                found = await self._scheduler.run(
                    source.entry_id,
                    lambda: host.async_recording_days(source.channel, start, end),
                    priority=priority,
                    key=("days", source.channel, month_id),
                    timeout=SEARCH_TIMEOUT,
                )
            except Exception as err:
                raise TimelineError(
                    f"month search failed: {type(err).__name__}"
                ) from err
            return sorted({d.day for d in found})

        searched = time.monotonic()
        days = await self._dedupe(("days", *mkey), fetch)
        final = (year, month) < (today.year, today.month)
        self._months[mkey] = (_clock(), days, final)
        if final:
            data["months"][month_id] = days
            self._save(source.key)
        return days, {
            "cache": "fresh",
            "search_ms": _ms(searched),
            "total_ms": _ms(began),
        }

    # ---- Warming and lookup ----

    async def async_warm(self, sources: list[PlaybackSource]) -> None:
        """Fetch today for each camera, then recent past days not stored yet.

        All at prefetch priority; errors are logged. Today is fetched for every
        camera at once. Past days with recordings (last WARM_PAST_DAYS) follow
        one search at a time, yesterday first for every camera: a day search
        on the NVR takes several seconds, and past days are kept for good, so
        each is searched once.
        """

        async def today(source: PlaybackSource) -> str | None:
            try:
                host = bridge.async_get_host(self._hass, source.entry_id)
                now = local_now(host.timezone()).date()
                await self.async_day(source, now, "sub", Priority.PREFETCH)
            except Exception as err:  # noqa: BLE001 - warming is best effort
                _LOGGER.debug("Warming %s failed: %s", source.name, err)
                return _error_text(err)
            return None

        today_errors = await asyncio.gather(*(today(s) for s in sources))
        if self._warming_past:
            return
        self._warming_past = True
        try:
            statuses = {s.key: WarmStatus() for s in sources}
            self._warm_status.update(statuses)
            todo: list[tuple[PlaybackSource, list[date]]] = []
            for source, error in zip(sources, today_errors, strict=True):
                status = statuses[source.key]
                if error is not None:
                    # The camera did not answer for today: past days would
                    # only wait for the same timeouts.
                    status.note = f"not started: today failed ({error})"
                    todo.append((source, []))
                else:
                    todo.append((source, await self._past_days_to_warm(source, status)))
            for n in range(WARM_PAST_DAYS):
                for source, days in todo:
                    if n < len(days):
                        await self._warm_day(source, days[n], statuses[source.key])
            # Failed days are tried once more: the NVR's searches fail now and
            # then and work when asked again.
            for source, _days in todo:
                status = statuses[source.key]
                for iso in list(status.failed):
                    await self._warm_day(source, date.fromisoformat(iso), status)
            for status in statuses.values():
                status.finished = True
        finally:
            self._warming_past = False

    async def _past_days_to_warm(
        self, source: PlaybackSource, status: WarmStatus
    ) -> list[date]:
        """Recent past days with recordings that are not stored, newest first.

        If the month search fails, every recent day is tried.
        """
        try:
            host = bridge.async_get_host(self._hass, source.entry_id)
            now = local_now(host.timezone()).date()
            stored = (await self._data(source.key))["sub"]
        except Exception as err:  # noqa: BLE001 - warming is best effort
            _LOGGER.debug("Warming %s failed: %s", source.name, err)
            status.note = f"not started: {type(err).__name__}"
            return []
        wanted = [now - timedelta(days=n) for n in range(1, WARM_PAST_DAYS + 1)]
        days = [d for d in wanted if d.isoformat() not in stored]
        try:
            recorded: set[date] = set()
            for year, month in sorted({(d.year, d.month) for d in wanted}):
                found, _ = await self.async_days(source, year, month, Priority.PREFETCH)
                recorded.update(date(year, month, d) for d in found)
        except Exception as err:  # noqa: BLE001 - warming is best effort
            _LOGGER.debug("Month search for %s failed: %s", source.name, err)
            status.note = f"{_error_text(err)}, every day tried"
        else:
            days = [d for d in days if d in recorded]
        status.planned = [d.isoformat() for d in days]
        return days

    async def _warm_day(
        self, source: PlaybackSource, day: date, status: WarmStatus
    ) -> None:
        iso = day.isoformat()
        status.searching = iso
        try:
            result, _ = await self.async_day(source, day, "sub", Priority.PREFETCH)
        except Exception as err:  # noqa: BLE001 - warming is best effort
            _LOGGER.debug("Warming %s %s failed: %s", source.name, day, err)
            status.failed[iso] = _error_text(err)
        else:
            if result.events_error is not None:
                status.failed[iso] = f"event search: {result.events_error}"
            else:
                status.failed.pop(iso, None)
                status.done.append(iso)
        finally:
            status.searching = None

    async def async_segment(
        self, source: PlaybackSource, day: date, stream: str, segment_id: str
    ) -> Segment:
        """Find a recording to play: the sub segment, or the main one matching it.

        The copy of the day in memory is used as it is (a refresh before the
        play URL cost 3.9 s on the hardware check); the day is searched again
        only if the recording is not in it (it may have started since).
        """
        sub = await self._find(source, day, "sub", lambda d: d.segment(segment_id))
        if sub is None:
            raise TimelineError("unknown segment")
        if stream == "sub":
            return sub
        best = await self._find(
            source, day, "main", lambda d: match_segment(d.segments, sub)
        )
        if best is None:
            raise TimelineError("no main-stream recording for this segment")
        return best

    async def _find(
        self,
        source: PlaybackSource,
        day: date,
        stream: str,
        pick: Callable[[Day], Segment | None],
    ) -> Segment | None:
        cached = self._memory.get((source.key, stream, day.isoformat()))
        if cached is not None and (found := pick(cached)) is not None:
            return found
        fresh, _ = await self.async_day(source, day, stream)
        return pick(fresh)

    def clear(self) -> None:
        """Drop the in-memory caches (the Store stays)."""
        self._memory.clear()
        self._months.clear()


def match_segment(candidates: list[Segment], target: Segment) -> Segment | None:
    """Pick the candidate overlapping ``target`` most (main vs sub differ by seconds)."""
    best: Segment | None = None
    best_score: tuple[int, int] = (0, 0)
    for seg in candidates:
        overlap = min(seg.end, target.end) - max(seg.start, target.start)
        if overlap <= 0:
            continue
        score = (overlap, -abs(seg.start - target.start))
        if best is None or score > best_score:
            best, best_score = seg, score
    return best


def _error_text(err: BaseException) -> str:
    text = str(err)
    if isinstance(err, TimelineError):
        return text
    return f"{type(err).__name__}: {text}" if text else type(err).__name__


def _ms(start: float) -> float:
    return round((time.monotonic() - start) * 1000, 1)


def _wall_time() -> float:
    """Return epoch seconds (a hook for tests)."""
    return time.time()


def _clock() -> float:
    """Return a monotonic clock for cache ages (a hook for tests)."""
    return time.monotonic()

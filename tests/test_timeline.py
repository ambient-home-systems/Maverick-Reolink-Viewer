"""Tests for the recording timeline: conversion, caching and refreshes."""

import asyncio
from collections.abc import Generator
from datetime import UTC, date, datetime, timedelta
from typing import Any
from unittest.mock import patch
from zoneinfo import ZoneInfo

import pytest
from pytest_homeassistant_custom_component.common import async_fire_time_changed

from custom_components.reolink_viewer import bridge, timeline
from custom_components.reolink_viewer.bridge import DaySearch, VodEvent, VodFile
from custom_components.reolink_viewer.devices import PlaybackSource
from custom_components.reolink_viewer.scheduler import Priority, Scheduler
from custom_components.reolink_viewer.timeconv import epoch_ms
from custom_components.reolink_viewer.timeline import (
    Day,
    Event,
    Segment,
    TimelineError,
    TimelineService,
    convert_search,
    match_segment,
    merge_window,
)
from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util

TZ = ZoneInfo("America/New_York")
SOURCE = PlaybackSource("cam1", "Garage", "entry1", 16)


def wall(*args: int) -> datetime:
    return datetime(*args)  # type: ignore[arg-type]


def vf(start: datetime, minutes: float, stream: str = "sub", **kw: Any) -> VodFile:
    return VodFile(
        start=start,
        end=start + timedelta(minutes=minutes),
        name=kw.pop("name", f"0-16-1-{start:%Y%m%d%H%M%S}-00000"),
        stream=stream,
        size=kw.pop("size", 1_000_000),
        triggers=kw.pop("triggers", ("MOTION",)),
        playback=kw.pop("playback", None),
    )


class FakeHost:
    """A host whose searches return files and events inside the window."""

    def __init__(self) -> None:
        self.files: dict[str, list[VodFile]] = {"sub": [], "main": []}
        self.events: list[VodEvent] = []
        self.searches: list[tuple[datetime, datetime, str]] = []
        self.day_searches = 0
        self.fail = False
        self.events_fail = False
        self.gate: asyncio.Event | None = None
        self.days: list[date] = []

    def timezone(self) -> ZoneInfo:
        return TZ

    async def async_search_day(
        self, channel: int, start: datetime, end: datetime, stream: str
    ) -> DaySearch:
        self.searches.append((start, end, stream))
        if self.gate is not None:
            await self.gate.wait()
        if self.fail:
            raise RuntimeError("device busy")
        files = [f for f in self.files[stream] if f.end >= start and f.start <= end]
        if self.events_fail:
            return DaySearch(files, [], "ApiError")
        events = [e for e in self.events if e.end >= start and e.start <= end]
        return DaySearch(files, events)

    async def async_recording_days(
        self, channel: int, start: datetime, end: datetime
    ) -> list[date]:
        self.day_searches += 1
        if self.fail:
            raise RuntimeError("device busy")
        return [d for d in self.days if start.date() <= d <= end.date()]


class Clock:
    """Controls the device's wall clock and time.time()."""

    def __init__(self, now: datetime) -> None:
        self.now = now
        self.epoch = 1_000_000.0

    def local_now(self, tz: Any, now_utc: Any = None) -> datetime:
        return self.now

    def time(self) -> float:
        return self.epoch

    def advance(self, seconds: float) -> None:
        self.now += timedelta(seconds=seconds)
        self.epoch += seconds


@pytest.fixture
def host() -> FakeHost:
    return FakeHost()


@pytest.fixture
def clock() -> Generator[Clock]:
    clock = Clock(wall(2026, 10, 17, 13, 0))
    with (
        patch.object(timeline, "local_now", clock.local_now),
        patch.object(timeline, "_wall_time", clock.time),
    ):
        yield clock


@pytest.fixture
def service(
    hass: HomeAssistant, host: FakeHost, clock: Clock
) -> Generator[TimelineService]:
    with patch.object(bridge, "async_get_host", return_value=host):
        yield TimelineService(hass, Scheduler(default_limit=2))


async def test_past_day_cached_in_memory_and_store(
    hass: HomeAssistant,
    hass_storage: dict[str, Any],
    host: FakeHost,
    service: TimelineService,
) -> None:
    """A past day is searched once, then served from memory and the Store."""
    host.files["sub"] = [
        vf(wall(2026, 10, 16, 9, 0), 2),
        vf(wall(2026, 10, 16, 23, 59), 2),
    ]
    host.events = [
        VodEvent(
            wall(2026, 10, 16, 9, 0, 30),
            wall(2026, 10, 16, 9, 1),
            ("PERSON",),
            "20261016090000",
        )
    ]
    day, timing = await service.async_day(SOURCE, date(2026, 10, 16))
    assert timing["cache"] == "fresh"
    assert day.complete
    assert len(day.segments) == 2
    first = day.segments[0]
    assert first.start == epoch_ms(datetime(2026, 10, 16, 13, 0, tzinfo=UTC))
    assert first.end - first.start == 120_000
    (event,) = day.events
    assert event.segment == first.start
    assert event.types == ["PERSON"]
    assert day.start == epoch_ms(datetime(2026, 10, 16, 4, 0, tzinfo=UTC))
    assert day.end - day.start == 24 * 3600 * 1000
    public = day.public({"cache": "fresh"})
    assert "name" not in public["segments"][0]
    assert public["segments"][0]["id"] == str(first.start)
    assert public["events"][0]["segment"] == str(first.start)

    _, timing = await service.async_day(SOURCE, date(2026, 10, 16))
    assert timing["cache"] == "memory"
    assert len(host.searches) == 1

    async_fire_time_changed(hass, dt_util.utcnow() + timedelta(seconds=11))
    await hass.async_block_till_done()
    stored = hass_storage[f"reolink_viewer.timeline.{SOURCE.key}"]["data"]
    assert "2026-10-16" in stored["sub"]
    fresh = TimelineService(hass, Scheduler(default_limit=2))
    again, timing = await fresh.async_day(SOURCE, date(2026, 10, 16))
    assert timing["cache"] == "store"
    assert again.segments == day.segments
    assert len(host.searches) == 1

    # Days stored in an older format are searched again; months are kept.
    stored["format"] = 1
    stored["months"]["2026-09"] = [3]
    older = TimelineService(hass, Scheduler(default_limit=2))
    _, timing = await older.async_day(SOURCE, date(2026, 10, 16))
    assert timing["cache"] == "fresh"
    assert len(host.searches) == 2
    days, timing = await older.async_days(SOURCE, 2026, 9)
    assert (days, timing["cache"]) == ([3], "store")


async def test_today_ttl_and_incremental_refresh(
    host: FakeHost, service: TimelineService, clock: Clock
) -> None:
    """Today: cached for 60 s, then only the recent window is searched again."""
    host.files["sub"] = [
        vf(wall(2026, 10, 17, 9, 0), 2),
        vf(wall(2026, 10, 17, 12, 55), 1),
    ]
    day, timing = await service.async_day(SOURCE, date(2026, 10, 17))
    assert timing["cache"] == "fresh"
    assert not day.complete
    assert host.searches[-1][:2] == (wall(2026, 10, 17), wall(2026, 10, 17, 13, 0))

    clock.advance(30)
    _, timing = await service.async_day(SOURCE, date(2026, 10, 17))
    assert timing["cache"] == "memory"
    assert len(host.searches) == 1

    # The recording at 12:55 grew; a new one started.
    host.files["sub"] = [
        vf(wall(2026, 10, 17, 9, 0), 2),
        vf(wall(2026, 10, 17, 12, 55), 4),
        vf(wall(2026, 10, 17, 13, 0, 20), 0.5),
    ]
    clock.advance(40)
    # A caller that accepts an older copy gets it at once, without a search.
    stale, timing = await service.async_day(SOURCE, date(2026, 10, 17), max_age=900)
    assert (timing["cache"], timing["age_s"]) == ("stale", 70)
    assert len(stale.segments) == 2
    assert len(host.searches) == 1
    day, timing = await service.async_day(SOURCE, date(2026, 10, 17))
    assert timing["cache"] == "incremental"
    assert timing["queue_ms"] >= 0
    start, end, _stream = host.searches[-1]
    assert start == wall(2026, 10, 17, 12, 50)
    assert end == clock.now
    assert len(day.segments) == 3
    assert day.segments[1].end - day.segments[1].start == 4 * 60_000

    # After midnight + settle, yesterday is searched in full once and kept.
    clock.now = wall(2026, 10, 18, 0, 15)
    day, timing = await service.async_day(SOURCE, date(2026, 10, 17))
    assert timing["cache"] == "fresh"
    assert day.complete
    assert host.searches[-1][:2] == (wall(2026, 10, 17), wall(2026, 10, 17, 23, 59, 59))


async def test_future_day_and_errors(host: FakeHost, service: TimelineService) -> None:
    """Days after today are empty; failed searches raise TimelineError."""
    day, timing = await service.async_day(SOURCE, date(2026, 10, 20))
    assert timing["cache"] == "future"
    assert day.segments == []
    assert host.searches == []
    host.fail = True
    with pytest.raises(TimelineError, match="day search failed: RuntimeError"):
        await service.async_day(SOURCE, date(2026, 10, 15))
    with pytest.raises(TimelineError, match="month search failed"):
        await service.async_days(SOURCE, 2026, 9)


async def test_concurrent_requests_share_one_search(
    host: FakeHost, service: TimelineService
) -> None:
    """Two panels asking for the same day cause one device search."""
    host.files["sub"] = [vf(wall(2026, 10, 15, 9, 0), 2)]
    host.gate = asyncio.Event()
    first = asyncio.create_task(service.async_day(SOURCE, date(2026, 10, 15)))
    second = asyncio.create_task(service.async_day(SOURCE, date(2026, 10, 15)))
    await asyncio.sleep(0.01)
    host.gate.set()
    (a, _), (b, _) = await asyncio.gather(first, second)
    assert a is b
    assert len(host.searches) == 1

    # A failure reaches every waiter.
    host.fail = True
    host.gate = asyncio.Event()
    one = asyncio.create_task(service.async_day(SOURCE, date(2026, 10, 14)))
    two = asyncio.create_task(service.async_day(SOURCE, date(2026, 10, 14)))
    await asyncio.sleep(0.01)
    host.gate.set()
    results = await asyncio.gather(one, two, return_exceptions=True)
    assert all(isinstance(r, TimelineError) for r in results)


async def test_months(
    hass: HomeAssistant, host: FakeHost, service: TimelineService, clock: Clock
) -> None:
    """Past months are kept; the current month is refreshed after its TTL."""
    host.days = [
        date(2026, 9, 2),
        date(2026, 9, 30),
        date(2026, 10, 1),
        date(2026, 10, 17),
    ]
    days, timing = await service.async_days(SOURCE, 2026, 9)
    assert (days, timing["cache"]) == ([2, 30], "fresh")
    days, timing = await service.async_days(SOURCE, 2026, 9)
    assert timing["cache"] == "memory"
    async_fire_time_changed(hass, dt_util.utcnow() + timedelta(seconds=11))
    await hass.async_block_till_done()
    fresh = TimelineService(hass, Scheduler(default_limit=2))
    days, timing = await fresh.async_days(SOURCE, 2026, 9)
    assert (days, timing["cache"]) == ([2, 30], "store")

    days, _ = await service.async_days(SOURCE, 2026, 10)
    assert days == [1, 17]
    with patch.object(timeline, "_clock", return_value=1e12):
        await service.async_days(SOURCE, 2026, 10)
    assert host.day_searches == 3  # September, October, October refreshed
    days, timing = await service.async_days(SOURCE, 2026, 11)
    assert (days, timing["cache"]) == ([], "future")


async def test_warm_uses_prefetch_priority(
    host: FakeHost, service: TimelineService
) -> None:
    """Warming searches at prefetch priority; errors pass."""
    priorities: list[Priority] = []
    real_run = Scheduler.run

    async def spy(self: Scheduler, host_key: str, factory: Any, **kwargs: Any) -> Any:
        priorities.append(kwargs["priority"])
        return await real_run(self, host_key, factory, **kwargs)

    with patch.object(Scheduler, "run", spy):
        await service.async_warm([SOURCE])
        host.fail = True
        await service.async_warm([PlaybackSource("cam2", "Yard", "entry1", 5)])
    # Today, then October's recording days, for each camera.
    assert priorities == [Priority.PREFETCH] * 4


async def test_warm_fetches_recent_past_days_once(
    hass: HomeAssistant, host: FakeHost, service: TimelineService
) -> None:
    """Past days with recordings are searched once, newest first, then kept."""
    host.days = [date(2026, 10, 16), date(2026, 10, 12), date(2026, 10, 2)]
    host.files["sub"] = [
        vf(wall(2026, 10, 16, 9, 0), 2),
        vf(wall(2026, 10, 12, 9, 0), 2),
    ]
    await service.async_warm([SOURCE])
    searched = [start.date() for start, _end, _stream in host.searches]
    # Today, then the two recorded days of the last week (not 2 October).
    assert searched == [date(2026, 10, 17), date(2026, 10, 16), date(2026, 10, 12)]
    _, timing = await service.async_day(SOURCE, date(2026, 10, 12))
    assert timing["cache"] == "memory"
    # Stored days are not searched again.
    await service.async_warm([SOURCE])
    assert len(host.searches) == 3  # today is still within its TTL

    # Only one past-day warm runs at a time.
    service._warming_past = True
    service.clear()
    await service.async_warm([PlaybackSource("cam2", "Yard", "entry1", 5)])
    assert host.day_searches == 1  # no month search for the second camera


async def test_segment_lookup(host: FakeHost, service: TimelineService) -> None:
    """Sub segments by id; main recordings matched by overlap."""
    host.files["sub"] = [
        vf(wall(2026, 10, 16, 9, 0), 2),
        vf(wall(2026, 10, 15, 9, 0), 2),
    ]
    host.files["main"] = [
        vf(wall(2026, 10, 16, 8, 50), 9.5, "main", name="early"),
        vf(wall(2026, 10, 16, 8, 59, 58), 2, "main", name="match"),
    ]
    day, _ = await service.async_day(SOURCE, date(2026, 10, 16))
    seg_id = day.segments[0].public()["id"]
    sub = await service.async_segment(SOURCE, date(2026, 10, 16), "sub", seg_id)
    assert sub.name.startswith("0-16-1-")
    main = await service.async_segment(SOURCE, date(2026, 10, 16), "main", seg_id)
    assert main.name == "match"
    with pytest.raises(TimelineError, match="unknown segment"):
        await service.async_segment(SOURCE, date(2026, 10, 16), "sub", "1")
    host.files["main"] = []
    service.clear()
    day15, _ = await service.async_day(SOURCE, date(2026, 10, 15))
    with pytest.raises(TimelineError, match="no main-stream"):
        await service.async_segment(
            SOURCE, date(2026, 10, 15), "main", day15.segments[0].public()["id"]
        )


def test_convert_search_and_merge() -> None:
    """Events link to their recording; refresh windows replace what they cover."""
    search = DaySearch(
        [vf(wall(2026, 10, 16, 9, 0), 2, triggers=("PERSON",))],
        [
            VodEvent(
                wall(2026, 10, 16, 9, 0, 10),
                wall(2026, 10, 16, 9, 0, 40),
                ("PERSON",),
                "20261016090000",
            ),
            VodEvent(
                wall(2026, 10, 16, 10, 0),
                wall(2026, 10, 16, 10, 1),
                ("ANIMAL",),
                "nope",
            ),
        ],
    )
    segments, events, hint = convert_search(search, TZ)
    assert hint is None
    assert events[0].segment == segments[0].start
    assert events[1].segment is None

    day = Day("2026-10-16", 0, 10_000)
    day.segments = [Segment(100, 200, "a", 1, []), Segment(900, 1500, "b", 1, [])]
    day.events = [Event(150, 160, ["MOTION"], 100), Event(950, 960, ["PERSON"], 900)]
    merge_window(
        day,
        [Segment(900, 2000, "b", 2, []), Segment(2100, 2200, "c", 1, [])],
        [Event(950, 960, ["PERSON"], 900), Event(2150, 2160, ["ANIMAL"], 2100)],
        window_start=1000,
    )
    assert [(s.name, s.end) for s in day.segments] == [
        ("a", 200),
        ("b", 2000),
        ("c", 2200),
    ]
    assert [e.start for e in day.events] == [150, 950, 2150]
    assert Day.from_dict(day.to_dict()) == day


def test_match_segment() -> None:
    """The longest overlap wins, then the nearest start; no overlap, no match."""
    target = Segment(1000, 2000, "s", None, [])
    a = Segment(0, 1100, "a", None, [])
    b = Segment(990, 2010, "b", None, [])
    c = Segment(1010, 1990, "c", None, [])
    assert match_segment([a, b, c], target) is b
    assert match_segment([Segment(3000, 4000, "x", None, [])], target) is None


async def test_failed_event_search_keeps_events_and_searches_again(
    hass: HomeAssistant,
    hass_storage: dict[str, Any],
    host: FakeHost,
    service: TimelineService,
    clock: Clock,
) -> None:
    """Events found before survive a failed event search, which is retried."""
    host.files["sub"] = [vf(wall(2026, 10, 17, 12, 55), 1)]
    host.events = [
        VodEvent(
            wall(2026, 10, 17, 12, 55, 10),
            wall(2026, 10, 17, 12, 55, 30),
            ("PERSON",),
            "20261017125500",
        )
    ]
    day, _ = await service.async_day(SOURCE, date(2026, 10, 17))
    assert len(day.events) == 1

    # The refresh's event search fails: the event stays.
    host.events_fail = True
    clock.advance(70)
    day, timing = await service.async_day(SOURCE, date(2026, 10, 17))
    assert timing["cache"] == "incremental"
    assert len(day.events) == 1
    assert day.events_error == "ApiError"
    # Within the TTL, that copy is not served as it is, even to a stale-OK caller.
    _, timing = await service.async_day(SOURCE, date(2026, 10, 17), max_age=900)
    assert timing["cache"] == "incremental"
    first_window = host.searches[-1][0]
    # The next refresh searches the same window again.
    host.events_fail = False
    clock.advance(70)
    day, _ = await service.async_day(SOURCE, date(2026, 10, 17))
    assert host.searches[-1][0] == first_window
    assert day.events_error is None

    # A past day whose event search failed is not kept: it is searched again.
    host.events_fail = True
    past, _ = await service.async_day(SOURCE, date(2026, 10, 15))
    assert not past.complete
    searches = len(host.searches)
    await service.async_day(SOURCE, date(2026, 10, 15))
    assert len(host.searches) == searches + 1
    async_fire_time_changed(hass, dt_util.utcnow() + timedelta(seconds=11))
    await hass.async_block_till_done()
    stored = hass_storage.get(f"reolink_viewer.timeline.{SOURCE.key}", {})
    assert "2026-10-15" not in stored.get("data", {}).get("sub", {})

    # A day stored with a failed event search (older versions) is searched again.
    host.events_fail = False
    data = await service._data(SOURCE.key)
    data["sub"]["2026-10-14"] = Day(
        "2026-10-14", 0, 1, complete=True, events_error="ApiError"
    ).to_dict()
    _, timing = await service.async_day(SOURCE, date(2026, 10, 14))
    assert timing["cache"] == "fresh"


async def test_segment_lookup_uses_a_recent_copy_of_today(
    host: FakeHost, service: TimelineService, clock: Clock
) -> None:
    """Playing a recording does not wait for today to be searched again."""
    host.files["sub"] = [vf(wall(2026, 10, 17, 12, 0), 2)]
    day, _ = await service.async_day(SOURCE, date(2026, 10, 17))
    seg_id = day.segments[0].public()["id"]
    clock.advance(300)  # well past today's 60 s TTL
    sub = await service.async_segment(SOURCE, date(2026, 10, 17), "sub", seg_id)
    assert sub.start == day.segments[0].start
    assert len(host.searches) == 1
    # A failed event search does not hold the play URL back either.
    host.events_fail = True
    clock.advance(70)
    await service.async_day(SOURCE, date(2026, 10, 17))
    searches = len(host.searches)
    await service.async_segment(SOURCE, date(2026, 10, 17), "sub", seg_id)
    assert len(host.searches) == searches
    host.events_fail = False
    # A recording newer than the copy: today is searched again to find it.
    host.files["sub"].append(vf(wall(2026, 10, 17, 13, 0), 1))
    newer = str(epoch_ms(datetime(2026, 10, 17, 17, 0, tzinfo=UTC)))
    found = await service.async_segment(SOURCE, date(2026, 10, 17), "sub", newer)
    assert str(found.start) == newer
    assert len(host.searches) == searches + 1

"""Tests for camera-local time to UTC conversion, across DST transitions."""

from datetime import UTC, datetime, timedelta, timezone, tzinfo
from zoneinfo import ZoneInfo

import pytest
from reolink_aio.typings import Reolink_timezone

from custom_components.reolink_viewer.timeconv import (
    Converted,
    DayConverter,
    Recording,
    epoch_ms,
    from_ms,
    local_day_bounds,
    local_now,
    name_stamp,
    to_utc,
    utc_candidates,
)

NEW_YORK = ZoneInfo("America/New_York")
# A device set to UTC-5 with DST, as reolink-aio builds it from GetTime.
REOLINK_EASTERN = Reolink_timezone(
    {
        "Time": {"timeZone": 18000},
        "Dst": {
            "enable": 1,
            "offset": 1,
            "startMon": 3,
            "startWeek": 2,
            "startWeekday": 0,
            "startHour": 2,
            "startMin": 0,
            "startSec": 0,
            "endMon": 11,
            "endWeek": 1,
            "endWeekday": 0,
            "endHour": 2,
            "endMin": 0,
            "endSec": 0,
        },
    }
)
ZONES = pytest.mark.parametrize(
    "tz", [NEW_YORK, REOLINK_EASTERN], ids=["zoneinfo", "reolink"]
)


def _transitions(tz: tzinfo, year: int = 2026) -> tuple[datetime, datetime]:
    """Find the first local minutes with the new offset (spring, fall)."""
    found: list[datetime] = []
    t = datetime(year, 1, 1)
    prev = tz.utcoffset(t)
    while t.year == year:
        nxt = t + timedelta(hours=1)
        if tz.utcoffset(nxt) != prev:
            m = t
            while tz.utcoffset(m) == prev:
                m += timedelta(minutes=1)
            found.append(m)
            prev = tz.utcoffset(nxt)
        t = nxt
    assert len(found) == 2, found
    return found[0], found[1]


@ZONES
def test_ordinary_times(tz: tzinfo) -> None:
    """Outside transitions there is one UTC instant, in summer and winter."""
    summer = datetime(2026, 7, 4, 12, 0)
    winter = datetime(2026, 1, 15, 12, 0)
    assert utc_candidates(summer, tz) == [datetime(2026, 7, 4, 16, 0, tzinfo=UTC)]
    assert utc_candidates(winter, tz) == [datetime(2026, 1, 15, 17, 0, tzinfo=UTC)]
    # An aware time with the device zone attached is read as wall time.
    assert utc_candidates(summer.replace(tzinfo=tz), tz) == utc_candidates(summer, tz)


@ZONES
def test_fall_back_hour_is_ambiguous(tz: tzinfo) -> None:
    """The hour before clocks fall back has two meanings, one hour apart."""
    _spring, fall = _transitions(tz)
    inside = fall - timedelta(minutes=30)
    first, second = utc_candidates(inside, tz)
    assert second - first == timedelta(hours=1)
    assert first == (inside + timedelta(hours=4)).replace(tzinfo=UTC)
    # Just outside the repeated hour there is one meaning.
    assert len(utc_candidates(fall - timedelta(minutes=90), tz)) == 1
    assert len(utc_candidates(fall + timedelta(minutes=30), tz)) == 1
    converted = to_utc(inside, tz)
    assert converted == Converted(first, ambiguous=True)
    assert to_utc(inside, tz, hint=second + timedelta(seconds=2)) == Converted(second)
    # A hint far from both meanings is not used.
    assert to_utc(inside, tz, hint=first + timedelta(minutes=10)).ambiguous


@ZONES
def test_spring_forward_gap(tz: tzinfo) -> None:
    """A time around the skipped hour converts to one instant, monotonically."""
    spring, _fall = _transitions(tz)
    before = utc_candidates(spring - timedelta(minutes=30), tz)
    after = utc_candidates(spring + timedelta(hours=1, minutes=30), tz)
    assert len(before) == len(after) == 1
    # 2 h of wall clock across the change is 1 h of real time.
    assert after[0] - before[0] == timedelta(hours=1)


def test_no_timezone_means_utc() -> None:
    """Without a device zone, wall time is taken as UTC."""
    local = datetime(2026, 10, 17, 12)
    assert utc_candidates(local, None) == [local.replace(tzinfo=UTC)]
    fixed = timezone(timedelta(hours=-4))
    assert utc_candidates(local, fixed) == [datetime(2026, 10, 17, 16, tzinfo=UTC)]


def test_epoch_ms_round_trip() -> None:
    """Epoch milliseconds round-trip."""
    value = datetime(2026, 10, 17, 16, 0, 1, 500000, tzinfo=UTC)
    assert from_ms(epoch_ms(value)) == value
    assert Converted(value).ms == epoch_ms(value)


def test_name_stamp() -> None:
    """The 14-digit stamp is found in the NVR's and other names."""
    assert name_stamp("0-18-1-20261017164044-00000") == datetime(
        2026, 10, 17, 16, 40, 44
    )
    assert name_stamp("Mp4Record/x/RecM01_20261017_120000.mp4") is None
    assert name_stamp("20261017120000") == datetime(2026, 10, 17, 12)
    assert name_stamp("0-1-0-20261399999999-0") is None
    assert name_stamp("no digits") is None


def _rec(
    key: str, start: datetime, minutes: int, **hints: datetime | None
) -> Recording:
    return Recording(key, start, start + timedelta(minutes=minutes), hints)


@ZONES
def test_day_converter_trusts_a_proven_utc_hint(tz: tzinfo) -> None:
    """A hint that equals UTC on every clear recording places the repeated hour."""
    _spring, fall = _transitions(tz)
    clear = fall - timedelta(hours=3)
    clear_utc = utc_candidates(clear, tz)[0]
    inside = fall - timedelta(minutes=40)
    _first, second = utc_candidates(inside, tz)
    recordings = [
        _rec("a", clear, 5, playback=clear_utc, name=clear),
        # The second pass through the hour; the name stamp is local time.
        _rec("b", inside, 10, playback=second, name=inside),
    ]
    conv = DayConverter(tz, recordings)
    assert conv.hint_source == "playback"
    start, end = conv.recording(recordings[1])
    assert start == Converted(second)
    assert end.utc - start.utc == timedelta(minutes=10)
    assert not end.ambiguous
    # Events of that recording use its offset, even at the same wall time.
    ev_start, ev_end = conv.event(
        inside + timedelta(minutes=1), inside + timedelta(minutes=2), "b"
    )
    assert ev_start.utc == second + timedelta(minutes=1)
    assert not ev_start.ambiguous
    assert ev_end.utc == second + timedelta(minutes=2)


@ZONES
def test_day_converter_without_proof_flags_ambiguity(tz: tzinfo) -> None:
    """No source proven to be UTC: first occurrence, flagged as ambiguous."""
    _spring, fall = _transitions(tz)
    clear = fall - timedelta(hours=3)
    inside = fall - timedelta(minutes=40)
    recordings = [
        # Local stamps, and a missing value, prove nothing.
        _rec("a", clear, 5, name=clear, playback=None),
        _rec("b", inside, 10, name=inside, playback=None),
    ]
    conv = DayConverter(tz, recordings)
    assert conv.hint_source is None
    start, end = conv.recording(recordings[1])
    assert start.ambiguous
    assert end.ambiguous
    assert start.utc == utc_candidates(inside, tz)[0]
    ev_start, _ = conv.event(inside, inside, None)
    assert ev_start.ambiguous
    # An ordinary recording is unaffected.
    a_start, a_end = conv.recording(recordings[0])
    assert not a_start.ambiguous
    assert a_end.utc - a_start.utc == timedelta(minutes=5)


@ZONES
def test_recording_across_the_change(tz: tzinfo) -> None:
    """A recording running through the fall-back keeps its real length."""
    _spring, fall = _transitions(tz)
    # Starts at 00:50 wall time (clear), ends at 01:10 after the change.
    start_local = fall - timedelta(minutes=70)
    end_local = fall - timedelta(minutes=50)
    rec = Recording("x", start_local, end_local, {})
    conv = DayConverter(tz, [rec])
    start, end = conv.recording(rec)
    assert not start.ambiguous
    # Its end is in the repeated hour; the start's offset puts it in the first.
    assert end.utc - start.utc == timedelta(minutes=20)
    # An end before the start (bad data) is clamped.
    bad = Recording("y", fall - timedelta(hours=5), fall - timedelta(hours=6), {})
    s, e = conv.recording(bad)
    assert e.utc == s.utc
    es, ee = conv.event(fall - timedelta(hours=5), fall - timedelta(hours=6), None)
    assert ee.utc == es.utc


@ZONES
def test_local_day_bounds(tz: tzinfo) -> None:
    """Local days are 24 h, or 23/25 h on transition days."""
    spring, fall = _transitions(tz)
    start, end = local_day_bounds(datetime(2026, 7, 4, 15), tz)
    assert end - start == timedelta(hours=24)
    s, e = local_day_bounds(spring, tz)
    assert e - s == timedelta(hours=23)
    s, e = local_day_bounds(fall, tz)
    assert e - s == timedelta(hours=25)


@ZONES
def test_local_now(tz: tzinfo) -> None:
    """The device's wall time for an instant, including in the repeated hour."""
    assert local_now(tz, datetime(2026, 7, 4, 16, tzinfo=UTC)) == datetime(
        2026, 7, 4, 12
    )
    _spring, fall = _transitions(tz)
    inside = fall - timedelta(minutes=30)
    for instant in utc_candidates(inside, tz):
        assert local_now(tz, instant) == inside
    assert local_now(None, datetime(2026, 7, 4, 16, tzinfo=UTC)) == datetime(
        2026, 7, 4, 16
    )
    assert local_now(tz).year >= 2026

"""Camera-local time to UTC: one time convention end to end.

Reolink devices report recording and event times as local wall-clock time with
no offset. The device's time zone and DST rules come from the bridge
(``ReolinkHostHandle.timezone()``). Everything this integration sends to the
browser is UTC (epoch milliseconds); the browser formats it for display.

Wall-clock time is ambiguous for one hour a year: when clocks fall back, the
hour before the change happens twice. :func:`utc_candidates` returns both
meanings for such a time. :class:`DayConverter` resolves them only with a hint
proven to be UTC (it matched the UTC time of every unambiguous recording of
the same search); otherwise it keeps the first occurrence and flags the result
as ambiguous. A time in the hour skipped when clocks spring forward cannot
occur on a device; it is converted with the offset the device's rules give.
"""

from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta, timezone, tzinfo
import re

# How far apart a transition is looked for, and how close a hint must be.
_PROBE = timedelta(hours=3)
HINT_TOLERANCE = timedelta(seconds=5)

_STAMP = re.compile(r"(?:^|\D)(\d{14})(?:\D|$)")


@dataclass(frozen=True, slots=True)
class Converted:
    """A UTC instant, and whether it is a guess in the repeated hour."""

    utc: datetime
    ambiguous: bool = False

    @property
    def ms(self) -> int:
        """Return epoch milliseconds."""
        return epoch_ms(self.utc)


def epoch_ms(value: datetime) -> int:
    """Return epoch milliseconds of an aware datetime."""
    return round(value.timestamp() * 1000)


def from_ms(value: int) -> datetime:
    """Return the aware UTC datetime of epoch milliseconds."""
    return datetime.fromtimestamp(value / 1000, UTC)


def _offset(tz: tzinfo, local: datetime) -> timedelta:
    offset = tz.utcoffset(local)
    return offset if offset is not None else timedelta(0)


def utc_candidates(local: datetime, tz: tzinfo | None) -> list[datetime]:
    """Return what a wall-clock time can mean in UTC: one instant, or two.

    ``local`` is naive (any tzinfo is dropped). Two instants, earliest first,
    are returned for the hour repeated when clocks fall back.
    """
    local = local.replace(tzinfo=None)
    if tz is None:
        return [local.replace(tzinfo=UTC)]
    here = _offset(tz, local)
    before = _offset(tz, local - _PROBE)
    after = _offset(tz, local + _PROBE)
    if before > after:
        shift = before - after
        if here == before and _offset(tz, local + shift) == after:
            return [
                (local - before).replace(tzinfo=UTC),
                (local - after).replace(tzinfo=UTC),
            ]
    return [(local - here).replace(tzinfo=UTC)]


def to_utc(
    local: datetime, tz: tzinfo | None, hint: datetime | None = None
) -> Converted:
    """Convert wall-clock time to UTC, using ``hint`` (UTC) in the repeated hour."""
    candidates = utc_candidates(local, tz)
    if len(candidates) == 1:
        return Converted(candidates[0])
    if hint is not None:
        best = min(candidates, key=lambda c: abs(c - hint))
        if abs(best - hint) <= HINT_TOLERANCE:
            return Converted(best)
    return Converted(candidates[0], ambiguous=True)


def name_stamp(name: str) -> datetime | None:
    """Return the 14-digit timestamp in a recording's name, if any (naive)."""
    base = name.rsplit("/", 1)[-1]
    if (match := _STAMP.search(base)) is None:
        return None
    try:
        return datetime.strptime(match.group(1), "%Y%m%d%H%M%S")
    except ValueError:
        return None


@dataclass(frozen=True, slots=True)
class Recording:
    """What a converter needs to know about one recording."""

    key: str
    start: datetime  # wall-clock (naive or with the device zone attached)
    end: datetime
    hints: Mapping[str, datetime | None]  # candidate UTC timestamps by source


class DayConverter:
    """Convert one search's recordings and events, resolving the repeated hour.

    A hint source (e.g. the search's PlaybackTime, or a timestamp in the file
    name) is trusted only if, on every unambiguous recording, it equals the
    UTC start time; then it places the recordings in the repeated hour.
    """

    def __init__(self, tz: tzinfo | None, recordings: Iterable[Recording]) -> None:
        """Pick a trusted hint source from the unambiguous recordings."""
        self.tz = tz
        self._recordings = list(recordings)
        self.hint_source = self._trusted_source()
        self._offsets: dict[str, timedelta] = {}

    def _trusted_source(self) -> str | None:
        sources = {s for r in self._recordings for s in r.hints}
        for source in sorted(sources):
            checked = 0
            ok = True
            for rec in self._recordings:
                candidates = utc_candidates(rec.start, self.tz)
                hint = _as_utc(rec.hints.get(source))
                if len(candidates) != 1:
                    continue
                if hint is None or abs(hint - candidates[0]) > HINT_TOLERANCE:
                    ok = False
                    break
                checked += 1
            if ok and checked:
                return source
        return None

    def recording(self, rec: Recording) -> tuple[Converted, Converted]:
        """Convert a recording's start and end."""
        hint = (
            _as_utc(rec.hints.get(self.hint_source))
            if self.hint_source is not None
            else None
        )
        start = to_utc(rec.start, self.tz, hint)
        local_start = rec.start.replace(tzinfo=None)
        # The end belongs to the same stretch of clock as the start.
        offset = local_start - start.utc.replace(tzinfo=None)
        self._offsets[rec.key] = offset
        return start, _end(start, rec.end, self.tz, offset, start.ambiguous)

    def event(
        self, start: datetime, end: datetime, recording_key: str | None
    ) -> tuple[Converted, Converted]:
        """Convert an event, using its recording's offset in the repeated hour."""
        offset = self._offsets.get(recording_key or "")

        candidates = utc_candidates(start, self.tz)
        if len(candidates) == 1:
            first = Converted(candidates[0])
        elif offset is None:
            first = Converted(candidates[0], ambiguous=True)
        else:
            guess = (start.replace(tzinfo=None) - offset).replace(tzinfo=UTC)
            first = to_utc(start, self.tz, guess)
        # Without its recording, an end in the repeated hour is a guess.
        guessed = offset is None
        if offset is None:
            offset = start.replace(tzinfo=None) - first.utc.replace(tzinfo=None)
        return first, _end(first, end, self.tz, offset, guessed)


def _end(
    start: Converted,
    local: datetime,
    tz: tzinfo | None,
    offset: timedelta,
    ambiguous: bool,
) -> Converted:
    """Convert the end (wall clock) of something that began at ``start``.

    In the repeated hour the end takes the start's offset (``ambiguous`` says
    whether that is a guess), unless that puts it at or before the start: the
    clock fell back in between, so the later meaning is the end, and a
    recording running through the change keeps its length.
    """
    candidates = utc_candidates(local, tz)
    if len(candidates) == 1:
        end = Converted(candidates[0])
    else:
        guess = (local.replace(tzinfo=None) - offset).replace(tzinfo=UTC)
        end = Converted(to_utc(local, tz, guess).utc, ambiguous)
        if end.utc <= start.utc < candidates[-1]:
            end = Converted(candidates[-1], ambiguous)
    if end.utc < start.utc:
        end = Converted(start.utc, end.ambiguous)
    return end


def _as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def local_day_bounds(day: datetime, tz: tzinfo | None) -> tuple[datetime, datetime]:
    """Return the UTC start and end of a local calendar day (end exclusive)."""
    midnight = day.replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=None)
    next_midnight = midnight + timedelta(days=1)
    return utc_candidates(midnight, tz)[0], utc_candidates(next_midnight, tz)[0]


def local_now(tz: tzinfo | None, now_utc: datetime | None = None) -> datetime:
    """Return the device's current wall-clock time (naive)."""
    now = now_utc or datetime.now(UTC)
    if tz is None:
        return now.replace(tzinfo=None)
    # Use the offset that makes the wall time map back to this instant.
    for offset in {_offset(tz, (now + d).replace(tzinfo=None)) for d in _SPAN}:
        local = (now + offset).replace(tzinfo=None)
        if any(abs(c - now) < timedelta(seconds=1) for c in utc_candidates(local, tz)):
            return local
    return (now + _offset(tz, now.replace(tzinfo=None))).replace(tzinfo=None)


_SPAN = (timedelta(hours=-14), timedelta(0), timedelta(hours=14))


# ---- The device's time zone, from its own settings ----


@dataclass(frozen=True, slots=True)
class _Rule:
    """When DST starts or ends: month, week (1-4, 5 the last), weekday, time."""

    month: int
    week: int
    weekday: int  # Python's (Monday 0)
    hour: int
    minute: int
    second: int

    def at(self, year: int) -> datetime:
        """Return the local wall time it falls on in ``year``."""
        first = datetime(year, self.month, 1)
        if self.week >= 5:
            # The last such weekday of the month.
            nxt = datetime(year + self.month // 12, self.month % 12 + 1, 1)
            last = nxt - timedelta(days=1)
            day = last - timedelta(days=(last.weekday() - self.weekday) % 7)
        else:
            day = first + timedelta(days=(self.weekday - first.weekday()) % 7)
            day += timedelta(weeks=max(self.week, 1) - 1)
        return day.replace(hour=self.hour, minute=self.minute, second=self.second)


class DeviceTimezone(tzinfo):
    """A Reolink device's zone: its UTC offset and DST rules, as it keeps them.

    Built from the device's GetTime answer, which reolink-aio also turns into a
    zone; its rule arithmetic lands DST's start and end on the wrong day in
    most years (in 2026, the end a week late: 8 November, not the 1st). The
    rules here: week 1 to 4 is that occurrence of the weekday in the month,
    5 the last; weekday 0 is Sunday.
    """

    def __init__(
        self, offset: timedelta, dst: timedelta, start: _Rule, end: _Rule
    ) -> None:
        """Initialize from a standard offset, the DST shift and its two rules."""
        super().__init__()
        self._std = offset
        self._dst = dst
        self._start = start
        self._end = end

    def __repr__(self) -> str:
        """Return the offset and the shift."""
        return f"DeviceTimezone(offset={self._std!r}, dst={self._dst!r})"

    def _bounds(self, year: int) -> tuple[datetime, datetime]:
        return self._start.at(year), self._end.at(year)

    def _in_dst(self, local: datetime) -> bool:
        """Return whether wall time ``local`` is in DST (its first meaning)."""
        start, end = self._bounds(local.year)
        if start < end:
            inside = start <= local < end
            # The hour before the end happens twice: fold 1 is the second.
            if inside and local.fold and local >= end - self._dst:
                return False
            return inside
        # Southern hemisphere: DST spans the new year.
        if end - self._dst <= local < end and local.fold:
            return False
        return local >= start or local < end

    def utcoffset(self, dt: datetime | None) -> timedelta:
        """Return the offset of wall time ``dt`` (the standard one for None)."""
        if dt is None:
            return self._std
        local = dt.replace(tzinfo=None)
        return self._std + self._dst if self._in_dst(local) else self._std

    def dst(self, dt: datetime | None) -> timedelta:
        """Return the DST shift in effect at wall time ``dt``."""
        if dt is None:
            return timedelta(0)
        return self._dst if self._in_dst(dt.replace(tzinfo=None)) else timedelta(0)

    def tzname(self, dt: datetime | None) -> str:
        """Return a name such as UTC-05:00."""
        offset = self.utcoffset(dt)
        sign = "-" if offset < timedelta(0) else "+"
        minutes = abs(int(offset.total_seconds())) // 60
        return f"UTC{sign}{minutes // 60:02d}:{minutes % 60:02d}"

    def fromutc(self, dt: datetime) -> datetime:
        """Return the wall time of a UTC instant (``dt`` carries this zone)."""
        standard = dt.replace(tzinfo=None) + self._std
        start, end = self._bounds(standard.year)
        # The transitions in standard time: DST from ``start`` until ``end``
        # minus the shift (the end is given in DST wall time).
        stop = end - self._dst
        inside = (
            start <= standard < stop
            if start < end
            else standard >= start or standard < stop
        )
        if inside:
            return (standard + self._dst).replace(tzinfo=self)
        # Just after the end, the repeated hour's second meaning.
        fold = 1 if stop <= standard < end else 0
        return standard.replace(tzinfo=self, fold=fold)


def device_timezone(settings: Mapping[str, object]) -> tzinfo | None:
    """Return the zone of a device's GetTime answer (``{"Time": …, "Dst": …}``)."""
    time_part = settings.get("Time")
    dst_part = settings.get("Dst")
    if not isinstance(time_part, Mapping) or not isinstance(
        time_part.get("timeZone"), int
    ):
        return None
    # Reolink counts the offset west of UTC as positive.
    offset = timedelta(seconds=-int(time_part["timeZone"]))
    if not isinstance(dst_part, Mapping) or not dst_part.get("enable"):
        return timezone(offset)
    try:
        rules = [
            _Rule(
                int(dst_part[f"{edge}Mon"]),
                int(dst_part[f"{edge}Week"]),
                (int(dst_part[f"{edge}Weekday"]) - 1) % 7,
                int(dst_part[f"{edge}Hour"]),
                int(dst_part[f"{edge}Min"]),
                int(dst_part[f"{edge}Sec"]),
            )
            for edge in ("start", "end")
        ]
        shift = timedelta(hours=int(dst_part["offset"]))
        for rule in rules:
            rule.at(2000)  # a month or time out of range fails here
    except KeyError, TypeError, ValueError:
        return None
    return DeviceTimezone(offset, shift, rules[0], rules[1])

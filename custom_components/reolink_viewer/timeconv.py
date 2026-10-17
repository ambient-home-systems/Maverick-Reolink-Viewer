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
from datetime import UTC, datetime, timedelta, tzinfo
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
        end_candidates = utc_candidates(rec.end, self.tz)
        if len(end_candidates) == 1:
            end = Converted(end_candidates[0])
        else:
            guess = (rec.end.replace(tzinfo=None) - offset).replace(tzinfo=UTC)
            end = to_utc(rec.end, self.tz, guess)
            end = Converted(end.utc, start.ambiguous)
        if end.utc < start.utc:
            end = Converted(start.utc, end.ambiguous)
        return start, end

    def event(
        self, start: datetime, end: datetime, recording_key: str | None
    ) -> tuple[Converted, Converted]:
        """Convert an event, using its recording's offset in the repeated hour."""
        offset = self._offsets.get(recording_key or "")

        def one(local: datetime) -> Converted:
            candidates = utc_candidates(local, self.tz)
            if len(candidates) == 1:
                return Converted(candidates[0])
            if offset is None:
                return Converted(candidates[0], ambiguous=True)
            guess = (local.replace(tzinfo=None) - offset).replace(tzinfo=UTC)
            return to_utc(local, self.tz, guess)

        first, last = one(start), one(end)
        if last.utc < first.utc:
            last = Converted(first.utc, last.ambiguous)
        return first, last


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

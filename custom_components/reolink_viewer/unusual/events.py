"""Turning the journal's state changes into the events a person would recognise.

Ported from Reolink Stamina's ``relevance/events.py`` (v1.9.2, MIT, Copyright
(c) 2026 marl1w; licence in
LICENSE-reolink-stamina.txt). Changes: the transitions come from our
journal (``journal.py``), whose sensor kinds map onto subjects here
(``SUBJECTS``, from Stamina's ``detections.py``); and events can be derived
from per-sensor streams, so a year of history is never held in memory at once
(``derive_streams``).

The journal holds every state change verbatim, which is the right thing to
store and the wrong thing to count. A single arrival produces a scatter of
them: several sensors fire within a second of each other, the person walks out
of frame and back in, and a flapping sensor adds a few more. Counted as they
lie, one person walking to a door is six detections.

So events are *derived*, here, on the way out, never stored: when real data
says the merge window should be twelve seconds rather than three, changing it
re-reads the history instead of invalidating it.

Merging is per camera and subject, not per entity. Reolink reports the same
person through several sensors (``person``, ``crossline_person``,
``intrusion_person``) and they map to one subject on purpose, so an arrival is
one event however many of them report it. How long it lasted is measured from
the sensor that opened it, though: ``linger_person`` and its siblings stay on
for as long as something lingers. See ``_runs``.
"""

from __future__ import annotations

from collections.abc import Iterable, Iterator
from dataclasses import dataclass
import datetime as dt
import heapq
import json
from operator import attrgetter
from typing import NamedTuple

from homeassistant.const import STATE_ON, SUN_EVENT_SUNRISE, SUN_EVENT_SUNSET
from homeassistant.core import HomeAssistant
from homeassistant.helpers.sun import get_astral_event_date
from homeassistant.util import dt as dt_util

from .const import EVENT_MAX_SECONDS, EVENT_MERGE_SECONDS

# The journal's sensor kinds (devices.DETECTION_KINDS), mapped onto what was
# seen. A person crossing a line is a person. Stamina's map, plus tamper.
SUBJECTS: dict[str, str] = {
    "person": "person",
    "vehicle": "vehicle",
    "non-motor_vehicle": "vehicle",
    "pet": "animal",
    "dog_cat": "animal",
    "animal": "animal",
    "package": "package",
    "face": "face",
    "visitor": "doorbell",
    "cry": "crying",
    "motion": "motion",
    "tamper": "tamper",
    "crossline_person": "person",
    "crossline_vehicle": "vehicle",
    "crossline_dog_cat": "animal",
    "intrusion_person": "person",
    "intrusion_vehicle": "vehicle",
    "intrusion_dog_cat": "animal",
    "linger_person": "person",
    "linger_vehicle": "vehicle",
    "linger_dog_cat": "animal",
    "forgotten_item": "forgotten_item",
    "taken_item": "taken_item",
}

# How far either side of sunrise or sunset still counts as twilight, for the phrase alone.
TWILIGHT_MINUTES = 30

_DAYS = ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")

_MINUTES_PER_DAY = 1440
_HALF_DAY_MINUTES = _MINUTES_PER_DAY // 2


class Transition(NamedTuple):
    """One state change of one detection sensor, as the journal has it.

    A named tuple (Stamina's is a frozen dataclass): a rebuild makes millions.
    """

    camera: str
    entity_id: str
    # The subject (SUBJECTS), not the sensor's own kind.
    kind: str
    # "on", "off", "unavailable" or "unknown".
    state: str
    # Unix seconds, UTC: Home Assistant's own clock.
    at: float
    # A JSON snapshot of house-wide signals at this instant, or None (none are
    # recorded yet).
    context: str | None = None


@dataclass(slots=True, frozen=True)
class Event:
    """One detection, as the panel would describe it."""

    camera: str
    kind: str
    started_at: float
    # None while the sensors are still on. An event that has not finished has no duration
    # either, and saying it lasted "until now" would be a guess that gets counted.
    ended_at: float | None
    duration: float | None
    # Local clock, 0…1439. What captures a household's schedule.
    minute_of_day: int
    # Minutes from sunset, wrapped to ±720, or None where the sun never sets or Home
    # Assistant has no location. What captures darkness, which the clock cannot: 18:00 is
    # daylight in June and night in December.
    solar_offset: int | None
    # "dawn", "day", "dusk", "night", or None where the offset is None. Carried beside the
    # offset because the offset alone cannot tell morning from evening.
    solar_phase: str | None
    is_weekend: bool
    # "Mon" … "Sun". Beside the weekend flag rather than derived from it, because the two are
    # counted separately and blended: see `Profile.day_of_week`.
    day_of_week: str = ""
    # The signals as they stood when this began; empty where none are recorded.
    context: tuple[tuple[str, str], ...] = ()


def _wrap(minutes: float) -> int:
    """Fold a minute offset into ±720, so midnight is not a discontinuity."""
    value = round(minutes) % _MINUTES_PER_DAY
    if value >= _HALF_DAY_MINUTES:
        value -= _MINUTES_PER_DAY
    return value


class SolarClock:
    """Where the sun was, remembered per date.

    Astral is cheap and a year of events is not, so each date is worked out once. Local
    dates, because that is what a household's evening is measured against.

    Two answers rather than one, and they do different jobs. The *offset* from sunset is what
    the model counts: it is continuous, it wraps, and it tracks the season. The *phase* is
    what a person reads, because "8h 53m before sunset" is arithmetically correct and means
    nothing; the honest way to say it is "in daylight".
    """

    def __init__(self, hass: HomeAssistant) -> None:
        """Prepare a clock for this installation's location."""
        self._hass = hass
        # Per instance rather than an `lru_cache` on the method, which would key on `self`
        # and keep every Home Assistant it had ever been asked about alive.
        # (Ours: each date's sunrise and sunset as timestamps, so an event's offset
        # and phase are float arithmetic, not datetime arithmetic.)
        self._days: dict[dt.date, tuple[float | None, float | None]] = {}

    def _day(self, day: dt.date) -> tuple[float | None, float | None]:
        """Return a local date's sunrise and sunset, or None where there is none."""
        found = self._days.get(day)
        if found is None:
            found = self._days[day] = (
                self._event(SUN_EVENT_SUNRISE, day),
                self._event(SUN_EVENT_SUNSET, day),
            )
        return found

    def _event(self, name: str, day: dt.date) -> float | None:
        try:
            moment = get_astral_event_date(self._hass, name, day)
        except ValueError, TypeError:
            # No location configured, or a latitude where the sun does not set today.
            return None
        return None if moment is None else moment.timestamp()

    def offset(self, moment: dt.datetime) -> int | None:
        """Return minutes from that day's sunset, negative before it."""
        return self.offset_at(moment.timestamp(), moment.date())

    def offset_at(self, at: float, day: dt.date) -> int | None:
        """Return minutes from sunset, for a timestamp on a local date."""
        sunset = self._day(day)[1]
        if sunset is None:
            return None
        return _wrap((at - sunset) / 60.0)

    def phase(self, moment: dt.datetime) -> str | None:
        """Return "dawn", "day", "dusk" or "night": what somebody would call it.

        Twilight is claimed by whichever edge it is nearer, within a fixed half hour either
        side. Not civil twilight, which varies from twenty minutes to never depending on the
        latitude and would make the same phrase mean different things in different houses.
        """
        return self.phase_at(moment.timestamp(), moment.date())

    def phase_at(self, at: float, day: dt.date) -> str | None:
        """Return the phase, for a timestamp on a local date."""
        sunrise, sunset = self._day(day)
        if sunrise is None or sunset is None:
            return None
        edge = TWILIGHT_MINUTES * 60
        if abs(at - sunrise) <= edge:
            return "dawn"
        if abs(at - sunset) <= edge:
            return "dusk"
        return "day" if sunrise < at < sunset else "night"


def _signals(raw: str | None) -> tuple[tuple[str, str], ...]:
    """Turn a stored snapshot back into pairs, sorted so two events compare equal.

    JSON that cannot be read is treated as no signals at all: a corrupt row should cost its
    own context and nothing else.
    """
    if not raw:
        return ()
    try:
        found = json.loads(raw)
    except TypeError, ValueError:
        return ()
    if not isinstance(found, dict):
        return ()
    return tuple(sorted((str(key), str(value)) for key, value in found.items()))


def _detecting(transition: Transition) -> bool:
    """Whether this state means the camera is seeing something.

    Anything that is not `on` (cleared, unavailable, unknown) means it is not. A camera that
    drops off the network mid-event has not been watching a person for six hours.
    """
    return transition.state == STATE_ON


def _runs(
    transitions: Iterable[Transition], *, window: float, longest: float
) -> Iterator[tuple[float, float | None, str | None]]:
    """Yield the start, end and opening context of each merged run of detection.

    A run belongs to the sensor that opened it, and ends when *that* sensor clears.
    `vehicle`, `crossline_vehicle` and `linger_vehicle` all map to one subject on purpose,
    but `linger_vehicle` stays on for as long as something lingers, so a car pulling into a
    garage would hold the whole event open behind it. Measured by Stamina: three transitions
    in isolation derive to 10.9 seconds; add one same-kind sensor bouncing nearby and the same
    arrival became 288.2.

    Everything a companion sensor does *inside* an open run is still swallowed, so one arrival
    remains one event however many sensors report it. It simply no longer decides when that
    event finished.
    """
    start: float | None = None
    end: float | None = None
    context: str | None = None
    opener: str | None = None

    for row in transitions:
        if _detecting(row):
            if start is not None and end is not None and row.at - end > window:
                # Quiet for longer than the window, so the previous run really did finish.
                yield start, end, context
                start = None
            if start is None:
                start = row.at
                end = None
                opener = row.entity_id
                # The signals as they were when it *began*: what was true at the start is
                # what the event happened against.
                context = row.context
            elif row.entity_id == opener:
                # The same sensor flickering back on inside the window: one detection, still
                # running, so whatever end it had recorded was premature.
                end = None
        elif start is not None and end is None and row.entity_id == opener:
            # The *first* clear ends it. Provisional only in that the same sensor firing again
            # inside the window reopens it, above. `end is None` is the guard: a later
            # redundant clear (a second `off`, an `unavailable` when the recorder reboots)
            # must not drag the end along with it.
            end = row.at

        if start is not None and row.at - start >= longest:
            # Cut at the limit, not at whenever the next transition happened to arrive: a
            # sensor stuck on and gone quiet would otherwise produce an event as long as the
            # silence.
            yield (
                start,
                min(end if end is not None else row.at, start + longest),
                context,
            )
            start, end, context, opener = None, None, None, None

    if start is not None:
        yield start, end, context


def _events_of(
    camera: str,
    kind: str,
    transitions: Iterable[Transition],
    *,
    window: float,
    longest: float,
    clock: SolarClock,
) -> Iterator[Event]:
    """Yield one camera and subject's events, oldest first."""
    zone = dt_util.get_default_time_zone()
    for started_at, ended_at, context in _runs(
        transitions, window=window, longest=longest
    ):
        local = dt.datetime.fromtimestamp(started_at, zone)
        day = local.date()
        yield Event(
            camera=camera,
            kind=kind,
            started_at=started_at,
            ended_at=ended_at,
            duration=None if ended_at is None else round(ended_at - started_at, 3),
            minute_of_day=local.hour * 60 + local.minute,
            solar_offset=clock.offset_at(started_at, day),
            solar_phase=clock.phase_at(started_at, day),
            is_weekend=local.weekday() >= 5,
            day_of_week=_DAYS[local.weekday()],
            context=_signals(context),
        )


def _order(event: Event) -> tuple[float, str, str]:
    return (event.started_at, event.camera, event.kind)


def derive_streams(
    hass: HomeAssistant,
    groups: Iterable[tuple[str, str, Iterable[Transition]]],
    *,
    window: float = EVENT_MERGE_SECONDS,
    longest: float = EVENT_MAX_SECONDS,
    clock: SolarClock | None = None,
) -> Iterator[Event]:
    """Fold each (camera, subject, transitions oldest first) into events, oldest first.

    Lazily: the streams are read as the events are taken, so a year of history is never
    held in memory at once.
    """
    clock = clock or SolarClock(hass)
    return heapq.merge(
        *(
            _events_of(camera, kind, rows, window=window, longest=longest, clock=clock)
            for camera, kind, rows in groups
        ),
        key=_order,
    )


def derive(
    hass: HomeAssistant,
    transitions: Iterable[Transition],
    *,
    window: float = EVENT_MERGE_SECONDS,
    longest: float = EVENT_MAX_SECONDS,
    clock: SolarClock | None = None,
) -> list[Event]:
    """Fold transitions into events, oldest first.

    `window` and `longest` are arguments rather than constants read inside, so other values
    can be tried against the same history.
    """
    grouped: dict[tuple[str, str], list[Transition]] = {}
    for row in transitions:
        grouped.setdefault((row.camera, row.kind), []).append(row)
    for rows in grouped.values():
        rows.sort(key=attrgetter("at"))
    return list(
        derive_streams(
            hass,
            ((camera, kind, rows) for (camera, kind), rows in grouped.items()),
            window=window,
            longest=longest,
            clock=clock,
        )
    )

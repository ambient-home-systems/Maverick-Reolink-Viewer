"""How unusual an event is, and the sentence that says why.

Ported from Reolink Stamina's ``relevance/score.py`` (v1.9.2, MIT, Copyright
(c) 2026 marl1w; licence in
LICENSE-reolink-stamina.txt). Changes: ``informative`` comes along
from its ``shapes.py``; pools follow our hosts (``Model.hosts``); and the
thresholds may be calibrated on a sample (``calibrate``'s ``scored``), with a
camera that is ready but has nothing recent judged by the floor alone.

Each signal contributes an independent surprisal and they are added together. It is naive
Bayes, the independence assumption is plainly false — an event after dark is more likely to
be at an odd hour — and it works perfectly well for ranking, which is all this is for.

What matters is that adding a signal does not *partition* the history. Conditioning on three
booleans would turn six months into three weeks per bucket and the estimates would collapse;
adding three terms in log space costs nothing in sample size. That is why the design has
terms rather than conditions, and why a new signal can arrive on its own later.

Every contribution is measured against a uniform baseline, so zero means "tells me nothing"
and the sum reads as a log-likelihood ratio rather than an arbitrary number. Positive is
rarer than chance, negative is more common — which makes a breakdown legible to a person
without explaining what a nat is.

The sentence is not decoration. A mark on a row that cannot say why is a machine asking to be
trusted, and this one has not earned that. If a change ever makes the sentence impossible to
generate, the model has become too clever for its own good.
"""

from __future__ import annotations

from collections.abc import Callable, Iterable
from dataclasses import dataclass, replace
from functools import partial
import math
from typing import Any

from .const import (
    INCIDENT_SECONDS,
    RATE_BINS,
    SCORE_FLOOR,
    SCORE_MIN_DAYS,
    SCORE_MIN_EVENTS,
    SCORE_QUANTILE,
    TIME_WEIGHT,
    UNMARKED_KINDS,
    UNREAD_STATES,
)
from .events import Event
from .rates import (
    Model,
    Profile,
    duration_bucket,
    gap,
    interpolate,
    preceded,
    predecessor_label,
    quantile,
    signal_value,
)

# States that are the absence of a reading rather than a reading (from Stamina's
# shapes.py): a signal that has only ever read these says nothing.
UNINFORMATIVE = frozenset({"unknown", "unavailable", "none", ""})


def informative(table: Any) -> bool:
    """Whether a distribution holds any reading at all, as opposed to only absences."""
    return any(value.lower() not in UNINFORMATIVE for value in table.weights)


# The two readings of the clock (ours: counted once, said once).
_TIME_TERMS = frozenset({"clock", "solar"})

# Below this a term is not worth mentioning in the sentence: it agrees with the model, and
# saying so would bury the one thing that does not.
_WORTH_SAYING = 0.5


@dataclass(slots=True, frozen=True)
class Term:
    """One signal's contribution, and what it was."""

    name: str
    # What this signal actually was, phrased for a person: "02:40", "4h after sunset".
    label: str
    # Positive means rarer than chance, negative means more common. Zero means uninformative.
    contribution: float
    # How many times this has been seen before. A fact for the sentence, not an estimate.
    seen: int
    # The signal's own name, where it has one — a chosen entity is called whatever Home
    # Assistant calls it, while "clock" and "duration" are named by the panel.
    subject: str = ""


@dataclass(slots=True, frozen=True)
class Score:
    """What the model makes of one event."""

    total: float
    # None while this camera is still collecting, which is not the same as zero.
    threshold: float | None
    unusual: bool
    terms: tuple[Term, ...]
    reason: str


def ready(profile: Profile) -> bool:
    """Whether a camera has enough behind it to be compared against itself."""
    return profile.events >= SCORE_MIN_EVENTS and profile.days >= SCORE_MIN_DAYS


def _surprisal(probability: float, categories: int) -> float:
    """Return how much rarer than chance an observation is, in nats."""
    if probability <= 0.0:
        probability = 1e-9
    return -math.log(probability * max(categories, 1))


# What share of days are weekends. The baseline the weekend term is measured against, and the
# whole reason that term needs one of its own: measured against an even split, a household that
# behaves identically all week would report every Saturday as unusual — because a Saturday is
# two days in seven, which is true of every household there has ever been and says nothing
# about any of them. Against this, an even household contributes nothing and only a household
# whose weekend genuinely differs does.
_WEEKEND_SHARE = 2 / 7


def _ratio(probability: float, expected: float) -> float:
    """Return how many times more often than expected something was seen."""
    return max(probability, 1e-9) / max(expected, 1e-9)


_DAY_NAMES = {
    "Mon": "a Monday",
    "Tue": "a Tuesday",
    "Wed": "a Wednesday",
    "Thu": "a Thursday",
    "Fri": "a Friday",
    "Sat": "a Saturday",
    "Sun": "a Sunday",
}


def _clock_time(minute: int) -> str:
    """Render a minute of the day as a clock time."""
    return f"{minute // 60:02d}:{minute % 60:02d}"


# What each phase is called in a sentence. The model still counts minutes from sunset — a
# continuous, seasonal number is what makes the term worth having — but nobody reads a number
# measured from an event nine hours away, and "8h 53m before sunset" for a lunchtime detection
# is how a correct model comes to look broken.
_SOLAR_PHRASES = {
    "dawn": "around sunrise",
    "day": "in daylight",
    "dusk": "around sunset",
    "night": "after dark",
}


def _solar_phrase(phase: str | None, offset: int) -> str:
    """Render where the sun was as something a person would say."""
    named = _SOLAR_PHRASES.get(phase or "")
    if named is not None:
        return named
    # No location configured, or a latitude where the sun does not rise or set that day. The
    # offset is all there is, so it is what gets said.
    if offset == 0:
        return "at sunset"
    hours, minutes = divmod(abs(offset), 60)
    if hours and minutes:
        span = f"{hours}h {minutes}m"
    elif hours:
        span = f"{hours}h"
    else:
        span = f"{minutes}m"
    return f"{span} {'after' if offset > 0 else 'before'} sunset"


def _times(number: int) -> str:
    """Render how many times: once, twice, 8 times (ours)."""
    return {1: "once", 2: "twice"}.get(number, f"{number} times")


def _span(days: float) -> str:
    """Render how long a camera has been watched, roughly and readably."""
    if days >= 60:
        return f"{round(days / 30)} months"
    if days >= 14:
        return f"{round(days / 7)} weeks"
    return f"{max(1, round(days))} days"


def _lasting(bucket: str) -> str:
    """Spell a duration bucket (``~32s``, ``open``, ``instant``) in a sentence (ours).

    From Stamina's ``shapes.duration_phrase``: the bucket is a key, and "lasting
    ~256s" reads as one.
    """
    if bucket == "open":
        return "still going"
    if bucket == "instant":
        return "lasting an instant"
    try:
        seconds = int(bucket.removeprefix("~").removesuffix("s"))
    except ValueError:
        return f"lasting {bucket}"
    if seconds < 90:
        return f"lasting about {seconds} s"
    minutes = seconds / 60
    return (
        f"lasting about {minutes:.0f} min" if minutes >= 2 else "lasting about a minute"
    )


def _bucket_seconds(bucket: str) -> float:
    """Return a duration bucket's seconds: ``instant`` 0, ``open`` endless (ours)."""
    if bucket == "open":
        return math.inf
    if bucket == "instant":
        return 0.0
    try:
        return float(bucket.removeprefix("~").removesuffix("s"))
    except ValueError:
        return math.inf


def _typical_seconds(*profiles: Profile) -> float | None:
    """Return the median duration bucket of the first profile with any (ours)."""
    for profile in profiles:
        table = profile.duration
        if table.total <= 0:
            continue
        half, running = table.total / 2, 0.0
        for label in sorted(table.weights, key=_bucket_seconds):
            running += table.weights[label]
            if running >= half:
                return _bucket_seconds(label)
    return None


def _signal_share(key: str, was: str, many: int, profile: Profile) -> float:
    """Return a signal value's smoothed share in one profile (even where unseen)."""
    if key in profile.signals:
        return profile.signals[key].probability(was, categories=many)
    return 1.0 / many


def _terms(
    event: Event,
    previous: Event | None,
    model: Model,
    names: dict[str, str],
    labels: dict[str, str] | None = None,
) -> list[Term]:
    """Return every signal's contribution to how unusual this event is."""
    labels = labels or {}
    specific, broader, overall = model.blended(event.camera, event.kind)

    def blend(pick: Callable[[Profile], float]) -> float:
        """Fall back from this camera and kind, to the kind across its pool, to the pool."""
        return interpolate(
            pick(specific),
            interpolate(pick(broader), pick(overall), broader.weight),
            specific.weight,
        )

    terms: list[Term] = []

    # What it was. Every other term is measured against a profile the kind was used to
    # select, so none of them can say that a person here is rare — they all answer "given a
    # person, how odd is the hour". This is the missing first factor, and adding it makes the
    # sum a likelihood of the whole event rather than of its attributes given its kind. It is
    # not double counting: P(person here) x P(this hour | person here) is the chain rule, and
    # the model was previously dropping the left half on the floor.
    #
    # Measured against this camera's own mix, backing off to the pool's. A camera facing a
    # street sees people all day and a bedroom camera does not, and neither fact should be
    # imported into the other.
    own, pool = model.marginal(event.camera)
    # Skipped where a camera has only ever seen one kind: its probability is 1, so the
    # surprisal is a *constant* negative subtracted from every score that camera ever
    # produces. The same trap the configured signals already guard against, and it costs
    # nothing to notice here too.
    if len(own.kinds.weights) > 1:
        many = max(len(own.kinds.weights), len(pool.kinds.weights), 2)
        seen_here = own.kinds.count(event.kind)
        surprise = _surprisal(
            interpolate(
                own.kinds.probability(event.kind, categories=many),
                pool.kinds.probability(event.kind, categories=many),
                own.weight,
            ),
            many,
        )
        terms.append(
            Term(
                name="kind",
                label=event.kind.replace("_", " ").capitalize(),
                contribution=surprise,
                seen=seen_here,
            )
        )

    # Ours: the time of day and the time from sunset are two readings of one clock
    # (they agreed 95% of the time on the owner's first 11 days), so where both
    # are known each counts half (TIME_WEIGHT): time is counted once. Sunset
    # still moves the score as it shifts through the seasons.
    halved = TIME_WEIGHT if event.solar_offset is not None else 1.0
    terms.append(
        Term(
            name="clock",
            label=_clock_time(event.minute_of_day),
            contribution=halved
            * _surprisal(
                blend(lambda p: p.clock.probability(event.minute_of_day)), RATE_BINS
            ),
            seen=specific.clock.nearby(event.minute_of_day),
        )
    )

    if event.solar_offset is not None:
        offset = event.solar_offset
        terms.append(
            Term(
                name="solar",
                label=_solar_phrase(event.solar_phase, offset),
                contribution=halved
                * _surprisal(
                    blend(lambda p: p.solar.probability(offset % 1440)), RATE_BINS
                ),
                seen=specific.solar.nearby(offset % 1440),
            )
        )

    bucket = duration_bucket(event.duration)
    categories = max(len(specific.duration.weights), len(overall.duration.weights), 2)
    lasted = _surprisal(
        blend(lambda p: p.duration.probability(bucket, categories=categories)),
        categories,
    )
    # Ours: only lasting longer than usual stands out (someone lingering); shorter
    # than usual can only make an event look more ordinary. Brief detections are
    # mostly passing cars and false ones ("Vehicle lasting about 1 s").
    typical = _typical_seconds(specific, broader, overall)
    if typical is not None and _bucket_seconds(bucket) < typical:
        lasted = min(lasted, 0.0)
    terms.append(
        Term(
            name="duration",
            label=bucket,
            contribution=lasted,
            seen=specific.duration.count(bucket),
        )
    )

    # What the other cameras were doing. The absent case is the interesting one: something at
    # the back that never appeared at the front did not use the approach route.
    #
    # Said with the time between them, because "after Balcone Nord" on its own is not
    # checkable. The reader goes looking for that camera in the timeline and finds its
    # nearest row forty minutes earlier — because the detection that actually preceded this
    # was motion, and the timeline hides motion unless asked. The gap is what turns a claim
    # they cannot verify into one they can: a second is obviously the same person, and if the
    # row they can see is forty minutes back then it plainly is not the row being named.
    #
    # Display only. `predecessor_label` above is what gets counted, and it is unchanged —
    # putting a continuous number into a counted label would give every event a category of
    # its own, which is the one thing the bucketing exists to prevent.
    label = predecessor_label(event, previous)
    if label == "none" or previous is None:
        phrase = "nothing fired first"
    else:
        who = names.get(previous.camera, "another camera")
        since_previous = round(gap(event, previous))
        # Zero means they overlapped: several cameras seeing the same person at once, which is
        # most of what a house full of cameras records. "0s after" reads as a rounding error.
        phrase = (
            f"alongside {who}"
            if since_previous == 0
            else f"{since_previous}s after {who}"
        )
    categories = max(
        len(specific.predecessor.weights), len(overall.predecessor.weights), 2
    )
    came_after = _surprisal(
        blend(lambda p: p.predecessor.probability(label, categories=categories)),
        categories,
    )
    # Ours: only "nothing fired first" (appearing without the usual approach) can
    # raise a score; on a busy property which camera came last is mostly chance
    # ("Vehicle 21s after Dogs"), so a rare "after" can only lower one.
    if label != "none":
        came_after = min(came_after, 0.0)
    terms.append(
        Term(
            name="predecessor",
            label=phrase,
            contribution=came_after,
            seen=specific.predecessor.count(label),
        )
    )

    # Which day it was, at whichever granularity this camera has earned.
    #
    # Two tables, blended by how much the seven-day one has behind it, so a busy gate is judged
    # against Sundays and a quiet garden against weekends — with no threshold at which one
    # becomes the other. Blended as *ratios to expectation* rather than as probabilities,
    # because the two are not on the same scale: p(Sunday) is around a seventh and p(weekend)
    # around two, and averaging those two numbers would mean nothing at all.
    group = "weekend" if event.is_weekend else "weekday"
    coarse = _ratio(
        blend(lambda p: p.weekend.probability(group, categories=2)),
        _WEEKEND_SHARE if event.is_weekend else 1 - _WEEKEND_SHARE,
    )
    exact = _ratio(
        blend(lambda p: p.day_of_week.probability(event.day_of_week, categories=7)),
        1 / 7,
    )
    terms.append(
        Term(
            name="weekend",
            # The day itself, whichever table did the deciding: it is true either way, and
            # "on a Sunday" reads better than a granularity the reader did not ask about.
            label=_DAY_NAMES.get(
                event.day_of_week, "a weekend" if event.is_weekend else "a weekday"
            ),
            contribution=-math.log(
                max(interpolate(exact, coarse, specific.day_of_week.total / 7.0), 1e-9)
            ),
            # Ours: the day itself, as the sentence names it ("on a Sunday"), not
            # weekend days at large: what is known is counted by its own name.
            seen=specific.day_of_week.count(event.day_of_week),
        )
    )

    # Whatever else the user asked to be counted. Absent is a value in its own right rather
    # than a gap: a signal added six months in was genuinely unknown before that, and
    # silently skipping those events would shift every count that mentions it.
    seen = dict(event.context)
    for entity_id in sorted(set(specific.signals) | set(seen)):
        # A signal that has only ever read `unknown` is not a signal. A siren that has never
        # fired, or an entity Home Assistant has disabled, has one category — so its
        # probability is 1 and its surprisal is a *constant* negative, subtracted from every
        # score on that camera for ever. It cost nothing to notice and it moved the line.
        distribution = specific.signals.get(entity_id)
        if distribution is not None and not informative(distribution):
            continue
        # Ours: a signal not reading (Home Assistant starting, an entity offline)
        # says nothing about this event; scored, it would be rare every restart.
        if seen.get(entity_id, "unknown").lower() in UNREAD_STATES:
            continue
        # Through the same function the training pass used. A numeric signal is counted as the
        # band its reading fell in, and training recording "12 to 18" while scoring looked up
        # "14.2" would mean no numeric signal ever matched anything it had learned.
        value = signal_value(entity_id, seen.get(entity_id, "unknown"), model)
        categories = max(len(distribution.weights) if distribution else 0, 2)
        terms.append(
            Term(
                name="signal",
                subject=labels.get(entity_id, entity_id),
                label=value,
                contribution=_surprisal(
                    # Bound now, not captured: a lambda built in a loop that reads the
                    # loop variable sees whatever it holds when it finally runs, which
                    # here would be the last signal for every one of them.
                    blend(partial(_signal_share, entity_id, value, categories)),
                    categories,
                ),
                seen=distribution.count(value) if distribution else 0,
            )
        )

    # Ours: whatever a camera has seen KNOWN_AFTER times for this kind is known
    # there, and can only lower a score: rare as a share of a busy camera's events
    # is not rare ("Vehicle lasting about 16 s — 14th time in 8 days").
    return [
        replace(term, contribution=min(term.contribution, 0.0))
        if term.seen >= model.known_after
        else term
        for term in terms
    ]


def total(event: Event, previous: Event | None, model: Model) -> float:
    """Return only the number.

    Calibration walks the entire history on every rebuild and has no use for the sentences,
    which cost more to assemble than the arithmetic they describe.
    """
    return sum(term.contribution for term in _terms(event, previous, model, {}))


def score(
    event: Event,
    model: Model,
    *,
    previous: Event | None,
    names: dict[str, str] | None = None,
    labels: dict[str, str] | None = None,
) -> Score:
    """Return how unusual this event is, and the sentence that says why.

    `previous` is the event before this one across every camera, and it is required rather
    than defaulted for a reason worth stating: the threshold is calibrated over a particular
    set of terms, so scoring against a *different* set compares two things measured on
    different scales, and nothing would ever be marked. Making the caller say `None` — which
    means "nothing fired first", a real and telling signal — is what stops that being a
    mistake anyone can make quietly.
    """
    names = names or {}
    terms = _terms(event, previous, model, names, labels)
    summed = sum(term.contribution for term in terms)
    threshold = model.thresholds.get(event.camera)
    # The strictest of them, and reported as such: the panel draws the line it was actually
    # measured against, so a gauge showing a score just past its camera's threshold but short
    # of the floor does not look like a mark that failed to appear. (Ours: and the daily cap.)
    against = None if threshold is None else max(threshold, model.floor, model.cap)
    # Ours: motion is learned from (what fired first, each camera's mix) but never
    # marked: on the owner's property it was 10 of the first 25 marks.
    unusual = (
        against is not None and summed > against and event.kind not in UNMARKED_KINDS
    )
    return Score(
        total=summed,
        threshold=against,
        unusual=unusual,
        terms=tuple(terms),
        reason=_reason(
            event,
            terms,
            model.profile(event.camera, event.kind),
            names,
            marked=unusual,
            held=event.started_at <= model.built_at,
        ),
    )


def reason(
    event: Event,
    result: Score,
    model: Model,
    names: dict[str, str],
    *,
    unsaid: Callable[[Term], bool] | None = None,
) -> str:
    """Return a scored event's sentence again, with other names (ours: an incident's).

    Terms ``unsaid`` picks are left out of the sentence (not out of the score).
    """
    terms = [term for term in result.terms if unsaid is None or not unsaid(term)]
    return _reason(
        event,
        terms,
        model.profile(event.camera, event.kind),
        names,
        marked=result.unusual,
        held=event.started_at <= model.built_at,
    )


def _reason(
    event: Event,
    terms: list[Term],
    profile: Profile,
    names: dict[str, str],
    *,
    marked: bool = False,
    held: bool = False,
) -> str:
    """Build the sentence a person reads instead of the numbers.

    The largest one or two contributions, and a count that is a fact rather than an estimate.
    Nothing here is generated from the score itself: if the model cannot say which signal made
    an event stand out, there is no sentence to show and none is invented.
    """
    subject = names.get(event.camera, "This camera")
    kind = event.kind.replace("_", " ").capitalize()

    ranked = sorted(terms, key=lambda term: term.contribution, reverse=True)
    leading = [term for term in ranked if term.contribution >= _WORTH_SAYING]
    # Ours: a marked event is never "usual": several small rarities can add up
    # past the line with none worth saying alone, and then the largest are said.
    if marked and not leading:
        leading = [term for term in ranked if term.contribution > 0]
    # Ours: "at 01:57" and "after dark" say the same thing; one of them is enough.
    if leading and leading[0].name in _TIME_TERMS:
        leading = [leading[0]] + [t for t in leading[1:] if t.name not in _TIME_TERMS]
    leading = leading[:2]
    if not leading:
        return f"{kind} at {_clock_time(event.minute_of_day)} — usual for {subject}."

    head = leading[0]
    # Ours: "Package on Doorbell — seen 8 times" says it; "Package at all on" is clipped.
    opening = kind if head.name == "kind" else f"{kind} {_phrase(head)}"

    # The count includes this one, which is how a person counts. (Ours: as a total, "seen
    # 8 times", not "the 8th time": Stamina scores an event against the model before it,
    # but the panel scores the past against today's model, which already holds it
    # (`held`) and what came after, so two marks a day apart both said "8th time".)
    times = max(1, head.seen + (0 if held else 1))
    span = _span(profile.days) if profile.days else "the record so far"
    sentence = f"{opening} on {subject} — seen {_times(times)} in {span}"

    if len(leading) > 1:
        sentence += f", and {_phrase(leading[1], lead=False)}"
    return f"{sentence}."


def _phrase(term: Term, *, lead: bool = True) -> str:
    """Render one signal as part of a sentence rather than as a label.

    The labels are written for the breakdown, where each sits in its own row and needs no
    grammar. Dropped into prose they read badly — "Person with after Gate", "and 04:41" —
    and the sentence is the whole feature's credibility, so each kind of signal gets the
    words that make it a phrase.

    `lead` says whether this is the phrase the sentence opens on or the one appended after
    "and". Only the kind term needs to know: the opening already names the kind, so it has to
    finish that clause, while the tail is a clause of its own and has to stand up alone.
    """
    if term.name == "kind":
        # The sentence already opens with the kind, so repeating it reads as a stutter.
        # "Person at all on the Balcone Nord" is the claim, and it is the right one — but
        # ", and at all" appended to another clause is too clipped to parse.
        return "at all" if lead else "rarely seen here"
    if term.name == "clock":
        return f"at {term.label}"
    if term.name == "solar":
        return term.label
    if term.name == "duration":
        return _lasting(term.label)
    if term.name == "weekend":
        return f"on {term.label}"
    if term.name == "predecessor":
        # Already a phrase in all of its forms: "nothing fired first", "3s after Gate",
        # "alongside Gate".
        return term.label
    if term.name == "signal" and term.subject:
        # A chosen signal has a name of its own, and the state alone is meaningless in a
        # sentence: "with armed_away" says nothing about what was armed. (Ours: and the
        # state spelled, "with Alarm armed away".)
        return f"with {term.subject} {term.label.replace('_', ' ')}"
    return f"with {term.label.replace('_', ' ')}"


def calibrate(
    model: Model,
    events: Iterable[Event],
    *,
    share: float = SCORE_QUANTILE,
    floor: float = SCORE_FLOOR,
    scored: Callable[[Event], bool] | None = None,
) -> list[tuple[Event, float]]:
    """Work out how high a score has to be before it is worth marking.

    Two numbers, and an event has to clear both.

    The *quantile* is per camera, over that camera's own history, because surprisal is not on
    a portable scale: the same figure means different things on a camera with two hundred
    events and one with twenty thousand. It stops a chatty camera flooding the list.

    The *floor* is absolute, and it is the one that says a mark means something. Measured on a
    real installation (nine cameras, a fortnight, 5,659 events) the per-camera thresholds at
    the 0.95 quantile ran from -0.63 to 0.45, median 0.05. A negative threshold marks events
    that were *more* likely than chance. Only 4.6% of all events scored above zero at all.

    Cameras without enough behind them get no threshold at all, which is what the panel reads
    as "still collecting", deliberately not the same as a threshold of zero.

    ``scored`` picks which events are scored (all by default); every event is still walked,
    so each scored one has its true predecessor. A camera that is ready but had none scored
    is judged by the floor alone. Returns the events scored, with their scores.
    """
    scored_pairs: list[tuple[Event, float]] = []
    scores: dict[str, list[float]] = {}
    for event, previous in preceded(events, scope=model.scope, hosts=model.hosts):
        if scored is None or scored(event):
            value = total(event, previous, model)
            scored_pairs.append((event, value))
            scores.setdefault(event.camera, []).append(value)

    model.thresholds = {
        camera: quantile(scores[camera], share) if camera in scores else -math.inf
        for camera, profile in model.per_camera.items()
        if ready(profile)
    }
    model.floor = floor
    return scored_pairs


def incidents[T](pairs: Iterable[tuple[Event, T]]) -> list[list[tuple[Event, T]]]:
    """Group events, oldest first, into incidents (ours).

    The same kind on any camera, each starting within INCIDENT_SECONDS of the
    incident's last end (or start, while it runs), is one incident: one animal
    crossing three cameras is one, not three.
    """
    groups: list[list[tuple[Event, T]]] = []
    current: dict[str, tuple[list[tuple[Event, T]], float]] = {}
    for event, value in pairs:
        end = event.started_at if event.ended_at is None else event.ended_at
        found = current.get(event.kind)
        if found is not None and event.started_at - found[1] <= INCIDENT_SECONDS:
            found[0].append((event, value))
            current[event.kind] = (found[0], max(found[1], end))
        else:
            group = [(event, value)]
            groups.append(group)
            current[event.kind] = (group, end)
    return groups


def daily_cap(
    values: Iterable[tuple[float, float]],
    *,
    days: float,
    per_day: float,
) -> float:
    """Return the line above which the property has about `per_day` a day (ours).

    ``values`` are (score, how many it stands for) of the incidents of ``days``
    (each scored as its highest event; a sample's stand for more than one).
    """
    ranked = sorted(values, reverse=True)
    budget = per_day * max(days, 1.0)
    above = 0.0
    for value, stands_for in ranked:
        above += stands_for
        if above > budget:
            return value
    return -math.inf

"""Turning a learned profile into something a person can read.

Ported from Reolink Stamina's ``relevance/shapes.py`` (v1.9.2, MIT, Copyright
(c) 2026 marl1w; licence in LICENSE-reolink-stamina.txt). Changes: lengths and
gaps are spelled as the rest of our panel spells them ("About 32 s", "Still
going"); our circular rates keep what landed in each bin, so a merge adds that
and the kernel spreads it when read; our profiles keep the day of the week,
drawn Monday to Sunday rather than weekday against weekend; and
``profile_payload`` says, per value, whether it has been seen often enough to
be known there (``Model.known_after``), and never sends an infinite threshold.

The model counts labels, and the labels are keys: `~32s`, `cam|<30s`, `armed_away`. That is
right for counting — they are exact, they never collide, and two of them compare with `==` —
and unreadable on a screen. Everything here is the translation, kept in one module so the
panel and the preview cannot drift apart: a preview that renders different words from the
real thing is worse than no preview, because it is trusted.

Nothing here is interpretation in the sense the journal forbids. No value is merged, dropped
or rebucketed — only spelled.
"""

from __future__ import annotations

from collections.abc import Callable
import math
from typing import Any

from .events import _DAYS
from .rates import Categorical, CircularRate, Model, Profile
from .score import informative

# States that are the absence of a reading rather than a reading.
#
# `unknown` is what gets written for an entity that has never reported, and for every event
# older than a signal that was added later. It is genuinely a category — a signal absent for
# half the history is a fact about that half — but it is not one anybody wants to look at, and
# a chart whose largest bar is "we do not know" is a chart about the recorder.
UNINFORMATIVE = frozenset({"unknown", "unavailable", "none", ""})


# Beyond this a duration reads better in minutes. The buckets are powers of two, so this is
# the first one that is more than a minute and a half.
_MINUTE = 90


def duration_phrase(bucket: str) -> str:
    """Spell a duration bucket, which arrives as `~32s`, `open` or `instant`."""
    if bucket == "open":
        return "Still going"
    if bucket == "instant":
        return "An instant"
    if not bucket.startswith("~") or not bucket.endswith("s"):
        return bucket
    try:
        seconds = int(bucket[1:-1])
    except ValueError:
        return bucket
    if seconds < _MINUTE:
        return f"About {seconds} s"
    minutes = seconds / 60
    return f"About {minutes:.0f} min" if minutes >= 2 else "About a minute"


def predecessor_phrase(label: str, names: dict[str, str] | None = None) -> str:
    """Spell a predecessor label, which arrives as `none` or `camera|<30s`.

    "Nothing" is a category rather than an absence, and on a quiet camera it is usually the
    commonest one — so it gets a sentence rather than being left blank and looking like a bug.
    """
    if label == "none":
        return "Nothing fired first"
    camera, _, lag = label.partition("|")
    where = (names or {}).get(camera, camera)
    if not lag.startswith("<") or not lag.endswith("s"):
        return where
    try:
        seconds = int(lag[1:-1])
    except ValueError:
        return where
    within = f"{seconds} s" if seconds < 60 else f"{seconds // 60} min"
    return f"{where}, within {within}"


def state_phrase(value: str) -> str:
    """Spell a raw entity state: `armed_away` becomes "Armed away"."""
    if not value:
        return value
    words = value.replace("_", " ").strip()
    return words[:1].upper() + words[1:]


def clock_shape(rate: CircularRate) -> list[dict[str, float]]:
    """Return a circular rate as hourly points, ready to draw.

    Folded from 288 five-minute bins to 24 hours: the bins exist because a kernel needs
    somewhere fine to spread events into, not because anybody can read 288 bars. Counts are
    summed and the weight with them, so the picture is of the same data rather than of an
    average of averages.
    """
    weights = rate.weights
    return [
        {
            "hour": hour,
            "events": sum(rate.counts[hour * 12 : (hour + 1) * 12]),
            "weight": round(sum(weights[hour * 12 : (hour + 1) * 12]), 3),
        }
        for hour in range(24)
    ]


def categorical_shape(
    table: Categorical,
    *,
    spell: Callable[[str], str] = state_phrase,
    drop_unknown: bool = False,
) -> list[dict[str, Any]]:
    """Return a categorical as its values, commonest first, each spelled out.

    `drop_unknown` leaves the shares alone rather than renormalising: what is drawn is still
    each value's share of everything counted, so a signal that was missing for a third of the
    history shows bars that visibly do not fill the space. That is truer than rescaling them
    to hide it.
    """
    return [
        {
            "value": value,
            "label": spell(value),
            "events": table.counts.get(value, 0),
            "share": round(table.weights[value] / table.total, 4)
            if table.total
            else 0.0,
        }
        for value in sorted(table.weights, key=lambda item: -table.weights[item])
        if not (drop_unknown and value.lower() in UNINFORMATIVE)
    ]


def day_shape(table: Categorical) -> list[dict[str, Any]]:
    """Return the days of the week, Monday to Sunday, each with its share (ours).

    In the week's order rather than commonest first: "busiest on Fridays" is read off a week,
    and a missing day is as telling as a full one.
    """
    return [
        {
            "value": day,
            "label": day,
            "events": table.counts.get(day, 0),
            "share": round(table.weights.get(day, 0.0) / table.total, 4)
            if table.total
            else 0.0,
        }
        for day in _DAYS
    ]


def _add_rate(source: CircularRate, target: CircularRate) -> None:
    """Add one circular rate into another (ours: what landed, spread when read)."""
    for index, weight in enumerate(source.landed):
        target.landed[index] += weight
        target.counts[index] += source.counts[index]
    target.total += source.total
    target.observations += source.observations
    target._weights = None  # noqa: SLF001 - its own cache, now stale


def _merge(profiles: list[Profile]) -> Profile:
    """Add several profiles together into one.

    Sound because every table here is a weighted count, and counts add. What it is *not* is a
    profile the scorer could use: the recency weights were computed against each camera's own
    history, so the sum answers "what does this property do" and nothing about how surprising
    any one event was. Only ever built for the overview, never fed back into scoring.
    """
    total = Profile()
    for profile in profiles:
        _add_rate(profile.clock, total.clock)
        _add_rate(profile.solar, total.solar)

        pairs: list[tuple[Categorical, Categorical]] = [
            (profile.duration, total.duration),
            (profile.predecessor, total.predecessor),
            (profile.weekend, total.weekend),
            (profile.day_of_week, total.day_of_week),
        ]
        for entity_id, table in profile.signals.items():
            pairs.append((table, total.signals.setdefault(entity_id, Categorical())))

        for source_table, target_table in pairs:
            for label, weight in source_table.weights.items():
                target_table.weights[label] = (
                    target_table.weights.get(label, 0.0) + weight
                )
                target_table.counts[label] = target_table.counts.get(label, 0) + (
                    source_table.counts.get(label, 0)
                )
            target_table.total += source_table.total
            target_table.observations += source_table.observations

        total.weight += profile.weight
        total.events += profile.events
        for attribute, pick in (("first_seen", min), ("last_seen", max)):
            theirs = getattr(profile, attribute)
            mine = getattr(total, attribute)
            if theirs is not None:
                setattr(
                    total, attribute, theirs if mine is None else pick(mine, theirs)
                )
    return total


def _finite(value: float | None) -> float | None:
    """Return a number JSON can carry: none for no line, or an infinite one (ours)."""
    return None if value is None or not math.isfinite(value) else round(value, 3)


def profile_payload(
    model: Model,
    cameras: list[str],
    *,
    names: dict[str, str] | None = None,
    label: Callable[[str], str] | None = None,
) -> dict[str, Any]:
    """Return everything the given cameras have learned, shaped for the panel.

    One camera is the common case and several is the same arithmetic: the tables are weighted
    counts, so they add. Across several, *which camera* becomes a distribution of its own —
    and on a property where one camera fires ten times more than the rest, that single row is
    often the most useful thing on the screen.

    Every kind gets its own distributions, because "when does this see anything" and "when
    does it see a person" are different questions and the second is the one worth asking.

    `label` resolves an entity id to what Home Assistant calls it, and it is a function rather
    than a map on purpose. A map has to be built from *something*, and the obvious something —
    the signals configured right now — is not the same set as the signals in the history: a
    camera keeps counting an entity that has since been unpicked, and anything discovery
    failed to resolve at read time falls through it too. Both showed as bare entity ids.
    """
    named = label or (lambda entity_id: entity_id)
    kinds = sorted(
        {kind for (key, kind) in model.profiles if key in cameras},
        key=lambda kind: (
            -sum(
                model.profiles[(camera, kind)].events
                for camera in cameras
                if (camera, kind) in model.profiles
            ),
            kind,
        ),
    )
    shown = []
    for kind in kinds:
        parts = [
            model.profiles[(c, kind)] for c in cameras if (c, kind) in model.profiles
        ]
        profile = parts[0] if len(parts) == 1 else _merge(parts)
        if not profile.events:
            continue
        entry: dict[str, Any] = {
            "kind": kind,
            "events": profile.events,
            "days": round(profile.days, 1),
            "clock": clock_shape(profile.clock),
            "duration": categorical_shape(profile.duration, spell=duration_phrase),
            "predecessor": categorical_shape(
                profile.predecessor,
                spell=lambda value: predecessor_phrase(value, names),
            ),
            "day_of_week": day_shape(profile.day_of_week),
            "signals": [
                {
                    "entity_id": entity_id,
                    "label": named(entity_id),
                    "values": categorical_shape(table, drop_unknown=True),
                }
                for entity_id, table in sorted(profile.signals.items())
                # A signal that has only ever read `unknown` — a siren that never fired, an
                # entity Home Assistant has disabled — says nothing about anything and would
                # draw an empty section.
                if informative(table)
            ],
        }
        if len(cameras) > 1:
            # Which camera, as a distribution rather than as a total. Built here rather than
            # merged out of the tables above because no table holds it: a profile knows what
            # it saw, not that it was the one seeing it.
            counts = {
                camera: model.profiles[(camera, kind)].events
                for camera in cameras
                if (camera, kind) in model.profiles
                and model.profiles[(camera, kind)].events
            }
            whole = sum(counts.values())
            entry["cameras"] = [
                {
                    "value": camera,
                    "label": (names or {}).get(camera, camera),
                    "events": count,
                    "share": round(count / whole, 4) if whole else 0.0,
                }
                for camera, count in sorted(counts.items(), key=lambda item: -item[1])
            ]
        shown.append(entry)

    overall = [model.per_camera[c] for c in cameras if c in model.per_camera]
    combined = overall[0] if len(overall) == 1 else _merge(overall) if overall else None
    return {
        "threshold": _finite(model.thresholds.get(cameras[0]))
        if len(cameras) == 1
        else None,
        "known_after": model.known_after,
        "kinds": shown,
        "all": (
            None
            if combined is None
            else {"events": combined.events, "clock": clock_shape(combined.clock)}
        ),
    }

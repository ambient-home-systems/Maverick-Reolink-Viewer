"""Keeping a model built from the journal, and scoring against it (Phase 8 step 2).

Adapted from Reolink Stamina's ``relevance/analysis.py`` (v1.9.2, MIT,
Copyright (c) 2026 marl1w; licence in
LICENSE-reolink-stamina.txt). Changes: it reads our journal's
file (``journal.py``) through a read-only connection of its own, so a rebuild
never holds up the journal's writes; it streams the history per sensor rather
than loading it; the thresholds are calibrated on the last four weeks
(CALIBRATE_DAYS, at most CALIBRATE_EVENTS a camera); and it keeps no events,
only the model, and what each camera is called.

Rebuilt from the whole journal rather than updated in place, once a night: a
model only ever added to can never un-learn a constant that turned out to be
wrong, whereas one rebuilt from raw state changes picks up a changed merge
window or bucketing the very next night, across every event ever kept. It runs
in an executor thread so the event loop never waits on it. Scoring an event is
then a handful of lookups.
"""

from __future__ import annotations

from collections import Counter
from collections.abc import Callable, Iterable, Iterator
import datetime as dt
import heapq
import logging
import math
from operator import attrgetter
from pathlib import Path
import sqlite3
import time
from typing import Any

from homeassistant.core import CALLBACK_TYPE, HomeAssistant, callback
from homeassistant.helpers.event import async_track_time_change
from homeassistant.util import dt as dt_util

from .const import (
    CALIBRATE_DAYS,
    CALIBRATE_EVENTS,
    DAILY_MARKS,
    DEFAULT_SCOPE,
    DEFAULT_SENSITIVITY,
    SCOPES,
    SCORE_MIN_DAYS,
    SCORE_MIN_EVENTS,
    SENSITIVITY_FLOORS,
)
from .events import SUBJECTS, Event, SolarClock, Transition, derive_streams
from .rates import Model, build, preceded
from .score import Score, calibrate, daily_cap, ready, score

_LOGGER = logging.getLogger(__name__)

# Not on the hour: every integration in the world rebuilds something at 03:00.
_REBUILD_HOUR = 3
_REBUILD_MINUTE = 17

# How far behind a window to read, so the first event in it has a predecessor.
_LEAD_IN = 3600.0

_DAY = 86400.0

# The journal's states (journal.STATES), back to Home Assistant's.
_STATE_NAMES = {1: "on", 0: "off", -1: "unavailable", -2: "unknown"}

_CHANGES = (
    "SELECT at, state FROM changes WHERE source = ? AND at >= ? AND at < ?"
    " ORDER BY at, state"
)


def _connect(path: Path) -> sqlite3.Connection:
    """Open the journal to read only (in the executor)."""
    return sqlite3.connect(f"{path.as_uri()}?mode=ro", uri=True)


def _rows(
    db: sqlite3.Connection,
    source: int,
    sensor: tuple[str, str, str],
    *,
    since: float,
    until: float,
) -> Iterator[Transition]:
    entity_id, camera, kind = sensor
    for at, state in db.execute(
        _CHANGES, (source, int(since * 1000), int(until * 1000))
    ):
        yield Transition(
            camera=camera,
            entity_id=entity_id,
            kind=kind,
            state=_STATE_NAMES.get(state, "unknown"),
            at=at / 1000,
        )


def _groups(
    db: sqlite3.Connection, since: float, until: float
) -> list[tuple[str, str, Iterable[Transition]]]:
    """Each camera and subject's state changes in [since, until), oldest first, lazily."""
    sensors: dict[tuple[str, str], list[tuple[int, str]]] = {}
    for source, entity_id, camera, kind in db.execute(
        "SELECT id, entity_id, camera, kind FROM sources"
    ):
        subject = SUBJECTS.get(kind)
        if subject is not None:
            sensors.setdefault((camera, subject), []).append((source, entity_id))
    return [
        (
            camera,
            subject,
            heapq.merge(
                *(
                    _rows(
                        db,
                        source,
                        (entity_id, camera, subject),
                        since=since,
                        until=until,
                    )
                    for source, entity_id in members
                ),
                key=attrgetter("at"),
            ),
        )
        for (camera, subject), members in sensors.items()
    ]


def _names(db: sqlite3.Connection) -> dict[str, str]:
    """Return what each camera is called, as the journal last saw it."""
    return dict(db.execute("SELECT camera, camera_name FROM sources ORDER BY id"))


class Unusual:
    """The current model, rebuilt nightly from the journal, and scoring against it."""

    def __init__(
        self,
        hass: HomeAssistant,
        path: Path,
        *,
        hosts: Callable[[], dict[str, str]],
        sensitivity: str = DEFAULT_SENSITIVITY,
        scope: str = DEFAULT_SCOPE,
    ) -> None:
        """Prepare, without building anything yet."""
        self._hass = hass
        self._path = path
        self._hosts = hosts
        self._scope = scope
        self._sensitivity = sensitivity
        self._model = Model(scope=scope)
        self._names: dict[str, str] = {}
        self._cancel: CALLBACK_TYPE | None = None
        self._built_in = 0.0
        # Bumped when the model is dropped, so a rebuild running then is not kept.
        self._generation = 0

    @property
    def model(self) -> Model:
        """Return the model as it was last built."""
        return self._model

    @property
    def names(self) -> dict[str, str]:
        """Return what each camera is called."""
        return self._names

    def forget(self) -> None:
        """Drop the model (the journal it was built from is gone)."""
        self._model, self._names = Model(scope=self._scope), {}
        self._generation += 1

    def configure(self, *, sensitivity: str, scope: str) -> bool:
        """Take the options; True if they changed (a rebuild applies them)."""
        if sensitivity not in SENSITIVITY_FLOORS:
            sensitivity = DEFAULT_SENSITIVITY
        if scope not in SCOPES:
            scope = DEFAULT_SCOPE
        changed = (sensitivity, scope) != (self._sensitivity, self._scope)
        self._sensitivity, self._scope = sensitivity, scope
        return changed

    def async_schedule(self) -> None:
        """Rebuild nightly, at 03:17 local time."""
        self.async_cancel()

        @callback
        def _async_rebuild_now(_now: dt.datetime) -> None:
            self._hass.async_create_background_task(
                self.async_rebuild(), "reolink_viewer unusual rebuild"
            )

        self._cancel = async_track_time_change(
            self._hass,
            _async_rebuild_now,
            hour=_REBUILD_HOUR,
            minute=_REBUILD_MINUTE,
            second=0,
        )

    @callback
    def async_cancel(self) -> None:
        """Stop rebuilding."""
        if self._cancel is not None:
            self._cancel()
            self._cancel = None

    async def async_rebuild(self) -> Model:
        """Read the whole journal and learn from it again."""
        hosts = self._hosts()
        generation = self._generation
        began = time.monotonic()
        try:
            model, names = await self._hass.async_add_executor_job(
                self._learn, time.time(), self._scope, self._sensitivity, hosts
            )
        except sqlite3.Error:
            _LOGGER.warning("Cannot read the detection journal", exc_info=True)
            return self._model
        if generation != self._generation:
            return self._model  # dropped meanwhile: learning was turned off
        self._built_in = time.monotonic() - began
        self._model, self._names = model, names
        _LOGGER.debug(
            "Unusual events: model rebuilt in %.1f s, %s cameras, scope %s",
            self._built_in,
            len(model.per_camera),
            model.scope,
        )
        return model

    def _learn(
        self, now: float, scope: str, sensitivity: str, hosts: dict[str, str]
    ) -> tuple[Model, dict[str, str]]:
        """Fold the history into events and learn from them (in the executor)."""
        if not self._path.exists():
            return Model(scope=scope, built_at=now), {}
        db = _connect(self._path)
        try:
            since = now - CALIBRATE_DAYS * _DAY
            recent: Counter[str] = Counter()
            first = [now]

            def counted(events: Iterable[Event]) -> Iterator[Event]:
                for event in events:
                    if event.started_at >= since:
                        recent[event.camera] += 1
                        first[0] = min(first[0], event.started_at)
                    yield event

            clock = SolarClock(self._hass)
            history = derive_streams(self._hass, _groups(db, 0.0, now), clock=clock)
            # No house-wide signals are recorded yet: no bands to learn.
            model = build(
                counted(history), now=now, scope=scope, hosts=hosts, signal_bands={}
            )

            # The thresholds, from the last four weeks: every event walked (each has
            # its predecessor), about CALIBRATE_EVENTS a camera scored. Picked by a
            # hash of their own time, so the same events are picked each night.
            stride = {
                camera: max(1, math.ceil(count / CALIBRATE_EVENTS))
                for camera, count in recent.items()
            }

            def scored(event: Event) -> bool:
                if event.started_at < since:
                    return False
                spread = (int(event.started_at * 1000) * 2654435761) % 2**32
                return spread % stride.get(event.camera, 1) == 0

            scores = calibrate(
                model,
                derive_streams(
                    self._hass, _groups(db, since - _LEAD_IN, now), clock=clock
                ),
                floor=SENSITIVITY_FLOORS[sensitivity],
                scored=scored,
            )
            # And the property's daily cap: each score stands for as many events as
            # its camera had for each one scored.
            marking = {c: v for c, v in scores.items() if c in model.thresholds and v}
            model.cap = daily_cap(
                marking,
                weight={c: recent[c] / len(v) for c, v in marking.items()},
                days=(now - first[0]) / _DAY,
                per_day=DAILY_MARKS[sensitivity],
            )
            return model, _names(db)
        finally:
            db.close()

    def state(self, camera: str) -> dict[str, Any]:
        """Return whether a camera marks yet, and what it is short of if not."""
        profile = self._model.per_camera.get(camera)
        days = 0.0 if profile is None else profile.days
        events = 0 if profile is None else profile.events
        marking = profile is not None and ready(profile)
        model = self._model
        line = model.thresholds.get(camera)
        return {
            "marking": marking,
            "days": round(days, 1),
            "events": events,
            "needs_days": 0 if marking else max(0, math.ceil(SCORE_MIN_DAYS - days)),
            "needs_events": 0 if marking else max(0, SCORE_MIN_EVENTS - events),
            # The line a score must pass: the strictest of the camera's own, the
            # floor and the daily cap.
            "line": None
            if line is None
            else round(max(line, model.floor, model.cap), 3),
        }

    async def async_window(
        self, *, since: float, until: float, camera: str | None = None
    ) -> list[tuple[Event, Score]]:
        """Score the events in [since, until), oldest first.

        Read from the journal, not from the model: what was detected since the last
        rebuild is scored too, against the rates of the night before. The read
        reaches back past `since`, so the first event has its predecessor.

        Answers even while a camera is still learning: its scores are shown, and
        `unusual` is false for all of them.
        """
        model = self._model

        def read() -> list[tuple[Event, Score]]:
            if not self._path.exists():
                return []
            db = _connect(self._path)
            try:
                # As named now (a camera may be new since the rebuild).
                names = _names(db)
                events = derive_streams(
                    self._hass, _groups(db, since - _LEAD_IN, until)
                )
                return [
                    (event, score(event, model, previous=previous, names=names))
                    for event, previous in preceded(
                        events, scope=model.scope, hosts=model.hosts
                    )
                    if since <= event.started_at < until
                    and (camera is None or event.camera == camera)
                ]
            finally:
                db.close()

        return await self._hass.async_add_executor_job(read)

    async def async_status(
        self, cameras: Iterable[str], *, days: int = 7
    ) -> dict[str, Any]:
        """Return the model's state per camera, and its marks of the last `days`.

        With what would have been marked without the daily cap (``uncapped``),
        and what the marks were and what made each stand out, for tuning.
        """
        now = time.time()
        try:
            window = await self.async_window(since=now - days * _DAY, until=now)
        except sqlite3.Error:
            _LOGGER.warning("Cannot read the detection journal", exc_info=True)
            window = []
        model = self._model
        marks = [(event, result) for event, result in window if result.unusual]
        uncapped = sum(
            1
            for event, result in window
            if (line := model.thresholds.get(event.camera)) is not None
            and result.total > max(line, model.floor)
        )
        zone = dt_util.get_default_time_zone()
        per_day = Counter(
            dt.datetime.fromtimestamp(event.started_at, zone).date().isoformat()
            for event, _ in marks
        )
        return {
            "built": int(model.built_at * 1000) if model.built_at else None,
            "built_in_s": round(self._built_in, 2),
            "sensitivity": self._sensitivity,
            "scope": model.scope,
            "floor": model.floor,
            "cap": None if math.isinf(model.cap) else round(model.cap, 3),
            "cameras": {camera: self.state(camera) for camera in cameras},
            "days": days,
            "events": len(window),
            "marks": len(marks),
            "uncapped": uncapped,
            "per_day": dict(sorted(per_day.items())),
            "by_kind": dict(Counter(event.kind for event, _ in marks).most_common()),
            "by_reason": dict(
                Counter(
                    max(result.terms, key=attrgetter("contribution")).name
                    for _, result in marks
                    if result.terms
                ).most_common()
            ),
            "latest": [
                mark_payload(event, result) for event, result in marks[-10:][::-1]
            ],
        }


def mark_payload(event: Event, result: Score) -> dict[str, Any]:
    """Return an event and its score, as the panel shows them."""
    return {
        "camera": event.camera,
        "kind": event.kind,
        "start": int(event.started_at * 1000),
        "end": None if event.ended_at is None else int(event.ended_at * 1000),
        "score": round(result.total, 3),
        "line": None if result.threshold is None else round(result.threshold, 3),
        "unusual": result.unusual,
        "reason": result.reason,
        "terms": [
            {
                "name": term.name,
                "label": term.label,
                "subject": term.subject,
                "contribution": round(term.contribution, 3),
                "seen": term.seen,
            }
            for term in result.terms
        ],
    }

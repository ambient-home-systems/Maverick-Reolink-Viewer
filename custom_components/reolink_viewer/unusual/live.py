"""Unusual events as they happen, for automations (Phase 8 step 4).

Each detection a camera can be marked for (not motion) is scored when it
begins, against the model of the night before, and again when it ends (a
detection that lasts longer than usual can stand out only then). The first
time an incident scores as unusual:

- **An event on Home Assistant's bus**, ``reolink_viewer_unusual``, with the
  camera's device id and name, the kind, the score and its line, the sentence
  and the start: once per incident (the same kind on several cameras within a
  minute is one, as in the panel).
- **The camera's "Unusual activity" binary sensor** turns on, and off HOLD_S
  after its detection ends (at the latest EVENT_MAX_SECONDS and HOLD_S after
  it began). Every camera in the incident turns its own on.

Scored from the journal, as the panel scores it (the journal is written first,
so what fired just before counts), so a live mark and the panel's agree on
everything but the length, which is not known yet at the start.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from functools import partial
import logging
import time
from typing import Any

from homeassistant.core import CALLBACK_TYPE, HomeAssistant, callback
from homeassistant.helpers.event import async_call_later
from homeassistant.util import dt as dt_util

from .const import EVENT_MAX_SECONDS, INCIDENT_SECONDS, UNMARKED_KINDS
from .events import SUBJECTS, Event
from .score import Score

_LOGGER = logging.getLogger(__name__)

UNUSUAL_EVENT = "reolink_viewer_unusual"
# How long a camera's "Unusual activity" stays on after its detection ends.
HOLD_S = 30.0
# How far back to look for the start of the detection being scored.
_REACH_S = EVENT_MAX_SECONDS + 60.0


@dataclass(slots=True)
class Mark:
    """The last unusual detection on a camera, as its sensor shows it."""

    kind: str
    score: float
    line: float | None
    reason: str
    start: float


class UnusualWatch:
    """Scores detections as they begin and end, and says when one is unusual."""

    def __init__(
        self,
        hass: HomeAssistant,
        *,
        flush: Callable[[], Any],
        window: Callable[..., Any],
        model_built: Callable[[], bool],
        running: Callable[[], bool],
        names: Callable[[], dict[str, str]],
        fired: Callable[[dict[str, Any], float], None] | None = None,
    ) -> None:
        """Wire to the journal (flush, running) and the model (window, built).

        ``fired`` is told each event fired, with when (the learning check's log).
        """
        self._hass = hass
        self._fired = fired
        self._flush = flush
        self._window = window
        self._built = model_built
        self._running = running
        self._names = names
        # Each event already said, by (camera, kind, start).
        self._said: set[tuple[str, str, float]] = set()
        # The incident going on, per kind: until when (its latest activity).
        self._incidents: dict[str, float] = {}
        self._active: dict[str, CALLBACK_TYPE | None] = {}
        self._marks: dict[str, Mark] = {}
        self._listeners: list[Callable[[], None]] = []

    @property
    def enabled(self) -> bool:
        """Return whether it watches (learning is on)."""
        return self._running()

    def is_active(self, camera: str) -> bool:
        """Return whether the camera's unusual activity is going on."""
        return camera in self._active

    def mark(self, camera: str) -> Mark | None:
        """Return the camera's last unusual detection, if any since the start."""
        return self._marks.get(camera)

    @callback
    def listen(self, listener: Callable[[], None]) -> Callable[[], None]:
        """Call ``listener`` when a camera's activity changes; return the undo."""
        self._listeners.append(listener)
        return lambda: self._listeners.remove(listener)

    @callback
    def detected(self, camera: str, sensor_kind: str, on: bool, at: float) -> None:
        """Take a detection sensor's change (from the journal, as it records it)."""
        subject = SUBJECTS.get(sensor_kind)
        if subject is None or subject in UNMARKED_KINDS or not self._built():
            return
        self._hass.async_create_background_task(
            self.async_check(camera, subject, at, ending=not on),
            "reolink_viewer unusual live check",
        )

    async def async_check(
        self, camera: str, kind: str, at: float, *, ending: bool = False
    ) -> bool:
        """Score the camera's detection of ``kind`` going on at ``at``; True if said."""
        await self._flush()
        now = time.time()
        window: list[tuple[Event, Score]] = await self._window(
            since=at - _REACH_S, until=now + 1.0, camera=camera
        )
        found = [
            (event, result)
            for event, result in window
            if event.kind == kind
            and event.started_at <= at + 1.0
            and (event.ended_at is None or event.ended_at >= at - 1.0)
        ]
        if not found:
            return False
        event, result = found[-1]
        key = (camera, kind, event.started_at)
        if key in self._said:
            # Said already: its sensor goes off once it ends.
            if ending or event.ended_at is not None:
                self._hold(camera, event)
            self._incidents[kind] = max(
                self._incidents.get(kind, 0.0), event.ended_at or now
            )
            return False
        if not result.unusual:
            return False
        self._said.add(key)
        if len(self._said) > 1000:
            self._said = {k for k in self._said if k[2] > now - 3600}
        self._marks[camera] = Mark(
            kind=kind,
            score=result.total,
            line=result.threshold,
            reason=result.reason,
            start=event.started_at,
        )
        # The same kind on another camera within a minute of the incident's last:
        # the same incident, said already (its camera's sensor still shows it).
        last = self._incidents.get(kind)
        said = last is None or event.started_at - last > INCIDENT_SECONDS
        self._incidents[kind] = max(last or 0.0, event.ended_at or now)
        if said:
            payload = {
                "device_id": camera,
                "camera": self._names().get(camera, camera),
                "kind": kind,
                "score": round(result.total, 2),
                "line": None
                if result.threshold is None
                else round(result.threshold, 2),
                "reason": result.reason,
                "start": dt_util.utc_from_timestamp(event.started_at).isoformat(),
            }
            self._hass.bus.async_fire(UNUSUAL_EVENT, payload)
            if self._fired is not None:
                self._fired(payload, time.time())
        self._activate(camera, event)
        return said

    @callback
    def _activate(self, camera: str, event: Event) -> None:
        self._cancel(camera)
        self._active[camera] = None
        self._notify()
        if event.ended_at is not None:
            self._hold(camera, event)
        else:
            # At the latest: the longest an event lasts, and the hold.
            self._active[camera] = async_call_later(
                self._hass,
                max(0.0, event.started_at + EVENT_MAX_SECONDS + HOLD_S - time.time()),
                partial(self._end, camera),
            )

    @callback
    def _hold(self, camera: str, event: Event) -> None:
        if camera not in self._active:
            return
        self._cancel(camera)
        end = event.ended_at if event.ended_at is not None else time.time()
        self._active[camera] = async_call_later(
            self._hass,
            max(0.0, end + HOLD_S - time.time()),
            partial(self._end, camera),
        )

    @callback
    def _end(self, camera: str, _now: Any = None) -> None:
        if camera in self._active:
            del self._active[camera]
            self._notify()

    @callback
    def _cancel(self, camera: str) -> None:
        undo = self._active.get(camera)
        if undo is not None:
            undo()
            self._active[camera] = None

    @callback
    def _notify(self) -> None:
        for listener in list(self._listeners):
            listener()

    @callback
    def async_stop(self) -> None:
        """Turn every camera's activity off, and stop its timers."""
        for camera in list(self._active):
            self._cancel(camera)
        self._active.clear()
        self._notify()

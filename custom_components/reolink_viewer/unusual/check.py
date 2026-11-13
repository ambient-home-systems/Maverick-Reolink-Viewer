"""The learning check (Phase 8's hand checks, automated at the owner's ask).

Phase 8's checklist asked the owner to compare, over days, the notifications
an automation sent on ``reolink_viewer_unusual`` with the panel's marks, and
to see that each came within 2 s of its sensor. Here Home Assistant keeps the
record instead:

- **FiredLog:** every ``reolink_viewer_unusual`` the live watch fires (camera,
  kind, the detection's start, when it fired), and the automations that ran
  in the RAN_WINDOW_S after it; kept between restarts, KEEP_DAYS days.
- **compare:** each of the panel's marks since the log began matched to what
  fired for it (same kind, a camera of the incident, its start), and what
  fired for no mark.
- **listening:** the automations that listen to the event, the device
  trigger (Reolink Viewer's own device) or a camera's "Unusual activity".
"""

from __future__ import annotations

from collections.abc import Iterable
from datetime import datetime
import time
from typing import Any

from homeassistant.core import CALLBACK_TYPE, Event, HomeAssistant, callback
from homeassistant.helpers.event import async_call_later
from homeassistant.helpers.storage import Store

from .live import UNUSUAL_EVENT

STORE_KEY = "reolink_viewer.unusual_fired"
STORE_VERSION = 1
KEEP_DAYS = 90
KEEP_MAX = 2000
# The automations that run this soon after an event ran on it (s).
RAN_WINDOW_S = 10.0
# An event fired this soon after its detection began fired "at the start" (s):
# Phase 8's exit criterion.
PROMPT_S = 2.0
# A fired event and a mark's event are the same detection within this (s).
SAME_S = 2.0
AUTOMATION_TRIGGERED = "automation_triggered"


class FiredLog:
    """The unusual events fired, and the automations that ran on each."""

    def __init__(self, hass: HomeAssistant) -> None:
        """Keep the log in Home Assistant's storage."""
        self._hass = hass
        self._store: Store[dict[str, Any]] = Store(hass, STORE_VERSION, STORE_KEY)
        self._entries: list[dict[str, Any]] = []
        # When the log began (s): marks before it cannot be compared.
        self.since: float | None = None
        # The windows open on events just fired: how to close each.
        self._windows: list[CALLBACK_TYPE] = []

    async def async_load(self) -> None:
        """Read the log kept, or begin one now."""
        data = await self._store.async_load() or {}
        self._entries = [e for e in data.get("entries", []) if isinstance(e, dict)]
        since = data.get("since")
        self.since = float(since) if isinstance(since, int | float) else time.time()
        if not data:
            self._save()

    def entries(self, since: float = 0.0) -> list[dict[str, Any]]:
        """Return the events fired since `since` (s), oldest first."""
        return [dict(e) for e in self._entries if e["fired"] >= since]

    @callback
    def record(self, payload: dict[str, Any], fired: float) -> None:
        """Keep an event fired (its bus payload), and watch which automations run on it."""
        start = payload.get("start")
        started = (
            datetime.fromisoformat(start).timestamp()
            if isinstance(start, str)
            else fired
        )
        entry: dict[str, Any] = {
            "camera": payload.get("device_id"),
            "kind": payload.get("kind"),
            "start": started,
            "fired": fired,
            "automations": [],
        }
        if payload.get("quiet"):
            # Kept quiet, once per visit (v0.63.14): not fired, so nothing ran on it.
            entry["quiet"] = True
        self._entries.append(entry)
        cutoff = fired - KEEP_DAYS * 86_400
        self._entries = [e for e in self._entries if e["fired"] >= cutoff][-KEEP_MAX:]
        if entry.get("quiet"):
            self._save()
            return

        @callback
        def ran(event: Event) -> None:
            entity_id = event.data.get("entity_id")
            if isinstance(entity_id, str) and entity_id not in entry["automations"]:
                entry["automations"].append(entity_id)

        unlisten = self._hass.bus.async_listen(AUTOMATION_TRIGGERED, ran)

        @callback
        def close() -> None:
            unlisten()
            cancel()
            self._windows.remove(close)
            self._save()

        @callback
        def expired(_now: Any) -> None:
            # A callback: run in the event loop, as the store needs (a plain
            # function would be run in a worker thread).
            close()

        cancel = async_call_later(self._hass, RAN_WINDOW_S, expired)
        self._windows.append(close)
        self._save()

    @callback
    def async_stop(self) -> None:
        """Close the windows still open (the entry unloads): what ran so far is kept."""
        for close in list(self._windows):
            close()

    @callback
    def _save(self) -> None:
        self._store.async_delay_save(
            lambda: {"since": self.since, "entries": self._entries}, 5.0
        )


def compare(
    marks: Iterable[dict[str, Any]], fired: Iterable[dict[str, Any]]
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Match the panel's marks with the events fired.

    Returns each mark (``kind``, ``start`` ms, ``camera_ids``, ``members``) with
    ``fired`` (how many fired for it: one is right), ``quiet`` (how many were
    kept quiet as part of a visit said already), ``delay`` (s, from its
    detection's start to the first fired) and ``automations`` (those that ran
    on it); and the events fired for no mark (those kept quiet left out).
    """
    left = list(fired)
    matched: list[dict[str, Any]] = []
    for mark in marks:
        members = mark.get("members") or [
            {"camera": mark.get("camera"), "start": mark.get("start")}
        ]
        found = [
            event
            for event in left
            if event["kind"] == mark.get("kind")
            and any(
                member.get("camera") == event["camera"]
                and abs(member.get("start", 0) / 1000 - event["start"]) <= SAME_S
                for member in members
            )
        ]
        for event in found:
            left.remove(event)
        quiet = [e for e in found if e.get("quiet")]
        found = [e for e in found if not e.get("quiet")]
        first = min(found, key=lambda e: e["fired"]) if found else None
        matched.append(
            {
                **{
                    k: mark.get(k)
                    for k in ("kind", "start", "end", "camera", "cameras", "reason")
                },
                "fired": len(found),
                # Kept quiet as part of a visit said already (v0.63.14).
                "quiet": len(quiet),
                "delay": None
                if first is None
                else round(first["fired"] - first["start"], 1),
                "when": None if first is None else _when(first, mark),
                "automations": sorted({a for e in found for a in e["automations"]}),
            }
        )
    return matched, [e for e in left if not e.get("quiet")]


def _when(event: dict[str, Any], mark: dict[str, Any]) -> str:
    """Return when an event fired: "start", "end" or "late".

    At its detection's start (within PROMPT_S), at its end (a detection that
    stands out by its length can only then), or later than either.
    """
    if event["fired"] - event["start"] <= PROMPT_S:
        return "start"
    end = mark.get("end")
    if isinstance(end, int | float) and abs(event["fired"] - end / 1000) <= PROMPT_S:
        return "end"
    return "late"


def listening(
    hass: HomeAssistant, device_ids: Iterable[str], entity_ids: Iterable[str]
) -> dict[str, str]:
    """Return the automations listening for unusual activity, and how each listens.

    By the device trigger (Reolink Viewer's own device), a camera's "Unusual
    activity" sensor, or an event trigger on ``reolink_viewer_unusual``.
    """
    from homeassistant.components import automation  # noqa: PLC0415 - optional

    found: dict[str, str] = {}
    for device_id in device_ids:
        for entity_id in automation.automations_with_device(hass, device_id):
            found[entity_id] = "the device trigger"
    for sensor in entity_ids:
        for entity_id in automation.automations_with_entity(hass, sensor):
            found.setdefault(entity_id, "an Unusual activity sensor")
    component = hass.data.get(automation.DATA_COMPONENT)
    for entity in getattr(component, "entities", []):
        config = getattr(entity, "raw_config", None) or {}
        triggers = config.get("triggers", config.get("trigger", []))
        if not isinstance(triggers, list):
            triggers = [triggers]
        for trigger in triggers:
            if not isinstance(trigger, dict):
                continue
            types = trigger.get("event_type")
            types = types if isinstance(types, list) else [types]
            if UNUSUAL_EVENT in types:
                found.setdefault(entity.entity_id, "the event")
    return found

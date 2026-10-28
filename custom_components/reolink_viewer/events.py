"""A day's events across cameras, for the home view's and Events view's timetables.

Every camera that records gives that day (by default its camera-local today)
from the timeline service (cached, and searched through the scheduler like
any other day), and the events are merged newest first. An event is new for a Home Assistant user
until they open it or mark everything seen: from the first time a user reads
the feed, events after that moment count, so a first visit is not a wall of
new events. What each user has seen is stored, so a phone and a desktop agree.
"""

import asyncio
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
import logging
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from . import bridge, devices
from .scheduler import Priority
from .timeconv import epoch_ms, local_now
from .timeline import TimelineService

_LOGGER = logging.getLogger(__name__)

STORE_KEY = "reolink_viewer.seen"
SAVE_DELAY = 10.0
# Opened events are remembered this long (the feed shows today only).
KEEP_OPENED = timedelta(days=3)


@dataclass(slots=True)
class CameraEvent:
    """One event of one camera, in UTC epoch milliseconds."""

    camera_id: str
    start: int
    end: int
    types: list[str]
    segment: str | None
    new: bool

    def public(self) -> dict[str, Any]:
        """Return what the browser gets."""
        return {
            "camera_id": self.camera_id,
            "start": self.start,
            "end": self.end,
            "types": self.types,
            "segment": self.segment,
            "new": self.new,
        }


def event_key(camera_id: str, start: int) -> str:
    """Return how an opened event is remembered."""
    return f"{camera_id}:{start}"


class SeenStore:
    """Per Home Assistant user: since when events count as new, and which were opened."""

    def __init__(self, hass: HomeAssistant) -> None:
        """Initialize (call async_load before use)."""
        self._store: Store[dict[str, Any]] = Store(hass, 1, STORE_KEY)
        self._users: dict[str, dict[str, Any]] = {}

    async def async_load(self) -> None:
        """Load what was stored."""
        data = await self._store.async_load()
        users = data.get("users", {}) if isinstance(data, dict) else {}
        self._users = {
            str(user): {
                "since": int(marks.get("since", 0)),
                "opened": {str(k): int(v) for k, v in marks.get("opened", {}).items()},
            }
            for user, marks in users.items()
            if isinstance(marks, dict)
        }

    def _user(self, user_id: str, now: int) -> dict[str, Any]:
        marks = self._users.get(user_id)
        if marks is None:
            # A first visit: what happened before it is not new.
            marks = self._users[user_id] = {"since": now, "opened": {}}
            self._save()
        return marks

    def marks(self, user_id: str, now: int) -> tuple[int, set[str]]:
        """Return since when events are new for a user, and the events opened."""
        marks = self._user(user_id, now)
        return marks["since"], set(marks["opened"])

    def opened(self, user_id: str, camera_id: str, start: int, now: int) -> None:
        """Note that a user opened an event."""
        marks = self._user(user_id, now)
        marks["opened"][event_key(camera_id, start)] = start
        oldest = now - int(KEEP_OPENED.total_seconds() * 1000)
        marks["opened"] = {k: v for k, v in marks["opened"].items() if v >= oldest}
        self._save()

    def all_seen(self, user_id: str, now: int) -> None:
        """Nothing before now is new for a user."""
        marks = self._user(user_id, now)
        marks["since"] = now
        marks["opened"] = {}
        self._save()

    def _save(self) -> None:
        self._store.async_delay_save(lambda: {"users": self._users}, SAVE_DELAY)


async def async_recent(
    hass: HomeAssistant,
    timeline: TimelineService,
    seen: SeenStore,
    user_id: str,
    *,
    day: date | None = None,
    max_age: float = 0,
    priority: Priority = Priority.PLAYBACK,
) -> dict[str, Any]:
    """Return a day's events of every recording camera, newest first.

    ``day`` is a camera-local date; by default each camera's today. A camera
    whose search fails is listed under ``failed``; its events (if a copy of
    its day is cached) still show.
    """
    now = now_ms()
    since, opened = seen.marks(user_id, now)
    sources = devices.async_playback_sources(hass)

    async def one(source: devices.PlaybackSource) -> Any:
        wanted = day
        if wanted is None:
            host = bridge.async_get_host(hass, source.entry_id)
            wanted = local_now(host.timezone()).date()
        result, _timing = await timeline.async_day(
            source, wanted, "sub", priority, max_age=max_age
        )
        return result

    days = await asyncio.gather(*(one(s) for s in sources), return_exceptions=True)
    events: list[CameraEvent] = []
    failed: list[dict[str, Any]] = []
    for source, found in zip(sources, days, strict=True):
        if isinstance(found, BaseException):
            _LOGGER.debug("Events of %s: %s", source.name, found)
            failed.append(
                {
                    "camera_id": source.camera_id,
                    "error": str(found) or type(found).__name__,
                }
            )
            continue
        if found.events_error is not None:
            failed.append({"camera_id": source.camera_id, "error": found.events_error})
        events.extend(
            CameraEvent(
                camera_id=source.camera_id,
                start=e.start,
                end=e.end,
                types=e.types,
                segment=str(e.segment) if e.segment is not None else None,
                new=e.start > since
                and event_key(source.camera_id, e.start) not in opened,
            )
            for e in found.events
        )
    events.sort(key=lambda e: e.start, reverse=True)
    return {
        "events": [e.public() for e in events],
        "cameras": len(sources),
        "failed": failed,
        "since": since,
        "now": now,
    }


async def async_days(
    hass: HomeAssistant,
    timeline: TimelineService,
    year: int,
    month: int,
    priority: Priority = Priority.PLAYBACK,
) -> dict[str, Any]:
    """Return the days of a month that have recordings on any camera."""
    sources = devices.async_playback_sources(hass)
    results = await asyncio.gather(
        *(timeline.async_days(s, year, month, priority) for s in sources),
        return_exceptions=True,
    )
    days: set[int] = set()
    failed: list[dict[str, Any]] = []
    for source, result in zip(sources, results, strict=True):
        if isinstance(result, BaseException):
            _LOGGER.debug("Days of %s: %s", source.name, result)
            failed.append(
                {
                    "camera_id": source.camera_id,
                    "error": str(result) or type(result).__name__,
                }
            )
            continue
        days.update(result[0])
    return {"days": sorted(days), "failed": failed}


def now_ms() -> int:
    """Return the time now, in UTC epoch milliseconds."""
    return epoch_ms(datetime.now(UTC))

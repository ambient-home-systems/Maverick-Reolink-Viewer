"""The detection journal (Phase 8 step 1): what each camera saw, and when.

"Learn what is normal" (an option, off by default) records every state
change of every Reolink detection binary sensor (``devices.DETECTION_KINDS``),
so Phase 8's model can learn when each camera usually sees people, vehicles
and animals, and mark what is unusual. History collects from the day it is
turned on; a one-time import from Home Assistant's recorder (IMPORT_DAYS) gives
it a head start.

- **One camera, not one connection:** a camera on an NVR and added on its own
  has a sensor on each; both are journaled under the camera's id, and the
  model reads them as one.
- **Offline is not quiet:** ``unavailable`` and ``unknown`` are recorded too.
- **Its own SQLite file** in the config folder (JOURNAL_FILE), written in
  batches (every FLUSH_S, or FLUSH_ROWS changes) off the event loop, in
  write-ahead mode. Before Home Assistant's backup, the log is checkpointed
  into the file (backup.py).
- **It stays on this machine.** Turning the option off deletes it, and so
  does removing the integration.

Raw state changes only; events (a detection's start and end) are derived when
the model reads them (step 2).
"""

import asyncio
from collections.abc import Callable
from dataclasses import dataclass
from datetime import timedelta
import logging
from pathlib import Path
import sqlite3
import time
from typing import Any

from homeassistant.const import EVENT_STATE_CHANGED
from homeassistant.core import Event, EventStateChangedData, HomeAssistant, callback
from homeassistant.helpers.event import async_call_later, async_track_time_interval
from homeassistant.util import dt as dt_util

from .devices import DetectionSensor

_LOGGER = logging.getLogger(__name__)

JOURNAL_FILE = "reolink_viewer_journal.db"
SCHEMA_VERSION = 1
FLUSH_S = 30.0
FLUSH_ROWS = 200
# Registry changes come in bursts (at startup, say): the map is read again once.
REFRESH_S = 5.0
IMPORT_DAYS = 10
# The states kept, as small integers (a row is a few bytes).
STATES: dict[str, int] = {"off": 0, "on": 1, "unavailable": -1, "unknown": -2}

_SCHEMA = """
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sources (
    id INTEGER PRIMARY KEY,
    entity_id TEXT NOT NULL UNIQUE,
    camera TEXT NOT NULL,
    camera_name TEXT NOT NULL,
    kind TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS changes (
    source INTEGER NOT NULL REFERENCES sources (id),
    at INTEGER NOT NULL,
    state INTEGER NOT NULL,
    PRIMARY KEY (source, at, state)
) WITHOUT ROWID;
"""
# Keyed by sensor and time, with no row id or second index: about 14 bytes a
# change, so a busy month (9000 changes a day) is about 4 MB.


@dataclass(frozen=True, slots=True)
class Change:
    """One state change of a detection sensor: when (epoch ms) and to what."""

    sensor: DetectionSensor
    at: int
    state: int


def journal_path(hass: HomeAssistant) -> Path:
    """Return where the journal is kept."""
    return Path(hass.config.path(JOURNAL_FILE))


def delete_journal(path: Path) -> None:
    """Delete the journal and its write-ahead files (in the executor)."""
    for file in (
        path,
        path.with_name(f"{path.name}-wal"),
        path.with_name(f"{path.name}-shm"),
    ):
        file.unlink(missing_ok=True)


class _Store:
    """The SQLite file. Used only in the executor, one job at a time."""

    def __init__(self, path: Path) -> None:
        self._path = path
        self._db: sqlite3.Connection | None = None
        self._sources: dict[str, int] = {}

    def open(self) -> bool:
        """Open (or create) the file; True if it was just created."""
        created = not self._path.exists()
        db = sqlite3.connect(self._path, check_same_thread=False)
        db.execute("PRAGMA journal_mode=WAL")
        db.execute("PRAGMA synchronous=NORMAL")
        db.executescript(_SCHEMA)
        with db:
            db.execute(
                "INSERT OR IGNORE INTO meta VALUES ('schema', ?)",
                (str(SCHEMA_VERSION),),
            )
            db.execute(
                "INSERT OR IGNORE INTO meta VALUES ('created', ?)",
                (str(int(time.time() * 1000)),),
            )
        self._sources = dict(db.execute("SELECT entity_id, id FROM sources"))
        self._db = db
        return created

    def close(self) -> None:
        if self._db is not None:
            self._db.close()
            self._db = None

    def meta(self, key: str) -> str | None:
        assert self._db is not None
        row = self._db.execute(
            "SELECT value FROM meta WHERE key = ?", (key,)
        ).fetchone()
        return None if row is None else str(row[0])

    def set_meta(self, key: str, value: str) -> None:
        assert self._db is not None
        with self._db:
            self._db.execute("INSERT OR REPLACE INTO meta VALUES (?, ?)", (key, value))

    def _source(self, sensor: DetectionSensor) -> int:
        assert self._db is not None
        known = self._sources.get(sensor.entity_id)
        if known is not None:
            # The camera it belongs to, or its name, may have changed.
            self._db.execute(
                "UPDATE sources SET camera = ?, camera_name = ?, kind = ? WHERE id = ?"
                " AND (camera, camera_name, kind) IS NOT (?, ?, ?)",
                (
                    sensor.camera_id,
                    sensor.camera_name,
                    sensor.kind,
                    known,
                    sensor.camera_id,
                    sensor.camera_name,
                    sensor.kind,
                ),
            )
            return known
        cursor = self._db.execute(
            "INSERT INTO sources (entity_id, camera, camera_name, kind) VALUES (?, ?, ?, ?)",
            (sensor.entity_id, sensor.camera_id, sensor.camera_name, sensor.kind),
        )
        source = int(cursor.lastrowid or 0)
        self._sources[sensor.entity_id] = source
        return source

    def write(self, changes: list[Change]) -> None:
        assert self._db is not None
        with self._db:
            self._db.executemany(
                "INSERT OR IGNORE INTO changes (source, at, state) VALUES (?, ?, ?)",
                [(self._source(c.sensor), c.at, c.state) for c in changes],
            )

    def checkpoint(self) -> None:
        if self._db is not None:
            self._db.execute("PRAGMA wal_checkpoint(TRUNCATE)")

    def status(self) -> dict[str, Any]:
        assert self._db is not None
        cameras = [
            {
                "id": camera,
                "name": name,
                "changes": count,
                # A detection is a sensor turning on.
                "detections": detections,
                "first": first,
                "last": last,
            }
            for camera, name, count, detections, first, last in self._db.execute(
                "SELECT s.camera, MAX(s.camera_name), COUNT(*), SUM(c.state = 1),"
                " MIN(c.at), MAX(c.at)"
                " FROM changes c JOIN sources s ON s.id = c.source"
                " GROUP BY s.camera ORDER BY MAX(s.camera_name)"
            )
        ]
        size = sum(
            f.stat().st_size
            for f in (self._path, self._path.with_name(f"{self._path.name}-wal"))
            if f.exists()
        )
        return {
            "created": int(self.meta("created") or 0),
            "imported": int(self.meta("imported") or 0),
            "changes": sum(c["changes"] for c in cameras),
            "detections": sum(c["detections"] for c in cameras),
            "cameras": cameras,
            "bytes": size,
        }


class Journal:
    """Records the detection sensors' state changes while it runs."""

    def __init__(
        self,
        hass: HomeAssistant,
        sensors: Callable[[], dict[str, DetectionSensor]],
        path: Path | None = None,
    ) -> None:
        """Initialize (async_start begins recording)."""
        self._hass = hass
        self._sensors_of = sensors
        self._sensors: dict[str, DetectionSensor] = {}
        self._path = path or journal_path(hass)
        self._store = _Store(self._path)
        self._pending: list[Change] = []
        self._lock = asyncio.Lock()
        self._unsubs: list[Callable[[], None]] = []
        self._refresh: Callable[[], None] | None = None
        self._running = False
        # When live recording began: the recorder's history is imported up to it.
        self._started = dt_util.utcnow()
        self._import_task: asyncio.Task[None] | None = None

    @property
    def running(self) -> bool:
        """Return whether it records (the option is on)."""
        return self._running

    @property
    def path(self) -> Path:
        """Return where its file is."""
        return self._path

    async def async_start(self) -> None:
        """Open the file, start recording, and import the recorder's history once."""
        if self._running:
            return
        async with self._lock:
            await self._hass.async_add_executor_job(self._store.open)
        self.refresh_sensors()
        self._running = True
        self._started = dt_util.utcnow()
        self._unsubs.append(
            self._hass.bus.async_listen(
                EVENT_STATE_CHANGED, self._on_state, event_filter=self._wanted
            )
        )
        # New cameras and sensors, and renamed ones, as the registries change.
        for event in ("entity_registry_updated", "device_registry_updated"):
            self._unsubs.append(
                self._hass.bus.async_listen(event, self._on_registry_change)
            )
        self._unsubs.append(
            async_track_time_interval(
                self._hass, self._on_interval, timedelta(seconds=FLUSH_S)
            )
        )
        async with self._lock:
            imported = await self._hass.async_add_executor_job(
                self._store.meta, "imported"
            )
        if imported is None:
            self._import_task = self._hass.async_create_background_task(
                self._async_import(), "reolink_viewer journal import"
            )

    async def async_stop(self) -> None:
        """Write what is pending and close the file."""
        if not self._running:
            return
        self._running = False
        for unsub in self._unsubs:
            unsub()
        self._unsubs.clear()
        if self._refresh is not None:
            self._refresh()
            self._refresh = None
        if self._import_task is not None:
            self._import_task.cancel()
            await asyncio.gather(self._import_task, return_exceptions=True)
            self._import_task = None
        await self.async_flush()
        async with self._lock:
            await self._hass.async_add_executor_job(self._store.close)

    async def async_delete(self) -> None:
        """Stop, and delete the file (the option turned off)."""
        await self.async_stop()
        await self._hass.async_add_executor_job(delete_journal, self._path)

    @callback
    def refresh_sensors(self) -> None:
        """Read again which sensors there are, and their cameras."""
        try:
            self._sensors = self._sensors_of()
        except Exception:  # keep the last map rather than stop recording
            _LOGGER.debug("Cannot map the detection sensors", exc_info=True)

    @callback
    def _wanted(self, data: EventStateChangedData) -> bool:
        return data["entity_id"] in self._sensors

    @callback
    def _on_registry_change(self, _event: Event[Any]) -> None:
        if self._refresh is None:
            self._refresh = async_call_later(
                self._hass, REFRESH_S, self._on_refresh_due
            )

    @callback
    def _on_refresh_due(self, _now: Any) -> None:
        self._refresh = None
        self.refresh_sensors()

    @callback
    def _on_state(self, event: Event[EventStateChangedData]) -> None:
        sensor = self._sensors.get(event.data["entity_id"])
        new = event.data["new_state"]
        if sensor is None or new is None:
            return
        state = STATES.get(new.state)
        old = event.data["old_state"]
        # Attribute-only updates are not changes.
        if state is None or (old is not None and old.state == new.state):
            return
        self._pending.append(
            Change(sensor, int(new.last_changed.timestamp() * 1000), state)
        )
        if len(self._pending) >= FLUSH_ROWS:
            self._hass.async_create_background_task(
                self.async_flush(), "reolink_viewer journal flush"
            )

    @callback
    def _on_interval(self, _now: Any) -> None:
        if self._pending:
            self._hass.async_create_background_task(
                self.async_flush(), "reolink_viewer journal flush"
            )

    async def async_flush(self) -> None:
        """Write what is pending to the file."""
        async with self._lock:
            if not self._pending:
                return
            changes, self._pending = self._pending, []
            try:
                await self._hass.async_add_executor_job(self._store.write, changes)
            except sqlite3.Error:
                _LOGGER.warning("Cannot write the detection journal", exc_info=True)

    async def async_checkpoint(self) -> None:
        """Write what is pending, and the log into the file (before a backup)."""
        if not self._running:
            return
        await self.async_flush()
        async with self._lock:
            await self._hass.async_add_executor_job(self._store.checkpoint)

    async def async_status(self) -> dict[str, Any]:
        """Return what the journal holds: per camera, its changes and their span."""
        await self.async_flush()
        async with self._lock:
            status = await self._hass.async_add_executor_job(self._store.status)
        return {**status, "sensors": len(self._sensors)}

    async def _async_import(self) -> None:
        """Import the sensors' last IMPORT_DAYS from the recorder (a head start)."""
        imported = 0
        try:
            if "recorder" in self._hass.config.components and self._sensors:
                imported = await self._async_import_recorder()
        except Exception:  # the journal records on without it
            _LOGGER.warning("Cannot import the recorder's history", exc_info=True)
        async with self._lock:
            await self._hass.async_add_executor_job(
                self._store.set_meta, "imported", str(imported)
            )

    async def _async_import_recorder(self) -> int:
        from homeassistant.components.recorder import get_instance, history  # noqa: PLC0415

        sensors = dict(self._sensors)
        # Up to when live recording began, so nothing is written twice.
        end = self._started
        start = end - timedelta(days=IMPORT_DAYS)
        states = await get_instance(self._hass).async_add_executor_job(
            lambda: history.get_significant_states(
                self._hass,
                start,
                end,
                entity_ids=list(sensors),
                include_start_time_state=False,
                significant_changes_only=False,
                no_attributes=True,
            )
        )
        changes: list[Change] = []
        for entity_id, items in states.items():
            sensor = sensors.get(entity_id)
            last: str | None = None
            for item in items:
                state_value = (
                    item.state if not isinstance(item, dict) else item.get("state")
                )
                changed = (
                    item.last_changed
                    if not isinstance(item, dict)
                    else dt_util.parse_datetime(str(item.get("last_changed", "")))
                )
                value = STATES.get(str(state_value))
                if (
                    sensor is None
                    or value is None
                    or changed is None
                    or state_value == last
                ):
                    continue
                last = str(state_value)
                changes.append(Change(sensor, int(changed.timestamp() * 1000), value))
        # Older than anything recorded live since the start: written first.
        changes.sort(key=lambda c: c.at)
        async with self._lock:
            await self._hass.async_add_executor_job(self._store.write, changes)
        return len(changes)

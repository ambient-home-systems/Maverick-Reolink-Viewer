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
- **Motion as bursts** (the owner's choice, 2026-11-03): motion was 85% of
  the journal, mostly trees, shadows and headlights, so a motion sensor's
  "off" is held for QUIET_S and dropped with the "on" that follows within
  it: a burst runs from its first "on" to its last "off". The AI kinds
  (person, vehicle, animal, doorbell...) are kept change by change.
- **A year of it** (the owner's choice): changes older than KEEP_DAYS go,
  at start and daily. The model weighs history with a 90-day half-life.
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
# 2: motion merged into bursts (a journal of 1 is compacted once, at start).
SCHEMA_VERSION = 2
FLUSH_S = 30.0
FLUSH_ROWS = 200
# Registry changes come in bursts (at startup, say): the map is read again once.
REFRESH_S = 5.0
IMPORT_DAYS = 10
# Motion's bursts: an "off" followed by an "on" within this is one burst.
BURST_KINDS = frozenset({"motion"})
QUIET_S = 30.0
KEEP_DAYS = 365
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
# Keyed by sensor and time, with no row id or second index: about 20 bytes a
# change on disk. The owner's 7 cameras: 18,400 changes a day as they came,
# 85% of them motion (11 MB a month); with motion merged into bursts, less.

# A motion sensor's "off" followed by its "on" within the quiet time: both
# dropped, so the burst runs on (the one-time compaction of a journal of 1).
_MERGE_BURSTS = """
CREATE TEMP TABLE merged AS
WITH m AS (
    SELECT c.source, c.at, c.state,
        LEAD(c.at) OVER w AS next_at, LEAD(c.state) OVER w AS next_state
    FROM changes c
    WHERE c.source IN (SELECT id FROM sources WHERE kind IN ({kinds}))
    WINDOW w AS (PARTITION BY c.source ORDER BY c.at, c.state)
)
SELECT source, at, state FROM m
WHERE state = 0 AND next_state = 1 AND next_at - at < {quiet_ms}
UNION ALL
SELECT source, next_at, next_state FROM m
WHERE state = 0 AND next_state = 1 AND next_at - at < {quiet_ms};
DELETE FROM changes WHERE (source, at, state) IN (SELECT source, at, state FROM merged);
DROP TABLE merged;
"""


@dataclass(frozen=True, slots=True)
class Change:
    """One state change of a detection sensor: when (epoch ms) and to what."""

    sensor: DetectionSensor
    at: int
    state: int


def merge_bursts(changes: list[Change]) -> list[Change]:
    """Merge each motion sensor's changes into bursts (QUIET_S); others as they are.

    An "off" followed by an "on" of the same sensor within QUIET_S is dropped
    with that "on". ``changes`` in time order.
    """
    quiet_ms = QUIET_S * 1000
    kept: list[Change] = []
    held: dict[str, Change] = {}
    for change in changes:
        entity = change.sensor.entity_id
        if change.sensor.kind not in BURST_KINDS:
            kept.append(change)
            continue
        off = held.pop(entity, None)
        if off is not None:
            if change.state == STATES["on"] and change.at - off.at < quiet_ms:
                continue  # the burst goes on
            kept.append(off)
        if change.state == STATES["off"]:
            held[entity] = change
        else:
            kept.append(change)
    kept.extend(held.values())
    kept.sort(key=lambda c: c.at)
    return kept


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
        schema = db.execute("SELECT value FROM meta WHERE key = 'schema'").fetchone()
        if schema is not None and int(schema[0]) < 2:
            # Motion kept change by change before: merged into bursts, once.
            kinds = ", ".join(f"'{k}'" for k in sorted(BURST_KINDS))
            db.executescript(
                _MERGE_BURSTS.format(kinds=kinds, quiet_ms=int(QUIET_S * 1000))
            )
            with db:
                db.execute("UPDATE meta SET value = '2' WHERE key = 'schema'")
            db.execute("VACUUM")
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

    def prune(self, before: int) -> int:
        """Delete the changes older than ``before`` (epoch ms); return how many."""
        if self._db is None:  # a daily prune after a stop
            return 0
        with self._db:
            return self._db.execute(
                "DELETE FROM changes WHERE at < ?", (before,)
            ).rowcount

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
        # Each motion sensor's last "off", held for QUIET_S (a burst may go on).
        self._quiet: dict[str, Change] = {}
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
        self._unsubs.append(
            async_track_time_interval(self._hass, self._on_prune_due, timedelta(days=1))
        )
        await self.async_prune()
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
        # A stop ends the bursts going on.
        self._pending.extend(self._quiet.values())
        self._quiet.clear()
        await self.async_flush()
        async with self._lock:
            await self._hass.async_add_executor_job(self._store.close)

    async def async_imported(self) -> None:
        """Wait for the recorder's head start, if it is being imported."""
        task = self._import_task
        if task is not None and not task.done():
            await asyncio.gather(asyncio.shield(task), return_exceptions=True)

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
        change = Change(sensor, int(new.last_changed.timestamp() * 1000), state)
        if sensor.kind in BURST_KINDS:
            off = self._quiet.pop(sensor.entity_id, None)
            if off is not None:
                if state == STATES["on"] and change.at - off.at < QUIET_S * 1000:
                    return  # the burst goes on: neither its off nor this on
                self._pending.append(off)
            if state == STATES["off"]:
                self._quiet[sensor.entity_id] = change
                return
        self._pending.append(change)
        if len(self._pending) >= FLUSH_ROWS:
            self._hass.async_create_background_task(
                self.async_flush(), "reolink_viewer journal flush"
            )

    @callback
    def _on_interval(self, now: Any) -> None:
        # Bursts quiet for QUIET_S have ended: their offs are written.
        now_ms = int(now.timestamp() * 1000)
        for entity, off in list(self._quiet.items()):
            if now_ms - off.at >= QUIET_S * 1000:
                del self._quiet[entity]
                self._pending.append(off)
        if self._pending:
            self._hass.async_create_background_task(
                self.async_flush(), "reolink_viewer journal flush"
            )

    @callback
    def _on_prune_due(self, _now: Any) -> None:
        self._hass.async_create_background_task(
            self.async_prune(), "reolink_viewer journal prune"
        )

    async def async_prune(self) -> None:
        """Delete what is older than KEEP_DAYS."""
        before = int((dt_util.utcnow() - timedelta(days=KEEP_DAYS)).timestamp() * 1000)
        async with self._lock:
            try:
                await self._hass.async_add_executor_job(self._store.prune, before)
            except sqlite3.Error:
                _LOGGER.warning("Cannot prune the detection journal", exc_info=True)

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
        # Older than anything recorded live since the start; motion as bursts.
        changes.sort(key=lambda c: c.at)
        changes = merge_bursts(changes)
        async with self._lock:
            await self._hass.async_add_executor_job(self._store.write, changes)
        return len(changes)

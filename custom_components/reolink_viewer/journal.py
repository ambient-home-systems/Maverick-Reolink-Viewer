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
  write-ahead mode; and at once when a detection that can be marked begins or
  ends, for the live check of what is unusual (Phase 8 step 4). Before Home Assistant's backup, the log is checkpointed
  into the file (backup.py).
- **It stays on this machine.** Turning the option off deletes it, and so
  does removing the integration.

Raw state changes only; events (a detection's start and end) are derived when
the model reads them (step 2).

- **House-wide signals** (chosen in the options: anyone home, the alarm, a
  door...) are kept beside the detections, as their states changed
  (``signal_changes``), so the model can read what each stood at when a
  detection began. A number is kept at most every SIGNAL_SAMPLE_S (its latest
  reading then); a newly chosen one gets its history from the recorder, back
  to the journal's first change, once.
"""

import asyncio
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from datetime import timedelta
import json
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
from .unusual.model import model_path

_LOGGER = logging.getLogger(__name__)

JOURNAL_FILE = "reolink_viewer_journal.db"
# 2: motion merged into bursts (a journal of 1 is compacted once, at start).
SCHEMA_VERSION = 2
FLUSH_S = 30.0
FLUSH_ROWS = 200
WAL_LIMIT = 1_000_000
# Registry changes come in bursts (at startup, say): the map is read again once.
REFRESH_S = 5.0
IMPORT_DAYS = 10
# Motion's bursts: an "off" followed by an "on" within this is one burst.
BURST_KINDS = frozenset({"motion"})
QUIET_S = 30.0
KEEP_DAYS = 365
# The states kept, as small integers (a row is a few bytes).
STATES: dict[str, int] = {"off": 0, "on": 1, "unavailable": -1, "unknown": -2}
# A house-wide signal that reads a number: kept at most this often (its latest).
SIGNAL_SAMPLE_S = 300.0

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
CREATE TABLE IF NOT EXISTS signals (
    id INTEGER PRIMARY KEY,
    entity_id TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS signal_changes (
    signal INTEGER NOT NULL REFERENCES signals (id),
    at INTEGER NOT NULL,
    state TEXT NOT NULL,
    PRIMARY KEY (signal, at)
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


@dataclass(frozen=True, slots=True)
class SignalChange:
    """One house-wide signal's new state: which, when (epoch ms) and what."""

    entity_id: str
    at: int
    state: str


def _number(state: str) -> float | None:
    try:
        return float(state)
    except ValueError:
        return None


def sample_signals(changes: Iterable[SignalChange]) -> list[SignalChange]:
    """Keep a signal's numbers about every SIGNAL_SAMPLE_S, oldest first.

    The first reading of a stretch, and the latest within it; any other state
    as it came.
    """
    kept: list[SignalChange] = []
    last: dict[str, int] = {}
    held: dict[str, int] = {}
    for change in sorted(changes, key=lambda c: c.at):
        if _number(change.state) is not None:
            since = last.get(change.entity_id)
            if since is not None and change.at - since < SIGNAL_SAMPLE_S * 1000:
                # Replaces the one held in this stretch, if any.
                index = held.get(change.entity_id)
                if index is not None:
                    kept[index] = change
                else:
                    held[change.entity_id] = len(kept)
                    kept.append(change)
                continue
        held.pop(change.entity_id, None)
        last[change.entity_id] = change.at
        kept.append(change)
    return kept


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
    """Delete the journal, its write-ahead files and its model (in the executor)."""
    for file in (
        path,
        path.with_name(f"{path.name}-wal"),
        path.with_name(f"{path.name}-shm"),
        model_path(path),
    ):
        file.unlink(missing_ok=True)


class _Store:
    """The SQLite file. Used only in the executor, one job at a time."""

    def __init__(self, path: Path) -> None:
        self._path = path
        self._db: sqlite3.Connection | None = None
        self._sources: dict[str, int] = {}
        self._signals: dict[str, int] = {}

    def open(self) -> bool:
        """Open (or create) the file; True if it was just created."""
        created = not self._path.exists()
        db = sqlite3.connect(self._path, check_same_thread=False)
        db.execute("PRAGMA journal_mode=WAL")
        db.execute("PRAGMA synchronous=NORMAL")
        # The write-ahead file is cut back to this after each checkpoint; left
        # alone it stays as large as the largest write ever made (v0.47.0's
        # compaction left about 4 MB at the owner's).
        db.execute(f"PRAGMA journal_size_limit={WAL_LIMIT}")
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
        # Into the file, the write-ahead file emptied (a v0.47.0 compaction's too).
        db.execute("PRAGMA wal_checkpoint(TRUNCATE)")
        self._sources = dict(db.execute("SELECT entity_id, id FROM sources"))
        self._signals = dict(db.execute("SELECT entity_id, id FROM signals"))
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

    def _signal(self, entity_id: str) -> int:
        assert self._db is not None
        known = self._signals.get(entity_id)
        if known is not None:
            return known
        cursor = self._db.execute(
            "INSERT INTO signals (entity_id) VALUES (?)", (entity_id,)
        )
        self._signals[entity_id] = int(cursor.lastrowid or 0)
        return self._signals[entity_id]

    def write_signals(self, changes: list[SignalChange]) -> None:
        assert self._db is not None
        with self._db:
            self._db.executemany(
                "INSERT OR REPLACE INTO signal_changes (signal, at, state)"
                " VALUES (?, ?, ?)",
                [(self._signal(c.entity_id), c.at, c.state) for c in changes],
            )

    def first_change(self) -> int | None:
        """When the oldest detection change kept was (epoch ms), if any."""
        assert self._db is not None
        row = self._db.execute("SELECT MIN(at) FROM changes").fetchone()
        return None if row is None or row[0] is None else int(row[0])

    def prune(self, before: int) -> int:
        """Delete the changes older than ``before`` (epoch ms); return how many.

        Each signal keeps its last state from before then: what it stood at
        when the oldest detection kept began.
        """
        if self._db is None:  # a daily prune after a stop
            return 0
        with self._db:
            self._db.execute(
                "DELETE FROM signal_changes WHERE at < ? AND (signal, at) NOT IN"
                " (SELECT signal, MAX(at) FROM signal_changes WHERE at < ?"
                " GROUP BY signal)",
                (before, before),
            )
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
        signals = [
            {"entity_id": entity_id, "changes": count, "first": first, "last": last}
            for entity_id, count, first, last in self._db.execute(
                "SELECT s.entity_id, COUNT(*), MIN(c.at), MAX(c.at)"
                " FROM signal_changes c JOIN signals s ON s.id = c.signal"
                " GROUP BY s.entity_id ORDER BY s.entity_id"
            )
        ]
        return {
            "created": int(self.meta("created") or 0),
            "imported": int(self.meta("imported") or 0),
            "changes": sum(c["changes"] for c in cameras),
            "detections": sum(c["detections"] for c in cameras),
            "cameras": cameras,
            "signals": signals,
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
        # House-wide signals: the chosen ones; what is to be written; each
        # one's last written (epoch ms), and a number's latest, held until
        # SIGNAL_SAMPLE_S has passed since.
        self._signals: frozenset[str] = frozenset()
        self._signal_pending: list[SignalChange] = []
        self._signal_written: dict[str, int] = {}
        self._signal_held: dict[str, SignalChange] = {}
        self._signal_task: asyncio.Task[None] | None = None
        # Told of each detection change as it is recorded (camera, kind, on, when
        # in seconds): the live check for what is unusual (Phase 8 step 4).
        self._detection_listeners: list[Callable[[str, str, bool, float], None]] = []

    @property
    def running(self) -> bool:
        """Return whether it records (the option is on)."""
        return self._running

    @property
    def path(self) -> Path:
        """Return where its file is."""
        return self._path

    @callback
    def listen_detections(
        self, listener: Callable[[str, str, bool, float], None]
    ) -> Callable[[], None]:
        """Call ``listener`` with each detection change recorded; return the undo."""
        self._detection_listeners.append(listener)
        return lambda: self._detection_listeners.remove(listener)

    @property
    def signals(self) -> frozenset[str]:
        """Return the house-wide signals it records (the options' choice)."""
        return self._signals

    async def async_set_signals(self, entity_ids: Iterable[str]) -> None:
        """Record these house-wide signals (and no others) from now on.

        Each one's state now is written as of when it last changed; one newly
        chosen gets its history from the recorder, once (in the background:
        ``async_imported`` waits for it).
        """
        chosen = frozenset(entity_ids)
        added = chosen - self._signals
        self._signals = chosen
        for entity_id in added:
            self._signal_written.pop(entity_id, None)
            self._signal_held.pop(entity_id, None)
        if not self._running or not chosen:
            return
        now = [
            SignalChange(
                entity_id, int(state.last_changed.timestamp() * 1000), state.state
            )
            for entity_id in sorted(added)
            if (state := self._hass.states.get(entity_id)) is not None
        ]
        for change in now:
            self._signal_written[change.entity_id] = change.at
        self._signal_pending.extend(now)
        await self.async_flush()
        if self._signal_task is None or self._signal_task.done():
            self._signal_task = self._hass.async_create_background_task(
                self._async_import_signals(), "reolink_viewer signal import"
            )

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
        # Signals chosen before the start: their states now, and their history.
        chosen, self._signals = self._signals, frozenset()
        await self.async_set_signals(chosen)

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
        for task in (self._import_task, self._signal_task):
            if task is not None:
                task.cancel()
                await asyncio.gather(task, return_exceptions=True)
        self._import_task = self._signal_task = None
        # A stop ends the bursts going on, and writes the numbers held.
        self._pending.extend(self._quiet.values())
        self._quiet.clear()
        self._signal_pending.extend(self._signal_held.values())
        self._signal_held.clear()
        await self.async_flush()
        async with self._lock:
            await self._hass.async_add_executor_job(self._store.close)

    async def async_imported(self) -> None:
        """Wait for the recorder's head start, and signals' histories, if importing."""
        for task in (self._import_task, self._signal_task):
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
        return data["entity_id"] in self._sensors or data["entity_id"] in self._signals

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
    def _on_signal(self, event: Event[EventStateChangedData]) -> None:
        new, old = event.data["new_state"], event.data["old_state"]
        # Attribute-only updates are not changes.
        if new is None or (old is not None and old.state == new.state):
            return
        change = SignalChange(
            new.entity_id, int(new.last_changed.timestamp() * 1000), new.state
        )
        written = self._signal_written.get(change.entity_id)
        if (
            _number(change.state) is not None
            and written is not None
            and change.at - written < SIGNAL_SAMPLE_S * 1000
        ):
            self._signal_held[change.entity_id] = change
            return
        self._signal_held.pop(change.entity_id, None)
        self._signal_written[change.entity_id] = change.at
        self._signal_pending.append(change)

    @callback
    def _on_state(self, event: Event[EventStateChangedData]) -> None:
        if event.data["entity_id"] in self._signals:
            self._on_signal(event)
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
        for listener in self._detection_listeners:
            listener(
                sensor.camera_id, sensor.kind, state == STATES["on"], change.at / 1000
            )
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
        # A number held since its last was written, once SIGNAL_SAMPLE_S is up.
        for entity, held in list(self._signal_held.items()):
            if now_ms - self._signal_written.get(entity, 0) >= SIGNAL_SAMPLE_S * 1000:
                del self._signal_held[entity]
                self._signal_written[entity] = held.at
                self._signal_pending.append(held)
        if self._pending or self._signal_pending:
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
            if not self._pending and not self._signal_pending:
                return
            changes, self._pending = self._pending, []
            signals, self._signal_pending = self._signal_pending, []
            try:
                if changes:
                    await self._hass.async_add_executor_job(self._store.write, changes)
                if signals:
                    await self._hass.async_add_executor_job(
                        self._store.write_signals, signals
                    )
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

    async def _async_import_signals(self) -> None:
        """Import the chosen signals' histories not yet imported, from the recorder.

        Back to the journal's first change (as far as the recorder keeps them),
        each with its state at that time, so the detections already kept can
        be read with them. Once per signal.
        """
        async with self._lock:
            done_raw = await self._hass.async_add_executor_job(
                self._store.meta, "signals_imported"
            )
            first = await self._hass.async_add_executor_job(self._store.first_change)
        done = set(json.loads(done_raw)) if done_raw else set()
        wanted = sorted(self._signals - done)
        if not wanted:
            return
        try:
            if "recorder" in self._hass.config.components:
                end = dt_util.utcnow()
                start = (
                    dt_util.utc_from_timestamp(first / 1000)
                    if first is not None
                    else end - timedelta(days=IMPORT_DAYS)
                )
                changes = await self._async_signal_history(wanted, start, end)
                async with self._lock:
                    await self._hass.async_add_executor_job(
                        self._store.write_signals, changes
                    )
        except Exception:  # recorded from now on without it
            _LOGGER.warning("Cannot import the signals' history", exc_info=True)
        async with self._lock:
            await self._hass.async_add_executor_job(
                self._store.set_meta,
                "signals_imported",
                json.dumps(sorted(done | set(wanted))),
            )

    async def _async_signal_history(
        self, entity_ids: list[str], start: Any, end: Any
    ) -> list[SignalChange]:
        from homeassistant.components.recorder import get_instance, history  # noqa: PLC0415

        states = await get_instance(self._hass).async_add_executor_job(
            lambda: history.get_significant_states(
                self._hass,
                start,
                end,
                entity_ids=entity_ids,
                include_start_time_state=True,
                significant_changes_only=False,
                no_attributes=True,
            )
        )
        changes: list[SignalChange] = []
        for entity_id, items in states.items():
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
                if state_value is None or changed is None or state_value == last:
                    continue
                last = str(state_value)
                changes.append(
                    SignalChange(entity_id, int(changed.timestamp() * 1000), last)
                )
        return sample_signals(changes)

"""Tests for the detection journal (Phase 8 step 1, journal.py)."""

from collections.abc import AsyncGenerator
from datetime import timedelta
from itertools import pairwise
from pathlib import Path
import sqlite3
from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock, patch

from freezegun.api import FrozenDateTimeFactory
import pytest
from pytest_homeassistant_custom_component.common import (
    MockConfigEntry,
    async_fire_time_changed,
)
from pytest_homeassistant_custom_component.typing import WebSocketGenerator

from custom_components.reolink_viewer import backup, devices, journal
from custom_components.reolink_viewer.const import (
    CONF_LEARN_NORMAL,
    CONF_UNUSUAL_SIGNALS,
    DOMAIN,
)
from custom_components.reolink_viewer.journal import JOURNAL_FILE, Journal
from homeassistant.core import HomeAssistant, State
from homeassistant.helpers import entity_registry as er
from homeassistant.util import dt as dt_util

PERSON = "binary_sensor.test_reolink_cam_person"
MOTION = "binary_sensor.test_reolink_cam_motion"
SLEEP = "binary_sensor.test_reolink_cam_sleep_status"


@pytest.fixture
def config_dir(hass: HomeAssistant, tmp_path: Path) -> Path:
    """This test's own config folder (the shared one would mix tests' journals)."""
    hass.config.config_dir = str(tmp_path)
    return tmp_path


@pytest.fixture
async def learning(
    hass: HomeAssistant,
    config_dir: Path,
    reolink_host: MagicMock,
    reolink_entry: MockConfigEntry,
    viewer_entry: MockConfigEntry,
) -> AsyncGenerator[MockConfigEntry]:
    """Reolink and Reolink Viewer set up, with "Learn what is normal" on."""
    hass.config_entries.async_update_entry(
        viewer_entry, options={CONF_LEARN_NORMAL: True}
    )
    assert await hass.config_entries.async_setup(reolink_entry.entry_id)
    await hass.async_block_till_done()
    assert await hass.config_entries.async_setup(viewer_entry.entry_id)
    await hass.async_block_till_done()
    yield viewer_entry
    # Not after a test removed it.
    if hass.config_entries.async_get_entry(viewer_entry.entry_id) is not None:
        await hass.config_entries.async_unload(viewer_entry.entry_id)


def _journal(entry: MockConfigEntry) -> Journal:
    found: Journal | None = entry.runtime_data.journal
    assert found is not None
    return found


def _journal_files(config_dir: Path) -> list[Path]:
    """The journal's file and its write-ahead files, as there are."""
    return list(config_dir.glob(f"{JOURNAL_FILE}*"))


def _rows(path: Path) -> list[tuple[str, str, str, int]]:
    """(entity, camera name, kind, state) of each change, oldest first."""
    db = sqlite3.connect(path)
    try:
        return list(
            db.execute(
                "SELECT s.entity_id, s.camera_name, s.kind, c.state FROM changes c"
                " JOIN sources s ON s.id = c.source ORDER BY c.at"
            )
        )
    finally:
        db.close()


async def test_detection_sensors_are_mapped_to_their_camera(
    hass: HomeAssistant, loaded_with_entities: MockConfigEntry
) -> None:
    """Every enabled detection sensor, under its camera; not sleep."""
    sensors = devices.async_detection_sensors(hass)
    assert sensors[PERSON].kind == "person"
    # Motion has no translation key: its unique id says it.
    assert sensors[MOTION].kind == "motion"
    assert sensors["binary_sensor.test_reolink_cam_crossline_zone1_person"].kind == (
        "crossline_person"
    )
    assert SLEEP not in sensors
    assert {s.camera_name for s in sensors.values()} == {"test_reolink_cam"}
    assert len({s.camera_id for s in sensors.values()}) == 1
    er.async_get(hass).async_update_entity(
        PERSON, disabled_by=er.RegistryEntryDisabler.USER
    )
    assert PERSON not in devices.async_detection_sensors(hass)


async def test_no_journal_while_the_option_is_off(
    hass: HomeAssistant, config_dir: Path, loaded_with_entities: MockConfigEntry
) -> None:
    """Off by default: nothing is recorded, and there is no file."""
    viewer = hass.config_entries.async_entries(DOMAIN)[0]
    assert not _journal(viewer).running
    hass.states.async_set(PERSON, "on")
    await hass.async_block_till_done()
    assert not (config_dir / JOURNAL_FILE).exists()


async def test_records_each_detection_change_of_each_camera(
    hass: HomeAssistant,
    freezer: FrozenDateTimeFactory,
    config_dir: Path,
    learning: MockConfigEntry,
) -> None:
    """Changes of detection sensors, offline included; nothing else."""
    log = _journal(learning)
    assert log.running
    path = config_dir / JOURNAL_FILE
    assert path.exists()
    for state in ("off", "on", "on", "off", "unavailable", "off"):
        freezer.tick(timedelta(seconds=1))
        hass.states.async_set(PERSON, state)
    # An attribute alone changing is no change; sleep and others are not journaled.
    hass.states.async_set(PERSON, "off", {"friendly_name": "renamed"})
    hass.states.async_set(SLEEP, "on")
    await hass.async_block_till_done()
    await log.async_flush()
    rows = _rows(path)
    # Offline is not quiet: unavailable is a change too.
    assert (PERSON, "test_reolink_cam", "person", -1) in rows
    assert not any(e == SLEEP for e, *_ in rows)
    # Only real changes: on twice in a row is one.
    person = [s for e, _n, _k, s in rows if e == PERSON]
    assert person == [0, 1, 0, -1, 0]
    assert all(a != b for a, b in pairwise(person))


async def test_keeps_motion_as_bursts(
    hass: HomeAssistant,
    freezer: FrozenDateTimeFactory,
    config_dir: Path,
    reolink_host: MagicMock,
    learning: MockConfigEntry,
) -> None:
    """Motion's off and on within QUIET_S are one burst; the AI kinds stay exact."""
    # The test Reolink integration polls as the clock moves: no motion of its own.
    reolink_host.motion_detected.return_value = False
    reolink_host.ai_detected.return_value = False
    log = _journal(learning)
    path = config_dir / JOURNAL_FILE

    def step(seconds: float, entity: str, state: str) -> None:
        freezer.tick(timedelta(seconds=seconds))
        hass.states.async_set(entity, state)

    def quiet() -> None:
        # The interval that writes the bursts which ended (called here: firing
        # the clock would also make the test Reolink integration poll).
        freezer.tick(timedelta(seconds=journal.FLUSH_S))
        log._on_interval(dt_util.utcnow())

    # Motion is on to begin with. Off and back on twice within 30 s: one burst.
    step(1, MOTION, "off")
    step(10, MOTION, "on")
    step(5, MOTION, "off")
    step(20, MOTION, "on")
    step(3, MOTION, "off")
    burst_end = dt_util.utcnow()
    await hass.async_block_till_done()
    await log.async_flush()
    assert not [r for r in _rows(path) if r[0] == MOTION]  # its end is held
    quiet()
    quiet()
    await hass.async_block_till_done(wait_background_tasks=True)
    await log.async_flush()
    motion = [r for r in _rows(path) if r[0] == MOTION]
    assert [s for *_rest, s in motion] == [0]
    # A new burst, after the quiet.
    step(1, MOTION, "on")
    # Offline ends a burst at once: its off, then unavailable.
    step(2, MOTION, "off")
    step(1, MOTION, "unavailable")
    await hass.async_block_till_done()
    await log.async_flush()
    motion_states = [r[3] for r in _rows(path) if r[0] == MOTION]
    assert motion_states == [0, 1, 0, -1]
    # The person sensor, flickering, is kept change by change.
    step(1, PERSON, "off")
    step(1, PERSON, "on")
    await hass.async_block_till_done()
    await log.async_flush()
    assert [r[3] for r in _rows(path) if r[0] == PERSON][-2:] == [0, 1]
    # The first burst's end, at its own time.
    db = sqlite3.connect(path)
    try:
        (first_off,) = db.execute(
            "SELECT MIN(c.at) FROM changes c JOIN sources s ON s.id = c.source"
            " WHERE s.entity_id = ? AND c.state = 0",
            (MOTION,),
        ).fetchone()
    finally:
        db.close()
    assert first_off == int(burst_end.timestamp() * 1000)


async def test_a_journal_from_before_is_merged_once(
    hass: HomeAssistant, config_dir: Path, loaded_with_entities: MockConfigEntry
) -> None:
    """A journal of v0.46.0 (motion change by change) is compacted at its next start."""
    path = config_dir / JOURNAL_FILE
    # Ten days ago, inside the year kept.
    t = int(dt_util.utcnow().timestamp() * 1000) - 10 * 86_400_000
    db = sqlite3.connect(path)
    db.executescript(journal._SCHEMA)
    with db:
        db.execute("INSERT INTO meta VALUES ('schema', '1'), ('imported', '9')")
        db.execute(
            "INSERT INTO sources VALUES (1, ?, 'cam', 'Cam', 'motion')", (MOTION,)
        )
        db.execute(
            "INSERT INTO sources VALUES (2, ?, 'cam', 'Cam', 'person')", (PERSON,)
        )
        db.executemany(
            "INSERT INTO changes VALUES (?, ?, ?)",
            [
                # Motion: on, off and on within 30 s, off; then off and on 40 s apart.
                (1, t + 1_000, 1),
                (1, t + 5_000, 0),
                (1, t + 20_000, 1),
                (1, t + 30_000, 0),
                (1, t + 70_000, 1),
                (1, t + 80_000, 0),
                # Person: a flicker, kept.
                (2, t + 1_000, 1),
                (2, t + 2_000, 0),
                (2, t + 3_000, 1),
            ],
        )
    db.close()
    log = Journal(hass, dict, path)
    await log.async_start()
    await log.async_stop()
    db = sqlite3.connect(path)
    try:
        rows = list(
            db.execute("SELECT source, at, state FROM changes ORDER BY source, at")
        )
        schema = db.execute("SELECT value FROM meta WHERE key = 'schema'").fetchone()
    finally:
        db.close()
    assert rows == [
        (1, t + 1_000, 1),
        (1, t + 30_000, 0),
        (1, t + 70_000, 1),
        (1, t + 80_000, 0),
        (2, t + 1_000, 1),
        (2, t + 2_000, 0),
        (2, t + 3_000, 1),
    ]
    assert schema == ("2",)


async def test_keeps_a_year(
    hass: HomeAssistant,
    freezer: FrozenDateTimeFactory,
    config_dir: Path,
    learning: MockConfigEntry,
) -> None:
    """What is older than KEEP_DAYS goes, at start and each day."""
    log = _journal(learning)
    path = config_dir / JOURNAL_FILE
    now = int(dt_util.utcnow().timestamp() * 1000)
    day = 86_400_000
    db = sqlite3.connect(path)
    with db:
        db.execute(
            "INSERT OR IGNORE INTO sources VALUES (99, 'x.old', 'c', 'C', 'person')"
        )
        db.executemany(
            "INSERT INTO changes VALUES (99, ?, 1)",
            [(now - (journal.KEEP_DAYS + 1) * day,), (now - 10 * day,)],
        )
    db.close()
    await log.async_prune()
    assert [r for r in _rows(path) if r[0] == "x.old"] == [("x.old", "C", "person", 1)]
    # A year on, the daily prune takes the other.
    freezer.tick(timedelta(days=journal.KEEP_DAYS - 9))
    async_fire_time_changed(hass)
    await hass.async_block_till_done(wait_background_tasks=True)
    assert [r for r in _rows(path) if r[0] == "x.old"] == []
    # A daily prune due just as it stops does nothing.
    await log.async_stop()
    await log.async_prune()


async def test_picks_up_a_new_sensor_once_the_registry_settles(
    hass: HomeAssistant,
    freezer: FrozenDateTimeFactory,
    config_dir: Path,
    learning: MockConfigEntry,
) -> None:
    """A sensor added later is recorded after the map is read again (REFRESH_S)."""
    log = _journal(learning)
    camera = devices.async_detection_sensors(hass)[PERSON].camera_id
    entry = er.async_get(hass).async_get_or_create(
        "binary_sensor",
        "reolink",
        "new_visitor",
        device_id=camera,
        translation_key="visitor",
        suggested_object_id="test_reolink_cam_visitor",
    )
    await hass.async_block_till_done()
    hass.states.async_set(entry.entity_id, "on")
    await hass.async_block_till_done()
    await log.async_flush()
    assert not any(e == entry.entity_id for e, *_ in _rows(config_dir / JOURNAL_FILE))
    freezer.tick(timedelta(seconds=journal.REFRESH_S))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    hass.states.async_set(entry.entity_id, "off")
    await hass.async_block_till_done()
    await log.async_flush()
    assert (entry.entity_id, "test_reolink_cam", "visitor", 0) in _rows(
        config_dir / JOURNAL_FILE
    )


async def test_writes_in_batches(
    hass: HomeAssistant,
    freezer: FrozenDateTimeFactory,
    config_dir: Path,
    learning: MockConfigEntry,
) -> None:
    """Written at FLUSH_ROWS changes, or every FLUSH_S, not one by one."""
    path = config_dir / JOURNAL_FILE
    before = len(_rows(path))
    with patch.object(journal, "FLUSH_ROWS", 4):
        # The person sensor is on to begin with: off, on, off are three changes.
        for state in ("off", "on", "off"):
            freezer.tick(timedelta(seconds=1))
            hass.states.async_set(PERSON, state)
        await hass.async_block_till_done()
        assert len(_rows(path)) == before
        freezer.tick(timedelta(seconds=1))
        hass.states.async_set(PERSON, "on")
        await hass.async_block_till_done(wait_background_tasks=True)
        assert len(_rows(path)) == before + 4


async def test_says_what_it_holds(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    hass_read_only_access_token: str,
    config_dir: Path,
    learning: MockConfigEntry,
) -> None:
    """Any user can see whether it learns, and from how much, per camera."""
    hass.states.async_set(PERSON, "off")
    hass.states.async_set(PERSON, "on")
    await hass.async_block_till_done()
    client = await hass_ws_client(hass, hass_read_only_access_token)
    await client.send_json_auto_id({"type": "reolink_viewer/journal/status"})
    msg = await client.receive_json()
    assert msg["success"], msg
    status = msg["result"]
    assert status["enabled"] is True
    assert status["sensors"] == 14
    assert status["changes"] >= 2
    (camera,) = status["cameras"]
    assert camera["name"] == "test_reolink_cam"
    assert camera["changes"] == status["changes"]
    assert 1 <= camera["detections"] == status["detections"] <= camera["changes"]
    assert camera["first"] <= camera["last"]
    assert status["bytes"] > 0
    assert status["created"] > 0


async def test_turning_it_off_deletes_it_and_on_starts_again(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    config_dir: Path,
    learning: MockConfigEntry,
) -> None:
    """Off: stopped, and the file gone (its write-ahead files too)."""
    path = config_dir / JOURNAL_FILE
    hass.states.async_set(PERSON, "on")
    await hass.async_block_till_done()
    hass.config_entries.async_update_entry(learning, options={CONF_LEARN_NORMAL: False})
    await hass.async_block_till_done()
    assert not _journal(learning).running
    assert _journal_files(config_dir) == []
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "reolink_viewer/journal/status"})
    assert (await client.receive_json())["result"] == {"enabled": False}
    # On again: a new journal.
    hass.config_entries.async_update_entry(learning, options={CONF_LEARN_NORMAL: True})
    await hass.async_block_till_done()
    assert _journal(learning).running
    assert path.exists()


async def test_removing_reolink_viewer_deletes_it(
    hass: HomeAssistant, config_dir: Path, learning: MockConfigEntry
) -> None:
    """The journal goes with the integration."""
    await _journal(learning).async_flush()
    assert (config_dir / JOURNAL_FILE).exists()
    await hass.config_entries.async_remove(learning.entry_id)
    await hass.async_block_till_done()
    assert _journal_files(config_dir) == []


async def test_backup_takes_it_whole(
    hass: HomeAssistant, config_dir: Path, learning: MockConfigEntry
) -> None:
    """Before a backup: what is pending written, and the log in the file."""
    # The person sensor is on to begin with: off, on are two changes.
    for state in ("off", "on"):
        hass.states.async_set(PERSON, state)
    await hass.async_block_till_done()
    await backup.async_pre_backup(hass)
    wal = config_dir / f"{JOURNAL_FILE}-wal"
    assert not wal.exists() or wal.stat().st_size == 0
    # The main file alone (as a backup holds it) has every change.
    copy = config_dir / "copy.db"
    copy.write_bytes((config_dir / JOURNAL_FILE).read_bytes())
    assert len(_rows(copy)) >= 2
    await backup.async_post_backup(hass)


async def test_a_head_start_from_the_recorder_once(
    hass: HomeAssistant,
    config_dir: Path,
    reolink_host: MagicMock,
    reolink_entry: MockConfigEntry,
    viewer_entry: MockConfigEntry,
) -> None:
    """Turned on, it imports the last days of the sensors from the recorder, once."""
    now = dt_util.utcnow()
    asked: dict[str, Any] = {}

    def history(_hass: HomeAssistant, start: Any, end: Any, **kwargs: Any) -> Any:
        asked.update(start=start, end=end, **kwargs)
        at = now - timedelta(days=2)
        return {
            PERSON: [
                State(PERSON, "off", last_changed=at),
                State(PERSON, "on", last_changed=at + timedelta(seconds=5)),
                State(PERSON, "on", last_changed=at + timedelta(seconds=6)),
                State(PERSON, "off", last_changed=at + timedelta(seconds=20)),
            ],
            # Motion, as bursts: the off and on 10 s apart go.
            MOTION: [
                State(MOTION, "on", last_changed=at),
                State(MOTION, "off", last_changed=at + timedelta(seconds=5)),
                State(MOTION, "on", last_changed=at + timedelta(seconds=15)),
                State(MOTION, "off", last_changed=at + timedelta(seconds=25)),
            ],
            # Not a detection sensor here.
            "binary_sensor.elsewhere": [State("binary_sensor.elsewhere", "on")],
        }

    recorder = SimpleNamespace(async_add_executor_job=hass.async_add_executor_job)
    hass.config.components.add("recorder")
    hass.config_entries.async_update_entry(
        viewer_entry, options={CONF_LEARN_NORMAL: True}
    )
    with (
        patch("homeassistant.components.recorder.get_instance", return_value=recorder),
        patch(
            "homeassistant.components.recorder.history.get_significant_states",
            side_effect=history,
        ),
    ):
        assert await hass.config_entries.async_setup(reolink_entry.entry_id)
        await hass.async_block_till_done()
        assert await hass.config_entries.async_setup(viewer_entry.entry_id)
        await hass.async_block_till_done(wait_background_tasks=True)
        log = _journal(viewer_entry)
        status = await log.async_status()
        # Ten days, up to when live recording began; every sensor, every change.
        assert asked["end"] - asked["start"] == timedelta(days=journal.IMPORT_DAYS)
        assert asked["significant_changes_only"] is False
        assert PERSON in asked["entity_ids"]
        assert status["imported"] == 5
        rows = _rows(config_dir / JOURNAL_FILE)
        imported = [r for r in rows if r[0] == PERSON][:3]
        assert [s for *_rest, s in imported] == [0, 1, 0]
        assert [r[3] for r in rows if r[0] == MOTION][:2] == [1, 0]
        # Not again: the next start finds it done.
        await hass.config_entries.async_reload(viewer_entry.entry_id)
        await hass.async_block_till_done(wait_background_tasks=True)
        assert (await _journal(viewer_entry).async_status())["imported"] == 5
    hass.config.components.remove("recorder")
    await hass.config_entries.async_unload(viewer_entry.entry_id)


async def test_the_write_ahead_file_is_cut_back_at_open(
    hass: HomeAssistant, config_dir: Path
) -> None:
    """A large write-ahead file left by an earlier write (v0.47.0's compaction) is emptied."""
    path = config_dir / JOURNAL_FILE
    writer = sqlite3.connect(path)
    writer.execute("PRAGMA journal_mode=WAL")
    writer.execute("PRAGMA wal_autocheckpoint=0")
    writer.executescript(journal._SCHEMA)
    with writer:
        writer.execute("INSERT INTO meta VALUES ('schema', '2')")
        writer.execute(
            "INSERT INTO sources VALUES (1, ?, 'cam', 'Cam', 'person')", (PERSON,)
        )
        writer.executemany(
            "INSERT INTO changes VALUES (1, ?, ?)", [(n, n % 2) for n in range(200_000)]
        )
    wal = path.with_name(f"{path.name}-wal")
    assert wal.stat().st_size > 2 * journal.WAL_LIMIT
    store = journal._Store(path)
    try:
        await hass.async_add_executor_job(store.open)
        assert wal.stat().st_size == 0
    finally:
        await hass.async_add_executor_job(store.close)
        writer.close()


# ------------------------------------------------- house-wide signals (Phase 8)

ALARM = "alarm_control_panel.house"
OUTSIDE = "sensor.outside_temperature"


def _signal_rows(path: Path) -> list[tuple[str, int, str]]:
    """(entity, when, state) of each signal change kept, oldest first."""
    db = sqlite3.connect(path)
    try:
        return list(
            db.execute(
                "SELECT s.entity_id, c.at, c.state FROM signal_changes c"
                " JOIN signals s ON s.id = c.signal ORDER BY c.at, s.entity_id"
            )
        )
    finally:
        db.close()


def test_a_number_is_kept_every_few_minutes_and_states_as_they_came() -> None:
    """A thermometer reading each minute is a reading each SIGNAL_SAMPLE_S, its latest."""
    minute = 60_000
    readings = [
        journal.SignalChange(OUTSIDE, i * minute, str(10 + i)) for i in range(12)
    ]
    alarm = [
        journal.SignalChange(ALARM, 30_000, "armed_away"),
        journal.SignalChange(ALARM, 90_000, "disarmed"),
    ]
    kept = journal.sample_signals(readings + alarm)
    numbers = [(c.at // minute, c.state) for c in kept if c.entity_id == OUTSIDE]
    # The first of each five minutes, and the latest before the next.
    assert numbers == [
        (0, "10"),
        (4, "14"),
        (5, "15"),
        (9, "19"),
        (10, "20"),
        (11, "21"),
    ]
    assert [c.state for c in kept if c.entity_id == ALARM] == ["armed_away", "disarmed"]


async def test_records_the_chosen_signals_beside_the_detections(
    hass: HomeAssistant,
    freezer: FrozenDateTimeFactory,
    config_dir: Path,
    learning: MockConfigEntry,
) -> None:
    """Their states as they change, from the state they stood at when chosen."""
    log = _journal(learning)
    path = config_dir / JOURNAL_FILE
    hass.states.async_set(ALARM, "disarmed")
    hass.states.async_set(OUTSIDE, "11.5")
    hass.states.async_set("light.kitchen", "on")
    chose_at = dt_util.utcnow()
    hass.config_entries.async_update_entry(
        learning,
        options={**learning.options, CONF_UNUSUAL_SIGNALS: [ALARM, OUTSIDE]},
    )
    await hass.async_block_till_done(wait_background_tasks=True)
    assert log.signals == {ALARM, OUTSIDE}
    freezer.tick(timedelta(seconds=10))
    hass.states.async_set(ALARM, "armed_away")
    # An attribute alone is no change; the kitchen light was not chosen.
    hass.states.async_set(ALARM, "armed_away", {"friendly_name": "House alarm"})
    hass.states.async_set("light.kitchen", "off")
    # A number again within SIGNAL_SAMPLE_S is held, the latest written once it is up.
    freezer.tick(timedelta(seconds=10))
    hass.states.async_set(OUTSIDE, "11.0")
    freezer.tick(timedelta(seconds=10))
    hass.states.async_set(OUTSIDE, "10.5")
    await hass.async_block_till_done()
    await log.async_flush()
    rows = _signal_rows(path)
    assert [(e, s) for e, _, s in rows] == [
        (ALARM, "disarmed"),
        (OUTSIDE, "11.5"),
        (ALARM, "armed_away"),
    ]
    assert rows[0][1] <= int(chose_at.timestamp() * 1000)
    freezer.tick(timedelta(seconds=journal.SIGNAL_SAMPLE_S))
    async_fire_time_changed(hass)
    await hass.async_block_till_done(wait_background_tasks=True)
    await log.async_flush()
    assert [s for e, _, s in _signal_rows(path) if e == OUTSIDE] == ["11.5", "10.5"]
    status = await log.async_status()
    assert [s["entity_id"] for s in status["signals"]] == [ALARM, OUTSIDE]
    assert status["signals"][0]["changes"] == 2


async def test_a_new_signal_gets_its_history_once_and_keeps_its_last_state_a_year_on(
    hass: HomeAssistant,
    freezer: FrozenDateTimeFactory,
    config_dir: Path,
    learning: MockConfigEntry,
) -> None:
    """Back to the journal's first change, with its state then; pruned, its last before."""
    log = _journal(learning)
    path = config_dir / JOURNAL_FILE
    now = dt_util.utcnow()
    asked: list[dict[str, Any]] = []

    def history(_hass: HomeAssistant, start: Any, end: Any, **kwargs: Any) -> Any:
        asked.append({"start": start, "end": end, **kwargs})
        return {
            ALARM: [
                State(ALARM, "armed_night", last_changed=start),
                State(ALARM, "disarmed", last_changed=now - timedelta(days=1)),
            ]
        }

    # The journal's first change, two days ago.
    db = sqlite3.connect(path)
    with db:
        db.execute(
            "INSERT OR IGNORE INTO sources VALUES (99, 'x.old', 'c', 'C', 'person')"
        )
        db.execute(
            "INSERT INTO changes VALUES (99, ?, 1)",
            (int((now - timedelta(days=2)).timestamp() * 1000),),
        )
    db.close()
    recorder = SimpleNamespace(async_add_executor_job=hass.async_add_executor_job)
    hass.config.components.add("recorder")
    hass.states.async_set(ALARM, "disarmed")
    with (
        patch("homeassistant.components.recorder.get_instance", return_value=recorder),
        patch(
            "homeassistant.components.recorder.history.get_significant_states",
            side_effect=history,
        ),
    ):
        hass.config_entries.async_update_entry(
            learning, options={**learning.options, CONF_UNUSUAL_SIGNALS: [ALARM]}
        )
        await hass.async_block_till_done(wait_background_tasks=True)
        await log.async_imported()
        (call,) = asked
        assert call["entity_ids"] == [ALARM]
        assert call["include_start_time_state"] is True
        assert abs((now - call["start"]) - timedelta(days=2)) < timedelta(minutes=1)
        # (Its state when chosen is written too: the same, at the same time or after.)
        states = [s for e, _, s in _signal_rows(path)]
        assert [s for i, s in enumerate(states) if not i or states[i - 1] != s] == [
            "armed_night",
            "disarmed",
        ]
        # Not again: chosen still, it was imported.
        await hass.config_entries.async_reload(learning.entry_id)
        await hass.async_block_till_done(wait_background_tasks=True)
        assert len(asked) == 1
    hass.config.components.remove("recorder")
    # A year on, the prune keeps what it stood at before.
    log = _journal(learning)
    freezer.tick(timedelta(days=journal.KEEP_DAYS + 3))
    await log.async_prune()
    assert [s for e, _, s in _signal_rows(path)] == ["disarmed"]


async def test_tells_its_listeners_each_detection_as_it_records_it(
    hass: HomeAssistant, learning: MockConfigEntry
) -> None:
    """The live check (Phase 8 step 4) hears every detection change, as it comes."""
    log = _journal(learning)
    heard: list[tuple[str, str, bool, float]] = []
    undo = log.listen_detections(lambda *change: heard.append(change))
    hass.states.async_set(PERSON, "off")
    hass.states.async_set(PERSON, "on")
    await hass.async_block_till_done()
    undo()
    hass.states.async_set(PERSON, "off")
    await hass.async_block_till_done()
    assert [(kind, on) for _camera, kind, on, _at in heard][-1] == ("person", True)
    camera, _kind, _on, at = heard[-1]
    assert camera
    assert abs(at - dt_util.utcnow().timestamp()) < 5

"""The model kept from the journal (Phase 8 step 2, unusual/model.py).

The first group is ported from Reolink Stamina's tests/test_relevance_analysis.py
(v1.9.2, MIT, Copyright (c) 2026 marl1w; see THIRD_PARTY.md), adapted to our
journal's file and our camera states; the rest are ours.
"""

from collections.abc import AsyncGenerator, Iterable
import datetime as dt
from pathlib import Path
import sqlite3
import threading
import time
from typing import Any
from unittest.mock import AsyncMock, MagicMock, Mock, patch

import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry
from pytest_homeassistant_custom_component.typing import WebSocketGenerator

from custom_components.reolink_viewer import journal
from custom_components.reolink_viewer.const import (
    CONF_LEARN_NORMAL,
    CONF_UNUSUAL_SENSITIVITY,
)
from custom_components.reolink_viewer.journal import JOURNAL_FILE
from custom_components.reolink_viewer.unusual import const, events, model as module
from custom_components.reolink_viewer.unusual.const import SENSITIVITY_FLOORS
from custom_components.reolink_viewer.unusual.events import Event
from custom_components.reolink_viewer.unusual.model import Unusual
from custom_components.reolink_viewer.unusual.score import daily_cap, incidents
from homeassistant.core import HomeAssistant, is_callback

_CAMERA = "cam-drive"
_DAY = 86400.0
# Today, at midnight UTC: the model reads the clock.
_NOW = float(int(time.time() // _DAY) * _DAY)

# (entity, camera, camera name, the sensor's kind).
_SENSORS = {
    "binary_sensor.drive_person": (_CAMERA, "Drive", "person"),
    "binary_sensor.drive_crossline_person": (_CAMERA, "Drive", "crossline_person"),
    "binary_sensor.drive_motion": (_CAMERA, "Drive", "motion"),
    "binary_sensor.drive_animal": (_CAMERA, "Drive", "animal"),
    "binary_sensor.gate_person": ("cam-gate", "Gate", "person"),
}


def _write(path: Path, changes: Iterable[tuple[str, float, int]]) -> None:
    """Write (entity, at in seconds, state) into a journal file, as the journal does."""
    db = sqlite3.connect(path)
    try:
        db.executescript(journal._SCHEMA)
        with db:
            db.execute("INSERT OR IGNORE INTO meta VALUES ('created', '1700000000000')")
            db.executemany(
                "INSERT OR IGNORE INTO sources (id, entity_id, camera, camera_name, kind)"
                " VALUES (?, ?, ?, ?, ?)",
                [
                    (index, entity, camera, name, kind)
                    for index, (entity, (camera, name, kind)) in enumerate(
                        _SENSORS.items(), 1
                    )
                ],
            )
            ids = dict(db.execute("SELECT entity_id, id FROM sources"))
            db.executemany(
                "INSERT OR IGNORE INTO changes VALUES (?, ?, ?)",
                [(ids[entity], int(at * 1000), state) for entity, at, state in changes],
            )
        db.execute("PRAGMA journal_mode=WAL")
    finally:
        db.close()


def _pair(
    at: float, entity: str = "binary_sensor.drive_person"
) -> list[tuple[str, float, int]]:
    """Return the two changes one detection makes."""
    return [(entity, at, 1), (entity, at + 8.0, 0)]


def _busy(
    days: int = 60, hours: tuple[int, ...] = (7, 8, 18, 19)
) -> list[tuple[str, float, int]]:
    """A person at 7, 8, 18 and 19 every day."""
    rows: list[tuple[str, float, int]] = []
    for day in range(days):
        for hour in hours:
            rows.extend(_pair(_NOW - (days - day) * _DAY + hour * 3600))
    return rows


@pytest.fixture
def path(tmp_path: Path) -> Path:
    """Where this test's journal is."""
    return tmp_path / JOURNAL_FILE


def _unusual(hass: HomeAssistant, path: Path, **kwargs: Any) -> Unusual:
    return Unusual(hass, path, hosts=dict, **kwargs)


# ------------------------------------------------- ported from Stamina's analysis tests


async def test_a_model_is_built_from_what_the_journal_holds(
    hass: HomeAssistant, path: Path
) -> None:
    """The whole chain: raw changes in, merged events and learned rates out."""
    _write(path, [*_pair(_NOW - 3 * _DAY), *_pair(_NOW - 2 * _DAY)])
    model = await _unusual(hass, path).async_rebuild()

    assert model.per_camera[_CAMERA].events == 2


async def test_an_empty_journal_produces_an_empty_model(
    hass: HomeAssistant, path: Path
) -> None:
    """A fresh install has nothing to learn from, and that is not an error."""
    model = await _unusual(hass, path).async_rebuild()

    assert model.per_camera == {}


async def test_a_new_camera_is_still_learning(hass: HomeAssistant, path: Path) -> None:
    """Nothing is marked until there is something to compare against."""
    _write(path, _pair(_NOW - 3600.0))
    unusual = _unusual(hass, path)
    await unusual.async_rebuild()

    state = unusual.state(_CAMERA)
    assert state["marking"] is False
    assert state["events"] == 1
    assert state["needs_days"] == 7
    assert state["needs_events"] == 199


async def test_a_camera_nobody_has_added_is_learning(
    hass: HomeAssistant, path: Path
) -> None:
    """The panel asks about every camera it lists, including ones with no history at all."""
    unusual = _unusual(hass, path)
    await unusual.async_rebuild()

    state = unusual.state("cam-nowhere")
    assert (state["marking"], state["days"], state["events"]) == (False, 0.0, 0)


async def test_months_of_days_with_few_events_says_so(
    hass: HomeAssistant, path: Path
) -> None:
    """The third state, and the one that gets forgotten: days enough, detections not."""
    rows: list[tuple[str, float, int]] = []
    for day in range(40):
        rows.extend(_pair(_NOW - (40 - day) * _DAY))
    _write(path, rows)
    unusual = _unusual(hass, path)
    await unusual.async_rebuild()

    state = unusual.state(_CAMERA)
    assert state["needs_days"] == 0
    assert state["needs_events"] == 160


async def test_a_busy_watched_camera_marks(hass: HomeAssistant, path: Path) -> None:
    """Enough days and enough events, so it can be compared with itself."""
    _write(path, _busy())
    unusual = _unusual(hass, path)
    model = await unusual.async_rebuild()

    assert unusual.state(_CAMERA)["marking"] is True
    assert model.thresholds.get(_CAMERA) is not None
    assert unusual.state(_CAMERA)["line"] is not None


async def test_scoring_a_window_walks_the_whole_history_for_context(
    hass: HomeAssistant, path: Path
) -> None:
    """The predecessor of the first event in a window sits outside it."""
    rows = _busy()
    # A gate camera fires 90 s before the first event of the window, outside it (a
    # minute or less would make the two one incident, with the gate's predecessor).
    first = _NOW - 2 * _DAY + 7 * 3600
    rows.extend(_pair(first - 90, "binary_sensor.gate_person"))
    _write(path, rows)
    unusual = _unusual(hass, path)
    await unusual.async_rebuild()

    scored = await unusual.async_window(since=first - 1, until=_NOW)

    assert scored
    assert scored[0][0].started_at == first
    predecessor = next(t for t in scored[0][1].terms if t.name == "predecessor")
    assert predecessor.label == "82s after Gate"
    assert all("Drive" in result.reason for _, result in scored)


async def test_a_window_sees_detections_recorded_since_the_last_rebuild(
    hass: HomeAssistant, path: Path
) -> None:
    """The panel shows the journal as it stands, not as the nightly rebuild left it."""
    _write(path, _pair(_NOW - 3 * _DAY))
    unusual = _unusual(hass, path)
    await unusual.async_rebuild()

    # Recorded after the model was built, exactly as a live detection is.
    _write(path, _pair(_NOW - 60))

    scored = await unusual.async_window(since=_NOW - _DAY, until=_NOW + 1)
    assert [event.started_at for event, _ in scored] == [_NOW - 60]


async def test_rebuilding_picks_up_new_changes(hass: HomeAssistant, path: Path) -> None:
    """Nightly, from scratch, so a changed constant reaches everything already kept."""
    _write(path, _pair(_NOW - 3 * _DAY))
    unusual = _unusual(hass, path)
    assert (await unusual.async_rebuild()).per_camera[_CAMERA].events == 1

    _write(path, _pair(_NOW - 2 * _DAY))

    assert (await unusual.async_rebuild()).per_camera[_CAMERA].events == 2


def _scheduled_action(track: MagicMock) -> Any:
    """Return the action `async_schedule` registered, however it was passed."""
    call = track.call_args
    return call.kwargs["action"] if "action" in call.kwargs else call.args[1]


async def test_the_nightly_rebuild_is_scheduled_as_a_callback(
    hass: HomeAssistant, path: Path
) -> None:
    """Home Assistant decides the thread from what the action *is*.

    A `@callback` is called on the event loop; a plain lambda would be run in an
    executor thread, where starting a task is what `helpers.frame` reports.
    """
    unusual = _unusual(hass, path)
    with patch.object(module, "async_track_time_change") as track:
        unusual.async_schedule()

    assert track.call_args.kwargs == {"hour": 3, "minute": 17, "second": 0}
    action = _scheduled_action(track)
    assert is_callback(action), "the nightly rebuild would be run in an executor thread"

    with patch.object(unusual, "async_rebuild", AsyncMock()) as rebuild:
        action(dt.datetime(2026, 8, 4, 3, 17, tzinfo=dt.UTC))
        await hass.async_block_till_done()

    rebuild.assert_awaited_once()


async def test_scheduling_replaces_a_previous_registration(
    hass: HomeAssistant, path: Path
) -> None:
    """Rescheduling cancels the previous rebuild, not stacks a second on one journal."""
    unusual = _unusual(hass, path)
    with patch.object(
        module,
        "async_track_time_change",
        side_effect=[Mock(name="first"), Mock(name="second")],
    ):
        unusual.async_schedule()
        first = unusual._cancel
        unusual.async_schedule()

    assert isinstance(first, Mock)
    first.assert_called_once()
    unusual.async_cancel()
    assert unusual._cancel is None


async def test_the_rebuild_arithmetic_runs_off_the_event_loop(
    hass: HomeAssistant, path: Path
) -> None:
    """Months of a busy property is seconds of CPU, and the loop must not wait on it."""
    _write(path, _pair(_NOW - _DAY))
    threads: list[threading.Thread] = []
    real = events.derive_streams

    def _derive(*args: Any, **kwargs: Any) -> Any:
        threads.append(threading.current_thread())
        return real(*args, **kwargs)

    with patch(f"{module.__name__}.derive_streams", _derive):
        await _unusual(hass, path).async_rebuild()

    assert threads
    assert threads[0] is not threading.main_thread()


# ------------------------------------------------------------------------ ours


async def test_one_subject_s_sensors_are_one_event(
    hass: HomeAssistant, path: Path
) -> None:
    """A person and a crossline person a second apart, from the journal: one person."""
    at = _NOW - _DAY
    _write(
        path,
        [
            ("binary_sensor.drive_person", at, 1),
            ("binary_sensor.drive_crossline_person", at + 1, 1),
            ("binary_sensor.drive_person", at + 9, 0),
            ("binary_sensor.drive_crossline_person", at + 12, 0),
            ("binary_sensor.drive_motion", at, 1),
            ("binary_sensor.drive_motion", at + 30, 0),
        ],
    )
    unusual = _unusual(hass, path)
    await unusual.async_rebuild()

    scored = await unusual.async_window(since=at - 1, until=_NOW)
    assert sorted((e.kind, e.duration) for e, _ in scored) == [
        ("motion", 30.0),
        ("person", 9.0),
    ]


async def test_it_reads_while_the_journal_writes(
    hass: HomeAssistant, path: Path
) -> None:
    """Its own read-only connection: the journal's file stays open for writing."""
    _write(path, _busy(days=10))
    store = journal._Store(path)
    await hass.async_add_executor_job(store.open)
    try:
        unusual = _unusual(hass, path)
        model = await unusual.async_rebuild()
        assert model.per_camera[_CAMERA].events == 40
    finally:
        await hass.async_add_executor_job(store.close)


def test_the_daily_cap_keeps_to_about_so_many_a_day() -> None:
    """Incidents stand for as many as they were sampled from; about per_day a day pass."""
    # (score, stands for): 4 a day over 2 days is 8.
    values = [(5.0, 2), (4.0, 2), (4.5, 10), (3.0, 2), (0.5, 10)]
    assert daily_cap(values, days=2, per_day=4) == 4.5  # 2, then 10 more passes 8
    assert daily_cap(values, days=10, per_day=4) == float("-inf")


def _event_at(camera: str, kind: str, start: float, length: float = 8.0) -> Event:
    return Event(
        camera=camera,
        kind=kind,
        started_at=start,
        ended_at=start + length,
        duration=length,
        minute_of_day=0,
        solar_offset=None,
        solar_phase=None,
        is_weekend=False,
    )


def test_one_kind_on_several_cameras_within_a_minute_is_one_incident() -> None:
    """Chained from each one's end; another kind, or a longer quiet, is another."""
    pairs = [
        (_event_at("fyr", "animal", 0.0), 1),
        (_event_at("fyl", "animal", 20.0), 2),
        (_event_at("door", "person", 25.0), 3),
        (_event_at("door", "animal", 80.0), 4),  # 52 s after the last ended
        (_event_at("fyr", "animal", 200.0), 5),  # 112 s: a new one
    ]
    assert [[value for _, value in group] for group in incidents(pairs)] == [
        [1, 2, 4],
        [3],
        [5],
    ]


async def test_a_busy_property_is_kept_to_its_daily_marks(
    hass: HomeAssistant, path: Path
) -> None:
    """Many odd events a day: about the sensitivity's number are marked, no more."""
    rows = _busy(days=60, hours=(7, 8, 9, 12, 17, 18, 19, 20))
    # A person in the small hours, every night of the last 7 (fewer than 10: seen
    # 10 times, it would be known there, and nothing to mark).
    for day in range(7):
        rows.extend(_pair(_NOW - (7 - day) * _DAY + 3 * 3600 + day * 60))
    _write(path, rows)
    # (A history this regular compresses its scores, as Stamina's tests note: the
    # floor is lowered so the cap is what decides here.)
    with (
        patch.dict(const.DAILY_MARKS, {"many": 0.1}),
        patch.dict(const.SENSITIVITY_FLOORS, {"many": -1.0}),
    ):
        unusual = _unusual(hass, path, sensitivity="many")
        model = await unusual.async_rebuild()

    assert model.floor == -1.0
    status = await unusual.async_status([_CAMERA])
    assert status["sensitivity"] == "many"
    assert status["cap"] is not None
    # About 0.1 a day (3 in the four weeks), where the floor alone marks every night.
    assert status["uncapped"] >= 4
    assert 0 < status["marks"] < status["uncapped"]
    assert status["by_kind"] == {"person": status["marks"]}
    assert status["latest"][0]["reason"].startswith("Person at ")
    assert status["cameras"][_CAMERA]["marking"] is True


async def test_motion_is_learned_from_but_never_marked(
    hass: HomeAssistant, path: Path
) -> None:
    """Motion at a strange hour scores high, and is still not marked."""
    rows = _busy(days=60)
    for day in range(60):
        rows.extend(
            _pair(_NOW - (60 - day) * _DAY + 12 * 3600, "binary_sensor.drive_motion")
        )
    # At 3 am, and lasting minutes where it usually lasts seconds.
    odd = _NOW - 2 * _DAY + 3 * 3600
    rows.extend(
        [
            ("binary_sensor.drive_motion", odd, 1),
            ("binary_sensor.drive_motion", odd + 250, 0),
        ]
    )
    _write(path, rows)
    unusual = _unusual(hass, path, sensitivity="many")
    model = await unusual.async_rebuild()
    scored = await unusual.async_window(since=odd - 1, until=odd + 300)
    ((event, result),) = scored

    assert event.kind == "motion"
    assert result.threshold is not None
    assert result.total > result.threshold
    assert result.unusual is False
    # And it counts toward nothing the cap is drawn from.
    assert model.per_camera[_CAMERA].kinds.count("motion") == 61


async def test_an_incident_on_three_cameras_is_one_mark(
    hass: HomeAssistant, path: Path
) -> None:
    """One person in the night on the drive and the gate: one mark naming both."""
    rows = _busy(days=60, hours=(7, 8, 9, 12, 17, 18, 19, 20))
    for day in range(60):
        rows.extend(
            _pair(_NOW - (60 - day) * _DAY + 7 * 3600, "binary_sensor.gate_person")
        )
    night = _NOW - 1 * _DAY + 2 * 3600
    rows.extend(_pair(night))
    rows.extend(_pair(night + 20, "binary_sensor.gate_person"))
    _write(path, rows)
    unusual = _unusual(hass, path, sensitivity="many")
    await unusual.async_rebuild()

    status = await unusual.async_status([_CAMERA, "cam-gate"])
    (mark,) = [m for m in status["latest"] if m["start"] >= night * 1000]
    assert sorted(mark["cameras"]) == ["Drive", "Gate"]
    assert (
        " on Drive and Gate " in mark["reason"]
        or " on Gate and Drive " in mark["reason"]
    )
    assert status["marks"] == len(status["latest"])
    # What fired first was this same incident: not said.
    assert "after Drive" not in mark["reason"]
    assert "after Gate" not in mark["reason"]


async def test_a_rebuild_finishing_after_off_is_not_kept(
    hass: HomeAssistant, path: Path
) -> None:
    """Learning turned off while a rebuild runs: its model is dropped, not kept."""
    _write(path, _busy(days=10))
    unusual = _unusual(hass, path)
    real = unusual._learn

    def learn(*args: Any) -> Any:
        unusual.forget()  # as turning learning off does, meanwhile
        return real(*args)

    with patch.object(unusual, "_learn", learn):
        await unusual.async_rebuild()

    assert unusual.model.per_camera == {}


async def test_the_options_are_checked(hass: HomeAssistant, path: Path) -> None:
    """An unknown sensitivity or scope falls back to the default."""
    unusual = _unusual(hass, path)
    assert unusual.configure(sensitivity="many", scope="host") is True
    assert unusual.configure(sensitivity="many", scope="host") is False
    assert unusual.configure(sensitivity="lots", scope="street") is True
    assert (unusual._sensitivity, unusual._scope) == ("balanced", "together")


# ------------------------------------------------------ in Home Assistant (ours)


@pytest.fixture
async def learning(
    hass: HomeAssistant,
    tmp_path: Path,
    reolink_host: MagicMock,
    reolink_entry: MockConfigEntry,
    viewer_entry: MockConfigEntry,
) -> AsyncGenerator[MockConfigEntry]:
    """Reolink and Reolink Viewer set up, with "Learn what is normal" on."""
    hass.config.config_dir = str(tmp_path)
    hass.config_entries.async_update_entry(
        viewer_entry, options={CONF_LEARN_NORMAL: True}
    )
    assert await hass.config_entries.async_setup(reolink_entry.entry_id)
    await hass.async_block_till_done()
    assert await hass.config_entries.async_setup(viewer_entry.entry_id)
    await hass.async_block_till_done(wait_background_tasks=True)
    yield viewer_entry
    if hass.config_entries.async_get_entry(viewer_entry.entry_id) is not None:
        await hass.config_entries.async_unload(viewer_entry.entry_id)


async def test_built_once_started_and_shown_in_the_status(
    hass: HomeAssistant,
    learning: MockConfigEntry,
    hass_ws_client: WebSocketGenerator,
) -> None:
    """The model is built after the start, and the journal's status carries it."""
    unusual = learning.runtime_data.unusual
    assert unusual is not None
    assert unusual.model.built_at > 0
    # (The test camera sees a person to begin with.)
    hass.states.async_set("binary_sensor.test_reolink_cam_person", "off")
    hass.states.async_set("binary_sensor.test_reolink_cam_person", "on")
    await hass.async_block_till_done()
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "reolink_viewer/journal/status"})
    result = (await client.receive_json())["result"]
    status = result["unusual"]
    assert status["sensitivity"] == "balanced"
    assert status["scope"] == "together"
    (camera,) = result["cameras"]
    assert status["cameras"][camera["id"]]["marking"] is False
    assert status["cameras"][camera["id"]]["needs_days"] == 7


async def test_events_are_scored_on_request(
    hass: HomeAssistant,
    learning: MockConfigEntry,
    hass_ws_client: WebSocketGenerator,
) -> None:
    """unusual/events: the journal's events in a window, each with its sentence."""
    hass.states.async_set("binary_sensor.test_reolink_cam_person", "off")
    await hass.async_block_till_done()
    hass.states.async_set("binary_sensor.test_reolink_cam_person", "on")
    await hass.async_block_till_done()
    hass.states.async_set("binary_sensor.test_reolink_cam_person", "off")
    await hass.async_block_till_done()
    now = int(time.time() * 1000)
    client = await hass_ws_client(hass)
    await client.send_json_auto_id(
        {
            "type": "reolink_viewer/unusual/events",
            "since": now - 60_000,
            "until": now + 1,
        }
    )
    events = (await client.receive_json())["result"]["events"]
    person = next(e for e in events if e["kind"] == "person")
    assert isinstance(person["incident"], int)
    assert person["unusual"] is False  # still learning
    assert person["line"] is None
    assert "test_reolink_cam" in person["reason"]
    assert {t["name"] for t in person["terms"]} >= {"clock", "duration", "predecessor"}

    await client.send_json_auto_id(
        {
            "type": "reolink_viewer/unusual/events",
            "since": now - 60_000,
            "until": now + 1,
            "unusual_only": True,
        }
    )
    assert (await client.receive_json())["result"]["events"] == []

    # At most a week at a time.
    await client.send_json_auto_id(
        {"type": "reolink_viewer/unusual/events", "since": 0, "until": now}
    )
    assert (await client.receive_json())["error"]["code"] == "invalid_format"


async def test_a_new_sensitivity_rebuilds_and_off_forgets(
    hass: HomeAssistant,
    learning: MockConfigEntry,
    hass_ws_client: WebSocketGenerator,
) -> None:
    """Options apply at once: a rebuild at the new floor; off drops the model."""
    unusual = learning.runtime_data.unusual
    assert unusual is not None
    hass.config_entries.async_update_entry(
        learning, options={CONF_LEARN_NORMAL: True, CONF_UNUSUAL_SENSITIVITY: "many"}
    )
    await hass.async_block_till_done(wait_background_tasks=True)
    assert unusual.model.floor == SENSITIVITY_FLOORS["many"]

    hass.config_entries.async_update_entry(learning, options={CONF_LEARN_NORMAL: False})
    await hass.async_block_till_done(wait_background_tasks=True)
    assert unusual.model.built_at == 0
    client = await hass_ws_client(hass)
    await client.send_json_auto_id(
        {"type": "reolink_viewer/unusual/events", "since": 0, "until": 1000}
    )
    assert (await client.receive_json())["error"]["code"] == "not_learning"


# ------------------------------------------- the model kept between restarts (ours)


async def test_a_saved_model_scores_as_the_one_built(
    hass: HomeAssistant, path: Path
) -> None:
    """Saved after the build, taken back at the next start: the same scores."""
    _write(path, _busy(days=60))
    built = _unusual(hass, path, version="1")
    await built.async_rebuild()
    assert module.model_path(path).exists()

    loaded = _unusual(hass, path, version="1")
    assert await loaded.async_load() is True
    since = _NOW - 2 * _DAY
    first = await built.async_window(since=since, until=_NOW)
    again = await loaded.async_window(since=since, until=_NOW)
    # (Saved to six decimals.)
    assert [r.total for _, r in again] == pytest.approx([r.total for _, r in first])
    assert [(r.threshold, r.unusual, r.reason) for _, r in again] == [
        (r.threshold, r.unusual, r.reason) for _, r in first
    ]
    assert first[0][1].threshold is not None
    assert loaded.state(_CAMERA) == built.state(_CAMERA)
    assert (await loaded.async_status([_CAMERA]))["built_in_s"] == (
        await built.async_status([_CAMERA])
    )["built_in_s"]


async def test_a_saved_model_is_learned_again_when_it_no_longer_holds(
    hass: HomeAssistant, path: Path
) -> None:
    """Another version, other options, a day old, or another journal: not taken."""
    _write(path, _busy(days=30))
    await _unusual(hass, path, version="1").async_rebuild()

    assert await _unusual(hass, path, version="2").async_load() is False
    assert (
        await _unusual(hass, path, version="1", sensitivity="few").async_load() is False
    )
    assert await _unusual(hass, path, version="1", scope="camera").async_load() is False
    later = time.time() + _DAY + 60
    assert await _unusual(hass, path, version="1").async_load(now=later) is False
    # A new journal (turned off and on again): not the model of the old one.
    db = sqlite3.connect(path)
    with db:
        db.execute("UPDATE meta SET value = '1' WHERE key = 'created'")
    db.close()
    assert await _unusual(hass, path, version="1").async_load() is False


async def test_deleting_the_journal_deletes_its_model(
    hass: HomeAssistant, path: Path
) -> None:
    """The model says when people are seen too: it goes with the journal."""
    _write(path, _busy(days=10))
    await _unusual(hass, path).async_rebuild()
    assert module.model_path(path).exists()

    await hass.async_add_executor_job(journal.delete_journal, path)

    assert not module.model_path(path).exists()


async def test_a_restart_takes_the_saved_model(
    hass: HomeAssistant,
    learning: MockConfigEntry,
) -> None:
    """Reloaded with nothing changed: the saved model, not a new build."""
    unusual = learning.runtime_data.unusual
    assert unusual is not None
    built_at = unusual.model.built_at
    assert built_at > 0
    assert await hass.config_entries.async_unload(learning.entry_id)
    with patch.object(Unusual, "async_rebuild", AsyncMock()) as rebuild:
        assert await hass.config_entries.async_setup(learning.entry_id)
        await hass.async_block_till_done(wait_background_tasks=True)
    rebuild.assert_not_awaited()
    again = learning.runtime_data.unusual
    assert again is not None
    assert again.model.built_at == built_at

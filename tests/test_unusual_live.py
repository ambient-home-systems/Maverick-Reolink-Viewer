"""Tests for unusual events as they happen (Phase 8 step 4: unusual/live.py,
binary_sensor.py and device_trigger.py)."""

from collections.abc import AsyncGenerator
from datetime import timedelta
from pathlib import Path
import time
from typing import Any
from unittest.mock import MagicMock

from freezegun.api import FrozenDateTimeFactory
import pytest
from pytest_homeassistant_custom_component.common import (
    MockConfigEntry,
    async_capture_events,
    async_fire_time_changed,
    async_get_device_automations,
)

from custom_components.reolink_viewer.const import CONF_LEARN_NORMAL, DOMAIN
from custom_components.reolink_viewer.unusual.events import Event
from custom_components.reolink_viewer.unusual.live import (
    HOLD_S,
    UNUSUAL_EVENT,
    UnusualWatch,
)
from custom_components.reolink_viewer.unusual.score import Score
from homeassistant.components.device_automation import DeviceAutomationType
from homeassistant.const import STATE_OFF, STATE_ON, STATE_UNAVAILABLE
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr, entity_registry as er
from homeassistant.setup import async_setup_component


def _event(camera: str, kind: str, start: float, end: float | None) -> Event:
    return Event(
        camera=camera,
        kind=kind,
        started_at=start,
        ended_at=end,
        duration=None if end is None else end - start,
        minute_of_day=0,
        solar_offset=None,
        solar_phase=None,
        is_weekend=False,
        day_of_week="Wed",
    )


def _score(
    unusual: bool, reason: str = "Person at 03:12 on Drive — seen once."
) -> Score:
    return Score(
        total=2.5 if unusual else -1.0,
        threshold=0.0,
        unusual=unusual,
        terms=(),
        reason=reason,
    )


class _Journal:
    """What the watch reads: the window of scored events, as the model would."""

    def __init__(self) -> None:
        self.flushed = 0
        self.window: list[tuple[Event, Score]] = []
        self.asked: list[dict[str, Any]] = []
        self.built = True

    async def flush(self) -> None:
        self.flushed += 1

    async def read(self, **kwargs: Any) -> list[tuple[Event, Score]]:
        self.asked.append(kwargs)
        camera = kwargs.get("camera")
        return [(e, s) for e, s in self.window if camera is None or e.camera == camera]


def _watch(hass: HomeAssistant, journal: _Journal) -> UnusualWatch:
    return UnusualWatch(
        hass,
        flush=journal.flush,
        window=journal.read,
        model_built=lambda: journal.built,
        running=lambda: True,
        names=lambda: {"cam-drive": "Drive", "cam-gate": "Gate"},
    )


async def test_an_unusual_detection_is_said_once_as_it_begins(
    hass: HomeAssistant, freezer: FrozenDateTimeFactory
) -> None:
    """The event on the bus, the camera's activity on until HOLD_S after it ends."""
    journal = _Journal()
    watch = _watch(hass, journal)
    fired = async_capture_events(hass, UNUSUAL_EVENT)
    changes: list[bool] = []
    watch.listen(lambda: changes.append(watch.is_active("cam-drive")))
    now = time.time()
    journal.window = [(_event("cam-drive", "person", now - 1, None), _score(True))]

    watch.detected("cam-drive", "crossline_person", True, now - 1)
    await hass.async_block_till_done()

    assert journal.flushed == 1, (
        "the journal is written first: what fired before counts"
    )
    assert journal.asked[0]["camera"] == "cam-drive"
    (said,) = fired
    assert said.data["device_id"] == "cam-drive"
    assert said.data["camera"] == "Drive"
    assert said.data["kind"] == "person"
    assert said.data["score"] == 2.5
    assert said.data["line"] == 0.0
    assert said.data["reason"].startswith("Person at 03:12")
    assert said.data["start"].endswith("+00:00")
    assert watch.is_active("cam-drive")
    mark = watch.mark("cam-drive")
    assert mark is not None
    assert mark.kind == "person"

    # The same detection again (another of its sensors): not said twice.
    watch.detected("cam-drive", "person", True, now)
    await hass.async_block_till_done()
    assert len(fired) == 1
    # It ends: on for HOLD_S more, then off.
    journal.window = [(_event("cam-drive", "person", now - 1, now + 10), _score(True))]
    watch.detected("cam-drive", "person", False, now + 10)
    await hass.async_block_till_done()
    assert watch.is_active("cam-drive")
    freezer.tick(timedelta(seconds=10 + HOLD_S + 1))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    assert not watch.is_active("cam-drive")
    assert changes == [True, False]
    watch.async_stop()


async def test_one_incident_is_said_once_and_lights_every_camera_in_it(
    hass: HomeAssistant,
) -> None:
    """A person on the drive, then at the gate 20 s on: one event, both cameras on."""
    journal = _Journal()
    watch = _watch(hass, journal)
    fired = async_capture_events(hass, UNUSUAL_EVENT)
    now = time.time()
    journal.window = [
        (_event("cam-drive", "person", now - 30, None), _score(True)),
        (_event("cam-gate", "person", now - 10, None), _score(True)),
    ]
    assert await watch.async_check("cam-drive", "person", now - 30)
    assert not await watch.async_check("cam-gate", "person", now - 10)
    assert len(fired) == 1
    assert watch.is_active("cam-drive")
    assert watch.is_active("cam-gate")
    # A person an hour on is another incident.
    journal.window = [(_event("cam-gate", "person", now + 3600, None), _score(True))]
    assert await watch.async_check("cam-gate", "person", now + 3600)
    assert len(fired) == 2
    watch.async_stop()


async def test_lingering_is_said_when_it_ends_and_ordinary_is_never_said(
    hass: HomeAssistant,
) -> None:
    """Usual as it began, unusual once it lasted: said at the end; the usual never."""
    journal = _Journal()
    watch = _watch(hass, journal)
    fired = async_capture_events(hass, UNUSUAL_EVENT)
    now = time.time()
    journal.window = [(_event("cam-drive", "person", now - 5, None), _score(False))]
    assert not await watch.async_check("cam-drive", "person", now - 5)
    assert not fired
    journal.window = [(_event("cam-drive", "person", now - 300, now), _score(True))]
    assert await watch.async_check("cam-drive", "person", now, ending=True)
    assert len(fired) == 1
    assert watch.is_active("cam-drive")
    # Motion is never marked; nothing is said before the first model.
    watch.detected("cam-drive", "motion", True, now)
    journal.built = False
    watch.detected("cam-drive", "person", True, now)
    await hass.async_block_till_done()
    assert journal.flushed == 2
    watch.async_stop()
    assert not watch.is_active("cam-drive")


# ------------------------------------------------- the sensor and the trigger


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


def _sensor(hass: HomeAssistant) -> er.RegistryEntry:
    return next(
        e
        for e in er.async_get(hass).entities.values()
        if e.platform == DOMAIN and e.unique_id.endswith("_unusual_activity")
    )


async def test_each_camera_has_an_unusual_activity_sensor_and_trigger(
    hass: HomeAssistant, learning: MockConfigEntry
) -> None:
    """On Reolink Viewer's own device; off until something unusual; and its trigger."""
    sensor = _sensor(hass)
    camera = sensor.unique_id.removesuffix("_unusual_activity")
    cameras = dr.async_get(hass)
    assert cameras.async_get(camera) is not None, "the sensor names a camera's device"
    assert sensor.device_id is not None
    ours = cameras.async_get(sensor.device_id)
    assert ours is not None
    assert ours.config_entry_id == learning.entry_id
    assert ours.name == "Reolink Viewer"
    entity_id = sensor.entity_id
    state = hass.states.get(entity_id)
    assert state is not None
    assert state.state == STATE_OFF
    assert state.attributes["camera_id"] == camera
    assert state.attributes["friendly_name"].endswith("unusual activity")

    watch = learning.runtime_data.watch
    now = time.time()
    unusual = learning.runtime_data.unusual

    async def window(**_kwargs: Any) -> list[tuple[Event, Score]]:
        return [(_event(camera, "person", now, None), _score(True))]

    watch._window = window  # the model's answer, as a test sets it
    unusual.model.built_at = now
    assert await watch.async_check(camera, "person", now)
    await hass.async_block_till_done()
    state = hass.states.get(entity_id)
    assert state is not None
    assert state.state == STATE_ON
    assert state.attributes["kind"] == "person"
    assert state.attributes["reason"].startswith("Person at 03:12")

    triggers = await async_get_device_automations(
        hass, DeviceAutomationType.TRIGGER, ours.id
    )
    mine = [t for t in triggers if t["domain"] == DOMAIN]
    assert mine == [
        {
            "platform": "device",
            "domain": DOMAIN,
            "device_id": ours.id,
            "type": "unusual",
            "camera_id": camera,
            "subtype": cameras.async_get(camera).name,  # type: ignore[union-attr]
            "metadata": {},
        }
    ]

    # An automation on it runs when the camera's unusual event fires.
    calls = async_capture_events(hass, "test_unusual_ran")
    assert await async_setup_component(
        hass,
        "automation",
        {
            "automation": {
                "trigger": {k: v for k, v in mine[0].items() if k != "metadata"},
                "action": {
                    "event": "test_unusual_ran",
                    "event_data": {"why": "{{ trigger.event.data.reason }}"},
                },
            }
        },
    )
    hass.bus.async_fire(UNUSUAL_EVENT, {"device_id": camera, "reason": "Person."})
    hass.bus.async_fire(UNUSUAL_EVENT, {"device_id": "elsewhere", "reason": "No."})
    await hass.async_block_till_done()
    assert [c.data["why"] for c in calls] == ["Person."]

    # Learning off: the sensor is unavailable.
    hass.config_entries.async_update_entry(learning, options={CONF_LEARN_NORMAL: False})
    await hass.async_block_till_done(wait_background_tasks=True)
    state = hass.states.get(entity_id)
    assert state is not None
    assert state.state == STATE_UNAVAILABLE
    watch.async_stop()

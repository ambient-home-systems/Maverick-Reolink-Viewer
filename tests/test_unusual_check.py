"""The learning check (unusual/check.py): what fired, matched with the marks."""

from datetime import UTC, datetime, timedelta
import time
from typing import Any
from unittest.mock import AsyncMock, patch

from freezegun.api import FrozenDateTimeFactory
from pytest_homeassistant_custom_component.common import (
    MockConfigEntry,
    async_fire_time_changed,
)
from pytest_homeassistant_custom_component.typing import WebSocketGenerator

from custom_components.reolink_viewer.unusual.check import (
    AUTOMATION_TRIGGERED,
    RAN_WINDOW_S,
    STORE_KEY,
    FiredLog,
    compare,
    listening,
)
from custom_components.reolink_viewer.unusual.live import UNUSUAL_EVENT
from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component

from .test_unusual_model import learning  # noqa: F401 - fixtures

START = 1_762_750_000.0


def _iso(seconds: float) -> str:
    return datetime.fromtimestamp(seconds, UTC).isoformat()


def _fired(
    camera: str, kind: str, start: float, delay: float, ran: list[str] | None = None
) -> dict[str, Any]:
    return {
        "camera": camera,
        "kind": kind,
        "start": start,
        "fired": start + delay,
        "automations": ran or [],
    }


def _mark(kind: str, members: list[tuple[str, float]]) -> dict[str, Any]:
    camera, start = members[0]
    return {
        "kind": kind,
        "camera": camera,
        "start": int(start * 1000),
        "cameras": [m[0] for m in members],
        "members": [
            {"camera": c, "start": int(s * 1000), "end": None} for c, s in members
        ],
    }


def test_each_mark_is_matched_with_what_fired_for_it() -> None:
    """Fired once, for a camera of its incident; one not fired; one fired twice."""
    marks = [
        # An incident on two cameras: what fired was for the second one.
        _mark("person", [("drive", START), ("gate", START + 20)]),
        _mark("vehicle", [("drive", START + 600)]),
        _mark("animal", [("yard", START + 1200)]),
    ]
    fired = [
        _fired("gate", "person", START + 20, 0.8, ["automation.notify"]),
        _fired("yard", "animal", START + 1200, 1.2),
        _fired("yard", "animal", START + 1200.5, 31.0),
        # Another kind at the vehicle's time: not its mark.
        _fired("drive", "person", START + 600, 0.5),
    ]
    matched, unmarked = compare(marks, fired)
    assert [(m["kind"], m["fired"], m["delay"], m["automations"]) for m in matched] == [
        ("person", 1, 0.8, ["automation.notify"]),
        ("vehicle", 0, None, []),
        ("animal", 2, 1.2, []),
    ]
    assert [(e["camera"], e["kind"]) for e in unmarked] == [("drive", "person")]
    assert [m["when"] for m in matched] == ["start", None, "start"]


def test_a_mark_that_stands_out_by_its_length_fires_at_its_end() -> None:
    """Long, it stands out only when it ends: fired then, not late."""
    mark = {**_mark("person", [("drive", START)]), "end": int((START + 600) * 1000)}
    (at_end,), _ = compare([mark], [_fired("drive", "person", START, 600.5)])
    assert (at_end["when"], at_end["delay"]) == ("end", 600.5)
    (late,), _ = compare([mark], [_fired("drive", "person", START, 30)])
    assert late["when"] == "late"


async def test_the_log_keeps_what_fired_and_the_automations_that_ran(
    hass: HomeAssistant,
    hass_storage: dict[str, Any],
    freezer: FrozenDateTimeFactory,
) -> None:
    """Within the window after an event, automations that ran are its; kept on disk."""
    log = FiredLog(hass)
    await log.async_load()
    assert log.since is not None
    began = log.since
    payload = {"device_id": "drive", "kind": "person", "start": _iso(START)}
    log.record(payload, START + 0.9)
    hass.bus.async_fire(AUTOMATION_TRIGGERED, {"entity_id": "automation.notify"})
    hass.bus.async_fire(AUTOMATION_TRIGGERED, {"entity_id": "automation.notify"})
    await hass.async_block_till_done()
    freezer.tick(timedelta(seconds=RAN_WINDOW_S + 1))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    # After the window: not this event's.
    hass.bus.async_fire(AUTOMATION_TRIGGERED, {"entity_id": "automation.other"})
    await hass.async_block_till_done()
    (entry,) = log.entries()
    assert entry == {
        "camera": "drive",
        "kind": "person",
        "start": START,
        "fired": START + 0.9,
        "automations": ["automation.notify"],
    }
    assert log.entries(since=START + 1) == []
    freezer.tick(timedelta(seconds=10))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    assert hass_storage[STORE_KEY]["data"]["entries"][0]["automations"] == [
        "automation.notify"
    ]
    # Read again after a restart: the same, and the same beginning.
    again = FiredLog(hass)
    await again.async_load()
    assert again.since == began
    assert again.entries() == [entry]


async def test_an_open_window_closes_when_the_entry_unloads(
    hass: HomeAssistant,
) -> None:
    """No timer left behind; what ran so far is kept."""
    log = FiredLog(hass)
    await log.async_load()
    log.record({"device_id": "drive", "kind": "person", "start": _iso(START)}, START)
    hass.bus.async_fire(AUTOMATION_TRIGGERED, {"entity_id": "automation.notify"})
    await hass.async_block_till_done()
    log.async_stop()
    hass.bus.async_fire(AUTOMATION_TRIGGERED, {"entity_id": "automation.late"})
    await hass.async_block_till_done()
    assert log.entries()[0]["automations"] == ["automation.notify"]


async def test_the_automations_listening_are_found_by_how_they_listen(
    hass: HomeAssistant,
) -> None:
    """An event trigger on reolink_viewer_unusual, and one on a camera's sensor."""
    assert await async_setup_component(
        hass,
        "automation",
        {
            "automation": [
                {
                    "id": "by_event",
                    "alias": "By the event",
                    "triggers": [{"trigger": "event", "event_type": UNUSUAL_EVENT}],
                    "actions": [],
                },
                {
                    "id": "by_sensor",
                    "alias": "By the sensor",
                    "triggers": [
                        {
                            "trigger": "state",
                            "entity_id": "binary_sensor.drive_unusual_activity",
                            "to": "on",
                        }
                    ],
                    "actions": [],
                },
                {
                    "id": "other",
                    "alias": "Something else",
                    "triggers": [{"trigger": "event", "event_type": "other"}],
                    "actions": [],
                },
            ]
        },
    )
    found = listening(hass, [], ["binary_sensor.drive_unusual_activity"])
    assert found == {
        "automation.by_the_event": "the event",
        "automation.by_the_sensor": "an Unusual activity sensor",
    }


async def test_the_learning_check_compares_the_marks_with_what_fired(
    hass: HomeAssistant,
    learning: MockConfigEntry,  # noqa: F811 - the fixture
    hass_ws_client: WebSocketGenerator,
) -> None:
    """The fired event runs an automation; the check matches it with its mark."""
    assert await async_setup_component(
        hass,
        "automation",
        {
            "automation": [
                {
                    "id": "notify",
                    "alias": "Notify unusual",
                    "triggers": [{"trigger": "event", "event_type": UNUSUAL_EVENT}],
                    "actions": [],
                }
            ]
        },
    )
    fired = learning.runtime_data.fired
    assert fired is not None
    # A detection since the log began (at setup).
    assert fired.since is not None
    start = max(time.time(), fired.since) + 1
    payload = {"device_id": "cam-drive", "kind": "person", "start": _iso(start)}
    # As the watch does: the event on the bus, then the log told.
    hass.bus.async_fire(UNUSUAL_EVENT, payload)
    fired.record(payload, start + 0.7)
    await hass.async_block_till_done()
    marks = [
        _mark("person", [("cam-drive", start)]),
        _mark("vehicle", [("cam-drive", start - 10)]),
    ]
    unusual = learning.runtime_data.unusual
    assert unusual is not None
    client = await hass_ws_client(hass)
    with patch.object(unusual, "async_marks", AsyncMock(return_value=marks)):
        await client.send_json_auto_id({"type": "reolink_viewer/unusual/check"})
        result = (await client.receive_json())["result"]
    assert result["enabled"] is True
    assert result["prompt_s"] == 2.0
    assert [(m["kind"], m["fired"], m["delay"]) for m in result["marks"]] == [
        ("person", 1, 0.7),
        ("vehicle", 0, None),
    ]
    # The automation ran in the window after the event.
    assert result["marks"][0]["automations"] == ["automation.notify_unusual"]
    assert result["unmarked"] == []
    (automation,) = result["automations"]
    assert automation["entity_id"] == "automation.notify_unusual"
    assert automation["how"] == "the event"
    assert automation["on"] is True
    assert automation["last_triggered"] is not None
    assert result["signals"] == []
    fired.async_stop()


async def test_the_learning_check_says_when_learning_is_off(
    hass: HomeAssistant,
    learning: MockConfigEntry,  # noqa: F811 - the fixture
    hass_ws_client: WebSocketGenerator,
) -> None:
    """Off: nothing to check, and no error."""
    from custom_components.reolink_viewer.const import CONF_LEARN_NORMAL

    hass.config_entries.async_update_entry(learning, options={CONF_LEARN_NORMAL: False})
    await hass.async_block_till_done(wait_background_tasks=True)
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "reolink_viewer/unusual/check"})
    assert (await client.receive_json())["result"] == {"enabled": False}

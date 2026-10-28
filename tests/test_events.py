"""Today's events across cameras, and what each Home Assistant user has seen."""

from collections.abc import Generator
from datetime import datetime
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry
from pytest_homeassistant_custom_component.typing import WebSocketGenerator

from custom_components.reolink_viewer import bridge, events, timeline
from homeassistant.core import HomeAssistant

TODAY = datetime(2026, 10, 17, 12)


@pytest.fixture
def today() -> Generator[None]:
    """The cameras' today is TEST_NOW's day, whatever the real date."""
    with (
        patch.object(timeline, "local_now", return_value=TODAY),
        patch.object(events, "local_now", return_value=TODAY),
    ):
        yield


async def _ws(client: Any, payload: dict[str, Any]) -> dict[str, Any]:
    await client.send_json_auto_id(payload)
    msg: dict[str, Any] = await client.receive_json()
    return msg


async def test_new_until_opened_or_all_seen(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    hass_read_only_access_token: str,
    reolink_host: MagicMock,
    loaded_with_entities: MockConfigEntry,
    viewer_entry: MockConfigEntry,
    today: None,
) -> None:
    """Each user's events are new from their first look until opened."""
    client = await hass_ws_client(hass)
    camera = (await _ws(client, {"type": "reolink_viewer/devices"}))["result"][
        "cameras"
    ][0]["id"]
    # The first look: events after it are new (here, the fake NVR's 11:00 event).
    with patch.object(events, "now_ms", return_value=0):
        msg = await _ws(client, {"type": "reolink_viewer/events/recent"})
    result = msg["result"]
    assert result["cameras"] == 1
    assert result["failed"] == []
    assert result["since"] == 0
    [event] = result["events"]
    assert event["camera_id"] == camera
    assert event["types"] == ["MOTION", "PERSON"]
    assert event["segment"] is not None
    assert event["new"] is True

    # Opened: no longer new for this user.
    with patch.object(events, "now_ms", return_value=event["start"] + 60_000):
        msg = await _ws(
            client,
            {
                "type": "reolink_viewer/events/seen",
                "camera_id": camera,
                "start": event["start"],
            },
        )
    assert msg["success"] is True
    msg = await _ws(client, {"type": "reolink_viewer/events/recent", "max_age": 600})
    assert [e["new"] for e in msg["result"]["events"]] == [False]

    # Another user, whose first look is now: what came before is not new.
    other = await hass_ws_client(hass, hass_read_only_access_token)
    msg = await _ws(other, {"type": "reolink_viewer/events/recent", "max_age": 600})
    assert msg["result"]["since"] > event["start"]
    assert [e["new"] for e in msg["result"]["events"]] == [False]
    # ...and marking all seen moves its mark on, not the first user's.
    with patch.object(events, "now_ms", return_value=5):
        msg = await _ws(other, {"type": "reolink_viewer/events/seen", "all": True})
    assert msg["success"] is True
    msg = await _ws(other, {"type": "reolink_viewer/events/recent", "max_age": 600})
    assert msg["result"]["since"] == 5
    msg = await _ws(client, {"type": "reolink_viewer/events/recent", "max_age": 600})
    assert msg["result"]["since"] == 0

    msg = await _ws(client, {"type": "reolink_viewer/events/seen", "camera_id": camera})
    assert msg["error"]["code"] == "invalid_format"


async def test_seen_marks_are_stored(
    hass: HomeAssistant, hass_storage: dict[str, Any]
) -> None:
    """What users saw survives a restart; old opened events are dropped."""
    hass_storage[events.STORE_KEY] = {
        "version": 1,
        "key": events.STORE_KEY,
        "data": {"users": {"u1": {"since": 100, "opened": {"cam:200": 200}}, "bad": 3}},
    }
    seen = events.SeenStore(hass)
    await seen.async_load()
    assert seen.marks("u1", 1000) == (100, {"cam:200"})
    day = 86_400_000
    seen.opened("u1", "cam", 5 * day, 5 * day)
    assert seen.marks("u1", 5 * day) == (100, {"cam:432000000"})


async def test_failed_cameras_and_degraded_mode(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    reolink_host: MagicMock,
    loaded_with_entities: MockConfigEntry,
    viewer_entry: MockConfigEntry,
    today: None,
) -> None:
    """A camera whose search fails is named; degraded mode is refused."""
    client = await hass_ws_client(hass)
    # The event search fails, the recordings are found: named, with no events.
    reolink_host.baichuan.search_vod_type = AsyncMock(side_effect=TimeoutError)
    msg = await _ws(client, {"type": "reolink_viewer/events/recent"})
    result = msg["result"]
    assert result["events"] == []
    assert len(result["failed"]) == 1
    assert result["failed"][0]["error"]

    # The day search fails.
    reolink_host.request_vod_files = AsyncMock(side_effect=TimeoutError)
    msg = await _ws(
        client, {"type": "reolink_viewer/events/recent", "background": True}
    )
    result = msg["result"]
    assert result["events"] == []
    assert len(result["failed"]) == 1
    assert "day search failed" in result["failed"][0]["error"]

    with patch.object(
        bridge,
        "async_check_compat",
        return_value=bridge.CompatReport(ok=False, errors=("x",)),
    ):
        msg = await _ws(client, {"type": "reolink_viewer/events/recent"})
    assert msg["error"]["code"] == "incompatible"

    await hass.config_entries.async_unload(viewer_entry.entry_id)
    msg = await _ws(client, {"type": "reolink_viewer/events/recent"})
    assert msg["error"]["code"] == "not_loaded"
    msg = await _ws(client, {"type": "reolink_viewer/events/seen", "all": True})
    assert msg["error"]["code"] == "not_loaded"


async def test_a_given_day_and_the_days_with_recordings(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    reolink_host: MagicMock,
    loaded_with_entities: MockConfigEntry,
    viewer_entry: MockConfigEntry,
    today: None,
) -> None:
    """The Events view asks for any day, and for the days that have recordings."""
    client = await hass_ws_client(hass)
    msg = await _ws(
        client, {"type": "reolink_viewer/events/recent", "date": "2026-10-17"}
    )
    assert [e["types"] for e in msg["result"]["events"]] == [["MOTION", "PERSON"]]
    msg = await _ws(client, {"type": "reolink_viewer/events/recent", "date": "nope"})
    assert msg["success"] is False

    msg = await _ws(
        client, {"type": "reolink_viewer/events/days", "year": 2026, "month": 10}
    )
    assert msg["result"] == {"days": list(range(1, 18)), "failed": []}

    # Both of the camera's ways to search a month fail.
    reolink_host.baichuan.search_vod_days = AsyncMock(side_effect=TimeoutError)
    reolink_host.request_vod_files = AsyncMock(side_effect=TimeoutError)
    msg = await _ws(
        client, {"type": "reolink_viewer/events/days", "year": 2026, "month": 9}
    )
    assert msg["result"]["days"] == []
    assert len(msg["result"]["failed"]) == 1

    with patch.object(
        bridge,
        "async_check_compat",
        return_value=bridge.CompatReport(ok=False, errors=("x",)),
    ):
        msg = await _ws(
            client, {"type": "reolink_viewer/events/days", "year": 2026, "month": 10}
        )
    assert msg["error"]["code"] == "incompatible"
    await hass.config_entries.async_unload(viewer_entry.entry_id)
    msg = await _ws(
        client, {"type": "reolink_viewer/events/days", "year": 2026, "month": 10}
    )
    assert msg["error"]["code"] == "not_loaded"

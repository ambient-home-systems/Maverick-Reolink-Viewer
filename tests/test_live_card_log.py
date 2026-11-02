"""Tests for what the dashboard cards saw, per device (live/card_log.py)."""

from typing import Any
from unittest.mock import patch

from pytest_homeassistant_custom_component.common import MockConfigEntry
from pytest_homeassistant_custom_component.typing import WebSocketGenerator

from custom_components.reolink_viewer.live import card_log
from custom_components.reolink_viewer.live.card_log import CardLog
from custom_components.reolink_viewer.live.service import LiveService
from homeassistant.core import HomeAssistant


def _live(viewer_entry: MockConfigEntry) -> LiveService:
    live: LiveService | None = viewer_entry.runtime_data.live
    assert live is not None
    return live


def _event(at: int, what: str = "hidden", **more: str) -> dict[str, Any]:
    return {"at": at, "what": what, **more}


async def test_events_are_kept_per_device_and_bounded(hass: HomeAssistant) -> None:
    """The newest MAX_EVENTS per device, the MAX_DEVICES heard from last."""
    log = CardLog(hass)
    await log.async_load()
    with (
        patch.object(card_log, "MAX_EVENTS", 3),
        patch.object(card_log, "MAX_DEVICES", 2),
    ):
        log.add("Android · Fully Kiosk", [_event(1), _event(2)])
        log.add("iPhone · Home Assistant app", [_event(5, "visible")])
        log.add("Android · Fully Kiosk", [_event(3), _event(4, card="Doorbell")])
        logs = log.logs()
        # The device heard from last first; its oldest event gone.
        assert [entry["device"] for entry in logs] == [
            "Android · Fully Kiosk",
            "iPhone · Home Assistant app",
        ]
        assert [e["at"] for e in logs[0]["events"]] == [2, 3, 4]
        assert logs[0]["events"][-1] == _event(4, card="Doorbell")
        assert logs[0]["updated"]
        # A third device: the one silent longest goes.
        log.add("Mac · Chrome", [_event(6)])
        assert [entry["device"] for entry in log.logs()] == [
            "Mac · Chrome",
            "Android · Fully Kiosk",
        ]

    # Kept in Home Assistant's storage.
    await log._store.async_save(log._data())
    again = CardLog(hass)
    await again.async_load()
    assert again.logs() == log.logs()
    log.clear()
    assert log.logs() == []


async def test_any_user_reports_and_reads_the_cards_log(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    hass_read_only_access_token: str,
    loaded_with_entities: MockConfigEntry,
    viewer_entry: MockConfigEntry,
) -> None:
    """A wall tablet signed in as any user sends its log; any device reads it."""
    client = await hass_ws_client(hass, hass_read_only_access_token)

    async def call(**message: Any) -> Any:
        await client.send_json_auto_id(message)
        msg = await client.receive_json()
        assert msg["success"], msg
        return msg["result"]

    events = [
        _event(1_000, "screen off", detail="Fully Kiosk"),
        _event(2_000, "playing", card="Doorbell", detail="MSE, 0.4 s"),
    ]
    await call(
        type="reolink_viewer/live/card_log/add",
        device="Android · Fully Kiosk",
        events=events,
    )
    result = await call(type="reolink_viewer/live/card_log")
    assert [(d["device"], d["events"]) for d in result["devices"]] == [
        ("Android · Fully Kiosk", events)
    ]
    assert _live(viewer_entry).card_log.logs()[0]["events"] == events
    # Start over.
    await call(type="reolink_viewer/live/card_log/clear")
    assert (await call(type="reolink_viewer/live/card_log"))["devices"] == []

    # What a page sends is bounded.
    for message in (
        {"device": "", "events": []},
        {"device": "x" * 65, "events": []},
        {"device": "Tablet", "events": [{"at": -1, "what": "hidden"}]},
        {"device": "Tablet", "events": [{"at": 1, "what": ""}]},
        {"device": "Tablet", "events": [{"at": 1, "what": "x" * 41}]},
        {"device": "Tablet", "events": [{"at": 1, "what": "a", "detail": "x" * 201}]},
        {"device": "Tablet", "events": [{"at": 1}]},
        {"device": "Tablet", "events": [_event(n) for n in range(301)]},
    ):
        await client.send_json_auto_id(
            {"type": "reolink_viewer/live/card_log/add", **message}
        )
        msg = await client.receive_json()
        assert not msg["success"], message

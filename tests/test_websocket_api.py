"""Tests for the websocket commands."""

import asyncio
from collections.abc import Generator
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry, MockUser
from pytest_homeassistant_custom_component.typing import WebSocketGenerator

from custom_components.reolink_viewer import probe
from custom_components.reolink_viewer.media import ByteResult, FrameResult
from homeassistant.components.ffmpeg import FFmpegManager
from homeassistant.core import HomeAssistant

from .conftest import SECRETS
from .ha_reolink_mock import TEST_HOST_MODEL


@pytest.fixture(autouse=True)
def fake_media() -> Generator[None]:
    """No subprocesses or HTTP in websocket tests."""

    async def frame(*_args: Any, **_kwargs: Any) -> FrameResult:
        return FrameResult(ok=True, ttff_ms=1.0, codec="h264")

    async def first_bytes(*_args: Any, **_kwargs: Any) -> ByteResult:
        return ByteResult(ok=True, ttfb_ms=1.0, status=200, bytes_read=1)

    with (
        patch.object(probe, "async_first_frame", frame),
        patch.object(probe, "async_first_bytes", first_bytes),
        patch.object(
            FFmpegManager, "async_get_version", AsyncMock(return_value=("7.1", 7))
        ),
    ):
        yield


async def test_devices(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_viewer: MockConfigEntry,
    loaded_reolink: MockConfigEntry,
) -> None:
    """The device list comes from the bridge."""
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "reolink_viewer/devices"})
    msg = await client.receive_json()
    assert msg["success"], msg
    result = msg["result"]
    assert result["degraded"] is False
    (host,) = result["hosts"]
    assert host["entry_id"] == loaded_reolink.entry_id
    assert host["model"] == TEST_HOST_MODEL
    assert host["device_type"] == "nvr"
    assert host["channels"][0]["main"]["codec"] == "h264"


async def test_devices_degraded(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    reolink_host: MagicMock,
    loaded_viewer: MockConfigEntry,
) -> None:
    """When internals changed, devices come from the device registry."""
    del reolink_host.get_vod_source
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "reolink_viewer/devices"})
    msg = await client.receive_json()
    result = msg["result"]
    assert result["degraded"] is True
    assert result["hosts"] == []
    assert result["devices"]
    assert "get_vod_source" in result["compat"]["errors"][0]


async def test_devices_bridge_error_degrades(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    reolink_host: MagicMock,
    loaded_viewer: MockConfigEntry,
) -> None:
    """An unexpected bridge error degrades instead of failing the panel."""
    reolink_host.camera_name.side_effect = RuntimeError("boom")
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "reolink_viewer/devices"})
    result = (await client.receive_json())["result"]
    assert result["degraded"] is True
    assert "bridge error: boom" in result["compat"]["errors"]


async def test_status(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_viewer: MockConfigEntry,
) -> None:
    """Status reports compatibility and admin state."""
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "reolink_viewer/status"})
    msg = await client.receive_json()
    assert msg["result"]["compat"]["ok"] is True
    assert msg["result"]["degraded"] is False
    assert msg["result"]["is_admin"] is True
    assert msg["result"]["scheduler"] == {}


@pytest.mark.parametrize("command", ["status", "devices", "probe"])
async def test_not_loaded(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_viewer: MockConfigEntry,
    command: str,
) -> None:
    """Commands fail cleanly when the entry is not loaded."""
    await hass.config_entries.async_unload(loaded_viewer.entry_id)
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": f"reolink_viewer/{command}"})
    msg = await client.receive_json()
    assert not msg["success"]
    assert msg["error"]["code"] == "not_loaded"


async def _collect_probe(client: Any, payload: dict[str, Any]) -> list[dict[str, Any]]:
    await client.send_json_auto_id({"type": "reolink_viewer/probe", **payload})
    ack = await client.receive_json()
    assert ack["success"], ack
    events: list[dict[str, Any]] = []
    while True:
        msg = await client.receive_json()
        events.append(msg["event"])
        if msg["event"]["type"] in {"result", "error"}:
            return events


async def test_probe(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_viewer: MockConfigEntry,
) -> None:
    """The probe streams progress then a redacted report."""
    client = await hass_ws_client(hass)
    events = await _collect_probe(client, {"concurrency_test": False})
    assert events[0]["type"] == "progress"
    report = events[-1]["report"]
    assert report["ffmpeg_version"] == "7.1"
    assert report["integration_version"] == "0.0.2"
    assert report["options"]["concurrency_test"] is False
    assert report["hosts"][0]["channels"][0]["live"]["rtsp"]["sub"]["ok"] is True
    text = str(report)
    for secret in SECRETS:
        assert secret not in text


async def test_probe_requires_admin(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    hass_admin_user: MockUser,
    loaded_viewer: MockConfigEntry,
) -> None:
    """Non-admin users cannot run the probe."""
    hass_admin_user.groups = []
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "reolink_viewer/probe"})
    msg = await client.receive_json()
    assert not msg["success"]
    assert msg["error"]["code"] == "unauthorized"


async def test_probe_validates_options(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_viewer: MockConfigEntry,
) -> None:
    """max_streams is capped by the schema."""
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "reolink_viewer/probe", "max_streams": 50})
    msg = await client.receive_json()
    assert not msg["success"]
    assert msg["error"]["code"] == "invalid_format"


async def test_probe_incompatible(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    reolink_host: MagicMock,
    loaded_viewer: MockConfigEntry,
) -> None:
    """The probe refuses to run in degraded mode."""
    del reolink_host.request_vod_files
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "reolink_viewer/probe"})
    msg = await client.receive_json()
    assert msg["error"]["code"] == "incompatible"
    assert "request_vod_files" in msg["error"]["message"]


async def test_probe_already_running_and_cancel(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    reolink_host: MagicMock,
    loaded_viewer: MockConfigEntry,
) -> None:
    """One probe at a time; unsubscribing cancels it."""
    started = asyncio.Event()

    async def hang(*_args: Any, **_kwargs: Any) -> str:
        started.set()
        await asyncio.sleep(3600)
        return "h264"

    reolink_host.get_encoding.side_effect = hang
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "reolink_viewer/probe"})
    first = await client.receive_json()
    assert first["success"]
    await started.wait()

    await client.send_json_auto_id({"type": "reolink_viewer/probe"})
    while (msg := await client.receive_json())["id"] != first["id"] + 1:
        pass
    assert msg["error"]["code"] == "probe_running"

    await client.send_json_auto_id(
        {"type": "unsubscribe_events", "subscription": first["id"]}
    )
    while (msg := await client.receive_json()).get("type") != "result" or msg[
        "id"
    ] == first["id"]:
        pass
    assert msg["success"]
    await hass.async_block_till_done()
    data = loaded_viewer.runtime_data
    assert not data.probe_lock.locked()


async def test_probe_unexpected_error(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_viewer: MockConfigEntry,
) -> None:
    """An unexpected probe crash is reported as an error event."""
    with patch.object(probe.Prober, "async_run", side_effect=RuntimeError("crash")):
        client = await hass_ws_client(hass)
        events = await _collect_probe(client, {})
    assert events[-1] == {"type": "error", "message": "crash"}

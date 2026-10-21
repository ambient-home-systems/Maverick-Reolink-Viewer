"""Chromium watches live through Home Assistant (Phase 3 step 1).

The browser talks to Home Assistant's websocket API: a WebRTC session through
``reolink_viewer/live/webrtc`` to our go2rtc (trickle ICE both ways), then MSE
through the signed websocket proxy. Playwright's Chromium has no H.264, so the
fake camera's stream is Opus audio only: the signaling, ICE and media paths
are the same as for video.

Needs go2rtc, ffmpeg (libopus), node and Playwright with Chromium; skipped
without them unless RV_BROWSER_TESTS=1 (CI), where it fails instead.
"""

import asyncio
import json
import os
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry
from pytest_homeassistant_custom_component.typing import (
    ClientSessionGenerator,
    WebSocketGenerator,
)

from homeassistant.core import HomeAssistant

from .test_live_go2rtc import _finder
from .test_mse_browser import _missing, _node_path

SCRIPT = Path(__file__).with_name("live_browser.cjs")


@pytest.fixture
async def opus_live(
    hass: HomeAssistant,
    reolink_host: MagicMock,
    loaded_with_entities: MockConfigEntry,
    viewer_entry: MockConfigEntry,
    go2rtc_binary: str,
    fake_camera: str,
) -> MockConfigEntry:
    """The integration's go2rtc, reading the fake camera's Opus stream as sub."""
    reolink_host.get_rtsp_stream_source = AsyncMock(
        side_effect=lambda ch, stream=None, check=True: f"{fake_camera}/opus"
    )
    service = viewer_entry.runtime_data.live
    assert service is not None
    service.server._find_binary = _finder(go2rtc_binary)
    yield viewer_entry
    await service.async_shutdown()


@pytest.mark.timeout(120)
async def test_chromium_watches_live_through_home_assistant(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    hass_client: ClientSessionGenerator,
    hass_access_token: str,
    opus_live: MockConfigEntry,
) -> None:
    """WebRTC connects and receives media; MSE buffers what go2rtc sends."""
    node_path = await hass.async_add_executor_job(_node_path)
    if node_path is None:
        _missing("node with Playwright is not installed")
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "reolink_viewer/live/cameras"})
    msg = await client.receive_json()
    connection_id = msg["result"]["cameras"][0]["connections"][0]["connection_id"]
    http = await hass_client()
    origin = str(http.make_url("/")).rstrip("/")
    process = await asyncio.create_subprocess_exec(
        "node",
        str(SCRIPT),
        origin,
        hass_access_token,
        connection_id,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env={**os.environ, "NODE_PATH": node_path},
    )
    stdout, stderr = await asyncio.wait_for(process.communicate(), 90)
    assert process.returncode == 0, stderr.decode()
    result = json.loads(stdout.decode().strip().splitlines()[-1])
    assert "error" not in result, result
    assert result["steps"] == ["auth", "webrtc", "mse"], result
    assert result["iceServers"] >= 1
    assert "webrtcError" not in result, result
    assert result["signals"][:2] == ["session", "answer"], result
    assert "candidate" in result["signals"]
    assert result["connected"] is True, result
    assert result["track"] == "audio"
    assert result["audioPackets"] > 0, result
    assert result["mse"]["mime"] == 'video/mp4; codecs="opus"', result
    assert result["mse"]["buffered"] > 1
    # Both sessions ended: nothing holds the stream any more.
    await asyncio.sleep(0.5)
    service = opus_live.runtime_data.live
    assert service is not None
    assert service.registry.running() == {}
    assert service.sessions == {}

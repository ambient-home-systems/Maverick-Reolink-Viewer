"""Chromium watches live through Home Assistant (Phase 3 steps 1 and 2).

The browser talks to Home Assistant's websocket API: a WebRTC session through
``reolink_viewer/live/webrtc`` to our go2rtc (trickle ICE both ways), then MSE
through the signed websocket proxy. Playwright's Chromium has no H.264, so the
fake camera's stream there is Opus audio only: the signaling, ICE and media
paths are the same as for video. Then the panel's live grid, from the bundle
Home Assistant serves: the camera's picture, then its stream starting over
WebRTC (go2rtc sends only H.264 or H.265 video, which this Chromium cannot
decode, so frames are left to the hardware runs).

Needs go2rtc, ffmpeg (libopus), node and Playwright with Chromium; skipped
without them unless RV_BROWSER_TESTS=1 (CI), where it fails instead.
"""

import asyncio
import json
import os
from pathlib import Path
import subprocess
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
GRID_SCRIPT = Path(__file__).with_name("live_grid_browser.cjs")


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


@pytest.fixture
async def grid_live(
    hass: HomeAssistant, reolink_host: MagicMock, opus_live: MockConfigEntry
) -> MockConfigEntry:
    """The Opus stream as sub, and the camera's picture a real JPEG."""
    picture = await hass.async_add_executor_job(_jpeg)
    reolink_host.get_snapshot = AsyncMock(return_value=picture)
    # The soak's sampling started long ago (conftest stubs its start): the
    # report takes a sample now.
    service = opus_live.runtime_data.live
    assert service is not None
    service.soak._started_at = 0
    return opus_live


def _jpeg() -> bytes:
    """A 64x36 JPEG, as a camera's sub-size snapshot."""
    return subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-f",
            "lavfi",
            "-i",
            "testsrc2=size=64x36",
            "-frames:v",
            "1",
            "-f",
            "mjpeg",
            "pipe:1",
        ],
        capture_output=True,
        check=True,
    ).stdout


@pytest.mark.timeout(120)
async def test_chromium_starts_the_live_grid(
    hass: HomeAssistant,
    hass_client: ClientSessionGenerator,
    hass_access_token: str,
    reolink_host: MagicMock,
    grid_live: MockConfigEntry,
) -> None:
    """The grid shows the camera's picture, starts its stream, and HD in full screen."""
    node_path = await hass.async_add_executor_job(_node_path)
    if node_path is None:
        _missing("node with Playwright is not installed")
    http = await hass_client()
    origin = str(http.make_url("/")).rstrip("/")
    process = await asyncio.create_subprocess_exec(
        "node",
        str(GRID_SCRIPT),
        origin,
        hass_access_token,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env={**os.environ, "NODE_PATH": node_path},
    )
    stdout, stderr = await asyncio.wait_for(process.communicate(), 100)
    assert process.returncode == 0, stderr.decode()
    result = json.loads(stdout.decode().strip().splitlines()[-1])
    assert "error" not in result, result
    assert result["pageErrors"] == [], result
    assert result["tiles"] >= 1, result
    # The picture from the image cache (a signed URL, from memory).
    assert result["pictureWidth"] == 64, result
    # Its stream started through Home Assistant, holding the camera's sub: over
    # MSE first, its keep-warm switch being on (or over WebRTC after it).
    assert result["state"]["kind"] == "starting", result
    assert result["state"]["transport"] in ("MSE", "WebRTC"), result
    assert list(result["running"].values()) == [1], result
    # Its debug view: the camera, its player, and go2rtc's state of the stream.
    assert result["debug"][0].startswith("test_reolink_cam · "), result
    assert result["debug"][1].startswith("SD (sub, kept warm): "), result
    assert result["debug"][2].startswith("  server: go2rtc "), result
    # The soak report: the run the grid started on the server, its samples,
    # what the tile counted (if anything yet), the verdicts.
    soak = result["soak"]
    assert soak[0].startswith("Reolink Viewer soak report v"), result
    assert soak[1].startswith("Soak started "), soak
    assert soak[1].endswith(" · opened 1 time"), soak
    assert soak[2] == "Reported by: Linux · Chrome (now)", soak
    assert soak[3].startswith("Home Assistant's samples: "), soak
    assert any(line.startswith("go2rtc: running") for line in soak), soak
    tiles = soak.index("Tiles (plays · drops · failed starts):")
    assert soak[tiles + 1].startswith(("  test_reolink_cam: ", "  none counted")), soak
    assert (
        "✗ The grid has been visible 0.0 h of 8: open it whenever it suits;"
        " the hours add up across sittings and devices"
    ) in soak, soak
    # Full screen: the HD stream (the main, H.264 here) starts while the sub
    # stream's player keeps running, cold over WebRTC, or over MSE once WebRTC
    # has failed (this Chromium offers go2rtc no H.264); back from it, the main
    # is let go and the sub's player still runs.
    assert result["hd"]["sub"] is True, result
    assert result["hd"]["full"] is True, result
    assert result["hd"]["state"]["kind"] == "starting", result
    assert result["hd"]["state"]["transport"] in ("WebRTC", "MSE"), result
    assert result["back"] == {"sub": True, "full": False}, result
    # Its PTZ arrow, held and let go: Home Assistant's button actions moved the
    # camera left and then stopped it.
    assert result["ptz"] == "found", result
    assert result["ptzError"] is None, result
    commands = [
        c.kwargs.get("command") for c in reolink_host.set_ptz_command.call_args_list
    ]
    assert commands == ["Left", "Stop"], commands
    # The grid went away: nothing holds the stream, nobody watches the pictures.
    assert result["after"] == {"sessions": 0, "running": {}}, result
    service = grid_live.runtime_data.live
    assert service is not None
    assert service.images.stats()["watches"] == 0

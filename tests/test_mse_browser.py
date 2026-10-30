"""Chromium plays what the MSE view serves (Phase 2B step 2, Phase 5b step 2).

A real recording (VP9 and Opus: Playwright's Chromium has no H.264 or AAC)
is put in the NVR's fragment shape, served by the fake NVR, cached and
normalized by the integration, and fetched by Chromium through the real view
with HA's auth. Chromium starts deep in it, plays across a window boundary to
the end, and refuses the NVR's own fragment (the control).

Phase 5b: with the option on, a deep start in a recording whose download
has not reached it is served from the device's cut (a fake NVR sending x264
and AAC in Baichuan blocks), muxed by the integration; Chromium appends the
cut's init and two windows and plays across them.

Needs ffmpeg (libvpx-vp9, libopus; libx264 and AAC for the cut), node and
Playwright with Chromium (1.57 or later for H.264: Chrome for Testing);
skipped without them unless RV_BROWSER_TESTS=1 (CI), where it fails instead.
"""

import asyncio
import base64
from collections.abc import AsyncGenerator, Generator
import json
import os
from pathlib import Path
import shutil
import subprocess
from typing import Any, NoReturn
from unittest.mock import AsyncMock, patch

from aiohttp import web
from aiohttp.test_utils import TestServer
import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry
from pytest_homeassistant_custom_component.typing import (
    ClientSessionGenerator,
    WebSocketGenerator,
)

from custom_components.reolink_viewer import bridge
from custom_components.reolink_viewer.bridge import BaichuanEndpoint
from custom_components.reolink_viewer.const import CONF_BAICHUAN_DEEP_START
from homeassistant.core import HomeAssistant

from .baichuan_fixtures import camera_stream, encode
from .mp4_fixtures import mse_ready, nvr_shape
from .test_baichuan_client import PASSWORD, USER, FakeNvr
from .test_playback_api import (  # noqa: F401 - fixtures
    BODY,
    DAY,
    SERVED,
    _camera_id,
    _ws,
    fixed_now,
    media_server,
    wired,
)

SCRIPT = Path(__file__).with_name("mse_append.cjs")
CUT_SCRIPT = Path(__file__).with_name("mse_cut.cjs")
REQUIRED = os.environ.get("RV_BROWSER_TESTS") == "1"


def _node_path() -> str | None:
    """Where node finds Playwright (a global install), if anywhere."""
    node, npm = shutil.which("node"), shutil.which("npm")
    if node is None or npm is None:
        return None
    root = subprocess.run(
        [npm, "root", "-g"], capture_output=True, text=True, check=False
    ).stdout.strip()
    found = subprocess.run(
        [node, "-e", "require.resolve('playwright')"],
        env={**os.environ, "NODE_PATH": root},
        capture_output=True,
        check=False,
    )
    return root if found.returncode == 0 else None


def _missing(reason: str) -> NoReturn:
    if REQUIRED:
        pytest.fail(reason)
    pytest.skip(reason)


@pytest.fixture
def vp9_recording(tmp_path: Path) -> Generator[tuple[bytes, bytes]]:
    """An 8 s VP9/Opus recording: (as the NVR stores it, as MSE wants it)."""
    path = tmp_path / "ready.mp4"
    if not mse_ready(path, video="libvpx-vp9", audio="libopus"):
        _missing("ffmpeg with libvpx-vp9 and libopus is not installed")
    ready = path.read_bytes()
    nvr = nvr_shape(ready)
    SERVED["body"] = nvr
    yield nvr, ready
    SERVED["body"] = BODY


def _first_fragment(data: bytes) -> tuple[bytes, bytes]:
    """(ftyp + moov, the first moof + mdat) of a fragmented file."""
    boxes = []
    at = 0
    while at < len(data):
        size = int.from_bytes(data[at : at + 4], "big")
        boxes.append((data[at + 4 : at + 8].decode(), data[at : at + size]))
        at += size
    kinds = [kind for kind, _ in boxes]
    moof = kinds.index("moof")
    init = b"".join(raw for _, raw in boxes[:moof])
    return init, boxes[moof][1] + boxes[moof + 1][1]


@pytest.mark.timeout(180)
async def test_chromium_plays_the_normalized_fragments(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    hass_client: ClientSessionGenerator,
    hass_access_token: str,
    wired: MockConfigEntry,  # noqa: F811
    vp9_recording: tuple[bytes, bytes],
) -> None:
    """A deep start, a window boundary and the end; the raw fragment fails."""
    node_path = await hass.async_add_executor_job(_node_path)
    if node_path is None:
        _missing("node with Playwright is not installed")
    nvr, _ready = vp9_recording
    client = await hass_ws_client(hass)
    camera = await _camera_id(client)
    day = (
        await _ws(
            client,
            {"type": "reolink_viewer/timeline/day", "device_id": camera, "date": DAY},
        )
    )["result"]
    msg = await _ws(
        client,
        {
            "type": "reolink_viewer/playback/mse",
            "device_id": camera,
            "date": DAY,
            "segment_id": day["segments"][0]["id"],
        },
    )
    base = msg["result"]["base"]
    http = await hass_client()
    origin = str(http.make_url("/")).rstrip("/")
    raw_init, raw_fragment = _first_fragment(nvr)
    process = await asyncio.create_subprocess_exec(
        "node",
        str(SCRIPT),
        origin,
        base,
        hass_access_token,
        base64.b64encode(raw_init).decode(),
        base64.b64encode(raw_fragment).decode(),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env={**os.environ, "NODE_PATH": node_path},
    )
    stdout, stderr = await asyncio.wait_for(process.communicate(), 120)
    assert process.returncode == 0, stderr.decode()
    result = json.loads(stdout.decode().strip().splitlines()[-1])
    assert "error" not in result, result
    assert result["supported"], result
    assert result["mime"].startswith('video/mp4; codecs="vp09')
    assert result["firstWindow"]["start"] <= 3500 < result["firstWindow"]["end"]
    assert result["startedAt"] == 3.5
    assert result["crossed"], result
    assert result["secondWindow"]["last"]
    assert result["ended"], result
    assert result["endTime"] > 7.5
    assert result["frames"]["total"] > 0
    # What the NVR stores, appended as it is, is refused.
    assert result["raw"] == "Error: append error"


@pytest.fixture
async def stalled(socket_enabled: None) -> AsyncGenerator[TestServer]:
    """A recorder whose download never starts (the cut must serve)."""
    release = asyncio.Event()

    async def handler(_request: web.Request) -> web.StreamResponse:
        await release.wait()
        return web.Response(status=503)

    app = web.Application()
    app.router.add_get("/rec", handler)
    server = TestServer(app, host="127.0.0.1")
    await server.start_server()
    yield server
    release.set()
    await server.close()


@pytest.mark.timeout(180)
async def test_chromium_plays_a_deep_start_from_the_devices_cut(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    hass_client: ClientSessionGenerator,
    hass_access_token: str,
    wired: MockConfigEntry,  # noqa: F811
    reolink_host: Any,
    stalled: TestServer,
    tmp_path: Path,
) -> None:
    """Two minutes into a recording: the cut's init and windows play."""
    node_path = await hass.async_add_executor_job(_node_path)
    if node_path is None:
        _missing("node with Playwright is not installed")
    encoded = await hass.async_add_executor_job(encode, tmp_path, "h264", 8.0)
    if encoded is None:
        _missing("ffmpeg with libx264 and AAC is not installed")
    reolink_host.get_vod_source = AsyncMock(
        return_value=("video/mp4", str(stalled.make_url("/rec")))
    )
    hass.config_entries.async_update_entry(
        wired, options={CONF_BAICHUAN_DEEP_START: True}
    )
    client = await hass_ws_client(hass)
    camera = await _camera_id(client)
    day = (
        await _ws(
            client,
            {"type": "reolink_viewer/timeline/day", "device_id": camera, "date": DAY},
        )
    )["result"]
    segment = day["segments"][0]
    at_ms = 120_000
    nvr = FakeNvr()
    nvr.media = camera_stream(
        encoded, start_unix=(segment["start"] + at_ms) // 1000 - 3, rate=1_004_000
    )
    nvr.chunk_size = 16 * 1024
    nvr.delay = 0.001
    await nvr.start()
    endpoint = BaichuanEndpoint("127.0.0.1", nvr.port, USER, PASSWORD)
    try:
        with patch.object(
            bridge.ReolinkHostHandle, "baichuan_endpoint", return_value=endpoint
        ):
            msg = await _ws(
                client,
                {
                    "type": "reolink_viewer/playback/mse",
                    "device_id": camera,
                    "date": DAY,
                    "segment_id": segment["id"],
                },
            )
            base = msg["result"]["base"]
            http = await hass_client()
            origin = str(http.make_url("/")).rstrip("/")
            process = await asyncio.create_subprocess_exec(
                "node",
                str(CUT_SCRIPT),
                origin,
                base,
                hass_access_token,
                str(at_ms),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env={**os.environ, "NODE_PATH": node_path},
            )
            stdout, stderr = await asyncio.wait_for(process.communicate(), 120)
    finally:
        await nvr.close()
    assert process.returncode == 0, stderr.decode()
    result = json.loads(stdout.decode().strip().splitlines()[-1])
    if not result.get("supported", True):
        _missing(f"this Chromium cannot play {result['mime']} (Playwright 1.57+)")
    assert result.get("error") is None, result
    assert result["initSource"] == "cut"
    # x264's High profile (its level follows the picture), and AAC-LC.
    assert result["mime"].startswith('video/mp4; codecs="avc1.64')
    assert result["mime"].endswith(',mp4a.40.2"')
    first, second = result["firstWindow"], result["secondWindow"]
    assert first["source"] == second["source"] == "cut"
    assert first["first"] >= 1_000_000
    assert first["start"] <= at_ms < first["end"]
    assert second["start"] == first["end"]
    assert result["buffered"][0][0] <= at_ms / 1000
    assert result["startedAt"] == pytest.approx(at_ms / 1000, abs=0.05)
    assert result["crossed"], result
    assert result["frames"]["total"] > 0
    assert result["size"] == [320, 240]

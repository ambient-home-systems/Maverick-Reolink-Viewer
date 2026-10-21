"""Chromium plays what the MSE view serves (Phase 2B step 2).

A real recording (VP9 and Opus: Playwright's Chromium has no H.264 or AAC)
is put in the NVR's fragment shape, served by the fake NVR, cached and
normalized by the integration, and fetched by Chromium through the real view
with HA's auth. Chromium starts deep in it, plays across a window boundary to
the end, and refuses the NVR's own fragment (the control).

Needs ffmpeg (libvpx-vp9, libopus), node and Playwright with Chromium; skipped
without them unless RV_BROWSER_TESTS=1 (CI), where it fails instead.
"""

import asyncio
import base64
from collections.abc import Generator
import json
import os
from pathlib import Path
import shutil
import subprocess
from typing import NoReturn

import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry
from pytest_homeassistant_custom_component.typing import (
    ClientSessionGenerator,
    WebSocketGenerator,
)

from homeassistant.core import HomeAssistant

from .mp4_fixtures import mse_ready, nvr_shape
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

"""Saving an event (Phase 11 step 2): playback/save_event and its download."""

import asyncio
from collections.abc import Generator
from datetime import timedelta
import io
from pathlib import Path
import shutil
from typing import Any
from unittest.mock import AsyncMock, patch

import pytest
from pytest_homeassistant_custom_component.common import (
    MockConfigEntry,
    async_fire_time_changed,
)
from pytest_homeassistant_custom_component.typing import (
    ClientSessionGenerator,
    WebSocketGenerator,
)

from custom_components.reolink_viewer import clips as clips_module
from custom_components.reolink_viewer.clips import CLIP_KEEP_S, CLIP_MAX_MS, clip_name
from custom_components.reolink_viewer.const import (
    CONF_EVENT_CLIP_AFTER,
    CONF_EVENT_CLIP_BEFORE,
)
from custom_components.reolink_viewer.fmp4 import FragmentIndex
from custom_components.reolink_viewer.remux import RemuxError, is_plain
from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util

from .mp4_fixtures import FTYP, av_moov, fragmented_av, mse_ready, nvr_shape
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

# Thirty fragments of 2 s, in the NVR's own shape.
RECORDING = fragmented_av(30, absolute=True, tfdt=False)


@pytest.fixture
def served() -> Generator[bytes]:
    """The fake NVR serves the recording above."""
    SERVED["body"] = RECORDING
    yield RECORDING
    SERVED["body"] = BODY


@pytest.fixture
def no_ffmpeg(wired: MockConfigEntry) -> None:  # noqa: F811
    """The synthetic recording is not real video: serve the cut as it is."""
    clips = wired.runtime_data.clips
    assert clips is not None
    clips._ffmpeg = None


async def _segment(client: Any, camera: str) -> dict[str, Any]:
    day = await _ws(
        client,
        {"type": "reolink_viewer/timeline/day", "device_id": camera, "date": DAY},
    )
    segment: dict[str, Any] = day["result"]["segments"][0]
    return segment


async def _save(
    client: Any, camera: str, segment: dict[str, Any], start: int, end: int, **more: Any
) -> dict[str, Any]:
    return await _ws(
        client,
        {
            "type": "reolink_viewer/playback/save_event",
            "device_id": camera,
            "date": DAY,
            "segment_id": segment["id"],
            "start": segment["start"] + start,
            "end": segment["start"] + end,
            **more,
        },
    )


def _index(data: bytes) -> FragmentIndex:
    index = FragmentIndex()
    index.scan(io.BytesIO(data), len(data))
    return index


async def test_save_an_event(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    hass_client: ClientSessionGenerator,
    hass_client_no_auth: ClientSessionGenerator,
    wired: MockConfigEntry,  # noqa: F811
    served: bytes,
    no_ffmpeg: None,
) -> None:
    """The event and 10 s either side, from its key frame, as a download."""
    client = await hass_ws_client(hass)
    camera = await _camera_id(client)
    segment = await _segment(client, camera)
    # A person 21 to 31 s in: 11 to 41 s, from the key frame at 10 s.
    msg = await _save(client, camera, segment, 21_000, 31_000, label="Person")
    result = msg["result"]
    assert result["start"] == segment["start"] + 10_000
    assert result["end"] == segment["start"] + 42_000
    assert result["plain"] is False
    assert result["expires_in"] == CLIP_KEEP_S
    assert result["timing"]["total_ms"] >= 0
    when = dt_util.as_local(
        dt_util.utc_from_timestamp((segment["start"] + 21_000) / 1000)
    )
    assert result["name"] == f"test-reolink-cam-{when:%Y%m%d-%H%M%S}-person.mp4"
    assert result["url"].startswith("/api/reolink_viewer/event_clip/")
    assert "authSig=" in result["url"]
    assert "127.0.0.1" not in str(result)

    http = await hass_client()
    resp = await http.get(result["url"])
    assert resp.status == 200
    assert resp.headers["Content-Type"] == "video/mp4"
    assert resp.headers["Content-Disposition"] == (
        f'attachment; filename="{result["name"]}"'
    )
    clip = await resp.read()
    assert len(clip) == result["size"]
    # Its fragments are the recording's 5 to 20, from time 0, samples untouched.
    assert clip.startswith(FTYP + av_moov())
    kept = _index(clip)
    original = _index(RECORDING)
    assert len(kept.fragments) == 16
    # The earliest track starts at 0 (the audio here: it runs 16 ms a
    # fragment ahead of the video, so the video starts 80 ms in, as it played).
    assert min(value for _track, value in kept.fragments[0].decode) == 0
    assert kept.fragments[0].start_ms == 80
    for mine, theirs in zip(kept.fragments, original.fragments[5:21], strict=True):
        assert (
            clip[mine.offset + mine.moof_size : mine.end]
            == (RECORDING[theirs.offset + theirs.moof_size : theirs.end])
        )
    # Without HA's auth, or its signature: no.
    anonymous = await hass_client_no_auth()
    assert (await anonymous.get(result["url"].split("?")[0])).status == 401
    assert (await http.get("/api/reolink_viewer/event_clip/nope")).status == 404

    # A quarter of an hour later the file and its URL are gone.
    clips = wired.runtime_data.clips
    assert clips is not None
    assert clips.stats() == {"kept": 1}
    async_fire_time_changed(hass, dt_util.utcnow() + timedelta(seconds=CLIP_KEEP_S + 1))
    await hass.async_block_till_done(wait_background_tasks=True)
    assert clips.stats() == {"kept": 0}
    assert (await http.get(result["url"])).status == 404


async def test_the_margins_and_the_recording_bound_the_clip(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    wired: MockConfigEntry,  # noqa: F811
    served: bytes,
    no_ffmpeg: None,
) -> None:
    """The options' margins; never before the recording, nor past it."""
    hass.config_entries.async_update_entry(
        wired,
        options={**wired.options, CONF_EVENT_CLIP_BEFORE: 0, CONF_EVENT_CLIP_AFTER: 3},
    )
    client = await hass_ws_client(hass)
    camera = await _camera_id(client)
    segment = await _segment(client, camera)
    result = (await _save(client, camera, segment, 21_000, 31_000))["result"]
    # From the key frame at 20 s; to the end of the fragment from 32 to 34 s.
    assert (result["start"], result["end"]) == (
        segment["start"] + 20_000,
        segment["start"] + 34_000,
    )
    assert result["name"].endswith("-event.mp4")
    # An event at the recording's start: its margin before is not there.
    result = (await _save(client, camera, segment, -5_000, 1_000))["result"]
    assert result["start"] == segment["start"]
    # One at its end: up to the last fragment.
    result = (await _save(client, camera, segment, 55_000, 58_000))["result"]
    assert result["end"] == segment["start"] + 60_000


async def test_what_cannot_be_saved(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    wired: MockConfigEntry,  # noqa: F811
    served: bytes,
    no_ffmpeg: None,
) -> None:
    """Backwards, before the recording, past what it holds: each says why."""
    client = await hass_ws_client(hass)
    camera = await _camera_id(client)
    segment = await _segment(client, camera)
    msg = await _save(client, camera, segment, 31_000, 21_000)
    assert msg["error"]["code"] == "invalid_format"
    msg = await _save(client, camera, segment, -90_000, -60_000)
    assert msg["error"] == {
        "code": "clip_failed",
        "message": "the event is not in this recording",
    }
    # The search says the recording is longer than the file the NVR serves.
    msg = await _save(client, camera, segment, 200_000, 210_000)
    assert msg["error"] == {
        "code": "clip_failed",
        "message": "the recording does not reach the event",
    }
    msg = await _ws(
        client,
        {
            "type": "reolink_viewer/playback/save_event",
            "device_id": "nope",
            "date": DAY,
            "segment_id": segment["id"],
            "start": 0,
            "end": 1,
        },
    )
    assert msg["error"]["code"] == "not_found"


@pytest.fixture
def real_recording(tmp_path: Path) -> Generator[bytes]:
    """An 8 s H.264 and AAC recording in the NVR's shape, 1 s fragments."""
    path = tmp_path / "real.mp4"
    if not mse_ready(path):
        pytest.skip("ffmpeg with libx264 is not installed")
    body = nvr_shape(path.read_bytes())
    SERVED["body"] = body
    yield body
    SERVED["body"] = BODY


async def test_a_real_recording_saves_as_a_plain_mp4(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    hass_client: ClientSessionGenerator,
    wired: MockConfigEntry,  # noqa: F811
    real_recording: bytes,
    tmp_path: Path,
) -> None:
    """ffmpeg rewrites the cut, moov first, both streams, its own length."""
    hass.config_entries.async_update_entry(
        wired,
        options={**wired.options, CONF_EVENT_CLIP_BEFORE: 1, CONF_EVENT_CLIP_AFTER: 1},
    )
    client = await hass_ws_client(hass)
    camera = await _camera_id(client)
    segment = await _segment(client, camera)
    result = (await _save(client, camera, segment, 2_500, 4_200))["result"]
    assert result["plain"] is True
    # 1.5 to 5.2 s: from the key frame about 1 s in (ffmpeg's fragments
    # start 64 ms late) to the end of the one holding 5.2 s, five fragments.
    start = result["start"] - segment["start"]
    assert 1_000 <= start < 1_500
    assert result["end"] - segment["start"] - start == pytest.approx(5_000, abs=100)
    http = await hass_client()
    path = tmp_path / "saved.mp4"
    path.write_bytes(await (await http.get(result["url"])).read())
    assert path.stat().st_size == result["size"]
    assert is_plain(path)
    ffprobe = shutil.which("ffprobe")
    if ffprobe is None:
        return
    process = await asyncio.create_subprocess_exec(
        ffprobe,
        "-v",
        "error",
        "-show_entries",
        "format=duration:stream=codec_type",
        "-of",
        "csv=p=0",
        str(path),
        stdout=asyncio.subprocess.PIPE,
    )
    out, _err = await process.communicate()
    lines = out.decode().split()
    assert sorted(lines[:-1]) == ["audio", "video"]
    assert float(lines[-1]) == pytest.approx(5.0, abs=0.15)


def test_clip_names() -> None:
    """<camera>-<date>-<time>-<type>.mp4, in Home Assistant's time zone."""
    start = 1_763_021_763_000  # 2025-11-13 08:16:03 UTC
    assert clip_name("Front Door", start, "person", "UTC") == (
        "front-door-20251113-081603-person.mp4"
    )
    assert clip_name("Front Door", start, "Doorbell press", "America/Chicago") == (
        "front-door-20251113-021603-doorbell-press.mp4"
    )
    assert clip_name("  ", start, "", "Nowhere/Else") == (
        "camera-20251113-081603-event.mp4"
    )
    assert CLIP_MAX_MS == 30 * 60 * 1000


async def test_when_making_the_clip_goes_wrong(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    wired: MockConfigEntry,  # noqa: F811
    served: bytes,
) -> None:
    """ffmpeg failing serves the cut; a stall, a full disk; shutdown clears up."""
    client = await hass_ws_client(hass)
    camera = await _camera_id(client)
    segment = await _segment(client, camera)
    clips = wired.runtime_data.clips
    assert clips is not None
    with patch.object(
        clips_module, "async_flatten", AsyncMock(side_effect=RemuxError("bad data"))
    ):
        result = (await _save(client, camera, segment, 21_000, 31_000))["result"]
    assert result["plain"] is False
    assert result["name"].endswith(".mp4")
    files = list(clips._dir.iterdir())
    assert [f.name.endswith(".fragmented.mp4") for f in files] == [True]

    cache = wired.runtime_data.vod_cache

    async def stalls(*_args: Any) -> tuple[float, float, int]:
        await asyncio.sleep(10)
        raise AssertionError("not cancelled")

    with (
        patch.object(clips_module, "CLIP_TIMEOUT_S", 0.05),
        patch.object(cache, "async_write_clip", stalls),
    ):
        msg = await _save(client, camera, segment, 21_000, 31_000)
    assert msg["error"] == {
        "code": "clip_failed",
        "message": "the recording took too long to download",
    }
    full = OSError(28, "No space left on device")
    with patch.object(cache, "async_write_clip", AsyncMock(side_effect=full)):
        msg = await _save(client, camera, segment, 21_000, 31_000)
    assert (
        msg["error"]["message"] == "could not write the clip: No space left on device"
    )
    # Nothing half-made is left; the one made goes at shutdown.
    assert list(clips._dir.iterdir()) == files
    await clips.async_shutdown()
    assert not clips._dir.exists()
    assert clips.stats() == {"kept": 0}

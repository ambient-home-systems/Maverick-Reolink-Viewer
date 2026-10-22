"""Tests for the soak report's samples (live/soak.py) and live/soak."""

import asyncio
import os
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry
from pytest_homeassistant_custom_component.typing import WebSocketGenerator

from custom_components.reolink_viewer import bridge, devices
from custom_components.reolink_viewer.live import soak
from custom_components.reolink_viewer.live.go2rtc import Go2rtcServer
from custom_components.reolink_viewer.live.service import LiveService
from custom_components.reolink_viewer.live.streams import LiveStream
from custom_components.reolink_viewer.scheduler import Priority
from homeassistant.core import HomeAssistant


def _live(viewer_entry: MockConfigEntry) -> LiveService:
    live: LiveService | None = viewer_entry.runtime_data.live
    assert live is not None
    return live


async def test_a_sample_says_what_live_view_holds(
    hass: HomeAssistant,
    reolink_host: MagicMock,
    loaded_with_entities: MockConfigEntry,
    viewer_entry: MockConfigEntry,
) -> None:
    """go2rtc, sessions, feeds, each host's stream slots and CPU, battery cameras."""
    live = _live(viewer_entry)
    reolink_host.cpu_usage = 23
    # A battery camera, watched: one of its streams is held.
    reolink_host.supported.side_effect = lambda *_args: True
    reolink_host.sleeping.return_value = False
    (source,) = devices.async_image_sources(hass).values()
    # One stream slot of the NVR held (a session to its cameras).
    host = live.scheduler.host(loaded_with_entities.entry_id)
    ticket = host.streams.request(Priority.LIVE)
    await ticket.wait()
    with patch.object(
        live.registry, "running", return_value={LiveStream(source, "sub").name: 1}
    ):
        sample = await live.soak.async_sample()
    assert sample["go2rtc"] == {"state": "stopped", "restarts": 0, "memory_kb": None}
    assert sample["webrtc_sessions"] == 0
    assert sample["feeds"] == {"feeds": 0, "warm": 0, "viewers": 0, "ends": 0}
    assert sample["hosts"] == [
        {
            "name": loaded_with_entities.title,
            "streams": 1,
            "limit": host.streams.limit,
            "waiting": 0,
            "cpu": 23,
        }
    ]
    assert sample["battery"] == [
        {"camera": source.name, "sleeping": False, "watched": True}
    ]
    assert isinstance(sample["at"], int)

    # Asleep and not watched; a host whose entry is gone; no CPU reported.
    ticket.release()
    reolink_host.sleeping.return_value = True
    reolink_host.cpu_usage = None
    live.scheduler.host("gone")
    sample = await live.soak.async_sample()
    assert sample["battery"] == [
        {"camera": source.name, "sleeping": True, "watched": False}
    ]
    assert {h["name"]: h["cpu"] for h in sample["hosts"]} == {
        loaded_with_entities.title: None,
        "unknown host": None,
    }
    # Its details cannot be read: whether it sleeps is unknown.
    with (
        patch.object(
            devices, "async_image_sources", return_value={source.camera_id: source}
        ),
        patch.object(
            bridge.ReolinkHostHandle, "channel_details", side_effect=KeyError("ch")
        ),
    ):
        sample = await live.soak.async_sample()
    assert sample["battery"][0]["sleeping"] is None


@pytest.mark.parametrize(
    ("value", "expected"), [(23, 23), (0, 0), (None, None), ("x", None), (-1, None)]
)
async def test_cpu_usage(
    hass: HomeAssistant,
    reolink_host: MagicMock,
    loaded_reolink: MockConfigEntry,
    value: Any,
    expected: int | None,
) -> None:
    """A host's CPU use as last reported, or None."""
    reolink_host.cpu_usage = value
    (host,) = bridge.async_get_hosts(hass)
    assert host.cpu_usage() == expected


def test_go2rtc_memory(hass: HomeAssistant, tmp_path: Path) -> None:
    """go2rtc's resident memory from /proc while it runs."""
    server = Go2rtcServer(hass, tmp_path, MagicMock(), ffmpeg=None)
    assert server.memory_kb() is None  # not running
    process = MagicMock(pid=os.getpid(), returncode=None)
    server._process = process
    if Path("/proc/self/status").exists():
        memory = server.memory_kb()
        assert memory is not None
        assert memory > 0
    process.pid = 2**22 + 12345  # no such process
    assert server.memory_kb() is None
    process.returncode = 0
    assert server.memory_kb() is None


async def test_samples_are_kept_and_read_back(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_with_entities: MockConfigEntry,
    viewer_entry: MockConfigEntry,
) -> None:
    """The loop samples, survives an error, keeps KEEP; live/soak reads since a time."""
    recorder = _live(viewer_entry).soak
    calls = 0
    real_sample = recorder.async_sample

    async def flaky() -> dict[str, Any]:
        nonlocal calls
        calls += 1
        if calls == 2:
            raise RuntimeError("boom")
        sample = await real_sample()
        return {**sample, "at": calls * 1000}

    with (
        patch.object(soak, "SAMPLE_S", 0.0),
        patch.object(recorder, "async_sample", flaky),
    ):
        # conftest stubs start() (it would run in every test): run the loop here.
        recorder._task = hass.async_create_background_task(recorder._run(), "test")
        for _ in range(50):
            await asyncio.sleep(0)
            if calls >= 5:
                break
        await recorder.async_shutdown()
    kept = recorder.samples()
    # Every sample but the one that failed (the last may have been cut short).
    expected = [n * 1000 for n in range(1, calls + 1) if n != 2]
    assert [s["at"] for s in kept] in (expected, expected[:-1])
    assert len(kept) >= 3
    assert [s["at"] for s in recorder.samples(3000)] == [
        s["at"] for s in kept if s["at"] >= 3000
    ]
    assert recorder._samples.maxlen == soak.KEEP == 432

    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "reolink_viewer/live/soak", "since": 3000})
    msg = await client.receive_json()
    assert msg["success"], msg
    result = msg["result"]
    assert result["sample_s"] == soak.SAMPLE_S
    assert [s["at"] for s in result["samples"]] == [
        s["at"] for s in recorder.samples(3000)
    ]
    assert set(result["now"]) == {
        "at",
        "go2rtc",
        "webrtc_sessions",
        "feeds",
        "hosts",
        "battery",
    }

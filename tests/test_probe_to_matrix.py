"""Tests for scripts/probe_to_matrix.py against real probe output."""

import json
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.reolink_viewer import bridge, probe, probe_playback
from custom_components.reolink_viewer.media import ByteResult, FrameResult
from custom_components.reolink_viewer.probe import ProbeOptions, Prober
from custom_components.reolink_viewer.probe_playback import PlaybackOptions
from custom_components.reolink_viewer.scheduler import Scheduler
from homeassistant.core import HomeAssistant
from scripts import probe_to_matrix

from .mp4_fixtures import mp4_file
from .test_probe import FakeDownload


async def _report(hass: HomeAssistant, options: ProbeOptions) -> dict[str, Any]:
    async def frame(*_a: Any, **_k: Any) -> FrameResult:
        return FrameResult(
            ok=True, open_ms=90, ttff_ms=420, codec="h264", width=640, height=360
        )

    async def first_bytes(*_a: Any, **_k: Any) -> ByteResult:
        return ByteResult(ok=True, ttfb_ms=1500, status=200, bytes_read=10)

    async def hold(*_a: Any, **_k: Any) -> FrameResult:
        return FrameResult(ok=True, ttff_ms=500, frames=40)

    scheduler = Scheduler(default_limit=2)
    with (
        patch.object(probe, "async_first_frame", frame),
        patch.object(probe, "async_first_bytes", first_bytes),
        patch.object(probe, "async_hold_stream", hold),
        patch.object(probe, "CONCURRENCY_COOLDOWN", 0),
    ):
        report = await Prober(
            scheduler,
            bridge.async_get_hosts(hass),
            options=options,
            compat=bridge.async_check_compat(hass),
            ffmpeg_binary="ffmpeg",
            ffmpeg_version="7.1",
            session=MagicMock(),
            integration_version="0.0.1",
        ).async_run()
    await scheduler.async_shutdown()
    return report


async def test_render_nvr(hass: HomeAssistant, loaded_reolink: MockConfigEntry) -> None:
    """A probe report renders into the two matrix tables."""
    report = await _report(hass, ProbeOptions(concurrency_test=True, max_streams=3))
    out = probe_to_matrix.render([report])
    live_header, vod_header = probe_to_matrix.LIVE_HEADER, probe_to_matrix.VOD_HEADER
    assert live_header in out
    assert vod_header in out
    lines = out.splitlines()
    live_row = lines[lines.index(live_header) + 2]
    assert live_row.startswith("| RLC-123 | camera | NVR (RLN8-410) |")
    assert "✓ 420 ms h264 640x360" in live_row
    assert live_row.endswith("| ≥ 3 (all 3 ok) |")
    assert live_row.count("|") == live_header.count("|")
    vod_main = lines[lines.index(vod_header) + 2]
    vod_sub = lines[lines.index(vod_header) + 3]
    assert vod_main.startswith("| RLC-123 | NVR (RLN8-410) | main | ✓")
    assert "✓ 1.5 s" in vod_main
    assert "| - |" in vod_main  # RTMP skipped on NVRs
    assert vod_sub.count("|") == vod_header.count("|")
    assert vod_main.count("|") == vod_header.count("|")


async def test_render_skipped_channel(
    hass: HomeAssistant, reolink_host: MagicMock, loaded_reolink: MockConfigEntry
) -> None:
    """Skipped channels and untested concurrency render with a reason."""
    reolink_host.camera_online.return_value = False
    report = await _report(hass, ProbeOptions())
    out = probe_to_matrix.render([report])
    assert "skipped: offline" in out
    assert "not tested" in out
    for line in out.splitlines():
        if line.startswith("| RLC-123"):
            header = (
                probe_to_matrix.LIVE_HEADER
                if "NVR (RLN8-410) | v" in line
                else probe_to_matrix.VOD_HEADER
            )
            assert line.count("|") == header.count("|"), line


def test_cell_formats() -> None:
    """Cells show success, failure and skips."""
    assert probe_to_matrix.cell({"ok": True, "ttff_ms": 999}) == "✓ 999 ms"
    assert probe_to_matrix.cell({"ok": False, "error": "a|b"}) == "✗ (a/b)"
    assert probe_to_matrix.cell({"ok": False, "error": "Host: 10.0.0.5:80"}) == (
        "✗ (Host: <ip>:80)"
    )
    ffmpeg_error = (
        "[in#0 @ 0x7f55] method DESCRIBE failed: 404 (Stream Not Found) | "
        "Error opening input file <url>."
    )
    assert probe_to_matrix.cell({"ok": False, "error": ffmpeg_error}) == (
        "✗ (method DESCRIBE failed: 404 (Stream Not Found))"
    )
    assert probe_to_matrix.cell({"ok": False, "skipped": "x"}) == "-"
    assert probe_to_matrix.cell(None) == "?"
    assert probe_to_matrix.fmt_ms(None) == ""
    host = {
        "concurrency": {"ok": True, "channel": 5, "max_ok": 6, "first_failure": None}
    }
    assert probe_to_matrix._concurrency(host, {"channel": 16}) == "tested on ch5"
    assert (
        probe_to_matrix.cell(
            {"ok": True, "ttfb_ms": 300, "prepare_ms": 2500}, "ttfb_ms"
        )
        == "✓ 300 ms (+2.5 s prep)"
    )


async def test_main(
    hass: HomeAssistant,
    loaded_reolink: MockConfigEntry,
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    """The CLI reads files and rejects unknown schemas."""
    path = tmp_path / "probe.json"
    path.write_text(json.dumps(await _report(hass, ProbeOptions())))
    assert probe_to_matrix.main([str(path)]) == 0
    assert "### Live view" in capsys.readouterr().out
    bad = tmp_path / "bad.json"
    bad.write_text(json.dumps({"schema_version": 99}))
    assert probe_to_matrix.main([str(bad)]) == 1


async def test_render_playback(
    hass: HomeAssistant, reolink_host: MagicMock, loaded_reolink: MockConfigEntry
) -> None:
    """A playback-only report renders only the playback tables."""
    scheduler = Scheduler(default_limit=2)
    fake = FakeDownload(scheduler, mp4_file(moov_first=False))
    options = ProbeOptions(
        playback=PlaybackOptions(enabled=True, only=True, concurrency_test=True)
    )
    with (
        patch.object(probe_playback, "async_fetch", fake.fetch),
        patch.object(probe_playback, "PLAYBACK_COOLDOWN", 0),
    ):
        report = await Prober(
            scheduler,
            bridge.async_get_hosts(hass),
            options=options,
            compat=bridge.async_check_compat(hass),
            ffmpeg_binary="ffmpeg",
            ffmpeg_version="7.1",
            session=MagicMock(),
            integration_version="0.2.0",
        ).async_run()
    await scheduler.async_shutdown()
    out = probe_to_matrix.render([report])
    assert probe_to_matrix.LIVE_HEADER not in out
    header = probe_to_matrix.PLAYBACK_HEADER
    lines = out.splitlines()
    main_row = lines[lines.index(header) + 2]
    assert main_row.startswith(
        "| RLC-123 | main | 300 s, 1.0 MB, 28 kbps, unrecognized name |"
    )
    assert "✓ all 5 (206)" in main_row
    assert "moov after mdat, not fragmented, [ftyp mdat moov]" in main_row
    assert "hvc1 3840x2160 + mp4a" in main_row
    assert "80 Mbit/s" in main_row
    assert main_row.count("|") == header.count("|")
    conc_header = probe_to_matrix.PLAYBACK_CONCURRENCY_HEADER
    conc_row = lines[lines.index(conc_header) + 2]
    assert conc_row.startswith("| host1 | RLN8-410 | sub | ≥ 1 (all 1 ok) | 1: 9 ms")
    time_row = lines[lines.index(probe_to_matrix.TIME_HEADER) + 2]
    assert time_row.startswith("| host1 | RLN8-410 | 2026-10-17T12:00:00 | unknown")


def test_playback_cells() -> None:
    """Failures and partial Range support render readably."""
    ranges = {
        "supported": False,
        "first_2": {"range_ok": True},
        "mid": {"verdict": "ignored"},
        "mid_open": {"verdict": "wrong: end"},
        "suffix": {"skipped": "x"},
        "tail": {"error": "timeout"},
    }
    assert probe_to_matrix._ranges(ranges) == (
        "first 2 ✓, mid ✗ 200, mid open ✗ end, suffix -, tail ✗ timeout"
    )
    assert probe_to_matrix._ranges(
        {"supported": True, "tail": {"matches_suffix": False}}
    ) == ("✓ all 5 (206) tail differs")
    assert probe_to_matrix._throughput({"ok": False, "error": "HTTP 404"}) == (
        "✗ (HTTP 404)"
    )
    assert probe_to_matrix._throughput(
        {"ok": True, "mbit_s": 50, "content_length": None, "size_matches_search": False}
    ) == ("50 Mbit/s no Content-Length size ≠ search")
    assert probe_to_matrix._day({"search": {"ok": True}}) == "no recordings"
    assert probe_to_matrix._day({"search": {"ok": False, "error": "x"}}) == "✗ (x)"
    assert probe_to_matrix._recording({"skipped": "none"}) == "- (none)"
    assert probe_to_matrix._recording(
        {"duration_s": 60, "size": 500, "name": {"format": "unrecognized"}}
    ) == ("60 s, 500 B, unrecognized name")
    assert probe_to_matrix._layout(
        {"fragmented": True, "top_level": ["a"] * 8, "error": "budget"}
    ) == ("fragmented, [a a a a a a …], (budget)")
    assert probe_to_matrix.fmt_bytes(2.5e9) == "2.5 GB"
    assert probe_to_matrix.fmt_bytes(None) == "?"
    report = {
        "hosts": [
            {
                "id": "host1",
                "identity": {"model": "RLN36"},
                "time": {"error": "no time"},
                "playback_concurrency": {"ok": False, "error": "boom"},
                "channels": [
                    {
                        "model": "CX810",
                        "playback": {"ok": False, "skipped": "no replay"},
                    }
                ],
            },
            {
                "id": "host2",
                "identity": {"model": "E1"},
                "time": {
                    "device_now": "2026-03-29T03:00:00",
                    "timezone": {"name": "CEST", "utcoffset_s": 7200, "dst_s": 3600},
                },
                "playback_concurrency": {
                    "ok": True,
                    "max_ok": 1,
                    "first_failure": 2,
                    "levels": [
                        {"streams": 1, "ok": True, "ttfb_ms": [100], "total_mbit_s": 9},
                        {"streams": 2, "ok": False, "ttfb_ms": [None, 90]},
                    ],
                },
                "channels": [],
            },
        ]
    }
    assert probe_to_matrix.playback_rows([report]) == [
        "| CX810 | - | skipped: no replay | | | | | | | | |"
    ]
    assert probe_to_matrix.playback_concurrency_rows([report]) == [
        "| host1 | RLN36 | - | ✗ (boom) | |",
        "| host2 | E1 | sub | 1 (fails at 2) | 1: 100 ms, 9 Mbit/s; 2: ?/90 ms, None Mbit/s ✗ |",
    ]
    assert probe_to_matrix.time_rows([report]) == [
        "| host1 | RLN36 | ✗ (no time) | | | |",
        "| host2 | E1 | 2026-03-29T03:00:00 | CEST | +2 h | +1 h |",
    ]

"""Tests for scripts/probe_to_matrix.py against real probe output."""

import json
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.reolink_viewer import bridge, probe
from custom_components.reolink_viewer.media import ByteResult, FrameResult
from custom_components.reolink_viewer.probe import ProbeOptions, Prober
from custom_components.reolink_viewer.scheduler import Scheduler
from homeassistant.core import HomeAssistant
from scripts import probe_to_matrix


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

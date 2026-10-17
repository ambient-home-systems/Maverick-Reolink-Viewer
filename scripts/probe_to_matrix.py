#!/usr/bin/env python3
"""Turn Reolink Viewer probe reports into docs/hardware-matrix.md rows.

Usage:
    python scripts/probe_to_matrix.py probe.json [more.json ...]

Prints the two markdown tables of the hardware matrix (live and VOD), one row
per probed channel. Paste the rows into docs/hardware-matrix.md.
"""

import argparse
from collections.abc import Iterable, Iterator
import json
from pathlib import Path
import sys
from typing import Any

PROTOCOLS = ("rtsp", "rtmp", "flv")
LIVE_STREAMS = ("main", "sub", "ext")
VOD_METHODS = ("PLAYBACK", "DOWNLOAD", "NVR_DOWNLOAD", "FLV", "RTMP")

LIVE_HEADER = (
    "| Model | Type | Connected via | Firmware | Battery | Main codec | Sub codec "
    "| RTSP main | RTSP sub | RTSP ext | RTMP main | RTMP sub | RTMP ext "
    "| FLV main | FLV sub | FLV ext | Max concurrent streams |"
)
VOD_HEADER = (
    "| Model | Connected via | Stream | Search | PLAYBACK | DOWNLOAD | NVR_DOWNLOAD | FLV "
    "| RTMP | Event search | Day search | snapshot_past |"
)


def _sep(header: str) -> str:
    return "|" + "|".join(" --- " for _ in range(header.count("|") - 1)) + "|"


def fmt_ms(value: Any) -> str:
    """Format milliseconds compactly."""
    if not isinstance(value, (int, float)):
        return ""
    if value >= 1000:
        return f"{value / 1000:.1f} s"
    return f"{value:.0f} ms"


def cell(result: Any, timing_key: str = "ttff_ms") -> str:
    """Render one measured step: ✓ time, ✗ (reason), or - (skipped)."""
    if not isinstance(result, dict):
        return "?"
    if "skipped" in result:
        return "-"
    if result.get("ok"):
        timing = fmt_ms(result.get(timing_key))
        extra = []
        if result.get("codec") and timing_key == "ttff_ms":
            res = (
                f" {result['width']}x{result['height']}"
                if result.get("width") and result.get("height")
                else ""
            )
            extra.append(f"{result['codec']}{res}")
        prepare = result.get("prepare_ms")
        if (
            timing_key == "ttfb_ms"
            and isinstance(prepare, (int, float))
            and prepare >= 50
        ):
            # NVR_DOWNLOAD prepares the file on the NVR before the first byte.
            extra.append(f"(+{fmt_ms(prepare)} prep)")
        return " ".join(["✓", timing, *extra]).strip()
    error = str(result.get("error") or "failed").replace("|", "/")
    return f"✗ ({error[:40]})"


def _codec(encodings: dict[str, Any], stream: str) -> str:
    enc = encodings.get(stream) or {}
    parts = [str(enc.get("codec") or "?")]
    if enc.get("frame_rate"):
        parts.append(f"{enc['frame_rate']} fps")
    if enc.get("bit_rate"):
        parts.append(f"{enc['bit_rate']} kbps")
    return " ".join(parts)


def _via(host: dict[str, Any]) -> str:
    device_type = host.get("identity", {}).get("device_type", "?")
    if device_type == "nvr":
        return f"NVR ({host['identity'].get('model', '?')})"
    if device_type == "hub":
        return f"Home Hub ({host['identity'].get('model', '?')})"
    return "direct"


def _concurrency(host: dict[str, Any]) -> str:
    conc = host.get("concurrency") or {}
    if "skipped" in conc:
        return "not tested"
    if not conc.get("ok"):
        return cell(conc)
    max_ok = conc.get("max_ok", 0)
    if conc.get("first_failure") is None:
        return f"≥ {max_ok} (all {conc.get('max_streams_tested')} ok)"
    return f"{max_ok} (fails at {conc['first_failure']})"


def _channels(
    reports: Iterable[dict[str, Any]],
) -> Iterator[tuple[dict[str, Any], dict[str, Any]]]:
    for report in reports:
        for host in report.get("hosts", []):
            for channel in host.get("channels", []):
                yield host, channel


def live_rows(reports: Iterable[dict[str, Any]]) -> list[str]:
    """Rows for the live-view table."""
    rows = []
    for host, ch in _channels(reports):
        model = ch.get("model") or host["identity"].get("model", "?")
        if ch.get("skipped"):
            live_cells = [f"skipped: {ch['skipped']}"] + [""] * 8
        else:
            live = ch.get("live", {})
            live_cells = [
                cell(live.get(p, {}).get(s)) for p in PROTOCOLS for s in LIVE_STREAMS
            ]
        rows.append(
            "| "
            + " | ".join(
                [
                    model,
                    "doorbell" if ch.get("is_doorbell") else "camera",
                    _via(host),
                    str(ch.get("firmware_version", "")),
                    "yes" if ch.get("is_battery") else "no",
                    _codec(ch.get("encodings", {}), "main"),
                    _codec(ch.get("encodings", {}), "sub"),
                    *live_cells,
                    _concurrency(host),
                ]
            )
            + " |"
        )
    return rows


def vod_rows(reports: Iterable[dict[str, Any]]) -> list[str]:
    """Rows for the recorded-video table (one per channel and stream)."""
    rows = []
    for host, ch in _channels(reports):
        model = ch.get("model") or host["identity"].get("model", "?")
        via = _via(host)
        vod = ch.get("vod") or {}
        bc = ch.get("baichuan") or {}
        bc_cells = [
            cell(bc.get("event_search"), "latency_ms"),
            cell(bc.get("day_search"), "latency_ms"),
            cell(bc.get("snapshot_past"), "latency_ms"),
        ]
        if ch.get("skipped") or "skipped" in vod or "error" in vod:
            reason = ch.get("skipped") or vod.get("skipped") or vod.get("error")
            rows.append(
                f"| {model} | {via} | - | skipped: {reason} | "
                + " | ".join([""] * len(VOD_METHODS))
                + " | "
                + " | ".join(bc_cells if not ch.get("skipped") else ["", "", ""])
                + " |"
            )
            continue
        for stream in ("main", "sub"):
            entry = vod.get(stream) or {}
            methods = entry.get("methods") or {}
            if "skipped" in methods:
                method_cells = [f"- ({methods['skipped']})"] + [""] * 4
            else:
                method_cells = [cell(methods.get(m), "ttfb_ms") for m in VOD_METHODS]
            rows.append(
                "| "
                + " | ".join(
                    [
                        model,
                        via,
                        stream,
                        cell(entry.get("search"), "latency_ms"),
                        *method_cells,
                        *(bc_cells if stream == "sub" else ["", "", ""]),
                    ]
                )
                + " |"
            )
    return rows


def render(reports: list[dict[str, Any]]) -> str:
    """Render both tables."""
    lines = ["### Live view", "", LIVE_HEADER, _sep(LIVE_HEADER)]
    lines += live_rows(reports)
    lines += ["", "### Recorded video and Baichuan", "", VOD_HEADER, _sep(VOD_HEADER)]
    lines += vod_rows(reports)
    return "\n".join(lines) + "\n"


def main(argv: list[str] | None = None) -> int:
    """Entry point."""
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("reports", nargs="+", type=Path, help="probe JSON files")
    args = parser.parse_args(argv)
    reports = []
    for path in args.reports:
        data = json.loads(path.read_text(encoding="utf-8"))
        if data.get("schema_version") != 1:
            print(f"{path}: unsupported schema_version", file=sys.stderr)
            return 1
        reports.append(data)
    sys.stdout.write(render(reports))
    return 0


if __name__ == "__main__":
    sys.exit(main())

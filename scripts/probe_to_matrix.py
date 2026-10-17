#!/usr/bin/env python3
"""Turn Reolink Viewer probe reports into docs/hardware-matrix.md rows.

Usage:
    python scripts/probe_to_matrix.py probe.json [more.json ...]

Prints the markdown tables of the hardware matrix: live and VOD (one row per
probed channel), and, when the report has the recording playback check (schema
2), the playback tables. Paste the rows into docs/hardware-matrix.md.
"""

import argparse
from collections.abc import Iterable, Iterator
import json
from pathlib import Path
import re
import sys
from typing import Any

PROTOCOLS = ("rtsp", "rtmp", "flv")
# Older reports (schema 1 from v0.0.1) could carry device IPs in error text.
_IPV4 = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
_FFMPEG_PREFIX = re.compile(r"\[[^\]]*@ 0x[0-9a-f]+\] ")
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
PLAYBACK_HEADER = (
    "| Model | Stream | Recording | HTTP Range | Mid-file TTFB | MP4 layout | Tracks "
    "| MP4 vs search | Throughput | Day of recordings | Day search |"
)
PLAYBACK_CONCURRENCY_HEADER = "| Host | Model | Stream | Simultaneous DOWNLOAD streams | Per level: TTFB, Mbit/s |"
TIME_HEADER = "| Host | Model | Device time | Time zone | UTC offset | DST offset |"
SUPPORTED_SCHEMAS = (1, 2)
RANGE_CHECKS = ("first_2", "mid", "mid_open", "suffix", "tail")


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
    error = _IPV4.sub("<ip>", str(result.get("error") or "failed"))
    # ffmpeg errors: drop "[in#0 @ 0x...]" prefixes and keep the first message.
    error = _FFMPEG_PREFIX.sub("", error).split(" | ")[0].replace("|", "/")
    return f"✗ ({error[:60]})"


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


def _concurrency(host: dict[str, Any], channel: dict[str, Any]) -> str:
    conc = host.get("concurrency") or {}
    if "skipped" in conc:
        return "not tested"
    if "channel" in conc and conc["channel"] != channel.get("channel"):
        # The test runs on one channel per host.
        return f"tested on ch{conc['channel']}"
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
                    _concurrency(host, ch),
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


def fmt_bytes(value: Any) -> str:
    """Format a byte count compactly."""
    if not isinstance(value, (int, float)):
        return "?"
    if value >= 1e9:
        return f"{value / 1e9:.1f} GB"
    if value >= 1e6:
        return f"{value / 1e6:.1f} MB"
    if value >= 1e3:
        return f"{value / 1e3:.0f} KB"
    return f"{value:.0f} B"


def _recording(file: dict[str, Any]) -> str:
    if "skipped" in file:
        return f"- ({file['skipped']})"
    parts = [f"{file.get('duration_s', '?')} s", fmt_bytes(file.get("size"))]
    if file.get("bitrate_kbps"):
        parts.append(f"{file['bitrate_kbps']} kbps")
    name = file.get("name") or {}
    if name.get("dst_marker"):
        parts.append("DST name")
    if name.get("start_minus_search_start_s"):
        parts.append(f"name {name['start_minus_search_start_s']:+.0f} s vs search")
    if name.get("format") == "unrecognized":
        parts.append("unrecognized name")
    return ", ".join(parts)


def _range_check(result: dict[str, Any]) -> str:
    if "skipped" in result:
        return "-"
    if result.get("range_ok"):
        return "✓"
    verdict = str(result.get("verdict") or result.get("error") or "failed")
    if verdict == "ignored":
        return "✗ 200"
    return f"✗ {verdict.removeprefix('wrong: ')}"


def _ranges(ranges: dict[str, Any]) -> str:
    if not ranges:
        return ""
    if ranges.get("supported"):
        extra = []
        if ranges.get("first_2", {}).get("matches_body") is False:
            extra.append("first bytes differ")
        if ranges.get("tail", {}).get("matches_suffix") is False:
            extra.append("tail differs")
        return " ".join(["✓ all 5 (206)", *extra])
    cells = [
        f"{name.replace('_', ' ')} {_range_check(ranges.get(name) or {})}"
        for name in RANGE_CHECKS
    ]
    return ", ".join(cells)


def _mid_ttfb(ranges: dict[str, Any]) -> str:
    parts = []
    for name, label in (("mid", "mid"), ("mid_open", "open")):
        result = ranges.get(name) or {}
        if result.get("ttfb_ms") is not None:
            parts.append(f"{label} {fmt_ms(result['ttfb_ms'])}")
    return ", ".join(parts)


def _layout(mp4: dict[str, Any]) -> str:
    if not mp4:
        return ""
    parts = []
    if mp4.get("moov_before_mdat") is True:
        parts.append("moov first")
    elif mp4.get("moov_before_mdat") is False:
        parts.append("moov after mdat")
    if mp4.get("fragmented") is True:
        parts.append("fragmented")
    elif mp4.get("fragmented") is False:
        parts.append("not fragmented")
    if mp4.get("top_level"):
        boxes = " ".join(mp4["top_level"][:6])
        more = " …" if len(mp4["top_level"]) > 6 or mp4.get("truncated") else ""
        parts.append(f"[{boxes}{more}]")
    if mp4.get("error"):
        parts.append(f"({str(mp4['error'])[:50]})")
    return ", ".join(parts)


def _tracks(mp4: dict[str, Any]) -> str:
    tracks = []
    for track in mp4.get("tracks") or []:
        text = str(track.get("sample_entry") or track.get("handler") or "?")
        if track.get("width") and track.get("height"):
            text += f" {track['width']}x{track['height']}"
        tracks.append(text)
    return " + ".join(tracks)


def _throughput(full: dict[str, Any]) -> str:
    if not full:
        return ""
    if not full.get("ok"):
        return cell(full)
    parts = []
    if full.get("mbit_s") is not None:
        parts.append(f"{full['mbit_s']:.0f} Mbit/s")
    if full.get("realtime_factor") is not None:
        parts.append(f"({full['realtime_factor']:.0f}x real time)")
    if full.get("transfer_encoding"):
        parts.append(str(full["transfer_encoding"]))
    elif full.get("content_length") is None:
        parts.append("no Content-Length")
    if full.get("size_matches_search") is False:
        parts.append("size ≠ search")
    return " ".join(parts) or "✓"


def _dist(value: Any, fmt: Any = str) -> str:
    if not isinstance(value, dict):
        return "?"
    return f"{fmt(value['p50'])} ({fmt(value['min'])} to {fmt(value['max'])})"


def _day(day: dict[str, Any]) -> str:
    stats = day.get("stats")
    if not stats:
        search = day.get("search") or {}
        if not search.get("ok"):
            return cell(search)
        return "no recordings"
    parts = [
        f"{day.get('date', '?')}: {stats['files']} files",
        f"duration {_dist(stats.get('duration_s'), lambda v: f'{v:.0f} s')}",
        f"size {_dist(stats.get('size_bytes'), fmt_bytes)}",
    ]
    if stats.get("bitrate_kbps"):
        parts.append(f"{stats['bitrate_kbps']['p50']:.0f} kbps")
    parts.append(f"{stats.get('gaps_over_1s', 0)} gaps")
    return ", ".join(parts)


def playback_rows(reports: Iterable[dict[str, Any]]) -> list[str]:
    """Rows for the recording playback table (one per channel and stream)."""
    rows = []
    for host, ch in _channels(reports):
        playback = ch.get("playback")
        if not playback:
            continue
        model = ch.get("model") or host["identity"].get("model", "?")
        if "stream" not in playback and ("skipped" in playback or "error" in playback):
            reason = playback.get("skipped") or playback.get("error")
            rows.append(f"| {model} | - | skipped: {reason} |" + " |" * 8)
            continue
        for stream in ("main", "sub"):
            entry = playback.get(stream) or {}
            file = entry.get("file") or {}
            failure = cell(entry["url"]) if "url" in entry else ""
            mp4 = entry.get("mp4") or {}
            diff = mp4.get("duration_vs_search_s")
            rows.append(
                "| "
                + " | ".join(
                    [
                        model,
                        stream,
                        _recording(file),
                        failure or _ranges(entry.get("range") or {}),
                        _mid_ttfb(entry.get("range") or {}),
                        _layout(mp4),
                        _tracks(mp4),
                        f"{diff:+.1f} s" if isinstance(diff, (int, float)) else "",
                        _throughput(entry.get("full") or {}),
                        _day(entry.get("day") or {}),
                        cell((entry.get("day") or {}).get("search"), "latency_ms"),
                    ]
                )
                + " |"
            )
    return rows


def playback_concurrency_rows(reports: Iterable[dict[str, Any]]) -> list[str]:
    """Rows for the simultaneous DOWNLOAD streams table (one per host)."""
    rows = []
    for report in reports:
        for host in report.get("hosts", []):
            conc = host.get("playback_concurrency")
            if not conc:
                continue
            model = host.get("identity", {}).get("model", "?")
            if "skipped" in conc:
                rows.append(f"| {host['id']} | {model} | - | not tested | |")
                continue
            if not conc.get("ok"):
                rows.append(f"| {host['id']} | {model} | - | {cell(conc)} | |")
                continue
            max_ok = conc.get("max_ok", 0)
            if conc.get("first_failure") is None:
                summary = f"≥ {max_ok} (all {conc.get('max_streams_tested')} ok)"
            else:
                summary = f"{max_ok} (fails at {conc['first_failure']})"
            levels = []
            for level in conc.get("levels", []):
                ttfb = "/".join(fmt_ms(t) or "?" for t in level.get("ttfb_ms", []))
                rate = level.get("total_mbit_s")
                mark = "" if level.get("ok") else " ✗"
                levels.append(f"{level['streams']}: {ttfb}, {rate} Mbit/s{mark}")
            rows.append(
                f"| {host['id']} | {model} | {conc.get('stream', 'sub')} | {summary} "
                f"| {'; '.join(levels)} |"
            )
    return rows


def time_rows(reports: Iterable[dict[str, Any]]) -> list[str]:
    """Rows for the device time zone table (one per host)."""
    rows = []
    for report in reports:
        for host in report.get("hosts", []):
            info = host.get("time")
            if not info:
                continue
            model = host.get("identity", {}).get("model", "?")
            tz = info.get("timezone") or {}
            if "error" in info or "timezone_error" in info:
                error = info.get("error") or info.get("timezone_error")
                rows.append(f"| {host['id']} | {model} | ✗ ({error}) | | | |")
                continue
            offset = tz.get("utcoffset_s")
            dst = tz.get("dst_s")
            rows.append(
                f"| {host['id']} | {model} | {info.get('device_now', '?')} "
                f"| {tz.get('name') or 'unknown'} "
                f"| {'' if offset is None else f'{offset / 3600:+g} h'} "
                f"| {'' if dst is None else f'{dst / 3600:+g} h'} |"
            )
    return rows


def _has(reports: list[dict[str, Any]], key: str) -> bool:
    return any(key in ch for _host, ch in _channels(reports))


def render(reports: list[dict[str, Any]]) -> str:
    """Render the tables present in the reports."""
    lines: list[str] = []
    if _has(reports, "live") or not _has(reports, "playback"):
        lines += ["### Live view", "", LIVE_HEADER, _sep(LIVE_HEADER)]
        lines += live_rows(reports)
        lines += ["", "### Recorded video and Baichuan", ""]
        lines += [VOD_HEADER, _sep(VOD_HEADER), *vod_rows(reports), ""]
    if _has(reports, "playback"):
        lines += ["### Recording playback (DOWNLOAD)", ""]
        lines += [PLAYBACK_HEADER, _sep(PLAYBACK_HEADER), *playback_rows(reports), ""]
        lines += ["### Simultaneous DOWNLOAD streams", ""]
        lines += [PLAYBACK_CONCURRENCY_HEADER, _sep(PLAYBACK_CONCURRENCY_HEADER)]
        lines += [*playback_concurrency_rows(reports), ""]
        lines += ["### Device time", "", TIME_HEADER, _sep(TIME_HEADER)]
        lines += [*time_rows(reports), ""]
    return "\n".join(lines).rstrip("\n") + "\n"


def main(argv: list[str] | None = None) -> int:
    """Entry point."""
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("reports", nargs="+", type=Path, help="probe JSON files")
    args = parser.parse_args(argv)
    reports = []
    for path in args.reports:
        data = json.loads(path.read_text(encoding="utf-8"))
        if data.get("schema_version") not in SUPPORTED_SCHEMAS:
            print(f"{path}: unsupported schema_version", file=sys.stderr)
            return 1
        reports.append(data)
    sys.stdout.write(render(reports))
    return 0


if __name__ == "__main__":
    sys.exit(main())

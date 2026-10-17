"""Recording playback check (Phase 2 gate), part of the hardware probe.

Measures, on the VOD method chosen in Phase 0 (``DOWNLOAD``), per channel and
stream (main/sub), on one recent recording:

- whether HTTP Range works: 206 + Content-Range for the first two bytes (what
  Safari asks first), a mid-file range, an open-ended mid-file range (what
  Chrome and Firefox send when seeking), a suffix range and an explicit tail
  range;
- the MP4 layout: top-level boxes, moov before or after mdat, fragmented or
  not, track codecs and the movie duration (through Range requests, or by
  following the boxes through the plain GET when Range is ignored);
- whether the URL's ``start`` parameter set to mid-file makes the device begin
  there (a server-side seek);
- the duration and size distribution of a full day's recordings;
- time to first byte for mid-file ranges and the sustained throughput of a
  plain GET, compared with the recording's own bitrate;
- (opt-in) how many simultaneous DOWNLOAD streams, one per channel, the device
  serves while each is read at a player-like pace, and the throughput of one
  and two main-stream downloads read at full speed.

Same safety rules as the rest of the probe: GET requests only, every request
is a scheduler job at prefetch priority, reads are bounded in bytes and time,
connections are closed as soon as a read stops, and nothing but sizes, timings,
status codes, a few headers and box types is recorded (never a URL).
"""

import asyncio
from collections import Counter
from collections.abc import Awaitable, Callable, Iterable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta, tzinfo
from itertools import pairwise
import re
import statistics
import time
from typing import Any, Protocol

from aiohttp import ClientSession

from .bridge import CameraUrl, ChannelInfo, ReolinkHostHandle, VodFile, VodMethod
from .const import (
    PROBE_PLAYBACK_DEFAULT_STREAMS,
    PROBE_PLAYBACK_HARD_MAX_STREAMS,
    PROBE_SEARCH_DAYS,
)
from .media import FetchResult, async_fetch
from .mp4 import BoxScanner, Mp4Layout, PrefixReader, async_layout

PLAYBACK_METHOD = VodMethod.DOWNLOAD
PLAYBACK_STREAMS: tuple[str, ...] = ("main", "sub")
PREFIX_BYTES = 64 * 1024
MID_RANGE_BYTES = 256 * 1024
TAIL_BYTES = 64 * 1024
MAX_BOX_READS = 32
THROUGHPUT_MAX_BYTES = 64 * 1024 * 1024
# Concurrency test: each stream is read at this multiple of its recording's
# bitrate (a player buffering ahead), capped in bytes.
PACE_FACTOR = 4.0
HOLD_MAX_BYTES = 32 * 1024 * 1024
# Full-speed parallel downloads (what filling a cache costs the device).
FULL_SPEED_LEVELS = (1, 2)
FULL_SPEED_MAX_BYTES = 512 * 1024 * 1024
# The server-side seek test asks for the middle of recordings this long or more.
SEEK_MIN_DURATION = timedelta(seconds=60)
PLAYBACK_COOLDOWN = 2.0
# Recordings that ended less than this long ago may still be being written.
RECORDING_SETTLE = timedelta(minutes=2)
PREFERRED_MIN_DURATION = timedelta(seconds=30)
MIN_DURATION = timedelta(seconds=10)

_NAME = re.compile(r"^Rec\w{3}_(DST)?(\d{8})_(\d{6})_(\d{6})_")


class JobRunner(Protocol):
    """Runs one device job on the probed host's scheduler."""

    def __call__[T](
        self,
        factory: Callable[[], Awaitable[T]],
        *,
        timeout: float | None = None,
        exclusive: bool = False,
    ) -> Awaitable[T]:
        """Run ``factory()`` as a scheduler job."""
        ...


@dataclass(slots=True)
class PlaybackOptions:
    """Options of the recording playback check."""

    enabled: bool = False
    # Skip the Phase 0 checks (live, VOD methods, Baichuan, live concurrency).
    only: bool = False
    concurrency_test: bool = False
    max_streams: int = PROBE_PLAYBACK_DEFAULT_STREAMS
    throughput_seconds: float = 6.0
    hold_seconds: float = 6.0

    def __post_init__(self) -> None:
        """Clamp to safe values."""
        if not self.enabled:
            self.only = self.concurrency_test = False
        self.max_streams = max(
            1, min(self.max_streams, PROBE_PLAYBACK_HARD_MAX_STREAMS)
        )
        self.throughput_seconds = max(2.0, min(self.throughput_seconds, 15.0))
        self.hold_seconds = max(2.0, min(self.hold_seconds, 15.0))


def _skipped(reason: str) -> dict[str, Any]:
    return {"ok": False, "skipped": reason}


def _ms(start: float) -> float:
    return round((time.monotonic() - start) * 1000, 1)


def _err(err: BaseException) -> str:
    if isinstance(err, TimeoutError):
        return "timeout"
    text = str(err) or type(err).__name__
    return f"{type(err).__name__}: {text}"[:300]


class PlaybackCheck:
    """The recording playback check for one host."""

    def __init__(
        self,
        host: ReolinkHostHandle,
        job: JobRunner,
        session: ClientSession,
        options: PlaybackOptions,
        *,
        step_timeout: float,
        progress: Callable[[str], None],
    ) -> None:
        """Initialize the check."""
        self._host = host
        self._job = job
        self._session = session
        self._options = options
        self._timeout = step_timeout
        self._progress = progress

    # ---- Host level ----

    def time_info(self, now: datetime) -> dict[str, Any]:
        """Describe the device clock and time zone (for the UTC conversion)."""
        info: dict[str, Any] = {
            "device_now": now.isoformat(),
            "device_now_aware": now.tzinfo is not None,
        }
        try:
            tz: tzinfo | None = self._host.timezone()
        except Exception as err:  # noqa: BLE001 - recorded
            info["timezone_error"] = _err(err)
            return info
        if tz is None:
            info["timezone"] = None
            return info
        local = now.replace(tzinfo=None)
        try:
            offset = tz.utcoffset(local)
            dst = tz.dst(local)
            info["timezone"] = {
                "name": tz.tzname(local),
                "utcoffset_s": offset.total_seconds() if offset is not None else None,
                "dst_s": dst.total_seconds() if dst is not None else None,
            }
        except Exception as err:  # noqa: BLE001 - recorded
            info["timezone_error"] = _err(err)
        return info

    # ---- Channel level ----

    async def async_channel(
        self, channel: ChannelInfo, now: datetime
    ) -> tuple[dict[str, Any], dict[str, VodFile]]:
        """Check one channel; return the result and the recording per stream."""
        if not channel.supports_replay:
            return _skipped("no replay capability"), {}
        result: dict[str, Any] = {"method": PLAYBACK_METHOD.value}
        files: dict[str, VodFile] = {}
        for stream in PLAYBACK_STREAMS:
            self._progress(f"ch{channel.channel} playback {stream}")
            result[stream], file = await self._stream(channel.channel, stream, now)
            if file is not None:
                files[stream] = file
        return result, files

    async def _search(
        self, ch: int, stream: str, start: datetime, end: datetime
    ) -> tuple[dict[str, Any], list[VodFile]]:
        began = time.monotonic()
        try:
            files = await self._job(
                lambda: self._host.async_search_vod_files(ch, start, end, stream),
                timeout=self._timeout * 2,
            )
        except Exception as err:  # noqa: BLE001
            return {"ok": False, "error": _err(err)}, []
        return {"ok": True, "latency_ms": _ms(began), "files": len(files)}, files

    async def _full_day(
        self, ch: int, stream: str, now: datetime
    ) -> tuple[dict[str, Any], list[VodFile]]:
        """Search the most recent complete day that has recordings."""
        midnight = now.replace(hour=0, minute=0, second=0, microsecond=0)
        result: dict[str, Any] = {}
        for days_back in range(1, PROBE_SEARCH_DAYS + 1):
            start = midnight - timedelta(days=days_back)
            end = start + timedelta(days=1) - timedelta(seconds=1)
            search, files = await self._search(ch, stream, start, end)
            result = {"date": start.date().isoformat(), "search": search}
            if not search["ok"]:
                return result, []
            if files:
                result["stats"] = file_stats(files)
                return result, files
        return result, []

    async def _stream(
        self, ch: int, stream: str, now: datetime
    ) -> tuple[dict[str, Any], VodFile | None]:
        entry: dict[str, Any] = {}
        entry["day"], day_files = await self._full_day(ch, stream, now)
        midnight = now.replace(hour=0, minute=0, second=0, microsecond=0)
        entry["today"], today_files = await self._search(ch, stream, midnight, now)
        file = pick_playback_file(today_files, now) or pick_playback_file(
            day_files, now
        )
        if file is None:
            entry["file"] = _skipped(
                f"no finished recording in the last {PROBE_SEARCH_DAYS} days"
            )
            return entry, None
        entry["file"] = describe_file(file)

        try:
            _mime, url = await self._job(
                lambda: self._host.async_vod_url(ch, file, PLAYBACK_METHOD)
            )
        except Exception as err:  # noqa: BLE001
            entry["url"] = {"ok": False, "error": _err(err)}
            return entry, file

        scanner = BoxScanner()
        full = await self._fetch(
            url,
            max_bytes=THROUGHPUT_MAX_BYTES,
            max_seconds=self._options.throughput_seconds,
            keep_bytes=PREFIX_BYTES,
            on_chunk=scanner.feed,
        )
        entry["full"] = full.as_dict()
        if not full.ok:
            return entry, file
        scanner.finish()
        streamed = await scanner.async_layout()
        entry["full"]["realtime_factor"] = realtime_factor(full, file)
        length = full.content_length if full.status == 200 else None
        if length is not None and file.size:
            entry["full"]["size_matches_search"] = length == file.size
        entry["range"] = await self._ranges(url, length, file.size, full.data)
        total = entry["range"]["total_bytes"]
        range_ok = entry["range"]["supported"] is True
        if range_ok:
            entry["mp4"] = await self._layout(url, total, full.data, range_ok)
            entry["mp4"]["source"] = "range"
        else:
            entry["mp4"] = streamed.as_dict() | {
                "source": "stream",
                "bytes_scanned": scanner.bytes_seen,
            }
        mp4_duration = entry["mp4"].get("duration_s")
        if isinstance(mp4_duration, (int, float)):
            entry["mp4"]["duration_vs_search_s"] = round(
                mp4_duration - (file.end - file.start).total_seconds(), 1
            )
        entry["seek"] = await self._seek(ch, file, full, streamed)
        return entry, file

    async def _seek(
        self, ch: int, file: VodFile, full: FetchResult, full_layout: Mp4Layout
    ) -> dict[str, Any]:
        """Ask for the middle of the recording with the URL's start parameter."""
        duration = file.end - file.start
        if duration < SEEK_MIN_DURATION:
            return _skipped("recording shorter than 60 s")
        offset = duration / 2
        try:
            _mime, url = await self._job(
                lambda: self._host.async_vod_url(
                    ch, file, PLAYBACK_METHOD, start_at=file.start + offset
                )
            )
        except Exception as err:  # noqa: BLE001
            return {"ok": False, "error": _err(err)}
        scanner = BoxScanner()
        got = await self._fetch(
            url,
            max_bytes=THROUGHPUT_MAX_BYTES,
            max_seconds=self._options.throughput_seconds,
            keep_bytes=PREFIX_BYTES,
            on_chunk=scanner.feed,
        )
        scanner.finish()
        layout = await scanner.async_layout()
        same_start = got.data == full.data if got.data and full.data else None
        return {
            "ok": got.ok,
            "offset_s": round(offset.total_seconds()),
            "status": got.status,
            "ttfb_ms": got.ttfb_ms,
            "bytes_read": got.bytes_read,
            "eof": got.eof,
            "full_bytes_read": full.bytes_read,
            "full_eof": full.eof,
            "mp4_duration_s": layout.duration_s,
            "full_mp4_duration_s": full_layout.duration_s,
            "same_first_64k": same_start,
            "error": got.error,
            "verdict": seek_verdict(got, full, layout, full_layout, same_start),
        }

    async def _fetch(
        self,
        url: CameraUrl,
        *,
        range_header: str | None = None,
        max_bytes: int,
        max_seconds: float | None = None,
        keep_bytes: int = 0,
        on_chunk: Callable[[bytes], None] | None = None,
    ) -> FetchResult:
        timeout = self._timeout + (max_seconds or 0)
        try:
            return await self._job(
                lambda: async_fetch(
                    self._session,
                    url,
                    range_header=range_header,
                    max_bytes=max_bytes,
                    max_seconds=max_seconds,
                    keep_bytes=keep_bytes,
                    on_chunk=on_chunk,
                    timeout=timeout,
                ),
                timeout=timeout + 5,
            )
        except Exception as err:  # noqa: BLE001
            return FetchResult(ok=False, range=range_header, error=_err(err))

    async def _ranges(
        self,
        url: CameraUrl,
        content_length: int | None,
        search_size: int | None,
        prefix: bytes,
    ) -> dict[str, Any]:
        """Request the ranges a browser would and check the answers."""
        result: dict[str, Any] = {}
        first = await self._range(url, 0, 1, content_length, keep=True)
        if first["range_ok"] and prefix:
            first["matches_body"] = first["_data"] == prefix[:2]
        first.pop("_data", None)
        result["first_2"] = first

        # The file size: from the plain GET, else Content-Range, else the search.
        total, source = content_length, "content-length"
        if total is None:
            parsed = parse_content_range(first.get("content_range"))
            total, source = (parsed[2], "content-range") if parsed else (None, "")
        if total is None:
            total, source = search_size, "search"
        result["total_bytes"] = total
        result["total_source"] = source if total is not None else None
        if total is None or total < 4 * MID_RANGE_BYTES:
            reason = "size unknown" if total is None else "file too small"
            for key in ("mid", "mid_open", "suffix", "tail"):
                result[key] = _skipped(reason)
            result["supported"] = None
            return result

        mid = total // 2
        result["mid"] = await self._range(url, mid, mid + MID_RANGE_BYTES - 1, total)
        quarter = total // 4
        result["mid_open"] = await self._range(url, quarter, None, total)
        suffix = await self._range(url, None, TAIL_BYTES, total, keep=True)
        tail = await self._range(url, total - TAIL_BYTES, total - 1, total, keep=True)
        if suffix["range_ok"] and tail["range_ok"]:
            tail["matches_suffix"] = suffix["_data"] == tail["_data"]
        suffix.pop("_data", None)
        tail.pop("_data", None)
        result["suffix"], result["tail"] = suffix, tail
        checks = [result[k] for k in ("first_2", "mid", "mid_open", "suffix", "tail")]
        result["supported"] = all(c["range_ok"] for c in checks)
        return result

    async def _range(
        self,
        url: CameraUrl,
        start: int | None,
        end: int | None,
        total: int | None,
        *,
        keep: bool = False,
    ) -> dict[str, Any]:
        """One Range request: ``start-end``, ``start-`` or the suffix ``-end``."""
        if start is None:
            assert end is not None
            header = f"bytes=-{end}"
            expected = end
            want_start = total - end if total is not None else None
            want_end = total - 1 if total is not None else None
        elif end is None:
            header = f"bytes={start}-"
            # Open-ended: read like a player would, then close.
            expected = MID_RANGE_BYTES
            want_start, want_end = start, total - 1 if total is not None else None
        else:
            header = f"bytes={start}-{end}"
            expected = end - start + 1
            want_start, want_end = start, end
        open_ended = start is not None and end is None
        fetched = await self._fetch(
            url,
            range_header=header,
            # One byte more than asked for closed ranges, to catch a long body.
            max_bytes=expected if open_ended else expected + 1,
            keep_bytes=expected if keep else 0,
        )
        out = fetched.as_dict()
        out["verdict"] = range_verdict(fetched, want_start, want_end, total, expected)
        out["range_ok"] = out["verdict"] == "ok"
        if keep:
            out["_data"] = fetched.data
        return out

    async def _layout(
        self, url: CameraUrl, total: int | None, prefix: bytes, range_ok: bool
    ) -> dict[str, Any]:
        async def fetch(offset: int, length: int) -> bytes:
            end = offset + length - 1
            if total is not None:
                end = min(end, total - 1)
            got = await self._fetch(
                url,
                range_header=f"bytes={offset}-{end}",
                max_bytes=length,
                keep_bytes=length,
            )
            if got.status != 206:
                raise Mp4RangeError(got.error or f"HTTP {got.status}")
            return got.data

        reader = PrefixReader(prefix, fetch if range_ok else None, MAX_BOX_READS)
        try:
            layout = await async_layout(reader.read, total)
        except Mp4RangeError as err:
            return {
                "error": f"range read failed: {err}",
                "range_requests": reader.requests,
            }
        return {**layout.as_dict(), "range_requests": reader.requests}

    # ---- Simultaneous streams ----

    async def async_concurrency(
        self,
        files: list[tuple[int, VodFile]],
        main_files: list[tuple[int, VodFile]] | None = None,
    ) -> dict[str, Any]:
        """Open 1..N DOWNLOAD streams at once, one per channel, at a player pace.

        Then read one and two main-stream recordings at once at full speed.
        """
        if not self._options.concurrency_test:
            return _skipped("opt-in: playback concurrency_test")
        if not files:
            return _skipped("no channel with a sub-stream recording")
        levels_max = min(self._options.max_streams, len(files))
        hold = self._options.hold_seconds
        timeout = self._timeout + hold
        self._progress(f"playback: up to {levels_max} simultaneous streams (exclusive)")

        async def run_levels() -> dict[str, Any]:
            levels: list[dict[str, Any]] = []
            max_ok = 0
            first_failure: int | None = None
            for count in range(1, levels_max + 1):
                chosen = files[:count]
                urls = [
                    (await self._host.async_vod_url(ch, f, PLAYBACK_METHOD))[1]
                    for ch, f in chosen
                ]
                paces = [pace_bps(f) for _ch, f in chosen]
                results: list[FetchResult] = await asyncio.gather(
                    *(
                        async_fetch(
                            self._session,
                            url,
                            max_bytes=HOLD_MAX_BYTES,
                            max_seconds=hold,
                            pace_bps=pace,
                            timeout=timeout,
                        )
                        for url, pace in zip(urls, paces, strict=True)
                    )
                )
                streams = [
                    stream_verdict(r, pace, hold) | {"channel": ch}
                    for r, pace, (ch, _f) in zip(results, paces, chosen, strict=True)
                ]
                ok = all(s["ok"] for s in streams)
                levels.append(
                    {
                        "streams": count,
                        "ok": ok,
                        "ttfb_ms": [s["ttfb_ms"] for s in streams],
                        "mbit_s": [s["mbit_s"] for s in streams],
                        "total_mbit_s": round(
                            sum(s["mbit_s"] or 0 for s in streams), 2
                        ),
                        "detail": streams,
                    }
                )
                if not ok:
                    first_failure = count
                    break
                max_ok = count
                await asyncio.sleep(PLAYBACK_COOLDOWN)
            return {
                "max_streams_tested": levels_max,
                "max_ok": max_ok,
                "first_failure": first_failure,
                "pace_factor": PACE_FACTOR,
                "hold_s": hold,
                "levels": levels,
                "full_speed": await full_speed(),
            }

        async def full_speed() -> list[dict[str, Any]]:
            out: list[dict[str, Any]] = []
            for count in FULL_SPEED_LEVELS:
                chosen = (main_files or [])[:count]
                if len(chosen) < count:
                    break
                urls = [
                    (await self._host.async_vod_url(ch, f, PLAYBACK_METHOD))[1]
                    for ch, f in chosen
                ]
                results: list[FetchResult] = await asyncio.gather(
                    *(
                        async_fetch(
                            self._session,
                            url,
                            max_bytes=FULL_SPEED_MAX_BYTES,
                            max_seconds=hold,
                            timeout=timeout,
                        )
                        for url in urls
                    )
                )
                out.append(
                    {
                        "streams": count,
                        "stream": "main",
                        "ok": all(r.ok for r in results),
                        "channels": [ch for ch, _f in chosen],
                        "ttfb_ms": [r.ttfb_ms for r in results],
                        "mbit_s": [r.mbit_s for r in results],
                        "total_mbit_s": round(sum(r.mbit_s or 0 for r in results), 1),
                        "errors": sorted({r.error for r in results if r.error}),
                    }
                )
                await asyncio.sleep(PLAYBACK_COOLDOWN)
            return out

        try:
            levels = await self._job(
                run_levels,
                exclusive=True,
                timeout=(timeout + PLAYBACK_COOLDOWN + 5)
                * (levels_max + len(FULL_SPEED_LEVELS))
                + 10,
            )
        except Exception as err:  # noqa: BLE001
            return {"ok": False, "error": _err(err)}
        return {"ok": True, "stream": "sub", **levels}


class Mp4RangeError(Exception):
    """A range read for the MP4 layout failed."""


# ---- Pure helpers (tested directly) ----


_CONTENT_RANGE = re.compile(r"^\s*bytes\s+(\d+)-(\d+)/(\d+|\*)\s*$", re.IGNORECASE)


def parse_content_range(value: str | None) -> tuple[int, int, int | None] | None:
    """Parse 'bytes 100-199/1000' into (100, 199, 1000)."""
    if not value or (match := _CONTENT_RANGE.match(value)) is None:
        return None
    total = None if match.group(3) == "*" else int(match.group(3))
    return int(match.group(1)), int(match.group(2)), total


def range_verdict(
    fetched: FetchResult,
    want_start: int | None,
    want_end: int | None,
    total: int | None,
    expected: int,
) -> str:
    """Judge a Range answer: ok, ignored (200), unsatisfiable (416), or wrong."""
    if fetched.error and fetched.status is None:
        return "error"
    if fetched.status == 200:
        return "ignored"
    if fetched.status == 416:
        return "unsatisfiable"
    if fetched.status != 206:
        return "error"
    parsed = parse_content_range(fetched.content_range)
    if parsed is None:
        return "wrong: no Content-Range"
    start, end, size = parsed
    if total is not None and size is not None and size != total:
        return "wrong: total"
    if want_start is not None and start != want_start:
        return "wrong: start"
    if want_end is not None and end != want_end:
        return "wrong: end"
    if want_end is None and size is not None and end != size - 1:
        return "wrong: end"
    if fetched.bytes_read != expected:
        return "wrong: length"
    return "ok"


def pick_playback_file(files: Iterable[VodFile], now: datetime) -> VodFile | None:
    """Pick the newest finished recording, preferring ones of 30 s or more."""
    finished = [f for f in files if _naive_delta(now, f.end) >= RECORDING_SETTLE]
    for minimum in (PREFERRED_MIN_DURATION, MIN_DURATION):
        candidates = [f for f in finished if f.end - f.start >= minimum]
        if candidates:
            return max(candidates, key=lambda f: f.start)
    return None


def _naive_delta(a: datetime, b: datetime) -> timedelta:
    if (a.tzinfo is None) != (b.tzinfo is None):
        a, b = a.replace(tzinfo=None), b.replace(tzinfo=None)
    return a - b


def describe_file(file: VodFile) -> dict[str, Any]:
    """Describe the recording under test, including how its name encodes time."""
    duration = (file.end - file.start).total_seconds()
    result: dict[str, Any] = {
        "start": file.start.isoformat(),
        "end": file.end.isoformat(),
        "tz_aware": file.start.tzinfo is not None,
        "duration_s": round(duration),
        "size": file.size,
        "bitrate_kbps": round(file.size * 8 / duration / 1000)
        if file.size and duration > 0
        else None,
        "triggers": list(file.triggers),
    }
    base = file.name.rsplit("/", 1)[-1]
    match = _NAME.match(base)
    if match is None:
        # Unknown formats may embed identifiers: record only their shape and
        # whether they carry the recording's times (local or UTC) or a DST mark.
        result["name"] = {
            "format": "unrecognized",
            "length": len(base),
            "pattern": name_pattern(base),
            **_name_times(base, file),
        }
        return result
    name_start = datetime.strptime(match.group(2) + match.group(3), "%Y%m%d%H%M%S")
    result["name"] = {
        "basename": base,
        "dst_marker": match.group(1) is not None,
        "start_minus_search_start_s": (
            name_start - file.start.replace(tzinfo=None)
        ).total_seconds(),
    }
    return result


def name_pattern(name: str) -> str:
    """Return the shape of a name: digits as 9, letters as a/A, the rest kept."""
    return "".join(
        "9" if c.isdigit() else ("A" if c.isupper() else "a") if c.isalpha() else c
        for c in name
    )


def _name_times(name: str, file: VodFile) -> dict[str, bool]:
    local_start = file.start.replace(tzinfo=None)
    local_end = file.end.replace(tzinfo=None)
    result = {
        "has_local_start": _stamp(local_start) in name,
        "has_local_end": _stamp(local_end) in name
        or local_end.strftime("%H%M%S") in name,
        "has_dst_text": "dst" in name.lower(),
    }
    if file.start.tzinfo is not None:
        result["has_utc_start"] = _stamp(file.start.astimezone(UTC)) in name
    return result


def _stamp(value: datetime) -> str:
    return value.strftime("%Y%m%d%H%M%S")


def seek_verdict(
    got: FetchResult,
    full: FetchResult,
    layout: Mp4Layout,
    full_layout: Mp4Layout,
    same_start: bool | None,
) -> str:
    """Judge whether asking for mid-file made the device start there."""
    if not got.ok:
        return "error"
    ratio: float | None = None
    if layout.duration_s and full_layout.duration_s:
        ratio = layout.duration_s / full_layout.duration_s
    elif got.eof and full.eof and full.bytes_read:
        ratio = got.bytes_read / full.bytes_read
    if ratio is not None:
        if ratio < 0.75:
            return "seeks"
        if 0.95 <= ratio <= 1.05:
            return "ignored"
        return "unclear"
    if same_start is True:
        return "ignored (same first bytes)"
    if same_start is False:
        return "likely seeks (different first bytes)"
    return "unknown"


def _dist(values: list[float]) -> dict[str, float] | None:
    if not values:
        return None
    ordered = sorted(values)
    return {
        "min": round(ordered[0], 1),
        "p50": round(statistics.median(ordered), 1),
        "p90": round(ordered[min(len(ordered) - 1, int(len(ordered) * 0.9))], 1),
        "max": round(ordered[-1], 1),
    }


def file_stats(files: list[VodFile]) -> dict[str, Any]:
    """Duration, size, bitrate and gap distribution of a day's recordings."""
    durations = [(f.end - f.start).total_seconds() for f in files]
    sizes = [float(f.size) for f in files if f.size]
    bitrates = [
        f.size * 8 / d / 1000
        for f, d in zip(files, durations, strict=True)
        if f.size and d > 0
    ]
    ordered = sorted(files, key=lambda f: f.start)
    gaps = [(b.start - a.end).total_seconds() for a, b in pairwise(ordered)]
    triggers = Counter(t for f in files for t in f.triggers)
    return {
        "files": len(files),
        "recorded_s": round(sum(durations)),
        "duration_s": _dist(durations),
        "size_bytes": _dist(sizes),
        "size_total": int(sum(sizes)),
        "bitrate_kbps": _dist(bitrates),
        "gaps_over_1s": sum(1 for g in gaps if g > 1),
        "max_gap_s": round(max(gaps, default=0.0)),
        "overlaps": sum(1 for g in gaps if g < 0),
        "dst_names": sum(1 for f in files if "_DST" in f.name.rsplit("/", 1)[-1]),
        "triggers": dict(triggers.most_common()),
    }


def realtime_factor(fetched: FetchResult, file: VodFile) -> float | None:
    """Throughput divided by the recording's bitrate (how much faster than real time)."""
    duration = (file.end - file.start).total_seconds()
    size = fetched.content_length if fetched.status == 200 else None
    size = size or file.size
    if not fetched.mbit_s or not size or duration <= 0:
        return None
    media_mbit_s = size * 8 / duration / 1e6
    return round(fetched.mbit_s / media_mbit_s, 1) if media_mbit_s else None


def pace_bps(file: VodFile) -> float | None:
    """Bytes per second a player buffering ahead would read this file at."""
    duration = (file.end - file.start).total_seconds()
    if not file.size or duration <= 0:
        return None
    return file.size / duration * PACE_FACTOR


def stream_verdict(
    fetched: FetchResult, pace: float | None, hold: float
) -> dict[str, Any]:
    """Was one simultaneous stream served: answered, kept open and kept up."""
    held = (fetched.read_ms or 0) >= hold * 900 or fetched.eof
    kept_up: bool | None = None
    if pace and fetched.read_ms and not fetched.eof:
        achieved = fetched.bytes_read / (fetched.read_ms / 1000)
        kept_up = achieved >= pace * 0.8
    ok = fetched.ok and held and kept_up is not False
    return {
        "ok": ok,
        "status": fetched.status,
        "ttfb_ms": fetched.ttfb_ms,
        "mbit_s": fetched.mbit_s,
        "bytes": fetched.bytes_read,
        "eof": fetched.eof,
        "held": held,
        "kept_up": kept_up,
        "error": fetched.error,
    }

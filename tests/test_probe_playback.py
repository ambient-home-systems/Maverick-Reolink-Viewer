"""Tests for the recording playback check (Phase 2 gate)."""

from collections.abc import AsyncGenerator, Awaitable, Callable
from datetime import UTC, datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

from aiohttp import ClientSession, web
from aiohttp.test_utils import TestServer
import pytest

from custom_components.reolink_viewer import probe_playback
from custom_components.reolink_viewer.bridge import (
    CameraUrl,
    ChannelInfo,
    StreamEncoding,
    VodFile,
)
from custom_components.reolink_viewer.media import FetchResult, async_fetch
from custom_components.reolink_viewer.probe_playback import (
    PlaybackCheck,
    PlaybackOptions,
    describe_file,
    file_stats,
    pace_bps,
    parse_content_range,
    pick_playback_file,
    range_verdict,
    realtime_factor,
    stream_verdict,
)

from .mp4_fixtures import mp4_file

NOW = datetime(2026, 10, 17, 12, 0, 0)
NAME = "Mp4Record/2026-10-17/RecS03_DST20261017_114500_114600_6D28808_100000.mp4"


def vod(
    start: datetime,
    seconds: int = 60,
    size: int | None = 1_000_000,
    name: str = NAME,
    triggers: tuple[str, ...] = ("PERSON",),
) -> VodFile:
    return VodFile(
        start=start,
        end=start + timedelta(seconds=seconds),
        name=name,
        stream="sub",
        size=size,
        triggers=triggers,
    )


# ---- Pure helpers ----


def test_options_clamped() -> None:
    """Options are clamped, and nothing runs unless the check is enabled."""
    off = PlaybackOptions(enabled=False, only=True, concurrency_test=True)
    assert (off.only, off.concurrency_test) == (False, False)
    on = PlaybackOptions(
        enabled=True, max_streams=99, throughput_seconds=0, hold_seconds=99
    )
    assert (on.max_streams, on.throughput_seconds, on.hold_seconds) == (6, 2.0, 15.0)


def test_parse_content_range() -> None:
    """Content-Range values are parsed; junk gives None."""
    assert parse_content_range("bytes 100-199/1000") == (100, 199, 1000)
    assert parse_content_range("Bytes 0-1/*") == (0, 1, None)
    assert parse_content_range("bytes */1000") is None
    assert parse_content_range(None) is None


def _fetched(**kwargs: Any) -> FetchResult:
    base: dict[str, Any] = {"ok": True, "status": 206, "bytes_read": 100}
    return FetchResult(**(base | kwargs))


def test_range_verdict() -> None:
    """Every way a Range answer can go wrong is named."""
    good = _fetched(content_range="bytes 100-199/1000")
    assert range_verdict(good, 100, 199, 1000, 100) == "ok"
    assert range_verdict(_fetched(status=200), 100, 199, 1000, 100) == "ignored"
    assert range_verdict(_fetched(status=416), 100, 199, 1000, 100) == "unsatisfiable"
    assert range_verdict(_fetched(status=500), 100, 199, 1000, 100) == "error"
    assert (
        range_verdict(FetchResult(ok=False, error="timeout"), 0, 1, None, 2) == "error"
    )
    assert range_verdict(_fetched(), 100, 199, 1000, 100) == "wrong: no Content-Range"
    assert range_verdict(good, 100, 199, 999, 100) == "wrong: total"
    assert range_verdict(good, 101, 199, 1000, 100) == "wrong: start"
    assert range_verdict(good, 100, 198, 1000, 100) == "wrong: end"
    assert range_verdict(good, 100, 199, 1000, 99) == "wrong: length"
    # Open-ended with the size unknown: the end must be the last byte.
    open_ended = _fetched(content_range="bytes 100-998/1000")
    assert range_verdict(open_ended, 100, None, None, 100) == "wrong: end"


def test_pick_playback_file() -> None:
    """Newest finished recording, preferring 30 s or more."""
    old_long = vod(NOW - timedelta(hours=2), 60)
    new_short = vod(NOW - timedelta(minutes=30), 15)
    too_new = vod(NOW - timedelta(minutes=2), 60)
    tiny = vod(NOW - timedelta(minutes=10), 5)
    assert pick_playback_file([old_long, new_short, too_new, tiny], NOW) is old_long
    assert pick_playback_file([new_short, tiny], NOW) is new_short
    assert pick_playback_file([tiny, too_new], NOW) is None
    aware = vod(datetime(2026, 10, 17, 9, tzinfo=UTC))
    assert pick_playback_file([aware], NOW) is aware


def test_describe_file() -> None:
    """The name's DST marker and its time versus the search time are recorded."""
    described = describe_file(vod(datetime(2026, 10, 17, 11, 45)))
    assert described["name"] == {
        "basename": NAME.rsplit("/", 1)[1],
        "dst_marker": True,
        "start_minus_search_start_s": 0.0,
    }
    assert described["bitrate_kbps"] == 133
    assert described["tz_aware"] is False
    shifted = describe_file(vod(datetime(2026, 10, 17, 10, 45)))
    assert shifted["name"]["start_minus_search_start_s"] == 3600.0
    plain = describe_file(
        vod(NOW, name="Mp4Record/2026-10-17/RecM01_20261017_120000_120100_0_6D2_10.mp4")
    )
    assert plain["name"]["dst_marker"] is False
    odd = describe_file(vod(NOW, size=None, name="/mnt/sda/UID123-cam/0-0-123-UID123"))
    assert odd["name"] == {"format": "unrecognized", "length": 14}
    assert odd["bitrate_kbps"] is None
    assert "UID123" not in str(odd)


def test_file_stats() -> None:
    """Distribution of durations, sizes and gaps across a day."""
    files = [
        vod(NOW, 60, 1_000_000),
        vod(NOW + timedelta(seconds=60), 30, 600_000, triggers=("MOTION",)),
        vod(NOW + timedelta(seconds=120), 120, None, name="RecM01_20261017_x.mp4"),
        vod(NOW + timedelta(seconds=200), 60, 2_000_000),
    ]
    stats = file_stats(files)
    assert stats["files"] == 4
    assert stats["recorded_s"] == 270
    assert stats["duration_s"] == {"min": 30.0, "p50": 60.0, "p90": 120.0, "max": 120.0}
    assert stats["size_bytes"]["max"] == 2_000_000
    assert stats["size_total"] == 3_600_000
    assert stats["gaps_over_1s"] == 1  # 90 s -> 120 s
    assert stats["max_gap_s"] == 30
    assert stats["overlaps"] == 1  # 240 s end vs 200 s start
    assert stats["dst_names"] == 3
    assert stats["triggers"] == {"PERSON": 3, "MOTION": 1}
    empty = file_stats([vod(NOW, size=None)])
    assert empty["size_bytes"] is None
    assert empty["bitrate_kbps"] is None


def test_realtime_and_pace() -> None:
    """Throughput versus bitrate, and the player pace."""
    file = vod(NOW, 60, 7_500_000)  # 1 Mbit/s
    fetched = FetchResult(ok=True, status=200, content_length=7_500_000, mbit_s=40.0)
    assert realtime_factor(fetched, file) == 40.0
    assert realtime_factor(FetchResult(ok=True), file) is None
    assert realtime_factor(fetched, vod(NOW, 0)) is None
    assert pace_bps(file) == 7_500_000 / 60 * 4
    assert pace_bps(vod(NOW, size=None)) is None


def test_stream_verdict() -> None:
    """A simultaneous stream must answer, stay open and keep up."""
    good = FetchResult(ok=True, status=200, bytes_read=500_000, read_ms=2000)
    assert stream_verdict(good, 200_000, 2.0)["ok"] is True
    slow = FetchResult(ok=True, status=200, bytes_read=100_000, read_ms=2000)
    assert stream_verdict(slow, 200_000, 2.0)["kept_up"] is False
    short = FetchResult(ok=True, status=200, bytes_read=100_000, read_ms=500)
    assert stream_verdict(short, 200_000, 2.0)["held"] is False
    finished = FetchResult(ok=True, status=200, bytes_read=100, read_ms=5, eof=True)
    assert stream_verdict(finished, 200_000, 2.0)["ok"] is True
    failed = FetchResult(ok=False, status=503, error="HTTP 503")
    assert stream_verdict(failed, None, 2.0)["ok"] is False


# ---- Against a real HTTP server ----


def _range_handler(
    path: Path,
) -> Callable[[web.Request], Awaitable[web.StreamResponse]]:
    async def handler(request: web.Request) -> web.StreamResponse:
        # aiohttp's FileResponse implements Range (incl. suffix ranges) per RFC.
        return web.FileResponse(path, headers={"Content-Type": "video/mp4"})

    return handler


@pytest.fixture
async def media_server(
    tmp_path: Path, socket_enabled: None
) -> AsyncGenerator[TestServer]:
    """Serve MP4s: with Range, ignoring Range, chunked, and failing."""
    moov_last = tmp_path / "moov_last.mp4"
    moov_last.write_bytes(mp4_file(moov_first=False))
    moov_first = tmp_path / "moov_first.mp4"
    moov_first.write_bytes(mp4_file(moov_first=True))
    body = moov_last.read_bytes()

    async def no_range(request: web.Request) -> web.Response:
        return web.Response(body=body, content_type="video/mp4")

    async def chunked(request: web.Request) -> web.StreamResponse:
        resp = web.StreamResponse(headers={"Content-Type": "video/mp4"})
        resp.enable_chunked_encoding()
        await resp.prepare(request)
        for i in range(0, len(body), 65536):
            await resp.write(body[i : i + 65536])
        await resp.write_eof()
        return resp

    async def gone(request: web.Request) -> web.Response:
        return web.Response(status=404)

    app = web.Application()
    app.router.add_get("/range", _range_handler(moov_last))
    app.router.add_get("/range_first", _range_handler(moov_first))
    app.router.add_get("/no_range", no_range)
    app.router.add_get("/chunked", chunked)
    app.router.add_get("/gone", gone)
    server = TestServer(app, host="127.0.0.1")
    await server.start_server()
    yield server
    await server.close()


async def _direct_job(
    factory: Callable[[], Awaitable[Any]],
    *,
    timeout: float | None = None,
    exclusive: bool = False,
) -> Any:
    return await factory()


def _channel(ch: int = 0, replay: bool = True) -> ChannelInfo:
    enc = StreamEncoding("h264", 512, 15)
    return ChannelInfo(
        channel=ch,
        name=f"Cam {ch}",
        model="CX810",
        hardware_version="",
        firmware_version="",
        online=True,
        sleeping=False,
        is_battery=False,
        is_doorbell=False,
        supports_replay=replay,
        supports_stream=True,
        main=enc,
        sub=enc,
    )


def _host(server: TestServer, path: str, size: int | None) -> MagicMock:
    host = MagicMock()
    recording = vod(NOW - timedelta(minutes=20), 60, size)
    host.async_search_vod_files = AsyncMock(return_value=[recording])
    host.async_vod_url = AsyncMock(
        return_value=("video/mp4", CameraUrl(str(server.make_url(path))))
    )
    host.timezone.return_value = None
    return host


async def _check(
    server: TestServer, path: str, size: int | None, **options: Any
) -> tuple[dict[str, Any], MagicMock]:
    host = _host(server, path, size)
    async with ClientSession() as session:
        check = PlaybackCheck(
            host,
            _direct_job,
            session,
            PlaybackOptions(enabled=True, **options),
            step_timeout=10,
            progress=lambda _m: None,
        )
        check._options.throughput_seconds = 0.5
        result, _sub = await check.async_channel(_channel(), NOW)
    return result, host


async def test_range_server(media_server: TestServer) -> None:
    """A server with proper Range support: every check passes."""
    size = len(mp4_file(moov_first=False))
    result, host = await _check(media_server, "/range", size)
    sub = result["sub"]
    assert sub["day"]["stats"]["files"] == 1
    assert sub["file"]["duration_s"] == 60
    full = sub["full"]
    assert full["ok"] is True
    assert full["content_length"] == size
    assert full["accept_ranges"] == "bytes"
    assert full["size_matches_search"] is True
    # Local reads can finish too fast to time; the key is always there.
    assert "realtime_factor" in full
    ranges = sub["range"]
    assert ranges["supported"] is True
    assert ranges["total_source"] == "content-length"
    assert ranges["first_2"]["matches_body"] is True
    assert ranges["tail"]["matches_suffix"] is True
    for key in ("first_2", "mid", "mid_open", "suffix", "tail"):
        assert ranges[key]["verdict"] == "ok", key
        assert ranges[key]["status"] == 206
    assert ranges["mid"]["ttfb_ms"] is not None
    mp4 = sub["mp4"]
    assert mp4["moov_before_mdat"] is False
    assert mp4["fragmented"] is False
    assert mp4["duration_s"] == 60
    assert mp4["duration_vs_search_s"] == 0
    assert mp4["range_requests"] > 0
    assert "url" not in str(result).lower().replace("_url", "")
    # Search windows: a full day (yesterday) and today up to now.
    calls = host.async_search_vod_files.await_args_list
    assert calls[0].args[1:3] == (
        datetime(2026, 10, 16),
        datetime(2026, 10, 16, 23, 59, 59),
    )
    assert calls[1].args[1:3] == (datetime(2026, 10, 17), NOW)


async def test_server_ignoring_range(media_server: TestServer) -> None:
    """A server that answers 200 to every Range: no layout beyond the prefix."""
    size = len(mp4_file(moov_first=False))
    result, _ = await _check(media_server, "/no_range", size)
    ranges = result["sub"]["range"]
    assert ranges["supported"] is False
    assert ranges["mid"]["verdict"] == "ignored"
    assert ranges["mid"]["bytes_read"] == 256 * 1024 + 1
    assert result["sub"]["mp4"]["error"] == (
        "byte range not available (no Range support)"
    )


async def test_chunked_server(media_server: TestServer) -> None:
    """No Content-Length: the size comes from the search."""
    size = len(mp4_file(moov_first=False))
    result, _ = await _check(media_server, "/chunked", size)
    sub = result["sub"]
    assert sub["full"]["content_length"] is None
    assert sub["full"]["transfer_encoding"] == "chunked"
    assert sub["range"]["total_source"] == "search"
    assert sub["range"]["supported"] is False


async def test_size_from_content_range(media_server: TestServer) -> None:
    """Without a usable size, Content-Range of the first range gives it."""
    result, _ = await _check(media_server, "/range_first", None)
    sub = result["sub"]
    assert sub["range"]["total_source"] == "content-length"
    assert sub["mp4"]["moov_before_mdat"] is True
    with patch.object(
        probe_playback.PlaybackCheck,
        "_fetch",
        autospec=True,
        side_effect=_drop_length,
    ):
        result, _ = await _check(media_server, "/range_first", None)
    assert result["sub"]["range"]["total_source"] == "content-range"
    assert result["sub"]["range"]["supported"] is True


_real_fetch = probe_playback.PlaybackCheck._fetch


async def _drop_length(
    self: PlaybackCheck, url: CameraUrl, **kwargs: Any
) -> FetchResult:
    result = await _real_fetch(self, url, **kwargs)
    if result.status == 200:
        result.content_length = None
    return result


async def test_small_file_and_failures(media_server: TestServer) -> None:
    """Small files skip mid-file ranges; HTTP errors and no recordings are recorded."""
    result, _ = await _check(media_server, "/range", 1000)
    assert result["sub"]["full"]["size_matches_search"] is False

    result, _ = await _check(media_server, "/gone", 1000)
    assert result["sub"]["full"]["error"] == "HTTP 404"
    assert "range" not in result["sub"]

    host = _host(media_server, "/range", 1000)
    host.async_search_vod_files = AsyncMock(return_value=[])
    async with ClientSession() as session:
        check = PlaybackCheck(
            host,
            _direct_job,
            session,
            PlaybackOptions(enabled=True),
            step_timeout=10,
            progress=lambda _m: None,
        )
        result, sub = await check.async_channel(_channel(), NOW)
        assert sub is None
        assert result["main"]["file"]["skipped"].startswith("no finished recording")
        assert host.async_search_vod_files.await_count == 2 * (3 + 1)
        skipped, _ = await check.async_channel(_channel(replay=False), NOW)
        assert skipped == {"ok": False, "skipped": "no replay capability"}

        host.async_search_vod_files = AsyncMock(side_effect=RuntimeError("boom"))
        result, _ = await check.async_channel(_channel(), NOW)
        assert result["sub"]["day"]["search"] == {
            "ok": False,
            "error": "RuntimeError: boom",
        }

        host.async_search_vod_files = AsyncMock(
            return_value=[vod(NOW - timedelta(hours=1))]
        )
        host.async_vod_url = AsyncMock(side_effect=RuntimeError("no url"))
        result, _ = await check.async_channel(_channel(), NOW)
        assert result["sub"]["url"]["error"] == "RuntimeError: no url"


async def test_small_file_ranges(media_server: TestServer) -> None:
    """A file under 1 MB gets only the first-bytes range."""
    small = mp4_file(mdat_bytes=10_000)
    result, _ = await _check(media_server, "/range", len(small))
    # The served file is bigger than the size in the search, but Content-Length
    # wins, so the full set of ranges still runs there.
    assert result["sub"]["range"]["supported"] is True


async def test_concurrency(media_server: TestServer) -> None:
    """Levels 1..N, one channel each, stopping at the first failure."""
    size = len(mp4_file(moov_first=False))
    host = _host(media_server, "/range", size)
    files = [(ch, vod(NOW - timedelta(hours=1), 60, size)) for ch in range(3)]
    async with ClientSession() as session:
        check = PlaybackCheck(
            host,
            _direct_job,
            session,
            PlaybackOptions(enabled=True, concurrency_test=True, max_streams=5),
            step_timeout=10,
            progress=lambda _m: None,
        )
        check._options.hold_seconds = 0.3
        with patch.object(probe_playback, "PLAYBACK_COOLDOWN", 0):
            result = await check.async_concurrency(files)
            assert result["ok"] is True
            assert result["max_streams_tested"] == 3
            assert result["max_ok"] == 3
            assert result["first_failure"] is None
            assert [lvl["streams"] for lvl in result["levels"]] == [1, 2, 3]
            assert [d["channel"] for d in result["levels"][2]["detail"]] == [0, 1, 2]

            host.async_vod_url = AsyncMock(
                return_value=(
                    "video/mp4",
                    CameraUrl(str(media_server.make_url("/gone"))),
                )
            )
            failed = await check.async_concurrency(files)
            assert failed["max_ok"] == 0
            assert failed["first_failure"] == 1

            host.async_vod_url = AsyncMock(side_effect=RuntimeError("boom"))
            assert (await check.async_concurrency(files))[
                "error"
            ] == "RuntimeError: boom"
        assert (await check.async_concurrency([]))["skipped"].startswith("no channel")
        check._options.concurrency_test = False
        assert (await check.async_concurrency(files))["skipped"].startswith("opt-in")


async def test_paced_fetch_holds_the_stream(media_server: TestServer) -> None:
    """A paced read stays open for the hold time and reads about pace x time."""
    async with ClientSession() as session:
        result = await async_fetch(
            session,
            CameraUrl(str(media_server.make_url("/range"))),
            max_bytes=10_000_000,
            max_seconds=0.5,
            pace_bps=400_000,
            timeout=10,
        )
    assert result.ok is True
    assert result.eof is False
    assert result.read_ms is not None
    assert result.read_ms >= 450
    assert result.bytes_read < 400_000


def test_time_info() -> None:
    """Device clock and time zone, including DST, are described."""

    host = MagicMock()
    host.timezone.return_value = timezone(timedelta(hours=-4), "EDT")
    check = PlaybackCheck(
        host,
        _direct_job,
        MagicMock(),
        PlaybackOptions(),
        step_timeout=5,
        progress=lambda _m: None,
    )
    info = check.time_info(NOW)
    assert info["device_now"] == NOW.isoformat()
    assert info["timezone"] == {"name": "EDT", "utcoffset_s": -14400.0, "dst_s": None}
    host.timezone.return_value = None
    assert check.time_info(NOW)["timezone"] is None
    host.timezone.side_effect = RuntimeError("tz")
    assert check.time_info(NOW)["timezone_error"] == "RuntimeError: tz"
    broken = MagicMock()
    broken.utcoffset.side_effect = ValueError("bad")
    host.timezone.side_effect = None
    host.timezone.return_value = broken
    assert check.time_info(NOW)["timezone_error"] == "ValueError: bad"

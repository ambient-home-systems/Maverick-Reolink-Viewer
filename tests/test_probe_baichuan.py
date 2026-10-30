"""The Baichuan replay and download check, with a fake client and a fake HTTP fetch."""

import asyncio
from collections.abc import Callable
from dataclasses import replace
from datetime import datetime, timedelta
import json
from typing import Any, ClassVar, cast
from unittest.mock import ANY, AsyncMock, MagicMock, patch

import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.reolink_viewer import bridge, probe, probe_baichuan
from custom_components.reolink_viewer.baichuan_client import (
    BaichuanClientError,
    StreamStats,
)
from custom_components.reolink_viewer.bridge import BaichuanEndpoint, VodFile
from custom_components.reolink_viewer.media import FetchResult
from custom_components.reolink_viewer.probe import ProbeOptions, Prober
from custom_components.reolink_viewer.probe_baichuan import (
    BaichuanCheck,
    BaichuanOptions,
    pick_recording,
    target_in,
)
from custom_components.reolink_viewer.scheduler import Priority, Scheduler
from homeassistant.core import HomeAssistant

from .conftest import SECRETS, TEST_NOW, make_vod_file
from .test_probe import FakeMedia


def vod(start: datetime, minutes: int, size: int | None = 100_000_000) -> VodFile:
    return VodFile(
        start=start,
        end=start + timedelta(minutes=minutes),
        name=f"1-18-0-0126{start:%m%d%H%M%S}-00000",
        stream="sub",
        size=size,
        triggers=(),
    )


def test_pick_target_and_options() -> None:
    day = datetime(2026, 10, 16, 5, 0, 1)
    short = vod(day, 5)
    long = vod(day + timedelta(hours=1), 60)
    longer = vod(day + timedelta(hours=2), 61, size=None)  # no size: not usable
    now = datetime(2026, 10, 16, 12, 0, 0)
    assert pick_recording([short], now) is None
    assert pick_recording([short, long, longer], now) is long
    # A recording that ended a moment ago may still be growing.
    assert pick_recording([long], datetime(2026, 10, 16, 7, 1, 0)) is None
    assert pick_recording([long], datetime(2026, 10, 16, 7, 2, 1)) is long
    when, offset = target_in(long)
    assert when == datetime(2026, 10, 16, 6, 45, 1)
    assert offset == 75_000_000
    options = BaichuanOptions(hold_seconds=999, cut_seconds=1, streams=("ext", "x"))
    assert options.hold_seconds == 120.0
    assert options.cut_seconds == 5.0
    assert options.streams == ("sub",)
    channel = MagicMock(name="Front Yard Right")
    channel.name = "Front Yard Right"
    channel.model = "Reolink Duo 3 PoE"
    assert BaichuanOptions().wanted(channel)
    assert BaichuanOptions(cameras=" front, garage ").wanted(channel)
    assert BaichuanOptions(cameras="Duo 3, CX810").wanted(channel)  # the model
    assert not BaichuanOptions(cameras="garage").wanted(channel)


class FakeClient:
    """Stands in for BaichuanReplayClient: records the sequence, feeds frames."""

    instances: ClassVar[list[FakeClient]] = []
    fail_at: ClassVar[str | None] = None
    key_frame: ClassVar[bool] = True
    refuse_channel_bit: ClassVar[bool] = False
    cut_ends: ClassVar[bool] = True

    def __init__(self, endpoint: BaichuanEndpoint, *, timeout: float) -> None:
        self.endpoint = endpoint
        self.timeout = timeout
        self.calls: list[tuple[str, tuple[Any, ...]]] = []
        self.device_type = "nvr"
        self.stats: StreamStats | None = None
        self.open_streams = 0
        FakeClient.instances.append(self)

    async def connect(self) -> None:
        self.calls.append(("connect", ()))
        if FakeClient.fail_at == "connect":
            raise OSError("no route")

    async def login(self) -> dict[str, float]:
        self.calls.append(("login", ()))
        if FakeClient.fail_at == "login":
            raise BaichuanClientError("login refused with status 401")
        return {"nonce_ms": 5.0, "login_ms": 40.0}

    async def seek(self, channel: int, when: datetime) -> float:
        self.calls.append(("seek", (channel, when)))
        return 17.0

    def _stats(self, on_chunk: Callable[[StreamStats], None] | None) -> StreamStats:
        stats = StreamStats(started=0.0)
        self.stats = stats
        self.open_streams += 1
        if FakeClient.key_frame:
            stats.first_chunk = 0.064
            stats.last_chunk = 2.0
            stats.first_key_frame = 0.07
            stats.first_key_time = datetime(2026, 10, 16, 6, 44, 59)
            stats.last_key_time = datetime(2026, 10, 16, 6, 45, 11)
            stats.key_frames = 3
            stats.frames = 40
            stats.chunks = 4
            stats.total_bytes = 160_000
            if on_chunk is not None:
                on_chunk(stats)
        return stats

    async def start(
        self,
        channel: int,
        file_id: str,
        uid: str,
        stream: str,
        *,
        speed: int = 1,
        on_chunk: Callable[[StreamStats], None] | None = None,
    ) -> tuple[float, StreamStats]:
        self.calls.append(("start", (channel, file_id, uid, stream, speed)))
        return 72.0, self._stats(on_chunk)

    async def stop(self, channel: int, name: str, stream: str) -> float:
        self.calls.append(("stop", (channel, name, stream)))
        self.open_streams -= 1
        return 20.0

    async def download(
        self,
        channel: int,
        stream: str,
        start: datetime,
        end: datetime,
        *,
        bitmap: int | None = None,
        on_chunk: Callable[[StreamStats], None] | None = None,
    ) -> tuple[float, StreamStats, dict[str, str]]:
        self.calls.append(("download", (channel, stream, start, end, bitmap)))
        if FakeClient.refuse_channel_bit and bitmap is None:
            raise BaichuanClientError("download refused with status 400")
        stats = self._stats(None)
        if FakeClient.cut_ends:
            stats.end_status = 300
            stats.ended_at = 0.4
        if on_chunk is not None:
            on_chunk(stats)
        return 100.0, stats, {"sizeL": "4210000", "sizeH": "0", "FileCount": "1"}

    async def download_end(self, channel: int) -> tuple[float, int]:
        self.calls.append(("download_end", (channel,)))
        self.open_streams -= 1
        return 30.0, 200

    async def logout(self) -> None:
        self.calls.append(("logout", ()))

    async def close(self) -> None:
        self.calls.append(("close", ()))


async def fake_fetch(session: Any, url: Any, **kwargs: Any) -> FetchResult:
    assert "cmd=Download" in url.value
    return FetchResult(
        ok=True,
        status=200,
        ttfb_ms=140.0,
        read_ms=6800.0,
        bytes_read=kwargs["max_bytes"],
        mbit_s=90.0,
    )


@pytest.fixture(autouse=True)
def _reset_fake() -> None:
    FakeClient.instances = []
    FakeClient.fail_at = None
    FakeClient.key_frame = True
    FakeClient.refuse_channel_bit = False
    FakeClient.cut_ends = True


@pytest.fixture
def long_recording(reolink_host: MagicMock) -> None:
    day = TEST_NOW.replace(hour=5, minute=0, second=1) - timedelta(days=1)
    reolink_host.request_vod_files.return_value = (
        [],
        [
            make_vod_file(day, minutes=3),
            make_vod_file(day + timedelta(hours=1), minutes=60),
        ],
    )
    reolink_host.send = AsyncMock(
        return_value=[
            {
                "cmd": "GetOnline",
                "value": {"User": [{"userName": "a"}, {"userName": "b"}]},
                "range": {"User": {"maxNum": 10}},
            }
        ]
    )


def _check(
    hass: HomeAssistant, scheduler: Scheduler, options: BaichuanOptions | None = None
) -> tuple[BaichuanCheck, bridge.ReolinkHostHandle]:
    (host,) = bridge.async_get_hosts(hass)

    def job(
        factory: Any, *, timeout: float | None = None, exclusive: bool = False
    ) -> Any:
        return scheduler.run(host.entry_id, factory, priority=Priority.PLAYBACK)

    check = BaichuanCheck(
        host,
        job,
        MagicMock(),
        scheduler.host(host.entry_id),
        options or BaichuanOptions(enabled=True, hold_seconds=1),
        step_timeout=5,
        progress=lambda _m: None,
        client_factory=cast(Any, FakeClient),
        fetch=fake_fetch,
    )
    return check, host


def _calls(client: FakeClient) -> list[str]:
    return [c[0] for c in client.calls]


async def test_check_measures_replay_download_and_http(
    hass: HomeAssistant, loaded_reolink: MockConfigEntry, long_recording: None
) -> None:
    scheduler = Scheduler(default_limit=2)
    check, host = _check(hass, scheduler)
    info = host.info()
    with patch.object(asyncio, "sleep", AsyncMock()):
        result = await check.async_host(info, list(info.channels), TEST_NOW)
    await scheduler.async_shutdown()
    assert result["ok"] is True
    assert result["streams"] == ["sub"]
    assert result["users_before"] == {"count": 2}
    assert result["users_after"] == {"count": 2}
    assert result["online"]["count"] == 2
    assert result["online"]["limits"] == {"range.User.maxNum": 10}
    assert result["channels_left_out"] == []
    (entry,) = result["channels"]
    assert entry["channel"] == 0
    assert "session" not in result
    sub = entry["sub"]
    assert sub["ok"] is True
    assert sub["target"]["offset_s"] == 2700.0
    assert sub["target"]["bytes"] == 786432
    replay = sub["replay"]
    assert replay["ok"] is True
    assert replay["seek_ms"] == 17.0
    assert replay["start_ms"] == 72.0
    assert replay["stream"]["first_key_frame_ms"] == 70.0
    assert replay["stream"]["key_frame_vs_asked_s"] == -2.0
    assert replay["stream"]["media_s"] == 12.0
    assert replay["stream"]["wall_s"] == 1.94
    assert replay["stream"]["media_per_wall_s"] == 6.2
    assert replay["stream"]["media"]["video"]["codec"] is None
    assert replay["users_during"] == {"count": 2}
    assert replay["chunks_after_stop"] == 0
    assert replay["device_type"] == "nvr"
    download = sub["download"]
    assert download["ok"] is True
    assert download["bitmap"] == "channel bit"
    assert download["reply_ms"] == 100.0
    assert download["reply"] == {"sizeL": "4210000", "sizeH": "0", "FileCount": "1"}
    assert download["ended_within_hold"] is True
    assert download["end"] == {"ms": 30.0, "status": 200}
    assert download["chunks_after_144"] == 0
    assert download["stream"]["end_status"] == 300
    assert download["asked"]["end"] == "2026-10-16T06:45:21"
    assert sub["http"]["to_target_ms"] == 6940.0
    assert sub["http"]["reached_target"] is True
    replay_client, download_client = FakeClient.instances
    assert _calls(replay_client) == [
        "connect",
        "login",
        "seek",
        "start",
        "stop",
        "logout",
    ]
    assert _calls(download_client) == [
        "connect",
        "login",
        "download",
        "download_end",
        "logout",
    ]
    seek = replay_client.calls[2][1]
    assert seek == (0, datetime(2026, 10, 16, 6, 45, 1))
    start = replay_client.calls[3][1]
    assert start[0] == 0
    assert start[3] == "subStream"
    assert start[4] == 1
    assert replay_client.calls[4][1][1] == "0120261016060001"
    assert replay_client.endpoint.port == 5678
    cut = download_client.calls[2][1]
    assert cut == (
        0,
        "subStream",
        datetime(2026, 10, 16, 6, 45, 1),
        datetime(2026, 10, 16, 6, 45, 21),
        None,
    )
    text = json.dumps(result)
    for secret in SECRETS:
        assert secret not in text


async def test_check_main_stream_without_download(
    hass: HomeAssistant, loaded_reolink: MockConfigEntry, long_recording: None
) -> None:
    scheduler = Scheduler(default_limit=2)
    options = BaichuanOptions(
        enabled=True, hold_seconds=1, streams=("sub", "main"), download=False
    )
    check, host = _check(hass, scheduler, options)
    info = host.info()
    with patch.object(asyncio, "sleep", AsyncMock()):
        result = await check.async_host(info, list(info.channels), TEST_NOW)
    await scheduler.async_shutdown()
    (entry,) = result["channels"]
    assert entry["sub"]["ok"]
    assert entry["main"]["ok"]
    assert "download" not in entry["sub"]
    assert "skipped" in entry["main"]["http"]
    assert entry["main"]["replay"]["ok"] is True
    main_client = FakeClient.instances[1]
    assert main_client.calls[3][1][3] == "mainStream"
    assert main_client.calls[4][1][2] == "mainStream"
    assert all("download" not in _calls(c) for c in FakeClient.instances)


async def test_check_records_failures(
    hass: HomeAssistant, loaded_reolink: MockConfigEntry, long_recording: None
) -> None:
    scheduler = Scheduler(default_limit=2)
    check, host = _check(hass, scheduler)
    info = host.info()
    FakeClient.fail_at = "login"
    with patch.object(asyncio, "sleep", AsyncMock()):
        result = await check.async_host(info, list(info.channels), TEST_NOW)
    assert result["ok"] is False
    sub = result["channels"][0]["sub"]
    assert "401" in sub["replay"]["error"]
    assert "401" in sub["download"]["error"]
    assert _calls(FakeClient.instances[0]) == ["connect", "login", "logout"]

    FakeClient.fail_at = None
    FakeClient.key_frame = False
    FakeClient.refuse_channel_bit = True
    FakeClient.cut_ends = False
    with patch.object(asyncio, "sleep", AsyncMock()):
        result = await check.async_host(info, list(info.channels), TEST_NOW)
    sub = result["channels"][0]["sub"]
    assert sub["replay"]["error"] == "no key frame within the timeout"
    assert _calls(FakeClient.instances[-2])[-3:] == ["start", "stop", "logout"]
    download = sub["download"]
    assert download["error"] == "no key frame within the hold"
    assert download["bitmap"] == "255"
    assert "400" in download["first_try"]
    assert download["ended_within_hold"] is False
    assert _calls(FakeClient.instances[-1]) == [
        "connect",
        "login",
        "download",
        "download",
        "download_end",
        "logout",
    ]
    assert FakeClient.instances[-1].calls[3][1][4] == 255
    await scheduler.async_shutdown()


async def test_check_skips(
    hass: HomeAssistant, loaded_reolink: MockConfigEntry, reolink_host: MagicMock
) -> None:
    scheduler = Scheduler(default_limit=2)
    check, host = _check(hass, scheduler)
    info = host.info()
    reolink_host.request_vod_files.return_value = (
        [],
        [make_vod_file(TEST_NOW, minutes=3)],
    )
    result = await check.async_host(info, list(info.channels), TEST_NOW)
    assert result["ok"] is False
    sub = result["channels"][0]["sub"]
    assert sub["skipped"].startswith("no finished recording of 20 minutes")
    assert sub["search"] == {"days": 4, "files": 4, "latency_ms": ANY}
    # Today's window ends now; the older ones span the whole day.
    windows = [c.args[2] for c in reolink_host.request_vod_files.call_args_list]
    assert windows[0] == TEST_NOW
    assert windows[1] == TEST_NOW.replace(hour=23, minute=59, second=59) - timedelta(
        days=1
    )
    assert not FakeClient.instances

    reolink_host.is_nvr = False
    assert "skipped" in await check.async_host(
        host.info(), list(host.info().channels), TEST_NOW
    )
    reolink_host.is_nvr = True
    reolink_host.request_vod_files.side_effect = RuntimeError("search broke")
    result = await check.async_host(info, list(info.channels), TEST_NOW)
    assert (
        result["channels"][0]["sub"]["search"]["error"] == "RuntimeError: search broke"
    )
    # No camera matches the filter.
    check, host = _check(
        hass, scheduler, BaichuanOptions(enabled=True, cameras="no such camera")
    )
    result = await check.async_host(info, list(info.channels), TEST_NOW)
    assert "matches" in result["skipped"]
    await scheduler.async_shutdown()


async def test_prober_runs_the_check(
    hass: HomeAssistant, loaded_reolink: MockConfigEntry, long_recording: None
) -> None:
    scheduler = Scheduler(default_limit=2)
    media = FakeMedia(scheduler)
    options = ProbeOptions(baichuan=BaichuanOptions(enabled=True, hold_seconds=1))
    with (
        patch.object(probe, "async_first_frame", media.first_frame),
        patch.object(probe, "async_first_bytes", media.first_bytes),
        patch.object(probe, "async_hold_stream", media.hold),
        patch.object(probe, "CONCURRENCY_COOLDOWN", 0),
        patch.object(probe_baichuan, "BaichuanReplayClient", FakeClient),
        patch.object(probe_baichuan, "async_fetch", fake_fetch),
        patch.object(asyncio, "sleep", AsyncMock()),
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
    (host,) = report["hosts"]
    assert host["baichuan_replay"]["ok"] is True
    assert report["options"]["baichuan"] == {
        "enabled": True,
        "hold_seconds": 1,
        "streams": ["sub"],
        "download": True,
        "session": False,
        "cameras": "",
        "cut_seconds": 20.0,
    }
    text = json.dumps(report)
    for secret in SECRETS:
        assert secret not in text


async def test_check_without_uid_users_or_size(
    hass: HomeAssistant,
    loaded_reolink: MockConfigEntry,
    reolink_host: MagicMock,
    long_recording: None,
) -> None:
    scheduler = Scheduler(default_limit=2)
    check, host = _check(hass, scheduler)
    info = host.info()
    reolink_host.camera_uid.return_value = "Unknown"
    reolink_host.send = AsyncMock(side_effect=RuntimeError("no GetOnline"))
    with patch.object(asyncio, "sleep", AsyncMock()):
        result = await check.async_host(info, list(info.channels), TEST_NOW)
    sub = result["channels"][0]["sub"]
    assert sub["replay"]["error"].endswith("no camera UID for the channel")
    assert "error" in result["users_before"]
    assert "error" in result["online"]
    # The download needs no UID.
    assert sub["download"]["ok"] is True

    # A recording without a size: the HTTP comparison is skipped.
    day = TEST_NOW.replace(hour=5, minute=0, second=1) - timedelta(days=1)
    unsized = make_vod_file(day, minutes=60)
    with patch.object(type(unsized), "size", 0):
        reolink_host.request_vod_files.return_value = ([], [unsized])
        result = await check.async_host(info, list(info.channels), TEST_NOW)
    assert result["channels"][0]["sub"]["skipped"].startswith("no finished recording")
    await scheduler.async_shutdown()


def _three_channels(info: bridge.HostInfo) -> list[bridge.ChannelInfo]:
    first = info.channels[0]
    return [
        replace(first, name="Front"),
        replace(first, channel=1, name="Garage"),
        replace(first, channel=2, name="Back"),
    ]


async def test_check_runs_every_channel_that_has_a_long_recording(
    hass: HomeAssistant, loaded_reolink: MockConfigEntry, reolink_host: MagicMock
) -> None:
    scheduler = Scheduler(default_limit=2)
    check, host = _check(
        hass, scheduler, BaichuanOptions(enabled=True, hold_seconds=1, download=False)
    )
    info = host.info()
    channels = _three_channels(info)
    day = TEST_NOW.replace(hour=5, minute=0, second=1)

    async def search(ch: int, start: datetime, end: datetime, stream: str) -> Any:
        if ch == 0:
            return [], [make_vod_file(start, minutes=3)]  # motion clips only
        if start.day == TEST_NOW.day:
            return [], [make_vod_file(day, minutes=60)]
        raise AssertionError("searched past the first long recording")

    reolink_host.request_vod_files = AsyncMock(side_effect=search)
    reolink_host.send = AsyncMock(
        return_value=[{"cmd": "GetOnline", "value": {"User": [{}]}}]
    )
    with (
        patch.object(asyncio, "sleep", AsyncMock()),
        patch.object(probe_baichuan, "MAX_CHANNELS", 2),
    ):
        result = await check.async_host(info, channels, TEST_NOW)
    await scheduler.async_shutdown()
    assert result["ok"] is True
    assert result["channels_left_out"] == [2]
    assert [c["channel"] for c in result["channels"]] == [0, 1]
    assert [c["name"] for c in result["channels"]] == ["Front", "Garage"]
    assert "skipped" in result["channels"][0]["sub"]
    assert result["channels"][0]["sub"]["search"]["days"] == 4
    assert result["channels"][1]["sub"]["search"]["days"] == 1
    assert result["channels"][1]["sub"]["search"]["date"] == TEST_NOW.date().isoformat()
    assert result["channels"][1]["sub"]["recording"]["start"] == day.isoformat()
    (client,) = FakeClient.instances
    assert client.calls[3][1][0] == 1  # the start went to the channel found


async def test_session_test_holds_one_then_two_replays(
    hass: HomeAssistant, loaded_reolink: MockConfigEntry, reolink_host: MagicMock
) -> None:
    scheduler = Scheduler(default_limit=2)
    check, host = _check(
        hass,
        scheduler,
        BaichuanOptions(
            enabled=True,
            hold_seconds=1,
            download=False,
            session=True,
            cameras="front, garage",
        ),
    )
    info = host.info()
    day = TEST_NOW.replace(hour=5, minute=0, second=1)
    reolink_host.request_vod_files.return_value = ([], [make_vod_file(day, minutes=60)])
    users = {"cmd": "GetOnline", "value": {"User": [{}, {}]}}
    reolink_host.send = AsyncMock(return_value=[users])
    with patch.object(asyncio, "sleep", AsyncMock()):
        result = await check.async_host(info, _three_channels(info), TEST_NOW)
    assert [c["channel"] for c in result["channels"]] == [0, 1]  # Back left out
    session = result["session"]
    assert session["ok"] is True
    assert session["first"] == {"channel": 0, "stream": "sub"}
    assert session["second"] == {"channel": 1, "stream": "sub"}
    assert session["one_open"]["users"] == {"count": 2}
    assert session["one_open"]["seek_ms"] == 17.0
    assert session["fill_beside"]["mbit_s"] == 90.0
    assert session["replay_during_fill"] == {
        "chunks": 0,
        "bytes": 0,
        "key_frames": 0,
        "frames": 0,
    }
    two = session["two_open"]
    assert two["users"] == {"count": 2}
    assert two["open_streams"] == 2
    assert two["stop_second_ms"] == 20.0
    assert session["stop_first_ms"] == 20.0
    assert session["users_after_logout"] == {"count": 2}
    client = FakeClient.instances[-1]
    assert _calls(client) == [
        "connect",
        "login",
        "seek",
        "start",
        "seek",
        "start",
        "stop",
        "stop",
        "logout",
    ]
    assert client.calls[3][1][0] == 0
    assert client.calls[5][1][0] == 1
    assert client.calls[6][1][0] == 1  # the second replay stops first

    # One channel only: no second replay; a failure is recorded.
    with patch.object(asyncio, "sleep", AsyncMock()):
        result = await check.async_host(info, _three_channels(info)[:1], TEST_NOW)
    session = result["session"]
    assert session["ok"] is True
    assert session["second"] is None
    assert "two_open" not in session
    FakeClient.fail_at = "login"
    with patch.object(asyncio, "sleep", AsyncMock()):
        result = await check.async_host(info, _three_channels(info)[:1], TEST_NOW)
    assert "skipped" in result["session"]
    FakeClient.fail_at = None
    check._options.cameras = ""
    reolink_host.get_vod_source = AsyncMock(side_effect=RuntimeError("no url"))
    with patch.object(asyncio, "sleep", AsyncMock()):
        result = await check.async_host(info, _three_channels(info)[:1], TEST_NOW)
    assert result["session"]["fill_beside"]["error"] == "RuntimeError: no url"
    assert result["channels"][0]["sub"]["http"]["error"] == "RuntimeError: no url"
    await scheduler.async_shutdown()


async def test_check_http_url_failure(
    hass: HomeAssistant,
    loaded_reolink: MockConfigEntry,
    reolink_host: MagicMock,
    long_recording: None,
) -> None:
    scheduler = Scheduler(default_limit=2)
    check, host = _check(hass, scheduler)
    info = host.info()
    reolink_host.get_vod_source = AsyncMock(side_effect=RuntimeError("no url"))
    FakeClient.fail_at = "connect"
    with patch.object(asyncio, "sleep", AsyncMock()):
        result = await check.async_host(info, list(info.channels), TEST_NOW)
    sub = result["channels"][0]["sub"]
    assert sub["http"]["error"] == "RuntimeError: no url"
    assert sub["replay"]["error"] == "OSError: no route"
    assert sub["download"]["error"] == "OSError: no route"
    await scheduler.async_shutdown()

"""The Phase 5a Baichuan replay check, with a fake client and a fake HTTP fetch."""

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
    ReplayStats,
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


def test_pick_and_target() -> None:
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
    assert BaichuanOptions(hold_seconds=99).hold_seconds == 15.0


class FakeClient:
    """Stands in for BaichuanReplayClient: records the sequence, feeds frames."""

    instances: ClassVar[list[FakeClient]] = []
    fail_at: ClassVar[str | None] = None
    key_frame: ClassVar[bool] = True

    def __init__(self, endpoint: BaichuanEndpoint, *, timeout: float) -> None:
        self.endpoint = endpoint
        self.timeout = timeout
        self.calls: list[tuple[str, tuple[Any, ...]]] = []
        self.device_type = "nvr"
        self.stats: ReplayStats | None = None
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

    async def start(
        self,
        channel: int,
        file_id: str,
        uid: str,
        stream: str,
        *,
        speed: int = 1,
        on_chunk: Callable[[ReplayStats], None] | None = None,
    ) -> tuple[float, ReplayStats]:
        self.calls.append(("start", (channel, file_id, uid, stream, speed)))
        self.stats = ReplayStats(started=0.0)
        if FakeClient.key_frame:
            self.stats.first_chunk = 0.064
            self.stats.first_key_frame = 0.07
            self.stats.first_key_time = datetime(2026, 10, 16, 6, 44, 59)
            self.stats.key_frames = 3
            self.stats.frames = 40
            self.stats.chunks = 4
            self.stats.total_bytes = 160_000
            if on_chunk is not None:
                on_chunk(self.stats)
        return 72.0, self.stats

    async def stop(self, channel: int, name: str, stream: str) -> float:
        self.calls.append(("stop", (channel, name, stream)))
        return 20.0

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


async def test_check_measures_both_paths(
    hass: HomeAssistant, loaded_reolink: MockConfigEntry, long_recording: None
) -> None:
    scheduler = Scheduler(default_limit=2)
    check, host = _check(hass, scheduler)
    info = host.info()
    with patch.object(asyncio, "sleep", AsyncMock()):
        result = await check.async_host(info, list(info.channels), TEST_NOW)
    await scheduler.async_shutdown()
    assert result["ok"] is True
    assert result["channel"] == 0
    assert result["target"]["offset_s"] == 2700.0
    assert result["target"]["bytes"] == 786432
    assert result["users_before"] == {"count": 2}
    replay = result["replay"]
    assert replay["ok"] is True
    assert replay["seek_ms"] == 17.0
    assert replay["start_ms"] == 72.0
    assert replay["stream"]["first_key_frame_ms"] == 70.0
    assert replay["stream"]["key_frame_vs_seek_s"] == -2.0
    assert replay["users_during"] == {"count": 2}
    assert replay["chunks_after_stop"] == 0
    assert replay["device_type"] == "nvr"
    assert result["http"]["to_target_ms"] == 6940.0
    assert result["http"]["reached_target"] is True
    (client,) = FakeClient.instances
    assert [c[0] for c in client.calls] == [
        "connect",
        "login",
        "seek",
        "start",
        "stop",
        "logout",
    ]
    seek = client.calls[2][1]
    assert seek == (0, datetime(2026, 10, 16, 6, 45, 1))
    start = client.calls[3][1]
    assert start[0] == 0
    assert start[3] == "subStream"
    assert start[4] == 1
    assert client.calls[4][1][1] == "0120261016060001"
    assert client.endpoint.port == 5678
    text = json.dumps(result)
    for secret in SECRETS:
        assert secret not in text


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
    assert "401" in result["replay"]["error"]
    assert [c[0] for c in FakeClient.instances[-1].calls] == [
        "connect",
        "login",
        "logout",
    ]

    FakeClient.fail_at = None
    FakeClient.key_frame = False
    with patch.object(asyncio, "sleep", AsyncMock()):
        result = await check.async_host(info, list(info.channels), TEST_NOW)
    assert result["replay"]["error"] == "no key frame within the timeout"
    assert [c[0] for c in FakeClient.instances[-1].calls][-3:] == [
        "start",
        "stop",
        "logout",
    ]
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
    assert result["skipped"].startswith("no finished recording of 20 minutes")
    assert result["search"] == {"days": 4, "files": 4, "latency_ms": ANY}
    assert result["channels_searched"] == [{"channel": 0, **result["search"]}]
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
    assert result["search"]["error"] == "RuntimeError: search broke"
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
    assert report["options"]["baichuan"] == {"enabled": True, "hold_seconds": 1}
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
    assert result["replay"]["error"] == "no camera UID for the channel"
    assert "error" in result["users_before"]
    assert not FakeClient.instances

    # A recording without a size: the HTTP comparison is skipped.
    day = TEST_NOW.replace(hour=5, minute=0, second=1) - timedelta(days=1)
    unsized = make_vod_file(day, minutes=60)
    with patch.object(type(unsized), "size", 0):
        reolink_host.request_vod_files.return_value = ([], [unsized])
        result = await check.async_host(info, list(info.channels), TEST_NOW)
    assert result["skipped"].startswith("no finished recording of 20 minutes")
    await scheduler.async_shutdown()


async def test_check_moves_on_to_a_channel_with_a_long_recording(
    hass: HomeAssistant, loaded_reolink: MockConfigEntry, reolink_host: MagicMock
) -> None:
    scheduler = Scheduler(default_limit=2)
    check, host = _check(hass, scheduler)
    info = host.info()
    first = info.channels[0]
    channels = [first, replace(first, channel=1), replace(first, channel=2)]
    day = TEST_NOW.replace(hour=5, minute=0, second=1)

    async def search(ch: int, start: datetime, end: datetime, stream: str) -> Any:
        if ch == 0:
            return [], [make_vod_file(start, minutes=3)]  # motion clips only
        if ch == 1 and start.day == TEST_NOW.day:
            return [], [make_vod_file(day, minutes=60)]
        raise AssertionError("searched past the first long recording")

    reolink_host.request_vod_files = AsyncMock(side_effect=search)
    with patch.object(asyncio, "sleep", AsyncMock()):
        result = await check.async_host(info, channels, TEST_NOW)
    await scheduler.async_shutdown()
    assert result["ok"] is True
    assert result["channel"] == 1
    assert result["search"]["date"] == TEST_NOW.date().isoformat()
    assert [c["channel"] for c in result["channels_searched"]] == [0, 1]
    assert result["channels_searched"][0]["days"] == 4
    assert result["channels_searched"][1]["days"] == 1
    assert result["recording"]["start"] == day.isoformat()
    (client,) = FakeClient.instances
    assert client.calls[3][1][0] == 1  # the start went to the channel found


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
    assert result["http"]["error"] == "RuntimeError: no url"
    assert result["replay"]["error"] == "OSError: no route"
    await scheduler.async_shutdown()

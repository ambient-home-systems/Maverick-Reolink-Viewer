"""Tests for the hardware probe."""

import asyncio
from collections.abc import Generator
from datetime import timedelta
import json
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry
from reolink_aio.enums import VodRequestType
from reolink_aio.exceptions import ReolinkError

from custom_components.reolink_viewer import bridge, probe
from custom_components.reolink_viewer.bridge import CameraUrl, VodFile, VodMethod
from custom_components.reolink_viewer.media import ByteResult, FrameResult
from custom_components.reolink_viewer.probe import (
    ProbeOptions,
    Prober,
    pick_recording,
    redact,
)
from custom_components.reolink_viewer.scheduler import Priority, Scheduler
from homeassistant.core import HomeAssistant

from .conftest import SECRETS, TEST_NOW, make_vod_file


class FakeMedia:
    """Fake media functions that check they run inside a scheduler job."""

    def __init__(self, scheduler: Scheduler) -> None:
        self.scheduler = scheduler
        self.frame_calls: list[str] = []
        self.byte_calls: list[str] = []
        self.hold_calls = 0
        self.frame_result = FrameResult(
            ok=True, open_ms=100.0, ttff_ms=250.0, codec="h264", width=640, height=360
        )
        self.byte_result = ByteResult(
            ok=True,
            headers_ms=50.0,
            ttfb_ms=80.0,
            status=200,
            content_type="video/mp4",
            container="mp4",
            bytes_read=65536,
        )
        self.hold_ok_up_to = 99
        self.exclusive_seen = False

    def _assert_in_job(self) -> None:
        assert any(s.running for s in self.scheduler._hosts.values()), (
            "media I/O outside the scheduler"
        )

    async def first_frame(
        self, ffmpeg: str, url: CameraUrl, *, timeout: float
    ) -> FrameResult:
        self._assert_in_job()
        self.frame_calls.append(url.value)
        return FrameResult(**self.frame_result.as_dict())

    async def first_bytes(
        self, session: Any, url: CameraUrl, *, timeout: float
    ) -> ByteResult:
        self._assert_in_job()
        self.byte_calls.append(url.value)
        return ByteResult(**self.byte_result.as_dict())

    async def hold(
        self, ffmpeg: str, url: CameraUrl, *, seconds: float, timeout: float
    ) -> FrameResult:
        self._assert_in_job()
        self.exclusive_seen = any(
            s._exclusive_running for s in self.scheduler._hosts.values()
        )
        self.hold_calls += 1
        return self._hold_result

    _hold_result = FrameResult(ok=True, open_ms=900.0, ttff_ms=6000.0, frames=50)


@pytest.fixture
def scheduler() -> Scheduler:
    return Scheduler(default_limit=2)


@pytest.fixture
def fake_media(scheduler: Scheduler) -> Generator[FakeMedia]:
    fake = FakeMedia(scheduler)
    with (
        patch.object(probe, "async_first_frame", fake.first_frame),
        patch.object(probe, "async_first_bytes", fake.first_bytes),
        patch.object(probe, "async_hold_stream", fake.hold),
        patch.object(probe, "CONCURRENCY_COOLDOWN", 0),
    ):
        yield fake


def _prober(
    hass: HomeAssistant,
    scheduler: Scheduler,
    options: ProbeOptions | None = None,
    progress: Any = None,
) -> Prober:
    return Prober(
        scheduler,
        bridge.async_get_hosts(hass),
        options=options or ProbeOptions(),
        compat=bridge.async_check_compat(hass),
        ffmpeg_binary="ffmpeg",
        ffmpeg_version="7.1",
        session=MagicMock(),
        integration_version="0.0.1",
        progress=progress,
    )


def _assert_redacted(report: dict[str, Any]) -> None:
    text = json.dumps(report)
    for secret in SECRETS:
        assert secret not in text, secret
    assert "://" not in text
    assert "1.2.3.4" not in text


async def test_probe_nvr_success(
    hass: HomeAssistant,
    reolink_host: MagicMock,
    loaded_reolink: MockConfigEntry,
    scheduler: Scheduler,
    fake_media: FakeMedia,
) -> None:
    """A full probe of an NVR channel where everything works."""
    messages: list[str] = []
    report = await _prober(hass, scheduler, progress=messages.append).async_run()
    await scheduler.async_shutdown()

    assert report["schema_version"] == 1
    assert report["reolink_aio_version"] == "0.21.18"
    assert report["compat"]["ok"] is True
    assert messages
    (host,) = report["hosts"]
    assert host["id"] == "host1"
    assert host["identity"]["device_type"] == "nvr"
    assert host["ports"]["rtmp_enabled"] is True
    (ch,) = host["channels"]
    assert "skipped" not in ch
    assert ch["encodings"]["main"]["codec"] == "h264"

    for protocol in ("rtsp", "rtmp", "flv"):
        for stream in ("main", "sub", "ext"):
            assert ch["live"][protocol][stream]["ok"] is True
            assert ch["live"][protocol][stream]["ttff_ms"] == 250.0
    assert len(fake_media.frame_calls) == 9

    for stream in ("main", "sub"):
        vod = ch["vod"][stream]
        assert vod["search"]["ok"] is True
        assert vod["search"]["files"] == 1
        assert vod["file"]["duration_s"] == 300
        methods = vod["methods"]
        for method in ("PLAYBACK", "DOWNLOAD", "NVR_DOWNLOAD", "FLV"):
            assert methods[method]["ok"] is True, methods[method]
            assert methods[method]["ttfb_ms"] == 80.0
            assert "prepare_ms" in methods[method]
        assert methods["RTMP"] == {"ok": False, "skipped": "not supported on NVRs"}

    requested = [c.args[3] for c in reolink_host.get_vod_source.await_args_list]
    assert VodRequestType.RTMP not in requested
    # NVR_DOWNLOAD runs last per file: its prepare step can leave the NVR busy.
    assert requested[:4] == [
        VodRequestType.PLAYBACK,
        VodRequestType.DOWNLOAD,
        VodRequestType.FLV,
        VodRequestType.NVR_DOWNLOAD,
    ]
    assert set(probe.VOD_ORDER) == set(VodMethod)
    reolink_host.set_net_port.assert_not_awaited()

    bc = ch["baichuan"]
    assert bc["event_search"]["ok"] is True
    assert bc["event_search"]["events"] == {"PERSON": 1}
    assert bc["day_search"] == {
        "ok": True,
        "latency_ms": bc["day_search"]["latency_ms"],
        "days": 17,
    }
    assert bc["snapshot_past"]["ok"] is True
    assert bc["snapshot_past"]["bytes"] == 10

    assert host["concurrency"] == {"ok": False, "skipped": "opt-in: concurrency_test"}
    assert fake_media.hold_calls == 0
    _assert_redacted(report)


async def test_probe_standalone_rtmp_disabled(
    hass: HomeAssistant,
    reolink_host: MagicMock,
    loaded_reolink: MockConfigEntry,
    scheduler: Scheduler,
    fake_media: FakeMedia,
) -> None:
    """With the RTMP port off, RTMP is skipped (FLV still tried); port never enabled."""
    reolink_host.is_nvr = False
    reolink_host.rtmp_enabled = False
    report = await _prober(hass, scheduler).async_run()
    await scheduler.async_shutdown()
    ch = report["hosts"][0]["channels"][0]

    assert ch["live"]["rtmp"]["sub"] == {"ok": False, "skipped": "RTMP port disabled"}
    assert ch["live"]["flv"]["main"]["ok"] is True
    assert ch["live"]["rtsp"]["sub"]["ok"] is True
    methods = ch["vod"]["sub"]["methods"]
    assert (
        methods["RTMP"]["skipped"] == "RTMP port disabled; the probe never enables it"
    )
    assert methods["NVR_DOWNLOAD"] == {"ok": False, "skipped": "NVR only"}
    assert methods["FLV"]["ok"] is True
    assert methods["PLAYBACK"]["ok"] is True
    requested = {c.args[3] for c in reolink_host.get_vod_source.await_args_list}
    assert requested == {
        VodRequestType.PLAYBACK,
        VodRequestType.DOWNLOAD,
        VodRequestType.FLV,
    }
    reolink_host.set_net_port.assert_not_awaited()


async def test_probe_standalone_rtmp_enabled(
    hass: HomeAssistant,
    reolink_host: MagicMock,
    loaded_reolink: MockConfigEntry,
    scheduler: Scheduler,
    fake_media: FakeMedia,
) -> None:
    """RTMP VOD on a standalone camera with RTMP on is measured with ffmpeg."""
    reolink_host.is_nvr = False
    report = await _prober(hass, scheduler).async_run()
    await scheduler.async_shutdown()
    rtmp = report["hosts"][0]["channels"][0]["vod"]["sub"]["methods"]["RTMP"]
    assert rtmp["ok"] is True
    assert rtmp["ttfb_ms"] == 250.0
    reolink_host.set_net_port.assert_not_awaited()


async def test_probe_unknown_rtmp_state_is_read_not_changed(
    hass: HomeAssistant,
    reolink_host: MagicMock,
    loaded_reolink: MockConfigEntry,
    scheduler: Scheduler,
    fake_media: FakeMedia,
) -> None:
    """Unknown RTMP state is read with GetNetPort; if still unknown, RTMP is skipped."""
    reolink_host.is_nvr = False
    reolink_host.rtmp_enabled = None
    report = await _prober(hass, scheduler).async_run()
    await scheduler.async_shutdown()
    host = report["hosts"][0]
    assert host["ports"]["refreshed"] is True
    reolink_host.get_state.assert_any_await("GetNetPort")
    methods = host["channels"][0]["vod"]["sub"]["methods"]
    assert methods["RTMP"]["skipped"].startswith("RTMP port disabled")
    reolink_host.set_net_port.assert_not_awaited()


async def test_probe_port_refresh_failure(
    hass: HomeAssistant,
    reolink_host: MagicMock,
    loaded_reolink: MockConfigEntry,
    scheduler: Scheduler,
    fake_media: FakeMedia,
) -> None:
    """A failing GetNetPort is recorded."""
    reolink_host.rtmp_enabled = None
    reolink_host.get_state.side_effect = ReolinkError("denied")
    report = await _prober(hass, scheduler).async_run()
    await scheduler.async_shutdown()
    assert report["hosts"][0]["ports"]["error"] == "ReolinkError: denied"


async def test_probe_battery_is_opt_in(
    hass: HomeAssistant,
    reolink_host: MagicMock,
    loaded_reolink: MockConfigEntry,
    scheduler: Scheduler,
    fake_media: FakeMedia,
) -> None:
    """Battery cameras are skipped unless included."""
    reolink_host.supported.side_effect = lambda ch, cap, *a: True
    report = await _prober(hass, scheduler).async_run()
    ch = report["hosts"][0]["channels"][0]
    assert ch["skipped"] == "battery camera (opt-in: include_battery)"
    assert fake_media.frame_calls == []

    report = await _prober(
        hass, scheduler, ProbeOptions(include_battery=True)
    ).async_run()
    await scheduler.async_shutdown()
    assert "skipped" not in report["hosts"][0]["channels"][0]


@pytest.mark.parametrize(
    ("attr", "value", "reason"),
    [
        ("camera_online", False, "offline"),
        ("sleeping", True, "sleeping"),
    ],
)
async def test_probe_skips_unavailable_channels(
    hass: HomeAssistant,
    reolink_host: MagicMock,
    loaded_reolink: MockConfigEntry,
    scheduler: Scheduler,
    fake_media: FakeMedia,
    attr: str,
    value: bool,
    reason: str,
) -> None:
    """Offline and sleeping channels are skipped."""
    getattr(reolink_host, attr).return_value = value
    report = await _prober(hass, scheduler).async_run()
    await scheduler.async_shutdown()
    assert report["hosts"][0]["channels"][0]["skipped"] == reason


async def test_probe_failures_are_recorded(
    hass: HomeAssistant,
    reolink_host: MagicMock,
    loaded_reolink: MockConfigEntry,
    scheduler: Scheduler,
    fake_media: FakeMedia,
) -> None:
    """Device errors are recorded per step and the probe carries on."""
    reolink_host.get_encoding.side_effect = ReolinkError("enc")
    reolink_host.get_rtsp_stream_source.side_effect = ReolinkError(
        "rtsp failed for rtsp://admin:s3cr3t-pa55@1.2.3.4/x"
    )
    reolink_host.get_vod_source.side_effect = ReolinkError("vod failed")
    reolink_host.baichuan.search_vod_type.side_effect = ReolinkError("bc")
    reolink_host.baichuan.search_vod_days.side_effect = ReolinkError("days")
    reolink_host.baichuan.snapshot_past.side_effect = ReolinkError("snap")
    fake_media.frame_result = FrameResult(ok=False, error="Connection refused")

    report = await _prober(hass, scheduler).async_run()
    await scheduler.async_shutdown()
    ch = report["hosts"][0]["channels"][0]
    assert ch["encodings"]["main"]["error"] == "ReolinkError: enc"
    assert ch["live"]["rtsp"]["main"]["ok"] is False
    assert ch["live"]["rtsp"]["main"]["error"] == "ReolinkError: rtsp failed for <url>"
    assert ch["live"]["flv"]["sub"] == {
        **FrameResult(ok=False, error="Connection refused").as_dict()
    }
    assert ch["vod"]["sub"]["methods"]["DOWNLOAD"] == {
        "ok": False,
        "error": "ReolinkError: vod failed",
    }
    assert ch["baichuan"]["event_search"] == {"ok": False, "error": "ReolinkError: bc"}
    assert ch["baichuan"]["day_search"]["ok"] is False
    assert ch["baichuan"]["snapshot_past"] == {
        "ok": False,
        "error": "ReolinkError: snap",
    }
    _assert_redacted(report)


async def test_probe_timeouts(
    hass: HomeAssistant,
    reolink_host: MagicMock,
    loaded_reolink: MockConfigEntry,
    scheduler: Scheduler,
    fake_media: FakeMedia,
) -> None:
    """Steps that hang hit the step timeout and are recorded as timeouts."""

    async def hang(*_args: Any, **_kwargs: Any) -> Any:
        await asyncio.sleep(3600)

    reolink_host.request_vod_files.side_effect = hang
    reolink_host.baichuan.search_vod_type.side_effect = hang
    reolink_host.baichuan.snapshot_past.side_effect = hang
    options = ProbeOptions()
    options.step_timeout = 0.05
    report = await _prober(hass, scheduler, options).async_run()
    await scheduler.async_shutdown()
    ch = report["hosts"][0]["channels"][0]
    assert ch["vod"]["sub"]["search"] == {
        "ok": False,
        "windows": 0,
        "files": 0,
        "error": "timeout",
    }
    assert ch["vod"]["sub"]["methods"]["skipped"].startswith("no finished recording")
    assert ch["baichuan"]["event_search"] == {"ok": False, "error": "timeout"}
    assert ch["baichuan"]["snapshot_past"]["skipped"] == "no recording to sample"


async def test_probe_device_time_failure(
    hass: HomeAssistant,
    reolink_host: MagicMock,
    loaded_reolink: MockConfigEntry,
    scheduler: Scheduler,
    fake_media: FakeMedia,
) -> None:
    """Without the device time, VOD and Baichuan steps are reported as failed."""
    reolink_host.time.return_value = None
    reolink_host.async_get_time.side_effect = ReolinkError("time")
    report = await _prober(hass, scheduler).async_run()
    await scheduler.async_shutdown()
    ch = report["hosts"][0]["channels"][0]
    assert ch["vod"]["error"].startswith("cannot read device time")
    assert ch["baichuan"]["error"].startswith("cannot read device time")


async def test_probe_searches_back_day_by_day(
    hass: HomeAssistant,
    reolink_host: MagicMock,
    loaded_reolink: MockConfigEntry,
    scheduler: Scheduler,
    fake_media: FakeMedia,
) -> None:
    """Older days are searched until a recording is found; none found is reported."""
    old = make_vod_file(TEST_NOW - timedelta(days=2, hours=1))
    reolink_host.request_vod_files.side_effect = [
        ([], []),
        ([], [old]),
        ([], []),
        ([], []),
        ([], []),
    ]
    report = await _prober(hass, scheduler).async_run()
    await scheduler.async_shutdown()
    vod = report["hosts"][0]["channels"][0]["vod"]
    assert vod["main"]["search"]["windows"] == 2
    assert vod["main"]["file"]["start"] == old.start_time.isoformat()
    assert vod["sub"]["search"]["windows"] == 3
    assert vod["sub"]["methods"]["skipped"] == (
        "no finished recording in the last 3 days"
    )
    assert report["hosts"][0]["channels"][0]["baichuan"]["snapshot_past"][
        "skipped"
    ] == ("no recording to sample")


async def test_probe_no_replay(
    hass: HomeAssistant,
    reolink_host: MagicMock,
    loaded_reolink: MockConfigEntry,
    scheduler: Scheduler,
    fake_media: FakeMedia,
) -> None:
    """Channels without replay capability skip VOD."""
    reolink_host.supported.side_effect = lambda ch, cap, *a: (
        cap
        not in {
            "battery",
            "replay",
        }
    )
    report = await _prober(hass, scheduler).async_run()
    await scheduler.async_shutdown()
    assert report["hosts"][0]["channels"][0]["vod"] == {
        "ok": False,
        "skipped": "no replay capability",
    }


async def test_probe_concurrency_opt_in(
    hass: HomeAssistant,
    reolink_host: MagicMock,
    loaded_reolink: MockConfigEntry,
    scheduler: Scheduler,
    fake_media: FakeMedia,
) -> None:
    """The concurrency test runs exclusively and stops at the first failing level."""
    calls = 0

    async def hold(
        ffmpeg: str, url: CameraUrl, *, seconds: float, timeout: float
    ) -> FrameResult:
        nonlocal calls
        calls += 1
        fake_media._assert_in_job()
        assert any(s._exclusive_running for s in scheduler._hosts.values())
        # Levels 1 and 2 use calls 1..3; level 3 (calls 4..6) has one failure.
        if calls == 6:
            return FrameResult(ok=False, error="503 Service Unavailable")
        return FrameResult(ok=True, open_ms=900.0, ttff_ms=6000.0, frames=50)

    with patch.object(probe, "async_hold_stream", hold):
        report = await _prober(
            hass, scheduler, ProbeOptions(concurrency_test=True, max_streams=5)
        ).async_run()
    await scheduler.async_shutdown()
    conc = report["hosts"][0]["concurrency"]
    assert conc["ok"] is True
    assert conc["protocol"] == "flv"
    assert conc["max_ok"] == 2
    assert conc["first_failure"] == 3
    assert [lvl["streams"] for lvl in conc["levels"]] == [1, 2, 3]
    assert conc["levels"][0]["open_ms"] == [900.0]
    assert "ttff_ms" not in conc["levels"][0]
    assert conc["levels"][2]["errors"] == ["503 Service Unavailable"]
    assert calls == 6


async def test_probe_concurrency_without_working_stream(
    hass: HomeAssistant,
    reolink_host: MagicMock,
    loaded_reolink: MockConfigEntry,
    scheduler: Scheduler,
    fake_media: FakeMedia,
) -> None:
    """No working sub stream means no concurrency test."""
    fake_media.frame_result = FrameResult(ok=False, error="x")
    report = await _prober(
        hass, scheduler, ProbeOptions(concurrency_test=True)
    ).async_run()
    await scheduler.async_shutdown()
    assert report["hosts"][0]["concurrency"] == {
        "ok": False,
        "skipped": "no channel with a working sub stream",
    }


async def test_probe_host_info_error(
    hass: HomeAssistant,
    reolink_host: MagicMock,
    loaded_reolink: MockConfigEntry,
    scheduler: Scheduler,
    fake_media: FakeMedia,
) -> None:
    """A host whose info cannot be read is reported, not fatal."""
    prober = _prober(hass, scheduler)
    with patch.object(
        bridge.ReolinkHostHandle, "info", side_effect=RuntimeError("broken")
    ):
        report = await prober.async_run()
    await scheduler.async_shutdown()
    assert report["hosts"] == [{"id": "host1", "error": "RuntimeError: broken"}]


async def test_probe_entry_filter(
    hass: HomeAssistant,
    loaded_reolink: MockConfigEntry,
    scheduler: Scheduler,
    fake_media: FakeMedia,
) -> None:
    """entry_ids limits the probe to the given hosts."""
    report = await _prober(
        hass, scheduler, ProbeOptions(entry_ids=["other"])
    ).async_run()
    await scheduler.async_shutdown()
    assert report["hosts"] == []
    assert "entry_ids" not in report["options"]


def test_options_are_clamped() -> None:
    """Options are clamped to safe ranges."""
    options = ProbeOptions(max_streams=50, hold_seconds=100, step_timeout=1)
    assert options.max_streams == 6
    assert options.hold_seconds == 15
    assert options.step_timeout == 5


def test_pick_recording() -> None:
    """The newest finished recording of at least 10 s is picked."""

    def vod(start_offset: timedelta, length: timedelta) -> VodFile:
        start = TEST_NOW - start_offset
        return VodFile(
            start=start,
            end=start + length,
            name="f",
            stream="sub",
            size=None,
            triggers=(),
        )

    old = vod(timedelta(hours=2), timedelta(minutes=5))
    newer = vod(timedelta(hours=1), timedelta(minutes=5))
    recording = vod(timedelta(minutes=1), timedelta(seconds=50))
    tiny = vod(timedelta(minutes=30), timedelta(seconds=5))
    assert pick_recording([old, newer, recording, tiny], TEST_NOW) is newer
    assert pick_recording([recording, tiny], TEST_NOW) is None
    assert pick_recording([], TEST_NOW) is None


def test_redact() -> None:
    """Secret keys are dropped and secret values removed everywhere."""
    data = {
        "password": "x",
        "Token": "y",
        "nested": [{"uid": "u", "note": f"uid {SECRETS[1]}"}],
        SECRETS[0]: "key containing a secret",
        "n": 1,
    }

    def hider(text: str) -> str:
        raise RuntimeError("hide_password broke")

    cleaned = redact(data, SECRETS, [hider])
    assert cleaned == {
        "nested": [{"note": "uid <redacted>"}],
        "<redacted>": "key containing a secret",
        "n": 1,
    }


async def test_probe_job_uses_lowest_priority(
    hass: HomeAssistant,
    loaded_reolink: MockConfigEntry,
    scheduler: Scheduler,
    fake_media: FakeMedia,
) -> None:
    """Every probe job is scheduled at prefetch priority on the host's scheduler."""
    run = AsyncMock(side_effect=scheduler.run)
    with patch.object(scheduler, "run", run):
        await _prober(hass, scheduler).async_run()
    await scheduler.async_shutdown()
    assert run.await_count > 20
    assert {c.kwargs["priority"] for c in run.await_args_list} == {Priority.PREFETCH}
    assert {c.args[0] for c in run.await_args_list} == {loaded_reolink.entry_id}

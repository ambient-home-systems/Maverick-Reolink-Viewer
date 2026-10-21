"""Tests for the bridge over HA's Reolink integration."""

from datetime import UTC, datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry
from reolink_aio.enums import VodRequestType
from reolink_aio.exceptions import ApiError, ReolinkError
from reolink_aio.typings import VOD_search_status, VOD_trigger

from custom_components.reolink_viewer import bridge
from custom_components.reolink_viewer.bridge import (
    CameraUrl,
    HostNotFoundError,
    IncompatibleError,
    LiveProtocol,
    NotApplicableError,
    RtmpDisabledError,
    VodFile,
    VodMethod,
    redact_text,
    with_start_param,
)
from homeassistant.core import HomeAssistant

from .conftest import (
    SECRETS,
    TEST_NOW,
    TEST_PASSWORD,
    TEST_SERIAL,
    TEST_TOKEN,
    make_vod_file,
)
from .ha_reolink_mock import (
    TEST_CAM_MODEL,
    TEST_HOST,
    TEST_HOST_MODEL,
    TEST_NVR_NAME,
    TEST_UID,
    TEST_UID_CAM,
)

FILE = VodFile(
    start=TEST_NOW - timedelta(hours=1),
    end=TEST_NOW - timedelta(minutes=55),
    name="Mp4Record/2026-10-17/RecS03_20261017_110000_110500_0_A.mp4",
    stream="sub",
    size=1,
    triggers=("PERSON",),
)


async def test_compat_ok(hass: HomeAssistant, loaded_reolink: MockConfigEntry) -> None:
    """The real Reolink integration with a mocked host is compatible."""
    report = bridge.async_check_compat(hass)
    assert report.ok, report.errors
    assert report.reolink_aio_version == "0.21.18"
    assert report.as_dict()["ok"] is True


async def test_compat_static_failure(hass: HomeAssistant) -> None:
    """A missing library method is reported clearly."""
    with patch.object(bridge, "REQUIRED_HOST_ATTRS", ("does_not_exist",)):
        report = bridge.async_check_compat(hass)
    assert not report.ok
    assert report.errors == ("reolink_aio.api.Host.does_not_exist is missing",)


async def test_compat_reolink_data_changed(hass: HomeAssistant) -> None:
    """A renamed runtime_data field is caught by the static check."""
    from dataclasses import make_dataclass

    fake = make_dataclass("ReolinkData", [("device", object)])
    with patch("homeassistant.components.reolink.util.ReolinkData", fake):
        report = bridge.async_check_compat(hass)
    assert "ReolinkData no longer has a 'host' field" in report.errors


async def test_compat_import_failure(hass: HomeAssistant) -> None:
    """An import failure is reported, not raised."""
    with patch(
        "custom_components.reolink_viewer.bridge.importlib.import_module",
        side_effect=ImportError("gone"),
    ):
        report = bridge.async_check_compat(hass)
    assert not report.ok
    assert "gone" in report.errors[0]


async def test_compat_runtime_failure(
    hass: HomeAssistant, reolink_host: MagicMock, loaded_reolink: MockConfigEntry
) -> None:
    """A loaded entry whose api lacks an attribute fails the check."""
    del reolink_host.baichuan.snapshot_past
    report = bridge.async_check_compat(hass)
    assert not report.ok
    assert "baichuan.snapshot_past" in report.errors[0]
    with pytest.raises(IncompatibleError):
        bridge.async_get_hosts(hass)


async def test_compat_runtime_data_missing(
    hass: HomeAssistant, loaded_reolink: MockConfigEntry
) -> None:
    """Missing runtime_data / host / api are each reported."""
    entry = loaded_reolink
    real = entry.runtime_data
    entry.runtime_data = None
    assert "has no runtime_data" in bridge.async_check_compat(hass).errors[0]
    entry.runtime_data = MagicMock(spec=[])
    assert "has no 'host'" in bridge.async_check_compat(hass).errors[0]
    entry.runtime_data = MagicMock(host=MagicMock(spec=[]))
    assert "has no 'api'" in bridge.async_check_compat(hass).errors[0]
    entry.runtime_data = real


async def test_no_entries(hass: HomeAssistant) -> None:
    """With no Reolink entries there are no hosts."""
    assert bridge.async_get_hosts(hass) == []
    assert bridge.async_check_compat(hass).ok


async def test_host_info(
    hass: HomeAssistant, reolink_host: MagicMock, loaded_reolink: MockConfigEntry
) -> None:
    """The typed view reflects the library state."""
    (host,) = bridge.async_get_hosts(hass)
    info = host.info()
    assert info.entry_id == loaded_reolink.entry_id
    assert info.name == TEST_NVR_NAME
    assert info.model == TEST_HOST_MODEL
    assert info.device_type == "nvr"
    assert info.rtmp_enabled is True
    assert info.supports_flv is True
    (channel,) = info.channels
    assert channel.channel == 0
    assert channel.model == TEST_CAM_MODEL
    assert channel.is_battery is False
    assert channel.main.codec == "h264"
    assert channel.sub.bit_rate == 4096
    data = info.as_dict()
    assert data["device_type"] == "nvr"
    assert data["channels"][0]["main"] == {
        "codec": "h264",
        "bit_rate": 4096,
        "frame_rate": 25,
    }

    reolink_host.is_hub = True
    assert host.info().device_type == "hub"
    reolink_host.is_nvr = False
    reolink_host.is_hub = False
    assert host.info().device_type == "camera"


async def test_host_info_missing_encoding(
    hass: HomeAssistant, reolink_host: MagicMock, loaded_reolink: MockConfigEntry
) -> None:
    """Accessors that raise on missing data map to None."""
    reolink_host.bit_rate.side_effect = KeyError("subStream")
    reolink_host.frame_rate.side_effect = ReolinkError("no data")
    (host,) = bridge.async_get_hosts(hass)
    channel = host.info().channels[0]
    assert channel.main.bit_rate is None
    assert channel.main.frame_rate is None
    reolink_host.timezone.side_effect = RuntimeError("unexpected")
    with pytest.raises(RuntimeError):
        host.timezone()


async def test_get_host(hass: HomeAssistant, loaded_reolink: MockConfigEntry) -> None:
    """Lookup by entry id."""
    assert bridge.async_get_host(hass, loaded_reolink.entry_id).entry_id == (
        loaded_reolink.entry_id
    )
    with pytest.raises(HostNotFoundError):
        bridge.async_get_host(hass, "nope")
    await hass.config_entries.async_unload(loaded_reolink.entry_id)
    with pytest.raises(HostNotFoundError):
        bridge.async_get_host(hass, loaded_reolink.entry_id)
    assert bridge.async_get_hosts(hass) == []


async def test_degraded_device_list(
    hass: HomeAssistant, loaded_reolink: MockConfigEntry
) -> None:
    """Degraded mode lists devices from the device registry."""
    devices = bridge.async_list_devices_degraded(hass)
    assert devices
    assert devices[0]["entry_id"] == loaded_reolink.entry_id
    assert {d["name"] for d in devices} >= {TEST_NVR_NAME}


async def test_secrets(hass: HomeAssistant, loaded_reolink: MockConfigEntry) -> None:
    """Secrets include password, UIDs, serials and MACs."""
    (host,) = bridge.async_get_hosts(hass)
    secrets = host.secrets()
    for value in (TEST_PASSWORD, TEST_UID, TEST_UID_CAM, TEST_SERIAL, TEST_HOST):
        assert value in secrets
    assert host.hide_password(f"x {TEST_TOKEN}") == "x <token>"


async def test_live_urls(
    hass: HomeAssistant, reolink_host: MagicMock, loaded_reolink: MockConfigEntry
) -> None:
    """Live URLs come from the matching library call and are wrapped."""
    (host,) = bridge.async_get_hosts(hass)
    rtsp = await host.async_live_url(0, LiveProtocol.RTSP, "sub")
    assert rtsp is not None
    assert rtsp.scheme == "rtsp"
    assert TEST_PASSWORD not in repr(rtsp)
    assert TEST_PASSWORD not in str(rtsp)
    rtmp = await host.async_live_url(0, LiveProtocol.RTMP, "main")
    assert rtmp is not None
    assert rtmp.scheme == "rtmp"
    flv = await host.async_live_url(0, LiveProtocol.FLV, "ext")
    assert flv is not None
    assert flv.scheme == "https"
    reolink_host.get_flv_stream_source.side_effect = None
    reolink_host.get_flv_stream_source.return_value = None
    assert await host.async_live_url(0, LiveProtocol.FLV, "sub") is None


async def test_no_flv_on_a_baichuan_only_connection(
    hass: HomeAssistant, reolink_host: MagicMock, loaded_reolink: MockConfigEntry
) -> None:
    """Without an HTTP port (Baichuan only) there is no FLV or RTMP URL.

    reolink-aio still builds one, with the port "None" (seen on the Doorbell).
    """
    (host,) = bridge.async_get_hosts(hass)
    assert host.live_protocols() == frozenset(LiveProtocol)
    reolink_host.baichuan_only = True
    assert host.live_protocols() == {LiveProtocol.RTSP}
    assert await host.async_live_url(0, LiveProtocol.FLV, "ext") is None
    assert await host.async_live_url(0, LiveProtocol.RTMP, "main") is None
    assert await host.async_live_url(0, LiveProtocol.RTSP, "sub") is not None


async def test_online_users(
    hass: HomeAssistant, loaded_reolink: MockConfigEntry, reolink_host: MagicMock
) -> None:
    """GetOnline's list of logged-in clients, read-only; reasons when it fails."""
    (host,) = bridge.async_get_hosts(hass)
    reolink_host.send = AsyncMock(
        return_value=[{"cmd": "GetOnline", "code": 0, "value": {"User": [{}, {}]}}]
    )
    assert await host.async_online_users() == (2, None)
    (body,) = reolink_host.send.await_args.args
    assert body == [{"cmd": "GetOnline", "action": 0, "param": {}}]
    reolink_host.send = AsyncMock(
        return_value=[
            {"cmd": "GetOnline", "code": 1, "error": {"detail": "not support"}}
        ]
    )
    assert await host.async_online_users() == (None, "not support")
    reolink_host.send = AsyncMock(return_value=[{"value": {"User": "x"}}])
    assert await host.async_online_users() == (None, "no answer")
    reolink_host.send = AsyncMock(return_value=None)
    assert await host.async_online_users() == (None, "no answer")
    reolink_host.send = AsyncMock(side_effect=ReolinkError("busy"))
    assert await host.async_online_users() == (None, "ReolinkError")
    del reolink_host.send
    assert await host.async_online_users() == (None, "reolink-aio cannot send commands")


async def test_vod_url_methods(
    hass: HomeAssistant, reolink_host: MagicMock, loaded_reolink: MockConfigEntry
) -> None:
    """VOD methods map to VodRequestType; NVR_DOWNLOAD uses start_end ids."""
    (host,) = bridge.async_get_hosts(hass)
    mime, url = await host.async_vod_url(0, FILE, VodMethod.DOWNLOAD)
    assert mime == "video/mp4"
    assert isinstance(url, CameraUrl)
    reolink_host.get_vod_source.assert_awaited_with(
        0, FILE.name, "sub", VodRequestType.DOWNLOAD
    )
    await host.async_vod_url(0, FILE, VodMethod.NVR_DOWNLOAD)
    reolink_host.get_vod_source.assert_awaited_with(
        0, "20261017110000_20261017110500", "sub", VodRequestType.NVR_DOWNLOAD
    )
    with pytest.raises(NotApplicableError):
        await host.async_vod_url(0, FILE, VodMethod.RTMP)  # NVR

    reolink_host.is_nvr = False
    with pytest.raises(NotApplicableError):
        await host.async_vod_url(0, FILE, VodMethod.NVR_DOWNLOAD)
    await host.async_vod_url(0, FILE, VodMethod.RTMP)
    reolink_host.get_vod_source.assert_awaited_with(
        0, FILE.name, "sub", VodRequestType.RTMP
    )


async def test_vod_url_start_at(
    hass: HomeAssistant, reolink_host: MagicMock, loaded_reolink: MockConfigEntry
) -> None:
    """start_at sets the URL's start parameter in device-local time."""
    (host,) = bridge.async_get_hosts(hass)
    eastern = timezone(timedelta(hours=-4))
    reolink_host.timezone.return_value = eastern
    when = datetime(2026, 10, 17, 15, 30, 5, tzinfo=UTC)
    _mime, url = await host.async_vod_url(0, FILE, VodMethod.DOWNLOAD, start_at=when)
    assert url.value.endswith("&start=20261017113005")
    with pytest.raises(NotApplicableError):
        await host.async_vod_url(0, FILE, VodMethod.FLV, start_at=when)


def test_with_start_param() -> None:
    """An existing start parameter is replaced; naive times are used as-is."""
    url = "https://h/api.cgi?cmd=Download&source=a.mp4&start=20260101000000&token=t"
    assert with_start_param(url, datetime(2026, 10, 17, 3, 4, 5), None) == (
        "https://h/api.cgi?cmd=Download&source=a.mp4&token=t&start=20261017030405"
    )


@pytest.mark.parametrize("rtmp_enabled", [False, None])
async def test_vod_rtmp_never_enables_port(
    hass: HomeAssistant,
    reolink_host: MagicMock,
    loaded_reolink: MockConfigEntry,
    rtmp_enabled: bool | None,
) -> None:
    """RTMP VOD is refused unless the port is known to be on."""
    reolink_host.is_nvr = False
    reolink_host.rtmp_enabled = rtmp_enabled
    reolink_host.get_vod_source.reset_mock()
    (host,) = bridge.async_get_hosts(hass)
    with pytest.raises(RtmpDisabledError):
        await host.async_vod_url(0, FILE, VodMethod.RTMP)
    reolink_host.get_vod_source.assert_not_awaited()
    reolink_host.set_net_port.assert_not_awaited()


async def test_searches_and_snapshot(
    hass: HomeAssistant, reolink_host: MagicMock, loaded_reolink: MockConfigEntry
) -> None:
    """VOD search, event search, day search and snapshot_past."""
    (host,) = bridge.async_get_hosts(hass)
    start, end = TEST_NOW - timedelta(days=1), TEST_NOW
    files = await host.async_search_vod_files(0, start, end, "sub")
    assert len(files) == 1
    assert files[0].triggers == ("MOTION", "PERSON")
    assert files[0].size == 1048576
    assert await host.async_search_vod_events(0, start, end, "sub") == {"PERSON": 1}
    assert await host.async_search_vod_days(0, start, end) == 17

    from datetime import UTC
    from zoneinfo import ZoneInfo

    reolink_host.timezone.return_value = ZoneInfo("Europe/Amsterdam")
    when = datetime(2026, 10, 17, 10, 0, tzinfo=UTC)
    assert (
        await host.async_snapshot_past(0, when, "sub", "ffmpeg") == b"\xff\xd8jpegdata"
    )
    called_when = reolink_host.baichuan.snapshot_past.call_args.args[1]
    assert called_when.hour == 12  # converted to the camera's local time

    assert await host.async_get_time() == TEST_NOW
    reolink_host.time.return_value = None
    assert await host.async_get_time() == TEST_NOW
    reolink_host.async_get_time.assert_awaited()
    assert await host.async_get_encoding(0, "main") == "h264"
    reolink_host.rtmp_enabled = False
    assert await host.async_refresh_ports() is False
    reolink_host.get_state.assert_awaited_with("GetNetPort")


def test_redact_text() -> None:
    """URLs, query credentials and known secrets are removed."""
    text = (
        f"rtsp://admin:{TEST_PASSWORD}@1.2.3.4:554/x "
        f"https://h/flv?user=admin&password={TEST_PASSWORD}&token={TEST_TOKEN} "
        f"uid {TEST_UID} serial {TEST_SERIAL}"
    )
    cleaned = redact_text(text, SECRETS)
    for secret in SECRETS:
        assert secret not in cleaned
    assert "1.2.3.4" not in cleaned
    assert cleaned.startswith("<url> <url> uid <redacted>")
    assert redact_text("Host: 192.168.20.237:80: busy", ()) == "Host: <ip>:80: busy"
    assert redact_text("login user=admin&password=x", ()) == (
        "login user=<redacted>&password=<redacted>"
    )


async def test_search_day_and_recording_days(
    hass: HomeAssistant,
    reolink_host: MagicMock,
    loaded_reolink: MockConfigEntry,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """One window: recordings plus events (one per moment, all types)."""
    (host,) = bridge.async_get_hosts(hass)
    start = TEST_NOW - timedelta(hours=2)
    both = make_vod_file(start, 2, name="20261017100000")
    both.bc_triggers = VOD_trigger.PERSON | VOD_trigger.VEHICLE
    animal = make_vod_file(start + timedelta(minutes=30), 1, name="20261017103000")
    animal.bc_triggers = VOD_trigger.ANIMAL
    # The NVR's separate motion record for the same moment, lasting longer.
    motion = make_vod_file(start + timedelta(minutes=30), 3, name="20261017103000")
    motion.bc_triggers = VOD_trigger.MOTION
    reolink_host.baichuan.search_vod_type = AsyncMock(
        return_value=(
            {},
            {
                VOD_trigger.PERSON: [both],
                VOD_trigger.VEHICLE: [both],
                VOD_trigger.ANIMAL: [animal],
                VOD_trigger.MOTION: [motion],
            },
        )
    )
    day = await host.async_search_day(0, start, TEST_NOW, "sub")
    (file,) = day.files
    assert file.start_id == "20261017110000"
    assert file.playback is not None
    assert file.playback.tzinfo is None
    assert [(e.types, e.file_id) for e in day.events] == [
        (("VEHICLE", "PERSON"), "20261017100000"),
        (("ANIMAL", "MOTION"), "20261017103000"),
    ]
    assert day.events[0].start == start
    assert day.events[0].end == start + timedelta(minutes=2)
    assert day.events[1].end == start + timedelta(minutes=33)
    assert day.events_error is None

    # An event search that fails once is asked again, and works.
    monkeypatch.setattr(bridge, "EVENT_SEARCH_RETRY_DELAY", 0)
    flaky = AsyncMock(
        side_effect=[
            ApiError("busy", rspCode=400),
            ({}, {VOD_trigger.ANIMAL: [animal]}),
        ]
    )
    reolink_host.baichuan.search_vod_type = flaky
    day = await host.async_search_day(0, start, TEST_NOW, "sub")
    assert flaky.await_count == 2
    assert [e.types for e in day.events] == [("ANIMAL",)]
    assert day.events_error is None
    # Failing twice keeps the recordings and names the device's code.
    reolink_host.baichuan.search_vod_type = AsyncMock(
        side_effect=ApiError("busy", rspCode=-12)
    )
    day = await host.async_search_day(0, start, TEST_NOW, "sub")
    assert day.events_error == "ApiError -12"
    reolink_host.baichuan.search_vod_type = AsyncMock(side_effect=ReolinkError("x"))
    day = await host.async_search_day(0, start, TEST_NOW, "sub")
    assert len(day.files) == 1
    assert day.events == []
    assert day.events_error == "ReolinkError"
    # A failing recording search fails the whole search.
    reolink_host.request_vod_files = AsyncMock(side_effect=ReolinkError("y"))
    with pytest.raises(ReolinkError):
        await host.async_search_day(0, start, TEST_NOW, "sub")

    month_start, month_end = datetime(2026, 10, 1), datetime(2026, 10, 31, 23, 59)
    days = await host.async_recording_days(0, month_start, month_end)
    assert days[0].isoformat() == "2026-10-01"
    assert len(days) == 17
    # Baichuan fails: the HTTP status search answers.
    reolink_host.baichuan.search_vod_days = AsyncMock(side_effect=ReolinkError("z"))
    reolink_host.request_vod_files = AsyncMock(
        return_value=(
            [VOD_search_status({"year": 2026, "mon": 10, "table": "01" + "0" * 29})],
            [],
        )
    )
    days = await host.async_recording_days(0, month_start, month_end)
    assert [d.day for d in days] == [2]

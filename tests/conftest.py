"""Fixtures for Reolink Viewer tests.

The Reolink host mock follows ``tests/components/reolink/conftest.py`` in HA core:
``reolink_aio.api.Host`` is patched where HA's Reolink integration imports it and
the real Reolink integration is set up on top of the mock.
"""

from collections.abc import Generator
from datetime import datetime, timedelta
from typing import Any, cast
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry
from reolink_aio.typings import VOD_file, VOD_search_status, VOD_trigger

from custom_components.reolink_viewer.const import DOMAIN
from homeassistant.components.reolink.config_flow import DEFAULT_PROTOCOL
from homeassistant.components.reolink.const import (
    CONF_BC_CONNECT,
    CONF_BC_ONLY,
    CONF_BC_PORT,
    CONF_SUPPORTS_PRIVACY_MODE,
    CONF_UID,
    CONF_USE_HTTPS,
    DOMAIN as REOLINK_DOMAIN,
)
from homeassistant.const import (
    CONF_HOST,
    CONF_PASSWORD,
    CONF_PORT,
    CONF_PROTOCOL,
    CONF_USERNAME,
)
from homeassistant.core import HomeAssistant
from homeassistant.helpers.device_registry import format_mac

from .ha_reolink_mock import (
    TEST_BC_CON,
    TEST_BC_PORT,
    TEST_CAM_NAME,
    TEST_HOST,
    TEST_HOST2,
    TEST_MAC,
    TEST_MAC_CAM,
    TEST_NVR_NAME,
    TEST_PORT,
    TEST_UID,
    TEST_UID_CAM,
    TEST_USERNAME,
    _init_host_mock,
)

# HA's mock uses the password "password"; use something that cannot collide
# with ordinary words so redaction tests are meaningful.
TEST_PASSWORD = "s3cr3t-pa55"
TEST_SERIAL = "SN0123456789XYZ"
TEST_TOKEN = "tok3n-abcdef"
# Camera's "current" time.
TEST_NOW = datetime(2026, 10, 17, 12, 0, 0)
DIRECT_CAM_MODEL = "CX810"

SECRETS = (TEST_PASSWORD, TEST_UID, TEST_UID_CAM, TEST_SERIAL, TEST_TOKEN)


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations: None) -> None:
    """Enable custom integrations in every test."""


def make_vod_file(
    start: datetime, minutes: int = 5, name: str | None = None
) -> VOD_file:
    """Build a reolink-aio VOD_file."""
    end = start + timedelta(minutes=minutes)

    def rt(value: datetime) -> dict[str, int]:
        return {
            "year": value.year,
            "mon": value.month,
            "day": value.day,
            "hour": value.hour,
            "min": value.minute,
            "sec": value.second,
        }

    data: dict[str, Any] = {
        "StartTime": rt(start),
        "EndTime": rt(end),
        "PlaybackTime": rt(start),
        "type": "sub",
        "size": "1048576",
        "frameRate": 0,
        "height": 0,
        "width": 0,
    }
    if name is not None:
        data["name"] = name
    file = VOD_file(data)
    file.bc_triggers = VOD_trigger.PERSON | VOD_trigger.MOTION
    return file


def _supported(channel: int | None, capability: str, *_args: Any) -> bool:
    return capability != "battery"


def _init_probe_mock(host_mock: MagicMock) -> None:
    """Additions on top of HA's mock: what the bridge and the probe read."""
    host_mock.async_get_time = AsyncMock(return_value=TEST_NOW)
    host_mock.time.return_value = TEST_NOW
    host_mock.timezone.return_value = None
    host_mock.encoding.return_value = "h264"
    host_mock.bit_rate.return_value = 4096
    host_mock.frame_rate.return_value = 25
    host_mock.serial.return_value = TEST_SERIAL
    host_mock.sleeping.return_value = False
    host_mock.is_doorbell.return_value = False
    host_mock.supported.side_effect = _supported
    host_mock.whiteled_event_mode.return_value = "off"
    host_mock.rtsp_port = 554
    host_mock.rtmp_port = 1935
    host_mock.onvif_port = 8000
    host_mock.ai_supported_types.return_value = ["people", "vehicle"]
    host_mock.set_net_port = AsyncMock()
    host_mock.get_vod_source = AsyncMock(
        side_effect=lambda ch, filename, stream, request_type: (
            "video/mp4",
            f"https://{TEST_HOST}/cgi-bin/api.cgi?cmd={request_type.value}"
            f"&source={filename}&token={TEST_TOKEN}",
        )
    )
    host_mock.request_vod_files = AsyncMock(
        return_value=([], [make_vod_file(TEST_NOW - timedelta(hours=1))])
    )
    host_mock.get_rtsp_stream_source = AsyncMock(
        side_effect=lambda ch, stream=None, check=True: (
            f"rtsp://{TEST_USERNAME}:{TEST_PASSWORD}@{TEST_HOST}:554/Preview_01_{stream}"
        )
    )
    host_mock.get_rtmp_stream_source.side_effect = lambda ch, stream=None: (
        f"rtmp://{TEST_HOST}:1935/bcs/channel{ch}_{stream}.bcs?user={TEST_USERNAME}"
        f"&password={TEST_PASSWORD}"
    )
    host_mock.get_flv_stream_source.side_effect = lambda ch, stream=None: (
        f"https://{TEST_HOST}:{TEST_PORT}/flv?port=1935&app=bcs&stream=channel{ch}"
        f"_{stream}.bcs&user={TEST_USERNAME}&password={TEST_PASSWORD}"
    )
    host_mock.hide_password.side_effect = lambda text: (
        str(text).replace(TEST_PASSWORD, "<password>").replace(TEST_TOKEN, "<token>")
    )
    host_mock.baichuan.search_vod_type = AsyncMock(
        return_value=(
            {},
            {
                VOD_trigger.PERSON: [make_vod_file(TEST_NOW - timedelta(hours=1))],
                VOD_trigger.MOTION: [],
            },
        )
    )
    host_mock.baichuan.search_vod_days = AsyncMock(
        return_value=[
            VOD_search_status({"year": 2026, "mon": 10, "table": "1" * 17 + "0" * 14})
        ]
    )
    host_mock.baichuan.snapshot_past = AsyncMock(return_value=b"\xff\xd8jpegdata")


@pytest.fixture
def reolink_host_class() -> Generator[MagicMock]:
    """Mock the reolink_aio Host class used by HA's Reolink integration."""
    with patch(
        "homeassistant.components.reolink.host.Host", autospec=False
    ) as host_mock_class:
        _init_host_mock(host_mock_class.return_value)
        _init_probe_mock(host_mock_class.return_value)
        yield host_mock_class


@pytest.fixture
def direct_camera(reolink_host_class: MagicMock) -> MagicMock:
    """A camera added directly that is also NVR channel 0 (same UID)."""
    camera = MagicMock()
    _init_host_mock(camera)
    _init_probe_mock(camera)
    camera.is_nvr = False
    camera.uid = TEST_UID_CAM
    camera.mac_address = TEST_MAC_CAM
    camera.nvr_name = TEST_CAM_NAME
    camera.model = DIRECT_CAM_MODEL
    camera.camera_model.return_value = DIRECT_CAM_MODEL
    camera.camera_uid.return_value = TEST_UID_CAM
    camera.serial.return_value = None
    camera.baichuan.mac_address.return_value = None
    # A camera without an SD card does not record locally.
    camera.hdd_list = []
    nvr = reolink_host_class.return_value
    reolink_host_class.side_effect = lambda host, *args, **kwargs: (
        camera if host == TEST_HOST2 else nvr
    )
    return camera


@pytest.fixture
def direct_camera_entry(hass: HomeAssistant) -> MockConfigEntry:
    """Config entry of the directly added camera."""
    entry = MockConfigEntry(
        domain=REOLINK_DOMAIN,
        unique_id=format_mac(TEST_MAC_CAM),
        data={
            CONF_HOST: TEST_HOST2,
            CONF_USERNAME: TEST_USERNAME,
            CONF_PASSWORD: TEST_PASSWORD,
            CONF_PORT: TEST_PORT,
            CONF_USE_HTTPS: True,
            CONF_SUPPORTS_PRIVACY_MODE: True,
            CONF_BC_PORT: TEST_BC_PORT,
            CONF_BC_ONLY: False,
            CONF_BC_CONNECT: TEST_BC_CON,
            CONF_UID: TEST_UID_CAM,
        },
        options={CONF_PROTOCOL: DEFAULT_PROTOCOL},
        title=TEST_CAM_NAME,
    )
    entry.add_to_hass(hass)
    return entry


@pytest.fixture
async def loaded_with_entities(
    hass: HomeAssistant,
    reolink_host: MagicMock,
    reolink_entry: MockConfigEntry,
    viewer_entry: MockConfigEntry,
) -> MockConfigEntry:
    """Set up HA's Reolink integration with its entity platforms, then the viewer."""
    assert await hass.config_entries.async_setup(reolink_entry.entry_id)
    await hass.async_block_till_done()
    assert await hass.config_entries.async_setup(viewer_entry.entry_id)
    await hass.async_block_till_done()
    return reolink_entry


@pytest.fixture
def reolink_host(reolink_host_class: MagicMock) -> MagicMock:
    """Return the mocked reolink_aio Host instance."""
    return cast("MagicMock", reolink_host_class.return_value)


@pytest.fixture
def reolink_platforms() -> Generator[None]:
    """Skip the Reolink entity platforms (as HA core's tests do)."""
    with patch("homeassistant.components.reolink.PLATFORMS", []):
        yield


@pytest.fixture
def reolink_entry(hass: HomeAssistant) -> MockConfigEntry:
    """Add a Reolink config entry (as HA core's ``config_entry`` fixture)."""
    entry = MockConfigEntry(
        domain=REOLINK_DOMAIN,
        unique_id=format_mac(TEST_MAC),
        data={
            CONF_HOST: TEST_HOST,
            CONF_USERNAME: TEST_USERNAME,
            CONF_PASSWORD: TEST_PASSWORD,
            CONF_PORT: TEST_PORT,
            CONF_USE_HTTPS: True,
            CONF_SUPPORTS_PRIVACY_MODE: True,
            CONF_BC_PORT: TEST_BC_PORT,
            CONF_BC_ONLY: False,
            CONF_BC_CONNECT: TEST_BC_CON,
            CONF_UID: TEST_UID,
        },
        options={CONF_PROTOCOL: DEFAULT_PROTOCOL},
        title=TEST_NVR_NAME,
    )
    entry.add_to_hass(hass)
    return entry


@pytest.fixture
async def loaded_reolink(
    hass: HomeAssistant,
    reolink_host: MagicMock,
    reolink_entry: MockConfigEntry,
    reolink_platforms: None,
) -> MockConfigEntry:
    """Set up HA's Reolink integration on the mocked host."""
    assert await hass.config_entries.async_setup(reolink_entry.entry_id)
    await hass.async_block_till_done()
    return reolink_entry


@pytest.fixture
def viewer_entry(hass: HomeAssistant) -> MockConfigEntry:
    """Add the Reolink Viewer config entry."""
    entry = MockConfigEntry(domain=DOMAIN, title="Reolink Viewer", data={})
    entry.add_to_hass(hass)
    return entry


@pytest.fixture
async def loaded_viewer(
    hass: HomeAssistant, loaded_reolink: MockConfigEntry, viewer_entry: MockConfigEntry
) -> MockConfigEntry:
    """Set up Reolink Viewer on top of a loaded Reolink entry."""
    assert await hass.config_entries.async_setup(viewer_entry.entry_id)
    await hass.async_block_till_done()
    return viewer_entry

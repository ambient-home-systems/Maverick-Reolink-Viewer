"""Tests for the device model (devices.py) and its websocket commands."""

import json
from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock, patch

from pytest_homeassistant_custom_component.common import MockConfigEntry
from pytest_homeassistant_custom_component.typing import WebSocketGenerator

from custom_components.reolink_viewer import bridge, devices
from custom_components.reolink_viewer.bridge import DeviceRef, DeviceRole
from custom_components.reolink_viewer.catalog import OTHER_CATEGORY
from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr, entity_registry as er

from .conftest import DIRECT_CAM_MODEL, SECRETS, TEST_SERIAL
from .ha_reolink_mock import (
    TEST_CAM_MODEL,
    TEST_HOST,
    TEST_HOST2,
    TEST_HOST_MODEL,
    TEST_MAC,
    TEST_MAC_CAM,
    TEST_UID,
    TEST_UID_CAM,
)

NEVER_SENT = (
    *SECRETS,
    TEST_SERIAL,
    TEST_MAC,
    TEST_MAC_CAM,
    TEST_MAC.replace(":", ""),
    TEST_MAC_CAM.replace(":", ""),
    TEST_HOST,
    TEST_HOST2,
)


def assert_no_secrets(payload: Any) -> None:
    text = json.dumps(payload).lower()
    for secret in NEVER_SENT:
        assert secret.lower() not in text, secret
    assert "://" not in text


async def _ws(
    hass: HomeAssistant, client_factory: WebSocketGenerator, **msg: Any
) -> Any:
    client = await client_factory(hass)
    await client.send_json_auto_id(msg)
    return await client.receive_json()


async def _devices(hass: HomeAssistant, ws: WebSocketGenerator) -> dict[str, Any]:
    msg = await _ws(hass, ws, type="reolink_viewer/devices")
    assert msg["success"], msg
    result: dict[str, Any] = msg["result"]
    return result


async def test_nvr_with_one_channel(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_with_entities: MockConfigEntry,
) -> None:
    """An NVR becomes a host node and its channel a camera node."""
    result = await _devices(hass, hass_ws_client)
    assert result["degraded"] is False
    assert result["compat"]["ok"] is True
    (host,) = result["hosts"]
    (camera,) = result["cameras"]
    assert host["kind"] == "nvr"
    assert host["model"] == TEST_HOST_MODEL
    assert host["camera_ids"] == [camera["id"]]
    assert host["entities"] > 0
    assert camera["model"] == TEST_CAM_MODEL
    assert camera["host_id"] == host["id"]
    assert camera["group_id"] is None
    (conn,) = camera["connections"]
    assert conn["via"] == "nvr"
    assert conn["channel"] == 0
    assert conn["playback_source"] is True
    assert camera["primary_view"] == "live"
    assert camera["status"]["online"] is True
    # The Fluent (sub) stream is enabled by default and preferred for snapshots.
    assert camera["snapshot_entity_id"] == "camera.test_reolink_cam_fluent"
    assert camera["entities"] == conn["entities"] > 0
    assert camera["disabled_entities"] > 0
    assert_no_secrets(result)


async def test_device_entities_and_details(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_with_entities: MockConfigEntry,
) -> None:
    """The device command returns details and every Reolink entity, categorized."""
    camera = (await _devices(hass, hass_ws_client))["cameras"][0]
    msg = await _ws(
        hass, hass_ws_client, type="reolink_viewer/device", device_id=camera["id"]
    )
    assert msg["success"], msg
    result = msg["result"]
    assert result["node"]["id"] == camera["id"]
    (conn,) = result["connections"]
    details = conn["details"]
    assert details["channel"]["model"] == TEST_CAM_MODEL
    assert details["channel"]["encodings"]["main"]["codec"] == "h264"
    assert details["channel"]["ai_types"] == ["people", "vehicle"]
    assert "PTZ" in details["channel"]["capabilities"]
    assert details["host"]["ports"]["rtsp"]["enabled"] is True
    assert details["host"]["storage"][0]["type"] == "HDD"
    assert details["host"]["device_type"] == "nvr"

    ent_reg = er.async_get(hass)
    device_ids = {
        d.id
        for d in dr.async_entries_for_config_entry(
            dr.async_get(hass), loaded_with_entities.entry_id
        )
        if d.via_device_id is not None
    }
    expected = {
        e.entity_id
        for d in device_ids
        for e in er.async_entries_for_device(ent_reg, d, include_disabled_entities=True)
    }
    entities = {e["entity_id"]: e for e in conn["entities"]}
    assert set(entities) == expected
    for entity in entities.values():
        assert entity["key"] is not None, entity
        assert entity["category"] != OTHER_CATEGORY, entity
    motion = next(
        e
        for e in entities.values()
        if e["domain"] == "binary_sensor" and e["key"] == "motion"
    )
    assert motion["translation_key"] is None
    assert motion["category"] == "events"
    disabled = [e for e in entities.values() if e["disabled_by"] == "integration"]
    assert disabled
    assert_no_secrets(result)


async def test_a_camera_records_without_playback(
    hass: HomeAssistant,
    reolink_host: MagicMock,
    loaded_with_entities: MockConfigEntry,
) -> None:
    """Kept recordings make it record, even where playback is not possible."""
    handle = bridge.ReolinkHostHandle
    with patch.object(handle, "records_locally", return_value=False):
        (camera,) = devices.async_live_cameras(hass)
        assert camera["records"] is True
        (source,) = devices.async_image_sources(hass).values()
        assert source.records is True
        assert devices.async_playback_sources(hass) == []
        with patch.object(handle, "stores_recordings", return_value=False):
            (camera,) = devices.async_live_cameras(hass)
            assert camera["records"] is False
            (source,) = devices.async_image_sources(hass).values()
            assert source.records is False


async def test_live_controls(
    hass: HomeAssistant,
    reolink_host: MagicMock,
    loaded_with_entities: MockConfigEntry,
) -> None:
    """A camera's enabled controls; never the NVR's own siren or a disabled entity."""
    (camera,) = devices.async_live_cameras(hass)
    controls = camera["controls"]
    assert set(controls) == {"ptz", "preset", "zoom", "focus", "siren", "floodlight"}
    assert controls["siren"] == "siren.test_reolink_cam_siren"
    assert controls["floodlight"] == "light.test_reolink_cam_floodlight"
    assert controls["preset"] == "select.test_reolink_cam_ptz_preset"
    # Diagonals and zoom buttons are disabled by default in Home Assistant.
    assert controls["ptz"] == {
        move: f"button.test_reolink_cam_ptz_{move}"
        for move in ("stop", "left", "right", "up", "down")
    }

    ent_reg = er.async_get(hass)
    ent_reg.async_update_entity("button.test_reolink_cam_ptz_zoom_in", disabled_by=None)
    ent_reg.async_update_entity(
        "light.test_reolink_cam_floodlight", disabled_by=er.RegistryEntryDisabler.USER
    )
    (camera,) = devices.async_live_cameras(hass)
    assert camera["controls"]["ptz"]["zoom_in"] == "button.test_reolink_cam_ptz_zoom_in"
    assert "floodlight" not in camera["controls"]

    # Without PTZ stop nothing would end a move: no PTZ.
    ent_reg.async_update_entity(
        "button.test_reolink_cam_ptz_stop", disabled_by=er.RegistryEntryDisabler.USER
    )
    (camera,) = devices.async_live_cameras(hass)
    assert "ptz" not in camera["controls"]
    assert camera["controls"]["preset"] == "select.test_reolink_cam_ptz_preset"


async def test_host_device(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_with_entities: MockConfigEntry,
) -> None:
    """The NVR's own page lists the NVR-level entities (firmware, restart)."""
    host = (await _devices(hass, hass_ws_client))["hosts"][0]
    msg = await _ws(
        hass, hass_ws_client, type="reolink_viewer/device", device_id=host["id"]
    )
    result = msg["result"]
    (conn,) = result["connections"]
    keys = {(e["domain"], e["key"]) for e in conn["entities"]}
    assert ("update", "firmware") in keys
    assert ("button", "reboot") in keys
    assert conn["details"]["channel"] is None
    assert conn["details"]["host"]["model"] == TEST_HOST_MODEL
    assert_no_secrets(result)


async def test_duplicate_camera_is_merged(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    direct_camera: MagicMock,
    direct_camera_entry: MockConfigEntry,
    loaded_with_entities: MockConfigEntry,
) -> None:
    """A camera on the NVR and added directly is one camera with two connections."""
    assert direct_camera_entry.state is ConfigEntryState.LOADED
    result = await _devices(hass, hass_ws_client)
    assert len(result["hosts"]) == 1
    (camera,) = result["cameras"]
    assert camera["group_id"].startswith("g")
    nvr_conn, direct_conn = camera["connections"]
    assert nvr_conn["via"] == "nvr"
    assert nvr_conn["playback_source"] is True
    assert direct_conn["via"] == "direct"
    assert direct_conn["playback_source"] is False
    assert direct_conn["entry_id"] == direct_camera_entry.entry_id
    # The NVR connection is the primary: its device id is the camera id.
    assert camera["id"] == nvr_conn["device_id"]
    assert camera["primary_view"] == "live"
    assert camera["entities"] == nvr_conn["entities"] + direct_conn["entities"]
    assert_no_secrets(result)

    # Any of the camera's ids (either connection or the group) finds it.
    for device_id in (direct_conn["device_id"], camera["group_id"]):
        msg = await _ws(
            hass, hass_ws_client, type="reolink_viewer/device", device_id=device_id
        )
        assert msg["result"]["node"]["id"] == camera["id"]
    details = msg["result"]["connections"][1]["details"]
    assert details["channel"]["model"] == DIRECT_CAM_MODEL
    assert details["host"]["device_type"] == "camera"
    direct_keys = {e["key"] for e in msg["result"]["connections"][1]["entities"]}
    # Host-level entities of a direct camera are on the camera itself.
    assert "firmware" in direct_keys
    assert_no_secrets(msg["result"])


async def test_different_cameras_are_not_merged(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    direct_camera: MagicMock,
    direct_camera_entry: MockConfigEntry,
    reolink_entry: MockConfigEntry,
    viewer_entry: MockConfigEntry,
) -> None:
    """Cameras with different identifiers stay separate; no-storage means snapshot view."""
    direct_camera.uid = "OTHERUID12345678"
    direct_camera.camera_uid.return_value = "OTHERUID12345678"
    direct_camera.mac_address = "12:34:56:78:9a:bc"
    hass.config_entries.async_update_entry(
        direct_camera_entry,
        data={**direct_camera_entry.data, "uid": "OTHERUID12345678"},
    )
    assert await hass.config_entries.async_setup(reolink_entry.entry_id)
    assert await hass.config_entries.async_setup(viewer_entry.entry_id)
    await hass.async_block_till_done()

    result = await _devices(hass, hass_ws_client)
    assert len(result["cameras"]) == 2
    direct = next(c for c in result["cameras"] if c["model"] == DIRECT_CAM_MODEL)
    assert direct["group_id"] is None
    assert direct["host_id"] is None
    (conn,) = direct["connections"]
    assert conn["playback_source"] is False
    # Records nowhere (no NVR, no SD card): the snapshot is the primary view.
    assert direct["primary_view"] == "snapshot"


async def test_merge_by_mac_when_uid_differs(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    reolink_host: MagicMock,
    direct_camera: MagicMock,
    direct_camera_entry: MockConfigEntry,
    reolink_entry: MockConfigEntry,
    viewer_entry: MockConfigEntry,
) -> None:
    """Without a matching UID, a matching MAC address still merges the camera."""
    direct_camera.uid = "OTHERUID12345678"
    direct_camera.camera_uid.return_value = "OTHERUID12345678"
    hass.config_entries.async_update_entry(
        direct_camera_entry,
        data={**direct_camera_entry.data, "uid": "OTHERUID12345678"},
    )
    reolink_host.baichuan.mac_address.return_value = TEST_MAC_CAM.upper()
    assert await hass.config_entries.async_setup(reolink_entry.entry_id)
    assert await hass.config_entries.async_setup(viewer_entry.entry_id)
    await hass.async_block_till_done()
    result = await _devices(hass, hass_ws_client)
    (camera,) = result["cameras"]
    assert len(camera["connections"]) == 2
    assert_no_secrets(result)


async def test_degraded_device_model(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    reolink_host: MagicMock,
    loaded_with_entities: MockConfigEntry,
) -> None:
    """In degraded mode the tree comes from the registry and has no details."""
    del reolink_host.get_vod_source
    result = await _devices(hass, hass_ws_client)
    assert result["degraded"] is True
    assert result["compat"]["ok"] is False
    (host,) = result["hosts"]
    (camera,) = result["cameras"]
    assert host["camera_ids"] == [camera["id"]]
    assert camera["connections"][0]["playback_source"] is False
    assert camera["status"] == {}

    msg = await _ws(
        hass, hass_ws_client, type="reolink_viewer/device", device_id=camera["id"]
    )
    (conn,) = msg["result"]["connections"]
    assert conn["details"] is None
    assert conn["entities"]


async def test_bridge_error_degrades(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    reolink_host: MagicMock,
    loaded_with_entities: MockConfigEntry,
) -> None:
    """An unexpected bridge error degrades instead of failing the panel."""
    with patch.object(
        bridge.ReolinkHostHandle, "classify_device", side_effect=RuntimeError("boom")
    ):
        result = await _devices(hass, hass_ws_client)
    assert result["degraded"] is True
    assert "bridge error: boom" in result["compat"]["errors"]
    assert result["cameras"]


async def test_details_failure_is_tolerated(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_with_entities: MockConfigEntry,
) -> None:
    """Details that cannot be read are left out; entities still come back."""
    camera = (await _devices(hass, hass_ws_client))["cameras"][0]
    with patch.object(
        bridge.ReolinkHostHandle, "host_details", side_effect=RuntimeError("x")
    ):
        msg = await _ws(
            hass, hass_ws_client, type="reolink_viewer/device", device_id=camera["id"]
        )
    (conn,) = msg["result"]["connections"]
    assert conn["details"] is None
    assert conn["entities"]


async def test_device_not_found(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_with_entities: MockConfigEntry,
) -> None:
    """Unknown ids are a not_found error."""
    msg = await _ws(
        hass, hass_ws_client, type="reolink_viewer/device", device_id="nope"
    )
    assert not msg["success"]
    assert msg["error"]["code"] == "not_found"


async def test_catalog_command(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_viewer: MockConfigEntry,
) -> None:
    """The catalog command returns categories and entries."""
    msg = await _ws(hass, hass_ws_client, type="reolink_viewer/catalog")
    result = msg["result"]
    assert {c["id"] for c in result["categories"]} >= {"events", "system"}
    assert result["entities"]["light"]["status_led"]["title"] == "Status LED"


async def test_classify_device(
    hass: HomeAssistant, reolink_host: MagicMock, loaded_reolink: MockConfigEntry
) -> None:
    """Device identifiers map to host, channel, lens, chime or other."""
    (handle,) = bridge.async_get_hosts(hass)
    r = "reolink"
    assert handle.classify_device({(r, TEST_UID)}) == DeviceRef(DeviceRole.HOST, None)
    assert handle.classify_device({(r, f"{TEST_UID}_{TEST_UID_CAM}")}) == DeviceRef(
        DeviceRole.CHANNEL, 0
    )
    assert handle.classify_device({(r, f"{TEST_UID}_ch0")}) == DeviceRef(
        DeviceRole.CHANNEL, 0
    )
    assert handle.classify_device({(r, f"{TEST_UID}_lens1")}) == DeviceRef(
        DeviceRole.LENS, 1
    )
    assert handle.classify_device({(r, f"{TEST_UID}_chime12")}) == DeviceRef(
        DeviceRole.CHIME, None
    )
    for other in ({(r, f"{TEST_UID}_lensx")}, {(r, "elsewhere")}, {("mqtt", TEST_UID)}):
        assert handle.classify_device(other) == DeviceRef(DeviceRole.OTHER, None)
    reolink_host.is_nvr = False
    assert handle.classify_device({(r, TEST_UID)}) == DeviceRef(DeviceRole.HOST, 0)


async def test_battery_and_wifi_details(
    hass: HomeAssistant, reolink_host: MagicMock, loaded_reolink: MockConfigEntry
) -> None:
    """Battery cameras report battery state; Wi-Fi cameras their signal."""
    (handle,) = bridge.async_get_hosts(hass)
    reolink_host.supported.side_effect = lambda ch, cap, *a: True
    reolink_host.battery_status.return_value = 1
    reolink_host.baichuan.wifi_connection = MagicMock(return_value=True)
    reolink_host.wifi_connection.return_value = True
    details = handle.channel_details(0)
    assert details["battery"] == {
        "percent": 85,
        "temperature_c": 25,
        "status": "charging",
    }
    assert details["network"] == {"connection": "wifi", "wifi_signal_dbm": -45}
    assert "Battery" in details["capabilities"]
    assert handle.host_details()["network"]["wifi_signal_dbm"] == -45


async def test_sub_devices_attach_to_their_camera(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_with_entities: MockConfigEntry,
) -> None:
    """A lens or chime device is part of the camera it is linked to."""
    dev_reg = dr.async_get(hass)
    camera = (await _devices(hass, hass_ws_client))["cameras"][0]
    chime = dev_reg.async_get_or_create(
        config_entry_id=loaded_with_entities.entry_id,
        identifiers={("reolink", f"{TEST_UID}_chime3")},
        via_device_id=camera["id"],
        name="Chime",
    )
    orphan = dev_reg.async_get_or_create(
        config_entry_id=loaded_with_entities.entry_id,
        identifiers={("reolink", f"{TEST_UID}_lens1")},
        name="Lens 1",
    )
    ent_reg = er.async_get(hass)
    entity = ent_reg.async_get_or_create(
        "switch", "reolink", "chime_led", device_id=chime.id, translation_key="led"
    )
    msg = await _ws(
        hass, hass_ws_client, type="reolink_viewer/device", device_id=chime.id
    )
    result = msg["result"]
    assert result["node"]["id"] == camera["id"]
    (conn,) = result["connections"]
    led = next(e for e in conn["entities"] if e["entity_id"] == entity.entity_id)
    assert led["sub_device"] == "Chime"
    assert led["category"] == "lighting"
    # A lens without a via link falls back to the entry's host.
    msg = await _ws(
        hass, hass_ws_client, type="reolink_viewer/device", device_id=orphan.id
    )
    assert msg["result"]["node"]["kind"] == "nvr"


def test_snapshot_preference() -> None:
    """Snapshots use the lightest enabled stream."""

    def cam(key: str, disabled: bool = False) -> Any:
        return SimpleNamespace(
            entity_id=f"camera.{key}",
            domain="camera",
            translation_key=key,
            disabled_by=er.RegistryEntryDisabler.INTEGRATION if disabled else None,
        )

    assert devices._snapshot_entity([cam("main"), cam("sub", True), cam("ext")]) == (
        "camera.ext"
    )
    assert (
        devices._snapshot_entity([cam("telephoto_sub"), cam("main")]) == "camera.main"
    )
    assert devices._snapshot_entity([cam("sub", True)]) is None

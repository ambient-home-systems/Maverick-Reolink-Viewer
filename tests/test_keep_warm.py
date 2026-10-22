"""Tests for keep warm: the keeper (live/warm.py) and its switches (switch.py)."""

import asyncio
from dataclasses import replace
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from pytest_homeassistant_custom_component.common import (
    MockConfigEntry,
    async_fire_time_changed,
)
from pytest_homeassistant_custom_component.typing import WebSocketGenerator

from custom_components.reolink_viewer import devices
from custom_components.reolink_viewer.devices import LiveSource
from custom_components.reolink_viewer.live.streams import LiveError, LiveStream
from custom_components.reolink_viewer.live.warm import WarmKeeper
from custom_components.reolink_viewer.scheduler import HostLimits, Scheduler
from custom_components.reolink_viewer.switch import DISCOVER_S, default_warm
from homeassistant.const import STATE_OFF, STATE_ON
from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er
from homeassistant.util import dt as dt_util

GARAGE = LiveSource("cam1", "dev1", "Garage", "nvr-entry", 1, "nvr")
HALL = LiveSource("cam2", "dev2", "Hallway", "nvr-entry", 2, "nvr")
DOORBELL = LiveSource("cam3", "dev3", "Doorbell", "bell-entry", 0, "direct", True)


class FakeRelay:
    """What the keeper asks of the relay, and which streams are warm."""

    def __init__(self) -> None:
        self.calls: list[tuple[str, bool, str]] = []
        self.warm: set[str] = set()
        self.fail: set[str] = set()

    async def async_keep_warm(
        self, stream: LiveStream, enabled: bool, *, owner: str = "check"
    ) -> bool:
        self.calls.append((stream.source.camera_id, enabled, owner))
        if enabled and stream.source.camera_id in self.fail:
            raise LiveError("no route to host")
        if enabled:
            self.warm.add(stream.name)
        else:
            self.warm.discard(stream.name)
        return enabled

    def warm_streams(self) -> list[str]:
        return list(self.warm)


@pytest.fixture
def keeper(hass: HomeAssistant) -> tuple[WarmKeeper, FakeRelay, dict[str, LiveSource]]:
    relay = FakeRelay()
    sources = {s.camera_id: s for s in (GARAGE, HALL, DOORBELL)}
    keeper = WarmKeeper(hass, relay)  # type: ignore[arg-type]
    return keeper, relay, sources


async def test_the_keeper_follows_the_switches(
    keeper: tuple[WarmKeeper, FakeRelay, dict[str, LiveSource]],
) -> None:
    """On: the camera's sub kept warm as the setting; off: let go; battery: never."""
    warm, relay, sources = keeper
    with patch.object(devices, "async_image_sources", return_value=sources):
        for camera in ("cam1", "cam2", "cam3"):
            warm.want(camera, True)
        await warm.async_reconcile()
        assert sorted(relay.calls) == [
            ("cam1", True, "setting"),
            ("cam2", True, "setting"),
        ]
        assert warm.warm_cameras() == {"cam1", "cam2"}
        assert relay.warm == {
            LiveStream(GARAGE, "sub").name,
            LiveStream(HALL, "sub").name,
        }
        # Nothing changed: nothing asked again.
        relay.calls.clear()
        await warm.async_reconcile()
        assert relay.calls == []
        # Off.
        warm.want("cam2", False)
        await warm.async_reconcile()
        assert relay.calls == [("cam2", False, "setting")]
        assert warm.warm_cameras() == {"cam1"}
        # The relay dropped it (a failed reopen): asked again.
        relay.warm.clear()
        relay.calls.clear()
        await warm.async_reconcile()
        assert relay.calls == [("cam1", True, "setting")]

    # The camera is gone (its Reolink entry unloaded): let go.
    relay.calls.clear()
    with patch.object(devices, "async_image_sources", return_value={}):
        await warm.async_reconcile()
    assert relay.calls == [("cam1", False, "setting")]
    assert warm.warm_cameras() == set()


async def test_a_camera_that_cannot_be_kept_warm_is_tried_again(
    keeper: tuple[WarmKeeper, FakeRelay, dict[str, LiveSource]],
) -> None:
    """An offline camera fails now and is asked for again at the next reconcile."""
    warm, relay, sources = keeper
    relay.fail.add("cam1")
    with patch.object(devices, "async_image_sources", return_value=sources):
        warm.want("cam1", True)
        await warm.async_reconcile()
        assert warm.warm_cameras() == set()
        relay.fail.clear()
        await warm.async_reconcile()
    assert warm.warm_cameras() == {"cam1"}
    assert [c for c in relay.calls if c[0] == "cam1"] == [("cam1", True, "setting")] * 2


async def test_a_new_connection_moves_the_warm_stream(
    keeper: tuple[WarmKeeper, FakeRelay, dict[str, LiveSource]],
) -> None:
    """When a camera's connection changes (an NVR added), the old stream goes cold."""
    warm, relay, sources = keeper
    direct = LiveSource("cam1", "dev9", "Garage", "cam-entry", 0, "direct")
    warm.want("cam1", True)
    with patch.object(devices, "async_image_sources", return_value={"cam1": direct}):
        await warm.async_reconcile()
    with patch.object(devices, "async_image_sources", return_value=sources):
        await warm.async_reconcile()
    assert relay.warm == {LiveStream(GARAGE, "sub").name}
    assert ("cam1", False, "setting") in relay.calls


async def test_the_keeper_runs_until_shut_down(
    hass: HomeAssistant,
    keeper: tuple[WarmKeeper, FakeRelay, dict[str, LiveSource]],
) -> None:
    """Started, it reconciles at once and when a switch changes; it stops on shutdown."""
    warm, relay, sources = keeper
    with patch.object(devices, "async_image_sources", return_value=sources):
        # conftest stubs start() (it would run in every test): run the loop here.
        warm._task = hass.async_create_background_task(warm._run(), "test keeper")
        warm.want("cam1", True)
        for _ in range(20):
            await asyncio.sleep(0.01)
            if relay.calls:
                break
        assert relay.calls == [("cam1", True, "setting")]
        # A reconcile that raises does not stop it.
        with patch.object(warm, "async_reconcile", side_effect=RuntimeError("boom")):
            warm.want("cam2", True)
            await asyncio.sleep(0.05)
        assert not warm._task.done()
    await warm.async_shutdown()
    assert not running(warm)
    assert warm.warm_cameras() == set()


def running(keeper: WarmKeeper) -> bool:
    """Whether the keeper's loop runs (a call, so mypy does not narrow it)."""
    return keeper._task is not None


def test_default_warm_fits_the_budget() -> None:
    """Mains-powered cameras, in channel order, up to the budget less one for HD."""
    scheduler = Scheduler(
        default_limit=2,
        default_stream_limit=2,
        resolver=lambda key: HostLimits(6, 3) if key == "nvr-entry" else None,
    )
    third = LiveSource("cam4", "dev4", "Dogs", "nvr-entry", 0, "nvr")
    direct = LiveSource("cam5", "dev5", "Laundry", "cam-entry", 0, "direct")
    sources = {s.camera_id: s for s in (GARAGE, HALL, DOORBELL, third, direct)}
    # The NVR's 3 slots leave 2 (channels 0 and 1); the camera's 2 leave 1.
    assert default_warm(sources, scheduler) == {"cam4", "cam1", "cam5"}


async def _ws(client: Any, payload: dict[str, Any]) -> dict[str, Any]:
    await client.send_json_auto_id(payload)
    msg: dict[str, Any] = await client.receive_json()
    return msg


async def test_switches_set_and_restore_keep_warm(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    reolink_host: MagicMock,
    loaded_with_entities: MockConfigEntry,
    viewer_entry: MockConfigEntry,
) -> None:
    """A switch per mains-powered camera, on by default, drives the keeper."""
    live = viewer_entry.runtime_data.live
    assert live is not None
    entities = er.async_get(hass)
    ours = [
        e
        for e in er.async_entries_for_config_entry(entities, viewer_entry.entry_id)
        if e.domain == "switch"
    ]
    cameras = devices.async_image_sources(hass)
    assert len(ours) == len([s for s in cameras.values() if not s.is_battery]) >= 1
    entity_id = ours[0].entity_id
    assert entity_id.endswith("_keep_live_view_warm")
    state = hass.states.get(entity_id)
    assert state is not None
    assert state.state == STATE_ON  # within the NVR's budget
    assert live.warm._wanted == dict.fromkeys(cameras, True)
    # The panel finds it next to the camera.
    client = await hass_ws_client(hass)
    msg = await _ws(client, {"type": "reolink_viewer/live/cameras"})
    assert {c["keep_warm_entity"] for c in msg["result"]["cameras"]} == {entity_id}

    # Turned off through Home Assistant's action, like any setting.
    await hass.services.async_call(
        "switch", "turn_off", {"entity_id": entity_id}, blocking=True
    )
    state = hass.states.get(entity_id)
    assert state is not None
    assert state.state == STATE_OFF
    assert set(live.warm._wanted.values()) == {False}
    await hass.services.async_call(
        "switch", "turn_on", {"entity_id": entity_id}, blocking=True
    )
    assert set(live.warm._wanted.values()) == {True}

    # Unloaded: the keeper lets the camera go cold.
    await hass.services.async_call(
        "switch", "turn_off", {"entity_id": entity_id}, blocking=True
    )
    assert await hass.config_entries.async_unload(viewer_entry.entry_id)
    assert set(live.warm._wanted.values()) == {False}

    # Set up again: the switch comes back as it was (off), not as the default.
    assert await hass.config_entries.async_setup(viewer_entry.entry_id)
    await hass.async_block_till_done()
    state = hass.states.get(entity_id)
    assert state is not None
    assert state.state == STATE_OFF
    live = viewer_entry.runtime_data.live
    assert live is not None
    assert set(live.warm._wanted.values()) == {False}


async def test_battery_cameras_get_none_and_gone_cameras_are_unavailable(
    hass: HomeAssistant,
    reolink_host: MagicMock,
    loaded_with_entities: MockConfigEntry,
    viewer_entry: MockConfigEntry,
) -> None:
    """A camera that goes away leaves its switch unavailable; batteries get none."""
    entities = er.async_get(hass)
    (switch,) = [
        e
        for e in er.async_entries_for_config_entry(entities, viewer_entry.entry_id)
        if e.domain == "switch"
    ]
    sources = devices.async_image_sources(hass)
    with patch.object(devices, "async_image_sources", return_value={}):
        async_fire_time_changed(hass, dt_util.utcnow() + DISCOVER_S)
        await hass.async_block_till_done()
    state = hass.states.get(switch.entity_id)
    assert state is not None
    assert state.state == "unavailable"
    async_fire_time_changed(hass, dt_util.utcnow() + DISCOVER_S * 2)
    await hass.async_block_till_done()
    state = hass.states.get(switch.entity_id)
    assert state is not None
    assert state.state == STATE_ON

    # Only battery cameras: no switch, nothing wanted warm.
    assert await hass.config_entries.async_unload(viewer_entry.entry_id)
    battery = {cid: replace(s, is_battery=True) for cid, s in sources.items()}
    with patch.object(devices, "async_image_sources", return_value=battery):
        assert await hass.config_entries.async_setup(viewer_entry.entry_id)
        await hass.async_block_till_done()
    state = hass.states.get(switch.entity_id)
    assert state is None or state.state == "unavailable"
    live = viewer_entry.runtime_data.live
    assert live is not None
    assert live.warm._wanted == {}

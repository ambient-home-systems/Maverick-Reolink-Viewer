"""Tests for the Wall's saved layouts (Phase 9 step 1: wall.py and wall/layouts)."""

from datetime import timedelta
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock

from freezegun.api import FrozenDateTimeFactory
import pytest
from pytest_homeassistant_custom_component.common import (
    MockConfigEntry,
    async_fire_time_changed,
)
from pytest_homeassistant_custom_component.typing import WebSocketGenerator

from custom_components.reolink_viewer.wall import (
    MAX_LAYOUTS,
    STORE_KEY,
    LayoutError,
    WallStore,
    layout_of,
    slug,
)
from homeassistant.core import HomeAssistant


def test_a_layout_is_checked_and_its_name_is_its_address() -> None:
    """A name, a known grid, cameras by id (an empty cell is None), a tour or none."""
    assert slug("Front of house") == "front-of-house"
    assert slug("  Ünïcode / 2x2!! ") == "n-code-2x2"
    assert slug("***") == "layout"
    layout = layout_of({"name": " Night ", "grid": "1+5", "cameras": ["a", None]})
    assert layout == {
        "id": "",
        "name": "Night",
        "grid": "1+5",
        "cameras": ["a", None],
        "tour_s": None,
        # Step 4: the feeds' floodlight and siren buttons and the strip, shown
        # unless said (a layout kept before reads as it did).
        "floodlight": True,
        "siren": True,
        "strip": True,
    }
    quiet = layout_of({"name": "Kiosk", "floodlight": False, "siren": False})
    assert (quiet["floodlight"], quiet["siren"], quiet["strip"]) == (False, False, True)
    for bad, said in (
        ({"name": ""}, "needs a name"),
        ({"name": "x" * 61}, "at most 60"),
        ({"name": "x", "grid": "5x5"}, "Unknown grid"),
        ({"name": "x", "tour_s": 2}, "5 to 3600"),
        ({"name": "x", "cameras": ["c"] * 65}, "At most 64"),
        ({"name": "x", "siren": "off"}, "siren is shown or not"),
    ):
        with pytest.raises(LayoutError, match=said):
            layout_of(bad)


async def test_each_user_keeps_their_own_layouts(
    hass: HomeAssistant, hass_storage: dict[str, Any], freezer: FrozenDateTimeFactory
) -> None:
    """New ones get an id from the name (a second the same, -2); kept by id."""
    store = WallStore(hass)
    await store.async_load()
    first = store.save("ann", {"name": "Front", "grid": "2x2", "cameras": ["a"]})
    again = store.save("ann", {"name": "Front", "grid": "3x3"})
    assert (first["id"], again["id"]) == ("front", "front-2")
    # Renamed by its id: the address stays.
    renamed = store.save("ann", {"id": "front", "name": "Front door", "grid": "1"})
    assert renamed["id"] == "front"
    assert [layout["name"] for layout in store.layouts("ann")] == [
        "Front door",
        "Front",
    ]
    assert store.layouts("bob") == []
    assert store.delete("ann", "front-2")
    assert not store.delete("ann", "front-2")
    for index in range(MAX_LAYOUTS - 1):
        store.save("ann", {"name": f"L{index}", "grid": "auto"})
    with pytest.raises(LayoutError, match="At most 50 layouts"):
        store.save("ann", {"name": "One more", "grid": "auto"})

    # Kept across a restart; what no longer reads is left out.
    freezer.tick(timedelta(seconds=5))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    hass_storage[STORE_KEY]["data"]["users"]["ann"].append({"name": ""})
    reloaded = WallStore(hass)
    await reloaded.async_load()
    assert len(reloaded.layouts("ann")) == MAX_LAYOUTS


@pytest.fixture
async def viewer(
    hass: HomeAssistant,
    tmp_path: Path,
    reolink_host: MagicMock,
    reolink_entry: MockConfigEntry,
    viewer_entry: MockConfigEntry,
) -> MockConfigEntry:
    """Reolink and Reolink Viewer set up."""
    hass.config.config_dir = str(tmp_path)
    assert await hass.config_entries.async_setup(reolink_entry.entry_id)
    await hass.async_block_till_done()
    assert await hass.config_entries.async_setup(viewer_entry.entry_id)
    await hass.async_block_till_done()
    return viewer_entry


async def test_layouts_are_saved_listed_and_deleted_per_user(
    hass: HomeAssistant,
    viewer: MockConfigEntry,
    hass_ws_client: WebSocketGenerator,
    hass_read_only_access_token: str,
) -> None:
    """Any user may keep layouts; another user does not see them."""
    owner = await hass_ws_client(hass)
    await owner.send_json_auto_id(
        {
            "type": "reolink_viewer/wall/layouts/save",
            "name": "Night watch",
            "grid": "1+7",
            "cameras": ["cam-a", None, "cam-b"],
            "tour_s": 20,
            "siren": False,
        }
    )
    reply = await owner.receive_json()
    assert reply["success"], reply
    saved = reply["result"]["layout"]
    assert saved["id"] == "night-watch"
    assert (saved["floodlight"], saved["siren"], saved["strip"]) == (True, False, True)
    await owner.send_json_auto_id(
        {
            "type": "reolink_viewer/wall/layouts/save",
            "layout_id": "night-watch",
            "name": "Night",
            "grid": "1+7",
            "tour_s": None,
        }
    )
    assert (await owner.receive_json())["result"]["layout"]["name"] == "Night"
    await owner.send_json_auto_id({"type": "reolink_viewer/wall/layouts"})
    (layout,) = (await owner.receive_json())["result"]["layouts"]
    assert layout == {
        "id": "night-watch",
        "name": "Night",
        "grid": "1+7",
        "cameras": [],
        "tour_s": None,
        "floodlight": True,
        "siren": True,
        "strip": True,
    }

    other = await hass_ws_client(hass, hass_read_only_access_token)
    await other.send_json_auto_id({"type": "reolink_viewer/wall/layouts"})
    assert (await other.receive_json())["result"]["layouts"] == []

    # A name too long is said back; an unknown grid is refused.
    await owner.send_json_auto_id(
        {"type": "reolink_viewer/wall/layouts/save", "name": "x" * 61, "grid": "1"}
    )
    reply = await owner.receive_json()
    assert not reply["success"]
    assert "at most 60" in reply["error"]["message"]
    await owner.send_json_auto_id(
        {"type": "reolink_viewer/wall/layouts/save", "name": "x", "grid": "9x9"}
    )
    assert not (await owner.receive_json())["success"]

    await owner.send_json_auto_id(
        {"type": "reolink_viewer/wall/layouts/delete", "layout_id": "night-watch"}
    )
    assert (await owner.receive_json())["success"]
    await owner.send_json_auto_id({"type": "reolink_viewer/wall/layouts"})
    assert (await owner.receive_json())["result"]["layouts"] == []

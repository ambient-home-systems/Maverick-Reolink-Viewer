"""Tests for setup, the panel and degraded mode."""

import re
from unittest.mock import MagicMock, patch

from pytest_homeassistant_custom_component.common import MockConfigEntry
from pytest_homeassistant_custom_component.typing import ClientSessionGenerator

from custom_components.reolink_viewer.const import (
    CONF_BAICHUAN_DEEP_START,
    DOMAIN,
    ISSUE_INCOMPATIBLE,
    PANEL_COMPONENT_NAME,
    PANEL_URL_PATH,
    STATIC_URL_PATH,
)
from homeassistant.components.frontend import DATA_EXTRA_MODULE_URL, DATA_PANELS
from homeassistant.config_entries import ConfigEntryState
from homeassistant.const import EVENT_HOMEASSISTANT_STOP
from homeassistant.core import HomeAssistant
from homeassistant.helpers import issue_registry as ir
from homeassistant.setup import async_setup_component


async def test_setup_registers_panel(
    hass: HomeAssistant, loaded_viewer: MockConfigEntry
) -> None:
    """The panel is registered in the sidebar and served from the static path."""
    assert loaded_viewer.state is ConfigEntryState.LOADED
    panel = hass.data[DATA_PANELS][PANEL_URL_PATH]
    assert panel.config is not None
    custom = panel.config["_panel_custom"]
    assert custom["name"] == PANEL_COMPONENT_NAME
    assert custom["module_url"].startswith(
        f"{STATIC_URL_PATH}/reolink-viewer-panel.js?v="
    )
    assert panel.sidebar_title == "Reolink"
    # The dashboard card's module is on every page, from the same static path.
    (card,) = [
        url
        for url in hass.data[DATA_EXTRA_MODULE_URL].urls
        if url.startswith(f"{STATIC_URL_PATH}/reolink-viewer-card.js?v=")
    ]
    assert re.fullmatch(r".*\?v=[0-9a-f]{12}", card)
    assert not ir.async_get(hass).async_get_issue(DOMAIN, ISSUE_INCOMPATIBLE)
    # Deep starts follow the option, read at each start: on unless turned off.
    baichuan = loaded_viewer.runtime_data.baichuan
    assert baichuan is not None
    assert baichuan.enabled
    hass.config_entries.async_update_entry(
        loaded_viewer, options={CONF_BAICHUAN_DEEP_START: False}
    )
    assert not baichuan.enabled
    hass.config_entries.async_update_entry(
        loaded_viewer, options={CONF_BAICHUAN_DEEP_START: True}
    )
    assert baichuan.enabled


async def test_unload_and_reload(
    hass: HomeAssistant, loaded_viewer: MockConfigEntry
) -> None:
    """Unloading removes the panel; reloading does not re-register static paths."""
    assert await hass.config_entries.async_unload(loaded_viewer.entry_id)
    assert PANEL_URL_PATH not in hass.data[DATA_PANELS]
    assert not any(
        "reolink-viewer-card" in url for url in hass.data[DATA_EXTRA_MODULE_URL].urls
    )
    assert await hass.config_entries.async_setup(loaded_viewer.entry_id)
    await hass.async_block_till_done()
    assert loaded_viewer.state is ConfigEntryState.LOADED
    assert PANEL_URL_PATH in hass.data[DATA_PANELS]


async def test_go2rtc_stops_with_home_assistant(
    hass: HomeAssistant, loaded_viewer: MockConfigEntry
) -> None:
    """Our go2rtc is not left running past Home Assistant (it holds ports)."""
    live = loaded_viewer.runtime_data.live
    assert live is not None
    with patch.object(live, "async_shutdown") as shutdown:
        hass.bus.async_fire(EVENT_HOMEASSISTANT_STOP)
        await hass.async_block_till_done()
    shutdown.assert_awaited_once()


async def test_static_bundle_served(
    hass: HomeAssistant,
    hass_client: ClientSessionGenerator,
    loaded_viewer: MockConfigEntry,
) -> None:
    """The built panel and card are served: their modules and what they import."""
    assert await async_setup_component(hass, "http", {})
    client = await hass_client()
    for entry, name in (
        ("reolink-viewer-panel.js", PANEL_COMPONENT_NAME),
        ("reolink-viewer-card.js", "reolink-viewer-camera"),
    ):
        resp = await client.get(f"{STATIC_URL_PATH}/{entry}")
        assert resp.status == 200
        text = await resp.text()
        assert name in text
        imported = re.findall(r'(?:from |import\()"\./([\w~-]+\.js)"', text)
        assert imported
        for module in imported:
            resp = await client.get(f"{STATIC_URL_PATH}/{module}")
            assert resp.status == 200, module


async def test_incompatible_creates_issue(
    hass: HomeAssistant,
    reolink_host: MagicMock,
    loaded_reolink: MockConfigEntry,
    viewer_entry: MockConfigEntry,
) -> None:
    """A broken compatibility check still loads, in degraded mode, with a repair."""
    del reolink_host.get_vod_source
    assert await hass.config_entries.async_setup(viewer_entry.entry_id)
    await hass.async_block_till_done()
    assert viewer_entry.state is ConfigEntryState.LOADED
    issue = ir.async_get(hass).async_get_issue(DOMAIN, ISSUE_INCOMPATIBLE)
    assert issue is not None
    assert issue.translation_placeholders is not None
    assert "get_vod_source" in issue.translation_placeholders["errors"]


async def test_setup_without_reolink_entries(
    hass: HomeAssistant, viewer_entry: MockConfigEntry
) -> None:
    """Setup works with no Reolink entries at all."""
    with patch("homeassistant.components.reolink.PLATFORMS", []):
        assert await hass.config_entries.async_setup(viewer_entry.entry_id)
        await hass.async_block_till_done()
    assert viewer_entry.state is ConfigEntryState.LOADED


async def test_host_limits(
    hass: HomeAssistant,
    reolink_host: MagicMock,
    loaded_viewer: MockConfigEntry,
    reolink_entry: MockConfigEntry,
) -> None:
    """NVRs get 6 request slots and 7 streams; cameras 3 and 2; unknown 2 and 2."""
    scheduler = loaded_viewer.runtime_data.scheduler
    nvr = scheduler.host(reolink_entry.entry_id)
    assert (nvr.limit, nvr.streams.limit, nvr.streams.prefetch_limit) == (6, 7, 1)
    assert scheduler.host("unknown-entry").limit == 2
    scheduler.forget(reolink_entry.entry_id)
    reolink_host.is_nvr = False
    camera = scheduler.host(reolink_entry.entry_id)
    assert (camera.limit, camera.streams.limit) == (3, 2)

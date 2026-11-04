"""Tests for the config flow."""

from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.reolink_viewer.config_flow import unhelpful_signals
from custom_components.reolink_viewer.const import (
    CONF_BAICHUAN_DEEP_START,
    CONF_LEARN_NORMAL,
    CONF_UNUSUAL_SCOPE,
    CONF_UNUSUAL_SENSITIVITY,
    CONF_UNUSUAL_SIGNALS,
    DOMAIN,
)
from homeassistant.config_entries import SOURCE_USER
from homeassistant.const import EntityCategory
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from homeassistant.helpers import entity_registry as er


async def test_user_flow(hass: HomeAssistant) -> None:
    """The user confirms and a single entry is created."""
    result = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": SOURCE_USER}
    )
    assert result["type"] is FlowResultType.FORM
    assert result["step_id"] == "user"
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {})
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert result["title"] == "Reolink Viewer"
    assert result["data"] == {}


async def test_single_instance(hass: HomeAssistant) -> None:
    """A second flow aborts."""
    MockConfigEntry(domain=DOMAIN, data={}).add_to_hass(hass)
    result = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": SOURCE_USER}
    )
    assert result["type"] is FlowResultType.ABORT
    assert result["reason"] == "single_instance_allowed"


async def test_options_flow(hass: HomeAssistant) -> None:
    """Deep starts on by default; learning off; balanced marks, all cameras together."""
    entry = MockConfigEntry(domain=DOMAIN, data={})
    entry.add_to_hass(hass)
    result = await hass.config_entries.options.async_init(entry.entry_id)
    assert result["type"] is FlowResultType.FORM
    assert result["step_id"] == "init"
    schema = result["data_schema"]
    assert schema is not None
    assert schema({}) == {
        CONF_BAICHUAN_DEEP_START: True,
        CONF_LEARN_NORMAL: False,
        CONF_UNUSUAL_SENSITIVITY: "balanced",
        CONF_UNUSUAL_SCOPE: "together",
        CONF_UNUSUAL_SIGNALS: [],
    }
    chosen = {
        CONF_BAICHUAN_DEEP_START: False,
        CONF_LEARN_NORMAL: True,
        CONF_UNUSUAL_SENSITIVITY: "few",
        CONF_UNUSUAL_SCOPE: "host",
        CONF_UNUSUAL_SIGNALS: ["alarm_control_panel.house", "person.josh"],
    }
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], chosen
    )
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert entry.options == chosen


async def test_the_signal_picker_leaves_out_equipment_talking_about_itself(
    hass: HomeAssistant,
) -> None:
    """Diagnostics, settings and a device's own health are not house-wide signals."""
    registry = er.async_get(hass)
    alarm = registry.async_get_or_create("alarm_control_panel", "demo", "alarm")
    door = registry.async_get_or_create(
        "binary_sensor", "demo", "door", original_device_class="door"
    )
    battery = registry.async_get_or_create(
        "binary_sensor", "demo", "battery", original_device_class="battery"
    )
    firmware = registry.async_get_or_create(
        "binary_sensor", "demo", "firmware", entity_category=EntityCategory.DIAGNOSTIC
    )
    left_out = unhelpful_signals(hass)
    assert battery.entity_id in left_out
    assert firmware.entity_id in left_out
    assert alarm.entity_id not in left_out
    assert door.entity_id not in left_out

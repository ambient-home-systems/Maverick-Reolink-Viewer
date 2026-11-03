"""Tests for the config flow."""

from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.reolink_viewer.const import (
    CONF_BAICHUAN_DEEP_START,
    CONF_LEARN_NORMAL,
    CONF_UNUSUAL_SCOPE,
    CONF_UNUSUAL_SENSITIVITY,
    DOMAIN,
)
from homeassistant.config_entries import SOURCE_USER
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType


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
    }
    chosen = {
        CONF_BAICHUAN_DEEP_START: False,
        CONF_LEARN_NORMAL: True,
        CONF_UNUSUAL_SENSITIVITY: "few",
        CONF_UNUSUAL_SCOPE: "host",
    }
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], chosen
    )
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert entry.options == chosen

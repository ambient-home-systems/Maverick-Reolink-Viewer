"""Config flow for Reolink Viewer: a single instance, with its options."""

from typing import Any, override

import probatio

from homeassistant.config_entries import ConfigEntry, ConfigFlow, ConfigFlowResult
from homeassistant.core import callback
from homeassistant.helpers.schema_config_entry_flow import (
    SchemaFlowFormStep,
    SchemaOptionsFlowHandler,
)

from .const import CONF_BAICHUAN_DEEP_START, DEFAULT_BAICHUAN_DEEP_START, DOMAIN, NAME

# Phase 5b/5c: a start deep in an uncached recording asks the device for that
# moment over the Reolink protocol (on by default; devices that refuse it are
# found out). Read at each start, so no reload is needed.
OPTIONS_SCHEMA = probatio.Schema(
    {
        probatio.Required(
            CONF_BAICHUAN_DEEP_START, default=DEFAULT_BAICHUAN_DEEP_START
        ): bool
    }
)
OPTIONS_FLOW = {"init": SchemaFlowFormStep(OPTIONS_SCHEMA)}


class ReolinkViewerConfigFlow(ConfigFlow, domain=DOMAIN):
    """Handle the config flow."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Confirm and create the single entry."""
        # manifest.json sets single_config_entry, so HA aborts a second flow
        # before it reaches this step.
        if user_input is not None:
            return self.async_create_entry(title=NAME, data={})
        return self.async_show_form(step_id="user", data_schema=probatio.Schema({}))

    @staticmethod
    @callback
    @override
    def async_get_options_flow(config_entry: ConfigEntry) -> SchemaOptionsFlowHandler:
        """Return the options flow (one setting)."""
        return SchemaOptionsFlowHandler(config_entry, OPTIONS_FLOW)

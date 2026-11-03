"""Config flow for Reolink Viewer: a single instance, with its options."""

from typing import Any, override

import probatio

from homeassistant.config_entries import ConfigEntry, ConfigFlow, ConfigFlowResult
from homeassistant.core import callback
from homeassistant.helpers.schema_config_entry_flow import (
    SchemaFlowFormStep,
    SchemaOptionsFlowHandler,
)
from homeassistant.helpers.selector import (
    SelectSelector,
    SelectSelectorConfig,
    SelectSelectorMode,
)

from .const import (
    CONF_BAICHUAN_DEEP_START,
    CONF_LEARN_NORMAL,
    CONF_UNUSUAL_SCOPE,
    CONF_UNUSUAL_SENSITIVITY,
    DEFAULT_BAICHUAN_DEEP_START,
    DEFAULT_LEARN_NORMAL,
    DOMAIN,
    NAME,
)
from .unusual.const import (
    DEFAULT_SCOPE,
    DEFAULT_SENSITIVITY,
    SCOPES,
    SENSITIVITY_BALANCED,
    SENSITIVITY_FEW,
    SENSITIVITY_MANY,
)

# Phase 5b/5c: a start deep in an uncached recording asks the device for that
# moment over the Reolink protocol (on by default; devices that refuse it are
# found out). Read at each start, so no reload is needed.
# Phase 8: "Learn what is normal" keeps the detection journal (off by
# default); turning it off deletes the journal. Applied at once. How much is
# marked unusual, and what each camera is compared with, apply at once too (the
# model is rebuilt).
OPTIONS_SCHEMA = probatio.Schema(
    {
        probatio.Required(
            CONF_BAICHUAN_DEEP_START, default=DEFAULT_BAICHUAN_DEEP_START
        ): bool,
        probatio.Required(CONF_LEARN_NORMAL, default=DEFAULT_LEARN_NORMAL): bool,
        probatio.Required(
            CONF_UNUSUAL_SENSITIVITY, default=DEFAULT_SENSITIVITY
        ): SelectSelector(
            SelectSelectorConfig(
                options=[SENSITIVITY_FEW, SENSITIVITY_BALANCED, SENSITIVITY_MANY],
                mode=SelectSelectorMode.LIST,
                translation_key=CONF_UNUSUAL_SENSITIVITY,
            )
        ),
        probatio.Required(CONF_UNUSUAL_SCOPE, default=DEFAULT_SCOPE): SelectSelector(
            SelectSelectorConfig(
                options=list(SCOPES),
                mode=SelectSelectorMode.LIST,
                translation_key=CONF_UNUSUAL_SCOPE,
            )
        ),
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
        """Return the options flow."""
        return SchemaOptionsFlowHandler(config_entry, OPTIONS_FLOW)

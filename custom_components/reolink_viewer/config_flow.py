"""Config flow for Reolink Viewer: a single instance with no options."""

from typing import Any

import probatio

from homeassistant.config_entries import ConfigFlow, ConfigFlowResult

from .const import DOMAIN, NAME


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

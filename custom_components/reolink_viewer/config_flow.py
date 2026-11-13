"""Config flow for Reolink Viewer: a single instance, with its options."""

from typing import Any, override

import probatio

from homeassistant.config_entries import ConfigEntry, ConfigFlow, ConfigFlowResult
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.schema_config_entry_flow import (
    SchemaCommonFlowHandler,
    SchemaFlowFormStep,
    SchemaOptionsFlowHandler,
)
from homeassistant.helpers.selector import (
    EntitySelector,
    EntitySelectorConfig,
    EntityWithDeviceFilterSelectorConfig,
    NumberSelector,
    NumberSelectorConfig,
    NumberSelectorMode,
    SelectSelector,
    SelectSelectorConfig,
    SelectSelectorMode,
)

from .clips import MARGIN_MAX_S
from .const import (
    CONF_BAICHUAN_DEEP_START,
    CONF_EVENT_CLIP_AFTER,
    CONF_EVENT_CLIP_BEFORE,
    CONF_LEARN_NORMAL,
    CONF_UNUSUAL_SCOPE,
    CONF_UNUSUAL_SENSITIVITY,
    CONF_UNUSUAL_SIGNALS,
    DEFAULT_BAICHUAN_DEEP_START,
    DEFAULT_EVENT_CLIP_MARGIN,
    DEFAULT_LEARN_NORMAL,
    DOMAIN,
    NAME,
)
from .devices import async_detection_sensors
from .unusual.const import (
    DEFAULT_SCOPE,
    DEFAULT_SENSITIVITY,
    SCOPES,
    SENSITIVITY_BALANCED,
    SENSITIVITY_FEW,
    SENSITIVITY_MANY,
    SIGNAL_DOMAINS,
    SIGNAL_ENUM_DOMAINS,
    SIGNAL_SELF_REPORTING,
    SIGNAL_WORLD_CLASSES,
)

# Phase 5b/5c: a start deep in an uncached recording asks the device for that
# moment over the Reolink protocol (on by default; devices that refuse it are
# found out). Read at each start, so no reload is needed.
# Phase 8: "Learn what is normal" keeps the detection journal (off by
# default); turning it off deletes the journal. Applied at once. How much is
# marked unusual, what each camera is compared with, and the house-wide
# signals learned with, apply at once too (the model is rebuilt).
# Phase 11 step 2: how much "Save event" keeps before and after an event, read
# at each save.
_MARGIN = NumberSelector(
    NumberSelectorConfig(
        min=0,
        max=MARGIN_MAX_S,
        step=1,
        unit_of_measurement="s",
        mode=NumberSelectorMode.BOX,
    )
)
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
        probatio.Required(
            CONF_EVENT_CLIP_BEFORE, default=DEFAULT_EVENT_CLIP_MARGIN
        ): _MARGIN,
        probatio.Required(
            CONF_EVENT_CLIP_AFTER, default=DEFAULT_EVENT_CLIP_MARGIN
        ): _MARGIN,
    }
)


@callback
def unhelpful_signals(hass: HomeAssistant) -> list[str]:
    """Entities the signal picker leaves out (Stamina's ``signal_picker``).

    The cameras' own detection sensors (they are the detections: a person
    counted as a signal of a person makes every event ordinary), and
    equipment talking about itself: diagnostic and configuration entities,
    and binary sensors of a device's own health (battery, connectivity...).
    """
    try:
        own = set(async_detection_sensors(hass))
    except Exception:  # noqa: BLE001 - the Reolink integration not ready: none to hide
        own = set()
    for entry in er.async_get(hass).entities.values():
        if entry.domain not in SIGNAL_DOMAINS:
            continue
        device_class = entry.device_class or entry.original_device_class
        if entry.entity_category is not None or (
            entry.domain == "binary_sensor" and device_class in SIGNAL_SELF_REPORTING
        ):
            own.add(entry.entity_id)
    return sorted(own)


async def _options_schema(handler: SchemaCommonFlowHandler) -> probatio.Schema:
    """Return the options, with the house-wide signals the picker offers here."""
    hass = handler.parent_handler.hass
    return OPTIONS_SCHEMA.extend(
        {
            probatio.Optional(CONF_UNUSUAL_SIGNALS, default=[]): EntitySelector(
                EntitySelectorConfig(
                    multiple=True,
                    filter=[
                        EntityWithDeviceFilterSelectorConfig(
                            domain=list(SIGNAL_DOMAINS)
                        ),
                        EntityWithDeviceFilterSelectorConfig(
                            domain=list(SIGNAL_ENUM_DOMAINS), device_class="enum"
                        ),
                        EntityWithDeviceFilterSelectorConfig(
                            domain=list(SIGNAL_ENUM_DOMAINS),
                            device_class=list(SIGNAL_WORLD_CLASSES),
                        ),
                    ],
                    exclude_entities=unhelpful_signals(hass),
                )
            )
        }
    )


OPTIONS_FLOW = {"init": SchemaFlowFormStep(_options_schema)}


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

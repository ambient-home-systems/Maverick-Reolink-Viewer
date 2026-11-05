"""Device triggers: "Something unusual seen on <camera>" (Phase 8 step 4).

On Reolink Viewer's own device (``binary_sensor.UNUSUAL_DEVICE``), one per
camera with an "Unusual activity" sensor there; each fires with the
``reolink_viewer_unusual`` event for its camera, once per incident.
"""

from typing import Any

import probatio

from homeassistant.components.device_automation import DEVICE_TRIGGER_BASE_SCHEMA
from homeassistant.components.homeassistant.triggers import event as event_trigger
from homeassistant.const import CONF_DEVICE_ID, CONF_DOMAIN, CONF_PLATFORM, CONF_TYPE
from homeassistant.core import CALLBACK_TYPE, HomeAssistant
from homeassistant.helpers import device_registry as dr, entity_registry as er
from homeassistant.helpers.trigger import TriggerActionType, TriggerInfo
from homeassistant.helpers.typing import ConfigType

from .binary_sensor import UNUSUAL_DEVICE
from .const import DOMAIN
from .unusual.live import UNUSUAL_EVENT

TRIGGER_UNUSUAL = "unusual"
TRIGGER_TYPES = {TRIGGER_UNUSUAL}
# Which camera (its device id); the subtype is its name, as the editor shows it.
CONF_CAMERA_ID = "camera_id"
CONF_SUBTYPE = "subtype"

TRIGGER_SCHEMA = DEVICE_TRIGGER_BASE_SCHEMA.extend(
    {
        probatio.Required(CONF_TYPE): probatio.In(TRIGGER_TYPES),
        probatio.Required(CONF_CAMERA_ID): str,
        probatio.Optional(CONF_SUBTYPE): str,
    }
)


async def async_get_triggers(
    hass: HomeAssistant, device_id: str
) -> list[dict[str, Any]]:
    """Return "Something unusual seen on <camera>", per camera with the sensor."""
    devices = dr.async_get(hass)
    device = devices.async_get(device_id)
    if device is None or UNUSUAL_DEVICE not in device.identifiers:
        return []
    triggers = []
    for entry in er.async_entries_for_device(er.async_get(hass), device_id):
        camera = entry.unique_id.removesuffix("_unusual_activity")
        if entry.domain != "binary_sensor" or camera == entry.unique_id:
            continue
        found = devices.async_get(camera)
        triggers.append(
            {
                CONF_PLATFORM: "device",
                CONF_DOMAIN: DOMAIN,
                CONF_DEVICE_ID: device_id,
                CONF_TYPE: TRIGGER_UNUSUAL,
                CONF_CAMERA_ID: camera,
                CONF_SUBTYPE: (found.name_by_user or found.name or camera)
                if found is not None
                else camera,
            }
        )
    return triggers


async def async_attach_trigger(
    hass: HomeAssistant,
    config: ConfigType,
    action: TriggerActionType,
    trigger_info: TriggerInfo,
) -> CALLBACK_TYPE:
    """Fire on the camera's unusual events."""
    event_config = event_trigger.TRIGGER_SCHEMA(
        {
            event_trigger.CONF_PLATFORM: "event",
            event_trigger.CONF_EVENT_TYPE: UNUSUAL_EVENT,
            event_trigger.CONF_EVENT_DATA: {"device_id": config[CONF_CAMERA_ID]},
        }
    )
    return await event_trigger.async_attach_trigger(
        hass, event_config, action, trigger_info, platform_type="device"
    )

"""Binary sensors: a camera's "Unusual activity" (Phase 8 step 4).

On while a detection marked unusual is going on (and HOLD_S after it ends),
from the model of what is normal for that camera (``unusual/live.py``). One
per camera with detection sensors, all on Reolink Viewer's own device (a
device belongs to one integration: the cameras' are Reolink's), where the
automation editor offers each, and a "Something unusual seen on ..." trigger
per camera. Unavailable while "Learn what is normal" is off.
"""

from datetime import datetime, timedelta
import logging
from typing import Any

from homeassistant.components.binary_sensor import BinarySensorEntity
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.device_registry import DeviceEntryType, DeviceInfo
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.util import dt as dt_util

from . import devices
from .const import DOMAIN, NAME
from .models import ReolinkViewerConfigEntry
from .unusual.live import UnusualWatch

_LOGGER = logging.getLogger(__name__)

PARALLEL_UPDATES = 0
DISCOVER_S = timedelta(seconds=60)


# Reolink Viewer's own device, holding every camera's "Unusual activity".
UNUSUAL_DEVICE = (DOMAIN, "unusual")
UNUSUAL_SENSOR_SUFFIX = "_unusual_activity"


def unusual_unique_id(camera_id: str) -> str:
    """Return a camera's "Unusual activity" sensor's unique id."""
    return f"{camera_id}{UNUSUAL_SENSOR_SUFFIX}"


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ReolinkViewerConfigEntry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    """Add an "Unusual activity" sensor per camera, as cameras appear."""
    data = entry.runtime_data
    watch = data.watch
    if watch is None:
        return
    sensors: dict[str, UnusualActivitySensor] = {}

    @callback
    def discover(_now: datetime | None = None) -> None:
        try:
            cameras = {
                s.camera_id: s.camera_name
                for s in devices.async_detection_sensors(
                    hass, degraded=not data.compat_ok
                ).values()
            }
        except Exception:
            _LOGGER.exception("Cannot list the cameras for unusual activity")
            return
        new = [
            UnusualActivitySensor(watch, camera_id, name)
            for camera_id, name in sorted(cameras.items())
            if camera_id not in sensors
        ]
        for sensor in new:
            sensors[sensor.camera_id] = sensor
        if new:
            async_add_entities(new)

    discover()
    entry.async_on_unload(async_track_time_interval(hass, discover, DISCOVER_S))


class UnusualActivitySensor(BinarySensorEntity):
    """On while something unusual for this camera is going on."""

    _attr_has_entity_name = True
    _attr_translation_key = "unusual_activity"
    _attr_should_poll = False

    def __init__(self, watch: UnusualWatch, camera_id: str, camera_name: str) -> None:
        """Initialize, on Reolink Viewer's own device."""
        self._watch = watch
        self.camera_id = camera_id
        self._attr_unique_id = unusual_unique_id(camera_id)
        self._attr_translation_placeholders = {"camera": camera_name}
        self._attr_device_info = DeviceInfo(
            identifiers={UNUSUAL_DEVICE},
            name=NAME,
            manufacturer=NAME,
            entry_type=DeviceEntryType.SERVICE,
        )

    async def async_added_to_hass(self) -> None:
        """Follow the watch."""
        await super().async_added_to_hass()
        self.async_on_remove(self._watch.listen(self.async_write_ha_state))

    @property
    def available(self) -> bool:
        """Return whether it watches ("Learn what is normal" is on)."""
        return self._watch.enabled

    @property
    def is_on(self) -> bool:
        """Return whether unusual activity is going on."""
        return self._watch.is_active(self.camera_id)

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Return the last unusual detection: what, why, how unusual, when."""
        mark = self._watch.mark(self.camera_id)
        if mark is None:
            return {"camera_id": self.camera_id}
        return {
            "camera_id": self.camera_id,
            "kind": mark.kind,
            "reason": mark.reason,
            "score": round(mark.score, 2),
            "line": None if mark.line is None else round(mark.line, 2),
            "start": dt_util.utc_from_timestamp(mark.start).isoformat(),
        }

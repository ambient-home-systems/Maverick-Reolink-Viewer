"""Switches: keep a camera's live view warm, one per mains-powered camera.

They are the setting behind keep warm (``live/warm.py``), held in Home
Assistant's state like any other setting: the panel turns them on and off
with ``switch.turn_on`` and ``switch.turn_off``, and automations can too.
Their state is restored after a restart. A camera's switch is added once its
Reolink entry has loaded (looked for again every DISCOVER_S); a camera that
goes away leaves its switch unavailable.

By default a camera's switch is on, as many per host as its stream budget
allows after one HD stream: a warm sub stream starts at once, a cold one
waits for the camera's next key frame, up to 4 s (Phase 3 step 1). Battery
cameras get none: they are never kept warm, so they can sleep.
"""

from datetime import datetime, timedelta
import logging
from typing import Any

from homeassistant.components.switch import SwitchEntity
from homeassistant.const import STATE_OFF, STATE_ON, EntityCategory
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.helpers.restore_state import RestoreEntity

from . import devices
from .devices import LiveSource
from .live.warm import WarmKeeper, keep_warm_unique_id
from .models import ReolinkViewerConfigEntry
from .scheduler import Scheduler

_LOGGER = logging.getLogger(__name__)

PARALLEL_UPDATES = 0
DISCOVER_S = timedelta(seconds=60)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ReolinkViewerConfigEntry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    """Add a keep-warm switch per mains-powered camera, as cameras appear."""
    data = entry.runtime_data
    live = data.live
    if live is None or not data.compat_ok:
        return
    switches: dict[str, KeepWarmSwitch] = {}

    @callback
    def discover(_now: datetime | None = None) -> None:
        try:
            sources = devices.async_image_sources(hass)
        except Exception:
            _LOGGER.exception("Cannot list the cameras to keep warm")
            return
        on = default_warm(sources, data.scheduler)
        new = [
            KeepWarmSwitch(live.warm, camera_id, source.name, camera_id in on)
            for camera_id, source in sources.items()
            if not source.is_battery and camera_id not in switches
        ]
        for switch in new:
            switches[switch.camera_id] = switch
        if new:
            async_add_entities(new)
        for camera_id, switch in switches.items():
            switch.set_present(camera_id in sources)

    discover()
    entry.async_on_unload(async_track_time_interval(hass, discover, DISCOVER_S))


def default_warm(sources: dict[str, LiveSource], scheduler: Scheduler) -> set[str]:
    """Return the cameras kept warm by default.

    Mains-powered cameras, in channel order, as many per host as its stream
    budget allows after one HD stream.
    """
    by_host: dict[str, list[tuple[int, str]]] = {}
    for camera_id, source in sources.items():
        if not source.is_battery:
            by_host.setdefault(source.entry_id, []).append((source.channel, camera_id))
    on: set[str] = set()
    for entry_id, cameras in by_host.items():
        room = scheduler.host(entry_id).streams.limit - 1
        on.update(camera_id for _channel, camera_id in sorted(cameras)[: max(room, 0)])
    return on


class KeepWarmSwitch(SwitchEntity, RestoreEntity):
    """Keep one camera's sub stream warm."""

    _attr_has_entity_name = True
    _attr_translation_key = "keep_warm"
    _attr_entity_category = EntityCategory.CONFIG
    _attr_should_poll = False

    def __init__(
        self, keeper: WarmKeeper, camera_id: str, camera_name: str, default: bool
    ) -> None:
        """Initialize (on or off by default, until a restored state says)."""
        self._keeper = keeper
        self.camera_id = camera_id
        self._attr_unique_id = keep_warm_unique_id(camera_id)
        self._attr_translation_placeholders = {"camera": camera_name}
        self._attr_is_on = default
        self._added = False

    async def async_added_to_hass(self) -> None:
        """Restore the last state, and tell the keeper."""
        await super().async_added_to_hass()
        last = await self.async_get_last_state()
        if last is not None and last.state in (STATE_ON, STATE_OFF):
            self._attr_is_on = last.state == STATE_ON
        self._added = True
        self._keeper.want(self.camera_id, self._attr_is_on is True)

    async def async_will_remove_from_hass(self) -> None:
        """Let the camera go cold."""
        self._added = False
        self._keeper.want(self.camera_id, False)

    async def async_turn_on(self, **kwargs: Any) -> None:
        """Keep the camera warm."""
        self._set(True)

    async def async_turn_off(self, **kwargs: Any) -> None:
        """Let the camera go cold."""
        self._set(False)

    def _set(self, on: bool) -> None:
        self._attr_is_on = on
        self._keeper.want(self.camera_id, on)
        self.async_write_ha_state()

    @callback
    def set_present(self, present: bool) -> None:
        """Mark the switch unavailable while its camera is gone."""
        if self._attr_available != present:
            self._attr_available = present
            if self._added:
                self.async_write_ha_state()

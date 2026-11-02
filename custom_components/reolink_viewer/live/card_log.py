"""What the dashboard cards saw, per device (Phase 7 step 2).

A wall tablet turns its screen off and on, starts a screensaver, reloads the
page; whether the cards' video stops then, and how soon it is back, can only
be seen on the tablet. Each page with a card sends what it saw here every
minute (``live/card_log/add``): the page hidden and shown, Fully Kiosk's
screen and screensaver events, each card's video starting, playing and
stopping, and how many frames it decoded. Any device can read it in the
panel (``live/card_log``), so a tablet's night can be read on a desktop.

Kept in Home Assistant's storage, the newest MAX_EVENTS per device, for
MAX_DEVICES devices. It holds times, camera names and states only: never a
URL or credential.
"""

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

STORE_KEY = "reolink_viewer.card_log"
MAX_EVENTS = 3000
MAX_DEVICES = 10
SAVE_DELAY = 30.0


@dataclass(slots=True)
class DeviceLog:
    """One device's events, oldest first."""

    device: str
    updated: str
    events: list[dict[str, Any]] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        """Return a JSON-serializable dict."""
        return {"device": self.device, "updated": self.updated, "events": self.events}


class CardLog:
    """The dashboard cards' events, per device, in Home Assistant's storage."""

    def __init__(self, hass: HomeAssistant) -> None:
        """Initialize (call async_load before use)."""
        self._store: Store[dict[str, Any]] = Store(hass, 1, STORE_KEY)
        self._logs: dict[str, DeviceLog] = {}

    async def async_load(self) -> None:
        """Load what is stored."""
        data = await self._store.async_load()
        items = data.get("devices", []) if isinstance(data, dict) else []
        for item in items:
            if isinstance(item, dict) and isinstance(item.get("device"), str):
                events = [e for e in item.get("events", []) if isinstance(e, dict)]
                self._logs[item["device"]] = DeviceLog(
                    item["device"], str(item.get("updated", "")), events[-MAX_EVENTS:]
                )

    def add(self, device: str, events: list[dict[str, Any]]) -> None:
        """Add a device's new events (the oldest go past MAX_EVENTS)."""
        now = datetime.now(UTC).isoformat(timespec="seconds")
        log = self._logs.pop(device, None) or DeviceLog(device, now)
        log.updated = now
        log.events.extend(events)
        del log.events[:-MAX_EVENTS]
        # The device heard from last is kept last; the longest silent goes.
        self._logs[device] = log
        while len(self._logs) > MAX_DEVICES:
            del self._logs[next(iter(self._logs))]
        self._store.async_delay_save(self._data, SAVE_DELAY)

    def clear(self) -> None:
        """Start over: forget every device's events."""
        self._logs.clear()
        self._store.async_delay_save(self._data, 0)

    def logs(self) -> list[dict[str, Any]]:
        """Return every device's log, the one heard from last first."""
        return [log.as_dict() for log in reversed(self._logs.values())]

    def _data(self) -> dict[str, Any]:
        return {"devices": [log.as_dict() for log in self._logs.values()]}

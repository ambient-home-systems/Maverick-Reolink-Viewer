"""Runtime data of the Reolink Viewer config entry."""

import asyncio
from dataclasses import dataclass, field

from homeassistant.config_entries import ConfigEntry

from .scheduler import Scheduler


@dataclass(slots=True)
class ReolinkViewerData:
    """Data held while the entry is loaded."""

    scheduler: Scheduler
    probe_lock: asyncio.Lock = field(default_factory=asyncio.Lock)


type ReolinkViewerConfigEntry = ConfigEntry[ReolinkViewerData]

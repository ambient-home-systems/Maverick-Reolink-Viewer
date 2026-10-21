"""Runtime data of the Reolink Viewer config entry."""

import asyncio
from dataclasses import dataclass, field

from homeassistant.config_entries import ConfigEntry

from .checks import CheckReports
from .live.service import LiveService
from .scheduler import Scheduler
from .thumbnails import ThumbnailService
from .timeline import TimelineService
from .views import Grants
from .vodcache import VodCache


@dataclass(slots=True)
class ReolinkViewerData:
    """Data held while the entry is loaded."""

    scheduler: Scheduler
    timeline: TimelineService
    vod_cache: VodCache
    thumbnails: ThumbnailService
    check_reports: CheckReports
    grants: Grants = field(default_factory=Grants)
    live: LiveService | None = None
    probe_lock: asyncio.Lock = field(default_factory=asyncio.Lock)


type ReolinkViewerConfigEntry = ConfigEntry[ReolinkViewerData]

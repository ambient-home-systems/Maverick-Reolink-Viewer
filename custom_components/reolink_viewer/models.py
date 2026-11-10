"""Runtime data of the Reolink Viewer config entry."""

import asyncio
from dataclasses import dataclass, field

from homeassistant.config_entries import ConfigEntry

from .baichuan_source import BaichuanSource
from .checks import CheckReports
from .events import SeenStore
from .journal import Journal
from .live.service import LiveService
from .scheduler import Scheduler
from .scrub import ScrubService
from .thumbnails import ThumbnailService
from .timeline import TimelineService
from .unusual.live import UnusualWatch
from .unusual.model import Unusual
from .views import Grants
from .vodcache import VodCache
from .wall import WallStore


@dataclass(slots=True)
class ReolinkViewerData:
    """Data held while the entry is loaded."""

    scheduler: Scheduler
    timeline: TimelineService
    vod_cache: VodCache
    thumbnails: ThumbnailService
    check_reports: CheckReports
    seen: SeenStore
    grants: Grants = field(default_factory=Grants)
    live: LiveService | None = None
    probe_lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    # False in degraded mode: no live features that need the bridge.
    compat_ok: bool = True
    # Phase 5b's deep starts over the Reolink protocol (the option decides).
    baichuan: BaichuanSource | None = None
    # Phase 8's detection journal; it records while "Learn what is normal" is on.
    journal: Journal | None = None
    # Phase 8 step 2: the model, built from the journal while it records.
    unusual: Unusual | None = None
    # Phase 8 step 4: what is unusual as it happens (an event, a sensor per camera).
    watch: UnusualWatch | None = None
    # Phase 9: each user's saved Wall layouts.
    wall: WallStore | None = None
    # Phase 10: scrubbing that shows the picture (key frames from the server).
    scrub: ScrubService | None = None


type ReolinkViewerConfigEntry = ConfigEntry[ReolinkViewerData]

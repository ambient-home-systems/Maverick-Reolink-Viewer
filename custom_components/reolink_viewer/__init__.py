"""Reolink Viewer: a companion panel for HA's Reolink integration."""

import hashlib
import logging
from pathlib import Path

from homeassistant.components import frontend, panel_custom
from homeassistant.components.ffmpeg import get_ffmpeg_manager
from homeassistant.components.http import StaticPathConfig
from homeassistant.const import EVENT_HOMEASSISTANT_STOP, Platform
from homeassistant.core import Event, HomeAssistant, callback
from homeassistant.helpers import config_validation as cv, issue_registry as ir
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.start import async_at_started
from homeassistant.helpers.typing import ConfigType
from homeassistant.loader import async_get_integration
from homeassistant.util.hass_dict import HassKey
from homeassistant.util.ssl import SSLCipherList

from . import bridge, devices
from .baichuan_source import BaichuanSource
from .checks import CheckReports
from .const import (
    CAMERA_HOST_CONCURRENCY,
    CARD_FILENAME,
    CONF_BAICHUAN_DEEP_START,
    CONF_LEARN_NORMAL,
    CONF_UNUSUAL_SCOPE,
    CONF_UNUSUAL_SENSITIVITY,
    CONF_UNUSUAL_SIGNALS,
    DEFAULT_BAICHUAN_DEEP_START,
    DEFAULT_HOST_CONCURRENCY,
    DEFAULT_LEARN_NORMAL,
    DEFAULT_STREAM_BUDGET,
    DOMAIN,
    FRONTEND_DIST_DIR,
    GO2RTC_DIR,
    ISSUE_INCOMPATIBLE,
    LIVE_IMAGES_DIR,
    NVR_HOST_CONCURRENCY,
    NVR_STREAM_BUDGET,
    PANEL_COMPONENT_NAME,
    PANEL_FILENAME,
    PANEL_ICON,
    PANEL_TITLE,
    PANEL_URL_PATH,
    PREFETCH_STREAM_BUDGET,
    SCRUB_CACHE_DIR,
    STATIC_URL_PATH,
    THUMB_CACHE_DIR,
    THUMB_CACHE_MAX_BYTES,
    VOD_CACHE_DIR,
    VOD_CACHE_MAX_BYTES,
)
from .events import SeenStore
from .journal import Journal, delete_journal, journal_path
from .live.service import LiveService
from .live.views import LiveFrameView, LiveImageView, LiveMseView
from .live.websocket import async_register_live_commands
from .models import ReolinkViewerConfigEntry, ReolinkViewerData
from .scheduler import HostLimits, Scheduler
from .scrub import STORE_BYTES as SCRUB_STORE_BYTES, KeyFrameStore, ScrubService
from .thumbnails import ThumbnailService
from .timeline import TimelineService
from .unusual.const import DEFAULT_SCOPE, DEFAULT_SENSITIVITY
from .unusual.live import UnusualWatch
from .unusual.model import Unusual
from .views import ClipView, MseView, ScrubView, ThumbView, VodView
from .vodcache import VodCache
from .wall import WallStore
from .websocket_api import async_register_commands

_LOGGER = logging.getLogger(__name__)

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)
# Keep-warm switches, one per mains-powered camera.
PLATFORMS = [Platform.BINARY_SENSOR, Platform.SWITCH]

FRONTEND_DIR = Path(__file__).parent / FRONTEND_DIST_DIR
# Static paths cannot be unregistered, so register them once per HA run.
DATA_STATIC_REGISTERED: HassKey[bool] = HassKey(f"{DOMAIN}_static_registered")


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Register the websocket commands and HTTP views once."""
    async_register_commands(hass)
    async_register_live_commands(hass)
    # Views cannot be unregistered; they find the loaded entry per request.
    hass.http.register_view(VodView())
    hass.http.register_view(ClipView())
    hass.http.register_view(MseView())
    hass.http.register_view(ThumbView())
    hass.http.register_view(ScrubView())
    hass.http.register_view(LiveMseView())
    hass.http.register_view(LiveFrameView())
    hass.http.register_view(LiveImageView())
    return True


def _bundle_version(filename: str = PANEL_FILENAME) -> str:
    """Return a short content hash of a built module for cache busting."""
    try:
        return hashlib.sha256((FRONTEND_DIR / filename).read_bytes()).hexdigest()[:12]
    except OSError:
        return "missing"


def host_limits(hass: HomeAssistant, entry_id: str) -> HostLimits:
    """Return the scheduler limits of a Reolink host (NVR/Hub or camera)."""
    host = bridge.async_get_host(hass, entry_id)
    if host.is_nvr:
        return HostLimits(
            NVR_HOST_CONCURRENCY, NVR_STREAM_BUDGET, PREFETCH_STREAM_BUDGET
        )
    return HostLimits(
        CAMERA_HOST_CONCURRENCY, DEFAULT_STREAM_BUDGET, PREFETCH_STREAM_BUDGET
    )


async def async_setup_entry(
    hass: HomeAssistant, entry: ReolinkViewerConfigEntry
) -> bool:
    """Set up Reolink Viewer from a config entry."""
    # Read from disk, so not in the event loop: kept for the checks after.
    await hass.async_add_executor_job(bridge.library_version)
    compat = bridge.async_check_compat(hass)
    if compat.ok:
        ir.async_delete_issue(hass, DOMAIN, ISSUE_INCOMPATIBLE)
    else:
        _LOGGER.error(
            "Reolink Viewer cannot use the Reolink integration's internals (reolink-aio"
            " %s): %s. Running in degraded mode: live view, recordings and events"
            " are off, the panel lists devices from the device registry only and the"
            " probe is disabled",
            compat.reolink_aio_version,
            "; ".join(compat.errors),
        )
        ir.async_create_issue(
            hass,
            DOMAIN,
            ISSUE_INCOMPATIBLE,
            is_fixable=False,
            severity=ir.IssueSeverity.ERROR,
            translation_key=ISSUE_INCOMPATIBLE,
            translation_placeholders={"errors": "; ".join(compat.errors)},
        )

    scheduler = Scheduler(
        default_limit=DEFAULT_HOST_CONCURRENCY,
        default_stream_limit=DEFAULT_STREAM_BUDGET,
        resolver=lambda entry_id: host_limits(hass, entry_id),
    )
    cache_dir = Path(hass.config.cache_path(DOMAIN))
    # Phase 5b/5c: deep starts over the Reolink protocol, unless turned off.
    baichuan = BaichuanSource(
        hass,
        scheduler,
        enabled=lambda: (
            compat.ok
            and bool(
                entry.options.get(CONF_BAICHUAN_DEEP_START, DEFAULT_BAICHUAN_DEEP_START)
            )
        ),
    )
    vod_cache = VodCache(
        hass,
        scheduler,
        cache_dir / VOD_CACHE_DIR,
        VOD_CACHE_MAX_BYTES,
        # Reolink devices use self-signed certificates and old ciphers.
        lambda: async_get_clientsession(
            hass, verify_ssl=False, ssl_cipher=SSLCipherList.INSECURE
        ),
        ffmpeg_binary=get_ffmpeg_manager(hass).binary,
        baichuan=baichuan,
    )
    thumbnails = ThumbnailService(
        hass,
        scheduler,
        cache_dir / THUMB_CACHE_DIR,
        THUMB_CACHE_MAX_BYTES,
        get_ffmpeg_manager(hass).binary,
    )
    timeline = TimelineService(hass, scheduler)
    scrub = ScrubService(
        hass,
        timeline=timeline,
        cache=vod_cache,
        baichuan=baichuan,
        thumbnails=thumbnails,
        store=KeyFrameStore(hass, cache_dir / SCRUB_CACHE_DIR, SCRUB_STORE_BYTES),
    )
    check_reports = CheckReports(hass)
    seen = SeenStore(hass)
    wall = WallStore(hass)
    await vod_cache.async_setup()
    await thumbnails.async_setup()
    await scrub.store.async_setup()
    await check_reports.async_load()
    await seen.async_load()
    await wall.async_load()
    # go2rtc starts on the first live request.
    live = LiveService(
        hass,
        scheduler,
        cache_dir / GO2RTC_DIR,
        lambda: async_get_clientsession(hass),
        ffmpeg=get_ffmpeg_manager(hass).binary,
        images_dir=cache_dir / LIVE_IMAGES_DIR,
    )
    await live.images.async_setup()
    await live.soak.async_load()
    await live.card_log.async_load()
    journal = Journal(
        hass, lambda: devices.async_detection_sensors(hass, degraded=not compat.ok)
    )
    unusual = Unusual(
        hass,
        journal_path(hass),
        hosts=lambda: devices.async_camera_hosts(hass, degraded=not compat.ok),
        version=str((await async_get_integration(hass, DOMAIN)).version),
    )
    # Phase 8 step 4: each detection scored as it begins and ends.
    watch = UnusualWatch(
        hass,
        flush=journal.async_flush,
        window=unusual.async_window,
        model_built=lambda: bool(unusual.model.built_at),
        running=lambda: journal.running,
        names=lambda: unusual.names,
    )
    entry.runtime_data = ReolinkViewerData(
        scheduler=scheduler,
        timeline=timeline,
        vod_cache=vod_cache,
        baichuan=baichuan,
        thumbnails=thumbnails,
        check_reports=check_reports,
        seen=seen,
        live=live,
        compat_ok=compat.ok,
        journal=journal,
        unusual=unusual,
        watch=watch,
        wall=wall,
        scrub=scrub,
    )
    entry.async_on_unload(journal.listen_detections(watch.detected))
    entry.async_on_unload(watch.async_stop)
    await _async_apply_learning(hass, entry)
    entry.async_on_unload(entry.add_update_listener(_async_options_updated))

    async def stop_live(_event: Event) -> None:
        # Not left running past Home Assistant (it would hold its ports).
        await live.async_shutdown()
        # What the journal has not written yet.
        if entry.runtime_data.journal is not None:
            await entry.runtime_data.journal.async_stop()

    entry.async_on_unload(
        hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STOP, stop_live)
    )
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    @callback
    def started(_hass: HomeAssistant) -> None:
        # Samples for the soak report; and the streams the cameras' switches
        # keep warm, which come up once Home Assistant runs (Reolink too).
        live.soak.start()
        if compat.ok:
            live.warm.start()

    entry.async_on_unload(async_at_started(hass, started))

    if not hass.data.get(DATA_STATIC_REGISTERED):
        await hass.http.async_register_static_paths(
            [StaticPathConfig(STATIC_URL_PATH, str(FRONTEND_DIR), cache_headers=False)]
        )
        hass.data[DATA_STATIC_REGISTERED] = True

    bundle_version = await hass.async_add_executor_job(_bundle_version)
    await panel_custom.async_register_panel(
        hass,
        frontend_url_path=PANEL_URL_PATH,
        webcomponent_name=PANEL_COMPONENT_NAME,
        sidebar_title=PANEL_TITLE,
        sidebar_icon=PANEL_ICON,
        module_url=f"{STATIC_URL_PATH}/{PANEL_FILENAME}?v={bundle_version}",
        require_admin=False,
        config={},
    )
    # The dashboard card (custom:reolink-viewer-camera): its module on every
    # page, so it needs no dashboard resource; pages already open load it too.
    card_version = await hass.async_add_executor_job(_bundle_version, CARD_FILENAME)
    card_url = f"{STATIC_URL_PATH}/{CARD_FILENAME}?v={card_version}"
    frontend.add_extra_js_url(hass, card_url)
    entry.async_on_unload(lambda: frontend.remove_extra_js_url(hass, card_url))
    return True


async def _async_apply_learning(
    hass: HomeAssistant, entry: ReolinkViewerConfigEntry
) -> None:
    """Keep the detection journal while "Learn what is normal" is on; else none.

    While it is on, the model (Phase 8 step 2) is built from it once Home
    Assistant has started and the head start is imported, again each night,
    and again when its options change.
    """
    journal, unusual = entry.runtime_data.journal, entry.runtime_data.unusual
    if journal is None or unusual is None:
        return
    signals = [str(e) for e in entry.options.get(CONF_UNUSUAL_SIGNALS) or []]
    changed = unusual.configure(
        sensitivity=entry.options.get(CONF_UNUSUAL_SENSITIVITY, DEFAULT_SENSITIVITY),
        scope=entry.options.get(CONF_UNUSUAL_SCOPE, DEFAULT_SCOPE),
        signals=signals,
    )
    watch = entry.runtime_data.watch
    if not entry.options.get(CONF_LEARN_NORMAL, DEFAULT_LEARN_NORMAL):
        # Off: no journal on disk, whether it was running or left from before.
        unusual.async_cancel()
        unusual.forget()
        await journal.async_delete()
        if watch is not None:
            watch.async_stop()  # its sensors unavailable
        return
    starting = not journal.running
    await journal.async_set_signals(signals)
    await journal.async_start()
    if watch is not None and starting:
        watch.async_stop()  # its sensors available again, and off
    if not (starting or changed):
        return
    unusual.async_schedule()

    async def build() -> None:
        await journal.async_imported()
        # A restart takes the model saved last night, if it still holds; a new
        # journal, version or option learns again.
        if not (starting and await unusual.async_load()):
            await unusual.async_rebuild()

    @callback
    def started(_hass: HomeAssistant) -> None:
        entry.async_create_background_task(
            hass, build(), "reolink_viewer unusual first build"
        )

    entry.async_on_unload(async_at_started(hass, started))


async def _async_options_updated(
    hass: HomeAssistant, entry: ReolinkViewerConfigEntry
) -> None:
    """Apply the options that need it at once (the journal)."""
    await _async_apply_learning(hass, entry)


async def async_remove_entry(
    hass: HomeAssistant, entry: ReolinkViewerConfigEntry
) -> None:
    """Delete the detection journal: removing Reolink Viewer removes it."""
    await hass.async_add_executor_job(delete_journal, journal_path(hass))


async def async_unload_entry(
    hass: HomeAssistant, entry: ReolinkViewerConfigEntry
) -> bool:
    """Unload the entry."""
    if not await hass.config_entries.async_unload_platforms(entry, PLATFORMS):
        return False
    if entry.runtime_data.unusual is not None:
        entry.runtime_data.unusual.async_cancel()
    if entry.runtime_data.journal is not None:
        await entry.runtime_data.journal.async_stop()
    frontend.async_remove_panel(hass, PANEL_URL_PATH, warn_if_unknown=False)
    if entry.runtime_data.live is not None:
        await entry.runtime_data.live.async_shutdown()
    if entry.runtime_data.baichuan is not None:
        await entry.runtime_data.baichuan.async_shutdown()
    await entry.runtime_data.vod_cache.async_shutdown()
    await entry.runtime_data.scheduler.async_shutdown()
    return True

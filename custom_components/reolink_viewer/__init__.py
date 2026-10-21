"""Reolink Viewer: a companion panel for HA's Reolink integration."""

import hashlib
import logging
from pathlib import Path

from homeassistant.components import frontend, panel_custom
from homeassistant.components.ffmpeg import get_ffmpeg_manager
from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv, issue_registry as ir
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.typing import ConfigType
from homeassistant.util.hass_dict import HassKey
from homeassistant.util.ssl import SSLCipherList

from . import bridge
from .checks import CheckReports
from .const import (
    CAMERA_HOST_CONCURRENCY,
    DEFAULT_HOST_CONCURRENCY,
    DEFAULT_STREAM_BUDGET,
    DOMAIN,
    FRONTEND_DIST_DIR,
    ISSUE_INCOMPATIBLE,
    NVR_HOST_CONCURRENCY,
    NVR_STREAM_BUDGET,
    PANEL_COMPONENT_NAME,
    PANEL_FILENAME,
    PANEL_ICON,
    PANEL_TITLE,
    PANEL_URL_PATH,
    PREFETCH_STREAM_BUDGET,
    STATIC_URL_PATH,
    THUMB_CACHE_DIR,
    THUMB_CACHE_MAX_BYTES,
    VOD_CACHE_DIR,
    VOD_CACHE_MAX_BYTES,
)
from .models import ReolinkViewerConfigEntry, ReolinkViewerData
from .scheduler import HostLimits, Scheduler
from .thumbnails import ThumbnailService
from .timeline import TimelineService
from .views import ClipView, MseView, ThumbView, VodView
from .vodcache import VodCache
from .websocket_api import async_register_commands

_LOGGER = logging.getLogger(__name__)

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

FRONTEND_DIR = Path(__file__).parent / FRONTEND_DIST_DIR
# Static paths cannot be unregistered, so register them once per HA run.
DATA_STATIC_REGISTERED: HassKey[bool] = HassKey(f"{DOMAIN}_static_registered")


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Register the websocket commands and HTTP views once."""
    async_register_commands(hass)
    # Views cannot be unregistered; they find the loaded entry per request.
    hass.http.register_view(VodView())
    hass.http.register_view(ClipView())
    hass.http.register_view(MseView())
    hass.http.register_view(ThumbView())
    return True


def _bundle_version() -> str:
    """Return a short content hash of the panel bundle for cache busting."""
    try:
        return hashlib.sha256((FRONTEND_DIR / PANEL_FILENAME).read_bytes()).hexdigest()[
            :12
        ]
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
    compat = bridge.async_check_compat(hass)
    if compat.ok:
        ir.async_delete_issue(hass, DOMAIN, ISSUE_INCOMPATIBLE)
    else:
        _LOGGER.error(
            "Reolink Viewer cannot use the Reolink integration's internals (reolink-aio"
            " %s): %s. Running in degraded mode: the panel lists devices from the"
            " device registry only and the probe is disabled",
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
    )
    thumbnails = ThumbnailService(
        hass,
        scheduler,
        cache_dir / THUMB_CACHE_DIR,
        THUMB_CACHE_MAX_BYTES,
        get_ffmpeg_manager(hass).binary,
    )
    check_reports = CheckReports(hass)
    await vod_cache.async_setup()
    await thumbnails.async_setup()
    await check_reports.async_load()
    entry.runtime_data = ReolinkViewerData(
        scheduler=scheduler,
        timeline=TimelineService(hass, scheduler),
        vod_cache=vod_cache,
        thumbnails=thumbnails,
        check_reports=check_reports,
    )

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
    return True


async def async_unload_entry(
    hass: HomeAssistant, entry: ReolinkViewerConfigEntry
) -> bool:
    """Unload the entry."""
    frontend.async_remove_panel(hass, PANEL_URL_PATH, warn_if_unknown=False)
    await entry.runtime_data.vod_cache.async_shutdown()
    await entry.runtime_data.scheduler.async_shutdown()
    return True

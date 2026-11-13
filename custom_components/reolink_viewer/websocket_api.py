"""Websocket commands for the Reolink Viewer panel."""

from collections.abc import Callable
from datetime import UTC, date, datetime
import logging
import re
import time
from typing import Any

import probatio

from homeassistant.components import websocket_api
from homeassistant.components.ffmpeg import get_ffmpeg_manager
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import device_registry as dr, entity_registry as er
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.loader import async_get_integration, async_get_loaded_integration
from homeassistant.util.ssl import SSLCipherList

from . import bridge, devices, events
from .binary_sensor import UNUSUAL_DEVICE, UNUSUAL_SENSOR_SUFFIX
from .catalog import async_get_catalog
from .checks import MAX_TEXT
from .const import DOMAIN, PROBE_HARD_MAX_STREAMS, PROBE_PLAYBACK_HARD_MAX_STREAMS
from .models import ReolinkViewerConfigEntry
from .probe import ProbeOptions, Prober
from .probe_baichuan import BaichuanOptions
from .probe_events import EventsOptions
from .probe_playback import PlaybackOptions
from .scheduler import Priority
from .thumbnails import BUCKETS_S
from .timeconv import epoch_ms
from .timeline import TimelineError
from .unusual import check as unusual_check
from .unusual.model import mark_payload
from .unusual.score import incidents
from .unusual.shapes import profile_payload
from .views import (
    CLIP_PATH,
    MSE_PATH,
    SCRUB_PATH,
    SCRUB_TTL,
    THUMB_PATH,
    THUMB_TTL,
    VOD_PATH,
    MseGrant,
    ScrubGrant,
    ThumbGrant,
    VodGrant,
    sign,
    vod_ttl,
)
from .vodcache import Entry, Recording, VodCacheError, expected_size
from .wall import GRIDS, LayoutError

_LOGGER = logging.getLogger(__name__)

ERR_NOT_LOADED = "not_loaded"
ERR_INCOMPATIBLE = "incompatible"
ERR_PROBE_RUNNING = "probe_running"
ERR_NO_PLAYBACK = "no_playback"
ERR_SEARCH_FAILED = "search_failed"
ERR_CACHE_FAILED = "cache_failed"
ERR_NOT_LEARNING = "not_learning"
MAX_THUMB_TIMES = 200
MAX_RELEASE = 20
STREAM = probatio.In(["sub", "main"])


@callback
def async_register_commands(hass: HomeAssistant) -> None:
    """Register the websocket commands."""
    websocket_api.async_register_command(hass, ws_status)
    websocket_api.async_register_command(hass, ws_devices)
    websocket_api.async_register_command(hass, ws_device)
    websocket_api.async_register_command(hass, ws_catalog)
    websocket_api.async_register_command(hass, ws_probe)
    websocket_api.async_register_command(hass, ws_timeline_days)
    websocket_api.async_register_command(hass, ws_timeline_day)
    websocket_api.async_register_command(hass, ws_timeline_warm)
    websocket_api.async_register_command(hass, ws_events_recent)
    websocket_api.async_register_command(hass, ws_events_latest)
    websocket_api.async_register_command(hass, ws_events_days)
    websocket_api.async_register_command(hass, ws_events_seen)
    websocket_api.async_register_command(hass, ws_playback_url)
    websocket_api.async_register_command(hass, ws_playback_mse)
    websocket_api.async_register_command(hass, ws_playback_scrub)
    websocket_api.async_register_command(hass, ws_playback_prefetch)
    websocket_api.async_register_command(hass, ws_playback_release)
    websocket_api.async_register_command(hass, ws_thumbnail_urls)
    websocket_api.async_register_command(hass, ws_media_info)
    websocket_api.async_register_command(hass, ws_playback_peek)
    websocket_api.async_register_command(hass, ws_playback_online_users)
    websocket_api.async_register_command(hass, ws_playback_cache_status)
    websocket_api.async_register_command(hass, ws_playback_stats)
    websocket_api.async_register_command(hass, ws_check_report)
    websocket_api.async_register_command(hass, ws_check_reports)
    websocket_api.async_register_command(hass, ws_journal_status)
    websocket_api.async_register_command(hass, ws_unusual_check)
    websocket_api.async_register_command(hass, ws_unusual_events)
    websocket_api.async_register_command(hass, ws_unusual_marks)
    websocket_api.async_register_command(hass, ws_unusual_profile)
    websocket_api.async_register_command(hass, ws_wall_layouts)
    websocket_api.async_register_command(hass, ws_wall_layout_save)
    websocket_api.async_register_command(hass, ws_wall_layout_delete)


def _friendly(hass: HomeAssistant, entity_id: str) -> str:
    """Return what Home Assistant calls an entity (its entity id if nothing)."""
    state = hass.states.get(entity_id)
    name = state.attributes.get("friendly_name") if state is not None else None
    return str(name) if name else entity_id


def _loaded_entry(hass: HomeAssistant) -> ReolinkViewerConfigEntry | None:
    entries: list[ReolinkViewerConfigEntry] = hass.config_entries.async_loaded_entries(
        DOMAIN
    )
    return entries[0] if entries else None


@callback
@websocket_api.websocket_command({probatio.Required("type"): f"{DOMAIN}/status"})
def ws_status(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return the compatibility state and scheduler statistics."""
    if (entry := _loaded_entry(hass)) is None:
        connection.send_error(msg["id"], ERR_NOT_LOADED, "Reolink Viewer is not loaded")
        return
    compat = bridge.async_check_compat(hass)
    connection.send_result(
        msg["id"],
        {
            "compat": compat.as_dict(),
            "degraded": not compat.ok,
            "scheduler": entry.runtime_data.scheduler.stats(),
            "is_admin": bool(connection.user and connection.user.is_admin),
        },
    )


@callback
@websocket_api.websocket_command({probatio.Required("type"): f"{DOMAIN}/devices"})
def ws_devices(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """List Reolink devices: NVRs/Hubs and cameras, duplicates merged.

    In degraded mode (internals changed) the list comes from the device
    registry alone. ``version`` is the Reolink Viewer Home Assistant runs:
    the panel compares it with its own, to say when Home Assistant has not
    restarted since an update, or the page is an older one from the cache.
    """
    if _loaded_entry(hass) is None:
        connection.send_error(msg["id"], ERR_NOT_LOADED, "Reolink Viewer is not loaded")
        return
    compat, model = _device_call(
        hass, lambda degraded: devices.async_device_list(hass, degraded=degraded)
    )
    version = str(async_get_loaded_integration(hass, DOMAIN).version)
    connection.send_result(
        msg["id"], {**model, "compat": compat.as_dict(), "version": version}
    )


@websocket_api.websocket_command(
    {
        probatio.Required("type"): f"{DOMAIN}/device",
        probatio.Required("device_id"): str,
    }
)
@websocket_api.async_response
async def ws_device(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return one device with its details and entities, per connection."""
    if _loaded_entry(hass) is None:
        connection.send_error(msg["id"], ERR_NOT_LOADED, "Reolink Viewer is not loaded")
        return
    catalog = await async_get_catalog(hass)
    try:
        compat, result = _device_call(
            hass,
            lambda degraded: devices.async_device(
                hass, catalog, msg["device_id"], degraded=degraded
            ),
        )
    except devices.DeviceNotFoundError:
        connection.send_error(
            msg["id"], websocket_api.ERR_NOT_FOUND, "Reolink device not found"
        )
        return
    connection.send_result(msg["id"], {**result, "compat": compat.as_dict()})


@websocket_api.websocket_command({probatio.Required("type"): f"{DOMAIN}/catalog"})
@websocket_api.async_response
async def ws_catalog(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return the settings catalog and the categories."""
    catalog = await async_get_catalog(hass)
    connection.send_result(msg["id"], catalog.as_dict())


def _device_call[T](
    hass: HomeAssistant, build: Callable[[bool], T]
) -> tuple[bridge.CompatReport, T]:
    """Run a device-model builder, degrading if the bridge is incompatible or fails."""
    compat = bridge.async_check_compat(hass)
    if compat.ok:
        try:
            return compat, build(False)
        except devices.DeviceNotFoundError:
            raise
        except Exception as err:  # noqa: BLE001 - degrade rather than fail the panel
            _LOGGER.warning("Reolink bridge failed, using degraded mode: %s", err)
            compat = bridge.CompatReport(
                ok=False,
                errors=(*compat.errors, f"bridge error: {err}"),
                reolink_aio_version=compat.reolink_aio_version,
            )
    return compat, build(True)


def _redacted_error(err: Exception, hosts: list[bridge.ReolinkHostHandle]) -> str:
    """Return an error message safe to send to the browser."""
    secrets: list[str] = []
    for host in hosts:
        try:
            secrets.extend(host.secrets())
        except Exception:  # noqa: BLE001 - the regexes in redact_text still run
            _LOGGER.debug("Cannot collect secrets of %s", host.entry_id)
    return bridge.redact_text(str(err) or type(err).__name__, secrets)


@websocket_api.websocket_command(
    {
        probatio.Required("type"): f"{DOMAIN}/probe",
        probatio.Optional("entry_ids"): [str],
        probatio.Optional("include_battery", default=False): bool,
        probatio.Optional("concurrency_test", default=False): bool,
        probatio.Optional("max_streams", default=4): probatio.All(
            int, probatio.Range(min=1, max=PROBE_HARD_MAX_STREAMS)
        ),
        probatio.Optional("playback_test", default=False): bool,
        probatio.Optional("playback_only", default=False): bool,
        probatio.Optional("playback_concurrency_test", default=False): bool,
        probatio.Optional("playback_max_streams", default=4): probatio.All(
            int, probatio.Range(min=1, max=PROBE_PLAYBACK_HARD_MAX_STREAMS)
        ),
        probatio.Optional("baichuan_test", default=False): bool,
        probatio.Optional("baichuan_only", default=False): bool,
        probatio.Optional("baichuan_streams", default=["sub"]): [
            probatio.In(["sub", "main"])
        ],
        probatio.Optional("baichuan_download", default=True): bool,
        probatio.Optional("baichuan_session", default=False): bool,
        probatio.Optional("baichuan_scrub", default=False): bool,
        probatio.Optional("baichuan_cameras", default=""): probatio.All(
            str, probatio.Length(max=300)
        ),
        probatio.Optional("baichuan_hold", default=5): probatio.All(
            int, probatio.Range(min=1, max=120)
        ),
        probatio.Optional("baichuan_cut", default=20): probatio.All(
            int, probatio.Range(min=5, max=120)
        ),
        probatio.Optional("events_test", default=False): bool,
        probatio.Optional("events_only", default=False): bool,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_probe(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Run the hardware probe (admin only).

    This is a subscription: it sends ``progress`` events, then one ``result``
    event with the redacted report. Unsubscribing cancels the probe.
    """
    if (entry := _loaded_entry(hass)) is None:
        connection.send_error(msg["id"], ERR_NOT_LOADED, "Reolink Viewer is not loaded")
        return
    compat = bridge.async_check_compat(hass)
    if not compat.ok:
        connection.send_error(
            msg["id"],
            ERR_INCOMPATIBLE,
            "Reolink integration internals changed: " + "; ".join(compat.errors),
        )
        return
    data = entry.runtime_data
    if data.probe_lock.locked():
        connection.send_error(
            msg["id"], ERR_PROBE_RUNNING, "A probe is already running"
        )
        return

    try:
        hosts = bridge.async_get_hosts(hass)
    except bridge.IncompatibleError as err:
        connection.send_error(
            msg["id"],
            ERR_INCOMPATIBLE,
            f"Reolink integration internals changed: {err}",
        )
        return

    ffmpeg = get_ffmpeg_manager(hass)
    ffmpeg_version, _major = await ffmpeg.async_get_version()
    integration = await async_get_integration(hass, DOMAIN)
    options = ProbeOptions(
        entry_ids=msg.get("entry_ids"),
        include_battery=msg["include_battery"],
        concurrency_test=msg["concurrency_test"],
        max_streams=msg["max_streams"],
        playback=PlaybackOptions(
            enabled=msg["playback_test"],
            only=msg["playback_only"],
            concurrency_test=msg["playback_concurrency_test"],
            max_streams=msg["playback_max_streams"],
        ),
        baichuan=BaichuanOptions(
            enabled=msg["baichuan_test"],
            only=msg["baichuan_only"],
            hold_seconds=msg["baichuan_hold"],
            streams=tuple(msg["baichuan_streams"]),
            download=msg["baichuan_download"],
            session=msg["baichuan_session"],
            cameras=msg["baichuan_cameras"],
            cut_seconds=msg["baichuan_cut"],
            scrub=msg["baichuan_scrub"],
        ),
        events=EventsOptions(enabled=msg["events_test"], only=msg["events_only"]),
    )

    def progress(message: str) -> None:
        connection.send_message(
            websocket_api.event_message(
                msg["id"], {"type": "progress", "message": message}
            )
        )

    prober = Prober(
        data.scheduler,
        hosts,
        options=options,
        compat=compat,
        ffmpeg_binary=ffmpeg.binary,
        ffmpeg_version=ffmpeg_version,
        session=async_get_clientsession(
            hass, verify_ssl=False, ssl_cipher=SSLCipherList.INSECURE
        ),
        integration_version=str(integration.version),
        progress=progress,
    )

    async def run() -> None:
        async with data.probe_lock:
            try:
                report = await prober.async_run()
            except Exception as err:
                _LOGGER.exception("Reolink Viewer probe failed")
                connection.send_message(
                    websocket_api.event_message(
                        msg["id"],
                        {"type": "error", "message": _redacted_error(err, hosts)},
                    )
                )
                return
        connection.send_message(
            websocket_api.event_message(msg["id"], {"type": "result", "report": report})
        )

    # Ack first: the task starts eagerly and may send events right away.
    connection.send_result(msg["id"])
    task = entry.async_create_background_task(hass, run(), "reolink_viewer probe")
    connection.subscriptions[msg["id"]] = task.cancel


# ---- Playback ----


def _playback_source(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
    *,
    events: bool = False,
) -> tuple[ReolinkViewerConfigEntry, devices.PlaybackSource] | None:
    """Resolve the camera to its recording host, or send the error.

    ``events``: a camera whose recordings cannot be played here will do too
    (``devices.async_event_source``), for its days, events and pictures.
    """
    if (entry := _loaded_entry(hass)) is None:
        connection.send_error(msg["id"], ERR_NOT_LOADED, "Reolink Viewer is not loaded")
        return None
    compat = bridge.async_check_compat(hass)
    if not compat.ok:
        connection.send_error(
            msg["id"],
            ERR_INCOMPATIBLE,
            "Reolink integration internals changed: " + "; ".join(compat.errors),
        )
        return None
    try:
        lookup = devices.async_event_source if events else devices.async_playback_source
        return entry, lookup(hass, msg["device_id"])
    except devices.DeviceNotFoundError:
        connection.send_error(
            msg["id"], websocket_api.ERR_NOT_FOUND, "Reolink device not found"
        )
    except devices.NoPlaybackError:
        connection.send_error(
            msg["id"], ERR_NO_PLAYBACK, "This camera has no recordings HA can reach"
        )
    return None


def _date(value: str) -> date:
    return date.fromisoformat(value)


@websocket_api.websocket_command(
    {
        probatio.Required("type"): f"{DOMAIN}/timeline/days",
        probatio.Required("device_id"): str,
        probatio.Required("year"): probatio.All(int, probatio.Range(2000, 2100)),
        probatio.Required("month"): probatio.All(int, probatio.Range(1, 12)),
    }
)
@websocket_api.async_response
async def ws_timeline_days(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return the days of a month that have recordings (calendar dots)."""
    if (resolved := _playback_source(hass, connection, msg, events=True)) is None:
        return
    entry, source = resolved
    try:
        days, timing = await entry.runtime_data.timeline.async_days(
            source, msg["year"], msg["month"]
        )
    except TimelineError as err:
        connection.send_error(msg["id"], ERR_SEARCH_FAILED, str(err))
        return
    connection.send_result(msg["id"], {"days": days, "timing": timing})


@websocket_api.websocket_command(
    {
        probatio.Required("type"): f"{DOMAIN}/timeline/day",
        probatio.Required("device_id"): str,
        probatio.Required("date"): probatio.All(str, _date),
        probatio.Optional("stream", default="sub"): STREAM,
        # Accept a copy of today this many seconds old (then ask again).
        probatio.Optional("max_age", default=0): probatio.All(
            int, probatio.Range(min=0, max=86400)
        ),
        # A search ahead nobody waits for (the HD list, before HD is asked).
        probatio.Optional("background", default=False): bool,
    }
)
@websocket_api.async_response
async def ws_timeline_day(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return a camera-local day: recording segments and events, in UTC ms."""
    if (resolved := _playback_source(hass, connection, msg, events=True)) is None:
        return
    entry, source = resolved
    try:
        day, timing = await entry.runtime_data.timeline.async_day(
            source,
            msg["date"],
            msg["stream"],
            priority=Priority.PREFETCH if msg["background"] else Priority.PLAYBACK,
            max_age=msg["max_age"],
        )
    except TimelineError as err:
        connection.send_error(msg["id"], ERR_SEARCH_FAILED, str(err))
        return
    result = day.public(timing)
    result["now"] = epoch_ms(datetime.now(UTC))
    connection.send_result(msg["id"], result)


@callback
@websocket_api.websocket_command({probatio.Required("type"): f"{DOMAIN}/timeline/warm"})
def ws_timeline_warm(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Fetch today's timeline of every recording camera, at prefetch priority.

    Every camera the events feed lists (``async_event_sources``): those whose
    recordings cannot be played here too, for their events.
    """
    if (entry := _loaded_entry(hass)) is None:
        connection.send_error(msg["id"], ERR_NOT_LOADED, "Reolink Viewer is not loaded")
        return
    if not bridge.async_check_compat(hass).ok:
        connection.send_result(msg["id"], {"cameras": 0})
        return
    sources = devices.async_event_sources(hass)
    entry.async_create_background_task(
        hass, entry.runtime_data.timeline.async_warm(sources), "reolink_viewer warm"
    )
    connection.send_result(msg["id"], {"cameras": len(sources)})


@websocket_api.websocket_command(
    {
        probatio.Required("type"): f"{DOMAIN}/events/recent",
        # A camera-local day; by default each camera's today.
        probatio.Optional("date"): probatio.All(str, _date),
        # Accept copies of today this many seconds old (then ask again).
        probatio.Optional("max_age", default=0): probatio.All(
            int, probatio.Range(min=0, max=86400)
        ),
        # A refresh in the background: after what someone asked for.
        probatio.Optional("background", default=False): bool,
    }
)
@websocket_api.async_response
async def ws_events_recent(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return a day's events of every recording camera, newest first."""
    if (entry := _loaded_entry(hass)) is None:
        connection.send_error(msg["id"], ERR_NOT_LOADED, "Reolink Viewer is not loaded")
        return
    if not (compat := bridge.async_check_compat(hass)).ok:
        connection.send_error(
            msg["id"],
            ERR_INCOMPATIBLE,
            "Reolink integration internals changed: " + "; ".join(compat.errors),
        )
        return
    data = entry.runtime_data
    result = await events.async_recent(
        hass,
        data.timeline,
        data.seen,
        _user_id(connection),
        day=msg.get("date"),
        max_age=msg["max_age"],
        priority=Priority.PREFETCH if msg["background"] else Priority.PLAYBACK,
    )
    connection.send_result(msg["id"], result)


@websocket_api.websocket_command(
    {
        probatio.Required("type"): f"{DOMAIN}/events/latest",
        probatio.Optional("max_age", default=0): probatio.All(
            int, probatio.Range(min=0, max=86400)
        ),
        probatio.Optional("background", default=False): bool,
    }
)
@websocket_api.async_response
async def ws_events_latest(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return each recording camera's newest event (the Wall's strip, Phase 9.4)."""
    if (entry := _loaded_entry(hass)) is None:
        connection.send_error(msg["id"], ERR_NOT_LOADED, "Reolink Viewer is not loaded")
        return
    if not (compat := bridge.async_check_compat(hass)).ok:
        connection.send_error(
            msg["id"],
            ERR_INCOMPATIBLE,
            "Reolink integration internals changed: " + "; ".join(compat.errors),
        )
        return
    data = entry.runtime_data
    result = await events.async_latest(
        hass,
        data.timeline,
        data.seen,
        _user_id(connection),
        max_age=msg["max_age"],
        priority=Priority.PREFETCH if msg["background"] else Priority.PLAYBACK,
    )
    connection.send_result(msg["id"], result)


@websocket_api.websocket_command(
    {
        probatio.Required("type"): f"{DOMAIN}/events/days",
        probatio.Required("year"): probatio.All(int, probatio.Range(2000, 2100)),
        probatio.Required("month"): probatio.All(int, probatio.Range(1, 12)),
    }
)
@websocket_api.async_response
async def ws_events_days(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return the days of a month with recordings on any camera (calendar dots)."""
    if (entry := _loaded_entry(hass)) is None:
        connection.send_error(msg["id"], ERR_NOT_LOADED, "Reolink Viewer is not loaded")
        return
    if not (compat := bridge.async_check_compat(hass)).ok:
        connection.send_error(
            msg["id"],
            ERR_INCOMPATIBLE,
            "Reolink integration internals changed: " + "; ".join(compat.errors),
        )
        return
    result = await events.async_days(
        hass, entry.runtime_data.timeline, msg["year"], msg["month"]
    )
    connection.send_result(msg["id"], result)


@callback
@websocket_api.websocket_command(
    {
        probatio.Required("type"): f"{DOMAIN}/events/seen",
        probatio.Optional("camera_id"): str,
        probatio.Optional("start"): int,
        probatio.Optional("all", default=False): bool,
    }
)
def ws_events_seen(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Note that this user opened an event, or has seen everything until now."""
    if (entry := _loaded_entry(hass)) is None:
        connection.send_error(msg["id"], ERR_NOT_LOADED, "Reolink Viewer is not loaded")
        return
    seen = entry.runtime_data.seen
    now = events.now_ms()
    if msg["all"]:
        seen.all_seen(_user_id(connection), now)
    elif "camera_id" in msg and "start" in msg:
        seen.opened(_user_id(connection), msg["camera_id"], msg["start"], now)
    else:
        connection.send_error(
            msg["id"], websocket_api.ERR_INVALID_FORMAT, "camera_id and start, or all"
        )
        return
    connection.send_result(msg["id"], {})


def _user_id(connection: websocket_api.ActiveConnection) -> str:
    return connection.user.id if connection.user else ""


async def _recording(
    entry: ReolinkViewerConfigEntry,
    source: devices.PlaybackSource,
    msg: dict[str, Any],
) -> tuple[Recording, str]:
    timeline = entry.runtime_data.timeline
    segment = await timeline.async_segment(
        source, msg["date"], msg["stream"], msg["segment_id"]
    )
    recording = Recording(
        source=source,
        stream=msg["stream"],
        name=segment.name,
        start_ms=segment.start,
        end_ms=segment.end,
        size=segment.size,
    )
    return recording, str(segment.start)


def _download_name(source: devices.PlaybackSource, recording: Recording) -> str:
    slug = re.sub(r"[^A-Za-z0-9]+", "-", source.name).strip("-").lower() or "camera"
    when = datetime.fromtimestamp(recording.start_ms / 1000, UTC)
    return f"{slug}-{when:%Y%m%d-%H%M%SZ}-{recording.stream}.mp4"


_SEGMENT_SCHEMA: dict[probatio.Marker | str, Any] = {
    probatio.Required("device_id"): str,
    probatio.Required("date"): probatio.All(str, _date),
    probatio.Required("segment_id"): str,
    probatio.Optional("stream", default="sub"): STREAM,
}


async def _open_for_playback(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> tuple[ReolinkViewerConfigEntry, devices.PlaybackSource, Entry, str] | None:
    """Start caching the recording a command asks for (errors are sent)."""
    if (resolved := _playback_source(hass, connection, msg)) is None:
        return None
    entry, source = resolved
    try:
        recording, segment_id = await _recording(entry, source, msg)
        cache_entry = await entry.runtime_data.vod_cache.async_open(
            recording, Priority.PLAYBACK, at=msg.get("at")
        )
    except TimelineError as err:
        connection.send_error(msg["id"], ERR_SEARCH_FAILED, str(err))
        return None
    except VodCacheError as err:
        connection.send_error(msg["id"], ERR_CACHE_FAILED, str(err))
        return None
    return entry, source, cache_entry, segment_id


def _playback_result(
    hass: HomeAssistant,
    entry: ReolinkViewerConfigEntry,
    source: devices.PlaybackSource,
    cache_entry: Entry,
    segment_id: str,
    *,
    grant: VodGrant | MseGrant,
) -> tuple[dict[str, Any], str]:
    """Issue the player's grant, leased; return what both players need.

    Also a signed clip URL. Returns the result and the grant's token.
    """
    data = entry.runtime_data
    # The copy may be one made when the recording was shorter.
    recording = cache_entry.recording
    # The recording stays on disk until the player's URL expires, is
    # released (the player moved on) or is not used for a while.
    ttl = vod_ttl(recording)
    token = data.grants.issue(grant, ttl)
    data.vod_cache.lease(cache_entry, ttl.total_seconds(), token)
    clip = VodGrant(recording, False, _download_name(source, recording))
    return {
        "clip_url": sign(hass, CLIP_PATH, data.grants.issue(clip, ttl), ttl),
        "stream": recording.stream,
        "segment_id": segment_id,
        "start": recording.start_ms,
        "end": recording.end_ms,
        "media": data.vod_cache.media_info(source, recording.stream),
        "cache": cache_entry.public(),
        "expires_in": int(ttl.total_seconds()),
    }, token


@websocket_api.websocket_command(
    {
        probatio.Required("type"): f"{DOMAIN}/playback/url",
        **_SEGMENT_SCHEMA,
        probatio.Optional("progressive", default=True): bool,
        # Where playback will start (UTC ms): a shorter copy of a recording
        # still being written serves it if it reaches that far.
        probatio.Optional("at"): int,
    }
)
@websocket_api.async_response
async def ws_playback_url(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Start caching a recording; return signed URLs for the file player."""
    began = time.monotonic()
    if (opened := await _open_for_playback(hass, connection, msg)) is None:
        return
    entry, source, cache_entry, segment_id = opened
    recording = cache_entry.recording
    # A progressive URL plays the original from its start while it downloads;
    # any other gets the plain copy, which browsers seek in without reading
    # the whole file first.
    progressive = msg["progressive"]
    grant = VodGrant(
        recording,
        progressive,
        _download_name(source, recording),
        plain=not progressive,
    )
    result, token = _playback_result(
        hass, entry, source, cache_entry, segment_id, grant=grant
    )
    result["url"] = sign(hass, VOD_PATH, token, vod_ttl(recording))
    result["file"] = "original" if progressive else "plain"
    result["timing"] = {"total_ms": round((time.monotonic() - began) * 1000, 1)}
    connection.send_result(msg["id"], result)


@websocket_api.websocket_command(
    {
        probatio.Required("type"): f"{DOMAIN}/playback/mse",
        **_SEGMENT_SCHEMA,
        probatio.Optional("at"): int,
    }
)
@websocket_api.async_response
async def ws_playback_mse(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Start caching a recording; return the MSE player's fragment path.

    The player fetches ``{base}/init`` and ``{base}/frags?...`` with HA's
    authentication (the path is not signed: a window's query varies).
    """
    began = time.monotonic()
    if (opened := await _open_for_playback(hass, connection, msg)) is None:
        return
    entry, source, cache_entry, segment_id = opened
    grant = MseGrant(cache_entry.recording)
    result, token = _playback_result(
        hass, entry, source, cache_entry, segment_id, grant=grant
    )
    result["base"] = f"{MSE_PATH}/{token}"
    result["timing"] = {"total_ms": round((time.monotonic() - began) * 1000, 1)}
    connection.send_result(msg["id"], result)


@callback
@websocket_api.websocket_command(
    {
        probatio.Required("type"): f"{DOMAIN}/playback/scrub",
        probatio.Required("device_id"): str,
        probatio.Required("date"): probatio.All(str, _date),
    }
)
def ws_playback_scrub(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Open a scrub session for a camera's day (Phase 10): its signed path.

    The browser opens it as a websocket and asks it for the picture at each
    moment the pointer passes (``views.ScrubView``).
    """
    if (resolved := _playback_source(hass, connection, msg)) is None:
        return
    entry, source = resolved
    if entry.runtime_data.scrub is None:
        connection.send_error(msg["id"], ERR_NOT_LOADED, "Scrubbing is not available")
        return
    token = entry.runtime_data.grants.issue(ScrubGrant(source, msg["date"]), SCRUB_TTL)
    connection.send_result(
        msg["id"],
        {
            "url": sign(hass, SCRUB_PATH, token, SCRUB_TTL),
            "expires_in": int(SCRUB_TTL.total_seconds()),
        },
    )


@websocket_api.websocket_command(
    {probatio.Required("type"): f"{DOMAIN}/playback/prefetch", **_SEGMENT_SCHEMA}
)
@websocket_api.async_response
async def ws_playback_prefetch(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Start caching a recording at prefetch priority (next file, warm hours)."""
    if (resolved := _playback_source(hass, connection, msg)) is None:
        return
    entry, source = resolved
    try:
        recording, segment_id = await _recording(entry, source, msg)
        cache_entry = await entry.runtime_data.vod_cache.async_open(
            recording, Priority.PREFETCH, any_copy=True
        )
    except TimelineError as err:
        connection.send_error(msg["id"], ERR_SEARCH_FAILED, str(err))
        return
    except VodCacheError as err:
        connection.send_error(msg["id"], ERR_CACHE_FAILED, str(err))
        return
    connection.send_result(
        msg["id"], {"segment_id": segment_id, "cache": cache_entry.public()}
    )


@callback
@websocket_api.websocket_command(
    {
        probatio.Required("type"): f"{DOMAIN}/playback/release",
        probatio.Required("tokens"): probatio.All(
            [str], probatio.Length(max=MAX_RELEASE)
        ),
    }
)
def ws_playback_release(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """End the leases of a player's URLs (by token): it moved on.

    The URLs keep working until they expire; their recordings may be evicted.
    """
    if (entry := _loaded_entry(hass)) is None:
        connection.send_error(msg["id"], ERR_NOT_LOADED, "Reolink Viewer is not loaded")
        return
    for token in msg["tokens"]:
        entry.runtime_data.vod_cache.release(token)
    connection.send_result(msg["id"])


@callback
@websocket_api.websocket_command(
    {
        probatio.Required("type"): f"{DOMAIN}/thumbnail/urls",
        probatio.Required("device_id"): str,
        probatio.Required("times"): [int],
        probatio.Optional("bucket", default=10): probatio.All(
            int, probatio.Range(min=min(BUCKETS_S), max=max(BUCKETS_S))
        ),
        probatio.Optional("stream", default="sub"): STREAM,
    }
)
def ws_thumbnail_urls(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return signed thumbnail URLs for times (one per bucket)."""
    if (resolved := _playback_source(hass, connection, msg, events=True)) is None:
        return
    entry, source = resolved
    data = entry.runtime_data
    urls = []
    for when in msg["times"][:MAX_THUMB_TIMES]:
        key = data.thumbnails.key(source, when, msg["bucket"], msg["stream"])
        token = data.grants.issue(ThumbGrant(key), THUMB_TTL)
        urls.append(
            {
                "time": when,
                "bucket": key.bucket_ms,
                "url": sign(hass, THUMB_PATH, token, THUMB_TTL),
            }
        )
    connection.send_result(msg["id"], {"urls": urls})


@callback
@websocket_api.websocket_command(
    {
        probatio.Required("type"): f"{DOMAIN}/playback/media_info",
        probatio.Required("device_id"): str,
    }
)
def ws_media_info(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return the codec and size last seen for each stream of a camera."""
    if (resolved := _playback_source(hass, connection, msg)) is None:
        return
    entry, source = resolved
    cache = entry.runtime_data.vod_cache
    connection.send_result(
        msg["id"],
        {stream: cache.media_info(source, stream) for stream in ("main", "sub")},
    )


# ---- Playback check (debug) ----


@websocket_api.websocket_command(
    {probatio.Required("type"): f"{DOMAIN}/playback/peek", **_SEGMENT_SCHEMA}
)
@websocket_api.async_response
async def ws_playback_peek(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return what the cache holds of a recording, without fetching it."""
    if (resolved := _playback_source(hass, connection, msg)) is None:
        return
    entry, source = resolved
    try:
        recording, segment_id = await _recording(entry, source, msg)
    except TimelineError as err:
        connection.send_error(msg["id"], ERR_SEARCH_FAILED, str(err))
        return
    cache = await entry.runtime_data.vod_cache.async_peek(recording)
    connection.send_result(msg["id"], {"segment_id": segment_id, "cache": cache})


# The playback check's V row waits this long for the device's list of users (s).
ONLINE_USERS_TIMEOUT_S = 10.0


@websocket_api.websocket_command(
    {
        probatio.Required("type"): f"{DOMAIN}/playback/online_users",
        probatio.Required("device_id"): str,
    }
)
@websocket_api.async_response
async def ws_playback_online_users(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return how many clients the camera's recording host lists as logged in.

    The playback check's V row (Phase 5's two-viewer check, automated): read
    at rest, while two viewers play, and after they stop, to see Home
    Assistant's extra sessions go. ``count`` is None, with ``error``, when the
    device does not say.
    """
    if (resolved := _playback_source(hass, connection, msg)) is None:
        return
    entry, source = resolved
    try:
        host = bridge.async_get_host(hass, source.entry_id)
    except bridge.HostNotFoundError:
        connection.send_error(
            msg["id"], websocket_api.ERR_NOT_FOUND, "Reolink host not loaded"
        )
        return
    try:
        count, why = await entry.runtime_data.scheduler.run(
            source.entry_id,
            host.async_online_users,
            priority=Priority.SETTINGS,
            timeout=ONLINE_USERS_TIMEOUT_S,
        )
    except TimeoutError:
        count, why = None, "the device did not answer in time"
    connection.send_result(msg["id"], {"count": count, "error": why})


@callback
@websocket_api.websocket_command(
    {
        probatio.Required("type"): f"{DOMAIN}/playback/cache_status",
        probatio.Required("token"): str,
    }
)
def ws_playback_cache_status(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return the download of the copy a URL was issued for, and its size.

    For the player's progress while it waits, and the check's report (the
    current search may name a newer copy of a recording still being written).
    """
    if (entry := _loaded_entry(hass)) is None:
        connection.send_error(msg["id"], ERR_NOT_LOADED, "Reolink Viewer is not loaded")
        return
    data = entry.runtime_data
    grant = data.grants.get(msg["token"], MseGrant) or data.grants.get(
        msg["token"], VodGrant
    )
    if grant is None:
        connection.send_error(
            msg["id"], websocket_api.ERR_NOT_FOUND, "Unknown or expired URL"
        )
        return
    cache_entry = data.vod_cache.entry(grant.recording)
    connection.send_result(
        msg["id"],
        {
            "cache": cache_entry.public() if cache_entry is not None else None,
            "expected_bytes": expected_size(grant.recording),
        },
    )


@websocket_api.websocket_command(
    {probatio.Required("type"): f"{DOMAIN}/playback/stats"}
)
@websocket_api.async_response
async def ws_playback_stats(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return the recording and thumbnail caches' statistics (disk use now)."""
    if (entry := _loaded_entry(hass)) is None:
        connection.send_error(msg["id"], ERR_NOT_LOADED, "Reolink Viewer is not loaded")
        return
    data = entry.runtime_data
    # Reading the statistics keeps the loop's timer running a while (v0.62.2).
    if data.loop is not None:
        data.loop.watch()
    connection.send_result(
        msg["id"],
        {
            "vod": await data.vod_cache.async_stats(),
            "thumbnails": data.thumbnails.stats(),
            "scrub": data.scrub.stats() if data.scrub is not None else None,
            "loop": data.loop.snapshot() if data.loop is not None else None,
        },
    )


@callback
@websocket_api.websocket_command(
    {
        probatio.Required("type"): f"{DOMAIN}/playback/check_report",
        probatio.Required("report_id"): probatio.All(
            str, probatio.Length(min=1, max=64)
        ),
        probatio.Required("setup"): probatio.All(str, probatio.Length(max=200)),
        probatio.Required("text"): probatio.All(str, probatio.Length(max=MAX_TEXT)),
        probatio.Optional("done", default=False): bool,
    }
)
def ws_check_report(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Save (or update) a playback check report."""
    if (entry := _loaded_entry(hass)) is None:
        connection.send_error(msg["id"], ERR_NOT_LOADED, "Reolink Viewer is not loaded")
        return
    entry.runtime_data.check_reports.save(
        msg["report_id"], msg["setup"], msg["text"], msg["done"]
    )
    connection.send_result(msg["id"])


@callback
@websocket_api.websocket_command(
    {probatio.Required("type"): f"{DOMAIN}/playback/check_reports"}
)
def ws_check_reports(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return the saved playback check reports, newest first."""
    if (entry := _loaded_entry(hass)) is None:
        connection.send_error(msg["id"], ERR_NOT_LOADED, "Reolink Viewer is not loaded")
        return
    connection.send_result(
        msg["id"], {"reports": entry.runtime_data.check_reports.reports()}
    )


@websocket_api.websocket_command(
    {probatio.Required("type"): f"{DOMAIN}/journal/status"}
)
@websocket_api.async_response
async def ws_journal_status(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return whether the detection journal records, and what it holds (Phase 8)."""
    entry = _loaded_entry(hass)
    if entry is None:
        connection.send_error(msg["id"], ERR_NOT_LOADED, "Reolink Viewer is not loaded")
        return
    journal = entry.runtime_data.journal
    if journal is None or not journal.running:
        connection.send_result(msg["id"], {"enabled": False})
        return
    status: dict[str, Any] = {"enabled": True, **await journal.async_status()}
    # The house-wide signals learned with now (one no longer chosen is kept, unread).
    status["signals"] = [
        {**signal, "name": _friendly(hass, signal["entity_id"])}
        for signal in status.get("signals", [])
        if signal["entity_id"] in journal.signals
    ]
    # Phase 8 step 2: what the model makes of each camera, and its marks.
    if (unusual := entry.runtime_data.unusual) is not None:
        status["unusual"] = await unusual.async_status(
            [camera["id"] for camera in status["cameras"]]
        )
    connection.send_result(msg["id"], status)


# The longest window scored at once (a week of a busy property: about a second).
UNUSUAL_MAX_SPAN_MS = 7 * 86_400_000


@websocket_api.websocket_command({probatio.Required("type"): f"{DOMAIN}/unusual/check"})
@websocket_api.async_response
async def ws_unusual_check(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return the learning check (Phase 8's hand checks, automated).

    Whether it learns and with which house-wide signals; the panel's marks
    since the log of fired events began (at most a week), each with what
    fired for it and how soon; what fired for no mark; and the automations
    listening, with which of them ran on each.
    """
    entry = _loaded_entry(hass)
    if entry is None:
        connection.send_error(msg["id"], ERR_NOT_LOADED, "Reolink Viewer is not loaded")
        return
    data = entry.runtime_data
    journal, unusual, fired = data.journal, data.unusual, data.fired
    if journal is None or not journal.running or unusual is None or fired is None:
        connection.send_result(msg["id"], {"enabled": False})
        return
    now = time.time()
    since = max(fired.since or now, now - UNUSUAL_MAX_SPAN_MS / 1000)
    await journal.async_flush()
    status = await journal.async_status()
    learned = {s["entity_id"]: s for s in status.get("signals", [])}
    signals = []
    for entity_id in journal.signals:
        state = hass.states.get(entity_id)
        signals.append(
            {
                "entity_id": entity_id,
                "name": _friendly(hass, entity_id),
                "state": None if state is None else state.state,
                "changes": learned.get(entity_id, {}).get("changes", 0),
            }
        )
    marks = await unusual.async_marks(since=since, until=now)
    matched, unmarked = unusual_check.compare(marks, fired.entries(since))
    # The panel's marks are scored with the model of now; what fired before it
    # was built was scored with the one before, and may differ (v0.63.13).
    built_at = unusual.model.built_at
    # Who listens: the device trigger (Reolink Viewer's own device), a camera's
    # "Unusual activity" sensor, or an event trigger.
    device = dr.async_get(hass).async_get_device(identifiers={UNUSUAL_DEVICE})
    sensors = [
        e.entity_id
        for e in er.async_entries_for_config_entry(er.async_get(hass), entry.entry_id)
        if e.unique_id.endswith(UNUSUAL_SENSOR_SUFFIX)
    ]
    listening = unusual_check.listening(
        hass, [device.id] if device is not None else [], sensors
    )
    automations = []
    for entity_id, how in sorted(listening.items()):
        state = hass.states.get(entity_id)
        automations.append(
            {
                "entity_id": entity_id,
                "name": _friendly(hass, entity_id),
                "how": how,
                "on": state is not None and state.state == "on",
                "last_triggered": None
                if state is None
                else state.attributes.get("last_triggered"),
            }
        )
    connection.send_result(
        msg["id"],
        {
            "enabled": True,
            "built": bool(built_at),
            "built_at": int(built_at * 1000) if built_at else None,
            "since": int(since * 1000),
            "until": int(now * 1000),
            "signals": signals,
            "marks": matched,
            "unmarked": [
                {
                    "camera": event["camera"],
                    "kind": event["kind"],
                    "start": int(event["start"] * 1000),
                    "delay": round(event["fired"] - event["start"], 1),
                    "relearned": bool(built_at) and event["fired"] < built_at,
                }
                for event in unmarked
            ],
            "automations": automations,
            "prompt_s": unusual_check.PROMPT_S,
        },
    )


@websocket_api.websocket_command(
    {
        probatio.Required("type"): f"{DOMAIN}/unusual/events",
        probatio.Required("since"): int,
        probatio.Required("until"): int,
        probatio.Optional("camera"): str,
        probatio.Optional("unusual_only", default=False): bool,
    }
)
@websocket_api.async_response
async def ws_unusual_events(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return the journal's events in [since, until) (epoch ms), each scored (Phase 8).

    Each with its sentence and every signal's contribution; while a camera is
    still learning, its events are scored and none is unusual.
    """
    entry = _loaded_entry(hass)
    if entry is None:
        connection.send_error(msg["id"], ERR_NOT_LOADED, "Reolink Viewer is not loaded")
        return
    journal, unusual = entry.runtime_data.journal, entry.runtime_data.unusual
    if journal is None or not journal.running or unusual is None:
        connection.send_error(
            msg["id"], ERR_NOT_LEARNING, "Learn what is normal is off"
        )
        return
    since, until = msg["since"], msg["until"]
    if not 0 < until - since <= UNUSUAL_MAX_SPAN_MS:
        connection.send_error(
            msg["id"],
            websocket_api.ERR_INVALID_FORMAT,
            "until must be after since, by at most 7 days",
        )
        return
    # What is pending in the journal, so the last minute is scored too.
    await journal.async_flush()
    scored = await unusual.async_window(
        since=since / 1000, until=until / 1000, camera=msg.get("camera")
    )
    # Each event with its incident's number (the same kind on several cameras
    # within a minute is one incident).
    events: list[dict[str, Any]] = []
    for number, group in enumerate(incidents(scored)):
        events.extend(
            {**mark_payload(event, result), "incident": number}
            for event, result in group
            if result.unusual or not msg["unusual_only"]
        )
    events.sort(key=lambda payload: payload["start"])
    connection.send_result(msg["id"], {"events": events})


@websocket_api.websocket_command(
    {
        probatio.Required("type"): f"{DOMAIN}/unusual/marks",
        probatio.Required("since"): int,
        probatio.Required("until"): int,
    }
)
@websocket_api.async_response
async def ws_unusual_marks(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return the incidents marked unusual in [since, until) (epoch ms), for the panel.

    Each with its sentence, its signals and every camera's event in it; and
    whether each camera marks yet. Learning off is no error: nothing is marked.
    """
    entry = _loaded_entry(hass)
    if entry is None:
        connection.send_error(msg["id"], ERR_NOT_LOADED, "Reolink Viewer is not loaded")
        return
    journal, unusual = entry.runtime_data.journal, entry.runtime_data.unusual
    if journal is None or not journal.running or unusual is None:
        connection.send_result(
            msg["id"], {"enabled": False, "marks": [], "cameras": {}}
        )
        return
    since, until = msg["since"], msg["until"]
    if not 0 < until - since <= UNUSUAL_MAX_SPAN_MS:
        connection.send_error(
            msg["id"],
            websocket_api.ERR_INVALID_FORMAT,
            "until must be after since, by at most 7 days",
        )
        return
    await journal.async_flush()
    marks = await unusual.async_marks(since=since / 1000, until=until / 1000)
    cameras = {*unusual.model.per_camera, *unusual.names}
    connection.send_result(
        msg["id"],
        {
            "enabled": True,
            "built": bool(unusual.model.built_at),
            "marks": marks,
            "cameras": {camera: unusual.state(camera) for camera in sorted(cameras)},
        },
    )


@websocket_api.websocket_command(
    {
        probatio.Required("type"): f"{DOMAIN}/unusual/profile",
        probatio.Required("camera_id"): str,
    }
)
@callback
def ws_unusual_profile(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return what one camera has learned (Phase 8.3), and whether it marks yet.

    Per kind it has seen: when, for how long, what fired first and on which days.
    Read off the model in memory (built nightly), so it costs nothing to ask.
    Learning off is no error: nothing has been learned.
    """
    entry = _loaded_entry(hass)
    if entry is None:
        connection.send_error(msg["id"], ERR_NOT_LOADED, "Reolink Viewer is not loaded")
        return
    journal, unusual = entry.runtime_data.journal, entry.runtime_data.unusual
    if journal is None or not journal.running or unusual is None:
        connection.send_result(msg["id"], {"enabled": False})
        return
    camera = msg["camera_id"]
    model = unusual.model
    connection.send_result(
        msg["id"],
        {
            "enabled": True,
            "built": bool(model.built_at),
            "state": unusual.state(camera),
            **profile_payload(
                model,
                [camera],
                names=unusual.names,
                label=lambda entity_id: _friendly(hass, entity_id),
            ),
        },
    )


@callback
@websocket_api.websocket_command({probatio.Required("type"): f"{DOMAIN}/wall/layouts"})
def ws_wall_layouts(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return this user's saved Wall layouts (Phase 9)."""
    entry = _loaded_entry(hass)
    if entry is None or entry.runtime_data.wall is None:
        connection.send_error(msg["id"], ERR_NOT_LOADED, "Reolink Viewer is not loaded")
        return
    connection.send_result(
        msg["id"],
        {"layouts": entry.runtime_data.wall.layouts(_user_id(connection))},
    )


@callback
@websocket_api.websocket_command(
    {
        probatio.Required("type"): f"{DOMAIN}/wall/layouts/save",
        # Not "id": that is the message's own.
        probatio.Optional("layout_id"): str,
        probatio.Required("name"): str,
        probatio.Required("grid"): probatio.In(GRIDS),
        probatio.Optional("cameras", default=[]): [probatio.Any(str, None)],
        probatio.Optional("tour_s"): probatio.Any(int, None),
        # Phase 9 step 4: the feeds' floodlight and siren buttons, the strip.
        probatio.Optional("floodlight"): bool,
        probatio.Optional("siren"): bool,
        probatio.Optional("strip"): bool,
    }
)
def ws_wall_layout_save(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Keep one of this user's Wall layouts (a new one without an id); return it."""
    entry = _loaded_entry(hass)
    if entry is None or entry.runtime_data.wall is None:
        connection.send_error(msg["id"], ERR_NOT_LOADED, "Reolink Viewer is not loaded")
        return
    raw = {k: v for k, v in msg.items() if k not in ("type", "id", "layout_id")}
    if msg.get("layout_id"):
        raw["id"] = msg["layout_id"]
    try:
        layout = entry.runtime_data.wall.save(_user_id(connection), raw)
    except LayoutError as err:
        connection.send_error(msg["id"], websocket_api.ERR_INVALID_FORMAT, str(err))
        return
    connection.send_result(msg["id"], {"layout": layout})


@callback
@websocket_api.websocket_command(
    {
        probatio.Required("type"): f"{DOMAIN}/wall/layouts/delete",
        probatio.Required("layout_id"): str,
    }
)
def ws_wall_layout_delete(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Forget one of this user's Wall layouts."""
    entry = _loaded_entry(hass)
    if entry is None or entry.runtime_data.wall is None:
        connection.send_error(msg["id"], ERR_NOT_LOADED, "Reolink Viewer is not loaded")
        return
    entry.runtime_data.wall.delete(_user_id(connection), msg["layout_id"])
    connection.send_result(msg["id"], {})

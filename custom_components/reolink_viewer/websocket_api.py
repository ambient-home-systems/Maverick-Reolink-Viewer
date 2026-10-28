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
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.loader import async_get_integration
from homeassistant.util.ssl import SSLCipherList

from . import bridge, devices, events
from .catalog import async_get_catalog
from .checks import MAX_TEXT
from .const import DOMAIN, PROBE_HARD_MAX_STREAMS, PROBE_PLAYBACK_HARD_MAX_STREAMS
from .models import ReolinkViewerConfigEntry
from .probe import ProbeOptions, Prober
from .probe_playback import PlaybackOptions
from .scheduler import Priority
from .thumbnails import BUCKETS_S
from .timeconv import epoch_ms
from .timeline import TimelineError
from .views import (
    CLIP_PATH,
    MSE_PATH,
    THUMB_PATH,
    THUMB_TTL,
    VOD_PATH,
    MseGrant,
    ThumbGrant,
    VodGrant,
    sign,
    vod_ttl,
)
from .vodcache import Entry, Recording, VodCacheError, expected_size

_LOGGER = logging.getLogger(__name__)

ERR_NOT_LOADED = "not_loaded"
ERR_INCOMPATIBLE = "incompatible"
ERR_PROBE_RUNNING = "probe_running"
ERR_NO_PLAYBACK = "no_playback"
ERR_SEARCH_FAILED = "search_failed"
ERR_CACHE_FAILED = "cache_failed"
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
    websocket_api.async_register_command(hass, ws_events_seen)
    websocket_api.async_register_command(hass, ws_playback_url)
    websocket_api.async_register_command(hass, ws_playback_mse)
    websocket_api.async_register_command(hass, ws_playback_prefetch)
    websocket_api.async_register_command(hass, ws_playback_release)
    websocket_api.async_register_command(hass, ws_thumbnail_urls)
    websocket_api.async_register_command(hass, ws_media_info)
    websocket_api.async_register_command(hass, ws_playback_peek)
    websocket_api.async_register_command(hass, ws_playback_cache_status)
    websocket_api.async_register_command(hass, ws_playback_stats)
    websocket_api.async_register_command(hass, ws_check_report)
    websocket_api.async_register_command(hass, ws_check_reports)


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
    registry alone.
    """
    if _loaded_entry(hass) is None:
        connection.send_error(msg["id"], ERR_NOT_LOADED, "Reolink Viewer is not loaded")
        return
    compat, model = _device_call(
        hass, lambda degraded: devices.async_device_list(hass, degraded=degraded)
    )
    connection.send_result(msg["id"], {**model, "compat": compat.as_dict()})


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
) -> tuple[ReolinkViewerConfigEntry, devices.PlaybackSource] | None:
    """Resolve the camera to its recording host, or send the error."""
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
        return entry, devices.async_playback_source(hass, msg["device_id"])
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
    if (resolved := _playback_source(hass, connection, msg)) is None:
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
    }
)
@websocket_api.async_response
async def ws_timeline_day(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return a camera-local day: recording segments and events, in UTC ms."""
    if (resolved := _playback_source(hass, connection, msg)) is None:
        return
    entry, source = resolved
    try:
        day, timing = await entry.runtime_data.timeline.async_day(
            source, msg["date"], msg["stream"], max_age=msg["max_age"]
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
    """Fetch today's timeline of every recording camera, at prefetch priority."""
    if (entry := _loaded_entry(hass)) is None:
        connection.send_error(msg["id"], ERR_NOT_LOADED, "Reolink Viewer is not loaded")
        return
    if not bridge.async_check_compat(hass).ok:
        connection.send_result(msg["id"], {"cameras": 0})
        return
    sources = devices.async_playback_sources(hass)
    entry.async_create_background_task(
        hass, entry.runtime_data.timeline.async_warm(sources), "reolink_viewer warm"
    )
    connection.send_result(msg["id"], {"cameras": len(sources)})


@websocket_api.websocket_command(
    {
        probatio.Required("type"): f"{DOMAIN}/events/recent",
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
    """Return today's events of every recording camera, newest first."""
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
        max_age=msg["max_age"],
        priority=Priority.PREFETCH if msg["background"] else Priority.PLAYBACK,
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
    if (resolved := _playback_source(hass, connection, msg)) is None:
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
    connection.send_result(
        msg["id"],
        {
            "vod": await data.vod_cache.async_stats(),
            "thumbnails": data.thumbnails.stats(),
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

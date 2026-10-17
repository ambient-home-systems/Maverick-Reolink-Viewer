"""Websocket commands for the Reolink Viewer panel."""

from collections.abc import Callable
import logging
from typing import Any

import probatio

from homeassistant.components import websocket_api
from homeassistant.components.ffmpeg import get_ffmpeg_manager
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.loader import async_get_integration
from homeassistant.util.ssl import SSLCipherList

from . import bridge, devices
from .catalog import async_get_catalog
from .const import DOMAIN, PROBE_HARD_MAX_STREAMS
from .models import ReolinkViewerConfigEntry
from .probe import ProbeOptions, Prober

_LOGGER = logging.getLogger(__name__)

ERR_NOT_LOADED = "not_loaded"
ERR_INCOMPATIBLE = "incompatible"
ERR_PROBE_RUNNING = "probe_running"


@callback
def async_register_commands(hass: HomeAssistant) -> None:
    """Register the websocket commands."""
    websocket_api.async_register_command(hass, ws_status)
    websocket_api.async_register_command(hass, ws_devices)
    websocket_api.async_register_command(hass, ws_device)
    websocket_api.async_register_command(hass, ws_catalog)
    websocket_api.async_register_command(hass, ws_probe)


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

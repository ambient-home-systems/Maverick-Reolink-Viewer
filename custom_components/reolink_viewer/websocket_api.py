"""Websocket commands for the Reolink Viewer panel."""

import logging
from typing import Any

import probatio

from homeassistant.components import websocket_api
from homeassistant.components.ffmpeg import get_ffmpeg_manager
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.loader import async_get_integration
from homeassistant.util.ssl import SSLCipherList

from . import bridge
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
    """List Reolink hosts and channels from the bridge.

    In degraded mode (internals changed) fall back to the public device registry.
    """
    if _loaded_entry(hass) is None:
        connection.send_error(msg["id"], ERR_NOT_LOADED, "Reolink Viewer is not loaded")
        return
    compat = bridge.async_check_compat(hass)
    if compat.ok:
        try:
            hosts = [host.info().as_dict() for host in bridge.async_get_hosts(hass)]
        except Exception as err:  # noqa: BLE001 - degrade rather than fail the panel
            _LOGGER.warning("Reolink bridge failed, using degraded mode: %s", err)
            compat = bridge.CompatReport(
                ok=False,
                errors=(*compat.errors, f"bridge error: {err}"),
                reolink_aio_version=compat.reolink_aio_version,
            )
        else:
            connection.send_result(
                msg["id"],
                {"degraded": False, "compat": compat.as_dict(), "hosts": hosts},
            )
            return
    connection.send_result(
        msg["id"],
        {
            "degraded": True,
            "compat": compat.as_dict(),
            "hosts": [],
            "devices": bridge.async_list_devices_degraded(hass),
        },
    )


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
        bridge.async_get_hosts(hass),
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
                        msg["id"], {"type": "error", "message": str(err)}
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

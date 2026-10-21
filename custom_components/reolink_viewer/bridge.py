"""Adapter over the Reolink integration's internals.

This is the ONLY module that may import from ``homeassistant.components.reolink``
or read ``config_entry.runtime_data`` of a Reolink entry. Everything else gets
the typed views defined here.

The Reolink integration's runtime data is internal to it and can change in any
HA release, so :func:`async_check_compat` verifies the shape we depend on and the
rest of the integration falls back to a degraded mode (public device registry
only) when it fails.

Methods on :class:`ReolinkHostHandle` that perform device I/O are prefixed with
``async_`` and must be called through ``scheduler.py``.
"""

import asyncio
from collections.abc import Awaitable, Callable, Iterable
from dataclasses import asdict, dataclass, field, fields, is_dataclass
from datetime import date, datetime, tzinfo
from enum import StrEnum
import hashlib
import importlib
from importlib.metadata import PackageNotFoundError, version
import logging
import re
import time
from typing import TYPE_CHECKING, Any, cast

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_HOST, CONF_PASSWORD, CONF_USERNAME
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import device_registry as dr

from .const import REOLINK_DOMAIN

if TYPE_CHECKING:
    from reolink_aio.api import Host

_LOGGER = logging.getLogger(__name__)

# The NVR's event search fails now and then and works when asked again.
EVENT_SEARCH_RETRY_DELAY = 1.0

# Attributes and methods of reolink_aio.api.Host that this integration relies on.
REQUIRED_HOST_ATTRS: tuple[str, ...] = (
    "baichuan",
    "baichuan_only",
    "camera_hardware_version",
    "camera_model",
    "camera_name",
    "camera_online",
    "camera_sw_version",
    "camera_uid",
    "channels",
    "encoding",
    "get_encoding",
    "get_flv_stream_source",
    "get_rtmp_stream_source",
    "get_rtsp_stream_source",
    "get_state",
    "get_vod_source",
    "hardware_version",
    "hide_password",
    "is_battery",
    "is_doorbell",
    "is_hub",
    "is_nvr",
    "item_number",
    "model",
    "nvr_name",
    "onvif_enabled",
    "protocol",
    "request_vod_files",
    "rtmp_enabled",
    "rtsp_enabled",
    "serial",
    "sleeping",
    "stream_channels",
    "supported",
    "sw_version",
    "timezone",
)
REQUIRED_BAICHUAN_ATTRS: tuple[str, ...] = (
    "search_vod_days",
    "search_vod_type",
    "snapshot_past",
)
REQUIRED_VOD_TYPES: tuple[str, ...] = (
    "PLAYBACK",
    "DOWNLOAD",
    "NVR_DOWNLOAD",
    "FLV",
    "RTMP",
)


class BridgeError(Exception):
    """Base error raised by the bridge."""


class IncompatibleError(BridgeError):
    """The Reolink integration's internals are not what the bridge expects."""


class HostNotFoundError(BridgeError):
    """No loaded Reolink entry with that id."""


class NotApplicableError(BridgeError):
    """The requested operation does not apply to this device."""


class RtmpDisabledError(NotApplicableError):
    """RTMP is off on the device; the bridge never turns it on."""


class LiveProtocol(StrEnum):
    """Live stream protocols."""

    RTSP = "rtsp"
    RTMP = "rtmp"
    FLV = "flv"


class VodMethod(StrEnum):
    """Recorded-video request methods (mirrors reolink_aio VodRequestType)."""

    PLAYBACK = "PLAYBACK"
    DOWNLOAD = "DOWNLOAD"
    NVR_DOWNLOAD = "NVR_DOWNLOAD"
    FLV = "FLV"
    RTMP = "RTMP"


@dataclass(frozen=True, slots=True)
class CompatReport:
    """Result of the compatibility check."""

    ok: bool
    errors: tuple[str, ...] = ()
    reolink_aio_version: str | None = None

    def as_dict(self) -> dict[str, Any]:
        """Return a JSON-serializable dict."""
        return {
            "ok": self.ok,
            "errors": list(self.errors),
            "reolink_aio_version": self.reolink_aio_version,
        }


@dataclass(frozen=True, slots=True)
class CameraUrl:
    """A camera URL. It embeds credentials: never log it or send it to a client."""

    value: str = field(repr=False)

    def __repr__(self) -> str:
        """Hide the URL."""
        return "CameraUrl(<redacted>)"

    __str__ = __repr__

    @property
    def scheme(self) -> str:
        """Return the URL scheme."""
        return self.value.split(":", 1)[0].lower()


@dataclass(frozen=True, slots=True)
class StreamEncoding:
    """Configured encoding of one stream, as reported by the device."""

    codec: str | None
    bit_rate: int | None
    frame_rate: int | None


@dataclass(frozen=True, slots=True)
class ChannelInfo:
    """Typed view of one channel of a host."""

    channel: int
    name: str
    model: str
    hardware_version: str
    firmware_version: str
    online: bool
    sleeping: bool
    is_battery: bool
    is_doorbell: bool
    supports_replay: bool
    supports_stream: bool
    main: StreamEncoding
    sub: StreamEncoding


@dataclass(frozen=True, slots=True)
class HostInfo:
    """Typed view of one Reolink host (camera, NVR or Home Hub)."""

    entry_id: str
    title: str
    name: str
    model: str
    hardware_version: str
    firmware_version: str
    is_nvr: bool
    is_hub: bool
    is_battery: bool
    baichuan_only: bool
    protocol: str
    rtsp_enabled: bool | None
    rtmp_enabled: bool | None
    onvif_enabled: bool | None
    supports_rtsp: bool
    supports_rtmp: bool
    supports_flv: bool
    channels: tuple[ChannelInfo, ...]

    @property
    def device_type(self) -> str:
        """Return camera, nvr or hub."""
        if self.is_hub:
            return "hub"
        if self.is_nvr:
            return "nvr"
        return "camera"

    def as_dict(self) -> dict[str, Any]:
        """Return a JSON-serializable dict."""
        data = asdict(self)
        data["device_type"] = self.device_type
        return data


@dataclass(frozen=True, slots=True)
class VodFile:
    """A recording file returned by a VOD search.

    ``start``/``end`` are the device's wall-clock times (reolink-aio attaches
    the device zone, which cannot tell the repeated DST hour apart: convert
    with ``timeconv``). ``playback`` is the search's raw PlaybackTime.
    """

    start: datetime
    end: datetime
    name: str
    stream: str
    size: int | None
    triggers: tuple[str, ...]
    playback: datetime | None = None

    @property
    def start_id(self) -> str:
        """Return the wall-clock start as YYYYMMDDHHMMSS (the events' file key)."""
        return _reolink_time_id(self.start)

    @property
    def nvr_download_name(self) -> str:
        """Return the 'start_end' id NVR_DOWNLOAD expects (as HA's media source)."""
        return f"{_reolink_time_id(self.start)}_{_reolink_time_id(self.end)}"


@dataclass(frozen=True, slots=True)
class VodEvent:
    """One detection from the Baichuan event search (wall-clock times)."""

    start: datetime
    end: datetime
    types: tuple[str, ...]
    file_id: str  # start_id of the recording it belongs to


@dataclass(frozen=True, slots=True)
class DaySearch:
    """Recordings and events of one search window."""

    files: list[VodFile]
    events: list[VodEvent]
    events_error: str | None = None
    # How long each search took (ms): "files_ms" and "events_ms".
    timing: dict[str, float] = field(default_factory=dict)


def _reolink_time_id(value: datetime) -> str:
    return value.strftime("%Y%m%d%H%M%S")


def _library_version() -> str | None:
    try:
        return version("reolink-aio")
    except PackageNotFoundError:
        return None


def _check_static() -> list[str]:
    """Check the shape of the Reolink integration and reolink-aio classes."""
    errors: list[str] = []
    try:
        util = importlib.import_module(
            f"homeassistant.components.{REOLINK_DOMAIN}.util"
        )
        host_mod = importlib.import_module(
            f"homeassistant.components.{REOLINK_DOMAIN}.host"
        )
        api_mod = importlib.import_module("reolink_aio.api")
        enums = importlib.import_module("reolink_aio.enums")
        baichuan_mod = importlib.import_module("reolink_aio.baichuan")
    except ImportError as err:
        return [f"cannot import the Reolink integration or reolink-aio: {err}"]

    reolink_data = getattr(util, "ReolinkData", None)
    if reolink_data is None or not is_dataclass(reolink_data):
        errors.append("homeassistant.components.reolink.util.ReolinkData is missing")
    elif "host" not in {f.name for f in fields(reolink_data)}:
        errors.append("ReolinkData no longer has a 'host' field")

    reolink_host = getattr(host_mod, "ReolinkHost", None)
    if reolink_host is None or not hasattr(reolink_host, "api"):
        errors.append("ReolinkHost.api is missing")
    elif not hasattr(reolink_host, "unique_id"):
        errors.append("ReolinkHost.unique_id is missing")

    host_cls = getattr(api_mod, "Host", None)
    if host_cls is None:
        errors.append("reolink_aio.api.Host is missing")
    else:
        errors.extend(
            f"reolink_aio.api.Host.{name} is missing"
            for name in REQUIRED_HOST_ATTRS
            if not hasattr(host_cls, name) and name not in _INSTANCE_ATTRS
        )

    baichuan_cls = getattr(baichuan_mod, "Baichuan", None)
    if baichuan_cls is None:
        errors.append("reolink_aio.baichuan.Baichuan is missing")
    else:
        errors.extend(
            f"reolink_aio Baichuan.{name} is missing"
            for name in REQUIRED_BAICHUAN_ATTRS
            if not hasattr(baichuan_cls, name)
        )

    vod_type = getattr(enums, "VodRequestType", None)
    if vod_type is None:
        errors.append("reolink_aio.enums.VodRequestType is missing")
    else:
        errors.extend(
            f"VodRequestType.{name} is missing"
            for name in REQUIRED_VOD_TYPES
            if not hasattr(vod_type, name)
        )
    return errors


# Set in Host.__init__ rather than defined on the class.
_INSTANCE_ATTRS = frozenset({"baichuan", "baichuan_only"})


def _api_of(entry: ConfigEntry) -> Host:
    """Return the reolink_aio Host of a loaded Reolink entry or raise.

    Checked by duck typing: the attributes we use must exist.
    """
    return _host_of(entry)[1]


def _host_of(entry: ConfigEntry) -> tuple[str, Host]:
    """Return (ReolinkHost.unique_id, reolink_aio Host) of a loaded entry or raise.

    The unique id is the base of the Reolink integration's device identifiers.
    """
    runtime_data = getattr(entry, "runtime_data", None)
    if runtime_data is None:
        raise IncompatibleError(f"Reolink entry {entry.title!r} has no runtime_data")
    host = getattr(runtime_data, "host", None)
    if host is None:
        raise IncompatibleError("Reolink runtime_data has no 'host'")
    api = getattr(host, "api", None)
    if api is None:
        raise IncompatibleError("Reolink runtime_data.host has no 'api'")
    missing = [name for name in REQUIRED_HOST_ATTRS if not hasattr(api, name)]
    missing.extend(
        f"baichuan.{name}"
        for name in REQUIRED_BAICHUAN_ATTRS
        if not hasattr(getattr(api, "baichuan", None), name)
    )
    if missing:
        raise IncompatibleError(f"reolink_aio Host is missing: {', '.join(missing)}")
    unique_id = getattr(host, "unique_id", None)
    if not isinstance(unique_id, str) or not unique_id:
        raise IncompatibleError("Reolink runtime_data.host has no 'unique_id'")
    return unique_id, cast("Host", api)


@callback
def async_check_compat(hass: HomeAssistant) -> CompatReport:
    """Check that the Reolink integration looks the way the bridge expects."""
    errors = _check_static()
    if not errors:
        for entry in hass.config_entries.async_loaded_entries(REOLINK_DOMAIN):
            try:
                _api_of(entry)
            except IncompatibleError as err:
                errors.append(str(err))
    return CompatReport(
        ok=not errors, errors=tuple(errors), reolink_aio_version=_library_version()
    )


@callback
def async_get_hosts(hass: HomeAssistant) -> list[ReolinkHostHandle]:
    """Return handles for every loaded Reolink entry.

    Entries are looked up on every call, never cached, so reloads of the Reolink
    integration are picked up.
    """
    return [
        _handle(entry)
        for entry in hass.config_entries.async_loaded_entries(REOLINK_DOMAIN)
    ]


@callback
def async_get_host(hass: HomeAssistant, entry_id: str) -> ReolinkHostHandle:
    """Return the handle for one loaded Reolink entry."""
    entry = hass.config_entries.async_get_entry(entry_id)
    if (
        entry is None
        or entry.domain != REOLINK_DOMAIN
        or entry not in hass.config_entries.async_loaded_entries(REOLINK_DOMAIN)
    ):
        raise HostNotFoundError(entry_id)
    return _handle(entry)


def _handle(entry: ConfigEntry) -> ReolinkHostHandle:
    unique_id, api = _host_of(entry)
    return ReolinkHostHandle(entry, api, unique_id)


@callback
def async_list_devices_degraded(hass: HomeAssistant) -> list[dict[str, Any]]:
    """List Reolink devices from the public device registry only."""
    registry = dr.async_get(hass)
    devices: list[dict[str, Any]] = []
    for entry in hass.config_entries.async_entries(REOLINK_DOMAIN):
        devices.extend(
            {
                "entry_id": entry.entry_id,
                "device_id": device.id,
                "name": device.name_by_user or device.name,
                "model": device.model,
                "firmware_version": device.sw_version,
                "hardware_version": device.hw_version,
                "via_device_id": device.via_device_id,
            }
            for device in dr.async_entries_for_config_entry(registry, entry.entry_id)
        )
    return devices


def _safe(func: Any, *args: Any) -> Any:
    """Call a reolink-aio accessor, mapping missing data to None."""
    try:
        return func(*args)
    except KeyError, IndexError, TypeError, ValueError, AttributeError:
        return None
    except Exception as err:
        if type(err).__module__.startswith("reolink_aio"):
            return None
        raise


class ReolinkHostHandle:
    """Typed access to one loaded Reolink host."""

    def __init__(self, entry: ConfigEntry, api: Host, unique_id: str) -> None:
        """Initialize the handle.

        ``unique_id`` is the Reolink integration's ReolinkHost.unique_id (the
        host's UID or MAC). It is a secret: never send it to a client.
        """
        self._entry = entry
        self._api = api
        self._unique_id = unique_id

    @property
    def entry_id(self) -> str:
        """Return the Reolink config entry id (also the scheduler key)."""
        return self._entry.entry_id

    @property
    def is_nvr(self) -> bool:
        """Return True for NVRs and Home Hubs."""
        return bool(self._api.is_nvr)

    @property
    def title(self) -> str:
        """Return the Reolink config entry title."""
        return self._entry.title

    def channels(self) -> list[int]:
        """Return the channels in use."""
        return list(self._api.channels)

    @property
    def is_hub(self) -> bool:
        """Return True for Home Hubs."""
        return bool(self._api.is_hub)

    @property
    def rtmp_enabled(self) -> bool | None:
        """Return the cached RTMP port state (None = unknown)."""
        return self._api.rtmp_enabled

    def timezone(self) -> tzinfo | None:
        """Return the device time zone, if known."""
        tz = _safe(self._api.timezone)
        return tz if isinstance(tz, tzinfo) else None

    def info(self) -> HostInfo:
        """Return a typed snapshot of the host from cached data (no I/O)."""
        api = self._api
        channels = tuple(self._channel_info(ch) for ch in api.channels)
        return HostInfo(
            entry_id=self._entry.entry_id,
            title=self._entry.title,
            name=api.nvr_name,
            model=api.model,
            hardware_version=api.hardware_version,
            firmware_version=api.sw_version,
            is_nvr=bool(api.is_nvr),
            is_hub=bool(api.is_hub),
            is_battery=bool(api.is_battery),
            baichuan_only=bool(api.baichuan_only),
            protocol=api.protocol,
            rtsp_enabled=api.rtsp_enabled,
            rtmp_enabled=api.rtmp_enabled,
            onvif_enabled=api.onvif_enabled,
            supports_rtsp=bool(api.supported(None, "RTSP")),
            supports_rtmp=bool(api.supported(None, "RTMP")),
            supports_flv=bool(api.supported(None, "FLV")),
            channels=channels,
        )

    def _encoding(self, channel: int, stream: str) -> StreamEncoding:
        api = self._api
        return StreamEncoding(
            codec=_safe(api.encoding, channel, stream),
            bit_rate=_safe(api.bit_rate, channel, stream),
            frame_rate=_safe(api.frame_rate, channel, stream),
        )

    def _channel_info(self, channel: int) -> ChannelInfo:
        api = self._api
        return ChannelInfo(
            channel=channel,
            name=api.camera_name(channel),
            model=api.camera_model(channel),
            hardware_version=api.camera_hardware_version(channel),
            firmware_version=api.camera_sw_version(channel),
            online=bool(api.camera_online(channel)),
            sleeping=bool(api.sleeping(channel)),
            is_battery=bool(api.supported(channel, "battery")),
            is_doorbell=bool(api.is_doorbell(channel)),
            supports_replay=bool(api.supported(channel, "replay")),
            supports_stream=channel in api.stream_channels,
            main=self._encoding(channel, "main"),
            sub=self._encoding(channel, "sub"),
        )

    # ---- Device registry mapping and cached details (no I/O) ----

    def classify_device(self, identifiers: Iterable[tuple[str, str]]) -> DeviceRef:
        """Return what a device registry entry of this host's entry represents.

        Mirrors the identifiers the Reolink integration gives its devices
        (homeassistant/components/reolink/entity.py): the host itself,
        ``<id>_ch<N>`` / ``<id>_<camera uid>`` for NVR channels, ``<id>_lens<N>``
        for the lenses of dual-lens cameras and ``<id>_chime<N>`` for chimes.
        """
        api = self._api
        uid = self._unique_id
        channel_ids: dict[str, int] = {}
        for ch in api.channels:
            channel_ids[f"{uid}_ch{ch}"] = ch
            if (cam_uid := _safe(api.camera_uid, ch)) and cam_uid != _UNKNOWN:
                channel_ids[f"{uid}_{cam_uid}"] = ch
        for domain, ident in identifiers:
            if domain != REOLINK_DOMAIN:
                continue
            if ident == uid:
                # A camera added directly is a host with its camera on channel 0.
                channel = None if api.is_nvr else _first(api.channels)
                return DeviceRef(DeviceRole.HOST, channel)
            if ident in channel_ids:
                return DeviceRef(DeviceRole.CHANNEL, channel_ids[ident])
            suffix = ident.removeprefix(f"{uid}_")
            if suffix != ident:
                if (lens := _int_suffix(suffix, "lens")) is not None:
                    return DeviceRef(DeviceRole.LENS, lens)
                if _int_suffix(suffix, "chime") is not None:
                    return DeviceRef(DeviceRole.CHIME, None)
        return DeviceRef(DeviceRole.OTHER, None)

    def host_details(self) -> dict[str, Any]:
        """Return a curated, client-safe summary of the host (cached data only)."""
        api = self._api
        storage = [
            {
                "index": index,
                "type": _safe(api.hdd_type, index),
                "used_percent": _safe(api.hdd_storage, index),
                "available": _safe(api.hdd_available, index),
            }
            for index in _safe(lambda: api.hdd_list) or []
        ]
        wifi = bool(_safe(api.wifi_connection))
        return {
            "model": _safe(lambda: api.model),
            "model_id": _safe(api.item_number),
            "hardware_version": _safe(lambda: api.hardware_version),
            "firmware_version": _safe(lambda: api.sw_version),
            "device_type": "hub" if api.is_hub else ("nvr" if api.is_nvr else "camera"),
            "channels": len(api.channels),
            "stream_protocol": _safe(lambda: api.protocol),
            "baichuan_only": bool(api.baichuan_only),
            "network": {
                "connection": "wifi" if wifi else "lan",
                "wifi_signal_dbm": _safe(api.wifi_signal) if wifi else None,
            },
            "ports": {
                "http": {
                    "port": _safe(lambda: api.port),
                    "https": _safe(lambda: api.use_https),
                },
                "rtsp": {
                    "enabled": api.rtsp_enabled,
                    "port": _safe(lambda: api.rtsp_port),
                },
                "rtmp": {
                    "enabled": api.rtmp_enabled,
                    "port": _safe(lambda: api.rtmp_port),
                },
                "onvif": {
                    "enabled": api.onvif_enabled,
                    "port": _safe(lambda: api.onvif_port),
                },
            },
            "storage": storage,
            "cpu_usage": _safe(lambda: api.cpu_usage),
            "capabilities": _capabilities(api, None, _HOST_CAPABILITIES),
        }

    def channel_details(self, channel: int) -> dict[str, Any]:
        """Return a curated, client-safe summary of one channel (cached data only)."""
        api = self._api
        info = self._channel_info(channel)
        wifi = bool(_safe(api.wifi_connection, channel))
        battery = None
        if info.is_battery:
            status = _safe(api.battery_status, channel)
            battery = {
                "percent": _safe(api.battery_percentage, channel),
                "temperature_c": _safe(api.battery_temperature, channel),
                "status": _BATTERY_STATUS.get(status) if status is not None else None,
            }
        return {
            "channel": channel,
            "name": info.name,
            "model": info.model,
            "model_id": _safe(api.item_number, channel),
            "hardware_version": info.hardware_version,
            "firmware_version": info.firmware_version,
            "online": info.online,
            "sleeping": info.sleeping,
            "is_battery": info.is_battery,
            "is_doorbell": info.is_doorbell,
            "is_dual_lens": bool(_safe(lambda: api.is_dual_lens)),
            "supports_replay": info.supports_replay,
            "supports_stream": info.supports_stream,
            "encodings": {"main": asdict(info.main), "sub": asdict(info.sub)},
            "network": {
                "connection": "wifi" if wifi else "lan",
                "wifi_signal_dbm": _safe(api.wifi_signal, channel) if wifi else None,
            },
            "battery": battery,
            "ai_types": sorted(_safe(api.ai_supported_types, channel) or []),
            "capabilities": _capabilities(api, channel, _CHANNEL_CAPABILITIES),
        }

    def records_locally(self, channel: int) -> bool:
        """Return True if this host stores recordings of the channel.

        An NVR or Home Hub records its channels; a camera added directly records
        only when it has a storage device (SD card) and replay support.
        """
        api = self._api
        if not _safe(api.supported, channel, "replay"):
            return False
        return bool(api.is_nvr) or bool(_safe(lambda: api.hdd_list))

    def _fingerprints(self, channel: int) -> frozenset[str]:
        """Return identifiers of the camera on a channel (secret: never output)."""
        api = self._api
        if api.is_nvr:
            values = [
                _safe(api.camera_uid, channel),
                _safe(api.serial, channel),
                _safe(api.baichuan.mac_address, channel),
            ]
        else:
            values = [
                _safe(lambda: api.uid),
                _safe(api.serial, None),
                _safe(api.serial, channel),
                _safe(lambda: api.mac_address),
            ]
        return frozenset(v for v in map(_normalize_id, values) if v is not None)

    def secrets(self) -> list[str]:
        """Return values that must never appear in output."""
        api = self._api
        values: list[str | None] = [
            self._entry.data.get(CONF_PASSWORD),
            self._entry.data.get(CONF_USERNAME),
            # reolink-aio error messages carry "Host: <address>:<port>".
            self._entry.data.get(CONF_HOST),
            self._entry.unique_id,
            self._unique_id,
            _safe(lambda: api.uid),
            _safe(lambda: api.mac_address),
            _safe(api.serial, None),
        ]
        for channel in api.channels:
            values.append(_safe(api.camera_uid, channel))
            values.append(_safe(api.serial, channel))
        return [v for v in values if isinstance(v, str) and len(v) >= 3]

    def hide_password(self, text: str) -> str:
        """Redact credentials the library knows about."""
        return str(self._api.hide_password(text))

    # ---- Device I/O. Call these through the scheduler. ----

    async def async_get_encoding(self, channel: int, stream: str) -> str:
        """Return the stream encoding, fetching GetEnc if needed."""
        return str(await self._api.get_encoding(channel, stream))

    async def async_refresh_ports(self) -> bool | None:
        """Read the network port state (read-only GetNetPort) and return RTMP state."""
        await self._api.get_state("GetNetPort")
        return self._api.rtmp_enabled

    async def async_get_time(self) -> datetime:
        """Return the device's current time."""
        now = _safe(self._api.time)
        if isinstance(now, datetime):
            return now
        return await self._api.async_get_time()

    async def async_live_url(
        self, channel: int, protocol: LiveProtocol, stream: str
    ) -> CameraUrl | None:
        """Return the live URL for a channel/stream, or None if unavailable."""
        api = self._api
        if protocol is LiveProtocol.RTSP:
            url = await api.get_rtsp_stream_source(channel, stream)
        elif protocol is LiveProtocol.RTMP:
            url = api.get_rtmp_stream_source(channel, stream)
        else:
            url = api.get_flv_stream_source(channel, stream)
        return CameraUrl(url) if url else None

    async def async_online_users(self) -> tuple[int | None, str | None]:
        """Return how many clients the device lists as logged in, or why not.

        The read-only ``GetOnline`` command, through reolink-aio's generic
        request (it has no parser for it). Each logged-in client (Home
        Assistant, the Reolink app, a browser) is one; how stream sessions
        count is the device's business. Returns (count, None) or (None, why).
        """
        send = getattr(self._api, "send", None)
        if send is None:
            return None, "reolink-aio cannot send commands"
        try:
            response = await send(
                [{"cmd": "GetOnline", "action": 0, "param": {}}],
                expected_response_type="json",
            )
        except Exception as err:  # noqa: BLE001 - reported, never raised
            return None, _search_error(err)
        item = response[0] if isinstance(response, list) and response else {}
        item = item if isinstance(item, dict) else {}
        value = item.get("value")
        users = value.get("User") if isinstance(value, dict) else None
        if isinstance(users, list):
            return len(users), None
        error = item.get("error")
        detail = error.get("detail") if isinstance(error, dict) else None
        return None, str(detail or "no answer")

    async def async_vod_url(
        self,
        channel: int,
        file: VodFile,
        method: VodMethod,
        *,
        start_at: datetime | None = None,
    ) -> tuple[str, CameraUrl]:
        """Return (mime type, URL) for a recording.

        Never changes device settings: reolink-aio's get_vod_source(RTMP) turns
        the RTMP port on when it is off, so RTMP is refused unless the port is
        known to be enabled.

        ``start_at`` sets the ``start`` query parameter (device-local time) of
        PLAYBACK/DOWNLOAD URLs, which reolink-aio fills with the file's start
        when it can parse the file name; it may ask the device to begin there.
        """
        from reolink_aio.enums import VodRequestType  # noqa: PLC0415

        api = self._api
        filename = file.name
        if method is VodMethod.NVR_DOWNLOAD:
            if not api.is_nvr:
                raise NotApplicableError("NVR_DOWNLOAD applies to NVRs only")
            filename = file.nvr_download_name
        if method is VodMethod.RTMP:
            if api.is_nvr:
                # reolink-aio silently substitutes FLV on NVRs.
                raise NotApplicableError("NVRs do not support RTMP VOD")
            if api.rtmp_enabled is not True:
                raise RtmpDisabledError(
                    "RTMP port is not enabled; the probe never enables it"
                )
        mime, url = await api.get_vod_source(
            channel, filename, file.stream, VodRequestType[method.value]
        )
        if start_at is not None:
            if method not in (VodMethod.PLAYBACK, VodMethod.DOWNLOAD):
                raise NotApplicableError("start_at applies to PLAYBACK and DOWNLOAD")
            url = with_start_param(url, start_at, self.timezone())
        return mime, CameraUrl(url)

    async def async_search_vod_files(
        self, channel: int, start: datetime, end: datetime, stream: str
    ) -> list[VodFile]:
        """Search recordings (HTTP Search merged with Baichuan event search)."""
        _statuses, files = await self._api.request_vod_files(
            channel, start, end, stream=stream
        )
        return [_vod_file(f, stream) for f in files]

    async def async_search_day(
        self, channel: int, start: datetime, end: datetime, stream: str
    ) -> DaySearch:
        """Search recordings and their individual events in one window.

        Runs the HTTP recording search and the Baichuan event search together.
        ``start``/``end`` are device wall-clock times. An event search failure
        leaves the recordings usable (``events_error``).
        """
        timing: dict[str, float] = {}

        async def timed[T](name: str, call: Callable[[], Awaitable[T]]) -> T:
            # The call is made here, so a cancelled search leaves nothing unawaited.
            began = time.monotonic()
            try:
                return await call()
            finally:
                timing[name] = round((time.monotonic() - began) * 1000, 1)

        results: tuple[Any, Any] = await asyncio.gather(
            timed(
                "files_ms",
                lambda: self._api.request_vod_files(channel, start, end, stream=stream),
            ),
            timed(
                "events_ms",
                lambda: self._search_events(channel, start, end, stream),
            ),
            return_exceptions=True,
        )
        files_result, events_result = results
        if isinstance(files_result, BaseException):
            raise files_result
        _statuses, raw_files = files_result
        files = [_vod_file(f, stream) for f in raw_files]
        if isinstance(events_result, BaseException):
            if isinstance(events_result, asyncio.CancelledError):
                raise events_result
            return DaySearch(files, [], _search_error(events_result), timing)
        _by_id, by_trigger = events_result
        return DaySearch(files, _events(by_trigger), timing=timing)

    async def _search_events(
        self, channel: int, start: datetime, end: datetime, stream: str
    ) -> Any:
        """Run the Baichuan event search, once more after a pause if it fails."""
        try:
            return await self._api.baichuan.search_vod_type(
                channel=channel, start=start, end=end, stream=stream
            )
        except Exception as err:  # noqa: BLE001 - retried; a second failure is reported
            _LOGGER.debug("Event search failed (%s), trying again", _search_error(err))
            await asyncio.sleep(EVENT_SEARCH_RETRY_DELAY)
            return await self._api.baichuan.search_vod_type(
                channel=channel, start=start, end=end, stream=stream
            )

    async def async_recording_days(
        self, channel: int, start: datetime, end: datetime
    ) -> list[date]:
        """Return the days with recordings between two wall-clock times."""
        try:
            statuses = await self._api.baichuan.search_vod_days(channel, start, end)
        except Exception:  # fall back to the HTTP status search
            _LOGGER.debug("Baichuan day search failed, trying HTTP", exc_info=True)
            statuses, _files = await self._api.request_vod_files(
                channel, start, end, status_only=True
            )
        days = {
            date(status.year, status.month, day)
            for status in statuses
            for day in status.days
        }
        return sorted(d for d in days if start.date() <= d <= end.date())

    async def async_search_vod_events(
        self, channel: int, start: datetime, end: datetime, stream: str
    ) -> dict[str, int]:
        """Baichuan event search: number of recordings per trigger type."""
        _by_id, by_trigger = await self._api.baichuan.search_vod_type(
            channel=channel, start=start, end=end, stream=stream
        )
        return {
            trig.name: len(files)
            for trig, files in by_trigger.items()
            if files and trig.name and trig.name != "NONE"
        }

    async def async_search_vod_days(
        self, channel: int, start: datetime, end: datetime
    ) -> int:
        """Baichuan day search: number of days with recordings."""
        statuses = await self._api.baichuan.search_vod_days(channel, start, end)
        return sum(len(status.days) for status in statuses)

    async def async_snapshot_past(
        self, channel: int, when: datetime, stream: str, ffmpeg_binary: str
    ) -> bytes:
        """Return a JPEG frame from a past recording (Baichuan cmd 298)."""
        if (camera_tz := self.timezone()) is not None and when.tzinfo is not None:
            when = when.astimezone(camera_tz)
        return bytes(
            await self._api.baichuan.snapshot_past(channel, when, stream, ffmpeg_binary)
        )


class DeviceRole(StrEnum):
    """What a Reolink device registry entry represents."""

    HOST = "host"
    CHANNEL = "channel"
    LENS = "lens"
    CHIME = "chime"
    OTHER = "other"


@dataclass(frozen=True, slots=True)
class DeviceRef:
    """A device registry entry, classified.

    ``channel`` is the camera channel for CHANNEL and LENS devices, and for the
    HOST device of a camera added directly (channel 0).
    """

    role: DeviceRole
    channel: int | None


_UNKNOWN = "Unknown"
_BATTERY_STATUS = {0: "discharging", 1: "charging", 2: "chargecomplete"}

# reolink-aio capability flags worth showing, with their labels.
_HOST_CAPABILITIES: dict[str, str] = {
    "hdd": "Local storage",
    "wifi": "Wi-Fi",
    "update": "Firmware update",
    "reboot": "Remote restart",
    "hub_audio": "Hub audio",
    "ONVIF": "ONVIF",
}
_CHANNEL_CAPABILITIES: dict[str, str] = {
    "ptz": "PTZ",
    "pan_tilt": "Pan and tilt",
    "zoom": "Optical zoom",
    "auto_focus": "Autofocus",
    "auto_track": "Auto tracking",
    "floodLight": "Floodlight",
    "siren": "Siren",
    "ir_lights": "Infrared night vision",
    "status_led": "Status LED",
    "HDR": "HDR",
    "dayNight": "Day/night switching",
    "PIR": "PIR sensor",
    "motion_detection": "Motion detection",
    "privacy_mask": "Privacy mask",
    "recording": "Recording",
    "replay": "Playback",
    "quick_reply": "Quick reply",
    "chime": "Chime",
    "battery": "Battery",
}


def _capabilities(api: Any, channel: int | None, labels: dict[str, str]) -> list[str]:
    return [
        label for cap, label in labels.items() if _safe(api.supported, channel, cap)
    ]


def _first(values: Iterable[int]) -> int | None:
    return next(iter(values), None)


def _int_suffix(text: str, prefix: str) -> int | None:
    rest = text.removeprefix(prefix)
    if rest == text or not rest.isdigit():
        return None
    return int(rest)


def _normalize_id(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    value = value.strip().upper().replace(":", "").replace("-", "")
    if len(value) < 6 or value == _UNKNOWN.upper():
        return None
    return value


@callback
def async_camera_groups(
    hosts: Iterable[ReolinkHostHandle],
) -> dict[tuple[str, int], str]:
    """Find cameras that are in HA more than once (via an NVR and directly).

    Matches channels by camera UID, serial number or MAC address. Returns an
    opaque group id per ``(entry_id, channel)`` that belongs to a duplicate
    group; cameras seen once are not in the result. The ids are derived from
    the entry ids and channels only, never from the identifiers.
    """
    members: list[tuple[tuple[str, int], frozenset[str]]] = []
    for host in hosts:
        for channel in host.channels():
            try:
                fingerprints = host._fingerprints(channel)  # noqa: SLF001
            except Exception:  # noqa: BLE001 - grouping is best effort
                _LOGGER.debug("Cannot read identifiers of %s", host.entry_id)
                continue
            if fingerprints:
                members.append(((host.entry_id, channel), fingerprints))

    # Union-find over shared identifiers.
    parent = list(range(len(members)))

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    owner: dict[str, int] = {}
    for index, (_ref, fingerprints) in enumerate(members):
        for value in fingerprints:
            if (other := owner.setdefault(value, index)) != index:
                parent[find(index)] = find(other)

    groups: dict[int, list[tuple[str, int]]] = {}
    for index, (ref, _fp) in enumerate(members):
        groups.setdefault(find(index), []).append(ref)
    result: dict[tuple[str, int], str] = {}
    for refs in groups.values():
        if len({entry_id for entry_id, _ch in refs}) < 2:
            continue
        digest = hashlib.sha256(
            "|".join(f"{e}:{c}" for e, c in sorted(refs)).encode()
        ).hexdigest()[:16]
        for ref in refs:
            result[ref] = f"g{digest}"
    return result


_START_PARAM = re.compile(r"&start=\d*")


def with_start_param(url: str, start_at: datetime, device_tz: tzinfo | None) -> str:
    """Set (or replace) the ``start`` query parameter, in device-local time."""
    if start_at.tzinfo is not None and device_tz is not None:
        start_at = start_at.astimezone(device_tz)
    return _START_PARAM.sub("", url) + "&start=" + _reolink_time_id(start_at)


def opaque_key(entry_id: str, channel: int | None) -> str:
    """Return a stable key for a host channel that reveals no identifier."""
    digest = hashlib.sha256(f"{entry_id}:{channel}".encode()).hexdigest()
    return digest[:16]


def _vod_file(f: Any, stream: str) -> VodFile:
    playback = _safe(lambda: f.playback_time)
    return VodFile(
        start=f.start_time,
        end=f.end_time,
        name=f.file_name,
        stream=stream,
        size=_safe(lambda: f.size),
        triggers=_trigger_names(f.triggers),
        playback=playback.replace(tzinfo=None)
        if isinstance(playback, datetime)
        else None,
    )


def _events(by_trigger: Any) -> list[VodEvent]:
    """Flatten the Baichuan search: one event per moment, with all its types.

    An item listed under several triggers is one event. The NVR also sends a
    separate alarm record per detection type for the same moment (a vehicle
    and the motion it caused start together): records of the same recording
    that start at the same second are merged, ending at the latest end.
    """
    seen: dict[int, Any] = {}
    for items in by_trigger.values():
        for item in items:
            seen.setdefault(id(item), item)
    merged: dict[tuple[str, datetime], VodEvent] = {}
    for item in seen.values():
        try:
            start = item.start_time.replace(tzinfo=None)
            end = item.end_time.replace(tzinfo=None)
            file_id = str(item.file_name)
        except Exception:  # skip malformed items
            _LOGGER.debug("Skipping a malformed event", exc_info=True)
            continue
        types = _trigger_names(item.bc_triggers)
        if (known := merged.get((file_id, start))) is not None:
            types = tuple(dict.fromkeys((*known.types, *types)))
            end = max(end, known.end)
        merged[file_id, start] = VodEvent(start, end, types, file_id)
    return sorted(merged.values(), key=lambda e: (e.start, e.end))


def _search_error(err: BaseException) -> str:
    """Name a failed search for the browser: the error type and the device's code."""
    code = getattr(err, "rspCode", None)
    return f"{type(err).__name__} {code}" if code is not None else type(err).__name__


def _trigger_names(triggers: Iterable[Any] | Any) -> tuple[str, ...]:
    try:
        return tuple(t.name for t in triggers if t.name and t.name != "NONE")
    except TypeError:
        return ()


_URL = re.compile(r"(?i)\b[a-z][a-z0-9+.-]*://[^\s\"'<>]+")
_IPV4 = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
_SECRET_PARAM = re.compile(
    r"(?i)\b(password|passwd|pwd|user|username|token)=([^&\s\"']+)"
)


def redact_text(text: str, secrets: Iterable[str]) -> str:
    """Remove URLs, credentials, tokens and identifiers from a string.

    Whole URLs are replaced: they carry credentials and device addresses. IPv4
    addresses are replaced too (reolink-aio errors include "Host: <ip>:<port>").
    """
    text = _URL.sub("<url>", text)
    text = _IPV4.sub("<ip>", text)
    text = _SECRET_PARAM.sub(r"\1=<redacted>", text)
    for secret in sorted(set(secrets), key=len, reverse=True):
        if secret:
            text = text.replace(secret, "<redacted>")
    return text

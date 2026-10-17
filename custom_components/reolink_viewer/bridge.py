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

from collections.abc import Iterable
from dataclasses import asdict, dataclass, field, fields, is_dataclass
from datetime import datetime, tzinfo
from enum import StrEnum
import importlib
from importlib.metadata import PackageNotFoundError, version
import logging
import re
from typing import TYPE_CHECKING, Any, cast

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_PASSWORD, CONF_USERNAME
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import device_registry as dr

from .const import REOLINK_DOMAIN

if TYPE_CHECKING:
    from reolink_aio.api import Host

_LOGGER = logging.getLogger(__name__)

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
    """A recording file returned by a VOD search."""

    start: datetime
    end: datetime
    name: str
    stream: str
    size: int | None
    triggers: tuple[str, ...]

    @property
    def nvr_download_name(self) -> str:
        """Return the 'start_end' id NVR_DOWNLOAD expects (as HA's media source)."""
        return f"{_reolink_time_id(self.start)}_{_reolink_time_id(self.end)}"


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
    return cast("Host", api)


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
        ReolinkHostHandle(entry, _api_of(entry))
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
    return ReolinkHostHandle(entry, _api_of(entry))


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

    def __init__(self, entry: ConfigEntry, api: Host) -> None:
        """Initialize the handle."""
        self._entry = entry
        self._api = api

    @property
    def entry_id(self) -> str:
        """Return the Reolink config entry id (also the scheduler key)."""
        return self._entry.entry_id

    @property
    def is_nvr(self) -> bool:
        """Return True for NVRs and Home Hubs."""
        return bool(self._api.is_nvr)

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

    def secrets(self) -> list[str]:
        """Return values that must never appear in output."""
        api = self._api
        values: list[str | None] = [
            self._entry.data.get(CONF_PASSWORD),
            self._entry.data.get(CONF_USERNAME),
            self._entry.unique_id,
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

    async def async_vod_url(
        self, channel: int, file: VodFile, method: VodMethod
    ) -> tuple[str, CameraUrl]:
        """Return (mime type, URL) for a recording.

        Never changes device settings: reolink-aio's get_vod_source(RTMP) turns
        the RTMP port on when it is off, so RTMP is refused unless the port is
        known to be enabled.
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
        return mime, CameraUrl(url)

    async def async_search_vod_files(
        self, channel: int, start: datetime, end: datetime, stream: str
    ) -> list[VodFile]:
        """Search recordings (HTTP Search merged with Baichuan event search)."""
        _statuses, files = await self._api.request_vod_files(
            channel, start, end, stream=stream
        )
        return [
            VodFile(
                start=f.start_time,
                end=f.end_time,
                name=f.file_name,
                stream=stream,
                size=_safe(lambda f=f: f.size),
                triggers=_trigger_names(f.triggers),
            )
            for f in files
        ]

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


def _trigger_names(triggers: Iterable[Any] | Any) -> tuple[str, ...]:
    try:
        return tuple(t.name for t in triggers if t.name and t.name != "NONE")
    except TypeError:
        return ()


_URL = re.compile(r"(?i)\b[a-z][a-z0-9+.-]*://[^\s\"'<>]+")
_SECRET_PARAM = re.compile(
    r"(?i)\b(password|passwd|pwd|user|username|token)=([^&\s\"']+)"
)


def redact_text(text: str, secrets: Iterable[str]) -> str:
    """Remove URLs, credentials, tokens and identifiers from a string.

    Whole URLs are replaced: they carry credentials and device addresses.
    """
    text = _URL.sub("<url>", text)
    text = _SECRET_PARAM.sub(r"\1=<redacted>", text)
    for secret in sorted(set(secrets), key=len, reverse=True):
        if secret:
            text = text.replace(secret, "<redacted>")
    return text

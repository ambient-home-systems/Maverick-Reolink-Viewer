"""Device model for the panel: Reolink devices, their connections and entities.

Built server-side from the device and entity registries (public HA APIs) and
the bridge (everything that depends on the Reolink integration's internals:
which registry device is which channel, cached device details, duplicate
detection).

The model has two kinds of nodes:

- **hosts** — NVRs and Home Hubs, each with the ids of its cameras;
- **cameras** — one per physical camera. A camera that is in HA twice (via an
  NVR and added directly) is merged into one node with two *connections*; the
  NVR connection is the playback source.

Nothing secret is sent: no unique ids, identifiers, serial numbers, MAC
addresses or configuration URLs (they carry the device address).
"""

from collections.abc import Iterable
from dataclasses import dataclass, field
import logging
from typing import Any, Literal

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import device_registry as dr, entity_registry as er

from . import bridge
from .bridge import DeviceRef, DeviceRole, ReolinkHostHandle
from .catalog import Catalog, catalog_key
from .const import REOLINK_DOMAIN

_LOGGER = logging.getLogger(__name__)

# Camera entities in order of preference for the Overview snapshot: the
# lightest stream first (each snapshot is a request to the device).
SNAPSHOT_PREFERENCE: tuple[str, ...] = (
    "sub",
    "snapshots_sub",
    "ext",
    "main",
    "snapshots_main",
)

type Via = Literal["nvr", "direct"]

# The live streams of a camera, and the camera entities that show them in
# Home Assistant's own view (for the live check's comparison).
LIVE_STREAMS: tuple[str, ...] = ("sub", "main", "ext")
# How each live stream is read: Reolink serves no ext over RTSP (Phase 0).
LIVE_PROTOCOLS: dict[str, bridge.LiveProtocol] = {
    "sub": bridge.LiveProtocol.RTSP,
    "main": bridge.LiveProtocol.RTSP,
    "ext": bridge.LiveProtocol.FLV,
}


class DeviceNotFoundError(Exception):
    """No Reolink device with that id."""


class NoPlaybackError(Exception):
    """The camera records nowhere HA can reach (no NVR, Hub or SD card)."""


@dataclass(frozen=True, slots=True)
class PlaybackSource:
    """Where a camera's recordings are: a host and channel (the NVR for merged)."""

    camera_id: str
    name: str
    entry_id: str
    channel: int
    is_doorbell: bool = False
    is_battery: bool = False

    @property
    def key(self) -> str:
        """Return a stable storage key that reveals no identifier."""
        return bridge.opaque_key(self.entry_id, self.channel)


@dataclass(frozen=True, slots=True)
class LiveSource:
    """One way to watch a camera live: an NVR channel or a direct connection."""

    camera_id: str
    # The connection's device id (what the panel addresses it by).
    connection_id: str
    name: str
    entry_id: str
    channel: int
    via: Via
    is_battery: bool = False

    @property
    def key(self) -> str:
        """Return a stable key that reveals no identifier."""
        return bridge.opaque_key(self.entry_id, self.channel)


@dataclass(slots=True)
class _Connection:
    """One way HA reaches a camera: an NVR channel or a direct connection."""

    entry_id: str
    entry_title: str
    device: dr.DeviceEntry
    via: Via
    channel: int | None
    host_device_id: str | None
    handle: ReolinkHostHandle | None
    sub_devices: list[dr.DeviceEntry] = field(default_factory=list)
    playback_source: bool = False

    @property
    def device_ids(self) -> list[str]:
        return [self.device.id, *(d.id for d in self.sub_devices)]


@dataclass(slots=True)
class _Host:
    entry_id: str
    entry_title: str
    device: dr.DeviceEntry
    kind: Literal["nvr", "hub"]
    handle: ReolinkHostHandle | None
    sub_devices: list[dr.DeviceEntry] = field(default_factory=list)
    camera_ids: list[str] = field(default_factory=list)

    @property
    def device_ids(self) -> list[str]:
        return [self.device.id, *(d.id for d in self.sub_devices)]


@dataclass(slots=True)
class _Camera:
    connections: list[_Connection]
    group_id: str | None = None

    @property
    def primary(self) -> _Connection:
        return self.connections[0]

    @property
    def id(self) -> str:
        return self.primary.device.id


@dataclass(slots=True)
class _Model:
    hosts: list[_Host]
    cameras: list[_Camera]
    degraded: bool


def _device_name(device: dr.DeviceEntry) -> str | None:
    return device.name_by_user or device.name


def _device_info(device: dr.DeviceEntry) -> dict[str, Any]:
    """Client-safe device registry fields."""
    return {
        "device_id": device.id,
        "name": _device_name(device),
        "manufacturer": device.manufacturer,
        "model": device.model,
        "model_id": device.model_id,
        "hw_version": device.hw_version,
        "sw_version": device.sw_version,
        "area_id": device.area_id,
        "disabled_by": device.disabled_by,
    }


def _handles(hass: HomeAssistant) -> dict[str, ReolinkHostHandle]:
    """Bridge handles per loaded entry; entries the bridge can't read are left out."""
    handles: dict[str, ReolinkHostHandle] = {}
    for entry in hass.config_entries.async_loaded_entries(REOLINK_DOMAIN):
        try:
            handles[entry.entry_id] = bridge.async_get_host(hass, entry.entry_id)
        except bridge.BridgeError as err:
            _LOGGER.debug("Reolink entry %s in degraded mode: %s", entry.title, err)
    return handles


def _classify(handle: ReolinkHostHandle | None, device: dr.DeviceEntry) -> DeviceRef:
    if handle is not None:
        return handle.classify_device(device.identifiers)
    # Degraded: only the registry's via_device link is known.
    if device.via_device_id is None:
        return DeviceRef(DeviceRole.HOST, None)
    return DeviceRef(DeviceRole.CHANNEL, None)


@callback
def _async_build(hass: HomeAssistant, *, degraded: bool) -> _Model:
    dev_reg = dr.async_get(hass)
    handles = {} if degraded else _handles(hass)
    hosts: list[_Host] = []
    connections: list[_Connection] = []
    pending_sub: list[tuple[str, dr.DeviceEntry]] = []

    for entry in hass.config_entries.async_entries(REOLINK_DOMAIN):
        handle = handles.get(entry.entry_id)
        devices = dr.async_entries_for_config_entry(dev_reg, entry.entry_id)
        has_children = any(d.via_device_id for d in devices)
        host_device: dr.DeviceEntry | None = None
        entry_connections: list[_Connection] = []
        for device in devices:
            ref = _classify(handle, device)
            if ref.role is DeviceRole.HOST:
                host_device = device
                is_nvr = handle.is_nvr if handle is not None else has_children
                if is_nvr:
                    kind: Literal["nvr", "hub"] = (
                        "hub" if handle is not None and handle.is_hub else "nvr"
                    )
                    hosts.append(
                        _Host(entry.entry_id, entry.title, device, kind, handle)
                    )
                else:
                    entry_connections.append(
                        _Connection(
                            entry.entry_id,
                            entry.title,
                            device,
                            "direct",
                            ref.channel,
                            None,
                            handle,
                        )
                    )
            elif ref.role is DeviceRole.CHANNEL:
                entry_connections.append(
                    _Connection(
                        entry.entry_id,
                        entry.title,
                        device,
                        "nvr",
                        ref.channel,
                        device.via_device_id,
                        handle,
                    )
                )
            else:
                pending_sub.append((entry.entry_id, device))
        if host_device is not None:
            for conn in entry_connections:
                if conn.via == "nvr":
                    conn.host_device_id = host_device.id
        connections.extend(entry_connections)

    # Lenses and chimes belong to the device they are linked to (via_device).
    owners: dict[str, _Host | _Connection] = {}
    for host in hosts:
        owners[host.device.id] = host
    for conn in connections:
        owners[conn.device.id] = conn
    for entry_id, device in pending_sub:
        owner = owners.get(device.via_device_id or "")
        if owner is None:
            owner = next((h for h in hosts if h.entry_id == entry_id), None)
        if owner is None:
            owner = next((c for c in connections if c.entry_id == entry_id), None)
        if owner is not None:
            owner.sub_devices.append(device)

    cameras = _merge(connections, handles.values())
    for camera in cameras:
        _mark_playback_source(camera)
    host_by_device = {h.device.id: h for h in hosts}
    for camera in cameras:
        for conn in camera.connections:
            if conn.host_device_id in host_by_device:
                host_by_device[conn.host_device_id].camera_ids.append(camera.id)
    return _Model(hosts, cameras, degraded=degraded or len(handles) == 0)


def _merge(
    connections: list[_Connection], handles: Iterable[ReolinkHostHandle]
) -> list[_Camera]:
    """Merge connections that reach the same physical camera."""
    groups = bridge.async_camera_groups(handles)
    cameras: list[_Camera] = []
    by_group: dict[str, _Camera] = {}
    for conn in connections:
        group_id = (
            groups.get((conn.entry_id, conn.channel))
            if conn.channel is not None
            else None
        )
        if group_id is None:
            cameras.append(_Camera([conn]))
            continue
        if (camera := by_group.get(group_id)) is None:
            camera = by_group[group_id] = _Camera([], group_id)
            cameras.append(camera)
        camera.connections.append(conn)
    for camera in cameras:
        # NVR connection first: it is the primary (and the playback source).
        camera.connections.sort(key=lambda c: (c.via != "nvr", c.entry_title))
    return cameras


def _mark_playback_source(camera: _Camera) -> None:
    for conn in camera.connections:
        if (
            conn.handle is not None
            and conn.channel is not None
            and conn.handle.records_locally(conn.channel)
        ):
            conn.playback_source = True
            return


def _reolink_entities(
    ent_reg: er.EntityRegistry, device_ids: Iterable[str]
) -> list[er.RegistryEntry]:
    entities: list[er.RegistryEntry] = []
    for device_id in device_ids:
        entities.extend(
            e
            for e in er.async_entries_for_device(
                ent_reg, device_id, include_disabled_entities=True
            )
            if e.platform == REOLINK_DOMAIN
        )
    return entities


def _entity_info(
    entity: er.RegistryEntry,
    catalog: Catalog,
    sub_devices: dict[str, dr.DeviceEntry],
) -> dict[str, Any]:
    key = catalog_key(
        entity.domain, entity.translation_key, entity.original_device_class
    )
    sub = sub_devices.get(entity.device_id or "")
    return {
        "entity_id": entity.entity_id,
        "domain": entity.domain,
        "key": key,
        "translation_key": entity.translation_key,
        "category": catalog.category(entity.domain, key),
        "entity_category": entity.entity_category,
        "disabled_by": entity.disabled_by,
        "hidden_by": entity.hidden_by,
        "name": entity.name or entity.original_name,
        "device_id": entity.device_id,
        "sub_device": _device_name(sub) if sub is not None else None,
    }


def _snapshot_entity(entities: list[er.RegistryEntry]) -> str | None:
    """Pick the enabled camera entity used for the Overview snapshot."""
    cameras = [e for e in entities if e.domain == "camera" and e.disabled_by is None]
    order = {key: i for i, key in enumerate(SNAPSHOT_PREFERENCE)}
    cameras.sort(key=lambda e: order.get(e.translation_key or "", len(order)))
    return cameras[0].entity_id if cameras else None


def _counts(entities: list[er.RegistryEntry]) -> dict[str, int]:
    disabled = sum(1 for e in entities if e.disabled_by is not None)
    return {"entities": len(entities), "disabled_entities": disabled}


def _connection_dict(
    conn: _Connection, hosts: dict[str, _Host], entities: list[er.RegistryEntry]
) -> dict[str, Any]:
    host = hosts.get(conn.host_device_id or "")
    return {
        "device_id": conn.device.id,
        "entry_id": conn.entry_id,
        "entry_title": conn.entry_title,
        "via": conn.via,
        "channel": conn.channel,
        "host_id": host.device.id if host is not None else None,
        "host_name": _device_name(host.device) if host is not None else None,
        "playback_source": conn.playback_source,
        **_counts(entities),
    }


def _camera_dict(
    camera: _Camera, hosts: dict[str, _Host], ent_reg: er.EntityRegistry
) -> dict[str, Any]:
    per_conn = {
        c.device.id: _reolink_entities(ent_reg, c.device_ids)
        for c in camera.connections
    }
    snapshot = None
    for conn in camera.connections:
        if (snapshot := _snapshot_entity(per_conn[conn.device.id])) is not None:
            break
    primary = camera.primary
    status: dict[str, Any] = {}
    if primary.handle is not None and primary.channel is not None:
        try:
            info = primary.handle.channel_details(primary.channel)
        except Exception as err:  # noqa: BLE001 - the registry info still works
            _LOGGER.debug("Cannot read channel details: %s", err)
        else:
            status = {
                "online": info["online"],
                "sleeping": info["sleeping"],
                "is_battery": info["is_battery"],
                "is_doorbell": info["is_doorbell"],
            }
    has_playback = any(c.playback_source for c in camera.connections)
    return {
        "id": camera.id,
        "kind": "camera",
        "group_id": camera.group_id,
        **_device_info(primary.device),
        "host_id": next(
            (
                hosts[c.host_device_id].device.id
                for c in camera.connections
                if c.host_device_id in hosts
            ),
            None,
        ),
        "connections": [
            _connection_dict(c, hosts, per_conn[c.device.id])
            for c in camera.connections
        ],
        "status": status,
        "primary_view": "live" if has_playback else "snapshot",
        "snapshot_entity_id": snapshot,
        **_counts([e for ents in per_conn.values() for e in ents]),
    }


def _host_dict(host: _Host, ent_reg: er.EntityRegistry) -> dict[str, Any]:
    entities = _reolink_entities(ent_reg, host.device_ids)
    return {
        "id": host.device.id,
        "kind": host.kind,
        "group_id": None,
        **_device_info(host.device),
        "entry_id": host.entry_id,
        "entry_title": host.entry_title,
        "camera_ids": host.camera_ids,
        **_counts(entities),
    }


def _playback_source(camera: _Camera) -> PlaybackSource | None:
    for conn in camera.connections:
        if conn.playback_source and conn.channel is not None:
            status: dict[str, Any] = {}
            if conn.handle is not None:
                try:
                    status = conn.handle.channel_details(conn.channel)
                except Exception:  # flags are optional
                    _LOGGER.debug("Cannot read channel details", exc_info=True)
            return PlaybackSource(
                camera_id=camera.id,
                name=_device_name(camera.primary.device) or camera.primary.entry_title,
                entry_id=conn.entry_id,
                channel=conn.channel,
                is_doorbell=bool(status.get("is_doorbell")),
                is_battery=bool(status.get("is_battery")),
            )
    return None


@callback
def async_playback_source(hass: HomeAssistant, device_id: str) -> PlaybackSource:
    """Return where a camera's recordings are; ``device_id`` as in async_device."""
    model = _async_build(hass, degraded=False)
    for camera in model.cameras:
        if any(device_id in c.device_ids for c in camera.connections) or (
            device_id == camera.group_id
        ):
            if (source := _playback_source(camera)) is None:
                raise NoPlaybackError(device_id)
            return source
    raise DeviceNotFoundError(device_id)


def _live_source(camera: _Camera, conn: _Connection) -> LiveSource | None:
    if conn.channel is None or conn.handle is None:
        return None
    try:
        battery = bool(conn.handle.channel_details(conn.channel).get("is_battery"))
    except Exception:  # flags are optional
        _LOGGER.debug("Cannot read channel details", exc_info=True)
        battery = False
    return LiveSource(
        camera_id=camera.id,
        connection_id=conn.device.id,
        name=_device_name(camera.primary.device) or camera.primary.entry_title,
        entry_id=conn.entry_id,
        channel=conn.channel,
        via=conn.via,
        is_battery=battery,
    )


@callback
def async_live_source(hass: HomeAssistant, connection_id: str) -> LiveSource:
    """Return one connection of a camera (by its device id) as a live source."""
    model = _async_build(hass, degraded=False)
    for camera in model.cameras:
        for conn in camera.connections:
            if conn.device.id == connection_id:
                if (source := _live_source(camera, conn)) is None:
                    raise DeviceNotFoundError(connection_id)
                return source
    raise DeviceNotFoundError(connection_id)


@callback
def async_host_live_sources(hass: HomeAssistant, host_id: str) -> list[LiveSource]:
    """Return the cameras of an NVR or Hub (by its device id) as live sources.

    A camera added directly is its own host: its id gives its one connection.
    """
    model = _async_build(hass, degraded=False)
    host = next((h for h in model.hosts if h.device.id == host_id), None)
    sources: list[LiveSource] = []
    for camera in model.cameras:
        for conn in camera.connections:
            if host is not None:
                mine = conn.via == "nvr" and conn.entry_id == host.entry_id
            else:
                mine = conn.via == "direct" and conn.device.id == host_id
            if mine and (source := _live_source(camera, conn)) is not None:
                sources.append(source)
    return sorted(sources, key=lambda s: s.channel)


@callback
def async_live_cameras(hass: HomeAssistant) -> list[dict[str, Any]]:
    """Return every camera with its connections, streams and HA camera entities.

    Each connection lists, per live stream it can serve, the configured
    encoding and the enabled camera entity showing it in Home Assistant's own
    view (if any).
    """
    model = _async_build(hass, degraded=False)
    ent_reg = er.async_get(hass)
    cameras = []
    for camera in model.cameras:
        connections = []
        for conn in camera.connections:
            if (source := _live_source(camera, conn)) is None:
                continue
            entities = {
                e.translation_key: e.entity_id
                for e in _reolink_entities(ent_reg, conn.device_ids)
                if e.domain == "camera"
                and e.disabled_by is None
                and e.translation_key in LIVE_STREAMS
            }
            try:
                encodings = (
                    conn.handle.channel_details(conn.channel)["encodings"]
                    if conn.handle is not None and conn.channel is not None
                    else {}
                )
            except Exception:  # encodings are optional
                _LOGGER.debug("Cannot read encodings", exc_info=True)
                encodings = {}
            protocols = (
                conn.handle.live_protocols()
                if conn.handle is not None
                else frozenset(bridge.LiveProtocol)
            )
            connections.append(
                {
                    "connection_id": source.connection_id,
                    "via": source.via,
                    "entry_title": conn.entry_title,
                    "is_battery": source.is_battery,
                    "streams": {
                        stream: {
                            "encoding": encodings.get(stream),
                            "entity_id": entities.get(stream),
                        }
                        for stream in LIVE_STREAMS
                        if LIVE_PROTOCOLS[stream] in protocols
                    },
                }
            )
        if connections:
            cameras.append(
                {
                    "id": camera.id,
                    "name": _device_name(camera.primary.device)
                    or camera.primary.entry_title,
                    "model": camera.primary.device.model,
                    "records": any(c.playback_source for c in camera.connections),
                    "connections": connections,
                }
            )
    return cameras


@callback
def async_playback_sources(hass: HomeAssistant) -> list[PlaybackSource]:
    """Return the playback source of every camera that records."""
    model = _async_build(hass, degraded=False)
    return [s for c in model.cameras if (s := _playback_source(c)) is not None]


@callback
def async_device_list(hass: HomeAssistant, *, degraded: bool) -> dict[str, Any]:
    """Return every Reolink device: hosts (NVR/Hub) and cameras (merged)."""
    model = _async_build(hass, degraded=degraded)
    ent_reg = er.async_get(hass)
    hosts = {h.device.id: h for h in model.hosts}
    return {
        "degraded": model.degraded,
        "hosts": [_host_dict(h, ent_reg) for h in model.hosts],
        "cameras": [_camera_dict(c, hosts, ent_reg) for c in model.cameras],
    }


def _details(
    conn_handle: ReolinkHostHandle | None, channel: int | None
) -> dict[str, Any] | None:
    if conn_handle is None:
        return None
    try:
        return {
            "host": conn_handle.host_details(),
            "channel": (
                conn_handle.channel_details(channel) if channel is not None else None
            ),
        }
    except Exception as err:  # noqa: BLE001 - details are optional
        _LOGGER.warning("Cannot read Reolink device details: %s", err)
        return None


@callback
def async_device(
    hass: HomeAssistant, catalog: Catalog, device_id: str, *, degraded: bool
) -> dict[str, Any]:
    """Return one device node with its details and entities, per connection.

    ``device_id`` may be the node id or the id of any device that belongs to
    it (another connection, a lens or a chime).
    """
    model = _async_build(hass, degraded=degraded)
    ent_reg = er.async_get(hass)
    hosts = {h.device.id: h for h in model.hosts}

    for host in model.hosts:
        if device_id in host.device_ids:
            entities = _reolink_entities(ent_reg, host.device_ids)
            sub = {d.id: d for d in host.sub_devices}
            return {
                "degraded": model.degraded,
                "node": _host_dict(host, ent_reg),
                "connections": [
                    {
                        "device_id": host.device.id,
                        "entry_title": host.entry_title,
                        "via": "direct",
                        "details": _details(host.handle, None),
                        "entities": [_entity_info(e, catalog, sub) for e in entities],
                    }
                ],
            }

    for camera in model.cameras:
        if any(device_id in c.device_ids for c in camera.connections) or (
            device_id == camera.group_id
        ):
            connections = []
            for conn in camera.connections:
                sub = {d.id: d for d in conn.sub_devices}
                entities = _reolink_entities(ent_reg, conn.device_ids)
                connections.append(
                    {
                        **_connection_dict(conn, hosts, entities),
                        "details": _details(conn.handle, conn.channel),
                        "entities": [_entity_info(e, catalog, sub) for e in entities],
                    }
                )
            return {
                "degraded": model.degraded,
                "node": _camera_dict(camera, hosts, ent_reg),
                "connections": connections,
            }
    raise DeviceNotFoundError(device_id)

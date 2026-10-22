"""Websocket commands for live view (``reolink_viewer/live/*``).

- ``live/status``: go2rtc's state (and, for admins, its last log lines).
- ``live/cameras``: every camera's connections and streams, with the Home
  Assistant camera entity of each (the live check compares against them).
- ``live/webrtc``: a WebRTC session, as a subscription. The browser's offer
  goes to go2rtc with Home Assistant's ICE servers (``web_rtc``, which adds
  Nabu Casa's TURN for subscribers); go2rtc's answer and ICE candidates come
  back as events, the browser's candidates go through ``live/candidate``
  (trickle ICE). Unsubscribing ends the session.
- ``live/mse`` and ``live/frame``: signed URLs of the MSE websocket and of a
  frame (see live/views).
- ``live/images``: the cameras' last pictures (``images.py``), as a
  subscription: an event with every camera's signed picture URL, then one
  per new picture. While anyone subscribes, pictures are taken.
- ``live/state``: whether a stream is running in go2rtc (no source URL), and
  its key-frame cache.
- ``live/preload`` (admin): keep a stream warm (its feed open, a key frame
  cached), or stop.
- ``live/capacity`` (admin): the capacity test of a host, as a subscription.
"""

import asyncio
from datetime import timedelta
import json
import logging
from typing import Any

from aiohttp import WSMsgType
import probatio

from custom_components.reolink_viewer import devices
from custom_components.reolink_viewer.const import DOMAIN
from custom_components.reolink_viewer.models import ReolinkViewerConfigEntry
from custom_components.reolink_viewer.views import LiveGrant, LiveImageGrant, sign
from homeassistant.components import websocket_api
from homeassistant.components.web_rtc import async_get_ice_servers
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.util.ssl import SSLCipherList

from .capacity import CapacityError, CapacityTest
from .go2rtc import Go2rtcError, redact
from .images import CameraImage
from .service import MAX_EARLY_CANDIDATES, LiveService, WebRtcSession
from .streams import LiveError, LiveStream
from .views import LIVE_FRAME_PATH, LIVE_IMAGE_PATH, LIVE_MSE_PATH

_LOGGER = logging.getLogger(__name__)

ERR_NOT_LOADED = "not_loaded"
ERR_LIVE = "live_failed"
STREAM = probatio.In(list(devices.LIVE_STREAMS))
# A signed live URL only has to last until the browser opens it.
LIVE_URL_TTL = timedelta(minutes=2)
# A picture's URL lasts while a page may show it (a new picture, a new URL).
LIVE_IMAGE_TTL = timedelta(minutes=10)


@callback
def async_register_live_commands(hass: HomeAssistant) -> None:
    """Register the live view commands."""
    for command in (
        ws_live_status,
        ws_live_cameras,
        ws_live_webrtc,
        ws_live_candidate,
        ws_live_mse,
        ws_live_frame,
        ws_live_images,
        ws_live_state,
        ws_live_preload,
        ws_live_capacity,
    ):
        websocket_api.async_register_command(hass, command)


def _live(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg_id: int
) -> tuple[ReolinkViewerConfigEntry, LiveService] | None:
    entries: list[ReolinkViewerConfigEntry] = hass.config_entries.async_loaded_entries(
        DOMAIN
    )
    if not entries or entries[0].runtime_data.live is None:
        connection.send_error(msg_id, ERR_NOT_LOADED, "Reolink Viewer is not loaded")
        return None
    return entries[0], entries[0].runtime_data.live


def _stream(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> LiveStream | None:
    """Resolve a camera connection and stream, or send the error."""
    try:
        source = devices.async_live_source(hass, msg["connection_id"])
    except devices.DeviceNotFoundError:
        connection.send_error(
            msg["id"], websocket_api.ERR_NOT_FOUND, "Camera connection not found"
        )
        return None
    return LiveStream(source, msg["stream"])


_STREAM_SCHEMA: dict[probatio.Marker | str, Any] = {
    probatio.Required("connection_id"): str,
    probatio.Required("stream"): STREAM,
}


@callback
@websocket_api.websocket_command({probatio.Required("type"): f"{DOMAIN}/live/status"})
def ws_live_status(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return go2rtc's state and the running streams."""
    if (resolved := _live(hass, connection, msg["id"])) is None:
        return
    admin = bool(connection.user and connection.user.is_admin)
    connection.send_result(msg["id"], resolved[1].status(admin=admin))


@callback
@websocket_api.websocket_command({probatio.Required("type"): f"{DOMAIN}/live/cameras"})
def ws_live_cameras(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return every camera's connections and live streams."""
    if _live(hass, connection, msg["id"]) is None:
        return
    connection.send_result(msg["id"], {"cameras": devices.async_live_cameras(hass)})


@websocket_api.websocket_command(
    {
        probatio.Required("type"): f"{DOMAIN}/live/webrtc",
        **_STREAM_SCHEMA,
        probatio.Required("offer"): str,
    }
)
@websocket_api.async_response
async def ws_live_webrtc(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Start a WebRTC session; events: session, answer, candidate, error, closed."""
    if (resolved := _live(hass, connection, msg["id"])) is None:
        return
    if (stream := _stream(hass, connection, msg)) is None:
        return
    live = resolved[1]
    session = live.new_session(id(connection))

    def send(event: dict[str, Any]) -> None:
        connection.send_message(websocket_api.event_message(msg["id"], event))

    async def run() -> None:
        began = asyncio.get_running_loop().time()

        def elapsed() -> float:
            return round((asyncio.get_running_loop().time() - began) * 1000, 1)

        hold = None
        try:
            server = await live.async_server()
            hold = await live.registry.async_hold(stream)
            timing = {"hold_ms": elapsed()}
            async with server.ws(stream.name) as ws:
                await ws.send_json(
                    {
                        "type": "webrtc",
                        "value": {
                            "type": "offer",
                            "sdp": msg["offer"],
                            "ice_servers": _ice_servers(hass),
                        },
                    }
                )
                # The browser's candidates follow the offer, never precede it.
                while session.early:
                    candidate = session.early.pop(0)
                    await ws.send_json({"type": "webrtc/candidate", "value": candidate})
                session.ws = ws
                async for message in ws:
                    if message.type is not WSMsgType.TEXT:
                        break
                    event = _relay(message.data, timing, elapsed)
                    if event is not None:
                        send(event)
                        if event["type"] == "error":
                            # go2rtc gave up on the session (e.g. no codec in common).
                            break
                # Over: no more candidates for it, while the socket closes.
                live.sessions.pop(session.session_id, None)
            send({"type": "closed"})
        except (LiveError, Go2rtcError) as err:
            send({"type": "error", "message": redact(str(err))})
        finally:
            live.sessions.pop(session.session_id, None)
            if hold is not None:
                hold.release()

    # Ack first: the task starts eagerly and may send events right away.
    connection.send_result(msg["id"])
    send({"type": "session", "session_id": session.session_id})
    task = hass.async_create_background_task(run(), "reolink_viewer live webrtc")
    connection.subscriptions[msg["id"]] = task.cancel


def _relay(data: str, timing: dict[str, float], elapsed: Any) -> dict[str, Any] | None:
    """Turn a go2rtc websocket message into an event for the browser."""
    try:
        message = json.loads(data)
    except ValueError:
        return None
    if not isinstance(message, dict):
        return None
    kind, value = message.get("type"), message.get("value")
    if kind == "webrtc" and isinstance(value, dict) and value.get("type") == "answer":
        timing["answer_ms"] = elapsed()
        return {"type": "answer", "sdp": str(value.get("sdp", "")), "timing": timing}
    if kind == "webrtc/candidate" and isinstance(value, str):
        return {"type": "candidate", "candidate": value}
    if kind == "error":
        return {"type": "error", "message": redact(str(value))}
    return None


def _ice_servers(hass: HomeAssistant) -> list[dict[str, Any]]:
    """Home Assistant's ICE servers, as go2rtc wants them (URLs as a list)."""
    servers = []
    for server in async_get_ice_servers(hass):
        item = server.to_dict()
        urls = item.get("urls")
        item["urls"] = [urls] if isinstance(urls, str) else list(urls or [])
        servers.append(item)
    return servers


@websocket_api.websocket_command(
    {
        probatio.Required("type"): f"{DOMAIN}/live/candidate",
        probatio.Required("session_id"): str,
        probatio.Required("candidate"): str,
    }
)
@websocket_api.async_response
async def ws_live_candidate(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Pass a browser's ICE candidate to go2rtc (trickle ICE)."""
    if (resolved := _live(hass, connection, msg["id"])) is None:
        return
    session: WebRtcSession | None = resolved[1].sessions.get(msg["session_id"])
    if session is None or session.owner != id(connection):
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "No such session")
        return
    if session.ws is None:
        if len(session.early) < MAX_EARLY_CANDIDATES:
            session.early.append(msg["candidate"])
    else:
        try:
            await session.ws.send_json(
                {"type": "webrtc/candidate", "value": msg["candidate"]}
            )
        except ConnectionError:
            connection.send_error(
                msg["id"], websocket_api.ERR_NOT_FOUND, "The session has ended"
            )
            return
    connection.send_result(msg["id"])


def _signed(
    hass: HomeAssistant,
    live_entry: ReolinkViewerConfigEntry,
    base: str,
    stream: LiveStream,
) -> str:
    token = live_entry.runtime_data.grants.issue(LiveGrant(stream), LIVE_URL_TTL)
    return sign(hass, base, token, LIVE_URL_TTL)


@callback
@websocket_api.websocket_command(
    {probatio.Required("type"): f"{DOMAIN}/live/mse", **_STREAM_SCHEMA}
)
def ws_live_mse(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return the signed path of a stream's MSE websocket."""
    if (resolved := _live(hass, connection, msg["id"])) is None:
        return
    if (stream := _stream(hass, connection, msg)) is None:
        return
    connection.send_result(
        msg["id"], {"path": _signed(hass, resolved[0], LIVE_MSE_PATH, stream)}
    )


@callback
@websocket_api.websocket_command(
    {probatio.Required("type"): f"{DOMAIN}/live/frame", **_STREAM_SCHEMA}
)
def ws_live_frame(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return the signed path of a frame of a stream."""
    if (resolved := _live(hass, connection, msg["id"])) is None:
        return
    if (stream := _stream(hass, connection, msg)) is None:
        return
    connection.send_result(
        msg["id"], {"path": _signed(hass, resolved[0], LIVE_FRAME_PATH, stream)}
    )


@callback
@websocket_api.websocket_command({probatio.Required("type"): f"{DOMAIN}/live/images"})
def ws_live_images(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Watch the cameras' last pictures (signed URLs), as a subscription."""
    if (resolved := _live(hass, connection, msg["id"])) is None:
        return
    live_entry, live = resolved
    # Later events are sent from a background task: sign for this user.
    refresh_token_id = connection.refresh_token_id

    def describe(camera_id: str, image: CameraImage) -> dict[str, Any]:
        token = live_entry.runtime_data.grants.issue(
            LiveImageGrant(camera_id), LIVE_IMAGE_TTL
        )
        url = sign(
            hass,
            LIVE_IMAGE_PATH,
            token,
            LIVE_IMAGE_TTL,
            refresh_token_id=refresh_token_id,
        )
        return {"url": url, "taken": round(image.taken * 1000)}

    @callback
    def new_image(camera_id: str, image: CameraImage) -> None:
        connection.send_message(
            websocket_api.event_message(
                msg["id"], {"images": {camera_id: describe(camera_id, image)}}
            )
        )

    watch = live.images.watch(new_image)
    connection.subscriptions[msg["id"]] = watch.close
    connection.send_result(msg["id"])
    connection.send_message(
        websocket_api.event_message(
            msg["id"],
            {
                "images": {
                    camera_id: describe(camera_id, image)
                    for camera_id, image in live.images.images().items()
                }
            },
        )
    )


@websocket_api.websocket_command(
    {probatio.Required("type"): f"{DOMAIN}/live/state", **_STREAM_SCHEMA}
)
@websocket_api.async_response
async def ws_live_state(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return whether a stream runs in go2rtc, who holds it, and its cache."""
    if (resolved := _live(hass, connection, msg["id"])) is None:
        return
    if (stream := _stream(hass, connection, msg)) is None:
        return
    live = resolved[1]
    try:
        server = await live.async_server()
        state = await server.async_stream_state(stream.name)
    except Go2rtcError as err:
        connection.send_error(msg["id"], ERR_LIVE, redact(str(err)))
        return
    connection.send_result(
        msg["id"],
        {
            "state": state,
            "holds": live.registry.running().get(stream.name, 0),
            "preloaded": stream.name in live.relay.warm_streams(),
            "cache": live.relay.state(stream),
        },
    )


@websocket_api.websocket_command(
    {
        probatio.Required("type"): f"{DOMAIN}/live/preload",
        **_STREAM_SCHEMA,
        probatio.Required("enabled"): bool,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_live_preload(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Keep a stream warm (its feed open, a key frame cached), or stop.

    Turning it on returns once the first key frame is cached (or after
    ``relay.KEY_FRAME_TIMEOUT``); ``key_frame`` says whether one is.
    """
    if (resolved := _live(hass, connection, msg["id"])) is None:
        return
    if (stream := _stream(hass, connection, msg)) is None:
        return
    live = resolved[1]
    try:
        await live.async_server()
        key_frame = await live.relay.async_keep_warm(stream, msg["enabled"])
    except (LiveError, Go2rtcError) as err:
        connection.send_error(msg["id"], ERR_LIVE, redact(str(err)))
        return
    connection.send_result(
        msg["id"], {"preloaded": live.relay.warm_streams(), "key_frame": key_frame}
    )


@websocket_api.websocket_command(
    {
        probatio.Required("type"): f"{DOMAIN}/live/capacity",
        probatio.Required("host_id"): str,
        probatio.Optional("include_main", default=True): bool,
        probatio.Optional("include_fill", default=True): bool,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_live_capacity(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Run the capacity test of a host; events: progress, then result or error."""
    if (resolved := _live(hass, connection, msg["id"])) is None:
        return
    entry, live = resolved
    sources = devices.async_host_live_sources(hass, msg["host_id"])
    if not sources:
        connection.send_error(
            msg["id"], websocket_api.ERR_NOT_FOUND, "No cameras on that host"
        )
        return

    if live.capacity_lock.locked():
        connection.send_error(msg["id"], ERR_LIVE, "A capacity test is running")
        return

    def send(event: dict[str, Any]) -> None:
        connection.send_message(websocket_api.event_message(msg["id"], event))

    async def run() -> None:
        async with live.capacity_lock:
            await test()

    async def test() -> None:
        try:
            server = await live.async_server()
            test = CapacityTest(
                hass,
                entry.runtime_data.scheduler,
                server,
                async_get_clientsession(
                    hass, verify_ssl=False, ssl_cipher=SSLCipherList.INSECURE
                ),
                sources,
                include_main=msg["include_main"],
                include_fill=msg["include_fill"],
                progress=lambda text: send({"type": "progress", "message": text}),
            )
            send({"type": "result", "report": await test.async_run()})
        except (CapacityError, LiveError, Go2rtcError) as err:
            send({"type": "error", "message": redact(str(err))})
        except Exception as err:
            _LOGGER.exception("Live capacity test failed")
            send({"type": "error", "message": redact(str(err) or type(err).__name__)})

    connection.send_result(msg["id"])
    task = hass.async_create_background_task(run(), "reolink_viewer live capacity")
    connection.subscriptions[msg["id"]] = task.cancel

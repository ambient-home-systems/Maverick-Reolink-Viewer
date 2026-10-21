"""Live views behind signed URLs: MSE through go2rtc's websocket, and frames.

- ``/api/reolink_viewer/live/mse/{token}`` is a websocket the browser opens
  with a signed URL (a browser's WebSocket cannot send HA's token). It pipes
  go2rtc's ``/api/ws`` for the one stream the grant names: the browser may
  only ask for MSE (``{"type": "mse", ...}``); everything go2rtc sends comes
  back, the media as binary messages. While it is open the stream is held
  (one slot of the host's stream budget).
- ``/api/reolink_viewer/live/frame/{token}`` returns a JPEG of a stream from
  go2rtc (from the running stream at once; a stream that is not running
  starts and waits for a key frame).

No camera URL, address or credential is in either: the grant names a stream,
and go2rtc is reached on 127.0.0.1 with its own credentials.
"""

import asyncio
from http import HTTPStatus
import json
import logging

from aiohttp import ClientWebSocketResponse, WSMsgType, web

from custom_components.reolink_viewer.views import LiveGrant, loaded_data
from homeassistant.components.http import HomeAssistantView
from homeassistant.core import HomeAssistant

from .go2rtc import Go2rtcError, redact
from .streams import LiveError

_LOGGER = logging.getLogger(__name__)

LIVE_MSE_PATH = "/api/reolink_viewer/live/mse"
LIVE_FRAME_PATH = "/api/reolink_viewer/live/frame"
FRAME_TIMEOUT = 20.0
# The browser's MSE request: {"type": "mse", "value": "<codecs>"}.
MAX_REQUEST = 2048


class LiveMseView(HomeAssistantView):
    """Pipe go2rtc's MSE for one stream to the browser."""

    url = LIVE_MSE_PATH + "/{token}"
    name = "api:reolink_viewer:live_mse"
    requires_auth = True

    async def get(self, request: web.Request, token: str) -> web.StreamResponse:
        """Open the websocket and pipe it."""
        hass: HomeAssistant = request.app["hass"]
        data = loaded_data(hass)
        grant = data.grants.get(token, LiveGrant) if data is not None else None
        if data is None or grant is None or data.live is None:
            return web.Response(
                status=HTTPStatus.NOT_FOUND, text="Not found or expired"
            )
        live = data.live
        browser = web.WebSocketResponse(heartbeat=30.0, max_msg_size=MAX_REQUEST)
        await browser.prepare(request)
        hold = None
        try:
            server = await live.async_server()
            hold = await live.registry.async_hold(grant.stream)
            async with server.ws(grant.stream.name) as upstream:
                await _pipe(browser, upstream)
        except (LiveError, Go2rtcError) as err:
            if not browser.closed:
                await browser.send_json({"type": "error", "value": redact(str(err))})
        finally:
            if hold is not None:
                hold.release()
            await browser.close()
        return browser


async def _pipe(
    browser: web.WebSocketResponse, upstream: ClientWebSocketResponse
) -> None:
    """Relay until either side closes: MSE requests up, everything down."""

    async def up() -> None:
        async for msg in browser:
            if msg.type is not WSMsgType.TEXT:
                continue
            try:
                request = json.loads(msg.data)
            except ValueError:
                continue
            if isinstance(request, dict) and request.get("type") == "mse":
                value = request.get("value")
                await upstream.send_json(
                    {"type": "mse", "value": value if isinstance(value, str) else ""}
                )

    async def down() -> None:
        async for msg in upstream:
            if msg.type is WSMsgType.BINARY:
                await browser.send_bytes(msg.data)
            elif msg.type is WSMsgType.TEXT:
                await browser.send_str(_safe_text(msg.data))
            else:
                break

    tasks = [asyncio.create_task(up()), asyncio.create_task(down())]
    try:
        await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
    finally:
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)


def _safe_text(text: str) -> str:
    """go2rtc's error messages may name the camera URL: redact them."""
    try:
        message = json.loads(text)
    except ValueError:
        return json.dumps({"type": "error", "value": redact(text)})
    if isinstance(message, dict) and message.get("type") == "error":
        message["value"] = redact(str(message.get("value", "")))
        return json.dumps(message)
    return text


class LiveFrameView(HomeAssistantView):
    """A JPEG of a live stream, from go2rtc."""

    url = LIVE_FRAME_PATH + "/{token}"
    name = "api:reolink_viewer:live_frame"
    requires_auth = True

    async def get(self, request: web.Request, token: str) -> web.Response:
        """Return the frame."""
        hass: HomeAssistant = request.app["hass"]
        data = loaded_data(hass)
        grant = data.grants.get(token, LiveGrant) if data is not None else None
        if data is None or grant is None or data.live is None:
            return web.Response(
                status=HTTPStatus.NOT_FOUND, text="Not found or expired"
            )
        live = data.live
        hold = None
        try:
            server = await live.async_server()
            hold = await live.registry.async_hold(grant.stream)
            async with server.request(
                "GET",
                "/api/frame.jpeg",
                {"src": grant.stream.name},
                timeout=FRAME_TIMEOUT,
            ) as response:
                body = await response.read()
                if response.status != 200:
                    raise Go2rtcError(f"HTTP {response.status}")
        except (LiveError, Go2rtcError, TimeoutError) as err:
            return web.Response(
                status=HTTPStatus.BAD_GATEWAY, text=redact(str(err) or "timeout")
            )
        finally:
            if hold is not None:
                hold.release()
        return web.Response(
            body=body,
            content_type="image/jpeg",
            headers={"Cache-Control": "private, no-store"},
        )

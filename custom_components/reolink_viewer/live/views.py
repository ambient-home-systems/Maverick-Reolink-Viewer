"""Live views behind signed URLs: MSE from the key-frame cache, and frames.

- ``/api/reolink_viewer/live/mse/{token}`` is a websocket the browser opens
  with a signed URL (a browser's WebSocket cannot send HA's token), for the one
  stream the grant names. It speaks go2rtc's MSE protocol: the browser sends
  ``{"type": "mse", "value": <codecs it plays>}``, and gets
  ``{"type": "mse", "value": <MIME type>}``, then the media as binary messages
  (the init segment and the cached key frame onwards at once, then the rest
  as it comes), or ``{"type": "error", ...}``. It joins the stream's shared
  feed (``relay.py``), which holds the stream while it runs.
- ``/api/reolink_viewer/live/frame/{token}`` returns a JPEG of a stream from
  go2rtc (from the running stream at once; a stream that is not running
  starts and waits for a key frame).
- ``/api/reolink_viewer/live/image/{token}`` returns a camera's last picture
  from memory (``images.py``); it never reaches the camera.

No camera URL, address or credential is in any of them: the grant names a
stream or a camera, and go2rtc is reached on 127.0.0.1 with its own
credentials.
"""

import asyncio
from http import HTTPStatus
import json
import logging

from aiohttp import WSMsgType, web

from custom_components.reolink_viewer.views import (
    LiveGrant,
    LiveImageGrant,
    loaded_data,
)
from homeassistant.components.http import HomeAssistantView
from homeassistant.core import HomeAssistant

from .go2rtc import Go2rtcError, redact
from .relay import Viewer
from .streams import LiveError

_LOGGER = logging.getLogger(__name__)

LIVE_MSE_PATH = "/api/reolink_viewer/live/mse"
LIVE_FRAME_PATH = "/api/reolink_viewer/live/frame"
LIVE_IMAGE_PATH = "/api/reolink_viewer/live/image"
FRAME_TIMEOUT = 20.0
# The browser's MSE request: {"type": "mse", "value": "<codecs>"}.
MAX_REQUEST = 2048
REQUEST_TIMEOUT = 10.0


class LiveMseView(HomeAssistantView):
    """MSE for one stream, from its shared feed."""

    url = LIVE_MSE_PATH + "/{token}"
    name = "api:reolink_viewer:live_mse"
    requires_auth = True

    async def get(self, request: web.Request, token: str) -> web.StreamResponse:
        """Open the websocket and feed it."""
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
        viewer: Viewer | None = None
        try:
            codecs = await _mse_request(browser)
            if codecs is not None:
                viewer = await live.relay.async_attach(grant.stream, codecs)
                await browser.send_json({"type": "mse", "value": viewer.mime})
                await _feed(browser, viewer)
        except (LiveError, Go2rtcError) as err:
            if not browser.closed:
                await browser.send_json({"type": "error", "value": redact(str(err))})
        finally:
            if viewer is not None:
                viewer.detach()
            await browser.close()
        return browser


async def _mse_request(browser: web.WebSocketResponse) -> str | None:
    """Return the codecs of the browser's MSE request; None if it left."""
    try:
        async with asyncio.timeout(REQUEST_TIMEOUT):
            async for msg in browser:
                if msg.type is not WSMsgType.TEXT:
                    continue
                try:
                    request = json.loads(msg.data)
                except ValueError:
                    continue
                if isinstance(request, dict) and request.get("type") == "mse":
                    value = request.get("value")
                    return value if isinstance(value, str) else ""
    except TimeoutError:
        raise LiveError("no MSE request") from None
    return None


async def _feed(browser: web.WebSocketResponse, viewer: Viewer) -> None:
    """Send the viewer's media until either side stops."""

    async def down() -> None:
        while (data := await viewer.next()) is not None:
            await browser.send_bytes(data)
        if viewer.error is not None and not browser.closed:
            await browser.send_json({"type": "error", "value": viewer.error})

    async def up() -> None:
        async for _msg in browser:
            pass  # nothing more is asked over MSE; this notices the close

    tasks = [asyncio.create_task(down()), asyncio.create_task(up())]
    try:
        await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
    finally:
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)


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


class LiveImageView(HomeAssistantView):
    """A camera's last picture, from memory."""

    url = LIVE_IMAGE_PATH + "/{token}"
    name = "api:reolink_viewer:live_image"
    requires_auth = True

    async def get(self, request: web.Request, token: str) -> web.Response:
        """Return the picture."""
        hass: HomeAssistant = request.app["hass"]
        data = loaded_data(hass)
        grant = data.grants.get(token, LiveImageGrant) if data is not None else None
        image = (
            data.live.images.get(grant.camera_id)
            if data is not None and data.live is not None and grant is not None
            else None
        )
        if image is None:
            return web.Response(
                status=HTTPStatus.NOT_FOUND, text="Not found or expired"
            )
        return web.Response(
            body=image.data,
            content_type="image/jpeg",
            # Each new picture gets a new URL.
            headers={"Cache-Control": "private, max-age=600"},
        )

"""HTTP views for recordings, clips and thumbnails, behind signed URLs.

The browser never sees a camera URL or a recording's file name: a websocket
command issues a *grant* (what may be fetched) under a random token and
returns a path signed with HA's ``async_sign_path``. Both the signature and
the grant expire.

- ``/api/reolink_viewer/vod/{token}`` serves a recording as ``video/mp4`` from
  the disk cache, with Range. While the cache is still filling, a request from
  the start gets the file progressively (200, chunked, for browsers that play
  while downloading); any other request waits for the file to complete.
- A URL issued after the cache rewrote the recording as a plain MP4 gets that
  file; one issued before keeps the original. Issuing a URL *leases* the
  recording (``VodCache.lease``): it is not evicted, and the URL's file is
  neither swapped nor deleted, until the URL expires.
- ``/api/reolink_viewer/clip/{token}`` serves the same file as a download.
- ``/api/reolink_viewer/thumb/{token}`` serves a timeline thumbnail (JPEG).
"""

import asyncio
from dataclasses import dataclass
from datetime import timedelta
from http import HTTPStatus
import logging
import secrets
import time
from typing import TYPE_CHECKING

from aiohttp import web

from homeassistant.components.http import HomeAssistantView
from homeassistant.components.http.auth import async_sign_path
from homeassistant.core import HomeAssistant

from .const import DOMAIN
from .scheduler import Priority
from .thumbnails import ThumbKey, ThumbnailError
from .vodcache import Entry, Recording, VodCacheError

if TYPE_CHECKING:
    from .models import ReolinkViewerData

_LOGGER = logging.getLogger(__name__)

VOD_PATH = "/api/reolink_viewer/vod"
CLIP_PATH = "/api/reolink_viewer/clip"
THUMB_PATH = "/api/reolink_viewer/thumb"
VOD_TTL = timedelta(minutes=30)
THUMB_TTL = timedelta(minutes=10)
COMPLETE_TIMEOUT = 600.0
MAX_GRANTS = 5000


@dataclass(frozen=True, slots=True)
class VodGrant:
    """Permission to fetch one recording."""

    recording: Recording
    progressive: bool
    download_name: str
    # Bound to the plain copy (True) or the original (VodCache.lease).
    flat: bool = False


@dataclass(frozen=True, slots=True)
class ThumbGrant:
    """Permission to fetch one thumbnail."""

    key: ThumbKey


class Grants:
    """Short-lived, unguessable tokens for what a signed URL may fetch."""

    def __init__(self) -> None:
        """Initialize the registry."""
        self._items: dict[str, tuple[float, VodGrant | ThumbGrant]] = {}

    def issue(self, grant: VodGrant | ThumbGrant, ttl: timedelta) -> str:
        """Store a grant and return its token."""
        now = time.monotonic()
        if len(self._items) >= MAX_GRANTS:
            self._items = {k: v for k, v in self._items.items() if v[0] > now}
            while len(self._items) >= MAX_GRANTS:
                self._items.pop(next(iter(self._items)))
        token = secrets.token_urlsafe(18)
        self._items[token] = (now + ttl.total_seconds(), grant)
        return token

    def get[T: (VodGrant, ThumbGrant)](self, token: str, kind: type[T]) -> T | None:
        """Return a live grant of the given kind."""
        item = self._items.get(token)
        if item is None:
            return None
        expires, grant = item
        if expires < time.monotonic():
            del self._items[token]
            return None
        return grant if isinstance(grant, kind) else None


def sign(hass: HomeAssistant, base: str, token: str, ttl: timedelta) -> str:
    """Return a signed path (bound to the current websocket user)."""
    return str(async_sign_path(hass, f"{base}/{token}", ttl))


def _data(hass: HomeAssistant) -> ReolinkViewerData | None:
    entries = hass.config_entries.async_loaded_entries(DOMAIN)
    if not entries:
        return None
    data: ReolinkViewerData = entries[0].runtime_data
    return data


def _not_found() -> web.Response:
    return web.Response(status=HTTPStatus.NOT_FOUND, text="Not found or expired")


class _Base(HomeAssistantView):
    requires_auth = True

    async def _vod(
        self, request: web.Request, token: str, *, download: bool
    ) -> web.StreamResponse:
        hass: HomeAssistant = request.app["hass"]
        if (data := _data(hass)) is None:
            return _not_found()
        grant = data.grants.get(token, VodGrant)
        if grant is None:
            return _not_found()
        cache = data.vod_cache
        try:
            entry = await cache.async_open(grant.recording, Priority.PLAYBACK)
            headers: dict[str, str] = {
                "Content-Type": "video/mp4",
                "Cache-Control": "private, no-store",
            }
            if download:
                headers["Content-Disposition"] = (
                    f'attachment; filename="{grant.download_name}"'
                )
            requested = request.http_range
            from_start = requested.start in (None, 0) and requested.stop is None
            if not entry.complete and grant.progressive and from_start and not download:
                return await self._progressive(request, data, entry, headers)
            if not entry.complete:
                async with asyncio.timeout(COMPLETE_TIMEOUT):
                    await cache.async_wait(entry, complete=True)
            path = cache.served_path(entry, grant.flat)
            return web.FileResponse(path, headers=headers)
        except VodCacheError as err:
            return web.Response(status=HTTPStatus.BAD_GATEWAY, text=str(err))
        except TimeoutError:
            return web.Response(
                status=HTTPStatus.GATEWAY_TIMEOUT, text="Recording not ready"
            )

    async def _progressive(
        self,
        request: web.Request,
        data: ReolinkViewerData,
        entry: Entry,
        headers: dict[str, str],
    ) -> web.StreamResponse:
        cache = data.vod_cache
        await cache.async_wait(entry, offset=0)
        response = web.StreamResponse(
            status=HTTPStatus.OK, headers={**headers, "Accept-Ranges": "bytes"}
        )
        response.enable_chunked_encoding()
        await response.prepare(request)
        try:
            async for chunk in cache.async_iter(entry):
                await response.write(chunk)
        except VodCacheError as err:
            # Headers are sent: end the body; the browser sees a short read.
            _LOGGER.debug("Recording fill failed mid-stream: %s", err)
            return response
        await response.write_eof()
        return response


class VodView(_Base):
    """Serve a recording to the player."""

    url = VOD_PATH + "/{token}"
    name = "api:reolink_viewer:vod"

    async def get(self, request: web.Request, token: str) -> web.StreamResponse:
        """Return the recording."""
        return await self._vod(request, token, download=False)


class ClipView(_Base):
    """Serve a recording as a download."""

    url = CLIP_PATH + "/{token}"
    name = "api:reolink_viewer:clip"

    async def get(self, request: web.Request, token: str) -> web.StreamResponse:
        """Return the recording as an attachment."""
        return await self._vod(request, token, download=True)


class ThumbView(HomeAssistantView):
    """Serve a timeline thumbnail."""

    url = THUMB_PATH + "/{token}"
    name = "api:reolink_viewer:thumb"
    requires_auth = True

    async def get(self, request: web.Request, token: str) -> web.Response:
        """Return the JPEG."""
        hass: HomeAssistant = request.app["hass"]
        if (data := _data(hass)) is None:
            return _not_found()
        grant = data.grants.get(token, ThumbGrant)
        if grant is None:
            return _not_found()
        try:
            image = await data.thumbnails.async_get(grant.key)
        except ThumbnailError:
            return web.Response(status=HTTPStatus.NOT_FOUND, text="No image")
        return web.Response(
            body=image,
            content_type="image/jpeg",
            headers={"Cache-Control": "private, max-age=86400"},
        )

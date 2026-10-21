"""HTTP views for recordings, clips and thumbnails, behind signed URLs.

The browser never sees a camera URL or a recording's file name: a websocket
command issues a *grant* (what may be fetched) under a random token and
returns a path signed with HA's ``async_sign_path``. Both the signature and
the grant expire.

- ``/api/reolink_viewer/mse/{token}/init`` and ``.../frags`` feed the MSE
  player: the recording's init segment, then windows of its fragments made
  MSE-ready (``fmp4.py``), each sent once it is on disk. The player asks with
  ``fetch`` and HA's own authentication (a signed path cannot carry the
  window's query), so no signature is issued for these.
- ``/api/reolink_viewer/vod/{token}`` serves a recording as ``video/mp4`` from
  the disk cache, with Range, to the file player (the fallback). A start from
  the beginning of a recording still filling, for a browser that plays while
  downloading, gets the original progressively (200, chunked); every other
  URL gets the plain MP4, rewritten from the complete original on the first
  request (the original if the rewrite fails).
- Issuing a player's URL *leases* the recording (``VodCache.lease``): it is
  not evicted until the URL expires or the player releases it. Each request
  marks the lease as used, so a lease nobody has used for a while gives way
  to a fill behind a click.
- ``/api/reolink_viewer/clip/{token}`` serves the recording as a download
  (the plain copy if there is one).
- ``/api/reolink_viewer/thumb/{token}`` serves a timeline thumbnail (JPEG).
"""

import asyncio
from dataclasses import dataclass
from datetime import timedelta
from http import HTTPStatus
import logging
import secrets
import time
from typing import TYPE_CHECKING, Any

from aiohttp import web

from homeassistant.components.http import HomeAssistantView
from homeassistant.components.http.auth import async_sign_path
from homeassistant.core import HomeAssistant

from .const import DOMAIN
from .scheduler import Priority
from .thumbnails import ThumbKey, ThumbnailError
from .vodcache import Entry, Recording, VodCache, VodCacheError, Window

if TYPE_CHECKING:
    from .models import ReolinkViewerData

_LOGGER = logging.getLogger(__name__)

VOD_PATH = "/api/reolink_viewer/vod"
MSE_PATH = "/api/reolink_viewer/mse"
CLIP_PATH = "/api/reolink_viewer/clip"
THUMB_PATH = "/api/reolink_viewer/thumb"
# A recording's URLs live this long plus the recording's length, so one
# played through (and the next one, asked for near its end) does not expire
# mid-way; the player asks again after a longer pause.
VOD_TTL = timedelta(minutes=30)
VOD_TTL_MAX = timedelta(hours=6)
THUMB_TTL = timedelta(minutes=10)
COMPLETE_TIMEOUT = 600.0
MAX_GRANTS = 5000
# An MSE window: media time (ms) and bytes, by default and at most.
WINDOW_MS = 20_000
MAX_WINDOW_MS = 300_000
WINDOW_BYTES = 16 * 1024 * 1024
MAX_WINDOW_BYTES = 64 * 1024 * 1024


@dataclass(frozen=True, slots=True)
class VodGrant:
    """Permission to fetch one recording as a file."""

    recording: Recording
    progressive: bool
    download_name: str
    # Served as the plain copy (made on the first request), not the original.
    plain: bool = False


@dataclass(frozen=True, slots=True)
class MseGrant:
    """Permission to fetch one recording's fragments (the MSE player)."""

    recording: Recording


@dataclass(frozen=True, slots=True)
class ThumbGrant:
    """Permission to fetch one thumbnail."""

    key: ThumbKey


class Grants:
    """Short-lived, unguessable tokens for what a signed URL may fetch."""

    def __init__(self) -> None:
        """Initialize the registry."""
        self._items: dict[str, tuple[float, VodGrant | MseGrant | ThumbGrant]] = {}

    def issue(self, grant: VodGrant | MseGrant | ThumbGrant, ttl: timedelta) -> str:
        """Store a grant and return its token."""
        now = time.monotonic()
        if len(self._items) >= MAX_GRANTS:
            self._items = {k: v for k, v in self._items.items() if v[0] > now}
            while len(self._items) >= MAX_GRANTS:
                self._items.pop(next(iter(self._items)))
        token = secrets.token_urlsafe(18)
        self._items[token] = (now + ttl.total_seconds(), grant)
        return token

    def get[T: (VodGrant, MseGrant, ThumbGrant)](
        self, token: str, kind: type[T]
    ) -> T | None:
        """Return a live grant of the given kind."""
        item = self._items.get(token)
        if item is None:
            return None
        expires, grant = item
        if expires < time.monotonic():
            del self._items[token]
            return None
        return grant if isinstance(grant, kind) else None


def vod_ttl(recording: Recording) -> timedelta:
    """Return how long URLs of a recording live."""
    length = timedelta(milliseconds=max(recording.end_ms - recording.start_ms, 0))
    return min(VOD_TTL_MAX, VOD_TTL + length)


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
            cache.touch(token)
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
            async with asyncio.timeout(COMPLETE_TIMEOUT):
                if not entry.complete:
                    await cache.async_wait(entry, complete=True)
                if download:
                    flat = entry.flat_at is not None
                else:
                    # A fragmented file is read whole before it plays.
                    flat = grant.plain and await cache.async_plain(entry)
            return web.FileResponse(cache.served_path(entry, flat), headers=headers)
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


class MseView(HomeAssistantView):
    """Serve a recording's init segment and fragments to the MSE player."""

    url = MSE_PATH + "/{token}/{part}"
    name = "api:reolink_viewer:mse"
    requires_auth = True

    async def get(
        self, request: web.Request, token: str, part: str
    ) -> web.StreamResponse:
        """Return the init segment (``init``) or a window (``frags``)."""
        hass: HomeAssistant = request.app["hass"]
        if (data := _data(hass)) is None or part not in ("init", "frags"):
            return _not_found()
        grant = data.grants.get(token, MseGrant)
        if grant is None:
            return _not_found()
        try:
            query = _window_query(request)
        except ValueError:
            return web.Response(status=HTTPStatus.BAD_REQUEST, text="Bad window")
        cache = data.vod_cache
        headers = {"Cache-Control": "private, no-store"}
        try:
            entry = await cache.async_open(grant.recording, Priority.PLAYBACK)
            cache.touch(token)
            async with asyncio.timeout(COMPLETE_TIMEOUT):
                if part == "init":
                    init, mime = await cache.async_init(entry)
                    if mime:
                        headers["X-RV-Mime"] = mime
                    return web.Response(
                        body=init, content_type="video/mp4", headers=headers
                    )
                window = await cache.async_window(entry, **query)
        except VodCacheError as err:
            return web.Response(status=HTTPStatus.BAD_GATEWAY, text=str(err))
        except TimeoutError:
            return web.Response(
                status=HTTPStatus.GATEWAY_TIMEOUT, text="Recording not ready"
            )
        return await _send_window(request, cache, entry, window, headers)


def _window_query(request: web.Request) -> dict[str, Any]:
    """Read ``at`` (ms) or ``first`` (an index), ``ms`` and ``bytes``."""
    query = request.query
    result: dict[str, Any] = {
        "max_ms": min(max(int(query.get("ms", WINDOW_MS)), 1), MAX_WINDOW_MS),
        "max_bytes": min(
            max(int(query.get("bytes", WINDOW_BYTES)), 1), MAX_WINDOW_BYTES
        ),
    }
    if "first" in query:
        result["first"] = int(query["first"])
        if result["first"] < 0:
            raise ValueError("negative index")
    else:
        result["at_ms"] = max(float(query.get("at", 0)), 0.0)
    return result


async def _send_window(
    request: web.Request,
    cache: VodCache,
    entry: Entry,
    window: Window,
    headers: dict[str, str],
) -> web.StreamResponse:
    times = {
        "X-RV-Start": window.start_ms,
        "X-RV-End": window.end_ms,
    }
    response = web.StreamResponse(
        headers={
            **headers,
            "Content-Type": "video/mp4",
            "X-RV-First": str(window.first),
            "X-RV-Count": str(len(window.fragments)),
            "X-RV-Last": "1" if window.last else "0",
            **{k: f"{v:.3f}" for k, v in times.items() if v is not None},
        }
    )
    response.enable_chunked_encoding()
    await response.prepare(request)
    try:
        async for chunk in cache.async_read_window(entry, window):
            await response.write(chunk)
    except VodCacheError as err:
        # Headers are sent: end the body; the player sees a short window.
        _LOGGER.debug("Fragments of a recording failed mid-window: %s", err)
        return response
    await response.write_eof()
    return response


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

"""Saving an event (Phase 11 step 2): an MP4 of it, with a margin either side.

"Save event" on the Playback page asks for the stretch of the recording from
the event's start minus the margin before it to its end plus the margin after
(the options, 10 s each by default), in the stream playing.

- **Where it comes from:** the cached copy of the recording. The cache waits
  until its download holds the stretch (resuming one that stopped at a deep
  start's cut), then writes the fragments from the key frame at or before its
  start (``fmp4.write_clip``), moved to start at 0. The samples are copied as
  stored: nothing is decoded or encoded.
- **The file:** ffmpeg rewrites that as a plain MP4 (``remux.async_flatten``,
  stream copy, ``moov`` first), which every player and phone takes. Without
  ffmpeg, or if the rewrite fails, the fragmented MP4 is served as it is.
- **Named** ``<camera>-<date>-<time>-<type>.mp4``, the event's start in Home
  Assistant's time zone.
- **Kept** ``CLIP_KEEP_S``: its signed download URL lives as long, then the
  file is deleted. One clip is made at a time; the directory is emptied at
  setup and shutdown. A clip is at most ``CLIP_MAX_MS`` long.

A recording that ends inside the margins gives what it holds: the clip does
not reach into the recording before or after it.
"""

import asyncio
from dataclasses import dataclass
from datetime import datetime
import logging
from pathlib import Path
import re
import secrets
import shutil
import time
from zoneinfo import ZoneInfo

from homeassistant.core import CALLBACK_TYPE, HomeAssistant
from homeassistant.helpers.event import async_call_later

from .remux import RemuxError, async_flatten
from .vodcache import Entry, VodCache, VodCacheError

_LOGGER = logging.getLogger(__name__)

# How long a saved clip's file and URL last.
CLIP_KEEP_S = 15 * 60
# The longest clip (a long event, or wide margins): 30 minutes.
CLIP_MAX_MS = 30 * 60 * 1000
# The whole of making one: the download reaching it, the cut and the rewrite.
CLIP_TIMEOUT_S = 300.0
# The margins' bounds (the options).
MARGIN_MAX_S = 120
_LABEL_CHARS = 24


class ClipError(Exception):
    """The clip could not be made."""


@dataclass(frozen=True, slots=True)
class EventClip:
    """A saved clip, on disk until ``CLIP_KEEP_S`` after it was made."""

    path: Path
    name: str
    size: int
    # The stretch it holds (UTC ms): from a key frame at or before the start asked.
    start_ms: int
    end_ms: int
    # A plain MP4 (else the fragmented one, served as it is).
    plain: bool
    # How long making it took (ms): waiting for the download, cutting, rewriting.
    took_ms: float


def clip_name(camera: str, start_ms: int, label: str, time_zone: str) -> str:
    """Return ``<camera>-<date>-<time>-<type>.mp4`` (the start in ``time_zone``)."""
    slug = _slug(camera) or "camera"
    try:
        zone = ZoneInfo(time_zone)
    except KeyError, ValueError:
        zone = ZoneInfo("UTC")
    when = datetime.fromtimestamp(start_ms / 1000, zone)
    kind = _slug(label)[:_LABEL_CHARS].strip("-") or "event"
    return f"{slug}-{when:%Y%m%d-%H%M%S}-{kind}.mp4"


def _slug(text: str) -> str:
    return re.sub(r"[^A-Za-z0-9]+", "-", text).strip("-").lower()


class EventClips:
    """Make each event's clip, keep it a while, then delete it."""

    def __init__(
        self,
        hass: HomeAssistant,
        cache: VodCache,
        directory: Path,
        ffmpeg_binary: str | None,
    ) -> None:
        """Make clips from ``cache``'s copies into ``directory``."""
        self._hass = hass
        self._cache = cache
        self._dir = directory
        self._ffmpeg = ffmpeg_binary
        self._lock = asyncio.Lock()
        self._expiry: dict[Path, CALLBACK_TYPE] = {}

    async def async_setup(self) -> None:
        """Make the directory, emptied of a previous run's clips."""
        await self._hass.async_add_executor_job(_empty, self._dir, True)

    async def async_shutdown(self) -> None:
        """Forget every clip and delete the files."""
        for cancel in self._expiry.values():
            cancel()
        self._expiry.clear()
        await self._hass.async_add_executor_job(_empty, self._dir, False)

    async def async_make(
        self, entry: Entry, start_utc: int, end_utc: int, name: str
    ) -> EventClip:
        """Write the stretch [start_utc, end_utc) of ``entry``'s recording.

        It is clamped to the recording, and to ``CLIP_MAX_MS``.
        """
        recording = entry.recording
        length = recording.end_ms - recording.start_ms
        start_ms = max(0, start_utc - recording.start_ms)
        end_ms = min(length, end_utc - recording.start_ms, start_ms + CLIP_MAX_MS)
        if end_ms <= start_ms:
            raise ClipError("the event is not in this recording")
        began = time.monotonic()
        async with self._lock:
            stem = secrets.token_hex(8)
            fragmented = self._dir / f"{stem}.fragmented.mp4"
            plain = self._dir / f"{stem}.mp4"
            try:
                async with asyncio.timeout(CLIP_TIMEOUT_S):
                    begin, end, size = await self._cache.async_write_clip(
                        entry, start_ms, end_ms, fragmented
                    )
                    flat = await self._flatten(fragmented, plain)
            except TimeoutError:
                await self._remove(fragmented, plain)
                raise ClipError("the recording took too long to download") from None
            except VodCacheError as err:
                await self._remove(fragmented, plain)
                raise ClipError(str(err)) from err
            except OSError as err:
                await self._remove(fragmented, plain)
                raise ClipError(f"could not write the clip: {err.strerror}") from err
            except BaseException:
                await self._remove(fragmented, plain)
                raise
        path = plain if flat else fragmented
        if flat:
            size = await self._hass.async_add_executor_job(_size, path)
        self._expire_later(path)
        return EventClip(
            path=path,
            name=name,
            size=size,
            start_ms=round(recording.start_ms + begin),
            end_ms=round(recording.start_ms + end),
            plain=flat,
            took_ms=round((time.monotonic() - began) * 1000, 1),
        )

    async def _flatten(self, fragmented: Path, plain: Path) -> bool:
        """Rewrite the clip as a plain MP4; whether it was (the original is removed)."""
        if self._ffmpeg is None:
            return False
        try:
            await async_flatten(self._ffmpeg, fragmented, plain)
        except RemuxError as err:
            _LOGGER.warning("Event clip served fragmented: ffmpeg failed: %s", err)
            await self._remove(plain)
            return False
        await self._remove(fragmented)
        return True

    def _expire_later(self, path: Path) -> None:
        async def expire(_now: datetime) -> None:
            self._expiry.pop(path, None)
            await self._remove(path)

        self._expiry[path] = async_call_later(self._hass, CLIP_KEEP_S, expire)

    async def _remove(self, *paths: Path) -> None:
        await self._hass.async_add_executor_job(_unlink, paths)

    def stats(self) -> dict[str, int]:
        """Return how many clips are kept (the debug view)."""
        return {"kept": len(self._expiry)}


def _empty(directory: Path, make: bool) -> None:
    if directory.exists():
        shutil.rmtree(directory, ignore_errors=True)
    if make:
        directory.mkdir(parents=True, exist_ok=True)


def _unlink(paths: tuple[Path, ...]) -> None:
    for path in paths:
        path.unlink(missing_ok=True)


def _size(path: Path) -> int:
    return path.stat().st_size

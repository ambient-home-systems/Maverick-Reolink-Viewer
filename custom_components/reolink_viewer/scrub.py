"""Scrubbing that shows the picture (Phase 10 step 1): key frames from the server.

While the pointer is held down on the timeline, the browser asks over a scrub
session (``views.ScrubView``, a websocket behind a signed path) for the
picture at the moment under it. The answer is the key frame showing it, as an
init segment of the video track alone and a fragment of that one sample (what
WebCodecs decodes, or an MSE video plays), with its own time. It comes from,
fastest first:

1. **the scrub store** (:class:`KeyFrameStore`): key frames found earlier,
   kept on disk per camera, least recently used out above ``STORE_BYTES``.
   The latest one at or before the moment answers it if it is within the
   camera's key-frame interval of it (as the cuts saw it, plus
   ``INTERVAL_SLACK_MS``; ``DEFAULT_INTERVAL_MS`` until known): the key frame
   a cut would give for that moment;
2. **the disk cache** (``VodCache.async_key_frame``): the recording's
   original, or a cut of it, as on disk now: a file read, no device I/O;
3. **a scrub cut** (``BaichuanSource.async_key_frame``): 2 s of the sub stream
   from the device, its first key frame (166-182 ms back to back on the
   owner's NVR);
4. **the thumbnail** (``snapshot_past``, a JPEG) where the Reolink protocol
   cannot be used (the option off, a device that refuses it).

Always the sub stream, whichever plays (H.264 on every owned camera). The
recording is found in the day the browser shows, as the timeline has it: a
moment between recordings has no picture, and asks the device nothing.
"""

import asyncio
from bisect import bisect_left, bisect_right
from collections import OrderedDict
from dataclasses import dataclass, field
from datetime import date
import json
import logging
from pathlib import Path
import struct
import time
from typing import Any

from homeassistant.core import HomeAssistant

from .baichuan_source import BaichuanSource, CutError
from .devices import PlaybackSource
from .fmp4 import KeySample
from .scheduler import Priority
from .thumbnails import ThumbnailError, ThumbnailService
from .timeline import Segment, TimelineError, TimelineService
from .vodcache import Recording, VodCache

_LOGGER = logging.getLogger(__name__)

STREAM = "sub"
# A key frame found earlier answers a moment up to the camera's key-frame
# interval after it, and this much more; 4 s (five of the owner's six
# cameras) until a cut has shown the camera's.
DEFAULT_INTERVAL_MS = 4_000
INTERVAL_SLACK_MS = 500
# The scrub store's size on disk.
STORE_BYTES = 64 * 1024**2
STORE_SUFFIX = ".kf"
# The day the browser shows, as the timeline has it, even if today's is a few
# minutes old: a scrub never searches the device for recordings.
DAY_MAX_AGE_S = 3600
THUMB_BUCKET_S = 5


class ScrubError(Exception):
    """No picture for that moment (said to the browser in plain words)."""


@dataclass(frozen=True, slots=True)
class Picture:
    """What a scrub shows: a key frame (init + one sample), or a JPEG."""

    # The picture's own time (UTC ms) and where it came from.
    time_ms: int
    source: str
    init: bytes = b""
    fragment: bytes = b""
    codec: str | None = None
    jpeg: bytes = b""
    timing: dict[str, Any] = field(default_factory=dict)

    @property
    def kind(self) -> str:
        """Return "jpeg" for a thumbnail, else "fmp4"."""
        return "jpeg" if self.jpeg else "fmp4"

    def message(self, seq: int, at_ms: int) -> bytes:
        """Return the binary message for the browser (see ``views.ScrubView``)."""
        data = self.jpeg or self.fragment
        header = json.dumps(
            {
                "seq": seq,
                "at": at_ms,
                "time": self.time_ms,
                "source": self.source,
                "kind": self.kind,
                "codec": self.codec,
                "init": len(self.init),
                "data": len(data),
                "timing": self.timing,
            },
            separators=(",", ":"),
        ).encode()
        return struct.pack(">I", len(header)) + header + self.init + data


@dataclass(slots=True)
class _Stored:
    name: str
    size: int
    codec: str | None


class KeyFrameStore:
    """Key frames found earlier, on disk, per camera, least recently used out."""

    def __init__(self, hass: HomeAssistant, directory: Path, max_bytes: int) -> None:
        """Keep up to ``max_bytes`` of key frames in ``directory``."""
        self._hass = hass
        self._dir = directory
        self._max_bytes = max_bytes
        # Per camera: the key frames' times (UTC ms), sorted.
        self._times: dict[str, list[int]] = {}
        # By (camera, time): the file, in least recently used order.
        self._files: OrderedDict[tuple[str, int], _Stored] = OrderedDict()
        self._total = 0

    async def async_setup(self) -> None:
        """Start empty: what an earlier run kept is let go."""
        await self._hass.async_add_executor_job(self._clear)

    def _clear(self) -> None:
        self._dir.mkdir(parents=True, exist_ok=True)
        for path in self._dir.glob(f"*{STORE_SUFFIX}"):
            path.unlink(missing_ok=True)

    def near(self, camera: str, at_ms: int, reach_ms: int) -> int | None:
        """Return the stored key frame's time that answers ``at_ms``, if any.

        The latest at or before it, if it is at most ``reach_ms`` before it.
        """
        times = self._times.get(camera)
        if not times:
            return None
        i = bisect_right(times, at_ms)
        if i and at_ms - times[i - 1] <= reach_ms:
            return times[i - 1]
        return None

    async def async_get(self, camera: str, time_ms: int) -> Picture | None:
        """Return the stored key frame at ``time_ms`` (from :meth:`near`)."""
        stored = self._files.get((camera, time_ms))
        if stored is None:
            return None
        self._files.move_to_end((camera, time_ms))
        try:
            raw = await self._hass.async_add_executor_job(
                (self._dir / stored.name).read_bytes
            )
        except OSError:
            self._forget(camera, time_ms)
            return None
        (split,) = struct.unpack_from(">I", raw, 0)
        return Picture(
            time_ms,
            "store",
            init=raw[4 : 4 + split],
            fragment=raw[4 + split :],
            codec=stored.codec,
        )

    async def async_put(self, camera: str, picture: Picture) -> None:
        """Keep a key frame (a JPEG is not kept here)."""
        if picture.kind != "fmp4" or (camera, picture.time_ms) in self._files:
            return
        name = f"{len(self._files)}-{time.monotonic_ns()}{STORE_SUFFIX}"
        raw = struct.pack(">I", len(picture.init)) + picture.init + picture.fragment
        await self._hass.async_add_executor_job(self._write, name, raw)
        key = (camera, picture.time_ms)
        if key in self._files:
            # Another session kept the same key frame meanwhile.
            await self._hass.async_add_executor_job(self._delete, [name])
            return
        self._files[key] = _Stored(name, len(raw), picture.codec)
        self._total += len(raw)
        times = self._times.setdefault(camera, [])
        times.insert(bisect_left(times, picture.time_ms), picture.time_ms)
        gone: list[str] = []
        while self._total > self._max_bytes and len(self._files) > 1:
            (old_camera, old_time), old = self._files.popitem(last=False)
            self._total -= old.size
            self._drop_time(old_camera, old_time)
            gone.append(old.name)
        if gone:
            await self._hass.async_add_executor_job(self._delete, gone)

    def _forget(self, camera: str, time_ms: int) -> None:
        stored = self._files.pop((camera, time_ms), None)
        if stored is not None:
            self._total -= stored.size
            self._drop_time(camera, time_ms)

    def _drop_time(self, camera: str, time_ms: int) -> None:
        times = self._times.get(camera, [])
        i = bisect_left(times, time_ms)
        if i < len(times) and times[i] == time_ms:
            del times[i]

    def _write(self, name: str, raw: bytes) -> None:
        tmp = self._dir / f".{name}.tmp"
        tmp.write_bytes(raw)
        tmp.replace(self._dir / name)

    def _delete(self, names: list[str]) -> None:
        for name in names:
            (self._dir / name).unlink(missing_ok=True)

    def stats(self) -> dict[str, int]:
        """Return the store's key frames and bytes."""
        return {"key_frames": len(self._files), "bytes": self._total}


class ScrubService:
    """The picture at a moment of a camera's day: see the module doc."""

    def __init__(
        self,
        hass: HomeAssistant,
        *,
        timeline: TimelineService,
        cache: VodCache,
        baichuan: BaichuanSource | None,
        thumbnails: ThumbnailService,
        store: KeyFrameStore,
    ) -> None:
        """Answer from the store, the cache, a cut or a thumbnail."""
        self._hass = hass
        self._timeline = timeline
        self._cache = cache
        self._baichuan = baichuan
        self._thumbnails = thumbnails
        self.store = store
        self._counts: dict[str, int] = {}

    async def async_picture(
        self, source: PlaybackSource, day: date, at_ms: int
    ) -> Picture:
        """Return the picture at ``at_ms`` (UTC ms) of ``source``'s ``day``.

        Raises :class:`ScrubError` when there is none (between recordings, no
        key frame in time, the device busy or refusing).
        """
        began = time.monotonic()
        camera = source.key
        reach = self._reach_ms(source)
        if (near := self.store.near(camera, at_ms, reach)) is not None and (
            stored := await self.store.async_get(camera, near)
        ) is not None:
            return self._done(stored, began)
        segment = await self._segment(source, day, at_ms)
        recording = Recording(
            source=source,
            stream=STREAM,
            name=segment.name,
            start_ms=segment.start,
            end_ms=segment.end,
            size=segment.size,
        )
        media_ms = at_ms - segment.start
        cached = await self._cache.async_key_frame(recording, media_ms)
        if cached is not None:
            sample, where = cached
            picture = _picture(
                sample, segment.start, "cache" if where == "file" else "cut"
            )
            await self.store.async_put(camera, picture)
            return self._done(picture, began)
        baichuan = self._baichuan
        if baichuan is None or not baichuan.usable(source.entry_id):
            return self._done(await self._thumbnail(source, at_ms), began)
        try:
            sample = await baichuan.async_key_frame(
                entry_id=source.entry_id,
                channel=source.channel,
                start_ms=segment.start,
                end_ms=segment.end,
                at_ms=media_ms,
            )
        except CutError as err:
            self._count("none")
            raise ScrubError(f"no picture from the device: {err}") from err
        picture = _picture(sample, segment.start, "device")
        await self.store.async_put(camera, picture)
        return self._done(picture, began)

    def _reach_ms(self, source: PlaybackSource) -> int:
        """Return how far before a moment a stored key frame still shows it."""
        known = (
            self._baichuan.key_interval_ms(source.entry_id, source.channel)
            if self._baichuan is not None
            else None
        )
        return (known or DEFAULT_INTERVAL_MS) + INTERVAL_SLACK_MS

    async def _segment(self, source: PlaybackSource, day: date, at_ms: int) -> Segment:
        try:
            found, _timing = await self._timeline.async_day(
                source, day, STREAM, Priority.PLAYBACK, max_age=DAY_MAX_AGE_S
            )
        except TimelineError as err:
            raise ScrubError(f"the day's recordings could not be read: {err}") from err
        segment = next((s for s in found.segments if s.start <= at_ms < s.end), None)
        if segment is None:
            self._count("gap")
            raise ScrubError("no recording at that moment")
        return segment

    async def _thumbnail(self, source: PlaybackSource, at_ms: int) -> Picture:
        key = self._thumbnails.key(source, at_ms, THUMB_BUCKET_S, STREAM)
        try:
            jpeg = await self._thumbnails.async_get(key, Priority.PLAYBACK)
        except ThumbnailError as err:
            self._count("none")
            raise ScrubError(str(err)) from err
        return Picture(key.bucket_ms, "thumbnail", jpeg=jpeg)

    def _done(self, picture: Picture, began: float) -> Picture:
        self._count(picture.source)
        timing = {"ms": round((time.monotonic() - began) * 1000, 1)}
        return Picture(
            picture.time_ms,
            picture.source,
            init=picture.init,
            fragment=picture.fragment,
            codec=picture.codec,
            jpeg=picture.jpeg,
            timing=timing,
        )

    def _count(self, what: str) -> None:
        self._counts[what] = self._counts.get(what, 0) + 1

    def stats(self) -> dict[str, Any]:
        """Return how scrubs were answered, and the store (the debug panel)."""
        return {"answered": dict(self._counts), "store": self.store.stats()}


def _picture(sample: KeySample, recording_start: int, source: str) -> Picture:
    return Picture(
        round(recording_start + sample.time_ms),
        source,
        init=sample.init,
        fragment=sample.fragment,
        codec=sample.codec,
    )


async def cancelled_quietly(task: asyncio.Task[Any]) -> None:
    """Cancel a task and wait for it to end (its clean-up runs)."""
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    except Exception:
        _LOGGER.debug("A superseded scrub failed", exc_info=True)

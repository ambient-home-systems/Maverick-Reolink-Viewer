"""The key-frame cache: one shared MSE feed per stream, starting at a key frame.

go2rtc gives a new viewer nothing until the camera's next key frame, and the
cameras send one every 1 to 4 s, so that wait is most of every start (Phase 3
step 1, run 5). A *feed* is one go2rtc MSE consumer of a stream, shared by
every viewer of it. It keeps the init segment and every fragment since the
last video key frame. A viewer who joins gets them at once, so the browser
decodes from the key frame and shows the newest frame without waiting.

- A stream kept warm keeps its feed open without viewers, and with it the
  camera connection and one stream slot. If the feed ends (go2rtc restarted,
  the camera dropped it), it opens again after a backoff.
- Any other feed closes with its last viewer.
- go2rtc picks a feed's tracks from the codecs its first viewer can play. A
  viewer shares a feed if it can play every codec the feed carries; otherwise
  it gets a feed of its own.
- A viewer whose data has waited more than ``MAX_BEHIND_S`` to be sent is
  dropped: its player reconnects and starts again at the newest key frame.
- go2rtc takes the init segment's parameter sets from the stream's
  description; the key frames carry the stream's own. Where they differ (most
  Reolink streams, runs 5 and 6), the feed rebuilds the init segment from the
  first key frame's (``h26x.py``): over MSE, three NVR streams showed a size
  their WebRTC frames did not have, and one decoded nothing until its second
  key frame.
- H.264 streams that do not say their frames come in decode order (no VUI
  bitstream restriction, and picture order count type 0 or 1) get an SPS
  that does, in the init segment and in the key frames: without it, Chrome on
  macOS holds up to 16 frames back before showing the first over MSE (run 8:
  1 to 4 s late on such sub streams). These cameras' streams play in decode
  order over WebRTC.
- Each stream's feed ends are counted, with the last reason, for the check.

go2rtc writes one ``moof`` + ``mdat`` per frame, marking key frames in the
sample flags; the feed reads no more than the boxes' headers and flags.
"""

import asyncio
from collections import deque
from collections.abc import Awaitable, Callable
import json
import logging
import struct
import time
from typing import Any

from aiohttp import ClientError, ClientWebSocketResponse, WSMsgType

from custom_components.reolink_viewer.fmp4 import (
    FragmentError,
    Track,
    fragment_runs,
    init_tracks,
    set_sample_size,
)
from custom_components.reolink_viewer.mp4 import parse_box_header
from homeassistant.core import HomeAssistant

from .go2rtc import Go2rtcError, Go2rtcServer, redact
from .h26x import (
    VideoConfig,
    compare_sets,
    init_config,
    limit_reorder,
    nal_type,
    parse_avc_sps,
    rebuild_init,
    replace_nals,
    sample_sets,
)
from .streams import Hold, LiveError, LiveStream, StreamRegistry

_LOGGER = logging.getLogger(__name__)

# go2rtc answers once the camera is connected and its tracks are known.
OPEN_TIMEOUT = 20.0
# Keeping a stream warm waits this long for its first key frame.
KEY_FRAME_TIMEOUT = 15.0
# What a warm feed asks of go2rtc (its MSE names): H.264, H.265 and AAC, what
# Reolink cameras send. A browser that cannot play one of them gets its own.
WARM_CODECS = "avc1.640029,hvc1.1.6.L153.B0,mp4a.40.2"
# More than this since the last key frame: none is coming; keep nothing.
MAX_GOP_BYTES = 32 * 1024 * 1024
MAX_BEHIND_S = 10.0
# A warm feed that ended opens again after these delays (reset after it ran
# for STABLE_S).
RETRY_S = (1.0, 2.0, 5.0, 10.0, 30.0, 60.0)
STABLE_S = 60.0


class Viewer:
    """One browser on a feed: what it has still to be sent."""

    def __init__(self, feed: Feed) -> None:
        """Initialize (use Feed.attach)."""
        self._feed = feed
        self._queue: deque[tuple[float, bytes]] = deque()
        self._wake = asyncio.Event()
        self.started = False
        self.closed = False
        self.error: str | None = None

    @property
    def mime(self) -> str:
        """Return the feed's MIME type, with its codecs."""
        return self._feed.mime

    def push(self, data: bytes) -> None:
        """Queue media for the browser; drop a viewer that falls behind."""
        if self.closed:
            return
        now = time.monotonic()
        if self._queue and now - self._queue[0][0] > MAX_BEHIND_S:
            self.close("the connection is too slow for this stream")
            return
        self._queue.append((now, data))
        self._wake.set()

    async def next(self) -> bytes | None:
        """Return everything waiting, as one message; None once closed."""
        while not self._queue:
            if self.closed:
                return None
            self._wake.clear()
            await self._wake.wait()
        data = b"".join(item for _, item in self._queue)
        self._queue.clear()
        return data

    def close(self, error: str | None = None) -> None:
        """Stop sending (with the reason, if it is an error)."""
        if self.closed:
            return
        self.closed = True
        self.error = error
        self._queue.clear()
        self._wake.set()

    def detach(self) -> None:
        """Leave the feed (it closes with its last viewer unless kept warm)."""
        self.close()
        self._feed.detach(self)


class Feed:
    """One go2rtc MSE consumer of a stream, shared, with its last key frame on."""

    def __init__(self, relay: MseRelay, stream: LiveStream, codecs: str) -> None:
        """Initialize (use MseRelay)."""
        self._relay = relay
        self.stream = stream
        self.codecs = codecs
        self.mime = ""
        self.warm = False
        self.viewers: set[Viewer] = set()
        self.init: bytes | None = None
        self.parameter_sets: str | None = None
        # H.264: "decode order" (POC type 2), "reorder N" (the stream's limit)
        # or "limit added" (this feed's SPS says decode order).
        self.frame_order: str | None = None
        self._sps_patch: dict[bytes, bytes] = {}
        self.key_interval_s: float | None = None
        self.started_at = time.monotonic()
        self.ended = False
        self._closing = False
        self._task: asyncio.Task[None] | None = None
        self._hold: Hold | None = None
        self._buffer = bytearray()
        self._head = b""
        self._moof: bytes | None = None
        self._tracks: dict[int, Track] = {}
        self._video: Track | None = None
        self._config: VideoConfig | None = None
        self._gop: list[bytes] = []
        self._gop_bytes = 0
        self._gop_start: int | None = None
        self._gop_end: int | None = None
        self._key_at: float | None = None
        self._key_frame = asyncio.Event()

    @property
    def usable(self) -> bool:
        """Return True while viewers can join."""
        return not self.ended and not self._closing

    def carries(self) -> frozenset[str]:
        """Return the codec families in the feed (avc1, hvc1, mp4a…)."""
        return _families(_mime_codecs(self.mime))

    async def async_open(self) -> None:
        """Start go2rtc, take a stream slot, and wait for go2rtc's answer."""
        try:
            server = await self._relay.async_server()
        except Go2rtcError as err:
            raise LiveError(str(err)) from err
        self._hold = await self._relay.registry.async_hold(self.stream)
        opened: asyncio.Future[None] = asyncio.get_running_loop().create_future()
        self._task = self._relay.hass.async_create_background_task(
            self._run(server, opened), f"reolink_viewer live feed {self.stream.kind}"
        )
        try:
            await opened
        except BaseException:
            self.close()
            raise

    async def async_key_frame(self, timeout: float) -> bool:
        """Wait until a key frame is cached; False if none came in time."""
        try:
            async with asyncio.timeout(timeout):
                await self._key_frame.wait()
        except TimeoutError:
            return False
        return bool(self._gop)

    def attach(self) -> Viewer:
        """Add a viewer; it is sent the cached key frame onwards at once."""
        viewer = Viewer(self)
        self.viewers.add(viewer)
        if self._gop and self.init is not None:
            viewer.started = True
            viewer.push(self.init + b"".join(self._gop))
        return viewer

    def detach(self, viewer: Viewer) -> None:
        """Remove a viewer; close with the last one unless kept warm."""
        self.viewers.discard(viewer)
        if not self.viewers and not self.warm:
            self.close()

    def close(self) -> None:
        """Stop: disconnect from go2rtc and give the stream slot back."""
        self._closing = True
        self._relay.forget(self)
        if self._task is not None and not self._task.done():
            self._task.cancel()
        else:
            self._end(None)

    async def async_wait_closed(self) -> None:
        """Wait for the feed's task to finish."""
        if self._task is not None:
            await asyncio.gather(self._task, return_exceptions=True)

    def state(self) -> dict[str, Any]:
        """Return what the panel shows about the cache."""
        now = time.monotonic()
        video = self._video
        cached_ms = None
        if video is not None and self._gop_start is not None and self._gop_end:
            span = self._gop_end - self._gop_start
            cached_ms = round(span * 1000 / video.timescale)
        return {
            "viewers": len(self.viewers),
            "warm": self.warm,
            "mime": self.mime,
            "key_frame_age_ms": (
                round((now - self._key_at) * 1000) if self._key_at else None
            ),
            "key_interval_ms": (
                round(self.key_interval_s * 1000) if self.key_interval_s else None
            ),
            "cached_ms": cached_ms,
            "cached_bytes": self._gop_bytes,
            "parameter_sets": self.parameter_sets,
            "frame_order": self.frame_order,
            "age_ms": round((now - self.started_at) * 1000),
        }

    # ---- Reading go2rtc ----

    async def _run(self, server: Go2rtcServer, opened: asyncio.Future[None]) -> None:
        error: str | None = None
        try:
            async with server.ws(self.stream.name) as ws:
                await ws.send_json({"type": "mse", "value": self.codecs})
                async with asyncio.timeout(OPEN_TIMEOUT):
                    self.mime = await _answer(ws)
                opened.set_result(None)
                error = await self._read(ws)
        except TimeoutError:
            error = "go2rtc did not answer"
        except (Go2rtcError, LiveError, FragmentError, ClientError) as err:
            error = str(err) or type(err).__name__
        except (struct.error, ValueError, IndexError) as err:
            error = f"unreadable media ({type(err).__name__})"
        finally:
            if not opened.done():
                opened.set_exception(LiveError(redact(error or "the stream ended")))
            self._end(error)

    async def _read(self, ws: ClientWebSocketResponse) -> str | None:
        async for msg in ws:
            if msg.type is WSMsgType.BINARY:
                self._data(msg.data)
            elif msg.type is WSMsgType.TEXT:
                if (error := _error_text(msg.data)) is not None:
                    return error
            else:
                break
        return None if self._closing else "go2rtc closed the stream"

    def _data(self, data: bytes) -> None:
        buffer = self._buffer
        buffer += data
        pos = 0
        while len(buffer) - pos >= 8:
            box = parse_box_header(bytes(buffer[pos : pos + 16]), pos)
            if box is None:
                if len(buffer) - pos >= 16:
                    raise FragmentError("unreadable box")
                break
            if box.end is None:
                raise FragmentError(f"{box.type} without a size")
            if box.end > len(buffer):
                if box.end - pos > MAX_GOP_BYTES:
                    raise FragmentError(f"{box.type} of {box.end - pos} bytes")
                break
            self._box(box.type, bytes(buffer[pos : box.end]), box.header)
            pos = box.end
        del buffer[:pos]

    def _box(self, box_type: str, raw: bytes, header: int) -> None:
        if box_type in ("ftyp", "moov") and self.init is None:
            self._head += raw
            if box_type == "moov":
                self._header(self._head)
        elif box_type == "moof":
            self._moof = raw
        elif box_type == "mdat":
            if self._moof is None or self.init is None:
                raise FragmentError("media before its header")
            self._fragment(self._moof, raw, raw[header:])
            self._moof = None

    def _header(self, init: bytes) -> None:
        self.init = init
        self._tracks = init_tracks(init)
        self._video = next(
            (t for t in self._tracks.values() if t.handler == "vide"), None
        )
        self._config = init_config(init)

    def _fragment(self, moof: bytes, mdat: bytes, sample: bytes) -> None:
        runs = fragment_runs(moof, self._tracks)
        data = moof + mdat
        video = self._video
        run = runs.get(video.track_id) if video is not None else None
        # Audio only: any fragment is a place to start.
        key = video is None or (run is not None and run[2])
        if key:
            self._key(sample, run[0] if run is not None else None)
            data = self._patched(moof, mdat, sample) or data
            self._gop = [data]
            self._gop_bytes = len(data)
        elif self._gop:
            self._gop.append(data)
            self._gop_bytes += len(data)
            if self._gop_bytes > MAX_GOP_BYTES:
                self._gop = []
                self._gop_bytes = 0
                self._gop_start = None
        if run is not None and run[0] is not None:
            self._gop_end = run[0] + run[1]
        for viewer in list(self.viewers):
            if viewer.started:
                viewer.push(data)
            elif key and self.init is not None:
                viewer.started = True
                viewer.push(self.init + data)

    def _key(self, sample: bytes, decode: int | None) -> None:
        now = time.monotonic()
        if self._video is not None:
            if self._key_at is not None:
                self.key_interval_s = now - self._key_at
            self._key_at = now
            if self.parameter_sets is None and self._config is not None:
                self._check_sets(self._config, sample)
        self._gop_start = decode
        self._key_frame.set()

    def _check_sets(self, config: VideoConfig, sample: bytes) -> None:
        """Compare the key frame's parameter sets; rebuild the init if they differ.

        Viewers are sent the init segment with their first key frame, so the
        first key frame's sets can still replace go2rtc's.
        """
        sets = sample_sets(sample, config)
        self.parameter_sets = compare_sets(config.sets, sets)
        differ = self.parameter_sets == "differ" and sets is not None
        base = list(sets) if differ and sets is not None else list(config.sets)
        if not config.hevc:
            self._limit_reorder(base)
        if (not differ and not self._sps_patch) or self.init is None:
            return
        patched = [self._sps_patch.get(nal, nal) for nal in base]
        rebuilt = rebuild_init(self.init, patched, hevc=config.hevc)
        if rebuilt is None:
            self._sps_patch.clear()
            return
        self.init = rebuilt
        if differ:
            self.parameter_sets = "rebuilt"

    def _limit_reorder(self, sets: list[bytes]) -> None:
        """Note how the stream orders frames; patch its SPS where it must."""
        for nal in sets:
            if nal_type(nal, hevc=False) != 7:
                continue
            try:
                info = parse_avc_sps(nal)
            except IndexError, ValueError:
                return
            if info.poc_type == 2:
                self.frame_order = "decode order"
            elif info.reorder is not None:
                self.frame_order = f"reorder {info.reorder}"
            elif (limited := limit_reorder(nal)) is not None:
                self._sps_patch[nal] = limited
                self.frame_order = "limit added"

    def _patched(self, moof: bytes, mdat: bytes, sample: bytes) -> bytes | None:
        """Return a key frame with its SPS replaced by the patched one, if any."""
        if not self._sps_patch or self._config is None:
            return None
        new = replace_nals(sample, self._config.length, self._sps_patch)
        if new is None:
            return None
        resized = set_sample_size(moof, len(new))
        if resized is None:
            return None
        header = len(mdat) - len(sample)
        if header == 16:
            box = struct.pack(">I4sQ", 1, b"mdat", 16 + len(new))
        else:
            box = struct.pack(">I4s", 8 + len(new), b"mdat")
        return resized + box + new

    def _end(self, error: str | None) -> None:
        if self.ended:
            return
        self.ended = True
        reason = redact(error) if error else "the stream ended"
        for viewer in list(self.viewers):
            viewer.close(reason)
        self.viewers.clear()
        if self._hold is not None:
            self._hold.release()
            self._hold = None
        self._key_frame.set()
        self._relay.ended(self, error)


class MseRelay:
    """The feeds of every stream, and which streams are kept warm."""

    def __init__(
        self,
        hass: HomeAssistant,
        registry: StreamRegistry,
        server: Callable[[], Awaitable[Go2rtcServer]],
    ) -> None:
        """Initialize the relay."""
        self.hass = hass
        self.registry = registry
        self.async_server = server
        self._feeds: dict[str, list[Feed]] = {}
        self._locks: dict[str, asyncio.Lock] = {}
        self._warm: dict[str, LiveStream] = {}
        self._retries: dict[str, int] = {}
        self._timers: dict[str, asyncio.TimerHandle] = {}
        self._closing: set[Feed] = set()
        # Per stream: feeds that ended on their own, and the last reason.
        self._ends: dict[str, tuple[int, str]] = {}
        self._stopped = False

    async def async_attach(self, stream: LiveStream, codecs: str) -> Viewer:
        """Join (or open) a feed of the stream that the browser can play."""
        families = _families(codecs)
        async with self._lock(stream):
            feed = next(
                (
                    f
                    for f in self._feeds.get(stream.name, [])
                    if f.usable and f.carries() <= families
                ),
                None,
            )
            if feed is None:
                feed = await self._open(stream, codecs)
            return feed.attach()

    async def async_keep_warm(
        self,
        stream: LiveStream,
        enabled: bool,
        *,
        key_frame_timeout: float = KEY_FRAME_TIMEOUT,
    ) -> bool:
        """Keep a stream's feed open without viewers, or stop.

        Turning it on waits for the first key frame; returns whether one is
        cached.
        """
        name = stream.name
        if not enabled:
            self._warm.pop(name, None)
            self._retries.pop(name, None)
            if (timer := self._timers.pop(name, None)) is not None:
                timer.cancel()
            for feed in list(self._feeds.get(name, [])):
                if feed.warm:
                    feed.warm = False
                    if not feed.viewers:
                        feed.close()
            return False
        self._warm[name] = stream
        try:
            feed = await self._warm_feed(stream)
        except LiveError:
            self._warm.pop(name, None)
            raise
        return await feed.async_key_frame(key_frame_timeout)

    def warm_streams(self) -> list[str]:
        """Return the go2rtc names of the streams kept warm."""
        return list(self._warm)

    def state(self, stream: LiveStream) -> dict[str, Any] | None:
        """Return the cache of a stream (its first feed), if it has one.

        With how many of its feeds ended on their own, and the last reason.
        """
        feeds = self._feeds.get(stream.name)
        if not feeds:
            return None
        ends, last = self._ends.get(stream.name, (0, None))
        return {**feeds[0].state(), "ends": ends, "last_end": last}

    def forget(self, feed: Feed) -> None:
        """Stop new viewers joining a feed that is closing (use Feed.close)."""
        feeds = self._feeds.get(feed.stream.name)
        if feeds is not None and feed in feeds:
            feeds.remove(feed)
            if not feeds:
                del self._feeds[feed.stream.name]
        if not feed.ended:
            self._closing.add(feed)

    def ended(self, feed: Feed, error: str | None) -> None:
        """Note that a feed ended (use Feed); open a warm stream's again later."""
        self.forget(feed)
        self._closing.discard(feed)
        name = feed.stream.name
        ran = time.monotonic() - feed.started_at
        if error is not None and feed.mime:
            count, _last = self._ends.get(name, (0, ""))
            self._ends[name] = (count + 1, redact(error))
        if not feed.warm or name not in self._warm or self._stopped:
            return
        _LOGGER.warning(
            "A %s stream kept warm stopped after %.0f s (%s); opening it again",
            feed.stream.kind,
            ran,
            redact(error or "closed"),
        )
        self._retry(name, stable=ran >= STABLE_S)

    async def async_shutdown(self) -> None:
        """Close every feed (go2rtc is stopping)."""
        self._stopped = True
        for timer in self._timers.values():
            timer.cancel()
        self._timers.clear()
        self._warm.clear()
        feeds = [f for fs in self._feeds.values() for f in fs] + list(self._closing)
        for feed in feeds:
            feed.close()
        for feed in feeds:
            await feed.async_wait_closed()

    def _lock(self, stream: LiveStream) -> asyncio.Lock:
        return self._locks.setdefault(stream.name, asyncio.Lock())

    async def _open(self, stream: LiveStream, codecs: str) -> Feed:
        if self._stopped:
            raise LiveError("live view is stopping")
        feed = Feed(self, stream, codecs)
        await feed.async_open()
        if feed.ended:
            raise LiveError("the stream ended")
        self._feeds.setdefault(stream.name, []).append(feed)
        return feed

    async def _warm_feed(self, stream: LiveStream) -> Feed:
        async with self._lock(stream):
            feed = next((f for f in self._feeds.get(stream.name, []) if f.usable), None)
            if feed is None:
                feed = await self._open(stream, WARM_CODECS)
            feed.warm = True
            return feed

    def _retry(self, name: str, *, stable: bool) -> None:
        attempt = 0 if stable else self._retries.get(name, -1) + 1
        self._retries[name] = attempt
        delay = RETRY_S[min(attempt, len(RETRY_S) - 1)]
        if (timer := self._timers.pop(name, None)) is not None:
            timer.cancel()
        self._timers[name] = self.hass.loop.call_later(delay, self._rewarm, name)

    def _rewarm(self, name: str) -> None:
        self._timers.pop(name, None)
        if (stream := self._warm.get(name)) is None or self._stopped:
            return
        self.hass.async_create_background_task(
            self._async_rewarm(stream), "reolink_viewer keep a stream warm"
        )

    async def _async_rewarm(self, stream: LiveStream) -> None:
        try:
            await self._warm_feed(stream)
        except LiveError as err:
            _LOGGER.debug("Cannot keep %s warm yet: %s", stream.kind, err)
            if stream.name in self._warm and not self._stopped:
                self._retry(stream.name, stable=False)


async def _answer(ws: ClientWebSocketResponse) -> str:
    """Return go2rtc's MIME type for the feed, or raise its error."""
    async for msg in ws:
        if msg.type is not WSMsgType.TEXT:
            break
        if (error := _error_text(msg.data)) is not None:
            raise LiveError(redact(error))
        try:
            message = json.loads(msg.data)
        except ValueError:
            continue
        if isinstance(message, dict) and message.get("type") == "mse":
            return str(message.get("value") or "")
    raise LiveError("go2rtc closed the stream")


def _error_text(text: str) -> str | None:
    """Return go2rtc's error message, if the text is one."""
    try:
        message = json.loads(text)
    except ValueError:
        return None
    if isinstance(message, dict) and message.get("type") == "error":
        return str(message.get("value") or "go2rtc error")
    return None


def _families(codecs: str) -> frozenset[str]:
    """Return the codec families in a codec list: avc1.640029 → avc1."""
    return frozenset(
        c.strip().split(".")[0].lower() for c in codecs.split(",") if c.strip()
    )


def _mime_codecs(mime: str) -> str:
    """Return the codecs of a MIME type: video/mp4; codecs="a,b" → a,b."""
    _, _, rest = mime.partition("codecs=")
    return rest.strip().strip('"')

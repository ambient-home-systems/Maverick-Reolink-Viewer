"""How many live streams a host serves at once (Phase 3 step 1).

Run by an admin from the live check (``live/capacity``), one host at a time.
The test holds the host for itself: an exclusive scheduler job (no other
request to the host runs) and every slot of its stream budget (no recording
download starts). It reads streams through our go2rtc as a viewer would,
adding one at a time and keeping the earlier ones open:

1. the sub stream of each channel, one more per level (all of them: the grid);
2. then the main stream of the channel whose main has the highest bitrate
   (full screen), of those that play on their own: each is tried alone first,
   up to ``MAIN_TRIES``, and one that sends no video is left out, and said so
   (run 20: the Duo 3's 16 MP main sent none, to Home Assistant's own view
   too, so its "no frame" at level 7 said nothing about the NVR);
3. then a recording download at full speed (a playback fill).

Before the streams, the download runs alone for a baseline. At each level it
records the new stream's time to its first frame, the frames every stream
delivered per second against the camera's setting, the download's speed, and
how many clients the device lists as logged in (GetOnline), when it says.

A level **fails** when a stream delivers no frame. It **slows down** when a
stream falls below ``FPS_SHARE`` of its frame rate, the new stream's first
frame takes longer than a key-frame wait can explain (``KEY_INTERVAL_S``, the
longest these cameras use, and ``TTFF_MARGIN_S`` more), or the download falls
below ``FILL_SHARE`` of its speed alone. A first frame anywhere within a
key-frame interval is where the camera happened to be in it (Phase 3, run 9:
level 1 started in 0.38 s, level 6 in 3.47 s, both on 4 s key frames).
"""

import asyncio
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
import itertools
import logging
import struct
import time
from typing import Any

from aiohttp import ClientError, ClientSession

from custom_components.reolink_viewer import bridge
from custom_components.reolink_viewer.bridge import VodFile, VodMethod
from custom_components.reolink_viewer.devices import LiveSource
from custom_components.reolink_viewer.media import async_fetch
from custom_components.reolink_viewer.scheduler import Priority, Scheduler
from homeassistant.core import HomeAssistant

from .go2rtc import Go2rtcError, Go2rtcServer, redact
from .streams import LiveStream

_LOGGER = logging.getLogger(__name__)

FIRST_FRAME_TIMEOUT = 15.0
# Mains tried alone, heaviest first, for the main level.
MAIN_TRIES = 3
MEASURE_S = 6.0
FILL_ALONE_S = 4.0
FPS_SHARE = 0.85
FILL_SHARE = 0.7
TTFF_MARGIN_S = 3.0
# The longest key-frame interval measured on these cameras (runs 6-9: 4.37 s).
KEY_INTERVAL_S = 4.5
SLOT_TIMEOUT = 120.0
RUN_TIMEOUT = 900.0
FILL_MAX_BYTES = 2 * 1024**3
SEARCH_BACK = timedelta(hours=24)
CHUNK = 64 * 1024


class CapacityError(Exception):
    """The test cannot run."""


class SlotsBusyError(CapacityError):
    """The host's stream slots stayed in use (see ``busy_reason``)."""


def busy_reason(held: list[LiveStream], in_use: int) -> tuple[str, str]:
    """Say in plain words what kept a host's stream slots in use, and what to do.

    ``held``: the host's live streams still open (warm feeds set aside, so
    someone is watching them); ``in_use``: the slots in use, recordings
    downloading included.
    """
    cameras = sorted({stream.source.name for stream in held})
    downloads = max(0, in_use - len(held))
    what = []
    if cameras:
        what.append(f"live view of {_join(cameras)} is open")
    if downloads:
        what.append(
            f"{downloads} recording{'s are' if downloads > 1 else ' is'} downloading"
        )
    message = (
        f"Every stream slot of this host stayed in use for {_duration(SLOT_TIMEOUT)}"
    )
    if not what:
        return f"{message}.", "Run the check again in a few minutes."
    return (
        f"{message}: {' and '.join(what)}.",
        "Close live view on other screens and let playback finish, then run the "
        "check again.",
    )


def _duration(seconds: float) -> str:
    """Return "1 second", "45 seconds", "2 minutes"."""
    if seconds >= 120:
        return f"{round(seconds / 60)} minutes"
    whole = round(seconds)
    return f"{whole} second{'' if whole == 1 else 's'}"


def _join(names: list[str]) -> str:
    """Return "A", "A and B", "A, B and C"."""
    return names[0] if len(names) == 1 else f"{', '.join(names[:-1])} and {names[-1]}"


@dataclass(slots=True)
class Reader:
    """Reads one stream from go2rtc as fragmented MP4, counting its frames."""

    label: str
    name: str
    expected_fps: float | None
    began: float = field(default_factory=time.monotonic)
    first_frame: float | None = None
    frames: list[float] = field(default_factory=list)
    error: str | None = None
    ended: bool = False

    def first_frame_s(self) -> float | None:
        """Return seconds from the request to the first frame."""
        return None if self.first_frame is None else self.first_frame - self.began

    def fps(self, start: float, end: float) -> float:
        """Return the frames that arrived per second between two times."""
        count = sum(1 for t in self.frames if start <= t < end)
        return count / max(end - start, 1e-3)

    def longest_gap(self, start: float, end: float) -> float:
        """Return the longest wait between frames in the window (s)."""
        times = [start, *(t for t in self.frames if start <= t < end), end]
        return max(b - a for a, b in itertools.pairwise(times))

    async def run(self, server: Go2rtcServer) -> None:
        """Read until cancelled."""
        try:
            async with server.request(
                "GET",
                "/api/stream.mp4",
                [("src", self.name), ("video", "")],
                timeout=None,
            ) as response:
                if response.status != 200:
                    self.error = f"HTTP {response.status}"
                    return
                parser = BoxCounter()
                async for chunk in response.content.iter_chunked(CHUNK):
                    now = time.monotonic()
                    for _ in range(parser.feed(chunk)):
                        if self.first_frame is None:
                            self.first_frame = now
                        self.frames.append(now)
                self.error = "ended"
        except (ClientError, Go2rtcError) as err:
            self.error = redact(str(err) or type(err).__name__)
        finally:
            self.ended = True


class BoxCounter:
    """Counts the samples (frames) of the moofs in a fragmented MP4 stream."""

    def __init__(self) -> None:
        """Initialize an empty buffer."""
        self._buffer = bytearray()

    def feed(self, data: bytes) -> int:
        """Add bytes; return the samples of the moofs completed by them."""
        self._buffer += data
        samples = 0
        while len(self._buffer) >= 8:
            size, kind = struct.unpack_from(">I4s", self._buffer)
            if size < 8:
                raise ValueError("bad box")
            if len(self._buffer) < size:
                break
            if kind == b"moof":
                samples += moof_samples(bytes(self._buffer[8:size]))
            del self._buffer[:size]
        return samples


def moof_samples(payload: bytes) -> int:
    """Return the sample count of every trun in a moof's payload."""
    total = 0
    for kind, body in _children(payload):
        if kind == b"traf":
            for child, data in _children(body):
                if child == b"trun" and len(data) >= 8:
                    total += struct.unpack_from(">I", data, 4)[0]
    return total


def _children(payload: bytes) -> list[tuple[bytes, bytes]]:
    out: list[tuple[bytes, bytes]] = []
    pos = 0
    while pos + 8 <= len(payload):
        size, kind = struct.unpack_from(">I4s", payload, pos)
        if size < 8 or pos + size > len(payload):
            break
        out.append((kind, payload[pos + 8 : pos + size]))
        pos += size
    return out


class CapacityTest:
    """The capacity test of one host."""

    def __init__(
        self,
        hass: HomeAssistant,
        scheduler: Scheduler,
        server: Go2rtcServer,
        session: ClientSession,
        sources: list[LiveSource],
        *,
        include_main: bool = True,
        include_fill: bool = True,
        progress: Callable[[str], None] = lambda _message: None,
    ) -> None:
        """Initialize; ``sources`` are the host's channels (one per camera)."""
        if not sources:
            raise CapacityError("no cameras on this host")
        self._hass = hass
        self._scheduler = scheduler
        self._server = server
        self._session = session
        self._sources = sources
        self._entry_id = sources[0].entry_id
        self._include_main = include_main
        self._include_fill = include_fill
        self._progress = progress
        self._readers: list[Reader] = []
        self._tasks: list[asyncio.Task[None]] = []

    async def async_run(self) -> dict[str, Any]:
        """Hold the host and run the levels; return the report."""
        budget = self._scheduler.host(self._entry_id).streams
        self._progress("waiting for the host's stream slots")
        tickets = [budget.request(Priority.LIVE) for _ in range(budget.limit)]
        try:
            try:
                async with asyncio.timeout(SLOT_TIMEOUT):
                    for ticket in tickets:
                        await ticket.wait()
            except TimeoutError:
                raise SlotsBusyError("the host's stream slots stayed busy") from None
            return await self._scheduler.run(
                self._entry_id,
                self._levels,
                priority=Priority.LIVE,
                exclusive=True,
                timeout=RUN_TIMEOUT,
            )
        finally:
            for ticket in tickets:
                ticket.release()

    async def _levels(self) -> dict[str, Any]:
        host = bridge.async_get_host(self._hass, self._entry_id)
        report: dict[str, Any] = {"levels": []}
        users, why = await host.async_online_users()
        report["online_users_before"] = users if users is not None else f"n/a ({why})"
        fill: VodFile | None = None
        fill_channel: int | None = None
        if self._include_fill:
            fill_channel, fill = await self._find_fill(host)
            report["fill"] = (
                {"channel": fill_channel, "duration_s": _seconds(fill)}
                if fill is not None
                else "no recording in the last 24 h"
            )
        try:
            if fill is not None and fill_channel is not None:
                self._progress("download alone")
                alone = await self._fill(host, fill_channel, fill, FILL_ALONE_S)
                report["fill_alone_mbit_s"] = alone.get("mbit_s")
            plan = [(s, "sub") for s in self._sources]
            if self._include_main:
                main, left_out = await self._playing_main(host)
                if left_out:
                    report["main_left_out"] = left_out
                if main is not None:
                    plan.append((main, "main"))
            for number, (source, kind) in enumerate(plan, 1):
                self._progress(f"level {number}: + {source.name} {kind}")
                report["levels"].append(await self._add(host, number, source, kind))
            if fill is not None and fill_channel is not None:
                self._progress(f"level {len(plan) + 1}: + recording download")
                report["levels"].append(
                    await self._with_fill(host, len(plan) + 1, fill_channel, fill)
                )
        finally:
            for task in self._tasks:
                task.cancel()
            await asyncio.gather(*self._tasks, return_exceptions=True)
        users, why = await host.async_online_users()
        report["online_users_after"] = users if users is not None else f"n/a ({why})"
        report["verdict"] = verdict(report, report.get("fill_alone_mbit_s"))
        return report

    async def _add(
        self, host: bridge.ReolinkHostHandle, number: int, source: LiveSource, kind: str
    ) -> dict[str, Any]:
        opened = await self._open(host, source, kind)
        if opened is None:
            return {
                "level": number,
                "added": f"{source.name} {kind}",
                "error": "no URL",
            }
        reader, task = opened
        self._readers.append(reader)
        self._tasks.append(task)
        await _first_frame(reader)
        level = await self._measure(host, number, reader.label)
        level["first_frame_s"] = _round(reader.first_frame_s())
        return level

    async def _open(
        self, host: bridge.ReolinkHostHandle, source: LiveSource, kind: str
    ) -> tuple[Reader, asyncio.Task[None]] | None:
        """Start reading a stream through go2rtc; None when it has no URL."""
        stream = LiveStream(source, kind)
        url = await host.async_live_url(source.channel, stream.protocol, kind)
        if url is None:
            return None
        await self._server.async_set_stream(
            stream.name, url.value + ("#backchannel=0" if kind != "ext" else "")
        )
        reader = Reader(
            f"{source.name} {kind}", stream.name, _frame_rate(host, source, kind)
        )
        return reader, asyncio.create_task(reader.run(self._server))

    async def _playing_main(
        self, host: bridge.ReolinkHostHandle
    ) -> tuple[LiveSource | None, list[dict[str, str]]]:
        """Return the heaviest main that plays on its own, and those that did not."""
        left_out: list[dict[str, str]] = []
        heaviest = sorted(
            self._sources, key=lambda s: _bitrate(host, s, "main"), reverse=True
        )
        for source in heaviest[:MAIN_TRIES]:
            self._progress(f"{source.name} main on its own")
            opened = await self._open(host, source, "main")
            if opened is None:
                left_out.append({"camera": source.name, "why": "no URL"})
                continue
            reader, task = opened
            try:
                await _first_frame(reader)
            finally:
                task.cancel()
                await asyncio.gather(task, return_exceptions=True)
            if reader.first_frame is not None:
                return source, left_out
            why = reader.error or f"no frame in {round(FIRST_FRAME_TIMEOUT)} s"
            left_out.append({"camera": source.name, "why": why})
        return None, left_out

    async def _with_fill(
        self, host: bridge.ReolinkHostHandle, number: int, channel: int, file: VodFile
    ) -> dict[str, Any]:
        fill_task = asyncio.create_task(self._fill(host, channel, file, MEASURE_S + 1))
        await asyncio.sleep(1.0)  # past the download's first byte
        level = await self._measure(host, number, "recording download")
        level["fill"] = await fill_task
        return level

    async def _measure(
        self, host: bridge.ReolinkHostHandle, number: int, added: str
    ) -> dict[str, Any]:
        start = time.monotonic()
        await asyncio.sleep(MEASURE_S)
        end = time.monotonic()
        users, _why = await host.async_online_users()
        return {
            "level": number,
            "added": added,
            "streams": [
                {
                    "stream": r.label,
                    "fps": round(r.fps(start, end), 1),
                    "expected_fps": r.expected_fps,
                    "longest_gap_s": round(r.longest_gap(start, end), 2),
                    **({"error": r.error} if r.error and r.first_frame is None else {}),
                }
                for r in self._readers
            ],
            "online_users": users,
        }

    async def _find_fill(
        self, host: bridge.ReolinkHostHandle
    ) -> tuple[int | None, VodFile | None]:
        """Return the largest main recording of the last day, on any channel."""
        tz = host.timezone()
        now = datetime.now(tz).replace(tzinfo=None) if tz else datetime.now()
        best: tuple[int, VodFile] | None = None
        for source in self._sources:
            try:
                files = await host.async_search_vod_files(
                    source.channel, now - SEARCH_BACK, now, "main"
                )
            except Exception as err:  # noqa: BLE001 - another channel may do
                _LOGGER.debug("Capacity test search failed: %s", err)
                continue
            for file in files:
                if best is None or (file.size or 0) > (best[1].size or 0):
                    best = (source.channel, file)
        return (best[0], best[1]) if best else (None, None)

    async def _fill(
        self,
        host: bridge.ReolinkHostHandle,
        channel: int,
        file: VodFile,
        seconds: float,
    ) -> dict[str, Any]:
        try:
            _mime, url = await host.async_vod_url(channel, file, VodMethod.DOWNLOAD)
        except Exception as err:  # noqa: BLE001 - reported
            return {"error": bridge.redact_text(str(err) or type(err).__name__, ())}
        result = await async_fetch(
            self._session,
            url,
            max_bytes=FILL_MAX_BYTES,
            max_seconds=seconds,
            timeout=seconds + 20,
        )
        return {
            "mbit_s": result.mbit_s,
            "ttfb_ms": result.ttfb_ms,
            **({"error": result.error} if result.error else {}),
        }


async def _first_frame(reader: Reader) -> None:
    """Wait for a reader's first frame, its end or FIRST_FRAME_TIMEOUT."""
    end = time.monotonic() + FIRST_FRAME_TIMEOUT
    while reader.first_frame is None and not reader.ended:
        if time.monotonic() > end:
            break
        await asyncio.sleep(0.05)


def verdict(report: dict[str, Any], fill_alone: float | None) -> dict[str, Any]:
    """Return the first level that fails or slows down, and why."""
    for level in report["levels"]:
        reasons: list[str] = []
        for stream in level.get("streams", []):
            if stream["fps"] == 0:
                reasons.append(f"{stream['stream']} delivered no frame")
            elif stream.get("expected_fps") and stream["fps"] < (
                FPS_SHARE * stream["expected_fps"]
            ):
                reasons.append(
                    f"{stream['stream']} at {stream['fps']} of"
                    f" {stream['expected_fps']} fps"
                )
        first = level.get("first_frame_s")
        if first is not None:
            if first > KEY_INTERVAL_S + TTFF_MARGIN_S:
                reasons.append(
                    f"first frame {first} s (past a {KEY_INTERVAL_S} s"
                    f" key-frame wait and {TTFF_MARGIN_S} s)"
                )
        elif "first_frame_s" in level:
            reasons.append(f"{level['added']}: no first frame")
        fill = level.get("fill")
        speed = fill.get("mbit_s") if isinstance(fill, dict) else None
        if fill_alone and speed is not None and speed < FILL_SHARE * fill_alone:
            reasons.append(f"download at {speed} of {fill_alone} Mbit/s alone")
        if reasons:
            return {"first_failing_level": level["level"], "reasons": reasons}
    return {"first_failing_level": None, "reasons": []}


def _encoding(host: bridge.ReolinkHostHandle, source: LiveSource) -> dict[str, Any]:
    try:
        encodings: dict[str, Any] = host.channel_details(source.channel)["encodings"]
    except Exception:  # noqa: BLE001 - optional
        return {}
    return encodings


def _frame_rate(
    host: bridge.ReolinkHostHandle, source: LiveSource, kind: str
) -> float | None:
    value = (_encoding(host, source).get(kind) or {}).get("frame_rate")
    return float(value) if value else None


def _bitrate(host: bridge.ReolinkHostHandle, source: LiveSource, kind: str) -> int:
    value = (_encoding(host, source).get(kind) or {}).get("bit_rate")
    return int(value) if value else 0


def _seconds(file: VodFile) -> int:
    return int((file.end - file.start).total_seconds())


def _round(value: float | None) -> float | None:
    return None if value is None else round(value, 2)

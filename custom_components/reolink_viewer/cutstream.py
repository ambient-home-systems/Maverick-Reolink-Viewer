"""A recording read as a cut over Home Assistant's session, muxed (Phase 12b).

The battery Doorbell keeps its recordings on its SD card and has no HTTP
download; Phase 12a found that a download cut (143) over Home Assistant's own
session to it brings the first key frame in under half a second and the rest
at about twice real time. So such a camera's recording is fetched as one cut
from its start to its end (``bridge.ReolinkHostHandle.async_stream_cut``),
its blocks are muxed into fragmented MP4 (``baichuan_mux.BaichuanMuxer``,
the media time 0 at the recording's start) and the bytes stand where an
NVR's HTTP download would: the cache writes and indexes them alike, and every
reader of the original (the MSE view, the file player, saved events) serves
them unchanged.

The muxer places the first key frame by its own POSIX time when that is near
the recording's start, else at once at the start (no other cut's blocks can
arrive here: reolink-aio routes a payload by its message), and its stats say
which (``anchor``). The cut's start and end go to the device in its local
time, as it keeps them.

v0.70.1 (the owner's first try: "timeout", nothing played): the cut keeps
time itself rather than wait out reolink-aio's 30 s per chunk. Nothing
within ``FIRST_CHUNK_S`` of the request, or a silence of ``QUIET_S`` before
the recording's end, fails the cut and says how far it came; a silence once
the recording's length has come is its end (a device may not mark it).
Pure stream work: the cache holds the stream slot and the disk space.
"""

import asyncio
from collections.abc import AsyncGenerator, Callable
import contextlib
from datetime import datetime, tzinfo
import time
from typing import Any

from .baichuan_client import StreamStats
from .baichuan_media import Block
from .baichuan_mux import BaichuanMuxer

# The first bytes come within this, or the device sent nothing (12a: 315 ms).
FIRST_CHUNK_S = 20.0
# A silence this long is the cut's end, or its failure (12a: twice real time).
QUIET_S = 10.0
# A silence counts as the end once the media has come within this of the end.
END_TOLERANCE_S = 5.0


class CutStreamError(Exception):
    """A cut that failed: what came of it is in the message."""


def local_wall(unix: float, tz: tzinfo | None) -> datetime:
    """Return a moment as the device's wall clock reads it (naive)."""
    if tz is None:
        return datetime.fromtimestamp(unix)
    return datetime.fromtimestamp(unix, tz).replace(tzinfo=None)


async def muxed_cut(
    chunks: AsyncGenerator[bytes],
    *,
    origin_unix: float,
    timing: dict[str, Any],
    length_s: float | None = None,
    clock: Callable[[], float] = time.monotonic,
    first_chunk_s: float = FIRST_CHUNK_S,
    quiet_s: float = QUIET_S,
) -> AsyncGenerator[bytes]:
    """Yield the fragmented MP4 of a cut's media: the init, then fragments.

    ``chunks`` is the cut's payload as it arrives; ``origin_unix`` the
    recording's start (UTC POSIX seconds), its media time 0; ``length_s`` its
    length, if known (a silence then ends it once that much has come).
    ``timing`` gets the cut's numbers: its first chunk and first fragment
    (ms), the bytes and blocks it brought, how its start was placed and how it
    ended. Closing this generator closes ``chunks`` (which ends the cut on the
    device). Raises :class:`CutStreamError` when the cut fails.
    """
    began = clock()
    muxer = BaichuanMuxer(origin_unix, origin_unix, hold_far=False)
    out: list[bytes] = []

    def on_block(block: Block) -> None:
        out.extend(muxer.feed(block))

    stats = StreamStats(started=began, on_block=on_block, analyse=False)
    cut: dict[str, Any] = {}
    timing["cut"] = cut
    try:
        async with contextlib.aclosing(chunks):
            while True:
                limit = quiet_s if stats.chunks else first_chunk_s
                try:
                    async with asyncio.timeout(limit):
                        chunk = await anext(chunks)
                except StopAsyncIteration:
                    cut["ended"] = "device"
                    break
                except TimeoutError as err:
                    if _came_whole(muxer, length_s):
                        # All of it came and the device went quiet: the end.
                        cut["ended"] = "quiet"
                        break
                    raise CutStreamError(
                        _stalled(stats, muxer, length_s, limit)
                    ) from err
                except Exception as err:
                    raise CutStreamError(
                        f"the doorbell's cut failed: {type(err).__name__}: {err}"[:300]
                    ) from err
                stats.feed(chunk, clock())
                if out:
                    cut.setdefault("first_fragment_ms", _ms(began, clock()))
                    data = b"".join(out)
                    out.clear()
                    yield data
        stats.end(0, clock())
        out.extend(muxer.finish())
        if out:
            cut.setdefault("first_fragment_ms", _ms(began, clock()))
            yield b"".join(out)
    finally:
        raw = stats.as_dict()
        media = muxer.last_time
        cut.update(
            {
                "first_chunk_ms": raw["first_chunk_ms"],
                "bytes": raw["bytes"],
                "key_frames": raw["key_frames"],
                "frames": raw["frames"],
                "audio_blocks": raw["audio_blocks"],
                "resyncs": raw["resyncs"],
                "media_s": None if media is None else round(media, 1),
                "codec": muxer.codec,
                "anchor": muxer.stats.anchor,
                "anchor_offset_s": muxer.stats.anchor_offset_s,
            }
        )


def _came_whole(muxer: BaichuanMuxer, length_s: float | None) -> bool:
    media = muxer.last_time
    if media is None or length_s is None:
        return False
    return media >= length_s - END_TOLERANCE_S


def _stalled(
    stats: StreamStats, muxer: BaichuanMuxer, length_s: float | None, limit: float
) -> str:
    """Say how far a cut that went quiet came."""
    if not stats.chunks:
        return f"the doorbell sent nothing within {limit:.0f} s"
    if muxer.last_time is None:
        return f"the doorbell stopped after {stats.total_bytes} bytes, before a picture"
    whole = "" if length_s is None else f" of {length_s:.0f}"
    return f"the doorbell stopped after {muxer.last_time:.0f}{whole} s of the recording"


def _ms(start: float, now: float) -> float:
    return round((now - start) * 1000, 1)

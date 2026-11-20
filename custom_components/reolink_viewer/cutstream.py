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
the recording's start, else at the start (its stats say which: ``anchor``).
The cut's start and end go to the device in its local time, as it keeps them.
Pure stream work: the cache holds the stream slot and the disk space.
"""

from collections.abc import AsyncGenerator, Callable
import contextlib
from datetime import datetime, tzinfo
import time
from typing import Any

from .baichuan_client import StreamStats
from .baichuan_media import Block
from .baichuan_mux import BaichuanMuxer


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
    clock: Callable[[], float] = time.monotonic,
) -> AsyncGenerator[bytes]:
    """Yield the fragmented MP4 of a cut's media: the init, then fragments.

    ``chunks`` is the cut's payload as it arrives; ``origin_unix`` the
    recording's start (UTC POSIX seconds), its media time 0. ``timing`` gets
    the cut's numbers: its first chunk and first fragment (ms), the bytes and
    blocks it brought, how its start was placed. Closing this generator closes
    ``chunks`` (which ends the cut on the device).
    """
    began = clock()
    muxer = BaichuanMuxer(origin_unix, origin_unix)
    out: list[bytes] = []

    def on_block(block: Block) -> None:
        out.extend(muxer.feed(block))

    stats = StreamStats(started=began, on_block=on_block, analyse=False)
    cut: dict[str, Any] = {}
    timing["cut"] = cut
    try:
        async with contextlib.aclosing(chunks):
            async for chunk in chunks:
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
        cut.update(
            {
                "first_chunk_ms": raw["first_chunk_ms"],
                "bytes": raw["bytes"],
                "key_frames": raw["key_frames"],
                "frames": raw["frames"],
                "audio_blocks": raw["audio_blocks"],
                "resyncs": raw["resyncs"],
                "codec": muxer.codec,
                "anchor": muxer.stats.anchor,
                "anchor_offset_s": muxer.stats.anchor_offset_s,
            }
        )


def _ms(start: float, now: float) -> float:
    return round((now - start) * 1000, 1)

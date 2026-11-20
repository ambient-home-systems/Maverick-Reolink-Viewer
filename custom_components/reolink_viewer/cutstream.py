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
time itself rather than wait out reolink-aio's 30 s per chunk.

v0.70.2 (the owner's second try: "the doorbell stopped after 31 of 227 s"):
a cut that goes quiet for ``QUIET_S`` before the recording's end is asked
again from a little before where its media stopped (``RESUME_LEAD_S``), and
the muxer joins the new span to what it has by the frame counter (Phase 5's
spans), so a pause, a lost packet or a stall of the device costs a few
seconds, not the recording. It fails only when a span brings nothing: no
chunk within ``FIRST_CHUNK_S`` (``RESUME_FIRST_S`` for a later span, which
may wait for reolink-aio to end the one before), or twice no new media, or
``MAX_SPANS``. A silence once the recording's length has come is its end (a
device may not mark it). Pure stream work: the cache holds the stream slot
and the disk space.
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
# A later span's: it may wait for reolink-aio to end the one before (144).
RESUME_FIRST_S = 35.0
# A silence this long ends a span (12a: twice real time, no gap).
QUIET_S = 6.0
# A silence counts as the end once the media has come within this of the end.
END_TOLERANCE_S = 5.0
# A resumed span starts this much before where the media stopped.
RESUME_LEAD_S = 4.0
# At most this many spans for one recording.
MAX_SPANS = 20


class CutStreamError(Exception):
    """A cut that failed: what came of it is in the message."""


def local_wall(unix: float, tz: tzinfo | None) -> datetime:
    """Return a moment as the device's wall clock reads it (naive)."""
    if tz is None:
        return datetime.fromtimestamp(unix)
    return datetime.fromtimestamp(unix, tz).replace(tzinfo=None)


async def muxed_cut(
    open_cut: Callable[[float], AsyncGenerator[bytes]],
    *,
    origin_unix: float,
    timing: dict[str, Any],
    length_s: float | None = None,
    clock: Callable[[], float] = time.monotonic,
    first_chunk_s: float = FIRST_CHUNK_S,
    resume_first_s: float = RESUME_FIRST_S,
    quiet_s: float = QUIET_S,
) -> AsyncGenerator[bytes]:
    """Yield the fragmented MP4 of a recording's cut: the init, then fragments.

    ``open_cut(start_unix)`` opens a cut from that moment (UTC POSIX seconds)
    to the recording's end; ``origin_unix`` is the recording's start, its
    media time 0, and ``length_s`` its length, if known. ``timing["sd_cut"]``
    gets the cut's numbers: its first chunk and fragment (ms), the bytes and
    blocks it brought, its spans, how far its media came, how its start was
    placed and how it ended. Closing this generator closes the open cut
    (which ends it on the device). Raises :class:`CutStreamError` when it
    fails.
    """
    began = clock()
    muxer = BaichuanMuxer(origin_unix, origin_unix, hold_far=False)
    out: list[bytes] = []

    def on_block(block: Block) -> None:
        out.extend(muxer.feed(block))

    cut: dict[str, Any] = {"length_s": length_s}
    spans: list[dict[str, Any]] = []
    timing["sd_cut"] = cut
    start = origin_unix
    fruitless = 0
    try:
        while True:
            span_began = clock()
            before = muxer.last_time
            stats = StreamStats(started=span_began, on_block=on_block, analyse=False)
            span: dict[str, Any] = {"from_s": round(start - origin_unix, 1)}
            spans.append(span)
            cut["spans"] = len(spans)
            ended = "device"
            async with contextlib.aclosing(open_cut(start)) as chunks:
                while True:
                    if stats.chunks:
                        limit = quiet_s
                    else:
                        limit = resume_first_s if len(spans) > 1 else first_chunk_s
                    try:
                        async with asyncio.timeout(limit):
                            chunk = await anext(chunks)
                    except StopAsyncIteration:
                        break
                    except TimeoutError as err:
                        if not stats.chunks:
                            raise CutStreamError(
                                _stalled(stats, muxer, length_s, limit, len(spans))
                            ) from err
                        ended = "quiet"
                        break
                    except Exception as err:
                        raise CutStreamError(
                            f"the doorbell's cut failed: {type(err).__name__}: {err}"[
                                :300
                            ]
                        ) from err
                    stats.feed(chunk, clock())
                    if out:
                        cut.setdefault("first_fragment_ms", _ms(began, clock()))
                        # How far it came, for the panel while it fills.
                        cut["media_s"] = _round(muxer.last_time)
                        cut["codec"] = muxer.codec
                        data = b"".join(out)
                        out.clear()
                        yield data
            span.update(
                bytes=stats.total_bytes,
                first_chunk_ms=stats.as_dict()["first_chunk_ms"],
                ended=ended,
            )
            if ended == "device":
                # Its last blocks are whole: the device marked the end.
                stats.end(0, clock())
                break
            if _came_whole(muxer, length_s):
                # All of it came and the device went quiet: the end.
                break
            media = muxer.last_time
            fruitless = 0 if _advanced(before, media) else fruitless + 1
            if fruitless >= 2 or len(spans) >= MAX_SPANS:
                raise CutStreamError(_stalled(stats, muxer, length_s, None, len(spans)))
            # Quiet before the end: ask again from a little before it stopped.
            muxer.pause()
            start = origin_unix + max((media or 0.0) - RESUME_LEAD_S, 0.0)
        out.extend(muxer.finish())
        if out:
            cut.setdefault("first_fragment_ms", _ms(began, clock()))
            yield b"".join(out)
    finally:
        media = muxer.last_time
        cut.update(
            {
                "first_chunk_ms": spans[0].get("first_chunk_ms") if spans else None,
                "bytes": sum(s.get("bytes", 0) for s in spans),
                "spans": len(spans),
                "ended": spans[-1].get("ended") if spans else None,
                "key_frames": muxer.stats.key_frames,
                "frames": muxer.stats.frames,
                "overlap_skipped": muxer.stats.overlap_skipped,
                "media_s": _round(media),
                "codec": muxer.codec,
                "anchor": muxer.stats.anchor,
                "anchor_offset_s": muxer.stats.anchor_offset_s,
                "span_list": spans[-5:],
            }
        )


def _advanced(before: float | None, media: float | None) -> bool:
    """Return whether a span brought at least a second of new media."""
    if media is None:
        return False
    return before is None or media >= before + 1.0


def _came_whole(muxer: BaichuanMuxer, length_s: float | None) -> bool:
    media = muxer.last_time
    if media is None or length_s is None:
        return False
    return media >= length_s - END_TOLERANCE_S


def _stalled(
    stats: StreamStats,
    muxer: BaichuanMuxer,
    length_s: float | None,
    limit: float | None,
    spans: int,
) -> str:
    """Say how far a cut that went quiet came."""
    tries = f" ({spans} tries)" if spans > 1 else ""
    if not stats.chunks and limit is not None and muxer.last_time is None:
        return f"the doorbell sent nothing within {limit:.0f} s{tries}"
    if muxer.last_time is None:
        return f"the doorbell stopped before a picture{tries}"
    whole = "" if length_s is None else f" of {length_s:.0f}"
    return (
        f"the doorbell stopped after {muxer.last_time:.0f}{whole} s "
        f"of the recording{tries}"
    )


def _round(value: float | None) -> float | None:
    return None if value is None else round(value, 1)


def _ms(start: float, now: float) -> float:
    return round((now - start) * 1000, 1)

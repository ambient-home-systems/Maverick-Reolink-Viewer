"""Segment index (sidx) for cached fragmented MP4 recordings.

The NVR streams fragmented MP4 with no index. Given such a file over HTTP
Range, Chrome reads all of it to learn the duration before it reports
metadata, so the first frame waits for the whole file. A ``sidx`` box per
track right after ``moov`` (what ``ffmpeg -movflags global_sidx`` writes) lets
it jump straight to the fragment it needs.

The cache reserves room for the index while it downloads (:func:`plan_reserve`
places a ``free`` box after ``moov``) and fills it in once the file is
complete (:func:`build_index`). Everything after the reserved box moves by its
size. The NVR's track fragments give absolute file positions
(``base_data_offset`` in ``tfhd``), so :class:`OffsetShifter` adds that size to
each as the file streams by.
"""

from dataclasses import dataclass
import math
import os
import struct
from typing import BinaryIO

from .mp4 import Box, parse_box_header

# Give up planning when moov and the first moof are not within this prefix.
PLAN_LIMIT = 1024 * 1024
# A moof is held whole to shift its offsets; larger ones end the fill.
MAX_MOOF = 4 * 1024 * 1024
# Room for one reference per second per track (the NVR's fragments are ~2 s).
_REFS_PER_SECOND = 1.0
_SPARE_REFS = 32
MIN_RESERVE = 1024
MAX_RESERVE = 512 * 1024
_SIDX_FIXED = 40  # box header, version/flags, ids, times, counts (version 1)
_REF_SIZE = 12
_MAX_REFS = 0xFFFF
_MAX_FRAGMENTS = 200_000

_TFHD_BASE_OFFSET = 0x01
_TFHD_DESCRIPTION = 0x02
_TFHD_DURATION = 0x08
_TFHD_SIZE = 0x10
_TFHD_FLAGS = 0x20
_TRUN_DATA_OFFSET = 0x01
_TRUN_FIRST_FLAGS = 0x04
_TRUN_DURATION = 0x100
_TRUN_SIZE = 0x200
_TRUN_FLAGS = 0x400
_TRUN_CTO = 0x800
_NON_SYNC = 0x00010000


@dataclass(frozen=True, slots=True)
class Plan:
    """Where to put the reserved box (None: leave the file as it is)."""

    insert_at: int | None
    reserve: int = 0
    reason: str | None = None


@dataclass(frozen=True, slots=True)
class TrackInfo:
    """What the index needs to know about one track."""

    track_id: int
    timescale: int
    default_duration: int = 0
    default_flags: int = 0


def free_box(size: int) -> bytes:
    """Return a ``free`` box of exactly ``size`` bytes (at least 8)."""
    return struct.pack(">I4s", size, b"free") + bytes(size - 8)


def plan_reserve(prefix: bytes, duration_s: float) -> Plan | None:
    """Decide from the start of a download where to reserve the index.

    Returns None while more bytes are needed. The box goes right after moov
    when moov is followed by a moof. The bytes after it are then fed through
    an :class:`OffsetShifter`.
    """
    offset = 0
    moov: Box | None = None
    while True:
        box = parse_box_header(prefix[offset : offset + 16], offset)
        if box is None:
            return _undecided(prefix, "no box header")
        if box.end is None:
            return Plan(None, reason=f"{box.type} runs to the end of the file")
        if moov is not None:
            if box.type != "moof":
                return Plan(None, reason=f"{box.type} after moov")
            if len(prefix) < box.end:
                return _undecided(prefix, "first moof incomplete")
            tracks = _count(prefix[moov.payload : moov.end], "trak")
            if not tracks:
                return Plan(None, reason="no tracks")
            return Plan(moov.end, _reserve(tracks, duration_s))
        if box.type in {"mdat", "moof", "sidx"}:
            return Plan(None, reason=f"{box.type} before moov ends")
        if box.type == "moov":
            if len(prefix) < box.end:
                return _undecided(prefix, "moov incomplete")
            moov = box
        offset = box.end


class OffsetShiftError(Exception):
    """The stream cannot be followed to shift its offsets."""


class OffsetShifter:
    """Add ``shift`` to every absolute data offset of a streaming MP4.

    Feed it the bytes that follow the reserved box, from a top-level box
    boundary, in order. Each moof is held until it is complete, its
    ``tfhd.base_data_offset`` values are moved, and it is passed on; other
    boxes pass through as they come. An ``mfra`` (absolute offsets too) is
    turned into a ``free`` box, which players skip.
    """

    def __init__(self, shift: int) -> None:
        """Initialize the shifter."""
        self._shift = shift
        self._pending = bytearray()  # an incomplete box header or moof
        self._passing = 0  # bytes of the current box still to pass through
        self._to_end = False  # the current box runs to the end of the stream

    def feed(self, data: bytes) -> bytes:
        """Return the bytes ready to write (the input, shifted, maybe later)."""
        out = bytearray()
        view = memoryview(data)
        while view:
            if self._to_end:
                out += view
                break
            if self._passing:
                n = min(self._passing, len(view))
                out += view[:n]
                view = view[n:]
                self._passing -= n
                continue
            # What is needed can grow once more of the header is known.
            take = min(len(view), self._need() - len(self._pending))
            self._pending += view[:take]
            view = view[take:]
            if len(self._pending) >= self._need():
                out += self._box_ready()
        return bytes(out)

    def finish(self) -> bytes:
        """Return what is left at the end of the stream (passed on as it is)."""
        rest, self._pending = bytes(self._pending), bytearray()
        return rest

    def _need(self) -> int:
        """How many bytes the pending box needs before it can be handled."""
        if len(self._pending) < 8:
            return 8
        size = int.from_bytes(self._pending[:4], "big")
        if size == 1:
            if len(self._pending) < 16:
                return 16
            size = int.from_bytes(self._pending[8:16], "big")
        if self._pending[4:8] == b"moof" and size:
            if size > MAX_MOOF:
                raise OffsetShiftError(f"moof of {size} bytes")
            return size
        return len(self._pending)  # the header is enough

    def _box_ready(self) -> bytes:
        box = parse_box_header(bytes(self._pending[:16]), 0)
        if box is None:
            raise OffsetShiftError("unparseable box header")
        data, self._pending = self._pending, bytearray()
        if box.type == "moof":
            _shift_moof(data, box.header, self._shift)
            return bytes(data)
        if box.type == "mfra":
            data[4:8] = b"free"
        if box.size is None:
            self._to_end = True
        else:
            self._passing = box.size - len(data)
        return bytes(data)


def _shift_moof(moof: bytearray, header: int, shift: int) -> None:
    """Move every tfhd.base_data_offset of a moof (in place)."""
    offset = header
    while offset + 8 <= len(moof):
        box = parse_box_header(bytes(moof[offset : offset + 16]), offset)
        if box is None or box.end is None or box.end > len(moof):
            raise OffsetShiftError("malformed moof")
        if box.type == "traf":
            child = box.payload
            while child + 8 <= box.end:
                inner = parse_box_header(bytes(moof[child : child + 16]), child)
                if inner is None or inner.end is None or inner.end > box.end:
                    raise OffsetShiftError("malformed traf")
                at = inner.payload
                if inner.type == "tfhd" and moof[at + 3] & _TFHD_BASE_OFFSET:
                    (base,) = struct.unpack_from(">Q", moof, at + 8)
                    struct.pack_into(">Q", moof, at + 8, base + shift)
                child = inner.end
        offset = box.end


def _undecided(prefix: bytes, reason: str) -> Plan | None:
    return Plan(None, reason=reason) if len(prefix) >= PLAN_LIMIT else None


def _reserve(tracks: int, duration_s: float) -> int:
    refs = math.ceil(max(duration_s, 0) * _REFS_PER_SECOND) + _SPARE_REFS
    size = 8 + tracks * (_SIDX_FIXED + _REF_SIZE * min(refs, _MAX_REFS))
    return max(MIN_RESERVE, min(size, MAX_RESERVE))


def build_index(path: str, free_at: int, free_size: int) -> bytes | None:
    """Return the sidx boxes plus a free box, exactly ``free_size`` bytes.

    Reads the file's moov and every moof (mdat payloads are skipped). Returns
    None when the file does not fit the pattern or the index does not fit.
    Blocking: run it in an executor.
    """
    with open(path, "rb") as file:
        size = os.fstat(file.fileno()).st_size
        boxes = _top_level(file, size)
        moov = next((b for b in boxes if b.type == "moov"), None)
        free = next((b for b in boxes if b.offset == free_at), None)
        if moov is None or moov.end != free_at or free is None:
            return None
        if free.type != "free" or free.size != free_size:
            return None
        tracks = _tracks(_read(file, moov.payload, moov.end))
        first = free_at + free_size
        moofs = [b for b in boxes if b.type == "moof" and b.offset >= first]
        if not tracks or not moofs or moofs[0].offset != first:
            return None
        fragments = []
        for i, moof in enumerate(moofs):
            assert moof.end is not None
            nxt = moofs[i + 1].offset if i + 1 < len(moofs) else size
            times = _fragment_times(_read(file, moof.payload, moof.end), tracks)
            if times is None:
                return None
            fragments.append((nxt - moof.offset, times))
    return _sidx(list(tracks.values()), fragments, free_size)


def _top_level(file: BinaryIO, size: int) -> list[Box]:
    boxes: list[Box] = []
    offset = 0
    while offset < size and len(boxes) < _MAX_FRAGMENTS:
        box = parse_box_header(_read(file, offset, min(offset + 16, size)), offset)
        if box is None:
            break
        boxes.append(box)
        if box.end is None or box.end > size:
            break
        offset = box.end
    return boxes


def _read(file: BinaryIO, start: int, end: int | None) -> bytes:
    file.seek(start)
    return file.read((end or start) - start)


def _children(data: bytes) -> list[tuple[str, bytes]]:
    result = []
    offset = 0
    while offset + 8 <= len(data):
        box = parse_box_header(data[offset : offset + 16], offset)
        if box is None or box.end is None or box.end > len(data):
            break
        result.append((box.type, data[box.payload : box.end]))
        offset = box.end
    return result


def _count(data: bytes, box_type: str) -> int:
    return sum(1 for t, _ in _children(data) if t == box_type)


def _flags(payload: bytes) -> int:
    return int.from_bytes(payload[1:4], "big")


def _tracks(moov: bytes) -> dict[int, TrackInfo]:
    """Track ids and timescales in moov order, with trex defaults."""
    order: list[tuple[int, int]] = []
    defaults: dict[int, tuple[int, int]] = {}
    for box_type, payload in _children(moov):
        if box_type == "trak":
            track = _trak(payload)
            if track is not None:
                order.append(track)
        elif box_type == "mvex":
            for child_type, trex in _children(payload):
                if child_type == "trex" and len(trex) >= 24:
                    track_id, _desc, duration, _size, flags = struct.unpack(
                        ">IIIII", trex[4:24]
                    )
                    defaults[track_id] = (duration, flags)
    return {
        track_id: TrackInfo(track_id, timescale, *defaults.get(track_id, (0, 0)))
        for track_id, timescale in order
    }


def _trak(trak: bytes) -> tuple[int, int] | None:
    track_id = timescale = None
    for box_type, payload in _children(trak):
        if box_type == "tkhd" and len(payload) >= 24:
            at = 20 if payload[0] == 1 else 12
            (track_id,) = struct.unpack(">I", payload[at : at + 4])
        elif box_type == "mdia":
            for child_type, mdhd in _children(payload):
                if child_type == "mdhd" and len(mdhd) >= 24:
                    at = 20 if mdhd[0] == 1 else 12
                    (timescale,) = struct.unpack(">I", mdhd[at : at + 4])
    if not track_id or not timescale:
        return None
    return track_id, timescale


def _fragment_times(
    moof: bytes, tracks: dict[int, TrackInfo]
) -> dict[int, tuple[int | None, int, bool]] | None:
    """Per track: (decode time or None, duration, starts with a sync sample)."""
    times: dict[int, tuple[int | None, int, bool]] = {}
    for box_type, traf in _children(moof):
        if box_type != "traf":
            continue
        parsed = _traf(traf, tracks)
        if parsed is None:
            return None
        track_id, decode, duration, sync = parsed
        times[track_id] = (decode, duration, sync)
    return times


def _traf(
    traf: bytes, tracks: dict[int, TrackInfo]
) -> tuple[int, int | None, int, bool] | None:
    children = _children(traf)
    tfhd = next((p for t, p in children if t == "tfhd"), None)
    if tfhd is None or len(tfhd) < 8:
        return None
    flags = _flags(tfhd)
    (track_id,) = struct.unpack(">I", tfhd[4:8])
    track = tracks.get(track_id)
    if track is None:
        return None
    at = 8
    if flags & _TFHD_BASE_OFFSET:
        at += 8
    if flags & _TFHD_DESCRIPTION:
        at += 4
    default_duration = track.default_duration
    default_flags = track.default_flags
    if flags & _TFHD_DURATION:
        (default_duration,) = struct.unpack(">I", tfhd[at : at + 4])
        at += 4
    if flags & _TFHD_SIZE:
        at += 4
    if flags & _TFHD_FLAGS:
        (default_flags,) = struct.unpack(">I", tfhd[at : at + 4])
    decode: int | None = None
    duration = 0
    sync: bool | None = None
    for box_type, payload in children:
        if box_type == "tfdt" and len(payload) >= 8:
            if payload[0] == 1:
                (decode,) = struct.unpack(">Q", payload[4:12])
            else:
                (decode,) = struct.unpack(">I", payload[4:8])
        elif box_type == "trun":
            run = _trun(payload, default_duration, default_flags)
            if run is None:
                return None
            run_duration, first_flags = run
            duration += run_duration
            if sync is None and first_flags is not None:
                sync = not first_flags & _NON_SYNC
    return track_id, decode, duration, bool(sync)


def _trun(
    trun: bytes, default_duration: int, default_flags: int
) -> tuple[int, int | None] | None:
    """Return the run's duration and its first sample's flags."""
    if len(trun) < 8:
        return None
    flags = _flags(trun)
    (count,) = struct.unpack(">I", trun[4:8])
    at = 8
    if flags & _TRUN_DATA_OFFSET:
        at += 4
    first_flags: int | None = None
    if flags & _TRUN_FIRST_FLAGS:
        (first_flags,) = struct.unpack(">I", trun[at : at + 4])
        at += 4
    fields = [
        f for f in (_TRUN_DURATION, _TRUN_SIZE, _TRUN_FLAGS, _TRUN_CTO) if flags & f
    ]
    stride = 4 * len(fields)
    if len(trun) < at + stride * count:
        return None
    if flags & _TRUN_DURATION:
        duration = sum(
            struct.unpack(">I", trun[at + i * stride : at + i * stride + 4])[0]
            for i in range(count)
        )
    else:
        duration = default_duration * count
    if first_flags is None and count:
        if flags & _TRUN_FLAGS:
            pos = at + 4 * fields.index(_TRUN_FLAGS)
            (first_flags,) = struct.unpack(">I", trun[pos : pos + 4])
        else:
            first_flags = default_flags
    return duration, first_flags


def _sidx(
    tracks: list[TrackInfo],
    fragments: list[tuple[int, dict[int, tuple[int | None, int, bool]]]],
    free_size: int,
) -> bytes | None:
    if len(fragments) > _MAX_REFS:
        return None
    boxes: list[tuple[TrackInfo, int, bytes]] = []
    for track in tracks:
        start: int | None = None
        clock = 0
        refs: list[bytes] = []
        for size, times in fragments:
            decode, duration, sync = times.get(track.track_id, (None, 0, True))
            if start is None and decode is not None:
                start = decode - clock
            clock += duration
            if size > 0x7FFFFFFF:
                return None
            sap = 0x90000000 if sync else 0  # starts_with_SAP, SAP type 1
            refs.append(struct.pack(">III", size, duration, sap))
        boxes.append((track, max(start or 0, 0), b"".join(refs)))
    total = sum(_SIDX_FIXED + len(table) for _, _, table in boxes)
    filler = free_size - total
    if filler != 0 and filler < 8:
        return None
    out = bytearray()
    after = total
    for track, earliest, table in boxes:
        size = _SIDX_FIXED + len(table)
        after -= size
        out += struct.pack(
            ">I4sIIIQQHH",
            size,
            b"sidx",
            1 << 24,  # version 1, flags 0
            track.track_id,
            track.timescale,
            earliest,
            after + filler,  # to the first moof: later sidx boxes, then free
            0,
            len(table) // _REF_SIZE,
        )
        out += table
    if filler:
        out += free_box(filler)
    return bytes(out)

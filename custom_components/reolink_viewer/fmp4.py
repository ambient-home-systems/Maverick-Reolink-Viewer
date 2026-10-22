"""Fragments of a cached recording, made ready for Media Source Extensions.

The NVR's fragmented MP4s are not MSE-ready as stored (IMPLEMENTATION_PLAN.md,
Phase 2B): each ``tfhd`` gives an absolute ``base_data_offset`` and no ``traf``
has a ``tfdt``, while the W3C ISO BMFF byte stream format requires
movie-fragment relative addressing and a ``tfdt`` in every ``traf``. So:

- :class:`FragmentIndex` follows a cache file as it grows: the init segment
  (``ftyp`` + ``moov``) and its codecs, then each fragment (``moof`` + ``mdat``)
  with its bytes and its decode time per track, counted from the start;
- :func:`normalize_fragment` rewrites one fragment: every ``traf`` gets
  ``default-base-is-moof`` without ``base-data-offset``, a ``tfdt`` with the
  track's decode time, and ``trun`` data offsets relative to the ``moof``.
  Sample data and every other box are copied as stored.

Everything here is blocking file and byte work: run it in the executor.
"""

from collections.abc import Mapping
from dataclasses import dataclass
import struct
from typing import BinaryIO

from .mp4 import codec_string, parse_box_header

_TFHD_BASE_OFFSET = 0x01
_TFHD_DESCRIPTION = 0x02
_TFHD_DURATION = 0x08
_TFHD_SIZE = 0x10
_TFHD_FLAGS = 0x20
_TFHD_BASE_IS_MOOF = 0x020000
_TRUN_DATA_OFFSET = 0x01
_TRUN_FIRST_FLAGS = 0x04
_TRUN_DURATION = 0x100
_TRUN_SIZE = 0x200
_TRUN_FLAGS = 0x400
_TRUN_CTO = 0x800
_NON_SYNC = 0x00010000
# Larger boxes than these are not a recording's header or a fragment's index.
MAX_MOOV = 4 * 1024 * 1024
MAX_MOOF = 4 * 1024 * 1024


class FragmentError(Exception):
    """The file cannot be served as MSE fragments."""


@dataclass(frozen=True, slots=True)
class Track:
    """A track of the recording, with its trex defaults."""

    track_id: int
    timescale: int
    handler: str
    default_duration: int = 0
    default_size: int = 0
    default_flags: int = 0


@dataclass(frozen=True, slots=True)
class Fragment:
    """One moof and the mdat after it, as stored in the cache file."""

    offset: int
    moof_size: int
    end: int
    # Per track: decode time at the fragment's start, in the track's timescale.
    decode: tuple[tuple[int, int], ...]
    start_ms: float
    duration_ms: float
    sync: bool

    @property
    def size(self) -> int:
        """Return the stored size (the normalized one differs by a few bytes)."""
        return self.end - self.offset


class FragmentIndex:
    """The init segment and fragments of a cache file found so far.

    :meth:`scan` reads only box headers and ``moov``/``moof`` boxes; it can be
    called again as the file grows and picks up where it stopped. A fragment
    is listed once its ``mdat`` is wholly on disk.
    """

    def __init__(self) -> None:
        """Start with nothing found."""
        self.init: bytes | None = None
        self.mime: str | None = None
        self.tracks: dict[int, Track] = {}
        self.fragments: list[Fragment] = []
        self.error: str | None = None
        self._ftyp = b""
        self._pos = 0
        self._clock: dict[int, int] = {}
        self._reference: Track | None = None

    @property
    def duration_ms(self) -> float:
        """Return the media time indexed so far."""
        last = self.fragments[-1] if self.fragments else None
        return last.start_ms + last.duration_ms if last else 0.0

    def scan(self, file: BinaryIO, available: int) -> None:
        """Index what the first ``available`` bytes of the file hold."""
        if self.error is not None:
            return
        try:
            while self._step(file, available):
                pass
        except FragmentError as err:
            self.error = str(err)
        except (struct.error, ValueError, IndexError) as err:
            self.error = f"unreadable fragment ({type(err).__name__})"

    def _step(self, file: BinaryIO, available: int) -> bool:
        """Handle the box at the current position; False when it must wait."""
        pos = self._pos
        if pos + 8 > available:
            return False
        box = parse_box_header(_read(file, pos, pos + min(16, available - pos)), pos)
        if box is None:
            if available - pos >= 16:
                raise FragmentError(f"unreadable box at {pos}")
            return False
        if box.end is None:
            raise FragmentError(f"{box.type} runs to the end of the file")
        if box.type == "moof":
            return self._fragment(file, available, pos, box.end)
        if box.type in ("ftyp", "moov"):
            if box.size is not None and box.size > MAX_MOOV:
                raise FragmentError(f"{box.type} of {box.size} bytes")
            if box.end > available:
                return False
            data = _read(file, pos, box.end)
            if box.type == "ftyp":
                self._ftyp = data
            else:
                self._header(data, box.header)
        elif box.type == "mdat" and self.init is None:
            raise FragmentError("mdat before moov")
        elif box.end > available:
            # Skipped (the cache's index room, sidx, free, mfra), once whole.
            return False
        self._pos = box.end
        return True

    def _header(self, moov: bytes, header: int) -> None:
        if not any(t == "mvex" for t, _ in _children(moov[header:])):
            raise FragmentError("not a fragmented recording (no mvex)")
        tracks, codecs = _parse_moov(moov[header:])
        if not tracks:
            raise FragmentError("no tracks")
        self.tracks = tracks
        self._clock = dict.fromkeys(tracks, 0)
        video = [t for t in tracks.values() if t.handler == "vide"]
        self._reference = video[0] if video else next(iter(tracks.values()))
        self.init = self._ftyp + moov
        if codecs:
            self.mime = f'video/mp4; codecs="{",".join(codecs)}"'

    def _fragment(
        self, file: BinaryIO, available: int, pos: int, moof_end: int
    ) -> bool:
        if self.init is None or self._reference is None:
            raise FragmentError("moof before moov")
        moof_size = moof_end - pos
        if moof_size > MAX_MOOF:
            raise FragmentError(f"moof of {moof_size} bytes")
        if moof_end + 8 > available:
            return False
        mdat = parse_box_header(
            _read(file, moof_end, moof_end + min(16, available - moof_end)), moof_end
        )
        if mdat is None:
            if available - moof_end >= 16:
                raise FragmentError(f"unreadable box at {moof_end}")
            return False
        if mdat.type != "mdat" or mdat.end is None:
            raise FragmentError(f"{mdat.type} after moof")
        if mdat.end > available:
            return False
        runs = _fragment_runs(_read(file, pos, moof_end), self.tracks)
        decode: dict[int, int] = {}
        for track_id in self.tracks:
            start, duration, _sync = runs.get(track_id, (None, 0, True))
            # A tfdt, where present, is the truth; the NVR writes none.
            decode[track_id] = start if start is not None else self._clock[track_id]
            self._clock[track_id] = decode[track_id] + duration
        ref = self._reference
        _start, ref_duration, sync = runs.get(ref.track_id, (None, 0, True))
        self.fragments.append(
            Fragment(
                offset=pos,
                moof_size=moof_size,
                end=mdat.end,
                decode=tuple(decode.items()),
                start_ms=decode[ref.track_id] * 1000 / ref.timescale,
                duration_ms=ref_duration * 1000 / ref.timescale,
                sync=sync,
            )
        )
        self._pos = mdat.end
        return True

    def find(self, at_ms: float) -> int | None:
        """Return the fragment to start from to show ``at_ms``.

        That is the last fragment starting at or before it, moved back to one
        that starts with a sync sample. None if the index does not reach it.
        """
        if not self.fragments or self.duration_ms <= at_ms:
            return None
        index = 0
        for i, fragment in enumerate(self.fragments):
            if fragment.start_ms > at_ms:
                break
            index = i
        while index > 0 and not self.fragments[index].sync:
            index -= 1
        return index

    def read_fragment(self, file: BinaryIO, index: int) -> bytes:
        """Return fragment ``index`` normalized for MSE."""
        fragment = self.fragments[index]
        data = _read(file, fragment.offset, fragment.end)
        if len(data) != fragment.size:
            raise FragmentError("fragment not on disk")
        return normalize_fragment(
            data,
            fragment.offset,
            fragment.moof_size,
            dict(fragment.decode),
            self.tracks,
        )


def normalize_fragment(
    data: bytes,
    offset: int,
    moof_size: int,
    decode: Mapping[int, int],
    tracks: Mapping[int, Track],
) -> bytes:
    """Rewrite a fragment stored at ``offset`` (moof, then mdat) for MSE."""
    moof = parse_box_header(data[:16], 0)
    if moof is None or moof.type != "moof" or moof.size != moof_size:
        raise FragmentError("not a moof")
    out = bytearray(8)  # the moof header, written last
    # (position of a trun's data_offset in out, absolute start and size of its data)
    fixups: list[tuple[int, int, int]] = []
    previous_end = offset  # where a traf without a base offset starts
    for box_type, raw, header in _boxes(data[moof.header : moof_size]):
        if box_type != "traf":
            out += raw
            continue
        previous_end = _traf(
            raw,
            header,
            moof_offset=offset,
            previous_end=previous_end,
            decode=decode,
            tracks=tracks,
            out=out,
            fixups=fixups,
        )
    struct.pack_into(">I4s", out, 0, len(out), b"moof")
    data_start = offset + moof_size
    for position, start, size in fixups:
        if start < data_start or start + size > offset + len(data):
            raise FragmentError("sample data outside the fragment")
        relative = start - data_start + len(out)
        if relative > 0x7FFFFFFF:
            raise FragmentError("data offset too large")
        struct.pack_into(">i", out, position, relative)
    return bytes(out) + data[moof_size:]


def _traf(
    raw: bytes,
    header: int,
    *,
    moof_offset: int,
    previous_end: int,
    decode: Mapping[int, int],
    tracks: Mapping[int, Track],
    out: bytearray,
    fixups: list[tuple[int, int, int]],
) -> int:
    """Append a rewritten traf to ``out``; return the end of its sample data."""
    children = list(_boxes(raw[header:]))
    if not children or children[0][0] != "tfhd":
        raise FragmentError("traf without tfhd first")
    _type, tfhd, tfhd_header = children[0]
    body = tfhd[tfhd_header:]
    flags = int.from_bytes(body[1:4], "big")
    (track_id,) = struct.unpack_from(">I", body, 4)
    track = tracks.get(track_id)
    if track is None or track_id not in decode:
        raise FragmentError(f"fragment of unknown track {track_id}")
    at = 8
    base: int
    if flags & _TFHD_BASE_OFFSET:
        (base,) = struct.unpack_from(">Q", body, at)
        at += 8
    elif flags & _TFHD_BASE_IS_MOOF:
        base = moof_offset
    else:
        base = previous_end
    rest = body[at:]
    default_size = track.default_size
    pos = at
    if flags & _TFHD_DESCRIPTION:
        pos += 4
    if flags & _TFHD_DURATION:
        pos += 4
    if flags & _TFHD_SIZE:
        (default_size,) = struct.unpack_from(">I", body, pos)
    start = len(out)
    out += bytes(8)  # the traf header, written below
    new_flags = (flags & ~_TFHD_BASE_OFFSET) | _TFHD_BASE_IS_MOOF
    out += _full_box("tfhd", body[0], new_flags, body[4:8] + rest)
    out += _full_box("tfdt", 1, 0, struct.pack(">Q", decode[track_id]))
    run_end = base
    data_end = base
    for box_type, child, child_header in children[1:]:
        if box_type == "tfdt":
            continue
        if box_type != "trun":
            out += child
            continue
        run = child[child_header:]
        run_flags = int.from_bytes(run[1:4], "big")
        (count,) = struct.unpack_from(">I", run, 4)
        at = 8
        if run_flags & _TRUN_DATA_OFFSET:
            (data_offset,) = struct.unpack_from(">i", run, at)
            run_start = base + data_offset
            at += 4
        else:
            run_start = run_end
        table = run[at:]
        size = _run_size(run_flags, count, table, default_size)
        run_end = run_start + size
        data_end = max(data_end, run_end)
        fixups.append((len(out) + 16, run_start, size))
        out += _full_box(
            "trun",
            run[0],
            run_flags | _TRUN_DATA_OFFSET,
            struct.pack(">Ii", count, 0) + table,
        )
    struct.pack_into(">I4s", out, start, len(out) - start, b"traf")
    return data_end


def init_tracks(init: bytes) -> dict[int, Track]:
    """Return the tracks of an init segment (``ftyp`` + ``moov``), by id."""
    for box_type, payload in _children(init):
        if box_type == "moov":
            return _parse_moov(payload)[0]
    raise FragmentError("no moov in the init segment")


def fragment_runs(
    moof: bytes, tracks: Mapping[int, Track]
) -> dict[int, tuple[int | None, int, bool]]:
    """Per track of a ``moof``: (tfdt or None, duration, starts with a sync sample)."""
    return _fragment_runs(moof, tracks)


def set_sample_size(moof: bytes, size: int) -> bytes | None:
    """Return a one-sample ``moof`` (go2rtc's) with its sample's size changed.

    The size is in the trun (per sample) or the tfhd (default); data offsets
    are unchanged, the moof keeps its size. None for other layouts.
    """
    box = parse_box_header(moof[:16], 0)
    if box is None:
        return None
    out = bytearray(moof)
    trafs = []
    pos = box.header
    for box_type, raw, header in _boxes(moof[box.header :]):
        if box_type == "traf":
            trafs.append((pos, raw, header))
        pos += len(raw)
    if len(trafs) != 1:
        return None
    traf_at, traf, traf_header = trafs[0]
    pos = traf_at + traf_header
    # Each child's payload: (start, end) in the moof.
    sites: dict[str, tuple[int, int]] = {}
    for child_type, child, child_header in _boxes(traf[traf_header:]):
        sites.setdefault(child_type, (pos + child_header, pos + len(child)))
        pos += len(child)
    if "tfhd" not in sites or "trun" not in sites:
        return None
    run, run_end = sites["trun"]
    if run + 8 > run_end:
        return None
    run_flags = int.from_bytes(out[run + 1 : run + 4], "big")
    (count,) = struct.unpack_from(">I", out, run + 4)
    if count != 1:
        return None
    if run_flags & _TRUN_SIZE:
        at = run + 8 + 4 * bool(run_flags & _TRUN_DATA_OFFSET)
        at += 4 * bool(run_flags & _TRUN_FIRST_FLAGS)
        at += 4 * bool(run_flags & _TRUN_DURATION)
        end = run_end
    else:
        head, end = sites["tfhd"]
        flags = int.from_bytes(out[head + 1 : head + 4], "big")
        if not flags & _TFHD_SIZE:
            return None
        at = head + 8 + 8 * bool(flags & _TFHD_BASE_OFFSET)
        at += 4 * bool(flags & _TFHD_DESCRIPTION) + 4 * bool(flags & _TFHD_DURATION)
    if at + 4 > end:
        return None
    struct.pack_into(">I", out, at, size)
    return bytes(out)


def child_boxes(data: bytes) -> list[tuple[str, bytes]]:
    """Return the boxes in ``data``, in order: (type, payload)."""
    return _children(data)


def _run_size(flags: int, count: int, table: bytes, default_size: int) -> int:
    """Total bytes of a trun's samples."""
    at = 4 if flags & _TRUN_FIRST_FLAGS else 0
    fields = [
        f for f in (_TRUN_DURATION, _TRUN_SIZE, _TRUN_FLAGS, _TRUN_CTO) if flags & f
    ]
    stride = 4 * len(fields)
    if len(table) < at + stride * count:
        raise FragmentError("short trun")
    if not flags & _TRUN_SIZE:
        if count and not default_size:
            raise FragmentError("sample sizes unknown")
        return default_size * count
    first = at + 4 * fields.index(_TRUN_SIZE)
    return sum(
        struct.unpack_from(">I", table, first + i * stride)[0] for i in range(count)
    )


def _fragment_runs(
    moof: bytes, tracks: Mapping[int, Track]
) -> dict[int, tuple[int | None, int, bool]]:
    """Per track: (tfdt or None, duration, starts with a sync sample)."""
    box = parse_box_header(moof[:16], 0)
    if box is None:
        raise FragmentError("unreadable moof")
    result: dict[int, tuple[int | None, int, bool]] = {}
    for box_type, raw, header in _boxes(moof[box.header :]):
        if box_type != "traf":
            continue
        children = list(_boxes(raw[header:]))
        if not children or children[0][0] != "tfhd":
            raise FragmentError("traf without tfhd first")
        body = children[0][1][children[0][2] :]
        flags = int.from_bytes(body[1:4], "big")
        (track_id,) = struct.unpack_from(">I", body, 4)
        track = tracks.get(track_id)
        if track is None:
            raise FragmentError(f"fragment of unknown track {track_id}")
        at = 8 + (8 if flags & _TFHD_BASE_OFFSET else 0)
        at += 4 if flags & _TFHD_DESCRIPTION else 0
        default_duration = track.default_duration
        default_flags = track.default_flags
        if flags & _TFHD_DURATION:
            (default_duration,) = struct.unpack_from(">I", body, at)
            at += 4
        at += 4 if flags & _TFHD_SIZE else 0
        if flags & _TFHD_FLAGS:
            (default_flags,) = struct.unpack_from(">I", body, at)
        decode: int | None = None
        duration = 0
        sync: bool | None = None
        for child_type, child, child_header in children[1:]:
            payload = child[child_header:]
            if child_type == "tfdt":
                width = ">Q" if payload[0] == 1 else ">I"
                (decode,) = struct.unpack_from(width, payload, 4)
            elif child_type == "trun":
                run_duration, first_flags = _run_times(
                    payload, default_duration, default_flags
                )
                duration += run_duration
                if sync is None and first_flags is not None:
                    sync = not first_flags & _NON_SYNC
        result[track_id] = (decode, duration, sync is not False)
    return result


def _run_times(
    run: bytes, default_duration: int, default_flags: int
) -> tuple[int, int | None]:
    """Return a trun's duration and its first sample's flags."""
    flags = int.from_bytes(run[1:4], "big")
    (count,) = struct.unpack_from(">I", run, 4)
    at = 8 + (4 if flags & _TRUN_DATA_OFFSET else 0)
    first_flags: int | None = None
    if flags & _TRUN_FIRST_FLAGS:
        (first_flags,) = struct.unpack_from(">I", run, at)
        at += 4
    fields = [
        f for f in (_TRUN_DURATION, _TRUN_SIZE, _TRUN_FLAGS, _TRUN_CTO) if flags & f
    ]
    stride = 4 * len(fields)
    if len(run) < at + stride * count:
        raise FragmentError("short trun")
    if flags & _TRUN_DURATION:
        duration = sum(
            struct.unpack_from(">I", run, at + i * stride)[0] for i in range(count)
        )
    else:
        duration = default_duration * count
    if first_flags is None and count:
        if flags & _TRUN_FLAGS:
            (first_flags,) = struct.unpack_from(
                ">I", run, at + 4 * fields.index(_TRUN_FLAGS)
            )
        else:
            first_flags = default_flags
    return duration, first_flags


def _parse_moov(moov: bytes) -> tuple[dict[int, Track], list[str]]:
    """Return the tracks (in moov order, with trex defaults) and their codecs."""
    found: list[tuple[int, int, str, str | None]] = []
    defaults: dict[int, tuple[int, int, int]] = {}
    for box_type, payload in _children(moov):
        if box_type == "trak":
            track = _trak(payload)
            if track is not None:
                found.append(track)
        elif box_type == "mvex":
            for child_type, trex in _children(payload):
                if child_type == "trex" and len(trex) >= 24:
                    track_id, _desc, duration, size, flags = struct.unpack_from(
                        ">IIIII", trex, 4
                    )
                    defaults[track_id] = (duration, size, flags)
    tracks = {
        track_id: Track(
            track_id, timescale, handler, *defaults.get(track_id, (0, 0, 0))
        )
        for track_id, timescale, handler, _codec in found
    }
    codecs = [codec for *_rest, codec in found if codec]
    return tracks, codecs


def _trak(trak: bytes) -> tuple[int, int, str, str | None] | None:
    track_id = timescale = None
    handler = ""
    codec: str | None = None
    for box_type, payload in _children(trak):
        if box_type == "tkhd" and len(payload) >= 24:
            (track_id,) = struct.unpack_from(
                ">I", payload, 20 if payload[0] == 1 else 12
            )
        elif box_type == "mdia":
            for child_type, child in _children(payload):
                if child_type == "mdhd" and len(child) >= 24:
                    (timescale,) = struct.unpack_from(
                        ">I", child, 20 if child[0] == 1 else 12
                    )
                elif child_type == "hdlr" and len(child) >= 12:
                    handler = child[8:12].decode("latin-1")
                elif child_type == "minf":
                    codec = _codec(child)
    if not track_id or not timescale:
        return None
    return track_id, timescale, handler, codec


def _codec(minf: bytes) -> str | None:
    for box_type, stbl in _children(minf):
        if box_type != "stbl":
            continue
        for child_type, stsd in _children(stbl):
            if child_type == "stsd" and len(stsd) >= 16:
                entry = parse_box_header(stsd[8:24], 0)
                if entry is None or entry.size is None:
                    return None
                return codec_string(stsd[8 : 8 + entry.size])
    return None


def _boxes(data: bytes) -> list[tuple[str, bytes, int]]:
    """Child boxes of a payload: (type, whole box, header length)."""
    result = []
    offset = 0
    while offset + 8 <= len(data):
        box = parse_box_header(data[offset : offset + 16], offset)
        if box is None or box.end is None or box.end > len(data):
            raise FragmentError("malformed box")
        result.append((box.type, data[offset : box.end], box.header))
        offset = box.end
    return result


def _children(data: bytes) -> list[tuple[str, bytes]]:
    """Child boxes of a payload: (type, payload)."""
    return [(t, raw[header:]) for t, raw, header in _boxes(data)]


def _full_box(box_type: str, version: int, flags: int, body: bytes) -> bytes:
    return (
        struct.pack(">I4sB", 12 + len(body), box_type.encode(), version)
        + (flags & 0xFFFFFF).to_bytes(3, "big")
        + body
    )


def _read(file: BinaryIO, start: int, end: int) -> bytes:
    file.seek(start)
    return file.read(end - start)

"""Tests for the segment index written into cached recordings."""

from pathlib import Path
import struct
from typing import NamedTuple

import pytest

from custom_components.reolink_viewer.mp4index import (
    MAX_MOOF,
    MAX_RESERVE,
    MIN_RESERVE,
    PLAN_LIMIT,
    OffsetShifter,
    OffsetShiftError,
    Plan,
    build_index,
    free_box,
    plan_reserve,
)

from .mp4_fixtures import (
    AUDIO_FRAME,
    AUDIO_FRAMES,
    AUDIO_TIMESCALE,
    FRAME,
    FRAMES,
    FTYP,
    NON_SYNC,
    SYNC,
    VIDEO_TIMESCALE,
    av_moov,
    box,
    fragmented_av,
    full_box,
    mp4_file,
)

HEAD = len(FTYP + av_moov())


def _boxes(data: bytes) -> list[tuple[str, int, int]]:
    out = []
    offset = 0
    while offset < len(data):
        size, kind = struct.unpack(">I4s", data[offset : offset + 8])
        out.append((kind.decode(), offset, size))
        offset += size
    return out


class Sidx(NamedTuple):
    """A parsed sidx box."""

    size: int
    track: int
    timescale: int
    earliest: int
    first: int
    sizes: list[int]
    durations: list[int]
    sap: list[int]


def _sidx(data: bytes, offset: int) -> Sidx:
    size, _, version, ref, timescale, earliest, first, _, count = struct.unpack(
        ">I4sIIIQQHH", data[offset : offset + 40]
    )
    assert version >> 24 == 1
    refs = [
        struct.unpack(">III", data[offset + 40 + 12 * i : offset + 52 + 12 * i])
        for i in range(count)
    ]
    return Sidx(
        size,
        ref,
        timescale,
        earliest,
        first,
        [r[0] & 0x7FFFFFFF for r in refs],
        [r[1] for r in refs],
        [r[2] for r in refs],
    )


def _indexed(tmp_path: Path, data: bytes, duration_s: float = 8) -> tuple[bytes, Plan]:
    plan = plan_reserve(data, duration_s)
    assert plan is not None
    assert plan.insert_at is not None
    path = tmp_path / "rec.mp4"
    path.write_bytes(
        data[: plan.insert_at] + free_box(plan.reserve) + data[plan.insert_at :]
    )
    index = build_index(str(path), plan.insert_at, plan.reserve)
    assert index is not None
    assert len(index) == plan.reserve
    raw = bytearray(path.read_bytes())
    raw[plan.insert_at : plan.insert_at + plan.reserve] = index
    return bytes(raw), plan


def test_plan_waits_then_places_the_room_after_moov() -> None:
    """The room goes right after moov once the first moof is in."""
    data = fragmented_av()
    assert plan_reserve(data[: HEAD - 10], 8) is None  # moov incomplete
    assert plan_reserve(data[: HEAD + 20], 8) is None  # first moof incomplete
    plan = plan_reserve(data, 8)
    assert plan is not None
    assert plan.insert_at == HEAD
    assert plan.reserve >= MIN_RESERVE
    # An hour of recording gets room for a reference per second per track.
    hour = plan_reserve(data, 3600)
    assert hour is not None
    assert 2 * 12 * 3600 < hour.reserve <= MAX_RESERVE


def test_plan_leaves_other_layouts_alone() -> None:
    """Plain files and odd starts are not touched."""
    assert plan_reserve(mp4_file(mdat_bytes=1000), 8) == Plan(
        None, reason="mdat after moov"
    )
    assert plan_reserve(mp4_file(mdat_bytes=1000, moov_first=False), 8) == Plan(
        None, reason="mdat before moov ends"
    )
    garbage = bytes(PLAN_LIMIT)
    assert plan_reserve(garbage, 8) == Plan(None, reason="no box header")
    assert plan_reserve(garbage[:100], 8) is None


def test_index_describes_every_fragment(tmp_path: Path) -> None:
    """One sidx per track, sizes reaching the end of the file, real durations."""
    data = fragmented_av(4, non_sync=frozenset({2}))
    indexed, plan = _indexed(tmp_path, data)
    assert plan.insert_at is not None
    # Nothing but the reserved room changed.
    room = slice(plan.insert_at, plan.insert_at + plan.reserve)
    assert indexed[: plan.insert_at] == data[: plan.insert_at]
    assert indexed[room.stop :] == data[plan.insert_at :]
    kinds = [k for k, _, _ in _boxes(indexed[room])]
    assert kinds == ["sidx", "sidx", "free"]

    assert plan.insert_at is not None
    video = _sidx(indexed, plan.insert_at)
    audio = _sidx(indexed, plan.insert_at + video.size)
    first_moof = room.stop
    moofs = [o for k, o, _ in _boxes(indexed) if k == "moof"]
    assert moofs[0] == first_moof
    assert (video.track, video.timescale) == (1, VIDEO_TIMESCALE)
    assert (audio.track, audio.timescale) == (2, AUDIO_TIMESCALE)
    for sidx, anchor in (
        (video, plan.insert_at + video.size),
        (audio, plan.insert_at + video.size + audio.size),
    ):
        assert anchor + sidx.first == first_moof
        assert first_moof + sum(sidx.sizes) == len(indexed)
        assert sidx.earliest == 0
    assert video.durations == [FRAMES * FRAME] * 4
    assert audio.durations == [AUDIO_FRAMES * AUDIO_FRAME] * 4
    assert video.sap == [0x90000000, 0x90000000, 0, 0x90000000]
    ends = [*moofs[1:], len(indexed)]
    assert video.sizes == [end - start for start, end in zip(moofs, ends, strict=True)]


def test_index_refuses_what_it_cannot_describe(tmp_path: Path) -> None:
    """No room, no free box, or unknown tracks: no index."""
    data = fragmented_av(4)
    path = tmp_path / "rec.mp4"
    # Room too small for the boxes.
    path.write_bytes(data[:HEAD] + free_box(64) + data[HEAD:])
    assert build_index(str(path), HEAD, 64) is None
    # The room is not where it is said to be.
    assert build_index(str(path), HEAD + 8, 64) is None
    assert build_index(str(path), HEAD, 72) is None
    # Not fragmented.
    plain = mp4_file(mdat_bytes=1000)
    path.write_bytes(plain)
    assert build_index(str(path), len(plain) - 1008, 1008) is None


def test_index_reads_other_fragment_encodings(tmp_path: Path) -> None:
    """Defaults from trex, per-sample flags and the optional tfhd fields."""
    # tfhd: description index, default size and default flags; trun: sizes and
    # per-sample flags only, so durations come from trex.
    tfhd = box(
        "tfhd", struct.pack(">IIIII", 0x020000 | 0x02 | 0x10 | 0x20, 1, 1, 100, SYNC)
    )
    run = struct.pack(">II", 0x200 | 0x400, 3)
    run += struct.pack(">II", 100, NON_SYNC) + struct.pack(">II", 100, SYNC) * 2
    traf = box(
        "traf", tfhd + full_box("tfdt", struct.pack(">I", 7200)) + box("trun", run)
    )
    moof = box("moof", box("mfhd", bytes(8)) + traf)
    data = FTYP + av_moov() + moof + box("mdat", bytes(300))
    indexed, plan = _indexed(tmp_path, data)
    assert plan.insert_at is not None
    video = _sidx(indexed, plan.insert_at)
    audio = _sidx(indexed, plan.insert_at + video.size)
    assert video.durations == [3 * FRAME]
    assert video.earliest == 7200
    assert video.sap == [0]  # the first sample is not a sync sample
    # The audio track has no fragment here: an empty reference.
    assert audio.durations == [0]


def _tfhd_bases(data: bytes) -> list[tuple[int, int]]:
    """(moof position, base_data_offset) of every tfhd with an absolute offset."""
    found = []
    for kind, offset, size in _boxes(data):
        if kind != "moof":
            continue
        moof = data[offset : offset + size]
        at = 8
        while at < len(moof):
            traf_size, traf_kind = struct.unpack(">I4s", moof[at : at + 8])
            if traf_kind == b"traf":
                tfhd_flags = int.from_bytes(moof[at + 17 : at + 20], "big")
                if tfhd_flags & 1:
                    (base,) = struct.unpack(">Q", moof[at + 24 : at + 32])
                    found.append((offset, base))
            at += traf_size
    return found


def _shifted(data: bytes, shift: int, piece: int) -> bytes:
    shifter = OffsetShifter(shift)
    out = b"".join(
        shifter.feed(data[i : i + piece]) for i in range(0, len(data), piece)
    )
    return out + shifter.finish()


def test_absolute_offsets_move_with_the_index(tmp_path: Path) -> None:
    """The NVR's absolute offsets still point at their moofs after the room."""
    data = fragmented_av(4, absolute=True)
    assert all(moof == base for moof, base in _tfhd_bases(data))
    plan = plan_reserve(data, 8)
    assert plan is not None
    assert plan.insert_at == HEAD
    for piece in (1, 7, 300, 100_000):
        rest = _shifted(data[HEAD:], plan.reserve, piece)
        assert len(rest) == len(data) - HEAD
        stored = data[:HEAD] + free_box(plan.reserve) + rest
        bases = _tfhd_bases(stored)
        assert len(bases) == 8  # two track fragments per moof
        assert all(moof == base for moof, base in bases)
    path = tmp_path / "rec.mp4"
    path.write_bytes(stored)
    index = build_index(str(path), HEAD, plan.reserve)
    assert index is not None
    # Relative offsets are left alone.
    relative = fragmented_av(2)
    assert _shifted(relative[HEAD:], 4096, 50) == relative[HEAD:]


def test_shifter_handles_odd_boxes() -> None:
    """mfra becomes free; boxes to the end pass; broken streams are refused."""
    mfra = box("mfra", bytes(20))
    to_end = struct.pack(">I4s", 0, b"mdat") + bytes(30)
    out = _shifted(mfra + to_end, 100, 3)
    assert out == box("free", bytes(20)) + to_end
    # A 64-bit size header passes through.
    large = struct.pack(">I4sQ", 1, b"mdat", 16 + 5) + bytes(5)
    assert _shifted(large, 100, 4) == large
    # An incomplete box at the end is passed on as it is.
    assert _shifted(box("moof", bytes(40))[:20], 100, 6) == box("moof", bytes(40))[:20]
    with pytest.raises(OffsetShiftError, match="moof of"):
        OffsetShifter(8).feed(struct.pack(">I4s", MAX_MOOF + 1, b"moof"))
    with pytest.raises(OffsetShiftError, match="unparseable"):
        OffsetShifter(8).feed(b"\x00\x00\x00\x10\x01\x02\x03\x04" + bytes(8))
    with pytest.raises(OffsetShiftError, match="malformed moof"):
        OffsetShifter(8).feed(box("moof", struct.pack(">I4s", 99, b"traf")))
    bad_traf = box("traf", struct.pack(">I4s", 99, b"tfhd"))
    with pytest.raises(OffsetShiftError, match="malformed traf"):
        OffsetShifter(8).feed(box("moof", bad_traf))

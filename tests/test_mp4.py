"""Tests for the MP4 box reader."""

from pathlib import Path
import shutil
import struct
import subprocess

import pytest

from custom_components.reolink_viewer.mp4 import (
    Mp4ReadError,
    PrefixReader,
    async_layout,
    parse_box_header,
    parse_mvhd,
    parse_stsd,
    walk_boxes,
)

from .mp4_fixtures import FTYP, box, fragmented_file, mp4_file, mvhd

FFMPEG = shutil.which("ffmpeg")
needs_ffmpeg = pytest.mark.skipif(FFMPEG is None, reason="ffmpeg not installed")


class MemoryReader:
    """Reads from bytes in memory, counting calls."""

    def __init__(self, data: bytes) -> None:
        self.data = data
        self.calls = 0

    async def read(self, offset: int, length: int) -> bytes:
        self.calls += 1
        return self.data[offset : offset + length]


def test_parse_box_header() -> None:
    """Normal, 64-bit and to-end sizes; garbage is rejected."""
    header = parse_box_header(box("ftyp", b"isom"), 10)
    assert header is not None
    assert (header.type, header.offset, header.size, header.header) == (
        "ftyp",
        10,
        12,
        8,
    )
    assert header.end == 22
    assert header.payload == 18
    large = struct.pack(">I4sQ", 1, b"mdat", 1 << 33)
    parsed = parse_box_header(large, 0)
    assert parsed is not None
    assert (parsed.size, parsed.header) == (1 << 33, 16)
    to_end = parse_box_header(struct.pack(">I4s", 0, b"mdat"), 0)
    assert to_end is not None
    assert to_end.size is None
    assert to_end.end is None
    assert parse_box_header(b"\0\0", 0) is None
    assert parse_box_header(struct.pack(">I4s", 1, b"mdat"), 0) is None
    assert parse_box_header(struct.pack(">I4s", 4, b"mdat"), 0) is None
    assert parse_box_header(struct.pack(">I4s", 16, b"\x00\x01ab"), 0) is None


def test_parse_mvhd() -> None:
    """Version 0 and 1 durations; a zero timescale gives None."""
    assert parse_mvhd(mvhd(61.5)[8:]) == 61.5
    assert parse_mvhd(mvhd(3600, timescale=90000, version=1)[8:]) == 3600
    assert parse_mvhd(mvhd(10, timescale=0)[8:]) is None
    assert parse_mvhd(b"\0" * 10) is None
    assert parse_mvhd(b"\x01" + b"\0" * 25) is None


def test_parse_stsd_short() -> None:
    """Truncated stsd payloads give nothing."""
    assert parse_stsd(b"\0" * 8) == (None, None, None)
    assert parse_stsd(b"\0" * 8 + b"\0" * 8) == (None, None, None)


async def test_layout_moov_first() -> None:
    """A fast-start file: moov before mdat, tracks and duration read."""
    data = mp4_file(moov_first=True)
    layout = await async_layout(MemoryReader(data).read, len(data))
    assert layout.top_level == ["ftyp", "moov", "mdat"]
    assert layout.moov_before_mdat is True
    assert layout.fragmented is False
    assert layout.duration_s == 60
    assert layout.error is None
    result = layout.as_dict()
    assert result["tracks"] == [
        {"handler": "vide", "sample_entry": "hvc1", "width": 3840, "height": 2160},
        {"handler": "soun", "sample_entry": "mp4a"},
    ]


async def test_layout_moov_last_needs_ranges() -> None:
    """With moov at the end, a prefix alone is not enough; ranges are."""
    data = mp4_file(moov_first=False)
    prefix = data[:65536]
    no_range = PrefixReader(prefix, None, 32)
    layout = await async_layout(no_range.read, len(data))
    assert layout.error == "byte range not available (no Range support)"
    assert layout.top_level == []

    memory = MemoryReader(data)
    with_range = PrefixReader(prefix, memory.read, 32)
    layout = await async_layout(with_range.read, len(data))
    assert layout.top_level == ["ftyp", "mdat", "moov"]
    assert layout.moov_before_mdat is False
    assert layout.mdat_offset == len(FTYP)
    assert layout.duration_s == 60
    assert 0 < with_range.requests <= 32


async def test_layout_read_budget() -> None:
    """The reader stops after its request budget."""
    data = mp4_file(moov_first=False)
    reader = PrefixReader(b"", MemoryReader(data).read, 3)
    layout = await async_layout(reader.read, len(data))
    assert layout.error == "moov: read budget spent"
    assert layout.top_level == ["ftyp", "mdat", "moov"]


async def test_layout_fragmented() -> None:
    """mvex in moov and moof boxes mark a fragmented file."""
    data = fragmented_file(3)
    layout = await async_layout(MemoryReader(data).read, len(data))
    assert layout.fragmented is True
    assert layout.top_level.count("moof") == 3
    truncated = await async_layout(MemoryReader(data).read, len(data), max_boxes=3)
    assert truncated.truncated is True


async def test_layout_without_moov() -> None:
    """No moov: an error, unless the walk was cut short."""
    data = FTYP + box("moof", b"") + box("mdat", bytes(100))
    layout = await async_layout(MemoryReader(data).read, None)
    assert layout.error == "no moov box found"
    assert layout.fragmented is True
    assert layout.mdat_size == 108


async def test_walk_stops_on_garbage_and_open_box() -> None:
    """Walking stops at an unparseable header or a to-end box."""
    data = FTYP + b"\0\0\0\0\0\0"
    boxes, truncated = await walk_boxes(MemoryReader(data).read, 0, None, 10)
    assert [b.type for b in boxes] == ["ftyp"]
    assert truncated is False
    data = FTYP + struct.pack(">I4s", 0, b"mdat") + bytes(50)
    boxes, _ = await walk_boxes(MemoryReader(data).read, 0, None, 10)
    assert [b.type for b in boxes] == ["ftyp", "mdat"]


async def test_prefix_reader_serves_prefix() -> None:
    """Reads inside the prefix never hit the fetch callback."""

    async def fetch(offset: int, length: int) -> bytes:
        raise AssertionError("fetched")

    reader = PrefixReader(b"abcdef", fetch, 1)
    assert await reader.read(1, 3) == b"bcd"
    assert reader.requests == 0
    with pytest.raises(Mp4ReadError):
        await PrefixReader(b"", None, 1).read(0, 1)


def _ffmpeg_mp4(tmp_path: Path, name: str, *extra: str) -> bytes:
    assert FFMPEG is not None
    path = tmp_path / name
    subprocess.run(
        [
            FFMPEG,
            "-hide_banner",
            "-loglevel",
            "error",
            "-f",
            "lavfi",
            "-i",
            "testsrc=size=320x240:rate=10",
            "-t",
            "2",
            "-c:v",
            "libx264",
            *extra,
            str(path),
        ],
        check=True,
        timeout=60,
    )
    return path.read_bytes()


@needs_ffmpeg
@pytest.mark.parametrize(
    ("extra", "moov_first", "fragmented"),
    [
        ((), False, False),
        (("-movflags", "+faststart"), True, False),
        (("-movflags", "frag_keyframe+empty_moov+default_base_moof"), True, True),
    ],
)
async def test_layout_of_ffmpeg_files(
    tmp_path: Path, extra: tuple[str, ...], moov_first: bool, fragmented: bool
) -> None:
    """Real files written by ffmpeg are described correctly."""
    data = _ffmpeg_mp4(tmp_path, "out.mp4", *extra)
    layout = await async_layout(MemoryReader(data).read, len(data))
    assert layout.error is None
    assert layout.fragmented is fragmented
    assert layout.moov_before_mdat is moov_first
    assert layout.tracks[0].handler == "vide"
    assert layout.tracks[0].sample_entry == "avc1"
    assert (layout.tracks[0].width, layout.tracks[0].height) == (320, 240)
    if not fragmented:
        assert layout.duration_s == pytest.approx(2, abs=0.2)

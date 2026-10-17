"""Minimal ISO BMFF (MP4) box reader.

Reads only box headers and a few small payloads (mvhd, hdlr, stsd), through a
``read(offset, length)`` callback, so a file's layout can be learned from a
handful of small HTTP Range requests instead of downloading it.
"""

from collections.abc import Awaitable, Callable
from dataclasses import asdict, dataclass, field
import struct
from typing import Any

type ReadFunc = Callable[[int, int], Awaitable[bytes]]

_HEADER_READ = 16
_MAX_CHILDREN = 32


class Mp4ReadError(Exception):
    """The bytes needed are not available (range refused or read budget spent)."""


@dataclass(frozen=True, slots=True)
class Box:
    """One box: type, absolute offset, total size and header length."""

    type: str
    offset: int
    size: int | None  # None: extends to the end of the file (size field 0)
    header: int

    @property
    def end(self) -> int | None:
        """Return the offset just past the box."""
        return None if self.size is None else self.offset + self.size

    @property
    def payload(self) -> int:
        """Return the offset of the payload."""
        return self.offset + self.header


def parse_box_header(data: bytes, offset: int) -> Box | None:
    """Parse the box header at the start of ``data`` (found at ``offset``)."""
    if len(data) < 8:
        return None
    size, raw_type = struct.unpack(">I4s", data[:8])
    box_type = raw_type.decode("latin-1")
    if not all(32 <= ord(c) < 127 for c in box_type):
        return None
    header = 8
    total: int | None = size
    if size == 1:
        if len(data) < 16:
            return None
        total = struct.unpack(">Q", data[8:16])[0]
        header = 16
    elif size == 0:
        total = None
    if total is not None and total < header:
        return None
    return Box(box_type, offset, total, header)


class PrefixReader:
    """Serve reads from a known prefix, else from a range callback, with a budget."""

    def __init__(
        self, prefix: bytes, fetch: ReadFunc | None, max_requests: int
    ) -> None:
        """Initialize the reader."""
        self._prefix = prefix
        self._fetch = fetch
        self._max_requests = max_requests
        self.requests = 0

    async def read(self, offset: int, length: int) -> bytes:
        """Return up to ``length`` bytes at ``offset``."""
        if offset + length <= len(self._prefix):
            return self._prefix[offset : offset + length]
        if self._fetch is None:
            raise Mp4ReadError("byte range not available (no Range support)")
        if self.requests >= self._max_requests:
            raise Mp4ReadError("read budget spent")
        self.requests += 1
        return await self._fetch(offset, length)


async def walk_boxes(
    read: ReadFunc, start: int, end: int | None, max_boxes: int
) -> tuple[list[Box], bool]:
    """List the boxes between ``start`` and ``end``; return (boxes, truncated)."""
    boxes: list[Box] = []
    offset = start
    while end is None or offset + 8 <= end:
        if len(boxes) >= max_boxes:
            return boxes, True
        data = await read(offset, _HEADER_READ)
        box = parse_box_header(data, offset)
        if box is None:
            break
        boxes.append(box)
        if box.end is None:
            break
        offset = box.end
    return boxes, False


@dataclass(slots=True)
class Track:
    """What one track holds."""

    handler: str | None = None
    sample_entry: str | None = None
    width: int | None = None
    height: int | None = None


@dataclass(slots=True)
class Mp4Layout:
    """Top-level layout of an MP4 file and its tracks."""

    top_level: list[str] = field(default_factory=list)
    truncated: bool = False
    moov_offset: int | None = None
    moov_size: int | None = None
    mdat_offset: int | None = None
    mdat_size: int | None = None
    moov_before_mdat: bool | None = None
    fragmented: bool | None = None
    duration_s: float | None = None
    tracks: list[Track] = field(default_factory=list)
    error: str | None = None

    def as_dict(self) -> dict[str, Any]:
        """Return a JSON-serializable dict."""
        return {
            "top_level": self.top_level,
            "truncated": self.truncated,
            "moov_offset": self.moov_offset,
            "moov_size": self.moov_size,
            "mdat_offset": self.mdat_offset,
            "mdat_size": self.mdat_size,
            "moov_before_mdat": self.moov_before_mdat,
            "fragmented": self.fragmented,
            "duration_s": self.duration_s,
            "tracks": [
                {k: v for k, v in asdict(t).items() if v is not None}
                for t in self.tracks
            ],
            "error": self.error,
        }


def parse_mvhd(payload: bytes) -> float | None:
    """Return the movie duration in seconds from an mvhd payload."""
    if len(payload) < 20:
        return None
    if payload[0] == 1:
        if len(payload) < 32:
            return None
        timescale, duration = struct.unpack(">IQ", payload[20:32])
    else:
        timescale, duration = struct.unpack(">II", payload[12:20])
    if not timescale:
        return None
    return round(int(duration) / int(timescale), 3)


def parse_hdlr(payload: bytes) -> str | None:
    """Return the handler type ('vide', 'soun', ...) from an hdlr payload."""
    if len(payload) < 12:
        return None
    return payload[8:12].decode("latin-1")


def parse_stsd(payload: bytes) -> tuple[str | None, int | None, int | None]:
    """Return (sample entry type, width, height) of the first stsd entry."""
    if len(payload) < 16:
        return None, None, None
    entry = parse_box_header(payload[8:], 0)
    if entry is None:
        return None, None, None
    width = height = None
    # VisualSampleEntry: 8 bytes SampleEntry + 16 pre-defined/reserved, then
    # width and height (16 bits each).
    if len(payload) >= 8 + 8 + 28 and entry.type in _VISUAL_ENTRIES:
        width, height = struct.unpack(">HH", payload[8 + 8 + 24 : 8 + 8 + 28])
    return entry.type, width, height


_VISUAL_ENTRIES = frozenset({"avc1", "avc3", "hvc1", "hev1", "mp4v", "encv"})


async def async_layout(
    read: ReadFunc, size: int | None, *, max_boxes: int = 64
) -> Mp4Layout:
    """Describe the file: top-level boxes, moov position, fragmentation, tracks."""
    layout = Mp4Layout()
    try:
        boxes, layout.truncated = await walk_boxes(read, 0, size, max_boxes)
    except Mp4ReadError as err:
        layout.error = str(err)
        return layout
    layout.top_level = [b.type for b in boxes]
    moov = next((b for b in boxes if b.type == "moov"), None)
    mdat = next((b for b in boxes if b.type == "mdat"), None)
    if mdat is not None:
        layout.mdat_offset, layout.mdat_size = mdat.offset, mdat.size
    if moov is None:
        if not layout.truncated:
            layout.error = "no moov box found"
        layout.fragmented = "moof" in layout.top_level or None
        return layout
    layout.moov_offset, layout.moov_size = moov.offset, moov.size
    if mdat is not None:
        layout.moov_before_mdat = moov.offset < mdat.offset
    try:
        await _read_moov(read, moov, layout)
    except Mp4ReadError as err:
        layout.error = f"moov: {err}"
    if layout.fragmented is None:
        layout.fragmented = "moof" in layout.top_level
    return layout


async def _read_moov(read: ReadFunc, moov: Box, layout: Mp4Layout) -> None:
    children, _ = await walk_boxes(read, moov.payload, moov.end, _MAX_CHILDREN)
    for child in children:
        if child.type == "mvhd":
            layout.duration_s = parse_mvhd(await read(child.payload, 32))
        elif child.type == "mvex":
            layout.fragmented = True
        elif child.type == "trak":
            layout.tracks.append(await _read_trak(read, child))


async def _children(read: ReadFunc, box: Box) -> list[Box]:
    children, _ = await walk_boxes(read, box.payload, box.end, _MAX_CHILDREN)
    return children


async def _child(read: ReadFunc, box: Box | None, box_type: str) -> Box | None:
    if box is None:
        return None
    return _find(await _children(read, box), box_type)


async def _read_trak(read: ReadFunc, trak: Box) -> Track:
    """Read trak > mdia > hdlr and trak > mdia > minf > stbl > stsd."""
    track = Track()
    if (mdia := await _child(read, trak, "mdia")) is None:
        return track
    mdia_children = await _children(read, mdia)
    if (hdlr := _find(mdia_children, "hdlr")) is not None:
        track.handler = parse_hdlr(await read(hdlr.payload, 12))
    stbl = await _child(read, _find(mdia_children, "minf"), "stbl")
    if (stsd := await _child(read, stbl, "stsd")) is not None:
        entry = await read(stsd.payload, 8 + 8 + 28)
        track.sample_entry, track.width, track.height = parse_stsd(entry)
    return track


def _find(boxes: list[Box], box_type: str) -> Box | None:
    return next((b for b in boxes if b.type == box_type), None)

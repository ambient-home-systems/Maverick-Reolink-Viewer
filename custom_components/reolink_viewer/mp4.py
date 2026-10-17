"""Minimal ISO BMFF (MP4) box reader.

Reads only box headers and a few small payloads (mvhd, hdlr, stsd), either
through a ``read(offset, length)`` callback, so a file's layout can be learned
from a handful of small HTTP Range requests, or with :class:`BoxScanner`, which
follows the top-level boxes through a plain download as it streams by (for
servers that ignore Range).
"""

from collections.abc import Awaitable, Callable
from dataclasses import asdict, dataclass, field
import struct
from typing import Any

type ReadFunc = Callable[[int, int], Awaitable[bytes]]

_HEADER_READ = 16
_MAX_CHILDREN = 32
# BoxScanner keeps the bytes of these boxes (to read the tracks from moov).
_CAPTURE = frozenset({"moov"})
_CAPTURE_LIMIT = 16 * 1024 * 1024


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
    codec: str | None = None  # RFC 6381, e.g. "avc1.640033", "hvc1.1.6.L153.B0"


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
_AUDIO_ENTRIES = frozenset({"mp4a"})
_MAX_ENTRY = 4096
# Fixed part of a sample entry before its child boxes (after the 8-byte header).
_VISUAL_FIXED = 78
_AUDIO_FIXED = 28


def codec_string(entry: bytes) -> str | None:
    """Return the RFC 6381 codec string of a sample entry (box bytes)."""
    box = parse_box_header(entry, 0)
    if box is None:
        return None
    if box.type in _AUDIO_ENTRIES:
        return _mp4a_codec(entry[8 + _AUDIO_FIXED :])
    if box.type not in _VISUAL_ENTRIES:
        return box.type
    children = entry[8 + _VISUAL_FIXED :]
    offset = 0
    while offset + 8 <= len(children):
        child = parse_box_header(children[offset:], offset)
        if child is None or child.size is None:
            break
        body = children[offset + child.header : offset + child.size]
        if child.type == "avcC" and len(body) >= 4:
            return f"{box.type}.{body[1]:02X}{body[2]:02X}{body[3]:02X}"
        if child.type == "hvcC" and len(body) >= 13:
            return _hevc_codec(box.type, body)
        offset += child.size
    return box.type


def _hevc_codec(prefix: str, hvcc: bytes) -> str:
    """Build hvc1.<space><profile>.<compat>.<tier><level>.<constraints> (ISO 14496-15)."""
    space = hvcc[1] >> 6
    tier = "H" if hvcc[1] & 0x20 else "L"
    profile = hvcc[1] & 0x1F
    compat = int.from_bytes(hvcc[2:6], "big")
    # The compatibility flags are written in reverse bit order.
    reversed_compat = int(f"{compat:032b}"[::-1], 2)
    constraints = list(hvcc[6:12])
    while constraints and constraints[-1] == 0:
        constraints.pop()
    parts = [
        prefix,
        f"{['', 'A', 'B', 'C'][space]}{profile}",
        f"{reversed_compat:X}",
        f"{tier}{hvcc[12]}",
        *(f"{b:X}" for b in constraints),
    ]
    return ".".join(parts)


def _mp4a_codec(children: bytes) -> str:
    """Return mp4a.40.<audio object type> from esds, or mp4a.40.2 (AAC-LC)."""
    index = children.find(b"esds")
    if index >= 0:
        esds = children[index + 8 :]
        # DecoderConfigDescriptor (tag 4): objectTypeIndication, then later the
        # DecoderSpecificInfo (tag 5) whose first 5 bits are the audio object type.
        tag4 = esds.find(b"\x04")
        tag5 = esds.find(b"\x05", tag4 + 1) if tag4 >= 0 else -1
        if tag4 >= 0 and tag5 >= 0:
            oti_at = _after_length(esds, tag4 + 1)
            dsi_at = _after_length(esds, tag5 + 1)
            if oti_at < len(esds) and dsi_at < len(esds) and esds[oti_at] == 0x40:
                aot = esds[dsi_at] >> 3
                if aot:
                    return f"mp4a.40.{aot}"
    return "mp4a.40.2"


def _after_length(data: bytes, index: int) -> int:
    """Skip a descriptor's variable-length size field."""
    for _ in range(4):
        if index >= len(data):
            break
        more = data[index] & 0x80
        index += 1
        if not more:
            break
    return index


async def async_layout(
    read: ReadFunc, size: int | None, *, max_boxes: int = 64
) -> Mp4Layout:
    """Describe the file: top-level boxes, moov position, fragmentation, tracks."""
    layout = Mp4Layout()
    boxes: list[Box] = []
    offset = 0
    # Walk by hand rather than with walk_boxes, to keep the boxes found before
    # a read fails (e.g. the next header lies beyond what can be read).
    while size is None or offset + 8 <= size:
        if len(boxes) >= max_boxes:
            layout.truncated = True
            break
        try:
            data = await read(offset, _HEADER_READ)
        except Mp4ReadError as err:
            layout.error = f"after {len(boxes)} boxes: {err}"
            break
        if (box := parse_box_header(data, offset)) is None:
            break
        boxes.append(box)
        if box.end is None:
            break
        offset = box.end
    return await _describe(read, boxes, layout)


async def _describe(read: ReadFunc, boxes: list[Box], layout: Mp4Layout) -> Mp4Layout:
    """Fill the layout from the top-level boxes, reading moov through ``read``."""
    layout.top_level = [b.type for b in boxes]
    moov = next((b for b in boxes if b.type == "moov"), None)
    mdat = next((b for b in boxes if b.type == "mdat"), None)
    if mdat is not None:
        layout.mdat_offset, layout.mdat_size = mdat.offset, mdat.size
    if moov is None:
        if not layout.truncated and layout.error is None:
            layout.error = "no moov box found"
        layout.fragmented = "moof" in layout.top_level or None
        if mdat is not None and layout.fragmented is None:
            # moov comes after an mdat we could not get past.
            layout.moov_before_mdat = False
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
        head = await read(stsd.payload, 8 + 8 + 28)
        track.sample_entry, track.width, track.height = parse_stsd(head)
        entry = parse_box_header(head[8:], stsd.payload + 8)
        if entry is not None and entry.size is not None:
            size = min(entry.size, _MAX_ENTRY)
            track.codec = codec_string(await read(entry.offset, size))
    return track


def _find(boxes: list[Box], box_type: str) -> Box | None:
    return next((b for b in boxes if b.type == box_type), None)


class BoxScanner:
    """Follow the top-level boxes of an MP4 as it streams by, without Range.

    Feed it the body of a plain GET in order. It records every top-level box
    header it passes and keeps the bytes of the moov box (up to a limit), so
    :meth:`async_layout` can describe the file from whatever part was read.
    """

    def __init__(self, max_boxes: int = 64) -> None:
        """Initialize the scanner."""
        self._max_boxes = max_boxes
        self._pos = 0
        self._next = 0
        self._hdr = bytearray()
        self._captures: list[tuple[Box, bytearray]] = []
        self.boxes: list[Box] = []
        self.truncated = False
        self.error: str | None = None
        self._stopped = False

    @property
    def bytes_seen(self) -> int:
        """Return how many body bytes were fed."""
        return self._pos

    def feed(self, chunk: bytes) -> None:
        """Consume the next piece of the body."""
        start = self._pos
        self._pos += len(chunk)
        for box, data in self._captures:
            self._capture(box, data, chunk, start)
        while not self._stopped and self._next < self._pos:
            if self._next >= start:
                rel = self._next - start
                self._hdr = bytearray(chunk[rel : rel + _HEADER_READ])
            else:
                # The header started in an earlier chunk.
                self._hdr += chunk[: _HEADER_READ - len(self._hdr)]
            if len(self._hdr) < _HEADER_READ:
                return  # wait for the rest of the header
            self._header(chunk, start)

    def finish(self) -> None:
        """Handle a short header left at the end of the stream."""
        if not self._stopped and len(self._hdr) >= 8 and self._next < self._pos:
            self._header(b"", self._pos)

    def _header(self, chunk: bytes, start: int) -> None:
        header, self._hdr = bytes(self._hdr), bytearray()
        box = parse_box_header(header, self._next)
        if box is None:
            self.error = f"unparseable box header at {self._next}"
            self._stopped = True
            return
        self.boxes.append(box)
        if box.type in _CAPTURE and box.size is not None and box.size <= _CAPTURE_LIMIT:
            # Header bytes that arrived in earlier chunks, then this chunk's part.
            data = bytearray(header[: max(0, start - box.offset)])
            self._captures.append((box, data))
            self._capture(box, data, chunk, start)
        if box.end is None:
            self._stopped = True
            return
        if len(self.boxes) >= self._max_boxes:
            self.truncated = True
            self._stopped = True
            return
        self._next = box.end

    @staticmethod
    def _capture(box: Box, data: bytearray, chunk: bytes, start: int) -> None:
        assert box.end is not None
        lo = max(box.offset, start)
        hi = min(box.end, start + len(chunk))
        if lo < hi:
            data += chunk[lo - start : hi - start]

    async def async_layout(self) -> Mp4Layout:
        """Describe the file from what streamed by."""
        layout = Mp4Layout(truncated=self.truncated, error=self.error)
        captured = {box: bytes(data) for box, data in self._captures}

        async def read(offset: int, length: int) -> bytes:
            for box, data in captured.items():
                if box.offset <= offset and offset + length <= box.offset + len(data):
                    rel = offset - box.offset
                    return data[rel : rel + length]
                if box.end is not None and box.offset <= offset < box.end:
                    # The tail of a box that was not read to its end.
                    raise Mp4ReadError(f"{box.type} not read to its end")
            for box in self.boxes:
                if box.type in _CAPTURE and box.offset <= offset < (box.end or 0):
                    raise Mp4ReadError(f"{box.type} larger than the capture limit")
            raise Mp4ReadError("bytes not in the part of the stream that was read")

        boxes = list(self.boxes)
        if not self._stopped and boxes and boxes[-1].end is not None:
            # The read stopped inside the last box; later boxes were not seen.
            layout.truncated = layout.truncated or boxes[-1].end > self._pos
        return await _describe(read, boxes, layout)

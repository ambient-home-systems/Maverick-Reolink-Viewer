"""Synthetic MP4 files for the box reader and the playback check."""

import struct


def box(box_type: str, payload: bytes = b"") -> bytes:
    """Build one box."""
    return struct.pack(">I4s", 8 + len(payload), box_type.encode()) + payload


def full_box(box_type: str, payload: bytes, version: int = 0) -> bytes:
    """Build a full box (version + flags)."""
    return box(box_type, bytes([version, 0, 0, 0]) + payload)


def mvhd(seconds: float, timescale: int = 1000, version: int = 0) -> bytes:
    """Build an mvhd box for a movie of ``seconds``."""
    duration = round(seconds * timescale)
    if version == 1:
        body = struct.pack(">QQIQ", 0, 0, timescale, duration)
    else:
        body = struct.pack(">IIII", 0, 0, timescale, duration)
    return full_box("mvhd", body + bytes(80), version)


def hdlr(handler: str) -> bytes:
    """Build an hdlr box."""
    return full_box("hdlr", b"\0\0\0\0" + handler.encode() + bytes(12) + b"\0")


# H.265 Main, level 5.1, as Reolink cameras write it.
HVCC = box(
    "hvcC", bytes([1, 0x01, 0x60, 0, 0, 0, 0xB0, 0, 0, 0, 0, 0, 153]) + bytes(10)
)
# H.264 High, level 5.1.
AVCC = box("avcC", bytes([1, 0x64, 0x00, 0x33, 0xFF]) + bytes(4))
# AAC-LC: ES_Descriptor > DecoderConfigDescriptor (0x40) > DecoderSpecificInfo.
ESDS = full_box(
    "esds",
    bytes([0x03, 25, 0, 1, 0, 0x04, 17, 0x40, 0x15])
    + bytes(11)
    + bytes([0x05, 2, 0x12, 0x10, 0x06, 1, 2]),
)


def visual_entry(entry: str, width: int, height: int, config: bytes = b"") -> bytes:
    """Build a visual sample entry, with its codec configuration box."""
    body = (
        bytes(6) + struct.pack(">H", 1) + bytes(16) + struct.pack(">HH", width, height)
    )
    return box(entry, body + bytes(50) + config)


def audio_entry(entry: str, config: bytes = b"") -> bytes:
    """Build an audio sample entry."""
    return box(entry, bytes(28) + config)


def trak(handler: str, entry: bytes) -> bytes:
    """Build trak > mdia > (hdlr, minf > stbl > stsd)."""
    stsd = full_box("stsd", struct.pack(">I", 1) + entry)
    minf = box("minf", box("vmhd", bytes(12)) + box("stbl", stsd))
    return box("trak", box("tkhd", bytes(84)) + box("mdia", hdlr(handler) + minf))


FTYP = box("ftyp", b"isom\0\0\x02\0isomiso2mp41")


def moov(seconds: float = 60.0, *, fragmented: bool = False) -> bytes:
    """Build a moov with an H.265 video and an AAC audio track."""
    children = (
        mvhd(seconds)
        + trak("vide", visual_entry("hvc1", 3840, 2160, HVCC))
        + trak("soun", audio_entry("mp4a", ESDS))
    )
    if fragmented:
        children += box("mvex", full_box("trex", bytes(20)))
    return box("moov", children)


def mp4_file(
    *, mdat_bytes: int = 2 * 1024 * 1024, moov_first: bool = True, seconds: float = 60
) -> bytes:
    """Build a plain MP4 with the moov before or after the mdat."""
    # A deterministic, non-repeating payload so range answers can be compared.
    payload = bytes((i * 7 + i // 251) & 0xFF for i in range(mdat_bytes))
    mdat = box("mdat", payload)
    if moov_first:
        return FTYP + moov(seconds) + mdat
    return FTYP + mdat + moov(seconds)


def fragmented_file(fragments: int = 3) -> bytes:
    """Build a fragmented MP4 (empty moov with mvex, then moof/mdat pairs)."""
    data = FTYP + moov(0, fragmented=True)
    for _ in range(fragments):
        data += box("moof", box("mfhd", bytes(8))) + box("mdat", bytes(1000))
    return data

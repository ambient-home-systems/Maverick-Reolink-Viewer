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


def visual_entry(entry: str, width: int, height: int) -> bytes:
    """Build a visual sample entry."""
    body = (
        bytes(6) + struct.pack(">H", 1) + bytes(16) + struct.pack(">HH", width, height)
    )
    return box(entry, body + bytes(50))


def audio_entry(entry: str) -> bytes:
    """Build an audio sample entry."""
    return box(entry, bytes(28))


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
        + trak("vide", visual_entry("hvc1", 3840, 2160))
        + trak("soun", audio_entry("mp4a"))
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

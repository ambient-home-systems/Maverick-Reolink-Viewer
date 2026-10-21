"""Synthetic MP4 files for the box reader and the playback check."""

from pathlib import Path
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


VIDEO_TIMESCALE = 90_000
AUDIO_TIMESCALE = 16_000
FRAME = 3600  # 25 fps
AUDIO_FRAME = 1024
FRAMES = 50  # 2 s fragments
AUDIO_FRAMES = 31
SYNC = 0x02000000  # sample_depends_on = 2 (an I frame)
NON_SYNC = 0x01010000


def _tkhd(track_id: int) -> bytes:
    return full_box("tkhd", struct.pack(">IIIII", 0, 0, track_id, 0, 0) + bytes(60))


def _mdhd(timescale: int) -> bytes:
    return full_box("mdhd", struct.pack(">IIIIHH", 0, 0, timescale, 0, 0, 0))


def av_trak(track_id: int, timescale: int, handler: str, entry: bytes) -> bytes:
    """Build a trak with a track id and a media timescale."""
    stsd = full_box("stsd", struct.pack(">I", 1) + entry)
    minf = box("minf", box("vmhd", bytes(12)) + box("stbl", stsd))
    mdia = box("mdia", _mdhd(timescale) + hdlr(handler) + minf)
    return box("trak", _tkhd(track_id) + mdia)


def _trex(track_id: int, duration: int) -> bytes:
    return full_box("trex", struct.pack(">IIIII", track_id, 1, duration, 0, 0))


def _tfhd(track_id: int, flags: int, extra: bytes) -> bytes:
    return box("tfhd", struct.pack(">I", flags) + struct.pack(">I", track_id) + extra)


def _moof(
    index: int,
    *,
    base: int | None,
    non_sync: bool,
    tfdt: bool = True,
    offsets: tuple[int, int] = (0, 0),
) -> bytes:
    """Build a moof; ``base``: an absolute base data offset (the moof's own).

    ``offsets``: the video and audio runs' data offsets from the base.
    """
    base_flags = 0x020000 if base is None else 0x01
    base_extra = b"" if base is None else struct.pack(">Q", base)
    video_run = struct.pack(">II", 0x001 | 0x004 | 0x100 | 0x200, FRAMES)
    video_run += struct.pack(">iI", offsets[0], NON_SYNC if non_sync else SYNC)
    video_run += b"".join(struct.pack(">II", FRAME, 100) for _ in range(FRAMES))
    video_time = full_box("tfdt", struct.pack(">Q", index * FRAMES * FRAME), version=1)
    video = box(
        "traf",
        _tfhd(1, base_flags, base_extra)
        + (video_time if tfdt else b"")
        + box("trun", video_run),
    )
    audio_run = struct.pack(">II", 0x001 | 0x200, AUDIO_FRAMES)
    audio_run += struct.pack(">i", offsets[1])
    audio_run += b"".join(struct.pack(">I", 10) for _ in range(AUDIO_FRAMES))
    audio_time = full_box("tfdt", struct.pack(">I", index * AUDIO_FRAMES * AUDIO_FRAME))
    audio = box(
        "traf",
        _tfhd(2, base_flags | 0x08, base_extra + struct.pack(">I", AUDIO_FRAME))
        + (audio_time if tfdt else b"")
        + box("trun", audio_run),
    )
    return box("moof", box("mfhd", struct.pack(">II", 0, index + 1)) + video + audio)


def av_moov() -> bytes:
    """Build the moov of an NVR-like fragmented file (1 s placeholder duration)."""
    return box(
        "moov",
        mvhd(1)
        + av_trak(1, VIDEO_TIMESCALE, "vide", visual_entry("avc1", 640, 360, AVCC))
        + av_trak(2, AUDIO_TIMESCALE, "soun", audio_entry("mp4a", ESDS))
        + box("mvex", _trex(1, FRAME) + _trex(2, AUDIO_FRAME)),
    )


def fragmented_av(
    fragments: int = 4,
    *,
    absolute: bool = False,
    tfdt: bool = True,
    non_sync: frozenset[int] = frozenset(),
) -> bytes:
    """Build an NVR-like fragmented MP4: 2 s fragments of video and audio.

    Each mdat holds the video samples (100 bytes each), then the audio ones
    (10 bytes each), and the runs' data offsets point at them.
    ``absolute``: each tfhd gives its moof's file position as base_data_offset,
    as the NVR does. ``tfdt=False``: no decode times, as the NVR writes them.
    """
    data = FTYP + av_moov()
    for i in range(fragments):
        payload = bytes((i * 31 + j) & 0xFF for j in range(FRAMES * 100 + 310))
        base = len(data) if absolute else None
        sync = i in non_sync
        size = len(_moof(i, base=base, non_sync=sync, tfdt=tfdt))
        offsets = (size + 8, size + 8 + FRAMES * 100)
        data += _moof(i, base=base, non_sync=sync, tfdt=tfdt, offsets=offsets)
        data += box("mdat", payload)
    return data


def real_fragmented(path: Path, seconds: int = 3) -> bool:
    """Write a real fragmented MP4 (absolute offsets, like the NVR's) with ffmpeg.

    Returns False when ffmpeg is not installed.
    """
    import shutil
    import subprocess

    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg is None:
        return False
    subprocess.run(
        [
            ffmpeg,
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-f",
            "lavfi",
            "-i",
            f"testsrc2=size=160x90:rate=10:duration={seconds}",
            "-f",
            "lavfi",
            "-i",
            f"sine=d={seconds}:sample_rate=16000",
            "-c:v",
            "mpeg4",
            "-c:a",
            "aac",
            "-movflags",
            "+frag_keyframe+empty_moov",
            "-frag_duration",
            "1000000",
            str(path),
        ],
        check=True,
    )
    return True


def mse_ready(
    path: Path,
    *,
    video: str = "libx264",
    audio: str = "aac",
    seconds: int = 8,
    fragment_s: float = 1.0,
) -> bool:
    """Write a fragmented MP4 as MSE wants it (default-base-is-moof, tfdt).

    One fragment per ``fragment_s`` (each starting with a key frame). Returns
    False when ffmpeg or the encoders are missing.
    """
    import shutil
    import subprocess

    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg is None:
        return False
    rate = 10
    codec_args = {
        "libx264": ["-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p"],
        "libvpx-vp9": ["-c:v", "libvpx-vp9", "-deadline", "realtime", "-b:v", "200k"],
    }[video]
    sample_rate = 48000 if audio == "libopus" else 16000
    result = subprocess.run(
        [
            ffmpeg,
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-f",
            "lavfi",
            "-i",
            f"testsrc2=size=160x90:rate={rate}:duration={seconds}",
            "-f",
            "lavfi",
            "-i",
            f"sine=d={seconds}:sample_rate={sample_rate}",
            *codec_args,
            "-g",
            str(round(rate * fragment_s)),
            "-c:a",
            audio,
            "-movflags",
            "+frag_keyframe+empty_moov+default_base_moof",
            "-frag_duration",
            str(round(fragment_s * 1_000_000)),
            str(path),
        ],
        check=False,
        capture_output=True,
    )
    return result.returncode == 0


def nvr_shape(data: bytes) -> bytes:
    """Rewrite an MSE-ready fragmented MP4 the NVR's way.

    Every tfhd gets its moof's absolute position as base_data_offset (instead
    of default-base-is-moof) and every tfdt is dropped. The trun data offsets
    are moved to point at the same samples.
    """
    out = bytearray()
    for box_type, raw in _top(data):
        if box_type != "moof":
            out += raw
            continue
        moof_at = len(out)
        draft = _nvr_moof(raw, moof_at, 0)
        out += _nvr_moof(raw, moof_at, len(draft) - len(raw))
    return bytes(out)


def _top(data: bytes) -> list[tuple[str, bytes]]:
    boxes = []
    at = 0
    while at + 8 <= len(data):
        size, kind = struct.unpack(">I4s", data[at : at + 8])
        boxes.append((kind.decode(), data[at : at + size]))
        at += size
    return boxes


def _nvr_moof(moof: bytes, moof_at: int, shift: int) -> bytes:
    children = b""
    for kind, raw in _top(moof[8:]):
        if kind != "traf":
            children += raw
            continue
        traf = b""
        for child_kind, child in _top(raw[8:]):
            if child_kind == "tfdt":
                continue
            if child_kind == "tfhd":
                flags = int.from_bytes(child[9:12], "big")
                assert flags & 0x020000, "expected default-base-is-moof"
                flags = (flags & ~0x020000) | 0x01
                body = (
                    child[8:9]
                    + flags.to_bytes(3, "big")
                    + child[12:16]
                    + struct.pack(">Q", moof_at)
                    + child[16:]
                )
                traf += box("tfhd", body)
            elif child_kind == "trun":
                flags = int.from_bytes(child[9:12], "big")
                assert flags & 0x01, "expected a data offset"
                (offset,) = struct.unpack(">i", child[16:20])
                traf += box(
                    "trun", child[8:16] + struct.pack(">i", offset + shift) + child[20:]
                )
            else:
                traf += child
        children += box("traf", traf)
    return box("moof", children)

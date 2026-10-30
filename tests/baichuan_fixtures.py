"""Camera-like Baichuan streams from real encoders (the muxer's tests).

ffmpeg encodes a test picture (x264 or x265, no B-frames, as the cameras do)
and a tone (AAC-LC, 16 kHz, mono, ADTS); the access units and AAC frames are
then wrapped in Baichuan blocks the way the NVR's download cut sends them:
key frames with the POSIX second in their extra header, a 32-bit counter at
a camera's own rate, audio blocks interleaved after the frames they follow.
"""

from dataclasses import dataclass
import math
from pathlib import Path
import shutil
import subprocess

from custom_components.reolink_viewer import baichuan_media as bm

from .test_baichuan_media import annexb, audio, video

FPS = 10
GOP = 10  # a key frame each second
AUDIO_RATE = 16_000


@dataclass(frozen=True, slots=True)
class Encoded:
    """Access units (NAL units each) and raw ADTS frames."""

    codec: str  # h264, h265
    units: list[list[bytes]]
    adts: list[bytes]


def ffmpeg_encode(path: Path, args: list[str]) -> bytes | None:
    """Run ffmpeg to write ``path``; None if it is missing or fails."""
    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg is None:
        return None
    result = subprocess.run(
        [ffmpeg, "-hide_banner", "-loglevel", "error", "-y", *args, str(path)],
        capture_output=True,
        check=False,
    )
    return path.read_bytes() if result.returncode == 0 else None


def access_units(data: bytes, codec: str) -> list[list[bytes]]:
    """Split an Annex B stream into access units (by first slices)."""
    _layout, units = bm.nal_units(data)
    hevc = codec == "h265"
    out: list[list[bytes]] = []
    pending: list[bytes] = []
    for unit in units:
        kind = bm.h265_nal_type(unit) if hevc else bm.h264_nal_type(unit)
        is_slice = kind <= 21 if hevc else kind in (1, 5)
        first = bool(unit[2] & 0x80) if hevc else bool(unit[1] & 0x80)
        if is_slice and first and any(_is_slice(u, hevc) for u in pending):
            out.append(pending)
            pending = []
        pending.append(unit)
    if pending:
        out.append(pending)
    return out


def _is_slice(unit: bytes, hevc: bool) -> bool:
    if hevc:
        return bm.h265_nal_type(unit) <= 21
    return bm.h264_nal_type(unit) in (1, 5)


def adts_frames(data: bytes) -> list[bytes]:
    """Split an ADTS stream into its frames (headers kept)."""
    frames = []
    at = 0
    while at + 7 <= len(data):
        length = ((data[at + 3] & 3) << 11) | (data[at + 4] << 3) | (data[at + 5] >> 5)
        frames.append(data[at : at + length])
        at += length
    return frames


def encode(tmp_path: Path, codec: str, seconds: float = 3.0) -> Encoded | None:
    """Encode a test picture (320x240) and a tone; None without ffmpeg."""
    if codec == "h264":
        args = ["-c:v", "libx264", "-preset", "veryfast", "-profile:v", "high"]
        args += ["-bf", "0"]
        args += ["-g", str(GOP), "-sc_threshold", "0", "-f", "h264"]
    else:
        args = ["-c:v", "libx265", "-preset", "ultrafast", "-x265-params"]
        args += [f"bframes=0:keyint={GOP}:min-keyint={GOP}:scenecut=0:log-level=none"]
        args += ["-f", "hevc"]
    picture = ffmpeg_encode(
        tmp_path / f"v.{codec}",
        [
            "-f",
            "lavfi",
            "-i",
            f"testsrc=size=320x240:rate={FPS}",
            "-t",
            str(seconds),
            "-pix_fmt",
            "yuv420p",
            *args,
        ],
    )
    tone = ffmpeg_encode(
        tmp_path / "a.aac",
        [
            "-f",
            "lavfi",
            "-i",
            f"sine=frequency=440:sample_rate={AUDIO_RATE}",
            "-t",
            str(seconds),
            "-c:a",
            "aac",
            "-ac",
            "1",
            "-f",
            "adts",
        ],
    )
    if picture is None or tone is None:
        return None
    return Encoded(codec, access_units(picture, codec), adts_frames(tone))


def camera_stream(
    encoded: Encoded,
    *,
    start_unix: int,
    rate: int = 1_000_000,
    start_micro: int = 0,
    with_audio: bool = True,
    repeat: int = 1,
) -> bytes:
    """The bytes of a download cut of ``encoded`` (repeated ``repeat`` times).

    The key frames' POSIX seconds are whole (truncated), the counter runs at
    ``rate`` ticks per second from ``start_micro`` and wraps at 32 bits.
    """
    label = encoded.codec.upper()
    out = bytearray()
    frames = encoded.units * repeat
    tones = encoded.adts * repeat
    next_audio = 0
    for i, units in enumerate(frames):
        seconds = i / FPS
        key = i % GOP == 0
        micro = (start_micro + round(seconds * rate)) & 0xFFFFFFFF
        out += video(
            "key" if key else "frame",
            annexb(*units),
            codec=label,
            micro=micro,
            unix=start_unix + math.floor(seconds) if key else 0,
        )
        if not with_audio:
            continue
        while (
            next_audio < len(tones)
            and next_audio * 1024 / AUDIO_RATE < seconds + 1 / FPS
        ):
            out += audio(tones[next_audio])
            next_audio += 1
    return bytes(out)


def ffprobe_json(path: Path, *args: str) -> str | None:
    """Run ffprobe with JSON output; None without it."""
    ffprobe = shutil.which("ffprobe")
    if ffprobe is None:
        return None
    result = subprocess.run(
        [ffprobe, "-v", "error", "-of", "json", *args, str(path)],
        capture_output=True,
        text=True,
        check=False,
    )
    return result.stdout if result.returncode == 0 else None


def ffmpeg_decode_errors(path: Path) -> str | None:
    """Decode every frame; return ffmpeg's errors ("" when clean), None without it."""
    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg is None:
        return None
    result = subprocess.run(
        [ffmpeg, "-hide_banner", "-v", "error", "-i", str(path), "-f", "null", "-"],
        capture_output=True,
        text=True,
        check=False,
    )
    return (
        result.stderr.strip() if result.returncode == 0 else result.stderr or "failed"
    )

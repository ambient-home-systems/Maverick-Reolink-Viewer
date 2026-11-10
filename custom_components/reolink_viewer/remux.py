"""ffmpeg's rewrites: a cached recording as a plain MP4, a key frame as a JPEG.

A plain MP4 (``moov`` first, not fragmented): on the hardware check, Chrome
read the NVR's fragmented recordings whole before it showed a frame, even with
a segment index (``mp4index.py``): 2 s for 97 MB. A plain MP4 with its sample
tables at the front is what every browser seeks in at once. ffmpeg copies the
streams (``-c copy``, no re-encoding); this runs after a recording is cached,
off the click path.

A JPEG of a key frame: the past pictures the bridge reads itself (the
Doorbell's). reolink-aio did this (``i_frame_to_jpeg``) until 0.23.0 took it
out, so it is done here: its ffmpeg command, held to one picture.
"""

import asyncio
from asyncio.subprocess import DEVNULL, PIPE
from pathlib import Path

from .mp4 import parse_box_header

FLATTEN_TIMEOUT = 300.0
JPEG_TIMEOUT = 10.0
_ERROR_CHARS = 300


class RemuxError(Exception):
    """ffmpeg could not rewrite the recording or the picture."""


async def async_flatten(
    binary: str, source: Path, target: Path, timeout: float = FLATTEN_TIMEOUT
) -> None:
    """Write ``source`` to ``target`` as a plain MP4 with ``moov`` first."""
    process = await asyncio.create_subprocess_exec(
        binary,
        "-hide_banner",
        "-loglevel",
        "error",
        "-nostdin",
        "-y",
        "-i",
        str(source),
        "-map",
        "0",
        "-c",
        "copy",
        "-movflags",
        "+faststart",
        "-f",
        "mp4",
        str(target),
        stdin=DEVNULL,
        stdout=DEVNULL,
        stderr=PIPE,
    )
    try:
        async with asyncio.timeout(timeout):
            _out, err = await process.communicate()
    except TimeoutError:
        raise RemuxError("timed out") from None
    finally:
        if process.returncode is None:
            process.kill()
            await process.wait()
    if process.returncode != 0:
        text = err.decode(errors="replace").strip()[-_ERROR_CHARS:]
        raise RemuxError(text or f"ffmpeg exited with {process.returncode}")


async def async_jpeg_from_frame(
    binary: str, frame: bytes, timeout: float = JPEG_TIMEOUT
) -> bytes:
    """Decode one key frame (Annex B, H.264 or H.265) into a JPEG.

    ffmpeg finds the codec itself. Cancelled or timed out, ffmpeg is killed.
    """
    try:
        process = await asyncio.create_subprocess_exec(
            binary,
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            "pipe:0",
            "-frames:v",
            "1",
            "-f",
            "image2",
            "pipe:1",
            stdin=PIPE,
            stdout=PIPE,
            stderr=PIPE,
        )
    except OSError as err:
        raise RemuxError(f"cannot start ffmpeg: {err}") from err
    try:
        async with asyncio.timeout(timeout):
            image, stderr = await process.communicate(frame)
    except TimeoutError:
        raise RemuxError("timed out") from None
    finally:
        if process.returncode is None:
            process.kill()
            await process.wait()
    if process.returncode != 0 or not image:
        text = stderr.decode(errors="replace").strip()[-_ERROR_CHARS:]
        raise RemuxError(text or f"ffmpeg exited with {process.returncode}")
    return image


def is_plain(path: Path) -> bool:
    """Whether a file is a plain MP4: moov first, then mdat (not fragments).

    Blocking: run it in an executor.
    """
    seen_moov = False
    with path.open("rb") as file:
        offset = 0
        for _ in range(8):
            file.seek(offset)
            box = parse_box_header(file.read(16), offset)
            if box is None or box.type == "moof":
                return False
            if box.type == "mdat":
                return seen_moov
            seen_moov = seen_moov or box.type == "moov"
            if box.end is None:
                return False
            offset = box.end
    return False


def moov_size(path: Path) -> int | None:
    """Return the size of a file's top-level moov box, if found early.

    Blocking: run it in an executor.
    """
    with path.open("rb") as file:
        offset = 0
        for _ in range(8):
            file.seek(offset)
            box = parse_box_header(file.read(16), offset)
            if box is None or box.end is None:
                return None
            if box.type == "moov":
                return box.size
            offset = box.end
    return None

"""Rewrite a cached recording as a plain MP4 (``moov`` first, not fragmented).

On the hardware check, Chrome read the NVR's fragmented recordings whole
before it showed a frame, even with a segment index (``mp4index.py``): 2 s
for 97 MB. A plain MP4 with its sample tables at the front is what every
browser seeks in at once. ffmpeg copies the streams (``-c copy``, no
re-encoding); this runs after a recording is cached, off the click path.
"""

import asyncio
from asyncio.subprocess import DEVNULL, PIPE
from pathlib import Path

from .mp4 import parse_box_header

FLATTEN_TIMEOUT = 300.0
_ERROR_CHARS = 300


class RemuxError(Exception):
    """ffmpeg could not rewrite the recording."""


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

"""Media measurements: time-to-first-frame (ffmpeg) and time-to-first-byte (HTTP).

These helpers open camera URLs handed to them by the bridge. Callers run them
through the scheduler. Error strings never contain the URL; callers still pass
them through ``bridge.redact_text`` before they leave the server.
"""

import asyncio
from collections.abc import Callable
from contextlib import suppress
from dataclasses import asdict, dataclass, field, fields
import re
import time
from typing import Any

from aiohttp import ClientError, ClientSession, ClientTimeout

from .bridge import CameraUrl

_VIDEO_LINE = re.compile(r"Stream #\S+.*?: Video: (?P<codec>\w+)(?P<rest>.*)")
_RESOLUTION = re.compile(r"\b(?P<w>\d{2,5})x(?P<h>\d{2,5})\b")
_FRAME_COUNT = re.compile(r"frame=\s*(?P<n>\d+)")
_MAX_ERROR_LEN = 300
_CHUNK = 64 * 1024

VIDEO_CONTENT_TYPES = frozenset(
    {
        "video/mp4",
        "video/x-flv",
        "application/octet-stream",
        # Reolink typo seen in the wild, handled by HA's Reolink views too.
        "apolication/octet-stream",
    }
)


@dataclass(slots=True)
class FrameResult:
    """Outcome of opening a stream and decoding frames."""

    ok: bool
    open_ms: float | None = None
    ttff_ms: float | None = None
    codec: str | None = None
    width: int | None = None
    height: int | None = None
    frames: int | None = None
    error: str | None = None

    def as_dict(self) -> dict[str, Any]:
        """Return a JSON-serializable dict."""
        return asdict(self)


@dataclass(slots=True)
class ByteResult:
    """Outcome of an HTTP request for media."""

    ok: bool
    headers_ms: float | None = None
    ttfb_ms: float | None = None
    status: int | None = None
    content_type: str | None = None
    container: str | None = None
    bytes_read: int = 0
    error: str | None = None

    def as_dict(self) -> dict[str, Any]:
        """Return a JSON-serializable dict."""
        return asdict(self)


def _ms(start: float) -> float:
    return round((time.monotonic() - start) * 1000, 1)


def _clean(text: str, url: CameraUrl) -> str:
    text = text.replace(url.value, "<url>").strip()
    return text[-_MAX_ERROR_LEN:]


def parse_video_line(line: str) -> tuple[str, int | None, int | None] | None:
    """Parse ffmpeg's 'Stream #0:0: Video: h264 ..., 1920x1080' line."""
    match = _VIDEO_LINE.search(line)
    if match is None:
        return None
    width = height = None
    if res := _RESOLUTION.search(match.group("rest")):
        width, height = int(res.group("w")), int(res.group("h"))
    return match.group("codec"), width, height


def sniff_container(data: bytes) -> str | None:
    """Identify FLV / MP4 from the first bytes."""
    if data.startswith(b"FLV"):
        return "flv"
    if data[4:8] in (b"ftyp", b"moov", b"mdat", b"free"):
        return "mp4"
    return None


def _ffmpeg_input_args(url: CameraUrl) -> list[str]:
    args = ["-hide_banner", "-nostdin", "-loglevel", "info"]
    if url.scheme == "rtsp":
        args += ["-rtsp_transport", "tcp"]
    return [*args, "-i", url.value, "-an", "-sn", "-dn"]


async def _run_ffmpeg(
    ffmpeg_binary: str, args: list[str], url: CameraUrl, timeout: float
) -> FrameResult:
    start = time.monotonic()
    try:
        proc = await asyncio.create_subprocess_exec(
            ffmpeg_binary,
            *args,
            stdin=asyncio.subprocess.DEVNULL,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.PIPE,
        )
    except OSError as err:
        return FrameResult(ok=False, error=f"cannot start ffmpeg: {err}")

    result = FrameResult(ok=False)
    tail: list[str] = []
    assert proc.stderr is not None

    def handle_line(line: str) -> None:
        if result.codec is None and (video := parse_video_line(line)):
            result.open_ms = _ms(start)
            result.codec, result.width, result.height = video
        if frames := _FRAME_COUNT.findall(line):
            result.frames = int(frames[-1])
        if line.strip():
            tail.append(line)
            del tail[:-5]

    async def read_stderr() -> None:
        # Progress lines end in '\r', so split on both rather than readline().
        assert proc.stderr is not None
        pending = ""
        while chunk := await proc.stderr.read(4096):
            pending += chunk.decode(errors="replace")
            *lines, pending = re.split(r"[\r\n]", pending)
            for line in lines:
                handle_line(line)
        if pending:
            handle_line(pending)

    try:
        async with asyncio.timeout(timeout):
            await read_stderr()
            returncode = await proc.wait()
    except TimeoutError:
        result.error = f"timeout after {timeout:.0f}s"
        return result
    finally:
        if proc.returncode is None:
            with suppress(ProcessLookupError):
                proc.kill()
            with suppress(Exception):
                await proc.wait()

    if returncode == 0 and result.codec is not None:
        result.ok = True
        result.ttff_ms = _ms(start)
    else:
        result.error = _clean(" | ".join(tail) or f"ffmpeg exit code {returncode}", url)
    return result


async def async_first_frame(
    ffmpeg_binary: str, url: CameraUrl, *, timeout: float
) -> FrameResult:
    """Open a stream and decode one video frame.

    ``open_ms`` is when ffmpeg reported the video stream, ``ttff_ms`` when the
    first frame was decoded (process exit).
    """
    args = [*_ffmpeg_input_args(url), "-frames:v", "1", "-f", "null", "-"]
    return await _run_ffmpeg(ffmpeg_binary, args, url, timeout)


async def async_hold_stream(
    ffmpeg_binary: str, url: CameraUrl, *, seconds: float, timeout: float
) -> FrameResult:
    """Keep a stream open for ``seconds`` and count decoded frames."""
    args = [*_ffmpeg_input_args(url), "-t", f"{seconds:g}", "-f", "null", "-"]
    result = await _run_ffmpeg(ffmpeg_binary, args, url, timeout)
    if result.ok and not result.frames:
        result.ok = False
        result.error = "no frames decoded"
    return result


async def async_first_bytes(
    session: ClientSession, url: CameraUrl, *, timeout: float
) -> ByteResult:
    """Request a media URL and time the headers and the first body bytes."""
    start = time.monotonic()
    result = ByteResult(ok=False)
    try:
        async with asyncio.timeout(timeout):
            async with session.get(
                url.value, timeout=ClientTimeout(total=None, sock_connect=timeout)
            ) as resp:
                result.headers_ms = _ms(start)
                result.status = resp.status
                result.content_type = resp.content_type
                data = await resp.content.read(64 * 1024)
                if data:
                    result.ttfb_ms = _ms(start)
                result.bytes_read = len(data)
                result.container = sniff_container(data)
    except TimeoutError:
        result.error = f"timeout after {timeout:.0f}s"
        return result
    except ClientError as err:
        result.error = _clean(f"{type(err).__name__}: {err}", url)
        return result

    if result.status != 200:
        result.error = f"HTTP {result.status}"
    elif not result.bytes_read:
        result.error = "empty body"
    elif result.container is None and result.content_type not in VIDEO_CONTENT_TYPES:
        result.error = f"unexpected content type {result.content_type}"
    else:
        result.ok = True
    return result


@dataclass(slots=True)
class FetchResult:
    """Outcome of a (ranged, time-boxed, optionally paced) HTTP GET."""

    ok: bool
    range: str | None = None
    status: int | None = None
    headers_ms: float | None = None
    ttfb_ms: float | None = None
    content_type: str | None = None
    content_length: int | None = None
    content_range: str | None = None
    accept_ranges: str | None = None
    transfer_encoding: str | None = None
    bytes_read: int = 0
    eof: bool = False
    # From the first body byte to the end of the read.
    read_ms: float | None = None
    mbit_s: float | None = None
    error: str | None = None
    # The first ``keep_bytes`` of the body; never serialized.
    data: bytes = field(default=b"", repr=False)

    def as_dict(self) -> dict[str, Any]:
        """Return a JSON-serializable dict (without the body)."""
        return {f.name: getattr(self, f.name) for f in fields(self) if f.name != "data"}


def _int_header(value: str | None) -> int | None:
    try:
        return int(value) if value is not None else None
    except ValueError:
        return None


async def async_fetch(
    session: ClientSession,
    url: CameraUrl,
    *,
    range_header: str | None = None,
    max_bytes: int,
    max_seconds: float | None = None,
    keep_bytes: int = 0,
    pace_bps: float | None = None,
    on_chunk: Callable[[bytes], None] | None = None,
    timeout: float,
) -> FetchResult:
    """GET a media URL, reading at most ``max_bytes`` / ``max_seconds`` of body.

    ``pace_bps`` limits the read rate (bytes per second) the way a player that
    buffers ahead would, so TCP back-pressure keeps the stream open on the
    device. ``on_chunk`` sees every body chunk in order. The connection is
    closed as soon as the read stops. ``ok`` means an HTTP 200/206 with a body;
    callers judge the Range semantics.
    """
    start = time.monotonic()
    result = FetchResult(ok=False, range=range_header)
    kept = bytearray()
    first: float | None = None
    headers = {"Range": range_header} if range_header else None
    try:
        async with asyncio.timeout(timeout):
            async with session.get(
                url.value,
                headers=headers,
                timeout=ClientTimeout(total=None, sock_connect=timeout),
            ) as resp:
                result.headers_ms = _ms(start)
                result.status = resp.status
                result.content_type = resp.content_type
                result.content_length = _int_header(resp.headers.get("Content-Length"))
                result.content_range = resp.headers.get("Content-Range")
                result.accept_ranges = resp.headers.get("Accept-Ranges")
                result.transfer_encoding = resp.headers.get("Transfer-Encoding")
                while result.bytes_read < max_bytes:
                    chunk = await resp.content.read(
                        min(_CHUNK, max_bytes - result.bytes_read)
                    )
                    if not chunk:
                        result.eof = True
                        break
                    now = time.monotonic()
                    if first is None:
                        first = now
                        result.ttfb_ms = _ms(start)
                    result.bytes_read += len(chunk)
                    if len(kept) < keep_bytes:
                        kept += chunk[: keep_bytes - len(kept)]
                    if on_chunk is not None:
                        on_chunk(chunk)
                    if max_seconds is not None and now - first >= max_seconds:
                        break
                    if pace_bps:
                        ahead = result.bytes_read / pace_bps - (now - first)
                        if ahead > 0:
                            await asyncio.sleep(ahead)
                if not result.eof:
                    # Stop the device from sending the rest of the file.
                    resp.close()
    except TimeoutError:
        result.error = f"timeout after {timeout:.0f}s"
    except ClientError as err:
        result.error = _clean(f"{type(err).__name__}: {err}", url)
    result.data = bytes(kept)
    if first is not None:
        elapsed = time.monotonic() - first
        result.read_ms = round(elapsed * 1000, 1)
        if elapsed > 0.05:
            result.mbit_s = round(result.bytes_read * 8 / elapsed / 1e6, 2)
    if result.error is None:
        if result.status not in (200, 206):
            result.error = f"HTTP {result.status}"
        elif not result.bytes_read:
            result.error = "empty body"
        else:
            result.ok = True
    return result

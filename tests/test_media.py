"""Tests for media measurements."""

import asyncio
from pathlib import Path
import shutil
import subprocess
from unittest.mock import MagicMock, patch

from aiohttp import ClientConnectionError
import pytest
from pytest_homeassistant_custom_component.test_util.aiohttp import AiohttpClientMocker

from custom_components.reolink_viewer import media
from custom_components.reolink_viewer.bridge import CameraUrl
from homeassistant.core import HomeAssistant

FFMPEG = shutil.which("ffmpeg")
needs_ffmpeg = pytest.mark.skipif(FFMPEG is None, reason="ffmpeg not installed")
URL = "https://1.2.3.4/flv?user=admin&password=s3cr3t"


def test_parse_video_line() -> None:
    """Codec and resolution are parsed from ffmpeg's stream line."""
    line = (
        "  Stream #0:0: Video: h264 (High), yuv420p(progressive), 2560x1440,"
        " 25 fps, 25 tbr, 1k tbn"
    )
    assert media.parse_video_line(line) == ("h264", 2560, 1440)
    hevc = "Stream #0:1[0x100]: Video: hevc (Main), yuvj420p(pc), 3840x2160"
    assert media.parse_video_line(hevc) == ("hevc", 3840, 2160)
    assert media.parse_video_line("Stream #0:0: Video: h264") == ("h264", None, None)
    assert media.parse_video_line("Stream #0:1: Audio: aac") is None


def test_sniff_container() -> None:
    """FLV and MP4 are recognized from their first bytes."""
    assert media.sniff_container(b"FLV\x01\x05") == "flv"
    assert media.sniff_container(b"\x00\x00\x00\x20ftypisom") == "mp4"
    assert media.sniff_container(b"<html>") is None


@pytest.fixture
def sample_video(tmp_path: Path) -> Path:
    """Generate a short test video with ffmpeg."""
    assert FFMPEG is not None
    path = tmp_path / "sample.mkv"
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
            "3",
            str(path),
        ],
        check=True,
        timeout=60,
    )
    return path


@needs_ffmpeg
async def test_first_frame_real_ffmpeg(sample_video: Path) -> None:
    """A real ffmpeg run decodes a frame and reports codec and size."""
    assert FFMPEG is not None
    result = await media.async_first_frame(
        FFMPEG, CameraUrl(str(sample_video)), timeout=30
    )
    assert result.ok, result.error
    assert result.codec is not None
    assert (result.width, result.height) == (320, 240)
    assert result.open_ms is not None
    assert result.ttff_ms is not None
    assert result.ttff_ms >= result.open_ms


@needs_ffmpeg
async def test_hold_stream_real_ffmpeg(sample_video: Path) -> None:
    """Holding a stream counts decoded frames."""
    assert FFMPEG is not None
    result = await media.async_hold_stream(
        FFMPEG, CameraUrl(str(sample_video)), seconds=1, timeout=30
    )
    assert result.ok, result.error
    assert result.frames is not None
    assert result.frames >= 5


@needs_ffmpeg
async def test_first_frame_failure_hides_url(tmp_path: Path) -> None:
    """A failing input is reported without its URL."""
    assert FFMPEG is not None
    missing = str(tmp_path / "secret-password-missing.flv")
    result = await media.async_first_frame(FFMPEG, CameraUrl(missing), timeout=30)
    assert not result.ok
    assert result.error
    assert "secret-password" not in result.error
    assert "<url>" in result.error


async def test_first_frame_cannot_start() -> None:
    """A missing ffmpeg binary is an error result, not an exception."""
    result = await media.async_first_frame(
        "/nonexistent/ffmpeg", CameraUrl(URL), timeout=1
    )
    assert not result.ok
    assert result.error is not None
    assert result.error.startswith("cannot start ffmpeg")


class _HangingProcess:
    """A process whose stderr never produces data."""

    def __init__(self) -> None:
        self.returncode: int | None = None
        self.stderr = MagicMock()
        self.stderr.read = self._read
        self.killed = False

    async def _read(self, _n: int) -> bytes:
        await asyncio.sleep(3600)
        return b""

    def kill(self) -> None:
        self.killed = True
        self.returncode = -9

    async def wait(self) -> int:
        return self.returncode or 0


async def test_first_frame_timeout_kills_process() -> None:
    """On timeout the ffmpeg process is killed."""
    proc = _HangingProcess()

    async def fake_exec(*args: str, **kwargs: object) -> _HangingProcess:
        assert "-rtsp_transport" in args
        return proc

    with patch(
        "custom_components.reolink_viewer.media.asyncio.create_subprocess_exec",
        fake_exec,
    ):
        result = await media.async_first_frame(
            "ffmpeg", CameraUrl("rtsp://u:p@1.2.3.4/x"), timeout=0.05
        )
    assert not result.ok
    assert result.error == "timeout after 0s"
    assert proc.killed


async def test_hold_stream_without_frames_fails() -> None:
    """A successful exit without decoded frames is a failure."""

    class _Done(_HangingProcess):
        def __init__(self) -> None:
            super().__init__()
            self._chunks = [b"Stream #0:0: Video: h264, 640x360\n", b""]

        async def _read(self, _n: int) -> bytes:
            return self._chunks.pop(0)

        async def wait(self) -> int:
            self.returncode = 0
            return 0

    async def fake_exec(*args: str, **kwargs: object) -> _Done:
        return _Done()

    with patch(
        "custom_components.reolink_viewer.media.asyncio.create_subprocess_exec",
        fake_exec,
    ):
        result = await media.async_hold_stream(
            "ffmpeg", CameraUrl(URL), seconds=1, timeout=5
        )
    assert not result.ok
    assert result.error == "no frames decoded"


async def test_first_bytes_ok(
    hass: HomeAssistant, aioclient_mock: AiohttpClientMocker
) -> None:
    """A video response yields TTFB and the sniffed container."""
    aioclient_mock.get(
        URL,
        content=b"FLV\x01\x05" + b"\x00" * 100,
        headers={"Content-Type": "video/x-flv"},
    )
    session = aioclient_mock.create_session(hass.loop)
    result = await media.async_first_bytes(session, CameraUrl(URL), timeout=5)
    await session.close()
    assert result.ok, result.error
    assert result.container == "flv"
    assert result.status == 200
    assert result.bytes_read == 105
    assert result.ttfb_ms is not None


@pytest.mark.parametrize(
    ("status", "content", "content_type", "error"),
    [
        (404, b"nope", "text/html", "HTTP 404"),
        (200, b"", "video/mp4", "empty body"),
        (200, b"<html>login</html>", "text/html", "unexpected content type text/html"),
    ],
)
async def test_first_bytes_bad_responses(
    hass: HomeAssistant,
    aioclient_mock: AiohttpClientMocker,
    status: int,
    content: bytes,
    content_type: str,
    error: str,
) -> None:
    """Non-video responses are failures with a reason."""
    aioclient_mock.get(
        URL, status=status, content=content, headers={"Content-Type": content_type}
    )
    session = aioclient_mock.create_session(hass.loop)
    result = await media.async_first_bytes(session, CameraUrl(URL), timeout=5)
    await session.close()
    assert not result.ok
    assert result.error == error


async def test_first_bytes_octet_stream_typo(
    hass: HomeAssistant, aioclient_mock: AiohttpClientMocker
) -> None:
    """Reolink's 'apolication/octet-stream' typo counts as video."""
    aioclient_mock.get(
        URL, content=b"\x00" * 16, headers={"Content-Type": "apolication/octet-stream"}
    )
    session = aioclient_mock.create_session(hass.loop)
    result = await media.async_first_bytes(session, CameraUrl(URL), timeout=5)
    await session.close()
    assert result.ok


async def test_first_bytes_client_error_hides_url(
    hass: HomeAssistant, aioclient_mock: AiohttpClientMocker
) -> None:
    """Connection errors are reported without the URL."""
    aioclient_mock.get(URL, exc=ClientConnectionError(f"cannot reach {URL}"))
    session = aioclient_mock.create_session(hass.loop)
    result = await media.async_first_bytes(session, CameraUrl(URL), timeout=5)
    await session.close()
    assert not result.ok
    assert result.error is not None
    assert "s3cr3t" not in result.error


async def test_first_bytes_timeout(
    hass: HomeAssistant, aioclient_mock: AiohttpClientMocker
) -> None:
    """A slow server times out."""

    async def slow(*_args: object) -> None:
        await asyncio.sleep(3600)

    aioclient_mock.get(URL, side_effect=slow)
    session = aioclient_mock.create_session(hass.loop)
    result = await media.async_first_bytes(session, CameraUrl(URL), timeout=0.05)
    await session.close()
    assert not result.ok
    assert result.error is not None
    assert result.error.startswith("timeout")

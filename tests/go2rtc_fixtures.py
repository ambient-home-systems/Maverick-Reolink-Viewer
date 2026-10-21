"""A real go2rtc for the live tests, and a fake camera to read from.

The binary comes from RV_GO2RTC (CI downloads the pinned release with
scripts/fetch_go2rtc.py), else from the PATH. Without one the tests that need
it are skipped, unless RV_GO2RTC_TESTS=1 (CI), where they fail instead.

The fake camera is a second go2rtc serving RTSP from ffmpeg's test sources:
``cam`` is H.264 640x360 at 15 fps with AAC audio and a key frame every
second, ``slow`` the same with a key frame every 4 s (as Reolink sub streams
send them), ``opus`` is audio only (Opus), which Playwright's Chromium can
receive over WebRTC.
"""

from collections.abc import Generator
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import time
from typing import NoReturn

import pytest

REQUIRED = os.environ.get("RV_GO2RTC_TESTS") == "1"
FPS = 15
_FFMPEG = (
    "exec:ffmpeg -hide_banner -loglevel error -re"
    " -f lavfi -i testsrc2=size=640x360:rate={fps}"
    " -f lavfi -i sine=frequency=440:sample_rate=16000"
    " -c:v libx264 -preset ultrafast -tune zerolatency -g {gop} -pix_fmt yuv420p"
    " -c:a aac -f rtsp {{output}}"
)
_OPUS = (
    "exec:ffmpeg -hide_banner -loglevel error -re"
    " -f lavfi -i sine=frequency=440:sample_rate=48000"
    " -c:a libopus -f rtsp {output}"
)


def missing(reason: str) -> NoReturn:
    """Skip, or fail where the live tests are required (CI)."""
    if REQUIRED:
        pytest.fail(reason)
    pytest.skip(reason)


def free_port() -> int:
    """Return a free TCP port on 127.0.0.1."""
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port: int = sock.getsockname()[1]
        return port


@pytest.fixture(scope="session")
def go2rtc_binary() -> str:
    """Return the path of a go2rtc binary, or skip."""
    path = os.environ.get("RV_GO2RTC") or shutil.which("go2rtc")
    if not path or not Path(path).exists():
        missing("no go2rtc binary (set RV_GO2RTC)")
    return path


@pytest.fixture
def fake_camera(
    go2rtc_binary: str, tmp_path: Path, socket_enabled: None
) -> Generator[str]:
    """Run the fake camera; yield its RTSP base URL (rtsp://127.0.0.1:port)."""
    if shutil.which("ffmpeg") is None:
        missing("ffmpeg is not installed")
    port = free_port()
    config = {
        "api": {"listen": ""},
        "rtsp": {"listen": f"127.0.0.1:{port}"},
        "webrtc": {"listen": ""},
        "streams": {
            "cam": _FFMPEG.format(fps=FPS, gop=FPS),
            "slow": _FFMPEG.format(fps=FPS, gop=4 * FPS),
            "opus": _OPUS,
        },
    }
    path = tmp_path / "camera.json"
    path.write_text(json.dumps(config))
    process = subprocess.Popen(
        [go2rtc_binary, "-config", str(path)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        cwd=tmp_path,
    )
    try:
        deadline = time.monotonic() + 10
        while True:
            try:
                socket.create_connection(("127.0.0.1", port), timeout=0.2).close()
                break
            except OSError:
                if time.monotonic() > deadline:
                    pytest.fail("the fake camera did not start")
                time.sleep(0.05)
        yield f"rtsp://127.0.0.1:{port}"
    finally:
        process.kill()
        process.wait()

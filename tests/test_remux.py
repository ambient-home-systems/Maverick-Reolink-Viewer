"""Tests for rewriting cached recordings as plain MP4."""

from pathlib import Path
import shutil

import pytest

from custom_components.reolink_viewer.remux import RemuxError, async_flatten, is_plain

from .mp4_fixtures import fragmented_av, mp4_file, real_fragmented

FFMPEG = shutil.which("ffmpeg")
needs_ffmpeg = pytest.mark.skipif(FFMPEG is None, reason="ffmpeg is not installed")


@needs_ffmpeg
async def test_flatten_writes_a_plain_mp4(tmp_path: Path) -> None:
    """A fragmented recording comes out with moov first and one mdat."""
    source = tmp_path / "rec.mp4"
    assert real_fragmented(source)
    assert not is_plain(source)  # moov first, but fragments follow
    target = tmp_path / "rec.flat.mp4"
    assert FFMPEG is not None
    await async_flatten(FFMPEG, source, target)
    assert is_plain(target)


@needs_ffmpeg
async def test_flatten_reports_ffmpeg_errors(tmp_path: Path) -> None:
    """Input ffmpeg cannot read fails with its message."""
    source = tmp_path / "bad.mp4"
    source.write_bytes(b"not an mp4 at all" * 100)
    assert FFMPEG is not None
    with pytest.raises(RemuxError, match=r"\S"):
        await async_flatten(FFMPEG, source, tmp_path / "out.mp4")


async def test_flatten_times_out(tmp_path: Path) -> None:
    """A stuck ffmpeg is stopped."""
    slow = tmp_path / "slow-ffmpeg"
    slow.write_text("#!/bin/sh\nexec sleep 30\n")
    slow.chmod(0o755)
    with pytest.raises(RemuxError, match="timed out"):
        await async_flatten(str(slow), tmp_path / "in.mp4", tmp_path / "out.mp4", 0.2)


async def test_flatten_reports_a_silent_failure(tmp_path: Path) -> None:
    """A failing ffmpeg without a message names its exit code."""
    failing = tmp_path / "failing-ffmpeg"
    failing.write_text("#!/bin/sh\nexit 3\n")
    failing.chmod(0o755)
    with pytest.raises(RemuxError, match="exited with 3"):
        await async_flatten(str(failing), tmp_path / "in.mp4", tmp_path / "out.mp4")


def test_is_plain(tmp_path: Path) -> None:
    """Only moov-then-mdat files count as plain."""
    path = tmp_path / "f.mp4"
    path.write_bytes(mp4_file(mdat_bytes=1000))
    assert is_plain(path)
    path.write_bytes(mp4_file(mdat_bytes=1000, moov_first=False))
    assert not is_plain(path)
    path.write_bytes(fragmented_av(2))
    assert not is_plain(path)
    path.write_bytes(b"\x00" * 10)
    assert not is_plain(path)

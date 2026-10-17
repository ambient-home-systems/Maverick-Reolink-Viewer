"""Tests for timeline thumbnails."""

import asyncio
from collections.abc import AsyncGenerator
from datetime import datetime
from pathlib import Path
from typing import Any
from unittest.mock import patch

import pytest

from custom_components.reolink_viewer import bridge, thumbnails
from custom_components.reolink_viewer.devices import PlaybackSource
from custom_components.reolink_viewer.scheduler import Priority, Scheduler
from custom_components.reolink_viewer.thumbnails import (
    ThumbnailError,
    ThumbnailService,
    bucket_of,
)
from custom_components.reolink_viewer.timeconv import epoch_ms
from homeassistant.core import HomeAssistant

SOURCE = PlaybackSource("cam1", "Garage", "entry1", 16)
JPEG = b"\xff\xd8" + b"x" * 1000


class FakeHost:
    """snapshot_past that records calls and can block or fail."""

    def __init__(self) -> None:
        self.calls: list[tuple[int, datetime, str, str]] = []
        self.gate: asyncio.Event | None = None
        self.result: bytes | Exception = JPEG

    async def async_snapshot_past(
        self, channel: int, when: datetime, stream: str, ffmpeg: str
    ) -> bytes:
        self.calls.append((channel, when, stream, ffmpeg))
        if self.gate is not None:
            await self.gate.wait()
        if isinstance(self.result, Exception):
            raise self.result
        return self.result


@pytest.fixture
async def service(
    hass: HomeAssistant, tmp_path: Path
) -> AsyncGenerator[tuple[ThumbnailService, FakeHost, Scheduler]]:
    host = FakeHost()
    scheduler = Scheduler(default_limit=2)
    with patch.object(bridge, "async_get_host", return_value=host):
        svc = ThumbnailService(hass, scheduler, tmp_path / "thumbs", 10_000, "ffmpeg")
        await svc.async_setup()
        yield svc, host, scheduler
    await scheduler.async_shutdown()


def test_bucket_of() -> None:
    """Times round down to the bucket; odd sizes snap to an allowed one."""
    assert bucket_of(12_345, 10) == 10_000
    assert bucket_of(65_000, 60) == 60_000
    assert bucket_of(65_000, 45) == 60_000  # 45 snaps to 60
    assert bucket_of(301_000, 1000) == 300_000


async def test_fetch_cache_and_dedupe(
    service: tuple[ThumbnailService, FakeHost, Scheduler],
) -> None:
    """One device request per bucket, even when asked twice at once."""
    svc, host, _ = service
    when = epoch_ms(datetime.fromisoformat("2026-10-17T16:00:03+00:00"))
    key = svc.key(SOURCE, when, 10, "sub")
    host.gate = asyncio.Event()
    first = asyncio.create_task(svc.async_get(key))
    second = asyncio.create_task(svc.async_get(svc.key(SOURCE, when + 5000, 10, "sub")))
    await asyncio.sleep(0.01)
    host.gate.set()
    assert await first == JPEG
    assert await second == JPEG
    assert len(host.calls) == 1
    channel, asked, stream, ffmpeg = host.calls[0]
    assert (channel, stream, ffmpeg) == (16, "sub", "ffmpeg")
    # The middle of the bucket (+1 s) is asked for.
    assert epoch_ms(asked) == key.bucket_ms + 1000
    # From the disk cache afterwards.
    assert await svc.async_get(key) == JPEG
    assert len(host.calls) == 1
    assert svc.stats() == {"files": 1, "bytes": len(JPEG)}


async def test_failures_are_remembered(
    service: tuple[ThumbnailService, FakeHost, Scheduler],
) -> None:
    """A failed time is not asked again for a minute; bad images are refused."""
    svc, host, _ = service
    host.result = RuntimeError("no recording")
    key = svc.key(SOURCE, 1_000_000, 10, "sub")
    with pytest.raises(ThumbnailError, match="snapshot failed: RuntimeError"):
        await svc.async_get(key)
    with pytest.raises(ThumbnailError, match="no recording at that time"):
        await svc.async_get(key)
    assert len(host.calls) == 1
    with patch.object(thumbnails, "_clock", return_value=1e12):
        host.result = b"not a jpeg"
        with pytest.raises(ThumbnailError, match="ThumbnailError"):
            await svc.async_get(key)
    assert len(host.calls) == 2


async def test_lru_eviction_and_restart(
    hass: HomeAssistant,
    tmp_path: Path,
    service: tuple[ThumbnailService, FakeHost, Scheduler],
) -> None:
    """Above the size cap the least recently used images go; a restart re-indexes."""
    svc, host, scheduler = service
    keys = [svc.key(SOURCE, i * 10_000, 10, "sub") for i in range(12)]
    for key in keys[:9]:
        await svc.async_get(key)
    await svc.async_get(keys[0])  # recently used again
    for key in keys[9:]:
        await svc.async_get(key)
    files = {p.name for p in (tmp_path / "thumbs").glob("*.jpg")}
    assert keys[0].file_name in files
    assert keys[1].file_name not in files
    assert svc.stats()["bytes"] <= 10_000

    restarted = ThumbnailService(hass, scheduler, tmp_path / "thumbs", 10_000, "ffmpeg")
    await restarted.async_setup()
    assert restarted.stats()["files"] == len(files)
    with patch.object(bridge, "async_get_host", return_value=host):
        calls = len(host.calls)
        assert await restarted.async_get(keys[0]) == JPEG
        assert len(host.calls) == calls
        # A file deleted behind the cache's back is fetched again.
        (tmp_path / "thumbs" / keys[0].file_name).unlink()
        assert await restarted.async_get(keys[0]) == JPEG
        assert len(host.calls) == calls + 1


async def test_priority_and_cancel(
    service: tuple[ThumbnailService, FakeHost, Scheduler],
) -> None:
    """Thumbnails run at thumbnail priority; a cancelled request is dropped."""
    svc, host, _ = service
    seen: list[Any] = []
    real_run = Scheduler.run

    async def spy(self: Scheduler, host_key: str, factory: Any, **kw: Any) -> Any:
        seen.append(kw["priority"])
        return await real_run(self, host_key, factory, **kw)

    with patch.object(Scheduler, "run", spy):
        await svc.async_get(svc.key(SOURCE, 5_000_000, 10, "sub"))
    assert seen == [Priority.THUMBNAILS]

    host.gate = asyncio.Event()
    task = asyncio.create_task(svc.async_get(svc.key(SOURCE, 7_000_000, 10, "sub")))
    await asyncio.sleep(0.01)
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task

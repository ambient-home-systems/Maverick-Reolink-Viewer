"""Tests for the cameras' last pictures (live/images.py)."""

import asyncio
from collections.abc import AsyncGenerator
from pathlib import Path
import time
from unittest.mock import patch

import pytest

from custom_components.reolink_viewer import bridge, devices
from custom_components.reolink_viewer.devices import LiveSource
from custom_components.reolink_viewer.live import images
from custom_components.reolink_viewer.live.images import CameraImage, LiveImages
from custom_components.reolink_viewer.live.streams import LiveStream
from custom_components.reolink_viewer.scheduler import Scheduler
from homeassistant.core import HomeAssistant

GARAGE = LiveSource("cam1", "dev1", "Garage", "entry1", 1, "nvr")
HALL = LiveSource("cam2", "dev2", "Hallway", "entry1", 2, "nvr")
DOORBELL = LiveSource("cam3", "dev3", "Doorbell", "entry2", 0, "direct", True)
JPEG = b"\xff\xd8" + b"x" * 100


class FakeHost:
    """async_snapshot that records calls and can block, fail or return nothing."""

    def __init__(self) -> None:
        self.calls: list[int] = []
        self.gate: asyncio.Event | None = None
        self.result: bytes | Exception | None = JPEG

    async def async_snapshot(self, channel: int, stream: str) -> bytes | None:
        assert stream == "sub"
        self.calls.append(channel)
        if self.gate is not None:
            await self.gate.wait()
        if isinstance(self.result, Exception):
            raise self.result
        return self.result


class Setup:
    """The service under test, its camera list, host and what it passed on."""

    def __init__(self, hass: HomeAssistant, directory: Path) -> None:
        self.hass = hass
        self.dir = directory
        self.host = FakeHost()
        self.sources = {s.camera_id: s for s in (GARAGE, HALL, DOORBELL)}
        self.scheduler = Scheduler(default_limit=2)
        self.service = LiveImages(hass, self.scheduler, directory)
        self.seen: list[str] = []

    def listener(self, camera_id: str, image: CameraImage) -> None:
        assert image.data == JPEG
        self.seen.append(camera_id)

    async def settle(self) -> None:
        # Background tasks (the takes, their disk writes) are not waited for
        # by async_block_till_done; the refresh loop never ends while watched.
        for _ in range(3):
            await self.hass.async_block_till_done()
            await asyncio.sleep(0.01)


@pytest.fixture
async def setup(hass: HomeAssistant, tmp_path: Path) -> AsyncGenerator[Setup]:
    s = Setup(hass, tmp_path / "images")
    with (
        patch.object(bridge, "async_get_host", return_value=s.host),
        patch.object(devices, "async_image_sources", side_effect=lambda _h: s.sources),
    ):
        await s.service.async_setup()
        yield s
        await s.service.async_shutdown()
    await s.scheduler.async_shutdown()


async def test_watching_takes_and_keeps_pictures(setup: Setup) -> None:
    """A watch takes every camera's picture; it is kept in memory and on disk."""
    service = setup.service
    assert service.get("cam1") is None
    watch = service.watch(setup.listener)
    await setup.settle()
    assert sorted(setup.seen) == ["cam1", "cam2", "cam3"]
    assert sorted(setup.host.calls) == [0, 1, 2]
    image = service.get("cam1")
    assert image is not None
    assert image.data == JPEG
    assert time.time() - image.taken < 5
    assert set(service.images()) == {"cam1", "cam2", "cam3"}
    assert service.get("nope") is None
    files = sorted(p.name for p in setup.dir.glob("*.jpg"))
    assert files == sorted(f"{s.key}.jpg" for s in setup.sources.values())
    assert not any(s.camera_id in "".join(files) for s in setup.sources.values())
    assert service.stats() == {"images": 3, "taking": 0, "watches": 1}
    watch.close()
    watch.close()  # once only
    assert service.stats()["watches"] == 0

    # A restart finds them on disk, taken when they were.
    again = LiveImages(setup.hass, setup.scheduler, setup.dir)
    await again.async_setup()
    kept = again.get("cam1")
    assert kept is not None
    assert kept.data == JPEG
    assert abs(kept.taken - image.taken) < 2


async def test_refreshes_while_watched_only(setup: Setup) -> None:
    """Mains cameras are taken again every REFRESH_S while watched, then left."""
    with patch.object(images, "REFRESH_S", 0.05):
        watch = setup.service.watch(setup.listener)
        await setup.settle()
        first = len(setup.host.calls)
        await asyncio.sleep(0.2)
        await setup.settle()
        # The two mains cameras again; the battery camera never in the background.
        assert len(setup.host.calls) > first
        assert setup.host.calls.count(0) == 1
        watch.close()
        await setup.settle()
        stopped = len(setup.host.calls)
        await asyncio.sleep(0.15)
        assert len(setup.host.calls) == stopped


async def test_fresh_pictures_are_not_taken_again(setup: Setup) -> None:
    """A second page soon after the first takes nothing: the pictures are fresh."""
    first = setup.service.watch(setup.listener)
    await setup.settle()
    first.close()
    calls = len(setup.host.calls)
    second = setup.service.watch(setup.listener)
    await setup.settle()
    assert len(setup.host.calls) == calls
    second.close()


async def test_battery_camera_sleeps(setup: Setup) -> None:
    """A battery camera: taken once if there is none, then when a stream wakes it."""
    setup.sources = {"cam3": DOORBELL}
    setup.host.result = None  # asleep or private: no picture
    watch = setup.service.watch(setup.listener)
    await setup.settle()
    assert setup.host.calls == [0]
    assert setup.seen == []
    with patch.object(images, "RETRY_S", 0.0), patch.object(images, "REFRESH_S", 0.05):
        setup.service._wake.set()
        await asyncio.sleep(0.15)
        await setup.settle()
    assert setup.host.calls == [0]  # a failure waits for one of its streams
    setup.host.result = JPEG
    setup.service.stream_started(LiveStream(DOORBELL, "main"))
    await setup.settle()
    assert setup.host.calls == [0, 0]
    assert setup.seen == ["cam3"]
    with patch.object(images, "REFRESH_S", 0.0):
        setup.service._wake.set()
        await setup.settle()
    assert setup.host.calls == [0, 0]  # it has one now: never in the background
    # A mains camera's stream starting takes nothing.
    setup.service.stream_started(LiveStream(GARAGE, "sub"))
    await setup.settle()
    assert setup.host.calls == [0, 0]
    watch.close()


async def test_a_failure_is_retried_later(setup: Setup) -> None:
    """A camera that fails is left alone for RETRY_S."""
    setup.sources = {"cam1": GARAGE}
    setup.host.result = bridge.BridgeError("offline")
    with patch.object(images, "REFRESH_S", 0.01), patch.object(images, "RETRY_S", 0.3):
        watch = setup.service.watch(setup.listener)
        await setup.settle()
        await asyncio.sleep(0.1)
        await setup.settle()
        assert setup.host.calls == [1]
        setup.host.result = JPEG
        await asyncio.sleep(0.35)
        await setup.settle()
    assert setup.host.calls[:2] == [1, 1]
    assert setup.seen[:1] == ["cam1"]
    watch.close()


async def test_not_a_jpeg_is_a_failure(setup: Setup) -> None:
    """Whatever comes back must be a JPEG."""
    setup.sources = {"cam1": GARAGE}
    setup.host.result = b"<html>"
    watch = setup.service.watch(setup.listener)
    await setup.settle()
    assert setup.seen == []
    assert setup.service.get("cam1") is None
    watch.close()


async def test_shutdown_stops_what_is_being_taken(setup: Setup) -> None:
    """Shutting down cancels the refreshes and the pictures in flight."""
    setup.host.gate = asyncio.Event()
    setup.service.watch(setup.listener)
    await setup.settle()
    assert setup.service.stats()["taking"] == 3
    await setup.service.async_shutdown()
    assert setup.service.stats() == {"images": 0, "taking": 0, "watches": 0}
    assert setup.seen == []

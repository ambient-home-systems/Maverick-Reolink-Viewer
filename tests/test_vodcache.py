"""Tests for the recording disk cache."""

import asyncio
from collections.abc import AsyncGenerator
import contextlib
from datetime import timedelta
from pathlib import Path
import shutil
import threading
import time
from typing import Any, NamedTuple
from unittest.mock import patch

from aiohttp import ClientSession, web
from aiohttp.test_utils import TestServer
import pytest
from pytest_homeassistant_custom_component.common import async_fire_time_changed

from custom_components.reolink_viewer import bridge, vodcache
from custom_components.reolink_viewer.bridge import CameraUrl, VodFile, VodMethod
from custom_components.reolink_viewer.devices import PlaybackSource
from custom_components.reolink_viewer.mp4index import OffsetShifter, OffsetShiftError
from custom_components.reolink_viewer.remux import is_plain
from custom_components.reolink_viewer.scheduler import Priority, Scheduler
from custom_components.reolink_viewer.vodcache import Recording, VodCache, VodCacheError
from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util

from .mp4_fixtures import FTYP, av_moov, fragmented_av, mp4_file, real_fragmented
from .test_fmp4 import MIME, _boxes, _check_mse_ready
from .test_mp4index import _tfhd_bases

SOURCE = PlaybackSource("cam1", "Garage", "entry1", 16)
BODY = mp4_file(moov_first=True, mdat_bytes=600_000)
FRAG = fragmented_av(20)
FRAG_ABSOLUTE = fragmented_av(20, absolute=True)
# Bodies added by a test (name -> bytes).
EXTRA: dict[str, bytes] = {}
FFMPEG = shutil.which("ffmpeg")
# Seconds after which a 30-minute lease has ended.
EXPIRED = 1800 + vodcache.LEASE_MARGIN_S + 1


def rec(name: str = "0-16-1-20261017120000-00000", stream: str = "sub") -> Recording:
    return Recording(SOURCE, stream, name, 1_000, 61_000, size=len(BODY))


class Server(NamedTuple):
    server: TestServer
    hits: list[str]
    gate: asyncio.Event


@pytest.fixture
async def media(socket_enabled: None) -> AsyncGenerator[Server]:
    """Serve recordings; /slow* pause after the first 100 KB until the gate opens.

    /cut* pause there too, then drop the connection.
    """
    hits: list[str] = []
    gate = asyncio.Event()

    async def handler(request: web.Request) -> web.StreamResponse:
        name = request.match_info["name"]
        hits.append(name)
        if name == "missing":
            return web.Response(status=404)
        if name == "empty":
            return web.Response(body=b"", content_type="video/mp4")
        body = EXTRA.get(name) or {"frag": FRAG, "fragabs": FRAG_ABSOLUTE}.get(
            name, BODY
        )
        resp = web.StreamResponse(headers={"Content-Type": "video/mp4"})
        resp.enable_chunked_encoding()
        await resp.prepare(request)
        if name.startswith("frag"):
            # The header in small pieces: the fill waits for the first moof.
            for start in range(0, 3000, 300):
                await resp.write(body[start : start + 300])
                await asyncio.sleep(0.01)
            body = body[3000:]
        await resp.write(body[:100_000])
        if name.startswith(("slow", "cut")):
            await gate.wait()
        if name.startswith("cut"):
            # The connection drops mid-recording: the fill fails.
            assert request.transport is not None
            request.transport.abort()
            return resp
        await resp.write(body[100_000:])
        await resp.write_eof()
        return resp

    app = web.Application()
    app.router.add_get("/{name}", handler)
    server = TestServer(app, host="127.0.0.1")
    await server.start_server()
    yield Server(server, hits, gate)
    gate.set()
    await server.close()


class FakeHost:
    """Returns the test server's URL for a recording's name."""

    def __init__(self, server: TestServer) -> None:
        self.server = server
        self.calls: list[tuple[int, VodFile, VodMethod]] = []

    async def async_vod_url(
        self, channel: int, file: VodFile, method: VodMethod
    ) -> tuple[str, CameraUrl]:
        self.calls.append((channel, file, method))
        return "video/mp4", CameraUrl(str(self.server.make_url(f"/{file.name}")))


@pytest.fixture
async def cache(
    hass: HomeAssistant, tmp_path: Path, media: Server
) -> AsyncGenerator[tuple[VodCache, Scheduler, FakeHost]]:
    host = FakeHost(media.server)
    scheduler = Scheduler(default_limit=2, default_stream_limit=1)
    async with ClientSession() as session:
        with patch.object(bridge, "async_get_host", return_value=host):
            cache = VodCache(hass, scheduler, tmp_path / "vod", 10**9, lambda: session)
            await cache.async_setup()
            yield cache, scheduler, host
            await cache.async_shutdown()
    await scheduler.async_shutdown()


async def _read(
    cache: VodCache, entry: Any, start: int = 0, stop: int | None = None
) -> bytes:
    return b"".join([c async for c in cache.async_iter(entry, start, stop)])


async def test_fill_and_read(
    cache: tuple[VodCache, Scheduler, FakeHost], media: Server
) -> None:
    """A recording is downloaded once and read back whole or in ranges."""
    vc, _sched, host = cache
    entry = await vc.async_open(rec())
    await vc.async_wait(entry, complete=True)
    assert entry.complete
    assert entry.written == len(BODY)
    assert entry.path.read_bytes() == BODY
    assert not entry.part_path.exists()
    assert entry.timing["cache"] == "fill"
    assert entry.timing["ttfb_ms"] >= 0
    assert "mbit_s" in entry.timing
    (channel, file, method) = host.calls[0]
    assert (channel, file.name, file.stream, method) == (
        16,
        rec().name,
        "sub",
        VodMethod.DOWNLOAD,
    )
    assert await _read(vc, entry) == BODY
    assert await _read(vc, entry, 10, 20) == BODY[10:20]
    assert await _read(vc, entry, len(BODY)) == b""
    # Opening again reuses the file: no second download.
    again = await vc.async_open(rec())
    assert again is entry
    assert media.hits == [rec().name]
    # The first fill of the stream recorded its codec and size.
    info = vc.media_info(SOURCE, "sub")
    assert info is not None
    assert (info["codec"], info["width"], info["height"]) == (
        "hvc1.1.6.L153.B0",
        3840,
        2160,
    )
    assert info["audio"] == "mp4a.40.2"
    assert vc.media_info(SOURCE, "main") is None
    assert vc.stats()["entries"] == 1
    assert entry.public()["complete"] is True
    # A plain MP4 is stored as it came; there is nothing to index.
    assert entry.timing["indexed"] == "no: mdat after moov"
    assert info["indexed"] == "no: mdat after moov"


async def test_fragmented_recordings_get_an_index(
    cache: tuple[VodCache, Scheduler, FakeHost], media: Server
) -> None:
    """Room for a sidx is left after moov and filled in once complete."""
    vc, _sched, _host = cache
    entry = await vc.async_open(rec("frag"))
    await vc.async_wait(entry, complete=True)
    assert entry.timing["indexed"] == "yes"
    stored = entry.path.read_bytes()
    head = len(FTYP + av_moov())
    assert stored[:head] == FRAG[:head]
    room = len(stored) - len(FRAG)
    assert stored[head + room :] == FRAG[head:]
    assert stored[head + 4 : head + 8] == b"sidx"
    assert entry.written == len(stored)
    assert await _read(vc, entry) == stored
    info = vc.media_info(SOURCE, "sub")
    assert info is not None
    assert info["indexed"] == "yes"
    assert info["codec"] == "avc1.640033"


async def test_readers_follow_a_fill(
    cache: tuple[VodCache, Scheduler, FakeHost], media: Server
) -> None:
    """Readers get the first bytes at once and the rest as they arrive."""
    vc, _sched, _host = cache
    entry = await vc.async_open(rec("slow"))
    other = await vc.async_open(rec("slow"), Priority.PREFETCH)
    assert other is entry
    await vc.async_wait(entry, offset=0)
    assert not entry.complete
    reader = asyncio.create_task(_read(vc, entry))
    head = await _read(vc, entry, 0, 1000)
    assert head == BODY[:1000]
    await asyncio.sleep(0.05)
    assert not reader.done()
    media.gate.set()
    assert await reader == BODY
    assert media.hits == ["slow"]


async def test_priority_and_stream_budget(
    cache: tuple[VodCache, Scheduler, FakeHost], media: Server
) -> None:
    """Fills hold stream slots; a queued prefetch fill is sped up when asked for."""
    vc, sched, _host = cache
    budget = sched.host("entry1").streams
    slow = await vc.async_open(rec("slow"))
    await vc.async_wait(slow, offset=0)
    assert budget.stats()["streams"] == 1
    queued = await vc.async_open(rec("a"), Priority.PREFETCH)
    await asyncio.sleep(0.01)
    ticket = queued.ticket
    assert ticket is not None
    priorities = [ticket.priority]
    await vc.async_open(rec("a"), Priority.PLAYBACK)
    priorities.append(ticket.priority)
    assert priorities == [Priority.PREFETCH, Priority.PLAYBACK]
    assert queued.priority == Priority.PLAYBACK
    media.gate.set()
    await vc.async_wait(queued, complete=True)
    assert queued.timing["priority"] == "prefetch"
    assert queued.timing["wait_ms"] >= 0
    assert budget.stats()["streams"] == 0


async def test_failures_and_retry(cache: tuple[VodCache, Scheduler, FakeHost]) -> None:
    """HTTP errors and empty bodies fail the entry; asking again retries."""
    vc, _sched, _host = cache
    entry = await vc.async_open(rec("missing"))
    with pytest.raises(VodCacheError, match="HTTP 404"):
        await vc.async_wait(entry, complete=True)
    assert entry.error == "HTTP 404"
    retry = await vc.async_open(rec("missing"))
    assert retry is not entry
    empty = await vc.async_open(rec("empty"))
    with pytest.raises(VodCacheError, match="empty recording"):
        await vc.async_wait(empty, complete=True)
    with pytest.raises(VodCacheError):
        await _read(vc, empty)


async def test_disk_space_guard(cache: tuple[VodCache, Scheduler, FakeHost]) -> None:
    """No fill starts without enough free disk space."""
    vc, _sched, _host = cache

    class Usage(NamedTuple):
        total: int
        used: int
        free: int

    with patch.object(shutil, "disk_usage", return_value=Usage(10, 10, 100)):
        entry = await vc.async_open(rec("b"))
        with pytest.raises(VodCacheError, match="free disk space"):
            await vc.async_wait(entry, complete=True)


async def test_eviction_and_restart(
    hass: HomeAssistant, tmp_path: Path, cache: tuple[VodCache, Scheduler, FakeHost]
) -> None:
    """Least recently used files go above the cap; a restart finds what is left."""
    vc, sched, host = cache
    vc._max_bytes = int(len(BODY) * 2.5)
    first = await vc.async_open(rec("one"))
    await vc.async_wait(first, complete=True)
    second = await vc.async_open(rec("two"))
    await vc.async_wait(second, complete=True)
    first.last_access = 0  # least recently used
    third = await vc.async_open(rec("three"))
    assert third.task is not None
    await third.task
    assert not first.path.exists()
    assert second.path.exists()
    assert third.path.exists()

    # A new cache (HA restart) drops partial files and reuses complete ones.
    (tmp_path / "vod" / "stale.mp4.part").write_bytes(b"x")
    async with ClientSession() as session:
        restarted = VodCache(hass, sched, tmp_path / "vod", 10**9, lambda: session)
        await restarted.async_setup()
        assert not (tmp_path / "vod" / "stale.mp4.part").exists()
        found = await restarted.async_open(rec("two"))
        assert found.complete
        assert found.timing == {"cache": "disk", "indexed": "no"}
        assert not await restarted.async_plain(found)
        assert found.timing["flat"] == "no: ffmpeg not found"
        assert len(host.calls) == 3


async def test_unknown_files_evicted_first(
    tmp_path: Path, cache: tuple[VodCache, Scheduler, FakeHost]
) -> None:
    """Files from earlier runs that nobody asked for go before recent ones."""
    vc, _sched, _host = cache
    old = tmp_path / "vod" / "f00dfeed.mp4"
    old.write_bytes(b"x" * len(BODY))
    vc._max_bytes = int(len(BODY) * 1.5)
    entry = await vc.async_open(rec("four"))
    assert entry.task is not None
    await entry.task
    assert not old.exists()
    assert entry.path.exists()


async def test_shutdown_cancels_fills(
    cache: tuple[VodCache, Scheduler, FakeHost], media: Server
) -> None:
    """Shutting down cancels fills and removes their partial files."""
    vc, _sched, _host = cache
    entry = await vc.async_open(rec("slow"))
    await vc.async_wait(entry, offset=0)
    await vc.async_shutdown()
    assert entry.error == "cancelled"
    assert not entry.part_path.exists()
    with pytest.raises(VodCacheError, match="closed"):
        await vc.async_open(rec("c"))


def test_cache_id_reveals_nothing() -> None:
    """Cache file names are hashes of camera, stream and recording."""
    a, b = rec("x"), rec("x", stream="main")
    assert a.cache_id != b.cache_id
    assert "x" not in a.cache_id
    assert len(a.cache_id) == 32


async def test_index_failure_keeps_the_recording(
    cache: tuple[VodCache, Scheduler, FakeHost],
    media: Server,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """If the index cannot be built, the file is still cached and playable."""
    vc, _sched, _host = cache

    def broken(path: str, at: int, size: int) -> bytes:
        raise OSError("disk hiccup")

    monkeypatch.setattr(vodcache, "build_index", broken)
    entry = await vc.async_open(rec("frag"))
    await vc.async_wait(entry, complete=True)
    assert entry.complete
    assert entry.timing["indexed"] == "no: index not built"
    stored = entry.path.read_bytes()
    head = len(FTYP + av_moov())
    assert stored[head + 4 : head + 8] == b"free"


async def test_absolute_offsets_are_shifted_for_the_index(
    cache: tuple[VodCache, Scheduler, FakeHost], media: Server
) -> None:
    """The NVR's absolute offsets move with the room left for the index."""
    vc, _sched, _host = cache
    entry = await vc.async_open(rec("fragabs"))
    await vc.async_wait(entry, complete=True)
    assert entry.timing["indexed"] == "yes"
    stored = entry.path.read_bytes()
    bases = _tfhd_bases(stored)
    assert len(bases) == 40
    assert all(moof == base for moof, base in bases)


async def test_unshiftable_stream_is_cached_without_index(
    cache: tuple[VodCache, Scheduler, FakeHost],
    media: Server,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A stream the shifter cannot follow fails once, then is kept as it is."""
    vc, _sched, _host = cache

    def broken(self: OffsetShifter, data: bytes) -> bytes:
        raise OffsetShiftError("odd box")

    with monkeypatch.context() as patch:
        patch.setattr(OffsetShifter, "feed", broken)
        entry = await vc.async_open(rec("fragabs"))
        with pytest.raises(VodCacheError, match="cannot shift offsets"):
            await vc.async_wait(entry, complete=True)
    again = await vc.async_open(rec("fragabs"))
    await vc.async_wait(again, complete=True)
    assert again.timing["indexed"] == "no: offsets could not be shifted before"
    assert again.path.read_bytes() == FRAG_ABSOLUTE


@pytest.fixture
async def flat_cache(
    hass: HomeAssistant, tmp_path: Path, media: Server
) -> AsyncGenerator[VodCache]:
    """A cache that rewrites recordings as plain MP4 with the real ffmpeg."""
    host = FakeHost(media.server)
    scheduler = Scheduler(default_limit=2, default_stream_limit=1)
    async with ClientSession() as session:
        with patch.object(bridge, "async_get_host", return_value=host):
            cache = VodCache(
                hass,
                scheduler,
                tmp_path / "vod",
                10**9,
                lambda: session,
                ffmpeg_binary=FFMPEG,
            )
            await cache.async_setup()
            yield cache
            await cache.async_shutdown()
    await scheduler.async_shutdown()


@pytest.mark.skipif(FFMPEG is None, reason="ffmpeg is not installed")
async def test_plain_copy_on_demand(
    hass: HomeAssistant, flat_cache: VodCache, tmp_path: Path
) -> None:
    """The plain MP4 is written when first asked for; the original stays."""
    source = tmp_path / "real.mp4"
    assert real_fragmented(source)
    EXTRA["real"] = source.read_bytes()
    try:
        entry = await flat_cache.async_open(rec("real"))
        # Not before the recording is complete.
        assert not await flat_cache.async_plain(entry)
        await flat_cache.async_wait(entry, complete=True)
        assert entry.task is not None
        await entry.task
        assert entry.flat_at is None
        assert not entry.flat_path.exists()
        assert await flat_cache.async_plain(entry)
        task = entry.flat_task
        assert await flat_cache.async_plain(entry)
        assert entry.flat_task is task  # written once
        assert entry.timing["flat"] == "yes"
        assert is_plain(entry.flat_path)
        assert flat_cache.served_path(entry, True) == entry.flat_path
        assert flat_cache.served_path(entry, False) == entry.path
        # The original is kept for the MSE player, long after any URL.
        with patch.object(vodcache, "_clock", return_value=time.monotonic() + EXPIRED):
            async_fire_time_changed(hass, dt_util.utcnow() + timedelta(hours=2))
            await hass.async_block_till_done(wait_background_tasks=True)
        assert entry.path.exists()
        assert entry.flat_path.exists()
    finally:
        EXTRA.pop("real", None)


async def test_files_found_at_startup(
    hass: HomeAssistant, tmp_path: Path, media: Server
) -> None:
    """Originals and their plain copies are kept; leftovers are removed."""
    directory = tmp_path / "vod"
    directory.mkdir()
    cache_id = rec().cache_id
    (directory / f"{cache_id}.mp4").write_bytes(BODY)
    (directory / f"{cache_id}.flat.mp4").write_bytes(b"plain")
    (directory / f"{cache_id}.flat.mp4.part").write_bytes(b"half")
    (directory / "0123abcd.flat.mp4").write_bytes(b"no original")
    scheduler = Scheduler(default_limit=2)
    cache = VodCache(hass, scheduler, directory, 10**9, lambda: None)  # type: ignore[arg-type,return-value]
    await cache.async_setup()
    assert sorted(p.name for p in directory.iterdir()) == [
        f"{cache_id}.flat.mp4",
        f"{cache_id}.mp4",
    ]
    entry = await cache.async_open(rec())
    assert entry.complete
    assert entry.timing == {"cache": "disk", "indexed": "no", "flat": "yes"}
    assert await cache.async_plain(entry)
    assert cache.served_path(entry, True) == entry.flat_path
    assert cache.served_path(entry, False) == entry.path
    await cache.async_shutdown()
    await scheduler.async_shutdown()


async def test_failed_rewrite_keeps_the_original(
    hass: HomeAssistant, tmp_path: Path, media: Server
) -> None:
    """Without a working ffmpeg the original is served, and not retried."""
    host = FakeHost(media.server)
    scheduler = Scheduler(default_limit=2, default_stream_limit=1)
    async with ClientSession() as session:
        with patch.object(bridge, "async_get_host", return_value=host):
            cache = VodCache(
                hass,
                scheduler,
                tmp_path / "vod",
                10**9,
                lambda: session,
                ffmpeg_binary=str(tmp_path / "no-such-ffmpeg"),
            )
            await cache.async_setup()
            entry = await cache.async_open(rec("frag"))
            await cache.async_wait(entry, complete=True)
            assert not await cache.async_plain(entry)
            task = entry.flat_task
            assert not await cache.async_plain(entry)
            assert entry.flat_task is task
            assert entry.timing["flat"].startswith("no: ")
            assert entry.flat_at is None
            assert cache.served_path(entry, True) == entry.path
            await cache.async_shutdown()
    await scheduler.async_shutdown()


# ---- Disk accounting, eviction and leases (Phase 2B step 0) ----


class Usage(NamedTuple):
    total: int
    used: int
    free: int


def fake_disk(directory: Path, capacity: int) -> Any:
    """A disk of ``capacity`` bytes holding only the cache directory's files."""

    def usage(_path: Any) -> Usage:
        used = 0
        for path in directory.iterdir():
            with contextlib.suppress(FileNotFoundError):  # a part file just removed
                used += path.stat().st_size
        return Usage(capacity, used, capacity - used)

    return patch.object(shutil, "disk_usage", usage)


async def fake_flatten(binary: str, source: Path, target: Path) -> None:
    """Write a 'plain copy' that differs from the original (to spot swaps)."""

    def copy() -> None:
        target.write_bytes(b"PLAIN" + source.read_bytes())

    await asyncio.to_thread(copy)


@pytest.fixture
def no_ffmpeg(monkeypatch: pytest.MonkeyPatch) -> None:
    """Rewrites copy the file instead of running ffmpeg."""
    monkeypatch.setattr(vodcache, "async_flatten", fake_flatten)
    monkeypatch.setattr(vodcache, "is_plain", lambda path: True)


@pytest.fixture
async def make_cache(
    hass: HomeAssistant, tmp_path: Path, media: Server
) -> AsyncGenerator[Any]:
    """Build caches with a given stream limit, cap and (fake) ffmpeg."""
    made: list[tuple[VodCache, Scheduler]] = []
    host = FakeHost(media.server)
    async with ClientSession() as session:
        with patch.object(bridge, "async_get_host", return_value=host):

            async def make(
                streams: int = 1, cap: int = 10**9, ffmpeg: str | None = None
            ) -> VodCache:
                scheduler = Scheduler(default_limit=2, default_stream_limit=streams)
                cache = VodCache(
                    hass,
                    scheduler,
                    tmp_path / "vod",
                    cap,
                    lambda: session,
                    ffmpeg_binary=ffmpeg,
                )
                await cache.async_setup()
                made.append((cache, scheduler))
                return cache

            yield make
            for cache, scheduler in made:
                await cache.async_shutdown()
                await scheduler.async_shutdown()


async def _complete(vc: VodCache, name: str, *, plain: bool = False) -> Any:
    entry = await vc.async_open(rec(name))
    await vc.async_wait(entry, complete=True)
    if entry.task is not None:
        await entry.task
    if plain:
        await vc.async_plain(entry)
    return entry


async def test_cap_counts_fills_in_progress(make_cache: Any, media: Server) -> None:
    """A fill still downloading counts whole (its .part file and the rest)."""
    vc = await make_cache(streams=2, cap=int(len(BODY) * 2.5))
    one = await _complete(vc, "one")
    slow = await vc.async_open(rec("slow"))
    await vc.async_wait(slow, offset=0)
    assert slow.part_path.exists()
    two = await _complete(vc, "two")
    # one + slow (all of it) + two is over the cap: one went before two came.
    assert not slow.complete
    assert not one.path.exists()
    assert two.path.exists()
    media.gate.set()
    await vc.async_wait(slow, complete=True)
    assert vc.stats()["disk_bytes"] <= vc._max_bytes


async def test_space_is_checked_after_the_stream_wait(
    make_cache: Any, media: Server, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A fill that queued for a stream slot checks the disk when it starts."""
    monkeypatch.setattr(vodcache, "MIN_FREE_BYTES", 1_000_000)
    vc = await make_cache(streams=1)
    with fake_disk(tmp_path / "vod", 1_000_000 + int(len(BODY) * 1.5)):
        slow = await vc.async_open(rec("slow"))
        await vc.async_wait(slow, offset=0)
        two = await vc.async_open(rec("two"))
        await asyncio.sleep(0.05)
        assert two.ticket is not None
        assert not two.ticket.granted
        media.gate.set()
        await vc.async_wait(two, complete=True)
        # The disk kept its 1 MB: slow (done, not in use) made room for two.
        assert shutil.disk_usage(tmp_path).free >= 1_000_000
        assert not slow.path.exists()
        assert two.path.exists()


async def test_low_free_space_evicts_enough(
    make_cache: Any, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Short of free space, as much is evicted as the new fill needs."""
    monkeypatch.setattr(vodcache, "MIN_FREE_BYTES", 500_000)
    vc = await make_cache()
    one = await _complete(vc, "one")
    with fake_disk(tmp_path / "vod", len(BODY) + 550_000):
        two = await _complete(vc, "two")
        assert two.error is None
        assert not one.path.exists()
        assert shutil.disk_usage(tmp_path).free >= 500_000


async def test_no_room_fails_the_fill(
    make_cache: Any, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Without enough to evict, a fill fails and reserves nothing."""
    monkeypatch.setattr(vodcache, "MIN_FREE_BYTES", 500_000)
    vc = await make_cache()
    one = await _complete(vc, "one")
    vc.lease(one, 1800, "tok")
    with fake_disk(tmp_path / "vod", len(BODY) + 550_000):
        two = await vc.async_open(rec("two"))
        with pytest.raises(VodCacheError, match="free disk space"):
            await vc.async_wait(two, complete=True)
    assert one.path.exists()
    assert vc._reserved == {}


async def test_a_fill_that_outgrows_its_size(
    make_cache: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A recording larger than the search said reserves more as it grows."""
    monkeypatch.setattr(vodcache, "GROW_STEP", 1000)
    vc = await make_cache(cap=len(BODY) + 300_000)
    small = Recording(SOURCE, "sub", "big", 1_000, 61_000, size=100_000)
    entry = await vc.async_open(small)
    await vc.async_wait(entry, complete=True)
    assert entry.written == len(BODY)
    # Too large for the cap once it grows past it: the fill fails.
    vc._max_bytes = 300_000
    big = Recording(SOURCE, "sub", "bigger", 1_000, 61_000, size=100_000)
    entry = await vc.async_open(big)
    with pytest.raises(VodCacheError, match="free disk space"):
        await vc.async_wait(entry, complete=True)
    assert entry.task is not None
    await entry.task
    assert not entry.part_path.exists()


def test_expected_size() -> None:
    """The search's size plus a margin; else the length at a stream's bitrate."""
    hour = Recording(SOURCE, "main", "x", 0, 3_600_000, size=2_400_000_000)
    assert 2_424_000_000 < vodcache.expected_size(hour) < 2_425_000_000
    unknown = Recording(SOURCE, "sub", "x", 0, 3_600_000)
    assert vodcache.expected_size(unknown) > 450_000_000


async def test_rewrite_needs_room_for_its_copy(
    make_cache: Any, tmp_path: Path, monkeypatch: pytest.MonkeyPatch, no_ffmpeg: None
) -> None:
    """The plain copy is a second file: no room, no rewrite (the original stays)."""
    monkeypatch.setattr(vodcache, "MIN_FREE_BYTES", 1_000_000)
    vc = await make_cache(ffmpeg="ffmpeg")
    with fake_disk(tmp_path / "vod", 1_000_000 + int(len(BODY) * 1.6)):
        entry = await _complete(vc, "one", plain=True)
        assert entry.timing["flat"] == "no: not enough free disk space"
        assert not entry.flat_path.exists()
        assert vc.served_path(entry, True) == entry.path
        assert shutil.disk_usage(tmp_path).free >= 1_000_000
    with fake_disk(tmp_path / "vod", 1_000_000 + len(BODY) * 3):
        other = await _complete(vc, "two", plain=True)
        assert other.timing["flat"] == "yes"
    assert vc._reserved == {}


async def test_live_urls_keep_their_recording(make_cache: Any, no_ffmpeg: None) -> None:
    """A leased recording is not evicted; original and plain copy go together."""
    vc = await make_cache(ffmpeg="ffmpeg")
    first = await vc.async_open(rec("one"))
    vc.lease(first, 1800, "tok")
    await vc.async_wait(first, complete=True)
    assert first.task is not None
    await first.task
    assert await vc.async_plain(first)
    second = await _complete(vc, "two", plain=True)
    for entry in (first, second):
        assert entry.path.exists()
        assert entry.flat_path.exists()
    first.last_access = second.last_access = 0  # both least recently used
    # Room for one more recording: one unit has to go.
    on_disk = sum(p.stat().st_size for p in first.path.parent.iterdir())
    vc._max_bytes = on_disk + vodcache.expected_size(rec("three")) - 1
    third = await _complete(vc, "three")
    assert third.error is None
    assert first.path.exists()
    assert first.flat_path.exists()
    assert not second.path.exists()
    assert not second.flat_path.exists()
    assert vc.entry(rec("two")) is None
    # Neither of the leased recording's files changed.
    assert vc.served_path(first, False).read_bytes() == BODY
    assert vc.served_path(first, True).read_bytes() == b"PLAIN" + BODY
    with patch.object(vodcache, "_clock", return_value=time.monotonic() + EXPIRED):
        assert not first.busy(vodcache._clock())


async def test_a_released_lease_no_longer_protects(make_cache: Any) -> None:
    """A player that moves on releases its lease: the recording can go."""
    vc = await make_cache()
    one = await _complete(vc, "one")
    vc.lease(one, 1800, "tok-one")
    two = await _complete(vc, "two")
    one.last_access, two.last_access = 0, 1
    on_disk = sum(p.stat().st_size for p in one.path.parent.iterdir())
    vc._max_bytes = on_disk + vodcache.expected_size(rec("three")) - 1
    # Leased: the next recording takes the unleased one, even if used later.
    three = await _complete(vc, "three")
    assert three.error is None
    assert one.path.exists()
    assert not two.path.exists()
    vc.release("tok-one")
    vc.release("tok-unknown")  # an unknown or repeated release is harmless
    assert not one.busy(vodcache._clock())
    three.last_access = 2
    four = await _complete(vc, "four")
    assert four.error is None
    assert not one.path.exists()
    assert three.path.exists()


async def test_a_playback_fill_evicts_leases_not_read_recently(
    make_cache: Any,
) -> None:
    """A click may take room from a lease nobody read lately; a prefetch may not."""
    vc = await make_cache()
    one = await _complete(vc, "one")
    vc.lease(one, 1800, "tok-one")
    two = await _complete(vc, "two")
    vc.lease(two, 1800, "tok-two")
    on_disk = sum(p.stat().st_size for p in one.path.parent.iterdir())
    vc._max_bytes = on_disk + vodcache.expected_size(rec("three")) - 1
    later = time.monotonic() + vodcache.LEASE_IDLE_S + 1
    with patch.object(vodcache, "_clock", return_value=later):
        assert one.busy(later)  # still leased...
        vc.touch("tok-two")  # ...but only two was read lately
        prefetch = await vc.async_open(rec("three"), Priority.PREFETCH)
        with pytest.raises(VodCacheError, match="free disk space"):
            await vc.async_wait(prefetch, complete=True)
        assert one.path.exists()
        click = await vc.async_open(rec("four"), Priority.PLAYBACK)
        await vc.async_wait(click, complete=True)
        assert not one.path.exists()
        assert two.path.exists()
        assert vc.stats()["leased"] == 1
        # Its player comes back: the recording is fetched again, and leased.
        again = await vc.async_open(rec("one"))
        vc.touch("tok-one")
        assert again is not one
        assert again.leased(later, vodcache.LEASE_IDLE_S)


async def test_a_rewrite_outlives_its_request(
    make_cache: Any, no_ffmpeg: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A request that goes away leaves the rewrite running for the next one."""
    vc = await make_cache(ffmpeg="ffmpeg")
    entry = await _complete(vc, "one")
    started = asyncio.Event()
    release = asyncio.Event()

    async def slow(binary: str, source: Path, target: Path) -> None:
        started.set()
        await release.wait()
        await fake_flatten(binary, source, target)

    monkeypatch.setattr(vodcache, "async_flatten", slow)
    waiter = asyncio.create_task(vc.async_plain(entry))
    await started.wait()
    waiter.cancel()
    with pytest.raises(asyncio.CancelledError):
        await waiter
    assert entry.flattening
    release.set()
    assert await vc.async_plain(entry)
    assert entry.flat_path.read_bytes() == b"PLAIN" + BODY


async def test_concurrent_opens_of_a_file_on_disk(
    hass: HomeAssistant, tmp_path: Path, media: Server, make_cache: Any
) -> None:
    """Two requests at once for a recording already on disk download nothing."""
    directory = tmp_path / "vod"
    directory.mkdir()
    (directory / f"{rec().cache_id}.mp4").write_bytes(BODY)
    vc = await make_cache()
    a, b = await asyncio.gather(vc.async_open(rec()), vc.async_open(rec()))
    await asyncio.sleep(0.05)
    assert a is b
    assert a.complete
    assert media.hits == []


async def test_a_recording_still_being_written_is_cached_anew(
    make_cache: Any, media: Server
) -> None:
    """A copy made when the recording was shorter serves only what it covers."""
    vc = await make_cache()
    name = "growing"
    short = Recording(SOURCE, "sub", name, 0, 600_000, size=len(BODY))
    longer = Recording(SOURCE, "sub", name, 0, 900_000, size=len(BODY))
    assert short.cache_id != longer.cache_id
    assert short.copy_key == longer.copy_key
    assert await vc.async_peek(longer) is None
    first = await vc.async_open(short)
    await vc.async_wait(first, complete=True)
    assert first.task is not None
    await first.task
    # The check's peek sees the short copy: the recording is not uncached.
    peek = await vc.async_peek(longer)
    assert peek is not None
    assert peek["complete"]
    # A start the short copy reaches (with a minute to spare): no download.
    again = await vc.async_open(longer, at=500_000)
    assert again is first
    # Warming takes any copy.
    assert await vc.async_open(longer, Priority.PREFETCH, any_copy=True) is first
    assert media.hits == [name]
    # A start past the short copy: the recording is fetched again, as it is now.
    fresh = await vc.async_open(longer, at=560_000)
    assert fresh is not first
    assert fresh.recording.end_ms == 900_000
    await vc.async_wait(fresh, complete=True)
    assert media.hits == [name, name]
    # From then on the longer copy serves both.
    assert await vc.async_open(longer, at=100_000) is fresh
    assert await vc.async_open(short) is first  # the exact copy still exists


# ---- MSE fragments (Phase 2B step 2) ----

# A minute of NVR-shaped recording: 30 fragments of 2 s, absolute offsets, no
# tfdt. /slownvr stops after its first 100 KB (about 17 fragments) until the
# gate opens.
NVR_MINUTE = fragmented_av(30, absolute=True, tfdt=False)


@pytest.fixture
def nvr_minute() -> Any:
    EXTRA["slownvr"] = NVR_MINUTE
    yield
    EXTRA.pop("slownvr", None)


async def _window_bytes(vc: VodCache, entry: Any, window: Any) -> bytes:
    return b"".join([c async for c in vc.async_read_window(entry, window)])


async def test_fragment_windows_follow_a_fill(
    cache: tuple[VodCache, Scheduler, FakeHost], media: Server, nvr_minute: None
) -> None:
    """A start waits only for the fragments up to it, not the whole file."""
    vc, _sched, _host = cache
    entry = await vc.async_open(rec("slownvr"))
    init, mime, source = await vc.async_init(entry)
    assert source == "file"
    assert init == FTYP + av_moov()
    assert mime == MIME
    # 10 s in is on disk before the pause: served while the download waits.
    window = await vc.async_window(entry, at_ms=10_500, max_ms=4000, max_bytes=10**7)
    assert not entry.complete
    assert window.first == 5
    assert [f.start_ms for f in window.fragments] == [10_000, 12_000]
    assert (window.start_ms, window.end_ms, window.last) == (10_000, 14_000, False)
    data = await _window_bytes(vc, entry, window)
    moofs = [at for kind, at, _payload in _boxes(data) if kind == "moof"]
    assert len(moofs) == 2
    for i, at in enumerate(moofs):
        fragment = window.fragments[i]
        _check_mse_ready(data[at:], dict(fragment.decode))
    # 50 s in is not on disk yet: the window waits for it.
    later = asyncio.create_task(
        vc.async_window(entry, at_ms=50_000, max_ms=4000, max_bytes=10**7)
    )
    await asyncio.sleep(0.05)
    assert not later.done()
    media.gate.set()
    window = await later
    assert window.first == 25
    await vc.async_wait(entry, complete=True)
    # Continuing by index; the end of the recording is flagged.
    end = await vc.async_window(entry, first=27, max_ms=60_000, max_bytes=10**7)
    assert [f.start_ms for f in end.fragments] == [54_000, 56_000, 58_000]
    assert end.last
    assert entry.public()["complete"]
    # Past the end: the last key frame by time, nothing by index.
    tail = await vc.async_window(entry, at_ms=10**9, max_ms=1, max_bytes=1)
    assert (tail.first, len(tail.fragments), tail.last) == (29, 1, True)
    none = await vc.async_window(entry, first=30, max_ms=1, max_bytes=1)
    assert (none.first, none.fragments, none.last) == (30, (), True)
    # Windows stop at their media time or size (at least one fragment).
    small = await vc.async_window(entry, first=0, max_ms=1, max_bytes=10**7)
    assert len(small.fragments) == 1
    sized = await vc.async_window(entry, first=0, max_ms=60_000, max_bytes=12_000)
    assert len(sized.fragments) == 2
    assert media.hits == ["slownvr"]


async def test_a_window_is_last_only_by_what_it_scanned(
    cache: tuple[VodCache, Scheduler, FakeHost],
    media: Server,
    nvr_minute: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A fill that completes while a window is scanned does not end that window."""
    vc, _sched, _host = cache
    entry = await vc.async_open(rec("slownvr"))
    await vc.async_init(entry)
    scanned, resume = threading.Event(), threading.Event()
    scan = vodcache._scan_fragments

    def scan_then_wait(candidates: Any, index: Any, available: int) -> None:
        scan(candidates, index, available)
        scanned.set()
        resume.wait(5)

    monkeypatch.setattr(vodcache, "_scan_fragments", scan_then_wait)
    window = asyncio.create_task(
        vc.async_window(entry, first=10, max_ms=10**6, max_bytes=10**9)
    )
    await asyncio.to_thread(scanned.wait, 5)
    # The rest arrives while the scan of the first part finishes.
    media.gate.set()
    await vc.async_wait(entry, complete=True)
    resume.set()
    result = await window
    assert result.first + len(result.fragments) < 30
    assert not result.last


async def test_a_fill_failing_mid_window(
    cache: tuple[VodCache, Scheduler, FakeHost], media: Server
) -> None:
    """A window whose fill fails before it is read raises VodCacheError."""
    EXTRA["cutnvr"] = NVR_MINUTE
    try:
        vc, _sched, _host = cache
        entry = await vc.async_open(rec("cutnvr"))
        window = await vc.async_window(entry, first=0, max_ms=10**6, max_bytes=10**9)
        assert window.fragments
        media.gate.set()
        with pytest.raises(VodCacheError, match="connection error"):
            await vc.async_wait(entry, complete=True)
        assert entry.task is not None
        await entry.task
        assert not entry.part_path.exists()
        with pytest.raises(VodCacheError, match="connection error"):
            await _window_bytes(vc, entry, window)
        assert entry.readers == 0
    finally:
        EXTRA.pop("cutnvr", None)


async def test_plain_files_are_not_fragments(
    cache: tuple[VodCache, Scheduler, FakeHost],
) -> None:
    """A recording that is not fragmented cannot feed the MSE player."""
    vc, _sched, _host = cache
    entry = await vc.async_open(rec("plain"))
    with pytest.raises(VodCacheError, match="not playable as fragments: not a frag"):
        await vc.async_init(entry)
    with pytest.raises(VodCacheError, match="not playable as fragments"):
        await vc.async_window(entry, at_ms=0, max_ms=1, max_bytes=1)


async def test_fragments_of_a_failed_fill(
    cache: tuple[VodCache, Scheduler, FakeHost],
) -> None:
    """A fill that fails ends the wait with its error."""
    vc, _sched, _host = cache
    entry = await vc.async_open(rec("missing"))
    with pytest.raises(VodCacheError, match="HTTP 404"):
        await vc.async_init(entry)

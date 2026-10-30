"""Deep starts over the Reolink protocol: the source and the cache's use of it."""

import asyncio
from collections.abc import AsyncGenerator, Callable
from datetime import datetime, tzinfo
from pathlib import Path
from typing import Any
from unittest.mock import patch
from zoneinfo import ZoneInfo

from aiohttp import ClientSession
import pytest

from custom_components.reolink_viewer import baichuan_source, bridge, vodcache
from custom_components.reolink_viewer.baichuan_source import (
    BaichuanSource,
    Cut,
    CutError,
    _local,
)
from custom_components.reolink_viewer.bridge import BaichuanEndpoint
from custom_components.reolink_viewer.devices import PlaybackSource
from custom_components.reolink_viewer.scheduler import Priority, Scheduler
from custom_components.reolink_viewer.vodcache import (
    CUT_FIRST,
    Recording,
    VodCache,
    VodCacheError,
)
from homeassistant.core import HomeAssistant

from .mp4_fixtures import fragmented_av
from .test_baichuan_client import PASSWORD, USER, FakeNvr
from .test_baichuan_media import H264_PPS, H264_SPS, annexb, video
from .test_baichuan_mux import IDR, P
from .test_vodcache import EXTRA, FakeHost, Server, media  # noqa: F401

NEW_YORK = ZoneInfo("America/New_York")
# A recording 2026-10-30 02:00:00-02:15:00 UTC; a start 10 minutes in.
START_MS = 1_793_325_600_000
END_MS = START_MS + 15 * 60_000
AT_MS = 600_000.0
ASKED = (START_MS + AT_MS) / 1000


def camera_blocks(
    first_unix: float, seconds: int = 6, *, fps: int = 5, rate: int = 1_000_000
) -> bytes:
    """A cut's media: a key frame (with SPS/PPS) each second, frames between."""
    out = bytearray()
    for i in range(seconds * fps):
        t = i / fps
        micro = round(t * rate) & 0xFFFFFFFF
        if i % fps == 0:
            payload = annexb(H264_SPS, H264_PPS, IDR)
            out += video("key", payload, micro=micro, unix=int(first_unix + t))
        else:
            out += video("frame", annexb(P), micro=micro)
    return bytes(out)


class Host(FakeHost):
    """The bridge's host: recordings over HTTP, Baichuan to the fake NVR."""

    def __init__(self, server: Any, nvr: FakeNvr, tz: tzinfo | None) -> None:
        super().__init__(server)
        self.nvr = nvr
        self.tz = tz

    def timezone(self) -> tzinfo | None:
        return self.tz

    def baichuan_endpoint(self) -> BaichuanEndpoint:
        return BaichuanEndpoint("127.0.0.1", self.nvr.port, USER, PASSWORD)


@pytest.fixture
async def nvr(socket_enabled: None) -> AsyncGenerator[FakeNvr]:
    server = FakeNvr()
    server.media = camera_blocks(ASKED - 3)
    server.chunk_size = 200
    server.delay = 0.002
    await server.start()
    yield server
    await server.close()  # cancels streams still held at the gate


class Rig:
    """A source on a scheduler, with the host patched in."""

    def __init__(self, hass: HomeAssistant, nvr: FakeNvr, tmp_path: Path) -> None:
        self.hass = hass
        self.nvr = nvr
        self.dir = tmp_path
        self.on = True
        self.scheduler = Scheduler(default_limit=2, default_stream_limit=2)
        self.source = BaichuanSource(
            hass, self.scheduler, enabled=lambda: self.on, idle_logout=0.05
        )
        self.reserved: list[tuple[Path, int]] = []

    async def reserve(self, path: Path, size: int) -> None:
        self.reserved.append((path, size))

    async def cut(self, channel: int = 3, stream: str = "sub", name: str = "a") -> Cut:
        return await self.source.async_start(
            entry_id="entry1",
            channel=channel,
            stream=stream,
            start_ms=START_MS,
            end_ms=END_MS,
            at_ms=AT_MS,
            path=self.dir / f"{name}.cut.mp4",
            reserve=self.reserve,
            size=1000,
        )

    def cmds(self) -> list[int]:
        return [cmd for cmd, _xml in self.nvr.requests]


@pytest.fixture
async def rig(
    hass: HomeAssistant,
    nvr: FakeNvr,
    tmp_path: Path,
    media: Server,  # noqa: F811
) -> AsyncGenerator[Rig]:
    host = Host(media.server, nvr, NEW_YORK)
    with patch.object(bridge, "async_get_host", return_value=host):
        rig = Rig(hass, nvr, tmp_path)
        yield rig
        await rig.source.async_shutdown()
        await rig.scheduler.async_shutdown()


async def _done(cut: Cut) -> None:
    assert cut.task is not None
    async with asyncio.timeout(10):
        await asyncio.shield(cut.task)


async def _until(test: Callable[[], bool], seconds: float = 5) -> None:
    async with asyncio.timeout(seconds):
        while not test():  # noqa: ASYNC110 - state of several objects
            await asyncio.sleep(0.01)


async def test_a_cut_is_muxed_to_fragments_and_the_login_ends_when_idle(
    rig: Rig,
) -> None:
    assert rig.source.enabled
    cut = await rig.cut()
    await _done(cut)
    assert cut.error is None
    assert cut.complete
    assert cut.timing["login"] == "new"
    assert cut.timing["end_status"] == 300
    assert cut.timing["first_fragment_ms"] >= 0
    assert cut.index.mime == 'video/mp4; codecs="avc1.4D400C"'
    assert len(cut.index.fragments) == 6
    # The first key frame was 3 s before the asked moment.
    assert cut.start_ms == AT_MS - 3000
    assert cut.end_ms == AT_MS + 3000
    assert cut.written == cut.path.stat().st_size
    # 1000 bytes first, then more as the file outgrows it.
    assert rig.reserved[0] == (cut.path, 1000)
    assert rig.reserved[-1][1] >= cut.written
    public = cut.public()
    assert public["source"] == "baichuan cut"
    assert public["mux"]["fragments"] == 6
    assert public["running"] is False
    # In the device's local time (EDT), from 4 s before the asked moment.
    xml = next(x for c, x in rig.nvr.requests if c == 143)
    assert "<hour>22</hour>\n<minute>9</minute>\n<second>56</second>" in xml
    assert "<supportSub>1</supportSub>" in xml
    assert "<streamType>subStream</streamType>" in xml
    assert "<logicChnBitmap>8</logicChnBitmap>" in xml
    assert rig.nvr.ended == [4]  # 144 on the channel's handle
    assert rig.source.stats()["logged_in"] == 1
    await _until(lambda: rig.source.stats()["logged_in"] == 0)
    assert rig.cmds() == [1, 1, 143, 144, 2]
    assert rig.source.stats() == {
        "enabled": True,
        "logged_in": 0,
        "logins": 1,
        "logouts": 1,
        "cuts_running": 0,
    }


async def test_cuts_share_one_login_and_a_new_start_on_a_channel_replaces_its_cut(
    rig: Rig,
) -> None:
    rig.nvr.gate = asyncio.Event()
    first = await rig.cut(channel=3, name="a")
    other = await rig.cut(channel=5, stream="main", name="b")
    await _until(lambda: rig.cmds().count(143) == 2)
    assert rig.source.stats()["cuts_running"] == 2
    assert rig.source.stats()["logins"] == 1
    assert {first.timing["login"], other.timing["login"]} == {"new", "shared"}
    main_xml = [x for c, x in rig.nvr.requests if c == 143][1]
    assert "<supportSub>0</supportSub>" in main_xml
    assert "<streamType>mainStream</streamType>" in main_xml
    replacement = await rig.cut(channel=3, name="c")
    assert first.error == "stopped"
    assert not first.running
    assert 4 in rig.nvr.ended
    rig.nvr.gate.set()
    await _done(replacement)
    await _done(other)
    assert replacement.complete
    assert other.complete
    assert rig.source.stats()["logins"] == 1


async def test_a_refused_channel_bit_is_retried_with_any_channel(rig: Rig) -> None:
    rig.nvr.accept_bitmap = 255
    cut = await rig.cut()
    await _done(cut)
    assert cut.complete
    bitmaps = [
        x.split("<logicChnBitmap>")[1][:3] for c, x in rig.nvr.requests if c == 143
    ]
    assert bitmaps == ["8</", "255"]


async def test_failures_end_the_cut_with_a_reason(rig: Rig) -> None:
    # No stream slot: live view holds them.
    held = [
        rig.scheduler.host("entry1").streams.request(Priority.LIVE) for _ in range(2)
    ]
    with patch.object(baichuan_source, "SLOT_TIMEOUT_S", 0.05):
        cut = await rig.cut()
        await _done(cut)
    assert cut.error == "no stream slot within 0 s (2 of 2 in use)"
    for ticket in held:
        ticket.release()

    # The login is refused.
    rig.nvr.refuse_login = True
    cut = await rig.cut()
    await _done(cut)
    assert cut.error is not None
    assert "refused" in cut.error
    rig.nvr.refuse_login = False

    # No room on disk.
    async def no_room(_path: Path, _size: int) -> None:
        raise CutError("not enough free disk space")

    cut = await rig.source.async_start(
        entry_id="entry1",
        channel=3,
        stream="sub",
        start_ms=START_MS,
        end_ms=END_MS,
        at_ms=AT_MS,
        path=rig.dir / "x.cut.mp4",
        reserve=no_room,
        size=10,
    )
    await _done(cut)
    assert cut.error == "not enough free disk space"

    # The device goes quiet.
    rig.nvr.gate = asyncio.Event()
    with patch.object(baichuan_source, "QUIET_TIMEOUT_S", 0.2):
        cut = await rig.cut()
        await _done(cut)
    assert cut.error == "nothing from the device for 0 s"

    # The connection drops mid-cut.
    sent = rig.cmds().count(143)
    cut = await rig.cut()
    await _until(lambda: rig.cmds().count(143) > sent)
    await asyncio.sleep(0.05)
    for writer in rig.nvr.writers:
        writer.close()
    await _done(cut)
    assert cut.error == "connection lost"


async def test_a_cut_with_nothing_playable_completes_empty(rig: Rig) -> None:
    rig.nvr.media = b"00dc" + b"H264" + bytes(16) + b"\x00" * 64
    cut = await rig.cut()
    await _done(cut)
    assert cut.complete
    assert cut.index.fragments == []


async def test_shutdown_stops_cuts_and_logs_out(rig: Rig) -> None:
    rig.nvr.gate = asyncio.Event()
    cut = await rig.cut()
    await _until(lambda: rig.cmds().count(143) == 1)
    await rig.source.async_shutdown()
    assert cut.error == "stopped"
    assert rig.cmds()[-1] == 2
    assert not rig.source.enabled
    with pytest.raises(CutError):
        await rig.cut()


def test_device_local_time() -> None:
    assert _local(ASKED, None) == datetime(2026, 10, 30, 2, 10)
    assert _local(ASKED, NEW_YORK) == datetime(2026, 10, 29, 22, 10)
    # 2026-11-01 05:30 UTC: 01:30 EDT happened; an hour later 01:30 EST.
    assert _local(1_793_511_000, NEW_YORK) == datetime(2026, 11, 1, 1, 30)
    assert _local(1_793_514_600, NEW_YORK) == datetime(2026, 11, 1, 1, 30)


# ---- The cache ----

SOURCE = PlaybackSource("cam1", "Garage", "entry1", 3)
# 400 fragments of 2 s; the slow server stops after 100 KB (about 36 s).
LONG = fragmented_av(400)


def deep_rec(name: str = "slow-deep") -> Recording:
    return Recording(SOURCE, "sub", name, START_MS, END_MS, size=len(LONG))


@pytest.fixture
async def cached(
    rig: Rig,
    media: Server,  # noqa: F811
) -> AsyncGenerator[tuple[VodCache, Rig]]:
    EXTRA["slow-deep"] = LONG
    EXTRA["slow-other"] = LONG
    async with ClientSession() as session:
        cache = VodCache(
            rig.hass,
            rig.scheduler,
            rig.dir / "vod",
            10**9,
            lambda: session,
            baichuan=rig.source,
        )
        await cache.async_setup()
        yield cache, rig
        media.gate.set()
        await cache.async_shutdown()
    EXTRA.clear()


async def _window(cache: VodCache, entry: Any, **query: Any) -> vodcache.Window:
    return await cache.async_window(entry, max_ms=4_000, max_bytes=10**7, **query)


async def test_a_deep_start_is_served_from_the_cut_while_the_download_goes_on(
    cached: tuple[VodCache, Rig],
) -> None:
    cache, rig = cached
    entry = await cache.async_open(deep_rec())
    cache.lease(entry, 600, "token1")
    init, mime, source = await cache.async_init(entry, at_ms=AT_MS)
    assert source == "cut"
    assert mime == 'video/mp4; codecs="avc1.4D400C"'
    assert init.startswith(b"\x00\x00\x00\x1cftyp")
    window = await _window(cache, entry, at_ms=AT_MS)
    assert window.source == "cut"
    assert window.first == CUT_FIRST + 3
    assert window.start_ms == AT_MS
    data = b"".join([c async for c in cache.async_read_window(entry, window)])
    assert data[4:8] == b"moof"
    after = await _window(cache, entry, first=window.first + len(window.fragments))
    assert after.source == "cut"
    assert after.start_ms == window.end_ms
    assert entry.cut is not None
    await _done(entry.cut)
    end = await _window(cache, entry, first=CUT_FIRST + 6)
    assert (end.fragments, end.last) == ((), True)
    public = entry.public()
    assert public["cut"]["login"] == "new"
    assert public["cut"]["first_fragment_ms"] >= 0
    # The download still fills the original (held after 100 KB by the server).
    assert entry.filling
    stats = await cache.async_stats()
    assert stats["baichuan"]["logins"] == 1
    # A start inside the cut uses it again; the init by source too.
    again = await _window(cache, entry, at_ms=AT_MS + 2000)
    assert again.source == "cut"
    assert rig.cmds().count(143) == 1
    init_cut, _mime, _src = await cache.async_init(entry, source="cut")
    assert init_cut == init


async def test_near_starts_and_the_option_off_keep_to_the_download(
    cached: tuple[VodCache, Rig],
    media: Server,  # noqa: F811
) -> None:
    cache, rig = cached
    entry = await cache.async_open(deep_rec())
    # 10 s in: the download reaches it as soon.
    window = await _window(cache, entry, at_ms=10_000)
    assert window.source == "file"
    rig.on = False
    _init, _mime, source = await cache.async_init(entry, at_ms=AT_MS)
    assert source == "file"
    waiting = asyncio.ensure_future(_window(cache, entry, at_ms=AT_MS))
    await asyncio.sleep(0.2)
    assert not waiting.done()
    media.gate.set()
    window = await waiting
    assert window.source == "file"
    assert rig.cmds() == []
    # Complete now: a deep start reads the original even with the option on.
    rig.on = True
    await cache.async_wait(entry, complete=True)
    assert (await _window(cache, entry, at_ms=AT_MS)).source == "file"


async def test_a_failed_cut_falls_back_to_the_download(
    cached: tuple[VodCache, Rig],
    media: Server,  # noqa: F811
) -> None:
    cache, rig = cached
    rig.nvr.refuse_login = True
    entry = await cache.async_open(deep_rec())
    waiting = asyncio.ensure_future(_window(cache, entry, at_ms=AT_MS))
    await _until(lambda: "cut_error" in entry.timing)
    assert "refused" in entry.timing["cut_error"]
    media.gate.set()
    assert (await waiting).source == "file"
    # Without a cut, a cut index or init is an error.
    with pytest.raises(VodCacheError):
        await _window(cache, entry, first=CUT_FIRST)
    with pytest.raises(VodCacheError):
        await cache.async_init(entry, source="cut")


async def test_a_cut_ending_before_the_moment_falls_back(
    cached: tuple[VodCache, Rig],
    media: Server,  # noqa: F811
) -> None:
    cache, rig = cached
    rig.nvr.media = camera_blocks(ASKED - 30, seconds=3)
    entry = await cache.async_open(deep_rec())
    waiting = asyncio.ensure_future(_window(cache, entry, at_ms=AT_MS))
    await _until(lambda: entry.cut is not None and entry.cut.complete)
    await asyncio.sleep(0.05)
    media.gate.set()
    assert (await waiting).source == "file"


async def test_a_cut_without_a_fragment_in_time_is_stopped(
    cached: tuple[VodCache, Rig],
    media: Server,  # noqa: F811
) -> None:
    cache, rig = cached
    rig.nvr.gate = asyncio.Event()
    rig.nvr.gate_at = 0
    entry = await cache.async_open(deep_rec())
    with patch.object(vodcache, "CUT_FIRST_WAIT_S", 0.2):
        waiting = asyncio.ensure_future(_window(cache, entry, at_ms=AT_MS))
        await _until(lambda: "cut_error" in entry.timing)
    media.gate.set()
    assert (await waiting).source == "file"
    assert entry.timing["cut_error"] == "no fragment within 0 s"
    assert entry.cut is not None
    assert entry.cut.error == "stopped"


async def test_a_seek_far_past_the_cut_starts_another_and_the_last_viewer_stops_it(
    cached: tuple[VodCache, Rig],
    media: Server,  # noqa: F811
) -> None:
    cache, rig = cached
    rig.nvr.media = camera_blocks(ASKED - 3, seconds=30)
    rig.nvr.gate = asyncio.Event()
    rig.nvr.gate_at = 8
    entry = await cache.async_open(deep_rec())
    cache.lease(entry, 600, "token1")
    assert (await _window(cache, entry, at_ms=AT_MS)).source == "cut"
    first = entry.cut
    assert first is not None
    # (6 s of media: fewer chunks than the gate's place, so it is not held.)
    rig.nvr.media = camera_blocks(ASKED + 197)
    window = await _window(cache, entry, at_ms=AT_MS + 200_000)
    assert window.source == "cut"
    assert entry.cut is not first
    assert first.error == "stopped"
    assert not first.path.exists()
    assert entry.cuts == 2
    cut = entry.cut
    assert cut is not None
    await _done(cut)
    # The viewer leaves; the download completes; the cut's file goes.
    media.gate.set()
    await cache.async_wait(entry, complete=True)
    cache.release("token1")
    await _until(lambda: entry.cut is None and not cut.path.exists())


async def test_cut_files_are_cleared_at_setup_and_counted_with_their_recording(
    hass: HomeAssistant, tmp_path: Path
) -> None:
    folder = tmp_path / "vod"
    folder.mkdir()
    (folder / "abc.1.cut.mp4").write_bytes(b"x" * 10)
    (folder / "abc.mp4").write_bytes(b"x" * 10)
    scheduler = Scheduler(default_limit=1, default_stream_limit=1)
    cache = VodCache(hass, scheduler, folder, 10**9, lambda: None)  # type: ignore[arg-type,return-value]
    await cache.async_setup()
    assert sorted(p.name for p in folder.iterdir()) == ["abc.mp4"]
    assert vodcache._cache_id_of(folder / "abc.2.cut.mp4") == "abc"
    stats = await cache.async_stats()
    assert "baichuan" not in stats
    await scheduler.async_shutdown()

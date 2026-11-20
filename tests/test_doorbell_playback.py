"""Tests for the Doorbell's recordings played by a cut (Phase 12 step b)."""

import asyncio
from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta
import io
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch
from xml.etree import ElementTree as ET

from aiohttp import ClientSession
import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry
from reolink_aio.typings import VOD_trigger

from custom_components.reolink_viewer import bridge, devices
from custom_components.reolink_viewer.baichuan_source import BaichuanSource
from custom_components.reolink_viewer.bridge import VodEvent, recordings_of_events
from custom_components.reolink_viewer.cutstream import (
    CutStreamError,
    local_wall,
    muxed_cut,
)
from custom_components.reolink_viewer.fmp4 import FragmentIndex
from custom_components.reolink_viewer.scheduler import Priority, Scheduler
from custom_components.reolink_viewer.vodcache import Recording, VodCache
from homeassistant.core import HomeAssistant

from .conftest import TEST_NOW, make_vod_file
from .test_baichuan_media import (
    H264_IDR_I,
    H264_P,
    H264_PPS,
    H264_SPS,
    adts_frame,
    annexb,
    audio,
    info_block,
    video,
)
from .test_probe_doorbell import FakeCut, chunked

# A recording that starts at this UTC moment, 10 s long.
ORIGIN = datetime(2026, 11, 19, 18, 30, 0, tzinfo=UTC)


def cut_media(origin: datetime = ORIGIN, seconds: int = 10, fps: int = 5) -> bytes:
    """A cut's payload: a stream header, a key frame each second, AAC audio."""
    out = bytearray(info_block(640, 480, fps))
    unix = int(origin.timestamp())
    for i in range(seconds * fps):
        micro = i * 1_000_000 // fps
        if i % fps == 0:
            key = annexb(H264_SPS, H264_PPS, H264_IDR_I)
            out += video("key", key, micro=micro, unix=unix + i // fps)
        else:
            out += video("frame", annexb(H264_P), micro=micro)
        out += audio(adts_frame())
    return bytes(out)


def _index(data: bytes) -> FragmentIndex:
    index = FragmentIndex()
    index.scan(io.BytesIO(data), len(data))
    return index


async def test_a_cut_is_muxed_into_the_mp4_a_download_would_be() -> None:
    """The init, then fragments on the recording's media time, and the cut's numbers."""
    cut = FakeCut(chunked(cut_media(), 700))
    timing: dict[str, Any] = {}
    parts = [
        part
        async for part in muxed_cut(
            cut(), origin_unix=ORIGIN.timestamp(), timing=timing
        )
    ]
    data = b"".join(parts)
    assert data[4:8] == b"ftyp"
    index = _index(data)
    assert len(index.fragments) == 10
    assert index.duration_ms == pytest.approx(10_000, abs=250)
    numbers = timing["cut"]
    assert (numbers["key_frames"], numbers["frames"], numbers["audio_blocks"]) == (
        10,
        40,
        50,
    )
    assert numbers["codec"] == "h264"
    # The key frames' own POSIX times are the recording's: placed by them.
    assert (numbers["anchor"], numbers["anchor_offset_s"]) == ("key frame time", 0)
    assert numbers["first_fragment_ms"] is not None
    assert cut.closed is True


async def test_leaving_a_cut_early_ends_it() -> None:
    """Closing the muxed stream closes the cut (reolink-aio then sends 144)."""
    cut = FakeCut(chunked(cut_media(), 700))
    timing: dict[str, Any] = {}
    muxed = muxed_cut(cut(), origin_unix=ORIGIN.timestamp(), timing=timing)
    first = await anext(muxed)
    assert first[4:8] == b"ftyp"
    await muxed.aclose()
    assert cut.closed is True
    assert cut.sent < len(cut.chunks)
    assert timing["cut"]["key_frames"] >= 1


class CutHost:
    """A UDP-only camera whose recordings come by a cut over HA's session."""

    baichuan_only = True

    def __init__(self, media: bytes) -> None:
        self.cut = FakeCut(chunked(media, 4000))
        self.asked: list[tuple[int, datetime, datetime, str]] = []

    def plays_by_cut(self, channel: int) -> bool:
        return True

    def timezone(self) -> Any:
        return UTC

    def async_stream_cut(
        self, channel: int, start: datetime, end: datetime, stream: str
    ) -> AsyncGenerator[bytes]:
        self.asked.append((channel, start, end, stream))
        return self.cut()

    async def async_vod_url(self, *_args: Any) -> Any:
        raise AssertionError("a camera played by cut has no HTTP download")


async def test_the_cache_fetches_a_recording_by_cut(
    hass: HomeAssistant, tmp_path: Path
) -> None:
    """The cut's MP4 stands where the download would: indexed, whole, its codec kept."""
    host = CutHost(cut_media())
    source = MagicMock(entry_id="door", channel=0, key="door|0")
    start_ms = int(ORIGIN.timestamp() * 1000)
    recording = Recording(source, "sub", "20261119183000", start_ms, start_ms + 10_000)
    scheduler = Scheduler(default_limit=2, default_stream_limit=1)
    async with ClientSession() as session:
        with patch.object(bridge, "async_get_host", return_value=host):
            cache = VodCache(hass, scheduler, tmp_path / "vod", 10**9, lambda: session)
            await cache.async_setup()
            try:
                entry = await cache.async_open(recording)
                await cache.async_wait(entry, complete=True)
                assert entry.complete
                assert entry.timing["source"] == "cut"
                assert entry.timing["cut"]["anchor"] == "key frame time"
                # Room for the index after moov, as for an NVR's fragmented file.
                assert entry.timing["indexed"] == "yes"
                stored = entry.path.read_bytes()
                assert _index(stored).duration_ms == pytest.approx(10_000, abs=250)
                info = cache.media_info(source, "sub")
                assert info is not None
                assert str(info["codec"]).startswith("avc1")
                assert info["audio"] == "mp4a.40.2"
            finally:
                await cache.async_shutdown()
    await scheduler.async_shutdown()
    # Asked of the device in its local time (UTC here), from start to end.
    assert host.asked == [
        (0, datetime(2026, 11, 19, 18, 30), datetime(2026, 11, 19, 18, 30, 10), "sub")
    ]
    assert host.cut.closed is True


class QueueHost(CutHost):
    """Each cut its own, and the order the cuts open and close in."""

    def __init__(self) -> None:
        super().__init__(b"")
        self.order: list[str] = []
        # The first cut sends nothing until this opens; set once one is open.
        self.gate = asyncio.Event()
        self.opened = asyncio.Event()

    def async_stream_cut(
        self, channel: int, start: datetime, end: datetime, stream: str
    ) -> AsyncGenerator[bytes]:
        name = f"{start:%S}"
        origin = start.replace(tzinfo=UTC)

        async def cut() -> AsyncGenerator[bytes]:
            self.order.append(f"open {name}")
            self.opened.set()
            try:
                await self.gate.wait()
                for chunk in chunked(cut_media(origin), 4000):
                    await asyncio.sleep(0)
                    yield chunk
            finally:
                self.order.append(f"close {name}")

        return cut()


async def test_a_cameras_cuts_take_turns(hass: HomeAssistant, tmp_path: Path) -> None:
    """reolink-aio streams one cut per device: the cache queues the next, untimed."""
    host = QueueHost()
    source = MagicMock(entry_id="door", channel=0, key="door|0")
    first_ms = int(ORIGIN.timestamp() * 1000)
    one = Recording(source, "sub", "one", first_ms, first_ms + 10_000)
    two = Recording(source, "sub", "two", first_ms + 20_000, first_ms + 30_000)
    scheduler = Scheduler(default_limit=2, default_stream_limit=2)
    async with ClientSession() as session:
        with patch.object(bridge, "async_get_host", return_value=host):
            cache = VodCache(hass, scheduler, tmp_path / "vod", 10**9, lambda: session)
            await cache.async_setup()
            try:
                first = await cache.async_open(one)
                second = await cache.async_open(two)
                # Both fills hold a stream slot; the second waits at the cut.
                await host.opened.wait()
                await asyncio.sleep(0.01)
                # One cut open; the other fill waits for it (either may go first).
                (opened,) = host.order
                host.gate.set()
                await cache.async_wait(first, complete=True)
                await cache.async_wait(second, complete=True)
                waited = ["cut_wait_ms" in e.timing for e in (first, second)]
                assert sorted(waited) == [False, True]
            finally:
                await cache.async_shutdown()
    await scheduler.async_shutdown()
    name = opened.split()[1]
    other = "20" if name == "00" else "00"
    assert host.order == [
        f"open {name}",
        f"close {name}",
        f"open {other}",
        f"close {other}",
    ]


def test_the_tcp_deep_start_never_asks_a_udp_only_host(hass: HomeAssistant) -> None:
    """Phase 5's client speaks TCP: a UDP-only device is never asked a cut by it."""
    source = BaichuanSource(hass, MagicMock(), enabled=lambda: True)
    udp = MagicMock(baichuan_only=True)
    tcp = MagicMock(baichuan_only=False)
    with patch.object(bridge, "async_get_host", return_value=udp):
        assert source.usable("door") is False
    with patch.object(bridge, "async_get_host", return_value=tcp):
        assert source.usable("nvr") is True
    with patch.object(
        bridge, "async_get_host", side_effect=bridge.HostNotFoundError("gone")
    ):
        assert source.usable("gone") is True


def _event(start: datetime, seconds: int, file_id: str, *types: str) -> VodEvent:
    return VodEvent(start, start + timedelta(seconds=seconds), types, file_id)


def test_recordings_of_events() -> None:
    """A recording per file: from its stamp (pre-recording) or its first event."""
    at = datetime(2026, 11, 19, 12, 30, 5)
    events = [
        # The file's stamp 5 s before its first event: the recording starts there.
        _event(at, 20, "20261119123000", "PERSON"),
        _event(at + timedelta(seconds=30), 10, "20261119123000", "DOORBELL"),
        # A stamp that cannot be this file's start (after its event): the event.
        _event(at + timedelta(hours=1), 15, "20261119140000", "MOTION"),
    ]
    files, linked = recordings_of_events(events, "sub")
    first, second = files
    assert (first.start, first.end) == (
        datetime(2026, 11, 19, 12, 30),
        at + timedelta(seconds=40),
    )
    assert first.triggers == ("PERSON", "DOORBELL")
    assert (first.name, first.stream, first.size) == ("20261119123000", "sub", None)
    assert (second.start, second.end) == (
        at + timedelta(hours=1),
        at + timedelta(hours=1, seconds=15),
    )
    assert second.name == second.start_id == "20261119133005"
    # Each event names its recording by the recording's start, as an NVR's do.
    assert [e.file_id for e in linked] == [
        first.start_id,
        first.start_id,
        second.start_id,
    ]
    assert recordings_of_events([], "sub") == ([], [])


def _doorbell(host: MagicMock, *, wired: bool = True, streams: bool = True) -> None:
    host.is_nvr = False
    host.is_hub = False
    host.baichuan_only = True
    host.hdd_list = [0]
    host.hdd_available.side_effect = lambda index: True
    host.supported.side_effect = lambda _ch, cap, *_args: cap != "replay"
    host.is_doorbell.return_value = True
    host._battery = {0: {"powerSupplyStatus": "normal" if wired else "none"}}
    if streams:
        host.baichuan.send_payload_stream = FakeCut([])


@pytest.mark.parametrize(
    ("wired", "streams", "plays"),
    [(True, True, True), (False, True, False), (True, False, False)],
)
async def test_which_cameras_play_by_cut(
    hass: HomeAssistant,
    reolink_host: MagicMock,
    loaded_reolink: MockConfigEntry,
    wired: bool,
    streams: bool,
    plays: bool,
) -> None:
    """Only on wired power, and only with reolink-aio's streamed cut (0.23.0)."""
    (handle,) = bridge.async_get_hosts(hass)
    # An NVR records where it is played over HTTP: never by cut.
    assert handle.plays_by_cut(0) is False
    _doorbell(reolink_host, wired=wired, streams=streams)
    assert handle.baichuan_only is True
    assert handle.plays_by_cut(0) is plays


async def test_the_doorbells_day_comes_from_its_events(
    hass: HomeAssistant,
    reolink_host: MagicMock,
    loaded_reolink: MockConfigEntry,
) -> None:
    """Its recordings are its events' files; no HTTP search is made."""
    _doorbell(reolink_host)
    press = make_vod_file(TEST_NOW - timedelta(hours=1), 1, name="20261017110000")
    press.bc_triggers = VOD_trigger.DOORBELL
    reolink_host.baichuan.search_vod_type = AsyncMock(
        return_value=({}, {VOD_trigger.DOORBELL: [press]})
    )
    (handle,) = bridge.async_get_hosts(hass)
    midnight = datetime(2026, 10, 17)
    day = await handle.async_search_day(0, midnight, TEST_NOW, "sub")
    (file,) = day.files
    (event,) = day.events
    assert (file.start, file.end) == (
        TEST_NOW - timedelta(hours=1),
        TEST_NOW - timedelta(minutes=59),
    )
    assert event.file_id == file.start_id
    assert "events_ms" in day.timing
    reolink_host.request_vod_files.assert_not_awaited()


async def test_the_doorbell_is_a_playback_source_on_wired_power(
    hass: HomeAssistant,
    reolink_host: MagicMock,
    loaded_with_entities: MockConfigEntry,
) -> None:
    """Played by cut, its Playback tab plays video, not pictures."""
    handle = bridge.ReolinkHostHandle
    with patch.object(handle, "records_locally", return_value=False):
        assert devices.async_playback_sources(hass) == []
        with patch.object(handle, "plays_by_cut", return_value=True):
            (source,) = devices.async_playback_sources(hass)
            assert source.playable is True
            (event_source,) = devices.async_event_sources(hass)
            assert event_source == source


def test_local_wall() -> None:
    """A moment as the device's wall clock reads it."""
    assert local_wall(ORIGIN.timestamp(), UTC) == datetime(2026, 11, 19, 18, 30)
    assert local_wall(0, None).tzinfo is None


def test_cut_request_names_the_main_stream() -> None:
    """The stream asked by name (the Doorbell sends its main either way)."""
    start = datetime(2026, 11, 19, 12, 30)
    body = bridge._download_cut_xml(0, "UID", "main", start, start)
    assert ET.fromstring(body).findtext(".//streamType") == "mainStream"


async def _stream(
    parts: list[bytes], *, hang: bool = False, fail: Exception | None = None
) -> AsyncGenerator[bytes]:
    """A cut's payload: ``parts``, then silence (``hang``) or ``fail``."""
    for part in parts:
        await asyncio.sleep(0)
        yield part
    if fail is not None:
        raise fail
    if hang:
        await asyncio.Event().wait()


async def _drain(muxed: AsyncGenerator[bytes]) -> bytes:
    return b"".join([part async for part in muxed])


async def test_a_cut_that_sends_nothing_says_so() -> None:
    """Nothing within the first wait: the cut fails, saying so."""
    timing: dict[str, Any] = {}
    muxed = muxed_cut(
        _stream([], hang=True),
        origin_unix=ORIGIN.timestamp(),
        timing=timing,
        first_chunk_s=0.05,
    )
    with pytest.raises(CutStreamError, match="the doorbell sent nothing within"):
        await _drain(muxed)
    assert timing["cut"]["bytes"] == 0


async def test_a_cut_that_stops_part_way_says_how_far() -> None:
    """A silence before the recording's end fails it, with how much came."""
    media = cut_media()
    timing: dict[str, Any] = {}
    muxed = muxed_cut(
        _stream(chunked(media[: len(media) // 2], 700), hang=True),
        origin_unix=ORIGIN.timestamp(),
        timing=timing,
        length_s=10,
        quiet_s=0.05,
    )
    with pytest.raises(
        CutStreamError, match=r"the doorbell stopped after \d+ of 10 s of the recording"
    ):
        await _drain(muxed)
    assert 3 <= timing["cut"]["media_s"] <= 6
    # Before any picture: said so too.
    muxed = muxed_cut(
        _stream([media[:20]], hang=True),
        origin_unix=ORIGIN.timestamp(),
        timing={},
        quiet_s=0.05,
    )
    with pytest.raises(
        CutStreamError, match="stopped after 20 bytes, before a picture"
    ):
        await _drain(muxed)


async def test_a_quiet_device_at_the_recordings_end_is_its_end() -> None:
    """Everything came and the device went quiet without an end: done."""
    timing: dict[str, Any] = {}
    data = await _drain(
        muxed_cut(
            _stream(chunked(cut_media(), 700), hang=True),
            origin_unix=ORIGIN.timestamp(),
            timing=timing,
            length_s=12,
            quiet_s=0.05,
        )
    )
    assert timing["cut"]["ended"] == "quiet"
    assert _index(data).duration_ms == pytest.approx(10_000, abs=250)


async def test_a_failing_cut_is_named() -> None:
    """Any other failure of the cut says what it was."""
    muxed = muxed_cut(
        _stream([b"x"], fail=RuntimeError("refused")),
        origin_unix=ORIGIN.timestamp(),
        timing={},
    )
    with pytest.raises(
        CutStreamError, match="the doorbell's cut failed: RuntimeError: refused"
    ):
        await _drain(muxed)


async def test_a_far_clock_is_placed_at_once() -> None:
    """A key frame time far from the start is not held: placed at the start, at once."""
    media = cut_media(ORIGIN + timedelta(hours=5))
    parts = chunked(media, 700)
    sent: list[int] = []

    async def counted() -> AsyncGenerator[bytes]:
        for index, part in enumerate(parts):
            sent.append(index)
            yield part

    timing: dict[str, Any] = {}
    muxed = muxed_cut(counted(), origin_unix=ORIGIN.timestamp(), timing=timing)
    first = await anext(muxed)
    # Out well before the end of the cut (a held start waits for 30 key frames).
    assert len(sent) < len(parts)
    rest = await _drain(muxed)
    assert timing["cut"]["anchor"] == "asked time"
    assert _index(first + rest).duration_ms == pytest.approx(10_000, abs=250)


async def test_nothing_else_asks_the_host_during_its_cut(
    hass: HomeAssistant, tmp_path: Path
) -> None:
    """The cut runs alone: a picture or search asked meanwhile waits for its end."""
    host = QueueHost()
    source = MagicMock(entry_id="door", channel=0, key="door|0")
    first_ms = int(ORIGIN.timestamp() * 1000)
    recording = Recording(source, "sub", "one", first_ms, first_ms + 10_000)
    scheduler = Scheduler(default_limit=2, default_stream_limit=2)

    async def picture() -> None:
        host.order.append("picture")

    async with ClientSession() as session:
        with patch.object(bridge, "async_get_host", return_value=host):
            cache = VodCache(hass, scheduler, tmp_path / "vod", 10**9, lambda: session)
            await cache.async_setup()
            try:
                entry = await cache.async_open(recording)
                await host.opened.wait()
                asked = asyncio.ensure_future(
                    scheduler.run("door", picture, priority=Priority.THUMBNAILS)
                )
                await asyncio.sleep(0.01)
                assert host.order == ["open 00"]
                host.gate.set()
                await cache.async_wait(entry, complete=True)
                await asked
            finally:
                await cache.async_shutdown()
    await scheduler.async_shutdown()
    assert host.order == ["open 00", "close 00", "picture"]

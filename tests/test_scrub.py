"""Scrubbing that shows the picture (Phase 10 step 1): key frames from the server."""

import asyncio
from datetime import date
import io
import itertools
import json
from pathlib import Path
import struct
from typing import Any, cast
from unittest.mock import patch

from aiohttp import WSMsgType
import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry
from pytest_homeassistant_custom_component.typing import (
    ClientSessionGenerator,
    WebSocketGenerator,
)

from custom_components.reolink_viewer import baichuan_source, scrub, vodcache
from custom_components.reolink_viewer.baichuan_mux import BaichuanMuxer
from custom_components.reolink_viewer.baichuan_source import Cut, CutError
from custom_components.reolink_viewer.devices import PlaybackSource
from custom_components.reolink_viewer.fmp4 import (
    FragmentError,
    FragmentIndex,
    KeySample,
    child_boxes,
    init_tracks,
    key_sample,
)
from custom_components.reolink_viewer.scheduler import Priority, Scheduler
from custom_components.reolink_viewer.scrub import (
    KeyFrameStore,
    Picture,
    ScrubError,
    ScrubService,
)
from custom_components.reolink_viewer.thumbnails import ThumbKey, ThumbnailError
from custom_components.reolink_viewer.timeline import Day, Segment
from custom_components.reolink_viewer.vodcache import Recording, VodCache
from homeassistant.core import HomeAssistant

from .mp4_fixtures import FRAME, FRAMES, fragmented_av
from .test_baichuan_media import adts_frame, annexb
from .test_baichuan_mux import ASKED, ORIGIN, P, _frame, _h264_key
from .test_baichuan_source import (  # noqa: F401 - fixtures
    ASKED as CUT_ASKED,
    AT_MS,
    END_MS,
    START_MS,
    Rig,
    camera_blocks,
    nvr,
    rig,
)
from .test_playback_api import (  # noqa: F401 - fixtures
    DAY,
    SERVED,
    _camera_id,
    _ws,
    fixed_now,
    media_server,
    wired,
)
from .test_vodcache import SOURCE, cache, media, rec  # noqa: F401 - fixtures

# ---- One key frame out of a fragment (fmp4.key_sample) ----


def _muxed() -> list[bytes]:
    """A muxer's init and fragment: a key frame, audio, two frames."""
    muxer = BaichuanMuxer(ORIGIN, ASKED)
    pieces = muxer.feed(_h264_key(0, ASKED - 2))
    pieces += muxer.feed(_audio_block())
    pieces += muxer.feed(_frame(annexb(P), 100_000))
    pieces += muxer.feed(_frame(annexb(P), 200_000))
    pieces += muxer.finish()
    return pieces


def _audio_block() -> Any:
    from .test_baichuan_mux import _audio

    return _audio(adts_frame())


def _scan(data: bytes) -> FragmentIndex:
    index = FragmentIndex()
    index.scan(io.BytesIO(data), len(data))
    assert index.error is None, index.error
    return index


def test_a_key_frame_alone_from_the_muxer() -> None:
    init, fragment = _muxed()
    sample = key_sample(init, fragment)
    assert sample is not None
    assert sample.codec == "avc1.4D400C"
    assert sample.time_ms == (ASKED - 2 - ORIGIN) * 1000
    # The video track alone: no audio trak, one trex.
    assert set(init_tracks(sample.init)) == {1}
    assert init_tracks(init).keys() == {1, 2}
    # One sample, a sync one, at its own time; the index reads it as a fragment.
    index = _scan(sample.init + sample.fragment)
    (only,) = index.fragments
    assert only.sync
    assert only.start_ms == sample.time_ms
    mdat = dict(child_boxes(sample.fragment))["mdat"]
    assert mdat[:4] == struct.pack(">I", 5)  # the IDR, length-prefixed


def test_a_key_frame_alone_from_an_nvr_file() -> None:
    """The NVR's fragments, made MSE-ready, give their first video sample."""
    data = fragmented_av(4, absolute=True, tfdt=False, non_sync=frozenset({2}))
    index = _scan(data)
    assert index.init is not None
    with io.BytesIO(data) as file:
        second = index.read_fragment(file, 1)
        third = index.read_fragment(file, 2)
    sample = key_sample(index.init, second)
    assert sample is not None
    assert sample.decode == FRAMES * FRAME
    assert sample.time_ms == 2000
    assert sample.codec == "avc1.640033"
    mdat = dict(child_boxes(sample.fragment))["mdat"]
    assert len(mdat) == 100  # the first video sample, not the audio's
    # A fragment that does not start with a key frame has none to give.
    assert key_sample(index.init, third) is None
    # As stored (absolute offsets), a fragment is not read.
    raw_start = index.fragments[1].offset
    raw = data[raw_start : index.fragments[1].end]
    with pytest.raises(FragmentError, match="absolute base offset"):
        key_sample(index.init, raw)
    with pytest.raises(FragmentError, match="no moov"):
        key_sample(b"", second)


# ---- The store of key frames found ----


async def test_the_store_answers_nearby_moments_and_lets_old_ones_go(
    hass: HomeAssistant, tmp_path: Path
) -> None:
    left = tmp_path / "scrub"
    left.mkdir()
    (left / "old.kf").write_bytes(b"an earlier run's")
    store = KeyFrameStore(hass, left, max_bytes=260)
    await store.async_setup()
    assert not list(left.iterdir())
    pictures = [
        Picture(10_000 * i, "device", init=b"I" * 20, fragment=b"F" * 60, codec="c")
        for i in range(1, 4)
    ]
    for picture in pictures:
        await store.async_put("cam", picture)
    await store.async_put("cam", Picture(20_000, "thumbnail", jpeg=b"J"))  # not kept
    assert store.stats() == {"key_frames": 3, "bytes": 3 * 84}
    # The latest at or before a moment, within the reach given.
    assert store.near("cam", 21_500, 4_500) == 20_000
    assert store.near("cam", 24_500, 4_500) == 20_000
    assert store.near("cam", 24_501, 4_500) is None
    assert store.near("cam", 21_500, 1_000) is None  # a camera keyed every second
    # Never one after the moment: the one before it, if within reach.
    assert store.near("cam", 18_000, 9_000) == 10_000
    assert store.near("cam", 18_000, 4_500) is None
    assert store.near("cam", 9_000, 4_500) is None
    assert store.near("other", 20_000, 4_500) is None
    got = await store.async_get("cam", 20_000)
    assert got is not None
    assert (got.source, got.init, got.fragment, got.codec) == (
        "store",
        b"I" * 20,
        b"F" * 60,
        "c",
    )
    # Over the cap, the least recently used goes (10 s; 20 s was just read).
    await store.async_put(
        "cam", Picture(40_000, "cache", init=b"I" * 20, fragment=b"F" * 60)
    )
    assert store.near("cam", 10_000, 4_500) is None
    assert store.near("cam", 20_000, 4_500) == 20_000
    assert len(list(left.glob("*.kf"))) == 3
    # Kept twice at once (two sessions): one copy.
    twice = Picture(50_000, "cut", init=b"I", fragment=b"F")
    await asyncio.gather(store.async_put("cam", twice), store.async_put("cam", twice))
    assert store.near("cam", 50_000, 0) == 50_000
    assert sum(1 for k in store._files if k == ("cam", 50_000)) == 1
    assert store.stats()["bytes"] == sum(f.size for f in store._files.values())
    assert len(list(left.glob("*.kf"))) == store.stats()["key_frames"]
    # A file gone from disk is forgotten.
    for path in left.glob("*.kf"):
        path.unlink()
    assert await store.async_get("cam", 20_000) is None
    assert store.near("cam", 20_000, 4_500) is None


# ---- The service: store, cache, cut, thumbnail ----

DAY_START = 1_793_300_000_000
SEGMENT = Segment(DAY_START + 60_000, DAY_START + 3_660_000, "rec", 100, [])


class FakeTimeline:
    def __init__(self) -> None:
        self.asked: list[Any] = []

    async def async_day(
        self, source: Any, day: date, stream: str, *args: Any, **kwargs: Any
    ) -> tuple[Day, dict[str, Any]]:
        self.asked.append((day, stream, kwargs))
        return Day("2026-11-09", DAY_START, DAY_START + 86_400_000, [SEGMENT]), {}


class FakeCache:
    def __init__(self) -> None:
        self.sample: tuple[KeySample, str] | None = None
        self.asked: list[tuple[Recording, float]] = []

    async def async_key_frame(self, recording: Recording, at_ms: float) -> Any:
        self.asked.append((recording, at_ms))
        return self.sample


class FakeSource:
    def __init__(self) -> None:
        self.ok = True
        self.error: str | None = None
        self.asked: list[dict[str, Any]] = []
        self.interval: int | None = None

    def usable(self, entry_id: str) -> bool:
        return self.ok

    def key_interval_ms(self, entry_id: str, channel: int) -> int | None:
        return self.interval

    async def async_key_frame(self, **kwargs: Any) -> KeySample:
        self.asked.append(kwargs)
        if self.error:
            raise CutError(self.error)
        return _sample(kwargs["at_ms"] - 1000)


class FakeThumbnails:
    def __init__(self) -> None:
        self.fail = False

    def key(self, source: Any, when: int, bucket: int, stream: str) -> ThumbKey:
        return ThumbKey(source, stream, when - when % (bucket * 1000))

    async def async_get(self, key: ThumbKey, priority: Priority) -> bytes:
        assert priority is Priority.PLAYBACK
        if self.fail:
            raise ThumbnailError("snapshot failed")
        return b"\xff\xd8 a jpeg"


def _sample(media_ms: float) -> KeySample:
    return KeySample(b"init", b"frag", round(media_ms * 90), 90_000, "avc1.640033")


@pytest.fixture
async def service(
    hass: HomeAssistant, tmp_path: Path
) -> tuple[ScrubService, FakeTimeline, FakeCache, FakeSource, FakeThumbnails]:
    timeline, cache_, source, thumbs = (
        FakeTimeline(),
        FakeCache(),
        FakeSource(),
        FakeThumbnails(),
    )
    store = KeyFrameStore(hass, tmp_path / "scrub", 10**6)
    await store.async_setup()
    svc = ScrubService(
        hass,
        timeline=cast(Any, timeline),
        cache=cast(Any, cache_),
        baichuan=cast(Any, source),
        thumbnails=cast(Any, thumbs),
        store=store,
    )
    return svc, timeline, cache_, source, thumbs


CAMERA = PlaybackSource("cam1", "Garage", "entry1", 16)
DAY_DATE = date(2026, 11, 9)


async def test_a_picture_from_the_cache_then_the_store(service: Any) -> None:
    svc, timeline, cache_, source, _thumbs = service
    at = SEGMENT.start + 125_000
    cache_.sample = (_sample(124_000), "file")
    picture = await svc.async_picture(CAMERA, DAY_DATE, at)
    assert picture.source == "cache"
    assert picture.time_ms == SEGMENT.start + 124_000
    assert (picture.init, picture.fragment, picture.codec) == (
        b"init",
        b"frag",
        "avc1.640033",
    )
    assert picture.timing["ms"] >= 0
    (recording, media_ms) = cache_.asked[0]
    assert (recording.stream, recording.name, recording.start_ms) == (
        "sub",
        "rec",
        SEGMENT.start,
    )
    assert media_ms == 125_000
    # The day as the browser has it: never searched again for a scrub.
    assert timeline.asked[0][1] == "sub"
    assert timeline.asked[0][2]["max_age"] == scrub.DAY_MAX_AGE_S
    # The next moment near it: from the store, with nothing else asked.
    again = await svc.async_picture(CAMERA, DAY_DATE, at + 1500)
    assert again.source == "store"
    assert again.time_ms == picture.time_ms
    assert len(cache_.asked) == 1
    assert not source.asked
    # A cut of the recording on disk says so.
    cache_.sample = (_sample(600_000), "cut")
    cut = await svc.async_picture(CAMERA, DAY_DATE, SEGMENT.start + 600_500)
    assert cut.source == "cut"
    assert svc.stats()["answered"] == {"cache": 1, "store": 1, "cut": 1}
    assert svc.stats()["store"]["key_frames"] == 2


async def test_a_picture_from_the_device_or_the_thumbnail(service: Any) -> None:
    svc, _timeline, _cache, source, thumbs = service
    at = SEGMENT.start + 300_000
    picture = await svc.async_picture(CAMERA, DAY_DATE, at)
    assert picture.source == "device"
    assert picture.time_ms == at - 1000
    assert source.asked == [
        {
            "entry_id": "entry1",
            "channel": 16,
            "start_ms": SEGMENT.start,
            "end_ms": SEGMENT.end,
            "at_ms": 300_000,
        }
    ]
    # Within the camera's interval of it (4 s until known, and half a second).
    assert (await svc.async_picture(CAMERA, DAY_DATE, at + 3_500)).source == "store"
    # A camera keyed every second: a moment 2 s after it is a new picture.
    source.interval = 1_000
    later = await svc.async_picture(CAMERA, DAY_DATE, at + 1_000)
    assert later.source == "device"
    assert later.time_ms == at
    source.interval = None
    # The device's cut fails: no picture, said plainly; nothing kept.
    source.error = "no key frame within 1 s"
    with pytest.raises(ScrubError, match="no picture from the device: no key frame"):
        await svc.async_picture(CAMERA, DAY_DATE, at + 600_000)
    # The protocol cannot be used: the thumbnail instead (not kept).
    source.ok = False
    thumb = await svc.async_picture(CAMERA, DAY_DATE, at + 1_200_003)
    assert thumb.kind == "jpeg"
    assert thumb.source == "thumbnail"
    assert thumb.time_ms == at + 1_200_000
    assert thumb.jpeg.startswith(b"\xff\xd8")
    thumbs.fail = True
    with pytest.raises(ScrubError, match="snapshot failed"):
        await svc.async_picture(CAMERA, DAY_DATE, at + 1_800_000)
    # Between recordings: nothing asked of anyone.
    asked = len(source.asked)
    with pytest.raises(ScrubError, match="no recording at that moment"):
        await svc.async_picture(CAMERA, DAY_DATE, SEGMENT.end + 1)
    assert len(source.asked) == asked
    assert svc.stats()["answered"] == {
        "device": 2,
        "store": 1,
        "none": 2,
        "thumbnail": 1,
        "gap": 1,
    }


def test_the_message_to_the_browser() -> None:
    picture = Picture(
        5_000,
        "cache",
        init=b"INIT",
        fragment=b"FRAGMENT",
        codec="avc1",
        timing={"ms": 3},
    )
    raw = picture.message(7, 5_400)
    (length,) = struct.unpack_from(">I", raw)
    header = json.loads(raw[4 : 4 + length])
    assert header == {
        "seq": 7,
        "at": 5_400,
        "time": 5_000,
        "source": "cache",
        "kind": "fmp4",
        "codec": "avc1",
        "init": 4,
        "data": 8,
        "timing": {"ms": 3},
    }
    assert raw[4 + length :] == b"INITFRAGMENT"
    jpeg = Picture(5_000, "thumbnail", jpeg=b"JPEG").message(8, 5_000)
    (length,) = struct.unpack_from(">I", jpeg)
    assert json.loads(jpeg[4 : 4 + length])["kind"] == "jpeg"
    assert jpeg[4 + length :] == b"JPEG"


# ---- A key frame from what the cache holds ----


async def test_the_cache_gives_a_key_frame_from_disk_without_fetching(
    cache: tuple[VodCache, Scheduler, Any],  # noqa: F811
) -> None:
    vc, _scheduler, host = cache
    recording = rec("frag")
    # Not on disk: nothing, and no download started.
    assert await vc.async_key_frame(recording, 5_000) is None
    assert vc.entry(recording) is None
    assert not host.calls
    # A complete copy on disk from an earlier run.
    path = vc._dir / f"{recording.cache_id}{vodcache.SUFFIX}"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(fragmented_av(5, absolute=True, tfdt=False))
    found = await vc.async_key_frame(recording, 5_000)
    assert found is not None
    sample, where = found
    assert where == "file"
    assert sample.time_ms == 4_000  # the fragment from 4 s, its key frame
    entry = vc.entry(recording)
    assert entry is not None
    assert entry.complete
    assert entry.readers == 0
    assert not host.calls
    # Past what it holds: nothing.
    assert await vc.async_key_frame(recording, 11_000) is None


async def test_the_cache_gives_a_key_frame_from_a_cut(
    cache: tuple[VodCache, Scheduler, Any],  # noqa: F811
    tmp_path: Path,
) -> None:
    vc, _scheduler, _host = cache
    recording = rec("frag")
    path = vc._dir / f"{recording.cache_id}{vodcache.SUFFIX}"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(fragmented_av(2, absolute=True, tfdt=False))
    assert await vc.async_key_frame(recording, 1_000) is not None
    entry = vc.entry(recording)
    assert entry is not None
    # A cut of the recording 45 minutes in (the muxer's media time).
    pieces = _muxed()
    cut_path = tmp_path / "x.cut.mp4"
    cut_path.write_bytes(b"".join(pieces))
    cut = Cut("entry1", 16, "sub", cut_path, 0.0)
    cut.index.scan(io.BytesIO(b"".join(pieces)), len(b"".join(pieces)))
    entry.cut = cut
    at = (ASKED - 2 - ORIGIN) * 1000 + 50
    found = await vc.async_key_frame(recording, at)
    assert found is not None
    sample, where = found
    assert where == "cut"
    assert sample.time_ms == at - 50
    assert cut.readers == 0
    # Too far past the key frame (no cut holds that moment): nothing.
    assert await vc.async_key_frame(recording, at + 3_600_000) is None


# ---- The scrub cut (the device) ----


async def test_a_scrub_cut_gives_the_key_frame_near_the_moment(rig: Rig) -> None:  # noqa: F811
    sample = await rig.source.async_key_frame(
        entry_id="entry1", channel=3, start_ms=START_MS, end_ms=END_MS, at_ms=AT_MS
    )
    # The cut begins 3 s before the moment (the fake NVR's media): the key
    # frame at the moment is the one kept, once one past it came.
    assert sample.time_ms == AT_MS
    assert rig.source.key_interval_ms("entry1", 3) == 1000
    assert sample.codec == "avc1.4D400C"
    assert set(init_tracks(sample.init)) == {1}
    # 2 s of the sub stream from the moment, in the device's local time; ended.
    xml = next(x for c, x in rig.nvr.requests if c == 143)
    assert "<hour>22</hour>\n<minute>10</minute>\n<second>0</second>" in xml
    assert "<hour>22</hour>\n<minute>10</minute>\n<second>2</second>" in xml
    assert "<streamType>subStream</streamType>" in xml
    assert rig.nvr.ended == [4]
    assert rig.source.stats()["scrub_cuts"] == {
        "asked": 1,
        "answered": 1,
        "failed": 0,
        "stale": 0,
    }
    # Its slot is given back.
    assert rig.scheduler.host("entry1").streams.stats()["streams"] == 0


async def test_a_scrub_cut_passes_another_cuts_key_frames_by(rig: Rig) -> None:  # noqa: F811
    # What a cut ten minutes earlier still sends, then this cut's own media.
    rig.nvr.media = camera_blocks(CUT_ASKED - 600, seconds=2) + camera_blocks(
        CUT_ASKED - 1
    )
    sample = await rig.source.async_key_frame(
        entry_id="entry1", channel=3, start_ms=START_MS, end_ms=END_MS, at_ms=AT_MS
    )
    assert sample.time_ms == AT_MS
    assert rig.source.stats()["scrub_cuts"]["stale"] == 2


async def test_a_scrub_cut_that_ends_before_the_moment_keeps_its_last(
    rig: Rig,  # noqa: F811
) -> None:
    # The cut ends (its end marker) 1 s before the moment: its last key frame.
    rig.nvr.media = camera_blocks(CUT_ASKED - 3, seconds=3)
    sample = await rig.source.async_key_frame(
        entry_id="entry1", channel=3, start_ms=START_MS, end_ms=END_MS, at_ms=AT_MS
    )
    assert sample.time_ms == AT_MS - 1000
    # The device goes quiet before one past the moment: what came is kept.
    rig.nvr.silent = True
    with patch.object(baichuan_source, "SCRUB_KEY_TIMEOUT_S", 0.3):
        sample = await rig.source.async_key_frame(
            entry_id="entry1", channel=3, start_ms=START_MS, end_ms=END_MS, at_ms=AT_MS
        )
    assert sample.time_ms == AT_MS - 1000


async def test_a_scrub_cut_fails_plainly(rig: Rig) -> None:  # noqa: F811
    # Only another cut's key frames: none near the moment within its time.
    rig.nvr.media = camera_blocks(CUT_ASKED - 600)
    with (
        patch.object(baichuan_source, "SCRUB_KEY_TIMEOUT_S", 0.3),
        pytest.raises(CutError, match=r"no key frame within 0\.3 s"),
    ):
        await rig.source.async_key_frame(
            entry_id="entry1", channel=3, start_ms=START_MS, end_ms=END_MS, at_ms=AT_MS
        )
    assert rig.nvr.ended == [4]  # ended all the same
    # No stream slot: live view holds them.
    held = [
        rig.scheduler.host("entry1").streams.request(Priority.LIVE) for _ in range(2)
    ]
    with (
        patch.object(baichuan_source, "SCRUB_SLOT_WAIT_S", 0.05),
        pytest.raises(CutError, match="no stream slot"),
    ):
        await rig.source.async_key_frame(
            entry_id="entry1", channel=3, start_ms=START_MS, end_ms=END_MS, at_ms=AT_MS
        )
    for ticket in held:
        ticket.release()
    # The option off: not asked at all.
    rig.on = False
    assert not rig.source.usable("entry1")
    with pytest.raises(CutError, match="off"):
        await rig.source.async_key_frame(
            entry_id="entry1", channel=3, start_ms=START_MS, end_ms=END_MS, at_ms=AT_MS
        )
    assert rig.source.stats()["scrub_cuts"]["failed"] == 2


async def test_a_scrub_takes_the_turn_of_a_playing_cut_which_goes_on(
    rig: Rig,  # noqa: F811
) -> None:
    """The playing cut gives way at its next block, then resumes, unharmed."""
    rig.nvr.media = camera_blocks(CUT_ASKED - 3, seconds=20)
    rig.nvr.gate = asyncio.Event()
    rig.nvr.gate_at = 8
    playing = await rig.cut(channel=3, name="a")

    async def has_fragment() -> None:
        while not playing.index.fragments:  # noqa: ASYNC110
            await asyncio.sleep(0.01)

    async with asyncio.timeout(5):
        await has_fragment()
    with patch.object(baichuan_source, "SCRUB_DRAIN_S", 0.05):
        sample = await rig.source.async_key_frame(
            entry_id="entry1", channel=3, start_ms=START_MS, end_ms=END_MS, at_ms=AT_MS
        )
    assert sample.time_ms == AT_MS
    assert playing.gave_way == 1
    rig.nvr.gate.set()
    assert playing.task is not None
    async with asyncio.timeout(10):
        await asyncio.shield(playing.task)
    assert playing.complete, playing.error
    starts = [(f.start_ms, f.duration_ms) for f in playing.index.fragments]
    for (start, length), (following, _length) in itertools.pairwise(starts):
        assert abs(start + length - following) < 1


# ---- The muxer lets another cut's leftovers pass ----


def test_a_resumed_span_skips_another_cuts_blocks() -> None:
    muxer = BaichuanMuxer(ORIGIN, ASKED)
    out: list[bytes] = []
    for i in range(10):
        block = (
            _h264_key(i * 100_000, ASKED) if i == 0 else _frame(annexb(P), i * 100_000)
        )
        out += muxer.feed(block)
    muxer.pause()
    # A scrub's blocks of ten minutes later still arrive: skipped.
    far = 600 * 1_000_000
    out += muxer.feed(_h264_key(far, ASKED + 600))
    out += muxer.feed(_frame(annexb(P), far + 100_000))
    assert muxer.stats.foreign_skipped == 2
    # Then this stream's own, joined where it left off.
    out += muxer.feed(_frame(annexb(P), 1_000_000))
    out += muxer.feed(_h264_key(1_100_000, ASKED + 1))
    out += muxer.finish()
    index = _scan(b"".join(out))
    assert [round(f.start_ms) for f in index.fragments] == [
        (ASKED - ORIGIN) * 1000,
        (ASKED - ORIGIN) * 1000 + 1100,
    ]
    assert muxer.stats.as_dict()["foreign_skipped"] == 2
    # Many in a row are the stream's own jump, not leftovers.
    other = BaichuanMuxer(ORIGIN, ASKED)
    other.feed(_h264_key(0, ASKED))
    other.pause()
    for i in range(40):
        other.feed(_frame(annexb(P), far + i * 100_000))
    assert other.stats.foreign_skipped == 30
    assert other.stats.frames == 10


# ---- The session, end to end ----


async def test_a_scrub_session_end_to_end(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    hass_client_no_auth: ClientSessionGenerator,
    wired: MockConfigEntry,  # noqa: F811
) -> None:
    SERVED["body"] = fragmented_av(20, absolute=True, tfdt=False)
    client = await hass_ws_client(hass)
    camera = await _camera_id(client)
    day = (
        await _ws(
            client,
            {"type": "reolink_viewer/timeline/day", "device_id": camera, "date": DAY},
        )
    )["result"]
    segment = day["segments"][0]
    # The recording cached, as a player's start makes it.
    ref = {"device_id": camera, "date": DAY, "segment_id": segment["id"]}
    await _ws(client, {"type": "reolink_viewer/playback/mse", **ref})
    data = wired.runtime_data
    entry = next(iter(data.vod_cache._entries.values()))
    await data.vod_cache.async_wait(entry, complete=True)

    msg = await _ws(
        client,
        {"type": "reolink_viewer/playback/scrub", "device_id": camera, "date": DAY},
    )
    url = msg["result"]["url"]
    assert url.startswith("/api/reolink_viewer/scrub/")
    assert "authSig=" in url
    assert msg["result"]["expires_in"] == 600
    http = await hass_client_no_auth()
    assert (await http.get(url.split("?")[0])).status == 401

    async def ask(socket: Any, seq: int, at: int) -> tuple[dict[str, Any], bytes]:
        await socket.send_json({"seq": seq, "at": at})
        reply = await socket.receive(timeout=10)
        if reply.type is WSMsgType.TEXT:
            return json.loads(reply.data), b""
        assert reply.type is WSMsgType.BINARY
        (length,) = struct.unpack_from(">I", reply.data)
        header = json.loads(reply.data[4 : 4 + length])
        return header, reply.data[4 + length :]

    async with http.ws_connect(url) as socket:
        header, body = await ask(socket, 1, segment["start"] + 5_000)
        assert header["seq"] == 1
        assert header["source"] == "cache"
        assert header["kind"] == "fmp4"
        assert header["time"] == segment["start"] + 4_000
        assert header["codec"] == "avc1.640033"
        init, fragment = body[: header["init"]], body[header["init"] :]
        assert len(fragment) == header["data"]
        sample = key_sample(init, fragment)
        assert sample is not None
        assert set(init_tracks(init)) == {1}
        # Again nearby: from the store.
        header, _body = await ask(socket, 2, segment["start"] + 6_000)
        assert header["source"] == "store"
        # An older request than the last is ignored; a gap is said plainly.
        await socket.send_json({"seq": 1, "at": segment["start"]})
        await socket.send_json({"not": "a request"})
        header, _body = await ask(socket, 3, segment["start"] - 60_000)
        assert header == {
            "seq": 3,
            "at": segment["start"] - 60_000,
            "error": "no recording at that moment",
        }
    stats = await _ws(client, {"type": "reolink_viewer/playback/stats"})
    assert stats["result"]["scrub"]["answered"] == {"cache": 1, "store": 1, "gap": 1}

    # A newer moment cancels the one in flight, which is never answered.
    gate = asyncio.Event()
    real = data.scrub.async_picture

    async def slow(source: Any, day_: Any, at: int) -> Picture:
        if at == 1:
            await gate.wait()
        picture: Picture = await real(source, day_, at)
        return picture

    with patch.object(data.scrub, "async_picture", side_effect=slow):
        async with http.ws_connect(url) as socket:
            await socket.send_json({"seq": 1, "at": 1})
            await asyncio.sleep(0.05)
            header, _body = await ask(socket, 2, segment["start"] + 5_000)
            assert header["seq"] == 2
            gate.set()
            with pytest.raises(TimeoutError):
                await socket.receive(timeout=0.3)

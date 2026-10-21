"""The key-frame cache (live/relay.py) against a fake go2rtc websocket."""

import asyncio
from collections.abc import AsyncIterator, Generator
import contextlib
import json
from types import SimpleNamespace
from typing import Any
from unittest.mock import patch

from aiohttp import WSMsgType
import pytest

from custom_components.reolink_viewer.bridge import CameraUrl, LiveProtocol
from custom_components.reolink_viewer.devices import LiveSource
from custom_components.reolink_viewer.live import relay as relay_module
from custom_components.reolink_viewer.live.relay import (
    MseRelay,
    Viewer,
    compare_parameter_sets,
    init_parameter_sets,
    sample_parameter_sets,
)
from custom_components.reolink_viewer.live.streams import (
    LiveError,
    LiveStream,
    StreamRegistry,
)
from custom_components.reolink_viewer.scheduler import Scheduler
from homeassistant.core import HomeAssistant

from .conftest import TEST_PASSWORD
from .mp4_fixtures import (
    AUDIO_FRAME,
    FRAME,
    HEVC_IDR,
    HEVC_PPS,
    HEVC_SPS,
    IDR,
    P_SLICE,
    PPS,
    SPS,
    VPS,
    go2rtc_audio_init,
    go2rtc_fragment,
    go2rtc_init,
    hvcc,
    nals,
    visual_entry,
)

SOURCE = LiveSource(
    camera_id="cam",
    connection_id="conn1",
    name="Garage",
    entry_id="entry1",
    channel=0,
    via="nvr",
    is_battery=False,
)
SUB = LiveStream(SOURCE, "sub")
H264_AAC = 'video/mp4; codecs="avc1.64001F,mp4a.40.2"'
CHROME = "avc1.640029,avc1.64002A,avc1.640033,hvc1.1.6.L153.B0,mp4a.40.2,flac,opus"


class FakeSocket:
    """go2rtc's websocket for one stream: what it was sent, what it sends."""

    def __init__(self) -> None:
        self.sent: list[Any] = []
        self.inbox: asyncio.Queue[Any] = asyncio.Queue()
        self.closed = False

    async def send_json(self, data: Any) -> None:
        self.sent.append(data)

    def __aiter__(self) -> FakeSocket:
        return self

    async def __anext__(self) -> Any:
        message = await self.inbox.get()
        if message is None:
            raise StopAsyncIteration
        return message

    def text(self, data: Any) -> None:
        self.inbox.put_nowait(
            SimpleNamespace(type=WSMsgType.TEXT, data=json.dumps(data))
        )

    def binary(self, data: bytes) -> None:
        self.inbox.put_nowait(SimpleNamespace(type=WSMsgType.BINARY, data=data))

    def end(self) -> None:
        self.inbox.put_nowait(None)


class FakeServer:
    """What the registry and the relay need of Go2rtcServer."""

    def __init__(self) -> None:
        self.generation = 1
        self.streams: dict[str, str] = {}
        self.sockets: list[FakeSocket] = []
        self.answer: Any = {"type": "mse", "value": H264_AAC}
        self.opened = asyncio.Event()

    async def async_ready(self) -> None:
        return None

    async def async_set_stream(self, name: str, source: str) -> None:
        self.streams[name] = source

    @contextlib.asynccontextmanager
    async def ws(self, name: str) -> AsyncIterator[FakeSocket]:
        socket = FakeSocket()
        self.sockets.append(socket)
        self.opened.set()
        if self.answer is not None:
            socket.text(self.answer)
        try:
            yield socket
        finally:
            socket.closed = True


class FakeHost:
    async def async_live_url(
        self, channel: int, protocol: LiveProtocol, stream: str
    ) -> CameraUrl | None:
        return CameraUrl(f"{protocol.value}://u:{TEST_PASSWORD}@cam/{stream}")


@pytest.fixture
def setup(
    hass: HomeAssistant,
) -> Generator[tuple[MseRelay, FakeServer, Scheduler]]:
    server = FakeServer()
    scheduler = Scheduler(default_limit=2, default_stream_limit=2)
    registry = StreamRegistry(hass, scheduler, server)  # type: ignore[arg-type]

    async def get_server() -> Any:
        return server

    relay = MseRelay(hass, registry, get_server)
    with patch(
        "custom_components.reolink_viewer.bridge.async_get_host",
        return_value=FakeHost(),
    ):
        yield relay, server, scheduler


def slots(scheduler: Scheduler) -> int:
    return int(scheduler.host("entry1").streams.stats()["streams"])


def video(index: int, *, key: bool) -> bytes:
    sample = nals(SPS, PPS, IDR) if key else nals(P_SLICE)
    return go2rtc_fragment(index, 1, index * FRAME, sample, key=key)


def audio(index: int) -> bytes:
    return go2rtc_fragment(
        index, 2, index * AUDIO_FRAME, bytes(40), duration=AUDIO_FRAME
    )


async def drain(viewer: Viewer) -> bytes:
    """Everything the viewer has waiting (after the feed handled its input)."""
    for _ in range(6):
        await asyncio.sleep(0)
    data = await asyncio.wait_for(viewer.next(), 1)
    assert data is not None, viewer.error
    return data


async def settle() -> None:
    for _ in range(10):
        await asyncio.sleep(0)


# ---- Parameter sets ----


def test_parameter_sets() -> None:
    """The init's sets against a key frame's: same, differ, none, unknown."""
    found = init_parameter_sets(go2rtc_init())
    assert found is not None
    types, length, sets = found
    assert length == 4
    assert sets == {SPS, PPS}
    same = sample_parameter_sets(nals(SPS, PPS, IDR), types, length)
    assert compare_parameter_sets(sets, same) == "same"
    other = bytes([0x67, 0x64, 0x00, 0x1E]) + SPS[4:]
    differ = sample_parameter_sets(nals(other, PPS, IDR), types, length)
    assert compare_parameter_sets(sets, differ) == "differ"
    assert compare_parameter_sets(sets, sample_parameter_sets(nals(IDR), types, 4)) == (
        "none"
    )
    broken = sample_parameter_sets(b"\0\0\1\0" + IDR, types, length)
    assert compare_parameter_sets(sets, broken) == "unknown"
    # H.265: VPS, SPS and PPS from the hvcC arrays.
    hevc = go2rtc_init(
        visual_entry("hvc1", 3840, 2160, hvcc(VPS, HEVC_SPS, HEVC_PPS)), audio=False
    )
    found = init_parameter_sets(hevc)
    assert found is not None
    types, length, sets = found
    assert sets == {VPS, HEVC_SPS, HEVC_PPS}
    stream = sample_parameter_sets(nals(VPS, HEVC_SPS, HEVC_PPS, HEVC_IDR), types, 4)
    assert compare_parameter_sets(sets, stream) == "same"
    assert init_parameter_sets(go2rtc_audio_init()) is None


# ---- Feeds ----


async def test_a_viewer_starts_at_the_cached_key_frame(
    setup: tuple[MseRelay, FakeServer, Scheduler],
) -> None:
    """A second viewer gets the init and the frames since the key frame at once."""
    relay, server, scheduler = setup
    first = await relay.async_attach(SUB, CHROME)
    assert first.mime == H264_AAC
    (socket,) = server.sockets
    assert socket.sent == [{"type": "mse", "value": CHROME}]
    assert server.streams[SUB.name].startswith("rtsp://")
    assert slots(scheduler) == 1
    init = go2rtc_init()
    frames = [video(1, key=True), audio(1), video(2, key=False), video(3, key=False)]
    socket.binary(init)
    for fragment in frames:
        socket.binary(fragment)
    assert await drain(first) == init + b"".join(frames)

    second = await relay.async_attach(SUB, CHROME)
    assert len(server.sockets) == 1  # shared
    assert await drain(second) == init + b"".join(frames)
    # Both get what comes next.
    socket.binary(video(4, key=False))
    assert await drain(first) == video(4, key=False)
    assert await drain(second) == video(4, key=False)
    # A new key frame starts the cache again.
    socket.binary(video(5, key=True) + audio(2))  # two fragments in one message
    await drain(first)
    third = await relay.async_attach(SUB, CHROME)
    assert await drain(third) == init + video(5, key=True) + audio(2)

    state = relay.state(SUB)
    assert state is not None
    assert state["viewers"] == 3
    assert state["parameter_sets"] == "same"
    assert state["cached_ms"] == 40  # the key frame: one frame at 25 fps
    assert state["key_interval_ms"] is not None
    assert state["cached_bytes"] == len(video(5, key=True) + audio(2))

    for viewer in (first, second, third):
        viewer.detach()
    await settle()
    assert socket.closed  # the last viewer left: the feed closed
    assert relay.state(SUB) is None
    assert slots(scheduler) == 0


async def test_a_viewer_waits_for_the_first_key_frame(
    setup: tuple[MseRelay, FakeServer, Scheduler],
) -> None:
    """Before any key frame, a viewer gets nothing; then the init and it."""
    relay, server, _scheduler = setup
    viewer = await relay.async_attach(SUB, CHROME)
    (socket,) = server.sockets
    socket.binary(go2rtc_init())
    socket.binary(video(1, key=False))
    await settle()
    socket.binary(video(2, key=True))
    assert await drain(viewer) == go2rtc_init() + video(2, key=True)
    await relay.async_shutdown()
    assert socket.closed
    assert viewer.closed


async def test_feeds_are_shared_by_codecs(
    setup: tuple[MseRelay, FakeServer, Scheduler],
) -> None:
    """A viewer that cannot play a codec of the feed gets a feed of its own."""
    relay, server, scheduler = setup
    server.answer = {"type": "mse", "value": 'video/mp4; codecs="hvc1.1.6.L153.B0"'}
    hevc = await relay.async_attach(SUB, CHROME)
    no_hevc = "avc1.640029,mp4a.40.2"
    server.answer = {"type": "mse", "value": 'video/mp4; codecs="avc1.640029"'}
    other = await relay.async_attach(SUB, no_hevc)
    assert len(server.sockets) == 2
    assert other.mime.endswith('"avc1.640029"')
    # One stream, one slot, however many feeds read it.
    assert slots(scheduler) == 1
    again = await relay.async_attach(SUB, no_hevc)
    assert len(server.sockets) == 2
    for viewer in (hevc, other, again):
        viewer.detach()
    await settle()
    assert slots(scheduler) == 0


async def test_an_error_from_go2rtc(
    setup: tuple[MseRelay, FakeServer, Scheduler],
) -> None:
    """go2rtc's error is the viewer's, without the camera URL; the slot is free."""
    relay, server, scheduler = setup
    server.answer = {
        "type": "error",
        "value": f"streams: dial rtsp://admin:{TEST_PASSWORD}@192.0.2.7:554: refused",
    }
    with pytest.raises(LiveError) as err:
        await relay.async_attach(SUB, CHROME)
    assert TEST_PASSWORD not in str(err.value)
    assert "192.0.2.7" not in str(err.value)
    assert "refused" in str(err.value)
    await settle()
    assert slots(scheduler) == 0
    # It ends while viewers watch: they get the error.
    server.answer = {"type": "mse", "value": H264_AAC}
    viewer = await relay.async_attach(SUB, CHROME)
    server.sockets[-1].text({"type": "error", "value": "EOF"})
    assert await asyncio.wait_for(viewer.next(), 1) is None
    assert viewer.error == "EOF"
    await settle()
    assert slots(scheduler) == 0


async def test_no_answer(
    setup: tuple[MseRelay, FakeServer, Scheduler],
) -> None:
    """go2rtc that does not answer in time fails the viewer, not the relay."""
    relay, server, scheduler = setup
    server.answer = None
    with (
        patch.object(relay_module, "OPEN_TIMEOUT", 0.05),
        pytest.raises(LiveError, match="did not answer"),
    ):
        await relay.async_attach(SUB, CHROME)
    await settle()
    assert slots(scheduler) == 0
    # Media that cannot be read ends the feed the same way.
    server.answer = {"type": "mse", "value": H264_AAC}
    viewer = await relay.async_attach(SUB, CHROME)
    server.sockets[-1].binary(b"\0\0\0\x10mdat" + bytes(8))
    assert await asyncio.wait_for(viewer.next(), 1) is None
    assert viewer.error is not None
    assert "header" in viewer.error


async def test_a_slow_viewer_is_dropped(
    setup: tuple[MseRelay, FakeServer, Scheduler],
) -> None:
    """Data waiting longer than MAX_BEHIND_S drops the viewer, not the feed."""
    relay, server, _scheduler = setup
    slow = await relay.async_attach(SUB, CHROME)
    fast = await relay.async_attach(SUB, CHROME)
    (socket,) = server.sockets
    with patch.object(relay_module, "MAX_BEHIND_S", -1.0):
        socket.binary(go2rtc_init() + video(1, key=True))
        await drain(fast)
        socket.binary(video(2, key=False))
        await settle()
    assert slow.closed
    assert slow.error == "the connection is too slow for this stream"
    assert not fast.closed
    assert await drain(fast) == video(2, key=False)
    await relay.async_shutdown()


async def test_a_cache_without_key_frames_is_dropped(
    setup: tuple[MseRelay, FakeServer, Scheduler],
) -> None:
    """Past MAX_GOP_BYTES since the key frame, nothing is kept."""
    relay, server, _scheduler = setup
    first = await relay.async_attach(SUB, CHROME)
    (socket,) = server.sockets
    with patch.object(relay_module, "MAX_GOP_BYTES", len(video(1, key=True)) + 10):
        socket.binary(go2rtc_init() + video(1, key=True) + video(2, key=False))
        await drain(first)
    state = relay.state(SUB)
    assert state is not None
    assert state["cached_bytes"] == 0
    late = await relay.async_attach(SUB, CHROME)
    socket.binary(video(3, key=False))
    await drain(first)
    socket.binary(video(4, key=True))
    assert await drain(late) == go2rtc_init() + video(4, key=True)
    await relay.async_shutdown()


async def test_audio_only(
    setup: tuple[MseRelay, FakeServer, Scheduler],
) -> None:
    """Without video, any fragment is a place to start."""
    relay, server, _scheduler = setup
    server.answer = {"type": "mse", "value": 'audio/mp4; codecs="opus"'}
    first = await relay.async_attach(SUB, "opus")
    (socket,) = server.sockets
    init = go2rtc_audio_init()
    one = go2rtc_fragment(1, 1, 0, bytes(40), duration=AUDIO_FRAME)
    two = go2rtc_fragment(2, 1, AUDIO_FRAME, bytes(40), duration=AUDIO_FRAME)
    socket.binary(init + one + two)
    assert await drain(first) == init + one + two
    second = await relay.async_attach(SUB, "opus")
    assert await drain(second) == init + two
    state = relay.state(SUB)
    assert state is not None
    assert state["parameter_sets"] is None
    await relay.async_shutdown()


# ---- Keeping warm ----


async def test_keep_warm(
    hass: HomeAssistant,
    setup: tuple[MseRelay, FakeServer, Scheduler],
) -> None:
    """A warm feed stays without viewers, comes back after go2rtc drops it."""
    relay, server, scheduler = setup

    async def first_frames() -> None:
        await server.opened.wait()
        server.sockets[0].binary(go2rtc_init() + video(1, key=True))

    task = asyncio.create_task(first_frames())
    assert await relay.async_keep_warm(SUB, True) is True
    await task
    assert relay.warm_streams() == [SUB.name]
    assert server.sockets[0].sent == [
        {"type": "mse", "value": relay_module.WARM_CODECS}
    ]
    assert slots(scheduler) == 1
    state = relay.state(SUB)
    assert state is not None
    assert state["warm"] is True
    # A viewer joins the warm feed at its key frame; leaving does not close it.
    viewer = await relay.async_attach(SUB, CHROME)
    assert await drain(viewer) == go2rtc_init() + video(1, key=True)
    viewer.detach()
    await settle()
    assert not server.sockets[0].closed
    # Already warm: nothing new (no key frame wait beyond the cached one).
    assert await relay.async_keep_warm(SUB, True, key_frame_timeout=0.05) is True
    assert len(server.sockets) == 1

    # go2rtc drops it (a restart: it forgot the stream): opened again, registered
    # again.
    server.generation += 1
    server.streams.clear()
    with patch.object(relay_module, "RETRY_S", (0.0,)):
        server.sockets[0].end()
        for _ in range(100):
            await asyncio.sleep(0.01)
            if len(server.sockets) == 2:
                break
    await settle()
    assert len(server.sockets) == 2
    assert SUB.name in server.streams
    assert slots(scheduler) == 1
    assert relay.warm_streams() == [SUB.name]

    await relay.async_keep_warm(SUB, False)
    await settle()
    assert server.sockets[1].closed
    assert relay.warm_streams() == []
    assert slots(scheduler) == 0
    await relay.async_keep_warm(SUB, False)  # not warm: nothing to do


async def test_keep_warm_fails(
    setup: tuple[MseRelay, FakeServer, Scheduler],
) -> None:
    """A stream that cannot open is not kept warm; no key frame in time is said."""
    relay, server, scheduler = setup
    server.answer = {"type": "error", "value": "dial tcp: connection refused"}
    with pytest.raises(LiveError, match="connection refused"):
        await relay.async_keep_warm(SUB, True)
    assert relay.warm_streams() == []
    await settle()
    assert slots(scheduler) == 0
    server.answer = {"type": "mse", "value": H264_AAC}
    assert await relay.async_keep_warm(SUB, True, key_frame_timeout=0.05) is False
    assert relay.warm_streams() == [SUB.name]
    await relay.async_shutdown()
    await settle()
    assert slots(scheduler) == 0
    assert relay.warm_streams() == []


async def test_a_warm_stream_retries_until_it_opens(
    hass: HomeAssistant,
    setup: tuple[MseRelay, FakeServer, Scheduler],
) -> None:
    """While the camera cannot be reached, a warm stream tries again."""
    relay, server, _scheduler = setup
    assert await relay.async_keep_warm(SUB, True, key_frame_timeout=0) is False
    server.answer = {"type": "error", "value": "no route to host"}
    with patch.object(relay_module, "RETRY_S", (0.0,)):
        server.sockets[0].end()
        for _ in range(100):
            await asyncio.sleep(0.01)
            if len(server.sockets) >= 3:
                break
        assert len(server.sockets) >= 3  # failed, and tried again
        server.answer = {"type": "mse", "value": H264_AAC}
        for _ in range(100):
            await asyncio.sleep(0.01)
            if relay.state(SUB) is not None:
                break
    assert relay.state(SUB) is not None
    await relay.async_shutdown()
    await hass.async_block_till_done()

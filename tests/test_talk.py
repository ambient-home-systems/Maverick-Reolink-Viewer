"""Tests for talking through the Doorbell (Phase 12 step c)."""

import asyncio
import math
import struct
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry, MockUser
from pytest_homeassistant_custom_component.typing import WebSocketGenerator
from reolink_aio.exceptions import ApiError

from custom_components.reolink_viewer import bridge, devices
from custom_components.reolink_viewer.bridge import BridgeError, talk_format
from custom_components.reolink_viewer.const import CONF_TALK_EVERYONE
from custom_components.reolink_viewer.talk import (
    AdpcmEncoder,
    TalkAudio,
    TalkError,
    Talks,
    TalkSession,
    adpcm_decode,
    may_talk,
    talk_frame,
)
from homeassistant.core import HomeAssistant

# The Doorbell's answer to 10 (the owner's probe, 2026-11-14).
ABILITY: dict[str, Any] = {
    "duplex": ["FDX"],
    "stream_modes": ["followVideoStream", "mixAudioStream"],
    "formats": [
        {
            "priority": "0",
            "audioType": "adpcm",
            "sampleRate": "16000",
            "samplePrecision": "16",
            "lengthPerEncoder": "1024",
            "soundTrack": "mono",
        }
    ],
}
# A rate fast enough for the tests: 1,025 samples a millisecond.
FAST = TalkAudio(1_025_000, 1024)


def tone(count: int, start: int = 0, level: float = 9000.0) -> list[int]:
    return [
        int(level * math.sin(2 * math.pi * 440 * (start + i) / 16000))
        for i in range(count)
    ]


def pcm(samples: list[int]) -> bytes:
    return struct.pack(f"<{len(samples)}h", *samples)


def test_adpcm_blocks_decode_to_the_voice() -> None:
    """IMA ADPCM: the first sample in the header, then a code a sample."""
    encoder = AdpcmEncoder(512)
    assert encoder.samples == 1025
    voice = tone(1025 * 8)
    decoded: list[int] = []
    for n in range(8):
        block = encoder.block(voice[n * 1025 : (n + 1) * 1025])
        assert len(block) == 516
        first, index, zero = struct.unpack_from("<hBB", block)
        assert first == voice[n * 1025]
        assert zero == 0
        # Each block starts with the step index the last one ended on.
        assert (index == 0) is (n == 0)
        decoded += adpcm_decode(block)
    noise = sum((a - b) ** 2 for a, b in zip(voice, decoded, strict=True))
    signal = sum(a * a for a in voice)
    assert 10 * math.log10(signal / noise) > 25
    with pytest.raises(ValueError, match="1025 samples"):
        encoder.block([0] * 1024)


def test_a_block_is_framed_as_the_device_frames_audio() -> None:
    """``01wb``, the payload's size twice, ``0x0100``, the codes' size, padded to 8."""
    block = bytes(range(4)) + bytes(512)
    frame = talk_frame(block)
    assert frame[:12] == b"01wb" + struct.pack("<HHHH", 520, 520, 0x0100, 512)
    assert frame[12:] == block
    # A block whose payload is not a multiple of 8 is padded.
    odd = talk_frame(bytes(4) + bytes(500))
    assert struct.unpack_from("<HH", odd, 4) == (508, 508)
    assert len(odd) % 8 == 0
    assert odd.endswith(bytes(4))


class FakeDevice:
    """A device's talk: what was opened, the frames written, and the close."""

    def __init__(self, *, fail_write_after: int | None = None) -> None:
        self.frames: list[bytes] = []
        self.opened = 0
        self.closed = 0
        self.fail_write_after = fail_write_after

    async def open(self) -> TalkAudio:
        self.opened += 1
        return FAST

    async def write(self, frame: bytes) -> None:
        if self.fail_write_after is not None and len(self.frames) >= (
            self.fail_write_after
        ):
            raise ConnectionError("the session went away")
        self.frames.append(frame)

    async def close(self) -> None:
        self.closed += 1


def running(session: TalkSession) -> bool:
    """Read whether a talk runs (a call: it changes between reads)."""
    return session.running


def session_of(device: FakeDevice, **kwargs: Any) -> TalkSession:
    return TalkSession(
        "Front Door",
        open_=device.open,
        write=device.write,
        close=device.close,
        **kwargs,
    )


async def test_a_talk_sends_its_audio_as_blocks_and_closes() -> None:
    """Each 1,025 samples a block; what is left at the stop, padded; then 11."""
    device = FakeDevice()
    session = session_of(device)
    audio = await session.async_start()
    assert audio == FAST
    assert session.running
    voice = tone(1025 * 3 + 100)
    # In pieces, as the panel sends them.
    for start in range(0, len(voice), 700):
        session.feed(pcm(voice[start : start + 700]))
        await asyncio.sleep(0)
    stats = await session.async_stop()
    assert stats["blocks"] == 4
    assert stats["ended"] == "stopped"
    assert stats["close"] == "ok"
    assert stats["error"] is None
    assert device.closed == 1
    assert not running(session)
    decoded: list[int] = []
    for frame in device.frames:
        decoded += adpcm_decode(frame[12:])
    # The voice, then silence to the end of the last block.
    assert abs(decoded[1025 * 3] - voice[1025 * 3]) < 200
    assert decoded[-1] == pytest.approx(0, abs=300)


async def test_a_quiet_talk_ends_by_itself() -> None:
    """No audio from the panel for its idle time: the talk ends and closes."""
    device = FakeDevice()
    ended: list[TalkSession] = []
    session = session_of(device, idle_s=0.05)
    session.on_end(ended.append)
    await session.async_start()
    session.feed(pcm(tone(1025)))
    for _ in range(100):
        if ended:
            break
        await asyncio.sleep(0.01)
    assert ended == [session]
    assert session.stats["ended"] == "idle"
    assert session.stats["blocks"] == 1
    assert device.closed == 1
    # A listener added once it is over is called at once.
    late: list[TalkSession] = []
    session.on_end(late.append)
    assert late == [session]


async def test_a_talk_ends_at_its_limit() -> None:
    """However much audio comes, a talk lasts its limit at most."""
    device = FakeDevice()
    session = session_of(device, max_s=0)
    await session.async_start()
    session.feed(pcm(tone(1025 * 4)))
    for _ in range(100):
        if not running(session):
            break
        await asyncio.sleep(0.01)
    stats = await session.async_stop()
    assert stats["ended"] == "limit"
    assert stats["blocks"] == 0
    assert device.closed == 1


async def test_a_talk_that_cannot_be_sent_ends_and_says_why() -> None:
    """A block that cannot be written ends the talk; the close is still sent."""
    device = FakeDevice(fail_write_after=1)
    session = session_of(device, idle_s=5)
    await session.async_start()
    session.feed(pcm(tone(1025 * 3)))
    for _ in range(100):
        if not running(session):
            break
        await asyncio.sleep(0.01)
    assert session.stats["ended"] == "error"
    assert "ConnectionError: the session went away" in session.stats["error"]
    assert session.stats["blocks"] == 1
    assert device.closed == 1


async def test_audio_far_behind_is_dropped() -> None:
    """More than a second waiting: the oldest goes (talk stays live, not late)."""
    device = FakeDevice()
    session = TalkSession(
        "Front Door",
        open_=AsyncMock(return_value=TalkAudio(16000, 1024)),
        write=device.write,
        close=device.close,
    )
    await session.async_start()
    # Two seconds at once (the panel stalled, then caught up).
    session.feed(pcm([0] * 32000))
    assert session.stats["dropped_s"] == pytest.approx(1.0, abs=0.01)
    await session.async_stop()


async def test_one_talk_per_device() -> None:
    """A second talk through the same device is refused while one runs."""
    talks = Talks()
    owner = object()
    first = session_of(FakeDevice())
    await talks.async_start("door", owner, first)
    assert talks.get("door") is first
    assert talks.owner("door") is owner
    with pytest.raises(TalkError, match="already talking"):
        await talks.async_start("door", object(), session_of(FakeDevice()))
    await first.async_stop()
    assert talks.get("door") is None
    assert talks.owner("door") is None
    # A talk whose open fails leaves the device free.
    failing = TalkSession(
        "Front Door",
        open_=AsyncMock(side_effect=BridgeError("the device refused to talk (400)")),
        write=AsyncMock(),
        close=AsyncMock(),
    )
    with pytest.raises(BridgeError):
        await talks.async_start("door", owner, failing)
    assert talks.get("door") is None
    # Unloading ends what runs.
    running_talk = session_of(FakeDevice())
    await talks.async_start("door", owner, running_talk)
    await talks.async_shutdown()
    assert not running(running_talk)
    assert running_talk.stats["ended"] == "unloaded"


def test_who_may_talk() -> None:
    """Administrators; everyone once the option says so."""
    admin = MagicMock(is_admin=True)
    user = MagicMock(is_admin=False)
    assert may_talk({}, admin) is True
    assert may_talk({}, user) is False
    assert may_talk({CONF_TALK_EVERYONE: True}, user) is True
    assert may_talk({CONF_TALK_EVERYONE: True}, None) is False


def test_the_talk_config_echoes_the_devices_ability() -> None:
    """``TalkConfig`` (201): the first duplex and stream mode, its ADPCM format."""
    fmt = talk_format(0, ABILITY)
    assert (fmt.sample_rate, fmt.length_per_encoder) == (16000, 1024)
    assert fmt.config_xml == (
        '<?xml version="1.0" encoding="UTF-8" ?>\n<body>\n'
        '<TalkConfig version="1.1">\n<channelId>0</channelId>\n'
        "<duplex>FDX</duplex>\n<audioStreamMode>followVideoStream</audioStreamMode>\n"
        "<audioConfig>\n<audioType>adpcm</audioType>\n<sampleRate>16000</sampleRate>\n"
        "<samplePrecision>16</samplePrecision>\n<lengthPerEncoder>1024</lengthPerEncoder>\n"
        "<soundTrack>mono</soundTrack>\n</audioConfig>\n</TalkConfig>\n</body>"
    )


@pytest.mark.parametrize(
    ("change", "message"),
    [
        ({"audioType": "aac"}, "no format"),
        ({"sampleRate": "44100"}, "8 or 16 kHz"),
        ({"soundTrack": "stereo"}, "mono"),
        ({"lengthPerEncoder": "7"}, "block"),
        ({"sampleRate": "fast"}, "unreadable"),
    ],
)
def test_a_talk_format_not_sent_here_is_refused(
    change: dict[str, str], message: str
) -> None:
    ability = {**ABILITY, "formats": [{**ABILITY["formats"][0], **change}]}
    with pytest.raises(BridgeError, match=message):
        talk_format(0, ability)


def _talking_doorbell(host: MagicMock) -> None:
    host.is_nvr = False
    host.is_hub = False
    host.baichuan_only = True
    host.supported.side_effect = lambda _ch, cap, *_args: (
        cap
        not in (
            "replay",
            "battery",
        )
    )


async def test_which_cameras_take_talk(
    hass: HomeAssistant, reolink_host: MagicMock, loaded_reolink: MockConfigEntry
) -> None:
    """A Baichuan-only camera with two-way audio, when reolink-aio can send it."""
    (handle,) = bridge.async_get_hosts(hass)
    # An NVR speaks HTTP too: no talk here.
    assert handle.can_talk(0) is False
    _talking_doorbell(reolink_host)
    assert handle.can_talk(0) is True
    # On its battery: no (talk would keep it awake).
    reolink_host.supported.side_effect = lambda _ch, cap, *_args: cap != "replay"
    reolink_host._battery = {0: {"powerSupplyStatus": "none"}}
    assert handle.can_talk(0) is False
    _talking_doorbell(reolink_host)
    # A reolink-aio without what talk needs: no.
    del reolink_host.baichuan._aes_encrypt
    assert handle.can_talk(0) is False


async def test_a_talk_opens_with_its_config_and_a_busy_device_is_reset(
    hass: HomeAssistant, reolink_host: MagicMock, loaded_reolink: MockConfigEntry
) -> None:
    """201 with the config; a 422 (a talk left open) is closed (11), then asked again."""
    (handle,) = bridge.async_get_hosts(hass)
    _talking_doorbell(reolink_host)
    sent: list[dict[str, Any]] = []
    answers: list[Any] = [
        ApiError("busy", rspCode=422),
        ApiError("nothing to close", rspCode=400),  # 11: asked again anyway
        "",  # 201 again
    ]

    async def send(**kwargs: Any) -> str:
        sent.append(kwargs)
        if kwargs["cmd_id"] == 10:
            return (
                "<body><TalkAbility><duplexList><duplex>FDX</duplex></duplexList>"
                "<audioStreamModeList><audioStreamMode>followVideoStream"
                "</audioStreamMode></audioStreamModeList><audioConfigList>"
                "<audioConfig><audioType>adpcm</audioType><sampleRate>16000"
                "</sampleRate><samplePrecision>16</samplePrecision>"
                "<lengthPerEncoder>1024</lengthPerEncoder><soundTrack>mono"
                "</soundTrack></audioConfig></audioConfigList></TalkAbility></body>"
            )
        answer = answers.pop(0)
        if isinstance(answer, Exception):
            raise answer
        return str(answer)

    reolink_host.baichuan.send = send
    fmt = await handle.async_talk_open(0)
    assert fmt.sample_rate == 16000
    assert [s["cmd_id"] for s in sent] == [10, 201, 11, 201]
    assert sent[1]["body"] == fmt.config_xml
    assert sent[1]["retry"] == 1
    # Any other refusal is said.
    answers[:] = [ApiError("no", rspCode=400)]
    with pytest.raises(BridgeError, match="refused to talk \\(400\\)"):
        await handle.async_talk_open(0)


async def test_a_block_is_sent_without_waiting_on_hass_session(
    hass: HomeAssistant, reolink_host: MagicMock, loaded_reolink: MockConfigEntry
) -> None:
    """202: the header, the encrypted extension, the frame as it is; no answer awaited."""
    (handle,) = bridge.async_get_hosts(hass)
    baichuan = reolink_host.baichuan
    baichuan._logged_in = False
    baichuan.login = AsyncMock()
    baichuan._connection = None
    connection = MagicMock()
    connection.send_without_wait = AsyncMock()

    async def connect() -> None:
        baichuan._connection = connection

    baichuan._connect_if_needed = connect
    baichuan._mess_id = 0xFFFFFF
    baichuan._aes_encrypt = lambda data: b"E" * len(data)
    frame = talk_frame(bytes(516))
    await handle.async_talk_write(0, frame)
    baichuan.login.assert_awaited_once()
    (data, cmd), _ = connection.send_without_wait.await_args
    assert cmd == 202
    extension = (
        b'<?xml version="1.0" encoding="UTF-8" ?>\n<Extension version="1.1">\n'
        b"<binaryData>1</binaryData>\n<channelId>0</channelId>\n</Extension>\n"
    )
    assert data[:4] == bytes.fromhex("f0debc0a")
    assert struct.unpack_from("<II", data, 4) == (202, len(extension) + len(frame))
    # Channel 0's handle (1), a new message number (wrapped), status 0, class 1464.
    assert data[12] == 1
    assert int.from_bytes(data[13:16], "little") == 0
    assert data[16:20] == bytes.fromhex("00001464")
    assert struct.unpack_from("<I", data, 20) == (len(extension),)
    assert data[24:] == b"E" * len(extension) + frame
    assert baichuan._mess_id == 0
    # The close: 11, its answer not retried.
    baichuan.send = AsyncMock(return_value="")
    await handle.async_talk_close(0)
    baichuan.send.assert_awaited_once_with(cmd_id=11, channel=0, retry=1)


class WsHost:
    """A host the websocket commands talk through."""

    def __init__(self) -> None:
        self.frames: list[bytes] = []
        self.closed = 0
        self.refuse: Exception | None = None

    async def async_talk_open(self, channel: int) -> bridge.TalkFormat:
        if self.refuse is not None:
            raise self.refuse
        return talk_format(channel, ABILITY)

    async def async_talk_write(self, channel: int, frame: bytes) -> None:
        self.frames.append(frame)

    async def async_talk_close(self, channel: int) -> None:
        self.closed += 1


SOURCE = devices.TalkSource("door", "Front Door", "entry", 0)


async def test_talking_over_the_websocket(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_viewer: MockConfigEntry,
) -> None:
    """Started (the handler for the audio), binary audio in, blocks out, stopped."""
    host = WsHost()
    client = await hass_ws_client(hass)
    with (
        patch.object(devices, "async_talk_source", return_value=SOURCE),
        patch.object(bridge, "async_get_host", return_value=host),
    ):
        await client.send_json(
            {"id": 1, "type": "reolink_viewer/talk/start", "device_id": "door"}
        )
        result = await client.receive_json()
        assert result["success"] is True
        started = (await client.receive_json())["event"]
        assert started["type"] == "started"
        assert started["sample_rate"] == 16000
        handler = started["handler_id"]
        # A second talk through the same camera is refused.
        await client.send_json(
            {"id": 2, "type": "reolink_viewer/talk/start", "device_id": "door"}
        )
        busy = await client.receive_json()
        assert busy["success"] is False
        assert busy["error"]["code"] == "talk_failed"
        assert "already talking" in busy["error"]["message"]
        # A little over two blocks of audio, binary.
        await client.send_bytes(bytes([handler]) + pcm(tone(2100)))
        for _ in range(100):
            if len(host.frames) >= 2:
                break
            await asyncio.sleep(0.01)
        await client.send_json(
            {"id": 3, "type": "reolink_viewer/talk/stop", "device_id": "door"}
        )
        ended = await client.receive_json()
        assert ended["id"] == 1
        assert ended["event"]["type"] == "ended"
        stopped = await client.receive_json()
        assert stopped["id"] == 3
        stats = stopped["result"]["stats"]
        assert stats["blocks"] == 3
        assert stats["ended"] == "stopped"
        assert stats["close"] == "ok"
        assert host.closed == 1
        assert len(host.frames) == 3
        # Stopped again: nothing runs.
        await client.send_json(
            {"id": 4, "type": "reolink_viewer/talk/stop", "device_id": "door"}
        )
        assert (await client.receive_json())["result"] == {"stats": None}


async def test_a_talk_ends_with_its_websocket(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_viewer: MockConfigEntry,
) -> None:
    """Unsubscribing (or the page closing) ends the talk on the camera."""
    host = WsHost()
    client = await hass_ws_client(hass)
    with (
        patch.object(devices, "async_talk_source", return_value=SOURCE),
        patch.object(bridge, "async_get_host", return_value=host),
    ):
        await client.send_json(
            {"id": 1, "type": "reolink_viewer/talk/start", "device_id": "door"}
        )
        await client.receive_json()
        await client.receive_json()
        await client.send_json(
            {"id": 2, "type": "unsubscribe_events", "subscription": 1}
        )
        await client.receive_json()
        talks = loaded_viewer.runtime_data.talk
        for _ in range(100):
            if talks.get(SOURCE.key) is None:
                break
            await asyncio.sleep(0.01)
        assert talks.get(SOURCE.key) is None
        assert host.closed == 1


async def test_a_refused_talk_is_said(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_viewer: MockConfigEntry,
) -> None:
    """The camera's refusal, a camera that takes no talk, an unknown one."""
    host = WsHost()
    host.refuse = BridgeError("the device refused to talk (400)")
    client = await hass_ws_client(hass)
    with (
        patch.object(devices, "async_talk_source", return_value=SOURCE),
        patch.object(bridge, "async_get_host", return_value=host),
    ):
        await client.send_json_auto_id(
            {"type": "reolink_viewer/talk/start", "device_id": "door"}
        )
        refused = await client.receive_json()
    assert refused["error"]["code"] == "talk_failed"
    assert "refused to talk (400)" in refused["error"]["message"]
    with patch.object(
        devices, "async_talk_source", side_effect=devices.NoTalkError("cam")
    ):
        await client.send_json_auto_id(
            {"type": "reolink_viewer/talk/start", "device_id": "cam"}
        )
        assert (await client.receive_json())["error"]["code"] == "no_talk"
    await client.send_json_auto_id(
        {"type": "reolink_viewer/talk/start", "device_id": "nope"}
    )
    assert (await client.receive_json())["error"]["code"] == "not_found"


async def test_only_administrators_talk_unless_the_option_says(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    hass_admin_user: MockUser,
    loaded_viewer: MockConfigEntry,
) -> None:
    """A user who is not an administrator may not, until everyone may."""
    hass_admin_user.groups = []
    client = await hass_ws_client(hass)
    await client.send_json_auto_id(
        {"type": "reolink_viewer/talk/start", "device_id": "door"}
    )
    refused = await client.receive_json()
    assert refused["error"]["code"] == "unauthorized"
    hass.config_entries.async_update_entry(
        loaded_viewer, options={**loaded_viewer.options, CONF_TALK_EVERYONE: True}
    )
    await hass.async_block_till_done()
    host = WsHost()
    with (
        patch.object(devices, "async_talk_source", return_value=SOURCE),
        patch.object(bridge, "async_get_host", return_value=host),
    ):
        await client.send_json_auto_id(
            {"type": "reolink_viewer/talk/start", "device_id": "door"}
        )
        assert (await client.receive_json())["success"] is True
        assert (await client.receive_json())["event"]["type"] == "started"
        await client.send_json_auto_id(
            {"type": "reolink_viewer/talk/stop", "device_id": "door"}
        )
        await client.receive_json()
        await client.receive_json()


async def test_which_camera_is_talked_to(
    hass: HomeAssistant,
    reolink_host: MagicMock,
    loaded_with_entities: MockConfigEntry,
) -> None:
    """A camera whose host takes talk is talked to there; live view says so."""
    handle = bridge.ReolinkHostHandle
    (source,) = devices.async_playback_sources(hass)
    with patch.object(handle, "can_talk", return_value=False):
        assert [c["talk"] for c in devices.async_live_cameras(hass)] == [False]
        with pytest.raises(devices.NoTalkError):
            devices.async_talk_source(hass, source.camera_id)
    with patch.object(handle, "can_talk", return_value=True):
        assert [c["talk"] for c in devices.async_live_cameras(hass)] == [True]
        talk = devices.async_talk_source(hass, source.camera_id)
    assert (talk.camera_id, talk.channel) == (source.camera_id, source.channel)
    assert talk.key == source.key
    with pytest.raises(devices.DeviceNotFoundError):
        devices.async_talk_source(hass, "nope")

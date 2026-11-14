"""Tests for the Doorbell check (Phase 12 step a): cuts and talk over HA's session."""

import asyncio
from collections.abc import AsyncGenerator, AsyncIterator
from datetime import datetime, timedelta
import importlib
import json
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch
from xml.etree import ElementTree as ET

import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry
from reolink_aio.exceptions import ReolinkError
from reolink_aio.typings import VOD_trigger

from custom_components.reolink_viewer import bridge, probe_doorbell
from custom_components.reolink_viewer.bridge import (
    CUT_NEEDS_LIBRARY,
    BridgeError,
    NotApplicableError,
    talk_ability,
)
from custom_components.reolink_viewer.probe import ProbeOptions, Prober
from custom_components.reolink_viewer.probe_doorbell import (
    NO_RECORDING,
    NOT_TRIED,
    ON_BATTERY,
    DoorbellOptions,
    media_summary,
    verdict,
)
from custom_components.reolink_viewer.probe_events import NO_TARGET
from custom_components.reolink_viewer.scheduler import Scheduler
from homeassistant.core import HomeAssistant

from .conftest import TEST_NOW, make_vod_file
from .ha_reolink_mock import TEST_UID_CAM
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

DOORBELL_ONLY = ProbeOptions(doorbell=DoorbellOptions(enabled=True, only=True))

TALK_ABILITY = (
    '<?xml version="1.0" encoding="UTF-8" ?>\n<body>\n<TalkAbility version="1.1">'
    "<duplexList><duplex>FDX</duplex></duplexList>"
    "<audioStreamModeList><audioStreamMode>followVideoStream</audioStreamMode>"
    "<audioStreamMode>mixAudioStream</audioStreamMode></audioStreamModeList>"
    "<audioConfigList><audioConfig><priority>0</priority><audioType>adpcm</audioType>"
    "<sampleRate>16000</sampleRate><samplePrecision>16</samplePrecision>"
    "<lengthPerEncoder>1024</lengthPerEncoder><soundTrack>mono</soundTrack>"
    "</audioConfig></audioConfigList></TalkAbility>\n</body>"
)
CLOCK = (
    '<?xml version="1.0" encoding="UTF-8" ?>\n<body><SystemGeneral version="1.1">'
    "<timeZone>0</timeZone><year>2026</year><month>10</month><day>17</day>"
    "<hour>12</hour><minute>0</minute><second>0</second></SystemGeneral></body>"
)
# The press an hour ago: a recording of two minutes.
PRESS_START = TEST_NOW - timedelta(hours=1)


def cut_media(seconds: int = 10, fps: int = 5) -> bytes:
    """A sub stream cut: a stream header, a key frame each second, audio."""
    out = bytearray(info_block(640, 480, fps))
    unix = int(PRESS_START.timestamp())
    for i in range(seconds * fps):
        micro = i * 1_000_000 // fps
        if i % fps == 0:
            key = annexb(H264_SPS, H264_PPS, H264_IDR_I)
            out += video("key", key, micro=micro, unix=unix + i // fps)
        else:
            out += video("frame", annexb(H264_P), micro=micro)
        out += audio(adts_frame())
    return bytes(out)


def chunked(data: bytes, size: int = 1000) -> list[bytes]:
    return [data[i : i + size] for i in range(0, len(data), size)]


class FakeCut:
    """reolink-aio 0.23.0's ``send_payload_stream``: yields the chunks given."""

    def __init__(self, chunks: list[bytes], *, fail_after: int | None = None) -> None:
        self.chunks = chunks
        self.fail_after = fail_after
        self.calls: list[dict[str, Any]] = []
        self.closed = False
        self.sent = 0

    def __call__(self, **kwargs: Any) -> AsyncIterator[bytes]:
        self.calls.append(kwargs)
        return self._stream()

    async def _stream(self) -> AsyncGenerator[bytes]:
        try:
            for index, chunk in enumerate(self.chunks):
                if self.fail_after is not None and index >= self.fail_after:
                    raise ReolinkError("the device went quiet")
                await asyncio.sleep(0)
                self.sent += 1
                yield chunk
        finally:
            self.closed = True


@pytest.fixture
async def scheduler() -> AsyncGenerator[Scheduler]:
    scheduler = Scheduler(default_limit=2)
    yield scheduler
    await scheduler.async_shutdown()


def _prober(hass: HomeAssistant, scheduler: Scheduler, options: ProbeOptions) -> Prober:
    return Prober(
        scheduler,
        bridge.async_get_hosts(hass),
        options=options,
        compat=bridge.async_check_compat(hass),
        ffmpeg_binary="ffmpeg",
        ffmpeg_version="7.1",
        session=MagicMock(),
        integration_version="0.0.1",
    )


def _send(talk: str | Exception = TALK_ABILITY) -> AsyncMock:
    """Baichuan's send: 10 answers ``talk``, 104 the clock."""

    async def send(cmd_id: int, channel: int | None = None, **_: Any) -> str:
        if cmd_id == 10:
            if isinstance(talk, Exception):
                raise talk
            return talk
        if cmd_id == 104:
            return CLOCK
        raise AssertionError(f"unexpected Baichuan command {cmd_id}")

    return AsyncMock(side_effect=send)


def _doorbell(
    host: MagicMock, *, wired: bool = True, cut: FakeCut | None = None
) -> FakeCut:
    """Make the mocked host the battery Doorbell, with a press an hour ago."""
    host.is_nvr = False
    host.is_hub = False
    host.baichuan_only = True
    host.hdd_list = [0]
    host.hdd_available.side_effect = lambda index: True
    host.supported.side_effect = lambda _ch, cap, *_args: cap != "replay"
    host.is_doorbell.return_value = True
    host._battery = {0: {"powerSupplyStatus": "normal" if wired else "none"}}
    host.baichuan.events_active = True
    host.baichuan.session_active = True
    host.baichuan.send = _send()
    press = make_vod_file(PRESS_START, 2, name="20261017110000")
    press.bc_triggers = VOD_trigger.DOORBELL | VOD_trigger.PERSON
    host.baichuan.search_vod_type = AsyncMock(
        return_value=({}, {VOD_trigger.DOORBELL: [press]})
    )
    cut = cut or FakeCut(chunked(cut_media()))
    host.baichuan.send_payload_stream = cut
    return cut


async def _run(
    hass: HomeAssistant, scheduler: Scheduler, options: ProbeOptions = DOORBELL_ONLY
) -> dict[str, Any]:
    report = await _prober(hass, scheduler, options).async_run()
    host: dict[str, Any] = report["hosts"][0]
    return host


async def test_doorbell_check_on_wired_power(
    hass: HomeAssistant,
    reolink_host: MagicMock,
    loaded_reolink: MockConfigEntry,
    scheduler: Scheduler,
) -> None:
    """A cut and the talk format over HA's own session; both go."""
    cut = _doorbell(reolink_host)
    host = await _run(hass, scheduler)

    # Only this check: the camera's live and recording checks are skipped.
    assert host["concurrency"] == {"ok": False, "skipped": "Doorbell check only"}
    doorbell = host["doorbell"]
    assert doorbell["ok"] is True
    session = doorbell["session"]
    assert session["connection"] is not None
    assert (session["events_active"], session["session_active"]) == (True, True)
    assert session["can_stream_cut"] is True
    (channel,) = doorbell["channels"]
    assert (channel["is_battery"], channel["wired_power"]) == (True, True)
    assert channel["clock_source"] == "device"

    talk = channel["talk"]
    assert talk["ok"] is True
    assert talk["duplex"] == ["FDX"]
    assert talk["stream_modes"] == ["followVideoStream", "mixAudioStream"]
    assert talk["formats"] == [
        {
            "priority": "0",
            "audioType": "adpcm",
            "sampleRate": "16000",
            "samplePrecision": "16",
            "lengthPerEncoder": "1024",
            "soundTrack": "mono",
        }
    ]

    searches = channel["searches"]
    # The last 7 days on the calendar: the mock's month has the 1st to the 17th.
    assert searches["day_search"]["days"] == 8
    assert searches["events_today"] == {
        "ok": True,
        "latency_ms": searches["events_today"]["latency_ms"],
        "events": 1,
        "finished": 1,
    }
    # Today had a finished recording: yesterday is not searched.
    assert "events_yesterday" not in searches

    # The cut: 143 over HA's session, stopped by 144 if left early, one at a
    # time per device; the camera's UID; its first 10 s on the sub stream.
    (call,) = cut.calls
    assert (call["cmd_id"], call["stop_cmd_id"], call["lock_per_device"]) == (
        143,
        144,
        True,
    )
    assert call["channel"] == 0
    body = ET.fromstring(call["body"])
    assert body.findtext(".//uid") == TEST_UID_CAM
    assert body.findtext(".//streamType") == "subStream"
    start, end = body.find(".//startTime"), body.find(".//endTime")
    assert start is not None
    assert end is not None
    assert (start.findtext("hour"), start.findtext("second")) == ("11", "0")
    assert (end.findtext("hour"), end.findtext("second")) == ("11", "10")

    result = channel["cut"]
    assert result["ok"] is True
    assert result["stopped"] == "device"
    assert (result["event_s"], result["asked_s"]) == (120, 10)
    assert result["key_frames"] == 10
    assert result["frames"] == 40
    assert result["audio_blocks"] == 50
    assert result["bytes"] == len(cut_media())
    assert result["first_key_frame_ms"] is not None
    assert result["media_s"] == 9.8
    assert result["speed"] is not None
    assert result["speed"] > 1
    assert result["media"] == {
        "width": 640,
        "height": 480,
        "fps": 5,
        "codec": "h264",
        "fps_estimate": 5.0,
        "key_interval_s": 1.0,
        "span_s": 9.8,
        "b_frames": False,
        "audio": {"blocks": 50, "codec": "aac", "sample_rates": {"16000": 50}},
    }
    # Home Assistant's session answered during the cut and after it.
    assert result["command_during"]["ok"] is True
    assert result["command_after"]["ok"] is True
    clocks = [
        c
        for c in reolink_host.baichuan.send.await_args_list
        if c.kwargs == {"cmd_id": 104}
    ]
    assert len(clocks) == 2

    assert channel["session_after"]["session_active"] is True
    assert channel["not_tried"] == NOT_TRIED
    gate = channel["gate"]
    assert (gate["playback"], gate["talk"]) == ("go", "go")
    assert gate["first_frame_under_goal"] is True
    assert channel["ok"] is True
    # Nothing that says when someone came to the door.
    assert "11:00" not in json.dumps(host)
    assert "2026-10-17" not in json.dumps(host)


async def test_never_on_battery(
    hass: HomeAssistant,
    reolink_host: MagicMock,
    loaded_reolink: MockConfigEntry,
    scheduler: Scheduler,
) -> None:
    """On its battery the Doorbell is not asked, even with the battery opt-in."""
    cut = _doorbell(reolink_host, wired=False)
    options = ProbeOptions(
        include_battery=True, doorbell=DoorbellOptions(enabled=True, only=True)
    )
    host = await _run(hass, scheduler, options)
    (channel,) = host["doorbell"]["channels"]
    assert channel["skipped"] == ON_BATTERY
    assert host["doorbell"]["ok"] is False
    reolink_host.baichuan.send.assert_not_awaited()
    assert cut.calls == []


async def test_without_reolink_aio_023(
    hass: HomeAssistant,
    reolink_host: MagicMock,
    loaded_reolink: MockConfigEntry,
    scheduler: Scheduler,
) -> None:
    """Without send_payload_stream there is no cut: playback is untested."""
    _doorbell(reolink_host)
    del reolink_host.baichuan.send_payload_stream
    host = await _run(hass, scheduler)
    assert host["doorbell"]["session"]["can_stream_cut"] is False
    (channel,) = host["doorbell"]["channels"]
    assert channel["cut"] == {"ok": False, "skipped": CUT_NEEDS_LIBRARY}
    assert channel["gate"]["playback"] == "untested"
    # No picture came: neither under nor over the goal.
    assert channel["gate"]["first_frame_under_goal"] is None
    assert channel["gate"]["talk"] == "go"
    assert channel["ok"] is True


async def test_no_recording_to_cut(
    hass: HomeAssistant,
    reolink_host: MagicMock,
    loaded_reolink: MockConfigEntry,
    scheduler: Scheduler,
) -> None:
    """Only a recording still being written: both days searched, nothing cut."""
    cut = _doorbell(reolink_host)
    recent = make_vod_file(TEST_NOW - timedelta(seconds=20), 1)
    recent.bc_triggers = VOD_trigger.DOORBELL
    reolink_host.baichuan.search_vod_type = AsyncMock(
        return_value=({}, {VOD_trigger.DOORBELL: [recent]})
    )
    host = await _run(hass, scheduler)
    (channel,) = host["doorbell"]["channels"]
    searches = channel["searches"]
    assert (
        searches["events_today"]["events"],
        searches["events_today"]["finished"],
    ) == (
        1,
        0,
    )
    assert searches["events_yesterday"]["ok"] is True
    assert channel["cut"] == {"ok": False, "skipped": NO_RECORDING}
    assert cut.calls == []


async def test_a_cut_that_fails_partway_is_a_no_go(
    hass: HomeAssistant,
    reolink_host: MagicMock,
    loaded_reolink: MockConfigEntry,
    scheduler: Scheduler,
) -> None:
    """What came before the failure is kept; with no picture, playback is no-go."""
    media = cut_media()
    _doorbell(reolink_host, cut=FakeCut([media[:20], media[20:]], fail_after=1))
    reolink_host.baichuan.send = _send(ReolinkError("not supported"))
    host = await _run(hass, scheduler)
    (channel,) = host["doorbell"]["channels"]
    result = channel["cut"]
    assert result["ok"] is False
    assert result["stopped"] == "error"
    assert "the device went quiet" in result["error"]
    assert result["bytes"] == 20
    assert result["command_during"] == {"ok": False, "skipped": "no picture came"}
    assert channel["talk"]["ok"] is False
    assert channel["gate"]["playback"] == "no-go"
    assert channel["gate"]["talk"] == "untested"
    assert channel["ok"] is False


async def test_a_long_cut_is_stopped_at_the_cap(
    hass: HomeAssistant,
    reolink_host: MagicMock,
    loaded_reolink: MockConfigEntry,
    scheduler: Scheduler,
) -> None:
    """Past the size cap the reading stops and the cut is closed (reolink-aio: 144)."""
    cut = _doorbell(reolink_host)
    with patch.object(probe_doorbell, "CUT_MAX_BYTES", 3000):
        host = await _run(hass, scheduler)
    result = host["doorbell"]["channels"][0]["cut"]
    assert result["stopped"] == "size cap"
    assert result["bytes"] == 3000
    assert cut.sent == 3
    assert cut.closed is True


async def test_a_host_with_nothing_to_check(
    hass: HomeAssistant,
    reolink_host: MagicMock,
    loaded_reolink: MockConfigEntry,
    scheduler: Scheduler,
) -> None:
    """A camera Reolink Viewer plays itself is not this check's."""
    host = await _run(hass, scheduler)
    assert host["doorbell"] == {"ok": False, "skipped": NO_TARGET}


def test_verdict() -> None:
    """Playback needs pictures at real time and a session that still answers."""
    ok_cut = {
        "ok": True,
        "speed": 3.2,
        "first_key_frame_ms": 2500.0,
        "command_after": {"ok": True},
    }
    talk = {"ok": True, "formats": [{"audioType": "adpcm"}]}
    gate = verdict({"cut": ok_cut, "talk": talk})
    assert (gate["playback"], gate["first_frame_under_goal"]) == ("go", False)
    assert "2500.0 ms" in gate["playback_why"]
    slow = verdict({"cut": {**ok_cut, "speed": 0.6}, "talk": talk})
    assert (slow["playback"], slow["playback_why"]) == (
        "no-go",
        "slower than real time (0.6x)",
    )
    # A cut paced at real time measures a little under 1x: still a go.
    assert verdict({"cut": {**ok_cut, "speed": 0.95}, "talk": talk})["playback"] == "go"
    quiet = verdict({"cut": {**ok_cut, "command_after": {"ok": False}}, "talk": talk})
    assert quiet["playback"] == "no-go"
    assert "did not answer" in quiet["playback_why"]
    none = verdict({"cut": ok_cut, "talk": {"ok": True, "formats": []}})
    assert none["talk"] == "no-go"
    assert verdict({})["playback"] == "untested"


def test_talk_ability_and_media_summary() -> None:
    """Only plain values; a stream header's times never reach the report."""
    root = ET.fromstring(TALK_ABILITY)
    ability = talk_ability(root)
    assert "audioType" in ability["fields"]
    empty = talk_ability(ET.fromstring("<body><TalkAbility/></body>"))
    assert (empty["duplex"], empty["formats"]) == ([], [])
    summary = media_summary(
        {"info": [{"width": 1, "height": 2, "fps": 3, "start": "x", "hex": "y"}]}
    )
    assert (summary["width"], summary["audio"]["codec"]) == (1, None)
    assert "x" not in json.dumps(summary)
    adpcm = media_summary({"audio": {"adpcm": {"kind": "0100"}}})
    assert adpcm["audio"]["codec"] == "adpcm"


async def test_bridge_cut_and_talk(
    hass: HomeAssistant,
    reolink_host: MagicMock,
    loaded_reolink: MockConfigEntry,
) -> None:
    """The bridge's cut: the main stream's name, the UID's first part, its checks."""
    (handle,) = bridge.async_get_hosts(hass)
    cut = FakeCut([b"ab", b"cd"])
    reolink_host.baichuan.send_payload_stream = cut
    reolink_host.camera_uid.return_value = f"{TEST_UID_CAM}_1"
    start = datetime(2026, 10, 17, 9, 5, 7)
    chunks = [
        c
        async for c in handle.async_stream_cut(
            0, start, start + timedelta(seconds=5), "main"
        )
    ]
    assert chunks == [b"ab", b"cd"]
    body = ET.fromstring(cut.calls[0]["body"])
    assert body.findtext(".//uid") == TEST_UID_CAM
    assert body.findtext(".//streamType") == "mainStream"
    assert body.findtext(".//logicChnBitmap") == "255"

    reolink_host.camera_uid.return_value = "Unknown"
    with pytest.raises(BridgeError, match="UID"):
        await anext(handle.async_stream_cut(0, start, start, "sub"))
    del reolink_host.baichuan.send_payload_stream
    with pytest.raises(NotApplicableError, match=r"0\.23\.0"):
        await anext(handle.async_stream_cut(0, start, start, "sub"))

    reolink_host.baichuan.send = _send()
    assert (await handle.async_talk_ability(0))["duplex"] == ["FDX"]
    reolink_host.baichuan.send.assert_awaited_once_with(cmd_id=10, channel=0)
    del reolink_host.baichuan.send
    with pytest.raises(NotApplicableError):
        await handle.async_talk_ability(0)


async def test_bridge_session_view(
    hass: HomeAssistant,
    reolink_host: MagicMock,
    loaded_reolink: MockConfigEntry,
) -> None:
    """What reolink-aio holds of HA's session; anything odd reads as unknown."""
    (handle,) = bridge.async_get_hosts(hass)
    reolink_host.baichuan.events_active = "yes"
    reolink_host.baichuan.session_active = False
    session = handle.baichuan_session()
    assert session["events_active"] is None
    assert session["session_active"] is False
    assert isinstance(session["connection"], str)
    reolink_host.baichuan.connection_type = None
    assert handle.baichuan_session()["connection"] is None


def test_options() -> None:
    """Only this check is no option without the check."""
    assert DoorbellOptions(enabled=False, only=True).only is False
    assert DoorbellOptions(enabled=True, only=True).only is True


def test_the_cut_request_is_reolink_aios() -> None:
    """The cut's body holds what reolink-aio 0.23.0's own download sends."""
    xmls = importlib.import_module("reolink_aio.baichuan.xmls")
    template = getattr(xmls, "FileInfoListDownload", None)
    if template is None:
        pytest.skip("reolink-aio before 0.23.0 has no download cut")
    util = importlib.import_module("reolink_aio.baichuan.util")
    start = datetime(2026, 10, 17, 9, 5, 7)
    end = start + timedelta(seconds=10)
    theirs = template.format(
        channel=0,
        uid="UID",
        stream_type="subStream",
        time_range=util.xml_time_range(start, end),
    )
    ours = bridge._download_cut_xml(0, "UID", "sub", start, end)

    def fields(text: str) -> list[tuple[str, str]]:
        root = ET.fromstring(text.strip())
        return [(el.tag, (el.text or "").strip()) for el in root.iter()]

    assert fields(ours) == fields(theirs)

"""Tests of live view's server side: go2rtc, its streams, sessions and checks."""

import asyncio
from collections.abc import AsyncGenerator, Generator
import hashlib
import json
from pathlib import Path
import shutil
import stat
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

from aiohttp import ClientSession, web
from aiohttp.test_utils import TestServer
import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry
from pytest_homeassistant_custom_component.typing import (
    ClientSessionGenerator,
    WebSocketGenerator,
)

from custom_components.reolink_viewer import devices
from custom_components.reolink_viewer.bridge import CameraUrl, LiveProtocol
from custom_components.reolink_viewer.devices import LiveSource
from custom_components.reolink_viewer.live import binary, capacity, go2rtc
from custom_components.reolink_viewer.live.binary import Binary, BinaryError
from custom_components.reolink_viewer.live.go2rtc import Go2rtcError, Go2rtcServer
from custom_components.reolink_viewer.live.streams import (
    LiveError,
    LiveStream,
    StreamRegistry,
)
from custom_components.reolink_viewer.scheduler import Priority, Scheduler
from homeassistant.core import HomeAssistant

from .conftest import TEST_PASSWORD
from .mp4_fixtures import fragmented_av

SOURCE = LiveSource("cam", "conn1", "Garage", "entry1", 0, "nvr")


# ---- go2rtc's configuration and what leaves it ----


def test_config_has_no_secret_and_no_ui() -> None:
    """The API is local, authenticated, limited to our paths; no password in it."""
    config = go2rtc.build_config(api_port=1234, rtsp_port=5678, ffmpeg="/usr/bin/ff")
    text = json.dumps(config)
    assert config["api"]["listen"] == "127.0.0.1:1234"
    assert config["api"]["local_auth"] is True
    assert config["api"]["password"] == "${REOLINK_VIEWER_GO2RTC_PASSWORD}"
    assert config["rtsp"]["listen"] == "127.0.0.1:5678"
    assert config["rtsp"]["password"] == config["api"]["password"]
    assert "/" not in config["api"]["allow_paths"]  # no web UI
    assert "/api/config" not in config["api"]["allow_paths"]
    for port in (11984, 18554, 18555):  # Home Assistant's own go2rtc
        assert str(port) not in text
    assert config["webrtc"]["listen"] == f":{go2rtc.WEBRTC_PORT}"
    assert config["webrtc"]["ice_servers"] == []
    assert config["exec"]["allow_paths"] == ["/usr/bin/ff"]
    assert config["ffmpeg"]["bin"] == "/usr/bin/ff"
    assert "streams" not in config


def test_redaction() -> None:
    """Camera URLs and addresses never reach the logs or the browser."""
    line = (
        "12:00:00.000 ERR [streams] error=read tcp url=rtsp://admin:"
        f"{TEST_PASSWORD}@192.168.1.20:554/Preview_01_sub"
        f" https://192.168.1.20/flv?user=admin&password={TEST_PASSWORD}"
    )
    out = go2rtc.redact(line)
    assert TEST_PASSWORD not in out
    assert "192.168" not in out
    assert out.startswith("12:00:00.000 ERR [streams]")
    state = go2rtc.stream_state(
        {
            "producers": [
                {
                    "url": f"rtsp://admin:{TEST_PASSWORD}@192.168.1.20/x",
                    "receivers": [{"codec": {"codec_name": "h264"}}],
                    "bytes_recv": 1200,
                },
                {"url": "rtsp://idle"},
            ],
            "consumers": [{"format_name": "webrtc"}],
        }
    )
    assert state == {
        "active": True,
        "bytes": 1200,
        "producers": 2,
        "consumers": 1,
        "codecs": ["h264"],
    }
    assert TEST_PASSWORD not in json.dumps(state)
    assert go2rtc.stream_state(None)["active"] is False


# ---- Finding the binary ----


def _read(path: str) -> bytes:
    return Path(path).read_bytes()


def _executable(path: str) -> bool:
    return bool(Path(path).stat().st_mode & stat.S_IXUSR)


def _script(path: Path, body: str) -> str:
    path.write_text(f"#!/bin/sh\n{body}\n")
    path.chmod(path.stat().st_mode | stat.S_IXUSR)
    return str(path)


@pytest.fixture
async def release(socket_enabled: None) -> AsyncGenerator[tuple[TestServer, bytes]]:
    """A fake release download."""
    body = b"\x7fELF fake go2rtc"

    async def handler(request: web.Request) -> web.Response:
        if request.match_info["name"] == "missing":
            return web.Response(status=404)
        return web.Response(body=body)

    app = web.Application()
    app.router.add_get("/{name}", handler)
    server = TestServer(app, host="127.0.0.1")
    await server.start_server()
    yield server, body
    await server.close()


async def test_binary_selection(
    hass: HomeAssistant,
    tmp_path: Path,
    release: tuple[TestServer, bytes],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """HA's go2rtc when recent enough; else the pinned download, checked."""
    server, body = release
    recent = _script(
        tmp_path / "go2rtc", 'echo "go2rtc version 1.9.14 (abc) linux/amd64"'
    )
    with patch.object(shutil, "which", return_value=recent):
        async with ClientSession() as session:
            found = await binary.async_find_binary(hass, tmp_path / "dl", session)
    assert found == Binary(recent, "1.9.14", "system")

    old = _script(tmp_path / "old", 'echo "go2rtc version 1.9.4 (abc) linux/amd64"')
    monkeypatch.setattr(
        binary, "RELEASE_URL", f"http://127.0.0.1:{server.port}/{{version}}-{{arch}}"
    )
    monkeypatch.setattr(binary, "_system", lambda: "linux")
    monkeypatch.setattr(binary, "_machine", lambda: "x86_64")
    monkeypatch.setattr(binary, "SHA256", {"amd64": hashlib.sha256(body).hexdigest()})
    with patch.object(shutil, "which", return_value=old):
        async with ClientSession() as session:
            found = await binary.async_find_binary(hass, tmp_path / "dl", session)
            assert found.source == "downloaded"
            assert await asyncio.to_thread(_read, found.path) == body
            assert await asyncio.to_thread(_executable, found.path)
            # Downloaded once: the verified file is reused.
            url = binary.RELEASE_URL
            monkeypatch.setattr(binary, "RELEASE_URL", "http://127.0.0.1:1/{arch}")
            again = await binary.async_find_binary(hass, tmp_path / "dl", session)
            assert again == found
            monkeypatch.setattr(binary, "RELEASE_URL", url)
    # A file that does not match its checksum is never used.
    await asyncio.to_thread(Path(found.path).write_bytes, b"tampered")
    monkeypatch.setattr(binary, "SHA256", {"amd64": "0" * 64})
    with patch.object(shutil, "which", return_value=None):
        async with ClientSession() as session:
            with pytest.raises(BinaryError, match="checksum mismatch"):
                await binary.async_find_binary(hass, tmp_path / "dl", session)
    assert list((tmp_path / "dl").iterdir()) == []
    monkeypatch.setattr(binary, "_machine", lambda: "sparc")
    with (
        patch.object(shutil, "which", return_value=None),
        pytest.raises(BinaryError, match="no download for sparc"),
    ):
        await binary.async_find_binary(hass, tmp_path / "dl", MagicMock())
    monkeypatch.setattr(binary, "_system", lambda: "darwin")
    with (
        patch.object(shutil, "which", return_value=None),
        pytest.raises(BinaryError, match="no download for darwin"),
    ):
        await binary.async_find_binary(hass, tmp_path / "dl", MagicMock())
    assert await binary.async_version(str(tmp_path / "nothing")) is None


async def test_a_download_that_fails(
    hass: HomeAssistant,
    tmp_path: Path,
    release: tuple[TestServer, bytes],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """An HTTP error leaves no file behind."""
    server, _body = release
    monkeypatch.setattr(
        binary, "RELEASE_URL", f"http://127.0.0.1:{server.port}/missing"
    )
    monkeypatch.setattr(binary, "_system", lambda: "linux")
    monkeypatch.setattr(binary, "_machine", lambda: "aarch64")
    with patch.object(shutil, "which", return_value=None):
        async with ClientSession() as session:
            with pytest.raises(BinaryError, match="HTTP 404"):
                await binary.async_find_binary(hass, tmp_path / "dl", session)
    assert list((tmp_path / "dl").iterdir()) == []


# ---- Supervision ----


async def test_a_binary_that_will_not_run(
    hass: HomeAssistant,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    socket_enabled: None,
) -> None:
    """go2rtc exiting at once is restarted with backoff and reported."""
    monkeypatch.setattr(go2rtc, "BACKOFF_S", (0.01,))
    crash = _script(tmp_path / "crash", 'echo "boom: listen tcp 127.0.0.1:1"; exit 3')

    async def find() -> Binary:
        return Binary(crash, "1.9.14", "system")

    async with ClientSession() as session:
        server = Go2rtcServer(
            hass, tmp_path / "work", lambda: session, ffmpeg=None, find_binary=find
        )
        await server.async_start()
        with pytest.raises(Go2rtcError, match="exited with code 3"):
            await server.async_ready(timeout=2)
        await asyncio.sleep(0.2)
        status = server.status(log=True)
        assert status["restarts"] >= 2
        assert status["state"] in ("failed", "restarting")
        assert "<ip>" in " ".join(status["log"])  # the address was redacted
        await server.async_stop()
        assert server.status()["state"] == "stopped"
        with pytest.raises(Go2rtcError, match="not running"):
            await server.async_ready()

    async def missing() -> Binary:
        raise BinaryError("go2rtc is not installed, and no download for sparc")

    async with ClientSession() as session:
        server = Go2rtcServer(
            hass, tmp_path / "work", lambda: session, ffmpeg=None, find_binary=missing
        )
        await server.async_start()
        with pytest.raises(Go2rtcError, match="no download for sparc"):
            await server.async_ready(timeout=1)
        await server.async_stop()


# ---- The capacity test's arithmetic ----


def test_frames_are_counted_from_fragments() -> None:
    """Each moof's trun sample counts are frames; boxes may arrive in pieces."""
    data = fragmented_av(4)
    counter = capacity.BoxCounter()
    frames = sum(counter.feed(data[i : i + 1000]) for i in range(0, len(data), 1000))
    # fragmented_av: every fragment has a video and an audio trun.
    expected = sum(
        capacity.moof_samples(payload)
        for kind, payload in _top_boxes(data)
        if kind == b"moof"
    )
    assert frames == expected > 0
    with pytest.raises(ValueError, match="bad box"):
        capacity.BoxCounter().feed(b"\x00\x00\x00\x01moof")


def _top_boxes(data: bytes) -> list[tuple[bytes, bytes]]:
    return capacity._children(data)


def test_reader_window() -> None:
    """Frames per second and the longest gap in a window."""
    reader = capacity.Reader("cam sub", "rv_x_sub", 15.0, began=0.0)
    reader.first_frame = 0.5
    reader.frames = [0.5 + i / 15 for i in range(60)] + [6.0]
    assert reader.first_frame_s() == 0.5
    assert reader.fps(1.0, 4.0) == pytest.approx(15, abs=0.5)
    assert reader.longest_gap(4.0, 7.0) > 1.5


def test_verdict() -> None:
    """The first level that fails or slows down, and why."""
    stream = {"stream": "a sub", "fps": 15.0, "expected_fps": 15.0}
    ok = {"level": 1, "added": "a sub", "first_frame_s": 1.0, "streams": [stream]}
    slow = {
        "level": 2,
        "added": "b sub",
        "first_frame_s": 8.0,
        "streams": [stream, {**stream, "stream": "b sub", "fps": 11.0}],
    }
    report = {"levels": [ok, slow]}
    result = capacity.verdict(report, None)
    assert result["first_failing_level"] == 2
    assert result["reasons"] == [
        "b sub at 11.0 of 15.0 fps",
        "first frame 8.0 s (past a 4.5 s key-frame wait and 3.0 s)",
    ]
    # A first frame anywhere within a key-frame interval is no slowdown (run 9:
    # level 1 started in 0.38 s, level 6 in 3.47 s, every stream at its rate).
    lucky = {**ok, "first_frame_s": 0.38}
    unlucky = {**ok, "level": 2, "first_frame_s": 3.47}
    assert capacity.verdict({"levels": [lucky, unlucky]}, None) == {
        "first_failing_level": None,
        "reasons": [],
    }
    fill = {"level": 3, "added": "recording download", "streams": [stream]}
    fill["fill"] = {"mbit_s": 100.0}
    assert capacity.verdict({"levels": [ok, fill]}, 400.0)["reasons"] == [
        "download at 100.0 of 400.0 Mbit/s alone"
    ]
    dead = {**ok, "first_frame_s": None, "streams": [{**stream, "fps": 0}]}
    assert capacity.verdict({"levels": [dead]}, None)["reasons"] == [
        "a sub delivered no frame",
        "a sub: no first frame",
    ]
    assert capacity.verdict(report | {"levels": [ok]}, None) == {
        "first_failing_level": None,
        "reasons": [],
    }


# ---- The stream registry ----


class FakeServer:
    """What the registry needs of Go2rtcServer."""

    def __init__(self) -> None:
        self.streams: dict[str, str] = {}
        self.generation = 1

    async def async_ready(self) -> None:
        return None

    async def async_set_stream(self, name: str, source: str) -> None:
        self.streams[name] = source


class FakeHost:
    def __init__(self) -> None:
        self.calls: list[tuple[int, LiveProtocol, str]] = []

    async def async_live_url(
        self, channel: int, protocol: LiveProtocol, stream: str
    ) -> CameraUrl | None:
        self.calls.append((channel, protocol, stream))
        if stream == "none":
            return None
        return CameraUrl(f"{protocol.value}://u:{TEST_PASSWORD}@cam/{stream}")


@pytest.fixture
def registry(
    hass: HomeAssistant,
) -> Generator[tuple[StreamRegistry, FakeServer, FakeHost, Scheduler]]:
    server = FakeServer()
    host = FakeHost()
    scheduler = Scheduler(default_limit=2, default_stream_limit=2)
    reg = StreamRegistry(hass, scheduler, server)  # type: ignore[arg-type]
    patcher = patch(
        "custom_components.reolink_viewer.bridge.async_get_host", return_value=host
    )
    patcher.start()
    yield reg, server, host, scheduler
    patcher.stop()


async def test_a_running_stream_holds_one_slot(
    registry: tuple[StreamRegistry, FakeServer, FakeHost, Scheduler],
) -> None:
    """However many watch it, a stream is one slot; registered from idle."""
    reg, server, host, scheduler = registry
    started: list[LiveStream] = []
    reg.on_start = started.append
    sub = LiveStream(SOURCE, "sub")
    ext = LiveStream(SOURCE, "ext")
    budget = scheduler.host("entry1").streams
    first = await reg.async_hold(sub)
    second = await reg.async_hold(sub)
    assert started == [sub]  # told once, when it starts from idle
    assert budget.stats()["streams"] == 1
    assert host.calls == [(0, LiveProtocol.RTSP, "sub")]
    assert server.streams[sub.name].endswith("/sub#backchannel=0")
    assert sub.name.startswith("rv_")
    assert SOURCE.entry_id not in sub.name
    first.release()
    first.release()  # once only
    assert reg.running() == {sub.name: 1}
    second.release()
    assert budget.stats()["streams"] == 0
    assert reg.running() == {}
    # From idle again: registered again (a reload may have changed the URL).
    hold = await reg.async_hold(sub)
    assert len(host.calls) == 2
    assert started == [sub, sub]
    # ext is read over HTTP-FLV, without the RTSP option.
    flv = await reg.async_hold(ext)
    assert host.calls[-1] == (0, LiveProtocol.FLV, "ext")
    assert not server.streams[ext.name].endswith("#backchannel=0")
    # The budget is full (2): a third stream waits, then fails.
    main = LiveStream(SOURCE, "main")
    with pytest.raises(LiveError, match="stream slot"):
        await reg.async_hold(main, slot_timeout=0.05)
    assert budget.stats()["streams_waiting"] == 0
    hold.release()
    flv.release()
    # What it is told cannot stop a stream from starting.
    reg.on_start = MagicMock(side_effect=RuntimeError("boom"))
    held = await reg.async_hold(sub)
    assert reg.running() == {sub.name: 1}
    held.release()
    with pytest.raises(LiveError, match="no none stream"):
        await reg.async_hold(LiveStream(SOURCE, "none"))
    assert budget.stats()["streams"] == 0


async def test_registered_again_after_a_restart(
    registry: tuple[StreamRegistry, FakeServer, FakeHost, Scheduler],
) -> None:
    """A restarted go2rtc forgot its streams: the next hold registers again."""
    reg, server, host, scheduler = registry
    sub = LiveStream(SOURCE, "sub")
    first = await reg.async_hold(sub)
    second = await reg.async_hold(sub)
    assert len(host.calls) == 1
    server.streams.clear()
    server.generation += 1
    third = await reg.async_hold(sub)  # still held, but go2rtc is new
    assert len(host.calls) == 2
    assert sub.name in server.streams
    assert scheduler.host("entry1").streams.stats()["streams"] == 1
    for hold in (first, second, third):
        hold.release()
    assert scheduler.host("entry1").streams.stats()["streams"] == 0
    await reg.async_shutdown()


async def test_priority_of_live_slots(
    registry: tuple[StreamRegistry, FakeServer, FakeHost, Scheduler],
) -> None:
    """A live stream waits for a slot ahead of recording downloads."""
    reg, _server, _host, scheduler = registry
    budget = scheduler.host("entry1").streams
    fills = [budget.request(Priority.PLAYBACK) for _ in range(2)]
    for ticket in fills:
        await ticket.wait()
    waiting_fill = budget.request(Priority.PLAYBACK)
    live = asyncio.create_task(reg.async_hold(LiveStream(SOURCE, "sub")))
    await asyncio.sleep(0.01)
    fills[0].release()
    hold = await live
    assert not waiting_fill.granted
    hold.release()
    await waiting_fill.wait()
    for ticket in (fills[1], waiting_fill):
        ticket.release()


# ---- The live commands, without a go2rtc to run ----


async def _ws(client: Any, payload: dict[str, Any]) -> dict[str, Any]:
    await client.send_json_auto_id(payload)
    msg: dict[str, Any] = await client.receive_json()
    return msg


async def test_live_commands_when_go2rtc_cannot_run(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    hass_read_only_access_token: str,
    loaded_with_entities: MockConfigEntry,
    viewer_entry: MockConfigEntry,
) -> None:
    """Errors are reported, never raised; admin-only commands are refused."""
    service = viewer_entry.runtime_data.live
    assert service is not None

    async def missing() -> Binary:
        raise BinaryError("go2rtc is not installed, and no download for sparc")

    service.server._find_binary = missing
    client = await hass_ws_client(hass)
    msg = await _ws(client, {"type": "reolink_viewer/live/status"})
    assert msg["result"]["go2rtc"]["state"] == "stopped"
    msg = await _ws(client, {"type": "reolink_viewer/live/cameras"})
    connection_id = msg["result"]["cameras"][0]["connections"][0]["connection_id"]
    ref = {"connection_id": connection_id, "stream": "sub"}
    nope = {"connection_id": "nope", "stream": "sub"}
    for kind in ("mse", "frame", "state"):
        msg = await _ws(client, {"type": f"reolink_viewer/live/{kind}", **nope})
        assert msg["error"]["code"] == "not_found", kind
    msg = await _ws(
        client, {"type": "reolink_viewer/live/preload", **nope, "enabled": True}
    )
    assert msg["error"]["code"] == "not_found"
    msg = await _ws(
        client, {"type": "reolink_viewer/live/webrtc", **nope, "offer": "v=0"}
    )
    assert msg["error"]["code"] == "not_found"
    msg = await _ws(
        client,
        {"type": "reolink_viewer/live/candidate", "session_id": "x", "candidate": "c"},
    )
    assert msg["error"]["code"] == "not_found"
    # go2rtc cannot start: each command says why.
    msg = await _ws(client, {"type": "reolink_viewer/live/state", **ref})
    assert msg["error"]["code"] == "live_failed"
    assert "no download for sparc" in msg["error"]["message"]
    msg = await _ws(
        client, {"type": "reolink_viewer/live/preload", **ref, "enabled": True}
    )
    assert msg["error"]["code"] == "live_failed"
    await client.send_json_auto_id(
        {"type": "reolink_viewer/live/webrtc", **ref, "offer": "v=0"}
    )
    assert (await client.receive_json())["success"]
    events = [(await client.receive_json())["event"] for _ in range(2)]
    assert events[0]["type"] == "session"
    assert events[1] == {
        "type": "error",
        "message": "go2rtc is not installed, and no download for sparc",
    }
    msg = await _ws(client, {"type": "reolink_viewer/live/status"})
    assert msg["result"]["go2rtc"]["state"] in ("failed", "restarting")
    assert "sparc" in msg["result"]["go2rtc"]["error"]
    # The capacity test: one at a time, for a known host, admins only.
    msg = await _ws(client, {"type": "reolink_viewer/live/capacity", "host_id": "x"})
    assert msg["error"]["code"] == "not_found"
    devices = await _ws(client, {"type": "reolink_viewer/devices"})
    host_id = devices["result"]["hosts"][0]["id"]
    async with service.capacity_lock:
        msg = await _ws(
            client, {"type": "reolink_viewer/live/capacity", "host_id": host_id}
        )
        assert msg["error"]["message"] == "A capacity test is running"
    await client.send_json_auto_id(
        {"type": "reolink_viewer/live/capacity", "host_id": host_id}
    )
    assert (await client.receive_json())["success"]
    event = (await client.receive_json())["event"]
    assert event["type"] == "error"
    assert "sparc" in event["message"]
    reader = await hass_ws_client(hass, hass_read_only_access_token)
    for payload in (
        {"type": "reolink_viewer/live/preload", **ref, "enabled": True},
        {"type": "reolink_viewer/live/capacity", "host_id": host_id},
    ):
        msg = await _ws(reader, payload)
        assert msg["error"]["code"] == "unauthorized"
    msg = await _ws(reader, {"type": "reolink_viewer/live/status"})
    assert "log" not in msg["result"]["go2rtc"]  # admins only
    await service.async_shutdown()
    await hass.config_entries.async_unload(viewer_entry.entry_id)
    msg = await _ws(client, {"type": "reolink_viewer/live/status"})
    assert msg["error"]["code"] == "not_loaded"


async def test_live_images(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    hass_client: ClientSessionGenerator,
    hass_client_no_auth: ClientSessionGenerator,
    hass_read_only_access_token: str,
    reolink_host: MagicMock,
    loaded_with_entities: MockConfigEntry,
    viewer_entry: MockConfigEntry,
) -> None:
    """Subscribers get each camera's picture as a signed URL; the view serves it."""
    service = viewer_entry.runtime_data.live
    assert service is not None
    reolink_host.get_snapshot = AsyncMock(return_value=b"\xff\xd8picture")
    cameras = {c["id"] for c in devices.async_live_cameras(hass)}
    client = await hass_ws_client(hass)
    msg = await _ws(client, {"type": "reolink_viewer/live/images"})
    assert msg["success"]
    watching = msg["id"]
    kept = await client.receive_json()  # what is kept: nothing yet
    assert kept["event"] == {"images": {}}
    taken: dict[str, Any] = {}
    while set(taken) != cameras:
        taken.update((await client.receive_json())["event"]["images"])
    reolink_host.get_snapshot.assert_awaited_with(0, "sub")
    camera_id, image = next(iter(taken.items()))
    assert image["taken"] > 0
    assert camera_id not in image["url"]
    # Signed: no other credential needed, and it never reaches the camera.
    calls = reolink_host.get_snapshot.await_count
    response = await (await hass_client_no_auth()).get(image["url"])
    assert response.status == 200
    assert response.content_type == "image/jpeg"
    assert await response.read() == b"\xff\xd8picture"
    assert reolink_host.get_snapshot.await_count == calls
    response = await (await hass_client()).get("/api/reolink_viewer/live/image/nope")
    assert response.status == 404
    # A read-only user may watch too, and gets what is kept at once.
    reader = await hass_ws_client(hass, hass_read_only_access_token)
    msg = await _ws(reader, {"type": "reolink_viewer/live/images"})
    assert msg["success"]
    reading = msg["id"]
    assert set((await reader.receive_json())["event"]["images"]) == cameras
    assert service.images.stats()["watches"] == 2
    msg = await _ws(client, {"type": "unsubscribe_events", "subscription": watching})
    assert msg["success"]
    assert service.images.stats()["watches"] == 1
    msg = await _ws(reader, {"type": "unsubscribe_events", "subscription": reading})
    assert msg["success"]
    assert service.images.stats()["watches"] == 0


async def test_live_sources_of_a_host(
    hass: HomeAssistant,
    direct_camera: MagicMock,
    direct_camera_entry: MockConfigEntry,
    loaded_with_entities: MockConfigEntry,
) -> None:
    """An NVR's cameras, a camera added directly, and a merged camera's two ways."""
    cameras = devices.async_live_cameras(hass)
    (merged,) = [c for c in cameras if len(c["connections"]) == 2]
    vias = [c["via"] for c in merged["connections"]]
    assert vias == ["nvr", "direct"]
    nvr = next(h for h in devices.async_device_list(hass, degraded=False)["hosts"])
    sources = devices.async_host_live_sources(hass, nvr["id"])
    assert [s.via for s in sources] == ["nvr"]
    direct_id = merged["connections"][1]["connection_id"]
    (direct,) = devices.async_host_live_sources(hass, direct_id)
    assert direct.via == "direct"
    assert direct.entry_id == direct_camera_entry.entry_id
    assert devices.async_live_source(hass, direct_id) == direct
    assert devices.async_host_live_sources(hass, "nope") == []
    with pytest.raises(devices.DeviceNotFoundError):
        devices.async_live_source(hass, "nope")
    # Pictures are taken through the NVR where a camera has both.
    images = devices.async_image_sources(hass)
    assert images[merged["id"]].via == "nvr"
    assert set(images) == {c["id"] for c in cameras}


async def test_no_ext_stream_without_flv(
    hass: HomeAssistant,
    direct_camera: MagicMock,
    direct_camera_entry: MockConfigEntry,
    loaded_with_entities: MockConfigEntry,
) -> None:
    """A Baichuan-only connection offers sub and main, not ext (HTTP-FLV)."""
    direct_camera.baichuan_only = True
    (merged,) = [
        c for c in devices.async_live_cameras(hass) if len(c["connections"]) == 2
    ]
    nvr, direct = merged["connections"]
    assert list(nvr["streams"]) == ["sub", "main", "ext"]
    assert list(direct["streams"]) == ["sub", "main"]

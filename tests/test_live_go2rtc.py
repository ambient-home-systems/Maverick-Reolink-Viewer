"""Live view against a real go2rtc and a fake camera (see go2rtc_fixtures)."""

import asyncio
from collections.abc import AsyncGenerator
import json
from pathlib import Path
import subprocess
import time
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

from aiohttp import ClientSession, WSMsgType, web
from aiohttp.test_utils import TestServer
import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry
from pytest_homeassistant_custom_component.typing import (
    ClientSessionGenerator,
    WebSocketGenerator,
)

from custom_components.reolink_viewer.fmp4 import fragment_runs, init_tracks
from custom_components.reolink_viewer.live import capacity, views as live_views
from custom_components.reolink_viewer.live.binary import Binary
from custom_components.reolink_viewer.live.capacity import Reader
from custom_components.reolink_viewer.live.go2rtc import Go2rtcServer
from homeassistant.core import HomeAssistant

from .conftest import TEST_PASSWORD
from .go2rtc_fixtures import FPS

SECRET = TEST_PASSWORD


def _finder(path: str) -> Any:
    async def find() -> Binary:
        return Binary(path, "1.9.14", "system")

    return find


def _files_with(directory: Path, text: str) -> list[Path]:
    return [
        file
        for file in directory.rglob("*")
        if file.is_file() and text in file.read_text(errors="replace")
    ]


async def _read_for(server: Go2rtcServer, name: str, seconds: float) -> Reader:
    reader = Reader("cam", name, FPS)
    task = asyncio.create_task(reader.run(server))
    await asyncio.sleep(seconds)
    task.cancel()
    await asyncio.gather(task, return_exceptions=True)
    return reader


async def test_go2rtc_runs_supervised(
    hass: HomeAssistant, tmp_path: Path, go2rtc_binary: str, fake_camera: str
) -> None:
    """Our go2rtc: locked down, nothing on disk, restarted when it dies."""
    work = tmp_path / "work"
    async with ClientSession() as session:
        server = Go2rtcServer(
            hass,
            work,
            lambda: session,
            ffmpeg="ffmpeg",
            find_binary=_finder(go2rtc_binary),
        )
        await server.async_start()
        await server.async_ready()
        assert server.status()["version"] == "1.9.14"
        base = f"http://127.0.0.1:{server.api_port}"
        async with session.get(f"{base}/api") as response:
            assert response.status == 401  # local requests need the credentials too
        headers = {"Authorization": server.auth_header}
        for path in ("/", "/api/config", "/api/log"):  # no web UI
            async with session.get(f"{base}{path}", headers=headers) as response:
                assert response.status == 404, path

        name = "rv_test_sub"
        await server.async_set_stream(
            name, f"rtsp://admin:{SECRET}@{fake_camera[7:]}/cam#backchannel=0"
        )
        state = await server.async_stream_state(name)
        assert state is not None
        assert not state["active"]
        reader = await _read_for(server, name, 2.5)
        first = reader.first_frame_s()
        assert first is not None
        assert first < 2.0
        assert len(reader.frames) >= FPS  # about a second of 15 fps at least
        async with server.ws(name) as socket:
            await socket.send_json({"type": "mse", "value": "avc1.640029,mp4a.40.2"})
            await socket.receive(timeout=10)  # connected: go2rtc's MIME type
            state = await server.async_stream_state(name)
            assert state is not None
            assert state["active"]
            assert state["codecs"] == ["aac", "h264"]
        await server.async_delete_stream(name)
        assert await server.async_stream_state(name) is None

        # Nothing with the camera's password was written anywhere.
        assert await asyncio.to_thread(_files_with, work, SECRET) == []
        config = json.loads(await asyncio.to_thread((work / "go2rtc.json").read_text))
        assert config["api"]["password"].startswith("${")

        # It dies: it is started again (a new generation), streams to register again.
        assert server._process is not None
        server._process.kill()
        await asyncio.sleep(0.5)
        await server.async_ready(timeout=10)
        assert server.generation == 2
        assert server.status()["restarts"] == 1
        process = server._process
        await server.async_stop()
        assert process is not None
        assert process.returncode is not None
        assert server.status()["state"] == "stopped"


# ---- Through Home Assistant: the live commands and views ----


@pytest.fixture
def flv_file(tmp_path: Path) -> bytes:
    """A few seconds of H.264 in FLV, as a camera's HTTP-FLV ext stream sends."""
    path = tmp_path / "ext.flv"
    result = subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-f",
            "lavfi",
            "-i",
            f"testsrc2=size=896x512:rate={FPS}",
            "-t",
            "20",
            "-c:v",
            "libx264",
            "-preset",
            "ultrafast",
            "-g",
            str(FPS),
            "-pix_fmt",
            "yuv420p",
            "-f",
            "flv",
            str(path),
        ],
        check=False,
        capture_output=True,
    )
    if result.returncode != 0:
        pytest.skip("ffmpeg cannot write H.264 FLV")
    return path.read_bytes()


@pytest.fixture
async def device_server(
    socket_enabled: None, flv_file: bytes
) -> AsyncGenerator[TestServer]:
    """The camera's HTTP side: HTTP-FLV (ext) and a recording download."""
    data = flv_file

    async def flv(request: web.Request) -> web.StreamResponse:
        assert request.query["password"] == SECRET
        response = web.StreamResponse(headers={"Content-Type": "video/x-flv"})
        await response.prepare(request)
        # About real time: the file holds 20 s.
        step = len(data) // 40
        for start in range(0, len(data), step):
            await response.write(data[start : start + step])
            await asyncio.sleep(0.5)
        return response

    async def recording(_request: web.Request) -> web.StreamResponse:
        response = web.StreamResponse(headers={"Content-Type": "video/mp4"})
        await response.prepare(request=_request)
        for _ in range(2000):
            await response.write(b"\0" * 65536)
            await asyncio.sleep(0.001)
        return response

    app = web.Application()
    app.router.add_get("/flv", flv)
    app.router.add_get("/rec", recording)
    server = TestServer(app, host="127.0.0.1")
    await server.start_server()
    yield server
    await server.close()


@pytest.fixture
async def live(
    hass: HomeAssistant,
    reolink_host: MagicMock,
    loaded_with_entities: MockConfigEntry,
    viewer_entry: MockConfigEntry,
    go2rtc_binary: str,
    fake_camera: str,
    device_server: TestServer,
) -> AsyncGenerator[MockConfigEntry]:
    """The integration, its go2rtc reading the fake camera and device server."""
    camera = fake_camera.removeprefix("rtsp://")
    reolink_host.get_rtsp_stream_source = AsyncMock(
        side_effect=lambda ch, stream=None, check=True: (
            f"rtsp://admin:{SECRET}@{camera}/cam"
        )
    )
    reolink_host.get_flv_stream_source.side_effect = lambda ch, stream=None: (
        f"http://127.0.0.1:{device_server.port}/flv?port=1935&app=bcs"
        f"&stream=channel{ch}_{stream}.bcs&user=admin&password={SECRET}"
    )
    reolink_host.get_vod_source = AsyncMock(
        return_value=("video/mp4", f"http://127.0.0.1:{device_server.port}/rec")
    )
    reolink_host.frame_rate.return_value = FPS
    service = viewer_entry.runtime_data.live
    assert service is not None
    service.server._find_binary = _finder(go2rtc_binary)
    yield viewer_entry
    await service.async_shutdown()


async def _ws(client: Any, payload: dict[str, Any]) -> dict[str, Any]:
    await client.send_json_auto_id(payload)
    msg: dict[str, Any] = await client.receive_json()
    return msg


async def _events(client: Any, until: str, timeout: float = 20) -> list[dict[str, Any]]:
    events = []
    async with asyncio.timeout(timeout):
        while True:
            msg = await client.receive_json()
            if msg.get("type") != "event":
                continue
            events.append(msg["event"])
            if msg["event"]["type"] in (until, "error"):
                return events


async def test_live_commands_and_views(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    hass_client_no_auth: ClientSessionGenerator,
    live: MockConfigEntry,
) -> None:
    """Cameras, MSE through the proxy, frames, WebRTC signaling, keep warm."""
    client = await hass_ws_client(hass)
    msg = await _ws(client, {"type": "reolink_viewer/live/cameras"})
    (camera,) = msg["result"]["cameras"]
    (conn,) = camera["connections"]
    assert conn["via"] == "nvr"
    assert set(conn["streams"]) == {"sub", "main", "ext"}
    assert conn["streams"]["sub"]["entity_id"].startswith("camera.")
    assert conn["streams"]["sub"]["encoding"]["frame_rate"] == FPS
    ref = {"connection_id": conn["connection_id"]}
    assert SECRET not in json.dumps(msg)

    # MSE: a signed websocket; go2rtc's MIME type, then the init segment.
    msg = await _ws(client, {"type": "reolink_viewer/live/mse", **ref, "stream": "sub"})
    path = msg["result"]["path"]
    assert "authSig=" in path
    http = await hass_client_no_auth()
    unsigned = await http.get(path.split("?")[0])
    assert unsigned.status == 401
    async with http.ws_connect(path) as socket:
        await socket.send_json({"type": "webrtc", "value": "ignored"})
        await socket.send_json({"type": "mse", "value": "avc1.640029,mp4a.40.2"})
        first = await socket.receive(timeout=10)
        assert first.type is WSMsgType.TEXT
        assert (
            json.loads(first.data)
            == {
                "type": "mse",
                "value": 'video/mp4; codecs="avc1.640029,mp4a.40.2"',
            }
            or "avc1" in json.loads(first.data)["value"]
        )
        init = await socket.receive(timeout=10)
        assert init.type is WSMsgType.BINARY
        assert init.data[4:8] == b"ftyp"
        media = await socket.receive(timeout=10)
        assert media.data[4:8] == b"moof"
        state = await _ws(
            client, {"type": "reolink_viewer/live/state", **ref, "stream": "sub"}
        )
        assert state["result"]["holds"] == 1
        assert state["result"]["state"]["active"]
        assert state["result"]["cache"]["viewers"] == 1
        assert SECRET not in json.dumps(state)
    await asyncio.sleep(0.2)
    state = await _ws(
        client, {"type": "reolink_viewer/live/state", **ref, "stream": "sub"}
    )
    assert state["result"]["holds"] == 0
    assert state["result"]["cache"] is None  # the feed closed with its viewer

    # A browser that leaves before asking.
    async with http.ws_connect(path):
        pass

    # ext comes over HTTP-FLV.
    msg = await _ws(client, {"type": "reolink_viewer/live/mse", **ref, "stream": "ext"})
    async with http.ws_connect(msg["result"]["path"]) as socket:
        await socket.send_json({"type": "mse", "value": "avc1.640029,avc1.42E01E"})
        first = await socket.receive(timeout=15)
        assert json.loads(first.data)["type"] == "mse"
        init = await socket.receive(timeout=10)
        assert init.data[4:8] == b"ftyp"

    # A frame of the stream.
    msg = await _ws(
        client, {"type": "reolink_viewer/live/frame", **ref, "stream": "sub"}
    )
    response = await http.get(msg["result"]["path"])
    assert response.status == 200
    assert response.content_type == "image/jpeg"
    assert (await response.read())[:2] == b"\xff\xd8"

    # WebRTC: go2rtc's answer to a bad offer is an error, relayed (redacted).
    await client.send_json_auto_id(
        {"type": "reolink_viewer/live/webrtc", **ref, "stream": "sub", "offer": "v=0"}
    )
    events = await _events(client, "error")
    assert events[0]["type"] == "session"
    assert events[-1]["type"] == "error"
    assert (await _events(client, "closed"))[-1]["type"] == "closed"
    msg = await _ws(
        client,
        {
            "type": "reolink_viewer/live/candidate",
            "session_id": events[0]["session_id"],
            "candidate": "candidate:1 1 udp 1 1.2.3.4 5 typ host",
        },
    )
    assert msg["error"]["code"] == "not_found"  # the session is over

    # Keep warm (admin).
    msg = await _ws(
        client,
        {
            "type": "reolink_viewer/live/preload",
            **ref,
            "stream": "sub",
            "enabled": True,
        },
    )
    assert len(msg["result"]["preloaded"]) == 1
    msg = await _ws(client, {"type": "reolink_viewer/live/status"})
    status = msg["result"]
    assert status["go2rtc"]["state"] == "running"
    assert status["go2rtc"]["version"] == "1.9.14"
    assert "log" in status["go2rtc"]  # admin
    assert status["preloaded"]
    assert SECRET not in json.dumps(status)
    msg = await _ws(
        client,
        {
            "type": "reolink_viewer/live/preload",
            **ref,
            "stream": "sub",
            "enabled": False,
        },
    )
    assert msg["result"]["preloaded"] == []

    msg = await _ws(
        client,
        {"type": "reolink_viewer/live/mse", "connection_id": "x", "stream": "sub"},
    )
    assert msg["error"]["code"] == "not_found"


async def test_the_key_frame_cache(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    hass_client_no_auth: ClientSessionGenerator,
    reolink_host: MagicMock,
    fake_camera: str,
    live: MockConfigEntry,
) -> None:
    """A warm stream's viewer gets its last key frame at once, not the next one."""
    camera = fake_camera.removeprefix("rtsp://")
    # The main stream reads the camera stream with a key frame every 4 s.
    reolink_host.get_rtsp_stream_source = AsyncMock(
        side_effect=lambda ch, stream=None, check=True: (
            f"rtsp://admin:{SECRET}@{camera}/{'slow' if stream == 'main' else 'cam'}"
        )
    )
    client = await hass_ws_client(hass)
    msg = await _ws(client, {"type": "reolink_viewer/live/cameras"})
    conn = msg["result"]["cameras"][0]["connections"][0]
    ref = {"connection_id": conn["connection_id"], "stream": "main"}
    msg = await _ws(
        client, {"type": "reolink_viewer/live/preload", **ref, "enabled": True}
    )
    assert msg["result"]["key_frame"] is True
    # Well past that key frame, and 2.5 s before the next one.
    await asyncio.sleep(1.5)
    msg = await _ws(client, {"type": "reolink_viewer/live/state", **ref})
    cache = msg["result"]["cache"]
    assert msg["result"]["preloaded"]
    assert cache["warm"] is True
    assert cache["key_frame_age_ms"] >= 1000
    assert cache["cached_ms"] >= 1000
    assert cache["parameter_sets"] == "same"

    msg = await _ws(client, {"type": "reolink_viewer/live/mse", **ref})
    http = await hass_client_no_auth()
    started = time.monotonic()
    async with http.ws_connect(msg["result"]["path"]) as socket:
        await socket.send_json({"type": "mse", "value": "avc1.640029,mp4a.40.2"})
        mime = await socket.receive(timeout=10)
        first = await socket.receive(timeout=10)
        elapsed = time.monotonic() - started
    assert json.loads(mime.data)["type"] == "mse"
    assert elapsed < 1.0  # the next key frame was 2.5 s away
    # The init segment, then the key frame and what followed it (>= 1 s).
    data = first.data
    init_end = data.index(b"moof") - 4
    tracks = init_tracks(data[:init_end])
    moof_size = int.from_bytes(data[init_end : init_end + 4], "big")
    runs = fragment_runs(data[init_end : init_end + moof_size], tracks)
    video = next(t for t in tracks.values() if t.handler == "vide")
    assert runs[video.track_id][2]  # a sync sample: the key frame
    assert data.count(b"moof") >= FPS

    msg = await _ws(
        client, {"type": "reolink_viewer/live/preload", **ref, "enabled": False}
    )
    assert msg["result"]["preloaded"] == []
    await asyncio.sleep(0.2)
    msg = await _ws(client, {"type": "reolink_viewer/live/state", **ref})
    assert msg["result"]["cache"] is None


# The view sends the error, then closes first; aiohttp 3.14 can then arm its
# heartbeat timer again after the close (it fires once, harmlessly).
@pytest.mark.parametrize("expected_lingering_timers", [True])
async def test_mse_errors(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    hass_client_no_auth: ClientSessionGenerator,
    reolink_host: MagicMock,
    fake_camera: str,
    live: MockConfigEntry,
) -> None:
    """No MSE request, or a stream the camera lacks: an error, nothing leaked."""
    camera = fake_camera.removeprefix("rtsp://")
    reolink_host.get_rtsp_stream_source = AsyncMock(
        side_effect=lambda ch, stream=None, check=True: (
            f"rtsp://admin:{SECRET}@{camera}/missing"
        )
    )
    client = await hass_ws_client(hass)
    msg = await _ws(client, {"type": "reolink_viewer/live/cameras"})
    conn = msg["result"]["cameras"][0]["connections"][0]
    ref = {"connection_id": conn["connection_id"], "stream": "sub"}
    http = await hass_client_no_auth()

    msg = await _ws(client, {"type": "reolink_viewer/live/mse", **ref})
    with patch.object(live_views, "REQUEST_TIMEOUT", 0.1):
        async with http.ws_connect(msg["result"]["path"]) as socket:
            await socket.send_bytes(b"not a request")
            answer = json.loads((await socket.receive(timeout=5)).data)
    assert answer == {"type": "error", "value": "no MSE request"}

    # go2rtc's error, without the camera's address or password.
    msg = await _ws(client, {"type": "reolink_viewer/live/mse", **ref})
    async with http.ws_connect(msg["result"]["path"]) as socket:
        await socket.send_json({"type": "mse", "value": "avc1.640029,mp4a.40.2"})
        answer = json.loads((await socket.receive(timeout=20)).data)
    assert answer["type"] == "error"
    assert SECRET not in answer["value"]
    assert "127.0.0.1" not in answer["value"]
    await asyncio.sleep(0.2)
    msg = await _ws(client, {"type": "reolink_viewer/live/state", **ref})
    assert msg["result"]["holds"] == 0
    assert msg["result"]["cache"] is None


async def test_webrtc_session_relay(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    live: MockConfigEntry,
) -> None:
    """Early candidates wait for go2rtc; an unsubscribe ends the session."""
    client = await hass_ws_client(hass)
    msg = await _ws(client, {"type": "reolink_viewer/live/cameras"})
    conn = msg["result"]["cameras"][0]["connections"][0]
    service = live.runtime_data.live
    assert service is not None
    await client.send_json_auto_id(
        {
            "type": "reolink_viewer/live/webrtc",
            "connection_id": conn["connection_id"],
            "stream": "sub",
            "offer": "v=0",
        }
    )
    session_id = None
    async with asyncio.timeout(10):
        while session_id is None:
            message = await client.receive_json()
            if message.get("type") == "event":
                session_id = message["event"]["session_id"]
    other = await hass_ws_client(hass)
    msg = await _ws(
        other,
        {
            "type": "reolink_viewer/live/candidate",
            "session_id": session_id,
            "candidate": "x",
        },
    )
    assert msg["error"]["code"] == "not_found"  # not this connection's session


async def test_capacity_test(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    live: MockConfigEntry,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Sub streams one by one, a main, a download: frames counted at each level."""
    monkeypatch.setattr(capacity, "MEASURE_S", 1.5)
    monkeypatch.setattr(capacity, "FILL_ALONE_S", 0.5)
    client = await hass_ws_client(hass)
    msg = await _ws(client, {"type": "reolink_viewer/devices"})
    host_id = msg["result"]["hosts"][0]["id"]
    began = time.monotonic()
    await client.send_json_auto_id(
        {"type": "reolink_viewer/live/capacity", "host_id": host_id}
    )
    events = await _events(client, "result", timeout=60)
    result = events[-1]
    assert result["type"] == "result", result
    report = result["report"]
    assert [level["added"] for level in report["levels"]] == [
        f"{report['levels'][0]['added']}",
        report["levels"][1]["added"],
        "recording download",
    ]
    assert report["levels"][0]["added"].endswith(" sub")
    assert report["levels"][1]["added"].endswith(" main")
    first = report["levels"][0]
    assert first["first_frame_s"] is not None
    assert first["streams"][0]["fps"] > FPS / 2
    assert report["levels"][2]["fill"]["mbit_s"] > 0
    assert report["fill_alone_mbit_s"] > 0
    # The mocked NVR answers GetOnline with nothing usable: reported, not raised.
    assert str(report["online_users_before"]).startswith("n/a")
    assert "verdict" in report
    assert any(e["type"] == "progress" for e in events)
    assert time.monotonic() - began < 45
    msg = await _ws(client, {"type": "reolink_viewer/live/capacity", "host_id": "nope"})
    assert msg["error"]["code"] == "not_found"

"""End-to-end tests of the playback websocket commands and signed views."""

import asyncio
from collections.abc import AsyncGenerator, Generator
from datetime import datetime, timedelta
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

from custom_components.reolink_viewer import bridge, timeline, views
from custom_components.reolink_viewer.devices import PlaybackSource
from custom_components.reolink_viewer.thumbnails import ThumbKey
from custom_components.reolink_viewer.views import VodGrant
from homeassistant.core import HomeAssistant

from .mp4_fixtures import mp4_file

BODY = mp4_file(moov_first=True, mdat_bytes=300_000)
DAY = "2026-10-17"


@pytest.fixture
def fixed_now() -> Generator[None]:
    """The device's 'today' is TEST_NOW's day, whatever the real date."""
    with patch.object(timeline, "local_now", return_value=datetime(2026, 10, 17, 12)):
        yield


@pytest.fixture
async def media_server(socket_enabled: None) -> AsyncGenerator[TestServer]:
    async def handler(request: web.Request) -> web.StreamResponse:
        return web.Response(body=BODY, content_type="video/mp4")

    app = web.Application()
    app.router.add_get("/rec", handler)
    server = TestServer(app, host="127.0.0.1")
    await server.start_server()
    yield server
    await server.close()


@pytest.fixture
async def wired(
    hass: HomeAssistant,
    reolink_host: MagicMock,
    loaded_with_entities: MockConfigEntry,
    viewer_entry: MockConfigEntry,
    media_server: TestServer,
    fixed_now: None,
) -> AsyncGenerator[MockConfigEntry]:
    """Point recording downloads at the local media server."""
    reolink_host.get_vod_source = AsyncMock(
        return_value=("video/mp4", str(media_server.make_url("/rec")))
    )
    async with ClientSession() as session:
        viewer_entry.runtime_data.vod_cache._session = lambda: session
        yield viewer_entry
        await viewer_entry.runtime_data.vod_cache.async_shutdown()


async def _ws(client: Any, payload: dict[str, Any]) -> dict[str, Any]:
    await client.send_json_auto_id(payload)
    msg: dict[str, Any] = await client.receive_json()
    return msg


async def _camera_id(client: Any) -> str:
    msg = await _ws(client, {"type": "reolink_viewer/devices"})
    camera_id: str = msg["result"]["cameras"][0]["id"]
    return camera_id


async def test_timeline_commands(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator, wired: MockConfigEntry
) -> None:
    """Days of a month, one day's segments and events, and warming."""
    client = await hass_ws_client(hass)
    camera = await _camera_id(client)
    msg = await _ws(
        client,
        {
            "type": "reolink_viewer/timeline/days",
            "device_id": camera,
            "year": 2026,
            "month": 10,
        },
    )
    assert msg["result"]["days"] == list(range(1, 18))
    msg = await _ws(
        client,
        {"type": "reolink_viewer/timeline/day", "device_id": camera, "date": DAY},
    )
    day = msg["result"]
    assert len(day["segments"]) == 1
    seg = day["segments"][0]
    assert seg["end"] - seg["start"] == 5 * 60_000
    assert seg["triggers"] == ["MOTION", "PERSON"]
    assert day["events"][0]["types"] == ["MOTION", "PERSON"]
    assert day["timing"]["cache"] == "fresh"
    assert day["now"] > 0
    assert "name" not in seg
    msg = await _ws(client, {"type": "reolink_viewer/timeline/warm"})
    assert msg["result"] == {"cameras": 1}
    await hass.async_block_till_done()

    msg = await _ws(
        client,
        {"type": "reolink_viewer/timeline/day", "device_id": camera, "date": "bad"},
    )
    assert msg["success"] is False
    msg = await _ws(
        client,
        {
            "type": "reolink_viewer/timeline/day",
            "device_id": camera,
            "date": DAY,
            "max_age": 7200,
        },
    )
    assert msg["success"] is False  # max_age is capped at an hour
    msg = await _ws(
        client,
        {"type": "reolink_viewer/timeline/day", "device_id": "nope", "date": DAY},
    )
    assert msg["error"]["code"] == "not_found"


async def test_playback_url_and_views(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    hass_client_no_auth: ClientSessionGenerator,
    wired: MockConfigEntry,
) -> None:
    """A signed URL plays the recording (no other auth); clip and thumbnails too."""
    client = await hass_ws_client(hass)
    camera = await _camera_id(client)
    day = (
        await _ws(
            client,
            {"type": "reolink_viewer/timeline/day", "device_id": camera, "date": DAY},
        )
    )["result"]
    seg_id = day["segments"][0]["id"]
    msg = await _ws(
        client,
        {
            "type": "reolink_viewer/playback/url",
            "device_id": camera,
            "date": DAY,
            "segment_id": seg_id,
            "stream": "sub",
        },
    )
    result = msg["result"]
    assert result["url"].startswith("/api/reolink_viewer/vod/")
    assert "authSig=" in result["url"]
    assert result["segment_id"] == seg_id
    assert result["stream"] == "sub"
    assert "127.0.0.1" not in str(result)

    http = await hass_client_no_auth()
    resp = await http.get(result["url"])
    assert resp.status == 200
    assert await resp.read() == BODY
    resp = await http.get(result["url"], headers={"Range": "bytes=100-199"})
    assert resp.status == 206
    assert await resp.read() == BODY[100:200]
    resp = await http.get(result["clip_url"])
    assert resp.status == 200
    assert "attachment" in resp.headers["Content-Disposition"]
    assert resp.headers["Content-Disposition"].endswith('-sub.mp4"')
    # Unsigned or unknown paths are refused.
    resp = await http.get(result["url"].split("?")[0])
    assert resp.status == 401

    # The fill recorded the stream's codec.
    msg = await _ws(
        client, {"type": "reolink_viewer/playback/media_info", "device_id": camera}
    )
    assert msg["result"]["sub"]["codec"] == "hvc1.1.6.L153.B0"
    assert msg["result"]["main"] is None

    msg = await _ws(
        client,
        {
            "type": "reolink_viewer/playback/prefetch",
            "device_id": camera,
            "date": DAY,
            "segment_id": seg_id,
        },
    )
    assert msg["result"]["cache"]["complete"] is True

    msg = await _ws(
        client,
        {
            "type": "reolink_viewer/thumbnail/urls",
            "device_id": camera,
            "times": [day["segments"][0]["start"] + 3000],
            "bucket": 10,
        },
    )
    (thumb,) = msg["result"]["urls"]
    resp = await http.get(thumb["url"])
    assert resp.status == 200
    assert resp.content_type == "image/jpeg"
    assert await resp.read() == b"\xff\xd8jpegdata"


async def test_playback_errors(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    hass_client_no_auth: ClientSessionGenerator,
    reolink_host: MagicMock,
    wired: MockConfigEntry,
) -> None:
    """Unknown segments, failed searches, failed downloads and expired grants."""
    client = await hass_ws_client(hass)
    camera = await _camera_id(client)
    base = {"device_id": camera, "date": DAY}
    msg = await _ws(
        client, {"type": "reolink_viewer/playback/url", **base, "segment_id": "1"}
    )
    assert msg["error"]["code"] == "search_failed"
    msg = await _ws(
        client, {"type": "reolink_viewer/playback/prefetch", **base, "segment_id": "1"}
    )
    assert msg["error"]["code"] == "search_failed"

    day = (await _ws(client, {"type": "reolink_viewer/timeline/day", **base}))["result"]
    seg_id = day["segments"][0]["id"]
    reolink_host.get_vod_source = AsyncMock(
        return_value=("video/mp4", "http://127.0.0.1:9/x")
    )
    msg = await _ws(
        client, {"type": "reolink_viewer/playback/url", **base, "segment_id": seg_id}
    )
    http = await hass_client_no_auth()
    resp = await http.get(msg["result"]["url"])
    assert resp.status == 502
    # A grant for another kind, or an unknown one, is not found.
    data = wired.runtime_data
    signed = msg["result"]["url"]
    token = signed.split("?")[0].rsplit("/", 1)[-1]
    data.grants._items.clear()
    resp = await http.get(signed)
    assert resp.status == 404
    assert data.grants.get(token, VodGrant) is None

    reolink_host.request_vod_files = AsyncMock(side_effect=RuntimeError("busy"))
    msg = await _ws(
        client,
        {
            "type": "reolink_viewer/timeline/day",
            "device_id": camera,
            "date": "2026-10-10",
        },
    )
    assert msg["error"]["code"] == "search_failed"
    reolink_host.baichuan.search_vod_days = AsyncMock(side_effect=RuntimeError("busy"))
    msg = await _ws(
        client,
        {
            "type": "reolink_viewer/timeline/days",
            "device_id": camera,
            "year": 2026,
            "month": 8,
        },
    )
    assert msg["error"]["code"] == "search_failed"


async def test_degraded_and_no_playback(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    reolink_host: MagicMock,
    wired: MockConfigEntry,
) -> None:
    """Degraded mode and cameras that record nowhere are refused clearly."""
    client = await hass_ws_client(hass)
    camera = await _camera_id(client)
    reolink_host.supported.side_effect = lambda ch, cap, *a: (
        cap not in ("battery", "replay")
    )
    msg = await _ws(
        client,
        {"type": "reolink_viewer/timeline/day", "device_id": camera, "date": DAY},
    )
    assert msg["error"]["code"] == "no_playback"
    with patch.object(
        bridge,
        "async_check_compat",
        return_value=bridge.CompatReport(ok=False, errors=("x",)),
    ):
        msg = await _ws(
            client,
            {"type": "reolink_viewer/timeline/day", "device_id": camera, "date": DAY},
        )
        assert msg["error"]["code"] == "incompatible"
        msg = await _ws(client, {"type": "reolink_viewer/timeline/warm"})
        assert msg["result"] == {"cameras": 0}


async def test_not_loaded(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_with_entities: MockConfigEntry,
    viewer_entry: MockConfigEntry,
) -> None:
    """Commands and views answer sensibly when the entry is unloaded."""
    client = await hass_ws_client(hass)
    camera = await _camera_id(client)
    await hass.config_entries.async_unload(viewer_entry.entry_id)
    msg = await _ws(
        client,
        {"type": "reolink_viewer/timeline/day", "device_id": camera, "date": DAY},
    )
    assert msg["error"]["code"] == "not_loaded"
    msg = await _ws(client, {"type": "reolink_viewer/timeline/warm"})
    assert msg["error"]["code"] == "not_loaded"


@pytest.fixture
async def slow_server(socket_enabled: None) -> AsyncGenerator[tuple[TestServer, Any]]:
    """Sends 100 KB, then waits for the gate before the rest (or fails)."""
    gate = asyncio.Event()
    state = {"fail": False}

    async def handler(request: web.Request) -> web.StreamResponse:
        resp = web.StreamResponse(headers={"Content-Type": "video/mp4"})
        resp.enable_chunked_encoding()
        await resp.prepare(request)
        await resp.write(BODY[:100_000])
        await gate.wait()
        if state["fail"]:
            raise ConnectionResetError
        await resp.write(BODY[100_000:])
        await resp.write_eof()
        return resp

    app = web.Application()
    app.router.add_get("/slow", handler)
    server = TestServer(app, host="127.0.0.1")
    await server.start_server()
    yield server, (gate, state)
    gate.set()
    await server.close()


async def test_progressive_and_waiting_requests(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    hass_client_no_auth: ClientSessionGenerator,
    reolink_host: MagicMock,
    wired: MockConfigEntry,
    slow_server: tuple[TestServer, Any],
) -> None:
    """From the start: streamed while filling. Mid-file: waits for the file."""
    server, (gate, _state) = slow_server
    reolink_host.get_vod_source = AsyncMock(
        return_value=("video/mp4", str(server.make_url("/slow")))
    )
    client = await hass_ws_client(hass)
    camera = await _camera_id(client)
    day = (
        await _ws(
            client,
            {"type": "reolink_viewer/timeline/day", "device_id": camera, "date": DAY},
        )
    )["result"]
    msg = await _ws(
        client,
        {
            "type": "reolink_viewer/playback/url",
            "device_id": camera,
            "date": DAY,
            "segment_id": day["segments"][0]["id"],
        },
    )
    url = msg["result"]["url"]
    http = await hass_client_no_auth()
    resp = await http.get(url)
    assert resp.status == 200
    assert resp.headers.get("Transfer-Encoding") == "chunked"
    head = await resp.content.readexactly(100_000)
    assert head == BODY[:100_000]
    ranged = asyncio.create_task(
        http.get(url, headers={"Range": "bytes=200000-200099"})
    )
    await asyncio.sleep(0.05)
    assert not ranged.done()
    gate.set()
    assert await resp.content.read() == BODY[100_000:]
    ranged_resp = await ranged
    assert ranged_resp.status == 206
    assert await ranged_resp.read() == BODY[200_000:200_100]


async def test_progressive_stream_cut_and_timeout(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    hass_client_no_auth: ClientSessionGenerator,
    reolink_host: MagicMock,
    wired: MockConfigEntry,
    slow_server: tuple[TestServer, Any],
) -> None:
    """A fill failing mid-stream ends the body; a wait that is too long is a 504."""
    server, (gate, state) = slow_server
    reolink_host.get_vod_source = AsyncMock(
        return_value=("video/mp4", str(server.make_url("/slow")))
    )
    client = await hass_ws_client(hass)
    camera = await _camera_id(client)
    day = (
        await _ws(
            client,
            {"type": "reolink_viewer/timeline/day", "device_id": camera, "date": DAY},
        )
    )["result"]
    msg = await _ws(
        client,
        {
            "type": "reolink_viewer/playback/url",
            "device_id": camera,
            "date": DAY,
            "segment_id": day["segments"][0]["id"],
            "progressive": False,
        },
    )
    url = msg["result"]["url"]
    http = await hass_client_no_auth()
    with patch.object(views, "COMPLETE_TIMEOUT", 0.05):
        resp = await http.get(url)
        assert resp.status == 504

    # A progressive grant for the same recording, then the device drops the link.
    data = wired.runtime_data
    grant = data.grants.get(url.split("?")[0].rsplit("/", 1)[-1], VodGrant)
    assert grant is not None
    progressive = views.VodGrant(grant.recording, True, grant.download_name)
    token = data.grants.issue(progressive, views.VOD_TTL)
    resp = await http.get(_signed(hass, token))
    assert resp.status == 200
    await resp.content.readexactly(100_000)
    state["fail"] = True
    gate.set()
    rest = await resp.content.read()
    assert len(rest) < len(BODY) - 100_000
    await asyncio.sleep(0)


def _signed(hass: HomeAssistant, token: str) -> str:
    return views.sign(hass, views.VOD_PATH, token, views.VOD_TTL)


def test_grants_expire_and_are_capped() -> None:
    """Expired grants are gone; the registry stays bounded."""
    grants = views.Grants()
    thumb = views.ThumbGrant(ThumbKey(PlaybackSource("c", "n", "e", 1), "sub", 0))
    expired = grants.issue(thumb, timedelta(seconds=-1))
    assert grants.get(expired, views.ThumbGrant) is None
    live = grants.issue(thumb, timedelta(minutes=1))
    assert grants.get(live, views.ThumbGrant) is thumb
    assert grants.get(live, views.VodGrant) is None
    with patch.object(views, "MAX_GRANTS", 3):
        tokens = [grants.issue(thumb, timedelta(minutes=1)) for _ in range(5)]
        assert len(grants._items) <= 3
        assert grants.get(tokens[-1], views.ThumbGrant) is thumb

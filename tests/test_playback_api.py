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

from custom_components.reolink_viewer import bridge, timeline, views, vodcache
from custom_components.reolink_viewer.devices import PlaybackSource
from custom_components.reolink_viewer.scheduler import Priority
from custom_components.reolink_viewer.thumbnails import ThumbKey
from custom_components.reolink_viewer.views import VodGrant
from custom_components.reolink_viewer.vodcache import Recording
from homeassistant.core import HomeAssistant

from .mp4_fixtures import FTYP, av_moov, fragmented_av, mp4_file
from .test_fmp4 import MIME, _boxes, _check_mse_ready

BODY = mp4_file(moov_first=True, mdat_bytes=300_000)
# What the fake NVR serves (a test may swap in another recording).
SERVED = {"body": BODY}
DAY = "2026-10-17"


@pytest.fixture
def fixed_now() -> Generator[None]:
    """The device's 'today' is TEST_NOW's day, whatever the real date."""
    with patch.object(timeline, "local_now", return_value=datetime(2026, 10, 17, 12)):
        yield


@pytest.fixture
async def media_server(socket_enabled: None) -> AsyncGenerator[TestServer]:
    async def handler(request: web.Request) -> web.StreamResponse:
        return web.Response(body=SERVED["body"], content_type="video/mp4")

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
    # The HD list searched ahead, in the background (the panel's warm-up).
    with patch.object(
        wired.runtime_data.timeline,
        "async_day",
        wraps=wired.runtime_data.timeline.async_day,
    ) as day_search:
        msg = await _ws(
            client,
            {
                "type": "reolink_viewer/timeline/day",
                "device_id": camera,
                "date": DAY,
                "stream": "main",
                "background": True,
            },
        )
    assert msg["success"] is True
    background = [c for c in day_search.call_args_list if c.args[2] == "main"]
    assert background[0].kwargs["priority"] is Priority.PREFETCH

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
            "max_age": 86401,
        },
    )
    assert msg["success"] is False  # max_age is capped at a day
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
    # URLs outlive the recording played through (5 min here) by 30 min.
    assert result["expires_in"] == 35 * 60
    assert result["file"] == "original"  # the plain copy is not made yet
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
    # A start the cached copy reaches is served from it.
    msg = await _ws(
        client,
        {
            "type": "reolink_viewer/playback/url",
            "device_id": camera,
            "date": DAY,
            "segment_id": seg_id,
            "at": day["segments"][0]["start"] + 60_000,
        },
    )
    assert msg["result"]["cache"]["complete"] is True
    assert msg["result"]["end"] == day["segments"][0]["end"]
    # A URL that does not stream from the start gets the plain copy, made on
    # the first request (here ffmpeg may not take the synthetic file: then the
    # original, as stored).
    msg = await _ws(
        client,
        {
            "type": "reolink_viewer/playback/url",
            "device_id": camera,
            "date": DAY,
            "segment_id": seg_id,
            "progressive": False,
        },
    )
    assert msg["result"]["file"] == "plain"
    resp = await http.get(msg["result"]["url"])
    assert resp.status == 200
    (entry,) = wired.runtime_data.vod_cache._entries.values()
    assert "flat" in entry.timing

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


@pytest.fixture
def nvr_recording() -> Generator[bytes]:
    """The fake NVR serves a recording in its own fragment shape."""
    body = fragmented_av(30, absolute=True, tfdt=False)
    SERVED["body"] = body
    yield body
    SERVED["body"] = BODY


async def test_mse_fragments(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    hass_client: ClientSessionGenerator,
    hass_client_no_auth: ClientSessionGenerator,
    wired: MockConfigEntry,
    nvr_recording: bytes,
) -> None:
    """The MSE player's init segment and windows, behind HA's own auth."""
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
            "type": "reolink_viewer/playback/mse",
            "device_id": camera,
            "date": DAY,
            "segment_id": day["segments"][0]["id"],
            "at": day["segments"][0]["start"],
        },
    )
    result = msg["result"]
    base = result["base"]
    assert base.startswith("/api/reolink_viewer/mse/")
    assert "authSig" not in base
    assert "authSig=" in result["clip_url"]
    assert result["expires_in"] == 35 * 60
    assert result["start"] == day["segments"][0]["start"]
    assert "127.0.0.1" not in str(result)

    http = await hass_client()
    resp = await http.get(f"{base}/init")
    assert resp.status == 200
    assert resp.headers["X-RV-Mime"] == MIME
    assert resp.headers["X-RV-Source"] == "file"
    assert await resp.read() == FTYP + av_moov()
    # The init of what serves a start (the option is off: the recording).
    resp = await http.get(f"{base}/init?at=40000")
    assert resp.headers["X-RV-Source"] == "file"
    assert await resp.read() == FTYP + av_moov()
    resp = await http.get(f"{base}/init?source=cut")
    assert resp.status == 502
    resp = await http.get(f"{base}/frags?at=10500&ms=4000")
    assert resp.status == 200
    headers = {
        k: resp.headers[f"X-RV-{k}"] for k in ("First", "Count", "Last", "Source")
    }
    assert headers == {"First": "5", "Count": "2", "Last": "0", "Source": "file"}
    assert float(resp.headers["X-RV-Start"]) == 10_000
    assert float(resp.headers["X-RV-End"]) == 14_000
    data = await resp.read()
    moofs = [at for kind, at, _payload in _boxes(data) if kind == "moof"]
    assert len(moofs) == 2
    _check_mse_ready(data[moofs[0] :], {1: 5 * 50 * 3600, 2: 5 * 31 * 1024})
    resp = await http.get(f"{base}/frags?first=28&ms=60000")
    assert resp.headers["X-RV-Count"] == "2"
    assert resp.headers["X-RV-Last"] == "1"
    await resp.read()

    # The download of the copy served, by the URL's token.
    token = base.rsplit("/", 1)[-1]
    msg = await _ws(
        client, {"type": "reolink_viewer/playback/cache_status", "token": token}
    )
    assert msg["result"]["cache"]["complete"] is True
    assert msg["result"]["cache"]["bytes"] > len(nvr_recording)  # + index room
    assert msg["result"]["expected_bytes"] > 0
    clip_token = result["clip_url"].split("?")[0].rsplit("/", 1)[-1]
    msg = await _ws(
        client, {"type": "reolink_viewer/playback/cache_status", "token": clip_token}
    )
    assert msg["result"]["cache"]["complete"] is True
    msg = await _ws(
        client, {"type": "reolink_viewer/playback/cache_status", "token": "nope"}
    )
    assert msg["error"]["code"] == "not_found"

    # HA's auth is required, the token must be live, the window well-formed.
    anonymous = await hass_client_no_auth()
    resp = await anonymous.get(f"{base}/init")
    assert resp.status == 401
    for path, status in (
        (f"{base}/frags?at=soon", 400),
        (f"{base}/frags?first=-1", 400),
        (f"{base}/other", 404),
        ("/api/reolink_viewer/mse/nope/init", 404),
    ):
        resp = await http.get(path)
        assert resp.status == status, path


async def test_mse_errors(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    hass_client: ClientSessionGenerator,
    wired: MockConfigEntry,
) -> None:
    """A recording that is not fragmented, and a recording that is late."""
    client = await hass_ws_client(hass)
    camera = await _camera_id(client)
    day = (
        await _ws(
            client,
            {"type": "reolink_viewer/timeline/day", "device_id": camera, "date": DAY},
        )
    )["result"]
    ref = {"device_id": camera, "date": DAY, "segment_id": day["segments"][0]["id"]}
    msg = await _ws(client, {"type": "reolink_viewer/playback/mse", **ref})
    base = msg["result"]["base"]
    http = await hass_client()
    resp = await http.get(f"{base}/init")
    assert resp.status == 502
    assert "not playable as fragments" in await resp.text()
    msg = await _ws(
        client, {"type": "reolink_viewer/playback/mse", **ref, "segment_id": "1"}
    )
    assert msg["error"]["code"] == "search_failed"
    cache = wired.runtime_data.vod_cache
    with (
        patch.object(views, "COMPLETE_TIMEOUT", 0),
        patch.object(cache, "async_window", side_effect=TimeoutError),
    ):
        resp = await http.get(f"{base}/frags")
        assert resp.status == 504


async def test_a_live_url_keeps_its_recording(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    hass_client_no_auth: ClientSessionGenerator,
    reolink_host: MagicMock,
    wired: MockConfigEntry,
) -> None:
    """Range requests are not readers, yet a live URL's file is never evicted."""
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
    assert await resp.read() == BODY
    cache = wired.runtime_data.vod_cache
    for task in list(cache._flat_tasks):
        await task
    (entry,) = cache._entries.values()
    assert entry.readers == 0
    # Any eviction pressure: the leased recording stays.
    cache._max_bytes = 1
    await cache._evict()
    assert entry.path.exists()
    resp = await http.get(url, headers={"Range": "bytes=100-199"})
    assert resp.status == 206
    assert await resp.read() == BODY[100:200]
    assert reolink_host.get_vod_source.await_count == 1


async def test_leases_follow_the_player(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    hass_client: ClientSessionGenerator,
    hass_client_no_auth: ClientSessionGenerator,
    wired: MockConfigEntry,
    nvr_recording: bytes,
) -> None:
    """Reads keep a URL's lease fresh; the player releases it when it moves on."""
    client = await hass_ws_client(hass)
    camera = await _camera_id(client)
    day = (
        await _ws(
            client,
            {"type": "reolink_viewer/timeline/day", "device_id": camera, "date": DAY},
        )
    )["result"]
    ref = {"device_id": camera, "date": DAY, "segment_id": day["segments"][0]["id"]}
    msg = await _ws(client, {"type": "reolink_viewer/playback/mse", **ref})
    base = msg["result"]["base"]
    http = await hass_client()
    resp = await http.get(f"{base}/init")
    assert resp.status == 200
    await resp.read()
    cache = wired.runtime_data.vod_cache
    (entry,) = cache._entries.values()
    await cache.async_wait(entry, complete=True)
    assert entry.task is not None
    await entry.task
    idle = vodcache.LEASE_IDLE_S
    assert entry.busy(vodcache._clock(), idle=idle)
    # Not read for a while: a click elsewhere may take its room; a read keeps it.
    later = vodcache._clock() + idle + 1
    with patch.object(vodcache, "_clock", return_value=later):
        assert entry.busy(later)
        assert not entry.busy(later, idle=idle)
        resp = await http.get(f"{base}/frags?first=0&ms=1000")
        await resp.read()
        assert entry.busy(later, idle=idle)
    # The file player's URL is leased (and read) the same way.
    msg = await _ws(client, {"type": "reolink_viewer/playback/url", **ref})
    url = msg["result"]["url"]
    plain = await hass_client_no_auth()
    resp = await plain.get(url)
    await resp.read()
    # The player moved on: both released; the URLs still work, unleased.
    tokens = [base.rsplit("/", 1)[-1], url.split("?")[0].rsplit("/", 1)[-1]]
    msg = await _ws(
        client,
        {"type": "reolink_viewer/playback/release", "tokens": [*tokens, "nope"]},
    )
    assert msg["success"]
    assert not entry.busy(vodcache._clock())
    resp = await http.get(f"{base}/init")
    assert resp.status == 200
    await resp.read()
    assert not entry.busy(vodcache._clock())


async def test_a_window_cut_short_ends_cleanly(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    hass_client: ClientSessionGenerator,
    wired: MockConfigEntry,
    nvr_recording: bytes,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A recording file gone mid-window ends the body; nothing is raised."""
    client = await hass_ws_client(hass)
    camera = await _camera_id(client)
    day = (
        await _ws(
            client,
            {"type": "reolink_viewer/timeline/day", "device_id": camera, "date": DAY},
        )
    )["result"]
    ref = {"device_id": camera, "date": DAY, "segment_id": day["segments"][0]["id"]}
    msg = await _ws(client, {"type": "reolink_viewer/playback/mse", **ref})
    base = msg["result"]["base"]
    http = await hass_client()
    resp = await http.get(f"{base}/init")
    await resp.read()

    def gone(*_args: Any) -> bytes:
        raise FileNotFoundError("the fill failed and removed its file")

    monkeypatch.setattr(vodcache, "_read_fragments", gone)
    resp = await http.get(f"{base}/frags?first=0&ms=4000")
    assert resp.status == 200
    assert resp.headers["X-RV-Count"] == "2"
    assert await resp.read() == b""


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


def test_vod_ttl() -> None:
    """URLs live 30 min plus the recording's length, at most 6 h."""
    source = PlaybackSource("c", "n", "e", 1)
    hour = Recording(source, "sub", "x", 0, 3_600_000)
    assert views.vod_ttl(hour) == timedelta(minutes=90)
    assert views.vod_ttl(Recording(source, "sub", "x", 5, 0)) == views.VOD_TTL
    day = Recording(source, "sub", "x", 0, 86_400_000)
    assert views.vod_ttl(day) == views.VOD_TTL_MAX


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


async def test_peek_stats_and_check_reports(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    reolink_host: MagicMock,
    wired: MockConfigEntry,
) -> None:
    """Peek fetches nothing; stats measure the disk; reports are kept."""
    client = await hass_ws_client(hass)
    camera = await _camera_id(client)
    day = (
        await _ws(
            client,
            {"type": "reolink_viewer/timeline/day", "device_id": camera, "date": DAY},
        )
    )["result"]
    ref = {"device_id": camera, "date": DAY, "segment_id": day["segments"][0]["id"]}
    msg = await _ws(client, {"type": "reolink_viewer/playback/peek", **ref})
    assert msg["result"] == {"segment_id": ref["segment_id"], "cache": None}
    assert reolink_host.get_vod_source.await_count == 0
    msg = await _ws(client, {"type": "reolink_viewer/playback/prefetch", **ref})
    cache = wired.runtime_data.vod_cache
    (entry,) = cache._entries.values()
    assert entry.task is not None
    await entry.task
    for task in list(cache._flat_tasks):
        await task
    msg = await _ws(client, {"type": "reolink_viewer/playback/peek", **ref})
    assert msg["result"]["cache"]["complete"] is True
    # Known only from disk (as after a restart).
    cache._entries.clear()
    msg = await _ws(client, {"type": "reolink_viewer/playback/peek", **ref})
    assert msg["result"]["cache"]["cache"] == "disk"
    msg = await _ws(
        client, {"type": "reolink_viewer/playback/peek", **ref, "segment_id": "1"}
    )
    assert msg["error"]["code"] == "search_failed"

    msg = await _ws(client, {"type": "reolink_viewer/playback/stats"})
    vod = msg["result"]["vod"]
    assert vod["disk_bytes"] >= len(BODY)
    assert vod["reserved_bytes"] == 0
    assert vod["max_bytes"] == cache._max_bytes
    assert "files" in msg["result"]["thumbnails"]

    for text, done in (("first part", False), ("all of it", True)):
        msg = await _ws(
            client,
            {
                "type": "reolink_viewer/playback/check_report",
                "report_id": "run1",
                "setup": "iPhone app, Wi-Fi",
                "text": text,
                "done": done,
            },
        )
        assert msg["success"]
    msg = await _ws(client, {"type": "reolink_viewer/playback/check_reports"})
    (report,) = msg["result"]["reports"]
    assert (report["id"], report["text"], report["done"]) == ("run1", "all of it", True)
    msg = await _ws(
        client,
        {
            "type": "reolink_viewer/playback/check_report",
            "report_id": "",
            "setup": "",
            "text": "",
        },
    )
    assert msg["success"] is False


async def test_check_reports_are_stored(hass: HomeAssistant, hass_storage: Any) -> None:
    """Reports survive a restart; only the most recent are kept."""
    from custom_components.reolink_viewer import checks

    store = checks.CheckReports(hass)
    await store.async_load()
    with patch.object(checks, "MAX_REPORTS", 3):
        for n in range(5):
            store.save(f"r{n}", "desktop", "x" * 10, n % 2 == 0)
        assert [r["id"] for r in store.reports()] == ["r4", "r3", "r2"]
        await hass.async_block_till_done()
        await store._store.async_save(store._data())
        again = checks.CheckReports(hass)
        await again.async_load()
    assert [r["id"] for r in again.reports()] == ["r4", "r3", "r2"]
    hass_storage[checks.STORE_KEY] = {"version": 1, "data": {"reports": [{"x": 1}]}}
    broken = checks.CheckReports(hass)
    await broken.async_load()
    assert broken.reports() == []

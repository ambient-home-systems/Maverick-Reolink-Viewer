"""Our own go2rtc instance: started, supervised and stopped with the entry.

Not Home Assistant's managed go2rtc (its config, credentials and API
allow-list belong to HA). This one:

- listens on its own ports: the API on 127.0.0.1 at a free port picked at each
  start, its RTSP server on 127.0.0.1 likewise (go2rtc's own ffmpeg reads it to
  transcode), and WebRTC on ``WEBRTC_PORT`` (TCP and UDP, for browsers), none
  of them HA's 11984, 18554 or 18555;
- asks for generated credentials on every API and RTSP request, local ones
  included, and serves only the API paths the integration uses (no web UI);
- never writes a camera credential to disk: its config file holds no secret
  (the password comes from the environment), streams are registered at
  runtime through the API, and the config path go2rtc saves API changes to is
  ``/dev/null``;
- is restarted with backoff when it exits or its API stops answering; each
  start is a new *generation*, so registered streams are registered again;
- logs through Home Assistant's logger with camera URLs and addresses removed.
"""

import asyncio
import base64
from collections import deque
from collections.abc import AsyncIterator, Callable
import contextlib
from datetime import UTC, datetime
import json
import logging
import os
from pathlib import Path
import secrets
import socket
import time
from typing import Any

from aiohttp import (
    ClientResponse,
    ClientSession,
    ClientTimeout,
    ClientWebSocketResponse,
    ClientWSTimeout,
)

from custom_components.reolink_viewer import bridge
from homeassistant.core import HomeAssistant

from .binary import Binary, BinaryError, async_find_binary

_LOGGER = logging.getLogger(__name__)

# WebRTC media for browsers (TCP and UDP). HA's own go2rtc uses 18555.
WEBRTC_PORT = 18556
USERNAME = "reolink_viewer"
PASSWORD_ENV = "REOLINK_VIEWER_GO2RTC_PASSWORD"  # noqa: S105 - a variable name
CONFIG_NAME = "go2rtc.json"
# The modules the integration uses: sources (rtsp, http for HTTP-FLV, rtmp),
# outputs (webrtc, mp4 for MSE and stream.mp4, mjpeg for frame.jpeg), the API
# and websocket, and ffmpeg (with exec, limited to ffmpeg) for transcoding.
MODULES = (
    "api",
    "ws",
    "http",
    "rtsp",
    "rtmp",
    "webrtc",
    "mp4",
    "mjpeg",
    "ffmpeg",
    "exec",
)
API_PATHS = (
    "/api",  # version
    "/api/streams",  # register streams, read their state
    "/api/preload",  # keep streams warm
    "/api/ws",  # WebRTC signaling and MSE
    "/api/frame.jpeg",  # a frame from a running stream
    "/api/stream.mp4",  # the capacity test reads streams with it
)
BOOT_MESSAGE = "[api] listen addr="
START_TIMEOUT = 30.0
STOP_TIMEOUT = 5.0
API_TIMEOUT = 10.0
HEALTH_EVERY = 30.0
# Waits between restarts; back to the first once it ran this long.
BACKOFF_S = (1.0, 2.0, 5.0, 10.0, 30.0, 60.0)
STABLE_S = 300.0
LOG_LINES = 50
# go2rtc's level names -> ours. Unknown lines (e.g. pion's) are debug.
LEVELS = {
    "TRC": logging.DEBUG,
    "DBG": logging.DEBUG,
    "INF": logging.DEBUG,
    "WRN": logging.WARNING,
    "ERR": logging.WARNING,
    "FTL": logging.ERROR,
    "PNC": logging.ERROR,
}


class Go2rtcError(Exception):
    """go2rtc is not running, or refused a request."""


def build_config(
    *, api_port: int, rtsp_port: int, ffmpeg: str | None
) -> dict[str, Any]:
    """Return go2rtc's configuration (no secret in it: see PASSWORD_ENV)."""
    password = f"${{{PASSWORD_ENV}}}"
    config: dict[str, Any] = {
        "app": {"modules": list(MODULES)},
        "api": {
            "listen": f"127.0.0.1:{api_port}",
            "username": USERNAME,
            "password": password,
            "local_auth": True,
            "allow_paths": list(API_PATHS),
        },
        "rtsp": {
            "listen": f"127.0.0.1:{rtsp_port}",
            "username": USERNAME,
            "password": password,
        },
        # ICE servers come with each offer (Home Assistant's, see live/webrtc).
        "webrtc": {"listen": f":{WEBRTC_PORT}", "ice_servers": []},
        "exec": {"allow_paths": [ffmpeg or "ffmpeg"]},
        "log": {"level": "info"},
    }
    if ffmpeg:
        config["ffmpeg"] = {"bin": ffmpeg}
    return config


def redact(line: str) -> str:
    """Remove URLs (they carry camera credentials) and addresses from a line."""
    return bridge.redact_text(line, ())


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        port: int = sock.getsockname()[1]
        return port


class Go2rtcServer:
    """Runs go2rtc and keeps it running until stopped."""

    def __init__(
        self,
        hass: HomeAssistant,
        directory: Path,
        session: Callable[[], ClientSession],
        *,
        ffmpeg: str | None,
        find_binary: Callable[[], Any] | None = None,
    ) -> None:
        """Initialize (call async_start to run it)."""
        self._hass = hass
        self._dir = directory
        self._session = session
        self._ffmpeg = ffmpeg
        self._find_binary = find_binary or (
            lambda: async_find_binary(hass, directory, session())
        )
        self._password = secrets.token_urlsafe(24)
        self._binary: Binary | None = None
        self._process: asyncio.subprocess.Process | None = None
        self._task: asyncio.Task[None] | None = None
        self._ready = asyncio.Event()
        # Set while go2rtc cannot run (no binary, or it failed to start twice
        # in a row): requests fail at once instead of waiting.
        self._failed = asyncio.Event()
        self._log: deque[str] = deque(maxlen=LOG_LINES)
        self.api_port = 0
        self.rtsp_port = 0
        self.generation = 0
        self.restarts = 0
        self.state = "stopped"
        self.error: str | None = None
        self.version: str | None = None
        self.started_at: datetime | None = None
        self._listeners: list[Callable[[], None]] = []

    # ---- Lifecycle ----

    async def async_start(self) -> None:
        """Start supervising go2rtc (returns at once; see ``async_ready``)."""
        if self._task is not None:
            return
        self.state = "starting"
        self._task = self._hass.async_create_background_task(
            self._supervise(), "reolink_viewer go2rtc"
        )

    async def async_stop(self) -> None:
        """Stop go2rtc and its supervision."""
        task, self._task = self._task, None
        if task is not None:
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task
        await self._terminate()
        self.state = "stopped"
        self._ready.clear()
        self._failed.clear()

    async def async_ready(self, timeout: float = START_TIMEOUT) -> None:
        """Wait until go2rtc answers, or raise Go2rtcError (at once if it cannot run)."""
        if self._ready.is_set():
            return
        if self._task is None:
            raise Go2rtcError("go2rtc is not running")
        if not self._failed.is_set():
            waits = [
                asyncio.ensure_future(self._ready.wait()),
                asyncio.ensure_future(self._failed.wait()),
            ]
            try:
                await asyncio.wait(
                    waits, timeout=timeout, return_when=asyncio.FIRST_COMPLETED
                )
            finally:
                for wait in waits:
                    wait.cancel()
        if not self._ready.is_set():
            raise Go2rtcError(self.error or "go2rtc did not start")

    def add_listener(self, listener: Callable[[], None]) -> Callable[[], None]:
        """Call ``listener`` after each (re)start; returns the remover."""
        self._listeners.append(listener)

        def remove() -> None:
            if listener in self._listeners:
                self._listeners.remove(listener)

        return remove

    def status(self, *, log: bool = False) -> dict[str, Any]:
        """Return the state for the panel (no secret, no address)."""
        result: dict[str, Any] = {
            "state": self.state,
            "version": self.version,
            "binary": self._binary.source if self._binary else None,
            "error": self.error,
            "restarts": self.restarts,
            "generation": self.generation,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "webrtc_port": WEBRTC_PORT,
        }
        if log:
            result["log"] = list(self._log)
        return result

    async def _supervise(self) -> None:
        attempt = 0
        failed_starts = 0
        while True:
            began = time.monotonic()
            generation = self.generation
            try:
                if self._binary is None:
                    self._binary = await self._find_binary()
                    self.version = self._binary.version
                await self._run_once()
            except asyncio.CancelledError:
                raise
            except BinaryError as err:
                # Nothing to run (it is tried again, slowly: a download may work).
                if not self._failed.is_set():
                    _LOGGER.error("Live view is unavailable: %s", err)
                self.error = str(err)
                failed_starts = 2
            except Exception as err:  # noqa: BLE001 - restarted below
                self.error = f"go2rtc stopped: {err}"
                failed_starts = (
                    0 if self.generation != generation else failed_starts + 1
                )
                _LOGGER.warning(
                    "go2rtc stopped (%s); restarting. Last output:\n%s",
                    err,
                    "\n".join(list(self._log)[-10:]),
                )
            self._ready.clear()
            if failed_starts >= 2:
                self._failed.set()
            await self._terminate()
            if time.monotonic() - began > STABLE_S:
                attempt = 0
            delay = BACKOFF_S[min(attempt, len(BACKOFF_S) - 1)]
            attempt += 1
            self.restarts += 1
            self.state = "failed" if self._failed.is_set() else "restarting"
            await asyncio.sleep(delay)
            if not self._failed.is_set():
                self.state = "starting"

    async def _run_once(self) -> None:
        """Start go2rtc, wait for its API, then watch it until it fails."""
        assert self._binary is not None
        self.api_port, self.rtsp_port = _free_port(), _free_port()
        config = build_config(
            api_port=self.api_port, rtsp_port=self.rtsp_port, ffmpeg=self._ffmpeg
        )
        path = self._dir / CONFIG_NAME
        await self._hass.async_add_executor_job(_write_config, path, config)
        booted = asyncio.Event()
        self._process = process = await asyncio.create_subprocess_exec(
            self._binary.path,
            # API changes are saved to the first config path: /dev/null.
            "-config",
            os.devnull,
            "-config",
            str(path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            env={**os.environ, PASSWORD_ENV: self._password},
            cwd=self._dir,
        )
        reader = self._hass.async_create_background_task(
            self._read_output(process, booted), "reolink_viewer go2rtc output"
        )
        exited = asyncio.ensure_future(process.wait())
        try:
            boot = asyncio.ensure_future(booted.wait())
            try:
                async with asyncio.timeout(START_TIMEOUT):
                    await asyncio.wait(
                        [exited, boot], return_when=asyncio.FIRST_COMPLETED
                    )
            except TimeoutError:
                raise Go2rtcError("did not start within 30 s") from None
            finally:
                boot.cancel()
            if exited.done():
                raise Go2rtcError(f"exited with code {process.returncode}")
            info = await self._api_json("GET", "/api")
            self.version = str(info.get("version") or self.version)
            self.generation += 1
            self.state = "running"
            self.error = None
            self._failed.clear()
            self.started_at = datetime.now(UTC)
            self._ready.set()
            _LOGGER.debug(
                "go2rtc %s running (generation %d)", self.version, self.generation
            )
            for listener in list(self._listeners):
                listener()
            await self._watch(exited)
        finally:
            self._ready.clear()
            if process.returncode is not None:
                # Let the reader take go2rtc's last lines (why it stopped).
                await asyncio.wait([reader], timeout=1)
            reader.cancel()
            exited.cancel()

    async def _watch(self, exited: asyncio.Future[int]) -> None:
        """Return (raising) when go2rtc exits or its API stops answering."""
        while True:
            try:
                async with asyncio.timeout(HEALTH_EVERY):
                    await asyncio.shield(exited)
            except TimeoutError:
                await self._api_json("GET", "/api")
            else:
                raise Go2rtcError(f"exited with code {exited.result()}")

    async def _read_output(
        self, process: asyncio.subprocess.Process, booted: asyncio.Event
    ) -> None:
        assert process.stdout is not None
        async for raw in process.stdout:
            line = redact(raw.decode(errors="replace").rstrip())
            if not line:
                continue
            self._log.append(line)
            if BOOT_MESSAGE in line:
                booted.set()
            parts = line.split(" ", 2)
            level = LEVELS.get(parts[1], logging.DEBUG) if len(parts) == 3 else None
            _LOGGER.log(level or logging.DEBUG, "go2rtc: %s", line)

    async def _terminate(self) -> None:
        process, self._process = self._process, None
        if process is None or process.returncode is not None:
            return
        with contextlib.suppress(ProcessLookupError):
            process.terminate()
        try:
            async with asyncio.timeout(STOP_TIMEOUT):
                await process.wait()
        except TimeoutError:
            _LOGGER.warning("go2rtc did not stop; killing it")
            with contextlib.suppress(ProcessLookupError):
                process.kill()
            await process.wait()

    # ---- API ----

    @property
    def _base(self) -> str:
        return f"http://127.0.0.1:{self.api_port}"

    @property
    def auth_header(self) -> str:
        """The Authorization header of go2rtc's API (never sent to a browser)."""
        token = base64.b64encode(f"{USERNAME}:{self._password}".encode()).decode()
        return f"Basic {token}"

    @contextlib.asynccontextmanager
    async def request(
        self,
        method: str,
        path: str,
        params: dict[str, str] | list[tuple[str, str]] | None = None,
        *,
        timeout: float | None = API_TIMEOUT,
    ) -> AsyncIterator[ClientResponse]:
        """Send a request to go2rtc's API (it must be running)."""
        if not self._ready.is_set() and path != "/api":
            raise Go2rtcError(self.error or "go2rtc is not running")
        async with self._session().request(
            method,
            self._base + path,
            params=params,
            headers={"Authorization": self.auth_header},
            timeout=ClientTimeout(total=timeout, sock_connect=5),
        ) as response:
            yield response

    async def _api_json(
        self, method: str, path: str, params: dict[str, str] | None = None
    ) -> dict[str, Any]:
        async with self.request(method, path, params) as response:
            if response.status != 200:
                raise Go2rtcError(f"{path}: HTTP {response.status}")
            data = await response.json(content_type=None)
        return data if isinstance(data, dict) else {}

    async def _api_change(self, method: str, path: str, params: dict[str, str]) -> None:
        """Make a change go2rtc applies, then fails to save to /dev/null.

        go2rtc applies a change in memory first and then saves it to its
        config path; /dev/null has nothing to patch, so some answers are an
        error about that. The caller checks the result where it matters.
        """
        async with self.request(method, path, params) as response:
            text = await response.text()
            if response.status != 200 and "yaml" not in text:
                raise Go2rtcError(f"{path}: HTTP {response.status}: {redact(text)}")

    async def async_set_stream(self, name: str, source: str) -> None:
        """Register (or replace) a stream in memory; nothing is saved."""
        async with self.request(
            "PATCH", "/api/streams", {"name": name, "src": source}
        ) as response:
            if response.status != 200:
                text = redact(await response.text())
                raise Go2rtcError(
                    f"cannot register a stream: HTTP {response.status} {text}"
                )

    async def async_delete_stream(self, name: str) -> None:
        """Remove a stream (its producer stops)."""
        await self._api_change("DELETE", "/api/streams", {"src": name})

    async def async_stream_state(self, name: str) -> dict[str, Any] | None:
        """Return a stream's state without its sources (they carry credentials).

        ``active``: a producer is connected to the camera; ``bytes``: what it
        received; ``consumers``: who reads it (sessions, preload).
        """
        async with self.request("GET", "/api/streams", {"src": name}) as response:
            if response.status == 404:
                return None
            if response.status != 200:
                raise Go2rtcError(f"stream state: HTTP {response.status}")
            data = await response.json(content_type=None)
        return stream_state(data)

    async def async_preload(self, name: str, enabled: bool) -> None:
        """Keep a stream's producer running without a viewer (go2rtc preload)."""
        await self._api_change(
            "PUT" if enabled else "DELETE", "/api/preload", {"src": name}
        )

    async def async_preloads(self) -> set[str]:
        """Return the names of the streams kept warm."""
        return set(await self._api_json("GET", "/api/preload"))

    @contextlib.asynccontextmanager
    async def ws(self, name: str) -> AsyncIterator[ClientWebSocketResponse]:
        """Open go2rtc's websocket API for a stream (WebRTC signaling, MSE)."""
        if not self._ready.is_set():
            raise Go2rtcError(self.error or "go2rtc is not running")
        async with self._session().ws_connect(
            f"{self._base}/api/ws",
            params={"src": name},
            headers={"Authorization": self.auth_header},
            timeout=ClientWSTimeout(ws_receive=None, ws_close=5.0),
            max_msg_size=0,
        ) as socket_:
            yield socket_


def stream_state(data: Any) -> dict[str, Any]:
    """Summarize go2rtc's stream object without its source URLs."""
    if not isinstance(data, dict):
        return {"active": False, "bytes": 0, "producers": 0, "consumers": 0}
    producers = [p for p in data.get("producers") or [] if isinstance(p, dict)]
    consumers = [c for c in data.get("consumers") or [] if isinstance(c, dict)]
    running = [p for p in producers if "receivers" in p or "bytes_recv" in p]
    codecs = sorted(
        {
            str(r.get("codec", {}).get("codec_name"))
            for p in running
            for r in p.get("receivers") or []
            if isinstance(r, dict) and isinstance(r.get("codec"), dict)
        }
    )
    return {
        "active": bool(running),
        "bytes": sum(int(p.get("bytes_recv") or 0) for p in running),
        "producers": len(producers),
        "consumers": len(consumers),
        "codecs": codecs,
    }


def _write_config(path: Path, config: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(config, indent=1))

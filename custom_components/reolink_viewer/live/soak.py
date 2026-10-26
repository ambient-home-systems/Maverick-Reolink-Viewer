"""The soak report's server side: what live view holds, sampled every SAMPLE_S.

Phase 3's exit criteria ask for 24 hours with the grid open: no reconnect
loops, no growth in the sessions to the cameras, the cameras within their
limits, and battery cameras asleep when nobody watches them. While the
integration runs, this keeps a sample every SAMPLE_S, the last KEEP of them
(36 h):

- go2rtc: its state, its restarts and its memory;
- the WebRTC sessions, and the MSE feeds (open, kept warm, viewers, ended);
- each host's stream slots in use (the sessions to its cameras), its limit
  and how many wait, and its CPU as it last reported it;
- each camera on battery: whether it sleeps, and whether a stream of it is
  held (watched).

It also keeps the soak run: since when the grid has been open, how long
it was open and visible, how many times it opened, and what its tiles
counted. The grid sends what it counted every minute (``live/soak/count``),
so a run outlives the page: Home Assistant unloads a panel whose page was
hidden for 5 minutes, and a page may reload; the grid then carries on with
the same run. The first grid to report starts a run; Start over starts a new
one. Runs and samples are kept in memory: restarting Home Assistant starts
over.

The panel's soak report (``live/soak``) reads the run and the samples since
it started, on any device. Sampling reads only what is in memory, and
go2rtc's memory from /proc: no camera I/O.
"""

import asyncio
from collections import deque
import contextlib
import logging
import time
from typing import TYPE_CHECKING, Any

from custom_components.reolink_viewer import bridge, devices
from homeassistant.core import HomeAssistant, callback

from .streams import LiveStream

if TYPE_CHECKING:
    from .service import LiveService

_LOGGER = logging.getLogger(__name__)

SAMPLE_S = 300.0
KEEP = 36 * 3600 // int(SAMPLE_S)
# What a tile counts: first frames, ends after one, failed starts.
COUNTS = ("plays", "drops", "failures")
# Bounds on what pages may add to a run.
MAX_CAMERAS = 64
MAX_DEVICES = 8


def _now_ms() -> int:
    return round(time.time() * 1000)


def _copy(run: dict[str, Any]) -> dict[str, Any]:
    return {
        **run,
        "tiles": {camera: dict(c) for camera, c in run["tiles"].items()},
        "devices": dict(run["devices"]),
    }


class SoakRecorder:
    """Samples what live view holds, for the soak report."""

    def __init__(self, hass: HomeAssistant, service: LiveService) -> None:
        """Initialize (nothing runs until start)."""
        self._hass = hass
        self._service = service
        self._samples: deque[dict[str, Any]] = deque(maxlen=KEEP)
        self._task: asyncio.Task[None] | None = None
        # The soak run, once a grid has reported.
        self._current: dict[str, Any] | None = None

    @callback
    def start(self) -> None:
        """Start sampling (once Home Assistant has started)."""
        if self._task is None:
            self._task = self._hass.async_create_background_task(
                self._run(), "reolink_viewer soak samples"
            )

    async def _run(self) -> None:
        while True:
            try:
                self._samples.append(await self.async_sample())
            except Exception:
                _LOGGER.exception("Cannot sample live view for the soak report")
            await asyncio.sleep(SAMPLE_S)

    def samples(self, since_ms: int = 0) -> list[dict[str, Any]]:
        """Return the samples taken since then (epoch ms), oldest first."""
        return [s for s in self._samples if s["at"] >= since_ms]

    @property
    def run(self) -> dict[str, Any] | None:
        """Return the soak run (a copy), or None before a grid has reported."""
        return None if self._current is None else _copy(self._current)

    def start_over(self, device: str, *, grid_open: bool) -> dict[str, Any]:
        """Start a new run now (the grid open on the page asking, or not)."""
        now = _now_ms()
        run = self._current = {
            "started_at": now,
            "opens": 1 if grid_open else 0,
            "open_ms": 0,
            "visible_ms": 0,
            "tiles": {},
            "devices": {device: now},
        }
        return _copy(run)

    def count(
        self,
        device: str,
        *,
        opens: int,
        open_ms: int,
        visible_ms: int,
        tiles: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Add what a grid counted since it last reported; start a run if none."""
        now = _now_ms()
        run = self._current
        if run is None:
            # The first grid to report starts the run, when it opened.
            run = self._current = {
                "started_at": now - open_ms,
                "opens": 0,
                "open_ms": 0,
                "visible_ms": 0,
                "tiles": {},
                "devices": {},
            }
        run["opens"] += opens
        run["open_ms"] += open_ms
        run["visible_ms"] += visible_ms
        counted: dict[str, dict[str, int]] = run["tiles"]
        for tile in tiles:
            camera = tile["camera"]
            if camera not in counted:
                if len(counted) >= MAX_CAMERAS:
                    continue
                counted[camera] = dict.fromkeys(COUNTS, 0)
            for kind in COUNTS:
                counted[camera][kind] += tile[kind]
        seen: dict[str, int] = run["devices"]
        seen.pop(device, None)
        seen[device] = now
        while len(seen) > MAX_DEVICES:
            del seen[next(iter(seen))]
        return _copy(run)

    async def async_sample(self) -> dict[str, Any]:
        """Return what live view holds now."""
        service = self._service
        status = service.server.status()
        memory = await self._hass.async_add_executor_job(service.server.memory_kb)
        running = service.registry.running()
        return {
            "at": _now_ms(),
            "go2rtc": {
                "state": status["state"],
                "restarts": status["restarts"],
                "memory_kb": memory,
            },
            "webrtc_sessions": len(service.sessions),
            "feeds": service.relay.stats(),
            "hosts": self._hosts(),
            "battery": self._battery(running),
        }

    def _hosts(self) -> list[dict[str, Any]]:
        hosts = []
        for key, stats in self._service.scheduler.stats().items():
            entry = self._hass.config_entries.async_get_entry(key)
            try:
                cpu = bridge.async_get_host(self._hass, key).cpu_usage()
            except bridge.HostNotFoundError:
                cpu = None
            hosts.append(
                {
                    "name": entry.title if entry else "unknown host",
                    "streams": stats["streams"],
                    "limit": stats["stream_limit"],
                    "waiting": stats["streams_waiting"],
                    "cpu": cpu,
                }
            )
        return hosts

    def _battery(self, running: dict[str, int]) -> list[dict[str, Any]]:
        cameras = []
        for source in devices.async_image_sources(self._hass).values():
            if not source.is_battery:
                continue
            sleeping: bool | None
            try:
                details = bridge.async_get_host(
                    self._hass, source.entry_id
                ).channel_details(source.channel)
                sleeping = bool(details.get("sleeping"))
            except Exception:  # unknown, as in the report  # noqa: BLE001
                sleeping = None
            names = {LiveStream(source, kind).name for kind in devices.LIVE_STREAMS}
            cameras.append(
                {
                    "camera": source.name,
                    "sleeping": sleeping,
                    "watched": any(running.get(name, 0) > 0 for name in names),
                }
            )
        return cameras

    async def async_shutdown(self) -> None:
        """Stop sampling."""
        if self._task is not None:
            self._task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._task
            self._task = None

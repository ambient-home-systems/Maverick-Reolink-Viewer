"""Hardware discovery probe (Phase 0).

Records, per host and channel: identity and encodings, which live sources work
and their time-to-first-frame, which VOD methods work and their
time-to-first-byte, Baichuan event search / snapshot_past support and latency,
and (opt-in) how many concurrent streams the device tolerates.

Safety rules:

- Never change device settings. RTMP VOD is skipped unless the RTMP port is
  already on (reolink-aio's get_vod_source(RTMP) would enable it); the bridge
  enforces this too.
- Battery cameras are skipped unless explicitly included (probing wakes them).
- The concurrent-stream test is opt-in, capped, stops at the first failure and
  runs as one exclusive scheduler job so nothing else hits the host meanwhile.
- All device traffic goes through the scheduler at prefetch (lowest) priority.
- The recording playback check (Phase 2 gate, ``probe_playback.py``) is opt-in;
  its simultaneous-stream test is a separate opt-in, capped and exclusive.
- The report is redacted: passwords, tokens, UIDs, serial numbers and MAC
  addresses are removed and no URL is ever recorded.
"""

import asyncio
from collections.abc import Awaitable, Callable, Hashable, Iterable
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta
from functools import partial
import logging
import time
from typing import Any

from aiohttp import ClientSession

from homeassistant.const import __version__ as ha_version
from homeassistant.util import dt as dt_util

from .bridge import (
    CameraUrl,
    ChannelInfo,
    CompatReport,
    HostInfo,
    LiveProtocol,
    NotApplicableError,
    ReolinkHostHandle,
    VodFile,
    VodMethod,
    redact_text,
)
from .const import (
    PROBE_DEFAULT_MAX_STREAMS,
    PROBE_HARD_MAX_STREAMS,
    PROBE_SCHEMA_VERSION,
    PROBE_SEARCH_DAYS,
    PROBE_STEP_TIMEOUT,
)
from .media import (
    ByteResult,
    FrameResult,
    async_first_bytes,
    async_first_frame,
    async_hold_stream,
)
from .probe_baichuan import NOT_RECORDER, BaichuanCheck, BaichuanOptions
from .probe_playback import PlaybackCheck, PlaybackOptions
from .scheduler import Priority, Scheduler

_LOGGER = logging.getLogger(__name__)

LIVE_STREAMS: tuple[str, ...] = ("main", "sub", "ext")
VOD_STREAMS: tuple[str, ...] = ("main", "sub")
# NVR_DOWNLOAD last: its "prepare" step can leave an NVR busy for a while, which
# made later requests fail in the first hardware run.
VOD_ORDER: tuple[VodMethod, ...] = (
    VodMethod.PLAYBACK,
    VodMethod.DOWNLOAD,
    VodMethod.FLV,
    VodMethod.RTMP,
    VodMethod.NVR_DOWNLOAD,
)
PROBE_PRIORITY = Priority.PREFETCH
# Recordings that ended less than this long ago may still be being written.
RECORDING_SETTLE = timedelta(minutes=2)
CONCURRENCY_COOLDOWN = 2.0

type ProgressCallback = Callable[[str], None]


@dataclass(slots=True)
class ProbeOptions:
    """User-selectable probe options."""

    entry_ids: list[str] | None = None
    include_battery: bool = False
    concurrency_test: bool = False
    max_streams: int = PROBE_DEFAULT_MAX_STREAMS
    hold_seconds: float = 5.0
    step_timeout: float = PROBE_STEP_TIMEOUT
    playback: PlaybackOptions = field(default_factory=PlaybackOptions)
    baichuan: BaichuanOptions = field(default_factory=BaichuanOptions)

    def __post_init__(self) -> None:
        """Clamp to safe values."""
        self.max_streams = max(1, min(self.max_streams, PROBE_HARD_MAX_STREAMS))
        self.hold_seconds = max(1.0, min(self.hold_seconds, 15.0))
        self.step_timeout = max(5.0, min(self.step_timeout, 60.0))


def _skipped(reason: str) -> dict[str, Any]:
    return {"ok": False, "skipped": reason}


def _ms(start: float) -> float:
    return round((time.monotonic() - start) * 1000, 1)


def _err(err: BaseException) -> str:
    if isinstance(err, TimeoutError):
        return "timeout"
    text = str(err) or type(err).__name__
    return f"{type(err).__name__}: {text}"[:300]


class Prober:
    """Runs the probe over a set of hosts."""

    def __init__(
        self,
        scheduler: Scheduler,
        hosts: list[ReolinkHostHandle],
        *,
        options: ProbeOptions,
        compat: CompatReport,
        ffmpeg_binary: str,
        ffmpeg_version: str | None,
        session: ClientSession,
        integration_version: str,
        progress: ProgressCallback | None = None,
    ) -> None:
        """Initialize the prober."""
        self._scheduler = scheduler
        self._hosts = hosts
        self._options = options
        self._compat = compat
        self._ffmpeg = ffmpeg_binary
        self._ffmpeg_version = ffmpeg_version
        self._session = session
        self._integration_version = integration_version
        self._progress = progress

    def _report_progress(self, message: str) -> None:
        if self._progress is not None:
            self._progress(message)

    async def _job[T](
        self,
        host: ReolinkHostHandle,
        factory: Callable[[], Awaitable[T]],
        *,
        key: Hashable | None = None,
        timeout: float | None = None,
        exclusive: bool = False,
    ) -> T:
        return await self._scheduler.run(
            host.entry_id,
            factory,
            priority=PROBE_PRIORITY,
            key=key,
            timeout=self._options.step_timeout if timeout is None else timeout,
            exclusive=exclusive,
        )

    async def async_run(self) -> dict[str, Any]:
        """Run the probe and return the redacted report."""
        started = dt_util.utcnow()
        start = time.monotonic()
        hosts = self._hosts
        if self._options.entry_ids:
            wanted = set(self._options.entry_ids)
            hosts = [h for h in hosts if h.entry_id in wanted]

        # Each host records its own errors (see _probe_host_safe), so one failing
        # host never fails the report. The TaskGroup still cancels every sibling
        # if anything escapes (e.g. the probe itself is cancelled).
        async with asyncio.TaskGroup() as group:
            tasks = [
                group.create_task(self._probe_host_safe(index, host))
                for index, host in enumerate(hosts, 1)
            ]
        results = [task.result() for task in tasks]
        report = {
            "schema_version": PROBE_SCHEMA_VERSION,
            "generated_at": started.isoformat(),
            "duration_ms": _ms(start),
            "integration_version": self._integration_version,
            "ha_version": ha_version,
            "reolink_aio_version": self._compat.reolink_aio_version,
            "ffmpeg_version": self._ffmpeg_version,
            "compat": self._compat.as_dict(),
            "options": {
                k: v for k, v in asdict(self._options).items() if k != "entry_ids"
            },
            "hosts": list(results),
        }
        secrets: list[str] = []
        for host in hosts:
            secrets.extend(host.secrets())
        redacted: dict[str, Any] = redact(
            report, secrets, [h.hide_password for h in hosts]
        )
        return redacted

    async def _probe_host_safe(
        self, index: int, host: ReolinkHostHandle
    ) -> dict[str, Any]:
        """Probe one host, recording an unexpected failure instead of raising."""
        try:
            return await self._probe_host(index, host)
        except Exception as err:
            _LOGGER.debug("Probe of host%s failed", index, exc_info=True)
            return {"id": f"host{index}", "error": _err(err)}

    async def _probe_host(self, index: int, host: ReolinkHostHandle) -> dict[str, Any]:
        start = time.monotonic()
        label = f"host{index}"
        try:
            info = host.info()
        except Exception as err:  # noqa: BLE001 - recorded in the report
            return {"id": label, "error": _err(err)}
        self._report_progress(f"{label}: {info.model} ({info.device_type})")

        result: dict[str, Any] = {
            "id": label,
            "title": info.title,
            "identity": _identity(info),
            "ports": await self._ports(host, info),
        }
        playback = self._playback_check(host)
        now: datetime | None = None
        if playback is not None:
            try:
                now = await self._job(host, host.async_get_time, key=("time",))
                result["time"] = playback.time_info(now)
            except Exception as err:  # noqa: BLE001
                result["time"] = {"error": f"cannot read device time: {_err(err)}"}

        channels: list[dict[str, Any]] = []
        playback_files: dict[str, list[tuple[int, VodFile]]] = {"main": [], "sub": []}
        for channel in info.channels:
            self._report_progress(f"{label} ch{channel.channel}: {channel.model}")
            probed = await self._probe_channel(host, info, channel)
            if playback is not None and "skipped" not in probed:
                if now is None:
                    probed["playback"] = {"ok": False, "error": "no device time"}
                else:
                    probed["playback"], files = await playback.async_channel(
                        channel, now
                    )
                    for stream, file in files.items():
                        playback_files[stream].append((channel.channel, file))
            channels.append(probed)
        result["channels"] = channels
        if self._options.playback.only:
            result["concurrency"] = _skipped("recording playback check only")
        else:
            result["concurrency"] = await self._concurrency(host, info, channels)
        if playback is not None:
            result["playback_concurrency"] = await playback.async_concurrency(
                playback_files["sub"], playback_files["main"]
            )
        if self._options.baichuan.enabled:
            result["baichuan_replay"] = await self._baichuan_replay(host, info)
        result["duration_ms"] = _ms(start)
        return result

    async def _baichuan_replay(
        self, host: ReolinkHostHandle, info: HostInfo
    ) -> dict[str, Any]:
        """Run the Phase 5a replay check (opt-in, read-only)."""

        def job[T](
            factory: Callable[[], Awaitable[T]],
            *,
            timeout: float | None = None,
            exclusive: bool = False,
        ) -> Awaitable[T]:
            return self._job(host, factory, timeout=timeout, exclusive=exclusive)

        check = BaichuanCheck(
            host,
            job,
            self._session,
            self._scheduler.host(host.entry_id),
            self._options.baichuan,
            step_timeout=self._options.step_timeout,
            progress=self._report_progress,
        )
        if not info.is_nvr:
            return {"ok": False, "skipped": NOT_RECORDER}
        try:
            now = await self._job(host, host.async_get_time, key=("time",))
            return await check.async_host(info, list(info.channels), now)
        except Exception as err:
            _LOGGER.debug("Baichuan replay check failed", exc_info=True)
            return {"ok": False, "error": _err(err)}

    def _playback_check(self, host: ReolinkHostHandle) -> PlaybackCheck | None:
        if not self._options.playback.enabled:
            return None

        def job[T](
            factory: Callable[[], Awaitable[T]],
            *,
            timeout: float | None = None,
            exclusive: bool = False,
        ) -> Awaitable[T]:
            return self._job(host, factory, timeout=timeout, exclusive=exclusive)

        return PlaybackCheck(
            host,
            job,
            self._session,
            self._options.playback,
            step_timeout=self._options.step_timeout,
            progress=self._report_progress,
        )

    async def _ports(self, host: ReolinkHostHandle, info: HostInfo) -> dict[str, Any]:
        ports: dict[str, Any] = {
            "rtsp_enabled": info.rtsp_enabled,
            "rtmp_enabled": info.rtmp_enabled,
            "onvif_enabled": info.onvif_enabled,
            "supports_rtsp": info.supports_rtsp,
            "supports_rtmp": info.supports_rtmp,
            "supports_flv": info.supports_flv,
            "refreshed": False,
        }
        if info.rtmp_enabled is None:
            # Unknown: read the port state (GetNetPort is read-only).
            try:
                ports["rtmp_enabled"] = await self._job(
                    host, host.async_refresh_ports, key=("ports",)
                )
                ports["refreshed"] = True
            except Exception as err:  # noqa: BLE001
                ports["error"] = _err(err)
        return ports

    def _skip_reason(self, channel: ChannelInfo) -> str | None:
        if not channel.online:
            return "offline"
        if not channel.supports_stream:
            return "no stream on this channel"
        if channel.is_battery and not self._options.include_battery:
            return "battery camera (opt-in: include_battery)"
        if channel.sleeping:
            return "sleeping"
        return None

    async def _probe_channel(
        self, host: ReolinkHostHandle, info: HostInfo, channel: ChannelInfo
    ) -> dict[str, Any]:
        ch = channel.channel
        result: dict[str, Any] = {
            "channel": ch,
            "name": channel.name,
            "model": channel.model,
            "hardware_version": channel.hardware_version,
            "firmware_version": channel.firmware_version,
            "online": channel.online,
            "sleeping": channel.sleeping,
            "is_battery": channel.is_battery,
            "is_doorbell": channel.is_doorbell,
            "supports_replay": channel.supports_replay,
            "encodings": {
                "main": asdict(channel.main),
                "sub": asdict(channel.sub),
            },
        }
        if (reason := self._skip_reason(channel)) is not None:
            result["skipped"] = reason
            return result
        if self._options.playback.only:
            return result

        # Fresh encodings (GetEnc) in case the cached data is incomplete.
        for stream in ("main", "sub"):
            try:
                result["encodings"][stream]["codec"] = await self._job(
                    host,
                    partial(host.async_get_encoding, ch, stream),
                    key=("enc", ch, stream),
                )
            except Exception as err:  # noqa: BLE001
                result["encodings"][stream]["error"] = _err(err)

        result["live"] = await self._live(host, info, ch)
        result["vod"], vod_file = await self._vod(host, info, channel)
        result["baichuan"] = await self._baichuan(host, ch, vod_file)
        return result

    # ---- Live ----

    async def _live(
        self, host: ReolinkHostHandle, info: HostInfo, ch: int
    ) -> dict[str, Any]:
        live: dict[str, Any] = {}
        for protocol in LiveProtocol:
            live[protocol.value] = {}
            reason = self._live_skip_reason(host, info, protocol)
            for stream in LIVE_STREAMS:
                if reason is not None:
                    live[protocol.value][stream] = _skipped(reason)
                    continue
                self._report_progress(f"ch{ch} live {protocol.value} {stream}")
                live[protocol.value][stream] = await self._live_one(
                    host, ch, protocol, stream
                )
        return live

    def _live_skip_reason(
        self, host: ReolinkHostHandle, info: HostInfo, protocol: LiveProtocol
    ) -> str | None:
        if info.baichuan_only and protocol is not LiveProtocol.RTSP:
            return "baichuan-only connection"
        if protocol is LiveProtocol.RTSP:
            if info.rtsp_enabled is False:
                return "RTSP port disabled"
            if not info.supports_rtsp:
                return "RTSP not supported"
        elif protocol is LiveProtocol.RTMP and host.rtmp_enabled is False:
            return "RTMP port disabled"
        elif protocol is LiveProtocol.RTMP and not info.supports_rtmp:
            return "RTMP not supported"
        elif protocol is LiveProtocol.FLV and not info.supports_flv:
            return "FLV not supported"
        return None

    async def _live_one(
        self, host: ReolinkHostHandle, ch: int, protocol: LiveProtocol, stream: str
    ) -> dict[str, Any]:
        timeout = self._options.step_timeout
        try:
            url = await self._job(
                host,
                lambda: host.async_live_url(ch, protocol, stream),
                key=("live_url", ch, protocol, stream),
            )
        except Exception as err:  # noqa: BLE001
            return {"ok": False, "error": _err(err)}
        if url is None:
            return _skipped("no URL for this stream")
        try:
            frame = await self._job(
                host,
                lambda: async_first_frame(self._ffmpeg, url, timeout=timeout),
                timeout=timeout + 5,
            )
        except Exception as err:  # noqa: BLE001
            return {"ok": False, "error": _err(err)}
        return frame.as_dict()

    # ---- VOD ----

    async def _vod(
        self, host: ReolinkHostHandle, info: HostInfo, channel: ChannelInfo
    ) -> tuple[dict[str, Any], VodFile | None]:
        ch = channel.channel
        if not channel.supports_replay:
            return _skipped("no replay capability"), None
        try:
            now = await self._job(host, host.async_get_time, key=("time",))
        except Exception as err:  # noqa: BLE001
            return {"ok": False, "error": f"cannot read device time: {_err(err)}"}, None

        vod: dict[str, Any] = {}
        sub_file: VodFile | None = None
        for stream in VOD_STREAMS:
            entry: dict[str, Any] = {}
            vod[stream] = entry
            entry["search"], file = await self._find_recording(host, ch, stream, now)
            if file is None:
                entry["methods"] = _skipped(
                    f"no finished recording in the last {PROBE_SEARCH_DAYS} days"
                )
                continue
            if stream == "sub":
                sub_file = file
            entry["file"] = {
                "start": file.start.isoformat(),
                "duration_s": round((file.end - file.start).total_seconds()),
                "size": file.size,
                "triggers": list(file.triggers),
            }
            methods: dict[str, Any] = {}
            for method in VOD_ORDER:
                self._report_progress(f"ch{ch} vod {method.value} {stream}")
                methods[method.value] = await self._vod_one(
                    host, info, ch, file, method
                )
            entry["methods"] = methods
        return vod, sub_file

    async def _find_recording(
        self, host: ReolinkHostHandle, ch: int, stream: str, now: datetime
    ) -> tuple[dict[str, Any], VodFile | None]:
        """Search one day at a time, newest first, until a recording turns up.

        Single-day windows match how HA's media browser searches; some firmware
        returns only the first day of a longer window.
        """
        search: dict[str, Any] = {"ok": False, "windows": 0, "files": 0}
        for days_back in range(PROBE_SEARCH_DAYS):
            end = now - timedelta(days=days_back)
            start_time = end - timedelta(days=1)
            start = time.monotonic()
            try:
                files = await self._job(
                    host,
                    partial(host.async_search_vod_files, ch, start_time, end, stream),
                    timeout=self._options.step_timeout * 2,
                )
            except Exception as err:  # noqa: BLE001
                search["error"] = _err(err)
                break
            search["ok"] = True
            search["windows"] += 1
            search["files"] += len(files)
            search.setdefault("latency_ms", _ms(start))
            search["with_triggers"] = search.get("with_triggers", 0) + sum(
                1 for f in files if f.triggers
            )
            if (file := pick_recording(files, now)) is not None:
                return search, file
        return search, None

    async def _vod_one(
        self,
        host: ReolinkHostHandle,
        info: HostInfo,
        ch: int,
        file: VodFile,
        method: VodMethod,
    ) -> dict[str, Any]:
        if method is VodMethod.NVR_DOWNLOAD and not info.is_nvr:
            return _skipped("NVR only")
        if method is VodMethod.RTMP:
            if info.is_nvr:
                return _skipped("not supported on NVRs")
            if host.rtmp_enabled is not True:
                # get_vod_source(RTMP) would enable the port: never do that.
                return _skipped("RTMP port disabled; the probe never enables it")

        timeout = self._options.step_timeout
        start = time.monotonic()
        try:
            mime, url = await self._job(
                host,
                lambda: host.async_vod_url(ch, file, method),
                # NVR_DOWNLOAD prepares the file on the NVR first.
                timeout=timeout * 2,
            )
        except NotApplicableError as err:
            return _skipped(str(err))
        except Exception as err:  # noqa: BLE001
            return {"ok": False, "error": _err(err)}
        prepare_ms = _ms(start)

        result: dict[str, Any]
        try:
            if method is VodMethod.RTMP:
                frame = await self._job(
                    host,
                    lambda: async_first_frame(self._ffmpeg, url, timeout=timeout),
                    timeout=timeout + 5,
                )
                result = frame.as_dict()
                result["ttfb_ms"] = frame.ttff_ms
            else:
                fetched: ByteResult = await self._job(
                    host,
                    lambda: async_first_bytes(self._session, url, timeout=timeout),
                    timeout=timeout + 5,
                )
                result = fetched.as_dict()
        except Exception as err:  # noqa: BLE001
            return {"ok": False, "error": _err(err), "prepare_ms": prepare_ms}
        result["mime"] = mime
        result["prepare_ms"] = prepare_ms
        return result

    # ---- Baichuan ----

    async def _baichuan(
        self, host: ReolinkHostHandle, ch: int, file: VodFile | None
    ) -> dict[str, Any]:
        self._report_progress(f"ch{ch} baichuan")
        result: dict[str, Any] = {}
        try:
            now = await self._job(host, host.async_get_time, key=("time",))
        except Exception as err:  # noqa: BLE001
            return {"ok": False, "error": f"cannot read device time: {_err(err)}"}

        start = time.monotonic()
        try:
            counts = await self._job(
                host,
                lambda: host.async_search_vod_events(
                    ch, now - timedelta(days=1), now, "sub"
                ),
                timeout=self._options.step_timeout * 2,
            )
            result["event_search"] = {
                "ok": True,
                "latency_ms": _ms(start),
                "events": counts,
            }
        except Exception as err:  # noqa: BLE001
            result["event_search"] = {"ok": False, "error": _err(err)}

        start = time.monotonic()
        try:
            days = await self._job(
                host,
                lambda: host.async_search_vod_days(ch, now - timedelta(days=30), now),
            )
            result["day_search"] = {"ok": True, "latency_ms": _ms(start), "days": days}
        except Exception as err:  # noqa: BLE001
            result["day_search"] = {"ok": False, "error": _err(err)}

        if file is None:
            result["snapshot_past"] = _skipped("no recording to sample")
            return result
        when = file.start + timedelta(seconds=5)
        start = time.monotonic()
        try:
            image = await self._job(
                host,
                lambda: host.async_snapshot_past(ch, when, "sub", self._ffmpeg),
            )
        except Exception as err:  # noqa: BLE001
            result["snapshot_past"] = {"ok": False, "error": _err(err)}
        else:
            is_jpeg = image[:2] == b"\xff\xd8"
            result["snapshot_past"] = {
                "ok": is_jpeg,
                "latency_ms": _ms(start),
                "bytes": len(image),
                **({} if is_jpeg else {"error": "not a JPEG"}),
            }
        return result

    # ---- Concurrency ----

    async def _concurrency(
        self,
        host: ReolinkHostHandle,
        info: HostInfo,
        channels: list[dict[str, Any]],
    ) -> dict[str, Any]:
        if not self._options.concurrency_test:
            return _skipped("opt-in: concurrency_test")
        target = _concurrency_target(channels)
        if target is None:
            return _skipped("no channel with a working sub stream")
        ch, protocol = target
        try:
            url = await self._job(
                host, lambda: host.async_live_url(ch, protocol, "sub")
            )
        except Exception as err:  # noqa: BLE001
            return {"ok": False, "error": _err(err)}
        if url is None:
            return _skipped("no URL for the sub stream")

        self._report_progress(f"{info.model}: concurrent streams (exclusive)")
        hold = self._options.hold_seconds
        timeout = self._options.step_timeout + hold

        async def run_levels() -> dict[str, Any]:
            return await _concurrency_levels(
                self._ffmpeg, url, self._options.max_streams, hold, timeout
            )

        try:
            levels = await self._job(
                host,
                run_levels,
                exclusive=True,
                timeout=(timeout + CONCURRENCY_COOLDOWN) * self._options.max_streams
                + 10,
            )
        except Exception as err:  # noqa: BLE001
            return {"ok": False, "channel": ch, "error": _err(err)}
        return {"ok": True, "channel": ch, "protocol": protocol.value, **levels}


async def _concurrency_levels(
    ffmpeg: str, url: CameraUrl, max_streams: int, hold: float, timeout: float
) -> dict[str, Any]:
    """Open 1..max_streams streams at once, stopping at the first failing level."""
    levels: list[dict[str, Any]] = []
    max_ok = 0
    first_failure: int | None = None
    for count in range(1, max_streams + 1):
        results: list[FrameResult] = await asyncio.gather(
            *(
                async_hold_stream(ffmpeg, url, seconds=hold, timeout=timeout)
                for _ in range(count)
            )
        )
        ok = all(r.ok for r in results)
        levels.append(
            {
                "streams": count,
                "ok": ok,
                # Time until each stream reported its video (the processes run
                # for the whole hold, so their exit time is not a first frame).
                "open_ms": [r.open_ms for r in results],
                "errors": sorted({r.error for r in results if r.error}),
            }
        )
        if not ok:
            first_failure = count
            break
        max_ok = count
        # Let the device release the sessions before the next level.
        await asyncio.sleep(CONCURRENCY_COOLDOWN)
    return {
        "max_streams_tested": max_streams,
        "max_ok": max_ok,
        "first_failure": first_failure,
        "levels": levels,
    }


def _concurrency_target(
    channels: list[dict[str, Any]],
) -> tuple[int, LiveProtocol] | None:
    """Pick the first channel and protocol whose sub stream worked."""
    for channel in channels:
        live = channel.get("live") or {}
        for protocol in (LiveProtocol.FLV, LiveProtocol.RTSP, LiveProtocol.RTMP):
            if live.get(protocol.value, {}).get("sub", {}).get("ok"):
                return channel["channel"], protocol
    return None


def pick_recording(files: Iterable[VodFile], now: datetime) -> VodFile | None:
    """Pick the newest finished recording of at least 10 seconds."""
    candidates = [
        f
        for f in files
        if f.end - f.start >= timedelta(seconds=10)
        and _naive_delta(now, f.end) >= RECORDING_SETTLE
    ]
    return max(candidates, key=lambda f: f.start, default=None)


def _naive_delta(a: datetime, b: datetime) -> timedelta:
    """Subtract datetimes that may differ in tz-awareness (device local time)."""
    if (a.tzinfo is None) != (b.tzinfo is None):
        a, b = a.replace(tzinfo=None), b.replace(tzinfo=None)
    return a - b


def _identity(info: HostInfo) -> dict[str, Any]:
    return {
        "name": info.name,
        "model": info.model,
        "hardware_version": info.hardware_version,
        "firmware_version": info.firmware_version,
        "device_type": info.device_type,
        "is_nvr": info.is_nvr,
        "is_hub": info.is_hub,
        "is_battery": info.is_battery,
        "baichuan_only": info.baichuan_only,
        "protocol": info.protocol,
        "channels": len(info.channels),
    }


def redact(
    data: Any,
    secrets: Iterable[str],
    hiders: Iterable[Callable[[str], str]] = (),
) -> Any:
    """Return a deep copy of ``data`` with secrets removed from every string."""
    secret_list = sorted({s for s in secrets if s}, key=len, reverse=True)
    hider_list = list(hiders)

    def clean(text: str) -> str:
        # URLs first: hide_password's "<password>" markers would split them.
        text = redact_text(text, secret_list)
        for hide in hider_list:
            try:
                text = hide(text)
            except Exception:  # noqa: BLE001 - best effort, regexes already ran
                _LOGGER.debug("hide_password failed")
        return text

    def walk(value: Any) -> Any:
        if isinstance(value, str):
            return clean(value)
        if isinstance(value, dict):
            return {
                (clean(k) if isinstance(k, str) else k): walk(v)
                for k, v in value.items()
                if not _is_secret_key(k)
            }
        if isinstance(value, (list, tuple)):
            return [walk(v) for v in value]
        return value

    return walk(data)


_SECRET_KEYS = frozenset(
    {"password", "token", "uid", "serial", "mac", "mac_address", "username", "url"}
)


def _is_secret_key(key: Any) -> bool:
    return isinstance(key, str) and key.lower() in _SECRET_KEYS

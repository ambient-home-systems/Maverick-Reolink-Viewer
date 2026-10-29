"""Baichuan replay check (Phase 5a, step 5), part of the hardware probe.

Opt-in and read-only. On a host that records (an NVR), it picks a long
recording of a past day on the sub stream and measures, 75 % into it:

- **Baichuan replay**: our own connection (``baichuan_client``), the sequence
  the Reolink client uses (123 ``ReplaySeek`` → 5 ``FileInfoList`` → frames →
  7 stop): time to the acknowledgements, to the first chunk and to the first
  key frame, the key frame's time against the seek, and what a few seconds of
  the stream deliver;
- **the Phase 2 path**: the same recording's HTTP ``DOWNLOAD`` read up to the
  byte offset that 75 % of the file amounts to, which is what the serving
  cache has to fetch before such a start can play today;
- **session impact**: the device's logged-in users before, during and after
  the replay.

Both streams run under the host's stream budget at playback priority. Nothing
is written to the device; the only Baichuan commands sent are login, seek,
start, stop and logout.
"""

import asyncio
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import datetime, timedelta
import time
from typing import Any

from aiohttp import ClientSession

from .baichuan_client import (
    BaichuanClientError,
    BaichuanReplayClient,
    ReplayStats,
    stop_name,
)
from .bridge import ChannelInfo, HostInfo, ReolinkHostHandle, VodFile, VodMethod
from .const import PROBE_SEARCH_DAYS
from .media import async_fetch
from .probe_playback import JobRunner, describe_file
from .scheduler import HostScheduler, Priority

STREAM = "sub"
STREAM_TYPE = "subStream"
MIN_DURATION = timedelta(minutes=20)
TARGET_FRACTION = 0.75
# The seek's channelId the Reolink client sent for an NVR channel.
SEEK_CHANNEL_ID = 0
HTTP_MAX_SECONDS = 60.0


@dataclass(slots=True)
class BaichuanOptions:
    """Options of the Baichuan replay check."""

    enabled: bool = False
    hold_seconds: float = 5.0

    def __post_init__(self) -> None:
        """Clamp to safe values."""
        self.hold_seconds = max(1.0, min(self.hold_seconds, 15.0))


def _skipped(reason: str) -> dict[str, Any]:
    return {"ok": False, "skipped": reason}


def _ms(start: float) -> float:
    return round((time.monotonic() - start) * 1000, 1)


def _err(err: BaseException) -> str:
    if isinstance(err, TimeoutError):
        return "timeout"
    text = str(err) or type(err).__name__
    return f"{type(err).__name__}: {text}"[:300]


def pick_recording(files: list[VodFile]) -> VodFile | None:
    """Choose the longest recording of at least MIN_DURATION."""
    long = [f for f in files if f.end - f.start >= MIN_DURATION and f.size]
    if not long:
        return None
    return max(long, key=lambda f: f.end - f.start)


def target_in(file: VodFile) -> tuple[datetime, int]:
    """Return the seek time 75 % into the recording and the byte offset it amounts to."""
    duration = file.end - file.start
    when = (file.start + duration * TARGET_FRACTION).replace(microsecond=0)
    return when, int((file.size or 0) * TARGET_FRACTION)


class BaichuanCheck:
    """The Baichuan replay check for one host."""

    def __init__(
        self,
        host: ReolinkHostHandle,
        job: JobRunner,
        session: ClientSession,
        host_scheduler: HostScheduler,
        options: BaichuanOptions,
        *,
        step_timeout: float,
        progress: Callable[[str], None],
        client_factory: Callable[..., BaichuanReplayClient] | None = None,
        fetch: Callable[..., Awaitable[Any]] | None = None,
    ) -> None:
        """Initialize the check (the factories default to the real ones at run time)."""
        self._host = host
        self._job = job
        self._session = session
        self._streams = host_scheduler.streams
        self._options = options
        self._timeout = step_timeout
        self._progress = progress
        self._client_factory = client_factory or BaichuanReplayClient
        self._fetch = fetch or async_fetch

    async def async_host(
        self, info: HostInfo, channels: list[ChannelInfo], now: datetime
    ) -> dict[str, Any]:
        """Run the check on the first channel of the host that records."""
        if not info.is_nvr:
            return _skipped("not a recorder (the check replays NVR recordings)")
        channel = next(
            (
                c
                for c in channels
                if c.online and c.supports_replay and not c.is_battery
            ),
            None,
        )
        if channel is None:
            return _skipped("no online channel with replay support")
        result: dict[str, Any] = {"channel": channel.channel, "stream": STREAM}
        self._progress(f"ch{channel.channel} baichuan replay: searching a recording")
        file, search = await self._recording(channel.channel, now)
        result["search"] = search
        if file is None:
            result["skipped"] = "no recording of 20 minutes or more in the last days"
            return result
        when, target_bytes = target_in(file)
        result["recording"] = describe_file(file)
        result["target"] = {
            "fraction": TARGET_FRACTION,
            "offset_s": round((when - file.start).total_seconds(), 1),
            "bytes": target_bytes,
        }
        result["users_before"] = await self._users()
        self._progress(
            f"ch{channel.channel} baichuan replay: starting at {when:%H:%M:%S}"
        )
        result["replay"] = await self._replay(channel.channel, file, when)
        result["users_after"] = await self._users()
        self._progress(
            f"ch{channel.channel} baichuan replay: the HTTP path for comparison"
        )
        result["http"] = await self._http(channel.channel, file, target_bytes)
        result["ok"] = bool(result["replay"].get("ok"))
        return result

    async def _recording(
        self, ch: int, now: datetime
    ) -> tuple[VodFile | None, dict[str, Any]]:
        midnight = now.replace(hour=0, minute=0, second=0, microsecond=0)
        search: dict[str, Any] = {}
        for days_back in range(1, PROBE_SEARCH_DAYS + 1):
            start = midnight - timedelta(days=days_back)
            end = start + timedelta(days=1) - timedelta(seconds=1)
            began = time.monotonic()
            search_day = self._search_day(ch, start, end)
            try:
                files = await self._job(search_day, timeout=self._timeout * 2)
            except Exception as err:  # noqa: BLE001 - recorded
                return None, {"date": start.date().isoformat(), "error": _err(err)}
            search = {
                "date": start.date().isoformat(),
                "latency_ms": _ms(began),
                "files": len(files),
            }
            if (file := pick_recording(files)) is not None:
                return file, search
        return None, search

    def _search_day(
        self, ch: int, start: datetime, end: datetime
    ) -> Callable[[], Awaitable[list[VodFile]]]:
        return lambda: self._host.async_search_vod_files(ch, start, end, STREAM)

    async def _users(self) -> dict[str, Any]:
        try:
            count, why = await self._job(self._host.async_online_users)
        except Exception as err:  # noqa: BLE001
            return {"error": _err(err)}
        return {"count": count} if count is not None else {"error": why}

    async def _replay(self, ch: int, file: VodFile, when: datetime) -> dict[str, Any]:
        result: dict[str, Any] = {"ok": False, "seek_channel_id": SEEK_CHANNEL_ID}
        uid = self._host.channel_uid(ch)
        if uid is None:
            result["error"] = "no camera UID for the channel"
            return result
        client = self._client_factory(
            self._host.baichuan_endpoint(), timeout=self._timeout
        )
        first_key = asyncio.Event()

        def on_chunk(stats: ReplayStats) -> None:
            if stats.first_key_frame is not None:
                first_key.set()

        began = time.monotonic()
        try:
            async with self._streams.slot(Priority.PLAYBACK):
                result["slot_wait_ms"] = _ms(began)
                await client.connect()
                result["login"] = await client.login()
                result["device_type"] = client.device_type
                result["seek_ms"] = await client.seek(SEEK_CHANNEL_ID, when)
                start_ms, stats = await client.start(
                    ch, file.name, uid, STREAM_TYPE, on_chunk=on_chunk
                )
                result["start_ms"] = start_ms
                if stats.first_key_frame is not None:
                    first_key.set()
                try:
                    async with asyncio.timeout(self._timeout):
                        await first_key.wait()
                except TimeoutError:
                    result["error"] = "no key frame within the timeout"
                else:
                    result["users_during"] = await self._users()
                    await asyncio.sleep(self._options.hold_seconds)
                result["stream"] = stats.as_dict()
                if stats.first_key_time is not None:
                    result["stream"]["key_frame_vs_seek_s"] = round(
                        (
                            stats.first_key_time - when.replace(tzinfo=None)
                        ).total_seconds(),
                        1,
                    )
                result["held_s"] = self._options.hold_seconds
                result["stop_ms"] = await client.stop(
                    ch, stop_name(ch, file.start), STREAM_TYPE
                )
                after_stop = stats.chunks
                await asyncio.sleep(1.0)
                result["chunks_after_stop"] = stats.chunks - after_stop
                result["ok"] = "error" not in result
        except (BaichuanClientError, OSError, TimeoutError) as err:
            result["error"] = _err(err)
        finally:
            try:
                await client.logout()
            except BaichuanClientError, OSError, TimeoutError:
                await client.close()
        return result

    async def _http(self, ch: int, file: VodFile, target_bytes: int) -> dict[str, Any]:
        if not target_bytes:
            return _skipped("the recording's size is unknown")
        try:
            _mime, url = await self._job(
                lambda: self._host.async_vod_url(ch, file, VodMethod.DOWNLOAD)
            )
        except Exception as err:  # noqa: BLE001
            return {"ok": False, "error": _err(err)}
        began = time.monotonic()
        async with self._streams.slot(Priority.PLAYBACK):
            slot_wait = _ms(began)
            fetched = await self._fetch(
                self._session,
                url,
                max_bytes=target_bytes,
                max_seconds=HTTP_MAX_SECONDS,
                timeout=self._timeout,
            )
        reached = fetched.bytes_read >= target_bytes
        total: float | None = None
        if fetched.ttfb_ms is not None and fetched.read_ms is not None:
            total = round(fetched.ttfb_ms + fetched.read_ms, 1)
        return {
            "ok": fetched.ok and reached,
            "method": VodMethod.DOWNLOAD.value,
            "slot_wait_ms": slot_wait,
            "bytes_read": fetched.bytes_read,
            "reached_target": reached,
            "ttfb_ms": fetched.ttfb_ms,
            "to_target_ms": total if reached else None,
            "mbit_s": fetched.mbit_s,
            "error": fetched.error,
        }

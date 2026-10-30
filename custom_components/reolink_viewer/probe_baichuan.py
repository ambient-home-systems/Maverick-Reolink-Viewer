"""Baichuan replay and download check (Phase 5a step 5, 5b step 1), in the probe.

Opt-in and read-only. On a host that records (an NVR), for each channel
asked for and each stream asked for (sub, main), it picks a long recording
of a past day and measures, 75 % into it:

- **Replay** (123 ``ReplaySeek`` → 5 ``FileInfoList`` → frames → 7 stop):
  the acknowledgements, the time to the first chunk and the first key frame,
  that key frame's time against the seek, the stream's pace, and what the
  blocks hold (``baichuan_media``: codec, parameter sets, picture types,
  timestamps, audio);
- **Download by time range** (143 → the data → 144): the same from the asked
  time for a short cut, whether the NVR starts mid-file, whether it paces the
  data or sends it at full speed, and its end marker;
- **the Phase 2 path**: the sub recording's HTTP ``DOWNLOAD`` read up to the
  byte offset that 75 % amounts to, which is what the serving cache has to
  fetch before such a start can play today;
- **session cost**: the device's logged-in users before, during and after
  each stream, what ``GetOnline`` exposes about limits, and, on request, one
  replay held open beside a full-speed download, then two replays at once on
  the same connection.

Every stream runs under the host's stream budget at playback priority.
Nothing is written to the device; the only Baichuan commands sent are login,
seek, start, stop, the download cut, its end, and logout.
"""

import asyncio
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
import time
from typing import Any

from aiohttp import ClientSession

from .baichuan_client import (
    BaichuanClientError,
    BaichuanReplayClient,
    StreamStats,
    stop_name,
)
from .bridge import ChannelInfo, HostInfo, ReolinkHostHandle, VodFile, VodMethod
from .const import PROBE_SEARCH_DAYS
from .media import async_fetch
from .probe_playback import JobRunner, describe_file
from .scheduler import HostScheduler, Priority

STREAM_TYPES = {"sub": "subStream", "main": "mainStream"}
MIN_DURATION = timedelta(minutes=20)
# A recording that ended this recently may still be growing.
RECORDING_SETTLE = timedelta(minutes=2)
TARGET_FRACTION = 0.75
MAX_CHANNELS = 8
NOT_RECORDER = "not a recorder (the check replays NVR recordings)"
NO_RECORDING = (
    f"no finished recording of {MIN_DURATION.seconds // 60} minutes or more"
    f" in the last {PROBE_SEARCH_DAYS + 1} days"
)
# The seek's channelId the Reolink client sent for an NVR channel.
SEEK_CHANNEL_ID = 0
# The logicChnBitmap tried when the channel's own bit is refused.
ANY_CHANNEL_BITMAP = 255
HTTP_MAX_SECONDS = 60.0
# The full-speed download beside a replay (the session test).
FILL_MAX_BYTES = 64 * 1024**2


@dataclass(slots=True)
class BaichuanOptions:
    """Options of the Baichuan check."""

    enabled: bool = False
    # Skip the Phase 0 channel checks: only this section runs on the host.
    only: bool = False
    hold_seconds: float = 5.0
    streams: tuple[str, ...] = ("sub",)
    # The download by time range (143), after the replay.
    download: bool = True
    # The session test: a replay beside a download, then two replays at once.
    session: bool = False
    # Cameras to test, comma-separated: any part of a channel's name or of its
    # model ("Duo 3", "CX810"); all if empty.
    cameras: str = ""
    # The download cut's length from the target.
    cut_seconds: float = 20.0

    def __post_init__(self) -> None:
        """Clamp to safe values."""
        self.hold_seconds = max(1.0, min(self.hold_seconds, 120.0))
        self.cut_seconds = max(5.0, min(self.cut_seconds, 120.0))
        streams = tuple(s for s in self.streams if s in STREAM_TYPES)
        self.streams = streams or ("sub",)

    def wanted(self, channel: ChannelInfo) -> bool:
        """Return whether the camera filter admits a channel (its name or model)."""
        terms = [t.strip().lower() for t in self.cameras.split(",") if t.strip()]
        names = (channel.name.lower(), channel.model.lower())
        return not terms or any(t in name for t in terms for name in names)


@dataclass(slots=True)
class _Replay:
    """A replay the check could start, for the session test."""

    channel: int
    file: VodFile
    when: datetime
    stream: str
    stats: StreamStats | None = field(default=None)


def _skipped(reason: str) -> dict[str, Any]:
    return {"ok": False, "skipped": reason}


def _ms(start: float) -> float:
    return round((time.monotonic() - start) * 1000, 1)


def _err(err: BaseException) -> str:
    if isinstance(err, TimeoutError):
        return "timeout"
    text = str(err) or type(err).__name__
    return f"{type(err).__name__}: {text}"[:300]


def pick_recording(files: list[VodFile], now: datetime) -> VodFile | None:
    """Choose the longest finished recording of at least MIN_DURATION with a size."""
    long = [
        f
        for f in files
        if f.end - f.start >= MIN_DURATION
        and f.size
        and _naive_delta(now, f.end) >= RECORDING_SETTLE
    ]
    if not long:
        return None
    return max(long, key=lambda f: f.end - f.start)


def _naive_delta(a: datetime, b: datetime) -> timedelta:
    """Subtract datetimes that may differ in tz-awareness (device local time)."""
    if (a.tzinfo is None) != (b.tzinfo is None):
        a, b = a.replace(tzinfo=None), b.replace(tzinfo=None)
    return a - b


def target_in(file: VodFile) -> tuple[datetime, int]:
    """Return the seek time 75 % into the recording and the byte offset it amounts to."""
    duration = file.end - file.start
    when = (file.start + duration * TARGET_FRACTION).replace(microsecond=0)
    return when, int((file.size or 0) * TARGET_FRACTION)


def _snapshot(stats: StreamStats) -> dict[str, int]:
    return {
        "chunks": stats.chunks,
        "bytes": stats.total_bytes,
        "key_frames": stats.key_frames,
        "frames": stats.frames,
    }


def _delta(stats: StreamStats, before: dict[str, int]) -> dict[str, int]:
    return {k: v - before[k] for k, v in _snapshot(stats).items()}


def _stream_report(stats: StreamStats, asked: datetime) -> dict[str, Any]:
    """Return the stream's statistics, the first key frame against the asked time."""
    report = stats.as_dict()
    if stats.first_key_time is not None:
        report["key_frame_vs_asked_s"] = round(
            (stats.first_key_time - asked.replace(tzinfo=None)).total_seconds(), 1
        )
    media = stats.media_seconds()
    report["media_s"] = media
    if stats.first_chunk is not None and stats.last_chunk is not None:
        wall = stats.last_chunk - stats.first_chunk
        report["wall_s"] = round(wall, 2)
        # Above 1: faster than real time (a burst, or no pacing at all).
        if media is not None and wall > 0:
            report["media_per_wall_s"] = round(media / wall, 2)
    return report


class BaichuanCheck:
    """The Baichuan check for one host."""

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
        """Run the check on the channels asked for, each stream in turn."""
        if not info.is_nvr:
            return _skipped(NOT_RECORDER)
        candidates = [
            c
            for c in channels
            if c.online
            and c.supports_replay
            and not c.is_battery
            and self._options.wanted(c)
        ]
        if not candidates:
            return _skipped("no online channel with replay support matches")
        result: dict[str, Any] = {
            "streams": list(self._options.streams),
            "hold_s": self._options.hold_seconds,
            "cut_s": self._options.cut_seconds,
            "channels_left_out": [c.channel for c in candidates[MAX_CHANNELS:]],
            "users_before": await self._users(),
            "online": await self._online_detail(),
            "channels": [],
        }
        replays: list[_Replay] = []
        for channel in candidates[:MAX_CHANNELS]:
            entry: dict[str, Any] = {"channel": channel.channel, "name": channel.name}
            for stream in self._options.streams:
                entry[stream] = await self._stream(channel.channel, stream, now)
                found = entry[stream].get("replay_for_session")
                if found is not None:
                    replays.append(found)
                    del entry[stream]["replay_for_session"]
            result["channels"].append(entry)
        if self._options.session:
            result["session"] = await self._session_test(replays)
        result["users_after"] = await self._users()
        result["ok"] = any(
            entry.get(stream, {}).get("ok")
            for entry in result["channels"]
            for stream in self._options.streams
        )
        return result

    async def _stream(self, ch: int, stream: str, now: datetime) -> dict[str, Any]:
        """Replay, download and the HTTP path for one channel and stream."""
        self._progress(f"ch{ch} baichuan {stream}: searching a long recording")
        file, search = await self._recording(ch, stream, now)
        result: dict[str, Any] = {"ok": False, "search": search}
        if file is None:
            result["skipped"] = NO_RECORDING
            return result
        when, target_bytes = target_in(file)
        result["recording"] = describe_file(file)
        result["target"] = {
            "fraction": TARGET_FRACTION,
            "offset_s": round((when - file.start).total_seconds(), 1),
            "bytes": target_bytes,
        }
        self._progress(f"ch{ch} baichuan {stream}: replay at {when:%H:%M:%S}")
        result["replay"] = await self._replay(ch, file, when, stream)
        if result["replay"].get("ok"):
            result["replay_for_session"] = _Replay(ch, file, when, stream)
        if self._options.download:
            self._progress(f"ch{ch} baichuan {stream}: download cut at {when:%H:%M:%S}")
            result["download"] = await self._download(ch, file, when, stream)
        if stream == "sub":
            self._progress(f"ch{ch} baichuan {stream}: the HTTP path for comparison")
            result["http"] = await self._http(ch, file, target_bytes)
        else:
            result["http"] = _skipped(
                "the HTTP comparison runs on the sub stream (75 % of a main"
                " recording is gigabytes)"
            )
        result["ok"] = bool(result["replay"].get("ok"))
        return result

    async def _recording(
        self, ch: int, stream: str, now: datetime
    ) -> tuple[VodFile | None, dict[str, Any]]:
        """Search one day at a time, today first, for a long finished recording."""
        midnight = now.replace(hour=0, minute=0, second=0, microsecond=0)
        search: dict[str, Any] = {"days": 0, "files": 0}
        for days_back in range(PROBE_SEARCH_DAYS + 1):
            start = midnight - timedelta(days=days_back)
            end = min(start + timedelta(days=1) - timedelta(seconds=1), now)
            began = time.monotonic()
            search_day = self._search_day(ch, start, end, stream)
            try:
                files = await self._job(search_day, timeout=self._timeout * 2)
            except Exception as err:  # noqa: BLE001 - recorded
                search["error"] = _err(err)
                return None, search
            search["days"] += 1
            search["files"] += len(files)
            search.setdefault("latency_ms", _ms(began))
            if (file := pick_recording(files, now)) is not None:
                search["date"] = start.date().isoformat()
                return file, search
        return None, search

    def _search_day(
        self, ch: int, start: datetime, end: datetime, stream: str
    ) -> Callable[[], Awaitable[list[VodFile]]]:
        return lambda: self._host.async_search_vod_files(ch, start, end, stream)

    async def _users(self) -> dict[str, Any]:
        try:
            count, why = await self._job(self._host.async_online_users)
        except Exception as err:  # noqa: BLE001
            return {"error": _err(err)}
        return {"count": count} if count is not None else {"error": why}

    async def _online_detail(self) -> dict[str, Any]:
        try:
            detail = await self._job(self._host.async_online_detail)
        except Exception as err:  # noqa: BLE001
            return {"error": _err(err)}
        return dict(detail)

    def _client(self) -> BaichuanReplayClient:
        return self._client_factory(
            self._host.baichuan_endpoint(), timeout=self._timeout
        )

    async def _finish(self, client: BaichuanReplayClient) -> None:
        try:
            await client.logout()
        except BaichuanClientError, OSError, TimeoutError:
            await client.close()

    async def _start_replay(
        self, client: BaichuanReplayClient, replay: _Replay, result: dict[str, Any]
    ) -> StreamStats:
        """Seek and start a replay; wait for its first key frame."""
        uid = self._host.channel_uid(replay.channel)
        if uid is None:
            raise BaichuanClientError("no camera UID for the channel")
        first_key = asyncio.Event()

        def on_chunk(stats: StreamStats) -> None:
            if stats.first_key_frame is not None:
                first_key.set()

        result["seek_ms"] = await client.seek(SEEK_CHANNEL_ID, replay.when)
        start_ms, stats = await client.start(
            replay.channel,
            replay.file.name,
            uid,
            STREAM_TYPES[replay.stream],
            on_chunk=on_chunk,
        )
        result["start_ms"] = start_ms
        replay.stats = stats
        if stats.first_key_frame is not None:
            first_key.set()
        async with asyncio.timeout(self._timeout):
            await first_key.wait()
        return stats

    async def _stop_replay(
        self, client: BaichuanReplayClient, replay: _Replay
    ) -> float:
        return await client.stop(
            replay.channel,
            stop_name(replay.channel, replay.file.start),
            STREAM_TYPES[replay.stream],
        )

    async def _replay(
        self, ch: int, file: VodFile, when: datetime, stream: str
    ) -> dict[str, Any]:
        result: dict[str, Any] = {"ok": False, "seek_channel_id": SEEK_CHANNEL_ID}
        replay = _Replay(ch, file, when, stream)
        client = self._client()
        began = time.monotonic()
        stats: StreamStats | None
        try:
            async with self._streams.slot(Priority.PLAYBACK):
                result["slot_wait_ms"] = _ms(began)
                await client.connect()
                result["login"] = await client.login()
                result["device_type"] = client.device_type
                try:
                    stats = await self._start_replay(client, replay, result)
                except TimeoutError:
                    result["error"] = "no key frame within the timeout"
                    stats = replay.stats
                else:
                    result["users_during"] = await self._users()
                    await asyncio.sleep(self._options.hold_seconds)
                if stats is not None:
                    result["stream"] = _stream_report(stats, when)
                result["held_s"] = self._options.hold_seconds
                if stats is not None:
                    result["stop_ms"] = await self._stop_replay(client, replay)
                    after_stop = stats.chunks
                    await asyncio.sleep(1.0)
                    result["chunks_after_stop"] = stats.chunks - after_stop
                result["ok"] = "error" not in result
        except (BaichuanClientError, OSError, TimeoutError) as err:
            result["error"] = _err(err)
        finally:
            await self._finish(client)
        return result

    async def _download(
        self, ch: int, file: VodFile, when: datetime, stream: str
    ) -> dict[str, Any]:
        """143 from the target for a short cut: pace, start and end marker."""
        result: dict[str, Any] = {"ok": False}
        end = min(when + timedelta(seconds=self._options.cut_seconds), file.end)
        end = end.replace(microsecond=0)
        result["asked"] = {"start": when.isoformat(), "end": end.isoformat()}
        client = self._client()
        began = time.monotonic()
        try:
            async with self._streams.slot(Priority.PLAYBACK):
                result["slot_wait_ms"] = _ms(began)
                await client.connect()
                result["login"] = await client.login()
                ended = asyncio.Event()
                stats = await self._cut(
                    client,
                    ch=ch,
                    stream=stream,
                    start=when,
                    end=end,
                    result=result,
                    on_chunk=lambda s: (
                        ended.set() if s.end_status is not None else None
                    ),
                )
                if stats.end_status is not None:
                    ended.set()
                try:
                    async with asyncio.timeout(self._options.hold_seconds):
                        await ended.wait()
                except TimeoutError:
                    pass
                result["users_during"] = await self._users()
                result["ended_within_hold"] = stats.end_status is not None
                result["held_s"] = round(time.monotonic() - began, 2)
                end_ms, status = await client.download_end(ch)
                result["end"] = {"ms": end_ms, "status": status}
                after = stats.chunks
                await asyncio.sleep(0.5)
                result["chunks_after_144"] = stats.chunks - after
                result["stream"] = _stream_report(stats, when)
                if stats.first_key_frame is None:
                    result["error"] = "no key frame within the hold"
                result["ok"] = "error" not in result
        except (BaichuanClientError, OSError, TimeoutError) as err:
            result["error"] = _err(err)
        finally:
            await self._finish(client)
        return result

    async def _cut(
        self,
        client: BaichuanReplayClient,
        *,
        ch: int,
        stream: str,
        start: datetime,
        end: datetime,
        result: dict[str, Any],
        on_chunk: Callable[[StreamStats], None],
    ) -> StreamStats:
        """Send the 143; if the channel's bit is refused, try the any-channel bitmap."""
        stream_type = STREAM_TYPES[stream]
        try:
            reply_ms, stats, fields = await client.download(
                ch, stream_type, start, end, on_chunk=on_chunk
            )
            result["bitmap"] = "channel bit"
        except BaichuanClientError as err:
            if "refused" not in str(err):
                raise
            result["first_try"] = _err(err)
            reply_ms, stats, fields = await client.download(
                ch,
                stream_type,
                start,
                end,
                bitmap=ANY_CHANNEL_BITMAP,
                on_chunk=on_chunk,
            )
            result["bitmap"] = str(ANY_CHANNEL_BITMAP)
        result["reply_ms"] = reply_ms
        result["reply"] = fields
        return stats

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

    # ---- the session test ----

    async def _session_test(self, replays: list[_Replay]) -> dict[str, Any]:
        """One replay open beside a full-speed download, then two replays at once."""
        if not replays:
            return _skipped("no replay started: nothing to hold open")
        first = replays[0]
        second = next((r for r in replays[1:] if r.channel != first.channel), None)
        result: dict[str, Any] = {
            "ok": False,
            "first": {"channel": first.channel, "stream": first.stream},
            "second": (
                {"channel": second.channel, "stream": second.stream}
                if second is not None
                else None
            ),
        }
        self._progress(f"ch{first.channel} baichuan: session test (one replay open)")
        client = self._client()
        hold = self._options.hold_seconds
        try:
            async with self._streams.slot(Priority.PLAYBACK):
                await client.connect()
                result["login"] = await client.login()
                one: dict[str, Any] = {}
                stats_a = await self._start_replay(client, first, one)
                one["users"] = await self._users()
                result["one_open"] = one
                # A full-speed download beside the replay, as a cache fill.
                before = _snapshot(stats_a)
                result["fill_beside"] = await self._fill(first, hold)
                result["replay_during_fill"] = _delta(stats_a, before)
                if second is not None:
                    self._progress(
                        f"ch{second.channel} baichuan: session test (two replays)"
                    )
                    two: dict[str, Any] = {}
                    async with self._streams.slot(Priority.PLAYBACK):
                        before_a = _snapshot(stats_a)
                        stats_b = await self._start_replay(client, second, two)
                        before_b = _snapshot(stats_b)
                        two["users"] = await self._users()
                        await asyncio.sleep(hold)
                        two["first_during"] = _delta(stats_a, before_a)
                        two["second_during"] = _delta(stats_b, before_b)
                        two["open_streams"] = client.open_streams
                        two["stop_second_ms"] = await self._stop_replay(client, second)
                    result["two_open"] = two
                result["stop_first_ms"] = await self._stop_replay(client, first)
                result["users_before_logout"] = await self._users()
                result["ok"] = True
        except (BaichuanClientError, OSError, TimeoutError) as err:
            result["error"] = _err(err)
        finally:
            await self._finish(client)
        result["users_after_logout"] = await self._users()
        return result

    async def _fill(self, replay: _Replay, seconds: float) -> dict[str, Any]:
        """Read the replay's recording over HTTP at full speed for a while."""
        try:
            _mime, url = await self._job(
                lambda: self._host.async_vod_url(
                    replay.channel, replay.file, VodMethod.DOWNLOAD
                )
            )
        except Exception as err:  # noqa: BLE001
            return {"ok": False, "error": _err(err)}
        async with self._streams.slot(Priority.PLAYBACK):
            fetched = await self._fetch(
                self._session,
                url,
                max_bytes=FILL_MAX_BYTES,
                max_seconds=seconds,
                timeout=self._timeout + seconds,
            )
        return {
            "ok": fetched.ok,
            "bytes_read": fetched.bytes_read,
            "ttfb_ms": fetched.ttfb_ms,
            "mbit_s": fetched.mbit_s,
            "error": fetched.error,
        }

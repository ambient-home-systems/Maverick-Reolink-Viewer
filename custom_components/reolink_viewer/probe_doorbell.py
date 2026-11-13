"""The Doorbell's recordings and talk over Home Assistant's session (Phase 12 step a).

Part of the hardware probe, opt-in: the go or no-go for Phase 12. The battery
Doorbell keeps its recordings on its SD card and speaks Baichuan over UDP
only, so Phase 5's client (TCP) cannot fetch them. Home Assistant's Reolink
integration already holds a Baichuan session to it, and reolink-aio 0.23.0
can stream a download cut over that session as it arrives. So this check
reuses Home Assistant's session through the bridge, with no second login,
and finds out, for each camera that records where Reolink Viewer cannot play
it:

- the session: how it connects and whether its events flow, before and after;
- talk: the device's ``TalkAbility`` (10), its duplex and stream modes and the
  audio format talk must be sent in (Phase 5a saw ADPCM at 16 kHz);
- the day search (142) and the event search (272) as sanity checks, and the
  newest finished recording of today or yesterday;
- a cut (143) of that recording's first seconds: time to the first key frame,
  how fast it came against real time, and the media (codec, size, audio);
- a command (104, the clock) during the cut and after it: Home Assistant's
  session must stay usable while a recording plays.

Then a verdict per target. Playback: go when the cut brought pictures at
least as fast as real time and the session answered after it. Talk: go to try
in step c when the device names an audio format.

Not tried: a second login beside Home Assistant's (not needed while its
session is reused), and a replay (123 then 5, whose messages reolink-aio does
not receive; Phase 5 plays from cuts). Talk itself (201, 202, 11) sounds at
the door, so it waits for step c, with the owner there.

Same safety rules as the rest of the probe: read-only, and every request is a
scheduler job at prefetch priority. Only on wired power: a camera on its
battery is never asked, even with "Include battery cameras" (a cut keeps it
awake). The report holds counts, lengths and timings, never an event's time
of day: those say when someone came to the door.
"""

import asyncio
from collections.abc import Awaitable, Callable
import contextlib
from dataclasses import dataclass
from datetime import datetime, timedelta
from functools import partial
import time
from typing import Any, cast

from .baichuan_client import StreamStats
from .bridge import (
    CUT_NEEDS_LIBRARY,
    ChannelInfo,
    HostInfo,
    ReolinkHostHandle,
    VodEvent,
)
from .probe_events import NO_TARGET, device_clock, is_target
from .probe_playback import JobRunner

# The cut asked: the first seconds of the newest finished recording.
CUT_SECONDS = 10
CUT_STREAM = "sub"
# A cut stops here at the latest (a sub stream's 10 s are well under 2 MB).
CUT_MAX_BYTES = 16 * 1024 * 1024
CUT_TIMEOUT = 60.0
# A recording this recent may still be written to the card.
SETTLED = timedelta(seconds=30)
# Step b's exit: a Doorbell event's first frame in under 2 s on the LAN.
FIRST_FRAME_GOAL_MS = 2000
# Media seconds per second of transfer, at the least, for playback at 1x. A
# camera that paces a cut at real time measures a little under 1 (the media's
# span against the first to the last chunk), so a tenth is allowed.
REAL_TIME_FLOOR = 0.9
NO_RECORDING = "no finished recording today or yesterday"
ON_BATTERY = "on battery: this check runs only on wired power"
NOT_TRIED = {
    "second_login": "not needed: Home Assistant's own session is reused",
    "replay": "reolink-aio does not receive a replay's messages; playback uses cuts",
    "talk": "talking sounds at the door: tried in step c, with the owner there",
}


@dataclass(slots=True)
class DoorbellOptions:
    """Options of the Doorbell check."""

    enabled: bool = False
    # Skip the Phase 0 checks (live, VOD methods, Baichuan, live concurrency).
    only: bool = False

    def __post_init__(self) -> None:
        """Clamp to safe values."""
        if not self.enabled:
            self.only = False


def _skipped(reason: str) -> dict[str, Any]:
    return {"ok": False, "skipped": reason}


def _ms(start: float) -> float:
    return round((time.monotonic() - start) * 1000, 1)


def _err(err: BaseException) -> str:
    if isinstance(err, TimeoutError):
        return "timeout"
    text = str(err) or type(err).__name__
    return f"{type(err).__name__}: {text}"[:300]


def media_summary(media: dict[str, Any]) -> dict[str, Any]:
    """Return what a cut's media is, without its times or bytes.

    The stream header holds the recording's start and end (a time of day), so
    only its picture size and frame rate are kept.
    """
    infos = media.get("info") or []
    info = infos[0] if infos and isinstance(infos[0], dict) else {}
    video = media.get("video") or {}
    audio = media.get("audio") or {}
    aac = audio.get("aac")
    adpcm = audio.get("adpcm")
    return {
        "width": info.get("width"),
        "height": info.get("height"),
        "fps": info.get("fps"),
        "codec": video.get("codec"),
        "fps_estimate": video.get("fps_estimate"),
        "key_interval_s": video.get("key_interval_s"),
        "span_s": video.get("span_s"),
        "b_frames": video.get("b_frames"),
        "audio": {
            "blocks": audio.get("blocks"),
            "codec": "aac" if aac else "adpcm" if adpcm else None,
            "sample_rates": audio.get("sample_rates"),
        },
    }


def verdict(result: dict[str, Any]) -> dict[str, Any]:
    """Return the go or no-go for playback and for talk, and why."""
    cut = result.get("cut") or {}
    after = cut.get("command_after") or {}
    speed = cut.get("speed")
    first = cut.get("first_key_frame_ms")
    if "skipped" in cut or not cut:
        playback, why = "untested", str(cut.get("skipped", "no cut"))
    elif not cut.get("ok"):
        playback = "no-go"
        why = str(cut.get("error") or "the cut brought no picture")
    elif isinstance(speed, int | float) and speed < REAL_TIME_FLOOR:
        playback, why = "no-go", f"slower than real time ({speed}x)"
    elif not after.get("ok"):
        playback = "no-go"
        why = "Home Assistant's session did not answer after the cut"
    else:
        playback = "go"
        why = (
            f"first picture in {first} ms (step b's goal: under "
            f"{FIRST_FRAME_GOAL_MS} ms on the LAN)"
        )
    talk_result = result.get("talk") or {}
    if not talk_result.get("ok"):
        talk = "untested"
        talk_why = str(talk_result.get("error", "not asked"))
    elif talk_result.get("formats"):
        talk = "go"
        talk_why = "the device names its talk format; step c tries talking"
    else:
        talk, talk_why = "no-go", "the device names no talk format"
    return {
        "playback": playback,
        "playback_why": why,
        "first_frame_under_goal": (
            isinstance(first, int | float) and first < FIRST_FRAME_GOAL_MS
        ),
        "talk": talk,
        "talk_why": talk_why,
    }


class DoorbellCheck:
    """The Doorbell check for one host (opt-in, read-only, wired power only)."""

    def __init__(
        self,
        host: ReolinkHostHandle,
        job: JobRunner,
        *,
        step_timeout: float,
        progress: Callable[[str], None],
    ) -> None:
        """Ask through ``job`` (the probe's scheduler jobs)."""
        self._host = host
        self._job = job
        self._timeout = step_timeout
        self._progress = progress

    async def async_host(self, info: HostInfo) -> dict[str, Any]:
        """Check every camera of the host that records but cannot be played."""
        targets = [c for c in info.channels if is_target(self._host, c.channel)]
        if not targets:
            return _skipped(NO_TARGET)
        session = self._host.baichuan_session()
        channels = [await self._channel(c, session) for c in targets]
        return {
            "ok": any(c.get("ok") for c in channels),
            "session": session,
            "channels": channels,
        }

    @staticmethod
    def _skip(channel: ChannelInfo) -> str | None:
        if not channel.online:
            return "offline"
        if channel.is_battery and not channel.wired_power:
            return ON_BATTERY
        if channel.sleeping:
            return "sleeping"
        return None

    async def _channel(
        self, channel: ChannelInfo, session: dict[str, Any]
    ) -> dict[str, Any]:
        ch = channel.channel
        result: dict[str, Any] = {
            "channel": ch,
            "name": channel.name,
            "model": channel.model,
            "firmware_version": channel.firmware_version,
            "is_battery": channel.is_battery,
            "wired_power": channel.wired_power,
        }
        if (reason := self._skip(channel)) is not None:
            result["skipped"] = reason
            return result
        clock, wall = await device_clock(self._host, self._job)
        result["clock_source"] = clock.get("source")

        self._progress(f"ch{ch} doorbell: talk ability")
        result["talk"] = await self._talk(ch)
        self._progress(f"ch{ch} doorbell: searches")
        result["searches"], event = await self._searches(ch, wall)
        if not session.get("can_stream_cut"):
            result["cut"] = _skipped(CUT_NEEDS_LIBRARY)
        elif event is None:
            result["cut"] = _skipped(NO_RECORDING)
        else:
            self._progress(f"ch{ch} doorbell: a {CUT_SECONDS} s cut")
            result["cut"] = await self._cut(ch, event)
        result["session_after"] = self._host.baichuan_session()
        result["not_tried"] = NOT_TRIED
        result["gate"] = verdict(result)
        result["ok"] = bool(result["talk"].get("ok") or result["cut"].get("ok"))
        return result

    async def _talk(self, ch: int) -> dict[str, Any]:
        began = time.monotonic()
        try:
            ability = await self._job(partial(self._host.async_talk_ability, ch))
        except Exception as err:  # noqa: BLE001 - recorded in the report
            return {"ok": False, "error": _err(err)}
        return {"ok": True, "latency_ms": _ms(began), **ability}

    async def _searches(
        self, ch: int, wall: datetime
    ) -> tuple[dict[str, Any], VodEvent | None]:
        """Run the day and event searches; return them and the recording to cut."""
        out: dict[str, Any] = {}
        began = time.monotonic()
        try:
            days = await self._job(
                partial(
                    self._host.async_recording_days, ch, wall - timedelta(days=7), wall
                )
            )
        except Exception as err:  # noqa: BLE001 - recorded in the report
            out["day_search"] = {"ok": False, "error": _err(err)}
        else:
            out["day_search"] = {
                "ok": True,
                "latency_ms": _ms(began),
                "days": len(days),
            }

        today = datetime.combine(wall.date(), datetime.min.time())
        windows = (
            ("today", today, wall),
            ("yesterday", today - timedelta(days=1), today - timedelta(seconds=1)),
        )
        for label, start, end in windows:
            began = time.monotonic()
            try:
                search = await self._job(
                    partial(
                        self._host.async_search_day_events, ch, start, end, CUT_STREAM
                    ),
                    # One retry after a pause, as the events feed does.
                    timeout=self._timeout * 2,
                )
            except Exception as err:  # noqa: BLE001 - recorded in the report
                out[f"events_{label}"] = {"ok": False, "error": _err(err)}
                continue
            finished = [e for e in search.events if e.end <= wall - SETTLED]
            out[f"events_{label}"] = {
                "ok": True,
                "latency_ms": _ms(began),
                "events": len(search.events),
                "finished": len(finished),
            }
            if finished:
                return out, max(finished, key=lambda e: e.start)
        return out, None

    async def _cut(self, ch: int, event: VodEvent) -> dict[str, Any]:
        end = min(event.end, event.start + timedelta(seconds=CUT_SECONDS))
        lengths = {
            "event_s": round((event.end - event.start).total_seconds()),
            "asked_s": round((end - event.start).total_seconds()),
        }
        try:
            result = await self._job(
                partial(self._stream, ch, event.start, end),
                timeout=CUT_TIMEOUT + self._timeout,
            )
        except Exception as err:  # noqa: BLE001 - recorded in the report
            result = {"ok": False, "error": _err(err)}
        result.update(lengths)
        result["command_after"] = await self._command(self._job, "after")
        return result

    async def _stream(self, ch: int, start: datetime, end: datetime) -> dict[str, Any]:
        """Read the cut as it comes (one scheduler job); ask 104 once meanwhile."""
        stats = StreamStats(started=time.monotonic())
        during: asyncio.Task[dict[str, Any]] | None = None
        stopped = "device"
        error: str | None = None
        cut = self._host.async_stream_cut(ch, start, end, CUT_STREAM)
        try:
            async with asyncio.timeout(CUT_TIMEOUT), contextlib.aclosing(cut) as chunks:
                async for chunk in chunks:
                    stats.feed(chunk, time.monotonic())
                    if during is None and stats.first_key_frame is not None:
                        # Within this job: the session's other traffic, as Home
                        # Assistant's own polls would be while a recording plays.
                        during = asyncio.create_task(
                            self._command(lambda call: call(), "during")
                        )
                    if stats.total_bytes >= CUT_MAX_BYTES:
                        stopped = "size cap"
                        break
        except TimeoutError:
            stopped = "timeout"
        except asyncio.CancelledError:
            if during is not None:
                during.cancel()
            raise
        except Exception as err:  # noqa: BLE001 - recorded in the report
            stopped, error = "error", _err(err)
        stats.end(0, time.monotonic())
        raw = stats.as_dict()
        media = media_summary(cast(dict[str, Any], raw["media"]))
        seconds = media["span_s"] or stats.media_seconds()
        wall = (
            stats.last_chunk - stats.first_chunk
            if stats.first_chunk is not None and stats.last_chunk is not None
            else None
        )
        result: dict[str, Any] = {
            "ok": stats.key_frames > 0,
            "stopped": stopped,
            "first_chunk_ms": raw["first_chunk_ms"],
            "first_key_frame_ms": raw["first_key_frame_ms"],
            "chunks": raw["chunks"],
            "bytes": raw["bytes"],
            "mbit_s": raw["mbit_s"],
            "key_frames": raw["key_frames"],
            "frames": raw["frames"],
            "audio_blocks": raw["audio_blocks"],
            "resyncs": raw["resyncs"],
            "skipped_bytes": raw["skipped_bytes"],
            "media_s": round(seconds, 1) if seconds is not None else None,
            # Media seconds per second of transfer: under 1 cannot play at 1x.
            "speed": round(seconds / wall, 2) if seconds and wall else None,
            "media": media,
        }
        if error is not None:
            result["error"] = error
        if during is None:
            result["command_during"] = _skipped("no picture came")
        else:
            result["command_during"] = await during
        return result

    async def _command(
        self,
        run: Callable[[Callable[[], Awaitable[Any]]], Awaitable[Any]],
        when: str,
    ) -> dict[str, Any]:
        """Ask the device's clock (104) on Home Assistant's session; time it."""
        began = time.monotonic()
        try:
            async with asyncio.timeout(self._timeout):
                await run(self._host.async_baichuan_clock)
        except Exception as err:  # noqa: BLE001 - recorded in the report
            return {"ok": False, "when": when, "error": _err(err)}
        return {"ok": True, "when": when, "latency_ms": _ms(began)}

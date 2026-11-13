"""Events of cameras that record but cannot be played (Phase 6, step 1).

Part of the hardware probe. A camera can keep recordings that this integration
cannot play: the battery Doorbell speaks Baichuan only, records to its SD card
and reports no replay support, so it is no playback source and the events feed
leaves it out. Phase 6 lists such a camera's events from the Baichuan searches
alone. This check finds out first whether they answer on it, and how fast:

- the day search (142) for this month, as the calendar asks;
- the event search (272-274) for today and yesterday, sub and main, through
  the call the events feed will use (``async_search_day_events``);
- ``snapshot_past`` (298) a few seconds into the newest events, as the
  thumbnails and the picture sequence will ask.

The searches take the device's wall-clock times, so the check needs its
clock. A Baichuan-only device answers no HTTP GetTime (v0.41.0's run on the
Doorbell stopped there), so the check falls back to Baichuan's own time query
(104), then to Home Assistant's clock, and says which it used. What 104
carries (its time zone field, the names of its fields) is recorded too: step 2
needs the Doorbell's zone, and reolink-aio holds none for it.

Same safety rules as the rest of the probe: read-only, and every request is a
scheduler job at prefetch priority. These requests wake a camera that runs on
its battery, so one is checked only with "Include battery cameras"; a battery
camera on wired power never sleeps, so it is checked without it. The report
holds counts, types, lengths and timings, never an event's time of day: those
say when someone came to the door.
"""

from collections import Counter
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from functools import partial
import statistics
import time
from typing import Any

from homeassistant.util import dt as dt_util

from .bridge import ChannelInfo, HostInfo, ReolinkHostHandle, VodEvent
from .probe_playback import JobRunner

EVENT_STREAMS: tuple[str, ...] = ("sub", "main")
# The newest events of the day sampled with snapshot_past.
SNAPSHOT_SAMPLES = 3
# How far into an event the picture is asked for (an event's first second can
# come before the camera's recording of it does).
SNAPSHOT_OFFSET = timedelta(seconds=2)
NO_TARGET = "no camera here records where Reolink Viewer cannot play it"


@dataclass(slots=True)
class EventsOptions:
    """Options of the events check."""

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


def is_target(host: ReolinkHostHandle, channel: int) -> bool:
    """Return True for a channel that records but cannot be played here."""
    return host.stores_recordings(channel) and not host.records_locally(channel)


async def device_clock(
    host: ReolinkHostHandle, job: JobRunner
) -> tuple[dict[str, Any], datetime]:
    """Return what is known of the device's clock, and its wall time now.

    The device's time as reolink-aio reads it; else Baichuan's time query
    (104); else Home Assistant's own clock (the camera is at home).
    """
    clock: dict[str, Any] = {"timezone_known": host.timezone() is not None}
    try:
        now = await job(host.async_get_time)
    except Exception as err:  # noqa: BLE001 - recorded in the report
        clock["device_error"] = _err(err)
    else:
        clock["source"] = "device"
        return clock, now.replace(tzinfo=None)

    local = dt_util.now()
    offset = local.utcoffset()
    clock["home_assistant_utc_offset_s"] = (
        round(offset.total_seconds()) if offset is not None else None
    )
    began = time.monotonic()
    try:
        answer = await job(host.async_baichuan_clock)
    except Exception as err:  # noqa: BLE001 - recorded in the report
        clock["baichuan"] = {"ok": False, "error": _err(err)}
    else:
        baichuan: dict[str, Any] = {
            "ok": answer.wall is not None,
            "latency_ms": _ms(began),
            "time_zone": answer.time_zone,
            "fields": list(answer.fields),
        }
        clock["baichuan"] = baichuan
        if answer.wall is not None:
            # Its wall clock against Home Assistant's: the zones agree when
            # this is a few seconds, not hours.
            ahead = answer.wall - local.replace(tzinfo=None)
            baichuan["ahead_of_home_assistant_s"] = round(ahead.total_seconds())
            clock["source"] = "baichuan"
            return clock, answer.wall
    clock["source"] = "home_assistant"
    return clock, local.replace(tzinfo=None)


class EventsCheck:
    """The events check for one host."""

    def __init__(
        self,
        host: ReolinkHostHandle,
        job: JobRunner,
        *,
        include_battery: bool,
        ffmpeg_binary: str,
        step_timeout: float,
        progress: Callable[[str], None],
    ) -> None:
        """Initialize the check."""
        self._host = host
        self._job = job
        self._include_battery = include_battery
        self._ffmpeg = ffmpeg_binary
        self._step_timeout = step_timeout
        self._progress = progress

    async def async_host(self, info: HostInfo) -> dict[str, Any]:
        """Check every channel of the host that records but cannot be played."""
        targets = [c for c in info.channels if is_target(self._host, c.channel)]
        if not targets:
            return _skipped(NO_TARGET)
        channels = [await self._channel(c) for c in targets]
        return {
            "ok": any(c.get("ok") for c in channels),
            "storage": self._host.storage_state(),
            "channels": channels,
        }

    def _skip_reason(self, channel: ChannelInfo) -> str | None:
        if not channel.online:
            return "offline"
        if channel.sleeping:
            return "sleeping"
        if channel.is_battery and not channel.wired_power and not self._include_battery:
            return "on battery (opt-in: include_battery)"
        return None

    async def _channel(self, channel: ChannelInfo) -> dict[str, Any]:
        ch = channel.channel
        result: dict[str, Any] = {
            "channel": ch,
            "name": channel.name,
            "model": channel.model,
            "is_battery": channel.is_battery,
            "wired_power": channel.wired_power,
            "supports_replay": channel.supports_replay,
        }
        if (reason := self._skip_reason(channel)) is not None:
            result["skipped"] = reason
            return result
        result["clock"], wall = await device_clock(self._host, self._job)
        today = datetime.combine(wall.date(), datetime.min.time())

        self._progress(f"ch{ch} events: day search")
        result["day_search"] = await self._days(ch, today.replace(day=1), wall)

        searches: dict[str, dict[str, Any]] = {}
        found: dict[str, list[VodEvent]] = {}
        windows = {
            "today": (today, wall),
            "yesterday": (today - timedelta(days=1), today - timedelta(seconds=1)),
        }
        for label, (start, end) in windows.items():
            for stream in EVENT_STREAMS:
                self._progress(f"ch{ch} events: {label} {stream}")
                key = f"{label}_{stream}"
                searches[key], events = await self._events(ch, start, end, stream)
                if events is not None:
                    found[key] = events
        result["event_search"] = searches

        sample = found.get("today_sub") or found.get("yesterday_sub") or []
        result["snapshot_past"] = await self._snapshots(ch, sample)
        result["ok"] = bool(found)
        result["gate"] = {
            "event_search": bool(found),
            # A search that answers but finds nothing is no proof: compare
            # this with what the Reolink app lists for the same two days.
            "events_found": sum(len(events) for events in found.values()),
            "day_search": bool(result["day_search"].get("ok")),
            "thumbnails": _thumbnails(result["snapshot_past"]),
        }
        return result

    async def _days(self, ch: int, start: datetime, end: datetime) -> dict[str, Any]:
        began = time.monotonic()
        try:
            days: list[date] = await self._job(
                lambda: self._host.async_recording_days(ch, start, end)
            )
        except Exception as err:  # noqa: BLE001 - recorded in the report
            return {"ok": False, "error": _err(err)}
        return {
            "ok": True,
            "latency_ms": _ms(began),
            "days": len(days),
            "today": end.date() in days,
        }

    async def _events(
        self, ch: int, start: datetime, end: datetime, stream: str
    ) -> tuple[dict[str, Any], list[VodEvent] | None]:
        began = time.monotonic()
        try:
            search = await self._job(
                lambda: self._host.async_search_day_events(ch, start, end, stream),
                # One retry after a pause, as the events feed does.
                timeout=self._step_timeout * 2,
            )
        except Exception as err:  # noqa: BLE001 - recorded in the report
            return {"ok": False, "error": _err(err)}, None
        events = search.events
        lengths = [(e.end - e.start).total_seconds() for e in events]
        summary: dict[str, Any] = {
            "ok": True,
            "latency_ms": _ms(began),
            "events": len(events),
            "recordings": len({e.file_id for e in events}),
            "types": dict(Counter(t for e in events for t in e.types)),
        }
        if lengths:
            summary["length_s"] = {
                "min": round(min(lengths)),
                "median": round(statistics.median(lengths)),
                "max": round(max(lengths)),
            }
        return summary, events

    async def _snapshots(self, ch: int, events: list[VodEvent]) -> dict[str, Any]:
        if not events:
            return _skipped("no event to sample")
        samples: list[dict[str, Any]] = []
        newest = sorted(events, key=lambda e: e.start, reverse=True)
        for event in newest[:SNAPSHOT_SAMPLES]:
            when = min(event.start + SNAPSHOT_OFFSET, event.end)
            self._progress(f"ch{ch} events: picture {len(samples) + 1}")
            began = time.monotonic()
            try:
                image = await self._job(
                    partial(
                        self._host.async_snapshot_past, ch, when, "sub", self._ffmpeg
                    )
                )
            except Exception as err:  # noqa: BLE001 - recorded in the report
                samples.append({"ok": False, "error": _err(err)})
                continue
            is_jpeg = image[:2] == b"\xff\xd8"
            samples.append(
                {
                    "ok": is_jpeg,
                    "latency_ms": _ms(began),
                    "bytes": len(image),
                    **({} if is_jpeg else {"error": "not a JPEG"}),
                }
            )
        return {"ok": any(s["ok"] for s in samples), "samples": samples}


def _thumbnails(snapshots: dict[str, Any]) -> bool | None:
    """Whether pictures came: None when there was nothing to sample."""
    if "skipped" in snapshots:
        return None
    return bool(snapshots.get("ok"))

"""Scrub cuts: what Phase 10's gate measures first (step 0), in the probe.

Scrubbing that shows the picture (Phase 10) would ask the device, for each
moment a drag passes that is not cached, for a short download cut (143) and
show its first key frame. Before that is built, this measures it on the sub
stream of a long recording: the time from a 2-second cut's request to its
first key frame, at ``SCRUB_POINTS`` moments through the recording, asked

- **one at a time**, with a pause after each cut's end (144);
- **back to back**, the next cut asked as soon as the last one's key frame
  came and its end was sent, as a drag would ask;
- **beside a playback cut** of the same channel. The device sends one cut per
  channel at a time, so cuts take turns (Phase 5c): the playback cut runs a
  while, gives its turn up (144), the scrub cut runs, and the playback cut
  asks again from where it had reached. How long the playback cut goes
  without data each time is measured too.

Each set asks moments of its own (a third of the spacing apart), so that the
device's own read cache helps none of them. A cut's time runs to its first key
frame near the moment asked, by the key frame's own clock: a key frame of the
cut before it, still arriving, is counted as stale, not as the answer.

One login on a connection of its own and one stream slot held throughout
(``probe_baichuan`` holds both), at playback priority. Read-only: the only
commands sent are 143 and 144.
"""

import asyncio
import contextlib
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta, tzinfo
import statistics
import time
from typing import Any

from .baichuan_client import BaichuanClientError, BaichuanReplayClient
from .baichuan_media import Block
from .baichuan_source import ANY_CHANNEL_BITMAP
from .bridge import VodFile

SCRUB_POINTS = 20
SCRUB_CUT_S = 2
# A cut whose key frame has not come by then has failed.
KEY_TIMEOUT_S = 5.0
# One at a time: the pause after each cut's end.
SETTLE_S = 1.0
# Beside a playback cut: how long the playback cut runs between scrub cuts.
PLAYBACK_RUN_S = 2.0
# A key frame this far before or after the moment asked answers it: the
# key-frame interval is 1-4 s on the owner's sub streams.
KEY_BEFORE_S = 10.0
KEY_AFTER_S = SCRUB_CUT_S + 3.0
# The gate (docs/IMPLEMENTATION_PLAN.md, step 10.0): back to back, a median
# cut of this much or less (and a key frame decoded in 30 ms, in the browser).
GATE_MS = 300
# The points lie between 5 % and 95 % of the recording.
EDGE = 0.05
SUB_STREAM = "subStream"
# Key frames' POSIX times outside these are not times (as StreamStats reads them).
_PLAUSIBLE = (1_500_000_000, 2_100_000_000)


def scrub_points(file: VodFile, count: int, phase: float) -> list[datetime]:
    """Return ``count`` moments spread through a recording, ``phase`` of a step on."""
    duration = (file.end - file.start).total_seconds()
    step = duration * (1 - 2 * EDGE) / count
    return [
        (file.start + timedelta(seconds=duration * EDGE + step * (i + phase))).replace(
            microsecond=0
        )
        for i in range(count)
    ]


def key_time(block: Block, tz: tzinfo | None) -> datetime | None:
    """Return a key frame's time on the device's wall clock, if it carries one.

    Its POSIX time in the device's zone, as deep starts read it; without a
    known zone, in Home Assistant's (as the probe's other reports do).
    """
    when = block.unix_time
    if when is None or not _PLAUSIBLE[0] < when < _PLAUSIBLE[1]:
        return None
    if tz is None:
        return datetime.fromtimestamp(when)
    return datetime.fromtimestamp(when, UTC).astimezone(tz).replace(tzinfo=None)


class KeyWatch:
    """Notes when a cut's first key frame near the moment asked arrives.

    Given to the download as ``on_block``. ``newest`` follows the cut's key
    frames after that one: where a playback cut has reached.
    """

    def __init__(self, asked: datetime, tz: tzinfo | None = None) -> None:
        """Watch for a key frame near ``asked`` (device-local; ``tz``, the device's zone)."""
        self.asked = asked.replace(tzinfo=None)
        self.tz = tz
        self.began = time.monotonic()
        self.found = asyncio.Event()
        self.at: float | None = None
        self.offset_s: float | None = None
        self.newest: datetime | None = None
        self.stale = 0
        self.clockless = False

    def __call__(self, block: Block) -> None:
        """Account one block of the cut."""
        if block.kind != "key":
            return
        when = key_time(block, self.tz)
        if when is None:
            # No clock to tell this cut's key frames from the last one's.
            self.clockless = True
        else:
            offset = (when - self.asked).total_seconds()
            if self.at is None and not -KEY_BEFORE_S <= offset <= KEY_AFTER_S:
                self.stale += 1
                return
            if self.at is None:
                self.offset_s = round(offset, 1)
            if self.newest is None or when > self.newest:
                self.newest = when
        if self.at is None:
            self.at = time.monotonic()
            self.found.set()

    @property
    def key_ms(self) -> float | None:
        """Return the time from the watch's start to the key frame, if it came."""
        return None if self.at is None else round((self.at - self.began) * 1000, 1)


@dataclass(slots=True)
class _Series:
    """One set's cuts as they are measured."""

    began: float = field(default_factory=time.monotonic)
    cuts: list[dict[str, Any]] = field(default_factory=list)
    error: str | None = None


def _spread(values: list[float]) -> dict[str, float] | None:
    if not values:
        return None
    ordered = sorted(values)
    return {
        "min": ordered[0],
        "median": round(statistics.median(ordered), 1),
        "p90": ordered[min(len(ordered) - 1, int(len(ordered) * 0.9))],
        "max": ordered[-1],
    }


def _err(err: BaseException) -> str:
    if isinstance(err, TimeoutError):
        return "timeout"
    return f"{type(err).__name__}: {err or type(err).__name__}"[:300]


def _summary(series: _Series) -> dict[str, Any]:
    """Return a set's figures: the key frames' times, the stale ones, the rate."""
    cuts = series.cuts
    answered = [c["key_ms"] for c in cuts if c.get("key_ms") is not None]
    wall = time.monotonic() - series.began
    out: dict[str, Any] = {
        "asked": len(cuts),
        "answered": len(answered),
        "key_ms": _spread(answered),
        "reply_ms": _spread([c["reply_ms"] for c in cuts if "reply_ms" in c]),
        "end_ms": _spread([c["end_ms"] for c in cuts if "end_ms" in c]),
        "key_vs_asked_s": _spread(
            [c["key_vs_asked_s"] for c in cuts if c.get("key_vs_asked_s") is not None]
        ),
        "stale_key_frames": sum(c.get("stale", 0) for c in cuts),
        "wall_s": round(wall, 2),
        "each_key_ms": [c.get("key_ms") for c in cuts],
    }
    if answered and wall > 0:
        out["answered_per_s"] = round(len(answered) / wall, 2)
    if any(c.get("clockless") for c in cuts):
        out["clockless"] = (
            "the key frames carry no time: a stale one cannot be told from the answer"
        )
    errors = sorted({c["error"] for c in cuts if "error" in c})
    if errors:
        out["errors"] = errors[:5]
    if series.error is not None:
        out["error"] = series.error
    return out


class ScrubCuts:
    """The scrub cuts on one channel's sub stream, on a logged-in connection."""

    def __init__(
        self,
        client: BaichuanReplayClient,
        channel: int,
        file: VodFile,
        *,
        points: int = SCRUB_POINTS,
        settle_s: float = SETTLE_S,
        playback_run_s: float = PLAYBACK_RUN_S,
        key_timeout_s: float = KEY_TIMEOUT_S,
        tz: tzinfo | None = None,
    ) -> None:
        """Measure on ``client`` (connected and logged in), in ``file``.

        ``tz`` is the device's zone, to read its key frames' clocks.
        """
        self._client = client
        self._ch = channel
        self._file = file
        self._points = points
        self._settle = settle_s
        self._run = playback_run_s
        self._timeout = key_timeout_s
        self._tz = tz
        self._bitmap: int | None = None

    async def async_run(self) -> dict[str, Any]:
        """Run the three sets; the gate's figure is the back-to-back median."""
        result: dict[str, Any] = {
            "points": self._points,
            "cut_s": SCRUB_CUT_S,
            "stream": "sub",
        }
        n = self._points
        result["one_at_a_time"] = await self._series(
            scrub_points(self._file, n, 0.0), pause=self._settle
        )
        result["back_to_back"] = await self._series(
            scrub_points(self._file, n, 1 / 3), pause=0.0
        )
        result["beside_playback"] = await self._beside(
            scrub_points(self._file, n, 2 / 3)
        )
        if self._bitmap is not None:
            result["bitmap"] = str(self._bitmap)
        spread = result["back_to_back"].get("key_ms")
        median = spread["median"] if spread else None
        result["gate"] = {
            "back_to_back_median_ms": median,
            "limit_ms": GATE_MS,
            "passes": median is not None and median <= GATE_MS,
        }
        return result

    async def _ask(self, start: datetime, end: datetime, watch: KeyWatch) -> float:
        """Send a 143 for the sub stream; the any-channel bitmap if the bit is refused."""
        if self._bitmap is None:
            try:
                reply_ms, _stats, _fields = await self._client.download(
                    self._ch,
                    SUB_STREAM,
                    start,
                    end,
                    support_sub=1,
                    on_block=watch,
                    analyse=False,
                )
            except BaichuanClientError as err:
                if "refused" not in str(err):
                    raise
                self._bitmap = ANY_CHANNEL_BITMAP
            else:
                return reply_ms
        reply_ms, _stats, _fields = await self._client.download(
            self._ch,
            SUB_STREAM,
            start,
            end,
            bitmap=self._bitmap,
            support_sub=1,
            on_block=watch,
            analyse=False,
        )
        return reply_ms

    async def _wait(self, watch: KeyWatch) -> bool:
        try:
            async with asyncio.timeout(self._timeout):
                await watch.found.wait()
        except TimeoutError:
            return False
        return True

    async def _cut(self, at: datetime) -> dict[str, Any]:
        """One scrub cut: 143 for 2 s from ``at``, its key frame, then 144."""
        watch = KeyWatch(at, self._tz)
        cut: dict[str, Any] = {}
        cut["reply_ms"] = await self._ask(
            at, at + timedelta(seconds=SCRUB_CUT_S), watch
        )
        if not await self._wait(watch):
            cut["error"] = f"no key frame near the moment within {self._timeout:g} s"
        end_ms, _status = await self._client.download_end(self._ch)
        cut["end_ms"] = end_ms
        cut["key_ms"] = watch.key_ms
        cut["key_vs_asked_s"] = watch.offset_s
        if watch.stale:
            cut["stale"] = watch.stale
        if watch.clockless:
            cut["clockless"] = True
        return cut

    async def _series(self, points: list[datetime], *, pause: float) -> dict[str, Any]:
        series = _Series()
        try:
            for at in points:
                series.cuts.append(await self._cut(at))
                if pause:
                    await asyncio.sleep(pause)
        except (BaichuanClientError, OSError, TimeoutError) as err:
            series.error = _err(err)
        return _summary(series)

    async def _beside(self, points: list[datetime]) -> dict[str, Any]:
        """Scrub cuts taking turns with a playback cut of the same channel."""
        series = _Series()
        file = self._file
        reached = file.start + (file.end - file.start) * EDGE / 2
        resumes: list[float] = []
        gaps: list[float] = []
        playing = False
        first_ms: float | None = None
        try:
            watch = KeyWatch(reached, self._tz)
            await self._ask(reached, file.end, watch)
            playing = True
            first = await self._wait(watch)
            first_ms = watch.key_ms
            if not first:
                series.error = "the playback cut sent no key frame"
            for at in points if first else []:
                await asyncio.sleep(self._run)
                reached = watch.newest or reached
                # The playback cut gives its turn up, as a cut does for another.
                stopped = time.monotonic()
                await self._client.download_end(self._ch)
                playing = False
                series.cuts.append(await self._cut(at))
                # And asks again from where it had reached.
                watch = KeyWatch(reached, self._tz)
                await self._ask(reached, file.end, watch)
                playing = True
                if not await self._wait(watch):
                    series.error = "the playback cut sent no key frame after a turn"
                    break
                if (resume := watch.key_ms) is not None and watch.at is not None:
                    resumes.append(resume)
                    gaps.append(round((watch.at - stopped) * 1000, 1))
        except (BaichuanClientError, OSError, TimeoutError) as err:
            series.error = _err(err)
        finally:
            if playing:
                with contextlib.suppress(BaichuanClientError, OSError, TimeoutError):
                    await self._client.download_end(self._ch)
        out: dict[str, Any] = _summary(series)
        out["playback"] = {
            "first_key_ms": first_ms,
            # From its new 143 to its key frame, after each scrub cut.
            "resume_ms": _spread(resumes),
            # From its 144 to its next key frame: how long it had no data.
            "without_data_ms": _spread(gaps),
            "run_s": self._run,
        }
        return out

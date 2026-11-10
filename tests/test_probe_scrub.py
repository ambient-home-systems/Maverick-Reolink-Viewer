"""Scrub cuts (Phase 10 step 0), with a fake client that sends key frames on a timer."""

import asyncio
from collections.abc import Callable
from datetime import datetime, timedelta
import itertools
from typing import Any, cast
from zoneinfo import ZoneInfo

from custom_components.reolink_viewer.baichuan_client import BaichuanClientError
from custom_components.reolink_viewer.baichuan_media import Block
from custom_components.reolink_viewer.bridge import VodFile
from custom_components.reolink_viewer.probe_scrub import (
    EDGE,
    KeyWatch,
    ScrubCuts,
    key_time,
    scrub_points,
)

START = datetime(2026, 11, 8, 14, 0, 0)


def hour() -> VodFile:
    return VodFile(
        start=START,
        end=START + timedelta(hours=1),
        name="1-18-0-0126",
        stream="sub",
        size=200_000_000,
        triggers=(),
    )


def key(when: datetime | None) -> Block:
    """A key frame block stamped with ``when`` (device-local), or with no time."""
    return Block(
        kind="key",
        magic=b"",
        header=b"",
        payload=b"\x00" * 30_000,
        unix_time=None if when is None else int(when.timestamp()),
    )


class FakeClient:
    """Sends a cut's key frames after ``delay`` s; the cut before it's leftovers first."""

    def __init__(
        self,
        *,
        delay: float = 0.01,
        leftovers: bool = True,
        refuse_bit: bool = False,
        silent_at: datetime | None = None,
    ) -> None:
        self.delay = delay
        self.leftovers = leftovers
        self.refuse_bit = refuse_bit
        self.silent_at = silent_at
        self.calls: list[tuple[str, Any]] = []
        self._timers: list[asyncio.TimerHandle] = []
        self._last: datetime | None = None

    async def download(
        self,
        channel: int,
        stream: str,
        start: datetime,
        end: datetime,
        *,
        bitmap: int | None = None,
        support_sub: int = 1,
        on_block: Callable[[Block], None] | None = None,
        analyse: bool = True,
    ) -> tuple[float, Any, dict[str, str]]:
        self.calls.append(("download", (channel, stream, start, end, bitmap)))
        assert stream == "subStream"
        assert support_sub == 1
        assert analyse is False
        if self.refuse_bit and bitmap is None:
            raise BaichuanClientError("download refused with status 400")
        assert on_block is not None
        loop = asyncio.get_running_loop()
        # What the cut before it still sends: a key frame far from this one.
        if self.leftovers and self._last is not None:
            on_block(key(self._last))
        self._last = start
        if start != self.silent_at:
            # Its key frames: one a second before the moment, then onwards.
            for i in range(4):
                when = start - timedelta(seconds=1) + timedelta(seconds=2 * i)
                self._timers.append(
                    loop.call_later(self.delay * (1 + i), on_block, key(when))
                )
        return 12.0, None, {}

    async def download_end(self, channel: int) -> tuple[float, int]:
        self.calls.append(("download_end", channel))
        for timer in self._timers:
            timer.cancel()
        self._timers = []
        return 4.0, 200

    def downloads(self) -> list[tuple[Any, ...]]:
        return [args for name, args in self.calls if name == "download"]


def _cuts(client: FakeClient, **kwargs: Any) -> ScrubCuts:
    options: dict[str, Any] = {
        "points": 4,
        "settle_s": 0.0,
        "playback_run_s": 0.03,
        "key_timeout_s": 0.3,
    }
    options.update(kwargs)
    return ScrubCuts(cast(Any, client), 2, hour(), **options)


def test_points_spread_through_the_recording() -> None:
    file = hour()
    first = scrub_points(file, 20, 0.0)
    assert len(first) == 20
    assert first[0] == START + timedelta(minutes=3)  # 5 % in
    assert all(b - a == timedelta(seconds=162) for a, b in itertools.pairwise(first))
    assert first[-1] < file.end - timedelta(minutes=3)
    # Each set asks moments of its own.
    second = scrub_points(file, 20, 1 / 3)
    third = scrub_points(file, 20, 2 / 3)
    assert not set(first) & set(second)
    assert not set(second) & set(third)
    assert second[0] == START + timedelta(minutes=3, seconds=54)
    assert EDGE == 0.05


def test_the_watch_tells_the_answer_from_a_stale_key_frame() -> None:
    asked = START + timedelta(minutes=10)
    watch = KeyWatch(asked)
    watch(Block(kind="frame", magic=b"", header=b"", payload=b""))
    watch(key(asked - timedelta(minutes=5)))  # the cut before it's
    assert watch.stale == 1
    assert not watch.found.is_set()
    watch(key(asked - timedelta(seconds=2)))
    assert watch.found.is_set()
    assert watch.offset_s == -2.0
    assert watch.key_ms is not None
    watch(key(asked + timedelta(seconds=30)))  # later key frames: where it reached
    assert watch.newest == asked + timedelta(seconds=30)
    # Without a time on the key frame, the first one answers, and it is said.
    bare = KeyWatch(asked)
    bare(key(None))
    assert bare.found.is_set()
    assert bare.clockless
    assert bare.offset_s is None
    assert key_time(key(None), None) is None


def test_key_frames_read_on_the_device_clock() -> None:
    """A key frame's POSIX time is read in the device's zone, as deep starts do."""
    zone = ZoneInfo("America/New_York")
    asked = datetime(2026, 11, 8, 9, 30, 0)  # the device's wall clock
    stamped = asked.replace(tzinfo=zone)
    block = Block(
        kind="key",
        magic=b"",
        header=b"",
        payload=b"",
        unix_time=int(stamped.timestamp()) - 1,
    )
    assert key_time(block, zone) == asked - timedelta(seconds=1)
    watch = KeyWatch(asked, zone)
    watch(block)
    assert watch.found.is_set()
    assert watch.offset_s == -1.0


async def test_three_sets_measured_and_the_gate() -> None:
    client = FakeClient()
    result = await _cuts(client).async_run()
    assert result["points"] == 4
    assert result["cut_s"] == 2
    assert result["stream"] == "sub"
    for name in ("one_at_a_time", "back_to_back", "beside_playback"):
        part = result[name]
        assert part["asked"] == 4, name
        assert part["answered"] == 4, name
        assert part["key_ms"]["median"] < 300
        assert part["reply_ms"]["median"] == 12.0
        assert part["end_ms"]["median"] == 4.0
        assert part["key_vs_asked_s"] == {
            "min": -1.0,
            "median": -1.0,
            "p90": -1.0,
            "max": -1.0,
        }
        assert len(part["each_key_ms"]) == 4
        assert "errors" not in part
        assert "error" not in part
    # Leftovers of the cut before were counted, not taken for the answer.
    assert (
        result["one_at_a_time"]["stale_key_frames"] == 3
    )  # the first had none before it
    assert result["back_to_back"]["answered_per_s"] > 0
    playback = result["beside_playback"]["playback"]
    assert playback["first_key_ms"] is not None
    assert playback["resume_ms"]["median"] < 300
    assert playback["without_data_ms"]["min"] >= playback["resume_ms"]["min"]
    assert result["gate"]["limit_ms"] == 300
    assert result["gate"]["passes"] is True
    # Every cut is ended; the playback cut asks again from where it had reached.
    downloads = client.downloads()
    ends = [c for c in client.calls if c[0] == "download_end"]
    assert len(ends) == len(downloads)
    playback_cuts = [d for d in downloads if d[3] == hour().end]
    assert len(playback_cuts) == 5  # its start, then after each of 4 scrub cuts
    assert playback_cuts[1][2] > playback_cuts[0][2]
    # The scrub cuts last 2 s; the bitmap is the channel's own.
    scrub = [d for d in downloads if d[3] != hour().end]
    assert all(d[3] - d[2] == timedelta(seconds=2) and d[4] is None for d in scrub)
    assert "bitmap" not in result


async def test_slow_cuts_fail_the_gate() -> None:
    result = await _cuts(FakeClient(delay=0.12), key_timeout_s=1.0).async_run()
    assert result["back_to_back"]["key_ms"]["median"] > 100
    gate = result["gate"]
    assert gate["back_to_back_median_ms"] == result["back_to_back"]["key_ms"]["median"]
    assert gate["passes"] is (gate["back_to_back_median_ms"] <= 300)


async def test_a_cut_without_a_key_frame_and_the_any_channel_bitmap() -> None:
    silent = scrub_points(hour(), 4, 1 / 3)[2]
    client = FakeClient(refuse_bit=True, silent_at=silent)
    result = await _cuts(client).async_run()
    back = result["back_to_back"]
    assert back["asked"] == 4
    assert back["answered"] == 3
    assert back["each_key_ms"][2] is None
    assert back["errors"] == ["no key frame near the moment within 0.3 s"]
    # Refused with the channel's bit once, then the any-channel bitmap throughout.
    assert result["bitmap"] == "255"
    first, *rest = client.downloads()
    assert first[4] is None
    assert all(d[4] == 255 for d in rest)


async def test_a_lost_connection_ends_a_set_with_its_error() -> None:
    client = FakeClient()
    calls = 0
    real = client.download

    async def flaky(*args: Any, **kwargs: Any) -> Any:
        nonlocal calls
        calls += 1
        if calls == 6:
            raise OSError("connection reset")
        return await real(*args, **kwargs)

    client.download = flaky  # type: ignore[method-assign]
    result = await _cuts(client).async_run()
    assert result["one_at_a_time"]["answered"] == 4
    back = result["back_to_back"]
    assert back["asked"] == 1
    assert back["error"] == "OSError: connection reset"


async def test_a_playback_cut_without_a_key_frame() -> None:
    client = FakeClient()
    playback_at = hour().start + (hour().end - hour().start) * EDGE / 2
    client.silent_at = playback_at.replace(microsecond=0)
    result = await _cuts(client).async_run()
    beside = result["beside_playback"]
    assert beside["error"] == "the playback cut sent no key frame"
    assert beside["asked"] == 0
    assert beside["playback"]["first_key_ms"] is None
    # Its cut was ended all the same.
    assert client.calls[-1] == ("download_end", 2)

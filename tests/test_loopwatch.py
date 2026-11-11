"""How late Home Assistant's event loop runs a timer (loopwatch.py, v0.62.2)."""

import asyncio
import re
import sys
import time
from unittest.mock import patch

from custom_components.reolink_viewer import loopwatch
from custom_components.reolink_viewer.loopwatch import LoopWatch
from homeassistant.core import HomeAssistant


def _running(watch: LoopWatch) -> bool:
    return watch._handle is not None


async def _ticks(watch: LoopWatch, n: int) -> None:
    for _ in range(200):
        if len(watch._samples) >= n:
            return
        await asyncio.sleep(0.01)
    raise AssertionError(f"fewer than {n} ticks")


async def test_a_held_loop_is_measured(hass: HomeAssistant) -> None:
    """A blocking call holds the loop: the timer runs late by about as long."""
    watch = LoopWatch(hass)
    assert watch.snapshot()["held_10s_ms"] is None
    with patch.object(loopwatch, "PERIOD_S", 0.02):
        watch.watch()
        await _ticks(watch, 2)
        time.sleep(0.3)  # noqa: ASYNC251 - the work that holds the loop
        await _ticks(watch, 4)
        held = watch.held_ms(10)
        assert held is not None
        assert held >= 250
        snapshot = watch.snapshot()
        assert snapshot["held_60s_ms"] == held
        assert snapshot["watching_s"] is not None
        watch.stop()
    assert not _running(watch)


async def test_the_timer_stops_when_nobody_reads_it(hass: HomeAssistant) -> None:
    """Each read keeps it running a while; then it stops by itself."""
    watch = LoopWatch(hass)
    with (
        patch.object(loopwatch, "PERIOD_S", 0.02),
        patch.object(loopwatch, "WATCH_S", 0.1),
    ):
        watch.watch()
        await asyncio.sleep(0.25)
        assert not _running(watch)
        # Read again: it runs again.
        watch.watch()
        assert _running(watch)
        watch.stop()


def _hold_the_loop(seconds: float) -> None:
    time.sleep(seconds)


async def test_the_watchdog_notes_what_held_the_loop(hass: HomeAssistant) -> None:
    """Held past its period, the loop's thread is caught where it is (v0.63.3)."""
    watch = LoopWatch(hass)
    with (
        patch.object(loopwatch, "PERIOD_S", 0.05),
        patch.object(loopwatch, "POLL_S", 0.02),
        patch.object(loopwatch, "CAPTURE_AFTER_S", 0.15),
    ):
        watch.watch()
        await _ticks(watch, 2)
        _hold_the_loop(0.6)
        await _ticks(watch, 4)
        (hold,) = watch.snapshot()["held_by"]
        assert hold["seen_ms"] >= 150
        assert hold["ago_s"] < 5
        # Innermost first: the function that held it, with its file and line.
        assert "test_loopwatch.py:" in hold["where"][0]
        assert hold["where"][0].endswith(" in _hold_the_loop")
        assert len(hold["where"]) <= loopwatch.FRAMES
        thread = watch._thread
        assert thread is not None
        assert thread.is_alive()
        watch.stop()
        # Stopped: no thread left behind.
        assert not thread.is_alive()


async def test_a_hold_of_a_fifth_of_a_second_is_noted(hass: HomeAssistant) -> None:
    """The shipped watchdog notes a hold the 0.3 s of v0.63.3 missed (v0.63.4).

    The owner's run of v0.63.3 found the loop held 211 ms, without a culprit.
    """
    watch = LoopWatch(hass)
    with patch.object(loopwatch, "PERIOD_S", 0.05):
        watch.watch()
        await _ticks(watch, 2)
        # Late by up to 0.27 s past the period: under 0.3 s, over 0.15 s.
        _hold_the_loop(0.32)
        await _ticks(watch, 4)
        holds = watch.snapshot()["held_by"]
        watch.stop()
    assert holds
    assert 150 <= holds[0]["seen_ms"] < 300
    assert holds[0]["where"][0].endswith(" in _hold_the_loop")


def test_a_frame_says_its_file_line_and_function() -> None:
    """Innermost first: "file:line in function"."""
    where = loopwatch._where(sys._getframe())
    assert re.fullmatch(
        r".*test_loopwatch\.py:\d+ in test_a_frame_says_its_file_line_and_function",
        where[0],
    )

"""How late Home Assistant's event loop runs a timer (loopwatch.py, v0.62.2)."""

import asyncio
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

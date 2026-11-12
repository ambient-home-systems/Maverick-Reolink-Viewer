"""How late Home Assistant's event loop runs a timer (loopwatch.py, v0.62.2)."""

import asyncio
import re
import sys
import time
from typing import Any
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


# Code as an integration's file holds it: compiled under its path (v0.63.5).
_SPOOK = "/config/custom_components/spook/template_extraction.py"
_JINJA = "/usr/local/lib/python3.13/site-packages/jinja2/lexer.py"


def _as_file(path: str, source: str) -> dict[str, Any]:
    space: dict[str, Any] = {"time": time, "sys": sys, "loopwatch": loopwatch}
    exec(compile(source, path, "exec"), space)
    return space


_lexer = _as_file(_JINJA, "def tokeniter(work):\n    return work()\n")
_spook = _as_file(_SPOOK, "def _lexed(tokeniter, work):\n    return tokeniter(work)\n")


async def test_a_hold_says_whose_code_held_it_and_how_long(hass: HomeAssistant) -> None:
    """Spook's template scan held the owner's loop 1.3 s, under Jinja (v0.63.5).

    The hold names the integration however deep in a library it is held,
    follows the hold to its end, and counts in the last 10 s's sum.
    """
    watch = LoopWatch(hass)
    with patch.object(loopwatch, "PERIOD_S", 0.05):
        watch.watch()
        await _ticks(watch, 2)
        _spook["_lexed"](_lexer["tokeniter"], lambda: _hold_the_loop(0.6))
        await _ticks(watch, 4)
        await _ticks(watch, 6)
        snapshot = watch.snapshot()
        watch.stop()
    (hold,) = snapshot["held_by"]
    assert hold["by"] == "custom_components/spook"
    # Innermost first: the work, the library under it, the integration's call.
    assert hold["where"][0].endswith(" in _hold_the_loop")
    assert hold["where"][2] == "site-packages/jinja2/lexer.py:2 in tokeniter"
    assert hold["where"][3] == (
        "custom_components/spook/template_extraction.py:2 in _lexed"
    )
    # Followed to its end: about the whole 0.6 s, not the 0.15 s first seen.
    assert hold["seen_ms"] >= 400
    assert hold["ago_s"] < 5
    assert snapshot["held_10s_count"] == 1
    assert snapshot["held_10s_total_ms"] >= 400


def test_whose_code_a_stack_is_in() -> None:
    """The innermost integration; Home Assistant's own code; or none."""

    def here() -> Any:
        return loopwatch._owner(loopwatch._stack(sys._getframe()))

    assert _spook["_lexed"](_lexer["tokeniter"], here) == "custom_components/spook"
    core = _as_file(
        "/usr/lib/python3.13/site-packages/homeassistant/core.py",
        "def run(work):\n    return work()\n",
    )
    recorder = _as_file(
        "/usr/lib/python3.13/site-packages/homeassistant/components/recorder/core.py",
        "def commit(work):\n    return work()\n",
    )
    assert core["run"](here) == "homeassistant"
    assert core["run"](lambda: recorder["commit"](here)) == (
        "homeassistant/components/recorder"
    )
    assert here() is None or here() == "homeassistant"


def test_a_generator_held_in_names_its_caller_after_it_yields() -> None:
    """The owner's run of v0.63.6: Spook's frames, but no "by" (v0.63.7).

    Jinja's lexer is a generator: once it yields, its frame no longer links
    to its caller. The stack read at the hold still has it.
    """
    seen: dict[str, Any] = {}
    lexer = _as_file(
        _JINJA,
        "def tokeniter(seen):\n"
        "    seen['frame'] = sys._getframe()\n"
        "    seen['stack'] = loopwatch._stack(sys._getframe())\n"
        "    yield 1\n"
        "    yield 2\n",
    )
    spook = _as_file(
        _SPOOK,
        "def _lexed(tokeniter, seen):\n    tokens = tokeniter(seen)\n    next(tokens)\n    return tokens\n",
    )
    tokens = spook["_lexed"](lexer["tokeniter"], seen)
    # Yielded: the frame alone no longer says who called it.
    assert seen["frame"].f_back is None
    assert loopwatch._owner(loopwatch._stack(seen["frame"])) is None
    # Read at the hold: it does.
    assert loopwatch._owner(seen["stack"]) == "custom_components/spook"
    assert loopwatch._where(seen["stack"])[:2] == [
        "site-packages/jinja2/lexer.py:3 in tokeniter",
        "custom_components/spook/template_extraction.py:3 in _lexed",
    ]
    tokens.close()


def test_a_frame_says_its_file_line_and_function() -> None:
    """Innermost first: "file:line in function"."""
    where = loopwatch._where(loopwatch._stack(sys._getframe()))
    assert re.fullmatch(
        r".*test_loopwatch\.py:\d+ in test_a_frame_says_its_file_line_and_function",
        where[0],
    )

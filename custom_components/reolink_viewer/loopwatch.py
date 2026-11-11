"""How long Home Assistant's event loop is held, and by what (the playback check).

The owner's runs of v0.62.0 and v0.62.1 through Nabu Casa found starts that
waited 1.4-2.2 s between the server having the video and the browser getting
it, each while Home Assistant downloaded or rewrote an hour of video. A loop
held by other work answers every request late; a slow answer of its own is
the server's step. To tell the two apart, a timer every ``PERIOD_S`` notes
how late it ran (v0.62.2).

The owner's run of v0.63.2 then found the loop held 0.8 and 1.3 s, without
saying by what: Reolink Viewer's own work, or another integration's. So a
watchdog thread (v0.63.3) looks every ``POLL_S`` at when the timer last ran;
when it is ``CAPTURE_AFTER_S`` late, it notes where the loop's thread is at
that moment (the innermost frames of its stack: file, line and function).

v0.63.4 looks twice as often and from half the delay: the owner's run of
v0.63.3 found a hold of 0.2 s, short of the 0.3 s it then waited for.

Both run only while someone looks: each read of the playback statistics (the
check, the debug panel) keeps them running ``WATCH_S`` longer.
"""

from __future__ import annotations

import asyncio
from collections import deque
import sys
import threading
import time
import traceback
from types import FrameType
from typing import Any

from homeassistant.core import HomeAssistant, callback

PERIOD_S = 0.25
WATCH_S = 300.0
KEEP_S = 60.0
# The watchdog looks this often, and notes the loop's stack once the timer is
# this late past its period (s).
POLL_S = 0.05
CAPTURE_AFTER_S = 0.15
# Frames noted per hold (the innermost), and holds kept.
FRAMES = 4
HOLDS = 20
# A file's path is shown from the first of these on (the rest is the install's).
_ROOTS = ("custom_components/", "homeassistant/", "site-packages/", "lib/python")


class LoopWatch:
    """A timer that measures how late the event loop runs it, and a watchdog."""

    def __init__(self, hass: HomeAssistant) -> None:
        """Watch the loop Home Assistant runs on."""
        self._hass = hass
        # (when, how late), both in the loop's clock (s).
        self._samples: deque[tuple[float, float]] = deque()
        self._until = 0.0
        self._handle: asyncio.TimerHandle | None = None
        self._began: float | None = None
        # The watchdog: when the timer last ran (monotonic s), the loop's
        # thread, and the holds it saw (monotonic s, seen held ms, frames).
        self._beat = time.monotonic()
        self._loop_thread: int | None = None
        self._thread: threading.Thread | None = None
        self._stopping = threading.Event()
        self._holds: deque[tuple[float, float, list[str]]] = deque(maxlen=HOLDS)
        self._lock = threading.Lock()

    @callback
    def watch(self) -> None:
        """Run (or keep running) for ``WATCH_S`` from now."""
        loop = self._hass.loop
        self._until = loop.time() + WATCH_S
        if self._handle is None:
            self._began = time.time()
            self._beat = time.monotonic()
            due = loop.time() + PERIOD_S
            self._handle = loop.call_at(due, self._tick, due)
        self._stopping.clear()
        if self._thread is None or not self._thread.is_alive():
            self._loop_thread = threading.get_ident()
            self._thread = threading.Thread(
                target=self._watchdog, name="reolink_viewer loop watch", daemon=True
            )
            self._thread.start()

    @callback
    def stop(self) -> None:
        """Stop the timer and the watchdog (the entry unloads).

        The watchdog wakes at once on the stop and ends: waiting for it takes
        no time to speak of, and leaves no thread behind.
        """
        handle = self._handle
        self._handle = None
        if handle is not None:
            handle.cancel()
        self._stopping.set()
        thread, self._thread = self._thread, None
        if thread is not None and thread.is_alive():
            thread.join(timeout=1.0)

    @callback
    def _tick(self, due: float) -> None:
        loop = self._hass.loop
        now = loop.time()
        self._beat = time.monotonic()
        self._samples.append((now, max(now - due, 0.0)))
        while self._samples and self._samples[0][0] < now - KEEP_S:
            self._samples.popleft()
        if now >= self._until:
            self._handle = None
            self._stopping.set()
            return
        nxt = now + PERIOD_S
        self._handle = loop.call_at(nxt, self._tick, nxt)

    def _watchdog(self) -> None:
        """Note where the loop's thread is when the timer runs late (in its own thread)."""
        seen = None
        while not self._stopping.wait(POLL_S):
            beat = self._beat
            late = time.monotonic() - beat - PERIOD_S
            if late < CAPTURE_AFTER_S or beat == seen:
                continue
            seen = beat
            frame = sys._current_frames().get(self._loop_thread or 0)  # noqa: SLF001
            if frame is None:
                continue
            with self._lock:
                self._holds.append(
                    (time.monotonic(), round(late * 1000, 1), _where(frame))
                )

    def held_ms(self, seconds: float) -> float | None:
        """Return the longest delay (ms) in the last ``seconds``; None if not watched then."""
        now = self._hass.loop.time()
        late = [lag for when, lag in self._samples if when >= now - seconds]
        return round(max(late) * 1000, 1) if late else None

    def held_by(self, seconds: float) -> list[dict[str, Any]]:
        """Return the holds the watchdog saw in the last ``seconds``, newest first."""
        now = time.monotonic()
        with self._lock:
            holds = list(self._holds)
        return [
            {"ago_s": round(now - when, 1), "seen_ms": seen, "where": where}
            for when, seen, where in reversed(holds)
            if when >= now - seconds
        ]

    def snapshot(self) -> dict[str, Any]:
        """Return the longest delays of the last 10 s and minute, what held it, the period."""
        return {
            "held_10s_ms": self.held_ms(10.0),
            "held_60s_ms": self.held_ms(KEEP_S),
            "held_by": self.held_by(KEEP_S),
            "period_ms": PERIOD_S * 1000,
            "watching_s": None
            if self._began is None
            else round(time.time() - self._began, 1),
        }


def _where(frame: FrameType) -> list[str]:
    """Return the innermost frames of a stack, innermost first: "file:line in function"."""
    out: list[str] = []
    for summary in reversed(traceback.extract_stack(frame, limit=FRAMES)):
        path = summary.filename.replace("\\", "/")
        for root in _ROOTS:
            at = path.find(root)
            if at >= 0:
                path = path[at:]
                break
        out.append(f"{path}:{summary.lineno} in {summary.name}")
    return out

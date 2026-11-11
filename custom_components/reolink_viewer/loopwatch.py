"""How long Home Assistant's event loop is held (the playback check, v0.62.2).

The owner's runs of v0.62.0 and v0.62.1 through Nabu Casa found starts that
waited 1.4-2.2 s between the server having the video and the browser getting
it, each while Home Assistant downloaded or rewrote an hour of video. A loop
held by other work answers every request late; a slow answer of its own is
the server's step. To tell the two apart, a timer every ``PERIOD_S`` notes
how late it ran. It runs only while someone looks: each read of the playback
statistics (the check, the debug panel) keeps it running ``WATCH_S`` longer.
"""

from __future__ import annotations

import asyncio
from collections import deque
import time

from homeassistant.core import HomeAssistant, callback

PERIOD_S = 0.25
WATCH_S = 300.0
KEEP_S = 60.0


class LoopWatch:
    """A timer that measures how late the event loop runs it."""

    def __init__(self, hass: HomeAssistant) -> None:
        """Watch the loop Home Assistant runs on."""
        self._hass = hass
        # (when, how late), both in the loop's clock (s).
        self._samples: deque[tuple[float, float]] = deque()
        self._until = 0.0
        self._handle: asyncio.TimerHandle | None = None
        self._began: float | None = None

    @callback
    def watch(self) -> None:
        """Run (or keep running) for ``WATCH_S`` from now."""
        loop = self._hass.loop
        self._until = loop.time() + WATCH_S
        if self._handle is None:
            self._began = time.time()
            due = loop.time() + PERIOD_S
            self._handle = loop.call_at(due, self._tick, due)

    @callback
    def stop(self) -> None:
        """Stop the timer (the entry unloads)."""
        handle = self._handle
        self._handle = None
        if handle is not None:
            handle.cancel()

    @callback
    def _tick(self, due: float) -> None:
        loop = self._hass.loop
        now = loop.time()
        self._samples.append((now, max(now - due, 0.0)))
        while self._samples and self._samples[0][0] < now - KEEP_S:
            self._samples.popleft()
        if now >= self._until:
            self._handle = None
            return
        nxt = now + PERIOD_S
        self._handle = loop.call_at(nxt, self._tick, nxt)

    def held_ms(self, seconds: float) -> float | None:
        """Return the longest delay (ms) in the last ``seconds``; None if not watched then."""
        now = self._hass.loop.time()
        late = [lag for when, lag in self._samples if when >= now - seconds]
        return round(max(late) * 1000, 1) if late else None

    def snapshot(self) -> dict[str, float | None]:
        """Return the longest delays of the last 10 s and minute, and the timer's period."""
        return {
            "held_10s_ms": self.held_ms(10.0),
            "held_60s_ms": self.held_ms(KEEP_S),
            "period_ms": PERIOD_S * 1000,
            "watching_s": None
            if self._began is None
            else round(time.time() - self._began, 1),
        }

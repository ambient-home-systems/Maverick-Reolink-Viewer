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

The owner's run of v0.63.4 named the Spook integration, its template scan
holding the loop 1.3 s, as two lines of stack. So (v0.63.5) a hold also says
whose code held it (``by``: the innermost integration on the loop's stack,
however deep), and how long it went on (the watchdog follows it until the
timer runs); the statistics count the last 10 s's holds and add them up.

The owner's next run showed Spook's frames but no "by": the work was a Jinja
generator, and between reading where it was (which reads source files) and
looking for its caller, it yielded, and a paused generator's frame no longer
links to its caller. So (v0.63.7) the stack is read once, at the hold, as
plain (file, line, function) entries, with nothing read from disk.

The owner's runs of v0.63.8 then found holds with the loop's thread idle in
``selectors.select``: the timer was due and the loop was waiting for no work,
yet ran late. That is another thread holding the interpreter (the GIL), or
the computer giving Home Assistant no time. So (v0.63.9) such a hold looks
at the process's other threads: the first one running code, and whose (its
name and integration), is noted; with none, it is the computer's
(``by`` "system").

Both run only while someone looks: each read of the playback statistics (the
check, the debug panel) keeps them running ``WATCH_S`` longer.
"""

from __future__ import annotations

import asyncio
from collections import deque
import sys
import threading
import time
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
# Frames looked through, from the innermost out, for the integration holding it.
OWNER_DEPTH = 80
# A timer this late (s) counts as a hold in the last 10 s's count and sum.
HELD_MIN_S = 0.1
# A file's path is shown from the first of these on (the rest is the install's).
_ROOTS = ("custom_components/", "homeassistant/", "site-packages/", "lib/python")
# An integration's code: its path from here (the integration's folder next).
_OWNERS = ("custom_components/", "homeassistant/components/")


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
        # thread, and the holds it saw.
        self._beat = time.monotonic()
        self._loop_thread: int | None = None
        self._thread: threading.Thread | None = None
        self._stopping = threading.Event()
        self._holds: deque[_Hold] = deque(maxlen=HOLDS)
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
        """Note where the loop's thread is when the timer runs late (in its own thread).

        A hold is noted once, where it is first seen; while the timer stays
        late, the hold's length and when it was last seen follow it.
        """
        seen = None
        current: _Hold | None = None
        while not self._stopping.wait(POLL_S):
            beat = self._beat
            now = time.monotonic()
            late = now - beat - PERIOD_S
            if late < CAPTURE_AFTER_S:
                continue
            if beat == seen:
                if current is not None:
                    with self._lock:
                        current.last = now
                        current.held_ms = round(late * 1000, 1)
                continue
            seen = beat
            current = None
            current = self._capture(now, late)
            if current is None:
                continue
            with self._lock:
                self._holds.append(current)

    def _capture(self, now: float, late: float) -> _Hold | None:
        """Note a hold: where the loop's thread is, or the thread that runs instead."""
        frames = sys._current_frames()  # noqa: SLF001
        frame = frames.get(self._loop_thread or 0)
        if frame is None:
            return None
        stack = _stack(frame)
        others = [
            (_thread_name(ident), _stack(other))
            for ident, other in frames.items()
            if ident not in (self._loop_thread, threading.get_ident())
        ]
        where, by, thread = _blame(stack, others)
        return _Hold(now, round(late * 1000, 1), where, by, thread)

    def held_ms(self, seconds: float) -> float | None:
        """Return the longest delay (ms) in the last ``seconds``; None if not watched then."""
        now = self._hass.loop.time()
        late = [lag for when, lag in self._samples if when >= now - seconds]
        return round(max(late) * 1000, 1) if late else None

    def held_total(self, seconds: float) -> tuple[int, float]:
        """Return the holds (a timer ``HELD_MIN_S`` late) in the last ``seconds``, and their sum (ms)."""
        now = self._hass.loop.time()
        late = [
            lag
            for when, lag in self._samples
            if when >= now - seconds and lag >= HELD_MIN_S
        ]
        return len(late), round(sum(late) * 1000, 1)

    def held_by(self, seconds: float) -> list[dict[str, Any]]:
        """Return the holds the watchdog saw in the last ``seconds``, newest first.

        ``ago_s``: since it was last seen held (its end, within ``POLL_S``);
        ``seen_ms``: how long the timer was late by then; ``by``: whose code
        held it (``custom_components/<domain>``, ``homeassistant/components/
        <domain>``, ``homeassistant`` for its own code, ``system`` when no
        thread of the process was running, or None); ``thread``: the other
        thread that ran while the loop's waited, if one did.
        """
        now = time.monotonic()
        with self._lock:
            holds = [
                (h.last, h.held_ms, list(h.where), h.by, h.thread) for h in self._holds
            ]
        return [
            {
                "ago_s": round(now - last, 1),
                "seen_ms": held,
                "where": where,
                "by": by,
                "thread": thread,
            }
            for last, held, where, by, thread in reversed(holds)
            if last >= now - seconds
        ]

    def snapshot(self) -> dict[str, Any]:
        """Return the longest delays of the last 10 s and minute, what held it, the period."""
        count, total = self.held_total(10.0)
        return {
            "held_10s_ms": self.held_ms(10.0),
            "held_10s_count": count,
            "held_10s_total_ms": total,
            "held_60s_ms": self.held_ms(KEEP_S),
            "held_by": self.held_by(KEEP_S),
            "period_ms": PERIOD_S * 1000,
            "watching_s": None
            if self._began is None
            else round(time.time() - self._began, 1),
        }


class _Hold:
    """A hold the watchdog saw: when last seen, how long, where, whose code.

    ``thread``: the other thread that ran meanwhile, when the loop's own was
    waiting (see ``_blame``).
    """

    __slots__ = ("by", "held_ms", "last", "thread", "where")

    def __init__(
        self,
        last: float,
        held_ms: float,
        where: list[str],
        by: str | None,
        thread: str | None = None,
    ) -> None:
        self.last = last
        self.held_ms = held_ms
        self.where = where
        self.by = by
        self.thread = thread


# A stack as read at a hold: (file, line, function), innermost first.
Stack = list[tuple[str, int, str]]


def _stack(frame: FrameType | None) -> Stack:
    """Read a stack from a frame out, at once (``OWNER_DEPTH`` frames at most).

    Nothing is read from disk meanwhile: the loop's thread runs on while
    this one waits, and a generator that yields forgets its caller (v0.63.7).
    """
    out: Stack = []
    while frame is not None and len(out) < OWNER_DEPTH:
        code = frame.f_code
        out.append(
            (code.co_filename.replace("\\", "/"), frame.f_lineno or 0, code.co_name)
        )
        frame = frame.f_back
    return out


def _owner(stack: Stack) -> str | None:
    """Return whose code a stack is in: the innermost integration on it.

    Looked for from the innermost frame out, past libraries (Jinja under
    Spook's template scan) and Home Assistant's helpers an integration
    called: ``custom_components/<domain>`` or ``homeassistant/components/
    <domain>``; else ``homeassistant`` where its own code is on the stack;
    else None.
    """
    core = False
    for path, _line, _name in stack:
        for marker in _OWNERS:
            at = path.find(marker)
            if at >= 0 and (at == 0 or path[at - 1] == "/"):
                domain = path[at + len(marker) :].split("/", 1)[0]
                if domain and not domain.endswith(".py"):
                    return marker + domain
        if "/homeassistant/" in path:
            core = True
    return "homeassistant" if core else None


# Where a thread waits (for I/O, a lock, a queue, a timer): it holds nothing.
# (A file's functions that wait; None: all of them.)
_WAITS: dict[str, frozenset[str] | None] = {
    "selectors.py": None,
    "threading.py": frozenset({"wait", "_wait_for_tstate_lock", "join", "acquire"}),
    "queue.py": frozenset({"get", "put"}),
    "socket.py": frozenset({"accept", "recv", "recv_into", "readinto", "recvfrom"}),
    "ssl.py": frozenset({"read", "recv", "recv_into", "do_handshake"}),
    "subprocess.py": frozenset({"wait", "_wait", "_try_wait", "communicate"}),
    "connection.py": frozenset({"recv", "recv_bytes", "_recv", "_recv_bytes", "poll"}),
    "base_events.py": frozenset({"_run_once", "run_forever"}),
}


def _waiting(stack: Stack) -> bool:
    """Return whether a thread's innermost frame is a wait (it runs no code)."""
    if not stack:
        return True
    path, _line, name = stack[0]
    base = path.rsplit("/", 1)[-1]
    if base not in _WAITS:
        return False
    names = _WAITS[base]
    return names is None or name in names


def _blame(
    loop: Stack, others: list[tuple[str | None, Stack]]
) -> tuple[list[str], str | None, str | None]:
    """Return where a hold was, whose code, and in which other thread.

    The loop's own thread, running code: that code. Waiting (the timer was
    due and it ran late anyway): the first other thread running code, one
    in an integration first, else any; with none, the computer's
    (``system``: no thread of the process ran).
    """
    if not _waiting(loop):
        return _where(loop), _owner(loop), None
    running = [(name, stack) for name, stack in others if not _waiting(stack)]
    owned = [
        (name, stack)
        for name, stack in running
        if _owner(stack) not in (None, "homeassistant")
    ]
    candidates = owned or running
    if not candidates:
        return _where(loop), "system", None
    name, stack = candidates[0]
    return _where(stack), _owner(stack), name or "another thread"


def _thread_name(ident: int) -> str | None:
    """Return a thread's name (its ident as ``sys._current_frames`` gives it)."""
    for thread in threading.enumerate():
        if thread.ident == ident:
            return thread.name
    return None


def _where(stack: Stack) -> list[str]:
    """Return a stack's innermost ``FRAMES``, innermost first: "file:line in function"."""
    out: list[str] = []
    for path, line, name in stack[:FRAMES]:
        shown = path
        for root in _ROOTS:
            at = path.find(root)
            if at >= 0:
                shown = path[at:]
                break
        out.append(f"{shown}:{line} in {name}")
    return out

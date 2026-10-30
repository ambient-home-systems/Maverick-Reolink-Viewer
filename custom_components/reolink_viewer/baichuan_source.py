"""Deep starts over the Reolink protocol (Phase 5b step 2, an opt-in prototype).

A start deep in a recording that is not cached yet waits, on the Phase 2 path,
for the download to reach it (6.9 to 13.0 s 45 minutes into an hour). Here the
device is asked for that moment instead: a download cut by time range
(command 143, chosen in step 1, docs/baichuan-playback.md §6.3) from a few
seconds before it to the recording's end. Its first key frame comes in about
200 ms and the rest at many times real time; :class:`BaichuanMuxer` makes
fragments of it, written to a file of their own beside the recording's and
indexed like it (``fmp4.FragmentIndex``), so the MSE view serves both alike.

- One connection per host, logged in when the first cut needs it and logged
  out ``IDLE_LOGOUT_S`` after the last one ends: at most one extra logged-in
  user per host, whatever the number of viewers.
- One cut per channel at a time (the device tells streams apart by channel);
  a new start on a channel stops the cut running on it (144 closes it).
- Each cut holds a slot of the host's stream budget, at playback priority, and
  gives up if none is free within ``SLOT_TIMEOUT_S``; the login runs as a
  scheduler job.
- The media times are the recording's (0 at its start); the cut's start and
  end are sent in the device's local time (``timeconv``'s zone, from the
  bridge), as the device keeps them.

The cache (``vodcache.py``) decides when to cut, reserves the disk space and
falls back to the download on any failure here. Only ``bridge.py`` is asked
for the host's address, credentials and time zone.
"""

import asyncio
from collections.abc import Awaitable, Callable
import contextlib
from dataclasses import dataclass, field
from datetime import UTC, datetime, tzinfo
import logging
import os
from pathlib import Path
import time
from typing import Any

from homeassistant.core import HomeAssistant

from . import bridge
from .baichuan_client import BaichuanClientError, BaichuanReplayClient, StreamStats
from .baichuan_media import Block
from .baichuan_mux import BaichuanMuxer, MuxError
from .bridge import BaichuanEndpoint
from .fmp4 import FragmentIndex
from .scheduler import Priority, Scheduler

_LOGGER = logging.getLogger(__name__)

# The cut starts this long before the asked moment (its first key frame comes
# 3 s before to 1 s after the asked second, step 1).
LEAD_S = 4.0
IDLE_LOGOUT_S = 30.0
SLOT_TIMEOUT_S = 5.0
LOGIN_TIMEOUT_S = 10.0
CLIENT_TIMEOUT_S = 10.0
# Nothing from the device for this long: the cut has failed.
QUIET_TIMEOUT_S = 15.0
END_TIMEOUT_S = 3.0
STREAM_TYPES = {"sub": "subStream", "main": "mainStream"}
ANY_CHANNEL_BITMAP = 255

type ClientFactory = Callable[..., BaichuanReplayClient]
type Reserve = Callable[[Path, int], Awaitable[None]]


class CutError(Exception):
    """A cut could not be made (the caller falls back to the download)."""


@dataclass(eq=False, slots=True)
class Cut:
    """One download cut of a recording, muxed into ``path`` as it arrives."""

    entry_id: str
    channel: int
    stream: str
    path: Path
    # Media time (ms from the recording's start) the cut was asked for.
    asked_ms: float
    began: float = field(default_factory=time.monotonic)
    index: FragmentIndex = field(default_factory=FragmentIndex)
    written: int = 0
    complete: bool = False
    error: str | None = None
    changed: asyncio.Condition = field(default_factory=asyncio.Condition)
    task: asyncio.Task[None] | None = None
    timing: dict[str, Any] = field(default_factory=dict)
    muxer: BaichuanMuxer | None = None
    readers: int = 0
    last_read: float = field(default_factory=time.monotonic)
    # Which of its recording's cuts this is (the cache numbers its windows by it).
    generation: int = 0

    @property
    def running(self) -> bool:
        """Return True while the cut still receives."""
        return self.task is not None and not self.task.done()

    @property
    def start_ms(self) -> float | None:
        """Return the media time its first fragment starts at, once there is one."""
        return self.index.fragments[0].start_ms if self.index.fragments else None

    @property
    def end_ms(self) -> float | None:
        """Return the media time its fragments reach so far."""
        return self.index.duration_ms if self.index.fragments else None

    def public(self) -> dict[str, Any]:
        """Return what the debug panel and the playback check show."""
        out: dict[str, Any] = {
            "source": "baichuan cut",
            "asked_ms": round(self.asked_ms),
            "start_ms": self.start_ms,
            "end_ms": self.end_ms,
            "bytes": self.written,
            "fragments": len(self.index.fragments),
            "complete": self.complete,
            "running": self.running,
            "error": self.error,
            **self.timing,
        }
        if self.muxer is not None:
            out["mux"] = self.muxer.stats.as_dict()
        return out


@dataclass(slots=True)
class _Feed:
    """What the muxer gave and the device said, between two writes."""

    muxer: BaichuanMuxer
    pieces: list[bytes] = field(default_factory=list)
    failures: list[str] = field(default_factory=list)
    arrived: asyncio.Event = field(default_factory=asyncio.Event)
    end_status: int | None = None

    def block(self, block: Block) -> None:
        try:
            self.pieces.extend(self.muxer.feed(block))
        except MuxError as err:
            self.failures.append(str(err))
        if self.pieces or self.failures:
            self.arrived.set()

    def chunk(self, stats: StreamStats) -> None:
        self.end_status = stats.end_status
        self.arrived.set()


@dataclass(slots=True)
class _Host:
    """The connection to one host, shared by its cuts."""

    client: BaichuanReplayClient | None = None
    users: int = 0
    logins: int = 0
    logouts: int = 0
    idle: asyncio.TimerHandle | None = None
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)


class BaichuanSource:
    """Cuts of recordings over each host's one Baichuan connection."""

    def __init__(
        self,
        hass: HomeAssistant,
        scheduler: Scheduler,
        *,
        enabled: Callable[[], bool] = lambda: False,
        client_factory: ClientFactory = BaichuanReplayClient,
        idle_logout: float = IDLE_LOGOUT_S,
    ) -> None:
        """Initialize; ``enabled`` reads the option at each start."""
        self._hass = hass
        self._scheduler = scheduler
        self._enabled = enabled
        self._client_factory = client_factory
        self._idle_logout = idle_logout
        self._hosts: dict[str, _Host] = {}
        self._cuts: dict[tuple[str, int], Cut] = {}
        self._closed = False

    @property
    def enabled(self) -> bool:
        """Return True when the option is on."""
        return not self._closed and self._enabled()

    # ---- Cuts ----

    async def async_start(
        self,
        *,
        entry_id: str,
        channel: int,
        stream: str,
        start_ms: int,
        end_ms: int,
        at_ms: float,
        path: Path,
        reserve: Reserve,
        size: int,
    ) -> Cut:
        """Start a cut of a recording (UTC ``start_ms``-``end_ms``) at ``at_ms``.

        It runs in the background; wait on ``cut.changed`` for its fragments.
        A cut running on the channel is stopped first. ``reserve(path, bytes)``
        makes room for the file (``size`` expected) before bytes are written.
        """
        if self._closed:
            raise CutError("closed")
        previous = self._cuts.get((entry_id, channel))
        if previous is not None:
            await self.async_stop(previous)
        cut = Cut(entry_id, channel, stream, path, at_ms)
        self._cuts[(entry_id, channel)] = cut
        cut.task = self._hass.async_create_background_task(
            self._run(cut, start_ms, end_ms, reserve, size),
            f"reolink_viewer baichuan cut ch{channel}",
        )
        return cut

    async def async_stop(self, cut: Cut) -> None:
        """Stop a cut (the viewer left, or another start replaced it)."""
        if self._cuts.get((cut.entry_id, cut.channel)) is cut:
            del self._cuts[(cut.entry_id, cut.channel)]
        task = cut.task
        if task is not None and not task.done():
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task

    async def _run(
        self, cut: Cut, start_ms: int, end_ms: int, reserve: Reserve, size: int
    ) -> None:
        streams = self._scheduler.host(cut.entry_id).streams
        ticket = streams.request(Priority.PLAYBACK)
        try:
            try:
                async with asyncio.timeout(SLOT_TIMEOUT_S):
                    await ticket.wait()
            except TimeoutError:
                stats = streams.stats()
                raise CutError(
                    f"no stream slot within {SLOT_TIMEOUT_S:.0f} s"
                    f" ({stats['streams']} of {stats['stream_limit']} in use)"
                ) from None
            cut.timing["slot_ms"] = _ms(cut.began)
            await reserve(cut.path, size)
            client = await self._acquire(cut)
            try:
                await self._receive(
                    cut, client, span=(start_ms, end_ms), reserve=reserve, size=size
                )
            finally:
                self._release(cut.entry_id)
        except asyncio.CancelledError:
            cut.error = cut.error or "stopped"
            raise
        except Exception as err:  # noqa: BLE001 - the cache falls back
            cut.error = _describe(err)
            _LOGGER.debug("Baichuan cut on ch%d failed: %s", cut.channel, cut.error)
        finally:
            ticket.release()
            if self._cuts.get((cut.entry_id, cut.channel)) is cut:
                del self._cuts[(cut.entry_id, cut.channel)]
            cut.timing["total_ms"] = _ms(cut.began)
            async with cut.changed:
                cut.changed.notify_all()

    async def _receive(
        self,
        cut: Cut,
        client: BaichuanReplayClient,
        *,
        span: tuple[int, int],
        reserve: Reserve,
        size: int,
    ) -> None:
        start_ms, end_ms = span
        host = bridge.async_get_host(self._hass, cut.entry_id)
        tz = host.timezone()
        origin = start_ms / 1000
        asked = origin + cut.asked_ms / 1000
        muxer = BaichuanMuxer(origin, asked)
        cut.muxer = muxer
        feed = _Feed(muxer)
        options: dict[str, Any] = {
            # With 1 the RLN36 sent the sub stream for a mainStream cut (run 1).
            "support_sub": 1 if cut.stream == "sub" else 0,
            "on_block": feed.block,
            "on_chunk": feed.chunk,
            "analyse": False,
        }
        start = _local(max(asked - LEAD_S, origin), tz)
        end = _local(end_ms / 1000, tz)
        stream_type = STREAM_TYPES.get(cut.stream, STREAM_TYPES["main"])
        try:
            try:
                reply_ms, stats, _fields = await client.download(
                    cut.channel, stream_type, start, end, **options
                )
            except BaichuanClientError as err:
                if "refused" not in str(err):
                    raise
                reply_ms, stats, _fields = await client.download(
                    cut.channel,
                    stream_type,
                    start,
                    end,
                    bitmap=ANY_CHANNEL_BITMAP,
                    **options,
                )
            cut.timing["reply_ms"] = reply_ms
            fd = await self._hass.async_add_executor_job(_open_write, cut.path)
            try:
                if stats.end_status is not None:
                    feed.end_status = stats.end_status
                await self._pump(
                    cut, client, feed=feed, fd=fd, reserve=reserve, size=size
                )
            finally:
                await self._hass.async_add_executor_job(os.close, fd)
        finally:
            if client.connected:
                with contextlib.suppress(BaichuanClientError, TimeoutError, OSError):
                    async with asyncio.timeout(END_TIMEOUT_S):
                        await asyncio.shield(client.download_end(cut.channel))

    async def _pump(
        self,
        cut: Cut,
        client: BaichuanReplayClient,
        *,
        feed: _Feed,
        fd: int,
        reserve: Reserve,
        size: int,
    ) -> None:
        """Write what the muxer gives as it comes, until the device's end marker."""
        pieces = feed.pieces
        lost = asyncio.ensure_future(client.lost.wait())
        reserved = size
        try:
            while True:
                waiter = asyncio.ensure_future(feed.arrived.wait())
                try:
                    done, _pending = await asyncio.wait(
                        {waiter, lost},
                        timeout=QUIET_TIMEOUT_S,
                        return_when=asyncio.FIRST_COMPLETED,
                    )
                finally:
                    waiter.cancel()
                if not done:
                    raise CutError(
                        f"nothing from the device for {QUIET_TIMEOUT_S:.0f} s"
                    )
                feed.arrived.clear()
                if feed.failures:
                    raise CutError(feed.failures[0])
                ended = feed.end_status is not None
                if ended:
                    pieces.extend(feed.muxer.finish())
                    cut.timing["end_status"] = feed.end_status
                if pieces:
                    data = b"".join(pieces)
                    pieces.clear()
                    if cut.written + len(data) > reserved:
                        reserved = max(reserved * 5 // 4, cut.written + len(data))
                        await reserve(cut.path, reserved)
                    await self._hass.async_add_executor_job(_write_all, fd, data)
                    cut.written += len(data)
                    await self._hass.async_add_executor_job(
                        _scan, cut.path, cut.index, cut.written
                    )
                    if cut.index.error is not None:
                        raise CutError(f"not playable as fragments: {cut.index.error}")
                    if cut.index.fragments and "first_fragment_ms" not in cut.timing:
                        cut.timing["first_fragment_ms"] = _ms(cut.began)
                    async with cut.changed:
                        cut.changed.notify_all()
                if ended:
                    cut.complete = True
                    cut.timing["mbit_s"] = _rate(cut.written, cut.began)
                    return
                if lost.done():
                    raise CutError("connection lost")
        finally:
            lost.cancel()

    # ---- The connection ----

    async def _acquire(self, cut: Cut) -> BaichuanReplayClient:
        """Return the host's logged-in connection, logging in if none is."""
        host = self._hosts.setdefault(cut.entry_id, _Host())
        async with host.lock:
            if host.idle is not None:
                host.idle.cancel()
                host.idle = None
            client = host.client
            if client is None or not client.connected:
                if client is not None:
                    await client.close()
                    host.client = None
                began = time.monotonic()
                client = await self._login(cut.entry_id)
                host.client = client
                host.logins += 1
                cut.timing["login"] = "new"
                cut.timing["login_ms"] = _ms(began)
            else:
                cut.timing["login"] = "shared"
            host.users += 1
            return client

    async def _login(self, entry_id: str) -> BaichuanReplayClient:
        endpoint: BaichuanEndpoint = bridge.async_get_host(
            self._hass, entry_id
        ).baichuan_endpoint()
        client = self._client_factory(endpoint, timeout=CLIENT_TIMEOUT_S)

        async def login() -> None:
            await client.connect()
            await client.login()

        try:
            await self._scheduler.host(entry_id).run(
                login, priority=Priority.PLAYBACK, timeout=LOGIN_TIMEOUT_S
            )
        except BaseException:
            await client.close()
            raise
        return client

    def _release(self, entry_id: str) -> None:
        host = self._hosts[entry_id]
        host.users -= 1
        if host.users == 0 and host.client is not None and not self._closed:
            host.idle = self._hass.loop.call_later(
                self._idle_logout,
                lambda: self._hass.async_create_background_task(
                    self._logout(entry_id), "reolink_viewer baichuan logout"
                ),
            )

    async def _logout(self, entry_id: str) -> None:
        host = self._hosts.get(entry_id)
        if host is None:
            return
        async with host.lock:
            host.idle = None
            client = host.client
            if host.users or client is None:
                return
            host.client = None
            host.logouts += 1
            try:
                await self._scheduler.host(entry_id).run(
                    client.logout, priority=Priority.SETTINGS, timeout=END_TIMEOUT_S
                )
            except Exception as err:  # noqa: BLE001 - closed either way
                _LOGGER.debug("Baichuan logout failed: %s", _describe(err))
                await client.close()

    # ---- Shutdown and stats ----

    async def async_shutdown(self) -> None:
        """Stop every cut and log out."""
        self._closed = True
        for cut in list(self._cuts.values()):
            await self.async_stop(cut)
        for entry_id, host in self._hosts.items():
            if host.idle is not None:
                host.idle.cancel()
            if host.client is not None:
                client, host.client = host.client, None
                host.logouts += 1
                try:
                    async with asyncio.timeout(END_TIMEOUT_S):
                        await client.logout()
                except Exception as err:  # noqa: BLE001
                    _LOGGER.debug("Baichuan logout of %s failed: %s", entry_id[:6], err)
                    await client.close()

    def stats(self) -> dict[str, Any]:
        """Return the connections and cuts for the debug panel (no identifiers)."""
        return {
            "enabled": self.enabled,
            "logged_in": sum(1 for h in self._hosts.values() if h.client is not None),
            "logins": sum(h.logins for h in self._hosts.values()),
            "logouts": sum(h.logouts for h in self._hosts.values()),
            "cuts_running": sum(1 for c in self._cuts.values() if c.running),
        }


def _local(unix: float, tz: tzinfo | None) -> datetime:
    """Return the device's wall-clock time (naive) of a UTC POSIX time."""
    utc = datetime.fromtimestamp(int(unix), UTC)
    if tz is None:
        return utc.replace(tzinfo=None)
    return utc.astimezone(tz).replace(tzinfo=None)


def _open_write(path: Path) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    return os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)


def _write_all(fd: int, data: bytes) -> None:
    view = memoryview(data)
    while view:
        written = os.write(fd, view)
        view = view[written:]


def _scan(path: Path, index: FragmentIndex, available: int) -> None:
    with path.open("rb") as file:
        index.scan(file, available)


def _describe(err: BaseException) -> str:
    if isinstance(err, TimeoutError):
        return "timeout"
    if isinstance(err, (CutError, BaichuanClientError, bridge.BridgeError)):
        return str(err)
    return type(err).__name__


def _ms(start: float) -> float:
    return round((time.monotonic() - start) * 1000, 1)


def _rate(size: int, start: float) -> float | None:
    seconds = time.monotonic() - start
    return round(size * 8 / seconds / 1e6, 1) if seconds > 0 else None

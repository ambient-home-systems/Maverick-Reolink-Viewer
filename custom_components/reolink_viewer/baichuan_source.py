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
- Cuts of one channel take turns (the device tells streams apart by channel,
  so one downloads at a time; Phase 5c): a new cut never stops another. One
  that must wait asks the channel's current cut to give its turn up, which it
  does at the next block once it has its first fragment: it ends its span
  there (144) and joins on later, by the counter, as spans join. A viewer
  plays well ahead of what it watches, so the pause goes unseen. Only a new
  cut asks: one resuming, or a later span, waits its turn.
- An HD cut comes in spans (``span_ms`` of media, a few minutes) rather than
  to the recording's end: the cache asks for the next span as the viewer
  nears the end of one (:meth:`Cut.extend`), and the muxer joins them. The
  login is held across spans; a stream slot only while a span downloads.
- Each cut holds a slot of the host's stream budget, at playback priority, and
  gives up if none is free within ``SLOT_TIMEOUT_S``. With none free at once
  it first asks for its recording's download's (``borrow``, Phase 5c): a
  deep start costs the device one stream. The login runs as a scheduler job.
- The method per host (Phase 5c): a device that refuses the protocol (its
  port closed, the login or the download cut refused, no nonce) before any
  cut of it came through is not asked again for ``UNSUPPORTED_RETRY_S``; its
  starts go straight to the download, and ``stats()`` says why. Timeouts, a lost connection or no free stream
  slot are passing failures and change nothing.
- Each camera's counter rate, once a cut has measured it over
  ``KEEP_RATE_SPAN_S``, is kept (an HA store) and given to the muxer of its
  next cut, so its frames are on the right clock from the first one. The time
  the muxer takes is counted (``mux_ms``: the HA host's load, Phase 5c).
- The media times are the recording's (0 at its start); the cut's start and
  end are sent in the device's local time (``timeconv``'s zone, from the
  bridge), as the device keeps them.

The cache (``vodcache.py``) decides when to cut, reserves the disk space and
falls back to the download on any failure here. Only ``bridge.py`` is asked
for the host's address, credentials and time zone.
"""

import asyncio
from collections.abc import AsyncIterator, Awaitable, Callable
import contextlib
from dataclasses import dataclass, field
from datetime import UTC, datetime, tzinfo
import logging
import os
from pathlib import Path
import time
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

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
# A later span waits longer for its slot: the viewer is still watching.
SPAN_SLOT_TIMEOUT_S = 30.0
LOGIN_TIMEOUT_S = 10.0
CLIENT_TIMEOUT_S = 10.0
# Nothing from the device for this long: the cut has failed.
QUIET_TIMEOUT_S = 15.0
END_TIMEOUT_S = 3.0
STREAM_TYPES = {"sub": "subStream", "main": "mainStream"}
# A device that refused the protocol is asked again after this long.
UNSUPPORTED_RETRY_S = 6 * 3600.0
# A counter rate measured over at least this many seconds is kept (a deep
# start near an hour's end, or an HD span, is cut over 3 minutes).
KEEP_RATE_SPAN_S = 120
RATES_STORE_KEY = "reolink_viewer.baichuan_rates"
ANY_CHANNEL_BITMAP = 255

type ClientFactory = Callable[..., BaichuanReplayClient]
type Reserve = Callable[[Path, int], Awaitable[None]]
type Borrow = Callable[[], Awaitable[None]]


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
    # Media cut at a time (ms); None: to the recording's end in one go.
    span_ms: float | None = None
    # Between spans: waiting for the cache to ask for the next one.
    paused: bool = False
    spans: int = 0
    # Asks the recording's download for its stream slot (none was free).
    borrow: Borrow | None = None
    borrowed: int = 0
    # Time the muxer took (s, on the event loop).
    mux_s: float = 0.0
    # Another cut of the channel waits: end this span at the next block.
    give_way: bool = False
    gave_way: int = 0
    # Wakes the span's pump (to give way at once).
    waker: asyncio.Event | None = None
    _more: asyncio.Event = field(default_factory=asyncio.Event)

    def extend(self) -> None:
        """Ask for the next span (no-op once the recording's end is cut)."""
        if not self.complete:
            self._more.set()

    async def wait_for_more(self) -> None:
        """Wait (between spans) until the next span is asked for."""
        await self._more.wait()
        self._more.clear()

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
            "paused": self.paused,
            "spans": self.spans,
            "borrowed": self.borrowed,
            "gave_way": self.gave_way,
            "mux_ms": round(self.mux_s * 1000, 1),
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
    cut: Cut
    pieces: list[bytes] = field(default_factory=list)
    failures: list[str] = field(default_factory=list)
    arrived: asyncio.Event = field(default_factory=asyncio.Event)
    end_status: int | None = None
    # The span gave its turn up: what still arrives is the next span's.
    detached: bool = False

    def block(self, block: Block) -> None:
        if self.detached:
            return
        began = time.perf_counter()
        try:
            self.pieces.extend(self.muxer.feed(block))
        except MuxError as err:
            self.failures.append(str(err))
        self.cut.mux_s += time.perf_counter() - began
        if self.pieces or self.failures:
            self.arrived.set()

    def chunk(self, stats: StreamStats) -> None:
        self.end_status = stats.end_status
        self.arrived.set()


@dataclass(slots=True)
class _Channel:
    """Whose turn it is to download from a channel."""

    lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    holder: Cut | None = None


@dataclass(slots=True)
class _Host:
    """The connection to one host, shared by its cuts."""

    client: BaichuanReplayClient | None = None
    users: int = 0
    logins: int = 0
    logouts: int = 0
    idle: asyncio.TimerHandle | None = None
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    # Why the device does not take the protocol, and until when (monotonic).
    unsupported: str | None = None
    unsupported_until: float = 0.0
    # A cut has come through: a later refusal is that cut's, not the device's.
    worked: bool = False


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
        self._cuts: set[Cut] = set()
        self._channels: dict[tuple[str, int], _Channel] = {}
        self._closed = False
        # Each camera's counter rate (entry|channel), as earlier cuts measured.
        self._rates_store: Store[dict[str, int]] = Store(hass, 1, RATES_STORE_KEY)
        self._rates: dict[str, int] | None = None

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
        span_ms: float | None = None,
        borrow: Borrow | None = None,
    ) -> Cut:
        """Start a cut of a recording (UTC ``start_ms``-``end_ms``) at ``at_ms``.

        It runs in the background; wait on ``cut.changed`` for its fragments.
        A cut running on the channel is stopped first. ``reserve(path, bytes)``
        makes room for the file (``size`` expected) before bytes are written.
        With ``span_ms`` it cuts that much media, then waits for
        :meth:`Cut.extend` to cut the next span; else to the recording's end.
        ``borrow()`` asks the recording's download for its stream slot when
        none is free.
        """
        if self._closed:
            raise CutError("closed")
        host = self._hosts.get(entry_id)
        if host is not None and host.unsupported is not None:
            if time.monotonic() < host.unsupported_until:
                raise CutError(f"not supported by this device ({host.unsupported})")
            host.unsupported = None
        cut = Cut(
            entry_id, channel, stream, path, at_ms, span_ms=span_ms, borrow=borrow
        )
        self._cuts.add(cut)
        cut.task = self._hass.async_create_background_task(
            self._run(cut, start_ms, end_ms, reserve, size),
            f"reolink_viewer baichuan cut ch{channel}",
        )
        return cut

    async def async_stop(self, cut: Cut) -> None:
        """Stop a cut (the viewer left, or the cache let it go)."""
        self._cuts.discard(cut)
        task = cut.task
        if task is not None and not task.done():
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task

    async def _run(
        self, cut: Cut, start_ms: int, end_ms: int, reserve: Reserve, size: int
    ) -> None:
        tz = bridge.async_get_host(self._hass, cut.entry_id).timezone()
        origin = start_ms / 1000
        end = end_ms / 1000
        asked = origin + cut.asked_ms / 1000
        rates = await self._load_rates()
        rate_key = f"{cut.entry_id}|{cut.channel}"
        muxer = BaichuanMuxer(origin, asked, rate=rates.get(rate_key))
        cut.muxer = muxer
        client: BaichuanReplayClient | None = None
        fd: int | None = None
        try:
            began = asked
            while True:
                span_end = end if cut.span_ms is None else began + cut.span_ms / 1000
                final = span_end >= end
                first = cut.spans == 0
                async with self._slot(
                    cut, SLOT_TIMEOUT_S if first else SPAN_SLOT_TIMEOUT_S
                ):
                    if first:
                        cut.timing["slot_ms"] = _ms(cut.began)
                        await reserve(cut.path, size)
                        fd = await self._hass.async_add_executor_job(
                            _open_write, cut.path
                        )
                    if client is None or not client.connected:
                        if client is not None:
                            self._release(cut.entry_id)
                            client = None
                        client = await self._acquire(cut)
                    assert fd is not None
                    async with self._turn(cut):
                        cut.spans += 1
                        gave_way = await self._receive(
                            cut,
                            client,
                            times=(
                                _local(max(began - LEAD_S, origin), tz),
                                _local(min(span_end, end), tz),
                            ),
                            final=final,
                            fd=fd,
                            reserve=reserve,
                            size=size,
                        )
                    self._hosts[cut.entry_id].worked = True
                if gave_way:
                    # Another cut of the channel goes first; then on from here.
                    cut.gave_way += 1
                    resume = muxer.resume_unix
                    began = resume if resume is not None else began
                    continue
                if final:
                    return
                # Between spans: hold the login, not the slot.
                cut.paused = True
                async with cut.changed:
                    cut.changed.notify_all()
                await cut.wait_for_more()
                cut.paused = False
                resume = muxer.resume_unix
                began = resume if resume is not None else span_end
        except asyncio.CancelledError:
            cut.error = cut.error or "stopped"
            raise
        except Exception as err:  # noqa: BLE001 - the cache falls back
            cut.error = _describe(err)
            _LOGGER.debug("Baichuan cut on ch%d failed: %s", cut.channel, cut.error)
            host = self._hosts.setdefault(cut.entry_id, _Host())
            if _refused(err) and not host.worked:
                host.unsupported = cut.error
                host.unsupported_until = time.monotonic() + UNSUPPORTED_RETRY_S
                _LOGGER.info(
                    "Deep starts over the Reolink protocol are off for a device"
                    " for %d h: %s",
                    UNSUPPORTED_RETRY_S // 3600,
                    cut.error,
                )
        finally:
            cut.paused = False
            self._keep_rate(rate_key, muxer)
            if fd is not None:
                await self._hass.async_add_executor_job(os.close, fd)
            if client is not None:
                self._release(cut.entry_id)
            self._cuts.discard(cut)
            cut.timing["total_ms"] = _ms(cut.began)
            async with cut.changed:
                cut.changed.notify_all()

    async def _load_rates(self) -> dict[str, int]:
        if self._rates is None:
            loaded = await self._rates_store.async_load()
            self._rates = (
                {k: int(v) for k, v in loaded.items() if isinstance(v, int)}
                if isinstance(loaded, dict)
                else {}
            )
        return self._rates

    def _keep_rate(self, key: str, muxer: BaichuanMuxer) -> None:
        """Keep a counter rate the cut measured over long enough."""
        stats = muxer.stats
        rates = self._rates
        if (
            rates is None
            or stats.rate_source != "learned"
            or stats.rate_span_s < KEEP_RATE_SPAN_S
            or rates.get(key) == stats.rate
        ):
            return
        rates[key] = stats.rate
        self._rates_store.async_delay_save(lambda: dict(rates), 10)

    def _ask_way(self, cut: Cut) -> _Channel:
        """Ask the cut downloading from ``cut``'s channel, if another, to give way.

        Only for a cut's first span (a viewer waits for its first picture): a
        later span, or one resuming after giving way, has its viewer well
        ahead and waits its turn, so two cuts do not take turns block by block.
        """
        channel = self._channels.setdefault((cut.entry_id, cut.channel), _Channel())
        holder = channel.holder
        if cut.spans == 0 and holder is not None and holder is not cut:
            holder.give_way = True
            if holder.waker is not None:
                holder.waker.set()
        return channel

    @contextlib.asynccontextmanager
    async def _turn(self, cut: Cut) -> AsyncIterator[None]:
        """Hold the channel's turn to download, asking its holder to give way."""
        channel = self._ask_way(cut)
        async with channel.lock:
            channel.holder = cut
            cut.give_way = False
            try:
                yield
            finally:
                channel.holder = None
                cut.waker = None

    @contextlib.asynccontextmanager
    async def _slot(self, cut: Cut, wait: float) -> AsyncIterator[None]:
        """Hold a slot of the host's stream budget, or fail within ``wait``."""
        streams = self._scheduler.host(cut.entry_id).streams
        ticket = streams.request(Priority.PLAYBACK)
        try:
            if not ticket.granted:
                # Queued first, so a slot given up is this one's: the channel's
                # other cut gives its turn and slot up, and the recording's
                # download its slot.
                self._ask_way(cut)
                if cut.borrow is not None:
                    cut.borrowed += 1
                    await cut.borrow()
            try:
                async with asyncio.timeout(wait):
                    await ticket.wait()
            except TimeoutError:
                stats = streams.stats()
                raise CutError(
                    f"no stream slot within {wait:.0f} s"
                    f" ({stats['streams']} of {stats['stream_limit']} in use)"
                ) from None
            yield
        finally:
            ticket.release()

    async def _receive(
        self,
        cut: Cut,
        client: BaichuanReplayClient,
        *,
        times: tuple[datetime, datetime],
        final: bool,
        fd: int,
        reserve: Reserve,
        size: int,
    ) -> bool:
        """Cut one span (device-local ``times``) into the open file.

        Returns True when it ended early to give the channel to another cut.
        """
        muxer = cut.muxer
        assert muxer is not None
        feed = _Feed(muxer, cut)
        cut.waker = feed.arrived
        options: dict[str, Any] = {
            # With 1 the RLN36 sent the sub stream for a mainStream cut (run 1).
            "support_sub": 1 if cut.stream == "sub" else 0,
            "on_block": feed.block,
            "on_chunk": feed.chunk,
            "analyse": False,
        }
        start, end = times
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
            cut.timing.setdefault("reply_ms", reply_ms)
            if stats.end_status is not None:
                feed.end_status = stats.end_status
            return await self._pump(
                cut, client, feed=feed, final=final, fd=fd, reserve=reserve, size=size
            )
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
        final: bool,
        fd: int,
        reserve: Reserve,
        size: int,
    ) -> bool:
        """Write what the muxer gives as it comes, until the device's end marker.

        At the end of the last span the muxer's open group is written; at the
        end of another it is kept for the next span to join. Returns True when
        it stopped early to give the channel to another cut (once this one has
        a fragment: its viewer is not kept waiting either).
        """
        pieces = feed.pieces
        lost = asyncio.ensure_future(client.lost.wait())
        reserved = max(size, cut.written)
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
                    if final:
                        pieces.extend(feed.muxer.finish())
                    else:
                        feed.muxer.pause()
                    cut.timing["end_status"] = feed.end_status
                if pieces:
                    reserved = await self._write(cut, pieces, fd, reserve, reserved)
                if ended:
                    if final:
                        cut.complete = True
                        cut.timing["mbit_s"] = _rate(cut.written, cut.began)
                    return False
                if cut.give_way and cut.index.fragments:
                    # Nothing more is muxed; what was, is written; the open
                    # group waits for the next span.
                    feed.detached = True
                    if pieces:
                        await self._write(cut, pieces, fd, reserve, reserved)
                    feed.muxer.pause()
                    return True
                if lost.done():
                    raise CutError("connection lost")
        finally:
            lost.cancel()

    async def _write(
        self, cut: Cut, pieces: list[bytes], fd: int, reserve: Reserve, reserved: int
    ) -> int:
        """Write the muxer's pieces to the cut's file; return the room reserved."""
        data = b"".join(pieces)
        pieces.clear()
        if cut.written + len(data) > reserved:
            reserved = max(reserved * 5 // 4, cut.written + len(data))
            await reserve(cut.path, reserved)
        await self._hass.async_add_executor_job(_write_all, fd, data)
        cut.written += len(data)
        await self._hass.async_add_executor_job(_scan, cut.path, cut.index, cut.written)
        if cut.index.error is not None:
            raise CutError(f"not playable as fragments: {cut.index.error}")
        if cut.index.fragments and "first_fragment_ms" not in cut.timing:
            cut.timing["first_fragment_ms"] = _ms(cut.began)
        async with cut.changed:
            cut.changed.notify_all()
        return reserved

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
            # Logged out once the device has been told (the lock keeps new
            # cuts from taking the connection meanwhile).
            try:
                await self._scheduler.host(entry_id).run(
                    client.logout, priority=Priority.SETTINGS, timeout=END_TIMEOUT_S
                )
            except Exception as err:  # noqa: BLE001 - closed either way
                _LOGGER.debug("Baichuan logout failed: %s", _describe(err))
                await client.close()
            finally:
                host.client = None
                host.logouts += 1

    # ---- Shutdown and stats ----

    async def async_shutdown(self) -> None:
        """Stop every cut and log out."""
        self._closed = True
        for cut in list(self._cuts):
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
            "cuts_running": sum(1 for c in self._cuts if c.running),
            "cuts_paused": sum(1 for c in self._cuts if c.paused),
            "unsupported": [
                h.unsupported for h in self._hosts.values() if h.unsupported is not None
            ],
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
    if isinstance(err, ConnectionRefusedError):
        return "connection refused (its port for the protocol is closed)"
    if isinstance(err, (CutError, BaichuanClientError, bridge.BridgeError)):
        return str(err)
    return type(err).__name__


def _refused(err: BaseException) -> bool:
    """Return whether the device refused the protocol (not a passing failure)."""
    if isinstance(err, ConnectionRefusedError):
        return True
    if not isinstance(err, BaichuanClientError):
        return False
    text = str(err)
    return "refused" in text or "no nonce" in text


def _ms(start: float) -> float:
    return round((time.monotonic() - start) * 1000, 1)


def _rate(size: int, start: float) -> float | None:
    seconds = time.monotonic() - start
    return round(size * 8 / seconds / 1e6, 1) if seconds > 0 else None

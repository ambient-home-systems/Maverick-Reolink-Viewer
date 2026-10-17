"""Per-host request scheduler. All device I/O goes through here.

Each Reolink host (camera, NVR or Home Hub) gets a :class:`HostScheduler` with:

- a concurrency limit: at most ``limit`` jobs run against the host at once;
- priorities: live > playback > settings > thumbnails > prefetch, FIFO within a
  priority;
- de-duplication: a job submitted with a ``key`` that matches a queued or running
  job shares that job's result instead of hitting the device again;
- exclusive jobs, which run alone (used by the probe's concurrent-stream test,
  which opens several streams itself);
- per-job timeouts, and cancellation: when every caller waiting on a job is
  cancelled, the job is dropped from the queue or its task is cancelled;
- a separate **stream budget** for long-lived video streams (recording
  downloads), so a stream never holds a request slot: streams wait for a stream
  slot by priority, and prefetch streams have their own, smaller cap.
"""

import asyncio
from collections.abc import AsyncIterator, Awaitable, Callable, Hashable
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from enum import IntEnum
import heapq
import itertools
import logging
from typing import Any

_LOGGER = logging.getLogger(__name__)


class Priority(IntEnum):
    """Job priority; lower value runs first."""

    LIVE = 0
    PLAYBACK = 1
    SETTINGS = 2
    THUMBNAILS = 3
    PREFETCH = 4


class SchedulerClosedError(Exception):
    """The scheduler was shut down."""


_QUEUED = "queued"
_RUNNING = "running"
_DONE = "done"


@dataclass(eq=False, slots=True)
class _Job:
    factory: Callable[[], Awaitable[Any]]
    priority: Priority
    seq: int
    key: Hashable | None
    timeout: float | None
    exclusive: bool
    future: asyncio.Future[Any]
    waiters: int = 1
    state: str = _QUEUED
    task: asyncio.Task[None] | None = field(default=None)


@dataclass(frozen=True, slots=True)
class HostLimits:
    """Concurrency limits of one host."""

    requests: int
    streams: int
    prefetch_streams: int = 1


class StreamTicket:
    """A request for a stream slot; ``wait()`` until granted, then ``release()``."""

    def __init__(self, budget: StreamBudget, priority: Priority, seq: int) -> None:
        """Initialize the ticket (use StreamBudget.request)."""
        self._budget = budget
        self.priority = priority
        self.seq = seq
        self.granted_priority: Priority | None = None
        self.future: asyncio.Future[None] = asyncio.get_running_loop().create_future()
        self.future.add_done_callback(_consume)
        self.released = False

    @property
    def granted(self) -> bool:
        """Return True once the slot is held."""
        return self.granted_priority is not None and not self.released

    def raise_priority(self, priority: Priority) -> None:
        """Move a waiting ticket up the queue."""
        if self.granted_priority is None and priority < self.priority:
            self.priority = priority
            self._budget.dispatch()

    async def wait(self) -> None:
        """Wait until the slot is granted; cancelling gives the place up."""
        try:
            await asyncio.shield(self.future)
        except asyncio.CancelledError:
            self.release()
            raise

    def release(self) -> None:
        """Free the slot (or give up the place in the queue)."""
        if not self.released:
            self.released = True
            self._budget.done(self)


class StreamBudget:
    """Slots for long-lived streams to one host, apart from request slots."""

    def __init__(self, name: str, limit: int, prefetch_limit: int = 1) -> None:
        """Initialize the budget."""
        if limit < 1 or prefetch_limit < 1:
            raise ValueError("stream limits must be at least 1")
        self.name = name
        self.limit = limit
        self.prefetch_limit = min(prefetch_limit, limit)
        self._waiting: list[StreamTicket] = []
        self._active: set[StreamTicket] = set()
        self._seq = itertools.count()
        self._closed = False

    def request(self, priority: Priority) -> StreamTicket:
        """Queue for a slot; the ticket's ``wait()`` resolves when granted."""
        if self._closed:
            raise SchedulerClosedError(self.name)
        ticket = StreamTicket(self, priority, next(self._seq))
        self._waiting.append(ticket)
        self.dispatch()
        return ticket

    @asynccontextmanager
    async def slot(self, priority: Priority) -> AsyncIterator[StreamTicket]:
        """Hold a stream slot for the duration of the block."""
        ticket = self.request(priority)
        try:
            await ticket.wait()
            yield ticket
        finally:
            ticket.release()

    def _prefetch_active(self) -> int:
        return sum(1 for t in self._active if t.granted_priority is Priority.PREFETCH)

    def dispatch(self) -> None:
        """Grant free slots to the best waiting tickets."""
        self._waiting.sort(key=lambda t: (t.priority, t.seq))
        for ticket in list(self._waiting):
            if len(self._active) >= self.limit:
                return
            if (
                ticket.priority is Priority.PREFETCH
                and self._prefetch_active() >= self.prefetch_limit
            ):
                continue
            self._waiting.remove(ticket)
            self._active.add(ticket)
            ticket.granted_priority = ticket.priority
            ticket.future.set_result(None)

    def done(self, ticket: StreamTicket) -> None:
        """Forget a ticket (released or abandoned) and grant its slot."""
        if ticket in self._waiting:
            self._waiting.remove(ticket)
            if not ticket.future.done():
                ticket.future.cancel()
        self._active.discard(ticket)
        if not self._closed:
            self.dispatch()

    def stats(self) -> dict[str, int]:
        """Return stream statistics."""
        return {
            "stream_limit": self.limit,
            "streams": len(self._active),
            "streams_waiting": len(self._waiting),
        }

    def close(self) -> None:
        """Fail every waiting ticket."""
        self._closed = True
        for ticket in self._waiting:
            if not ticket.future.done():
                ticket.future.set_exception(SchedulerClosedError(self.name))
        self._waiting.clear()


class HostScheduler:
    """Queue, limit and prioritize the requests to one host."""

    def __init__(
        self,
        name: str,
        limit: int,
        stream_limit: int = 2,
        prefetch_stream_limit: int = 1,
    ) -> None:
        """Initialize the scheduler."""
        if limit < 1:
            raise ValueError("limit must be at least 1")
        self.name = name
        self.limit = limit
        self.streams = StreamBudget(name, stream_limit, prefetch_stream_limit)
        self._heap: list[tuple[int, int, _Job]] = []
        self._by_key: dict[Hashable, _Job] = {}
        self._running: set[_Job] = set()
        self._exclusive_running = False
        self._seq = itertools.count()
        self._closed = False

    @property
    def running(self) -> int:
        """Return the number of running jobs."""
        return len(self._running)

    @property
    def queued(self) -> int:
        """Return the number of queued jobs."""
        return sum(1 for _p, seq, job in self._heap if _valid(seq, job))

    def stats(self) -> dict[str, int]:
        """Return queue statistics."""
        return {
            "limit": self.limit,
            "running": self.running,
            "queued": self.queued,
            **self.streams.stats(),
        }

    async def run[T](
        self,
        factory: Callable[[], Awaitable[T]],
        *,
        priority: Priority,
        key: Hashable | None = None,
        timeout: float | None = None,
        exclusive: bool = False,
    ) -> T:
        """Run ``factory()`` against the host when a slot is free; return its result.

        ``timeout`` bounds the run time, not the time spent queued; on expiry the
        job is cancelled and ``TimeoutError`` is raised.
        """
        if self._closed:
            raise SchedulerClosedError(self.name)

        job = self._by_key.get(key) if key is not None else None
        if job is not None:
            job.waiters += 1
            if job.state == _QUEUED and priority < job.priority:
                # Re-queue at the higher priority; the old heap entry goes stale.
                job.priority = priority
                job.seq = next(self._seq)
                heapq.heappush(self._heap, (priority, job.seq, job))
        else:
            future: asyncio.Future[Any] = asyncio.get_running_loop().create_future()
            # Mark exceptions as retrieved even if every waiter went away.
            future.add_done_callback(_consume)
            job = _Job(
                factory=factory,
                priority=priority,
                seq=next(self._seq),
                key=key,
                timeout=timeout,
                exclusive=exclusive,
                future=future,
            )
            if key is not None:
                self._by_key[key] = job
            heapq.heappush(self._heap, (priority, job.seq, job))
            self._dispatch()

        try:
            return await asyncio.shield(job.future)
        except asyncio.CancelledError:
            if not job.future.done():
                self._release_waiter(job)
            raise

    def _release_waiter(self, job: _Job) -> None:
        job.waiters -= 1
        if job.waiters > 0:
            return
        if job.state == _QUEUED:
            job.state = _DONE
            self._forget(job)
            job.future.cancel()
            self._dispatch()
        elif job.state == _RUNNING and job.task is not None:
            job.task.cancel()

    def _forget(self, job: _Job) -> None:
        if job.key is not None and self._by_key.get(job.key) is job:
            del self._by_key[job.key]

    def _peek(self) -> _Job | None:
        while self._heap:
            _priority, seq, job = self._heap[0]
            if _valid(seq, job):
                return job
            heapq.heappop(self._heap)
        return None

    def _dispatch(self) -> None:
        loop = asyncio.get_running_loop()
        while not self._closed and not self._exclusive_running:
            job = self._peek()
            if job is None:
                return
            if job.exclusive:
                if self._running:
                    # Head-of-line: wait for the host to drain so exclusive jobs
                    # are not starved by a stream of smaller ones.
                    return
            elif len(self._running) >= self.limit:
                return
            heapq.heappop(self._heap)
            job.state = _RUNNING
            self._running.add(job)
            if job.exclusive:
                self._exclusive_running = True
            job.task = loop.create_task(
                self._execute(job), name=f"reolink_viewer {self.name}"
            )

    async def _execute(self, job: _Job) -> None:
        try:
            async with asyncio.timeout(job.timeout):
                result = await job.factory()
        except asyncio.CancelledError:
            if not job.future.done():
                job.future.cancel()
        except Exception as err:  # noqa: BLE001 - handed to the waiters
            if not job.future.done():
                job.future.set_exception(err)
        else:
            if not job.future.done():
                job.future.set_result(result)
        finally:
            job.state = _DONE
            self._running.discard(job)
            if job.exclusive:
                self._exclusive_running = False
            self._forget(job)
            if not self._closed:
                self._dispatch()

    async def async_shutdown(self) -> None:
        """Fail queued jobs, cancel running ones and wait for them to finish."""
        self._closed = True
        self.streams.close()
        for _priority, seq, job in self._heap:
            if _valid(seq, job):
                job.state = _DONE
                if not job.future.done():
                    job.future.set_exception(SchedulerClosedError(self.name))
        self._heap.clear()
        self._by_key.clear()
        tasks = []
        for job in self._running:
            # Fail the waiters with a clear error rather than a bare cancellation.
            if not job.future.done():
                job.future.set_exception(SchedulerClosedError(self.name))
            if job.task is not None:
                job.task.cancel()
                tasks.append(job.task)
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)


def _valid(seq: int, job: _Job) -> bool:
    return job.state == _QUEUED and job.seq == seq


def _consume(future: asyncio.Future[Any]) -> None:
    if not future.cancelled():
        future.exception()


class Scheduler:
    """Registry of per-host schedulers."""

    def __init__(
        self,
        default_limit: int,
        limits: dict[str, int] | None = None,
        *,
        default_stream_limit: int = 2,
        resolver: Callable[[str], HostLimits | None] | None = None,
    ) -> None:
        """Initialize the registry.

        ``resolver`` gives a host's limits from its key (e.g. NVR or camera) when
        its scheduler is first created; ``limits`` overrides request limits by key.
        """
        self._default = HostLimits(default_limit, default_stream_limit)
        self._limits = dict(limits or {})
        self._resolver = resolver
        self._hosts: dict[str, HostScheduler] = {}
        self._closed = False

    def _limits_for(self, host_key: str) -> HostLimits:
        limits = self._default
        if self._resolver is not None:
            try:
                limits = self._resolver(host_key) or self._default
            except Exception:  # fall back to the safe default
                _LOGGER.debug("Cannot resolve limits of %s", host_key, exc_info=True)
        if host_key in self._limits:
            limits = HostLimits(
                self._limits[host_key], limits.streams, limits.prefetch_streams
            )
        return limits

    def host(self, host_key: str) -> HostScheduler:
        """Return the scheduler for a host, creating it on first use."""
        if self._closed:
            raise SchedulerClosedError(host_key)
        if (scheduler := self._hosts.get(host_key)) is None:
            limits = self._limits_for(host_key)
            scheduler = HostScheduler(
                host_key, limits.requests, limits.streams, limits.prefetch_streams
            )
            self._hosts[host_key] = scheduler
        return scheduler

    def forget(self, host_key: str) -> None:
        """Drop an idle host's scheduler so its limits are resolved again."""
        scheduler = self._hosts.get(host_key)
        if scheduler is not None and not scheduler.running and not scheduler.queued:
            del self._hosts[host_key]

    async def run[T](
        self,
        host_key: str,
        factory: Callable[[], Awaitable[T]],
        *,
        priority: Priority,
        key: Hashable | None = None,
        timeout: float | None = None,
        exclusive: bool = False,
    ) -> T:
        """Run a job on a host's scheduler."""
        return await self.host(host_key).run(
            factory, priority=priority, key=key, timeout=timeout, exclusive=exclusive
        )

    def stats(self) -> dict[str, dict[str, int]]:
        """Return statistics per host."""
        return {key: sched.stats() for key, sched in self._hosts.items()}

    async def async_shutdown(self) -> None:
        """Shut down every host scheduler."""
        self._closed = True
        await asyncio.gather(*(s.async_shutdown() for s in self._hosts.values()))
        self._hosts.clear()

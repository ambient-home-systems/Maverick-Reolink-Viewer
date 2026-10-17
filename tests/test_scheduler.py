"""Tests for the per-host scheduler."""

import asyncio
from typing import Any

import pytest

from custom_components.reolink_viewer.scheduler import (
    HostScheduler,
    Priority,
    Scheduler,
    SchedulerClosedError,
)


class Gate:
    """A job that records when it starts and waits until released."""

    def __init__(self, log: list[str], name: str, result: Any = None) -> None:
        self.log = log
        self.name = name
        self.result = result
        self.started = asyncio.Event()
        self.release = asyncio.Event()
        self.calls = 0

    async def __call__(self) -> Any:
        self.calls += 1
        self.log.append(self.name)
        self.started.set()
        await self.release.wait()
        return self.result


async def _settle() -> None:
    for _ in range(5):
        await asyncio.sleep(0)


async def test_concurrency_limit() -> None:
    """No more than ``limit`` jobs run at once."""
    sched = HostScheduler("h", limit=2)
    log: list[str] = []
    gates = [Gate(log, f"j{i}", i) for i in range(4)]
    tasks = [
        asyncio.create_task(sched.run(g, priority=Priority.SETTINGS)) for g in gates
    ]
    await _settle()
    assert log == ["j0", "j1"]
    assert sched.stats() == {"limit": 2, "running": 2, "queued": 2}
    gates[0].release.set()
    await _settle()
    assert log == ["j0", "j1", "j2"]
    for g in gates:
        g.release.set()
    assert await asyncio.gather(*tasks) == [0, 1, 2, 3]
    assert sched.stats() == {"limit": 2, "running": 0, "queued": 0}


async def test_priority_order() -> None:
    """Queued jobs start by priority (live first), FIFO within a priority."""
    sched = HostScheduler("h", limit=1)
    log: list[str] = []
    blocker = Gate(log, "blocker")
    first = asyncio.create_task(sched.run(blocker, priority=Priority.SETTINGS))
    await blocker.started.wait()

    order = [
        ("prefetch", Priority.PREFETCH),
        ("thumb", Priority.THUMBNAILS),
        ("settings", Priority.SETTINGS),
        ("playback", Priority.PLAYBACK),
        ("live1", Priority.LIVE),
        ("live2", Priority.LIVE),
    ]
    gates = {name: Gate(log, name) for name, _ in order}
    for gate in gates.values():
        gate.release.set()
    tasks = [
        asyncio.create_task(sched.run(gates[name], priority=prio))
        for name, prio in order
    ]
    await _settle()
    blocker.release.set()
    await asyncio.gather(first, *tasks)
    assert log == [
        "blocker",
        "live1",
        "live2",
        "playback",
        "settings",
        "thumb",
        "prefetch",
    ]


async def test_deduplication_shares_result() -> None:
    """Identical in-flight requests run once."""
    sched = HostScheduler("h", limit=2)
    gate = Gate([], "x", "value")
    tasks = [
        asyncio.create_task(sched.run(gate, priority=Priority.THUMBNAILS, key="k"))
        for _ in range(3)
    ]
    await gate.started.wait()
    gate.release.set()
    assert await asyncio.gather(*tasks) == ["value"] * 3
    assert gate.calls == 1
    # Once finished, the key can run again.
    gate.release.set()
    assert await sched.run(gate, priority=Priority.THUMBNAILS, key="k") == "value"
    assert gate.calls == 2


async def test_deduplication_shares_exception() -> None:
    """Every waiter on a de-duplicated job sees its error."""
    sched = HostScheduler("h", limit=1)
    calls = 0

    async def boom() -> None:
        nonlocal calls
        calls += 1
        await asyncio.sleep(0)
        raise ValueError("bad")

    results = await asyncio.gather(
        sched.run(boom, priority=Priority.LIVE, key="k"),
        sched.run(boom, priority=Priority.LIVE, key="k"),
        return_exceptions=True,
    )
    assert calls == 1
    assert all(isinstance(r, ValueError) for r in results)


async def test_dedup_raises_priority_of_queued_job() -> None:
    """A higher-priority duplicate moves the queued job up."""
    sched = HostScheduler("h", limit=1)
    log: list[str] = []
    blocker = Gate(log, "blocker")
    first = asyncio.create_task(sched.run(blocker, priority=Priority.LIVE))
    await blocker.started.wait()
    thumb = Gate(log, "thumb")
    settings = Gate(log, "settings")
    for g in (thumb, settings):
        g.release.set()
    t1 = asyncio.create_task(sched.run(thumb, priority=Priority.PREFETCH, key="t"))
    t2 = asyncio.create_task(sched.run(settings, priority=Priority.SETTINGS))
    await _settle()
    t3 = asyncio.create_task(sched.run(thumb, priority=Priority.LIVE, key="t"))
    await _settle()
    blocker.release.set()
    await asyncio.gather(first, t1, t2, t3)
    assert log == ["blocker", "thumb", "settings"]
    assert thumb.calls == 1


async def test_timeout() -> None:
    """A job exceeding its timeout raises TimeoutError and frees its slot."""
    sched = HostScheduler("h", limit=1)

    async def slow() -> None:
        await asyncio.sleep(10)

    with pytest.raises(TimeoutError):
        await sched.run(slow, priority=Priority.LIVE, timeout=0.01)
    assert sched.running == 0

    async def fast() -> int:
        return 1

    assert await sched.run(fast, priority=Priority.LIVE, timeout=1) == 1


async def test_timeout_excludes_queue_time() -> None:
    """Time spent queued does not count against the timeout."""
    sched = HostScheduler("h", limit=1)
    gate = Gate([], "blocker")
    first = asyncio.create_task(sched.run(gate, priority=Priority.LIVE))
    await gate.started.wait()

    async def quick() -> str:
        await asyncio.sleep(0.01)
        return "ok"

    second = asyncio.create_task(sched.run(quick, priority=Priority.LIVE, timeout=0.05))
    await asyncio.sleep(0.1)
    gate.release.set()
    assert await second == "ok"
    await first


async def test_cancel_queued_waiter_drops_job() -> None:
    """Cancelling the only waiter of a queued job removes it from the queue."""
    sched = HostScheduler("h", limit=1)
    log: list[str] = []
    blocker = Gate(log, "blocker")
    first = asyncio.create_task(sched.run(blocker, priority=Priority.LIVE))
    await blocker.started.wait()
    dropped = Gate(log, "dropped")
    task = asyncio.create_task(sched.run(dropped, priority=Priority.PREFETCH))
    await _settle()
    assert sched.queued == 1
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    assert sched.queued == 0
    blocker.release.set()
    await first
    await _settle()
    assert dropped.calls == 0


async def test_cancel_running_waiter_cancels_job() -> None:
    """Cancelling the only waiter of a running job cancels it."""
    sched = HostScheduler("h", limit=1)
    cancelled = asyncio.Event()

    async def job() -> None:
        try:
            await asyncio.sleep(10)
        except asyncio.CancelledError:
            cancelled.set()
            raise

    task = asyncio.create_task(sched.run(job, priority=Priority.LIVE))
    await _settle()
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    await asyncio.wait_for(cancelled.wait(), 1)
    await _settle()
    assert sched.running == 0


async def test_cancel_one_of_two_waiters_keeps_job() -> None:
    """A shared job keeps running while another caller still waits."""
    sched = HostScheduler("h", limit=1)
    gate = Gate([], "x", 42)
    a = asyncio.create_task(sched.run(gate, priority=Priority.LIVE, key="k"))
    b = asyncio.create_task(sched.run(gate, priority=Priority.LIVE, key="k"))
    await gate.started.wait()
    a.cancel()
    with pytest.raises(asyncio.CancelledError):
        await a
    gate.release.set()
    assert await b == 42


async def test_exclusive_runs_alone() -> None:
    """An exclusive job waits for the host to drain and blocks others."""
    sched = HostScheduler("h", limit=3)
    log: list[str] = []
    normal = Gate(log, "normal")
    exclusive = Gate(log, "exclusive")
    after = Gate(log, "after")
    t1 = asyncio.create_task(sched.run(normal, priority=Priority.LIVE))
    await normal.started.wait()
    t2 = asyncio.create_task(
        sched.run(exclusive, priority=Priority.PREFETCH, exclusive=True)
    )
    t3 = asyncio.create_task(sched.run(after, priority=Priority.PREFETCH))
    await _settle()
    # Head-of-line: the exclusive job waits and nothing overtakes it at its level.
    assert log == ["normal"]
    normal.release.set()
    await exclusive.started.wait()
    await _settle()
    assert log == ["normal", "exclusive"]
    assert sched.running == 1
    exclusive.release.set()
    await after.started.wait()
    after.release.set()
    await asyncio.gather(t1, t2, t3)


async def test_shutdown() -> None:
    """Shutdown fails queued and running jobs and refuses new ones."""
    registry = Scheduler(default_limit=1, limits={"special": 3})
    assert registry.host("special").limit == 3
    gate = Gate([], "running")
    running = asyncio.create_task(registry.run("h", gate, priority=Priority.LIVE))
    await gate.started.wait()
    queued = asyncio.create_task(
        registry.run("h", Gate([], "q"), priority=Priority.LIVE)
    )
    await _settle()
    assert registry.stats()["h"] == {"limit": 1, "running": 1, "queued": 1}
    await registry.async_shutdown()
    with pytest.raises(SchedulerClosedError):
        await running
    with pytest.raises(SchedulerClosedError):
        await queued
    with pytest.raises(SchedulerClosedError):
        registry.host("h")


async def test_closed_host_scheduler_refuses() -> None:
    """A shut-down host scheduler refuses new jobs."""
    sched = HostScheduler("h", limit=1)
    await sched.async_shutdown()

    async def job() -> None:
        return None

    with pytest.raises(SchedulerClosedError):
        await sched.run(job, priority=Priority.LIVE)


def test_invalid_limit() -> None:
    """A limit below 1 is rejected."""
    with pytest.raises(ValueError, match="at least 1"):
        HostScheduler("h", limit=0)

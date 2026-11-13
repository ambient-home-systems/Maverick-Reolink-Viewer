"""Tests for the factory values check (Phase 11 step 5, research)."""

from collections.abc import AsyncGenerator
import json
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry
from reolink_aio.exceptions import ReolinkError

from custom_components.reolink_viewer import bridge
from custom_components.reolink_viewer.probe import ProbeOptions, Prober
from custom_components.reolink_viewer.probe_factory import (
    FACTORY_COMMANDS,
    MAX_DIFFERENCES,
    FactoryOptions,
    command_result,
    differences,
    leaves,
)
from custom_components.reolink_viewer.scheduler import Scheduler
from homeassistant.core import HomeAssistant

FACTORY_ONLY = ProbeOptions(factory=FactoryOptions(enabled=True, only=True))


@pytest.fixture
async def scheduler() -> AsyncGenerator[Scheduler]:
    scheduler = Scheduler(default_limit=2)
    yield scheduler
    await scheduler.async_shutdown()


def _prober(hass: HomeAssistant, scheduler: Scheduler, options: ProbeOptions) -> Prober:
    return Prober(
        scheduler,
        bridge.async_get_hosts(hass),
        options=options,
        compat=bridge.async_check_compat(hass),
        ffmpeg_binary="ffmpeg",
        ffmpeg_version="7.1",
        session=MagicMock(),
        integration_version="0.0.1",
    )


# What a camera answers each command asked with "action": 1.
REPLIES: dict[str, Any] = {
    "GetImage": {
        "value": {"Image": {"channel": 0, "bright": 140, "contrast": 128}},
        "initial": {"Image": {"channel": 0, "bright": 128, "contrast": 128}},
        "range": {"Image": {"bright": {"min": 0, "max": 255}}},
    },
    "GetIsp": {
        "value": {
            "Isp": {"dayNight": "Color", "exposure": "Auto", "bd": [{"mode": 1}]}
        },
        "initial": {
            "Isp": {"dayNight": "Auto", "exposure": "Auto", "bd": [{"mode": 0}]}
        },
    },
    # The on-screen text names the camera: only "(text)" in the report.
    "GetOsd": {
        "value": {"Osd": {"osdChannel": {"name": "Front Yard", "enable": 1}}},
        "initial": {"Osd": {"osdChannel": {"name": "Camera1", "enable": 1}}},
    },
    # No factory values kept for this one.
    "GetEnc": {"value": {"Enc": {"mainStream": {"bitRate": 6144}}}},
    "GetAiAlarm": {"error": {"detail": "not support", "rspCode": -9}},
}


def _answer(body: list[dict[str, Any]], **_kwargs: Any) -> list[dict[str, Any]]:
    (request,) = body
    cmd = request["cmd"]
    if cmd == "GetRecV20":
        raise ReolinkError("the camera hung up")
    reply = REPLIES.get(cmd, {"value": {"x": 1}})
    return [{"cmd": cmd, "code": 1 if "error" in reply else 0, **reply}]


async def _run(
    hass: HomeAssistant, scheduler: Scheduler, options: ProbeOptions = FACTORY_ONLY
) -> dict[str, Any]:
    report = await _prober(hass, scheduler, options).async_run()
    host: dict[str, Any] = report["hosts"][0]
    return host


async def test_factory_values_are_asked_read_only_and_compared(
    hass: HomeAssistant,
    reolink_host: MagicMock,
    loaded_reolink: MockConfigEntry,
    scheduler: Scheduler,
) -> None:
    """Every command asked with action 1, one at a time; what differs is listed."""
    reolink_host.send = AsyncMock(side_effect=_answer)
    host = await _run(hass, scheduler)

    # Only this check: the cameras' live and recording checks are skipped.
    assert host["concurrency"] == {"ok": False, "skipped": "factory values check only"}
    assert "live" not in host["channels"][0]
    asked = [call.args[0] for call in reolink_host.send.await_args_list]
    assert [body[0]["cmd"] for body in asked] == [
        cmd for cmd, _extra in FACTORY_COMMANDS
    ]
    assert all(len(body) == 1 and body[0]["action"] == 1 for body in asked)
    assert asked[5][0]["param"] == {"channel": 0, "ai_type": "people"}

    factory = host["factory"]
    assert factory["ok"] is True
    (channel,) = factory["channels"]
    commands = channel["commands"]
    image = commands["GetImage"]
    assert image["ok"] is True
    assert (image["initial"], image["range"], image["values"]) == (True, True, 3)
    assert image["differences"] == [
        {"path": "Image.bright", "now": 140, "factory": 128}
    ]
    assert commands["GetIsp"]["differences"] == [
        {"path": "Isp.dayNight", "now": "Color", "factory": "Auto"},
        {"path": "Isp.bd[0].mode", "now": 1, "factory": 0},
    ]
    assert commands["GetOsd"]["differences"] == [
        {"path": "Osd.osdChannel.name", "now": "(text)", "factory": "(text)"}
    ]
    enc = commands["GetEnc"]
    assert (enc["ok"], enc["initial"], enc["range"]) == (True, False, False)
    assert "differ" not in enc
    assert commands["GetAiAlarm"] == {
        "ok": False,
        "error": "not support",
        "ms": commands["GetAiAlarm"]["ms"],
    }
    assert commands["GetRecV20"]["ok"] is False
    assert "the camera hung up" in commands["GetRecV20"]["error"]
    # Ten of twelve answered (one refused, one failed), three with factory values,
    # four values differ.
    assert channel["summary"] == {"answered": 10, "with_initial": 3, "differ": 4}
    assert factory["summary"] == {
        "cameras": 1,
        "commands_answered": 10,
        "with_initial": 3,
        "differ": 4,
    }
    # Nothing that names the camera on screen leaves it.
    assert "Camera1" not in json.dumps(host)


async def test_a_battery_camera_is_asked_only_when_included(
    hass: HomeAssistant,
    reolink_host: MagicMock,
    loaded_reolink: MockConfigEntry,
    scheduler: Scheduler,
) -> None:
    """Asking wakes a camera on its battery: opt-in, as the rest of the probe."""
    reolink_host.send = AsyncMock(side_effect=_answer)
    reolink_host.supported.side_effect = lambda _ch, cap, *_args: (
        cap == "battery" or cap != "replay"
    )
    reolink_host._battery = {0: {"powerSupplyStatus": "none"}}
    host = await _run(hass, scheduler)
    (channel,) = host["factory"]["channels"]
    assert channel["skipped"] == "battery camera (opt-in: include_battery)"
    assert host["factory"]["summary"]["cameras"] == 0
    reolink_host.send.assert_not_awaited()


async def test_the_bridge_asks_reads_only(
    hass: HomeAssistant,
    reolink_host: MagicMock,
    loaded_reolink: MockConfigEntry,
) -> None:
    """Anything but a Get is refused before it reaches the camera."""
    reolink_host.send = AsyncMock(return_value=[])
    (handle,) = bridge.async_get_hosts(hass)
    with pytest.raises(ValueError, match="not a read"):
        await handle.async_get_initial("SetIsp", {"channel": 0})
    reolink_host.send.assert_not_awaited()
    # An empty answer is nothing, not an error.
    assert await handle.async_get_initial("GetIsp", {"channel": 0}) == {}


def test_differences_and_values() -> None:
    """Only what both hold is compared; long text is cut; naming text hidden."""
    assert differences({"a": 1, "b": 2}, {"a": 1}) == []
    assert differences([1, 2, 3], [1, 5]) == [{"path": "[1]", "now": 2, "factory": 5}]
    long = "x" * 60
    (found,) = differences({"t": long}, {"t": "y"})
    assert found["now"] == "x" * 40 + "…"
    assert differences({"t": "a"}, {"t": "b"}, naming=True) == [
        {"path": "t", "now": "(text)", "factory": "(text)"}
    ]
    assert differences({"t": {"x": 1}}, {"t": 3}) == [
        {"path": "t", "now": "(dict)", "factory": 3}
    ]
    assert leaves({"a": [1, 2, {"b": 3}], "c": None}) == 4
    many = {"v": list(range(100))}
    result = command_result("GetX", {"value": many, "initial": {"v": [-1] * 100}})
    assert result["differ"] == 100
    assert len(result["differences"]) == MAX_DIFFERENCES
    assert command_result("GetX", {"error": "plain"}) == {"ok": False, "error": "plain"}


def test_options() -> None:
    """Only this check is no option without the check."""
    assert FactoryOptions(enabled=False, only=True).only is False
    assert FactoryOptions(enabled=True, only=True).only is True

"""Tests for the events check of cameras that record but cannot be played (Phase 6)."""

from collections.abc import AsyncGenerator
from datetime import datetime, timedelta
import json
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry
from reolink_aio.exceptions import NotSupportedError, ReolinkError
from reolink_aio.typings import VOD_trigger

from custom_components.reolink_viewer import bridge
from custom_components.reolink_viewer.probe import ProbeOptions, Prober
from custom_components.reolink_viewer.probe_events import NO_TARGET, EventsOptions
from custom_components.reolink_viewer.scheduler import Priority, Scheduler
from homeassistant.core import HomeAssistant

from .conftest import TEST_NOW, make_vod_file

EVENTS_ONLY = ProbeOptions(events=EventsOptions(enabled=True, only=True))


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


def _doorbell(host: MagicMock, *, wired: bool = True) -> None:
    """Make the mocked host the battery Doorbell: direct, Baichuan only, SD card."""
    host.is_nvr = False
    host.is_hub = False
    host.baichuan_only = True
    host.hdd_list = [0]
    host.hdd_available.side_effect = lambda index: True
    # A battery camera that reports no replay support.
    host.supported.side_effect = lambda _ch, cap, *_args: cap != "replay"
    host.is_doorbell.return_value = True
    host._battery = {0: {"powerSupplyStatus": "normal" if wired else "none"}}


async def _run(
    hass: HomeAssistant, scheduler: Scheduler, options: ProbeOptions = EVENTS_ONLY
) -> dict[str, Any]:
    report = await _prober(hass, scheduler, options).async_run()
    host: dict[str, Any] = report["hosts"][0]
    return host


async def test_events_check_on_the_wired_doorbell(
    hass: HomeAssistant,
    reolink_host: MagicMock,
    loaded_reolink: MockConfigEntry,
    scheduler: Scheduler,
) -> None:
    """On wired power the Doorbell is checked without the battery opt-in."""
    _doorbell(reolink_host)
    press = make_vod_file(TEST_NOW - timedelta(hours=1), 2, name="20261017110000")
    press.bc_triggers = VOD_trigger.DOORBELL | VOD_trigger.PERSON
    reolink_host.baichuan.search_vod_type = AsyncMock(
        return_value=({}, {VOD_trigger.DOORBELL: [press], VOD_trigger.PERSON: [press]})
    )
    host = await _run(hass, scheduler)

    # Only this check: the camera's live and recording checks are skipped.
    assert host["channels"][0]["skipped"] == "battery camera (opt-in: include_battery)"
    assert host["concurrency"] == {"ok": False, "skipped": "events check only"}
    events = host["events"]
    assert events["ok"] is True
    assert events["storage"] == "ready"
    (channel,) = events["channels"]
    # A Baichuan-only device has Home Assistant's zone (v0.42.0).
    assert channel["clock"] == {"timezone_known": True, "source": "device"}
    assert channel["is_battery"] is True
    assert channel["wired_power"] is True
    assert channel["supports_replay"] is False
    assert channel["gate"] == {
        "event_search": True,
        # The mock answers every window with the same press: four in all.
        "events_found": 4,
        "day_search": True,
        "thumbnails": True,
    }
    assert channel["day_search"]["days"] == 17
    assert channel["day_search"]["today"] is True
    searches = channel["event_search"]
    assert set(searches) == {
        "today_sub",
        "today_main",
        "yesterday_sub",
        "yesterday_main",
    }
    today = searches["today_sub"]
    assert today["ok"] is True
    assert today["events"] == 1
    assert today["recordings"] == 1
    assert today["types"] == {"PERSON": 1, "DOORBELL": 1}
    assert today["length_s"] == {"min": 120, "median": 120, "max": 120}
    (sample,) = channel["snapshot_past"]["samples"]
    assert sample["ok"] is True
    assert sample["bytes"] == len(b"\xff\xd8jpegdata")

    # The windows are the device's own today and yesterday, on both streams.
    midnight = datetime(2026, 10, 17)
    windows = {
        (c.kwargs["start"], c.kwargs["end"], c.kwargs["stream"])
        for c in reolink_host.baichuan.search_vod_type.await_args_list
    }
    assert windows == {
        (midnight, TEST_NOW, "sub"),
        (midnight, TEST_NOW, "main"),
        (midnight - timedelta(days=1), midnight - timedelta(seconds=1), "sub"),
        (midnight - timedelta(days=1), midnight - timedelta(seconds=1), "main"),
    }
    # The picture is asked a little into the event, on the sub stream.
    reolink_host.baichuan.snapshot_past.assert_awaited_once_with(
        0, TEST_NOW - timedelta(hours=1) + timedelta(seconds=2), "sub", "ffmpeg"
    )
    # Never the HTTP Search, which a Baichuan-only device does not have.
    reolink_host.request_vod_files.assert_not_awaited()
    # No event's time of day in the report.
    assert "11:00" not in json.dumps(host)


async def test_events_check_on_battery_is_opt_in(
    hass: HomeAssistant,
    reolink_host: MagicMock,
    loaded_reolink: MockConfigEntry,
    scheduler: Scheduler,
) -> None:
    """A camera on its battery is woken only with the battery opt-in."""
    _doorbell(reolink_host, wired=False)
    host = await _run(hass, scheduler)
    (channel,) = host["events"]["channels"]
    assert channel["skipped"] == "on battery (opt-in: include_battery)"
    assert host["events"]["ok"] is False
    reolink_host.baichuan.search_vod_type.assert_not_awaited()

    options = ProbeOptions(
        include_battery=True, events=EventsOptions(enabled=True, only=True)
    )
    host = await _run(hass, scheduler, options)
    (channel,) = host["events"]["channels"]
    assert "skipped" not in channel
    assert channel["gate"]["event_search"] is True


@pytest.mark.parametrize(
    ("attr", "value", "reason"),
    [("camera_online", False, "offline"), ("sleeping", True, "sleeping")],
)
async def test_events_check_skips_unavailable_channels(
    hass: HomeAssistant,
    reolink_host: MagicMock,
    loaded_reolink: MockConfigEntry,
    scheduler: Scheduler,
    attr: str,
    value: bool,
    reason: str,
) -> None:
    """An offline or sleeping camera is not asked anything."""
    _doorbell(reolink_host)
    getattr(reolink_host, attr).return_value = value
    host = await _run(hass, scheduler)
    (channel,) = host["events"]["channels"]
    assert channel["skipped"] == reason
    reolink_host.baichuan.search_vod_type.assert_not_awaited()


async def test_events_check_needs_a_target(
    hass: HomeAssistant,
    reolink_host: MagicMock,
    loaded_reolink: MockConfigEntry,
    scheduler: Scheduler,
) -> None:
    """An NVR's channels play, and a camera without storage records nothing."""
    host = await _run(hass, scheduler)
    assert host["events"] == {"ok": False, "skipped": NO_TARGET}
    reolink_host.is_nvr = False
    reolink_host.hdd_list = []
    host = await _run(hass, scheduler)
    assert host["events"] == {"ok": False, "skipped": NO_TARGET}


async def test_events_check_off_by_default(
    hass: HomeAssistant,
    reolink_host: MagicMock,
    loaded_reolink: MockConfigEntry,
    scheduler: Scheduler,
) -> None:
    """The check runs only when asked for, and "only" needs it on."""
    # On battery and not included, so the rest of the probe skips it too.
    _doorbell(reolink_host, wired=False)
    host = await _run(hass, scheduler, ProbeOptions())
    assert "events" not in host
    reolink_host.baichuan.search_vod_type.assert_not_awaited()
    assert EventsOptions(only=True).only is False


async def test_events_check_records_failures(
    hass: HomeAssistant,
    reolink_host: MagicMock,
    loaded_reolink: MockConfigEntry,
    scheduler: Scheduler,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Searches that fail, and pictures that fail or are not JPEGs, are recorded."""
    _doorbell(reolink_host)
    monkeypatch.setattr(bridge, "EVENT_SEARCH_RETRY_DELAY", 0)
    reolink_host.baichuan.search_vod_type = AsyncMock(side_effect=ReolinkError("400"))
    reolink_host.baichuan.search_vod_days = AsyncMock(side_effect=ReolinkError("days"))
    reolink_host.request_vod_files = AsyncMock(side_effect=ReolinkError("no HTTP"))
    host = await _run(hass, scheduler)
    (channel,) = host["events"]["channels"]
    assert channel["ok"] is False
    assert channel["day_search"] == {"ok": False, "error": "ReolinkError: no HTTP"}
    assert channel["event_search"]["today_sub"] == {
        "ok": False,
        "error": "ReolinkError: 400",
    }
    assert channel["snapshot_past"] == {"ok": False, "skipped": "no event to sample"}
    assert channel["gate"] == {
        "event_search": False,
        "events_found": 0,
        "day_search": False,
        "thumbnails": None,
    }

    # Events found, but the pictures do not come.
    reolink_host.baichuan.search_vod_type = AsyncMock(
        return_value=(
            {},
            {
                VOD_trigger.PERSON: [
                    make_vod_file(TEST_NOW - timedelta(hours=h)) for h in (1, 2, 3, 4)
                ]
            },
        )
    )
    reolink_host.baichuan.snapshot_past = AsyncMock(
        side_effect=[b"not a jpeg", ReolinkError("298"), b"\xff\xd8ok"]
    )
    host = await _run(hass, scheduler)
    (channel,) = host["events"]["channels"]
    samples = channel["snapshot_past"]["samples"]
    # The three newest of four events.
    assert len(samples) == 3
    assert samples[0]["ok"] is False
    assert samples[0]["error"] == "not a JPEG"
    assert samples[1] == {"ok": False, "error": "ReolinkError: 298"}
    assert samples[2]["ok"] is True
    assert channel["gate"]["thumbnails"] is True
    asked = [c.args[1] for c in reolink_host.baichuan.snapshot_past.await_args_list]
    assert asked == [
        TEST_NOW - timedelta(hours=h) + timedelta(seconds=2) for h in (1, 2, 3)
    ]


# Baichuan's answer to its time query (104), as reolink-aio's synchronize_time
# reads it: the device's wall clock and its zone, seconds west of UTC.
CLOCK_ANSWER = """<?xml version="1.0" encoding="UTF-8" ?>
<body>
<SystemGeneral version="1.1">
<timeZone>18000</timeZone>
<osdFormat>MDY</osdFormat>
<year>2026</year>
<month>10</month>
<day>17</day>
<hour>7</hour>
<minute>0</minute>
<second>0</second>
<timeFormat>0</timeFormat>
</SystemGeneral>
</body>
"""


async def test_events_check_clock_fallbacks(
    hass: HomeAssistant,
    reolink_host: MagicMock,
    loaded_reolink: MockConfigEntry,
    scheduler: Scheduler,
) -> None:
    """A Baichuan-only device answers no HTTP GetTime: its own clock, else HA's."""
    _doorbell(reolink_host)
    # What v0.41.0's run on the Doorbell met.
    reolink_host.time.return_value = None
    reolink_host.async_get_time = AsyncMock(
        side_effect=NotSupportedError("get_time: failed")
    )
    reolink_host.baichuan.send = AsyncMock(return_value=CLOCK_ANSWER)
    host = await _run(hass, scheduler)
    (channel,) = host["events"]["channels"]
    clock = channel["clock"]
    assert clock["source"] == "baichuan"
    assert clock["device_error"] == "NotSupportedError: get_time: failed"
    assert clock["timezone_known"] is True
    assert isinstance(clock["home_assistant_utc_offset_s"], int)
    baichuan = clock["baichuan"]
    assert baichuan["ok"] is True
    assert baichuan["time_zone"] == 18000
    assert {"SystemGeneral", "timeZone", "year", "second"} <= set(baichuan["fields"])
    assert isinstance(baichuan["ahead_of_home_assistant_s"], int)
    reolink_host.baichuan.send.assert_awaited_with(cmd_id=104)
    # The searches run on the device's own day, from its clock.
    windows = {
        (c.kwargs["start"], c.kwargs["end"])
        for c in reolink_host.baichuan.search_vod_type.await_args_list
    }
    assert (datetime(2026, 10, 17), datetime(2026, 10, 17, 7)) in windows
    assert channel["gate"]["event_search"] is True

    # 104 fails too: Home Assistant's clock, and the searches still run.
    reolink_host.baichuan.send = AsyncMock(side_effect=ReolinkError("104"))
    host = await _run(hass, scheduler)
    (channel,) = host["events"]["channels"]
    assert channel["clock"]["source"] == "home_assistant"
    assert channel["clock"]["baichuan"] == {"ok": False, "error": "ReolinkError: 104"}
    assert channel["gate"]["event_search"] is True


async def test_events_check_runs_at_prefetch_priority(
    hass: HomeAssistant,
    reolink_host: MagicMock,
    loaded_reolink: MockConfigEntry,
    scheduler: Scheduler,
) -> None:
    """Every request of the check is a scheduler job at the lowest priority."""
    _doorbell(reolink_host)
    run = AsyncMock(side_effect=scheduler.run)
    with patch.object(scheduler, "run", run):
        await _run(hass, scheduler)
    # The device time, the day search, four event searches and one picture.
    assert run.await_count >= 7
    assert {c.kwargs["priority"] for c in run.await_args_list} == {Priority.PREFETCH}

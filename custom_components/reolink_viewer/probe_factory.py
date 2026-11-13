"""Settings changed from factory (Phase 11 step 5): whether factory values can be read.

Part of the hardware probe, opt-in. Reolink's HTTP API answers a ``Get``
command asked with ``"action": 1`` with its value and, where the firmware keeps
them, its ``initial`` (factory) value and its ``range``. reolink-aio asks a
few commands so, for their ranges, and keeps no initial value; nothing in
Home Assistant holds one. So, for each camera, this asks the commands behind
the settings Reolink Viewer shows (image, ISP, streams, on-screen text,
motion, AI, IR, floodlight, status light, recording, audio, push) and
records, per command:

- whether it answered, and whether it holds ``initial`` and ``range``;
- how many values it holds;
- which differ from ``initial`` (their paths, with both values: numbers,
  on/off and options as they are; the on-screen text, which names the camera,
  only as "(text)"; long text cut short).

If the factory values can be read, Settings could mark what was changed from
factory (Phase 11 step 5's question); the answer is recorded in the plan.

Same safety rules as the rest of the probe: read-only (the bridge refuses
anything but a ``Get``), every request a scheduler job at prefetch priority,
one command at a time. A camera on its battery is asked only with "Include
battery cameras" (asking wakes it).
"""

from collections.abc import Callable
from dataclasses import dataclass
from functools import partial
import time
from typing import Any

from .bridge import ChannelInfo, HostInfo, ReolinkHostHandle
from .probe_playback import JobRunner

# The commands asked, and any parameter besides the channel.
FACTORY_COMMANDS: tuple[tuple[str, dict[str, Any]], ...] = (
    ("GetImage", {}),
    ("GetIsp", {}),
    ("GetEnc", {}),
    ("GetOsd", {}),
    ("GetMdAlarm", {}),
    ("GetAiAlarm", {"ai_type": "people"}),
    ("GetIrLights", {}),
    ("GetWhiteLed", {}),
    ("GetPowerLed", {}),
    ("GetRecV20", {}),
    ("GetAudioCfg", {}),
    ("GetPushV20", {}),
)
# Commands whose text names the camera (its on-screen text): shown as "(text)".
NAMING_COMMANDS = frozenset({"GetOsd"})
# Differences listed per command at most (the count is always whole).
MAX_DIFFERENCES = 40
MAX_TEXT = 40


@dataclass(slots=True)
class FactoryOptions:
    """Options of the factory values check."""

    enabled: bool = False
    # Skip the Phase 0 checks (live, VOD methods, Baichuan, live concurrency).
    only: bool = False

    def __post_init__(self) -> None:
        """Clamp to safe values."""
        if not self.enabled:
            self.only = False


def _ms(start: float) -> float:
    return round((time.monotonic() - start) * 1000, 1)


def _err(err: BaseException) -> str:
    if isinstance(err, TimeoutError):
        return "timeout"
    text = str(err) or type(err).__name__
    return f"{type(err).__name__}: {text}"[:300]


def _shown(value: Any, naming: bool) -> Any:
    """Return a value as the report holds it (text naming the camera is not held)."""
    if isinstance(value, str):
        if naming:
            return "(text)"
        return value if len(value) <= MAX_TEXT else f"{value[:MAX_TEXT]}…"
    if isinstance(value, dict | list):
        return f"({type(value).__name__})"
    return value


def leaves(value: Any) -> int:
    """How many plain values a reply's value holds."""
    if isinstance(value, dict):
        return sum(leaves(v) for v in value.values())
    if isinstance(value, list):
        return sum(leaves(v) for v in value)
    return 1


def differences(
    value: Any, initial: Any, *, naming: bool = False, path: str = ""
) -> list[dict[str, Any]]:
    """Return the values that differ from the factory ones: path, now, factory.

    Only what both hold is compared: a key the initial value lacks is no
    difference (a firmware may leave some out).
    """
    if isinstance(value, dict) and isinstance(initial, dict):
        found: list[dict[str, Any]] = []
        for key, item in value.items():
            if key in initial:
                sub = f"{path}.{key}" if path else str(key)
                found += differences(item, initial[key], naming=naming, path=sub)
        return found
    if isinstance(value, list) and isinstance(initial, list):
        found = []
        for index, (item, start) in enumerate(zip(value, initial, strict=False)):
            found += differences(item, start, naming=naming, path=f"{path}[{index}]")
        return found
    if value == initial:
        return []
    return [
        {
            "path": path,
            "now": _shown(value, naming),
            "factory": _shown(initial, naming),
        }
    ]


def command_result(cmd: str, item: dict[str, Any]) -> dict[str, Any]:
    """Return what one command's reply says about its factory values."""
    if "error" in item:
        error = item["error"]
        detail = error.get("detail") if isinstance(error, dict) else error
        return {"ok": False, "error": str(detail)[:200]}
    value = item.get("value")
    initial = item.get("initial")
    result: dict[str, Any] = {
        "ok": True,
        "initial": initial is not None,
        "range": "range" in item,
        "values": leaves(value),
    }
    if initial is not None:
        found = differences(value, initial, naming=cmd in NAMING_COMMANDS)
        result["differ"] = len(found)
        result["differences"] = found[:MAX_DIFFERENCES]
    return result


class FactoryCheck:
    """Asks each camera of a host for its factory values (opt-in, read-only)."""

    def __init__(
        self,
        host: ReolinkHostHandle,
        job: JobRunner,
        *,
        include_battery: bool,
        step_timeout: float,
        progress: Callable[[str], None],
    ) -> None:
        """Ask through ``job`` (the probe's scheduler jobs)."""
        self._host = host
        self._job = job
        self._include_battery = include_battery
        self._timeout = step_timeout
        self._progress = progress

    def _skip(self, channel: ChannelInfo) -> str | None:
        if not channel.online:
            return "offline"
        if channel.is_battery and not channel.wired_power and not self._include_battery:
            return "battery camera (opt-in: include_battery)"
        if channel.sleeping:
            return "sleeping"
        return None

    async def async_host(self, info: HostInfo) -> dict[str, Any]:
        """Ask every camera of the host; return the check's report."""
        start = time.monotonic()
        channels = [await self._channel(channel) for channel in info.channels]
        asked = [c for c in channels if "skipped" not in c]
        return {
            "ok": True,
            "channels": channels,
            "summary": {
                "cameras": len(asked),
                "commands_answered": sum(c["summary"]["answered"] for c in asked),
                "with_initial": sum(c["summary"]["with_initial"] for c in asked),
                "differ": sum(c["summary"]["differ"] for c in asked),
            },
            "duration_ms": _ms(start),
        }

    async def _channel(self, channel: ChannelInfo) -> dict[str, Any]:
        ch = channel.channel
        result: dict[str, Any] = {
            "channel": ch,
            "name": channel.name,
            "model": channel.model,
            "firmware_version": channel.firmware_version,
        }
        if (reason := self._skip(channel)) is not None:
            result["skipped"] = reason
            return result
        self._progress(f"factory values ch{ch}: {channel.model}")
        commands: dict[str, Any] = {}
        for cmd, extra in FACTORY_COMMANDS:
            asked = time.monotonic()
            try:
                item = await self._job(
                    partial(
                        self._host.async_get_initial, cmd, {"channel": ch, **extra}
                    ),
                    timeout=self._timeout,
                )
            except Exception as err:  # noqa: BLE001 - recorded in the report
                commands[cmd] = {"ok": False, "error": _err(err)}
                continue
            commands[cmd] = {**command_result(cmd, item), "ms": _ms(asked)}
        answered = [c for c in commands.values() if c["ok"]]
        result["commands"] = commands
        result["summary"] = {
            "answered": len(answered),
            "with_initial": sum(1 for c in answered if c["initial"]),
            "differ": sum(c.get("differ", 0) for c in answered),
        }
        return result

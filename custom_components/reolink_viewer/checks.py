"""Playback check reports, kept so a run on a phone can be read on a desktop.

The panel's playback check (Debug section of the Playback tab) saves its report
here as it goes: a run in the iOS Companion app, where copying text is
awkward, can then be copied from a desktop browser, and a run cut short (the
app reloaded the page, e.g. under memory pressure) keeps what it measured.
Reports hold timings and capabilities only, never URLs or credentials.
"""

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

STORE_KEY = "reolink_viewer.check_reports"
MAX_REPORTS = 20
MAX_TEXT = 200_000
SAVE_DELAY = 5.0


@dataclass(slots=True)
class CheckReport:
    """One run of the playback check."""

    id: str
    setup: str
    text: str
    done: bool
    updated: str

    def as_dict(self) -> dict[str, Any]:
        """Return a JSON-serializable dict."""
        return {
            "id": self.id,
            "setup": self.setup,
            "text": self.text,
            "done": self.done,
            "updated": self.updated,
        }


class CheckReports:
    """The most recent check reports, newest last, stored in HA storage."""

    def __init__(self, hass: HomeAssistant) -> None:
        """Initialize (call async_load before use)."""
        self._store: Store[dict[str, Any]] = Store(hass, 1, STORE_KEY)
        self._reports: list[CheckReport] = []

    async def async_load(self) -> None:
        """Load the stored reports."""
        data = await self._store.async_load()
        items = data.get("reports", []) if isinstance(data, dict) else []
        self._reports = [
            CheckReport(
                id=str(item["id"]),
                setup=str(item.get("setup", "")),
                text=str(item.get("text", "")),
                done=bool(item.get("done")),
                updated=str(item.get("updated", "")),
            )
            for item in items
            if isinstance(item, dict) and "id" in item
        ][-MAX_REPORTS:]

    def save(self, report_id: str, setup: str, text: str, done: bool) -> None:
        """Add or replace a report (by id)."""
        report = CheckReport(
            report_id,
            setup,
            text[:MAX_TEXT],
            done,
            datetime.now(UTC).isoformat(timespec="seconds"),
        )
        self._reports = [r for r in self._reports if r.id != report_id]
        self._reports.append(report)
        del self._reports[:-MAX_REPORTS]
        self._store.async_delay_save(self._data, SAVE_DELAY)

    def reports(self) -> list[dict[str, Any]]:
        """Return the reports, newest first."""
        return [r.as_dict() for r in reversed(self._reports)]

    def _data(self) -> dict[str, Any]:
        return {"reports": [r.as_dict() for r in self._reports]}

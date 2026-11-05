"""The Wall's saved layouts (Phase 9 step 1), per Home Assistant user.

A layout is what the Wall shows: its name, its grid (GRIDS), the camera in
each cell in order (``None`` for a cell left empty), and a tour's seconds per
page (step 2; ``None`` for none). Kept on the server, so a layout made on the
desktop shows on the wall tablet signed in as the same user; each device
remembers which one it shows (in the browser). Ids are slugs of the name, so
a kiosk's start page can be ``#wall/<id>``.
"""

from __future__ import annotations

import re
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

STORE_KEY = "reolink_viewer.wall"
SAVE_DELAY = 1.0
# Auto packs every camera by its shape; the rest are fixed grids; 1+5 and 1+7
# have one large slot (2x2 of 3x3, 3x3 of 4x4).
GRIDS = ("auto", "1", "2x2", "3x3", "4x4", "1+5", "1+7")
MAX_LAYOUTS = 50
MAX_NAME = 60
MAX_CAMERAS = 64
MAX_TOUR_S = 3600


class LayoutError(ValueError):
    """A layout that cannot be kept, and why (said to the user)."""


def slug(name: str) -> str:
    """Return a layout name as its id: "Front of house" is "front-of-house"."""
    found = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return found[:40].strip("-") or "layout"


def layout_of(raw: dict[str, Any]) -> dict[str, Any]:
    """Return a layout as kept, checked; LayoutError says what is wrong."""
    name = str(raw.get("name", "")).strip()
    if not name:
        raise LayoutError("A layout needs a name")
    if len(name) > MAX_NAME:
        raise LayoutError(f"A layout's name is at most {MAX_NAME} characters")
    grid = raw.get("grid", "auto")
    if grid not in GRIDS:
        raise LayoutError(f"Unknown grid: {grid}")
    cameras = raw.get("cameras") or []
    if not isinstance(cameras, list) or len(cameras) > MAX_CAMERAS:
        raise LayoutError(f"At most {MAX_CAMERAS} cameras")
    tour = raw.get("tour_s")
    if tour is not None and not (isinstance(tour, int) and 5 <= tour <= MAX_TOUR_S):
        raise LayoutError(f"A tour's page lasts 5 to {MAX_TOUR_S} seconds")
    return {
        "id": str(raw.get("id") or ""),
        "name": name,
        "grid": grid,
        "cameras": [None if c is None else str(c) for c in cameras],
        "tour_s": tour,
    }


class WallStore:
    """Each Home Assistant user's saved Wall layouts."""

    def __init__(self, hass: HomeAssistant) -> None:
        """Initialize (call async_load before use)."""
        self._store: Store[dict[str, Any]] = Store(hass, 1, STORE_KEY)
        self._users: dict[str, list[dict[str, Any]]] = {}

    async def async_load(self) -> None:
        """Load what was stored, leaving out what no longer reads."""
        data = await self._store.async_load()
        users = data.get("users", {}) if isinstance(data, dict) else {}
        self._users = {}
        for user, layouts in users.items():
            kept = []
            for raw in layouts if isinstance(layouts, list) else []:
                try:
                    kept.append(layout_of(raw))
                except LayoutError, TypeError, AttributeError:
                    continue
            self._users[str(user)] = [layout for layout in kept if layout["id"]]

    def layouts(self, user_id: str) -> list[dict[str, Any]]:
        """Return a user's layouts, in the order they were made."""
        return [dict(layout) for layout in self._users.get(user_id, [])]

    def save(self, user_id: str, raw: dict[str, Any]) -> dict[str, Any]:
        """Keep a layout (a new one, or one of the user's by its id); return it."""
        layout = layout_of(raw)
        mine = self._users.setdefault(user_id, [])
        index = next(
            (
                i
                for i, kept in enumerate(mine)
                if layout["id"] and kept["id"] == layout["id"]
            ),
            None,
        )
        if index is None:
            if len(mine) >= MAX_LAYOUTS:
                raise LayoutError(f"At most {MAX_LAYOUTS} layouts")
            taken = {kept["id"] for kept in mine}
            base = slug(layout["name"])
            layout["id"] = base
            number = 2
            while layout["id"] in taken:
                layout["id"] = f"{base}-{number}"
                number += 1
            mine.append(layout)
        else:
            mine[index] = layout
        self._save()
        return dict(layout)

    def delete(self, user_id: str, layout_id: str) -> bool:
        """Forget one of a user's layouts; True if it was there."""
        mine = self._users.get(user_id, [])
        kept = [layout for layout in mine if layout["id"] != layout_id]
        if len(kept) == len(mine):
            return False
        self._users[user_id] = kept
        self._save()
        return True

    def _save(self) -> None:
        self._store.async_delay_save(lambda: {"users": self._users}, SAVE_DELAY)

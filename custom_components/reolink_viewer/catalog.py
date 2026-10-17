"""Settings catalog and categories (catalog/*.json).

Both files are keyed by entity domain, then by the entity's translation_key
(as in the Reolink integration's strings.json). A few Reolink entities have no
translation_key and are named by their device class; :data:`FALLBACK_KEYS` maps
those to catalog keys.
"""

from dataclasses import dataclass
import json
from pathlib import Path
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.util.hass_dict import HassKey

from .const import DOMAIN

CATALOG_DIR = Path(__file__).parent / "catalog"
CATEGORIES_FILE = CATALOG_DIR / "categories.json"
SETTINGS_FILE = CATALOG_DIR / "settings-catalog.json"

# Category of entities whose key is in neither file (a newer HA release).
OTHER_CATEGORY = "other"

# (domain, device class) -> catalog key, for entities without a translation_key.
FALLBACK_KEYS: dict[tuple[str, str], str] = {
    ("binary_sensor", "motion"): "motion",
    ("button", "restart"): "reboot",
    ("sensor", "battery"): "battery",
    ("update", "firmware"): "firmware",
}

DATA_CATALOG: HassKey[Catalog] = HassKey(f"{DOMAIN}_catalog")


def catalog_key(
    domain: str, translation_key: str | None, device_class: str | None
) -> str | None:
    """Return the catalog key of an entity."""
    if translation_key:
        return translation_key
    if device_class:
        return FALLBACK_KEYS.get((domain, device_class))
    return None


@dataclass(frozen=True, slots=True)
class Catalog:
    """Loaded catalog files."""

    categories: dict[str, Any]
    settings: dict[str, Any]

    def category(self, domain: str, key: str | None) -> str:
        """Return the category id of an entity key."""
        if key is None:
            return OTHER_CATEGORY
        entities: dict[str, dict[str, str]] = self.categories["entities"]
        return entities.get(domain, {}).get(key, OTHER_CATEGORY)

    def has_entry(self, domain: str, key: str | None) -> bool:
        """Return True if the settings catalog explains this key."""
        entities: dict[str, dict[str, Any]] = self.settings["entities"]
        return key is not None and key in entities.get(domain, {})

    def as_dict(self) -> dict[str, Any]:
        """Return the payload sent to the panel."""
        return {
            "version": self.settings.get("version", 1),
            "categories": self.categories["categories"],
            "entities": self.settings["entities"],
        }


def load_catalog() -> Catalog:
    """Read the catalog files (blocking)."""
    return Catalog(
        categories=json.loads(CATEGORIES_FILE.read_text(encoding="utf-8")),
        settings=json.loads(SETTINGS_FILE.read_text(encoding="utf-8")),
    )


async def async_get_catalog(hass: HomeAssistant) -> Catalog:
    """Return the catalog, reading the files once per HA run."""
    if (catalog := hass.data.get(DATA_CATALOG)) is None:
        catalog = await hass.async_add_executor_job(load_catalog)
        hass.data[DATA_CATALOG] = catalog
    return catalog

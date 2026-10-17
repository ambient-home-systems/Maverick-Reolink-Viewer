"""Catalog coverage: every Reolink entity key must be in both catalog files.

Loads the installed Reolink integration's strings.json, so a new HA release that
adds entities fails here until the catalog explains them.
"""

import importlib
import json
from pathlib import Path
import re

import pytest

from custom_components.reolink_viewer.catalog import (
    FALLBACK_KEYS,
    OTHER_CATEGORY,
    catalog_key,
    load_catalog,
)
from homeassistant.helpers.entity import EntityDescription

REOLINK = importlib.import_module("homeassistant.components.reolink")
STRINGS = Path(REOLINK.__file__ or "").parent / "strings.json"
PLATFORMS = (
    "binary_sensor",
    "button",
    "camera",
    "light",
    "number",
    "select",
    "sensor",
    "siren",
    "switch",
    "time",
    "update",
)
IMPACTS = {"read_only", "safe", "disruptive"}
# Descriptions whose translation key is set at runtime (see _dynamic_keys).
DYNAMIC = {("sensor", "storage")}


def _strings_keys() -> set[tuple[str, str]]:
    strings = json.loads(STRINGS.read_text(encoding="utf-8"))
    return {(d, k) for d, keys in strings["entity"].items() for k in keys}


def _code_keys() -> set[tuple[str, str]]:
    """Catalog keys of every entity description in the integration's platforms.

    Covers translation keys that have no strings.json entry (e.g. tamper, named
    by its device class) and entities named by device class alone.
    """
    keys: set[tuple[str, str]] = set()
    for platform in PLATFORMS:
        module = importlib.import_module(f"homeassistant.components.reolink.{platform}")
        for value in vars(module).values():
            items = value if isinstance(value, (tuple, list)) else (value,)
            for desc in items:
                if not isinstance(desc, EntityDescription):
                    continue
                device_class = getattr(desc, "device_class", None)
                key = catalog_key(platform, desc.translation_key, device_class)
                if key is None:
                    assert (platform, desc.key) in DYNAMIC, (
                        f"{platform} entity {desc.key!r} has no catalog key: add it"
                        " to catalog.FALLBACK_KEYS"
                    )
                    continue
                keys.add((platform, key))
    return keys


def _dynamic_keys() -> set[tuple[str, str]]:
    """Translation keys the platforms build at runtime (_attr_translation_key)."""
    keys: set[tuple[str, str]] = set()
    for platform in PLATFORMS:
        module = importlib.import_module(f"homeassistant.components.reolink.{platform}")
        source = Path(module.__file__ or "").read_text(encoding="utf-8")
        keys.update(
            (platform, m)
            for m in re.findall(r'_attr_translation_key = "([a-z0-9_-]+)"', source)
        )
    return keys


ALL_KEYS = _strings_keys() | _code_keys() | _dynamic_keys()
CATALOG = load_catalog()


def test_reolink_strings_found() -> None:
    """Sanity: the installed integration has entity strings."""
    assert len(_strings_keys()) > 150
    assert ("binary_sensor", "tamper") in _code_keys()
    assert ("sensor", "hdd_storage") in _dynamic_keys()
    assert set(FALLBACK_KEYS.values()) <= {k for _d, k in _code_keys()}


@pytest.mark.parametrize(("domain", "key"), sorted(ALL_KEYS))
def test_key_is_in_both_catalog_files(domain: str, key: str) -> None:
    """Every entity key has a category and a catalog entry."""
    assert CATALOG.category(domain, key) != OTHER_CATEGORY, (
        f"{domain}.{key} missing from catalog/categories.json"
    )
    assert CATALOG.has_entry(domain, key), (
        f"{domain}.{key} missing from catalog/settings-catalog.json"
    )


def test_catalog_entries_are_well_formed() -> None:
    """Fields, impact values, related keys and categories are consistent."""
    category_ids = {c["id"] for c in CATALOG.categories["categories"]}
    assert OTHER_CATEGORY not in category_ids
    for domain, keys in CATALOG.categories["entities"].items():
        for key, category in keys.items():
            assert category in category_ids, (domain, key)
    entries = CATALOG.settings["entities"]
    known = {(d, k) for d, keys in entries.items() for k in keys}
    assert known == {
        (d, k) for d, keys in CATALOG.categories["entities"].items() for k in keys
    }
    for domain, keys in entries.items():
        for key, entry in keys.items():
            where = f"{domain}.{key}"
            for field in ("title", "summary", "what_it_does", "requires"):
                assert entry[field], where
            assert entry["impact"] in IMPACTS, where
            assert entry["verification"] in {"verified", "unverified"}, where
            assert entry["sources"], where
            assert all(s["url"].startswith("https://") for s in entry["sources"]), where
            if entry["impact"] == "disruptive":
                assert entry["impact_note"], where
                when = entry["disruptive_when"]
                assert isinstance(when, list) or when in {"on", "off", "any"}, where
            else:
                assert "disruptive_when" not in entry, where
            for related in entry["related"]:
                rd, rk = related.split(".", 1)
                assert (rd, rk) in known, f"{where} -> {related}"


@pytest.mark.parametrize(
    ("domain", "key"),
    [
        ("switch", "record"),
        ("switch", "privacy_mode"),
        ("button", "reboot"),
        ("update", "firmware"),
        ("siren", "siren"),
        ("switch", "push_notifications"),
    ],
)
def test_harmful_actions_are_disruptive(domain: str, key: str) -> None:
    """Actions that stop recording, reboot, sound alarms or mute alerts need confirming."""
    assert CATALOG.settings["entities"][domain][key]["impact"] == "disruptive"


def test_catalog_key_fallbacks() -> None:
    """Entities without a translation key are found by device class."""
    assert catalog_key("switch", "record", None) == "record"
    assert catalog_key("button", None, "restart") == "reboot"
    assert catalog_key("sensor", None, "temperature") is None
    assert catalog_key("sensor", None, None) is None
    assert CATALOG.category("sensor", None) == OTHER_CATEGORY
    assert not CATALOG.has_entry("sensor", None)

"""Print what the installed Home Assistant release pins for the components we use.

Reolink Viewer depends on Home Assistant's Reolink, ffmpeg, frontend, camera and
stream components, whose Python requirements Home Assistant installs only when it
loads them, and the test harness does not. Each Home Assistant release pins its
own versions (reolink-aio above all), so the tests against a release install
these, read from that release's own manifests:

    pip install pytest-homeassistant-custom-component==<version>
    pip install $(python -m scripts.ha_requirements)
"""

from __future__ import annotations

import json
from pathlib import Path

import homeassistant

COMPONENTS = ("reolink", "ffmpeg", "frontend", "camera", "stream")


def requirements() -> list[str]:
    """Return the pinned requirements of COMPONENTS, once each, in order."""
    components = Path(homeassistant.__file__).parent / "components"
    found: list[str] = []
    for component in COMPONENTS:
        manifest = json.loads((components / component / "manifest.json").read_text())
        found.extend(r for r in manifest.get("requirements", []) if r not in found)
    return found


if __name__ == "__main__":
    print(" ".join(requirements()))

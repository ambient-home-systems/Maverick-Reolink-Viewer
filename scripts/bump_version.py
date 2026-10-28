"""Set Reolink Viewer's version everywhere it is written.

    python -m scripts.bump_version 0.32.0

manifest.json (what Home Assistant and HACS read), frontend/package.json and its
lockfile, and the panel's frontend/src/version.ts (its reports carry it, and its
help opens the docs of this release). Then add the
version's entry to CHANGELOG.md, rebuild the panel (`npm run build` in
frontend/) and commit; scripts/build_release.py checks they all agree.
"""

from __future__ import annotations

import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parent.parent


def _set(path: Path, pattern: str, value: str, count: int = 1) -> None:
    """Replace the first `count` matches of `pattern`'s group, keeping the file's layout."""
    text, found = re.subn(
        pattern,
        lambda m: m.group(1) + value + m.group(2),
        path.read_text(),
        count=count,
    )
    if found != count:
        raise ValueError(f"{path} does not carry the version where expected")
    path.write_text(text)


def bump(version: str, root: Path = ROOT) -> None:
    """Write `version` into every file that carries it."""
    if not re.fullmatch(r"\d+\.\d+\.\d+", version):
        raise ValueError(f"{version!r} is not a version like 1.2.3")
    field = r'("version": ")[^"]+(")'
    _set(
        root / "custom_components" / "reolink_viewer" / "manifest.json", field, version
    )
    _set(root / "frontend" / "package.json", field, version)
    # The lockfile's own version, then its root package's: its first two.
    lock = root / "frontend" / "package-lock.json"
    _set(lock, field, version, count=2)
    data = json.loads(lock.read_text())
    if data["version"] != version or data["packages"][""]["version"] != version:
        raise ValueError(
            f"{lock} has its versions elsewhere: set them with npm version"
        )
    _set(root / "frontend" / "src" / "version.ts", r'(VERSION = ")[^"]+(")', version)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    bump(sys.argv[1])
    print(
        f"Version {sys.argv[1]}: now add its CHANGELOG.md entry and run `npm run build` in frontend/."
    )

"""Package Reolink Viewer for a release, after checking it is whole.

    python -m scripts.build_release [--out DIR]   # DIR/reolink_viewer.zip; prints the version
    python -m scripts.build_release --notes       # this version's release notes

The zip holds the integration's folder as HACS lays it out: unzipped into
config/custom_components/reolink_viewer, it is installed. CI builds it on every
change, so a release never finds a broken package; the Release workflow
(.github/workflows/release.yml) attaches it to the GitHub release.

Before packaging, it checks (and stops, saying what is wrong):
- the version is the same in manifest.json, frontend/package.json and the
  live check (which writes it into its reports);
- CHANGELOG.md has an entry for it;
- the built panel is whole: every file its modules import, and its fonts;
- nothing that should not ship is in the folder (Python caches).
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import sys
import zipfile

ROOT = Path(__file__).resolve().parent.parent
PACKAGE = ROOT / "custom_components" / "reolink_viewer"
FRONTEND = PACKAGE / "frontend_dist"
ZIP_NAME = "reolink_viewer.zip"

# What a module of the built panel imports: "./home-AbC123.js".
_IMPORT = re.compile(r"""["'](\./[\w.-]+\.js)["']""")
# The fonts the panel asks for: "barlow-400.woff2".
_FONT = re.compile(r"""["']([\w-]+\.woff2)["']""")
_SKIP = {"__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache"}


class ReleaseError(Exception):
    """The package is not ready: the message says why, in plain words."""


def version() -> str:
    """Return the version, once it is the same everywhere it is written."""
    manifest = str(json.loads((PACKAGE / "manifest.json").read_text())["version"])
    package = json.loads((ROOT / "frontend" / "package.json").read_text())["version"]
    check = re.search(
        r'LIVE_CHECK_VERSION = "([^"]+)"',
        (ROOT / "frontend" / "src" / "live" / "check.ts").read_text(),
    )
    found = {
        "manifest.json": manifest,
        "frontend/package.json": package,
        "frontend/src/live/check.ts": check.group(1) if check else "(none)",
    }
    if len(set(found.values())) != 1:
        listed = ", ".join(f"{path} says {v}" for path, v in found.items())
        raise ReleaseError(f"The version differs: {listed}.")
    return manifest


def notes(release: str) -> str:
    """Return the release notes: the version's CHANGELOG.md entry, and how to install it."""
    changelog = (ROOT / "CHANGELOG.md").read_text()
    match = re.search(
        rf"^## {re.escape(release)}\b[^\n]*\n(.*?)(?=^## |\Z)",
        changelog,
        re.MULTILINE | re.DOTALL,
    )
    if not match or not match.group(1).strip():
        raise ReleaseError(f"CHANGELOG.md has no entry for {release}: add one first.")
    minimum = json.loads((ROOT / "hacs.json").read_text())["homeassistant"]
    return (
        f"{match.group(1).strip()}\n\n"
        "## Install\n\n"
        f"Requires Home Assistant {minimum} or newer, with the Reolink integration "
        "set up.\n\n"
        "- **HACS:** add this repository as a custom repository (type Integration), "
        "install **Reolink Viewer**, and restart Home Assistant.\n"
        f"- **By hand:** unzip `{ZIP_NAME}` into "
        "`config/custom_components/reolink_viewer`, and restart Home Assistant.\n\n"
        "Then: Settings → Devices & services → Add integration → **Reolink Viewer**.\n"
    )


def check_frontend() -> None:
    """Check that every file the built panel imports, and every font it asks for, is there."""
    entry = FRONTEND / "reolink-viewer-panel.js"
    if not entry.is_file():
        raise ReleaseError(
            "The built panel is missing: run `npm run build` in frontend/."
        )
    missing: set[str] = set()
    for module in FRONTEND.glob("*.js"):
        text = module.read_text()
        missing.update(f for f in _IMPORT.findall(text) if not (FRONTEND / f).is_file())
        missing.update(
            f"./fonts/{f}"
            for f in _FONT.findall(text)
            if not (FRONTEND / "fonts" / f).is_file()
        )
    if missing:
        raise ReleaseError(
            f"The built panel is incomplete, missing {', '.join(sorted(missing))}: "
            "run `npm run build` in frontend/ and commit the result."
        )
    if not (FRONTEND / "fonts" / "OFL.txt").is_file():
        raise ReleaseError(
            "The fonts' licence (frontend_dist/fonts/OFL.txt) is missing."
        )


def files() -> list[Path]:
    """Return what ships: the integration's folder, without caches."""
    return sorted(
        path
        for path in PACKAGE.rglob("*")
        if path.is_file()
        and not _SKIP.intersection(path.relative_to(PACKAGE).parts)
        and path.suffix != ".pyc"
    )


def build(out: Path) -> tuple[str, Path]:
    """Check the package, then write the zip into `out`."""
    release = version()
    notes(release)
    check_frontend()
    out.mkdir(parents=True, exist_ok=True)
    target = out / ZIP_NAME
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in files():
            archive.write(path, path.relative_to(PACKAGE).as_posix())
    return release, target


def main() -> int:
    """Package, or print the notes; say what is wrong instead when it is not ready."""
    parser = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    parser.add_argument("--out", type=Path, default=ROOT / "dist")
    parser.add_argument("--notes", action="store_true", help="print the release notes")
    args = parser.parse_args()
    try:
        if args.notes:
            print(notes(version()))
        else:
            release, target = build(args.out)
            print(release)
            print(f"{target} ({target.stat().st_size // 1024} KB)", file=sys.stderr)
    except ReleaseError as err:
        print(f"Not ready to release: {err}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

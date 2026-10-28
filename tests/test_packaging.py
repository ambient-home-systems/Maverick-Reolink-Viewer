"""The release package (scripts/build_release.py) and the HA versions tested."""

from __future__ import annotations

import json
from pathlib import Path
import re
import shutil
import zipfile

import pytest

import homeassistant.const
from scripts import build_release, bump_version, ha_requirements

ROOT = Path(__file__).resolve().parent.parent


def test_the_version_is_the_same_everywhere() -> None:
    release = build_release.version()
    assert re.fullmatch(r"\d+\.\d+\.\d+", release)
    # Each version says what it brings, which becomes its release's notes.
    notes = build_release.notes(release)
    assert "## Install" in notes
    minimum = json.loads((ROOT / "hacs.json").read_text())["homeassistant"]
    assert f"Requires Home Assistant {minimum} or newer" in notes


def test_the_package_ships_the_integration_and_its_built_panel(tmp_path: Path) -> None:
    release, target = build_release.build(tmp_path)
    assert target.name == "reolink_viewer.zip"
    with zipfile.ZipFile(target) as archive:
        names = set(archive.namelist())
        # Laid out as custom_components/reolink_viewer: what HACS installs.
        assert json.loads(archive.read("manifest.json"))["version"] == release
        assert {
            "__init__.py",
            "translations/en.json",
            "catalog/settings-catalog.json",
        } <= names
        assert "frontend_dist/reolink-viewer-panel.js" in names
        assert "frontend_dist/fonts/OFL.txt" in names
        assert not [n for n in names if "__pycache__" in n or n.endswith(".pyc")]
        # Every module in it is valid Python.
        for name in names:
            if name.endswith(".py"):
                compile(archive.read(name), name, "exec")


@pytest.fixture
def copy(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """A copy of what the packager reads, to break on purpose."""
    root = tmp_path / "repo"
    package = root / "custom_components" / "reolink_viewer"
    shutil.copytree(
        build_release.PACKAGE, package, ignore=shutil.ignore_patterns("__pycache__")
    )
    for path in (
        "frontend/package.json",
        "frontend/package-lock.json",
        "frontend/src/live/check.ts",
        "CHANGELOG.md",
        "hacs.json",
    ):
        (root / path).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(ROOT / path, root / path)
    monkeypatch.setattr(build_release, "ROOT", root)
    monkeypatch.setattr(build_release, "PACKAGE", package)
    monkeypatch.setattr(build_release, "FRONTEND", package / "frontend_dist")
    return root


def test_it_says_what_is_wrong_before_packaging(copy: Path) -> None:
    out = copy / "dist"
    build_release.build(out)
    # A version left behind in one place.
    package = copy / "frontend" / "package.json"
    data = json.loads(package.read_text())
    good = data["version"]
    data["version"] = "0.0.1"
    package.write_text(json.dumps(data))
    with pytest.raises(
        build_release.ReleaseError, match=re.escape("frontend/package.json says 0.0.1")
    ):
        build_release.build(out)
    data["version"] = good
    package.write_text(json.dumps(data))
    # No changelog entry for it.
    changelog = copy / "CHANGELOG.md"
    changelog.write_text(changelog.read_text().replace(f"## {good}", "## 9.9.9"))
    with pytest.raises(
        build_release.ReleaseError, match=f"no entry for {re.escape(good)}"
    ):
        build_release.build(out)
    changelog.write_text(changelog.read_text().replace("## 9.9.9", f"## {good}"))
    # A chunk of the panel, or a font, missing.
    frontend = copy / "custom_components" / "reolink_viewer" / "frontend_dist"
    home = next(frontend.glob("home-*.js"))
    home.unlink()
    with pytest.raises(
        build_release.ReleaseError, match=rf"missing \./{re.escape(home.name)}"
    ):
        build_release.build(out)
    shutil.copy(ROOT / home.relative_to(copy), home)
    (frontend / "fonts" / "barlow-600.woff2").unlink()
    with pytest.raises(
        build_release.ReleaseError, match=re.escape("fonts/barlow-600.woff2")
    ):
        build_release.build(out)


def test_the_version_is_set_everywhere_at_once(copy: Path) -> None:
    manifest = copy / "custom_components" / "reolink_viewer" / "manifest.json"
    before = manifest.read_text()
    bump_version.bump("9.8.7", copy)
    assert build_release.version() == "9.8.7"
    lock = json.loads((copy / "frontend" / "package-lock.json").read_text())
    assert lock["version"] == lock["packages"][""]["version"] == "9.8.7"
    # Only the version changed: the files keep their layout.
    assert manifest.read_text() == re.sub(
        r'"version": "[^"]+"', '"version": "9.8.7"', before
    )
    with pytest.raises(ValueError, match="not a version"):
        bump_version.bump("v1", copy)


def test_the_tests_install_what_home_assistant_pins() -> None:
    """requirements_test.txt matches the Home Assistant release it pins."""
    text = (ROOT / "requirements_test.txt").read_text()
    release = re.search(r"= HA (\S+?)\)", text)
    assert release, "requirements_test.txt names the Home Assistant release it pins"
    if release.group(1) != homeassistant.const.__version__:
        pytest.skip(
            f"checked on HA {release.group(1)}, the pinned release (this is {homeassistant.const.__version__})"
        )
    pinned = dict(
        line.split("==", 1)
        for line in text.splitlines()
        if "==" in line and not line.startswith("#")
    )
    for requirement in ha_requirements.requirements():
        name, version = requirement.split("==", 1)
        if name in pinned:
            assert pinned[name] == version, (
                f"{name}: {pinned[name]} pinned, HA wants {version}"
            )


def test_the_oldest_home_assistant_claimed_is_tested() -> None:
    minimum = json.loads((ROOT / "hacs.json").read_text())["homeassistant"]
    ci = (ROOT / ".github" / "workflows" / "ci.yml").read_text()
    assert f'ha: "{minimum}"' in ci
    readme = (ROOT / "README.md").read_text()
    assert f"Requires Home Assistant {minimum} or newer" in readme

"""Install the release package into a clean Home Assistant, and set it up.

What a HACS install does, checked on every CI run (Phase 4's exit item, "an
install through HACS on a clean Home Assistant", closed by the owner's ask for
automated checks): the release zip (``scripts/build_release.py``) unpacked into
an empty config's ``custom_components/reolink_viewer``, then, in a Home
Assistant that has never seen it:

- the integration is found there (not in this repository) at the release's
  version, and its code imports;
- its config flow adds the entry, as Settings → Add integration does;
- the entry sets up with no Reolink camera yet;
- the sidebar panel and the dashboard card's module are registered, and the
  built panel and card are served with every module they import.

    python -m scripts.install_check [--keep]

It runs pytest in the unpacked copy's own directory, so the repository's
``custom_components`` is not on the path. ``--keep`` leaves the copy (its path
is printed) to look into.
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import zipfile

from scripts import build_release

PYTEST_INI = """\
[pytest]
asyncio_mode = auto
asyncio_default_fixture_loop_scope = function
asyncio_default_test_loop_scope = function
timeout = 60
addopts = -p no:cacheprovider
"""

CONFTEST = '''\
"""The installed copy is a custom integration of a clean Home Assistant."""

import pytest

# Imported first, as the repository's tests import theirs: this copy's
# custom_components, not the test harness's own (testing_config), which
# Home Assistant would otherwise find.
import custom_components  # noqa: F401


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations: None) -> None:
    """Let Home Assistant load custom integrations (the installed copy)."""
'''

TEST = '''\
"""The release, installed as HACS installs it, loads and sets up (scripts/install_check.py)."""

from pathlib import Path
import re
from unittest.mock import patch

from pytest_homeassistant_custom_component.typing import ClientSessionGenerator

from homeassistant.components.frontend import DATA_EXTRA_MODULE_URL, DATA_PANELS
from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from homeassistant.loader import async_get_integration
from homeassistant.setup import async_setup_component

HERE = Path(__file__).resolve().parent
RELEASE = "{release}"
DOMAIN = "reolink_viewer"
STATIC = "/reolink_viewer_static"


async def test_the_release_installs_and_sets_up(
    hass: HomeAssistant, hass_client: ClientSessionGenerator
) -> None:
    integration = await async_get_integration(hass, DOMAIN)
    # The copy unpacked here, at the release's version: not the repository's.
    assert Path(integration.file_path).resolve() == HERE / "custom_components" / DOMAIN
    assert str(integration.version) == RELEASE
    await integration.async_get_component()
    await integration.async_get_platform("config_flow")

    # Settings → Add integration: one confirmation, then the entry.
    with patch("homeassistant.components.reolink.PLATFORMS", []):
        result = await hass.config_entries.flow.async_init(
            DOMAIN, context={{"source": "user"}}
        )
        assert result["type"] is FlowResultType.FORM
        result = await hass.config_entries.flow.async_configure(
            result["flow_id"], {{}}
        )
        assert result["type"] is FlowResultType.CREATE_ENTRY
        await hass.async_block_till_done()
    (entry,) = hass.config_entries.async_entries(DOMAIN)
    assert entry.state is ConfigEntryState.LOADED

    # The sidebar panel and the card's module, served with what they import.
    panel = hass.data[DATA_PANELS]["reolink-viewer"]
    assert panel.config["_panel_custom"]["module_url"].startswith(
        f"{{STATIC}}/reolink-viewer-panel.js?v="
    )
    assert any(
        url.startswith(f"{{STATIC}}/reolink-viewer-card.js?v=")
        for url in hass.data[DATA_EXTRA_MODULE_URL].urls
    )
    # Every module the panel and the card load, however deep, lazily or not.
    assert await async_setup_component(hass, "http", {{}})
    client = await hass_client()
    wanted = ["reolink-viewer-panel.js", "reolink-viewer-card.js"]
    served: set[str] = set()
    while wanted:
        module = wanted.pop()
        if module in served:
            continue
        resp = await client.get(f"{{STATIC}}/{{module}}")
        assert resp.status == 200, module
        served.add(module)
        text = await resp.text()
        wanted += re.findall(r'(?:from ?|import ?\\(?)"\\./([\\w~.-]+\\.js)"', text)
    shipped = {{
        path.name
        for path in (HERE / "custom_components" / DOMAIN / "frontend_dist").glob("*.js")
    }}
    # Each built file is reached (none is left out of the graph, none is missing).
    assert served == shipped, sorted(served ^ shipped)

    # And it unloads, as removing it from Settings does.
    assert await hass.config_entries.async_unload(entry.entry_id)
    assert entry.state is ConfigEntryState.NOT_LOADED
'''


def prepare(work: Path) -> str:
    """Build the release zip and unpack it as an installed integration in `work`."""
    release, target = build_release.build(work / "dist")
    package = work / "custom_components" / "reolink_viewer"
    package.mkdir(parents=True)
    # A package, as the repository's is, so that this copy (first on the path)
    # is the one found, not the test harness's own custom_components.
    (package.parent / "__init__.py").write_text('"""Custom integrations."""\n')
    with zipfile.ZipFile(target) as archive:
        archive.extractall(package)
    (work / "pytest.ini").write_text(PYTEST_INI)
    (work / "conftest.py").write_text(CONFTEST)
    (work / "test_installed.py").write_text(TEST.format(release=release))
    return release


def run(work: Path) -> int:
    """Run the installed copy's test in `work`, away from the repository."""
    env = {k: v for k, v in os.environ.items() if k != "PYTHONPATH"}
    command = [sys.executable, "-m", "pytest", "-q", "test_installed.py"]
    # This interpreter's pytest on files this script wrote: no outside input.
    return subprocess.run(command, cwd=work, env=env, check=False).returncode  # noqa: S603


def main(argv: list[str] | None = None) -> int:
    """Install the release into a clean Home Assistant and set it up; 0 if it works."""
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--keep", action="store_true", help="keep the installed copy")
    args = parser.parse_args(argv)
    work = Path(tempfile.mkdtemp(prefix="reolink-viewer-install-")).resolve()
    try:
        release = prepare(work)
        print(f"Reolink Viewer {release}: installed from its release zip in {work}")
        code = run(work)
        print(
            "The release installs and sets up in a clean Home Assistant."
            if code == 0
            else "THE RELEASE DID NOT INSTALL OR SET UP: see above."
        )
        return code
    finally:
        if not args.keep:
            shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())

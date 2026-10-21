"""Find the go2rtc binary: Home Assistant's own, or a pinned, verified download.

Home Assistant's container ships go2rtc at ``/bin/go2rtc`` (found with
``shutil.which``, as HA's go2rtc integration does). Where it is missing or too
old (e.g. Home Assistant Core installs), the pinned release is downloaded once
into the integration's cache directory, and its SHA-256 is checked before every
use.
"""

import asyncio
from dataclasses import dataclass
import hashlib
import logging
import os
from pathlib import Path
import platform
import re
import shutil
import sys

from aiohttp import ClientError, ClientSession, ClientTimeout

from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)

GO2RTC_VERSION = "1.9.14"
# Older releases lack what the integration relies on (API path allow-list,
# local auth).
MIN_VERSION = (1, 9, 13)
RELEASE_URL = (
    "https://github.com/AlexxIT/go2rtc/releases/download/v{version}/go2rtc_linux_{arch}"
)
# SHA-256 of the v1.9.14 release binaries.
SHA256 = {
    "amd64": "32d616af226bd731678ffde328b94cfb94e30339bfefc469cfb76323144615a6",
    "arm64": "359fabade8a7a51e81a55fe6df6b0ef81764a5e1d63179577534eaaa71904b50",
    "arm": "4d7e1639af5a2722a28e864468fd8099b3c1682565446c798bf9e3b38fde12e4",
    "armv6": "4dc20370556b29f3a90f4c7a09dcd95472c8f74cca56d4d1fb91f32bdd15174c",
    "i386": "12a114d19fc9fba1b3541cf7c6bb9b01896a6845f31285ec77269e2e7c613885",
}
# platform.machine() -> the release's name for it.
ARCHES = {
    "x86_64": "amd64",
    "amd64": "amd64",
    "aarch64": "arm64",
    "arm64": "arm64",
    "armv7l": "arm",
    "armv8l": "arm",
    "armv6l": "armv6",
    "i386": "i386",
    "i686": "i386",
}
MAX_BYTES = 64 * 1024 * 1024
DOWNLOAD_TIMEOUT = 300.0
VERSION_TIMEOUT = 10.0


class BinaryError(Exception):
    """No usable go2rtc binary."""


@dataclass(frozen=True, slots=True)
class Binary:
    """A go2rtc binary and where it came from."""

    path: str
    version: str
    # "system" (found on the PATH, e.g. HA's /bin/go2rtc) or "downloaded".
    source: str


async def async_find_binary(
    hass: HomeAssistant, directory: Path, session: ClientSession
) -> Binary:
    """Return the system's go2rtc if recent enough, else the pinned download."""
    if (found := shutil.which("go2rtc")) is not None:
        version = await async_version(found)
        if version is not None and _parse(version) >= MIN_VERSION:
            return Binary(found, version, "system")
        _LOGGER.info(
            "go2rtc at %s is %s, older than %s: using the pinned %s instead",
            found,
            version or "of unknown version",
            ".".join(map(str, MIN_VERSION)),
            GO2RTC_VERSION,
        )
    path = await _async_download(hass, directory, session)
    return Binary(str(path), GO2RTC_VERSION, "downloaded")


async def async_version(path: str) -> str | None:
    """Return what ``go2rtc -version`` says, e.g. "1.9.14"."""
    try:
        process = await asyncio.create_subprocess_exec(
            path,
            "-version",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
    except OSError as err:
        _LOGGER.debug("Cannot run %s: %s", path, err)
        return None
    try:
        async with asyncio.timeout(VERSION_TIMEOUT):
            output, _ = await process.communicate()
    except TimeoutError:
        process.kill()
        await process.wait()
        return None
    match = re.search(r"version (\d+\.\d+\.\d+)", output.decode(errors="replace"))
    return match.group(1) if match else None


def _parse(version: str) -> tuple[int, ...]:
    return tuple(int(part) for part in version.split("."))


def _system() -> str:
    return sys.platform


def _machine() -> str:
    return platform.machine().lower()


def _arch() -> str:
    if (system := _system()) != "linux":
        raise BinaryError(f"go2rtc is not installed, and no download for {system}")
    machine = _machine()
    if (arch := ARCHES.get(machine)) is None:
        raise BinaryError(f"go2rtc is not installed, and no download for {machine}")
    return arch


async def _async_download(
    hass: HomeAssistant, directory: Path, session: ClientSession
) -> Path:
    arch = _arch()
    target = directory / f"go2rtc-{GO2RTC_VERSION}-{arch}"
    expected = SHA256[arch]
    if await hass.async_add_executor_job(_verified, target, expected):
        return target
    url = RELEASE_URL.format(version=GO2RTC_VERSION, arch=arch)
    part = target.with_name(target.name + ".part")
    _LOGGER.info("Downloading go2rtc %s (%s)", GO2RTC_VERSION, arch)
    digest = hashlib.sha256()
    size = 0
    await hass.async_add_executor_job(directory.mkdir, 0o755, True, True)
    file = await hass.async_add_executor_job(part.open, "wb")
    try:
        async with session.get(
            url, timeout=ClientTimeout(total=DOWNLOAD_TIMEOUT)
        ) as response:
            if response.status != 200:
                raise BinaryError(f"go2rtc download failed: HTTP {response.status}")
            async for chunk in response.content.iter_chunked(256 * 1024):
                size += len(chunk)
                if size > MAX_BYTES:
                    raise BinaryError("go2rtc download failed: larger than expected")
                digest.update(chunk)
                await hass.async_add_executor_job(file.write, chunk)
    except (ClientError, TimeoutError) as err:
        raise BinaryError(f"go2rtc download failed: {type(err).__name__}") from err
    finally:
        await hass.async_add_executor_job(file.close)
        if digest.hexdigest() != expected:
            await hass.async_add_executor_job(_unlink, part)
    if digest.hexdigest() != expected:
        raise BinaryError("go2rtc download failed: checksum mismatch")
    await hass.async_add_executor_job(_install, part, target)
    return target


def _verified(path: Path, expected: str) -> bool:
    """Return True if the file exists and has the expected SHA-256."""
    try:
        with path.open("rb") as file:
            digest = hashlib.file_digest(file, "sha256").hexdigest()
    except FileNotFoundError:
        return False
    if digest == expected and os.access(path, os.X_OK):
        return True
    path.unlink(missing_ok=True)
    return False


def _install(part: Path, target: Path) -> None:
    part.chmod(0o755)
    part.replace(target)


def _unlink(path: Path) -> None:
    path.unlink(missing_ok=True)

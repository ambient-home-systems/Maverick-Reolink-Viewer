"""Download the pinned go2rtc release for the tests, checked like the integration does.

Usage (from the repository root): python -m scripts.fetch_go2rtc <directory>

Prints the binary's path. CI runs it before the tests (which cannot reach the
internet) and passes the path in RV_GO2RTC.
"""

import hashlib
from pathlib import Path
import platform
import sys
import urllib.request

from custom_components.reolink_viewer.live.binary import (
    ARCHES,
    GO2RTC_VERSION,
    RELEASE_URL,
    SHA256,
)


def main() -> int:
    """Download, verify and install the binary; print its path."""
    directory = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
    arch = ARCHES[platform.machine().lower()]
    target = directory / f"go2rtc-{GO2RTC_VERSION}-{arch}"
    url = RELEASE_URL.format(version=GO2RTC_VERSION, arch=arch)
    with urllib.request.urlopen(url, timeout=120) as response:  # noqa: S310 - fixed https URL
        data = response.read()
    if hashlib.sha256(data).hexdigest() != SHA256[arch]:
        print(f"checksum mismatch for {url}", file=sys.stderr)
        return 1
    directory.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    target.chmod(0o755)
    print(target)
    return 0


if __name__ == "__main__":
    sys.exit(main())

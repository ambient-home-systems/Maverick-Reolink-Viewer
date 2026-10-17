"""Constants for the Reolink Viewer integration."""

from typing import Final

DOMAIN: Final = "reolink_viewer"
NAME: Final = "Reolink Viewer"

# The integration we sit on top of. Only bridge.py may touch its internals.
REOLINK_DOMAIN: Final = "reolink"

# Sidebar panel
PANEL_URL_PATH: Final = "reolink-viewer"
PANEL_TITLE: Final = "Reolink"
PANEL_ICON: Final = "mdi:cctv"
PANEL_COMPONENT_NAME: Final = "reolink-viewer-panel"
PANEL_FILENAME: Final = "reolink-viewer-panel.js"
STATIC_URL_PATH: Final = "/reolink_viewer_static"
FRONTEND_DIST_DIR: Final = "frontend_dist"

# Repair issue raised when the Reolink integration's internals are not what the
# bridge expects.
ISSUE_INCOMPATIBLE: Final = "reolink_incompatible"

# Per-host scheduler limits (Phase 0 decisions, hardware-matrix.md): request
# slots, and a separate budget for long-lived streams (recording downloads).
DEFAULT_HOST_CONCURRENCY: Final = 2
NVR_HOST_CONCURRENCY: Final = 6
CAMERA_HOST_CONCURRENCY: Final = 3
NVR_STREAM_BUDGET: Final = 4
DEFAULT_STREAM_BUDGET: Final = 2
PREFETCH_STREAM_BUDGET: Final = 1

# Probe safety limits.
PROBE_DEFAULT_MAX_STREAMS: Final = 4
PROBE_HARD_MAX_STREAMS: Final = 6
PROBE_STEP_TIMEOUT: Final = 20.0
PROBE_SEARCH_DAYS: Final = 3
PROBE_SCHEMA_VERSION: Final = 2
# Recording playback check (Phase 2 gate): simultaneous DOWNLOAD streams.
PROBE_PLAYBACK_DEFAULT_STREAMS: Final = 4
PROBE_PLAYBACK_HARD_MAX_STREAMS: Final = 6

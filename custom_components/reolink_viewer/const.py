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
# The dashboard card's module, added to every page (frontend.add_extra_js_url).
CARD_FILENAME: Final = "reolink-viewer-card.js"
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
# Phase 3 step 1: the NVR kept up with six subs, a main and a download at once
# (the capacity test, runs 5-10). Phase 9 step 3 (2026-11-06): six subs, three
# mains and a download at once, every level kept up; one fewer for headroom.
NVR_STREAM_BUDGET: Final = 9
DEFAULT_STREAM_BUDGET: Final = 2
PREFETCH_STREAM_BUDGET: Final = 1
# Phase 9 step 3: the Wall's tiles in HD at once through an NVR: two of the
# three slots beyond its six subs, one left for a full screen or a recording
# (the owner's choice, 2026-11-06). HD in a tile only takes a free stream slot
# and gives it back when one is needed. A camera added directly plays its own.
NVR_TILE_HD_STREAMS: Final = 2

# Probe safety limits.
PROBE_DEFAULT_MAX_STREAMS: Final = 4
PROBE_HARD_MAX_STREAMS: Final = 6
PROBE_STEP_TIMEOUT: Final = 20.0
PROBE_SEARCH_DAYS: Final = 3
PROBE_SCHEMA_VERSION: Final = 2
# Recording playback check (Phase 2 gate): simultaneous DOWNLOAD streams.
PROBE_PLAYBACK_DEFAULT_STREAMS: Final = 4
PROBE_PLAYBACK_HARD_MAX_STREAMS: Final = 6

# Options. Phase 5b: start deep in recordings over the Reolink protocol.
CONF_BAICHUAN_DEEP_START: Final = "baichuan_deep_start"
# On unless turned off (Phase 5c): devices that refuse it are found out.
DEFAULT_BAICHUAN_DEEP_START: Final = True
# Phase 8: the detection journal, "Learn what is normal" (off by default).
CONF_LEARN_NORMAL: Final = "learn_normal"
DEFAULT_LEARN_NORMAL: Final = False
# Phase 8 step 2: how much is marked unusual (unusual/const.py's
# sensitivities) and what a camera is compared with (its scopes).
CONF_UNUSUAL_SENSITIVITY: Final = "unusual_sensitivity"
CONF_UNUSUAL_SCOPE: Final = "unusual_scope"
# Phase 8: house-wide signals (anyone home, the alarm...) learned with, by entity id.
CONF_UNUSUAL_SIGNALS: Final = "unusual_signals"

# Playback caches (under HA's cache directory) and their size caps.
VOD_CACHE_DIR: Final = "vod"
# Our go2rtc's config file (no secret in it) and a downloaded binary, if any.
GO2RTC_DIR: Final = "go2rtc"
THUMB_CACHE_DIR: Final = "thumbs"
# Each camera's last picture (live tiles show it at once).
LIVE_IMAGES_DIR: Final = "live_images"
VOD_CACHE_MAX_BYTES: Final = 8 * 1024**3
THUMB_CACHE_MAX_BYTES: Final = 256 * 1024**2

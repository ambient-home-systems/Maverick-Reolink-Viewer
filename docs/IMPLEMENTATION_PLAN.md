# Maverick Reolink Viewer — Phased Implementation Plan

Companion to [PLAN.md](PLAN.md), which holds the research and the architecture
rationale. This document turns it into phases with tasks, exit criteria and risks.

Estimates are rough, in weeks of focused effort for one developer, and assume real
Reolink hardware is available for testing.

Each phase carries a **difficulty** rating used to pick how much reasoning power to
put on it:

- **Standard:** well-specified UI, CRUD and test work.
- **High:** multi-component design, HA internals, concurrency.
- **Very high:** novel engineering with little prior art (custom media player,
  protocol reverse-engineering).

| Phase | Outcome | Difficulty | Estimate |
| --- | --- | --- | --- |
| 0 | Foundations, CI, adapter layer, hardware discovery | High | 1–2 wk |
| 1 | Device details and every setting, with explanations | Standard (catalog) / High (panel shell) | 2–3 wk |
| 2 | Event timeline, thumbnails, smooth playback | High (backend) / Very high (player) | 3–5 wk |
| 3 | Live view via go2rtc, grid, fullscreen, PTZ | High | 3–4 wk |
| 4 | Performance, mobile, packaging, first release | Standard | 2–3 wk |
| 5 | Optional R&D: Baichuan live/playback | Very high | 4–8 wk, time-boxed with gates |

Phases 1 and 2 can overlap once Phase 0 is done. Phase 5 can start any time after
Phase 0 as a separate track.

---

## Target repository layout

```
custom_components/reolink_viewer/
  manifest.json          # domain, dependencies: reolink, http, websocket_api, panel_custom
  __init__.py            # setup: panel, static paths, websocket commands, views
  const.py
  bridge.py              # ONLY module allowed to touch Reolink integration internals
  scheduler.py           # per-host request queue, concurrency limits, priorities
  websocket_api.py       # reolink_viewer/* websocket commands
  views.py               # signed HTTP views: thumbnails, VOD stream, MSE proxy
  timeline.py            # VOD search, merge, caching
  thumbnails.py          # snapshot_past + disk LRU cache
  vod.py                 # VOD method selection, ffmpeg remux to fMP4
  live/                  # go2rtc lifecycle, stream registry, signaling
  catalog/               # categories.json, settings-catalog.json
  frontend_dist/         # built panel bundle (generated, shipped in releases)
frontend/
  src/                   # Lit + TypeScript panel
  vite.config.ts
tests/                   # pytest-homeassistant-custom-component
hacs.json
docs/
```

## Cross-cutting rules (apply to every phase)

1. **Single adapter.** Only `bridge.py` imports from or reads
   `homeassistant.components.reolink` / `config_entry.runtime_data`. It runs a
   compatibility check at startup and exposes a typed API to the rest of the code.
   If the check fails, the panel shows a banner and runs in degraded mode on public
   entities, actions and the media source.
2. **Scheduler for all device I/O.** Every call to a camera goes through `scheduler.py`
   with a per-host concurrency limit, in-flight de-duplication and priorities:
   live > playback > settings > thumbnails > prefetch.
3. **No secrets in the browser.** Camera URLs carry credentials. The browser only sees
   HA websocket messages and short-lived signed URLs (`async_sign_path`).
4. **HA state is the truth for settings.** Writes go through standard HA actions;
   reads come from `hass.states` and entity registry subscriptions.
5. **Load entries at request time.** Look up loaded Reolink config entries on each
   request (`async_loaded_entries`), never cache them, so reloads and restarts of the
   Reolink integration are handled.
6. **Measure, don't guess.** Every media path records time-to-first-byte and
   time-to-first-frame; a hidden debug panel shows them.

## Testing strategy

- **Backend:** `pytest-homeassistant-custom-component`, with a mocked
  `reolink_aio.api.Host` modeled on the fixtures in HA core's
  `tests/components/reolink`. Target coverage: bridge, scheduler, timeline merge,
  VOD selection, signing.
- **Frontend:** Vitest for timeline math, the player state machine, catalog lookups
  and codec detection.
- **End to end:** Playwright (Chromium is available in dev containers) against a dev HA
  with a fake device: go2rtc serving a test file as the "live" source and a small fake
  VOD server.
- **Hardware-in-the-loop checklist** run before each release on every owned model:
  standalone camera, NVR channel, Home Hub, battery camera (if owned), H.265 camera.
- **CI:** ruff, mypy, pytest, `hassfest`, HACS validation, frontend lint, typecheck,
  tests and build.

---

## Phase 0 — Foundations and hardware discovery (difficulty: High, 1–2 wk)

Goal: a working skeleton and hard numbers from the actual cameras, so later phases are
built on measured behavior rather than assumptions.

Tasks:

1. **Scaffold** the repo layout above, `manifest.json`, `hacs.json`, and an empty
   config flow (single instance, no options yet).
2. **CI** with the checks listed under Testing strategy.
3. **Dev environment:** devcontainer or venv with HA dev, connected to the real
   Reolink integration on a test instance.
4. **`bridge.py`**: list loaded Reolink entries, hosts, channels; expose a typed view of
   `host.api` capabilities; compatibility check with clear error messages.
5. **Panel shell:** register a sidebar panel with `panel_custom.async_register_panel`
   (`module_url` served via `hass.http.async_register_static_paths` +
   `StaticPathConfig`) showing a device list from the bridge.
6. **Probe command** `reolink_viewer/probe` (admin only) that records, per device:
   - model, firmware, NVR/Hub/battery flags, channels, main/sub encodings
   - which live sources work (RTSP, RTMP, HTTP-FLV for main/sub/ext) and their
     time-to-first-frame
   - which VOD methods work (`PLAYBACK`, `DOWNLOAD`, `NVR_DOWNLOAD`, `FLV`, `RTMP`)
     and their time-to-first-byte
   - whether Baichuan event search and `snapshot_past` work, and their latency
   - how many concurrent streams/sessions the device tolerates before refusing
7. **`docs/hardware-matrix.md`**: one row per owned model, filled from the probe.

Exit criteria:

- Probe runs cleanly on every owned device and the hardware matrix is filled in.
- Recorded decisions: default live source per model, VOD method per device type,
  H.265 strategy, per-host concurrency limits.
- CI green; the panel appears in the sidebar and lists devices.

Risks: the Reolink integration's internals differ from what was researched → the
bridge's compatibility check catches it on day one.

## Phase 1 — Device details and every setting (difficulty: Standard / High, 2–3 wk)

Goal: the most useful, lowest-risk feature first.

Backend:

1. `reolink_viewer/devices` — devices grouped by config entry → NVR/Hub → channel, with
   device registry info and a curated subset of diagnostics: model, hardware and
   firmware, encodings, Wi-Fi signal, ports and protocols enabled, storage, battery,
   capabilities.
2. `reolink_viewer/device` — full details for one device, including the entities
   grouped by category.
3. **`catalog/categories.json`** mapping every `translation_key` to a category.
4. **`catalog/settings-catalog.json`** keyed by `translation_key`: title, summary, what
   it does, trade-offs, related keys, hardware requirements, source link.
   - Must cover all ~175 keys in the integration's `strings.json`.
   - A CI test loads the installed Reolink integration's `strings.json` and fails on
     any key missing from the catalog, so new HA releases surface new settings
     immediately.

Frontend:

1. Device page with tabs: Overview, Settings (Live and Playback added later).
2. Settings rendered per domain: switch → toggle; number → slider plus input with
   min/max/step/unit; select → dropdown; button → action, with confirmation for
   destructive ones such as reboot; light, siren, time.
3. Each setting shows its explanation inline (collapsed by default), plus a search box
   across all settings and a "show disabled entities" toggle with an enable action
   (admin only, via the entity registry).
4. Optimistic updates with rollback and a toast on failure; live updates via entity
   subscriptions.
5. Use HA theme CSS variables, so light and dark mode match HA.

Exit criteria:

- Every entity of every owned device appears in the right category, with a catalog
  description.
- Changing a setting updates the camera and the UI without a reload, and failures roll
  back visibly.
- The settings tab renders in under 300 ms from navigation on a mid-range phone.

## Phase 2 — Event timeline and playback (difficulty: High backend / Very high player, 3–5 wk)

Goal: Reolink-app-quality playback with on-camera AI detections.

Backend:

1. `reolink_viewer/timeline/days` — recording days for a month (calendar dots).
2. `reolink_viewer/timeline/day` — for one channel and day: recording segments plus
   events with type and exact start/end, from `request_vod_files`.
   - Past days are cached permanently (HA `Store`).
   - Today uses a 60 s TTL, refreshing only the new time window.
3. **Thumbnails view** `/api/reolink_viewer/thumb/...` — `baichuan.snapshot_past`
   behind the scheduler at thumbnail priority, with a disk LRU cache, in-flight
   de-duplication and signed URLs.
4. **VOD view** `/api/reolink_viewer/vod/...` — picks the VOD method from the hardware
   matrix and streams fragmented MP4:
   - native MP4 is passed through with HTTP range support
   - FLV/RTMP is remuxed with ffmpeg `-c copy -movflags frag_keyframe+empty_moov+default_base_moof`
   - seek by file plus offset
5. **Optional H.265 → H.264 transcode** (opt-in setting; hardware acceleration when
   available), with a warning about CPU cost.

Frontend:

1. **Timeline component** (canvas, not a heavy timeline library):
   - zoom levels 24 h → 1 h → 5 min; recording bars; colored event markers per type
   - filter chips per event type; hover thumbnails; drag to scrub
   - previous/next event buttons; a calendar with recording-day dots
2. **Event list view:** cards with thumbnail, type, time and duration.
3. **Continuous MSE player:**
   - a state machine (idle → loading → playing → buffering → seeking → error)
   - prefetches the next segment before the current one ends and appends it, skipping
     gaps, so a day plays as one stream
   - playback speeds 0.5×–8×
   - sub stream while scrubbing; main stream when paused or fullscreen, only if
     `MediaSource.isTypeSupported` accepts the codec (`avc1` / `hvc1` / `hev1`)
   - trims its buffer so long sessions don't leak memory
4. **Download clip** button (MP4).

Exit criteria (LAN, measured with the debug panel):

- Timeline visible in under 1 s for a cached day, under 3 s cold.
- Clicking an event starts video in under 2 s on the sub stream.
- Playback crosses file boundaries with no visible gap.
- Filters, speed control and the main/sub switch work on a standalone camera and an
  NVR channel (and a Home Hub, if owned).
- A one-hour playback session shows no memory growth beyond the buffer cap.

Risks:

- The NVR "prepare download" step is slow → prefer FLV or PLAYBACK where the matrix
  shows they work, and prefetch.
- Thumbnail floods → scheduler priorities and caching.
- H.265 → codec detection plus fallback paths.

## Phase 3 — Live view (difficulty: High, 3–4 wk)

Goal: live video that is reliably faster than the stock HA UI.

1. **go2rtc lifecycle:** reolink_viewer downloads a pinned go2rtc release on first run,
   verifies its checksum, and runs it as a supervised subprocess bound to localhost,
   with its own generated config and API credentials.
   - Do not reuse HA's managed go2rtc: its config, credentials and API allow-list are
     owned by HA.
   - Packaging go2rtc as an HA app for HA OS users is a Phase 4 option.
2. **Stream registry:** one stream per channel and stream type, sources chosen from the
   hardware matrix:
   - HTTP-FLV for sub streams; RTSP for 4K/H.265 main streams
   - `ffmpeg` audio AAC → Opus for WebRTC
   - credentials sourced from `reolink-aio`, never exposed
   - streams re-registered when a Reolink entry reloads
3. **Signaling:** websocket command `reolink_viewer/live/webrtc` relays the SDP offer
   and answer to go2rtc's `/api/webrtc`, with trickle ICE. MSE fallback goes through
   an authenticated HA view proxying go2rtc's `/api/ws`.
4. **Frontend:**
   - live grid on sub streams, with the latest snapshot as poster and a fade-in
   - fullscreen that starts the main stream in the background and swaps it in on its
     first frame
   - PTZ overlay (buttons, presets, zoom/focus) using existing entities and
     `reolink.ptz_move`
   - quick toggles for siren and floodlight
   - battery cameras: no pre-warming; show "waking camera" state
5. **Keep warm (optional per camera):** go2rtc `/api/preload` for favorite mains-powered
   cameras.
6. **Remote access:** document TURN setup; fall back to MSE through HA when WebRTC
   can't connect.

Exit criteria:

- Grid of all owned cameras shows live video within 1.5 s on LAN.
- A 24-hour soak test with the grid open has no reconnect loops and no growth in device
  sessions.
- Camera CPU and session counts stay within the Phase 0 limits.
- Battery cameras sleep normally when not viewed.

Risks:

- Per-model protocol quirks → the hardware matrix and per-camera source override.
- Remote WebRTC → TURN or MSE fallback.
- Two-way audio support on Reolink is uncertain → deferred.

## Phase 4 — Performance, mobile, packaging, release (difficulty: Standard, 2–3 wk)

1. **Performance budget:**
   - initial panel JS under 200 KB gzipped, with other tabs code-split
   - no long tasks over 50 ms during timeline scrubbing
   - documented time-to-first-frame figures for live and playback
2. **Mobile:** HA Companion app testing, touch gestures on the timeline,
   picture-in-picture, lower default bitrates on cellular.
3. **Error states:** camera offline, battery asleep, no storage, unsupported codec,
   Reolink integration internals changed (bridge banner).
4. **Accessibility:** keyboard navigation and labels; respect reduced-motion.
5. **Packaging:**
   - HACS releases with a built frontend
   - an HA version compatibility matrix
   - optional HA app repository for go2rtc and hardware transcoding
6. **Docs:** user guide, troubleshooting, per-model notes from the hardware matrix.

Exit criteria: first tagged release installs via HACS on a clean HA instance and
passes the hardware-in-the-loop checklist.

## Phase 5 — Optional R&D: Baichuan media (difficulty: Very high, 4–8 wk, gated)

Goal: close specific gaps the HTTP/FLV/RTSP paths can't. Targets: battery cameras
without RTSP/FLV, models with broken RTSP/FLV, fast-forward and frame-accurate
scrubbing.

1. **5a — Capture and document (gate after ~2 wk):**
   - Capture the Reolink desktop client with Wireshark and neolink's Baichuan
     dissector, decrypting with your own credentials.
   - Document the playback start/seek/speed/stop sequence and frame format in
     `docs/baichuan-playback.md`.
   - Go/no-go: is the sequence understood well enough to replay?
2. **5b — Prototype:** a Python module on top of `reolink-aio`'s Baichuan connection
   (check its session impact first) that streams frames and muxes them to fragmented
   MP4. Do live first, then playback.
3. **5c — Integrate:** expose it as a go2rtc `exec`/pipe source and as a VOD method
   selectable per camera in the hardware matrix.
4. **5d — Upstream:** propose the playback commands to `reolink-aio` (MIT) and
   coordinate with its maintainer, so HA itself benefits and maintenance is shared.

Guardrails:

- Clean-room from your own captures; copy no neolink code (AGPL-3.0). neolink may be
  used as a separate process.
- Test only against devices you own.

Exit criteria: for at least one target model, Baichuan playback starts faster or seeks
more precisely than the Phase 2 path, measured with the debug panel.

---

## Definition of done (per phase)

- Exit criteria met and measured.
- CI green; new code covered by tests at the level described in Testing strategy.
- Hardware-in-the-loop checklist run on owned devices.
- Docs updated: this plan (status), the hardware matrix, the user guide where relevant.

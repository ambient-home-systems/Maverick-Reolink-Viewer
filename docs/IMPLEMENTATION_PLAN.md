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

| Phase | Outcome | Difficulty | Estimate | Status |
| --- | --- | --- | --- | --- |
| 0 | Foundations, CI, adapter layer, hardware discovery | High | 1–2 wk | Done (2026-10-17); one optional re-probe listed under Phase 0 decisions |
| 1 | Device details and every setting, with explanations | Standard (catalog) / High (panel shell) | 2–3 wk | Not started |
| 2 | Event timeline, thumbnails, smooth playback | High (backend) / Very high (player) | 3–5 wk | Not started |
| 3 | Live view via go2rtc, grid, fullscreen, PTZ | High | 3–4 wk | Not started |
| 4 | Performance, mobile, packaging, first release | Standard | 2–3 wk | Not started |
| 5 | Optional R&D: Baichuan live/playback | Very high | 4–8 wk, time-boxed with gates | Not started |

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

### Phase 0 status (2026-10-17)

| Task | Status |
| --- | --- |
| 1. Scaffold, `manifest.json`, `hacs.json`, single-instance config flow | Done |
| 2. CI: ruff, mypy (strict), pytest + coverage, hassfest, HACS, frontend lint/typecheck/test/build, committed-bundle check, weekly run against the newest HA | Done |
| 3. Dev environment | Done: `scripts/setup_dev.sh` (venv); see [DEVELOPMENT.md](DEVELOPMENT.md) |
| 4. `bridge.py` with compatibility check, repair issue and degraded mode | Done |
| 5. Panel shell (`panel_custom` + `StaticPathConfig`) listing devices | Done |
| 6. `reolink_viewer/probe` (admin) + "Run probe" button with JSON download | Done |
| 7. `docs/hardware-matrix.md` template + `scripts/probe_to_matrix.py` | Done; matrix waits on the first probe report |
| Exit: probe run on every owned device, matrix filled, decisions recorded | Done: first run 2026-10-17 on the RLN36 NVR (6 channels) and 3 directly added cameras; see [hardware-matrix.md](hardware-matrix.md) |

How the probe stays safe:

- It never changes settings. reolink-aio's `get_vod_source(..., RTMP)` turns the RTMP
  port on when it is off (`set_net_port(enable_rtmp=True)`), so the bridge refuses RTMP
  VOD unless the port is known to be on, and the probe reads the port state with the
  read-only `GetNetPort` when it is unknown.
- Battery cameras are skipped unless "include battery cameras" is ticked.
- The concurrent-stream test is opt-in, capped at 6 (default 4), opens sub streams
  1, 2, … at once, stops at the first failing level, waits between levels and runs as
  one exclusive scheduler job.
- All device traffic goes through the scheduler at the lowest (prefetch) priority.
- The report drops URLs entirely and redacts passwords, tokens, UIDs, serial numbers
  and MAC addresses (both by key and by value).

Verified against HA core `dev` (2026.11.0.dev0) and the 2026.10.1 release, both
pinning `reolink-aio==0.21.18`. Differences from [PLAN.md](PLAN.md) and assumptions
worth knowing:

- **Schemas use `probatio`, not voluptuous.** HA replaced voluptuous with `probatio`
  in 2026.9, so this integration requires HA 2026.10.0+ (the tested release) and ruff
  bans `voluptuous` imports.
- **Python 3.14.2+** is required (HA's minimum).
- HA `dev` lets `async_setup_entry` / `async_unload_entry` return `None` (the Reolink
  integration already does); custom integrations may still return a bool, which works
  on both 2026.10 and dev.
- `runtime_data` is as researched: `ReolinkData(host, device_coordinator,
  firmware_coordinator)` with `host.api` the logged-in `reolink_aio.api.Host`. The
  bridge checks this shape plus every `Host` / `Baichuan` attribute it uses.
- On NVRs reolink-aio silently replaces an RTMP VOD request with FLV (logging a
  warning), so RTMP VOD is "not applicable" on NVRs rather than a separate method.
- `NVR_DOWNLOAD` takes `"<start>_<end>"` time ids instead of a file name and runs an
  `NvrDownload` "prepare" request first; the probe records that as `prepare_ms`.
- HA's own media browser picks RTMP VOD for non-`.mp4` files on standalone cameras,
  which also goes through `get_vod_source(RTMP)` and can turn the RTMP port on. Worth
  knowing when reading port states.
- `baichuan.snapshot_past` needs the ffmpeg binary (it decodes an I-frame to JPEG), so
  `ffmpeg` is a manifest dependency.
- The HTTP-FLV URL passes the RTMP port, so FLV may depend on the RTMP service. The
  probe does not assume this: it tries FLV even when the RTMP port is off.
- `panel_custom.async_register_panel` gained a `handle_safe_area` option (defaults are
  fine for now; revisit for the iOS app in Phase 4).

### Phase 0 decisions

Recorded 2026-10-17 from the first probe run (evidence in
[hardware-matrix.md](hardware-matrix.md)). Owned hardware: an RLN36 NVR with a
Reolink Duo 3 PoE, two RLC-520A, an E1 Pro, a CX410 and a CX810; the CX410 and CX810
are also added to HA directly; an E1 Zoom is added directly only. No battery cameras,
Home Hubs or doorbells.

| Decision | Value | Evidence |
| --- | --- | --- |
| Default live source per model | **RTSP for main and sub on every model** (Duo 3 PoE, RLC-520A, E1 Pro, CX410, CX810, E1 Zoom), via the NVR or directly. **HTTP-FLV for `ext`** (RTSP has no `ext`) and as the fallback when RTSP fails. RTMP is not used. | RTSP main was the fastest on every channel (1.7–2.8 s vs 2.1–4.7 s); sub streams took 2.2–9.7 s on every protocol, set by the key-frame interval rather than the protocol; RTMP is off on the directly added cameras and offers no gain. |
| VOD method per device type | **NVR: `DOWNLOAD`** (MP4 over HTTP). Not `PLAYBACK` (404), not `NVR_DOWNLOAD` (2–18 s prepare, then disconnects, and leaves the NVR busy). NVR `FLV` VOD is unconfirmed, so it's not used until a re-probe. **Standalone cameras and Home Hubs: no decision**: none owned record locally. | DOWNLOAD's first byte arrived in 158–394 ms on all 6 channels, main and sub. |
| H.265 strategy | **No transcoding by default.** Grid and timeline scrubbing use sub streams (H.264 everywhere). HD view: use the H.265 main only when the browser says it can decode it at that resolution (`MediaCapabilities.decodingInfo` with the real width/height; Safari and the iOS Companion app decode HEVC in hardware); otherwise use the H.264 `ext` stream. The Duo 3's 7680×2160 main exceeds the 4096-pixel width limit of many hardware decoders, so its default HD stream is `ext` (2560×720). An opt-in VAAPI/QSV H.265→H.264 transcode on the x86 host stays a Phase 4 option. | 4 of 9 main streams are H.265 (Duo 3, RLC-520A "Garage", CX810, E1 Zoom); every sub and ext stream is H.264. |
| Per-host concurrency limit | **NVR: 4. Standalone cameras: 3.** (The scheduler default stays 2 for unknown device types.) Revisit after a re-probe with up to 6 streams. | 4 simultaneous FLV sub streams worked on the NVR and on each direct camera with no failures, so 4 is a floor. |

Consequences for later phases:

- **Cold live start is 2–10 s on every protocol.** Instant-feeling live view (Phase 3)
  depends on showing a snapshot first and keeping favourite streams warm in go2rtc.
  Shortening the sub stream's I-frame interval would also help, but that's a camera
  setting and the owner's choice.
- **Playback (Phase 2)** builds on NVR `DOWNLOAD`. Not yet measured: whether it
  honours HTTP `Range` for seeking, and how fast it starts mid-file. The probe read
  only the first 64 KB.
- **Thumbnails:** `snapshot_past` answers in 160–300 ms, fast enough for timeline
  hover previews through the thumbnail queue.
- **Day searches take 1–4 s per channel**, so the planned timeline caching is
  required, not optional.
- **Duplicate cameras:** the CX410 and CX810 appear twice (via the NVR and directly).
  Phase 1 should group them as one camera. Live view may use either source; playback
  must use the NVR.
- The E1 Zoom has no recordings anywhere the integration can see, so it gets live
  view only.

Optional follow-up: re-run the probe on this build with **Test concurrent streams =
6**. It settles NVR FLV VOD (now tested before `NVR_DOWNLOAD`) and finds the real
stream ceiling.

Owner's setup (answers to PLAN.md's open decisions, 2026-10-17):

| Question | Answer | Consequence |
| --- | --- | --- |
| HA install type and version | Latest HA on an x86 mini PC | x86 → hardware H.265 transcode via VAAPI/QSV is plausible if needed |
| Topology | Most cameras via an NVR | `NVR_DOWNLOAD` / `DOWNLOAD` / FLV are the VOD paths that matter; NVR session limits drive the scheduler limit |
| Main-stream codecs | Mostly H.264, one or two H.265 | Sub streams (H.264) for grids and scrubbing; H.265 main only where the browser decodes it |
| Remote access | Yes: Nabu Casa and Tailscale | WebRTC needs TURN over Nabu Casa; Tailscale gives a direct path; MSE-through-HA fallback required |
| Viewing | Desktop browser and HA Companion app on iOS | iOS (Safari/WKWebView) decodes H.265 natively; touch-first timeline matters |

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
   matrix (NVR: `DOWNLOAD`, see Phase 0 decisions) and streams fragmented MP4:
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
   - RTSP for main and sub streams, HTTP-FLV for `ext` and as the fallback (Phase 0
     decision; the original plan of HTTP-FLV for sub streams didn't hold up)
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

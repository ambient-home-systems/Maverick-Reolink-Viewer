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
| 0 | Foundations, CI, adapter layer, hardware discovery | High | 1–2 wk | Done (2026-10-17) |
| 1 | Device details and every setting, with explanations | Standard (catalog) / High (panel shell) | 2–3 wk | Done (2026-10-17) |
| 2 | Event timeline, thumbnails, smooth playback | High (backend) / Very high (player) | 3–5 wk | In progress: 2A done (2026-10-20, v0.2.7: timeline 105–287 ms, first frame 0.6–1.1 s, auto-advance 6–7 ms on hardware). 2B: cache fixed (v0.2.8), measuring (gate): two desktop runs done, three bugs fixed (v0.2.9, v0.2.10) |
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
| Exit: probe run on every owned device, matrix filled, decisions recorded | Done: two runs on 2026-10-17 on the RLN36 NVR (6 channels) and 3 directly added cameras; see [hardware-matrix.md](hardware-matrix.md) |

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

Recorded 2026-10-17 from two probe runs (evidence in
[hardware-matrix.md](hardware-matrix.md)). Owned hardware:

- an RLN36 NVR with a Reolink Duo 3 PoE, two RLC-520A, an E1 Pro, a CX410 and a CX810;
- the CX410 and CX810 are also added to HA directly, only to get better streaming;
  the owner may remove those direct entries once live view through the NVR is good;
- an E1 Zoom added directly only. It doesn't record by design: it's used for
  snapshots of the washer/dryer panels.

There are no battery cameras, Home Hubs or doorbells.

| Decision | Value | Evidence |
| --- | --- | --- |
| Default live source per model | **RTSP for main and sub on every model** (Duo 3 PoE, RLC-520A, E1 Pro, CX410, CX810, E1 Zoom), via the NVR or directly. **HTTP-FLV for `ext`** (RTSP has no `ext`) and as the fallback when RTSP fails. RTMP is not used. | RTSP main was the fastest on 17 of 18 samples (1.5–3.0 s vs 2.1–4.7 s). RTSP sub beat FLV on 12 of 18 samples (4 slower, 2 ties). Sub streams take 1.7–9.7 s on every protocol, set mostly by the key-frame interval. RTMP is off on the directly added cameras and offers no gain. |
| VOD method per device type | **NVR: `DOWNLOAD`** (MP4 over HTTP). Not `PLAYBACK` (404), not `FLV` (the NVR disconnects it, even when it runs first), not `NVR_DOWNLOAD` (2–18 s prepare, then disconnects, and leaves the NVR busy). **Standalone cameras and Home Hubs: no decision**: none owned record locally. | DOWNLOAD's first byte arrived in 157–649 ms on all 6 channels, main and sub, in both runs. |
| H.265 strategy | **No transcoding by default.** Grid and timeline scrubbing use sub streams (H.264 everywhere). HD view: use the H.265 main only when the browser says it can decode it at that resolution (`MediaCapabilities.decodingInfo` with the real width/height; Safari and the iOS Companion app decode HEVC in hardware); otherwise use the H.264 `ext` stream. The Duo 3's 7680×2160 main exceeds the 4096-pixel width limit of many hardware decoders, so its default HD stream is `ext` (2560×720). An opt-in VAAPI/QSV H.265→H.264 transcode on the x86 host stays a Phase 4 option. | 4 of 9 main streams are H.265 (Duo 3, RLC-520A "Garage", CX810, E1 Zoom); every sub and ext stream is H.264. |
| Per-host concurrency limit | **NVR: 6. Standalone cameras: 3.** The scheduler default stays 2 for unknown device types. Applied when Phase 2 adds the first real traffic. | The NVR opened 6 simultaneous sub streams on one channel in ~2.7 s each, with no slowdown (6 is the probe's maximum). The direct cameras also reached 6, but slowed down from 4 streams (CX810: 3.6 s to 7.7 s). |

Consequences for later phases:

- **Cold live start is 2–10 s on every protocol.** Instant-feeling live view (Phase 3)
  depends on showing a snapshot first and keeping favourite streams warm in go2rtc.
  Shortening the sub stream's I-frame interval would also help, but that's a camera
  setting and the owner's choice.
- **Playback (Phase 2)** builds on NVR `DOWNLOAD`. Not yet measured: whether it
  honours HTTP `Range` for seeking, and how fast it starts mid-file. The probe read
  only the first 64 KB.
- **Thumbnails:** `snapshot_past` answers in 160–490 ms, fast enough for timeline
  hover previews through the thumbnail queue.
- **Day searches take 1–5 s per channel**, so the planned timeline caching is
  required, not optional.
- **Duplicate cameras:** the CX410 and CX810 appear twice (via the NVR and directly).
  Phase 1 should group them as one camera, and playback must use the NVR. Phase 3
  should measure live view through the NVR against the direct connection, so the
  owner can decide whether to drop the direct entries.
- **NVR limits not measured:** the stream test ran on one NVR channel. The NVR's
  total across all channels (6 sub streams for a grid, plus a main for full screen)
  is still unmeasured. Phase 3 adds a multi-channel test before the grid ships.
- **E1 Zoom:** snapshot-only by design, so it gets snapshots and live view. Phase 1
  should make snapshots the primary view for it.

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

### Phase 1 status (2026-10-17)

Done in v0.1.0. The owner ran the hardware checklist below on 2026-10-17 and every
item passed.

| Task | Status |
| --- | --- |
| Phase 0 fixes: per-host probe errors (TaskGroup), guarded media jobs, redacted probe error, `IncompatibleError` before the ack | Done |
| Backend 1. `reolink_viewer/devices`: NVRs/Hubs → cameras, registry info, curated details from cached data (no new device I/O) | Done |
| Backend 2. `reolink_viewer/device`: details and every Reolink entity per connection (entity_id, domain, translation_key, entity_category, disabled_by, hidden_by), each mapped to a category | Done |
| Backend 3. Duplicate cameras merged in the bridge (camera UID, serial or MAC); opaque group ids; NVR connection marked as playback source | Done |
| Backend 4. `catalog/categories.json` and `catalog/settings-catalog.json`: 193 keys (188 strings.json keys + 5 entities without a strings entry) | Done: 182 verified, 11 marked unverified |
| Backend 5. Coverage test against the installed integration's `strings.json` and its entity descriptions | Done (`tests/test_catalog.py`) |
| Frontend 1. Device list (NVR → channels, direct cameras, duplicates merged); Overview with snapshot (primary view for cameras that don't record) | Done |
| Frontend 2. Settings per category and domain, inline explanations, search, confirmation for disruptive actions | Done |
| Frontend 3. Writes through standard HA actions; optimistic update, rollback with message, live via state updates | Done |
| Frontend 4. "Show disabled entities" + Enable (admin, entity registry), with the reload explained | Done |
| Frontend 5. HA theme variables, own small Lit controls (no `ha-*` form elements) | Done |
| Frontend 6. Re-render only on the shown device's state changes; Settings under 300 ms | Done: measured in a desktop browser (below); on the iPhone it felt fast (not timed) |
| Exit: every entity in the right category, a setting round-trips on real hardware, < 300 ms on a mid-range phone | Done: hardware checklist passed (2026-10-17) |

How it works, and what differs from the plan above:

- **Catalog keys are per domain.** Both JSON files are keyed by domain, then
  translation_key, like the integration's `strings.json`: `hdr` exists as both a
  select and a switch. Entities with no translation_key are matched by device class
  (`catalog.FALLBACK_KEYS`: motion, restart → `reboot`, battery, firmware), and
  `binary_sensor.tamper` has a translation_key but no strings entry. The test
  covers all three sources, so a new HA release with new entities fails CI.
- **Catalog entries** have title, summary, what it does, trade-offs, related keys,
  requirements, impact (`read_only`, `safe`, `disruptive` plus the direction that
  hurts: `on`, `off`, `any` or a list of select options) and sources. They were
  checked against HA's Reolink docs, the HA/reolink-aio source (which device
  setting each entity writes) and Reolink support articles. 11 entries are marked
  unverified because Reolink doesn't document them precisely: the face, bicycle and
  package AI delays, the face and bicycle AI sensitivities, baby-cry sensitivity,
  the item forgotten/taken delays, doorbell volume, `hardwired_chime_enabled`, and
  `switch.hdr` (a leftover string: HA 2026.10 creates no HDR switch, it's the select).
- **Device identity lives in the bridge.** Mapping registry devices to hosts,
  channels, lenses and chimes mirrors the Reolink integration's identifiers, so
  it is in `bridge.py`. `devices.py` uses only the public device and entity
  registries plus the bridge. Nothing secret reaches the browser: no unique ids,
  identifiers, serials, MACs or configuration URLs. Group ids hash entry ids and
  channels, never identifiers.
- **Merged cameras** list both connections. The NVR one is the primary (its device
  id is the camera's id) and the playback source. Settings default to the
  connection with the most entities, with a switch to the other. A camera that
  records nowhere (no NVR, no SD card, like the E1 Zoom) gets the snapshot as its
  primary view: the Overview shows it large and refreshes it every 30 s while
  open. Snapshots use HA's camera proxy (`entity_picture`), so they are HA's own
  device requests, not ours.
- **Degraded mode** builds the tree from the registry alone (no details, no
  merging); settings still work.
- **Measured** in Chromium (desktop, 1100×900) with 193 entities and a 20 ms fake
  websocket: from navigation to the painted Settings tab in 86–133 ms, with the
  settings element rendering in 25–46 ms. 200 unrelated state changes caused 0
  re-renders of the device page. The production bundle is 20 KB gzipped.

Hardware checklist (run by the owner on 2026-10-17 on the RLN36, CX410, CX810 and E1 Zoom; all passed):

1. Every entity shows up: for each device, the entity counts on the Overview
   match the device page under Settings → Devices & services → Reolink
   (including disabled ones), and no entity is under **Other**.
2. The CX410 and CX810 are each listed once under the RLN36 with a **+ direct**
   badge; their page shows two connections, the NVR one marked **playback source**.
3. The E1 Zoom is under **Cameras added directly** with the snapshot as its
   primary view.
4. One harmless round trip: toggle **Status LED** off and on; the camera's LED
   follows, the toggle never jumps back, and HA's own entity page shows the same
   state. (Rollback on failure is covered by tests.)
5. A disruptive action asks first (e.g. turning **Record** off → Cancel).
6. Settings opens in under 300 ms on the iPhone (Companion app). Result: felt
   fast, with no noticeable delay; not timed.

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

### Phase 2 status

Phase 2 is split in two parts. **2A**: timeline, thumbnails and simple playback
(`<video>` on a signed URL, auto-advance with the next file preloaded). **2B**: the
continuous MSE player, speeds and the remaining exit criteria.

Scope notes for 2A: playback exists only on the RLN36 NVR (VOD method `DOWNLOAD`,
Phase 0 decision); the directly added cameras don't record. Merged cameras (CX410,
CX810) play back through their playback-source connection (the NVR). The E1 Zoom
gets no Playback tab.

| 2A step | Status |
| --- | --- |
| 1. Measure (gate): opt-in **recording playback** check in the probe | Done: run 3 on 2026-10-17 (v0.1.1), see [hardware-matrix.md](hardware-matrix.md#recording-playback-download) |
| 1. Record the report in the matrix and choose the serving strategy | Done: **disk cache**, see "Serving strategy" below |
| 1. Follow-up check (v0.1.2): MP4 layout through the plain GET, server-side seek with `start=`, file-name shape, full-speed parallel downloads | Done: run 4 on 2026-10-17; the open questions are settled below |
| 2. Backend: scheduler limits + stream budget, event list from the bridge, timeline commands and cache, UTC conversion with DST, thumbnails, VOD and clip views | Done (v0.2.0): see "2A as built" below |
| 2. Frontend: Playback tab, canvas timeline, calendar, event list, simple player, debug panel | Done (v0.2.0): checked in Chromium with synthetic recordings (desktop and iPhone-sized layout) |
| Exit on LAN: timeline < 1 s cached, < 3 s cold | **Met** (v0.2.2, three cameras): today 49–198 ms, recent past days 56–126 ms from the background fetch, cached 54–276 ms. A day older than a week still costs the NVR's 4–6 s search on first open. v0.2.6 check: a day 3 days back was searched fresh (4.2 s) on two cameras. v0.2.7 check: 105–287 ms on two cameras, the past day from the store |
| Exit on LAN: clicking an event starts video in < 2 s on the sub stream | Short recordings: 521–605 ms (pass). Deep inside long recordings, v0.2.4: 1631–2842 ms in a 130 MB file and 1841–1944 ms in a 56 MB file (fail), still growing with file size. v0.2.5: 1231–3034 ms; Chrome reads the whole fragmented file first. **Met** (v0.2.6, two cameras): cached recordings served as plain MP4, 1106–1611 ms 9–56 min into hour-long recordings; v0.2.7: 590–1116 ms |
| Exit on LAN: auto-advance to the next file | **Met** (v0.2.3, three cameras): through the preloaded file, with gaps of 3, 5 and 80 ms |
| 2A complete | **Done** (2026-10-20, v0.2.7): all three exit criteria met together on the eighth hardware check, see below |

What the playback check measures (`probe_playback.py`, opt-in, read-only, every
request a prefetch-priority scheduler job, reads bounded in bytes and time, no URL
recorded), per channel and stream (main/sub), on one recent recording:

- HTTP Range: 206 + Content-Range for the first 2 bytes (Safari's first request), a
  mid-file range, an open-ended mid-file range (Chrome/Firefox seeking), a suffix
  range and the same tail as an explicit range; the tail bytes are compared.
- MP4 layout from a few Range requests (`mp4.py`): moov before or after mdat,
  fragmented or not, the tracks' sample entries (`avc1`/`hvc1`/`hev1`/audio) and
  sizes, and the MP4 duration against the search's.
- The duration, size, bitrate and gap distribution of the most recent complete day,
  plus that day search's latency (cold timeline cost).
- Time to first byte of the mid-file ranges; the sustained throughput of a plain GET
  (up to 6 s) and its ratio to the recording's bitrate.
- The recording's file name: whether it carries the `DST` marker and how its time
  compares with the search's; plus the device's time zone, UTC offset and DST
  offset (inputs for the UTC conversion).
- (Separate opt-in, exclusive, capped at 6, default 4) how many sub-stream DOWNLOADs
  on different channels the NVR serves at once while each is read at 4× its bitrate
  for 6 s, stopping at the first failing level.

How the serving strategy will be chosen from the report (decided before seeing
it, so the evidence picks):

- **Range passthrough** (the HA view forwards the browser's Range to the NVR and
  streams the answer) if every channel and stream answers all five ranges correctly
  with a Content-Length, mid-file TTFB stays well under the 2 s click-to-video
  budget, and the layout is one a browser plays (`moov` first, or `moov` last with
  working Range, which costs the browser one extra round trip).
- **ffmpeg remux (`-c copy`)** only for what the browser can't take as stored: e.g.
  `hev1`-tagged H.265 (Safari needs `hvc1`) or a layout that needs rewriting. Remux
  can't seek inside a file without Range, so it doesn't replace Range.
- **Download to a disk cache** (then serve the cached file with Range) if Range is
  missing or broken, or mid-file TTFB is too slow while throughput is many times
  real time (a whole file arrives in a fraction of its duration).
- The per-host **stream budget** (long-lived video streams counted apart from request
  slots) comes from the simultaneous-stream result, leaving headroom.

#### Serving strategy (decided 2026-10-17 from run 3)

Evidence: [hardware-matrix.md](hardware-matrix.md#recording-playback-download). The
rules above applied as follows:

- **Range passthrough: rejected.** The NVR ignored all 60 Range requests: `200` with
  the whole file, chunked, no Content-Length. The MP4 is built on the fly.
- **Download to a disk cache: chosen.** The server downloads the recording from the
  NVR at full speed (30–85× real time for main, 340–860× for sub) into a disk cache.
  It serves the browser from the cache through a short-lived signed URL, with HTTP
  Range, *while* the download runs:
  - a Range request for bytes already on disk is answered at once;
  - one past the downloaded part waits until the download reaches it.

  A sub event clip (2–6 MB, median 2–3 min) arrives whole 0.2–0.4 s after a first
  byte of about 140 ms. So clicking an event stays inside the 2 s budget whatever
  the MP4 layout. One download per file serves every viewer and every replay, and
  the download-clip endpoint reads from the same cache.
- **ffmpeg remux (`-c copy`): not on the serving path.** It is used only if v0.1.2
  finds something the browser can't play as stored (e.g. `hev1`-tagged H.265, which
  Safari refuses), as a rewrite of the cached file.
- **Cache budget.** Main recordings are big: event clips of 50–140 MB, one-hour
  continuous files of 2.4–2.8 GB, and up to 3.8 GB for the Duo 3. So the cache has
  a size cap with LRU eviction, sub is the default, and main is fetched only when
  asked for. Partial downloads are kept for reuse within the session and evicted
  first.
- **Stream budget.** A cache fill holds an NVR DOWNLOAD for a few seconds at full
  speed, so fills count against a separate per-host stream budget, not the request
  slots. **NVR: 4** (6 of 6 simultaneous DOWNLOADs worked; 2 are left as headroom,
  also for Phase 3 live view). **Other hosts: 2** (none record). The full-speed
  result from v0.1.2 can lower the NVR budget if two fills already saturate the link.

Settled by run 4 (v0.1.2):

1. **MP4 layout: fragmented, `moov` first.** Each DOWNLOAD is `ftyp`, a 1.1 KB
   `moov`, then 2 s `moof`+`mdat` fragments. So a browser can play a recording as
   soon as its first fragment is cached, whatever its length. The `mvhd` duration
   is a placeholder, so durations come from the search.
   - **Correction (2026-10-20, Phase 2B): the fragments are not MSE-ready as
     stored.** This item first said an MSE player could append them with no
     remux. It cannot. The W3C *ISO BMFF Byte Stream Format* (§ Media Segments)
     requires the user agent to run the append error algorithm when "the Movie
     Fragment Box does not use movie-fragment relative addressing" or "at
     least one Track Fragment Box does not contain a Track Fragment Decode
     Time Box (`tfdt`)". Relative addressing means every `traf` sets
     `default-base-is-moof` (so no `base-data-offset`), or a single `traf`
     without `base-data-offset`. The NVR's `moof`s hold two `traf`s (video and
     audio) whose `tfhd` gives an absolute `base_data_offset`, and no `traf`
     has a `tfdt` (third and fourth hardware checks). An MSE player therefore
     needs the fragments rewritten first (relative offsets, a `tfdt` built from
     the sample durations), or ffmpeg's `frag_keyframe+empty_moov+default_base_moof`.
2. **No server-side seek.** `start=` is ignored. Reaching the middle of a long
   recording means downloading what comes before it first, at 265–1000× real time
   on sub. A click on a 2–3 min event clip stays far inside the 2 s budget. On the
   continuous CX410/CX810 one-hour files, minute 30 needs 40–110 MB of sub first,
   about 2–5 s. To keep clicks fast there, the Playback tab warms the cache with the
   sub recording at the selected time on those cameras (prefetch priority, one fill
   at a time). The debug panel shows when a click had to wait for the fill.
3. **Codecs as stored are browser-ready.** H.265 is tagged `hvc1` and H.264 `avc1`,
   with AAC audio. So ffmpeg is not needed on the playback path at all. The codec
   string and size for `MediaCapabilities.decodingInfo` come from the cached file's
   `moov` (`avcC`/`hvcC`), and are remembered per camera and stream.
4. **Stream budget confirmed.** One main fill runs at about 408 Mbit/s and two
   share about 512 Mbit/s. So the NVR budget stays at 4 fills, but prefetch fills
   are limited to one at a time, leaving most of the bandwidth to the fill behind
   a click.
5. **File names and DST.** This NVR's names (`C-CH-S-<14 digits>-NNNNN`) carry no
   DST mark, and their 14-digit stamp is neither the local nor the UTC start time.
   Times are converted from camera-local time with the device's own DST rules:
   - **Repeated hour:** the hour repeated when clocks fall back is detected, and a
     recording in it is placed by a UTC timestamp only if one is proven to be UTC.
     Proven means it matches the UTC start time on every unambiguous recording of
     that search; the search's `PlaybackTime` and the name stamp are both checked.
   - **Otherwise:** the recording is placed at the first occurrence and flagged
     `ambiguous`, which the timeline shows.
   - **Skipped hour:** times in the hour skipped when clocks spring forward cannot
     occur and are mapped with the standard offset.

#### First hardware check (2026-10-19, v0.2.0, Chrome on the LAN)

Measured with `scripts/playback_check.js` on Front Yard Right (via the NVR):

| Check | Result | Server |
| --- | --- | --- |
| Today, as the tab opened | 1469 ms | incremental search |
| 2026-10-16, first open | 3830 ms | fresh search |
| 2026-10-16 again | 148 ms | memory |
| Event → first frame (3 events, files already cached) | 5264, 2259, 2190 ms | URL 54–167 ms |
| Auto-advance | not measured | no touching recordings |

Findings and fixes (v0.2.1):

1. **Slow first frame on cached files.** Given a fragmented MP4 without an
   index over HTTP Range, Chrome reads the whole file before it reports
   metadata. In Chromium tests on a 6 MB file at 50 Mbit/s, metadata took
   1.2 s. The NVR's recordings are larger, which explains 2–5 s.
   - **Fix:** the cache leaves room after `moov` while it downloads and writes
     one `sidx` per track there once the file is complete (`mp4index.py`). No
     recording byte moves. Files whose fragments use absolute offsets are left
     alone.
   - **Result:** on the same test file, first frame took 0.13–0.18 s instead of
     1.3–1.9 s. ffmpeg's own `global_sidx` gave 0.2–0.26 s.
   - Files cached by v0.2.0 are retired (cache layout 2).
2. **Today's timeline waited for the NVR.** Even an incremental search costs
   about 1.5 s. The panel now asks for a copy of today up to 15 minutes old
   (`max_age`), shows it at once, then refreshes it quietly. The panel warms
   today for every camera when it opens.
3. **Duplicate events.** The NVR sends one alarm record per detection type for
   the same moment (VEHICLE and MOTION at 9:17:28 were two events; 44 events
   for 11 recordings). Records of the same recording that start at the same
   second are now one event with all its types. Stored days of the old
   format are searched again.
4. **HD could never be enabled.** HD waited for the main stream's codec, which
   is learned only once a main recording has been cached. HD can now be tried
   before that; the player falls back to SD if the browser cannot play it.
5. **Cold day search (3.8 s).** Not changed yet. The server timing now
   separates the queue wait, the recording search and the event search, so
   the next run shows which part is slow.

#### Second hardware check (2026-10-19, v0.2.1, Chrome on the LAN)

| Camera | Today | Past day, first open (server) | Same day again | Events → first frame | Auto-advance |
| --- | --- | --- | --- | --- | --- |
| Front Yard Left | 53 ms (memory) | 5555 ms (recordings 3158, events 5476 ms) | 103 ms | no events today | — |
| Front Yard Right | 60 ms (stale copy, 119 s) | 4943 ms (recordings 2442, events 4882 ms) | 116 ms | no events today | no (27 min recording) |
| Back Yard | 154 ms (stale copy, 160 s) | 3894 ms (recordings 3815, events 1814 ms) | 148 ms | 3940, 233, 490 ms (downloading) | — |

Findings and fixes (v0.2.2):

1. **Seeking inside a recording that is still downloading starts at 0:00.**
   - While filling, the recording is streamed with no length, so the browser
     cannot seek in it. Reproduced in Chromium: a requested start of 3 s or
     80 s both began at 0.26 s.
   - This is why auto-advance failed: playback started 8 s before the end of
     a 27-minute recording and went to the beginning instead.
   - **Fix:** a start more than 3 s into a recording that is not cached asks
     for the whole file first. The server answers once the download is done,
     with Range and the segment index. Nearer the start, playback still
     begins while the file downloads. The debug panel's Delivery line shows
     which was used.
2. **Cold past days.** Both NVR searches are slow on their own: the recording
   search took 2.4–3.8 s and the event search 1.8–5.5 s. They already run in
   parallel, and the queue wait was 0.
   - **Fix:** when the panel opens, the last 7 days with recordings are
     fetched in the background for every camera, one search at a time at
     prefetch priority, yesterday first. They are kept for good, so each
     day is searched once.
3. **One slow first click (3940 ms, recording still downloading).** The other
   two clicks on that camera took 233 and 490 ms. Two cameras' checks ran at
   the same time on one NVR. The script now reports each download's queue
   wait, NVR first byte, download time and speed, and whether the index was
   written. It also warns against running two checks at once.

#### Third hardware check (2026-10-19, v0.2.2, Chrome on the LAN)

| Camera | Today | Past day, first open | Events → first frame (server) | Auto-advance |
| --- | --- | --- | --- | --- |
| Front Yard Right | 49 ms | 56 ms (stored by the background fetch) | 2717 ms, 35.5 min into a 204 MB file (cached, no index) | yes, gap 1586 ms |
| Back Yard | 198 ms (stale copy) | 100 ms (stored) | 706 ms (whole file first: download 493 ms), then 136 and 127 ms | no (12 s recording at midnight) |
| Front Yard Left | 152 ms (stale copy) | 126 ms (stored) | 976, 1517, 1034 ms, 39 min into a 59 MB file (cached, no index) | yes, gap 922 ms |

The NVR sends a recording's first byte in 126–147 ms and downloads at 44–211 Mbit/s. The queue wait was 0–5 ms.

Findings and fixes (v0.2.3):

1. **The NVR's recordings were never indexed.** Every download reported
   "index no: absolute data offsets": the NVR's track fragments give absolute
   file positions (`tfhd.base_data_offset`). Without an index Chrome reads the
   whole file first, which took 2.7 s for 204 MB.
   - **Fix:** while the file streams in, an `OffsetShifter` adds the size of
     the reserved room to every absolute offset. Each moof is held until it is
     complete; mdat bytes pass straight through. An `mfra` box is turned into
     `free`.
   - If a stream cannot be followed, that recording fails once and is then
     cached as it is.
   - Files cached before are retired (cache layout 3).
2. **Auto-advance gaps of 0.9–1.6 s** are likely the same cause: the next file
   was cached but not indexed, so Chrome read all of it at the switch.
3. **A failed event search lost events.** Today's refresh replaced its window's
   events with nothing when the NVR's event search failed (Front Yard Right
   reported `ApiError`). A past day whose event search failed was also stored
   for good without events.
   - **Fix:** the earlier events are kept and the window is searched again on
     the next refresh. Such a day is never final, so it is neither stored nor
     kept in memory for good. Days stored that way by older versions are
     searched again.
4. **Auto-advance "no" on Back Yard.** The cause is still unknown. The script
   now reports how auto-advance ended: through the preloaded file, by reloading,
   or stuck, with the player's state.

#### Fourth hardware check (2026-10-19, v0.2.3, Chrome on the LAN)

| Camera | Events → first frame | Recording (server) | Auto-advance |
| --- | --- | --- | --- |
| Front Yard Right | 2158, 2325, 5428 ms (18–23 min into a 24 min file) | 104 MB, indexed, cached | yes, preloaded, 3 ms |
| Front Yard Left | 1470, 1452, 1077 ms (22–23 min into a 25 min file) | 27 MB, indexed, cached | yes, preloaded, 5 ms |
| Back Yard | 521, 605, 572 ms (short recordings) | 1.6–2.5 MB, indexed | yes, preloaded, 80 ms |

The timeline stayed under 0.5 s everywhere. The exception was one past day on Front
Yard Right (5.3 s): its stored copy had a failed event search, so it was
searched again, as v0.2.3 intends.

**Slow start inside long recordings: found and fixed (v0.2.4).** Long
recordings carried an index, yet Chrome took 1–5 s to report metadata.

- **The file was fine.** `scripts/inspect_recording.js` on Front Yard Right's
  104 MB recording showed every `sidx` reference landing on a moof and ending
  at the file end.
  - Its fragments carry no `tfdt`, and they are 1 s long (timescale 150000).
  - Test files rebuilt that way, in H.264/AAC and in VP9/Opus, start from the
    index. With the index, ffmpeg reads 0.29 MB to start 21 minutes in,
    against 50 MB without it. Chromium reports metadata in 23 ms through
    aiohttp's `FileResponse`, as Home Assistant serves it.
- **The cause was the browser's connection limit.** Over plain HTTP, Chrome
  opens at most 6 connections to Home Assistant.
  - The event list asked for a page of thumbnails at once, and each thumbnail
    request waits while the server pulls a frame from the NVR.
  - The recording's range requests queued behind them. In the harness, with
    1.5 s thumbnails, the first event took 19.5 s to start.
- **Fix:** thumbnails load through a queue (`thumb-loader.ts`), two at a time.
  The queue pauses while a recording starts, until its first frame (8 s at
  most), and is cleared when the day changes. Thumbnails are cacheable, so
  each card then shows its image from the browser cache.
  - **Result:** the same harness started the first event in 131 ms.

#### Fifth hardware check (2026-10-19, v0.2.4, Chrome on the LAN)

| Camera | Events → first frame | Recording | Notes |
| --- | --- | --- | --- |
| Front Yard Left | 6149 (URL 3935 ms), 1944, 1841 ms | 56 MB, indexed | auto-advance gap 580 ms |
| Front Yard Right | 2842, 1631, 1714 ms | 130 MB, cached before a restart | auto-advance gap 0 ms |

Front Yard Right's first run showed no events: "event search failed (ApiError)".
Changing the day and back showed them. So the NVR's event search fails now
and then and works when asked again.

Findings and changes (v0.2.5):

1. **The play URL waited for an NVR search (3.9 s).** Finding the recording
   to play went through the day's 60 s refresh. It now uses the copy of the
   day in memory, and searches again only if the recording is not in it.
2. **Intermittent event search failures.**
   - The bridge asks once more after 1 s.
   - A copy of today whose event search failed is never served from memory
     or as a stale copy.
   - The panel asks again after 10 s, up to 3 times in a row.
   - The report names the device's code (e.g. "ApiError -12").
3. **Video start still grows with file size** (about 1 s plus 12 ms per MB,
   close to this LAN's transfer rate). That suggests Chrome reads the whole
   file, although files rebuilt like the NVR's start from the index in
   Chromium for H.264 (0.18 MB read) and VP9. The playback check now lists
   each video request Chrome makes for an event: when it started, how long it
   waited for a connection, the server's answer time and how long it ran.
   Recordings loaded from disk after a restart report whether they are
   indexed. If Chrome reads the whole file despite the index, the next step
   is to store cached recordings as plain (non-fragmented, `moov` first)
   MP4, which every browser seeks in at once.

#### Sixth hardware check (2026-10-20, v0.2.5, Chrome on the LAN)

| Camera | Events → first frame | Notes |
| --- | --- | --- |
| Front Yard Right | 2306, 12035, 3034 ms | first event: one request ran 2065 ms (97 MB, the whole file), then the seek request took 63 ms. Second event: not cached and 3 s or more in, so the whole file was downloaded first (answer 9811 ms) |
| Front Yard Left | 1231, 642, 4143 ms | today took 5916 ms (fresh search: the copy in memory had a failed event search) |

Auto-advance worked on both (gaps around 6 ms).

Findings and changes (v0.2.6):

1. **Chrome reads an indexed fragmented recording whole before it seeks.**
   The request list proves it: one transfer of the whole file, then the seek.
   Chromium on Linux used the index; the user's Chrome does not. So once a
   recording is cached, the server rewrites it as a plain MP4 (`remux.py`:
   `ffmpeg -c copy -movflags +faststart`, no re-encoding, one at a time, in
   the background).
   - Play URLs issued after the rewrite get the plain file; URLs issued
     before keep the original so a playing video's bytes don't change. The
     original is deleted 35 minutes later (after the longest URL lifetime).
   - If ffmpeg fails, the original stays in use; the cache reports why.
   - The playback check's `server:` line reports "plain MP4 yes" and the
     rewrite time.
2. **A failed copy of today cost 5.9 s.** v0.2.5 stopped serving it at all.
   It is now shown at once (as a stale copy) and searched again in the
   background.
3. **Not addressed yet:** an event 3 s or more into a recording that is not
   cached still waits for the whole download (about 10 s for 200 MB).

#### Seventh hardware check (2026-10-20, v0.2.6, Chrome on the LAN)

| Camera | Today | 2026-10-17 first / again | Events → first frame | Recording | Auto-advance |
| --- | --- | --- | --- | --- | --- |
| Front Yard Right | 232 ms (stale copy) | 4264 ms fresh / 223 ms | 1106, 1509, 1611 ms (55.6, 53.1 and 9.2 min in) | 199.8 MB, 60 min: download 10.1 s, plain MP4 rewrite 7.3 s | gap 6 ms |
| Front Yard Left | 588 ms (stale copy) | 4155 ms fresh / 650 ms | 1447, 1121, 1160 ms (52–56 min in) | 64.3 MB: download 3.2 s, rewrite 0.8 s | gap 8 ms |

- **Video start: met.** Every event started in 1.1–1.6 s, deep inside
  hour-long recordings. Chrome made one request and no longer read the
  whole file.
- **A past day 3 days back was searched fresh (4.2 s) on both cameras,**
  2–4 minutes after the panel opened. The background fetch should have
  stored it. Its errors were only logged at debug level, so the report
  could not show whether it failed or had not reached the day yet.

Changes (v0.2.7):

1. The background fetch keeps a status per camera. A past day's server
   timing carries it (`warm`), and the playback check prints it as
   "background fetch: …": whether the day was fetched, failed (and why), or
   not reached yet, and how far the fetch has got.
2. If the month search fails, every recent day is tried instead of none.
3. Days whose search failed, or whose event search failed (not stored), are
   tried once more at the end.
4. A camera that failed today's search is skipped (its past days would
   only wait for the same timeouts).

#### Eighth hardware check (2026-10-20, v0.2.7, Chrome on the LAN): 2A done

Run about 2 minutes after the panel opened, as the plan intends.

| Camera | Today / again | 2026-10-17 first / again | Events → first frame | Recordings | Auto-advance |
| --- | --- | --- | --- | --- | --- |
| Front Yard Right | 105 / 236 ms | 158 ms (store) / 271 ms | 1056, 1014, 1116 ms (55.6, 53.1 and 9.2 min in) | 199.9 MB, plain MP4, from disk | gap 7 ms |
| Front Yard Left | 211 / 222 ms | 181 ms (store) / 287 ms | 590, 772, 998 ms (35.8–55.7 min in) | 29.0 and 64.6 MB, plain MP4, from disk | gap 6 ms |

- **Every 2A exit criterion is met** on two cameras: timeline 105–287 ms
  (the past day came from the background fetch's store), first frame
  590–1116 ms deep inside hour-long recordings, auto-advance gaps 6–7 ms.
- The past day was stored this time, so the report had no
  "background fetch" line. Whether v0.2.7's retries or the wait made the
  difference is not known; a later miss now shows its reason.

Known limits carried into 2B and Phase 4:

- An event 3 s or more into a recording that is not cached waits for the
  whole download (about 3 s for 64 MB, 10 s for 200 MB). The background
  prefetch of the day's longest recording usually has it cached first.
- A day older than the background fetch's 7 days costs the NVR's 4–6 s
  search the first time it is opened.
- A cached recording takes disk space twice for up to 35 minutes while it
  is rewritten as plain MP4. (Phase 2B step 0: now only while a URL bound to
  the original is alive, and counted against the cap; see below.)

#### Phase 2B status

| 2B step | Status |
| --- | --- |
| 0. Fix the recording cache (disk accounting, eviction, leases, deletion timers, open race), DST end and refresh window, shared thumbnail fetches; correct the MSE claim above | Done (v0.2.8), see "Step 0" below |
| 1. Measure where it hasn't been (gate): desktop Chrome on the LAN, the iPhone Companion app on Wi-Fi, over Tailscale and over Nabu Casa | **Done** (2026-10-21): check built (v0.2.8), sharpened in v0.2.9 and v0.2.10; four desktop runs (three through Nabu Casa, one on the LAN) and four iPhone runs (Wi-Fi, Tailscale twice, Nabu Casa). Three player and cache bugs found and fixed. HD unmeasured (no main recording cached). See "Step 1 results" and "What step 1 decides" |
| 2. Build what the evidence calls for (speeds, HD/SD keeping the position, uncached deep seeks, bounded memory and disk) | **In progress**: MSE with server-normalized fragments, the file player as fallback; see "Step 2: what to build" |

##### Step 0: the recording cache (v0.2.8)

Bugs found by review, each reproduced by a test that failed before the fix:

1. **Disk accounting.** The 8 GiB cap counted only complete files, and the
   2 GiB free-space rule was checked once, before a fill waited for its
   stream slot, against `max(2 GiB, size)`. Now everything on disk counts
   (`.part` files too), plus what each running fill and rewrite still
   expects to write:
   - a fill reserves its expected size (the search's size + 1 % + the index
     room; without a size, its length at 10 Mbit/s main or 1 Mbit/s sub)
     once it holds its stream slot, after the wait, and asks for more if the
     recording turns out larger;
   - the plain-MP4 rewrite reserves room for its second copy before ffmpeg
     starts; without room it is skipped ("plain MP4 no: not enough free disk
     space") and the original is served;
   - free space must stay at 2 GiB once every reserved byte is written.
2. **Low free space evicted nothing.** Eviction now frees whichever is
   larger: the excess over the cap, or the free-space shortfall.
3. **Eviction could delete or swap a playing file.** Range requests
   (`FileResponse`) were not counted as readers. Issuing a URL now *leases*
   the recording until the URL expires (plus 1 minute): it is not evicted,
   and the URL stays bound to the file it was issued for. A recording's
   original and plain copy are evicted together, as one unit.
4. **Deletion timers.** The original is deleted 1 minute after the last URL
   bound to it expires (at once if none was issued), instead of after a
   fixed 35 minutes. Eviction and a new rewrite cancel a pending deletion,
   and a deletion never touches a newer entry of the same recording.
5. **Two opens of a recording on disk** could start a second download (the
   second request saw an entry that was not marked complete yet).
6. **DST.** A recording through the fall-back (e.g. 01:50 first pass to
   01:05 second pass) became empty; its end now takes the later meaning.
   Today's refresh window turned inside out in the repeated hour (from
   01:45 to 01:05); it now runs from before both times to the later one.
7. **Thumbnails.** A browser closing one thumbnail request cancelled the
   shared fetch for every other request of the same image. The fetch now
   runs on until the last request goes away.

Consequence to measure: main recordings are 2.4–3.8 GB, so an 8 GiB cache
holds about two of them with their plain copies. HD playback of an hour-long
main recording, its preloaded next file and the plain-MP4 rewrite no longer
fit at once: the rewrite or the preload is refused (and reported) instead of
overrunning the cap. The step-1 check reports the cache's disk use.

##### Step 1: the playback check (v0.2.8)

The check is built into the panel (Playback tab → **Debug** → **Run playback
check**), so it runs where there is no developer console, as in the iOS
Companion app. `scripts/playback_check.js` now only calls it from the desktop
console. It drives the tab like a user (read-only: timelines and playback) and
reports, on the device it runs on:

| Part | What it measures |
| --- | --- |
| Header | browser (e.g. "iOS 18.1, Companion app 2025.10.1"), how HA is reached (local, Tailscale, Nabu Casa or remote, from the host name, which is not reported), screen, delivery mode |
| A1–A4 | time to timeline: today, a past day first and again (2A criterion) |
| B | the latest three events of today: first frame, video element events, each video request (wait, answer, duration, size), and the server's download record (2A criterion) |
| D1 / D2 | first frame deep in a long recording (≥ 20 min, sub stream): **D1 not cached** (a recording `playback/peek` shows is not on disk; the latest event 50–95 % in, else 75 %), then **D2 cached** (10–45 % in, else 40 %), with the download and plain-MP4 rewrite times and the plain file's `moov` size (what a browser reads before the first frame) |
| C | auto-advance between two touching recordings, preferring the cached long recording (2A criterion) |
| R | `playbackRate` 0.5×, 1×, 2×, 4×, 8× for 6 s each (from 1 s after the change, v0.2.9) on a cached long recording: effective rate, frames painted (`requestVideoFrameCallback`) against frames needed, the longest gap between painted frames, dropped frames (`getVideoPlaybackQuality`), stalls, and whether the page was in front. Smooth = on pace (±10 %), stalls under 100 ms in total, no gap over 2.5 frames (250 ms at least), and ≤ 2 % dropped below 50 frames a second (above the display's refresh rate a browser must skip frames) |
| L | the link to HA: a 4 MiB Range read of the cached recording |
| MSE | whether `MediaSource` and `ManagedMediaSource` exist and accept the sub and main codecs; an **append test** of a 1 s H.264 clip (VP9 where H.264 is missing) in four shapes: MSE-ready (`default-base-is-moof` + `tfdt`), absolute offsets, no `tfdt`, and both (the NVR's shape) |
| HD | the panel's HD decision and `decodingInfo` for the main stream, as a file and through MSE |
| M (optional) | a one-hour session from the start of the long recording, a sample a minute: JS heap (Chrome only), seconds buffered ahead and held by both videos, dropped frames, stalls, file changes and gaps, the server cache's disk use, reservations and leases |

Reports are saved on the server as the check runs (`playback/check_report`,
last 20 kept) and listed under **Saved reports** on any device. If the page is
reloaded or closed during a run (on iOS, usually the app running out of
memory), the next load of the tab says so and marks the saved report.

Checked in Chromium 141 (headless, Playwright) against a fake HA serving
VP9 recordings: every part ran (40 s, plus the session), and the MSE probe
confirmed the correction above: the MSE-ready fragment plays, while absolute
offsets, a missing `tfdt` and the NVR's shape each fail with an append error.

How to run it, on each setup (one camera at a time; a continuous camera,
e.g. Front Yard Right, gives the deep-start and session parts):

1. Update to v0.2.8 and restart HA. Open the camera's **Playback** tab, wait
   about 2 minutes (the background fetch), open **Debug** at the bottom.
2. Pick the **Setup**: *Desktop Chrome, LAN*; *iPhone app, Wi-Fi (local)*
   (Companion app with the internal URL, on home Wi-Fi); *iPhone app,
   Tailscale* (Wi-Fi off, Tailscale on, the app pointed at the Tailscale
   address); *iPhone app, Nabu Casa* (Wi-Fi off, Tailscale off, external
   URL).
3. Tick **then play for 60 min** for the memory and disk session. On the
   iPhone set Auto-Lock to Never first and keep the app in front (iOS pauses
   video when the screen locks).
4. **Run playback check**; leave the tab alone until "Done". About 2 minutes
   without the session.
5. **Copy report**, or later on the desktop: **Saved reports** → Copy.

##### Step 1 results

| Setup | Status |
| --- | --- |
| Desktop, through Nabu Casa | Runs 1 (v0.2.8), 2 (v0.2.9) and 3 (v0.2.10), 2026-10-20, below: Brave in an HA add-on, loading HA through the Nabu Casa address |
| Desktop on the LAN | Run 4 (v0.2.10, 2026-10-20) below: Chrome on a Mac |
| iPhone app, Wi-Fi (local) | iPhone run 1 (v0.2.10, 2026-10-20, with the session) below |
| iPhone app, Tailscale | iPhone runs 2 (stopped after the events) and 3 (set to "Nabu Casa", but loaded through the Tailscale address), v0.2.10, 2026-10-20, without the session, below |
| iPhone app, Nabu Casa | iPhone run 4 (v0.2.10, 2026-10-20, without the session) below |

**Desktop run 1** (v0.2.8, Front Yard Right, with the one-hour session).
The browser was **Brave (Chromium 155) running in a Home Assistant add-on**,
viewed remotely, and it loaded HA through the **Nabu Casa** address (the
check said "remote over https"). So every byte went from HA out to Nabu
Casa's relay and back into the same machine (a 4 MiB read ran at 62 Mbit/s),
and the browser decoded and drew on the HA host's CPU, shared with HA, the
NVR downloads and the ffmpeg rewrites. The earlier hardware checks used
Chrome on a desktop with plain HTTP on the LAN. Read this run's link-bound
times (the uncached deep start) and its dropped frames with that in mind.

| Measure | Result |
| --- | --- |
| Timeline | today 271 ms, a past day 142 ms (store), again 273 ms, today again 347 ms (stale copy): all under 1 s |
| Events → first frame | 569, 338, 451 ms, 12–28 min into a 29 min recording the prefetch had cached: all under 2 s |
| Deep start, not cached | **36.6 s**, 53 min into a 60 min recording. The server waited for the whole download (10.4 s: 204 MB at 159 Mbit/s). Then Chrome read the whole original (fragmented) file before its metadata: 25.8 s at 62 Mbit/s, with the preloaded next file loading alongside. The URL was bound to the original because the plain copy did not exist when it was issued; it was ready 2.9 s after the download |
| Deep start, cached | 1273 ms (plain file, `moov` 1.3 MB): under 2 s |
| Auto-advance | **failed**: player bug 1 below |
| Rates | on pace at every rate (0.50, 0.99, 1.98, 3.98, 7.98×). Painted 7, 14, 27, 48, 51 fps of 8, 15, 30, 60, 120 needed. Dropped 9, 6, 6, 8 % at 0.5–4× and 50 % at 8× (above the display's rate, expected). One 1 ms stall at 8×. All but 4× judged not smooth. The window was in front (owner); the browser draws in software on the HA host, so the drops likely reflect that host's load, not the player: the session at 1× dropped no frames for 18 minutes once nothing else ran |
| MSE | `MediaSource` plays the MSE-ready fragment; the NVR's shapes (absolute offsets, no `tfdt`, both) fail with append errors. No `ManagedMediaSource` (Chrome) |
| HD | not tried yet (no main recording cached, so its codec is unknown) |
| One-hour session | JS heap 83–119 MB, end 96 MB (+7.7 MB/h, within garbage-collection swings: no growth). No stalls. Cache 6.51–6.71 GB of 8.59 GB. 1738 frames dropped in minutes 2–5, then none for 18 minutes. **Stopped at the file change after 60 min** with `PIPELINE_ERROR_READ: FFmpegDemuxer: data source error`: player bug 2 below |

Findings and fixes (v0.2.9):

1. **Player bug: a click during playback could start at the old position.**
   `playAt` took its start point from the cursor after asking for the URL,
   and the video still playing moved the cursor meanwhile. Auto-advance
   asked for 6:59:52 and got 6:15:40, where the previous test was playing
   (6:16:25 after 45 s). Any click while a video plays could hit this. The
   start point is now fixed when the click happens, and the old video's time
   is ignored until the new one starts (test reproduces it).
2. **Player bug: URLs expired during long playback.** A URL lived 30 min.
   The next file's URL was asked for when the current one started, an hour
   before it was needed, so the file change failed. On WebKit, which reads in
   ranges, an hour-long recording would also fail after 30 min. Now:
   - a recording's URLs live 30 min plus its length (at most 6 h), and so
     does its lease;
   - the next file's URL is asked for in the last 3 min (media time) of the
     current one, and its cache fill is started at once instead;
   - a read that fails mid-way (an expired URL after a long pause, a network
     drop) reloads the recording where it was, at most once a minute. The
     Debug section counts these ("Reloaded mid-way").
   Reproduced in Chromium with URLs that expire and connections that close:
   Chrome raised the same `PIPELINE_ERROR_READ` error, and the player went
   on from the same place.
3. **Check fixes.**
   - The session's summary said "0 frames dropped": the counters restart
     when an element loads another file. They are now added up.
   - Each start is checked against the time asked for ("STARTED AT …").
   - Rates are measured 1 s after the change and flagged when the page was
     not in front. Stalls under 100 ms in total no longer count.
   - The session flags minutes with the page not in front, and gives
     dropped frames per minute.
   - The report gives the connection's HTTP version and the file each URL is
     bound to (plain or original). A domain name is reported as "own domain".
4. **Evidence for step 2 so far** (one setup; the iPhone runs decide):
   - The uncached deep start has two costs. The NVR download up to the
     target point (about 9 s of the 10.4 s here; no design avoids it without
     server-side seek). Then the browser reading the file: here 25.8 s for
     the whole original. Both candidates, (a) MSE with normalized fragments
     and (b) a "start here" plain MP4, remove the second cost and cut the
     first to the bytes up to the target.
   - `playbackRate` on the plain file keeps pace up to 8× in Chromium; above
     the display's refresh rate frames are skipped by design. Whether 0.5–4×
     drop frames on a real device is for the iPhone runs (and a desktop at
     home later) to show: this run's browser shared the HA host's CPU.
   - Chrome's heap stayed bounded over an hour.

**Desktop run 2** (v0.2.9, same browser and path as run 1, without the
session; 2026-10-20, Front Yard Right):

| Measure | Result |
| --- | --- |
| Timeline | today 518 ms (stale copy, server 0 ms: the rest is the round trip through Nabu Casa), a past day 162 ms, again 314 ms, today again 188 ms: all under 1 s |
| Events → first frame | 575, 371, 372 ms. **The first started 52 s before the time asked**: cache bug below |
| Deep start, not cached | 27.0 s, 55 min into a 60 min recording: download 9.9 s (180 MB at 146 Mbit/s), then the browser read the whole original (16.8 s, about 86 Mbit/s through Nabu Casa). The URL was bound to the original ("original file") |
| Deep start, cached | 526 ms (plain file): under 2 s |
| Auto-advance | **works**: gap 1 ms (fixed in v0.2.9) |
| Rates | on pace at every rate (0.50, 1.00, 2.00, 4.00, 8.01×). Dropped 2 of 46, 3 of 91, 1 of 180, 24 of 361 and 363 of 720 frames. 0.5× and 1× judged not smooth on 2 and 3 frames: too few to judge (v0.2.10 allows one), from a browser drawing in software on the HA host |
| Link | 55.9 Mbit/s (Nabu Casa) |
| MSE, HD | as in run 1 |

Finding and fix (v0.2.10):

1. **Cache bug: a recording still being written was frozen at its first
   copy.** The cache knew a recording by its name only. The tab warms the
   latest recording when it opens, and that one is still being written: it
   was cached when it ended at about 10:29:19. The event at 10:30:11, in the
   same recording (by then 33 min long), was served from that copy, so the
   video started at the copy's end, 52 s early. On a continuous camera, any
   click on an event newer than the warm-up showed the wrong moment.
   - The recording's end (from the latest search) is now part of its cache
     id (layout 4: files cached before are retired and fetched again when
     asked for).
   - A copy made when the recording was shorter still serves a start that
     is at least a minute before the copy's end (the panel sends where it
     will start), so earlier events stay fast. A later start fetches the
     recording again, as it is now.
   - Warming takes any copy, so it does not fetch a recording still being
     written again every minute.
2. **Check:** the page's HTTP version came out as "?" (the app serves the
   page from its cache); each request line now gives the protocol the
   video requests used. A rate's dropped frames are judged against 2 % or
   one frame, whichever is more.
3. **Evidence so far** (both runs through Nabu Casa from the HA host):
   cached deep starts 0.5–1.3 s; the uncached deep start is the download
   (about 10 s for 180–204 MB) plus the browser reading the whole original
   at the link's speed (17–26 s here). The LAN and iPhone runs will show how
   much of the second part a fast link removes, and how WebKit behaves.

**Desktop run 3** (v0.2.10, same browser and path, without the session;
2026-10-20, Front Yard Left, whose hour-long sub recordings are about 58 MB):

| Measure | Result |
| --- | --- |
| Timeline | today 169 ms, a past day 119 ms (store), again 176 ms, today again 199 ms: all under 1 s |
| Events → first frame | 346, 245, 619 ms, all where asked. The first two were 11.1 min into today's recording still being written (11.4 min so far): the v0.2.10 copy handling at work |
| Deep start, not cached | 8.8 s, 55 min into a 60 min recording: download 3.1 s (58 MB at 150 Mbit/s), then the browser read the whole original (5.5 s through Nabu Casa) |
| Deep start, cached | 446 ms (plain file): under 2 s |
| Auto-advance | gap 10 ms |
| Rates | on pace at every rate. Dropped 0, 3, 0, 51 and 351 frames at 0.5–8× (4× and 8× need 59 and 117 fps, above the display's rate). 1× judged not smooth on 3 of 87 frames: the third run in a row with 3–5 dropped frames at 1× in this browser, which draws in software on the HA host |
| Link | 63 Mbit/s (Nabu Casa) |
| MSE, HD | as in runs 1 and 2 |

Across the three runs the uncached deep start grows with the file: 8.8 s
for 58 MB, 27.0 s for 180 MB, 36.6 s for 204 MB. Both parts scale with it:
the download (at 146–159 Mbit/s from the NVR) and the whole-file read (at
the link's 55–86 Mbit/s here). Reading only up to the target, and starting
once those bytes are on disk, would cut both: on these files the target
was 88–92 % in, so the download part would shrink a little and the read
part to the `moov` plus a few seconds of video.

**Desktop run 4: Mac on the LAN** (v0.2.10, Chrome 155 on macOS, Front Yard
Right, plain HTTP through a local name, HTTP/1.1, without the session;
2026-10-20):

| Measure | Result |
| --- | --- |
| Timeline | today 197 ms, a past day 107 ms (store), again 165 ms, today again 164 ms: all under 1 s |
| Events → first frame | 256, 123, 204 ms, 10–11 min into today's recording still being written (19.4 min so far), all where asked |
| Deep start, not cached | 16.1 s, 57 min into a 60 min recording: download 12.8 s (259 MB at 163 Mbit/s), then Chrome read the whole original in 3.1 s (about 665 Mbit/s) |
| Deep start, cached | 273 ms (plain file): under 2 s |
| Auto-advance | gap 0 ms |
| Rates | on pace at every rate. Painted 8, 15, 30, 60 and 53 fps of 7, 15, 30, 60 and 120 needed, longest gaps 200, 100, 67, 18 and 33 ms: every frame shown on time up to 4×, and the display's rate at 8×. But `getVideoPlaybackQuality` counted every frame as dropped (45 of 45 … 360 of 360) while `requestVideoFrameCallback` saw each one painted: Chrome on macOS misreports the counter here, so the check's ✗ at 0.5–2× is wrong. Step 2's check judges by painted frames where the two disagree |
| Link | 4 MiB in 368 ms (91 Mbit/s): too short a read for a fast link; the 259 MB transfer above ran at about 665 Mbit/s |
| MSE | as in Chromium elsewhere: `MediaSource` plays the MSE-ready fragment and rejects the NVR's shapes; no `ManagedMediaSource` |

What the desktop runs say for step 2 (the iPhone runs still to come):

- **Every setup is within budget once a recording is cached**: cached deep
  starts 0.27–1.3 s, events 0.12–0.62 s, auto-advance 0–10 ms, and starts
  land where asked.
- **The uncached deep start has two costs, and the link decides which
  dominates.** On the LAN almost all of it is the NVR download (12.8 of
  16.1 s; the browser's whole-file read took 3.1 s). Through Nabu Casa the
  read dominates (17–26 s for 180–204 MB at 55–86 Mbit/s).
  - Serving a "start here" or plain file instead of the whole original
    removes the read: most of the remote cost, little of the LAN cost.
  - Starting once the bytes up to the target are on disk cuts the
    download in proportion to the target's place in the file: on average
    about half, but little for an event near an hour's end (95 % here:
    12.1 s instead of 12.8 s). Without server-side seek on the NVR, that is
    the floor for a cold click.
  - The other lever is to make cold clicks rare: a sub hour is 58–260 MB,
    so the 8 GiB cache holds 30 hours or more of sub. Fetching more of the
    day's recordings in the background (prefetch priority, one at a time)
    would leave most clicks cached.

**iPhone run 1: the Companion app on home Wi-Fi** (v0.2.10, Companion app
2026.10.1, Front Yard Right, plain HTTP to the local address, HTTP/1.1, with
the one-hour session; 2026-10-20). The header says "iOS 18.7", but the app's
own part of the user agent says iOS 27.0.0: WebKit's user agent has kept an
18.x version since iOS 26. Delivery is "whole file first": the server answers
WebKit's first request once the whole recording is on disk.

| Measure | Result |
| --- | --- |
| Timeline | today 149 ms, a past day 106 ms (store), again 326 ms, today again 129 ms: all under 1 s |
| Events → first frame | 894, 529, 755 ms (7–38 min into recordings the prefetch had cached, plain files), all where asked |
| Deep start, not cached | **14.2 s**, 52 min into a 60 min recording: download 9.9 s (234 MB at 189 Mbit/s), then WebKit read the whole original in 4.1 s (about 454 Mbit/s) before its metadata. The URL was bound to the original; the plain copy (`moov` 1.3 MB) was ready 2.0 s after the download, while WebKit was still reading |
| Deep start, cached | 814 ms (plain file): under 2 s |
| Auto-advance | gap 22 ms (preloaded) |
| Rates | on pace at every rate (0.50–8.00×), no stalls. Painted 7, 15, 30, 59 and 60 fps (the sub stream runs at 15 fps), longest gaps 234, 100, 59, 49 and 25 ms: every frame shown up to 2×, and WebKit's 60 fps drawing rate at 4× and 8×. Dropped 0 at 0.5–2×, 9 % at 4× (60 fps needed) and 50 % at 8× (120 needed). All judged smooth. WebKit's frame counter lags over a 6 s window: it counted 60 and 69 frames at 1× and 2× where 90 and 180 went by, so the "needed" figures there (10 and 11 fps) are too low |
| Link | 4.2 MB in 382 ms (88 Mbit/s): too short a read again; the 234 MB read above ran at about 454 Mbit/s |
| MSE | **no `MediaSource`, but `ManagedMediaSource`** (accepts the sub stream's `avc1.640033`). The append test played all four shapes, the NVR's own (absolute offsets, no `tfdt`) included: WebKit accepts what Chromium rejects |
| Video | `canPlayType` "probably" for the sub stream; `getVideoPlaybackQuality` and `requestVideoFrameCallback` present; no `performance.memory` |
| HD | not measured (no main recording cached, so its codec is unknown) |
| One-hour session | 60 min from 4:00 PM: **0 of 54,164 frames dropped, 0 stalls**, one file change with a 7 ms gap, no reloads mid-way, and the page was never reloaded (no out-of-memory). WebKit read 7–8 min ahead (428–485 s) and kept what it had played: the whole hour (3609 s) buffered at the end, plus 687 s of the next file. JS heap not measurable in WebKit. Cache steady at 8.17 GB (cap 8.59 GB), nothing reserved; leases 3, then 2 from minute 41 (the first event's URL expired: 30 min + its 10.7 min + 1 min) |

What iPhone run 1 adds for step 2:

- **On the iPhone too, cached is within budget**: events 0.5–0.9 s, cached
  deep start 0.8 s, auto-advance 22 ms, rates smooth at 0.5–8×, an hour of
  playback without a dropped frame or a reload.
- **The uncached deep start is again download plus whole-file read** (9.9 +
  4.1 s). WebKit waits for the whole file anyway, and the plain copy was
  ready 2 s after the download: binding WebKit's URL to the plain copy (or
  to a "start here" file) would have started at about 12 s here, and over a
  remote link spares reading the whole recording (234 MB) through it. The
  Tailscale and Nabu Casa runs will put a number on that.
- **MSE is open on the iPhone through `ManagedMediaSource`.** Option (a)
  would run on `MediaSource` in Chromium and `ManagedMediaSource` in the
  Companion app; the server's normalized fragments are needed for Chromium
  only. Option (b) needs nothing new from either browser.
- **Rates need only the control**: smooth on the iPhone at every rate, and
  on the desktop by painted frames.
- **HD is still unmeasured on every setup**: no main recording has been
  cached, so the check could not name the main stream's codec.
- **Check fixes for step 2**: take the iOS version from the app's part of
  the user agent; judge smoothness by painted frames (WebKit's counter lags,
  macOS Chrome's misreports).

**iPhone runs 2 and 3: the Companion app through Tailscale** (v0.2.10,
2026-10-20, HTTPS to the Tailscale address, HTTP/2, without the session).
Run 2 (Front Yard Right, 7:29 PM) was stopped after its events. Run 3 (Front
Yard Left, 8:18 PM) was set to "iPhone app, Nabu Casa", but the page came
from the Tailscale address ("page Tailscale"), so it is a Tailscale run.

| Measure | Result |
| --- | --- |
| Timeline (run 3) | today **6.2 s**: the server held no copy of today newer than 15 min for this camera, so the tab waited for the NVR's search (server 6.1 s), not the link. A past day 193 ms (store), again 234 ms, today again 175 ms |
| Newest event, not cached (run 2) | **42.8 s.** The event was 23 s old, 29.1 min into the recording still being written, so no cached copy reached it: download 6.8 s (112 MB at 131 Mbit/s), then WebKit read the whole original in 35.5 s (about 25 Mbit/s). The plain copy was ready 0.7 s after the download |
| Events → first frame, cached | run 2: 1451 ms (the next event, in the same recording now cached); run 3: 2402, 2040 and 1185 ms (plain files the prefetch had cached), two over the 2 s budget. A start is the URL, a 2-byte probe, the `moov` (0.6 MB of 1.2 MB) and the target, one after another: answers took 41–333 ms each, and WebKit waited 0.3–0.8 s after the probe before asking for more (0.1 s at home) |
| Deep start, not cached (run 3) | 7.1 s, 53 min into a 60 min recording: download 2.9 s (63 MB at 173 Mbit/s), then WebKit read the whole original in 3.9 s (about 129 Mbit/s). Plain copy ready 0.8 s after the download |
| Deep start, cached (run 3) | 1305 ms (plain file): under 2 s |
| Auto-advance (run 3) | gap 19 ms (preloaded) |
| Rates (run 3) | on pace at every rate, no stalls. Painted 7, 15, 29, 50 and 59 fps (15 fps source), longest gaps 233, 117, 67, 58 and 31 ms. Dropped 0 at 0.5–2×, 14 % at 4× and 49 % at 8×. All judged smooth |
| Link (run 3) | 4.2 MB in 1640 ms (20.5 Mbit/s, first answer 166 ms): a short read on a slow-to-answer link; the 63 MB read ran at about 129 Mbit/s |
| MSE, HD (run 3) | as in iPhone run 1: `ManagedMediaSource` only, all four shapes play; HD not measured |

What the Tailscale runs add for step 2:

- **Remotely, the whole-original read is the cost**, and it grows with the
  file and shrinks with the link: 35.5 s for 112 MB at 25 Mbit/s, 3.9 s for
  63 MB at 129 Mbit/s. In both runs the plain copy was ready under a second
  after the download. Binding WebKit's URL to it would have made these
  starts about 9 s and 5 s. This is step 2's first change.
- **The newest event on a continuous camera is the common cold click.** It
  is always in the recording still being written, past any cached copy, and
  such a recording can only be fetched whole from its start (6.8 s for
  29 min here). After the change above, that download is what is left.
- **Cached starts over a remote link (1.2–2.4 s) are round trips**: the
  probe, the `moov` and the target in sequence at 150–330 ms each, plus
  WebKit's own pauses. Fewer or smaller requests would help: a "start here"
  file's `moov` covers only what follows the target; MSE needs an init
  segment and one fragment, with no probe.
- **Rates and auto-advance do not depend on the link** once the file is
  cached: the same as at home.
- **Timeline**: a camera not opened for 15 min waits for the NVR's search
  (6.2 s here). Showing the older copy at once and refreshing behind it, as
  within 15 min, would remove that wait.

**iPhone run 4: the Companion app through Nabu Casa** (v0.2.10, Front Yard
Right, HTTPS through the Nabu Casa address, HTTP/1.1, without the session;
2026-10-20, 8:26 PM):

| Measure | Result |
| --- | --- |
| Timeline | today 184 ms, a past day 213 ms, again 338 ms, today again 234 ms (stale copy): all under 1 s |
| Newest event, not cached | **22.3 s.** The event was 6.4 min old, 20.3 min into the recording still being written (25.4 min so far): the server's download took about 4.5 s (93 MB), then WebKit read the whole original in 17.4 s (about 43 Mbit/s) |
| Events → first frame, cached | 1369 and 973 ms (the next two events, in the same recording, now cached as a plain file). Answers took 39–84 ms; a request opening a new connection (HTTP/1.1) waited 75–143 ms first |
| Deep start, not cached | **83.5 s**, 44.3 min into a 60 min recording: download 9.7 s (215 MB at 177 Mbit/s), then WebKit read the whole original in 72.8 s (about 24 Mbit/s). The plain copy was ready 1.9 s after the download |
| Deep start, cached | 2226 ms (plain file), just over 2 s: five requests in sequence (the probe, the 1.3 MB `moov` in two reads, the target), and WebKit waited 0.7 s after the probe |
| Auto-advance | gap 24 ms |
| Rates | on pace at every rate, no stalls. Painted 7, 15, 30, 59 and 60 fps, longest gaps 233, 101, 50, 43 and 39 ms. Dropped 0 at 0.5–2×, 9 % at 4× and 45 % at 8×. All judged smooth |
| Link | 4.2 MB in 800 ms (42 Mbit/s, first answer 154 ms); the long reads above ran at 24–43 Mbit/s |
| MSE, HD | as in the other iPhone runs |
| Check bug | the three event lines say "server: not cached". The check asked about each recording as the day stood when it began; the recording being written had grown since, so the server looked for a newer copy than the one played. Step 2's check takes the server's record of the copy it was served |

##### What step 1 decides (the gate, 2026-10-21)

Every setup has been measured: desktop Chrome on the LAN and through Nabu
Casa, and the iPhone Companion app on home Wi-Fi, through Tailscale and
through Nabu Casa. HD is the one thing no run could measure: no main
recording was cached on any of them, so the check could not name the main
stream's codec. It moves to step 2's hardware check.

Uncached starts, every run (sub stream; "read" is the browser reading the
whole original before its first frame):

| Run | Setup | Position | File | NVR download | Browser read | First frame |
| --- | --- | --- | --- | --- | --- | --- |
| desktop 1 | Brave on the HA host, Nabu Casa | 53 of 60 min | 204 MB | 10.4 s | 25.8 s (62 Mbit/s) | 36.6 s |
| desktop 2 | same | 55 of 60 min | 180 MB | 9.9 s | 16.8 s (86 Mbit/s) | 27.0 s |
| desktop 3 | same | 55 of 60 min | 58 MB | 3.1 s | 5.5 s | 8.8 s |
| desktop 4 | Mac, LAN | 57 of 60 min | 259 MB | 12.8 s | 3.1 s (665 Mbit/s) | 16.1 s |
| iPhone 1 | Wi-Fi | 52 of 60 min | 234 MB | 9.9 s | 4.1 s (454 Mbit/s) | 14.2 s |
| iPhone 2 | Tailscale | newest event, 29 of 29 min | 112 MB | 6.8 s | 35.5 s (25 Mbit/s) | 42.8 s |
| iPhone 3 | Tailscale | 53 of 60 min | 63 MB | 2.9 s | 3.9 s (129 Mbit/s) | 7.1 s |
| iPhone 4 | Nabu Casa | newest event, 20 of 25 min | 93 MB | 4.5 s | 17.4 s (43 Mbit/s) | 22.3 s |
| iPhone 4 | Nabu Casa | 44 of 60 min | 215 MB | 9.7 s | 72.8 s (24 Mbit/s) | 83.5 s |

Everything else is within budget, or close to it, on every setup:

- Timeline 106–518 ms (a camera not opened for 15 min: 6.2 s, the NVR's
  search).
- Cached starts: 0.12–0.9 s on the LAN and Wi-Fi, 0.97–2.4 s remotely,
  where three to five requests in sequence at 40–330 ms each set the time.
- Auto-advance 0–24 ms, every start where asked.
- Rates 0.5–8× on pace everywhere, every frame painted up to the display's
  rate (Chrome on the HA host aside, which draws in software).
- An hour of playback: Chrome's heap bounded (+7.7 MB/h), the iPhone
  without a dropped frame or a reload, the cache under its cap.
- `MediaSource` in Chromium and `ManagedMediaSource` (not `MediaSource`) in
  the Companion app on iOS 27, both playing the normalized fragment.

##### Step 2: what to build (decided 2026-10-21 from step 1)

**Uncached deep starts: (a) MSE with server-normalized fragments.** Both
candidates remove the whole-file read, which is most of every remote cold
start above. Only (a) also meets "start once the bytes up to the target are
on disk":

- A "start here" MP4 needs a complete `moov`, the size of every sample it
  covers, so it can only be made from bytes already downloaded. To play on
  past them the player would have to chain files.
- Normalized fragments can be served as soon as each one is on disk, while
  the download runs on. A start costs the download up to the target plus
  one round trip for a window of fragments: no probe and no `moov` reads
  (the init segment is the NVR's own 1.1 KB `moov`).
- Both browsers have it: `MediaSource` in Chromium, `ManagedMediaSource` in
  the Companion app (which even plays the NVR's own fragments; Chromium
  needs them normalized).
- One `SourceBuffer` can hold consecutive recordings at their wall-clock
  offsets. Auto-advance, rates and scrubbing then act on one element.

From the runs above, starts would be the download up to the target plus
about half a second. For example, iPhone 4's 44-min start would be about
8 s instead of 83.5 s, and its newest event about 4 s instead of 22.3 s.

**Fallback: the current file player**, when MSE is missing or rejects the
codec, an append fails, or the user turns MSE off. Its URL is bound to the
plain copy, waiting for the rewrite (under 2 s after the download in every
run), whenever the browser would otherwise read the whole original: WebKit
always, and any browser for a start past the file's first minute.

Build order, each part with tests, and a real-browser test where the
browser matters:

1. **Normalizer** (`fmp4.py`): parse an NVR fragment; rewrite each `traf`
   to `default-base-is-moof` without `base-data-offset`; add a `tfdt` from
   the track's running decode time; make `trun` data offsets relative to
   the `moof`. Index a cache file's fragments (time → bytes) incrementally,
   while it downloads. Tested on `tests/mp4_fixtures.py`'s NVR-shaped files.
2. **MSE view**: the init segment and windows of normalized fragments by
   media time, under a signed URL with a lease like the VOD grant. A window
   past the download waits for it. Cache fills already go through the
   scheduler.
3. **Playwright append test**: Chromium appends the normalized NVR-shaped
   fixtures (H.264 with AAC) and plays across a window boundary and a file
   boundary; the raw fragments fail to append (the control).
4. **MSE player**, a state machine:
   - windows fetched ahead by time and by bytes, trimmed behind;
   - `ManagedMediaSource`'s `startstreaming` and `endstreaming` respected;
   - the next recording appended at its offset;
   - falls back to the file player on any error.
5. **Controls**: speed 0.5–8×; HD/SD switch at the exact position; scrubbing
   on the sub stream (frames while dragging, the chosen stream on release).
6. **Bounded memory and disk**: buffer caps behind and ahead, by seconds and
   bytes; the disk cap as in step 0. The session check reports both.
7. **Debug panel**: player mode (MSE, `ManagedMediaSource` or file), windows
   fetched and their wait, buffered ahead and behind, trims, fallbacks.
8. **Check fixes**:
   - report the player mode;
   - judge smoothness by painted frames where the counters disagree;
   - take the iOS version from the app's part of the user agent;
   - take the server's record of the copy served;
   - use a longer link test.
9. **Timeline**: show an older copy of today at once at any age, then
   refresh behind it.

Step 2 exit criteria:

- all of 2A's;
- an uncached deep start begins once the bytes up to the target are on
  disk (times recorded);
- speeds 0.5–8× work;
- the HD/SD switch keeps the position;
- a one-hour session stays within the buffer and disk caps;
- the iPhone app plays, seeks and auto-advances on Wi-Fi, through Tailscale
  and through Nabu Casa.

#### 2A as built (v0.2.0)

Backend (`custom_components/reolink_viewer/`):

- `scheduler.py`: request limits NVR 6, cameras 3, unknown hosts 2. A separate
  per-host **stream budget** counts long-lived fills: NVR 4, other hosts 2, and at
  most 1 prefetch fill per host. A click raises a waiting fill's priority.
- `bridge.py`: one day's files (HTTP search) and individual Baichuan events (type
  and exact start/end), plus the month's recording days. An event-search failure
  still returns the files and is reported as `events_error`.
- `timeconv.py`: camera-local times to UTC with the device's own DST rules (see
  item 5 above). Tested across both 2026 transitions.
- `timeline.py`: `timeline/days` (month) and `timeline/day` (camera, day). Past
  days are cached permanently (memory and HA storage, last 120 days per camera).
  Today is refreshed incrementally: only the last 10 minutes are searched again,
  with a 60 s TTL. Today is warmed for every recording camera at PREFETCH priority
  when the panel opens (`timeline/warm`).
- `vodcache.py`: the disk cache of the serving strategy. Fills run at full speed
  under the stream budget and are served progressively while filling (200,
  chunked, Chrome/Firefox), or with Range once complete (Safari / iOS app). The
  cache is an LRU capped at 8 GiB that keeps 2 GiB free on disk. The codec string
  and size come from the file's `moov`.
- `thumbnails.py`: `snapshot_past` at THUMBNAILS priority. Times are bucketed by
  zoom (5 s to 5 min), and concurrent requests for the same bucket share one fetch.
  Failures are cached for 60 s. Disk LRU capped at 256 MiB.
- `views.py`: `/api/reolink_viewer/vod|clip|thumb/{token}`. Each URL is signed
  with `async_sign_path` for the websocket user and expires (VOD 30 min,
  thumbnails 10 min). The token maps to a server-side grant, so no camera URL or
  credential reaches the browser.

Frontend (`frontend/src/playback/`, `components/playback.ts`):

- **Playback** tab for cameras with a playback source; none for the E1 Zoom.
- **Canvas timeline:** zoom 24 h, 6 h, 1 h, 15 min, 5 min (wheel, the −/+
  buttons, keys); recording bars and colored markers for every VOD trigger type.
  It also has filter chips, hover thumbnails (150 ms debounce), drag to scrub,
  previous/next event, and a calendar with recording-day dots.
- **Event list:** thumbnail cards, newest first.
- **Player:** two `<video>` elements. The next file is preloaded in the hidden one
  and swapped in at `ended`.
- **Streams:** sub stream by default. HD is offered only when
  `MediaCapabilities.decodingInfo` reports the main stream's codec and size as
  supported and smooth. An HD failure falls back to the sub stream.
- **Debug panel:** time to timeline (with the server's cache state), time to first
  frame, URL latency, the gap at the last file change, stream and codec, cache
  state, the HD decision, and the delivery mode.

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

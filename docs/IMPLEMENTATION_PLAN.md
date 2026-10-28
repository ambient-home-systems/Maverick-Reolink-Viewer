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
| 2 | Event timeline, thumbnails, smooth playback | High (backend) / Very high (player) | 3–5 wk | Done (2026-10-21, v0.3.2). 2A (2026-10-20, v0.2.7): timeline 105–287 ms, first frame 0.6–1.1 s, auto-advance 6–7 ms on hardware. 2B: MSE player; uncached deep starts are the NVR's download up to the target (6.9–13.0 s in hour-long recordings, up to 84 s before), speeds 0.5–8×, HD/SD at the same moment, one-hour sessions within the caps, the iPhone app on Wi-Fi, Tailscale and Nabu Casa |
| 3 | Live view via go2rtc, grid, fullscreen, PTZ | High | 3–4 wk | Done (2026-10-27, v0.15.1). Our own go2rtc and the live check (v0.4.0, runs 5–13); the key-frame cache, the image cache, the Live grid and Live tab, keep warm, full-screen HD, PTZ and the camera's controls, the picture first, battery cameras on wired power, a debug view per tile and the soak report (v0.5.0–v0.15.1). Exit runs: the soak passed (run 15), every tile's first image in a median 0.02 s on the iPhone and the Mac (runs 16–17), and the Phase 2 playback criteria held with live view running (runs 18–19) |
| 4 | Design, performance, mobile, packaging, first release | Standard | 3–4 wk | In progress. Step 1, the design (the Timetable), done in v0.16.0–v0.22.0; step 2, the performance budget, done in v0.23.0; step 3.1 built in v0.24.0. See "Phase 4 status" |
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
| 2. Build what the evidence calls for (speeds, HD/SD keeping the position, uncached deep seeks, bounded memory and disk) | **Done** (2026-10-21, v0.3.2): MSE with server-normalized fragments, the file player as fallback (v0.3.0); the check covers scrubbing and HD, and `scripts/desktop-check` runs it without clicking (v0.3.1); the check picks a truly uncached recording (v0.3.2). Hardware check: seven runs (Chrome on the LAN and through Nabu Casa, the iPhone app on Wi-Fi, through Tailscale and through Nabu Casa) met every exit criterion. Uncached starts 41–57 min into hour-long recordings took 6.9–13.0 s, the NVR's download up to there (step 1: up to 84 s). See "Step 2 hardware results" |
| 2B complete | **Done** (2026-10-21, v0.3.2): all of step 2's exit criteria met together, see "What step 2's hardware check shows" |

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
- Each of the player's two `<video>` elements gets a `MediaSource` per
  recording. The next recording is preloaded in the hidden one, as now, so
  auto-advance stays a swap. (Built that way, rather than one
  `SourceBuffer` for consecutive recordings: same gaps, simpler mapping.)

From the runs above, starts would be the download up to the target plus
about half a second. For example, iPhone 4's 44-min start would be about
8 s instead of 83.5 s, and its newest event about 4 s instead of 22.3 s.

**Fallback: the current file player**, when MSE is missing or rejects the
codec, an append fails, or the user turns MSE off. Its URL is bound to the
plain copy, waiting for the rewrite (under 2 s after the download in every
run), whenever the browser would otherwise read the whole original: WebKit
always, and any browser for a start past the file's first 3 s.

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
   fixtures and plays across a window boundary to the end; the raw
   fragments fail to append (the control). Playwright's Chromium has no
   H.264 or AAC, so the test media is VP9 with Opus.
4. **MSE player**, a state machine:
   - windows fetched ahead by time and by bytes, trimmed behind;
   - `ManagedMediaSource`'s `startstreaming` and `endstreaming` respected;
   - the next recording preloaded in the second `<video>`;
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

##### Step 2 as built (v0.3.0)

Server (`custom_components/reolink_viewer/`):

- `fmp4.py`: `FragmentIndex` follows a cache file as it grows (the init
  segment and its codec string, then each `moof` + `mdat` with its decode
  time per track, counted from the start). `normalize_fragment` rewrites
  one fragment as MSE requires. An ffmpeg-made MSE-ready file put in the
  NVR's shape (absolute offsets, no `tfdt`) normalizes back to the same
  bytes, for H.264/AAC and VP9/Opus.
- `views.py`: `/api/reolink_viewer/mse/{token}/init` (the init segment,
  its MIME type in `X-RV-Mime`) and `/frags?at=ms|first=n&ms=&bytes=` (a
  window of fragments: from the sync fragment showing `at`, or by index;
  `X-RV-First`, `-Count`, `-Start`, `-End`, `-Last`). A window waits for
  its first fragment to be on disk, then takes what is there. The player
  fetches these with HA's own authentication (`hass.fetchWithAuth`): a
  signed path cannot carry a window's query. The token is a grant, leased
  like the VOD URLs.
- `websocket_api.py`: `playback/mse` (the fragment path, plus a signed clip
  URL), `playback/cache_status` (the download of the copy a URL serves:
  the player's progress note and the check's record), and `max_age` up to
  a day.
- `vodcache.py` (layout 5): the original is kept, because the MSE player
  reads it. The plain copy is written only when the file player first asks
  for it, and a URL that does not stream from the start gets it (the
  original if the rewrite fails). The deletion timers of step 0 are gone
  with the deletions.
- `mp4.py`: VP9 (`vpcC`) and Opus codec strings.

Panel (`frontend/src/`):

- `playback/mse-feeder.ts`: feeds one `<video>` from the view. It starts
  with a 4 s window at the target, then keeps 30 s ahead at 1× (rate times
  that, at most 240 s and 48 MiB), and trims to 30 s behind. It uses
  `ManagedMediaSource` where it exists, and `MediaSource` otherwise.
  - It extends the last window by index when the buffer ends just short of
    the play position, and steps over small gaps.
  - It ends the stream again after trims (a `remove()` reopens it).
  - It makes room on a full buffer.
  - It reports `MseUnsupported` (no MSE, a codec refused, an append error,
    "not playable as fragments") apart from other failures (an expired
    URL, the network).
- `playback/player.ts`: each `<video>` plays a file URL or an MSE feeder.
  It swaps and preloads by recording, not by URL (each URL is a new
  grant). It adds `seekWithin` (a start inside the recording on screen,
  reported at `seeked`), `preview` (a frame while scrubbing, if buffered),
  `rate` and an overlay note.
- `components/playback.ts`:
  - MSE where the browser has it. A fallback failure hands that stream to
    the file player, and the Debug setting can force the file player.
  - A start inside the recording on screen is a seek, without a new URL.
  - Speed selector, 0.5–8×; it carries over to the next recording.
  - While a start waits, a note shows the recorder's download ("Fetching
    the HD recording from the recorder: 412 MB of about 2900 MB").
  - Scrubbing shows frames from the buffer, and the sub-stream thumbnail as
    before.
  - Debug rows "Player" (API, codecs, windows, ahead/behind, trims, and the
    setting) and "Fell back to the file player".
  - Today's older copy is shown at once at any age, then refreshed.
- Check v0.3.0:
  - reports the player;
  - takes the server's record of the copy served;
  - reads the link for 3 s;
  - judges smoothness by painted frames where the dropped-frame counter
    disagrees with them;
  - takes the iOS version from the app's part of the user agent.

Checked:

- Python: 491 tests, 95 % coverage.
- Panel: 136 tests, including the feeder against a fake `MediaSource`.
- CI job "MSE in Chromium (Playwright)": through the real view and HA auth,
  Chromium starts 3.5 s into an NVR-shaped VP9/Opus recording, plays
  across a window boundary to the end, and refuses the raw fragment.
- The built panel in Chromium (headless, Playwright) against a fake HA
  serving NVR-shaped VP9/Opus recordings through `fmp4.py`, with a
  simulated download:

| Case | Result |
| --- | --- |
| Uncached start 16.8 of 21 min (16 MB at 2 MB/s) | first frame 5.7 s: the download up to the target (about 80 % of it) |
| Same, at 0.5 MB/s | 22.7 s, with the progress note; no repeated requests while waiting |
| Seek within the recording | 31–58 ms |
| Rates 0.5, 2, 4, 8× | 0.50, 2.00, 3.97, 7.91× effective |
| Auto-advance | 2.8 ms gap at 1×, 8.4 ms at 8× (the speed carries over) |
| HD/SD switch | position kept (moved 0.01 s) |
| Scrub preview in the buffer | shown |
| A recording the server cannot serve as fragments | file player at the same position; the stream stays on it until the setting changes |
| URL expired mid-play (8 s lifetime) | 404, reloaded where it was (one recovery) |
| 21 min played at 8× | JS heap 2.5–7 MB; at most about 390 s buffered (about 357 ahead and 40 behind); about 100 trims |

Found and fixed in that harness:

- After trimming, the stream was no longer ended, so the video waited at
  the end at 8×.
- The first request of each start went out twice.
- A window ending a hair before the play position was asked for again and
  again.
- A seek within the recording dropped the next recording's preload.
- A seek within a recording whose feeder had failed hung.

Check v0.3.1 automates what the v0.3.0 hardware check asked for by hand:

- **S, scrubbing**: previews five points around the play position, as
  dragging the cursor does. Each is shown from the buffer (with its time),
  and a point ten minutes ahead falls back to the thumbnail.
- **H, HD**: presses HD and then SD on the recording playing. It records the
  time to each first frame, and whether each started where the other
  stream was. This runs only with **with HD** ticked: on by default for the
  desktop and Wi-Fi setups, off for the remote ones. HD makes the server
  fetch a main recording from the NVR.

Both ran in Chromium against the harness: 5 of 5 points shown (median 5–6
ms); HD and back with first frames in 107–131 ms, moved 0.03–0.06 s.

`scripts/desktop-check/run-check.mjs` runs the check in Google Chrome
without clicking, through each address given (LAN, Tailscale, Nabu Casa). It
logs in with a long-lived access token and saves each report. It was
checked against a fake HA in the harness: a wrong token stops at the login,
and a run finds the camera, shows progress and saves the report.

Hardware check for v0.3.1 (the step 2 exit criteria):

1. Update to v0.3.1 and restart HA. Reload the panel; in the Companion app,
   reset the frontend cache (Settings → Companion App → Debugging).
2. Desktop: `scripts/desktop-check` with `--url` for the LAN, the Tailscale
   and the Nabu Casa address, `--camera "Front Yard Right"`. The LAN run
   includes HD; add `--session 60` for the one-hour session there.
3. iPhone app, one tap each (Debug → **Run playback check**, the setup
   picked):
   - on home Wi-Fi with **then play for 60 min** (HD is ticked);
   - through Tailscale, and through Nabu Casa (Wi-Fi off), without the
     session.
4. Each report's **Player** line should read `MSE (MediaSource)` on the
   desktop and `MSE (ManagedMediaSource)` on the iPhone. The uncached starts
   should take about the NVR's download up to the target, not a whole-file
   read (22–84 s in step 1).

##### Step 2 hardware results

**Desktop run 5: Mac on the LAN, with HD and the one-hour session** (check
v0.3.1, Chrome 155 on macOS, Front Yard Right, plain HTTP to HA's IP
address, HTTP/1.1; 2026-10-21, run with `scripts/desktop-check`):

| Measure | Result |
| --- | --- |
| Player | MSE (`MediaSource`) |
| Timeline | today 48 ms, a past day 141 ms (store), again 101 ms, today again 196 ms: all under 1 s |
| Events → first frame | 2252, 35 and 32 ms. The first was not cached: 7.4 min into an 8.2 min recording that had just finished, so it waited for the NVR's download up to there. That download took 3.2 s in all (34.7 MB at 86 Mbit/s), and the first frame came before it ended. The other two were seeks within the same recording |
| Deep start, not cached | not measured. The check chose 55.2 min into the 9–10 AM recording (a MOTION event at 9:55). The server had prefetched that recording when the event happened, while it was still being written, and that shorter copy reached the event. The check's peek looked only for the finished recording's copy (fixed in v0.3.2). It played from that copy in 460 ms |
| Deep start, cached | 70 ms |
| Auto-advance | gap 1 ms (preloaded) |
| Rates | on pace at every rate (0.50–8.00×), no stalls. Painted 8, 15, 30, 55 and 54 fps of 8, 15, 30, 60 and 120 needed: smooth at every rate, judged by painted frames. The dropped-frame counter again counted every frame as dropped while the check watched frames; the session's own count below is 0 |
| Scrub | 5 of 5 points shown from the buffer, median 3 ms, each exactly at its point; 10 min ahead: the thumbnail |
| HD switch | first HD frame in 11.3 s, cold. The start was 5.1 min in, and the server fetched the 2.39 GB main recording in 51 s (375 Mbit/s). HD started 0.03 s from where SD was; back to SD in 131 ms, 0.03 s from where HD was |
| Link | 755 Mbit/s (33.6 MB in 356 ms) |
| MSE probe | `MediaSource` plays the MSE-ready fragment and rejects the NVR's shapes, as before |
| One-hour session | 60 min from 9:00 AM: **0 of 53,172 frames dropped, 0 stalls**, one file change with a 7 ms gap, no reloads. JS heap 81.6–114.3 MB (the whole HA frontend), 84.7 MB at the start and 99.7 MB at the end, −0.2 MB/h: no growth. At most 51 s buffered ahead (the 30 s target plus a 20 s window), 61–137 s held in both videos. The cache stayed at 7.44 GB (cap 8.59 GB), the HD recording included. The window was behind another from minute 20; playback went on |

Against the step 2 exit criteria, on the desktop:

- 2A's criteria hold: timelines under 1 s, cached starts in 32–70 ms, an
  auto-advance gap of 1 ms.
- An uncached start began once the bytes up to it were on disk: the first
  event, 90 % into its recording, showed its first frame before the
  download ended. For one deep in an hour-long recording, see run 6.
- Speeds 0.5–8× work; HD/SD keeps the position.
- The one-hour session stays within the buffer and disk caps.

Fixed in v0.3.2 (the check and the Debug panel; playback is unchanged):

1. **D1 chose a recording the server already held.** A start plays from a
   copy made while the recording was shorter, if that copy reaches it, but
   the check's peek (`playback/peek`) looked only for the exact copy. The
   peek now reports such a copy too. D1 and D2 also compare the server's
   state when each start opens: a start whose recording changed state since
   it was chosen is labeled so and not counted. B marks a start that waited
   for the recorder "(not cached)".
2. **The H line printed "?" for the codec.** A main recording not fetched
   yet has no media info. The codec now comes from the MSE type once the
   first frame shows (also in Debug's stream row).
3. **The "HD:" line came after H but said "not tried yet".** That was the
   tab's decision from when it opened. The line now says so, and the
   summary leaves it out when H played HD.

Hardware check for v0.3.2 (what remains of step 2's exit criteria):

1. Update to v0.3.2 and restart HA. Reload the panel; in the Companion app,
   reset the frontend cache (Settings → Companion App → Debugging).
2. Desktop: `scripts/desktop-check` with `--url` for the Nabu Casa address,
   `--camera "Front Yard Right"`, without the session. The LAN run above
   stands. There is no desktop run through Tailscale: the laptop has no
   Tailscale, and the iPhone covers that path.
3. iPhone app, one tap each (Debug → **Run playback check**, the setup
   picked):
   - on home Wi-Fi with **then play for 60 min** (HD is ticked);
   - through Tailscale, and through Nabu Casa (Wi-Fi off), without the
     session.
4. Each report's **Player** line should read `MSE (MediaSource)` on the
   desktop and `MSE (ManagedMediaSource)` on the iPhone. D1 should read
   "Not cached" and take about the NVR's download up to the target.

**Desktop run 6: Mac through Nabu Casa, with HD and the one-hour session**
(check v0.3.2, Chrome 155 on macOS on home Wi-Fi, Front Yard Right; 2026-10-21,
run with `scripts/desktop-check`):

| Measure | Result |
| --- | --- |
| Player | MSE (`MediaSource`) |
| Timeline | today 177 ms, a past day 120 ms (store), again 187 ms, today again 554 ms: all under 1 s |
| Events → first frame | 452, 93 and 102 ms, 38–44 min into today's recording still being written (49.2 min so far). The prefetcher had fetched it (217 MB); the other two were seeks within it |
| Deep start, not cached | **13.0 s**, 56.9 min into a 60 min recording (260 MB, really not cached: a playback fill). The NVR's download took 13.5 s in all (154 Mbit/s); the bytes up to the target (about 247 MB) take 12.8 s at that rate. So the start waited for the download up to the target and nothing more. Through Nabu Casa in step 1 the file player also read the whole original over the link: 27.0 s for 180 MB, 36.6 s for 204 MB |
| Deep start, cached | 144 ms |
| Auto-advance | gap 2 ms (preloaded) |
| Rates | on pace at every rate (0.50–7.99×), no stalls. Painted 8, 15, 30, 51 and 52 fps of 8, 15, 30, 60 and 120 needed: smooth at every rate (4× and 8× need more frames than the display shows). The dropped-frame counter again disagreed |
| Scrub | 5 of 5 points shown from the buffer, median 4 ms, each exactly at its point; 10 min ahead: the thumbnail |
| HD switch | first HD frame in 13.8 s, cold, 5.1 min into the hour (the server fetched the 2.39 GB main recording in 91 s, 210 Mbit/s). It started 0.01 s from where SD was; back to SD in 238 ms, 0.03 s from where HD was |
| Link | 78 Mbit/s (28.6 MB in 2.9 s) |
| MSE probe | as on the LAN |
| One-hour session | 60 min from 11:00 AM through Nabu Casa: **2 of 53,231 frames dropped** (both in the one minute the window was behind another), **0 stalls**, one file change with an 11 ms gap, no reloads. JS heap 85.4–138.5 MB, 86.3 MB at the end, −1.1 MB/h: no growth (the 138.5 MB was the first sample, before a collection). At most 50 s buffered ahead. Cache 8.33–8.42 GB (cap 8.59 GB); at the end 195 MB reserved for the next recording's fill |

On the desktop, step 2's exit criteria are met on the LAN and through Nabu
Casa:

- 2A's criteria hold on both: timelines under 1 s, cached starts in
  32–452 ms, auto-advance gaps of 1–2 ms.
- An uncached start deep in an hour-long recording begins once the bytes up
  to it are on disk: 13.0 s here, which is the NVR's download up to the
  target. The link's speed no longer adds a whole-file read.
- Speeds 0.5–8× work, and the HD/SD switch keeps the position (0.01–0.03 s).
- The one-hour sessions stay within the buffer (at most 51 s ahead) and
  disk caps, with flat memory.

Not an exit criterion, noted for later: the cold HD starts took 11.3 s (LAN)
and 13.8 s (Nabu Casa), 5.1 min into the hour. That is 6–7 s more than the
download up to there at the fill's average rate (about 4.3 and 7.8 s). The
iPhone's (run 5 below) was 7.3 s against about 4.4 s, for a 1.61 GB file.
The report does not show where the time goes. Two steps are not timed:
making room for the 2.39 GB file (deleting about 2 GB of older recordings
before the download starts), and the download's pace in its first seconds.

**iPhone run 5: Wi-Fi, with HD and the one-hour session** (check v0.3.2,
iOS 27.0, Companion app 2026.10.1, Front Yard Right, HA's local address over
HTTP/1.1; 2026-10-21):

| Measure | Result |
| --- | --- |
| Player | MSE (`ManagedMediaSource`) |
| Timeline | today 170 ms, a past day 178 ms, again 126 ms, today again 161 ms: all under 1 s |
| Events → first frame | 1260 ms, not cached, 4.1 min into a 7.9 min recording (the 37 MB download took 1.9 s in all). 210 ms, a seek within it. 9549 ms, not cached, 57.0 min into a 60 min recording: the 265 MB download took 10.1 s (210 Mbit/s), about 9.6 s of it up to there |
| Deep start, not cached | **5.1 s**, 30.1 min into a 40.4 min recording (157 MB; the download took 6.8 s at 186 Mbit/s, about 5.0 s of it up to the target). In step 1 the iPhone waited for the whole file: 22–84 s |
| Deep start, cached | 334 ms |
| Auto-advance | gap 26 ms (preloaded) |
| Rates | on pace at every rate (0.50–8.00×), no stalls, no frames counted as dropped. Painted 7, 15, 30, 56 and 60 fps. 0.5× was judged ✗ on painted frames (7 fps of 9 needed). But the 9 comes from WebKit's decoded-frame counter, which ran about 8 frames ahead in that sample (17.7 frames per second of video, about 15 at the other rates). The longest gap between painted frames was 200 ms, and a skipped frame at 0.5× would leave at least 267 ms: every frame was shown |
| Scrub | 5 of 5 points shown from the buffer, median 287 ms (3–4 ms in Chrome), each within 0.24 s of its point; 10 min ahead: the thumbnail |
| HD switch | first HD frame in 7.3 s, cold, 4.0 min into a 40.4 min recording. The server fetched the 1.61 GB main recording in 44 s (290 Mbit/s); the bytes up to there take about 4.4 s at that rate. HD started 0.00 s from where SD was; back to SD in 299 ms, 0.00 s |
| Link | 373 Mbit/s |
| MSE probe | `ManagedMediaSource` plays every shape, the NVR's own included (Chrome refuses all but the MSE-ready one); no `MediaSource` |
| One-hour session | 60 min from 10:00 AM: **no dropped frames, 0 stalls**, two file changes with 8 ms gaps, and **no reload**: the page lasted the hour. 10–46 s buffered ahead: with `ManagedMediaSource` the system says when to fetch (Chrome kept 30–51 s). Cache steady at 8.33 GB (cap 8.59 GB). JS heap not measurable in WebKit |

The session's frame total (51,986) misses the first minute and the minutes
with a file change. WebKit's counters on the video just swapped in did not
count yet, so it covers about 57 of the 60 minutes. That is a check quirk,
not a playback one.

On the iPhone on Wi-Fi, step 2's exit criteria are met. It plays, seeks
(210–334 ms within a recording) and moves on by itself (8–26 ms). Uncached
deep starts are the NVR's download up to the target (5.1 and 9.5 s, against
22–84 s in step 1). Speeds work, HD/SD keeps the position, and the hour stays
within the caps without a reload.

**iPhone run 6: Tailscale** (check v0.3.2, same phone and app, Wi-Fi off,
HTTPS to the Tailscale address over HTTP/2, without HD or the session;
2026-10-21):

| Measure | Result |
| --- | --- |
| Player | MSE (`ManagedMediaSource`) |
| Timeline | today 188 ms, a past day 165 ms, again 260 ms, today again 277 ms: all under 1 s |
| Events → first frame | 719 ms, 10.2 min into today's recording still being written (prefetched, 50.5 MB). Then 621 and 325 ms, seeks within it |
| Deep start, not cached | **9.2 s**, 55.2 min into a 60 min recording (185 MB; the download took 9.9 s at 150 Mbit/s, about 9.1 s of it up to the target). The link measured 14 Mbit/s. The file player would also have read the whole 185 MB over it, about 106 s more; in step 1 through Tailscale, that read took 35.5 s for 112 MB at 25 Mbit/s |
| Deep start, cached | 373 ms |
| Auto-advance | gap 26 ms (preloaded) |
| Rates | on pace at every rate (0.50–8.00×), no stalls, no frames counted as dropped. 0.5× marked ✗ as in run 5: 51 frames decoded for 3 s of video, longest gap 200 ms |
| Scrub | 5 of 5 points shown from the buffer, median 339 ms, each within 0.98 s of its point: WebKit's `fastSeek` lands on the nearest keyframe, as meant for scrubbing |
| HD switch | not run (off by default on the remote setups) |
| Link | 14 Mbit/s (5.2 MB in 3.0 s) |

Through Tailscale, the iPhone plays, seeks (325–621 ms within a recording)
and moves on by itself (26 ms). The uncached deep start is the NVR's
download up to the target, even over a 14 Mbit/s link.

**iPhone run 7: Nabu Casa** (check v0.3.2, same phone and app, Wi-Fi off,
the Nabu Casa address over HTTPS, without HD or the session; 2026-10-21):

| Measure | Result |
| --- | --- |
| Player | MSE (`ManagedMediaSource`) |
| Timeline | today 85 ms, a past day 167 ms, again 201 ms, today again 234 ms: all under 1 s |
| Events → first frame | 3022 ms, not cached, 14.5 min into a 15.3 min recording: the 68 MB download took 2.7 s in all (210 Mbit/s), about 2.5 s of it up to there. Then 232 and 205 ms, seeks within it |
| Deep start, not cached | **6.9 s**, 41.2 min into a 60 min recording (213 MB; the download took 9.8 s at 175 Mbit/s, about 6.7 s of it up to the target). In step 1, nearly the same start through Nabu Casa (44 of 60 min, 215 MB) took 83.5 s, 72.8 s of it reading the whole file over the link |
| Deep start, cached | 458 ms |
| Auto-advance | gap 25 ms (preloaded) |
| Rates | on pace at every rate (0.50–8.00×), no stalls, no frames counted as dropped. 0.5× marked ✗ as in runs 5 and 6: 53 frames decoded for 3 s of video, longest gap 201 ms |
| Scrub | 5 of 5 points shown from the buffer, median 338 ms, each within 0.22 s of its point |
| HD switch | not run (off by default on the remote setups) |
| Link | 28 Mbit/s (10.1 MB in 2.8 s) |

##### What step 2's hardware check shows (2026-10-21)

Every exit criterion of step 2 is met, on the desktop (LAN and Nabu Casa) and
on the iPhone app (Wi-Fi, Tailscale and Nabu Casa):

- **2A's criteria hold everywhere**: timelines 85–554 ms; starts in a cached
  recording 32–458 ms; auto-advance gaps 1–26 ms.
- **An uncached deep start begins once the bytes up to it are on disk.** Each
  took the NVR's download up to the target and nothing more, whatever the
  link:

  | Run | Setup | Position | File | First frame | Step 1, file player |
  | --- | --- | --- | --- | --- | --- |
  | desktop 6 | Nabu Casa | 57 of 60 min | 260 MB | 13.0 s | 27.0–36.6 s (180–204 MB) |
  | iPhone 5 | Wi-Fi | 57 of 60 min | 265 MB | 9.5 s | 14.2 s (234 MB) |
  | iPhone 5 | Wi-Fi | 30 of 40 min | 157 MB | 5.1 s | |
  | iPhone 6 | Tailscale (14 Mbit/s) | 55 of 60 min | 185 MB | 9.2 s | 42.8 s (112 MB at 25 Mbit/s) |
  | iPhone 7 | Nabu Casa | 41 of 60 min | 213 MB | 6.9 s | 83.5 s (215 MB) |

- **Speeds 0.5–8× work**: on pace on every setup, no stalls. Chrome's
  dropped-frame counter and WebKit's decoded-frame counter both misreport, so
  the check judges by painted frames. Its ✗ at 0.5× on the iPhone is that
  arithmetic: no gap between painted frames exceeded 201 ms, where a skipped
  frame would leave 267 ms.
- **The HD/SD switch keeps the position**: 0.00–0.03 s on three switches each way.
- **One-hour sessions stay within the caps**: three hours played (Chrome on the
  LAN and through Nabu Casa, the iPhone on Wi-Fi). At most 51 s buffered
  ahead, the cache under its 8.59 GB cap, flat memory in Chrome, and no reload
  on the iPhone. 2 frames dropped in all, both while a window was behind
  another.
- **The iPhone app plays, seeks and auto-advances** on Wi-Fi, through
  Tailscale and through Nabu Casa, with `ManagedMediaSource`.

Left for later (not exit criteria): cold HD starts carry 3–7 s the report
does not account for (above); the check's 0.5× judgement on WebKit; and the
session's frame total across file changes on WebKit.

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

1. **go2rtc lifecycle:** reolink_viewer runs its own go2rtc as a supervised
   subprocess with its API bound to localhost, its own generated config and API
   credentials. It uses the binary Home Assistant's container ships
   (`/bin/go2rtc`), and downloads a pinned release, checksum verified, only
   where that is missing (e.g. HA Core installs).
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
  sessions. (The owner revised it on 2026-10-26: Home Assistant runs live view for 24
  hours, which needs no page open, and the grid is visible for 8 hours in all, in as
  many sittings and on as many devices as suits. See "Phase 3 exit".)
- Camera CPU and session counts stay within the Phase 0 limits.
- Battery cameras sleep normally when not viewed.

Risks:

- Per-model protocol quirks → the hardware matrix and per-camera source override.
- Remote WebRTC → TURN or MSE fallback.
- Two-way audio support on Reolink is uncertain → deferred.

### Phase 3 status

Phase 3 runs in three steps: **0** fixes what the Phase 2B review found,
**1** runs our own go2rtc and measures live view on the owner's hardware (the
gate), **2** builds live view from what step 1 decides.

| Step | Status |
| --- | --- |
| 0. Fix four Phase 2B findings (a failing test for each first) | **Done** (v0.4.0), see "Step 0" below |
| 1. Our own go2rtc, and a live check in the panel (gate) | **Done** (v0.4.0), see "Step 1 as built". Every setup's report is in: desktop Chrome on the LAN (run 5), the iPhone app on Wi-Fi (run 11), through Tailscale (run 12) and through Nabu Casa (run 13) |
| 1. Record the reports here and in the hardware matrix; decide the live stream budget, WebRTC or MSE per setup, which cameras stay warm, the HD stream per camera | **Desktop Chrome on the LAN: recorded and decided** (v0.4.1), see "Step 1 results". **Done for every setup.** Desktop Chrome on the LAN (v0.4.1), see "Step 1 results"; the iPhone app on Wi-Fi, through Tailscale and through Nabu Casa (runs 11–13), see "Step 2: the iPhone on Wi-Fi", "… through Tailscale" and "… through Nabu Casa". The rules are fixed below, before seeing the reports |
| 2. Stream registry, delivery, Live tab and grid, keep warm, debug panel | **Done** (v0.5.0–v0.15.1); every exit criterion is met, see "Phase 3 exit". The key-frame cache is built (v0.5.0) and measured on the desktop (run 6), see "Step 2: the key-frame cache"; v0.5.1 rebuilds the MSE init segment and records why warm feeds end (run 7: the sizes are right). v0.5.2 measured the last two oddities (run 8); v0.5.3 fixed the late H.264 paints (run 9: warm MSE median 0.15 s); run 10 (v0.5.4) confirms it. v0.5.5 files each live check report under its device. v0.6.0 keeps each camera's last picture for the tiles, see "Step 2: the image cache"; the live check measures it. v0.7.0: the Live grid and each camera's Live tab, see "Step 2: the Live grid". v0.8.0: keep warm per camera and the NVR budget of 7, see "Step 2: keep warm". v0.9.0: full-screen HD, see "Step 2: full-screen HD". v0.10.0: the camera's controls over its live view, see "Step 2: PTZ, presets, siren and floodlight". The owner checked v0.9.0 and v0.10.0 on the hardware. v0.11.0: the E1 Zoom's picture first, see "Step 2: the picture first"; the owner checked it on the hardware. v0.12.0: a battery camera on wired power is watched like the others, see "Step 2: battery cameras on wired power"; v0.12.1 fixes the Doorbell being shown picture-first; the owner checked it on the hardware. v0.13.0: a debug view per tile, see "Step 2: the debug view per tile". v0.14.0: the soak report, see "Step 2: the soak report". v0.15.0 keeps the soak run on the server and stores it, so a hidden page, a reload or a restart no longer starts it over, and any device can read the report; see "Step 2: the soak run outlives the page". The owner revised the soak (24 h of Home Assistant, 8 visible grid hours in all); Home Assistant's half is met (run 14). v0.15.1 takes the first sample once live view is up, not as Home Assistant starts. The soak passed on v0.15.1 (run 15); every tile's first image comes in a median 0.02 s on the iPhone (run 16) and the Mac (run 17); the Phase 2 playback criteria held with live view running (runs 18–19). Phase 3 is done |

#### Step 0: four Phase 2B findings (v0.4.0)

Each was reproduced by a test that failed before the fix.

1. **A seek back into trimmed media stalled** (`mse-feeder.ts`). After
   `_trim` removed media behind the play position, `_runStartS` still marked
   where the run of windows began. A seek back into the trimmed part (a
   timeline click, the previous event) asked for the next fragment by index,
   which lay ahead, so the video waited. Now:
   - the run of windows follows every removal (its start moves on; it is
     dropped once its end is removed);
   - the feeder extends by index only at the end of what it appended last;
     anywhere else it asks by time;
   - an empty last window ends the media where the run ended (the search's
     length can be a little longer), and the next request waits 1 s: before,
     it asked for the same index again at once, in a loop.
2. **Leases blocked HD.** Each `playback/mse` or `playback/url` call leased its
   recording for 30 min + its length + 1 min, and nothing released it when
   the player moved on. With 2.4–3.8 GB main recordings and the 8 GiB cap, a
   third HD recording could not be cached. Now:
   - a lease belongs to its URL (the grant's token);
   - the player releases it as soon as it no longer holds the recording
     (`playback/release`): a new start, a new preload, the end of a file, or
     leaving the tab;
   - every request through the URL marks the lease as used;
   - a fill behind a click (playback priority) may evict a recording whose
     leases nobody used for 5 minutes (a closed page, a long pause); prefetch
     fills never evict a live lease;
   - a player that comes back to an evicted recording gets it fetched again,
     and leased again.
3. **A window could be flagged last too early** (`vodcache.async_window`).
   `last` came from `entry.complete` after the scan, not from the state the
   scan saw; a fill completing during the scan ended the stream with
   fragments still to come. It now uses the scan's snapshot.
4. **A fill failing mid-window raised from the view.** `_read_fragments`
   raised `FileNotFoundError` once the failed fill had removed its file, after
   the window's headers were sent. It is now a `VodCacheError`, and the view
   ends the body cleanly (the player sees a short window, then the error on
   its next request, and reloads).

#### Step 1 as built (v0.4.0)

**Our go2rtc** (`custom_components/reolink_viewer/live/`), not Home
Assistant's:

- **Binary** (`binary.py`): `shutil.which("go2rtc")`, as HA's go2rtc
  integration does (HA's container ships 1.9.14 at `/bin/go2rtc`), if it is
  1.9.13 or newer. Otherwise the pinned 1.9.14 release for this machine
  (amd64, arm64, arm, armv6, i386), downloaded once into
  `<config>/.cache/reolink_viewer/go2rtc/`; its SHA-256 is checked before
  every use, and a file that does not match is deleted.
- **Ports**: the API on 127.0.0.1 at a free port picked at each start, its
  RTSP server on 127.0.0.1 likewise (go2rtc's own ffmpeg reads it to
  transcode audio in step 2), and WebRTC media on **18556** (TCP and UDP). HA's
  11984, 18554 and 18555 are left alone.
- **Locked down**: every API and RTSP request needs the generated
  credentials, local ones included (`local_auth`). Only the API paths used are
  served (`/api`, `/api/streams`, `/api/preload`, `/api/ws`,
  `/api/frame.jpeg`, `/api/stream.mp4`); there is no web UI. `exec` may run
  ffmpeg only, and go2rtc refuses `exec:` sources from the API anyway.
- **No credentials on disk**: the config file holds no secret (the password
  comes from the environment). Streams are registered at runtime through the
  API (`PATCH /api/streams`, kept in memory). The config path go2rtc saves API
  changes to is `/dev/null`. Verified with go2rtc 1.9.14: `PUT` would try to
  save the camera URL to the config path, `PATCH` does not.
- **Supervision** (`go2rtc.py`): it starts on the first live request (an
  installation that never watches live never runs it). It is restarted with
  backoff (1, 2, 5, 10, 30, 60 s; back to 1 s after 5 minutes up) when it exits
  or its API stops answering. A missing binary, or two failed starts in a
  row, makes requests fail at once with the reason instead of waiting. It
  stops when the entry unloads and when Home Assistant stops.
- **Errors**: `live/status` and the live check show the state, version,
  binary (HA's or downloaded), last error and restarts, and for admins the
  last 50 log lines. go2rtc's output goes to Home Assistant's log (its INF
  lines at debug, WRN/ERR at warning) with every URL and address removed:
  go2rtc 1.9.14 logs stream URLs with their credentials.

**Streams** (`streams.py`): one go2rtc stream per camera connection and
stream, named `rv_<key>_<sub|main|ext>` (the key reveals no identifier):

- RTSP for main and sub (with `#backchannel=0`: no two-way audio yet),
  HTTP-FLV for ext (Reolink has no ext over RTSP), per the Phase 0 decision.
- The camera URL comes from the Reolink integration's connection through the
  scheduler (live priority) and goes straight to go2rtc's API.
- A running stream is one connection to the camera, however many watch it:
  the first *hold* (a browser session, a preload) takes one slot of the
  host's stream budget at live priority, ahead of recording downloads, and
  the last gives it back. The budget's size is step 1's decision; until then
  it is the Phase 2 one (NVR 4, cameras 2).
- A stream is registered again each time it starts from idle, so a reloaded
  Reolink entry or a restarted go2rtc is picked up; preloads are restored
  after a restart.

**Delivery, as far as the check needs it**:

- WebRTC: `reolink_viewer/live/webrtc` (a subscription) sends the browser's
  offer to go2rtc's websocket with Home Assistant's ICE servers
  (`web_rtc.async_get_ice_servers`: Nabu Casa's TURN for subscribers, else
  HA's STUN) and relays go2rtc's answer and candidates back; the browser's
  candidates go through `live/candidate` (trickle ICE both ways). The browser
  takes the same ICE servers from `web_rtc/ice_servers`.
- MSE: `live/mse` returns a signed path (2 minutes) to a websocket view that
  pipes go2rtc's `/api/ws` for that one stream. The browser may only ask for
  MSE; go2rtc's fragments come back as binary messages. `ManagedMediaSource`
  where it exists (the iOS app), else `MediaSource`.
- A frame: `live/frame` returns a signed path to a JPEG from go2rtc.
- Keep warm: `live/preload` (admin) turns go2rtc's preload on or off.

**The capacity test** (`capacity.py`, `live/capacity`, admin): per NVR, it
takes every slot of the host's stream budget and runs as one exclusive
scheduler job, so nothing else reaches the NVR. It reads streams through our
go2rtc as a viewer would (`stream.mp4`, counting frames), adding one per
level and keeping the earlier ones open: the sub stream of each channel, then
the heaviest main, then a recording download at full speed (after a
baseline of the download alone). Per level: the new stream's time to its
first frame, every stream's frames per second against the camera's
setting, the longest gap, the download's speed, and the clients the NVR
lists as logged in. reolink-aio 0.21.18 has no session counter; the bridge
sends the read-only `GetOnline` command through reolink-aio's generic request
and reports the length of its list, or why it could not. The first level that
fails (a stream without frames) or slows down (below 85 % of its frame rate,
a first frame over twice level 1's and 3 s more (v0.5.4: past a 4.5 s
key-frame wait and 3 s, run 9), or the download below 70 %
of its speed alone) is the verdict.

**The live check** (Reolink → **Open the live check**; `frontend/src/live/`):
for every camera connection (the CX410 and CX810 both through the NVR and
directly) and every stream ticked (sub, main, ext), on the device it runs on:

| Part | What it measures |
| --- | --- |
| Header | browser, how HA is reached, MSE API and the codecs it takes, the codecs WebRTC receives, HA's ICE servers (kinds only), go2rtc's state |
| cold | WebRTC, then MSE, each after go2rtc has let go of the camera: time to the first painted frame (`requestVideoFrameCallback`), and the steps (answer, ICE connected; MIME type, first data, first append), the candidate pair (host, srflx or relay; UDP or TCP), codec and size |
| Home Assistant's view | where the stream's HA camera entity is enabled: its snapshot (the poster HA's view shows, `camera_proxy`) and HA's own WebRTC (`camera/webrtc/offer` to HA's go2rtc), as its camera view does |
| warm (admin) | the stream kept warm (go2rtc preload): how long the camera took to connect, a frame from go2rtc (the poster step 2 can show), then WebRTC and MSE. Never on battery cameras |
| Capacity (admin) | the test above, per NVR; on by default for the LAN setups only (it downloads a recording at full speed) |
| Summary | WebRTC connected in how many sessions and by which candidates; medians cold and warm per transport for sub and for main/ext; HA's view against ours; first-image medians; NVR against direct per merged camera; each NVR's verdict |

Reports are saved on the server as the check runs (with the playback check's,
marked "Live check") and listed under **Saved reports** on any device.
`scripts/desktop-check` runs it in Chrome without clicking (`--check live`).

Checked:

- Python: 517 tests, 94 % coverage, with go2rtc 1.9.14 itself: CI fetches the
  pinned release with `scripts/fetch_go2rtc.py` (checksum verified) and runs
  the live tests against it and a fake camera (a second go2rtc serving
  ffmpeg's test sources over RTSP). They cover the lock-down (no UI, no
  unauthenticated request, no credential in any file), restart after a kill,
  stop with Home Assistant, HTTP-FLV for ext, MSE through the proxy, frames,
  preload, the WebRTC relay, the capacity test, and the error paths.
- CI job "MSE and live in Chromium": Chromium talks to Home Assistant's
  websocket API, gets a WebRTC session through `live/webrtc` (trickle ICE both
  ways) that connects and receives media, then buffers MSE through the signed
  proxy. Playwright's Chromium has no H.264, so this uses the fake camera's
  Opus stream: the signaling, ICE and media paths are the ones video uses.
- Panel: 163 tests, the WebRTC, HA and MSE sessions against fakes, and the
  check's flow and report.
- Not checked here: H.264 and H.265 video over WebRTC in a real browser, and
  Reolink devices. That is what the hardware run is for.

#### How to run the live check (the step 1 gate)

Once, after updating to v0.4.0 and restarting Home Assistant: reload the
panel; in the Companion app, reset the frontend cache (Settings → Companion
App → Debugging). Close other live views of the cameras while a check runs
(they would keep streams warm). Run as an admin (the warm part and the
capacity test need it).

1. **Desktop Chrome on the LAN** (includes the capacity test):
   `cd scripts/desktop-check && HA_TOKEN=... node run-check.mjs --check live
   --url http://<HA's LAN address>:8123`. Or in Chrome: Reolink → **Open the
   live check** → Setup *Desktop Chrome, LAN* → **Run live check**. About
   15–20 minutes for every camera and stream; leave the window in front.
2. **iPhone Companion app on home Wi-Fi**: Reolink → **Open the live check**
   → Setup *iPhone app, Wi-Fi (local)* (v0.5.5 starts on it on an iPhone) →
   **Run live check**. Set Auto-Lock to Never first and keep the app in front.
   The capacity test is ticked; it runs on the server, so one run of it (from
   either the desktop or this one) is enough: untick it if the desktop run had
   it.
3. **iPhone app through Tailscale** (Wi-Fi off, Tailscale on, the app pointed
   at the Tailscale address): Setup *iPhone app, Tailscale*.
4. **iPhone app through Nabu Casa** (Wi-Fi off, Tailscale off, the external
   URL): Setup *iPhone app, Nabu Casa*.
5. Each report: **Copy report**, or later on the desktop: Live check →
   **Saved reports** → Copy. Each saved report is listed with its setup, the
   check's version and the browser it ran in (v0.5.5), so an iPhone report
   reads "iOS …, Companion app …". Where copying is blocked, the report's
   text shows on the page to select. Send all four.

#### What the reports decide (rules fixed before seeing them)

- **Live stream budget per host** (shared with recording downloads): the
  number of streams at the last capacity level that kept up, less one for
  headroom, and at least the current 4 on the NVR. If the NVR keeps up with
  all six subs, a main and a download, its budget becomes 7 (6 + 1 + 1 − 1).
  Prefetch downloads stay limited to one. Cameras added directly keep 2 unless
  their own numbers say otherwise (the Phase 0 probe saw them slow from 4).
- **WebRTC or MSE per setup**: WebRTC where it connected in every session of
  that setup and its median first frame is within 0.3 s of MSE's or better;
  MSE where any session failed to connect, or where it is slower by more.
  Either way the other is the automatic fallback.
- **Kept warm by default**: mains-powered cameras whose cold sub start misses
  the 1.5 s target while their warm start meets it, as many as the budget
  allows after the grid and one HD stream; never battery cameras. Each
  camera gets its own setting either way.
- **HD stream per camera**: the main where it is H.264, or H.265 that the
  device decodes (MSE accepts `hvc1` and `decodingInfo` says supported and
  smooth at its size; over WebRTC, where go2rtc and the browser agree on
  H.265); otherwise ext. The Duo 3 uses ext (7680×2160 is past most
  decoders).
- **The CX410 and CX810 direct entries**: if live through the NVR starts
  within 0.3 s of the direct connection (cold and warm sub) and the NVR keeps
  up at the grid's level, they can go.

#### Step 1 results: desktop Chrome on the LAN (2026-10-21)

The report is in the hardware matrix (run 5, with its findings). The iPhone
runs (Wi-Fi, Tailscale, Nabu Casa) are still to come. By the rules above, the
LAN run decides:

- **NVR budget: 7.** The last capacity level held six subs, the Duo 3's main
  and a full-speed download, all at their frame rates (8, less one).
  Prefetch downloads stay limited to one. Cameras added directly keep 2: the
  run has no new numbers for them.
- **Desktop Chrome on the LAN: WebRTC**, with MSE as the fallback. WebRTC
  connected in every session that had a stream (host to host, UDP), and its
  medians beat MSE's: 1.78 against 4.19 s on subs, 1.89 against 2.00 s on
  mains and ext.
- **HD on desktop Chrome: the main stream on every camera but the Duo 3, which
  uses ext.** Desktop Chrome decodes the H.265 mains (RLC-520A "Garage",
  CX810, E1 Zoom, Doorbell) over both transports. The iPhone runs decide the
  H.265 cameras there.
- **The CX410 and CX810 direct entries can go.** Through the NVR they start
  as fast (cold sub 1.20 against 1.28 s and 3.26 against 3.64 s; warm within
  0.03 s), and the NVR keeps up with more than the grid needs. Live view uses
  the NVR connection. Removing the direct entries from Home Assistant is the
  owner's call.
- **Kept warm by default: none.** No camera's warm sub start met 1.5 s where
  its cold one missed. Keeping a stream open does not shorten the wait for the
  camera's next key frame, and that wait is most of every start.

What the run changes in step 2:

1. **The warm target needs a key-frame cache.** go2rtc gives a new viewer
   nothing until the camera's next key frame: every ~4 s on most subs, ~2 s on
   mains. There are two ways around it, and they can be combined:
   - **Shorter key frames on the sub streams.** The owner sets this in the
     Reolink app or client, where the model offers it. The CX410's sub, at
     1 s, starts in 0.84–0.99 s. It helps every viewer, Home Assistant's and
     the Reolink app's too. The cost is a little more bitrate on the sub
     stream for the same picture, and the NVR records the sub too. Home
     Assistant has no entity for it, and settings go through HA only, so the
     integration does not change it.
   - **A key-frame cache in the integration**, for streams kept warm. The
     MSE proxy reads each warm stream once and keeps the init segment plus
     everything since the last key frame. A new viewer gets all of that at
     once: the browser decodes from the key frame and jumps to the newest
     frame. This works whatever the camera's key-frame interval. It is MSE
     only (WebRTC cannot be fed old frames), so warm cameras would play over
     MSE. The cache can also rebuild the init segment from the stream's own
     parameter sets (the MSE picture-size finding).

   Proposed: build the cache in step 2, and try shorter key frames on one
   camera now (the live check can run on one camera). **Decided (owner,
   2026-10-21): build the cache.** Built in v0.5.0 (below).
2. **Tiles need a cached first image.** Neither HA's snapshot (median
   0.64 s) nor go2rtc's frame (1.69 s) meets 0.5 s. The server keeps each
   camera's last image, refreshed in the background through the scheduler
   while a live page is open (and from the cache when the camera is warm). A
   tile shows it at once.
3. **MSE picture size.** Three NVR streams reported a different size over MSE
   than over WebRTC: the init segment carries the NVR's stream description,
   not the stream's own parameters. Step 2 corrects the size from the stream
   and shows both sizes in the tile's debug entry.
4. **Fixed in v0.4.1:** the battery Doorbell, added directly, is Baichuan only.
   reolink-aio still built an HTTP-FLV URL for it, with the port "None", so
   its ext failed. FLV and RTMP now need the HTTP API (as the Phase 0 probe
   already assumed), and a connection lists only the streams it can serve.

#### Step 2: the key-frame cache (v0.5.0)

`live/relay.py`. go2rtc gives a new viewer nothing until the camera's next key
frame, and keeps no frame for one. So the integration keeps it:

- **One feed per stream.** A feed is one go2rtc MSE consumer of a stream,
  shared by every MSE viewer of it. It keeps the init segment and every
  fragment since the last video key frame (go2rtc writes one `moof` + `mdat`
  per frame and marks key frames in the sample flags, so only box headers
  and flags are read). A viewer who joins gets the init segment and those
  fragments at once, in one message, then the rest as it comes. The player
  starts 0.5 s before the newest frame; the browser decodes from the key
  frame to get there.
- **The MSE websocket** (`live/mse`) joins the stream's feed instead of
  opening its own go2rtc consumer. Its protocol is unchanged: the browser
  sends the codecs it plays, and gets the MIME type, then media. go2rtc picks
  a feed's tracks from its first viewer's codecs. A viewer shares a feed if
  it can play every codec the feed carries; otherwise it gets a feed of its
  own. Either way the stream is one camera connection and one slot.
- **Keeping a stream warm** (`live/preload`, admin) keeps its feed open
  without viewers, which keeps the camera connected and its last key frame
  cached. It replaces go2rtc's preload, which kept the connection but no
  frame (go2rtc's `/api/preload` is no longer allowed). It answers once the first key frame is cached. A warm feed that ends
  (go2rtc restarted, the camera dropped it) opens again after 1, 2, 5, 10,
  30, 60 s. Any other feed closes with its last viewer.
- **Limits.** A viewer whose data has waited more than 10 s to be sent is
  dropped (the player reconnects, at the newest key frame). More than 32 MB
  since a key frame means none is coming, and nothing is kept.
- **After a go2rtc restart**, a stream is registered again on its next hold
  even while others hold it (go2rtc forgets its streams).
- **Diagnostics** (`live/state` → `cache`): the key-frame interval as seen,
  the media cached, and whether the init segment's parameter sets (from the
  stream's description) match the key frames' own (`same`, `differ`, `none`
  in the key frame). That last one tests the MSE picture-size finding on the
  next hardware run.
- **The live check (v0.5.0)**: its warm part now uses the cache. It reports
  how long the first key frame took to be cached, the key-frame interval and
  the parameter sets. Warm MSE should then start in a few hundred ms; warm
  WebRTC still waits for the next key frame.

WebRTC cannot use the cache (it cannot be sent past frames). So where a setup
uses WebRTC, warm cameras use MSE.

Checked: 12 unit tests against a fake go2rtc websocket (sharing, codecs,
errors, slow viewers, the size cap, audio only, keep warm and its retries).
Against go2rtc 1.9.14 and a fake camera with 4 s key frames: a viewer of a
warm stream, 1.5 s after a key frame, got the init segment and the cached
frames from that key frame in under 1 s; the next key frame was 2.5 s away.
Chromium plays MSE through the cache (the audio-only stream).

#### Step 2: the cache measured (run 6, desktop Chrome on Wi-Fi)

The report is in the hardware matrix (run 6). Warm MSE now starts in a median
0.71 s on subs and 0.41 s on mains and ext (run 5: 4.86 s and 2.09 s). What it
decides, by the rules above (desktop; the iPhone runs may change the
transports there):

- **Desktop Chrome: WebRTC for a cold stream, MSE for a warm one.** Cold, WebRTC
  stays ahead (sub median 2.67 s against 4.52 s; mains and ext within 0.05 s).
  Warm, MSE from the cache wins by 1.4–3.2 s (medians).
- **Kept warm by default** (mains-powered cameras whose cold sub start misses
  1.5 s and whose warm start meets it): **Garage, Front Yard Left, Back Yard,
  Dogs and Laundry Room.** Their warm MSE sub starts were 0.23–1.41 s; their cold
  starts 1.6–4.2 s across runs 5 and 6. Not kept warm:
  - Front Yard Right: its 1 s key frames start it in under 1 s cold.
  - the Hallway: its warm start (3.69 s) waited for a later key frame because of
    its parameter sets; it is measured again with v0.5.1.
  - the Doorbell: a battery camera.

  Four warm NVR subs hold four of its seven slots while nothing is watched. With
  the grid open they are four of its six streams, which leaves one for HD. The
  Laundry Room's warm sub holds one of its two slots, leaving one for HD.
- **The direct CX410 and CX810 entries can still go.** Their warm starts through
  the NVR (0.71 s and 0.81 s) need no direct connection.

v0.5.1, from what run 6 showed:

- **The MSE init segment is rebuilt from the stream** (`live/h26x.py`). When the
  first key frame's parameter sets differ from go2rtc's init segment, the relay
  replaces them before any viewer gets the init segment:
  - the `avcC` or `hvcC` box (for H.265, also the profile and level from the new
    SPS);
  - the sample entry's and the track header's width and height, which come
    from the new SPS: the picture size after cropping, read with an Exp-Golomb
    reader.

  `live/state` reports `rebuilt`. This should fix the three wrong MSE sizes and
  the two late decodes.
- **Why warm feeds end.** Each stream's unexpected feed ends are counted with
  the last reason (`live/state` → `ends`, `last_end`), and a warm feed that ends
  is logged as a warning. The live check shows both on the warm line and ends
  its report with go2rtc's last 50 log lines (admins; addresses and passwords
  removed).

Checked: the picture size of five real SPS from libx264 and libx265 (cropped
360 and 432 lines included); H.264 and H.265 init rebuilds; a relay test where
go2rtc's init carries 640×480 parameter sets and the key frame 640×360 ones
(the viewer gets the rebuilt init segment); end counting.

#### Step 2: the rebuilt init segment measured (run 7, v0.5.1)

The report is in the hardware matrix (run 7).

- **The rebuild works**: the three streams MSE showed at the wrong size now
  show WebRTC's size, and ten streams reported their parameter sets rebuilt.
  Warm MSE: median 0.71 s on subs, 0.39 s on mains and ext; 23 of 27 under 1 s.
- **The decisions stand.** The Hallway stays off the warm list: its sub still
  paints one key-frame interval late over MSE, and its cold WebRTC start (1.1 to
  1.6 s in three runs) is about the 1.5 s target anyway.
- **Not explained yet:**
  - the Hallway sub's late MSE paint (and the Laundry sub's, 1.2 s);
  - two warm MSE starts that waited 1.6–1.9 s for go2rtc's answer with no feed
    ended;
  - go2rtc logged nothing but its start.

v0.5.2 adds to the live check:

- **MSE steps.** The signed URL and the websocket's opening, in time order with
  the rest.
- **The feed's age** on the warm line ("feed opened N s before"). A feed
  younger than the session that joined it was opened for that session.
- **A video-only retry.** An MSE start that painted more than 1 s after its data
  arrived is tried again over video only. If that one paints at once, audio was
  holding the start back.

#### Step 2: frames in decode order (run 8, v0.5.2 → v0.5.3)

The report is in the hardware matrix (run 8). Both oddities run 7 left are
explained:

- **Slow warm starts** come from Home Assistant: the one slow warm start in run
  8 waited 1.23 s for its signed URL on Home Assistant's websocket. The relay
  answered 20–30 ms after the websocket opened, every time, and no warm feed was
  reopened. **Step 2: a tile asks for its signed URLs as it appears, before it
  starts**, so a start never waits on that round trip (they stay valid 2
  minutes).
- **Late MSE paints** are the decoder's reorder buffer. Over video only they
  are just as late. Every H.265 stream paints within 40 ms of its data. Most
  H.264 sub streams paint about 16 frames late (1.0 s at 15 fps, 1.5 s at 10
  fps; the Hallway's 7 fps sub at its next key frame). Their SPS sets no reorder
  limit, so the decoder must allow for B-frames: Chrome on macOS keeps up to 16
  decoded frames before showing the first, and the picture stays that far
  behind live. WebRTC is not affected.

v0.5.3:

- **The relay says decode order** (`live/h26x.py`, `relay.py`). An H.264 SPS
  whose picture order count type is 0 or 1 and that has no VUI bitstream
  restriction gets one: `max_num_reorder_frames` 0, `max_dec_frame_buffering`
  the stream's reference frames, the spec's defaults for the rest. It is added
  to the VUI, or a VUI is added. The patched SPS replaces the stream's in the
  init segment and in every key frame (with the sample size in the `moof`).
  These cameras' streams play in decode order over WebRTC, which shows frames
  as they are decoded, so nothing is reordered.
- **Diagnostics.** `live/state` → `frame_order`: `decode order` (POC type 2),
  `reorder N` (the stream's own limit, kept) or `limit added`. The live check's
  warm line shows it.

Checked:
- **The SPS parser** agrees with ffmpeg's `trace_headers` on x264 output:
  fields and the bit positions of the VUI and restriction flags.
- **The rewrite**, with the restriction removed from x264's SPS (VUI kept, or
  the whole VUI removed) and then added again: ffmpeg decodes the stream
  without an error and reads `max_num_reorder_frames = 0` and
  `max_dec_frame_buffering = 4`.
- **The relay** sends the patched SPS in the init segment and in every key
  frame. Its fragments match, byte for byte, what go2rtc writes for that
  sample.
- **The moof sample-size rewrite**, in the tfhd or the trun; other layouts are
  left alone.

#### Step 2: MSE in decode order measured (run 9, v0.5.3)

The report is in the hardware matrix (run 9). With every H.264 stream's SPS
saying decode order, MSE shows a frame as soon as it arrives:
- **Warm MSE** starts in 0.13–0.70 s on all 27 streams: median 0.15 s on subs,
  0.19 s on mains and ext.
- **Cold MSE subs** start like cold WebRTC (1.08 s against 1.07 s).

What it decides, by the rules (desktop):

- **Desktop Chrome: WebRTC for a cold stream, MSE for a warm one** (unchanged).
  Cold: WebRTC sub 1.07 s against MSE 1.08 s (within 0.3 s), mains and ext
  1.17 s against 1.60 s. Warm: MSE 0.15 s against WebRTC 3.88 s. MSE also
  carries the cameras' AAC audio as it is; WebRTC needs it transcoded.
- **Kept warm by default: Garage, Hallway, Front Yard Left, Back Yard, Dogs and
  Laundry Room.** Every mains-powered camera with 4 s sub key frames: their cold
  start is wherever the camera is in its interval (0.2–4.6 s; each missed 1.5 s
  in at least one run). Warm, they start in 0.13–0.20 s. Front Yard Right is not
  on the list: its 1 s key frames start it cold in 0.5–1.2 s. The Doorbell is a
  battery camera.
- **Budget.** The five warm NVR subs hold five of its seven slots while nothing
  is watched. With the grid open they are five of its six streams, and one slot
  is left for HD. The Laundry Room's warm sub holds one of its two slots.
- **The NVR budget stays 7.** Every level of every run kept its frame rate.
  Run 9's verdict flagged level 6 only for a first frame within a key-frame
  interval (see below).

v0.5.4:

- **The capacity verdict's first-frame rule.** A new stream's first frame
  counts as a slowdown only when it takes longer than the longest key-frame
  interval these cameras use (4.5 s) and 3 s more. Before, the rule compared it
  with level 1's, and both are where the camera happened to be in its interval
  (0.16–4.16 s across runs 5–9).

The exit criteria, on the desktop:
- Warm streams play live in under 1.5 s: yes, 0.70 s at worst.
- Cold times are recorded: yes.
- Live is faster than the stock view: yes, 19 of 19 streams.
- Every tile shows its snapshot in under 0.5 s: no. HA's snapshot takes a
  median 0.59 s, so this needs step 2's image cache.

#### Step 2: run 10 and the iPhone reports (v0.5.4, v0.5.5)

Run 10 (v0.5.4, the Mac on Wi-Fi) repeats run 9, so the desktop decisions
stand:
- **Warm MSE:** median 0.15 s on subs and 0.21 s on mains and ext. All 27
  streams are under 0.7 s.
- **Capacity:** the new verdict passes at every level. Level 1's 3.46 s first
  frame and level 2's 3.99 s are within the key-frame wait.
- **HA's snapshot:** median 0.43 s, but it failed on 5 of 19 entities (Dogs'
  sub, both Laundry Room streams and both Doorbell streams). Across runs 6–10
  it failed on 0–8 entities per run, which is one more reason for step 2's own
  image cache.

v0.5.5 makes the live check hard to file under the wrong device. A report sent
as the iPhone Wi-Fi run was the Mac's run 8, copied from the saved reports,
which named only the setup and the time:
- **The setup starts on this device's**, *iPhone app, Wi-Fi (local)* on an
  iPhone, else *Desktop Chrome, LAN*. It then remembers the last choice on that
  device. A setup that names the other kind of device shows a warning.
- **Saved reports show where they ran:** the setup, the check's version and
  the browser, from the report's first lines.
- **Copy works on plain-HTTP pages.** On the iPhone, v0.5.4's Copy did nothing:
  the Companion app on the LAN often loads HA over HTTP, where the Clipboard
  API does not exist. Copying now falls back to a selected text area, as the
  playback check's did, placed off screen the way clipboard.js does it for iOS.
  Where copying is blocked anyway, the page says so, shows the report's text,
  and points to Saved reports on a computer (every run is saved on the server).

#### Step 2: the iPhone on Wi-Fi (run 11, v0.5.5)

The report is in the hardware matrix (run 11): the Companion app on home Wi-Fi,
with the page over HTTP from the LAN address. Every session played: WebRTC
connected in 56 of 56, and MSE (ManagedMediaSource) played all 29 cold and all
27 warm streams.

What it decides, by the rules:

- **The iPhone app on Wi-Fi: WebRTC for a cold stream, MSE for a warm one**,
  as on the desktop.
  - Cold, WebRTC is as fast or faster: 2.51 s against MSE's 3.61 s on subs,
    and 1.35 s against 1.47 s on mains and ext (within 0.3 s). Both wait for
    the camera's next key frame.
  - Warm, MSE starts at once from the key-frame cache: 0.09 s on subs and
    0.17 s on mains and ext, against WebRTC's 3.91 s and 1.90 s.
  - MSE carries the cameras' AAC audio as it is (ManagedMediaSource takes
    `mp4a`).
- **HD on the iPhone: the main stream on every camera but the Duo 3, which
  uses ext**, as on the desktop. ManagedMediaSource accepts `hvc1`, and WebRTC
  agreed on H.265 in every H.265 session. Each H.265 main played over both
  transports: the RLC-520A "Garage", the CX810 (3840×2160), the E1 Zoom and
  the Doorbell. Warm MSE started the mains-powered ones in 0.22–0.30 s. The
  panel still asks `decodingInfo` at each camera's size before it picks the
  main, and uses ext where the answer is not smooth. The Duo 3's 7680×2160
  main painted its first frame too (0.69 s warm), but the rule keeps it on
  ext: a first frame says nothing about decoding 20 fps at that size.
- **Kept warm by default: unchanged** (Garage, Hallway, Front Yard Left, Back
  Yard, Dogs and Laundry Room). Cold, their subs took 2.37–3.87 s, except
  Dogs, whose 0.44 s landed just before a key frame. Warm, every one started
  in 0.07–0.10 s.
- **The CX410 and CX810 direct entries can still go.** Through the NVR their
  cold subs started within 0.1 s of the direct ones (0.82 against 0.87 s, and
  3.36 against 3.28 s), and warm within 0.02 s.

The exit criteria, on the iPhone at home:
- Warm streams play live in under 1.5 s: yes, 0.69 s at worst (the Duo 3's
  main).
- Live is faster than the stock view: yes, 19 of 19 streams. Home
  Assistant's view took a median 1.76 s here.
- The iPhone works on Wi-Fi: yes.
- Every tile shows its snapshot in under 0.5 s: no. HA's snapshot took a
  median 0.57 s, and 1.83 s for the Laundry Room's sub. This still needs step
  2's image cache.

#### Step 2: the iPhone through Tailscale (run 12, v0.5.5)

The report is in the hardware matrix (run 12): the same iPhone with Wi-Fi off,
the page over HTTPS at the Tailscale address. Every session played again.
WebRTC connected in 56 of 56 sessions: 45 straight over Tailscale, and 11
through a TURN relay. MSE played all 29 cold and all 27 warm streams.

What it decides, by the rules:

- **The iPhone app through Tailscale: WebRTC for a cold stream, MSE for a
  warm one**, as at home.
  - Cold, WebRTC is as fast or faster: 2.16 s against MSE's 3.58 s on subs,
    and 1.75 s against 1.90 s on mains and ext.
  - Warm, MSE's 0.40 s and 1.12 s beat WebRTC's 3.90 s and 1.75 s.
- **HD: unchanged**, the main on every camera but the Duo 3. Each H.265 main
  played over both transports again.
- **Kept warm by default: unchanged.** Warm, the six subs started in
  0.28–0.45 s; cold, they took 1.59–4.12 s.
- **The CX410 and CX810 direct entries can still go.** This run's cold subs
  differ: Front Yard Right started 0.56 s slower through the NVR (1.50 against
  0.94 s), and Front Yard Left 1.91 s faster (2.06 against 3.97 s). Each figure
  is the mean of the cold WebRTC and MSE starts. Over the eight runs that
  measured both paths (runs 5–12), the gap ran from 0.71 s faster to 1.99 s
  slower through the NVR for Front Yard Right, and from 1.91 s faster to 1.89 s
  slower for Front Yard Left. Its median is about 0 s for both cameras: where
  the camera is in its key-frame interval decides it, not the path.

What the run shows beyond the rules:

- **A warm main costs its cached frames' transfer on a slow link.** Warm MSE
  started the mains in 1.31–1.86 s here, against 0.19–0.69 s at home. The
  relay sends the init segment and every frame since the last key frame as
  one message. For a main that is up to 2 s of 3–10 Mbit/s video, about
  1–2.5 MB, and the link carried roughly 10–15 Mbit/s. No viewer waits on it
  in step 2's design: only subs are kept warm (0.28–0.45 s here), and full
  screen starts the main in the background and swaps it in on its first
  frame. If a main is ever kept warm for remote viewers, sending the key frame
  first and catching up from it would show a picture sooner.
- **WebRTC mostly goes straight over Tailscale.** 45 of 56 sessions paired
  the iPhone with one of go2rtc's own addresses and skipped the relay. Home
  Assistant's own view went through a relay in all 19 of its sessions.

The exit criteria, on the iPhone through Tailscale:
- The iPhone works through Tailscale: yes.
- Live is faster than the stock view: yes, 19 of 19 streams. Home
  Assistant's view took a median 3.64 s here.
- Warm streams under 1.5 s is a LAN criterion. Here the warm subs, which the
  grid uses, started in 0.45 s at worst.
- Every tile shows its snapshot in under 0.5 s: no. HA's snapshot took a
  median 0.72 s; step 2's image cache is still needed.

#### Step 2: the iPhone through Nabu Casa (run 13, v0.5.5)

The report is in the hardware matrix (run 13): the same iPhone with Wi-Fi and
Tailscale off, the page over HTTPS at the Nabu Casa address. Every session
played again. WebRTC connected in 56 of 56 sessions: 47 without a relay, and
9 through a TURN relay. MSE played all 29 cold and all 27 warm streams.

What it decides, by the rules:

- **The iPhone app through Nabu Casa: WebRTC for a cold stream, MSE for a
  warm one**, as everywhere else.
  - Cold, WebRTC is faster: 1.76 s against MSE's 2.99 s on subs, and 1.61 s
    against 2.17 s on mains and ext.
  - Warm, MSE's 0.38 s and 0.95 s beat WebRTC's 3.88 s and 1.71 s.
- **HD: unchanged**, the main on every camera but the Duo 3. Each H.265 main
  played over both transports again.
- **Kept warm by default: unchanged.** Warm, the six subs started in
  0.30–0.58 s; cold, they took 1.21–4.26 s.
- **The CX410 and CX810 direct entries can still go.** Through the NVR their
  cold subs started within 0.21 s of the direct ones (1.09 against 1.04 s,
  and 2.74 against 2.95 s), and warm within 0.07 s.

As through Tailscale, the warm mains started in 1.11–2.03 s: the cached frames
since the last key frame cross the link as one message. Full screen hides it
by swapping the main in on its first frame.

The exit criteria, on the iPhone through Nabu Casa:
- The iPhone works through Nabu Casa: yes.
- Live is faster than the stock view: yes, 19 of 19 streams. Home
  Assistant's view took a median 2.63 s here.
- The warm subs the grid uses started in 0.58 s at worst.
- Every tile shows its snapshot in under 0.5 s: no. HA's snapshot took a
  median 0.77 s where it worked, and failed on the Laundry Room's and the
  Doorbell's four entities.

#### Step 1's decisions, every setup in (runs 5–13)

| Setup | Cold stream | Warm stream | HD |
| --- | --- | --- | --- |
| Desktop Chrome, LAN | WebRTC | MSE | main; ext on the Duo 3 |
| iPhone app, Wi-Fi | WebRTC | MSE | main (H.265 too, if `decodingInfo` says smooth); ext on the Duo 3 |
| iPhone app, Tailscale | WebRTC | MSE | as on Wi-Fi |
| iPhone app, Nabu Casa | WebRTC | MSE | as on Wi-Fi |

- **Delivery is the same everywhere**, so step 2 needs no per-setup table.
  It starts a cold stream over WebRTC and a warm one over MSE, and each falls
  back to the other.
- **NVR budget: 7.** Cameras added directly keep 2.
- **Kept warm by default:** Garage, Hallway, Front Yard Left, Back Yard, Dogs
  and Laundry Room (their subs).
- **The CX410 and CX810 direct entries can go.**
- **Snapshots:** HA's snapshot misses 0.5 s on every setup (median 0.43–0.77 s
  across runs 5–13), and it failed on 1–8 entities in five of those nine
  runs. Step 2's own image cache has to meet the criterion.

The exit criteria so far:
- Warm streams play live in under 1.5 s on the LAN: yes, on the desktop and
  the iPhone.
- Cold times are recorded: yes, on every setup.
- Live is faster than the stock view: yes, 19 of 19 streams on every setup.
- The iPhone works on Wi-Fi, Tailscale and Nabu Casa: yes.
- Every tile shows its snapshot in under 0.5 s: not yet (step 2's image
  cache).
- The Phase 2 playback criteria still hold, and a 24-hour soak passes: at the
  end of step 2.

#### Step 2: the image cache (v0.6.0)

`live/images.py`. A tile has to show a picture within 0.5 s. Home Assistant's
snapshot took a median 0.43–0.77 s and failed on some cameras in five of nine
runs, so the integration keeps each camera's last picture and serves it from
memory:

- **The picture** is the camera's own snapshot at its sub stream's size,
  taken through the NVR where the camera has one. It goes through the bridge
  (`async_snapshot`) and the scheduler at thumbnail priority, de-duplicated,
  so it never delays live view or playback.
- **Taken while a live page watches.** `live/images` is a subscription: it
  sends every camera's signed picture URL at once, then each new one. While
  anyone subscribes, a mains-powered camera's picture is taken again every
  30 s, and at once if it is older. With nobody watching, no picture is
  taken.
- **Battery cameras sleep.** Their picture is never taken in the background:
  it is taken when one of their streams starts (the camera is awake then),
  and once if there is none at all. A failure waits for their next stream.
- **A camera that fails** is left alone for a minute. A missing picture
  (privacy mode) or anything but a JPEG counts as a failure.
- **Kept on disk too** (`live_images/`, named by a key that reveals no
  identifier), so the first page after a restart has pictures.
- **Served from memory** by `/api/reolink_viewer/live/image/{token}`, a signed
  URL that names a camera and never reaches it. A new picture gets a new URL.
  Later events are signed for the subscriber's own login, not for whoever
  subscribed first.
- **The live check measures it** ("First images (ours)"): the list, then
  each camera's picture, as a tile would wait for it. A camera with no picture
  kept waits for it to be taken, and the report says so. The check
  unsubscribes before it measures the streams.

#### Step 2: the Live grid (v0.7.0)

Reolink → **Watch live** opens every camera in a grid (`#live`), on its sub
stream, through the NVR where the camera has one. Clicking a tile opens the
camera's new **Live** tab (`#device/<id>/live`), which shows the same tile
large. Full-screen HD comes next.

- **A tile** (`live-tile.ts`) shows the camera's last picture at once (the
  image cache), then fades into its video on the first frame.
- **How it starts** (`live/player.ts`), by step 1's decision for every setup:
  - over MSE if the stream is kept warm (`live/cameras` now says which are),
    so it starts from the cached key frame; over WebRTC otherwise;
  - the other transport is the fallback;
  - a failed start waits 1, 2, 5, 10, then 30 s, and the tile says why, with
    a Retry button.
- **When a playing stream ends**, the tile starts it again: at once if it had
  played 30 s, else after the same waits. A session ends when the server
  closes it, ICE fails, or no new frame comes for 10 s (`session.ts`).
- **It plays only when someone can see it.** Hidden pages stop at once.
  Scrolling a tile off screen stops it after 3 s, so a quick scroll back keeps
  it. A warm stream stays warm on the server.
- **Battery cameras** wait for a tap ("Tap to watch"), so they are woken only
  when someone wants to watch.
- **One picture subscription** and one fetch of the cameras and ICE servers
  per view (`live/data.ts`). Leaving the view closes every session, and the
  pictures stop being taken unless another page watches.
- **Tested in Chromium** (`test_live_browser.py`, `live_grid_browser.cjs`) with
  the bundle Home Assistant serves: the picture comes from the image view, the
  tile opens a WebRTC session through Home Assistant that holds the camera's
  sub stream, and leaving the grid leaves nothing held. go2rtc sends only
  H.264 and H.265 video, which Playwright's Chromium cannot decode, so frames
  are checked on the hardware.

#### Step 2: keep warm (v0.8.0)

A warm camera's sub stream stays open, with its last key frame cached, so its
tile starts at once over MSE (0.07–0.70 s in runs 9–13) instead of waiting up
to 4 s for the camera's next key frame.

- **The NVR budget is 7**, as step 1 decided. It was still 4.
- **A switch per mains-powered camera**, "<camera> keep live view warm"
  (`switch.py`). It is a setting, so it lives in Home Assistant's state: the
  camera's Live tab turns it on and off with `switch.turn_on` and
  `switch.turn_off`, and automations can too. Its state survives restarts.
  Battery cameras get none, so they can sleep. A camera's switch is added
  once its Reolink entry has loaded, and is unavailable while the camera is
  gone.
- **On by default**, mains-powered cameras in channel order, as many per host
  as its stream budget allows after one HD stream: six on the NVR, one on a
  camera added directly. This general rule differs from step 1's list for the
  owner's cameras in one place: it also keeps Front Yard Right warm, whose
  1 s key frames start it in about 1 s cold anyway. Turning its switch off
  matches the list and frees one of the NVR's slots for a recording download
  while HD plays.
- **The keeper** (`live/warm.py`) opens and closes the warm streams to match
  the switches: when one changes, once Home Assistant has started, and every
  minute (a Reolink entry that loaded late, a camera that was offline, a
  connection that changed). It keeps the sub through the NVR where the camera
  has one, as the grid plays it. go2rtc starts with Home Assistant when a
  switch is on.
- **Who keeps a stream warm** is recorded per stream (the setting, the live
  check): it stays warm until the last of them lets go, so the live check
  turning its warm streams off leaves the switches' alone.
- **The panel**: a tile starts over MSE when its camera's switch is on (Home
  Assistant's state, live) or the server says it is warm.
- **The live check** says "kept warm by its switch; turn it off to measure
  cold" for those subs, instead of waiting 10 s per transport for them to go
  cold.

#### Step 2: full-screen HD (v0.9.0)

Every tile, in the grid and on a camera's Live tab, has a full-screen button.
Full screen plays HD: the sub stream keeps playing while the HD stream
starts in the background, and HD replaces it on its first frame.

- **Which stream is HD** (`live/hd.ts`), by step 1's rule: the main stream
  where it is H.264; where it is H.265, the main only if
  `MediaCapabilities.decodingInfo` says this browser decodes it over MSE,
  supported and smooth, at its size and frame rate; otherwise ext (H.264 on
  every camera). A main wider than 4096 pixels always uses ext: that is the
  Duo 3's 7680×2160, where a first frame says nothing about decoding 20 fps.
  With no ext stream and no usable main, full screen stays on the sub stream
  and says why.
- **Each stream's size** comes from the device's encoder settings, which
  reolink-aio keeps but has no accessor for: the bridge reads its private
  state, guarded, and an unexpected shape reads as unknown (an H.265 main
  then uses ext). The device overview and the live check show the sizes too.
- **The swap**: HD shows at once on its first frame, and the sub stream then
  stops. If HD ends, the sub stream plays again while HD starts again. HD
  starts like any stream: over MSE when it is kept warm, over WebRTC
  otherwise, each the other's fallback. A main is never kept warm, so HD
  starts cold: the camera's next key frame.
- **The budget**: while one tile is full screen the grid's other tiles stop.
  On the NVR that leaves six warm subs and one HD stream, its budget of 7.
  Leaving full screen stops HD and plays the sub stream again.
- **Full screen** uses the browser's Fullscreen API where it has one for any
  element (desktop browsers, the iPad). The iPhone has it only for a video,
  so there the tile fills the window instead. The button and Esc leave it.
  Full screen on a battery camera wakes it.
- **What it says**: "HD" once HD shows; until then "SD" with "HD starting…",
  why HD cannot play (the player's error, retried with its backoff), or why
  there is no HD.
- **The live check** (v0.9.0) lists, for each camera, the HD stream full
  screen plays in that browser and why.

#### Step 2: PTZ, presets, siren and floodlight (v0.10.0)

A camera's own view (its Live tab) and full screen show its controls over
the video. They are Home Assistant's own entities of the Reolink
integration, changed through standard actions, and they show Home
Assistant's state.

- **Which ones** (`live/cameras` lists them per camera, from the entity
  registry): the PTZ buttons (`ptz_left`, `ptz_up`, … and the diagonals and
  zoom buttons where Home Assistant has them on), the PTZ preset select, the
  zoom and focus numbers, the siren and the floodlight. Only enabled
  entities of the camera itself (not the NVR's own siren, not a chime's),
  through the NVR first, as live view plays. PTZ shows only with PTZ stop,
  which ends a move.
- **PTZ**: a pad of the moves the camera has. A move runs while its button
  is held (touch, mouse, or Enter and Space): the press of its button starts
  it, and PTZ stop ends it on release, sent once the start was, so a quick
  tap cannot stop before it moves. Leaving the view mid-move stops it.
- **Zoom**: held − and + where Home Assistant's zoom buttons are on (they
  are off by default); otherwise − and + step the zoom number by a tenth of
  its range. Focus steps the same way.
- **Presets**: a list; choosing one moves the camera there.
- **Floodlight**: a toggle that shows the light's state.
- **Siren**: it sounds until it is stopped, so it asks first ("Sound the
  siren on <camera>?"); once on, the same button stops it at once.
- **No confirmation for moves**, unlike the Settings tab, where the catalog
  marks PTZ, presets and zoom disruptive: here the camera is moved while it
  is watched.
- A failed action says so over the video for 5 s; a control whose entity is
  unavailable is greyed out.
- The Chromium test holds a PTZ arrow in a real browser and lets go: the
  camera gets "Left" and then "Stop" through Home Assistant's button actions.

On the hardware (the owner, 2026-10-22): full-screen HD (v0.9.0) looked
right, and PTZ, the floodlight and the siren (v0.10.0) worked from the live
view. No timings were reported.

#### Step 2: the picture first (v0.11.0)

The E1 Zoom (the Laundry Room) records nowhere by design: it is there for
pictures of the washer and dryer panels. Phase 1 made its snapshot the main
view of its Overview; the owner chose the same for live view ("picture until
tapped"). By Phase 1's rule, it applies to any camera that records nowhere
(no NVR, no SD card):

- **Its tile**, in the grid and on its Live tab, shows its last picture
  from the image cache (taken again every 30 s while it is shown) with the
  time it was taken, and plays its video only when tapped, as a battery
  camera does. Full screen plays it at once.
- **Its keep-warm switch is off by default**: it is watched for its picture,
  so it does not hold one of its two stream slots all the time. A switch
  turned on before stays on (Home Assistant restores it): the owner's
  Laundry Room switch was on by v0.8.0's default, and is turned off once by
  hand.

On the hardware (the owner, 2026-10-22): the Laundry Room tile shows its
picture with "Picture from" and its time, and plays no video; a tap plays it,
and it keeps playing.

#### Step 2: battery cameras on wired power (v0.12.0)

The owner's Doorbell is a battery camera, but wired, and it records all the
time: it never sleeps. Live view treated it as a battery camera (a tap to
watch, no keep-warm switch, its picture taken only when a stream starts),
which only made it slower. The owner chose to detect it:

- **Wired power** comes from the camera's battery info: its power supply
  status ("normal" when wired), which reolink-aio keeps per channel, and as
  the host's own flag for a camera added directly. reolink-aio uses it
  itself to let a wired battery camera serve RTSP, but has no accessor for
  it, so the bridge reads it, guarded: anything unexpected reads as on
  battery, as before. An NVR's host flag mixes its channels, so only the
  per-channel status counts there.
- **On wired power, a battery camera is watched like the others**: its tile
  plays at once, its picture is taken every 30 s while shown, and it gets a
  keep-warm switch (on by default where its host's budget has room, like
  any camera). The Overview's battery line says "on wired power".
- **Unplugged**, it is a battery camera again at the next look (every
  minute for the switches): it waits for a tap, may sleep, and its
  keep-warm switch is unavailable, so it is not kept awake.

On the hardware (the owner, 2026-10-22): the Doorbell's Overview says "on
wired power", but its tile still waited for a tap, with "Tap to watch live":
picture first. The Doorbell is added directly, records to its SD card ("SD 1:
47.16% used") and not on the NVR, and is Baichuan only: it reports no replay
support ("Recordings: no playback"). "Records somewhere" was taken from the
playback source, which needs replay support, so it counted as recording
nowhere, like the E1 Zoom.

**v0.12.1:** a camera records somewhere when an NVR or its own storage (an SD
card) keeps its recordings, whether or not this integration can play them
(`bridge.stores_recordings`). The picture first and the keep-warm default use
that; the Playback tab still needs replay support. Playing the Doorbell's SD
recordings (Baichuan only) is left for later.

On the hardware (the owner, 2026-10-22): with v0.12.1 the Doorbell plays
without a tap.

#### Step 2: the debug view per tile (v0.13.0)

Every tile has an info button (ⓘ, above its full-screen button). It shows,
over the tile:

- the camera and its connection (through the NVR or direct, on battery);
- per player (the tile's stream, and HD in full screen): its stream,
  whether it is kept warm, and what it does now: starting over a transport,
  playing (the transport, the first frame's time, the picture size, the
  codec; for WebRTC the candidate pair and its round trip), or why it waits
  and when it tries again;
- the server's state of that stream (`live/state`, read every 2 s while
  shown; no camera I/O): go2rtc streaming or idle and its consumers, the
  stream's holds, and the key-frame cache's feed (its age, viewers, the
  last key frame and the key-frame interval, the parameter sets, feeds
  dropped and why);
- full screen's HD choice and why;
- each player's last 20 events with their time: starts, failures and
  fallbacks, first frames, ends, waits, stops.

Copy puts the text on the clipboard (the plain-HTTP way on the iPhone app,
as the live check's report). The Chromium test opens it on a playing tile
and reads go2rtc's state there.

#### Step 2: the soak report (v0.14.0)

The 24-hour soak's criteria (no reconnect loops, no growth in the sessions to
the cameras, within their limits, battery cameras asleep when not viewed) are
hard to judge by eye, so the grid has a **Soak report** button:

- **The server samples** what live view holds every 5 minutes, the last 36 h
  of them (`live/soak.py`): go2rtc's state, restarts and memory (from
  /proc); the WebRTC sessions; the MSE feeds (open, kept warm, viewers,
  ended); each host's stream slots in use (the sessions to its cameras),
  its limit and how many wait, with its CPU as last reported to Home
  Assistant (its CPU sensor must be on); and for each camera on battery,
  whether it sleeps and whether a stream of it is held. Only what is in
  memory: no camera I/O. `live/soak` returns the samples since a time, and
  one taken then.
- **The panel counts**, per tile, its streams that played, dropped after
  playing, and failed to start; and how long the page was visible (tiles
  pause while it is hidden).
- **The report** (`live/soak.ts`) puts the samples since the grid opened next
  to the counts: start → now and peak for each, then a verdict per
  criterion: no tile dropped or failed more than once an hour; go2rtc never
  restarted (and its memory did not double); every host ends with no more
  stream slots in use than it started with, and never went above its limit;
  each camera on battery slept while not watched; 24 hours ran, with the
  page visible 95 % of the time. CPU is shown, not judged: Phase 0 set no
  CPU limit. Copy puts it on the clipboard.

To run the soak: open Reolink → Watch live on a device that stays on with
its screen on (the page visible), leave it 24 hours, close any full screen,
press **Soak report**, and send the text.

#### Step 2: the soak run outlives the page (v0.15.0)

The owner's first soak ran for days, and its report then said the grid had
just opened. The grid kept the soak's start, its visible time and the tiles'
counts in the page, and reset them whenever it was attached to the page.
Home Assistant's frontend detaches a panel whose page has been hidden for 5
minutes (`partial-panel-resolver`: a locked screen, a sleeping display, a
covered window) and attaches it again when the page shows. A reload has the
same effect. So any hidden spell longer than 5 minutes started the soak over.
v0.15.0 moves the soak to the server:

- **The soak run** (`live/soak.py`) records when the soak started, how long
  grids were open and visible, how many times a grid opened, what the tiles
  counted per camera, and which devices reported and when. The first grid to
  report starts a run. Grids add to it with `live/soak/count` (the time and
  counts since their last report, bounded: 64 cameras, the 8 latest
  devices). `live/soak/start` starts it over. The run is stored
  (`reolink_viewer.soak`, written at most once a minute), so the grid's
  hours add up across Home Assistant restarts. The samples stay in memory
  and start again with Home Assistant. `live/soak` returns the run and the
  samples since it started (every sample kept, before a grid has
  reported).
- **The page's tally** (`live/soak-tally.ts`) lives as long as the page,
  not the grid. Players report each first frame, drop and failed start;
  tiles pass these to the grid as events. The grid tells the tally when it
  opens and closes and when the page shows or hides. The tally sends
  what it has every minute while the grid is open, when the page hides
  (before Home Assistant unloads the grid), and when the grid closes. If a
  send fails, the counts go with the next one.
- **The report** judges the two halves of the owner's revised soak (see
  "Phase 3 exit"):
  - **Home Assistant's half** from its samples: they must cover 24 hours,
    which needs no page open. If Home Assistant started again after the soak
    began, the report says so and the samples start then.
  - **The grid's half** from the run: visible for 8 hours in all. Tiles
    pause while the page is hidden, so the reconnect-loop rate is per
    visible hour too.
  - **Growth in camera sessions** is judged between the samples where nobody
    watched (no WebRTC session, no MSE viewer). Only the streams kept warm
    hold a slot then, whichever grids were open at other times. Comparing
    the window's ends would count a grid that was open at one end and not
    the other. With fewer than two such samples, the window's ends are
    compared.
  - It names the devices that reported, and when each last did.
- **Any device can read it**: Reolink → Soak report, a page of its own
  (`#soak`) that does not open the grid, so it starts no streams. It and
  the grid's report both have Copy, Refresh and Start over (with a
  confirmation).

**v0.15.1: the first sample waits for live view.** The first report after
installing v0.15.0 failed on two counts that were not real. Its first sample
was taken the moment Home Assistant started, before go2rtc ran and before the
kept-warm feeds opened. So it read "go2rtc was not running in 1 sample" and
"camera sessions grew while nobody watched: NVR 0 → 6". The keeper opens the
feeds at start and tries again every minute. Sampling now starts 5 minutes
(`WARMUP_S`) after Home Assistant has started, and `live/soak` takes no
sample now until then (`now` is null). It also returns when sampling
started, so the report can say when the first sample will come, and when
Home Assistant started again during a soak.

To run the soak: leave Home Assistant running for a day (it does not need a
page open). Open Reolink → Watch live whenever it suits, on any device, and
leave it showing; its visible hours add up to 8. Read the report from any
device under Reolink → Soak report.

#### Phase 3 exit

Phase 3 is done (2026-10-27, v0.15.1): every exit criterion is met on the
owner's hardware.

- **The Phase 2 playback criteria still hold** with live view running
  (runs 18–19, the playback check on the Dogs camera, v0.15.1 with the
  check at v0.3.2): the Mac in Safari and the iPhone app, at home, at the
  same time, while the six kept-warm feeds held 6 of the NVR's 7 stream
  slots. Every download found a slot at once (queue 0 ms).
  - Timeline: 48–168 ms on the Mac, 57–831 ms on the iPhone; all under 1 s.
  - Event → first frame on the sub stream: 199–493 ms on the Mac (two not
    cached), 165–338 ms on the iPhone; all under 2 s.
  - Auto-advance across a file boundary: gaps of 13 and 24 ms.
  - Speeds 0.5–8×: on pace at every rate, no stalls, every frame shown up
    to 4× and the display's rate at 8×. The check's ✗ at 1× and 4× on the
    Mac and at 0.5× on the iPhone is WebKit's decoded-frame counter running
    ahead of the frames shown, as in Phase 2 (see the 2B iPhone run): the
    frames painted match the recording's 10 fps times the rate, and the
    longest gap between them (101, 34 and 202 ms) is shorter than a
    skipped frame would leave (200, 50 and 400 ms).
  - The main/sub switch: HD in 4.6 s on the Mac, cold (the server fetched
    the 169 MB main recording in 4.5 s), and 362 ms on the iPhone, which
    found it cached; back to SD in 137 and 381 ms; each kept the moment
    (within 0.03 s).
  - Scrubbing showed 5 of 5 points from the buffer: on the Mac at its
    point, on the iPhone within 3.93 s, as WebKit's `fastSeek` lands on the
    nearest key frame (every 4 s on this camera's sub stream).
  - Not run here: the deep starts in a recording of 20 minutes or more
    (Dogs records events only), and the optional one-hour session. Live
    view does not share the playback path's buffers or cache.

Met before:

- **The grid shows live video within 1.5 s on the LAN** (runs 16–17): the
  six kept-warm cameras start over MSE from their cached key frames in a
  median 0.05 s on the Mac and 0.09 s on the iPhone, and the Doorbell, not
  kept warm, over WebRTC in 0.39–0.40 s. The Laundry Room's E1 Zoom records
  nowhere and, as the owner chose, shows its picture first and plays when
  tapped (3.5–3.8 s cold); keep warm is off for it.
- **Every tile shows its picture in under 0.5 s**, from the image cache
  (v0.6.0), in the live check's "First images (ours)" section (v0.15.1):
  the iPhone app at home (run 16), 8 of 8 in 8–31 ms, median 0.02 s; the
  Mac in Safari on the LAN (run 17), 8 of 8 in 7–36 ms, median 0.02 s.
  Home Assistant's own snapshot took a median 0.50 and 0.55 s.

- **The soak** (run 15, v0.15.1, 2026-10-26 → 27; see the hardware matrix):
  no reconnect loops and no growth in device sessions; camera CPU and
  session counts within Phase 0's limits; battery cameras sleep when not
  viewed. The owner revised it on 2026-10-26, as a dedicated 24-hour run
  with the grid open was not practical. It has two halves, and both
  passed:
  - **Home Assistant ran live view for 24.4 hours** (295 samples) without a
    restart. go2rtc never restarted; its memory went from 50.4 to 42.5 MB
    (peak 58.8). None of the 6 warm feeds dropped. While nobody watched (195
    samples), no host held more stream slots at the end than at the start:
    NVR 6 of 7, Doorbell and Laundry Room 0. No host was ever above its
    limit, and none waited. Run 14 (v0.14.0, 35.9 hours) had shown the same.
  - **The grid was visible 8.3 hours**, opened 7 times on the Mac and a
    Windows PC, with no reconnect loops: at most 5 drops and 4 failed starts
    per tile, all recovered by themselves. Most came from the Windows PC,
    which reached Home Assistant through Nabu Casa from a heavily filtered
    work network (see the finding below).
  - Camera CPU: only the E1 Zoom reports it (60%); Phase 0 set no limit. No
    camera was on battery: the Doorbell is on wired power.
  - The first grid run (v0.14.0) was lost when Home Assistant unloaded the
    hidden grid, which v0.15.0 fixed.

**Finding (for Phase 4): a network that cuts long-lived websockets.** From
the owner's work PC (Windows, Chrome, through Nabu Casa, behind heavy web
filtering) every MSE tile's websocket was closed about every 5½ minutes
(336 s, 322 s): "the server closed the stream", with no error from Home
Assistant first. Each tile played again in about 0.25 s, from the warm feed,
which ran on unbroken (10.2 h old at the time). The tiles playing over
WebRTC, whose video does not cross that websocket, held: the Doorbell
dropped once in the whole soak, the Laundry Room (when tapped) never. On
the home network the Mac had one drop in 7.7 hours. The owner attributes
it to the work network's filtering. Phase 4 can switch a tile to WebRTC
once its MSE keeps being cut this way.

## Phase 4 — Design, performance, mobile, packaging, release (difficulty: Standard, 3–4 wk)

The owner asked for the panel to get a proper design, not only a polish, in
this phase. It currently works but is plain. The design comes first, because
error states, accessibility, mobile and the bundle budget all land in the
redesigned views.

### Phase 4 status

| Step | Status |
| --- | --- |
| 1. Design: the Timetable panel (home view, events, devices, device page, checks) | **Done** (v0.16.0–v0.22.0). Direction chosen (2026-10-28), see "Step 1: the design". 1.1 foundations built (v0.16.0, the board's crop fixed in v0.16.1) and checked by the owner on the hardware, see "Step 1.1: foundations". 1.2 the home view's timetable built (v0.17.0), see "Step 1.2: today's timetable". 1.3 the Events view built (v0.18.0), see "Step 1.3: the Events view". 1.4a the device list and the device page's header, Overview and Settings built (v0.19.0), see "Step 1.4a: devices, Overview and Settings". 1.4b the Playback tab built (v0.20.0), see "Step 1.4b: the Playback tab". 1.5 the checks and reports built, in plain words (v0.21.0), see "Step 1.5: checks and reports"; 1.6 the finish: the design detector, an independent finish review against the contract (verdict: ship after fixes) with every material fix built, and `DESIGN.md` (v0.22.0), see "Step 1.6: the finish". |
| 2. Performance budget | **Done** (v0.23.0): the home view's first download is 40.9 KB gzipped (budget 200 KB) with every other view loaded on demand; no long tasks while scrubbing the timeline; time to first frame for live and playback on every setup. The first two run in CI. See "Step 2: the performance budget". Mobile (step 3) is next |
| 3. Mobile, and networks that cut websockets | In progress, in three parts (see "Step 3: mobile, and networks that cut websockets"). 3.1 built (v0.24.0): a page whose network cuts MSE's websockets switches live view to WebRTC first, and the capacity test sets the cameras kept warm aside and says plainly what else holds the slots, see "Step 3.1: live view that holds up". 3.2 (touch) is next |
| 4. Error states | Not started |
| 5. Accessibility | Not started |
| 6. Packaging and the HA version matrix | Not started |
| 7. Docs | Not started |

### Step 1: the design

**The brief** (the owner, 2026-10-28):

- It is for any Reolink owner on HACS, not only this setup.
- The two jobs are glancing at the live cameras and reviewing events and
  recordings. The phone (Companion app) and the desktop are used about
  equally.
- The home view is live with recent events: every camera live on top,
  today's events below, one tap from video, and devices and settings one
  step away.
- It would be wrong if it looked like a generic dashboard. Nothing of the
  current look needs to stay, Home Assistant's theme colours included.

`PRODUCT.md` holds the product record.

**The preview harness** shows the panel with no Home Assistant and no
cameras, so every view can be designed and checked from screenshots.

- `frontend/preview/` mounts the real panel on a fake `hass`
  (`fake-hass.ts`). It has the owner's eight cameras on the NVR or added
  directly, every setting entity, and one day of 13 events and recordings.
- `make-media.sh` draws synthetic pictures with ffmpeg; they are not footage.
- `scripts/preview_capture.cjs` captures each view in light and dark, on a
  1440 × 900 desktop and a 390 × 844 phone.
- Build it with `cd frontend && npx vite build -c vite.preview.config.ts`.

**The direction: Timetable** (chosen 2026-10-28 from four sketches:
Timetable, Contact sheet, Night chart, and Home Assistant refined as the
baseline). The house runs on a timetable:

- **The live board.** The cameras play on a dark board, packed by shape:
  the doorbell runs tall and panoramas run wide. Each tile has a square
  number chip, its state at top right and its name.
- **The timetable.** Today's events come in below as departures. Each row
  has a big tabular time, a drawn pictogram and the detection type, the
  camera's numbered "platform", the length and a thumbnail. A red "now"
  line sits above the newest event.
- **Unseen events stay lit.** An event not yet opened shows in red.
- **Colour.** The band is railway blue. The timetable is paper by day and
  departure-board navy in Home Assistant's dark mode. Signal red means only
  "now" and "new". One action blue marks what can be pressed. The panel
  does not take Home Assistant's theme colours.
- **Type.** Barlow and Barlow Semi Condensed (SIL Open Font License),
  served from the integration rather than a font CDN, so the panel works
  without internet access.
- **The contract.** `.impeccable/surfaces/frontend-src-reolink-viewer-panel-ts.md`
  holds the direction contract the build is reviewed against.

**What it needs from the server: one feed of events across cameras.** The
timeline is per camera today. A new command, `events/recent`, returns the
latest events of every recording camera for the home view and the Events
view. It goes through the scheduler like every other read. "Seen" is kept
per Home Assistant user on the server, so the phone and the desktop agree.

**Order of work** (a PR each, each version checked by the owner on the
iPhone and the Mac):

1. **Foundations.** Tokens for light and dark, the served fonts, the band
   with its Live, Events and Devices tabs and the clock, the pictograms, and
   the tile states (Live, Starting, Picture hh:mm, Asleep, Offline, Waiting
   for a slot).
2. **The home view.** The live board and today's timetable, with
   `events/recent` and "seen". A row opens that recording; a tile goes full
   screen.
3. **The Events view.** The whole timetable, with a day picker and camera
   and type filters.
4. **Devices and the device page.** The overview, settings, playback and
   Live tab, rebuilt in the same world.
5. **The checks and reports.** The live check, the playback check and the
   soak report.
6. **Finish.**
   - Screenshots of every view, light and dark, desktop and phone.
   - The design detector, then an independent finish review against the
     contract, acted on.
   - `DESIGN.md`, written from the built panel.

### Step 1.1: foundations (v0.16.0)

- **Live is the home view.** The panel opens on the live board; the device list moved
  to `#devices` (an old `#live` link still opens the board). A railway-blue band holds
  the title, the **Live** and **Devices** tabs and a clock in Home Assistant's time
  zone. On a phone, the tabs take a row of their own.
- **Devices** holds the device list, then **Checks** (the live check and the soak
  report, which left the grid) and, for admins, the hardware probe.
- **Tokens** (`styles.ts`): the Timetable's palette, light and dark with Home
  Assistant's dark mode (`hass.themes.darkMode`), mapped onto Home Assistant's theme
  variables so every view follows. Sections are ruled, not boxed. Faults are amber:
  red is kept for "now" and "new".
- **Fonts**: Barlow and Barlow Semi Condensed, latin, five woff2 files (78 KB, SIL Open
  Font License) in `frontend/public/fonts`, built into `frontend_dist/fonts/` and
  loaded from beside the panel's module.
- **Icons** (`icons.ts`): drawn, one stroke. They replace the text glyphs that stood
  in for icons (playback transport, zoom, back, dismiss).
- **The live board**: tiles numbered, the tall ones first, packed by the sub stream's
  shape (under 1.2:1 runs two rows tall, over 2.4:1 two columns wide) on 2–5 columns
  by width, filling their cells. A tile may crop its picture's top and bottom, never
  its sides: a picture wider than its cell is shown whole, with bars above and below
  (v0.16.1, after the owner saw the square Doorbell cut off at the side in its tall
  cell). Full screen always shows the whole picture. Each
  tile says what it is doing: Live, Starting, Picture hh:mm, Asleep, Retrying, No sub
  stream. Its buttons show on hover; a touch screen has full screen only on the board.
  The board itself can go full screen where the browser allows.
- The bundle is 85 KB gzipped (80 KB before).

### Step 1.2: today's timetable (v0.17.0)

- **The server's feed** (`events.py`, `events/recent`): today's events of every
  recording camera, each camera's own today from the timeline service (its cached
  copy, or a search through the scheduler), merged newest first. A camera whose
  search fails is named in `failed`; its cached events still show. The home view
  reads cached copies up to an hour old at once, then asks again in the background
  (prefetch priority, behind anything someone asked for), and every 2 minutes while
  the page is visible.
- **New until opened** (`events/seen`, stored per Home Assistant user): from a
  user's first look at the feed, a later event is new until they open it or mark
  everything seen, so a first visit is not a wall of new events, and a phone and a
  desktop agree. Opened events are remembered for 3 days.
- **The timetable** (`timetable.ts`) under the live board: Today and its count, the
  column labels, a red line at the time now, then a row per event, newest first:
  the time (red while new, with "New"), a drawn pictogram and what was seen (the
  specific types; motion only when nothing more is known), the camera's number on
  the board and its name, the length and a thumbnail. 8 rows, then "Show all".
  "Mark all seen". A row opens the camera's Playback tab at the event
  (`#device/<id>/playback/<epoch ms>`), which plays from there. Events that arrive
  in a refresh slide in under the line (not with reduced motion). On a phone, a row
  is the time, what was seen over the camera and length, and the thumbnail.
- The board tells the page how it numbers its cameras (`rv-board`), so the
  timetable's numbers match the tiles'.

### Step 1.3: the Events view (v0.18.0)

- **An Events tab** in the band, between Live and Devices: `#events` is today,
  `#events/YYYY-MM-DD` any other day.
- **A day picker:** the day before and the day after, and a calendar (the playback
  tab's) whose dots mark the days with recordings on any camera (`events/days`, each
  camera's month search, cached as the playback tab's).
- **Filters:** the day's cameras (by their number on the board) and what was seen
  (a person, a vehicle, the doorbell, …, and motion on its own: the same types a row
  shows). None chosen shows every event; filters stay as the day changes.
- **The timetable** takes a `date`, every row and the filters; another day has no
  line at the time now and is not refreshed. `events/recent` takes a `date`.
- The panel reads the board's numbering itself (`live/cameras`), so the Events view
  numbers the cameras as the board does without the board open.
- The calendar's month arrows are drawn icons.

### Step 1.4a: devices, Overview and Settings (v0.19.0)

Step 4 of the design comes in two parts: this one, then the Playback tab (1.4b).

- **The device list** is a ruled table per NVR or Home Hub, then the cameras added
  directly: each camera's number on the board, its name, channel, model and state
  (Online, Asleep, or Offline in the fault colour), with "Also added directly" and
  "Snapshots only" under the state. On a phone the channel goes under the name and
  the model is left out. The NVR's name opens its page.
- **A device's page** has the board number beside its name, a line saying what it is
  ("Camera · CX410 · on the NVR and added directly"), and tabs underlined as the
  band's are. The back link reads "All devices".
- **Overview:** the snapshot in a dark frame with its caption and Refresh under it;
  each connection's facts as ruled rows, side by side on a desktop. An NVR's or Home
  Hub's page lists its cameras as the device list does.
- **Settings:** the connection picker as chips (the chosen one filled), each
  category under a rule with its heading in the condensed face, ruled rows, square
  toggles on a rail, restyled sliders, a drawn arrow on "About this setting", and the
  confirm dialog with a fault rule on top.
- The preview's cameras have snapshot pictures, so Overview can be looked at.

### Step 1.4b: the Playback tab (v0.20.0)

- **The day's events** are timetable rows, as on the home view and in the Events
  view: the time (its seconds smaller), a pictogram and what was seen, the length
  and a thumbnail. The event playing is marked "Playing". The heading counts the
  events ("4 of 13 events" when filtered).
- **The timeline** is drawn in the Timetable's colours: recordings in rail blue
  (lighter in the dark), events as ink ticks, the time now as a red line and the
  playhead as an ink line under a pointer. Events are no longer coloured by type;
  the filters and the rows say what was seen.
- **The filters** work as the Events view's: what was seen (motion only when
  nothing more is known), with counts; none chosen shows every event, and "Show
  every event" clears them. Before, every type was on and a press hid one.
- **The day line:** the day before and after around "Today" or the date, and the
  playhead's time as a large clock.
- **The toolbar:** square buttons; Play filled in ink; SD and HD as one switch;
  Speed; "Download clip" with a drawn icon.
- The player's frame is the board's ink, square; its notes are in the panel's
  font. On a phone the day's events come before the calendar.
- `shownTypes` moved to `timeline-math.ts`, shared by the timetable, the Events
  view and the Playback tab; the per-type colours are gone.

### Step 1.5: checks and reports (v0.21.0)

The owner asked (2026-10-28) that the checks and reports be "extremely clear to users
even if they are not techy": useful, easy to understand. So each check now says what
it found in plain words before any measurement.

- **In short.** Every check gives a headline and its findings, each with a word for
  how it went (Good, Fine, Slow, Problem, Note, Not yet), a sentence, and what to do
  when anything (`src/plain.ts`, shown by `rv-findings`):
  - the live check: how soon each camera's live video starts (as its tiles play it),
    in HD and kept warm; what would help a slow one (its keep-warm switch; a battery
    camera wakes first); the still pictures; Home Assistant's own view; WebRTC that
    could not connect; each NVR's capacity;
  - the soak report: whether live video kept playing, the video service ran, its
    memory held, connections piled up, any camera or NVR was asked for too many
    streams, battery cameras slept; the hours so far of each half, as "Not yet";
  - the playback check: the timeline, opening events, jumping into long recordings,
    playing on, fast forward, dragging along the timeline, HD, the connection's speed
    and the long session.
- The reports' text starts its summary with the same "In short" block, so a report
  saved on a phone shows its plain summary when read on a desktop (`parseInShort`).
  Every measurement stays, under **Details for support**, with Copy.
- **Plain wording throughout:** the intros say what each check does, how long it
  takes and that it changes nothing; the options are named for what they mean
  ("Low (the live board)", not "sub"); a running check says which camera it is on.
- **The look:** a form with labels in a column, reports as ruled sheets, drawn arrows
  on every disclosure. The live check and the soak report have page titles and an
  "All devices" link back; the Devices page lists the checks as rows. The Playback
  tab's "Debug" is "Details and playback check", the check first and the technical
  details last; its saved reports leave out the live check's.
- The hardware probe says, in plain words, what it is for (a file to attach when you
  report a problem with a camera model) and what it leaves out.
- The preview has a saved live check, a saved playback check and a soak run half-way.

### Step 1.6: the finish (v0.22.0)

- **The design detector** (`impeccable detect`): 0 findings over 36 URL scans, every
  view in light and dark at 1440 and 390. The panel draws in shadow DOM, which the
  detector sees only in part (it caught gradient text there in a test, but not a
  side stripe or low contrast), so its clean result is partial evidence.
- **An independent finish review** against the direction contract, with
  screenshots of every view: "ship after fixes". Three FIRST VIEWPORT lines were
  unmet and are now built:
  - the home timetable has its own camera filter (the day's cameras by their
    board numbers) and **All events**, to the Events tab;
  - the board counts what plays: "6 of 8 playing", or the cameras while none plays
    yet (tiles report starting and stopping, `rv-live-state`);
  - video always sits on the board's ink: the Live tab and the Overview snapshot
    in an ink frame with a margin of it, and the Playback player an ink board
    with a hint ("Pick an event or a time on the timeline to play it.") and no
    controls until something plays.
- And its clarity fixes:
  - the live check's headline names a slow camera ("…; 1 is slow: Back Yard.");
  - Slow and Problem stand out (Problem filled in the fault amber, Slow ruled
    in it), and each summary has a key to its words;
  - the soak report judges the processor load (well within, busy but coping,
    near its limit);
  - Settings in plain words: "Asks first", "Read only", "Turned off", "Through
    Garage NVR · 25 settings", a button named for its action ("Restart"), select
    options in words ("Black & white");
  - the Events filter is "Detected" (not "Seen", which is the unseen events');
  - reports' times on the 24-hour clock in Home Assistant's zone;
  - the Playback event list says "Selected" until a recording plays there.
- The timetable's camera column sits closer to the event.
- Two last parts brought into the rules `DESIGN.md` records: the calendar (the
  chosen day in ink as a pressed chip, square marks in the recordings' rail blue)
  and the camera's controls over its video (square, in the board's ink; on in
  white, the siren in fault amber; the confirm with a fault rule).
- Known and left: Live and Events use the full width; Devices and the device
  pages are centred (1100 px at most).
- **`DESIGN.md`** and `.impeccable/design.json`, written from the built panel.
- No raster ships: the bundle holds the panel and its fonts (Barlow, OFL). The
  preview's camera pictures are synthetic (`frontend/preview/make-media.sh`) and not
  committed.

### Step 2: the performance budget (v0.23.0)

All three limits are met. The first two now run in CI on every change.

**1. The first download: 40.9 KB gzipped, against a budget of 200 KB.** Before
this step the panel was one 97.3 KB file. Now the entry imports one file with the
home view (the band, the live board and today's timetable). Every other view is
its own file, loaded the first time it is shown:

| View | Adds (gzipped) |
| --- | --- |
| Devices | 2.1 KB |
| A device page | 2.7 KB, then Overview 5.1 KB, Playback 37.4 KB, Settings 6.5 KB |
| Events | 3.5 KB |
| Live check | 28.1 KB |
| Soak report | 16.0 KB |
| Every file together | 108.7 KB in 13 files |

- The home view is two requests, not a chain: Rolldown's `codeSplitting` group
  (`vite.config.ts`) puts everything the entry needs in one file.
- `src/views.ts` loads a view when the route first asks for it, and the device
  page loads each tab the same way. A view that fails to load says so ("Could
  not load this page: … Check the connection to Home Assistant, then Try
  again"), and the next try fetches it again.
- The files have hashed names, so a new version never mixes with a cached old
  one; the entry's `?v=` changes with them.
- CI: `npm run budget` (`frontend/scripts/bundle-budget.mjs`) prints the sizes
  above and fails over 200 KB. The Chromium test (`tests/live_grid_browser.cjs`)
  loads every view through Home Assistant's static path.

**2. Scrubbing the timeline: no long tasks.** `scripts/scrub_check.cjs` opens the
Playback tab of the design preview in Chromium, drags the playhead across the
timeline and back three times, then hovers along it (the thumbnails), while a
`PerformanceObserver` records every task over 50 ms. Six runs of each:

| Run | Long tasks over 50 ms |
| --- | --- |
| Desktop (1440 px) | none (judged: CI fails on any) |
| Desktop, processor slowed 4× | none (reported only) |
| Phone (390 px), processor slowed 4× | one of 53 ms in one run, none in the other five (reported only) |

The preview plays no video, so this covers the timeline, its thumbnails and the
page, not the browser's own seeking. Seeking was measured on the hardware in
Phase 2B ("Scrub": 5 of 5 points from the buffer, median 4 ms in Chrome and
287–339 ms on the iPhone, where WebKit's `fastSeek` lands on the nearest key
frame).

**3. Time to first frame.** The live check and the playback check measure it on
the owner's hardware; these are the latest figures for each setup. The media
paths have not changed since v0.15.1; the redesign changed what draws the page,
not how video arrives.

Live (the grid, the Live tab):

| Setup | Run | The picture | A kept-warm camera plays | A camera not kept warm plays |
| --- | --- | --- | --- | --- |
| Mac, Safari, at home | 17 (v0.15.1) | median 0.02 s (8 of 8 in 7–36 ms) | median 0.05 s (MSE, 6 cameras) | Doorbell 0.39–0.40 s (WebRTC) |
| iPhone app, home Wi-Fi | 16 (v0.15.1) | median 0.02 s (8 of 8 in 8–31 ms) | median 0.09 s | Doorbell 0.39–0.40 s |
| iPhone app, Tailscale | 12 (v0.5.5) | not measured (before the image cache) | sub streams median 0.40 s | sub streams median 2.16 s |
| iPhone app, Nabu Casa | 13 (v0.5.5) | not measured (before the image cache) | sub streams 0.30–0.58 s | sub streams 1.21–4.26 s, median 1.76 s |

- A camera not kept warm waits for its next key frame, so its time depends on the
  camera (1–4 s on most). The Laundry Room's E1 Zoom, which records nowhere,
  shows its picture first and plays when tapped: 3.5–3.8 s cold.
- Full screen swaps the HD stream in on its first frame, so the picture never
  goes blank: warm mains a median 0.17 s on Wi-Fi (run 11), 1.12 s through
  Tailscale and 0.95 s through Nabu Casa (runs 12–13).
- Home Assistant's own snapshot took a median 0.50–0.55 s at home (runs 16–17)
  and 0.77 s through Nabu Casa (run 13).

Playback (the Playback tab, sub stream):

| Setup | Run | Timeline | Event → first frame | Deep in an hour's recording, not cached |
| --- | --- | --- | --- | --- |
| Mac, Safari, at home, live view running | 18 (v0.15.1) | 48–168 ms | 199–493 ms (two not cached) | not run |
| iPhone app, at home, live view running | 19 (v0.15.1) | 57–831 ms | 165–338 ms | not run |
| Mac, Chrome, Nabu Casa | 2B desktop 6 (v0.3.2) | 120–554 ms | 93–452 ms | 13.0 s (57 of 60 min) |
| iPhone app, Wi-Fi | 2B iPhone 5 (v0.3.2) | 126–178 ms | 210 ms; 1.3 s not cached | 9.5 s (57 of 60 min), 5.1 s (30 of 40 min) |
| iPhone app, Tailscale | 2B iPhone 6 (v0.3.2) | 165–277 ms | 325–719 ms | 9.2 s (55 of 60 min, a 14 Mbit/s link) |
| iPhone app, Nabu Casa | 2B iPhone 7 (v0.3.2) | 85–234 ms | 205–232 ms; 3.0 s not cached | 6.9 s (41 of 60 min) |

- A recording not yet on Home Assistant waits for the NVR's download up to the
  point asked for, and nothing more, whatever the link: about 0.2 s per minute
  into the recording on this camera (Front Yard Right), at the NVR's
  150–210 Mbit/s.
- Moving on to the next file: gaps of 2–26 ms. Switching to HD and back keeps
  the moment (within 0.03 s); HD itself is 0.4 s cached and 4.6–13.8 s cold
  (the server fetches the whole main recording).

To refresh these on a new version, run the live check and the playback check
on each setup; their "In short" says how each start went.

### Step 3: mobile, and networks that cut websockets

Built in three parts, as step 1 was:

- **3.1 live view that holds up** (v0.24.0): networks that cut long-lived
  websockets, and the capacity test while cameras are kept warm.
- **3.2 touch:** gestures on the timeline, and picture-in-picture.
- **3.3 away from home:** lighter streams on cellular and remote links, and the
  Companion app checklist on the owner's iPhone.

### Step 3.1: live view that holds up (v0.24.0)

**Networks that cut long-lived websockets.** Phase 3's soak (run 15) found a
filtered work network, through Nabu Casa, that closed every MSE tile's websocket
about every 5½ minutes. Each tile played again from its warm feed in about
0.25 s, but it is a visible blip, over and over. WebRTC's video does not cross
that websocket, and its tiles held. So the page now switches:

- **A cut** is an MSE session that played at least a minute and whose websocket
  closed without a word from Home Assistant. When the server ends a stream it
  sends the reason first; a stall (no frame for 10 s) or a session that played
  under a minute is something else.
- **Two cuts within 20 minutes**, at least 10 s apart, switch the whole page:
  warm cameras start over WebRTC first, with MSE as the fallback. A restart of
  Home Assistant or a short drop cuts every tile at the same moment, and counts
  once. The network is the same for every tile on a page, so one tile's cuts
  decide for all; a tile switches at its next start.
- **For an hour**, then MSE goes first again: the device may have moved to
  another network. If the network still cuts, two more cuts switch it back.
- **If WebRTC cannot start either** while the page prefers it, MSE goes first
  again at once, so a network that blocks both does not wait 15 s for WebRTC
  on every restart.
- The tile's debug view (ⓘ) says so: "Network: it cut MSE's connections twice,
  so WebRTC goes first until 14:32", and the player's events say when and why.
- Not yet seen on the work network itself. To check it, open the Live board
  there for 15 minutes or more: after the second cut (about 11 minutes in) the
  tiles should start over WebRTC and stop dropping.

**The capacity test while cameras are kept warm.** The test needs every stream
slot of a host, and the cameras kept warm hold most of them (by default, as
many as the host allows less one), so on run 16 it could only say "the host's
stream slots stayed busy". Now:

- The test **sets the host's warm feeds aside** while it runs: the feeds that
  nobody is watching close, and open again when it ends (a key frame is cached
  again within seconds). The cameras stay kept warm throughout; a switch turned
  on meanwhile opens its feed after the test. The progress line says "set aside
  the 6 cameras kept warm until the test ends", and the report counts them.
- When the slots still stay in use, the live check says what holds them, and
  what to do, in its summary: "RLN36's capacity test could not run. Every stream
  slot of this host stayed in use for 2 minutes: live view of Dogs and Garage is
  open and 1 recording is downloading. What to do: Close live view on other
  screens and let playback finish, then run the check again."
- Any other reason the test could not run is in the summary too (it was only in
  the details).

Tests: the player's switch, its hour and its giving up (unit, fake sessions);
the session telling a cut from an end the server explained; the relay setting a
host's feeds aside and opening them again (unit); and, against a real go2rtc,
the capacity test with a camera kept warm (set aside, warm again after) and with
a camera being watched (the plain reason).

### Steps 2–7

2. **Performance budget:**
   - initial panel JS under 200 KB gzipped, with the other views
     code-split. The whole panel is about 80 KB gzipped today (v0.15.1), so the
     split is about keeping it that way as the design adds weight.
   - no long tasks over 50 ms during timeline scrubbing
   - documented time-to-first-frame figures for live and playback
3. **Mobile:** HA Companion app testing, touch gestures on the timeline,
   picture-in-picture, lower default bitrates on cellular. Networks that cut
   long-lived websockets (Phase 3's soak, run 15: about every 5½ minutes
   from a filtered work network through Nabu Casa): switch a tile to WebRTC
   once its MSE keeps being cut.
   The live check's capacity test needs all of a host's stream slots, so it
   cannot run while cameras are kept warm (run 16): say so, instead of "the
   host's stream slots stayed busy", or set the warm feeds aside while it
   runs.
4. **Error states:** camera offline, battery asleep, no storage, unsupported codec,
   Reolink integration internals changed (bridge banner).
5. **Accessibility:** keyboard navigation and labels; respect reduced-motion.
6. **Packaging:**
   - HACS releases with a built frontend
   - an HA version compatibility matrix
   - optional HA app repository for go2rtc and hardware transcoding
7. **Docs:** user guide, troubleshooting, per-model notes from the hardware matrix.

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

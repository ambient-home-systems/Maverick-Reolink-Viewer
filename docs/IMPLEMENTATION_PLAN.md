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
| 2 | Event timeline, thumbnails, smooth playback | High (backend) / Very high (player) | 3–5 wk | In progress: 2A built; first hardware check on 2026-10-19 missed two targets, fixed in v0.2.1, re-check pending. 2B not started |
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
| Exit on LAN: timeline < 1 s cached, < 3 s cold | v0.2.0: cached past day 148 ms (pass). Today 1469 ms (an incremental search, fail) and an unopened past day 3830 ms (fail). v0.2.1 shows today at once; re-check pending |
| Exit on LAN: clicking an event starts video in < 2 s on the sub stream | v0.2.0: 2190–5264 ms with the files already cached (fail). Cause found and fixed in v0.2.1 (segment index); re-check pending |
| Exit on LAN: auto-advance to the next file | Not measured yet: the camera tested had no two touching recordings that day. With synthetic files in Chromium the swap took about 1 ms |

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
   soon as its first fragment is cached, whatever its length. Phase 2B's MSE player
   can append the fragments as they are, with no remux. The `mvhd` duration is a
   placeholder, so durations come from the search.
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

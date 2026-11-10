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
| 4 | Design, performance, mobile, packaging, first release | Standard | 3–4 wk | Done (2026-10-28, v0.32.3). Step 1, the design (the Timetable), in v0.16.0–v0.22.0; step 2, the performance budget, in v0.23.0; step 3, mobile, in v0.24.0–v0.26.0; step 4, error states, in v0.27.0–v0.29.0; step 5, accessibility, in v0.30.0; step 6, packaging, in v0.31.0, the first release; step 7, docs, in v0.32.0, released the same day; v0.32.1 starts live video sooner where WebRTC cannot connect, from the work PC's check, v0.32.2 keeps the capacity test from blaming the NVR for a stream that plays no video, from the owner's live check, and v0.32.3 fixes full screen and the timeline's pinch on the iPhone, from the owner's iPhone. The rest of the exit checklist was not run: the owner closed the phase on v0.32.0 working in daily use. See "Phase 4 status" |
| 5 | Optional R&D: Baichuan live/playback | Very high | 4–8 wk, time-boxed with gates | **5a done, go** (2026-10-29, v0.34.1): prior art surveyed, the capture tool and the owner's captures, `docs/baichuan-playback.md`, and the read-only check: a deep start over Baichuan costs the NVR 0.2 s against 4.7 s of HTTP download for the same point of a short recording. 5b–5d estimated at 3.5–5 wk, deep starts only; talk deferred. **5b step 1 built** (2026-10-29, v0.35.0): the probe measures the replay and the download cut (143) 75 % into sub and main recordings, decodes what arrives and counts the sessions; the source (replay, 143 or both) is chosen from the owner's report before step 2, the prototype. **Step 1 done** (2026-10-30, v0.35.5): the download cut (143) is the source. **5b step 2 built** (2026-10-30, v0.36.0): the muxer, one Baichuan connection per host, deep starts served from the cut behind an option (off by default), the fallback to the download. **Hardware check passed** (2026-10-30): an uncached deep start 52 min into an hour shows its first frame in 0.51 s on Chrome and 0.60 s on the iPhone (9.0 s from the download with the option off); v0.36.1 cuts HD in 3-minute spans and searches the day's HD list ahead. **5b done** (2026-10-30, v0.36.2): every exit criterion met on the hardware, the NVR's own list of online users included (one more session while deep starts are in use, gone when idle). **5c done** (2026-10-30 to 2026-11-02, v0.37.0–v0.40.0): a deep start fetches the recording once, in two pieces, on one stream; on by default, a device that refuses the protocol left alone; each camera's counter rate kept; the device's zone built from its own DST rules (reolink-aio's land on the wrong days); two viewers of a camera take turns. **5d reports posted** (2026-11-02): the time zone bug as [starkillerOG/reolink_aio#239](https://github.com/starkillerOG/reolink_aio/issues/239), the download cut (143/144) and the media message class as [#240](https://github.com/starkillerOG/reolink_aio/issues/240); the rest is the maintainer's. **v0.40.1** (2026-11-02): six findings of a review of 5b/5c fixed (chief among them, an HD cut left by a closed tab held the recorder's login until restart); the owner's check of it closes the phase. See "Phase 5 status" |
| 6 | The Doorbell's events: a camera that records but cannot be played lists its events | Standard / High | 0.5–1 wk | **Done** (2026-11-02, v0.43.0). **Step 1 done** (v0.41.0–v0.41.1): run 2 found the Doorbell's event and day searches working, its zone Home Assistant's, and its pictures refused by reolink-aio (a `1002` header). **Step 2 built** (v0.42.0): the Doorbell's events in the feed, the Events view and the calendar, on wired power. **Step 3 built** (v0.43.0): its pictures read here, and its Playback tab shows each event as pictures. **The owner's check** (2026-11-02): the Doorbell's events show and open as pictures, and a press of the doorbell is listed as a "Doorbell" event at the right time, so step 4 (the fallback) was not needed. Phase 7 started meanwhile, at the owner's request. See "Phase 6" |
| 7 | Live video on dashboards: a Reolink Viewer camera card | Standard | 1–1.5 wk | **Done** (2026-11-03, v0.45.2), closed on daily use by the owner. **Step 1 done** (v0.44.0): the Reolink camera card, `custom:reolink-viewer-camera`, with its editor, on any dashboard and for any user. The owner's check (2026-11-02): on the wall tablet (Galaxy Tab A9+, Fully Kiosk, a sections view) and the iPhone app's dashboard, the Doorbell's and the front-yard camera's cards show their picture at once and their video quickly, kept warm or not, and go full screen in HD and back. **Step 2 built** (v0.45.0): what the cards see is logged per device (Devices → Dashboard cards), they sleep while Fully Kiosk's screen is off or its screensaver on, and a doorbell's card can wake the screen and go full screen when it rings. **Step 2 done** (2026-11-03, v0.45.2): on the owner's tablet the cards sleep under Fully's screensaver (no frames decoded) and a ring wakes the screen and shows the Doorbell full screen, playing in 0.6 s (v0.45.1 fills the window from the top layer). Step 3 stays gated. Not measured: a warm camera's wake time and 8 visible hours; the wall page's cards are the owner's choice. See "Phase 7" |
| 8 | Unusual events: learning what is normal | High | 2–3 wk, then a week of learning | **Started** (2026-11-03). **Step 1 built** (v0.46.0): the detection journal, opt-in ("Learn what is normal"), with a 10-day head start from Home Assistant's recorder; on at the owner's since 2026-11-02, all 7 cameras. v0.46.1 keeps motion as bursts and a year of history (the owner's choices, from the first 10 days' sizes). **Step 2 built** (v0.47.0): Stamina's model, ported with its tests (MIT, in `THIRD_PARTY.md`), with a daily cap for a busy property; the Devices page shows each camera's state and the week's marks with their sentences. The owner's check: 3.6 marks a day at Balanced (243 a week without the cap). v0.47.1, the owner's choices: motion never marked, time counted once, one mark per incident across cameras; 5.1 a day, the journal 1.1 MB (about 2.8 MB a month). v0.47.2: only long stands out, a kind seen 10 times is known, only detections fire first; 5.3 a day. v0.47.3: an incident's later events take what fired before it; a mark always says why; the model saved between restarts; 5.3 a day, 39 without the cap. v0.47.4: anything seen 10 times is known, only "nothing fired first" raises; 1.4 a day, all rare by count. v0.47.5: Balanced aims at a few a day (floor 0, at most 3 a day), More knows a value after 20. **Step 3 built** (v0.48.0–v0.49.0), the owner's choice: marks on the timetable's rows with why, and an Unusual filter on Events (v0.48.0; the owner's check: 2.6 a day at Balanced); "What it has learned" on each camera's Overview, and a mark's count as a total (v0.49.0). **House-wide signals built** (v0.50.0): chosen in the options, kept beside the detections, learned and said. **Step 4 built** (v0.51.0): each detection scored as it begins and ends; `reolink_viewer_unusual`, an "unusual activity" sensor per camera, and a device trigger per camera, on Reolink Viewer's own device. See "Phase 8" |
| 9 | The Wall: the Live page as a security monitor, with layouts, arranging, HD large tiles and the detection strip | Standard / High | 2–3 wk | **Done** (2026-11-10, v0.56.0): the owner validated v0.55.0's and v0.56.0's checklists. Started 2026-11-05. **Step 1 built** (v0.52.0): the Wall, its layouts (Auto by shape, 1, 2×2, 3×3, 4×4, 1+5, 1+7), saved per user on the server, `#wall/<id>`, each device remembering board or Wall; the owner's check: it works, nothing to scroll. **Step 2 built** (v0.53.0): swapping (drag, or Arrange and two taps), the large slot or alone by a double tap or Enter, the keyboard, pages and tours. **Step 3 built** (v0.54.0–v0.54.1): HD in the large tiles while a stream slot is spare, the NVR's budget 9 streams with 2 HD tiles (the capacity test). **Step 4 built** (v0.55.0): the detection strip, a tile lit at once by its sensor, and per layout the feeds' floodlight and siren buttons. **Step 5 built** (v0.56.0): the pointer hidden when still, the screen kept awake, the tiles asleep under Fully's screen off, and the Reolink Wall dashboard card. The owner's checks of v0.55.0 and v0.56.0 passed (2026-11-10): the phase is done. See "Phase 9" |
| 10 | Scrubbing that shows the picture while dragging | Very high | 2–4 wk | **Started** (2026-11-10). **Step 0 built** (v0.57.0): the gate's measurements, the probe's scrub cuts and key frames, and the playback check's K row (key frames decoded one at a time); the owner's runs passed it (2026-11-10). **Step 1 built** (v0.58.0): the picture at a moment, from the server: a scrub session (a signed websocket), answered from a store of key frames found, the disk cache or a 2-second cut the device sends, taking its channel's turn; the playback check's F row. **Step 2 built** (v0.59.0): dragging over what the video has not buffered shows the server's key frame at the pointer, over the video, until release plays from there. See "Phase 10" |
| 11 | Playback and settings extras: zoom, event clips, filters, copying settings | Standard | 1–2 wk | Planned. See "Phase 11" |
| 12 | Optional R&D: the Doorbell's recordings and talk | Very high | 3–5 wk, gated | Planned. See "Phase 12" |
| 13 | Optional: live picture integrity and outside live sources | High | 1–1.5 wk, gated | Planned. See "Phase 13" |
| 14 | Copies of detection clips on a NAS or cloud | High | — | **TBD** (the owner, 2026-11-02): may be built here later; sketched, not scheduled. See "Phase 14" |

Phases 1 and 2 can overlap once Phase 0 is done. Phase 5 can start any time after
Phase 0 as a separate track. Phases 6–13 are the second round, planned in
"Phases 6–13: the second round"; most of them are independent of each other,
and the order there is a recommendation. Phase 14 is a sketch, kept until the
owner decides.

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
| 3. Mobile, and networks that cut websockets | **Done** (v0.24.0–v0.26.0), in three parts (see "Step 3: mobile, and networks that cut websockets"). 3.1 built (v0.24.0): a page whose network cuts MSE's websockets switches live view to WebRTC first, and the capacity test sets the cameras kept warm aside and says plainly what else holds the slots, see "Step 3.1: live view that holds up". 3.2 built (v0.25.0): pinch and two-finger pan on the timeline, and picture-in-picture for live and playback, see "Step 3.2: touch, and picture-in-picture". 3.3 built (v0.26.0): full screen stays in the lighter SD away from home or on mobile data, with an HD button remembered per device, see "Step 3.3: away from home, and the iPhone checklist". The iPhone checklist ran in a shorter form on 2026-10-28 (see "Phase 4 exit: the checklist"); v0.32.3 fixes full screen's crop and corners and the timeline's pinch it found. At the work PC the network cut nothing this time, so 3.1's switch is still not seen there, and WebRTC could not start: v0.32.1 then starts over MSE first on that device (see "Step 3.1: live view that holds up" and "Phase 4 exit: the checklist") |
| 4. Error states | **Done** (v0.27.0–v0.29.0), in three parts (see "Step 4: error states"). 4.1 (v0.27.0): offline cameras on the board from Home Assistant's state, and live errors in plain words, see "Step 4.1: live error states". 4.2 (v0.28.0): cameras with nothing to play say why, disks that are not ready are flagged, and recordings that cannot be read or played say why in plain words, see "Step 4.2: playback and storage error states". 4.3 (v0.29.0): a plain note over every view when Reolink Viewer cannot reach the cameras, plain load errors, and screenshots of every error state, see "Step 4.3: when Reolink Viewer cannot reach the cameras". |
| 5. Accessibility | **Done** (v0.30.0): every view passes WCAG 2.1 AA (axe-core, light and dark, desktop and phone) and works from the keyboard, checked in CI; the timeline, the calendar and the device tabs are keyboard widgets; reduced motion is honoured and tested. See "Step 5: accessibility". |
| 6. Packaging and the HA version matrix | **Done** (v0.31.0): releases from a Release workflow (CI, then the package checked and attached, notes from `CHANGELOG.md`); CI tests the oldest supported Home Assistant (2026.10.1: the matrix found 2026.10.0 cannot run it) and the pinned newest (2026.10.4), and the newest weekly. The optional go2rtc app is not built (see "Step 6: packaging"). The first release, [v0.31.0](https://github.com/ambient-home-systems/Maverick-Reolink-Viewer/releases/tag/v0.31.0), was published on 2026-10-28, [v0.32.0](https://github.com/ambient-home-systems/Maverick-Reolink-Viewer/releases/tag/v0.32.0) and [v0.32.1](https://github.com/ambient-home-systems/Maverick-Reolink-Viewer/releases/tag/v0.32.1), [v0.32.2](https://github.com/ambient-home-systems/Maverick-Reolink-Viewer/releases/tag/v0.32.2) and [v0.32.3](https://github.com/ambient-home-systems/Maverick-Reolink-Viewer/releases/tag/v0.32.3) and [v0.33.0](https://github.com/ambient-home-systems/Maverick-Reolink-Viewer/releases/tag/v0.33.0) the same day, each through the Release workflow. HACS updated the owner's Home Assistant to each (Help said 0.32.1, 0.32.2 and 0.32.3; 0.33.0's new setting is there). The install through HACS on a clean Home Assistant, with the hardware checklist (the exit criterion), was not run, see "Phase 4 exit: the checklist" |
| 7. Docs | **Done** ([v0.32.0](https://github.com/ambient-home-systems/Maverick-Reolink-Viewer/releases/tag/v0.32.0), 2026-10-28): a user guide, a troubleshooting guide that has every message the panel shows (checked word for word by a test), per-model notes from the hardware matrix, and Help in the panel that opens them for the version installed (checked against the published tag). See "Step 7: docs" |

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
| Desktop (1440 px) | none (judged: CI fails on any, in two passes in a row since v0.36.1) |
| Desktop, processor slowed 4× | none (reported only) |
| Phone (390 px), processor slowed 4× | one of 53 ms in one run, none in the other five (reported only) |

The preview plays no video, so this covers the timeline, its thumbnails and the
page, not the browser's own seeking.

From v0.36.1 a desktop pass with long tasks is scrubbed once more on a fresh page
and judged on that. CI had failed it twice on unchanged timeline code (11 tasks of
up to 77 ms, then 3 of up to 80 ms), the next run passing each time; locally
v0.35.5 does the same (one of 54 ms mid-scrub in one of six passes), so it is the
shared machine, not the timeline, which would block every pass. The check now also
prints when each long task started.

v0.38.0 then cut the work each drag step does, after the check failed both
desktop passes on a docs-only change: a Chromium profile (CPU 2×) showed every
pointermove re-rendering the event list's 60 rows (its marked row rarely
changes), `getBoundingClientRect()` forcing a layout in each timeline draw, and
a new `Intl` formatter for the day's name in each page render. The event list
now updates on a cursor move only when the marked event changes, the timeline
takes its width from its ResizeObserver, and the day's formatters are made
once. Per step, from the pointermove to the next frame (3 runs of the check's
drag): CPU 1× median 3.6 → 2.9 ms (p99 7.7 → 5.7); CPU 4× median 18.8 → 12.5 ms
(p99 37.8 → 29.4). Seeking was measured on the hardware in
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
- **3.2 touch** (v0.25.0): gestures on the timeline, and picture-in-picture.
- **3.3 away from home** (v0.26.0): lighter streams on cellular and remote
  links, and the Companion app checklist on the owner's iPhone.

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
- **Seen on the hardware** (run 20, 2026-10-28, v0.32.1): the test set the six
  cameras kept warm aside and ran every level.
- **A main that plays no video (v0.32.2).** Run 20's level 7, the Back Yard's 16 MP
  main, sent no frame, and the verdict blamed the NVR ("struggled with 7 video
  streams at once": keep fewer cameras warm), though every other stream kept its
  rate and the download then ran faster than alone. That main sent no video in any
  part of the run, to Home Assistant's own view too. Now the test opens the heaviest
  main on its own first, before the levels, and uses the next heaviest if it sends
  nothing (up to `MAIN_TRIES`, 3); the report lists those left out
  (`main_left_out`), and the summary says "RLN36's capacity test left out Back
  Yard's full-resolution stream: it sent no video, even on its own", with what to
  try. Tests: against a real go2rtc, a main that never plays is left out and the
  verdict stays clean (and fails on v0.32.1's test); the summary and the report's
  lines (unit). Released 2026-10-28 (dry run 40763345891, release 40763971711, on
  main at 6c66510): the zip is main's `custom_components/reolink_viewer` file for
  file. On the owner's hardware (run 22) it left out the Back Yard's main, used the
  Garage's, and the NVR kept up at every level.

Tests: the player's switch, its hour and its giving up (unit, fake sessions);
the session telling a cut from an end the server explained; the relay setting a
host's feeds aside and opening them again (unit); and, against a real go2rtc,
the capacity test with a camera kept warm (set aside, warm again after) and with
a camera being watched (the plain reason).

**Networks that block WebRTC (v0.32.1).** The work PC's check (2026-10-28) found the
opposite case: there WebRTC could not connect at all, so a camera not kept warm
(the Doorbell) waited 15 s for it before MSE played in 1 s, at every start and
every restart after a drop. Now (`WebRtcWatch` in `live/player.ts`):

- **When it counts:** a WebRTC start that failed though go2rtc answered, without
  ever connecting, after which MSE played the same stream. A camera slow to wake
  has no answer yet, and one slow to send a frame had connected: neither counts.
- **Then MSE goes first** for every stream on the page, cold ones and full screen's
  HD included, with WebRTC as the fallback, for a week. It is remembered on the
  device for that Home Assistant address (another address, home on the LAN say, is
  another way in), so a reload does not wait 15 s again.
- **WebRTC playing** (as the fallback, when MSE fails) forgets it.
- The tile's ⓘ view says "Network: WebRTC does not connect from here, so MSE goes
  first until Wed 13:15", and the player's events say when it switched.

A wrong switch costs little: cold MSE started about 0.6 s later than cold WebRTC
(main and ext, runs 16–17). Tests: when it counts and when not, the week, the
storage per address, a device that cannot remember (unit, fake sessions).

**Released and checked 2026-10-28.** The dry run (run 40739624967), then the release
(run 40740365165), on main at 8a02d8b, published
[v0.32.1](https://github.com/ambient-home-systems/Maverick-Reolink-Viewer/releases/tag/v0.32.1):
`reolink_viewer.zip` (59 files, 401 KB) is main's `custom_components/reolink_viewer`
file for file, and its Help links open at the tag. HACS updated the owner's Home
Assistant to it. On the work PC, the first load of the Live board found WebRTC not
connecting (14:06), and after a reload the Doorbell, not kept warm, started over MSE
first with no WebRTC try: first frame in 1.00 s, against about 16 s on v0.32.0. Its
ⓘ view said "Network: WebRTC does not connect from here, so MSE goes first until Wed
01:06 PM" (a week on; the clocks go back an hour on 2026-11-01).

### Step 3.2: touch, and picture-in-picture (v0.25.0)

**The timeline under fingers.** One finger still scrubs and a tap still seeks,
as with a mouse, so the same gestures work everywhere. Now:

- **Two fingers pinch to zoom and slide to pan.** The time between the fingers
  stays between them, so the moment you are zooming in on stays under your
  fingers. Any span between 5 minutes and the whole day, not only the five
  levels; the − and + buttons step from there to the next level.
- Fingers almost on top of each other (under 24 px apart) only pan: their
  distance says too little to zoom by.
- A second finger after a scrub ends the scrub where it was (a seek), as
  lifting the finger would, then the pinch begins; lifting one finger ends
  the pinch without a seek, and the finger left does not scrub.
- One finger moving up and down still scrolls the page; no long-press menu or
  text selection on the timeline.
- A trackpad pinch on the Mac (ctrl+wheel) zooms smoothly too, around the
  pointer, instead of one level per wheel event.
- Checked in Chromium with its own touch input on a phone-sized page
  (`scripts/scrub_check.cjs`, in CI): two fingers 40 px apart spreading to
  240 px took the timeline from 24 h to 4 h, with no long tasks.

**Picture-in-picture**, where the browser has it (Chrome, Edge and Safari on
the Mac through the standard API; the iPhone and iPad through WebKit's
presentation mode; Firefox has its own button on videos and no API, so the
panel shows none):

- **Live:** a button beside full screen, on a camera in full screen and on its
  own Live tab, while it plays. It takes the video showing (HD in full
  screen). The stream in the small window keeps playing while the tile is
  scrolled away or the page is hidden, when HD replaces it on the tile, and
  when another camera goes full screen. It ends when the tile goes away
  (leaving the Live board or the camera).
- **Playback:** "Picture in picture" in the toolbar (the video's own controls
  have one too). The window moves with the player's swap to the next file,
  where the browser allows it without a click (Chrome does); otherwise it
  closes rather than show nothing.
- Not yet tried on the owner's devices: on the iPhone app (3.3's checklist).

**On the owner's iPhone (2026-10-28, v0.32.2).** Picture-in-picture worked. A
pinch on the timeline zoomed only one step: the canvas lets one finger scroll the
page (`touch-action: pan-y`), and iOS can take two fingers spreading for that
scroll, cancelling the pinch (`pointercancel`) after its first move; Chromium does
not, which is why `scripts/scrub_check.cjs` passed. v0.32.3 stops the browser
taking two fingers on the timeline (non-passive `touchstart` and `touchmove` with
two touches, and WebKit's `gesturestart`, are default-prevented), so the pinch
keeps following them; one finger still scrolls the page. The cause was read from
WebKit's behaviour, not traced on the device. Tests: two touches are kept from the
page, one is not (unit); the Chromium pinch still zooms 24 h to 4 h (CI). Checked
on the owner's iPhone on v0.32.3: the pinch follows the fingers, in and out, and
one finger still scrolls the page.

Also: the device page's tests now wait for a tab's file, which loads on demand
since step 2 (one passed only when another test had loaded it first); every
test file passes on its own.

### Step 3.3: away from home, and the iPhone checklist (v0.26.0)

**Lighter live video away from home.** The board already plays every camera's
small (sub) stream, and playback starts in SD everywhere, with HD only when
pressed. Full screen was the one place that always switched to the camera's
main stream, several times the data. Now (`src/network.ts`):

- **At home**, full screen plays HD as before.
- **Away from home** (through Nabu Casa, through Tailscale, or a public
  address) and **on mobile data, a slow connection or with data saver on**
  (where the browser says so: Chrome on Android does, the iPhone does not),
  it stays in the lighter SD. An **HD** button shows above the picture, with
  the reason in words: "Lighter SD through Nabu Casa. Tap HD for full quality."
- The choice is **remembered on the device**, separately for at home and for
  away: tap HD once away, and full screen away plays HD from then on; turn it
  off at home and home stays SD ("SD, as chosen on this device"). Stored in the
  browser (a viewing preference, not a camera setting).
- A name of your own (a domain through a proxy or a tunnel) cannot tell home
  from away, so it counts as home: HD, with the button to turn it off.
- Where the camera has no HD stream, full screen says why, as before.

**On the owner's iPhone (2026-10-28, v0.32.2).** Through Tailscale, full screen
stayed in the lighter SD until HD was tapped, and HD stayed on when full screen
was closed and opened again (a split second in SD each time, while HD started).
Two things were wrong, both fixed in v0.32.3 and checked in Chromium on the design
preview at a phone's size:

- **The SD picture was cropped** in full screen until HD replaced it, so away from
  home, where full screen stays in SD, it always was. The board's crop
  (`:host([fill][fit="cover"])`, top and bottom, to fill a cell) outranked full
  screen's whole picture (`:host([full]) video`), and HD is another `<video>`. The
  crop now applies only off full screen (computed `object-fit`: `cover` on the
  board, `contain` in full screen, for the SD video and the picture).
- **The buttons sat under the iPhone's corners**: the HD button, the camera's name
  and the full-screen button. On the iPhone full screen fills the window (WebKit
  has no element full screen there), and Home Assistant's page draws under the
  corners and notch (`viewport-fit=cover`). Full screen now pads itself by the
  safe-area insets (`env(safe-area-inset-*)`), black around.

Tests: the tile's stylesheet keeps the crop off full screen and the safe-area
padding on it (unit; both fail on v0.32.2's).

**Released and checked 2026-10-28.** The dry run (run 40774477103), then the
release (run 40775106871), on main at 2e8d235, published
[v0.32.3](https://github.com/ambient-home-systems/Maverick-Reolink-Viewer/releases/tag/v0.32.3): the zip is main's
`custom_components/reolink_viewer` file for file. On the owner's iPhone, through
Tailscale and on mobile data: full screen shows the whole picture at once, its
buttons are clear of the corners, and the pinch follows the fingers. Full screen
away now started in HD at once: the HD tapped away in check 6 is remembered for
away on that device, as designed; tapping HD in full screen turns it back to the
lighter SD ("SD, as chosen on this device").

**How full screen starts, as a setting (v0.33.0).** The owner asked, after that
check, for the choice as a setting: Devices → **This device** sets full screen's
start at home (HD or SD) and away (HD or the lighter SD), stored in the browser like
the choice a tap made (`reolink-viewer.full-screen-hd`), and **Remember HD or SD when
I tap it in full screen** (on by default, as before): off, a tap lasts until full
screen closes (`reolink-viewer.full-screen-keep-taps`). Tests: the setting's storage
(unit), a tap not kept (the tile), and the section reading and writing them (the
panel). Released 2026-10-28: the dry run (run 40782628870), then the release (run
40783164759), on main at 489b09b, published [v0.33.0](https://github.com/ambient-home-systems/Maverick-Reolink-Viewer/releases/tag/v0.33.0), its zip main's
`custom_components/reolink_viewer` file for file. The owner updated through HACS,
and the setting works on the iPhone.

**The iPhone checklist.** What only the owner's devices can check. For each of
three setups: the Companion app on home Wi-Fi; with Wi-Fi off, through
Tailscale; and through Nabu Casa. Note for each line whether it worked, and
anything odd.

1. **The board.** Open Reolink Viewer. Every camera's picture shows at once,
   then live video; the cameras kept warm start within about a second.
2. **Full screen.** Open a camera, then full screen.
   - At home: the HD button is lit (blue) and the picture sharpens within a few
     seconds.
   - Away: it says "Lighter SD through Tailscale" (or Nabu Casa). Tap HD: the
     picture sharpens. Leave full screen and come back: HD is still on.
3. **Picture-in-picture.** In full screen, tap the picture-in-picture button
   (beside the full-screen button). Swipe up to the Home Screen, open another
   app: the camera keeps playing in its small window. Tap the window to come
   back. Note if the button does not show, or the window freezes.
4. **The timeline.** On the camera's Playback tab, on the timeline:
   - pinch with two fingers: it zooms in around your fingers;
   - slide two fingers sideways: it moves along the day;
   - drag one finger: the playhead follows; tap: it plays from there;
   - a long press shows no menu, and the page still scrolls up and down.
5. **The end of a recording.** Let one play to its end: the next starts by
   itself. Try it once with picture-in-picture on (the Playback toolbar's
   button): say whether the small window carried on into the next recording
   or closed. Both are handled; this tells which the iPhone does.
6. **The reports (optional).** Run the live check (Devices → Live check) for
   the setup, and copy its "In short" lines into the hardware matrix.

And from step 3.1, at the work PC: open the Live board for 15 minutes or more.
After about 11 minutes the tiles should start over WebRTC and stop dropping,
and a tile's ⓘ view should say "Network: it cut MSE's connections twice, so
WebRTC goes first until …".

### Step 4: error states

Built in three parts:

- **4.1 live** (v0.27.0): a camera Home Assistant cannot reach shows as
  offline, and live errors say what happened and what to do.
- **4.2 playback and storage** (v0.28.0): no SD card, a failed or unformatted
  disk, recordings out of reach while a camera is offline, and video the
  browser cannot play.
- **4.3 the integration changed** (v0.29.0): a plain banner when a Home
  Assistant update changes the Reolink integration's internals, and screenshots
  of every error state in the design preview.

### Step 4.1: live error states (v0.27.0)

**A camera Home Assistant cannot reach.** The Reolink integration makes a
camera's entities unavailable while it cannot reach it (the camera is off or
off the network, or the NVR cannot see it). `live/cameras` now names one of
each connection's entities (`status_entity`: its camera entity, else another
enabled one), and the panel reads its state from Home Assistant:

- Its tile keeps its last picture under "Offline since 06:31" (with the date
  when it is older than 12 hours) and "Home Assistant cannot reach this camera.
  It plays again when it is back", with **Offline** and an amber square in its
  state label (amber is a fault, as everywhere in the panel).
- It does not try to play meanwhile, so an offline camera no longer cycles
  through failed starts and waits; it plays as soon as Home Assistant reaches
  it again.
- The board counts it: "6 of 8 playing · 2 offline".

**Live errors in plain words** (`src/live/explain.ts`). When video cannot play,
a tile says what happened in one line and what to do, instead of the player's
technical message ("MSE: streams: dial tcp …: i/o timeout"), which stays in the
tile's ⓘ view:

| What the player saw | What the tile says |
| --- | --- |
| every stream slot in use | Too many cameras are streaming from this recorder at once. *Close live view on another screen, or keep fewer cameras warm.* |
| go2rtc not running | Live view's video service is not running. *Restart Home Assistant. If it stays, run the live check.* |
| codec refused, no MediaSource | This browser cannot play this camera's video. *Try Chrome or Safari, or set the camera's video to H.264 in the Reolink app.* |
| 401, wrong user/pass | The camera refused Home Assistant's login. *Check its password in the Reolink integration.* |
| timeout, refused, unreachable | The camera did not answer. *Check that it is powered and connected. It tries again by itself.* |
| a battery camera that did not answer | It could not be woken. *It may be out of Wi-Fi range or low on battery. Try again in a moment.* |
| ICE failed | No connection for live video could be made from here. *It tries again by itself. If it stays, run the live check on this device.* |
| no frame in time | The camera sent no picture in time. *It may be busy, or far from its Wi-Fi.* |
| the stream ended | The camera's video stopped. *It starts again by itself.* |

A small tile on the board shows the line only; the camera's own view adds what
to do. Full screen's "HD cannot play" uses the same words.

The design preview takes `?offline=cam-dogs,cam-garage` to show cameras Home
Assistant cannot reach.

### Step 4.2: playback and storage error states (v0.28.0)

**Where a camera's recordings are.** `devices` now says, for each camera, where
its recordings are and whether the disk keeping them is ready
(`recordings: {where, storage}`):

- `where` is `playable` when a connection is its playback source, `elsewhere`
  when one keeps recordings it cannot send to Home Assistant, and `none` when it
  keeps none (no SD card, and not on an NVR in Home Assistant).
- `storage` is `ready`, `not_ready` (a disk or SD card that is not formatted, or
  has failed) or `none`, from the recorder's disks (`bridge.storage_state`).

**The Playback tab of every camera.** A camera with nothing to play keeps its
Playback tab, and the tab says why instead of disappearing:

| The camera | Its Playback tab says |
| --- | --- |
| no SD card, no NVR | **No recordings to play.** Laundry Room keeps no recordings: it has no SD card, and it is not on a Reolink NVR in Home Assistant. *To record, put a microSD card in it and format it in the Reolink app, or add it to a Reolink NVR. Its live view and pictures work either way.* |
| records, but cannot send them | **Recordings kept where they cannot be played here.** … Play them in the Reolink app. |
| degraded mode | **No playback in degraded mode.** The Reolink integration's internals changed in this Home Assistant release … |

**A disk that is not ready.** Over the timeline: "Doorbell's SD card is not
ready: not formatted, or failed, so recent recordings may be missing. Format it
in the Reolink app, or replace it." ("The NVR's hard disk is not ready" for a
camera on an NVR). The Overview says
the same over the connection's facts, and its Storage row names the disk
("SD card: 42% used", "Hard disk 2: not ready (not formatted, or failed)",
"None: no SD card, so it keeps no recordings of its own").

**Recordings in plain words** (`src/playback/explain.ts`). Errors say what
happened and what to do, in bold over the technical text, which stays under
Details for support:

| What went wrong | What the Playback tab says |
| --- | --- |
| a day's search, while the camera (recording to its SD card) is offline | Front Yard is offline, so the recordings on its SD card cannot be read. *They come back when it does.* |
| a day's search failed or timed out | The recorder did not answer when asked for this day's recordings. *Try again in a moment. If it stays, check that the NVR or camera is online.* |
| media error 4, no supported streams, codec, decode | This browser cannot play this recording. *Try Chrome or Safari, or play it in SD.* |
| no main-stream recording | There is no HD copy of this recording. *Play it in SD.* |
| unknown segment | This recording is no longer there: the recorder may have recorded over it. *Open the day again.* |
| 403, 404, expired | The recording's link has expired. *Play it again.* |
| cache failed, network, 5xx | The recording could not be fetched. *Check the connection to Home Assistant, then play it again.* |
| Home Assistant's disk full | Home Assistant's disk is too full to fetch this recording. *Free some space on it, then play the recording again.* |

HD falling back to SD says so in the same words: "HD could not play: This
browser cannot play this recording. Back to SD."

The design preview takes `?disk=cam-door,dev-nvr` to show the Doorbell's SD
card or the NVR's disk not ready; Laundry Room shows a camera with no
recordings.

### Step 4.3: when Reolink Viewer cannot reach the cameras (v0.29.0)

**A note over every view** (`src/integration.ts`). Before, the Devices list
alone said "Degraded mode" with the compatibility check's findings, while the
home view showed an empty board and "Could not read today's events: Reolink
integration internals changed: …". Now the panel tells three cases apart, from
the `devices` answer, and says each the same way on every view:

| Case | The note says |
| --- | --- |
| an update changed the integration (the compatibility check failed) | **Reolink Viewer needs an update.** A Home Assistant update changed its Reolink integration, and this version of Reolink Viewer cannot work with it. *Update Reolink Viewer in HACS when a new version is out. Until then, live view, recordings and events are off here. Your cameras keep recording, the Reolink app still works, and your devices and their settings are still here.* The check's findings and the reolink-aio version under Details |
| no Reolink entry loaded | **The Reolink integration is not running.** Home Assistant's Reolink integration has not loaded your cameras or NVR, so Reolink Viewer cannot reach them. *Check it under Settings → Devices & services → Reolink: it may be waiting for a camera or NVR to come back online.* |
| no Reolink devices at all | **No Reolink devices yet.** Set up your cameras or NVR in Home Assistant's Reolink integration first (not a fault: grey, not amber) |

- The Live and Events views show the note instead of the board and the
  events, which cannot work meanwhile.
- The Devices list, a device's page and the checks show it over what still
  works. The device page's own "Degraded mode" line is gone; its Playback tab
  says "Recordings cannot be played right now" and why.
- **Check again** loads the devices again, so the panel comes back without a
  reload once the integration runs or Reolink Viewer is updated.
- Home Assistant's repair notice says the same: "Reolink Viewer needs an
  update".

**Load errors in plain words.** The board's, the events' and the device
list's load errors say what happened and what to do, with **Try again** and
the technical text under Details:

| The error | It says |
| --- | --- |
| Reolink Viewer is not loaded | Live view could not load: Reolink Viewer is not running. *Check it under Settings → Devices & services, then try again.* |
| internals changed | … Reolink Viewer needs an update to work with this Home Assistant release. |
| unknown command (updated, not restarted) | … Reolink Viewer was updated, but Home Assistant has not restarted since. *Restart Home Assistant, then reload this page.* |
| anything else | … could not load from Home Assistant. *Check the connection to Home Assistant, then try again.* |

**Fixed on the way:**

- On the board, a camera's error text and its Retry button covered its name
  (desktop and phone). A board tile now says what happened, clear of its
  number, state and name; it adds what to do when tall enough, and the button
  when there is room for it. Tapping a tile opens the camera's view, which has
  both.
- A day whose recordings could not be read said "No events for the chosen
  kinds"; it now says "This day's events could not be read."

**Screenshots of every error state.** The design preview takes
`?degraded=changed|stopped|none` and `?fail=board,events,day,tiles,devices`
(the board's, the events', a day's recordings', the tiles' or the device list's
requests fail), and `node scripts/preview_capture.cjs <dir> errors` captures
all 15 error states, light and dark, desktop and phone:
offline cameras, tiles that cannot play, the board and events not loading, an
SD card and an NVR disk not ready (Playback and Overview), a camera with no
recordings, a day that could not be read, an offline camera's SD card, the
three integration cases, and the device list not loading.

### Step 5: accessibility (v0.30.0)

**How it is checked** (`scripts/a11y_check.cjs`, its own CI job). The design
preview's every view, and the states that change what is on them (offline
cameras, failing tiles, a disk not ready, the integration changed, the camera
controls, the siren's confirmation, full screen and the debug view), in light
and dark, at desktop and phone width:

- **axe-core** (4.14.0) checks WCAG 2.1 A and AA, inside the panel's shadow
  roots, contrast included. Any violation fails.
- **The keyboard:** Tab goes through each view, and everything it reaches must
  have a name (the browser's own, from Chromium's accessibility tree) and show
  where the focus is. `--tabs` prints each view's order.
- **Reduced motion** (`src/motion.test.ts`): every file that animates or
  fades has a `prefers-reduced-motion` rule that stops it.

The first run found 52 problems in four kinds; all are fixed, with what the
keyboard walk showed:

| Found | Fixed |
| --- | --- |
| A live tile was a box with `role="button"` around its own text and its Retry button (names that hid the text, controls inside a control) | The tile's action is a real button over the picture, "Open Front Yard" or "Watch Laundry Room", described by the tile's state and message; Retry says which camera |
| The calendar's grid had no rows; its days took `aria-pressed`, which a grid cell cannot; each of 31 days was a Tab stop named "2026-10-21" | A grid of weeks, one Tab stop: the arrows move by day and week, Home and End to the week's ends, Page Up and Page Down by month. Days read "Wednesday, October 21, has recordings", the chosen one selected, today marked |
| Event rows were named differently from what they show ("Person · Doorbell, Doorbell, 20:58, new: play the recording"), so voice control could not reach them | Named by what they show: "20:58 Person · Doorbell New Doorbell 1:25" |
| The timeline was a slider whose arrow keys moved the view, not the time; the keyboard could not choose a time to play | The arrows move the time (a 48th of the view: half an hour on a whole day, 5 minutes at an hour), Page Up and Page Down six times further, Home and End to the day's start and to now; it plays from there once the keys rest, or at once with Enter. It reads "04:30:00, nothing recorded" |
| The device tabs were four Tab stops, with no tab panel | One stop, the arrows between them, Enter opens one; the content is their tab panel |
| "About this setting", 25 times over | "About this setting: Motion sensitivity" |
| The siren's confirmation and a tile's debug view did not take the focus, nor close with Escape | Both do: the confirmation's focus starts on Cancel, Escape is No, and the focus goes back to the button that opened it |
| After opening a device from the list, the focus was lost with the list | The new view (named Live, Events, Devices, Device…) takes it |
| Settings' sections jumped from the device's title (h1) to h3 | h2 |
| A failing tile's message was an alert, eight at once on the board | Said politely (`role="status"`) |
| The playback check said nothing while it ran | Its findings are a polite live region while it runs |
| The board's corner buttons faded under reduced motion | They appear at once |

The design preview's Front Yard Left now has its siren and floodlight states,
so the controls can be checked.

### Step 6: packaging (v0.31.0)

**Releases.** The built panel has been committed since Phase 1, so any tagged
commit carries it; what was missing was the release itself.

- `scripts/build_release.py` packages the integration as `reolink_viewer.zip`
  (laid out as `custom_components/reolink_viewer`, 60 files, about 400 KB), after
  checking that the version is the same in the manifest, `frontend/package.json` and
  the live check, that `CHANGELOG.md` has its entry, and that the built panel is
  whole (every module it imports, every font it asks for). It says plainly what is
  wrong otherwise. CI runs it on every change.
- `.github/workflows/release.yml` (Actions → Release → Run workflow, on main) runs
  CI on that commit, packages it, refuses a version already released, and makes the
  GitHub release `v<version>` with the zip attached and the changelog entry, plus
  how to install, as its notes. **Dry run** does all but publish. HACS reads the
  releases: it offers each one as an update.
- `scripts/bump_version.py 0.32.0` sets the version in every file that carries it.
- `CHANGELOG.md` starts at 0.31.0, the first release; the README keeps the history
  before it.

HACS installs the repository's folder at the release's tag, which holds the built
panel, so `zip_release` is not needed; the zip is for installing by hand. Listing in
HACS's default store (no custom repository) needs the integration's icon in
`home-assistant/brands` and the repository's description and topics: after the
first release.

**Home Assistant versions.** Each Home Assistant release pins its own reolink-aio,
frontend and media packages, and the bridge reads the Reolink integration's
internals, so each release needs its own test run, with its own pins:

| Home Assistant | Its test harness | Pins it brings | Runs |
| --- | --- | --- | --- |
| 2026.10.1, the oldest supported (`hacs.json`) | 0.13.372 | reolink-aio 0.21.18, frontend 20260930.3 | every change |
| 2026.10.4, the pinned newest (`requirements_test.txt`) | 0.13.375 | reolink-aio 0.21.18, frontend 20260930.5 | every change |
| the newest | the newest | its own | weekly, non-blocking |

`scripts/ha_requirements.py` reads a release's pins from its own component
manifests, so the matrix installs the right ones without a list to keep up.
`tests/test_packaging.py` keeps `requirements_test.txt`, `hacs.json`, the README and
the matrix in step. The pin moved from 2026.10.1 to 2026.10.4.

Its first run found that **2026.10.0 cannot run Reolink Viewer**, though
`hacs.json` had claimed it since Phase 1: its reolink-aio (0.21.17) has no
`Baichuan.search_vod_days`, which the recordings calendar uses, so the compatibility
check put the integration in degraded mode (no live view, recordings or events; 44
tests failed). The oldest supported release is now 2026.10.1, in `hacs.json`, so HACS
no longer installs it on 2026.10.0.

**The optional go2rtc app: not built.** Reolink Viewer already runs its own go2rtc,
from the binary Home Assistant's container ships (Home Assistant OS included) or a
pinned, checksum-verified download, and nothing it plays is transcoded: the cameras'
H.264 sub and ext streams play in every browser, and full screen picks the H.265 main
stream only where the browser decodes it (else the ext stream). An app would add a
second repository, an image per architecture, and a second thing to update, for no
camera in the hardware matrix that needs it. It becomes worth building if a camera's
only streams are ones a common browser cannot play (an H.265-only model in Firefox,
say): then an app with the GPU (VAAPI) could transcode them.

**The owner's part (the exit criterion):**

1. Actions → **Release** → Run workflow, with **Dry run** ticked: it should end
   green with "Ready to release v0.31.0" and the notes. Then again without it.
   **Done 2026-10-28:** the dry run (run 40716134102), then the release (run
   40717064888) published v0.31.0 with `reolink_viewer.zip` (60 files, 401 KB), the
   same files as a build of main. v0.32.0 the same way, see "Step 7: docs".
2. On a clean Home Assistant 2026.10 or newer, with HACS: add this repository as a
   custom repository (Integration), install Reolink Viewer (now **0.32.0**), restart,
   add the integration, and open the Reolink panel.
3. With the Reolink integration set up there, run the live check and the playback
   check (the hardware-in-the-loop checklist).

Items 2 and 3 are part A–E of "Phase 4 exit: the checklist".

**Home Assistant 2026.11 replaces HACS.** Its beta (2026.11.0b0, 2026-10-28) ships
HACS inside Home Assistant as the **Marketplace** (Settings → Marketplace), and
blocks the HACS custom integration. The Marketplace reads the same `hacs.json`,
keeps custom repositories ("Add from link") and moves HACS installs over with
their updates, so Reolink Viewer needs no change to install there; but the
README's and the user guide's install steps name HACS's menus. Once 2026.11.0 is
out (expected 2026-11-04), they need the Marketplace's steps beside HACS's, and a
fresh Home Assistant can no longer test the HACS route.

### Step 7: docs (v0.32.0)

Three guides for the people who use the panel, in plain words (the owner asked that
everything users read be clear to someone who is not technical), and the way to
them from the panel:

- **`docs/user-guide.md`:** install, then each part of the panel as it appears (the
  board, full screen and HD, the controls, keep warm, today's events, the Events tab,
  Devices, a camera's Overview, Live, Playback and Settings, the checks and the
  probe), on a phone, from the keyboard, privacy, updating and removing. Its pictures
  are the design preview at 21:30 on its day (`scripts/preview_capture.cjs
  docs/images guide`), said to show sample cameras.
- **`docs/troubleshooting.md`:** every message the panel can show, quoted as it
  appears, with what it means and what else to try: when Reolink Viewer cannot reach
  the cameras, pages that cannot load, each word and message on a tile, slow starts,
  networks that cut video, SD in full screen, recordings that cannot be read or
  played, missing events and settings, how to read the checks, and what to include
  when asking for help.
- **`docs/cameras.md`:** the hardware matrix in plain words: each model tested (the
  RLN36, Duo 3, both RLC-520A, E1 Pro, CX410, CX810, E1 Zoom and the battery
  Doorbell) with what to expect; NVRs, Home Hubs (not tested), cameras on their own
  (SD-card playback not yet tested on a real camera), battery cameras and cameras
  that keep no recordings; video formats and browsers; the camera settings that
  help (a shorter key-frame interval on the Fluent stream); and how to add a model.

**In the panel.** **Devices → Help** lists the three guides, with the version
installed; the box saying Reolink Viewer cannot reach the cameras, and the banners
for pages that cannot load and recordings that cannot be read or played, have
**More help** to the part of troubleshooting about them. The links open the docs at
the release's tag (`blob/v<version>/docs/…`), so they match what that version shows.
The version now lives in `frontend/src/version.ts` (`bump_version.py` sets it,
`build_release.py` checks it), which the reports and the links share.

**Kept in step.** `src/help.test.ts` fails when a section the panel links to is
missing, when a message the panel can show is not in troubleshooting word for word
(the plain-words modules, the tiles' words, the storage and no-recordings notes),
or when a link or picture in the docs leads nowhere.

The README now starts with what Reolink Viewer does, how to install it and where the
guides are; the history before the first release moved to its end.

**Released 2026-10-28.** The dry run (run 40727160277), then the release (run
40728332220), on main at c5aca51 with CI green (run 40724800417), published
[v0.32.0](https://github.com/ambient-home-systems/Maverick-Reolink-Viewer/releases/tag/v0.32.0)
with `reolink_viewer.zip` (59 files, 401 KB; one fewer than v0.31.0's because the
build now puts the live and playback checks in one chunk). The zip is the same,
file for file, as main's `custom_components/reolink_viewer`, at version 0.32.0. The
Help links the installed panel makes (`blob/v0.32.0/docs/…`) open, and every section
they point to is in the tag's docs.

### Phase 4 exit: the checklist

**Not run.** On 2026-10-28 the owner closed Phase 4 without it: v0.32.0 works in
daily use. So none of A–G is measured as written: the install through HACS on a
clean Home Assistant, the live and playback checks there, and the iPhone checklist
(step 3.3). The steps stay here for a later check.

**Simpler checks instead** (the virtual machine was too much; the owner's own Home
Assistant, 2026-10-28):

1. **HACS update** to v0.32.1: done; Help says 0.32.1.
2. **The work PC** on v0.32.1: after a reload the Doorbell started over MSE first in
   1.00 s (see H below).
3. **The live check** on the Mac (run 20): every camera started, typically in under
   0.1 s; first images 0.02 s; ours faster than Home Assistant's view on 18 of 18;
   the capacity test ran with the warm feeds set aside. Its verdict wrongly blamed
   the NVR for the Back Yard main, which plays no video: fixed in v0.32.2.
4. **The playback check** on Front Yard Right (run 21): every part good; a deep
   start not cached 9.0 s, cached 0.1 s; HD 4.7 s ("Fine").
5. **The iPhone at home** (v0.32.2): the board, picture-in-picture and the next
   recording starting by itself worked; full screen's buttons sat under the
   corners, and a pinch zoomed one step only (both fixed in v0.32.3, see steps 3.2
   and 3.3).
6. **Away, through Tailscale**: lighter SD until HD was tapped, and HD
   remembered; the SD picture was cropped in full screen until HD (fixed in
   v0.32.3).

And the live check again on v0.32.2 (run 22): the capacity test left out the Back
Yard's main and said so, and the NVR kept up at every level.

7. **v0.32.3 on the iPhone**: full screen's whole picture in SD, its buttons clear
   of the corners, and the pinch following the fingers: all three fixed.
8. **v0.33.0**: Devices → This device sets how full screen starts; it works.

**H, the work PC (2026-10-28 13:15).** The owner left the Live board open there,
through Nabu Casa, "playing fine the whole time", and sent the Doorbell tile's ⓘ
view after about 13 minutes (the hardware matrix has it):

- The network cut nothing this time: the tile's MSE session, begun with its feed
  (756 s old), never ended, where run 15 saw every one cut about every 5½ minutes. Step 3.1's switch
  had nothing to switch on, so it is still not seen on that network.
- WebRTC could not start there: the Doorbell, not kept warm, waited 15 s for a
  WebRTC frame, then played over MSE in 0.98 s. A camera not kept warm always tries
  WebRTC first (`live/player.ts`), and the page remembers MSE being cut but not
  WebRTC failing, so on such a network each cold start, and each restart after a
  drop, waits those 15 s. Fixed in v0.32.1 and checked there the same day: after a
  reload the Doorbell started over MSE first in 1.00 s, see "Step 3.1: live view
  that holds up".

What only the owner's devices can do, in the order to do it: one sitting at home
(about two and a half hours, much of it waiting), then 20 minutes at the work PC.
Each item says what to send back.

**Before 2026-11-04.** A new Home Assistant OS installs the newest Home Assistant on
its first start. From 2026.11.0 (expected 2026-11-04) that brings the Marketplace,
which does not let HACS install (see "Step 6: packaging"). Done later, part C uses
the Marketplace instead.

**Why a virtual machine, not a container on the Mac.** Docker Desktop runs
containers inside its own virtual machine, behind its own address translation: the
Mac reaches them only through published ports, other devices not at all. Reolink
Viewer's go2rtc offers browsers the addresses it sees for WebRTC (`listen :18556`,
no fixed candidates), which there are inside Docker's machine. WebRTC, and Home
Assistant's own camera view, would then fail for a reason a real install does not
have, and the live check would report it as a problem. Home Assistant OS in
VirtualBox on a bridged adapter has its own address on the LAN, like a real install
(and most HACS users run Home Assistant OS); Home Assistant's macOS guide covers it
on Intel and Apple silicon. Its own address also keeps the NVR from mixing its
sessions up with the main instance's: the Reolink integration's docs warn that two
connections from one address can confuse a camera.

**What it costs the NVR.**

- One more login, as the main instance has: an API session, a TCP push connection
  (port 9000) and polling every minute. The same on the E1 Zoom, which is added too.
  Recording is not affected, and nothing is written to the devices: the checks only
  read.
- Stream slots. Reolink Viewer asks an NVR for at most 7 live videos, but each Home
  Assistant counts only its own. The test instance keeps 6 NVR cameras warm from the
  moment it is set up (the default); with the main instance's 6, the NVR would serve
  12, more than it was ever measured on, and the capacity test, which needs 7 slots,
  would measure that instead. So the main instance's warm feeds are paused for the
  test (2): the NVR then carries its daily load, plus the checks. The capacity test
  opens up to 7 streams one at a time, over a minute or two, then downloads a
  recording at full speed for a few seconds (run 5: 377 Mbit/s, every stream at its
  frame rate); the playback check downloads a few recordings, an HD one among them.

**Sitting 1, at home (the Mac and the iPhone)**

A. Get ready, on the main instance (10 minutes).

1. Close Reolink Viewer's panel everywhere, the iPhone app included.
2. Pause the warm feeds. Settings → Tools → Template:

   ```jinja
   {{ integration_entities('reolink_viewer') | select('match', 'switch[.]') | select('is_state', 'on') | list }}
   ```

   Then Settings → Tools → Actions, in YAML mode, with that list pasted as it is:

   ```yaml
   action: switch.turn_off
   target:
     entity_id: ['switch.front_yard_right_keep_live_view_warm', '…']
   ```

   *Send:* the list (it turns them back on in 18).
3. On the NVR and the E1 Zoom (the Reolink app or client: the device's user
   management), add a user for the test, `hatest` say, as an administrator (the
   Reolink integration needs one). It goes in 17, and nothing the test set up
   outlives it.

B. A clean Home Assistant (45 minutes, mostly waiting).

4. Install VirtualBox 7.1 or newer. From
   [Home Assistant OS 18.4](https://github.com/home-assistant/operating-system/releases/tag/18.4),
   download `haos_generic-aarch64-18.4.vdi.zip` (Apple silicon, 387 MB) or
   `haos_ova-18.4.vdi.zip` (Intel, 560 MB), and unzip it.
5. VirtualBox → New: name `HA test`, no ISO image, OS Linux, Oracle Linux (64-bit)
   (on Apple silicon, Oracle Linux (ARM 64-bit)); 4096 MB of memory (Home Assistant's
   minimum is 2048) and 2 CPUs; **Use EFI** ticked. Then Settings → Storage: under the
   controller (SATA, or VirtioSCSI on Apple silicon) remove the empty disk and add the
   `.vdi`; Settings → Network: **Bridged Adapter**, on the Wi-Fi or Ethernet the Mac
   uses. Start it.
6. When the console shows Home Assistant's address (the first start downloads Home
   Assistant: up to 20 minutes), open `http://<address>:8123` in Chrome on the Mac.
   Use the number: `homeassistant.local` may be the main instance. Create a user, call
   the home `HA test`, leave analytics off, and add none of the devices it finds.
   *Send:* Home Assistant's and the OS's versions (Settings → About).

C. HACS and Reolink Viewer 0.32.0 (20 minutes).

7. HACS, as its docs say for Home Assistant OS: Settings → Apps → Install app → ⋮ →
   Repositories → add `https://github.com/hacs/addons`. Install **Get HACS**, start
   it, and follow its log; then restart Home Assistant (Settings → ⋮ → Restart Home
   Assistant). Settings → Devices & services → Add integration → **HACS** (reload the
   page if it is not listed), accept, and authorize it on GitHub with the code it
   shows.
8. HACS → ⋮ → Custom repositories: `https://github.com/ambient-home-systems/Maverick-Reolink-Viewer`,
   type **Integration**. Open **Reolink Viewer** → Download: it should offer
   **0.32.0**. Download it and restart Home Assistant.
9. Add integration → **Reolink**: the NVR's address, `hatest` and its password. Then
   the E1 Zoom the same way: the one camera on its own that is not also on the NVR.
   Leave out the CX410, CX810 and Doorbell on their own: they are on the NVR, so each
   would only add a session to its camera. (The Doorbell then plays through the NVR,
   as for most NVR owners, which the main instance never tried.)
10. Add integration → **Reolink Viewer**. Open **Reolink** in the sidebar (reload if
    it is not there), then Devices → **Help** → User guide: it opens at an address
    with `/blob/v0.32.0/`.
    *Send:* the version HACS offered, anything unexpected in 7–10, whether every
    camera came onto the board, and the Help page's address.

D. The checks, on the test instance (45–60 minutes).

11. Leave the Live board open for 5 minutes, so the cameras kept warm are warm and
    each has a last picture.
12. Devices → **Live check**: "Desktop Chrome, LAN", everything left ticked (all
    cameras, every quality, Home Assistant's view, kept warm, the NVR capacity test).
    Run it, with the tab in front until it ends.
    *Send:* Details for support → **Copy report**.
13. Devices → **Front Yard Right** (the CX410: it records continuously, so the check
    starts deep into hour-long recordings, which runs 18–19 on Dogs could not) →
    Playback → **Details and playback check**: "Desktop Chrome, LAN", "Switch to HD
    and back" ticked, "Then play for 60 minutes" not. Run it, the tab in front.
    *Send:* Details for support → **Copy report**.

Send both reports before E: they live in the test instance.

E. Remove it (15 minutes).

14. In the test instance: Settings → Devices & services → Reolink Viewer → ⋮ →
    Delete, then each Reolink entry (each logs out of its device).
15. VirtualBox: the VM → Close → Power off, then Remove → **Delete all files**.
    Delete the zip and the `.vdi`.
16. GitHub → Settings → Applications → Authorized OAuth Apps → **HACS** → Revoke.
17. On the NVR and the E1 Zoom: delete `hatest`.
18. The main instance: Settings → Tools → Actions, `switch.turn_on` with 2's list.
    Its warm tiles start at once again within a minute or two.
    *Send:* that it is done, and anything odd on the main instance meanwhile.

The router forgets the VM's address when its lease runs out. VirtualBox's disk image
has an uninstaller, if VirtualBox is not wanted afterwards.

F. The main instance to 0.32.0 (10 minutes).

19. Settings → Updates should offer Reolink Viewer 0.32.0 from HACS; install it and
    restart. (If the main instance did not have it from HACS, install it as in 8.)
    Devices → Help says 0.32.0.
    *Send:* whether HACS offered it, and how the main instance had it before.

G. The iPhone (step 3.3, 45 minutes).

20. In the Home Assistant app, three times: on home Wi-Fi; with Wi-Fi off, through
    Tailscale; with Wi-Fi off, through Nabu Casa. Each time, step 3.3's checklist:
    the board, full screen and HD ("Lighter SD through Tailscale" away), picture in
    picture, the timeline under fingers, the end of a recording (with picture in
    picture once), and the live check as "iPhone app, Wi-Fi (local)", "iPhone app,
    Tailscale" or "iPhone app, Nabu Casa" (away, untick the NVR capacity test: it is
    for home).
    *Send:* per setup, lines 1–5 of step 3.3: fine, or what was odd. The three live
    check reports: on the Mac afterwards, Devices → Live check → Saved reports →
    **Copy** each (copying in the app can be blocked).

**Sitting 2, the work PC (20 minutes, the panel left open)**

H. The network that cuts video (step 3.1).

21. In Chrome, open the main instance through Nabu Casa, Reolink → Live, and leave it
    open and in front for 15–20 minutes. About 11 minutes in, the tiles should start
    again over WebRTC, once, then stop dropping.
22. Then, on two tiles kept warm (Front Yard Left and the Garage, say): ⓘ →
    **Copy**. Each should say "Network: it cut MSE's connections twice, so WebRTC
    goes first until …".
    *Send:* the two texts, and whether tiles still dropped after the switch.

**Where the results go.** The hardware matrix gets a run each (the clean install's
live and playback checks, the iPhone's three live checks, the work PC); this plan's
Phase 4 status gets the outcome, and `docs/cameras.md` what changes for users. A
failure gets its cause found, a fix with tests and a patch release (`bump_version.py`,
`CHANGELOG.md`, the Release workflow), and the item runs again on it. Then Phase 4 is
done, in the phase table and the README, with the date and the release.

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
   Built in v0.30.0, see "Step 5: accessibility".
6. **Packaging:**
   - HACS releases with a built frontend
   - an HA version compatibility matrix
   - optional HA app repository for go2rtc and hardware transcoding

   Built in v0.31.0 (the app not built), see "Step 6: packaging".
7. **Docs:** user guide, troubleshooting, per-model notes from the hardware matrix.
   Built in v0.32.0, see "Step 7: docs".

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

### Phase 5 status

Started 2026-10-29 with step 5a only, the gate. The original targets are mostly
gone: no owned camera has broken RTSP/FLV, the battery Doorbell runs on wired
power and starts live over WebRTC in 0.4 s, and speeds and scrubbing work. Two
gaps remain that only the Reolink app's own protocol may close, and 5a is scoped
to them:

- **Primary: deep starts in uncached recordings.** The NVR ignores HTTP `Range`
  and `start=`, so starting 41–57 min into an hour-long recording waits for the
  download up to there (6.9–13.0 s, Phase 2B), while the Reolink app starts at the
  chosen time at once. Find out whether Baichuan playback on the RLN36 can start
  at an arbitrary time, seek and change speed, and how fast.
- **Secondary: two-way audio (talk)** on the Doorbell.

| 5a step | Status |
| --- | --- |
| 1. Prior art at its latest versions: reolink-aio 0.22.0 (and its open PRs #164 replay, #186 download, #218 live, #219 talk), neolink master and PR #396, nodelink-js, cam-sim, reolink-downloader, reostream, leolink, the HTTP API guide | **Done**: [baichuan-playback.md §1](baichuan-playback.md#1-what-is-already-known). Nothing released plays or talks over Baichuan; the open PRs and nodelink-js agree on a replay pattern (123 `ReplaySeek` → 5 `FileInfoList` with `playSpeed` → 7 stop) and on talk (10 → 201 → 202 ADPCM → 11), but no one has seen an in-session seek, a speed change, pause/resume, or an NVR replay at all. §1.6 lists what the capture must settle |
| 2. Capture-analysis tool `scripts/baichuan/` (pcapng/pcap → TCP reassembly → Baichuan framing → decryption with reolink-aio's cipher → redacted log) | **Done**: `python -m scripts.baichuan capture.pcapng --user admin --out log.txt [--json log.json]`. Tested on synthetic captures built with reolink-aio's own encoder (`tests/test_baichuan_capture.py`): out-of-order and retransmitted segments, a message split mid-header, a hole, a wrong password, two accounts, media blocks across messages, and that no credential, hash, nonce, UID, MAC or IP survives in the log |
| 3. Capture steps | **Done**: [scripts/baichuan/README.md](../scripts/baichuan/README.md). Captured on 2026-10-28 by a local Claude session on the owner's Mac (Remote Control into this cloud session never connected): the NVR over TCP, the Doorbell over UDP (the client cannot add it by IP), the tool run there, only the redacted logs shared |
| 4. `docs/baichuan-playback.md`: sequences, fields, framing, session impact | **Done** ([§3–6](baichuan-playback.md#3-message-sequences-from-the-owners-capture-2026-10-28)): replay is 123 `ReplaySeek` → 5 `FileInfoList` (`playSpeed`) → 7, every seek/speed/pause/resume a stop and a new start, the NVR's part under 0.1 s; downloads by time range (143); talk 10 → 201 → 202 at real time → 11. The replay frames (re-run): the first key frame 136 ms after the start request, the stream paced at the playback speed, key frames only at 16× |
| 5. Read-only confirmation, as an opt-in probe-style check in the panel | **Done** (v0.34.0–v0.34.1, [baichuan-playback.md §2.1](baichuan-playback.md#21-the-read-only-check-step-5) and [§6.1](baichuan-playback.md#61-the-read-only-checks-run-2026-10-29-v0341)): our own Baichuan connection, because reolink-aio drops the replay's message class; replay 75 % into a long recording against the HTTP download up to the same offset, the device's logged-in users before, during and after. The owner's run on the RLN36 (Garage, 24-minute sub recording, 17 min 43 s in): seek acknowledged in 13 ms, start in 41 ms, **first key frame 140 ms after the start request** (3 s before the asked time, the previous key frame), stop in 21 ms with nothing after; the replay was one more logged-in user (2 → 3 → 2) and started at once beside the live feeds; the HTTP download took **4.67 s** to the same offset at 87 Mbit/s. Talk not tried: the Doorbell speaks Baichuan over UDP, where sending audio needs reolink-aio 0.22's raw-payload send or our own UDP client |
| 6. Go/no-go and the estimate for 5b–5d | **Go, for deep starts** (below) |

**Go/no-go (2026-10-29): go, scoped to the primary target.** The replay sequence
is understood well enough to replay (every seek, speed change, pause and resume
is a stop and a new start; the frames are the known media blocks), our own
client already does it behind the scheduler, and the exit criterion is met in
the measurement itself: the NVR serves a deep start in 0.2 s where the Phase 2
path downloads up to the point first (4.7 s for a short sub recording, minutes
for 75 % of an hour-long main). Talk is deferred: the Doorbell's talk is UDP
with its own transport work, no one has sent audio over Baichuan in released
code, and nothing in daily use waits for it; it can be a later phase if wanted.

Estimate for 5b–5d, 3.5–5 weeks, within the box:

1. **5b — Prototype (1.5–2 wk).** `baichuan_client.py` becomes a replay source:
   one connection per host shared by handle, login once, seek + start at the
   asked time and speed, the media blocks parsed into H.264/H.265 access units
   and audio (the scanner in `ReplayStats` already finds them) and fed to the
   existing fragmented-MP4 muxer, so the panel's MSE player needs no change;
   seek and speed as a stop and a new start; stop on the viewer's leave; all of
   it under the scheduler and the stream budget as a stream. Measured in the
   playback check's deep-start row (D). Risks to settle first: the H.265 mains
   and the audio's codec (the check counted blocks, it decoded nothing), and
   whether a replay holds an NVR stream slot (the capacity test with a replay
   open).
2. **5c — Integrate (1–2 wk).** A per-host playback method in the hardware
   matrix and the options: Baichuan for uncached starts beyond the cached
   prefix (the first picture from the replay while the download fills the
   cache, or the replay alone), the HTTP path otherwise and as the fallback.
   The go2rtc live part of the original 5c is dropped: live view is solved.
3. **5d — Upstream (1 wk of work, longer in calendar time).** Propose to
   reolink-aio: receiving the replay's message class and a replay API, in step
   with its open PR #164, so HA itself benefits and the client's maintenance
   is shared.

### 5b: the prototype (started 2026-10-29)

Goal: a deep start in a recording that is not cached plays in about a second,
by asking the NVR for the chosen moment over Baichuan instead of downloading
everything before it over HTTP. Talk stays deferred.

Two corrections to the estimate above, made before any code:

1. **There is no muxer to feed.** `fmp4.py` only rewrites the NVR's own MP4
   fragments; Baichuan delivers raw media blocks (H.264/H.265 access units
   and the audio). 5b needs a muxer of its own, from those blocks to
   MSE-valid fragmented MP4: an init segment with `avcC`/`hvcC` and the audio
   configuration, `default-base-is-moof`, a `tfdt` in every fragment,
   timestamps from the blocks, key-frame alignment, and composition offsets
   if a stream has B-frames.
2. **The replay is paced; the download cut is not.** The replay (123 → 5 → 7)
   sends about six seconds in a burst, then real time (4× and 16× seen, 16×
   key frames only). The capture also shows **143**, a download cut by time
   range: 200 in about 100 ms, not paced (a 65 s clip in 0.37 s). A 143 from
   the target onward could fill the cache at full speed and keep speeds,
   scrubbing and HD as they are. Both are measured and one chosen; a
   combination (the replay's first picture, a 143 filling behind it) is
   allowed if it pays.

So 5b runs in two steps with a gate between them.

| 5b step | Status |
| --- | --- |
| 1. Measure, then stop (the gate) | **Built** (2026-10-29, v0.35.0–v0.35.3, below). **Run 1** (2026-10-30, v0.35.3, [baichuan-playback.md §6.2](baichuan-playback.md#62-the-5b-measurements-first-run-2026-10-30-v0353)): on the CX410's sub the download cut (143) delivered its first key frame 232 ms after the request, 3 s before the asked second, 23 s of media in 0.17 s, status 300 at the end; the replay 98 ms but paced; HTTP to the same point 7.35 s. H.264 High 5.1 and H.265 Main 5, no B-frames, a microsecond counter, AAC-LC 16 kHz mono. The reader lost sync on the main streams and the CX810, a main cut returned the sub stream, and the Duo 3 had no long recording: v0.35.4 fixes the three. **Run 2** (2026-10-30, v0.35.4, [§6.3](baichuan-playback.md#63-the-5b-measurements-second-run-2026-10-30-v0354-the-decision)): every stream read cleanly on all three cameras, sub and main; the cut's first key frame 126–223 ms after the request on both codecs, not paced, status 300 at the end; the replay's 119–187 ms but paced. **Done: the download cut is the source; go for step 2** |
| 2. The prototype, behind an opt-in setting ("start deep in recordings over the Reolink protocol", off by default) | **Done** (2026-10-30, v0.36.0–v0.36.1, [below](#step-2-the-prototype-v0360)): the muxer, one connection per host, the cut served through the fragment path with the download as the fallback, the source in the check's D rows and the debug panel. **The owner's hardware check passed** on LAN Chrome and the iPhone app (the exit criteria below): first frame 0.51–0.60 s against 9.0 s; v0.36.1 follows from it (HD cuts in spans, the HD list searched ahead). **5b done** (2026-10-30, v0.36.2): the checks of v0.36.1 and v0.36.2 (below) met every criterion, the NVR's own list of online users included |

#### Step 1: the measurement (v0.35.0)

The probe's opt-in Baichuan section (`probe_baichuan.py`, "Test replay over
the Reolink app's own protocol") now runs on every camera asked for (the
Cameras field; all, up to 8, when empty) and on the sub and, if ticked, the
main recordings, 75 % into a long recording of the last four days
([baichuan-playback.md §2.2](baichuan-playback.md#22-the-5b-measurement-step-1)):

1. **Replay and 143 from 75 % in**: the acknowledgements, the time to the
   first chunk and the first key frame, how close that key frame lands to the
   asked time, throughput, media seconds per wall-clock second (paced or not),
   the end markers (143's 300/331 or empty 143, the replay's none), and what
   144 answers. The client (`baichuan_client.py`) gained the download cut
   (143, the XML form reolink-downloader describes, the channel's own
   `logicChnBitmap` bit with 255 as the fallback), its end (144), end-marker
   detection, and several streams on one connection, each on its own command
   and handle byte.
2. **What arrives** (`baichuan_media.py`, new): the blocks reassembled across
   chunks; the codec by the NAL units; SPS/PPS/VPS as hex with the profile,
   level and size decoded (an `avc1.`/`hvc1.` codec string ready for the
   muxer); I/P/B picture types from the slice headers (B-frames mean
   composition offsets); the frame counter's steps, its ticks per second of
   wall-clock time (microseconds or not) and the frame rate; the AAC object
   type, sample rate and channels from the ADTS headers, or the ADPCM block
   size. Tested on x264 and x265 streams with B-frames and on hand-built
   parameter sets.
3. **Session cost**: the logged-in users before, during and after each
   stream; what `GetOnline` exposes about a maximum (`bridge.async_online_detail`:
   field names and any field named like a limit, and the abilities about
   users); the session test: one replay held open beside a full-speed HTTP
   download, then two replays of two cameras on the same connection. Whether
   a replay takes one of the NVR's stream slots: the Live check's capacity
   test run during a 90 s hold.

How to run it (the owner, Chrome on the LAN, the RLN36):

1. Update to v0.35.0 and restart Home Assistant; reload the panel.
2. Devices → Hardware probe: tick **Test replay over the Reolink app's own
   protocol** and, under it, leave **Only this test** ticked (v0.35.2: the
   six minutes of Phase 0 checks are skipped), tick **Also the HD (main)
   recordings**, leave the download cut ticked, tick **Session test**, and
   put `Back Yard, Front Yard Left, Front Yard Right` in **Cameras** (the
   Duo 3 and the CX810, H.265 mains, and the CX410, an H.264 main; from
   v0.35.2 models match too: `Duo 3, CX810, CX410`); hold 10 s. Run the
   probe; it takes a few minutes. Send the report.
3. A second run with the hold at 90 s and the Cameras field naming one
   camera, with the Live check's capacity test started on the recorder while
   the probe says "baichuan replay at …" (Devices → the recorder → Live check,
   capacity ticked): whether the capacity test reaches its usual level with a
   replay open. Send both reports.
4. **Run 2 (v0.35.4)**, after run 1: the same as run 1 with the keep-warm
   switches off (or the live board closed) so the session test gets its
   slots; it reads the main streams and the CX810, asks the main cuts for the
   main stream, and measures the Duo 3 on its longest clip.

What the report decides (rules fixed before seeing it):

- **The source.** 143 if its first key frame lands within one key-frame
  interval of the asked time on sub and main (it starts mid-file), its media
  seconds per wall-clock second stay well above 1 for the whole cut on main
  too (it is not paced), and it ends with a marker: then step 2 fills the
  cache from the target at full speed, and speeds, scrubbing, HD and the
  second visit stay as they are. The replay if 143 cannot start mid-file or
  is paced: then speed is the NVR's `playSpeed` (a stop and a start per
  change), the cache holds only what was played, and HD is a second replay.
  Both if 143 fills fast but its first key frame comes later than the
  replay's by more than the budget allows: the replay's first picture, the
  143 behind it.
- **The muxer.** H.264 and H.265 from the parameter sets found (the codec
  string from the SPS must match what the NVR's own MP4 says in the hardware
  matrix); composition offsets if any stream shows B-frames; the counter's
  units set the timescale; the ADTS header sets the audio sample entry.
- **The sessions.** One connection per host if two replays on one connection
  both deliver; the extra login is one user, and it must return to the
  baseline after logout. If a replay holds an NVR stream slot (the capacity
  test loses a level with one open), it is budgeted like a live stream.
- **Go for step 2** if, on both codecs, the chosen source shows a first key
  frame within 0.5 s of the request, the parameter sets decode, the audio
  configuration is known, and the extra login never exceeds one.

Run 1 against those rules (2026-10-30; the numbers in
[baichuan-playback.md §6.2](baichuan-playback.md#62-the-5b-measurements-first-run-2026-10-30-v0353)):

- **The source: the download cut (143), provisionally.** On the CX410's sub it
  started at the key frame before the asked second, arrived at 135× real time
  and ended with a marker; its first key frame came 232 ms after the request
  (the replay's 98 ms, but paced after its burst). Step 2 fills the cache from
  the target at full speed and keeps speeds, scrubbing, HD and the second
  visit as they are. Provisional because the main cuts came back as the sub
  stream (`supportSub` 1; v0.35.4 sends 0) and the CX810's key-frame timing
  was lost in the reader's resyncs.
- **The muxer:** `avc1.640033` (H.264 High 5.1) and `hvc1.1.6.L150` (H.265
  Main 5), no B-frames seen, so no composition offsets; the counter is in
  microseconds; AAC-LC 16 kHz mono from the ADTS headers. The frame layout of
  the main streams and the CX810 is what run 2's raw samples must settle: the
  reader took 24-byte frame headers and lost 26–44 % of those streams.
- **The sessions:** one more logged-in user per stream, back to the baseline
  at logout; no maximum exposed. Two replays on one connection were not
  reached: live view held six of the seven stream slots. Run 2 with the
  keep-warm switches off, or the live board closed, measures that part.
- **Go for step 2** holds on the CX410 (both sources under 0.5 s, the
  parameter sets decoded, the audio known, one extra login) and waits on run
  2 for the H.265 camera.

Run 2 (2026-10-30, v0.35.4) closes the gate
([§6.3](baichuan-playback.md#63-the-5b-measurements-second-run-2026-10-30-v0354-the-decision)):

- **The source is the download cut (143), final.** On the Duo 3 (H.265
  7680×2160), the CX410 and the CX810 (H.265 3840×2160), sub and main, the
  cut's first key frame came 126–223 ms after the request, at the key frame
  nearest the asked second (3 s before to 1 s after); sub cuts at 170–190×
  real time, main cuts at the link's 172–194 Mbit/s; status 300 at the end,
  144 closes it. The replay's first key frame is as quick (119–187 ms) but
  the stream is paced at 1.1–1.7×, so it buys nothing the cut does not. Step
  2 fills the cache from the target over 143 and serves it through the
  fragment path; everything after the first picture stays as it is.
- **What the muxer takes from run 2:** `avc1.640033` and `hvc1.1.6.L150`,
  I and P pictures only (no composition offsets); VPS/SPS/PPS in every key
  frame; Annex B to length-prefixed samples; frames' extra headers of
  96–312 bytes skipped by the start code; the 32-bit counter as the clock
  with its rate taken from the key frames' POSIX seconds (999,790 ticks per
  second on the CX410, about 1,020,000 on the CX810: a fixed 1 MHz would drift
  72 s an hour); the stream header's frame-rate byte ignored (30 on every
  stream); AAC-LC 16 kHz mono from the ADTS headers, one frame per block.
- **The sessions:** one more logged-in user per connection, back to the
  baseline at logout; two replays on one connection still unmeasured (live
  view held the slots again; v0.35.5 runs the second replay under the
  connection's own slot). Step 2 holds one connection per host under one
  stream slot and measures it in the playback check's deep-start rows.
- **Go.**

#### Step 2: the prototype (v0.36.0)

Built on the download cut, behind the integration's option **Start deep in
recordings over the Reolink protocol** (Settings → Devices & services →
Reolink Viewer → Configure; off by default, read at each start, no reload).

**What runs:**

1. **The muxer** (`baichuan_mux.py`, pure): blocks in; an init segment, then
   one fragment per group of pictures, out. `avcC` (with the High profile's
   chroma and bit depth fields) or `hvcC` from the stream's own VPS/SPS/PPS,
   the picture size from the SPS; AAC from the first ADTS header (ADPCM is
   not muxed); `default-base-is-moof`, `tfdt` v1, `trun` data offsets from the
   `moof`; samples as 4-byte length-prefixed NAL units without the access
   unit delimiter and the parameter sets the init holds (changed ones stay in
   band). Times on the recording's timeline (0 at its start, UTC): the first
   key frame at its POSIX second (the asked time when they are more than 30 s
   apart: a device clock off), then the 32-bit counter, wraps unwrapped, steps
   back absorbed; the counter's rate learned from the key frames' POSIX
   seconds once they span a minute (clamped to 0.95–1.05 MHz) and each frame
   moved toward that clock by at most a tenth of its duration. Audio on its own
   clock (1024 samples a frame) from the first key frame, moved into line when
   more than 2 s behind the video, dropped while more than 2 s ahead.
2. **The source** (`baichuan_source.py`): one `BaichuanReplayClient` per host,
   logged in by the first cut as a scheduler job (playback priority), shared by
   every cut on the host, logged out 30 s after the last one ends. One cut per
   channel: a new start on the channel stops the running one (144). Each cut
   holds a slot of the host's stream budget (5 s to get one, else no cut), asks
   143 from 4 s before the moment to the recording's end in the device's local
   time (`supportSub` 1 for sub, 0 for main; the channel's bit, 255 if
   refused), muxes the blocks as they arrive (the client hands them over
   without its analysis), writes them to `<cache id>.<n>.cut.mp4` in the
   executor, indexes it (`FragmentIndex`) and wakes the waiting windows. It
   fails on 15 s without data, a lost connection or a muxer error.
3. **The cache** (`vodcache.py`): a start (`init?at=`, or `frags?at=`) more
   than 30 s past what the download has indexed, in a recording not yet whole,
   asks for a cut (one decision at a time per recording), or reuses the running
   cut if it covers the moment or will within 60 s; it waits up to 6 s for the
   fragment holding the moment. Windows from the cut are numbered from
   1,000,000 × the cut's number (a window asked of a replaced cut is refused)
   and say `X-RV-Source: cut`; `init?source=cut` gives its init. The download
   goes on as before. The cut's file is reserved before it is written (the
   rest of the recording's expected size), counted, evicted with its
   recording, deleted when the last viewer leaves a recording now whole, and at
   start-up. Any failure (no slot, the login, no fragment in 6 s, the cut
   ending before the moment) leaves the start to the download, with the reason
   in the recording's status (`cut_error`).
4. **The panel**: the MSE feeder asks for the init of the source serving its
   start (`init?at=`) and, when a window comes from the other source, appends
   that source's init first (`changeType` if the codecs differ). The playback
   check (v0.4.0) says in each start's line what served the first window; its
   D1 row adds the cut (first fragment, slot, login new or shared, reply,
   fragments, rate, placement) and the Reolink protocol's logins (logged in now,
   logins, logouts); its summary says what served the uncached deep start. The
   debug panel's player line names the source; its cache line the cut's first
   fragment and login, or why no cut was used.

**v0.36.1, after the hardware check:** HD (main) cuts come in spans of 3
minutes of media (`CUT_SPAN_MS`); the source pauses between spans holding the
login but not a stream slot, the cache asks for the next span once a window
comes within 2 minutes of what the cut has (`EXTEND_WITHIN_MS`) or a wait needs
it, and a window past the cut's fragments is read from the download once it
has them. The muxer keeps the open group of pictures at a span's end and joins
the next span by the frame counter. The panel searches the day's HD list in
the background (`timeline/day` with `background`), says "Asking the recorder
for this moment…" while a cut serves a start, shows the last HD failure in
Details, and the check names each row's own source.

**How seeking and speeds work after a Baichuan start** (the exit criterion's
"record how"): the cut is not paced, so it lands on disk at the link's speed
(170–190× real time on sub), and every speed from 0.5× to 8× and a pause are
the player's own, on what is on disk. A seek inside the cut (or up to 60 s
past what it has received) reads the cut; a seek before it reads the download
(the panel appends the download's init, then its windows); a seek further on,
more than 30 s past the download, starts a new cut and stops the old one. The
replay (paced, a new start per seek or speed) is not used.

**Tests** (CI): the muxer on hand-made and real x264, x265 and AAC streams in
camera blocks (ffprobe and ffmpeg read and decode every frame; the counter's
rate learned on two minutes at 1.02 MHz; wraps, steps back, missing and
changed parameter sets); the source and the cache against the fake NVR (one
login shared by two cuts and the idle logout, a channel's cut replaced, the
any-channel retry, no slot, a refused login, no room, a silent device, a lost
connection, the deep start served from the cut while the download goes on,
near starts and the option off on the download, every fallback, a seek far on,
the last viewer leaving, the files at start-up); the panel's feeder switching
sources; and **Chromium appending the cut's init and two windows through the
real view with HA's auth, playing from 2 minutes in across the windows**
(H.264 and AAC need Playwright 1.57+, Chrome for Testing: the browser job now
pins 1.63.0).

**Known limits of the prototype:**

- The first key frame is placed to the second (its POSIX time is whole
  seconds): within 1 s of the download's timeline.
- Until a minute of key frames has arrived, the counter is taken at 1 MHz: up
  to 2 % off (the CX810), corrected gently afterwards. A minute of sub arrives
  in under a second, of main in a few.
- The cut needs a stream slot of its own beside the download's: on the RLN36
  (7 slots) with six cameras live or kept warm, a deep start falls back.
- The recording is still downloaded whole, from the start: the NVR sends the
  part from the moment twice. (v0.36.0's HD cut ran to the recording's end:
  1.9 GB beside the download's 1.9 GB for one HD switch. v0.36.1 cuts HD in
  3-minute spans ahead of the viewer and hands over to the download once it
  has the rest.)
- The muxing runs in Home Assistant's event loop at the link's speed: an HD
  main cut is about 20 MB/s of parsing on the HA host.
- Two viewers starting far apart in recordings of one channel replace each
  other's cut (the device tells cuts apart by channel).
- In the hour repeated when clocks fall back, the cut's local times can mean
  either hour; the device picks.

**Hardware checklist (the owner, LAN Chrome and the iPhone Companion app):**

1. Update to v0.36.0 and restart Home Assistant. Leave the option off first.
2. **Option off, Phase 2 unchanged:** on a camera with a long recording, run
   the playback check (sub; HD ticked on Chrome) on LAN Chrome. Every row
   should read as before: D1's line says "from the recording's download", the
   D1 report says "Reolink protocol: off (the option is not set)", no
   "Reolink protocol cut" anywhere.
3. Turn the option on (Configure → tick → Submit). Close live view on the
   board (or turn off "keep live view warm"), so the NVR has stream slots.
4. **Uncached deep start, sub (Chrome):** run the playback check on a camera
   whose long recordings were not played lately (D1 needs one not cached).
   D1 should read "from the Reolink protocol cut" with a first frame of about
   1 s; its report line "Reolink protocol cut: first fragment … ms, … login
   (an extra user)" and "Reolink protocol: 1 host(s) logged in now". The
   summary: "not cached … ms from the Reolink protocol cut".
5. **Seeks and speeds after it:** right after a deep start by hand (click on
   the timeline 45+ min into an uncached hour), change speed 0.5×, 2×, 4×, 8×,
   pause and resume, click a little further on, then click back before the
   start point. Each should play; Details' player line should say "from
   Reolink protocol cut", then "from download (1 source switches)" after the
   click back.
6. **HD main (Chrome):** switch to HD and do a deep start by hand in an
   uncached main recording; it should play within a few seconds (Details:
   "Reolink protocol cut: first fragment …").
7. **iPhone Companion app on Wi-Fi:** repeat 4 (Setup "iPhone app, Wi-Fi
   (local)") and a deep start by hand. (H.265 HD does not play there in MSE,
   as before.)
8. **Logged-in users:** watch the NVR's own list of online users (in its web
   interface's user settings) before a deep start, during it and a minute
   after the last one: one more session from Home Assistant's address while
   deep starts are in use, never two, and gone within a minute. The D1 report
   line "Reolink protocol: … logged in now, … logins, … logouts" is the
   integration's own count of the same.
9. Copy the check reports (Saved reports → Copy) for Chrome sub, Chrome HD and
   the iPhone, and send them.

**Exit criteria (the owner's check, 2026-10-30, v0.36.0, LAN Chrome and the
iPhone Companion app on Wi-Fi):**

| Criterion | Result |
| --- | --- |
| Uncached deep start 45+ min into an hour-long sub recording: first frame in about 1 s (Phase 2: 6.9–13.0 s) | **Met.** 52.4 min into a 60-minute recording (Front Yard Right, the CX410): **0.51 s on Chrome, 0.60 s on the iPhone**, from the cut (its first fragment 229–304 ms after the request, the slot at once, the reply in 100–112 ms, the counter at 999,790/s as step 1 measured). With the option off, on Chrome: 9.0 s from the download (34.5 min into 51.7 min, 3.3 s of it queued for a stream slot) |
| Uncached deep start in HD main plays in a few seconds where the browser decodes it | **Met by the cut**: its first fragment 516–600 ms after the request (H.264 2560×1440 main); switching to HD on the iPhone 1.06 s. The first HD start of a day on Chrome took 8.7 s, 7.9 s of it searching the day's HD recordings (Phase 2's path, before the cut): v0.36.1 searches that list in the background when a day opens |
| Seeking and 0.5–8× after a Baichuan start (how: above) | **Met.** On Chrome by hand: every speed, pause, a jump forward and back, "fast"; on the iPhone 1–8× smooth (the 0.5× ✗ is WebKit's frame counter, as in every iPhone run since Phase 2: every frame shown) |
| NVR logged-in users never above baseline + 1, back to baseline when idle | **Met.** The integration's count: one connection at a time (9 logins and 8 logouts across the iPhone run, logged out after each idle spell). The NVR's own list of online users (v0.36.2): two admin sessions from Home Assistant (the Reolink integration's) at rest, a third from the same address during a deep start by hand, never a fourth, back to two a minute after it |
| Option off: every Phase 2 criterion unchanged | **Met** on Chrome (the D rows as before, "Reolink protocol: off") |

**What the check found besides** (fixed in v0.36.1 unless said):

- **The cut needs a free stream slot.** In one run the NVR had a single slot
  free: the download took it, the cut waited 2.2 s for it (the download's,
  once done), and the download of a small sub recording (56 MB at 200 Mbit/s)
  served the start first (3.2 s). With live view closed and keep-warm off the
  slot came at once. (5c item 1, not fixed here.)
- **An HD cut fetched the rest of the recording**: 1.9 GB beside the
  download's 1.9 GB for one HD switch, still running when the check moved on.
  **v0.36.1:** HD (main) cuts come in 3-minute spans; the next span is asked
  for once a window comes within 2 minutes of what the cut has (the muxer
  joins the spans by the frame counter, skipping what it already has); a
  window past the cut is read from the download once it has it. The login is
  held between spans, a stream slot only while one downloads.
- **The first HD start of a day waited 7.9 s** for the search of the day's HD
  recordings. **v0.36.1:** the panel searches the day's HD list in the
  background (at prefetch priority, once per camera and day) when a day opens
  on a camera whose HD plays.
- **"Fetching the HD recording … X MB of Y MB"** showed while the cut served
  the start (it is the download's progress). **v0.36.1:** "Asking the recorder
  for this moment…" while a cut is under way.
- **A popup "HD could not play"** once, after jumping around in HD; its reason
  was not shown anywhere. **v0.36.1:** Details shows the last HD failure.
- **The check's D2 row said "from the Reolink protocol cut"** for a jump
  within a recording the download served (it showed what served the first
  start). **v0.36.1:** each row names what served its own start or seek.

**v0.36.1 on the hardware (the owner, 2026-10-30, LAN Chrome, Front Yard Right):**

- **The first HD start of a day:** first frame 1101 ms, the URL 47 ms (the
  day's HD list was searched ahead), the cut's first fragment 478 ms with a new
  login (v0.36.0: 8668 ms, the URL 7879 ms).
- **HD past the first span and jumps in HD:** played through the 3-minute span
  and every jump with no pause, no "X MB of Y MB" and no fall back to SD.
- **The HD cut's size:** a deep start 55.4 min into a 60-minute main recording
  fetched 184.6 MB (139 fragments, complete at the recording's end, 4.6 min
  after the start); an event 51.1 min into 52.5 min, 61.1 MB. Both ends were
  within reach of the first span, so the span's bound itself was not seen
  (v0.36.0: 1.9 GB beside the download).
- **The check ran with the tab left on HD**, which its SD rows did not expect,
  and found two "problems" that were the check's own: D2 played in 490 ms from
  the download but "did not play" (the 2.3 GB main download was still running,
  so the start was not counted); C said it did not move on, though it had
  ("advanced", playing on the next recording 36 s in). The second also showed a
  real fault in HD: the player's item carried the HD copy's own id (its start,
  a second or so from its SD twin), which no list on the tab holds, so after
  moving on in HD the tab lost its place: no preload of the recording after,
  and none played once that one ended; a seek within the HD recording opened a
  new URL instead of seeking. **v0.36.2:** the item keeps the timeline's id;
  the check switches a tab left on HD to SD first (H checks HD) and says a
  start whose copy is still being made played but was not judged.

**v0.36.2 on the hardware (the owner, 2026-10-30, Front Yard Right):**

- **LAN Chrome, the check with HD:** "plays well on this device", no problem
  found. Events 38–508 ms; an uncached deep start 57 min into an hour 488 ms
  from the cut (its first fragment 277 ms), the same hour 25.6 min in 308 ms
  from the download (counted now: the check plays its SD rows in SD); moved on
  by itself, preloaded, a 1 ms gap; 0.5–8× smooth; HD in 0.73 s and back to SD
  in 0.16 s, both keeping the moment. **The span's bound seen:** the HD switch
  5.1 min into an hour fetched 240.3 MB (181 fragments, about six minutes:
  the first span and one extension) over the 1.6 minutes HD played, where
  v0.36.0 fetched the rest of the hour (about 2 GB).
- **The NVR's own list of online users:** two admin sessions from Home
  Assistant at rest (the Reolink integration's), a third from the same address
  during a deep start by hand, never a fourth, back to two a minute after.
- **The iPhone app on Wi-Fi:** events 203–792 ms (the first from the cut), an
  uncached deep start 589 ms from the cut, the cached one 483 ms, moved on
  with a 27 ms gap, 1–8× smooth. 0.5× is "✗" as in every iPhone run since
  Phase 2: WebKit painted 7 frames a second of 9 while dropping none of 52
  (its frame counter, not a stutter). The protocol's count: 4 logins and 3
  logouts across the run, one host logged in at a time.

**What 5c should change** (revised with the hardware results):

1. **Download once, one slot.** The check saw both costs: a deep start that
   lost to the download because the NVR had one stream slot free, and an HD
   switch that fetched 1.9 GB twice (v0.36.1's spans bound the cut's part).
   Start the HTTP download at the recording's start but stop it at the cut's
   start (or cut the part before the moment too), and let the cut take the
   download's stream slot rather than a second one, so a deep start costs the
   NVR one stream and the bytes once. The cut's file then
   becomes part of the recording's cache (a recording in two or more pieces),
   which the fragment index and eviction learn.
2. **Per-host method** in the hardware matrix and the options: the cut for the
   NVR (and cameras that answer 143), the download elsewhere; on by default if
   the owner's check passes.
3. **The clock from the first second:** keep each camera's counter rate (it is
   stable) in the media store, and place the first key frame finer than a
   second from the counter's phase across several key frames.
4. **The HA host's load:** measure an HD main cut's CPU on the owner's host;
   move the block parsing and muxing to the executor if it shows.
5. **One cut per channel per viewer:** queue or refuse a second far cut on a
   channel rather than replacing the first viewer's.
6. **5d, upstream:** propose 143/144 and the media message class to
   reolink-aio, so the client here can shrink to a caller of it.

### 5c: integrate (started 2026-10-30)

Goal: deep starts over the Reolink protocol become the normal path where the
device supports them: one stream and the bytes once per start, on by default,
the item list above in order. Steps, each released and checked on the
hardware before the next:

| 5c step | Status |
| --- | --- |
| 1. One stream, the bytes once | **Done** (v0.37.0–v0.37.1, below): the owner's check passed (2026-10-31) |
| 2. The method per host, on by default | **Done** (v0.38.0, below): the owner's check passed (2026-11-01) |
| 3. The clock from the first second | **Done** (v0.39.0–v0.39.1, below): the rate kept per camera ("stored" on the hardware); the device's zone fixed (reolink-aio's DST rules); the alignment measured at 38–362 ms, a finer anchor not built |
| 4. The HA host's load | **Done** (v0.39.0's check): the muxer takes 144–182 ms for a sub cut of 15–19 MB and 422–452 ms for an HD span of 124 MB, spread over its seconds of download in a block's worth at a time: it stays on the loop |
| 5. One cut per channel per viewer | **Done** (v0.40.0, below): the owner's check passed (2026-11-02) |

#### Step 1: one stream, the bytes once (v0.37.0)

- **The download stops where the cut begins.** A recording a cut serves is
  fetched in two pieces: the download from its start up to the cut's first
  fragment, then stops (`Entry.stopped_ms`); the cut has the rest (SD to the
  recording's end, HD in spans as it is watched). A window past the
  download's last fragment reads the cut on from there (the MSE feeder
  already switches sources). A sub start 57 min into an hour no longer
  fetches the last 3 minutes twice; an HD start 5 min in no longer downloads
  the other 55 minutes (about 2 GB) beside the spans.
- **Whatever needs the whole original resumes it:** the file player, a clip,
  the plain MP4, a window neither piece holds (the cut failed, was stopped,
  or ends before it). The device ignores HTTP Range, so the download reads
  the recording from its start again and skips the bytes on disk (the index
  room and offset shifting give the same bytes again); it then runs to the
  end (`Entry.whole`).
- **The cut takes its download's stream slot when none is free.** With none
  free at once, the cut (queued first) asks for its recording's download's
  (`Cut.borrow`): a download holding a slot closes its response (also while
  it waits on the device) and queues behind the cut, resuming the same way
  once a slot is free; one still waiting lets the cut go first
  (`StreamTicket.defer`). So a deep start costs the device one stream: the
  run where the NVR had a single slot free (the cut waited 2.2 s for it and
  the download served the start in 3.2 s) should start from the cut.
- A stopped original's part counts with its recording for eviction (it goes
  with the cut); both are one run's, cleared at setup.
- **Shown:** Details' cache line "copied to 57.0 min (… MB) · Reolink protocol
  cut: …"; the check's fill line "stopped at 57.0 min (the cut has the rest)",
  "gave its slot to the cut 1×", and the cut's "slot … ms (the download's)".

**Hardware checklist (the owner, LAN Chrome; the iPhone app for 4):**

1. Update to v0.37.0 (the option stays on). Run the playback check with HD
   ticked, as for v0.36.2. D1 should read as before (about 0.5 s from the
   cut), and its fill line end "stopped at … (the cut has the rest)" with the
   bytes about the share of the recording before the start (D1 starts 75–95 %
   in, so most of the hour); D2 "Cached" from the download. H: the HD switch's
   fill line "stopped at …", a few hundred MB at most, not a growing 1–2 GB.
2. **One slot:** keep live view open on the board (or "keep live view warm"
   on) so the NVR has few streams free, and do a deep start by hand in an hour
   not played today. Details should show "Reolink protocol cut: first
   fragment … ms" in about a second; if the check runs, the cut's line says
   "slot … ms (the download's)" when it had to take it.
3. **The whole when needed:** after a deep start, press **Download clip** for
   that recording: it should download whole (the copy resumes and completes);
   Details then reads "cached".
4. On the iPhone app, a deep start and a jump back before it play as before.

**Exit criteria:** a deep start fetches no recording twice (the fill line
stops at the cut) and costs the device one stream (a start with one slot
free plays from the cut in about a second); every v0.36.2 row unchanged.

**The owner's check (2026-10-31, v0.37.0, LAN Chrome with HD and the iPhone
app): met.**

| | Result |
| --- | --- |
| The bytes once | Every fill line stopped at its cut: an event 39.3 min into a 39.6 min recording copied to 39.2 min (166 MB) with a 2.0 MB cut; D1, 56.9 min into an hour, copied to 57.0 min (224 MB) with a 13.7 MB cut; the HD switch 5.1 min in copied to 5.1 min (202 MB) with the cut's spans (240 MB): about 440 MB where v0.36.2 fetched the spans and the whole hour (about 2.5 GB) |
| Starts | D1 433 ms from the cut (its first fragment 249 ms); D2 83 ms from the part copied; events 36–584 ms; moved on with a 9 ms gap; 0.5–8× smooth; HD in 0.76 s and back in 0.17 s, both keeping the moment |
| One stream | With the live board open (few streams free), a deep start by hand was "responsive" |
| The whole when needed | Download clip after a deep start: the download began after 4 to 8 s (the copy read again from its start, then completed) |
| iPhone | A start at the end of an hour, then back before it: "very fast" |

One row failed: the check's link test timed out ("signal is aborted"), as it
read the clip of a recording copied in two pieces, which waits for the rest of
the copy. v0.37.1 reads the player's fragments instead (check v0.4.3).

#### Step 2: the method per host, on by default (v0.38.0)

- **On by default** (`DEFAULT_BAICHUAN_DEEP_START`): new installs, and installs
  whose options never set it, use deep starts over the Reolink protocol; the
  option turns them off. The owner's checks of 5b and step 1 are the case for it.
- **The method per host, found out rather than listed:** a device that refuses
  the protocol (its port closed: "connection refused"; the login or the
  download cut refused; no nonce) before any cut of it came through is left
  alone for `UNSUPPORTED_RETRY_S` (6 h): its starts get "not supported by this
  device (…)" at once, without a login, and wait for the download as with the
  option off. A device that has served a cut is never left alone for a later
  refusal (that refusal is the cut's: a channel, a time range), and timeouts, a
  lost connection or no free slot never count. The hardware matrix needs no
  per-model list: run 2 showed the NVR, the Duo 3, the CX410 and the CX810
  all take 143 (the NVR answering for its channels), and a camera that does
  not is found at its first deep start.
- **Shown:** Details' cache line "Reolink protocol cut not used: not supported
  by this device (…)"; the check's D1 report "…; not supported by N device(s):
  …"; Home Assistant's log says once when a device is left alone, and why.

**Hardware checklist (the owner):**

1. Update to v0.38.0. In the options, the setting shows ticked (it was already
   on here). A deep start plays from the cut as in step 1.
2. Untick it, Submit: a deep start waits for the download (Details: no cut).
   Tick it again.
3. Optional, to see a device left alone: none of the owner's devices refuses
   the protocol, so this is covered by the tests (a closed port, a refused
   login); nothing to do on the hardware.

**Exit criteria:** on by default without a step by the owner; a device that
refuses the protocol costs one try per 6 h, then its starts are the download's
at once.

**The owner's check (2026-11-01, v0.38.0): met.** The setting showed ticked
after the update; a deep start came from the cut ("first fragment 426 ms, new
login"); unticked, a deep start waited for the download, and ticked again it
came from the cut; dragging the timeline was smooth.

#### Step 3: the clock from the first second (v0.39.0), and step 4's measure

The plan was to keep each camera's counter rate and to place the first key
frame finer than its whole POSIX second. Building it showed the second part
would do harm: **the recording's start is a whole second too**, so where a
recording starts on a key frame and key frames come whole seconds apart (the
owner's cameras), the cut's and the original's truncations cancel and the
first key frame already sits where the original has it; placing it mid-second
would add half a second (the muxer's tests, whose streams are built that way,
failed at once). So step 3 keeps what is right and measures what is left:

- **The rate kept per camera** (`BaichuanSource`, an HA store,
  `reolink_viewer.baichuan_rates`, by entry and channel): a rate a cut learned
  over at least `KEEP_RATE_SPAN_S` (300 s) is given to the muxer of the
  camera's next cut, which places its frames on it from the first one
  (`rate_source` "stored") and relearns only over `STORED_RATE_SPAN_S`
  (600 s: whole seconds make a minute's estimate good to about 2 %, ten
  minutes' to 0.2 %). Until a camera's first long cut, the minute's estimate
  as before.
- **The alignment measured where the two pieces meet:** when the download
  stops at the cut, the original's key frame nearest the cut's first one is
  the same picture (if less than a second apart), and the difference is
  recorded (`cut_offset_ms`): the check's fill line "cut +N ms from the copy".
- **Step 4's measure:** the time the muxer takes per cut (`mux_ms`, on HA's
  event loop), in the check's cut line. Moved to the executor only if it shows
  (an HD span of 3 minutes is about 240 MB).

**Hardware checklist (the owner, LAN Chrome):** run the playback check with HD,
twice, a few minutes apart (the second run's cuts use the rates the first kept,
where the first measured five minutes or more). Send both reports: the D1 and H
fill lines' "cut … ms from the copy", and the cut lines' "counter …/s
(learned|stored)" and "mux … ms".

**Exit criteria:** the cut within a frame or two of the copy where they meet
(about 70–130 ms on these cameras), else a finer anchor is worth building; the
muxer's time small beside the cut's own (an HD span's), else step 4 moves it.

**The owner's check (2026-11-01, v0.39.0, two runs with HD):** every row as
before (deep starts 360 and 442 ms from the cut, cached 101 and 94 ms, HD in
0.56 and 0.72 s). Three findings:

- **Every cut was "placed by asked time"**, the fallback for a key frame more
  than 30 s from the moment asked, where every check since 5b read "key frame
  time". The day was 1 November 2026, when US DST ended, and the device's zone
  (reolink-aio's `Reolink_timezone`, built from GetTime) put the end on
  **8 November**: its rule arithmetic adds the day difference where it should
  subtract it, and its week count starts a week late when the month begins on
  the weekday, so most years land DST's start and end on the wrong day (in
  2025 on a Friday, 31 October). From 1 to 8 November every local time this
  integration converted was an hour off: the timeline an hour early (the
  hour's recording, 13:00 to 13:39, shown at 12:00), its starts consistent
  with it (the same zone both ways), and the cuts' key frames an hour from the
  asked moment. **v0.39.1** builds the zone from the same GetTime answer
  (`timeconv.DeviceTimezone`, `bridge.timezone()`): week 1 to 4 that
  occurrence of the weekday, 5 the last; checked against the tz database for
  New York, Berlin and Sydney, every half hour of 2020 to 2030, both ways.
  reolink-aio's zone remains the fallback. Reported upstream as
  [starkillerOG/reolink_aio#239](https://github.com/starkillerOG/reolink_aio/issues/239) (5d).
- **So the offsets measured (−313, −256, +663 ms) say nothing**: anchored at the
  asked moment, a cut's first key frame lands anywhere in its group of
  pictures. The alignment is measured again on v0.39.1.
- **No rate was kept**: the cuts measured about 3.5 minutes (sub) and 3 minutes
  (HD), short of the 5 asked for, so the second run's read "learned" again (at
  999,790/s both times: the whole seconds cancel on these cameras). v0.39.1
  keeps a rate measured over 2 minutes.
- **Step 4: no move needed** (the table above).

**v0.39.1 on the hardware (the owner, 2026-11-01, Chrome over Nabu Casa, two
runs):** the timeline at the right time again, and **every cut "placed by key
frame time"**. The rate kept: the first run's deep start learned 1,001,100/s and
the second run's first cut of the camera began on it ("stored"), as did its
HD switch on 999,790/s. Where the copy and the cut meet, the same key frame
sat **+252, −362, +324, −343 and +38 ms** apart: the whole seconds do not cancel
on these cameras (the recording's first frame and the key frame each sit
somewhere in their second, and nothing the device sends says where). It shows
only where playback crosses from the copy into the cut (a jump back before a
deep start, played on to it): a skip or repeat of up to 0.4 s. A finer anchor
is not built: the overlap that would measure it exists only after the deep
start has played; if ever wanted, the cut's later windows could be shifted by
the offset once measured. The muxer: 412–434 ms for a sub cut of 41–44 MB,
798 ms for 212 MB of HD, as before. Over Nabu Casa deep starts showed their
first frame in 0.73–0.86 s.

#### Step 5: one cut per channel per viewer (v0.40.0)

Two viewers of one camera deep in its recordings (a phone in SD and a desktop
in HD, or two hours) each had a cut; the device tells streams apart by
channel, so a second cut on a channel stopped the first, and a second viewer's
far seek in the same recording replaced the cut the first was reading (its
windows refused as "replaced").

- **Cuts of a channel take turns** (`BaichuanSource._turn`): one downloads at
  a time and none stops another. A new cut that must wait (for the channel, or
  for a stream slot) asks the channel's current cut to give way, which it does
  at the next block once it has its first fragment: what it muxed is written,
  its span ends (144) and it joins on later by the counter, as HD spans do
  (`Cut.gave_way`). A viewer plays far ahead of what it watches, so the pause
  goes unseen. Only a cut's first span asks: one resuming, or a later span,
  waits its turn (two cuts would otherwise take turns block by block).
- **A replaced cut is kept while read** (`Entry.old_cuts`, by generation): a
  far seek's new cut no longer takes the first viewer's away; a window of the
  old one is still served by its own number, and it goes once unread for
  `OLD_CUT_KEEP_S` (30 s), at the next decision, or when the last viewer
  leaves.
- **Shown:** the check's cut line "gave way to another viewer N×".

**Hardware checklist (the owner, two devices at once, e.g. the desktop and the
iPhone app on the same camera):** start deep in one hour on the first device;
while it plays, start deep in another hour (or in HD) on the second. Both should
start in about a second and play on; the first keeps playing through. Then on
the second device jump far in the first device's recording while the first plays
it: the first plays on.

**Exit criteria:** a second viewer's deep start on a camera starts from its cut
in about a second without stopping the first viewer's playback.

**The owner's check (2026-11-02, v0.40.0, Chrome and Edge on one computer over
Nabu Casa, SD): met.** A deep start in one browser, then one in another hour in
the other while the first played, then a jump far into the first's recording
from the second: "no delays or stuttering".

**5c is done.** 5d (upstream) is next: the reolink-aio time zone fix (its DST
rules), then 143/144 and the media message class.

**Learned:** the 4 to 8 s before a clip of such a recording downloads is the
price of a device that ignores Range; a clip is rare and the wait is said in
the user guide. If it matters, 5c could fetch the rest in the background once
the viewer leaves (one stream, at prefetch priority), so a later clip finds
the copy whole.

### 5d: upstream (started 2026-11-02)

Goal: what this phase found in reolink-aio, and what it built that reolink-aio
could own, goes to reolink-aio, so HA itself benefits and the code here can
shrink. Nothing is posted without the owner's go-ahead; the owner posts under
their own account. Reports, in order:

| # | Report | Status |
|---|---|---|
| 1 | `Reolink_timezone` lands DST start and end on the wrong days | **Posted** (2026-11-02): [starkillerOG/reolink_aio#239](https://github.com/starkillerOG/reolink_aio/issues/239), with a repro against the tz database for 2024–2030 and a suggested fix |
| 2 | The download cut (143) and its end (144), and the media message class | **Posted** (2026-11-02): [starkillerOG/reolink_aio#240](https://github.com/starkillerOG/reolink_aio/issues/240), with the exchange, the six streams' measurements, what the blocks hold and the parser's rejected class (`e26a`); offered as notes for the maintainer's own playback work, with an offer to test a branch |

When #239 is fixed and HA ships that reolink-aio, `timeconv.DeviceTimezone`
can go and `bridge.timezone()` can use `api.timezone()` again (keep the
tz-database tests to check it).

**Both reports are posted (2026-11-02).** What follows depends on the
maintainer: answer questions on #239 and #240, and test a branch on the RLN36
if one is offered. If reolink-aio comes to receive the media class and offers
a cut (or replay) API, `baichuan_client.py` can shrink to a caller of it
through `bridge.py`, and the parts of `baichuan_source.py` it duplicates can
go. Nothing else in 5d is ours to do.

### The review of 5b and 5c (v0.40.1)

A review of the 5b/5c code found six faults. v0.40.1, a patch release, fixes
them; each fix began as a test against the fake NVR (`tests/test_baichuan_*.py`)
that failed before it.

| # | Finding | Fix |
|---|---|---|
| 1 | **High: an abandoned HD cut held the login for good.** Between spans a cut waited for the next one with no limit (`Cut.wait_for_more`), only a release ended it, and an expired lease was forgotten without stopping it. A tab closed, the app killed or the network gone sends no release: the paused cut, its task and its file descriptor stayed, its recording stayed reserved against eviction, and `host.users` stayed above 0, so the host's idle logout never ran again until restart | A paused cut no window was read from for `PAUSE_IDLE_S` (25 s) ends (`timing.ended` "unread"), and the host logs out `IDLE_LOGOUT_S` (30 s) later. A recording's last lease ending, released or expired (a timer per lease), stops its cuts. A viewer that comes back past an ended cut's fragments is served by a new cut from there, or by the download (`_handover_ms`); a start inside them still reads them |
| 2 | **Medium: a failed HTTP fill orphaned its running cut**, and the next entry, numbering its cuts from 1 again, truncated `<id>.1.cut.mp4` while the old cut still wrote it | A fill that fails stops and deletes its recording's cuts (`_drop_cuts`); the next entry keeps the failed one's cut count (a window of an old cut is never served from another), and no cut takes a file a running cut writes (`_cut_paths`) |
| 3 | **Medium: device input could kill the read loop without marking the connection lost.** A bad SPS (a crop giving a negative or over-65,535 width) raised `struct.error` in the muxer, which runs in the client's block callback; OSErrors such as ETIMEDOUT and EHOSTUNREACH escaped the loop too. The next deep start reused the dead client and waited 6 s before falling back | The muxer refuses a picture size outside 1–65,535 (`MuxError`); any error of the muxer fails only its cut (`_Feed.block`), which falls back to the download; the read loop marks the connection lost and fails its waiting requests however it ends |
| 4 | **Medium-low: a second cancel during a cut's clean-up** (while the file was closed in the executor) skipped the release, the bookkeeping and the notify: a pinned login, and a window waiting on the cut with no deadline | The release and the bookkeeping come before any await; closing the file and waking the waiters run shielded (`BaichuanSource._close`) |
| 5 | **Low: a 144 answered late removed the next span's stream.** The cut waits 3 s for it, but the request ran on for up to 10 s and then dropped whatever stream was registered on the channel; and its failure was logged as "exception in shielded future" | `download_end` lets go of the stream it ended only; the abandoned 144 keeps its failure to itself (`_end_download`) |
| 6 | **Low: a cut that gave way could wait for the other cut's whole download.** A sub cut is one span to the recording's end and gave way once the holder had a fragment: an hour of sub kept the other viewer waiting about 20 s with 1–4 s buffered | A cut that waits for the channel (one that gave way, or a later span) asks for the turn back once the holder's turn has lasted `TURN_S` (1 s) and brought a fragment; a new viewer still gets it at the holder's next block. Turns alternate in bounded spans, within the viewers' buffers, sub or HD |

**Also checked, finding 6's traced-only case:** an HD span that found no free
slot borrowed the download's, and the download, queued behind it, read the
recording from byte 0 again after every span (the device ignores Range). A
test reproduced it (two yields for two spans). Now only a cut's first span
makes the download yield and go on after it; a later span's viewer is minutes
ahead, so the download stops where it is (`Entry.halting`, `stopped_ms`) and
is resumed only when something needs the part it lacks. A download that is
wanted whole (a clip, the file player) keeps its slot.

**Minor:** the probe's Reolink protocol check logs in on a connection of its
own for each measurement (its login is part of what it measures), beside the
deep starts' connection if one is open. The report says so (`connection`), and
so does the option's label.

**Hardware checklist (the owner, v0.40.1):**

1. **A tab closed during an HD deep start.** Open the NVR's web interface at
   its list of online users and note the count at rest (two admin sessions
   from Home Assistant in 5b). In Chrome, on the Playback tab, switch a camera
   to HD and start deep in an hour not played today; while it plays (Details:
   "Reolink protocol cut: first fragment …") the list shows one more session
   from Home Assistant's address. Close the tab. Within a minute (at most
   about 55 s: 25 s unread, then the 30 s idle logout) the list should be back
   at the count at rest. In v0.40.0 the extra session stayed until Home
   Assistant restarted.
2. **Two viewers taking turns on one camera.** On two browsers or devices (as
   for 5c step 5), start deep in one hour in SD on the first; while it plays,
   start deep in another hour of the same camera on the second. Both should
   show their first picture in about a second and play on without a stall;
   then, on the second, jump far into the first one's recording: the first
   plays on. The check's cut line ("gave way to another viewer N×") may now
   count several turns.

**Exit criteria:** the online users back at the count at rest within a
minute of closing the tab; both viewers play through without a stall.

**The owner's check:** not run yet. Once it passes, Phase 5 is done; what is
left of 5d waits on the maintainer
([#239](https://github.com/starkillerOG/reolink_aio/issues/239),
[#240](https://github.com/starkillerOG/reolink_aio/issues/240)).

---

## Phases 6–13: the second round (planned 2026-11-02)

After using Phases 0–5 day to day, the owner asked for:

- live scrubbing, as UniFi Protect and Nest have it;
- a Live page like the NVR's HDMI monitor;
- the Doorbell on the Events page;
- faster, more reliable camera feeds on a wall tablet's dashboard;
- whatever is worth taking from two other Reolink projects, Reolink Stamina
  and reostream.

The evaluation, with its evidence, is in [PLAN.md §6](PLAN.md#6-second-round-evaluation-2026-11-02).
These phases build it. The re-review before planning found these already done:

- reolink-aio's DST rules (v0.39.1, reported as reolink_aio#239);
- fast uncached deep starts (Phase 5);
- a whole-recording "Download clip".

### Order

Recommended, the owner's to change:

1. **Phase 6, the Doorbell's events.** It is small, and a camera that records
   is missing from the Events page.
2. **Phase 7, the dashboard card.** The wall tablet is slow every day, and the
   card reuses the panel's live tile.
3. **Phase 8, step 1 (the detection journal), as early as possible.** Unusual
   marks need a week of history before they show anything, so the journal
   should collect while the other phases are built. Steps 8.2–8.4 follow
   whenever convenient.
4. **Phase 9, the Wall.** Its step 9.4 shows Phase 8's marks if Phase 8 is
   built, and its step 9.5 needs Phase 7's card.
5. **Phase 10, scrubbing.** This is the largest risk. It builds on Phase 5's
   download cut and its turns per channel.
6. **Phase 11**, at any time; its steps are independent.
7. **Phases 12 and 13 are optional and gated.** Each starts with a
   measurement that decides whether it goes on.
8. **Phase 14 is TBD** (decision 7): a sketch, to be planned if the owner
   picks it up.

Before Phase 6, two records are still open from the first round: Phase 5's
v0.40.1 hardware check (this plan still says "not run yet"), and Phase 4's
exit item (an install through HACS on a clean Home Assistant).

### Decisions for the owner

The owner answered all of these on 2026-11-02.

| # | Decision | The owner's answer | Needed by |
| --- | --- | --- | --- |
| 1 | The monitor: replace the home view's timetable, or a switch | **A switch** on the Live view between the board, as today, and **the Wall** (feeds only, like the NVR's HDMI monitor), remembered per device. The owner chose the name "Wall" from Wall, Monitor, Lookout and Signal box | 9.1 |
| 2 | Saved Wall layouts: per Home Assistant user, or per screen | **Named layouts per HA user**, kept on the server; each device remembers which one it shows | 9.1 |
| 3 | The wall tablet | **A Samsung Galaxy Tab A9+ running Fully Kiosk Browser**, which draws pages with Android System WebView (Chromium). Its HA login (admin or not) is not known; the card works with either (Phase 7) | 7 |
| 4 | Unusual events: port Stamina's model (MIT, credited) or write our own | **Port it**, adapted to our types, with its copyright notice and its tests | 8.2 |
| 5 | Unusual events on by default | **Off**: an option to turn on, since the journal is a record of when people come and go | 8.1 |
| 6 | Running reostream as a separate service | **No**: Doorbell talk goes through our own UDP client (Phase 12), and Phase 13.2 is built only if 13.1 finds corruption | 12, 13 |
| 7 | Copies of detection clips on a NAS or cloud | **TBD**: the owner may want it built here later. Sketched as Phase 14, not scheduled; Stamina does it meanwhile and can run beside Reolink Viewer | — |

### Rules for Phases 6–13

- **The six cross-cutting rules hold.** In particular:
  - The Doorbell's searches and the UDP client get the host's address,
    credentials and time zone from `bridge.py`, and run through the scheduler.
  - An outside live source's URL is stored in the options and given only to
    go2rtc, never to the browser.
  - Copying settings goes through HA actions.
- **Licences.**
  - No AGPL-3.0 code (neolink, reostream). Such projects may only run beside
    us as separate processes; their documents serve as facts; protocol work
    comes from our own captures.
  - MIT code (Stamina, reolink-aio) may be ported with its copyright notice
    kept, listed in a new `THIRD_PARTY.md` at the root (created with the first port).
- **Released and checked step by step**, as in Phase 5: each step is a
  release, with a hardware checklist the owner runs before the next step. The
  definition of done below applies to every phase.
- **New views keep Phase 4's standards:**
  - the performance budget (CI);
  - WCAG 2.1 AA and keyboard use (axe in CI);
  - reduced motion;
  - every message in the troubleshooting guide (its word-for-word test);
  - the design contract, with screenshots in the preview harness.

---

## Phase 6 — The Doorbell's events (difficulty: Standard / High, 0.5–1 wk)

Goal: a camera that records but cannot be played here lists its events with
the other cameras: on the home view, in the Events view and in the calendar,
with thumbnails. When its recording cannot be played, the panel says so in
plain words. The camera in question today is the Doorbell: Baichuan only,
recording to its SD card, with no replay support.

**Today:** `events.py` (`async_recent`, `async_days`) reads only
`devices.async_playback_sources`. A playback source needs `records_locally`,
and that needs replay support (`bridge.py`, `devices._mark_playback_source`).
The day search runs reolink-aio's `request_vod_files`, whose HTTP Search a
Baichuan-only device does not have. `stores_recordings` (v0.12.1) already
knows that the Doorbell records.

| Step | Status |
| --- | --- |
| 1. Probe the Doorbell's searches | **Done** (2026-11-02, v0.41.0–v0.41.1, below). Run 1 stopped at the Doorbell's clock (no HTTP GetTime on a Baichuan-only device); v0.41.1 reads it over Baichuan (104). Run 2: the event search works (677 events in two days, yesterday's in 13–16 s), the day search too, its zone is Home Assistant's; pictures fail on a `1002` header reolink-aio refuses |
| 2. Event sources beside playback sources | **Done** (2026-11-02, v0.42.0, below). The owner's check (v0.43.0): the Doorbell's events show, and a press of the doorbell is a "Doorbell" event at the time it was pressed: the Doorbell's own search tags the recording a press starts `visitor` |
| 3. Opening an event that cannot play | **Done** (2026-11-02, v0.43.0, below): the Doorbell's pictures read here (its `1002` header), and its Playback tab shows its events as pictures. The owner's check: its events open as pictures |
| 4. Fallback: events from HA's detection sensors | **Not needed** (2026-11-02). The owner's rule: built only if a doorbell press were missing from the Doorbell's own search. It is not: a press shows as a "Doorbell" event at the right time |

**Phase 6 closed** (2026-11-02) on the owner's press check, as the owner
decided. The Doorbell's events show on the home view, the Events page and the
calendar, at the right times, presses included, and open as pictures. Not
compared against the Reolink app event by event: its counts and kinds, and how
often a picture is missing. Those would surface in daily use, and are no
reason to hold the phase.

#### Step 6.1: probe the Doorbell's searches

A read-only section in the hardware probe, opt-in as battery cameras are:

- `search_vod_days` (142) for this month;
- `search_vod_type` (272–274) for today and yesterday, sub and main;
- `snapshot_past` (298) at three of the events found.

It records each call's time, the counts and types found, and any error. The
Doorbell is on wired power, so this costs it no battery.

**Gate:** the event search answers → step 2. Thumbnails answer → they go into
steps 2–3. Neither → step 4.

**As built (v0.41.0):**

- **The search 6.2 will use:** `bridge.async_search_day_events`, the Baichuan
  event search alone, with the day search's one retry after a pause. It never
  asks for the HTTP Search, which a Baichuan-only device does not have, and a
  failure raises.
- **The check:** `probe_events.py`, an opt-in section of the probe ("Test the
  events of cameras that record where Reolink Viewer cannot play it", with
  "Only this test" on by default). Its report is the host's `events` key.
  - **Targets:** channels that `stores_recordings` but not `records_locally`;
    an NVR's channels play, and a camera without storage records nothing.
  - **Battery:** a battery camera on wired power is checked without "Include
    battery cameras", since it never sleeps; one on its battery needs the tick.
    Offline and sleeping cameras are skipped.
  - **What it asks, each a scheduler job at prefetch priority:**
    - the device's time;
    - the day search for this month (`async_recording_days`: 142, with
      reolink-aio's own fallback);
    - the event search for today and yesterday, sub and main;
    - `snapshot_past` 2 s into the three newest of the day's sub events.
  - **What it records:**
    - per search: its time, the number of events and recordings, the types
      counted, and the events' lengths (min, median, max);
    - per picture: its time and size, and whether it is a JPEG;
    - per channel: `gate`, whether the event search, the day search and the
      thumbnails answered (thumbnails `null` when no event was found to sample),
      and `events_found`, the events of all four searches, since a search that
      answers but finds nothing proves nothing.
  - **Never an event's time of day.** Those say when someone came to the door,
    and the file may be attached to a report.

**Hardware checklist (the owner):**

1. Update to v0.41.0. As an administrator, open **Devices → Hardware probe**.
   Tick only the new test, "Test the events of cameras that record where
   Reolink Viewer cannot play it". Its "Only this test" stays ticked. "Include
   battery cameras" is not needed while the Doorbell is plugged in.
2. **Run probe**, then **Copy JSON** (or attach the downloaded file).
3. Before running, note roughly how many events the Reolink app lists for the
   Doorbell today, and of which kinds (person, doorbell press, motion), to
   compare with the file's counts.

**Exit criterion (the gate):** the Doorbell's `gate` in the file.

- **`event_search` true, and `events_found` matching the Reolink app** (the
  same days): step 2 follows.
- **`events_found` 0 while the app lists events:** the search answers but sees
  nothing, so it counts as a failure.
- **`thumbnails` true:** thumbnails go into steps 2–3.
- **The event search fails:** its error decides step 4.

**Run 1 (the owner, 2026-11-02, v0.41.0): stopped before any search.**

- **Targets were found correctly.** Only the Doorbell (host5) was a target. Its
  storage read "ready", and it was checked without the battery tick because it
  is on wired power. The NVR's channels and the other direct cameras were "no
  camera here records where Reolink Viewer cannot play it".
- **The check failed at the device's time:** "cannot read device time:
  NotSupportedError: get_time: failed to retrieve current time settings".
  - A Baichuan-only device answers no HTTP GetTime, and reolink-aio maps no
    Baichuan command to it, so it holds no time settings for the Doorbell.
  - The check needed the time to set its search windows, and returned at once,
    so neither searches nor pictures were tried.
- **It also means the Doorbell has no time zone here:** `bridge.timezone()` is
  built from those same settings. Step 2 converts the Doorbell's wall-clock
  event times to UTC, so it needs a zone from somewhere else.

**v0.41.1: the clock from the device itself.**

- **`bridge.async_baichuan_clock`:** Baichuan's time query (104), sent alone.
  It returns the device's wall clock, its `timeZone` field (seconds west of UTC,
  as GetTime counts it) and the names of every field in the answer.
  - reolink-aio sends 104 only inside `synchronize_time`, which also sets the
    time (105); here, nothing is set.
  - It is guarded: a reolink-aio without `send` makes it not applicable, rather
    than adding to the compatibility check.
- **The check's clock, in order:**
  1. the device's time as reolink-aio reads it;
  2. else 104;
  3. else Home Assistant's own clock.
- **The report's `clock`** says:
  - which source was used, and the error of each source that failed;
  - whether a zone is known;
  - Home Assistant's UTC offset;
  - for 104: its `time_zone`, its field names, and how far its wall clock is
    ahead of Home Assistant's.

  With these, step 2 can choose the Doorbell's zone:
  - 104's offset, with DST rules if its fields carry them;
  - or Home Assistant's zone, when the two clocks agree to within seconds.

**Run 2 (the owner, 2026-11-02, v0.41.1, 00:34 at the Doorbell): the gate
passes for the events, not yet for the pictures.**

| | Result |
| --- | --- |
| Clock | Its own clock over Baichuan (104) answered in 185 ms; HTTP GetTime failed as in run 1. Its zone field is 18000 (seconds west: UTC-5) against Home Assistant's -18000; its wall clock is 11 s behind Home Assistant's; it carries an `isDst` field, but no DST rules |
| Day search | 381 ms: 2 days with recordings this month (1 and 2 November), today among them |
| Event search | Today (34 minutes old): 0 events, 1.2–1.5 s. **Yesterday: 319 events in 119 recordings on sub (MOTION 246, VEHICLE 180, PERSON 91, ANIMAL 6), 358 on main, in 13.3 and 16.3 s.** Lengths 6–229 s, median 21 s. No doorbell press (reolink-aio's `visitor` → DOORBELL) |
| Pictures | None of 3: one 400 from the device, two answers whose stream header is `1002` where reolink-aio's `snapshot_past` accepts only `1001`. Phase 5's own media reader (`baichuan_media.py`) takes any `100x` header, as the 5a capture saw both |
| Gate | `event_search` true, `events_found` 677, `day_search` true, `thumbnails` false |

**What it decides:**

- **Step 2 follows.** The search sees real events of every kind the Doorbell
  detects. The owner's comparison with the Reolink app moves to step 2's
  hardware check, on the Events page itself.
- **The Doorbell's zone is Home Assistant's.** Its clock reads Home Assistant's
  local time, and its zone field matches Home Assistant's offset, so
  `bridge.timezone()` gives a Baichuan-only device Home Assistant's zone, with
  its DST history.
- **Searching a whole past day takes 13–16 s over the Doorbell's UDP.** The
  timeline's caching does the rest: past days are kept for good, today is
  refreshed in short windows, and the warm-up fetches recent past days in the
  background.
- **Pictures go to step 3.** The 298 answer can be read with our own media
  reader where reolink-aio's refuses `1002`, then decoded to JPEG as
  reolink-aio does. The 400 is to be understood there, and reolink-aio's
  refusal reported upstream (5d style, by the owner).
- **No doorbell press yesterday.** Whether a press is a `visitor` record in the
  search is to be checked on the hardware: press it, then look for a "Doorbell"
  row.

#### Step 6.2: event sources beside playback sources

- `bridge.py`: an events-only day search for Baichuan-only channels.
  - `search_vod_type` gives the events, `search_vod_days` the days, and no
    HTTP is involved.
  - It is used for any channel that `stores_recordings` but not
    `records_locally`.
- `devices.async_event_sources`: every playback source, plus those channels
  marked not playable.
  - The timeline service keeps their days like the others' (past days kept
    for good, today refreshed), as days with events and no recordings bar.
  - `events/recent`, `events/days` and the Events view's camera filter use
    them.
- **Never wake a battery camera:**
  - a camera on battery, not wired, is searched only when someone opens its
    day, never in the background refresh;
  - the wired-power read is v0.12.0's.
- The Doorbell's host keeps its own scheduler limit; searches run at playback
  priority when asked for, prefetch priority in the background.

**As built (v0.42.0).** Backend only: the Events view already numbers its
cameras from the live board, which has the Doorbell; a row without a thumbnail
is shown as it is; and a row opens the camera's Playback tab, which for the
Doorbell already says its recordings are on its SD card and play in the
Reolink app.

- **`PlaybackSource.playable`** (False for such a camera) and
  **`wired_power`**, with `on_battery`.
- **`devices.async_event_sources`:** every playback source, plus each camera
  with no playback source whose connection `stores_recordings`, not playable.
  - **One running on its battery is left out entirely**, rather than searched
    only when its day is opened, as planned above. The feed asks every two
    minutes, and the Events view's day would wake it as well. Such a camera's
    events can come from Home Assistant's sensors later (step 4, Phase 8).
  - A battery camera on an NVR is a playable source, searched on the NVR, and
    stays.
- **The timeline:** a source that is not playable is searched with
  `async_search_day_events`.
  - A failed search becomes the day's `events_error`, as a failed event search
    does on the playable path: today keeps the events found before, and the day
    is not final.
  - Months come from the day search (142), as for any camera.
- **`bridge.timezone()`:** a Baichuan-only device with no zone gets Home
  Assistant's (run 2).
- **`events/recent`, `events/days` and `timeline/warm`** take the event
  sources. Thumbnails and the Playback tab's timeline still take playback
  sources, so the Doorbell's rows have no thumbnail yet (step 3).

**Hardware checklist (the owner):**

1. Update to v0.42.0 and open the panel. Within a couple of minutes, the home
   view's **Today** list shows the Doorbell's events beside the other cameras',
   under its number on the board, without thumbnails.
2. Open **Events** for yesterday. The Doorbell's events are listed: its first
   look at the day can take about 15 s, and then the day comes at once. Its
   button is in **Cameras**. Compare the count and the kinds with the Reolink
   app for the same day, and say whether their times agree with the app's.
3. Press the doorbell, then within a few minutes look for a "Doorbell" row on
   the home view. If none comes, say so: a press may not be an alarm record in
   the search.
4. Tap one of its rows: the Doorbell's **Playback** tab says its recordings are
   on its SD card.
5. The other cameras' events and timings are as before.

**Exit criteria:**

- The Doorbell's events show on the home view within one refresh of the
  camera's search, and on the Events page for past days.
- Their counts, kinds and times match the Reolink app's.
- The other cameras are unchanged.

#### Step 6.3: opening an event that cannot play

- A row opens the camera's Playback tab at the event, as for any camera. The
  day shows its events; there is no recordings bar.
- **Where the player would be:** a sequence of pictures of the event.
  - They are `snapshot_past` at its start, then every 2 s through it, at most
    15, through the thumbnail queue.
  - They are shown as they come, with previous and next buttons and a play
    button that steps through them.
- A plain note under it: "This camera keeps its recordings on its SD card,
  which Reolink Viewer cannot play yet." The note goes into the troubleshooting
  guide, and its test.
- "New" and "seen" work as for every camera.

**As built (v0.43.0).** Built without the owner's check of step 2: it was
night at the door (2026-11-02), and the owner asked for step 3 to go ahead.

- **Pictures, read here (run 2's finding).** `bridge.async_snapshot_past`
  reads a Baichuan-only device's answer to 298 itself.
  - It sends the request reolink-aio sends (its `CoverPreview` template,
    through `send_payload`), finds the first key frame with Phase 5's
    `baichuan_media.BlockReader`, which takes any `100x` stream header, and
    makes the JPEG with reolink-aio's `i_frame_to_jpeg`.
  - Other devices keep reolink-aio's `snapshot_past`. An answer it refuses
    (`UnexpectedDataError`) is asked again and read here.
  - An answer with no key frame is an error.
- **The commands a camera that cannot be played may use.** `timeline/day`,
  `timeline/days` and `thumbnail/urls` take `devices.async_event_source`: the
  playback source, else the not-playable one. Unlike the feed, a camera on its
  battery is not left out, because someone opened it. The playback commands
  keep needing a playable source.
  - The Doorbell's rows in the timetable get thumbnails from this.
- **Its Playback tab: `rv-event-pictures`.** The device page shows it for a
  camera whose `recordings.where` is "elsewhere" (`shownTab` "pictures"); in
  degraded mode the page still says why nothing can be read.
  - **The note**, as a heading the troubleshooting guide has ("Pictures of its
    events"), checked word for word by `help.test.ts`.
  - **The day** of the time opened, with the day before and after (never past
    today), and the day's events, newest first, the opened one marked.
  - **The event's pictures** every **5 s** (the smallest thumbnail bucket, not
    2 s as planned), at most 15, from its start.
    - Previous, play (one a second, stopping at the last) and next.
    - "Asking the camera for the picture…" while one comes, and "No picture of
      this moment." when none does.
    - The next picture is asked for ahead.
  - The old note "Recordings kept where they cannot be played here" is no
    longer reachable, and went.
- **Checks:**
  - `scripts/a11y_check.cjs` and `preview_capture.cjs` have an
    `event-pictures` view, from the preview's new `?elsewhere=cam-door`; axe and
    the keyboard pass in light and dark, desktop and phone.
  - Tests:
    - the bridge's picture paths: reolink-aio, its refusal, Baichuan-only, no
      key frame, no `send_payload`;
    - the websocket commands for a camera that cannot be played;
    - the probe's pictures, now read here;
    - the device page;
    - the component: the pictures, opening, playing, the days, a failed load.

**Hardware checklist (the owner, with step 2's):**

1. Update to v0.43.0. On the home view, the Doorbell's rows now have
   thumbnails.
2. Tap one of its rows. Its **Playback** tab opens on that event, with "Pictures
   of its events" above.
   - The first picture comes in about a second.
   - **›** and the play button step through the event, one picture every 5 s of
     it.
   - Say whether any picture reads "No picture of this moment.", and how often.
3. Tap another event in the list beside it, and step to the day before.
4. Run the probe's events test again: its `thumbnails` should now be true.

**Exit criteria:**

- The Doorbell's events open on pictures from the event, the first in under
  2 s.
- Most of an event's pictures come; the probe's `thumbnails` is true.
- The other cameras' Playback tabs and thumbnails are unchanged.

#### Step 6.4: fallback, events from HA's detection sensors

Only if the event search does not answer. Events then come from HA's
recorder history of the camera's detection binary sensors:

- bounded by the recorder's retention;
- merged per camera and kind (a flicker under 3 s folded in);
- with no recording, and thumbnails only if `snapshot_past` worked.

When Phase 8's journal exists, events come from it instead, without the
retention limit.

**Exit criteria:**

- Today's Doorbell events appear in the home view's timetable within one
  refresh (2 min) of the camera finishing the clip, with the types the Reolink
  app shows.
- Its days have dots in the calendar.
- Opening an event shows its first picture in under 2 s.
- Other cameras' timings are unchanged (timeline 105–287 ms cached).
- With the Doorbell unplugged, no background search reaches it.

**Risks:** searches over UDP may be slower than over TCP; `snapshot_past` on
an SD card is untried; the Doorbell may limit its sessions.

---

## Phase 7 — Live video on dashboards (difficulty: Standard, 1–1.5 wk)

Goal: the wall tablet's dashboard shows the Doorbell and a front-yard camera
as fast and as reliably as the panel does (PLAN.md §6.1).

**The tablet** (decision 3) is a Samsung Galaxy Tab A9+ running Fully Kiosk
Browser. Fully draws pages with Android System WebView, the same Chromium
engine Chrome uses, embedded in an app. This shapes the work:

- **What the tile needs, WebView has:** MSE and WebRTC. HD over MSE is chosen
  by `MediaCapabilities` as everywhere, so H.265 plays only if the tablet's
  decoder takes it.
- **What WebView lacks:** the Screen Wake Lock API, as far as is known (step
  7.2 checks it). On this tablet, keeping the screen on is Fully's own "Keep
  Screen On" and screensaver settings, not ours.
- **Fully turns the screen off and on itself** (on a schedule, or on motion in
  front of the tablet). It may reload the page, and WebView may or may not tell
  the page it is hidden. Step 7.2 measures what this does to the tile.
- **HA's Fully Kiosk Browser integration** can turn the tablet's screen on.
  An automation on the Doorbell's `visitor` sensor can therefore wake the
  screen while the card enlarges the Doorbell; the user guide shows it.
- The WebView's version is shown in Fully's device info, and is recorded with
  each check.

| Step | Status |
| --- | --- |
| 1. The camera card | **Done** (2026-11-02, v0.44.0, below): the owner's check passed on the wall tablet and the iPhone |
| 2. Wall-tablet behaviour | **Done** (2026-11-03, v0.45.0–v0.45.2, below): the cards' log and its report, sleep under Fully Kiosk's screensaver (no frames decoded), and a doorbell's ring that wakes the screen and plays the Doorbell full screen in 0.6 s (v0.45.1 fills the window from the top layer). Not measured: a warm camera's wake time (none warm on the tablet's page) and 8 visible hours |
| 3. Optional: faster camera entities for every card | Not built: gated on the owner wanting stock cards faster, and the phase closed without it |

**Phase 7 closed** (2026-11-03, v0.45.2) on daily use, as the owner decided:
the camera card works on the wall tablet and the iPhone, sleeps under Fully
Kiosk's screensaver, and takes the screen when the doorbell rings. Not
measured: a warm camera's wake time on the tablet (none was warm on its test
page) and 8 visible hours without a stuck card; to look at if daily use shows
either. Open for the owner: the Reolink cards on the wall page in place of
the Advanced Camera Cards, and the card's ring or the owner's own doorbell
takeover automation.

#### Step 7.1: the camera card

- **What it is:** `custom:reolink-viewer-camera`, one camera per card. It
  wraps `rv-live-camera` and `rv-live-tile`, with the same picture first, warm
  MSE, WebRTC fallback, HD in full screen and error states as the panel.
- **No manual set-up:**
  - the integration registers the card's module itself
    (`frontend.add_extra_js_url`), so there is no dashboard resource to add;
  - the card appears in the card picker (`window.customCards`).
- **A visual editor:**
  - the camera, chosen from `live/cameras`;
  - SD or HD;
  - what a tap does: full screen, open the panel, or nothing;
  - whether to show the name and state;
  - how the picture fits.
  - It warns when the camera is not kept warm ("starts in 2–10 s; turn on
    keep warm"), with the switch beside the warning.
- **Sizing:** `getCardSize` and `getGridOptions`, for masonry and sections
  views.
- **Its own module, within a budget:** at most 60 KB gzipped, sharing chunks
  with the panel, checked in CI by `npm run budget`. It loads only the tile,
  not the panel.
- **Permissions:** it works for a non-admin user. The live commands it uses
  are not admin-only; `live/preload` stays admin-only, and the card does not
  need it.
- **Tests:**
  - unit tests;
  - the Chromium test (`tests/live_grid_browser.cjs`'s harness) renders the
    card in a fake dashboard as an admin and as a non-admin.

**As built (v0.44.0).** Started at the owner's request (2026-11-02) while
Phase 6's press check waits for the house to wake.

- **The modules.** Vite builds two entries, the panel and
  `reolink-viewer-card.js`, which share their chunks:
  - `lit`: Lit, for both;
  - `live`: the live tile and what it needs (the player, its sessions, the
    controls, the debug view, the styles, the API), for the panel's home view
    and the card's body;
  - `home`: the rest of the home view.
  - The panel's own module now holds the panel and imports all three at once,
    where before it was a facade over `home`: one fetch less in the chain.
- **The card's module** is only its settings (`card/config.ts`), its size, its
  card picker entry and Lit: **8.1 KB gzipped**, on every page. A shown card
  fetches its body (`card/camera-card.ts`, with `live`): **37.2 KB in all**.
  Its editor fetches 2.4 KB more. `npm run budget` holds the module to 12 KB and
  a shown card to 60 KB. The panel's home view is 52.3 KB, from 49.3 KB.
- **Registered by the integration:** `frontend.add_extra_js_url` with the
  module's content hash, removed on unload. Pages already open load it at
  once (Home Assistant's `frontend/subscribe_extra_js`).
- **In the card picker** as "Reolink camera", without a preview: one would
  start a stream. A new card starts on the first camera (`getStubConfig`).
- **The settings** (`camera`, `quality: sd|hd`,
  `tap_action: full_screen|open_panel|none`, `show_name`, `show_state`,
  `fit: cover|contain`): a wrong value is Home Assistant's error card, in plain
  words. The editor writes only what differs from the defaults.
- **The editor:** plain form controls in Home Assistant's theme colours. It
  warns when the camera is not kept warm ("Not kept warm: its video starts in
  2–10 s. Keep it warm to start at once."), with the keep-warm switch beside it,
  and says a battery camera is never kept warm.
- **The card's body** is the panel's `rv-live-tile`, in a `ha-card`:
  - **Compact** (a new tile property): its controls and picture-in-picture
    only in full screen, as on the board.
  - **Its height** is the camera's picture (`aspect-ratio`), unless the
    dashboard sets it (a sections view's rows); `fit` then decides. The
    shapes it has seen size later cards before their camera list arrives
    (`getCardSize`). In a sections view it starts full width, with
    `rows: "auto"`.
  - **Tap:** full screen in HD; or the panel's Live tab for the camera
    (`history.pushState` and `location-changed`, as Home Assistant's own links);
    or nothing. The tile's button says which to a screen reader (`tapLabel`).
  - **HD on the card** plays the stream full screen would choose (`chooseHd`);
    full screen then shows that stream, without a second player.
  - **Name and state** can be hidden; a hidden state is still read out, and
    a problem always shows.
  - **One full screen:** while one card is full screen, the page's other
    cards stop, as the board's tiles do.
  - Colours and fonts are the panel's around the video only; the card itself
    keeps Home Assistant's theme.
- **Only its camera's picture.** `live/images` takes `camera_ids`: a card
  watches its own camera, and only the watched cameras are taken every 30 s.
  Before, any watch refreshed every camera's, which a wall tablet would have
  done all day.
- **Checks:**
  - unit tests of the settings, the card (sub and HD, warm, the taps, one
    full screen, a battery camera, a change of camera, its messages), the
    editor, and the image watch by camera;
  - the Chromium test (`tests/live_card_browser.cjs`), as an admin and as a
    read-only user: the card picker, the picture, the stream held through
    Home Assistant, the card's height from the picture, the editor's cameras,
    full screen on a tap, and nothing held once the card goes;
  - the design preview's `?dashboard=1`, with axe and the keyboard in light
    and dark, desktop and phone;
  - the user guide's "A camera on a dashboard" and the troubleshooting
    guide's "A camera card on a dashboard", checked by `help.test.ts`.

**Hardware checklist (the owner):**

1. Update to v0.44.0 and restart Home Assistant, then reload the tablet's page
   (Fully: **Reload Start URL**).
2. On the wall tablet's dashboard, **Add card** → **Reolink camera**: the
   Doorbell, then the front-yard camera. Say whether the editor's warning shows
   for a camera that is not kept warm.
3. Watch them for a while: the first picture at once, video within about a
   second on a camera kept warm. Tap one: full screen in HD; back.
4. Say how the dashboard was laid out (masonry, sections or panel view), and
   whether the cards' shapes look right.
5. Fully's device info: the Android System WebView version, for the record.
6. Optional: the same cards on the iPhone app's dashboard.

**The owner's check (2026-11-02, v0.44.0):**

| Item | Result |
| --- | --- |
| Update, restart, reload in Fully | Done |
| The Doorbell's and the front-yard camera's cards, and the editor's warning | Added; the warning shows for a camera not kept warm. Its video came very quickly even so |
| Picture at once, video within about a second, full screen in HD and back | As expected |
| The dashboard | A sections view |
| Android System WebView version | Not known yet: to record with step 2's check |
| The iPhone app's dashboard | Works well |

- **The warning's "2–10 s"** is the plan's figure for a cold start
  (PLAN.md §6.3), its worst case. A camera not kept warm started quickly on
  the tablet, so the warning may say more than the owner sees; its words are
  to be looked at again with step 2's measurements, before Phase 9's tiles
  reuse them.

#### Step 7.2: wall-tablet behaviour

- **The screen waking:** when the page becomes visible again, the tile is
  playing again within the warm-start figures (it already pauses while
  hidden).
- **Under Fully Kiosk, measured first:** the page's visibility events, timers
  and the tile's state when Fully turns the screen off and on, when its
  screensaver comes and goes, and when it reloads the page.
  - If WebView keeps the page "visible" with the screen off, the tile would
    play to a dark screen and hold its streams. The fix is then to stop the
    tile when nothing has been painted for a while, or to read the screen's
    state from HA's Fully Kiosk Browser integration.
  - A reload costs only the first picture from the image cache (0.02 s) and a
    warm start.
- **Keep the screen awake:** a card option through the Screen Wake Lock API,
  where the browser has it. Under Fully, the user guide points to Fully's own
  settings instead.
- **On a doorbell press:** an option to enlarge the card or go full screen for
  N seconds when the camera's `visitor` sensor turns on (read from `hass`, so
  at once). The user guide pairs it with an automation that turns the tablet's
  screen on through HA's Fully Kiosk Browser integration.
- **Network loss:** recovery without a reload (the tile's own retries).
  Measured on the tablet with the soak's rule: 8 visible hours, no tile stuck.

**The owner's setup** (2026-11-02): Fully keeps the screen on all day; at 11
pm it shows a dark clock with no camera feeds, to let the tablet cool for its
battery's sake. The ring is to be a card option, simpler than browser_mod.
Whether the clock is Fully's screensaver or another page is not known yet: the
log tells.

**As built (v0.45.0).** Measuring and the fixes the owner's setup asks for at
once, since both were clear:

- **The cards' log** (`card/tablet.ts`, one per page): the page loaded (with
  whether Fully's JavaScript interface is on), hidden and shown, `pagehide`,
  `pageshow` from the cache, `freeze` and `resume`, offline and online;
  Fully's screen off and on and screensaver on and off; each card's players
  starting, playing (with the time from starting), retrying (in plain words)
  and stopped; rings; and every 5 minutes each card's decoded frames,
  `"<n> frames; visible|hidden[; asleep]; <state>"`, noted while it decodes
  any. Page events are noted only while a card is on the page.
  - Sent every minute, and when the page is hidden, to
    `live/card_log/add` (any user; bounded: 300 events a report, 40/80/200
    characters). What Home Assistant cannot take is kept for the next try,
    the newest 300.
  - Kept by `live/card_log.py` in Home Assistant's storage: the newest 3000
    events per device, for the 10 devices heard from last.
- **The report**, Devices → **Dashboard cards** (`#cards`,
  `components/card-report.ts`), for any device: per device, Fully's
  interface, how often the screen or screensaver slept and the page was
  hidden, how soon video was back after each wake (median and slowest), cards
  that started and were not back by the next wake, frames decoded while the
  page was hidden or Fully asleep, rings, failed starts; every event, to copy;
  Download; Start over.
- **Sleep under Fully Kiosk** (its JavaScript interface on, a Fully PLUS
  feature): the page binds Fully's `screenOff`, `screenOn`,
  `onScreensaverStart` and `onScreensaverStop`; while the screen is off or the
  screensaver on, every card is suspended (its streams stop) and starts again
  after. Without the interface the cards stop only when the page is hidden,
  which the log will show is or is not enough.
- **A doorbell's ring** (`ring_full_screen`, 5–600 s, off by default; in the
  editor only for a camera with a visitor sensor): `live/cameras` gives a
  doorbell's enabled visitor binary sensor (`visitor_entity`). When it turns
  on while the card is shown (a ring before is not one), the card wakes
  Fully's screen (`stopScreensaver`, `turnScreenOn`), goes full screen, and
  leaves it after the seconds, unless it was full screen by hand before. On
  every screen showing the card, so a tablet-only dashboard keeps it to the
  tablet. Full screen without a user's tap fills the window (the browser
  refuses its own).
- **Not built:** the Screen Wake Lock option (Fully keeps the screen on, and
  no other screen asked for it); a stuck-tile measure beyond the report's
  failed starts and cards not back (the 8 visible hours are read from the
  log).
- **Checks:** unit tests of the log (the page's events, sending and keeping,
  Fully's events and wake, frames), the report (a night summed up, its lines),
  the card (the ring, sleep, what it notes), the editor's ring, the settings,
  the store and its commands (any user, bounds), the visitor sensor; the
  report and the dashboard in the design preview, with axe and the keyboard.

**Hardware checklist (the owner):**

1. Update to v0.45.0, restart Home Assistant, reload the tablet's page.
2. In Fully, turn on **Settings → Advanced Web Settings → Enable JavaScript
   Interface** (Fully PLUS), and reload. Then, on any device, **Devices →
   Dashboard cards → Start over…**.
3. On the Doorbell's card, turn on **When it rings: go full screen** (30 s).
   Press the doorbell: the tablet's card goes full screen, then back.
4. Leave the tablet overnight, through 11 pm's clock and the morning.
5. In the morning, open **Devices → Dashboard cards** and send the
   **Download**: whether video stopped under the clock, frames decoded while
   nobody could see them, and how soon video came back.
6. Say how the 11 pm clock comes up (Fully's screensaver, or another page),
   and the Android System WebView version from Fully's device info.

**Exit criteria (this step's):** under the clock, no video decoded and no
stream held beyond keep-warm; video back in a median under 1 s on warm cameras
after the screen comes on; a ring wakes the screen and shows the Doorbell full
screen; no card stuck over 8 visible hours.

**The owner's tablet test (2026-11-02, v0.45.0).** Run for the owner, away
from home, by Claude Code on the Home Assistant server, through Home
Assistant's Fully Kiosk Browser integration and Fully's Remote Admin, with the
cards' log (`reolink-viewer-cards-2026-11-02.json`, 65 events) and Fully's
screenshots.

| Item | Result |
| --- | --- |
| The tablet | Galaxy Tab A9+ (SM-X210), Android 16, Fully Kiosk 1.61.4 (PLUS), **Android System WebView 155.0.8059.43** |
| Its setup | Fully's start URL is the owner's "iOS Wall" YAML dashboard (Advanced Camera Cards), and every full page load is sent there (custom-sidebar's default path). The test used another dashboard with three Reolink camera cards (Doorbell, Front Yard Right, Garage Camera), reached in the app (browser_mod) |
| The 11 pm clock | **Not Fully's screensaver** (its timer is 0): a Home Assistant schedule (23:00 to 06:00) and automation navigate the tablet (browser_mod) to a night page with a clock and no cameras, and back at 06:00. Cards on the wall page are unloaded at night: no stream, nothing decoded |
| JavaScript interface | Turned on; the cards' page reported it ("Android · Fully Kiosk") |
| Page load | All three playing over WebRTC (none kept warm): Doorbell 0.8–1.4 s, Front Yard Right 1.7–1.9 s, Garage Camera 2.1–4.6 s (three loads) |
| Fully's screensaver, 12 min | **Pass.** All three cards stopped within 0.16 s of `screensaver on`; no frames decoded while it showed |
| After it | All three playing **2.6 s** after `screensaver off`, within 9 ms of each other: the WebView resuming after a long screensaver, not the cameras (after 1 min, the ring's wake below: 0.6 s). Against the 1 s target on warm cameras: not measured, none being warm |
| Fully's own | Its screensaver ended by itself on motion before (the tablet's camera), and `reloadOnScreensaverStop` reloaded the page, which the redirect then left: set aside for the test, and put back |
| The ring (`ring_full_screen: 30`, the visitor sensor set on by hand, with the owner's doorbell automations paused) | **Wake: pass.** `ring` at 18:11:36.126, `screensaver off` 0.28 s later, the Doorbell playing 0.6 s after that; the other two cards stopped behind it until the 30 s were up. **Full screen: fail.** The Doorbell's tile was in full screen (its "SD" note showed) but stayed in the card's place: without a tap the browser refuses its own full screen, and the window-filling fallback (`position: fixed`) was held by the dashboard's layout. Its SD note ("SD only: this browser cannot decode H.265 at 2048×2048 and there is no ext stream") showed over the picture |
| Screenshots | Fully's shows the cards' pictures, not their video (the video layer is not in them) |
| Overnight | Not run: the cards are not on the wall page, which the night page replaces |

**v0.45.1, from it:**

- **Full screen without the browser's** (a ring, or the iPhone, which has
  none for an element) fills the window from the **top layer**: the tile
  becomes a manual popover while full, so no ancestor's layout holds it.
  Browsers without popovers keep the fixed position. The Chromium test now
  refuses the browser's full screen in a contained column, and checks the
  card covers the window; without the fix it fails.
- **A card's SD note** stays off the picture: the badge alone, why in its
  title. The panel's tiles still say why.
- **The editor's warnings** say what the tablet measured: a camera not kept
  warm "takes a few seconds to start" (0.6–4.6 s here), not "2–10 s"; HD too.

**The ring again (2026-11-03, v0.45.1), by the owner's Claude Code:** pass.

| Item | Result |
| --- | --- |
| +3 s, +15 s | The Doorbell over the whole screen, on black, "SD" alone top left |
| +40 s | The dashboard back, all three cards Live |
| The log | `ring` 19:49:43.915; `screensaver off` 0.32 s later; the Doorbell `playing` 0.6 s after that (WebRTC); the other two back when the 30 s were up (1.2 and 1.7 s) |

**Two oddities, from the same run:**

- **A slow first load after a restart.** Opening the test page 12 minutes
  after Home Assistant restarted, the three cards played in 16.0, 15.9 and
  19.4 s, over MSE; every start after was WebRTC and fast. That is WebRTC's
  15 s start timeout and then MSE (1–4 s): WebRTC got no answer in time on
  the first start after the restart (our go2rtc starts on the first live
  request, and the cameras' streams with it). Not 0.45.1's: it changed
  nothing in starting. The log noted only the first "starting" and the
  final "playing", so the switch did not show: **v0.45.2** notes it,
  "starting SD MSE, after 15.0 s: WebRTC: …", with why WebRTC gave up. To
  look at again if it recurs, with the log's reason and Home Assistant's
  log of our go2rtc's start.
- **A blocking call at startup.** Home Assistant warned of a blocking call:
  reading reolink-aio's version (`importlib.metadata.version`) in the event
  loop, for the compatibility check. **v0.45.2** reads it once in the
  executor at setup and keeps it.

**Open, the owner's:** the Reolink cards or the Advanced Camera Cards on the
wall page, and with them the card's ring or the owner's own doorbell
"takeover" automation, one of the two.

#### Step 7.3: optional, faster camera entities for every card

Gate: the owner wants HA's stock cards, Advanced Camera Card or the Companion
app's camera views faster too.

- **The entities:** `camera` entities "<camera> (Reolink Viewer)", disabled
  by default.
- **How they play:** native WebRTC through our go2rtc's warm stream, and their
  picture from the image cache.
- **Measured** against HA's own view in the live check. The expected gain is
  only the cold connection to the camera: WebRTC still waits for the next key
  frame (PLAN.md §6.1).

**Exit criteria:**

- **On the Galaxy Tab A9+ under Fully Kiosk**, on warm cameras, both cards
  show a picture in under 0.1 s, and video in a median under 1 s, after:
  - the dashboard opens;
  - Fully turns the screen back on;
  - the screensaver ends;
  - a reload.
- With the screen off, the cards hold no stream beyond the cameras'
  keep-warm.
- No tile is stuck over 8 visible hours.
- The same on the iPhone app's dashboard.
- A non-admin user's dashboard plays.
- The card's module is within its budget.

**Risks:**

- **An out-of-date WebView without MSE:** the tile falls back to WebRTC
  (0.39–0.40 s on the Doorbell in Phase 3). Fully's device info shows the
  version, and Android updates WebView through the Play Store.
- **Fully's screen-off and reload behaviour** (measured in 7.2).

---

## Phase 8 — Unusual events: learning what is normal (difficulty: High, 2–3 wk, then a week of learning)

Goal: of the hundreds of detections a day, mark the few that are unusual for
their camera, say why in a sentence, and let automations act on them.

**The design comes from Reolink Stamina** (MIT; PLAN.md §6.5). It ranks by
rarity, never by danger, and the panel says so.

| Step | Status |
| --- | --- |
| 1. The detection journal (opt-in) | **Built** (2026-11-03, v0.46.0, below), on at the owner's (all 7 cameras). v0.46.1: motion as bursts, a year kept. History collects |
| 2. The model | **Built** (2026-11-03, v0.47.0; tuned in v0.47.1–v0.47.4 on the owner's marks, below), but for the house-wide signals (next). Exit criteria met, the rebuild time's restated (no rebuild at a restart; the night's in the background) |
| 3. In the panel | Not started |
| 4. For automations | Not started |

#### Step 8.1: the detection journal

- **An option, off by default (decision 5):** "Learn what is normal". Its text
  says what the journal holds (when each camera saw people, vehicles and
  animals, which tells when the house is empty), that it stays on this
  machine, and that removing the integration deletes it.
- **What it records:** every state change of every Reolink detection binary
  sensor the catalog knows, except `sleep`:
  - person, vehicle, non-motor vehicle, animal and pet, face, package,
    visitor, cry, motion;
  - the crossline, intrusion and linger variants;
  - forgotten and taken items, tamper.
  - `unavailable` and `unknown` are recorded too, so an offline camera is not
    mistaken for a quiet one.
- **One camera, not one connection:** sensors are mapped to cameras through
  `devices.py`. A camera on the NVR and added directly (the CX410, the CX810)
  is one camera; its two sensors firing together are one detection.
- **Storage:** its own SQLite file in the config folder
  (`reolink_viewer_journal.db`), written in batches; a backup hook
  checkpoints the write-ahead log before HA's backup.
- **A head start:** a one-time import from HA's recorder (10 days by default)
  when the option is turned on.

**As built (v0.46.0).**

- **The option** "Learn what is normal" (`learn_normal`, off by default), in
  Reolink Viewer's options, applied at once (an options listener, no
  reload). Its text says what the journal holds and shows (when the house is
  empty), that it stays in a file on this Home Assistant, in its backups, and
  that turning it off or removing the integration deletes it.
- **The sensors** (`devices.async_detection_sensors`): every enabled Reolink
  binary sensor whose entity description key is a detection
  (`DETECTION_KINDS`: motion, person, vehicle, non-motor vehicle, animal, pet,
  face, package, visitor, cry, tamper, and the crossline, intrusion and linger
  zones' person, vehicle and dog/cat, forgotten and taken items). Not sleep,
  nor the alarm input. Motion has no translation key; its unique id ends in
  its key. Each sensor goes under its camera's id (the NVR connection's, the
  primary), so a camera added both ways is one camera. The map is read again
  5 s after the entity or device registry changes, once per burst.
- **What is recorded** (`journal.py`): each state change (attribute-only
  updates are not) of those sensors, `on`, `off`, `unavailable` and
  `unknown`, at Home Assistant's `last_changed` (ms), from a filtered
  `state_changed` listener.
- **The file**, `reolink_viewer_journal.db` in the config folder: SQLite in
  write-ahead mode, written in batches (every 30 s, or at 200 changes) in the
  executor. `sources` (entity, camera, camera's name, kind) and `changes`
  (source, time, state), keyed by source and time `WITHOUT ROWID`: about 14
  bytes a change, so a busy month (9000 changes a day) is about 4 MB, under
  the 10 MB the exit criteria allow.
- **A head start:** when a journal is new, the last 10 days of these sensors
  from the recorder (`get_significant_states`, every change, no attributes),
  up to when live recording began, once.
- **Backups:** `backup.py`'s `async_pre_backup` writes what is pending and
  checkpoints the log into the file.
- **Status** (`journal/status`, any user): since when, what was imported,
  changes and detections (sensors turning on) per camera, the file's size.
  The Devices page's **Learning what is normal** shows it, or says how to
  turn it on.
- **Checks:** the sensors' map (kinds, sleep left out, a disabled sensor);
  nothing recorded and no file while off; each change of each camera,
  offline included, real changes only; a sensor added later, once the
  registry settles; batches; the status, for a read-only
  user; turning it off deletes the file and on starts a new one; removing the
  integration deletes it; the backup hook; the recorder's head start, once.
  Sizes measured: 14 bytes a change.

**Hardware checklist (the owner):**

1. Update to v0.46.0 and restart Home Assistant.
2. **Settings → Devices & services → Reolink Viewer → Configure**: turn on
   **Learn what is normal**.
3. In the panel, **Devices → Learning what is normal**: it says it is on, with
   the detections imported from the last 10 days per camera. Every camera
   should be listed; say if one is missing.
4. A day later, the same: the counts have grown, and the file is small (its
   size is shown).

**The owner's check (2026-11-03, v0.46.0).** On since 2026-11-02 21:39, all 7
cameras listed: 184,063 changes imported from the recorder (from 2026-10-23),
92,107 detections, **3.6 MB**. Per camera: Front Yard Right 45,970
detections, Doorbell 12,468, Back Yard 11,670, Front Yard Left 17,488, Garage
Camera 2,761, Dogs 1,572, Laundry Room 178.

- **Size:** 3.6 MB for 10 days is about 20 bytes a change on disk (not the 14
  measured on a small test file), 18,400 changes a day: **11 MB a month**, over
  the 10 MB the exit criteria allow, and 130 MB a year.
- **Motion is most of it:** 157,406 of the 184,063 changes (85%) and 78,676 of
  93,356 detections. Front Yard Right alone has 43,816 motion detections in
  10 days (trees, shadows, headlights). Next are person (13,117 changes),
  vehicle (7,971), animal (4,082), intrusion person (2,636) and dog/cat
  (1,384); the rest are under 300 each.
- **Flicker** (back on under 3 s after going off): 22.1% of detections. Motion
  23%, person 22%, intrusion person 17%, intrusion dog/cat 13%, animal 12%,
  vehicle 7%; crossline vehicle, visitor and package none. Step 8.2 folds
  flickers when it reads, so the AI kinds are kept as they come.

**The owner's decisions (2026-11-03):**

- **Motion as bursts** (rather than kept change by change, or left out): its
  timing is what the model needs (a burst at 3 am on a quiet camera), not
  each flicker of it.
- **A year kept** (rather than unlimited, or 90 days): enough for seasons;
  the model weighs it with a 90-day half-life, and older changes go.

**As built (v0.46.1).**

- **Motion as bursts** (`journal.py`, `BURST_KINDS`, `QUIET_S` 30 s): a
  motion sensor's `off` is held. An `on` within 30 s drops both (the burst
  goes on); anything else, or 30 s of quiet (checked every 30 s with the
  batches), writes it at its own time. Offline ends a burst at once. Stopping
  writes the bursts still held. The recorder's head start goes through the
  same merge (`merge_bursts`). The AI kinds stay change by change.
- **The journal of v0.46.0 is compacted once:** schema 2. At its first start
  on v0.46.1, one SQL pass (window `LEAD` per motion source) deletes each
  motion `off` followed by an `on` within 30 s, with that `on`; then
  `VACUUM`. The count of changes imported is kept as it was.
- **A year:** changes older than 365 days are deleted at start and daily
  (`KEEP_DAYS`); a prune due as the journal stops does nothing.
- **Checks:** bursts (two dips within 30 s are one burst; the end written
  after the quiet, at its own time; a new burst after; offline ends one; a
  flickering person sensor kept change by change); a v0.46.0 journal merged
  once, the person sensor untouched, schema 2; the head start merged; the
  year (at start, and a year on); a new journal's start time set.

**Hardware checklist (the owner, v0.46.1):**

1. Update to v0.46.1 and restart Home Assistant.
2. **Devices → Learning what is normal**: the same 7 cameras; the detection
   counts are lower than before (motion's dips within 30 s are now one burst),
   and the file smaller. Note the size, and again a week later: the journal
   should grow well under 10 MB a month.

#### Step 8.2: the model

Ported from Stamina's `relevance` package with its copyright notice and its
tests, adapted to our camera ids and types (decision 4).

- **Events derived when read**, never stored:
  - flickers under 3 s folded, per camera and kind;
  - linger sensors do not stretch an event;
  - capped at 5 min.
- **Per camera, from the journal, weighted by recency (a 90-day half-life):**
  - time of day (a circular kernel);
  - minutes from sunset and sunrise;
  - length (in buckets);
  - which camera fired just before, and how long before;
  - optional house-wide signals chosen in the options, such as anyone home or
    the alarm armed.
- **The score:**
  - each signal's surprisal against a uniform baseline, added up (naive
    Bayes);
  - the threshold is the camera's own score quantile, with a floor;
  - three sensitivities (only the strangest, balanced, more);
  - what a new camera may borrow from: all cameras, its host's, or none.
- **The minimum:** 7 days and 200 detections per camera before anything is
  marked, with "learning: N more days / N more detections" said plainly.
- **Every mark carries its reason:** a sentence, and each signal's
  contribution.

**As built (v0.47.0).** Ported from Stamina's `relevance` package
(v1.9.2, commit `ec9aabf`): `events.py`, `rates.py`, `score.py` and, adapted,
`analysis.py`, with its numbers (`const.py`), as `unusual/` (events, rates,
score, model, const). Its tests come too: 71 of them, 3 adapted (our host
scope; our journal's file), plus ours. The licence is in `THIRD_PARTY.md` and
ships beside the code (`unusual/LICENSE-reolink-stamina.txt`); each ported
file says what changed.

- **Events, derived when read** (`events.py`): a camera's sensors map onto
  subjects (Stamina's map: a crossline or intrusion person is a person, a
  dog/cat or pet an animal, the visitor sensor a doorbell press; plus tamper).
  Flickers under 3 s merge; a run is the sensor's that opened it (linger
  sensors do not stretch it); capped at 5 min; offline ends it. Motion
  arrives already merged into bursts (v0.46.1).
- **The model, per camera and subject** (`rates.py`, `score.py`), as
  Stamina's: time of day (288 five-minute bins, a 45-minute circular kernel),
  minutes from sunset, length (log buckets), what fired before it (10, 30 and
  120 s after another camera ended, or nothing), weekday against weekend and
  the day of the week (blended by evidence), and what it was against the
  camera's mix; a 90-day half-life; a thin profile backs off to the subject
  across its pool, then to the pool. Each term's surprisal against chance,
  added (naive Bayes). The sentence names the one or two terms that stood out
  most, with how often each was seen.
- **The line a score must pass:** the camera's own 95th percentile, Stamina's
  floor (2.1, 1.4 or 0.7 nats for the three sensitivities) and, ours, **a
  daily cap**: the score above which the property had about 2, 4 or 9 events
  a day over the last four weeks (Stamina's measured marks a day at each).
  Stamina's floor was measured at about 400 events a day across nine
  cameras; the owner's property sees about ten times that, and on a synthetic
  copy of it (the owner's per-camera and per-kind counts, made-up daily
  rhythms) "balanced" marked 53 a day by the floor alone and 6 with the cap.
  The status shows both, so the owner's own numbers decide whether the cap
  stays.
- **Pools** (the scope option): all cameras together (the default), each host
  (an NVR, Home Hub or camera on its own connection, from Home Assistant's
  device registry: `devices.async_camera_hosts`), or each camera alone.
- **The minimum:** 7 days and 200 events per camera; until then a camera's
  events are scored and none is marked, and the Devices page says what it is
  short of ("Learning: 50 more detections").
- **Built** (`model.py`) from the whole journal through a read-only
  connection of its own (the journal keeps writing), streamed per sensor (a
  year of history is never in memory: a few MB at most): once Home Assistant
  has started and the head start is imported, each night at 03:17, and when
  the options change. The thresholds are calibrated on the last four weeks, at
  most 4,000 events a camera (picked by a hash of their time, so the same each
  night). Ours, for speed: each event is counted into its own camera and
  subject's profile and the broader ones are their sums (tested equal to
  counting each four times); a circular rate spreads its kernel once, when
  read; sunrise and sunset are timestamps per day.
- **Scoring a window** reads the journal as it stands (what was detected
  since the rebuild is scored against the night's rates), an hour back for
  each first event's predecessor. `unusual/events` (since, until, at most 7
  days; a camera; only the marks) returns each event with its score, line,
  sentence and every term.
- **On the Devices page,** "Learning what is normal" now says per camera
  "Marks what is unusual" or what it is short of, then the last 7 days: the
  marks, about how many a day, at which sensitivity, the latest 10 with their
  sentences, and **the numbers behind it** (without the cap; the line; marks
  by kind; what stood out most; each camera's own line; when it was learned
  and how long it took).
- **Options:** "How much to mark unusual" (only the strangest, balanced,
  more) and "What each camera is compared with" (all together, each host,
  each camera), applied at once.
- **Not yet: house-wide signals** (anyone home, the alarm armed). The model
  scores them (Stamina's terms and tests are ported), but the journal does not
  record them yet: that needs the chosen entities' changes kept beside the
  detections and an entity picker in the options. Built in v0.50.0 (see
  "House-wide signals", after step 3).
- **Sizes measured** (this container, x86): a 90-day rebuild of a synthetic
  journal at 4,000 detections a day (360,000 events) takes 4.1 s, with a
  few MB of memory; 60 days of the owner-shaped copy, 2.9 s; the Devices
  page's week, about 1.5 s. Over the 2 s the exit criteria set, at ten times
  Stamina's volume: it runs in the executor, at night. The status shows how
  long the owner's took.
- **Checks (ours, beside Stamina's):** every journaled kind has a subject;
  streams derive what the whole list does; the broader profiles equal counting
  each event four times (each scope); a duration reads "about 4 min"; one
  subject's sensors from the journal are one event; it reads while the journal
  writes; the daily cap's arithmetic, and a busy property kept to it (with the
  uncapped count above it); unknown options fall back; a rebuild finishing
  after learning is turned off is dropped; in Home Assistant: built once
  started and shown in the status, `unusual/events` (scored while learning,
  only the marks, a week at most), a new sensitivity rebuilds, off forgets.

**Hardware checklist (the owner, v0.47.0):**

1. Update to v0.47.0 and restart Home Assistant. A minute or so later, open
   **Devices → Learning what is normal**.
2. Each camera says **Marks what is unusual**, or what it is short of. With
   the journal's 11 days, all should mark but perhaps the Laundry Room.
3. **Unusual in the last 7 days**: note the marks and about how many a day
   (the exit criteria want 2–8 at Balanced), and read the latest marks'
   sentences: do they point at things worth a look?
4. Open **The numbers behind it** and copy it here: without the daily cap,
   the line, marks by kind, what stood out most, and how long it learned.
5. Optional: try **Only the strangest** and **More** in Reolink Viewer's
   options; the numbers change at once.

**The owner's check (2026-11-04, v0.47.0).** The journal after its
compaction: 34,913 detections from 7 cameras (it was 92,107 before motion's
bursts). Six cameras mark; the Laundry Room learns (56 detections, 145 more
to go: about a month at its rate).

- **3.6 marks a day at Balanced** (25 in 7 days, of 14,582 events, about
  2,100 a day): in the 2–8 the exit criteria want. **Without the daily cap,
  243** (35 a day): the line was the cap's, 3.95, against the floor's 1.4.
  The cap stays.
- **The marks:** motion 10, vehicle 6, animal 6, person 2, doorbell 1. What
  stood out most: the light (time from sunset) 12, how long 4, the time of
  day 4, what fired before 3, what it was 2.
- **What they showed:**
  - motion was 10 of 25 marks, two of them 2 minutes apart ("Motion in
    daylight on Back Yard");
  - the time of day and the time from sunset are one clock read twice: on an
    owner-shaped copy of 12 days they agreed at 0.95 and made 71% of a mark's
    score, and sentences said things like "Vehicle after dark on Doorbell —
    24th time in 11 days";
  - one animal at 02:25 made three marks (Front Yard Right, Front Yard Left,
    the Doorbell).
- **The journal read 6.9 MB:** the one-time compaction left about 4 MB of
  write-ahead file, which SQLite does not shrink (reproduced: 2.9 MB of
  journal, 4.1 MB of write-ahead file; 2.5 MB after a truncating checkpoint).
- **Learned in 11.67 s,** at Home Assistant's start: that timer began before
  an executor thread was free. On the owner-shaped copy of the same age the
  learning itself takes 1.2 s here.

**The owner's decisions (2026-11-04):** don't mark motion (still learned
from); count time once; one mark per incident across cameras.

**As built (v0.47.1).**

- **Motion is never marked** (`UNMARKED_KINDS`): still counted in every
  profile (what fired first, each camera's mix), scored, and shown with its
  line; never unusual. The thresholds and the cap are drawn from what can be
  marked only.
- **Time counted once** (`TIME_WEIGHT` 0.5): where sunset is known, the clock
  and the light each count half, so their sum is their mean; without a
  location the clock counts whole. A sentence says the time once ("at 01:57"
  or "after dark", not both).
- **One mark per incident** (`incidents`, `INCIDENT_SECONDS` 60): the same
  kind on any camera, each starting within a minute of the incident's last
  end, is one incident. It is marked when any of its events is, shown as the
  highest-scoring one, its sentence naming every camera that saw it
  ("Animal at 02:25 on Front Yard Right, Front Yard Left and Doorbell"), and
  without a "what fired first" that was the same incident. The daily cap
  counts incidents (each scored as its highest event); the status counts
  marks, by day, kind and reason, per incident; `unusual/events` gives each
  event its incident's number. The calibration now scores up to 20,000 events
  a camera (all of the owner's), so the incidents it counts are whole.
- **The write-ahead file** is emptied when the journal opens
  (`wal_checkpoint(TRUNCATE)`, so a v0.47.0 compaction's 4 MB goes at the
  next start) and kept under 1 MB after each checkpoint
  (`journal_size_limit`).
- **"Learned … in N s"** is the time the learning took in its thread, not
  the wait for one.
- **On the owner-shaped copy:** 3.0–4.4 marks a day, none motion; the reasons
  spread over what fired first, how long and what it was.
- **Checks:** motion scored over its line and not marked (and its own test
  among Stamina's); time halved with sunset, whole without, said once; the
  incident grouping (chained from each end; other kinds and longer quiets
  apart); a person on two cameras one mark naming both, without "after" the
  other; the cap on incidents; incident numbers in `unusual/events`; the
  write-ahead file emptied at open (failing without the fix).

**Hardware checklist (the owner, v0.47.1):**

1. Update to v0.47.1 and restart. The journal's size should drop (the
   write-ahead file emptied).
2. **Devices → Learning what is normal:** no motion marks; marks of one thing
   on several cameras name them together; the marks a day still in 2–8.
3. Tomorrow after 03:17: **Learned … in N s** is the night's learning time on
   the mini PC.
4. Copy **The numbers behind it** here again, with a few of the sentences.

**The owner's check (2026-11-04, v0.47.1).** The journal: **1.1 MB** (the
write-ahead file emptied), about 2.8 MB a month at its rate: under the 10 MB
the exit criteria allow. No motion marks; incidents named together ("Animal at
all on Doorbell, Front Yard Left and Front Yard Right").

- **5.1 marks a day at Balanced** (36 in 7 days, of 14,493 events); 74
  without the cap (10.6 a day); the line the cap's, 2.118.
- **By kind:** vehicle 14, person 11, animal 7, doorbell 3, package 1. **What
  stood out most:** what fired before it 14, how long it lasted 13, what it
  was 6, the light 2, the time of day 1.
- **What the latest 10 showed:** three brief detections ("Vehicle lasting
  about 1 s on Doorbell"; passing cars or false ones); five a kind "at all"
  that is not rare in itself ("Doorbell at all on Doorbell — 12th time in 7
  days", "Package — 8th time in 10 days", "Animal on the Doorbell — 31st time
  in 9 days"); "what fired before" a camera whose last event was likely
  motion ("Vehicle on Doorbell, 9s after Dogs").
- **Learned in 28.54 s** at the restart, now counting only the learning's own
  thread: likely that thread waiting for Python's lock behind Home Assistant's
  start (the same journal learns in about 1.3 s here). v0.47.2 shows the
  thread's computing time beside it, and 03:17's run will tell.

**The owner's decisions (2026-11-04):** only long stands out; a kind seen 10
times on a camera is known; only detections count as what fired first.

**As built (v0.47.2).**

- **Only long stands out:** where an event lasted less than its camera and
  kind's median (backing off to the kind across its pool, then the pool), the
  duration term can only lower its score.
- **Known kinds** (`KIND_KNOWN` 10): once a camera has seen a kind 10 times,
  the kind term can only lower a score. A new kind on a camera still stands
  out, and a known one at a strange hour still does by the hour.
- **What fired before** (`preceded`): only what can be marked; motion is
  still in every profile, and still has its own predecessor.
- **The learning's computing time** beside its time: "in 28.5 s, 1.2 s of it
  computing" would mean waiting, not work.
- **On the owner-shaped copy:** 3.4 marks a day (67 without the cap); by
  kind vehicle 9, person 7, animal 4, package 4.
- **Checks:** Stamina's kind tests adapted (a person seen 9 times, below
  `KIND_KNOWN`; the trailing clause from terms); ours: a kind seen 18 times
  adds nothing; brief detections add nothing, long ones do; motion is never
  what fired before; a long motion at 3 am scores over its line and is not
  marked; the computing time shown.

**Hardware checklist (the owner, v0.47.2):**

1. Update to v0.47.2 and restart.
2. **Devices → Learning what is normal:** fewer brief and "at all" marks; the
   marks a day in 2–8.
3. **After 03:17:** "Learned … in N s, M s of it computing": the night's
   learning time on the mini PC.
4. Copy **The numbers behind it** and a few sentences here.

**The owner's check (2026-11-04, v0.47.2).** Right after the restart the page
said it was learning (the first build had not finished); a few minutes later:

- **5.3 marks a day at Balanced** (37 in 7 days, of 14,297 events); 50
  without the cap; the line the cap's, 1.716. No brief marks, no "Doorbell
  at all"; packages still (seen 8 times, below 10).
- **By kind:** vehicle 15, person 11, animal 8, package 3. **What stood out
  most:** what fired before it 14, how long 13, the light 5, what it was 3,
  the time of day 2.
- **A mark said "usual":** "Person at 16:56 — usual for Back Yard, Front Yard
  Left, Doorbell, Dogs and Garage Camera". An incident's later events each
  took the camera before them, in the same incident, as what fired first; that
  step (one camera to another within seconds) is rare, so it alone passed the
  line, and the incident's sentence leaves it out, which left nothing to say.
  "Animal on a Tuesday … 62nd time in 11 days" the same.
- **Learned in 10.89 s, 3.62 s of it computing** (a restart's build: the rest
  waiting). This mini PC computes about 4.5 times slower than the container
  (3.62 s for about 24,000 events, against 1.34 s for 40,000): a 90-day
  rebuild would take about 12 s there, a year about 45 s. Over the 2 s the
  exit criteria set; and each restart rebuilds, which is when the page says
  it is learning.

**As built (v0.47.3)**, fixing the above (the owner's choices stand):

- **An incident's later events take what fired before the incident**
  (`preceded`): the same kind on any camera within a minute of its last end
  continues it, in training, calibration and scoring alike. One person
  crossing five cameras is one arrival after what came before it.
- **A mark always says why:** where no term is worth saying alone (several
  small rarities past the line), its largest ones are said; never "usual".
- **The model is kept between restarts:** saved after each build beside the
  journal (`reolink_viewer_journal.model.json`, about 200 KB at 90 days of the
  owner-shaped copy, loaded in 0.04 s), and taken back at a start when it was
  learned from this journal (its creation time), by this version, with these
  options, less than a day ago; otherwise learned again. Turning the option
  off or removing Reolink Viewer deletes it with the journal.
- **The exit criterion restated:** "a 90-day rebuild under 2 s" assumed
  Stamina's volume (about 400 events a day). At the owner's (about 2,000) it
  becomes: **no rebuild at a restart; the night's rebuild in the background
  at 03:17** (about 12 s of computing at 90 days on the mini PC, projected;
  measured from 03:17 each night).
- **Checks:** an incident's later events take what fired before it, and a
  new incident after a minute does not; a marked event with only small terms
  says them; the saved model scores as the built one (to six decimals) and
  is refused for another version, other options, a day's age or another
  journal; deleting the journal deletes it; a restart takes it and does not
  rebuild. Two tests moved apart in time or kind (their "fired first" is now
  the same incident).

**Hardware checklist (the owner, v0.47.3):**

1. Update to v0.47.3 and restart: the page learns once (no saved model yet).
2. Restart again: the page shows the model at once, with the same "Learned".
3. No mark says "usual"; fewer marks led by what fired before them.
4. After 03:17: "Learned … in N s, M s of it computing", the night's run.

**The owner's check (2026-11-04, v0.47.3).** 5.3 marks a day (37 in 7 days,
of 14,288 events); **39 without the cap**, the line the cap's at 1.455 against
the floor's 1.4: the noise gone, the floor nearly deciding alone. No "usual".
Learned at the update's restart (03:56 local): 11.29 s, 3.87 s computing.

- **What stood out most:** what fired before it 16, how long 11, what it was
  4, the light 2, the day 2, the time 2.
- **Rare by share, common by count:** "Vehicle lasting about 16 s — 14th time
  in 8 days", "Person at 10:39 — 14th time in 10 days", "Person on a Tuesday
  — 12th time in 10 days".
- **What fired before, still mostly chance:** "Animal 41s after Garage
  Camera", "Vehicle 21s after Dogs" (the Dogs camera fires often).

**The owner's decisions (2026-11-04):** known after 10 sightings for every
signal; only "nothing fired first" raises a score.

**As built (v0.47.4).**

- **Known after 10, for every signal** (`KNOWN_AFTER`, was `KIND_KNOWN`):
  any term whose value the camera has seen 10 times for that kind (a kind, a
  time within its 45 minutes either side, a light, a length, a day, what fired
  before, a signal's value) can only lower a score. A mark's sentence then
  reads "2nd time", "7th time", never "14th". The day is counted by its own
  name ("on a Sunday": Sundays), not weekend days at large.
- **Only "nothing fired first" raises a score:** a rare "after X" can only
  lower one; appearing without what usually comes first still stands out.
- **On the owner-shaped copy:** 1.3 marks a day, the floor deciding (the cap
  below it). Fewer than the exit criteria's 2–8 at Balanced; the owner's own
  numbers decide whether Balanced's floor comes down, and More is there.
- **Checks:** a long visit seen 12 times adds nothing, 5 times still does;
  "nothing fired first" stands out where people always come after the gate,
  and after a rare camera does not; Stamina's busy-camera Sunday test, with
  the day counted by its name; the cap test with 7 odd nights (10 would be
  known).

**Hardware checklist (the owner, v0.47.4):**

1. Update to v0.47.4 and restart (it learns once: a new version).
2. **Devices → Learning what is normal:** no "Nth time" above 10th; no rare
   "after"; the marks a day (fewer: say if under 2).
3. After 03:17 tomorrow: "Learned … in N s, M s of it computing".

**The owner's check (2026-11-04, v0.47.4).** **1.4 marks a day** at Balanced
(10 in 7 days, of 14,397 events), all of them rare by count (the most, "10th
time"); the cap no longer cut any (10 without it; its line below the floor).
Four were package deliveries ("Package at all on Doorbell — 8th time in 10
days"), known after two more. What stood out most: what it was 4, how long 4,
the time of day 2. Learned at the update's restart: 17.49 s, 4.94 s
computing.

**The owner's decisions (2026-11-04):** Balanced at about 2–4 a day; next,
marks in the panel (step 3).

**As built (v0.47.5).** With "known after 10", a score's terms can only rise
for what is new, so few events score above zero at all: on the owner-shaped
copy, a floor of 0.7 marked no more than 1.4 did, and a floor of 0 about 1.7
a day. The supply of the new, not the floor, now sets the rate.

- **The floors are the least a mark must be:** Only the strangest 1.4 nats,
  Balanced and More 0 (rarer than chance at all, by something seen fewer
  times than they know).
- **The daily allowances:** under 1 a day (0.7), Balanced 3, More 6.
- **More knows a value only after 20 sightings** (`KNOWN_AFTERS`; the model
  keeps it): borderline ones are what was seen 10 to 19 times.
- **On the owner-shaped copy:** Only the strangest 0.4 a day, Balanced 1.7,
  More 6 (at its allowance). The owner's Balanced should land at or above its
  1.4 at the old floor.
- **Checks:** More counts a value seen 12 times as new and Balanced does not;
  a model built at More knows after 20.

**Hardware checklist (the owner, v0.47.5):** update and restart; the marks a
day at Balanced (and, for a look, at More); the night's "Learned … in N s, M s
of it computing" after 03:17.

#### Step 8.3: in the panel

- **An "Unusual" mark on timetable rows.** Camera events are joined to the
  journal's events by camera and overlapping time. A tap opens the reason: the
  sentence, and a bar per signal.
- **An "Unusual" filter chip** in the Events view; it reads "Learning…" while
  a camera learns.
- **Per camera, "What it has learned"** (from Overview): when it sees each
  kind, how long each lasts, and what fires before it. It is the way to spot a
  camera that learned something wrong.
- **Events seen only by the journal** also get the mark: a camera whose events
  cannot be searched (Phase 6.4), or an event the camera's search has not
  listed yet.

**As built (v0.48.0), all but "What it has learned":**

- **`reolink_viewer/unusual/marks`** (since, until; at most 7 days): the
  window's marked incidents, scored as the status scores them (the line, the
  cap, one mark per incident), each with every event of its incident
  (`members`: camera, start, end), and whether each camera marks yet. A past
  window is kept until the model is rebuilt; today's for a minute. With
  learning off it answers `enabled: false` and nothing else.
- **The join** (`frontend/src/unusual.ts`): each member marks its camera's
  rows that overlap it, with 30 s of slack either side, the rows that show
  the mark's kind first (a person's mark goes on the person row, not the
  motion beside it). A member no row matches, if it began in the day, is a
  row of its own, "seen by Home Assistant's sensors".
- **The rows:** a plain "Unusual" badge beside what was seen, and under the
  row a "Why it is unusual" disclosure (the row itself still opens the
  recording): the sentence, then each signal as words (what it was, which way
  it pointed: rarer than chance, more usual, as by chance) and a bar either
  side of a centre line, its size to 4 nats. On the home view and the Events
  view alike.
- **The Events view's filter:** "Marked: Unusual" beside Cameras and
  Detected, "Learning…" (disabled) while no camera marks yet, absent with
  learning off; "Show every event" clears it too.
- **Checks:** the join (kind first, the slack, journal rows in and out of
  the day, a mark without members); the rows, the disclosure and the filter;
  the command (off, the window, `members`, the cache); the accessibility
  check opens a "Why" on the Events view.

**Hardware checklist (the owner, v0.48.0):** on Events, today and a day or
two back: the marked rows (the same incidents as Devices → Learning what is
normal), each "Why" read as it should, and the Unusual filter; any row "seen
by Home Assistant's sensors" (which camera, and is it in the camera's own
list a few minutes later?).

**The owner's check (2026-11-04, v0.48.0, Devices → Learning what is
normal).** **2.6 marks a day** at Balanced (18 in 7 days, of 14,493 events),
the cap cutting none (18 without it): inside the "about 2–4 a day" chosen.
Six of seven cameras mark (Laundry Room: 56 detections, 145 short). By kind:
vehicle 7, animal 6, package 3, person 2; what stood out most: how long 9,
the time of day 4, what it was 3, the day 2. The journal 1.2 MB. Learned at
the update's restart: 17.91 s, 5.24 s computing. Two things read wrong:

- **"Package at all on Doorbell — 8th time in 10 days"**, twice (Nov 2 and
  Nov 3). The count is the model's, and the panel scores the past against
  today's model, which already holds the event and what came after it.
- **"0 (the daily cap; the floor is 0)"**: a cap at the floor holds nothing
  back, yet was named as the line.

**Not yet seen:** the Events checks above, and a 03:17 rebuild.

**As built (v0.49.0):**

- **The count is a total:** "Package on Doorbell — seen 8 times in 10 days"
  (and "seen once", "seen twice"), this event included if the model holds
  it, one more if it came after the build. "at all" is gone from a sentence
  led by the kind.
- **The cap is named only when it is the line** (above the floor).
- **"What it has learned"**, on each camera's Overview, from
  `reolink_viewer/unusual/profile` (the model in memory; nothing read).
  Stamina's `shapes.py` ported with its tests (MIT, in `THIRD_PARTY.md`):
  per kind it has seen, commonest first (the first open), the time of day
  as 24 bars (an image whose words name the busiest hour and how many
  are empty), the week Monday to Sunday, how long and what fired first with
  their shares, five each. A value seen fewer times than the sensitivity
  knows (`known_after`) says "Can stand out". Hidden with learning off.
- **The rebuild's time, measured** on an owner-shaped copy (this machine):
  12 days 1.4 s (scoring the calibration's events 0.73 s of it, 15,615 at
  0.047 ms); 90 days at the owner's rate about 5 s (reading the journal into
  events 2.2 s, counting 0.6 s, calibration 1.8 s plus its own read). The
  owner's host computed 5.24 s for 12 days, so about 3.7 times slower:
  20 s or so a night at 90 days, in the background. The "90-day rebuild
  under 2 s" criterion is Stamina's, not met here; what would meet it is
  learning incrementally (the weights decay exponentially, so last night's
  counts can be scaled and today's added), not built yet.

**Hardware checklist (the owner, v0.49.0):** a mark's sentence ("seen N times
in …", no two the same for different counts of one thing); Numbers behind
it → the line; a camera's Overview → What it has learned (does each kind
look like that camera's day? anything learned that should not have been?);
and, still, the Events checks and the 03:17 Learned line.

#### House-wide signals (v0.50.0)

The owner's choice after step 3 ("Proceed with house-wide signals"): what the
house says beside each detection (anyone home, the alarm, a lock, the light
outside), as Stamina learns it.

**As built (v0.50.0):**

- **Chosen in the options:** "House-wide signals to learn with", an entity
  picker over Stamina's domains (person, device tracker, binary sensor, alarm
  panel, input boolean and select, sun, calendar, light, lock, siren; a
  sensor where it is an enum, or measures the world: temperature, light,
  wind...). Left out (Stamina's `signal_picker`): the cameras' own detection
  sensors, diagnostic and configuration entities, and binary sensors of a
  device's own health (battery, connectivity, problem...).
- **Kept beside the detections:** the journal's `signal_changes` (which, when,
  the state as text), each state as it changes; a number at most every 5
  minutes (its first and latest reading in each stretch). A newly chosen
  signal's state is written as of its last change, and its history comes
  from the recorder back to the journal's first change, once per signal.
  The daily prune keeps each signal's last state from before the cut. One
  no longer chosen is kept, unread.
- **Read with the events:** each event, as it is derived, takes what each
  chosen signal stood at when it began ("unknown" before its first state). A
  number is counted in five bands of its own readings (`bands`, from the
  readings kept, not the events). **Ours:** a signal reading `unknown`,
  `unavailable` or nothing is neither counted nor scored (Stamina counts it):
  Home Assistant starting would otherwise make every detection then rare, and
  two months from before a signal was chosen made every value since look
  rare. A model saved with other signals is learned again.
- **Said:** in a mark's sentence ("…, and with House alarm armed away"), in
  Why ("House alarm · Armed away · rarer than chance"), on Devices ("Learned
  with House alarm (64 changes since …) and Josh (…)"), and in What it has
  learned, per kind, a list per signal (what it stood at, with its share).
- **Checks:** sampling numbers; recording, with the state when chosen; the
  recorder's history once, back to the first change; the prune; learning and
  scoring an alarm armed against one always disarmed; unavailable says
  nothing; a model saved with other signals not taken; the picker leaves out
  equipment talking about itself.

**Not in it:** Stamina's per-camera signals counted without being chosen (a
camera's floodlight, siren and day/night state); they can be picked as
signals of the house instead.

**Hardware checklist (the owner, v0.50.0):** Settings → Reolink Viewer →
Configure → "House-wide signals to learn with": a few that say something
(anyone home, the alarm, a lock or gate, the outside light level); after a
minute, Devices → Learning what is normal says "Learned with …"; a camera's
What it has learned shows what each stood at; over the next days, the marks
a day, and any mark that names a signal.

#### Step 8.4: for automations

- **An HA event, `reolink_viewer_unusual`**, carrying the camera's device id,
  the kind, the score, the sentence and the start. It fires when a live
  detection scores as unusual.
- **A binary sensor per camera, "Unusual activity"**, on for the event's
  length.
- **Device triggers**, so the automation editor offers both.
- The user guide gets an example: notify only on unusual events.

**As built (v0.51.0), the owner's go-ahead ("Proceed with step 4"):**

- **Scored live** (`unusual/live.py`, `UnusualWatch`): the journal tells it
  of each detection change as it records it; a kind that can be marked (not
  motion) is scored when it begins and again when it ends, from the journal
  as the panel scores it (written first, so what fired just before counts),
  against the night's model. **Ours:** an event still going says nothing of
  its length (Stamina's "open" bucket was rare, so every live event would
  have stood out by it); one that lasts longer than usual can stand out at
  its end, and is said then.
- **`reolink_viewer_unusual`** on the bus, once per incident (the same kind
  on several cameras within a minute, as in the panel): `device_id` (the
  camera's), `camera` (its name), `kind`, `score`, `line`, `reason` (the
  sentence) and `start` (ISO).
- **"<Camera> unusual activity"**, a binary sensor per camera with
  detection sensors: on from the mark until 30 s after its detection ends
  (at the latest 5 min 30 s after it began), with the last mark's kind,
  reason, score, line and start as attributes; every camera in the incident
  turns its own on; unavailable while learning is off. **On Reolink Viewer's
  own device** (a service device): in this Home Assistant a device belongs to
  one config entry, so the cameras' devices (Reolink's) cannot hold it; a
  `DeviceInfo` with their identifiers made a second device of each.
- **Device triggers:** on that device, "Something unusual seen on <camera>"
  per camera (the event, matched on the camera's device id); the sensors'
  own "turned on" triggers come with them.
- **Measured:** a live check reads the last hour and six minutes of the
  journal: 2–4 ms on the owner-shaped copy here (about 15 ms on the
  owner's host), so the event fires well within the 2 s.
- **Checks:** said once as it begins, its sensor on until the hold after it
  ends; one incident on two cameras said once, both on; lingering said at
  its end, the ordinary never, motion and a model not yet built never; the
  journal tells its listeners; an event still going says nothing of its
  length; the sensor on Reolink Viewer's device, its trigger listed and an
  automation on it run by the camera's event only; unavailable with
  learning off.

**The owner's check (2026-11-05, v0.52.0, Devices → Learning what is
normal):** 2.6 marks a day at Balanced, steady (18 in 7 days, of 15,004
events; the cap cut none, its line "the floor, 0" as 0.49.0 words it); six of
seven cameras mark (Laundry Room: 62 detections, 139 short, about four weeks
at its rate); by kind animal 6, vehicle 5, person 4, package 3; what stood out
most: how long 9, the time of day 5, what it was 3, the light 1. Learned at
the update's restart: 14.47 s, 4.94 s computing (each update relearns: a
model saved by another version is not taken, so the nightly line shows only
on a day without an update). The file 2.1 MB with its write-ahead log (1.5 MB
an hour before; the log is folded back in at its checkpoint). No
notifications yet: none is sent without an automation, which the owner had
not made; the user guide's example is the way.

**Hardware checklist (the owner, v0.51.0):** Settings → Devices → Reolink
Viewer: a "… unusual activity" sensor per camera; an automation from the
user guide's example (a notification on "Something unusual seen on …");
over the next days, the notifications against the panel's marks (each mark
said once; anything said that the panel does not mark, or the reverse).

**Exit criteria:**

- After 7 days on the owner's cameras, every camera past its minimum marks
  events.
- "Balanced" gives 2–8 marks a day across the property (Stamina: 4 across nine
  cameras), each with its sentence.
- Scoring an event takes under 10 ms, and a 90-day rebuild under 2 s, on the
  x86 host.
- The journal grows less than 10 MB a month (v0.46.0: 11 MB on the owner's
  7 cameras; v0.46.1's bursts are to bring it under).
- With the option off there is no file; removing the integration deletes it
  (tested).
- The HA event fires within 2 s of the sensor.

**Risks:**

- **It learns bad habits:** spiders every night become normal. The "What it
  has learned" view is the check.
- **A person passing three cameras is three events**; grouping them into one
  arrival is not built.
- **A new car stands out for a fortnight**, as it does in Stamina.

---

## Phase 9 — The Wall: the Live page as a security monitor (difficulty: Standard / High, 2–3 wk)

Goal: **the Wall**, a live screen like the NVR's HDMI output: feeds only,
large, arranged by the owner (PLAN.md §6.3). The owner named it "Wall" on
2026-11-02 (decision 1).

| Step | Status |
| --- | --- |
| 1. The Wall, its layouts, saved | Built (v0.52.0) |
| 2. Arranging, pages and tours | Built (v0.53.0); the owner's check passed (2026-11-05) |
| 3. HD in large tiles | Built (v0.54.0); the capacity test run (2026-11-06): 9 streams, 2 HD tiles per NVR (v0.54.1); the owner's check passed (2026-11-09) |
| 4. The detection strip and instant highlights | Built (v0.55.0), with the owner's ask: a layout may leave out the feeds' floodlight and siren buttons; the owner's check passed (2026-11-10) |
| 5. Kiosk touches, and the Wall as a dashboard card | Built (v0.56.0); the owner's check passed (2026-11-10) |

#### Step 9.1: the Wall, its layouts, saved

- **A switch on the Live view between Board and Wall** (decision 1),
  remembered per device. Board is today's view.
- **An address per saved layout** (`#wall/<layout>`), so a kiosk's start page
  (Fully Kiosk on the wall tablet) opens a layout directly.
- **The Wall shows feeds only, fitted to the screen:**
  - rows sized from the screen's height as well as its width, with no page
    scroll;
  - the band shrinks to a thin bar with the clock, the layout's name and an
    exit;
  - browser full screen where the browser allows it.
- **Layouts:** Auto (the board's packing by shape), 1, 2×2, 3×3, 4×4, 1+5 and
  1+7. A square or portrait camera in a cell keeps the board's rule: its
  picture's sides are never cropped.
- **Saved layouts (decision 2):**
  - named layouts per HA user, kept on the server (a `wall/layouts` command
    and store, like `events/seen`);
  - each device remembers which one it shows;
  - a layout holds the grid, the camera in each cell, the pages and the tour.

**As built (v0.52.0), the owner's go-ahead ("Proceed with Phase 9"):**

- **Board and Wall:** "Wall" on the board's head; "Board" on the Wall's bar.
  Each device remembers which it shows (`rv-live-mode`) and the layout
  (`rv-wall-layout`): Live (no address) opens what it showed last.
- **`#wall` and `#wall/<id>`:** the Wall, and a saved layout by its id (a slug
  of its name, unique per user); an id not saved shows every camera and says
  so.
- **Feeds only, fitted:** the panel's band goes; a 40 px bar holds the
  layout, the clock, Layout (the editor), Full screen (the browser's, where it
  has one) and Board. The cells fill the rest of the window's height and
  width, nothing scrolls (desktop, tablet and phone sizes measured in the
  preview).
- **Layouts:** Auto packs every camera by shape as the board does (a square
  camera two rows tall, a panorama two columns wide), in the columns that
  show a 16:9 picture largest in the space; 1, 2×2, 3×3, 4×4, 1+5 (the large
  slot 2×2 of 3×3) and 1+7 (3×3 of 4×4). Each picture keeps the board's rule
  (`wallFit`): cropped at the top and bottom to fill, never at the sides.
  More cameras than cells: the bar says how many (pages are step 2).
- **Saved layouts:** `reolink_viewer/wall/layouts`, `…/save` and `…/delete`,
  per Home Assistant user (`wall.py`, `WallStore`, like `events/seen`): a
  name (60 characters at most), a grid, the camera in each cell (none: every
  camera in the board's order; arranging is step 2) and a tour's seconds
  (step 2); 50 at most. The editor (Layout ⌄): a name, the seven grids as
  pictures (the screen previews the choice), Save, Save as new, Delete.
- **Tiles:** the board's, on their sub stream, numbered as on the board; one
  full screen pauses the others.
- **Checks:** the grids, packing by shape, sizes and fit; the store (ids,
  renames, limits, per user, kept across a restart, what no longer reads left
  out) and its commands (another user sees nothing; errors said); the Wall
  (a saved layout's cells, the large slot first, empty cells; every camera;
  a layout not saved; more cameras than cells; save, save as new, delete; the
  bar's layout and Board, remembered); the board's Wall button; the panel
  opening the Wall on a device that showed it, without the band; the
  accessibility check on the Wall and its editor.

**Hardware checklist (the owner, v0.52.0):** on the desktop: Live → Wall,
All cameras fills the screen with no scroll; Layout ⌄ → a 3×3 named, saved;
on the wall tablet (signed in as the same user): the layout is listed, and
`#wall/<id>` as Fully Kiosk's start page opens it; the board and the Wall each
remembered after a reload.

**The owner's check (2026-11-05, v0.52.0):** "Wall view works and looks good,
nothing to scroll." The rest of the checklist (a saved layout on the wall
tablet, `#wall/<id>` as Fully's start page) not yet reported.

#### Step 9.2: arranging, pages and tours

- **Swapping:** drag a tile onto another to swap the two.
- **The large slot:** a double-click or double-tap puts a tile in the large
  slot (in 1+N), or alone on the screen and back.
- **Keyboard:** arrow keys move the focus, a modifier with an arrow swaps,
  Enter puts the tile in the large slot. Each move is announced to screen
  readers.
- **Pages:** more cameras than cells make pages, with arrows and a page
  count.
- **A tour per layout:** the next page every N seconds. While a tour runs,
  warm cameras keep playing; a cold camera shows its picture until its video
  starts.

**As built (v0.53.0):**

- **The order:** a layout's cameras in order, by id, `null` for an empty
  cell (`wall/arrange.ts`); none is every camera in the board's order, made
  explicit at the first move. A move on a saved layout is saved at once
  (`wall/layouts/save` with its id); on All cameras it holds until the page
  is left, and the bar says to save it as a layout to keep it. Saving a new
  layout keeps the order arranged.
- **Swapping:** drag a tile onto another (HTML drag and drop; the dragged
  cell is kept too, for a WebView that drops the data), or **Arrange** in the
  bar and tap a camera, then where it goes (a tap target over each cell, the
  picked one ringed): the way on a touch screen. A camera goes into an empty
  cell as well.
- **The large slot:** a double tap or Enter puts a camera in 1+N's large
  slot (it swaps with the one there); in any other grid, alone on the screen,
  and back by a double tap, Escape or **Back to the layout** in the bar.
- **Keyboard:** each cell is a group (`role="group"`, "Wall cell", named
  "Doorbell, cell 1 of 4"), one in the tab order at a time; the arrows move
  to the next cell that way (`neighbour`: the nearest overlapping one, so a
  large slot's neighbours are the cells beside and below it), Shift with an
  arrow moves the camera there, Enter enlarges, Escape returns, Page Down and
  Page Up turn pages. A tile's own buttons keep their keys. Each move is said
  in a polite live region ("Front Yard swapped with Garage.", "Page 2 of
  3.").
- **Pages:** a fixed grid shows its cells' worth a page (Auto fits every
  camera on one); the bar's ‹ 1 / 2 › turns them.
- **Tours:** "Tour" in the layout's editor: off, or the next page every 10 s,
  20 s, 30 s, 1 or 2 minutes, round to the first; paused while arranging,
  editing, one camera alone or full screen. Tiles are the board's, so a warm
  camera plays at once and a cold one shows its picture until its video
  starts.
- **Checks:** the order, swaps into empty cells, the cell beside another
  (the large slot's too); the Wall: pages by hand and on a tour (paused while
  arranging), the keyboard's moves and a Shift move saved with the layout,
  Enter into the large slot, alone and back three ways, a drag, Arrange's
  taps (All cameras not saved); the accessibility check on Arrange too.

**Hardware checklist (the owner, v0.53.0):** on the desktop, drag a tile onto
another; on the wall tablet, Arrange and tap two; a double tap in 1+5 and in
3×3; a layout of more cameras than cells, with a tour, left running an hour
(no empty tile); the order the same on the other device after a reload.

**The owner's check (2026-11-05, v0.53.0):** "approved and validated", the
checklist above, then the go-ahead for step 3.

#### Step 9.3: HD in large tiles

- **Which tiles:** a tile larger than its sub stream's own size, or the large
  slot of 1+N.
- **How:** HD plays through the full-screen swap: the sub stream plays until
  HD's first frame.
- **Within the host's live budget:** one HD per NVR today (7 = 6 warm subs and
  1 HD).
  - First, the capacity test runs with 2–3 HD streams open, to see whether the
    budget can rise.
  - A tile denied HD stays on SD and says so in its debug view.
- **The per-device choice (v0.33.0)** applies: SD away from home, unless chosen
  otherwise on that device.

**As built (v0.54.0), the owner's go-ahead ("approved and validated, proceed"):**

- **Which tiles** (`wall/hd.ts`, `tilesInHd`): the large slot of 1+5 and 1+7, a
  camera alone on the screen, and a tile that draws its sub stream larger than
  its own size in the screen's pixels (`subScale`: the cell over the sub
  stream's configured size, times the device pixel ratio; filling the cell, the
  larger of the two; whole, the smaller). Not a camera without a main or ext
  stream, nor one on its battery (it plays when tapped). The large slot first,
  then the most enlarged, then the cells' order.
- **Within each host's budget:** live/cameras gives each connection its host (a
  key that names nothing: `opaque_key(entry_id, None)`) and `hd_tiles`, the HD
  tiles that host plays at once (v0.54.0: 1, the NVR's 7 being six subs and
  one main; v0.54.1: `NVR_TILE_HD_STREAMS`, 2, after the capacity test, and 1
  for a camera added directly). The rest stay on SD; each tile's ⓘ view says
  why ("Wall tile: SD: RLN36 plays 2 HD tiles at once, and Garage, Dogs have
  it", "SD: the tile is no larger than its sub stream (640×360)").
- **How:** the tile (`tileHd`) plays HD through full screen's swap, the sub
  stream until HD's first frame, and says **Live HD**. Away from home (the
  per-device choice, as full screen's) it stays on SD and says so.
- **Spare slots** (ours): HD in a tile is a nicety over the sub stream already
  shown, so it never makes another stream wait. `live/webrtc` and `live/mse`
  take `spare`; the scheduler's `request_spare` grants a slot only when one is
  free and nobody waits, and the moment a live or playback stream waits for a
  slot (not prefetch) it asks the newest spare stream back (`on_yield`): the
  registry ends its holders (the MSE feed, the WebRTC session), which tell the
  browser "gave its stream slot back". A refused spare is refused at once,
  before the camera is asked for its address. A stream also held otherwise
  (full screen of the same camera, keep warm) keeps its slot, until only spare
  holders are left (the registry's holds, and a feed's viewers): then it is
  spare again (`lend`). Refused or given back, the tile stays on SD for a minute
  (`TILE_HD_RETRY_MS`), then asks again; in full screen it retries as any stream
  does, no longer spare, and back in the tile it asks again, spare. So the
  Wall's HD can never stall a recording, a full screen or another screen's
  tiles.
- **The capacity test** takes `mains` (1–3): the heaviest mains that play on
  their own, one more per level (`report.mains`: asked, playing); the live check
  offers it ("Full-resolution streams in it").
- **Checks:** spare slots in the budget (only free ones, newest asked back
  first, one per stream waiting, never for prefetch, kept when held otherwise);
  in the registry (refused before the camera is asked, ended when needed, a
  spare joining a running stream takes none); a spare MSE feed (ended with the
  reason; kept once a viewer who is not spare joins); a spare WebRTC session
  (refused when full, given back when a slot is needed); spare again once the
  holder that was not spare leaves (a hold, a feed's viewer); live/cameras' host and
  `hd_tiles`; the capacity test with 2 mains (and the schema's 1–3); which
  tiles get HD (scale, the large slot first, per host, none without an HD
  stream or on a battery); the tile (HD in place on a spare slot, swapped in,
  Live HD; back to SD when smaller; refused, SD for a minute with why, then
  again; full screen keeps it, no longer spare, and its SD button holds; back
  in the tile, asked for again, spare; SD when chosen on the device);
  the Wall (the large slot in HD, the others' reasons, a 4K screen, the large
  slot after a double tap).

**Hardware checklist (the owner, v0.54.0):**

1. The capacity test with 2 and then 3 mains (Devices → Live check, the NVR
   capacity test ticked, "Full-resolution streams in it": 2, then 3), at home:
   send the report. If every level keeps up with 3, the HD tiles can rise.
2. On the desktop, a 1+5 layout: the large tile says **Live HD** (its ⓘ:
   "Wall tile: HD: the large slot"), the others SD with why.
3. With it showing, open a recording on the Events page (or full screen on
   another screen): it plays at once, and the large tile drops to SD for a
   minute (its ⓘ: "HD not given: … gave its stream slot back").
4. The tiles' first pictures stay quick (Phase 3's 0.02 s) with the large tile
   in HD.

**The owner's capacity test (2026-11-06, v0.54.0, the desktop on the LAN):**

| Run | Mains asked | Levels | Verdict |
| --- | --- | --- | --- |
| 1 | 2 | 6 subs; Back Yard main (0 of 20 fps, no first frame); Garage main (30/30 fps, first frame 0.82 s); a download (310 Mbit/s, 267 alone) | "level 7 fails": wrong, see below |
| 2 | 3 | Back Yard main left out (no frame in 15 s on its own); 6 subs; Garage, Dogs and Front Yard Left mains (6 Mbit/s each, every one at its rate); a download (368 Mbit/s, 309 alone) | every level kept up: 10 streams at once |

- **Run 1's verdict was the camera's, not the NVR's:** the Duo 3's 16 MP main
  (run 20's) sent a first frame on its own, then nothing at its level, while
  Garage's main, added after it, played at 30 of 30 fps: the NVR had room.
  v0.54.1: a stream that sent no video while one added after it played is left
  out of the verdict (`silent_streams`, `report.no_video`) and said apart ("…
  the camera's, not RLN36's limit"); "kept up with N" leaves it out.
- **The budget rises:** six subs, three mains and a download kept up (10), so
  by Phase 3's rule (one fewer for headroom) `NVR_STREAM_BUDGET` is 9. **The
  owner's choice:** two HD tiles per NVR (`NVR_TILE_HD_STREAMS`), keeping the
  third slot beyond the six subs for a full screen or a recording without
  taking an HD tile back. One run of three mains, so the next ones confirm it.

**The owner's check (2026-11-09, v0.54.1):** "Validated both bullets function as
intended": two tiles say Live HD and the others' ⓘ says why; a recording opened
while they show plays at once.

#### Step 9.4: the detection strip and instant highlights

- **The strip:** along the bottom, one card per camera with its latest
  detection: the thumbnail, the pictogram and type, the time, "New" in red,
  and "Unusual" once Phase 8 is built. A tap opens the recording.
- **`events/latest`:** the newest event per camera, from today, else from its
  newest cached day.
- **Instant highlights:**
  - a tile lights up (an outline and the type) while its camera's detection
    sensor is on, read from `hass`, so at once;
  - the strip is asked again when a sensor turns off, not only every 2
    minutes.

**As built (v0.55.0), the owner's go-ahead ("Proceed with step 4"), with their
ask: options to leave out the floodlight and siren buttons on the Wall's feeds
(per layout, the owner's choice of four):**

- **`events/latest`** (`events.async_latest`): each recording camera's newest
  event, newest first, with `new` as `events/recent` has it: today's, searched as
  the timetable's is (`max_age`, `background`); else, when today has none or
  cannot be searched (listed under `failed`), the newest of a day kept here
  (`TimelineService.async_newest_cached`: the memory and the store, no search).
- **The strip** (`rv-wall-strip`): along the Wall's bottom, a card per camera
  with something to show, newest first: the recording's thumbnail, the
  pictogram and type, the camera's number and name, the time (a date too for
  another day), **New** in red until opened (a tap marks it, as the timetable
  does), and **Unusual** when `unusual/marks` (over the cards' window, 7 days at
  most) marks it. A tap opens the recording at its start. Asked every 2 minutes,
  and on a detection's end at once and 20 s later (the camera lists it once it
  ends). It scrolls sideways when the cameras outnumber the screen; the cells
  above fit what is left.
- **Instant highlights:** `live/cameras` gives each camera its detection sensors
  (`detection`: entity id → the event type each stands for, from Stamina's
  subjects: PERSON, VEHICLE, ANIMAL, …). While one is on in `hass` (no request),
  the camera's Wall tile has a red frame and says what (`detecting`), the cell's
  name says "now: Person", and the strip's first card is **Now** with the
  camera's latest picture; a tap shows that camera large (full screen, or alone
  if not on the page). That is the exit criterion's "within 2 s of its sensor":
  at once. When it turns off, the strip asks again.
- **What a layout shows** (the owner's ask): `floodlight`, `siren` and `strip`,
  kept with the layout (true unless said, so a layout kept before shows all), as
  **Show** in **Layout ⌄** (Floodlight buttons, Siren buttons, Latest
  detections), previewed while editing. A feed without them keeps its other
  controls (PTZ, presets, zoom); in full screen from the Wall too. **All
  cameras** shows all.
- **Checks:** the newest event (today's; a kept day's when today fails, with no
  search of past days; refused when incompatible or not loaded); the detection
  sensors in `live/cameras`; the layout's three switches (kept, checked, saved);
  the strip (New and Unusual, the thumbnail, a tap opening the recording and
  marking it seen); a sensor on lighting its tile, the cell's name and a Now card
  first, a tap on it going full screen, its end asking again; a layout without
  the buttons or the strip; the accessibility check on the Wall with a lit tile
  and the strip.

**Hardware checklist (the owner, v0.55.0):** on the wall tablet, the Wall's
strip shows each camera's newest detection; walk in front of a camera: its tile
lights up at once with what it sees, a Now card leads the strip, and within a
minute of leaving its recording takes the card's place; tap a card: its
recording opens; in Layout ⌄, untick Floodlight and Siren buttons, Save: the
feeds lose those buttons (on the tablet too after a reload), the PTZ pad stays.

#### Step 9.5: kiosk touches, and the Wall as a dashboard card

- **Kiosk touches:** keep the screen awake (under Fully Kiosk, Fully's own
  settings, as in Phase 7); hide the cursor after 3 s of no movement; a clock
  in the bar.
- **The Wall as a dashboard card:** `custom:reolink-viewer-wall` shows a saved
  layout. It is built on Phase 7's card.

**As built (v0.56.0), the owner's go-ahead ("Proceed with step 5"):**

- **The pointer** hides after `IDLE_CURSOR_MS` (3 s) without moving, over the
  Wall and everything on it (the Wall sets `--rv-pointer: none`, which every
  `cursor: pointer` reads, through the tiles' shadow roots), and shows again on
  the next move.
- **Keep the screen awake:** the browser's Screen Wake Lock while the Wall
  shows, taken again when the page is shown again (the browser lets it go when
  hidden) and let go when the Wall goes. Where the browser has none (Android's
  WebView, a page over plain http) nothing; under Fully Kiosk, Fully's own
  settings, as Phase 7 decided.
- **Under Fully Kiosk** (its JavaScript interface on): the Wall's tiles sleep
  while Fully's screen is off or its screensaver on, as the cards do
  (`tablet.listenToFully`: Fully's events without the cards' log).
- **The clock in the bar** was built in step 1.
- **`custom:reolink-viewer-wall`** ("Reolink Wall" in the card picker), in the
  cards' module beside the camera card (9.1 KB on every page, was 8.2; budget
  12): a saved layout's id (`layout`; none: All cameras) and `show_bar`. Its
  body (`card/wall-card.ts`, fetched when a Wall card is first shown: 65.4 KB
  with the home view's files it shares, `npm run budget` holds it under 100
  KB) is the panel's Wall in card mode (`card`): the layout it is given and no
  memory on the device, a short bar (the layout's name, pages, the clock, full
  screen) or none, no arranging or editing (done in the panel); what a tap
  opens (a detection's recording) opens in the panel (`card/panel.ts`, shared
  with the camera card). 16:9 in a masonry view, the dashboard's width and
  eight rows in a sections view. Its editor (`card/wall-editor.ts`): the
  user's layouts, and the bar; a layout id not the user's is kept and said.
- **Checks:** the card's settings (defaults, kept, refused in plain words), the
  card picker, its size; card mode (the layout's tiles, the short bar, nothing
  remembered, every camera without a layout, one not the user's said, no bar),
  a tap opening the panel; the editor (layouts, the bar, a layout not the
  user's, YAML only); the pointer hidden after 3 s and shown on a move; the
  wake lock taken and let go, not under Fully; the tiles asleep while Fully's
  screen is off; the dashboard in the design preview, with a Wall card and its
  editor, under axe and the keyboard.

**Hardware checklist (the owner, v0.56.0):** on the desktop, the Wall: the
pointer goes after 3 s still (over the feeds too) and comes back on a move;
with the page open over https (Nabu Casa), the screen does not sleep while the
Wall shows. On the wall tablet (Fully's JavaScript interface on), the Wall or
a Wall card showing: start Fully's screensaver, or turn its screen off, from
Fully's Remote Admin (or its screensaver timer set to a minute for the test):
the video stops, and plays again within a few seconds when it ends. The 11 pm
night page is not this test: it replaces the page, so everything on it stops
anyway. The Wall does not write to Devices → Dashboard cards (only camera cards
do): a Reolink camera card on the same page puts Fully's screen events and its
own frames stopping there, and the Wall's tiles follow the same events. A
dashboard: Reolink Wall in the card picker, a layout chosen, the card shows
it; a tap on a detection opens its recording in the panel.

**Exit criteria (the owner's desktop and the wall tablet):**

- A 3×3 of every camera fits the screen with no scroll.
- Layouts and swaps survive a reload, and show on another device signed in as
  the same user.
- With the large tile in HD, the NVR stays within its budget (the capacity
  test), and the tiles' first pictures stay at Phase 3's median of 0.02 s.
- A one-hour tour over warm cameras never shows an empty tile.
- The strip shows a new detection within 2 s of its sensor.
- Everything works from the keyboard, and axe passes.

**Where they stand (v0.56.0):** a screen of every camera with nothing to
scroll (the owner, 2026-11-05); layouts and swaps across a reload and a second
device, and the hour's tour (the owner's v0.53.0 check, "approved and
validated"); the budget (the capacity test of 2026-11-06: 10 streams kept up,
the budget 9 with two HD tiles) and the first pictures (that day's live check:
0.02 s median); the keyboard and axe (CI, every view). The strip's 2 s is met
by design (a Now card from the sensor, at once), and the owner's v0.55.0
check passed with step 5's checklist above.

**Phase 9 is done (2026-11-10):** the owner validated both checklists
(v0.55.0: the strip, a tile lit at once, a card's tap, the Show switches;
v0.56.0: the pointer, the screen kept awake, Fully's screen off, the Wall
card), and every exit criterion is met.

---

## Phase 10 — Scrubbing that shows the picture (difficulty: Very high, 2–4 wk)

Goal: holding the pointer down and dragging along the timeline shows the
recording at the pointer, continuously, as UniFi Protect and Nest do. Release
plays from there, which has been fast since Phase 5. The design is in PLAN.md
§6.2: key frames from the browser's buffer, then HA's disk cache, then a short
download cut, then the thumbnail.

| Step | Status |
| --- | --- |
| 0. Measure first (the gate) | Built (v0.57.0). **The gate passes** (2026-11-10): a cut's key frame in 166–182 ms back to back on all six cameras, and a key frame decoded in 1.7 ms on desktop Chrome; the iPhone app's and the wall tablet's K rows still to come (they choose step 2's way of painting, not whether step 1 is built) |
| 1. Key frames from the server | Built (v0.58.0–v0.58.1); the owner's check passed on desktop Chrome (2026-11-10); the iPhone app's and the wall tablet's still to run |
| 2. Painting while dragging | Built (v0.59.0–v0.59.1: 0.59.0's drags were never answered); the owner's check to come |
| 3. Press and release | Not started |
| 4. The checks | Not started |
| 5. Optional: storyboards | Not started; only if step 0's gate fails |

#### Step 10.0: measure first (the gate)

Added to the probe's Reolink protocol section and to the playback check:

- **Key frames:** their size and interval per camera, sub and main.
- **Scrub cuts:** time to the first key frame of a 2-second cut at 20 points
  through uncached hours, sub stream:
  - one at a time;
  - back to back, as a drag asks;
  - beside a playback cut running on the same channel (5c step 5's turns).
- **Decoding in the browser:** `VideoDecoder` support, and the time to decode
  one key frame per codec, on Chrome, the iPhone app (WKWebView) and the wall
  tablet (Fully Kiosk's Android WebView).

**Gate:** a median cut of 300 ms or less back to back, and decoding in 30 ms
or less → step 1. Otherwise → step 5.

**As built (v0.57.0), the owner's go-ahead ("proceed with Phase 10"):**

- **Scrub cuts** (`probe_scrub.py`, the probe's Reolink protocol test, a box
  of its own, "Scrub cuts"): on each sub recording the test finds, 2-second
  cuts (143, then 144 once its key frame is in) at 20 moments from 5 % to
  95 % through it, on one login and one stream slot of their own, asked
  - one at a time (a second's pause after each end);
  - back to back, the next asked as soon as the last one's key frame came;
  - beside a playback cut of the same channel, taking turns as Phase 5c's
    cuts do: the playback cut runs 2 s, ends its span (144), the scrub cut
    runs, and the playback cut asks again from the newest key frame it had;
    how long it went without data is its `without_data_ms`.

  Each set asks moments of its own (a third of the spacing apart), so the
  device's read cache helps none. A cut's time runs to its first key frame
  within 10 s before or 5 s after the moment asked, by the key frame's own
  clock (in the device's zone, as deep starts read it): a key frame of the cut
  before, still arriving, counts as `stale`.
  Each set reports the key frames' times (min, median, p90, max, and each),
  the replies and ends, how far each key frame is from its moment, and, back
  to back, how many a second; `gate` gives the back-to-back median against
  300 ms.
- **Key frames:** the stream analysis keeps each key frame's size
  (`key_bytes`) and the median interval between them (`key_interval_s`), in
  every stream's `media.video` (replay and download, sub and main).
- **Decoding in the browser** (the playback check, v0.5.0, a K row after S,
  and one for HD inside H): 20 s of the playing recording's fragments from
  the play position, the same MSE path the player uses, read for their key
  frames (`playback/keyframes.ts`: the init's avcC or hvcC, each fragment's
  sync samples); each decoded on its own with WebCodecs' `VideoDecoder` and
  flushed, as a scrub would (at most 12), from `decode()` to its frame, then
  drawn on a canvas. It reports the key frames' count, interval and sizes,
  the median decode after the first (the first, with the decoder's start,
  apart), the drawing, and the gate's 30 ms; without `VideoDecoder`, that the
  MSE fallback would be used.
- **Checks:** the scrub cuts against a fake client whose cuts send key frames
  on a timer, with the cut before's leftovers first (the three sets, stale
  frames, the gate, a cut without a key frame, the any-channel bitmap, a lost
  connection, a playback cut without a key frame), and through the probe (sub
  only, its slot given back); the key frames read from the sample clip and
  from built fragments (sync samples, trex defaults, another track, offsets
  into a file); decoding with a stand-in decoder (each timed, the cap, slow,
  refused, failing, absent); the check's K row with and without WebCodecs.

**Hardware checklist (the owner, v0.57.0):**

1. **The probe** (the panel's Devices → Hardware probe): tick **Test
   replay over the Reolink app's own protocol**, **Only this test**, and
   **Scrub cuts**; leave the cameras empty (every camera of the NVR, up to 8)
   or name a few; run with the live board closed (a stream slot is needed).
   Download the report: each camera's `sub.scrub`.
2. **The playback check** on LAN Chrome, the iPhone app and the wall tablet
   (Fully Kiosk): a camera's Playback tab → Details and playback check → Run
   playback check, with HD on Chrome. Copy the report: its K lines (SD, and
   HD inside H).

**The owner's probe run (2026-11-10, v0.57.0, RLN36, all six cameras, sub
streams).** The first try stopped at once ("not a valid option ...
'baichuan_scrub'"): Home Assistant had not restarted since the update, so the
new panel asked the old server. After the restart (time from a cut's 143 to
its first key frame near the moment, median and p90, ms):

| Camera (sub) | Key frames | One at a time | Back to back | Beside playback | Playback cut without data (median, p90) |
| --- | --- | --- | --- | --- | --- |
| Back Yard (Duo 3, 1536×432) | every 4 s, 23 KB | 181, 219 | **173**, 248 | 171, 221 | 448, 1152 |
| Garage Camera (RLC-520A, 640×480) | every 4 s, 38 KB | 185, 236 | **171**, 232 | 165 (3 cuts) | 1023 |
| Hallway Camera (E1 Pro, 640×360) | every 4 s, 34 KB | 194, 204 | **170**, 198 | 160, 208 | 366, 972 |
| Front Yard Right (CX410, 640×360) | every 1 s, 43 KB | 182, 210 | **172**, 218 | 162, 197 | 367, 707 |
| Dogs (RLC-520A, 640×480) | every 4 s, 86 KB | 167, 198 | **166**, 213 | 166, 193 | 445, 504 |
| Front Yard Left (CX810, 640×360) | every 4 s, 16 KB | 203, 294 | **182**, 242 | 180, 219 | 797, 5296 |

- **The server's half of the gate passes on every camera:** back to back, the
  median is 166–182 ms against 300 ms, the p90 198–248 ms. A drag would get
  a new picture every 170–220 ms uncached, inside the exit criterion (300 ms).
  Taking turns with a playback cut costs the scrub nothing (160–180 ms).
- **Where the picture lands:** each cut's first key frame was 3 s before to 2
  s after its moment (the interval is 4 s on five cameras, 1 s on the CX410),
  so a scrub's picture is within one interval of the pointer, as planned.
- **Not every cut answered:** 13 of 343 sent no key frame near their moment
  within the probe's 5 s (what came instead is not recorded); one took 1.8 s
  (Garage, back to back). Step 1 gives a cut up about 1 s after asking and
  lets the next move ask (newest wins), rather than wait.
- **A playback cut of the same channel** went without data a median 0.37–0.80
  s per scrub cut (p90 up to 1.15 s), and about 5.3 s where the scrub cut did
  not answer (the probe's wait). Step 1's cut gives the turn back within its
  1 s, whatever comes; a viewer playing has 30 s and more buffered.
- **Garage:** the channel's own bit was refused once (the any-channel bitmap
  then served), and a cut was refused (400) after 3 turns beside playback,
  which ended that set. Its longest recording is an 18-minute clip (motion
  recording): not explained yet, to watch in step 1.
- **The NVR:** 3 logged-in users during the cuts, 2 before and after: one more
  login, within the exit criterion.
- **Key frames:** 16–86 KB on the sub streams, so a scrub's picture is a small
  read on the LAN.

**The owner's playback check (2026-11-09 21:11 local, v0.5.0, Desktop Chrome
156 on Windows, 2560×1440, Front Yard Right, SD; HD not ticked):**

- **K:** 21 key frames in 20.0 s of media, one a second, 38–41 KB (median 41
  KB), at 640×360; `VideoDecoder` decodes one in **1.7 ms** (median of 11; the
  first, with the decoder's start, 4.4 ms), drawn on a canvas in 0.1 ms. The
  browser's half of the gate (30 ms) passes many times over.
- The rest as before: S showed 5 of 5 buffered points (median 8 ms), deep
  starts 0.86 s uncached from the cut and 0.39 s cached, events 0.13–0.88 s.

**Verdict: step 1.** Both halves pass on the LAN desktop. The iPhone app
(WKWebView) and the wall tablet (Fully's Android WebView) are still to run K:
`VideoDecoder` there, or not, decides how step 2 paints (WebCodecs, or the
hidden MSE video), not whether the server serves key frames (step 1).

#### Step 10.1: key frames from the server

- **The request:** a scrub session per viewer over a signed websocket, like
  live MSE's. The browser sends the time under the pointer; the server answers
  with the key frame at or before it, as one access unit with its parameter
  sets (or a one-sample fMP4) and its own time.
- **Where a key frame comes from, in order:**
  1. **The disk cache:** the original or a cut file, through
     `FragmentIndex`'s sync fragments. A file read, with no device I/O.
  2. **A scrub cut:** a 143 cut from one key-frame interval before the time
     to 1 s after it, ended (144) at its first key frame, and muxed by
     `BaichuanMuxer`.
     - It is a scheduler job at playback priority.
     - It takes its channel's turn like any cut (5c step 5), and never stops a
       playback cut.
  3. **`snapshot_past`**, for a device that refuses the protocol.
- **Keeping it light:**
  - one request in flight per viewer, the newest wins, and older ones are
    cancelled;
  - key frames found are kept in a small disk LRU per camera, stream and
    second;
  - scrubbing always uses the sub stream (H.264 on every owned camera), whichever
    stream plays.

**As built (v0.58.0), the owner's go-ahead ("proceed with step 1"):**

- **The session:** `reolink_viewer/playback/scrub` {device_id, date} gives a
  signed path (10 minutes to open it) to `views.ScrubView`, a websocket for
  that camera's day. The browser sends `{"seq", "at"}` (UTC ms); the server
  answers each with one binary message (a 4-byte length, a JSON header: seq,
  at, the picture's own time, source, kind, codec, the parts' lengths; then
  an init segment of the video track alone and a fragment of that one sample,
  or a JPEG) or `{"seq", "at", "error"}` in plain words. Newest wins: a newer
  seq cancels the one in flight, which is not answered; an older one is
  ignored.
- **Where a picture comes from** (`scrub.py`), fastest first:
  1. **the scrub store:** key frames found earlier, on disk (64 MB, least
     recently used out, emptied at start), per camera; one 3 s before to 2 s
     after the moment answers it, as a cut's would (step 0's -3 to +2 s);
  2. **the disk cache** (`VodCache.async_key_frame`): the original, a copy
     at another length, or a cut, as on disk now; it never starts, speeds up
     or waits for a fill; a key frame more than 10 s before the moment is not
     taken;
  3. **a scrub cut** (`BaichuanSource.async_key_frame`): 2 s of the sub
     stream **from the moment** (not one interval before, as planned: step 0's
     cuts from the moment gave key frames 3 s before to 2 s after it), ended
     (144) once its first key frame near the moment is in, muxed and taken
     out alone (`fmp4.key_sample`). It takes the channel's turn as a cut's
     first span does, a stream slot within 1 s (never the download's), the
     host's one login, and gives up 1 s after the device's reply (13 of 343
     sent none in step 0). A key frame more than 10 s before or 5 s after the
     moment is another cut's, still arriving (`stale`), and passed by;
  4. **the thumbnail** (`snapshot_past`), where the protocol cannot be used
     (the option off, a device that refuses it).
- **A playback cut on the same channel goes on unharmed.** The device tells
  a channel's cuts apart by channel only, so the scrub cut's last blocks can
  reach the cut that resumes after it. Before handing the turn back to a cut
  that waits, the scrub lets them pass (0.3 s); and the muxer skips, in the
  first 120 blocks of a resumed span, a block whose counter steps more than
  20 s from the stream's (`foreign_skipped`; 30 in a row are the stream's own
  jump). This also covers two playback cuts taking turns (Phase 5c).
- **Always the sub stream; the day as the browser has it:** the recording is
  found in the day the timeline holds (never a new search for a scrub); a
  moment between recordings answers "no recording at that moment".
- **Seen in:** `playback/stats` gains `scrub` (pictures by source, the
  store's size), and the source's stats `scrub_cuts` (asked, answered,
  failed, stale).
- **The playback check v0.6.0, its F row:** 10 moments spread over the day's
  recorded time, asked twice: first from the disk or the device, then from
  the store; how many came, the median round trip and the sources, how far
  each picture is before its moment, and each decoded on its own
  (`VideoDecoder`).
- **Checks:** the key frame out of the muxer's output and of an NVR file
  made MSE-ready (video track alone, one sync sample; none from a fragment
  not starting with one; an un-normalized fragment refused); the store (near
  moments, the cap, a file gone); the service with stand-ins (cache then
  store, a cut of the recording, the device, its failure, the thumbnail,
  between recordings); the cache from a file of an earlier run without a
  fill, and from a cut; the scrub cut on the fake NVR (the moment in the
  device's local time, ended, its slot given back; another cut's key frames
  passed by; no key frame in time, no slot, the option off; a playing cut
  that gives way and resumes seamlessly); the muxer's leftovers skipped; a
  session end to end (cache, store, an ignored older seq, a gap, a newer
  moment cancelling one in flight); the client (newest wins, a late answer
  not taken, misses, closing, not opening); the F row.

**Hardware checklist (the owner, v0.58.0):** run the playback check on LAN
Chrome on a camera whose day is not all cached: the F row's first pass mostly
"device" or "cache", median about 0.2 s; again, all "store" in a few ms; the
pictures 0 to 3 s before their moments; every one decodes. Then the iPhone
app's and the wall tablet's checks (their K and F rows: `VideoDecoder` there or
not decides step 2's way of painting). With a recording playing on the same
camera in another tab while the check runs, it plays on without a stall.

**The owner's check (2026-11-10, v0.58.0, the playback check v0.6.0, Chrome
156 on Windows, Front Yard Right).** The first try ran the old panel (check
v0.5.0, no F row): the browser kept it after Home Assistant's restart until a
full reload. Then F: first pass 10 of 10, median **264 ms** (device 8, cache 1,
cut 1); again 10 of 10, median 168 ms, but only 4 from the store (6 from the
device again); the pictures 0.1 to 3.9 s before their moments; all 10 decode
(4.4 ms each, each with its own decoder). The rest as before (deep starts
0.77 s uncached, 0.40 s cached; K 1.8 ms).

- **Too far from the moment:** the device starts a cut a few seconds before
  the moment asked (step 0's probe: the first key frame 3 s before on the
  CX410), and v0.58.0 kept that first key frame: up to 3.9 s off on a camera
  with a key frame a second, where the plan asks for one interval.
- **Not from the store the second time:** the store took a key frame only
  from 3 s before a moment, and those pictures were up to 3.9 s before.

**v0.58.1, from it:**

- **The cut keeps the key frame showing the moment:** its key frames near the
  moment are kept as they come, until one past the moment (or the cut's end,
  or its time); the last at or before the moment is the picture, within one
  key-frame interval of it (a second on the CX410, 4 s on the others). The
  steps between them are the camera's interval
  (`BaichuanSource.key_interval_ms`).
- **The store answers as a cut would:** the latest key frame at or before the
  moment, if within the camera's interval and half a second (4 s until a cut
  has shown it); never one after the moment.
- **Checks:** a cut's key frame at the moment from media keyed every second
  (the interval learned, 1000 ms); a cut that ends, or goes quiet, before one
  past the moment keeps its last; the store's reach (one before, never after;
  a camera keyed every second asks again 2 s on).

**The owner's check of v0.58.1 (2026-11-10, Chrome 156 on Windows, Front
Yard Right): passed.** F: first pass 10 of 10, median **269 ms** (device 9,
cache 1), inside the uncached exit criterion (300 ms); again 10 of 10, median
**31 ms**, all from the store; the pictures **0.3 to 0.8 s** before their
moments, within the camera's interval (a key frame a second); all 10 decode
(4.2 ms each, each with its own decoder). Deep starts as before (0.85 s
uncached, 0.40 s cached), every rate smooth. Still to run: the iPhone app's
and the wall tablet's checks (their K and F rows decide step 2's way of
painting there), and a recording playing on the same camera in another tab
while F runs.

#### Step 10.2: painting while dragging

- **Each move:** the timeline's `rv-scrub` drives a scrub controller.
  - From the buffer as today (`preview`).
  - Otherwise it asks for the key frame and decodes it onto a canvas over the
    video, with WebCodecs.
  - Without WebCodecs, it decodes through a hidden MSE video fed key-frame-only
    fragments, where every seek lands at once.
- **What is shown:**
  - always the newest frame;
  - the time label gives the frame's own time;
  - a frame within one key-frame interval of the pointer counts as on time.
- **Hover:** hovering without a press keeps today's thumbnail.

**As built (v0.59.0), the owner's go-ahead ("proceed with step 2"):**

- **Each move** (`rv-scrub`, from a drag or the arrow keys): where the video on
  screen has the moment buffered (`RvPlayer.buffers`), it shows it as before
  (`preview`, 80 ms apart). Elsewhere, inside a recording, the scrub controller
  (`scrub-controller.ts`) asks the scrub session for it.
- **One ask at a time:** while one is answered, only the newest moment the
  pointer reached waits, and is asked next. Asking anew on every move would
  cancel each ask before its answer came (newest wins, step 1), and a steady
  drag would show nothing. A picture is shown only while the drag goes on.
- **The session:** opened at a day's first ask and reused while the day shows;
  closed when the day changes or the tab goes, and after a minute unused (the
  next drag opens it again). One that cannot open leaves the day's drags to
  the buffer, as in v0.58.
- **Painting** (`rv-scrub-picture`, in the player's new `over` slot, so it
  covers the video wherever the player is, full screen included):
  - **WebCodecs** (`KeyFramePainter`): one `VideoDecoder`, kept while the
    stream's codec, size and description stay the same; each key frame is
    decoded and flushed, drawn on a canvas, and let go. A decoder that fails,
    or gives no frame in 2 s, is replaced for the next picture.
  - **MSE** where the browser has no `VideoDecoder` (`MsePainter`, the
    browser's `ManagedMediaSource` or `MediaSource`): a video element of its
    own, its buffer holding the one picture (the one before removed, the init
    appended only when it changes), set to the picture's time. WebCodecs
    exists only in a secure context, so Home Assistant opened over plain HTTP
    (not HTTPS, not localhost) paints this way too.
  - **In Chromium** (a scratch run before the PR, the sample clips' key frames,
    H.264 and VP9, 64×64): WebCodecs decoded and drew each in 5 ms, 1 ms or
    less with the decoder kept; MSE showed each in 2 to 3 ms.
  - **A thumbnail** (the JPEG a camera without the protocol answers with) is
    shown as an image.
  - **Newest first:** a picture that comes while another is painted waits, and
    only the last of those is painted next.
- **What is shown:** the picture's own time in its corner (the dayline's clock
  is the pointer's); a picture further from the pointer than the camera's
  key-frame interval and half a second is **late** and dimmed until the next
  comes. The server now sends that interval with each picture (`interval`,
  ms: the one the cuts learned, else 4 s).
- **While dragging,** the playing video's time no longer moves the cursor (the
  pointer is the time), and the hover box above the timeline shows the time
  alone, fetching no thumbnail; without a press, hovering is as before.
- **Release** plays from the pointer as now (step 3 starts from the picture
  shown); the picture stays until the video's first frame (or 10 s, or a
  failure), so the screen goes from the picture to the video. A drag the
  browser takes (a cancelled pointer) takes its picture away at once.
- **Seen in:** Technical details' "Pictures while dragging": shown of asked,
  missed, and the last picture's source, round trip and distance from its
  moment; or why there are none (no WebCodecs nor MSE, the session not open).
- **Checks:** the controller (one ask in flight, the newest waiting, nothing
  shown after the drag, a miss, a session the server closed opened again, one
  that cannot open, closing on a new day and after a minute unused but not
  during a drag); the painters (the sample clip's key frame decoded with its
  description, the decoder kept or replaced, a JPEG or a broken picture
  refused, a failed decoder replaced, no frame in time; MSE's init once and
  each fragment alone, a new source for a new codec); the element (shown only
  once painted, newest first, late by the camera's interval, a JPEG, MSE
  without WebCodecs, neither); the tab (a drag over what is not buffered asks
  the session and paints, the cursor kept, the bare hover, release holds the
  picture until the first frame, a buffered moment from the video alone, no
  ask between recordings, a cancelled drag, the hold's limit, a session that
  cannot open); the interval in the server's message.

**v0.59.1, from the owner's first drag ("I don't believe the scrubbing slow drag
is working"):** nothing was painted. A drag's time comes from the pointer's
pixel (`xToTime`), with fractions of a millisecond; `views._scrub_request` took
only an integer `at`, so it ignored the request without an answer, and the
controller, one ask at a time, waited on it for the rest of the day. The F row
passed because its moments are rounded (`spreadMoments`), and the tab's tests
because their stand-in session answered anything. Now: `ScrubClient.ask` sends
whole milliseconds; the server takes a finite number and rounds it (never a
boolean, NaN or infinity); an ask unanswered in 5 s (`ASK_TIMEOUT_MS`) is a
miss, so a lost answer cannot hold up the next. Checks: the stand-in session
refuses a fractional moment as the server did, and the tab's drag sends one;
the server's request parsing; a fractional moment end to end; the timeout.

**Hardware checklist (the owner, v0.59.0):** after Home Assistant's restart and
a full reload of the page (Ctrl+F5), on LAN Chrome:

1. Open a camera's day whose recordings are not cached, and drag slowly along
   an hour that has not played: a picture follows the pointer, its time in the
   corner, within a second of the pointer on Front Yard Right and within 4 s
   on the others; a new one about every 0.3 s (the first pass) and quicker over
   the same stretch again (the store).
2. Drag fast across the hour: pictures keep coming, dimmed while they lag, and
   catch up when the pointer rests.
3. Release: the picture stays until the video starts there, with no black
   frame between.
4. Drag inside the recording that is playing, over what it has loaded: the
   video itself shows it, as before.
5. Hover without pressing: the thumbnail above the timeline as before.
6. Technical details, "Pictures while dragging": how many were shown of those
   asked, and the last one's source and round trip.
7. Then the iPhone app and the wall tablet (their K and F rows too, if not run
   yet): the same drag, and what Technical details says there.

#### Step 10.3: press and release

- **On press:** list the visible span's cached key frames from the index, and
  fetch around the cursor ahead of the drag.
- **On release:** the deep start runs as now, from the last frame shown, so
  the video starts on the picture the viewer chose.
- **Touch and keyboard too:** one finger scrubs; the arrow keys show frames as
  they step, then play after `KEY_SEEK_MS`, as now.
- **The painting path in Technical details** (the owner's ask, 2026-11-10):
  "Pictures while dragging" names how the pictures are shown in this browser,
  WebCodecs or MSE (and why: MSE where there is no `VideoDecoder`, e.g. over
  plain HTTP), so the iPhone app's and the wall tablet's drags say it without
  the playback check. v0.59.0 shows the counts only.

#### Step 10.4: the checks

- **In CI:** `scrub_check.cjs` drags against a fake key-frame endpoint,
  counting frames painted per second and long tasks over 50 ms.
- **On the hardware:** the playback check's S row measures frames shown per
  second of drag and their lag behind the pointer, cached and uncached, on
  Chrome and the iPhone.

#### Step 10.5: optional, storyboards

Built only if step 0's gate fails:

- small pictures of every key frame of whole cached hours, made in the
  background from cached sub recordings (ffmpeg, key frames only);
- kept like past days' timelines;
- opt-in per camera, because it copies every sub hour off the NVR (58–260 MB
  an hour per camera).

**Exit criteria (LAN Chrome, a steady drag on the sub stream):**

- **Uncached hour:** a new picture at least every 300 ms (median), each within
  one key-frame interval of the pointer.
- **Cached hour:** a new picture every 100 ms.
- **The iPhone app:** within twice those figures.
- **Smoothness:** no long tasks over 50 ms (CI).
- **No regressions:** a release still starts in 0.4–0.6 s uncached.
- **The NVR:** at most one more login while scrubbing (its list of online
  users).
- **A playback cut** on the same camera plays on without a stall.

**Risks:**

- WebCodecs in the iPhone app's WKWebView (measured in step 0; the MSE
  fallback covers its absence).
- The NVR's load from many short cuts: measured in step 0, and bounded by the
  newest-wins rule.
- Turns on one channel between the scrub and the playing cut.

---

## Phase 11 — Playback and settings extras (difficulty: Standard, 1–2 wk)

Goal: smaller things found in the review of Stamina and reostream (PLAN.md
§6.5–6.6). Each step is independent.

| Step | Status |
| --- | --- |
| 1. Zoom into the picture | Not started |
| 2. Save this event | Not started |
| 3. Filters that start useful | Not started |
| 4. Copy settings to other cameras | Not started |
| 5. Research: settings changed from factory | Not started; a note only |

#### Step 11.1: zoom into the picture

- **Gestures and keys:**
  - on touch: pinch, a two-finger pan and a double-tap;
  - on desktop: the wheel or a trackpad pinch;
  - on the keyboard: + − 0.
- **Where:** on the playing recording and in live full screen.
- **How it behaves:**
  - a transform only, so the layout and the decoding are untouched;
  - the pan is clamped to the picture, not its letterbox;
  - a pill shows the zoom level, with a reset.
- **Why it has to be ours:** HA's `user-scalable=no` stops the browser's own
  pinch.

#### Step 11.2: save this event

- **The button:** "Save event", beside "Download clip". It saves an MP4 from
  the event's start − 10 s to its end + 10 s (both set in the options).
- **Where the clip comes from:**
  - the cached copy, cut at key frames, where it is cached;
  - otherwise, a download cut (143) of that range, muxed by `BaichuanMuxer`.
  - Either way, the original samples are kept untouched.
- **Named** `<camera>-<date>-<time>-<type>.mp4`.

#### Step 11.3: filters that start useful

- Each device remembers its Events filters.
- On a first visit, motion-only events are hidden on cameras that record
  continuously, where they outnumber the rest many times over.
- One chip brings them back.

#### Step 11.4: copy settings to other cameras

- **"Copy to…" on a camera's Settings:**
  - choose the categories (image, AI detection, motion, recording, …) and the
    target cameras;
  - a preview shows each change, and what a target cannot take.
- **Applied through HA actions**, entity by entity (rule 4), with a result per
  setting.
- **Never copied:** what names the camera (its name, its on-screen text).

#### Step 11.5: research, settings changed from factory

- Find out whether factory values can be read:
  - the HTTP API's initial values (a `Get*` with `action` 1);
  - reolink-aio's cache;
  - Baichuan's replies.
- The outcome is recorded as a note here, with no UI unless the values can be
  read.

**Exit criteria:**

- **Zoom:** works by touch, trackpad, mouse and keyboard, in Chrome and the
  iPhone app, and the picture never leaves its box.
- **A saved event:**
  - plays in Chrome, Safari and VLC;
  - its samples are byte-identical to the recording's;
  - a 1-minute uncached sub event arrives within 2 s on the LAN.
- **Copying image settings** to a camera of the same model changes exactly the
  previewed entities, and reports any refused.

---

## Phase 12 — Optional R&D: the Doorbell's recordings and talk (difficulty: Very high, 3–5 wk, gated)

Goal: the Doorbell's SD recordings play in the panel, and the owner can talk
through the Doorbell from live view.

**Today:** Phase 5's client speaks TCP; the Doorbell speaks Baichuan only over
UDP (the desktop client could not add it by IP). Phase 5a captured talk on it:
10 → 201 → 202 (ADPCM, 16 kHz mono, 1024-sample blocks, at real time) → 11
([baichuan-playback.md §3.6](baichuan-playback.md#36-talk-the-doorbell-over-udp)).

| Step | Status |
| --- | --- |
| a. UDP transport and the gate | Not started |
| b. SD playback | Not started; after a go for playback |
| c. Talk | Not started; after a go for talk |
| d. Fallback for playback: clips by FTP | Not started; only if a says no to playback |

#### Step 12a: UDP transport and the gate

- **The transport:** UDP for `baichuan_client.py`, with reolink-aio's UDP
  protocol (MIT) as the reference, or reused through it.
- **The read-only probe:**
  - a login beside HA's own session (does the Doorbell keep both?);
  - 142 and 272 as sanity checks;
  - a 143 cut from its SD card (time to the first key frame, rate);
  - a replay;
  - its sessions before, during and after.
- **Only on wired power.**
- **Go or no-go per target:** playback, talk.

#### Step 12b: SD playback

- The Doorbell becomes a playback source through the cut: Phase 5's deep-start
  source, with the Doorbell as its host.
- Its recordings come from Phase 6.2's events, and its files from 14 → 16
  `FileInfoList`.
- The MSE player is unchanged, and the cache works as for the NVR.
- Phase 6.3's picture sequence gives way to the video.

#### Step 12c: talk

- **A Talk button** in live view, to hold or to toggle.
- **Audio from the browser to the door:**
  - the browser's microphone (`getUserMedia`, which needs a secure page: Nabu
    Casa or local HTTPS; the panel says so on plain HTTP);
  - PCM over the websocket;
  - ADPCM on the server (the exact variant confirmed in 12a);
  - 202 messages at real time, with 201 and 11 around them.
- **Live view keeps playing during talk.**
- **Who may talk:** admins by default; an option opens it to every user.

#### Step 12d: fallback for playback, clips by FTP

Only if 12a says no to playback:

- **The Doorbell uploads its clips:** its own FTP upload (HA's Reolink
  integration has an `ftp_upload` switch), pointed at a server the owner runs,
  such as a NAS or an FTP app.
- **Reolink Viewer reads that folder:** a path in the options, such as a
  network storage mount in HA. It indexes the clips by the times in their
  names, and serves them as the Doorbell's recordings.
- **Retention** is the server's.
- First, confirm that the Doorbell offers FTP upload.

**Exit criteria:**

- **12b:** a Doorbell event plays from its SD card, with its first frame in
  under 2 s on the LAN.
- **12c:**
  - speech is heard at the door within 1 s;
  - 60 s of talk without dropouts, on Chrome and the iPhone app;
  - live view plays throughout.
- **12d:** clips appear within 2 minutes of the event.

**Risks:**

- The UDP transport is new code.
- A second session may be refused, or may push out HA's own.
- Never on battery.
- Talk needs a secure page.

---

## Phase 13 — Optional: live picture integrity and outside live sources (difficulty: High, 1–1.5 wk, gated)

Goal: find out whether RTSP corrupts any owned camera's picture, as reostream
measured on a Duo 3 (PLAN.md §6.6), and if one does, let that stream come from
a cleaner source.

| Step | Status |
| --- | --- |
| 1. Check the Duo 3 | Not started |
| 2. Outside live source per stream | Not started; only if step 1 finds corruption |

#### Step 13.1: check the Duo 3

- **"Picture integrity", a live-check option:** record N minutes of a stream
  through go2rtc (RTSP), beside the same minutes of the recording. The NVR
  records over its own link to the camera, which makes the recording the
  reference.
- **Two measures:**
  - decode both with ffmpeg, counting errors;
  - save frame strips of both, side by side at the same seconds, for the owner
    to look at. Error counts can read zero on broken video.
- **First on the Duo 3's sub and ext**, then on any camera the owner suspects.

**Gate:** visible corruption on any stream → step 2.

#### Step 13.2: outside live source per stream

- **The setting:** in the options, per camera and stream, the RTSP URL of a
  service the owner runs, such as reostream or neolink.
- **Kept on the server:** stored in the config entry's options, given only to
  go2rtc, and checked by a test connection when saved.
- **In use:**
  - the stream registry prefers it, and falls back to the camera's own source
    when it fails;
  - the debug view says which source plays;
  - the live check measures it.

**Exit criteria:**

- The Duo 3's report.
- If step 2 is built, the stream it serves shows no corruption in the strips,
  and starts within its current figures.

---

## Phase 14 — TBD: copies of detection clips on a NAS or cloud (difficulty: High; not scheduled)

**Status: TBD** (decision 7). The owner may want this built here later.
Until then, Reolink Stamina does it and can run beside Reolink Viewer. This
sketch keeps the idea from being lost; it is planned properly, with an
estimate, if it is picked up.

Goal: footage of what mattered outlives the recorder that wrote it, if the
NVR is stolen, fails or is wiped.

**The shape, after Stamina's cloud sync (PLAN.md §6.5):**

- **Per NVR, a copy job.** It is a device with a switch, which an alarm
  automation can turn on and off, and with sensors for the quota used, the
  queue and the last upload.
- **What is copied:**
  - one clip per detection of the kinds chosen (person, vehicle and animal by
    default), from the event's start − 10 s to its end + 10 s;
  - optionally, every event Phase 8 marks unusual, whatever its kind.
  - One event is one clip, however many sensors fired.
- **How a clip is made:** by Phase 11.2's "save this event" (the download cut,
  or the cached copy), with the original samples untouched and SD by default.
- **Where it goes:** through a storage integration HA already holds, reusing
  its connection (Stamina uses Synology DSM, WebDAV, SFTP Storage, OneDrive and
  Google Drive), so there is nothing to sign in to again.
  - A quota, oldest first out.
  - Names that sort by date.
- **Device I/O** goes through the scheduler at prefetch priority, behind
  anything someone is watching.

**Depends on:** Phase 11.2 (making the clip), and Phase 8 for the
unusual-event rule.

### Not planned

- **Storyboards:** only as Phase 10.5's fallback.
- **Marks on settings changed from factory:** only if Phase 11.5 finds the
  values.
- **reostream's endpoints, metrics, MQTT and Frigate features:** they serve
  Frigate setups (PLAN.md §6.6).

---

## Definition of done (per phase)

- Exit criteria met and measured.
- CI green; new code covered by tests at the level described in Testing strategy.
- Hardware-in-the-loop checklist run on owned devices.
- Docs updated: this plan (status), the hardware matrix, the user guide where relevant.

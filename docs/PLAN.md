# Maverick Reolink Viewer — Evaluation and Architecture

Status: planning. Researched 2026-10-17 against Home Assistant core `dev`
(Reolink integration pinned to `reolink-aio==0.21.18`), `reolink-aio` `main`,
go2rtc `master`, neolink and Advanced Camera Card.

Update (Phase 0): API differences found while implementing (notably HA's switch from
voluptuous to `probatio` in 2026.9) and the owner's answers to the open decisions in
section 5 are recorded under "Phase 0 status" in
[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).

Update (2026-11-02): Phases 0–5 are built. Section 6 holds the second round's
evaluation: what the owner asked for after using the panel, and what two other
Reolink projects do. It is planned as Phases 6–13 in
[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md#phases-613-the-second-round-planned-2026-11-02).

## 1. Goal

A Home Assistant (HA) sidebar app for Reolink cameras already configured in HA's
Reolink integration that:

1. Shows every available detail about each camera, NVR and Home Hub.
2. Exposes every setting the integration provides, with an explanation of what each
   one does and its trade-offs.
3. Plays back recordings smoothly on an event timeline that includes the camera's
   on-device AI detections.
4. Provides reliable, low-latency live view — the part that is flaky in the stock HA UI.
5. Feels fast: minimal spinners and waiting.

## 2. What already exists

### 2.1 HA Reolink integration (`homeassistant/components/reolink`)

- **Settings surface:** about 175 entity descriptions per device type
  (`strings.json`): 26 switch, 55 number, 32 select, 17 button, 22 binary sensor,
  12 sensor, 19 camera, 2 light, 2 time, 1 siren, plus firmware `update` entities.
- **Actions:** `reolink.ptz_move`, `reolink.play_chime`, `reolink.snapshot_past`.
- **Config option:** stream protocol `rtsp` / `rtmp` / `flv`. Per the integration's
  own text: "RTSP supports 4K streams (H.265 encoding) while RTMP and FLV do not. FLV
  is the least demanding on the camera."
- **Diagnostics:** model, hardware/firmware versions, main-stream encoding, Wi-Fi
  signal, HTTP(S)/Baichuan ports, RTMP/RTSP/ONVIF enabled, NVR/Hub/battery flags,
  channels, capabilities, abilities, broken commands and Baichuan fallbacks. This is
  the raw material for the "every detail" view.
- **Media browser playback (`media_source.py`, `views.py`):**
  camera → low/high (and telephoto) resolution → day (last 31 days) → files split
  into 5-minute pieces. Only NVRs get per-event-type folders. Depending on the
  device, a file plays via an authenticated MP4 proxy (`/api/reolink/video/...`), via
  an NVR "prepare download" round trip (`NvrDownload`) before the first byte, or via
  RTMP piped through HA's HLS stream worker. H.265 main streams often fail to play
  in browsers.
- **Runtime access:** `config_entry.runtime_data` is a `ReolinkData` holding
  `host: ReolinkHost`, whose `host.api` is the logged-in `reolink_aio.api.Host`.
  This is internal, not a public API.

### 2.2 `reolink-aio` (MIT) already speaks the Reolink app protocol

The library implements Reolink's proprietary **Baichuan** protocol (TCP 9000, also
UDP/P2P) for 100+ command IDs alongside the HTTP API. Relevant to this project:

| Capability | Function | Baichuan cmd |
| --- | --- | --- |
| Days that have recordings | `baichuan.search_vod_days` | 142 |
| Event search with exact start/end and type: motion, person, vehicle, animal, face, package, visitor, crying, line crossing, intrusion, loitering, forgotten item, taken item | `baichuan.search_vod_type` (merged into `api.request_vod_files`) | 272 / 273 / 274 |
| JPEG frame from a past recording (timeline thumbnails) | `baichuan.snapshot_past` | 298 |
| Live JPEG snapshot | `baichuan.snapshot` | 109 |

`snapshot_past` already parses Reolink's media framing (`1001` stream header,
`00dc` video frames), so the video container format is understood.

Recorded-video URLs come from `api.get_vod_source(...)` with `VodRequestType`
`RTMP`, `FLV`, `PLAYBACK`, `DOWNLOAD` or `NVR_DOWNLOAD`. Live URLs come from
`get_rtsp_stream_source` / `get_rtmp_stream_source` / `get_flv_stream_source`.
**FLV and RTMP URLs embed the plain-text password**, so they must never reach the
browser.

### 2.3 Other prior art

- **go2rtc** has native modules for several proprietary camera protocols (Tapo, Kasa,
  Wyze, Xiaomi, Tuya, Ring, Nest, DVRIP, ISAPI) but **none for Baichuan**. Its docs
  warn that some Reolink models have "very awful, unusable" RTSP and list HTTP-FLV
  and RTMP sources as alternatives.
- **HA's built-in go2rtc** runs as a managed process with a generated config, a local
  API on port 11984 behind generated credentials, and an allow-list of API paths. It
  is built for HA's own camera WebRTC, not for third-party integrations.
- **neolink** (Rust, AGPL-3.0) proxies Baichuan **live** video to RTSP, including
  battery cameras. Its README lists no recorded-video playback.
- **Advanced Camera Card** has a `reolink` engine (live, clips, timeline via the HA
  media browser; no thumbnails, no continuous recordings, may need proxying).

## 3. Recommended architecture

```
Sidebar panel (TypeScript web component, HA websocket + signed HTTP URLs)
   │ details / settings / timeline            │ live + playback video (WebRTC / MSE / fMP4)
   ▼                                          ▼
reolink_viewer custom integration ─────────► go2rtc (owned by reolink_viewer)
   │ adapter over config_entry.runtime_data   │ HTTP-FLV / RTSP / RTMP (later: Baichuan)
   ▼                                          ▼
HA Reolink integration (reolink-aio) ──────► cameras / NVR / Home Hub
```

**Form factor: a companion custom integration with its own sidebar panel, installed
through HACS.** Since HA 2026.2 an "app" is what used to be called an add-on; one may
be added later only to package go2rtc and hardware transcoding for HA OS users.

Why a companion integration rather than a standalone app:

- It reuses the Reolink integration's logged-in connection: no second login, no
  re-entering passwords, no extra sessions against devices that limit them.
- HA authentication, users and admin checks come for free.
- It runs on every HA install type (OS, Supervised, Container, Core).
- It can call internal `reolink-aio` functions the public HA APIs don't expose
  (event search, past snapshots, capabilities).

Main risk: `runtime_data` is internal to the Reolink integration and can change in
any HA release. Mitigation: exactly one adapter module touches it, a compatibility
check at startup, CI against HA beta/dev, and a degraded mode on the public entity,
action and media-source APIs.

Architecture rules:

1. Only `bridge.py` touches Reolink internals.
2. All device I/O goes through a per-host scheduler with concurrency limits and
   priorities: live > playback > settings > thumbnails > prefetch.
3. Credentials and camera URLs never reach the browser. Every endpoint uses HA auth
   or short-lived signed URLs (`async_sign_path`).
4. Settings writes go through standard HA actions, so HA state stays the single
   source of truth.

## 4. Feature design

### 4.1 Details and settings

- Build the UI from the entity and device registries, grouped by `translation_key`
  into categories: image, night vision & lights, AI detection, motion, recording,
  notifications, PTZ, audio, chime/doorbell, battery, network/system.
- A descriptions catalog keyed by `translation_key` (what it does, trade-offs,
  related settings, hardware requirements). Unknown keys still render, with a generic
  description, so new integration releases never hide settings.
- Many Reolink entities are disabled by default; show them with an "enable" action.
- Render from the `hass` state already in memory (instant), update the UI
  immediately on change, and roll back on error.

### 4.2 Playback

- **Timeline:** recording segments from `request_vod_files` (which merges the
  Baichuan event search), colored event markers per detection type, filter chips,
  hover thumbnails from `snapshot_past`, calendar of recording days.
- **Caching:** past days are immutable → cache permanently; today refreshes
  incrementally. Thumbnails go to a disk LRU cache behind a throttled queue.
- **Player:** an MSE player that treats a day as one continuous timeline. Prefetch the
  next segment, skip gaps, scrub on the sub stream (usually H.264), switch to main when
  paused or fullscreen if the browser can decode it.
- **Server side:** an authenticated view that streams fragmented MP4, remuxed with
  ffmpeg `-c copy` from FLV/RTMP when needed. Optional opt-in H.265 → H.264 transcode
  (CPU heavy without hardware acceleration).
- **H.265 reality:** Safari decodes it reliably; Chrome and Firefox only partially,
  depending on OS and GPU. Detect with `MediaSource.isTypeSupported` and fall back.

### 4.3 Live view

Why HA's live view is flaky with Reolink:

- HA defaults to RTSP, which is poor on some Reolink models.
- The HLS fallback adds seconds of latency and stalls.
- H.265 video and AAC audio don't suit WebRTC without transcoding.
- Every card starts the stream cold.

Design:

- reolink_viewer runs its **own** go2rtc instance and registers per-channel streams
  with the best source per model, measured in Phase 0: RTSP for main and sub
  streams, HTTP-FLV for the `ext` stream and as the fallback (the first hardware run
  found no advantage for HTTP-FLV on sub streams), AAC → Opus audio for WebRTC.
- WebRTC signaling goes through an HA websocket command; MSE is the fallback through
  an authenticated HA proxy. Remote access over WebRTC needs a TURN relay; MSE through
  HA works remotely at the cost of bandwidth.
- Instant first paint: show the latest snapshot, then fade into video.
- Optional "keep warm" for favorite cameras (never battery cameras).
- Fullscreen starts the main stream in the background and swaps it in on its first
  frame.

### 4.4 Reolink app protocol (Baichuan) reverse-engineering assessment

- **Done publicly:** login, encryption, events, settings, VOD day/event search and
  past-frame thumbnails (`reolink-aio`, MIT); live video (neolink, AGPL-3.0).
- **Not found publicly:** continuous recorded-video playback over Baichuan with seek
  and speed control.
- **Method:** capture the Reolink desktop client with Wireshark and neolink's
  Baichuan dissector, decrypting with your own credentials. Document the
  playback start/seek/speed/stop commands, then convert frames to fragmented MP4.
- **Feasibility estimate:** live over Baichuan — high. Playback over Baichuan —
  roughly 60–70% chance of a working prototype for specific owned models within a few
  focused weeks. Robust multi-model support is the long tail.
- **Verdict:** not the starting point. Most of the Reolink app's smoothness comes from
  player design (continuous timeline, prebuffering, sub-stream scrubbing, native HEVC
  decode), which Phases 2–3 replicate over HTTP/FLV/RTSP. Pursue Baichuan media only
  for proven gaps: battery cameras without RTSP/FLV, models with broken RTSP/FLV, and
  fast-forward or frame-accurate scrubbing.
- **Licensing:** prefer upstreaming to `reolink-aio` (MIT). Use neolink only as a
  separate process; copying its code would make this project AGPL.

## 5. Open decisions

| Decision | Why it matters |
| --- | --- |
| HA install type (OS / Supervised / Container / Core) | Whether an HA app for go2rtc and transcoding is worth packaging |
| Camera models and topology (NVR, Home Hub, direct) | VOD method, session limits, which protocols are available |
| Main-stream codec (H.264 vs H.265) per camera | Whether high-res playback and live need transcoding |
| Remote access requirement (e.g. Nabu Casa) | WebRTC needs TURN remotely; affects the live design |
| Mobile priority (HA Companion app) | Touch-first timeline, picture-in-picture, bandwidth defaults |

## 6. Second round: evaluation (2026-11-02)

After using Phases 0–5 day to day, the owner asked for six things: live
scrubbing, a monitor-style Live page, the Doorbell on the Events page, faster
camera feeds on a dashboard, and anything worth taking from two other Reolink
projects. This section holds the reasoning; Phases 6–13 of
[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) build it.

### 6.1 Live video on Home Assistant dashboards

- **Why the panel is fast:** what makes it fast is on the server. Our go2rtc
  keeps streams open ("keep warm") and caches each stream's latest key frame,
  so a new viewer starts at once over MSE instead of waiting for the camera's
  next key frame; each camera's last picture is kept for the first paint.
- **Why dashboards are slow:** dashboard cards play HA's camera entities, and
  each card that opens starts a stream from the camera cold and waits for a key
  frame.
- **Measured on the owner's hardware** ([hardware-matrix.md](hardware-matrix.md),
  runs 5–17): HA's own view started in a median 1.76–3.64 s per run, and ours
  was faster on 19 of 19 streams in each run that compared them; warm sub
  streams started over MSE in a median 0.09 s on the iPhone; the first picture
  came in 0.02 s against 0.50 s for HA's snapshot, which failed on both Doorbell
  streams.
- **So the panel's tile becomes a dashboard card.** `rv-live-camera` already
  shows one camera large. The live websocket commands are not admin-only, so a
  wall tablet signed in as a non-admin user can use it.
- **Camera entities backed by our go2rtc** would speed up stock cards too, but
  less: HA's player uses WebRTC, which cannot be sent the cached key frame, so
  it still waits for the next one (1–4 s on the owner's sub streams). It only
  skips the cold connection to the camera.

### 6.2 Scrubbing while the pointer is held down

- **Today:** a drag shows frames only from what the browser has buffered of
  the recording playing (30 s behind, up to 240 s ahead). Anywhere else it shows
  a thumbnail once the pointer rests for 150 ms (`snapshot_past`, 160–490 ms
  from the NVR, decoded to JPEG by ffmpeg). Since Phase 5 a release plays fast
  (an uncached deep start from the download cut in about 0.5 s); the drag
  itself does not show video.
- **How Nest and UniFi Protect do it:** they keep the footage where it can be
  prepared, and hand the client small pictures while the pointer moves; real
  video plays on release. HA can play that part on the LAN, from what it holds
  or can get quickly. Fastest first:
  1. the browser's buffer, as today;
  2. key frames from HA's disk cache: the fragment index (`fmp4.py`) marks
     which fragments start with a sync sample, so one is a file read, with no
     device I/O and no decoding on HA;
  3. a short download cut (143) at the dragged time: its first key frame
     comes in 126–232 ms (Phase 5b), raw H.264/H.265, no ffmpeg;
  4. the thumbnail, as today, for a device that refuses the protocol.
- **In the browser:** each key frame is decoded (WebCodecs `VideoDecoder`, or
  a hidden MSE video fed key-frame-only fragments, where every seek lands at
  once) and painted over the video. The pictures step at the key-frame interval
  (1–4 s of footage on the owner's sub streams), as Protect's do.
- **Not planned unless measurements call for it:** storyboards for whole days
  (sprite sheets, as YouTube's). They need every sub hour copied off the NVR
  (58–260 MB an hour per camera), where the cut fetches a key frame on demand.

### 6.3 The Live page as a security monitor

- **Today:** the home view is the live board (2–5 columns by width, rows at
  16:9, so the board can run past the bottom of the screen; a fixed order; sub
  streams) with today's timetable under it. HD plays only in a tile's full
  screen.
- **Asked for:** a screen like the NVR's HDMI output: feeds only, fitted to the
  screen; layouts (1, 2×2, 3×3, 4×4, 1+5, 1+7); tiles moved around; the latest
  detection per camera along the bottom.
- **What shapes it:**
  - The NVR's live budget is 7 streams (6 warm subs and 1 HD), so one large
    tile in HD fits today; more need a capacity run.
  - Cold starts take 2–10 s, so tours stay fast only over warm cameras.
  - The Reolink detection binary sensors are already in `hass`, so a tile can
    light up the moment a detection fires, before the event search lists it.

### 6.4 The Doorbell's events

- **Why it is missing:** the Doorbell is added directly, speaks Baichuan only,
  records to its SD card and reports no replay support. Events
  (`events/recent`, `events/days`) come only from playback sources
  (`records_locally` in `bridge.py`, which needs replay support), so the feed
  leaves it out. Its day search would fail anyway: `request_vod_files` runs an
  HTTP Search the device does not have.
- **What the feed needs is Baichuan:** `search_vod_type` (272–274),
  `search_vod_days` (142) and `snapshot_past` (298), all through HA's own
  session with the Doorbell (UDP). None has been tried on its SD card yet.
- **Its video is a separate problem.** Our Baichuan client (Phase 5) speaks
  TCP; the Doorbell speaks UDP only. There are two routes:
  - our client over UDP, a transport that playback and talk would share,
    with reolink-aio's MIT UDP code as the reference;
  - the camera's own FTP upload of each clip, to a folder we index.

### 6.5 Prior art: Reolink Stamina

[marl1w/reolink-stamina-ha](https://github.com/marl1w/reolink-stamina-ha),
v1.9.2, MIT: a companion integration for NVR owners. Its code may be ported
with its copyright notice kept.

| Feature | Verdict |
| --- | --- |
| **Learning what is normal** | **Build (Phase 8).** It records every change of the Reolink detection sensors in its own local SQLite file and imports what HA's recorder still holds. Per camera, it learns how often each kind of detection happens: by time of day (a circular kernel), by time from sunset, by length, and by which camera fired just before; it can also count house-wide signals such as "anyone home". It scores an event's surprisal against a uniform baseline (naive Bayes), marks only the outliers with a sentence saying why, and waits for 7 days and 200 detections per camera. It measured 1.6, 4 and 9 marks a day across nine cameras at its three settings. It reads HA's own sensors, so it also works for cameras with no searchable recordings |
| reolink-aio's DST rules land on the wrong days | Already done (v0.39.1, reported as reolink_aio#239) |
| Pinch, drag and double-tap zoom on the video | Build (Phase 11): our player has none, and HA's `user-scalable=no` stops the browser's own pinch |
| An MP4 of one event | Build (Phase 11), from the download cut or the cached copy; ours downloads only the whole recording today |
| A copy of each detection's clip on a NAS or cloud | TBD: the owner may want it built here later (sketched as Phase 14). Meanwhile Stamina does it by reusing HA's storage integrations, and the two can run side by side |
| Exact detection times from HA's history | As the Doorbell's fallback only (Phase 6); the camera's event search already gives event times |
| Motion-only events hidden by default | Phase 11, a small filter default |
| A cross-camera list; playback fallbacks (FLV, remux, re-encode, HLS for iOS); probing each recorder's route | Skip: equivalents exist. Its RLN36 finding (whole-file download only) matches ours |

### 6.6 Prior art: reostream

[VoltTech21/reostream](https://github.com/VoltTech21/reostream), v0.2.4,
AGPL-3.0: a service that pulls live video over Baichuan and serves it as RTSP.
As with neolink, it may only run beside us as a separate process. Its README
and docs were read; its source was not.

| Feature | Verdict |
| --- | --- |
| **RTSP corrupts a Duo 3's picture**: 147 of 178 segments of a 30-minute RTSP capture had bitstream errors, against 0 of 184 over Baichuan (their Duo 3 PoE, 4096×1152 HEVC, other firmware). Error counts can read zero on visibly broken video | Check ours (Phase 13): our board plays the Duo 3's sub over RTSP |
| Talk through an RTSP back channel that go2rtc can use | The Doorbell's talk, if the owner runs reostream; our own route is Phase 12's UDP client |
| An FTP receiver keeping each clip the cameras upload | The idea gives the Doorbell playable video without Baichuan playback (Phase 12) |
| SD-card playback over Baichuan | Evidence that Phase 12 is feasible; ours comes from our own captures |
| Copy settings to other cameras; mark settings changed from factory, with a reset | Copying: Phase 11, through HA actions. Factory marks: research only, since HA's entities carry no factory values |
| MPEG-TS and frames endpoints, Prometheus metrics, MQTT and Frigate events, a Frigate config generator, fisheye dewarp, battery-camera discovery | Skip: HA or the panel cover them, or they serve Frigate setups |

Running it costs camera passwords entered again outside HA and one more
service to keep up. Its docs also warn that an NVR's "automatically add
devices" setting can change a camera's password without saying so.

## 7. Sources

- HA Reolink integration: <https://github.com/home-assistant/core/tree/dev/homeassistant/components/reolink>
  (`media_source.py`, `views.py`, `camera.py`, `diagnostics.py`, `strings.json`)
- HA go2rtc integration: <https://github.com/home-assistant/core/tree/dev/homeassistant/components/go2rtc>
- reolink-aio: <https://github.com/starkillerOG/reolink_aio> (`reolink_aio/baichuan/baichuan.py`, `reolink_aio/api.py`)
- HA 2026.2 release notes (add-ons renamed to apps): <https://www.home-assistant.io/blog/2026/02/04/release-20262/>
- go2rtc: <https://github.com/AlexxIT/go2rtc> · Frigate discussion on HTTP-FLV vs RTSP: <https://github.com/blakeblackshear/frigate/discussions/11454>
- neolink: <https://github.com/QuantumEntangledAndy/neolink>
- Advanced Camera Card: <https://github.com/dermotduffy/advanced-camera-card>
- HEVC browser support: <https://caniuse.com/hevc>
- Reolink Stamina (MIT): <https://github.com/marl1w/reolink-stamina-ha> (`docs/relevance.md`, `relevance/`)
- reostream (AGPL-3.0): <https://github.com/VoltTech21/reostream> (`README.md`, `docs/measurements.md`, `docs/setup.md`)

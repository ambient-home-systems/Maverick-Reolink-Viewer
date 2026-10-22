# Maverick Reolink Viewer

A Home Assistant companion for Reolink cameras that are already set up in the
built-in [Reolink integration](https://www.home-assistant.io/integrations/reolink/):

- every device detail and every setting the integration exposes, with plain-language
  explanations of what each one does
- an event timeline for NVR / SD-card recordings with the camera's own AI detections
  (person, vehicle, animal, face, package, visitor, ...) and recording thumbnails
- smooth recorded-video playback and low-latency live view

**Status: Phase 3 (live view) in progress.** Phase 2 is done (event timeline and
recorded-video playback; v0.3.2, verified on the owner's hardware in Chrome and in the
iPhone Companion app, at home and remotely, see the
[plan](docs/IMPLEMENTATION_PLAN.md#phase-2-status)). v0.4.0 runs the integration's own
go2rtc and adds a **live check** (Reolink → Open the live check) that measures live
view on each device before the live tab and grid are built. Its reports are in, from
desktop Chrome on the LAN and the iPhone app at home, through Tailscale and through
Nabu Casa: live view will start a stream over WebRTC, or over MSE when it is kept
warm, and the live tab and grid are next. See the
[plan](docs/IMPLEMENTATION_PLAN.md#phase-3-status).

**Phase 1 (v0.1.0, done):** the **Reolink** sidebar panel lists your NVRs, Home Hubs
and cameras (a camera that is in Home Assistant both via an NVR and directly is shown
once). Each device has an
**Overview** (latest snapshot, model, firmware, streams, network, ports, storage,
battery, features) and a **Settings** tab with every entity the Reolink integration
creates, grouped by category, each with a plain-language explanation, search, and a
confirmation before disruptive actions. Admins can enable disabled entities and run a
read-only hardware probe (see the
[plan](docs/IMPLEMENTATION_PLAN.md#phase-1-status-2026-10-17)).

**Phase 2A (v0.2.7, done):** cameras that record to the NVR
get a **Playback** tab: a zoomable timeline of the day with colored markers for each
detection type, hover thumbnails, a calendar, an event list, and a player that moves
on to the next recording by itself. Live view comes in a later phase.

**Phase 2B (v0.3.2, done):** recordings play through Media Source
Extensions (ManagedMediaSource in the iOS Companion app): a start deep in a
recording that is not cached yet begins once the recorder has sent the bytes
up to it, instead of after the whole file. The file player remains as a
fallback. Speeds 0.5–8×, HD/SD switching at the same moment, frames while
scrubbing, and a progress note while the recorder sends a recording. The
recording cache keeps to its disk budget, and a built-in **playback check**
(Playback tab → Debug) measures playback on the device it runs on; on a
computer, [`scripts/desktop-check`](scripts/desktop-check/README.md) runs it
in Chrome without clicking. On the owner's NVR, a start 41–57 min into an
hour-long recording that is not cached yet takes 7–13 s (the recorder's download up
to there) on a computer and an iPhone, at home, through Tailscale and through Nabu
Casa; a start in a cached recording takes under half a second.

**Phase 3 (in progress):** v0.4.0 runs its own [go2rtc](https://github.com/AlexxIT/go2rtc)
(Home Assistant's binary where the container ships it, else a pinned, checksum-verified
download), separate from Home Assistant's: its own ports (WebRTC on 18556), its API on
localhost only with generated credentials, no web UI, and camera credentials never
written to disk. The live check measures, for every camera and stream, the time to the
first image and the first live frame over WebRTC and MSE, cold and kept warm, against
Home Assistant's own camera view, and (for admins) how many streams the NVR serves at
once. It also fixes four playback findings: a seek back into trimmed video stalled, HD
recordings stayed held after the player moved on, and two cache edge cases.
v0.5.0 adds a key-frame cache: every MSE viewer of a stream shares one feed that keeps
the frames since the camera's last key frame, so a stream kept warm starts at once
instead of waiting up to 4 s for the camera's next key frame. v0.6.0 keeps each
camera's last picture on the server, taken while a live page is open (battery cameras
only while awake), so a tile can show it before its video starts.

Requires Home Assistant 2026.10 or newer with the Reolink integration set up.

### Install (HACS custom repository)

1. HACS → ⋮ → **Custom repositories** → add this repository's URL, type
   **Integration**.
2. Install **Reolink Viewer**, restart Home Assistant.
3. Settings → Devices & services → **Add integration** → **Reolink Viewer**.

| Document | What it covers |
| --- | --- |
| [docs/PLAN.md](docs/PLAN.md) | Evaluation: what the Reolink integration and `reolink-aio` already provide, the recommended architecture, live/playback design, and the Reolink-app (Baichuan) reverse-engineering assessment |
| [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) | Phased implementation plan with tasks, exit criteria, risks and the testing strategy |
| [docs/hardware-matrix.md](docs/hardware-matrix.md) | Measured behavior per camera model, filled from the probe |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Repository layout, dev environment, checks |

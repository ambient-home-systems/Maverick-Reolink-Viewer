# Maverick Reolink Viewer

A Home Assistant companion for Reolink cameras that are already set up in the
built-in [Reolink integration](https://www.home-assistant.io/integrations/reolink/):

- every device detail and every setting the integration exposes, with plain-language
  explanations of what each one does
- an event timeline for NVR / SD-card recordings with the camera's own AI detections
  (person, vehicle, animal, face, package, visitor, ...) and recording thumbnails
- smooth recorded-video playback and low-latency live view

**Status: Phase 3 (live view) done; Phase 4 is next.** Phase 3 is done (v0.15.1): live
view through the integration's own go2rtc, with a grid of every camera, a Live tab per
camera, full-screen HD and the camera's controls. It was verified on the owner's
hardware: a 24-hour soak, every tile's first image in a median 0.02 s on a Mac and an
iPhone, and playback holding up with live view running, see the
[plan](docs/IMPLEMENTATION_PLAN.md#phase-3-exit). Phase 2 is done (event timeline and
recorded-video playback; v0.3.2, verified on the owner's hardware in Chrome and in the
iPhone Companion app, at home and remotely, see the
[plan](docs/IMPLEMENTATION_PLAN.md#phase-2-status)).

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

**Phase 3 (v0.15.1, done):** v0.4.0 runs its own [go2rtc](https://github.com/AlexxIT/go2rtc)
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
only while awake), so a tile can show it before its video starts. v0.7.0 adds **live
view** (Reolink → Watch live): every camera in a grid, each showing its last picture and
fading into video, and a **Live** tab on each camera. A stream kept warm starts over MSE
from its cached key frame, any other over WebRTC; each falls back to the other, and a
tile pauses when it is off screen or the page is hidden. Battery cameras wait for a tap.
v0.8.0 keeps cameras warm: each mains-powered camera gets a **keep live view warm** switch
(on by default, as many per NVR or camera as its stream budget allows after one HD
stream), so its tile starts at once from its cached key frame. Turn it off on the
camera's Live tab, or like any switch in Home Assistant. v0.9.0 adds **full-screen HD**:
the button on each tile plays the camera full screen, starting the HD stream in the
background and swapping it in on its first frame. HD is the main stream where this
browser decodes it smoothly at its size, else the camera's H.264 ext stream. v0.10.0 puts
each camera's **controls** over its live view (its Live tab and full screen): PTZ moves
while an arrow is held, presets, zoom and focus, the floodlight, and the siren (after a
confirmation), all through Home Assistant's own entities and actions. v0.11.0 shows a camera
that records nowhere (like an E1 Zoom kept for snapshots) as its **picture first**: its tile
shows its latest picture and plays video when tapped, and it is not kept warm by default.
v0.12.0 watches a battery camera on **wired power** (a wired doorbell) like any other: it
plays at once and can be kept warm; unplugged, it goes back to waiting for a tap.
v0.13.0 gives every tile a **debug view** (its ⓘ button): what it plays and how, the
server's state of its stream, and its last events, with a Copy button for reports.
v0.14.0 adds a **soak report** to the Live grid: leave the grid open for 24 hours, then
it says whether live view held up (reconnects, sessions to the cameras, go2rtc, battery
cameras asleep), from samples the server takes every 5 minutes.
v0.15.0 keeps the soak on the server, so a hidden page, a reload or a restart no longer
starts it over. Before, Home Assistant unloading a panel whose page had been hidden for
5 minutes reset the soak. The soak now has two halves: Home Assistant runs live view
for 24 hours, with no page open, and the grid is visible for 8 hours in all, across any
sittings and devices. Any device can read the report under Reolink → **Soak report**.
v0.15.1 takes the soak's first sample 5 minutes after Home Assistant starts, once live
view is up. Before, a sample taken at start counted go2rtc and the kept-warm feeds as
missing. The soak passed on v0.15.1: 24.4 hours of Home Assistant and 8.3 visible hours
of the grid, with no reconnect loops, no restarts and no growth in camera sessions.

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

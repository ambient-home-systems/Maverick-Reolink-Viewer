# Maverick Reolink Viewer

A Home Assistant companion for Reolink cameras that are already set up in the
built-in [Reolink integration](https://www.home-assistant.io/integrations/reolink/).
It adds a **Reolink** panel to Home Assistant's sidebar:

![The Reolink panel: every camera live on the board, today's events underneath](https://raw.githubusercontent.com/ambient-home-systems/Maverick-Reolink-Viewer/main/docs/images/live-board.jpg)

- **Live:** every camera on one board, each starting from its last picture; full
  screen in HD; picture-in-picture; the camera's own controls (pan and tilt, zoom,
  presets, floodlight, siren).
- **Events:** today's events from every camera under the board, and any day's in the
  Events tab, filtered by camera and by what was seen (person, vehicle, animal,
  package, a doorbell press).
- **Recordings:** each day on a timeline with the camera's own detections and
  thumbnails, from the NVR or the camera's SD card, in HD or SD, from half speed to 8×.
- **Devices and settings:** every detail and setting the Reolink integration has,
  each explained in plain words.
- **Checks:** a live check, a playback check and a 24-hour soak report say in plain
  words how well it works on your devices, and what to do when it does not.
- On a computer and in the Home Assistant app on a phone, light and dark, from the
  keyboard and with a screen reader. No accounts, passwords or cloud service of its
  own: it works through Home Assistant's Reolink integration and Home Assistant's
  login.

Requires Home Assistant 2026.10.1 or newer with the Reolink integration set up.

## Install

1. HACS → ⋮ → **Custom repositories** → add this repository's URL, type
   **Integration**.
2. Install **Reolink Viewer**, restart Home Assistant.
3. Settings → Devices & services → **Add integration** → **Reolink Viewer**.

**Reolink** appears in the sidebar. HACS shows each new release as an update; install
it and restart Home Assistant. Without HACS, download `reolink_viewer.zip` from the
[latest release](https://github.com/ambient-home-systems/Maverick-Reolink-Viewer/releases/latest),
unzip it into `config/custom_components/reolink_viewer`, and restart Home Assistant.

## Help

| Guide | What it covers |
| --- | --- |
| [User guide](docs/user-guide.md) | What each part of the panel does, and how to use it, on a computer and a phone |
| [Troubleshooting](docs/troubleshooting.md) | Every message the panel shows: what it means, and what to do |
| [Cameras and NVRs](docs/cameras.md) | What to expect from each Reolink model tested, and the camera settings that help |
| [Changelog](CHANGELOG.md) | What each release brings |

The panel links to them too: **Devices → Help**, and **More help** on its messages.
Something not working? Open an issue on the
[issues page](https://github.com/ambient-home-systems/Maverick-Reolink-Viewer/issues);
[Troubleshooting](docs/troubleshooting.md#asking-for-help) says what to include.

## Home Assistant versions

Each release is tested on every Home Assistant release from the oldest it supports to
the newest of its day: v0.32.3 on 2026.10.1 to 2026.10.4 (2026.10.0's Reolink library
is too old for its recordings). A weekly check tries each
new Home Assistant release. If one changes the Reolink integration in a way Reolink
Viewer cannot read, the panel says so on every page ("Reolink Viewer needs an
update"), and your devices and their settings keep working until an update is out.

## Status

Phase 4 (design, performance, mobile, release) is done (2026-10-28, v0.32.3):
v0.31.0 was the first release, v0.32.0 adds the guides above, and v0.32.1 to v0.32.3
fix what the owner's checks found (live video where WebRTC cannot connect, the live
check's capacity test, full screen and pinching on the iPhone); see the
[plan](docs/IMPLEMENTATION_PLAN.md#phase-4-status). Phases 1 to 3 (device details and
settings, events and recorded-video playback, live view) are done and were verified on
the owner's hardware: a 24-hour soak, every tile's first image in a median 0.02 s on a
Mac and an iPhone, and playback holding up with live view running.

## For developers

| Document | What it covers |
| --- | --- |
| [docs/PLAN.md](docs/PLAN.md) | Evaluation: what the Reolink integration and `reolink-aio` already provide, the recommended architecture, live/playback design, and the Reolink-app (Baichuan) reverse-engineering assessment |
| [DESIGN.md](DESIGN.md) | The panel's design: the Timetable world, its tokens (light and dark), type, components and rules |
| [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) | Phased implementation plan with tasks, exit criteria, risks and the testing strategy |
| [docs/hardware-matrix.md](docs/hardware-matrix.md) | Measured behavior per camera model, filled from the probe |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Repository layout, dev environment, checks, Home Assistant versions, releasing |
| [CHANGELOG.md](CHANGELOG.md) | What each release brings |

## Before the first release

What each version before v0.31.0 added. From v0.31.0 on, [CHANGELOG.md](CHANGELOG.md)
says what each release brings.

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

**Phase 4 (v0.32.3, done):** v0.16.0 starts the panel's new design, the Timetable. The
**Reolink** panel opens on **Live**: every camera on a dark live board, numbered and
packed by its shape (a square doorbell runs two rows tall, a panorama two columns
wide), each saying in a word what it is doing (Live, Starting, Picture 21:22, Asleep,
Retrying). A railway-blue band holds the Live and Devices tabs and the time; the device
list, the live check, the soak report and the hardware probe are under **Devices**. The
panel follows Home Assistant's light or dark mode with its own colours, and its font
(Barlow, SIL Open Font License) comes from the integration, not a font service.
v0.17.0 sets today's events from every camera under the live board as a timetable:
newest first under a red line at the time now, each with its time, what was seen, the
camera's number on the board, its length and a thumbnail. An event you have not opened
yet stays lit in red, per Home Assistant user, until you open it (a row plays the
recording in the camera's Playback tab) or mark everything seen.
v0.18.0 adds an **Events** tab: any day's events from every camera as the same
timetable, with the day before and after, a calendar marking the days with
recordings, and filters by camera and by what was seen.
v0.19.0 sets the device list out as a ruled table (each camera's number on the
board, channel, model and state) and redraws each device's page, its Overview and
its Settings in the same style; an NVR's page lists its cameras.
v0.20.0 brings the Playback tab into the same style: the day's events as timetable
rows, the timeline in the panel's colours with the time now in red, filters by what
was seen as in the Events view, and the playhead's time as a large clock.
v0.21.0 makes the checks and reports (the live check, the playback check and the soak
report) say what they found in plain words first: a headline, then a line per camera or
part with how it went (Good, Fine, Slow, Problem) and what to do about it. The full
measurements stay underneath, under Details for support.
v0.22.0 finishes the redesign after an independent review: the home view's timetable
has a camera filter and All events, the board counts the cameras playing, video always
sits on the dark board, slow and problem results stand out, and Settings speaks plainly.
The design is written down in [DESIGN.md](DESIGN.md).
v0.23.0 makes the panel open faster: the first download is the home view alone
(about 41 KB compressed, less than half of before), and every other page loads the
first time you open it. Dragging along a recording's timeline stays smooth, and CI
now checks both.
v0.24.0 keeps live view steady on networks that keep cutting its video connection
(some work and school networks do): after two cuts the page switches its cameras to
the other way of streaming (WebRTC) for an hour. The live check's capacity test now
runs while cameras are kept warm, and when it cannot, it says what is in the way.
v0.25.0 makes the recordings timeline work under your fingers: pinch to zoom in on a
moment and slide two fingers to move along the day. Live view and playback can go
picture-in-picture, to keep watching a camera in a small window over other apps.
v0.26.0 saves data away from home: full screen stays in the lighter SD through Nabu
Casa, Tailscale or mobile data, with an HD button one tap away, and remembers your
choice on each device.
v0.27.0 shows a camera Home Assistant cannot reach as offline, since when, instead of
trying to play it, and says in plain words why live video cannot play and what to do.
v0.28.0 does the same for recordings: a camera without an SD card says why it has
nothing to play, an SD card or NVR disk that is not formatted or has failed is
flagged with what to do, and a recording that cannot play says why in plain words.
v0.29.0 explains, on every page, when the panel cannot reach your cameras: a Home
Assistant update changed the Reolink integration (Reolink Viewer needs an update), the
Reolink integration is not running, or no cameras are set up yet, with what still works
and what to do.
v0.30.0 works from the keyboard and with screen readers throughout: the timeline is a
slider you move with the arrow keys, the calendar and the camera's tabs move with the
arrows, every button says what it does, and motion stops when your device asks for less.

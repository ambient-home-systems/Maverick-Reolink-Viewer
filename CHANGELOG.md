# Changelog

What each release of Reolink Viewer brings. A release's notes on GitHub are its
entry here.

## 0.32.0

Guides for everyone who uses the panel, in plain words, and the way to them from the
panel:

- **[User guide](https://github.com/ambient-home-systems/Maverick-Reolink-Viewer/blob/v0.32.0/docs/user-guide.md):**
  what each part of the panel does and how to use it, on a computer and on a phone,
  with pictures.
- **[Troubleshooting](https://github.com/ambient-home-systems/Maverick-Reolink-Viewer/blob/v0.32.0/docs/troubleshooting.md):**
  every message the panel can show, word for word, with what it means and what to
  do, and what to include when you ask for help.
- **[Cameras and NVRs](https://github.com/ambient-home-systems/Maverick-Reolink-Viewer/blob/v0.32.0/docs/cameras.md):**
  what to expect from each Reolink model tested so far, and the camera settings that
  make live view start sooner.
- In the panel, **Devices → Help** opens them, for the version you have installed,
  and messages about a problem have a **More help** link to the part of
  Troubleshooting about them.

Tested on Home Assistant 2026.10.1 to 2026.10.4.

## 0.31.0

The first release through HACS. Reolink Viewer adds a **Reolink** panel to Home
Assistant's sidebar for the cameras, NVRs and Home Hubs set up in Home Assistant's
Reolink integration:

- **Live:** every camera on one board, each starting from its last picture; full
  screen in HD; picture-in-picture; the camera's own controls (pan and tilt, zoom,
  presets, floodlight, siren).
- **Events:** today's events from every camera as a timetable under the board, and
  any day's in the Events tab, filtered by camera and by what was seen.
- **Recordings:** each day on a timeline with the camera's own detections and
  thumbnails, from the NVR or the camera's SD card, in HD or SD, slow or fast.
- **Devices and settings:** every detail and setting the Reolink integration has,
  each explained in plain words.
- **Checks:** a live check, a playback check and a 24-hour soak report say in plain
  words how well it works on your devices, and what to do when it does not.
- On a computer and in the Home Assistant app on a phone, light and dark, from the
  keyboard and with a screen reader.

New in this release:

- Each release comes packaged: for HACS, and as `reolink_viewer.zip` to install by
  hand.
- Tested on every Home Assistant release from 2026.10.1 to 2026.10.4; a weekly
  check tries the newest. It needs 2026.10.1 or newer: 2026.10.0's Reolink library
  cannot search the recorder's days, so there it would run without live view,
  recordings and events, and HACS no longer installs it there.

Earlier versions were not released; the
[README](https://github.com/ambient-home-systems/Maverick-Reolink-Viewer#readme) says
what each one added.

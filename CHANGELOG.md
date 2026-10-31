# Changelog

What each release of Reolink Viewer brings. A release's notes on GitHub are its
entry here.

## 0.37.1

- **The playback check** (v0.4.3): its link test reads the fragments the player
  reads, from what is copied, instead of the clip. Since 0.37.0 a clip of a
  recording copied in two pieces waits for the rest of the copy, so the test
  timed out ("signal is aborted").

## 0.37.0

Phase 5c, step 1: a start deep in a recording over the Reolink protocol (the
option) fetches the recording once and costs the recorder one stream.

- **Nothing is fetched twice.** The copy of the recording stops where the
  recorder's answer begins; the answer has the rest. An HD start no longer
  downloads the rest of the hour (about 2 GB) beside it. Downloading the clip,
  or the file player, fetches the rest of the copy first.
- **One stream per start.** With no stream free on the recorder, the start takes
  its own copy's, and the copy goes on after it (0.36 waited for a second
  stream, and on a busy recorder the start then waited for the copy).
- **Details** says how far the copy went ("copied to 57.0 min"); the playback
  check, where the copy stopped and when the start took its stream.

## 0.36.2

- **HD plays on from one recording to the next**: after moving on to the next
  recording in HD the viewer lost its place, so it did not get the one after
  ready and stopped at its end; a jump within an HD recording also reloaded it
  instead of seeking.
- **The playback check** (v0.4.2) runs its SD rows in SD when the tab was left
  on HD (its HD row switches to HD itself), and a jump that played while the
  recording was still being copied is reported as not judged rather than "did
  not play".

## 0.36.1

What the hardware check of 0.36.0 asked for:

- **HD starts over the Reolink protocol fetch only what you will watch**: a few
  minutes ahead at a time, more as you play, and the rest from the normal copy
  once it has it (0.36.0 fetched the whole rest of the recording, about 2 GB an
  hour, beside the copy).
- **The first HD start of a day starts sooner**: the day's HD recordings are
  looked up in the background when the day opens (that lookup took 8 seconds
  when HD was first pressed).
- While the recorder sends the moment asked for, the player says so ("Asking the
  recorder for this moment…") instead of showing the copy's progress.
- **Details** shows why HD last failed; the playback check names what served
  each start and jump.

## 0.36.0

- **Start deep in recordings over the Reolink protocol** (an option, off by
  default: Settings → Devices & services → Reolink Viewer → Configure). A start
  or a jump more than 30 seconds past what is copied of a recording asks the
  recorder for that moment over its own protocol, so the first picture shows
  in about a second instead of after the copy reaches it (7 to 13 seconds 45
  minutes into an hour on an NVR). The recording is still copied; speeds,
  pausing and jumping work as before; any failure waits for the copy as
  without the option. While in use the recorder counts one more signed-in
  user, for about 30 seconds after the last such start. A prototype (Phase 5b):
  the owner's hardware check decides what comes next.
- **The playback check** (v0.4.0) and **Details** under the player say what
  served a start: the Reolink protocol cut (with its first fragment and login)
  or the recording's download.

## 0.35.5

- **The Baichuan probe's session test** runs its second replay on the same
  connection under that connection's stream slot, so live view holding the
  other slots no longer skips it; and the frame counter's rate is read from the
  key frames alone on newer cameras (their frames' extra headers were mistaken
  for clocks).

## 0.35.4

From the first Phase 5b report:

- **The Baichuan probe reads newer cameras' recordings.** Their frames carry an
  extra header the reader did not expect, so a quarter to a half of the bytes
  were skipped and the key frames in them missed. The reader now takes the
  header the stream shows, and the report keeps a few raw samples of anything
  it still cannot read.
- **A download cut of the HD recording asks for the HD stream** (the recorder
  answered with the lighter one before).
- **A camera without a long recording is measured on its longest clip**, and
  the report says so.
- **The session test skips a part it cannot get a stream slot for** instead of
  stopping.

## 0.35.3

- **The Baichuan probe no longer waits without end for a stream slot.** Each
  of its streams takes a slot of the recorder's stream budget, which live view
  and cameras kept warm also hold; with none free the probe looked frozen.
  It now says so in its progress line, gives up after a minute with the
  reason, and the report records the budget's state.

## 0.35.2

- **Hardware probe → Test replay over the Reolink app's own protocol** gains
  **Only this test**, on by default: the probe skips the live video and
  recording checks on every camera (six minutes on an NVR) and runs the
  Baichuan measurement alone. Its **Cameras** field now matches camera
  models ("Duo 3, CX810") as well as the names given to the channels.

## 0.35.1

- **The Baichuan probe runs again.** In 0.35.0 the panel's new options for it
  (HD recordings, the download cut, the session test, cameras, hold) were not
  accepted on the server, so the probe stopped at once with "not a valid
  option". Nothing else changes.

## 0.35.0

A measurement release for Phase 5b, nothing changes in daily use:

- **Hardware probe → Test replay over the Reolink app's own protocol** now
  measures what a deep start over that protocol would need: on every camera
  of the recorder you choose (or all of them), on the sub recordings and, if
  ticked, the HD ones, it replays 75 % into a long recording and, new, asks
  for a download cut from the same point (the way the Reolink client saves a
  clip), and times both to the first picture. It decodes what arrives (the
  video codec and its parameter sets, picture types, timestamps, the audio
  format) without keeping any video, and counts the recorder's logged-in
  users around each stream. An optional session test holds a replay open
  beside a full-speed download, then two replays at once. Read-only, a few
  seconds of video per camera.

Tested on Home Assistant 2026.10.1 to 2026.10.4.

## 0.34.1

- **Hardware probe → Test replay over the Reolink app's own protocol** now looks
  through every channel of the recorder, today's recordings included, for a
  long recording instead of giving up when the first channel only has motion
  clips. The report lists what was searched per channel. Cameras added directly
  are skipped without a device call.

## 0.34.0

A measurement release for Phase 5a, nothing changes in daily use:

- **Hardware probe → Test replay over the Reolink app's own protocol.** An opt-in
  check that replays a long recording of a recorder 45 minutes in over Baichuan,
  the protocol the Reolink app uses, and over HTTP, and compares how fast each
  reaches the first picture. Read-only: it opens its own connection, plays a few
  seconds, stops and logs out, and asks the recorder how many clients were
  logged in before, during and after. Its numbers decide whether Phase 5
  continues.
- The developer tool behind it, `scripts/baichuan`, turns a Wireshark capture of
  the Reolink client into a redacted message log, and `docs/baichuan-playback.md`
  records what the captures showed.

Tested on Home Assistant 2026.10.1 to 2026.10.4.

## 0.33.0

Choose how full screen plays on each device:

- **Devices → This device** sets whether full screen starts in HD or SD at home, and
  in HD or the lighter SD away from home or on mobile data. Until now that was only
  what you last tapped in full screen.
- **Remember HD or SD when I tap it in full screen** is on, as before: a tap changes
  the setting. Turn it off and a tap lasts until you leave full screen, so full
  screen starts as set every time.

Each phone and computer keeps its own settings. Tested on Home Assistant 2026.10.1 to
2026.10.4.

## 0.32.3

Fixes from trying the panel on an iPhone:

- **Full screen shows the whole picture at once.** Until HD took over, full screen
  showed the camera's lighter stream cropped to fill the screen, as tiles on the
  board are. Now it shows all of it, in SD as in HD. Away from home, where full
  screen stays in SD until you tap HD, that was the whole time.
- **Full screen keeps clear of the iPhone's corners.** The HD button, the camera's
  name and the full-screen button no longer sit under the rounded corners or the
  notch.
- **Pinching the recordings timeline keeps following your fingers** on the iPhone,
  where a pinch could stop after its first step, as if the page had started to
  scroll.

Tested on Home Assistant 2026.10.1 to 2026.10.4.

## 0.32.2

The live check's NVR capacity test no longer blames the NVR for a camera stream that
does not play:

- The test adds, last, the full-resolution stream of the camera that sends the most.
  When that stream sent no video at all, even on its own, the check said the NVR
  struggled with that many streams and suggested keeping fewer cameras warm. Now the
  test first checks that the stream plays on its own, uses the next camera's if not,
  and says which camera's full-resolution stream sent no video, and what to try.

Tested on Home Assistant 2026.10.1 to 2026.10.4.

## 0.32.1

Live video starts sooner on networks that block one of its two ways of streaming:

- On some networks, often at work, a camera that is not kept warm (a doorbell, say)
  took about 16 seconds to start: Reolink Viewer first tried its quicker way of
  streaming (WebRTC), which these networks block, and only after 15 seconds used the
  other. Now, once that happens, the device remembers it for a week for that Home
  Assistant address, and its cameras start the other way at once. If the quicker way
  works again, it is used again.
- A camera's ⓘ view says so: "Network: WebRTC does not connect from here, so MSE goes
  first until …".

Tested on Home Assistant 2026.10.1 to 2026.10.4.

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

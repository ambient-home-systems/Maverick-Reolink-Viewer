# Cameras and NVRs

What to expect from each Reolink model in Reolink Viewer, from measurements on real
devices. Reolink Viewer works with the devices Home Assistant's Reolink integration
supports. The models below are the ones it has been tested on so far. If yours is not
listed, it most likely behaves like the closest kind of device
[below](#what-to-expect-by-kind-of-device). You can help add it: see
[Add your model](#add-your-model).

The measurements, run by run, are in the [hardware matrix](hardware-matrix.md).

## Tested models

Tested in October 2026 on Home Assistant 2026.10, with Chrome and Safari on a Mac and
the Home Assistant app on an iPhone, at home, through Tailscale and through Nabu Casa.

| Model | What it is | Connected | Firmware tested | Live view | Recordings |
| --- | --- | --- | --- | --- | --- |
| [RLN36](#rln36-nvr) | NVR | | v3.6.5.597 | Serves its cameras' live video | Plays all its cameras' recordings |
| [Reolink Duo 3 PoE](#reolink-duo-3-poe) | Dual-lens panoramic camera, 16 MP | On the RLN36 | v3.0.0.5049 | HD is its 2560×720 stream | Event clips, on the NVR |
| [RLC-520A](#rlc-520a) (two) | Dome camera, 5 MP | On the RLN36 | v3.0.0.4348 | Works | Event clips, on the NVR |
| [E1 Pro](#e1-pro) | Indoor pan and tilt camera | On the RLN36 | v3.1.0.5112 | Slowest to start when not kept warm | Event clips, on the NVR |
| [CX410](#cx410) | ColorX camera, 4 MP | On the RLN36, and added on its own | v3.1.0.3429 | Fastest of the wired cameras | Continuous, on the NVR |
| [CX810](#cx810) | ColorX camera, 4K | On the RLN36, and added on its own | v3.1.0.5129 | Works | Continuous, on the NVR |
| [E1 Zoom](#e1-zoom) | Indoor pan, tilt and zoom camera, 4K | Added on its own | v3.2.0.6932 | Picture first: tap to watch | None (no SD card in the one tested) |
| [Reolink Video Doorbell](#reolink-video-doorbell-battery) | Battery doorbell, on wired power | On the RLN36, and added on its own | | Fastest of all to start | On the NVR |

No Home Hub, battery camera on its own battery, or camera recording to its own SD card
has been tested yet: see [What to expect by kind of device](#what-to-expect-by-kind-of-device).

### RLN36 (NVR)

- **Live view:** it kept up with everything the tests asked of it: seven live videos at
  once (six cameras and one camera in full resolution) and a recording downloading at
  full speed, every video at its full frame rate. Reolink Viewer asks an NVR for at
  most 7 live videos at once.
- **Recordings:** every camera's recordings play, from any day still on its disk, with
  the cameras' own detections (person, vehicle, animal and so on) on the timeline and
  a picture for each. Reading a day takes 1 to 5 seconds per camera, the first time;
  thumbnails take 0.2 to 0.5 seconds each.
- **Starting deep into a long recording:** the NVR can only send a recording from its
  beginning. Starting 50 minutes into an hour-long recording therefore takes 7 to 13
  seconds the first time, while the NVR sends the 50 minutes before it (the player
  says how far along it is). Starting anywhere in a recording already played takes
  under half a second. Short event clips start in about a second.
- **Speed:** a recording downloads 30 to 90 times faster than it plays, so playing at
  up to 8× speed keeps up.

### Reolink Duo 3 PoE

- Its full picture is 7680×2160 (16 MP, H.265): too large for most browsers to play,
  so full screen uses its 2560×720 stream, which plays everywhere.
- The live board uses its 1536×432 stream, as a tile two columns wide.
- It records event clips (about two minutes each), and some hour-long recordings of
  up to 3.8 GB in full resolution.

### RLC-520A

- Two were tested. One sends its full picture (2560×1920) as H.265, the other as
  H.264: it is a setting in the Reolink app. In H.265, full screen plays only where
  the browser can (see [Video formats](#video-formats-and-browsers)).
- Its small stream is 640×480.
- It records event clips (about two minutes each).

### E1 Pro

- Its small stream runs at 7 frames per second, with a full picture (key frame) every
  4 seconds, so it is the slowest camera to start when not kept warm: up to 4
  seconds. Kept warm, it starts in under a quarter of a second like the others.
- It has pan and tilt: the arrows on its **Live** tab and in full screen move it.
- It records event clips (about three minutes each).

### CX410

- Its small stream sends a full picture every second, where other cameras send one
  every 4 seconds, so its live video starts in about a second even when it is not
  kept warm. See [Settings that help](#settings-that-help).
- Its full picture is 2560×1440 H.264, which plays in every browser.
- It records continuously, in one-hour files of about 2.4 GB in full resolution.
- Live view through the NVR was as fast as with the camera added on its own. The
  panel shows it once.

### CX810

- Its full picture is 3840×2160 (4K) H.265: full screen plays it where the browser
  can, and the camera's 896×512 stream elsewhere.
- It records continuously, in one-hour files of about 2.8 GB in full resolution.
- Live view through the NVR was as fast as with the camera added on its own.

### E1 Zoom

- The one tested has no SD card and is not on an NVR, by choice: it keeps an eye on
  appliances' displays. Its tile shows its latest picture, with the time taken, and
  plays live when tapped. It is not kept warm by default.
- Its full picture is 3840×2160 (4K) H.265.
- Home Assistant's own snapshot of it sometimes failed in tests. Reolink Viewer keeps
  its own copy of each camera's last picture, so its tile still shows one.

### Reolink Video Doorbell (battery)

- Its picture is square: its tile takes two rows on the board. Its small stream is
  720×720, its full picture 2048×2048 H.265.
- On wired power, it plays at once like any other camera and can be kept warm.
  On battery, it waits for a tap and is never kept warm.
- It was the fastest camera of all to start: about half a second.
- Added on its own, it connects only through Reolink's own protocol, which has no
  middle (896×512-style) stream: where its full picture cannot play, full screen
  stays in SD.
- Its recordings are on the NVR, so playing them does not wake it.

## What to expect by kind of device

### NVRs

All the cameras on an NVR come with it into Home Assistant, and their recordings play
from it. See the [RLN36](#rln36-nvr) for what was measured. If a camera is on an NVR,
you do not need to add it on its own as well: live view through the NVR was as fast
in tests.

### Home Hubs

Not tested yet. A Home Hub keeps its cameras' recordings like an NVR, so it should
work like one. Reports are welcome: see [Add your model](#add-your-model).

### Cameras on their own

- **Live view:** Reolink Viewer asks a camera on its own for at most 2 live videos at
  once. In tests, cameras added on their own slowed down with several at once.
- **Recordings:** they play from the camera's own SD card. This uses the same
  recordings feature of the camera as an NVR, but it has not been tested on a real
  camera yet: reports are welcome. A camera with no SD card keeps no recordings: its
  tile shows its latest picture until tapped.

### Battery cameras and doorbells

They stay asleep until you tap their tile, are never kept warm, and are left out of
the hardware probe unless you tick them, all to save their battery. Recordings kept on
an NVR or Home Hub play without waking the camera.
On wired power, a battery doorbell plays like any other camera.

### Cameras that keep no recordings

With no SD card and no NVR, a camera's tile shows its latest picture with the time it
was taken, and plays live when tapped. Its **Playback** tab says it has nothing to
play, and how to start recording.

## Video formats and browsers

Each camera sends up to three streams:

- **Clear**: its full picture, in H.264 or H.265 (also called HEVC). Full screen and
  HD use it where the browser can play it smoothly.
- **Fluent**: a small picture, H.264 on every model tested. The live board uses it,
  and SD playback plays its recordings, so both work everywhere.
- A middle stream ("ext", H.264, 896×512 on most models): full screen uses it where
  the full picture cannot play.

H.265 plays in Safari and the Home Assistant app on an iPhone or a Mac, and in Chrome
and Edge where the computer's hardware can decode it. Firefox often cannot. When a
browser cannot, Reolink Viewer picks the middle stream, so the camera still plays.
Pictures wider than 4096 pixels (the Duo 3's) are beyond most hardware: they too use
the middle stream.

## Settings that help

These are camera settings, made in the Reolink app. Reolink Viewer does not change
them for you.

- **A shorter key-frame interval on the Fluent stream** makes live view start sooner
  when a camera is not kept warm. Video can only start on a full picture (a key
  frame): a camera sending one every second (the CX410) starts in about a second, one
  sending one every 4 seconds takes up to 4. Reolink's settings call it the I-frame or
  interframe interval, on models that let you set it.
- **A higher frame rate on the Fluent stream** (15 rather than 7) helps it start
  sooner too.
- **H.264 for the Clear stream**, where a camera offers it, lets full screen show the
  full picture in every browser. H.265 uses less disk for the same picture.
- **A fixed address for each NVR and camera** (a reservation in your router) stops
  Home Assistant losing them when your router hands out new addresses.

## Add your model

To add your model to this page:

1. As a Home Assistant administrator, open **Reolink → Devices → Hardware probe** and
   press **Run probe** (tick **Test recordings** if the device records). It makes a
   file. It only reads from your devices, and leaves passwords, addresses, serial
   numbers and other private details out.
2. Run the [live check](user-guide.md#the-live-check), and the
   [playback check](user-guide.md#the-playback-check) on a camera that records. Copy
   their reports.
3. Open an issue on the project's
   [issues page](https://github.com/ambient-home-systems/Maverick-Reolink-Viewer/issues)
   with the file, the reports, and anything that did not work.

# Maverick Reolink Viewer

A Home Assistant companion for Reolink cameras that are already set up in the
built-in [Reolink integration](https://www.home-assistant.io/integrations/reolink/):

- every device detail and every setting the integration exposes, with plain-language
  explanations of what each one does
- an event timeline for NVR / SD-card recordings with the camera's own AI detections
  (person, vehicle, animal, face, package, visitor, ...) and recording thumbnails
- smooth recorded-video playback and low-latency live view

**Status: Phase 1 done** (device details and every setting; v0.1.0, verified on the
owner's hardware, see the [plan](docs/IMPLEMENTATION_PLAN.md#phase-1-status-2026-10-17)).
The **Reolink** sidebar panel lists your NVRs, Home Hubs and cameras (a camera that is
in Home Assistant both via an NVR and directly is shown once). Each device has an
**Overview** (latest snapshot, model, firmware, streams, network, ports, storage,
battery, features) and a **Settings** tab with every entity the Reolink integration
creates, grouped by category, each with a plain-language explanation, search, and a
confirmation before disruptive actions. Admins can enable disabled entities and run a
read-only hardware probe.

**Phase 2A (v0.2.7, done):** cameras that record to the NVR
get a **Playback** tab: a zoomable timeline of the day with colored markers for each
detection type, hover thumbnails, a calendar, an event list, and a player that moves
on to the next recording by itself. Live view comes in a later phase.

**Phase 2B (in progress, v0.2.10):** the recording cache keeps to its disk
budget and never removes a file that is playing; long recordings play through
(URLs no longer expire mid-way); a built-in **playback check** (Playback tab →
Debug) measures playback on the device it runs on, including the iOS
Companion app, ahead of the continuous player.

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

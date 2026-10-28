# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Owners of Reolink cameras who already run them in Home Assistant's built-in
Reolink integration and install this companion from HACS. Their setups range
from a single camera to several NVRs and Home Hubs, with battery cameras,
doorbells and models this project has never seen. The owner's own setup (an
RLN36 NVR with six channels, two cameras also added directly, an E1 Zoom and a
wired Video Doorbell) is the reference hardware, not the only one.

They open the panel on a phone (the Home Assistant Companion app) and on a
desktop browser about equally, at home and away (Nabu Casa, Tailscale).

## Product Purpose

One place in Home Assistant to see Reolink cameras live, find and watch what
they recorded, and understand and change every setting the integration
exposes. Success: a glance shows every camera live within a second, and an
event becomes video in one step.

The two jobs that matter most, in order of use:

1. **Glance at live cameras**: what is happening now, on any device.
2. **Review events and recordings**: someone came by, a package arrived,
   something moved overnight; find it on the timeline and watch it.

Then: settings with plain-language explanations, and each camera's health
(online, recording, battery, storage, connection).

## Positioning

- Live view that starts at once: cameras kept warm play from a cached key
  frame (measured 0.05–0.09 s), and every tile shows the camera's last picture
  first (0.02 s), faster than Home Assistant's own camera view on every stream
  measured.
- Recordings straight from the NVR or SD card, on a timeline with the
  camera's own AI detections, played smoothly at 0.5–8× with the main/sub
  switch keeping the moment.
- Every setting the integration exposes, explained in plain language.
- No new accounts or credentials: it rides Home Assistant's Reolink
  integration and Home Assistant's auth.

## Operating Context

- A Home Assistant sidebar panel ("Reolink"), inside Home Assistant's own
  frontend: its theme (light and dark), its header and menu button, its narrow
  (phone) layout. Users move between it and the rest of Home Assistant.
- Home Assistant users may be admins or not; some tools (the probe, the
  capacity test) are admin-only.
- Remote use goes through Nabu Casa or a VPN; some networks cut long-lived
  connections (seen: a filtered work network through Nabu Casa).
- Cameras sleep (battery), go offline, record nowhere (snapshot-only), or
  record only events; live view runs within each host's stream budget.

## Capabilities and Constraints

- Lit + TypeScript panel (`frontend/`), built with Vite into a committed
  bundle; a Home Assistant custom integration (`custom_components/reolink_viewer`)
  with its own go2rtc for live view.
- Non-negotiable architecture rules (CLAUDE.md): only `bridge.py` touches the
  Reolink integration's internals; all camera I/O goes through the scheduler;
  camera URLs and credentials never reach the browser; settings change through
  Home Assistant's own actions, and Home Assistant's state is the truth; no
  neolink code.
- Phase 4 budget: initial panel JavaScript under 200 KB gzipped, other views
  code-split; no long tasks over 50 ms while scrubbing the timeline.
- Terminology in use: NVR, Home Hub, channel, sub / main / ext stream, kept
  warm, picture first, event, recording, timeline.

## Evidence on Hand

- Measured behaviour of the owner's hardware, runs 1–19:
  `docs/hardware-matrix.md`; decisions and exit runs:
  `docs/IMPLEMENTATION_PLAN.md`.
- No users other than the owner yet, no testimonials, no screenshots or
  brand assets. Do not invent any.

## Product Principles

1. **Live first.** The cameras are the product; a glance should need no
   navigation and no waiting.
2. **An event is one step from its video.**
3. **Say what is true.** Asleep, offline, waiting for a slot, not recording:
   the interface says so plainly instead of spinning.
4. **Scale from one camera to many hosts** without changing how it works.
5. **Belong in Home Assistant**: its theme, light and dark, on a phone as
   well as a desktop.

## Accessibility & Inclusion

Phase 4 requires keyboard navigation and labels throughout, and respects
reduced motion.

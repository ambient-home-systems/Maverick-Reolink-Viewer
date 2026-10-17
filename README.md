# Maverick Reolink Viewer

A Home Assistant companion for Reolink cameras that are already set up in the
built-in [Reolink integration](https://www.home-assistant.io/integrations/reolink/):

- every device detail and every setting the integration exposes, with plain-language
  explanations of what each one does
- an event timeline for NVR / SD-card recordings with the camera's own AI detections
  (person, vehicle, animal, face, package, visitor, ...) and recording thumbnails
- smooth recorded-video playback and low-latency live view

**Status: Phase 0 done** (foundations and hardware discovery). The integration adds a
**Reolink** sidebar panel that lists your Reolink hosts and channels and, for admins,
runs a read-only hardware probe whose JSON report fills the
[hardware matrix](docs/hardware-matrix.md). Live view, playback and settings come in
later phases.

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

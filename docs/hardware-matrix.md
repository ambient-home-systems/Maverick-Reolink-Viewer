# Hardware matrix

Measured behavior of each owned Reolink model, filled from the Phase 0 probe
(`reolink_viewer/probe`, the panel's **Run probe** button). Later phases pick live
sources, VOD methods and concurrency limits from this table rather than from
assumptions.

Status: **template** — waiting for the first probe report.

## How to fill it

1. In Home Assistant, open the **Reolink** sidebar panel as an admin and click
   **Run probe** (optionally with **Test concurrent streams**). The report downloads
   as `reolink-viewer-probe-<time>.json`.
2. Generate the rows:

   ```bash
   python scripts/probe_to_matrix.py reolink-viewer-probe-*.json
   ```

3. Paste the rows under the matching headers below, one row per model. When a model
   appears on several channels, keep one representative row and note differences.

The report is redacted (no passwords, tokens, UIDs, serial numbers, MAC addresses or
URLs) but still contains model names, firmware versions and the channel names you
gave your cameras.

## Legend

- `✓ 420 ms` — worked; the time is time-to-first-frame (live) or time-to-first-byte
  (VOD), measured on the HA host. Live cells also show the codec and resolution
  ffmpeg saw.
- `✓ 300 ms (+2.5 s prep)` — VOD worked after a "prepare download" round trip on the
  NVR (`NVR_DOWNLOAD`).
- `✗ (reason)` — tried and failed.
- `-` — skipped: not applicable (e.g. RTMP VOD on NVRs, `NVR_DOWNLOAD` on standalone
  cameras) or not safe (RTMP VOD when the RTMP port is off: the probe never turns it
  on). The JSON has the exact reason.
- Max concurrent streams: highest number of simultaneous sub streams that all
  delivered frames; `fails at N` is the first level where at least one failed.

### Live view

| Model | Type | Connected via | Firmware | Battery | Main codec | Sub codec | RTSP main | RTSP sub | RTSP ext | RTMP main | RTMP sub | RTMP ext | FLV main | FLV sub | FLV ext | Max concurrent streams |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| _e.g. RLC-810A_ | camera | NVR (RLN16-410) | v3.1.0.2368 | no | h265 25 fps 6144 kbps | h264 15 fps 512 kbps | | | | | | | | | | |

### Recorded video and Baichuan

| Model | Connected via | Stream | Search | PLAYBACK | DOWNLOAD | NVR_DOWNLOAD | FLV | RTMP | Event search | Day search | snapshot_past |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| _e.g. RLC-810A_ | NVR (RLN16-410) | main | | | | | | | | | |
| _e.g. RLC-810A_ | NVR (RLN16-410) | sub | | | | | | | | | |

## Per-host notes

Anything the tables don't capture: session refusals, slow channels, firmware quirks,
errors seen in the JSON.

| Host | Model | Notes |
| --- | --- | --- |
| | | |

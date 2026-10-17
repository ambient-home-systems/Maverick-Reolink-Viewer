# Hardware matrix

Measured behavior of each owned Reolink model, filled from the Phase 0 probe
(`reolink_viewer/probe`, the panel's **Run probe** button). Later phases pick live
sources, VOD methods and concurrency limits from this table rather than from
assumptions. The decisions drawn from it are in
[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md#phase-0-decisions).

Status: **filled from two probe runs on 2026-10-17** (HA 2026.10.2, reolink-aio
0.21.18, ffmpeg 6.0). The tables show run 2 (integration v0.0.2, concurrency test up
to 6 streams); the findings use both runs. Run 1 (v0.0.1, up to 4 streams) agreed on
every pass/fail result.

## Setup probed

| Host | Model | Firmware | Notes |
| --- | --- | --- | --- |
| host1 | NVR RLN36 (hardware N5MB01) | v3.6.5.597_26082822 | 6 channels in use; all recordings live here |
| host2 | CX410, direct | v3.1.0.3429_2404181313 | Same camera as NVR channel "Front Yard Right". Added directly only to improve streaming; may be removed once live view through the NVR is good enough |
| host3 | CX810, direct | v3.1.0.5129_2510222154 | Same camera as NVR channel "Front Yard Left"; same reason as host2 |
| host4 | E1 Zoom, direct | v3.2.0.6932_2608111908 | Not on the NVR and does not record, by design: used only for snapshots of the washer/dryer panels |

No battery cameras, Home Hubs or doorbells.

## How to fill it

1. In Home Assistant, open the **Reolink** sidebar panel as an admin and click
   **Run probe** (optionally with **Test concurrent streams**). The report downloads
   as `reolink-viewer-probe-<time>.json`.
2. Generate the rows:

   ```bash
   python scripts/probe_to_matrix.py reolink-viewer-probe-*.json
   ```

3. Paste the rows under the matching headers below.

The report is redacted (no passwords, tokens, UIDs, serial numbers, MAC addresses,
URLs or IP addresses) but still contains model names, firmware versions and the
channel names you gave your cameras. Reports from v0.0.1 could include device IP
addresses inside error messages; the script strips them from the rows.

## Legend

- `✓ 420 ms` — worked; the time is time-to-first-frame (live: from starting ffmpeg to
  the first decoded frame) or time-to-first-byte (VOD), measured on the HA host.
  Live cells also show the codec and resolution ffmpeg saw. Each cell is one sample.
- `✓ 300 ms (+2.5 s prep)` — VOD worked after a "prepare download" round trip on the
  NVR (`NVR_DOWNLOAD`).
- `✗ (reason)` — tried and failed.
- `-` — skipped: not applicable (RTMP VOD on NVRs) or not safe (RTMP when the port is
  off: the probe never turns it on). The JSON has the exact reason.
- Max concurrent streams: highest number of simultaneous sub streams that all
  delivered frames; `fails at N` is the first level where at least one failed. The
  test runs on one channel per host ("tested on chN" on the other channels).

### Live view

| Model | Type | Connected via | Firmware | Battery | Main codec | Sub codec | RTSP main | RTSP sub | RTSP ext | RTMP main | RTMP sub | RTMP ext | FLV main | FLV sub | FLV ext | Max concurrent streams |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Reolink Duo 3 PoE | camera | NVR (RLN36) | v3.0.0.5049_2506302188 | no | h265 20 fps 8192 kbps | h264 20 fps 1024 kbps | ✓ 2.1 s hevc 7680x2160 | ✓ 1.7 s h264 1536x432 | ✗ (method DESCRIBE failed: 404 (Stream Not Found)) | ✓ 3.1 s hevc 7680x2160 | ✓ 5.3 s h264 1536x432 | ✓ 4.0 s h264 2560x720 | ✓ 4.5 s hevc 7680x2160 | ✓ 3.4 s h264 1536x432 | ✓ 4.0 s h264 2560x720 | ≥ 6 (all 6 ok) |
| RLC-520A | camera | NVR (RLN36) | v3.0.0.4348_2411261177 | no | h265 30 fps 6144 kbps | h264 15 fps 512 kbps | ✓ 2.1 s hevc 2560x1920 | ✓ 4.3 s h264 640x480 | ✗ (method DESCRIBE failed: 404 (Stream Not Found)) | ✓ 4.6 s hevc 2560x1920 | ✓ 3.8 s h264 640x480 | ✓ 4.0 s h264 896x672 | ✓ 4.2 s hevc 2560x1920 | ✓ 3.9 s h264 640x480 | ✓ 3.9 s h264 896x672 | tested on ch5 |
| E1 Pro | camera | NVR (RLN36) | v3.1.0.5112_2507081475 | no | h264 25 fps 3072 kbps | h264 7 fps 160 kbps | ✓ 3.0 s h264 2560x1440 | ✓ 6.6 s h264 640x360 | ✗ (method DESCRIBE failed: 404 (Stream Not Found)) | ✓ 3.9 s h264 2560x1440 | ✓ 9.7 s h264 640x360 | ✓ 4.9 s h264 896x512 | ✓ 3.4 s h264 2560x1440 | ✓ 7.7 s h264 640x360 | ✓ 2.9 s h264 896x512 | tested on ch5 |
| CX410 | camera | NVR (RLN36) | v3.1.0.3429_2404181313 | no | h264 30 fps 5120 kbps | h264 15 fps 512 kbps | ✓ 3.0 s h264 2560x1440 | ✓ 3.0 s h264 640x360 | ✗ (method DESCRIBE failed: 404 (Stream Not Found)) | ✓ 3.2 s h264 2560x1440 | ✓ 3.4 s h264 640x360 | ✓ 4.1 s h264 896x512 | ✓ 2.5 s h264 2560x1440 | ✓ 3.5 s h264 640x360 | ✓ 4.1 s h264 896x512 | tested on ch5 |
| RLC-520A | camera | NVR (RLN36) | v3.0.0.4348_2411261177 | no | h264 30 fps 6144 kbps | h264 10 fps 256 kbps | ✓ 2.6 s h264 2560x1920 | ✓ 3.8 s h264 640x480 | ✗ (method DESCRIBE failed: 404 (Stream Not Found)) | ✓ 4.3 s h264 2560x1920 | ✓ 4.7 s h264 640x480 | ✓ 2.7 s h264 896x672 | ✓ 4.0 s h264 2560x1920 | ✓ 5.3 s h264 640x480 | ✓ 4.1 s h264 896x672 | tested on ch5 |
| CX810 | camera | NVR (RLN36) | v3.1.0.5129_2510222154 | no | h265 25 fps 6144 kbps | h264 15 fps 256 kbps | ✓ 2.0 s hevc 3840x2160 | ✓ 4.8 s h264 640x360 | ✗ (method DESCRIBE failed: 404 (Stream Not Found)) | ✓ 3.9 s hevc 3840x2160 | ✓ 4.9 s h264 640x360 | ✓ 3.6 s h264 896x512 | ✓ 3.8 s hevc 3840x2160 | ✓ 4.8 s h264 640x360 | ✓ 3.6 s h264 896x512 | tested on ch5 |
| CX410 | camera | direct | v3.1.0.3429_2404181313 | no | h264 30 fps 5120 kbps | h264 15 fps 512 kbps | ✓ 2.0 s h264 2560x1440 | ✓ 3.0 s h264 640x360 | ✗ (method DESCRIBE failed: 404 (Stream Not Found)) | - | - | - | ✓ 3.3 s h264 2560x1440 | ✓ 3.4 s h264 640x360 | ✓ 4.1 s h264 896x512 | ≥ 6 (all 6 ok) |
| CX810 | camera | direct | v3.1.0.5129_2510222154 | no | h265 25 fps 6144 kbps | h264 15 fps 256 kbps | ✓ 1.5 s hevc 3840x2160 | ✓ 2.9 s h264 640x360 | ✗ (method DESCRIBE failed: 404 (Stream Not Found)) | - | - | - | ✓ 3.9 s hevc 3840x2160 | ✓ 4.9 s h264 640x360 | ✓ 3.7 s h264 896x512 | ≥ 6 (all 6 ok) |
| E1 Zoom | camera | direct | v3.2.0.6932_2608111908 | no | h265 20 fps 4096 kbps | h264 10 fps 256 kbps | ✓ 3.1 s hevc 3840x2160 | ✓ 3.6 s h264 640x360 | ✗ (method DESCRIBE failed: 404 (Stream Not Found)) | - | - | - | ✓ 3.4 s hevc 3840x2160 | ✓ 5.5 s h264 640x360 | ✓ 3.7 s h264 896x512 | ≥ 6 (all 6 ok) |

### Recorded video and Baichuan

Event search, day search and `snapshot_past` are measured once per channel (on the
sub stream).

| Model | Connected via | Stream | Search | PLAYBACK | DOWNLOAD | NVR_DOWNLOAD | FLV | RTMP | Event search | Day search | snapshot_past |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Reolink Duo 3 PoE | NVR (RLN36) | main | ✓ 2.4 s | ✗ (HTTP 404) | ✓ 183 ms | ✗ (ServerDisconnectedError: Server disconnected) | ✗ (ServerDisconnectedError: Server disconnected) | - |  |  |  |
| Reolink Duo 3 PoE | NVR (RLN36) | sub | ✓ 2.7 s | ✗ (HTTP 404) | ✓ 158 ms | ✗ (ServerDisconnectedError: Server disconnected) | ✗ (ServerDisconnectedError: Server disconnected) | - | ✓ 1.6 s | ✓ 1.1 s | ✓ 316 ms |
| RLC-520A | NVR (RLN36) | main | ✓ 1.0 s | ✗ (HTTP 404) | ✓ 161 ms | ✗ (ServerDisconnectedError: Server disconnected) | ✗ (ServerDisconnectedError: Server disconnected) | - |  |  |  |
| RLC-520A | NVR (RLN36) | sub | ✓ 1.5 s | ✗ (HTTP 404) | ✓ 159 ms | ✗ (ServerDisconnectedError: Server disconnected) | ✗ (ServerDisconnectedError: Server disconnected) | - | ✓ 474 ms | ✓ 1.1 s | ✓ 169 ms |
| E1 Pro | NVR (RLN36) | main | ✓ 3.1 s | ✗ (HTTP 404) | ✓ 189 ms | ✗ (ServerDisconnectedError: Server disconnected) | ✗ (ServerDisconnectedError: Server disconnected) | - |  |  |  |
| E1 Pro | NVR (RLN36) | sub | ✓ 3.1 s | ✗ (HTTP 404) | ✓ 199 ms | ✗ (ServerDisconnectedError: Server disconnected) | ✗ (ServerDisconnectedError: Server disconnected) | - | ✓ 2.4 s | ✓ 1.1 s | ✓ 162 ms |
| CX410 | NVR (RLN36) | main | ✓ 2.5 s | ✗ (HTTP 404) | ✓ 181 ms | ✗ (ApiError: Host: <ip>:80: Request NvrDownload: API returned e) | ✗ (ServerDisconnectedError: Server disconnected) | - |  |  |  |
| CX410 | NVR (RLN36) | sub | ✓ 3.1 s | ✗ (HTTP 404) | ✓ 310 ms | ✗ (ApiError: Host: <ip>:80: Request NvrDownload: API returned e) | ✗ (ServerDisconnectedError: Server disconnected) | - | ✓ 2.0 s | ✓ 900 ms | ✓ 188 ms |
| RLC-520A | NVR (RLN36) | main | ✓ 2.1 s | ✗ (HTTP 404) | ✓ 330 ms | ✗ (ApiError: Host: <ip>:80: Request NvrDownload: API returned e) | ✗ (ServerDisconnectedError: Server disconnected) | - |  |  |  |
| RLC-520A | NVR (RLN36) | sub | ✓ 2.1 s | ✗ (HTTP 404) | ✓ 199 ms | ✗ (ApiError: Host: <ip>:80: Request NvrDownload: API returned e) | ✗ (ServerDisconnectedError: Server disconnected) | - | ✓ 1.7 s | ✓ 1.1 s | ✓ 492 ms |
| CX810 | NVR (RLN36) | main | ✓ 4.1 s | ✗ (HTTP 404) | ✓ 379 ms | ✗ (ApiError: Host: <ip>:80: Request NvrDownload: API returned e) | ✗ (ServerDisconnectedError: Server disconnected) | - |  |  |  |
| CX810 | NVR (RLN36) | sub | ✓ 4.7 s | ✗ (HTTP 404) | ✓ 648 ms | ✗ (ApiError: Host: <ip>:80: Request NvrDownload: API returned e) | ✗ (ServerDisconnectedError: Server disconnected) | - | ✓ 2.5 s | ✓ 1.7 s | ✓ 273 ms |
| CX410 | direct | main | ✗ (ApiError: Host: <ip>:443: Request VOD files: API returned er) | - (no finished recording in the last 3 days) |  |  |  |  |  |  |  |
| CX410 | direct | sub | ✗ (ApiError: Host: <ip>:443: Request VOD files: API returned er) | - (no finished recording in the last 3 days) |  |  |  |  | ✗ (ApiError: Baichuan host <ip>: received status code 405 from ) | ✓ 3.1 s | - |
| CX810 | direct | main | ✗ (ApiError: Host: <ip>:443: Request VOD files: API returned er) | - (no finished recording in the last 3 days) |  |  |  |  |  |  |  |
| CX810 | direct | sub | ✗ (ApiError: Host: <ip>:443: Request VOD files: API returned er) | - (no finished recording in the last 3 days) |  |  |  |  | ✗ (ApiError: Baichuan host <ip>: received status code 400 from ) | ✓ 3.1 s | - |
| E1 Zoom | direct | main | ✗ (ApiError: Host: <ip>:443: Request VOD files: API returned er) | - (no finished recording in the last 3 days) |  |  |  |  |  |  |  |
| E1 Zoom | direct | sub | ✗ (ApiError: Host: <ip>:443: Request VOD files: API returned er) | - (no finished recording in the last 3 days) |  |  |  |  | ✗ (ApiError: Baichuan host <ip>: received status code 400 from ) | ✓ 3.1 s | - |

## Findings

Live view:

- Every source works on every channel, except **RTSP ext**: Reolink serves no `ext`
  stream over RTSP (404). `ext` is available over HTTP-FLV and RTMP: H.264 at
  896×512 / 896×672, and 2560×720 on the Duo 3.
- **RTSP is fastest for main streams**: fastest on 17 of 18 channel samples across
  the two runs, 1.5–3.0 s. FLV took 2.1–4.5 s and RTMP 2.1–4.7 s.
- **RTSP is also usually fastest for sub streams**: faster than FLV on 12 of 18
  samples, slower on 4, and tied on 2. Sub streams take 1.7–9.7 s whatever the
  protocol. The slowest are the low-frame-rate subs (E1 Pro at 7 fps, RLC-520A
  "Dogs" at 10 fps): most of the time is spent waiting for the next key frame.
- Four main streams are H.265: Duo 3 (7680×2160), RLC-520A "Garage" (2560×1920),
  CX810 (3840×2160) and E1 Zoom (3840×2160). All sub and ext streams are H.264.
- RTMP is enabled on the NVR and disabled on the three cameras added directly. FLV
  works on all of them, so HTTP-FLV does not need the RTMP port on these models.

Concurrent streams (FLV sub streams, held 5 s, opened simultaneously):

- **NVR (Duo 3 channel): 6 of 6, with no slowdown.** Every stream opened in ~2.7 s at
  every level from 2 to 6. 6 is the most the probe tests, so the NVR's real limit is
  higher.
- **Cameras added directly: 6 of 6, but they slow down.** The CX810 took 3.6 s to
  open up to 3 streams and 7.7 s from 4. The CX410 went from 3.3 s to 4.3 s at 4.
  The E1 Zoom took 7.2 s for one stream and 8.5 s from 2.

Recorded video (NVR RLN36; the cameras record only to the NVR):

- **DOWNLOAD works on every channel and stream**: MP4, first byte in 157–649 ms.
- **PLAYBACK** returns HTTP 404 on the NVR.
- **FLV** VOD is disconnected by the NVR on every channel. That held in run 2, where
  FLV ran before `NVR_DOWNLOAD`, so it is not a side effect. With the URL reolink-aio
  0.21.18 builds, FLV VOD does not work on this NVR.
- **NVR_DOWNLOAD** spends 2.2–17.6 s in its "prepare" step, then the download is
  disconnected, and the next prepare requests fail with `busy` / `rcv failed`.
- Searching one day of recordings takes 1.0–4.7 s per channel and stream, so
  timeline data must be cached (as planned for Phase 2).
- Baichuan works on the NVR: event search over 24 h in 0.4–2.6 s, with person,
  vehicle, animal and line-crossing counts; day search in ~1 s; **`snapshot_past`
  in 160–490 ms**, fast enough for hover thumbnails.
- The three cameras added directly have no local recordings: day search returns 0
  days, Search errors, and Baichuan event search returns 400/405.

## Per-host notes

| Host | Model | Notes |
| --- | --- | --- |
| host1 | RLN36 | Duo 3 main stream is 16 MP (7680×2160) H.265; its ext stream (2560×720 H.264) is the practical "HD" view in browsers |
| host1 / host2 | CX410 | In HA twice (via NVR and directly). RTSP main: 1.7 / 2.0 s direct vs 1.9 / 3.0 s via NVR (runs 1 / 2) |
| host1 / host3 | CX810 | In HA twice (via NVR and directly). RTSP main: 1.9 / 1.5 s direct vs 2.0 / 2.0 s via NVR (runs 1 / 2) |
| host4 | E1 Zoom | Snapshot-only by design; live view and snapshots, no timeline or playback |

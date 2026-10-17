# Hardware matrix

Measured behavior of each owned Reolink model, filled from the Phase 0 probe
(`reolink_viewer/probe`, the panel's **Run probe** button). Later phases pick live
sources, VOD methods and concurrency limits from this table rather than from
assumptions. The decisions drawn from it are in
[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md#phase-0-decisions).

Status: **filled from four probe runs on 2026-10-17** (HA 2026.10.2, reolink-aio
0.21.18, ffmpeg 6.0). The live and VOD-method tables show run 2 (integration v0.0.2,
concurrency test up to 6 streams); the findings use runs 1 and 2. Run 1 (v0.0.1, up
to 4 streams) agreed on every pass/fail result. Runs 3 (v0.1.1) and 4 (v0.1.2) are
the Phase 2 recording playback checks, in their own tables.

## Setup probed

| Host | Model | Firmware | Notes |
| --- | --- | --- | --- |
| host1 | NVR RLN36 (hardware N5MB01) | v3.6.5.597_26082822 | 6 channels in use; all recordings live here. A Reolink Video Doorbell (battery) joined as channel 21 before run 4 |
| host2 | CX410, direct | v3.1.0.3429_2404181313 | Same camera as NVR channel "Front Yard Right". Added directly only to improve streaming; may be removed once live view through the NVR is good enough |
| host3 | CX810, direct | v3.1.0.5129_2510222154 | Same camera as NVR channel "Front Yard Left"; same reason as host2 |
| host4 | E1 Zoom, direct | v3.2.0.6932_2608111908 | Not on the NVR and does not record, by design: used only for snapshots of the washer/dryer panels |

No Home Hubs. Until run 4 there were no battery cameras or doorbells; see host1.

## How to fill it

1. In Home Assistant, open the **Reolink** sidebar panel as an admin and click
   **Run probe** (optionally with **Test concurrent streams**). The report downloads
   as `reolink-viewer-probe-<time>.json`.
2. Generate the rows:

   ```bash
   python scripts/probe_to_matrix.py reolink-viewer-probe-*.json
   ```

3. Paste the rows under the matching headers below.

For the Phase 2 recording playback measurements, tick **Test recording playback**
(optionally **Only this test** to skip the Phase 0 checks, and **Test simultaneous
playback**). Reports with it have `schema_version` 2 and the script adds three
tables: recording playback, simultaneous DOWNLOAD streams and device time.

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

Recording playback (Phase 2 gate, `DOWNLOAD` only, one recent recording per channel
and stream):

- HTTP Range: five requests a browser makes — the first 2 bytes (Safari's first
  request), a 256 KB mid-file range, an open-ended mid-file range (Chrome/Firefox
  seeking), a 64 KB suffix range and the same tail as an explicit range. `✓ all 5
  (206)` means every answer was a 206 with the right Content-Range and length;
  otherwise each is listed (`✗ 200` = the device ignored Range and sent the whole
  file).
- Mid-file TTFB: time to the first byte of the mid-file and open-ended ranges.
- MP4 layout: whether `moov` (the index) comes before `mdat` (the media), whether
  the file is fragmented, and the top-level boxes; tracks are the sample entries
  (`avc1`, `hvc1`/`hev1`, `mp4a`, ...) with the video size.
- MP4 vs search: the MP4's own duration minus the search's end − start.
- Throughput: a plain GET read for up to 6 s, and how many times faster than real
  time that is (versus the file's own bitrate).
- Day of recordings: the most recent complete day: file count, duration and size
  as median (min to max), median bitrate and gaps over 1 s between files.
- Simultaneous DOWNLOAD streams: 1, 2, ... sub-stream recordings on different
  channels downloaded at once, each read at 4× its bitrate (like a player buffering
  ahead) for 6 s; a level passes when every stream answered, stayed open and kept up.
- Server-side seek (v0.1.2): the same recording requested with the URL's `start`
  parameter set to its middle. `seeks` means the MP4 that came back is shorter
  (by duration, or by size when both downloads finished), `ignored` means it is the
  same file.
- Recording names (v0.1.2): names in an unknown format are shown only as their
  shape (digits as 9, letters as a/A), plus whether they contain the local start or
  end time, the UTC start time or "DST".
- MP4 layout (v0.1.2): when Range is ignored, the boxes are followed through the
  plain GET (up to 6 s / 64 MB), so a moov after a long mdat may not be reached.
- Full speed (main) (v0.1.2): one, then two main-stream recordings on different
  channels downloaded at once at full speed for 6 s: Mbit/s per stream and in total.

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

### Recording playback (DOWNLOAD)

Run 4, 2026-10-17 (integration v0.1.2, playback check only). It repeats run 3's
Range and throughput measurements, which agree, and adds the MP4 layout, the
server-side seek test and the file-name shape. NVR channels only: the cameras added
directly have no recordings, and the new doorbell (channel 21, battery) was
skipped because battery cameras are opt-in. "MP4 vs search" is empty because a
fragmented MP4's `mvhd` duration is a placeholder (1 s).

| Model | Stream | Recording | HTTP Range | Mid-file TTFB | MP4 layout | Tracks | MP4 vs search | Server-side seek | Throughput | Day of recordings | Day search |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Reolink Duo 3 PoE | main | 142 s, 151.5 MB, 8536 kbps, name `9-9-9-99999999999999-99999` | first 2 ✗ 200, mid ✗ 200, mid open ✗ 200, suffix ✗ 200, tail ✗ 200 | mid 159 ms, open 124 ms | moov first, fragmented, [ftyp moov moof mdat moof mdat …] | hvc1 7680x2160 + mp4a |  | n/a (fragmented MP4, read capped) | 349 Mbit/s (41x real time) chunked | 2026-10-16: 53 files, duration 128 s (102 s to 3601 s), size 136.3 MB (110.6 MB to 3.8 GB), 8522 kbps, 42 gaps | ✓ 2.3 s |
| Reolink Duo 3 PoE | sub | 139 s, 7.9 MB, 453 kbps, name `9-9-9-99999999999999-99999` | first 2 ✗ 200, mid ✗ 200, mid open ✗ 200, suffix ✗ 200, tail ✗ 200 | mid 158 ms, open 98 ms | moov first, fragmented, [ftyp moov moof mdat moof mdat …] | avc1 1536x432 + mp4a |  | ignored (6.6 MB of 6.6 MB) | 120 Mbit/s (265x real time) chunked | 2026-10-16: 53 files, duration 132 s (106 s to 3603 s), size 3.1 MB (2.6 MB to 187.7 MB), 189 kbps, 40 gaps | ✓ 2.7 s |
| RLC-520A | main | 132 s, 84.9 MB, 5148 kbps, name `9-99-9-99999999999999-99999` | first 2 ✗ 200, mid ✗ 200, mid open ✗ 200, suffix ✗ 200, tail ✗ 200 | mid 138 ms, open 196 ms | moov first, fragmented, [ftyp moov moof mdat moof mdat …] | hvc1 2560x1920 + mp4a |  | n/a (fragmented MP4, read capped) | 229 Mbit/s (45x real time) chunked | 2026-10-16: 28 files, duration 140 s (129 s to 340 s), size 86.2 MB (47.7 MB to 187.7 MB), 5023 kbps, 27 gaps | ✓ 1.4 s |
| RLC-520A | sub | 134 s, 3.7 MB, 219 kbps, name `9-99-9-99999999999999-99999` | first 2 ✗ 200, mid ✗ 200, mid open ✗ 200, suffix ✗ 200, tail ✗ 200 | mid 142 ms, open 118 ms | moov first, fragmented, [ftyp moov moof mdat moof mdat …] | avc1 640x480 + mp4a |  | ignored (3.0 MB of 3.0 MB) | 113 Mbit/s (515x real time) chunked | 2026-10-16: 28 files, duration 142 s (129 s to 339 s), size 3.7 MB (2.6 MB to 10.5 MB), 218 kbps, 27 gaps | ✓ 1.1 s |
| E1 Pro | main | 926 s, 372.8 MB, 3220 kbps, name `9-99-9-99999999999999-99999` | first 2 ✗ 200, mid ✗ 200, mid open ✗ 200, suffix ✗ 200, tail ✗ 200 | mid 120 ms, open 130 ms | moov first, fragmented, [ftyp moov moof mdat moof mdat …] | avc1 2560x1440 + mp4a |  | n/a (fragmented MP4, read capped) | 280 Mbit/s (87x real time) chunked | 2026-10-16: 64 files, duration 168 s (4 s to 2272 s), size 64.5 MB (2.1 MB to 818.9 MB), 3233 kbps, 53 gaps | ✓ 3.0 s |
| E1 Pro | sub | 925 s, 24.1 MB, 209 kbps, name `9-99-9-99999999999999-99999` | first 2 ✗ 200, mid ✗ 200, mid open ✗ 200, suffix ✗ 200, tail ✗ 200 | mid 159 ms, open 142 ms | moov first, fragmented, [ftyp moov moof mdat moof mdat …] | avc1 640x360 + mp4a |  | ignored (23.1 MB of 23.1 MB) | 208 Mbit/s (998x real time) chunked | 2026-10-16: 64 files, duration 171 s (8 s to 2272 s), size 4.7 MB (524 KB to 57.1 MB), 215 kbps, 50 gaps | ✓ 3.1 s |
| CX410 | main | 1157 s, 774.9 MB, 5358 kbps, name `9-99-9-99999999999999-99999` | first 2 ✗ 200, mid ✗ 200, mid open ✗ 200, suffix ✗ 200, tail ✗ 200 | mid 120 ms, open 154 ms | moov first, fragmented, [ftyp moov moof mdat moof mdat …] | avc1 2560x1440 + mp4a |  | n/a (fragmented MP4, read capped) | 326 Mbit/s (61x real time) chunked | 2026-10-16: 28 files, duration 3600 s (354 s to 3601 s), size 2.4 GB (238.0 MB to 2.4 GB), 5353 kbps, 0 gaps | ✓ 2.5 s |
| CX410 | sub | 1157 s, 83.4 MB, 576 kbps, name `9-99-9-99999999999999-99999` | first 2 ✗ 200, mid ✗ 200, mid open ✗ 200, suffix ✗ 200, tail ✗ 200 | mid 136 ms, open 110 ms | moov first, fragmented, [ftyp moov moof mdat moof mdat …] | avc1 640x360 + mp4a |  | n/a (fragmented MP4, read capped) | 203 Mbit/s (351x real time) chunked | 2026-10-16: 29 files, duration 3599 s (355 s to 3602 s), size 219.7 MB (24.6 MB to 267.4 MB), 502 kbps, 0 gaps | ✓ 2.5 s |
| RLC-520A | main | 128 s, 82.3 MB, 5145 kbps, name `9-99-9-99999999999999-99999` | first 2 ✗ 200, mid ✗ 200, mid open ✗ 200, suffix ✗ 200, tail ✗ 200 | mid 99 ms, open 131 ms | moov first, fragmented, [ftyp moov moof mdat moof mdat …] | avc1 2560x1920 + mp4a |  | n/a (fragmented MP4, read capped) | 348 Mbit/s (68x real time) chunked | 2026-10-16: 37 files, duration 174 s (52 s to 516 s), size 90.2 MB (34.6 MB to 329.8 MB), 3161 kbps, 31 gaps | ✓ 2.1 s |
| RLC-520A | sub | 132 s, 4.7 MB, 286 kbps, name `9-99-9-99999999999999-99999` | first 2 ✗ 200, mid ✗ 200, mid open ✗ 200, suffix ✗ 200, tail ✗ 200 | mid 179 ms, open 139 ms | moov first, fragmented, [ftyp moov moof mdat moof mdat …] | avc1 640x480 + mp4a |  | ignored (3.8 MB of 3.8 MB) | 82 Mbit/s (286x real time) chunked | 2026-10-16: 37 files, duration 174 s (57 s to 522 s), size 4.7 MB (2.1 MB to 14.7 MB), 193 kbps, 30 gaps | ✓ 1.3 s |
| CX810 | main | 1158 s, 900.7 MB, 6223 kbps, name `9-99-9-99999999999999-99999` | first 2 ✗ 200, mid ✗ 200, mid open ✗ 200, suffix ✗ 200, tail ✗ 200 | mid 139 ms, open 154 ms | moov first, fragmented, [ftyp moov moof mdat moof mdat …] | hvc1 3840x2160 + mp4a |  | n/a (fragmented MP4, read capped) | 313 Mbit/s (50x real time) chunked | 2026-10-16: 27 files, duration 3600 s (356 s to 3601 s), size 2.8 GB (277.9 MB to 2.8 GB), 6240 kbps, 0 gaps | ✓ 3.1 s |
| CX810 | sub | 1160 s, 30.9 MB, 213 kbps, name `9-99-9-99999999999999-99999` | first 2 ✗ 200, mid ✗ 200, mid open ✗ 200, suffix ✗ 200, tail ✗ 200 | mid 138 ms, open 120 ms | moov first, fragmented, [ftyp moov moof mdat moof mdat …] | avc1 640x360 + mp4a |  | ignored (25.6 MB of 25.6 MB) | 214 Mbit/s (1002x real time) chunked | 2026-10-16: 28 files, duration 3601 s (358 s to 3603 s), size 82.3 MB (8.4 MB to 87.0 MB), 184 kbps, 0 gaps | ✓ 3.4 s |

### Simultaneous DOWNLOAD streams

Sub-stream recordings on different channels, each read at 4× its bitrate for 6 s;
then one and two main-stream recordings at full speed for 6 s.

| Run | Host | Model | Stream | Simultaneous DOWNLOAD streams | Per level: TTFB, Mbit/s | Full speed (main): Mbit/s per stream |
| --- | --- | --- | --- | --- | --- | --- |
| 3 | host1 | RLN36 | sub | ≥ 6 (all 6 ok) | 1: 137 ms, 0.83 Mbit/s; 2: 145 ms/204 ms, 1.54 Mbit/s; 3: 203 ms/233 ms/282 ms, 2.49 Mbit/s; 4: 249 ms/208 ms/281 ms/338 ms, 4.53 Mbit/s; 5: 304 ms/363 ms/205 ms/243 ms/283 ms, 5.39 Mbit/s; 6: 239 ms/282 ms/314 ms/342 ms/374 ms/402 ms, 6.2 Mbit/s |  | not measured |
| 4 | host1 | RLN36 | sub | ≥ 4 (all 4 ok) | 1: 121 ms, 1.9 Mbit/s; 2: 114 ms/233 ms, 2.86 Mbit/s; 3: 255 ms/183 ms/233 ms, 3.78 Mbit/s; 4: 217 ms/238 ms/297 ms/258 ms, 6.17 Mbit/s | 1: 408 = 408; 2: 288+224 = 512 |

### Device time

All four hosts report the same zone.

| Host | Model | Device time | Time zone | UTC offset | DST offset |
| --- | --- | --- | --- | --- | --- |
| host1 | RLN36 | 2026-10-17T03:59:09.127844-04:00 | UTC-04:00 | -4 h | +1 h |

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

Recording playback (runs 3 and 4; the Phase 2 gate):

- **The NVR ignores HTTP Range.** All 120 Range requests across both runs (12
  recordings × 5 kinds, twice) came back `200` with the whole file from the start:
  chunked, with no Content-Length and no Accept-Ranges. Neither a browser nor a
  proxy can seek inside a DOWNLOAD.
- **DOWNLOAD streams a fragmented MP4, built on the fly.** The layout is `ftyp`, a
  small `moov` (1.1 KB, at byte 24 or 32), then `moof`+`mdat` fragments of about 2 s
  each (first `mdat` 0.8–2.1 MB on main, 73–134 KB on sub). Playback can start as
  soon as the first fragment arrives. The `mvhd` duration is a 1 s placeholder, so
  durations must come from the search. The search's file sizes are only estimates:
  whole multiples of 512 KiB, larger than what is sent.
- **Codecs as stored suit browsers.** H.265 is tagged `hvc1` (the tag Safari
  needs), H.264 is `avc1`, and every recording has an AAC (`mp4a`) track. Sizes:
  Duo 3 7680×2160 / 1536×432, RLC-520A 2560×1920 / 640×480, E1 Pro and CX410
  2560×1440 / 640×360, CX810 3840×2160 / 640×360.
- **No server-side seek.** With `start=` set to mid-file, the six sub recordings
  that downloaded completely came back byte-for-byte the same size as without it;
  only the first bytes differ (likely a timestamp in `moov`). Main recordings were
  capped at 64 MB, so that test proves nothing for them.
- **It is fast.** First byte in 95–716 ms (median about 140 ms). One main download
  at 161–408 Mbit/s (30–87× real time), sub at 56–214 Mbit/s (265–1000× real time).
  Two main downloads at once shared 512 Mbit/s (288 + 224).
- **Simultaneous DOWNLOADs:** 6 of 6 (run 3) and 4 of 4 (run 4) on different
  channels all kept up at 4× their bitrate. First byte grew with the count, from
  about 120 ms for one to 240–400 ms for six.
- **Two recording patterns.** The Duo 3, both RLC-520A and the E1 Pro record event
  clips: median 128–174 s, a few up to an hour. The CX410 and CX810 record
  continuously in one-hour files, 2.4–2.8 GB main and 82–267 MB sub. The Duo 3's
  hour-long main files reach 3.8 GB (8.5 Mbit/s).
- Day searches took 1.1–3.7 s per channel and stream; today's partial search
  0.7–3.6 s.
- **Time.** All hosts report UTC−4 with a +1 h DST offset (EDT), and reolink-aio
  tags HTTP search results with that zone. The Baichuan event search returns plain
  local times. Recording names have the shape `C-CH-S-<14 digits>-NNNNN` (for
  example `9-99-9-99999999999999-99999`). Neither name carries a DST mark, and the
  14-digit stamp is neither the local nor the UTC start time.
- **New device:** a Reolink Video Doorbell (battery) now records on NVR channel 21.
  Its recordings live on the NVR, so playing them back is an NVR request, not a
  wake-up of the doorbell. The probe skipped it (battery cameras are opt-in).

## Per-host notes

| Host | Model | Notes |
| --- | --- | --- |
| host1 | RLN36 | Duo 3 main stream is 16 MP (7680×2160) H.265; its ext stream (2560×720 H.264) is the practical "HD" view in browsers |
| host1 / host2 | CX410 | In HA twice (via NVR and directly). RTSP main: 1.7 / 2.0 s direct vs 1.9 / 3.0 s via NVR (runs 1 / 2) |
| host1 / host3 | CX810 | In HA twice (via NVR and directly). RTSP main: 1.9 / 1.5 s direct vs 2.0 / 2.0 s via NVR (runs 1 / 2) |
| host4 | E1 Zoom | Snapshot-only by design; live view and snapshots, no timeline or playback |

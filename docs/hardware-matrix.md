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
the Phase 2 recording playback checks, in their own tables. Run 5 (2026-10-21,
v0.4.0) is the Phase 3 live check on desktop Chrome on the LAN, and run 6 (v0.5.0)
repeats it with the key-frame cache, run 7 (v0.5.1) with the init segment
rebuilt from the stream, run 8 (v0.5.2) with the MSE steps timed, and run 9
(v0.5.3) with H.264 frames declared in decode order; the iPhone runs follow.

## Setup probed

| Host | Model | Firmware | Notes |
| --- | --- | --- | --- |
| host1 | NVR RLN36 (hardware N5MB01) | v3.6.5.597_26082822 | 6 channels in use; all recordings live here. A Reolink Video Doorbell (battery) joined as channel 21 before run 4 |
| host2 | CX410, direct | v3.1.0.3429_2404181313 | Same camera as NVR channel "Front Yard Right". Added directly only to improve streaming; may be removed once live view through the NVR is good enough |
| host3 | CX810, direct | v3.1.0.5129_2510222154 | Same camera as NVR channel "Front Yard Left"; same reason as host2 |
| host4 | E1 Zoom, direct | v3.2.0.6932_2608111908 | Not on the NVR and does not record, by design: used only for snapshots of the washer/dryer panels |
| host5 | Reolink Video Doorbell (battery), direct | | Added by run 5. Baichuan only (no HTTP API): RTSP works; there is no HTTP-FLV or RTMP, so no ext stream. The live check lists it only as a direct connection |

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

### Live view through go2rtc (Phase 3)

Run 5, 2026-10-21: the live check (v0.4.0, go2rtc 1.9.14) in desktop Chrome 155
on macOS, on the LAN; Home Assistant's 4 STUN and 6 TURN servers. Times are to
the first painted frame. *Cold*: go2rtc not connected to the camera. *Warm*:
the stream kept open by go2rtc's preload, each session started right after it
connected. *HA's view*: the stream's own camera entity, through Home
Assistant's go2rtc (its snapshot, then its WebRTC). *Frame*: a JPEG from go2rtc
on the warm stream. Every WebRTC session that had a stream connected host to
host over UDP.

| Camera | Via | Stream | Cold WebRTC | Cold MSE | HA snapshot | HA WebRTC | Warm WebRTC | Warm MSE | Frame |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Front Yard Right (CX410) | NVR | sub h264 640×360 15 fps | 0.84 s | 1.56 s | 511 ms | 2.35 s | 0.91 s | 1.70 s | 415 ms |
| | NVR | main h264 2560×1440 30 fps | 0.73 s | 1.75 s | 359 ms | 3.15 s | 1.72 s | 1.93 s | 1749 ms |
| | NVR | ext h264 896×512 | 2.57 s | 1.57 s | - | - | 1.87 s | 2.50 s | 2112 ms |
| | direct | sub | 0.99 s | 1.58 s | 342 ms | 1.13 s | 0.90 s | 1.69 s | 900 ms |
| | direct | main | 2.71 s | 2.65 s | 469 ms | 3.00 s | 1.75 s | 1.97 s | 1780 ms |
| | direct | ext | 1.72 s | 2.36 s | - | - | 1.88 s | 2.44 s | 811 ms |
| Garage (RLC-520A) | NVR | sub h264 640×480 15 fps | 1.93 s | 4.06 s | 676 ms | 3.11 s | 3.89 s | 4.06 s | 1099 ms |
| | NVR | main h265 2560×1920 30 fps | 1.48 s | 1.72 s | 1020 ms | 0.84 s | 1.63 s | 1.78 s | 1637 ms |
| | NVR | ext h264 896×672 | 1.26 s | 2.38 s | - | - | 1.89 s | 2.05 s | 2025 ms |
| Hallway (E1 Pro) | NVR | sub h264 640×360 7 fps | 1.59 s | 7.66 s ¹ | 655 ms | 3.62 s | 3.92 s | 7.72 s ¹ | 994 ms |
| | NVR | main h264 2560×1440 25 fps | 1.74 s | 2.12 s | 388 ms | 1.15 s | 1.79 s | 2.12 s | 1468 ms |
| | NVR | ext h264 896×512 | 2.04 s | 1.74 s | - | - | 1.92 s | 2.75 s | 2037 ms |
| Front Yard Left (CX810) | NVR | sub h264 640×360 15 fps | 1.64 s | 4.87 s | 447 ms | 2.72 s | 4.04 s | 4.89 s | 1235 ms |
| | NVR | main h265 3840×2160 25 fps | 2.95 s | 1.68 s | 797 ms | 2.87 s | 1.53 s | 1.87 s | 2167 ms |
| | NVR | ext h264 896×512 | 2.60 s | 2.00 s | - | - | 1.95 s | 2.62 s | 2073 ms |
| | direct | sub | 2.43 s | 4.85 s | 576 ms | 3.24 s | 4.05 s | 4.86 s | 638 ms |
| | direct | main | 2.87 s | 2.06 s | 886 ms | 6.75 s | 1.52 s | 1.90 s | 2256 ms |
| | direct | ext | 2.32 s | 3.19 s | - | - | 1.93 s | 2.61 s | 2193 ms |
| Back Yard (Duo 3 PoE) | NVR | sub h264 1536×432 20 fps | 3.00 s | 4.16 s ¹ | 427 ms | 3.77 s | 3.62 s | 5.66 s ¹ | 623 ms |
| | NVR | main h265 7680×2160 20 fps | ✗ no frame in 20 s | 9.93 s ¹ | 1317 ms | 6.13 s | 4.36 s | 11.90 s ¹ | ✗ timed out |
| | NVR | ext h264 2560×720 | 1.25 s | 2.68 s | - | - | 1.79 s | 2.20 s | 2196 ms |
| Dogs (RLC-520A) | NVR | sub h264 640×480 10 fps | 3.21 s | 4.23 s | 637 ms | 2.84 s | 3.95 s | 4.28 s | 1210 ms |
| | NVR | main h264 2560×1920 30 fps | 2.19 s | 1.71 s | - ² | - ² | 1.64 s | 1.87 s | 1885 ms |
| | NVR | ext h264 896×672 | 1.75 s | 1.15 s | - | - | 1.87 s | 2.06 s | 2042 ms |
| Laundry Room (E1 Zoom) | direct | sub h264 640×360 10 fps | 3.82 s | 5.25 s | 1831 ms | 4.42 s | 3.94 s | 5.29 s | 1450 ms |
| | direct | main h265 3840×2160 20 fps | 2.14 s | 1.71 s | 633 ms | 1.80 s | 1.79 s | 1.67 s | 1055 ms |
| | direct | ext h264 896×512 | 1.72 s | 2.15 s | - | - | 1.90 s | 2.48 s | 2043 ms |
| Doorbell (battery) | direct | sub h264 720×720 15 fps | 0.50 s | 1.67 s | 914 ms | 1.87 s | - ³ | - ³ | - ³ |
| | direct | main h265 2048×2048 15 fps | 0.57 s | 0.81 s | ✗ failed | 1.06 s | - ³ | - ³ | - ³ |
| | direct | ext | ✗ ⁴ | ✗ ⁴ | - | - | - ³ | - ³ | - ³ |

¹ MSE reported a different picture size from WebRTC's: Hallway sub 640×480,
Back Yard sub 1536×1152, Back Yard main 7680×4320 (see the findings). ² The
stream's camera entity is disabled in Home Assistant. ³ Battery camera: never
kept warm. ⁴ No URL: reolink-aio built an FLV URL with the port "None" (fixed in
v0.4.1, which no longer offers ext without HTTP-FLV).

Summary medians (first frame): cold WebRTC sub 1.78 s (0.50–3.82 s), main/ext
1.89 s; cold MSE sub 4.19 s, main/ext 2.00 s; warm WebRTC sub 3.92 s, main/ext
1.83 s; warm MSE sub 4.86 s, main/ext 2.09 s; Home Assistant's view 2.87 s
(ours, the better of cold and warm, faster on 16 of 19 streams). First image:
HA's snapshot 0.64 s (0.34–1.83 s), go2rtc's frame 1.69 s.

NVR capacity (the same run; sub streams added one by one and kept open, then
the heaviest main, then a recording download at full speed):

| Level | Added | First frame | Frames per second (measured / set) | Download |
| --- | --- | --- | --- | --- |
| alone | download (ch23, 60 min main) | | | 356 Mbit/s |
| 1 | Back Yard sub | 1.95 s | 20/20 | |
| 2 | Garage sub | 1.08 s | all at their rate | |
| 3 | Hallway sub | 3.60 s | all at their rate | |
| 4 | Front Yard Right sub | 0.58 s | all at their rate | |
| 5 | Dogs sub | 0.80 s | all at their rate | |
| 6 | Front Yard Left sub | 3.96 s | Front Yard Left 14.3/15, the rest at their rate | |
| 7 | Back Yard main | 3.55 s | Back Yard main 19.5/20, the rest at their rate | |
| 8 | download | | every stream ≥ 9.9/10, 14.7/15, 19.6/20 | 377 Mbit/s |

Verdict: every level kept up. `GetOnline` listed 2 logged-in clients before and
after: the NVR does not count stream sessions as logins.

Run 6, 2026-10-21: the same check with v0.5.0 (the key-frame cache: *warm* is
now a stream kept open with its last key frame cached, and MSE starts from it),
desktop Chrome 155 on macOS over Wi-Fi (setup labelled "Desktop Chrome, LAN").
*Key frames*: the interval the cache saw. *Sets*: the init segment's
parameter sets (from the stream's description) against the key frame's own.

| Camera | Via | Stream | Cold WebRTC | Cold MSE | Warm WebRTC | Warm MSE | Key frames | Sets |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Front Yard Right (CX410) | NVR | sub | 0.53 s | 1.45 s | 0.91 s | 0.71 s | 0.99 s | same |
| | NVR | main | 1.74 s | 1.87 s | 1.80 s | 0.51 s | 2.60 s | same |
| | NVR | ext | 1.35 s | 2.09 s | 1.88 s | 0.48 s | 1.98 s | same |
| | direct | sub | 0.98 s | 2.42 s | 0.93 s | 0.70 s | 0.99 s | differ |
| | direct | main | 1.00 s | 1.58 s | 1.58 s | 0.29 s | 1.84 s | differ |
| | direct | ext | 2.23 s | 1.41 s | 1.88 s | 0.42 s | 1.99 s | same |
| Garage (RLC-520A) | NVR | sub | 3.06 s | 6.83 s | 3.44 s | 0.23 s | 4.07 s | same |
| | NVR | main (H.265) | 1.61 s | 2.27 s | 1.44 s | 0.29 s | 1.77 s | same |
| | NVR | ext | 1.81 s | 1.18 s | 3.88 s ³ | 0.34 s | 1.81 s | same |
| Hallway (E1 Pro) | NVR | sub | 1.10 s | 7.53 s ¹ | 3.95 s | 3.69 s ¹ ² | 3.99 s | differ |
| | NVR | main | 1.59 s | 2.00 s | 1.28 s | 0.65 s | 1.95 s | same |
| | NVR | ext | 1.56 s | 1.57 s | 1.89 s | 1.38 s ³ | 1.94 s | same |
| Front Yard Left (CX810) | NVR | sub | 4.21 s | 5.17 s | 4.00 s | 0.81 s | 4.08 s | same |
| | NVR | main (H.265) | 1.00 s | 1.32 s | 1.55 s | 0.23 s | 2.16 s | same |
| | NVR | ext | 1.85 s | 2.91 s | 1.92 s | 1.79 s ³ | 2.09 s | same |
| | direct | sub | 3.21 s | 4.79 s | 3.99 s | 4.83 s ³ | 4.17 s | differ |
| | direct | main (H.265) | 1.61 s | 1.46 s | 1.61 s | 1.73 s ³ | 1.87 s | differ |
| | direct | ext | 3.05 s | 3.26 s | 1.90 s | 0.48 s | 2.04 s | same |
| Back Yard (Duo 3 PoE) | NVR | sub | 2.91 s | 3.65 s ¹ | 3.96 s | 0.37 s ¹ | 4.06 s | differ |
| | NVR | main (H.265) | 3.16 s | 1.17 s ¹ | 1.36 s | 0.39 s ¹ | 2.04 s | differ |
| | NVR | ext | 1.55 s | 2.71 s | 1.84 s | 0.41 s | 1.98 s | same |
| Dogs (RLC-520A) | NVR | sub | 4.05 s | 4.26 s | 3.92 s | 0.28 s | 4.02 s | differ |
| | NVR | main | 1.02 s | 0.58 s | 1.30 s | 0.22 s | 1.56 s | same |
| | NVR | ext | 1.81 s | 0.76 s | 1.24 s | 0.18 s | 1.35 s | same |
| Laundry Room (E1 Zoom) | direct | sub | 2.43 s | 5.46 s | 3.93 s | 1.41 s ² | 4.00 s | differ |
| | direct | main (H.265) | 1.97 s | 1.75 s | 1.71 s | 0.24 s | 2.02 s | differ |
| | direct | ext | 1.84 s | 1.56 s | 1.91 s | 0.47 s | 1.98 s | same |
| Doorbell (battery) | direct | sub | 0.57 s | 0.52 s | - | - | | |
| | direct | main (H.265) | 0.70 s | 0.67 s | - | - | | |

¹ MSE reported the wrong picture size again: Hallway sub 640×480, Back Yard sub
1536×1152, main 7680×4320. ² Painted long after the cached frames arrived
(3.5 s and 1.1 s): the browser waited for a later key frame. ³ The warm feed had
ended and was opening again: go2rtc answered the MSE request after 0.8–3.6 s
(or, for Garage ext, the WebRTC offer after 2.4 s).

Medians: warm MSE sub 0.71 s (run 5: 4.86 s), main/ext 0.41 s (2.09 s); warm
WebRTC sub 3.93 s, main/ext 1.76 s; cold WebRTC sub 2.67 s, main/ext 1.61 s;
cold MSE sub 4.52 s, main/ext 1.57 s; Home Assistant's view 2.64 s (ours faster
on 19 of 19). First image: HA's snapshot 0.53 s (3 failed: Laundry Room,
Doorbell), go2rtc's frame 2.09 s. The NVR's capacity test kept up at every level
again (download 396 Mbit/s alone, 409 with seven streams).

Run 7, 2026-10-21: v0.5.1 (the MSE init segment rebuilt from the key frame's
parameter sets where they differ), same Mac on Wi-Fi. Warm MSE per stream, with
the parameter sets:

| Camera | Via | sub | main | ext |
| --- | --- | --- | --- | --- |
| Front Yard Right (CX410) | NVR | 0.68 s, same | 2.15 s ⁴, same | 0.46 s, same |
| | direct | 0.71 s, rebuilt | 0.31 s, rebuilt | 0.45 s, same |
| Garage (RLC-520A) | NVR | 0.15 s, same | 0.34 s, same | 1.63 s ⁴, same |
| Hallway (E1 Pro) | NVR | 3.74 s ⁵, rebuilt | 0.28 s, same | 0.83 s, same |
| Front Yard Left (CX810) | NVR | 0.78 s, same | 0.30 s, same | 0.52 s, same |
| | direct | 0.72 s, rebuilt | 0.26 s, rebuilt | 0.68 s, same |
| Back Yard (Duo 3 PoE) | NVR | 0.45 s, rebuilt | 0.31 s, rebuilt | 0.45 s, same |
| Dogs (RLC-520A) | NVR | 0.32 s, rebuilt | 0.20 s, same | 0.17 s, same |
| Laundry Room (E1 Zoom) | direct | 1.28 s ⁵, rebuilt | 0.23 s, rebuilt | 0.47 s, same |

⁴ go2rtc's answer to the MSE request took 1.9 s and 1.6 s; no feed had ended.
⁵ Painted 3.6 s and 1.2 s after the cached frames arrived.

Every MSE picture now has the size WebRTC shows (Hallway sub 640×360, Back Yard
sub 1536×432, main 7680×2160). Medians: warm MSE sub 0.71 s, main/ext 0.39 s;
warm WebRTC sub 3.90 s, main/ext 1.78 s; cold WebRTC sub 1.54 s, main/ext
1.76 s; cold MSE sub 3.87 s, main/ext 1.82 s; Home Assistant's view 3.47 s (ours
faster on 19 of 19). HA's snapshot failed on 8 of 19 entities (median 0.59 s
where it worked); go2rtc's frame 2.04 s. go2rtc logged nothing past its start.
The capacity test kept up at every level again (download 401 → 420 Mbit/s).

Run 8, 2026-10-21: v0.5.2 (MSE steps timed, feed ages, a video-only retry of
late paints), same Mac on Wi-Fi. *Paint after data*: the first painted frame
after the first appended media, cold MSE.

| Stream | Codec, fps | Cold MSE paint after data | Video only | Warm MSE |
| --- | --- | --- | --- | --- |
| Hallway sub (E1 Pro) | H.264, 7 | 3.97 s | 3.99 s | 3.69 s (3.56 s after data) |
| Laundry Room sub (E1 Zoom) | H.264, 10 | 1.51 s | 1.57 s | 1.28 s (1.17 s after data) |
| Front Yard Left sub, NVR (CX810) | H.264, 15 | 1.08 s | 1.11 s | 0.78 s |
| Front Yard Left sub, direct | H.264, 15 | 1.03 s | 1.03 s | 0.77 s |
| Doorbell sub | H.264, 15 | 1.03 s | 1.07 s | (battery) |
| Front Yard Right sub, NVR (CX410) | H.264, 15 | 0.94 s | | 0.70 s |
| Back Yard sub (Duo 3) | H.264, 20 | 0.72 s | | 0.40 s |
| Garage sub (RLC-520A) | H.264, 15 | 0.34 s | | 0.14 s |
| H.265 mains (Garage, CX810, Duo 3, E1 Zoom, Doorbell) | H.265 | 0.01–0.04 s | | 0.22–0.38 s |

Every warm MSE session got go2rtc's answer 20–30 ms after its websocket opened,
and joined a feed opened 6–23 s before: no warm feed was reopened. The one slow
warm start (Front Yard Right direct sub, 1.71 s) spent 1.23 s getting its
signed URL from Home Assistant's websocket. Medians: warm MSE sub 0.77 s,
main/ext 0.30 s (24 of 27 under 1 s); warm WebRTC sub 3.91 s, main/ext 1.80 s;
cold WebRTC sub 2.18 s, main/ext 1.35 s; Home Assistant's view 2.49 s (ours
faster on 18 of 19); HA's snapshot 0.60 s (19 of 19 this time). go2rtc logged
nothing past its start; the capacity test kept up at every level.

Run 9, 2026-10-21: v0.5.3 (the relay gives every H.264 SPS that sets no
reorder limit one that says decode order), same Mac on Wi-Fi. Every H.264 stream
reported "frame order: limit added": none of them sets a limit. Cold starts are
still where the camera is in its key-frame interval.

| Camera | Via | Warm MSE sub / main / ext | Cold sub: WebRTC, MSE |
| --- | --- | --- | --- |
| Front Yard Right (CX410) | NVR | 0.15 / 0.58 / 0.19 s | 1.19 s, 1.09 s |
| | direct | 0.70 / 0.27 / 0.16 s | 0.80 s, 0.86 s |
| Garage (RLC-520A) | NVR | 0.16 / 0.23 / 0.15 s | 2.70 s, 2.66 s |
| Hallway (E1 Pro) | NVR | 0.15 / 0.19 / 0.18 s | 1.13 s, 1.07 s |
| Front Yard Left (CX810) | NVR | 0.14 / 0.22 / 0.18 s | 0.90 s, 0.75 s |
| | direct | 0.20 / 0.24 / 0.16 s | 0.70 s, 0.76 s |
| Back Yard (Duo 3 PoE) | NVR | 0.15 / 0.31 / 0.14 s | 3.38 s, 3.67 s |
| Dogs (RLC-520A) | NVR | 0.14 / 0.22 / 0.16 s | 1.00 s, 2.91 s |
| Laundry Room (E1 Zoom) | direct | 0.13 / 0.24 / 0.15 s | 3.74 s, 3.67 s |
| Doorbell (battery) | direct | - | 0.89 s, 0.66 s |

Medians: warm MSE sub 0.15 s (run 8: 0.77 s), main/ext 0.19 s (0.30 s), all 27
under 0.71 s; cold MSE sub 1.08 s (4.24 s), main/ext 1.60 s; cold WebRTC sub
1.07 s, main/ext 1.17 s; warm WebRTC sub 3.88 s, main/ext 1.77 s; Home
Assistant's view 2.71 s (ours faster on 19 of 19); HA's snapshot 0.59 s, go2rtc's
frame 2.11 s. Cold MSE now paints 10–30 ms after its first data on every stream
(run 8: up to 4 s on H.264 subs). The capacity test's verdict flagged level 6:
Front Yard Left's sub started in 3.47 s against level 1's 0.38 s, both within a
4 s key-frame interval, with every stream at its frame rate (v0.5.4 no longer
counts that). At level 5 all five streams paused 1.3–1.4 s at once and kept
their frame rates; the download ran at 330 Mbit/s with seven streams (390 alone).

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

Live view through go2rtc (run 5, desktop Chrome on the LAN; Phase 3 step 1):

- **The first frame waits for the camera's next key frame.** The NVR and the
  cameras (the Doorbell may be the exception) do not start a new stream session
  with a key frame, and go2rtc
  1.9.14 keeps none for a new viewer: its WebRTC and MSE viewers both wait for
  the next one (its frame cache is for JPEGs only). Read from the warm starts,
  which began just after a key frame: the sub streams' key frames come every
  ~4 s on every camera but the CX410 (~1 s); the main and ext streams' every
  ~2 s.
- **So keeping a stream open does not make it start faster.** Warm WebRTC sub
  median 3.92 s against 1.78 s cold. Each warm session started right after a
  key frame, the worst case; a viewer arriving at a random moment waits half an
  interval on average, cold or warm. Warm saves only the connection: 0.1–0.3 s
  over RTSP, about 1 s over FLV (ext).
- **The CX410's sub (1 s key frames) starts in 0.84–0.99 s**, cold or warm,
  through the NVR or directly. The other subs took 1.6–3.8 s cold.
- **WebRTC connected in every session that had a stream** (56 of 57; the 57th is
  the Doorbell's ext, which had no URL), always host to host over UDP. It was
  faster than MSE: cold sub median 1.78 s against 4.19 s, main/ext 1.89 s
  against 2.00 s. The order of the check favours WebRTC on the subs: each MSE
  session began just after the WebRTC session's key frame, so it waited about a
  whole interval.
- **Faster than Home Assistant's view**: 16 of 19 streams; its median 2.87 s.
  HA's go2rtc connects to the camera before it answers (0.4–4.4 s); ours
  answered in 0.1–0.3 s cold.
- **A first image under 0.5 s needs a cache.** HA's snapshot took 0.34–1.83 s
  (median 0.64 s); go2rtc's frame 0.4–2.3 s (median 1.69 s: it waits for a key
  frame, then converts it with ffmpeg).
- **MSE picture sizes differ from WebRTC's on three NVR streams**: Hallway sub
  640×480 (WebRTC 640×360), Back Yard sub 1536×1152 (1536×432), Back Yard main
  7680×4320 (7680×2160). go2rtc writes the MSE init segment (picture size,
  SPS and PPS) from the stream description the device sends, not from the
  stream; WebRTC decodes the stream's own parameter sets. The NVR's
  description of these streams probably disagrees with the streams, and MSE
  would then show them at the wrong shape. The Hallway sub's MSE also painted
  only at the second key frame (7.7 s). Not yet confirmed by looking at the
  picture.
- **H.265 mains decode** in desktop Chrome on macOS over WebRTC and MSE (RLC-520A
  "Garage", CX810, E1 Zoom, Doorbell). The Duo 3's 7680×2160 is the exception:
  no WebRTC frame in 20 s cold, 4.4 s warm, MSE 9.9–11.9 s, no go2rtc frame.
  Its ext (2560×720 H.264) started in 1.25 s.
- **Through the NVR is as fast as direct** for the CX410 and CX810: cold sub
  1.20 against 1.28 s and 3.26 against 3.64 s (mean of WebRTC and MSE); warm
  sub within 0.03 s.
- **The NVR kept up with everything the test could add**: six subs, the Duo 3's
  main and a recording download at 377 Mbit/s, every stream at 95 % or more of
  its frame rate. Its real limit is higher.
- **The battery Doorbell, added directly, is Baichuan only**: RTSP sub and main
  started in 0.50 and 0.57 s, the fastest of all, but there is no ext (HTTP-FLV
  needs the HTTP API). HA's snapshot of its main stream failed.

Live view with the key-frame cache (run 6, v0.5.0, desktop Chrome on Wi-Fi):

- **The cache works.** A warm stream over MSE started in 0.18–0.81 s on 22 of
  27 streams: median 0.71 s on subs (4.86 s in run 5) and 0.41 s on mains and
  ext (2.09 s). Warm WebRTC is unchanged (sub median 3.93 s), as expected:
  WebRTC cannot be sent the cached frames.
- **Key-frame intervals, measured**: ~4 s on every sub but the CX410's
  (0.99 s), 1.6–2.6 s on mains, ~2 s on ext.
- **Parameter sets differ on 10 of 27 streams**: every stream of the cameras
  added directly but their ext, the Duo 3's sub and main, and the Hallway and
  Dogs subs. The three streams MSE showed at the wrong size are among
  them, which confirms the cause: the stream's description carries other
  parameter sets than the stream. Two of them decoded only from a later key
  frame (Hallway sub, Laundry sub). v0.5.1 rebuilds the init segment from the
  key frame's parameter sets.
- **Warm feeds dropped on five streams** (Garage ext, Hallway ext, Front Yard
  Left's NVR ext and its direct sub and main) and reopened, with no reason
  recorded. A local go2rtc keeps a warm feed through frames, WebRTC requests
  and other readers, so the cause is on the device side. v0.5.1 records each
  end and its reason, and adds go2rtc's log to the report.
- Cold starts still depend on where the camera is in its key-frame interval:
  the CX810's subs started in 3.2–4.2 s this time against 1.6–2.4 s in run 5.

With the init segment rebuilt (run 7, v0.5.1):

- **The wrong MSE sizes are gone**: the three streams now show the size WebRTC
  does. Ten streams reported their parameter sets rebuilt.
- **The Hallway sub still paints one key-frame interval late over MSE** (3.6 s
  after the cached frames, 3.9 s after the first cold ones), and the Laundry
  sub 1.2 s late. Their init segments were rebuilt, so the parameter sets are
  not the cause. Over WebRTC the Hallway sub starts at its first key frame
  (1.25 s cold). v0.5.2 tries such a start again over video only, to see
  whether audio holds it back.
- **Two warm MSE starts waited 1.6–1.9 s for go2rtc's answer** (Front Yard
  Right main, Garage ext) with no feed ended and nothing in go2rtc's log.
  v0.5.2 reports the steps before it (signed URL, websocket open) and the age
  of the feed it joined.

With the MSE steps timed (run 8, v0.5.2):

- **Slow warm starts come from Home Assistant, not the relay.** go2rtc's answer
  came 20–30 ms after the websocket opened on every warm start, and no warm feed
  was reopened. The one slow start waited 1.23 s for its signed URL from Home
  Assistant's websocket. Step 2 signs a tile's URL before it is needed.
- **Late MSE paints are the decoder holding frames back, not audio.** Over
  video only they are as late. Every H.265 stream paints 10–40 ms after its
  first data. Most H.264 sub streams wait about 16 frames: 1.0 s at 15 fps,
  1.5 s at 10 fps, and the Hallway's 7 fps sub until its next key frame. An
  H.264 SPS that sets no reorder limit (no VUI bitstream restriction, with
  picture order count type 0 or 1) lets the decoder assume B-frames. Chrome on
  macOS then keeps up to 16 decoded frames before showing the first, and stays
  that far behind. WebRTC shows frames as they are decoded, so it is not
  affected. v0.5.3 gives such streams an SPS that says frames come in decode
  order; the live check's warm line names the frame order.

With frames declared in decode order (run 9, v0.5.3):

- **No H.264 stream of these cameras sets a reorder limit**: all reported
  "limit added", sub, main and ext alike.
- **MSE now shows the first frame as soon as it arrives**: 10–30 ms after the
  first data on every stream, cold or warm. Warm MSE starts in 0.13–0.70 s
  (median 0.15 s on subs, 0.19 s on mains and ext), the Hallway's sub in 0.15 s
  (run 8: 3.69 s). Cold MSE subs start like cold WebRTC (1.08 s against 1.07 s).
- **The capacity test's first-frame rule mistook key-frame luck for a
  slowdown** (3.47 s against level 1's 0.38 s, on 4 s key frames). v0.5.4 counts
  only a first frame later than the longest key-frame interval (4.5 s) and
  3 s more.

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
- **The fragments are not MSE-ready** (Phase 2B). Each `tfhd` carries an
  absolute base data offset and there is no `tfdt`: Chrome's `MediaSource`
  refuses them, while the iPhone's `ManagedMediaSource` plays them. The
  integration rewrites each `moof` before sending it (`fmp4.py`), so both play
  from the first fragment on disk.
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

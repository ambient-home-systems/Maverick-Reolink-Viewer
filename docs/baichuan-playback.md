# Baichuan playback and talk (Phase 5a)

Status: **captured and decoded (2026-10-29).** §3–6 are from the owner's
redacted logs of the NVR (TCP) and the Doorbell (UDP).

Why: the remaining gaps the HTTP/RTSP paths cannot close (see Phase 5 in
[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md#phase-5--optional-rd-baichuan-media-difficulty-very-high-48-wk-gated)):

- **Deep starts in uncached recordings.** The RLN36 ignores HTTP `Range` and
  `start=`, so a start 41–57 min into an hour-long recording waits for the
  download up to there (6.9–13.0 s, Phase 2). The Reolink app starts at the chosen
  time at once.
- **Two-way audio (talk)** on the Doorbell.

Guardrails: clean-room from the owner's own captures; nothing copied from neolink
(AGPL-3.0); experiments only on owned devices, read-only, behind the scheduler.

## 1. What is already known

Surveyed on 2026-10-29. Sources are public; none copies code. "Verified" means a
project reports it working on real hardware; "PR" means an open, unmerged pull
request, i.e. one contributor's reading.

### 1.1 Transport, framing and ciphers (reolink-aio 0.21.18–0.22.0, neolink)

- TCP port 9000. A message is a header, an XML part and an optional rest. Header,
  little endian: magic `f0 de bc 0a` · command id (u32) · body length (u32) ·
  byte 12 the channel/handle (250 host, channel + 1, 0/251 for pushes; it is also
  the XOR cipher's offset) · byte 13 the stream type · bytes 14–15 a message
  number the client picks and the device echoes · bytes 16–17 the status code
  (24-byte headers) or the encryption flag (20-byte headers) · bytes 18–19 the
  message class · bytes 20–23 the payload offset (24-byte headers only).
  Classes: `1464` (24 bytes, client requests), `0000` (24 bytes, most device
  replies and binary continuations), `1466` (20 bytes, the nonce reply), `1465`
  (20 bytes, legacy login), and `8264` (24 bytes, "file download", seen only in
  neolink's dissector). The payload offset is the length of the `<Extension>` XML;
  what follows is the `<body>` XML or binary data.
- Login: an empty command 1 (class `1465`) asks for a nonce; the reply (class
  `1466`, flag `12dd`) carries `<Encryption><nonce>`. Then command 1 with
  `<LoginUser>` whose `userName` and `password` are the first 31 uppercase hex
  characters of MD5(name + nonce) and MD5(password + nonce), XOR-encrypted; the
  reply carries `<DeviceInfo>` (type, channel count) and `<StreamInfoList>`.
  From then on each XML part is AES-128-CFB (IV `0123456789abcdef`) with the key
  being the first 16 characters of MD5(nonce + "-" + password), a fresh cipher per
  part. The XOR cipher uses the 8-byte key `1f 2d 3c 4b 5a 69 78 ff` and the
  channel byte. The nonce reply's flag says how much is encrypted: `12dd` "full
  AES" means binary payloads are partly encrypted too, and the extension's
  `<encryptLen>` (and `<encryptPos>`) says which bytes.
- Keep-alive: command 31 every 30 s (reolink-aio) or 93 `<LinkType>` (neolink).
  Logout: command 2. cam-sim's traces of an RLC-1224A show a 12-connection limit
  and an idle close after about 32 s.

### 1.2 reolink-aio (MIT), released code

Latest 0.22.0 (2026-10-25); the integration pins 0.21.18. Released Baichuan
commands relevant here: 109 `<Snap>` (JPEG), 298 `<CoverPreview>` (a key frame
from a recording at a time, `snapshot_past`), 142 `<DayRecords>`, 272/273/274
`<findAlarmVideo>` (event search), 10 `<TalkAbility>` (only to detect the
two-way-audio capability), 14/15/16 file search (commented out). 0.22.0 adds an
unencrypted binary `payload` argument to `send()` and firmware upload (command
67). **No released version plays, downloads, seeks or talks over Baichuan**, and
`Host.get_vod_source` has no Baichuan option.

`snapshot_past` is the released code's only media parser: a 32-byte stream header
with magic `1001` (width and height at bytes 8–15, frame rate at byte 17), then a
`00dc` key frame whose header holds the codec name (`H264`/`H265`), the frame
length, an extra-header length (the header is 24 bytes plus it), a microsecond
counter and, in the extra header, the POSIX time.

Open pull requests on reolink-aio (none merged, none reviewed by the maintainer
as of 2026-10-29):

- **#164** (lorek123, 2026-04): replay over Baichuan. Command **123 `<ReplaySeek>`**
  (`channelId`, `seq` = Unix time, `seekTime` as year…second), then **5**
  `<FileInfoList><FileInfo>` with `uid`, `name`, `channelId`, `supportSub`,
  `streamType` (`mainStream`/`subStream`) and `startTime`; falls back to **8**,
  then to **381** with a binary body. The reply stream begins with a 32-byte header
  (the expected size at bytes 16–23 or 24–31) and continues as media blocks; it
  ends with status 300 or 331, which some cameras never send. **7** stops. No
  pause or speed command; pacing is done by the client from the timestamps.
- **#186** (1eft0ver, 2026-07): download over Baichuan, tested on a Video Doorbell
  PoE, Lumus Pro and E1 Zoom: 14/15/16 to list files, **13** for a file's `handle`
  and `sizeL`/`sizeH`, **8** to receive the MP4 as command-8 payload chunks of
  about 33 KB (each with `encryptLen`), **9** to release. Its Home Assistant
  companion PR was closed; the sequence was captured from Reolink's official CLI.
- **#218** (albert-canfield, 2026-10): live video for battery cameras. **3**
  `<Preview>` (`channelId`, `handle`, `streamType`, `policy` `newestIFrame`),
  pushed command-3 messages with the same message number carry the media; **4**
  stops.
- **#219** (albert-canfield, 2026-10, supersedes #165): talk. **10**
  `<TalkAbility>` → `audioConfig` (`audioType` `adpcm`, `sampleRate` 8000/16000,
  `lengthPerEncoder` 1024), `duplex` `FDX`, `audioStreamMode`
  (`followVideoStream`/`mixAudioStream`). **201 `<TalkConfig>`** (`channelId`,
  `duplex`, `audioStreamMode`, `audioConfig` with `audioType`, `sampleRate`,
  `samplePrecision` 16, `lengthPerEncoder`, `soundTrack` `mono`); 421/422 mean
  busy, cleared with **11**. **202**: audio frames behind an extension with
  `<binaryData>1</binaryData>`, one message number for the whole session, each
  frame acknowledged by a header-only push. Frame: magic `01wb`, two u16 sizes, a
  4-byte inner header, an IMA-ADPCM (DVI4) block of 1024 samples (4-byte state +
  512 bytes of nibbles), zero-padded to 8 bytes.

### 1.3 neolink (AGPL-3.0; reference only)

Master (0.6.3-rc, 2025-01) implements live video (3/4), talk (10/11/201/202,
ADPCM DVI4 16 kHz, one block per message, acknowledged) and settings; **no
recorded-video playback**. Its Wireshark dissector names about 120 ids, among
them 5 `<FileInfoList>` replay, 7 stop, 8 "DL video", 13/14/15/16 file lists,
123 `<ReplaySeek>`, 142 `<DayRecords>`, 102 `<HddInfoList>`. Open PR #396
(lorek123, 2026-04) adds replay (`disk`, `replay days|files|download`): the same
123 → 5 → 7 pattern as reolink-aio #164 with `playSpeed` allowed 1–32 but only 1
ever verified, 143/144 download by time range (binary body), 175
`<findAlarmVideo>`, and the observation that during a replay the header's status
field no longer holds 200 but the low bits of the seek's `seq`. Its 2023 draft PR
#104 documented the same flow from a pcap. Talk notes: the Video Doorbell WiFi
lists two `audioStreamMode` values; the Doorbell acknowledges talk blocks in about
99 ms, so pacing by acknowledgement starves real time (PR #420).

### 1.4 Other public sources

- **nodelink-js** (MIT, 2025–2026, `documentation/baichuan-api/recordings.md`):
  the best third-party description of replay, against real firmware including a
  Home Hub. Replay = **123 → 5 → 7**: 123 with `seq` and `seekTime`; 5 whose body
  is a `FileInfoList` with `<Id>` = the file path and an optional **`<playSpeed>`**
  (a file reopened at speed 8 was observed); 7 with `<name>` = two-digit channel
  + `YYYYMMDDHHMMSS` and `streamType`. "Seek only selects the file": every seek was
  a new 5 on a fresh handle, so **in-session seeking was not observed**. Pause is
  not covered; frames keep arriving after the stop's acknowledgement. The header's
  channel byte is used as a per-request handle echoed on replies and binary chunks;
  the logical channel travels in the XML. File search 14 → 15 → 16 pages about 40
  files; sub/main twins differ in `<Id>` and start seconds.
- **cam-sim / cam-proxy** (MIT): a Baichuan server simulator with redacted traces
  of an RLC-1224A: download 14/15/16 → 13 → 8 → 9; the first command-8 reply has
  `<binaryData>1</binaryData>` and a 32-byte `1002` record (size, width, height,
  fps, start/end, main/sub flag); chunks carry `<encryptLen>1024</encryptLen>`
  (first 1024 bytes AES, fresh IV); 12 connections; status 401 with `remainTimes`,
  405 unknown command, 431; keep-alive 93 `<LinkType>`.
- **reolink-downloader** (MIT): command **143** with a `FileInfoList` body
  (`logicChnBitmap`, `channelId`, `supportSub`, `streamType`, `startTime`,
  `endTime`) returns a **time-range cut** of a recording; an empty 143 ends it.
  This is the only server-side "seek" described so far, as a download rather
  than a stream. Read in full on 2026-10-29 (`src/reolink_downloader/baichuan.py`):
  the XML is `<FileInfoList version="1.1"><FileInfo>` with `logicChnBitmap`
  (255 on a camera), `channelId`, `supportSub` 0, `streamType`, then `startTime`
  and `endTime` as year…second; no extension; the chunks carry `encryptLen`;
  the end is a 143 with an empty body; no 144. neolink PR #396 instead sends 143
  with a **binary** body (`iChannel` u32, `cUID` 32 bytes, `logicChnBitmap` 8
  bytes, start and end as 6 × i32), takes status 300 or 331 as the end, and
  closes with **144** and an empty body; it reports 143 as 400 on an E1 (NVR
  models only). Our client (§2.2) sends the XML form with the channel's own
  bit, falls back to 255, and closes with the empty 144.
- **reostream** (AGPL-3.0, Go, `docs/protocol.md`, `docs/msgids.json` with 246
  ids): talk at wire level: all 8 tested cameras answer `<TalkAbility>` with
  ADPCM 16 kHz 16-bit mono, 1024 samples per block; `<TalkConfig>` is refused
  (400) unless the XML matches the camera's expected form exactly; 422 = the
  camera will not open a talk session; 200 does not prove the speaker plays.
  Replay (5) returned 421 on all its cameras because no replay session existed.
  Its id table names 5 and 7 "replay start/stop", 123 "replay seek", 383
  "relay v2 seek", 143 "download cut".
- **leolink** (MIT): live only; media header quirks (E1 Pro has 120–152-byte
  video headers with a metadata section; find the Annex-B start code instead).
- **Home Assistant core issue #179099**: reolink-aio's maintainer says native NVR
  files are hourly, the NVR ignores `Range`, and he is "working on
  Baichuan-protocol playback as the proper fix" (RLN8-410, RLN36 v3.6.5.597,
  RLN12W). That matches the Phase 2 measurements and makes upstreaming (5d) the
  natural end point.
- The official HTTP API guide (v8) documents no seek, start or speed parameter on
  `Playback`, `Download` or `NvrDownload`; `NvrDownload`'s time range is the only
  server-side cut over HTTP, and Phase 0 found it broken on this NVR.
- Nothing public documents an **NVR** (RLN36 or any RLN) playback session over
  port 9000, nor the desktop client's playback traffic. The client offers
  0.25×–16× (battery cameras 0.25/0.5/1×) per Reolink's support site.

### 1.5 Media framing (as described publicly)

| block | magic | header | fields |
| --- | --- | --- | --- |
| stream information | `1001` / `1002` | 32 B (a declared size at bytes 4–7) | width, height (bytes 8–15), frame rate (byte 17), start/end date (bytes 18–29 as year−1900, month, day, hour, minute, second) |
| key frame | `N0dc` (N = 0–9) | 32 B | codec `H264`/`H265` (4–7), payload size (8–11), extra header size 8 (12–15), microseconds (16–19), unknown, POSIX time (24–27) |
| frame | `N1dc` | 24 B | codec, payload size, extra header size 0, microseconds, unknown |
| AAC audio | `05wb` | 8 B | u16 size twice; ADTS payload |
| ADPCM audio | `01wb` | 8 B | u16 size twice; then u16 `0100`, u16 half block size, 4-byte DVI4 state, samples |

Payloads are zero-padded to 8 bytes. Codec labels can be wrong (Argus PT and a
Home Hub child label H.265 as `H264`); detect from the NAL units.

### 1.6 What is not known

1. **Which replay start the NVR uses**, 5 or 8 or 381 (a binary body), and the
   exact 32-byte replay header (where the size and times sit).
2. **Whether a replay can seek or change speed in session**: nodelink-js only ever
   saw a new 5 per seek; `playSpeed` was observed on reopen; nobody has seen
   pause/resume or an in-stream seek. Whether 123 alone moves a running stream.
3. **End of stream** (300/331, or nothing) and how the stop (7) drains.
4. **The status field during a replay** (neolink's "low bits of seq").
5. **`encryptLen`/`encryptPos` on an NVR** with a `12dd` login, and whether
   binary is partly encrypted.
6. **Talk on the Doorbell**: the exact `<TalkConfig>` the client sends, the
   202 message layout and the acknowledgement, and 11 at the end.
7. **Session impact**: how many connections the client opens, whether a replay
   holds one of the NVR's stream sessions, and whether it runs beside live view.
8. **Download by the client**: 8/9 by `<Id>` (cam-sim, reolink-aio #186) or 143
   by time (reolink-downloader).

## 2. The capture

Tool: `scripts/baichuan` (`python -m scripts.baichuan capture.pcapng --user
admin --out capture.log.txt`), tested on synthetic captures built with
reolink-aio's own encoder (`tests/test_baichuan_capture.py`). Steps:
[scripts/baichuan/README.md](../scripts/baichuan/README.md). The capture and the
full logs stay off the repository; only the redacted log is shared.

### 2.1 The read-only check (step 5)

The hardware probe has an opt-in **Baichuan replay** section
(`probe_baichuan.py`, the panel's "Test replay over the Reolink app's own
protocol" box). On a recorder it looks through the channels in turn, today
first and then the previous three days, for a finished sub-stream recording of
20 minutes or more (continuous recording; motion clips are too short), and
75 % into the first one found:

- opens its own Baichuan connection (`baichuan_client.py`: reolink-aio cannot
  receive the replay's message class), logs in, and does what the client does:
  123 `ReplaySeek`, 5 `FileInfoList` with `playSpeed 1`, a few seconds of the
  stream, 7 stop, logout. It records the acknowledgement latencies, the time to
  the first chunk and to the first key frame, that key frame's time against the
  seek, the blocks received, and whether anything follows the stop;
- reads the same recording's HTTP `DOWNLOAD` up to the byte offset that 75 %
  amounts to (what the serving cache fetches before such a start can play
  today) and records the time to reach it;
- asks the device's logged-in users before, during and after the replay.

Both run under the host's stream budget at playback priority. The check never
writes a setting; the report is redacted like the rest of the probe.

### 2.2 The 5b measurement (step 1)

Phase 5b's first step (IMPLEMENTATION_PLAN.md, "5b: the prototype") extends
the same opt-in section so the source of a deep start can be chosen on
numbers: the paced replay, the full-speed download cut (143), or the two
together. v0.35.0 measures, per recorder, for each camera asked for (the
**Cameras** field; every camera up to 8 when empty) and each stream (sub, and
main with **Also the HD (main) recordings**), 75 % into the longest finished
recording of 20 minutes or more of the last four days:

1. **Replay** as in §2.1: login, 123, 5 with `playSpeed 1`, a hold (5 s by
   default, up to 90), 7, logout. Now also the stream's pace (media seconds
   by the key frames' POSIX times against wall-clock seconds), its end marker
   if any, and the media analysis below.
2. **Download cut** (`baichuan_download`, on by default): a fresh login, 143
   from the same second for a 20 s cut (`startTime`/`endTime`), the data until
   the NVR's end marker (status 300 or 331, or an empty 143) or the hold, then
   144 and logout. Recorded: the reply's latency and fields (`sizeL`, `sizeH`,
   `FileCount`), whether the channel's own `logicChnBitmap` bit was accepted
   or 255 had to be sent, the time to the first chunk and the first key frame,
   that key frame's time against the asked time (**can 143 start mid-file?**),
   bytes and Mbit/s, media seconds per wall-clock second (**is it paced?**: a
   20 s cut arriving in well under 20 s is not), whether the end marker came
   within the hold and what 144 answered.
3. **What arrives**, from the blocks of both streams, keeping no media
   (`baichuan_media.py`): the codec by the NAL units (the header's label can
   be wrong), the SPS/PPS/VPS as hex with the profile, level, size and (H.264)
   reference-frame count and VUI frame rate decoded from them, the picture
   types of the first slice of each access unit (I/P/**B**: B-frames mean the
   muxer needs composition offsets), the NAL layout (Annex B or length
   prefixes), the key frames' extra-header size and the unknown header field,
   the per-frame counter's first, last, median step and steps backwards, its
   ticks per second of wall-clock time (about 1,000,000 means microseconds)
   and the frame rate that gives, and the audio: the block magic, the ADTS
   header's object type, sample rate and channels for AAC, the DVI4 block
   size for ADPCM.
4. **Session cost**: the logged-in users (`GetOnline`) before and after the
   section and during each stream; what `GetOnline` with its range exposes
   (field names, any field named like a maximum, abilities about users); and,
   with **Session test**, one replay held open while the same recording is
   downloaded over HTTP at full speed (the download's Mbit/s and the replay's
   chunks meanwhile), then a second replay of another camera on the **same
   connection** (both streams' chunks, the users, the open streams), then both
   stopped and the users after logout. Whether a replay takes one of the NVR's
   stream slots is best seen with the Live check's capacity test run while the
   hold is at 90 s: the probe holds the replay, the capacity test fills the
   slots.

The HTTP comparison (the sub recording's `DOWNLOAD` up to the 75 % offset) runs
on the sub stream only: 75 % of a main recording is gigabytes.

Every stream holds a slot of the host's stream budget at playback priority.
The report stays redacted as before; the parameter sets and the stream
headers it adds hold no identifier.

## 3. Message sequences (from the owner's capture, 2026-10-28)

Capture: the Reolink desktop client on macOS talking to the RLN36 over TCP 9000
and to the battery Video Doorbell over Baichuan's UDP framing, decoded with
`scripts/baichuan`; the owner's notes of each action tie the times to the
clicks. The client could not add the Doorbell by IP address at all: it reached
it by LAN scan and spoke UDP, as reolink-aio does.

### 3.1 Login and the connection

The NVR login is exactly reolink-aio's: the nonce request, the nonce, the
hashed `<LoginUser>`, a 12 KB `<DeviceInfo>`, AES from then on. Within 1.5 s the
client asked some 60 settings, then kept alive with 93 every 6–30 s. The client
opened three TCP connections: one it logged out of after 46 s, one refused with
401 (its saved password), and the one that carried everything else, live view,
replay, thumbnails, downloads and pushes together, on **one connection**.

### 3.2 Live view

3 `<Preview>` (`channelId`, a client-chosen `handle`, `streamType`, `policy`
`newestIFrame`) → 200 with the binary-data extension, then the stream on the
same command and handle. The NVR's first media message came 80 ms after the
request; the Doorbell answered in 45 ms with its newest key frame, 6.6–7 s old,
the same trick as the integration's key-frame cache. Stop: 4 `<Preview>` with
`channelId` and `handle`.

### 3.3 Before playback

142 `<DayRecords>` (the calendar); 14 → 15 → 16 `<FileInfoList>` (the day's
files: `name`, `Id`, sizes, start and end; 0.7 s, 60 ms per page, 0.6 s to
close); 272 → 273 → 274 `<findAlarmVideo>` (the events, 376 pages); 298
`<CoverPreview>` thumbnails, one per hour, 0.45 s each, ended by status 300.

### 3.4 Replay (the primary target)

Deep start 47 minutes into an hour-long sub-stream recording:

| time (UTC) | message | NVR's answer |
| --- | --- | --- |
| 01:50:19.025 | 56, encoding query | 54 ms |
| 01:50:19.120 | 123 `<ReplaySeek>`: `channelId 0`, `seq` (the client's Unix time), `seekTime` 05:47:33 local | 17 ms, header only |
| 01:50:19.661 | 5 `<FileInfoList>`: `channelId 18`, the file's `Id`, `uid`, `supportSub 1`, `playSpeed 1`, `streamType subStream` | 72 ms: 200 with the binary-data extension and the 32-byte stream header |

The client itself waited 0.54 s between the seek and the start. The owner saw
the picture within about a second of the click; the NVR's share is under
0.15 s: **the first media message, holding the first key frame, came 64 ms
after the start's reply, 136 ms after the request**, and the stream began at
the key frame two seconds before the seek time (09:47:31Z for a seek at
09:47:33Z). Across the nine starts of the session the first chunk followed the
request by 50–105 ms.

The replay stream arrives on the start's command and handle byte, in messages
of a class of its own (`e26a`, a 24-byte header) whose status field carries
the low bits of the seek's `seq`, each with an extension (`binaryData`,
`encryptLen 1024`) and about 39 KB of media. The NVR first sends a burst of
about six seconds, then one chunk a second: it paces the stream at the
playback speed. At `playSpeed 4` it sent every frame with audio at 4.5× real
time; at `playSpeed 16` it sent **key frames only, no audio**, at 18× real
time. After a 7 stop nothing more comes on that handle and no end marker is
sent; the stream's last chunk preceded the stop by the pacing interval.

**Every seek, speed change, pause and resume is a stop and a new start**; the
client never changes a running replay:

| action | messages |
| --- | --- |
| seek forward, seek back | 7 stop → 56 → 123 at the new time → 5 |
| 4×, 16×, back to 1× | the same, with `playSpeed` 4, 16, 1 |
| pause | 7 stop |
| resume | 56 → 123 at the paused second → 5 |
| stop | 7 |

7 `<FileInfoList>` names the file (`channelId`, `name`, `streamType`); the NVR
acknowledges it in about 20 ms. The NVR's part of a restart is about 60 ms; the
owner saw each seek land within 1–3 s and both speeds take effect.

### 3.5 Clip and whole-file download

Both went through **143**, a cut by time range (`channelId`, `streamType`,
`startTime`, `endTime`): 200 with `sizeL`/`sizeH`/`FileCount` in 100 ms, the
data on the same handle, a 143 with status 300 at the end, then the client's
**144**. The 65 s clip (4.2 MB) arrived in 0.37 s; the whole hour (219 MB) in
35 s.

### 3.6 Talk (the Doorbell, over UDP)

10 `<TalkAbility>` at session start (full duplex, ADPCM 16 kHz 16-bit mono,
1024 samples per block, two stream modes on the Doorbell). "Start talking" is
201 `<TalkConfig>` echoing that configuration with `followVideoStream`, answered
200 in 0.5–0.6 s. Then 202 messages at 15–16 per second (one 64 ms block each,
real time), all on handle 0, each acknowledged by a header-only 202 in batches
0.2–0.5 s behind. Near the end of each session the Doorbell answered some
frames with 400, 420 or 424. The close is 11 with `channelId`: 200 after 1.4 s
the first time, 400 after 8 s the second. Live view ran throughout.

## 4. XML fields

| purpose | element |
| --- | --- |
| channel | `channelId` in 123 (0) and in 5/7/143 (the NVR channel) |
| stream | `streamType` `subStream`/`mainStream` in 5, 7, 143, 3 |
| file | `Id` in 5 (`C-CH-S-<stamp>-NNNNN`); `name` in 7 (channel + 1, then the local start time) |
| start time | `seekTime` (year…second, camera-local) in 123; `startTime`/`endTime` in 143 |
| seek | a new 123 → 5; `seq` = the client's Unix time |
| speed | `playSpeed` in 5 (1, 4, 16 seen) |
| end of a stream | status 300 on the stream's own command (143, 298); replay: none |
| download cut | 143 with `logicChnBitmap`, `channelId`, `supportSub`, `streamType`, `startTime`, `endTime`; closed by 144 (empty) |

A side finding for the timeline: the 14-digit stamp in a file `Id`, which Phase 2
could not place, is the file's start time in UTC with a zero-based month.

## 5. Media framing as captured

The stream header, key frames, frames and audio blocks are summarized per
message by `scripts/baichuan/media.py` (block kind, codec, size, timestamps,
padding) and agree with §1.5 on the NVR's live, replay and download streams:
the same blocks in all three, H.264 sub stream with AAC audio, key frames about
once a second, the first `encryptLen` bytes of each chunk AES-encrypted. A
chunk boundary falls anywhere, so blocks are reassembled across chunks. The
Doorbell's key frames carry a longer extra header than the NVR's, and its
padding is not a multiple of 8, so a reader must find the next block by its
magic rather than by rounding.

## 6. Session impact

- The client used one TCP connection to the NVR for live view, replay,
  thumbnails and downloads at once; a replay restarted while a 143 download ran,
  and 298 thumbnails were fetched during a replay. Each stream has its own
  handle byte, so several can share the connection.
- A replay was paced by the NVR at the playback speed (about 60 KB/s of sub
  stream at 1×), so it holds the connection for as long as it plays, like a live
  stream. Whether it takes one of the NVR's stream slots cannot be read from the
  capture; the read-only check (step 5) measures it against the stream budget.
- The Doorbell: one UDP conversation; live view and talk ran together (full
  duplex); 898 heartbeats (234) and about 78,000 acknowledgements in 15 minutes.

### 6.1 The read-only check's run (2026-10-29, v0.34.1)

The owner ran the check from the hardware probe on the RLN36, from Home
Assistant, with the usual live feeds up. It settled on the Garage Camera
(RLC-520A, NVR channel 16): a sub-stream recording of 23 min 38 s from
2026-10-26 (65 MB, 367 kbit/s), and went 75 % in (17 min 43 s, 48.8 MB).

| step | measured |
| --- | --- |
| Login (nonce, then the login) | 3 ms + 46 ms |
| 123 `ReplaySeek` acknowledged | 13 ms |
| 5 `FileInfoList` acknowledged | 41 ms, the first chunk with it |
| First key frame | **140 ms after the start request**, its time 3 s before the seek (the previous key frame; the GOP is 4 s) |
| 5 s hold | 372 chunks, 556 KB, 3 key frames, 177 frames, 188 audio blocks (about 12 s of video: the 6 s burst, then paced) |
| 7 stop acknowledged | 21 ms; nothing after it |
| Logged-in users | 2 before, **3 during**, 2 after |
| Wait for a stream-budget slot | 0 ms (both paths) |
| HTTP `DOWNLOAD` to the same offset | first byte 189 ms, **4.67 s to 48.8 MB** at 87 Mbit/s |

What it settles:

- **A deep start over Baichuan costs the NVR about 0.2 s** (login, seek, start,
  first key frame), against 4.7 s for the HTTP download up to the same point of
  a short sub recording, and that download grows with the offset: 75 % into the
  hour-long main recordings on this NVR (2.4–2.8 GB) is 1.8–2.1 GB, minutes at
  this link's 87 Mbit/s. Phase 2B measured 6.9–13.0 s for sub-stream deep starts
  at 41–57 min from the Mac. The Reolink app's start is not in the NVR but in
  what it is asked for.
- **The replay connection is one more logged-in user** for as long as it is
  open, and it is released at logout. It started at once beside the live feeds,
  so a replay is not refused when the live slots are busy; whether it holds one
  of the NVR's stream slots is still unmeasured (the capacity test with a replay
  open would show it) and the stream budget treats it as a stream anyway.
- The stream is what the capture showed: a burst, then pacing at the playback
  speed, key frames at 4 s on this camera, nothing after the stop.

## 7. Sources

- reolink-aio: <https://github.com/starkillerOG/reolink_aio> (`reolink_aio/baichuan/`),
  PRs [#164](https://github.com/starkillerOG/reolink_aio/pull/164),
  [#186](https://github.com/starkillerOG/reolink_aio/pull/186),
  [#218](https://github.com/starkillerOG/reolink_aio/pull/218),
  [#219](https://github.com/starkillerOG/reolink_aio/pull/219)
- neolink: <https://github.com/QuantumEntangledAndy/neolink> (`dissector/`,
  `crates/core/src/bc_protocol/talk.rs`), PRs
  [#104](https://github.com/QuantumEntangledAndy/neolink/pull/104),
  [#396](https://github.com/QuantumEntangledAndy/neolink/pull/396),
  [#420](https://github.com/QuantumEntangledAndy/neolink/pull/420)
- nodelink-js: <https://github.com/apocaliss92/nodelink-js>
  (`documentation/baichuan-api/recordings.md`, `intercom.md`)
- cam-sim: <https://github.com/klaushofrichter/cam-sim> (`reference/rlc-1224a/baichuan/`)
- reolink-downloader: <https://github.com/deviantintegral/reolink-downloader>
- reostream: <https://github.com/VoltTech21/reostream> (`docs/protocol.md`, `docs/msgids.json`)
- leolink: <https://github.com/tombueng/leolink> (`docs/protocol.md`)
- Home Assistant core issue [#179099](https://github.com/home-assistant/core/issues/179099)
  and PR [#177436](https://github.com/home-assistant/core/pull/177436)
- Reolink support, playback speeds: <https://support.reolink.com/articles/900000673643-How-to-Adjust-the-Recordings-Playback-Speed-for-Reolink-Devices/>

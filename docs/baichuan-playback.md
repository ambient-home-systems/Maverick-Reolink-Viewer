# Baichuan playback and talk (Phase 5a)

Status: **prior art gathered and the capture tool built (2026-10-29); the capture
of the Reolink desktop client is pending.** Sections 4–7 are filled from the
owner's redacted log; until then they list what the log must answer.

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
  than a stream.
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

## 3. Message sequences

*To be filled from the log:* login; playback start deep inside a recording;
seek forward and back; speed changes; pause and resume; stop; a clip download;
talk on the Doorbell.

## 4. XML fields

*To be filled from the log:* the elements that select the channel, the stream,
the start time, a seek and the speed, with the values the client sent.

## 5. Media framing as captured

*To be filled from the log:* the stream header, the frame headers, padding and
the audio blocks the RLN36 and the Doorbell actually send, against §1.5.

## 6. Session impact

*To be filled from the log and the read-only experiment:* connections per
device, whether a replay takes one of the NVR's stream slots, and whether it
runs beside live view and HTTP downloads.

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

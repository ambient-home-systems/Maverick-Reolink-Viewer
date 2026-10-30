"""Baichuan media blocks to fragmented MP4 for Media Source Extensions (Phase 5b).

The NVR's download cut (command 143, docs/baichuan-playback.md §1.4 and §6.3)
delivers raw blocks: key frames and frames as Annex B access units with a
32-bit counter, AAC as ADTS. :class:`BaichuanMuxer` turns them into what the
MSE player appends, in the layout :class:`fmp4.FragmentIndex` indexes:

- an init segment (``ftyp`` + ``moov`` with ``mvex``): a video track built
  from the stream's own parameter sets (``avcC`` or ``hvcC``, the picture
  size from the SPS) and, when the stream carries AAC, an audio track (its
  ``esds`` from the first ADTS header);
- one fragment per group of pictures (``moof`` + ``mdat``), written when the
  next key frame arrives (or the stream ends): every ``traf`` with
  ``default-base-is-moof`` and a ``tfdt``, ``trun`` data offsets relative to
  the ``moof``, samples as 4-byte length-prefixed NAL units.

Times are the recording's media time (0 at ``origin_unix``, the recording's
start in UTC), so a fragment cut deep in a recording sits where the same
moment sits in the NVR's file. The first key frame is placed by its POSIX
time (whole seconds); the frames after it by the counter, whose rate differs
per camera by up to 2 % (§6.3), so the rate is learned from the key frames'
POSIX times once they span a minute, and each later key frame is placed on
that clock (the drift is taken up by the last frame of each group). The
streams of run 2 hold I and P pictures only: decode order is presentation
order, so no composition offsets are written.

Parameter sets equal to the init segment's are taken out of the samples;
changed ones stay in band. Audio follows on its own clock (1024 samples per
AAC frame), started at the first key frame and moved back into line with the
video when the two drift more than a second apart. ADPCM is not muxed.

Pure byte work, no I/O.
"""

from dataclasses import dataclass
import struct

from .baichuan_media import (
    ADTS_SAMPLE_RATES,
    Block,
    detect_codec,
    h264_nal_type,
    h265_config_header,
    h265_nal_type,
    nal_units,
    parse_h264_sps,
    parse_h265_sps,
)

VIDEO_TIMESCALE = 90_000
VIDEO_TRACK = 1
AUDIO_TRACK = 2
# The counter ticks about a million times a second (999,790 to about 1,020,000).
NOMINAL_RATE = 1_000_000
RATE_MIN = 950_000
RATE_MAX = 1_050_000
# Key frames at least this far apart (POSIX seconds) set the counter's rate.
RATE_SPAN_S = 60
# The first key frame's POSIX time is trusted this close to the asked time.
ANCHOR_TOLERANCE_S = 30.0
# Audio this far from the video (s) is moved back into line (or dropped).
AUDIO_RESYNC_S = 2.0
# How much of a frame's duration a correction toward the key frames' clock
# may take (a learned rate, a counter glitch): a tenth, about unseen.
CORRECTION = 0.1
AAC_FRAME = 1024
# A frame's least duration (s), and the last frame's when nothing follows.
MIN_FRAME_S = 0.001
DEFAULT_FRAME_S = 1 / 15
SYNC = 0x02000000  # sample_depends_on 2: an I picture
NON_SYNC = 0x01010000  # depends on others, not a sync sample
_TFHD_BASE_IS_MOOF = 0x020000
_TFHD_DEFAULT_FLAGS = 0x20
_TRUN_VIDEO = 0x701  # data offset, durations, sizes, flags
_TRUN_AUDIO = 0x301  # data offset, durations, sizes
_H264_SETS = {7: "sps", 8: "pps"}
_H265_SETS = {32: "vps", 33: "sps", 34: "pps"}
_H264_AUD = 9
_H265_AUD = 35
_MATRIX = struct.pack(">9I", 0x10000, 0, 0, 0, 0x10000, 0, 0, 0, 0x40000000)


class MuxError(Exception):
    """The blocks cannot be made into fragments."""


@dataclass(slots=True)
class MuxStats:
    """What the muxer took, dropped and decided (for the debug panel)."""

    key_frames: int = 0
    frames: int = 0
    dropped_frames: int = 0
    audio_frames: int = 0
    dropped_audio: int = 0
    audio_resyncs: int = 0
    fragments: int = 0
    bytes: int = 0
    rate: int = NOMINAL_RATE
    rate_learned: bool = False
    anchor: str | None = None
    anchor_offset_s: float | None = None
    parameter_set_changes: int = 0
    counter_steps_back: int = 0

    def as_dict(self) -> dict[str, object]:
        """Return the numbers (no media)."""
        return {
            "key_frames": self.key_frames,
            "frames": self.frames,
            "dropped_frames": self.dropped_frames,
            "audio_frames": self.audio_frames,
            "dropped_audio": self.dropped_audio,
            "audio_resyncs": self.audio_resyncs,
            "fragments": self.fragments,
            "bytes": self.bytes,
            "counter_rate": self.rate,
            "rate_learned": self.rate_learned,
            "anchor": self.anchor,
            "anchor_offset_s": self.anchor_offset_s,
            "parameter_set_changes": self.parameter_set_changes,
            "counter_steps_back": self.counter_steps_back,
        }


@dataclass(slots=True)
class _Video:
    data: bytes
    time: float  # media seconds
    key: bool


@dataclass(slots=True)
class _Audio:
    data: bytes
    time: int  # in samples


@dataclass(slots=True)
class _AudioConfig:
    object_type: int
    rate_index: int
    channels: int

    @property
    def sample_rate(self) -> int:
        return ADTS_SAMPLE_RATES[self.rate_index]

    def specific(self) -> bytes:
        """AudioSpecificConfig: object type, rate index, channels (ISO 14496-3)."""
        bits = (self.object_type << 11) | (self.rate_index << 7) | (self.channels << 3)
        return struct.pack(">H", bits)


@dataclass(slots=True)
class _Clock:
    """The counter, unwrapped, and where the first key frame sits."""

    last_micro: int | None = None
    counter: int = 0
    first_counter: int = 0
    first_time: float = 0.0
    first_unix: int | None = None
    rate: int = NOMINAL_RATE

    def advance(self, micro: int, stats: MuxStats) -> int:
        if self.last_micro is not None:
            delta = (micro - self.last_micro) & 0xFFFFFFFF
            if delta >= 1 << 31:
                # Back in time: a reset or a glitch; count on from here.
                stats.counter_steps_back += 1
                delta = 0
            self.counter += delta
        self.last_micro = micro
        return self.counter

    def at(self, counter: int) -> float:
        return self.first_time + (counter - self.first_counter) / self.rate


class BaichuanMuxer:
    """Blocks in; the init segment, then fragments out (see the module doc)."""

    def __init__(self, origin_unix: float, asked_unix: float | None = None) -> None:
        """Mux a stream of one recording.

        ``origin_unix``: the recording's start (UTC POSIX seconds), media time
        0. ``asked_unix``: the moment asked for; the first key frame is placed
        there if its own POSIX time is far from it (a device clock off).
        """
        self._origin = origin_unix
        self._asked = asked_unix
        self.stats = MuxStats()
        self.codec: str | None = None  # h264, h265
        self.init: bytes | None = None
        self.mime: str | None = None
        self.width = 0
        self.height = 0
        self._sets: dict[int, bytes] = {}
        self._init_sets: frozenset[bytes] = frozenset()
        self._clock = _Clock()
        self._started = False
        self._gop: list[_Video] = []
        self._last_time = 0.0
        self._last_counter = 0
        self._audio: list[_Audio] = []
        self._audio_config: _AudioConfig | None = None
        self._audio_next: int | None = None
        self._sequence = 0

    @property
    def first_time(self) -> float | None:
        """Return the media time (s) of the first key frame, once there is one."""
        return self._clock.first_time if self._started else None

    def feed(self, block: Block) -> list[bytes]:
        """Take one block; return the init segment and fragments it completes."""
        if block.kind in ("key", "frame"):
            return self._video(block)
        if block.kind == "audio":
            self._take_audio(block)
        return []

    def finish(self) -> list[bytes]:
        """Close the last group of pictures (the stream ended)."""
        if not self._gop:
            return []
        durations = [
            b.time - a.time for a, b in zip(self._gop, self._gop[1:], strict=False)
        ]
        last = sorted(durations)[len(durations) // 2] if durations else DEFAULT_FRAME_S
        return self._close_gop(self._gop[-1].time + max(last, MIN_FRAME_S))

    # ---- Video ----

    def _video(self, block: Block) -> list[bytes]:
        key = block.kind == "key"
        if block.micro is None or (not key and not self._started):
            self.stats.dropped_frames += 1
            return []
        _layout, units = nal_units(block.payload)
        if not units:
            self.stats.dropped_frames += 1
            return []
        if self.codec is None:
            self.codec = detect_codec(units, block.codec)
            if self.codec is None:
                self.stats.dropped_frames += 1
                return []
        hevc = self.codec == "h265"
        if key:
            self._keep_sets(units, hevc)
        counter = self._clock.advance(block.micro, self.stats)
        out: list[bytes] = []
        if key:
            self.stats.key_frames += 1
            if not self._started:
                self._start(counter, block.unix_time)
                time = self._clock.first_time
            else:
                self._learn_rate(counter, block.unix_time)
                time = self._place(counter)
                out = self._close_gop(time)
        else:
            self.stats.frames += 1
            time = self._place(counter)
        # A dropped frame's time goes to the frame before it.
        self._last_time = time
        self._last_counter = counter
        sample = self._sample(units, hevc)
        if not sample:
            self.stats.dropped_frames += 1
            return out
        self._gop.append(_Video(sample, time, key))
        return out

    def _place(self, counter: int) -> float:
        """Return a frame's media time.

        The counter's step from the frame before, moved toward the key frames'
        clock by at most ``CORRECTION`` of the step.
        """
        step = (counter - self._last_counter) / self._clock.rate
        error = self._clock.at(counter) - (self._last_time + step)
        limit = CORRECTION * step
        time = self._last_time + step + min(max(error, -limit), limit)
        return max(time, self._last_time + MIN_FRAME_S)

    def _start(self, counter: int, unix: int | None) -> None:
        clock = self._clock
        clock.first_counter = counter
        plausible = unix is not None and 1_500_000_000 < unix < 2_100_000_000
        if plausible and unix is not None:
            clock.first_unix = unix
        asked = self._asked
        offset = None if not plausible or asked is None else unix - asked  # type: ignore[operator]
        self.stats.anchor_offset_s = None if offset is None else round(offset, 3)
        if plausible and (offset is None or abs(offset) <= ANCHOR_TOLERANCE_S):
            clock.first_time = unix - self._origin  # type: ignore[operator]
            self.stats.anchor = "key frame time"
        elif asked is not None:
            clock.first_time = asked - self._origin
            self.stats.anchor = "asked time"
        else:
            raise MuxError("the first key frame has no time and none was asked")
        clock.first_time = max(clock.first_time, 0.0)
        self._started = True

    def _learn_rate(self, counter: int, unix: int | None) -> None:
        clock = self._clock
        if (
            unix is None
            or clock.first_unix is None
            or unix - clock.first_unix < RATE_SPAN_S
        ):
            return
        rate = (counter - clock.first_counter) / (unix - clock.first_unix)
        clock.rate = round(min(max(rate, RATE_MIN), RATE_MAX))
        self.stats.rate = clock.rate
        self.stats.rate_learned = True

    def _keep_sets(self, units: list[bytes], hevc: bool) -> None:
        kinds = _H265_SETS if hevc else _H264_SETS
        for unit in units:
            kind = h265_nal_type(unit) if hevc else h264_nal_type(unit)
            if kind in kinds:
                if self.init is not None and unit not in self._init_sets:
                    self.stats.parameter_set_changes += 1
                self._sets.setdefault(kind, unit)

    def _sample(self, units: list[bytes], hevc: bool) -> bytes:
        """Return the access unit as 4-byte length-prefixed NAL units.

        Without the delimiter and the parameter sets the init segment holds.
        """
        out = bytearray()
        aud = _H265_AUD if hevc else _H264_AUD
        for unit in units:
            kind = h265_nal_type(unit) if hevc else h264_nal_type(unit)
            if (
                kind == aud
                or unit in self._init_sets
                or (self.init is None and unit in self._sets.values())
            ):
                continue
            out += struct.pack(">I", len(unit)) + unit
        return bytes(out)

    # ---- Audio ----

    def _take_audio(self, block: Block) -> None:
        frames = _adts_frames(block.payload)
        if not frames or not self._started:
            self.stats.dropped_audio += max(len(frames), 1)
            return
        for config, raw in frames:
            if self._audio_config is None:
                if self.init is not None:
                    # The init segment went out without an audio track.
                    self.stats.dropped_audio += 1
                    continue
                self._audio_config = config
            elif config != self._audio_config:
                self.stats.dropped_audio += 1
                continue
            rate = self._audio_config.sample_rate
            video_now = round(self._last_time * rate)
            if self._audio_next is None:
                self._audio_next = video_now
            drift = (self._audio_next - video_now) / rate
            if drift < -AUDIO_RESYNC_S:
                self._audio_next = video_now
                self.stats.audio_resyncs += 1
            elif drift > AUDIO_RESYNC_S:
                self.stats.dropped_audio += 1
                continue
            self._audio.append(_Audio(raw, self._audio_next))
            self._audio_next += AAC_FRAME
            self.stats.audio_frames += 1

    # ---- Output ----

    def _close_gop(self, end: float) -> list[bytes]:
        """Write the open group of pictures as a fragment; it ends at ``end``."""
        gop, self._gop = self._gop, []
        if not gop:
            return []
        out: list[bytes] = []
        if self.init is None:
            init = self._build_init()
            if init is None:
                # Parameter sets incomplete: nothing can be decoded yet.
                self.stats.dropped_frames += len(gop)
                self._audio.clear()
                return []
            self.init = init
            out.append(init)
            # Samples taken before the init's sets were known kept nothing out.
        audio, self._audio = self._audio, []
        fragment = self._fragment(gop, end, audio)
        self.stats.fragments += 1
        self.stats.bytes += len(fragment)
        out.append(fragment)
        return out

    def _build_init(self) -> bytes | None:
        hevc = self.codec == "h265"
        needed = _H265_SETS if hevc else _H264_SETS
        if any(kind not in self._sets for kind in needed):
            return None
        try:
            if hevc:
                sps = parse_h265_sps(self._sets[33])
                config = _hvcc(self._sets, sps)
                entry_type, config_type = b"hvc1", b"hvcC"
            else:
                sps = parse_h264_sps(self._sets[7])
                config = _avcc(self._sets[7], self._sets[8], sps)
                entry_type, config_type = b"avc1", b"avcC"
        except ValueError, IndexError:
            return None
        self.width, self.height = int(sps["width"]), int(sps["height"])  # type: ignore[call-overload]
        self._init_sets = frozenset(self._sets.values())
        video_entry = _box(
            entry_type,
            _visual_fields(self.width, self.height) + _box(config_type, config),
        )
        codecs = [str(sps["codec"])]
        tracks = [
            _trak(
                VIDEO_TRACK,
                VIDEO_TIMESCALE,
                b"vide",
                video_entry,
                size=(self.width, self.height),
            )
        ]
        audio = self._audio_config
        if audio is not None:
            tracks.append(_trak(AUDIO_TRACK, audio.sample_rate, b"soun", _mp4a(audio)))
            codecs.append(f"mp4a.40.{audio.object_type}")
        self.mime = f'video/mp4; codecs="{",".join(codecs)}"'
        mvex = _box(
            b"mvex",
            b"".join(
                _full_box(b"trex", 0, 0, struct.pack(">5I", track, 1, 0, 0, 0))
                for track in (VIDEO_TRACK, AUDIO_TRACK)[: len(tracks)]
            ),
        )
        mvhd = _full_box(
            b"mvhd",
            0,
            0,
            struct.pack(">4I", 0, 0, 1000, 0)
            + struct.pack(">IH", 0x10000, 0x100)
            + bytes(10)
            + _MATRIX
            + bytes(24)
            + struct.pack(">I", len(tracks) + 1),
        )
        ftyp = _box(b"ftyp", b"iso5" + struct.pack(">I", 512) + b"iso5iso6mp41")
        return ftyp + _box(b"moov", mvhd + b"".join(tracks) + mvex)

    def _fragment(self, gop: list[_Video], end: float, audio: list[_Audio]) -> bytes:
        self._sequence += 1
        ticks = [round(sample.time * VIDEO_TIMESCALE) for sample in gop]
        ticks.append(max(round(end * VIDEO_TIMESCALE), ticks[-1] + 1))
        video_rows = [
            (ticks[i + 1] - ticks[i], len(s.data), SYNC if s.key else NON_SYNC)
            for i, s in enumerate(gop)
        ]
        audio_rows = [(AAC_FRAME, len(a.data)) for a in audio]

        def moof(video_offset: int, audio_offset: int) -> bytes:
            trafs = _traf(
                VIDEO_TRACK,
                ticks[0],
                tfhd=(_TFHD_BASE_IS_MOOF, b""),
                trun=(_TRUN_VIDEO, video_offset, len(video_rows)),
                rows=b"".join(struct.pack(">3I", *row) for row in video_rows),
            )
            if audio:
                trafs += _traf(
                    AUDIO_TRACK,
                    audio[0].time,
                    tfhd=(
                        _TFHD_BASE_IS_MOOF | _TFHD_DEFAULT_FLAGS,
                        struct.pack(">I", SYNC),
                    ),
                    trun=(_TRUN_AUDIO, audio_offset, len(audio_rows)),
                    rows=b"".join(struct.pack(">2I", *row) for row in audio_rows),
                )
            mfhd = _full_box(b"mfhd", 0, 0, struct.pack(">I", self._sequence))
            return _box(b"moof", mfhd + trafs)

        size = len(moof(0, 0))
        video_bytes = sum(len(s.data) for s in gop)
        header = moof(size + 8, size + 8 + video_bytes)
        mdat = _box(
            b"mdat", b"".join(s.data for s in gop) + b"".join(a.data for a in audio)
        )
        return header + mdat


# ---- Boxes ----


def _box(box_type: bytes, payload: bytes) -> bytes:
    return struct.pack(">I4s", 8 + len(payload), box_type) + payload


def _full_box(box_type: bytes, version: int, flags: int, payload: bytes) -> bytes:
    return _box(box_type, struct.pack(">I", (version << 24) | flags) + payload)


def _traf(
    track: int,
    decode: int,
    *,
    tfhd: tuple[int, bytes],
    trun: tuple[int, int, int],
    rows: bytes,
) -> bytes:
    """Return a traf: tfhd (flags, its fields), tfdt, trun (flags, offset, count)."""
    tfhd_flags, tfhd_extra = tfhd
    trun_flags, offset, count = trun
    header = _full_box(b"tfhd", 0, tfhd_flags, struct.pack(">I", track) + tfhd_extra)
    tfdt = _full_box(b"tfdt", 1, 0, struct.pack(">Q", decode))
    run = _full_box(b"trun", 0, trun_flags, struct.pack(">Ii", count, offset) + rows)
    return _box(b"traf", header + tfdt + run)


def _trak(
    track: int,
    timescale: int,
    handler: bytes,
    entry: bytes,
    *,
    size: tuple[int, int] = (0, 0),
) -> bytes:
    width, height = size
    audio = handler == b"soun"
    tkhd = _full_box(
        b"tkhd",
        0,
        3,  # enabled, in the movie
        struct.pack(">5I", 0, 0, track, 0, 0)
        + bytes(8)
        + struct.pack(">hhhh", 0, 0, 0x100 if audio else 0, 0)
        + _MATRIX
        + struct.pack(">II", width << 16, height << 16),
    )
    mdhd = _full_box(b"mdhd", 0, 0, struct.pack(">4IHH", 0, 0, timescale, 0, 0x55C4, 0))
    name = b"SoundHandler\0" if audio else b"VideoHandler\0"
    hdlr = _full_box(b"hdlr", 0, 0, bytes(4) + handler + bytes(12) + name)
    media_header = (
        _full_box(b"smhd", 0, 0, bytes(4))
        if audio
        else _full_box(b"vmhd", 0, 1, bytes(8))
    )
    dinf = _box(
        b"dinf",
        _full_box(b"dref", 0, 0, struct.pack(">I", 1) + _full_box(b"url ", 0, 1, b"")),
    )
    stbl = _box(
        b"stbl",
        _full_box(b"stsd", 0, 0, struct.pack(">I", 1) + entry)
        + _full_box(b"stts", 0, 0, bytes(4))
        + _full_box(b"stsc", 0, 0, bytes(4))
        + _full_box(b"stsz", 0, 0, bytes(8))
        + _full_box(b"stco", 0, 0, bytes(4)),
    )
    minf = _box(b"minf", media_header + dinf + stbl)
    return _box(b"trak", tkhd + _box(b"mdia", mdhd + hdlr + minf))


def _visual_fields(width: int, height: int) -> bytes:
    """Return a VisualSampleEntry's fields before its child boxes (78 bytes)."""
    return (
        bytes(6)
        + struct.pack(">H", 1)  # data_reference_index
        + bytes(16)
        + struct.pack(">HH", width, height)
        + struct.pack(">II", 0x480000, 0x480000)  # 72 dpi
        + bytes(4)
        + struct.pack(">H", 1)  # frame_count
        + bytes(32)  # compressorname
        + struct.pack(">Hh", 0x18, -1)
    )


def _avcc(sps: bytes, pps: bytes, info: dict[str, object]) -> bytes:
    """AVCDecoderConfigurationRecord with one SPS and one PPS (4-byte lengths)."""
    body = bytes([1, sps[1], sps[2], sps[3], 0xFF, 0xE1])
    body += (
        struct.pack(">H", len(sps))
        + sps
        + bytes([1])
        + struct.pack(">H", len(pps))
        + pps
    )
    if sps[1] in (100, 110, 122, 144):
        chroma = int(info.get("chroma_format_idc", 1))  # type: ignore[call-overload]
        depth = int(info.get("bit_depth", 8)) - 8  # type: ignore[call-overload]
        body += bytes([0xFC | chroma, 0xF8 | depth, 0xF8 | depth, 0])
    return body


def _hvcc(sets: dict[int, bytes], info: dict[str, object]) -> bytes:
    """HEVCDecoderConfigurationRecord: the SPS's profile, then VPS, SPS, PPS."""
    header = h265_config_header(sets[33])
    chroma = int(info.get("chroma_format_idc", 1))  # type: ignore[call-overload]
    depth = int(info.get("bit_depth", 8)) - 8  # type: ignore[call-overload]
    body = bytearray(header)
    body += struct.pack(">H", 0xF000)  # min_spatial_segmentation_idc 0
    body += bytes([0xFC, 0xFC | chroma, 0xF8 | depth, 0xF8 | depth])
    body += struct.pack(">H", 0)  # avgFrameRate unknown
    # constantFrameRate 0, one temporal layer, nested, 4-byte lengths.
    body += bytes([(1 << 3) | (1 << 2) | 3, 3])
    for kind in (32, 33, 34):
        unit = sets[kind]
        body += bytes([0x80 | kind]) + struct.pack(">HH", 1, len(unit)) + unit
    return bytes(body)


def _mp4a(config: _AudioConfig) -> bytes:
    """Return an mp4a sample entry with its esds (AAC from the ADTS header)."""
    specific = config.specific()
    decoder_specific = bytes([0x05, len(specific)]) + specific
    decoder_config = (
        bytes([0x04, 13 + len(decoder_specific), 0x40, 0x15])
        + bytes(3)  # bufferSizeDB
        + bytes(8)  # max and average bitrate unknown
        + decoder_specific
    )
    sl_config = bytes([0x06, 1, 2])
    es = struct.pack(">HB", 0, 0) + decoder_config + sl_config
    esds = _full_box(b"esds", 0, 0, bytes([0x03, len(es)]) + es)
    fields = (
        bytes(6)
        + struct.pack(">H", 1)
        + bytes(8)
        + struct.pack(">HH", config.channels or 1, 16)
        + bytes(4)
        + struct.pack(">I", config.sample_rate << 16)
    )
    return _box(b"mp4a", fields + esds)


def _adts_frames(payload: bytes) -> list[tuple[_AudioConfig, bytes]]:
    """Split ADTS into (its configuration, the raw AAC frame); [] if not ADTS."""
    frames: list[tuple[_AudioConfig, bytes]] = []
    at = 0
    while at + 7 <= len(payload):
        b = payload
        if b[at] != 0xFF or (b[at + 1] & 0xF6) != 0xF0:
            break
        protection_absent = b[at + 1] & 1
        profile = b[at + 2] >> 6
        rate_index = (b[at + 2] >> 2) & 0x0F
        channels = ((b[at + 2] & 1) << 2) | (b[at + 3] >> 6)
        length = ((b[at + 3] & 3) << 11) | (b[at + 4] << 3) | (b[at + 5] >> 5)
        header = 7 if protection_absent else 9
        if (
            length <= header
            or at + length > len(payload)
            or rate_index >= len(ADTS_SAMPLE_RATES)
        ):
            break
        config = _AudioConfig(profile + 1, rate_index, channels)
        frames.append((config, payload[at + header : at + length]))
        at += length
    return frames

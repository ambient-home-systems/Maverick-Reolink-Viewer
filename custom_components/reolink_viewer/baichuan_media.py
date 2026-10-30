"""Baichuan media blocks: reassembly, and what a stream holds (Phase 5b, step 1).

A Baichuan media stream (live, replay, a download by time range) is a sequence
of blocks, each with a 4-character magic (docs/baichuan-playback.md §1.5 and
§5): ``100x`` stream information (a 32-byte header), ``N0dc`` a video key
frame (a 24-byte header plus an extra header, 8 bytes on the NVR, holding the
POSIX time), ``N1dc`` a video frame (24 bytes), ``0Nwb`` audio (8 bytes; AAC
as ADTS, or ADPCM). Payloads are zero-padded, and a chunk boundary falls
anywhere, so :class:`BlockReader` reassembles blocks across chunks and finds
the next one by its magic rather than by rounding.

:class:`StreamAnalysis` then decodes what the 5b muxer will need, without
keeping any media: the video codec from the NAL units themselves (the label
in the header can be wrong), the parameter sets (SPS/PPS/VPS, kept as hex),
the profile and level, the picture types (B-frames mean composition offsets),
the frame timestamps and their units, and the audio codec and its
configuration (AAC object type, sample rate, channels). Its ``as_dict`` is
safe to put in the redacted probe report: counts, sizes, times and parameter
sets, nothing else.
"""

from collections import Counter
from collections.abc import Iterator
from dataclasses import dataclass, field
import re
import statistics
import struct

from .mp4 import hevc_codec_string

MAGIC_RE = re.compile(rb"[0-9][01]dc|0[0-9]wb|100[0-9]")
INFO_HEADER = 32
FRAME_HEADER = 24
AUDIO_HEADER = 8
RESYNC_WINDOW = 68
MAX_BLOCK = 16 * 1024 * 1024
# How many of each are kept in the analysis.
MAX_PARAMETER_SETS = 4
MAX_DELTAS = 4000
MAX_SAMPLES = 8
# Raw samples kept for the report (hex): the first few blocks whose payload
# holds no NAL unit, and the bytes around the first few resyncs, so a layout
# the reader does not know can be decoded from the report.
MAX_RAW_SAMPLES = 3
RAW_SAMPLE_BYTES = 64
_START_CODES = (b"\x00\x00\x00\x01", b"\x00\x00\x01")
ADTS_SAMPLE_RATES = (
    96000,
    88200,
    64000,
    48000,
    44100,
    32000,
    24000,
    22050,
    16000,
    12000,
    11025,
    8000,
    7350,
)
_H264_HIGH_PROFILES = frozenset(
    {100, 110, 122, 244, 44, 83, 86, 118, 128, 138, 139, 134, 135}
)
_H264_SLICE_TYPES = ("P", "B", "I", "SP", "SI")
_H265_SLICE_TYPES = ("B", "P", "I")


@dataclass(frozen=True, slots=True)
class Block:
    """One media block, with its payload."""

    kind: str  # info, key, frame, audio
    magic: bytes
    header: bytes
    payload: bytes
    codec: str = ""  # the label in a video header (H264/H265)
    micro: int | None = None  # the header's counter (bytes 16-19)
    unix_time: int | None = None  # key frames: the extra header's POSIX time
    unknown: int | None = None  # bytes 20-23 of a video header
    pad: int = 0

    @property
    def size(self) -> int:
        """Return the payload size the header declared."""
        return len(self.payload)


class BlockReader:
    """Reassembles blocks from the chunks of one stream."""

    def __init__(self) -> None:
        """Start empty."""
        self._buffer = bytearray()
        self.resyncs = 0
        self.skipped_bytes = 0
        self.implausible = 0
        self.resync_samples: list[dict[str, object]] = []
        self._last_end: bytes = b""

    @property
    def pending(self) -> int:
        """Return the bytes held that do not make a block yet."""
        return len(self._buffer)

    def feed(self, data: bytes) -> list[Block]:
        """Add a chunk; return the blocks completed by it."""
        self._buffer += data
        blocks: list[Block] = []
        while (block := self._next()) is not None:
            if block.kind:
                blocks.append(block)
        return blocks

    def _next(self) -> Block | None:
        buf = self._buffer
        if len(buf) < 8:
            return None
        magic = bytes(buf[:4])
        if not MAGIC_RE.fullmatch(magic):
            found = MAGIC_RE.search(buf, 1)
            if found is None:
                drop = len(buf) - 3
                if any(buf[:drop]):
                    self.skipped_bytes += drop
                del buf[:drop]
                return None
            # Zero bytes before the next magic are a block's padding, left
            # over when the block ended a chunk; anything else is a resync.
            if found.start() > 8 or any(buf[: found.start()]):
                self.resyncs += 1
                self.skipped_bytes += found.start()
                if len(self.resync_samples) < MAX_RAW_SAMPLES:
                    self.resync_samples.append(
                        {
                            "skipped": found.start(),
                            "before": self._last_end.hex(),
                            "skipped_head": bytes(
                                buf[: min(found.start(), RAW_SAMPLE_BYTES)]
                            ).hex(),
                        }
                    )
            del buf[: found.start()]
            return _EMPTY
        if magic.startswith(b"100"):
            declared = struct.unpack_from("<I", buf, 4)[0]
            header = declared if 24 <= declared <= 64 else INFO_HEADER
            if len(buf) < header:
                return None
            block = Block("info", magic, bytes(buf[:header]), b"")
            del buf[:header]
            return block
        if magic.endswith(b"dc"):
            if len(buf) < FRAME_HEADER:
                return None
            codec, size, extra, micro, unknown = struct.unpack_from("<4sIIII", buf, 4)
            key = magic[1:2] == b"0"
            if size > MAX_BLOCK or extra > 1024:
                self.implausible += 1
                del buf[:4]
                return _EMPTY
            if len(buf) < FRAME_HEADER + extra + size:
                return None
            header = FRAME_HEADER + self._extra_used(buf, key, extra)
            unix_time = None
            if header - FRAME_HEADER >= 4:
                unix_time = struct.unpack_from("<I", buf, FRAME_HEADER)[0]
            block = Block(
                "key" if key else "frame",
                magic,
                bytes(buf[:header]),
                bytes(buf[header : header + size]),
                codec=codec.decode("ascii", "replace").strip("\x00"),
                micro=micro,
                unix_time=unix_time,
                unknown=unknown,
            )
            return self._take(block, header + size)
        size = struct.unpack_from("<H", buf, 4)[0]
        if len(buf) < AUDIO_HEADER + size:
            return None
        block = Block(
            "audio",
            magic,
            bytes(buf[:8]),
            bytes(buf[AUDIO_HEADER : AUDIO_HEADER + size]),
        )
        return self._take(block, AUDIO_HEADER + size)

    @staticmethod
    def _extra_used(buf: bytearray, key: bool, extra: int) -> int:
        """Return the extra header's length as the payload shows it.

        Key frames carry the extra header the field announces (8 bytes on the
        NVR's sub streams, about 250 on newer cameras' main streams). Frames
        announce one too on some streams: it is taken when a NAL start code
        follows it and none sits where the payload would otherwise begin.
        """
        if key or not extra:
            return extra
        at_zero = bytes(buf[FRAME_HEADER : FRAME_HEADER + 4])
        after = bytes(buf[FRAME_HEADER + extra : FRAME_HEADER + extra + 4])
        if at_zero.startswith(_START_CODES):
            return 0
        return extra if after.startswith(_START_CODES) else 0

    def _take(self, block: Block, end: int) -> Block:
        """Consume a block and the padding after it (found by the next magic).

        Padding not yet followed by a header is left for the next call,
        which drops leading zero bytes before a magic without a resync.
        """
        buf = self._buffer
        pad = 0
        after = bytes(buf[end : end + RESYNC_WINDOW])
        if len(after) >= 4 and not MAGIC_RE.fullmatch(after[:4]):
            found = MAGIC_RE.search(after)
            if found is not None and not any(after[: found.start()]):
                pad = found.start()
        self._last_end = bytes(buf[max(end - 16, 0) : end])
        del buf[: end + pad]
        return Block(
            block.kind,
            block.magic,
            block.header,
            block.payload,
            block.codec,
            block.micro,
            block.unix_time,
            block.unknown,
            pad,
        )

    def finish(self) -> list[Block]:
        """Return the blocks a stream's last bytes hold, if whole; then empty."""
        blocks = self.feed(b"")
        self._buffer = bytearray()
        return blocks


_EMPTY = Block("", b"", b"", b"")


# ---- Bit reading (RBSP) ----


class BitReader:
    """Reads bits and Exp-Golomb codes from an RBSP (no emulation bytes)."""

    def __init__(self, data: bytes) -> None:
        """Wrap the data."""
        self._data = data
        self._pos = 0

    def u(self, bits: int) -> int:
        """Read an unsigned integer of ``bits`` bits."""
        value = 0
        for _ in range(bits):
            byte = self._pos >> 3
            if byte >= len(self._data):
                raise ValueError("bitstream ended")
            bit = (self._data[byte] >> (7 - (self._pos & 7))) & 1
            value = (value << 1) | bit
            self._pos += 1
        return value

    def ue(self) -> int:
        """Read an unsigned Exp-Golomb code."""
        zeros = 0
        while self.u(1) == 0:
            zeros += 1
            if zeros > 32:
                raise ValueError("bad Exp-Golomb code")
        return (1 << zeros) - 1 + (self.u(zeros) if zeros else 0)

    def se(self) -> int:
        """Read a signed Exp-Golomb code."""
        code = self.ue()
        return (code + 1) // 2 if code % 2 else -(code // 2)


def rbsp(nal: bytes) -> bytes:
    """Return a NAL unit's payload without its emulation prevention bytes."""
    return nal.replace(b"\x00\x00\x03", b"\x00\x00")


def nal_units(data: bytes) -> tuple[str, list[bytes]]:
    """Split an access unit into NAL units: (layout, units).

    Annex B start codes (``00 00 01``, with or without a leading zero) as the
    cameras send them; 4-byte length prefixes as a fallback (``avcc``).
    """
    units: list[bytes] = []
    starts = [m.end() for m in re.finditer(b"\x00\x00\x01", data)]
    if starts and starts[0] <= 5:
        for i, start in enumerate(starts):
            end = starts[i + 1] - 3 if i + 1 < len(starts) else len(data)
            unit = data[start:end].rstrip(b"\x00")
            if unit:
                units.append(unit)
        return "annexb", units
    at = 0
    while at + 4 <= len(data):
        length = struct.unpack_from(">I", data, at)[0]
        if length == 0 or at + 4 + length > len(data):
            return "unknown", []
        units.append(data[at + 4 : at + 4 + length])
        at += 4 + length
    return ("avcc", units) if units and at == len(data) else ("unknown", [])


# ---- H.264 ----


def h264_nal_type(unit: bytes) -> int:
    """Return the NAL unit type of an H.264 NAL unit."""
    return unit[0] & 0x1F


def parse_h264_sps(unit: bytes) -> dict[str, object]:
    """Decode what the muxer and the report need from an H.264 SPS NAL unit."""
    r = BitReader(rbsp(unit[1:]))
    profile, constraints, level = r.u(8), r.u(8), r.u(8)
    r.ue()  # seq_parameter_set_id
    chroma = 1
    bit_depth = 8
    if profile in _H264_HIGH_PROFILES:
        chroma = r.ue()
        if chroma == 3:
            r.u(1)
        bit_depth = r.ue() + 8
        r.ue()
        r.u(1)
        if r.u(1):
            for i in range(8 if chroma != 3 else 12):
                if r.u(1):
                    _skip_scaling_list(r, 16 if i < 6 else 64)
    r.ue()  # log2_max_frame_num_minus4
    poc_type = r.ue()
    if poc_type == 0:
        r.ue()
    elif poc_type == 1:
        r.u(1)
        r.se()
        r.se()
        for _ in range(r.ue()):
            r.se()
    max_ref_frames = r.ue()
    r.u(1)
    width_mbs = r.ue() + 1
    height_map = r.ue() + 1
    frame_mbs_only = r.u(1)
    if not frame_mbs_only:
        r.u(1)
    r.u(1)
    crop = (0, 0, 0, 0)
    if r.u(1):
        crop = (r.ue(), r.ue(), r.ue(), r.ue())
    sub_width = 1 if chroma in (0, 3) else 2
    sub_height = 1 if chroma in (0, 2, 3) else 2
    unit_y = sub_height * (2 - frame_mbs_only)
    width = width_mbs * 16 - sub_width * (crop[0] + crop[1])
    height = (2 - frame_mbs_only) * height_map * 16 - unit_y * (crop[2] + crop[3])
    result: dict[str, object] = {
        "codec": f"avc1.{profile:02X}{constraints:02X}{level:02X}",
        "profile_idc": profile,
        "level_idc": level,
        "chroma_format_idc": chroma,
        "bit_depth": bit_depth,
        "width": width,
        "height": height,
        "max_num_ref_frames": max_ref_frames,
        "pic_order_cnt_type": poc_type,
        "frame_mbs_only": bool(frame_mbs_only),
    }
    try:
        if r.u(1):
            result.update(_h264_vui(r))
    except ValueError:
        pass
    return result


def _skip_scaling_list(r: BitReader, size: int) -> None:
    last = 8
    next_scale = 8
    for _ in range(size):
        if next_scale != 0:
            next_scale = (last + r.se() + 256) % 256
        last = last if next_scale == 0 else next_scale


def _h264_vui(r: BitReader) -> dict[str, object]:
    out: dict[str, object] = {}
    if r.u(1) and r.u(8) == 255:  # aspect_ratio_info_present_flag, Extended_SAR
        r.u(16)
        r.u(16)
    if r.u(1):  # overscan_info_present_flag
        r.u(1)
    if r.u(1):  # video_signal_type_present_flag
        r.u(3)
        r.u(1)
        if r.u(1):
            r.u(24)
    if r.u(1):  # chroma_loc_info_present_flag
        r.ue()
        r.ue()
    if r.u(1):  # timing_info_present_flag
        units = r.u(32)
        scale = r.u(32)
        fixed = r.u(1)
        if units:
            out["vui_fps"] = round(scale / (2 * units), 3)
        out["vui_fixed_frame_rate"] = bool(fixed)
    return out


def h264_slice_type(unit: bytes) -> str | None:
    """Return I, P, B, SP or SI for a slice NAL unit (types 1 and 5)."""
    if h264_nal_type(unit) not in (1, 5):
        return None
    r = BitReader(rbsp(unit[1:65]))
    r.ue()  # first_mb_in_slice
    return _H264_SLICE_TYPES[r.ue() % 5]


# ---- H.265 ----


def h265_nal_type(unit: bytes) -> int:
    """Return the NAL unit type of an H.265 NAL unit."""
    return (unit[0] >> 1) & 0x3F


def _h265_header_ok(unit: bytes) -> bool:
    """Return whether the two-byte header is well-formed (layer 0, a temporal id)."""
    if len(unit) < 3 or unit[0] & 0x80:
        return False
    layer = ((unit[0] & 1) << 5) | (unit[1] >> 3)
    return layer == 0 and (unit[1] & 0x07) >= 1


def parse_h265_sps(unit: bytes) -> dict[str, object]:
    """Decode what the muxer and the report need from an H.265 SPS NAL unit."""
    r = BitReader(rbsp(unit[2:]))
    r.u(4)  # sps_video_parameter_set_id
    max_sub_layers_minus1 = r.u(3)
    r.u(1)
    profile, tier, level, hvcc = _h265_profile_tier_level(r, max_sub_layers_minus1)
    r.ue()  # sps_seq_parameter_set_id
    chroma = r.ue()
    if chroma == 3:
        r.u(1)
    width = r.ue()
    height = r.ue()
    if r.u(1):
        sub_width = 2 if chroma in (1, 2) else 1
        sub_height = 2 if chroma == 1 else 1
        left, right, top, bottom = r.ue(), r.ue(), r.ue(), r.ue()
        width -= sub_width * (left + right)
        height -= sub_height * (top + bottom)
    bit_depth = r.ue() + 8
    r.ue()  # bit_depth_chroma_minus8
    r.ue()  # log2_max_pic_order_cnt_lsb_minus4
    ordering_info = r.u(1)
    for _ in range(
        0 if ordering_info else max_sub_layers_minus1, max_sub_layers_minus1 + 1
    ):
        r.ue()
        r.ue()
        r.ue()
    log2_min_cb = r.ue() + 3
    log2_diff = r.ue()
    return {
        "codec": hevc_codec_string("hvc1", hvcc),
        "profile_idc": profile,
        "tier": "high" if tier else "main",
        "level_idc": level,
        "chroma_format_idc": chroma,
        "bit_depth": bit_depth,
        "width": width,
        "height": height,
        "log2_ctb_size": log2_min_cb + log2_diff,
    }


def _h265_profile_tier_level(
    r: BitReader, max_sub_layers_minus1: int
) -> tuple[int, int, int, bytes]:
    """Return (profile_idc, tier, level_idc, hvcC bytes 0-12) from the SPS."""
    space = r.u(2)
    tier = r.u(1)
    profile = r.u(5)
    compat = r.u(32)
    flags = r.u(48)
    level = r.u(8)
    profile_present = []
    level_present = []
    for _ in range(max_sub_layers_minus1):
        profile_present.append(r.u(1))
        level_present.append(r.u(1))
    if max_sub_layers_minus1 > 0:
        for _ in range(max_sub_layers_minus1, 8):
            r.u(2)
    for i in range(max_sub_layers_minus1):
        if profile_present[i]:
            r.u(88)
        if level_present[i]:
            r.u(8)
    hvcc = (
        bytes([1, (space << 6) | (tier << 5) | profile])
        + compat.to_bytes(4, "big")
        + flags.to_bytes(6, "big")
        + bytes([level])
    )
    return profile, tier, level, hvcc


def h265_config_header(unit: bytes) -> bytes:
    """Return the hvcC record's first 13 bytes from an H.265 SPS NAL unit.

    That is the version, then the profile, tier and level.
    """
    r = BitReader(rbsp(unit[2:]))
    r.u(4)  # sps_video_parameter_set_id
    max_sub_layers_minus1 = r.u(3)
    r.u(1)
    return _h265_profile_tier_level(r, max_sub_layers_minus1)[3]


def parse_h265_pps(unit: bytes) -> dict[str, int]:
    """Return what a slice header needs from an H.265 PPS."""
    r = BitReader(rbsp(unit[2:]))
    pps_id = r.ue()
    r.ue()  # pps_seq_parameter_set_id
    dependent = r.u(1)
    r.u(1)  # output_flag_present_flag
    extra = r.u(3)
    return {"pps_id": pps_id, "dependent_slices": dependent, "extra_bits": extra}


def h265_slice_type(unit: bytes, pps: dict[int, dict[str, int]]) -> str | None:
    """Return B, P or I for the first slice segment of a picture, else None."""
    kind = h265_nal_type(unit)
    if not (kind <= 9 or 16 <= kind <= 21):
        return None
    r = BitReader(rbsp(unit[2:66]))
    first = r.u(1)
    if 16 <= kind <= 23:
        r.u(1)  # no_output_of_prior_pics_flag
    pps_id = r.ue()
    if not first:
        return None
    r.u(pps.get(pps_id, {}).get("extra_bits", 0))
    return _H265_SLICE_TYPES[r.ue()]


# ---- Audio ----


def parse_adts(payload: bytes) -> dict[str, object] | None:
    """Describe the ADTS frames in an audio block, or None if it is not ADTS."""
    frames = 0
    at = 0
    partial = False
    first: dict[str, object] | None = None
    while at + 7 <= len(payload):
        if payload[at] != 0xFF or (payload[at + 1] & 0xF6) != 0xF0:
            break
        b = payload
        mpeg2 = (b[at + 1] >> 3) & 1
        profile = b[at + 2] >> 6
        rate_index = (b[at + 2] >> 2) & 0x0F
        channels = ((b[at + 2] & 1) << 2) | (b[at + 3] >> 6)
        length = ((b[at + 3] & 3) << 11) | (b[at + 4] << 3) | (b[at + 5] >> 5)
        if first is None:
            first = {
                "object_type": profile + 1,
                "codec": f"mp4a.40.{profile + 1}",
                "sample_rate": (
                    ADTS_SAMPLE_RATES[rate_index]
                    if rate_index < len(ADTS_SAMPLE_RATES)
                    else None
                ),
                "channels": channels,
                "mpeg_version": 2 if mpeg2 else 4,
                "frame_length": length,
            }
        if length < 7 or at + length > len(payload):
            partial = True
            break
        frames += 1
        at += length
    if first is None:
        return None
    return {
        **first,
        "frames_per_block": frames,
        "partial_frame": partial,
        "bytes_after_frames": len(payload) - at,
    }


# ---- The analysis ----


@dataclass(slots=True)
class _Timestamps:
    first: int | None = None
    last: int | None = None
    previous: int | None = None
    count: int = 0
    deltas: list[int] = field(default_factory=list)
    negative: int = 0
    wrapped: int = 0

    def add(self, value: int) -> None:
        self.count += 1
        if self.first is None:
            self.first = value
        if self.previous is not None:
            delta = value - self.previous
            if delta < -(2**31):
                self.wrapped += 1
            elif delta < 0:
                self.negative += 1
            if len(self.deltas) < MAX_DELTAS:
                self.deltas.append(delta)
        self.previous = value
        self.last = value

    def as_dict(self) -> dict[str, object]:
        out: dict[str, object] = {
            "count": self.count,
            "first": self.first,
            "last": self.last,
            "negative_steps": self.negative,
            "wraps": self.wrapped,
        }
        positive = [d for d in self.deltas if d > 0]
        if positive:
            out["delta_min"] = min(positive)
            out["delta_median"] = int(statistics.median(positive))
            out["delta_max"] = max(positive)
        return out


@dataclass(slots=True)
class StreamAnalysis:
    """What a stream's blocks hold, accumulated block by block."""

    info: list[dict[str, object]] = field(default_factory=list)
    key_frames: int = 0
    frames: int = 0
    video_bytes: int = 0
    audio_blocks: int = 0
    audio_bytes: int = 0
    codec_labels: Counter[str] = field(default_factory=Counter)
    layouts: Counter[str] = field(default_factory=Counter)
    detected: str | None = None  # h264, h265
    nal_types: Counter[int] = field(default_factory=Counter)
    pictures: Counter[str] = field(default_factory=Counter)
    parameter_sets: dict[str, list[str]] = field(default_factory=dict)
    sps: dict[str, object] | None = None
    sps_error: str | None = None
    extra_header_sizes: Counter[int] = field(default_factory=Counter)
    frame_extra_header_sizes: Counter[int] = field(default_factory=Counter)
    unknown_samples: list[dict[str, object]] = field(default_factory=list)
    unknown_field: list[int] = field(default_factory=list)
    pads: Counter[int] = field(default_factory=Counter)
    video_time: _Timestamps = field(default_factory=_Timestamps)
    key_time: _Timestamps = field(default_factory=_Timestamps)
    key_unix: _Timestamps = field(default_factory=_Timestamps)
    audio_magics: Counter[str] = field(default_factory=Counter)
    aac: dict[str, object] | None = None
    audio_sample_rates: Counter[int] = field(default_factory=Counter)
    adpcm: dict[str, object] | None = None
    audio_unrecognized: str | None = None
    _pps: dict[int, dict[str, int]] = field(default_factory=dict)

    def feed(self, block: Block) -> None:
        """Account one block."""
        if block.pad:
            self.pads[block.pad] += 1
        if block.kind == "info":
            if len(self.info) < MAX_SAMPLES:
                self.info.append(_info(block))
            return
        if block.kind == "audio":
            self._audio(block)
            return
        self._video(block)

    def _video(self, block: Block) -> None:
        key = block.kind == "key"
        if key:
            self.key_frames += 1
        else:
            self.frames += 1
        self.video_bytes += len(block.payload)
        if block.codec:
            self.codec_labels[block.codec] += 1
        if block.micro is not None:
            self.video_time.add(block.micro)
            if key:
                self.key_time.add(block.micro)
        if key and block.unix_time is not None and _plausible_time(block.unix_time):
            # Frames' extra headers hold something else at that offset.
            self.key_unix.add(block.unix_time)
        if key:
            self.extra_header_sizes[len(block.header) - FRAME_HEADER] += 1
        else:
            self.frame_extra_header_sizes[len(block.header) - FRAME_HEADER] += 1
        if (
            block.unknown is not None
            and len(self.unknown_field) < MAX_SAMPLES
            and block.unknown not in self.unknown_field
        ):
            self.unknown_field.append(block.unknown)
        layout, units = nal_units(block.payload)
        self.layouts[layout] += 1
        if not units:
            if len(self.unknown_samples) < MAX_RAW_SAMPLES:
                self.unknown_samples.append(
                    {
                        "kind": block.kind,
                        "header": block.header.hex(),
                        "size": len(block.payload),
                        "payload_head": block.payload[:RAW_SAMPLE_BYTES].hex(),
                    }
                )
            return
        if self.detected is None:
            self.detected = _detect(units, block.codec)
        if self.detected == "h265":
            self._h265(units)
        elif self.detected == "h264":
            self._h264(units)

    def _h264(self, units: list[bytes]) -> None:
        picture: str | None = None
        for unit in units:
            kind = h264_nal_type(unit)
            self.nal_types[kind] += 1
            if kind == 7:
                self._keep("sps", unit)
                if self.sps is None and self.sps_error is None:
                    try:
                        self.sps = parse_h264_sps(unit)
                    except (ValueError, IndexError) as err:
                        self.sps_error = f"{type(err).__name__}: {err}"
            elif kind == 8:
                self._keep("pps", unit)
            elif kind in (1, 5) and picture is None:
                try:
                    picture = h264_slice_type(unit)
                except ValueError, IndexError:
                    picture = "?"
        if picture is not None:
            self.pictures[picture] += 1

    def _h265(self, units: list[bytes]) -> None:
        picture: str | None = None
        for unit in units:
            kind = h265_nal_type(unit)
            self.nal_types[kind] += 1
            if kind == 32:
                self._keep("vps", unit)
            elif kind == 33:
                self._keep("sps", unit)
                if self.sps is None and self.sps_error is None:
                    try:
                        self.sps = parse_h265_sps(unit)
                    except (ValueError, IndexError) as err:
                        self.sps_error = f"{type(err).__name__}: {err}"
            elif kind == 34:
                self._keep("pps", unit)
                try:
                    pps = parse_h265_pps(unit)
                    self._pps[pps["pps_id"]] = pps
                except ValueError, IndexError:
                    pass
            elif picture is None:
                try:
                    picture = h265_slice_type(unit, self._pps)
                except ValueError, IndexError:
                    picture = "?"
        if picture is not None:
            self.pictures[picture] += 1

    def _keep(self, name: str, unit: bytes) -> None:
        kept = self.parameter_sets.setdefault(name, [])
        text = unit.hex()
        if text not in kept and len(kept) < MAX_PARAMETER_SETS:
            kept.append(text)

    def _audio(self, block: Block) -> None:
        self.audio_blocks += 1
        self.audio_bytes += len(block.payload)
        magic = block.magic.decode("ascii", "replace")
        self.audio_magics[magic] += 1
        adts = parse_adts(block.payload)
        if adts is not None:
            if self.aac is None:
                self.aac = adts
            rate = adts.get("sample_rate")
            if isinstance(rate, int):
                self.audio_sample_rates[rate] += 1
            return
        if magic == "01wb" and len(block.payload) >= 8:
            if self.adpcm is None:
                kind, half = struct.unpack_from("<HH", block.payload, 0)
                self.adpcm = {
                    "kind": f"{kind:04x}",
                    "half_block_size": half,
                    "state": block.payload[4:8].hex(),
                }
            return
        if self.audio_unrecognized is None:
            self.audio_unrecognized = block.payload[:16].hex()

    def ticks_per_second(self) -> int | None:
        """Return the counter's ticks per second of wall-clock time (key frames).

        About 1,000,000 means the counter is in microseconds.
        """
        micro = self.key_time
        unix = self.key_unix
        if (
            micro.first is None
            or micro.last is None
            or unix.first is None
            or unix.last is None
            or unix.last <= unix.first
        ):
            return None
        return round((micro.last - micro.first) / (unix.last - unix.first))

    def as_dict(self) -> dict[str, object]:
        """Return the analysis for the report (no media, no identifiers)."""
        video: dict[str, object] = {
            "key_frames": self.key_frames,
            "frames": self.frames,
            "bytes": self.video_bytes,
            "codec_labels": dict(self.codec_labels),
            "codec": self.detected,
            "nal_layout": dict(self.layouts),
            "nal_types": {str(k): v for k, v in sorted(self.nal_types.items())},
            "pictures": dict(self.pictures),
            "b_frames": self.pictures.get("B", 0) > 0,
            "parameter_sets": self.parameter_sets,
            "sps": self.sps,
            "sps_error": self.sps_error,
            "key_extra_header_sizes": dict(self.extra_header_sizes),
            "frame_extra_header_sizes": dict(self.frame_extra_header_sizes),
            "unknown_samples": self.unknown_samples,
            "header_unknown_field": [f"{v:08x}" for v in self.unknown_field],
            "padding": dict(self.pads),
            "timestamps": self.video_time.as_dict(),
            "key_timestamps": self.key_time.as_dict(),
            "key_unix_times": self.key_unix.as_dict(),
        }
        ticks = self.ticks_per_second()
        if ticks is not None:
            video["ticks_per_second"] = ticks
            first, last = self.video_time.first, self.video_time.last
            if first is not None and last is not None and last >= first:
                video["span_s"] = round((last - first) / ticks, 2)
        deltas = [d for d in self.video_time.deltas if d > 0]
        if deltas and ticks:
            video["fps_estimate"] = round(ticks / statistics.median(deltas), 2)
        audio: dict[str, object] = {
            "blocks": self.audio_blocks,
            "bytes": self.audio_bytes,
            "magics": dict(self.audio_magics),
            "aac": self.aac,
            "sample_rates": {str(k): v for k, v in self.audio_sample_rates.items()},
            "adpcm": self.adpcm,
            "unrecognized_head": self.audio_unrecognized,
        }
        return {"info": self.info, "video": video, "audio": audio}


def _info(block: Block) -> dict[str, object]:
    head = block.header
    width, height = struct.unpack_from("<II", head, 8)
    out: dict[str, object] = {
        "magic": block.magic.decode("ascii", "replace"),
        "header_len": len(head),
        "declared": struct.unpack_from("<I", head, 4)[0],
        "width": width,
        "height": height,
        "fps": head[17] if len(head) > 17 else None,
        "hex": head.hex(),
    }
    if len(head) >= 30:
        # Start and end dates (year - 1900, month, day, hour, minute, second).
        start = head[18:24]
        end = head[24:30]
        out["start"] = _date(start)
        out["end"] = _date(end)
    return out


def _date(raw: bytes) -> str:
    year = raw[0] + 1900
    return (
        f"{year:04d}-{raw[1]:02d}-{raw[2]:02d} {raw[3]:02d}:{raw[4]:02d}:{raw[5]:02d}"
    )


def _plausible_time(value: int) -> bool:
    """Return whether a header field reads as a POSIX time of this decade."""
    return 1_500_000_000 < value < 2_100_000_000


def detect_codec(units: list[bytes], label: str) -> str | None:
    """Return h264 or h265 for an access unit's NAL units (and its label)."""
    return _detect(units, label)


def _detect(units: list[bytes], label: str) -> str | None:
    """Tell H.264 from H.265 by the parameter sets a key frame holds."""
    h265 = all(_h265_header_ok(u) for u in units) and any(
        h265_nal_type(u) in (32, 33, 34) for u in units
    )
    h264 = any(h264_nal_type(u) in (7, 8) for u in units) and all(
        not (u[0] & 0x80) and 1 <= h264_nal_type(u) <= 23 for u in units
    )
    if h265 and not h264:
        return "h265"
    if h264 and not h265:
        return "h264"
    if h265 and h264:
        return "h265" if label.upper() == "H265" else "h264"
    # No parameter set in this access unit (a frame): go by the label.
    return {"H264": "h264", "H265": "h265"}.get(label.upper())


def blocks_of(data: bytes) -> Iterator[Block]:
    """Yield the blocks of a complete stream (tests and tools)."""
    reader = BlockReader()
    yield from reader.feed(data)
    yield from reader.finish()

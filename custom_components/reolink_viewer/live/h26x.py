"""H.264 and H.265 parameter sets: compare, read the picture size, rebuild an init.

go2rtc writes the MSE init segment (``avcC``/``hvcC``, the track's width and
height) from the stream's description (the SDP's ``sprop`` parameter sets).
On some Reolink NVR streams the description disagrees with the stream itself
(Phase 3, runs 5 and 6): MSE then shows the picture at the wrong size, and on
one stream decodes nothing until the second key frame. The key frames carry
the stream's own parameter sets, so the relay rebuilds the init segment from
them: the codec configuration box, the sample entry's and the track header's
width and height. Only the boxes on that path are rewritten; everything else
is copied as it is.
"""

from collections.abc import Iterable
from dataclasses import dataclass
import struct

from custom_components.reolink_viewer.fmp4 import FragmentError, child_boxes

AVC_ENTRIES = frozenset({"avc1", "avc3"})
HEVC_ENTRIES = frozenset({"hvc1", "hev1"})
# NAL unit types: H.264 SPS 7, PPS 8; H.265 VPS 32, SPS 33, PPS 34.
AVC_SETS = frozenset({7, 8})
HEVC_SETS = frozenset({32, 33, 34})
_AVC_SPS, _AVC_PPS = 7, 8
_HEVC_VPS, _HEVC_SPS, _HEVC_PPS = 32, 33, 34
# H.264 profiles whose SPS carries chroma format, bit depths and scaling lists.
_HIGH_PROFILES = frozenset(
    {100, 110, 122, 244, 44, 83, 86, 118, 128, 138, 139, 134, 135}
)
# Bytes of a VisualSampleEntry before its child boxes (after the box header),
# and where its width and height are in them.
VISUAL_FIXED = 78
_ENTRY_SIZE_AT = 24
# Boxes the rebuild walks into: how many payload bytes come before the children.
_CONTAINERS = {
    "moov": 0,
    "trak": 0,
    "mdia": 0,
    "minf": 0,
    "stbl": 0,
    "stsd": 8,  # full box header and entry count
    **dict.fromkeys(AVC_ENTRIES | HEVC_ENTRIES, VISUAL_FIXED),
}


@dataclass(frozen=True, slots=True)
class VideoConfig:
    """A video track's codec configuration, as the init segment has it."""

    hevc: bool
    # The stream's NAL unit length size (bytes).
    length: int
    sets: frozenset[bytes]

    @property
    def types(self) -> frozenset[int]:
        """Return the NAL unit types of the parameter sets."""
        return HEVC_SETS if self.hevc else AVC_SETS


def nal_type(nal: bytes, *, hevc: bool) -> int:
    """Return a NAL unit's type."""
    return (nal[0] >> 1) & 0x3F if hevc else nal[0] & 0x1F


def init_config(init: bytes) -> VideoConfig | None:
    """Return the video track's configuration (from avcC or hvcC); None without."""
    for entry_type, entry in _sample_entries(init):
        if entry_type in AVC_ENTRIES:
            config = _config(entry, "avcC")
            if config is not None and len(config) >= 7:
                return VideoConfig(False, (config[4] & 3) + 1, _avcc_sets(config))
        elif entry_type in HEVC_ENTRIES:
            config = _config(entry, "hvcC")
            if config is not None and len(config) >= 23:
                return VideoConfig(True, (config[21] & 3) + 1, _hvcc_sets(config))
    return None


def sample_sets(sample: bytes, config: VideoConfig) -> list[bytes] | None:
    """Return the parameter sets in a sample (length-prefixed NAL units), in order.

    None if the bytes are not NAL units of that length size.
    """
    found: list[bytes] = []
    pos = 0
    length = config.length
    while pos < len(sample):
        if pos + length > len(sample):
            return None
        size = int.from_bytes(sample[pos : pos + length], "big")
        pos += length
        if size == 0 or pos + size > len(sample):
            return None
        nal = sample[pos : pos + size]
        pos += size
        if nal_type(nal, hevc=config.hevc) in config.types and nal not in found:
            found.append(nal)
    return found


def compare_sets(init: frozenset[bytes], stream: Iterable[bytes] | None) -> str:
    """Return "same", "differ", "none" (the key frame has none) or "unknown"."""
    if stream is None:
        return "unknown"
    sets = frozenset(stream)
    if not sets:
        return "none"
    return "same" if sets <= init else "differ"


def picture_size(sps: bytes, *, hevc: bool) -> tuple[int, int]:
    """Return the displayed width and height an SPS describes (after cropping)."""
    return _hevc_size(sps) if hevc else _avc_size(sps)


def rebuild_init(init: bytes, sets: list[bytes], *, hevc: bool) -> bytes | None:
    """Return the init segment configured with these parameter sets.

    The video track's avcC/hvcC holds them, and its sample entry and track
    header the picture size their SPS gives. None if the sets are incomplete
    (each kind is needed) or the boxes cannot be read.
    """
    kinds = {nal_type(nal, hevc=hevc) for nal in sets}
    if kinds != (HEVC_SETS if hevc else AVC_SETS):
        return None
    sps = next(n for n in sets if nal_type(n, hevc=hevc) in (_AVC_SPS, _HEVC_SPS))
    try:
        width, height = picture_size(sps, hevc=hevc)
        boxes = _parse(init)
    except FragmentError, IndexError, ValueError:
        return None
    changed = False
    for moov in (b for b in boxes if b.type == "moov"):
        for trak in (b for b in moov.children or [] if b.type == "trak"):
            entry = _video_entry(trak, HEVC_ENTRIES if hevc else AVC_ENTRIES)
            if entry is None:
                continue
            name = "hvcC" if hevc else "avcC"
            for child in entry.children or []:
                if child.type == name:
                    child.prefix = _hvcc(child.prefix, sets) if hevc else _avcc(sets)
            entry.prefix = (
                entry.prefix[:_ENTRY_SIZE_AT]
                + struct.pack(">HH", width, height)
                + entry.prefix[_ENTRY_SIZE_AT + 4 :]
            )
            for child in trak.children or []:
                if child.type == "tkhd" and len(child.prefix) >= 84:
                    child.prefix = child.prefix[:-8] + struct.pack(
                        ">II", width << 16, height << 16
                    )
            changed = True
    return _serialize(boxes) if changed else None


# ---- Boxes ----


@dataclass(slots=True)
class _Box:
    type: str
    # The payload before any children (a leaf: the whole payload).
    prefix: bytes
    children: list[_Box] | None


def _parse(data: bytes) -> list[_Box]:
    boxes = []
    for box_type, payload in child_boxes(data):
        skip = _CONTAINERS.get(box_type)
        if skip is None or len(payload) < skip:
            boxes.append(_Box(box_type, payload, None))
        else:
            boxes.append(_Box(box_type, payload[:skip], _parse(payload[skip:])))
    return boxes


def _serialize(boxes: list[_Box]) -> bytes:
    out = bytearray()
    for box in boxes:
        payload = box.prefix
        if box.children is not None:
            payload += _serialize(box.children)
        out += struct.pack(">I4s", 8 + len(payload), box.type.encode("latin-1"))
        out += payload
    return bytes(out)


def _video_entry(trak: _Box, entries: frozenset[str]) -> _Box | None:
    level = [trak]
    for name in ("mdia", "minf", "stbl", "stsd"):
        level = [c for b in level for c in b.children or [] if c.type == name]
    return next((c for b in level for c in b.children or [] if c.type in entries), None)


def _sample_entries(init: bytes) -> list[tuple[str, bytes]]:
    """Return the sample entries (type, box payload) of every track."""
    entries: list[tuple[str, bytes]] = []
    for moov_type, moov in child_boxes(init):
        if moov_type != "moov":
            continue
        for trak_type, trak in child_boxes(moov):
            if trak_type != "trak":
                continue
            for stsd in _path(trak, ("mdia", "minf", "stbl", "stsd")):
                entries.extend(child_boxes(stsd[8:]))
    return entries


def _path(data: bytes, path: tuple[str, ...]) -> list[bytes]:
    found = [data]
    for name in path:
        found = [p for d in found for t, p in child_boxes(d) if t == name]
    return found


def _config(entry: bytes, name: str) -> bytes | None:
    for box_type, payload in child_boxes(entry[VISUAL_FIXED:]):
        if box_type == name:
            return payload
    return None


def _avcc_sets(config: bytes) -> frozenset[bytes]:
    sets: list[bytes] = []
    pos = 5
    # The SPS, then the PPS; the SPS count shares its byte with reserved bits.
    for mask in (0x1F, 0xFF):
        if pos >= len(config):
            break
        count = config[pos] & mask
        pos += 1
        for _ in range(count):
            size = int.from_bytes(config[pos : pos + 2], "big")
            sets.append(config[pos + 2 : pos + 2 + size])
            pos += 2 + size
    return frozenset(sets)


def _hvcc_sets(config: bytes) -> frozenset[bytes]:
    sets: list[bytes] = []
    pos = 23
    for _ in range(config[22]):
        count = int.from_bytes(config[pos + 1 : pos + 3], "big")
        pos += 3
        for _ in range(count):
            size = int.from_bytes(config[pos : pos + 2], "big")
            sets.append(config[pos + 2 : pos + 2 + size])
            pos += 2 + size
    return frozenset(sets)


def _avcc(sets: list[bytes]) -> bytes:
    """Build an avcC payload (4-byte NAL lengths) from SPS and PPS units."""
    sps = [n for n in sets if n[0] & 0x1F == _AVC_SPS]
    pps = [n for n in sets if n[0] & 0x1F == _AVC_PPS]
    body = bytes([1, sps[0][1], sps[0][2], sps[0][3], 0xFF, 0xE0 | len(sps)])
    for nal in sps:
        body += struct.pack(">H", len(nal)) + nal
    body += bytes([len(pps)])
    for nal in pps:
        body += struct.pack(">H", len(nal)) + nal
    return body


def _hvcc(old: bytes, sets: list[bytes]) -> bytes:
    """Build an hvcC payload: the old header, the new SPS's profile, the sets."""
    sps = next(n for n in sets if (n[0] >> 1) & 0x3F == _HEVC_SPS)
    header = bytearray(old[:22])
    # general_profile_space … general_level_idc: the 12 bytes after the SPS's
    # first byte (VPS id, sub-layers, nesting), past the NAL unit header.
    header[1:13] = _rbsp(sps[2:])[1:13]
    arrays = bytearray([0])
    for kind in (_HEVC_VPS, _HEVC_SPS, _HEVC_PPS):
        units = [n for n in sets if (n[0] >> 1) & 0x3F == kind]
        arrays += bytes([0x80 | kind]) + struct.pack(">H", len(units))
        for nal in units:
            arrays += struct.pack(">H", len(nal)) + nal
        arrays[0] += 1
    return bytes(header) + bytes(arrays)


# ---- SPS ----


class _Bits:
    """An RBSP read bit by bit, with Exp-Golomb codes."""

    def __init__(self, data: bytes) -> None:
        self._data = data
        self._pos = 0

    def u(self, count: int) -> int:
        value = 0
        for _ in range(count):
            byte = self._data[self._pos >> 3]
            value = (value << 1) | ((byte >> (7 - (self._pos & 7))) & 1)
            self._pos += 1
        return value

    def skip(self, count: int) -> None:
        self._pos += count
        if self._pos > len(self._data) * 8:
            raise IndexError("past the end of the SPS")

    def ue(self) -> int:
        zeros = 0
        while self.u(1) == 0:
            zeros += 1
            if zeros > 31:
                raise ValueError("bad Exp-Golomb code")
        return (1 << zeros) - 1 + self.u(zeros)

    def se(self) -> int:
        value = self.ue()
        return (value + 1) // 2 if value & 1 else -(value // 2)


def _rbsp(data: bytes) -> bytes:
    """Remove emulation prevention bytes (00 00 03 → 00 00)."""
    out = bytearray()
    zeros = 0
    for byte in data:
        if zeros >= 2 and byte == 3:
            zeros = 0
            continue
        out.append(byte)
        zeros = zeros + 1 if byte == 0 else 0
    return bytes(out)


def _avc_size(sps: bytes) -> tuple[int, int]:
    bits = _Bits(_rbsp(sps[1:]))
    profile = bits.u(8)
    bits.skip(16)  # constraint flags, level
    bits.ue()  # seq_parameter_set_id
    chroma = 1
    if profile in _HIGH_PROFILES:
        chroma = bits.ue()
        if chroma == 3:
            bits.skip(1)  # separate_colour_plane_flag
        bits.ue()  # bit_depth_luma_minus8
        bits.ue()  # bit_depth_chroma_minus8
        bits.skip(1)  # qpprime_y_zero_transform_bypass_flag
        if bits.u(1):  # seq_scaling_matrix_present_flag
            for i in range(8 if chroma != 3 else 12):
                if bits.u(1):
                    _scaling_list(bits, 16 if i < 6 else 64)
    bits.ue()  # log2_max_frame_num_minus4
    poc_type = bits.ue()
    if poc_type == 0:
        bits.ue()  # log2_max_pic_order_cnt_lsb_minus4
    elif poc_type == 1:
        bits.skip(1)  # delta_pic_order_always_zero_flag
        bits.se()  # offset_for_non_ref_pic
        bits.se()  # offset_for_top_to_bottom_field
        for _ in range(bits.ue()):
            bits.se()
    bits.ue()  # max_num_ref_frames
    bits.skip(1)  # gaps_in_frame_num_value_allowed_flag
    width_mbs = bits.ue() + 1
    height_units = bits.ue() + 1
    frame_mbs_only = bits.u(1)
    if not frame_mbs_only:
        bits.skip(1)  # mb_adaptive_frame_field_flag
    bits.skip(1)  # direct_8x8_inference_flag
    crop = (bits.ue(), bits.ue(), bits.ue(), bits.ue()) if bits.u(1) else (0, 0, 0, 0)
    field = 2 - frame_mbs_only
    unit_x = 2 if chroma in (1, 2) else 1
    unit_y = (2 if chroma == 1 else 1) * field
    width = width_mbs * 16 - unit_x * (crop[0] + crop[1])
    height = height_units * 16 * field - unit_y * (crop[2] + crop[3])
    return width, height


def _scaling_list(bits: _Bits, size: int) -> None:
    last = 8
    following = 8
    for _ in range(size):
        if following:
            following = (last + bits.se() + 256) % 256
        last = following or last


def _hevc_size(sps: bytes) -> tuple[int, int]:
    bits = _Bits(_rbsp(sps[2:]))
    bits.skip(4)  # sps_video_parameter_set_id
    sub_layers = bits.u(3)  # sps_max_sub_layers_minus1
    bits.skip(1)  # sps_temporal_id_nesting_flag
    bits.skip(96)  # general profile, tier and level
    present = [(bits.u(1), bits.u(1)) for _ in range(sub_layers)]
    if sub_layers:
        bits.skip(2 * (8 - sub_layers))
    for profile_present, level_present in present:
        bits.skip(88 * profile_present + 8 * level_present)
    bits.ue()  # sps_seq_parameter_set_id
    chroma = bits.ue()
    if chroma == 3:
        bits.skip(1)  # separate_colour_plane_flag
    width = bits.ue()
    height = bits.ue()
    if bits.u(1):  # conformance_window_flag
        left, right, top, bottom = bits.ue(), bits.ue(), bits.ue(), bits.ue()
        width -= (2 if chroma in (1, 2) else 1) * (left + right)
        height -= (2 if chroma == 1 else 1) * (top + bottom)
    return width, height

"""H.264/H.265 parameter sets and the init rebuild (live/h26x.py)."""

from pathlib import Path
import re
import shutil
import struct
import subprocess

import pytest

from custom_components.reolink_viewer.fmp4 import child_boxes
from custom_components.reolink_viewer.live.h26x import (
    compare_sets,
    init_config,
    limit_reorder,
    parse_avc_sps,
    picture_size,
    rebuild_init,
    sample_sets,
)

from .mp4_fixtures import (
    AVC_SPS_360,
    AVC_SPS_432,
    AVC_SPS_480,
    HEVC_IDR,
    HEVC_PPS,
    HEVC_PPS_REAL,
    HEVC_SPS,
    HEVC_SPS_360,
    HEVC_SPS_432,
    HEVC_VPS_360,
    HEVC_VPS_432,
    IDR,
    PPS,
    SPS,
    VPS,
    avcc,
    go2rtc_audio_init,
    go2rtc_init,
    hvcc,
    nals,
    visual_entry,
)


@pytest.mark.parametrize(
    ("sps", "hevc", "size"),
    [
        (AVC_SPS_360, False, (640, 360)),  # cropped from 368
        (AVC_SPS_480, False, (640, 480)),
        (AVC_SPS_432, False, (1536, 432)),  # cropped from 448
        (HEVC_SPS_360, True, (640, 360)),
        (HEVC_SPS_432, True, (1536, 432)),
    ],
)
def test_picture_size(sps: bytes, hevc: bool, size: tuple[int, int]) -> None:
    """The size an SPS describes, after cropping (real encoder output)."""
    assert picture_size(sps, hevc=hevc) == size


@pytest.mark.parametrize(
    ("sps", "hevc", "size"),
    [
        # Interlaced (frame_mbs_only_flag 0): libx264 704x480.
        (
            bytes.fromhex("6764001eacd940b07b6022000003000200000300783e28532c"),
            False,
            (704, 480),
        ),
        # 4:4:4 (chroma_format_idc 3): libx264 High 4:4:4 and libx265.
        (
            bytes.fromhex("67f40016919b281405ff138088000003000800000300f078b16cb0"),
            False,
            (640, 360),
        ),
        (
            bytes.fromhex(
                "4201010408000003009e0800000300003f9000a0402d2cb2b349265780b404"
                "0000030004000003003c20"
            ),
            True,
            (640, 360),
        ),
    ],
)
def test_picture_size_of_other_layouts(
    sps: bytes, hevc: bool, size: tuple[int, int]
) -> None:
    """Interlaced H.264 and 4:4:4 chroma (real encoder output)."""
    assert picture_size(sps, hevc=hevc) == size


class _Writer:
    """Bits for an SPS, with Exp-Golomb codes and emulation prevention."""

    def __init__(self) -> None:
        self.bits: list[int] = []

    def u(self, count: int, value: int) -> _Writer:
        self.bits += [(value >> (count - 1 - i)) & 1 for i in range(count)]
        return self

    def ue(self, value: int) -> _Writer:
        code = value + 1
        return self.u(code.bit_length() - 1, 0).u(code.bit_length(), code)

    def se(self, value: int) -> _Writer:
        return self.ue(2 * value - 1 if value > 0 else -2 * value)

    def copy(self, data: bytes, count: int) -> _Writer:
        self.bits += [(data[i >> 3] >> (7 - (i & 7))) & 1 for i in range(count)]
        return self

    def nal(self, header: bytes) -> bytes:
        bits = [*self.bits, 1]  # rbsp_stop_one_bit
        bits += [0] * (-len(bits) % 8)
        raw = bytes(
            int("".join(map(str, bits[i : i + 8])), 2) for i in range(0, len(bits), 8)
        )
        out = bytearray(header)
        zeros = 0
        for byte in raw:
            if zeros >= 2 and byte <= 3:
                out.append(3)
                zeros = 0
            out.append(byte)
            zeros = zeros + 1 if byte == 0 else 0
        return bytes(out)


def test_picture_size_of_written_sps() -> None:
    """Scaling lists, picture order type 1, cropping; H.265 sub-layers."""
    avc = (
        _Writer()
        .u(8, 100)  # profile_idc: High
        .u(16, 0x001F)  # constraint flags, level
        .ue(0)  # seq_parameter_set_id
        .ue(1)  # chroma_format_idc 4:2:0
        .ue(0)  # bit_depth_luma_minus8
        .ue(0)  # bit_depth_chroma_minus8
        .u(1, 0)  # qpprime_y_zero_transform_bypass_flag
        .u(1, 1)  # seq_scaling_matrix_present_flag
    )
    for i in range(8):
        avc.u(1, 1 if i in (0, 6) else 0)
        if i in (0, 6):
            for j in range(16 if i < 6 else 64):
                avc.se(1 if j == 0 else 0)
    avc.ue(0).ue(1)  # log2_max_frame_num_minus4, pic_order_cnt_type 1
    avc.u(1, 0).se(-1).se(2).ue(2).se(1).se(-1)
    avc.ue(1).u(1, 0)  # max_num_ref_frames, gaps
    avc.ue(119).ue(67)  # 1920 x 1088
    avc.u(1, 1).u(1, 1)  # frame_mbs_only, direct_8x8
    avc.u(1, 1).ue(0).ue(0).ue(0).ue(4)  # crop 8 lines: 1080
    avc.u(1, 0)  # vui_parameters_present_flag
    assert picture_size(avc.nal(b"\x67"), hevc=False) == (1920, 1080)

    hevc = _Writer().u(4, 0).u(3, 2).u(1, 1)  # VPS id, 3 sub-layers, nesting
    hevc.u(96, 0)  # general profile, tier, level
    hevc.u(2, 0b11).u(2, 0b01)  # sub-layer 0: profile and level; 1: level
    hevc.u(2 * 6, 0)  # reserved, for the 8 - 2 absent sub-layers
    hevc.u(88, 0).u(8, 0).u(8, 0)
    hevc.ue(0).ue(1)  # sps id, 4:2:0
    hevc.ue(3840).ue(2176)
    hevc.u(1, 1).ue(0).ue(0).ue(0).ue(8)  # conformance window: 2160
    assert picture_size(hevc.nal(b"\x42\x01"), hevc=True) == (3840, 2160)
    with pytest.raises(IndexError):
        picture_size(b"\x67\x64", hevc=False)


def test_parameter_sets() -> None:
    """The init's sets against a key frame's: same, differ, none, unknown."""
    config = init_config(go2rtc_init())
    assert config is not None
    assert not config.hevc
    assert config.length == 4
    assert config.sets == {SPS, PPS}
    assert compare_sets(config.sets, sample_sets(nals(SPS, PPS, IDR), config)) == "same"
    other = sample_sets(nals(AVC_SPS_360, PPS, IDR), config)
    assert other == [AVC_SPS_360, PPS]
    assert compare_sets(config.sets, other) == "differ"
    assert compare_sets(config.sets, sample_sets(nals(IDR), config)) == "none"
    broken = sample_sets(b"\0\0\1\0" + IDR, config)
    assert broken is None
    assert compare_sets(config.sets, broken) == "unknown"
    # H.265: VPS, SPS and PPS from the hvcC arrays.
    hevc = go2rtc_init(
        visual_entry("hvc1", 3840, 2160, hvcc(VPS, HEVC_SPS, HEVC_PPS)), audio=False
    )
    config = init_config(hevc)
    assert config is not None
    assert config.hevc
    assert config.sets == {VPS, HEVC_SPS, HEVC_PPS}
    stream = sample_sets(nals(VPS, HEVC_SPS, HEVC_PPS, HEVC_IDR), config)
    assert compare_sets(config.sets, stream) == "same"
    assert init_config(go2rtc_audio_init()) is None


def _sizes(init: bytes) -> tuple[tuple[int, int], tuple[int, int]]:
    """The video sample entry's and the track header's width and height."""
    for moov_type, moov in child_boxes(init):
        if moov_type != "moov":
            continue
        for trak_type, trak in child_boxes(moov):
            if trak_type != "trak":
                continue
            boxes = dict(child_boxes(trak))
            mdia = dict(child_boxes(boxes["mdia"]))
            if b"vide" not in mdia["hdlr"]:
                continue
            stbl = dict(child_boxes(dict(child_boxes(mdia["minf"]))["stbl"]))
            (_entry_type, entry), *_ = child_boxes(stbl["stsd"][8:])
            width, height = struct.unpack(">HH", entry[24:28])
            tk_width, tk_height = struct.unpack(">II", boxes["tkhd"][-8:])
            return (width, height), (tk_width >> 16, tk_height >> 16)
    raise AssertionError("no video track")


def test_rebuild_an_avc_init() -> None:
    """The stream's own SPS and PPS, and the size they give, replace go2rtc's."""
    init = go2rtc_init(visual_entry("avc1", 640, 480, avcc(AVC_SPS_480, PPS)))
    rebuilt = rebuild_init(init, [AVC_SPS_360, PPS], hevc=False)
    assert rebuilt is not None
    config = init_config(rebuilt)
    assert config is not None
    assert config.sets == {AVC_SPS_360, PPS}
    assert config.length == 4
    assert _sizes(rebuilt) == ((640, 360), (640, 360))
    # The audio track and the rest are as they were.
    assert len(rebuilt) == len(init) + len(AVC_SPS_360) - len(AVC_SPS_480)
    assert rebuilt.endswith(init[-200:])
    # Incomplete sets, or the other codec's: nothing to rebuild.
    assert rebuild_init(init, [AVC_SPS_360], hevc=False) is None
    assert rebuild_init(go2rtc_audio_init(), [AVC_SPS_360, PPS], hevc=False) is None
    assert rebuild_init(b"\0\0\0\x08junk", [AVC_SPS_360, PPS], hevc=False) is None


def test_rebuild_an_hevc_init() -> None:
    """VPS, SPS and PPS in their arrays; the profile from the new SPS."""
    init = go2rtc_init(
        visual_entry(
            "hvc1", 1536, 432, hvcc(HEVC_VPS_432, HEVC_SPS_432, HEVC_PPS_REAL)
        ),
        audio=False,
    )
    sets = [HEVC_VPS_360, HEVC_SPS_360, HEVC_PPS_REAL]
    rebuilt = rebuild_init(init, sets, hevc=True)
    assert rebuilt is not None
    config = init_config(rebuilt)
    assert config is not None
    assert config.hevc
    assert config.sets == set(sets)
    assert _sizes(rebuilt) == ((640, 360), (640, 360))
    assert rebuild_init(init, sets[1:], hevc=True) is None


# ---- Frames in decode order (the reorder limit) ----


def _rbsp(nal: bytes) -> bytes:
    return re.sub(b"\x00\x00\x03", b"\x00\x00", nal[1:])


def _x264(tmp_path: Path, *args: str) -> list[bytes]:
    """Encode a few frames with libx264; return the stream's NAL units."""
    if shutil.which("ffmpeg") is None:
        pytest.skip("ffmpeg is not installed")
    path = tmp_path / "x264.h264"
    subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=15",
            "-frames:v", "20", "-c:v", "libx264", "-g", "10", *args,
            "-pix_fmt", "yuv420p", "-f", "h264", str(path),
        ],
        check=True,
    )  # fmt: skip
    units = path.read_bytes().split(b"\x00\x00\x01")
    return [u.rstrip(b"\x00") for u in units if u.rstrip(b"\x00")]


def _ffmpeg(tmp_path: Path, units: list[bytes], *args: str) -> str:
    """Run ffmpeg on an Annex B stream; return what it printed."""
    path = tmp_path / "stream.h264"
    path.write_bytes(b"".join(b"\x00\x00\x00\x01" + u for u in units))
    result = subprocess.run(
        ["ffmpeg", "-hide_banner", "-i", str(path), *args, "-f", "null", "-"],
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    return result.stderr


def _with_sps(units: list[bytes], sps: bytes) -> list[bytes]:
    return [sps if u[0] & 0x1F == 7 else u for u in units]


def _decodes(tmp_path: Path, units: list[bytes]) -> None:
    errors = _ffmpeg(tmp_path, units, "-v", "error")
    assert errors.strip() == ""


def test_parse_an_sps(tmp_path: Path) -> None:
    """Fields and bit positions agree with ffmpeg's trace_headers."""
    units = _x264(tmp_path, "-bf", "2")
    sps = next(u for u in units if u[0] & 0x1F == 7)
    info = parse_avc_sps(sps)
    assert (info.profile, info.poc_type, info.reorder) == (100, 0, 2)
    assert (info.width, info.height) == (640, 360)
    assert info.restriction_at is not None
    trace = _ffmpeg(tmp_path, units, "-c", "copy", "-bsf:v", "trace_headers")
    # trace_headers counts bits from the NAL unit header.
    assert re.search(rf"\] {info.vui_at + 8} +vui_parameters_present_flag ", trace)
    assert re.search(
        rf"\] {info.restriction_at + 8} +bitstream_restriction_flag ", trace
    )
    # Already in decode order: B-frames are limited, or POC type 2 (no B-frames).
    assert limit_reorder(sps) is None
    plain = next(u for u in _x264(tmp_path, "-bf", "0") if u[0] & 0x1F == 7)
    assert parse_avc_sps(plain).poc_type == 2
    assert limit_reorder(plain) is None
    assert limit_reorder(b"\x67\x64") is None


@pytest.mark.parametrize("vui", [True, False])
def test_limit_reorder(tmp_path: Path, vui: bool) -> None:
    """An SPS without a reorder limit gets one; the stream still decodes."""
    units = _x264(tmp_path, "-bf", "2")
    sps = next(u for u in units if u[0] & 0x1F == 7)
    info = parse_avc_sps(sps)
    assert info.restriction_at is not None
    # As some cameras send it: a VUI without bitstream restriction, or no VUI.
    if vui:
        unlimited = _Writer().copy(_rbsp(sps), info.restriction_at).u(1, 0).nal(sps[:1])
    else:
        unlimited = _Writer().copy(_rbsp(sps), info.vui_at).u(1, 0).nal(sps[:1])
    assert parse_avc_sps(unlimited).reorder is None
    _decodes(tmp_path, _with_sps(units, unlimited))

    limited = limit_reorder(unlimited)
    assert limited is not None
    fixed = parse_avc_sps(limited)
    assert (fixed.reorder, fixed.poc_type, fixed.max_num_ref_frames) == (0, 0, 4)
    assert (fixed.width, fixed.height) == (640, 360)
    assert limit_reorder(limited) is None
    stream = _with_sps(units, limited)
    _decodes(tmp_path, stream)
    trace = _ffmpeg(tmp_path, stream, "-c", "copy", "-bsf:v", "trace_headers")
    assert re.search(r"max_num_reorder_frames +\S+ = 0", trace)
    assert re.search(r"max_dec_frame_buffering +\S+ = 4", trace)

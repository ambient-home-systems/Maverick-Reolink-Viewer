"""H.264/H.265 parameter sets and the init rebuild (live/h26x.py)."""

import struct

import pytest

from custom_components.reolink_viewer.fmp4 import child_boxes
from custom_components.reolink_viewer.live.h26x import (
    compare_sets,
    init_config,
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

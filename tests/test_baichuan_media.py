"""Baichuan media blocks: reassembly and the stream analysis (Phase 5b, step 1)."""

from pathlib import Path
import shutil
import struct
import subprocess

import pytest

from custom_components.reolink_viewer import baichuan_media as bm
from custom_components.reolink_viewer.baichuan_media import (
    BitReader,
    Block,
    BlockReader,
    StreamAnalysis,
    blocks_of,
    h264_slice_type,
    h265_slice_type,
    nal_units,
    parse_adts,
    parse_h264_sps,
    parse_h265_pps,
    parse_h265_sps,
)

# Parameter sets x264 and x265 wrote (320x240 at 10 fps with B-frames; 1920x1088).
H264_SPS = bytes.fromhex("674d400ceca0a0fd8088000003000800000300a078a14cb0")
H264_PPS = bytes.fromhex("68ce0fc8")
H265_VPS = bytes.fromhex("40010c01ffff01600000030090000003000003003c959009")
H265_SPS = bytes.fromhex(
    "42010101600000030090000003000003003ca00a080f16595912930bc05a020000030002000003001410"
)
H265_SPS_1088 = bytes.fromhex(
    "420101016000000300900000030000030078a003c0801105965654a4c2f0168080000003008000000c84"
)
H265_PPS = bytes.fromhex("4401c073c189")
# Slice NAL units, hand-made: the header, then first_mb/first_slice, the PPS
# id where there is one, and the slice type as Exp-Golomb bits.
H264_IDR_I = bytes.fromhex("65b8")  # type 5: ue(0) '1', ue(2) '011'
H264_P = bytes.fromhex("41c0")  # type 1: '1', ue(0) '1'
H264_B = bytes.fromhex("41a0")  # type 1: '1', ue(1) '010'
H265_IDR_I = bytes.fromhex("2601ac")  # type 19: first 1, no_output 0, pps '1', ue(2)
H265_P = bytes.fromhex("0201d0")  # type 1: first 1, pps '1', ue(1) '010'
H265_B = bytes.fromhex("0201e0")  # type 1: first 1, pps '1', ue(0) '1'
H265_B_SECOND = bytes.fromhex("020160")  # a second slice segment of a picture
START = b"\x00\x00\x00\x01"


class BitWriter:
    """Writes bits and Exp-Golomb codes (to build parameter sets by hand)."""

    def __init__(self) -> None:
        self.bits = ""

    def u(self, bits: int, value: int) -> BitWriter:
        self.bits += format(value, f"0{bits}b") if bits else ""
        return self

    def ue(self, value: int) -> BitWriter:
        code = format(value + 1, "b")
        self.bits += "0" * (len(code) - 1) + code
        return self

    def se(self, value: int) -> BitWriter:
        return self.ue(2 * value - 1 if value > 0 else -2 * value)

    def bytes(self) -> bytes:
        bits = self.bits + "1"
        bits += "0" * (-len(bits) % 8)
        return int(bits, 2).to_bytes(len(bits) // 8, "big")


def annexb(*units: bytes) -> bytes:
    return b"".join(START + u for u in units)


def video(
    kind: str, payload: bytes, *, codec: str = "H264", micro: int = 0, unix: int = 0
) -> bytes:
    if kind == "key":
        header = (
            b"00dc"
            + codec.encode()
            + struct.pack("<IIII", len(payload), 8, micro, 0x12345678)
            + struct.pack("<II", unix, 0)
        )
    else:
        header = (
            b"01dc" + codec.encode() + struct.pack("<IIII", len(payload), 0, micro, 0)
        )
    return header + payload + bytes(-len(payload) % 8)


def audio(payload: bytes, magic: bytes = b"05wb") -> bytes:
    return (
        magic
        + struct.pack("<HH", len(payload), len(payload))
        + payload
        + bytes(-len(payload) % 8)
    )


def adts_frame(
    *, object_type: int = 2, rate_index: int = 8, channels: int = 1, samples: int = 30
) -> bytes:
    length = 7 + samples
    header = bytes(
        [
            0xFF,
            0xF1,
            ((object_type - 1) << 6) | (rate_index << 2) | (channels >> 2),
            ((channels & 3) << 6) | (length >> 11),
            (length >> 3) & 0xFF,
            ((length & 7) << 5) | 0x1F,
            0xFC,
        ]
    )
    return header + bytes(range(samples))


def info_block(width: int = 640, height: int = 360, fps: int = 15) -> bytes:
    return (
        b"1001"
        + struct.pack("<III", 32, width, height)
        + bytes([0, fps])
        + bytes([126, 10, 27, 5, 47, 31, 126, 10, 27, 6, 47, 31])
        + bytes(2)
    )


def test_block_reader_reassembles_across_chunks_and_padding() -> None:
    key = annexb(H264_SPS, H264_PPS, H264_IDR_I) + bytes(5)  # 5: padding needed
    stream = info_block() + video("key", key, micro=1000, unix=1700000000)
    stream += video("frame", annexb(H264_P), micro=1100) + audio(adts_frame())
    stream += video("frame", annexb(H264_B), micro=1050)
    reader = BlockReader()
    blocks: list[Block] = []
    for at in range(0, len(stream), 7):  # boundaries fall inside every header
        blocks += reader.feed(stream[at : at + 7])
    blocks += reader.finish()
    assert [b.kind for b in blocks] == ["info", "key", "frame", "audio", "frame"]
    assert blocks[1].codec == "H264"
    assert blocks[1].micro == 1000
    assert blocks[1].unix_time == 1700000000
    assert blocks[1].unknown == 0x12345678
    assert blocks[1].payload == key
    assert blocks[2].unix_time is None
    assert blocks[3].payload == adts_frame()
    assert reader.resyncs == 0
    assert reader.skipped_bytes == 0
    # The whole stream in one go gives the same blocks, and sees the padding.
    whole = list(blocks_of(stream))
    assert [b.payload for b in whole] == [b.payload for b in blocks]
    assert whole[1].pad == -len(key) % 8 == 1


def test_block_reader_resyncs_and_skips_implausible_sizes() -> None:
    reader = BlockReader()
    good = video("frame", annexb(H264_P), micro=5)
    blocks = reader.feed(b"junk" * 3 + good)
    assert [b.kind for b in blocks] == ["frame"]
    assert reader.resyncs == 1
    assert reader.skipped_bytes == 12
    # A block ending a chunk is taken at once; its padding goes with the next.
    assert reader.pending == 2
    assert reader.feed(good) == [blocks[0]]
    assert reader.resyncs == 1
    assert reader.skipped_bytes == 12
    # An implausible frame size is stepped over rather than waited for.
    bad = b"01dc" + b"H264" + struct.pack("<IIII", 2**31, 0, 0, 0)
    blocks = reader.feed(bad + good + good)
    assert [b.kind for b in blocks] == ["frame", "frame"]
    assert reader.implausible == 1
    # Bytes without any magic are dropped but for the last three.
    reader.feed(bytes(100))
    assert reader.pending == 3
    # A block cut short at the end of the stream is dropped by finish().
    reader = BlockReader()
    assert reader.feed(good[:-10]) == []
    assert reader.finish() == []
    assert reader.pending == 0


def test_bit_reader_and_nal_units() -> None:
    r = BitReader(BitWriter().u(1, 1).ue(0).ue(2).ue(7).bytes())
    assert r.u(1) == 1
    assert r.ue() == 0
    assert r.ue() == 2
    assert r.ue() == 7
    with pytest.raises(ValueError, match="ended"):
        r.u(16)
    with pytest.raises(ValueError, match="Exp-Golomb"):
        BitReader(bytes(8)).ue()
    reader = BitReader(BitWriter().se(-3).se(2).bytes())
    assert reader.se() == -3
    assert reader.se() == 2
    assert nal_units(annexb(H264_SPS, H264_PPS) + b"\x00\x00\x01" + H264_P) == (
        "annexb",
        [H264_SPS, H264_PPS, H264_P],
    )
    sized = struct.pack(">I", len(H264_SPS)) + H264_SPS + struct.pack(">I", 2) + H264_P
    assert nal_units(sized) == ("avcc", [H264_SPS, H264_P])
    assert nal_units(b"\x00\x00\x00\x09abc") == ("unknown", [])
    assert nal_units(b"") == ("unknown", [])


def test_h264_parameter_sets_and_slices() -> None:
    sps = parse_h264_sps(H264_SPS)
    assert sps["codec"] == "avc1.4D400C"
    assert (sps["width"], sps["height"]) == (320, 240)
    assert sps["max_num_ref_frames"] == 4
    assert sps["vui_fps"] == 10.0
    assert h264_slice_type(H264_IDR_I) == "I"
    assert h264_slice_type(H264_P) == "P"
    assert h264_slice_type(H264_B) == "B"
    assert h264_slice_type(H264_PPS) is None
    # A High profile SPS with scaling lists, 4:2:0, cropped 1920x1088 to 1080,
    # pic_order_cnt_type 1, interlaced, and a VUI with an aspect ratio.
    w = BitWriter().u(8, 100).u(8, 0).u(8, 41).ue(0)
    w.ue(1).ue(0).ue(0).u(1, 0).u(1, 1)  # chroma, bit depths, qpprime, matrix
    w.u(1, 1)  # the first list is present: 16 deltas of 0 (next_scale stays 8)
    for _ in range(16):
        w.se(0)
    for _ in range(7):
        w.u(1, 0)
    w.ue(0).ue(1).u(1, 0).se(0).se(0).ue(1).se(1)  # poc type 1 with one cycle entry
    w.ue(2).u(1, 0).ue(119).ue(33).u(1, 0).u(1, 1).u(1, 1)  # 120x34 MBs, fields
    w.u(1, 1).ue(0).ue(0).ue(0).ue(2)  # crop 4 lines at the bottom (2 units of 2)
    w.u(1, 1).u(1, 1).u(8, 255).u(16, 1).u(16, 1)  # VUI: extended SAR
    w.u(1, 1).u(1, 1).u(1, 1).u(3, 5).u(1, 1).u(1, 1).u(24, 0)  # overscan, signal
    w.u(1, 1).ue(0).ue(0).u(1, 1).u(32, 1000).u(32, 50000).u(1, 1)  # chroma loc, timing
    high = parse_h264_sps(b"\x67" + w.bytes())
    assert high["codec"] == "avc1.640029"
    assert (high["width"], high["height"]) == (1920, 1080)
    assert high["frame_mbs_only"] is False
    assert high["pic_order_cnt_type"] == 1
    assert high["vui_fps"] == 25.0
    assert high["vui_fixed_frame_rate"] is True
    # A 4:4:4 SPS takes the separate-colour-plane flag and 12 scaling lists.
    w = BitWriter().u(8, 244).u(8, 0).u(8, 30).ue(0).ue(3).u(1, 0).ue(0).ue(0).u(1, 0)
    w.u(1, 1)
    for _ in range(12):
        w.u(1, 0)
    w.ue(0).ue(2).ue(1).u(1, 0).ue(9).ue(9).u(1, 1).u(1, 0).u(1, 0).u(1, 0)
    assert parse_h264_sps(b"\x67" + w.bytes())["width"] == 160
    # An SPS cut short raises, which the analysis records.
    with pytest.raises(ValueError, match="ended"):
        parse_h264_sps(H264_SPS[:6])


def test_h265_parameter_sets_and_slices() -> None:
    sps = parse_h265_sps(H265_SPS)
    assert sps["codec"] == "hvc1.1.6.L60.90"
    assert (sps["width"], sps["height"]) == (320, 240)
    assert sps["log2_ctb_size"] == 5
    assert parse_h265_sps(H265_SPS_1088)["height"] == 1088
    pps = parse_h265_pps(H265_PPS)
    assert pps == {"pps_id": 0, "dependent_slices": 0, "extra_bits": 0}
    table = {0: pps}
    assert h265_slice_type(H265_IDR_I, table) == "I"
    assert h265_slice_type(H265_P, table) == "P"
    assert h265_slice_type(H265_B, table) == "B"
    assert h265_slice_type(H265_B_SECOND, table) is None  # not the first segment
    assert h265_slice_type(H265_VPS, table) is None
    # Extra slice header bits are skipped when the PPS announces them.
    with_extra = bytes.fromhex("0201ca")  # first 1, pps '1', one extra bit, ue(1)
    assert h265_slice_type(with_extra, {0: {"extra_bits": 1}}) == "P"
    # A Main 10, high tier SPS with sub-layers, a conformance window and 4:2:2,
    # made by hand: the profile_tier_level with two sub-layers' flags.
    w = BitWriter().u(4, 0).u(3, 2).u(1, 1)
    w.u(2, 0).u(1, 1).u(5, 2).u(32, 0x20000000).u(48, 0x900000000000).u(8, 150)
    w.u(1, 1).u(1, 0).u(1, 0).u(1, 1)  # sub-layer 0: profile; sub-layer 1: level
    for _ in range(2, 8):
        w.u(2, 0)
    w.u(88, 0).u(8, 120)
    w.ue(0).ue(2).ue(1296).ue(740).u(1, 1).ue(8).ue(0).ue(0).ue(20).ue(2).ue(2)
    w.ue(4).u(1, 0).ue(1).ue(0).ue(0).ue(1).ue(1)  # ordering info for the top layer
    main10 = parse_h265_sps(b"\x42\x01" + w.bytes())
    assert main10["codec"] == "hvc1.2.4.H150.90"
    assert main10["tier"] == "high"
    assert (main10["width"], main10["height"]) == (1280, 720)
    assert main10["bit_depth"] == 10
    assert main10["chroma_format_idc"] == 2


def test_adts() -> None:
    frame = adts_frame()
    parsed = parse_adts(frame + frame)
    assert parsed == {
        "object_type": 2,
        "codec": "mp4a.40.2",
        "sample_rate": 16000,
        "channels": 1,
        "mpeg_version": 4,
        "frame_length": 37,
        "frames_per_block": 2,
        "partial_frame": False,
        "bytes_after_frames": 0,
    }
    cut = parse_adts(frame + frame[:20])
    assert cut is not None
    assert cut["frames_per_block"] == 1
    assert cut["partial_frame"] is True
    assert parse_adts(b"\x01\x02\x03" * 4) is None
    stereo = parse_adts(adts_frame(object_type=4, rate_index=3, channels=2))
    assert stereo is not None
    assert (stereo["codec"], stereo["sample_rate"], stereo["channels"]) == (
        "mp4a.40.4",
        48000,
        2,
    )
    odd = parse_adts(adts_frame(rate_index=15))
    assert odd is not None
    assert odd["sample_rate"] is None


def _analyse(stream: bytes) -> StreamAnalysis:
    analysis = StreamAnalysis()
    for block in blocks_of(stream):
        analysis.feed(block)
    return analysis


def test_analysis_h264_with_b_frames_and_aac() -> None:
    stream = info_block()
    # 10 fps: a 100,000-tick counter means microseconds; key frames 1 s apart.
    frames = [annexb(H264_SPS, H264_PPS, H264_IDR_I), annexb(H264_P), annexb(H264_B)]
    micro = 500_000
    for i in range(20):
        kind = "key" if i % 10 == 0 else "frame"
        payload = frames[0] if kind == "key" else frames[1 + (i % 2)]
        stream += video(kind, payload, micro=micro, unix=1_700_000_000 + i // 10)
        stream += audio(adts_frame() * 2)
        micro += 100_000
    result = _analyse(stream).as_dict()
    video_part = result["video"]
    assert isinstance(video_part, dict)
    assert video_part["codec"] == "h264"
    assert video_part["codec_labels"] == {"H264": 20}
    assert video_part["key_frames"] == 2
    assert video_part["frames"] == 18
    assert video_part["pictures"] == {"I": 2, "P": 8, "B": 10}
    assert video_part["b_frames"] is True
    assert video_part["parameter_sets"] == {
        "sps": [H264_SPS.hex()],
        "pps": [H264_PPS.hex()],
    }
    assert video_part["nal_types"] == {"1": 18, "5": 2, "7": 2, "8": 2}
    assert video_part["nal_layout"] == {"annexb": 20}
    sps = video_part["sps"]
    assert isinstance(sps, dict)
    assert sps["codec"] == "avc1.4D400C"
    assert video_part["key_extra_header_sizes"] == {8: 2}
    assert video_part["header_unknown_field"] == ["12345678", "00000000"]
    assert video_part["ticks_per_second"] == 1_000_000
    assert video_part["fps_estimate"] == 10.0
    times = video_part["timestamps"]
    assert isinstance(times, dict)
    assert times["count"] == 20
    assert (times["first"], times["last"]) == (500_000, 2_400_000)
    assert times["delta_median"] == 100_000
    assert times["negative_steps"] == 0
    unix = video_part["key_unix_times"]
    assert isinstance(unix, dict)
    assert (unix["first"], unix["last"]) == (1_700_000_000, 1_700_000_001)
    assert video_part["padding"]
    audio_part = result["audio"]
    assert isinstance(audio_part, dict)
    assert audio_part["blocks"] == 20
    assert audio_part["magics"] == {"05wb": 20}
    aac = audio_part["aac"]
    assert isinstance(aac, dict)
    assert (aac["codec"], aac["sample_rate"], aac["channels"]) == (
        "mp4a.40.2",
        16000,
        1,
    )
    assert aac["frames_per_block"] == 2
    assert audio_part["sample_rates"] == {"16000": 20}
    assert audio_part["adpcm"] is None
    assert result["info"] == [
        {
            "magic": "1001",
            "header_len": 32,
            "declared": 32,
            "width": 640,
            "height": 360,
            "fps": 15,
            "hex": info_block().hex(),
            "start": "2026-10-27 05:47:31",
            "end": "2026-10-27 06:47:31",
        }
    ]


def test_analysis_h265_adpcm_and_a_wrong_label() -> None:
    stream = video(
        "key", annexb(H265_VPS, H265_SPS, H265_PPS, H265_IDR_I), codec="H264", micro=0
    )
    # The counter steps back on a B-frame sent in decode order.
    stream += video("frame", annexb(H265_P), codec="H264", micro=200)
    stream += video("frame", annexb(H265_B, H265_B_SECOND), codec="H264", micro=100)
    adpcm = struct.pack("<HH", 0x0100, 256) + bytes([1, 2, 3, 4]) + bytes(512)
    stream += audio(adpcm, magic=b"01wb")
    stream += audio(b"\x55" * 12, magic=b"07wb")
    result = _analyse(stream).as_dict()
    video_part = result["video"]
    assert isinstance(video_part, dict)
    # Labelled H264 by the camera, H.265 by its NAL units.
    assert video_part["codec"] == "h265"
    assert video_part["codec_labels"] == {"H264": 3}
    assert video_part["pictures"] == {"I": 1, "P": 1, "B": 1}
    assert video_part["parameter_sets"] == {
        "vps": [H265_VPS.hex()],
        "sps": [H265_SPS.hex()],
        "pps": [H265_PPS.hex()],
    }
    sps = video_part["sps"]
    assert isinstance(sps, dict)
    assert sps["codec"] == "hvc1.1.6.L60.90"
    times = video_part["timestamps"]
    assert isinstance(times, dict)
    assert times["negative_steps"] == 1
    assert "ticks_per_second" not in video_part  # one key frame: no span
    audio_part = result["audio"]
    assert isinstance(audio_part, dict)
    assert audio_part["magics"] == {"01wb": 1, "07wb": 1}
    assert audio_part["adpcm"] == {
        "kind": "0100",
        "half_block_size": 256,
        "state": "01020304",
    }
    assert audio_part["unrecognized_head"] == "55" * 12
    assert audio_part["aac"] is None


def test_analysis_handles_broken_units_and_frames_without_parameter_sets() -> None:
    # A frame before any key frame: the label decides the codec.
    analysis = _analyse(video("frame", annexb(H265_P), codec="H265"))
    assert analysis.detected == "h265"
    analysis = _analyse(video("frame", annexb(H264_P), codec="h264"))
    assert analysis.detected == "h264"
    assert _analyse(video("frame", annexb(H264_P), codec="MJPG")).detected is None
    # An unreadable SPS and a truncated slice are recorded, not raised.
    analysis = _analyse(
        video("key", annexb(H264_SPS[:6], H264_PPS, b"\x65"), codec="H264")
    )
    assert analysis.sps is None
    assert analysis.sps_error is not None
    assert analysis.pictures == {"?": 1}
    analysis = _analyse(
        video(
            "key",
            annexb(H265_VPS, H265_SPS[:8], b"\x44\x01", b"\x26\x01"),
            codec="H265",
        )
    )
    assert analysis.sps_error is not None
    assert analysis.pictures == {"?": 1}
    assert analysis._pps == {}
    # Payload without NAL units: counted, nothing decoded.
    analysis = _analyse(video("key", b"\x00" * 16, codec="H264"))
    assert analysis.layouts == {"unknown": 1}
    assert analysis.detected is None
    # Only a few distinct parameter sets and samples are kept.
    analysis = StreamAnalysis()
    for i in range(10):
        analysis.feed(
            Block(
                "key",
                b"00dc",
                bytes(32),
                annexb(H264_SPS + bytes([i]), H264_PPS),
                unknown=i,
            )
        )
    assert len(analysis.parameter_sets["sps"]) == bm.MAX_PARAMETER_SETS
    assert len(analysis.unknown_field) == bm.MAX_SAMPLES
    # The counter wrapping around is told apart from a step back.
    analysis = StreamAnalysis()
    analysis.feed(Block("frame", b"01dc", bytes(24), b"", micro=2**32 - 10))
    analysis.feed(Block("frame", b"01dc", bytes(24), b"", micro=5))
    assert analysis.video_time.wrapped == 1
    assert analysis.video_time.negative == 0
    assert "delta_min" not in analysis.video_time.as_dict()


def _encode(path: Path, args: list[str]) -> bytes | None:
    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg is None:
        return None
    result = subprocess.run(
        [ffmpeg, "-hide_banner", "-loglevel", "error", "-y", *args, str(path)],
        capture_output=True,
        check=False,
    )
    if result.returncode != 0:
        return None
    return path.read_bytes()


@pytest.mark.parametrize(
    ("codec", "args", "expected"),
    [
        (
            "h264",
            [
                "-c:v",
                "libx264",
                "-preset",
                "ultrafast",
                "-bf",
                "2",
                "-g",
                "10",
                "-f",
                "h264",
            ],
            "avc1.",
        ),
        (
            "h265",
            [
                "-c:v",
                "libx265",
                "-preset",
                "ultrafast",
                "-x265-params",
                "bframes=2:keyint=10:log-level=none",
                "-f",
                "hevc",
            ],
            "hvc1.",
        ),
    ],
)
def test_analysis_of_a_real_encoder_stream(
    tmp_path: Path, codec: str, args: list[str], expected: str
) -> None:
    """x264 and x265 streams with B-frames, cut into access units by hand."""
    data = _encode(
        tmp_path / f"stream.{codec}",
        [
            "-f",
            "lavfi",
            "-i",
            "testsrc=size=320x240:rate=10",
            "-t",
            "1.2",
            "-pix_fmt",
            "yuv420p",
            *args,
        ],
    )
    if data is None:
        pytest.skip("ffmpeg with libx264 and libx265 is not installed")
    _layout, units = nal_units(data)
    h265 = codec == "h265"
    access_units: list[list[bytes]] = []
    for unit in units:
        kind = bm.h265_nal_type(unit) if h265 else bm.h264_nal_type(unit)
        is_slice = kind <= 21 if h265 else kind in (1, 5)
        first = bool(unit[2] & 0x80) if h265 else bool(unit[1] & 0x80)
        starts_picture = is_slice and first
        if starts_picture or not access_units:
            access_units.append([])
        access_units[-1].append(unit)
    analysis = StreamAnalysis()
    for i, au in enumerate(access_units):
        key = i == 0
        analysis.feed(
            Block(
                "key" if key else "frame",
                b"00dc" if key else b"01dc",
                bytes(32 if key else 24),
                annexb(*au),
                codec=codec.upper(),
                micro=i * 100_000,
                unix_time=1_700_000_000 + i // 10 if key else None,
            )
        )
    result = analysis.as_dict()["video"]
    assert isinstance(result, dict)
    assert result["codec"] == codec
    assert result["b_frames"] is True
    pictures = result["pictures"]
    assert isinstance(pictures, dict)
    assert pictures["I"] >= 1
    sps = result["sps"]
    assert isinstance(sps, dict)
    assert str(sps["codec"]).startswith(expected)
    assert (sps["width"], sps["height"]) == (320, 240)


def test_analysis_of_a_real_aac_stream(tmp_path: Path) -> None:
    data = _encode(
        tmp_path / "a.aac",
        [
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=440:sample_rate=16000",
            "-t",
            "0.3",
            "-c:a",
            "aac",
            "-ac",
            "1",
            "-f",
            "adts",
        ],
    )
    if data is None:
        pytest.skip("ffmpeg with an AAC encoder is not installed")
    parsed = parse_adts(data)
    assert parsed is not None
    assert (parsed["codec"], parsed["sample_rate"], parsed["channels"]) == (
        "mp4a.40.2",
        16000,
        1,
    )
    frames = parsed["frames_per_block"]
    assert isinstance(frames, int)
    assert frames >= 3
    assert parsed["partial_frame"] is False

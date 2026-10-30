"""Baichuan blocks to MSE fragments (Phase 5b step 2: the muxer)."""

import io
import itertools
import json
from pathlib import Path
import struct

import pytest

from custom_components.reolink_viewer.baichuan_media import Block, blocks_of
from custom_components.reolink_viewer.baichuan_mux import (
    AAC_FRAME,
    NOMINAL_RATE,
    VIDEO_TIMESCALE,
    BaichuanMuxer,
    MuxError,
)
from custom_components.reolink_viewer.fmp4 import (
    FragmentIndex,
    child_boxes,
    fragment_runs,
    init_tracks,
)

from .baichuan_fixtures import (
    FPS,
    GOP,
    Encoded,
    camera_stream,
    encode,
    ffmpeg_decode_errors,
    ffprobe_json,
)
from .test_baichuan_media import (
    H264_PPS,
    H264_SPS,
    H265_PPS,
    H265_SPS,
    H265_VPS,
    START,
    adts_frame,
    annexb,
)

# 2026-10-30 02:00:00 UTC: a recording's start; the cut asks 45 minutes in.
ORIGIN = 1_793_325_600
ASKED = ORIGIN + 45 * 60
IDR = bytes.fromhex("6588840021")  # H.264 IDR slice (type 5)
P = bytes.fromhex("419a2021")  # H.264 non-IDR slice (type 1)
AUD = bytes.fromhex("0910")
HEVC_IDR = bytes.fromhex("2601af0011")  # type 19
HEVC_P = bytes.fromhex("0201d00011")  # type 1


def _mux(data: bytes, muxer: BaichuanMuxer) -> list[bytes]:
    out: list[bytes] = []
    for block in blocks_of(data):
        out += muxer.feed(block)
    return out + muxer.finish()


def _key(payload: bytes, micro: int, unix: int | None, codec: str = "H264") -> Block:
    return Block("key", b"00dc", bytes(32), payload, codec, micro, unix)


def _frame(payload: bytes, micro: int, codec: str = "H264") -> Block:
    return Block("frame", b"01dc", bytes(24), payload, codec, micro)


def _audio(payload: bytes, magic: bytes = b"05wb") -> Block:
    return Block("audio", magic, bytes(8), payload)


def _h264_key(micro: int, unix: int | None, sps: bytes = H264_SPS) -> Block:
    return _key(annexb(AUD, sps, H264_PPS, IDR), micro, unix)


def _index(pieces: list[bytes]) -> FragmentIndex:
    data = b"".join(pieces)
    index = FragmentIndex()
    index.scan(io.BytesIO(data), len(data))
    assert index.error is None, index.error
    return index


def _boxes(data: bytes) -> list[tuple[str, bytes]]:
    return child_boxes(data)


def _trun_rows(fragment: bytes, track: int) -> list[tuple[int, ...]]:
    """(duration, size, flags) per sample of a track's trun in a fragment."""
    moof = _boxes(fragment)[0][1]
    for kind, traf in _boxes(moof):
        if kind != "traf":
            continue
        parts = dict(_boxes(traf))
        if struct.unpack_from(">I", parts["tfhd"], 4)[0] != track:
            continue
        run = parts["trun"]
        flags = int.from_bytes(run[1:4], "big")
        count = struct.unpack_from(">I", run, 4)[0]
        width = 3 if flags & 0x400 else 2
        return [
            struct.unpack_from(f">{width}I", run, 12 + i * 4 * width)
            for i in range(count)
        ]
    return []


def test_h264_gops_become_fragments_on_the_recordings_timeline() -> None:
    """One fragment per group of pictures, placed by the key frame's time."""
    muxer = BaichuanMuxer(ORIGIN, ASKED)
    pieces: list[bytes] = []
    for gop in range(3):
        micro = gop * 1_000_000
        pieces += muxer.feed(_h264_key(micro, ASKED + gop))
        for i in range(1, 10):
            pieces += muxer.feed(_frame(annexb(P), micro + i * 100_000))
    pieces += muxer.finish()
    assert muxer.init is not None
    assert pieces[0] == muxer.init
    assert muxer.mime == 'video/mp4; codecs="avc1.4D400C"'
    assert (muxer.width, muxer.height) == (320, 240)
    index = _index(pieces)
    assert index.mime == muxer.mime
    assert [round(f.start_ms) for f in index.fragments] == [
        2_700_000,
        2_701_000,
        2_702_000,
    ]
    assert all(f.sync for f in index.fragments)
    assert [round(f.duration_ms) for f in index.fragments] == [1000, 1000, 1000]
    rows = _trun_rows(pieces[1], 1)
    assert rows[0][2] == 0x02000000
    assert {r[2] for r in rows[1:]} == {0x01010000}
    assert {r[0] for r in rows} == {VIDEO_TIMESCALE // 10}
    # The delimiter and the parameter sets are out of the samples.
    mdat = _boxes(pieces[1])[1][1]
    assert mdat[:4] == struct.pack(">I", len(IDR))
    assert muxer.first_time == 2700.0
    stats = muxer.stats.as_dict()
    assert stats["fragments"] == 3
    assert stats["anchor"] == "key frame time"
    assert stats["anchor_offset_s"] == 0
    assert stats["key_frames"] == 3
    assert stats["frames"] == 27


def test_frames_before_the_first_key_frame_and_unreadable_ones_are_dropped() -> None:
    muxer = BaichuanMuxer(ORIGIN, ASKED)
    assert muxer.first_time is None
    assert muxer.feed(_frame(annexb(P), 0)) == []
    assert muxer.feed(_audio(adts_frame())) == []
    assert muxer.feed(Block("info", b"1001", bytes(32), b"")) == []
    assert muxer.feed(_key(b"\x01\x02\x03", 0, ASKED)) == []  # no NAL units
    assert muxer.feed(Block("key", b"00dc", bytes(32), annexb(IDR), "H264")) == []
    assert muxer.feed(_key(annexb(bytes([0x80, 1])), 0, ASKED, codec="XXXX")) == []
    muxer.feed(_h264_key(100, ASKED))
    muxer.feed(_frame(annexb(AUD), 200))  # nothing left but the delimiter
    assert muxer.stats.dropped_frames == 5
    assert muxer.stats.dropped_audio == 1
    assert len(muxer.finish()) == 2


def test_a_device_clock_far_from_the_asked_time_anchors_at_the_asked_time() -> None:
    muxer = BaichuanMuxer(ORIGIN, ASKED)
    muxer.feed(_h264_key(0, ASKED + 3600))  # an hour off (a zone error)
    assert muxer.first_time == 2700.0
    assert muxer.stats.anchor == "asked time"
    assert muxer.stats.anchor_offset_s == 3600

    no_time = BaichuanMuxer(ORIGIN, ASKED)
    no_time.feed(_h264_key(0, None))
    assert no_time.stats.anchor == "asked time"

    with pytest.raises(MuxError):
        BaichuanMuxer(ORIGIN).feed(_h264_key(0, 7))
    early = BaichuanMuxer(ORIGIN)
    early.feed(_h264_key(0, ORIGIN - 5))  # before the recording: clamped to 0
    assert early.first_time == 0.0


def test_the_counter_rate_is_learned_from_the_key_frames() -> None:
    """A counter 2 % fast is put back on the POSIX clock after a minute."""
    rate = 1_020_000
    muxer = BaichuanMuxer(ORIGIN, ASKED)
    pieces: list[bytes] = []
    for second in range(0, 181, 2):
        pieces += muxer.feed(_h264_key(second * rate, ASKED + second))
        pieces += muxer.feed(_frame(annexb(P), second * rate + rate))
    pieces += muxer.finish()
    assert muxer.stats.rate_learned
    assert muxer.stats.rate == rate
    index = _index(pieces)
    last = index.fragments[-1]
    # Without the rate the last key frame would sit 3.5 s late.
    assert abs(last.start_ms - 2_880_000) <= 1
    starts = [f.start_ms for f in index.fragments]
    assert starts == sorted(starts)


def test_rates_far_off_are_clamped_and_wraps_and_steps_back_are_absorbed() -> None:
    muxer = BaichuanMuxer(ORIGIN, ASKED)
    start = 2**32 - 500_000
    muxer.feed(_h264_key(start, ASKED))
    muxer.feed(_frame(annexb(P), (start + 400_000) & 0xFFFFFFFF))
    muxer.feed(_frame(annexb(P), (start + 300_000) & 0xFFFFFFFF))  # back
    pieces = muxer.feed(_h264_key((start + 1_000_000) & 0xFFFFFFFF, ASKED + 1))
    assert muxer.stats.counter_steps_back == 1
    rows = _trun_rows(pieces[1], 1)
    assert [r[0] for r in rows] == [36_000, 90, 62_910]
    # A minute later by POSIX time but 2 minutes by the counter: clamped.
    muxer.feed(_h264_key((start + 121_000_000) & 0xFFFFFFFF, ASKED + 61))
    assert muxer.stats.rate == 1_050_000
    muxer.feed(_h264_key((start + 122_000_000) & 0xFFFFFFFF, None))
    assert muxer.stats.rate == 1_050_000


def test_changed_parameter_sets_stay_in_band() -> None:
    muxer = BaichuanMuxer(ORIGIN, ASKED)
    muxer.feed(_h264_key(0, ASKED))
    pieces = muxer.feed(_h264_key(1_000_000, ASKED + 1))
    other_sps = H264_SPS[:-1] + bytes([H264_SPS[-1] ^ 1])
    pieces += muxer.feed(_h264_key(2_000_000, ASKED + 2, sps=other_sps))
    assert muxer.stats.parameter_set_changes == 1
    mdat = _boxes(pieces[-1])[1][1]
    assert mdat[:4] == struct.pack(">I", len(IDR))  # the first: sets taken out
    last = _boxes(muxer.finish()[0])[1][1]
    assert last[:4] == struct.pack(">I", len(other_sps))
    assert last[4 : 4 + len(other_sps)] == other_sps


def test_without_parameter_sets_nothing_is_written_until_they_come() -> None:
    muxer = BaichuanMuxer(ORIGIN, ASKED)
    muxer.feed(_key(annexb(IDR), 0, ASKED))
    muxer.feed(_frame(annexb(P), 100_000))
    assert muxer.feed(_key(annexb(IDR), 1_000_000, ASKED + 1)) == []
    assert muxer.stats.dropped_frames == 2
    assert muxer.init is None
    assert muxer.finish() == []
    # Sets arriving with the next key frame configure the group before it.
    muxer.feed(_key(annexb(IDR), 2_000_000, ASKED + 2))
    pieces = muxer.feed(_h264_key(3_000_000, ASKED + 3))
    assert len(pieces) == 2
    pieces += muxer.finish()
    assert [round(f.start_ms) for f in _index(pieces).fragments] == [
        2_702_000,
        2_703_000,
    ]


def test_h265_init_carries_the_profile_and_the_three_parameter_sets() -> None:
    muxer = BaichuanMuxer(ORIGIN, ASKED)
    key = annexb(bytes.fromhex("4601"), H265_VPS, H265_SPS, H265_PPS, HEVC_IDR)
    muxer.feed(_key(key, 0, ASKED, codec="H265"))
    muxer.feed(_frame(annexb(HEVC_P), 100_000, codec="H265"))
    pieces = muxer.finish()
    assert muxer.mime is not None
    assert muxer.mime.startswith('video/mp4; codecs="hvc1.1.6.L60')
    index = _index(pieces)
    assert index.mime == muxer.mime
    init = pieces[0]
    at = init.index(b"hvcC") + 4
    assert init[at] == 1
    assert init[at + 22] == 3  # three arrays
    for unit in (H265_VPS, H265_SPS, H265_PPS):
        assert unit in init
    mdat = _boxes(pieces[1])[1][1]
    assert mdat[4 : 4 + len(HEVC_IDR)] == HEVC_IDR


def test_aac_follows_the_video_and_is_resynced_or_dropped() -> None:
    muxer = BaichuanMuxer(ORIGIN, ASKED)
    muxer.feed(_h264_key(0, ASKED))
    tone = adts_frame(samples=20)
    two = tone + adts_frame(samples=10)
    muxer.feed(_audio(two))
    for i in range(1, 30):
        muxer.feed(_frame(annexb(P), i * 100_000))
    # 3 s of video, 128 ms of audio: the next frame is moved forward.
    muxer.feed(_audio(tone))
    assert muxer.stats.audio_resyncs == 1
    muxer.feed(_audio(b"\x00" * 12, b"01wb"))  # ADPCM: not muxed
    muxer.feed(_audio(adts_frame(rate_index=4)))  # 44.1 kHz: another config
    pieces = muxer.feed(_h264_key(3_000_000, ASKED + 3))
    assert muxer.mime == 'video/mp4; codecs="avc1.4D400C,mp4a.40.2"'
    assert muxer.stats.audio_frames == 3
    assert muxer.stats.dropped_audio == 2
    tracks = init_tracks(pieces[0])
    assert tracks[2].timescale == 16_000
    moof_size = struct.unpack_from(">I", pieces[1])[0]
    runs = fragment_runs(pieces[1][:moof_size], tracks)
    assert runs[2] == (2_700 * 16_000, 3 * AAC_FRAME, True)
    rows = _trun_rows(pieces[1], 2)
    assert [r[1] for r in rows] == [20, 10, 20]
    # Audio far ahead of the video is dropped until the video catches up.
    muxer._audio_next = round((muxer._last_time + 3) * 16_000)
    muxer.feed(_audio(tone))
    assert muxer.stats.dropped_audio == 3
    # The audio's bytes follow the video's in the mdat, where trun says.
    mdat = _boxes(pieces[1])[1][1]
    assert mdat.endswith(tone[7:])


def test_audio_after_an_init_without_audio_is_dropped() -> None:
    muxer = BaichuanMuxer(ORIGIN, ASKED)
    muxer.feed(_h264_key(0, ASKED))
    muxer.feed(_h264_key(1_000_000, ASKED + 1))
    muxer.feed(_audio(adts_frame()))
    assert muxer.stats.dropped_audio == 1
    assert muxer.mime == 'video/mp4; codecs="avc1.4D400C"'
    assert muxer.finish() != []
    assert muxer.finish() == []


@pytest.mark.parametrize(("codec", "label"), [("h264", "h264"), ("h265", "hevc")])
def test_a_real_encoder_stream_muxes_into_a_file_ffmpeg_decodes(
    tmp_path: Path, codec: str, label: str
) -> None:
    """x264 / x265 and AAC in camera blocks: ffprobe and ffmpeg read it all."""
    encoded = encode(tmp_path, codec)
    if encoded is None:
        pytest.skip("ffmpeg with libx264, libx265 and AAC is not installed")
    data = camera_stream(
        encoded, start_unix=ASKED, rate=1_010_000, start_micro=2**32 - 1_500_000
    )
    muxer = BaichuanMuxer(ORIGIN, ASKED)
    pieces = _mux(data, muxer)
    out = tmp_path / "cut.mp4"
    out.write_bytes(b"".join(pieces))
    assert muxer.stats.dropped_frames == 0
    assert muxer.stats.fragments == len(encoded.units) // GOP
    index = _index(pieces)
    assert len(index.fragments) == muxer.stats.fragments
    assert round(index.fragments[0].start_ms) == 2_700_000
    # The normalized fragments (what the view sends) are what was written.
    file = io.BytesIO(b"".join(pieces))
    assert index.read_fragment(file, 1) == pieces[2]

    probe = ffprobe_json(out, "-show_streams", "-show_format")
    if probe is None:
        pytest.skip("ffprobe is not installed")
    streams = {s["codec_type"]: s for s in json.loads(probe)["streams"]}
    assert streams["video"]["codec_name"] == label
    assert (streams["video"]["width"], streams["video"]["height"]) == (320, 240)
    assert streams["audio"]["codec_name"] == "aac"
    assert streams["audio"]["sample_rate"] == "16000"
    packets = json.loads(
        ffprobe_json(out, "-select_streams", "v", "-show_entries", "packet=pts,flags")
        or "{}"
    )["packets"]
    assert len(packets) == len(encoded.units)
    pts = [p["pts"] for p in packets]
    assert pts == sorted(pts)
    assert pts[0] == 2700 * VIDEO_TIMESCALE
    assert [p["flags"].startswith("K") for p in packets[: GOP + 1]] == [
        True,
        *[False] * (GOP - 1),
        True,
    ]
    # Frames 1/FPS apart on the camera's clock (rounding aside).
    # (The counter's 1 % is learned only after a minute.)
    steps = {b - a for a, b in itertools.pairwise(pts)}
    nominal = VIDEO_TIMESCALE // FPS
    assert all(abs(step - nominal * 1.01) <= 2 for step in steps)
    assert ffmpeg_decode_errors(out) == ""


def test_a_long_stream_keeps_its_clock(tmp_path: Path) -> None:
    """Two minutes at a camera's 1.02 MHz end where the POSIX clock says."""
    encoded = encode(tmp_path, "h264", seconds=1.0)
    if encoded is None:
        pytest.skip("ffmpeg with libx264 and AAC is not installed")
    muxer = BaichuanMuxer(ORIGIN, ASKED)
    data = camera_stream(
        Encoded(encoded.codec, encoded.units, encoded.adts),
        start_unix=ASKED,
        rate=1_020_000,
        repeat=120,
    )
    pieces = _mux(data, muxer)
    index = _index(pieces)
    assert muxer.stats.rate_learned
    assert abs(muxer.stats.rate - 1_020_000) < 20_000
    assert abs(index.fragments[-1].start_ms - (2_700_000 + 119_000)) < 1000
    assert muxer.stats.audio_resyncs == 0
    assert muxer.stats.rate != NOMINAL_RATE


def test_blocks_with_padding_and_the_extra_header_read_as_the_reader_gives_them() -> (
    None
):
    """The muxer takes what BlockReader returns (start codes after headers)."""
    payload = START + H264_SPS + START + H264_PPS + START + IDR
    muxer = BaichuanMuxer(ORIGIN, ASKED)
    block = _key(payload, 0, ASKED)
    assert muxer.feed(block) == []
    assert muxer.finish()[0] == muxer.init


def test_spans_are_joined_by_the_counter() -> None:
    """After pause(), blocks already taken are skipped; a gap is bridged."""
    muxer = BaichuanMuxer(ORIGIN, ASKED)
    assert muxer.resume_unix is None
    muxer.pause()  # nothing started: nothing to join
    assert muxer.stats.spans == 1
    pieces = muxer.feed(_h264_key(0, ASKED))
    pieces += muxer.feed(_frame(annexb(P), 100_000))
    pieces += muxer.feed(_h264_key(1_000_000, ASKED + 1))
    pieces += muxer.feed(_frame(annexb(P), 1_100_000))
    muxer.pause()
    assert muxer.resume_unix == ASKED + 1
    # The next span starts at the first key frame again: all but the last
    # block skipped (and the audio while joining), then on.
    pieces += muxer.feed(_h264_key(0, ASKED))
    pieces += muxer.feed(_audio(adts_frame()))
    pieces += muxer.feed(_frame(annexb(P), 1_100_000))
    pieces += muxer.feed(_frame(annexb(P), 1_200_000))
    pieces += muxer.feed(_h264_key(2_000_000, ASKED + 2))
    pieces += muxer.finish()
    assert muxer.stats.overlap_skipped == 2
    assert muxer.stats.dropped_audio == 1
    assert muxer.stats.spans == 2
    index = _index(pieces)
    assert [round(f.start_ms) for f in index.fragments] == [
        2_700_000,
        2_701_000,
        2_702_000,
    ]
    assert [len(_trun_rows(p, 1)) for p in pieces[1:]] == [2, 3, 1]

    # A key frame without a time: the next span starts from its media time.
    other = BaichuanMuxer(ORIGIN, ASKED)
    other.feed(_h264_key(0, ASKED))
    other.feed(_h264_key(1_000_000, None))
    assert other.resume_unix == ASKED + 1
    other.pause()
    # A gap: the next span begins past the last block; it is taken at once.
    other.feed(_h264_key(3_000_000, ASKED + 3))
    assert other.stats.overlap_skipped == 0
    assert other.stats.key_frames == 3

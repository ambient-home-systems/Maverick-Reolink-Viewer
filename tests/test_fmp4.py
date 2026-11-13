"""Tests for the MSE fragment index and normalizer."""

import dataclasses
import io
import math
from pathlib import Path
import struct

import pytest

from custom_components.reolink_viewer import fmp4
from custom_components.reolink_viewer.fmp4 import (
    FragmentError,
    FragmentIndex,
    clip_fragments,
    normalize_fragment,
    write_clip,
)

from .mp4_fixtures import (
    AUDIO_FRAME,
    AUDIO_FRAMES,
    AUDIO_TIMESCALE,
    FRAME,
    FRAMES,
    FTYP,
    VIDEO_TIMESCALE,
    av_moov,
    box,
    fragmented_av,
    go2rtc_fragment,
    mp4_file,
    mse_ready,
    nvr_shape,
)

NVR = fragmented_av(4, absolute=True, tfdt=False)
MIME = 'video/mp4; codecs="avc1.640033,mp4a.40.2"'


class Strict(io.BytesIO):
    """A file that refuses negative read sizes, as real (buffered) files do."""

    def read(self, size: int | None = -1, /) -> bytes:
        assert size is None or size >= -1, f"read({size})"
        return super().read(size)


def _index(data: bytes, available: int | None = None) -> FragmentIndex:
    index = FragmentIndex()
    index.scan(Strict(data), len(data) if available is None else available)
    return index


def _boxes(data: bytes) -> list[tuple[str, int, bytes]]:
    """(type, offset, payload) of the boxes in ``data``."""
    found = []
    at = 0
    while at + 8 <= len(data):
        size, kind = struct.unpack(">I4s", data[at : at + 8])
        found.append((kind.decode(), at, data[at + 8 : at + size]))
        at += size
    return found


def _check_mse_ready(fragment: bytes, decode: dict[int, int]) -> dict[int, bytes]:
    """Assert a normalized fragment is MSE-ready; return each track's samples."""
    (moof_kind, _at, moof), (mdat_kind, mdat_at, _payload) = _boxes(fragment)[:2]
    assert (moof_kind, mdat_kind) == ("moof", "mdat")
    samples: dict[int, bytes] = {}
    for kind, _offset, traf in _boxes(moof):
        if kind != "traf":
            continue
        children = _boxes(traf)
        assert [c[0] for c in children] == ["tfhd", "tfdt", "trun"]
        tfhd, tfdt, trun = (c[2] for c in children)
        flags = int.from_bytes(tfhd[1:4], "big")
        assert flags & 0x020000  # default-base-is-moof
        assert not flags & 0x01  # no base-data-offset
        (track_id,) = struct.unpack(">I", tfhd[4:8])
        assert tfdt[0] == 1
        assert struct.unpack(">Q", tfdt[4:12])[0] == decode[track_id]
        run_flags = int.from_bytes(trun[1:4], "big")
        assert run_flags & 0x01
        count, data_offset = struct.unpack(">Ii", trun[4:12])
        size = 100 if track_id == 1 else 10
        assert data_offset >= mdat_at + 8
        samples[track_id] = fragment[data_offset : data_offset + count * size]
    return samples


def test_index_of_an_nvr_shaped_recording() -> None:
    """Init segment, codecs and fragments with decode times counted from 0."""
    index = _index(NVR)
    assert index.error is None
    assert index.init == FTYP + av_moov()
    assert index.mime == MIME
    assert [f.start_ms for f in index.fragments] == [0, 2000, 4000, 6000]
    assert {f.duration_ms for f in index.fragments} == {2000}
    assert index.duration_ms == 8000
    assert [dict(f.decode) for f in index.fragments] == [
        {1: i * FRAMES * FRAME, 2: i * AUDIO_FRAMES * AUDIO_FRAME} for i in range(4)
    ]
    assert all(f.sync for f in index.fragments)
    assert sum(f.size for f in index.fragments) == len(NVR) - len(FTYP + av_moov())


def test_index_follows_a_growing_file() -> None:
    """A fragment is listed once wholly on disk; scanning on picks up from there."""
    index = FragmentIndex()
    file = Strict(NVR)
    seen = []
    for available in range(0, len(NVR) + 97, 97):
        index.scan(file, min(available, len(NVR)))
        assert all(f.end <= available for f in index.fragments)
        seen.append(len(index.fragments))
    assert index.init is not None
    assert seen[-1] == 4
    assert seen == sorted(seen)
    whole = _index(NVR)
    assert index.fragments == whole.fragments


def test_normalized_fragments_are_mse_ready() -> None:
    """Relative addressing, a tfdt per track, the same samples."""
    index = _index(NVR)
    file = Strict(NVR)
    for i, fragment in enumerate(index.fragments):
        out = index.read_fragment(file, i)
        samples = _check_mse_ready(out, dict(fragment.decode))
        payload = bytes((i * 31 + j) & 0xFF for j in range(FRAMES * 100 + 310))
        assert samples[1] == payload[: FRAMES * 100]
        assert samples[2] == payload[FRAMES * 100 :]
        # The mdat is copied as stored.
        assert out.endswith(NVR[fragment.offset + fragment.moof_size : fragment.end])


def test_relative_fragments_get_tfdt_too() -> None:
    """Fragments that already use relative offsets keep their decode times."""
    data = fragmented_av(3)
    index = _index(data)
    file = Strict(data)
    for i, fragment in enumerate(index.fragments):
        assert dict(fragment.decode) == {
            1: i * FRAMES * FRAME,
            2: i * AUDIO_FRAMES * AUDIO_FRAME,
        }
        _check_mse_ready(index.read_fragment(file, i), dict(fragment.decode))


def test_find_starts_at_a_sync_fragment() -> None:
    """A start inside a fragment without a key frame goes back to one."""
    index = _index(fragmented_av(4, absolute=True, tfdt=False, non_sync=frozenset({2})))
    assert index.find(0) == 0
    assert index.find(3999) == 1
    assert index.find(4500) == 1  # fragment 2 starts mid-GOP
    assert index.find(6000) == 3
    assert index.find(7999) == 3
    assert index.find(8000) is None  # not indexed (yet)


def test_files_that_cannot_be_fragments() -> None:
    """Plain MP4s and broken fragments are refused with a reason."""
    plain = _index(mp4_file(mdat_bytes=1000))
    assert plain.error == "not a fragmented recording (no mvex)"
    head = FTYP + av_moov()
    stray = box("traf", box("tfhd", bytes(4) + struct.pack(">I", 9)))
    orphan = _index(head + box("moof", stray) + box("mdat", b""))
    assert orphan.error == "fragment of unknown track 9"
    no_mdat = _index(head + box("moof", b"") + box("free", bytes(8)))
    assert no_mdat.error == "free after moof"
    no_moov = _index(FTYP + box("mdat", bytes(10)))
    assert no_moov.error == "mdat before moov"
    garbage = _index(head + b"\x00\x00\x00\x10\x01\x02\x03\x04" + bytes(8))
    assert garbage.error is not None
    assert garbage.error.startswith("unreadable box")
    # A box the scanner does not know is skipped.
    skipped = _index(head + box("free", bytes(20)) + NVR[len(head) :])
    assert len(skipped.fragments) == 4


def test_normalize_refuses_offsets_outside_the_fragment() -> None:
    """Sample data must lie inside the fragment's own bytes."""
    index = _index(NVR)
    fragment = index.fragments[1]
    data = NVR[fragment.offset : fragment.end]
    tracks = index.tracks
    with pytest.raises(FragmentError, match="outside the fragment"):
        # Read as if stored elsewhere: the absolute offsets point away.
        normalize_fragment(
            data,
            fragment.offset + 1000,
            fragment.moof_size,
            dict(fragment.decode),
            tracks,
        )
    with pytest.raises(FragmentError, match="not a moof"):
        normalize_fragment(data[8:], 0, fragment.moof_size, {}, tracks)
    with pytest.raises(FragmentError, match="unknown track"):
        normalize_fragment(data, fragment.offset, fragment.moof_size, {1: 0}, tracks)


@pytest.mark.parametrize(
    ("video", "audio"), [("libx264", "aac"), ("libvpx-vp9", "libopus")]
)
def test_real_recording_round_trip(tmp_path: Path, video: str, audio: str) -> None:
    """ffmpeg's MSE-ready file, put in the NVR's shape, normalizes back to it."""
    path = tmp_path / "ready.mp4"
    if not mse_ready(path, video=video, audio=audio):
        pytest.skip(f"ffmpeg with {video} and {audio} is not installed")
    ready = path.read_bytes()
    nvr = nvr_shape(ready)
    assert nvr != ready
    index = _index(nvr)
    assert index.error is None
    assert len(index.fragments) >= 7
    file = Strict(nvr)
    assert index.init is not None
    rebuilt = index.init + b"".join(
        index.read_fragment(file, i) for i in range(len(index.fragments))
    )
    # Byte for byte what ffmpeg wrote (up to its closing mfra): the same
    # offsets and decode times.
    assert ready[len(rebuilt) + 4 : len(rebuilt) + 8] == b"mfra"
    assert rebuilt == ready[: len(rebuilt)]
    assert index.mime is not None
    assert index.mime.startswith('video/mp4; codecs="')
    assert index.duration_ms == pytest.approx(8000, abs=200)


def test_set_sample_size() -> None:
    """go2rtc's one-sample moof: the size in the tfhd, or in the trun."""
    fragment = go2rtc_fragment(1, 1, 0, bytes(100))
    moof = fragment[: fragment.index(b"mdat") - 4]
    resized = fmp4.set_sample_size(moof, 1234)
    assert resized is not None
    assert len(resized) == len(moof)
    assert struct.pack(">I", 1234) in resized
    assert struct.pack(">I", 100) not in resized[-20:]
    # Per-sample sizes in the trun.
    tfhd = box("tfhd", struct.pack(">II", 0x020000, 1))
    trun = box("trun", struct.pack(">IIiI", 0x000201, 1, 0, 100))
    sized = box("moof", box("traf", tfhd + trun))
    resized = fmp4.set_sample_size(sized, 7)
    assert resized is not None
    assert resized.endswith(struct.pack(">I", 7))
    # A trun that claims a size it lacks, or a tfhd without one: left alone.
    short = box(
        "moof", box("traf", tfhd + box("trun", struct.pack(">IIi", 0x000201, 1, 0)))
    )
    assert fmp4.set_sample_size(short, 7) is None
    no_size = box("moof", box("traf", tfhd + box("trun", struct.pack(">IIi", 1, 1, 0))))
    assert fmp4.set_sample_size(no_size, 7) is None
    # Other layouts are left alone: two samples, two trafs, no moof.
    two = moof.replace(
        struct.pack(">IIi", 0x000001, 1, len(moof) + 8),
        struct.pack(">IIi", 0x000001, 2, len(moof) + 8),
    )
    assert fmp4.set_sample_size(two, 7) is None
    assert fmp4.set_sample_size(b"junk", 7) is None
    nvr = fragmented_av(1)
    nvr_moof = nvr[nvr.index(b"moof") - 4 :]
    assert fmp4.set_sample_size(nvr_moof, 7) is None


def test_a_clip_starts_at_the_key_frame_before_it() -> None:
    """Saving an event (Phase 11 step 2): the fragments that hold the stretch."""
    index = _index(NVR)  # four fragments of 2 s
    assert clip_fragments(index, 4500, 6500) == (2, 3)
    assert clip_fragments(index, 0, 2000) == (0, 0)
    assert clip_fragments(index, -3000, 100) == (0, 0)
    # To the recording's end, and no further.
    assert clip_fragments(index, 3000, 60_000) == (1, 3)
    # A fragment without a key frame: back to the one before it.
    gop = _index(fragmented_av(4, absolute=True, tfdt=False, non_sync=frozenset({2})))
    assert clip_fragments(gop, 4500, 5000) == (1, 2)
    # Nothing to cut.
    assert clip_fragments(index, 9000, 9500) is None
    assert clip_fragments(index, 3000, 3000) is None
    assert clip_fragments(FragmentIndex(), 0, 1000) is None


def test_a_clip_is_its_fragments_from_time_zero() -> None:
    """The init segment, then the fragments normalized, every track from 0."""
    index = _index(NVR)
    out = io.BytesIO()
    size = write_clip(Strict(NVR), index, 2, 3, out)
    clip = out.getvalue()
    assert size == len(clip)
    assert clip.startswith(FTYP + av_moov())
    again = _index(clip)
    assert again.error is None
    # Every track moved back by the earliest one's start: here the audio's
    # (its 2 s fragments are 1.984 s), so it starts at 0 and the video 32 ms on,
    # as they played.
    shift = _shift(dict(index.fragments[2].decode))
    assert shift == {1: 4.0 * VIDEO_TIMESCALE - 2880, 2: 2 * AUDIO_FRAMES * AUDIO_FRAME}
    assert [dict(f.decode) for f in again.fragments] == [
        {t: v - shift[t] for t, v in f.decode} for f in index.fragments[2:]
    ]
    assert [f.start_ms for f in again.fragments] == [32, 2032]
    # The samples as stored, each fragment's own.
    for kept, original in zip(again.fragments, index.fragments[2:], strict=True):
        assert (
            clip[kept.offset + kept.moof_size : kept.end]
            == (NVR[original.offset + original.moof_size : original.end])
        )
        _check_mse_ready(
            clip[kept.offset : kept.end],
            {1: dict(kept.decode)[1], 2: dict(kept.decode)[2]},
        )


def test_a_clip_keeps_its_tracks_in_step() -> None:
    """A track starting later than the other keeps its distance from it."""
    index = _index(NVR)
    third = index.fragments[2]
    late = dict(third.decode)
    late[2] += AUDIO_FRAME * 4  # the audio 4 frames behind the video
    index.fragments[2] = dataclasses.replace(third, decode=tuple(late.items()))
    out = io.BytesIO()
    write_clip(Strict(NVR), index, 2, 2, out)
    (kept,) = _index(out.getvalue()).fragments
    # Now the video is the earlier: it starts at 0, the audio as far after it as before.
    assert dict(kept.decode) == {1: 0, 2: late[2] - _shift(late)[2]}
    assert dict(kept.decode)[2] / AUDIO_TIMESCALE == pytest.approx(
        late[2] / AUDIO_TIMESCALE - late[1] / VIDEO_TIMESCALE, abs=1 / AUDIO_TIMESCALE
    )
    with pytest.raises(FragmentError, match="no init segment"):
        write_clip(Strict(NVR), FragmentIndex(), 0, 0, io.BytesIO())


def _shift(decode: dict[int, int]) -> dict[int, int]:
    """How far a clip moves each track back: the earliest track's start."""
    scales = {1: VIDEO_TIMESCALE, 2: AUDIO_TIMESCALE}
    base = min(value / scales[track] for track, value in decode.items())
    return {track: math.floor(base * scale) for track, scale in scales.items()}

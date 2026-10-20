"""Write frontend/src/playback/mse-sample.ts: a tiny fMP4 clip for MSE probes.

The playback check appends it to a MediaSource (and a ManagedMediaSource, on
WebKit) to learn whether the browser can play appended fragments at all, and
which fragment shapes it accepts:

- ``normalized``: what MSE requires (ISO BMFF byte stream format): every
  ``traf`` has ``default-base-is-moof`` and a ``tfdt``;
- ``absolute``: ``tfhd`` gives an absolute ``base_data_offset`` instead;
- ``noTfdt``: the ``tfdt`` is missing;
- ``nvr``: both, as the RLN36 NVR stores its recordings.

One second of a 64x64 picture at 10 fps, H.264 (what the cameras send) and
VP9 (what Chromium without proprietary codecs plays, for the test harness).
Run from the repository root; needs ffmpeg with libx264 and libvpx:

    python scripts/make_mse_sample.py
"""

import base64
from pathlib import Path
import struct
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from custom_components.reolink_viewer.mp4 import codec_string, parse_box_header  # noqa: E402

OUT = ROOT / "frontend" / "src" / "playback" / "mse-sample.ts"
SOURCE = "color=c=0x3060a0:s=64x64:r=10:d=1,format=yuv420p"
ENCODERS = {
    "h264": ["-c:v", "libx264", "-profile:v", "baseline", "-level", "1.0", "-bf", "0"],
    "vp9": ["-c:v", "libvpx-vp9", "-b:v", "20k"],
}
TFHD_BASE_OFFSET = 0x000001
TFHD_DEFAULT_BASE_IS_MOOF = 0x020000
TRUN_DATA_OFFSET = 0x01


def boxes(
    data: bytes, start: int = 0, end: int | None = None
) -> list[tuple[str, int, int]]:
    """Return (type, offset, end) of the boxes in data[start:end]."""
    found = []
    offset = start
    end = len(data) if end is None else end
    while offset + 8 <= end:
        box = parse_box_header(data[offset : offset + 16], offset)
        assert box is not None
        assert box.end is not None
        found.append((box.type, offset, box.end))
        offset = box.end
    return found


def box(box_type: bytes, payload: bytes) -> bytes:
    """Build one box."""
    return struct.pack(">I4s", 8 + len(payload), box_type) + payload


def rewrite_moof(moof: bytes, *, absolute: int | None, tfdt: bool) -> bytes:
    """Rebuild a single-traf moof with an absolute base offset and/or no tfdt."""
    children = boxes(moof, 8)
    out = b""
    for kind, start, end in children:
        if kind != "traf":
            out += moof[start:end]
            continue
        traf = b""
        delta = 0
        parts = boxes(moof, start + 8, end)
        for inner, s, e in parts:
            payload = bytearray(moof[s + 8 : e])
            if inner == "tfhd" and absolute is not None:
                flags = int.from_bytes(payload[1:4], "big")
                flags = (flags & ~TFHD_DEFAULT_BASE_IS_MOOF) | TFHD_BASE_OFFSET
                payload[1:4] = flags.to_bytes(3, "big")
                payload[8:8] = struct.pack(">Q", absolute)
                delta += 8
            elif inner == "tfdt" and not tfdt:
                delta -= e - s
                continue
            traf += box(inner.encode(), bytes(payload))
        out += box(b"traf", traf)
    rebuilt = bytearray(box(b"moof", out))
    # trun.data_offset counts from the moof start: move it with the mdat.
    for kind, start, end in boxes(bytes(rebuilt), 8):
        if kind != "traf":
            continue
        for inner, s, _e in boxes(bytes(rebuilt), start + 8, end):
            if inner == "trun" and rebuilt[s + 11] & TRUN_DATA_OFFSET:
                (value,) = struct.unpack_from(">i", rebuilt, s + 16)
                struct.pack_into(">i", rebuilt, s + 16, value + delta)
    return bytes(rebuilt)


def sample(encoder: list[str]) -> dict[str, str]:
    """Encode the clip and return its parts (base64) and codec string."""
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "clip.mp4"
        subprocess.run(  # noqa: S603 - fixed arguments
            [  # noqa: S607 - the ffmpeg on PATH
                "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                "-f", "lavfi", "-i", SOURCE, *encoder, "-g", "10",
                "-movflags", "frag_keyframe+empty_moov+default_base_moof",
                "-f", "mp4", str(path),
            ],
            check=True,
        )  # fmt: skip
        data = path.read_bytes()
    top = {kind: (start, end) for kind, start, end in boxes(data)}
    init = data[: top["moov"][1]]
    moof = data[top["moof"][0] : top["moof"][1]]
    mdat = data[top["mdat"][0] : top["mdat"][1]]
    assert top["moof"][0] == len(init), "one fragment right after the init segment"
    stsd = data.index(b"stsd")
    entry = data[stsd + 12 :]
    codec = codec_string(entry[: int.from_bytes(entry[:4], "big")])
    if codec == "vp09":
        # vpcC: version and flags, profile, level, bit depth (high 4 bits).
        at = data.index(b"vpcC") + 8
        profile, level, depth = data[at], data[at + 1], data[at + 2] >> 4
        codec = f"vp09.{profile:02d}.{level:02d}.{depth:02d}"
    assert codec is not None
    variants = {
        "normalized": moof,
        "absolute": rewrite_moof(moof, absolute=len(init), tfdt=True),
        "noTfdt": rewrite_moof(moof, absolute=None, tfdt=False),
        "nvr": rewrite_moof(moof, absolute=len(init), tfdt=False),
    }
    parts = {"init": init, "mdat": mdat, **variants}
    encoded = {key: base64.b64encode(value).decode() for key, value in parts.items()}
    return {"codec": codec, **encoded}


def main() -> None:
    """Write the TypeScript module."""
    samples = {name: sample(args) for name, args in ENCODERS.items()}
    lines = [
        "// Generated by scripts/make_mse_sample.py: do not edit.",
        "// A 1 s, 64x64 fMP4 clip (init segment, one mdat, four moof shapes) for",
        "// the playback check's MediaSource probes. Base64.",
        "",
        "export interface MseSample {",
        "  codec: string;",
        "  init: string;",
        "  mdat: string;",
        "  normalized: string;",
        "  absolute: string;",
        "  noTfdt: string;",
        "  nvr: string;",
        "}",
        "",
        'export const MSE_SAMPLES: Record<"h264" | "vp9", MseSample> = {',
    ]
    for name, fields in samples.items():
        lines.append(f"  {name}: {{")
        lines.extend(f'    {key}: "{value}",' for key, value in fields.items())
        lines.append("  },")
    lines.append("};")
    OUT.write_text("\n".join(lines) + "\n")
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()

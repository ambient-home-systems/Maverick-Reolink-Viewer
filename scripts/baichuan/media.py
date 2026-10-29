"""Summarize Baichuan binary media without keeping any of it.

The media stream (live, replay, talk) is a sequence of blocks, each with a
4-character magic: ``100x`` stream information (32 bytes), ``N0dc`` a video key
frame (32-byte header), ``N1dc`` a video frame (24-byte header), ``0Nwb`` audio
(8-byte header). The layouts come from reolink-aio's ``snapshot_past`` and the
public descriptions listed in docs/baichuan-playback.md; anything that does not
fit is reported as such (a resync, with the first bytes of the unknown stretch)
so a capture can correct the description rather than be hidden by it.

Blocks cross message boundaries, so a stream keeps its own buffer and reports
each block against the message in which its header began.
"""

from collections import Counter
from dataclasses import dataclass, field
from datetime import UTC, datetime
import re
import struct

MAGIC_RE = re.compile(rb"[0-9][01]dc|0[0-9]wb|100[0-9]")
INFO_HEADER = 32
KEYFRAME_HEADER = 32
FRAME_HEADER = 24
AUDIO_HEADER = 8
ALIGN = 8
RESYNC_WINDOW = 64
MAX_BLOCK = 16 * 1024 * 1024


@dataclass(frozen=True, slots=True)
class Block:
    """One media block, summarized."""

    kind: str  # info, key, frame, audio, unknown
    magic: str
    offset: int
    header_len: int
    size: int
    codec: str = ""
    microseconds: int | None = None
    unix_time: int | None = None
    note: str = ""
    msg_index: int = -1

    def describe(self) -> str:
        """One short line."""
        parts = [self.kind, self.magic]
        if self.codec:
            parts.append(self.codec)
        parts.append(f"{self.size} B")
        if self.unix_time is not None:
            when = datetime.fromtimestamp(self.unix_time, tz=UTC).strftime("%H:%M:%S")
            parts.append(f"t={when}Z")
        if self.microseconds is not None:
            parts.append(f"us={self.microseconds}")
        if self.note:
            parts.append(f"({self.note})")
        return " ".join(parts)


@dataclass(slots=True)
class MediaStream:
    """A continuous media stream fed message by message."""

    buffer: bytearray = field(default_factory=bytearray)
    base: int = 0  # stream offset of buffer[0]
    msg_starts: list[tuple[int, int]] = field(
        default_factory=list
    )  # (offset, msg_index)
    blocks: list[Block] = field(default_factory=list)
    total: int = 0

    def feed(self, data: bytes, msg_index: int) -> list[Block]:
        """Add a message's binary payload; return the blocks whose header began in it."""
        self.msg_starts.append((self.total, msg_index))
        self.buffer += data
        self.total += len(data)
        return self._drain(flush=False)

    def finish(self) -> list[Block]:
        """Report what is left in the buffer once the stream has ended."""
        blocks = self._drain(flush=True)
        if self.buffer:
            blocks.append(self._unknown(len(self.buffer), "trailing bytes at the end"))
            self._consume(len(self.buffer))
            self.blocks.append(blocks[-1])
        return blocks

    def _drain(self, flush: bool) -> list[Block]:
        new: list[Block] = []
        while True:
            block = self._next_block(flush)
            if block is None:
                break
            new.append(block)
            self.blocks.append(block)
        return new

    def _msg_of(self, offset: int) -> int:
        index = -1
        for start, msg in self.msg_starts:
            if start <= offset:
                index = msg
            else:
                break
        return index

    def _unknown(self, length: int, why: str) -> Block:
        head = bytes(self.buffer[:16]).hex()
        return Block(
            "unknown",
            "----",
            self.base,
            0,
            length,
            note=f"{why}; starts {head}",
            msg_index=self._msg_of(self.base),
        )

    def _next_block(self, flush: bool) -> Block | None:
        buf = self.buffer
        if len(buf) < 4:
            return None
        magic = bytes(buf[:4])
        if not MAGIC_RE.fullmatch(magic):
            found = MAGIC_RE.search(buf, 1)
            if found is None:
                if len(buf) > RESYNC_WINDOW or flush:
                    skipped = len(buf) if flush else len(buf) - 3
                    block = self._unknown(skipped, "no block magic")
                    self._consume(skipped)
                    return block
                return None
            block = self._unknown(found.start(), "resync")
            self._consume(found.start())
            return block
        text = magic.decode()
        if text.startswith("100"):
            if len(buf) < INFO_HEADER:
                return None
            declared, width, height = struct.unpack("<III", buf[4:16])
            header_len = declared if 24 <= declared <= 64 else INFO_HEADER
            if len(buf) < header_len:
                return None
            block = Block(
                "info",
                text,
                self.base,
                header_len,
                0,
                note=f"header {declared} {width}x{height} "
                f"bytes16-{header_len}={bytes(buf[16:header_len]).hex()}",
                msg_index=self._msg_of(self.base),
            )
            self._consume(header_len)
            return block
        if text.endswith("dc"):
            header_len = KEYFRAME_HEADER if text[1] == "0" else FRAME_HEADER
            kind = "key" if text[1] == "0" else "frame"
            if len(buf) < header_len:
                return None
            codec = bytes(buf[4:8]).decode("ascii", "replace").strip("\x00")
            size = struct.unpack("<I", buf[8:12])[0]
            extra = struct.unpack("<I", buf[12:16])[0]
            micro = struct.unpack("<I", buf[16:20])[0]
            unix_time = struct.unpack("<I", buf[24:28])[0] if header_len == 32 else None
            note = f"u32@12={extra}" if extra not in (0, 8) else ""
            return self._take(
                kind,
                text,
                header_len,
                size,
                codec=codec,
                micro=micro,
                unix_time=unix_time,
                note=note,
                flush=flush,
            )
        if len(buf) < AUDIO_HEADER:
            return None
        size, again = struct.unpack("<HH", buf[4:8])
        note = "" if size == again else f"sizes {size}/{again}"
        return self._take("audio", text, AUDIO_HEADER, size, note=note, flush=flush)

    def _take(
        self,
        kind: str,
        magic: str,
        header_len: int,
        size: int,
        *,
        codec: str = "",
        micro: int | None = None,
        unix_time: int | None = None,
        note: str = "",
        flush: bool,
    ) -> Block | None:
        buf = self.buffer
        if size > MAX_BLOCK:
            block = self._unknown(4, f"implausible {kind} size {size}")
            self._consume(4)
            return block
        end = header_len + size
        if len(buf) < end:
            return None
        pad = 0
        if len(buf) >= end + 4 and not MAGIC_RE.fullmatch(bytes(buf[end : end + 4])):
            # Padding: the next magic may sit a few bytes past the declared size.
            found = MAGIC_RE.search(buf, end, min(len(buf), end + RESYNC_WINDOW + 4))
            if found is not None:
                pad = found.start() - end
            elif len(buf) < end + RESYNC_WINDOW + 4 and not flush:
                return None  # wait for more before deciding
            else:
                note = (
                    note + "; " if note else ""
                ) + "next magic not found within 64 B"
        elif len(buf) < end + 4 and not flush:
            return None  # the next header decides the padding
        if pad:
            note = (note + "; " if note else "") + f"pad {pad}"
        block = Block(
            kind,
            magic,
            self.base,
            header_len,
            size,
            codec,
            micro,
            unix_time,
            note,
            self._msg_of(self.base),
        )
        self._consume(end + pad)
        return block

    def _consume(self, n: int) -> None:
        del self.buffer[:n]
        self.base += n
        before = [(o, m) for o, m in self.msg_starts if o < self.base]
        self.msg_starts = before[-1:] + [
            (o, m) for o, m in self.msg_starts if o >= self.base
        ]

    def summary(self) -> str:
        """Totals for the stream."""
        counts = Counter(b.kind for b in self.blocks)
        codecs = sorted({b.codec for b in self.blocks if b.codec})
        times = [b.unix_time for b in self.blocks if b.unix_time]
        micros = [b.microseconds for b in self.blocks if b.microseconds is not None]
        parts = [
            f"{self.total} B",
            ", ".join(f"{k} {v}" for k, v in sorted(counts.items())),
        ]
        if codecs:
            parts.append("codec " + "/".join(codecs))
        if times:
            first = datetime.fromtimestamp(min(times), tz=UTC).strftime(
                "%Y-%m-%d %H:%M:%SZ"
            )
            last = datetime.fromtimestamp(max(times), tz=UTC).strftime("%H:%M:%SZ")
            parts.append(f"key-frame times {first} to {last}")
        if len(micros) > 1:
            parts.append(
                f"us {micros[0]} to {micros[-1]} ({(micros[-1] - micros[0]) / 1e6:.1f} s)"
            )
        return "; ".join(p for p in parts if p)

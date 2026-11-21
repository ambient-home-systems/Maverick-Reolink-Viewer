"""Talk through the Doorbell from live view (Phase 12c).

The panel sends the microphone as 16-bit mono PCM at the device's sample rate
over Home Assistant's websocket (a binary handler, ``websocket_api``). Here
it becomes IMA ADPCM blocks, each framed as the device's media frames it
(``01wb``) and sent as one talk message (202) over Home Assistant's own
Baichuan session to the device (``bridge``), at real time.

What the device takes was read in Phase 12a (its ``TalkAbility``: ADPCM,
16 kHz, 16 bit, mono, 1024 per encoder) and how it takes it from
nodelink-js (MIT): a ``TalkConfig`` (201) echoing that ability opens the
talk, 11 closes it, and each block is a standard IMA ADPCM block (its first
sample, the step index, then a code a sample, low nibble first: 1,025
samples, 64 ms at 16 kHz) behind a 4-byte header (``0x0100``, half the
encoder length). The device answers each block about 99 ms after it, so
blocks are not paced by its answers but by the clock, a little ahead.

A talk ends when the panel stops it, its websocket closes, no audio comes
for ``IDLE_S``, it lasts ``MAX_TALK_S``, or a block cannot be sent; what
was sent then plays out before the close. One talk at a time per device.
"""

import array
import asyncio
from collections.abc import Awaitable, Callable, Mapping, Sequence
import contextlib
from dataclasses import dataclass
import logging
import struct
import sys
import time
from typing import Any

from .const import CONF_TALK_EVERYONE, DEFAULT_TALK_EVERYONE

_LOGGER = logging.getLogger(__name__)

# Blocks go out this far ahead of when they play (two blocks at 16 kHz).
LEAD_S = 0.13
# No audio from the panel this long ends a talk (a tab gone quiet).
IDLE_S = 10.0
# A talk lasts at most this long.
MAX_TALK_S = 300.0
# Audio waiting to be sent beyond this is dropped, oldest first (latency).
MAX_BACKLOG_S = 1.0
# After the last block, the device plays what it has for this long more.
PLAY_OUT_S = 0.1
# The device's answers: to the open (201 took 0.5-0.6 s), to the close (1.4-8 s).
OPEN_TIMEOUT_S = 10.0
CLOSE_TIMEOUT_S = 10.0

# IMA ADPCM (the IMA's 1992 recommendation): the step sizes and index moves.
_STEPS = (
    7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31, 34, 37, 41, 45,
    50, 55, 60, 66, 73, 80, 88, 97, 107, 118, 130, 143, 157, 173, 190, 209, 230,
    253, 279, 307, 337, 371, 408, 449, 494, 544, 598, 658, 724, 796, 876, 963,
    1060, 1166, 1282, 1411, 1552, 1707, 1878, 2066, 2272, 2499, 2749, 3024, 3327,
    3660, 4026, 4428, 4871, 5358, 5894, 6484, 7132, 7845, 8630, 9493, 10442,
    11487, 12635, 13899, 15289, 16818, 18500, 20350, 22385, 24623, 27086, 29794,
    32767,
)  # fmt: skip
_INDEX_MOVES = (-1, -1, -1, -1, 2, 4, 6, 8)
_MAX_INDEX = len(_STEPS) - 1


class TalkError(Exception):
    """A talk could not start or go on: the message says why."""


def may_talk(options: Mapping[str, Any], user: Any) -> bool:
    """Return whether a Home Assistant user may talk through cameras.

    Administrators; every user once the option (``options``) says so.
    """
    if user is None:
        return False
    return bool(user.is_admin or options.get(CONF_TALK_EVERYONE, DEFAULT_TALK_EVERYONE))


def _clamp16(value: int) -> int:
    return -32768 if value < -32768 else min(value, 32767)


class AdpcmEncoder:
    """Encode 16-bit PCM as IMA ADPCM blocks of ``2 * code_bytes + 1`` samples.

    Each block starts from its first sample, with the step index the last
    block ended on (a block is decoded on its own: its header holds both).
    """

    def __init__(self, code_bytes: int) -> None:
        """Initialize for blocks of ``code_bytes`` bytes of codes."""
        self.code_bytes = code_bytes
        self.samples = 2 * code_bytes + 1
        self.index = 0

    def block(self, samples: Sequence[int]) -> bytes:
        """Return one block (4-byte header and codes) of exactly ``samples``."""
        if len(samples) != self.samples:
            raise ValueError(f"a block holds {self.samples} samples")
        predictor = _clamp16(int(samples[0]))
        index = self.index
        out = bytearray(4 + self.code_bytes)
        struct.pack_into("<hBB", out, 0, predictor, index, 0)
        low = 0
        for position in range(1, self.samples):
            step = _STEPS[index]
            diff = int(samples[position]) - predictor
            code = 0
            if diff < 0:
                code = 8
                diff = -diff
            moved = step >> 3
            if diff >= step:
                code |= 4
                diff -= step
                moved += step
            step >>= 1
            if diff >= step:
                code |= 2
                diff -= step
                moved += step
            step >>= 1
            if diff >= step:
                code |= 1
                moved += step
            predictor = _clamp16(predictor - moved if code & 8 else predictor + moved)
            index = min(max(index + _INDEX_MOVES[code & 7], 0), _MAX_INDEX)
            if position % 2:
                low = code
            else:
                out[4 + (position - 1) // 2] = low | code << 4
        self.index = index
        return bytes(out)


def adpcm_decode(block: bytes) -> list[int]:
    """Decode one IMA ADPCM block (what the device does; the tests check)."""
    predictor, index, _zero = struct.unpack_from("<hBB", block, 0)
    samples = [predictor]
    for byte in block[4:]:
        for code in (byte & 0x0F, byte >> 4):
            step = _STEPS[index]
            moved = step >> 3
            if code & 4:
                moved += step
            if code & 2:
                moved += step >> 1
            if code & 1:
                moved += step >> 2
            predictor = _clamp16(predictor - moved if code & 8 else predictor + moved)
            index = min(max(index + _INDEX_MOVES[code & 7], 0), _MAX_INDEX)
            samples.append(predictor)
    return samples


def talk_frame(block: bytes) -> bytes:
    """Frame an ADPCM block as the device's media does (``01wb``), padded to 8.

    The payload: ``0x0100``, half the encoder length (the block's code bytes),
    then the block; its size twice before it.
    """
    payload = struct.pack("<HH", 0x0100, len(block) - 4) + block
    head = b"01wb" + struct.pack("<HH", len(payload), len(payload))
    return head + payload + bytes(-len(payload) % 8)


@dataclass(frozen=True, slots=True)
class TalkAudio:
    """The audio a talk takes from the panel: 16-bit mono PCM at this rate."""

    sample_rate: int
    # ``lengthPerEncoder``: a block has half as many bytes of codes.
    length_per_encoder: int


class TalkSession:
    """One talk: the panel's PCM in, ADPCM blocks out at real time.

    ``open_`` starts the talk on the device and returns its audio, ``write``
    sends one framed block, ``close`` ends it there. Each listener added with
    ``on_end`` is called once, when the talk is over (closed or failed).
    """

    def __init__(
        self,
        name: str,
        *,
        open_: Callable[[], Awaitable[TalkAudio]],
        write: Callable[[bytes], Awaitable[None]],
        close: Callable[[], Awaitable[None]],
        clock: Callable[[], float] = time.monotonic,
        idle_s: float = IDLE_S,
        max_s: float = MAX_TALK_S,
    ) -> None:
        """Initialize (``async_start`` opens it)."""
        self.name = name
        self._open = open_
        self._write = write
        self._close = close
        self._listeners: list[Callable[[TalkSession], None]] = []
        self._clock = clock
        self._idle_s = idle_s
        self._max_s = max_s
        self._pcm = bytearray()
        self._audio = asyncio.Event()
        self._ending = False
        self._pump: asyncio.Task[None] | None = None
        self._done: asyncio.Task[None] | None = None
        self._opening = False
        self._encoder: AdpcmEncoder | None = None
        self.audio: TalkAudio | None = None
        self._play_end = 0.0
        self._started = 0.0
        self.stats: dict[str, Any] = {
            "open_ms": None,
            "blocks": 0,
            "seconds": 0.0,
            "gaps": 0,
            "dropped_s": 0.0,
            "ended": None,
            "error": None,
            "close": None,
        }

    def on_end(self, listener: Callable[[TalkSession], None]) -> None:
        """Call ``listener`` once the talk is over (at once if it is)."""
        if self._done is not None and self._done.done():
            listener(self)
        else:
            self._listeners.append(listener)

    @property
    def running(self) -> bool:
        """Return True from the open until the talk is over."""
        return self._opening or (self._done is not None and not self._done.done())

    async def async_start(self) -> TalkAudio:
        """Open the talk on the device and start sending; return its audio."""
        began = self._clock()
        self._opening = True
        try:
            audio = await self._open()
        finally:
            self._opening = False
        self.stats["open_ms"] = round((self._clock() - began) * 1000, 1)
        self.audio = audio
        self._encoder = AdpcmEncoder(audio.length_per_encoder // 2)
        self._started = self._play_end = self._clock()
        self._pump = asyncio.get_running_loop().create_task(
            self._run(), name=f"reolink_viewer talk {self.name}"
        )
        self._done = asyncio.get_running_loop().create_task(self._finish())
        return audio

    def feed(self, pcm: bytes) -> None:
        """Take PCM from the panel (16-bit little-endian, mono, the talk's rate)."""
        if self.audio is None or self._ending:
            return
        self._pcm += pcm
        limit = 2 * int(self.audio.sample_rate * MAX_BACKLOG_S)
        if (excess := len(self._pcm) - limit) > 0:
            # Behind: drop the oldest, keeping whole samples.
            excess += excess % 2
            del self._pcm[:excess]
            self.stats["dropped_s"] = round(
                self.stats["dropped_s"] + excess / 2 / self.audio.sample_rate, 3
            )
        self._audio.set()

    async def async_stop(self, reason: str = "stopped") -> dict[str, Any]:
        """End the talk: send what is left, let it play, close; return its numbers."""
        if self._pump is not None and self.stats["ended"] is None:
            self.stats["ended"] = reason
        self._ending = True
        self._audio.set()
        if self._done is not None:
            await asyncio.shield(self._done)
        return dict(self.stats)

    async def _run(self) -> None:
        if self.audio is None or self._encoder is None:  # pragma: no cover
            return
        size = 2 * self._encoder.samples
        try:
            while True:
                if self._clock() - self._started >= self._max_s and not self._ending:
                    self.stats["ended"] = "limit"
                    return
                if len(self._pcm) >= size:
                    chunk = bytes(self._pcm[:size])
                    del self._pcm[:size]
                    await self._send(chunk)
                    continue
                if self._ending:
                    if self._pcm:
                        # The last words, padded with silence to a block.
                        await self._send(
                            bytes(self._pcm) + bytes(size - len(self._pcm))
                        )
                        self._pcm.clear()
                    return
                self._audio.clear()
                try:
                    async with asyncio.timeout(self._idle_s):
                        await self._audio.wait()
                except TimeoutError:
                    self.stats["ended"] = "idle"
                    return
        except Exception as err:  # noqa: BLE001 - the talk ends, and says why
            _LOGGER.debug("Talk to %s failed: %s", self.name, err)
            self.stats["ended"] = "error"
            self.stats["error"] = f"{type(err).__name__}: {err}"[:200]

    async def _send(self, chunk: bytes) -> None:
        if self.audio is None or self._encoder is None:  # pragma: no cover
            return
        samples = array.array("h")
        samples.frombytes(chunk)
        if sys.byteorder == "big":  # pragma: no cover - the PCM is little-endian
            samples.byteswap()
        frame = talk_frame(self._encoder.block(samples))
        now = self._clock()
        if self._play_end < now:
            # The device has played all it had: a gap in what the panel sent.
            if self.stats["blocks"]:
                self.stats["gaps"] += 1
            self._play_end = now
        await self._write(frame)
        block_s = self._encoder.samples / self.audio.sample_rate
        self.stats["blocks"] += 1
        self.stats["seconds"] = round(self.stats["blocks"] * block_s, 2)
        self._play_end += block_s
        if (ahead := self._play_end - self._clock() - LEAD_S) > 0:
            await asyncio.sleep(ahead)

    async def _finish(self) -> None:
        """Wait for the sending to end, let it play out, close the talk."""
        if self._pump is not None:
            await asyncio.wait([self._pump])
        self._ending = True
        try:
            if (left := self._play_end - self._clock() + PLAY_OUT_S) > 0:
                await asyncio.sleep(min(left, MAX_BACKLOG_S + LEAD_S + PLAY_OUT_S))
            await self._close()
            self.stats["close"] = "ok"
        except Exception as err:  # noqa: BLE001 - it ends anyway; the reason is kept
            _LOGGER.debug("Closing the talk to %s: %s", self.name, err)
            self.stats["close"] = f"{type(err).__name__}: {err}"[:200]
        finally:
            self._ended()

    def _ended(self) -> None:
        listeners, self._listeners = self._listeners, []
        for listener in listeners:
            try:
                listener(self)
            except Exception:  # one listener's failure is not the others'
                _LOGGER.exception("A talk's end listener failed")


class Talks:
    """The running talks, one per device (``key``), and who started each."""

    def __init__(self) -> None:
        """Initialize with no talk."""
        self._sessions: dict[str, TalkSession] = {}
        self._owners: dict[str, object] = {}

    def get(self, key: str) -> TalkSession | None:
        """Return the device's running talk, if any."""
        session = self._sessions.get(key)
        return session if session is not None and session.running else None

    async def async_start(
        self, key: str, owner: object, session: TalkSession
    ) -> TalkAudio:
        """Start ``session`` as the device's talk; refuse while another runs."""
        if self.get(key) is not None:
            raise TalkError("someone is already talking through this camera")

        def ended(done: TalkSession) -> None:
            if self._sessions.get(key) is done:
                del self._sessions[key]
                self._owners.pop(key, None)

        session.on_end(ended)
        self._sessions[key] = session
        self._owners[key] = owner
        try:
            return await session.async_start()
        except BaseException:
            ended(session)
            raise

    def owner(self, key: str) -> object:
        """Return who started the device's running talk (its websocket)."""
        return self._owners.get(key) if self.get(key) is not None else None

    async def async_shutdown(self) -> None:
        """End every talk (the integration is unloading)."""
        sessions = list(self._sessions.values())
        for session in sessions:
            with contextlib.suppress(Exception):
                await session.async_stop("unloaded")

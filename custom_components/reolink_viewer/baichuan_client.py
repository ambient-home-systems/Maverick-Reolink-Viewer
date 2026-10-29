"""A minimal Baichuan client for the Phase 5a replay check (read-only).

Opens its own TCP connection to a device and replays a recording the way the
Reolink desktop client was seen to (docs/baichuan-playback.md §3.4): login, 123
``ReplaySeek``, 5 ``FileInfoList`` with ``playSpeed``, the frames, 7 stop. It
exists because reolink-aio drops the message class the NVR sends its replay
frames in, so the frames cannot be received through Home Assistant's session.

Ciphers and the login hashes come from reolink-aio (``reolink_aio.baichuan.util``).
Nothing here changes a setting; the only commands sent are 1, 123, 5, 7 and 2.
"""

import asyncio
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime
import re
import struct
import time
from xml.etree import ElementTree as ET

from Cryptodome.Cipher import AES
from reolink_aio.baichuan.util import (
    AES_IV,
    HEADER_MAGIC,
    decrypt_baichuan,
    encrypt_baichuan,
    md5_str_modern,
)

from .bridge import BaichuanEndpoint

MAGIC = bytes.fromhex(HEADER_MAGIC)
CLASS_REQUEST = bytes.fromhex("1464")
CLASS_LEGACY = bytes.fromhex("1465")
SHORT_CLASSES = (bytes.fromhex("1465"), bytes.fromhex("1466"))
CMD_LOGIN = 1
CMD_LOGOUT = 2
CMD_REPLAY_START = 5
CMD_REPLAY_STOP = 7
CMD_REPLAY_SEEK = 123
HOST_CHANNEL = 250
MAX_BODY = 4 * 1024 * 1024
_BLOCK = re.compile(rb"[0-9][01]dc|0[0-9]wb|100[0-9]")

LOGIN_XML = (
    '<?xml version="1.0" encoding="UTF-8" ?>\n<body>\n<LoginUser version="1.1">\n'
    "<userName>{user}</userName>\n<password>{password}</password>\n<userVer>1</userVer>\n"
    '</LoginUser>\n<LoginNet version="1.1">\n<type>LAN</type>\n<udpPort>0</udpPort>\n'
    "</LoginNet>\n</body>\n"
)
LOGOUT_XML = (
    '<?xml version="1.0" encoding="UTF-8" ?>\n<body>\n<LoginUser version="1.1">\n'
    "<userVer>1</userVer>\n</LoginUser>\n</body>\n"
)
SEEK_XML = (
    '<?xml version="1.0" encoding="UTF-8" ?>\n<body>\n<ReplaySeek version="1.1">\n'
    "<channelId>{channel}</channelId>\n<seq>{seq}</seq>\n<seekTime>\n"
    "<year>{t.year}</year>\n<month>{t.month}</month>\n<day>{t.day}</day>\n"
    "<hour>{t.hour}</hour>\n<minute>{t.minute}</minute>\n<second>{t.second}</second>\n"
    "</seekTime>\n</ReplaySeek>\n</body>\n"
)
START_XML = (
    '<?xml version="1.0" encoding="UTF-8" ?>\n<body>\n<FileInfoList version="1.1">\n'
    "<FileInfo>\n<channelId>{channel}</channelId>\n<Id>{file_id}</Id>\n<uid>{uid}</uid>\n"
    "<supportSub>1</supportSub>\n<playSpeed>{speed}</playSpeed>\n"
    "<streamType>{stream}</streamType>\n</FileInfo>\n</FileInfoList>\n</body>\n"
)
STOP_XML = (
    '<?xml version="1.0" encoding="UTF-8" ?>\n<body>\n<FileInfoList version="1.1">\n'
    "<FileInfo>\n<channelId>{channel}</channelId>\n<name>{name}</name>\n"
    "<streamType>{stream}</streamType>\n</FileInfo>\n</FileInfoList>\n</body>\n"
)


class BaichuanClientError(Exception):
    """A protocol or connection error."""


@dataclass(frozen=True, slots=True)
class Reply:
    """A device's answer to a request."""

    status: int
    xml: str
    binary: bytes
    at: float  # time.monotonic()


@dataclass(slots=True)
class ReplayStats:
    """What a replay delivered, as it arrives."""

    started: float
    first_chunk: float | None = None
    first_key_frame: float | None = None
    first_key_time: datetime | None = None
    chunks: int = 0
    total_bytes: int = 0
    key_frames: int = 0
    frames: int = 0
    audio: int = 0
    last_key_time: datetime | None = None
    _buffer: bytearray = field(default_factory=bytearray)

    def as_dict(self) -> dict[str, object]:
        """Redaction-safe numbers."""
        return {
            "first_chunk_ms": _since(self.started, self.first_chunk),
            "first_key_frame_ms": _since(self.started, self.first_key_frame),
            "first_key_frame_time": _iso(self.first_key_time),
            "last_key_frame_time": _iso(self.last_key_time),
            "chunks": self.chunks,
            "bytes": self.total_bytes,
            "key_frames": self.key_frames,
            "frames": self.frames,
            "audio_blocks": self.audio,
        }

    def feed(self, data: bytes, now: float) -> None:
        """Account a chunk and scan it for blocks (across chunk boundaries)."""
        self.chunks += 1
        self.total_bytes += len(data)
        if self.first_chunk is None:
            self.first_chunk = now
        self._buffer += data
        while self._next_block(now):
            pass

    def _next_block(self, now: float) -> bool:
        buf = self._buffer
        if len(buf) < 8:
            return False
        magic = bytes(buf[:4])
        if not _BLOCK.fullmatch(magic):
            found = _BLOCK.search(buf, 1)
            if found is None:
                del buf[:-3]
                return False
            del buf[: found.start()]
            return True
        if magic.startswith(b"100"):
            header = struct.unpack("<I", buf[4:8])[0]
            header = header if 24 <= header <= 64 else 32
            if len(buf) < header:
                return False
            del buf[:header]
            return True
        if magic.endswith(b"dc"):
            key = magic[1:2] == b"0"
            header = 24 + (struct.unpack("<I", buf[12:16])[0] if len(buf) >= 16 else 0)
            if len(buf) < header:
                return False
            size = struct.unpack("<I", buf[8:12])[0]
            if size > MAX_BODY:
                del buf[:4]
                return True
            if len(buf) < header + size:
                return False
            if key:
                self.key_frames += 1
                when = struct.unpack("<I", buf[24:28])[0]
                stamp = datetime.fromtimestamp(when) if 0 < when < 2**31 else None
                self.last_key_time = stamp
                if self.first_key_frame is None:
                    self.first_key_frame = now
                    self.first_key_time = stamp
            else:
                self.frames += 1
            del buf[: header + size]
            self._skip_padding()
            return True
        size = struct.unpack("<H", buf[4:6])[0]
        if len(buf) < 8 + size:
            return False
        self.audio += 1
        del buf[: 8 + size]
        self._skip_padding()
        return True

    def _skip_padding(self) -> None:
        buf = self._buffer
        if len(buf) >= 4 and not _BLOCK.fullmatch(bytes(buf[:4])):
            found = _BLOCK.search(buf, 0, min(len(buf), 68))
            if found is not None:
                del buf[: found.start()]


def _since(start: float, mark: float | None) -> float | None:
    return None if mark is None else round((mark - start) * 1000, 1)


def _iso(value: datetime | None) -> str | None:
    return None if value is None else value.isoformat(timespec="seconds")


class BaichuanReplayClient:
    """One connection, one login, one replay at a time."""

    def __init__(self, endpoint: BaichuanEndpoint, *, timeout: float = 10.0) -> None:
        """Initialize (nothing is opened yet)."""
        self._endpoint = endpoint
        self._timeout = timeout
        self._reader: asyncio.StreamReader | None = None
        self._writer: asyncio.StreamWriter | None = None
        self._task: asyncio.Task[None] | None = None
        self._pending: dict[tuple[int, int], asyncio.Future[Reply]] = {}
        self._key: bytes | None = None
        self._counter = 0
        self._replay: tuple[int, int] | None = None  # (cmd, channel byte) of the stream
        self._stats: ReplayStats | None = None
        self._on_chunk: Callable[[ReplayStats], None] | None = None
        self.device_type: str | None = None

    # ---- connection ----

    async def connect(self) -> None:
        """Open the TCP connection and start reading."""
        async with asyncio.timeout(self._timeout):
            self._reader, self._writer = await asyncio.open_connection(
                self._endpoint.host, self._endpoint.port
            )
        self._task = asyncio.get_running_loop().create_task(self._read_loop())

    async def close(self) -> None:
        """Close the connection (without a logout)."""
        if self._task is not None:
            self._task.cancel()
            self._task = None
        if self._writer is not None:
            self._writer.close()
            self._writer = None
        for future in self._pending.values():
            if not future.done():
                future.set_exception(BaichuanClientError("connection closed"))
        self._pending.clear()

    async def login(self) -> dict[str, float]:
        """Log in: the nonce, then the hashed user name and password."""
        began = time.monotonic()
        nonce_reply = await self._request(
            CMD_LOGIN, b"", header_class=CLASS_LEGACY, cipher="bc"
        )
        root = _xml(nonce_reply.xml)
        nonce = root.findtext(".//nonce") if root is not None else None
        if not nonce:
            raise BaichuanClientError("no nonce in the login challenge")
        self._key = md5_str_modern(f"{nonce}-{self._endpoint.password}")[0:16].encode()
        xml = LOGIN_XML.format(
            user=md5_str_modern(f"{self._endpoint.username}{nonce}"),
            password=md5_str_modern(f"{self._endpoint.password}{nonce}"),
        )
        nonce_at = time.monotonic()
        reply = await self._request(CMD_LOGIN, xml.encode(), cipher="bc")
        if reply.status != 200:
            raise BaichuanClientError(f"login refused with status {reply.status}")
        info = _xml(reply.xml)
        if info is not None:
            self.device_type = info.findtext(".//DeviceInfo/type")
        return {
            "nonce_ms": _ms(began, nonce_at),
            "login_ms": _ms(nonce_at, reply.at),
        }

    async def logout(self) -> None:
        """Log out and close."""
        try:
            if self._key is not None:
                await self._request(CMD_LOGOUT, LOGOUT_XML.encode())
        finally:
            await self.close()

    # ---- replay ----

    async def seek(self, channel: int, when: datetime) -> float:
        """123 ReplaySeek; returns the acknowledgement latency in ms."""
        xml = SEEK_XML.format(channel=channel, seq=int(time.time()), t=when)
        began = time.monotonic()
        reply = await self._request(CMD_REPLAY_SEEK, xml.encode(), channel=channel)
        if reply.status != 200:
            raise BaichuanClientError(f"seek refused with status {reply.status}")
        return _ms(began, reply.at)

    async def start(
        self,
        channel: int,
        file_id: str,
        uid: str,
        stream: str,
        *,
        speed: int = 1,
        on_chunk: Callable[[ReplayStats], None] | None = None,
    ) -> tuple[float, ReplayStats]:
        """5 FileInfoList: start the replay; frames then arrive on the stream."""
        xml = START_XML.format(
            channel=channel, file_id=file_id, uid=uid, speed=speed, stream=stream
        )
        self._stats = ReplayStats(started=time.monotonic())
        self._on_chunk = on_chunk
        self._replay = (CMD_REPLAY_START, channel + 1)
        reply = await self._request(CMD_REPLAY_START, xml.encode(), channel=channel)
        if reply.status != 200:
            self._replay = None
            raise BaichuanClientError(
                f"replay start refused with status {reply.status}"
            )
        # The reply's own binary (the stream header) was fed by the reader, in
        # order with the chunks that may already have followed it.
        return _ms(self._stats.started, reply.at), self._stats

    async def stop(self, channel: int, name: str, stream: str) -> float:
        """7 stop; returns the acknowledgement latency in ms."""
        xml = STOP_XML.format(channel=channel, name=name, stream=stream)
        began = time.monotonic()
        try:
            reply = await self._request(CMD_REPLAY_STOP, xml.encode(), channel=channel)
        finally:
            self._replay = None
        if reply.status != 200:
            raise BaichuanClientError(f"replay stop refused with status {reply.status}")
        return _ms(began, reply.at)

    @property
    def stats(self) -> ReplayStats | None:
        """The running replay's statistics."""
        return self._stats

    # ---- framing ----

    async def _request(
        self,
        cmd: int,
        body: bytes,
        *,
        channel: int | None = None,
        header_class: bytes = CLASS_REQUEST,
        cipher: str = "aes",
    ) -> Reply:
        if self._writer is None:
            raise BaichuanClientError("not connected")
        ch_byte = HOST_CHANNEL if channel is None else channel + 1
        self._counter = (self._counter + 1) % 0xFFFFFF
        ident = ch_byte | (self._counter << 8)
        extension = b""
        if channel is not None:
            extension = (
                '<?xml version="1.0" encoding="UTF-8" ?>\n<Extension version="1.1">\n'
                f"<channelId>{channel}</channelId>\n</Extension>\n"
            ).encode()
        parts = [self._encrypt(p, cipher, ch_byte) for p in (extension, body) if p]
        payload = b"".join(parts)
        if header_class == CLASS_LEGACY:
            header = (
                MAGIC
                + struct.pack("<II", cmd, len(payload))
                + struct.pack("<I", ident)
                + bytes.fromhex("12dc")
                + header_class
            )
        else:
            offset = len(parts[0]) if extension else 0
            header = (
                MAGIC
                + struct.pack("<II", cmd, len(payload))
                + struct.pack("<I", ident)
                + bytes(2)
                + header_class
                + struct.pack("<I", offset)
            )
        future: asyncio.Future[Reply] = asyncio.get_running_loop().create_future()
        self._pending[(cmd, ident)] = future
        try:
            self._writer.write(header + payload)
            await self._writer.drain()
            async with asyncio.timeout(self._timeout):
                return await future
        finally:
            self._pending.pop((cmd, ident), None)

    def _encrypt(self, data: bytes, cipher: str, offset: int) -> bytes:
        if cipher == "bc":
            return encrypt_baichuan(data, offset)
        if self._key is None:
            raise BaichuanClientError("not logged in")
        return AES.new(
            key=self._key, mode=AES.MODE_CFB, iv=AES_IV, segment_size=128
        ).encrypt(data)

    def _decrypt(self, data: bytes, offset: int) -> str:
        if not data:
            return ""
        if self._key is not None:
            plain = AES.new(
                key=self._key, mode=AES.MODE_CFB, iv=AES_IV, segment_size=128
            ).decrypt(data)
            if plain.lstrip().startswith(b"<"):
                return plain.decode("utf8", "replace")
        try:
            text = decrypt_baichuan(data, offset)
        except UnicodeDecodeError:
            return ""
        return text if text.lstrip().startswith("<") else ""

    async def _read_loop(self) -> None:
        reader = self._reader
        assert reader is not None
        try:
            while True:
                head = await reader.readexactly(20)
                if head[:4] != MAGIC:
                    raise BaichuanClientError("lost the message boundary")
                cmd, length = struct.unpack("<II", head[4:12])
                ident = struct.unpack("<I", head[12:16])[0]
                status = struct.unpack("<H", head[16:18])[0]
                offset = 0
                if head[18:20] not in SHORT_CLASSES:
                    offset = struct.unpack("<I", await reader.readexactly(4))[0]
                if length > 64 * 1024 * 1024:
                    raise BaichuanClientError("implausible message length")
                body = await reader.readexactly(length) if length else b""
                self._dispatch(cmd, ident, status, offset, body)
        except (
            asyncio.IncompleteReadError,
            ConnectionError,
            BaichuanClientError,
        ) as err:
            for future in self._pending.values():
                if not future.done():
                    future.set_exception(BaichuanClientError(f"connection lost: {err}"))
            self._pending.clear()

    def _dispatch(
        self, cmd: int, ident: int, status: int, offset: int, body: bytes
    ) -> None:
        now = time.monotonic()
        ch_byte = ident & 0xFF
        cut = offset if 0 < offset <= len(body) else len(body)
        head, tail = body[:cut], body[cut:]
        xml = self._decrypt(head, ch_byte)
        future = self._pending.get((cmd, ident))
        if future is not None and not future.done():
            binary = tail if xml and "<binaryData>" in xml else b""
            if binary:
                binary = self._decrypt_media(xml, binary)
                if (cmd, ch_byte) == self._replay and self._stats is not None:
                    self._stats.feed(binary, now)
            future.set_result(Reply(status, xml, binary, now))
            return
        if self._replay is not None and (cmd, ch_byte) == self._replay and self._stats:
            media = tail if xml else body
            self._stats.feed(self._decrypt_media(xml, media), now)
            if self._on_chunk is not None:
                self._on_chunk(self._stats)

    def _decrypt_media(self, xml: str, media: bytes) -> bytes:
        """Apply the extension's encryptLen: that many leading bytes are AES."""
        root = _xml(xml)
        length = root.findtext(".//encryptLen") if root is not None else None
        if not length or not length.isdigit() or self._key is None:
            return media
        n = min(int(length), len(media))
        plain = AES.new(
            key=self._key, mode=AES.MODE_CFB, iv=AES_IV, segment_size=128
        ).decrypt(media[:n])
        return plain + media[n:]


def _xml(text: str) -> ET.Element | None:
    try:
        return ET.fromstring(text.strip())  # noqa: S314 - our own device's answer
    except ET.ParseError:
        return None


def _ms(start: float, end: float) -> float:
    return round((end - start) * 1000, 1)


def stop_name(channel: int, start: datetime) -> str:
    """Name a file as the client does in a stop: channel + 1, then the local start."""
    return f"{channel + 1:02d}{start:%Y%m%d%H%M%S}"

"""The Phase 5a Baichuan replay client against a fake NVR."""

import asyncio
from collections.abc import AsyncGenerator
import contextlib
from datetime import datetime
import struct

from Cryptodome.Cipher import AES
import pytest
from reolink_aio.baichuan.util import (
    AES_IV,
    HEADER_MAGIC,
    decrypt_baichuan,
    encrypt_baichuan,
    md5_str_modern,
)

from custom_components.reolink_viewer import baichuan_client
from custom_components.reolink_viewer.baichuan_client import (
    BaichuanClientError,
    BaichuanReplayClient,
    ReplayStats,
    stop_name,
)
from custom_components.reolink_viewer.bridge import BaichuanEndpoint

MAGIC = bytes.fromhex(HEADER_MAGIC)
USER, PASSWORD, NONCE = "viewer", "Tr0ub4dor&3", "A1B2C3D4E5F60718"
KEY = md5_str_modern(f"{NONCE}-{PASSWORD}")[0:16].encode()
UNIX = 1761556051  # 2026-10-27 09:47:31 UTC


def aes(data: bytes | str) -> bytes:
    raw = data.encode() if isinstance(data, str) else data
    return AES.new(key=KEY, mode=AES.MODE_CFB, iv=AES_IV, segment_size=128).encrypt(raw)


def aes_decrypt(data: bytes) -> bytes:
    return AES.new(key=KEY, mode=AES.MODE_CFB, iv=AES_IV, segment_size=128).decrypt(
        data
    )


def media(frames: int = 3) -> bytes:
    """One key frame with a POSIX time, a few frames and an audio block."""
    key = (
        b"00dc"
        + b"H264"
        + struct.pack("<IIII", 700, 8, 5000, 0)
        + struct.pack("<II", UNIX, 0)
        + bytes(700)
    )
    frame = b"01dc" + b"H264" + struct.pack("<IIII", 300, 0, 45000, 0) + bytes(300)
    audio = b"05wb" + struct.pack("<HH", 44, 44) + bytes(44) + bytes(4)
    return key + frame * frames + audio


class FakeNvr:
    """Answers the login, seek, start, stop and logout the way the RLN36 did."""

    def __init__(
        self,
        *,
        chunks: int = 3,
        refuse_login: bool = False,
        refuse_start: bool = False,
        drop_on_seek: bool = False,
        accept_bitmap: int | None = None,
        end_status: int | None = 300,
    ) -> None:
        self.chunks = chunks
        self.refuse_login = refuse_login
        self.refuse_start = refuse_start
        self.drop_on_seek = drop_on_seek
        # A download is accepted only with this logicChnBitmap (None: any).
        self.accept_bitmap = accept_bitmap
        # How a download ends: a 143 with this status, or an empty 143 (None).
        self.end_status = end_status
        self.ended: list[int] = []
        self.requests: list[tuple[int, str]] = []
        self.writers: list[asyncio.StreamWriter] = []
        self.tasks: list[asyncio.Task[None]] = []
        self.stopped = asyncio.Event()
        self.server: asyncio.AbstractServer | None = None
        self.port = 0
        self._key: bytes | None = None

    async def start(self) -> None:
        self.server = await asyncio.start_server(self._serve, "127.0.0.1", 0)
        self.port = self.server.sockets[0].getsockname()[1]

    async def close(self) -> None:
        assert self.server is not None
        self.server.close()
        for task in self.tasks:
            task.cancel()
        for task in self.tasks:
            with contextlib.suppress(asyncio.CancelledError):
                await task
        for writer in self.writers:
            writer.close()
        try:
            async with asyncio.timeout(2):
                await self.server.wait_closed()
        except TimeoutError:
            pass

    def _decrypt(self, data: bytes, offset: int) -> str:
        if self._key is not None:
            plain = aes_decrypt(data)
            if plain.startswith(b"<"):
                return plain.decode()
        return decrypt_baichuan(data, offset)

    async def _serve(
        self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter
    ) -> None:
        self.writers.append(writer)
        try:
            while True:
                head = await reader.readexactly(20)
                assert head[:4] == MAGIC
                cmd, length = struct.unpack("<II", head[4:12])
                ident = struct.unpack("<I", head[12:16])[0]
                offset = 0
                if head[18:20] != bytes.fromhex("1465"):
                    offset = struct.unpack("<I", await reader.readexactly(4))[0]
                body = await reader.readexactly(length) if length else b""
                cut = offset if 0 < offset <= len(body) else len(body)
                xml = self._decrypt(body[:cut], ident & 0xFF) if body else ""
                if cut < len(body):
                    xml += self._decrypt(body[cut:], ident & 0xFF)
                self.requests.append((cmd, xml))
                await self._answer(writer, cmd, ident, head[18:20], xml)
        except asyncio.IncompleteReadError, ConnectionError, AssertionError:
            pass
        finally:
            writer.close()

    async def _answer(
        self, writer: asyncio.StreamWriter, cmd: int, ident: int, cls: bytes, xml: str
    ) -> None:
        offset = ident & 0xFF
        if cmd == 1 and cls == bytes.fromhex("1465"):
            body = encrypt_baichuan(
                f'<?xml version="1.0"?><body><Encryption><type>md5</type><nonce>{NONCE}</nonce></Encryption></body>',
                offset,
            )
            writer.write(
                MAGIC
                + struct.pack("<II", 1, len(body))
                + struct.pack("<I", ident)
                + bytes.fromhex("12dd1466")
                + body
            )
        elif cmd == 1:
            good = (
                md5_str_modern(f"{USER}{NONCE}") in xml
                and md5_str_modern(f"{PASSWORD}{NONCE}") in xml
            )
            if self.refuse_login or not good:
                writer.write(self._reply(1, ident, 401))
            else:
                self._key = KEY
                body = encrypt_baichuan(
                    '<?xml version="1.0"?><body><DeviceInfo><type>nvr</type></DeviceInfo></body>',
                    offset,
                )
                writer.write(self._reply(1, ident, 200, body))
        elif cmd == 123:
            if self.drop_on_seek:
                writer.close()
                return
            writer.write(self._reply(123, ident, 200))
        elif cmd == 5:
            if self.refuse_start:
                writer.write(self._reply(5, ident, 400))
            else:
                ext = aes(
                    '<?xml version="1.0"?><Extension><binaryData>1</binaryData></Extension>'
                )
                info = b"1001" + struct.pack("<III", 32, 640, 360) + bytes(16)
                writer.write(self._reply(5, ident, 200, ext + info, offset=len(ext)))
                self.tasks.append(
                    asyncio.get_running_loop().create_task(self._stream(writer, ident))
                )
        elif cmd == 7:
            self.stopped.set()
            writer.write(self._reply(7, ident, 200))
        elif cmd == 143:
            bitmap = xml.split("<logicChnBitmap>")[1].split("<", maxsplit=1)[0]
            if self.accept_bitmap is not None and int(bitmap) != self.accept_bitmap:
                writer.write(self._reply(143, ident, 400))
            else:
                ext = aes(
                    '<?xml version="1.0"?><Extension><binaryData>1</binaryData></Extension>'
                )
                body = aes(
                    '<?xml version="1.0"?><body><FileInfoList><FileInfo>'
                    "<sizeL>4210000</sizeL><sizeH>0</sizeH><FileCount>1</FileCount>"
                    "</FileInfo></FileInfoList></body>"
                )
                writer.write(self._reply(143, ident, 200, ext + body, offset=len(ext)))
                self.tasks.append(
                    asyncio.get_running_loop().create_task(
                        self._stream(writer, ident, cmd=143, end=True)
                    )
                )
        elif cmd == 144:
            self.ended.append(ident & 0xFF)
            writer.write(self._reply(144, ident, 200))
        elif cmd == 2:
            writer.write(self._reply(2, ident, 200))
        await writer.drain()

    def _reply(
        self, cmd: int, ident: int, status: int, body: bytes = b"", *, offset: int = 0
    ) -> bytes:
        return (
            MAGIC
            + struct.pack("<II", cmd, len(body))
            + struct.pack("<I", ident)
            + struct.pack("<H", status)
            + bytes.fromhex("0000")
            + struct.pack("<I", offset)
            + body
        )

    async def _stream(
        self,
        writer: asyncio.StreamWriter,
        ident: int,
        *,
        cmd: int = 5,
        end: bool = False,
    ) -> None:
        """Replay chunks in the NVR's own class, the first 1024 media bytes AES."""
        data = media(frames=8) * self.chunks
        cut = len(data) // self.chunks + 7  # chunk boundaries fall inside blocks
        for i in range(self.chunks):
            if self.stopped.is_set() and not end:
                return
            piece = data[i * cut : (i + 1) * cut]
            if not piece:
                break
            ext = aes(
                '<?xml version="1.0"?><Extension><binaryData>1</binaryData><encryptLen>1024</encryptLen></Extension>'
            )
            piece = aes(piece[:1024]) + piece[1024:]
            body = ext + piece
            writer.write(
                MAGIC
                + struct.pack("<II", cmd, len(body))
                + struct.pack("<I", ident)
                + struct.pack("<H", 42587)
                + bytes.fromhex("e26a")
                + struct.pack("<I", len(ext))
                + body
            )
            await writer.drain()
            await asyncio.sleep(0.05)
        if end:
            if self.end_status is None:
                writer.write(self._reply(cmd, ident, 200))  # an empty 143
            else:
                writer.write(self._reply(cmd, ident, self.end_status))
            await writer.drain()


@pytest.fixture
async def nvr(socket_enabled: None) -> AsyncGenerator[FakeNvr]:
    server = FakeNvr()
    await server.start()
    yield server
    await server.close()


def endpoint(server: FakeNvr, password: str = PASSWORD) -> BaichuanEndpoint:
    return BaichuanEndpoint("127.0.0.1", server.port, USER, password)


async def test_replay_end_to_end(nvr: FakeNvr) -> None:
    client = BaichuanReplayClient(endpoint(nvr), timeout=5)
    await client.connect()
    login = await client.login()
    assert login["nonce_ms"] >= 0
    assert client.device_type == "nvr"
    when = datetime(2026, 10, 27, 5, 47, 33)
    assert await client.seek(0, when) >= 0
    seen: list[int] = []
    start_ms, stats = await client.start(
        18,
        "1-18-0-01260927090001-00000",
        "UID123",
        "subStream",
        on_chunk=lambda s: seen.append(s.chunks),
    )
    assert start_ms >= 0
    for _ in range(50):
        if stats.key_frames >= 3:
            break
        await asyncio.sleep(0.05)
    assert stats.first_chunk is not None
    assert stats.first_key_frame is not None
    assert stats.first_key_time == datetime.fromtimestamp(UNIX)
    assert stats.key_frames == 3
    assert stats.frames == 24
    assert stats.audio == 3
    assert stats.total_bytes > 3 * 3000
    assert seen  # the callback saw the chunks
    summary = stats.as_dict()
    assert summary["key_frames"] == 3
    assert summary["first_key_frame_ms"] is not None
    assert (
        await client.stop(
            18, stop_name(18, datetime(2026, 10, 27, 5, 0, 1)), "subStream"
        )
        >= 0
    )
    assert nvr.stopped.is_set()
    await client.logout()
    cmds = [c for c, _x in nvr.requests]
    assert cmds == [1, 1, 123, 5, 7, 2]
    seek_xml = nvr.requests[2][1]
    assert "<seekTime>" in seek_xml
    assert "<minute>47</minute>" in seek_xml
    start_xml = nvr.requests[3][1]
    assert "<playSpeed>1</playSpeed>" in start_xml
    assert "<Id>1-18-0-01260927090001-00000</Id>" in start_xml
    assert "<name>1920261027050001</name>" in nvr.requests[4][1]


async def test_wrong_password(nvr: FakeNvr) -> None:
    client = BaichuanReplayClient(endpoint(nvr, "wrong"), timeout=5)
    await client.connect()
    with pytest.raises(BaichuanClientError, match="401"):
        await client.login()
    await client.close()


async def test_refused_start_and_lost_connection(socket_enabled: None) -> None:
    server = FakeNvr(refuse_start=True, drop_on_seek=True)
    await server.start()
    try:
        client = BaichuanReplayClient(endpoint(server), timeout=5)
        await client.connect()
        await client.login()
        with pytest.raises(BaichuanClientError, match="400"):
            await client.start(18, "id", "uid", "subStream")
        with pytest.raises(BaichuanClientError, match="connection lost"):
            await client.seek(0, datetime(2026, 10, 27, 5, 47, 33))
        await client.close()
    finally:
        await server.close()


async def test_not_connected(socket_enabled: None) -> None:
    client = BaichuanReplayClient(BaichuanEndpoint("127.0.0.1", 1, USER, PASSWORD))
    with pytest.raises(BaichuanClientError, match="not connected"):
        await client.seek(0, datetime(2026, 10, 27, 5, 47, 33))
    with pytest.raises(ConnectionError):
        await client.connect()
    await client.close()
    assert repr(client._endpoint) == "BaichuanEndpoint(port=1)"


def test_replay_stats_scanner_resyncs() -> None:
    stats = ReplayStats(started=0.0)
    stats.feed(b"junk!!!!" + media(frames=1)[:40], 1.0)
    stats.feed(media(frames=1)[40:] + b"\x00" * 3, 2.0)
    assert stats.key_frames == 1
    assert stats.frames == 1
    assert stats.audio == 1
    assert stats.first_chunk == 1.0
    assert stats.as_dict()["chunks"] == 2
    # An implausible frame size is skipped rather than waited for.
    bad = b"01dc" + b"H264" + struct.pack("<IIII", 2**31, 0, 0, 0)
    stats.feed(bad + media(frames=1), 3.0)
    assert stats.key_frames == 2
    assert stats.audio == 2
    summary = stats.as_dict()
    # The junk, and the rest of the bad header; the zero bytes were padding.
    assert summary["resyncs"] == 2
    assert summary["mbit_s"] is not None
    assert summary["end_status"] is None
    stats.end(300, 4.0)
    assert stats.as_dict()["ended_ms"] == 4000.0
    stats.feed(media(frames=1), 5.0)
    assert stats.as_dict()["chunks_after_end"] == 1
    assert stats.end_status == 300


def test_stop_name() -> None:
    assert stop_name(18, datetime(2026, 10, 27, 5, 0, 1)) == "1920261027050001"
    assert baichuan_client._since(1.0, None) is None


def test_scanner_waits_for_more_and_skips_short_info() -> None:
    stats = ReplayStats(started=0.0)
    # No magic anywhere: all but the last three bytes are dropped.
    stats.feed(b"\x00" * 40, 1.0)
    assert stats._reader.pending == 3
    # A stream header with an implausible declared size uses the 32-byte default.
    info = b"1002" + struct.pack("<III", 9999, 640, 360) + bytes(16)
    stats.feed(info, 2.0)
    assert stats._reader.pending == 0
    assert stats.analysis.info[0]["declared"] == 9999
    # A frame header that announces more than the buffer holds waits.
    frame = b"01dc" + b"H264" + struct.pack("<IIII", 300, 0, 1, 0) + bytes(10)
    stats.feed(frame, 3.0)
    assert stats.frames == 0
    stats.feed(bytes(290) + media(frames=1)[:8], 4.0)
    assert stats.frames == 1
    assert stats.media_seconds() is None


def test_decrypt_fallbacks_and_helpers() -> None:
    client = BaichuanReplayClient(BaichuanEndpoint("127.0.0.1", 1, USER, PASSWORD))
    assert client._decrypt(b"", 1) == ""
    assert client._decrypt(b"\xff\xfe\xfd\xfc", 1) == ""  # neither cipher gives XML
    client._key = KEY
    assert client._decrypt(aes("<body/>"), 1) == "<body/>"
    assert client._decrypt(encrypt_baichuan("<?xml?><b/>", 7), 7) == "<?xml?><b/>"
    # Media that happens to decrypt to a "<" is not mistaken for XML.
    assert client._decrypt(aes(b"<junk"), 1) == ""
    # encryptLen beyond the media's length decrypts what there is.
    plain = client._decrypt_media(
        "<Extension><encryptLen>4096</encryptLen></Extension>", aes(b"x" * 10)
    )
    assert plain == b"x" * 10
    assert client._decrypt_media("not xml <", b"raw") == b"raw"
    assert baichuan_client._xml("<<") is None
    assert client.stats is None
    assert client.open_streams == 0
    assert baichuan_client.Reply(200, "<<", b"", 0.0).fields() == {}


async def test_logout_before_login_and_close_fails_pending(
    socket_enabled: None,
) -> None:
    server = FakeNvr()
    await server.start()
    try:
        client = BaichuanReplayClient(endpoint(server), timeout=5)
        await client.connect()
        await client.logout()  # no key yet: closes without a logout command
        assert server.requests == []
        client = BaichuanReplayClient(endpoint(server), timeout=5)
        await client.connect()
        await client.login()
        pending = asyncio.get_running_loop().create_future()
        client._pending[(99, 1)] = pending
        await client.close()
        with pytest.raises(BaichuanClientError, match="connection closed"):
            await pending
    finally:
        await server.close()


async def test_download_by_time_range(nvr: FakeNvr) -> None:
    client = BaichuanReplayClient(endpoint(nvr), timeout=5)
    await client.connect()
    await client.login()
    start = datetime(2026, 10, 27, 5, 47, 33)
    end = datetime(2026, 10, 27, 5, 47, 53)
    reply_ms, stats, fields = await client.download(18, "subStream", start, end)
    assert reply_ms >= 0
    assert fields == {
        "binaryData": "1",
        "sizeL": "4210000",
        "sizeH": "0",
        "FileCount": "1",
    }
    assert client.open_streams == 1
    for _ in range(50):
        if stats.end_status is not None:
            break
        await asyncio.sleep(0.05)
    assert stats.end_status == 300
    assert stats.key_frames == 3
    assert stats.frames == 24
    assert stats.audio == 3
    assert stats.first_key_time == datetime.fromtimestamp(UNIX)
    assert stats.media_seconds() == 0.0
    summary = stats.as_dict()
    assert summary["ended_ms"] is not None
    assert summary["chunks_after_end"] == 0
    media_part = summary["media"]
    assert isinstance(media_part, dict)
    assert media_part["video"]["codec_labels"] == {"H264": 27}
    end_ms, status = await client.download_end(18)
    assert end_ms >= 0
    assert status == 200
    assert client.open_streams == 0
    assert nvr.ended == [19]
    request = next(xml for cmd, xml in nvr.requests if cmd == 143)
    assert "<logicChnBitmap>262144</logicChnBitmap>" in request
    assert "<supportSub>1</supportSub>" in request
    assert "<channelId>18</channelId>" in request
    assert "<startTime>" in request
    assert "<second>53</second>" in request
    await client.logout()


async def test_download_bitmap_refused_then_accepted(socket_enabled: None) -> None:
    server = FakeNvr(accept_bitmap=255, end_status=None)
    await server.start()
    try:
        client = BaichuanReplayClient(endpoint(server), timeout=5)
        await client.connect()
        await client.login()
        start = datetime(2026, 10, 27, 5, 47, 33)
        with pytest.raises(BaichuanClientError, match="400"):
            await client.download(3, "mainStream", start, start)
        assert client.open_streams == 0
        _ms, stats, _fields = await client.download(
            3, "mainStream", start, start, bitmap=255, support_sub=0
        )
        assert "<supportSub>0</supportSub>" in server.requests[-1][1]
        for _ in range(50):
            if stats.end_status is not None:
                break
            await asyncio.sleep(0.05)
        # An empty 143 ends the stream too.
        assert stats.end_status == 200
        await client.download_end(3)
        await client.logout()
    finally:
        await server.close()


async def test_two_replays_on_one_connection(nvr: FakeNvr) -> None:
    client = BaichuanReplayClient(endpoint(nvr), timeout=5)
    await client.connect()
    await client.login()
    when = datetime(2026, 10, 27, 5, 47, 33)
    await client.seek(0, when)
    _ms_a, a = await client.start(18, "id-a", "UID", "subStream")
    await client.seek(0, when)
    _ms_b, b = await client.start(3, "id-b", "UID", "mainStream")
    assert client.open_streams == 2
    assert client.stats is b
    for _ in range(50):
        if a.key_frames >= 3 and b.key_frames >= 3:
            break
        await asyncio.sleep(0.05)
    assert (a.key_frames, b.key_frames) == (3, 3)
    assert a is not b
    await client.stop(18, stop_name(18, when), "subStream")
    assert client.open_streams == 1
    await client.stop(3, stop_name(3, when), "mainStream")
    assert client.open_streams == 0
    await client.logout()

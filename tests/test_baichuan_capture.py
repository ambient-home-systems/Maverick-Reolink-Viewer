"""The Baichuan capture tool (scripts/baichuan) on synthetic captures.

The client side of each capture is produced by reolink-aio's own encoder: a
``Baichuan`` object logs in and sends commands through a fake connection that
records the bytes it writes and answers with device messages encrypted with the
same library's ciphers. The bytes are then cut into TCP segments (out of order,
split mid-header, retransmitted, two messages in one segment) and written as a
pcapng and a pcap, which the tool reads back.
"""

from __future__ import annotations

import json
from pathlib import Path
import struct
from typing import Any
from unittest.mock import MagicMock

import pytest
from reolink_aio.baichuan import xmls
from reolink_aio.baichuan.baichuan import Baichuan
from reolink_aio.baichuan.util import (
    AES_IV,
    HEADER_MAGIC,
    encrypt_baichuan,
    md5_str_modern,
)
from reolink_aio.enums import ConnectionEnum

from scripts.baichuan import analyze, media, pcap, protocol, redact

USER = "viewer"
PASSWORD = "Tr0ub4dor&3"
NONCE = "A1B2C3D4E5F60718"
UID = "95270000ABCDEF12"
MAC = "ec:71:db:12:34:56"
CLIENT = ("192.168.7.50", 51234)
DEVICE = ("192.168.7.10", 9000)
MAGIC = bytes.fromhex(HEADER_MAGIC)

NONCE_XML = (
    '<?xml version="1.0" encoding="UTF-8" ?>\n<body>\n<Encryption version="1.1">\n'
    f"<type>md5</type>\n<nonce>{NONCE}</nonce>\n</Encryption>\n</body>\n"
)
DEVICE_INFO_XML = (
    '<?xml version="1.0" encoding="UTF-8" ?>\n<body>\n<DeviceInfo version="1.1">\n'
    "<type>nvr</type>\n<typeInfo>NVR</typeInfo>\n<name>RLN36</name>\n"
    f"<channelNum>36</channelNum>\n<uid>{UID}</uid>\n<mac>{MAC}</mac>\n"
    "<ip>192.168.7.10</ip>\n</DeviceInfo>\n</body>\n"
)
SEEK_XML = (
    '<?xml version="1.0" encoding="UTF-8" ?>\n<body>\n<ReplaySeek version="1.1">\n'
    "<channelId>0</channelId>\n<seq>1761742862</seq>\n<seekTime>\n<year>2026</year>\n"
    "<month>10</month>\n<day>27</day>\n<hour>13</hour>\n<minute>41</minute>\n"
    "<second>0</second>\n</seekTime>\n</ReplaySeek>\n</body>\n"
)
REPLAY_XML = (
    '<?xml version="1.0" encoding="UTF-8" ?>\n<body>\n<FileInfoList version="1.1">\n'
    "<FileInfo>\n<channelId>0</channelId>\n<streamType>subStream</streamType>\n"
    "<Id>Mp4Record/2026-10-27/RecS01_20261027130000_20261027140000.mp4</Id>\n"
    "<playSpeed>1</playSpeed>\n</FileInfo>\n</FileInfoList>\n</body>\n"
)
BINARY_EXT_XML = (
    '<?xml version="1.0" encoding="UTF-8" ?>\n<Extension version="1.1">\n'
    "<binaryData>1</binaryData>\n<channelId>0</channelId>\n"
    "<encryptLen>1024</encryptLen>\n</Extension>\n"
)


def _aes(key: bytes, data: bytes) -> bytes:
    from Cryptodome.Cipher import AES

    return AES.new(key=key, mode=AES.MODE_CFB, iv=AES_IV, segment_size=128).encrypt(
        data
    )


def _header(
    cmd_id: int,
    body_len: int,
    mess_id: bytes,
    *,
    message_class: str,
    flag: bytes,
    payload_offset: int = 0,
) -> bytes:
    head = MAGIC + struct.pack("<II", cmd_id, body_len) + mess_id + flag
    head += bytes.fromhex(message_class)
    if message_class in ("1464", "0000", "8264"):
        head += struct.pack("<I", payload_offset)
    return head


def _media_bytes() -> bytes:
    info = b"1001" + struct.pack("<III", 32, 640, 360) + bytes(16)
    key = (
        b"00dc"
        + b"H264"
        + struct.pack("<IIII", 700, 8, 5000, 0)
        + struct.pack("<II", 1761742862, 0)
        + bytes(700)
    )
    frame = b"01dc" + b"H264" + struct.pack("<IIII", 300, 0, 45000, 0) + bytes(300)
    audio = b"05wb" + struct.pack("<HH", 44, 44) + bytes(44) + bytes(4)
    return info + key + frame + audio + frame + frame


class FakeConnection:
    """Records what reolink-aio writes and answers like a device would."""

    con_type = ConnectionEnum.tcp
    connection_open = True

    def __init__(self, aes_key_holder: dict[str, bytes]) -> None:
        self.events: list[tuple[str, bytes]] = []
        self.keys = aes_key_holder
        self.receive_futures: dict[int, Any] = {}

    async def connect(self) -> None:
        pass

    async def send(
        self,
        data: bytes,
        cmd_id: int,
        full_mess_id: int,
        channel: int | None = None,
        log_mess: str = "",
    ) -> tuple[bytes, int, bytes]:
        self.events.append(("C", data))
        mess_id = data[12:16]
        header_len = 24 if data[18:20].hex() in ("1464", "0000") else 20
        body_len = struct.unpack("<I", data[8:12])[0]
        if cmd_id == 1 and body_len == 0:  # the nonce request
            body = encrypt_baichuan(NONCE_XML, data[12])
            reply = (
                _header(
                    1,
                    len(body),
                    mess_id,
                    message_class="1466",
                    flag=bytes.fromhex("12dd"),
                )
                + body
            )
            self.events.append(("D", reply))
            return reply, 20, b""
        if cmd_id == 1:  # the login
            body = encrypt_baichuan(DEVICE_INFO_XML, data[12])
            reply = (
                _header(
                    1,
                    len(body),
                    mess_id,
                    message_class="1464",
                    flag=struct.pack("<H", 200),
                )
                + body
            )
            self.events.append(("D", reply))
            return reply, 24, b""
        if (
            cmd_id == 5
        ):  # replay start: extension + media, first 1024 media bytes AES encrypted
            key = self.keys["aes"]
            ext = _aes(key, BINARY_EXT_XML.encode())
            stream = _media_bytes()
            stream = _aes(key, stream[:1024]) + stream[1024:]
            cut = 1200
            first = (
                _header(
                    5,
                    len(ext) + cut,
                    mess_id,
                    message_class="0000",
                    flag=struct.pack("<H", 200),
                    payload_offset=len(ext),
                )
                + ext
                + stream[:cut]
            )
            second = (
                _header(
                    5,
                    len(stream) - cut,
                    mess_id,
                    message_class="0000",
                    flag=struct.pack("<H", 200),
                )
                + stream[cut:]
            )
            self.events.extend([("D", first), ("D", second)])
            return first[: 24 + len(ext)], 24, stream[:cut]
        reply = _header(
            cmd_id, 0, mess_id, message_class="1464", flag=struct.pack("<H", 200)
        )
        self.events.append(("D", reply))
        return reply, header_len, b""

    async def close(self) -> None:
        pass


async def _record_session() -> list[tuple[str, bytes]]:
    """Run reolink-aio's login, a replay seek/start/stop and a logout through the fake."""
    keys: dict[str, bytes] = {}
    http_api = MagicMock(
        is_battery=False,
        _enc_range=[],
        _is_nvr=False,
        _is_hub=False,
        _channels=[],
        _stream_channels=[],
        _num_channels=0,
    )
    bc = Baichuan(
        DEVICE[0], USER, PASSWORD, http_api=http_api, connection_type=ConnectionEnum.tcp
    )
    conn = FakeConnection(keys)
    bc._connection = conn  # type: ignore[assignment]
    await bc.login()
    assert bc._aes_key is not None
    keys["aes"] = bc._aes_key
    assert bc._aes_key == md5_str_modern(f"{NONCE}-{PASSWORD}")[0:16].encode()
    await bc.send(cmd_id=123, channel=0, body=SEEK_XML)
    await bc.send(cmd_id=5, channel=0, body=REPLAY_XML)
    await bc.send(
        cmd_id=7, channel=0, body=xmls.CHANNEL_EXTENSION_XML.format(channel=0)
    )
    await bc.send(
        cmd_id=2, body=xmls.LOGOUT_XML.format(userName=USER, password=PASSWORD)
    )
    return conn.events


# ---- a tiny packet writer ----


def _tcp(
    src: tuple[str, int],
    dst: tuple[str, int],
    seq: int,
    payload: bytes,
    flags: int = 0x18,
) -> bytes:
    tcp = (
        struct.pack(
            ">HHIIHHHH",
            src[1],
            dst[1],
            seq & 0xFFFFFFFF,
            0,
            5 << 12 | flags,
            65535,
            0,
            0,
        )
        + payload
    )
    total = 20 + len(tcp)
    ip = struct.pack(
        ">BBHHHBBH4s4s", 0x45, 0, total, 1, 0x4000, 64, 6, 0, _ip4(src[0]), _ip4(dst[0])
    )
    return bytes(6) + bytes(6) + b"\x08\x00" + ip + tcp


def _ip4(text: str) -> bytes:
    return bytes(int(p) for p in text.split("."))


def _pcapng(packets: list[tuple[float, bytes]]) -> bytes:
    def block(btype: int, body: bytes) -> bytes:
        body += bytes(-len(body) % 4)
        total = 12 + len(body)
        return struct.pack("<II", btype, total) + body + struct.pack("<I", total)

    out = block(0x0A0D0D0A, struct.pack("<IHHq", 0x1A2B3C4D, 1, 0, -1))
    # if_tsresol = 6 (microseconds), then end of options.
    out += block(
        1,
        struct.pack("<HHI", 1, 0, 0)
        + struct.pack("<HHB", 9, 1, 6)
        + bytes(3)
        + struct.pack("<HH", 0, 0),
    )
    for ts, data in packets:
        ticks = round(ts * 1_000_000)
        out += block(
            6,
            struct.pack(
                "<IIIII", 0, ticks >> 32, ticks & 0xFFFFFFFF, len(data), len(data)
            )
            + data,
        )
    return out


def _pcap(packets: list[tuple[float, bytes]]) -> bytes:
    out = struct.pack("<IHHiIII", 0xA1B2C3D4, 2, 4, 0, 0, 65535, 1)
    for ts, data in packets:
        sec = int(ts)
        out += (
            struct.pack(
                "<IIII", sec, round((ts - sec) * 1_000_000), len(data), len(data)
            )
            + data
        )
    return out


def _segments(events: list[tuple[str, bytes]]) -> list[tuple[float, bytes]]:
    """Turn the ordered messages into TCP segments with awkward cuts."""
    packets: list[tuple[float, bytes]] = []
    ts = 1_761_742_800.0
    seq = {"C": 1000, "D": 5000}
    packets.append((ts, _tcp(CLIENT, DEVICE, seq["C"] - 1, b"", 0x02)))  # SYN
    packets.append((ts + 0.001, _tcp(DEVICE, CLIENT, seq["D"] - 1, b"", 0x12)))
    for i, (side, data) in enumerate(events):
        ts += 0.5
        src, dst = (CLIENT, DEVICE) if side == "C" else (DEVICE, CLIENT)
        base = seq[side]
        if side == "C":
            # every client message split after 10 bytes, in the middle of its header
            packets.append((ts, _tcp(src, dst, base, data[:10])))
            packets.append((ts + 0.01, _tcp(src, dst, base + 10, data[10:])))
        elif i == 3:
            # the login response: out of order, then retransmitted
            half = len(data) // 2
            packets.append((ts + 0.02, _tcp(src, dst, base + half, data[half:])))
            packets.append((ts + 0.03, _tcp(src, dst, base, data[:half])))
            packets.append((ts + 0.04, _tcp(src, dst, base, data[:half])))
        else:
            packets.append((ts, _tcp(src, dst, base, data)))
        seq[side] += len(data)
    return packets


@pytest.fixture
async def capture(tmp_path: Path) -> dict[str, Any]:
    events = await _record_session()
    packets = _segments(events)
    pcapng_path = tmp_path / "session.pcapng"
    pcapng_path.write_bytes(_pcapng(packets))
    pcap_path = tmp_path / "session.pcap"
    pcap_path.write_bytes(_pcap(packets))
    return {"events": events, "pcapng": pcapng_path, "pcap": pcap_path}


def _secret_strings() -> list[str]:
    return [
        PASSWORD,
        USER,
        NONCE,
        UID,
        MAC,
        CLIENT[0],
        DEVICE[0],
        md5_str_modern(f"{USER}{NONCE}"),
        md5_str_modern(f"{PASSWORD}{NONCE}"),
        md5_str_modern(f"{NONCE}-{PASSWORD}")[0:16],
    ]


async def test_decodes_and_redacts(capture: dict[str, Any]) -> None:
    report = analyze.analyze(capture["pcapng"], [protocol.Credential(USER, PASSWORD)])
    assert report.packets == len(_segments(capture["events"]))
    assert len(report.flows) == 1
    flow = report.flows[0]
    assert "verified" in flow.login
    assert flow.login_flag == "12dd"
    assert flow.device_info["type"] == "nvr"
    assert flow.device_info["name"] == "RLN36"
    assert not flow.problems, flow.problems
    cmds = [(e.direction, e.cmd_id) for e in flow.entries]
    assert cmds == [
        ("C>D", 1),
        ("D>C", 1),
        ("C>D", 1),
        ("D>C", 1),
        ("C>D", 123),
        ("D>C", 123),
        ("C>D", 5),
        ("D>C", 5),
        ("D>C", 5),
        ("C>D", 7),
        ("D>C", 7),
        ("C>D", 2),
        ("D>C", 2),
    ]
    by_index = dict(enumerate(flow.entries))
    assert by_index[0].message_class == "1465"
    assert by_index[1].cipher == "bc"
    assert by_index[2].cipher == "bc"
    assert "body/LoginUser" in by_index[2].tags
    assert by_index[4].cipher == "aes"
    assert by_index[4].tags == ["Extension/channelId", "body/ReplaySeek"]
    seek = "\n".join(by_index[4].documents)
    assert "<seekTime>" in seek
    assert "<minute>41</minute>" in seek
    replay = "\n".join(by_index[6].documents)
    assert "<playSpeed>1</playSpeed>" in replay
    assert "RecS01_" in replay
    first_chunk, second_chunk = by_index[7], by_index[8]
    assert first_chunk.binary == 1200
    assert "encryptLen 1024" in first_chunk.notes
    kinds = [b.split()[0] for b in first_chunk.blocks + second_chunk.blocks]
    assert kinds == ["info", "key", "frame", "audio", "frame", "frame"]
    assert "H264" in first_chunk.blocks[1]
    assert "700 B" in first_chunk.blocks[1]
    assert "pad 4" in " ".join(first_chunk.blocks + second_chunk.blocks)
    assert "D>C cmd 5 ch 1" in flow.streams
    assert "codec H264" in flow.streams["D>C cmd 5 ch 1"]
    assert by_index[11].cipher == "aes"
    assert "body/LoginUser" in by_index[11].tags
    text = analyze.render_text(report)
    as_json = json.dumps(report.as_dict())
    for secret in _secret_strings():
        assert secret not in text, secret
        assert secret not in as_json, secret
    assert "<uid>" in text
    assert "<mac>" in text
    assert "<ip>" in text
    assert "RLN36" in text
    assert "<password>&lt;password&gt;</password>" in text


async def test_pcap_matches_pcapng(capture: dict[str, Any]) -> None:
    creds = [protocol.Credential(USER, PASSWORD)]
    a = analyze.analyze(capture["pcapng"], creds)
    b = analyze.analyze(capture["pcap"], creds)
    assert [e.as_dict() for e in a.flows[0].entries] == [
        e.as_dict() for e in b.flows[0].entries
    ]


async def test_wrong_password_is_reported(capture: dict[str, Any]) -> None:
    report = analyze.analyze(capture["pcapng"], [protocol.Credential(USER, "not-it")])
    flow = report.flows[0]
    assert "NO credential matched" in flow.login
    seek = flow.entries[4]
    assert seek.cipher == "undecrypted"
    assert seek.documents == []
    assert "could not be decrypted" in " ".join(seek.notes)
    text = analyze.render_text(report)
    assert PASSWORD not in text
    assert NONCE not in text


async def test_second_account_matches(capture: dict[str, Any]) -> None:
    creds = [protocol.Credential("admin", "other"), protocol.Credential(USER, PASSWORD)]
    report = analyze.analyze(capture["pcapng"], creds)
    assert "account 2 of 2" in report.flows[0].login
    assert report.flows[0].entries[4].cipher == "aes"


async def test_hole_is_reported_and_parsing_resumes(
    capture: dict[str, Any], tmp_path: Path
) -> None:
    packets = _segments(capture["events"])
    # Drop the device's reply to the seek (cmd 123): one whole segment missing.
    seek_reply = capture["events"][5][1]
    assert seek_reply[4] == 123
    packets = [p for p in packets if not p[1].endswith(seek_reply)]
    path = tmp_path / "holey.pcapng"
    path.write_bytes(_pcapng(packets))
    report = analyze.analyze(path, [protocol.Credential(USER, PASSWORD)])
    flow = report.flows[0]
    assert any("bytes missing" in p for p in flow.problems)
    assert [e.cmd_id for e in flow.entries if e.direction == "D>C"] == [
        1,
        1,
        5,
        5,
        7,
        2,
    ]


async def test_main_writes_files(capture: dict[str, Any], tmp_path: Path) -> None:
    out, as_json = tmp_path / "log.txt", tmp_path / "log.json"
    code = analyze.main(
        [
            str(capture["pcapng"]),
            "--user",
            f"{USER}:{PASSWORD}",
            "--out",
            str(out),
            "--json",
            str(as_json),
        ]
    )
    assert code == 0
    text = out.read_text()
    assert text.startswith("# Baichuan capture log: session.pcapng")
    assert "cmd 123 (replay seek (ReplaySeek))" in text
    data = json.loads(as_json.read_text())
    assert data["flows"][0]["messages"][4]["cmd_name"].startswith("replay seek")
    for secret in _secret_strings():
        assert secret not in text


async def test_main_without_flows(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    path = tmp_path / "empty.pcapng"
    path.write_bytes(_pcapng([]))
    monkeypatch.setenv("BAICHUAN_PASSWORD", PASSWORD)
    assert (
        analyze.main([str(path), "--user", USER, "--out", str(tmp_path / "o.txt")]) == 1
    )
    assert "No Baichuan connections" in (tmp_path / "o.txt").read_text()


def test_not_a_capture(tmp_path: Path) -> None:
    path = tmp_path / "x.bin"
    path.write_bytes(b"hello")
    with pytest.raises(pcap.CaptureFormatError):
        list(pcap.read_packets(path))


def test_redactor_handles_malformed_xml() -> None:
    r = redact.Redactor(["hunter2"])
    out = r.xml(
        "<body><userName>joe</userName><password>hunter2</password><ip>10.0.0.9</ip>"
    )
    assert "joe" not in out
    assert "hunter2" not in out
    assert "10.0.0.9" not in out
    assert r.text("joe sent hunter2 to 10.0.0.9 (aa:bb:cc:dd:ee:ff)") == (
        "<redacted> sent <redacted> to <redacted> (<mac>)"
    )


def test_media_resync_and_opaque() -> None:
    stream = media.MediaStream()
    frame = b"01dc" + b"H265" + struct.pack("<IIII", 16, 0, 1, 0) + bytes(16)
    blocks = stream.feed(b"garbage!" + frame + frame, 0)
    assert [b.kind for b in blocks] == ["unknown", "frame"]
    assert "resync" in blocks[0].note
    assert [b.kind for b in stream.finish()] == ["frame"]
    assert "codec H265" in stream.summary()


async def test_brief_and_range(capture: dict[str, Any]) -> None:
    report = analyze.analyze(capture["pcapng"], [protocol.Credential(USER, PASSWORD)])
    flow = report.flows[0]
    # Pad the replay with a long run of media-only messages.
    base = flow.entries[8]
    for i in range(10):
        flow.entries.insert(
            9 + i,
            analyze.Entry(
                100 + i,
                base.ts + i,
                base.rel + i,
                base.direction,
                base.cmd_id,
                base.message_class,
                base.channel,
                base.stream_type,
                base.msg_num,
                base.status,
                base.enc_flag,
                500,
                0,
                "plain",
                [],
                [],
                500,
                [f"frame 01dc H264 300 B us={i}"],
                [],
            ),
        )
    full = analyze.render_text(report)
    brief = analyze.render_text(report, brief=True)
    assert len(brief) < len(full)
    assert "11 more messages, 5592 B, blocks: frame 12" in brief
    assert "#00008..#00109" in brief
    assert "body/ReplaySeek" in brief
    ranged = analyze.render_text(report, messages=(4, 6))
    assert "#00004" in ranged
    assert "#00007" not in ranged
    assert analyze._index_range("120-180") == (120, 180)
    assert analyze._index_range("7") == (7, 7)


# ---- Baichuan over UDP (the battery Doorbell) ----

DEVICE_UDP = ("192.168.7.21", 2015)
CLIENT_UDP = ("192.168.7.50", 40000)
DEVICE_DATA_PORT = 42123
CLIENT_ID = 54321
HOST_ID = 777
D2C_C_R_XML = (
    f"<P2P><D2C_C_R><cid>{CLIENT_ID}</cid><did>{HOST_ID}</did><nc>{NONCE}</nc>"
    f"<rsp>0</rsp><cfm>1</cfm></D2C_C_R></P2P>"
)
D2C_S_R_XML = f"<P2P><D2C_S_R><uid>{UID}</uid><rsp>0</rsp></D2C_S_R></P2P>"
MTU_PAYLOAD = 1330


def _udp(src: tuple[str, int], dst: tuple[str, int], payload: bytes) -> bytes:
    udp = struct.pack(">HHHH", src[1], dst[1], 8 + len(payload), 0) + payload
    total = 20 + len(udp)
    ip = struct.pack(
        ">BBHHHBBH4s4s",
        0x45,
        0,
        total,
        1,
        0x4000,
        64,
        17,
        0,
        _ip4(src[0]),
        _ip4(dst[0]),
    )
    return bytes(12) + b"\x08\x00" + ip + udp


def _udp_control(body: str) -> tuple[bytes, int]:
    """A connection-control datagram, built by reolink-aio's own encoder."""
    from reolink_aio.baichuan.udp_protocol import BaichuanUdpConnection

    return BaichuanUdpConnection(DEVICE_UDP[0])._construct_udp_mess(body)


def _udp_control_reply(body: str, trans_id: int) -> bytes:
    """The device's reply: same transaction id, so the same XOR key."""
    from reolink_aio.baichuan.util import calc_crc, encrypt_udp_baichuan

    payload = encrypt_udp_baichuan(body, trans_id)
    return (
        bytes.fromhex("3acf872a")
        + struct.pack("<I", len(payload))
        + bytes.fromhex("01000000")
        + struct.pack("<I", trans_id)
        + calc_crc(payload)
        + payload
    )


def _udp_bc_chunks(message: bytes, seq: int, peer_id: int) -> list[tuple[int, bytes]]:
    """Split one Baichuan message into ``10cf872a`` chunks at the MTU, as reolink-aio does."""
    chunks = []
    for offset in range(0, len(message), MTU_PAYLOAD):
        piece = message[offset : offset + MTU_PAYLOAD]
        header = (
            bytes.fromhex("10cf872a")
            + struct.pack("<I", peer_id)
            + bytes(4)
            + struct.pack("<II", seq, len(piece))
        )
        chunks.append((seq, header + piece))
        seq += 1
    return chunks


def _udp_ack(peer_id: int, seq: int) -> bytes:
    return (
        bytes.fromhex("20cf872a")
        + struct.pack("<I", peer_id)
        + bytes(8)
        + struct.pack("<I", seq)
        + bytes(4)
        + struct.pack("<I", 0)
    )


def _udp_packets(events: list[tuple[str, bytes]]) -> list[tuple[float, bytes]]:
    """The UDP connect exchange, then the Baichuan messages chunked, reordered and duplicated."""
    packets: list[tuple[float, bytes]] = []
    ts = 1_761_742_900.0
    device_data = (DEVICE_UDP[0], DEVICE_DATA_PORT)
    # Discovery and connect (XOR with the transaction id; replies reuse the id).
    msg, trans = _udp_control("<P2P><C2D_S><to><port>40000</port></to></C2D_S></P2P>")
    packets.append((ts, _udp(CLIENT_UDP, DEVICE_UDP, msg)))
    packets.append(
        (
            ts + 0.05,
            _udp(device_data, CLIENT_UDP, _udp_control_reply(D2C_S_R_XML, trans)),
        )
    )
    msg, trans = _udp_control(
        f"<P2P><C2D_C><uid>{UID}</uid><cli><port>40000</port></cli><cid>{CLIENT_ID}</cid>"
        "<mtu>1350</mtu></C2D_C></P2P>"
    )
    packets.append((ts + 0.1, _udp(CLIENT_UDP, DEVICE_UDP, msg)))
    packets.append(
        (
            ts + 0.15,
            _udp(device_data, CLIENT_UDP, _udp_control_reply(D2C_C_R_XML, trans)),
        )
    )
    seq = {"C": 0, "D": 0}
    for side, data in events[
        2:
    ]:  # over UDP the nonce comes from D2C_C_R, not an empty cmd 1
        ts += 0.5
        if side == "C":
            chunks = _udp_bc_chunks(data, seq["C"], HOST_ID)
            seq["C"] += len(chunks)
            for i, (_s, chunk) in enumerate(chunks):
                packets.append((ts + 0.001 * i, _udp(CLIENT_UDP, device_data, chunk)))
            packets.append(
                (
                    ts + 0.02,
                    _udp(device_data, CLIENT_UDP, _udp_ack(CLIENT_ID, seq["C"] - 1)),
                )
            )
        else:
            chunks = _udp_bc_chunks(data, seq["D"], CLIENT_ID)
            seq["D"] += len(chunks)
            if len(chunks) > 1:  # the first replay chunk: reorder and repeat
                chunks = [chunks[1], chunks[0], chunks[0], *chunks[2:]]
            for i, (_s, chunk) in enumerate(chunks):
                packets.append((ts + 0.001 * i, _udp(device_data, CLIENT_UDP, chunk)))
    return packets


async def test_udp_doorbell_capture(tmp_path: Path) -> None:
    events = await _record_session()
    path = tmp_path / "doorbell.pcapng"
    path.write_bytes(_pcapng(_udp_packets(events)))
    report = analyze.analyze(path, [protocol.Credential(USER, PASSWORD)])
    assert report.udp_flows == 1
    assert report.tcp_segments == 0
    flow = report.flows[0]
    assert flow.transport == "udp"
    assert "verified" in flow.login
    assert "acknowledgements" in flow.login
    assert not flow.problems, flow.problems
    cmds = [(e.direction, e.cmd_id) for e in flow.entries]
    assert cmds[:4] == [("C>D", -1), ("D>C", -1), ("C>D", -1), ("D>C", -1)]
    assert cmds[4:6] == [("C>D", 1), ("D>C", 1)]
    assert [c for c in cmds if c[1] == 5] == [("C>D", 5), ("D>C", 5), ("D>C", 5)]
    control = flow.entries[3]
    assert control.tags == ["P2P/D2C_C_R"]
    assert "login nonce (nc) taken from here" in control.notes
    assert flow.entries[4].cipher == "bc"
    seek = next(e for e in flow.entries if e.cmd_id == 123 and e.direction == "C>D")
    assert seek.cipher == "aes"
    replay_chunks = [e for e in flow.entries if e.cmd_id == 5 and e.direction == "D>C"]
    kinds = [b.split()[0] for e in replay_chunks for b in e.blocks]
    assert kinds == ["info", "key", "frame", "audio", "frame", "frame"]
    text = analyze.render_text(report)
    assert "over UDP" in text
    for secret in _secret_strings():
        assert secret not in text, secret
    assert "<cid>" in text
    assert "<uid>" in text

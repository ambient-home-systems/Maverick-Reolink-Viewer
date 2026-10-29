"""Read pcapng and pcap files and reassemble TCP streams and Baichuan UDP flows.

Only what the Baichuan analysis needs: Ethernet (with 802.1Q), BSD loopback,
raw IP and Linux cooked link types; IPv4 and IPv6; TCP and UDP. Each direction
of a connection becomes one byte stream with a map from byte offset to the time
the packet carrying it was captured, so messages can be timed and the two
directions interleaved. Out-of-order and retransmitted segments are handled;
a hole (bytes never captured) is recorded and skipped over.
"""

from bisect import bisect_right
from collections.abc import Iterator
from dataclasses import dataclass, field
from pathlib import Path
import struct

from reolink_aio.baichuan.util import calc_crc

PCAPNG_MAGIC = b"\x0a\x0d\x0d\x0a"
PCAP_MAGICS = {
    b"\xd4\xc3\xb2\xa1": ("<", 1_000_000),
    b"\xa1\xb2\xc3\xd4": (">", 1_000_000),
    b"\x4d\x3c\xb2\xa1": ("<", 1_000_000_000),
    b"\xa1\xb2\x3c\x4d": (">", 1_000_000_000),
}
LINK_NULL = 0
LINK_ETHERNET = 1
LINK_RAW_BSD = 12
LINK_RAW = 101
LINK_LINUX_SLL = 113
LINK_LINUX_SLL2 = 276
ETHERTYPE_IPV4 = 0x0800
ETHERTYPE_IPV6 = 0x86DD
ETHERTYPE_VLAN = {0x8100, 0x88A8}
PROTO_TCP = 6
PROTO_UDP = 17
IPV6_SKIPPABLE = {0, 43, 44, 51, 60}  # hop-by-hop, routing, fragment, AH, dest opts
TCP_SYN = 0x02
TCP_FIN = 0x01
TCP_RST = 0x04


class CaptureFormatError(ValueError):
    """The file is not a pcap or pcapng capture."""


@dataclass(frozen=True, slots=True)
class Packet:
    """One captured frame."""

    ts: float
    link_type: int
    data: bytes


@dataclass(frozen=True, slots=True)
class Segment:
    """One TCP or UDP datagram with its addresses."""

    ts: float
    proto: int
    src: str
    sport: int
    dst: str
    dport: int
    seq: int
    flags: int
    payload: bytes


@dataclass(frozen=True, slots=True)
class Hole:
    """Bytes the capture missed, at ``offset`` of the reassembled stream.

    Over TCP ``missing`` is the byte count; over UDP only the number of missing
    ``packets`` is known.
    """

    offset: int
    missing: int
    packets: int = 0


@dataclass(slots=True)
class Stream:
    """One direction of a TCP connection, reassembled."""

    src: str
    sport: int
    dst: str
    dport: int
    data: bytes = b""
    holes: list[Hole] = field(default_factory=list)
    _offsets: list[int] = field(default_factory=list)
    _times: list[float] = field(default_factory=list)

    def time_at(self, offset: int) -> float:
        """Capture time of the packet that carried the byte at ``offset``."""
        if not self._offsets:
            return 0.0
        i = bisect_right(self._offsets, offset) - 1
        return self._times[max(i, 0)]


@dataclass(slots=True)
class Flow:
    """A TCP connection: the client side (lower port, or the SYN sender) and the server."""

    client: str
    client_port: int
    server: str
    server_port: int
    first_ts: float
    to_server: Stream
    to_client: Stream


# ---- file formats ----


def read_packets(path: Path) -> Iterator[Packet]:
    """Yield the packets of a pcapng or pcap file."""
    data = path.read_bytes()
    if data[:4] == PCAPNG_MAGIC:
        yield from _read_pcapng(data)
    elif data[:4] in PCAP_MAGICS:
        yield from _read_pcap(data)
    else:
        raise CaptureFormatError(f"{path.name} is not a pcapng or pcap file")


def _read_pcap(data: bytes) -> Iterator[Packet]:
    endian, divisor = PCAP_MAGICS[data[:4]]
    link_type = struct.unpack(f"{endian}I", data[20:24])[0]
    pos = 24
    while pos + 16 <= len(data):
        sec, frac, caplen, _origlen = struct.unpack(
            f"{endian}IIII", data[pos : pos + 16]
        )
        pos += 16
        yield Packet(sec + frac / divisor, link_type, data[pos : pos + caplen])
        pos += caplen


def _read_pcapng(data: bytes) -> Iterator[Packet]:
    pos = 0
    endian = "<"
    interfaces: list[tuple[int, int]] = []  # (link type, ticks per second)
    while pos + 12 <= len(data):
        block_type = data[pos : pos + 4]
        if block_type == PCAPNG_MAGIC:
            # Section header: byte order magic decides the endianness of this section.
            endian = "<" if data[pos + 8 : pos + 12] == b"\x4d\x3c\x2b\x1a" else ">"
            interfaces = []
        btype, total = struct.unpack(f"{endian}II", data[pos : pos + 8])
        if total < 12 or pos + total > len(data):
            break
        body = data[pos + 8 : pos + total - 4]
        if btype == 1:  # interface description
            link_type = struct.unpack(f"{endian}H", body[:2])[0]
            interfaces.append((link_type, _tsresol(body[8:], endian)))
        elif btype == 6 and interfaces:  # enhanced packet
            iface, ts_high, ts_low, caplen = struct.unpack(f"{endian}IIII", body[:16])
            link_type, per_second = interfaces[min(iface, len(interfaces) - 1)]
            seconds, fraction = divmod((ts_high << 32) | ts_low, per_second)
            yield Packet(
                seconds + fraction / per_second, link_type, body[20 : 20 + caplen]
            )
        elif btype == 3 and interfaces:  # simple packet: no timestamp
            link_type, _per_second = interfaces[0]
            yield Packet(
                0.0, link_type, body[4 : 4 + struct.unpack(f"{endian}I", body[:4])[0]]
            )
        pos += total


def _tsresol(options: bytes, endian: str) -> int:
    """Timestamp units per second from an interface block's if_tsresol option."""
    pos = 0
    while pos + 4 <= len(options):
        code, length = struct.unpack(f"{endian}HH", options[pos : pos + 4])
        if code == 0:
            break
        if code == 9 and length >= 1:
            value = options[pos + 4]
            return int(2 ** (value & 0x7F) if value & 0x80 else 10 ** (value & 0x7F))
        pos += 4 + (length + 3) // 4 * 4
    return 1_000_000


# ---- link, network and transport layers ----


def parse_segment(packet: Packet) -> Segment | None:
    """Decode one frame down to TCP or UDP; None for anything else."""
    ip = _ip_layer(packet)
    if ip is None:
        return None
    version = ip[0] >> 4
    if version == 4:
        return _ipv4(packet.ts, ip)
    if version == 6:
        return _ipv6(packet.ts, ip)
    return None


def _ip_layer(packet: Packet) -> bytes | None:
    data = packet.data
    link = packet.link_type
    if link == LINK_ETHERNET:
        if len(data) < 14:
            return None
        ethertype = struct.unpack(">H", data[12:14])[0]
        pos = 14
        while ethertype in ETHERTYPE_VLAN and len(data) >= pos + 4:
            ethertype = struct.unpack(">H", data[pos + 2 : pos + 4])[0]
            pos += 4
        return data[pos:] if ethertype in (ETHERTYPE_IPV4, ETHERTYPE_IPV6) else None
    if link == LINK_NULL:
        return data[4:] if len(data) > 4 else None
    if link in (LINK_RAW, LINK_RAW_BSD):
        return data
    if link == LINK_LINUX_SLL:
        return data[16:] if len(data) > 16 else None
    if link == LINK_LINUX_SLL2:
        return data[20:] if len(data) > 20 else None
    return None


def _ipv4(ts: float, ip: bytes) -> Segment | None:
    if len(ip) < 20:
        return None
    ihl = (ip[0] & 0x0F) * 4
    total = struct.unpack(">H", ip[2:4])[0]
    proto = ip[9]
    flags_frag = struct.unpack(">H", ip[6:8])[0]
    if flags_frag & 0x1FFF:  # a later fragment: not reassembled
        return None
    src = ".".join(str(b) for b in ip[12:16])
    dst = ".".join(str(b) for b in ip[16:20])
    end = min(len(ip), total) if total >= ihl else len(ip)
    return _transport(ts, proto, src, dst, ip[ihl:end])


def _ipv6(ts: float, ip: bytes) -> Segment | None:
    if len(ip) < 40:
        return None
    length = struct.unpack(">H", ip[4:6])[0]
    nxt = ip[6]
    src = _ipv6_text(ip[8:24])
    dst = _ipv6_text(ip[24:40])
    pos = 40
    end = min(len(ip), 40 + length)
    while nxt in IPV6_SKIPPABLE and pos + 2 <= end:
        if nxt == 44:  # fragment header
            if struct.unpack(">H", ip[pos + 2 : pos + 4])[0] & 0xFFF8:
                return None
            nxt, pos = ip[pos], pos + 8
            continue
        hdr_len = (ip[pos + 1] + 2) * 4 if nxt == 51 else (ip[pos + 1] + 1) * 8
        nxt, pos = ip[pos], pos + hdr_len
    return _transport(ts, nxt, src, dst, ip[pos:end])


def _ipv6_text(raw: bytes) -> str:
    return ":".join(f"{raw[i] << 8 | raw[i + 1]:x}" for i in range(0, 16, 2))


def _transport(
    ts: float, proto: int, src: str, dst: str, data: bytes
) -> Segment | None:
    if proto == PROTO_TCP and len(data) >= 20:
        sport, dport, seq, _ack, off_flags = struct.unpack(">HHIIH", data[:14])
        offset = (off_flags >> 12) * 4
        return Segment(
            ts, proto, src, sport, dst, dport, seq, off_flags & 0x1FF, data[offset:]
        )
    if proto == PROTO_UDP and len(data) >= 8:
        sport, dport, length = struct.unpack(">HHH", data[:6])
        return Segment(ts, proto, src, sport, dst, dport, 0, 0, data[8:length])
    return None


# ---- TCP reassembly ----


@dataclass(slots=True)
class _Direction:
    segments: list[tuple[int, float, bytes]] = field(default_factory=list)
    isn: int | None = None  # sequence number of the first payload byte


def reassemble(segments: list[Segment], port: int) -> list[Flow]:
    """Reassemble every TCP connection that has ``port`` on one end."""
    directions: dict[tuple[str, int, str, int], _Direction] = {}
    first_seen: dict[tuple[str, int, str, int], float] = {}
    for seg in segments:
        if seg.proto != PROTO_TCP or port not in (seg.sport, seg.dport):
            continue
        key = (seg.src, seg.sport, seg.dst, seg.dport)
        direction = directions.setdefault(key, _Direction())
        first_seen.setdefault(key, seg.ts)
        if seg.flags & TCP_SYN:
            direction.isn = (seg.seq + 1) & 0xFFFFFFFF
        if seg.payload:
            if direction.isn is None:
                direction.isn = seg.seq
            direction.segments.append((seg.seq, seg.ts, seg.payload))

    flows: dict[tuple[str, int, str, int], Flow] = {}
    for key, direction in directions.items():
        src, sport, dst, dport = key
        if dport == port:
            client, cport, server, sport_ = src, sport, dst, dport
        else:
            client, cport, server, sport_ = dst, dport, src, sport
        flow_key = (client, cport, server, sport_)
        reverse = (dst, dport, src, sport)
        flow = flows.get(flow_key)
        if flow is None:
            ts = min(first_seen[key], first_seen.get(reverse, first_seen[key]))
            flow = Flow(
                client,
                cport,
                server,
                sport_,
                ts,
                Stream(client, cport, server, sport_),
                Stream(server, sport_, client, cport),
            )
            flows[flow_key] = flow
        stream = flow.to_server if dport == port else flow.to_client
        _fill(stream, direction)
    return sorted(flows.values(), key=lambda f: f.first_ts)


def _fill(stream: Stream, direction: _Direction) -> None:
    isn = direction.isn or 0
    ordered = sorted(
        ((seq - isn) & 0xFFFFFFFF, ts, payload)
        for seq, ts, payload in direction.segments
    )
    chunks: list[bytes] = []
    nxt = 0  # next expected sequence position
    produced = 0  # bytes placed in the stream so far (holes excluded)
    for rel, ts, payload in ordered:
        if rel > nxt:
            stream.holes.append(Hole(produced, rel - nxt))
            nxt = rel
        if rel + len(payload) <= nxt:
            continue  # retransmission of bytes already placed
        fresh = payload[nxt - rel :]
        stream._offsets.append(produced)  # noqa: SLF001 - building the stream
        stream._times.append(ts)  # noqa: SLF001
        chunks.append(fresh)
        nxt += len(fresh)
        produced += len(fresh)
    stream.data = b"".join(chunks)


# ---- Baichuan over UDP ----

UDP_MAGIC_CON = bytes.fromhex(
    "3acf872a"
)  # connection control, XOR with the transaction id
UDP_MAGIC_BC = bytes.fromhex("10cf872a")  # a chunk of the Baichuan message stream
UDP_MAGIC_ACK = bytes.fromhex("20cf872a")  # acknowledgement
UDP_MAGICS = (UDP_MAGIC_CON, UDP_MAGIC_BC, UDP_MAGIC_ACK)
UDP_CONNECT_PORT = 2015


@dataclass(frozen=True, slots=True)
class UdpControl:
    """One connection-control datagram (``3acf872a``), still encrypted."""

    ts: float
    to_server: bool
    trans_id: int
    payload: bytes
    crc_ok: bool


@dataclass(slots=True)
class UdpFlow:
    """A Baichuan-over-UDP conversation between a client and a device."""

    client: str
    server: str
    first_ts: float
    to_server: Stream
    to_client: Stream
    control: list[UdpControl] = field(default_factory=list)
    acks: int = 0
    unknown: int = 0


def reassemble_udp(segments: list[Segment], port: int) -> list[UdpFlow]:
    """Rebuild every Baichuan-over-UDP conversation (reolink-aio's ``udp_protocol``)."""
    flows: dict[tuple[str, str], UdpFlow] = {}
    chunks: dict[tuple[str, str, bool], dict[int, tuple[float, bytes]]] = {}
    for seg in segments:
        if seg.proto != PROTO_UDP or seg.payload[:4] not in UDP_MAGICS:
            continue
        key = (seg.src, seg.dst) if (seg.src, seg.dst) in flows else (seg.dst, seg.src)
        flow = flows.get(key)
        if flow is None:
            # The device is the side addressed on the connect or Baichuan port.
            if seg.dport in (UDP_CONNECT_PORT, port):
                client, server = seg.src, seg.dst
            elif seg.sport in (UDP_CONNECT_PORT, port):
                client, server = seg.dst, seg.src
            else:
                client, server = seg.src, seg.dst
            key = (client, server)
            flow = UdpFlow(
                client,
                server,
                seg.ts,
                Stream(client, 0, server, 0),
                Stream(server, 0, client, 0),
            )
            flows[key] = flow
        to_server = seg.src == flow.client
        data = seg.payload
        magic = data[:4]
        if magic == UDP_MAGIC_CON and len(data) >= 20:
            length, trans_id = struct.unpack("<I4xI", data[4:16])
            payload = data[20 : 20 + length]
            flow.control.append(
                UdpControl(
                    seg.ts,
                    to_server,
                    trans_id,
                    payload,
                    calc_crc(payload) == data[16:20],
                )
            )
        elif magic == UDP_MAGIC_BC and len(data) >= 20:
            seq, length = struct.unpack("<II", data[12:20])
            chunks.setdefault((flow.client, flow.server, to_server), {}).setdefault(
                seq, (seg.ts, data[20 : 20 + length])
            )
        elif magic == UDP_MAGIC_ACK:
            flow.acks += 1
        else:
            flow.unknown += 1
    for (client, server, to_server), by_seq in chunks.items():
        flow = flows[(client, server)]
        _fill_udp(flow.to_server if to_server else flow.to_client, by_seq)
    return sorted(flows.values(), key=lambda f: f.first_ts)


def _fill_udp(stream: Stream, by_seq: dict[int, tuple[float, bytes]]) -> None:
    pieces: list[bytes] = []
    produced = 0
    expected: int | None = None
    for seq in sorted(by_seq):
        ts, payload = by_seq[seq]
        if expected is not None and seq > expected:
            stream.holes.append(Hole(produced, 0, packets=seq - expected))
        stream._offsets.append(produced)  # noqa: SLF001 - building the stream
        stream._times.append(ts)  # noqa: SLF001
        pieces.append(payload)
        produced += len(payload)
        expected = seq + 1
    stream.data = b"".join(pieces)

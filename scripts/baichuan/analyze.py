"""Turn a capture of the Reolink client's Baichuan traffic into a redacted log.

    python -m scripts.baichuan capture.pcapng --user admin --out capture.log.txt

The password is read from ``BAICHUAN_PASSWORD`` or asked for; ``--user`` may
be given more than once (``--user name:password`` carries its own password) when
the devices in the capture have different accounts. Each connection's login is
verified against the credentials (the hashed user name in the login request),
and every message after it is decrypted with the matching key.

The log never carries credentials, the nonce or the login hashes, UIDs, serial
numbers, MAC or IP addresses, or any media bytes. It does carry model names,
channel names, times and the XML of each message.
"""

import argparse
from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import UTC, datetime
import getpass
import json
import os
from pathlib import Path
import re
import sys
from typing import Any
from xml.etree import ElementTree as ET

from reolink_aio.baichuan.util import get_value_from_xml

from .media import MediaStream
from .names import cmd_name
from .pcap import Flow, Segment, parse_segment, read_packets, reassemble
from .protocol import (
    Cipher,
    Credential,
    Header,
    RawMessage,
    Session,
    aes_decrypt,
    decrypt_part,
    root_tag,
    split_documents,
    split_messages,
)
from .redact import Redactor

DEVICE_INFO_TAGS = ("type", "typeInfo", "channelNum", "analogChnNum", "name", "model")
_PRINTABLE = re.compile(rb"[\x20-\x7e]{6,}")
MAX_STRINGS = 8


@dataclass(slots=True)
class Entry:
    """One message in the log."""

    index: int
    ts: float
    rel: float
    direction: str  # "C>D" client to device, "D>C" device to client
    cmd_id: int
    message_class: str
    channel: int
    stream_type: int
    msg_num: int
    status: int | None
    enc_flag: str | None
    body_len: int
    payload_offset: int
    cipher: str
    documents: list[str] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)
    binary: int = 0
    blocks: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        """JSON form."""
        return {
            "index": self.index,
            "time": datetime.fromtimestamp(self.ts, tz=UTC).isoformat(
                timespec="milliseconds"
            ),
            "rel_s": round(self.rel, 3),
            "direction": self.direction,
            "cmd_id": self.cmd_id,
            "cmd_name": cmd_name(self.cmd_id),
            "message_class": self.message_class,
            "channel": self.channel,
            "stream_type": self.stream_type,
            "msg_num": self.msg_num,
            "status": self.status,
            "enc_flag": self.enc_flag,
            "body_len": self.body_len,
            "payload_offset": self.payload_offset,
            "cipher": self.cipher,
            "tags": self.tags,
            "xml": self.documents,
            "binary_bytes": self.binary,
            "blocks": self.blocks,
            "notes": self.notes,
        }


@dataclass(slots=True)
class FlowReport:
    """One TCP connection, decoded."""

    label: str
    client_port: int
    server_port: int
    first_ts: float
    login: str = "no login seen"
    login_flag: str | None = None
    device_info: dict[str, str] = field(default_factory=dict)
    entries: list[Entry] = field(default_factory=list)
    streams: dict[str, str] = field(default_factory=dict)
    problems: list[str] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        """JSON form."""
        return {
            "label": self.label,
            "client_port": self.client_port,
            "server_port": self.server_port,
            "login": self.login,
            "login_enc_flag": self.login_flag,
            "device_info": self.device_info,
            "media_streams": self.streams,
            "problems": self.problems,
            "messages": [e.as_dict() for e in self.entries],
        }


@dataclass(slots=True)
class Report:
    """The whole capture."""

    capture: str
    packets: int
    tcp_segments: int
    udp_on_port: int
    other_tcp_flows: int
    flows: list[FlowReport] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        """JSON form."""
        return {
            "capture": self.capture,
            "packets": self.packets,
            "tcp_segments": self.tcp_segments,
            "udp_on_port": self.udp_on_port,
            "other_tcp_flows": self.other_tcp_flows,
            "flows": [f.as_dict() for f in self.flows],
        }


def analyze(path: Path, credentials: Sequence[Credential], port: int = 9000) -> Report:
    """Read, reassemble, decrypt and redact a capture."""
    packets = 0
    segments: list[Segment] = []
    udp_on_port = 0
    other_tcp: set[tuple[str, int, str, int]] = set()
    for packet in read_packets(path):
        packets += 1
        seg = parse_segment(packet)
        if seg is None:
            continue
        if seg.proto == 17:
            if port in (seg.sport, seg.dport):
                udp_on_port += 1
            continue
        segments.append(seg)
        if port not in (seg.sport, seg.dport):
            ends = sorted([(seg.src, seg.sport), (seg.dst, seg.dport)])
            other_tcp.add((ends[0][0], ends[0][1], ends[1][0], ends[1][1]))
    flows = reassemble(segments, port)
    report = Report(path.name, packets, len(segments), udp_on_port, len(other_tcp))
    devices: dict[str, str] = {}
    start = min((f.first_ts for f in flows), default=0.0)
    redactor = (
        Redactor()
    )  # shared: a value learned on one connection is removed everywhere
    for flow in flows:
        label = devices.setdefault(
            flow.server, f"device {chr(ord('A') + len(devices))}"
        )
        report.flows.append(
            _decode_flow(flow, label, list(credentials), start, redactor)
        )
    return report


def _decode_flow(
    flow: Flow,
    label: str,
    credentials: list[Credential],
    start: float,
    redactor: Redactor,
) -> FlowReport:
    out = FlowReport(label, flow.client_port, flow.server_port, flow.first_ts)
    session = Session(credentials)
    redactor.add_secrets(session.secrets)
    raw: list[tuple[float, int, str, RawMessage]] = []
    for order, (stream, direction) in enumerate(
        ((flow.to_server, "C>D"), (flow.to_client, "D>C"))
    ):
        messages, skips, leftover = split_messages(stream.data)
        raw.extend((stream.time_at(m.offset), order, direction, m) for m in messages)
        for hole in stream.holes:
            out.problems.append(
                f"{direction}: {hole.missing} bytes missing at offset {hole.offset}"
            )
        for skip in skips:
            out.problems.append(
                f"{direction}: {skip.length} bytes skipped at offset {skip.offset} (no header)"
            )
        if leftover:
            out.problems.append(
                f"{direction}: {leftover} bytes of an unfinished message at the end"
            )
    raw.sort(key=lambda item: (item[0], item[1], item[3].offset))
    streams: dict[str, MediaStream] = {}
    for index, (ts, _order, direction, message) in enumerate(raw):
        entry = _decode_message(
            index=index,
            ts=ts,
            start=start,
            direction=direction,
            message=message,
            session=session,
            redactor=redactor,
            streams=streams,
            flow=out,
        )
        out.entries.append(entry)
    for key, media in streams.items():
        for block in media.finish():
            if 0 <= block.msg_index < len(out.entries):
                out.entries[block.msg_index].blocks.append(block.describe())
        out.streams[key] = redactor.text(media.summary())
    out.login = _login_summary(session)
    return out


def _login_summary(session: Session) -> str:
    if session.login_style == "none":
        return "no login seen (capture must include the client's login)"
    if session.matched is not None:
        which = session.credentials.index(session.matched) + 1
        return (
            f"{session.login_style} login, credentials verified "
            f"(account {which} of {len(session.credentials)}: both hashes match)"
        )
    if session.login_style == "modern":
        return "modern login, NO credential matched the hashed user name (AES keys tried anyway)"
    return "legacy login (no nonce): credentials not verified"


def _decode_message(
    *,
    index: int,
    ts: float,
    start: float,
    direction: str,
    message: RawMessage,
    session: Session,
    redactor: Redactor,
    streams: dict[str, MediaStream],
    flow: FlowReport,
) -> Entry:
    header = message.header
    entry = Entry(
        index,
        ts,
        ts - start,
        direction,
        header.cmd_id,
        header.message_class,
        header.channel,
        header.stream_type,
        header.msg_num,
        header.status,
        header.enc_flag,
        header.body_len,
        header.payload_offset,
        Cipher.PLAIN,
    )
    before_login = session.login_style == "none" or header.cmd_id in (1, 2)
    prefer = Cipher.BC if before_login else Cipher.AES
    binary = b""
    ciphers: list[Cipher] = []
    documents: list[str] = []
    for part in (message.head, message.tail):
        if not part:
            continue
        if binary:  # once a part is binary, what follows is too
            binary += part
            continue
        text, cipher = decrypt_part(part, header, session, prefer=prefer)
        if text is None:
            binary = part
            continue
        ciphers.append(cipher)
        documents.extend(split_documents(text))
    _learn_login(
        header, direction, documents, session=session, redactor=redactor, flow=flow
    )
    if header.cmd_id == 1 and direction == "C>D" and binary and not documents:
        session.login_style = "legacy"  # hashes in a binary body, no nonce exchange
    is_media = False
    if binary:
        binary = _decrypt_binary(binary, documents, session, entry)
        entry.binary = len(binary)
        key = f"{direction} cmd {header.cmd_id} ch {header.channel}"
        stream = streams.setdefault(key, MediaStream())
        blocks = stream.feed(binary, index)
        is_media = any(b.kind != "unknown" for b in stream.blocks)
        if not is_media and len(binary) < 4096:
            if header.cmd_id in (1, 2):
                entry.blocks.append(
                    f"opaque {len(binary)} B (login material, not shown)"
                )
            else:
                entry.blocks.append(_describe_opaque(binary, redactor))
        entry.blocks.extend(b.describe() for b in blocks)
    entry.cipher = "+".join(dict.fromkeys(c.value for c in ciphers)) or (
        Cipher.UNKNOWN if binary and not documents and not is_media else Cipher.PLAIN
    )
    if binary and not documents and not is_media:
        entry.notes.append("body could not be decrypted (no XML, not media)")
    entry.tags = [t for t in (root_tag(d) for d in documents) if t]
    entry.documents = [redactor.xml(d) for d in documents]
    return entry


def _learn_login(
    header: Header,
    direction: str,
    documents: list[str],
    *,
    session: Session,
    redactor: Redactor,
    flow: FlowReport,
) -> None:
    if header.cmd_id != 1 or not documents:
        return
    joined = "\n".join(documents)
    if direction == "D>C":
        nonce = get_value_from_xml(joined, "nonce")
        if nonce and session.nonce is None:
            session.set_nonce(nonce)
            redactor.add_secrets(session.secrets)
            flow.login_flag = header.enc_flag
        for document in documents:
            info = _device_info(document)
            for tag, value in info.items():
                flow.device_info.setdefault(tag, value)
    elif "LoginUser" in joined:
        session.match_login(joined)
        redactor.add_secrets(session.secrets)


def _device_info(document: str) -> dict[str, str]:
    """Pick the non-secret fields of a login response's ``<DeviceInfo>``."""
    try:
        root = ET.fromstring(document.strip())  # noqa: S314 - the owner's own capture
    except ET.ParseError:
        return {}
    info = root.find(".//DeviceInfo")
    if info is None:
        return {}
    return {
        tag: (info.findtext(tag) or "").strip()
        for tag in DEVICE_INFO_TAGS
        if (info.findtext(tag) or "").strip()
    }


def _decrypt_binary(
    binary: bytes, documents: list[str], session: Session, entry: Entry
) -> bytes:
    """Apply the extension's encryptLen: that many leading bytes are AES-encrypted."""
    if not documents or session.aes_key is None:
        return binary
    joined = "\n".join(documents)
    length = get_value_from_xml(joined, "encryptLen", int)
    if length is None:
        length = get_value_from_xml(joined.lower(), "encryptlen", int)
    if not length:
        return binary
    position = get_value_from_xml(joined, "encryptPos", int) or 0
    note = f"encryptLen {length}" + (f" at {position}" if position else "")
    if position + length > len(binary):
        length = max(len(binary) - position, 0)
        note += f" (only {length} B in this message)"
    entry.notes.append(note)
    return (
        binary[:position]
        + aes_decrypt(binary[position : position + length], session.aes_key)
        + binary[position + length :]
    )


def _describe_opaque(data: bytes, redactor: Redactor) -> str:
    strings = [m.group(0).decode() for m in _PRINTABLE.finditer(data)][:MAX_STRINGS]
    text = f"opaque {len(data)} B, starts {data[:16].hex()}"
    if strings:
        text += ", strings: " + " | ".join(redactor.text(s) for s in strings)
    return text


# ---- output ----


def render_text(report: Report) -> str:
    """Render the log as text."""
    lines = [
        f"# Baichuan capture log: {report.capture}",
        f"packets {report.packets}, TCP segments {report.tcp_segments}, "
        f"UDP packets on the Baichuan port {report.udp_on_port}, "
        f"other TCP connections {report.other_tcp_flows}",
    ]
    if report.udp_on_port:
        lines.append(
            "WARNING: UDP traffic on the Baichuan port: the client may be using P2P/UDP, "
            "which this tool does not decode. Add the devices by IP address."
        )
    if not report.flows:
        lines.append("No TCP connections on the Baichuan port were found.")
    for flow in report.flows:
        lines.append("")
        lines.append(
            f"## {flow.label}: client port {flow.client_port} -> device port {flow.server_port}, "
            f"{len(flow.entries)} messages"
        )
        lines.append(f"login: {flow.login}")
        if flow.login_flag:
            lines.append(f"nonce response encryption flag: {flow.login_flag}")
        if flow.device_info:
            lines.append(
                "device: " + ", ".join(f"{k}={v}" for k, v in flow.device_info.items())
            )
        lines.extend(f"problem: {problem}" for problem in flow.problems)
        lines.extend(
            f"media stream {key}: {summary}" for key, summary in flow.streams.items()
        )
        lines.append("")
        for entry in flow.entries:
            lines.extend(_entry_lines(entry))
    return "\n".join(lines) + "\n"


def _entry_lines(entry: Entry) -> list[str]:
    when = datetime.fromtimestamp(entry.ts, tz=UTC).strftime("%H:%M:%S.%f")[:-3]
    status = (
        f"status {entry.status}"
        if entry.status is not None
        else f"enc {entry.enc_flag}"
    )
    head = (
        f"#{entry.index:05d} {when}Z +{entry.rel:9.3f}s {entry.direction} "
        f"cmd {entry.cmd_id} ({cmd_name(entry.cmd_id)}) class {entry.message_class} "
        f"ch {entry.channel} st {entry.stream_type} msg {entry.msg_num} {status} len {entry.body_len} "
        f"off {entry.payload_offset} [{entry.cipher}]"
    )
    if entry.tags:
        head += " " + " ".join(entry.tags)
    lines = [head]
    for document in entry.documents:
        lines.extend("    " + line for line in document.splitlines())
    if entry.binary:
        lines.append(f"    binary {entry.binary} B")
    lines.extend(f"    block: {block}" for block in entry.blocks)
    lines.extend(f"    note: {note}" for note in entry.notes)
    return lines


def _credentials(args: argparse.Namespace) -> list[Credential]:
    creds: list[Credential] = []
    shared: str | None = os.environ.get("BAICHUAN_PASSWORD")
    for item in args.user:
        if ":" in item:
            name, password = item.split(":", 1)
            creds.append(Credential(name, password))
            continue
        if shared is None:
            if not sys.stdin.isatty():
                raise SystemExit("set BAICHUAN_PASSWORD or pass --user name:password")
            shared = getpass.getpass(f"Password for {item}: ")
        creds.append(Credential(item, shared))
    return creds


def main(argv: Sequence[str] | None = None) -> int:
    """Command line entry point."""
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("capture", type=Path, help="a pcapng or pcap file")
    parser.add_argument(
        "--user",
        action="append",
        required=True,
        help="account name, or name:password; repeatable",
    )
    parser.add_argument(
        "--port", type=int, default=9000, help="the Baichuan TCP port (default 9000)"
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=None,
        help="write the text log here (default: stdout)",
    )
    parser.add_argument(
        "--json", type=Path, default=None, help="also write the log as JSON"
    )
    args = parser.parse_args(argv)
    report = analyze(args.capture, _credentials(args), args.port)
    text = render_text(report)
    if args.out is None:
        sys.stdout.write(text)
    else:
        args.out.write_text(text, encoding="utf8")
    if args.json is not None:
        args.json.write_text(json.dumps(report.as_dict(), indent=1), encoding="utf8")
    verified = sum(1 for f in report.flows if "verified" in f.login)
    sys.stderr.write(
        f"{len(report.flows)} connection(s), {sum(len(f.entries) for f in report.flows)} messages, "
        f"login decoded on {verified}\n"
    )
    return 0 if report.flows else 1

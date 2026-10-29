"""Baichuan framing and decryption, as reolink-aio implements it.

A message is a 20- or 24-byte header followed by ``body_len`` bytes. The first
``payload_offset`` bytes of the body (all of it when the offset is 0) are the
XML part: an ``<Extension>`` document, a ``<body>`` document, or both; the rest
is a second XML document (a request's body after its extension) or binary media.

Header, little endian: magic ``f0debc0a`` · cmd id (u32) · body length (u32) ·
channel/handle byte and a 3-byte message number · two bytes that hold the
encryption flag on 20-byte headers and the status code on 24-byte ones · the
message class (``1464`` 24-byte modern, ``1466`` 20-byte modern, ``1465``
20-byte legacy, ``0000`` 24-byte binary continuation) · payload offset (u32,
24-byte headers only).

Ciphers (``reolink_aio.baichuan.util``): the XOR "BC" cipher with the channel
byte as its offset before login, and AES-128-CFB with a fixed IV after it, the
key being the first 16 characters of the MD5 of ``<nonce>-<password>``. Each
XML part is encrypted on its own, with a fresh cipher.
"""

from dataclasses import dataclass, field
from enum import StrEnum
import hashlib
import re
import struct
from xml.etree import ElementTree as ET

from Cryptodome.Cipher import AES
from reolink_aio.baichuan.util import (
    AES_IV,
    HEADER_MAGIC,
    decrypt_baichuan,
    get_value_from_xml,
    md5_str_modern,
)

MAGIC = bytes.fromhex(HEADER_MAGIC)
# Seen between an NVR and its cameras, and on some snapshot replies (neolink's notes).
MAGIC_DEVICE = bytes.fromhex("a0cded0f")
MAGICS = (MAGIC, MAGIC_DEVICE)
CLASS_MODERN = "1464"
CLASS_LEGACY = "1465"
CLASS_SHORT = "1466"
CLASS_BINARY = "0000"
CLASS_DOWNLOAD = "8264"
HEADER_LEN = {
    CLASS_MODERN: 24,
    CLASS_BINARY: 24,
    CLASS_DOWNLOAD: 24,
    CLASS_LEGACY: 20,
    CLASS_SHORT: 20,
}
ENC_FLAG_PLAIN = {"00dd"}
ENC_FLAG_BC = {"01dd", "12dd", "12dc"}
ENC_FLAG_AES = {"02dd", "03dd"}
XML_START = b"<?xml"
_TAG = re.compile(r"<([A-Za-z_][\w.-]*)[\s>]")


class Cipher(StrEnum):
    """How a message part was encrypted."""

    PLAIN = "plain"
    BC = "bc"
    AES = "aes"
    UNKNOWN = "undecrypted"


@dataclass(frozen=True, slots=True)
class Header:
    """A parsed Baichuan header."""

    cmd_id: int
    body_len: int
    channel: int  # byte 12: 250 host, channel + 1, 0/251 push; also the XOR offset
    stream_type: int  # byte 13: 0 main, 1 sub (neolink's reading of the message number)
    msg_num: int  # bytes 14:16 (reolink-aio counts bytes 13:16 as its message number)
    flag: int  # status code (24-byte header) or encryption flag (20-byte header)
    message_class: str
    payload_offset: int
    header_len: int

    @property
    def status(self) -> int | None:
        """The response status code; None on 20-byte headers."""
        return self.flag if self.header_len == 24 else None

    @property
    def enc_flag(self) -> str | None:
        """The 20-byte header's encryption flag as hex; None on 24-byte headers."""
        return None if self.header_len == 24 else struct.pack("<H", self.flag).hex()


@dataclass(frozen=True, slots=True)
class RawMessage:
    """One message cut from a stream, still encrypted."""

    offset: int
    header: Header
    head: bytes  # the XML part (first payload_offset bytes)
    tail: bytes  # body XML or binary media


@dataclass(frozen=True, slots=True)
class Credential:
    """A username and password to try on each login."""

    username: str
    password: str


@dataclass(slots=True)
class Session:
    """Decryption state of one connection: the nonce, the AES key, the login."""

    credentials: list[Credential]
    nonce: str | None = None
    aes_key: bytes | None = None
    key_candidates: list[tuple[Credential, bytes]] = field(default_factory=list)
    matched: Credential | None = None
    login_style: str = "none"  # none, modern, legacy
    secrets: set[str] = field(default_factory=set)

    def __post_init__(self) -> None:
        """Collect the credentials and their legacy hashes as secrets."""
        for cred in self.credentials:
            self.secrets.update({cred.username, cred.password})
            for text in (cred.username, cred.password):
                digest = hashlib.md5(text.encode()).hexdigest()  # noqa: S324 - legacy login hash, for redaction
                self.secrets.update(
                    {digest, digest.upper(), digest[:31], digest.upper()[:31]}
                )

    def set_nonce(self, nonce: str) -> None:
        """Derive the candidate AES keys from a login nonce."""
        self.nonce = nonce
        self.secrets.add(nonce)
        self.key_candidates = [
            (cred, md5_str_modern(f"{nonce}-{cred.password}")[0:16].encode("utf8"))
            for cred in self.credentials
        ]
        for cred in self.credentials:
            self.secrets.add(md5_str_modern(f"{cred.username}{nonce}"))
            self.secrets.add(md5_str_modern(f"{cred.password}{nonce}"))
        self.aes_key = self.key_candidates[0][1] if self.key_candidates else None

    def match_login(self, login_xml: str) -> None:
        """Verify the credentials against the login request's hashed user name."""
        user_hash = get_value_from_xml(login_xml, "userName") or ""
        password_hash = get_value_from_xml(login_xml, "password") or ""
        if self.nonce is None:
            self.login_style = "legacy"
            for cred in self.credentials:
                user = hashlib.md5(cred.username.encode()).hexdigest().upper()  # noqa: S324
                password = hashlib.md5(cred.password.encode()).hexdigest().upper()  # noqa: S324
                if user.startswith(user_hash[:31]) and password.startswith(
                    password_hash[:31]
                ):
                    self.matched = cred
            return
        self.login_style = "modern"
        for cred, key in self.key_candidates:
            if (
                md5_str_modern(f"{cred.username}{self.nonce}") == user_hash
                and md5_str_modern(f"{cred.password}{self.nonce}") == password_hash
            ):
                self.matched = cred
                self.aes_key = key
                return


# ---- framing ----


def parse_header(data: bytes, *, header_len: int | None = None) -> Header | None:
    """Parse a header at the start of ``data``; None if it is not one (or too short).

    ``header_len`` forces the layout for a message class the table does not
    know (``split_messages`` tries it when the length then lands on the next
    header).
    """
    if len(data) < 20 or data[:4] not in MAGICS:
        return None
    cmd_id, body_len = struct.unpack("<II", data[4:12])
    channel = data[12]
    stream_type = data[13]
    msg_num = struct.unpack("<H", data[14:16])[0]
    flag = struct.unpack("<H", data[16:18])[0]
    message_class = data[18:20].hex()
    if header_len is None:
        header_len = HEADER_LEN.get(message_class)
    if header_len is None:
        return None
    payload_offset = 0
    if header_len == 24:
        if len(data) < 24:
            return None
        payload_offset = struct.unpack("<I", data[20:24])[0]
    return Header(
        cmd_id,
        body_len,
        channel,
        stream_type,
        msg_num,
        flag,
        message_class,
        payload_offset,
        header_len,
    )


@dataclass(frozen=True, slots=True)
class Skip:
    """Bytes skipped while looking for the next message."""

    offset: int
    length: int


def split_messages(data: bytes) -> tuple[list[RawMessage], list[Skip], int]:
    """Cut a stream into messages. Returns them, the skipped stretches and the leftover."""
    messages: list[RawMessage] = []
    skips: list[Skip] = []
    pos = 0
    while pos < len(data):
        header = parse_header(data[pos : pos + 24])
        if header is None and data[pos : pos + 4] in MAGICS:
            header = _guess_header(data, pos)
        if header is None:
            nxt = _next_magic(data, pos + 1)
            if nxt < 0:
                break
            skips.append(Skip(pos, nxt - pos))
            pos = nxt
            continue
        end = pos + header.header_len + header.body_len
        if end > len(data):
            break
        body = data[pos + header.header_len : end]
        cut = (
            header.payload_offset
            if 0 < header.payload_offset <= len(body)
            else len(body)
        )
        messages.append(RawMessage(pos, header, body[:cut], body[cut:]))
        pos = end
    return messages, skips, len(data) - pos


def _guess_header(data: bytes, pos: int) -> Header | None:
    """Accept an unknown message class when its length lands on the next header."""
    for header_len in (24, 20):
        header = parse_header(data[pos : pos + 24], header_len=header_len)
        if header is None:
            continue
        end = pos + header_len + header.body_len
        if end == len(data) or data[end : end + 4] in MAGICS:
            return header
    return None


def _next_magic(data: bytes, start: int) -> int:
    # Bound each search by the best hit so far: a magic that never recurs would
    # otherwise be searched for across the whole remaining stream on every resync.
    best = -1
    for magic in MAGICS:
        end = len(data) if best < 0 else best + len(magic)
        found = data.find(magic, start, end)
        if found >= 0 and (best < 0 or found < best):
            best = found
    return best


# ---- decryption ----


def _looks_like_xml(text: bytes) -> bool:
    return text.lstrip().startswith((XML_START, b"<"))


def aes_decrypt(data: bytes, key: bytes) -> bytes:
    """AES-128-CFB with reolink-aio's fixed IV and 128-bit segments."""
    cipher = AES.new(key=key, mode=AES.MODE_CFB, iv=AES_IV, segment_size=128)
    return cipher.decrypt(data)


def decrypt_part(
    data: bytes, header: Header, session: Session, *, prefer: Cipher | None = None
) -> tuple[str | None, Cipher]:
    """Decrypt one XML part, trying the ciphers the header and the session allow."""
    if not data:
        return "", Cipher.PLAIN
    order: list[Cipher] = []
    flag = header.enc_flag
    if flag in ENC_FLAG_PLAIN:
        order = [Cipher.PLAIN]
    elif flag in ENC_FLAG_BC:
        order = [Cipher.BC]
    elif flag in ENC_FLAG_AES:
        order = [Cipher.AES]
    if prefer is not None and prefer not in order:
        order.insert(0, prefer)
    for cipher in (Cipher.AES, Cipher.BC, Cipher.PLAIN):
        if cipher not in order:
            order.append(cipher)
    for cipher in order:
        if cipher == Cipher.PLAIN and _looks_like_xml(data):
            return _decode(data), Cipher.PLAIN
        if cipher == Cipher.BC:
            try:
                text = decrypt_baichuan(data, header.channel)
            except UnicodeDecodeError:
                continue
            if _looks_like_xml(text.encode()):
                return text, Cipher.BC
        if cipher == Cipher.AES:
            keys = [session.aes_key] if session.aes_key else []
            keys.extend(k for _c, k in session.key_candidates if k not in keys)
            for key in keys:
                plain = aes_decrypt(data, key)
                if _looks_like_xml(plain):
                    decoded = _decode(plain)
                    if decoded is not None:
                        session.aes_key = key
                        return decoded, Cipher.AES
    return None, Cipher.UNKNOWN


def _decode(data: bytes) -> str | None:
    try:
        return data.decode("utf8")
    except UnicodeDecodeError:
        return None


def split_documents(text: str) -> list[str]:
    """Split concatenated XML documents (``<?xml`` ... ``<?xml`` ...)."""
    marker = "<?xml"
    parts = []
    start = 0
    while True:
        nxt = text.find(marker, start + 1)
        if nxt < 0:
            parts.append(text[start:])
            break
        parts.append(text[start:nxt])
        start = nxt
    return [p for p in (part.strip("\x00") for part in parts) if p.strip()]


def root_tag(document: str) -> str | None:
    """Name a document by its root element and first child, as ``root/child``."""
    try:
        root = ET.fromstring(document.strip())  # noqa: S314 - the owner's own capture
    except ET.ParseError:
        # Not well-formed (reolink-aio's logout carries the raw password): name it anyway.
        tags = _TAG.findall(document)
        return "/".join(tags[:2]) if tags else None
    child = next(iter(root), None)
    return root.tag if child is None else f"{root.tag}/{child.tag}"

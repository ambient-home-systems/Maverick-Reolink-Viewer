"""Redact credentials, tokens and identifiers from Baichuan XML and text.

Two layers: elements whose names carry secrets lose their text, and every value
learned from them (a UID, a serial number, a MAC) plus the owner's credentials
and their hashes is removed wherever it appears. IP, IPv6 and MAC addresses are
removed by pattern as well.
"""

from collections.abc import Iterable
import re
from xml.etree import ElementTree as ET

SECRET_TAGS = frozenset(
    {
        "username",
        "password",
        "nonce",
        "uid",
        "serial",
        "serialnumber",
        "sn",
        "mac",
        "macaddress",
        "macaddr",
        "ip",
        "ipaddress",
        "ipaddr",
        "ipv4",
        "ipv6",
        "gateway",
        "mask",
        "netmask",
        "dns",
        "dns1",
        "dns2",
        "ssid",
        "wifipassword",
        "wifikey",
        "key",
        "token",
        "accesstoken",
        "p2ptoken",
        "pushtoken",
        "cid",
        "did",
        "sid",
        "sessionid",
        "email",
        "phone",
        "url",
        "ddns",
        "domain",
        "hostname",
        "deviceid",
        "devid",
        "pwd",
        "passwd",
        "userpwd",
        "p2pcode",
        "uuid",
        "usertoken",
        "pushserver",
        "p2pserver",
        "ntpserver",
    }
)
SECRET_SUFFIXES = ("uid", "password", "token", "serial", "mac", "pwd", "ssid")
_IPV4 = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
_IPV6 = re.compile(r"\b(?:[0-9a-fA-F]{1,4}:){2,7}[0-9a-fA-F]{1,4}\b")
_MAC = re.compile(r"\b(?:[0-9a-fA-F]{2}[:-]){5}[0-9a-fA-F]{2}\b")
_REOLINK_UID = re.compile(r"\b9527[0-9A-Z]{12}\b")
_VALUE_MIN = 3


def is_secret_tag(tag: str) -> bool:
    """Whether an element of this name carries a secret."""
    name = tag.rsplit("}", 1)[-1].lower()
    return name in SECRET_TAGS or name.endswith(SECRET_SUFFIXES)


class Redactor:
    """Removes secrets from XML documents and free text, learning values as it goes."""

    def __init__(self, secrets: Iterable[str] = ()) -> None:
        """Start with the values that must never appear."""
        self._values: set[str] = {s for s in secrets if len(s) >= _VALUE_MIN}

    def learn(self, value: str | None) -> None:
        """Remember a value so every later occurrence is removed too."""
        if value and len(value.strip()) >= _VALUE_MIN:
            self._values.add(value.strip())

    def add_secrets(self, secrets: Iterable[str]) -> None:
        """Remember several values."""
        for value in secrets:
            self.learn(value)

    def xml(self, document: str) -> str:
        """Redact an XML document; falls back to text redaction if it does not parse."""
        try:
            root = ET.fromstring(document.strip())  # noqa: S314 - the owner's own capture
        except ET.ParseError:
            return self.text(self._redact_tags_by_regex(document))
        for element in root.iter():
            if is_secret_tag(element.tag):
                self.learn(element.text)
                if element.text and element.text.strip():
                    element.text = f"<{element.tag.rsplit('}', 1)[-1]}>"
            for name, value in list(element.attrib.items()):
                if is_secret_tag(name):
                    self.learn(value)
                    element.attrib[name] = "<redacted>"
        ET.indent(root, space=" ")
        return self.text(ET.tostring(root, encoding="unicode"))

    def text(self, text: str) -> str:
        """Redact free text: learned values, credentials, addresses."""
        for value in sorted(self._values, key=len, reverse=True):
            text = text.replace(value, "<redacted>")
        text = _IPV4.sub("<ip>", text)
        text = _MAC.sub("<mac>", text)
        text = _IPV6.sub("<ipv6>", text)
        return _REOLINK_UID.sub("<uid>", text)

    def _redact_tags_by_regex(self, document: str) -> str:
        def replace(match: re.Match[str]) -> str:
            tag = match.group(1)
            if is_secret_tag(tag):
                self.learn(match.group(2))
                return f"<{tag}>&lt;{tag}&gt;</{tag}>"
            return match.group(0)

        return re.sub(r"<([A-Za-z_][\w.-]*)>([^<]*)</\1>", replace, document)

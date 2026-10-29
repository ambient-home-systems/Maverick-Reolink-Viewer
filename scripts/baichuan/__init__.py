"""Baichuan capture analysis (Phase 5a).

Reads a Wireshark capture (pcapng or pcap) of the Reolink desktop client talking
to a camera or NVR over TCP port 9000 (or Baichuan's UDP framing), decrypts it with the owner's credentials
using reolink-aio's Baichuan cipher, and writes a redacted message log. See
``scripts/baichuan/README.md`` for the capture instructions.

    python -m scripts.baichuan capture.pcapng --user admin --out capture.log.txt

Captures and logs never go in the repository.
"""

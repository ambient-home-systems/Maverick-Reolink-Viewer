# Baichuan capture (Phase 5a)

Phase 5a asks one question of the Reolink desktop client: how does it start
playback deep inside a recording at once, seek, change speed, and talk through the
Doorbell, over its own protocol (Baichuan, TCP port 9000)? The answer is in a
packet capture of the client, decrypted with your own credentials. This folder
holds the tool that turns such a capture into a redacted message log, and these
are the capture steps.

The capture and the logs never go in the repository (`.gitignore` covers
`*.pcap`, `*.pcapng`, `*.log.txt` and `*.log.json`). Share only the redacted
log.

## What the tool does

`python -m scripts.baichuan` reads a Wireshark capture (pcapng or pcap), rebuilds
every TCP connection to port 9000, cuts it into Baichuan messages and decrypts
them the way reolink-aio does: the XOR cipher before login, AES-128-CFB after it,
with the key derived from the login nonce and your password
(`reolink_aio.baichuan.util`). Each connection's login is verified against the
credentials you give (both hashes in the login request must match). For every
message it writes:

- the time, direction (`C>D` client to device, `D>C` device to client), command
  id and a name for it, message class, the channel/handle byte, the stream-type
  byte, message number, status code or encryption flag, body length, payload
  offset and which cipher decrypted it;
- the XML, with credentials, the nonce and login hashes, UIDs, serial numbers,
  MAC and IP addresses removed (by element name, by learned value and by
  pattern);
- binary payloads as a summary only: media blocks (stream information, key
  frames, frames, audio) with their magic, codec, sizes, timestamps and padding;
  anything that is not media framing as its length and first 16 bytes. Media
  bytes are never written.

What stays in the log: model names, device and channel names, times, file names
of recordings. Open the log and search for your password, user name and IP
addresses before sharing it; the tool's last line says on how many connections
the login was decoded.

## Capture steps (Mac, Wireshark)

Prepare:

1. Install Wireshark (<https://www.wireshark.org/download.html>). On macOS let
   its installer add the ChmodBPF helper so Wireshark can capture without
   `sudo`; log out and in again if it asks.
2. Quit the Reolink desktop client completely (menu bar icon too). It keeps
   sessions open, and the capture must include the client's login.
3. Know the LAN IP addresses of the NVR and the Doorbell (Home Assistant's
   Reolink integration shows them under the device's configuration). Have their
   user names and passwords ready. If the client is signed in to a Reolink
   account, sign out of it first (**Settings → Account**): devices reached
   through the account use P2P/UDP, which the tool does not decode.
4. Decide on the recording. Pick an NVR camera with hour-long continuous
   recordings (Front Yard Right or Front Yard Left), and a day that is already
   complete (yesterday), so the deep start is into a recording the NVR has
   finished.

Capture:

5. Open Wireshark. In the capture filter box type `port 9000` and double-click
   the interface your Mac uses for the LAN (`en0` for Wi-Fi or Ethernet). The
   packet list stays empty until the client connects. Note the wall-clock time
   (the log carries times to the millisecond; your notes tie them to actions).
6. Start the Reolink client. **Add both devices by IP address**: **Add Device**
   (or the **+**) → the **IP/Domain** tab, not the UID or scan tab. Enter the
   LAN IP, port **9000**, the user name and password. Do the NVR first, then the
   Doorbell. If the client already lists them from an earlier run, delete those
   entries and add them again by IP, so they do not reconnect through P2P.
7. Leave the client idle for **20 seconds** after both devices show online: this
   gives a baseline of keep-alives and pushes.

Then do these actions in order, with **10 seconds** between them and a note of
the time of each, so their messages can be told apart:

8. (Optional, for comparison) Open live view of one NVR camera, watch for
   10 seconds, close it.
9. **Playback, deep start.** Open **Playback** for the chosen camera, choose
   the **Fluent** (sub) stream if the client offers it (the capture stays small),
   pick the day, and click **40–50 minutes into an hour-long recording**. Let it
   play for 15 seconds. Note how long it took to start.
10. **Seek forward:** click about 5 minutes later on the timeline. Play 15 s.
11. **Seek back:** click about 10 minutes earlier. Play 15 s.
12. **Speed:** set **4×**, play 15 s; set the **highest speed** offered (8× or
    16×), play 15 s; set **1×**, play 10 s.
13. **Pause** for 10 seconds, then **resume** for 10 seconds.
14. **Stop** playback (the stop button, or leave the Playback page). Wait 10 s.
15. **Download a clip:** in Playback, use **Clip**/**Download** to cut a short
    range (1–2 minutes) of the same recording, on the Fluent stream if it asks,
    and let the download finish. Wait 10 s.
16. **Talk:** open the Doorbell's live view, press and hold the **microphone**
    (talk) button, speak for about 5 seconds, release. Wait 10 s, close live view.
17. Quit the client (so its logout is captured), then stop the capture
    (the red square) and save it: **File → Save As**, pcapng, anywhere outside
    the repository, for example `~/Desktop/reolink-client.pcapng`.

Keep the whole session under about ten minutes. If something fails (the client
falls back to the UID, a device shows offline), stop, fix it, and capture again
from step 5: a clean capture is easier to read than a long one.

## Running the tool

From the repository, with the development environment (`scripts/setup_dev.sh`,
then `source .venv/bin/activate`):

```bash
BAICHUAN_PASSWORD='the password' python -m scripts.baichuan ~/Desktop/reolink-client.pcapng \
    --user admin --out ~/Desktop/reolink-client.log.txt --json ~/Desktop/reolink-client.log.json
```

A session with minutes of video produces a very large log, one line per frame.
Add `--brief` to collapse each run of media-only messages into one summary line
(the first message of a run, which carries the XML, stays in full); that log is
the one to share. To look closer at a stretch, `--messages 120-180` writes only
those message indexes of each connection, in full.

Without `BAICHUAN_PASSWORD` the tool asks for the password. If the NVR and the
Doorbell use different accounts, give each: `--user admin --user
viewer:other-password` (a `name:password` form carries its own password). The
tool tries every account on every connection and says which one matched.

The summary at the top of the log says, per connection, whether the login was
verified, the device type and model from the login response, any gaps in the
capture, and the media streams seen. If it says "no login seen", the capture
started after the client connected: capture again.

Battery cameras such as the Doorbell speak Baichuan over UDP even when added by
IP address. The tool decodes that too (reolink-aio's UDP framing: the connect
exchange on port 2015, whose reply carries the login nonce, then the message
stream in numbered chunks); such a conversation is shown as "over UDP". Only
traffic that uses neither framing, such as a cloud relay, is left undecoded.

Share only the `.log.txt` (and, if you like, the `.log.json`). If your Mac is
connected to the Claude session through Remote Control, the tool can be run there
instead and only the log leaves the machine.

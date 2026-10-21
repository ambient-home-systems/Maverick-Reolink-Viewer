# Desktop playback check, without clicking

Runs the panel's playback check (Playback tab → Debug → **Run playback
check**) in Google Chrome on your computer, for one camera, through each
address you give: on the LAN, through Tailscale, through Nabu Casa. It prints
the progress and the summary, and saves each report to `reports/`. The
reports are also saved in Home Assistant (Debug → **Saved reports**).

The iPhone runs still happen in the Companion app (one tap each): this
measures desktop Chrome only.

## Once

1. Node 22.12 or newer and Google Chrome.
2. In this folder: `npm install` (Playwright's library only; it drives your
   installed Chrome and downloads no browser).
3. In Home Assistant: your profile → **Security** → **Long-lived access
   tokens** → **Create token**. Copy it. You can delete it there after the
   runs.

## Each run

```sh
export HA_TOKEN='paste the token'
node run-check.mjs --camera "Front Yard Right" \
  --url http://homeassistant.local:8123 \
  --url https://<name>.<tailnet>.ts.net \
  --url https://<id>.ui.nabu.casa
```

Each address is opened in a fresh browser profile, logged in with the token,
and the camera's Playback tab runs the check. Leave the Chrome window alone
until it closes: the check measures playback rates with the page in front.

| Option | Meaning |
| --- | --- |
| `--url <address>` | Home Assistant as this computer reaches it; repeat for each path. The setup (LAN, Tailscale, Nabu Casa) is told from the address. |
| `--camera <name>` | The camera (default: the first that records). |
| `--session <minutes>` | Then play for that long (memory and disk), on the first address only. |
| `--hd local\|all\|none` | Switch to HD and back: on the LAN only (default), everywhere, or never. HD makes the server fetch a main recording from the NVR (up to 3.8 GB for an hour, over your LAN). |
| `--browser chrome\|msedge\|chromium` | Chrome by default. Playwright's own Chromium has no H.264, so recordings would not play in it. |
| `--headless` | No window (the check then cannot tell whether the page is in front). |
| `--out <folder>` | Where to save the reports (default `reports`). |

The token goes only to the addresses given, kept in the browser's memory for
the run (nothing is written to disk). Without `HA_TOKEN`, or with a wrong
one, the run stops at the login.

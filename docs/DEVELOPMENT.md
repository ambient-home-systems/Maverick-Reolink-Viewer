# Development

## Layout

```
custom_components/reolink_viewer/
  manifest.json      # depends on reolink, ffmpeg, frontend, http, panel_custom, websocket_api
  __init__.py        # setup: compat check, scheduler, static path, sidebar panel
  config_flow.py     # single instance, no options
  const.py
  bridge.py          # ONLY module that touches the Reolink integration's internals
  devices.py         # device model: hosts, cameras (duplicates merged), entities
  catalog.py         # loads catalog/*.json; catalog keys for entities
  catalog/           # categories.json, settings-catalog.json (keyed by domain, key)
  scheduler.py       # per-host queue: concurrency limit, priorities, de-duplication
  media.py           # ffmpeg time-to-first-frame, HTTP first byte / ranged and paced GET
  mp4.py             # minimal MP4 box reader (layout from a few Range requests)
  probe.py           # Phase 0 hardware probe
  probe_playback.py  # Phase 2 gate: recording playback check (opt-in probe section)
  timeconv.py        # camera-local time -> UTC (device DST rules, repeated-hour hints)
  timeline.py        # day/month timelines: permanent cache for past days, 60 s for today
  vodcache.py        # disk cache of recordings: fills under the stream budget, LRU
  mp4index.py        # writes a sidx index into cached recordings (fast browser seeks)
  fmp4.py            # indexes a cached recording's fragments as it grows; makes each MSE-ready
  remux.py           # rewrites cached recordings as plain MP4 with ffmpeg (the file player)
  thumbnails.py      # recording thumbnails: time buckets, de-duplication, disk LRU
  checks.py          # saved check reports, playback and live (a phone's run, read on a desktop)
  views.py           # /mse (HA auth) and signed, short-lived /vod, /clip, /thumb URLs (no camera URLs)
  websocket_api.py   # status, devices, catalog, probe, timeline/*, playback/*, thumbnail/*
  live/              # live view (Phase 3):
    binary.py        #   go2rtc: HA's binary, else a pinned download (SHA-256 checked)
    go2rtc.py        #   our go2rtc: config (no secrets), supervision, its API
    streams.py       #   camera streams registered at runtime, held against the stream budget
    relay.py         #   the key-frame cache: one shared MSE feed per stream; keep warm
    images.py        #   each camera's last picture, taken while a live page watches
    warm.py          #   keeps warm what the cameras' keep-warm switches ask for
    service.py       #   the above per entry; WebRTC sessions
    views.py         #   signed MSE websocket (from the cache), frames and pictures
    websocket.py     #   live/* commands (WebRTC signaling, pictures, keep warm, capacity test)
    capacity.py      #   how many streams a host serves at once
  switch.py          # a "keep live view warm" switch per mains-powered camera
  models.py          # runtime data of the config entry
  translations/en.json
  frontend_dist/     # built panel bundle (committed; CI checks it matches the source)
frontend/            # Lit + TypeScript panel, built with Vite
  src/components/    # device list, device page, overview, settings, playback tab,
                     # live grid and Live tab (live-grid.ts) with their tiles (live-tile.ts)
  src/playback/      # timeline canvas + math, calendar, event list, player (MSE feeder in
                     # mse-feeder.ts, else a file URL), codec checks, the playback check
                     # (check.ts) and its MSE probe (mse-probe.ts, mse-sample.ts)
  src/live/          # the live sessions: WebRTC (ours and HA's), MSE over the signed
                     # websocket (session.ts); the player that keeps one playing
                     # (player.ts); what the live views share (data.ts); which stream
                     # full screen plays in HD (hd.ts); the live check
tests/               # pytest-homeassistant-custom-component; test_mse_browser.py and
                     # test_live_browser.py drive Playwright's Chromium (mse_append.cjs,
                     # live_browser.cjs, live_grid_browser.cjs: the panel's grid);
                     # go2rtc_fixtures.py runs go2rtc and a fake camera
scripts/             # setup_dev.sh, probe_to_matrix.py, make_mse_sample.py (writes mse-sample.ts),
                     # fetch_go2rtc.py (the pinned go2rtc for the tests);
                     # playback_check.js and inspect_recording.js (paste into the browser console);
                     # desktop-check/ runs the playback check in Chrome without clicking
```

## Environment

Python 3.14.2+ (Home Assistant's minimum), [uv](https://docs.astral.sh/uv/) and
Node 22.12+.

```bash
scripts/setup_dev.sh
source .venv/bin/activate
```

`requirements_test.txt` pins `pytest-homeassistant-custom-component` to the Home
Assistant release we test against (currently 2026.10.1), plus the requirements of the
HA components we load in tests (the Reolink integration's `reolink-aio`, `ha-ffmpeg`,
the frontend, camera and stream packages).

## Checks (all run in CI)

```bash
ruff check . && ruff format --check . && mypy
pytest --cov
cd frontend && npm run lint && npm run typecheck && npm test && npm run build
```

`npm run build` writes `custom_components/reolink_viewer/frontend_dist/`. Commit the
result: HACS installs the repository as-is, and CI fails if the committed bundle is
stale. The build is deterministic.

Hassfest runs in CI through `home-assistant/actions/hassfest`. To run it locally,
check out HA core at the tested tag and run, from that checkout, in a venv with its
`requirements.txt` installed:

```bash
python -m script.hassfest --action validate \
  --integration-path /path/to/repo/custom_components/reolink_viewer
```

## Tests

The live tests run go2rtc itself and a fake camera (go2rtc serving ffmpeg's test
sources). They are skipped without a go2rtc binary; CI fetches the pinned one and
fails instead of skipping (`RV_GO2RTC_TESTS=1`). To run them locally:

```bash
export RV_GO2RTC=$(python -m scripts.fetch_go2rtc .cache/go2rtc)
pytest tests/test_live_go2rtc.py tests/test_live_browser.py
```

Tests set up HA's real Reolink integration on a mocked `reolink_aio.api.Host`.
`tests/ha_reolink_mock.py` is a verbatim copy of `_init_host_mock` from HA core's
`tests/components/reolink/conftest.py` (re-sync it when bumping the HA pin);
`tests/conftest.py` adds what the bridge and the probe read. Media tests run real
ffmpeg against a generated clip when ffmpeg is installed and skip otherwise.

## Settings catalog

`catalog/settings-catalog.json` explains every entity of HA's Reolink integration;
`catalog/categories.json` puts each in a category. Both are keyed by domain, then
translation_key. `tests/test_catalog.py` loads the installed integration's
`strings.json` and entity descriptions and fails on any key missing from either
file, so bumping the HA pin surfaces new settings. Add an entry for each new key,
checked against HA's Reolink docs, the reolink-aio source and Reolink's support
articles; mark it `"verification": "unverified"` if its effect isn't documented.

## Trying it on a real Home Assistant

Copy (or symlink) `custom_components/reolink_viewer` into the HA config directory's
`custom_components/`, restart HA, then add **Reolink Viewer** under
Settings → Devices & services. The sidebar gets a **Reolink** entry.

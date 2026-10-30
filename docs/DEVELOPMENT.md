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
  events.py          # a day's events across cameras (the timetables), the days with
                     # recordings (events/days) and, per Home Assistant user, which are
                     # new (events/recent, events/seen)
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
    soak.py          #   the soak run and samples of what live view holds, for the soak report
    service.py       #   the above per entry; WebRTC sessions
    views.py         #   signed MSE websocket (from the cache), frames and pictures
    websocket.py     #   live/* commands (WebRTC signaling, pictures, keep warm, capacity test)
    capacity.py      #   how many streams a host serves at once
  switch.py          # a "keep live view warm" switch per mains-powered camera
  models.py          # runtime data of the config entry
  translations/en.json
  frontend_dist/     # built panel bundle (committed; CI checks it matches the source)
frontend/            # Lit + TypeScript panel, built with Vite
  src/styles.ts      # the Timetable's tokens (light and dark) and shared element styles
  src/icons.ts       # drawn icons; src/fonts.ts loads Barlow from public/fonts (OFL)
  src/plain.ts       # what a check found, in plain words ("In short"), shown by
                     # components/findings.ts and written at the top of each report
  src/views.ts       # the views loaded on demand (the home view is the only one in
                     # the first download; see Performance budget)
  src/pip.ts         # picture-in-picture (the standard API, else WebKit's)
  src/network.ts     # where the page is (home or away) and HD in full screen there
  src/integration.ts # when Reolink Viewer cannot reach the cameras, in plain words,
                     # and why a view's data could not load
  src/problem.ts     # a problem banner: plain words, what to do, More help, Details
  src/help.ts        # links to the user docs of this release (src/version.ts)
  scripts/bundle-budget.mjs  # the home view's size against its budget (npm run budget)
  preview/           # the design preview: the panel on a fake hass (see Design preview)
  src/components/    # device list, device page, overview, settings, playback tab,
                     # live grid and Live tab (live-grid.ts) with their tiles (live-tile.ts),
                     # the timetable of a day's events (timetable.ts), under the board and
                     # in the Events view (events-view.ts)
                     # and the camera's controls (live-controls.ts) and debug view
                     # (live-debug.ts) over them; the soak report (live-soak.ts)
  src/playback/      # timeline canvas + math, calendar, event list, player (MSE feeder in
                     # mse-feeder.ts, else a file URL), codec checks, the playback check
                     # (check.ts) and its MSE probe (mse-probe.ts, mse-sample.ts); why
                     # recordings cannot be read or played, in plain words (explain.ts)
  src/live/          # the live sessions: WebRTC (ours and HA's), MSE over the signed
                     # websocket (session.ts); the player that keeps one playing
                     # (player.ts); what the live views share (data.ts); which stream
                     # full screen plays in HD (hd.ts); a tile's debug text
                     # (debug.ts); why video cannot play, in plain words (explain.ts);
                     # the soak report's text (soak.ts) and what a page
                     # counts for the soak run (soak-tally.ts); the live check
tests/               # pytest-homeassistant-custom-component; test_mse_browser.py and
                     # test_live_browser.py drive Playwright's Chromium (mse_append.cjs,
                     # live_browser.cjs, live_grid_browser.cjs: the panel's grid);
                     # go2rtc_fixtures.py runs go2rtc and a fake camera
scripts/             # setup_dev.sh, probe_to_matrix.py, make_mse_sample.py (writes mse-sample.ts),
                     # build_release.py (the release package), bump_version.py,
                     # ha_requirements.py (what a Home Assistant release pins for us),
                     # fetch_go2rtc.py (the pinned go2rtc for the tests);
                     # playback_check.js and inspect_recording.js (paste into the browser console);
                     # desktop-check/ runs the playback check in Chrome without clicking;
                     # baichuan/ turns a Wireshark capture of the Reolink client into a
                     # redacted Baichuan message log (Phase 5a, see its README);
                     # scrub_check.cjs drags the preview's timeline and counts long
                     # tasks, then pinches it with touch on a phone-sized page;
                     # a11y_check.cjs checks every view with axe-core and the keyboard
```

## Environment

Python 3.14.2+ (Home Assistant's minimum), [uv](https://docs.astral.sh/uv/) and
Node 22.12+.

```bash
scripts/setup_dev.sh
source .venv/bin/activate
```

`requirements_test.txt` pins `pytest-homeassistant-custom-component` to the newest
Home Assistant release we test against (currently 2026.10.4), plus the requirements of
the HA components we load in tests (the Reolink integration's `reolink-aio`,
`ha-ffmpeg`, the frontend, camera and stream packages), as that release pins them.

## Checks (all run in CI)

```bash
ruff check . && ruff format --check . && mypy
pytest --cov
cd frontend && npm run lint && npm run typecheck && npm test && npm run build && npm run budget
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

## Design preview

The panel without Home Assistant or cameras, for designing and checking every view:
`frontend/preview/` mounts the real panel on a fake `hass` with the owner's eight
cameras, every setting and a day of events. Its pictures are synthetic. Add
`?offline=cam-dogs,cam-garage` for cameras Home Assistant cannot reach,
`?disk=cam-door,dev-nvr` for the Doorbell's SD card or the NVR's disk not ready,
`?degraded=changed|stopped|none` for Reolink Viewer unable to reach the cameras,
and `?fail=board,events,day,tiles,devices` to fail those requests.

```bash
frontend/preview/make-media.sh                     # once: the synthetic pictures (ffmpeg)
cd frontend && npx vite build -c vite.preview.config.ts
node ../scripts/preview_capture.cjs <out-dir> [view ...]   # light and dark, desktop and phone
node ../scripts/preview_capture.cjs <out-dir> errors       # every error state
node ../scripts/preview_capture.cjs ../docs/images guide   # the user docs' pictures
```

The design's direction contract is in `.impeccable/surfaces/`; `PRODUCT.md` holds
who the panel is for.

## Performance budget

Phase 4 step 2 set three limits; the first two run in CI.

- **What the home view downloads stays under 200 KB gzipped.** The entry
  (`reolink-viewer-panel.js`) imports one file holding the home view: the band, the
  live board and today's timetable. Every other view (Events, Devices, a device page
  and each of its tabs, the checks) is its own file, loaded the first time it is
  shown (`src/views.ts`, `TAB_LOADERS` in `components/device-page.ts`). If one fails
  to load, the view says so with **Try again**. `npm run budget` prints the home
  view's size, what each other view adds, and fails over the budget.
- **Scrubbing the timeline never blocks the page for more than 50 ms.** With the
  design preview built:

  ```bash
  cd frontend && NODE_PATH="$(npm root -g)" node ../scripts/scrub_check.cjs
  ```

  drags along the Playback timeline and hovers over it in Chromium, and counts the
  long tasks. It fails on any on a desktop (a pass that has some is scrubbed again on
  a fresh page, and fails only if that one has some too: shared CI machines stall a
  single task now and then, a slow timeline blocks every pass); with the processor
  slowed 4× (desktop
  and phone sizes) it reports them only, as shared CI machines vary. Then it pinches
  the timeline with two fingers (Chromium's touch input, phone size) and fails if it
  did not zoom in.
- **Time to first frame** is measured on the owner's hardware by the live check and
  the playback check; the figures are in `docs/IMPLEMENTATION_PLAN.md` (Phase 4,
  "Step 2: the performance budget").

## Accessibility

Every view meets WCAG 2.1 AA and works from the keyboard (Phase 4 step 5); CI checks
it in its own job. With the design preview built:

```bash
cd frontend && NODE_PATH="$(npm root -g)" node ../scripts/a11y_check.cjs [--tabs]
```

runs axe-core (WCAG 2.1 A and AA, through the shadow roots, contrast included) on
every view and state, light and dark, desktop and phone, then presses Tab through
each view: whatever it reaches must have a name and show its focus. `--tabs`
prints each view's Tab order with the names a screen reader reads.
`src/motion.test.ts` fails if a component animates without a
`prefers-reduced-motion` rule that stops it.

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

## User docs

`docs/user-guide.md`, `docs/troubleshooting.md` and `docs/cameras.md` are for the
people who use the panel: plain words, no internals. The panel links to them for the
release it belongs to (`src/help.ts`: **Devices → Help**, and **More help** on its
messages). `src/help.test.ts` keeps them in step with the panel:

- every section the panel links to is in the docs;
- every message the panel can show (`live/explain.ts`, `playback/explain.ts`,
  `integration.ts`, the tiles' words and the storage and no-recordings notes) is in
  `troubleshooting.md`, word for word, so a user can search for the one they see;
- every link and picture in the docs leads somewhere.

So a new or reworded message needs its entry in `troubleshooting.md`. When a view
changes, take the docs' pictures again (Design preview, `guide`): they are the
preview with its sample cameras, at 21:30 on its day.

## Home Assistant versions

CI runs the whole test suite against:

- **the pinned release** (`requirements_test.txt`), the newest tested;
- **the oldest supported release** (`hacs.json`'s `homeassistant`, 2026.10.1): its
  `pytest-homeassistant-custom-component` is in the `pytest` job's matrix, and
  `scripts/ha_requirements.py` installs what that release pins for the Reolink,
  ffmpeg, frontend, camera and stream components (reolink-aio above all);
- **the newest release**, every week, non-blocking: it warns before users meet a
  Home Assistant release that changed the Reolink integration.

To move the pin to a newer release (each `pytest-homeassistant-custom-component`
version names its Home Assistant release on PyPI):

```bash
pip install pytest-homeassistant-custom-component==<version>
pip install $(python -m scripts.ha_requirements)
pytest
```

then put those versions in `requirements_test.txt`, with the release in its first
comment; `tests/test_packaging.py` fails if the two disagree. To raise the oldest
supported release, change `hacs.json`, the README's "Requires Home Assistant" and
the matrix's entry together (the same test checks they agree).

## Releasing

1. Set the version everywhere: `python -m scripts.bump_version 0.33.0` (the
   manifest, `frontend/package.json` and its lockfile, and the panel's
   `src/version.ts`, which its reports and its help links use).
2. Add its entry to `CHANGELOG.md`, in plain words: it becomes the release's notes.
3. `cd frontend && npm run build`, commit, and merge to main once CI is green.
4. On GitHub: **Actions → Release → Run workflow** (tick **Dry run** first to see
   it through without publishing). It runs CI on main, packages the integration
   (`scripts/build_release.py`: the versions agree, the changelog has the entry, the
   built panel is whole), and makes the release `v0.33.0` with
   `reolink_viewer.zip` attached and the changelog entry as its notes. HACS offers
   it as an update from then on.

CI packages the integration on every change too, so a release finds no surprise.

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

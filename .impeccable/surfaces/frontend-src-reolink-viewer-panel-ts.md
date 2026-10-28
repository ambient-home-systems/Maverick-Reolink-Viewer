---
version: 1
slug: "frontend-src-reolink-viewer-panel-ts"
primary_target: "frontend/src/reolink-viewer-panel.ts"
related_targets: ["frontend/src/components/live-grid.ts","frontend/src/components/device-list.ts","frontend/src/components/device-page.ts","frontend/src/components/playback.ts"]
---

# Reolink Viewer panel

Scope: the whole sidebar panel (home view, events, devices, device page with
overview, settings, playback and live, the live check and soak report).
Mode: Operate.

Audience: Reolink owners on HACS, one camera to several NVRs and hubs, on the
iPhone Companion app and desktop about equally, at home and away.
Jobs, in order: glance at every camera live; review today's events and
recordings. Then settings and camera health.
Constraints: CLAUDE.md rules (camera URLs never reach the browser, HA state is
the truth); initial JS under 200 KB gzipped with other views code-split; no
long task over 50 ms while scrubbing; keyboard and labels throughout; reduced
motion respected. Wrong if it reads as a generic dashboard.

Use scene: in the evening on a phone when the doorbell rings, at a desk in the
day. Video always sits on a dark board; the timetable follows Home
Assistant's light or dark mode (paper by day, departure-board navy by night).
It does not take Home Assistant's theme colours.

## Direction contract

THESIS: The house runs on a timetable. Cameras play on a dark board, and
today's events arrive below as departures: big times, numbered platforms and
a red "now" line. It refuses the card dashboard: soft cards, chips, a
theme-blue header and grey badges.

OWN-WORLD: The shell band is railway blue #1B2A6E. The live board is ink
#111418. The timetable is paper #F4F4F1, or departure navy #0E1530 in dark
mode. Signal red #E10600 means only "now" and "new". One action blue
(#2140C4 on paper, #8FA6FF on navy) marks only what can be pressed.

Type is Barlow, with Barlow Semi Condensed for times and numbers, all in
tabular figures. Square platform chips carry camera numbers. Rows are ruled,
with no cards and no radius over 2px. Hierarchy comes from scale contrast.
Pictograms are drawn per detection type. Tile states use a fixed vocabulary:
Live, Starting, Picture hh:mm, Asleep, Offline, Waiting for a slot.

STORY: The owner opens Reolink and every camera is already playing. Below
the board, today reads like a departure board: what happened, where, and how
long. Events not yet seen stay lit. One tap on a row plays that recording. A
tap on a tile goes full screen. Devices and their settings are one tab away.

FIRST VIEWPORT:

- Desktop, 1440:
  - A 64px band holds the title, the Live, Events and Devices tabs, and a
    32px clock on the right.
  - The board shows "Live" with playing counts and a Full screen control.
  - Tiles are packed by camera shape on 5 columns: the doorbell runs tall
    and panoramas run wide. Each tile has its number chip at top left, its
    state at top right, and its name at bottom left.
  - Below the board, the paper timetable shows "Today" with its count, a
    camera filter and All events.
  - Then come column labels, the red "21:24 now" line, and rows: a 32px
    time, the pictogram and type, the platform chip and camera, the length,
    and a thumbnail.
- iPhone, 390:
  - A 56px band, with a 44px tab row beneath it.
  - A two-column board.
  - Rows show the time, then type over camera and length, then the
    thumbnail.

The primary actions are tapping an event row and tapping a tile.

Signature interaction: an unseen event stays lit red until it is opened. The
"now" line follows the clock, and a new event slides in under it. With
reduced motion it appears without sliding.

FORM: Swiss railway timetable and departure board. It is fourth on my
ordered list and was assigned by the roll. seed:7a12c38cdc815d8c.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- A cross-camera event feed needs a server command (today the timeline is per
  camera).
- How many cameras before the board pages or scrolls on a phone.

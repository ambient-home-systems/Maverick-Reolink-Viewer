---
name: Reolink Viewer
description: A Home Assistant sidebar panel for Reolink cameras, built as a railway timetable with a live departure board.
colors:
  rail-blue: "#1b2a6e"
  on-rail: "#f4f4f1"
  on-rail-muted: "#b4bbd3"
  platform-navy-dark: "#3349a8"
  recording-blue-dark: "#5a6cb4"
  board-ink: "#111418"
  on-board: "#f4f4f1"
  on-board-muted: "#a9b0c4"
  paper: "#f4f4f1"
  paper-2: "#e9e9e4"
  paper-text: "#111418"
  paper-muted: "#5d6370"
  paper-rule: "rgba(17, 20, 24, 0.14)"
  paper-rule-strong: "#111418"
  departure-navy: "#0e1530"
  departure-navy-2: "#18224a"
  navy-text: "#eef0f6"
  navy-muted: "#9aa3c0"
  navy-rule: "rgba(238, 240, 246, 0.16)"
  navy-rule-strong: "#eef0f6"
  signal-red: "#e10600"
  signal-red-dark: "#ff4a3d"
  action-blue: "#2140c4"
  on-action: "#ffffff"
  action-blue-dark: "#8fa6ff"
  on-action-dark: "#0e1530"
  fault-amber: "#f2b100"
  on-fault: "#111418"
  fault-ink: "#8a5a00"
typography:
  display:
    fontFamily: "Barlow Semi Condensed, Barlow, system-ui, sans-serif"
    fontSize: "32px"
    fontWeight: 600
    lineHeight: 1
    fontFeature: "\"tnum\""
  clock:
    fontFamily: "Barlow Semi Condensed, Barlow, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 600
    lineHeight: 1
    fontFeature: "\"tnum\""
  headline:
    fontFamily: "Barlow Semi Condensed, Barlow, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.1
  title:
    fontFamily: "Barlow Semi Condensed, Barlow, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.15
  subtitle:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 600
  body:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    fontFeature: "\"tnum\""
  body-small:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
  label:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: "20px"
  platform:
    fontFamily: "Barlow Semi Condensed, Barlow, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1
  mono:
    fontFamily: "ui-monospace, SF Mono, Menlo, Consolas, monospace"
    fontSize: "12.5px"
    lineHeight: 1.55
rounded:
  none: "0px"
  knob: "1px"
  sm: "2px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "14px"
  lg: "20px"
  xl: "24px"
  page-bottom: "40px"
components:
  band:
    backgroundColor: "{colors.rail-blue}"
    textColor: "{colors.on-rail}"
    typography: "{typography.title}"
    height: "64px"
    padding: "0 20px"
  band-tab:
    backgroundColor: "{colors.rail-blue}"
    textColor: "{colors.on-rail-muted}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "0 14px"
  band-tab-current:
    textColor: "{colors.on-rail}"
  button-primary:
    backgroundColor: "{colors.action-blue}"
    textColor: "{colors.on-action}"
    rounded: "{rounded.sm}"
    padding: "6px 14px"
    height: "36px"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.paper-text}"
    rounded: "{rounded.sm}"
    padding: "6px 14px"
    height: "36px"
  button-secondary-hover:
    backgroundColor: "{colors.paper-2}"
  button-text:
    textColor: "{colors.action-blue}"
    padding: "6px 4px"
  button-danger:
    backgroundColor: "{colors.fault-amber}"
    textColor: "{colors.on-fault}"
    rounded: "{rounded.sm}"
    padding: "6px 14px"
    height: "36px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.paper-text}"
    rounded: "{rounded.sm}"
    padding: "5px 8px"
  badge:
    textColor: "{colors.paper-text}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0 7px"
  badge-accent:
    backgroundColor: "{colors.action-blue}"
    textColor: "{colors.on-action}"
  badge-warning:
    backgroundColor: "{colors.fault-amber}"
    textColor: "{colors.on-fault}"
  platform-chip:
    backgroundColor: "{colors.rail-blue}"
    textColor: "{colors.on-rail}"
    typography: "{typography.platform}"
    rounded: "{rounded.none}"
    size: "26px"
  tile-number-chip:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.board-ink}"
    typography: "{typography.platform}"
    rounded: "{rounded.none}"
    size: "26px"
  filter-chip:
    textColor: "{colors.paper-text}"
    rounded: "{rounded.none}"
    padding: "0 12px 0 5px"
    height: "34px"
  filter-chip-pressed:
    backgroundColor: "{colors.paper-text}"
    textColor: "{colors.paper}"
  toggle:
    rounded: "{rounded.sm}"
    width: "46px"
    height: "26px"
  toggle-on:
    backgroundColor: "{colors.action-blue}"
    textColor: "{colors.on-action}"
  live-board:
    backgroundColor: "{colors.board-ink}"
    textColor: "{colors.on-board}"
    padding: "16px 24px 28px"
  timetable-row:
    textColor: "{colors.paper-text}"
    height: "62px"
    padding: "0 8px"
  banner-warning:
    backgroundColor: "{colors.fault-amber}"
    textColor: "{colors.on-fault}"
    padding: "12px 16px"
---

# Design System: Reolink Viewer

## Overview

**Creative North Star: "The House Timetable"**

The panel reads like a Swiss railway station (FORM seed `seed:7a12c38cdc815d8c`). A railway-blue band carries the title, the tabs and a big clock. Below it, the cameras play on an ink departure board, and the day's events run as a timetable on paper: big condensed times, numbered platforms and a red line for "now". Hierarchy comes from scale contrast and from rules between rows. It does not come from boxes, shadows or tinted cards.

The timetable follows Home Assistant's dark mode (paper by day, departure navy by night), but the panel never takes Home Assistant's theme colours. It sets its own tokens on its host and maps HA's variables onto them, so HA's own elements inside the panel fall in line. Video never follows the mode: it always sits on ink. The type is dense and tabular, and every number lines up. Words are plain: tile states, grade words and settings labels each come from a fixed, everyday vocabulary.

The build rejects the card dashboard: soft rounded cards, pill chips, a header in the theme's colour, and grey badges with no meaning.

**Key Characteristics:**
- Three fixed grounds: the rail band, the ink board and the paper (or navy) timetable.
- Ruled rows and ruled sections, with no card boxes. Corners are square or 2px.
- Barlow for words. Barlow Semi Condensed for times, numbers, titles and the clock. Tabular figures everywhere.
- Square platform chips number the cameras in the same way across the board, the timetable, the filters and device pages.
- Every colour has one meaning: red for now and new, blue for what can be pressed, amber for faults.

## Colors

The palette is railway signage: one deep rail blue, an ink board, paper, and three signal colours that each carry one meaning.

### Primary
- **Rail Blue** (rail-blue): the shell band, the platform chips and the recording spans on the playback timeline. It is the panel's identity, and it never marks an action. In dark mode, platform chips lift to **Platform Navy** (platform-navy-dark) and recordings to **Recording Blue** (recording-blue-dark) so they stay readable on navy.
- **Action Blue** (action-blue on paper, action-blue-dark on navy): marks only what can be pressed or is pressed: primary buttons, text and link buttons, focus rings, selection, switches that are on, the accent badge and HA's mapped `--primary-color`.

### Secondary
- **Signal Red** (signal-red, signal-red-dark on navy): means "now" and "new" and nothing else. It is used for the red now line across the timetable and the timeline, for the times of events that have not been opened, and for the "New" tag.

### Tertiary
- **Fault Amber** (fault-amber with on-fault text): warning and error banners, the danger button, the warning badge, the failed-search note, the error toast, and the top rule of a confirmation dialog. **Fault Ink** (fault-ink on paper; on navy it becomes fault-amber) is amber used as text: the "Slow" grade and HA's mapped `--error-color`.

### Neutral
- **Board Ink** (board-ink): the live board, the Overview snapshot frame, the empty player, toasts and the timeline's hover readout. Text on it is **On-Board** (on-board), with **On-Board Muted** (on-board-muted) for counts and notes.
- **Paper** (paper) and **Paper 2** (paper-2): the timetable ground, and the hover, report-sheet and info-banner ground on it. **Paper Text** (paper-text) is ink. **Paper Muted** (paper-muted) is used for secondary text, column labels and fact labels.
- **Departure Navy** (departure-navy) and **Navy 2** (departure-navy-2): the same roles in dark mode, with **Navy Text** (navy-text) and **Navy Muted** (navy-muted).
- **Rules**: hairlines (paper-rule or navy-rule, 1px) between rows, and strong rules (paper-rule-strong or navy-rule-strong, 1-2px) over sections, tables and outlined controls.
- **On Rail** (on-rail) and **On Rail Muted** (on-rail-muted): band text, with the current tab in full and the others muted.

### Named Rules
**The One Meaning Rule.** Red means now or new. Blue means pressable. Amber means a fault. A colour is never used for decoration or for any other meaning.

**The Own Theme Rule.** The panel sets its tokens on its host, light, or dark when HA's dark mode adds the `dark` attribute. It maps HA's variables onto those tokens and never the reverse.

**The Ink Board Rule.** Video and camera pictures always sit on board ink: the Live board, the Live tab, the Overview snapshot frame and the player, including when it is empty. They never sit on paper or navy.

## Typography

**Display Font:** Barlow Semi Condensed (with Barlow, system-ui, sans-serif)
**Body Font:** Barlow (with system-ui, sans-serif)
**Label/Mono Font:** ui-monospace, SF Mono, Menlo, Consolas (reports and logs only)

**Character:** Station signage. A sturdy grotesque for words, with its semi-condensed cut for anything you read at a glance: times, numbers, titles. Both faces are self-hosted as woff2 (weights 400/500/600 and condensed 500/600, OFL), with no CDN. The host sets `font-variant-numeric: tabular-nums`.

### Hierarchy
- **Display** (condensed 600, 32px, line-height 1): the departure times in timetable rows (24px in a narrow container). Times in the playback event list use the same style.
- **Clock** (condensed 600, 30px, line-height 1): the band clock (24px narrow) and the playback position readout.
- **Headline** (condensed 600, 28px, line-height 1.1): page titles (h1), such as the device name.
- **Title** (condensed 600, 22px, line-height 1.15): section titles (h2), the board's "Live", the band title, check headlines and dialog titles. The timetable's "Today" uses 26px.
- **Subtitle** (Barlow 600, 17px): h3 and the names in check rows.
- **Body** (Barlow 400/500, 16px): rows, camera names and lengths. Event types are 17px/500. Paragraphs stop at 72ch.
- **Body small** (Barlow 400, 15px): counts, fact rows, form labels and advice.
- **Label** (Barlow 500, 13px, 20px line): badges, tile states, column labels and the grade key. Sentence case, no tracking.
- **Platform** (condensed 600, 16px): the numbers in platform and tile chips (14px when small, 13px in narrow meta).
- **Mono** (12.5px, 1.55): `pre.report` support details and logs.

### Named Rules
**The Condensed Numbers Rule.** Every time, count chip, clock and title uses the semi-condensed face at 600. Running words use Barlow.

**The Scale Not Weight Rule.** Hierarchy comes from size steps (32, 28, 22, 17, 16, 13). Weights stay between 400 and 600.

## Layout

The page is a vertical stack: the band (64px, or 56px plus a 44px tab row when narrow), then the content. On Live and Events, the ink board and the paper timetable each run the full panel width, padded 24px (12px under 600px). Devices and device pages are centred at 1100px max with 20px/24px/40px padding and a 20px gap between sections. The finish review noted this difference and it was left as is.

The live board packs tiles by camera shape on a dense grid: a doorbell or square camera spans two rows, a panorama spans two columns, and tall cameras are placed first. Each tile has its number chip at top left, its state at top right, and its name at bottom left over a gradient.

The timetable row is a five-column grid (96px time, 1.3fr event, 1fr camera, 80px length, 104px thumbnail, 20px gaps, 62px rows). Under a 640px container it folds to time, type over platform and length, and the thumbnail. Forms and facts are two-column ruled grids (12em or 10em label, then value) and collapse to one column under 600px.

Spacing runs on 4, 8, 14, 20 and 24px, with 40px at page ends. Breakpoints: HA's `narrow`, `600px` media, a `640px` container (timetable), and a `260px` container (small tiles).

## Elevation & Depth

The system is flat. Depth comes from the three grounds (rail, ink, paper) and from rules. Sections are a 2px strong rule at the top with no box, and rows are separated by hairlines. Shadows appear only on things that float over the page.

### Shadow Vocabulary
- **Toast** (`box-shadow: 0 6px 20px rgba(0, 0, 0, 0.28)`): the bottom-centred ink toast.
- **Readout** (`box-shadow: 0 6px 18px rgba(0, 0, 0, 0.28)`): the timeline's hover time box.
- **Dialog** (`box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35)`): the settings confirmation over an ink scrim (rgba(17, 20, 24, 0.55)).

### Named Rules
**The Ruled Not Boxed Rule.** A section is a strong top rule and a row is a hairline. Nothing that sits in the flow gets a shadow or a filled card.

## Shapes

Shapes are square and rectilinear. Buttons, inputs, tiles and switches use a 2px radius. Chips, badges, tabs, rows and the band use none. The switch knob is a 1px square, and the tile's Live dot is a square. Tabs mark the current one with a 3px inset underline: on-rail in the band, ink in device tabs. Disclosures use a drawn chevron that turns 180° when open. Icons are drawn on one 24×24 grid with one stroke (1.8, round caps and joins), at 20px in buttons and 22px in rows. The detection pictograms (person, visitor, vehicle, animal, package, motion) are drawn per type.

## Components

### Buttons
- **Shape:** squared (2px), at least 36px tall, 6px 14px padding, weight 500.
- **Primary:** filled action blue with on-action text. Hover brightens it (`filter: brightness(1.1)`).
- **Secondary (default):** transparent with a 1px strong rule border and ink text. Hover fills it with paper 2.
- **Text / Link:** action-blue text with no border. Hover adds an underline (3px offset). Labels name the action.
- **Danger:** filled fault amber with on-fault text.
- **Focus:** a 2px action-blue outline at 2px offset everywhere. Inset on rows and tabs, and on-rail or paper on dark grounds.
- **Disabled:** 0.45 opacity.

### Chips
- **Platform chip:** a solid rail-blue square (26px, or 22/20px) with an on-rail condensed number. It identifies a camera wherever the camera appears.
- **Tile number chip:** the same shape in paper with ink numerals, on the board.
- **Filter chip:** square, a 1px hairline border, 34px tall, often led by a platform chip or pictogram. When pressed (`aria-pressed="true"`) it fills with ink and the text turns paper. The SD/HD segments and the playback type filters follow the same rule.

### Badges
- **Style:** plain hairline-bordered labels (13px/500, 20px line, 0 7px). **Accent** is filled action blue. **Warning** is filled amber. Plain badges in Settings carry plain words ("Asks first", "Read only", "Turned off", "Through <NVR>", "N settings").

### Cards / Containers
- **Corner Style:** none. A section is `border-top: 2px` strong rule with 14px top padding.
- **Background:** the page ground. The only filled containers are pre.report sheets (paper 2 under a strong rule), info banners (paper 2) and fault banners (amber).
- **Internal Padding:** 14px top, 4px bottom. Banners use 12px 16px.

### Inputs / Fields
- **Style:** a 1px strong rule border, 2px radius, the page ground, 5px 8px padding. Accent and caret use action blue. Checkboxes and radios are 18px.
- **Switch:** a 46×26 squared rail with an 18px muted square knob. When on, the rail fills with action blue and the knob is on-action. The knob slides 0.15s `cubic-bezier(0.16, 1, 0.3, 1)`, with no movement under reduced motion.
- **Form grid:** a ruled two-column grid, muted 15px labels, and options as `label.option` rows (32px min, nested by 28px).

### Navigation
- **Band:** a rail-blue band (64px) with the condensed 22px title, tabs (16px, on-rail-muted, then on-rail with a 3px on-rail underline when current) and the condensed clock pushed right. When narrow, the tabs wrap to a full-width 44px row of equal tabs.
- **Device tabs:** muted text over a strong bottom rule. The active tab is ink with a 3px ink underline, 44px tall, and scrolls horizontally.

### Live Board (signature)
An ink field with a condensed "Live" title, a "N of M playing" count (or "N cameras" before any plays) and a Full screen text button. Tiles are black, 2px corners, 16:9 unless packed tall or wide. The tile state label sits on 74% ink at top right and uses a fixed vocabulary (Live with a square dot, Starting, Picture hh:mm, Asleep, Offline, Waiting for a slot). Corner buttons are 34px squares on 60% ink and show on hover where the device has hover. Video fades in over 0.3s.

### Timetable (signature)
A head with "Today", the count, "Mark all seen" and "All events". Below it: a camera filter row of filter chips, muted 13px column labels over a strong rule, then a red "hh:mm now" line (condensed 15px label, then a 2px red rule). Rows show the condensed time, the pictogram and type, the platform chip and camera, the muted length and a 104×58 thumbnail. An unseen row keeps its time in signal red with a red "New" tag until it is opened. A new row arrives with a 0.5s slide from -8px (`cubic-bezier(0.16, 1, 0.3, 1)`) and appears without moving under reduced motion. The playback event list uses the same rows and tags the current row "Selected" or "Playing".

### Playback Timeline
A canvas in the panel's colours: rail-blue recording spans (recording-blue-dark on navy), ink event marks, the rest of today shaded paper 2, a 2px red now line and a 2px ink playhead under a small ink pointer. Tick labels are muted Barlow 500 at 12px over hairline ticks.

### Plain Summaries
The checks open with a condensed headline that names the slow camera when there is one. A ruled list follows, with an 86px grade column using fixed grade words: Good, Fine, Slow, Problem, Note, Not yet. **Problem** is filled amber, **Slow** is boxed in amber with fault-ink text, and **Note** and **Not yet** are muted. A 13px muted key sits under each summary, with a "Details for support" disclosure under it that opens a pre.report sheet with 24-hour stamps.

## Do's and Don'ts

### Do:
- **Do** take colours from the `--rv-*` tokens on the host, with light values and the `[dark]` overrides. Never read HA theme colours.
- **Do** put any picture or video on board ink, with a 10px ink margin around snapshots.
- **Do** number cameras with square platform chips, using the board's order everywhere.
- **Do** separate sections with a 2px strong top rule and rows with 1px hairlines.
- **Do** set times, numbers and titles in Barlow Semi Condensed 600 with tabular figures.
- **Do** show a pressed or selected filter by filling it with ink and turning its text paper.
- **Do** use the fixed vocabularies (tile states, grade words, plain settings words) and name buttons for their action.
- **Do** honour reduced motion: the arrival slide, the knob slide and the video fade all switch off.

### Don't:
- **Don't** use signal red for anything except now and new, or action blue for anything that cannot be pressed.
- **Don't** use a radius over 2px on surfaces or controls, and don't use pill chips or soft rounded cards. Round forms belong only inside the drawn icons.
- **Don't** add shadows to anything in the page flow. Shadows are for toasts, the hover readout and dialogs only.
- **Don't** use grey badges as decoration. A badge carries a plain word or a meaning colour (accent or warning).
- **Don't** place video on paper or navy, or let it follow light mode.
- **Don't** use icon fonts or text glyphs as icons. Draw them on the 24×24, 1.8-stroke grid in `icons.ts`.

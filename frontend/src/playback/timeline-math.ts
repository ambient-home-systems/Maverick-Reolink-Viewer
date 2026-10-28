// Pure timeline math: zoom levels, time <-> pixel mapping, ticks, bars and
// event navigation. All times are UTC epoch milliseconds.
import type { Segment, TimelineEvent } from "../types";

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** Zoom levels, widest first: 24 h, 6 h, 1 h, 15 min, 5 min. */
export const ZOOM_LEVELS: readonly number[] = [DAY, 6 * HOUR, HOUR, 15 * MINUTE, 5 * MINUTE];

export interface View {
  /** Time at the left edge. */
  start: number;
  /** Time span shown across the width. */
  span: number;
}

export interface Bounds {
  start: number;
  end: number;
}

export function timeToX(t: number, view: View, width: number): number {
  return ((t - view.start) / view.span) * width;
}

export function xToTime(x: number, view: View, width: number): number {
  return view.start + (x / width) * view.span;
}

/** Keep the view inside the day (a 25-hour day can still be shown whole). */
export function clampView(view: View, bounds: Bounds): View {
  const length = bounds.end - bounds.start;
  const narrowest = ZOOM_LEVELS[ZOOM_LEVELS.length - 1] ?? MINUTE;
  const span = Math.min(Math.max(view.span, narrowest), Math.max(length, narrowest));
  if (span >= length) return { start: bounds.start, span: length };
  const start = Math.min(Math.max(view.start, bounds.start), bounds.end - span);
  return { start, span };
}

/** Change the span keeping `anchor` at the same place on screen. */
export function zoomAt(view: View, span: number, anchor: number, bounds: Bounds): View {
  const ratio = (anchor - view.start) / view.span;
  return clampView({ start: anchor - ratio * span, span }, bounds);
}

/**
 * The next zoom level from any span (a pinch leaves spans between levels):
 * in (+1), the widest level narrower than it; out (-1), the narrowest wider.
 * Undefined at either end.
 */
export function stepZoom(span: number, direction: 1 | -1): number | undefined {
  const tolerance = span * 0.01;
  return direction > 0
    ? ZOOM_LEVELS.find((level) => level < span - tolerance)
    : [...ZOOM_LEVELS].reverse().find((level) => level > span + tolerance);
}

/** Centre a view on a time. */
export function centreOn(view: View, t: number, bounds: Bounds): View {
  return clampView({ start: t - view.span / 2, span: view.span }, bounds);
}

const TICK_STEPS = [
  10_000,
  30_000,
  MINUTE,
  5 * MINUTE,
  10 * MINUTE,
  15 * MINUTE,
  30 * MINUTE,
  HOUR,
  2 * HOUR,
  3 * HOUR,
  6 * HOUR,
];

/** Tick spacing: the smallest step leaving at least `minPx` between ticks. */
export function tickStep(view: View, width: number, minPx = 60): number {
  for (const step of TICK_STEPS) {
    if ((step / view.span) * width >= minPx) return step;
  }
  return TICK_STEPS[TICK_STEPS.length - 1] ?? HOUR;
}

/**
 * Tick times inside the view, aligned to the step in the display time zone
 * (`offsetAt` gives the zone's UTC offset in ms at a time).
 */
export function ticks(view: View, width: number, offsetAt: (t: number) => number): number[] {
  const step = tickStep(view, width);
  const result: number[] = [];
  const end = view.start + view.span;
  const offset = offsetAt(view.start);
  let t = Math.ceil((view.start + offset) / step) * step - offset;
  // Guard against a pathological loop if inputs are not finite.
  for (let i = 0; t <= end && i < 500; i += 1) {
    result.push(t);
    t += step;
  }
  return result;
}

export interface Bar {
  start: number;
  end: number;
}

/** Merge recordings closer than `gapPx` on screen into bars (cheap to draw). */
export function bars(segments: Segment[], view: View, width: number, gapPx = 1): Bar[] {
  const gap = (gapPx / width) * view.span;
  const viewEnd = view.start + view.span;
  const result: Bar[] = [];
  for (const seg of segments) {
    if (seg.end < view.start || seg.start > viewEnd) continue;
    const last = result.at(-1);
    if (last && seg.start - last.end <= gap) {
      last.end = Math.max(last.end, seg.end);
    } else {
      result.push({ start: seg.start, end: seg.end });
    }
  }
  return result;
}

/** The recording containing a time (segments sorted by start). */
export function segmentAt(segments: Segment[], t: number): Segment | undefined {
  let lo = 0;
  let hi = segments.length - 1;
  let found: Segment | undefined;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const seg = segments.at(mid);
    if (!seg) break;
    if (seg.start <= t) {
      if (t < seg.end) found = seg;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  // Overlapping recordings: prefer the latest one that still contains t.
  return found;
}

/** The first recording that starts after a time. */
export function segmentAfter(segments: Segment[], t: number): Segment | undefined {
  return segments.find((s) => s.start > t);
}

/** Where to play for a requested time: inside a recording, or the next one. */
export function playTarget(
  segments: Segment[],
  t: number,
): { segment: Segment; offset: number } | undefined {
  const inside = segmentAt(segments, t);
  if (inside) return { segment: inside, offset: t - inside.start };
  const next = segmentAfter(segments, t);
  return next ? { segment: next, offset: 0 } : undefined;
}

/** The events showing one of the chosen types (`shownTypes`); none chosen: all. */
export function filterEvents(events: TimelineEvent[], only: ReadonlySet<string>): TimelineEvent[] {
  if (only.size === 0) return events;
  return events.filter((e) => shownTypes(e.types).some((type) => only.has(type)));
}

/** The next event starting after `t` (plus a small step, so repeats move on). */
export function nextEvent(events: TimelineEvent[], t: number): TimelineEvent | undefined {
  return events.find((e) => e.start > t + 500);
}

export function previousEvent(events: TimelineEvent[], t: number): TimelineEvent | undefined {
  let found: TimelineEvent | undefined;
  for (const e of events) {
    if (e.start < t - 1500) found = e;
    else break;
  }
  return found;
}

/** Every Reolink VOD trigger type, most specific first, with its label. */
export const EVENT_TYPES: readonly { type: string; label: string }[] = [
  { type: "PERSON", label: "Person" },
  { type: "VEHICLE", label: "Vehicle" },
  { type: "ANIMAL", label: "Animal" },
  { type: "CROSSLINE", label: "Line crossing" },
  { type: "INTRUSION", label: "Intrusion" },
  { type: "LINGER", label: "Loitering" },
  { type: "FACE", label: "Face" },
  { type: "DOORBELL", label: "Doorbell" },
  { type: "PACKAGE", label: "Package" },
  { type: "FORGOTTEN_ITEM", label: "Item left" },
  { type: "TAKEN_ITEM", label: "Item taken" },
  { type: "CRYING", label: "Crying" },
  { type: "IO", label: "Alarm input" },
  { type: "MOTION", label: "Motion" },
  { type: "TIMER", label: "Scheduled" },
];

const TYPE_INDEX = new Map(EVENT_TYPES.map((t, i) => [t.type, i]));

/** The most specific type of an event (person before motion). */
export function primaryType(types: readonly string[]): string {
  let best: string | undefined;
  for (const type of types) {
    if (best === undefined || (TYPE_INDEX.get(type) ?? 99) < (TYPE_INDEX.get(best) ?? 99)) {
      best = type;
    }
  }
  return best ?? "MOTION";
}

export function typeLabel(type: string): string {
  return EVENT_TYPES[TYPE_INDEX.get(type) ?? -1]?.label ?? type.toLowerCase();
}

/** Types in display order, the most specific first. */
export function sortTypes(types: Iterable<string>): string[] {
  return [...types].sort((a, b) => (TYPE_INDEX.get(a) ?? 99) - (TYPE_INDEX.get(b) ?? 99));
}

/** What an event shows as having been seen: motion only when nothing more is known. */
export function shownTypes(types: readonly string[]): string[] {
  const specific = types.filter((t) => t !== "MOTION");
  return sortTypes(specific.length ? specific : types.length ? types : ["MOTION"]);
}

/** The types the day's events show (`shownTypes`), in display order. */
export function presentTypes(events: readonly { types: readonly string[] }[]): string[] {
  return sortTypes(new Set(events.flatMap((e) => shownTypes(e.types))));
}

/** Thumbnail bucket (seconds) for a zoom level: coarser when zoomed out. */
export function thumbBucket(span: number): number {
  if (span >= 6 * HOUR) return 300;
  if (span >= HOUR) return 60;
  if (span >= 15 * MINUTE) return 10;
  return 5;
}

// ---- Calendar ----

/** Weeks of a month as day numbers (null outside the month). */
export function monthGrid(year: number, month: number, firstDay: number): (number | null)[][] {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); // 0 = Sunday
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lead = (first - (firstDay % 7) + 7) % 7;
  const cells: (number | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ];
  while (cells.length % 7) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function addMonths(year: number, month: number, delta: number): [number, number] {
  const index = year * 12 + (month - 1) + delta;
  return [Math.floor(index / 12), (index % 12) + 1];
}

export function isoDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

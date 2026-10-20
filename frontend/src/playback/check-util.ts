// Pure helpers of the playback check (playback/check.ts): how the page is
// reached, what the browser is, and the arithmetic of the report.
import type { Segment, TimelineEvent } from "../types";

/** How Home Assistant is reached, from the page's host name (never reported). */
export function classifyHost(hostname: string): string {
  const host = hostname.toLowerCase();
  if (host.endsWith(".ui.nabu.casa")) return "Nabu Casa";
  if (host.endsWith(".ts.net")) return "Tailscale";
  const ip = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(host);
  if (ip) {
    const [a = 0, b = 0] = ip.slice(1, 3).map(Number);
    // Tailscale hands out addresses in 100.64.0.0/10.
    if (a === 100 && b >= 64 && b < 128) return "Tailscale";
    if (a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b < 32)) return "local";
    return "remote";
  }
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".lan") || !host.includes(".")) {
    return "local";
  }
  // A name of your own: through a proxy, a tunnel or local DNS, it cannot tell.
  return "own domain";
}

/** A short name for the browser, e.g. "Chrome 141 (macOS)" or "iOS 18.1 app". */
export function browserLabel(userAgent: string): string {
  const app = /Home ?Assistant\/([\d.]+)/i.exec(userAgent);
  const ios = /(?:iPhone|iPad|iPod).*? OS (\d+)[_.](\d+)/.exec(userAgent);
  if (ios) {
    const version = `${ios[1]}.${ios[2]}`;
    if (app) return `iOS ${version}, Companion app ${app[1]}`;
    if (/CriOS/.test(userAgent)) return `iOS ${version}, Chrome`;
    if (/Safari\//.test(userAgent)) return `iOS ${version}, Safari`;
    return `iOS ${version}, web view`;
  }
  const os = /Mac OS X/.test(userAgent)
    ? "macOS"
    : /Windows/.test(userAgent)
      ? "Windows"
      : /Android/.test(userAgent)
        ? "Android"
        : /Linux/.test(userAgent)
          ? "Linux"
          : "?";
  const edge = /Edg\/(\d+)/.exec(userAgent);
  if (edge) return `Edge ${edge[1]} (${os})`;
  const chrome = /(?:Chrome|Chromium)\/(\d+)/.exec(userAgent);
  if (chrome) return `${/HeadlessChrome/.test(userAgent) ? "Headless Chrome" : "Chrome"} ${chrome[1]} (${os})`;
  const firefox = /Firefox\/(\d+)/.exec(userAgent);
  if (firefox) return `Firefox ${firefox[1]} (${os})`;
  const safari = /Version\/([\d.]+).*Safari/.exec(userAgent);
  if (safari) return `Safari ${safari[1]} (${os})`;
  if (app) return `Companion app ${app[1]} (${os})`;
  return `unknown browser (${os})`;
}

export const ms = (value: number | undefined): string => (value === undefined ? "–" : `${Math.round(value)} ms`);

export const mb = (bytes: number | undefined): string =>
  bytes === undefined
    ? "–"
    : Math.abs(bytes) >= 1e9
      ? `${(bytes / 1e9).toFixed(2)} GB`
      : `${(bytes / 1_000_000).toFixed(1)} MB`;

/** "45 s" or "12.5 min". */
export function span(value: number): string {
  return value < 60_000 ? `${Math.round(value / 1000)} s` : `${(value / 60_000).toFixed(1)} min`;
}

/** A recording long enough to need a deep start (continuous cameras). */
export const LONG_RECORDING_MS = 20 * 60_000;

/**
 * Where to start "deep" inside a recording: the latest event between `from`
 * and `to` (fractions of its length), else the point at `fallback`.
 */
export function deepTarget(
  segment: Segment,
  events: readonly TimelineEvent[],
  from: number,
  to: number,
  fallback: number,
): { time: number; event: TimelineEvent | undefined } {
  const length = segment.end - segment.start;
  const lo = segment.start + length * from;
  const hi = segment.start + length * to;
  const inside = events.filter((e) => e.start >= lo && e.start <= hi);
  const event = inside.at(-1);
  return { time: event ? event.start : Math.round(segment.start + length * fallback), event };
}

/** Long recordings of a day, newest first, without one still being written. */
export function longRecordings(segments: readonly Segment[], now: number): Segment[] {
  return segments
    .filter((s) => s.end - s.start >= LONG_RECORDING_MS && now - s.end > 60_000)
    .sort((a, b) => b.start - a.start);
}

/** Pairs of touching recordings (gap under 2 s), shortest first one first. */
export function touchingPairs(segments: readonly Segment[]): [Segment, Segment][] {
  const pairs: [Segment, Segment][] = [];
  segments.forEach((a, i) => {
    const b = segments.at(i + 1);
    if (b && b.start - a.end < 2000) pairs.push([a, b]);
  });
  return pairs.sort((p, q) => p[0].end - p[0].start - (q[0].end - q[0].start));
}

export interface RateSample {
  rate: number;
  /** What the element reported after the rate was set (it may clamp). */
  applied: number;
  wallMs: number;
  mediaS: number;
  /** Frames painted, counted with requestVideoFrameCallback (or undefined). */
  painted: number | undefined;
  /** Longest wait between two painted frames. */
  maxGapMs: number | undefined;
  decoded: number | undefined;
  dropped: number | undefined;
  stalls: number;
  stalledMs: number;
  ended: boolean;
  /** Whether the page had focus and was visible the whole time. */
  focused: boolean;
}

/** Frames per second of the recording, from the frames that went by. */
export function sourceFps(sample: RateSample): number | undefined {
  return sample.decoded && sample.mediaS > 0 ? sample.decoded / sample.mediaS : undefined;
}

/** One report line for a playback rate. */
export function describeRate(sample: RateSample): string {
  const effective = sample.wallMs > 0 ? (sample.mediaS * 1000) / sample.wallMs : 0;
  const parts = [`${effective.toFixed(2)}× effective`];
  if (sample.applied !== sample.rate) parts.push(`browser set ${sample.applied}×`);
  const fps = sourceFps(sample);
  if (sample.painted !== undefined) {
    const painted = `${((sample.painted * 1000) / sample.wallMs).toFixed(0)} fps painted`;
    parts.push(fps ? `${painted} of ${(fps * sample.rate).toFixed(0)}` : painted);
  }
  if (sample.maxGapMs !== undefined) parts.push(`longest frame gap ${Math.round(sample.maxGapMs)} ms`);
  if (sample.decoded !== undefined && sample.dropped !== undefined) {
    const share = sample.decoded ? ((sample.dropped * 100) / sample.decoded).toFixed(1) : "0.0";
    parts.push(`dropped ${sample.dropped} of ${sample.decoded} frames (${share} %)`);
  }
  parts.push(`${sample.stalls} stalls${sample.stalls ? ` (${Math.round(sample.stalledMs)} ms)` : ""}`);
  if (sample.ended) parts.push("the file ended");
  if (!sample.focused) parts.push("PAGE NOT IN FRONT");
  return `${String(sample.rate).padStart(3)}×: ${parts.join(", ")}`;
}

/** How "smooth" is judged, for the report. */
export const SMOOTH_RULE =
  "on pace (±10 %), stalls under 100 ms, no frame gap over 2.5 frames (250 ms at least); below 50 fps to show, ≤ 2 % dropped";
/** Stalls shorter than this in total are not counted against smoothness. */
export const STALL_ALLOWANCE_MS = 100;

/**
 * Whether a rate played smoothly. Above the display's refresh rate a browser
 * must skip frames, so dropped frames count only below 50 frames a second.
 */
export function smooth(sample: RateSample): boolean {
  const effective = sample.wallMs > 0 ? (sample.mediaS * 1000) / sample.wallMs : 0;
  if (Math.abs(effective - sample.rate) > sample.rate * 0.1 || sample.stalledMs >= STALL_ALLOWANCE_MS) return false;
  const fps = sourceFps(sample);
  const needed = fps === undefined ? undefined : fps * sample.rate;
  if (needed !== undefined && sample.maxGapMs !== undefined) {
    const allowed = Math.max(250, (2.5 * 1000) / Math.min(needed, 60));
    if (sample.maxGapMs > allowed) return false;
  }
  if (needed !== undefined && needed <= 50 && sample.decoded) {
    return (sample.dropped ?? 0) / sample.decoded <= 0.02;
  }
  return true;
}

/** Least-squares slope of `y` over `x` (per unit of x), or undefined. */
export function slope(points: readonly (readonly [number, number])[]): number | undefined {
  if (points.length < 2) return undefined;
  const n = points.length;
  const mx = points.reduce((sum, [x]) => sum + x, 0) / n;
  const my = points.reduce((sum, [, y]) => sum + y, 0) / n;
  let num = 0;
  let den = 0;
  for (const [x, y] of points) {
    num += (x - mx) * (y - my);
    den += (x - mx) ** 2;
  }
  return den ? num / den : undefined;
}

/** Seconds of media buffered in a TimeRanges-like object. */
export function bufferedSeconds(ranges: { length: number; start(i: number): number; end(i: number): number }): number {
  let total = 0;
  for (let i = 0; i < ranges.length; i += 1) total += ranges.end(i) - ranges.start(i);
  return total;
}

/** A pass/fail mark against a budget. */
export const within = (value: number | undefined, budget: number): string =>
  value === undefined ? "not measured" : `${ms(value)} ${value < budget ? "✓" : "✗"}`;

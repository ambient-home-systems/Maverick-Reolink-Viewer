// Pure helpers of the playback check (playback/check.ts): how the page is
// reached, what the browser is, and the arithmetic of the report.
import type { Segment, TimelineEvent } from "../types";

export { classifyHost } from "../network";

const isIos = (userAgent: string): boolean => /iPhone|iPad|iPod/.test(userAgent);

/** The setup a check starts on, on this device: the iPhone app on Wi-Fi, else desktop Chrome on the LAN. */
export function deviceSetup(userAgent: string): string {
  return isIos(userAgent) ? "iPhone app, Wi-Fi (local)" : "Desktop Chrome, LAN";
}

/** Whether a setup names another kind of device than this one (an iPhone setup on a Mac, or the reverse). */
export function setupMismatch(setup: string, userAgent: string): boolean {
  if (setup.startsWith("iPhone")) return !isIos(userAgent);
  if (setup.startsWith("Desktop")) return isIos(userAgent);
  return false;
}

/** A short name for the browser, e.g. "Chrome 141 (macOS)" or "iOS 18.1 app". */
export function browserLabel(userAgent: string): string {
  const app = /Home ?Assistant\/([\d.]+)/i.exec(userAgent);
  const ios = /(?:iPhone|iPad|iPod).*? OS (\d+)[_.](\d+)/.exec(userAgent);
  // WebKit's own version has stayed at 18.x since iOS 26; the app's part of
  // the user agent has the real one ("...; iOS 27.0.0)").
  const appIos = /;\s*iOS (\d+)\.(\d+)/.exec(userAgent);
  if (ios) {
    const version = appIos ? `${appIos[1]}.${appIos[2]}` : `${ios[1]}.${ios[2]}`;
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
  if (!countersAgree(sample)) parts.push("the dropped-frame counter disagrees with the frames painted: judged by those");
  if (!sample.focused) parts.push("PAGE NOT IN FRONT");
  return `${String(sample.rate).padStart(3)}×: ${parts.join(", ")}`;
}

/** How "smooth" is judged, for the report. */
export const SMOOTH_RULE =
  "on pace (±10 %), stalls under 100 ms, no frame gap over 2.5 frames (250 ms at least); below 50 fps to show, ≤ 2 % (or 1 frame) dropped, or 90 % painted where the dropped-frame counter disagrees with the frames painted";
/** Stalls shorter than this in total are not counted against smoothness. */
export const STALL_ALLOWANCE_MS = 100;

/**
 * Whether the browser's dropped-frame counter matches the frames painted
 * (requestVideoFrameCallback). Chrome on macOS counted every frame dropped
 * while all were painted; WebKit's counters lag over a few seconds.
 */
export function countersAgree(sample: RateSample): boolean {
  if (sample.painted === undefined || sample.decoded === undefined || sample.dropped === undefined) return true;
  const shown = sample.decoded - sample.dropped;
  return Math.abs(shown - sample.painted) <= Math.max(3, sample.decoded * 0.1);
}

/**
 * Whether a rate played smoothly. Above the display's refresh rate a browser
 * must skip frames, so dropped frames count only below 50 frames a second.
 * Where the dropped-frame counter disagrees with the frames painted, the
 * frames painted decide.
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
  if (needed === undefined || needed > 50) return true;
  if (!countersAgree(sample) && sample.painted !== undefined) {
    return (sample.painted * 1000) / sample.wallMs >= needed * 0.9;
  }
  if (sample.decoded) return (sample.dropped ?? 0) <= Math.max(1, sample.decoded * 0.02);
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

/** What the server says of a Reolink protocol cut (Phase 5b; cache.cut). */
export interface CutStatus {
  first_fragment_ms?: number;
  slot_ms?: number;
  /** Times it took its recording's download's stream slot (none was free). */
  borrowed?: number;
  reply_ms?: number;
  login?: string;
  login_ms?: number;
  fragments?: number;
  bytes?: number;
  complete?: boolean;
  running?: boolean;
  error?: string | null;
  mbit_s?: number | null;
  mux?: { anchor?: string | null; counter_rate?: number; rate_learned?: boolean };
}

/** The Reolink protocol's connections (playback/stats → vod.baichuan). */
export interface BaichuanStats {
  enabled: boolean;
  logged_in: number;
  logins: number;
  logouts: number;
  cuts_running: number;
}

/** Where a window came from, in words. */
export function sourceLabel(source: string | undefined): string {
  if (source === "cut") return "the Reolink protocol cut";
  if (source === "file") return "the recording's download";
  return "?";
}

/** One line on a cut: how soon its first fragment came, the login, what it got. */
export function cutReport(cut: CutStatus): string {
  const parts: string[] = [];
  if (typeof cut.first_fragment_ms === "number") parts.push(`first fragment ${Math.round(cut.first_fragment_ms)} ms`);
  if (typeof cut.slot_ms === "number") {
    parts.push(`slot ${Math.round(cut.slot_ms)} ms${cut.borrowed ? " (the download's)" : ""}`);
  }
  if (cut.login === "new") {
    parts.push(`login (an extra user)${typeof cut.login_ms === "number" ? ` ${Math.round(cut.login_ms)} ms` : ""}`);
  } else if (cut.login) {
    parts.push("login shared");
  }
  if (typeof cut.reply_ms === "number") parts.push(`reply ${Math.round(cut.reply_ms)} ms`);
  parts.push(`${cut.fragments ?? 0} fragments, ${((cut.bytes ?? 0) / 1_000_000).toFixed(1)} MB`);
  if (typeof cut.mbit_s === "number") parts.push(`${cut.mbit_s} Mbit/s`);
  parts.push(cut.error ? `error ${cut.error}` : cut.complete ? "complete" : cut.running ? "running" : "stopped");
  const mux = cut.mux;
  if (mux) {
    parts.push(`placed by ${mux.anchor ?? "?"}, counter ${mux.counter_rate ?? "?"}/s${mux.rate_learned ? " (learned)" : ""}`);
  }
  return `Reolink protocol cut: ${parts.join(", ")}`;
}

/** The Reolink protocol's logins, for the report (the extra user's coming and going). */
export function loginReport(stats: BaichuanStats | undefined): string {
  if (!stats) return "Reolink protocol: no statistics";
  if (!stats.enabled) return "Reolink protocol: off (the option is not set)";
  return (
    `Reolink protocol: ${stats.logged_in} host(s) logged in now, ${stats.logins} logins, ${stats.logouts} logouts` +
    `, ${stats.cuts_running} cuts running`
  );
}

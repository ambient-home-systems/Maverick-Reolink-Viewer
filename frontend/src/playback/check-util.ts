// Pure helpers of the playback check (playback/check.ts): how the page is
// reached, what the browser is, and the arithmetic of the report.
import type { Segment, TimelineEvent } from "../types";
import { count, type Finding } from "../plain";

export { classifyHost } from "../network";

const isIos = (userAgent: string): boolean => /iPhone|iPad|iPod/.test(userAgent);

/** The setup a check starts on, on this device: the iPhone app on Wi-Fi, else desktop Chrome on the LAN. */
export function deviceSetup(userAgent: string): string {
  return isIos(userAgent) ? "iPhone app, Wi-Fi (local)" : "Desktop Chrome, LAN";
}

/** Safari on a Mac (not Chrome, Edge or Firefox, whose user agents say "Safari" too). */
export const isMacSafari = (userAgent: string): boolean =>
  /Macintosh/.test(userAgent) && /Version\/[\d.]+.* Safari\//.test(userAgent) && !/Chrome|Chromium|Edg|Firefox|FxiOS/.test(userAgent);

/** The playback check's setup on this device: Mac Safari (v0.63.6) where it is, else as `deviceSetup`. */
export function checkSetup(userAgent: string): string {
  return isMacSafari(userAgent) ? "Mac Safari, LAN" : deviceSetup(userAgent);
}

/** Whether a setup names another kind of device than this one (an iPhone setup on a Mac, or the reverse). */
export function setupMismatch(setup: string, userAgent: string): boolean {
  if (setup.startsWith("iPhone")) return !isIos(userAgent);
  if (setup.startsWith("Desktop")) return isIos(userAgent);
  if (setup.startsWith("Mac Safari")) return !isMacSafari(userAgent);
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
  /**
   * The median step between the media times of frames painted one after the
   * other (s, requestVideoFrameCallback): the recording's frame interval
   * where no frame is skipped (v0.8.9).
   */
  frameS?: number | undefined;
}

/**
 * The recording's frame rate from the frames painted at 1× (their media
 * times a frame apart), for judging the rates where the browser's frame
 * counter cannot be trusted: the owner's iPhone (v0.8.8) counted 96 frames
 * at 0.5× for the 45 there were, and 0.5× was judged a stutter by that.
 */
export function referenceFps(results: readonly RateSample[]): number | undefined {
  const frameS = results.find((r) => r.rate === 1 && r.focused)?.frameS;
  return frameS !== undefined && frameS > 0 ? 1 / frameS : undefined;
}

/**
 * Frames per second of the recording: from the frames that went by, or,
 * where the counter disagrees with the frames painted, the `reference`
 * (`referenceFps`) when there is one.
 */
export function sourceFps(sample: RateSample, reference?: number): number | undefined {
  if (reference !== undefined && !countersAgree(sample)) return reference;
  return sample.decoded && sample.mediaS > 0 ? sample.decoded / sample.mediaS : undefined;
}

/** Frames per second for the report: a decimal below 10. */
function fpsText(fps: number): string {
  return fps < 10 ? fps.toFixed(1) : fps.toFixed(0);
}

/** One report line for a playback rate (`reference`: `referenceFps` of all the rates). */
export function describeRate(sample: RateSample, reference?: number): string {
  const effective = sample.wallMs > 0 ? (sample.mediaS * 1000) / sample.wallMs : 0;
  const parts = [`${effective.toFixed(2)}× effective`];
  if (sample.applied !== sample.rate) parts.push(`browser set ${sample.applied}×`);
  const fps = sourceFps(sample, reference);
  if (sample.painted !== undefined) {
    const painted = `${fpsText((sample.painted * 1000) / sample.wallMs)} fps painted`;
    parts.push(fps ? `${painted} of ${fpsText(fps * sample.rate)}` : painted);
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
 * The rates in plain words. A browser pauses or slows a page that is not in
 * front: those rates were not measured, which is said as such, never as a
 * stutter (the owner's Mac, v0.61.1: 2× to 8× "stuttered" with the window behind).
 */
export function rateFindings(results: readonly RateSample[]): Finding[] {
  const reference = referenceFps(results);
  const measured = results.filter((r) => r.focused);
  const unmeasured = results.filter((r) => !r.focused);
  const rough = measured.filter((r) => !smooth(r, reference));
  const rates = (list: readonly RateSample[]) => list.map((r) => `${String(r.rate)}×`).join(", ");
  const findings: Finding[] = [];
  if (measured.length) {
    findings.push(
      rough.length
        ? { grade: "slow", text: `Playback stutters at ${rates(rough)} speed.` }
        : {
            grade: "good",
            text: `Slow motion and fast forward (${String(measured[0]?.rate)}× to ${String(measured.at(-1)?.rate)}×) play smoothly.`,
          },
    );
  }
  if (unmeasured.length) {
    findings.push({
      grade: "note",
      text: `Playback at ${rates(unmeasured)} was not measured: the page was not in front.`,
      advice: "Keep the page in front, and the screen on, while the check runs.",
    });
  }
  return findings;
}

/**
 * Whether a rate played smoothly. Above the display's refresh rate a browser
 * must skip frames, so dropped frames count only below 50 frames a second.
 * Where the dropped-frame counter disagrees with the frames painted, the
 * frames painted decide, against the `reference` frame rate (`referenceFps`)
 * when there is one.
 */
export function smooth(sample: RateSample, reference?: number): boolean {
  const effective = sample.wallMs > 0 ? (sample.mediaS * 1000) / sample.wallMs : 0;
  if (Math.abs(effective - sample.rate) > sample.rate * 0.1 || sample.stalledMs >= STALL_ALLOWANCE_MS) return false;
  const fps = sourceFps(sample, reference);
  const needed = fps === undefined ? undefined : fps * sample.rate;
  if (needed !== undefined && sample.maxGapMs !== undefined) {
    const allowed = Math.max(250, (2.5 * 1000) / Math.min(needed, 60));
    if (sample.maxGapMs > allowed) return false;
  }
  if (needed === undefined || needed > 50) return true;
  if (!countersAgree(sample) && sample.painted !== undefined) {
    // Most frames painted; or none skipped (no gap of two frames), whatever the count's edges (v0.8.9).
    const noneSkipped = sample.maxGapMs !== undefined && sample.maxGapMs <= (1.5 * 1000) / needed;
    return (sample.painted * 1000) / sample.wallMs >= needed * 0.9 || noneSkipped;
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
  /** Times it gave its channel to another viewer's new cut (Phase 5c). */
  gave_way?: number;
  reply_ms?: number;
  login?: string;
  login_ms?: number;
  fragments?: number;
  bytes?: number;
  complete?: boolean;
  running?: boolean;
  error?: string | null;
  mbit_s?: number | null;
  mux?: {
    anchor?: string | null;
    counter_rate?: number;
    rate_learned?: boolean;
    rate_source?: string;
    /** Blocks of another cut of the channel, still arriving, skipped (v0.63.1: at the start too). */
    foreign_skipped?: number;
  };
  /** Time the muxer took (ms, on HA's event loop; Phase 5c's host load). */
  mux_ms?: number;
}

/** The Reolink protocol's connections (playback/stats → vod.baichuan). */
export interface BaichuanStats {
  enabled: boolean;
  logged_in: number;
  logins: number;
  logouts: number;
  cuts_running: number;
  /** Why devices that refused the protocol are left alone for now (Phase 5c). */
  unsupported?: string[];
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
  if (cut.gave_way) parts.push(`gave way to another viewer ${String(cut.gave_way)}×`);
  parts.push(`${cut.fragments ?? 0} fragments, ${((cut.bytes ?? 0) / 1_000_000).toFixed(1)} MB`);
  if (typeof cut.mbit_s === "number") parts.push(`${cut.mbit_s} Mbit/s`);
  parts.push(cut.error ? `error ${cut.error}` : cut.complete ? "complete" : cut.running ? "running" : "stopped");
  const mux = cut.mux;
  if (mux) {
    // Phase 5c: a rate kept from an earlier cut of the camera is "stored".
    const source = mux.rate_source ?? (mux.rate_learned ? "learned" : "nominal");
    parts.push(`placed by ${mux.anchor ?? "?"}, counter ${mux.counter_rate ?? "?"}/s${source === "nominal" ? "" : ` (${source})`}`);
    if (mux.foreign_skipped) parts.push(`${String(mux.foreign_skipped)} blocks of another cut skipped`);
  }
  if (typeof cut.mux_ms === "number") parts.push(`mux ${Math.round(cut.mux_ms)} ms`);
  return `Reolink protocol cut: ${parts.join(", ")}`;
}

/** The Reolink protocol's logins, for the report (the extra user's coming and going). */
export function loginReport(stats: BaichuanStats | undefined): string {
  if (!stats) return "Reolink protocol: no statistics";
  if (!stats.enabled) return "Reolink protocol: off (turned off in the options)";
  return (
    `Reolink protocol: ${stats.logged_in} host(s) logged in now, ${stats.logins} logins, ${stats.logouts} logouts` +
    `, ${stats.cuts_running} cuts running` +
    (stats.unsupported?.length ? `; not supported by ${String(stats.unsupported.length)} device(s): ${stats.unsupported.join("; ")}` : "")
  );
}

// ---- F: pictures from the server (Phase 10 step 1) ----

/** `n` moments spread evenly over a day's recorded time (UTC ms). */
export function spreadMoments(segments: readonly { start: number; end: number }[], n: number): number[] {
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.end - s.start), 0);
  if (!total || n <= 0) return [];
  const moments: number[] = [];
  for (let i = 0; i < n; i += 1) {
    let left = ((i + 0.5) / n) * total;
    for (const s of segments) {
      const length = Math.max(0, s.end - s.start);
      if (left < length) {
        moments.push(Math.round(s.start + left));
        break;
      }
      left -= length;
    }
  }
  return moments;
}

/** One pass of asks: what came back for each moment, and the moments missed (UTC ms). */
export interface ScrubPass {
  answered: { ms: number; source: string; offsetMs: number }[];
  missed: string[];
  missedAt?: number[];
}

/**
 * Where a moment sits in its recording, from its nearer end: "0.4 s into a
 * 19 s recording", "1.2 s before the end of a 19 s recording" (a missed
 * picture's place, v0.62.1: the owner's Garage run missed one moment twice).
 */
export function placeInRecording(segments: readonly { start: number; end: number }[], at: number): string {
  const recording = segments.find((s) => s.start <= at && at < s.end);
  if (!recording) return "in no recording";
  const into = at - recording.start;
  const left = recording.end - at;
  const near = (ms: number) => (ms < 10_000 ? `${(ms / 1000).toFixed(1)} s` : span(ms));
  const length = span(recording.end - recording.start);
  return into <= left ? `${near(into)} into a ${length} recording` : `${near(left)} before the end of a ${length} recording`;
}

/** How a pass went: "10 of 10, median 212 ms (device 7, cache 3)". */
export function describePass(pass: ScrubPass): string {
  const asked = pass.answered.length + pass.missed.length;
  const sorted = pass.answered.map((a) => a.ms).sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : undefined;
  const sources = new Map<string, number>();
  for (const a of pass.answered) sources.set(a.source, (sources.get(a.source) ?? 0) + 1);
  const from = [...sources].map(([source, n]) => `${source} ${String(n)}`).join(", ");
  const misses = new Map<string, number>();
  for (const why of pass.missed) misses.set(why, (misses.get(why) ?? 0) + 1);
  const missText = [...misses].map(([why, n]) => `${String(n)}: ${why}`).join("; ");
  return (
    `${String(pass.answered.length)} of ${String(asked)}` +
    (median === undefined ? "" : `, median ${ms(median)}${from ? ` (${from})` : ""}`) +
    (missText ? ` · none for ${missText}` : "")
  );
}

// ---- P: pictures while dragging (Phase 10 step 4) ----

/** The camera's key-frame interval where the server does not say it (ms), and the slack on it. */
export const DRAG_INTERVAL_MS = 4000;
export const DRAG_SLACK_MS = 500;

/** A picture painted during a drag: when (ms from the pass's start), where the pointer was, and the picture. */
export interface DragPaint {
  wall: number;
  pointer: number;
  time: number;
  at: number;
  source: string;
  interval?: number;
}

/** One drag over a stretch: its pictures, and the session's asks during it. */
export interface DragPass {
  /** How long the pointer moved (ms), and where it rested after. */
  movedMs: number;
  rest: number;
  paints: DragPaint[];
  asked: number;
  missed: number;
  lastMiss?: string;
  /** Why the pictures that came could not be shown (the MSE painter's last failure, v0.63.9). */
  paintFailure?: string;
}

export interface DragSummary {
  pictures: number;
  /** From the first move to the first picture (ms). */
  firstMs?: number;
  /** The median time between pictures while the pointer moved (ms). */
  gapMs?: number;
  /** How many were within the camera's interval (and slack) before the moment asked. */
  onTime: number;
  /** The picture's distance before its moment (s): the least and most. */
  before?: [number, number];
  /** The median distance of a picture behind the moving pointer (ms). */
  lagMs?: number;
  /** Where the last picture was from the resting pointer (ms), and the camera's interval. */
  restMs?: number;
  interval: number;
  sources: Record<string, number>;
}

const medianOf = (values: readonly number[]): number | undefined => {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)];
};

export function summarizeDrag(pass: DragPass): DragSummary {
  const paints = pass.paints;
  const interval = paints.find((p) => p.interval !== undefined)?.interval ?? DRAG_INTERVAL_MS;
  const moving = paints.filter((p) => p.wall <= pass.movedMs);
  const gaps = moving.slice(1).map((p, i) => p.wall - (moving[i]?.wall ?? p.wall));
  const before = paints.map((p) => p.at - p.time);
  const last = paints.at(-1);
  const sources: Record<string, number> = {};
  for (const p of paints) sources[p.source] = (sources[p.source] ?? 0) + 1;
  const summary: DragSummary = {
    pictures: paints.length,
    onTime: before.filter((b) => b >= -DRAG_SLACK_MS && b <= interval + DRAG_SLACK_MS).length,
    interval,
    sources,
  };
  const gapMs = medianOf(gaps);
  const lagMs = medianOf(moving.map((p) => p.pointer - p.time));
  if (paints[0]) summary.firstMs = paints[0].wall;
  if (gapMs !== undefined) summary.gapMs = gapMs;
  if (before.length) summary.before = [Math.min(...before) / 1000, Math.max(...before) / 1000];
  if (lagMs !== undefined) summary.lagMs = lagMs;
  if (last) summary.restMs = Math.abs(pass.rest - last.time);
  return summary;
}

/** Whether the last picture showed the resting pointer: within the camera's interval (and slack). */
export const caughtUp = (s: DragSummary): boolean => s.restMs !== undefined && s.restMs <= s.interval + DRAG_SLACK_MS;

/** "34 pictures, the first after 0.41 s, a new one every 0.27 s (median), 33 of 34 within the camera's 1.0 s of their moment (0.1–0.9 s before), 0.8 s behind the moving pointer; device 30, store 4" */
export function describeDrag(s: DragSummary, pass: DragPass): string {
  if (!s.pictures) {
    return (
      `no picture in ${String(pass.asked)} asked${pass.missed ? ` (${String(pass.missed)} missed${pass.lastMiss ? `, last: ${pass.lastMiss}` : ""})` : ""}` +
      (pass.paintFailure ? `; they could not be shown: ${pass.paintFailure}` : "")
    );
  }
  const sources = Object.entries(s.sources)
    .map(([source, n]) => `${source} ${String(n)}`)
    .join(", ");
  return (
    count(s.pictures, "picture") +
    (s.firstMs === undefined ? "" : `, the first after ${(s.firstMs / 1000).toFixed(2)} s`) +
    (s.gapMs === undefined ? "" : `, a new one every ${(s.gapMs / 1000).toFixed(2)} s (median)`) +
    `, ${String(s.onTime)} of ${String(s.pictures)} within the camera's ${(s.interval / 1000).toFixed(1)} s of their moment` +
    (s.before ? ` (${s.before[0].toFixed(1)} to ${s.before[1].toFixed(1)} s before)` : "") +
    (s.lagMs === undefined ? "" : `, ${(s.lagMs / 1000).toFixed(1)} s behind the moving pointer`) +
    (s.restMs === undefined ? "" : `; at rest, ${(s.restMs / 1000).toFixed(1)} s from the pointer`) +
    ` · ${sources}` +
    (pass.missed ? ` · ${String(pass.missed)} of ${String(pass.asked)} asked missed${pass.lastMiss ? ` (last: ${pass.lastMiss})` : ""}` : "")
  );
}

/** A recording playing while a drag ran: how much of the time it played, and its longest stall. */
export interface PlayedWhile {
  wallMs: number;
  playedMs: number;
  longestStallMs: number;
}

/** Sample a video's time while something else runs: its progress and longest stall (no advance in a row). */
export function sampleStalls(read: () => number | undefined, everyMs = 250): { stop: () => PlayedWhile } {
  const began = performance.now();
  const first = read();
  let last = first;
  let lastMoved = began;
  let longest = 0;
  const timer = setInterval(() => {
    const now = performance.now();
    const value = read();
    if (value !== undefined && last !== undefined && value > last) {
      lastMoved = now;
    } else {
      longest = Math.max(longest, now - lastMoved);
    }
    last = value;
  }, everyMs);
  return {
    stop: () => {
      clearInterval(timer);
      const end = read();
      return {
        wallMs: performance.now() - began,
        playedMs: first !== undefined && end !== undefined ? Math.max(0, (end - first) * 1000) : 0,
        longestStallMs: longest,
      };
    },
  };
}

/**
 * Where a drag toward `end` should stop so the pointer rests inside a
 * recording: `end` itself, or just before the end of the last recording
 * that starts before it (a drag resting between recordings shows nothing).
 */
export function restInside(segments: readonly { start: number; end: number }[], from: number, end: number): number {
  const last = [...segments].reverse().find((s) => s.start <= end && s.end > from);
  if (!last || end < last.end) return end;
  return Math.max(from, Math.min(end, last.end - 2_000));
}

/** Our own code, as the server names whose code held Home Assistant (loopwatch.py `by`). */
const OUR_CODE = "custom_components/reolink_viewer";

/**
 * Whose code held Home Assistant's event loop, in plain words (v0.63.5):
 * the server's `by` is `custom_components/<domain>`, `homeassistant/
 * components/<domain>`, `homeassistant` (its own code), or none. The
 * owner's run of v0.63.4 found Spook's template scan, named only as files.
 */
export function heldByName(by: string | null | undefined): string | undefined {
  if (!by) return undefined;
  if (by === OUR_CODE) return "Reolink Viewer itself";
  if (by === "homeassistant") return "Home Assistant's own code";
  // Its loop waited and no thread of it ran (v0.63.9): the computer gave it no time.
  if (by === "system") return "the computer Home Assistant runs on (none of its threads was running)";
  const custom = by.startsWith("custom_components/");
  const core = by.startsWith("homeassistant/components/");
  if (!custom && !core) return undefined;
  const domain = by.slice(by.lastIndexOf("/") + 1);
  if (!domain) return undefined;
  const name = domain
    .split("_")
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(" ");
  return custom ? `the ${name} integration` : `Home Assistant's ${name} integration`;
}

/** Whether Reolink Viewer's own code held Home Assistant. */
export const heldByUs = (by: string | null | undefined): boolean => by === OUR_CODE;

/** A hold of Home Assistant's event loop the server's watchdog saw (v0.63.3; `by` v0.63.5). */
export interface LoopHold {
  /** Since it was last seen held (s). */
  ago_s: number;
  /** How long it was held (ms; v0.63.4 and before: when first seen). */
  seen_ms: number;
  where: string[];
  by?: string | null;
  /** Another thread that ran while the loop's waited (v0.63.9). */
  thread?: string | null;
}

/**
 * The holds that touched a start: those that ended after it began and began
 * before its first frame (`sinceStartS`, `sinceFrameS`: seconds from each
 * to when the server was asked). Their total (ms), and the longest.
 */
export function holdsDuring(
  holds: LoopHold[],
  sinceStartS: number,
  sinceFrameS: number,
): { totalMs: number; longest: LoopHold | undefined } {
  // The server reads its clock up to a trip later than the browser asked.
  const during = holds.filter((h) => h.ago_s <= sinceStartS + 0.25 && h.ago_s + h.seen_ms / 1000 >= sinceFrameS);
  const longest = during.reduce<LoopHold | undefined>((a, h) => (a && a.seen_ms >= h.seen_ms ? a : h), undefined);
  return { totalMs: during.reduce((sum, h) => sum + h.seen_ms, 0), longest };
}

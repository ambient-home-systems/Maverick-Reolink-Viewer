// The playback check: measures playback on the device it runs on and writes a
// report, for the Phase 2B gate (docs/IMPLEMENTATION_PLAN.md).
//
// It runs inside the panel (Playback tab → Debug → Run playback check), so it
// works where there is no developer console, as in the iOS Companion app. It
// drives the tab like a user would (read-only: it loads timelines and plays
// recordings) and saves its report on the server as it goes, so a run on a
// phone can be copied on a desktop, and a run cut short by a page reload (iOS
// under memory pressure) keeps what it measured.
import { fetchCacheStatus, fetchMediaInfo, fetchTimelineDay, toError, urlToken } from "../api";
import { count, inShortLines, middle, secondsText, speed, worst, type Finding, type InShort } from "../plain";
import type { CacheStatus, HomeAssistant, MediaInfo, PlaybackUrl, Segment, Stream, TimelineDay, Timing } from "../types";
import {
  browserLabel,
  bufferedSeconds,
  classifyHost,
  cutReport,
  deepTarget,
  describeRate,
  loginReport,
  longRecordings,
  mb,
  ms,
  slope,
  smooth,
  SMOOTH_RULE,
  sourceLabel,
  span,
  touchingPairs,
  within,
  type BaichuanStats,
  type CutStatus,
  type RateSample,
} from "./check-util";
import type { StreamDecision } from "./codec";
import { SHAPES, mseApi, mseSupports, pickSample, probeShape, type MseApi } from "./mse-probe";
import type { RvPlayer } from "./player";

export const CHECK_VERSION = "0.4.2";
export const SETUPS = [
  "Desktop Chrome, LAN",
  "Desktop Chrome, Tailscale",
  "Desktop Chrome, Nabu Casa",
  "iPhone app, Wi-Fi (local)",
  "iPhone app, Tailscale",
  "iPhone app, Nabu Casa",
  "Other",
] as const;

/**
 * Whether a setup runs the HD part by default. HD makes the server fetch a
 * main recording from the NVR (2.4–3.8 GB for an hour, over the LAN); the
 * device reads only seconds of it, but remote setups skip it unless asked.
 */
export function hdByDefault(setup: string): boolean {
  return !/Tailscale|Nabu Casa/.test(setup);
}
export const RATES = [0.5, 1, 2, 4, 8] as const;
const RATE_MS = 6_000;
/** After a rate change, measuring starts this much later. */
const RATE_SETTLE_MS = 1_000;
const SAMPLE_MS = 60_000;
/** The link test reads up to this much, for at most LINK_MS. */
const LINK_BYTES = 32 * 1024 * 1024;
const LINK_MS = 3_000;
const SAVE_EVERY_MS = 10_000;
/** The scrub part previews these points around the play position (s). */
const SCRUB_POINTS_S = [-10, -5, 3, 8, 15] as const;
const SCRUB_FAR_MS = 10 * 60_000;
/** The first HD frame may wait for the NVR's main recording up to the moment. */
const HD_TIMEOUT_MS = 300_000;
const PEEK_LIMIT = 15;
const PAST_DAYS = 7;
const RUNNING_KEY = "reolink-viewer-check-running";

/** The metrics the Playback tab keeps (see components/playback.ts). */
export interface CheckMetrics {
  timelineMs?: number;
  timelineServer?: Timing;
  urlMs?: number;
  firstFrameMs?: number | undefined;
  gapMs?: number | undefined;
  stream?: string;
  codec?: string | null;
  delivery?: string;
  cache?: CacheStatus | undefined;
  recoveries?: number;
  /** HD failures (the tab went back to the sub stream), and the last reason. */
  hdFailures?: number;
  lastHdFailure?: string;
}

/** What the check drives: the Playback tab. */
export interface CheckTarget {
  readonly hass: HomeAssistant;
  readonly deviceId: string;
  readonly cameraName: string;
  readonly date: string;
  readonly today: string;
  readonly day: TimelineDay | undefined;
  readonly loading: boolean;
  readonly metrics: CheckMetrics;
  readonly playFailure: string | undefined;
  readonly hd: StreamDecision;
  readonly progressive: boolean;
  /** Which player plays recordings, e.g. "MSE (ManagedMediaSource), else the file player". */
  readonly mode: string;
  readonly monthDays: ReadonlySet<number>;
  readonly player: RvPlayer | null;
  readonly playing: PlaybackUrl | undefined;
  /** The stream the tab plays (the SD/HD buttons). */
  readonly stream: Stream;
  selectDate(date: string): void;
  playAt(time: number, requestedAt?: number): Promise<void>;
  /** Press SD or HD: plays the other stream from the same moment. */
  setStream(stream: Stream): void;
}

export interface CheckOptions {
  setup: string;
  /** Minutes of continuous playback to sample memory and disk (0: none). */
  soakMinutes: number;
  /** Switch to HD and back (the server fetches a main recording). */
  hd?: boolean;
}

interface Peek {
  segment_id: string;
  cache: CacheStatus | null;
}

interface Long {
  date: string;
  day: TimelineDay;
  segment: Segment;
  cached: boolean;
}

interface PlaybackStats {
  vod: {
    disk_bytes?: number;
    reserved_bytes?: number;
    leased?: number;
    max_bytes?: number;
    baichuan?: BaichuanStats;
  };
}

interface Played {
  ok: boolean;
  line: string;
  /** What served the first window (MSE): "file" or "cut" (Phase 5b). */
  served: string | undefined;
  began: number;
  source: string | undefined;
  /** What the server had of the recording when the start opened it (none opened: undefined). */
  held: CacheStatus | undefined;
}

class Stopped extends Error {}

const sleep = (time: number) => new Promise<void>((resolve) => setTimeout(resolve, time));

/** The player's time, read afresh (a call: not narrowed across awaits). */
const timeOf = (player: RvPlayer): number | undefined => player.time;

/** Resolves true when the event fires, false after `timeout` ms. */
function once(target: EventTarget, name: string, timeout: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      target.removeEventListener(name, done);
      resolve(false);
    }, timeout);
    const done = () => {
      clearTimeout(timer);
      resolve(true);
    };
    target.addEventListener(name, done, { once: true });
  });
}
const clock = (time: number) => new Date(time).toLocaleTimeString();

export class PlaybackCheck {
  readonly id: string;
  readonly lines: string[] = [];
  running = false;
  private _stopped = false;
  private _lastSave = 0;
  private _saving: Promise<void> = Promise.resolve();
  private _long: Long | undefined;
  private _hdPlayed = false;
  private readonly _summary: string[] = [];
  private readonly _plain: Finding[] = [];

  constructor(
    private readonly _t: CheckTarget,
    readonly options: CheckOptions,
    private readonly _onChange: () => void = () => undefined,
  ) {
    this.id = `${new Date().toISOString().slice(0, 19)}-${Math.random().toString(36).slice(2, 6)}`;
  }

  get text(): string {
    return this.lines.join("\n");
  }

  stop(): void {
    this._stopped = true;
  }

  /** Run every part; resolves with the report. */
  async run(): Promise<string> {
    this.running = true;
    markRunning(this.id, this.options.setup);
    try {
      await this._header();
      this._sd();
      await this._timelines();
      await this._events();
      await this._deep();
      await this._advance();
      await this._rates();
      await this._scrub();
      await this._switchHd();
      await this._link();
      await this._capabilities();
      if (this.options.soakMinutes > 0) await this._soak();
      for (const line of inShortLines(this.inShort(true))) this._log(line);
      this._log("");
      this._log("Summary:");
      for (const line of this._summary) this._log(`- ${line}`);
    } catch (err) {
      this._log(err instanceof Stopped ? "Stopped." : `Check failed: ${toError(err).message}`);
    } finally {
      this._t.player?.pause();
      this.running = false;
      this._log(`Done at ${new Date().toLocaleTimeString()}.`);
      await this._save(true);
      clearRunning(this.id);
    }
    return this.text;
  }

  // ---- Reporting ----

  /** What the check found, in plain words; grows as it runs (`final`: it has finished). */
  inShort(final = !this.running): InShort {
    const findings = [...this._plain];
    const problems = findings.filter((f) => f.grade === "problem").length;
    const slow = findings.filter((f) => f.grade === "slow").length;
    const camera = this._t.cameraName;
    const headline = !findings.length
      ? final
        ? "Nothing was measured."
        : "Measuring…"
      : `${final ? "" : "So far: "}${
          problems
            ? `${count(problems, "problem")} found with ${camera}'s recordings on this device.`
            : slow
              ? `${camera}'s recordings play on this device, but ${count(slow, "thing")} ${slow === 1 ? "is" : "are"} slow.`
              : `${camera}'s recordings play well on this device.`
        }`;
    return { headline, findings };
  }

  private _log(line: string): void {
    this.lines.push(line);
    this._onChange();
    if (performance.now() - this._lastSave > SAVE_EVERY_MS) void this._save(false);
  }

  private _save(done: boolean): Promise<void> {
    this._lastSave = performance.now();
    this._saving = this._saving
      .then(() =>
        this._t.hass.callWS({
          type: "reolink_viewer/playback/check_report",
          report_id: this.id,
          setup: this.options.setup,
          text: this.text,
          done,
        }),
      )
      .then(() => undefined)
      .catch(() => undefined);
    return this._saving;
  }

  private _checkStopped(): void {
    if (this._stopped) throw new Stopped();
  }

  private async _wait(test: () => boolean, timeout: number): Promise<boolean> {
    const end = performance.now() + timeout;
    while (performance.now() < end) {
      this._checkStopped();
      if (test()) return true;
      await sleep(100);
    }
    return test();
  }

  private async _pause(time: number): Promise<void> {
    const end = performance.now() + time;
    while (performance.now() < end) {
      this._checkStopped();
      await sleep(Math.min(250, end - performance.now()));
    }
  }

  // ---- Parts ----

  private async _header(): Promise<void> {
    const t = this._t;
    const net = (navigator as { connection?: { effectiveType?: string; downlink?: number } }).connection;
    this._log(
      `Reolink Viewer playback check v${CHECK_VERSION} · ${this.options.setup} · ${t.cameraName} · ${new Date().toLocaleString()}`,
    );
    this._log(
      `Browser: ${browserLabel(navigator.userAgent)} · page ${classifyHost(location.hostname)} over ${location.protocol.replace(":", "")}` +
        ` · screen ${screen.width}×${screen.height} @${window.devicePixelRatio}x` +
        (net?.effectiveType ? ` · network ${net.effectiveType}, ${net.downlink ?? "?"} Mbit/s (browser estimate)` : ""),
    );
    const page = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    this._log(`User agent: ${navigator.userAgent}`);
    this._log(
      `Connection: page loaded over ${page?.nextHopProtocol || "? (from the app's cache)"};` +
        " each video request line gives its own (h2/h3 share one connection; http/1.1 allows 6 at once)",
    );
    this._log(`Player: ${t.mode} · file player delivery: ${t.progressive ? "progressive" : "whole file first (WebKit)"}`);
    this._summary.push(`Player: ${t.mode}`);
    await this._wait(() => Boolean(t.day) && !t.loading, 30_000);
  }

  private async _loadDay(date: string): Promise<CheckMetrics> {
    const t = this._t;
    const before = t.metrics.timelineMs;
    t.selectDate(date);
    await this._wait(() => !t.loading && t.day?.date === date && t.metrics.timelineMs !== before, 60_000);
    return t.metrics;
  }

  private async _timelines(): Promise<void> {
    const t = this._t;
    const today = t.today;
    if (t.date !== today) await this._loadDay(today);
    const a1 = t.metrics;
    this._log(`A1 Time to timeline, today (as the tab opened): ${ms(a1.timelineMs)} (server: ${server(a1.timelineServer)})`);
    const day = Number(today.slice(8, 10));
    const past = [...t.monthDays].filter((n) => n < day).sort((a, b) => b - a);
    const pick = past.at(Math.min(2, past.length - 1));
    if (pick === undefined) {
      this._log("A2/A3 skipped: no earlier recording day this month");
      this._summary.push(`Timeline: today ${within(a1.timelineMs, 1000)}`);
      this._plain.push(
        a1.timelineMs === undefined
          ? { grade: "problem", text: "Today's recordings did not load." }
          : { grade: speed(a1.timelineMs, 1000, 3000), text: `Today's recordings appear on the timeline in ${secondsText(a1.timelineMs)}.` },
      );
      return;
    }
    const pastDate = `${today.slice(0, 8)}${String(pick).padStart(2, "0")}`;
    const a2 = await this._loadDay(pastDate);
    this._log(`A2 Time to timeline, ${pastDate}: ${ms(a2.timelineMs)} (server: ${server(a2.timelineServer)})`);
    await this._loadDay(today);
    const a3 = await this._loadDay(pastDate);
    this._log(`A3 Time to timeline, ${pastDate} again: ${ms(a3.timelineMs)} (server: ${server(a3.timelineServer)})`);
    const a4 = await this._loadDay(today);
    this._log(`A4 Time to timeline, today again: ${ms(a4.timelineMs)} (server: ${server(a4.timelineServer)})`);
    const cold = a2.timelineServer?.cache === "fresh";
    const grades = [
      speed(a1.timelineMs, 1000, 3000),
      speed(a2.timelineMs, cold ? 3000 : 1000, cold ? 6000 : 3000),
      speed(a3.timelineMs, 1000, 3000),
    ];
    this._plain.push(
      a1.timelineMs === undefined || a2.timelineMs === undefined || a3.timelineMs === undefined
        ? { grade: "problem", text: "The timeline of recordings did not always load." }
        : {
            grade: worst(grades),
            text:
              `Recordings appear on the timeline in ${secondsText(a1.timelineMs)} for today;` +
              ` an earlier day takes ${secondsText(a2.timelineMs)} the first time and ${secondsText(a3.timelineMs)} after that.`,
          },
    );
    this._summary.push(
      `Timeline: today ${within(a1.timelineMs, 1000)}, past day first ${within(a2.timelineMs, cold ? 3000 : 1000)}` +
        ` (${cold ? "cold, < 3 s" : "cached, < 1 s"}), again ${within(a3.timelineMs, 1000)}`,
    );
  }

  /**
   * Play from a time and wait for the first frame; returns the report line's
   * middle, and what the server had of the recording the start opened.
   */
  private async _play(time: number): Promise<Played> {
    const t = this._t;
    performance.clearResourceTimings();
    performance.setResourceTimingBufferSize(1000);
    const began = performance.now();
    const watch = watchVideo(t.player, began);
    const before = t.playing;
    await t.playAt(time, began);
    // A seek within the recording on screen (or a failure) opens nothing.
    const held = t.playing === before ? undefined : t.playing?.cache;
    const ok = await this._wait(() => t.metrics.firstFrameMs !== undefined || Boolean(t.playFailure), 120_000);
    watch.stop();
    const m = t.metrics;
    // Where it really started (a start at the wrong place looks fast too).
    const shown = t.player?.time;
    const off = shown === undefined ? undefined : shown - time;
    const where =
      off === undefined
        ? ""
        : Math.abs(off) <= 2000
          ? ""
          : ` · STARTED AT ${clock(shown ?? 0)}, ${span(Math.abs(off))} ${off < 0 ? "before" : "after"} the time asked`;
    const file = t.playing?.file ? ` · ${t.playing.file} file` : "";
    // What served this start or seek (its first window asked for by time).
    const served = t.player?.mseStats?.atSource;
    const from = served ? ` · from ${sourceLabel(served)}` : "";
    const line =
      `first frame ${ok && !t.playFailure ? ms(m.firstFrameMs) : "none"}` +
      ` [URL ${ms(m.urlMs)} · metadata ${ms(watch.seen.loadedmetadata)} · seeked ${ms(watch.seen.seeked)} · playing ${ms(watch.seen.playing)}]` +
      ` ${m.delivery ?? "?"}${file}${from} · ${m.stream ?? "?"} ${m.codec ?? ""}${where}${t.playFailure ? ` FAILED: ${t.playFailure}` : ""}`;
    return {
      ok: ok && !t.playFailure && !where,
      line,
      served,
      began,
      source: t.playing?.base ?? t.playing?.url,
      held,
    };
  }

  private async _events(): Promise<void> {
    const t = this._t;
    const day = t.day;
    const events = (day?.events ?? []).slice(-3).reverse();
    if (!day || !events.length) {
      this._log("B  skipped: no events today");
      this._plain.push({ grade: "note", text: "There were no events today to try opening." });
      return;
    }
    const times: string[] = [];
    const starts: number[] = [];
    for (const ev of events) {
      const seg = day.segments.find((s) => ev.start >= s.start && ev.start < s.end);
      const where = seg ? `${span(ev.start - seg.start)} into a ${span(seg.end - seg.start)} recording` : "no recording";
      const played = await this._play(ev.start);
      if (played.ok && t.metrics.firstFrameMs !== undefined) {
        // Not on disk yet: the start waited for the recorder's download.
        times.push(`${within(t.metrics.firstFrameMs, 2000)}${played.held?.complete === false ? " (not cached)" : ""}`);
        starts.push(t.metrics.firstFrameMs);
      }
      this._log(`B  ${ev.types.join("+")} at ${clock(ev.start)} (${where}): ${played.line}`);
      await sleep(300);
      this._log(`     ${requestReport(played.began, played.source)}`);
      if (seg) this._log(`     ${await this._fillReport()}`);
      await this._pause(1500);
    }
    this._summary.push(`Events → first frame (sub): ${times.join(", ") || "none played"}`);
    const typical = middle(starts);
    this._plain.push(
      typical === undefined
        ? {
            grade: "problem",
            text: "Events would not play.",
            advice: "Run the check again; if it happens again, include the details below in a report.",
          }
        : {
            grade: speed(typical, 2000, 4000),
            text:
              `Opening an event starts its video in ${starts.length > 1 ? "about " : ""}${secondsText(typical)}` +
              `${starts.length < events.length ? `; ${String(events.length - starts.length)} of ${count(events.length, "event")} did not play` : ""}.`,
          },
    );
  }

  private async _peek(date: string, segmentId: string): Promise<Peek | undefined> {
    const t = this._t;
    try {
      return await t.hass.callWS<Peek>({
        type: "reolink_viewer/playback/peek",
        device_id: t.deviceId,
        date,
        segment_id: segmentId,
        stream: "sub",
      });
    } catch {
      return undefined;
    }
  }

  /**
   * The server's record of the download of the copy just played (asked by
   * its URL: the current search may name a newer copy of a recording still
   * being written), once it and the plain copy the file player asks for are done.
   */
  private async _fillReport(): Promise<string> {
    const playing = this._t.playing;
    const token = urlToken(playing?.base ?? playing?.url ?? "");
    if (!token) return "server: nothing played";
    const plain = playing?.file === "plain";
    let cache: CacheStatus | null = null;
    for (let i = 0; i < 90; i += 1) {
      try {
        cache = (await fetchCacheStatus(this._t.hass, token)).cache;
      } catch {
        cache = null;
      }
      if (!cache || cache.error || (cache.complete && (!plain || cache.flat !== undefined))) break;
      // Phase 5c: stopped where the cut begins; it goes no further.
      if (typeof cache.stopped_ms === "number") break;
      await this._pause(1000);
    }
    if (!cache) return "server: not cached (or its URL expired)";
    const parts = [cache.cache === "disk" ? "from disk" : `fill (${text(cache.priority)})`];
    for (const [key, label] of [
      ["wait_ms", "queue"],
      ["headers_ms", "NVR headers"],
      ["ttfb_ms", "NVR first byte"],
      ["fill_ms", "download"],
    ] as const) {
      if (typeof cache[key] === "number") parts.push(`${label} ${ms(cache[key])}`);
    }
    if (typeof cache.mbit_s === "number") parts.push(`${cache.mbit_s} Mbit/s`);
    parts.push(mb(cache.bytes));
    if (typeof cache.stopped_ms === "number") parts.push(`stopped at ${span(cache.stopped_ms)} (the cut has the rest)`);
    if (typeof cache.yields === "number") parts.push(`gave its slot to the cut ${String(cache.yields)}×`);
    if (cache.indexed !== undefined) parts.push(`index ${text(cache.indexed)}`);
    if (plain || cache.flat !== undefined) parts.push(`plain MP4 ${cache.flat === undefined ? "not yet" : text(cache.flat)}`);
    if (typeof cache.flat_ms === "number") parts.push(`rewrite ${ms(cache.flat_ms)}`);
    if (typeof cache.flat_moov_bytes === "number") parts.push(`moov ${mb(cache.flat_moov_bytes)}`);
    if (cache.error) parts.push(`error ${cache.error}`);
    if (typeof cache.cut_error === "string") parts.push(`cut not used: ${cache.cut_error}`);
    const cut = cache.cut as CutStatus | undefined;
    return `server: ${parts.join(", ")}${cut ? ` | ${cutReport(cut)}` : ""}`;
  }

  /** A long recording not on disk yet (or, failing that, one that is). */
  private async _findLong(): Promise<Long | undefined> {
    const t = this._t;
    const today = t.today;
    const dayNumber = Number(today.slice(8, 10));
    const dates = [
      today,
      ...[...t.monthDays]
        .filter((n) => n < dayNumber)
        .sort((a, b) => b - a)
        .slice(0, PAST_DAYS)
        .map((n) => `${today.slice(0, 8)}${String(n).padStart(2, "0")}`),
    ];
    let peeks = 0;
    let cached: Long | undefined;
    for (const date of dates) {
      let day: TimelineDay;
      try {
        day = date === t.date && t.day ? t.day : await fetchTimelineDay(t.hass, t.deviceId, date);
      } catch {
        continue;
      }
      for (const segment of longRecordings(day.segments, day.now)) {
        if (peeks >= PEEK_LIMIT) return cached;
        peeks += 1;
        const peek = await this._peek(date, segment.id);
        if (peek && !peek.cache) return { date, day, segment, cached: false };
        if (peek?.cache?.complete && !cached) cached = { date, day, segment, cached: true };
      }
    }
    return cached;
  }

  /**
   * The rows up to H are the SD (sub) stream's: a tab left on HD goes to SD
   * first (H switches to HD and back itself).
   */
  private _sd(): void {
    const t = this._t;
    if (t.stream === "sub") return;
    t.player?.pause();
    t.setStream("sub");
    this._log("The tab was on HD: switched to SD for the check (H checks HD).");
  }

  private async _deep(): Promise<void> {
    const t = this._t;
    const long = await this._findLong();
    this._long = long;
    if (!long) {
      this._log("D  skipped: no recording of 20 min or more in the last 7 days (events-only camera?)");
      return;
    }
    if (t.date !== long.date) await this._loadDay(long.date);
    const seg = long.segment;
    const length = span(seg.end - seg.start);
    const describe = (target: ReturnType<typeof deepTarget>) =>
      `${span(target.time - seg.start)} into a ${length} recording of ${long.date}` +
      (target.event ? ` (event ${target.event.types.join("+")} at ${clock(target.event.start)})` : " (no event there: a point)");
    let uncachedMs: number | undefined;
    let uncachedFrom: string | undefined;
    if (!long.cached) {
      const target = deepTarget(seg, long.day.events, 0.5, 0.95, 0.75);
      const played = await this._play(target.time);
      // The server may have fetched it meanwhile (a prefetch): then this
      // start did not wait for the recorder.
      const held = played.held;
      if (played.ok && held?.complete === false) {
        uncachedMs = t.metrics.firstFrameMs;
        uncachedFrom = played.served;
      }
      const label = held?.complete
        ? "Not cached when chosen, but on disk when played (not counted)"
        : held?.bytes
          ? `Not cached (${mb(held.bytes)} already fetched when played)`
          : "Not cached";
      this._log(`D1 ${label}, ${describe(target)}: ${played.line}`);
      await sleep(300);
      this._log(`     ${requestReport(played.began, played.source)}`);
      this._log(`     ${await this._fillReport()}`);
      this._log(`     ${loginReport((await this._stats())?.vod.baichuan)}`);
    } else {
      this._log("D1 skipped: every long recording looked at is cached already (try again after other recordings were viewed)");
    }
    await this._pause(1500);
    const target = deepTarget(seg, long.day.events, 0.1, 0.45, 0.4);
    const played = await this._play(target.time);
    const fetched = played.held?.complete === false;
    const cachedMs = played.ok && !fetched ? t.metrics.firstFrameMs : undefined;
    const notCounted = long.cached ? "Cached when chosen, but not on disk when played" : "Still being copied when played";
    this._log(`D2 ${fetched ? `${notCounted} (not counted)` : "Cached"}, ${describe(target)}: ${played.line}`);
    await sleep(300);
    this._log(`     ${requestReport(played.began, played.source)}`);
    this._summary.push(
      `Deep start (sub, ${length} recording): not cached ${uncachedMs === undefined ? "not measured" : `${ms(uncachedMs)}${uncachedFrom ? ` from ${sourceLabel(uncachedFrom)}` : ""}`}` +
        `, cached ${within(cachedMs, 2000)}`,
    );
    this._plain.push(
      cachedMs === undefined
        ? played.ok
          ? {
              grade: "fine",
              text: `Jumping into the middle of a long recording starts in ${secondsText(t.metrics.firstFrameMs ?? 0)} (not judged: its copy was still being made).`,
            }
          : { grade: "problem", text: "Jumping into the middle of a long recording did not play." }
        : {
            grade: speed(cachedMs, 2000, 4000),
            text:
              `Jumping into the middle of a long recording starts in ${secondsText(cachedMs)}` +
              (uncachedMs === undefined
                ? "."
                : `; the first time, ${secondsText(uncachedMs)}, while the recorder sends it over.`),
          },
    );
  }

  private async _advance(): Promise<void> {
    const t = this._t;
    let pairs = touchingPairs(t.day?.segments ?? []);
    if (!pairs.length && t.date !== t.today) {
      // The deep start's day has none: try today.
      await this._loadDay(t.today);
      pairs = touchingPairs(t.day?.segments ?? []);
    }
    // The deep-start recording is cached: moving on from it costs no download.
    const long = this._long;
    const fromLong = long && long.date === t.day?.date ? pairs.find(([a]) => a.id === long.segment.id) : undefined;
    const pair = fromLong ?? pairs.at(0);
    if (!pair) {
      this._log(`C  skipped: no two touching recordings on ${t.date}`);
      return;
    }
    const [a, b] = pair;
    const seen: string[] = [];
    const player = t.player;
    const onAdvanced = () => seen.push("advanced");
    const onEnded = () => seen.push("ended");
    player?.addEventListener("rv-advanced", onAdvanced);
    player?.addEventListener("rv-ended", onEnded);
    try {
      await t.playAt(Math.max(a.start, a.end - 8000), performance.now());
      await this._wait(() => t.metrics.firstFrameMs !== undefined || Boolean(t.playFailure), 120_000);
      const moved = await this._wait(() => t.player?.current?.segmentId === b.id && seen.length > 0, 45_000);
      if (moved && !seen.includes("advanced")) {
        await this._wait(() => t.metrics.firstFrameMs !== undefined || Boolean(t.playFailure), 60_000);
      }
      const p = t.player;
      let how: string;
      if (!moved) {
        how =
          `no: on ${p?.current?.segmentId === a.id ? "the first" : p?.current ? "another" : "no"} recording` +
          ` at ${p?.time !== undefined ? clock(p.time) : "?"}, ${p?.paused ? "paused" : "playing"},` +
          ` next ${p?.preloaded ? "preloaded" : "not preloaded"}, events [${seen.join(", ")}]`;
      } else if (seen.includes("advanced")) {
        how = `yes (preloaded) · gap ${ms(t.metrics.gapMs)}`;
      } else {
        how = `yes, by reloading (the next file was not preloaded) · first frame ${ms(t.metrics.firstFrameMs)}`;
      }
      this._log(
        `C  Moved on by itself at ${clock(a.end)} (from a ${span(a.end - a.start)} recording): ${how}` +
          (t.playFailure ? ` FAILED: ${t.playFailure}` : ""),
      );
      this._summary.push(`Auto-advance: ${moved && seen.includes("advanced") ? `gap ${ms(t.metrics.gapMs)}` : how}`);
      const gap = t.metrics.gapMs ?? 0;
      this._plain.push(
        !moved
          ? {
              grade: "problem",
              text: "It did not move on to the next recording by itself.",
              advice: "Press Next, or tap the timeline, to carry on.",
            }
          : seen.includes("advanced")
            ? {
                grade: gap < 500 ? "good" : gap < 2000 ? "fine" : "slow",
                text: `It plays straight on from one recording to the next${gap < 100 ? ", without a noticeable pause" : `, with a pause of ${secondsText(gap)}`}.`,
              }
            : {
                grade: "fine",
                text: `It moves on to the next recording by itself, after ${secondsText(t.metrics.firstFrameMs ?? 0)} to load it.`,
              },
      );
    } finally {
      player?.removeEventListener("rv-advanced", onAdvanced);
      player?.removeEventListener("rv-ended", onEnded);
    }
  }

  private async _rates(): Promise<void> {
    const t = this._t;
    const segments = t.day?.segments ?? [];
    const long = this._long;
    const seg =
      long && long.date === t.day?.date
        ? long.segment
        : [...segments].sort((a, b) => b.end - b.start - (a.end - a.start)).at(0);
    if (!seg) {
      this._log("R  skipped: no recording on this day");
      return;
    }
    const played = await this._play(seg.start + (seg.end - seg.start) * 0.05);
    if (!played.ok) {
      this._log(`R  skipped: the recording did not play (${played.line})`);
      return;
    }
    this._log(`R  Playback rates, ${span(seg.end - seg.start)} recording, ${RATE_MS / 1000} s each (sub stream):`);
    const results: RateSample[] = [];
    try {
      for (const rate of RATES) {
        const video = activeVideo(t.player);
        if (!video) break;
        const sample = await this._measureRate(video, rate);
        results.push(sample);
        this._log(`     ${describeRate(sample)}`);
        if (sample.ended) break;
      }
    } finally {
      const video = activeVideo(t.player);
      if (video) video.playbackRate = 1;
    }
    this._summary.push(
      `Rates: ${results.map((r) => `${r.rate}× ${smooth(r) ? "✓" : "✗"}`).join(" ") || "not measured"} (smooth = ${SMOOTH_RULE})`,
    );
    const rough = results.filter((r) => !smooth(r));
    if (results.length) {
      this._plain.push(
        rough.length
          ? { grade: "slow", text: `Playback stutters at ${rough.map((r) => `${String(r.rate)}×`).join(", ")} speed.` }
          : {
              grade: "good",
              text: `Slow motion and fast forward (${String(results[0]?.rate)}× to ${String(results.at(-1)?.rate)}×) play smoothly.`,
            },
      );
    }
  }

  /**
   * S: frames while dragging the timeline cursor. Previews a few points
   * around the play position, as the tab does while scrubbing: a point in
   * the buffer shows its frame; one outside it shows the thumbnail instead.
   */
  private async _scrub(): Promise<void> {
    const t = this._t;
    const player = t.player;
    const item = player?.current;
    const video = activeVideo(player);
    if (!player || !item || !video || player.time === undefined) {
      this._log("S  skipped: nothing playing");
      return;
    }
    // Let the buffer gather ahead (the rates just moved the position).
    await this._pause(3000);
    const from = timeOf(player) ?? item.start;
    const shown: number[] = [];
    const notBuffered: number[] = [];
    let off = 0;
    for (const seconds of SCRUB_POINTS_S) {
      const time = from + seconds * 1000;
      if (time < item.start || time > item.end) continue;
      const began = performance.now();
      const seeked = once(video, "seeked", 3000);
      if (!player.preview(time)) {
        notBuffered.push(seconds);
        continue;
      }
      if (await seeked) {
        shown.push(performance.now() - began);
        off = Math.max(off, Math.abs((timeOf(player) ?? time) - time));
      }
    }
    const far = from + SCRUB_FAR_MS;
    const farText =
      far < item.end
        ? ` · ${span(SCRUB_FAR_MS)} ahead: ${player.preview(far) ? "buffered, shown" : "not buffered (the thumbnail shows instead)"}`
        : "";
    const tried = shown.length + notBuffered.length;
    const median = shown.length ? [...shown].sort((a, b) => a - b)[Math.floor(shown.length / 2)] : undefined;
    this._log(
      `S  Scrub preview (frames from the buffer while dragging): ${shown.length} of ${tried} points shown` +
        (median === undefined ? "" : `, median ${ms(median)}, each within ${(off / 1000).toFixed(2)} s of its point`) +
        (notBuffered.length ? ` · not buffered: ${notBuffered.map((n) => `${n > 0 ? "+" : ""}${n} s`).join(", ")}` : "") +
        farText,
    );
    this._summary.push(`Scrub: ${shown.length} of ${tried} points in the buffer shown${median === undefined ? "" : ` (median ${ms(median)})`}`);
    if (tried) {
      this._plain.push(
        shown.length === tried
          ? {
              grade: speed(median, 500, 1500),
              text: `Dragging along the timeline shows the video at once (in about ${secondsText(median ?? 0)}).`,
            }
          : {
              grade: "fine",
              text: `Dragging along the timeline shows the video at ${String(shown.length)} of ${String(tried)} points; elsewhere a thumbnail shows instead.`,
            },
      );
    }
    player.resume();
  }

  /**
   * H: SD → HD → SD on the recording playing, as pressing the buttons does:
   * the first HD frame's time and whether each switch kept the moment.
   */
  private async _switchHd(): Promise<void> {
    const t = this._t;
    if (!this.options.hd) {
      this._log('H  skipped: not asked for (tick "with HD")');
      return;
    }
    if (!t.hd.main) {
      this._log(`H  skipped: HD not offered (${t.hd.reason})`);
      return;
    }
    const player = t.player;
    const item = player?.current;
    if (!player || !item || t.stream !== "sub") {
      this._log("H  skipped: nothing playing on the sub stream");
      return;
    }
    const seg = t.day?.segments.find((s) => s.id === item.segmentId);
    const where = seg ? ` (${span((player.time ?? seg.start) - seg.start)} into a ${span(seg.end - seg.start)} recording)` : "";
    const hd = await this._switchTo("main");
    if (!hd.ok) {
      this._log(`H  HD at ${clock(hd.at)}${where}: ${hd.line}`);
      this._summary.push(`HD switch: ${hd.line}`);
      this._plain.push({
        grade: "problem",
        text: "HD did not play; the viewer went back to SD.",
        advice: "SD still works. Include the details below if you report it.",
      });
      return;
    }
    this._hdPlayed = true;
    this._log(`H  HD at ${clock(hd.at)}${where}: ${hd.line} · ${t.metrics.stream ?? "?"} ${t.metrics.codec ?? "?"} · ${t.metrics.delivery ?? "?"}`);
    this._log(`     ${await this._fillReport()}`);
    await this._pause(5000);
    const sd = await this._switchTo("sub");
    this._log(`     Back to SD at ${clock(sd.at)}: ${sd.line}`);
    this._summary.push(`HD switch: to HD ${hd.short}; back to SD ${sd.short}`);
    this._plain.push({
      grade: worst([speed(hd.ms, 3000, 8000), hd.kept ? "good" : "fine"]),
      text:
        `Switching to HD takes ${secondsText(hd.ms ?? 0)}${hd.kept ? " and keeps your place" : ", but starts at another moment"}` +
        `${sd.ok ? `; back to SD, ${secondsText(sd.ms ?? 0)}` : ""}.`,
    });
  }

  /** Press SD or HD; wait for the first frame of that stream. */
  private async _switchTo(
    stream: Stream,
  ): Promise<{ ok: boolean; at: number; line: string; short: string; ms?: number; kept?: boolean }> {
    const t = this._t;
    const player = t.player;
    const at = player?.time ?? 0;
    const failures = t.metrics.hdFailures ?? 0;
    const failed = () => (t.metrics.hdFailures ?? 0) > failures;
    t.setStream(stream);
    const done = await this._wait(
      () => (t.metrics.stream === stream && t.metrics.firstFrameMs !== undefined) || failed() || Boolean(t.playFailure),
      HD_TIMEOUT_MS,
    );
    const failure = failed() ? (t.metrics.lastHdFailure ?? "HD failed") : t.playFailure;
    if (!done || failure) {
      const line = failure ? `FAILED: ${failure} (back on the sub stream)` : `no first frame within ${span(HD_TIMEOUT_MS)}`;
      return { ok: false, at, line, short: line };
    }
    const first = t.metrics.firstFrameMs ?? 0;
    // Where it started, against the moment the button was pressed.
    const moved = ((player?.time ?? at) - at) / 1000;
    const kept = Math.abs(moved) <= 1.5 ? "kept the moment" : "MOVED";
    return {
      ok: true,
      at,
      ms: first,
      kept: kept === "kept the moment",
      line: `first frame ${ms(first)}, started ${moved.toFixed(2)} s from where ${stream === "main" ? "SD" : "HD"} was (${kept})`,
      short: `${ms(first)}, ${kept} (${moved.toFixed(2)} s)`,
    };
  }

  private async _measureRate(video: HTMLVideoElement, rate: number): Promise<RateSample> {
    video.playbackRate = rate;
    const applied = video.playbackRate;
    await this._pause(RATE_SETTLE_MS);
    let focused = inFront();
    const watchFocus = setInterval(() => {
      focused &&= inFront();
    }, 250);
    const quality0 = playbackQuality(video);
    const media0 = video.currentTime;
    const began = performance.now();
    let stalls = 0;
    let stalledSince: number | undefined;
    let stalledMs = 0;
    let ended = false;
    const onWaiting = () => {
      stalls += 1;
      stalledSince ??= performance.now();
    };
    const onPlaying = () => {
      if (stalledSince !== undefined) stalledMs += performance.now() - stalledSince;
      stalledSince = undefined;
    };
    const onEnded = () => {
      ended = true;
    };
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("ended", onEnded);
    const frames = countFrames(video);
    try {
      await this._pause(RATE_MS);
    } finally {
      clearInterval(watchFocus);
      frames.stop();
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("ended", onEnded);
    }
    if (stalledSince !== undefined) stalledMs += performance.now() - stalledSince;
    const quality1 = playbackQuality(video);
    return {
      rate,
      applied,
      wallMs: performance.now() - began,
      mediaS: Math.max(0, video.currentTime - media0),
      painted: frames.painted,
      maxGapMs: frames.maxGap,
      decoded: quality0 && quality1 ? quality1.totalVideoFrames - quality0.totalVideoFrames : undefined,
      dropped: quality0 && quality1 ? quality1.droppedVideoFrames - quality0.droppedVideoFrames : undefined,
      stalls,
      stalledMs,
      ended,
      focused: focused && inFront(),
    };
  }

  private async _link(): Promise<void> {
    // The file player's URL, or the clip URL of the same recording (MSE).
    const url = this._t.playing?.url ?? this._t.playing?.clip_url;
    if (!url) {
      this._log("L  skipped: nothing played");
      return;
    }
    const began = performance.now();
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, LINK_MS);
    try {
      const response = await fetch(url, {
        headers: { Range: `bytes=0-${LINK_BYTES - 1}` },
        cache: "no-store",
        signal: controller.signal,
      });
      const firstByte = performance.now() - began;
      // Read for at most LINK_MS: long enough to measure a fast link.
      let bytes = 0;
      const reader = response.body?.getReader();
      try {
        for (;;) {
          const chunk = await reader?.read();
          if (!chunk || chunk.done) break;
          bytes += chunk.value.byteLength;
        }
      } catch {
        // Stopped at LINK_MS.
      }
      const total = performance.now() - began;
      const mbit = (bytes * 8) / ((total - firstByte) * 1000);
      this._log(
        `L  Link to Home Assistant: ${mb(bytes)} of the cached recording in ${ms(total - firstByte)} after the answer` +
          ` = ${mbit.toFixed(1)} Mbit/s (answer ${ms(firstByte)}, HTTP ${response.status})`,
      );
      this._summary.push(`Link: ${mbit.toFixed(1)} Mbit/s`);
      this._plain.push({
        grade: mbit >= 16 ? "good" : mbit >= 4 ? "fine" : "slow",
        text:
          `Recordings come from Home Assistant at ${mbit.toFixed(0)} Mbit/s: ` +
          (mbit >= 16 ? "plenty for HD." : mbit >= 4 ? "enough for SD; HD may pause to load." : "SD may pause to load."),
      });
    } catch (err) {
      this._log(`L  Link test failed: ${toError(err).message}`);
    } finally {
      clearTimeout(timer);
    }
  }

  private async _capabilities(): Promise<void> {
    const t = this._t;
    let info: Record<string, MediaInfo | null> = {};
    try {
      info = await fetchMediaInfo(t.hass, t.deviceId);
    } catch {
      // Reported as unknown below.
    }
    const sub = info.sub?.codec;
    const main = info.main?.codec;
    const codecs = (api: MseApi) =>
      [
        ["sub", sub],
        ["main", main],
      ]
        .map(([name, codec]) =>
          codec ? `${name} ${codec} ${yes(mseSupports(api, codec))}` : `${name} codec unknown (not cached yet)`,
        )
        .join(", ");
    const apis: MseApi[] = ["MediaSource", "ManagedMediaSource"];
    this._log(
      `MSE: ${apis.map((api) => (mseApi(api) ? `${api} present (${codecs(api)})` : `${api} absent`)).join(" · ")}`,
    );
    const summary: string[] = [];
    for (const api of apis) {
      if (!mseApi(api)) continue;
      const picked = pickSample(api);
      if (!picked) {
        this._log(`MSE probe (${api}): no sample codec supported`);
        continue;
      }
      const results: string[] = [];
      for (const { shape, label } of SHAPES) {
        this._checkStopped();
        results.push(`${label} ${await probeShape(api, picked.sample, shape)}`);
      }
      this._log(`MSE probe (${api}, ${picked.name} sample): ${results.join(" · ")}`);
      summary.push(`${api} ${results[0]?.includes("plays") ? "plays MSE-ready fragments" : "fails"}`);
    }
    this._summary.push(`MSE: ${summary.join(", ") || "neither MediaSource nor ManagedMediaSource"}`);
    const video = document.createElement("video");
    const can = (codec: string | undefined) =>
      codec ? `"${video.canPlayType(`video/mp4; codecs="${codec}"`)}"` : "unknown";
    this._log(
      `Video: canPlayType sub ${can(sub)}, main ${can(main)} · getVideoPlaybackQuality ${yes("getVideoPlaybackQuality" in video)}` +
        ` · requestVideoFrameCallback ${yes("requestVideoFrameCallback" in video)} · performance.memory ${yes(heap() !== undefined)}`,
    );
    // As decided when the tab opened (H, if it ran, played HD since).
    this._log(`HD as the tab opened: ${t.hd.reason}${this._hdPlayed ? " (played in H above)" : ""}`);
    if (info.main?.width && info.main.height && main) {
      this._log(`HD decodingInfo for ${main} at ${info.main.width}×${info.main.height}: ${await decoding(main, info.main.width, info.main.height)}`);
    }
    if (!this._hdPlayed) this._summary.push(`HD: ${t.hd.main ? "offered" : "not offered"} (${t.hd.reason})`);
    if (!t.hd.main) this._plain.push({ grade: "note", text: `HD is not offered on this device: ${t.hd.reason}.` });
  }

  private async _soak(): Promise<void> {
    const t = this._t;
    const minutes = this.options.soakMinutes;
    const long = this._long;
    const startDay = long?.date ?? t.date;
    if (t.date !== startDay) await this._loadDay(startDay);
    const first = long?.segment ?? t.day?.segments[0];
    if (!first) {
      this._log("M  skipped: no recording to play");
      return;
    }
    this._log(`M  One-hour session: playing from ${clock(first.start)} on ${startDay} for ${minutes} min, a sample a minute`);
    const player = t.player;
    let stalls = 0;
    let advances = 0;
    const gaps: number[] = [];
    const onWaiting = () => {
      stalls += 1;
    };
    const onAdvanced = (e: Event) => {
      advances += 1;
      gaps.push((e as CustomEvent<{ gapMs: number }>).detail.gapMs);
    };
    const videos = [...(player?.renderRoot.querySelectorAll("video") ?? [])];
    const heaps: [number, number][] = [];
    const disks: number[] = [];
    let maxBuffered = 0;
    const frames = new FrameTotals();
    // Whether the page stayed in front through the minute.
    const front = { minute: true };
    const watchFocus = setInterval(() => {
      front.minute &&= inFront();
    }, 1000);
    const began = performance.now();
    try {
      await this._play(first.start);
      // Stalls and file changes from the first frame on.
      videos.forEach((v) => {
        v.addEventListener("waiting", onWaiting);
      });
      player?.addEventListener("rv-advanced", onAdvanced);
      for (let minute = 1; minute <= minutes; minute += 1) {
        await this._pause(SAMPLE_MS);
        if (t.player?.paused && document.visibilityState === "visible") {
          // The day's recordings ran out (or the browser paused): go on.
          const day = t.day;
          const restart = day?.segments[0];
          this._log(`M  ${minute} min: playback had stopped${t.playFailure ? ` (${t.playFailure})` : ""}; starting again from the day's first recording`);
          if (restart) await t.playAt(restart.start, performance.now());
        }
        const active = activeVideo(t.player);
        const minuteDrops = frames.update(videos);
        const wasInFront = front.minute && inFront();
        front.minute = true;
        const buffered = active ? Math.max(0, bufferedEnd(active) - active.currentTime) : 0;
        maxBuffered = Math.max(maxBuffered, buffered);
        const memory = heap();
        if (memory !== undefined) heaps.push([(performance.now() - began) / 3_600_000, memory]);
        const stats = await this._stats();
        if (stats?.vod.disk_bytes !== undefined) disks.push(stats.vod.disk_bytes);
        const held = videos.reduce((sum, v) => sum + bufferedSeconds(v.buffered), 0);
        this._log(
          `M  ${minute} min: ${t.player?.time !== undefined ? clock(t.player.time) : "?"} ${t.player?.paused ? "paused" : "playing"}` +
            (document.visibilityState === "visible" ? "" : " (page hidden: the system pauses video)") +
            (wasInFront ? "" : " · PAGE NOT IN FRONT this minute") +
            ` · heap ${memory === undefined ? "n/a" : mb(memory)} · ${buffered.toFixed(0)} s ahead, ${held.toFixed(0)} s buffered in both videos` +
            ` · dropped ${minuteDrops} this minute, ${frames.dropped} of ${frames.decoded} in all · ${stalls} stalls · ${advances} file changes` +
            (t.metrics.recoveries ? ` · ${t.metrics.recoveries} reloads mid-way` : "") +
            (stats ? ` · cache ${mb(stats.vod.disk_bytes)} on disk + ${mb(stats.vod.reserved_bytes)} reserved, ${stats.vod.leased ?? "?"} leased` : ""),
        );
        markRunning(this.id, this.options.setup, minute);
      }
    } finally {
      clearInterval(watchFocus);
      videos.forEach((v) => {
        v.removeEventListener("waiting", onWaiting);
      });
      player?.removeEventListener("rv-advanced", onAdvanced);
    }
    const growth = slope(heaps);
    const heapLine = heaps.length
      ? `heap ${mb(heaps[0]?.[1])} → ${mb(heaps.at(-1)?.[1])} (max ${mb(Math.max(...heaps.map(([, v]) => v)))}${growth === undefined ? "" : `, ${growth >= 0 ? "+" : ""}${mb(growth)}/h`})`
      : "heap not measurable in this browser (the page was not reloaded)";
    const cap = (await this._stats())?.vod.max_bytes;
    const diskLine = disks.length ? `cache ${mb(Math.min(...disks))}–${mb(Math.max(...disks))} on disk (cap ${mb(cap)})` : "cache use unknown";
    const line =
      `${minutes} min: ${heapLine}, at most ${maxBuffered.toFixed(0)} s buffered ahead, ${frames.dropped} of ${frames.decoded} frames dropped,` +
      ` ${stalls} stalls, ${advances} file changes${gaps.length ? ` (gaps ${gaps.map((g) => ms(g)).join(", ")})` : ""},` +
      ` ${t.metrics.recoveries ?? 0} reloads mid-way, ${diskLine}`;
    this._log(`M  Summary: ${line}`);
    this._summary.push(`Session: ${line}`);
    const dropRate = frames.decoded ? frames.dropped / frames.decoded : 0;
    const reloads = t.metrics.recoveries ?? 0;
    this._plain.push({
      grade: !stalls && !reloads && dropRate < 0.005 ? "good" : stalls <= 2 && dropRate < 0.02 ? "fine" : "slow",
      text:
        `Played for ${count(minutes, "minute")}: ` +
        [
          stalls ? `it paused to load ${count(stalls, "time")}` : "it never paused to load",
          frames.decoded ? `${dropRate < 0.001 ? "no" : `${(dropRate * 100).toFixed(1)}% of`} frames skipped` : undefined,
          reloads ? `reloaded ${count(reloads, "time")}` : undefined,
        ]
          .filter(Boolean)
          .join(", ") +
        ".",
    });
  }

  private async _stats(): Promise<PlaybackStats | undefined> {
    try {
      return await this._t.hass.callWS({ type: "reolink_viewer/playback/stats" });
    } catch {
      return undefined;
    }
  }
}

// ---- Browser measurements ----

const yes = (value: boolean | undefined) => (value === undefined ? "n/a" : value ? "yes" : "no");

/** Whether the page is on screen and has focus (else browsers skip frames). */
const inFront = () => document.visibilityState === "visible" && document.hasFocus();

/** A server value for the report (strings and numbers; anything else "?"). */
const text = (value: unknown): string =>
  typeof value === "string" || typeof value === "number" ? String(value) : "?";

function heap(): number | undefined {
  const memory = (performance as { memory?: { usedJSHeapSize?: number } }).memory;
  return memory?.usedJSHeapSize;
}

/**
 * Frames decoded and dropped across both video elements over a session. An
 * element's counters restart whenever it loads another file.
 */
class FrameTotals {
  decoded = 0;
  dropped = 0;
  private readonly _last = new Map<HTMLVideoElement, VideoPlaybackQuality>();

  /** Add what went by since the last call; return the frames dropped meanwhile. */
  update(videos: readonly HTMLVideoElement[]): number {
    const before = this.dropped;
    for (const video of videos) {
      const now = playbackQuality(video);
      if (!now) continue;
      const last = this._last.get(video);
      const restarted = !last || now.totalVideoFrames < last.totalVideoFrames;
      this.decoded += restarted ? now.totalVideoFrames : now.totalVideoFrames - last.totalVideoFrames;
      this.dropped += restarted ? now.droppedVideoFrames : now.droppedVideoFrames - last.droppedVideoFrames;
      this._last.set(video, now);
    }
    return this.dropped - before;
  }
}

function playbackQuality(video: HTMLVideoElement): VideoPlaybackQuality | undefined {
  return typeof video.getVideoPlaybackQuality === "function" ? video.getVideoPlaybackQuality() : undefined;
}

function bufferedEnd(video: HTMLVideoElement): number {
  const ranges = video.buffered;
  for (let i = 0; i < ranges.length; i += 1) {
    if (ranges.start(i) <= video.currentTime + 0.5 && ranges.end(i) >= video.currentTime) return ranges.end(i);
  }
  return video.currentTime;
}

function activeVideo(player: RvPlayer | null): HTMLVideoElement | null {
  return player?.renderRoot.querySelector<HTMLVideoElement>("video.active") ?? null;
}

interface FrameCount {
  painted: number | undefined;
  maxGap: number | undefined;
  stop: () => void;
}

/** Count painted frames (requestVideoFrameCallback) and the longest gap. */
function countFrames(video: HTMLVideoElement): FrameCount {
  if (typeof video.requestVideoFrameCallback !== "function") {
    return { painted: undefined, maxGap: undefined, stop: () => undefined };
  }
  let last: number | undefined;
  let handle = 0;
  let stopped = false;
  const count: FrameCount = {
    painted: 0,
    maxGap: 0,
    stop: () => {
      stopped = true;
      video.cancelVideoFrameCallback(handle);
    },
  };
  const frame = (now: number) => {
    if (stopped) return;
    count.painted = (count.painted ?? 0) + 1;
    if (last !== undefined) count.maxGap = Math.max(count.maxGap ?? 0, now - last);
    last = now;
    handle = video.requestVideoFrameCallback(frame);
  };
  handle = video.requestVideoFrameCallback(frame);
  return count;
}

/** Times of the active video element's events after a play request. */
function watchVideo(player: RvPlayer | null, began: number): { seen: Record<string, number>; stop: () => void } {
  const seen: Record<string, number> = {};
  const videos = [...(player?.renderRoot.querySelectorAll("video") ?? [])];
  const handlers = ["loadedmetadata", "seeked", "playing"].map((name) => {
    const handler = (e: Event) => {
      if ((e.target as HTMLElement).classList.contains("active")) seen[name] ??= performance.now() - began;
    };
    videos.forEach((v) => {
      v.addEventListener(name, handler);
    });
    return [name, handler] as const;
  });
  return {
    seen,
    stop: () => {
      for (const [name, handler] of handlers) {
        for (const v of videos) v.removeEventListener(name, handler);
      }
    },
  };
}

/**
 * The video requests finished or cancelled since `began`: when each started,
 * how long it waited for a connection, the server's answer time and how long
 * the transfer ran. One long transfer = the whole file was read.
 */
function requestReport(began: number, playedUrl: string | undefined): string {
  const path = playedUrl ? new URL(playedUrl, location.href).pathname : "";
  const entries = (performance.getEntriesByType("resource") as PerformanceResourceTiming[]).filter(
    (e) =>
      (e.initiatorType === "video" || (e.initiatorType === "fetch" && e.name.includes("/api/reolink_viewer/mse/"))) &&
      e.startTime >= began - 5,
  );
  if (!entries.length) return "requests: none reported (this browser may not report video requests)";
  const sent = entries.filter((e) => e.requestStart > 0);
  const parts = sent.slice(0, 10).map((e, i) => {
    // MSE: the init segment and windows are under the recording's path.
    const other = path && new URL(e.name).pathname.startsWith(path) ? "" : " (other file)";
    const size = e.encodedBodySize ? ` · ${mb(e.encodedBodySize)}` : "";
    return (
      `#${i + 1}${other} +${Math.round(e.startTime - began)} ms: wait ${Math.round(e.requestStart - e.startTime)}` +
      ` · answer ${Math.round(e.responseStart - e.requestStart)} · ran ${Math.round(e.responseEnd - e.responseStart)} ms${size}`
    );
  });
  const more = sent.length > 10 ? ` | … ${sent.length - 10} more` : "";
  const unsent = entries.length - sent.length;
  const protocols = [...new Set(sent.map((e) => e.nextHopProtocol).filter(Boolean))].join("/");
  return (
    `requests${protocols ? ` (${protocols})` : ""}: ${sent.length} sent${unsent ? `, ${unsent} cancelled before sending` : ""}:` +
    ` ${parts.join(" | ")}${more}`
  );
}

async function decoding(codec: string, width: number, height: number): Promise<string> {
  const caps = (navigator as { mediaCapabilities?: Partial<MediaCapabilities> }).mediaCapabilities;
  if (!caps?.decodingInfo) return "MediaCapabilities absent";
  const results: string[] = [];
  for (const type of ["file", "media-source"] as const) {
    try {
      const info = await caps.decodingInfo({
        type,
        video: { contentType: `video/mp4; codecs="${codec}"`, width, height, bitrate: 8_000_000, framerate: 25 },
      });
      results.push(
        `${type}: ${info.supported ? "supported" : "not supported"}${info.supported ? `, ${info.smooth ? "smooth" : "not smooth"}, ${info.powerEfficient ? "power efficient" : "not power efficient"}` : ""}`,
      );
    } catch (err) {
      results.push(`${type}: ${toError(err).message}`);
    }
  }
  return results.join(" · ");
}

/** The server's timing of a timeline answer, for the report. */
function server(t: Timing | undefined): string {
  if (!t) return "?";
  const parts = [t.cache ?? "?"];
  if (t.age_s !== undefined) parts.push(`${text(t.age_s)} s old`);
  for (const [key, label] of [
    ["queue_ms", "queue"],
    ["files_ms", "recordings"],
    ["events_ms", "events"],
    ["total_ms", "total"],
  ] as const) {
    const value = t[key];
    if (typeof value === "number") parts.push(`${label} ${ms(value)}`);
  }
  if (typeof t.warm === "string") parts.push(`background fetch: ${t.warm}`);
  return parts.join(", ");
}

// ---- A run cut short ----

interface RunningMark {
  id: string;
  setup: string;
  started: string;
  updated: string;
  minute?: number;
}

function storage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function markRunning(id: string, setup: string, minute?: number): void {
  try {
    const previous = storage()?.getItem(RUNNING_KEY);
    const started = previous ? (JSON.parse(previous) as RunningMark).started : new Date().toISOString();
    const mark: RunningMark = { id, setup, started, updated: new Date().toISOString(), ...(minute ? { minute } : {}) };
    storage()?.setItem(RUNNING_KEY, JSON.stringify(mark));
  } catch {
    // Without storage a cut-short run is simply not reported.
  }
}

function clearRunning(id: string): void {
  try {
    const raw = storage()?.getItem(RUNNING_KEY);
    if (raw && (JSON.parse(raw) as RunningMark).id === id) storage()?.removeItem(RUNNING_KEY);
  } catch {
    // Nothing to clear.
  }
}

interface SavedReport {
  id: string;
  setup: string;
  text: string;
  done: boolean;
  updated: string;
}

/**
 * A check that was running when the page went away (on iOS, usually the app
 * reloading the page under memory pressure): note it in its saved report and
 * return a line for the Debug section. Undefined if there was none.
 */
export async function noteInterruptedCheck(hass: HomeAssistant): Promise<string | undefined> {
  let mark: RunningMark;
  try {
    const raw = storage()?.getItem(RUNNING_KEY);
    if (!raw) return undefined;
    mark = JSON.parse(raw) as RunningMark;
    storage()?.removeItem(RUNNING_KEY);
  } catch {
    return undefined;
  }
  const where = mark.minute ? ` in minute ${mark.minute} of the one-hour session` : "";
  const note =
    `The playback check started ${new Date(mark.started).toLocaleString()} (${mark.setup}) stopped without finishing${where}:` +
    ` the page was reloaded or closed after ${new Date(mark.updated).toLocaleTimeString()}.` +
    " In the iOS app this usually means the app ran out of memory.";
  try {
    const { reports } = await hass.callWS<{ reports: SavedReport[] }>({ type: "reolink_viewer/playback/check_reports" });
    const report = reports.find((r) => r.id === mark.id);
    if (report && !report.done) {
      await hass.callWS({
        type: "reolink_viewer/playback/check_report",
        report_id: report.id,
        setup: report.setup,
        text: `${report.text}\nINTERRUPTED: ${note}`,
        done: true,
      });
    }
  } catch {
    // The note still shows in the panel.
  }
  return note;
}

export const fetchCheckReports = (hass: HomeAssistant): Promise<{ reports: SavedReport[] }> =>
  hass.callWS<{ reports: SavedReport[] }>({ type: "reolink_viewer/playback/check_reports" });

export type { SavedReport };

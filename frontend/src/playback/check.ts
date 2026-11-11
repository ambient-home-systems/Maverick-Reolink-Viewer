// The playback check: measures playback on the device it runs on and writes a
// report, for the Phase 2B gate (docs/IMPLEMENTATION_PLAN.md).
//
// It runs inside the panel (Playback tab → Debug → Run playback check), so it
// works where there is no developer console, as in the iOS Companion app. It
// drives the tab like a user would (read-only: it loads timelines and plays
// recordings) and saves its report on the server as it goes, so a run on a
// phone can be copied on a desktop, and a run cut short by a page reload (iOS
// under memory pressure) keeps what it measured.
import { fetchCacheStatus, fetchMediaInfo, fetchTimelineDay, openScrubSession, toError, urlToken } from "../api";
import { wsUrl } from "../live/check-util";
import { count, inShortLines, middle, secondsText, speed, worst, type Finding, type Grade, type InShort } from "../plain";
import { versionProblem } from "../integration";
import type {
  CacheStatus,
  DevicesResponse,
  HomeAssistant,
  MediaInfo,
  PlaybackUrl,
  Segment,
  Stream,
  TimelineDay,
  Timing,
} from "../types";
import { VERSION } from "../version";
import {
  browserLabel,
  bufferedSeconds,
  classifyHost,
  cutReport,
  deepTarget,
  caughtUp,
  describeDrag,
  describePass,
  describeRate,
  loginReport,
  longRecordings,
  mb,
  ms,
  slope,
  rateFindings,
  smooth,
  SMOOTH_RULE,
  sourceLabel,
  restInside,
  sampleStalls,
  span,
  placeInRecording,
  spreadMoments,
  summarizeDrag,
  touchingPairs,
  within,
  type BaichuanStats,
  type CutStatus,
  type DragPaint,
  type DragPass,
  type DragSummary,
  type PlayedWhile,
  type RateSample,
  type ScrubPass,
} from "./check-util";
import type { StreamDecision } from "./codec";
import { decodeKeyFrames, describeKeyFrames, keyFrames, videoCodec, videoTrack } from "./keyframes";
import type { PaintedDetail, RvScrubPicture } from "./scrub-picture";
import { ScrubClient, isPicture, type ScrubPicture, type SocketLike } from "./scrub-client";
import { SHAPES, mseApi, mseSupports, pickSample, probeShape, type MseApi } from "./mse-probe";
import type { RvPlayer } from "./player";

export const CHECK_VERSION = "0.8.1";
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
/** The MSE link test asks for this much media (the server's most). */
const LINK_WINDOW_MS = 300_000;
const SAVE_EVERY_MS = 10_000;
/** The scrub part previews these points around the play position (s). */
const SCRUB_POINTS_S = [-10, -5, 3, 8, 15] as const;
const SCRUB_FAR_MS = 10 * 60_000;
/** K reads this much media from the play position (Phase 10 step 0). */
const KEY_WINDOW_MS = 20_000;
const KEY_WINDOW_BYTES = 8 * 1024 * 1024;
/** F asks the server for the picture at this many moments of the day (Phase 10). */
const SERVER_MOMENTS = 10;
/**
 * P: the drags (Phase 10 step 4), as a pointer drags: a move every 50 ms; a
 * slow drag over 30 s of recording in 10 s, the same again, the next 30 s
 * (5 s on) beside a second viewer, then a fast one over 5 minutes in 5 s; the
 * pointer rests 2 s after each, still pressed.
 */
const DRAG_STEP_MS = 50;
const DRAG_APART_MS = 5_000;
const DRAG_SLOW = { spanMs: 30_000, ms: 10_000 };
const DRAG_FAST = { spanMs: 300_000, ms: 5_000 };
const DRAG_REST_MS = 2_000;
const DRAG_RELEASE_MS = 20_000;
/** The timeline's hover comes this often while dragging (moves). */
const DRAG_HOVER_EVERY = 5;
/** A pointer's time has fractions of a millisecond (it comes from a pixel; v0.60.0). */
const DRAG_FRACTION = 0.37;
/** Phase 10's exit criteria: ms between pictures, not cached and cached; twice these is fine (the iPhone's allowance). */
const DRAG_UNCACHED_MS = 300;
const DRAG_CACHED_MS = 100;
/** A recording playing on the same camera may pause this long at most (ms). */
const DRAG_STALL_MS = 1_000;
/** Home Assistant's event loop held this long (ms) around a start is said in "In short" (v0.62.2). */
const BUSY_NOTE_MS = 500;
/**
 * V: two viewers on one camera (Phase 5's check, automated): each plays this
 * long after its start (ms); then, both stopped, the NVR's list of users is
 * read this often until it is back at rest, for at most this long (the
 * server's 25 s unread and 30 s idle logout: under a minute).
 */
const VIEWER_PLAY_MS = 8_000;
const VIEWER_POLL_MS = 5_000;
const VIEWER_BACK_MS = 75_000;
/** A viewer's first frame: good under this, fine under twice it (ms). */
const VIEWER_START_MS = 1_500;
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
  /** Pictures from the server while dragging (Phase 10): the last answer, picture or miss. */
  scrub?: { last?: string };
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
  /** Phase 10's P row: the timeline it drags, the picture shown over the video, the tab's asks and its hover box. */
  readonly timeline: HTMLElement | null;
  readonly scrubView: RvScrubPicture | null;
  readonly scrub: { counts: { asked: number; shown: number; missed: number }; unavailable: boolean } | undefined;
  readonly hover: { bare?: boolean } | undefined;
  /** Phase 5's V row: a second viewer of this camera. */
  openViewer(): SecondViewer;
  selectDate(date: string): void;
  playAt(time: number, requestedAt?: number): Promise<void>;
  /** Press SD or HD: plays the other stream from the same moment. */
  setStream(stream: Stream): void;
}

/** A second viewer of the camera (the V row): a player of its own, off screen. */
export interface SecondViewer {
  /** Play from a time; resolves with the time to its first frame (ms), or undefined if none came. */
  playAt(time: number): Promise<number | undefined>;
  /** Its video's position (s), to see it play. */
  readonly position: number | undefined;
  /** What served its start (MSE): "cut" or "file". */
  readonly source: string | undefined;
  /** Stop it as closing its tab does: it stops reading, and tells the server nothing. */
  close(): void;
}

export interface CheckOptions {
  setup: string;
  /** Minutes of continuous playback to sample memory and disk (0: none). */
  soakMinutes: number;
  /** Switch to HD and back (the server fetches a main recording). */
  hd?: boolean;
}

/** P's slow drag beside a second viewer: its start, its source, the drag, and how it played meanwhile. */
interface DragBeside {
  startMs: number | undefined;
  source: string | undefined;
  pass?: DragPass;
  played?: PlayedWhile;
}

interface OnlineUsers {
  count?: number;
  error?: string;
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
    /** Downloads from the recorder running, those no viewer waits for, and plain-copy rewrites (v0.62.2). */
    filling?: number;
    prefetching?: number;
    rewriting?: number;
    baichuan?: BaichuanStats;
  };
  /** How late Home Assistant's event loop ran a timer (ms; v0.62.2: older servers have none). */
  loop?: { held_10s_ms: number | null; held_60s_ms: number | null; period_ms: number } | null;
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
  /** How busy Home Assistant was around the start (v0.62.2). */
  busy: string;
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
  /** The note that Home Assistant was busy (v0.62.2), and the longest hold in it (ms). */
  private _busyNote: Finding | undefined;
  private _busiest = 0;
  /** How busy Home Assistant was as the drag's release started (P). */
  private _releaseBusy: string | undefined;
  /** The P and V rows' times are multiplied by this (the tests' quick runs). */
  timeScale = 1;

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
      // Reading the statistics starts the server's loop timer for the starts below (v0.62.2).
      await this._stats();
      await this._timelines();
      await this._events();
      await this._deep();
      await this._advance();
      await this._rates();
      await this._scrub();
      await this._keyFrames();
      await this._serverPictures();
      await this._drag();
      await this._switchHd();
      await this._link();
      await this._capabilities();
      if (this.options.soakMinutes > 0) await this._soak();
      await this._viewers();
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
    // An update half done (Home Assistant not restarted, or an old page) skews
    // everything after: said first, in the report and in plain words.
    const devices = await t.hass
      .callWS<DevicesResponse>({ type: "reolink_viewer/devices" })
      .catch(() => undefined);
    const mismatch = versionProblem(devices, VERSION);
    this._log(
      `Reolink Viewer: this page ${VERSION}, Home Assistant ${devices ? (devices.version ?? "older than 0.61.1") : "not read"}` +
        (mismatch ? ` · NOT THE SAME: ${mismatch.advice ?? ""}` : ""),
    );
    if (mismatch) this._plain.push({ grade: "problem", text: mismatch.text, ...(mismatch.advice ? { advice: mismatch.advice } : {}) });
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
    // How busy Home Assistant was meanwhile, read at once (its last 10 s).
    const busy = await this._busy();
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
    // The server's own time for a URL it was asked for (v0.62.2).
    const urlServer = held !== undefined ? t.playing?.timing?.total_ms : undefined;
    const line =
      `first frame ${ok && !t.playFailure ? ms(m.firstFrameMs) : "none"}` +
      ` [URL ${ms(m.urlMs)}${urlServer === undefined ? "" : ` (server ${ms(urlServer)})`} · metadata ${ms(watch.seen.loadedmetadata)} · seeked ${ms(watch.seen.seeked)} · playing ${ms(watch.seen.playing)}]` +
      ` ${m.delivery ?? "?"}${file}${from} · ${m.stream ?? "?"} ${m.codec ?? ""}${where}${t.playFailure ? ` FAILED: ${t.playFailure}` : ""}`;
    return {
      ok: ok && !t.playFailure && !where,
      line,
      served,
      began,
      source: t.playing?.base ?? t.playing?.url,
      held,
      busy,
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
      this._log(`     ${played.busy}`);
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
    // Phase 5c: where the copy and the cut meet, how far apart they place the same key frame.
    if (typeof cache.cut_offset_ms === "number") parts.push(`cut ${cache.cut_offset_ms >= 0 ? "+" : ""}${String(Math.round(cache.cut_offset_ms))} ms from the copy`);
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
      this._log(`     ${played.busy}`);
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
      if (!moved) this._log(`     ${videoState(t.player)}`);
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
      `Rates: ${results.map((r) => `${r.rate}× ${!r.focused ? "– (not in front)" : smooth(r) ? "✓" : "✗"}`).join(" ") || "not measured"} (smooth = ${SMOOTH_RULE})`,
    );
    this._plain.push(...rateFindings(results));
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
   * K: the key frames of the recording playing, read from its fragments and
   * decoded one at a time, as scrubbing that shows the picture would (Phase
   * 10 step 0, the gate's browser half). The HD part adds the main stream's.
   */
  private async _keyFrames(): Promise<void> {
    const key = await this._keyLine("SD");
    this._log(`K  ${key.text}`);
    this._summary.push(`Key frames: ${key.short}`);
  }

  /**
   * F: pictures from the server (Phase 10 step 1): a scrub session asks for
   * the picture at moments spread over the day's recordings, twice: first
   * from the disk or a cut from the device, then from the server's store.
   * Each picture is decoded on its own, as a scrub would paint it.
   */
  private async _serverPictures(): Promise<void> {
    const t = this._t;
    const moments = spreadMoments(t.day?.segments ?? [], SERVER_MOMENTS);
    if (!moments.length) {
      this._log("F  skipped: no recording on this day");
      return;
    }
    let client: ScrubClient;
    try {
      const { url } = await openScrubSession(t.hass, t.deviceId, t.date);
      client = new ScrubClient(new WebSocket(wsUrl(url, location.href)) as unknown as SocketLike);
      await client.ready();
    } catch (err) {
      this._log(`F  the scrub session did not open: ${toError(err).message}`);
      this._summary.push("Pictures from the server: the session did not open");
      return;
    }
    try {
      const pictures: ScrubPicture[] = [];
      const first = await this._askPass(client, moments, pictures);
      const again = await this._askPass(client, moments, []);
      const decoded = await this._decodePictures(pictures);
      const offsets = pictures.map((p) => (p.at - p.time) / 1000);
      const offsetText = offsets.length
        ? ` · each ${Math.min(...offsets).toFixed(1)} to ${Math.max(...offsets).toFixed(1)} s before its moment`
        : "";
      this._log(
        `F  Pictures from the server (scrub, ${String(moments.length)} moments over the day): first ${describePass(first)}` +
          ` · again ${describePass(again)}${offsetText}${decoded}`,
      );
      // Where each moment without a picture was (the first pass's).
      const segments = t.day?.segments ?? [];
      (first.missedAt ?? []).forEach((at, i) => {
        this._log(`   no picture at ${clock(at)}, ${placeInRecording(segments, at)}: ${first.missed[i] ?? "?"}`);
      });
      this._summary.push(`Pictures from the server: first ${describePass(first)}; again ${describePass(again)}`);
    } finally {
      client.close();
    }
  }

  /**
   * P: pictures while dragging (Phase 10 step 4). The check drags the
   * timeline itself, as a pointer does (`rv-scrub` every 50 ms, from a pixel:
   * fractions of a millisecond), and times the pictures the tab paints:
   *
   * - over what the video has buffered: the video shows it, nothing is asked;
   * - slowly over a recording not cached (the tab's video paused by the
   *   drag, step 3), then the same stretch again, then fast: a new picture
   *   how often, how near its moment, how far behind the moving pointer, and
   *   whether the last showed the resting pointer;
   * - slowly over the next stretch while a second viewer of the camera plays
   *   another recording (a cut from the device where it is not cached): its
   *   stalls, and the pictures' pace beside it;
   * - the hover box shows the time alone; the release plays from the picture
   *   shown, held until the video's first frame; the NVR's logins.
   */
  private async _drag(): Promise<void> {
    const t = this._t;
    const view = t.scrubView;
    const day = t.day;
    if (!view || !t.timeline || !t.player || !day?.segments.length) {
      this._log("P  skipped: no timeline or recording on screen");
      return;
    }
    const path = view.path;
    const how = `painted with ${path.how}${path.why ? ` (${path.why})` : ""}`;
    if (path.how === "none") {
      this._log(`P  Pictures while dragging: not here (${path.why ?? "no way to paint"})`);
      this._summary.push("Dragging: no pictures in this browser");
      this._plain.push({
        grade: "problem",
        text: "Dragging along the timeline cannot show pictures in this browser: it has neither WebCodecs nor MSE.",
      });
      return;
    }
    const logins = (await this._stats())?.vod.baichuan?.logins;
    const buffered = await this._dragBuffered();
    const { stretch, other, cached } = await this._dragStretch();
    if (!stretch) {
      this._log("P  skipped: no recording to drag over on this day");
      return;
    }
    const scale = this.timeScale;
    const length = stretch.end - stretch.start;
    // Two stretches of it, neither asked before: alone, then beside a second viewer.
    const slowSpan = Math.min(DRAG_SLOW.spanMs, Math.max(5_000, (length - 15_000) / 2));
    const from = stretch.start + Math.min(5_000, length / 10);
    const hadVideo = t.player.current !== undefined;
    const slow = await this._dragPass(from, slowSpan, DRAG_SLOW.ms * scale);
    const bare = t.hover?.bare === true;
    // Still pressed: the drag paused the tab's video (step 3).
    const held = activeVideo(t.player)?.paused !== false;
    const again = await this._dragPass(from, slowSpan, DRAG_SLOW.ms * scale);
    const besideFrom = from + slowSpan + DRAG_APART_MS;
    const beside = other ? await this._dragBeside(other, besideFrom, slowSpan) : undefined;
    const fastFrom = besideFrom + slowSpan;
    const fastEnd = restInside(day.segments, fastFrom, fastFrom + DRAG_FAST.spanMs);
    const fast = await this._dragPass(fastFrom, fastEnd - fastFrom, DRAG_FAST.ms * scale);
    const release = await this._dragRelease(fast.rest);
    const after = (await this._stats())?.vod.baichuan?.logins;
    const moreLogins = logins !== undefined && after !== undefined ? after - logins : undefined;

    const sSlow = summarizeDrag(slow);
    const sAgain = summarizeDrag(again);
    const sFast = summarizeDrag(fast);
    const firstTarget = cached ? DRAG_CACHED_MS : DRAG_UNCACHED_MS;
    const slowGrade = this._dragGrade(sSlow, firstTarget);
    const againGrade = this._dragGrade(sAgain, DRAG_CACHED_MS);
    const fastOk = caughtUp(sFast);
    const sBeside = beside?.pass ? summarizeDrag(beside.pass) : undefined;
    const stallOk = beside?.played ? beside.played.longestStallMs < DRAG_STALL_MS : undefined;
    const mark = (ok: boolean | undefined) => (ok === undefined ? "" : ok ? " ✓" : " ✗");
    const good = (grade: string) => grade === "good" || grade === "fine";
    const minutes = (value: number) => `${(value / 60_000).toFixed(1)} min`;

    this._log(
      `P  Pictures while dragging (Phase 10): ${how} · over ${clock(from)}, a recording ${cached ? "already cached" : "not cached"}` +
        (t.scrub?.unavailable ? " · THE SCRUB SESSION DID NOT OPEN" : ""),
    );
    this._log(`   slow (${span(slowSpan)} of recording in ${span(DRAG_SLOW.ms)}): ${describeDrag(sSlow, slow)}${mark(good(slowGrade))}`);
    if (hadVideo) this._log(`   this tab's video while dragging: ${held ? "paused" : "PLAYED ON"}${mark(held)}`);
    this._log(`   again over the same stretch: ${describeDrag(sAgain, again)}${mark(good(againGrade))}`);
    this._log(`   ${this._besideText(beside, sBeside)}${mark(stallOk)}`);
    this._log(
      `   fast (${minutes(fastEnd - fastFrom)} in ${span(DRAG_FAST.ms)}): ${describeDrag(sFast, fast)}${mark(fastOk)}`,
    );
    this._log(`   release: ${release.text}${mark(release.ok)}`);
    if (release.firstMs !== undefined) {
      // Where the start's time went: the page's steps, then the server's (a cut's slot and reply).
      const m = t.metrics;
      const served = t.player.mseStats?.atSource;
      const urlServer = m.urlMs ? t.playing?.timing?.total_ms : undefined;
      this._log(
        `     [URL ${ms(m.urlMs)}${urlServer === undefined ? "" : ` (server ${ms(urlServer)})`}] ${m.delivery ?? "?"}${served ? ` · from ${sourceLabel(served)}` : ""} · ${m.stream ?? "?"} ${m.codec ?? ""}`,
      );
      if (this._releaseBusy) this._log(`     ${this._releaseBusy}`);
      this._log(`     ${await this._fillReport()}`);
    }
    this._log(`   over what the video has buffered: ${buffered.text}${mark(buffered.ok)}`);
    this._log(`   hovering while dragging: ${bare ? "the time alone, no thumbnail" : "a thumbnail was fetched"}${mark(bare)}`);
    if (moreLogins !== undefined) this._log(`   the NVR: ${count(moreLogins, "more login")} while dragging${mark(moreLogins <= 1)}`);

    const gapText = (s: DragSummary) => (s.gapMs === undefined ? "–" : secondsText(s.gapMs));
    this._summary.push(
      `Dragging (${path.how}): slow ${String(sSlow.pictures)} pictures every ${gapText(sSlow)}; again every ${gapText(sAgain)}; ` +
        (sBeside && beside?.played
          ? `beside another viewer every ${gapText(sBeside)}, its longest stall ${span(beside.played.longestStallMs)}; `
          : "") +
        `fast ${fastOk ? "caught up" : "did not catch up"}; release ${release.ok ? "held the picture" : "NOT CLEAN"}`,
    );
    this._plain.push({
      grade: "note",
      text:
        path.how === "WebCodecs"
          ? "While dragging, pictures are decoded with WebCodecs."
          : `While dragging, pictures are played through MSE: ${path.why ?? ""}.`,
    });
    this._plain.push(
      sSlow.pictures
        ? {
            grade: slowGrade,
            text: `Dragging over a recording ${cached ? "already cached" : "not cached yet"} shows a new picture every ${gapText(sSlow)}, ${String(sSlow.onTime)} of ${String(sSlow.pictures)} within the camera's key-frame interval of their moment.`,
          }
        : {
            grade: "problem",
            text: `Dragging over a recording showed no picture (${String(slow.asked)} asked, ${String(slow.missed)} missed).`,
          },
    );
    if (sAgain.pictures) {
      this._plain.push({ grade: againGrade, text: `Dragging over the same stretch again shows a new picture every ${gapText(sAgain)}.` });
    }
    this._plain.push({
      grade: fastOk ? "good" : "slow",
      text: fastOk
        ? `A fast drag catches up when the pointer stops (the last picture ${secondsText(sFast.restMs ?? 0)} from it).`
        : "A fast drag did not catch up with the pointer when it stopped.",
    });
    this._plain.push({ grade: release.ok ? speed(release.firstMs, 1000, 2500) : "problem", text: release.plain });
    if (buffered.ok !== undefined) {
      this._plain.push({
        grade: buffered.ok ? "good" : "problem",
        text: buffered.ok
          ? "Over what the video has loaded, the video itself shows the moment."
          : "Over what the video has loaded, the server was asked anyway.",
      });
    }
    if (hadVideo && !held) {
      this._plain.push({ grade: "problem", text: "The video played on while dragging (a drag pauses it)." });
    }
    if (beside?.played) {
      const pace = sBeside?.pictures ? ` (a new picture every ${gapText(sBeside)} meanwhile)` : "";
      this._plain.push({
        grade: stallOk ? "good" : "problem",
        text: stallOk
          ? `Another viewer of this camera played on while dragging${pace}.`
          : `Another viewer of this camera stalled ${secondsText(beside.played.longestStallMs)} while dragging${pace}.`,
      });
    }
    if (moreLogins !== undefined && moreLogins > 1) {
      this._plain.push({ grade: "problem", text: `Dragging logged in to the NVR ${String(moreLogins)} more times (at most 1 expected).` });
    }
  }

  private _dragGrade(s: DragSummary, target: number): Grade {
    if (!s.pictures) return "problem";
    const often = speed(s.gapMs, target, target * 2);
    return worst([often, s.onTime >= s.pictures * 0.8 ? "good" : "slow"]);
  }

  /** One drag: the pointer moves from `from` over `spanMs` in `durationMs`, then rests, still pressed. */
  private async _dragPass(from: number, spanMs: number, durationMs: number): Promise<DragPass> {
    const t = this._t;
    const timeline = t.timeline;
    const view = t.scrubView;
    if (!timeline || !view) return { movedMs: 0, rest: from, paints: [], asked: 0, missed: 0 };
    const before = t.scrub?.counts;
    const paints: DragPaint[] = [];
    let pointer = from;
    const began = performance.now();
    const onPaint = (event: Event) => {
      const d = (event as CustomEvent<PaintedDetail>).detail;
      paints.push({
        wall: performance.now() - began,
        pointer,
        time: d.time,
        at: d.at,
        source: d.source,
        ...(d.interval !== undefined ? { interval: d.interval } : {}),
      });
    };
    view.addEventListener("rv-scrub-painted", onPaint);
    const steps = Math.max(1, Math.round(durationMs / (DRAG_STEP_MS * this.timeScale)));
    const x = timeline.clientWidth / 2;
    let movedMs: number;
    try {
      for (let i = 0; i <= steps; i += 1) {
        this._checkStopped();
        pointer = from + (spanMs * i) / steps + DRAG_FRACTION;
        timeline.dispatchEvent(new CustomEvent("rv-scrub", { detail: { time: pointer } }));
        if (i % DRAG_HOVER_EVERY === 0) timeline.dispatchEvent(new CustomEvent("rv-hover", { detail: { time: pointer, x } }));
        await sleep(durationMs / steps);
      }
      movedMs = performance.now() - began;
      await this._pause(DRAG_REST_MS * this.timeScale);
    } finally {
      view.removeEventListener("rv-scrub-painted", onPaint);
    }
    const after = t.scrub?.counts;
    const asked = (after?.asked ?? 0) - (before?.asked ?? 0);
    const missed = (after?.missed ?? 0) - (before?.missed ?? 0);
    const last = t.metrics.scrub?.last;
    return { movedMs, rest: pointer, paints, asked, missed, ...(missed && !paints.length && last ? { lastMiss: last } : {}) };
  }

  /**
   * The slow drag beside a second viewer of this camera (step 3): it plays
   * another recording deep in (a cut where it is not cached) while the drag
   * goes over a stretch not asked before; its video is sampled for stalls.
   */
  private async _dragBeside(other: Segment, from: number, spanMs: number): Promise<DragBeside> {
    const viewer = this._t.openViewer();
    try {
      const startMs = await viewer.playAt(other.start + (other.end - other.start) * 0.6);
      if (startMs === undefined) return { startMs, source: viewer.source };
      const watch = sampleStalls(() => viewer.position);
      const pass = await this._dragPass(from, spanMs, DRAG_SLOW.ms * this.timeScale);
      return { startMs, source: viewer.source, pass, played: watch.stop() };
    } finally {
      viewer.close();
    }
  }

  private _besideText(beside: DragBeside | undefined, s: DragSummary | undefined): string {
    if (!beside) return "beside another viewer: none (no second recording not cached on this day)";
    const from = beside.source ? `, from ${sourceLabel(beside.source)}` : "";
    if (!beside.pass || !beside.played || !s) return `beside another viewer: it did not start${from}`;
    const { played } = beside;
    return (
      `beside another viewer (playing another recording${from}, started in ${ms(beside.startMs)}): ${describeDrag(s, beside.pass)}; ` +
      `the viewer played ${span(played.playedMs)} in ${span(played.wallMs)}, longest stall ${span(played.longestStallMs)}`
    );
  }

  /** Over what the video has buffered: a short drag around its time; the video shows it, nothing is asked. */
  private async _dragBuffered(): Promise<{ text: string; ok: boolean | undefined }> {
    const t = this._t;
    const player = t.player;
    const timeline = t.timeline;
    const view = t.scrubView;
    const now = player?.time;
    if (!player || !timeline || !view || !player.current || now === undefined) return { text: "skipped, nothing playing", ok: undefined };
    const asked = t.scrub?.counts.asked ?? 0;
    let tried = 0;
    let byVideo = 0;
    for (let i = 0; i < 8; i += 1) {
      this._checkStopped();
      const time = now - 3000 + i * 750 + DRAG_FRACTION;
      if (!player.buffers(time)) continue;
      tried += 1;
      timeline.dispatchEvent(new CustomEvent("rv-scrub", { detail: { time } }));
      await sleep(120 * this.timeScale);
      if (!view.showing) byVideo += 1;
    }
    // Let go as a drag the browser takes: nothing starts.
    timeline.dispatchEvent(new CustomEvent("rv-hover-end"));
    const extra = (t.scrub?.counts.asked ?? 0) - asked;
    if (!tried) return { text: "skipped, the video had nothing buffered around its time", ok: undefined };
    return {
      text: `${String(byVideo)} of ${String(tried)} moments shown by the video, ${count(extra, "picture")} asked of the server`,
      ok: byVideo === tried && extra === 0,
    };
  }

  /** The recording to drag over (the longest not cached, not the one playing), and another not cached to play meanwhile. */
  private async _dragStretch(): Promise<{ stretch: Segment | undefined; other: Segment | undefined; cached: boolean }> {
    const t = this._t;
    const playing = t.player?.current?.segmentId;
    const candidates = [...(t.day?.segments ?? [])]
      .filter((s) => s.id !== playing)
      .sort((a, b) => b.end - b.start - (a.end - a.start))
      .slice(0, PEEK_LIMIT);
    const uncached: Segment[] = [];
    for (const segment of candidates) {
      this._checkStopped();
      const peek = await this._peek(t.date, segment.id);
      if (peek && !peek.cache?.complete) uncached.push(segment);
      if (uncached.length >= 2) break;
    }
    const stretch = uncached.at(0) ?? candidates.at(0);
    const other = uncached.find((s) => s !== stretch);
    return { stretch, other, cached: stretch !== undefined && !uncached.includes(stretch) };
  }

  /** Let go at `at`: the video starts there, the picture staying on screen until its first frame. */
  private async _dragRelease(at: number): Promise<{ text: string; plain: string; ok: boolean; firstMs?: number }> {
    const t = this._t;
    const timeline = t.timeline;
    const view = t.scrubView;
    const player = t.player;
    if (!timeline || !view || !player) return { text: "skipped", plain: "Letting go was not measured.", ok: false };
    const showing = view.showing;
    const picture = view.shown;
    let framed = false;
    let goneMs: number | undefined;
    const began = performance.now();
    const frame = new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        resolve(false);
      }, DRAG_RELEASE_MS);
      player.addEventListener(
        "rv-first-frame",
        () => {
          framed = true;
          clearTimeout(timer);
          resolve(true);
        },
        { once: true },
      );
    });
    const poll = setInterval(() => {
      if (!framed && goneMs === undefined && !view.showing) goneMs = performance.now() - began;
    }, 25);
    timeline.dispatchEvent(new CustomEvent("rv-seek", { detail: { time: at } }));
    const ok = await frame;
    clearInterval(poll);
    const firstMs = performance.now() - began;
    // Where the video began: at the picture shown (step 3), or at the pointer.
    const startedAt = player.time;
    timeline.dispatchEvent(new CustomEvent("rv-hover-end"));
    this._releaseBusy = await this._busy();
    if (!ok) {
      return { text: `no first frame in ${span(DRAG_RELEASE_MS)}`, plain: "Letting go did not start the video.", ok: false };
    }
    if (!showing) {
      return {
        text: `the video's first frame after ${secondsText(firstMs)} (no picture was on screen at the release)`,
        plain: `Letting go starts the video in ${secondsText(firstMs)}.`,
        ok: true,
        firstMs,
      };
    }
    if (goneMs !== undefined) {
      return {
        text: `the picture went ${secondsText(firstMs - goneMs)} before the video's first frame (${secondsText(firstMs)})`,
        plain: `Letting go left the screen without a picture for ${secondsText(firstMs - goneMs)} before the video started.`,
        ok: false,
        firstMs,
      };
    }
    const side = (a: number, b: number) => `${secondsText(Math.abs(a - b))} ${a <= b ? "before" : "after"}`;
    const where =
      picture && startedAt !== undefined
        ? `; it began ${secondsText(Math.abs(startedAt - picture.time))} from the picture's own time (${side(picture.time, at)} the pointer)`
        : "";
    return {
      text: `the picture stayed until the video's first frame, ${secondsText(firstMs)} after letting go${where}`,
      plain: `Letting go plays from there in ${secondsText(firstMs)}, the picture staying until the video shows.`,
      ok: true,
      firstMs,
    };
  }

  /**
   * V: two viewers on one camera (Phase 5's v0.40.1 check, automated). The
   * NVR's list of users at rest; the tab starts deep in one recording not
   * cached (a cut), and a second viewer, off screen, deep in another, then
   * far into the first one's: the first is sampled for stalls all along, as
   * the two cuts take the channel in turns. Then both stop, the second as a
   * closed tab does (it tells the server nothing): within a minute the NVR's
   * list is back at rest and no Reolink protocol login is left (v0.40.0 kept
   * the extra session until Home Assistant restarted).
   */
  private async _viewers(): Promise<void> {
    const t = this._t;
    if (!t.day?.segments.length || !t.player) {
      this._log("V  skipped: no recording on screen");
      return;
    }
    const recordings = await this._uncached(2);
    const first = recordings.at(0);
    if (!first) {
      this._log("V  skipped: no recording to play on this day");
      return;
    }
    const scale = this.timeScale;
    const rest = await this._onlineUsers();
    const mid = (s: Segment, part: number) => s.start + (s.end - s.start) * part;
    const one = await this._play(mid(first, 0.5));
    const withOne = await this._onlineUsers();
    const viewer = t.openViewer();
    let twoMs: number | undefined;
    let jumpMs: number | undefined;
    let withTwo: OnlineUsers;
    let played: PlayedWhile;
    let secondPlayed: boolean;
    try {
      const watch = sampleStalls(() => activeVideo(t.player)?.currentTime);
      const second = recordings.at(1);
      twoMs = await viewer.playAt(second ? mid(second, 0.5) : mid(first, 0.2));
      await this._pause(VIEWER_PLAY_MS * scale);
      withTwo = await this._onlineUsers();
      // The second viewer jumps far into the first one's recording: the same cut's turns.
      const before = viewer.position;
      jumpMs = await viewer.playAt(mid(first, 0.85));
      await this._pause(VIEWER_PLAY_MS * scale);
      secondPlayed = viewer.position !== undefined && (before === undefined || viewer.position !== before);
      played = watch.stop();
    } finally {
      viewer.close();
    }
    t.player.stop();
    const back = await this._backAtRest(rest, VIEWER_BACK_MS * scale);

    const usersText = (u: OnlineUsers) => (u.count === undefined ? `? (${u.error ?? "not said"})` : String(u.count));
    const startOk = (value: number | undefined) => value !== undefined && value < VIEWER_START_MS * 2;
    const stallOk = played.longestStallMs < DRAG_STALL_MS;
    const mark = (ok: boolean | undefined) => (ok === undefined ? "" : ok ? " ✓" : " ✗");
    this._log(
      `V  Two viewers on one camera (Phase 5): the NVR's users at rest ${usersText(rest)}, with one viewer ${usersText(withOne)}, with two ${usersText(withTwo)}`,
    );
    this._log(`   the first viewer (this tab, ${clock(mid(first, 0.5))}): ${one.line}${mark(one.ok)}`);
    this._log(
      `   the second viewer: first frame ${twoMs === undefined ? "none" : ms(twoMs)}${mark(startOk(twoMs))}; ` +
        `then far into the first one's recording: ${jumpMs === undefined ? "none" : ms(jumpMs)}${mark(startOk(jumpMs) && secondPlayed)}`,
    );
    this._log(
      `   the first viewer meanwhile: played ${span(played.playedMs)} in ${span(played.wallMs)}, longest stall ${span(played.longestStallMs)}${mark(stallOk)}`,
    );
    this._log(`   both stopped (the second as a closed tab): ${back.text}${mark(back.ok)}`);

    this._summary.push(
      `Two viewers: first viewer's longest stall ${span(played.longestStallMs)}; second started in ${twoMs === undefined ? "–" : ms(twoMs)}, jumped in ${jumpMs === undefined ? "–" : ms(jumpMs)}; ${back.ok === undefined ? "the NVR's list not read" : back.ok ? "the NVR back at rest" : "the NVR NOT back at rest"}`,
    );
    this._plain.push({
      grade: stallOk ? "good" : "problem",
      text: stallOk
        ? "Two viewers on one camera play on: the first did not stall while the second started and jumped into its recording."
        : `With two viewers on one camera, the first stalled ${secondsText(played.longestStallMs)} while the second started.`,
    });
    this._plain.push({
      grade: startOk(twoMs) && startOk(jumpMs) ? worst([speed(twoMs, VIEWER_START_MS, VIEWER_START_MS * 2), speed(jumpMs, VIEWER_START_MS, VIEWER_START_MS * 2)]) : "problem",
      text:
        twoMs === undefined || jumpMs === undefined
          ? "A second viewer of the same camera did not start."
          : `A second viewer of the same camera starts in ${secondsText(twoMs)}, and in ${secondsText(jumpMs)} far into the first one's recording.`,
    });
    this._plain.push({ grade: back.ok === undefined ? "note" : back.ok ? "good" : "problem", text: back.plain });
  }

  /** The longest recordings of the day on screen that are not cached (up to `n`), else the longest. */
  private async _uncached(n: number): Promise<Segment[]> {
    const t = this._t;
    const playing = t.player?.current?.segmentId;
    const candidates = [...(t.day?.segments ?? [])]
      .filter((s) => s.id !== playing)
      .sort((a, b) => b.end - b.start - (a.end - a.start))
      .slice(0, PEEK_LIMIT);
    const found: Segment[] = [];
    for (const segment of candidates) {
      this._checkStopped();
      const peek = await this._peek(t.date, segment.id);
      if (peek && !peek.cache?.complete) found.push(segment);
      if (found.length >= n) break;
    }
    return found.length ? found : candidates.slice(0, n);
  }

  private async _onlineUsers(): Promise<OnlineUsers> {
    const t = this._t;
    try {
      const result = await t.hass.callWS<{ count: number | null; error: string | null }>({
        type: "reolink_viewer/playback/online_users",
        device_id: t.deviceId,
      });
      return result.count === null ? { error: result.error ?? "not said" } : { count: result.count };
    } catch (err) {
      return { error: toError(err).message };
    }
  }

  /** Wait until the NVR lists no more users than at rest and no Reolink protocol login is left. */
  private async _backAtRest(
    rest: OnlineUsers,
    limitMs: number,
  ): Promise<{ ok: boolean | undefined; text: string; plain: string }> {
    const began = performance.now();
    let users: OnlineUsers;
    let loggedIn: number | undefined;
    for (;;) {
      users = await this._onlineUsers();
      loggedIn = (await this._stats())?.vod.baichuan?.logged_in;
      const listBack = rest.count === undefined || (users.count !== undefined && users.count <= rest.count);
      const loginGone = loggedIn === undefined || loggedIn === 0;
      const waited = performance.now() - began;
      if (rest.count === undefined && loginGone) {
        // Without the NVR's list, only half of it is known: no pass.
        const why = /unknown command/i.test(rest.error ?? "")
          ? "Home Assistant runs an older Reolink Viewer than this page: restart it, then run the check again"
          : (rest.error ?? "not said");
        return {
          ok: undefined,
          text: `no Reolink protocol login left after ${secondsText(waited)}, but the NVR's list of users could not be read (${why})`,
          plain: `When both viewers stopped, no Reolink protocol login was left, but the NVR's list of users could not be read (${why}).`,
        };
      }
      if (listBack && loginGone) {
        const after = secondsText(waited);
        return {
          ok: true,
          text: `back at rest after ${after} (the NVR lists ${users.count === undefined ? "?" : String(users.count)}, no Reolink protocol login left)`,
          plain: `When both viewers stop, the NVR is back at rest within ${after}.`,
        };
      }
      if (waited >= limitMs) break;
      await this._pause(Math.min(VIEWER_POLL_MS * this.timeScale, limitMs - waited));
    }
    const left = `the NVR lists ${users.count === undefined ? "?" : String(users.count)} (${rest.count === undefined ? "?" : String(rest.count)} at rest), ${loggedIn === undefined ? "?" : String(loggedIn)} Reolink protocol login(s) left`;
    return {
      ok: false,
      text: `NOT back at rest after ${span(limitMs)}: ${left}`,
      plain: `When both viewers stopped, the NVR was not back at rest after ${secondsText(limitMs)}: ${left}.`,
    };
  }

  private async _askPass(client: ScrubClient, moments: readonly number[], keep: ScrubPicture[]): Promise<ScrubPass> {
    const pass: ScrubPass = { answered: [], missed: [], missedAt: [] };
    for (const at of moments) {
      this._checkStopped();
      const answer = await client.ask(at);
      if (isPicture(answer)) {
        pass.answered.push({ ms: answer.ms, source: answer.source, offsetMs: answer.at - answer.time });
        keep.push(answer);
      } else {
        pass.missed.push(answer.error);
        pass.missedAt?.push(at);
      }
    }
    return pass;
  }

  /** Decode each picture on its own (its own decoder): " · VideoDecoder: 10 of 10 decode, median 3.1 ms". */
  private async _decodePictures(pictures: readonly ScrubPicture[]): Promise<string> {
    const fmp4 = pictures.filter((p) => p.kind === "fmp4");
    if (!fmp4.length) return "";
    const times: number[] = [];
    let available = true;
    for (const picture of fmp4) {
      const track = videoTrack(picture.init);
      const codec = picture.codec ?? undefined;
      const frames = track ? keyFrames(picture.data, track) : [];
      if (!track || !codec || !frames.length) continue;
      const result = await decodeKeyFrames(codec, track, frames);
      available = result.available;
      if (!available) break;
      times.push(...result.decodeMs.slice(0, 1));
    }
    if (!available) return " · VideoDecoder absent";
    const sorted = [...times].sort((a, b) => a - b);
    const median = sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : undefined;
    return (
      ` · VideoDecoder: ${String(times.length)} of ${String(fmp4.length)} decode` +
      (median === undefined ? "" : `, median ${median.toFixed(1)} ms each with its own decoder`)
    );
  }

  private async _keyLine(label: string): Promise<{ text: string; short: string }> {
    const player = this._t.player;
    const item = player?.current;
    const source = item?.mse;
    if (!player || !item || !source) {
      const why = "nothing playing through MSE (the file player has no fragments to read)";
      return { text: `${label} skipped: ${why}`, short: `${label} skipped` };
    }
    const at = Math.round(Math.max(0, (player.time ?? item.start) - item.start));
    try {
      const window = await source.fetch(`${source.base}/frags?at=${String(at)}&ms=${String(KEY_WINDOW_MS)}&bytes=${String(KEY_WINDOW_BYTES)}`);
      const from = window.headers.get("X-RV-Source") ?? "file";
      const init = await source.fetch(`${source.base}/init?source=${from}`);
      if (!window.ok || !init.ok) {
        const line = `${label}: the fragments did not come (HTTP ${String(window.status)}, init ${String(init.status)})`;
        return { text: line, short: `${label} not read` };
      }
      const track = videoTrack(new Uint8Array(await init.arrayBuffer()));
      const codec = videoCodec(init.headers.get("X-RV-Mime") ?? "");
      if (!track || !codec) return { text: `${label}: no video track in the init segment`, short: `${label} not read` };
      const frames = keyFrames(new Uint8Array(await window.arrayBuffer()), track);
      if (!frames.length) return { text: `${label}: no key frame in ${span(KEY_WINDOW_MS)} of fragments`, short: `${label}: none` };
      this._checkStopped();
      const decoded = await decodeKeyFrames(codec, track, frames);
      const described = describeKeyFrames(label, codec, track, frames, decoded);
      return { text: `${described.text} · from the ${from}`, short: described.short };
    } catch (err) {
      if (err instanceof Stopped) throw err;
      return { text: `${label}: ${toError(err).message}`, short: `${label} failed` };
    }
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
    const key = await this._keyLine("HD");
    this._log(`     K ${key.text}`);
    this._summary.push(`Key frames: ${key.short}`);
    await this._pause(5000);
    const sd = await this._switchTo("sub");
    this._log(`     Back to SD at ${clock(sd.at)}: ${sd.line}`);
    if (!sd.ok) this._log(`     ${videoState(t.player)}`);
    this._summary.push(`HD switch: to HD ${hd.short}; back to SD ${sd.short}`);
    if (!sd.ok) {
      this._plain.push({
        grade: "problem",
        text: `Going back from HD to SD failed (${sd.line.replace(/^FAILED: /, "").replace(/ \(back on the sub stream\)$/, "")}).`,
        advice: "Pressing SD again, or playing another moment, plays it. Include the details below if you report it.",
      });
    }
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
    // MSE: the fragments the player reads, from the start of what is on disk
    // (a clip waits for the whole recording, which after a deep start may be
    // in two pieces). Else the file player's URL, read with Range.
    const t = this._t;
    const playing = t.playing;
    const fetchWithAuth = t.hass.fetchWithAuth?.bind(t.hass);
    const base = playing?.base;
    const url = playing?.url ?? playing?.clip_url;
    let read: ((signal: AbortSignal) => Promise<Response>) | undefined;
    let what = "of the cached recording";
    if (base && fetchWithAuth) {
      what = "of fragments";
      read = (signal) => fetchWithAuth(`${base}/frags?first=0&ms=${String(LINK_WINDOW_MS)}&bytes=${String(LINK_BYTES)}`, { cache: "no-store", signal });
    } else if (url) {
      read = (signal) => fetch(url, { headers: { Range: `bytes=0-${String(LINK_BYTES - 1)}` }, cache: "no-store", signal });
    }
    if (!read) {
      this._log("L  skipped: nothing played");
      return;
    }
    const began = performance.now();
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, LINK_MS);
    try {
      const response = await read(controller.signal);
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
        `L  Link to Home Assistant: ${mb(bytes)} ${what} in ${ms(total - firstByte)} after the answer` +
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

  /**
   * How busy Home Assistant was around a start (v0.62.2): the longest its
   * event loop was held in the last 10 s, and the downloads from the
   * recorder and plain-copy rewrites running then. A held loop answers every
   * request late; it is noted in "In short" from half a second.
   */
  private async _busy(): Promise<string> {
    const stats = await this._stats();
    const held = stats?.loop?.held_10s_ms ?? undefined;
    const vod = stats?.vod;
    const parts = [
      held === undefined
        ? "its event loop not measured (Home Assistant runs an older Reolink Viewer)"
        : `its event loop held up to ${ms(held)} in the last 10 s`,
    ];
    if (vod?.filling !== undefined) {
      parts.push(
        `${count(vod.filling, "download")} from the recorder` +
          (vod.prefetching ? ` (${String(vod.prefetching)} for no viewer: next files, warm hours)` : ""),
      );
    }
    if (vod?.rewriting) parts.push(count(vod.rewriting, "plain-copy rewrite"));
    if (held !== undefined && held >= BUSY_NOTE_MS) this._noteBusy(held);
    return `Home Assistant: ${parts.join(" · ")}`;
  }

  /** "In short" says once that Home Assistant was busy, with the longest hold seen. */
  private _noteBusy(heldMs: number): void {
    if (this._busyNote && heldMs <= this._busiest) return;
    this._busiest = heldMs;
    const text = `Home Assistant itself was busy during some starts: its event loop was held up to ${secondsText(heldMs)}, so it answered late (see the "Home Assistant:" lines).`;
    if (this._busyNote) {
      this._busyNote.text = text;
    } else {
      this._busyNote = { grade: "note", text };
      this._plain.push(this._busyNote);
    }
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

/**
 * The video on screen and its MSE feed, for a failure's report: what the
 * browser has (ready state, buffered ranges in the recording, its end) and
 * what was fetched.
 */
export function videoState(player: RvPlayer | null): string {
  const video = activeVideo(player);
  if (!video) return "video: none on screen";
  const ranges: string[] = [];
  for (let i = 0; i < video.buffered.length; i += 1) {
    ranges.push(`${video.buffered.start(i).toFixed(1)}–${video.buffered.end(i).toFixed(1)} s`);
  }
  const error = video.error ? `, error ${String(video.error.code)}${video.error.message ? ` (${video.error.message})` : ""}` : "";
  const feed = player?.mseStats;
  return (
    `video: at ${video.currentTime.toFixed(1)} s of ${Number.isFinite(video.duration) ? video.duration.toFixed(1) : String(video.duration)} s, ` +
    `ready state ${String(video.readyState)}, network ${String(video.networkState)}, ${video.paused ? "paused" : "not paused"}` +
    `${video.ended ? ", ended" : ""}${video.seeking ? ", seeking" : ""}, buffered [${ranges.join(", ") || "nothing"}]${error}` +
    (feed
      ? ` · MSE (${feed.api}): ${String(feed.windows)} windows, ${mb(feed.bytes)}, from the ${feed.source}, ${feed.fetching ? "fetching" : "not fetching"}, ${feed.ahead.toFixed(1)} s ahead`
      : " · not through MSE")
  );
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
export function requestReport(began: number, playedUrl: string | undefined): string {
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
    // The server's own time to its answer (v0.62.2; secure pages only, and
    // not every browser has it).
    const timings = e.serverTiming as readonly PerformanceServerTiming[] | undefined;
    const own = timings?.find((st) => st.name === "rv")?.duration;
    return (
      `#${i + 1}${other} +${Math.round(e.startTime - began)} ms: wait ${Math.round(e.requestStart - e.startTime)}` +
      ` · answer ${Math.round(e.responseStart - e.requestStart)}${own === undefined ? "" : ` (server ${Math.round(own)})`}` +
      ` · ran ${Math.round(e.responseEnd - e.responseStart)} ms${size}`
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

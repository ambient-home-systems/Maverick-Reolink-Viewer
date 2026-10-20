// The playback check: measures playback on the device it runs on and writes a
// report, for the Phase 2B gate (docs/IMPLEMENTATION_PLAN.md).
//
// It runs inside the panel (Playback tab → Debug → Run playback check), so it
// works where there is no developer console, as in the iOS Companion app. It
// drives the tab like a user would (read-only: it loads timelines and plays
// recordings) and saves its report on the server as it goes, so a run on a
// phone can be copied on a desktop, and a run cut short by a page reload (iOS
// under memory pressure) keeps what it measured.
import { fetchMediaInfo, fetchTimelineDay, toError } from "../api";
import type { CacheStatus, HomeAssistant, MediaInfo, PlaybackUrl, Segment, TimelineDay, Timing } from "../types";
import {
  browserLabel,
  bufferedSeconds,
  classifyHost,
  deepTarget,
  describeRate,
  longRecordings,
  mb,
  ms,
  slope,
  smooth,
  SMOOTH_RULE,
  span,
  touchingPairs,
  within,
  type RateSample,
} from "./check-util";
import type { StreamDecision } from "./codec";
import { SHAPES, mseApi, mseSupports, pickSample, probeShape, type MseApi } from "./mse-probe";
import type { RvPlayer } from "./player";

export const CHECK_VERSION = "0.2.8";
export const SETUPS = [
  "Desktop Chrome, LAN",
  "iPhone app, Wi-Fi (local)",
  "iPhone app, Tailscale",
  "iPhone app, Nabu Casa",
  "Other",
] as const;
export const RATES = [0.5, 1, 2, 4, 8] as const;
const RATE_MS = 6_000;
const SAMPLE_MS = 60_000;
const LINK_BYTES = 4 * 1024 * 1024;
const SAVE_EVERY_MS = 10_000;
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
  readonly monthDays: ReadonlySet<number>;
  readonly player: RvPlayer | null;
  readonly playing: PlaybackUrl | undefined;
  selectDate(date: string): void;
  playAt(time: number, requestedAt?: number): Promise<void>;
}

export interface CheckOptions {
  setup: string;
  /** Minutes of continuous playback to sample memory and disk (0: none). */
  soakMinutes: number;
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

class Stopped extends Error {}

const sleep = (time: number) => new Promise<void>((resolve) => setTimeout(resolve, time));
const clock = (time: number) => new Date(time).toLocaleTimeString();

export class PlaybackCheck {
  readonly id: string;
  readonly lines: string[] = [];
  running = false;
  private _stopped = false;
  private _lastSave = 0;
  private _saving: Promise<void> = Promise.resolve();
  private _long: Long | undefined;
  private readonly _summary: string[] = [];

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
      await this._timelines();
      await this._events();
      await this._deep();
      await this._advance();
      await this._rates();
      await this._link();
      await this._capabilities();
      if (this.options.soakMinutes > 0) await this._soak();
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
    this._log(`User agent: ${navigator.userAgent}`);
    this._log(`Delivery: ${t.progressive ? "progressive" : "whole file first (WebKit)"}`);
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
    this._summary.push(
      `Timeline: today ${within(a1.timelineMs, 1000)}, past day first ${within(a2.timelineMs, cold ? 3000 : 1000)}` +
        ` (${cold ? "cold, < 3 s" : "cached, < 1 s"}), again ${within(a3.timelineMs, 1000)}`,
    );
  }

  /** Play from a time and wait for the first frame; returns the report line's middle. */
  private async _play(time: number): Promise<{ ok: boolean; line: string; began: number }> {
    const t = this._t;
    performance.clearResourceTimings();
    performance.setResourceTimingBufferSize(1000);
    const began = performance.now();
    const watch = watchVideo(t.player, began);
    await t.playAt(time, began);
    const ok = await this._wait(() => t.metrics.firstFrameMs !== undefined || Boolean(t.playFailure), 120_000);
    watch.stop();
    const m = t.metrics;
    const line =
      `first frame ${ok && !t.playFailure ? ms(m.firstFrameMs) : "none"}` +
      ` [URL ${ms(m.urlMs)} · metadata ${ms(watch.seen.loadedmetadata)} · seeked ${ms(watch.seen.seeked)} · playing ${ms(watch.seen.playing)}]` +
      ` ${m.delivery ?? "?"} · ${m.stream ?? "?"} ${m.codec ?? ""}${t.playFailure ? ` FAILED: ${t.playFailure}` : ""}`;
    return { ok: ok && !t.playFailure, line, began };
  }

  private async _events(): Promise<void> {
    const t = this._t;
    const day = t.day;
    const events = (day?.events ?? []).slice(-3).reverse();
    if (!day || !events.length) {
      this._log("B  skipped: no events today");
      return;
    }
    const times: number[] = [];
    for (const ev of events) {
      const seg = day.segments.find((s) => ev.start >= s.start && ev.start < s.end);
      const where = seg ? `${span(ev.start - seg.start)} into a ${span(seg.end - seg.start)} recording` : "no recording";
      const played = await this._play(ev.start);
      if (played.ok && t.metrics.firstFrameMs !== undefined) times.push(t.metrics.firstFrameMs);
      this._log(`B  ${ev.types.join("+")} at ${clock(ev.start)} (${where}): ${played.line}`);
      await sleep(300);
      this._log(`     ${requestReport(played.began, t.playing?.url)}`);
      if (seg) this._log(`     ${await this._fillReport(day.date, seg.id)}`);
      await this._pause(1500);
    }
    this._summary.push(`Events → first frame (sub): ${times.map((v) => within(v, 2000)).join(", ") || "none played"}`);
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

  /** The server's record of a recording's download, once it and its rewrite are done. */
  private async _fillReport(date: string, segmentId: string): Promise<string> {
    let cache: CacheStatus | null = null;
    for (let i = 0; i < 90; i += 1) {
      cache = (await this._peek(date, segmentId))?.cache ?? null;
      if (!cache || cache.error || (cache.complete && cache.flat !== undefined)) break;
      await this._pause(1000);
    }
    if (!cache) return "server: not cached";
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
    if (cache.indexed !== undefined) parts.push(`index ${text(cache.indexed)}`);
    parts.push(`plain MP4 ${cache.flat === undefined ? "not yet" : text(cache.flat)}`);
    if (typeof cache.flat_ms === "number") parts.push(`rewrite ${ms(cache.flat_ms)}`);
    if (typeof cache.flat_moov_bytes === "number") parts.push(`moov ${mb(cache.flat_moov_bytes)}`);
    if (cache.error) parts.push(`error ${cache.error}`);
    return `server: ${parts.join(", ")}`;
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
    if (!long.cached) {
      const target = deepTarget(seg, long.day.events, 0.5, 0.95, 0.75);
      const played = await this._play(target.time);
      if (played.ok) uncachedMs = t.metrics.firstFrameMs;
      this._log(`D1 Not cached, ${describe(target)}: ${played.line}`);
      await sleep(300);
      this._log(`     ${requestReport(played.began, t.playing?.url)}`);
      this._log(`     ${await this._fillReport(long.date, seg.id)}`);
    } else {
      this._log("D1 skipped: every long recording looked at is cached already (try again after other recordings were viewed)");
    }
    await this._pause(1500);
    const target = deepTarget(seg, long.day.events, 0.1, 0.45, 0.4);
    const played = await this._play(target.time);
    const cachedMs = played.ok ? t.metrics.firstFrameMs : undefined;
    this._log(`D2 Cached, ${describe(target)}: ${played.line}`);
    await sleep(300);
    this._log(`     ${requestReport(played.began, t.playing?.url)}`);
    this._summary.push(
      `Deep start (sub, ${length} recording): not cached ${uncachedMs === undefined ? "not measured" : ms(uncachedMs)}` +
        `, cached ${within(cachedMs, 2000)}`,
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
  }

  private async _measureRate(video: HTMLVideoElement, rate: number): Promise<RateSample> {
    video.playbackRate = rate;
    const applied = video.playbackRate;
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
    };
  }

  private async _link(): Promise<void> {
    const url = this._t.playing?.url;
    if (!url) {
      this._log("L  skipped: nothing played");
      return;
    }
    const began = performance.now();
    try {
      const response = await fetch(url, { headers: { Range: `bytes=0-${LINK_BYTES - 1}` }, cache: "no-store" });
      const firstByte = performance.now() - began;
      const body = await response.arrayBuffer();
      const total = performance.now() - began;
      const mbit = (body.byteLength * 8) / (total * 1000);
      this._log(
        `L  Link to Home Assistant: ${mb(body.byteLength)} of the cached recording in ${ms(total)}` +
          ` = ${mbit.toFixed(1)} Mbit/s (answer ${ms(firstByte)}, HTTP ${response.status})`,
      );
      this._summary.push(`Link: ${mbit.toFixed(1)} Mbit/s`);
    } catch (err) {
      this._log(`L  Link test failed: ${toError(err).message}`);
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
    this._log(`HD: ${t.hd.reason}`);
    if (info.main?.width && info.main.height && main) {
      this._log(`HD decodingInfo for ${main} at ${info.main.width}×${info.main.height}: ${await decoding(main, info.main.width, info.main.height)}`);
    }
    this._summary.push(`HD: ${t.hd.main ? "offered" : "not offered"} (${t.hd.reason})`);
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
    const dropped = new Map<HTMLVideoElement, { decoded: number; dropped: number }>();
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
        for (const v of videos) {
          const q = playbackQuality(v);
          if (q) dropped.set(v, { decoded: q.totalVideoFrames, dropped: q.droppedVideoFrames });
        }
        const buffered = active ? Math.max(0, bufferedEnd(active) - active.currentTime) : 0;
        maxBuffered = Math.max(maxBuffered, buffered);
        const memory = heap();
        if (memory !== undefined) heaps.push([(performance.now() - began) / 3_600_000, memory]);
        const stats = await this._stats();
        if (stats?.vod.disk_bytes !== undefined) disks.push(stats.vod.disk_bytes);
        const totals = [...dropped.values()].reduce(
          (sum, q) => ({ decoded: sum.decoded + q.decoded, dropped: sum.dropped + q.dropped }),
          { decoded: 0, dropped: 0 },
        );
        const held = videos.reduce((sum, v) => sum + bufferedSeconds(v.buffered), 0);
        this._log(
          `M  ${minute} min: ${t.player?.time !== undefined ? clock(t.player.time) : "?"} ${t.player?.paused ? "paused" : "playing"}` +
            (document.visibilityState === "visible" ? "" : " (page hidden: the system pauses video)") +
            ` · heap ${memory === undefined ? "n/a" : mb(memory)} · ${buffered.toFixed(0)} s ahead, ${held.toFixed(0)} s held in both videos` +
            ` · dropped ${totals.dropped} of ${totals.decoded} · ${stalls} stalls · ${advances} file changes` +
            (stats ? ` · cache ${mb(stats.vod.disk_bytes)} on disk + ${mb(stats.vod.reserved_bytes)} reserved, ${stats.vod.leased ?? "?"} leased` : ""),
        );
        markRunning(this.id, this.options.setup, minute);
      }
    } finally {
      videos.forEach((v) => {
        v.removeEventListener("waiting", onWaiting);
      });
      player?.removeEventListener("rv-advanced", onAdvanced);
    }
    const growth = slope(heaps);
    const heapLine = heaps.length
      ? `heap ${mb(heaps[0]?.[1])} → ${mb(heaps.at(-1)?.[1])} (max ${mb(Math.max(...heaps.map(([, v]) => v)))}${growth === undefined ? "" : `, ${growth >= 0 ? "+" : ""}${mb(growth)}/h`})`
      : "heap not measurable in this browser (the page was not reloaded)";
    const totals = [...dropped.values()].reduce((sum, q) => sum + q.dropped, 0);
    const cap = (await this._stats())?.vod.max_bytes;
    const diskLine = disks.length ? `cache ${mb(Math.min(...disks))}–${mb(Math.max(...disks))} on disk (cap ${mb(cap)})` : "cache use unknown";
    const line =
      `${minutes} min: ${heapLine}, at most ${maxBuffered.toFixed(0)} s buffered ahead, ${totals} frames dropped, ${stalls} stalls,` +
      ` ${advances} file changes${gaps.length ? ` (gaps ${gaps.map((g) => ms(g)).join(", ")})` : ""}, ${diskLine}`;
    this._log(`M  Summary: ${line}`);
    this._summary.push(`Session: ${line}`);
  }

  private async _stats(): Promise<{ vod: Record<string, number | undefined> } | undefined> {
    try {
      return await this._t.hass.callWS({ type: "reolink_viewer/playback/stats" });
    } catch {
      return undefined;
    }
  }
}

// ---- Browser measurements ----

const yes = (value: boolean | undefined) => (value === undefined ? "n/a" : value ? "yes" : "no");

/** A server value for the report (strings and numbers; anything else "?"). */
const text = (value: unknown): string =>
  typeof value === "string" || typeof value === "number" ? String(value) : "?";

function heap(): number | undefined {
  const memory = (performance as { memory?: { usedJSHeapSize?: number } }).memory;
  return memory?.usedJSHeapSize;
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
    (e) => e.initiatorType === "video" && e.startTime >= began - 5,
  );
  if (!entries.length) return "requests: none reported (this browser may not report video requests)";
  const sent = entries.filter((e) => e.requestStart > 0);
  const parts = sent.slice(0, 10).map((e, i) => {
    const other = path && new URL(e.name).pathname === path ? "" : " (other file)";
    const size = e.encodedBodySize ? ` · ${mb(e.encodedBodySize)}` : "";
    return (
      `#${i + 1}${other} +${Math.round(e.startTime - began)} ms: wait ${Math.round(e.requestStart - e.startTime)}` +
      ` · answer ${Math.round(e.responseStart - e.requestStart)} · ran ${Math.round(e.responseEnd - e.responseStart)} ms${size}`
    );
  });
  const more = sent.length > 10 ? ` | … ${sent.length - 10} more` : "";
  const unsent = entries.length - sent.length;
  return `requests: ${sent.length} sent${unsent ? `, ${unsent} cancelled before sending` : ""}: ${parts.join(" | ")}${more}`;
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

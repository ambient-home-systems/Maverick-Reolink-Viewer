import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from "lit";

import {
  fetchCacheStatus,
  fetchMediaInfo,
  fetchPlaybackMse,
  fetchPlaybackUrl,
  fetchThumbnailUrls,
  fetchTimelineDay,
  fetchTimelineDays,
  prefetchSegment,
  releasePlayback,
  toError,
  urlToken,
  type SegmentRef,
} from "../api";
import { copyText } from "../clipboard";
import {
  PlaybackCheck,
  SETUPS,
  fetchCheckReports,
  hdByDefault,
  noteInterruptedCheck,
  type CheckOptions,
  type CheckTarget,
  type SavedReport,
} from "../playback/check";
import { deviceSetup } from "../playback/check-util";
import { canPlayMain, playsProgressive, type StreamDecision } from "../playback/codec";
import "../playback/calendar";
import "../playback/event-list";
import { mseApiName } from "../playback/mse-feeder";
import "../playback/player";
import {
  RATES,
  type AdvanceDetail,
  type FirstFrameDetail,
  type PlayItem,
  type PlayerErrorDetail,
  type RvPlayer,
} from "../playback/player";
import { ThumbLoader } from "../playback/thumb-loader";
import { dateIn, firstDayOfWeek, formatClock, formatStamp } from "../playback/time";
import "../playback/timeline";
import type { HoverDetail, RvTimeline, TimeDetail } from "../playback/timeline";
import {
  DAY,
  MINUTE,
  centreOn,
  clampView,
  filterEvents,
  nextEvent,
  playTarget,
  presentTypes,
  previousEvent,
  segmentAt,
  shownTypes,
  stepZoom,
  thumbBucket,
  typeLabel,
  type View,
} from "../playback/timeline-math";
import { icon } from "../icons";
import { explainPlayback, explainRecordings } from "../playback/explain";
import { pipSupported } from "../pip";
import { parseInShort } from "../plain";
import { problem } from "../problem";
import { sharedStyles } from "../styles";
import type { CacheStatus, HomeAssistant, PlaybackUrl, Segment, Stream, TimelineDay, Timing } from "../types";
import { LIVE_REPORT_PREFIX } from "../live/check-util";
import { dayLabel, shortDay } from "./events-view";
import "./findings";
import { toast } from "./navigation";
import { pictogram } from "./timetable";

/** Re-read today's timeline this often while the tab is open. */
export const TODAY_REFRESH_MS = 60_000;
/**
 * While a recording is still downloading it is streamed without a length, and
 * the browser cannot seek in it (playback silently starts at 0:00). A start
 * further into the file than this asks for the whole file first instead.
 */
export const PROGRESSIVE_SEEK_LIMIT_MS = 3_000;
/** After the NVR's event search failed, ask again this soon (not a minute later). */
export const EVENTS_RETRY_MS = 10_000;
/** Quick retries in a row before the normal refresh takes over. */
export const EVENTS_RETRIES = 3;
/** Show a copy of today up to this old (s) at once, then refresh it quietly. */
export const STALE_TODAY_S = 86_400;
/** Recordings at least this long are on continuously recording cameras. */
const LONG_RECORDING_MS = 10 * MINUTE;
/** Thumbnails of the event list: one per 10 s. */
const EVENT_THUMB_BUCKET = 10;
/** Thumbnail loads wait at most this long for a recording to start. */
export const THUMB_PAUSE_MAX_MS = 8_000;
/**
 * The next recording's URL is asked for this close to the current one's end
 * (in media time): a URL asked for at the start of an hour-long recording
 * expired before it was needed. Its cache fill is started at once instead.
 */
export const PRELOAD_LEAD_MS = 3 * MINUTE;
/** A recording that fails mid-way is reloaded where it was, once a minute at most. */
export const RECOVER_EVERY_MS = 60_000;
/** Minutes of the playback check's optional session (memory and disk). */
export const CHECK_SESSION_MIN = 60;
/** While a start waits for the recorder, its download is shown this often. */
export const PROGRESS_EVERY_MS = 1_000;
/**
 * A seek within the recording on screen (MSE) needs no new URL, if the copy
 * playing reaches the time by this much (a recording still being written).
 */
const SEEK_WITHIN_MARGIN_MS = 60_000;
const CHECK_SETUP_KEY = "reolink-viewer-check-setup";
const PLAYER_MODE_KEY = "reolink-viewer-player";

/** "auto": MSE where the browser has it (else the file player); "file": always the file player. */
export type PlayerMode = "auto" | "file";
/** A check cut short is looked for once per page load. */
let interruptedLookedFor = false;

export interface Metrics {
  timelineMs?: number;
  timelineServer?: Timing;
  urlMs?: number;
  firstFrameMs?: number | undefined;
  gapMs?: number | undefined;
  stream?: Stream;
  cache?: CacheStatus | undefined;
  codec?: string | null;
  hd?: string;
  delivery?: string;
  note?: string;
  /** Mid-play read failures recovered by reloading (URL expired, network). */
  recoveries?: number;
  lastRecovery?: string;
  /** Switches from the MSE player to the file player, and why. */
  fallbacks?: number;
  lastFallback?: string;
  /** HD failures (back to the sub stream), and why. */
  hdFailures?: number;
  lastHdFailure?: string;
}

/**
 * The Playback tab of a camera with recordings (its playback source: the NVR
 * for merged cameras): calendar, day timeline, event list and a player.
 */
export class RvPlayback extends LitElement {
  static override properties = {
    hass: { attribute: false },
    deviceId: { attribute: false },
    cameraName: { attribute: false },
    at: { attribute: false },
    offline: { attribute: false },
    storage: { attribute: false },
    recorder: { attribute: false },
    _date: { state: true },
    _day: { state: true },
    _error: { state: true },
    _playFailure: { state: true },
    _loading: { state: true },
    _view: { state: true },
    _cursor: { state: true },
    _only: { state: true },
    _month: { state: true },
    _monthDays: { state: true },
    _monthLoading: { state: true },
    _stream: { state: true },
    _hd: { state: true },
    _playing: { state: true },
    _hover: { state: true },
    _thumbs: { state: true },
    _metrics: { state: true },
    _checkText: { state: true },
    _checkRunning: { state: true },
    _checkSetup: { state: true },
    _checkSession: { state: true },
    _checkHdPart: { state: true },
    _checkNote: { state: true },
    _reports: { state: true },
    _rate: { state: true },
    _note: { state: true },
    _mode: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  declare deviceId: string;
  declare cameraName: string;
  /** A time to play once its day is loaded (an event opened from the timetable). */
  declare at: number | undefined;
  /** Its recordings are on its own SD card, and Home Assistant cannot reach it. */
  declare offline: boolean;
  /** The disk or SD card keeping its recordings: not ready is said above the timeline. */
  declare storage: "ready" | "not_ready" | "none" | null;
  /** What keeps the recordings: its own SD card or an NVR. */
  declare recorder: "camera" | "nvr";
  declare _date: string;
  declare _day: TimelineDay | undefined;
  declare _error: string | undefined;
  /** Why the last play attempt failed, until the next one starts. */
  declare _playFailure: string | undefined;
  declare _loading: boolean;
  declare _view: View;
  declare _cursor: number | undefined;
  /** Only events showing one of these types (`shownTypes`; none: all). */
  declare _only: ReadonlySet<string>;
  declare _month: { year: number; month: number };
  declare _monthDays: ReadonlySet<number>;
  declare _monthLoading: boolean;
  declare _stream: Stream;
  declare _hd: StreamDecision;
  declare _playing: PlaybackUrl | undefined;
  declare _hover: { x: number; time: number; url?: string; gap?: boolean } | undefined;
  declare _thumbs: ReadonlyMap<number, string>;
  declare _metrics: Metrics;
  declare _checkText: string;
  declare _checkRunning: boolean;
  declare _checkSetup: string;
  declare _checkSession: boolean;
  /** The check switches to HD and back (the server fetches a main recording). */
  declare _checkHdPart: boolean;
  declare _checkNote: string | undefined;
  declare _reports: SavedReport[] | undefined;
  /** Playback speed. */
  declare _rate: number;
  /** Over the video while a start waits (the recorder's download). */
  declare _note: string | undefined;
  declare _mode: PlayerMode;

  private _daySeq = 0;
  /** The `at` already played (it plays once). */
  private _openedAt: number | undefined;
  private _playSeq = 0;
  private _hoverSeq = 0;
  private _monthSeq = 0;
  private _thumbsRequested = new Set<number>();
  /** Loads event thumbnails a few at a time (replaceable in tests). */
  thumbLoader = new ThumbLoader();
  private _thumbPause: ReturnType<typeof setTimeout> | undefined;
  private _eventsRetry: ReturnType<typeof setTimeout> | undefined;
  private _eventsRetries = 0;
  private _refreshTimer: ReturnType<typeof setInterval> | undefined;
  private _lastCursorPaint = 0;
  private readonly _progressive = playsProgressive();
  private _check: PlaybackCheck | undefined;
  /** The play request whose recording is being fetched, if any. */
  private _starting: number | undefined;
  /** A recording whose successor's URL is asked for near its end. */
  private _preloadPending: { segment: Segment; seq: number } | undefined;
  private _recoveredAt = -Infinity;
  /** Streams whose recordings the MSE player could not play here. */
  private readonly _mseFailed = new Set<Stream>();
  private _lastPreview = 0;

  constructor() {
    super();
    this.deviceId = "";
    this.cameraName = "";
    this._date = "";
    this._loading = false;
    this._view = { start: 0, span: DAY };
    this.offline = false;
    this.storage = null;
    this.recorder = "camera";
    this._only = new Set();
    const now = new Date();
    this._month = { year: now.getFullYear(), month: now.getMonth() + 1 };
    this._monthDays = new Set();
    this._monthLoading = false;
    this._stream = "sub";
    this._hd = { main: false, reason: "checking…" };
    this._thumbs = new Map();
    this._metrics = {};
    this._checkText = "";
    this._checkRunning = false;
    this._checkSetup = rememberedSetup();
    this._checkSession = false;
    this._checkHdPart = hdByDefault(this._checkSetup);
    this._rate = 1;
    this._mode = rememberedMode();
  }

  private get _zone(): string | undefined {
    return this.hass?.config?.time_zone;
  }

  private get _today(): string {
    return dateIn(Date.now(), this._zone);
  }

  private get _player(): RvPlayer | null {
    return this.renderRoot.querySelector("rv-player");
  }

  private get _timeline(): RvTimeline | null {
    return this.renderRoot.querySelector("rv-timeline");
  }

  private get _events() {
    return filterEvents(this._day?.events ?? [], this._only);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this._refreshTimer = setInterval(() => {
      if (this._date === this._today && document.visibilityState !== "hidden") {
        void this._loadDay(this._date, { keepView: true, quiet: true });
      }
    }, TODAY_REFRESH_MS);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    clearInterval(this._refreshTimer);
    this._player?.stop();
    this.thumbLoader.clear();
    clearTimeout(this._thumbPause);
    clearTimeout(this._eventsRetry);
    this._check?.stop();
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if ((changed.has("deviceId") || changed.has("hass")) && this.hass && this.deviceId && !this._date) {
      this._date = this.at !== undefined ? dateIn(this.at, this._zone) : this._today;
      const [year, month] = this._date.split("-").map(Number);
      if (year && month) this._month = { year, month };
      void this._loadDay(this._date).then(() => {
        this._openAt();
      });
      void this._loadMonth(this._month.year, this._month.month);
      void this._checkHd();
      if (!interruptedLookedFor) {
        interruptedLookedFor = true;
        void noteInterruptedCheck(this.hass).then((note) => {
          this._checkNote = note;
        });
      }
    } else if (changed.has("at") && this.at !== undefined && this._date) {
      const date = dateIn(this.at, this._zone);
      if (date === this._date) this._openAt();
      else
        void this._selectDate(date).then(() => {
          this._openAt();
        });
    }
  }

  /** Play the time asked for, once, when its day is on show. */
  private _openAt(): void {
    const at = this.at;
    const day = this._day;
    if (at === undefined || at === this._openedAt || !day || dateIn(at, this._zone) !== day.date) return;
    this._openedAt = at;
    this._cursor = at;
    this._view = centreOn(this._view, at, day);
    void this.playAt(at);
  }

  // ---- Loading ----

  async _loadDay(date: string, options: { keepView?: boolean; quiet?: boolean } = {}): Promise<void> {
    const hass = this.hass;
    if (!hass) return;
    const seq = ++this._daySeq;
    const began = performance.now();
    let stale = false;
    if (!options.quiet) this._loading = true;
    try {
      const day = await fetchTimelineDay(hass, this.deviceId, date, options.quiet ? 0 : STALE_TODAY_S);
      if (seq !== this._daySeq) return;
      const first = !this._day || this._day.date !== day.date;
      this._day = day;
      this._error = undefined;
      if (first || !options.keepView) {
        this._view = clampView({ start: day.start, span: day.end - day.start }, day);
        const latest = day.events.at(-1)?.start ?? day.segments.at(-1)?.start;
        this._cursor = latest;
      } else {
        this._view = clampView(this._view, day);
      }
      await this.updateComplete;
      if (!options.quiet) {
        this._metrics = { ...this._metrics, timelineMs: performance.now() - began, timelineServer: day.timing };
      }
      this._warmLongRecording(day);
      stale = !options.quiet && day.timing.cache === "stale";
      this._retryEventsSoon(day);
    } catch (err) {
      if (seq === this._daySeq) this._error = toError(err).message;
    } finally {
      if (seq === this._daySeq) this._loading = false;
    }
    // Shown at once from an older copy: now fetch the current one.
    if (stale) await this._loadDay(date, { keepView: true, quiet: true });
  }

  /** The day's event search failed: search again shortly, quietly. */
  private _retryEventsSoon(day: TimelineDay): void {
    clearTimeout(this._eventsRetry);
    if (!day.events_error || day.complete) {
      this._eventsRetries = 0;
      return;
    }
    if (this._eventsRetries >= EVENTS_RETRIES) return;
    this._eventsRetries += 1;
    this._eventsRetry = setTimeout(() => {
      if (this._date === day.date) void this._loadDay(day.date, { keepView: true, quiet: true });
    }, EVENTS_RETRY_MS);
  }

  private async _loadMonth(year: number, month: number): Promise<void> {
    const hass = this.hass;
    if (!hass) return;
    const seq = ++this._monthSeq;
    this._month = { year, month };
    this._monthLoading = true;
    try {
      const result = await fetchTimelineDays(hass, this.deviceId, year, month);
      if (seq === this._monthSeq) this._monthDays = new Set(result.days);
    } catch {
      if (seq === this._monthSeq) this._monthDays = new Set();
    } finally {
      if (seq === this._monthSeq) this._monthLoading = false;
    }
  }

  private async _checkHd(): Promise<void> {
    const hass = this.hass;
    if (!hass) return;
    try {
      const info = await fetchMediaInfo(hass, this.deviceId);
      this._hd = await canPlayMain(info.main);
      this._metrics = { ...this._metrics, hd: this._hd.reason };
    } catch {
      this._hd = { main: false, reason: "main stream information unavailable" };
    }
  }

  /** On continuous cameras, start caching the recording at the cursor. */
  private _warmLongRecording(day: TimelineDay): void {
    const hass = this.hass;
    const seg = this._cursor !== undefined ? segmentAt(day.segments, this._cursor) : day.segments.at(-1);
    if (!hass || !seg || seg.end - seg.start < LONG_RECORDING_MS) return;
    prefetchSegment(hass, this._ref(seg)).catch(() => undefined);
  }

  private _ref(segment: Segment, stream: Stream = this._stream): SegmentRef {
    return { deviceId: this.deviceId, date: this._date, segmentId: segment.id, stream };
  }

  // ---- Playing ----

  /** Play from a time: inside a recording, or from the next one. */
  async playAt(time: number, requestedAt = performance.now()): Promise<void> {
    const hass = this.hass;
    const day = this._day;
    if (!hass || !day) return;
    const target = playTarget(day.segments, time);
    if (!target) {
      toast(this, "No recording after this time on this day");
      return;
    }
    const seq = ++this._playSeq;
    this._playFailure = undefined;
    this._pauseThumbs();
    // The video still on screen keeps reporting its time until the new one
    // starts: the start point is this, not whatever the cursor shows then.
    const wanted = target.segment.start + target.offset;
    this._cursor = wanted;
    if (this._seekWithin(target.segment, wanted, requestedAt)) {
      this._schedulePreload(target.segment, seq, wanted);
      return;
    }
    this._starting = seq;
    const began = performance.now();
    try {
      const mse = this._useMse(this._stream);
      const progressive = this._progressive && target.offset < PROGRESSIVE_SEEK_LIMIT_MS;
      const ref = this._ref(target.segment);
      const playback = mse
        ? await fetchPlaybackMse(hass, ref, wanted)
        : await fetchPlaybackUrl(hass, ref, progressive, wanted);
      if (seq !== this._playSeq) {
        this._release(playback);
        return;
      }
      this._playing = playback;
      this._metrics = {
        ...this._metrics,
        urlMs: performance.now() - began,
        firstFrameMs: undefined,
        gapMs: undefined,
        stream: playback.stream,
        cache: playback.cache,
        codec: playback.media?.codec ?? null,
        delivery: mse
          ? `MSE (${mseApiName() ?? "?"})${playback.cache.complete ? ", cached" : ""}`
          : deliveryOf(progressive, this._progressive, playback.cache.complete),
      };
      // Main and sub recordings start a few seconds apart: keep the wall time.
      const offset = Math.max(0, wanted - playback.start);
      await this._player?.play(this._toItem(playback), offset, requestedAt);
      void this._showDownload(playback, seq);
      this._schedulePreload(target.segment, seq, wanted);
    } catch (err) {
      if (seq === this._playSeq) this._playError(toError(err).message);
    } finally {
      if (this._starting === seq) this._starting = undefined;
    }
  }

  /**
   * A start inside the recording on screen, played through MSE: a seek (the
   * player fetches what it lacks), not a new URL. Returns whether it was one.
   */
  private _seekWithin(segment: Segment, wanted: number, requestedAt: number): boolean {
    const player = this._player;
    const item = player?.current;
    if (!player?.mse || !this._useMse(this._stream) || !item || item.segmentId !== segment.id) return false;
    if (this._playing?.stream !== this._stream) return false;
    // A copy of a recording still being written reaches only so far.
    if (item.end < segment.end && wanted > item.end - SEEK_WITHIN_MARGIN_MS) return false;
    this._metrics = {
      ...this._metrics,
      urlMs: 0,
      firstFrameMs: undefined,
      delivery: `MSE (${mseApiName() ?? "?"}), same recording`,
    };
    player.seekWithin(Math.max(0, wanted - item.start), requestedAt);
    return true;
  }

  /** Which player plays recordings, for the check's report. */
  _describeMode(): string {
    const api = mseApiName();
    if (this._mode === "file") return "file player only (set under Details)";
    if (!api) return "file player (this browser has no MSE)";
    if (typeof this.hass?.fetchWithAuth !== "function") return "file player (no authenticated fetch)";
    const failed = [...this._mseFailed];
    return `MSE (${api})${failed.length ? `, file player for ${failed.join(", ")} after a failure` : ""}`;
  }

  /** Whether to play a stream through MSE: the browser has it, it worked, it is wanted. */
  private _useMse(stream: Stream): boolean {
    return (
      this._mode === "auto" &&
      mseApiName() !== undefined &&
      typeof this.hass?.fetchWithAuth === "function" &&
      !this._mseFailed.has(stream)
    );
  }

  /** The player no longer needs a recording: its URL's lease can end. */
  private _release(playback: PlaybackUrl): void {
    const hass = this.hass;
    const token = urlToken(playback.base ?? playback.url ?? "");
    if (hass && token) releasePlayback(hass, [token]).catch(() => undefined);
  }

  private _toItem(playback: PlaybackUrl): PlayItem {
    const common = {
      recording: `${playback.stream}:${playback.segment_id}:${playback.end}`,
      segmentId: playback.segment_id,
      start: playback.start,
      end: playback.end,
      release: () => {
        this._release(playback);
      },
    };
    const hass = this.hass;
    if (playback.base && hass?.fetchWithAuth) {
      const fetchWithAuth = hass.fetchWithAuth.bind(hass);
      return {
        ...common,
        key: playback.base,
        mse: { base: playback.base, fetch: fetchWithAuth, durationMs: playback.end - playback.start },
      };
    }
    const url = playback.url ?? "";
    return { ...common, key: url, url };
  }

  /** While a start waits for the recorder's download, show how far it got. */
  private async _showDownload(playback: PlaybackUrl, seq: number): Promise<void> {
    const hass = this.hass;
    const token = urlToken(playback.base ?? playback.url ?? "");
    if (!hass || !token || playback.cache.complete) return;
    const waiting = () => seq === this._playSeq && this._metrics.firstFrameMs === undefined && !this._playFailure;
    while (waiting()) {
      await sleep(PROGRESS_EVERY_MS);
      if (!waiting()) break;
      try {
        const status = await fetchCacheStatus(hass, token);
        if (!waiting() || !status.cache || status.cache.complete || status.cache.error) break;
        const hd = playback.stream === "main" ? "HD " : "";
        this._note = `Fetching the ${hd}recording from the recorder: ${megabytes(status.cache.bytes)} of about ${megabytes(status.expected_bytes)}`;
      } catch {
        break;
      }
    }
    if (seq === this._playSeq) this._note = undefined;
    // Phase 5b: a start the device's cut served shows it in the debug panel.
    try {
      const status = await fetchCacheStatus(hass, token);
      if (seq === this._playSeq && status.cache?.cut) this._metrics = { ...this._metrics, cache: status.cache };
    } catch {
      // The panel keeps what it showed.
    }
  }

  /** Preload the next recording now, or near this one's end if that is far. */
  private _schedulePreload(segment: Segment, seq: number, from: number): void {
    this._preloadPending = undefined;
    const hass = this.hass;
    const next = this._nextSegment(segment);
    if (!hass || !next || segment.end - from <= PRELOAD_LEAD_MS) {
      void this._preloadAfter(segment, seq);
      return;
    }
    // Drop any older preload: it is not what comes after this recording.
    void this._player?.preload(undefined);
    prefetchSegment(hass, this._ref(next)).catch(() => undefined);
    this._preloadPending = { segment, seq };
  }

  private _nextSegment(segment: Segment): Segment | undefined {
    const segments = this._day?.segments ?? [];
    const index = segments.findIndex((s) => s.id === segment.id);
    return index >= 0 ? segments.at(index + 1) : undefined;
  }

  private async _preloadAfter(segment: Segment, seq: number): Promise<void> {
    const hass = this.hass;
    const next = this._nextSegment(segment);
    if (!hass || !next) {
      await this._player?.preload(undefined);
      return;
    }
    // Already waiting in the hidden buffer (e.g. after a seek in this recording).
    if (this._player?.preloaded?.recording.startsWith(`${this._stream}:${next.id}:`)) return;
    try {
      const ref = this._ref(next);
      const playback = this._useMse(this._stream)
        ? await fetchPlaybackMse(hass, ref, next.start)
        : await fetchPlaybackUrl(hass, ref, this._progressive, next.start);
      if (seq !== this._playSeq) {
        this._release(playback);
        return;
      }
      await this._player?.preload(this._toItem(playback));
    } catch {
      // Preloading is an optimisation: the next file is fetched when needed.
    }
  }

  private _onAdvanced(detail: AdvanceDetail): void {
    const segment = this._day?.segments.find((s) => s.id === detail.segmentId);
    this._metrics = { ...this._metrics, gapMs: detail.gapMs };
    if (segment) {
      this._cursor = segment.start;
      this._schedulePreload(segment, this._playSeq, segment.start);
    }
  }

  private _onEnded(segmentId: string | undefined): void {
    const segments = this._day?.segments ?? [];
    const index = segments.findIndex((s) => s.id === segmentId);
    const next = index >= 0 ? segments[index + 1] : undefined;
    if (next) void this.playAt(next.start);
  }

  /** Keep connections free for the recording until its first frame. */
  private _pauseThumbs(): void {
    this.thumbLoader.pause();
    clearTimeout(this._thumbPause);
    this._thumbPause = setTimeout(() => {
      this._resumeThumbs();
    }, THUMB_PAUSE_MAX_MS);
  }

  private _resumeThumbs(): void {
    clearTimeout(this._thumbPause);
    this.thumbLoader.resume();
  }

  /** The player failed: a read mid-way is retried where it was, else as below. */
  private _onPlayerError(detail: PlayerErrorDetail): void {
    if (detail.fallback && this._useMse(this._stream)) {
      // The MSE player cannot play this stream here: the file player takes over.
      this._mseFailed.add(this._stream);
      this._metrics = {
        ...this._metrics,
        fallbacks: (this._metrics.fallbacks ?? 0) + 1,
        lastFallback: detail.message,
      };
      const where = detail.played ? (this._player?.time ?? this._cursor) : this._cursor;
      if (where !== undefined) void this.playAt(where);
      return;
    }
    const at = this._player?.time;
    const now = performance.now();
    if (detail.played && at !== undefined && now - this._recoveredAt > RECOVER_EVERY_MS) {
      // E.g. its URL expired during a long pause, or the network dropped.
      this._recoveredAt = now;
      this._metrics = {
        ...this._metrics,
        recoveries: (this._metrics.recoveries ?? 0) + 1,
        lastRecovery: detail.message,
      };
      void this.playAt(at);
      return;
    }
    this._playError(detail.message);
  }

  private _playError(message: string): void {
    this._resumeThumbs();
    if (this._stream === "main") {
      this._stream = "sub";
      this._metrics = {
        ...this._metrics,
        hdFailures: (this._metrics.hdFailures ?? 0) + 1,
        lastHdFailure: message,
      };
      toast(this, `HD could not play: ${explainPlayback(message).text} Back to SD.`, "error");
      if (this._cursor !== undefined) void this.playAt(this._cursor);
      return;
    }
    this._playFailure = message;
    toast(this, explainPlayback(message).text, "error");
  }

  private _onTime(time: number): void {
    // While a new start is on its way, the old video's time is stale.
    if (this._starting !== undefined) return;
    // Repaint the cursor a few times a second, not on every timeupdate.
    const now = performance.now();
    if (now - this._lastCursorPaint < 250) return;
    this._lastCursorPaint = now;
    const pending = this._preloadPending;
    if (pending && pending.seq === this._playSeq && pending.segment.end - time <= PRELOAD_LEAD_MS) {
      this._preloadPending = undefined;
      void this._preloadAfter(pending.segment, pending.seq);
    }
    this._cursor = time;
    if (time > this._view.start + this._view.span || time < this._view.start) {
      this._view = centreOn(this._view, time, this._day ?? { start: time, end: time + this._view.span });
    }
  }

  /** Dragging the cursor: move it, and show the frame there if it is buffered. */
  private _onScrub(time: number): void {
    this._cursor = time;
    const now = performance.now();
    if (now - this._lastPreview < 80) return;
    this._lastPreview = now;
    this._player?.preview(time);
  }

  private _jump(direction: 1 | -1): void {
    const from = this._cursor ?? this._view.start;
    const event = direction > 0 ? nextEvent(this._events, from) : previousEvent(this._events, from);
    if (!event) {
      toast(this, direction > 0 ? "No later event" : "No earlier event");
      return;
    }
    this._cursor = event.start;
    if (this._day) this._view = centreOn(this._view, event.start, this._day);
    void this.playAt(event.start);
  }

  private _setRate(rate: number): void {
    this._rate = rate;
  }

  private _setMode(mode: PlayerMode): void {
    this._mode = mode;
    this._mseFailed.clear();
    rememberMode(mode);
    const at = this._player?.time ?? this._cursor;
    if (this._playing && at !== undefined) void this.playAt(at);
  }

  private _setStream(stream: Stream): void {
    if (stream === this._stream) return;
    this._stream = stream;
    const at = this._player?.time ?? this._cursor;
    if (this._playing && at !== undefined) void this.playAt(at);
  }

  private _changeDay(delta: number): void {
    const [y, m, d] = this._date.split("-").map(Number);
    if (!y || !m || !d) return;
    const next = new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
    if (next > this._today) return;
    void this._selectDate(next);
  }

  private _selectDate(date: string): Promise<void> {
    this._date = date;
    this._player?.stop();
    this._playing = undefined;
    this._preloadPending = undefined;
    this.thumbLoader.clear();
    this._thumbs = new Map();
    this._thumbsRequested.clear();
    const loading = this._loadDay(date);
    const [year, month] = date.split("-").map(Number);
    if (year && month && (year !== this._month.year || month !== this._month.month)) {
      void this._loadMonth(year, month);
    }
    return loading;
  }

  // ---- Thumbnails ----

  private async _onHover(detail: HoverDetail): Promise<void> {
    const hass = this.hass;
    if (!hass || !this._day || !segmentAt(this._day.segments, detail.time)) {
      this._hoverSeq += 1;
      this._hover = { x: detail.x, time: detail.time, gap: true };
      return;
    }
    const seq = ++this._hoverSeq;
    const hover = { x: detail.x, time: detail.time };
    this._hover = hover;
    try {
      const result = await fetchThumbnailUrls(hass, this.deviceId, [detail.time], thumbBucket(this._view.span));
      const url = result.urls[0]?.url;
      if (seq === this._hoverSeq) this._hover = url ? { ...hover, url } : hover;
    } catch {
      // No preview; the time label still shows.
    }
  }

  private async _loadThumbs(times: number[]): Promise<void> {
    const hass = this.hass;
    const wanted = times.filter((t) => !this._thumbsRequested.has(t));
    if (!hass || !wanted.length) return;
    wanted.forEach((t) => this._thumbsRequested.add(t));
    try {
      const result = await fetchThumbnailUrls(hass, this.deviceId, wanted, EVENT_THUMB_BUCKET);
      const date = this._date;
      result.urls.forEach((u, i) => {
        const time = wanted[i] ?? u.time;
        void this.thumbLoader.load(u.url).then((loaded) => {
          if (!loaded || date !== this._date) {
            this._thumbsRequested.delete(time);
            return;
          }
          this._thumbs = new Map(this._thumbs).set(time, u.url);
        });
      });
    } catch {
      wanted.forEach((t) => this._thumbsRequested.delete(t));
    }
  }

  // ---- Playback check ----

  /** Run the playback check (also called by scripts/playback_check.js). */
  async runCheck(options: CheckOptions): Promise<string> {
    if (this._check?.running) return this._check.text;
    const check = new PlaybackCheck(this._checkTarget(), options, () => {
      this._checkText = check.text;
    });
    this._check = check;
    this._checkRunning = true;
    this._checkText = "";
    try {
      return await check.run();
    } finally {
      this._checkRunning = false;
      this._checkText = check.text;
      this._reports = undefined;
    }
  }

  private _checkTarget(): CheckTarget {
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- the getters read live state
    const el = this;
    return {
      get hass() {
        if (!el.hass) throw new Error("not connected");
        return el.hass;
      },
      get deviceId() {
        return el.deviceId;
      },
      get cameraName() {
        return el.cameraName;
      },
      get date() {
        return el._date;
      },
      get today() {
        return el._today;
      },
      get day() {
        return el._day;
      },
      get loading() {
        return el._loading;
      },
      get metrics() {
        return el._metrics;
      },
      get playFailure() {
        return el._playFailure;
      },
      get hd() {
        return el._hd;
      },
      get progressive() {
        return el._progressive;
      },
      get mode() {
        return el._describeMode();
      },
      get stream() {
        return el._stream;
      },
      setStream: (stream: Stream) => {
        el._setStream(stream);
      },
      get monthDays() {
        return el._monthDays;
      },
      get player() {
        return el._player;
      },
      get playing() {
        return el._playing;
      },
      selectDate: (date: string) => {
        void el._selectDate(date);
      },
      playAt: (time: number, requestedAt?: number) => el.playAt(time, requestedAt),
    };
  }

  private async _loadReports(): Promise<void> {
    if (!this.hass) return;
    try {
      // The live check's reports share the store: only this check's here.
      this._reports = (await fetchCheckReports(this.hass)).reports.filter((r) => !r.setup.startsWith(LIVE_REPORT_PREFIX));
    } catch (err) {
      toast(this, `Could not load the reports: ${toError(err).message}`, "error");
    }
  }

  private async _copy(text: string): Promise<void> {
    if (await copyText(text)) toast(this, "Report copied");
    else toast(this, "Copying is blocked here: select the report text and copy it", "error");
  }

  private _renderCheck(): TemplateResult {
    const running = this._checkRunning;
    // While it runs, what it found so far; after, the report's own summary (a saved one too).
    const summary = running ? this._check?.inShort() : parseInShort(this._checkText);
    return html`<div class="check">
      <h3>Playback check</h3>
      <p class="small">
        How quickly ${this.cameraName}'s recordings open and play on this device: the timeline, events,
        long recordings, fast forward and HD. It takes a few minutes; keep this page open and in front.
        Each run is saved, so you can read it later on any device.
      </p>
      ${this._checkNote ? html`<div class="banner error" role="alert">${this._checkNote}</div>` : nothing}
      <div class="form">
        <span class="label" id="check-setup">This device and network</span>
        <div class="field">
          <select
            aria-labelledby="check-setup"
            ?disabled=${running}
            @change=${(e: Event) => {
              this._checkSetup = (e.target as HTMLSelectElement).value;
              this._checkHdPart = hdByDefault(this._checkSetup);
              rememberSetup(this._checkSetup);
            }}
          >
            ${SETUPS.map((setup) => html`<option .value=${setup} ?selected=${setup === this._checkSetup}>${setup}</option>`)}
          </select>
        </div>
        <span class="label">Also</span>
        <div class="field stack">
          <label class="option"
            ><input
              type="checkbox"
              .checked=${this._checkHdPart}
              ?disabled=${running}
              @change=${(e: Event) => {
                this._checkHdPart = (e.target as HTMLInputElement).checked;
              }}
            /><span
              >Switch to HD and back
              <span class="muted">(Home Assistant fetches the high-quality recording from the camera first)</span></span
            ></label
          >
          <label class="option"
            ><input
              type="checkbox"
              .checked=${this._checkSession}
              ?disabled=${running}
              @change=${(e: Event) => {
                this._checkSession = (e.target as HTMLInputElement).checked;
              }}
            /><span
              >Then play for ${CHECK_SESSION_MIN} minutes
              <span class="muted">(to see that it keeps playing smoothly)</span></span
            ></label
          >
        </div>
      </div>
      <div class="actions">
        ${running
          ? html`<button
              @click=${() => {
                this._check?.stop();
              }}
            >
              Stop
            </button>`
          : html`<button
              class="primary"
              @click=${() =>
                void this.runCheck({
                  setup: this._checkSetup,
                  soakMinutes: this._checkSession ? CHECK_SESSION_MIN : 0,
                  hd: this._checkHdPart,
                })}
            >
              Run playback check
            </button>`}
        <button @click=${() => void this._loadReports()}>Saved reports</button>
      </div>
      <!-- What it finds is said as it finds it, while it runs. -->
      <div aria-live=${running ? "polite" : "off"}>
        ${summary ? html`<rv-findings .summary=${summary}></rv-findings>` : nothing}
      </div>
      ${this._checkText
        ? html`<details class="support">
            <summary class="small">Details for support${icon("chevronDown")}</summary>
            <div class="actions">
              <button @click=${() => void this._copy(this._checkText)}>Copy report</button>
            </div>
            <pre class="report">${this._checkText}</pre>
          </details>`
        : nothing}
      ${this._reports
        ? html`<ul class="reports">
            ${this._reports.length
              ? this._reports.map(
                  (r) => html`<li>
                    <span class="when">${formatStamp(Date.parse(r.updated), this._zone)} · ${r.setup}${r.done ? "" : " · running or cut short"}</span>
                    <button class="text" @click=${() => void this._copy(r.text)}>Copy</button>
                    <button
                      class="text"
                      @click=${() => {
                        this._checkText = r.text;
                      }}
                    >
                      Show
                    </button>
                  </li>`,
                )
              : html`<li class="muted">No saved reports yet</li>`}
          </ul>`
        : nothing}
    </div>`;
  }

  // ---- Rendering ----

  /** The disk or SD card keeping the recordings is not ready: newer ones may be missing. */
  private _renderStorage(): TemplateResult | typeof nothing {
    if (this.storage !== "not_ready") return nothing;
    const what = this.recorder === "nvr" ? "The NVR's hard disk" : `${this.cameraName || "The camera"}'s SD card`;
    return html`<div class="banner warning" role="status">
      <strong>${what} is not ready</strong>: not formatted, or failed, so recent recordings may be
      missing. Format it in the Reolink app, or replace it.
    </div>`;
  }

  private _renderToolbar(): TemplateResult {
    const span = this._view.span;
    return html`<div class="toolbar">
      <div class="group transport">
        <button aria-label="Previous event" title="Previous event" @click=${() => {
          this._jump(-1);
        }}>${icon("previous")}</button>
        <button
          class="play"
          aria-label=${this._player?.paused === false ? "Pause" : "Play"}
          @click=${() => {
            const player = this._player;
            if (!player?.current) {
              if (this._cursor !== undefined) void this.playAt(this._cursor);
            } else if (player.paused) player.resume();
            else player.pause();
            this.requestUpdate();
          }}
        >${icon(this._player?.paused === false ? "pause" : "play")}</button>
        <button aria-label="Next event" title="Next event" @click=${() => {
          this._jump(1);
        }}>${icon("next")}</button>
      </div>
      <div class="group" role="group" aria-label="Zoom">
        <button aria-label="Zoom out" ?disabled=${stepZoom(span, -1) === undefined} @click=${() => this._timeline?.zoom(-1)}>${icon("minus")}</button>
        <span class="zoom">${zoomLabel(this._view.span)}</span>
        <button
          aria-label="Zoom in"
          ?disabled=${stepZoom(span, 1) === undefined}
          @click=${() => this._timeline?.zoom(1)}
        >${icon("plus")}</button>
      </div>
      <div class="group quality" role="group" aria-label="Quality">
        <button
          class="seg"
          aria-pressed=${this._stream === "sub" ? "true" : "false"}
          @click=${() => {
            this._setStream("sub");
          }}
        >SD</button>
        <button
          class="seg"
          aria-pressed=${this._stream === "main" ? "true" : "false"}
          ?disabled=${!this._hd.main}
          title=${this._hd.reason}
          @click=${() => {
            this._setStream("main");
          }}
        >HD</button>
      </div>
      <div class="group">
        <label class="speed"
          >Speed
          <select
            aria-label="Playback speed"
            @change=${(e: Event) => {
              this._setRate(Number((e.target as HTMLSelectElement).value));
            }}
          >
            ${RATES.map((rate) => html`<option .value=${String(rate)} ?selected=${rate === this._rate}>${rate}×</option>`)}
          </select></label
        >
        ${this._playing && pipSupported()
          ? html`<button
              class="pip"
              aria-pressed=${this._player?.pip ? "true" : "false"}
              title="Keep watching in a small window over other windows and apps"
              @click=${() => void this._player?.togglePip()}
            >
              ${icon("pip")}Picture in picture
            </button>`
          : nothing}
        ${this._playing
          ? html`<a class="download" href=${this._playing.clip_url} download>${icon("download")}Download clip</a>`
          : nothing}
      </div>
    </div>`;
  }

  /** What was detected in the day's events, to show only some. */
  private _renderFilters(): TemplateResult | typeof nothing {
    const events = this._day?.events ?? [];
    const types = [...new Set([...presentTypes(events), ...this._only])];
    if (!types.length) return nothing;
    return html`<div class="chips" role="group" aria-label="What was detected">
      ${types.map((type) => {
        const on = this._only.has(type);
        return html`<button
          class="chip"
          aria-pressed=${on ? "true" : "false"}
          @click=${() => {
            const only = new Set(this._only);
            if (!only.delete(type)) only.add(type);
            this._only = only;
          }}
        >
          ${icon(pictogram([type]))}${typeLabel(type)}
          <span class="count">${events.filter((e) => shownTypes(e.types).includes(type)).length}</span>
        </button>`;
      })}
      ${this._only.size
        ? html`<button class="text clear" @click=${() => {
            this._only = new Set();
          }}>Show every event</button>`
        : nothing}
    </div>`;
  }

  private _renderHover(): TemplateResult | typeof nothing {
    const hover = this._hover;
    if (!hover) return nothing;
    return html`<div class="hover" style="left: ${Math.max(0, hover.x - 80)}px">
      ${hover.gap ? nothing : hover.url ? html`<img src=${hover.url} alt="" />` : html`<div class="noimg"></div>`}
      <span>${formatClock(hover.time, this._zone, true)}${hover.gap ? " · no recording" : ""}</span>
    </div>`;
  }

  private _renderDebug(): TemplateResult {
    const m = this._metrics;
    const ms = (v: number | undefined) => (v === undefined ? "–" : `${Math.round(v)} ms`);
    const server = m.timelineServer;
    return html`<details class="debug">
      <summary class="small">Details and playback check${icon("chevronDown")}</summary>
      ${this._renderCheck()}
      <details class="tech">
        <summary class="small">Technical details${icon("chevronDown")}</summary>
        <dl class="facts">
        <dt>Time to timeline</dt>
        <dd>
          ${ms(m.timelineMs)}
          ${server
            ? html`<span class="muted">(server: ${server.cache ?? "?"}${server.search_ms !== undefined
                ? `, search ${Math.round(server.search_ms)} ms`
                : ""})</span>`
            : nothing}
        </dd>
        <dt>Time to first frame</dt>
        <dd>${ms(m.firstFrameMs)} <span class="muted">(URL ${ms(m.urlMs)})</span></dd>
        <dt>Gap at last file change</dt>
        <dd>${ms(m.gapMs)}</dd>
        <dt>Reloaded mid-way</dt>
        <dd>${m.recoveries ? `${m.recoveries}× (last: ${m.lastRecovery ?? "?"})` : "never"}</dd>
        <dt>Stream</dt>
        <dd>${m.stream ?? this._stream}${m.codec ? ` · ${m.codec}` : ""}</dd>
        <dt>Cache</dt>
        <dd>${m.cache ? describeCache(m.cache) : "–"}</dd>
        <dt>HD</dt>
        <dd>${this._hd.reason}</dd>
        <dt>Delivery</dt>
        <dd>
          ${m.delivery ?? (this._progressive ? "progressive" : "whole file first (WebKit)")}${this._playing?.file
            ? ` · ${this._playing.file} file`
            : ""}
        </dd>
        <dt>Player</dt>
        <dd>
          ${describePlayer(this._player)}
          <select
            aria-label="Player"
            @change=${(e: Event) => {
              this._setMode((e.target as HTMLSelectElement).value as PlayerMode);
            }}
          >
            <option value="auto" ?selected=${this._mode === "auto"}>MSE where possible</option>
            <option value="file" ?selected=${this._mode === "file"}>File player only</option>
          </select>
        </dd>
        <dt>Fell back to the file player</dt>
        <dd>${m.fallbacks ? `${m.fallbacks}× (last: ${m.lastFallback ?? "?"})` : "never"}</dd>
        <dt>Day</dt>
        <dd>
          ${this._day
            ? `${this._day.segments.length} recordings, ${this._day.events.length} events${this._day.complete ? ", final" : ""}${this._day.events_error ? `, event search failed (${this._day.events_error})` : ""}`
            : "–"}
        </dd>
        </dl>
      </details>
    </details>`;
  }

  protected override render(): TemplateResult {
    const day = this._day;
    const zone = this._zone;
    return html`
      <div class="layout">
        <div class="main">
          <rv-player
            .rate=${this._rate}
            .note=${this._note}
            @rv-first-frame=${(e: CustomEvent<FirstFrameDetail>) => {
              // A recording not fetched yet has no media info: MSE read it from the first bytes.
              const codec = this._metrics.codec ?? videoCodec(this._player?.mseStats?.mime);
              this._metrics = { ...this._metrics, firstFrameMs: e.detail.ms, codec };
              this._resumeThumbs();
            }}
            @rv-advanced=${(e: CustomEvent<AdvanceDetail>) => {
              this._onAdvanced(e.detail);
            }}
            @rv-ended=${(e: CustomEvent<{ segmentId?: string }>) => {
              this._onEnded(e.detail.segmentId);
            }}
            @rv-time=${(e: CustomEvent<TimeDetail>) => {
              this._onTime(e.detail.time);
            }}
            @rv-player-error=${(e: CustomEvent<PlayerErrorDetail>) => {
              this._onPlayerError(e.detail);
            }}
            @rv-pip=${() => {
              this.requestUpdate(); // the toolbar's button shows it
            }}
          ></rv-player>
          <div class="dayline">
            <div class="day-nav" role="group" aria-label="Day">
              <button class="step" aria-label="Previous day" @click=${() => {
                this._changeDay(-1);
              }}>${icon("chevronBack")}</button>
              <span class="day" title=${dayLabel(this._date)}>
                ${this._date === this._today ? "Today" : shortDay(this._date)}
              </span>
              <button
                class="step"
                aria-label="Next day"
                ?disabled=${this._date >= this._today}
                @click=${() => {
                  this._changeDay(1);
                }}
              >${icon("chevron")}</button>
            </div>
            ${this._loading ? html`<span class="muted small">Loading…</span>` : nothing}
            <span class="clock">
              ${this._cursor !== undefined ? formatClock(this._cursor, zone, true) : "--:--:--"}
            </span>
          </div>
          ${this._renderStorage()}
          ${this._error
            ? problem(
                explainRecordings(this._error, { name: this.cameraName || "This camera", offline: this.offline }),
                `Could not load recordings: ${this._error}`,
                { help: "recordings" },
              )
            : nothing}
          ${this._playFailure
            ? problem(explainPlayback(this._playFailure), `Playback failed: ${this._playFailure}`, { help: "recordings" })
            : nothing}
          <div class="timeline-wrap">
            ${this._renderHover()}
            <rv-timeline
              .day=${day}
              .events=${this._events}
              .view=${this._view}
              .cursor=${this._cursor}
              .timeZone=${zone}
              @rv-view-change=${(e: CustomEvent<{ view: View }>) => {
                this._view = e.detail.view;
              }}
              @rv-seek=${(e: CustomEvent<TimeDetail>) => {
                void this.playAt(e.detail.time);
              }}
              @rv-scrub=${(e: CustomEvent<TimeDetail>) => {
                this._onScrub(e.detail.time);
              }}
              @rv-hover=${(e: CustomEvent<HoverDetail>) => void this._onHover(e.detail)}
              @rv-hover-end=${() => {
                this._hoverSeq += 1;
                this._hover = undefined;
              }}
            ></rv-timeline>
          </div>
          ${this._renderToolbar()} ${this._renderFilters()}
          ${day && !day.segments.length && !this._loading
            ? html`<p class="muted">No recordings on this day.</p>`
            : nothing}
          ${this._renderDebug()}
        </div>
        <div class="side">
          <rv-calendar
            .year=${this._month.year}
            .month=${this._month.month}
            .days=${this._monthDays}
            .selected=${this._date}
            .today=${this._today}
            .firstDay=${firstDayOfWeek(this.hass?.locale?.language)}
            ?loading=${this._monthLoading}
            @rv-month=${(e: CustomEvent<{ year: number; month: number }>) =>
              void this._loadMonth(e.detail.year, e.detail.month)}
            @rv-day=${(e: CustomEvent<{ date: string }>) => {
              void this._selectDate(e.detail.date);
            }}
          ></rv-calendar>
          <div class="events-head">
            <h2>Events</h2>
            ${day
              ? html`<span class="muted">
                  ${this._only.size ? `${String(this._events.length)} of ` : ""}${day.events.length}
                  ${day.events.length === 1 ? "event" : "events"}
                </span>`
              : nothing}
          </div>
          ${!day
            ? // Not "no events": none could be read yet.
              html`<p class="muted">${this._error ? "This day's events could not be read." : "Reading this day's events…"}</p>`
            : html`<rv-event-list
                .events=${this._events}
                .thumbs=${this._thumbs}
                .current=${this._cursor}
                .playing=${this._playing !== undefined}
                .timeZone=${zone}
                @rv-pick=${(e: CustomEvent<{ event: { start: number } }>) => {
                  this._cursor = e.detail.event.start;
                  if (this._day) this._view = centreOn(this._view, e.detail.event.start, this._day);
                  void this.playAt(e.detail.event.start);
                }}
                @rv-thumbs-needed=${(e: CustomEvent<{ times: number[] }>) => void this._loadThumbs(e.detail.times)}
              ></rv-event-list>`}
        </div>
      </div>
    `;
  }

  static override styles = [
    sharedStyles,
    css`
      .layout {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 340px;
        gap: 24px;
      }
      .main,
      .side {
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-width: 0;
      }
      .side {
        gap: 14px;
      }
      @media (max-width: 900px) {
        .layout {
          grid-template-columns: minmax(0, 1fr);
        }
        /* On one column the day's events come before the calendar. */
        .side rv-calendar {
          order: 2;
        }
      }
      .dayline {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px 14px;
        margin-top: 4px;
      }
      .day-nav {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .step {
        width: 36px;
        padding: 0;
        display: grid;
        place-items: center;
      }
      .day {
        min-width: 7.5em;
        text-align: center;
        font-family: var(--rv-font-cond);
        font-size: 19px;
        font-weight: 600;
      }
      .clock {
        margin-left: auto;
        font-family: var(--rv-font-cond);
        font-size: 30px;
        font-weight: 600;
        line-height: 1;
        letter-spacing: 0.01em;
      }
      .timeline-wrap {
        position: relative;
      }
      .hover {
        position: absolute;
        bottom: calc(100% + 6px);
        z-index: 2;
        width: 160px;
        background: var(--rv-board);
        color: var(--rv-on-board);
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.28);
        font-family: var(--rv-font-cond);
        font-size: 15px;
        font-weight: 600;
        text-align: center;
        pointer-events: none;
      }
      .hover span {
        display: block;
        padding: 4px 6px 5px;
      }
      .hover img,
      .hover .noimg {
        display: block;
        width: 100%;
        aspect-ratio: 16 / 9;
        object-fit: cover;
        background: var(--rv-board);
      }
      .toolbar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px 22px;
        padding-top: 2px;
      }
      .group {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .group > button {
        width: 40px;
        padding: 0;
        display: grid;
        place-items: center;
      }
      .group > button.play {
        width: 48px;
        background: var(--rv-text);
        border-color: var(--rv-text);
        color: var(--rv-ground);
      }
      .group > button.play:hover {
        background: var(--rv-text);
        opacity: 0.88;
      }
      .zoom {
        min-width: 48px;
        text-align: center;
        font-family: var(--rv-font-cond);
        font-size: 17px;
        font-weight: 600;
      }
      .quality {
        gap: 0;
      }
      .group > button.seg {
        width: 46px;
        font-family: var(--rv-font-cond);
        font-size: 16px;
        font-weight: 600;
      }
      .group > button.seg + button.seg {
        margin-left: -1px;
      }
      .group > button.seg[aria-pressed="true"] {
        background: var(--rv-text);
        border-color: var(--rv-text);
        color: var(--rv-ground);
      }
      .speed {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        color: var(--rv-muted);
        font-size: 15px;
      }
      .speed select {
        min-height: 36px;
      }
      button.pip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-left: 6px;
      }
      button.pip svg {
        width: 18px;
        height: 18px;
      }
      button.pip[aria-pressed="true"] {
        background: var(--rv-text);
        border-color: var(--rv-text);
        color: var(--rv-ground);
      }
      .download {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-left: 6px;
        font-weight: 500;
        text-decoration: none;
      }
      .download:hover {
        text-decoration: underline;
      }
      .download svg {
        width: 18px;
        height: 18px;
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
      }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        min-height: 34px;
        padding: 0 10px 0 9px;
        border: 1px solid var(--rv-rule);
        font-size: 15px;
        font-weight: 500;
        white-space: nowrap;
      }
      .chip svg {
        width: 18px;
        height: 18px;
      }
      .chip .count {
        color: var(--rv-muted);
        font-weight: 400;
      }
      .chip[aria-pressed="true"] {
        background: var(--rv-text);
        border-color: var(--rv-text);
        color: var(--rv-ground);
      }
      .chip[aria-pressed="true"] .count {
        color: inherit;
        opacity: 0.75;
      }
      .chip[aria-pressed="true"]:hover {
        background: var(--rv-text);
      }
      .clear {
        padding-left: 4px;
      }
      .events-head {
        display: flex;
        align-items: baseline;
        gap: 12px;
      }
      .events-head h2 {
        margin: 0;
      }
      .events-head span {
        font-size: 15px;
      }

      @media (max-width: 600px) {
        .clock {
          font-size: 24px;
        }
        .toolbar {
          gap: 10px 14px;
        }
      }
      .debug dl {
        font-size: 13px;
      }
      .tech {
        margin-top: 12px;
      }
      .check {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-top: 10px;
        padding-top: 12px;
        border-top: 2px solid var(--rv-rule-strong);
      }
      .check h3 {
        margin: 0;
        font-family: var(--rv-font-cond);
        font-size: 21px;
      }
      .check p {
        margin: 0;
      }
      .check .support > .actions {
        margin: 6px 0 10px;
      }
      .reports {
        list-style: none;
        margin: 0;
        padding: 0;
        border-top: 1px solid var(--rv-rule);
      }
      .reports li {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px 12px;
        padding: 6px 0;
        border-bottom: 1px solid var(--rv-rule);
      }
      .reports .when {
        flex: 1;
        min-width: 14em;
        font-size: 15px;
      }
    `,
  ];
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const megabytes = (bytes: number): string => `${Math.round(bytes / 1_000_000)} MB`;

/** The video codec of an MSE type ('video/mp4; codecs="avc1.640033,mp4a.40.2"'). */
export function videoCodec(mime: string | undefined): string | null {
  return /codecs="?([^",]+)/.exec(mime ?? "")?.[1] ?? null;
}

/** The debug panel's player line: MSE with its buffer, or the file player. */
export function describePlayer(player: RvPlayer | null): string {
  const stats = player?.mseStats;
  if (!stats) return player?.current ? "file player" : "–";
  const parts = [
    stats.api,
    stats.mime.replace(/^video\/mp4; codecs=/, ""),
    `${stats.windows} windows, ${(stats.bytes / 1_000_000).toFixed(1)} MB${stats.lastWaitMs === undefined ? "" : `, last in ${Math.round(stats.lastWaitMs)} ms`}`,
    `${Math.round(stats.ahead)} s ahead, ${Math.round(stats.behind)} s behind`,
    `${stats.trims} trims`,
    // Phase 5b: the device's cut, or the recording's download.
    `from ${stats.source === "cut" ? "Reolink protocol cut" : "download"}` +
      (stats.switches ? ` (${stats.switches} source switches)` : ""),
  ];
  return parts.join(" · ");
}

/** How the last recording was delivered, for the debug panel. */
export function deliveryOf(progressive: boolean, browserProgressive: boolean, cached: boolean): string {
  if (cached) return "cached file (Range)";
  if (progressive) return "progressive";
  return browserProgressive ? "whole file first (to seek)" : "whole file first (WebKit)";
}

/** The debug panel's one-line cache state. */
export function describeCache(cache: CacheStatus): string {
  const mb = `${(cache.bytes / 1_000_000).toFixed(1)} MB`;
  if (cache.error) return `failed: ${cache.error}`;
  const state = cache.complete ? `cached (${mb})` : `filling (${mb} so far)`;
  // Phase 5b: a deep start served by the device's cut, or why none did.
  if (typeof cache.cut_error === "string") return `${state} · Reolink protocol cut not used: ${cache.cut_error}`;
  const cut = cache.cut as { first_fragment_ms?: number; login?: string; error?: string | null } | undefined;
  if (!cut) return state;
  const first =
    typeof cut.first_fragment_ms === "number" ? `first fragment ${Math.round(cut.first_fragment_ms)} ms` : "no fragment";
  const login = cut.login === "new" ? ", new login" : cut.login ? ", shared login" : "";
  return `${state} · Reolink protocol cut: ${cut.error ? `failed (${cut.error})` : `${first}${login}`}`;
}

function rememberedSetup(): string {
  try {
    const saved = window.localStorage.getItem(CHECK_SETUP_KEY);
    if (saved && (SETUPS as readonly string[]).includes(saved)) return saved;
  } catch {
    // No storage: guess from the browser.
  }
  return deviceSetup(navigator.userAgent);
}

function rememberedMode(): PlayerMode {
  try {
    return window.localStorage.getItem(PLAYER_MODE_KEY) === "file" ? "file" : "auto";
  } catch {
    return "auto";
  }
}

function rememberMode(mode: PlayerMode): void {
  try {
    window.localStorage.setItem(PLAYER_MODE_KEY, mode);
  } catch {
    // Not remembered.
  }
}

function rememberSetup(setup: string): void {
  try {
    window.localStorage.setItem(CHECK_SETUP_KEY, setup);
  } catch {
    // Not remembered.
  }
}

function zoomLabel(span: number): string {
  if (span >= 3_600_000) return `${Math.round(span / 3_600_000)} h`;
  return `${Math.round(span / MINUTE)} min`;
}

if (!customElements.get("rv-playback")) {
  customElements.define("rv-playback", RvPlayback);
}

declare global {
  interface HTMLElementTagNameMap {
    "rv-playback": RvPlayback;
  }
}

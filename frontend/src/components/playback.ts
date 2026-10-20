import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from "lit";

import {
  fetchMediaInfo,
  fetchPlaybackUrl,
  fetchThumbnailUrls,
  fetchTimelineDay,
  fetchTimelineDays,
  prefetchSegment,
  toError,
  type SegmentRef,
} from "../api";
import {
  PlaybackCheck,
  SETUPS,
  fetchCheckReports,
  noteInterruptedCheck,
  type CheckOptions,
  type CheckTarget,
  type SavedReport,
} from "../playback/check";
import { canPlayMain, playsProgressive, type StreamDecision } from "../playback/codec";
import "../playback/calendar";
import "../playback/event-list";
import "../playback/player";
import type { AdvanceDetail, FirstFrameDetail, PlayItem, PlayerErrorDetail, RvPlayer } from "../playback/player";
import { ThumbLoader } from "../playback/thumb-loader";
import { dateIn, firstDayOfWeek, formatClock, formatDay } from "../playback/time";
import "../playback/timeline";
import type { HoverDetail, RvTimeline, TimeDetail } from "../playback/timeline";
import {
  DAY,
  MINUTE,
  ZOOM_LEVELS,
  centreOn,
  clampView,
  filterEvents,
  nextEvent,
  playTarget,
  presentTypes,
  previousEvent,
  segmentAt,
  thumbBucket,
  typeColor,
  typeLabel,
  zoomIndex,
  type View,
} from "../playback/timeline-math";
import { sharedStyles } from "../styles";
import type { CacheStatus, HomeAssistant, PlaybackUrl, Segment, Stream, TimelineDay, Timing } from "../types";
import { toast } from "./navigation";

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
export const STALE_TODAY_S = 900;
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
const CHECK_SETUP_KEY = "reolink-viewer-check-setup";
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
    _date: { state: true },
    _day: { state: true },
    _error: { state: true },
    _playFailure: { state: true },
    _loading: { state: true },
    _view: { state: true },
    _cursor: { state: true },
    _hidden: { state: true },
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
    _checkNote: { state: true },
    _reports: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  declare deviceId: string;
  declare cameraName: string;
  declare _date: string;
  declare _day: TimelineDay | undefined;
  declare _error: string | undefined;
  /** Why the last play attempt failed, until the next one starts. */
  declare _playFailure: string | undefined;
  declare _loading: boolean;
  declare _view: View;
  declare _cursor: number | undefined;
  declare _hidden: ReadonlySet<string>;
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
  declare _checkNote: string | undefined;
  declare _reports: SavedReport[] | undefined;

  private _daySeq = 0;
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

  constructor() {
    super();
    this.deviceId = "";
    this.cameraName = "";
    this._date = "";
    this._loading = false;
    this._view = { start: 0, span: DAY };
    this._hidden = new Set();
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
    return filterEvents(this._day?.events ?? [], this._hidden);
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
      this._date = this._today;
      const [year, month] = this._date.split("-").map(Number);
      if (year && month) this._month = { year, month };
      void this._loadDay(this._date);
      void this._loadMonth(this._month.year, this._month.month);
      void this._checkHd();
      if (!interruptedLookedFor) {
        interruptedLookedFor = true;
        void noteInterruptedCheck(this.hass).then((note) => {
          this._checkNote = note;
        });
      }
    }
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
    this._starting = seq;
    const began = performance.now();
    try {
      const progressive = this._progressive && target.offset < PROGRESSIVE_SEEK_LIMIT_MS;
      const playback = await fetchPlaybackUrl(hass, this._ref(target.segment), progressive);
      if (seq !== this._playSeq) return;
      this._playing = playback;
      this._metrics = {
        ...this._metrics,
        urlMs: performance.now() - began,
        firstFrameMs: undefined,
        gapMs: undefined,
        stream: playback.stream,
        cache: playback.cache,
        codec: playback.media?.codec ?? null,
        delivery: deliveryOf(progressive, this._progressive, playback.cache.complete),
      };
      // Main and sub recordings start a few seconds apart: keep the wall time.
      const offset = Math.max(0, wanted - playback.start);
      await this._player?.play(toItem(playback), offset, requestedAt);
      this._schedulePreload(target.segment, seq, wanted);
    } catch (err) {
      if (seq === this._playSeq) this._playError(toError(err).message);
    } finally {
      if (this._starting === seq) this._starting = undefined;
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
    try {
      const playback = await fetchPlaybackUrl(hass, this._ref(next), this._progressive);
      if (seq !== this._playSeq) return;
      await this._player?.preload(toItem(playback));
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
      toast(this, `HD failed (${message}); back to the sub stream`, "error");
      if (this._cursor !== undefined) void this.playAt(this._cursor);
      return;
    }
    this._playFailure = message;
    toast(this, `Playback failed: ${message}`, "error");
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
    this._selectDate(next);
  }

  private _selectDate(date: string): void {
    this._date = date;
    this._player?.stop();
    this._playing = undefined;
    this._preloadPending = undefined;
    this.thumbLoader.clear();
    this._thumbs = new Map();
    this._thumbsRequested.clear();
    void this._loadDay(date);
    const [year, month] = date.split("-").map(Number);
    if (year && month && (year !== this._month.year || month !== this._month.month)) {
      void this._loadMonth(year, month);
    }
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
        el._selectDate(date);
      },
      playAt: (time: number, requestedAt?: number) => el.playAt(time, requestedAt),
    };
  }

  private async _loadReports(): Promise<void> {
    if (!this.hass) return;
    try {
      this._reports = (await fetchCheckReports(this.hass)).reports;
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
    return html`<div class="check">
      <strong>Playback check</strong>
      <p class="small muted">
        Measures this device: timeline, first frames (events, deep in long recordings, cached and not), auto-advance,
        playback rates, the link, MSE support and HD. The report is saved on the server, so a run on a phone can be
        copied on a desktop.
      </p>
      ${this._checkNote ? html`<div class="banner error" role="alert">${this._checkNote}</div>` : nothing}
      <div class="row">
        <label
          >Setup
          <select
            ?disabled=${running}
            @change=${(e: Event) => {
              this._checkSetup = (e.target as HTMLSelectElement).value;
              rememberSetup(this._checkSetup);
            }}
          >
            ${SETUPS.map((setup) => html`<option .value=${setup} ?selected=${setup === this._checkSetup}>${setup}</option>`)}
          </select>
        </label>
        <label
          ><input
            type="checkbox"
            .checked=${this._checkSession}
            ?disabled=${running}
            @change=${(e: Event) => {
              this._checkSession = (e.target as HTMLInputElement).checked;
            }}
          />
          then play for ${CHECK_SESSION_MIN} min (memory and disk)</label
        >
      </div>
      <div class="row">
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
                })}
            >
              Run playback check
            </button>`}
        <button ?disabled=${!this._checkText} @click=${() => void this._copy(this._checkText)}>Copy report</button>
        <button @click=${() => void this._loadReports()}>Saved reports</button>
      </div>
      ${this._checkText ? html`<pre class="report">${this._checkText}</pre>` : nothing}
      ${this._reports
        ? html`<ul class="reports">
            ${this._reports.length
              ? this._reports.map(
                  (r) => html`<li>
                    <span>${new Date(r.updated).toLocaleString()} · ${r.setup}${r.done ? "" : " · running or cut short"}</span>
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
              : html`<li class="muted">No saved reports</li>`}
          </ul>`
        : nothing}
    </div>`;
  }

  // ---- Rendering ----

  private _renderToolbar(): TemplateResult {
    const zoom = zoomIndex(this._view.span);
    return html`<div class="toolbar">
      <div class="group">
        <button aria-label="Previous event" title="Previous event" @click=${() => {
          this._jump(-1);
        }}>⏮</button>
        <button
          aria-label=${this._player?.paused === false ? "Pause" : "Play"}
          @click=${() => {
            const player = this._player;
            if (!player?.current) {
              if (this._cursor !== undefined) void this.playAt(this._cursor);
            } else if (player.paused) player.resume();
            else player.pause();
            this.requestUpdate();
          }}
        >${this._player?.paused === false ? "⏸" : "▶"}</button>
        <button aria-label="Next event" title="Next event" @click=${() => {
          this._jump(1);
        }}>⏭</button>
      </div>
      <div class="group">
        <button aria-label="Zoom out" ?disabled=${zoom === 0} @click=${() => this._timeline?.zoom(-1)}>−</button>
        <span class="small muted zoom">${zoomLabel(this._view.span)}</span>
        <button
          aria-label="Zoom in"
          ?disabled=${zoom === ZOOM_LEVELS.length - 1}
          @click=${() => this._timeline?.zoom(1)}
        >+</button>
      </div>
      <div class="group">
        <button
          class=${this._stream === "sub" ? "primary" : ""}
          aria-pressed=${this._stream === "sub" ? "true" : "false"}
          @click=${() => {
            this._setStream("sub");
          }}
        >SD</button>
        <button
          class=${this._stream === "main" ? "primary" : ""}
          aria-pressed=${this._stream === "main" ? "true" : "false"}
          ?disabled=${!this._hd.main}
          title=${this._hd.reason}
          @click=${() => {
            this._setStream("main");
          }}
        >HD</button>
        ${this._playing
          ? html`<a class="button" href=${this._playing.clip_url} download>Download clip</a>`
          : nothing}
      </div>
    </div>`;
  }

  private _renderFilters(): TemplateResult | typeof nothing {
    const types = presentTypes(this._day?.events ?? []);
    if (!types.length) return nothing;
    return html`<div class="chips" role="group" aria-label="Event types">
      ${types.map((type) => {
        const on = !this._hidden.has(type);
        return html`<button
          class="chip ${on ? "on" : ""}"
          aria-pressed=${on ? "true" : "false"}
          style="--chip: ${typeColor(type)}"
          @click=${() => {
            const hidden = new Set(this._hidden);
            if (on) hidden.add(type);
            else hidden.delete(type);
            this._hidden = hidden;
          }}
        >
          <span class="swatch"></span>${typeLabel(type)}
          <span class="muted">${this._day?.events.filter((e) => e.types.includes(type)).length ?? 0}</span>
        </button>`;
      })}
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
      <summary class="small muted">Debug</summary>
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
        <dt>Day</dt>
        <dd>
          ${this._day
            ? `${this._day.segments.length} recordings, ${this._day.events.length} events${this._day.complete ? ", final" : ""}${this._day.events_error ? `, event search failed (${this._day.events_error})` : ""}`
            : "–"}
        </dd>
      </dl>
      ${this._renderCheck()}
    </details>`;
  }

  protected override render(): TemplateResult {
    const day = this._day;
    const zone = this._zone;
    return html`
      <div class="layout">
        <div class="main">
          <rv-player
            @rv-first-frame=${(e: CustomEvent<FirstFrameDetail>) => {
              this._metrics = { ...this._metrics, firstFrameMs: e.detail.ms };
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
          ></rv-player>
          <div class="dayline">
            <button class="text" aria-label="Previous day" @click=${() => {
              this._changeDay(-1);
            }}>‹</button>
            <strong>${day ? formatDay(day.start + 12 * 3_600_000, zone) : this._date}</strong>
            <button
              class="text"
              aria-label="Next day"
              ?disabled=${this._date >= this._today}
              @click=${() => {
                this._changeDay(1);
              }}
            >›</button>
            <span class="muted small">
              ${this._cursor !== undefined ? formatClock(this._cursor, zone, true) : ""}
              ${this._loading ? " · loading…" : ""}
            </span>
          </div>
          ${this._error
            ? html`<div class="banner error" role="alert">Could not load recordings: ${this._error}</div>`
            : nothing}
          ${this._playFailure
            ? html`<div class="banner error" role="alert">Playback failed: ${this._playFailure}</div>`
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
                this._cursor = e.detail.time;
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
              this._selectDate(e.detail.date);
            }}
          ></rv-calendar>
          <h3>Events</h3>
          <rv-event-list
            .events=${this._events}
            .thumbs=${this._thumbs}
            .current=${this._cursor}
            .timeZone=${zone}
            @rv-pick=${(e: CustomEvent<{ event: { start: number } }>) => {
              this._cursor = e.detail.event.start;
              if (this._day) this._view = centreOn(this._view, e.detail.event.start, this._day);
              void this.playAt(e.detail.event.start);
            }}
            @rv-thumbs-needed=${(e: CustomEvent<{ times: number[] }>) => void this._loadThumbs(e.detail.times)}
          ></rv-event-list>
        </div>
      </div>
    `;
  }

  static override styles = [
    sharedStyles,
    css`
      .layout {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 320px;
        gap: 16px;
      }
      @media (max-width: 900px) {
        .layout {
          grid-template-columns: minmax(0, 1fr);
        }
      }
      .main,
      .side {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 0;
      }
      .dayline {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .timeline-wrap {
        position: relative;
      }
      .hover {
        position: absolute;
        bottom: calc(100% + 4px);
        z-index: 2;
        width: 160px;
        background: var(--card-background-color, white);
        border: 1px solid var(--divider-color, #ccc);
        border-radius: 6px;
        padding: 4px;
        font-size: 12px;
        text-align: center;
        pointer-events: none;
      }
      .hover img,
      .hover .noimg {
        display: block;
        width: 100%;
        aspect-ratio: 16 / 9;
        object-fit: cover;
        background: var(--secondary-background-color, #eee);
        border-radius: 4px;
      }
      .toolbar {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        gap: 8px;
      }
      .group {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .zoom {
        min-width: 44px;
        text-align: center;
      }
      a.button {
        padding: 6px 14px;
        border-radius: 4px;
        border: 1px solid var(--divider-color, #ccc);
        text-decoration: none;
        color: var(--primary-text-color);
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border-radius: 16px;
        padding: 4px 10px;
        opacity: 0.55;
      }
      .chip.on {
        opacity: 1;
        border-color: var(--chip);
      }
      .swatch {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: var(--chip);
      }
      .debug dl {
        font-size: 13px;
      }
      .check {
        display: flex;
        flex-direction: column;
        gap: 6px;
        border-top: 1px solid var(--divider-color, #ccc);
        padding-top: 8px;
      }
      .check .row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
      }
      .check p {
        margin: 0;
      }
      .report {
        max-height: 50vh;
        overflow: auto;
        white-space: pre-wrap;
        word-break: break-word;
        font-size: 12px;
        background: var(--secondary-background-color, #f5f5f5);
        padding: 8px;
        border-radius: 4px;
        user-select: text;
        -webkit-user-select: text;
      }
      .reports {
        margin: 0;
        padding-left: 18px;
        font-size: 13px;
      }
    `,
  ];
}

function toItem(playback: PlaybackUrl): PlayItem {
  return { url: playback.url, segmentId: playback.segment_id, start: playback.start, end: playback.end };
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
  return cache.complete ? `cached (${mb})` : `filling (${mb} so far)`;
}

function rememberedSetup(): string {
  try {
    const saved = window.localStorage.getItem(CHECK_SETUP_KEY);
    if (saved && (SETUPS as readonly string[]).includes(saved)) return saved;
  } catch {
    // No storage: guess from the browser.
  }
  return /iPhone|iPad/.test(navigator.userAgent) ? "iPhone app, Wi-Fi (local)" : "Desktop Chrome, LAN";
}

function rememberSetup(setup: string): void {
  try {
    window.localStorage.setItem(CHECK_SETUP_KEY, setup);
  } catch {
    // Not remembered.
  }
}

/** Copy text: the Clipboard API (secure pages), else a selected textarea. */
export async function copyText(text: string): Promise<boolean> {
  // Undefined on plain-HTTP pages (as Home Assistant is on the LAN).
  const clipboard = (navigator as { clipboard?: Clipboard }).clipboard;
  try {
    if (window.isSecureContext && clipboard) {
      await clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall back below.
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.cssText = "position:fixed;top:0;left:0;opacity:0";
  document.body.append(area);
  area.select();
  area.setSelectionRange(0, text.length);
  try {
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- the only way on plain-HTTP pages
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area.remove();
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

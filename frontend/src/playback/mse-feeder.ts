// Feeds one <video> from the server's MSE fragments (views.py, MseView): the
// recording's init segment, then windows of fragments ahead of the play
// position, trimming what lies behind it. ManagedMediaSource where it exists
// (the iOS Companion app has nothing else), else MediaSource. A start deep in
// a recording costs one window, sent once the bytes up to it are on the
// server's disk (Phase 2B step 2).

export type MseApi = "ManagedMediaSource" | "MediaSource";

export interface MseSource {
  /** The recording's fragment path (playback/mse). */
  base: string;
  /** `fetch` with Home Assistant's authentication (hass.fetchWithAuth). */
  fetch: (path: string, init?: RequestInit) => Promise<Response>;
  /** The recording's length per the search (ms). */
  durationMs: number;
}

/** What the file player may still play: no MSE, a codec MSE refuses, an append error. */
export class MseUnsupported extends Error {}

/** The first window after a start or a seek: small, to show a frame soon. */
export const FIRST_WINDOW_MS = 4_000;
/** Later windows (media time, scaled by the rate). */
export const WINDOW_MS = 20_000;
export const WINDOW_MAX_MS = 120_000;
export const WINDOW_MAX_BYTES = 16 * 1024 * 1024;
/** Seconds kept buffered ahead at 1× (scaled by the rate), and the caps. */
export const AHEAD_S = 30;
export const AHEAD_MAX_S = 240;
export const AHEAD_MAX_BYTES = 48 * 1024 * 1024;
/** Seconds kept behind the play position (for a short step back). */
export const BEHIND_S = 30;
/** Trimmed once this much more than BEHIND_S has gathered behind. */
const TRIM_SLACK_S = 10;
/** After an empty window that is not the last, the next request waits this long. */
const EMPTY_RETRY_MS = 1_000;
/** Buffered ranges this close count as one (fragment edges, audio vs video). */
export const JOIN_S = 0.5;

export interface FeederStats {
  api: MseApi;
  mime: string;
  /** Windows fetched, their bytes, and how long the last one took. */
  windows: number;
  bytes: number;
  lastWaitMs: number | undefined;
  /** Removals of buffered media (behind the play position or out of reach). */
  trims: number;
  /** A window is on its way. */
  fetching: boolean;
}

interface MediaSourceCtor {
  new (): MediaSource;
  isTypeSupported(type: string): boolean;
}

interface Range {
  start: number;
  end: number;
}

/** The MSE API this browser offers, preferring ManagedMediaSource. */
export function mseApiName(): MseApi | undefined {
  const w = window as unknown as Record<string, unknown>;
  if (typeof w.ManagedMediaSource === "function") return "ManagedMediaSource";
  if (typeof w.MediaSource === "function") return "MediaSource";
  return undefined;
}

function ctorOf(api: MseApi): MediaSourceCtor {
  return (window as unknown as Record<MseApi, MediaSourceCtor>)[api];
}

/** Buffered ranges, with those closer than JOIN_S joined. */
export function joinedRanges(ranges: TimeRanges): Range[] {
  const out: Range[] = [];
  for (let i = 0; i < ranges.length; i += 1) {
    const range = { start: ranges.start(i), end: ranges.end(i) };
    const last = out.at(-1);
    if (last && range.start - last.end < JOIN_S) last.end = Math.max(last.end, range.end);
    else out.push(range);
  }
  return out;
}

/** Seconds of media to keep ahead: by time at this rate, and by bytes. */
export function aheadTarget(rate: number, bytesPerSecond: number): number {
  const byTime = Math.min(AHEAD_S * Math.max(1, rate), AHEAD_MAX_S);
  return bytesPerSecond > 0 ? Math.max(4, Math.min(byTime, AHEAD_MAX_BYTES / bytesPerSecond)) : byTime;
}

function isQuota(err: unknown): boolean {
  return err instanceof DOMException && err.name === "QuotaExceededError";
}

export class MseFeeder {
  readonly stats: FeederStats;
  private _source: MediaSource | undefined;
  private _buffer: SourceBuffer | undefined;
  private _url: string | undefined;
  private _pending: { controller: AbortController; fromS: number; toS: number } | undefined;
  /** Where the media appended last continues: fragment index and time. */
  private _next: { index: number; atS: number } | undefined;
  /** Where the run of windows appended one after another began (s). */
  private _runStartS: number | undefined;
  /** The recording's end (s), once its last window is appended. */
  private _endS: number | undefined;
  private _bytesPerSecond = 0;
  /** Events drive fetching once the first window is in (start() fetches that). */
  private _ready = false;
  private _closed = false;
  private readonly _listeners: [EventTarget, string, EventListener][] = [];

  constructor(
    private readonly _video: HTMLVideoElement,
    private readonly _src: MseSource,
    /** Called once for a failure after start() resolved (never after destroy). */
    private readonly _onError: (err: Error) => void,
  ) {
    this.stats = { api: "MediaSource", mime: "", windows: 0, bytes: 0, lastWaitMs: undefined, trims: 0, fetching: false };
  }

  /** Whether destroy() was called (or a failure ended feeding). */
  get closed(): boolean {
    return this._closed;
  }

  /** Seconds buffered ahead of and behind the play position. */
  get around(): { ahead: number; behind: number } {
    const t = this._video.currentTime;
    const range = this._buffer ? this._rangeAt(t) : undefined;
    return range ? { ahead: range.end - t, behind: t - range.start } : { ahead: 0, behind: 0 };
  }

  /**
   * Attach to the video, append the init segment and the window holding
   * `offsetMs`. Rejects with MseUnsupported when the file player should
   * take over, or another error (e.g. the URL expired).
   */
  async start(offsetMs: number): Promise<void> {
    const api = mseApiName();
    if (!api) throw new MseUnsupported("this browser has no MediaSource");
    this.stats.api = api;
    const Ctor = ctorOf(api);
    const source = new Ctor();
    this._source = source;
    // ManagedMediaSource plays only with remote playback (AirPlay) off.
    this._video.disableRemotePlayback = true;
    this._url = URL.createObjectURL(source);
    const opened = new Promise<void>((resolve) => {
      source.addEventListener("sourceopen", () => {
        resolve();
      }, { once: true });
    });
    this._video.src = this._url;
    await opened;
    if (this._gone()) return;
    const init = await this._get("init");
    const mime = init.headers.get("X-RV-Mime") ?? "";
    this.stats.mime = mime;
    if (!mime || !Ctor.isTypeSupported(mime)) {
      throw new MseUnsupported(`MSE cannot play ${mime || "this recording"}`);
    }
    const data = new Uint8Array(await init.arrayBuffer());
    if (this._gone()) return;
    this._buffer = source.addSourceBuffer(mime);
    if (this._src.durationMs > 0) source.duration = this._src.durationMs / 1000;
    for (const name of ["timeupdate", "seeking", "ratechange", "progress"]) this._listen(this._video, name, this._pump);
    this._listen(this._video, "waiting", this._jumpGap);
    this._listen(source, "startstreaming", this._pump);
    this._listen(this._buffer, "updateend", this._pump);
    this._listen(this._buffer, "bufferedchange", this._pump);
    await this._append(data);
    await this._fetch({ at: offsetMs }, FIRST_WINDOW_MS, true);
    // The player moves the video to the offset once it has metadata; if that
    // has not happened yet, do it now, so the next window follows the start.
    if (offsetMs > 0 && this._video.currentTime === 0) this._video.currentTime = offsetMs / 1000;
    this._ready = true;
    this._pump();
  }

  /** Stop fetching and let go of the video (the caller resets its src). */
  destroy(): void {
    this._closed = true;
    this._pending?.controller.abort();
    this._pending = undefined;
    for (const [target, name, listener] of this._listeners) target.removeEventListener(name, listener);
    this._listeners.length = 0;
    if (this._url) URL.revokeObjectURL(this._url);
  }

  /** destroy() was called while awaiting (a method: not narrowed across awaits). */
  private _gone(): boolean {
    return this._closed;
  }

  /** A fetch ended: it is no longer pending unless another replaced it. */
  private _settle(controller: AbortController): void {
    if (this._pending && this._pending.controller === controller) this._pending = undefined;
    this.stats.fetching = this._pending !== undefined;
  }

  private _listen(target: EventTarget, name: string, listener: () => void): void {
    target.addEventListener(name, listener);
    this._listeners.push([target, name, listener]);
  }

  private async _get(path: string, signal?: AbortSignal): Promise<Response> {
    const response = await this._src.fetch(`${this._src.base}/${path}`, signal ? { signal } : {});
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      // The server says the recording cannot be fragments: the file player can try.
      if (text.startsWith("not playable as fragments")) throw new MseUnsupported(text);
      throw new Error(`HTTP ${response.status}${text ? `: ${text}` : ""}`);
    }
    return response;
  }

  /** Decide what to fetch or trim next (on time, seeking, rate and buffer events). */
  private readonly _pump = (): void => {
    const buffer = this._buffer;
    if (this._closed || !this._ready || !buffer) return;
    const t = this._video.currentTime;
    const range = this._rangeAt(t);
    // At the recording's end: nothing more to fetch (the video ends).
    if (!range && this._endS !== undefined && t >= this._endS - JOIN_S) return;
    const pending = this._pending;
    if (pending) {
      // A seek away from the window on its way: drop it, fetch where the video is.
      if (range || (t >= pending.fromS - 0.1 && t < pending.toS)) return;
      pending.controller.abort();
      this._pending = undefined;
    }
    if (buffer.updating) return;
    if (!range) {
      // Inside what was just appended but not covered yet (a window can end a
      // hair before the play position): extend it, do not ask again.
      const next = this._next;
      const run = this._runStartS;
      if (next && run !== undefined && t >= run - JOIN_S && t < next.atS + JOIN_S) {
        void this._fetch({ first: next.index }, FIRST_WINDOW_MS, false);
      } else {
        void this._fetch({ at: t * 1000 }, FIRST_WINDOW_MS, false);
      }
      return;
    }
    if (this._trim(t, range)) return;
    if (this._endS !== undefined && range.end >= this._endS - JOIN_S) {
      // The end is buffered. A removal (trimming behind) reopens the source:
      // end it again, or the video waits at the end for more.
      this._endOfStream();
      return;
    }
    const streaming = (this._source as { streaming?: boolean } | undefined)?.streaming;
    if (streaming === false) return; // ManagedMediaSource asked for a pause
    if (range.end - t >= aheadTarget(this._video.playbackRate, this._bytesPerSecond)) return;
    const next = this._next;
    const query = next && Math.abs(next.atS - range.end) < JOIN_S ? { first: next.index } : { at: range.end * 1000 };
    const ms = Math.min(WINDOW_MS * Math.max(1, this._video.playbackRate), WINDOW_MAX_MS);
    void this._fetch(query, ms, false);
  };

  private async _fetch(query: { at?: number; first?: number }, ms: number, starting: boolean): Promise<void> {
    const controller = new AbortController();
    const fromS = query.at !== undefined ? query.at / 1000 : (this._next?.atS ?? 0);
    this._pending = { controller, fromS, toS: fromS + ms / 1000 };
    this.stats.fetching = true;
    const began = performance.now();
    const where = query.first !== undefined ? `first=${query.first}` : `at=${Math.round(query.at ?? 0)}`;
    try {
      const response = await this._get(`frags?${where}&ms=${Math.round(ms)}&bytes=${WINDOW_MAX_BYTES}`, controller.signal);
      const data = new Uint8Array(await response.arrayBuffer());
      if (this._closed || controller.signal.aborted) return;
      const header = (name: string) => Number(response.headers.get(`X-RV-${name}`));
      const [first, count, start, end] = [header("First"), header("Count"), header("Start"), header("End")];
      this.stats.windows += 1;
      this.stats.bytes += data.length;
      this.stats.lastWaitMs = performance.now() - began;
      if (count > 0) {
        await this._append(data);
        if (query.first === undefined || this._runStartS === undefined) this._runStartS = start / 1000;
        this._next = { index: first + count, atS: end / 1000 };
        if (end > start) this._bytesPerSecond = (data.length * 1000) / (end - start);
      }
      if (response.headers.get("X-RV-Last") === "1") {
        this._endS = count > 0 ? end / 1000 : this._video.duration;
        this._endOfStream();
      } else if (count === 0) {
        // The server sends at least one fragment unless the recording ended;
        // should it not, ask again later rather than at once.
        this._settle(controller);
        setTimeout(this._pump, EMPTY_RETRY_MS);
        return;
      }
    } catch (err) {
      if (this._closed || controller.signal.aborted) return;
      if (starting) throw err;
      this._closed = true;
      this._onError(err instanceof Error ? err : new Error(String(err)));
      return;
    } finally {
      this._settle(controller);
    }
    this._pump();
  }

  private async _append(data: Uint8Array<ArrayBuffer>): Promise<void> {
    const buffer = this._buffer;
    if (!buffer) return;
    await this._idle(buffer);
    try {
      buffer.appendBuffer(data);
    } catch (err) {
      if (!isQuota(err)) throw err;
      // Full: drop everything but the few seconds around the play position.
      await this._removeAllBut(buffer, 2);
      buffer.appendBuffer(data);
    }
    await this._idle(buffer);
  }

  /** Wait for the buffer to finish an append or removal; an append error throws. */
  private _idle(buffer: SourceBuffer): Promise<void> {
    if (!buffer.updating) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const done = () => {
        buffer.removeEventListener("error", failed);
        resolve();
      };
      const failed = () => {
        buffer.removeEventListener("updateend", done);
        reject(new MseUnsupported("append error"));
      };
      buffer.addEventListener("updateend", done, { once: true });
      buffer.addEventListener("error", failed, { once: true });
    });
  }

  private async _removeAllBut(buffer: SourceBuffer, seconds: number): Promise<void> {
    const t = this._video.currentTime;
    for (const range of joinedRanges(buffer.buffered)) {
      const keepFrom = Math.max(range.start, t - seconds);
      const keepTo = Math.min(range.end, t + seconds);
      if (keepTo <= keepFrom) {
        buffer.remove(range.start, range.end);
        await this._idle(buffer);
        continue;
      }
      if (keepFrom > range.start) {
        buffer.remove(range.start, keepFrom);
        await this._idle(buffer);
      }
      if (range.end > keepTo) {
        buffer.remove(keepTo, range.end);
        await this._idle(buffer);
      }
    }
    this.stats.trims += 1;
  }

  /** Start one removal if media gathered behind or out of reach; true if it did. */
  private _trim(t: number, current: Range): boolean {
    const buffer = this._buffer;
    if (!buffer) return false;
    for (const range of joinedRanges(buffer.buffered)) {
      if (range.start === current.start) continue;
      if (range.end < t - BEHIND_S || range.start > t + AHEAD_MAX_S) {
        buffer.remove(range.start, range.end);
        this.stats.trims += 1;
        return true;
      }
    }
    if (t - current.start > BEHIND_S + TRIM_SLACK_S) {
      buffer.remove(current.start, t - BEHIND_S);
      this.stats.trims += 1;
      return true;
    }
    return false;
  }

  private _endOfStream(): void {
    const source = this._source;
    const buffer = this._buffer;
    if (!source || !buffer || source.readyState !== "open") return;
    if (buffer.updating) {
      buffer.addEventListener("updateend", () => {
        this._endOfStream();
      }, { once: true });
      return;
    }
    try {
      source.endOfStream();
    } catch {
      // Not open any more (a new append reopens it later).
    }
  }

  private _rangeAt(t: number): Range | undefined {
    const buffer = this._buffer;
    if (!buffer) return undefined;
    return joinedRanges(buffer.buffered).find((r) => t >= r.start - 0.05 && t < r.end);
  }

  /** Stuck at a small gap between buffered ranges: step over it. */
  private readonly _jumpGap = (): void => {
    const buffer = this._buffer;
    if (this._closed || !buffer) return;
    const t = this._video.currentTime;
    const ranges = buffer.buffered;
    for (let i = 0; i < ranges.length; i += 1) {
      const start = ranges.start(i);
      if (start > t && start - t < JOIN_S) {
        this._video.currentTime = start + 0.001;
        return;
      }
    }
  };
}

import { LitElement, css, html, nothing, type TemplateResult } from "lit";

import { MseFeeder, MseUnsupported, type FeederStats, type MseSource } from "./mse-feeder";

/** One recording the player can show: a file URL, or MSE fragments. */
export interface PlayItem {
  /** Tells sources apart: the URL or the fragment path (one per grant). */
  key: string;
  /** Tells recordings apart (stream, recording, copy): what a swap or preload compares. */
  recording: string;
  url?: string;
  mse?: MseSource;
  segmentId: string;
  /** UTC ms of the recording's first frame (per the search). */
  start: number;
  end: number;
  /** Called once the player no longer holds the recording (ends its lease). */
  release?: () => void;
}

export interface FirstFrameDetail {
  segmentId: string;
  /** From the request to play (e.g. a click) to the first frame on screen. */
  ms: number;
}

export interface AdvanceDetail {
  segmentId: string;
  /** From the end of one file to the first frame of the next. */
  gapMs: number;
}

export interface PlayerErrorDetail {
  message: string;
  segmentId: string | undefined;
  /** The recording had been playing (a read failed mid-way, not at the start). */
  played: boolean;
  /** The MSE player cannot play this recording: the file player may. */
  fallback: boolean;
}

/** The speeds offered (playbackRate). */
export const RATES = [0.5, 1, 2, 4, 8] as const;

/**
 * A two-buffer player. The active <video> plays the current recording; the
 * hidden one holds the next recording, already loading, so moving on at the
 * end of a file is a swap rather than a new request. Each <video> plays a
 * file URL, or MSE fragments fed by an MseFeeder.
 *
 * Events: `rv-time` (absolute time while playing), `rv-first-frame`,
 * `rv-advanced` (moved to the preloaded file), `rv-ended` (nothing preloaded),
 * `rv-player-error`.
 */
export class RvPlayer extends LitElement {
  static override properties = {
    muted: { type: Boolean },
    rate: { type: Number },
    note: { attribute: false },
    _active: { state: true },
    _paused: { state: true },
    _waiting: { state: true },
    _started: { state: true },
  };

  declare muted: boolean;
  /** Playback speed (both videos, so a file change keeps it). */
  declare rate: number;
  /** Shown over the video while it waits (e.g. download progress). */
  declare note: string | undefined;
  declare _active: 0 | 1;
  declare _paused: boolean;
  declare _waiting: boolean;
  /** A recording was asked for: until then, no controls on the empty board. */
  declare _started: boolean;

  private _items: [PlayItem | undefined, PlayItem | undefined] = [undefined, undefined];
  private _keys: [string | undefined, string | undefined] = [undefined, undefined];
  private _feeders: [MseFeeder | undefined, MseFeeder | undefined] = [undefined, undefined];
  private _requestedAt: number | undefined;
  /** The first frame after a seek within the recording counts at `seeked`. */
  private _firstOnSeeked = false;
  private _endedAt: number | undefined;
  private _pendingOffset: [number, number] = [0, 0];

  constructor() {
    super();
    this.muted = true;
    this.rate = 1;
    this._active = 0;
    this._paused = true;
    this._waiting = false;
    this._started = false;
  }

  protected override updated(changed: Map<string, unknown>): void {
    if (changed.has("rate")) {
      for (const slot of [0, 1] as const) this._applyRate(this._video(slot));
    }
  }

  /** The active feeder's counters, if the recording plays through MSE. */
  get mseStats(): (FeederStats & { ahead: number; behind: number }) | undefined {
    const feeder = this._feeders[this._active];
    return feeder ? { ...feeder.stats, ...feeder.around } : undefined;
  }

  /** Whether the recording on screen plays through MSE (and that still works). */
  get mse(): boolean {
    const feeder = this._feeders[this._active];
    return feeder !== undefined && !feeder.closed;
  }

  /** The recording on screen. */
  get current(): PlayItem | undefined {
    return this._items[this._active];
  }

  /** The recording waiting in the hidden buffer. */
  get preloaded(): PlayItem | undefined {
    return this._items[this._other];
  }

  /** Absolute time (UTC ms) of the frame on screen. */
  get time(): number | undefined {
    const item = this.current;
    const video = this._video(this._active);
    return item && video ? item.start + video.currentTime * 1000 : undefined;
  }

  get paused(): boolean {
    return this._paused;
  }

  private get _other(): 0 | 1 {
    return this._active === 0 ? 1 : 0;
  }

  private _video(index: 0 | 1): HTMLVideoElement | null {
    return this.renderRoot.querySelector<HTMLVideoElement>(`video[data-slot="${index}"]`);
  }

  /** Play a recording from an offset (ms into the file). */
  async play(item: PlayItem, offsetMs = 0, requestedAt = performance.now()): Promise<void> {
    await this.updateComplete;
    this._started = true;
    this._requestedAt = requestedAt;
    this._firstOnSeeked = false;
    this._endedAt = undefined;
    // Already preloaded? Swap to it (its source, fetched moments ago, serves).
    const swap = this.preloaded?.recording === item.recording;
    if (swap) {
      this._video(this._active)?.pause();
      this._active = this._other;
    }
    const slot = this._active;
    const video = this._video(slot);
    if (!video) return;
    this._pendingOffset[slot] = offsetMs;
    if (swap) {
      this._seekTo(video, offsetMs);
    } else {
      // A new source, even of the same recording (e.g. after its URL expired).
      this._setItem(slot, item);
      this._load(slot, video, item, offsetMs);
    }
    this._start(video);
    this.requestUpdate();
  }

  /** Start loading the next recording into the hidden buffer. */
  async preload(item: PlayItem | undefined): Promise<void> {
    await this.updateComplete;
    const slot = this._other;
    const video = this._video(slot);
    if (!video || this._items[slot]?.recording === item?.recording) {
      // Already there: the new source is not needed.
      if (item && item !== this._items[slot]) item.release?.();
      return;
    }
    this._setItem(slot, item);
    this._pendingOffset[slot] = 0;
    video.pause();
    if (item) {
      video.preload = "auto";
      this._load(slot, video, item, 0);
    } else {
      this._unload(slot, video);
    }
  }

  /** Seek within the current recording. */
  seek(offsetMs: number): void {
    const video = this._video(this._active);
    if (video) this._seekTo(video, offsetMs);
  }

  /**
   * Seek within the current recording as a new start: its first frame is
   * reported (`rv-first-frame`) once the video has it.
   */
  seekWithin(offsetMs: number, requestedAt = performance.now()): void {
    const video = this._video(this._active);
    if (!video) return;
    this._requestedAt = requestedAt;
    this._firstOnSeeked = true;
    this._seekTo(video, offsetMs);
    this._start(video);
  }

  /**
   * Show the frame at an absolute time while scrubbing, if the recording on
   * screen has it buffered. Returns whether it could.
   */
  preview(time: number): boolean {
    const item = this.current;
    const video = this._video(this._active);
    if (!item || !video || time < item.start || time > item.end) return false;
    const seconds = (time - item.start) / 1000;
    const ranges = video.buffered;
    for (let i = 0; i < ranges.length; i += 1) {
      if (seconds >= ranges.start(i) && seconds <= ranges.end(i)) {
        if (typeof video.fastSeek === "function") video.fastSeek(seconds);
        else video.currentTime = seconds;
        return true;
      }
    }
    return false;
  }

  pause(): void {
    this._video(this._active)?.pause();
  }

  resume(): void {
    const video = this._video(this._active);
    if (video) this._start(video);
  }

  stop(): void {
    for (const slot of [0, 1] as const) {
      const video = this._video(slot);
      video?.pause();
      if (video) this._unload(slot, video);
      this._setItem(slot, undefined);
    }
    this._paused = true;
    this._waiting = false;
  }

  /** Put a recording in a slot; the one it replaces is released. */
  private _setItem(slot: 0 | 1, item: PlayItem | undefined): void {
    const old = this._items[slot];
    this._items[slot] = item;
    if (old && old !== item && !this._items.includes(old)) old.release?.();
  }

  private _load(slot: 0 | 1, video: HTMLVideoElement, item: PlayItem, offsetMs: number): void {
    this._feeders[slot]?.destroy();
    this._feeders[slot] = undefined;
    this._keys[slot] = item.key;
    if (item.mse) {
      const feeder = new MseFeeder(video, item.mse, (err) => {
        this._feederFailed(slot, item, err);
      });
      this._feeders[slot] = feeder;
      feeder.start(offsetMs).catch((err: unknown) => {
        if (!feeder.closed) this._feederFailed(slot, item, err instanceof Error ? err : new Error(String(err)));
      });
    } else if (item.url) {
      // AirPlay is off only while MSE feeds the video (ManagedMediaSource needs that).
      video.disableRemotePlayback = false;
      video.setAttribute("src", item.url);
      video.load();
    }
    this._applyRate(video);
  }

  private _unload(slot: 0 | 1, video: HTMLVideoElement): void {
    this._feeders[slot]?.destroy();
    this._feeders[slot] = undefined;
    this._keys[slot] = undefined;
    if (video.getAttribute("src")) {
      video.removeAttribute("src");
      video.load();
    }
  }

  private _applyRate(video: HTMLVideoElement | null): void {
    if (!video) return;
    video.defaultPlaybackRate = this.rate;
    video.playbackRate = this.rate;
  }

  private _feederFailed(slot: 0 | 1, item: PlayItem, err: Error): void {
    if (this._items[slot] !== item) return;
    if (slot !== this._active) {
      // The preloaded recording failed: forget it; it is fetched again when needed.
      this._setItem(slot, undefined);
      const video = this._video(slot);
      if (video) this._unload(slot, video);
      return;
    }
    const video = this._video(slot);
    if (video) this._fail(err.message, video, err instanceof MseUnsupported);
  }

  private _seekTo(video: HTMLVideoElement, offsetMs: number): void {
    const seconds = Math.max(0, offsetMs / 1000);
    if (video.readyState >= 1) video.currentTime = seconds;
    else this._pendingOffset[Number(video.dataset.slot) as 0 | 1] = offsetMs;
  }

  private _start(video: HTMLVideoElement): void {
    const played = video.play() as Promise<void> | undefined;
    played?.catch((err: unknown) => {
      // Autoplay refusals are not errors: the user can press play.
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        this._paused = true;
        return;
      }
      if (err instanceof DOMException && err.name === "AbortError") return;
      this._fail(String(err), video, false);
    });
  }

  private _fail(message: string, video: HTMLVideoElement, fallback: boolean): void {
    const detail: PlayerErrorDetail = {
      message,
      segmentId: this.current?.segmentId,
      played: video.currentTime > 0,
      fallback,
    };
    this.dispatchEvent(new CustomEvent("rv-player-error", { detail, bubbles: true, composed: true }));
  }

  private _emit(name: string, detail: object): void {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  private _onMetadata(slot: 0 | 1, event: Event): void {
    const video = event.target as HTMLVideoElement;
    const offset = this._pendingOffset[slot];
    if (offset > 0) video.currentTime = offset / 1000;
    this._pendingOffset[slot] = 0;
  }

  private _onPlaying(slot: 0 | 1): void {
    if (slot !== this._active) return;
    this._paused = false;
    this._waiting = false;
    const item = this.current;
    if (!item) return;
    const now = performance.now();
    if (this._endedAt !== undefined) {
      const detail: AdvanceDetail = { segmentId: item.segmentId, gapMs: now - this._endedAt };
      this._emit("rv-advanced", detail);
      this._endedAt = undefined;
    } else if (this._requestedAt !== undefined) {
      const detail: FirstFrameDetail = { segmentId: item.segmentId, ms: now - this._requestedAt };
      this._emit("rv-first-frame", detail);
    }
    this._requestedAt = undefined;
  }

  private _onSeeked(slot: 0 | 1): void {
    if (slot !== this._active) return;
    this._waiting = false;
    const item = this.current;
    if (!this._firstOnSeeked || this._requestedAt === undefined || !item) return;
    const detail: FirstFrameDetail = { segmentId: item.segmentId, ms: performance.now() - this._requestedAt };
    this._emit("rv-first-frame", detail);
    this._requestedAt = undefined;
    this._firstOnSeeked = false;
  }

  private _onEnded(slot: 0 | 1): void {
    if (slot !== this._active) return;
    const finished = this.current;
    this._endedAt = performance.now();
    const next = this.preloaded;
    if (next) {
      this._setItem(slot, undefined);
      // Free the finished recording's buffer (MSE) for the next preload.
      const done = this._video(slot);
      if (done) this._unload(slot, done);
      this._active = this._other;
      const video = this._video(this._active);
      if (video) this._start(video);
    } else {
      this._endedAt = undefined;
      this._paused = true;
      this._emit("rv-ended", { segmentId: finished?.segmentId });
    }
  }

  private _onTime(slot: 0 | 1): void {
    if (slot !== this._active) return;
    const time = this.time;
    if (time !== undefined) this._emit("rv-time", { time });
  }

  private _onError(slot: 0 | 1, event: Event): void {
    const video = event.target as HTMLVideoElement;
    if (!video.getAttribute("src")) return;
    if (slot !== this._active) {
      // The preloaded file failed: forget it; it is fetched again when needed.
      this._setItem(slot, undefined);
      return;
    }
    // Through MSE, a media error is the fragments' (the file may still play).
    const mse = this._feeders[slot] !== undefined;
    this._fail(video.error?.message || `media error ${video.error?.code ?? "?"}`, video, mse);
  }

  private _renderVideo(slot: 0 | 1): TemplateResult {
    return html`<video
      data-slot=${slot}
      class=${slot === this._active ? "active" : "hidden"}
      playsinline
      .muted=${this.muted}
      ?controls=${slot === this._active && this._started}
      preload="auto"
      @loadedmetadata=${(e: Event) => {
        this._onMetadata(slot, e);
      }}
      @playing=${() => {
        this._onPlaying(slot);
      }}
      @seeked=${() => {
        this._onSeeked(slot);
      }}
      @waiting=${() => {
        if (slot === this._active) this._waiting = true;
      }}
      @pause=${() => {
        if (slot === this._active) this._paused = true;
      }}
      @ended=${() => {
        this._onEnded(slot);
      }}
      @timeupdate=${() => {
        this._onTime(slot);
      }}
      @error=${(e: Event) => {
        this._onError(slot, e);
      }}
    ></video>`;
  }

  protected override render(): TemplateResult {
    const note = this._waiting || (this._requestedAt !== undefined && this.note) ? this.note : undefined;
    return html`<div class="frame">
      ${this._renderVideo(0)}${this._renderVideo(1)}
      ${note ? html`<div class="note" role="status">${note}</div>` : nothing}
      ${this._started ? nothing : html`<p class="empty">Pick an event or a time on the timeline to play it.</p>`}
    </div>`;
  }

  static override styles = css`
    :host {
      display: block;
    }
    .frame {
      position: relative;
      width: 100%;
      aspect-ratio: 16 / 9;
      background: var(--rv-board, #000);
      overflow: hidden;
    }
    video {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: var(--rv-board, #000);
    }
    .note {
      position: absolute;
      left: 50%;
      bottom: 48px;
      transform: translateX(-50%);
      max-width: calc(100% - 32px);
      padding: 6px 12px;
      background: rgba(17, 20, 24, 0.82);
      color: var(--rv-on-board, #fff);
      font-family: var(--rv-font, sans-serif);
      font-size: 14px;
      font-weight: 500;
      text-align: center;
      pointer-events: none;
    }
    .empty {
      position: absolute;
      inset: 0;
      margin: 0;
      display: grid;
      place-items: center;
      padding: 16px;
      color: var(--rv-on-board-muted, #a9b0c4);
      font-family: var(--rv-font, sans-serif);
      font-size: 15px;
      text-align: center;
    }
    /* The hidden buffer stays laid out (some browsers do not load hidden video). */
    video.hidden {
      opacity: 0;
      pointer-events: none;
    }
  `;
}

if (!customElements.get("rv-player")) {
  customElements.define("rv-player", RvPlayer);
}

declare global {
  interface HTMLElementTagNameMap {
    "rv-player": RvPlayer;
  }
}

import { LitElement, css, html, type TemplateResult } from "lit";

/** One recording the player can show. */
export interface PlayItem {
  url: string;
  segmentId: string;
  /** UTC ms of the recording's first frame (per the search). */
  start: number;
  end: number;
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
}

/**
 * A simple two-buffer player. The active <video> plays the current recording;
 * the hidden one holds the next recording, already loading, so moving on at
 * the end of a file is a swap rather than a new request.
 *
 * Events: `rv-time` (absolute time while playing), `rv-first-frame`,
 * `rv-advanced` (moved to the preloaded file), `rv-ended` (nothing preloaded),
 * `rv-player-error`.
 */
export class RvPlayer extends LitElement {
  static override properties = {
    muted: { type: Boolean },
    _active: { state: true },
    _paused: { state: true },
  };

  declare muted: boolean;
  declare _active: 0 | 1;
  declare _paused: boolean;

  private _items: [PlayItem | undefined, PlayItem | undefined] = [undefined, undefined];
  private _requestedAt: number | undefined;
  private _endedAt: number | undefined;
  private _pendingOffset: [number, number] = [0, 0];

  constructor() {
    super();
    this.muted = true;
    this._active = 0;
    this._paused = true;
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
    this._requestedAt = requestedAt;
    this._endedAt = undefined;
    // Already preloaded? Swap to it instead of loading again.
    if (this.preloaded?.url === item.url) this._active = this._other;
    const slot = this._active;
    const video = this._video(slot);
    if (!video) return;
    this._items[slot] = item;
    this._pendingOffset[slot] = offsetMs;
    if (video.getAttribute("src") !== item.url) {
      video.setAttribute("src", item.url);
      video.load();
    } else {
      this._seekTo(video, offsetMs);
    }
    this._start(video);
    this.requestUpdate();
  }

  /** Start loading the next recording into the hidden buffer. */
  async preload(item: PlayItem | undefined): Promise<void> {
    await this.updateComplete;
    const slot = this._other;
    const video = this._video(slot);
    if (!video || this._items[slot]?.url === item?.url) return;
    this._items[slot] = item;
    this._pendingOffset[slot] = 0;
    video.pause();
    if (item) {
      video.setAttribute("src", item.url);
      video.preload = "auto";
      video.load();
    } else {
      video.removeAttribute("src");
    }
  }

  /** Seek within the current recording. */
  seek(offsetMs: number): void {
    const video = this._video(this._active);
    if (video) this._seekTo(video, offsetMs);
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
      video?.removeAttribute("src");
      this._items[slot] = undefined;
    }
    this._paused = true;
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
      this._fail(String(err), video);
    });
  }

  private _fail(message: string, video: HTMLVideoElement): void {
    const detail: PlayerErrorDetail = {
      message,
      segmentId: this.current?.segmentId,
      played: video.currentTime > 0,
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

  private _onEnded(slot: 0 | 1): void {
    if (slot !== this._active) return;
    const finished = this.current;
    this._endedAt = performance.now();
    const next = this.preloaded;
    if (next) {
      this._items[slot] = undefined;
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
      this._items[slot] = undefined;
      return;
    }
    this._fail(video.error?.message || `media error ${video.error?.code ?? "?"}`, video);
  }

  private _renderVideo(slot: 0 | 1): TemplateResult {
    return html`<video
      data-slot=${slot}
      class=${slot === this._active ? "active" : "hidden"}
      playsinline
      .muted=${this.muted}
      ?controls=${slot === this._active}
      preload="auto"
      @loadedmetadata=${(e: Event) => {
        this._onMetadata(slot, e);
      }}
      @playing=${() => {
        this._onPlaying(slot);
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
    return html`<div class="frame">${this._renderVideo(0)}${this._renderVideo(1)}</div>`;
  }

  static override styles = css`
    :host {
      display: block;
    }
    .frame {
      position: relative;
      width: 100%;
      aspect-ratio: 16 / 9;
      background: #000;
      border-radius: 8px;
      overflow: hidden;
    }
    video {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: #000;
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

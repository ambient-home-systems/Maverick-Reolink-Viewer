// The picture a scrub shows over the player (Phase 10 step 2): the key frame
// the server sent for the moment under the pointer, drawn where the video is
// (it goes in the player's `over` slot), with the picture's own time. Pictures
// are painted newest first: one that comes while another is painted waits,
// and only the last of those is painted next. A picture within one key-frame
// interval of the pointer is on time (the camera has none nearer); one
// further off is shown dimmed while the next one comes.

import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from "lit";

import type { FrameLike } from "./keyframes";
import type { ScrubPicture } from "./scrub-client";
import { KeyFramePainter, MsePainter } from "./scrub-paint";
import { formatClock } from "./time";

/** The key-frame interval (ms) where the server does not know the camera's (most cameras'). */
export const DEFAULT_INTERVAL_MS = 4000;
/** A picture further than its camera's interval and this (ms) from the pointer is late, and dimmed. */
export const LATE_SLACK_MS = 500;

/** How this browser shows the pictures: decoded with WebCodecs, played through MSE, or not at all. */
export interface PaintPath {
  how: "WebCodecs" | "MSE" | "none";
  /** Why not WebCodecs, in words. */
  why?: string;
}

/** A picture painted (the `rv-scrub-painted` event): the playback check times them. */
export interface PaintedDetail {
  /** The picture's own time, and the moment asked (UTC ms). */
  time: number;
  at: number;
  source: string;
  how: "canvas" | "video" | "jpeg";
  /** The ask's round trip, and from the picture's arrival to its painting (ms). */
  ms: number;
  paintMs: number;
  /** The camera's key-frame interval, as the server knows it (ms). */
  interval?: number;
}

/** Whether a picture of `time` is late for the pointer at `pointer`. */
export function isLate(time: number, pointer: number | undefined, interval: number | undefined): boolean {
  return pointer !== undefined && Math.abs(pointer - time) > (interval ?? DEFAULT_INTERVAL_MS) + LATE_SLACK_MS;
}

export class RvScrubPicture extends LitElement {
  static override properties = {
    picture: { attribute: false },
    pointer: { attribute: false },
    timeZone: { attribute: false },
    _shown: { state: true },
    _jpeg: { state: true },
  };

  /** The picture to show; none hides the element. */
  declare picture: ScrubPicture | undefined;
  /** Where the pointer is (UTC ms). */
  declare pointer: number | undefined;
  declare timeZone: string | undefined;
  /** The picture on screen (painted), and how. */
  declare _shown: { time: number; interval?: number; how: "canvas" | "video" | "jpeg" } | undefined;
  declare _jpeg: string | undefined;

  /** The painters (replaceable in the tests). */
  codecs = new KeyFramePainter();
  mse = new MsePainter();
  private _painting = false;
  private _next: ScrubPicture | undefined;

  constructor() {
    super();
    this._shown = undefined;
  }

  /** Whether this browser can show a key frame (WebCodecs, or MSE). */
  get canShow(): boolean {
    return this.codecs.available || this.mse.available;
  }

  /** How the pictures are shown here, and why not WebCodecs. */
  get path(): PaintPath {
    if (this.codecs.available) return { how: "WebCodecs" };
    if (this.mse.available) {
      return {
        how: "MSE",
        why: window.isSecureContext
          ? "this browser has no VideoDecoder"
          : "no VideoDecoder: WebCodecs needs a secure page (HTTPS), and this one is plain HTTP",
      };
    }
    return { how: "none", why: "this browser has neither WebCodecs nor MSE" };
  }

  /** Whether a picture is on screen now. */
  get showing(): boolean {
    return this.picture !== undefined && this._shown !== undefined;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.codecs.close();
    this.mse.close(this._video ?? undefined);
    this._revoke();
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (!changed.has("picture")) return;
    const picture = this.picture;
    if (!picture) {
      this._next = undefined;
      this._shown = undefined;
      return;
    }
    this._next = picture;
    if (!this._painting) void this._paintNext();
  }

  private get _canvas(): HTMLCanvasElement | null {
    return this.renderRoot.querySelector("canvas");
  }

  private get _video(): HTMLVideoElement | null {
    return this.renderRoot.querySelector("video");
  }

  private async _paintNext(): Promise<void> {
    this._painting = true;
    try {
      while (this._next) {
        const picture = this._next;
        this._next = undefined;
        await this._paint(picture);
      }
    } finally {
      this._painting = false;
    }
  }

  private async _paint(picture: ScrubPicture): Promise<void> {
    const began = performance.now();
    if (picture.kind === "jpeg") {
      this._revoke();
      this._jpeg = URL.createObjectURL(new Blob([picture.data as Uint8Array<ArrayBuffer>], { type: "image/jpeg" }));
      this._show(picture, "jpeg", began);
      return;
    }
    if (this.codecs.available) {
      const painted = await this.codecs.paint(picture, (frame) => {
        this._draw(frame);
      });
      if (painted && this.picture) this._show(picture, "canvas", began);
      return;
    }
    const video = this._video;
    if (video && this.mse.available && (await this.mse.paint(picture, video)) && this.picture) {
      this._show(picture, "video", began);
    }
  }

  private _show(picture: ScrubPicture, how: "canvas" | "video" | "jpeg", began: number): void {
    this._shown = shown(picture, how);
    const detail: PaintedDetail = {
      time: picture.time,
      at: picture.at,
      source: picture.source,
      how,
      ms: picture.ms,
      paintMs: performance.now() - began,
      ...(picture.interval !== undefined ? { interval: picture.interval } : {}),
    };
    this.dispatchEvent(new CustomEvent<PaintedDetail>("rv-scrub-painted", { detail, bubbles: true, composed: true }));
  }

  private _draw(frame: FrameLike): void {
    const canvas = this._canvas;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    if (canvas.width !== frame.displayWidth || canvas.height !== frame.displayHeight) {
      canvas.width = frame.displayWidth;
      canvas.height = frame.displayHeight;
    }
    context.drawImage(frame as unknown as CanvasImageSource, 0, 0);
  }

  private _revoke(): void {
    if (this._jpeg) URL.revokeObjectURL(this._jpeg);
    this._jpeg = undefined;
  }

  protected override render(): TemplateResult {
    const shown = this.picture ? this._shown : undefined;
    const late = shown && isLate(shown.time, this.pointer, shown.interval);
    // Hidden from screen readers: the timeline's slider says the time, and a
    // label read out for every picture of a drag would drown it.
    return html`<div class="frame ${shown ? "on" : ""} ${late ? "late" : ""}" aria-hidden="true">
      <canvas class=${shown?.how === "canvas" ? "on" : ""}></canvas>
      <video class=${shown?.how === "video" ? "on" : ""} muted playsinline></video>
      ${shown?.how === "jpeg" && this._jpeg ? html`<img class="on" src=${this._jpeg} alt="" />` : nothing}
      ${shown
        ? html`<span class="time">${formatClock(shown.time, this.timeZone, true)}</span>`
        : nothing}
    </div>`;
  }

  static override styles = css`
    :host {
      display: block;
      pointer-events: none;
    }
    .frame {
      position: absolute;
      inset: 0;
      visibility: hidden;
      background: var(--rv-board, #000);
    }
    .frame.on {
      visibility: visible;
    }
    canvas,
    video,
    img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: contain;
      visibility: hidden;
    }
    canvas.on,
    video.on,
    img.on {
      visibility: visible;
    }
    .frame.late canvas,
    .frame.late video,
    .frame.late img {
      opacity: 0.6;
    }
    .time {
      position: absolute;
      left: 12px;
      top: 12px;
      padding: 4px 8px;
      background: rgba(17, 20, 24, 0.82);
      color: var(--rv-on-board, #fff);
      font-family: var(--rv-font, sans-serif);
      font-size: 14px;
      font-weight: 500;
      font-variant-numeric: tabular-nums;
    }
  `;
}

function shown(picture: ScrubPicture, how: "canvas" | "video" | "jpeg"): RvScrubPicture["_shown"] {
  return { time: picture.time, how, ...(picture.interval !== undefined ? { interval: picture.interval } : {}) };
}

if (!customElements.get("rv-scrub-picture")) {
  customElements.define("rv-scrub-picture", RvScrubPicture);
}

declare global {
  interface HTMLElementTagNameMap {
    "rv-scrub-picture": RvScrubPicture;
  }
}

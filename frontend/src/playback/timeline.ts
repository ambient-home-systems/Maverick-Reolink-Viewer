import { LitElement, css, html, type TemplateResult } from "lit";

import type { TimelineDay, TimelineEvent } from "../types";
import { formatClock, offsetAt } from "./time";
import {
  MINUTE,
  ZOOM_LEVELS,
  bars,
  clampView,
  tickStep,
  ticks,
  timeToX,
  xToTime,
  zoomAt,
  zoomIndex,
  type View,
} from "./timeline-math";

/** Wait this long without movement before asking for a hover thumbnail. */
export const HOVER_DEBOUNCE_MS = 150;
/** Movement below this many pixels between press and release is a click. */
const CLICK_SLOP_PX = 4;
const HEIGHT = 76;
const TICK_ROW = 18;
const BAR_TOP = 22;
const BAR_HEIGHT = 26;
const EVENT_TOP = 52;
const EVENT_HEIGHT = 16;

export interface TimeDetail {
  time: number;
}

export interface HoverDetail {
  time: number;
  x: number;
}

/**
 * The day timeline, drawn on a canvas: hour ticks, recording bars, one
 * coloured marker per event (by its most specific type), the play position
 * and the part of today still to come.
 *
 * Wheel zooms around the pointer (shift+wheel or a horizontal wheel pans);
 * press and drag scrubs; a click seeks. Events: `rv-view-change`,
 * `rv-seek`, `rv-scrub`, `rv-hover`, `rv-hover-end`.
 */
export class RvTimeline extends LitElement {
  static override properties = {
    day: { attribute: false },
    events: { attribute: false },
    view: { attribute: false },
    cursor: { attribute: false },
    timeZone: { attribute: false },
  };

  declare day: TimelineDay | undefined;
  /** The events to draw (already filtered). */
  declare events: TimelineEvent[];
  declare view: View;
  declare cursor: number | undefined;
  declare timeZone: string | undefined;

  private _width = 0;
  private _resize: ResizeObserver | undefined;
  private _drag: { pointerId: number; x: number; moved: boolean } | undefined;
  private _hoverTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    super();
    this.events = [];
    this.view = { start: 0, span: ZOOM_LEVELS[0] ?? 86_400_000 };
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (typeof ResizeObserver !== "undefined") {
      this._resize = new ResizeObserver(() => {
        this._draw();
      });
      this._resize.observe(this);
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._resize?.disconnect();
    clearTimeout(this._hoverTimer);
  }

  private get _canvas(): HTMLCanvasElement | null {
    return this.renderRoot.querySelector("canvas");
  }

  private get _bounds(): { start: number; end: number } {
    const day = this.day;
    return day ? { start: day.start, end: day.end } : { start: this.view.start, end: this.view.start + this.view.span };
  }

  /** Time under an x position (pixels from the canvas's left edge). */
  timeAt(x: number): number {
    return xToTime(x, this.view, this._width || 1);
  }

  protected override updated(): void {
    this._draw();
  }

  private _emit(name: string, detail: object): void {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  private _setView(view: View): void {
    const next = clampView(view, this._bounds);
    if (next.start === this.view.start && next.span === this.view.span) return;
    this._emit("rv-view-change", { view: next });
  }

  /** Zoom one level in (+1) or out (-1) around a time (default: the cursor). */
  zoom(direction: 1 | -1, anchor?: number): void {
    const index = Math.min(
      Math.max(zoomIndex(this.view.span) + direction, 0),
      ZOOM_LEVELS.length - 1,
    );
    const span = ZOOM_LEVELS[index] ?? this.view.span;
    const at = anchor ?? this.cursor ?? this.view.start + this.view.span / 2;
    this._setView(zoomAt(this.view, span, at, this._bounds));
  }

  /** Pan by a fraction of the visible span (negative: earlier). */
  pan(fraction: number): void {
    this._setView({ start: this.view.start + fraction * this.view.span, span: this.view.span });
  }

  private _x(event: PointerEvent | WheelEvent): number {
    const rect = this._canvas?.getBoundingClientRect();
    return event.clientX - (rect?.left ?? 0);
  }

  private _onWheel(event: WheelEvent): void {
    event.preventDefault();
    if (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
      const delta = event.shiftKey ? event.deltaY : event.deltaX;
      this.pan(Math.sign(delta) * 0.25);
      return;
    }
    if (event.deltaY === 0) return;
    this.zoom(event.deltaY < 0 ? 1 : -1, this.timeAt(this._x(event)));
  }

  private _onPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    this._drag = { pointerId: event.pointerId, x: this._x(event), moved: false };
    capture(this._canvas, event.pointerId, true);
  }

  private _onPointerMove(event: PointerEvent): void {
    const x = this._x(event);
    const drag = this._drag;
    if (drag && drag.pointerId === event.pointerId) {
      if (Math.abs(x - drag.x) > CLICK_SLOP_PX) drag.moved = true;
      if (drag.moved) {
        const time = this.timeAt(x);
        this._emit("rv-scrub", { time } satisfies TimeDetail);
        this._scheduleHover(time, x);
      }
      return;
    }
    if (event.pointerType === "mouse") this._scheduleHover(this.timeAt(x), x);
  }

  private _onPointerUp(event: PointerEvent): void {
    const drag = this._drag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    this._drag = undefined;
    capture(this._canvas, event.pointerId, false);
    this._emit("rv-seek", { time: this.timeAt(this._x(event)) } satisfies TimeDetail);
    if (event.pointerType !== "mouse") this._endHover();
  }

  private _scheduleHover(time: number, x: number): void {
    clearTimeout(this._hoverTimer);
    this._hoverTimer = setTimeout(() => {
      this._emit("rv-hover", { time, x } satisfies HoverDetail);
    }, HOVER_DEBOUNCE_MS);
  }

  private _endHover(): void {
    clearTimeout(this._hoverTimer);
    this._emit("rv-hover-end", {});
  }

  private _onKey(event: KeyboardEvent): void {
    const actions: Partial<Record<string, () => void>> = {
      ArrowLeft: () => {
        this.pan(-0.25);
      },
      ArrowRight: () => {
        this.pan(0.25);
      },
      "+": () => {
        this.zoom(1);
      },
      "=": () => {
        this.zoom(1);
      },
      "-": () => {
        this.zoom(-1);
      },
    };
    const action = actions[event.key];
    if (action) {
      event.preventDefault();
      action();
    }
  }

  private _draw(): void {
    const canvas = this._canvas;
    if (!canvas) return;
    const width = Math.max(1, Math.round(this.getBoundingClientRect().width || canvas.clientWidth || 300));
    this._width = width;
    const ratio = window.devicePixelRatio || 1;
    if (canvas.width !== width * ratio) {
      canvas.width = width * ratio;
      canvas.height = HEIGHT * ratio;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    // The Timetable's colours: recordings in rail blue, events in ink, the
    // time now in signal red and the playhead in ink.
    const style = getComputedStyle(this);
    const color = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
    const ink = color("--rv-text", "#111418");
    const muted = color("--rv-muted", "#5d6370");
    ctx.clearRect(0, 0, width, HEIGHT);

    const view = this.view;
    const x = (t: number) => timeToX(t, view, width);
    // Ticks and labels.
    ctx.font = `500 12px ${color("--rv-font", "sans-serif")}`;
    ctx.textBaseline = "top";
    ctx.fillStyle = muted;
    ctx.strokeStyle = color("--rv-rule", "#e0e0e0");
    ctx.lineWidth = 1;
    const zone = this.timeZone;
    const seconds = tickStep(view, width) < MINUTE;
    for (const t of ticks(view, width, (ms) => offsetAt(ms, zone))) {
      const px = Math.round(x(t)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(px, TICK_ROW - 4);
      ctx.lineTo(px, HEIGHT);
      ctx.stroke();
      const label = formatClock(t, zone, seconds);
      // Leave out a label that would be cut off at the right edge.
      if (px + 3 + ctx.measureText(label).width <= width) ctx.fillText(label, px + 3, 2);
    }
    const day = this.day;
    if (day) {
      // The part of today that has not happened yet.
      if (day.now < day.end) {
        ctx.fillStyle = color("--rv-ground-2", "#f2f2f2");
        const from = Math.max(0, x(day.now));
        ctx.fillRect(from, BAR_TOP, width - from, HEIGHT - BAR_TOP);
      }
      ctx.fillStyle = color("--rv-recording", "#1b2a6e");
      for (const bar of bars(day.segments, view, width)) {
        const left = Math.max(0, x(bar.start));
        const right = Math.min(width, x(bar.end));
        ctx.fillRect(left, BAR_TOP, Math.max(1, right - left), BAR_HEIGHT);
      }
      ctx.fillStyle = ink;
      for (const event of this.events) {
        if (event.end < view.start || event.start > view.start + view.span) continue;
        const left = x(event.start);
        const w = Math.max(3, x(event.end) - left);
        ctx.fillRect(left, EVENT_TOP, w, EVENT_HEIGHT);
      }
      if (day.now < day.end && day.now >= view.start && day.now <= view.start + view.span) {
        ctx.fillStyle = color("--rv-red", "#e10600");
        ctx.fillRect(Math.round(x(day.now)) - 1, TICK_ROW, 2, HEIGHT - TICK_ROW);
      }
    }
    if (this.cursor !== undefined) {
      // The playhead: an ink line under a small pointer on the tick row.
      const px = Math.round(x(this.cursor));
      ctx.fillStyle = ink;
      ctx.fillRect(px - 1, TICK_ROW, 2, HEIGHT - TICK_ROW);
      ctx.beginPath();
      ctx.moveTo(px - 6, TICK_ROW - 4);
      ctx.lineTo(px + 6, TICK_ROW - 4);
      ctx.lineTo(px, TICK_ROW + 3);
      ctx.closePath();
      ctx.fill();
    }
  }

  protected override render(): TemplateResult {
    return html`<canvas
      role="slider"
      tabindex="0"
      aria-label="Recording timeline"
      aria-valuemin=${this.day?.start ?? 0}
      aria-valuemax=${this.day?.end ?? 0}
      aria-valuenow=${this.cursor ?? 0}
      aria-valuetext=${this.cursor !== undefined ? formatClock(this.cursor, this.timeZone, true) : "no position"}
      @wheel=${(e: WheelEvent) => {
        this._onWheel(e);
      }}
      @pointerdown=${(e: PointerEvent) => {
        this._onPointerDown(e);
      }}
      @pointermove=${(e: PointerEvent) => {
        this._onPointerMove(e);
      }}
      @pointerup=${(e: PointerEvent) => {
        this._onPointerUp(e);
      }}
      @pointercancel=${() => {
        this._drag = undefined;
        this._endHover();
      }}
      @pointerleave=${(e: PointerEvent) => {
        if (!this._drag && e.pointerType === "mouse") this._endHover();
      }}
      @keydown=${(e: KeyboardEvent) => {
        this._onKey(e);
      }}
    ></canvas>`;
  }

  static override styles = css`
    :host {
      display: block;
      position: relative;
    }
    canvas {
      display: block;
      width: 100%;
      height: ${HEIGHT}px;
      touch-action: pan-y;
      cursor: pointer;
      border-bottom: 1px solid var(--rv-rule-strong);
    }
    canvas:focus-visible {
      outline: 2px solid var(--rv-action);
      outline-offset: 2px;
    }
  `;
}

/** Pointer capture keeps a drag going outside the canvas (not in every engine). */
function capture(canvas: HTMLCanvasElement | null, pointerId: number, on: boolean): void {
  try {
    if (on) canvas?.setPointerCapture(pointerId);
    else canvas?.releasePointerCapture(pointerId);
  } catch {
    // No capture (old engines, tests): the drag still works inside the canvas.
  }
}

if (!customElements.get("rv-timeline")) {
  customElements.define("rv-timeline", RvTimeline);
}

declare global {
  interface HTMLElementTagNameMap {
    "rv-timeline": RvTimeline;
  }
}

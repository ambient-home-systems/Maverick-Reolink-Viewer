import { LitElement, css, html, type TemplateResult } from "lit";

import type { TimelineDay, TimelineEvent } from "../types";
import { formatClock, offsetAt } from "./time";
import {
  MINUTE,
  ZOOM_LEVELS,
  bars,
  clampView,
  stepZoom,
  tickStep,
  ticks,
  timeToX,
  xToTime,
  zoomAt,
  type View,
} from "./timeline-math";

/** Wait this long without movement before asking for a hover thumbnail. */
export const HOVER_DEBOUNCE_MS = 150;
/** Movement below this many pixels between press and release is a click. */
const CLICK_SLOP_PX = 4;
/** Fingers closer than this (across) pan without zooming: their distance says too little. */
const PINCH_MIN_PX = 24;
/** A trackpad pinch (ctrl+wheel): how much one unit of wheel zooms. */
const PINCH_WHEEL = 0.01;
const HEIGHT = 76;
const TICK_ROW = 18;
const BAR_TOP = 22;
const BAR_HEIGHT = 26;
const EVENT_TOP = 52;
const EVENT_HEIGHT = 16;
/** The keyboard's steps: about a 48th of the visible span, in round units. */
const KEY_STEPS = [10_000, 30_000, MINUTE, 5 * MINUTE, 10 * MINUTE, 15 * MINUTE, 30 * MINUTE, 60 * MINUTE];
/** After the arrow keys rest this long, the recording plays from where they left the time. */
export const KEY_SEEK_MS = 500;

/** How far one arrow key moves the time, for a visible span. */
export function keyStep(span: number): number {
  return KEY_STEPS.find((step) => step >= span / 48) ?? 60 * MINUTE;
}

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
 * Wheel zooms around the pointer (shift+wheel or a horizontal wheel pans; a
 * trackpad pinch zooms smoothly); press and drag scrubs; a click seeks. On a
 * touch screen one finger scrubs and a tap seeks, as with a mouse, and two
 * fingers pinch to zoom and slide to pan, the time under them staying under
 * them. Events: `rv-view-change`, `rv-seek`, `rv-scrub`, `rv-hover`,
 * `rv-hover-end`.
 *
 * With the keyboard it is a slider of the time: the arrow keys move it (Page
 * Up and Page Down further, Home and End to the start and end of the day), as
 * a drag scrubs, and the recording plays from there once they rest, or at
 * once with Enter or Space; + and - zoom. The view follows the time.
 */
export class RvTimeline extends LitElement {
  static override properties = {
    day: { attribute: false },
    events: { attribute: false },
    view: { attribute: false },
    cursor: { attribute: false },
    timeZone: { attribute: false },
    _keyTime: { state: true },
  };

  declare day: TimelineDay | undefined;
  /** The events to draw (already filtered). */
  declare events: TimelineEvent[];
  declare view: View;
  declare cursor: number | undefined;
  declare timeZone: string | undefined;

  private _width = 0;
  /** The width the ResizeObserver last reported (0: none yet). */
  private _observed = 0;
  private _resize: ResizeObserver | undefined;
  /** One pointer pressed: where, whether it moved, and the time it scrubbed to. */
  private _drag: { pointerId: number; x: number; moved: boolean; time?: number } | undefined;
  /** The pointers down on the canvas, and their x. */
  private readonly _pointers = new Map<number, number>();
  /** Two fingers: the span and their distance when they landed, and the time between them. */
  private _pinch: { span: number; dist: number; anchor: number } | undefined;
  /** Fingers pinched: no scrub or seek until the last one is up. */
  private _pinched = false;
  private _hoverTimer: ReturnType<typeof setTimeout> | undefined;
  /** The time the arrow keys moved to (said at once), and the seek once they rest. */
  declare _keyTime: number | undefined;
  private _keySeek: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    super();
    this.events = [];
    this.view = { start: 0, span: ZOOM_LEVELS[0] ?? 86_400_000 };
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (typeof ResizeObserver !== "undefined") {
      this._resize = new ResizeObserver((entries) => {
        // The width each draw uses: read here, not with a layout per draw.
        const width = entries.at(-1)?.contentRect.width;
        this._observed = width ? Math.max(1, Math.round(width)) : 0;
        this._draw();
      });
      this._resize.observe(this);
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._resize?.disconnect();
    clearTimeout(this._hoverTimer);
    clearTimeout(this._keySeek);
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
    // Shown at once (the next gesture event builds on it); the owner's view follows.
    this.view = next;
    this._emit("rv-view-change", { view: next });
  }

  /** Zoom one level in (+1) or out (-1) around a time (default: the cursor). */
  zoom(direction: 1 | -1, anchor?: number): void {
    const span = stepZoom(this.view.span, direction);
    if (span === undefined) return;
    const at = anchor ?? this.cursor ?? this.view.start + this.view.span / 2;
    this._setView(zoomAt(this.view, span, at, this._bounds));
  }

  /** A span between the narrowest zoom level and the whole day. */
  private _span(span: number): number {
    const narrowest = ZOOM_LEVELS[ZOOM_LEVELS.length - 1] ?? MINUTE;
    const { start, end } = this._bounds;
    return Math.min(Math.max(span, narrowest), Math.max(end - start, narrowest));
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
    if (event.ctrlKey) {
      // A trackpad pinch: zoom by how far it went, around the pointer.
      const span = this._span(this.view.span * Math.exp(event.deltaY * PINCH_WHEEL));
      this._setView(zoomAt(this.view, span, this.timeAt(this._x(event)), this._bounds));
      return;
    }
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
    if (event.isPrimary) {
      // A new gesture: forget fingers whose lift the browser never told of.
      this._pointers.clear();
      this._pinch = undefined;
      this._pinched = false;
    }
    const x = this._x(event);
    this._pointers.set(event.pointerId, x);
    capture(this._canvas, event.pointerId, true);
    if (this._pointers.size === 2) {
      this._startPinch();
      return;
    }
    if (this._pinched || this._pointers.size > 2) return;
    this._drag = { pointerId: event.pointerId, x, moved: false };
  }

  /**
   * Two fingers on the timeline are its pinch, not the page's: the browser may
   * not take them for a scroll or a zoom. On the iPhone, `touch-action: pan-y`
   * lets two fingers spreading count as a page scroll, which cancelled the pinch
   * after its first step (the owner's iPhone, 2026-10-28). `gesturestart` is
   * WebKit's page zoom.
   */
  private readonly _twoFingers = {
    handleEvent: (event: Event): void => {
      const touches = "targetTouches" in event ? (event as TouchEvent).targetTouches.length : 2;
      if (touches >= 2 && event.cancelable) event.preventDefault();
    },
    passive: false,
  };

  /** A second finger: a scrub under way ends where it is, and the pinch begins. */
  private _startPinch(): void {
    const drag = this._drag;
    if (drag?.moved && drag.time !== undefined) this._emit("rv-seek", { time: drag.time } satisfies TimeDetail);
    this._drag = undefined;
    this._pinched = true;
    this._endHover();
    const [a = 0, b = 0] = this._pointers.values();
    this._pinch = { span: this.view.span, dist: Math.abs(a - b), anchor: this.timeAt((a + b) / 2) };
  }

  /** Two fingers moved: the time that was between them stays between them. */
  private _movePinch(): void {
    const pinch = this._pinch;
    const points = [...this._pointers.values()];
    if (!pinch || points.length < 2) return;
    const [a = 0, b = 0] = points;
    const dist = Math.abs(a - b);
    const span =
      pinch.dist >= PINCH_MIN_PX && dist >= PINCH_MIN_PX ? this._span((pinch.span * pinch.dist) / dist) : this.view.span;
    const mid = (a + b) / 2;
    this._setView({ start: pinch.anchor - (mid / (this._width || 1)) * span, span });
  }

  private _onPointerMove(event: PointerEvent): void {
    const x = this._x(event);
    if (this._pointers.has(event.pointerId)) this._pointers.set(event.pointerId, x);
    if (this._pinch) {
      this._movePinch();
      return;
    }
    const drag = this._drag;
    if (drag && drag.pointerId === event.pointerId) {
      if (Math.abs(x - drag.x) > CLICK_SLOP_PX) drag.moved = true;
      if (drag.moved) {
        const time = this.timeAt(x);
        drag.time = time;
        this._emit("rv-scrub", { time } satisfies TimeDetail);
        this._scheduleHover(time, x);
      }
      return;
    }
    if (event.pointerType === "mouse") this._scheduleHover(this.timeAt(x), x);
  }

  private _onPointerUp(event: PointerEvent): void {
    this._pointers.delete(event.pointerId);
    capture(this._canvas, event.pointerId, false);
    if (this._pinched) {
      // The pinch ends with the first finger up; the other does nothing.
      this._pinch = undefined;
      if (!this._pointers.size) this._pinched = false;
      return;
    }
    const drag = this._drag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    this._drag = undefined;
    this._emit("rv-seek", { time: this.timeAt(this._x(event)) } satisfies TimeDetail);
    if (event.pointerType !== "mouse") this._endHover();
  }

  /** The browser took the gesture (a page scroll) or lost a pointer. */
  private _onPointerCancel(event: PointerEvent): void {
    this._pointers.delete(event.pointerId);
    this._drag = undefined;
    this._pinch = undefined;
    if (!this._pointers.size) this._pinched = false;
    this._endHover();
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
    const from = this._keyTime ?? this.cursor ?? this.view.start + this.view.span / 2;
    const step = keyStep(this.view.span);
    const { start, end } = this._bounds;
    const moves: Partial<Record<string, number>> = {
      ArrowLeft: from - step,
      ArrowDown: from - step,
      ArrowRight: from + step,
      ArrowUp: from + step,
      PageDown: from - 6 * step,
      PageUp: from + 6 * step,
      Home: start,
      // Today ends now: nothing is recorded after it.
      End: Math.min(end, this.day?.now ?? end),
    };
    const actions: Partial<Record<string, () => void>> = {
      Enter: () => {
        this._seekNow(from);
      },
      " ": () => {
        this._seekNow(from);
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
    const to = moves[event.key];
    const action = actions[event.key];
    if (to !== undefined) {
      event.preventDefault();
      this._keyTo(Math.min(Math.max(to, start), end));
    } else if (action) {
      event.preventDefault();
      action();
    }
  }

  /** Move the time as a drag does, keep it in view, and play from it once the keys rest. */
  private _keyTo(time: number): void {
    this._keyTime = time;
    const { start, span } = this.view;
    const margin = span * 0.1;
    if (time < start + margin || time > start + span - margin) {
      this._setView({ start: time - span / 2, span });
    }
    this._emit("rv-scrub", { time } satisfies TimeDetail);
    clearTimeout(this._keySeek);
    this._keySeek = setTimeout(() => {
      this._seekNow(time);
    }, KEY_SEEK_MS);
  }

  private _seekNow(time: number): void {
    clearTimeout(this._keySeek);
    this._keyTime = undefined;
    this._emit("rv-seek", { time } satisfies TimeDetail);
  }

  private _draw(): void {
    const canvas = this._canvas;
    if (!canvas) return;
    // From the ResizeObserver; measured (a forced layout) only until it reports.
    const width =
      this._observed || Math.max(1, Math.round(this.getBoundingClientRect().width || canvas.clientWidth || 300));
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
      aria-describedby="keys"
      aria-valuemin=${this.day?.start ?? 0}
      aria-valuemax=${this.day?.end ?? 0}
      aria-valuenow=${this.cursor ?? 0}
      aria-valuetext=${this._valueText()}
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
      @pointercancel=${(e: PointerEvent) => {
        this._onPointerCancel(e);
      }}
      @pointerleave=${(e: PointerEvent) => {
        if (!this._drag && e.pointerType === "mouse") this._endHover();
      }}
      @touchstart=${this._twoFingers}
      @touchmove=${this._twoFingers}
      @gesturestart=${this._twoFingers}
      @keydown=${(e: KeyboardEvent) => {
        this._onKey(e);
      }}
      @blur=${() => {
        this._keyTime = undefined;
      }}
    ></canvas>
    <span id="keys" class="hidden">
      Arrow keys move the time, Page Up and Page Down further, Home and End to the start and end of the
      day. It plays from there; Enter plays at once. Plus and minus zoom.
    </span>`;
  }

  /** The time, and whether anything was recorded then, for a screen reader. */
  private _valueText(): string {
    const time = this._keyTime ?? this.cursor;
    if (time === undefined) return "no time chosen";
    const recorded = this.day?.segments.some((s) => s.start <= time && time < s.end) ?? false;
    // To the second while the keys move it; while it plays, to the minute (said less often).
    const clock = formatClock(time, this.timeZone, this._keyTime !== undefined);
    return `${clock}, ${recorded ? "recorded" : "nothing recorded"}`;
  }

  static override styles = css`
    :host {
      display: block;
      position: relative;
    }
    /* For screen readers only. */
    .hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
    canvas {
      display: block;
      width: 100%;
      height: ${HEIGHT}px;
      /* One finger scrolls the page up and down; the rest is the timeline's. */
      touch-action: pan-y;
      cursor: pointer;
      border-bottom: 1px solid var(--rv-rule-strong);
      user-select: none;
      -webkit-user-select: none;
      -webkit-touch-callout: none;
      -webkit-tap-highlight-color: transparent;
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

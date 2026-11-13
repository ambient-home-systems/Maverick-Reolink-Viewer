// Zooming into the picture (Phase 11 step 1): on the playing recording and in
// live full screen. A transform only, on a layer holding the picture, so the
// layout and the decoding are untouched. Home Assistant's viewport turns the
// browser's own pinch off (user-scalable=no), so this is ours:
//
// - touch: pinch, a two-finger pan, a one-finger pan while zoomed, and a
//   double tap (in at the tap, or back out);
// - desktop: a trackpad pinch (a wheel with Ctrl; Safari's gesture events),
//   Ctrl or ⌘ with a mouse's wheel, and while zoomed a scroll or a drag pans.
//   Unzoomed, a scroll stays the page's;
// - keyboard, while focus is on the picture: + − 0.
//
// The pan is clamped to the picture, not its letterbox: the picture (shown
// with object-fit: contain) covers the box wherever it is larger than it, and
// stays centred where it is not.

import { css, type ReactiveController, type ReactiveControllerHost } from "lit";

export interface Zoom {
  scale: number;
  /** The layer's translation (px), with its origin at the box's top left. */
  x: number;
  y: number;
}

export interface Size {
  w: number;
  h: number;
}

export const ZOOM_MAX = 8;
/** One step of the keys and of a mouse wheel's notch. */
export const ZOOM_STEP = 1.25;
/** A double tap zooms in this far. */
export const ZOOM_TAP = 2.5;
/**
 * The zoom's transform, on the surface for what is drawn over the zoomed layer
 * rather than in it: "none" unzoomed. It inherits through a slot.
 */
export const ZOOM_VAR = "--rv-zoom-transform";
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_PX = 30;

export const NO_ZOOM: Zoom = { scale: 1, x: 0, y: 0 };

/** Where the picture sits in the box, unzoomed (object-fit: contain). */
export function pictureRect(box: Size, content: Size | undefined): { x: number; y: number; w: number; h: number } {
  if (!content || content.w <= 0 || content.h <= 0 || box.w <= 0 || box.h <= 0) {
    return { x: 0, y: 0, w: box.w, h: box.h };
  }
  const ratio = Math.min(box.w / content.w, box.h / content.h);
  const w = content.w * ratio;
  const h = content.h * ratio;
  return { x: (box.w - w) / 2, y: (box.h - h) / 2, w, h };
}

function clampAxis(t: number, scale: number, start: number, length: number, boxLength: number): number {
  const shown = length * scale;
  // Smaller than the box: centred.
  if (shown <= boxLength) return (boxLength - shown) / 2 - start * scale;
  // Larger: it covers the box, its edges no further in than the box's.
  const most = -start * scale;
  const least = boxLength - (start + length) * scale;
  return Math.min(most, Math.max(least, t));
}

/** The zoom kept within 1 and ZOOM_MAX, and the picture over its box. */
export function clampZoom(zoom: Zoom, box: Size, content: Size | undefined): Zoom {
  const scale = Math.min(ZOOM_MAX, Math.max(1, zoom.scale));
  if (scale <= 1.0001) return NO_ZOOM;
  const rect = pictureRect(box, content);
  // (|| 0: no −0 at an edge.)
  return {
    scale,
    x: clampAxis(zoom.x, scale, rect.x, rect.w, box.w) || 0,
    y: clampAxis(zoom.y, scale, rect.y, rect.h, box.h) || 0,
  };
}

/** Zoom to `scale` keeping the box's point (fx, fy) where it is. */
export function zoomAt(zoom: Zoom, scale: number, fx: number, fy: number, box: Size, content: Size | undefined): Zoom {
  const next = Math.min(ZOOM_MAX, Math.max(1, scale));
  const cx = (fx - zoom.x) / zoom.scale;
  const cy = (fy - zoom.y) / zoom.scale;
  return clampZoom({ scale: next, x: fx - cx * next, y: fy - cy * next }, box, content);
}

/** The transform for a layer, its origin at the top left. */
export function zoomTransform(zoom: Zoom): string {
  return zoom.scale === 1
    ? ""
    : `translate(${zoom.x.toFixed(2)}px, ${zoom.y.toFixed(2)}px) scale(${zoom.scale.toFixed(4)})`;
}

export interface ZoomOptions {
  /** Whether zooming is on now (a recording playing; live in full screen). */
  enabled: () => boolean;
  /** The picture's own size (the video's), for the clamp. */
  content: () => Size | undefined;
  /** The box's size; its bounding rectangle by default (tests give their own). */
  box?: (surface: HTMLElement) => Size;
  /** Called after a reset (the host puts the keyboard back where it was). */
  onReset?: () => void;
}

/**
 * Zoom on a host: `bind` the surface that takes the gestures (the picture's
 * box) and the layer that moves; the host renders `pill()` and reads `zoomed`.
 * The layer's transform is set directly as the gestures move; the host
 * updates only when the zoom changes.
 */
export class ZoomController implements ReactiveController {
  zoom: Zoom = NO_ZOOM;
  private _surface: HTMLElement | undefined;
  private _layer: HTMLElement | undefined;
  private _resize: ResizeObserver | undefined;
  private readonly _pointers = new Map<number, { x: number; y: number }>();
  private _pinch: { distance: number; zoom: Zoom; mid: { x: number; y: number } } | undefined;
  private _pan: { x: number; y: number; zoom: Zoom } | undefined;
  private _lastTap: { at: number; x: number; y: number } | undefined;
  private _moved = false;
  /** The scale when Safari's pinch began. */
  private _gestureFrom: number | undefined;

  constructor(
    private readonly _host: ReactiveControllerHost,
    private readonly _options: ZoomOptions,
  ) {
    _host.addController(this);
  }

  get zoomed(): boolean {
    return this.zoom.scale > 1;
  }

  hostDisconnected(): void {
    this.unbind();
  }

  /** Take the gestures on `surface` and move `layer` (again after a render that replaced them). */
  bind(surface: HTMLElement | null, layer: HTMLElement | null): void {
    if (layer !== this._layer) {
      this._layer = layer ?? undefined;
      this._apply();
    }
    if (surface === this._surface) return;
    this.unbind();
    if (!surface) return;
    this._surface = surface;
    this._apply();
    surface.addEventListener("pointerdown", this._onDown);
    surface.addEventListener("pointermove", this._onMove);
    surface.addEventListener("pointerup", this._onUp);
    surface.addEventListener("pointercancel", this._onUp);
    surface.addEventListener("wheel", this._onWheel, { passive: false });
    surface.addEventListener("gesturestart", this._onGestureStart);
    surface.addEventListener("gesturechange", this._onGestureChange);
    surface.addEventListener("gestureend", this._onGestureEnd);
    surface.addEventListener("keydown", this._onKey);
    if (typeof ResizeObserver === "function") {
      this._resize = new ResizeObserver(() => {
        this._set(this.zoom);
      });
      this._resize.observe(surface);
    }
  }

  unbind(): void {
    const surface = this._surface;
    if (!surface) return;
    surface.removeEventListener("pointerdown", this._onDown);
    surface.removeEventListener("pointermove", this._onMove);
    surface.removeEventListener("pointerup", this._onUp);
    surface.removeEventListener("pointercancel", this._onUp);
    surface.removeEventListener("wheel", this._onWheel);
    surface.removeEventListener("gesturestart", this._onGestureStart);
    surface.removeEventListener("gesturechange", this._onGestureChange);
    surface.removeEventListener("gestureend", this._onGestureEnd);
    surface.removeEventListener("keydown", this._onKey);
    surface.style.removeProperty(ZOOM_VAR);
    this._resize?.disconnect();
    this._resize = undefined;
    this._surface = undefined;
    this._pointers.clear();
    this._pinch = undefined;
    this._pan = undefined;
    this._gestureFrom = undefined;
  }

  reset(): void {
    const was = this.zoomed;
    this._set(NO_ZOOM);
    if (was) this._options.onReset?.();
  }

  /** Zoom by `factor` about the box's centre (the keys). */
  step(factor: number): void {
    const box = this._box();
    if (!box) return;
    this._set(zoomAt(this.zoom, this.zoom.scale * factor, box.w / 2, box.h / 2, box, this._options.content()));
  }

  private _box(): Size | undefined {
    const surface = this._surface;
    if (!surface) return undefined;
    if (this._options.box) return this._options.box(surface);
    const rect = surface.getBoundingClientRect();
    return { w: rect.width, h: rect.height };
  }

  /** A point of the event in the box's coordinates. */
  private _point(e: { clientX: number; clientY: number }): {
    x: number;
    y: number;
  } {
    const rect = this._surface?.getBoundingClientRect();
    return {
      x: e.clientX - (rect?.left ?? 0),
      y: e.clientY - (rect?.top ?? 0),
    };
  }

  private _set(zoom: Zoom): void {
    const box = this._box();
    const next = box ? clampZoom(zoom, box, this._options.content()) : zoom;
    const changed = next.scale !== this.zoom.scale || next.x !== this.zoom.x || next.y !== this.zoom.y;
    this.zoom = next;
    this._apply();
    // The host shows the level (and hides what a zoom covers): it updates when the zoom changes.
    if (changed) this._host.requestUpdate();
  }

  private _apply(): void {
    const transform = zoomTransform(this.zoom);
    const layer = this._layer;
    if (layer) {
      layer.style.transformOrigin = "0 0";
      layer.style.transform = transform;
    }
    // For a picture drawn over the layer, not in it (a drag's, whose time stays its size).
    this._surface?.style.setProperty(ZOOM_VAR, transform || "none");
  }

  private readonly _onDown = (e: PointerEvent): void => {
    if (!this._options.enabled()) return;
    this._pointers.set(e.pointerId, this._point(e));
    this._moved = false;
    if (this._pointers.size === 2) {
      const [a, b] = [...this._pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
      this._pinch = {
        distance: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        zoom: this.zoom,
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      };
      this._pan = undefined;
      e.preventDefault();
    } else if (this._pointers.size === 1 && this.zoomed) {
      const p = this._point(e);
      this._pan = { x: p.x, y: p.y, zoom: this.zoom };
      if (e.pointerType !== "touch") e.preventDefault();
    }
    // Only a gesture of ours keeps the pointer: unzoomed, a tap or a drag stays
    // the video's own (its controls).
    if (this._pinch || this._pan) {
      try {
        this._surface?.setPointerCapture(e.pointerId);
      } catch {
        // Not capturable (the pointer gone): the surface still sees it.
      }
    }
  };

  private readonly _onMove = (e: PointerEvent): void => {
    if (!this._pointers.has(e.pointerId)) return;
    const p = this._point(e);
    this._pointers.set(e.pointerId, p);
    const box = this._box();
    if (!box) return;
    const content = this._options.content();
    if (this._pinch && this._pointers.size >= 2) {
      const [a, b] = [...this._pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const distance = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const start = this._pinch.zoom;
      const scale = Math.min(ZOOM_MAX, Math.max(1, (start.scale * distance) / this._pinch.distance));
      // The picture's point under the fingers' first midpoint stays under their midpoint.
      const cx = (this._pinch.mid.x - start.x) / start.scale;
      const cy = (this._pinch.mid.y - start.y) / start.scale;
      this._moved = true;
      this._set(clampZoom({ scale, x: mid.x - cx * scale, y: mid.y - cy * scale }, box, content));
      e.preventDefault();
    } else if (this._pan) {
      const dx = p.x - this._pan.x;
      const dy = p.y - this._pan.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) this._moved = true;
      this._set({
        ...this._pan.zoom,
        x: this._pan.zoom.x + dx,
        y: this._pan.zoom.y + dy,
      });
      e.preventDefault();
    }
  };

  private readonly _onUp = (e: PointerEvent): void => {
    if (!this._pointers.has(e.pointerId)) return;
    const p = this._point(e);
    const pinched = this._pinch !== undefined;
    this._pointers.delete(e.pointerId);
    if (this._pointers.size < 2) this._pinch = undefined;
    if (this._pointers.size === 0) this._pan = undefined;
    // A pinch's last finger may pan on: from where it is now.
    if (this._pointers.size === 1 && pinched && this.zoomed) {
      const [rest] = [...this._pointers.values()] as [{ x: number; y: number }];
      this._pan = { x: rest.x, y: rest.y, zoom: this.zoom };
    }
    if (e.type !== "pointerup" || e.pointerType !== "touch" || pinched || this._moved) {
      if (pinched || this._moved) this._lastTap = undefined;
      return;
    }
    // A double tap: in at the tap, or back out.
    const last = this._lastTap;
    if (last && e.timeStamp - last.at < DOUBLE_TAP_MS && Math.hypot(p.x - last.x, p.y - last.y) < DOUBLE_TAP_PX) {
      this._lastTap = undefined;
      const box = this._box();
      if (!box) return;
      if (this.zoomed) this.reset();
      else this._set(zoomAt(this.zoom, ZOOM_TAP, p.x, p.y, box, this._options.content()));
      e.preventDefault();
      return;
    }
    this._lastTap = { at: e.timeStamp, x: p.x, y: p.y };
  };

  private readonly _onWheel = (e: WheelEvent): void => {
    if (!this._options.enabled()) return;
    const box = this._box();
    if (!box) return;
    if (e.ctrlKey || e.metaKey) {
      // A trackpad's pinch (Chrome, Edge and Firefox send it so), or Ctrl or ⌘ with a
      // mouse's wheel. Safari's pinch is its gesture events, below: not twice.
      e.preventDefault();
      if (this._gestureFrom !== undefined) return;
      const p = this._point(e);
      this._set(zoomAt(this.zoom, this.zoom.scale * wheelFactor(e), p.x, p.y, box, this._options.content()));
    } else if (this.zoomed) {
      // A trackpad's scroll, or a wheel, pans the zoomed picture.
      this._set({
        ...this.zoom,
        x: this.zoom.x - e.deltaX,
        y: this.zoom.y - e.deltaY,
      });
      e.preventDefault();
    }
    // Unzoomed, a scroll is the page's: the picture is often part of a longer page,
    // and a trackpad's quick scroll looks like a mouse's notch.
  };

  /** Safari's pinch on a Mac's trackpad (not on a phone: its fingers are pointers, above). */
  private readonly _onGestureStart = (e: Event): void => {
    if (!this._options.enabled() || this._pointers.size > 0) return;
    this._gestureFrom = this.zoom.scale;
    e.preventDefault();
  };

  private readonly _onGestureChange = (e: Event): void => {
    const from = this._gestureFrom;
    if (from === undefined) return;
    e.preventDefault();
    const g = e as Event & { scale?: number; clientX?: number; clientY?: number };
    const box = this._box();
    if (!box || typeof g.scale !== "number") return;
    const p = this._point({ clientX: g.clientX ?? 0, clientY: g.clientY ?? 0 });
    this._set(zoomAt(this.zoom, from * g.scale, p.x, p.y, box, this._options.content()));
  };

  private readonly _onGestureEnd = (e: Event): void => {
    if (this._gestureFrom === undefined) return;
    this._gestureFrom = undefined;
    e.preventDefault();
  };

  private readonly _onKey = (e: KeyboardEvent): void => {
    if (!this._options.enabled() || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "+" || e.key === "=") this.step(ZOOM_STEP);
    else if (e.key === "-" || e.key === "_") this.step(1 / ZOOM_STEP);
    else if (e.key === "0" && this.zoomed) this.reset();
    else return;
    e.preventDefault();
    e.stopPropagation();
  };
}

/** The zoom's pill: its level, and a reset (each host places it). */
export const zoomStyles = css`
  .zoom-pill {
    position: absolute;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 3;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 4px 4px 4px 12px;
    border-radius: 999px;
    background: rgba(17, 20, 24, 0.82);
    color: #fff;
    font-family: var(--rv-font, sans-serif);
    font-size: 13px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .zoom-pill button {
    min-height: 28px;
    padding: 0 10px;
    border: 0;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.16);
    color: #fff;
    font: inherit;
    cursor: pointer;
  }
  .zoom-pill button:focus-visible {
    outline: 2px solid #fff;
    outline-offset: 1px;
  }
`;

/** The most one wheel event moves the zoom (in px of delta): one step, a mouse's notch with Ctrl. */
const WHEEL_MAX_DELTA = Math.log(ZOOM_STEP) * 100;

/**
 * How far a wheel with Ctrl zooms: a trackpad's pinch (small deltas, many
 * events) in proportion; a mouse's notch (100 px, or lines in Firefox) one step.
 */
export function wheelFactor(e: Pick<WheelEvent, "deltaY" | "deltaMode">): number {
  if (e.deltaMode !== 0) return e.deltaY < 0 ? ZOOM_STEP : e.deltaY > 0 ? 1 / ZOOM_STEP : 1;
  const delta = Math.max(-WHEEL_MAX_DELTA, Math.min(WHEEL_MAX_DELTA, e.deltaY));
  return Math.exp(-delta / 100);
}

/** The pill's text: the level, one decimal. */
export function zoomLabel(zoom: Zoom): string {
  return `${zoom.scale.toFixed(1)}×`;
}

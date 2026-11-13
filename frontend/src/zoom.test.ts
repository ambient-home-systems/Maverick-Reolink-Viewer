import { describe, expect, it, vi } from "vitest";

import {
  NO_ZOOM,
  ZOOM_MAX,
  ZOOM_STEP,
  ZOOM_VAR,
  ZoomController,
  clampZoom,
  pictureRect,
  wheelFactor,
  zoomAt,
  zoomLabel,
  zoomTransform,
  type Zoom,
} from "./zoom";

// A 4:3 picture (640×480) in a 16:9 box (400×225): letterboxed, 300 px wide from x 50.
const BOX = { w: 400, h: 225 };
const PICTURE = { w: 640, h: 480 };

describe("zooming into the picture: the arithmetic", () => {
  it("finds the picture in its box, as object-fit: contain shows it", () => {
    expect(pictureRect(BOX, PICTURE)).toEqual({ x: 50, y: 0, w: 300, h: 225 });
    // Its size not known yet: the whole box.
    expect(pictureRect(BOX, undefined)).toEqual({ x: 0, y: 0, w: 400, h: 225 });
  });

  it("keeps the picture over the box, never its letterbox", () => {
    // At 2×: 600×450, from x 100. It covers the box: x within [400 − 700, −100], y within [−225, 0].
    expect(clampZoom({ scale: 2, x: 0, y: 50 }, BOX, PICTURE)).toEqual({ scale: 2, x: -100, y: 0 });
    expect(clampZoom({ scale: 2, x: -999, y: -999 }, BOX, PICTURE)).toEqual({ scale: 2, x: -300, y: -225 });
    // At 1.2× the picture (360 px) is narrower than the box: centred across, clamped down.
    const z = clampZoom({ scale: 1.2, x: 30, y: -10 }, BOX, PICTURE);
    expect(z.x).toBeCloseTo((400 - 360) / 2 - 50 * 1.2);
    expect(z.y).toBe(-10);
    // Within 1 and ZOOM_MAX; at 1, no transform at all.
    expect(clampZoom({ scale: 0.5, x: 10, y: 10 }, BOX, PICTURE)).toEqual(NO_ZOOM);
    expect(clampZoom({ scale: 40, x: 0, y: 0 }, BOX, PICTURE).scale).toBe(ZOOM_MAX);
    expect(zoomTransform(NO_ZOOM)).toBe("");
    expect(zoomTransform({ scale: 2, x: -100, y: 0 })).toBe("translate(-100.00px, 0.00px) scale(2.0000)");
    expect(zoomLabel({ scale: 2.46, x: 0, y: 0 })).toBe("2.5×");
  });

  it("zooms about a point, which stays where it is", () => {
    // In 2× at the box's point (250, 100): the picture's point there stays under it.
    const z = zoomAt(NO_ZOOM, 2, 250, 100, BOX, PICTURE);
    expect(z.scale).toBe(2);
    expect((250 - z.x) / z.scale).toBeCloseTo(250);
    expect((100 - z.y) / z.scale).toBeCloseTo(100);
  });
});

function host() {
  return { addController: vi.fn(), removeController: vi.fn(), requestUpdate: vi.fn(), updateComplete: Promise.resolve(true) };
}

function setUp(enabled = true) {
  const h = host();
  const onReset = vi.fn();
  const zoom = new ZoomController(h, { enabled: () => enabled, content: () => PICTURE, box: () => BOX, onReset });
  const surface = document.createElement("div");
  const layer = document.createElement("div");
  surface.append(layer);
  document.body.append(surface);
  zoom.bind(surface, layer);
  const pointer = (type: string, id: number, x: number, y: number, kind = "touch") => {
    const e = new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, pointerType: kind, bubbles: true, cancelable: true });
    surface.dispatchEvent(e);
    return e;
  };
  return { h, zoom, surface, layer, pointer, onReset };
}

describe("zooming into the picture: the gestures", () => {
  it("pinches in about the fingers, then pans with one, and the layer follows", () => {
    const { h, zoom, surface, layer, pointer } = setUp();
    expect(surface.style.getPropertyValue(ZOOM_VAR)).toBe("none");
    pointer("pointerdown", 1, 150, 112);
    pointer("pointerdown", 2, 250, 112);
    // Fingers twice as far apart: 2×.
    expect(pointer("pointermove", 2, 350, 112).defaultPrevented).toBe(true);
    expect(zoom.zoom.scale).toBeCloseTo(2);
    expect(zoom.zoomed).toBe(true);
    expect(layer.style.transform).toContain("scale(2.0000)");
    // The same, for what is drawn over the layer (a drag's picture).
    expect(surface.style.getPropertyValue(ZOOM_VAR)).toBe(layer.style.transform);
    expect(h.requestUpdate).toHaveBeenCalled();
    // Lift one: the other pans on.
    pointer("pointerup", 2, 350, 112);
    const before: Zoom = { ...zoom.zoom };
    pointer("pointermove", 1, 100, 112);
    expect(zoom.zoom.x).toBeLessThan(before.x);
    pointer("pointerup", 1, 100, 112);
    // Let go of the surface: nothing of the zoom stays on it.
    zoom.unbind();
    expect(surface.style.getPropertyValue(ZOOM_VAR)).toBe("");
  });

  it("zooms in at a double tap, and back out at the next", () => {
    const { zoom, pointer, onReset } = setUp();
    const tap = (times: number, kind = "touch") => {
      for (let i = 0; i < times; i += 1) {
        pointer("pointerdown", 1, 250, 100, kind);
        pointer("pointerup", 1, 250, 100, kind);
      }
    };
    tap(2);
    expect(zoom.zoom.scale).toBeCloseTo(2.5);
    tap(2);
    expect(zoom.zoomed).toBe(false);
    expect(onReset).toHaveBeenCalledTimes(1);
    // A mouse's double click is the video's own (its full screen), not a zoom.
    tap(2, "mouse");
    expect(zoom.zoomed).toBe(false);
  });

  it("zooms with a trackpad's pinch or Ctrl and a mouse's wheel, pans with a scroll once zoomed, and leaves the page's scroll alone", () => {
    const { zoom, surface } = setUp();
    const wheel = (init: WheelEventInit) => {
      const e = new WheelEvent("wheel", { clientX: 200, clientY: 112, bubbles: true, cancelable: true, ...init });
      // (happy-dom's WheelEvent drops the modifier keys of its init.)
      Object.defineProperty(e, "ctrlKey", { value: init.ctrlKey === true });
      surface.dispatchEvent(e);
      return e;
    };
    // A scroll on the unzoomed picture, a trackpad's quick one or a mouse's notch: the page's.
    expect(wheel({ deltaY: 6, deltaX: 1 }).defaultPrevented).toBe(false);
    expect(wheel({ deltaY: -120 }).defaultPrevented).toBe(false);
    expect(wheel({ deltaY: 3, deltaMode: 1 }).defaultPrevented).toBe(false);
    expect(zoom.zoomed).toBe(false);
    // A pinch (a wheel with Ctrl), in proportion.
    expect(wheel({ deltaY: -10, ctrlKey: true }).defaultPrevented).toBe(true);
    expect(zoom.zoom.scale).toBeCloseTo(Math.exp(0.1));
    // Zoomed, a scroll pans (down: at 1.1× the picture is taller than the box, not wider).
    const y = zoom.zoom.y;
    expect(wheel({ deltaX: 0, deltaY: 20 }).defaultPrevented).toBe(true);
    expect(zoom.zoom.y).toBeLessThan(y);
    zoom.reset();
    // Ctrl and a mouse's notch: one step, in pixels or in lines (Firefox).
    wheel({ deltaY: -100, ctrlKey: true });
    expect(zoom.zoom.scale).toBeCloseTo(ZOOM_STEP);
    wheel({ deltaY: -3, deltaMode: 1, ctrlKey: true });
    expect(zoom.zoom.scale).toBeCloseTo(ZOOM_STEP * ZOOM_STEP);
    expect(wheelFactor({ deltaY: 100, deltaMode: 0 })).toBeCloseTo(1 / ZOOM_STEP);
    expect(wheelFactor({ deltaY: 0, deltaMode: 1 })).toBe(1);
  });

  it("zooms with Safari's pinch on a trackpad, and not twice with its wheel or a phone's fingers", () => {
    const { zoom, surface, pointer } = setUp();
    const gesture = (type: string, scale: number) => {
      const e = new Event(type, { bubbles: true, cancelable: true });
      Object.assign(e, { scale, clientX: 250, clientY: 100 });
      surface.dispatchEvent(e);
      return e;
    };
    expect(gesture("gesturestart", 1).defaultPrevented).toBe(true);
    expect(gesture("gesturechange", 2).defaultPrevented).toBe(true);
    expect(zoom.zoom.scale).toBeCloseTo(2);
    // The picture's point under the fingers stays there.
    expect((250 - zoom.zoom.x) / zoom.zoom.scale).toBeCloseTo(250);
    // Its wheel with Ctrl, if it sent one too, does not add to it.
    const e = new WheelEvent("wheel", { deltaY: -10, clientX: 250, clientY: 100, bubbles: true, cancelable: true });
    Object.defineProperty(e, "ctrlKey", { value: true });
    surface.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
    expect(zoom.zoom.scale).toBeCloseTo(2);
    // Relative to where it began: 3 is 3× the start.
    gesture("gesturechange", 3);
    expect(zoom.zoom.scale).toBeCloseTo(3);
    gesture("gestureend", 3);
    gesture("gesturechange", 1);
    expect(zoom.zoom.scale).toBeCloseTo(3);
    zoom.reset();
    // On an iPhone, the fingers are pointers: its gestures are left alone.
    pointer("pointerdown", 1, 150, 112);
    pointer("pointerdown", 2, 250, 112);
    expect(gesture("gesturestart", 1).defaultPrevented).toBe(false);
    gesture("gesturechange", 4);
    expect(zoom.zoom.scale).toBe(1);
  });

  it("takes + − 0 from the keyboard, and nothing while it is off", () => {
    const { zoom, surface } = setUp();
    const key = (k: string) => {
      const e = new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true });
      surface.dispatchEvent(e);
      return e;
    };
    expect(key("+").defaultPrevented).toBe(true);
    expect(zoom.zoom.scale).toBeCloseTo(1.25);
    key("=");
    key("-");
    expect(zoom.zoom.scale).toBeCloseTo(1.25);
    key("0");
    expect(zoom.zoomed).toBe(false);
    // The video's own keys pass.
    expect(key("ArrowLeft").defaultPrevented).toBe(false);

    const off = setUp(false);
    off.surface.dispatchEvent(new KeyboardEvent("keydown", { key: "+", bubbles: true }));
    off.surface.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 1, clientX: 1, clientY: 1, pointerType: "touch" }));
    off.surface.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 2, clientX: 9, clientY: 1, pointerType: "touch" }));
    off.surface.dispatchEvent(new PointerEvent("pointermove", { pointerId: 2, clientX: 90, clientY: 1, pointerType: "touch" }));
    expect(off.zoom.zoomed).toBe(false);
  });
});

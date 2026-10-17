import { afterEach, describe, expect, it, vi } from "vitest";

import type { TimelineDay, TimelineEvent } from "../types";
import "./calendar";
import "./event-list";
import { PAGE, type RvEventList } from "./event-list";
import "./player";
import type { RvPlayer } from "./player";
import "./timeline";
import { HOVER_DEBOUNCE_MS, type RvTimeline } from "./timeline";
import { DAY, HOUR, MINUTE } from "./timeline-math";

const T0 = Date.UTC(2026, 9, 17, 4, 0);

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

async function mount<K extends keyof HTMLElementTagNameMap>(tag: K): Promise<HTMLElementTagNameMap[K]> {
  const el = document.createElement(tag);
  document.body.appendChild(el);
  await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
  return el;
}

function collect(el: HTMLElement, name: string): unknown[] {
  const seen: unknown[] = [];
  el.addEventListener(name, (e) => seen.push((e as CustomEvent).detail));
  return seen;
}

describe("rv-player", () => {
  const item = (id: string) => ({ url: `/api/vod/${id}`, segmentId: id, start: T0, end: T0 + MINUTE });
  const videos = (el: RvPlayer) =>
    [...el.renderRoot.querySelectorAll("video")] as [HTMLVideoElement, HTMLVideoElement];

  it("plays, preloads the next file and swaps to it at the end", async () => {
    const el = await mount("rv-player");
    const first = collect(el, "rv-first-frame");
    const advanced = collect(el, "rv-advanced");
    await el.play(item("a"), 0, performance.now() - 100);
    const [a, b] = videos(el);
    expect(a.getAttribute("src")).toBe("/api/vod/a");
    a.dispatchEvent(new Event("playing"));
    expect(first).toHaveLength(1);
    expect((first[0] as { ms: number }).ms).toBeGreaterThanOrEqual(100);
    expect(el.paused).toBe(false);

    await el.preload(item("b"));
    expect(b.getAttribute("src")).toBe("/api/vod/b");
    expect(el.preloaded?.segmentId).toBe("b");
    // Preloading the same file again does nothing.
    await el.preload(item("b"));

    a.dispatchEvent(new Event("ended"));
    await el.updateComplete;
    expect(el.current?.segmentId).toBe("b");
    expect(b.classList.contains("active")).toBe(true);
    b.dispatchEvent(new Event("playing"));
    expect(advanced).toHaveLength(1);
    expect((advanced[0] as { segmentId: string }).segmentId).toBe("b");
  });

  it("reports the end when nothing is preloaded, time while playing, and errors", async () => {
    const el = await mount("rv-player");
    const ended = collect(el, "rv-ended");
    const times = collect(el, "rv-time");
    const errors = collect(el, "rv-player-error");
    await el.play(item("a"), 30_000);
    const [a, b] = videos(el);
    a.dispatchEvent(new Event("loadedmetadata"));
    expect(a.currentTime).toBe(30);
    a.dispatchEvent(new Event("timeupdate"));
    expect((times[0] as { time: number }).time).toBe(T0 + 30_000);
    a.dispatchEvent(new Event("ended"));
    expect(ended).toEqual([{ segmentId: "a" }]);

    // A failing preload is forgotten quietly; a failing current file is reported.
    await el.preload(item("b"));
    b.dispatchEvent(new Event("error"));
    expect(el.preloaded).toBeUndefined();
    a.dispatchEvent(new Event("error"));
    expect(errors).toHaveLength(1);

    // Playing the preloaded file swaps instead of reloading.
    await el.preload(item("c"));
    await el.play(item("c"));
    expect(el.current?.segmentId).toBe("c");

    el.seek(5000);
    el.pause();
    el.resume();
    el.stop();
    expect(el.current).toBeUndefined();
    expect(el.time).toBeUndefined();
  });
});

describe("rv-timeline", () => {
  const day: TimelineDay = {
    date: "2026-10-17",
    start: T0,
    end: T0 + DAY,
    now: T0 + 12 * HOUR,
    segments: [{ id: "1", start: T0 + HOUR, end: T0 + 2 * HOUR, triggers: [], ambiguous: false }],
    events: [],
    complete: false,
    events_error: null,
    hint_source: null,
    timing: {},
  };

  async function timeline(): Promise<RvTimeline> {
    const el = await mount("rv-timeline");
    el.style.display = "block";
    el.day = day;
    el.view = { start: T0, span: DAY };
    el.getBoundingClientRect = () => ({ width: 1000, left: 0 }) as DOMRect;
    const canvas = el.renderRoot.querySelector("canvas");
    if (canvas) canvas.getBoundingClientRect = () => ({ width: 1000, left: 0 }) as DOMRect;
    await el.updateComplete;
    return el;
  }

  // happy-dom ignores clientX/shiftKey in WheelEventInit: set them directly.
  const wheel = (init: WheelEventInit, clientX: number) => {
    const event = new WheelEvent("wheel", { ...init, bubbles: true, cancelable: true });
    Object.defineProperty(event, "clientX", { value: clientX });
    Object.defineProperty(event, "shiftKey", { value: init.shiftKey ?? false });
    return event;
  };

  const pointer = (type: string, clientX: number, init: PointerEventInit = {}) =>
    new PointerEvent(type, { clientX, button: 0, pointerId: 1, pointerType: "mouse", bubbles: true, ...init });

  it("seeks on click and scrubs on drag", async () => {
    const el = await timeline();
    const canvas = el.renderRoot.querySelector("canvas");
    const seeks = collect(el, "rv-seek");
    const scrubs = collect(el, "rv-scrub");
    canvas?.dispatchEvent(pointer("pointerdown", 500));
    canvas?.dispatchEvent(pointer("pointerup", 501));
    expect(seeks).toEqual([{ time: T0 + 12 * HOUR + 86_400 }]);
    canvas?.dispatchEvent(pointer("pointerdown", 250));
    canvas?.dispatchEvent(pointer("pointermove", 260, { buttons: 1 }));
    canvas?.dispatchEvent(pointer("pointerup", 260));
    expect(scrubs).toHaveLength(1);
    expect((seeks[1] as { time: number }).time).toBe(T0 + 260 * 86_400);
  });

  it("zooms with the wheel and keys, pans with shift", async () => {
    const el = await timeline();
    const canvas = el.renderRoot.querySelector("canvas");
    const views = collect(el, "rv-view-change") as { view: { start: number; span: number } }[];
    canvas?.dispatchEvent(wheel({ deltaY: -100 }, 500));
    expect(views[0]?.view.span).toBe(6 * HOUR);
    el.view = views[0]?.view ?? el.view;
    await el.updateComplete;
    canvas?.dispatchEvent(wheel({ deltaY: 100, shiftKey: true }, 500));
    expect(views[1]?.view.start).toBeGreaterThan(el.view.start);
    canvas?.dispatchEvent(new KeyboardEvent("keydown", { key: "-", bubbles: true }));
    expect(views.at(-1)?.view.span).toBe(DAY);
    canvas?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    canvas?.dispatchEvent(new KeyboardEvent("keydown", { key: "x", bubbles: true }));
    // At the widest level, zooming out changes nothing.
    el.view = { start: T0, span: DAY };
    const count = views.length;
    el.zoom(-1);
    expect(views).toHaveLength(count);
  });

  it("asks for a hover thumbnail after the pointer rests", async () => {
    vi.useFakeTimers();
    const el = await timeline();
    const canvas = el.renderRoot.querySelector("canvas");
    const hovers = collect(el, "rv-hover");
    const ends = collect(el, "rv-hover-end");
    canvas?.dispatchEvent(pointer("pointermove", 100));
    canvas?.dispatchEvent(pointer("pointermove", 120));
    vi.advanceTimersByTime(HOVER_DEBOUNCE_MS - 1);
    expect(hovers).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(hovers).toEqual([{ time: T0 + 120 * 86_400, x: 120 }]);
    canvas?.dispatchEvent(pointer("pointerleave", 120));
    expect(ends).toHaveLength(1);
    expect(el.timeAt(0)).toBe(T0);
  });
});

describe("rv-calendar", () => {
  it("shows recording days, picks days and moves months", async () => {
    const el = await mount("rv-calendar");
    el.year = 2026;
    el.month = 10;
    el.days = new Set([1, 17]);
    el.today = "2026-10-17";
    el.selected = "2026-10-17";
    el.firstDay = 0;
    await el.updateComplete;
    const days = [...el.renderRoot.querySelectorAll<HTMLButtonElement>("button.day")];
    expect(days).toHaveLength(31);
    expect(days.filter((d) => d.querySelector(".dot"))).toHaveLength(2);
    expect(days[17]?.disabled).toBe(true); // the 18th is in the future
    const picked = collect(el, "rv-day");
    days[0]?.click();
    expect(picked).toEqual([{ date: "2026-10-01" }]);
    const months = collect(el, "rv-month");
    el.renderRoot.querySelector<HTMLButtonElement>('[aria-label="Previous month"]')?.click();
    expect(months).toEqual([{ year: 2026, month: 9 }]);
    const next = el.renderRoot.querySelector<HTMLButtonElement>('[aria-label="Next month"]');
    expect(next?.disabled).toBe(true);
    el.loading = true;
    await el.updateComplete;
    expect(el.renderRoot.textContent).toContain("…");
  });
});

describe("rv-event-list", () => {
  const events: TimelineEvent[] = Array.from({ length: PAGE + 5 }, (_, i) => ({
    start: T0 + i * MINUTE,
    end: T0 + i * MINUTE + 20_000,
    types: i % 2 ? ["PERSON", "MOTION"] : ["ANIMAL"],
    segment: null,
    ambiguous: i === 0,
  }));

  it("lists newest first, asks for thumbnails, picks and pages", async () => {
    const el: RvEventList = await mount("rv-event-list");
    const needed = collect(el, "rv-thumbs-needed") as { times: number[] }[];
    el.events = events;
    el.thumbs = new Map([[events[PAGE + 4]?.start ?? 0, "/thumb/x"]]);
    await el.updateComplete;
    const cards = [...el.renderRoot.querySelectorAll<HTMLButtonElement>("button.card")];
    expect(cards).toHaveLength(PAGE);
    expect(cards[0]?.querySelector("img")?.getAttribute("src")).toBe("/thumb/x");
    expect(needed.at(-1)?.times).toHaveLength(PAGE - 1);
    const picks = collect(el, "rv-pick") as { event: TimelineEvent }[];
    cards[0]?.click();
    expect(picks[0]?.event.start).toBe(events[PAGE + 4]?.start);
    el.renderRoot.querySelector<HTMLButtonElement>("button.more")?.click();
    await el.updateComplete;
    expect(el.renderRoot.querySelectorAll("button.card")).toHaveLength(PAGE + 5);
    expect(el.renderRoot.textContent).toContain("time ±1 h");
    el.events = [];
    await el.updateComplete;
    expect(el.renderRoot.textContent).toContain("No events");
  });
});

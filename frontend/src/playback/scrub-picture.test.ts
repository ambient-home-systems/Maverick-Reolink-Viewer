import { afterEach, describe, expect, it } from "vitest";

import type { FrameLike } from "./keyframes";
import type { ScrubPicture } from "./scrub-client";
import type { KeyFramePainter, MsePainter } from "./scrub-paint";
import { DEFAULT_INTERVAL_MS, LATE_SLACK_MS, isLate, type RvScrubPicture } from "./scrub-picture";
import "./scrub-picture";

const T0 = Date.UTC(2026, 10, 10, 15, 0); // 10:00:00 in New York
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function picture(time: number, overrides: Partial<ScrubPicture> = {}): ScrubPicture {
  return {
    at: time,
    time,
    source: "store",
    kind: "fmp4",
    codec: "avc1",
    init: new Uint8Array([1]),
    data: new Uint8Array([2]),
    serverMs: 1,
    ms: 4,
    ...overrides,
  };
}

/** A painter the test finishes by hand: the pictures it was given, in order. */
class HeldPainter {
  available = true;
  painted: number[] = [];
  closed = false;
  private _finish: (() => void)[] = [];

  paint(p: ScrubPicture, draw: (frame: FrameLike) => void): Promise<boolean> {
    this.painted.push(p.time);
    return new Promise((resolve) =>
      this._finish.push(() => {
        draw({ displayWidth: 64, displayHeight: 36, close: () => undefined });
        resolve(true);
      }),
    );
  }

  finish(): void {
    this._finish.shift()?.();
  }

  close(): void {
    this.closed = true;
  }
}

interface Unavailable {
  available: boolean;
  close: () => void;
}

const unavailable = (): Unavailable => ({ available: false, close: () => undefined });

async function mount(codecs: HeldPainter | Unavailable, mse: Unavailable = unavailable()) {
  const el = document.createElement("rv-scrub-picture");
  el.codecs = codecs as unknown as KeyFramePainter;
  el.mse = mse as unknown as MsePainter;
  el.timeZone = "America/New_York";
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

async function settle(el: RvScrubPicture): Promise<void> {
  await flush();
  await el.updateComplete;
}

const frame = (el: RvScrubPicture) => el.renderRoot.querySelector(".frame");

afterEach(() => {
  document.body.innerHTML = "";
});

describe("rv-scrub-picture", () => {
  it("shows a picture on the canvas with its own time, and hides when it goes", async () => {
    const painter = new HeldPainter();
    const el = await mount(painter);
    expect(frame(el)?.classList.contains("on")).toBe(false);
    el.picture = picture(T0 + 4000);
    el.pointer = T0 + 4500;
    await settle(el);
    // Not shown until painted.
    expect(frame(el)?.classList.contains("on")).toBe(false);
    painter.finish();
    await settle(el);
    expect(frame(el)?.classList.contains("on")).toBe(true);
    expect(el.renderRoot.querySelector("canvas")?.classList.contains("on")).toBe(true);
    expect(el.renderRoot.querySelector(".time")?.textContent).toContain("10:00:04");
    el.picture = undefined;
    await settle(el);
    expect(frame(el)?.classList.contains("on")).toBe(false);
    expect(frame(el)?.getAttribute("aria-hidden")).toBe("true");
  });

  it("paints the newest: pictures that come while one is painted wait, and only the last is painted", async () => {
    const painter = new HeldPainter();
    const el = await mount(painter);
    el.picture = picture(T0 + 1000);
    await settle(el);
    for (const t of [2000, 3000, 4000]) {
      el.picture = picture(T0 + t);
      await settle(el);
    }
    expect(painter.painted).toEqual([T0 + 1000]);
    painter.finish();
    await settle(el);
    expect(painter.painted).toEqual([T0 + 1000, T0 + 4000]);
    painter.finish();
    await settle(el);
    expect(el._shown?.time).toBe(T0 + 4000);
  });

  it("dims a picture further from the pointer than the camera's key-frame interval", async () => {
    expect(isLate(0, DEFAULT_INTERVAL_MS + LATE_SLACK_MS, undefined)).toBe(false);
    expect(isLate(0, DEFAULT_INTERVAL_MS + LATE_SLACK_MS + 1, undefined)).toBe(true);
    expect(isLate(0, 2000, 1000)).toBe(true);
    expect(isLate(0, undefined, 1000)).toBe(false);

    const painter = new HeldPainter();
    const el = await mount(painter);
    el.picture = picture(T0, { interval: 1000 });
    el.pointer = T0 + 800;
    await settle(el);
    painter.finish();
    await settle(el);
    expect(frame(el)?.classList.contains("late")).toBe(false);
    // The pointer moves on before the next picture comes.
    el.pointer = T0 + 3000;
    await el.updateComplete;
    expect(frame(el)?.classList.contains("late")).toBe(true);
  });

  it("shows a thumbnail as an image", async () => {
    const el = await mount(new HeldPainter());
    el.picture = picture(T0, { kind: "jpeg", codec: null, data: new Uint8Array([0xff, 0xd8]) });
    await settle(el);
    const img = el.renderRoot.querySelector("img");
    expect(img?.getAttribute("src")).toMatch(/^blob:/);
    expect(el._shown?.how).toBe("jpeg");
  });

  it("plays it through MSE where the browser has no WebCodecs, and says when it can show none", async () => {
    const shown: number[] = [];
    const mse = {
      available: true,
      paint: (p: ScrubPicture, video: HTMLVideoElement) => {
        shown.push(p.time);
        expect(video.tagName).toBe("VIDEO");
        return Promise.resolve(true);
      },
      close: () => undefined,
    };
    const el = await mount(unavailable(), mse);
    expect(el.canShow).toBe(true);
    el.picture = picture(T0);
    await settle(el);
    await settle(el);
    expect(shown).toEqual([T0]);
    expect(el.renderRoot.querySelector("video")?.classList.contains("on")).toBe(true);

    const none = await mount(unavailable(), unavailable());
    expect(none.canShow).toBe(false);
  });

  it("lets its decoder go when it leaves the page", async () => {
    const painter = new HeldPainter();
    const el = await mount(painter);
    el.remove();
    expect(painter.closed).toBe(true);
  });
});

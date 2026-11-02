import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { deviceLabel } from "../live/soak-tally";
import type { HomeAssistant, TabletEvent } from "../types";
import { FLUSH_MS, FRAMES_MS, TabletLog } from "./tablet";

function fakeHass(fail = () => false) {
  const sent: { device: string; events: TabletEvent[] }[] = [];
  const hass = {
    callWS: vi.fn((message: { device: string; events: TabletEvent[] }) => {
      if (fail()) return Promise.reject(new Error("not loaded"));
      sent.push(message);
      return Promise.resolve(null);
    }),
  } as unknown as HomeAssistant;
  return { hass, sent };
}

/** Fully Kiosk's JavaScript interface, as far as the cards use it: events bound as code. */
function fakeFully() {
  const bound = new Map<string, string>();
  const fully = {
    bind: vi.fn((event: string, code: string) => {
      bound.set(event, code);
    }),
    turnScreenOn: vi.fn(),
    stopScreensaver: vi.fn(),
  };
  // Fully runs the bound code in the page.
  const fire = (event: string) => {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const code = new Function(bound.get(event) ?? "") as () => unknown;
    code();
  };
  return { fully, bound, fire };
}

const video = (frames: { n: number }) =>
  ({ getVideoPlaybackQuality: () => ({ totalVideoFrames: frames.n }) }) as unknown as HTMLVideoElement;

beforeEach(() => {
  vi.useFakeTimers({ now: Date.UTC(2026, 10, 3, 4) });
});

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(window, "fully");
  Reflect.deleteProperty(window, "__reolinkViewerFully");
});

describe("the tablet log", () => {
  it("notes the page's events while a card is on it, and sends them every minute", async () => {
    const { hass, sent } = fakeHass();
    const log = new TabletLog(window);
    log.start(() => hass);
    // Before any card: only the load.
    document.dispatchEvent(new Event("visibilitychange"));
    const unwatch = log.watch({ name: () => "Doorbell", video: () => null, state: () => "playing" });
    window.dispatchEvent(new Event("offline"));
    window.dispatchEvent(new Event("online"));
    log.note("playing", "Doorbell", "SD MSE, 0.4 s");
    await vi.advanceTimersByTimeAsync(FLUSH_MS);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.device).toBe(deviceLabel(navigator.userAgent));
    expect(sent[0]?.events.map((e) => [e.what, e.card ?? null, e.detail ?? null])).toEqual([
      ["page loaded", null, "visible; Fully Kiosk's JavaScript interface off"],
      ["offline", null, null],
      ["online", null, null],
      ["playing", "Doorbell", "SD MSE, 0.4 s"],
    ]);
    // Nothing new: nothing sent. A card gone: the page's events no longer noted.
    await vi.advanceTimersByTimeAsync(FLUSH_MS);
    expect(sent).toHaveLength(1);
    unwatch();
    window.dispatchEvent(new Event("offline"));
    await log.flush();
    expect(sent).toHaveLength(1);
  });

  it("keeps what Home Assistant could not take, and bounds it", async () => {
    let failing = true;
    const { hass, sent } = fakeHass(() => failing);
    const log = new TabletLog(window);
    log.start(() => hass);
    for (let n = 0; n < 400; n += 1) log.note("frames", "Doorbell", String(n));
    log.note("x".repeat(50), "y".repeat(100), "z".repeat(300));
    await log.flush();
    expect(sent).toEqual([]);
    failing = false;
    await log.flush();
    const events = sent[0]?.events ?? [];
    expect(events).toHaveLength(300);
    // The newest kept, cut to what Home Assistant takes.
    expect(events.at(-1)).toMatchObject({ what: "x".repeat(40), card: "y".repeat(80), detail: "z".repeat(200) });
  });

  it("follows Fully Kiosk's screen and screensaver, and wakes it for a ring", async () => {
    const { fully, bound, fire } = fakeFully();
    Object.assign(window, { fully });
    const { hass, sent } = fakeHass();
    const log = new TabletLog(window);
    expect(log.device).toMatch(/ · Fully Kiosk$/);
    const sleeps = vi.fn();
    log.onSleep(sleeps);
    log.start(() => hass);
    expect([...bound.keys()]).toEqual(["screenOff", "screenOn", "onScreensaverStart", "onScreensaverStop"]);
    expect(log.asleep).toBe(false);
    fire("onScreensaverStart");
    expect(log.asleep).toBe(true);
    fire("screenOff");
    fire("onScreensaverStop");
    // The screen is still off.
    expect(log.asleep).toBe(true);
    fire("screenOn");
    expect(log.asleep).toBe(false);
    expect(sleeps).toHaveBeenCalledTimes(2);
    expect(log.wake()).toBe(true);
    expect(fully.stopScreensaver).toHaveBeenCalled();
    expect(fully.turnScreenOn).toHaveBeenCalled();
    await log.flush();
    expect(sent[0]?.events.map((e) => e.what)).toEqual([
      "page loaded",
      "screensaver on",
      "screen off",
      "screensaver off",
      "screen on",
    ]);
    expect(sent[0]?.events[0]?.detail).toBe("visible; Fully Kiosk's JavaScript interface on");
  });

  it("does nothing for a ring where there is no Fully Kiosk", () => {
    expect(new TabletLog(window).wake()).toBe(false);
  });

  it("counts the frames each card decodes, while it decodes any", async () => {
    const { hass, sent } = fakeHass();
    const log = new TabletLog(window);
    log.start(() => hass);
    const frames = { n: 100 };
    log.watch({ name: () => "Doorbell", video: () => video(frames), state: () => "playing" });
    log.watch({ name: () => "Laundry", video: () => null, state: () => "stopped" });
    await vi.advanceTimersByTimeAsync(FRAMES_MS); // the first count
    frames.n = 1600;
    await vi.advanceTimersByTimeAsync(FRAMES_MS);
    await vi.advanceTimersByTimeAsync(FRAMES_MS); // none: noted once
    await vi.advanceTimersByTimeAsync(FRAMES_MS); // still none: not noted
    frames.n = 40; // a new stream counts from 0
    await vi.advanceTimersByTimeAsync(FRAMES_MS);
    await log.flush();
    const noted = sent.flatMap((m) => m.events).filter((e) => e.what === "frames");
    expect(noted.map((e) => [e.card, e.detail])).toEqual([
      ["Doorbell", "1500 frames; visible; playing"],
      ["Doorbell", "0 frames; visible; playing"],
      ["Doorbell", "40 frames; visible; playing"],
    ]);
  });
});

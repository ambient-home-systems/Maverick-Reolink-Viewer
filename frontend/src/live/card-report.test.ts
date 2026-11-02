import { describe, expect, it } from "vitest";

import type { TabletEvent } from "../types";
import { cardReport, eventLines, summarize, summaryLines } from "./card-report";

// 22:59 on 2 November in New York.
const T = Date.UTC(2026, 10, 3, 3, 59);
const at = (seconds: number, what: string, card?: string, detail?: string): TabletEvent => ({
  at: T + seconds * 1000,
  what,
  ...(card ? { card } : {}),
  ...(detail ? { detail } : {}),
});

// A night on the wall tablet: the cards play, Fully's screensaver comes at
// 23:00 and goes at 07:00, a ring at 02:00 wakes the screen.
const NIGHT: TabletEvent[] = [
  at(0, "page loaded", undefined, "visible; Fully Kiosk's JavaScript interface on"),
  at(0.5, "starting", "Doorbell", "SD MSE"),
  at(0.9, "playing", "Doorbell", "SD MSE, 0.4 s"),
  at(0.6, "starting", "Front Yard", "SD MSE"),
  at(1.4, "playing", "Front Yard", "SD MSE, 0.8 s"),
  at(60, "screensaver on", undefined, "Fully Kiosk"),
  at(60, "stopped", "Doorbell", "SD"),
  at(60, "stopped", "Front Yard", "SD"),
  at(3 * 3600, "ring", "Doorbell", "full screen for 30 s; woke Fully Kiosk's screen"),
  at(3 * 3600 + 0.2, "screensaver off", undefined, "Fully Kiosk"),
  at(3 * 3600 + 0.3, "starting", "Doorbell", "HD WebRTC"),
  at(3 * 3600 + 2.3, "playing", "Doorbell", "HD WebRTC, 2.0 s"),
  at(3 * 3600 + 0.3, "starting", "Front Yard", "SD MSE"),
  at(3 * 3600 + 3, "retrying", "Front Yard", "SD: Could not reach the camera"),
  at(3 * 3600 + 300, "frames", "Doorbell", "120 frames; visible; asleep; playing"),
  at(3 * 3600 + 400, "screensaver on", undefined, "Fully Kiosk"),
  at(8 * 3600, "screensaver off", undefined, "Fully Kiosk"),
  at(8 * 3600 + 0.5, "playing", "Front Yard", "SD MSE, 0.5 s"),
  at(8 * 3600 + 0.7, "playing", "Doorbell", "SD MSE, 0.6 s"),
  at(8 * 3600 + 300, "frames", "Front Yard", "1500 frames; visible; playing"),
  at(8 * 3600 + 600, "hidden"),
  at(8 * 3600 + 900, "frames", "Front Yard", "30 frames; hidden; stopped"),
];

describe("the dashboard cards report", () => {
  it("sums up a night: sleeps, how soon video came back, what played unseen", () => {
    const summary = summarize(NIGHT);
    expect(summary.fully).toBe(true);
    expect(summary.asleep).toBe(2);
    expect(summary.hidden).toBe(1);
    expect(summary.rings).toBe(1);
    // From the load (0.9, 1.4 s), the ring's wake (2.1 s; the Front Yard did not
    // come back before the next wake), and the morning (0.5, 0.7 s).
    expect(summary.back.map((s) => Number(s.toFixed(1)))).toEqual([0.9, 1.4, 2.1, 0.5, 0.7]);
    expect(summary.notBack).toBe(1);
    expect(summary.unseenFrames).toBe(150);
    expect(summary.unseenCards).toEqual(["Doorbell", "Front Yard"]);
    expect(summary.retries).toEqual({ "Front Yard": 1 });
    expect(summaryLines(summary)).toEqual([
      "Fully Kiosk's JavaScript interface: on",
      "Screen off or screensaver (Fully Kiosk): 2 times · page hidden: 1 time",
      "Video back after the screen came on or the page was shown: median 0.9 s, slowest 2.1 s (5 times)",
      "Started but not playing again before the next wake: 1 time",
      "Video decoded while nobody could see it: 150 frames (Doorbell, Front Yard)",
      "Doorbell rings: 1",
      "Failed starts: Front Yard 1",
    ]);
  });

  it("says when nothing has been seen yet", () => {
    expect(summaryLines(summarize([]))).toEqual([
      "Fully Kiosk's JavaScript interface: not seen",
      "Screen off or screensaver (Fully Kiosk): 0 times · page hidden: 0 times",
      "Video back after the screen came on or the page was shown: not seen yet",
      "Video decoded while nobody could see it: none",
      "Doorbell rings: 0",
      "Failed starts: none",
    ]);
  });

  it("lists the events by day, in Home Assistant's time zone", () => {
    const lines = eventLines(NIGHT.slice(0, 2), "America/New_York");
    expect(lines[0]).toBe("Mon, Nov 2");
    expect(lines[1]).toMatch(/^22:59:00 {2}page {15}page loaded {6}visible; Fully Kiosk's/);
    expect(lines[2]).toMatch(/^22:59:00 {2}Doorbell {11}starting {9}SD MSE$/);
    expect(eventLines(NIGHT, "America/New_York")).toContain("Tue, Nov 3");
    const text = cardReport([{ device: "Android · Fully Kiosk", updated: "2026-11-03T12:00:00+00:00", events: NIGHT }], "9.9.9", "America/New_York");
    expect(text.split("\n").slice(0, 4)).toEqual([
      "Reolink Viewer dashboard cards report v9.9.9",
      "",
      "Android · Fully Kiosk · last heard from 2026-11-03T12:00:00+00:00",
      "Fully Kiosk's JavaScript interface: on",
    ]);
    expect(cardReport([], "9.9.9")).toContain("No dashboard card has reported yet.");
  });
});

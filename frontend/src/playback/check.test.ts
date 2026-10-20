import { afterEach, describe, expect, it } from "vitest";

import { makeHass, okDevices, type FakeHass } from "../test-fixtures";
import type { TimelineDay } from "../types";
import { PlaybackCheck, noteInterruptedCheck, type CheckTarget } from "./check";

const T0 = Date.UTC(2026, 9, 17, 4, 0);

function emptyDay(): TimelineDay {
  return {
    date: "2026-10-17",
    start: T0,
    end: T0 + 86_400_000,
    now: T0 + 43_200_000,
    segments: [],
    events: [],
    complete: false,
    events_error: null,
    hint_source: null,
    timing: { cache: "fresh" },
  };
}

function reportingHass(): FakeHass {
  const hass = makeHass(okDevices());
  const saved = new Map<string, { report_id: string; setup: string; text: string; done: boolean; updated: string }>();
  hass.callWS = <T,>(message: Record<string, unknown>) => {
    hass.sent.push(message);
    switch (message.type) {
      case "reolink_viewer/playback/check_report":
        saved.set(String(message.report_id), {
          report_id: String(message.report_id),
          setup: String(message.setup),
          text: String(message.text),
          done: Boolean(message.done),
          updated: "2026-10-17T12:00:00+00:00",
        });
        return Promise.resolve(null as T);
      case "reolink_viewer/playback/check_reports":
        return Promise.resolve({
          reports: [...saved.values()].map((r) => ({ ...r, id: r.report_id })),
        } as T);
      case "reolink_viewer/playback/media_info":
        return Promise.resolve({ sub: { codec: "avc1.640033", width: 640, height: 360, audio: null }, main: null } as T);
      case "reolink_viewer/timeline/day":
        return Promise.resolve(emptyDay() as T);
      default:
        return Promise.reject(new Error(`unexpected ${String(message.type)}`));
    }
  };
  return hass;
}

function stubTarget(hass: FakeHass): CheckTarget {
  return {
    hass,
    deviceId: "cam1",
    cameraName: "Garage",
    date: "2026-10-17",
    today: "2026-10-17",
    day: emptyDay(),
    loading: false,
    metrics: { timelineMs: 120, timelineServer: { cache: "memory", total_ms: 4 } },
    playFailure: undefined,
    hd: { main: false, reason: "this browser cannot decode hvc1 at 7680×2160" },
    progressive: true,
    monthDays: new Set<number>(),
    player: null,
    playing: undefined,
    selectDate: () => undefined,
    playAt: () => Promise.resolve(),
  };
}

afterEach(() => {
  window.localStorage.clear();
});

describe("PlaybackCheck", () => {
  it("reports what it could measure and saves the report", async () => {
    const hass = reportingHass();
    const changes: number[] = [];
    const check = new PlaybackCheck(stubTarget(hass), { setup: "Desktop Chrome, LAN", soakMinutes: 0 }, () =>
      changes.push(1),
    );
    const report = await check.run();
    expect(report).toContain("Reolink Viewer playback check v0.2.9 · Desktop Chrome, LAN · Garage");
    expect(report).toContain("A1 Time to timeline, today (as the tab opened): 120 ms (server: memory, total 4 ms)");
    expect(report).toContain("A2/A3 skipped: no earlier recording day this month");
    expect(report).toContain("B  skipped: no events today");
    expect(report).toContain("D  skipped: no recording of 20 min or more");
    expect(report).toContain("C  skipped: no two touching recordings on 2026-10-17");
    expect(report).toContain("R  skipped: no recording on this day");
    expect(report).toContain("L  skipped: nothing played");
    expect(report).toContain("HD: this browser cannot decode hvc1 at 7680×2160");
    expect(report).toContain("Summary:");
    expect(report).toContain("- Timeline: today 120 ms ✓");
    expect(changes.length).toBeGreaterThan(5);
    expect(check.running).toBe(false);
    const saves = hass.sent.filter((m) => m.type === "reolink_viewer/playback/check_report");
    expect(saves.at(-1)).toMatchObject({ report_id: check.id, setup: "Desktop Chrome, LAN", text: report, done: true });
    // Nothing is left marked as running.
    expect(window.localStorage.getItem("reolink-viewer-check-running")).toBeNull();
    expect(await noteInterruptedCheck(hass)).toBeUndefined();
  });

  it("stops when asked", async () => {
    const hass = reportingHass();
    const target = { ...stubTarget(hass), day: undefined };
    const check = new PlaybackCheck(target, { setup: "Other", soakMinutes: 0 });
    const running = check.run();
    check.stop();
    const report = await running;
    expect(report).toContain("Stopped.");
  });

  it("notes a run that the page reload cut short", async () => {
    const hass = reportingHass();
    await hass.callWS({
      type: "reolink_viewer/playback/check_report",
      report_id: "run1",
      setup: "iPhone app, Wi-Fi (local)",
      text: "M  12 min: …",
      done: false,
    });
    window.localStorage.setItem(
      "reolink-viewer-check-running",
      JSON.stringify({
        id: "run1",
        setup: "iPhone app, Wi-Fi (local)",
        started: "2026-10-17T10:00:00Z",
        updated: "2026-10-17T10:13:00Z",
        minute: 12,
      }),
    );
    const note = await noteInterruptedCheck(hass);
    expect(note).toContain("stopped without finishing in minute 12 of the one-hour session");
    const last = hass.sent.at(-1);
    expect(last).toMatchObject({ report_id: "run1", done: true });
    expect(String(last?.text)).toContain("INTERRUPTED:");
    expect(window.localStorage.getItem("reolink-viewer-check-running")).toBeNull();
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

import { parseInShort } from "../plain";
import { makeHass, okDevices, type FakeHass } from "../test-fixtures";
import type { TimelineDay } from "../types";
import { PlaybackCheck, hdByDefault, noteInterruptedCheck, type CheckTarget } from "./check";
import type { RvPlayer } from "./player";

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
    mode: "file player (this browser has no MSE)",
    stream: "sub",
    setStream: () => undefined,
    monthDays: new Set<number>(),
    player: null,
    playing: undefined,
    selectDate: () => undefined,
    playAt: () => Promise.resolve(),
  };
}

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

/**
 * A player on a recording (T0 + 1 h, an hour long), at T0 + 1 h 5 min; a
 * preview within 12 s of that is "buffered" and moves it there.
 */
function fakePlayer(): RvPlayer {
  const root = document.createElement("div");
  const video = document.createElement("video");
  video.className = "active";
  root.append(video);
  const item = { key: "k", recording: "sub:r1:0", segmentId: "r1", start: T0 + 3_600_000, end: T0 + 7_200_000 };
  let time = T0 + 3_900_000;
  return {
    renderRoot: root,
    current: item,
    get time() {
      return time;
    },
    preview(at: number) {
      if (Math.abs(at - T0 - 3_900_000) > 12_000) return false;
      time = at;
      setTimeout(() => video.dispatchEvent(new Event("seeked")), 1);
      return true;
    },
    resume: () => undefined,
    pause: () => undefined,
  } as unknown as RvPlayer;
}

describe("PlaybackCheck", () => {
  it("reports what it could measure and saves the report", async () => {
    const hass = reportingHass();
    const changes: number[] = [];
    const check = new PlaybackCheck(stubTarget(hass), { setup: "Desktop Chrome, LAN", soakMinutes: 0 }, () =>
      changes.push(1),
    );
    const report = await check.run();
    expect(report).toContain("Reolink Viewer playback check v0.3.2 · Desktop Chrome, LAN · Garage");
    expect(report).toContain("A1 Time to timeline, today (as the tab opened): 120 ms (server: memory, total 4 ms)");
    expect(report).toContain("A2/A3 skipped: no earlier recording day this month");
    expect(report).toContain("B  skipped: no events today");
    expect(report).toContain("D  skipped: no recording of 20 min or more");
    expect(report).toContain("C  skipped: no two touching recordings on 2026-10-17");
    expect(report).toContain("R  skipped: no recording on this day");
    expect(report).toContain("L  skipped: nothing played");
    expect(report).toContain("S  skipped: nothing playing");
    expect(report).toContain('H  skipped: not asked for (tick "with HD")');
    expect(report).toContain("HD as the tab opened: this browser cannot decode hvc1 at 7680×2160");
    expect(report).toContain("Summary:");
    expect(report).toContain("- Timeline: today 120 ms ✓");
    // In plain words first.
    expect(parseInShort(report)).toEqual({
      headline: "Garage's recordings play well on this device.",
      findings: [
        { grade: "good", text: "Today's recordings appear on the timeline in 0.1 s." },
        { grade: "note", text: "There were no events today to try opening." },
        { grade: "note", text: "HD is not offered on this device: this browser cannot decode hvc1 at 7680×2160." },
      ],
    });
    expect(check.inShort().headline).toBe("Garage's recordings play well on this device.");
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

describe("PlaybackCheck: scrubbing and HD", () => {
  it("previews points in the buffer and switches to HD and back at the same moment", async () => {
    // The check's waits are for real devices; here they pass at once.
    vi.spyOn(PlaybackCheck.prototype as unknown as { _pause: () => Promise<void> }, "_pause").mockResolvedValue();
    const hass = reportingHass();
    const player = fakePlayer();
    let stream: "sub" | "main" = "sub";
    const metrics: Record<string, unknown> = { timelineMs: 120 };
    const target: CheckTarget = {
      ...stubTarget(hass),
      hd: { main: true, reason: "hvc1.1.6.L153.B0 at 3840×2160 is supported" },
      metrics,
      player,
      get stream() {
        return stream;
      },
      setStream: (next) => {
        stream = next;
        metrics.firstFrameMs = undefined;
        setTimeout(() => {
          Object.assign(metrics, { stream: next, firstFrameMs: next === "main" ? 2840 : 210, codec: "hvc1.1.6.L153.B0" });
        }, 5);
      },
    };
    const report = await new PlaybackCheck(target, { setup: "Desktop Chrome, LAN", soakMinutes: 0, hd: true }).run();
    expect(report).toMatch(/S {2}Scrub preview \(frames from the buffer while dragging\): 4 of 5 points shown, median \d+ ms/);
    expect(report).toContain("not buffered: +15 s");
    expect(report).toContain("10.0 min ahead: not buffered (the thumbnail shows instead)");
    expect(report).toMatch(/H {2}HD at .*: first frame 2840 ms, started 0\.00 s from where SD was \(kept the moment\)/);
    expect(report).toMatch(/Back to SD at .*: first frame 210 ms, started 0\.00 s from where HD was/);
    expect(report).toContain("- HD switch: to HD 2840 ms, kept the moment (0.00 s); back to SD 210 ms, kept the moment (0.00 s)");
    expect(report).toMatch(/H {2}HD at .* · main hvc1\.1\.6\.L153\.B0 · /);
    // The tab's decision from before HD played is not the summary's word on HD.
    expect(report).toContain("HD as the tab opened: hvc1.1.6.L153.B0 at 3840×2160 is supported (played in H above)");
    expect(report).not.toContain("- HD: offered");
    expect(parseInShort(report)?.findings).toContainEqual({
      grade: "good",
      text: "Switching to HD takes 2.8 s and keeps your place; back to SD, 0.2 s.",
    });
    expect(parseInShort(report)?.findings).toContainEqual({
      grade: "fine",
      text: "Dragging along the timeline shows the video at 4 of 5 points; elsewhere a thumbnail shows instead.",
    });
    expect(stream).toBe("sub");
  });

  it("reports an HD failure, and skips HD where it is not offered", async () => {
    vi.spyOn(PlaybackCheck.prototype as unknown as { _pause: () => Promise<void> }, "_pause").mockResolvedValue();
    const hass = reportingHass();
    const metrics: Record<string, unknown> = { timelineMs: 120 };
    const target: CheckTarget = {
      ...stubTarget(hass),
      hd: { main: true, reason: "not tried yet" },
      metrics,
      player: fakePlayer(),
      setStream: () => {
        setTimeout(() => Object.assign(metrics, { hdFailures: 1, lastHdFailure: "MEDIA_ERR_DECODE" }), 5);
      },
    };
    const report = await new PlaybackCheck(target, { setup: "iPhone app, Wi-Fi (local)", soakMinutes: 0, hd: true }).run();
    expect(report).toContain("FAILED: MEDIA_ERR_DECODE (back on the sub stream)");
    expect(parseInShort(report)?.headline).toBe("1 problem found with Garage's recordings on this device.");
    expect(parseInShort(report)?.findings).toContainEqual({
      grade: "problem",
      text: "HD did not play; the viewer went back to SD.",
      advice: "SD still works. Include the details below if you report it.",
    });
    const off = await new PlaybackCheck({ ...stubTarget(reportingHass()), player: fakePlayer() }, {
      setup: "Other",
      soakMinutes: 0,
      hd: true,
    }).run();
    expect(off).toContain("H  skipped: HD not offered (this browser cannot decode hvc1 at 7680×2160)");
  });

  it("runs HD by default except on remote setups", () => {
    expect(hdByDefault("Desktop Chrome, LAN")).toBe(true);
    expect(hdByDefault("iPhone app, Wi-Fi (local)")).toBe(true);
    expect(hdByDefault("iPhone app, Tailscale")).toBe(false);
    expect(hdByDefault("Desktop Chrome, Nabu Casa")).toBe(false);
  });
});

describe("PlaybackCheck: starts that waited for the recorder", () => {
  /** A day with one hour-long recording (T0 + 1 h) and a MOTION event 55 min into it. */
  function longDay(): TimelineDay {
    const start = T0 + 3_600_000;
    return {
      ...emptyDay(),
      segments: [{ id: "long", start, end: start + 3_600_000, triggers: ["MOTION"], ambiguous: false }],
      events: [{ start: start + 3_300_000, end: start + 3_310_000, types: ["MOTION"], segment: "long", ambiguous: false }],
    };
  }

  /** Each start opens the recording as the next of `held` says the server had it (then whole). */
  async function run(held: { complete: boolean; bytes: number }[]): Promise<string> {
    vi.spyOn(PlaybackCheck.prototype as unknown as { _pause: () => Promise<void> }, "_pause").mockResolvedValue();
    const hass = reportingHass();
    const answer = hass.callWS.bind(hass);
    hass.callWS = <T,>(message: Record<string, unknown>) =>
      message.type === "reolink_viewer/playback/peek"
        ? Promise.resolve({ segment_id: String(message.segment_id), cache: null } as T)
        : answer<T>(message);
    const metrics: Record<string, unknown> = { timelineMs: 120 };
    let playing: CheckTarget["playing"];
    const target: CheckTarget = {
      ...stubTarget(hass),
      day: longDay(),
      metrics,
      get playing() {
        return playing;
      },
      playAt: () => {
        const cache = held.shift() ?? { complete: true, bytes: 1 };
        metrics.firstFrameMs = undefined;
        playing = { cache: { ...cache, error: null } } as CheckTarget["playing"];
        setTimeout(() => (metrics.firstFrameMs = cache.complete ? 70 : 2250), 1);
        return Promise.resolve();
      },
    };
    return new PlaybackCheck(target, { setup: "Desktop Chrome, LAN", soakMinutes: 0 }).run();
  }

  it("marks an event start that waited, and counts only a deep start that waited", async () => {
    // B waited; D1's recording was fetched (a prefetch) between choosing and playing it.
    const report = await run([
      { complete: false, bytes: 0 },
      { complete: true, bytes: 178_800_000 },
      { complete: true, bytes: 178_800_000 },
    ]);
    expect(report).toContain("- Events → first frame (sub): 2250 ms ✗ (not cached)");
    expect(report).toContain("D1 Not cached when chosen, but on disk when played (not counted), 55.0 min into a 60.0 min recording");
    expect(report).toContain("D2 Cached, ");
    expect(report).toContain("- Deep start (sub, 60.0 min recording): not cached not measured, cached 70 ms ✓");
  });

  it("counts a deep start that waited, with what was fetched already", async () => {
    const report = await run([
      { complete: true, bytes: 1 },
      { complete: false, bytes: 12_000_000 },
      { complete: true, bytes: 178_800_000 },
    ]);
    expect(report).toContain("- Events → first frame (sub): 70 ms ✓");
    expect(report).toContain("D1 Not cached (12.0 MB already fetched when played), 55.0 min into a 60.0 min recording");
    expect(report).toContain("- Deep start (sub, 60.0 min recording): not cached 2250 ms, cached 70 ms ✓");
  });
});

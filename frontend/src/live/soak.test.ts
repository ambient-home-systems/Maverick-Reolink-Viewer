import { describe, expect, it } from "vitest";

import type { SoakSample } from "../types";
import { soakReport, type SoakInput } from "./soak";

const OPENED = new Date(2026, 9, 22, 16, 30).getTime();
const HOUR = 3_600_000;

function sample(minutes: number, change: Partial<SoakSample> = {}): SoakSample {
  return {
    at: OPENED + minutes * 60_000,
    go2rtc: { state: "running", restarts: 0, memory_kb: 40_960 },
    webrtc_sessions: 0,
    feeds: { feeds: 6, warm: 6, viewers: 6, ends: 0 },
    hosts: [
      { name: "RLN36", streams: 6, limit: 7, waiting: 0, cpu: 23 },
      { name: "Laundry Room", streams: 0, limit: 2, waiting: 0, cpu: null },
    ],
    battery: [],
    ...change,
  };
}

/** A day of samples every 5 minutes, the last taken now. */
function day(change: (minutes: number) => Partial<SoakSample> = () => ({})): SoakSample[] {
  return Array.from({ length: 289 }, (_, i) => sample(i * 5, change(i * 5)));
}

function input(change: Partial<SoakInput> = {}): SoakInput {
  return {
    version: "0.14.0",
    openedAt: OPENED,
    now: OPENED + 24 * HOUR,
    visibleMs: 24 * HOUR,
    sampleS: 300,
    samples: day(),
    tiles: [
      { camera: "Garage", plays: 1, drops: 0, failures: 0 },
      { camera: "Doorbell", plays: 3, drops: 2, failures: 1 },
    ],
    ...change,
  };
}

const verdicts = (text: string) => text.slice(text.indexOf("Verdict:")).split("\n").slice(1);

describe("soakReport", () => {
  it("passes a steady day", () => {
    const text = soakReport(input());
    expect(text).toContain("Grid open 24.0 h");
    expect(text).toContain("page visible 100%");
    expect(text).toContain("Server samples: 289 (every 5 min)");
    expect(text).toContain("go2rtc: running · restarts 0 → 0 · memory 40.0 → 40.0 MB (peak 40.0 MB)");
    expect(text).toContain("  RLN36: 6 → 6 of 7 (peak 6) · CPU 23% → 23% (peak 23%)");
    expect(text).toContain("  Laundry Room: 0 → 0 of 2 (peak 0) · CPU not reported");
    expect(text).toContain("  Doorbell: 3 · 2 · 1");
    expect(verdicts(text)).toEqual([
      "✓ No reconnect loops: no tile dropped or failed to start more than once an hour",
      "✓ go2rtc ran throughout: no restart",
      "✓ go2rtc's memory steady: 40.0 → 40.0 MB",
      "✓ No growth in camera sessions: each host ends with no more stream slots in use than it started with",
      "✓ Within the stream limits: no host above its limit",
      "– Camera CPU (Phase 0 set no CPU limit): RLN36 peak 23%",
      "– Battery cameras: none on battery",
      "✓ Ran 24.0 h",
      "✓ The page was visible 100% of the time",
      "",
      "Passed.",
    ]);
  });

  it("says what did not hold", () => {
    const samples = day((m) => ({
      go2rtc: { state: m === 600 ? "restarting" : "running", restarts: m >= 600 ? 1 : 0, memory_kb: 40_960 + m * 100 },
      hosts: [{ name: "RLN36", streams: m >= 1430 ? 8 : 6, limit: 7, waiting: m === 700 ? 1 : 0, cpu: 40 }],
      battery: [{ camera: "Doorbell", sleeping: false, watched: m < 60 }],
    }));
    const text = soakReport(
      input({
        now: OPENED + 2 * HOUR,
        visibleMs: HOUR,
        samples: samples.slice(0, 10),
        tiles: [{ camera: "Garage", plays: 9, drops: 8, failures: 1 }],
      }),
    );
    expect(text).toContain("  RLN36: 6 → 6 of 7 (peak 6)");
    expect(text).toContain("Battery camera Doorbell: asleep in 0 of 0 samples while not watched");
    expect(verdicts(text)).toContain("✗ Reconnect loops: Garage (9 in 2.0 h)");
    expect(verdicts(text)).toContain("– Doorbell: watched in every sample");
    expect(verdicts(text)).toContain("✗ Not 24 h yet: the grid has been open 2.0 h");
    expect(verdicts(text)).toContain("⚠ The page was visible only 50% of the time: tiles pause while it is hidden");

    // The whole day: a restart, memory growth, sessions grown past the limit, no sleep.
    const all = soakReport(input({ samples }));
    expect(all).toContain("  RLN36: 6 → 8 of 7 (peak 8, up to 1 waiting)");
    expect(verdicts(all)).toEqual(
      expect.arrayContaining([
        "✗ go2rtc restarted 1 time, and was not running in 1 sample",
        "⚠ go2rtc's memory grew: 40.0 → 180.6 MB",
        "✗ Camera sessions grew: RLN36 6 → 8 (close full screen before the report)",
        "✗ Above the stream limit: RLN36",
        "✗ Doorbell never slept while not watched",
        "Not passed: 4 criteria not met.",
      ]),
    );
  });

  it("notes missing samples, a host that came later, and battery cameras that slept", () => {
    const samples = day((m) => ({
      hosts: m < 60 ? [] : [{ name: "Laundry Room", streams: 1, limit: 2, waiting: 0, cpu: null }],
      battery: [{ camera: "Doorbell", sleeping: m % 10 === 0, watched: false }],
      go2rtc: { state: "running", restarts: 0, memory_kb: null },
    })).filter((_, i) => i % 3 === 0);
    const text = soakReport(input({ samples }));
    expect(text).toContain("go2rtc: running · restarts 0 → 0 · memory not known");
    expect(text).toContain("  Laundry Room: 0 → 1 of 2 (peak 1)");
    expect(verdicts(text)).toContain("✓ Doorbell slept while not watched");
    expect(verdicts(text)).toContain("⚠ 97 server samples of about 288: Home Assistant may have restarted");
    expect(soakReport(input({ samples: [] }))).toContain("No server samples");
  });
});

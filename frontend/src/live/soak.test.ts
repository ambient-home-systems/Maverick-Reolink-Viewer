import { describe, expect, it } from "vitest";

import type { SoakRun, SoakSample } from "../types";
import { soakReport, soakSummary, type SoakInput } from "./soak";

const OPENED = new Date(2026, 9, 22, 16, 30).getTime();
const HOUR = 3_600_000;
const at = (minutes: number) => new Date(OPENED + minutes * 60_000).toLocaleString();

/** A sample with nobody watching: only the six streams kept warm hold a slot. */
function sample(minutes: number, change: Partial<SoakSample> = {}): SoakSample {
  return {
    at: OPENED + minutes * 60_000,
    go2rtc: { state: "running", restarts: 0, memory_kb: 40_960 },
    webrtc_sessions: 0,
    feeds: { feeds: 6, warm: 6, viewers: 0, ends: 0 },
    hosts: [
      { name: "RLN36", streams: 6, limit: 7, waiting: 0, cpu: 23 },
      { name: "Doorbell", streams: 0, limit: 2, waiting: 0, cpu: null },
    ],
    battery: [],
    ...change,
  };
}

/** A day of samples every 5 minutes, the last taken now. */
function day(change: (minutes: number) => Partial<SoakSample> = () => ({})): SoakSample[] {
  return Array.from({ length: 289 }, (_, i) => sample(i * 5, change(i * 5)));
}

function run(change: Partial<SoakRun> = {}): SoakRun {
  return {
    started_at: OPENED,
    opens: 3,
    open_ms: 10 * HOUR,
    visible_ms: 8 * HOUR,
    tiles: {
      Garage: { plays: 3, drops: 0, failures: 0 },
      Doorbell: { plays: 5, drops: 2, failures: 1 },
    },
    devices: { "Mac · Chrome": OPENED + 24 * HOUR - 30_000, "iPhone · Safari": OPENED + 2 * HOUR },
    ...change,
  };
}

function input(change: Partial<SoakInput> = {}): SoakInput {
  return {
    version: "0.15.0",
    now: OPENED + 24 * HOUR,
    sampleS: 300,
    keepS: 36 * 3600,
    // Sampling started 5 minutes before its first sample.
    startedAt: OPENED - 5 * 60_000,
    warmupS: 300,
    run: run(),
    samples: day(),
    ...change,
  };
}

const verdicts = (text: string) => text.slice(text.indexOf("Verdict:")).split("\n").slice(1);

describe("soakReport", () => {
  it("passes when Home Assistant ran 24 h and the grid was visible 8 h in all", () => {
    const text = soakReport(input());
    expect(text.split("\n").slice(1, 4)).toEqual([
      `Soak started ${at(0)} (24.0 h ago) · grid open 10.0 h, visible 8.0 h · opened 3 times`,
      "Reported by: Mac · Chrome (now), iPhone · Safari (22.0 h ago)",
      `Home Assistant's samples: 289 over 24.0 h, since ${at(0)} (every 5 min; the last 36 h are kept)`,
    ]);
    expect(text).toContain("go2rtc: running · restarts 0 → 0 · memory 40.0 → 40.0 MB (peak 40.0 MB)");
    expect(text).toContain("  RLN36: 6 → 6 of 7 (peak 6) · CPU 23% → 23% (peak 23%)");
    expect(text).toContain("  Doorbell: 0 → 0 of 2 (peak 0) · CPU not reported");
    expect(text).toContain(`While nobody watched (289 samples, ${at(0)} → ${at(1440)}): RLN36 6 → 6, Doorbell 0 → 0`);
    expect(text).toContain("  Doorbell: 5 · 2 · 1");
    expect(verdicts(text)).toEqual([
      "✓ No reconnect loops: no tile dropped or failed to start more than once an hour",
      "✓ go2rtc ran throughout: no restart",
      "✓ go2rtc's memory steady: 40.0 → 40.0 MB",
      "✓ No growth in camera sessions: while nobody watched, no host held more stream slots at the end than at the start",
      "✓ Within the stream limits: no host above its limit",
      "– Camera CPU (Phase 0 set no CPU limit): RLN36 peak 23%",
      "– Battery cameras: none on battery",
      "✓ Home Assistant ran live view 24.0 h (24 needed)",
      "✓ The grid was visible 8.0 h (8 needed), opened 3 times",
      "",
      "Passed.",
    ]);
  });

  it("judges growth while nobody watched, not where a grid was open", () => {
    // A grid watches the Doorbell (cold, over WebRTC) for the last two hours.
    const watched = (m: number): Partial<SoakSample> =>
      m >= 1320
        ? {
            webrtc_sessions: 1,
            hosts: [
              { name: "RLN36", streams: 6, limit: 7, waiting: 0, cpu: null },
              { name: "Doorbell", streams: 1, limit: 2, waiting: 0, cpu: null },
            ],
          }
        : {};
    const text = soakReport(input({ samples: day(watched) }));
    expect(text).toContain("  Doorbell: 0 → 1 of 2 (peak 1)");
    expect(text).toContain(`While nobody watched (264 samples, ${at(0)} → ${at(1315)}): RLN36 6 → 6, Doorbell 0 → 0`);
    expect(verdicts(text)).toContain(
      "✓ No growth in camera sessions: while nobody watched, no host held more stream slots at the end than at the start",
    );

    // A slot still held once nobody watches: a leak.
    const leaked = soakReport(
      input({
        samples: day((m) => ({
          ...watched(m),
          ...(m >= 1400 ? { webrtc_sessions: 0, hosts: [{ name: "Doorbell", streams: 1, limit: 2, waiting: 0, cpu: null }] } : {}),
        })),
      }),
    );
    expect(verdicts(leaked)).toContain("✗ Camera sessions grew while nobody watched: Doorbell 0 → 1");

    // Somebody watched throughout: the window's ends.
    const always = soakReport(input({ samples: day(() => ({ feeds: { feeds: 6, warm: 6, viewers: 6, ends: 0 } })) }));
    expect(always).not.toContain("While nobody watched");
    expect(verdicts(always)).toContain(
      "✓ No growth in camera sessions: each host ends with no more stream slots in use than it started with",
    );
  });

  it("says what did not hold", () => {
    const samples = day((m) => ({
      go2rtc: { state: m === 60 ? "restarting" : "running", restarts: m >= 60 ? 1 : 0, memory_kb: 40_960 + m * 1000 },
      webrtc_sessions: 1,
      hosts: [{ name: "RLN36", streams: m >= 110 ? 8 : 6, limit: 7, waiting: m === 70 ? 1 : 0, cpu: 40 }],
      battery: [{ camera: "Doorbell", sleeping: false, watched: m < 60 }],
    })).slice(0, 25);
    const text = soakReport(
      input({
        now: OPENED + 2 * HOUR,
        run: run({ visible_ms: HOUR, tiles: { Garage: { plays: 9, drops: 8, failures: 1 } } }),
        samples,
      }),
    );
    expect(text).toContain("  RLN36: 6 → 8 of 7 (peak 8, up to 1 waiting)");
    expect(text).toContain("Battery camera Doorbell: asleep in 0 of 13 samples while not watched");
    expect(verdicts(text)).toEqual([
      "✗ Reconnect loops: Garage (9 in 1.0 h)",
      "✗ go2rtc restarted 1 time, and was not running in 1 sample",
      "⚠ go2rtc's memory grew: 40.0 → 157.2 MB",
      "✗ Camera sessions grew: RLN36 6 → 8 (close full screen before the report)",
      "✗ Above the stream limit: RLN36",
      "– Camera CPU (Phase 0 set no CPU limit): RLN36 peak 40%",
      "✗ Doorbell never slept while not watched",
      "✗ Home Assistant's samples cover 2.0 h of 24: it has to run that long without restarting (no page needs to be open)",
      "✗ The grid has been visible 1.0 h of 8: open it whenever it suits; the hours add up across sittings and devices",
      "",
      "Not passed: 7 criteria not met.",
    ]);
  });

  it("says it in plain words: a headline, then what held and what to do", () => {
    expect(soakSummary(input())).toEqual({
      headline: "Passed: live view held up for the whole test.",
      findings: [
        { grade: "good", text: "Live video kept playing: no camera kept dropping and reconnecting." },
        { grade: "good", text: "The video service (go2rtc) ran the whole time without restarting." },
        { grade: "good", text: "The video service's memory use stayed steady (about 40.0 MB)." },
        { grade: "good", text: "Connections to your cameras did not pile up." },
        { grade: "good", text: "No camera or NVR was asked for more video streams than it can serve." },
        { grade: "note", text: "Processor load at its highest: RLN36 23%, well within what it can handle." },
        { grade: "good", text: "Home Assistant ran live view for 24.0 hours." },
        { grade: "good", text: "The live board was on screen for 8.0 hours, opened 3 times." },
      ],
    });
    // The text opens its verdicts with the same, for a report read elsewhere.
    expect(soakReport(input())).toContain("In short: Passed: live view held up for the whole test.\n- Good: Live video kept playing");

    const failing = soakSummary(
      input({
        now: OPENED + 2 * HOUR,
        run: run({ visible_ms: HOUR, tiles: { Garage: { plays: 9, drops: 8, failures: 1 } } }),
        samples: day((m) => ({
          go2rtc: { state: "running", restarts: m >= 60 ? 1 : 0, memory_kb: 40_960 + m * 1000 },
          battery: [{ camera: "Doorbell", sleeping: false, watched: false }],
        })).slice(0, 25),
      }),
    );
    expect(failing.headline).toBe("3 problems found so far.");
    expect(failing.findings.filter((f) => f.grade !== "good")).toEqual([
      {
        grade: "problem",
        text: "Live video kept dropping and reconnecting on Garage (9 times in 1.0 hours).",
        advice: "Check those cameras' network (Wi-Fi signal or cable) and power.",
      },
      {
        grade: "problem",
        text: "The video service (go2rtc) restarted 1 time.",
        advice: "Look for go2rtc errors in Home Assistant's log, and include the details below if you report it.",
      },
      {
        grade: "note",
        text: "The video service's memory use grew from 40.0 to 157.2 MB.",
        advice: "If it keeps growing, restart Home Assistant and report it with the details below.",
      },
      { grade: "note", text: "Processor load at its highest: RLN36 23%, well within what it can handle." },
      {
        grade: "problem",
        text: "Doorbell stayed awake when nobody was watching, which drains its battery.",
        advice: "Make sure nothing else streams it (another app, or a dashboard card showing it live).",
      },
      {
        grade: "pending",
        text: "Home Assistant has run live view for 2.0 of 24 hours.",
        advice: "Leave Home Assistant running; no page needs to be open.",
      },
      {
        grade: "pending",
        text: "The live board has been on screen for 1.0 of 8 hours.",
        advice: "Open Reolink → Live whenever it suits you; the hours add up across sittings and devices.",
      },
    ]);

    // A processor near its limit is worth a look.
    const busy = soakSummary(input({ samples: day(() => ({ hosts: [{ name: "RLN36", streams: 6, limit: 7, waiting: 0, cpu: 91 }] })) }));
    expect(busy.findings).toContainEqual({
      grade: "slow",
      text: "Processor load at its highest: RLN36 91%, near its limit.",
      advice: "Keep fewer cameras warm, or watch fewer of them at once.",
    });
    // Nothing measured yet.
    const waiting = soakSummary(input({ run: null, samples: [] }));
    expect(waiting.headline).toBe("The test has not started yet.");
    expect(waiting.findings.map((f) => f.grade)).toEqual(["pending", "pending"]);
    // Running, all well so far.
    expect(soakSummary(input({ now: OPENED + 2 * HOUR, samples: day().slice(0, 25), run: run({ visible_ms: HOUR, tiles: {} }) })).headline).toBe(
      "Running: nothing wrong so far.",
    );
  });

  it("reports Home Assistant's half before any grid has", () => {
    const text = soakReport(input({ run: null }));
    expect(text.split("\n")[1]).toBe(
      "No grid has reported yet: open Reolink → Live and leave it showing; its hours add up.",
    );
    expect(text).toContain("Tiles (plays · drops · failed starts):\n  no grid yet");
    expect(verdicts(text)).toEqual(
      expect.arrayContaining([
        "– Reconnect loops: no grid has reported yet",
        "✓ Home Assistant ran live view 24.0 h (24 needed)",
        "✗ The grid has been visible 0.0 h of 8: no grid has reported yet",
        "Not passed: 1 criterion not met.",
      ]),
    );
    // Right after Home Assistant started: no sample until live view is up.
    expect(soakReport(input({ run: null, samples: [] }))).toContain(
      `No samples yet: Home Assistant started at ${at(-5)}. The first comes 5 minutes after, once live view is up (go2rtc and the kept-warm feeds).`,
    );
    expect(soakReport(input({ run: null, samples: [], startedAt: null }))).toContain(
      "No samples yet: Home Assistant is still starting. The first comes 5 minutes after it has, once live view is up.",
    );
  });

  it("notes missing samples, a restart of Home Assistant, and battery cameras that slept", () => {
    const samples = day((m) => ({
      hosts: m < 60 ? [] : [{ name: "Laundry Room", streams: 1, limit: 2, waiting: 0, cpu: null }],
      battery: [{ camera: "Doorbell", sleeping: m % 10 === 0, watched: false }],
      go2rtc: { state: "running", restarts: 0, memory_kb: null },
    })).filter((_, i) => i % 3 === 0);
    // The soak began 10 h before Home Assistant last started.
    const text = soakReport(
      input({ run: run({ started_at: OPENED - 10 * HOUR, tiles: {}, devices: {} }), samples }),
    );
    // A grid that reported first, right after Home Assistant started: no restart.
    expect(soakReport(input({ run: run({ started_at: OPENED - 4 * 60_000 }), samples }))).not.toContain("started again");
    expect(text).toContain("go2rtc: running · restarts 0 → 0 · memory not known");
    expect(text).toContain("  Laundry Room: 0 → 1 of 2 (peak 1)");
    expect(text).toContain("Reported by: no grid yet");
    expect(text).toContain("  none counted yet");
    expect(verdicts(text)).toContain("✓ Doorbell slept while not watched");
    expect(verdicts(text)).toContain(
      `– Home Assistant started again at ${at(-5)}, after the soak began: its samples start then; the grid's hours carry on`,
    );
    expect(verdicts(text)).toContain("⚠ 97 samples of about 289 in 24.0 h: sampling stopped for a while");

    // Only the last 36 h of samples are kept: a longer soak is not a restart.
    const long = soakReport(
      input({
        now: OPENED + 72 * HOUR,
        run: run({ started_at: OPENED }),
        samples: Array.from({ length: 433 }, (_, i) => sample(36 * 60 + i * 5)),
      }),
    );
    expect(long).toContain("Home Assistant's samples: 433 over 36.0 h");
    expect(verdicts(long).some((v) => v.includes("started again") || v.includes("samples of about"))).toBe(false);
    // Visible longer than the soak (two devices at once): no more than the soak.
    expect(soakReport(input({ run: run({ visible_ms: 48 * HOUR }) }))).toContain("visible 24.0 h");
  });
});

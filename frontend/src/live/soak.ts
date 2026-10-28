// The soak report (Phase 3's exit criteria, as the owner set them on
// 2026-10-26): Home Assistant runs live view for SERVER_HOURS, and the grid is
// visible for GRID_HOURS in all, in as many sittings and on as many devices as
// suits. Throughout: no reconnect loops, no growth in the sessions to the
// cameras, the cameras within their limits, battery cameras asleep when nobody
// watches them. It reads the soak run the server keeps (what the grids
// counted, sent every SOAK_REPORT_MS) and the server's samples (every 5
// minutes, from 5 minutes after Home Assistant started, once live view is
// up) since the run started, or every sample kept before a grid has
// reported, and says, for each criterion, whether it held. Any device can
// read it.
import { count, inShortLines, type Finding, type InShort } from "../plain";
import type { SoakRun, SoakSample } from "../types";

export interface SoakInput {
  version: string;
  /** Epoch ms. */
  now: number;
  /** The server's sampling interval (s), and how long it keeps samples (s). */
  sampleS: number;
  keepS: number;
  /** When sampling started (epoch ms), or null; the first sample comes warmupS later. */
  startedAt: number | null;
  warmupS: number;
  /** The soak run, or null before a grid has reported. */
  run: SoakRun | null;
  /** The server's samples since the run started (all kept, with no run), the last one taken now. */
  samples: SoakSample[];
}

/** Home Assistant's half: how long its samples must cover. */
export const SERVER_HOURS = 24;
/** The grid's half: how long it must be visible in all (tiles pause while it is hidden). */
export const GRID_HOURS = 8;
/** How often an open grid reports what it counted. */
export const SOAK_REPORT_MS = 60_000;

type Mark = "✓" | "✗" | "⚠" | "–";

/** The report as text: in plain words, what was measured, then a verdict per criterion. */
export function soakReport(input: SoakInput): string {
  return soakAnalysis(input).text;
}

/** The report's plain-language summary ("In short"). */
export function soakSummary(input: SoakInput): InShort {
  return soakAnalysis(input).inShort;
}

const OPEN_LIVE = "Open Reolink → Live whenever it suits you; the hours add up across sittings and devices.";

function soakAnalysis(input: SoakInput): { text: string; inShort: InShort } {
  const { samples, run } = input;
  const plain: Finding[] = [];
  const sampleMs = input.sampleS * 1000;
  const lines: string[] = [`Reolink Viewer soak report v${input.version} · ${new Date(input.now).toLocaleString()}`];
  let visibleHours = 0;
  if (run) {
    const elapsedMs = Math.max(0, input.now - run.started_at);
    // Tiles play only while the page is visible: the grid's hours are those.
    visibleHours = Math.min(run.visible_ms, elapsedMs) / 3_600_000;
    const devices = Object.entries(run.devices).sort(([, a], [, b]) => b - a);
    lines.push(
      `Soak started ${new Date(run.started_at).toLocaleString()} (${hours(elapsedMs)} h ago) · grid open ${hours(run.open_ms)} h, visible ${visibleHours.toFixed(1)} h · opened ${run.opens} time${run.opens === 1 ? "" : "s"}`,
      `Reported by: ${devices.length ? devices.map(([device, at]) => `${device} (${ago(input.now - at)})`).join(", ") : "no grid yet"}`,
    );
  } else {
    lines.push("No grid has reported yet: open Reolink → Live and leave it showing; its hours add up.");
  }
  const first = samples.at(0);
  const last = samples.at(-1);
  if (!first || !last) {
    const minutes = Math.round(input.warmupS / 60);
    lines.push(
      "",
      input.startedAt === null
        ? `No samples yet: Home Assistant is still starting. The first comes ${minutes} minutes after it has, once live view is up.`
        : `No samples yet: Home Assistant started at ${new Date(input.startedAt).toLocaleString()}. The first comes ${minutes} minutes after, once live view is up (go2rtc and the kept-warm feeds).`,
    );
    plain.push({
      grade: "pending",
      text:
        input.startedAt === null
          ? `Home Assistant is still starting. Its first measurement comes ${String(minutes)} minutes after it has.`
          : `Home Assistant's first measurement comes ${String(minutes)} minutes after it started (at ${new Date(input.startedAt).toLocaleTimeString()}).`,
    });
    if (!run) plain.push({ grade: "pending", text: "The live board has not been on screen yet.", advice: OPEN_LIVE });
    return { text: lines.join("\n"), inShort: { headline: "The test has not started yet.", findings: plain } };
  }
  const spanMs = last.at - first.at;
  lines.push(
    `Home Assistant's samples: ${samples.length} over ${hours(spanMs)} h, since ${new Date(first.at).toLocaleString()} (every ${Math.round(input.sampleS / 60)} min; the last ${Math.round(input.keepS / 3600)} h are kept)`,
    "",
  );
  const verdicts: [Mark, string][] = [];

  // go2rtc
  const memories = samples.map((s) => s.go2rtc.memory_kb).filter((m): m is number => m !== null);
  const restarts = last.go2rtc.restarts - first.go2rtc.restarts;
  const notRunning = samples.filter((s) => s.go2rtc.state !== "running").length;
  lines.push(
    `go2rtc: ${last.go2rtc.state} · restarts ${first.go2rtc.restarts} → ${last.go2rtc.restarts}` +
      (memories.length
        ? ` · memory ${mb(memories[0] ?? 0)} → ${mb(memories.at(-1) ?? 0)} MB (peak ${mb(Math.max(...memories))} MB)`
        : " · memory not known"),
  );
  verdicts.push(
    restarts === 0 && notRunning === 0
      ? ["✓", "go2rtc ran throughout: no restart"]
      : ["✗", `go2rtc restarted ${restarts} time${restarts === 1 ? "" : "s"}${notRunning ? `, and was not running in ${notRunning} sample${notRunning === 1 ? "" : "s"}` : ""}`],
  );
  plain.push(
    restarts === 0 && notRunning === 0
      ? { grade: "good", text: "The video service (go2rtc) ran the whole time without restarting." }
      : {
          grade: "problem",
          text: `The video service (go2rtc) restarted ${count(restarts, "time")}${notRunning ? ` and was down for about ${String(notRunning * Math.round(input.sampleS / 60))} minutes` : ""}.`,
          advice: "Look for go2rtc errors in Home Assistant's log, and include the details below if you report it.",
        },
  );
  const firstMemory = memories.at(0);
  const lastMemory = memories.at(-1);
  if (firstMemory !== undefined && lastMemory !== undefined) {
    verdicts.push(
      lastMemory <= firstMemory * 2
        ? ["✓", `go2rtc's memory steady: ${mb(firstMemory)} → ${mb(lastMemory)} MB`]
        : ["⚠", `go2rtc's memory grew: ${mb(firstMemory)} → ${mb(lastMemory)} MB`],
    );
    plain.push(
      lastMemory <= firstMemory * 2
        ? { grade: "good", text: `The video service's memory use stayed steady (about ${mb(lastMemory)} MB).` }
        : {
            grade: "note",
            text: `The video service's memory use grew from ${mb(firstMemory)} to ${mb(lastMemory)} MB.`,
            advice: "If it keeps growing, restart Home Assistant and report it with the details below.",
          },
    );
  }

  // Sessions and feeds
  const peak = (f: (s: SoakSample) => number) => Math.max(...samples.map(f));
  lines.push(
    `WebRTC sessions: ${first.webrtc_sessions} → ${last.webrtc_sessions} (peak ${peak((s) => s.webrtc_sessions)})`,
    `MSE feeds: ${first.feeds.feeds} → ${last.feeds.feeds}, kept warm ${first.feeds.warm} → ${last.feeds.warm}, viewers ${first.feeds.viewers} → ${last.feeds.viewers} · feeds dropped ${first.feeds.ends} → ${last.feeds.ends}`,
    "Stream slots in use (the sessions to the cameras), per host:",
  );
  // Growth is judged where nobody watched (no WebRTC session, no MSE viewer):
  // only the streams kept warm hold a slot then, whichever grids were open
  // before or after. Without two such samples, the window's ends.
  const idle = samples.filter((s) => s.webrtc_sessions === 0 && s.feeds.viewers === 0);
  const idleFirst = idle.at(0);
  const idleLast = idle.at(-1);
  const byIdle = idle.length >= 2 && idleFirst !== undefined && idleLast !== undefined;
  const from = byIdle ? idleFirst : first;
  const to = byIdle ? idleLast : last;
  const slots = (sample: SoakSample, name: string) => sample.hosts.find((h) => h.name === name)?.streams ?? 0;
  const grew: string[] = [];
  const grewPlain: string[] = [];
  const compared: string[] = [];
  const over: string[] = [];
  const cpus: string[] = [];
  const cpusPlain: string[] = [];
  let busiest = 0;
  const hostNames = [...new Set(samples.flatMap((s) => s.hosts.map((h) => h.name)))];
  for (const name of hostNames) {
    const series = samples.map((s) => s.hosts.find((h) => h.name === name));
    const start = series.find((h) => h !== undefined);
    const end = series.at(-1);
    const limit = end?.limit ?? start?.limit ?? 0;
    const peakStreams = Math.max(...series.map((h) => h?.streams ?? 0));
    const peakWaiting = Math.max(...series.map((h) => h?.waiting ?? 0));
    const cpu = series.map((h) => h?.cpu).filter((c): c is number => c !== null && c !== undefined);
    lines.push(
      `  ${name}: ${series[0]?.streams ?? 0} → ${end?.streams ?? 0} of ${limit} (peak ${peakStreams}${peakWaiting ? `, up to ${peakWaiting} waiting` : ""})` +
        ` · CPU ${cpu.length ? `${cpu.at(0)}% → ${cpu.at(-1)}% (peak ${Math.max(...cpu)}%)` : "not reported"}`,
    );
    const before = slots(from, name);
    const after = slots(to, name);
    compared.push(`${name} ${before} → ${after}`);
    if (after > before) {
      grew.push(`${name} ${before} → ${after}`);
      grewPlain.push(`${name}: ${String(before)} to ${String(after)}`);
    }
    if (series.some((h) => h !== undefined && h.streams > h.limit)) over.push(name);
    if (cpu.length) {
      cpus.push(`${name} peak ${Math.max(...cpu)}%`);
      cpusPlain.push(`${name} ${String(Math.max(...cpu))}%`);
      busiest = Math.max(busiest, ...cpu);
    }
  }
  if (byIdle) {
    lines.push(
      `While nobody watched (${idle.length} samples, ${new Date(from.at).toLocaleString()} → ${new Date(to.at).toLocaleString()}): ${compared.join(", ")}`,
    );
  }
  verdicts.push(
    grew.length
      ? ["✗", byIdle ? `Camera sessions grew while nobody watched: ${grew.join(", ")}` : `Camera sessions grew: ${grew.join(", ")} (close full screen before the report)`]
      : ["✓", byIdle ? "No growth in camera sessions: while nobody watched, no host held more stream slots at the end than at the start" : "No growth in camera sessions: each host ends with no more stream slots in use than it started with"],
    over.length
      ? ["✗", `Above the stream limit: ${over.join(", ")}`]
      : ["✓", "Within the stream limits: no host above its limit"],
    ["–", `Camera CPU (Phase 0 set no CPU limit): ${cpus.length ? cpus.join(", ") : "not reported (the hosts' CPU sensors are off)"}`],
  );
  plain.push(
    grew.length
      ? {
          grade: "problem",
          text: `Connections to your cameras piled up (${grewPlain.join(", ")})${byIdle ? " while nobody was watching" : ""}.`,
          advice: "Restarting Home Assistant clears them. Please report it with the details below.",
        }
      : { grade: "good", text: "Connections to your cameras did not pile up." },
    over.length
      ? {
          grade: "problem",
          text: `${over.join(", ")} ${over.length === 1 ? "was" : "were"} asked for more video streams than ${over.length === 1 ? "it" : "they"} can serve.`,
          advice: "Keep fewer cameras warm, and close full screen on other devices.",
        }
      : { grade: "good", text: "No camera or NVR was asked for more video streams than it can serve." },
  );
  if (cpusPlain.length) {
    plain.push(
      busiest < 85
        ? {
            grade: "note",
            text: `Processor load at its highest: ${cpusPlain.join(", ")}, ${busiest < 60 ? "well within what it can handle" : "busy but coping"}.`,
          }
        : {
            grade: "slow",
            text: `Processor load at its highest: ${cpusPlain.join(", ")}, near its limit.`,
            advice: "Keep fewer cameras warm, or watch fewer of them at once.",
          },
    );
  }

  // Battery cameras
  const batteryNames = [...new Set(samples.flatMap((s) => s.battery.map((b) => b.camera)))];
  if (!batteryNames.length) {
    lines.push("Battery cameras: none on battery");
    verdicts.push(["–", "Battery cameras: none on battery"]);
  }
  for (const camera of batteryNames) {
    const states = samples.map((s) => s.battery.find((b) => b.camera === camera)).filter((b) => b !== undefined);
    const notWatched = states.filter((b) => !b.watched);
    const slept = notWatched.filter((b) => b.sleeping === true).length;
    lines.push(`Battery camera ${camera}: asleep in ${slept} of ${notWatched.length} samples while not watched`);
    verdicts.push(
      !notWatched.length
        ? ["–", `${camera}: watched in every sample`]
        : slept
          ? ["✓", `${camera} slept while not watched`]
          : ["✗", `${camera} never slept while not watched`],
    );
    plain.push(
      !notWatched.length
        ? { grade: "note", text: `${camera} was being watched the whole time, so whether it sleeps could not be checked.` }
        : slept
          ? { grade: "good", text: `${camera} slept when nobody was watching, saving its battery.` }
          : {
              grade: "problem",
              text: `${camera} stayed awake when nobody was watching, which drains its battery.`,
              advice: "Make sure nothing else streams it (another app, or a dashboard card showing it live).",
            },
    );
  }

  // Tiles
  const tiles = Object.entries(run?.tiles ?? {});
  lines.push("Tiles (plays · drops · failed starts):");
  if (!tiles.length) lines.push(run ? "  none counted yet" : "  no grid yet");
  const loops: string[] = [];
  const loopsPlain: string[] = [];
  for (const [camera, tile] of tiles) {
    lines.push(`  ${camera}: ${tile.plays} · ${tile.drops} · ${tile.failures}`);
    const restartsOf = tile.drops + tile.failures;
    if (restartsOf > Math.max(2, visibleHours)) {
      loops.push(`${camera} (${restartsOf} in ${visibleHours.toFixed(1)} h)`);
      loopsPlain.push(`${camera} (${count(restartsOf, "time")} in ${visibleHours.toFixed(1)} hours)`);
    }
  }
  if (run) {
    plain.unshift(
      loops.length
        ? {
            grade: "problem",
            text: `Live video kept dropping and reconnecting on ${loopsPlain.join(", ")}.`,
            advice: "Check those cameras' network (Wi-Fi signal or cable) and power.",
          }
        : { grade: "good", text: "Live video kept playing: no camera kept dropping and reconnecting." },
    );
  }
  verdicts.unshift(
    !run
      ? ["–", "Reconnect loops: no grid has reported yet"]
      : loops.length
        ? ["✗", `Reconnect loops: ${loops.join(", ")}`]
        : ["✓", "No reconnect loops: no tile dropped or failed to start more than once an hour"],
  );

  // How long each half ran
  const spanHours = spanMs / 3_600_000;
  verdicts.push(
    spanHours >= SERVER_HOURS
      ? ["✓", `Home Assistant ran live view ${spanHours.toFixed(1)} h (${SERVER_HOURS} needed)`]
      : ["✗", `Home Assistant's samples cover ${spanHours.toFixed(1)} h of ${SERVER_HOURS}: it has to run that long without restarting (no page needs to be open)`],
    !run
      ? ["✗", `The grid has been visible 0.0 h of ${GRID_HOURS}: no grid has reported yet`]
      : visibleHours >= GRID_HOURS
        ? ["✓", `The grid was visible ${visibleHours.toFixed(1)} h (${GRID_HOURS} needed), opened ${run.opens} time${run.opens === 1 ? "" : "s"}`]
        : ["✗", `The grid has been visible ${visibleHours.toFixed(1)} h of ${GRID_HOURS}: open it whenever it suits; the hours add up across sittings and devices`],
  );
  plain.push(
    spanHours >= SERVER_HOURS
      ? { grade: "good", text: `Home Assistant ran live view for ${spanHours.toFixed(1)} hours.` }
      : {
          grade: "pending",
          text: `Home Assistant has run live view for ${spanHours.toFixed(1)} of ${String(SERVER_HOURS)} hours.`,
          advice: "Leave Home Assistant running; no page needs to be open.",
        },
    !run
      ? { grade: "pending", text: "The live board has not been on screen yet.", advice: OPEN_LIVE }
      : visibleHours >= GRID_HOURS
        ? { grade: "good", text: `The live board was on screen for ${visibleHours.toFixed(1)} hours, opened ${count(run.opens, "time")}.` }
        : {
            grade: "pending",
            text: `The live board has been on screen for ${visibleHours.toFixed(1)} of ${String(GRID_HOURS)} hours.`,
            advice: OPEN_LIVE,
          },
  );
  // Sampling started after the run did: Home Assistant (or Reolink Viewer) started again.
  if (run && input.startedAt !== null && input.startedAt > run.started_at + sampleMs) {
    verdicts.push(["–", `Home Assistant started again at ${new Date(input.startedAt).toLocaleString()}, after the soak began: its samples start then; the grid's hours carry on`]);
    plain.push({
      grade: "note",
      text: `Home Assistant restarted at ${new Date(input.startedAt).toLocaleString()}, after the test began: its hours count from then. The live board's hours carry on.`,
    });
  }
  const expected = Math.floor(spanMs / sampleMs) + 1;
  if (samples.length < 0.9 * expected) {
    verdicts.push(["⚠", `${samples.length} samples of about ${expected} in ${spanHours.toFixed(1)} h: sampling stopped for a while`]);
    plain.push({
      grade: "note",
      text: `Some measurements are missing (${String(samples.length)} of about ${String(expected)}): Home Assistant was busy or stopped for a while.`,
    });
  }

  const failed = verdicts.filter(([mark]) => mark === "✗").length;
  const problems = plain.filter((f) => f.grade === "problem").length;
  const pending = plain.some((f) => f.grade === "pending");
  const headline = problems
    ? `${count(problems, "problem")} found${pending ? " so far" : ""}.`
    : pending
      ? "Running: nothing wrong so far."
      : "Passed: live view held up for the whole test.";
  const inShort = { headline, findings: plain };
  lines.push("", ...inShortLines(inShort));
  lines.push("", "Verdict:", ...verdicts.map(([mark, text]) => `${mark} ${text}`));
  lines.push("", failed ? `Not passed: ${failed} ${failed === 1 ? "criterion" : "criteria"} not met.` : "Passed.");
  return { text: lines.join("\n"), inShort };
}

function hours(ms: number): string {
  return (Math.max(0, ms) / 3_600_000).toFixed(1);
}

function mb(kb: number): string {
  return (kb / 1024).toFixed(1);
}

/** "now", "12 min ago", "3.2 h ago". */
function ago(ms: number): string {
  const minutes = Math.max(0, ms) / 60_000;
  if (minutes < 1) return "now";
  return minutes < 60 ? `${Math.floor(minutes)} min ago` : `${(minutes / 60).toFixed(1)} h ago`;
}

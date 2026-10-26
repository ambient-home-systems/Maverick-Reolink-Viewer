// The soak report (Phase 3's exit criteria, as the owner set them on
// 2026-10-26): Home Assistant runs live view for SERVER_HOURS, and the grid is
// visible for GRID_HOURS in all, in as many sittings and on as many devices as
// suits. Throughout: no reconnect loops, no growth in the sessions to the
// cameras, the cameras within their limits, battery cameras asleep when nobody
// watches them. It reads the soak run the server keeps (what the grids
// counted, sent every SOAK_REPORT_MS) and the server's samples (every 5
// minutes) since the run started, or every sample kept before a grid has
// reported, and says, for each criterion, whether it held. Any device can
// read it.
import type { SoakRun, SoakSample } from "../types";

export interface SoakInput {
  version: string;
  /** Epoch ms. */
  now: number;
  /** The server's sampling interval (s), and how long it keeps samples (s). */
  sampleS: number;
  keepS: number;
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

/** The report as text: what was measured, then a verdict per criterion. */
export function soakReport(input: SoakInput): string {
  const { samples, run } = input;
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
    lines.push("No grid has reported yet: open Reolink → Watch live and leave it showing; its hours add up.");
  }
  const first = samples.at(0);
  const last = samples.at(-1);
  if (!first || !last) {
    lines.push("", "No server samples: is Reolink Viewer loaded?");
    return lines.join("\n");
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
  const firstMemory = memories.at(0);
  const lastMemory = memories.at(-1);
  if (firstMemory !== undefined && lastMemory !== undefined) {
    verdicts.push(
      lastMemory <= firstMemory * 2
        ? ["✓", `go2rtc's memory steady: ${mb(firstMemory)} → ${mb(lastMemory)} MB`]
        : ["⚠", `go2rtc's memory grew: ${mb(firstMemory)} → ${mb(lastMemory)} MB`],
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
  const compared: string[] = [];
  const over: string[] = [];
  const cpus: string[] = [];
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
    if (after > before) grew.push(`${name} ${before} → ${after}`);
    if (series.some((h) => h !== undefined && h.streams > h.limit)) over.push(name);
    if (cpu.length) cpus.push(`${name} peak ${Math.max(...cpu)}%`);
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
  }

  // Tiles
  const tiles = Object.entries(run?.tiles ?? {});
  lines.push("Tiles (plays · drops · failed starts):");
  if (!tiles.length) lines.push(run ? "  none counted yet" : "  no grid yet");
  const loops: string[] = [];
  for (const [camera, tile] of tiles) {
    lines.push(`  ${camera}: ${tile.plays} · ${tile.drops} · ${tile.failures}`);
    const restartsOf = tile.drops + tile.failures;
    if (restartsOf > Math.max(2, visibleHours)) loops.push(`${camera} (${restartsOf} in ${visibleHours.toFixed(1)} h)`);
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
  // The samples start after the run did, and not because only the last keepS are kept.
  if (run && first.at > run.started_at + 2 * sampleMs && first.at > input.now - input.keepS * 1000 + 2 * sampleMs) {
    verdicts.push(["–", `Home Assistant started again at ${new Date(first.at).toLocaleString()}, after the soak began: its samples start then; the grid's hours carry on`]);
  }
  const expected = Math.floor(spanMs / sampleMs) + 1;
  if (samples.length < 0.9 * expected) {
    verdicts.push(["⚠", `${samples.length} samples of about ${expected} in ${spanHours.toFixed(1)} h: sampling stopped for a while`]);
  }

  const failed = verdicts.filter(([mark]) => mark === "✗").length;
  lines.push("", "Verdict:", ...verdicts.map(([mark, text]) => `${mark} ${text}`));
  lines.push("", failed ? `Not passed: ${failed} ${failed === 1 ? "criterion" : "criteria"} not met.` : "Passed.");
  return lines.join("\n");
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

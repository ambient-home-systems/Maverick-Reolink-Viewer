// The soak report (Phase 3's exit criteria): with the grid open for 24 hours,
// no reconnect loops, no growth in the sessions to the cameras, the cameras
// within their limits, battery cameras asleep when nobody watches them. It
// reads the soak run the server keeps (what the grids counted, sent every
// SOAK_REPORT_MS) and the server's samples (every 5 minutes) since the run
// started, and says, for each criterion, whether it held. The run outlives
// the page, so any device can read the report.
import type { SoakRun, SoakSample } from "../types";

export interface SoakInput {
  version: string;
  /** Epoch ms. */
  now: number;
  /** The server's sampling interval (s), and how long it keeps samples (s). */
  sampleS: number;
  keepS: number;
  run: SoakRun;
  /** The server's samples since the run started, the last one taken now. */
  samples: SoakSample[];
}

/** The soak's length for the exit criterion, counted while the grid is visible (tiles pause while it is hidden). */
export const SOAK_HOURS = 24;
/** How often an open grid reports what it counted. */
export const SOAK_REPORT_MS = 60_000;
/** A grid that has not reported for this long is closed, or its page hidden. */
const SILENT_MS = 3 * SOAK_REPORT_MS;

type Mark = "✓" | "✗" | "⚠" | "–";

/** The report as text: what was measured, then a verdict per criterion. */
export function soakReport(input: SoakInput): string {
  const { samples, run } = input;
  const elapsedMs = Math.max(0, input.now - run.started_at);
  const hours = elapsedMs / 3_600_000;
  // Tiles play only while the page is visible: the soak counts that time.
  const visibleHours = Math.min(run.visible_ms, elapsedMs) / 3_600_000;
  const devices = Object.entries(run.devices).sort(([, a], [, b]) => b - a);
  const lastReport = devices.at(0)?.[1];
  const lines: string[] = [
    `Reolink Viewer soak report v${input.version} · ${new Date(input.now).toLocaleString()}`,
    `Soak started ${new Date(run.started_at).toLocaleString()} (${hours.toFixed(1)} h ago) · grid open ${(run.open_ms / 3_600_000).toFixed(1)} h, visible ${visibleHours.toFixed(1)} h · opened ${run.opens} time${run.opens === 1 ? "" : "s"}`,
    `Reported by: ${devices.length ? devices.map(([device, at]) => `${device} (${ago(input.now - at)})`).join(", ") : "no grid yet"}`,
    `Server samples: ${samples.length} (every ${Math.round(input.sampleS / 60)} min; the last ${Math.round(input.keepS / 3600)} h are kept)`,
    "",
  ];
  const verdicts: [Mark, string][] = [];
  const first = samples.at(0);
  const last = samples.at(-1);
  if (!first || !last) {
    lines.push("No server samples: is Reolink Viewer loaded?");
    return lines.join("\n");
  }

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
  const grew: string[] = [];
  const over: string[] = [];
  const cpus: string[] = [];
  const hostNames = [...new Set(samples.flatMap((s) => s.hosts.map((h) => h.name)))];
  for (const name of hostNames) {
    const series = samples.map((s) => s.hosts.find((h) => h.name === name));
    const start = series.find((h) => h !== undefined);
    const end = series.at(-1);
    const startStreams = series[0]?.streams ?? 0;
    const endStreams = end?.streams ?? 0;
    const limit = end?.limit ?? start?.limit ?? 0;
    const peakStreams = Math.max(...series.map((h) => h?.streams ?? 0));
    const peakWaiting = Math.max(...series.map((h) => h?.waiting ?? 0));
    const cpu = series.map((h) => h?.cpu).filter((c): c is number => c !== null && c !== undefined);
    lines.push(
      `  ${name}: ${startStreams} → ${endStreams} of ${limit} (peak ${peakStreams}${peakWaiting ? `, up to ${peakWaiting} waiting` : ""})` +
        ` · CPU ${cpu.length ? `${cpu.at(0)}% → ${cpu.at(-1)}% (peak ${Math.max(...cpu)}%)` : "not reported"}`,
    );
    if (endStreams > startStreams) grew.push(`${name} ${startStreams} → ${endStreams}`);
    if (series.some((h) => h !== undefined && h.streams > h.limit)) over.push(name);
    if (cpu.length) cpus.push(`${name} peak ${Math.max(...cpu)}%`);
  }
  verdicts.push(
    grew.length
      ? ["✗", `Camera sessions grew: ${grew.join(", ")} (close full screen before the report)`]
      : ["✓", "No growth in camera sessions: each host ends with no more stream slots in use than it started with"],
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
    const idle = states.filter((b) => !b.watched);
    const slept = idle.filter((b) => b.sleeping === true).length;
    lines.push(`Battery camera ${camera}: asleep in ${slept} of ${idle.length} samples while not watched`);
    verdicts.push(
      !idle.length
        ? ["–", `${camera}: watched in every sample`]
        : slept
          ? ["✓", `${camera} slept while not watched`]
          : ["✗", `${camera} never slept while not watched`],
    );
  }

  // Tiles
  lines.push("Tiles (plays · drops · failed starts):");
  const loops: string[] = [];
  const tiles = Object.entries(run.tiles);
  if (!tiles.length) lines.push("  none counted yet");
  for (const [camera, tile] of tiles) {
    lines.push(`  ${camera}: ${tile.plays} · ${tile.drops} · ${tile.failures}`);
    const restartsOf = tile.drops + tile.failures;
    if (restartsOf > Math.max(2, visibleHours)) loops.push(`${camera} (${restartsOf} in ${visibleHours.toFixed(1)} h)`);
  }
  verdicts.unshift(
    loops.length
      ? ["✗", `Reconnect loops: ${loops.join(", ")}`]
      : ["✓", "No reconnect loops: no tile dropped or failed to start more than once an hour"],
  );

  // Coverage
  verdicts.push(
    visibleHours >= SOAK_HOURS
      ? ["✓", `Live ${visibleHours.toFixed(1)} h: the grid was visible ${visibleHours.toFixed(1)} h of the ${hours.toFixed(1)} h since the soak started`]
      : ["✗", `Not ${SOAK_HOURS} h live yet: the grid has been visible ${visibleHours.toFixed(1)} h of the ${hours.toFixed(1)} h since the soak started (tiles pause while the page is hidden)`],
  );
  if (run.opens > 1) {
    verdicts.push(["⚠", `The grid opened ${run.opens} times: its page reloaded, or Home Assistant unloaded it after 5 minutes hidden (its tiles started again)`]);
  }
  if (lastReport === undefined || input.now - lastReport > SILENT_MS) {
    verdicts.push(["⚠", `No grid has reported for ${lastReport === undefined ? "the whole soak" : ago(input.now - lastReport).replace(" ago", "")}: is the grid open, and its page showing?`]);
  }
  const expected = Math.floor(Math.min(hours * 3600, input.keepS) / input.sampleS);
  if (samples.length < 0.9 * expected) {
    verdicts.push(["⚠", `${samples.length} server samples of about ${expected}: was sampling stopped?`]);
  }

  const failed = verdicts.filter(([mark]) => mark === "✗").length;
  lines.push("", "Verdict:", ...verdicts.map(([mark, text]) => `${mark} ${text}`));
  lines.push("", failed ? `Not passed: ${failed} ${failed === 1 ? "criterion" : "criteria"} not met.` : "Passed.");
  return lines.join("\n");
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

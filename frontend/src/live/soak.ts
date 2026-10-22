// The soak report (Phase 3's exit criteria): with the grid open for 24 hours,
// no reconnect loops, no growth in the sessions to the cameras, the cameras
// within their limits, battery cameras asleep when nobody watches them. It
// reads the server's samples (live/soak, every 5 minutes) since the grid
// opened, and what each tile counted, and says, for each criterion, whether
// it held.
import type { SoakSample } from "../types";

/** What a tile counted since the grid opened. */
export interface TileCounts {
  camera: string;
  /** Streams that reached their first frame. */
  plays: number;
  /** Streams that ended after playing. */
  drops: number;
  /** Starts that failed. */
  failures: number;
}

export interface SoakInput {
  version: string;
  /** When the grid opened, and now (epoch ms). */
  openedAt: number;
  now: number;
  /** How long the page was visible since it opened (tiles pause while hidden). */
  visibleMs: number;
  /** The server's sampling interval (s). */
  sampleS: number;
  /** The server's samples since the grid opened, the last one taken now. */
  samples: SoakSample[];
  tiles: TileCounts[];
}

/** The soak's length for the exit criterion. */
export const SOAK_HOURS = 24;

type Mark = "✓" | "✗" | "⚠" | "–";

/** The report as text: what was measured, then a verdict per criterion. */
export function soakReport(input: SoakInput): string {
  const { samples, tiles } = input;
  const hours = Math.max(0, input.now - input.openedAt) / 3_600_000;
  const lines: string[] = [
    `Reolink Viewer soak report v${input.version} · ${new Date(input.now).toLocaleString()}`,
    `Grid open ${hours.toFixed(1)} h (since ${new Date(input.openedAt).toLocaleString()}), page visible ${percent(input.visibleMs, input.now - input.openedAt)}`,
    `Server samples: ${samples.length} (every ${Math.round(input.sampleS / 60)} min)`,
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
  for (const tile of tiles) {
    lines.push(`  ${tile.camera}: ${tile.plays} · ${tile.drops} · ${tile.failures}`);
    const restartsOf = tile.drops + tile.failures;
    if (restartsOf > Math.max(2, hours)) loops.push(`${tile.camera} (${restartsOf} in ${hours.toFixed(1)} h)`);
  }
  verdicts.unshift(
    loops.length
      ? ["✗", `Reconnect loops: ${loops.join(", ")}`]
      : ["✓", "No reconnect loops: no tile dropped or failed to start more than once an hour"],
  );

  // Coverage
  const expected = Math.floor((hours * 3600) / input.sampleS);
  verdicts.push(
    hours >= SOAK_HOURS ? ["✓", `Ran ${hours.toFixed(1)} h`] : ["✗", `Not ${SOAK_HOURS} h yet: the grid has been open ${hours.toFixed(1)} h`],
    input.visibleMs >= 0.95 * (input.now - input.openedAt)
      ? ["✓", `The page was visible ${percent(input.visibleMs, input.now - input.openedAt)} of the time`]
      : ["⚠", `The page was visible only ${percent(input.visibleMs, input.now - input.openedAt)} of the time: tiles pause while it is hidden`],
  );
  if (samples.length < 0.9 * expected) {
    verdicts.push(["⚠", `${samples.length} server samples of about ${expected}: Home Assistant may have restarted`]);
  }

  const failed = verdicts.filter(([mark]) => mark === "✗").length;
  lines.push("", "Verdict:", ...verdicts.map(([mark, text]) => `${mark} ${text}`));
  lines.push("", failed ? `Not passed: ${failed} ${failed === 1 ? "criterion" : "criteria"} not met.` : "Passed.");
  return lines.join("\n");
}

function mb(kb: number): string {
  return (kb / 1024).toFixed(1);
}

function percent(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((100 * part) / whole)}%` : "100%";
}

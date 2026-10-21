// Pure helpers of the live check (live/check.ts): codecs to ask go2rtc for,
// ICE servers and candidate pairs described without addresses, and the
// report's arithmetic.
import type { CapacityReport, IceServer, LiveCacheState, StreamEncoding } from "../types";

/** The codecs go2rtc may send over MSE, if the browser takes them. */
export const MSE_CODECS = [
  "avc1.640029",
  "avc1.64002A",
  "avc1.640033",
  "hvc1.1.6.L153.B0",
  "mp4a.40.2",
  "mp4a.40.5",
  "flac",
  "opus",
] as const;

/** go2rtc's MSE request: the codecs this browser's MSE accepts, comma-separated. */
export function mseCodecs(isTypeSupported: (type: string) => boolean): string {
  return MSE_CODECS.filter((codec) => isTypeSupported(`video/mp4; codecs="${codec}"`)).join(",");
}

/** "2 STUN, 1 TURN (Nabu Casa)": kinds and providers, never addresses or credentials. */
export function describeIceServers(servers: readonly IceServer[]): string {
  let stun = 0;
  let turn = 0;
  let nabuCasa = false;
  for (const server of servers) {
    for (const url of Array.isArray(server.urls) ? server.urls : [server.urls]) {
      if (/^turns?:/i.test(url)) turn += 1;
      else if (/^stun:/i.test(url)) stun += 1;
      if (/nabucasa|nabu\.casa/i.test(url)) nabuCasa = true;
    }
  }
  const parts = [`${stun} STUN`, `${turn} TURN${nabuCasa && turn ? " (Nabu Casa)" : ""}`];
  return parts.join(", ");
}

/** HA's ICE servers in the form RTCPeerConnection takes. */
export function rtcIceServers(servers: readonly IceServer[]): RTCIceServer[] {
  return servers.map((server) => ({
    urls: server.urls,
    ...(server.username ? { username: server.username } : {}),
    ...(server.credential ? { credential: server.credential } : {}),
  }));
}

export interface PairInfo {
  /** e.g. "host/udp", "relay/udp (TURN over tcp)". */
  local?: string;
  remote?: string;
  rttMs?: number;
  codec?: string;
  width?: number;
  height?: number;
  framesDecoded?: number;
}

/** The selected candidate pair and the video track's codec, from getStats(). */
export function pairInfo(stats: RTCStatsReport): PairInfo {
  const all = new Map<string, Record<string, unknown>>();
  stats.forEach((value: Record<string, unknown>) => {
    all.set(String(value.id), value);
  });
  let pair: Record<string, unknown> | undefined;
  for (const value of all.values()) {
    if (value.type === "transport" && typeof value.selectedCandidatePairId === "string") {
      pair = all.get(value.selectedCandidatePairId);
    }
  }
  pair ??= [...all.values()].find((v) => v.type === "candidate-pair" && v.nominated && v.state === "succeeded");
  const info: PairInfo = {};
  const describe = (id: unknown): string | undefined => {
    const candidate = all.get(String(id));
    if (!candidate) return undefined;
    const type = typeof candidate.candidateType === "string" ? candidate.candidateType : "?";
    const protocol = typeof candidate.protocol === "string" ? candidate.protocol : "?";
    const relay = typeof candidate.relayProtocol === "string" ? ` (TURN over ${candidate.relayProtocol})` : "";
    return `${type}/${protocol}${relay}`;
  };
  if (pair) {
    const local = describe(pair.localCandidateId);
    const remote = describe(pair.remoteCandidateId);
    if (local) info.local = local;
    if (remote) info.remote = remote;
    if (typeof pair.currentRoundTripTime === "number") info.rttMs = Math.round(pair.currentRoundTripTime * 1000);
  }
  for (const value of all.values()) {
    if (value.type === "inbound-rtp" && value.kind === "video") {
      const codec = all.get(String(value.codecId));
      if (codec && typeof codec.mimeType === "string") info.codec = codec.mimeType.replace(/^video\//, "").toLowerCase();
      if (typeof value.frameWidth === "number") info.width = value.frameWidth;
      if (typeof value.frameHeight === "number") info.height = value.frameHeight;
      if (typeof value.framesDecoded === "number") info.framesDecoded = value.framesDecoded;
    }
  }
  return info;
}

/** "1.23 s" (or "–"). */
export function seconds(ms: number | undefined): string {
  return ms === undefined ? "–" : `${(ms / 1000).toFixed(2)} s`;
}

export function median(values: readonly number[]): number | undefined {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

/** "; key frames every 4.00 s; parameter sets: same; feed ended 1× (why)" (what is known). */
export function cacheLabel(cache: LiveCacheState | null | undefined): string {
  if (!cache) return "";
  const parts = [
    cache.key_interval_ms !== null ? `key frames every ${seconds(cache.key_interval_ms)}` : undefined,
    cache.parameter_sets !== null ? `parameter sets: ${cache.parameter_sets}` : undefined,
    cache.ends ? `feed ended ${String(cache.ends)}× (${cache.last_end ?? "?"})` : undefined,
  ].filter(Boolean);
  return parts.length ? `; ${parts.join("; ")}` : "";
}

/** "sub (h264, 15 fps, 512 kbps)". */
export function streamLabel(kind: string, encoding: StreamEncoding | null | undefined): string {
  if (!encoding) return kind;
  const parts = [
    encoding.codec,
    encoding.frame_rate ? `${encoding.frame_rate} fps` : undefined,
    encoding.bit_rate ? `${encoding.bit_rate} kbps` : undefined,
  ].filter(Boolean);
  return parts.length ? `${kind} (${parts.join(", ")})` : kind;
}

/** The capacity test's report as lines. */
export function capacityLines(report: CapacityReport): string[] {
  const lines: string[] = [];
  const fill = typeof report.fill === "string" ? report.fill : report.fill ? `ch${report.fill.channel + 1}, ${Math.round(report.fill.duration_s / 60)} min recording` : "not run";
  lines.push(`  logged-in clients (GetOnline) before: ${report.online_users_before}, after: ${report.online_users_after}`);
  lines.push(
    `  download: ${fill}${report.fill_alone_mbit_s != null ? `, alone ${report.fill_alone_mbit_s} Mbit/s` : ""}`,
  );
  for (const level of report.levels) {
    const first = level.first_frame_s != null ? `, first frame ${level.first_frame_s} s` : "";
    const fillPart = level.fill
      ? `, download ${level.fill.mbit_s ?? "?"} Mbit/s${level.fill.error ? ` (${level.fill.error})` : ""}`
      : "";
    const streams = level.streams
      .map((s) => {
        const pace = s.expected_fps ? `${s.fps}/${s.expected_fps}` : `${s.fps}`;
        const gap = s.longest_gap_s > 1 ? ` gap ${s.longest_gap_s} s` : "";
        return `${s.stream} ${pace} fps${gap}${s.error ? ` (${s.error})` : ""}`;
      })
      .join("; ");
    const users = level.online_users != null ? ` · clients ${level.online_users}` : "";
    lines.push(`  L${level.level} + ${level.added}${first}${fillPart}${users}: ${streams}`);
  }
  const verdict = report.verdict;
  lines.push(
    verdict.first_failing_level === null
      ? "  verdict: every level kept up"
      : `  verdict: level ${verdict.first_failing_level} fails or slows down: ${verdict.reasons.join("; ")}`,
  );
  return lines;
}

/** The websocket URL of a path on this page's server. */
export function wsUrl(path: string, base: string): string {
  const url = new URL(path, base);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

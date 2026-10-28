// A tile's debug view as text: what it plays and how, what the server holds
// for it, and what its players did. Shown over the tile and copied as is.
import type { LiveConnection, LiveStreamKind, LiveStreamState } from "../types";
import type { PlayerEvent, PlayerState } from "./player";

export interface DebugPlayer {
  /** "SD" (the tile's stream) or "HD" (full screen). */
  label: string;
  stream: LiveStreamKind;
  warm: boolean;
  state: PlayerState;
  events: readonly PlayerEvent[];
}

export interface TileDebug {
  camera: string;
  connection: LiveConnection | undefined;
  players: DebugPlayer[];
  /** Why full screen plays what it plays (once chosen). */
  hd?: string | undefined;
  /** This page starts over WebRTC first until then (epoch ms): its network cut MSE. */
  webRtcFirstUntil?: number | undefined;
  /** MSE goes first until then (epoch ms): WebRTC does not connect from this device. */
  mseFirstUntil?: number | undefined;
}

/** Per player label: its stream's server state, or why it could not be read. */
export type DebugStates = Record<string, LiveStreamState | string | undefined>;

const seconds = (ms: number) => `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 0)} s`;

/** The debug view's lines. */
export function debugText(info: TileDebug, states: DebugStates, now: number = Date.now()): string {
  const c = info.connection;
  const lines = [
    `${info.camera}${c ? ` · ${c.via === "nvr" ? "through the NVR" : "direct"} (${c.entry_title})${c.is_battery ? " · on battery" : ""}` : ""}`,
  ];
  for (const player of info.players) {
    lines.push(`${player.label} (${player.stream}, ${player.warm ? "kept warm" : "cold"}): ${stateLine(player.state, now)}`);
    if (player.state.kind === "playing") {
      const pair = player.state.result.pair;
      if (pair?.local) {
        lines.push(`  path: ${pair.local} ↔ ${pair.remote ?? "?"}${pair.rttMs !== undefined ? `, rtt ${pair.rttMs} ms` : ""}`);
      }
    }
    lines.push(`  server: ${serverLine(states[player.label])}`);
  }
  if (info.hd) lines.push(`HD choice: ${info.hd}`);
  if (info.webRtcFirstUntil !== undefined && info.webRtcFirstUntil > now) {
    lines.push(`Network: it cut MSE's connections twice, so WebRTC goes first until ${clock(info.webRtcFirstUntil)}`);
  }
  if (info.mseFirstUntil !== undefined && info.mseFirstUntil > now) {
    lines.push(`Network: WebRTC does not connect from here, so MSE goes first until ${day(info.mseFirstUntil)}`);
  }
  for (const player of info.players) {
    if (!player.events.length) continue;
    lines.push(`Events (${player.label}):`);
    for (const event of player.events) lines.push(`  ${clock(event.at)} ${event.text}`);
  }
  return lines.join("\n");
}

function stateLine(state: PlayerState, now: number): string {
  switch (state.kind) {
    case "idle":
      return "stopped";
    case "starting":
      return `starting over ${state.transport}`;
    case "waiting":
      return `${state.error}; next try in ${seconds(Math.max(0, state.retryAt - now))}`;
    case "playing": {
      const r = state.result;
      const width = r.width ?? r.pair?.width;
      const height = r.height ?? r.pair?.height;
      const codec = r.pair?.codec ?? /codecs="?([^"]+)/.exec(r.mse?.mime ?? "")?.[1];
      return [
        `playing over ${state.transport}`,
        r.firstFrameMs !== undefined ? `first frame in ${seconds(r.firstFrameMs)}` : undefined,
        width && height ? `${width}×${height}` : undefined,
        codec,
      ]
        .filter((part) => part !== undefined)
        .join(" · ");
    }
  }
}

function serverLine(state: LiveStreamState | string | undefined): string {
  if (state === undefined) return "…";
  if (typeof state === "string") return `cannot read: ${state}`;
  const parts = [
    state.state
      ? `go2rtc ${state.state.active ? "streaming" : "idle"}, ${state.state.consumers} consumer${state.state.consumers === 1 ? "" : "s"}`
      : "not in go2rtc",
    `held ${state.holds}×`,
  ];
  const cache = state.cache;
  if (cache) {
    parts.push(
      `${cache.warm ? "warm feed" : "feed"} ${seconds(cache.age_ms)} old, ${cache.viewers} viewer${cache.viewers === 1 ? "" : "s"}`,
    );
    if (cache.key_frame_age_ms !== null) {
      parts.push(
        `key frame ${seconds(cache.key_frame_age_ms)} ago${cache.key_interval_ms !== null ? `, every ${seconds(cache.key_interval_ms)}` : ""}`,
      );
    }
    if (cache.parameter_sets) parts.push(`parameter sets ${cache.parameter_sets}`);
    if (cache.ends) parts.push(`${cache.ends} feed${cache.ends === 1 ? "" : "s"} dropped (last: ${cache.last_end ?? "?"})`);
  } else {
    parts.push("no MSE feed");
  }
  return parts.join(", ");
}

function clock(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/** A time days away: "Wed 13:15". */
function day(at: number): string {
  return new Date(at).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" });
}

import { describe, expect, it } from "vitest";

import type { LiveConnection, LiveStreamState } from "../types";
import { debugText, type TileDebug } from "./debug";

const NVR: LiveConnection = {
  connection_id: "nvr1",
  via: "nvr",
  entry_title: "RLN36",
  is_battery: false,
  streams: {},
};
const AT = new Date(2026, 9, 22, 14, 5, 7).getTime();
const clock = new Date(AT).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

const SERVER: LiveStreamState = {
  state: { active: true, bytes: 1, producers: 1, consumers: 2 },
  holds: 1,
  preloaded: true,
  cache: {
    viewers: 1,
    warm: true,
    mime: 'video/mp4; codecs="avc1.640029"',
    key_frame_age_ms: 1200,
    key_interval_ms: 4000,
    cached_ms: 1200,
    cached_bytes: 1,
    parameter_sets: "same",
    frame_order: null,
    age_ms: 720_000,
    ends: 1,
    last_end: "EOF",
  },
};

describe("debugText", () => {
  it("says what each player plays, how, and what the server holds", () => {
    const info: TileDebug = {
      camera: "Garage",
      connection: NVR,
      hd: "main: H.265 at 3840×2160, smooth here",
      players: [
        {
          label: "SD",
          stream: "sub",
          warm: true,
          state: {
            kind: "playing",
            transport: "MSE",
            result: {
              ok: true,
              firstFrameMs: 310,
              steps: {},
              mse: { api: "MediaSource", mime: 'video/mp4; codecs="avc1.640029"' },
              width: 640,
              height: 360,
            },
          },
          events: [{ at: AT, text: "MSE: playing, first frame in 0.31 s" }],
        },
        {
          label: "HD",
          stream: "main",
          warm: false,
          state: {
            kind: "playing",
            transport: "WebRTC",
            result: {
              ok: true,
              firstFrameMs: 1900,
              steps: {},
              pair: { local: "host/udp", remote: "host/udp", rttMs: 3, codec: "H265", width: 3840, height: 2160 },
            },
          },
          events: [],
        },
      ],
    };
    expect(debugText(info, { SD: SERVER, HD: "not loaded" }, AT).split("\n")).toEqual([
      "Garage · through the NVR (RLN36)",
      "SD (sub, kept warm): playing over MSE · first frame in 0.31 s · 640×360 · avc1.640029",
      "  server: go2rtc streaming, 2 consumers, held 1×, warm feed 720 s old, 1 viewer, key frame 1.20 s ago, every 4.00 s, parameter sets same, 1 feed dropped (last: EOF)",
      "HD (main, cold): playing over WebRTC · first frame in 1.90 s · 3840×2160 · H265",
      "  path: host/udp ↔ host/udp, rtt 3 ms",
      "  server: cannot read: not loaded",
      "HD choice: main: H.265 at 3840×2160, smooth here",
      "Events (SD):",
      `  ${clock} MSE: playing, first frame in 0.31 s`,
    ]);
  });

  it("says why a stream waits, and what is not known yet", () => {
    const info: TileDebug = {
      camera: "Doorbell",
      connection: { ...NVR, via: "direct", entry_title: "Doorbell", is_battery: true },
      players: [
        {
          label: "SD",
          stream: "sub",
          warm: false,
          state: { kind: "waiting", error: "WebRTC: ICE failed", retryAt: AT + 5000 },
          events: [],
        },
      ],
    };
    const idle: LiveStreamState = { state: null, holds: 0, preloaded: false, cache: null };
    expect(debugText(info, {}, AT)).toBe(
      "Doorbell · direct (Doorbell) · on battery\n" +
        "SD (sub, cold): WebRTC: ICE failed; next try in 5.00 s\n" +
        "  server: …",
    );
    expect(debugText(info, { SD: idle }, AT)).toContain("server: not in go2rtc, held 0×, no MSE feed");
    const player = { label: "SD", stream: "sub" as const, warm: false, events: [] };
    info.players = [{ ...player, state: { kind: "starting", transport: "MSE" } }];
    expect(debugText(info, {}, AT)).toContain("SD (sub, cold): starting over MSE");
    info.players = [{ ...player, state: { kind: "idle" } }];
    expect(debugText(info, {}, AT)).toContain("SD (sub, cold): stopped");
  });
});

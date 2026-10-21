import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CapacityEvent, HomeAssistant, LiveCamera } from "../types";
import type { SessionResult } from "./session";

// Sessions that play at once (the browser parts are tested in session.test.ts).
const plays: { kind: string; ref: unknown; timeout: number }[] = [];
const outcome = new Map<string, Partial<SessionResult>>();

vi.mock("./session", () => {
  class Fake {
    readonly done: Promise<SessionResult>;
    constructor(kind: string, ref: unknown, timeout: number) {
      plays.push({ kind, ref, timeout });
      const key = `${kind}:${(ref as { stream?: string }).stream ?? String(ref)}`;
      this.done = Promise.resolve({
        ok: true,
        firstFrameMs: kind === "stock" ? 3000 : 800,
        steps: { answer: 100, connected: 200 },
        pair: { local: "host/udp", remote: "host/udp" },
        width: 640,
        height: 360,
        ...outcome.get(key),
      } as SessionResult);
    }
    close(): void {
      return undefined;
    }
  }
  return {
    OurWebRtc: class extends Fake {
      constructor(_h: unknown, _v: unknown, ref: unknown, _ice: unknown, timeout: number) {
        super("webrtc", ref, timeout);
      }
    },
    OurMse: class extends Fake {
      constructor(_h: unknown, _v: unknown, ref: unknown, timeout: number) {
        super("mse", ref, timeout);
      }
    },
    StockWebRtc: class extends Fake {
      constructor(_h: unknown, _v: unknown, entity: string, timeout: number) {
        super("stock", entity, timeout);
      }
    },
  };
});

const { LiveCheck, LIVE_REPORT_PREFIX, describe: describeResult } = await import("./check");

const CAMERAS: LiveCamera[] = [
  {
    id: "cam1",
    name: "Front Yard Right",
    model: "CX410",
    records: true,
    connections: [
      {
        connection_id: "c-nvr",
        via: "nvr",
        entry_title: "RLN36",
        is_battery: false,
        streams: {
          sub: { encoding: { codec: "h264", frame_rate: 15, bit_rate: 512 }, entity_id: "camera.fyr_fluent" },
          main: { encoding: { codec: "h264", frame_rate: 30, bit_rate: 5120 }, entity_id: null },
          ext: { encoding: null, entity_id: null },
        },
      },
      {
        connection_id: "c-direct",
        via: "direct",
        entry_title: "CX410",
        is_battery: false,
        streams: {
          sub: { encoding: null, entity_id: null },
          main: { encoding: null, entity_id: null },
          ext: { encoding: null, entity_id: null },
        },
      },
    ],
  },
  {
    id: "cam2",
    name: "Doorbell",
    model: "Video Doorbell",
    records: true,
    connections: [
      {
        connection_id: "c-bell",
        via: "nvr",
        entry_title: "RLN36",
        is_battery: true,
        // Baichuan only: no HTTP-FLV, so no ext.
        streams: {
          sub: { encoding: null, entity_id: null },
          main: { encoding: null, entity_id: null },
        },
      },
    ],
  },
];

function fakeHass(admin: boolean) {
  const calls: Record<string, unknown>[] = [];
  const saved: { setup: string; text: string; done: boolean }[] = [];
  const hass = {
    user: { is_admin: admin },
    states: {
      "camera.fyr_fluent": { attributes: { entity_picture: "/api/camera_proxy/camera.fyr_fluent?token=t" } },
    },
    callWS: vi.fn((message: Record<string, unknown>) => {
      calls.push(message);
      switch (message.type) {
        case "web_rtc/ice_servers":
          return Promise.resolve([{ urls: ["stun:stun.home-assistant.io:3478"] }]);
        case "reolink_viewer/live/status":
          return Promise.resolve({
            go2rtc: {
              state: "running",
              version: "1.9.14",
              binary: "system",
              error: null,
              restarts: 0,
              webrtc_port: 18556,
              log: ["WRN [rtsp] error=EOF url=<url>"],
            },
            running: {},
            preloaded: [],
            sessions: 0,
          });
        case "reolink_viewer/live/cameras":
          return Promise.resolve({ cameras: CAMERAS });
        case "reolink_viewer/live/state":
          return Promise.resolve({
            state: { active: false },
            holds: 0,
            preloaded: false,
            cache: {
              viewers: 0,
              warm: true,
              mime: 'video/mp4; codecs="avc1.640029"',
              key_frame_age_ms: 900,
              key_interval_ms: 4000,
              cached_ms: 900,
              cached_bytes: 51200,
              parameter_sets: "rebuilt",
              ends: 1,
              last_end: "go2rtc closed the stream",
            },
          });
        case "reolink_viewer/live/preload":
          return Promise.resolve({ preloaded: [], key_frame: message.enabled === true });
        case "reolink_viewer/live/frame":
          return Promise.resolve({ path: "/api/reolink_viewer/live/frame/tok?authSig=x" });
        case "reolink_viewer/devices":
          return Promise.resolve({ hosts: [{ id: "nvr1", name: "RLN36" }], cameras: [] });
        case "reolink_viewer/playback/check_report":
          saved.push(message as unknown as { setup: string; text: string; done: boolean });
          return Promise.resolve(null);
        default:
          return Promise.resolve(null);
      }
    }),
    connection: {
      subscribeMessage: vi.fn((callback: (event: CapacityEvent) => void) => {
        setTimeout(() => {
          callback({ type: "progress", message: "level 1" });
          callback({
            type: "result",
            report: {
              online_users_before: 2,
              online_users_after: 2,
              fill: { channel: 0, duration_s: 3600 },
              fill_alone_mbit_s: 400,
              levels: [
                {
                  level: 1,
                  added: "Front Yard Right sub",
                  first_frame_s: 1.1,
                  streams: [{ stream: "Front Yard Right sub", fps: 15, expected_fps: 15, longest_gap_s: 0.1 }],
                  online_users: 2,
                },
              ],
              verdict: { first_failing_level: null, reasons: [] },
            },
          });
        }, 0);
        return Promise.resolve(() => Promise.resolve());
      }),
    },
  } as unknown as HomeAssistant;
  return { hass, calls, saved };
}

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 640;
  naturalHeight = 360;
  set src(_value: string) {
    setTimeout(() => this.onload?.(), 0);
  }
}

beforeEach(() => {
  plays.length = 0;
  outcome.clear();
  vi.stubGlobal("Image", FakeImage);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LiveCheck", () => {
  it("measures every connection and stream, warm and stock, and the capacity", async () => {
    outcome.set("webrtc:main", { ok: false, error: "codecs not matched: video:H265" });
    const { hass, calls, saved } = fakeHass(true);
    const stage = document.createElement("div");
    const check = new LiveCheck(
      hass,
      { setup: "Desktop Chrome, LAN", streams: ["sub", "main"], warm: true, stock: true, capacity: true },
      stage,
    );
    vi.spyOn(check as unknown as { _pause(ms: number): Promise<void> }, "_pause").mockResolvedValue();
    check.afterFrameMs = 0;
    const text = await check.run();
    // 3 connections × 2 streams × cold (2), warm (2) for the two mains-powered
    // connections; stock for the one stream with an entity.
    expect(plays.filter((p) => p.kind === "stock").map((p) => p.ref)).toEqual(["camera.fyr_fluent"]);
    expect(plays.filter((p) => p.kind !== "stock")).toHaveLength(3 * 2 * 2 + 2 * 2 * 2);
    expect(text).toContain("Reolink Viewer live check v");
    expect(text).toContain("ICE servers (Home Assistant's): 1 STUN, 0 TURN");
    expect(text).toContain("go2rtc: running 1.9.14 (Home Assistant's binary)");
    expect(text).toContain("Front Yard Right (CX410) · via RLN36 · sub (h264, 15 fps, 512 kbps)");
    expect(text).toContain("  cold: WebRTC 0.80 s (answer 100 ms, connected 200 ms; host/udp ↔ host/udp; 640×360)");
    expect(text).toContain("WebRTC ✗ codecs not matched: video:H265");
    expect(text).toContain("Home Assistant's view (camera.fyr_fluent): snapshot");
    expect(text).toContain("warm (key frame cached in");
    expect(text).toContain(
      "; key frames every 4.00 s; parameter sets: rebuilt; feed ended 1× (go2rtc closed the stream)):",
    );
    expect(text).toContain("go2rtc log (last 1 lines):\n  WRN [rtsp] error=EOF url=<url>");
    expect(text).toContain("warm: not measured (battery camera: never kept warm)");
    expect(text).toContain("Capacity test: RLN36");
    expect(text).toContain("  verdict: every level kept up");
    expect(text).toContain("- WebRTC connected 10 of 10 sessions (10× host/udp ↔ host/udp)");
    expect(text).toContain("- cold WebRTC, main/ext: median –, 0 of 3 played");
    expect(text).toContain("- Home Assistant's view: median 3.00 s, 1 of 1 played; ours (best of cold/warm) faster on 1 of 1");
    expect(text).toContain("- Front Yard Right: via NVR cold sub 0.80 s vs direct cold sub 0.80 s");
    expect(text).toContain("- capacity RLN36: kept up at every level (1)");
    expect(text).toContain("- first image, HA snapshot: median");
    // Warm phases turn the preload on and off again.
    const preloads = calls.filter((c) => c.type === "reolink_viewer/live/preload");
    expect(preloads.map((c) => c.enabled)).toEqual([true, false, true, false, true, false, true, false]);
    expect(saved.at(-1)?.done).toBe(true);
    expect(saved.at(-1)?.setup).toBe(`${LIVE_REPORT_PREFIX}Desktop Chrome, LAN`);
  });

  it("leaves out what a non-admin cannot run, and stops when asked", async () => {
    const { hass, calls } = fakeHass(false);
    const check = new LiveCheck(
      hass,
      { setup: "iPhone app, Nabu Casa", streams: ["sub"], warm: true, stock: false, capacity: true, cameraIds: ["cam2"] },
      document.createElement("div"),
    );
    const text = await check.run();
    expect(text).toContain("warm: no (not an admin)");
    expect(text).toContain("Capacity test: not run (admins only).");
    expect(calls.some((c) => c.type === "reolink_viewer/live/preload")).toBe(false);
    expect(text).toContain("Cameras: Doorbell");

    const stopped = new LiveCheck(hass, { setup: "Other", streams: ["sub"], warm: false, stock: false, capacity: false }, document.createElement("div"));
    stopped.stop();
    expect(await stopped.run()).toContain("Stopped.");
  });

  it("skips a stream the connection does not serve", async () => {
    const { hass, calls } = fakeHass(true);
    const check = new LiveCheck(
      hass,
      { setup: "Other", streams: ["ext"], warm: true, stock: true, capacity: false, cameraIds: ["cam2"] },
      document.createElement("div"),
    );
    const text = await check.run();
    expect(text).toContain("Doorbell (Video Doorbell) · via RLN36 · ext: not served by this connection");
    expect(calls.some((c) => c.type === "reolink_viewer/live/webrtc" || c.type === "reolink_viewer/live/mse")).toBe(false);
  });

  it("describes a session result", () => {
    expect(describeResult({ ok: false, error: "no frame within 20 s", steps: {} })).toBe("✗ no frame within 20 s");
    expect(
      describeResult({
        ok: true,
        firstFrameMs: 1500,
        steps: { url: 20, mime: 300, appended: 700, open: 50 },
        mse: { api: "ManagedMediaSource", mime: 'video/mp4; codecs="avc1.640029,mp4a.40.2"' },
      }),
    ).toBe("1.50 s (mime 300 ms, appended 700 ms; avc1.640029,mp4a.40.2)");
  });
});

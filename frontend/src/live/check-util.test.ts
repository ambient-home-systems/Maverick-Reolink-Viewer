import { describe, expect, it } from "vitest";

import type { CapacityReport } from "../types";
import {
  capacityLines,
  describeIceServers,
  median,
  mseCodecs,
  pairInfo,
  reportSource,
  rtcIceServers,
  seconds,
  streamLabel,
  wsUrl,
} from "./check-util";

describe("live check helpers", () => {
  it("asks go2rtc only for the codecs this browser's MSE takes", () => {
    expect(mseCodecs((type) => type.includes("avc1") || type.includes("mp4a.40.2"))).toBe(
      "avc1.640029,avc1.64002A,avc1.640033,mp4a.40.2",
    );
    expect(mseCodecs(() => false)).toBe("");
  });

  it("tells where a saved report was made", () => {
    const report = [
      "Reolink Viewer live check v0.5.4 · iPhone app, Tailscale · 10/22/2026, 9:00:00 AM",
      "Browser: iOS 27.0, Companion app 2026.10.1 · page Tailscale over https · screen 402×874 @3x",
      "User agent: Mozilla/5.0 (iPhone)",
    ].join("\n");
    expect(reportSource(report)).toBe("v0.5.4 · iOS 27.0, Companion app 2026.10.1");
    expect(reportSource("Reolink Viewer live check v0.5.2 · Desktop Chrome, LAN\nBrowser: Chrome 155 (macOS)")).toBe(
      "v0.5.2 · Chrome 155 (macOS)",
    );
    expect(reportSource("cut short")).toBe("");
  });

  it("describes ICE servers without addresses or credentials", () => {
    const servers = [
      { urls: ["stun:stun.home-assistant.io:3478", "stun:stun.home-assistant.io:80"] },
      { urls: "turns:turn.nabucasa.com:443?transport=tcp", username: "u", credential: "secret" },
    ];
    const text = describeIceServers(servers);
    expect(text).toBe("2 STUN, 1 TURN (Nabu Casa)");
    expect(text).not.toContain("secret");
    expect(describeIceServers([])).toBe("0 STUN, 0 TURN");
    expect(rtcIceServers(servers)).toEqual([
      { urls: servers[0]?.urls },
      { urls: servers[1]?.urls, username: "u", credential: "secret" },
    ]);
  });

  it("reads the selected candidate pair and the video codec from getStats", () => {
    const entries: Record<string, unknown>[] = [
      { id: "T", type: "transport", selectedCandidatePairId: "P" },
      { id: "P", type: "candidate-pair", localCandidateId: "L", remoteCandidateId: "R", currentRoundTripTime: 0.012 },
      { id: "L", type: "local-candidate", candidateType: "relay", protocol: "udp", relayProtocol: "tcp" },
      { id: "R", type: "remote-candidate", candidateType: "host", protocol: "udp" },
      { id: "V", type: "inbound-rtp", kind: "video", codecId: "C", frameWidth: 640, frameHeight: 360, framesDecoded: 30 },
      { id: "C", type: "codec", mimeType: "video/H264" },
    ];
    const stats = {
      forEach: (fn: (v: Record<string, unknown>) => void) => {
        entries.forEach(fn);
      },
    } as unknown as RTCStatsReport;
    expect(pairInfo(stats)).toEqual({
      local: "relay/udp (TURN over tcp)",
      remote: "host/udp",
      rttMs: 12,
      codec: "h264",
      width: 640,
      height: 360,
      framesDecoded: 30,
    });
    // Without a transport (Safari): the nominated, succeeded pair.
    const safari = entries.filter((e) => e.type !== "transport");
    const pair = safari.find((e) => e.id === "P");
    if (pair) Object.assign(pair, { nominated: true, state: "succeeded" });
    const fallback = {
      forEach: (fn: (v: Record<string, unknown>) => void) => {
        safari.forEach(fn);
      },
    } as unknown as RTCStatsReport;
    expect(pairInfo(fallback).local).toBe("relay/udp (TURN over tcp)");
    const empty = { forEach: () => undefined } as unknown as RTCStatsReport;
    expect(pairInfo(empty)).toEqual({});
  });

  it("formats times, medians and stream labels", () => {
    expect(seconds(1234)).toBe("1.23 s");
    expect(seconds(undefined)).toBe("–");
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeUndefined();
    expect(streamLabel("sub", { codec: "h264", frame_rate: 15, bit_rate: 512 })).toBe("sub (h264, 15 fps, 512 kbps)");
    expect(streamLabel("ext", null)).toBe("ext");
    expect(streamLabel("main", { codec: null, frame_rate: null, bit_rate: null })).toBe("main");
  });

  it("writes the capacity test's report", () => {
    const report: CapacityReport = {
      online_users_before: 2,
      online_users_after: "n/a (not support)",
      fill: { channel: 1, duration_s: 3600 },
      fill_alone_mbit_s: 410.5,
      levels: [
        {
          level: 1,
          added: "Garage sub",
          first_frame_s: 1.2,
          streams: [{ stream: "Garage sub", fps: 15, expected_fps: 15, longest_gap_s: 0.1 }],
          online_users: 3,
        },
        {
          level: 2,
          added: "recording download",
          streams: [{ stream: "Garage sub", fps: 9, expected_fps: 15, longest_gap_s: 1.4, error: "ended" }],
          online_users: null,
          fill: { mbit_s: 200 },
        },
      ],
      verdict: { first_failing_level: 2, reasons: ["Garage sub at 9 of 15 fps"] },
    };
    expect(capacityLines(report)).toEqual([
      "  logged-in clients (GetOnline) before: 2, after: n/a (not support)",
      "  download: ch2, 60 min recording, alone 410.5 Mbit/s",
      "  L1 + Garage sub, first frame 1.2 s · clients 3: Garage sub 15/15 fps",
      "  L2 + recording download, download 200 Mbit/s: Garage sub 9/15 fps gap 1.4 s (ended)",
      "  verdict: level 2 fails or slows down: Garage sub at 9 of 15 fps",
    ]);
    const ok = { ...report, fill: "no recording in the last 24 h", fill_alone_mbit_s: null, levels: [], verdict: { first_failing_level: null, reasons: [] } };
    expect(capacityLines(ok).at(-1)).toBe("  verdict: every level kept up");
    expect(capacityLines(ok)[1]).toBe("  download: no recording in the last 24 h");
  });

  it("builds websocket URLs on the page's server", () => {
    expect(wsUrl("/api/x/tok?authSig=a", "https://ha.example:8123/reolink-viewer")).toBe(
      "wss://ha.example:8123/api/x/tok?authSig=a",
    );
    expect(wsUrl("/api/x", "http://192.168.1.2:8123/")).toBe("ws://192.168.1.2:8123/api/x");
  });
});

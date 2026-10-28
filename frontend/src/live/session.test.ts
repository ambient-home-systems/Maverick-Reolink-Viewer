import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { HomeAssistant, LiveSignal, StockSignal } from "../types";
import { OurMse, OurWebRtc, STALL_MS, StockWebRtc } from "./session";

const flush = async (rounds = 10) => {
  for (let i = 0; i < rounds; i += 1) await new Promise((r) => setTimeout(r, 0));
};

class FakePC extends EventTarget {
  static last: FakePC | undefined;
  iceConnectionState = "new";
  iceGatheringState = "new";
  transceivers: string[] = [];
  remote: RTCSessionDescriptionInit | undefined;
  candidates: RTCIceCandidateInit[] = [];
  closed = false;
  constructor(readonly config: RTCConfiguration) {
    super();
    FakePC.last = this;
  }
  addTransceiver(kind: string): void {
    this.transceivers.push(kind);
  }
  createOffer(): Promise<RTCSessionDescriptionInit> {
    return Promise.resolve({ type: "offer", sdp: "v=0 offer" });
  }
  setLocalDescription(): Promise<void> {
    return Promise.resolve();
  }
  setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
    this.remote = description;
    return Promise.resolve();
  }
  addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    this.candidates.push(candidate);
    return Promise.resolve();
  }
  getStats(): Promise<unknown> {
    return Promise.resolve(
      new Map<string, Record<string, unknown>>([
        ["P", { id: "P", type: "candidate-pair", nominated: true, state: "succeeded", localCandidateId: "L", remoteCandidateId: "R" }],
        ["L", { id: "L", type: "local-candidate", candidateType: "host", protocol: "udp" }],
        ["R", { id: "R", type: "remote-candidate", candidateType: "srflx", protocol: "udp" }],
      ]),
    );
  }
  close(): void {
    this.closed = true;
  }
  /** The browser found a candidate. */
  candidate(text: string): void {
    const candidate = { candidate: text, toJSON: () => ({ candidate: text, sdpMid: "0", sdpMLineIndex: 0 }) };
    this.dispatchEvent(Object.assign(new Event("icecandidate"), { candidate }));
  }
  connected(): void {
    this.iceConnectionState = "connected";
    this.dispatchEvent(new Event("iceconnectionstatechange"));
  }
  track(): void {
    this.dispatchEvent(Object.assign(new Event("track"), { streams: [{ fake: true }], track: {} }));
  }
}

function fakeVideo(): HTMLVideoElement {
  const video = document.createElement("video");
  video.play = () => Promise.resolve();
  Object.defineProperty(video, "videoWidth", { get: () => 640 });
  Object.defineProperty(video, "videoHeight", { get: () => 360 });
  let srcObject: unknown = null;
  Object.defineProperty(video, "srcObject", {
    get: () => srcObject,
    set: (v: unknown) => {
      srcObject = v;
    },
  });
  return video;
}

function fakeHass() {
  const calls: Record<string, unknown>[] = [];
  const subscriptions: { message: Record<string, unknown>; callback: (event: unknown) => void; closed: boolean }[] = [];
  const hass = {
    callWS: vi.fn((message: Record<string, unknown>) => {
      calls.push(message);
      if (message.type === "reolink_viewer/live/mse") return Promise.resolve({ path: "/api/reolink_viewer/live/mse/tok?authSig=x" });
      if (message.type === "camera/webrtc/get_client_config") {
        return Promise.resolve({ configuration: { iceServers: [{ urls: "stun:x" }] } });
      }
      return Promise.resolve(null);
    }),
    connection: {
      subscribeMessage: vi.fn((callback: (event: unknown) => void, message: Record<string, unknown>) => {
        const sub = { message, callback, closed: false };
        subscriptions.push(sub);
        return Promise.resolve(() => {
          sub.closed = true;
          return Promise.resolve();
        });
      }),
    },
    states: {},
  } as unknown as HomeAssistant;
  return { hass, calls, subscriptions };
}

beforeEach(() => {
  vi.stubGlobal("RTCPeerConnection", FakePC);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("OurWebRtc", () => {
  it("signals through Home Assistant, trickles candidates and times the first frame", async () => {
    const { hass, calls, subscriptions } = fakeHass();
    const video = fakeVideo();
    const session = new OurWebRtc(hass, video, { connectionId: "c1", stream: "sub" }, [{ urls: "stun:s" }], 5000);
    await flush();
    const pc = FakePC.last;
    if (!pc) throw new Error("no peer connection");
    expect(pc.config.iceServers).toEqual([{ urls: "stun:s" }]);
    expect(pc.transceivers).toEqual(["video", "audio"]);
    const sub = subscriptions.at(0);
    if (!sub) throw new Error("no subscription");
    expect(sub.message).toEqual({
      type: "reolink_viewer/live/webrtc",
      connection_id: "c1",
      stream: "sub",
      offer: "v=0 offer",
    });
    // A candidate before the session id is kept, then sent.
    pc.candidate("candidate:1 1 udp 1 192.0.2.1 5000 typ host");
    const signal = (s: LiveSignal) => {
      sub.callback(s);
    };
    signal({ type: "session", session_id: "S1" });
    await flush();
    expect(calls.filter((c) => c.type === "reolink_viewer/live/candidate")).toEqual([
      { type: "reolink_viewer/live/candidate", session_id: "S1", candidate: "candidate:1 1 udp 1 192.0.2.1 5000 typ host" },
    ]);
    pc.candidate("candidate:2");
    await flush();
    expect(calls.filter((c) => c.type === "reolink_viewer/live/candidate")).toHaveLength(2);
    signal({ type: "answer", sdp: "v=0 answer" });
    signal({ type: "candidate", candidate: "candidate:3 1 udp 1 192.0.2.9 18556 typ host" });
    signal({ type: "candidate", candidate: "" });
    await flush();
    expect(pc.remote).toEqual({ type: "answer", sdp: "v=0 answer" });
    expect(pc.candidates).toEqual([{ candidate: "candidate:3 1 udp 1 192.0.2.9 18556 typ host", sdpMid: "0" }]);
    pc.connected();
    pc.track();
    expect(video.srcObject).toEqual({ fake: true });
    video.dispatchEvent(new Event("playing"));
    const result = await session.done;
    expect(result.ok).toBe(true);
    expect(result.firstFrameMs).toBeGreaterThanOrEqual(0);
    expect(Object.keys(result.steps)).toEqual(expect.arrayContaining(["offer", "answer", "connected", "track"]));
    expect(result.pair).toEqual({ local: "host/udp", remote: "srflx/udp" });
    expect(result.width).toBe(640);
    session.close();
    await flush();
    expect(pc.closed).toBe(true);
    expect(sub.closed).toBe(true);
  });

  it("reports go2rtc's error, ICE failure and no frame in time", async () => {
    const { hass, subscriptions } = fakeHass();
    const failed = new OurWebRtc(hass, fakeVideo(), { connectionId: "c1", stream: "main" }, [], 5000);
    await flush();
    subscriptions[0]?.callback({ type: "error", message: "codecs not matched: video:H265" });
    expect((await failed.done).error).toBe("codecs not matched: video:H265");
    failed.close();

    const ice = new OurWebRtc(hass, fakeVideo(), { connectionId: "c1", stream: "sub" }, [], 5000);
    await flush();
    const pc = FakePC.last;
    if (!pc) throw new Error("no peer connection");
    pc.iceConnectionState = "failed";
    pc.dispatchEvent(new Event("iceconnectionstatechange"));
    expect((await ice.done).error).toContain("ICE failed");
    ice.close();

    const late = new OurWebRtc(hass, fakeVideo(), { connectionId: "c1", stream: "sub" }, [], 20);
    expect((await late.done).error).toBe("no frame within 0 s");
    late.close();
  });
});

describe("StockWebRtc", () => {
  it("uses Home Assistant's camera WebRTC commands", async () => {
    const { hass, calls, subscriptions } = fakeHass();
    const video = fakeVideo();
    const session = new StockWebRtc(hass, video, "camera.garage_fluent", 5000);
    await flush();
    const pc = FakePC.last;
    if (!pc) throw new Error("no peer connection");
    expect(pc.config.iceServers).toEqual([{ urls: "stun:x" }]);
    const sub = subscriptions.at(0);
    if (!sub) throw new Error("no subscription");
    expect(sub.message).toEqual({ type: "camera/webrtc/offer", entity_id: "camera.garage_fluent", offer: "v=0 offer" });
    pc.candidate("candidate:9");
    const signal = (s: StockSignal) => {
      sub.callback(s);
    };
    signal({ type: "session", session_id: "H1" });
    signal({ type: "answer", answer: "v=0 ha" });
    signal({ type: "candidate", candidate: { candidate: "candidate:8", sdpMid: "0" } });
    await flush();
    expect(calls.find((c) => c.type === "camera/webrtc/candidate")).toEqual({
      type: "camera/webrtc/candidate",
      entity_id: "camera.garage_fluent",
      session_id: "H1",
      candidate: { candidate: "candidate:9", sdpMid: "0", sdpMLineIndex: 0 },
    });
    expect(pc.remote?.sdp).toBe("v=0 ha");
    expect(pc.candidates).toEqual([{ candidate: "candidate:8", sdpMid: "0" }]);
    pc.track();
    video.dispatchEvent(new Event("playing"));
    expect((await session.done).ok).toBe(true);
    session.close();
    const failing = new StockWebRtc(hass, fakeVideo(), "camera.garage_fluent", 5000);
    await flush();
    subscriptions[1]?.callback({ type: "error", code: "webrtc_offer_failed", message: "no stream" });
    expect((await failing.done).error).toBe("webrtc_offer_failed: no stream");
    failing.close();
  });
});

// ---- MSE ----

class FakeSocket extends EventTarget {
  static last: FakeSocket | undefined;
  binaryType = "blob";
  sent: string[] = [];
  closed = false;
  constructor(readonly url: string) {
    super();
    FakeSocket.last = this;
  }
  send(data: string): void {
    this.sent.push(data);
  }
  close(): void {
    this.closed = true;
  }
  open(): void {
    this.dispatchEvent(new Event("open"));
  }
  message(data: string | ArrayBuffer): void {
    this.dispatchEvent(Object.assign(new Event("message"), { data }));
  }
  drop(): void {
    this.dispatchEvent(new Event("close"));
  }
}

class FakeBuffer extends EventTarget {
  updating = false;
  mode = "segments";
  end = 0;
  /** Seconds each append adds (the key-frame cache sends several at once). */
  step = 1;
  appended = 0;
  removed: [number, number][] = [];
  get buffered(): TimeRanges {
    const end = this.end;
    return { length: end ? 1 : 0, start: () => 0, end: () => end };
  }
  appendBuffer(): void {
    this.updating = true;
    setTimeout(() => {
      this.appended += 1;
      this.end += this.step;
      this.updating = false;
      this.dispatchEvent(new Event("updateend"));
    }, 0);
  }
  remove(start: number, end: number): void {
    this.removed.push([start, end]);
  }
}

class FakeMediaSource extends EventTarget {
  static last: FakeMediaSource | undefined;
  static isTypeSupported(type: string): boolean {
    return type.includes("avc1") || type.includes("mp4a");
  }
  buffer = new FakeBuffer();
  mime = "";
  constructor() {
    super();
    FakeMediaSource.last = this;
    setTimeout(() => {
      this.dispatchEvent(new Event("sourceopen"));
    }, 0);
  }
  addSourceBuffer(mime: string): FakeBuffer {
    this.mime = mime;
    return this.buffer;
  }
}

describe("OurMse", () => {
  beforeEach(() => {
    vi.stubGlobal("WebSocket", FakeSocket);
    vi.stubGlobal("MediaSource", FakeMediaSource);
    vi.stubGlobal("ManagedMediaSource", undefined);
    URL.createObjectURL = () => "blob:fake";
    URL.revokeObjectURL = () => undefined;
  });

  it("asks go2rtc for MSE through the signed websocket and plays its segments", async () => {
    const { hass, calls } = fakeHass();
    const video = fakeVideo();
    let time = 0;
    Object.defineProperty(video, "currentTime", {
      get: () => time,
      set: (v: number) => {
        time = v;
      },
    });
    const session = new OurMse(hass, video, { connectionId: "c1", stream: "sub" }, 5000, "https://ha.local/reolink-viewer");
    await flush();
    expect(calls[0]).toEqual({ type: "reolink_viewer/live/mse", connection_id: "c1", stream: "sub" });
    const ws = FakeSocket.last;
    if (!ws) throw new Error("no socket");
    expect(ws.url).toBe("wss://ha.local/api/reolink_viewer/live/mse/tok?authSig=x");
    expect(ws.binaryType).toBe("arraybuffer");
    ws.open();
    expect(JSON.parse(ws.sent[0] ?? "{}")).toEqual({
      type: "mse",
      value: "avc1.640029,avc1.64002A,avc1.640033,mp4a.40.2,mp4a.40.5",
    });
    ws.message("not json");
    ws.message(JSON.stringify({ type: "mse", value: 'video/mp4; codecs="avc1.640029"' }));
    ws.message(new ArrayBuffer(8)); // the init segment, before the buffer exists
    await flush();
    const source = FakeMediaSource.last;
    expect(source?.mime).toBe('video/mp4; codecs="avc1.640029"');
    expect(video.disableRemotePlayback).toBe(true);
    ws.message(new ArrayBuffer(8));
    await flush();
    expect(source?.buffer.appended).toBe(2);
    video.dispatchEvent(new Event("playing"));
    const result = await session.done;
    expect(result.ok).toBe(true);
    expect(result.mse).toEqual({ api: "MediaSource", mime: 'video/mp4; codecs="avc1.640029"' });
    expect(Object.keys(result.steps)).toEqual(expect.arrayContaining(["url", "open", "mime", "first data", "appended"]));
    // Far behind the live edge: jump to it.
    time = 0;
    if (source) source.buffer.end = 10;
    ws.message(new ArrayBuffer(8));
    await flush();
    expect(time).toBeGreaterThan(9);
    session.close();
    expect(ws.closed).toBe(true);
  });

  it("starts near the newest frame the key-frame cache sent", async () => {
    const { hass } = fakeHass();
    const video = fakeVideo();
    let time = -1;
    Object.defineProperty(video, "currentTime", {
      get: () => time,
      set: (v: number) => {
        time = v;
      },
    });
    const session = new OurMse(hass, video, { connectionId: "c1", stream: "sub" }, 5000, "http://ha/");
    await flush();
    const ws = FakeSocket.last;
    if (!ws) throw new Error("no socket");
    ws.open();
    ws.message(JSON.stringify({ type: "mse", value: 'video/mp4; codecs="avc1.640029"' }));
    await flush();
    const source = FakeMediaSource.last;
    if (!source) throw new Error("no media source");
    // The init segment and 3.5 s since the key frame, in one message.
    source.buffer.step = 3.5;
    ws.message(new ArrayBuffer(8));
    await flush();
    expect(time).toBe(3);
    session.close();
  });

  it("reports an end once playing: the stream closed, or no new frame", async () => {
    const { hass } = fakeHass();
    const start = async () => {
      const video = fakeVideo();
      const session = new OurMse(hass, video, { connectionId: "c1", stream: "sub" }, 5000, "http://ha/");
      const ended: string[] = [];
      session.onEnd = (error, cut) => ended.push(cut ? `${error} (cut)` : error);
      await flush();
      const ws = FakeSocket.last;
      if (!ws) throw new Error("no socket");
      ws.open();
      ws.message(JSON.stringify({ type: "mse", value: 'video/mp4; codecs="avc1.640029"' }));
      await flush();
      video.dispatchEvent(new Event("playing"));
      expect((await session.done).ok).toBe(true);
      return { session, video, ws, ended };
    };

    const closed = await start();
    closed.ws.drop();
    closed.ws.drop();
    // Closed without a word from the server: a cut, reported once.
    expect(closed.ended).toEqual(["the server closed the stream (cut)"]);
    closed.session.close();
    // The server said why first: not a cut.
    const said = await start();
    said.ws.message(JSON.stringify({ type: "error", value: "the camera went away" }));
    said.ws.drop();
    expect(said.ended).toEqual(["the camera went away"]);
    said.session.close();

    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "performance"] });
    try {
      const stalled = await start();
      vi.advanceTimersByTime(STALL_MS - 2000);
      stalled.video.dispatchEvent(new Event("timeupdate")); // a frame: still playing
      vi.advanceTimersByTime(STALL_MS - 2000);
      expect(stalled.ended).toEqual([]);
      vi.advanceTimersByTime(3000);
      expect(stalled.ended).toEqual(["no new frame for 10 s"]);
      stalled.session.close();
      // Closed by its owner: no end is reported.
      const owned = await start();
      owned.session.close();
      vi.advanceTimersByTime(STALL_MS * 2);
      owned.ws.drop();
      expect(owned.ended).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("fails on go2rtc's error, a closed stream or a refused codec", async () => {
    const { hass } = fakeHass();
    const errored = new OurMse(hass, fakeVideo(), { connectionId: "c1", stream: "main" }, 5000, "http://ha/");
    await flush();
    FakeSocket.last?.message(JSON.stringify({ type: "error", value: "streams: dial tcp: refused" }));
    expect((await errored.done).error).toBe("streams: dial tcp: refused");
    errored.close();

    const dropped = new OurMse(hass, fakeVideo(), { connectionId: "c1", stream: "sub" }, 5000, "http://ha/");
    await flush();
    FakeSocket.last?.drop();
    expect((await dropped.done).error).toBe("the server closed the stream");
    dropped.close();

    vi.stubGlobal("MediaSource", undefined);
    const none = new OurMse(hass, fakeVideo(), { connectionId: "c1", stream: "sub" }, 5000, "http://ha/");
    expect((await none.done).error).toBe("this browser has no MediaSource");
    none.close();
  });
});

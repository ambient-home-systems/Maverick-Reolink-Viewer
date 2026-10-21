import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AHEAD_MAX_S,
  AHEAD_S,
  BEHIND_S,
  FIRST_WINDOW_MS,
  MseFeeder,
  MseUnsupported,
  aheadTarget,
  joinedRanges,
  type MseSource,
} from "./mse-feeder";

// A fake MediaSource whose "segments" are text: "INIT", or "start,end" in
// seconds; appending one adds that range to the buffer.
class FakeBuffer extends EventTarget {
  updating = false;
  ranges: [number, number][] = [];
  removed: [number, number][] = [];
  failNext: "quota" | "error" | undefined;

  get buffered(): TimeRanges {
    const r = [...this.ranges].sort((a, b) => a[0] - b[0]);
    return { length: r.length, start: (i: number) => r[i]?.[0] ?? 0, end: (i: number) => r[i]?.[1] ?? 0 };
  }

  appendBuffer(data: Uint8Array): void {
    if (this.failNext === "quota") {
      this.failNext = undefined;
      throw new DOMException("full", "QuotaExceededError");
    }
    const text = new TextDecoder().decode(data);
    this._update(() => {
      if (this.failNext === "error") {
        this.failNext = undefined;
        this.dispatchEvent(new Event("error"));
        return false;
      }
      if (text !== "INIT") {
        const [start = 0, end = 0] = text.split(",").map(Number);
        this.ranges = merge([...this.ranges, [start, end]]);
      }
      return true;
    });
  }

  remove(start: number, end: number): void {
    this.removed.push([start, end]);
    this._update(() => {
      this.ranges = this.ranges.flatMap(([s, e]): [number, number][] => {
        const out: [number, number][] = [];
        if (s < start) out.push([s, Math.min(e, start)]);
        if (e > end) out.push([Math.max(s, end), e]);
        return out;
      });
      return true;
    });
  }

  private _update(apply: () => boolean): void {
    this.updating = true;
    setTimeout(() => {
      const ok = apply();
      this.updating = false;
      if (ok) this.dispatchEvent(new Event("updateend"));
    }, 0);
  }
}

function merge(ranges: [number, number][]): [number, number][] {
  const sorted = ranges.sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  for (const [s, e] of sorted) {
    const last = out.at(-1);
    if (last && s <= last[1] + 1e-6) last[1] = Math.max(last[1], e);
    else out.push([s, e]);
  }
  return out;
}

class FakeMediaSource extends EventTarget {
  static supported = true;
  static last: FakeMediaSource | undefined;
  static isTypeSupported(): boolean {
    return FakeMediaSource.supported;
  }
  readyState = "closed";
  duration = Number.NaN;
  ended = 0;
  buffer = new FakeBuffer();
  constructor() {
    super();
    FakeMediaSource.last = this;
    setTimeout(() => {
      this.readyState = "open";
      this.dispatchEvent(new Event("sourceopen"));
    }, 0);
  }
  addSourceBuffer(): FakeBuffer {
    return this.buffer;
  }
  endOfStream(): void {
    this.readyState = "ended";
    this.ended += 1;
  }
}

/**
 * A recording of `count` 2 s fragments, served as the MSE view does. With
 * `lateLast`, the window reaching the end is not flagged last (the recording
 * was still downloading); asking past it then gets an empty last window.
 */
function fakeServer(count = 30, shortBy = 0, fragment = 2, lateLast = false) {
  const requests: string[] = [];
  const state = { status: 200, text: "" };
  const fetch = (path: string, init?: RequestInit): Promise<Response> => {
    const part = path.split("/").at(-1) ?? "";
    requests.push(part);
    if (state.status !== 200) return Promise.resolve(new Response(state.text, { status: state.status }));
    if (part === "init") {
      return Promise.resolve(new Response("INIT", { headers: { "X-RV-Mime": 'video/mp4; codecs="avc1.640033"' } }));
    }
    const query = new URLSearchParams(part.split("?")[1]);
    const first = query.has("first")
      ? Number(query.get("first"))
      : Math.min(Math.floor(Number(query.get("at")) / 1000 / fragment), count - 1);
    const wanted = Math.max(1, Math.ceil(Number(query.get("ms")) / 1000 / fragment));
    const n = Math.max(0, Math.min(wanted, count - first));
    // The buffered range can end a little before the window (audio vs video).
    const body = n ? `${first * fragment},${(first + n) * fragment - shortBy}` : "";
    const headers: Record<string, string> = {
      "X-RV-First": String(first),
      "X-RV-Count": String(n),
      "X-RV-Last": first + n >= count && (n === 0 || !lateLast) ? "1" : "0",
    };
    if (n) {
      headers["X-RV-Start"] = String(first * fragment * 1000);
      headers["X-RV-End"] = String((first + n) * fragment * 1000);
    }
    return new Promise((resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        reject(new DOMException("aborted", "AbortError"));
      });
      setTimeout(() => {
        resolve(new Response(body, { headers }));
      }, 0);
    });
  };
  return { requests, state, fetch };
}

function fakeVideo(): HTMLVideoElement {
  const video = document.createElement("video");
  let time = 0;
  let rate = 1;
  Object.defineProperty(video, "currentTime", {
    get: () => time,
    set: (v: number) => {
      time = v;
    },
  });
  Object.defineProperty(video, "playbackRate", {
    get: () => rate,
    set: (v: number) => {
      rate = v;
    },
  });
  Object.defineProperty(video, "duration", { get: () => FakeMediaSource.last?.duration ?? Number.NaN });
  return video;
}

const settle = async (rounds = 20) => {
  for (let i = 0; i < rounds; i += 1) await new Promise((r) => setTimeout(r, 0));
};

function feeder(server: ReturnType<typeof fakeServer>, video = fakeVideo(), durationMs = 60_000) {
  const errors: Error[] = [];
  const source: MseSource = { base: "/api/reolink_viewer/mse/tok", fetch: server.fetch, durationMs };
  const f = new MseFeeder(video, source, (err) => errors.push(err));
  return { f, video, errors };
}

beforeEach(() => {
  FakeMediaSource.supported = true;
  vi.stubGlobal("MediaSource", FakeMediaSource);
  vi.stubGlobal("ManagedMediaSource", undefined);
  URL.createObjectURL = () => "blob:fake";
  URL.revokeObjectURL = () => undefined;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("MseFeeder", () => {
  it("starts at the window holding the offset, then fills ahead by index", async () => {
    const server = fakeServer(60);
    const { f, video } = feeder(server, fakeVideo(), 120_000);
    await f.start(10_500);
    expect(video.currentTime).toBe(10.5);
    await settle();
    expect(server.requests.slice(0, 3)).toEqual([
      "init",
      `frags?at=10500&ms=${FIRST_WINDOW_MS}&bytes=16777216`,
      "frags?first=7&ms=20000&bytes=16777216",
    ]);
    expect(FakeMediaSource.last?.duration).toBe(120);
    expect(f.stats.api).toBe("MediaSource");
    expect(f.stats.mime).toContain("avc1");
    // Filled until AHEAD_S ahead, then it waits for the video to move.
    const { ahead } = f.around;
    expect(ahead).toBeGreaterThanOrEqual(AHEAD_S);
    const before = server.requests.length;
    video.dispatchEvent(new Event("timeupdate"));
    await settle();
    expect(server.requests.length).toBe(before);
    f.destroy();
  });

  it("trims behind the play position and refetches after a seek away", async () => {
    const server = fakeServer(60);
    const { f, video } = feeder(server, fakeVideo(), 120_000);
    await f.start(0);
    await settle();
    // Play on: past BEHIND_S plus slack, the oldest media goes.
    video.currentTime = BEHIND_S + 15;
    video.dispatchEvent(new Event("timeupdate"));
    await settle();
    const buffer = FakeMediaSource.last?.buffer;
    expect(buffer?.removed[0]).toEqual([0, 15]);
    // A seek far ahead: a first window there.
    video.currentTime = 100;
    video.dispatchEvent(new Event("seeking"));
    await settle();
    expect(server.requests).toContain(`frags?at=100000&ms=${FIRST_WINDOW_MS}&bytes=16777216`);
    expect(f.around.ahead).toBeGreaterThan(0);
    f.destroy();
  });

  it("ends the stream at the recording's end and asks nothing more", async () => {
    const server = fakeServer(10);
    const { f, video } = feeder(server, fakeVideo(), 20_000);
    await f.start(14_000);
    video.currentTime = 14;
    await settle();
    expect(FakeMediaSource.last?.ended).toBe(1);
    const count = server.requests.length;
    video.currentTime = 20.01;
    video.dispatchEvent(new Event("timeupdate"));
    await settle();
    expect(server.requests.length).toBe(count);
    // Trimming behind reopens the source (as remove() does): it is ended again.
    const source = FakeMediaSource.last;
    if (!source) throw new Error("no source");
    source.readyState = "open";
    video.currentTime = 19.9;
    video.dispatchEvent(new Event("timeupdate"));
    await settle();
    expect(source.ended).toBe(2);
    f.destroy();
  });

  it("extends a window that ends just before the play position by index", async () => {
    // 4 s fragments, each buffered range 0.2 s short of what the server said.
    const server = fakeServer(15, 0.2, 4);
    const { f, video } = feeder(server, fakeVideo());
    await f.start(11_900);
    await settle();
    expect(video.currentTime).toBe(11.9);
    // 11.9 s is past the buffered 8–11.8 s: the next fragment by index, never
    // the same window again by time.
    expect(server.requests[2]).toBe(`frags?first=3&ms=${FIRST_WINDOW_MS}&bytes=16777216`);
    expect(server.requests.filter((r) => r.startsWith("frags?at="))).toHaveLength(1);
    f.destroy();
  });

  it("asks by time for a seek back into what was trimmed", async () => {
    const server = fakeServer(60);
    const { f, video } = feeder(server, fakeVideo(), 120_000);
    await f.start(0);
    await settle();
    // Play on, one run of windows by index, until the oldest media is trimmed.
    video.currentTime = 20;
    video.dispatchEvent(new Event("timeupdate"));
    await settle();
    video.currentTime = 41;
    video.dispatchEvent(new Event("timeupdate"));
    await settle();
    expect(FakeMediaSource.last?.buffer.removed[0]).toEqual([0, 11]);
    // A click on an earlier event: the media there, not the next by index.
    const before = server.requests.length;
    video.currentTime = 5;
    video.dispatchEvent(new Event("seeking"));
    await settle();
    expect(server.requests[before]).toBe(`frags?at=5000&ms=${FIRST_WINDOW_MS}&bytes=16777216`);
    expect(f.around.ahead).toBeGreaterThan(0);
    f.destroy();
  });

  it("does not ask again at once after an empty last window", async () => {
    // The last fragments arrive before the server knows they are the last;
    // the search says the recording is 1.5 s longer than its media.
    const server = fakeServer(30, 0, 2, true);
    const { f, video } = feeder(server, fakeVideo(), 61_500);
    await f.start(50_000);
    video.currentTime = 50;
    await settle(40);
    const past = server.requests.filter((r) => r.startsWith("frags?first=30"));
    expect(past).toHaveLength(1);
    expect(FakeMediaSource.last?.ended).toBeGreaterThan(0);
    // At the media's end nothing more is asked.
    const count = server.requests.length;
    video.currentTime = 60;
    video.dispatchEvent(new Event("timeupdate"));
    await settle();
    expect(server.requests.length).toBe(count);
    f.destroy();
  });

  it("tells the file player to take over, or reports a failure", async () => {
    FakeMediaSource.supported = false;
    const refused = feeder(fakeServer());
    await expect(refused.f.start(0)).rejects.toBeInstanceOf(MseUnsupported);
    FakeMediaSource.supported = true;
    const server = fakeServer();
    server.state.status = 502;
    server.state.text = "not playable as fragments: no mvex";
    await expect(feeder(server).f.start(0)).rejects.toBeInstanceOf(MseUnsupported);
    // Mid-play, an expired URL is an ordinary failure (reported once).
    const live = fakeServer(60);
    const { f, video, errors } = feeder(live, fakeVideo(), 120_000);
    await f.start(0);
    await settle();
    live.state.status = 404;
    live.state.text = "Not found or expired";
    video.currentTime = 90;
    video.dispatchEvent(new Event("seeking"));
    await settle();
    expect(errors).toHaveLength(1);
    expect(errors[0]).not.toBeInstanceOf(MseUnsupported);
    expect(errors[0]?.message).toContain("HTTP 404");
    expect(f.closed).toBe(true);
    // An append error means the fragments themselves: the file player can try.
    const bad = fakeServer();
    const broken = feeder(bad);
    const started = broken.f.start(0);
    await settle(2);
    if (FakeMediaSource.last) FakeMediaSource.last.buffer.failNext = "error";
    await expect(started).rejects.toBeInstanceOf(MseUnsupported);
  });

  it("makes room when the buffer is full", async () => {
    const server = fakeServer(60);
    const { f, video } = feeder(server, fakeVideo(), 120_000);
    await f.start(0);
    await settle();
    const buffer = FakeMediaSource.last?.buffer;
    if (!buffer) throw new Error("no buffer");
    video.currentTime = 20;
    buffer.failNext = "quota";
    video.currentTime = 100;
    video.dispatchEvent(new Event("seeking"));
    await settle();
    expect(buffer.removed.length).toBeGreaterThan(0);
    expect(f.stats.trims).toBeGreaterThan(0);
    expect(f.around.ahead).toBeGreaterThan(0);
    f.destroy();
  });

  it("follows ManagedMediaSource's requests to pause fetching", async () => {
    class Managed extends FakeMediaSource {
      streaming = false;
    }
    vi.stubGlobal("ManagedMediaSource", Managed);
    const server = fakeServer(60);
    const { f, video } = feeder(server, fakeVideo(), 120_000);
    await f.start(0);
    await settle();
    expect(f.stats.api).toBe("ManagedMediaSource");
    // Only the first window: the source does not want more yet.
    expect(server.requests).toHaveLength(2);
    const source = FakeMediaSource.last as Managed;
    source.streaming = true;
    source.dispatchEvent(new Event("startstreaming"));
    await settle();
    expect(server.requests.length).toBeGreaterThan(2);
    expect(video.disableRemotePlayback).toBe(true);
    f.destroy();
  });
});

describe("buffer arithmetic", () => {
  it("joins ranges split at fragment edges", () => {
    const ranges = { length: 3, start: (i: number) => [0, 4.2, 9][i] ?? 0, end: (i: number) => [4, 8, 12][i] ?? 0 };
    expect(joinedRanges(ranges as TimeRanges)).toEqual([
      { start: 0, end: 8 },
      { start: 9, end: 12 },
    ]);
  });

  it("keeps more ahead at higher rates, within the byte cap", () => {
    expect(aheadTarget(1, 0)).toBe(AHEAD_S);
    expect(aheadTarget(4, 0)).toBe(4 * AHEAD_S);
    expect(aheadTarget(8, 0)).toBe(AHEAD_MAX_S);
    // HD at 1 MB/s: the byte cap (48 MiB) wins at 8×.
    expect(aheadTarget(8, 1_000_000)).toBeCloseTo(50.3, 0);
    expect(aheadTarget(1, 1e9)).toBe(4);
  });
});

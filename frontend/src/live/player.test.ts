import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { HomeAssistant } from "../types";
import {
  CUT_MIN_PLAY_MS,
  CUT_SAME_MS,
  CUT_WINDOW_MS,
  CutWatch,
  EVENT_LOG,
  LivePlayer,
  PREFER_MSE_MS,
  PREFER_WEBRTC_MS,
  RETRY_S,
  STABLE_MS,
  WebRtcWatch,
  type PlayerState,
  type SessionFactory,
  type Transport,
} from "./player";
import type { LiveSession, SessionResult } from "./session";

const flush = async () => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
};

/** A session whose start the test settles, and which it can end. */
class FakeSession implements LiveSession {
  readonly done: Promise<SessionResult>;
  onEnd?: (error: string, cut: boolean) => void;
  closed = false;
  private _resolve!: (result: SessionResult) => void;
  constructor(
    readonly transport: Transport,
    readonly timeoutMs: number,
  ) {
    this.done = new Promise((resolve) => {
      this._resolve = resolve;
    });
  }
  play(): void {
    this._resolve({ ok: true, firstFrameMs: 120, steps: {} });
  }
  /** Fail before the first frame; `steps` says how far it got (WebRTC: "connected"). */
  failStart(error: string, steps: Record<string, number> = {}): void {
    this._resolve({ ok: false, error, steps });
  }
  end(error: string, cut = false): void {
    this.onEnd?.(error, cut);
  }
  close(): void {
    this.closed = true;
  }
}

/** A Storage that keeps what it is given, for WebRtcWatch. */
function memoryStorage(): Storage {
  const kept = new Map<string, string>();
  return {
    getItem: (key: string) => kept.get(key) ?? null,
    setItem: (key: string, value: string) => void kept.set(key, value),
  } as unknown as Storage;
}

/** A watch of its own, on a device that cannot remember (each test starts afresh). */
const freshWatch = () => new WebRtcWatch("ha.test", () => undefined);

function setup(warm: boolean, cuts: CutWatch = new CutWatch(), webRtc: WebRtcWatch = freshWatch()) {
  const sessions: FakeSession[] = [];
  const states: PlayerState[] = [];
  const factory: SessionFactory = (
    transport,
    _hass,
    _video,
    _ref,
    _ice,
    timeoutMs,
  ) => {
    const session = new FakeSession(transport, timeoutMs);
    sessions.push(session);
    return session;
  };
  const player = new LivePlayer(
    {} as HomeAssistant,
    document.createElement("video"),
    { connectionId: "c1", stream: "sub" },
    { warm, iceServers: [] },
    (state) => states.push(state),
    factory,
    cuts,
    webRtc,
  );
  const last = () => {
    const session = sessions.at(-1);
    if (!session) throw new Error("no session");
    return session;
  };
  return { player, sessions, states, last };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("LivePlayer", () => {
  it("starts a warm stream over MSE and a cold one over WebRTC", async () => {
    const warm = setup(true);
    warm.player.start();
    warm.player.start(); // once
    expect(warm.sessions.map((s) => s.transport)).toEqual(["MSE"]);
    warm.last().play();
    await flush();
    expect(warm.player.state).toMatchObject({
      kind: "playing",
      transport: "MSE",
    });

    const cold = setup(false);
    cold.player.start();
    expect(cold.last().transport).toBe("WebRTC");
    expect(cold.last().timeoutMs).toBe(15_000);
    cold.last().play();
    await flush();
    expect(cold.states.map((s) => s.kind)).toEqual(["starting", "playing"]);
  });

  it("falls back to the other transport, then waits longer after each failure", async () => {
    const { player, sessions, last } = setup(false);
    player.start();
    last().failStart("ICE failed");
    await flush();
    expect(sessions[0]?.closed).toBe(true);
    expect(last().transport).toBe("MSE");
    last().failStart("the server closed the stream");
    await flush();
    expect(player.state).toMatchObject({
      kind: "waiting",
      error: "MSE: the server closed the stream",
    });
    for (const [i, delay] of RETRY_S.slice(0, 3).entries()) {
      const before = sessions.length;
      vi.advanceTimersByTime(delay * 1000 - 1);
      expect(sessions.length, `wait ${i}`).toBe(before);
      vi.advanceTimersByTime(1);
      expect(sessions.length).toBe(before + 1);
      last().failStart("no frame");
      await flush();
      last().failStart("no frame");
      await flush();
    }
    expect(player.state.kind).toBe("waiting");
    // Retry now, without waiting.
    player.retryNow();
    expect(last().transport).toBe("WebRTC");
    last().play();
    await flush();
    expect(player.state.kind).toBe("playing");
  });

  it("starts again when a playing session ends", async () => {
    const { player, sessions, last } = setup(true);
    player.start();
    last().play();
    await flush();
    // It played a while: at once.
    vi.advanceTimersByTime(STABLE_MS);
    last().end("no new frame for 10 s");
    expect(sessions[0]?.closed).toBe(true);
    expect(sessions).toHaveLength(2);
    expect(player.state).toMatchObject({ kind: "starting", transport: "MSE" });
    last().play();
    await flush();
    // It ended at once: wait first, so a flapping stream is not hammered.
    last().end("the server closed the stream");
    expect(player.state).toMatchObject({
      kind: "waiting",
      error: "the server closed the stream",
    });
    expect(sessions).toHaveLength(2);
    vi.advanceTimersByTime(RETRY_S[0] * 1000);
    expect(sessions).toHaveLength(3);
  });

  it("stops: closes the session and drops what comes after", async () => {
    const { player, sessions, states, last } = setup(false);
    player.start();
    const pending = last();
    player.stop();
    expect(pending.closed).toBe(true);
    expect(player.state.kind).toBe("idle");
    pending.play(); // too late
    await flush();
    expect(player.state.kind).toBe("idle");
    // A wait is cancelled too.
    player.start();
    last().failStart("x");
    await flush();
    last().failStart("y");
    await flush();
    expect(player.state.kind).toBe("waiting");
    player.stop();
    vi.advanceTimersByTime(60_000);
    expect(sessions).toHaveLength(3);
    expect(states.at(-1)).toEqual({ kind: "idle" });
    player.retryNow(); // only while waiting
    expect(sessions).toHaveLength(3);
  });

  it("keeps its last events for the debug view, and counts them for the soak run", async () => {
    vi.setSystemTime(new Date(2026, 9, 22, 14, 0, 0));
    const { player, last } = setup(false);
    const counted: string[] = [];
    player.onCount = (kind) => counted.push(kind);
    player.start();
    last().failStart("ICE failed");
    await flush();
    last().play();
    await flush();
    vi.advanceTimersByTime(5000);
    last().end("no new frame for 10 s");
    player.stop();
    expect(player.events.map((e) => e.text)).toEqual([
      "WebRTC: starting",
      "WebRTC: ICE failed",
      "MSE: starting",
      "MSE: playing, first frame in 0.12 s",
      "ended after 5 s: no new frame for 10 s",
      "next try in 1 s",
      "stopped",
    ]);
    // Stopping is not a drop.
    expect(counted).toEqual(["failures", "plays", "drops"]);
    expect(player.events.at(-1)?.at).toBe(new Date(2026, 9, 22, 14, 0, 5).getTime());
    // Stopping a stopped player says nothing; only the last EVENT_LOG are kept.
    player.stop();
    expect(player.events).toHaveLength(7);
    for (let i = 0; i < EVENT_LOG; i += 1) {
      player.start();
      player.stop();
    }
    expect(player.events).toHaveLength(EVENT_LOG);
    expect(player.events.at(0)?.text).toBe("WebRTC: starting");
  });

  it("starts over WebRTC first once this page's MSE was cut twice", async () => {
    const cuts = new CutWatch();
    const { player, sessions, last } = setup(true, cuts);
    // Played a while, then cut: MSE again (once could be a restart).
    player.start();
    last().play();
    await flush();
    vi.advanceTimersByTime(CUT_MIN_PLAY_MS);
    last().end("the server closed the stream", true);
    expect(last().transport).toBe("MSE");
    expect(cuts.preferWebRtc()).toBe(false);
    // A stall, or a cut of one that played under a minute, is not counted.
    last().play();
    await flush();
    vi.advanceTimersByTime(CUT_MIN_PLAY_MS);
    last().end("no new frame for 10 s");
    last().play();
    await flush();
    vi.advanceTimersByTime(CUT_MIN_PLAY_MS - 1000);
    last().end("the server closed the stream", true);
    vi.advanceTimersByTime(RETRY_S[0] * 1000);
    expect(cuts.preferWebRtc()).toBe(false);
    // The second cut: WebRTC first.
    last().play();
    await flush();
    vi.advanceTimersByTime(CUT_MIN_PLAY_MS);
    last().end("the server closed the stream", true);
    expect(cuts.preferWebRtc()).toBe(true);
    expect(last().transport).toBe("WebRTC");
    last().play();
    await flush();
    expect(player.state).toMatchObject({ kind: "playing", transport: "WebRTC" });
    expect(sessions.map((s) => s.transport)).toEqual(["MSE", "MSE", "MSE", "MSE", "WebRTC"]);
    expect(player.events.map((e) => e.text)).toContain(
      "this page's MSE connections were cut twice within 20 min: WebRTC goes first for 60 min",
    );
    expect(player.events.filter((e) => e.text.startsWith("WebRTC first"))).toHaveLength(1);
    // Another warm player on the page starts over WebRTC too.
    const other = setup(true, cuts);
    other.player.start();
    expect(other.last().transport).toBe("WebRTC");
    // An hour later, MSE goes first again.
    vi.advanceTimersByTime(PREFER_WEBRTC_MS);
    player.stop();
    player.start();
    expect(last().transport).toBe("MSE");
    await flush();
  });

  it("goes back to MSE first when WebRTC cannot start either", async () => {
    const cuts = new CutWatch();
    cuts.note(Date.now() - 60_000);
    cuts.note(Date.now());
    expect(cuts.preferWebRtc()).toBe(true);
    const { player, last } = setup(true, cuts);
    player.start();
    expect(last().transport).toBe("WebRTC");
    last().failStart("ICE failed");
    await flush();
    expect(cuts.preferWebRtc()).toBe(false);
    expect(last().transport).toBe("MSE");
    expect(player.events.map((e) => e.text)).toContain("WebRTC could not start either: MSE goes first again");
    // A cold stream's WebRTC failing says nothing about the network's cuts.
    const again = new CutWatch();
    again.note(Date.now() - 60_000);
    again.note(Date.now());
    const cold = setup(false, again);
    cold.player.start();
    cold.last().failStart("ICE failed");
    await flush();
    expect(again.preferWebRtc()).toBe(true);
  });

  it("starts over MSE first once WebRTC could not connect here, and forgets it when WebRTC plays", async () => {
    const watch = freshWatch();
    const { player, sessions, last } = setup(false, new CutWatch(), watch);
    player.start();
    expect(last().transport).toBe("WebRTC");
    // The server answered; the browser never reached it.
    last().failStart("no frame within 15 s", { offer: 5, answer: 900 });
    await flush();
    expect(watch.preferMse()).toBe(false); // not before MSE has shown the camera plays
    last().play();
    await flush();
    expect(watch.preferMse()).toBe(true);
    expect(watch.until).toBe(Date.now() + PREFER_MSE_MS);
    expect(player.events.map((e) => e.text)).toContain(
      "WebRTC could not connect but MSE played: MSE goes first from here for 7 days",
    );
    // Its next start, after a drop, goes MSE first: no 15 s wait.
    last().end("no new frame for 10 s");
    vi.advanceTimersByTime(RETRY_S[0] * 1000);
    expect(sessions.map((s) => s.transport)).toEqual(["WebRTC", "MSE", "MSE"]);
    expect(player.events.map((e) => e.text)).toContain("MSE first: WebRTC does not connect from here");
    // So do the page's other cold streams (full screen's HD too), and a warm one switched by cuts.
    const other = setup(false, new CutWatch(), watch);
    other.player.start();
    expect(other.last().transport).toBe("MSE");
    const cuts = new CutWatch();
    cuts.note(Date.now() - 60_000);
    cuts.note(Date.now());
    const warm = setup(true, cuts, watch);
    warm.player.start();
    expect(warm.last().transport).toBe("MSE");
    // MSE fails and WebRTC plays: WebRTC connects from here after all.
    other.last().failStart("the server closed the stream");
    await flush();
    expect(other.last().transport).toBe("WebRTC");
    other.last().play();
    await flush();
    expect(watch.preferMse()).toBe(false);
    other.player.stop();
    other.player.start();
    expect(other.last().transport).toBe("WebRTC");
    await flush();
  });

  it("does not count a WebRTC start the camera held up (not answered yet, or connected without a frame)", async () => {
    const watch = freshWatch();
    for (const steps of [{ offer: 5 }, { offer: 5, answer: 900, connected: 1100 }]) {
      const { player, last } = setup(false, new CutWatch(), watch);
      player.start();
      last().failStart("no frame within 15 s", steps);
      await flush();
      last().play();
      await flush();
      expect(player.state).toMatchObject({ kind: "playing", transport: "MSE" });
      expect(watch.preferMse(), JSON.stringify(steps)).toBe(false);
    }
  });

  it("tries WebRTC first again after a week", async () => {
    const watch = freshWatch();
    watch.note();
    const { player, last } = setup(false, new CutWatch(), watch);
    vi.advanceTimersByTime(PREFER_MSE_MS - 1);
    player.start();
    expect(last().transport).toBe("MSE");
    player.stop();
    vi.advanceTimersByTime(1);
    player.start();
    expect(last().transport).toBe("WebRTC");
    await flush();
  });

  it("reads warm at each start", async () => {
    const { player, last } = setup(false);
    player.start();
    expect(last().transport).toBe("WebRTC");
    player.stop();
    player.options.warm = true;
    player.start();
    expect(last().transport).toBe("MSE");
    await flush();
  });
});

describe("CutWatch", () => {
  it("counts cuts close together once, and two within the window", () => {
    const cuts = new CutWatch();
    const t = 1_000_000;
    expect(cuts.note(t)).toBe(false);
    // Every tile cut at once (a restart, a blip): one cut.
    expect(cuts.note(t + CUT_SAME_MS - 1)).toBe(false);
    expect(cuts.preferWebRtc(t + CUT_SAME_MS)).toBe(false);
    // Too long after the first: the first no longer counts.
    expect(cuts.note(t + CUT_WINDOW_MS + 1)).toBe(false);
    // The second within the window.
    expect(cuts.note(t + CUT_WINDOW_MS + 5 * 60_000)).toBe(true);
    const until = t + CUT_WINDOW_MS + 5 * 60_000 + PREFER_WEBRTC_MS;
    expect(cuts.until).toBe(until);
    expect(cuts.preferWebRtc(until - 1)).toBe(true);
    // Cuts while WebRTC goes first do not extend it.
    expect(cuts.note(until - 120_000)).toBe(false);
    expect(cuts.note(until - 60_000)).toBe(false);
    expect(cuts.until).toBe(until);
    expect(cuts.preferWebRtc(until)).toBe(false);
  });
});

describe("WebRtcWatch", () => {
  it("is kept on the device for each Home Assistant address, across page loads", () => {
    const storage = memoryStorage();
    const t = 1_000_000;
    const work = new WebRtcWatch("abc.ui.nabu.casa", () => storage);
    expect(work.note(t)).toBe(true);
    // Noting again while it holds does not extend it.
    expect(work.note(t + 60_000)).toBe(false);
    expect(work.until).toBe(t + PREFER_MSE_MS);
    // The next page load, to the same address: still MSE first.
    const reload = new WebRtcWatch("abc.ui.nabu.casa", () => storage);
    expect(reload.preferMse(t + 1)).toBe(true);
    // Another address (home, on the LAN) is a different way in.
    expect(new WebRtcWatch("192.168.1.10:8123", () => storage).preferMse(t + 1)).toBe(false);
    reload.works();
    expect(new WebRtcWatch("abc.ui.nabu.casa", () => storage).preferMse(t + 1)).toBe(false);
  });

  it("holds for the page when the device cannot remember, or remembers nonsense", () => {
    const broken = {
      getItem: () => "not json",
      setItem: () => {
        throw new Error("quota");
      },
    } as unknown as Storage;
    const watch = new WebRtcWatch("ha.test", () => broken);
    expect(watch.preferMse()).toBe(false);
    expect(watch.note()).toBe(true);
    expect(watch.preferMse()).toBe(true);
    watch.works();
    expect(watch.preferMse()).toBe(false);
  });
});

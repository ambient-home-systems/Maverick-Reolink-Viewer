import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { HomeAssistant } from "../types";
import {
  EVENT_LOG,
  LivePlayer,
  RETRY_S,
  STABLE_MS,
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
  onEnd?: (error: string) => void;
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
  failStart(error: string): void {
    this._resolve({ ok: false, error, steps: {} });
  }
  end(error: string): void {
    this.onEnd?.(error);
  }
  close(): void {
    this.closed = true;
  }
}

function setup(warm: boolean) {
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

  it("keeps its last events for the debug view", async () => {
    vi.setSystemTime(new Date(2026, 9, 22, 14, 0, 0));
    const { player, last } = setup(false);
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

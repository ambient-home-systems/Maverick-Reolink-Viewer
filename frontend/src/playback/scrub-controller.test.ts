import { afterEach, describe, expect, it, vi } from "vitest";

import type { ScrubAnswer, ScrubClient, ScrubPicture } from "./scrub-client";
import { SESSION_IDLE_MS, ScrubController } from "./scrub-controller";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function picture(at: number, time = at): ScrubPicture {
  return {
    at,
    time,
    source: "store",
    kind: "fmp4",
    codec: "avc1",
    init: new Uint8Array([1]),
    data: new Uint8Array([2]),
    serverMs: 1,
    ms: 5,
  };
}

/** A scrub session the test answers by hand: what was asked, in order. */
class FakeClient {
  asked: number[] = [];
  closed = false;
  private readonly _answers: ((answer: ScrubAnswer) => void)[] = [];

  ready(): Promise<void> {
    return Promise.resolve();
  }

  ask(at: number): Promise<ScrubAnswer> {
    this.asked.push(at);
    return new Promise((resolve) => this._answers.push(resolve));
  }

  /** Answer the oldest ask still waiting. */
  answer(answer?: ScrubAnswer): void {
    const at = this.asked[this.asked.length - this._answers.length] ?? 0;
    this._answers.shift()?.(answer ?? picture(at));
  }

  get waiting(): number {
    return this._answers.length;
  }

  close(): void {
    this.closed = true;
  }
}

function controller(clients: FakeClient[] = [new FakeClient()], fail = false) {
  const shown: ScrubPicture[] = [];
  const missed: ScrubAnswer[] = [];
  let opened = 0;
  const scrubber = new ScrubController({
    open: () => {
      const client = fail ? undefined : clients.at(opened);
      opened += 1;
      return client ? Promise.resolve(client as unknown as ScrubClient) : Promise.reject(new Error("refused"));
    },
    show: (p) => shown.push(p),
    miss: (a) => missed.push(a),
  });
  return { scrubber, shown, missed, opened: () => opened };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("the scrub controller", () => {
  it("asks one moment at a time; while one is answered, only the newest waits", async () => {
    const client = new FakeClient();
    const { scrubber, shown } = controller([client]);
    scrubber.move(1000);
    await flush();
    expect(client.asked).toEqual([1000]);
    // The pointer goes on while the first is answered: only the last is kept.
    scrubber.move(2000);
    scrubber.move(3000);
    scrubber.move(4000);
    await flush();
    expect(client.asked).toEqual([1000]);
    client.answer();
    await flush();
    expect(shown.map((p) => p.at)).toEqual([1000]);
    expect(client.asked).toEqual([1000, 4000]);
    client.answer();
    await flush();
    expect(shown.map((p) => p.at)).toEqual([1000, 4000]);
    expect(client.waiting).toBe(0);
    expect(scrubber.counts).toEqual({ asked: 2, shown: 2, missed: 0 });
  });

  it("opens one session for the day and reuses it", async () => {
    const client = new FakeClient();
    const { scrubber, opened } = controller([client]);
    scrubber.move(1000);
    await flush();
    client.answer();
    await flush();
    scrubber.end();
    scrubber.move(5000);
    await flush();
    expect(client.asked).toEqual([1000, 5000]);
    expect(opened()).toBe(1);
  });

  it("shows nothing once the drag ended, and asks no more", async () => {
    const client = new FakeClient();
    const { scrubber, shown } = controller([client]);
    scrubber.move(1000);
    await flush();
    scrubber.move(2000);
    scrubber.end();
    client.answer();
    await flush();
    expect(shown).toEqual([]);
    expect(client.asked).toEqual([1000]);
  });

  it("tells a miss, and opens a new session when the server closed this one", async () => {
    const first = new FakeClient();
    const second = new FakeClient();
    const { scrubber, missed, shown, opened } = controller([first, second]);
    scrubber.move(1000);
    await flush();
    first.answer({ at: 1000, error: "no recording at that moment", ms: 3 });
    await flush();
    expect(missed).toHaveLength(1);
    scrubber.move(2000);
    await flush();
    first.answer({ at: 2000, error: "the scrub session closed", ms: 1 });
    await flush();
    scrubber.move(3000);
    await flush();
    expect(opened()).toBe(2);
    second.answer();
    await flush();
    expect(shown.map((p) => p.at)).toEqual([3000]);
    expect(scrubber.counts).toEqual({ asked: 3, shown: 1, missed: 2 });
  });

  it("is unavailable for the day when the session cannot open", async () => {
    const { scrubber, shown, opened } = controller([], true);
    scrubber.move(1000);
    await flush();
    expect(scrubber.unavailable).toBe(true);
    scrubber.move(2000);
    await flush();
    expect(opened()).toBe(1);
    expect(shown).toEqual([]);
    // A new day (close) tries again.
    scrubber.close();
    expect(scrubber.unavailable).toBe(false);
  });

  it("closes the session when the day changes, and after a minute unused", async () => {
    const first = new FakeClient();
    const second = new FakeClient();
    const { scrubber } = controller([first, second]);
    scrubber.move(1000);
    await flush();
    first.answer();
    await flush();
    scrubber.close();
    await flush();
    expect(first.closed).toBe(true);

    vi.useFakeTimers();
    scrubber.move(2000);
    await vi.advanceTimersByTimeAsync(0);
    second.answer();
    await vi.advanceTimersByTimeAsync(0);
    scrubber.end();
    await vi.advanceTimersByTimeAsync(SESSION_IDLE_MS - 1000);
    expect(second.closed).toBe(false);
    await vi.advanceTimersByTimeAsync(1000);
    expect(second.closed).toBe(true);
  });

  it("keeps the session open while a drag goes on", async () => {
    vi.useFakeTimers();
    const client = new FakeClient();
    const { scrubber } = controller([client]);
    scrubber.move(1000);
    await vi.advanceTimersByTimeAsync(0);
    client.answer();
    await vi.advanceTimersByTimeAsync(0);
    // The pointer rests on the timeline, pressed, longer than the idle time.
    await vi.advanceTimersByTimeAsync(SESSION_IDLE_MS * 2);
    expect(client.closed).toBe(false);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

import { describePass, placeInRecording, spreadMoments } from "./check-util";
import { ASK_TIMEOUT_MS, ScrubClient, isPicture, readPicture, type SocketLike } from "./scrub-client";

/** A websocket the test drives: what was sent, and answers to give. */
class FakeSocket implements SocketLike {
  binaryType = "blob";
  readyState = 0;
  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  sent: { seq: number; at: number }[] = [];
  closed = false;

  open(): void {
    this.readyState = 1;
    this.onopen?.({});
  }

  send(data: string): void {
    this.sent.push(JSON.parse(data) as { seq: number; at: number });
  }

  close(): void {
    this.closed = true;
    this.readyState = 3;
  }

  answer(data: unknown): void {
    this.onmessage?.({ data });
  }
}

function message(header: Record<string, unknown>, init: number[], data: number[]): ArrayBuffer {
  const json = new TextEncoder().encode(JSON.stringify({ ...header, init: init.length, data: data.length }));
  const out = new Uint8Array(4 + json.length + init.length + data.length);
  new DataView(out.buffer).setUint32(0, json.length);
  out.set(json, 4);
  out.set(init, 4 + json.length);
  out.set(data, 4 + json.length + init.length);
  return out.buffer;
}

describe("the scrub session's client", () => {
  it("reads a picture: header, init, then the fragment", () => {
    const raw = message(
      { seq: 3, at: 5400, time: 5000, source: "cache", kind: "fmp4", codec: "avc1", timing: { ms: 4 } },
      [1, 2],
      [3, 4, 5],
    );
    expect(readPicture(raw, 12)).toEqual({
      seq: 3,
      at: 5400,
      time: 5000,
      source: "cache",
      kind: "fmp4",
      codec: "avc1",
      init: new Uint8Array([1, 2]),
      data: new Uint8Array([3, 4, 5]),
      serverMs: 4,
      ms: 12,
    });
    // The camera's key-frame interval, where the server sends it.
    const keyed = message({ seq: 4, at: 1, time: 1, source: "store", kind: "fmp4", codec: "avc1", interval: 1000 }, [], [1]);
    expect(readPicture(keyed, 1).interval).toBe(1000);
  });

  it("asks one moment at a time: a newer one supersedes the one waiting", async () => {
    const socket = new FakeSocket();
    let now = 0;
    const client = new ScrubClient(socket, () => now);
    expect(socket.binaryType).toBe("arraybuffer");
    socket.open();
    await client.ready();
    const first = client.ask(1000);
    await Promise.resolve();
    now = 50;
    const second = client.ask(2000);
    await Promise.resolve();
    expect(await first).toEqual({ at: 1000, error: "a newer moment was asked", superseded: true, ms: 50 });
    expect(socket.sent).toEqual([
      { seq: 1, at: 1000 },
      { seq: 2, at: 2000 },
    ]);
    // A late answer to the first is not taken for the second.
    socket.answer(message({ seq: 1, at: 1000, time: 900, source: "device", kind: "fmp4", codec: "c" }, [], [9]));
    now = 230;
    socket.answer(message({ seq: 2, at: 2000, time: 1000, source: "device", kind: "fmp4", codec: "c" }, [7], [8]));
    const answer = await second;
    expect(isPicture(answer)).toBe(true);
    expect(answer).toMatchObject({ at: 2000, time: 1000, source: "device", ms: 180 });
    // No picture: the server's reason.
    const third = client.ask(9999);
    await Promise.resolve();
    socket.answer(JSON.stringify({ seq: 3, at: 9999, error: "no recording at that moment" }));
    socket.answer("not json");
    const miss = await third;
    expect(isPicture(miss)).toBe(false);
    expect(miss).toMatchObject({ at: 9999, error: "no recording at that moment" });
    // Closed: what waits is answered, and later asks say so.
    const fourth = client.ask(1);
    await Promise.resolve();
    socket.onclose?.({});
    expect(await fourth).toMatchObject({ error: "the scrub session closed" });
    expect(await client.ask(2)).toMatchObject({ error: "the scrub session closed" });
    client.close();
    expect(socket.closed).toBe(true);
  });

  it("says when the session does not open", async () => {
    const socket = new FakeSocket();
    const client = new ScrubClient(socket);
    socket.onerror?.({});
    await expect(client.ready()).rejects.toThrow("could not open");
  });

  it("asks for whole milliseconds: a drag's time has fractions, which the server took for no request", async () => {
    const socket = new FakeSocket();
    const client = new ScrubClient(socket);
    socket.open();
    void client.ask(1792213260000.37);
    await Promise.resolve();
    await Promise.resolve();
    expect(socket.sent).toEqual([{ seq: 1, at: 1792213260000 }]);
  });

  it("gives up on an ask with no answer, so the next one is asked", async () => {
    vi.useFakeTimers();
    const socket = new FakeSocket();
    let now = 0;
    const client = new ScrubClient(socket, () => now);
    socket.open();
    const lost = client.ask(1000);
    await vi.advanceTimersByTimeAsync(0);
    now = ASK_TIMEOUT_MS;
    await vi.advanceTimersByTimeAsync(ASK_TIMEOUT_MS);
    expect(await lost).toEqual({ at: 1000, error: "no answer in time", ms: ASK_TIMEOUT_MS });
    // An answer that comes in time clears its own timer.
    const next = client.ask(2000);
    await vi.advanceTimersByTimeAsync(0);
    socket.answer(JSON.stringify({ seq: 2, error: "no recording at that moment" }));
    expect(await next).toMatchObject({ at: 2000, error: "no recording at that moment" });
    await vi.advanceTimersByTimeAsync(ASK_TIMEOUT_MS * 2);
    expect(socket.sent.map((m) => m.seq)).toEqual([1, 2]);
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the playback check's F row", () => {
  it("spreads moments over the day's recorded time", () => {
    const segments = [
      { start: 0, end: 1000 },
      { start: 5000, end: 8000 },
    ];
    expect(spreadMoments(segments, 4)).toEqual([500, 5500, 6500, 7500]);
    expect(spreadMoments([], 4)).toEqual([]);
    expect(spreadMoments(segments, 0)).toEqual([]);
  });

  it("says how a pass went", () => {
    expect(
      describePass({
        answered: [
          { ms: 210, source: "device", offsetMs: 1000 },
          { ms: 4, source: "cache", offsetMs: 0 },
          { ms: 190, source: "device", offsetMs: 2000 },
        ],
        missed: ["no recording at that moment", "no recording at that moment", "no picture from the device: x"],
      }),
    ).toBe(
      "3 of 6, median 190 ms (device 2, cache 1) · none for 2: no recording at that moment; 1: no picture from the device: x",
    );
    expect(describePass({ answered: [], missed: [] })).toBe("0 of 0");
  });

  it("says where a missed moment sits in its recording, from its nearer end", () => {
    const segments = [
      { start: 0, end: 19_000 },
      { start: 60_000, end: 3_660_000 },
    ];
    expect(placeInRecording(segments, 400)).toBe("0.4 s into a 19 s recording");
    expect(placeInRecording(segments, 17_800)).toBe("1.2 s before the end of a 19 s recording");
    expect(placeInRecording(segments, 60_000 + 25 * 60_000)).toBe("25.0 min into a 60.0 min recording");
    expect(placeInRecording(segments, 30_000)).toBe("in no recording");
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

import type { HomeAssistant } from "../types";
import {
  PcmConverter,
  START_TIMEOUT_MS,
  USUAL_RATE,
  TalkClient,
  sendPcm,
  talkUnavailable,
  type OpenCapture,
  type TalkStats,
} from "./talk";

const STATS: TalkStats = {
  open_ms: 512,
  blocks: 47,
  seconds: 3.01,
  gaps: 0,
  dropped_s: 0,
  ended: "stopped",
  error: null,
  close: "ok",
};

/** A hass whose talk subscription answers as the server does. */
function talkHass(options: { refuse?: string; silent?: boolean } = {}) {
  const sent: Uint8Array[] = [];
  const socket = {
    readyState: 1,
    send: vi.fn((data: Uint8Array) => {
      sent.push(data);
    }),
  };
  let emit: ((event: unknown) => void) | undefined;
  const unsubscribe = vi.fn(() => Promise.resolve());
  const callWS = vi.fn((message: Record<string, unknown>) => {
    if (message.type === "reolink_viewer/talk/stop") return Promise.resolve({ stats: STATS });
    return Promise.reject(new Error(`unexpected ${String(message.type)}`));
  });
  const subscribeMessage = vi.fn((callback: (event: unknown) => void, message: Record<string, unknown>) => {
    expect(message).toEqual({ type: "reolink_viewer/talk/start", device_id: "door" });
    // Home Assistant rejects with the error object { code, message }.
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- as it does
    if (options.refuse) return Promise.reject({ code: "talk_failed", message: options.refuse });
    emit = callback;
    // As Home Assistant does: the result, then the first event.
    if (!options.silent) {
      setTimeout(() => {
        callback({ type: "started", handler_id: 3, sample_rate: 16000, idle_s: 10, max_s: 300, open_ms: 512 });
      }, 0);
    }
    return Promise.resolve(unsubscribe);
  });
  const hass = { callWS, connection: { subscribeMessage, socket } } as unknown as HomeAssistant;
  return {
    hass,
    sent,
    socket,
    callWS,
    unsubscribe,
    connection: () => ({ subscribeMessage }),
    emit: (event: unknown) => emit?.(event),
  };
}

/** A microphone whose tracks are recorded when stopped. */
function fakeMic() {
  const track = { stop: vi.fn() };
  return { stream: { getTracks: () => [track] } as unknown as MediaStream, track };
}

/** A capture at ``rate`` whose pieces the test pushes. */
function fakeCapture(rate = 48000) {
  let piece: ((audio: Float32Array) => void) | undefined;
  const stop = vi.fn();
  const close = vi.fn();
  const capture: OpenCapture = vi.fn(() => ({
    start: (_stream: MediaStream, onPiece: (audio: Float32Array) => void) => {
      piece = onPiece;
      return Promise.resolve({ rate, stop });
    },
    close,
  }));
  return { capture, stop, close, push: (audio: Float32Array) => piece?.(audio) };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("PcmConverter", () => {
  it("passes audio at the camera's rate through as 16-bit samples", () => {
    const converter = new PcmConverter(16000, 16000);
    const out = converter.push(Float32Array.from([0, 0.5, -0.5, 1, -1, 2]));
    // The last sample waits for the next piece (it is read between two).
    expect(Array.from(out)).toEqual([0, 16384, -16383, 32767, -32767]);
    expect(Array.from(converter.push(Float32Array.from([0])))).toEqual([32767]);
  });

  it("brings 48 kHz down to 16 kHz, a tone kept and the length a third", () => {
    const converter = new PcmConverter(48000, 16000);
    const tone = (from: number, count: number) =>
      Float32Array.from({ length: count }, (_, i) => 0.5 * Math.sin((2 * Math.PI * 440 * (from + i)) / 48000));
    const pieces = [converter.push(tone(0, 3072)), converter.push(tone(3072, 3072))];
    const total = pieces.reduce((sum, piece) => sum + piece.length, 0);
    expect(Math.abs(total - 2048)).toBeLessThanOrEqual(1);
    // After the filter settles, a 440 Hz tone at half scale stays about that loud.
    const late = pieces[1] ?? new Int16Array();
    const peak = Math.max(...Array.from(late, Math.abs));
    expect(peak).toBeGreaterThan(14000);
    expect(peak).toBeLessThan(17500);
  });
});

describe("talkUnavailable", () => {
  const page = (secure: boolean, media: boolean, audio: boolean) =>
    ({
      isSecureContext: secure,
      navigator: media ? { mediaDevices: { getUserMedia: () => undefined } } : {},
      ...(audio ? { AudioContext: function AudioContext() {} } : {}),
    }) as unknown as Window;

  it("says why talk cannot work on a page", () => {
    expect(talkUnavailable(page(false, true, true))).toMatch(/secure page/);
    expect(talkUnavailable(page(true, false, true))).toMatch(/microphone/);
    expect(talkUnavailable(page(true, true, false))).toMatch(/capture audio/);
    expect(talkUnavailable(page(true, true, true))).toBeUndefined();
  });
});

describe("sendPcm", () => {
  it("sends the handler's byte, then the samples little-endian", () => {
    const sent: Uint8Array[] = [];
    const socket = { readyState: 1, send: (data: Uint8Array) => sent.push(data) } as unknown as WebSocket;
    expect(sendPcm(socket, 7, Int16Array.from([1, -2]))).toBe(true);
    expect(Array.from(sent[0] ?? [])).toEqual([7, 1, 0, 0xfe, 0xff]);
    // Nothing to send, or the socket closed: nothing sent.
    expect(sendPcm(socket, 7, new Int16Array())).toBe(false);
    expect(sendPcm({ readyState: 3 } as unknown as WebSocket, 7, Int16Array.from([1]))).toBe(false);
    expect(sendPcm(undefined, 7, Int16Array.from([1]))).toBe(false);
  });
});

describe("TalkClient", () => {
  it("asks for the microphone, starts the talk, sends the audio, and stops with its numbers", async () => {
    const fake = talkHass();
    const mic = fakeMic();
    const capture = fakeCapture(16000);
    const ended = vi.fn();
    const client = new TalkClient(fake.hass, "door", ended, capture.capture, () => Promise.resolve(mic.stream));
    const started = await client.start();
    expect(started.handler_id).toBe(3);
    capture.push(Float32Array.from({ length: 1025 }, () => 0.25));
    // 1,024 samples sent (the last waits for the next piece), behind the handler's byte.
    expect(fake.sent).toHaveLength(1);
    expect(fake.sent[0]?.[0]).toBe(3);
    expect(fake.sent[0]?.length).toBe(1 + 2 * 1024);
    expect(client.sentS).toBeCloseTo(0.064, 3);
    const stats = await client.stop();
    expect(stats).toEqual(STATS);
    expect(fake.callWS).toHaveBeenCalledWith({ type: "reolink_viewer/talk/stop", device_id: "door" });
    expect(fake.unsubscribe).toHaveBeenCalled();
    expect(capture.stop).toHaveBeenCalled();
    expect(mic.track.stop).toHaveBeenCalled();
    // Nothing more goes out once stopped.
    capture.push(Float32Array.from({ length: 1025 }, () => 0.25));
    expect(fake.sent).toHaveLength(1);
    expect(ended).not.toHaveBeenCalled();
  });

  it("opens the browser's audio in the press itself, before the microphone is given", async () => {
    const fake = talkHass();
    const mic = fakeMic();
    const capture = fakeCapture(16000);
    let give: (stream: MediaStream) => void = () => undefined;
    const client = new TalkClient(
      fake.hass,
      "door",
      vi.fn(),
      capture.capture,
      () =>
        new Promise<MediaStream>((resolve) => {
          give = resolve;
        }),
    );
    const starting = client.start();
    // Safari runs audio only from the press: opened before any wait.
    expect(capture.capture).toHaveBeenCalledWith(USUAL_RATE);
    give(mic.stream);
    await starting;
    await client.stop();
  });

  it("closes the audio when the microphone is refused", async () => {
    const fake = talkHass();
    const capture = fakeCapture();
    const blocked = new Error("Permission denied");
    const client = new TalkClient(fake.hass, "door", vi.fn(), capture.capture, () => Promise.reject(blocked));
    await expect(client.start()).rejects.toBe(blocked);
    expect(capture.close).toHaveBeenCalled();
    expect(fake.connection().subscribeMessage).not.toHaveBeenCalled();
  });

  it("lets go of the microphone when the server ends the talk", async () => {
    const fake = talkHass();
    const mic = fakeMic();
    const capture = fakeCapture();
    const ended = vi.fn();
    const client = new TalkClient(fake.hass, "door", ended, capture.capture, () => Promise.resolve(mic.stream));
    await client.start();
    fake.emit({ type: "ended", ...STATS, ended: "idle" });
    expect(ended).toHaveBeenCalledWith(expect.objectContaining({ ended: "idle" }));
    expect(capture.stop).toHaveBeenCalled();
    expect(mic.track.stop).toHaveBeenCalled();
    expect(fake.unsubscribe).toHaveBeenCalled();
    // Stopping it now asks nothing of the server.
    expect(await client.stop()).toBeNull();
    expect(fake.callWS).not.toHaveBeenCalled();
  });

  it("says why the camera did not start the talk, and lets go of the microphone", async () => {
    const fake = talkHass({ refuse: "Someone is already talking through this camera" });
    const mic = fakeMic();
    const client = new TalkClient(fake.hass, "door", vi.fn(), fakeCapture().capture, () =>
      Promise.resolve(mic.stream),
    );
    await expect(client.start()).rejects.toThrow(/already talking/);
    expect(mic.track.stop).toHaveBeenCalled();
  });

  it("gives up when the camera does not start the talk in time", async () => {
    vi.useFakeTimers();
    const fake = talkHass({ silent: true });
    const mic = fakeMic();
    const client = new TalkClient(fake.hass, "door", vi.fn(), fakeCapture().capture, () =>
      Promise.resolve(mic.stream),
    );
    const starting = client.start();
    const failed = expect(starting).rejects.toThrow(/in time/);
    await vi.advanceTimersByTimeAsync(START_TIMEOUT_MS + 1);
    await failed;
    expect(mic.track.stop).toHaveBeenCalled();
    expect(fake.unsubscribe).toHaveBeenCalled();
  });
});

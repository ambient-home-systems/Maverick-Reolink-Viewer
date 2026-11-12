import { afterEach, describe, expect, it, vi } from "vitest";

import type { Codecs, FrameLike } from "./keyframes";
import { MSE_SAMPLES } from "./mse-sample";
import type { ScrubPicture } from "./scrub-client";
import { KeyFramePainter, MsePainter } from "./scrub-paint";

const bytes = (base64: string): Uint8Array => Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

function join(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** The sample clip's key frame as the server sends a picture: its init, and its one-sample fragment. */
function picture(overrides: Partial<ScrubPicture> = {}): ScrubPicture {
  const sample = MSE_SAMPLES.h264;
  return {
    at: 5000,
    time: 4000,
    source: "store",
    kind: "fmp4",
    codec: "avc1.64000a",
    init: bytes(sample.init),
    data: join(bytes(sample.normalized), bytes(sample.mdat)),
    serverMs: 1,
    ms: 4,
    ...overrides,
  };
}

/** WebCodecs as the test drives it: decoders made, their configurations, the chunks. */
function fakeCodecs(options: { fail?: boolean; silent?: boolean } = {}) {
  const made: { configs: Record<string, unknown>[]; closed: boolean }[] = [];
  const chunks: { type: string; timestamp: number; data: Uint8Array }[] = [];
  const frames: { closed: boolean }[] = [];
  class Decoder {
    private readonly _record = { configs: [] as Record<string, unknown>[], closed: false };
    constructor(private readonly init: { output: (frame: FrameLike) => void; error: (err: Error) => void }) {
      made.push(this._record);
    }
    configure(config: Record<string, unknown>): void {
      this._record.configs.push(config);
    }
    decode(chunk: { type: string; timestamp: number; data: Uint8Array }): void {
      chunks.push(chunk);
      if (options.fail) {
        this.init.error(new Error("decoding error"));
        return;
      }
      if (options.silent) return;
      const frame = { displayWidth: 64, displayHeight: 64, closed: false, close: () => (frame.closed = true) };
      frames.push(frame);
      this.init.output(frame);
    }
    flush(): Promise<void> {
      return options.fail ? Promise.reject(new Error("flush failed")) : Promise.resolve();
    }
    close(): void {
      this._record.closed = true;
    }
  }
  const codecs: Pick<Codecs, "VideoDecoder" | "EncodedVideoChunk"> = {
    VideoDecoder: Decoder as unknown as Codecs["VideoDecoder"],
    EncodedVideoChunk: Object,
  };
  return { codecs, made, chunks, frames };
}

describe("painting a key frame with WebCodecs", () => {
  it("decodes the picture's key frame, draws it and lets it go", async () => {
    const { codecs, made, chunks, frames } = fakeCodecs();
    const painter = new KeyFramePainter(codecs);
    expect(painter.available).toBe(true);
    const drawn: FrameLike[] = [];
    expect(await painter.paint(picture(), (f) => drawn.push(f))).toBe(true);
    expect(drawn).toHaveLength(1);
    expect(frames[0]?.closed).toBe(true);
    expect(chunks[0]?.type).toBe("key");
    expect(chunks[0]?.data).toHaveLength(662);
    expect(made[0]?.configs[0]).toMatchObject({ codec: "avc1.64000a", codedWidth: 64, codedHeight: 64 });
    expect(made[0]?.configs[0]?.description).toHaveLength(39);
  });

  it("keeps its decoder while the stream stays the same, and makes another when it changes", async () => {
    const { codecs, made } = fakeCodecs();
    const painter = new KeyFramePainter(codecs);
    await painter.paint(picture(), () => undefined);
    await painter.paint(picture({ time: 8000 }), () => undefined);
    expect(made).toHaveLength(1);
    await painter.paint(picture({ codec: "avc1.640028" }), () => undefined);
    expect(made).toHaveLength(2);
    expect(made[0]?.closed).toBe(true);
    painter.close();
    expect(made[1]?.closed).toBe(true);
  });

  it("says it could not: a JPEG, no codec, a decoding error, no frame in time", async () => {
    const painter = new KeyFramePainter(fakeCodecs().codecs);
    expect(await painter.paint(picture({ kind: "jpeg" }), () => undefined)).toBe(false);
    expect(await painter.paint(picture({ codec: null }), () => undefined)).toBe(false);
    expect(await painter.paint(picture({ data: new Uint8Array(8) }), () => undefined)).toBe(false);

    const failing = fakeCodecs({ fail: true });
    const broken = new KeyFramePainter(failing.codecs);
    expect(await broken.paint(picture(), () => undefined)).toBe(false);
    // The failed decoder is not used again: the next picture gets a new one.
    await broken.paint(picture(), () => undefined);
    expect(failing.made).toHaveLength(2);

    expect(new KeyFramePainter({ VideoDecoder: undefined, EncodedVideoChunk: Object as never }).available).toBe(false);
  });

  it("gives up on a picture whose frame does not come", async () => {
    vi.useFakeTimers();
    const silent = fakeCodecs({ silent: true });
    const painter = new KeyFramePainter(silent.codecs);
    const painting = painter.paint(picture(), () => undefined);
    await vi.advanceTimersByTimeAsync(2000);
    expect(await painting).toBe(false);
    expect(silent.made[0]?.closed).toBe(true);
  });
});

afterEach(() => {
  vi.useRealTimers();
});

/** MSE as the test drives it: each append and remove ends at once. */
class FakeBuffer extends EventTarget {
  appended: Uint8Array[] = [];
  removed = 0;
  private _ranges: [number, number][] = [];

  get buffered(): { length: number; start: (i: number) => number; end: (i: number) => number } {
    const ranges = this._ranges;
    return { length: ranges.length, start: (i) => ranges[i]?.[0] ?? 0, end: (i) => ranges[i]?.[1] ?? 0 };
  }

  appendBuffer(data: Uint8Array): void {
    this.appended.push(data);
    this._ranges = [[0, 1]];
    queueMicrotask(() => this.dispatchEvent(new Event("updateend")));
  }

  remove(): void {
    this.removed += 1;
    this._ranges = [];
    queueMicrotask(() => this.dispatchEvent(new Event("updateend")));
  }
}

function fakeMse() {
  const sources: { types: string[]; buffer: FakeBuffer }[] = [];
  class Source extends EventTarget {
    readyState = "closed";
    readonly record = { types: [] as string[], buffer: new FakeBuffer() };
    constructor() {
      super();
      sources.push(this.record);
    }
    addSourceBuffer(type: string): SourceBuffer {
      this.record.types.push(type);
      return this.record.buffer as unknown as SourceBuffer;
    }
  }
  return { Source, sources };
}

/** A video that opens any source it is given and seeks at once. */
function fakeVideo(): HTMLVideoElement {
  const video = document.createElement("video");
  let time = 0;
  Object.defineProperty(video, "currentTime", {
    get: () => time,
    set: (value: number) => {
      time = value;
      queueMicrotask(() => video.dispatchEvent(new Event("seeked")));
    },
  });
  return video;
}

describe("painting a key frame through MSE", () => {
  it("appends the init once, each fragment alone, and shows its time", async () => {
    const { Source, sources } = fakeMse();
    const created: unknown[] = [];
    const open = vi.spyOn(URL, "createObjectURL").mockImplementation((source) => {
      created.push(source);
      queueMicrotask(() => (source as unknown as EventTarget).dispatchEvent(new Event("sourceopen")));
      return "blob:scrub";
    });
    try {
      const painter = new MsePainter(Source);
      expect(painter.available).toBe(true);
      const video = fakeVideo();
      expect(await painter.paint(picture(), video)).toBe(true);
      expect(sources[0]?.types).toEqual(['video/mp4; codecs="avc1.64000a"']);
      expect(sources[0]?.buffer.appended).toHaveLength(2);
      expect(video.currentTime).toBeCloseTo(0.001);
      // The next: the one before is removed; the same init is not appended again.
      expect(await painter.paint(picture({ time: 8000 }), video)).toBe(true);
      expect(sources[0]?.buffer.removed).toBe(1);
      expect(sources[0]?.buffer.appended).toHaveLength(3);
      expect(created).toHaveLength(1);
      // Another codec: a new source.
      expect(await painter.paint(picture({ codec: "avc1.640028" }), video)).toBe(true);
      expect(created).toHaveLength(2);
      painter.close(video);
      expect(video.getAttribute("src")).toBeNull();
    } finally {
      open.mockRestore();
    }
  });

  /** A painter whose sources open at once, with `video`; `buffer` changes the buffer's ways. */
  async function painted(video: HTMLVideoElement, setUp: (buffer: FakeBuffer) => void = () => undefined) {
    const { Source, sources } = fakeMse();
    const open = vi.spyOn(URL, "createObjectURL").mockImplementation((source) => {
      const record = sources.at(-1);
      if (record) setUp(record.buffer);
      queueMicrotask(() => (source as unknown as EventTarget).dispatchEvent(new Event("sourceopen")));
      return "blob:scrub";
    });
    try {
      const painter = new MsePainter(Source);
      const ok = await painter.paint(picture(), video);
      return { ok, failure: painter.lastFailure };
    } finally {
      open.mockRestore();
    }
  }

  it("keeps why a picture could not be shown (v0.63.9: the owner's Chrome on HTTP showed none)", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "setInterval"] });
    try {
      // The browser refuses the picture.
      const refusing = painted(fakeVideo(), (buffer) => {
        buffer.appendBuffer = function (this: FakeBuffer, data: Uint8Array) {
          this.appended.push(data);
          queueMicrotask(() => {
            this.dispatchEvent(new Event("error"));
            this.dispatchEvent(new Event("updateend"));
          });
        };
      });
      await vi.advanceTimersByTimeAsync(2_500);
      expect(await refusing).toEqual({ ok: false, failure: "the init segment was refused" });
      // A buffer that never takes it.
      const stuck = painted(fakeVideo(), (buffer) => {
        buffer.appendBuffer = () => undefined;
      });
      await vi.advanceTimersByTimeAsync(2_500);
      expect(await stuck).toEqual({ ok: false, failure: "the init segment was not taken within 2 s" });
      // A video that never gets there.
      const still = document.createElement("video");
      const never = painted(still);
      await vi.advanceTimersByTimeAsync(2_500);
      const result = await never;
      expect(result.ok).toBe(false);
      expect(result.failure).toBe("the video did not show it within 2 s (ready state 0, at 0.00 s for 0.00 s, buffered 0.00–1.00 s)");
    } finally {
      vi.useRealTimers();
    }
  });

  it("counts a picture shown once the video is at its time, though it never says seeked", async () => {
    // As a browser may not say it: no seeked, but there, with the frame (ready state 2).
    const video = document.createElement("video");
    let time = 0;
    Object.defineProperty(video, "currentTime", { get: () => time, set: (value: number) => (time = value) });
    Object.defineProperty(video, "readyState", { get: () => 2 });
    const { ok, failure } = await painted(video);
    expect(ok).toBe(true);
    expect(failure).toBeUndefined();
  });

  it("says it could not where there is no MSE or the source never opens", async () => {
    expect(new MsePainter(undefined).available).toBe(false);
    expect(await new MsePainter(undefined).paint(picture(), fakeVideo())).toBe(false);
    expect(await new MsePainter(fakeMse().Source as never).paint(picture({ kind: "jpeg" }), fakeVideo())).toBe(false);
  });
});

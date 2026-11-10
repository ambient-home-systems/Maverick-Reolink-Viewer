import { describe, expect, it } from "vitest";

import {
  DECODE_GATE_MS,
  DECODE_MAX,
  decodeKeyFrames,
  describeKeyFrames,
  keyFrames,
  videoCodec,
  videoTrack,
  type Codecs,
  type KeyFrame,
  type VideoTrack,
} from "./keyframes";
import { MSE_SAMPLES } from "./mse-sample";

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

function u32(...values: number[]): Uint8Array {
  const out = new Uint8Array(values.length * 4);
  const view = new DataView(out.buffer);
  values.forEach((v, i) => {
    view.setUint32(i * 4, v);
  });
  return out;
}

function box(type: string, ...body: Uint8Array[]): Uint8Array {
  const payload = join(...body);
  const head = u32(8 + payload.length);
  return join(head, Uint8Array.from(type, (c) => c.charCodeAt(0)), payload);
}

const SYNC = 0x02000000; // depends on no other sample
const NON_SYNC = 0x01010000; // depends on others, not a sync sample

/**
 * A fragment of track 1 as the server serves them: tfhd with
 * default-base-is-moof, a version 1 tfdt, and a trun with a data offset,
 * sizes and flags; its samples hold their own index.
 */
function fragment(decodeTime: number, samples: { size: number; flags: number }[], perSampleFlags = true): Uint8Array {
  const tfhd = box("tfhd", u32(0x020000, 1));
  const tfdt = box("tfdt", u32(0x01000000, 0, decodeTime));
  const trunFlags = 0x1 | 0x100 | 0x200 | (perSampleFlags ? 0x400 : 0x4);
  const rows = samples.flatMap((s) => (perSampleFlags ? [100, s.size, s.flags] : [100, s.size]));
  const trunBody = (offset: number) =>
    perSampleFlags
      ? u32(trunFlags, samples.length, offset, ...rows)
      : u32(trunFlags, samples.length, offset, samples[0]?.flags ?? 0, ...rows);
  const size = (offset: number) => box("moof", box("mfhd", u32(0, 1)), box("traf", tfhd, tfdt, box("trun", trunBody(offset)))).length;
  const moofSize = size(0);
  const moof = box("moof", box("mfhd", u32(0, 1)), box("traf", tfhd, tfdt, box("trun", trunBody(moofSize + 8))));
  const data = join(...samples.map((s, i) => new Uint8Array(s.size).fill(i + 1)));
  return join(moof, box("mdat", data));
}

const TRACK: VideoTrack = {
  trackId: 1,
  timescale: 1000,
  entry: "avc1",
  description: undefined,
  width: 896,
  height: 512,
  defaultDuration: 0,
  defaultSize: 0,
  defaultFlags: NON_SYNC,
};

describe("key frames out of the MSE fragments", () => {
  it("reads the video track of an init segment", () => {
    const track = videoTrack(bytes(MSE_SAMPLES.h264.init));
    expect(track).toMatchObject({ trackId: 1, timescale: 10240, entry: "avc1", width: 64, height: 64 });
    // The avcC box's payload, as the decoder's description.
    expect(track?.description?.[0]).toBe(1);
    expect(track?.description).toHaveLength(39);
    expect(videoTrack(new Uint8Array(16))).toBeUndefined();
  });

  it("finds the sample clip's key frame, and none where the offsets point into a file", () => {
    const sample = MSE_SAMPLES.h264;
    const track = videoTrack(bytes(sample.init));
    if (!track) throw new Error("no track");
    const frames = keyFrames(join(bytes(sample.normalized), bytes(sample.mdat)), track);
    expect(frames).toHaveLength(1);
    expect(frames[0]?.timeS).toBe(0);
    expect(frames[0]?.data).toHaveLength(662);
    // Length-prefixed NAL units, as avc1 keeps them.
    expect([...(frames[0]?.data.subarray(0, 4) ?? [])]).toEqual([0, 0, 2, 111]);
    expect(keyFrames(join(bytes(sample.absolute), bytes(sample.mdat)), track)).toEqual([]);
  });

  it("keeps the sync samples of every fragment, at their own times", () => {
    const window = join(
      fragment(2000, [
        { size: 30, flags: SYNC },
        { size: 5, flags: NON_SYNC },
        { size: 6, flags: NON_SYNC },
      ]),
      fragment(2300, [
        { size: 40, flags: NON_SYNC },
        { size: 31, flags: SYNC },
      ]),
      // first-sample-flags, the others from trex's defaults.
      fragment(2500, [{ size: 32, flags: SYNC }, { size: 7, flags: 0 }], false),
    );
    const frames = keyFrames(window, TRACK);
    expect(frames.map((f) => [f.timeS, f.data.length, f.data[0]])).toEqual([
      [2, 30, 1],
      [2.4, 31, 2],
      [2.5, 32, 1],
    ]);
    // Another track's fragments are not read.
    expect(keyFrames(window, { ...TRACK, trackId: 2 })).toEqual([]);
  });

  it("reads the video codec of the server's mime header", () => {
    expect(videoCodec('video/mp4; codecs="avc1.640028, mp4a.40.2"')).toBe("avc1.640028");
    expect(videoCodec('video/mp4; codecs="mp4a.40.2,hvc1.1.6.L150.90"')).toBe("hvc1.1.6.L150.90");
    expect(videoCodec("video/mp4")).toBeUndefined();
  });
});

function fakeCodecs(options: { supported?: boolean; decodeMs?: number; fail?: number; draw?: boolean } = {}): Codecs & {
  clock: { t: number };
  configs: Record<string, unknown>[];
  chunks: { type: string; timestamp: number; data: Uint8Array }[];
} {
  const clock = { t: 0 };
  const configs: Record<string, unknown>[] = [];
  const chunks: { type: string; timestamp: number; data: Uint8Array }[] = [];
  class Decoder {
    static isConfigSupported(config: Record<string, unknown>) {
      configs.push(config);
      return Promise.resolve({ supported: options.supported ?? true });
    }
    constructor(private readonly init: { output: (frame: never) => void; error: (err: Error) => void }) {}
    configure(): void {
      // Nothing to set up.
    }
    decode(chunk: { type: string; timestamp: number; data: Uint8Array }): void {
      chunks.push(chunk);
      // The first takes longer: the decoder starts.
      clock.t += chunks.length === 1 ? 20 : (options.decodeMs ?? 4);
      if (chunks.length === options.fail) {
        this.init.error(new Error("decoding error"));
        return;
      }
      this.init.output({ displayWidth: 896, displayHeight: 512, close: () => undefined } as never);
    }
    flush(): Promise<void> {
      return Promise.resolve();
    }
    close(): void {
      // Nothing held.
    }
  }
  // As WebCodecs' chunk: its type, time and data.
  const Chunk = Object as unknown as Codecs["EncodedVideoChunk"];
  return {
    clock,
    configs,
    chunks,
    VideoDecoder: Decoder,
    EncodedVideoChunk: Chunk,
    draw:
      options.draw === false
        ? undefined
        : () => {
            clock.t += 0.5;
          },
    now: () => clock.t,
  };
}

const FRAMES: KeyFrame[] = Array.from({ length: 15 }, (_, i) => ({
  timeS: 10 + 2 * i,
  data: new Uint8Array(30_000 + 1024 * i),
}));

describe("decoding one key frame at a time", () => {
  it("times each, from decode() to its frame, and its drawing", async () => {
    const codecs = fakeCodecs();
    const decoded = await decodeKeyFrames("avc1.640028", { ...TRACK, description: new Uint8Array([1, 2]) }, FRAMES, codecs);
    expect(decoded).toMatchObject({ available: true, supported: true, width: 896, height: 512 });
    expect(decoded.decodeMs).toHaveLength(DECODE_MAX);
    expect(decoded.decodeMs[0]).toBe(20);
    expect(decoded.decodeMs.slice(1).every((ms) => ms === 4)).toBe(true);
    expect(decoded.drawMs.every((ms) => ms === 0.5)).toBe(true);
    expect(codecs.configs[0]).toMatchObject({
      codec: "avc1.640028",
      codedWidth: 896,
      codedHeight: 512,
      optimizeForLatency: true,
      description: new Uint8Array([1, 2]),
    });
    expect(codecs.chunks[1]).toMatchObject({ type: "key", timestamp: 12_000_000 });
    const line = describeKeyFrames("SD", "avc1.640028", TRACK, FRAMES, decoded);
    expect(line.text).toBe(
      "SD avc1.640028 896×512: 15 key frames in 28.0 s of media, every 2.0 s, 29 KB–43 KB (median 36 KB)" +
        " · VideoDecoder: one in 4.0 ms (median of 11; the first 20.0 ms), drawn on a canvas in 0.5 ms at 896×512" +
        ` · gate ${String(DECODE_GATE_MS)} ms: passes`,
    );
    expect(line.short).toBe("SD 4.0 ms to decode (VideoDecoder), every 2.0 s");
    expect(line.decodeMs).toBe(4);
  });

  it("says when decoding is slow, refused, failing or not there", async () => {
    const slow = await decodeKeyFrames("hvc1.1.6.L150.90", TRACK, FRAMES.slice(0, 3), fakeCodecs({ decodeMs: 45, draw: false }));
    const slowLine = describeKeyFrames("HD", "hvc1.1.6.L150.90", TRACK, FRAMES.slice(0, 3), slow);
    expect(slowLine.text).toContain("one in 45.0 ms (median of 2; the first 20.0 ms) at 896×512 · gate 30 ms: fails");
    expect(slowLine.text).not.toContain("canvas");

    const refused = await decodeKeyFrames("hvc1.1.6.L150.90", TRACK, FRAMES, fakeCodecs({ supported: false }));
    expect(refused).toMatchObject({ available: true, supported: false, decodeMs: [] });
    expect(describeKeyFrames("HD", "hvc1.1.6.L150.90", TRACK, FRAMES, refused).text).toContain(
      "VideoDecoder does not decode hvc1.1.6.L150.90",
    );

    const failing = await decodeKeyFrames("avc1.640028", TRACK, FRAMES, fakeCodecs({ fail: 3 }));
    expect(failing.decodeMs).toHaveLength(2);
    expect(failing.error).toBe("decoding error");
    expect(describeKeyFrames("SD", "avc1.640028", TRACK, FRAMES, failing).text).toContain("then failed: decoding error");

    const absent = await decodeKeyFrames("avc1.640028", TRACK, FRAMES, { ...fakeCodecs(), VideoDecoder: undefined });
    expect(absent).toEqual({ available: false, decodeMs: [], drawMs: [] });
    const absentLine = describeKeyFrames("SD", "avc1.640028", TRACK, FRAMES.slice(0, 1), absent);
    expect(absentLine.text).toBe(
      "SD avc1.640028 896×512: 1 key frame, 29 KB–29 KB (median 29 KB) · VideoDecoder absent: a scrub would decode through a hidden MSE video here",
    );
    expect(absentLine.short).toBe("SD: no VideoDecoder");
  });
});

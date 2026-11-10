// Key frames out of the MSE player's fragments, and how long this device takes
// to decode one on its own (Phase 10 step 0, the gate's browser half).
// Scrubbing that shows the picture would decode each key frame a drag reaches
// onto a canvas over the video (WebCodecs' VideoDecoder); the playback check
// measures it here on the recording it plays, before any of that is built.
//
// The server's fragments are MSE-ready (fmp4.py: moof-relative data offsets
// and a tfdt in every traf), so a key frame is read straight out of a window.

/** The video track of an init segment: what a decoder needs, and its defaults. */
export interface VideoTrack {
  trackId: number;
  timescale: number;
  /** The sample entry, e.g. "avc1", "hvc1". */
  entry: string;
  /** The avcC or hvcC box's payload: the decoder's `description`. */
  description: Uint8Array | undefined;
  width: number;
  height: number;
  /** trex's defaults for the track's fragments. */
  defaultDuration: number;
  defaultSize: number;
  defaultFlags: number;
}

export interface KeyFrame {
  /** Its decode time in the recording (s). */
  timeS: number;
  data: Uint8Array;
}

interface Box {
  type: string;
  start: number;
  /** Where its payload starts. */
  body: number;
  end: number;
}

/** sample_is_non_sync_sample in a sample's flags. */
const NON_SYNC = 0x10000;

function* boxes(data: Uint8Array, start: number, end: number): Generator<Box> {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let at = start;
  while (at + 8 <= end) {
    let size = view.getUint32(at);
    const type = String.fromCharCode(data[at + 4] ?? 0, data[at + 5] ?? 0, data[at + 6] ?? 0, data[at + 7] ?? 0);
    let body = at + 8;
    if (size === 1) {
      if (at + 16 > end) return;
      size = Number(view.getBigUint64(at + 8));
      body = at + 16;
    } else if (size === 0) {
      size = end - at;
    }
    if (size < body - at || at + size > end) return;
    yield { type, start: at, body, end: at + size };
    at += size;
  }
}

function child(data: Uint8Array, box: Box, type: string, skip = 0): Box | undefined {
  for (const b of boxes(data, box.body + skip, box.end)) if (b.type === type) return b;
  return undefined;
}

function path(data: Uint8Array, box: Box, ...types: string[]): Box | undefined {
  let at: Box | undefined = box;
  for (const type of types) {
    if (!at) return undefined;
    at = child(data, at, type);
  }
  return at;
}

/** The video track of an init segment, or undefined without one. */
export function videoTrack(init: Uint8Array): VideoTrack | undefined {
  const view = new DataView(init.buffer, init.byteOffset, init.byteLength);
  const moov = [...boxes(init, 0, init.length)].find((b) => b.type === "moov");
  if (!moov) return undefined;
  for (const trak of boxes(init, moov.body, moov.end)) {
    if (trak.type !== "trak") continue;
    const hdlr = path(init, trak, "mdia", "hdlr");
    if (!hdlr || String.fromCharCode(...init.subarray(hdlr.body + 8, hdlr.body + 12)) !== "vide") continue;
    const tkhd = child(init, trak, "tkhd");
    const mdhd = path(init, trak, "mdia", "mdhd");
    const stsd = path(init, trak, "mdia", "minf", "stbl", "stsd");
    if (!tkhd || !mdhd || !stsd) continue;
    const trackId = view.getUint32(tkhd.body + (init[tkhd.body] === 1 ? 20 : 12));
    const timescale = view.getUint32(mdhd.body + (init[mdhd.body] === 1 ? 20 : 12));
    // stsd: version and flags, the entry count, then the sample entries.
    let entry: Box | undefined;
    for (const first of boxes(init, stsd.body + 8, stsd.end)) {
      entry = first;
      break;
    }
    if (!entry) continue;
    // A visual sample entry: 78 bytes of fields (its size at 24), then boxes.
    const config = [...boxes(init, entry.body + 78, entry.end)].find((b) => b.type === "avcC" || b.type === "hvcC");
    const track: VideoTrack = {
      trackId,
      timescale,
      entry: entry.type,
      description: config ? init.slice(config.body, config.end) : undefined,
      width: view.getUint16(entry.body + 24),
      height: view.getUint16(entry.body + 26),
      defaultDuration: 0,
      defaultSize: 0,
      defaultFlags: 0,
    };
    const mvex = child(init, moov, "mvex");
    for (const trex of mvex ? boxes(init, mvex.body, mvex.end) : []) {
      if (trex.type !== "trex" || view.getUint32(trex.body + 4) !== trackId) continue;
      track.defaultDuration = view.getUint32(trex.body + 12);
      track.defaultSize = view.getUint32(trex.body + 16);
      track.defaultFlags = view.getUint32(trex.body + 20);
    }
    return track;
  }
  return undefined;
}

/** The key frames of a window of fragments (moof + mdat pairs), in order. */
export function keyFrames(data: Uint8Array, track: VideoTrack): KeyFrame[] {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const found: KeyFrame[] = [];
  for (const moof of boxes(data, 0, data.length)) {
    if (moof.type !== "moof") continue;
    for (const traf of boxes(data, moof.body, moof.end)) {
      if (traf.type !== "traf") continue;
      const tfhd = child(data, traf, "tfhd");
      if (!tfhd || view.getUint32(tfhd.body + 4) !== track.trackId) continue;
      const flags = view.getUint32(tfhd.body) & 0xffffff;
      // An absolute base offset points into the file, not this window.
      if (flags & 0x1) continue;
      let at = tfhd.body + 8;
      if (flags & 0x2) at += 4;
      let duration = track.defaultDuration;
      let size = track.defaultSize;
      let sampleFlags = track.defaultFlags;
      if (flags & 0x8) duration = view.getUint32((at += 4) - 4);
      if (flags & 0x10) size = view.getUint32((at += 4) - 4);
      if (flags & 0x20) sampleFlags = view.getUint32(at);
      const tfdt = child(data, traf, "tfdt");
      let time = tfdt ? (data[tfdt.body] === 1 ? Number(view.getBigUint64(tfdt.body + 4)) : view.getUint32(tfdt.body + 4)) : 0;
      let next = moof.start;
      for (const trun of boxes(data, traf.body, traf.end)) {
        if (trun.type !== "trun") continue;
        const runFlags = view.getUint32(trun.body) & 0xffffff;
        const count = view.getUint32(trun.body + 4);
        let p = trun.body + 8;
        if (runFlags & 0x1) next = moof.start + view.getInt32((p += 4) - 4);
        let first: number | undefined;
        if (runFlags & 0x4) first = view.getUint32((p += 4) - 4);
        for (let i = 0; i < count; i += 1) {
          const d = runFlags & 0x100 ? view.getUint32((p += 4) - 4) : duration;
          const s = runFlags & 0x200 ? view.getUint32((p += 4) - 4) : size;
          let f = runFlags & 0x400 ? view.getUint32((p += 4) - 4) : sampleFlags;
          if (runFlags & 0x800) p += 4;
          if (i === 0 && first !== undefined) f = first;
          if (!(f & NON_SYNC) && next + s <= data.length) {
            found.push({ timeS: time / track.timescale, data: data.subarray(next, next + s) });
          }
          next += s;
          time += d;
        }
      }
    }
  }
  return found;
}

/** The video codec in an X-RV-Mime header, e.g. "avc1.640028". */
export function videoCodec(mime: string): string | undefined {
  const codecs = /codecs="([^"]*)"/.exec(mime)?.[1] ?? "";
  return codecs
    .split(",")
    .map((c) => c.trim())
    .find((c) => /^(avc|hev|hvc)/.test(c));
}

// ---- Decoding, one key frame at a time ----

export interface DecoderLike {
  configure(config: Record<string, unknown>): void;
  decode(chunk: unknown): void;
  flush(): Promise<void>;
  close(): void;
}

export interface FrameLike {
  displayWidth: number;
  displayHeight: number;
  close(): void;
}

/** What decodes: WebCodecs, or a stand-in in the tests. */
export interface Codecs {
  VideoDecoder:
    | (new (init: { output: (frame: FrameLike) => void; error: (err: Error) => void }) => DecoderLike) & {
        isConfigSupported(config: Record<string, unknown>): Promise<{ supported?: boolean }>;
      }
    | undefined;
  EncodedVideoChunk: new (init: { type: "key"; timestamp: number; data: Uint8Array }) => unknown;
  /** Draws a frame where a scrub would paint it (undefined: not measured). */
  draw?: ((frame: FrameLike) => void) | undefined;
  now: () => number;
}

export interface Decoded {
  /** No VideoDecoder at all (the MSE fallback would be used). */
  available: boolean;
  supported?: boolean;
  /** Per key frame: from decode() to its frame. */
  decodeMs: number[];
  /** Per key frame: drawing it on a canvas. */
  drawMs: number[];
  width?: number;
  height?: number;
  error?: string;
}

/** At most this many key frames are decoded. */
export const DECODE_MAX = 12;
const FRAME_TIMEOUT_MS = 3000;

/** WebCodecs as this browser has it (VideoDecoder undefined where it has none). */
export function webCodecs(): Pick<Codecs, "VideoDecoder" | "EncodedVideoChunk"> {
  const w = window as unknown as Record<string, unknown>;
  return {
    VideoDecoder: typeof w.VideoDecoder === "function" ? (w.VideoDecoder as Codecs["VideoDecoder"]) : undefined,
    EncodedVideoChunk: w.EncodedVideoChunk as Codecs["EncodedVideoChunk"],
  };
}

function browserCodecs(): Codecs {
  const w = window as unknown as Record<string, unknown>;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  return {
    VideoDecoder: typeof w.VideoDecoder === "function" ? (w.VideoDecoder as Codecs["VideoDecoder"]) : undefined,
    EncodedVideoChunk: w.EncodedVideoChunk as Codecs["EncodedVideoChunk"],
    draw: context
      ? (frame) => {
          canvas.width = frame.displayWidth;
          canvas.height = frame.displayHeight;
          context.drawImage(frame as unknown as CanvasImageSource, 0, 0);
        }
      : undefined,
    now: () => performance.now(),
  };
}

/**
 * Decode key frames one at a time, each flushed on its own as a scrub would
 * (each is a picture alone, not part of a stream); never rejects.
 */
export async function decodeKeyFrames(
  codec: string,
  track: VideoTrack,
  frames: readonly KeyFrame[],
  codecs: Codecs = browserCodecs(),
): Promise<Decoded> {
  const result: Decoded = { available: codecs.VideoDecoder !== undefined, decodeMs: [], drawMs: [] };
  const Decoder = codecs.VideoDecoder;
  if (!Decoder) return result;
  const config: Record<string, unknown> = {
    codec,
    codedWidth: track.width,
    codedHeight: track.height,
    optimizeForLatency: true,
    ...(track.description ? { description: track.description } : {}),
  };
  try {
    result.supported = (await Decoder.isConfigSupported(config)).supported === true;
  } catch (err) {
    result.supported = false;
    result.error = String(err);
  }
  if (!result.supported) return result;
  let waiting: { resolve: (out: { frame: FrameLike; at: number }) => void; reject: (err: Error) => void } | undefined;
  const decoder = new Decoder({
    output: (frame) => {
      if (waiting) waiting.resolve({ frame, at: codecs.now() });
      else frame.close();
    },
    error: (err) => waiting?.reject(err),
  });
  try {
    decoder.configure(config);
    for (const key of frames.slice(0, DECODE_MAX)) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const output = new Promise<{ frame: FrameLike; at: number }>((resolve, reject) => {
        waiting = { resolve, reject };
        timer = setTimeout(() => {
          reject(new Error(`no frame within ${String(FRAME_TIMEOUT_MS)} ms`));
        }, FRAME_TIMEOUT_MS);
      });
      const began = codecs.now();
      decoder.decode(new codecs.EncodedVideoChunk({ type: "key", timestamp: Math.round(key.timeS * 1e6), data: key.data }));
      const [{ frame, at }] = await Promise.all([output, decoder.flush()]).finally(() => {
        clearTimeout(timer);
        waiting = undefined;
      });
      result.decodeMs.push(at - began);
      result.width = frame.displayWidth;
      result.height = frame.displayHeight;
      if (codecs.draw) {
        const drawn = codecs.now();
        codecs.draw(frame);
        result.drawMs.push(codecs.now() - drawn);
      }
      frame.close();
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
  } finally {
    try {
      decoder.close();
    } catch {
      // Closed already, after an error.
    }
  }
  return result;
}

// ---- The playback check's K line ----

/** The gate (docs/IMPLEMENTATION_PLAN.md, step 10.0): a key frame decoded in this much or less. */
export const DECODE_GATE_MS = 30;

const tenth = (value: number): string => `${value.toFixed(1)} ms`;

function median(values: readonly number[]): number | undefined {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

const kb = (bytes: number): string => `${String(Math.round(bytes / 1024))} KB`;

/** The K line: the key frames read and how they decode; and its summary. */
export function describeKeyFrames(
  label: string,
  codec: string,
  track: VideoTrack,
  frames: readonly KeyFrame[],
  decoded: Decoded,
): { text: string; short: string; decodeMs: number | undefined } {
  const sizes = frames.map((f) => f.data.length);
  const steps = frames.slice(1).map((f, i) => f.timeS - (frames[i]?.timeS ?? f.timeS));
  const interval = median(steps.filter((s) => s > 0));
  const spanS = frames.length > 1 ? (frames.at(-1)?.timeS ?? 0) - (frames[0]?.timeS ?? 0) : 0;
  const read =
    `${label} ${codec} ${String(track.width)}×${String(track.height)}: ${String(frames.length)} key frame${frames.length === 1 ? "" : "s"}` +
    (frames.length > 1 ? ` in ${spanS.toFixed(1)} s of media, every ${(interval ?? 0).toFixed(1)} s` : "") +
    (sizes.length ? `, ${kb(Math.min(...sizes))}–${kb(Math.max(...sizes))} (median ${kb(median(sizes) ?? 0)})` : "");
  if (!decoded.available) {
    return {
      text: `${read} · VideoDecoder absent: a scrub would decode through a hidden MSE video here`,
      short: `${label}: no VideoDecoder`,
      decodeMs: undefined,
    };
  }
  if (!decoded.supported) {
    return {
      text: `${read} · VideoDecoder does not decode ${codec}${decoded.error ? ` (${decoded.error})` : ""}`,
      short: `${label}: VideoDecoder refuses ${codec}`,
      decodeMs: undefined,
    };
  }
  // The first includes the decoder's start: said apart.
  const [first, ...rest] = decoded.decodeMs;
  const typical = median(rest.length ? rest : decoded.decodeMs);
  const drawn = median(decoded.drawMs);
  const passes = typical !== undefined && typical <= DECODE_GATE_MS;
  const decodeText =
    typical === undefined
      ? `VideoDecoder decoded none${decoded.error ? ` (${decoded.error})` : ""}`
      : `VideoDecoder: one in ${tenth(typical)} (median of ${String(rest.length || decoded.decodeMs.length)}` +
        `${rest.length ? `; the first ${tenth(first)}` : ""})` +
        (drawn !== undefined ? `, drawn on a canvas in ${tenth(drawn)}` : "") +
        (decoded.width ? ` at ${String(decoded.width)}×${String(decoded.height ?? 0)}` : "") +
        (decoded.error ? ` · then failed: ${decoded.error}` : "") +
        ` · gate ${String(DECODE_GATE_MS)} ms: ${passes ? "passes" : "fails"}`;
  return {
    text: `${read} · ${decodeText}`,
    short:
      typical === undefined
        ? `${label}: none decoded`
        : `${label} ${tenth(typical)} to decode (VideoDecoder)${interval ? `, every ${interval.toFixed(1)} s` : ""}`,
    decodeMs: typical,
  };
}

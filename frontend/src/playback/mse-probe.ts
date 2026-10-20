// Can this browser play fragments appended through Media Source Extensions,
// and which fragment shapes does it accept? Phase 2B weighs an MSE player
// against plain <video>; this answers it on each device, with a 1 s clip
// (mse-sample.ts) in the shape MSE requires and in the NVR's shapes.
import { MSE_SAMPLES, type MseSample } from "./mse-sample";

export type MseApi = "MediaSource" | "ManagedMediaSource";
export type FragmentShape = "normalized" | "absolute" | "noTfdt" | "nvr";

export const SHAPES: readonly { shape: FragmentShape; label: string }[] = [
  { shape: "normalized", label: "MSE-ready fragment" },
  { shape: "absolute", label: "absolute offsets" },
  { shape: "noTfdt", label: "no tfdt" },
  { shape: "nvr", label: "NVR shape (both)" },
];

interface MediaSourceLike extends EventTarget {
  readyState: string;
  addSourceBuffer(type: string): SourceBuffer;
  endOfStream(): void;
}

type MediaSourceCtor = (new () => MediaSourceLike) & { isTypeSupported(type: string): boolean };

/** The constructor of an MSE API, if this browser has it. */
export function mseApi(api: MseApi): MediaSourceCtor | undefined {
  const ctor = (window as unknown as Record<string, unknown>)[api];
  return typeof ctor === "function" ? (ctor as MediaSourceCtor) : undefined;
}

/** isTypeSupported for an MP4 codec string, or undefined without the API. */
export function mseSupports(api: MseApi, codec: string): boolean | undefined {
  const ctor = mseApi(api);
  if (!ctor) return undefined;
  try {
    return ctor.isTypeSupported(`video/mp4; codecs="${codec}"`);
  } catch {
    return false;
  }
}

/** The sample this browser can decode (H.264 first), if any. */
export function pickSample(api: MseApi): { name: string; sample: MseSample } | undefined {
  for (const [name, sample] of Object.entries(MSE_SAMPLES)) {
    if (mseSupports(api, sample.codec)) return { name, sample };
  }
  return undefined;
}

const bytes = (base64: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

function concat(a: Uint8Array, b: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(a.length + b.length);
  out.set(a);
  out.set(b, a.length);
  return out;
}

function append(buffer: SourceBuffer, data: Uint8Array<ArrayBuffer>): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = () => {
      buffer.removeEventListener("updateend", done);
      buffer.removeEventListener("error", failed);
      resolve();
    };
    const failed = () => {
      buffer.removeEventListener("updateend", done);
      buffer.removeEventListener("error", failed);
      reject(new Error("append error"));
    };
    buffer.addEventListener("updateend", done);
    buffer.addEventListener("error", failed);
    buffer.appendBuffer(data);
  });
}

/**
 * Append the sample's init segment and one fragment of the given shape, then
 * play it. Resolves with what happened, e.g. "plays (180 ms)" or
 * "append error"; never rejects.
 */
export async function probeShape(
  api: MseApi,
  sample: MseSample,
  shape: FragmentShape,
  timeoutMs = 5000,
): Promise<string> {
  const Ctor = mseApi(api);
  if (!Ctor) return "not available";
  const began = performance.now();
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  // ManagedMediaSource plays only with remote playback (AirPlay) off.
  video.disableRemotePlayback = true;
  video.style.cssText = "position:fixed;left:-10px;top:-10px;width:2px;height:2px;opacity:0";
  document.body.append(video);
  const source = new Ctor();
  const url = URL.createObjectURL(source as unknown as MediaSource);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const outcome = new Promise<string>((resolve) => {
      timer = setTimeout(() => {
        resolve(source.readyState === "open" ? "timed out" : "timed out (source never opened)");
      }, timeoutMs);
      source.addEventListener(
        "sourceopen",
        () => {
          void (async () => {
            let buffer: SourceBuffer;
            try {
              buffer = source.addSourceBuffer(`video/mp4; codecs="${sample.codec}"`);
            } catch (err) {
              resolve(`addSourceBuffer failed (${String(err)})`);
              return;
            }
            try {
              await append(buffer, bytes(sample.init));
              await append(buffer, concat(bytes(sample[shape]), bytes(sample.mdat)));
            } catch {
              resolve("append error");
              return;
            }
            if (!buffer.buffered.length) {
              resolve("appended, nothing buffered");
              return;
            }
            try {
              source.endOfStream();
            } catch {
              // Playing does not need it.
            }
            const played = await playFrom(video, timeoutMs);
            resolve(played ? `plays (${Math.round(performance.now() - began)} ms)` : "buffered, does not play");
          })();
        },
        { once: true },
      );
    });
    video.src = url;
    return await outcome;
  } finally {
    clearTimeout(timer);
    video.removeAttribute("src");
    video.load();
    video.remove();
    URL.revokeObjectURL(url);
  }
}

function playFrom(video: HTMLVideoElement, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve(video.currentTime > 0);
    }, timeoutMs);
    const check = () => {
      if (video.currentTime > 0.05) {
        clearTimeout(timer);
        video.removeEventListener("timeupdate", check);
        resolve(true);
      }
    };
    video.addEventListener("timeupdate", check);
    video.play().catch(() => undefined);
  });
}

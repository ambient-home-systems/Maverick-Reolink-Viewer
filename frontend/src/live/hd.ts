// Which stream full screen plays in HD (step 1's rule for every setup,
// docs/IMPLEMENTATION_PLAN.md): the main stream where it is H.264, or H.265
// that this browser decodes smoothly at its size; otherwise the ext stream
// (H.264 on every camera). A main wider than 4096 pixels (the Duo 3's
// 7680×2160) always uses ext: many hardware decoders stop there, and a first
// frame says nothing about decoding 20 fps at that size.
import { decoder, type DecodingInfo } from "../playback/codec";
import type { LiveConnection, LiveStreamKind } from "../types";
import { MSE_CODECS } from "./check-util";

export const MAX_MAIN_WIDTH = 4096;
/** The H.265 codec asked for over MSE (Main profile). */
const HEVC = MSE_CODECS.find((codec) => codec.startsWith("hvc1.")) ?? "hvc1.1.6.L153.B0";

export interface HdChoice {
  /** The stream full screen plays; null: none better than the sub stream. */
  stream: LiveStreamKind | null;
  reason: string;
}

/** The HD stream for a connection, and why. */
export async function chooseHd(
  connection: LiveConnection,
  decodingInfo: DecodingInfo | undefined = decoder(),
): Promise<HdChoice> {
  const otherwise = (why: string): HdChoice =>
    connection.streams.ext
      ? { stream: "ext", reason: `ext: ${why}` }
      : { stream: null, reason: `SD only: ${why}, and there is no ext stream` };
  const main = connection.streams.main;
  if (!main) return otherwise("no main stream");
  const enc = main.encoding;
  const width = enc?.width ?? undefined;
  const height = enc?.height ?? undefined;
  const size = width && height ? `${width}×${height}` : undefined;
  if (width && width > MAX_MAIN_WIDTH) {
    return otherwise(`the main stream's ${size ?? `${width} pixels`} is wider than ${MAX_MAIN_WIDTH} pixels`);
  }
  const codec = enc?.codec?.toLowerCase();
  if (codec === "h264") return { stream: "main", reason: `main: H.264${size ? ` at ${size}` : ""}` };
  if (codec !== "h265" && codec !== "hevc") return otherwise(`the main stream's codec is ${codec ?? "unknown"}`);
  if (!width || !height || !size) return otherwise("the main stream is H.265 at an unknown size");
  if (!decodingInfo) return otherwise("this browser cannot say whether it decodes H.265");
  try {
    const info = await decodingInfo({
      type: "media-source",
      video: {
        contentType: `video/mp4; codecs="${HEVC}"`,
        width,
        height,
        bitrate: (enc?.bit_rate ?? 8000) * 1000,
        framerate: enc?.frame_rate ?? 25,
      },
    });
    if (!info.supported) return otherwise(`this browser cannot decode H.265 at ${size}`);
    if (!info.smooth) return otherwise(`H.265 at ${size} would not play smoothly here`);
    return { stream: "main", reason: `main: H.265 at ${size}, smooth here` };
  } catch {
    return otherwise(`this browser cannot check H.265 at ${size}`);
  }
}

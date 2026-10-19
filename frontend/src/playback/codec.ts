// Which stream to play. Sub streams (H.264, small) are the default. The main
// stream is used only when the browser says it can decode that codec at that
// size: four main streams are H.265, one (Duo 3) is 7680x2160.
import type { MediaInfo } from "../types";

export interface StreamDecision {
  main: boolean;
  reason: string;
}

type DecodingInfo = (config: MediaDecodingConfiguration) => Promise<MediaCapabilitiesDecodingInfo>;

function decoder(): DecodingInfo | undefined {
  // Older browsers have no MediaCapabilities at all.
  const caps = (navigator as { mediaCapabilities?: Partial<MediaCapabilities> }).mediaCapabilities;
  const decodingInfo = caps?.decodingInfo;
  return decodingInfo ? decodingInfo.bind(caps) : undefined;
}

/**
 * Can this browser play the main stream described by `info`? With no
 * information yet (no main recording cached), HD may be tried: the player
 * falls back to the sub stream if it fails, and the first main recording
 * cached tells the next check what it is.
 */
export async function canPlayMain(
  info: MediaInfo | null,
  decodingInfo: DecodingInfo | undefined = decoder(),
): Promise<StreamDecision> {
  if (!info) return { main: true, reason: "not tried yet: falls back to SD if this browser cannot play it" };
  if (!info.width || !info.height) return { main: false, reason: "main stream size unknown" };
  const size = `${info.codec} at ${info.width}×${info.height}`;
  if (!decodingInfo) {
    return { main: false, reason: "this browser cannot report what it decodes" };
  }
  try {
    const result = await decodingInfo({
      type: "file",
      video: {
        contentType: `video/mp4; codecs="${info.codec}"`,
        width: info.width,
        height: info.height,
        bitrate: 8_000_000,
        framerate: 25,
      },
    });
    if (!result.supported) return { main: false, reason: `this browser cannot decode ${size}` };
    if (!result.smooth) return { main: false, reason: `${size} would not play smoothly here` };
    return { main: true, reason: `${size} is supported` };
  } catch {
    return { main: false, reason: `this browser cannot check ${size}` };
  }
}

/**
 * Whether the browser plays MP4 while it downloads (progressive). Safari and
 * WebKit views (the iOS Companion app) want byte ranges from the first request,
 * so the server waits for the cached file to complete for them.
 */
export function playsProgressive(userAgent: string = navigator.userAgent): boolean {
  const webkitOnly = /AppleWebKit/.test(userAgent) && !/Chrome|Chromium|CriOS|Edg|Android|FxiOS/.test(userAgent);
  return !webkitOnly;
}

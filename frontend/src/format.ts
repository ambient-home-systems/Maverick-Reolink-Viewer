import type { ChannelInfo, DeviceType, StreamEncoding } from "./types";

const DEVICE_TYPE_LABELS: Record<DeviceType, string> = {
  camera: "Camera",
  nvr: "NVR",
  hub: "Home Hub",
};

export const deviceTypeLabel = (type: DeviceType): string => DEVICE_TYPE_LABELS[type];

/** "H.264 · 25 fps · 4096 kbps", omitting unknown parts. */
export function encodingLabel(enc: StreamEncoding): string {
  const parts: string[] = [];
  if (enc.codec) parts.push(codecLabel(enc.codec));
  if (enc.frame_rate) parts.push(`${enc.frame_rate} fps`);
  if (enc.bit_rate) parts.push(`${enc.bit_rate} kbps`);
  return parts.length ? parts.join(" · ") : "unknown";
}

export function codecLabel(codec: string): string {
  switch (codec.toLowerCase()) {
    case "h264":
      return "H.264";
    case "h265":
    case "hevc":
      return "H.265";
    default:
      return codec;
  }
}

export function portLabel(enabled: boolean | null): string {
  if (enabled === null) return "unknown";
  return enabled ? "on" : "off";
}

export function channelStatus(ch: ChannelInfo): string {
  if (!ch.online) return "offline";
  if (ch.sleeping) return "sleeping";
  return "online";
}

/** reolink-viewer-probe-2026-10-17T12-00-00.json */
export function probeFilename(now: Date): string {
  const stamp = now.toISOString().slice(0, 19).replace(/:/g, "-");
  return `reolink-viewer-probe-${stamp}.json`;
}

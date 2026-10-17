import { describe, expect, it } from "vitest";

import {
  channelStatus,
  codecLabel,
  deviceTypeLabel,
  encodingLabel,
  portLabel,
  probeFilename,
} from "./format";
import { makeChannel } from "./test-fixtures";

describe("format", () => {
  it("labels device types", () => {
    expect(deviceTypeLabel("nvr")).toBe("NVR");
    expect(deviceTypeLabel("hub")).toBe("Home Hub");
    expect(deviceTypeLabel("camera")).toBe("Camera");
  });

  it("labels codecs", () => {
    expect(codecLabel("h264")).toBe("H.264");
    expect(codecLabel("H265")).toBe("H.265");
    expect(codecLabel("hevc")).toBe("H.265");
    expect(codecLabel("mjpeg")).toBe("mjpeg");
  });

  it("labels encodings, skipping unknown parts", () => {
    expect(encodingLabel({ codec: "h265", frame_rate: 25, bit_rate: 6144 })).toBe(
      "H.265 · 25 fps · 6144 kbps",
    );
    expect(encodingLabel({ codec: "h264", frame_rate: null, bit_rate: null })).toBe("H.264");
    expect(encodingLabel({ codec: null, frame_rate: null, bit_rate: null })).toBe("unknown");
  });

  it("labels ports", () => {
    expect(portLabel(true)).toBe("on");
    expect(portLabel(false)).toBe("off");
    expect(portLabel(null)).toBe("unknown");
  });

  it("derives channel status", () => {
    expect(channelStatus(makeChannel())).toBe("online");
    expect(channelStatus(makeChannel({ sleeping: true }))).toBe("sleeping");
    expect(channelStatus(makeChannel({ online: false, sleeping: true }))).toBe("offline");
  });

  it("builds a filesystem-safe probe filename", () => {
    expect(probeFilename(new Date("2026-10-17T12:34:56.789Z"))).toBe(
      "reolink-viewer-probe-2026-10-17T12-34-56.json",
    );
  });
});

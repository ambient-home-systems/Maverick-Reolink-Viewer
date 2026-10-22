import { describe, expect, it } from "vitest";

import {
  codecLabel,
  deviceTypeLabel,
  encodingLabel,
  portLabel,
  probeFilename,
} from "./format";

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
    expect(encodingLabel({ codec: "h265", frame_rate: 20, bit_rate: null, width: 7680, height: 2160 })).toBe(
      "H.265 · 7680×2160 · 20 fps",
    );
    expect(encodingLabel({ codec: null, frame_rate: null, bit_rate: null })).toBe("unknown");
  });

  it("labels ports", () => {
    expect(portLabel(true)).toBe("on");
    expect(portLabel(false)).toBe("off");
    expect(portLabel(null)).toBe("unknown");
  });

  it("builds a filesystem-safe probe filename", () => {
    expect(probeFilename(new Date("2026-10-17T12:34:56.789Z"))).toBe(
      "reolink-viewer-probe-2026-10-17T12-34-56.json",
    );
  });
});

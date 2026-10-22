import { describe, expect, it, vi } from "vitest";

import type { LiveConnection, StreamEncoding } from "../types";
import { chooseHd } from "./hd";

function connection(main: Partial<StreamEncoding> | null, ext = true): LiveConnection {
  const encoding = (enc: Partial<StreamEncoding>): StreamEncoding => ({
    codec: null,
    bit_rate: 6144,
    frame_rate: 20,
    ...enc,
  });
  return {
    connection_id: "nvr1",
    via: "nvr",
    entry_title: "RLN36",
    is_battery: false,
    streams: {
      sub: { encoding: encoding({ codec: "h264", width: 640, height: 360 }), entity_id: null },
      ...(main ? { main: { encoding: encoding(main), entity_id: null } } : {}),
      ...(ext ? { ext: { encoding: null, entity_id: null } } : {}),
    },
  };
}

const answer = (supported: boolean, smooth: boolean) =>
  vi.fn(() => Promise.resolve({ supported, smooth, powerEfficient: smooth } as MediaCapabilitiesDecodingInfo));

describe("chooseHd", () => {
  it("plays an H.264 main without asking", async () => {
    const ask = answer(false, false);
    expect(await chooseHd(connection({ codec: "h264", width: 2560, height: 1920 }), ask)).toEqual({
      stream: "main",
      reason: "main: H.264 at 2560×1920",
    });
    expect(ask).not.toHaveBeenCalled();
  });

  it("plays an H.265 main the browser decodes smoothly at its size", async () => {
    const ask = answer(true, true);
    expect(await chooseHd(connection({ codec: "h265", width: 3840, height: 2160 }), ask)).toEqual({
      stream: "main",
      reason: "main: H.265 at 3840×2160, smooth here",
    });
    expect(ask).toHaveBeenCalledWith({
      type: "media-source",
      video: {
        contentType: 'video/mp4; codecs="hvc1.1.6.L153.B0"',
        width: 3840,
        height: 2160,
        bitrate: 6_144_000,
        framerate: 20,
      },
    });
  });

  it("plays ext where H.265 would not decode, or not smoothly", async () => {
    const main = { codec: "h265", width: 2560, height: 1440 };
    expect(await chooseHd(connection(main), answer(false, false))).toEqual({
      stream: "ext",
      reason: "ext: this browser cannot decode H.265 at 2560×1440",
    });
    expect((await chooseHd(connection(main), answer(true, false))).reason).toBe(
      "ext: H.265 at 2560×1440 would not play smoothly here",
    );
    expect((await chooseHd(connection(main), () => Promise.reject(new TypeError("bad")))).reason).toBe(
      "ext: this browser cannot check H.265 at 2560×1440",
    );
    expect((await chooseHd(connection(main), undefined)).reason).toBe(
      "ext: this browser cannot say whether it decodes H.265",
    );
  });

  it("never plays a main wider than 4096 pixels (the Duo 3)", async () => {
    const ask = answer(true, true);
    expect(await chooseHd(connection({ codec: "h265", width: 7680, height: 2160 }), ask)).toEqual({
      stream: "ext",
      reason: "ext: the main stream's 7680×2160 is wider than 4096 pixels",
    });
    expect(ask).not.toHaveBeenCalled();
  });

  it("plays ext when the main stream's codec or size is unknown", async () => {
    expect((await chooseHd(connection({ codec: "h265" }), answer(true, true))).reason).toBe(
      "ext: the main stream is H.265 at an unknown size",
    );
    expect((await chooseHd(connection({ codec: null }), answer(true, true))).reason).toBe(
      "ext: the main stream's codec is unknown",
    );
    // H.264 needs no size.
    expect((await chooseHd(connection({ codec: "H264" }), undefined)).stream).toBe("main");
  });

  it("stays on the sub stream with neither a usable main nor ext", async () => {
    expect(await chooseHd(connection({ codec: "h265", width: 7680, height: 2160 }, false), undefined)).toEqual({
      stream: null,
      reason: "SD only: the main stream's 7680×2160 is wider than 4096 pixels, and there is no ext stream",
    });
    expect((await chooseHd(connection(null), undefined)).stream).toBe("ext");
    expect((await chooseHd(connection(null, false), undefined)).reason).toBe(
      "SD only: no main stream, and there is no ext stream",
    );
  });
});

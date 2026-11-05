import { describe, expect, it } from "vitest";

import type { LiveCamera } from "../types";
import { subScale, tilesInHd, type WallCell } from "./hd";

const sub = { codec: "h264", frame_rate: 15, bit_rate: 512, width: 640, height: 360 };
const main = { codec: "h264", frame_rate: 25, bit_rate: 6144, width: 2560, height: 1440 };

function camera(id: string, options: { host?: string; hdTiles?: number; main?: boolean; battery?: boolean } = {}): LiveCamera {
  return {
    id,
    name: id,
    model: "RLC-520A",
    records: true,
    connections: [
      {
        connection_id: `${id}-conn`,
        via: "nvr",
        entry_title: "RLN36",
        host: options.host ?? "nvr",
        ...(options.hdTiles !== undefined ? { hd_tiles: options.hdTiles } : {}),
        is_battery: options.battery ?? false,
        streams: {
          sub: { encoding: sub, entity_id: null },
          ...(options.main === false ? {} : { main: { encoding: main, entity_id: null } }),
        },
      },
    ],
  };
}

const cell = (cam: LiveCamera, width: number, height: number, large?: string): WallCell => ({
  camera: cam,
  width,
  height,
  fit: "cover",
  ...(large ? { large } : {}),
});

describe("HD in the Wall's tiles", () => {
  it("measures how much larger than its sub stream a tile draws it", () => {
    const yard = camera("yard");
    const connection = yard.connections[0];
    expect(subScale(connection, cell(yard, 640, 360))).toBe(1);
    expect(subScale(connection, cell(yard, 640, 360), 2)).toBe(2); // a phone's pixels
    expect(subScale(connection, { ...cell(yard, 1280, 360), fit: "contain" })).toBe(1);
    expect(subScale(connection, cell(yard, 1280, 360))).toBe(2); // filling it: cropped, larger
    expect(subScale(connection, cell(yard, 0, 0))).toBeUndefined();
  });

  it("gives the large slot HD first, then the most enlarged, one per host", () => {
    const [large, big, small, other] = [camera("large"), camera("big"), camera("small"), camera("other", { host: "cam" })];
    const choices = tilesInHd([
      cell(large, 600, 340, "the large slot"),
      undefined,
      cell(big, 1200, 680),
      cell(small, 320, 180),
      cell(other, 1200, 680),
    ]);
    expect(choices.get("large")).toEqual({ hd: true, reason: "HD: the large slot" });
    expect(choices.get("big")).toEqual({ hd: false, reason: "SD: RLN36 plays 1 HD tile at once, and large has it" });
    expect(choices.get("small")).toEqual({ hd: false, reason: "SD: the tile is no larger than its sub stream (640×360)" });
    // Another host has its own.
    expect(choices.get("other")).toEqual({ hd: true, reason: "HD: drawn at 1.9× its sub stream (640×360)" });
    // Without a large slot, the most enlarged; a host allowing two, two.
    const [a, b, c] = ["a", "b", "c"].map((id) => camera(id, { hdTiles: 2 }));
    const two = tilesInHd([cell(a, 700, 400), cell(b, 1400, 800), cell(c, 1000, 560)]);
    expect([...two].filter(([, c]) => c.hd).map(([id]) => id)).toEqual(["b", "c"]);
    expect(two.get("a")?.reason).toBe("SD: RLN36 plays 2 HD tiles at once, and b, c have it");
  });

  it("keeps to SD a camera with no HD stream, or on its battery", () => {
    const choices = tilesInHd([
      cell(camera("plain", { main: false }), 1200, 680, "the large slot"),
      cell(camera("bell", { battery: true }), 1200, 680),
    ]);
    expect(choices.get("plain")).toEqual({ hd: false, reason: "SD: it has no HD stream" });
    expect(choices.get("bell")).toEqual({ hd: false, reason: "SD: on its battery, it plays when tapped" });
  });
});

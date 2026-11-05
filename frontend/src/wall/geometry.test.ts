import { describe, expect, it } from "vitest";

import { WALL_GAP, autoPlan, pack, slotSize, wallFit, wallPlan } from "./geometry";

const four = Array.from({ length: 4 }, () => undefined);

describe("the Wall's grids", () => {
  it("lays the fixed grids out, the large slot at the top left", () => {
    expect(wallPlan("1", four, 1600, 900)).toEqual({ cols: 1, rows: 1, slots: [{ col: 0, row: 0, cols: 1, rows: 1 }] });
    expect(wallPlan("3x3", four, 1600, 900).slots).toHaveLength(9);
    expect(wallPlan("4x4", four, 1600, 900).slots.at(-1)).toEqual({ col: 3, row: 3, cols: 1, rows: 1 });
    const five = wallPlan("1+5", four, 1600, 900);
    expect(five.cols).toBe(3);
    expect(five.slots[0]).toEqual({ col: 0, row: 0, cols: 2, rows: 2 });
    expect(five.slots.slice(1)).toEqual([
      { col: 2, row: 0, cols: 1, rows: 1 },
      { col: 2, row: 1, cols: 1, rows: 1 },
      { col: 0, row: 2, cols: 1, rows: 1 },
      { col: 1, row: 2, cols: 1, rows: 1 },
      { col: 2, row: 2, cols: 1, rows: 1 },
    ]);
    const seven = wallPlan("1+7", four, 1600, 900);
    expect(seven.slots).toHaveLength(8);
    expect(seven.slots[0]).toEqual({ col: 0, row: 0, cols: 3, rows: 3 });
  });

  it("packs Auto by shape, in the columns that show each picture largest", () => {
    // Eight 16:9 cameras: three columns on a wide screen, two on a tall one.
    const eight = Array.from({ length: 8 }, () => undefined);
    expect(autoPlan(eight, 1600, 860).cols).toBe(3);
    expect(autoPlan(eight, 390, 800).cols).toBe(2);
    expect(autoPlan(eight, 390, 800).rows).toBe(4);
    // A doorbell two rows tall, a panorama two columns wide, around the rest.
    const { slots, rows } = pack(["tall", undefined, undefined, "wide", undefined], 3);
    expect(slots).toEqual([
      { col: 0, row: 0, cols: 1, rows: 2 },
      { col: 1, row: 0, cols: 1, rows: 1 },
      { col: 2, row: 0, cols: 1, rows: 1 },
      { col: 1, row: 1, cols: 2, rows: 1 },
      { col: 0, row: 2, cols: 1, rows: 1 },
    ]);
    expect(rows).toBe(3);
    expect(autoPlan([], 800, 600).slots).toEqual([]);
  });

  it("sizes a slot with its gaps, and never crops a picture's sides", () => {
    const plan = wallPlan("1+5", four, 1200 + 2 * WALL_GAP, 600 + 2 * WALL_GAP);
    expect(slotSize(plan, plan.slots[0] ?? { col: 0, row: 0, cols: 1, rows: 1 }, 1200 + 2 * WALL_GAP, 600 + 2 * WALL_GAP)).toEqual({
      width: 800 + WALL_GAP,
      height: 400 + WALL_GAP,
    });
    // A 16:9 picture in a square cell is shown whole; a square one in a 16:9 cell fills it.
    expect(wallFit(16 / 9, { width: 400, height: 400 })).toBe("contain");
    expect(wallFit(1, { width: 640, height: 360 })).toBe("cover");
    expect(wallFit(undefined, { width: 640, height: 360 })).toBe("cover");
  });
});

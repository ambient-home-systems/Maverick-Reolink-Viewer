import { describe, expect, it } from "vitest";

import type { WallLayout } from "../types";
import { neighbour, pageCount, swapCells, wallOrder } from "./arrange";
import { wallPlan } from "./geometry";

const layout = (cameras: (string | null)[]): WallLayout => ({ id: "x", name: "X", grid: "2x2", cameras, tour_s: null });

describe("arranging the Wall", () => {
  it("orders a layout's cameras: its own, or every camera's", () => {
    expect(wallOrder(layout([]), ["a", "b"])).toEqual(["a", "b"]);
    expect(wallOrder(layout(["b", null, "a"]), ["a", "b"])).toEqual(["b", null, "a"]);
    expect(pageCount(9, 4)).toBe(3);
    expect(pageCount(0, 4)).toBe(1);
  });

  it("swaps two cells, into an empty one too", () => {
    expect(swapCells(["a", "b", "c"], 0, 2)).toEqual(["c", "b", "a"]);
    expect(swapCells(["a", "b"], 0, 3)).toEqual([null, "b", null, "a"]);
    // A camera moved out of the last cell leaves no empty cell behind it.
    expect(swapCells(["a", "b", "c"], 2, 0)).toEqual(["c", "b", "a"]);
    expect(swapCells(["a", "b", "c"], 1, 5)).toEqual(["a", null, "c", null, null, "b"]);
    expect(swapCells(["a", null, "c"], 2, 1)).toEqual(["a", "c"]);
  });

  it("finds the cell next to another, the large slot's neighbours too", () => {
    const grid = wallPlan("3x3", [], 900, 900);
    expect(neighbour(grid, 4, "left")).toBe(3);
    expect(neighbour(grid, 4, "up")).toBe(1);
    expect(neighbour(grid, 4, "down")).toBe(7);
    expect(neighbour(grid, 2, "right")).toBeUndefined();
    // 1+5: the large slot (0) has 1 at its right and 3 below it.
    const large = wallPlan("1+5", [], 900, 900);
    expect(neighbour(large, 0, "right")).toBe(1);
    expect(neighbour(large, 0, "down")).toBe(3);
    expect(neighbour(large, 2, "left")).toBe(0);
    expect(neighbour(large, 4, "up")).toBe(0);
    expect(neighbour(large, 5, "up")).toBe(2);
  });
});

// Arranging the Wall (Phase 9 step 2): a layout's order of cameras, its
// pages, swapping two cells, and the cell next to another, as pure functions.
import type { WallLayout } from "../types";
import type { WallPlan } from "./geometry";

/** A layout's cameras in order, by id (null: an empty cell): its own, or every camera's (`board`). */
export function wallOrder(layout: WallLayout, board: readonly string[]): (string | null)[] {
  return layout.cameras.length ? [...layout.cameras] : [...board];
}

/** How many pages `count` cells make, `perPage` to a page (one at least). */
export function pageCount(count: number, perPage: number): number {
  return Math.max(1, Math.ceil(count / Math.max(1, perPage)));
}

/** The order with cells `a` and `b` swapped; cells beyond its end are empty ones. */
export function swapCells(order: readonly (string | null)[], a: number, b: number): (string | null)[] {
  const next = [...order];
  while (next.length <= Math.max(a, b)) next.push(null);
  [next[a], next[b]] = [next[b] ?? null, next[a] ?? null];
  // An empty cell at the end is no cell at all.
  while (next.length && next.at(-1) === null) next.pop();
  return next;
}

export type Direction = "left" | "right" | "up" | "down";

/**
 * The slot next to slot `from` in a direction: of the slots on that side that
 * overlap it across, the nearest (a large slot's neighbours below are the
 * small ones under it). Undefined at the edge.
 */
export function neighbour(plan: WallPlan, from: number, direction: Direction): number | undefined {
  if (from < 0 || from >= plan.slots.length) return undefined;
  const here = plan.slots[from];
  const across = (a: number, aSpan: number, b: number, bSpan: number) => a < b + bSpan && b < a + aSpan;
  let best: { index: number; distance: number; offset: number } | undefined;
  plan.slots.forEach((slot, index) => {
    if (index === from) return;
    let distance: number;
    let offset: number;
    if (direction === "left" || direction === "right") {
      if (!across(slot.row, slot.rows, here.row, here.rows)) return;
      distance = direction === "right" ? slot.col - (here.col + here.cols) : here.col - (slot.col + slot.cols);
      offset = Math.abs(slot.row - here.row);
    } else {
      if (!across(slot.col, slot.cols, here.col, here.cols)) return;
      distance = direction === "down" ? slot.row - (here.row + here.rows) : here.row - (slot.row + slot.rows);
      offset = Math.abs(slot.col - here.col);
    }
    if (distance < 0) return;
    if (!best || distance < best.distance || (distance === best.distance && offset < best.offset)) {
      best = { index, distance, offset };
    }
  });
  return best?.index;
}

/** The arrow keys, as directions. */
export const ARROWS: Readonly<Partial<Record<string, Direction>>> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
};

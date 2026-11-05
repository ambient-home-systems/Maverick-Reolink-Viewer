// The Wall's grids (Phase 9 step 1): where each camera's cell is, fitted to
// the screen's width and height, with no page scroll.
import type { WallGrid } from "../types";

/** The gap between cells, in pixels. */
export const WALL_GAP = 4;

/** One cell of a grid: its column and row (from 0), and how many it spans. */
export interface WallSlot {
  col: number;
  row: number;
  cols: number;
  rows: number;
}

export interface WallPlan {
  cols: number;
  rows: number;
  slots: WallSlot[];
}

/** What each grid is called, in the order it is offered. */
export const WALL_GRIDS: readonly { grid: WallGrid; label: string }[] = [
  { grid: "auto", label: "Auto" },
  { grid: "1", label: "1" },
  { grid: "2x2", label: "2 × 2" },
  { grid: "3x3", label: "3 × 3" },
  { grid: "4x4", label: "4 × 4" },
  { grid: "1+5", label: "1 + 5" },
  { grid: "1+7", label: "1 + 7" },
];

const square = (n: number): WallPlan => ({
  cols: n,
  rows: n,
  slots: Array.from({ length: n * n }, (_, i) => ({ col: i % n, row: Math.floor(i / n), cols: 1, rows: 1 })),
});

/** One large slot (n - 1 square) at the top left, the rest around it: 1+5 is n = 3, 1+7 is n = 4. */
const large = (n: number): WallPlan => {
  const slots: WallSlot[] = [{ col: 0, row: 0, cols: n - 1, rows: n - 1 }];
  for (let row = 0; row < n - 1; row += 1) slots.push({ col: n - 1, row, cols: 1, rows: 1 });
  for (let col = 0; col < n; col += 1) slots.push({ col, row: n - 1, cols: 1, rows: 1 });
  return { cols: n, rows: n, slots };
};

/** A camera's shape on the board: a square or portrait one runs two rows tall, a panorama two columns wide. */
export type WallShape = "tall" | "wide" | undefined;

/**
 * Pack cells of these shapes into `cols` columns, each in the first free place
 * that holds it, row by row (as the board's dense grid does); return the slots
 * and how many rows they take.
 */
export function pack(shapes: readonly WallShape[], cols: number): { slots: WallSlot[]; rows: number } {
  const taken: boolean[][] = [];
  const free = (row: number, col: number): boolean => !taken[row]?.[col];
  const slots: WallSlot[] = [];
  let rows = 0;
  for (const shape of shapes) {
    const w = shape === "wide" && cols >= 2 ? 2 : 1;
    const h = shape === "tall" ? 2 : 1;
    let placed: WallSlot | undefined;
    for (let row = 0; !placed; row += 1) {
      for (let col = 0; col + w <= cols && !placed; col += 1) {
        let fits = true;
        for (let r = row; r < row + h && fits; r += 1) {
          for (let c = col; c < col + w && fits; c += 1) fits = free(r, c);
        }
        if (fits) placed = { col, row, cols: w, rows: h };
      }
    }
    for (let r = placed.row; r < placed.row + h; r += 1) {
      const line = (taken[r] ??= []);
      for (let c = placed.col; c < placed.col + w; c += 1) line[c] = true;
    }
    rows = Math.max(rows, placed.row + h);
    slots.push(placed);
  }
  return { slots, rows: Math.max(1, rows) };
}

/**
 * Auto: every camera, packed by its shape as on the board (a doorbell two rows
 * tall, a panorama two columns wide), in the number of columns that shows a
 * 16:9 picture largest in `width` × `height`: a wide screen gets more columns,
 * a tall one more rows, and nothing scrolls.
 */
export function autoPlan(shapes: readonly WallShape[], width: number, height: number): WallPlan {
  const list = shapes.length ? shapes : [undefined];
  const cells = list.reduce((n, shape) => n + (shape ? 2 : 1), 0);
  let best: (WallPlan & { size: number }) | undefined;
  for (let cols = 1; cols <= cells; cols += 1) {
    const { slots, rows } = pack(list, cols);
    const cellW = (width - (cols - 1) * WALL_GAP) / cols;
    const cellH = (height - (rows - 1) * WALL_GAP) / rows;
    // The 16:9 picture's width that fits a cell; fewer empty cells breaks a tie.
    const size = Math.min(cellW, (cellH * 16) / 9);
    if (!best || size > best.size + 0.5 || (Math.abs(size - best.size) <= 0.5 && cols * rows < best.cols * best.rows)) {
      best = { cols, rows, slots, size };
    }
  }
  const { cols, rows, slots } = best ?? { cols: 1, rows: 1, slots: [] };
  return { cols, rows, slots: shapes.length ? slots : [] };
}

/** Where each cell of a grid is, for cameras of these shapes in `width` × `height` pixels. */
export function wallPlan(grid: WallGrid, shapes: readonly WallShape[], width: number, height: number): WallPlan {
  switch (grid) {
    case "1":
      return square(1);
    case "2x2":
      return square(2);
    case "3x3":
      return square(3);
    case "4x4":
      return square(4);
    case "1+5":
      return large(3);
    case "1+7":
      return large(4);
    case "auto":
      return autoPlan(shapes, width, height);
  }
}

/** A slot's size in pixels, in a plan laid over `width` × `height`. */
export function slotSize(plan: WallPlan, slot: WallSlot, width: number, height: number): { width: number; height: number } {
  const cellW = (width - (plan.cols - 1) * WALL_GAP) / plan.cols;
  const cellH = (height - (plan.rows - 1) * WALL_GAP) / plan.rows;
  return {
    width: cellW * slot.cols + (slot.cols - 1) * WALL_GAP,
    height: cellH * slot.rows + (slot.rows - 1) * WALL_GAP,
  };
}

/**
 * How a picture of `ratio` (width over height) is shown in a cell: filling it
 * ("cover") may crop its top and bottom, never its sides, so a picture wider
 * than the cell is shown whole ("contain").
 */
export function wallFit(ratio: number | undefined, cell: { width: number; height: number }): "cover" | "contain" {
  if (!ratio || !cell.width || !cell.height) return "cover";
  return ratio > (cell.width / cell.height) * 1.02 ? "contain" : "cover";
}

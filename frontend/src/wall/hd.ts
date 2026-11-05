// Which of the Wall's tiles play HD (Phase 9 step 3): a tile drawn larger
// than its sub stream's own picture, or the large slot of 1 + N (and a camera
// alone on the screen), within what each host allows at once (its
// `hd_tiles`: one per NVR today, as its stream budget is six subs and one
// main). The large slot goes first, then the tile drawn the most enlarged.
// The tile plays HD through full screen's swap (the sub stream until HD's
// first frame), on a spare stream slot the server takes back when another
// stream needs it; a tile denied HD stays on SD and says why in its debug view.
import { liveConnection } from "../live/data";
import type { LiveCamera, LiveConnection } from "../types";

/** What a Wall tile plays, and why (shown in its debug view). */
export interface TileHd {
  /** HD in the tile itself, not only in full screen. */
  hd: boolean;
  reason: string;
}

export interface WallCell {
  camera: LiveCamera;
  /** The cell's size on screen, in CSS pixels. */
  width: number;
  height: number;
  /** How the picture is drawn in it: filling it (top and bottom cropped), or whole. */
  fit: "cover" | "contain";
  /** Why it is large whatever its size: "the large slot", "alone on the screen". */
  large?: string;
}

/** Without a host's own word: one HD tile at once. */
export const DEFAULT_HD_TILES = 1;

/**
 * How much larger than its own size the sub stream's picture is drawn, in
 * the screen's pixels; undefined when its size is not known.
 */
export function subScale(connection: LiveConnection | undefined, cell: WallCell, pixelRatio = 1): number | undefined {
  const encoding = connection?.streams.sub?.encoding;
  if (!encoding?.width || !encoding.height || !cell.width || !cell.height) return undefined;
  const across = (cell.width * pixelRatio) / encoding.width;
  const down = (cell.height * pixelRatio) / encoding.height;
  return cell.fit === "cover" ? Math.max(across, down) : Math.min(across, down);
}

const plural = (n: number, word: string) => `${String(n)} ${word}${n === 1 ? "" : "s"}`;

/** Per camera shown, whether its tile plays HD, and why. */
export function tilesInHd(cells: readonly (WallCell | undefined)[], pixelRatio = 1): Map<string, TileHd> {
  const choices = new Map<string, TileHd>();
  const wanting: { cell: WallCell; connection: LiveConnection; scale: number; index: number; why: string }[] = [];
  cells.forEach((cell, index) => {
    if (!cell) return;
    const connection = liveConnection(cell.camera);
    if (!connection) return;
    const sub = connection.streams.sub?.encoding;
    const size = sub?.width && sub.height ? `${String(sub.width)}×${String(sub.height)}` : undefined;
    if (!connection.streams.main && !connection.streams.ext) {
      choices.set(cell.camera.id, { hd: false, reason: "SD: it has no HD stream" });
      return;
    }
    if (connection.is_battery) {
      choices.set(cell.camera.id, { hd: false, reason: "SD: on its battery, it plays when tapped" });
      return;
    }
    const scale = subScale(connection, cell, pixelRatio);
    if (cell.large) {
      wanting.push({ cell, connection, scale: scale ?? Infinity, index, why: cell.large });
    } else if (scale !== undefined && scale > 1) {
      wanting.push({ cell, connection, scale, index, why: `drawn at ${scale.toFixed(1)}× its sub stream (${size ?? "?"})` });
    } else {
      let reason = `SD: the tile is no larger than its sub stream (${size ?? "?"})`;
      if (!size) reason = "SD: its sub stream's size is not known";
      else if (!cell.width || !cell.height) reason = "SD: the tile's size is not known yet";
      choices.set(cell.camera.id, { hd: false, reason });
    }
  });
  // The large slot first, then the most enlarged, then in the cells' order.
  wanting.sort((a, b) => Number(Boolean(b.cell.large)) - Number(Boolean(a.cell.large)) || b.scale - a.scale || a.index - b.index);
  const given = new Map<string, string[]>();
  for (const { cell, connection, why } of wanting) {
    const host = connection.host ?? connection.connection_id;
    const allowed = connection.hd_tiles ?? DEFAULT_HD_TILES;
    const holders = given.get(host) ?? [];
    if (holders.length < allowed) {
      holders.push(cell.camera.name);
      given.set(host, holders);
      choices.set(cell.camera.id, { hd: true, reason: `HD: ${why}` });
    } else {
      choices.set(cell.camera.id, {
        hd: false,
        reason: `SD: ${connection.entry_title} plays ${plural(allowed, "HD tile")} at once, and ${holders.join(", ")} ${holders.length === 1 ? "has" : "have"} it`,
      });
    }
  }
  return choices;
}

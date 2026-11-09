// The Wall's dashboard card's settings (custom:reolink-viewer-wall, Phase 9
// step 5), as written in the dashboard's YAML and by its editor. Plain and
// small: the cards' module, loaded on every Home Assistant page, imports it.

export const WALL_CARD_ELEMENT = "reolink-viewer-wall";
export const WALL_CARD_TYPE = `custom:${WALL_CARD_ELEMENT}`;
export const WALL_EDITOR_ELEMENT = "reolink-viewer-wall-editor";
/** The user guide's section on the card (the card picker links to it). */
export const WALL_CARD_DOCS =
  "https://github.com/ambient-home-systems/Maverick-Reolink-Viewer/blob/main/docs/user-guide.md#the-wall-on-a-dashboard";

export interface WallCardConfig {
  type: string;
  /** A saved layout's id (its address, #wall/<id>); unset: every camera. */
  layout?: string;
  /** The bar above the feeds: the layout's name, pages, the time and full screen. */
  show_bar: boolean;
}

export const WALL_DEFAULTS = { show_bar: true } as const satisfies Omit<WallCardConfig, "type" | "layout">;

/** The card's settings from what the dashboard has; throws, in plain words, on a wrong value. */
export function wallCardConfig(raw: unknown): WallCardConfig {
  if (typeof raw !== "object" || raw === null) throw new Error("The card needs its settings.");
  const given = raw as Record<string, unknown>;
  const layout = given.layout;
  if (layout !== undefined && layout !== null && typeof layout !== "string") {
    throw new Error("layout: a saved layout's id, as the card's editor chooses it (none: every camera).");
  }
  const showBar = given.show_bar;
  if (showBar !== undefined && typeof showBar !== "boolean") throw new Error("show_bar: true or false.");
  return {
    type: typeof given.type === "string" ? given.type : WALL_CARD_TYPE,
    ...(layout ? { layout } : {}),
    show_bar: showBar ?? WALL_DEFAULTS.show_bar,
  };
}

/** The settings as the dashboard keeps them: what differs from the defaults; other keys as they are. */
export function storedWallConfig(raw: Record<string, unknown>, change: Partial<WallCardConfig>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...raw, ...change, type: raw.type ?? WALL_CARD_TYPE };
  if (next.show_bar === WALL_DEFAULTS.show_bar) Reflect.deleteProperty(next, "show_bar");
  if (!next.layout) Reflect.deleteProperty(next, "layout");
  return next;
}

/** Its height in a masonry view (rows of about 50 px): a 16:9 Wall in a column about 380 px wide, at least. */
export const WALL_CARD_SIZE = 6;

/** Its size in a sections view: the full width and eight rows until resized. */
export const WALL_GRID_OPTIONS = {
  columns: 12,
  rows: 8,
  min_columns: 6,
  min_rows: 4,
} as const;

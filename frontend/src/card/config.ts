// The dashboard card's settings (custom:reolink-viewer-camera), as written in
// the dashboard's YAML and by its editor. Plain and small: the card's own
// module, loaded on every Home Assistant page, imports it.

export const CARD_ELEMENT = "reolink-viewer-camera";
export const CARD_TYPE = `custom:${CARD_ELEMENT}`;
export const EDITOR_ELEMENT = "reolink-viewer-camera-editor";
/** The user guide's section on the card (the card picker links to it). */
export const CARD_DOCS =
  "https://github.com/ambient-home-systems/Maverick-Reolink-Viewer/blob/main/docs/user-guide.md#a-camera-on-a-dashboard";

/** What a tap on the card does. */
export type TapAction = "full_screen" | "open_panel" | "none";
/** The card plays the camera's sub stream, or its HD stream (as full screen chooses it). */
export type Quality = "sd" | "hd";
/** Fill the card, cropping the picture; or show it whole, with bars. */
export type Fit = "cover" | "contain";

export interface CameraCardConfig {
  type: string;
  /** The camera's id (live/cameras); unset until one is chosen. */
  camera?: string;
  quality: Quality;
  tap_action: TapAction;
  show_name: boolean;
  show_state: boolean;
  fit: Fit;
}

export const DEFAULTS = {
  quality: "sd",
  tap_action: "full_screen",
  show_name: true,
  show_state: true,
  fit: "cover",
} as const satisfies Omit<CameraCardConfig, "type" | "camera">;

const CHOICES = {
  quality: ["sd", "hd"],
  tap_action: ["full_screen", "open_panel", "none"],
  fit: ["cover", "contain"],
} as const;

const FLAGS = ["show_name", "show_state"] as const;

/** The card's settings from what the dashboard has; throws, in plain words, on a wrong value. */
export function cardConfig(raw: unknown): CameraCardConfig {
  if (typeof raw !== "object" || raw === null) throw new Error("The card needs its settings.");
  const given = raw as Record<string, unknown>;
  const camera = given.camera;
  if (camera !== undefined && camera !== null && typeof camera !== "string") {
    throw new Error("camera: the camera's id, as the card's editor chooses it.");
  }
  const config: CameraCardConfig = {
    ...DEFAULTS,
    type: typeof given.type === "string" ? given.type : CARD_TYPE,
    ...(camera ? { camera } : {}),
  };
  for (const key of Object.keys(CHOICES) as (keyof typeof CHOICES)[]) {
    const value = given[key];
    if (value === undefined) continue;
    const allowed: readonly string[] = CHOICES[key];
    if (typeof value !== "string" || !allowed.includes(value)) {
      throw new Error(`${key}: one of ${allowed.join(", ")}.`);
    }
    Object.assign(config, { [key]: value });
  }
  for (const key of FLAGS) {
    const value = given[key];
    if (value === undefined) continue;
    if (typeof value !== "boolean") throw new Error(`${key}: true or false.`);
    config[key] = value;
  }
  return config;
}

/**
 * The settings as the dashboard keeps them: what differs from the defaults,
 * so its YAML stays short. Keys the card does not know are kept as they are.
 */
export function storedConfig(raw: Record<string, unknown>, change: Partial<CameraCardConfig>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...raw, ...change, type: raw.type ?? CARD_TYPE };
  for (const [key, value] of Object.entries(DEFAULTS)) {
    if (next[key] === value) Reflect.deleteProperty(next, key);
  }
  if (!next.camera) Reflect.deleteProperty(next, "camera");
  return next;
}

/**
 * Each camera's picture shape (width over height), as the card has seen it,
 * so a dashboard's layout can size a card before its camera list arrives.
 */
const RATIOS = new Map<string, number>();

export function rememberRatio(camera: string, ratio: number): void {
  RATIOS.set(camera, ratio);
}

/** The card's height in masonry rows (about 50 px each), for a column about 380 px wide. */
export function cardSize(camera: string | undefined): number {
  const ratio = (camera ? RATIOS.get(camera) : undefined) ?? 16 / 9;
  return Math.max(2, Math.round(380 / ratio / 50));
}

/** Its size in a sections view: the full width, its height from the picture until resized. */
export const GRID_OPTIONS = {
  columns: 12,
  rows: "auto",
  min_columns: 3,
  min_rows: 2,
} as const;

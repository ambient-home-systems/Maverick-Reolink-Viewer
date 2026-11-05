// What this device shows on Live (Phase 9): the board or the Wall, and which
// layout. Kept in the browser: each device remembers its own (the wall
// tablet the Wall, the desktop the board).
const MODE = "rv-live-mode";
const LAYOUT = "rv-wall-layout";

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | undefined): void {
  try {
    if (value === undefined) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // A private window: not remembered, still shown.
  }
}

export function rememberedMode(): "board" | "wall" {
  return read(MODE) === "wall" ? "wall" : "board";
}

export function rememberMode(mode: "board" | "wall"): void {
  write(MODE, mode);
}

/** The saved layout this device last showed (none: every camera, Auto). */
export function rememberedLayout(): string | undefined {
  return read(LAYOUT) ?? undefined;
}

export function rememberLayout(id: string | undefined): void {
  write(LAYOUT, id);
}

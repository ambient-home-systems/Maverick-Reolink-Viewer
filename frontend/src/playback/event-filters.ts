/**
 * Each camera's filters of its Playback events, kept in this browser (Phase 11
 * step 3): what was seen to show only, and whether motion-only events are
 * hidden. A camera never seen here has none kept: its first day decides
 * whether motion-only events start hidden (on a camera recording all the time).
 */

export interface EventFilters {
  /** The types to show only (none: every type). */
  only: string[];
  /** Motion-only events hidden. */
  hideMotion: boolean;
}

export const FILTERS_KEY = "reolink-viewer-event-filters";
/** Cameras kept at most (the oldest kept go first). */
export const FILTERS_MAX = 100;

type Store = Pick<Storage, "getItem" | "setItem">;

function store(): Store | null {
  try {
    return window.localStorage;
  } catch {
    // Storage refused (a private window, a sandboxed frame): nothing kept.
    return null;
  }
}

function readAll(from: Store | null): Record<string, EventFilters> {
  try {
    const raw: unknown = JSON.parse(from?.getItem(FILTERS_KEY) ?? "{}");
    return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, EventFilters>) : {};
  } catch {
    return {};
  }
}

/** A camera's kept filters, or undefined if it has none (its first visit here). */
export function loadFilters(deviceId: string, from: Store | null = store()): EventFilters | undefined {
  const kept = readAll(from)[deviceId] as unknown;
  if (!kept || typeof kept !== "object") return undefined;
  const { only, hideMotion } = kept as Partial<EventFilters>;
  return {
    only: Array.isArray(only) ? only.filter((t): t is string => typeof t === "string") : [],
    hideMotion: hideMotion === true,
  };
}

/** Keep a camera's filters (the most recent last; at most FILTERS_MAX cameras). */
export function saveFilters(deviceId: string, filters: EventFilters, to: Store | null = store()): void {
  if (!to) return;
  const all = new Map(Object.entries(readAll(to)));
  all.delete(deviceId);
  all.set(deviceId, { only: [...filters.only], hideMotion: filters.hideMotion });
  const kept = [...all].slice(-FILTERS_MAX);
  try {
    to.setItem(FILTERS_KEY, JSON.stringify(Object.fromEntries(kept)));
  } catch {
    // Full or refused: the filters last this visit only.
  }
}

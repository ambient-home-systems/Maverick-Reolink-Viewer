// HA hands the panel a new `hass` object on every state change anywhere in
// Home Assistant. State objects are immutable and replaced when they change, so
// comparing them by identity tells whether the shown device changed.
import type { HassEntities } from "./types";

export function statesChanged(
  previous: HassEntities | undefined,
  next: HassEntities | undefined,
  entityIds: Iterable<string>,
): boolean {
  if (previous === next) return false;
  if (!previous || !next) return true;
  for (const id of entityIds) {
    if (previous[id] !== next[id]) return true;
  }
  return false;
}

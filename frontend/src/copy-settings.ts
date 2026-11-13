// Copy settings to other cameras (Phase 11 step 4): which of a camera's
// settings can be copied, what each would do on another camera, and the
// standard HA action that sets it there (rule 4: HA's state stays the truth).
//
// A setting is matched on another camera by its domain and catalog key (the
// Reolink integration's translation_key), so it is the same setting whatever
// the camera calls it. What a target cannot take is said, not tried: no such
// setting, turned off, unavailable, an option it does not offer, a number out
// of its range or off its steps.
import type { Action } from "./catalog";
import { serviceFor, type ServiceCall } from "./services";
import type { EntityInfo, HassEntities, HassEntity } from "./types";

/** The categories offered, in the catalog's order. */
export const COPY_CATEGORIES: readonly string[] = [
  "detection",
  "smart_zones",
  "image",
  "lighting",
  "streams",
  "recording",
  "notifications",
  "audio",
  "siren",
  "power",
];
// Not offered: pan, tilt and zoom (positions and presets are the camera's own),
// privacy (a privacy mode copied blacks a camera out; masks are drawn per
// camera), system (scenes and rules) and events (read only).

/** The domains whose state is a setting to copy. */
const COPY_DOMAINS = new Set(["switch", "number", "select", "light", "time"]);

/** Within those, entities that are actions or live controls, not settings. */
export const NEVER_COPIED: Readonly<Record<string, string>> = {
  "switch.manual_record": "starts a recording now",
  "select.play_quick_reply_message": "plays a message now",
  "light.floodlight": "turns the light on now",
};

/** What names the camera (its name, its on-screen text) is never copied. */
function namesTheCamera(entity: EntityInfo): boolean {
  return entity.domain === "text" || /(^|_)(osd|name)(_|$)/.test(entity.key ?? "");
}

const UNSET = new Set(["unavailable", "unknown"]);

/** Whether an entity of the source camera is a setting that can be copied. */
export function copyable(entity: EntityInfo): boolean {
  return (
    entity.key !== null &&
    entity.sub_device === null &&
    entity.disabled_by === null &&
    entity.entity_category !== "diagnostic" &&
    COPY_DOMAINS.has(entity.domain) &&
    COPY_CATEGORIES.includes(entity.category) &&
    !(`${entity.domain}.${entity.key}` in NEVER_COPIED) &&
    !namesTheCamera(entity)
  );
}

const matchKey = (entity: EntityInfo) => `${entity.domain}.${entity.key ?? ""}`;

/**
 * A camera's entities by their match key, those of its sub-devices (a
 * doorbell's chimes) left out, and any key held twice (which is meant?) too.
 */
export function byKey(entities: readonly EntityInfo[]): Map<string, EntityInfo> {
  const found = new Map<string, EntityInfo>();
  const twice = new Set<string>();
  for (const entity of entities) {
    if (entity.key === null || entity.sub_device !== null) continue;
    const key = matchKey(entity);
    if (found.has(key)) twice.add(key);
    found.set(key, entity);
  }
  for (const key of twice) found.delete(key);
  return found;
}

/** A setting of the source camera, with the value to copy. */
export interface SourceSetting {
  entity: EntityInfo;
  /** Its state: "on", "40", "Auto", "07:30:00". */
  value: string;
}

/** The settings of these categories the source camera has, set (not unavailable). */
export function sourceSettings(
  entities: readonly EntityInfo[],
  states: HassEntities,
  categories: ReadonlySet<string>,
): SourceSetting[] {
  const unique = byKey(entities);
  const out: SourceSetting[] = [];
  for (const entity of unique.values()) {
    if (!copyable(entity) || !categories.has(entity.category)) continue;
    const state = states[entity.entity_id];
    if (!state || UNSET.has(state.state)) continue;
    if ((entity.domain === "switch" || entity.domain === "light") && !["on", "off"].includes(state.state)) continue;
    out.push({ entity, value: state.state });
  }
  return out;
}

/** How many settings of each category the source camera could copy. */
export function copyableCounts(entities: readonly EntityInfo[], states: HassEntities): Map<string, number> {
  const counts = new Map<string, number>();
  for (const setting of sourceSettings(entities, states, new Set(COPY_CATEGORIES))) {
    counts.set(setting.entity.category, (counts.get(setting.entity.category) ?? 0) + 1);
  }
  return counts;
}

export type Verdict =
  | { kind: "change"; from: string }
  | { kind: "same" }
  | { kind: "cannot"; reason: string };

/** One setting on one target camera. */
export interface PlanItem {
  setting: SourceSetting;
  /** The target's entity of that setting, where it has one. */
  target: EntityInfo | undefined;
  verdict: Verdict;
}

function numberAttr(state: HassEntity, name: string): number | undefined {
  const value = state.attributes[name];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/** A time as HH:MM:SS ("07:30" is "07:30:00"). */
const fullTime = (time: string) => (time.length === 5 ? `${time}:00` : time);

/** Equal as values: numbers as numbers ("40.0" is 40), times to the second. */
export function sameValue(domain: string, a: string, b: string): boolean {
  if (domain === "number") return Number(a) === Number(b);
  if (domain === "time") return fullTime(a) === fullTime(b);
  return a === b;
}

/** Why the target cannot take the value, or undefined if it can. */
function refusal(domain: string, value: string, state: HassEntity): string | undefined {
  if (domain === "select") {
    const options = state.attributes.options;
    if (Array.isArray(options) && !options.includes(value)) return `It does not offer “${value}”`;
  }
  if (domain === "number") {
    const number = Number(value);
    const min = numberAttr(state, "min");
    const max = numberAttr(state, "max");
    const step = numberAttr(state, "step");
    if (!Number.isFinite(number)) return "Not a number";
    if ((min !== undefined && number < min) || (max !== undefined && number > max)) {
      return `It takes ${String(min ?? "…")} to ${String(max ?? "…")}`;
    }
    if (step !== undefined && step > 0) {
      const steps = (number - (min ?? 0)) / step;
      if (Math.abs(steps - Math.round(steps)) > 1e-6) return `It takes steps of ${String(step)}`;
    }
  }
  return undefined;
}

/** What copying each setting would do on a target camera. */
export function planCopy(settings: readonly SourceSetting[], targetEntities: readonly EntityInfo[], states: HassEntities): PlanItem[] {
  const targets = byKey(targetEntities);
  return settings.map((setting) => {
    const target = targets.get(matchKey(setting.entity));
    const domain = setting.entity.domain;
    let verdict: Verdict;
    const state = target ? states[target.entity_id] : undefined;
    if (!target) verdict = { kind: "cannot", reason: "This camera has no such setting" };
    else if (target.disabled_by !== null) verdict = { kind: "cannot", reason: "Turned off in Home Assistant on this camera" };
    else if (!state || UNSET.has(state.state)) verdict = { kind: "cannot", reason: "Not available now" };
    else if (sameValue(domain, state.state, setting.value)) verdict = { kind: "same" };
    else {
      const reason = refusal(domain, setting.value, state);
      verdict = reason ? { kind: "cannot", reason } : { kind: "change", from: state.state };
    }
    return { setting, target, verdict };
  });
}

/** The standard HA action that sets a copied value. */
export function copyCall(domain: string, value: string): ServiceCall {
  if (domain === "switch" || domain === "light") return serviceFor(domain, value === "on");
  if (domain === "number") return serviceFor(domain, Number(value));
  return serviceFor(domain, value);
}

/** Whether a target shows the value now (its state is HA's truth). */
export function applied(domain: string, value: string, state: HassEntity | undefined): boolean {
  return state !== undefined && sameValue(domain, state.state, value);
}

/** The action copying `value` is, in the catalog's terms (for its warnings). */
export function copyAction(domain: string, value: string): Action {
  if (domain === "switch" || domain === "light") return value === "on" ? "on" : "off";
  if (domain === "select") return { option: value };
  return "any";
}

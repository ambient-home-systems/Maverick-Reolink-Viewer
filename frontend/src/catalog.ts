// Catalog lookups: explanations, categories, confirmation rules and search.
import type { Catalog, CatalogEntry, Category, EntityInfo } from "./types";

export const OTHER_CATEGORY: Category = {
  id: "other",
  title: "Other",
  description: "Entities this version of Reolink Viewer does not know yet.",
};

export function catalogEntry(
  catalog: Catalog | undefined,
  domain: string,
  key: string | null,
): CatalogEntry | undefined {
  if (!catalog || key === null) return undefined;
  return catalog.entities[domain]?.[key];
}

/** "domain.key" reference → entry, for the related settings list. */
export function relatedEntry(catalog: Catalog | undefined, ref: string): CatalogEntry | undefined {
  const dot = ref.indexOf(".");
  if (dot < 0) return undefined;
  return catalogEntry(catalog, ref.slice(0, dot), ref.slice(dot + 1));
}

/** Categories in catalog order, with "Other" last. */
export function orderedCategories(catalog: Catalog | undefined): Category[] {
  return [...(catalog?.categories ?? []), OTHER_CATEGORY];
}

/**
 * The action the user is about to take, in catalog terms:
 * - switch, light, siren: "on" / "off"
 * - select: the option
 * - button, number, time, update: "any"
 */
export type Action = "on" | "off" | "any" | { option: string };

/** Return the confirmation text if the catalog marks this action disruptive. */
export function confirmationFor(entry: CatalogEntry | undefined, action: Action): string | null {
  if (entry?.impact !== "disruptive") return null;
  const when = entry.disruptive_when ?? "any";
  let matches: boolean;
  if (Array.isArray(when)) {
    matches = typeof action === "object" && when.includes(action.option);
  } else if (when === "any") {
    matches = true;
  } else {
    matches = action === when;
  }
  if (!matches) return null;
  return entry.impact_note ?? "This action can disrupt the camera.";
}

/** Display name of an entity row. */
export function entityLabel(entity: EntityInfo, entry: CatalogEntry | undefined): string {
  return entity.name ?? entry?.title ?? entity.entity_id;
}

const normalize = (text: string) => text.toLowerCase();

/**
 * Whether an entity matches a search query. Every word must appear in the
 * entity's name, id, catalog title, summary or explanation.
 */
export function matchesSearch(
  entity: EntityInfo,
  entry: CatalogEntry | undefined,
  query: string,
): boolean {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const haystack = normalize(
    [
      entity.name ?? "",
      entity.entity_id,
      entity.sub_device ?? "",
      entry?.title ?? "",
      entry?.summary ?? "",
      entry?.what_it_does ?? "",
    ].join(" "),
  );
  return words.every((word) => haystack.includes(word));
}

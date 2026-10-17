import { describe, expect, it } from "vitest";

import {
  catalogEntry,
  confirmationFor,
  entityLabel,
  matchesSearch,
  orderedCategories,
  relatedEntry,
} from "./catalog";
import { CATALOG, makeEntity } from "./test-fixtures";
import type { CatalogEntry } from "./types";

describe("catalog lookup", () => {
  it("finds entries by domain and key", () => {
    expect(catalogEntry(CATALOG, "light", "status_led")?.title).toBe("Status LED");
    expect(catalogEntry(CATALOG, "switch", "status_led")).toBeUndefined();
    expect(catalogEntry(CATALOG, "nope", "status_led")).toBeUndefined();
    expect(catalogEntry(CATALOG, "light", null)).toBeUndefined();
    expect(catalogEntry(undefined, "light", "status_led")).toBeUndefined();
  });

  it("resolves related references", () => {
    expect(relatedEntry(CATALOG, "switch.record")?.title).toBe("Record");
    expect(relatedEntry(CATALOG, "nope.x")).toBeUndefined();
    expect(relatedEntry(CATALOG, "nodot")).toBeUndefined();
  });

  it("orders categories with Other last", () => {
    const ids = orderedCategories(CATALOG).map((c) => c.id);
    expect(ids[0]).toBe("detection");
    expect(ids.at(-1)).toBe("other");
    expect(orderedCategories(undefined).map((c) => c.id)).toEqual(["other"]);
  });

  it("labels entities by registry name, then catalog title, then id", () => {
    const entry = catalogEntry(CATALOG, "light", "status_led");
    expect(entityLabel(makeEntity("light.status_led", { name: "LED" }), entry)).toBe("LED");
    expect(entityLabel(makeEntity("light.status_led"), entry)).toBe("Status LED");
    expect(entityLabel(makeEntity("light.x"), undefined)).toBe("light.x");
  });
});

describe("confirmation rules", () => {
  const record = catalogEntry(CATALOG, "switch", "record");
  const dayNight = catalogEntry(CATALOG, "select", "day_night_mode");
  const reboot = catalogEntry(CATALOG, "button", "reboot");

  it("asks only in the harmful direction of a switch", () => {
    expect(confirmationFor(record, "off")).toBe("Stops recording.");
    expect(confirmationFor(record, "on")).toBeNull();
  });

  it("asks for listed select options only", () => {
    expect(confirmationFor(dayNight, { option: "blackwhite" })).toBe("Forced black and white.");
    expect(confirmationFor(dayNight, { option: "auto" })).toBeNull();
    expect(confirmationFor(dayNight, "any")).toBeNull();
  });

  it("asks for any press of a disruptive button and never for safe entries", () => {
    expect(confirmationFor(reboot, "any")).toBe("Restarts the camera.");
    expect(confirmationFor(catalogEntry(CATALOG, "light", "status_led"), "off")).toBeNull();
    expect(confirmationFor(undefined, "any")).toBeNull();
    const bare: CatalogEntry = {
      title: "Bare",
      summary: "",
      what_it_does: "",
      tradeoffs: "",
      related: [],
      requires: "",
      impact: "disruptive",
      sources: [],
      verification: "verified",
      verified_against: [],
    };
    expect(confirmationFor(bare, "on")).toBe("This action can disrupt the camera.");
  });
});

describe("search", () => {
  const entity = makeEntity("switch.record", { name: "Record", sub_device: "Lens 1" });
  const entry = catalogEntry(CATALOG, "switch", "record");

  it("matches every word against name, id and catalog text", () => {
    expect(matchesSearch(entity, entry, "")).toBe(true);
    expect(matchesSearch(entity, entry, "  ")).toBe(true);
    expect(matchesSearch(entity, entry, "record")).toBe(true);
    expect(matchesSearch(entity, entry, "RECORD summary")).toBe(true);
    expect(matchesSearch(entity, entry, "lens")).toBe(true);
    expect(matchesSearch(entity, entry, "switch.rec")).toBe(true);
    expect(matchesSearch(entity, entry, "record floodlight")).toBe(false);
    expect(matchesSearch(entity, undefined, "summary")).toBe(false);
  });
});

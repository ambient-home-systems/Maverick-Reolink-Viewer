import { describe, expect, it } from "vitest";

import { FILTERS_KEY, FILTERS_MAX, loadFilters, saveFilters } from "./event-filters";

/** A Storage of our own (the test's, not the window's). */
function memory(): Pick<Storage, "getItem" | "setItem"> & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

describe("each camera's event filters, kept in this browser (Phase 11 step 3)", () => {
  it("keeps and gives back a camera's filters; none for a camera never seen", () => {
    const store = memory();
    expect(loadFilters("cam-a", store)).toBeUndefined();
    saveFilters("cam-a", { only: ["PERSON"], hideMotion: true }, store);
    saveFilters("cam-b", { only: [], hideMotion: false }, store);
    expect(loadFilters("cam-a", store)).toEqual({ only: ["PERSON"], hideMotion: true });
    expect(loadFilters("cam-b", store)).toEqual({ only: [], hideMotion: false });
    expect(loadFilters("cam-c", store)).toBeUndefined();
  });

  it("reads what it did not write as nothing kept, or as the parts it can", () => {
    const store = memory();
    store.setItem(FILTERS_KEY, "not json");
    expect(loadFilters("cam-a", store)).toBeUndefined();
    store.setItem(FILTERS_KEY, "[1, 2]");
    expect(loadFilters("cam-a", store)).toBeUndefined();
    store.setItem(FILTERS_KEY, JSON.stringify({ "cam-a": { only: ["PERSON", 3], hideMotion: "yes" }, "cam-b": 7 }));
    expect(loadFilters("cam-a", store)).toEqual({ only: ["PERSON"], hideMotion: false });
    expect(loadFilters("cam-b", store)).toBeUndefined();
    // Saving over it keeps what can be kept.
    saveFilters("cam-c", { only: [], hideMotion: true }, store);
    expect(loadFilters("cam-c", store)).toEqual({ only: [], hideMotion: true });
  });

  it("keeps the most recent cameras, at most FILTERS_MAX", () => {
    const store = memory();
    for (let i = 0; i <= FILTERS_MAX; i += 1) saveFilters(`cam-${String(i)}`, { only: [], hideMotion: true }, store);
    expect(loadFilters("cam-0", store)).toBeUndefined();
    expect(loadFilters("cam-1", store)).toBeDefined();
    // Saving again makes it the most recent.
    saveFilters("cam-1", { only: [], hideMotion: false }, store);
    saveFilters("cam-new", { only: [], hideMotion: false }, store);
    expect(loadFilters("cam-1", store)).toBeDefined();
    expect(loadFilters("cam-2", store)).toBeUndefined();
  });

  it("lasts the visit only where storage is refused or full", () => {
    saveFilters("cam-a", { only: [], hideMotion: true }, null);
    expect(loadFilters("cam-a", null)).toBeUndefined();
    const full = memory();
    full.setItem = () => {
      throw new DOMException("full", "QuotaExceededError");
    };
    expect(() => {
      saveFilters("cam-a", { only: [], hideMotion: true }, full);
    }).not.toThrow();
  });
});

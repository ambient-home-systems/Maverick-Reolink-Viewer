import { afterEach, describe, expect, it, vi } from "vitest";

import "./reolink-viewer-panel";
import { deepText, makeHass, okDevices } from "./test-fixtures";
import { loadView } from "./views";

// The live check's file cannot be fetched (the connection dropped).
const attempts = vi.hoisted(() => ({ count: 0 }));
vi.mock("./components/live-check", () => {
  attempts.count += 1;
  throw new Error("Failed to fetch dynamically imported module");
});

const flush = async () => {
  for (let i = 0; i < 4; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
};

afterEach(() => {
  document.body.innerHTML = "";
  window.history.replaceState(null, "", "#");
});

describe("views loaded on demand", () => {
  it("loads a view once, and says when its file cannot be fetched", async () => {
    // The home view's elements need nothing loaded.
    await expect(loadView("live")).resolves.toBeUndefined();
    const events = loadView("events");
    expect(loadView("events")).toBe(events);
    await events;
    expect(customElements.get("rv-events")).toBeDefined();

    window.history.replaceState(null, "", "#live-check");
    const el = document.createElement("reolink-viewer-panel");
    el.hass = makeHass(okDevices());
    document.body.appendChild(el);
    await flush();
    await el.updateComplete;
    expect(deepText(el)).toContain("Could not load this page");
    const retry = [...(el.shadowRoot?.querySelectorAll("button") ?? [])].find((b) => b.textContent.trim() === "Try again");
    retry?.click();
    await flush();
    await el.updateComplete;
    expect(deepText(el)).toContain("Could not load this page");
    // A failed file is not kept: each try fetches it again.
    const first = loadView("live-check");
    await expect(first).rejects.toThrow();
    const again = loadView("live-check");
    expect(again).not.toBe(first);
    await expect(again).rejects.toThrow();
    expect(attempts.count).toBeGreaterThan(0);
  });
});

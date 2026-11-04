import { afterEach, describe, expect, it } from "vitest";

import type { UnusualEvent } from "../types";
import "./unusual-reason";

const MARK: UnusualEvent = {
  camera: "yard",
  kind: "vehicle",
  start: 0,
  end: 64_000,
  score: 6.8,
  line: 4.2,
  unusual: true,
  reason: "Vehicle at the Front Yard at 02:14, when one is rarely seen",
  terms: [
    { name: "clock", label: "02:00", subject: "", contribution: 3.1, seen: 1 },
    { name: "duration", label: "~64s", subject: "", contribution: 6, seen: 4 },
    { name: "kind", label: "vehicle", subject: "", contribution: -0.6, seen: 240 },
    { name: "weekend", label: "Tuesday", subject: "", contribution: 0.02, seen: 50 },
  ],
};

afterEach(() => {
  document.body.innerHTML = "";
});

describe("rv-unusual-reason", () => {
  it("says why, then each signal in words, its bar only showing the size", async () => {
    const el = document.createElement("rv-unusual-reason");
    el.mark = MARK;
    document.body.appendChild(el);
    await el.updateComplete;
    const root = el.shadowRoot;
    expect(root?.querySelector(".sentence")?.textContent).toBe(MARK.reason);
    const items = [...(root?.querySelectorAll("li") ?? [])];
    const said = items.map((li) =>
      [".name", ".value", ".way"].map((part) => li.querySelector(part)?.textContent).join(" | "),
    );
    expect(said).toEqual([
      "Time of day | 02:00 | rarer than chance",
      "How long | About 64 s | rarer than chance",
      "What it was | vehicle | more usual",
      "Day | Tuesday | as by chance",
    ]);
    const fills = items.map((li) => li.querySelector<HTMLElement>(".fill"));
    // Half the bar is 4 nats; more is still half; as by chance, none.
    expect(fills.map((f) => f?.style.width)).toEqual(["38.8%", "50.0%", "7.5%", "0.0%"]);
    expect(fills.map((f) => f?.classList.contains("rarer"))).toEqual([true, true, false, true]);
    expect(items[0]?.querySelector(".bar")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("is empty without a mark", async () => {
    const el = document.createElement("rv-unusual-reason");
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot?.textContent.trim()).toBe("");
  });
});

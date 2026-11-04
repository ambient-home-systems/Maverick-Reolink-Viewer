import { afterEach, describe, expect, it, vi } from "vitest";

import type { HomeAssistant, JournalStatus } from "../types";
import "./learning";

const DAY = Date.UTC(2026, 10, 3, 14);

function fakeHass(status: JournalStatus | Error) {
  return {
    config: { time_zone: "America/New_York" },
    callWS: vi.fn((message: { type: string }) => {
      expect(message.type).toBe("reolink_viewer/journal/status");
      return status instanceof Error ? Promise.reject(status) : Promise.resolve(status);
    }),
  } as unknown as HomeAssistant;
}

async function mount(hass: HomeAssistant) {
  const el = document.createElement("rv-learning");
  el.hass = hass;
  document.body.appendChild(el);
  for (let i = 0; i < 4; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await el.updateComplete;
  }
  return () => (el.shadowRoot?.textContent ?? "").replace(/\s+/g, " ");
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("rv-learning", () => {
  it("says how to turn it on, while it is off", async () => {
    const text = await mount(fakeHass({ enabled: false }));
    expect(text()).toContain("Learning what is normal");
    expect(text()).toContain("Off. Turn on Learn what is normal in Reolink Viewer's options");
    expect(text()).toContain("The journal stays on this Home Assistant.");
  });

  it("says since when it learns, and from how much, per camera", async () => {
    const text = await mount(
      fakeHass({
        enabled: true,
        created: DAY,
        imported: 812,
        changes: 2400,
        detections: 1190,
        sensors: 42,
        bytes: 1_250_000,
        cameras: [
          { id: "a", name: "Doorbell", changes: 900, detections: 450, first: DAY - 10 * 86_400_000, last: DAY },
          { id: "b", name: "Front Yard", changes: 1500, detections: 740, first: DAY - 9 * 86_400_000, last: DAY },
        ],
      }),
    );
    expect(text()).toContain("On since Nov 3, 2026, 09:00: 1,190 detections from 2 cameras so far (1.3 MB).");
    expect(text()).toContain("It started with 812 changes from Home Assistant's history.");
    expect(text()).toContain("Doorbell: 450 detections, since Oct 24, 2026");
    // An older server says nothing of the model.
    expect(text()).not.toContain("Unusual in the last");
  });

  it("says which cameras mark, and the week's marks with why", async () => {
    const text = await mount(
      fakeHass({
        enabled: true,
        created: DAY,
        imported: 0,
        changes: 2400,
        detections: 1190,
        sensors: 42,
        bytes: 1_250_000,
        cameras: [
          { id: "a", name: "Doorbell", changes: 900, detections: 450, first: DAY - 10 * 86_400_000, last: DAY },
          { id: "b", name: "Laundry Room", changes: 40, detections: 20, first: DAY - 9 * 86_400_000, last: DAY },
        ],
        unusual: {
          built: DAY,
          built_in_s: 2.4,
          computed_s: 1.9,
          sensitivity: "balanced",
          scope: "together",
          floor: 1.4,
          cap: 3.912,
          cameras: {
            a: { marking: true, days: 10, events: 900, needs_days: 0, needs_events: 0, line: 3.912 },
            b: { marking: false, days: 9, events: 20, needs_days: 0, needs_events: 180, line: null },
          },
          days: 7,
          events: 5000,
          marks: 25,
          uncapped: 310,
          per_day: { "2026-11-02": 4 },
          by_kind: { person: 20, forgotten_item: 5 },
          by_reason: { clock: 15, predecessor: 10 },
          latest: [
            {
              camera: "a",
              kind: "person",
              start: DAY - 3_600_000,
              end: DAY - 3_590_000,
              score: 4.2,
              line: 3.912,
              unusual: true,
              reason: "Person at 03:12 on Doorbell — 2nd time in 10 days.",
              terms: [],
            },
          ],
        },
      }),
    );
    expect(text()).toContain("Doorbell: 450 detections, since Oct 24, 2026, 10:00. Marks what is unusual");
    expect(text()).toContain("Laundry Room: 20 detections, since Oct 25, 2026, 10:00. Learning: 180 more detections");
    expect(text()).toContain("Unusual in the last 7 days");
    expect(text()).toContain("25 marks, about 3.6 a day, of 5,000 events, at Balanced.");
    expect(text()).toContain("Nov 3, 2026, 08:00 Person at 03:12 on Doorbell — 2nd time in 10 days.");
    expect(text()).toContain("Without the daily cap 310 marks");
    expect(text()).toContain("3.912 (the daily cap; the floor is 1.4)");
    expect(text()).toContain("person 20, forgotten item 5");
    expect(text()).toContain("the time of day 15, what fired before it 10");
    expect(text()).toContain("Doorbell 3.912");
    expect(text()).toContain("All cameras together");
    expect(text()).toContain("Motion is learned from, never marked");
    expect(text()).toContain("in 2.4 s, 1.9 s of it computing");
  });

  it("says it is learning before the model's first build", async () => {
    const text = await mount(
      fakeHass({
        enabled: true,
        created: DAY,
        imported: 0,
        changes: 0,
        detections: 0,
        sensors: 0,
        bytes: 4096,
        cameras: [],
        unusual: {
          built: null,
          built_in_s: 0,
          sensitivity: "few",
          scope: "camera",
          floor: 2.1,
          cap: null,
          cameras: {},
          days: 7,
          events: 0,
          marks: 0,
          uncapped: 0,
          per_day: {},
          by_kind: {},
          by_reason: {},
          latest: [],
        },
      }),
    );
    expect(text()).toContain("It is learning from the journal");
    expect(text()).not.toContain("Unusual in the last");
  });

  it("says when the journal cannot be read", async () => {
    const text = await mount(fakeHass(new Error("not loaded")));
    expect(text()).toContain("Could not read the journal: not loaded");
  });
});

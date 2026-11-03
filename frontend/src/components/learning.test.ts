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
    expect(text()).toContain("Marking what is unusual comes once each camera has a week of history");
  });

  it("says when the journal cannot be read", async () => {
    const text = await mount(fakeHass(new Error("not loaded")));
    expect(text()).toContain("Could not read the journal: not loaded");
  });
});

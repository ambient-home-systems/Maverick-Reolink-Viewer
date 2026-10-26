import { afterEach, describe, expect, it, vi } from "vitest";

import type { HomeAssistant, SoakRun } from "../types";

const copied = vi.hoisted(() => [] as string[]);
vi.mock("../clipboard", () => ({
  copyText: (text: string) => {
    copied.push(text);
    return Promise.resolve(true);
  },
}));

const { SOAK_CLOSE_EVENT } = await import("./live-soak");

afterEach(() => {
  document.body.innerHTML = "";
  copied.length = 0;
});

const flush = async () => {
  for (let i = 0; i < 4; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

function fakeHass(initial: SoakRun | null) {
  const sent: Record<string, unknown>[] = [];
  let run = initial;
  let fail = false;
  const hass = {
    callWS: vi.fn((message: Record<string, unknown>) => {
      sent.push(message);
      if (fail) return Promise.reject(new Error("Reolink Viewer is not loaded"));
      if (message.type === "reolink_viewer/live/soak/start") {
        run = {
          started_at: Date.now(),
          opens: message.grid_open ? 1 : 0,
          open_ms: 0,
          visible_ms: 0,
          tiles: {},
          devices: { [String(message.device)]: Date.now() },
        };
        return Promise.resolve({ run });
      }
      const now = {
        at: Date.now(),
        go2rtc: { state: "running", restarts: 0, memory_kb: null },
        webrtc_sessions: 0,
        feeds: { feeds: 0, warm: 0, viewers: 0, ends: 0 },
        hosts: [],
        battery: [],
      };
      return Promise.resolve({ sample_s: 300, keep_s: 129_600, warmup_s: 300, started_at: 0, run, samples: [], now });
    }),
  } as unknown as HomeAssistant;
  return {
    hass,
    sent,
    fail: () => {
      fail = true;
    },
  };
}

async function mount(hass: HomeAssistant | undefined, closable = false) {
  const el = document.createElement("rv-live-soak");
  el.closable = closable;
  if (hass) el.hass = hass;
  document.body.appendChild(el);
  await flush();
  await el.updateComplete;
  const text = () => el.shadowRoot?.textContent ?? "";
  const button = (label: string) => {
    const found = [...(el.shadowRoot?.querySelectorAll("button") ?? [])].find((b) => b.textContent.trim() === label);
    if (!found) throw new Error(`no ${label} button`);
    return found;
  };
  const labels = () => [...(el.shadowRoot?.querySelectorAll("button") ?? [])].map((b) => b.textContent.trim());
  return { el, text, button, labels };
}

describe("rv-live-soak", () => {
  it("reports Home Assistant's half before a grid has, and starts the run over on request", async () => {
    const fake = fakeHass(null);
    const { el, text, button, labels } = await mount(fake.hass);
    expect(text()).toContain("No grid has reported yet: open Reolink → Watch live");
    expect(text()).toContain("Home Assistant's samples: 1 over 0.0 h");
    // On its own page: no Close.
    expect(labels()).toEqual(["Copy", "Refresh", "Start over…"]);
    button("Start over…").click();
    await el.updateComplete;
    expect(text()).toContain("Start the soak over? What was counted is dropped.");
    button("Cancel").click();
    await el.updateComplete;
    expect(text()).not.toContain("Start the soak over?");
    button("Start over…").click();
    await el.updateComplete;
    button("Start over").click();
    await flush();
    await el.updateComplete;
    expect(fake.sent).toContainEqual(
      expect.objectContaining({ type: "reolink_viewer/live/soak/start", grid_open: false }),
    );
    expect(text()).toContain("Soak started");
    expect(text()).toContain("opened 0 times");
    expect(text()).toContain("Tiles (plays · drops · failed starts):");
  });

  it("reads the run once Home Assistant is set, copies it, and asks to be closed", async () => {
    const fake = fakeHass({
      started_at: Date.now() - 3_600_000,
      opens: 1,
      open_ms: 3_600_000,
      visible_ms: 3_600_000,
      tiles: { Garage: { plays: 1, drops: 0, failures: 0 } },
      devices: { "Mac · Chrome": Date.now() },
    });
    const { el, text, button } = await mount(undefined, true);
    expect(text()).toContain("Reading the soak run…");
    el.hass = fake.hass;
    await flush();
    await el.updateComplete;
    expect(fake.sent.filter((m) => m.type === "reolink_viewer/live/soak")).toHaveLength(1);
    expect(text()).toContain("  Garage: 1 · 0 · 0");
    button("Copy").click();
    await flush();
    await el.updateComplete;
    expect(copied[0]).toContain("Reolink Viewer soak report v");
    expect(button("Copied")).toBeDefined();
    button("Refresh").click();
    await flush();
    expect(fake.sent.filter((m) => m.type === "reolink_viewer/live/soak")).toHaveLength(2);
    const closed: Event[] = [];
    el.addEventListener(SOAK_CLOSE_EVENT, (e) => closed.push(e));
    button("Close").click();
    expect(closed).toHaveLength(1);
  });

  it("says why there is no report", async () => {
    const fake = fakeHass(null);
    fake.fail();
    const { text } = await mount(fake.hass);
    expect(text()).toContain("Could not make the soak report: Reolink Viewer is not loaded");
  });
});

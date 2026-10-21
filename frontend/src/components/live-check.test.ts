import { afterEach, describe, expect, it, vi } from "vitest";

import { routeFromHash, routeToHash } from "./navigation";
import { deepText, makeHass, okDevices } from "../test-fixtures";
import type { LiveCamera } from "../types";

const runs = vi.hoisted(() => [] as { options: Record<string, unknown>; stage: HTMLElement }[]);

vi.mock("../live/check", async (original) => {
  const actual = await original<typeof import("../live/check")>();
  class FakeCheck {
    running = false;
    status = "";
    text = "";
    constructor(
      _hass: unknown,
      readonly options: Record<string, unknown>,
      stage: HTMLElement,
      private readonly _onChange: () => void,
    ) {
      runs.push({ options, stage });
    }
    run(): Promise<string> {
      this.running = true;
      this.text = "Reolink Viewer live check v0 · report";
      this._onChange();
      this.running = false;
      return Promise.resolve(this.text);
    }
    stop(): void {
      this.running = false;
    }
  }
  return { ...actual, LiveCheck: FakeCheck };
});

const { capacityByDefault } = await import("./live-check");
await import("./live-check");

const CAMERAS: LiveCamera[] = [
  { id: "cam1", name: "Garage", model: "RLC-520A", records: true, connections: [] },
  { id: "cam2", name: "Laundry", model: "E1 Zoom", records: false, connections: [] },
];

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

async function mount(admin: boolean) {
  const hass = makeHass(okDevices(), admin);
  hass.responses["reolink_viewer/live/status"] = {
    go2rtc: { state: "failed", version: null, binary: null, error: "go2rtc is not installed", restarts: 3, log: ["line one"] },
    running: {},
    preloaded: [],
    sessions: 0,
  };
  hass.responses["reolink_viewer/live/cameras"] = { cameras: CAMERAS };
  hass.responses["reolink_viewer/playback/check_reports"] = {
    reports: [
      { id: "a", setup: "Live check · iPhone app, Tailscale", text: "live", done: true, updated: "2026-10-21T10:00:00Z" },
      { id: "b", setup: "Desktop Chrome, LAN", text: "playback", done: true, updated: "2026-10-21T10:00:00Z" },
    ],
  };
  const el = document.createElement("rv-live-check");
  el.hass = hass;
  document.body.appendChild(el);
  for (let i = 0; i < 4; i += 1) {
    await flush();
    await el.updateComplete;
  }
  return { el, hass };
}

afterEach(() => {
  document.body.innerHTML = "";
  runs.length = 0;
});

describe("rv-live-check", () => {
  it("shows go2rtc's state, the options and the live reports", async () => {
    const { el } = await mount(true);
    const text = deepText(el);
    expect(text).toContain("go2rtc: failed");
    expect(text).toContain("go2rtc is not installed");
    expect(text).toContain("go2rtc log");
    expect(text).toContain("Kept warm too");
    expect(text).toContain("NVR capacity test");
    expect(text).toContain("Garage");
    expect(text).toContain("Saved reports (1)");
    expect(text).toContain("iPhone app, Tailscale");
  });

  it("hides what needs an admin", async () => {
    const { el } = await mount(false);
    const text = deepText(el);
    expect(text).not.toContain("Kept warm too");
    expect(text).not.toContain("NVR capacity test");
  });

  it("runs the check with the options chosen", async () => {
    const { el } = await mount(true);
    const select = [...el.renderRoot.querySelectorAll("select")].at(1);
    if (!select) throw new Error("no camera select");
    select.value = "cam2";
    select.dispatchEvent(new Event("change"));
    const report = await el.runCheck({ setup: "iPhone app, Nabu Casa" });
    expect(report).toContain("report");
    expect(runs[0]?.options).toEqual({
      setup: "iPhone app, Nabu Casa",
      streams: ["sub", "main", "ext"],
      warm: true,
      stock: true,
      capacity: false, // remote: no recording download over the link
      cameraIds: ["cam2"],
    });
    expect(runs[0]?.stage.classList.contains("stage")).toBe(true);
    await el.updateComplete;
    expect(deepText(el)).toContain("Reolink Viewer live check v0 · report");
    await el.runCheck({ setup: "Desktop Chrome, LAN", streams: ["sub"] });
    expect(runs[1]?.options).toMatchObject({ capacity: true, streams: ["sub"] });
  });

  it("routes and defaults", () => {
    expect(routeFromHash("#live-check")).toEqual({ view: "live-check" });
    expect(routeToHash({ view: "live-check" })).toBe("#live-check");
    expect(capacityByDefault("Desktop Chrome, LAN")).toBe(true);
    expect(capacityByDefault("iPhone app, Tailscale")).toBe(false);
  });
});

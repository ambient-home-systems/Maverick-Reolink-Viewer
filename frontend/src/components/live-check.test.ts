import { afterEach, describe, expect, it, vi } from "vitest";

import { TOAST_EVENT, routeFromHash, routeToHash } from "./navigation";
import { deepText, makeHass, okDevices } from "../test-fixtures";
import type { LiveCamera } from "../types";

const runs = vi.hoisted(() => [] as { options: Record<string, unknown>; stage: HTMLElement }[]);
const copies = vi.hoisted(() => ({ ok: true, texts: [] as string[] }));

vi.mock("../clipboard", () => ({
  copyText: (text: string) => {
    copies.texts.push(text);
    return Promise.resolve(copies.ok);
  },
}));

vi.mock("../live/check", async (original) => {
  const actual = await original<typeof import("../live/check")>();
  class FakeCheck {
    running = false;
    status = "";
    plainStatus = "";
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
    inShort() {
      return {
        headline: "The camera started live video, typically in 0.8 s.",
        findings: [{ grade: "good", text: "Laundry: live video starts in 0.8 s." }],
      };
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

const IPHONE_APP =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Home Assistant/2026.10.1 (io.robbie.HomeAssistant; build:2026.3213; iOS 27.0.0) Mobile/HomeAssistant, like Safari";
const SAVED_LIVE = [
  "Reolink Viewer live check v0.5.4 · iPhone app, Tailscale · 10/21/2026, 10:00:00 AM",
  "Browser: iOS 27.0, Companion app 2026.10.1 · page Tailscale over https · screen 402×874 @3x",
].join("\n");

function setUserAgent(userAgent: string | undefined): void {
  if (userAgent === undefined) Reflect.deleteProperty(navigator, "userAgent");
  else Object.defineProperty(navigator, "userAgent", { value: userAgent, configurable: true });
}

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
      { id: "a", setup: "Live check · iPhone app, Tailscale", text: SAVED_LIVE, done: true, updated: "2026-10-21T10:00:00Z" },
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
  copies.ok = true;
  copies.texts.length = 0;
  setUserAgent(undefined);
  window.localStorage.clear();
});

describe("rv-live-check", () => {
  it("shows go2rtc's state, the options and the live reports", async () => {
    const { el } = await mount(true);
    const text = deepText(el);
    expect(text).toContain("Video service (go2rtc): failed");
    expect(text).toContain("go2rtc is not installed");
    expect(text).toContain("Its log");
    expect(text).toContain("Kept warm too");
    expect(text).toContain("NVR capacity test");
    expect(text).toContain("Garage");
    expect(text).toContain("Saved reports (1)");
    // Where each report was made, so a desktop report is not taken for an iPhone one.
    expect(text).toContain(" · iPhone app, Tailscale · v0.5.4 · iOS 27.0, Companion app 2026.10.1");
  });

  it("starts on this device's setup, remembers the choice and flags another device's", async () => {
    // The setup the check runs with (what its report is filed under).
    const runSetup = async (el: HTMLElement & { renderRoot: ParentNode }) => {
      el.renderRoot.querySelector<HTMLButtonElement>("button.primary")?.click();
      await flush();
      return runs.at(-1)?.options.setup;
    };
    let { el } = await mount(true);
    expect(await runSetup(el)).toBe("Desktop Chrome, LAN");
    expect(deepText(el)).not.toContain("is for another kind of device");
    const select = el.renderRoot.querySelector("select");
    if (!select) throw new Error("no setup select");
    select.value = "iPhone app, Tailscale";
    select.dispatchEvent(new Event("change"));
    await el.updateComplete;
    expect(deepText(el)).toContain("“iPhone app, Tailscale” is for another kind of device");
    document.body.innerHTML = "";
    ({ el } = await mount(true));
    expect(await runSetup(el)).toBe("iPhone app, Tailscale");

    window.localStorage.clear();
    document.body.innerHTML = "";
    setUserAgent(IPHONE_APP);
    ({ el } = await mount(true));
    expect(await runSetup(el)).toBe("iPhone app, Wi-Fi (local)");
    expect(deepText(el)).not.toContain("is for another kind of device");
  });

  it("copies a saved report, and shows it to select where copying is blocked", async () => {
    const { el } = await mount(true);
    const toasts: string[] = [];
    el.addEventListener(TOAST_EVENT, (e) => toasts.push((e as CustomEvent<{ message: string }>).detail.message));
    const copy = el.renderRoot.querySelector<HTMLButtonElement>(".reports button");
    if (!copy) throw new Error("no copy button");
    copy.click();
    await flush();
    await el.updateComplete;
    expect(copies.texts).toEqual([SAVED_LIVE]);
    expect(copy.textContent).toContain("Copied");
    expect(el.renderRoot.querySelector(".reports pre")).toBeNull();

    copies.ok = false;
    copy.click();
    await flush();
    await el.updateComplete;
    expect(toasts).toEqual(["Copying is blocked here: select the text instead, or copy it from Saved reports on a computer"]);
    expect(copy.textContent).toContain("Copy");
    expect(el.renderRoot.querySelector(".reports pre")?.textContent).toBe(SAVED_LIVE);
    // Show and Hide: a report saved with its plain summary opens with it.
    const show = [...el.renderRoot.querySelectorAll<HTMLButtonElement>(".reports button")].find((b) => b.textContent.trim() === "Hide");
    show?.click();
    await el.updateComplete;
    expect(el.renderRoot.querySelector(".reports pre")).toBeNull();
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
    // The result in plain words, then the details for support.
    expect(el.renderRoot.querySelector("rv-findings")?.summary?.headline).toBe("The camera started live video, typically in 0.8 s.");
    expect(el.renderRoot.querySelector("details.support pre")?.textContent).toBe("Reolink Viewer live check v0 · report");
    expect(deepText(el)).toContain("Run it again");
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

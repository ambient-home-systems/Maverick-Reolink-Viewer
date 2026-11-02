import { afterEach, describe, expect, it, vi } from "vitest";

import type { CardLogDevice, HomeAssistant } from "../types";
import "./card-report";
import { routeFromHash, routeToHash } from "./navigation";

const T = Date.UTC(2026, 10, 3, 4);
const TABLET: CardLogDevice = {
  device: "Android · Fully Kiosk",
  updated: "2026-11-03T12:00:00+00:00",
  events: [
    { at: T, what: "page loaded", detail: "visible; Fully Kiosk's JavaScript interface on" },
    { at: T + 500, what: "starting", card: "Doorbell", detail: "SD MSE" },
    { at: T + 900, what: "playing", card: "Doorbell", detail: "SD MSE, 0.4 s" },
  ],
};

function fakeHass(devices: CardLogDevice[], fail = false) {
  const sent: string[] = [];
  let log = devices;
  const hass = {
    config: { time_zone: "America/New_York" },
    callWS: vi.fn((message: { type: string }) => {
      sent.push(message.type);
      if (fail) return Promise.reject(new Error("not loaded"));
      if (message.type === "reolink_viewer/live/card_log/clear") log = [];
      return Promise.resolve(message.type === "reolink_viewer/live/card_log" ? { devices: log } : null);
    }),
  } as unknown as HomeAssistant;
  return { hass, sent };
}

const flush = async () => {
  for (let i = 0; i < 4; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
};

async function mount(hass: HomeAssistant) {
  const el = document.createElement("rv-card-report");
  el.hass = hass;
  document.body.appendChild(el);
  await flush();
  await el.updateComplete;
  const text = () => (el.shadowRoot?.textContent ?? "").replace(/\s+/g, " ");
  const button = (label: string) =>
    [...(el.shadowRoot?.querySelectorAll("button") ?? [])].find((b) => b.textContent.trim() === label);
  return { el, text, button };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("rv-card-report", () => {
  it("is the Checks page #cards", () => {
    expect(routeFromHash("#cards")).toEqual({ view: "cards" });
    expect(routeToHash({ view: "cards" })).toBe("#cards");
  });

  it("sums up each device, with every event to copy, and starts over", async () => {
    const { hass, sent } = fakeHass([TABLET]);
    const { el, text, button } = await mount(hass);
    expect(text()).toContain("Android · Fully Kiosk");
    expect(text()).toContain("Last heard from Nov 3, 2026, 07:00");
    expect(text()).toContain("Fully Kiosk's JavaScript interface: on");
    expect(text()).toContain("Video back after the screen came on or the page was shown: median 0.9 s");
    expect(el.shadowRoot?.querySelector("pre")?.textContent).toContain("Doorbell");
    expect(button("Download")).toBeDefined();
    button("Start over…")?.click();
    await el.updateComplete;
    expect(text()).toContain("Start over? What every device's cards noted is dropped.");
    button("Start over")?.click();
    await flush();
    await el.updateComplete;
    expect(sent).toContain("reolink_viewer/live/card_log/clear");
    expect(text()).toContain("No dashboard card has reported yet.");
  });

  it("says when the log cannot be read", async () => {
    const { hass } = fakeHass([], true);
    const { text } = await mount(hass);
    expect(text()).toContain("Could not read what the cards noted: not loaded");
  });
});

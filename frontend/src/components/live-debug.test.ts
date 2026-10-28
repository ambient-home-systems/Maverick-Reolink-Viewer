import { afterEach, describe, expect, it, vi } from "vitest";

import type { TileDebug } from "../live/debug";
import type { HomeAssistant, LiveStreamState } from "../types";

const copied = vi.hoisted(() => [] as string[]);
vi.mock("../clipboard", () => ({
  copyText: (text: string) => {
    copied.push(text);
    return Promise.resolve(true);
  },
}));

const { DEBUG_CLOSE_EVENT, DEBUG_POLL_MS } = await import("./live-debug");

const INFO: TileDebug = {
  camera: "Garage",
  connection: { connection_id: "nvr1", via: "nvr", entry_title: "RLN36", is_battery: false, streams: {} },
  players: [{ label: "SD", stream: "sub", warm: true, state: { kind: "starting", transport: "MSE" }, events: [] }],
};
const STATE: LiveStreamState = { state: null, holds: 1, preloaded: false, cache: null };

afterEach(() => {
  document.body.innerHTML = "";
  copied.length = 0;
  vi.useRealTimers();
});

async function mount(fail = false) {
  vi.useFakeTimers();
  const sent: Record<string, unknown>[] = [];
  const hass = {
    callWS: vi.fn((message: Record<string, unknown>) => {
      sent.push(message);
      return fail ? Promise.reject(new Error("go2rtc is not running")) : Promise.resolve(STATE);
    }),
  } as unknown as HomeAssistant;
  const el = document.createElement("rv-live-debug");
  el.hass = hass;
  el.info = INFO;
  document.body.appendChild(el);
  await vi.advanceTimersByTimeAsync(0);
  await el.updateComplete;
  const text = () => el.shadowRoot?.querySelector("pre")?.textContent ?? "";
  const button = (label: string) => {
    const found = [...(el.shadowRoot?.querySelectorAll("button") ?? [])].find((b) => b.textContent.trim() === label);
    if (!found) throw new Error(`no ${label} button`);
    return found;
  };
  return { el, sent, text, button };
}

describe("rv-live-debug", () => {
  it("reads the server's state while shown, and stops when closed", async () => {
    const { el, sent, text } = await mount();
    expect(sent).toEqual([{ type: "reolink_viewer/live/state", connection_id: "nvr1", stream: "sub" }]);
    expect(text()).toContain("Garage · through the NVR (RLN36)");
    expect(text()).toContain("SD (sub, kept warm): starting over MSE");
    expect(text()).toContain("server: not in go2rtc, held 1×, no MSE feed");
    await vi.advanceTimersByTimeAsync(DEBUG_POLL_MS);
    expect(sent).toHaveLength(2);
    el.remove();
    await vi.advanceTimersByTimeAsync(DEBUG_POLL_MS * 3);
    expect(sent).toHaveLength(2);
  });

  it("says why the server's state cannot be read", async () => {
    const { el, text } = await mount(true);
    await el.updateComplete;
    expect(text()).toContain("server: cannot read: go2rtc is not running");
  });

  it("copies its text, and asks to be closed", async () => {
    const { el, text, button } = await mount();
    const closed: Event[] = [];
    el.addEventListener(DEBUG_CLOSE_EVENT, (e) => closed.push(e));
    button("Copy").click();
    await vi.advanceTimersByTimeAsync(0);
    await el.updateComplete;
    expect(copied).toEqual([text()]);
    expect(button("Copied")).toBeDefined();
    button("Close").click();
    expect(closed).toHaveLength(1);
    // A dialog: it has the focus when it opens, and Escape closes it too.
    const panel = el.shadowRoot?.querySelector<HTMLElement>('[role="dialog"]');
    expect(el.shadowRoot?.activeElement).toBe(panel);
    panel?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(closed).toHaveLength(2);
  });
});

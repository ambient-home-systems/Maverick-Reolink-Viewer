import { afterEach, describe, expect, it, vi } from "vitest";

import type { HassEntities, HomeAssistant, LiveControls } from "../types";
import { ERROR_MS, type RvLiveControls } from "./live-controls";
import "./live-controls";

const PTZ = {
  stop: "button.cam_ptz_stop",
  left: "button.cam_ptz_left",
  right: "button.cam_ptz_right",
  up: "button.cam_ptz_up",
  down: "button.cam_ptz_down",
};

function state(value: string, attributes: Record<string, unknown> = {}) {
  return { entity_id: "x", state: value, attributes, last_changed: "", last_updated: "" };
}

/** A hass whose service calls are recorded and resolve when told to. */
function fakeHass(states: HassEntities) {
  const calls: { domain: string; service: string; data: unknown; entity: unknown }[] = [];
  const pending: { resolve: () => void; reject: (err: Error) => void }[] = [];
  let hold = false;
  const callService = vi.fn((domain: string, service: string, data: unknown, target: { entity_id: unknown }) => {
    calls.push({ domain, service, data, entity: target.entity_id });
    if (!hold) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      pending.push({ resolve, reject });
    });
  });
  const hass = { states, callService } as unknown as HomeAssistant;
  return {
    hass,
    callService,
    calls,
    pending,
    hold: (on: boolean) => {
      hold = on;
    },
  };
}

const settle = async (el: RvLiveControls) => {
  for (let i = 0; i < 3; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  await el.updateComplete;
};

async function mount(controls: LiveControls, states: HassEntities) {
  const fake = fakeHass(states);
  const el = document.createElement("rv-live-controls");
  el.hass = fake.hass;
  el.controls = controls;
  el.cameraName = "Garage";
  document.body.appendChild(el);
  await el.updateComplete;
  const button = (label: string) => {
    const found = el.shadowRoot?.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
    if (!found) throw new Error(`no ${label} button`);
    return found;
  };
  const byText = (text: string) => {
    const found = [...(el.shadowRoot?.querySelectorAll("button") ?? [])].find((b) => b.textContent.trim() === text);
    if (!found) throw new Error(`no ${text} button`);
    return found;
  };
  return { el, ...fake, button, byText };
}

const ptzStates = (): HassEntities =>
  Object.fromEntries(Object.values(PTZ).map((id) => [id, state("unknown")]));

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("rv-live-controls", () => {
  it("moves while a direction is held, and stops once the move was sent", async () => {
    const { el, calls, pending, hold, button } = await mount({ ptz: PTZ }, ptzStates());
    // The pad has what the camera has: four directions, no diagonals.
    expect(el.shadowRoot?.querySelectorAll(".pad button")).toHaveLength(4);
    hold(true);
    const left = button("Move left");
    left.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 1 }));
    expect(calls).toEqual([{ domain: "button", service: "press", data: {}, entity: PTZ.left }]);
    // Released before Home Assistant answered: stop waits for the move.
    left.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1 }));
    await settle(el);
    expect(calls).toHaveLength(1);
    hold(false);
    pending.at(0)?.resolve();
    await settle(el);
    expect(calls.map((c) => c.entity)).toEqual([PTZ.left, PTZ.stop]);
    // A second release does nothing.
    left.dispatchEvent(new PointerEvent("pointercancel", { pointerId: 1 }));
    await settle(el);
    expect(calls).toHaveLength(2);
  });

  it("moves with the keyboard, and stops when it goes away mid-move", async () => {
    const { el, calls, button } = await mount({ ptz: PTZ }, ptzStates());
    const up = button("Move up");
    up.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    up.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", repeat: true }));
    await settle(el);
    expect(up.classList.contains("held")).toBe(true);
    up.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter" }));
    await settle(el);
    expect(calls.map((c) => c.entity)).toEqual([PTZ.up, PTZ.stop]);

    button("Move down").dispatchEvent(new PointerEvent("pointerdown", { pointerId: 2 }));
    el.remove();
    await settle(el);
    expect(calls.map((c) => c.entity)).toEqual([PTZ.up, PTZ.stop, PTZ.down, PTZ.stop]);
  });

  it("goes to a preset and switches the floodlight", async () => {
    const preset = "select.cam_ptz_preset";
    const floodlight = "light.cam_floodlight";
    const { el, calls, byText } = await mount(
      { preset, floodlight },
      {
        [preset]: state("unknown", { options: ["Gate", "Drive"] }),
        [floodlight]: state("off"),
      },
    );
    const select = el.shadowRoot?.querySelector("select");
    if (!select) throw new Error("no preset list");
    select.value = "Drive";
    select.dispatchEvent(new Event("change"));
    expect(select.value).toBe(""); // ready for the next one
    const light = byText("Light");
    expect(light.getAttribute("aria-pressed")).toBe("false");
    light.click();
    // Home Assistant's state says it is on now.
    el.hass = { ...el.hass, states: { ...el.hass?.states, [floodlight]: state("on") } } as HomeAssistant;
    await settle(el);
    expect(light.getAttribute("aria-pressed")).toBe("true");
    light.click();
    expect(calls).toEqual([
      { domain: "select", service: "select_option", data: { option: "Drive" }, entity: preset },
      { domain: "light", service: "turn_on", data: {}, entity: floodlight },
      { domain: "light", service: "turn_off", data: {}, entity: floodlight },
    ]);
    // No PTZ, zoom or focus: nothing else shows.
    expect(el.shadowRoot?.querySelector(".pad, .zoom")).toBeNull();
  });

  it("sounds the siren only once confirmed, and stops it at once", async () => {
    const siren = "siren.cam_siren";
    const { el, calls, byText } = await mount({ siren }, { [siren]: state("off") });
    byText("Siren").click();
    await settle(el);
    expect(calls).toEqual([]);
    expect(el.shadowRoot?.querySelector(".confirm")?.textContent).toContain("Sound the siren on Garage?");
    // The safe answer has the focus; Escape is No.
    expect(el.shadowRoot?.activeElement?.textContent.trim()).toBe("Cancel");
    el.shadowRoot?.querySelector(".confirm")?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await settle(el);
    expect(el.shadowRoot?.querySelector(".confirm")).toBeNull();
    expect(el.shadowRoot?.activeElement?.textContent.trim()).toBe("Siren");
    byText("Siren").click();
    await settle(el);
    byText("Cancel").click();
    await settle(el);
    expect(el.shadowRoot?.querySelector(".confirm")).toBeNull();
    expect(calls).toEqual([]);

    byText("Siren").click();
    await settle(el);
    byText("Sound it").click();
    expect(calls).toEqual([{ domain: "siren", service: "turn_on", data: {}, entity: siren }]);
    el.hass = { ...el.hass, states: { [siren]: state("on") } } as unknown as HomeAssistant;
    await settle(el);
    byText("Stop siren").click();
    expect(calls.at(-1)).toEqual({ domain: "siren", service: "turn_off", data: {}, entity: siren });
  });

  it("steps zoom and focus numbers by a tenth of their range", async () => {
    const zoom = "number.cam_zoom";
    const focus = "number.cam_focus";
    const { calls, button } = await mount({ zoom, focus }, {
      [zoom]: state("30", { min: 0, max: 33, step: 1 }),
      [focus]: state("0", { min: 0, max: 223, step: 1 }),
    });
    button("Zoom in").click(); // 30 + 3, at the top
    button("Focus out").click(); // already at the bottom: nothing
    button("Focus in").click(); // 0 + 22
    expect(calls).toEqual([
      { domain: "number", service: "set_value", data: { value: 33 }, entity: zoom },
      { domain: "number", service: "set_value", data: { value: 22 }, entity: focus },
    ]);
  });

  it("zooms with the zoom buttons while held, where Home Assistant has them on", async () => {
    const ptz = { ...PTZ, zoom_in: "button.cam_ptz_zoom_in", zoom_out: "button.cam_ptz_zoom_out" };
    const states = { ...ptzStates(), [ptz.zoom_in]: state("unknown"), [ptz.zoom_out]: state("unknown") };
    const { el, calls, button } = await mount({ ptz, zoom: "number.cam_zoom" }, states);
    // The buttons, not the number.
    expect(el.shadowRoot?.querySelectorAll(".zoom .hold")).toHaveLength(2);
    button("Zoom in").dispatchEvent(new PointerEvent("pointerdown", { pointerId: 3 }));
    button("Zoom in").dispatchEvent(new PointerEvent("pointerup", { pointerId: 3 }));
    await settle(el);
    expect(calls.map((c) => c.entity)).toEqual([ptz.zoom_in, PTZ.stop]);
  });

  it("says what failed, for a while, and disables what is unavailable", async () => {
    vi.useFakeTimers();
    const floodlight = "light.cam_floodlight";
    const states = { ...ptzStates(), [floodlight]: state("off"), [PTZ.right]: state("unavailable") };
    const { el, callService, button, byText } = await mount({ ptz: PTZ, floodlight }, states);
    expect(button("Move right").disabled).toBe(true);
    callService.mockRejectedValueOnce(new Error("Camera is offline"));
    byText("Light").click();
    await vi.advanceTimersByTimeAsync(0);
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector(".error")?.textContent).toBe(
      "Could not switch the floodlight: Camera is offline",
    );
    await vi.advanceTimersByTimeAsync(ERROR_MS);
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector(".error")).toBeNull();
  });
});

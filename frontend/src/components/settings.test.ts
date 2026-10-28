import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CATALOG,
  deepText,
  makeConnection,
  makeDevice,
  makeEntity,
  makeHass,
  makeState,
  okDevices,
  withStates,
  type FakeHass,
} from "../test-fixtures";
import type { DeviceResponse } from "../types";
import "./settings";
import { formatState, optionLabel, type RvSettings } from "./settings";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

async function mount(
  hass: FakeHass,
  device: DeviceResponse = makeDevice(),
): Promise<RvSettings> {
  const el = document.createElement("rv-settings");
  el.hass = hass;
  el.device = device;
  el.catalog = CATALOG;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

function root(el: RvSettings): ShadowRoot {
  if (!el.shadowRoot) throw new Error("not rendered");
  return el.shadowRoot;
}
const row = (el: RvSettings, entityId: string) =>
  root(el).querySelector<HTMLElement>(`li[data-entity-id="${entityId}"]`);
const toggleOf = (el: RvSettings, entityId: string) =>
  row(el, entityId)?.querySelector<HTMLButtonElement>("button[role=switch]");
const buttonByText = (el: RvSettings, label: string) =>
  [...root(el).querySelectorAll("button")].find((b) => b.textContent.trim() === label);

function captureToasts(el: HTMLElement): string[] {
  const messages: string[] = [];
  el.addEventListener("rv-toast", (e) => {
    messages.push((e as CustomEvent<{ message: string }>).detail.message);
  });
  return messages;
}

describe("option labels", () => {
  it("says a select's raw option in words", () => {
    expect(optionLabel("black&white")).toBe("Black & white");
    expect(optionLabel("auto")).toBe("Auto");
    expect(optionLabel("on_motion")).toBe("On motion");
  });
});

describe("rv-settings", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("groups entities by category in catalog order and hides disabled ones", async () => {
    const el = await mount(makeHass(okDevices()));
    const titles = [...root(el).querySelectorAll("section.category h3")].map((h) => h.textContent);
    expect(titles).toEqual([
      "Detection tuning",
      "Image",
      "Lights and night vision",
      "Streams and encoding",
      "Recording",
      "System and maintenance",
    ]);
    expect(row(el, "switch.ftp_upload")).toBeNull();
    const text = deepText(el);
    expect(text).toContain("Status LED summary.");
    expect(text).toContain("Show disabled entities (1)");
    expect(text).toContain("-45 dBm");
    expect(text).toContain("Read only");
  });

  it("updates a toggle immediately and keeps HA's state as the truth", async () => {
    const hass = makeHass(okDevices());
    const el = await mount(hass);
    toggleOf(el, "light.status_led")?.click();
    await el.updateComplete;
    expect(toggleOf(el, "light.status_led")?.getAttribute("aria-checked")).toBe("false");
    expect(hass.calls).toEqual([
      {
        domain: "light",
        service: "turn_off",
        data: {},
        target: { entity_id: "light.status_led" },
      },
    ]);
    await flush();
    // Still off while HA catches up.
    expect(toggleOf(el, "light.status_led")?.getAttribute("aria-checked")).toBe("false");
    el.hass = withStates(hass, {
      "light.status_led": makeState("light.status_led", "off", {
        supported_color_modes: ["onoff"],
      }),
    });
    await el.updateComplete;
    expect(el.writes.size).toBe(0);
    expect(toggleOf(el, "light.status_led")?.getAttribute("aria-checked")).toBe("false");
    // Another device's state change does not bring back an old value.
    el.hass = withStates(el.hass as FakeHass, {
      "light.status_led": makeState("light.status_led", "on", {
        supported_color_modes: ["onoff"],
      }),
    });
    await el.updateComplete;
    expect(toggleOf(el, "light.status_led")?.getAttribute("aria-checked")).toBe("true");
  });

  it("rolls back with a visible message when the action fails", async () => {
    const hass = makeHass(okDevices());
    hass.failService = { code: "home_assistant_error", message: "Camera did not respond" };
    const el = await mount(hass);
    const toasts = captureToasts(el);
    toggleOf(el, "light.status_led")?.click();
    await el.updateComplete;
    expect(toggleOf(el, "light.status_led")?.getAttribute("aria-checked")).toBe("false");
    await flush();
    await el.updateComplete;
    expect(toggleOf(el, "light.status_led")?.getAttribute("aria-checked")).toBe("true");
    expect(toasts).toEqual(["Could not change Status LED: Camera did not respond"]);
  });

  it("asks before a disruptive action and does nothing on cancel", async () => {
    const hass = makeHass(okDevices());
    const el = await mount(hass);
    toggleOf(el, "switch.record")?.click();
    await el.updateComplete;
    expect(deepText(el)).toContain("Stops recording.");
    buttonByText(el, "Cancel")?.click();
    await flush();
    await el.updateComplete;
    expect(hass.calls).toEqual([]);
    expect(root(el).querySelector("[role=alertdialog]")).toBeNull();

    toggleOf(el, "switch.record")?.click();
    await el.updateComplete;
    buttonByText(el, "Continue")?.click();
    await flush();
    expect(hass.calls.map((c) => `${c.domain}.${c.service}`)).toEqual(["switch.turn_off"]);
  });

  it("does not ask when turning a setting back on", async () => {
    const hass = makeHass(okDevices());
    hass.states["switch.record"] = makeState("switch.record", "off");
    const el = await mount(hass);
    toggleOf(el, "switch.record")?.click();
    await flush();
    expect(hass.calls.map((c) => c.service)).toEqual(["turn_on"]);
  });

  it("sets select options, asking only for disruptive ones", async () => {
    const hass = makeHass(okDevices());
    const el = await mount(hass);
    const select = row(el, "select.day_night_mode")?.querySelector("select");
    if (!select) throw new Error("no select");
    select.value = "color";
    select.dispatchEvent(new Event("change"));
    await flush();
    expect(hass.calls.at(-1)?.data).toEqual({ option: "color" });

    select.value = "blackwhite";
    select.dispatchEvent(new Event("change"));
    await el.updateComplete;
    expect(deepText(el)).toContain("Forced black and white.");
    buttonByText(el, "Continue")?.click();
    await flush();
    expect(hass.calls.at(-1)?.data).toEqual({ option: "blackwhite" });
  });

  it("sets numbers within min/max and shows the step and unit attributes", async () => {
    const hass = makeHass(okDevices());
    const el = await mount(hass);
    const box = row(el, "number.motion_sensitivity")?.querySelector<HTMLInputElement>(".box");
    const slider = row(el, "number.motion_sensitivity")?.querySelector<HTMLInputElement>(
      "input[type=range]",
    );
    if (!box || !slider) throw new Error("no number inputs");
    expect([slider.min, slider.max, slider.step, box.value]).toEqual(["1", "50", "1", "30"]);
    box.value = "99";
    box.dispatchEvent(new Event("change"));
    await flush();
    expect(hass.calls).toEqual([]);
    expect(box.value).toBe("30");

    slider.value = "12";
    slider.dispatchEvent(new Event("input"));
    expect(box.value).toBe("12");
    slider.dispatchEvent(new Event("change"));
    await flush();
    expect(hass.calls).toEqual([
      {
        domain: "number",
        service: "set_value",
        data: { value: 12 },
        target: { entity_id: "number.motion_sensitivity" },
      },
    ]);
  });

  it("confirms and presses a disruptive button", async () => {
    const hass = makeHass(okDevices());
    const el = await mount(hass);
    row(el, "button.reboot")?.querySelector("button")?.click();
    await el.updateComplete;
    expect(deepText(el)).toContain("Restarts the camera.");
    buttonByText(el, "Continue")?.click();
    await flush();
    expect(hass.calls.map((c) => `${c.domain}.${c.service}`)).toEqual(["button.press"]);
  });

  it("searches across all settings", async () => {
    const el = await mount(makeHass(okDevices()));
    const search = root(el).querySelector<HTMLInputElement>("input[type=search]");
    if (!search) throw new Error("no search");
    search.value = "wi-fi";
    search.dispatchEvent(new Event("input"));
    await el.updateComplete;
    const ids = [...root(el).querySelectorAll("li[data-entity-id]")].map(
      (li) => (li as HTMLElement).dataset.entityId,
    );
    expect(ids).toEqual(["sensor.wifi_signal"]);
    search.value = "does what record";
    search.dispatchEvent(new Event("input"));
    await el.updateComplete;
    expect(row(el, "switch.record")).not.toBeNull();
    search.value = "zzz";
    search.dispatchEvent(new Event("input"));
    await el.updateComplete;
    expect(deepText(el)).toContain("No settings match “zzz”.");
  });

  it("renders the explanation only when expanded", async () => {
    const el = await mount(makeHass(okDevices()));
    const details = row(el, "number.motion_sensitivity")?.querySelector("details");
    if (!details) throw new Error("no details");
    expect(details.open).toBe(false);
    expect(details.textContent).not.toContain("What Motion sensitivity does.");
    details.open = true;
    details.dispatchEvent(new Event("toggle"));
    await el.updateComplete;
    expect(details.textContent).toContain("What Motion sensitivity does.");
    expect(details.textContent).toContain("unverified");
    expect(details.querySelector("a")?.getAttribute("href")).toBe(
      "https://www.home-assistant.io/integrations/reolink/",
    );
    const led = row(el, "light.status_led")?.querySelector("details");
    if (!led) throw new Error("no details");
    led.open = true;
    led.dispatchEvent(new Event("toggle"));
    await el.updateComplete;
    expect(led.textContent).toContain("Related: Record");
  });

  it("enables a disabled entity for admins and explains the reload", async () => {
    const hass = makeHass(okDevices());
    const el = await mount(hass);
    const toasts = captureToasts(el);
    const enabled = vi.fn();
    el.addEventListener("rv-entity-enabled", enabled);
    const checkbox = root(el).querySelector<HTMLInputElement>(".toolbar input[type=checkbox]");
    if (!checkbox) throw new Error("no checkbox");
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change"));
    await el.updateComplete;
    expect(deepText(el)).toContain("reload the Reolink integration entry");
    row(el, "switch.ftp_upload")?.querySelector("button")?.click();
    await flush();
    expect(hass.sent.at(-1)).toEqual({
      type: "config/entity_registry/update",
      entity_id: "switch.ftp_upload",
      disabled_by: null,
    });
    expect(toasts[0]).toContain("reloads the Reolink entry in about 30 seconds");
    expect(enabled).toHaveBeenCalledTimes(1);
  });

  it("reports a failed enable and hides the button from non-admins", async () => {
    const hass = makeHass(okDevices());
    hass.callWS = () =>
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      Promise.reject({ code: "unauthorized", message: "Unauthorized" });
    const el = await mount(hass);
    const toasts = captureToasts(el);
    const checkbox = root(el).querySelector<HTMLInputElement>(".toolbar input[type=checkbox]");
    if (!checkbox) throw new Error("no checkbox");
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change"));
    await el.updateComplete;
    row(el, "switch.ftp_upload")?.querySelector("button")?.click();
    await flush();
    expect(toasts).toEqual(["Could not enable FTP upload: Unauthorized"]);

    el.hass = { ...hass, user: { is_admin: false } };
    await el.updateComplete;
    expect(row(el, "switch.ftp_upload")?.querySelector("button")).toBeNull();
    expect(row(el, "switch.ftp_upload")?.textContent).toContain("Disabled");
  });

  it("switches between the connections of a merged camera", async () => {
    const direct = makeConnection({
      device_id: "dev-direct",
      via: "direct",
      host_name: null,
      entities: [
        makeEntity("switch.record_direct", { key: "record", category: "recording" }),
        makeEntity("light.status_led_direct", { key: "status_led", category: "lighting" }),
      ],
    });
    const hass = makeHass(okDevices());
    const el = await mount(hass, makeDevice({ connections: [makeConnection(), direct] }));
    expect(deepText(el)).toContain("Through Garage NVR · 8 settings");
    expect(row(el, "switch.record")).not.toBeNull();
    buttonByText(el, "Added directly · 2 settings")?.click();
    await el.updateComplete;
    expect(row(el, "switch.record")).toBeNull();
    expect(row(el, "switch.record_direct")?.textContent).toContain("Not loaded yet");
  });

  it("renders the Settings tab for a large device within the 300 ms budget", async () => {
    const domains = ["switch", "number", "select", "sensor", "button", "light"];
    const entities = Array.from({ length: 200 }, (_, i) => {
      const domain = domains[i % domains.length] ?? "switch";
      return makeEntity(`${domain}.e${i}`, { key: `k${i}`, category: "system" });
    });
    const hass = makeHass(okDevices());
    for (const entity of entities) {
      hass.states[entity.entity_id] = makeState(entity.entity_id, "on", {
        options: ["a", "b"],
        min: 0,
        max: 10,
      });
    }
    const el = await mount(hass, makeDevice({ connections: [makeConnection({ entities })] }));
    expect(root(el).querySelectorAll("li[data-entity-id]")).toHaveLength(200);
    expect(el.renderMs).toBeDefined();
    expect(el.renderMs).toBeLessThan(300);
    expect(Number(el.dataset.renderMs)).toBeLessThan(300);
  });

  it("formats read-only states", () => {
    expect(formatState(makeState("binary_sensor.m", "on", { device_class: "motion" }), "binary_sensor")).toBe(
      "Detected",
    );
    expect(formatState(makeState("binary_sensor.m", "off", { device_class: "motion" }), "binary_sensor")).toBe(
      "Clear",
    );
    expect(formatState(makeState("binary_sensor.t", "on"), "binary_sensor")).toBe("On");
    expect(formatState(makeState("binary_sensor.t", "off"), "binary_sensor")).toBe("Off");
    expect(formatState(makeState("sensor.x", "unavailable"), "sensor")).toBe("Unavailable");
    expect(formatState(makeState("sensor.x", "unknown"), "sensor")).toBe("Unknown");
    expect(formatState(makeState("camera.x", "idle"), "camera")).toBe("idle");
  });
});

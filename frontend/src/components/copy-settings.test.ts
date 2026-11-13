import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CATALOG,
  makeCamera,
  makeConnection,
  makeDevice,
  makeEntity,
  makeHass,
  makeState,
  okDevices,
  withStates,
  type FakeHass,
} from "../test-fixtures";
import type { EntityInfo } from "../types";
import { SETTLE_TIMEOUT_MS } from "../writes";
import "./copy-settings";
import { fullestConnection, type RvCopySettings } from "./copy-settings";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const image = (id: string, key: string, more: Partial<EntityInfo> = {}) =>
  makeEntity(id, { key, category: "image", ...more });

// Front Yard (copied from): brightness 140, day and night forced black and white.
const SOURCE = [
  image("number.front_brightness", "image_brightness", { name: "Brightness" }),
  image("select.front_day_night", "day_night_mode"),
  image("number.front_contrast", "image_contrast"),
  makeEntity("switch.front_record", { key: "record", category: "recording" }),
];
// Back Yard, the same model: brightness 100, day and night auto, contrast the same.
const BACK = [
  image("number.back_brightness", "image_brightness"),
  image("select.back_day_night", "day_night_mode"),
  image("number.back_contrast", "image_contrast"),
];
// The Doorbell, another model: no brightness, no black and white.
const DOOR = [image("select.door_day_night", "day_night_mode")];

function copyHass(): FakeHass {
  const hass = makeHass(okDevices());
  hass.states = {
    ...hass.states,
    "number.front_brightness": makeState("number.front_brightness", "140", { min: 0, max: 255, step: 1 }),
    "select.front_day_night": makeState("select.front_day_night", "blackwhite"),
    "number.front_contrast": makeState("number.front_contrast", "128"),
    "switch.front_record": makeState("switch.front_record", "on"),
    "number.back_brightness": makeState("number.back_brightness", "100", { min: 0, max: 255, step: 1 }),
    "select.back_day_night": makeState("select.back_day_night", "auto", { options: ["auto", "color", "blackwhite"] }),
    "number.back_contrast": makeState("number.back_contrast", "128"),
    "select.door_day_night": makeState("select.door_day_night", "auto", { options: ["auto", "color"] }),
  };
  const devices: Partial<Record<string, EntityInfo[]>> = { "dev-back": BACK, "dev-door": DOOR };
  hass.callWS = <T,>(message: Record<string, unknown>) => {
    hass.sent.push(message);
    const entities = devices[String(message.device_id)];
    if (message.type === "reolink_viewer/device" && entities) {
      return Promise.resolve(
        makeDevice({ connections: [makeConnection({ device_id: String(message.device_id), entities })] }) as T,
      );
    }
    return Promise.reject(new Error("no such device"));
  };
  return hass;
}

const CAMERAS = [
  makeCamera(),
  makeCamera({ id: "dev-door", name: "Doorbell", model: "D340W" }),
  makeCamera({ id: "dev-back", name: "Back Yard", model: "CX810" }),
  makeCamera({ id: "dev-gone", name: "Gone", connections: [] }),
];

async function mount(hass: FakeHass): Promise<RvCopySettings> {
  const el = document.createElement("rv-copy-settings");
  el.hass = hass;
  el.source = makeConnection({ entities: SOURCE });
  el.sourceId = "dev-cam";
  el.sourceName = "Front Yard";
  el.sourceModel = "CX810";
  el.cameras = CAMERAS;
  el.catalog = CATALOG;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const text = (node: Element | null | undefined) => node?.textContent.replace(/\s+/g, " ").trim() ?? "";
const button = (el: RvCopySettings, label: string) =>
  [...el.renderRoot.querySelectorAll("button")].find((b) => text(b).startsWith(label));
const choice = (el: RvCopySettings, label: string) =>
  [...el.renderRoot.querySelectorAll<HTMLLabelElement>("label.choice")].find((l) => text(l).startsWith(label));
async function check(el: RvCopySettings, label: string): Promise<void> {
  const input = choice(el, label)?.querySelector("input");
  if (!input) throw new Error(`no choice ${label}`);
  input.checked = true;
  input.dispatchEvent(new Event("change"));
  await el.updateComplete;
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("copy settings to other cameras (Phase 11 step 4)", () => {
  it("offers what can be copied, and the other cameras, the same model first", async () => {
    const el = await mount(copyHass());
    expect(text(el.renderRoot.querySelector("h2"))).toBe("Copy settings from Front Yard");
    const choices = [...el.renderRoot.querySelectorAll("label.choice")].map(text);
    expect(choices).toEqual(["Image 3", "Recording 1", "Back Yard CX810 Same model", "Doorbell D340W"]);
    expect(text(el.renderRoot.querySelector("p.muted:last-of-type"))).toContain("Never copied: the camera's name and on-screen text");
    expect(button(el, "Preview")?.disabled).toBe(true);
    await check(el, "Image");
    expect(button(el, "Preview")?.disabled).toBe(true);
    await check(el, "Back Yard");
    expect(button(el, "Preview")?.disabled).toBe(false);
  });

  it("previews each change and what a camera cannot take, then copies through HA, a result for each", async () => {
    let hass = copyHass();
    const el = await mount(hass);
    await check(el, "Image");
    await check(el, "Back Yard");
    await check(el, "Doorbell");
    button(el, "Preview")?.click();
    await flush();
    await el.updateComplete;
    expect(hass.sent.filter((m) => m.type === "reolink_viewer/device").map((m) => m.device_id)).toEqual(["dev-back", "dev-door"]);

    const [back, door] = [...el.renderRoot.querySelectorAll("section.plan")];
    expect(text(back.querySelector("h3"))).toBe("Back Yard Same model");
    expect([...back.querySelectorAll(".changes li")].map(text)).toEqual([
      // The entity's own name where the catalog has none; the catalog's, with
      // its warning for that very change, where it has one.
      "Brightness 100 → 140",
      "Day night mode Auto → Blackwhite Forced black and white.",
    ]);
    expect(text(back.querySelector("p.muted"))).toBe("1 already the same.");
    expect([...door.querySelectorAll(".cannot li")].map(text)).toEqual([
      "Brightness: This camera has no such setting",
      "Day night mode: It does not offer “blackwhite”",
      "number.front_contrast: This camera has no such setting",
    ]);
    expect(text(button(el, "Copy"))).toBe("Copy 2 changes");

    // HA refuses the day and night mode; the brightness goes through.
    hass.callService = (domain, service, data, target) => {
      hass.calls.push({ domain, service, data, target });
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- HA rejects with plain objects
      return service === "select_option" ? Promise.reject({ code: "x", message: "Camera said no" }) : Promise.resolve(undefined);
    };
    button(el, "Copy")?.click();
    await flush();
    await flush();
    await el.updateComplete;
    expect(hass.calls).toEqual([
      { domain: "number", service: "set_value", data: { value: 140 }, target: { entity_id: "number.back_brightness" } },
      { domain: "select", service: "select_option", data: { option: "blackwhite" }, target: { entity_id: "select.back_day_night" } },
    ]);
    const statuses = () => [...el.renderRoot.querySelectorAll(".changes .status")].map(text);
    expect(statuses()).toEqual(["Sending…", "Refused: Camera said no"]);
    expect(text(el.renderRoot.querySelector("[role=status]"))).toBe("0 changed, 1 not, 1 waiting for the camera.");
    // HA's state shows the change: done.
    hass = withStates(hass, { "number.back_brightness": makeState("number.back_brightness", "140.0") });
    el.hass = hass;
    await el.updateComplete;
    expect(statuses()).toEqual(["Changed", "Refused: Camera said no"]);
    expect(text(el.renderRoot.querySelector("[role=status]"))).toBe("1 changed, 1 not.");

    const closed = vi.fn();
    el.addEventListener("rv-close", closed);
    button(el, "Done")?.click();
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it("says when a change sent did not show, and when a camera's settings cannot be read", async () => {
    const hass = copyHass();
    const el = await mount(hass);
    el.cameras = [...CAMERAS, makeCamera({ id: "dev-broken", name: "Broken" })];
    await el.updateComplete;
    await check(el, "Image");
    await check(el, "Back Yard");
    await check(el, "Broken");
    button(el, "Preview")?.click();
    await flush();
    await el.updateComplete;
    expect(text(el.renderRoot.querySelector(".fault"))).toBe("Its settings could not be read: no such device");
    const now = performance.now();
    button(el, "Copy")?.click();
    await flush();
    await flush();
    vi.spyOn(performance, "now").mockReturnValue(now + SETTLE_TIMEOUT_MS + 60_000);
    el.requestUpdate();
    await el.updateComplete;
    expect([...el.renderRoot.querySelectorAll(".changes .status")].map(text)).toEqual([
      "Sent, but it still shows 100",
      "Sent, but it still shows Auto",
    ]);
  });

  it("closes on Escape, or Cancel, before anything is copied", async () => {
    const el = await mount(copyHass());
    const closed = vi.fn();
    el.addEventListener("rv-close", closed);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    button(el, "Cancel")?.click();
    expect(closed).toHaveBeenCalledTimes(2);
  });

  it("reads a camera through its fullest connection", () => {
    const a = { entities: [1] };
    const b = { entities: [1, 2] };
    expect(fullestConnection([a, b])).toBe(b);
    const none: { entities: number[] }[] = [];
    expect(fullestConnection(none)).toBeUndefined();
  });
});

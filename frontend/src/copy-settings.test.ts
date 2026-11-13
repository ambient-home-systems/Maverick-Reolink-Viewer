import { describe, expect, it } from "vitest";

import {
  NEVER_COPIED,
  applied,
  byKey,
  copyAction,
  copyCall,
  copyable,
  copyableCounts,
  planCopy,
  sameValue,
  sourceSettings,
  type Verdict,
} from "./copy-settings";
import { makeEntity, makeState } from "./test-fixtures";
import type { EntityInfo, HassEntities } from "./types";

// A camera's settings: each entity as the device page lists it.
const image = (id: string, more: Partial<EntityInfo> = {}) => makeEntity(id, { category: "image", ...more });
const SOURCE: EntityInfo[] = [
  image("number.front_brightness", { key: "image_brightness" }),
  image("number.front_contrast", { key: "image_contrast" }),
  image("select.front_day_night", { key: "day_night_mode" }),
  image("switch.front_hdr", { key: "hdr" }),
  makeEntity("switch.front_record", { key: "record", category: "recording" }),
  makeEntity("time.front_flood_start", { key: "floodlight_schedule_start", category: "lighting" }),
];
const STATES: HassEntities = {
  "number.front_brightness": makeState("number.front_brightness", "140", { min: 0, max: 255, step: 1 }),
  "number.front_contrast": makeState("number.front_contrast", "128"),
  "select.front_day_night": makeState("select.front_day_night", "blackwhite", { options: ["auto", "color", "blackwhite"] }),
  "switch.front_hdr": makeState("switch.front_hdr", "on"),
  "switch.front_record": makeState("switch.front_record", "off"),
  "time.front_flood_start": makeState("time.front_flood_start", "19:30:00"),
};

describe("copying settings to other cameras: what is copied (Phase 11 step 4)", () => {
  it("copies settings, never actions, read-only values, names or a camera's own places", () => {
    expect(copyable(image("number.a", { key: "image_brightness" }))).toBe(true);
    // A chime's settings, a turned-off entity, a diagnostic one: no.
    expect(copyable(image("number.a", { key: "volume", sub_device: "Chime 1" }))).toBe(false);
    expect(copyable(image("number.a", { key: "image_brightness", disabled_by: "integration" }))).toBe(false);
    expect(copyable(image("number.a", { key: "image_brightness", entity_category: "diagnostic" }))).toBe(false);
    // Read only, or an action.
    expect(copyable(image("sensor.a", { key: "x" }))).toBe(false);
    expect(copyable(image("button.a", { key: "x" }))).toBe(false);
    for (const id of Object.keys(NEVER_COPIED)) {
      const [domain = "", key = ""] = id.split(".");
      expect(copyable(makeEntity(`${domain}.a`, { key, category: "recording" }))).toBe(false);
    }
    // Pan, tilt and zoom, privacy and system settings are the camera's own.
    expect(copyable(makeEntity("switch.a", { key: "auto_tracking", category: "ptz" }))).toBe(false);
    expect(copyable(makeEntity("switch.a", { key: "privacy_mode", category: "privacy" }))).toBe(false);
    expect(copyable(makeEntity("select.a", { key: "scene_mode", category: "system" }))).toBe(false);
    // What names the camera, should one appear.
    expect(copyable(image("text.a", { key: "camera_title" }))).toBe(false);
    expect(copyable(image("switch.a", { key: "osd_time" }))).toBe(false);
    expect(copyable(image("switch.a", { key: "show_name" }))).toBe(false);
    // No key: it cannot be matched on another camera.
    expect(copyable(image("number.a", { key: null }))).toBe(false);
  });

  it("matches a setting by its key, leaving out a chime's and any held twice", () => {
    const found = byKey([
      image("number.a", { key: "image_brightness" }),
      image("number.b", { key: "volume", sub_device: "Chime 1" }),
      image("select.c", { key: "twice" }),
      image("select.d", { key: "twice" }),
    ]);
    expect([...found.keys()]).toEqual(["number.image_brightness"]);
  });

  it("takes the source's set values, in the categories chosen", () => {
    const states = { ...STATES, "number.front_contrast": makeState("number.front_contrast", "unavailable") };
    expect(sourceSettings(SOURCE, states, new Set(["image"])).map((s) => [s.entity.key, s.value])).toEqual([
      ["image_brightness", "140"],
      ["day_night_mode", "blackwhite"],
      ["hdr", "on"],
    ]);
    expect(copyableCounts(SOURCE, STATES)).toEqual(
      new Map([
        ["image", 4],
        ["recording", 1],
        ["lighting", 1],
      ]),
    );
  });
});

describe("copying settings to other cameras: what each target would do", () => {
  const settings = sourceSettings(SOURCE, STATES, new Set(["image", "recording", "lighting"]));
  const target = (states: HassEntities, entities: EntityInfo[]): Record<string, Verdict> =>
    Object.fromEntries(planCopy(settings, entities, states).map((item) => [item.setting.entity.key ?? "", item.verdict]));

  it("changes what differs, leaves what is the same, and says what it cannot take", () => {
    const entities = [
      image("number.back_brightness", { key: "image_brightness" }),
      image("number.back_contrast", { key: "image_contrast" }),
      image("select.back_day_night", { key: "day_night_mode" }),
      image("switch.back_hdr", { key: "hdr", disabled_by: "user" }),
      makeEntity("time.back_flood_start", { key: "floodlight_schedule_start", category: "lighting" }),
    ];
    const verdicts = target(
      {
        "number.back_brightness": makeState("number.back_brightness", "100", { min: 0, max: 255, step: 1 }),
        "number.back_contrast": makeState("number.back_contrast", "128.0"),
        "select.back_day_night": makeState("select.back_day_night", "auto", { options: ["auto", "color"] }),
        "time.back_flood_start": makeState("time.back_flood_start", "19:30"),
      },
      entities,
    );
    expect(verdicts).toEqual({
      image_brightness: { kind: "change", from: "100" },
      // 128 and 128.0 are the same number.
      image_contrast: { kind: "same" },
      day_night_mode: { kind: "cannot", reason: "It does not offer “blackwhite”" },
      hdr: { kind: "cannot", reason: "Turned off in Home Assistant on this camera" },
      record: { kind: "cannot", reason: "This camera has no such setting" },
      floodlight_schedule_start: { kind: "same" },
    });
  });

  it("refuses a number out of the target's range or off its steps, and waits out an unavailable one", () => {
    const entities = [image("number.b", { key: "image_brightness" })];
    const states = (attributes: Record<string, unknown>, state = "100") => ({
      "number.b": makeState("number.b", state, attributes),
    });
    expect(target(states({ min: 0, max: 100 }), entities).image_brightness).toEqual({
      kind: "cannot",
      reason: "It takes 0 to 100",
    });
    // 140 is 4⅔ steps of 30.
    expect(target(states({ min: 0, max: 255, step: 30 }), entities).image_brightness).toEqual({
      kind: "cannot",
      reason: "It takes steps of 30",
    });
    expect(target(states({ min: 0, max: 255, step: 20 }), entities).image_brightness).toEqual({ kind: "change", from: "100" });
    expect(target(states({}, "unavailable"), entities).image_brightness).toEqual({
      kind: "cannot",
      reason: "Not available now",
    });
    expect(target({}, entities).image_brightness).toEqual({ kind: "cannot", reason: "Not available now" });
  });

  it("sets each through its standard HA action, and reads HA's state as the result", () => {
    expect(copyCall("switch", "on")).toEqual({ domain: "switch", service: "turn_on", data: {} });
    expect(copyCall("light", "off")).toEqual({ domain: "light", service: "turn_off", data: {} });
    expect(copyCall("number", "140")).toEqual({ domain: "number", service: "set_value", data: { value: 140 } });
    expect(copyCall("select", "auto")).toEqual({ domain: "select", service: "select_option", data: { option: "auto" } });
    expect(copyCall("time", "19:30:00")).toEqual({ domain: "time", service: "set_value", data: { time: "19:30:00" } });
    expect(copyAction("switch", "off")).toBe("off");
    expect(copyAction("select", "auto")).toEqual({ option: "auto" });
    expect(copyAction("number", "3")).toBe("any");
    expect(applied("number", "140", makeState("number.b", "140.0"))).toBe(true);
    expect(applied("number", "140", makeState("number.b", "100"))).toBe(false);
    expect(applied("number", "140", undefined)).toBe(false);
    expect(sameValue("time", "07:30", "07:30:00")).toBe(true);
    expect(sameValue("select", "Auto", "auto")).toBe(false);
  });
});

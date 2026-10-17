import { describe, expect, it } from "vitest";

import { statesChanged } from "./render-filter";
import { STATES, makeState } from "./test-fixtures";

describe("statesChanged", () => {
  const ids = ["switch.record", "light.status_led"];

  it("ignores changes to other entities", () => {
    const next = { ...STATES, "sensor.elsewhere": makeState("sensor.elsewhere", "2") };
    expect(statesChanged(STATES, next, ids)).toBe(false);
    expect(statesChanged(STATES, STATES, ids)).toBe(false);
  });

  it("detects a replaced state object of a watched entity", () => {
    const next = { ...STATES, "switch.record": makeState("switch.record", "off") };
    expect(statesChanged(STATES, next, ids)).toBe(true);
  });

  it("detects added and removed entities", () => {
    const rest = Object.fromEntries(
      Object.entries(STATES).filter(([id]) => id !== "light.status_led"),
    );
    expect(statesChanged(STATES, rest, ids)).toBe(true);
    expect(statesChanged(undefined, STATES, ids)).toBe(true);
    expect(statesChanged(STATES, undefined, ids)).toBe(true);
  });
});

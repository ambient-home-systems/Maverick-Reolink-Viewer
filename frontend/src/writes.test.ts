import { describe, expect, it } from "vitest";

import { PendingWrites, SETTLE_TIMEOUT_MS } from "./writes";
import { makeState } from "./test-fixtures";

describe("optimistic writes", () => {
  const base = makeState("switch.record", "on");

  it("shows the new value until HA's state changes", () => {
    const writes = new PendingWrites();
    const token = writes.begin("switch.record", false, base);
    expect(writes.valueFor("switch.record")).toBe(false);
    expect(writes.isPending("switch.record")).toBe(true);
    writes.confirm("switch.record", token);
    expect(writes.isPending("switch.record")).toBe(false);
    // Same state object: HA has not caught up yet.
    expect(writes.settle({ "switch.record": base })).toBe(false);
    expect(writes.valueFor("switch.record")).toBe(false);
    // A new state object: HA's state wins.
    expect(writes.settle({ "switch.record": makeState("switch.record", "off") })).toBe(true);
    expect(writes.valueFor("switch.record")).toBeUndefined();
    expect(writes.size).toBe(0);
  });

  it("rolls back on failure", () => {
    const writes = new PendingWrites();
    const token = writes.begin("switch.record", false, base);
    expect(writes.fail("switch.record", token)).toBe(true);
    expect(writes.valueFor("switch.record")).toBeUndefined();
    expect(writes.fail("switch.record", token)).toBe(false);
  });

  it("ignores results of a superseded write", () => {
    const writes = new PendingWrites();
    const first = writes.begin("number.zoom", 1, undefined);
    writes.begin("number.zoom", 2, undefined);
    expect(writes.fail("number.zoom", first)).toBe(false);
    writes.confirm("number.zoom", first);
    expect(writes.valueFor("number.zoom")).toBe(2);
    expect(writes.isPending("number.zoom")).toBe(true);
  });

  it("gives up waiting after the settle timeout", () => {
    let now = 1000;
    const writes = new PendingWrites(() => now);
    const token = writes.begin("switch.record", false, base);
    writes.confirm("switch.record", token);
    now += SETTLE_TIMEOUT_MS;
    expect(writes.settle({ "switch.record": base })).toBe(false);
    now += 1;
    expect(writes.settle({ "switch.record": base })).toBe(true);
    expect(writes.valueFor("switch.record")).toBeUndefined();
  });
});

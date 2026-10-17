import { describe, expect, it } from "vitest";

import { routeFromHash, routeToHash } from "./components/navigation";
import { brightnessCall, serviceFor } from "./services";

describe("services", () => {
  it("maps each domain to its standard HA action", () => {
    expect(serviceFor("switch", true)).toEqual({ domain: "switch", service: "turn_on", data: {} });
    expect(serviceFor("light", false)).toEqual({ domain: "light", service: "turn_off", data: {} });
    expect(serviceFor("siren", true).service).toBe("turn_on");
    expect(serviceFor("number", 5)).toEqual({
      domain: "number",
      service: "set_value",
      data: { value: 5 },
    });
    expect(serviceFor("select", "auto").data).toEqual({ option: "auto" });
    expect(serviceFor("time", "22:00:00").data).toEqual({ time: "22:00:00" });
    expect(serviceFor("button", "press").service).toBe("press");
    expect(serviceFor("update", "install").service).toBe("install");
    expect(() => serviceFor("sensor", 1)).toThrow("cannot be changed");
    expect(brightnessCall(40)).toEqual({
      domain: "light",
      service: "turn_on",
      data: { brightness_pct: 40 },
    });
  });
});

describe("navigation hash", () => {
  it("round-trips routes", () => {
    const route = { view: "device", id: "a/b", tab: "settings" } as const;
    expect(routeFromHash(routeToHash(route))).toEqual(route);
    expect(routeToHash({ view: "list" })).toBe("");
    expect(routeFromHash("#device/x")).toEqual({ view: "device", id: "x", tab: "overview" });
    expect(routeFromHash("#nonsense")).toEqual({ view: "list" });
    expect(routeFromHash("")).toEqual({ view: "list" });
  });
});

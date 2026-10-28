import { afterEach, describe, expect, it, vi } from "vitest";

import { currentLink, fullScreenHd, keepsFullScreenTaps, rememberFullScreenHd, setKeepsFullScreenTaps } from "./network";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("where the page is", () => {
  it("is at home on a local address, away through Nabu Casa, Tailscale or a public address", () => {
    expect(currentLink("192.168.1.20", undefined)).toEqual({ where: "home", why: "at home" });
    expect(currentLink("homeassistant.local", undefined).where).toBe("home");
    expect(currentLink("abc.ui.nabu.casa", undefined)).toEqual({ where: "away", why: "through Nabu Casa" });
    expect(currentLink("ha.tail1234.ts.net", undefined)).toEqual({ where: "away", why: "through Tailscale" });
    expect(currentLink("8.8.8.8", undefined)).toEqual({ where: "away", why: "away from home" });
    // A name of your own cannot tell: as at home.
    expect(currentLink("ha.example.com", undefined).where).toBe("home");
  });

  it("is away on mobile data, a slow connection or with data saver, wherever the address", () => {
    expect(currentLink("192.168.1.20", { type: "cellular" })).toEqual({ where: "away", why: "on mobile data" });
    expect(currentLink("192.168.1.20", { saveData: true }).why).toBe("with data saver on");
    expect(currentLink("192.168.1.20", { effectiveType: "3g" }).why).toBe("on a slow connection");
    expect(currentLink("192.168.1.20", { type: "wifi", effectiveType: "4g" }).where).toBe("home");
  });
});

describe("HD in full screen", () => {
  const home = { where: "home" as const, why: "at home" };
  const away = { where: "away" as const, why: "through Nabu Casa" };

  it("is on at home and off away, until chosen on this device, for each", () => {
    expect(fullScreenHd(home)).toEqual({ hd: true, chosen: false });
    expect(fullScreenHd(away)).toEqual({ hd: false, chosen: false });
    rememberFullScreenHd("away", true);
    expect(fullScreenHd(away)).toEqual({ hd: true, chosen: true });
    expect(fullScreenHd(home)).toEqual({ hd: true, chosen: false });
    rememberFullScreenHd("home", false);
    expect(fullScreenHd(home)).toEqual({ hd: false, chosen: true });
    expect(fullScreenHd(away).hd).toBe(true);
  });

  it("keeps what is tapped in full screen unless that is turned off, on this device", () => {
    localStorage.clear();
    expect(keepsFullScreenTaps()).toBe(true);
    setKeepsFullScreenTaps(false);
    expect(keepsFullScreenTaps()).toBe(false);
    setKeepsFullScreenTaps(true);
    expect(keepsFullScreenTaps()).toBe(true);
    localStorage.clear();
  });

  it("does without the browser's storage, and ignores what it cannot read", () => {
    localStorage.setItem("reolink-viewer.full-screen-hd", "not json");
    expect(fullScreenHd(home)).toEqual({ hd: true, chosen: false });
    localStorage.setItem("reolink-viewer.full-screen-hd", JSON.stringify({ away: "yes" }));
    expect(fullScreenHd(away)).toEqual({ hd: false, chosen: false });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("private browsing");
    });
    expect(() => {
      rememberFullScreenHd("away", true);
    }).not.toThrow();
  });
});

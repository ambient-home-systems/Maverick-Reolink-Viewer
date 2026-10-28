import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeHass, okDevices, type FakeHass } from "../test-fixtures";
import type { RecentEvent, RecentEvents } from "../types";
import { dayLabel, shortDay } from "./events-view";
import type { BoardCamera } from "./live-grid";
import { routeFromHash, routeToHash, type Route } from "./navigation";

const NOW = Date.UTC(2026, 9, 28, 2, 24); // 21:24 on 27 October in Chicago
const flush = async () => {
  for (let i = 0; i < 4; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
};

const CAMERAS: BoardCamera[] = [
  { id: "door", name: "Doorbell", number: 1 },
  { id: "yard", name: "Front Yard", number: 2 },
  { id: "hall", name: "Hallway", number: 3 },
];

function event(minutes: number, camera: string, types: string[]): RecentEvent {
  const start = NOW - minutes * 60_000;
  return { camera_id: camera, start, end: start + 30_000, types, segment: "s", new: false };
}

const EVENTS = [
  event(26, "door", ["DOORBELL", "PERSON"]),
  event(104, "yard", ["MOTION", "PERSON"]),
  event(179, "yard", ["MOTION", "VEHICLE"]),
  event(300, "door", ["MOTION"]),
];

function eventsHass(): FakeHass {
  const hass = makeHass(okDevices());
  hass.config = { time_zone: "America/Chicago" };
  hass.callWS = <T,>(message: Record<string, unknown>) => {
    hass.sent.push(message);
    if (message.type === "reolink_viewer/events/recent") {
      const feed: RecentEvents = { events: EVENTS, cameras: 3, failed: [], since: 0, now: NOW };
      return Promise.resolve(feed as T);
    }
    if (message.type === "reolink_viewer/events/days") return Promise.resolve({ days: [25, 27], failed: [] } as T);
    return Promise.resolve({ urls: [] } as T);
  };
  return hass;
}

async function mount(hass: FakeHass, date?: string) {
  const el = document.createElement("rv-events");
  el.cameras = CAMERAS;
  el.date = date;
  el.hass = hass;
  document.body.appendChild(el);
  await flush();
  await el.updateComplete;
  const routes: Route[] = [];
  el.addEventListener("rv-navigate", (e) => routes.push((e as CustomEvent<Route>).detail));
  const buttons = () => [...(el.shadowRoot?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
  const byLabel = (label: string) => buttons().find((b) => b.getAttribute("aria-label") === label);
  const chip = (text: string) => buttons().find((b) => b.classList.contains("chip") && b.textContent.trim().endsWith(text));
  const timetable = () => el.shadowRoot?.querySelector("rv-timetable");
  return { el, routes, byLabel, chip, timetable };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("rv-events", () => {
  it("shows today's events, and steps to the day before (today has no date)", async () => {
    const hass = eventsHass();
    const { el, routes, byLabel, timetable } = await mount(hass);
    expect(timetable()?.date).toBeUndefined();
    expect(timetable()?.limit).toBe(Number.POSITIVE_INFINITY);
    expect(timetable()?.heading).toBe("Today");
    expect(byLabel("The day after")?.disabled).toBe(true);
    // The calendar's days come from every camera.
    expect(hass.sent).toContainEqual({ type: "reolink_viewer/events/days", year: 2026, month: 10 });
    byLabel("The day before")?.click();
    expect(routes).toEqual([{ view: "events", date: "2026-10-26" }]);

    el.date = "2026-10-26";
    await el.updateComplete;
    expect(timetable()?.date).toBe("2026-10-26");
    expect(timetable()?.heading).toBe(dayLabel("2026-10-26"));
    byLabel("The day after")?.click();
    expect(routes.at(-1)).toEqual({ view: "events" });
  });

  it("picks a day from a calendar that marks the days with recordings", async () => {
    const hass = eventsHass();
    const { el, routes, byLabel } = await mount(hass, "2026-10-25");
    const pick = byLabel(`${dayLabel("2026-10-25")}: pick a day`);
    expect(pick?.textContent).toContain(shortDay("2026-10-25"));
    pick?.click();
    await el.updateComplete;
    const calendar = el.shadowRoot?.querySelector("rv-calendar");
    expect(calendar?.days).toEqual(new Set([25, 27]));
    expect(calendar?.selected).toBe("2026-10-25");
    calendar?.dispatchEvent(new CustomEvent("rv-day", { detail: { date: "2026-10-27" } }));
    await el.updateComplete;
    expect(routes).toEqual([{ view: "events" }]);
    expect(el.shadowRoot?.querySelector("rv-calendar")).toBeNull();
    // Another month: its days are asked for.
    pick?.click();
    await el.updateComplete;
    el.shadowRoot?.querySelector("rv-calendar")?.dispatchEvent(new CustomEvent("rv-month", { detail: { year: 2026, month: 9 } }));
    await flush();
    expect(hass.sent).toContainEqual({ type: "reolink_viewer/events/days", year: 2026, month: 9 });
  });

  it("filters by camera and by what was seen", async () => {
    const { el, chip, timetable } = await mount(eventsHass());
    await flush();
    await el.updateComplete;
    // The day's cameras and kinds of event, motion as its own kind.
    const chips = [...(el.shadowRoot?.querySelectorAll(".chip") ?? [])].map((c) => c.textContent.trim().replace(/\s+/g, " "));
    expect(chips).toEqual(["1Doorbell", "2Front Yard", "Person", "Vehicle", "Doorbell", "Motion"]);
    chip("Front Yard")?.click();
    await el.updateComplete;
    expect([...(timetable()?.cameraFilter ?? [])]).toEqual(["yard"]);
    expect(chip("Front Yard")?.getAttribute("aria-pressed")).toBe("true");
    chip("Vehicle")?.click();
    await el.updateComplete;
    expect([...(timetable()?.typeFilter ?? [])]).toEqual(["VEHICLE"]);
    await timetable()?.updateComplete;
    expect(timetable()?.shadowRoot?.querySelectorAll("button.row")).toHaveLength(1);
    const clear = [...(el.shadowRoot?.querySelectorAll("button") ?? [])].find((b) => b.textContent.trim() === "Show every event");
    clear?.click();
    await el.updateComplete;
    expect(timetable()?.cameraFilter.size).toBe(0);
    expect(timetable()?.typeFilter.size).toBe(0);
  });
});

describe("events routes", () => {
  it("has a view of today and of any day", () => {
    expect(routeToHash({ view: "events" })).toBe("#events");
    expect(routeFromHash("#events")).toEqual({ view: "events" });
    expect(routeToHash({ view: "events", date: "2026-10-25" })).toBe("#events/2026-10-25");
    expect(routeFromHash("#events/2026-10-25")).toEqual({ view: "events", date: "2026-10-25" });
    expect(routeFromHash("#events/nope")).toEqual({ view: "live" });
  });
});

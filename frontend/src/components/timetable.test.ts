import { afterEach, describe, expect, it } from "vitest";

import { makeHass, okDevices, type FakeHass } from "../test-fixtures";
import type { RecentEvent, RecentEvents } from "../types";
import type { BoardCamera } from "./live-grid";
import type { Route } from "./navigation";
import { FIRST_ROWS, eventLabel, formatLength, pictogram } from "./timetable";

const T0 = Date.UTC(2026, 9, 27, 5); // midnight in Chicago
const at = (h: number, m: number) => T0 + (h * 60 + m) * 60_000;
const flush = async () => {
  for (let i = 0; i < 4; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
};

const CAMERAS: BoardCamera[] = [
  { id: "door", name: "Doorbell", number: 1 },
  { id: "yard", name: "Front Yard", number: 2 },
];

function event(h: number, m: number, camera: string, types: string[], fresh = false, seconds = 30): RecentEvent {
  return { camera_id: camera, start: at(h, m), end: at(h, m) + seconds * 1000, types, segment: "s", new: fresh };
}

function feed(events: RecentEvent[], failed: RecentEvents["failed"] = []): RecentEvents {
  return { events, cameras: 2, failed, since: at(19, 0), now: at(21, 24) };
}

function timetableHass(answer: RecentEvents | Error): FakeHass {
  const hass = makeHass(okDevices());
  hass.config = { time_zone: "America/Chicago" };
  hass.callWS = <T,>(message: Record<string, unknown>) => {
    hass.sent.push(message);
    if (message.type === "reolink_viewer/events/recent") {
      return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer as T);
    }
    if (message.type === "reolink_viewer/thumbnail/urls") {
      const times = message.times as number[];
      return Promise.resolve({ urls: times.map((t) => ({ time: t, bucket: 10, url: `/thumb/${String(message.device_id)}/${String(t)}` })) } as T);
    }
    return Promise.resolve({} as T);
  };
  return hass;
}

async function mount(hass: FakeHass) {
  const el = document.createElement("rv-timetable");
  el.cameras = CAMERAS;
  el.hass = hass;
  document.body.appendChild(el);
  await flush();
  await el.updateComplete;
  const rows = () => [...(el.shadowRoot?.querySelectorAll<HTMLButtonElement>("button.row") ?? [])];
  const text = () => el.shadowRoot?.textContent ?? "";
  const button = (label: string) =>
    [...(el.shadowRoot?.querySelectorAll<HTMLButtonElement>("button") ?? [])].find((b) => b.textContent.trim() === label);
  return { el, rows, text, button };
}

const sentOf = (hass: FakeHass, type: string) => hass.sent.filter((m) => m.type === type);

afterEach(() => {
  document.body.innerHTML = "";
});

describe("rv-timetable", () => {
  it("sets today's events out newest first, the new ones lit", async () => {
    const events = [
      event(20, 58, "door", ["DOORBELL", "PERSON"], true, 85),
      event(19, 40, "yard", ["MOTION", "PERSON"], true),
      ...Array.from({ length: 8 }, (_, i) => event(18 - i, 5, "yard", ["MOTION"])),
    ];
    const hass = timetableHass(feed(events));
    const { el, rows, text, button } = await mount(hass);
    // Cached copies first, then a refresh nobody waits for.
    expect(sentOf(hass, "reolink_viewer/events/recent")).toEqual([
      { type: "reolink_viewer/events/recent", max_age: 3600 },
      { type: "reolink_viewer/events/recent", background: true },
    ]);
    expect(text()).toContain("10 events on 2 cameras");
    expect(rows()).toHaveLength(FIRST_ROWS);
    const first = rows().at(0);
    expect(first?.classList.contains("new")).toBe(true);
    expect(first?.querySelector(".t")?.textContent).toBe("20:58");
    expect(first?.querySelector(".ev")?.textContent).toContain("Person · Doorbell");
    expect(first?.querySelector(".ev")?.textContent).toContain("New");
    expect(first?.querySelector(".cam")?.textContent).toContain("1Doorbell");
    expect(first?.querySelector(".len")?.textContent).toBe("1:25");
    expect(first?.getAttribute("aria-label")).toBe("Person · Doorbell, Doorbell, 20:58, new: play the recording");
    expect(rows().at(2)?.classList.contains("new")).toBe(false);
    // Thumbnails of the rows on show, per camera.
    expect(sentOf(hass, "reolink_viewer/thumbnail/urls").map((m) => m.device_id).sort()).toEqual(["door", "yard"]);
    expect(first?.querySelector("img")?.getAttribute("src")).toBe(`/thumb/door/${String(at(20, 58))}`);

    button("Show all 10 events")?.click();
    await el.updateComplete;
    expect(rows()).toHaveLength(10);
  });

  it("opens an event's recording, and it is no longer new", async () => {
    const opened = event(20, 58, "door", ["DOORBELL", "PERSON"], true);
    const hass = timetableHass(feed([opened]));
    const { el, rows } = await mount(hass);
    const routes: Route[] = [];
    el.addEventListener("rv-navigate", (e) => routes.push((e as CustomEvent<Route>).detail));
    rows().at(0)?.click();
    await el.updateComplete;
    expect(routes).toEqual([{ view: "device", id: "door", tab: "playback", at: opened.start }]);
    expect(sentOf(hass, "reolink_viewer/events/seen")).toEqual([
      { type: "reolink_viewer/events/seen", camera_id: "door", start: opened.start },
    ]);
    expect(rows().at(0)?.classList.contains("new")).toBe(false);
  });

  it("marks everything seen", async () => {
    const hass = timetableHass(feed([event(20, 58, "door", ["PERSON"], true), event(19, 40, "yard", ["PERSON"], true)]));
    const { el, rows, button } = await mount(hass);
    button("Mark all seen")?.click();
    await el.updateComplete;
    expect(sentOf(hass, "reolink_viewer/events/seen")).toEqual([{ type: "reolink_viewer/events/seen", all: true }]);
    expect(rows().some((r) => r.classList.contains("new"))).toBe(false);
    expect(button("Mark all seen")).toBeUndefined();
  });

  it("says when nothing happened, which cameras it could not search, and why it has no events", async () => {
    const quiet = await mount(timetableHass(feed([], [{ camera_id: "yard", error: "timeout" }])));
    expect(quiet.text()).toContain("No events yet");
    expect(quiet.text()).toContain("Nothing recorded an event since midnight.");
    expect(quiet.text()).toContain("Front Yard: today's recordings could not be searched");
    document.body.innerHTML = "";
    const failing = await mount(timetableHass(new Error("Reolink Viewer is not loaded")));
    expect(failing.text()).toContain("Could not read today's events: Reolink Viewer is not loaded");
  });
});

describe("rv-timetable on another day", () => {
  it("shows the day whole, without the line at now, and asks again for another day", async () => {
    const hass = timetableHass(feed(Array.from({ length: 10 }, (_, i) => event(20 - i, 0, "yard", ["MOTION"]))));
    const el = document.createElement("rv-timetable");
    el.cameras = CAMERAS;
    el.date = "2026-10-25";
    el.limit = Number.POSITIVE_INFINITY;
    el.hass = hass;
    document.body.appendChild(el);
    await flush();
    await el.updateComplete;
    // A past day is not refreshed.
    expect(sentOf(hass, "reolink_viewer/events/recent")).toEqual([
      { type: "reolink_viewer/events/recent", date: "2026-10-25", max_age: 3600 },
    ]);
    expect(el.shadowRoot?.querySelector(".now")).toBeNull();
    expect(el.shadowRoot?.querySelectorAll("button.row")).toHaveLength(10);
    expect(el.shadowRoot?.textContent).not.toContain("Show all");
    el.date = "2026-10-24";
    await el.updateComplete;
    await flush();
    expect(sentOf(hass, "reolink_viewer/events/recent").at(-1)).toMatchObject({ date: "2026-10-24" });
  });
});

describe("event labels", () => {
  it("names what was seen, motion only when nothing more is known", () => {
    expect(eventLabel(["MOTION", "PERSON"])).toBe("Person");
    expect(eventLabel(["MOTION", "VEHICLE", "PERSON"])).toBe("Person · Vehicle");
    expect(eventLabel(["MOTION"])).toBe("Motion");
    expect(eventLabel([])).toBe("Motion");
    expect(pictogram(["DOORBELL", "PERSON"])).toBe("visitor");
    expect(pictogram(["MOTION", "ANIMAL"])).toBe("animal");
    expect(pictogram(["PACKAGE"])).toBe("package");
    expect(pictogram(["MOTION", "VEHICLE"])).toBe("vehicle");
    expect(pictogram(["CROSSLINE"])).toBe("motion");
    expect(formatLength(85_000)).toBe("1:25");
    expect(formatLength(3_725_000)).toBe("1:02:05");
  });
});

import { afterEach, describe, expect, it } from "vitest";

import { makeHass, okDevices, type FakeHass } from "../test-fixtures";
import type { RecentEvent, RecentEvents, UnusualEvent, UnusualMarks } from "../types";
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

function timetableHass(answer: RecentEvents | Error, marks?: UnusualMarks | Error): FakeHass {
  const hass = makeHass(okDevices());
  hass.config = { time_zone: "America/Chicago" };
  hass.callWS = <T,>(message: Record<string, unknown>) => {
    hass.sent.push(message);
    if (message.type === "reolink_viewer/events/recent") {
      return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer as T);
    }
    if (message.type === "reolink_viewer/unusual/marks" && marks) {
      return marks instanceof Error ? Promise.reject(marks) : Promise.resolve(marks as T);
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
    // Named by what it shows, so a voice user can say what they see.
    expect(first?.hasAttribute("aria-label")).toBe(false);
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
    expect(failing.text()).toContain("Today's events could not load: Reolink Viewer is not running.");
    expect(failing.text()).toContain("Check it under Settings → Devices & services, then try again.");
  });
});

describe("rv-timetable on the home view", () => {
  it("has its own camera filter and a way to every event", async () => {
    const hass = timetableHass(feed([event(20, 58, "door", ["PERSON"]), event(19, 40, "yard", ["VEHICLE"]), event(18, 5, "yard", ["MOTION"])]));
    const el = document.createElement("rv-timetable");
    el.cameras = CAMERAS;
    el.filters = true;
    el.hass = hass;
    document.body.appendChild(el);
    await flush();
    await el.updateComplete;
    const routes: Route[] = [];
    el.addEventListener("rv-navigate", (e) => routes.push((e as CustomEvent<Route>).detail));
    const chips = () => [...(el.shadowRoot?.querySelectorAll<HTMLButtonElement>(".pick .chip") ?? [])];
    expect(chips().map((c) => c.textContent.replace(/\s+/g, ""))).toEqual(["1Doorbell", "2FrontYard"]);
    chips().at(1)?.click();
    await el.updateComplete;
    expect(chips().at(1)?.getAttribute("aria-pressed")).toBe("true");
    expect(el.shadowRoot?.querySelectorAll("button.row")).toHaveLength(2);
    expect(el.shadowRoot?.textContent).toContain("2 events on 1 camera");
    [...(el.shadowRoot?.querySelectorAll<HTMLButtonElement>("button") ?? [])].find((b) => b.textContent.trim() === "All events")?.click();
    expect(routes).toEqual([{ view: "events" }]);
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

function unusual(kind: string, members: { camera: string; start: number; end: number | null }[], reason: string): UnusualEvent {
  const first = members[0] ?? { camera: "door", start: 0, end: null };
  return {
    camera: first.camera,
    kind,
    start: first.start,
    end: first.end,
    score: 7.4,
    line: 4.2,
    unusual: true,
    reason,
    terms: [
      { name: "clock", label: "02:00", subject: "", contribution: 3.1, seen: 1 },
      { name: "kind", label: kind, subject: "", contribution: -0.6, seen: 240 },
    ],
    members,
  };
}

const MARKING = { marking: true, days: 40, events: 900, needs_days: 0, needs_events: 0, line: 4.2 };

describe("rv-timetable's unusual marks", () => {
  const person = event(20, 58, "door", ["MOTION", "PERSON"]);
  const quiet = event(19, 40, "yard", ["MOTION", "VEHICLE"]);
  const marks: UnusualMarks = {
    enabled: true,
    built: true,
    cameras: { door: MARKING, yard: MARKING },
    marks: [
      unusual("vehicle", [{ camera: "yard", start: at(2, 14), end: at(2, 15) }], "Vehicle at 02:14, at an hour it has not been seen"),
      unusual("person", [{ camera: "door", start: at(20, 58) + 5_000, end: at(20, 59) }], "Person at the Doorbell at an odd hour"),
    ],
  };

  it("asks for the day's marks, and badges the rows they match, with why", async () => {
    const hass = timetableHass(feed([person, quiet]), marks);
    const fired: UnusualMarks[] = [];
    const hear = (e: Event) => fired.push((e as CustomEvent<{ marks: UnusualMarks }>).detail.marks);
    document.addEventListener("rv-timetable-marks", hear, true);
    const { el, rows, text } = await mount(hass);
    await flush();
    await el.updateComplete;
    // Today, midnight to midnight in the home's zone.
    expect(sentOf(hass, "reolink_viewer/unusual/marks").at(0)).toEqual({
      type: "reolink_viewer/unusual/marks",
      since: T0,
      until: T0 + 86_400_000,
    });
    // The journal's vehicle at 02:14 no row matched: a row of its own, oldest last.
    expect(rows().map((r) => r.querySelector(".t")?.textContent)).toEqual(["20:58", "19:40", "02:14"]);
    expect(text()).toContain("3 events on 2 cameras");
    const badges = rows().map((r) => r.querySelector(".badge.unusual")?.textContent ?? "");
    expect(badges).toEqual(["Unusual", "", "Unusual"]);
    const why = [...(el.shadowRoot?.querySelectorAll("details.why") ?? [])];
    expect(why).toHaveLength(2);
    const first = why[0];
    expect(first.querySelector("summary")?.textContent).toContain("Why it is unusual");
    const reason = first.querySelector("rv-unusual-reason");
    await reason?.updateComplete;
    expect(reason?.shadowRoot?.textContent).toContain("Person at the Doorbell at an odd hour");
    // Only the journal's own row says the camera does not list it.
    const said = (d: Element | undefined) => d?.textContent.replace(/\s+/g, " ") ?? "";
    expect(said(first)).not.toContain("own events do not list it");
    expect(said(why[1])).toContain("Seen by Home Assistant's sensors; the camera's own events do not list it.");
    // The Events page hears of them, for its filter.
    expect(fired.at(-1)).toEqual(marks);
    document.removeEventListener("rv-timetable-marks", hear, true);
  });

  it("shows only the marked rows when asked, and says when none are", async () => {
    const hass = timetableHass(feed([person, quiet]), marks);
    const { el, rows } = await mount(hass);
    await flush();
    el.unusualOnly = true;
    await el.updateComplete;
    expect(rows().map((r) => r.querySelector(".t")?.textContent)).toEqual(["20:58", "02:14"]);
    document.body.innerHTML = "";
    const none = await mount(timetableHass(feed([person, quiet]), { ...marks, marks: [] }));
    await flush();
    none.el.unusualOnly = true;
    await none.el.updateComplete;
    expect(none.rows()).toHaveLength(0);
    expect(none.text()).toContain("None match");
    expect(none.text()).toContain("Nothing unusual today.");
  });

  it("shows the rows unmarked when the marks cannot be read", async () => {
    const hass = timetableHass(feed([person, quiet]), new Error("Unknown command"));
    const { rows, el } = await mount(hass);
    await flush();
    await el.updateComplete;
    expect(rows()).toHaveLength(2);
    expect(el.shadowRoot?.querySelector(".badge.unusual")).toBeNull();
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

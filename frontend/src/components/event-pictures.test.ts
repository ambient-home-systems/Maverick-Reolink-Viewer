import { afterEach, describe, expect, it, vi } from "vitest";

import { makeHass, okDevices, type FakeHass } from "../test-fixtures";
import type { TimelineDay, TimelineEvent } from "../types";
import "./event-pictures";
import { MAX_PICTURES, PLAY_STEP_MS, eventAt, pictureDay, pictureTimes } from "./event-pictures";

// 23:00 on 1 November in New York (EST since that morning).
const NIGHT = Date.UTC(2026, 10, 2, 4, 0);
const flush = async () => {
  for (let i = 0; i < 4; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
};

function event(minutes: number, seconds: number, types: string[]): TimelineEvent {
  const start = NIGHT - minutes * 60_000;
  return { start, end: start + seconds * 1000, types, segment: null, ambiguous: false };
}

const EVENTS: [TimelineEvent, TimelineEvent, TimelineEvent] = [
  event(300, 21, ["MOTION", "PERSON"]),
  event(90, 12, ["DOORBELL", "PERSON"]),
  event(30, 4, ["VEHICLE"]),
];

function day(events: TimelineEvent[]): TimelineDay {
  return {
    date: "2026-11-01",
    start: Date.UTC(2026, 10, 1, 4),
    end: Date.UTC(2026, 10, 2, 5),
    now: NIGHT,
    segments: [],
    events,
    complete: false,
    events_error: null,
    hint_source: null,
    timing: { cache: "fresh" },
  };
}

function picturesHass(events: TimelineEvent[] = EVENTS): FakeHass {
  const hass = makeHass(okDevices());
  hass.config = { time_zone: "America/New_York" };
  hass.callWS = <T,>(message: Record<string, unknown>) => {
    hass.sent.push(message);
    if (message.type === "reolink_viewer/timeline/day") return Promise.resolve(day(events) as T);
    if (message.type === "reolink_viewer/thumbnail/urls") {
      const times = message.times as number[];
      return Promise.resolve({ urls: times.map((t) => ({ time: t, bucket: t, url: `/thumb/${String(t)}` })) } as T);
    }
    return Promise.reject(new Error(`unexpected ${String(message.type)}`));
  };
  return hass;
}

async function mount(hass: FakeHass, at?: number) {
  const el = document.createElement("rv-event-pictures");
  el.deviceId = "door";
  el.cameraName = "Doorbell";
  el.at = at;
  el.hass = hass;
  document.body.appendChild(el);
  await flush();
  await el.updateComplete;
  const root = () => el.shadowRoot;
  const byLabel = (label: string) =>
    [...(root()?.querySelectorAll<HTMLButtonElement>("button") ?? [])].find((b) => b.getAttribute("aria-label") === label);
  const text = () => root()?.textContent.replace(/\s+/g, " ") ?? "";
  const image = () => root()?.querySelector<HTMLImageElement>(".frame img");
  const rows = () => [...(root()?.querySelectorAll<HTMLButtonElement>(".events button") ?? [])];
  return { el, byLabel, text, image, rows };
}

describe("rv-event-pictures", () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("picks the pictures of an event: every 5 s, at most 15", () => {
    expect(pictureTimes({ start: 0, end: 21_000 })).toEqual([0, 5000, 10_000, 15_000, 20_000]);
    expect(pictureTimes({ start: 0, end: 0 })).toEqual([0]);
    expect(pictureTimes({ start: 0, end: 229_000 })).toHaveLength(MAX_PICTURES);
  });

  it("opens the event at a time, else the newest", () => {
    const [first, second, third] = EVENTS;
    expect(eventAt(EVENTS, undefined)).toBe(third);
    expect(eventAt(EVENTS, second.start)).toBe(second);
    expect(eventAt(EVENTS, second.start + 60_000)).toBe(second);
    expect(eventAt(EVENTS, first.start - 1)).toBe(first);
    expect(eventAt([], NIGHT)).toBeUndefined();
  });

  it("shows the day's events and the opened one's pictures", async () => {
    const hass = picturesHass();
    const opened = EVENTS[1];
    const { byLabel, text, image, rows } = await mount(hass, opened.start + 1000);
    // Said plainly: no video here, the Reolink app plays it.
    expect(text()).toContain("Pictures of its events");
    expect(text()).toContain("Doorbell keeps its recordings where Reolink Viewer cannot play them yet");
    expect(text()).toContain("play the recordings in the Reolink app");
    // The day of the time opened, in the camera's zone.
    expect(hass.sent[0]).toEqual({ type: "reolink_viewer/timeline/day", device_id: "door", date: "2026-11-01" });
    // Newest first, the opened one marked.
    expect(rows().map((r) => r.getAttribute("aria-pressed"))).toEqual(["false", "true", "false"]);
    expect(rows()[1]?.textContent).toContain("Person · Doorbell");
    // Its pictures: every 5 s through its 12 s, in 5 s buckets.
    expect(hass.sent[1]).toEqual({
      type: "reolink_viewer/thumbnail/urls",
      device_id: "door",
      times: [opened.start, opened.start + 5000, opened.start + 10_000],
      bucket: 5,
    });
    expect(image()?.getAttribute("src")).toBe(`/thumb/${String(opened.start)}`);
    expect(text()).toContain("Asking the camera for the picture");
    image()?.dispatchEvent(new Event("load"));
    await flush();
    expect(text()).not.toContain("Asking the camera");
    expect(text()).toContain("Picture 1 of 3");
    expect(byLabel("The picture before")?.disabled).toBe(true);

    byLabel("The picture after")?.click();
    await flush();
    expect(image()?.getAttribute("src")).toBe(`/thumb/${String(opened.start + 5000)}`);
    expect(text()).toContain("Picture 2 of 3");
    // A picture the camera does not have.
    image()?.dispatchEvent(new Event("error"));
    await flush();
    expect(text()).toContain("No picture of this moment.");

    // Another event.
    rows()[0]?.click();
    await flush();
    expect(rows()[0]?.getAttribute("aria-pressed")).toBe("true");
    expect((hass.sent.at(-1)?.times as number[] | undefined)?.length).toBe(1); // 4 s: one picture
    expect(byLabel("Play the pictures")?.disabled).toBe(true);
  });

  it("plays the pictures one a second, and stops at the last", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const hass = picturesHass([event(30, 21, ["PERSON"])]);
    const { byLabel, text } = await mount(hass);
    byLabel("Play the pictures")?.click();
    await flush();
    expect(byLabel("Pause")).toBeDefined();
    await vi.advanceTimersByTimeAsync(PLAY_STEP_MS * 2);
    expect(text()).toContain("Picture 3 of 5");
    await vi.advanceTimersByTimeAsync(PLAY_STEP_MS * 5);
    expect(text()).toContain("Picture 5 of 5");
    expect(byLabel("Play the pictures")).toBeDefined();
  });

  it("goes from day to day, never past today", async () => {
    vi.useFakeTimers({ now: NIGHT, shouldAdvanceTime: true });
    const hass = picturesHass([]);
    const { byLabel, text } = await mount(hass);
    expect(text()).toContain("Today");
    expect(text()).toContain("No events on this day.");
    expect(byLabel("The day after")?.disabled).toBe(true);
    byLabel("The day before")?.click();
    await flush();
    expect(hass.sent.at(-1)).toMatchObject({ type: "reolink_viewer/timeline/day", date: "2026-10-31" });
    expect(text()).toContain(pictureDay("2026-10-31"));
  });

  it("says when the day cannot be loaded, and tries again", async () => {
    const hass = picturesHass();
    const answer = hass.callWS.bind(hass);
    let failing = true;
    hass.callWS = <T,>(message: Record<string, unknown>): Promise<T> => {
      if (!failing) return answer<T>(message);
      hass.sent.push(message);
      return Promise.reject(new Error("day search failed: RuntimeError"));
    };
    const { el, text } = await mount(hass, NIGHT);
    expect(text()).toContain("Could not load this day's events: day search failed: RuntimeError.");
    failing = false;
    [...(el.shadowRoot?.querySelectorAll("button") ?? [])].find((b) => b.textContent.trim() === "Try again")?.click();
    await flush();
    expect(text()).not.toContain("Could not load");
    expect(text()).toContain("Picture");
  });
});

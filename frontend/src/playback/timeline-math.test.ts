import { describe, expect, it } from "vitest";

import type { Segment, TimelineEvent } from "../types";
import { canPlayMain, playsProgressive } from "./codec";
import { dateIn, firstDayOfWeek, formatClock, formatDuration, offsetAt } from "./time";
import {
  DAY,
  HOUR,
  MINUTE,
  ZOOM_LEVELS,
  addMonths,
  bars,
  centreOn,
  clampView,
  filterEvents,
  isoDate,
  monthGrid,
  nextEvent,
  playTarget,
  presentTypes,
  previousEvent,
  primaryType,
  segmentAt,
  shownTypes,
  thumbBucket,
  tickStep,
  ticks,
  timeToX,
  typeLabel,
  xToTime,
  zoomAt,
  zoomIndex,
} from "./timeline-math";

const T0 = Date.UTC(2026, 9, 17, 4, 0); // midnight EDT
const BOUNDS = { start: T0, end: T0 + DAY };

const seg = (start: number, minutes: number, id = String(start)): Segment => ({
  id,
  start,
  end: start + minutes * MINUTE,
  triggers: [],
  ambiguous: false,
});

const ev = (start: number, types: string[]): TimelineEvent => ({
  start,
  end: start + 30_000,
  types,
  segment: null,
  ambiguous: false,
});

describe("time <-> pixels", () => {
  it("maps both ways", () => {
    const view = { start: T0, span: DAY };
    expect(timeToX(T0 + 12 * HOUR, view, 1000)).toBe(500);
    expect(xToTime(250, view, 1000)).toBe(T0 + 6 * HOUR);
  });

  it("keeps the view inside the day", () => {
    expect(clampView({ start: T0 - HOUR, span: HOUR }, BOUNDS)).toEqual({ start: T0, span: HOUR });
    expect(clampView({ start: T0 + 23.5 * HOUR, span: HOUR }, BOUNDS)).toEqual({
      start: T0 + 23 * HOUR,
      span: HOUR,
    });
    // Wider than the day: the whole day (25-hour days included).
    const long = { start: T0, end: T0 + 25 * HOUR };
    expect(clampView({ start: T0 + HOUR, span: DAY * 2 }, long)).toEqual({ start: T0, span: 25 * HOUR });
    expect(clampView({ start: T0, span: 1 }, BOUNDS).span).toBe(5 * MINUTE);
  });

  it("zooms around an anchor and centres", () => {
    const view = { start: T0, span: DAY };
    const anchor = T0 + 6 * HOUR;
    const zoomed = zoomAt(view, HOUR, anchor, BOUNDS);
    expect(zoomed.span).toBe(HOUR);
    expect(timeToX(anchor, zoomed, 1000)).toBeCloseTo(250);
    expect(centreOn(zoomed, T0 + 12 * HOUR, BOUNDS).start).toBe(T0 + 11.5 * HOUR);
    expect(zoomIndex(50 * MINUTE)).toBe(2);
    expect(ZOOM_LEVELS[0]).toBe(DAY);
    expect(ZOOM_LEVELS[ZOOM_LEVELS.length - 1]).toBe(5 * MINUTE);
  });

  it("chooses tick steps and aligns ticks to the local clock", () => {
    expect(tickStep({ start: T0, span: DAY }, 1000)).toBe(2 * HOUR);
    expect(tickStep({ start: T0, span: 5 * MINUTE }, 1000)).toBe(30_000);
    const offset = () => -4 * HOUR;
    const marks = ticks({ start: T0 + 1, span: DAY }, 1000, offset);
    expect(marks[0]).toBe(T0 + 2 * HOUR);
    expect(marks).toHaveLength(12);
  });
});

describe("recordings", () => {
  const segments = [seg(T0, 10), seg(T0 + 10 * MINUTE, 5), seg(T0 + HOUR, 2)];

  it("merges adjacent recordings into bars", () => {
    expect(bars(segments, { start: T0, span: DAY }, 1000)).toEqual([
      { start: T0, end: T0 + 15 * MINUTE },
      { start: T0 + HOUR, end: T0 + HOUR + 2 * MINUTE },
    ]);
    expect(bars(segments, { start: T0 + 2 * HOUR, span: HOUR }, 1000)).toEqual([]);
  });

  it("finds the recording to play at a time", () => {
    expect(segmentAt(segments, T0 + 12 * MINUTE)?.start).toBe(T0 + 10 * MINUTE);
    expect(segmentAt(segments, T0 + 30 * MINUTE)).toBeUndefined();
    expect(playTarget(segments, T0 + 3 * MINUTE)).toEqual({ segment: segments[0], offset: 3 * MINUTE });
    expect(playTarget(segments, T0 + 30 * MINUTE)).toEqual({ segment: segments[2], offset: 0 });
    expect(playTarget(segments, T0 + 2 * HOUR)).toBeUndefined();
  });
});

describe("events", () => {
  const events = [ev(T0, ["MOTION"]), ev(T0 + HOUR, ["MOTION", "PERSON"]), ev(T0 + 2 * HOUR, ["ANIMAL"])];

  it("filters by what was seen (motion only when nothing more is known); none chosen: all", () => {
    expect(filterEvents(events, new Set())).toBe(events);
    expect(filterEvents(events, new Set(["MOTION"])).map((e) => e.start)).toEqual([T0]);
    expect(filterEvents(events, new Set(["PERSON", "ANIMAL"])).map((e) => e.start)).toEqual([T0 + HOUR, T0 + 2 * HOUR]);
    expect(shownTypes(["MOTION", "VEHICLE", "PERSON"])).toEqual(["PERSON", "VEHICLE"]);
    expect(shownTypes([])).toEqual(["MOTION"]);
  });

  it("steps to the next and previous event", () => {
    expect(nextEvent(events, T0)?.start).toBe(T0 + HOUR);
    expect(nextEvent(events, T0 + 2 * HOUR)).toBeUndefined();
    expect(previousEvent(events, T0 + HOUR + 1000)?.start).toBe(T0);
    expect(previousEvent(events, T0)).toBeUndefined();
  });

  it("names and orders types", () => {
    expect(primaryType(["MOTION", "PERSON"])).toBe("PERSON");
    expect(primaryType([])).toBe("MOTION");
    expect(primaryType(["UNKNOWN", "MOTION"])).toBe("MOTION");
    expect(typeLabel("CROSSLINE")).toBe("Line crossing");
    expect(typeLabel("NEW_TYPE")).toBe("new_type");
    expect(presentTypes(events)).toEqual(["PERSON", "ANIMAL", "MOTION"]);
  });

  it("picks coarser thumbnails when zoomed out", () => {
    expect(thumbBucket(DAY)).toBe(300);
    expect(thumbBucket(HOUR)).toBe(60);
    expect(thumbBucket(15 * MINUTE)).toBe(10);
    expect(thumbBucket(5 * MINUTE)).toBe(5);
  });
});

describe("calendar", () => {
  it("lays out a month", () => {
    // October 2026 starts on a Thursday.
    const sundayFirst = monthGrid(2026, 10, 0);
    expect(sundayFirst[0]).toEqual([null, null, null, null, 1, 2, 3]);
    const mondayFirst = monthGrid(2026, 10, 1);
    expect(mondayFirst[0]).toEqual([null, null, null, 1, 2, 3, 4]);
    expect(mondayFirst.flat().filter((d) => d !== null)).toHaveLength(31);
    expect(mondayFirst.every((w) => w.length === 7)).toBe(true);
  });

  it("moves between months", () => {
    expect(addMonths(2026, 12, 1)).toEqual([2027, 1]);
    expect(addMonths(2026, 1, -1)).toEqual([2025, 12]);
    expect(isoDate(2026, 3, 8)).toBe("2026-03-08");
  });
});

describe("time display", () => {
  it("formats in a zone", () => {
    expect(formatClock(T0, "America/New_York")).toBe("00:00");
    expect(formatClock(T0 + 61_000, "America/New_York", true)).toBe("00:01:01");
    expect(dateIn(T0 - 1, "America/New_York")).toBe("2026-10-16");
    expect(dateIn(T0, "America/New_York")).toBe("2026-10-17");
    expect(offsetAt(T0, "America/New_York")).toBe(-4 * HOUR);
    expect(offsetAt(Date.UTC(2026, 0, 15), "America/New_York")).toBe(-5 * HOUR);
    expect(formatClock(T0, "Not/A_Zone")).toMatch(/\d\d:\d\d/);
  });

  it("formats durations and week starts", () => {
    expect(formatDuration(42_000)).toBe("42 s");
    expect(formatDuration(125_000)).toBe("2 min 05 s");
    expect(formatDuration(3_725_000)).toBe("1 h 02 min");
    expect([0, 1]).toContain(firstDayOfWeek("en-US"));
    expect(firstDayOfWeek("de-DE")).toBe(1);
  });
});

describe("codec decisions", () => {
  const info = { codec: "hvc1.1.6.L153.B0", width: 7680, height: 2160, audio: "mp4a.40.2" };
  const answer = (supported: boolean, smooth = true) => () =>
    Promise.resolve({ supported, smooth, powerEfficient: true } as MediaCapabilitiesDecodingInfo);

  it("uses main only when the browser can decode it smoothly", async () => {
    expect(await canPlayMain(info, answer(true))).toEqual({
      main: true,
      reason: "hvc1.1.6.L153.B0 at 7680×2160 is supported",
    });
    expect((await canPlayMain(info, answer(false))).main).toBe(false);
    expect((await canPlayMain(info, answer(true, false))).reason).toMatch(/smoothly/);
    // Never seen: HD may be tried (the player falls back to SD).
    const untried = await canPlayMain(null, answer(false));
    expect(untried.main).toBe(true);
    expect(untried.reason).toMatch(/not tried yet/);
    expect((await canPlayMain({ ...info, width: null }, answer(true))).main).toBe(false);
    expect((await canPlayMain(info, undefined)).main).toBe(false);
    expect((await canPlayMain(info, () => Promise.reject(new Error("x")))).main).toBe(false);
  });

  it("knows which browsers play while downloading", () => {
    const iphoneApp =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Home Assistant/2026.10";
    const chrome =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";
    const safari =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
    const firefox = "Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0";
    expect(playsProgressive(iphoneApp)).toBe(false);
    expect(playsProgressive(safari)).toBe(false);
    expect(playsProgressive(chrome)).toBe(true);
    expect(playsProgressive(firefox)).toBe(true);
  });
});

import { describe, expect, it } from "vitest";

import type { RecentEvent, UnusualEvent, UnusualTerm } from "./types";
import { SLACK_MS, kindType, markRows, rowKey, termDirection, termName, termValue } from "./unusual";

const T0 = Date.UTC(2026, 10, 3, 6); // midnight in Chicago
const at = (h: number, m: number, s = 0) => T0 + ((h * 60 + m) * 60 + s) * 1000;
const DAY: [number, number] = [T0, T0 + 86_400_000];

function row(camera: string, start: number, seconds: number, types: string[]): RecentEvent {
  return { camera_id: camera, start, end: start + seconds * 1000, types, segment: "s", new: false };
}

function mark(kind: string, members?: NonNullable<UnusualEvent["members"]>): UnusualEvent {
  const first = members?.[0];
  return {
    camera: first?.camera ?? "door",
    kind,
    start: first?.start ?? 0,
    end: first?.end ?? null,
    score: 6.2,
    line: 4.1,
    unusual: true,
    reason: `${kind} at an odd hour`,
    terms: [],
    ...(members ? { members } : {}),
  };
}

const term = (name: string, label: string, contribution: number, subject = ""): UnusualTerm => ({
  name,
  label,
  subject,
  contribution,
  seen: 3,
});

describe("markRows", () => {
  it("marks each camera's rows that overlap the incident, those showing its kind first", () => {
    const person = row("door", at(2, 14, 5), 40, ["MOTION", "PERSON"]);
    const motion = row("door", at(2, 14, 20), 20, ["MOTION"]);
    const later = row("door", at(2, 20), 30, ["PERSON"]);
    const yard = row("yard", at(2, 14, 30), 30, ["MOTION"]);
    const marked = mark("person", [
      { camera: "door", start: at(2, 14), end: at(2, 14, 30) },
      { camera: "yard", start: at(2, 14, 25), end: at(2, 15) },
    ]);
    const { marks, journal } = markRows([later, person, motion, yard], [marked], ...DAY);
    // The door's person row, not its motion beside it; the yard's only row, though it saw no person.
    expect([...marks.keys()].sort()).toEqual([rowKey(person), rowKey(yard)].sort());
    expect(marks.get(rowKey(person))).toBe(marked);
    expect(journal).toEqual([]);
  });

  it("allows a little slack either side, and no more", () => {
    const before = row("door", at(3, 0) - SLACK_MS - 10_000, 10, ["PERSON"]); // ends SLACK_MS before
    const tooEarly = row("door", at(3, 0) - SLACK_MS - 20_000, 10, ["PERSON"]);
    const open = mark("person", [{ camera: "door", start: at(3, 0), end: null }]);
    const { marks } = markRows([before, tooEarly], [open], ...DAY);
    expect([...marks.keys()]).toEqual([rowKey(before)]);
  });

  it("gives an incident no row matched a row of its own, if it began in the day", () => {
    const today = mark("vehicle", [{ camera: "garage", start: at(2, 14), end: at(2, 15) }]);
    const yesterday = mark("vehicle", [{ camera: "garage", start: T0 - 60_000, end: T0 + 60_000 }]);
    const { marks, journal } = markRows([], [today, yesterday], ...DAY);
    expect(journal).toEqual([
      { camera_id: "garage", start: at(2, 14), end: at(2, 15), types: ["VEHICLE"], segment: null, new: false, journal: true },
    ]);
    expect(marks.get(rowKey(journal[0]))).toBe(today);
    expect(marks.size).toBe(1);
  });

  it("reads a mark without members as its own event", () => {
    const door = row("door", at(5, 0), 30, ["DOORBELL"]);
    const lone: UnusualEvent = { ...mark("doorbell"), camera: "door", start: at(5, 0, 10), end: null };
    expect([...markRows([door], [lone], ...DAY).marks.keys()]).toEqual([rowKey(door)]);
  });
});

describe("a mark's signals, in words", () => {
  it("names each signal, a sensor's by what it is", () => {
    expect(termName(term("clock", "02:00", 2.1))).toBe("Time of day");
    expect(termName(term("signal", "on", 1.2, "Garage door"))).toBe("Garage door");
    expect(termName(term("signal", "on", 1.2))).toBe("Signal");
    expect(termName(term("novel", "x", 1))).toBe("novel");
  });

  it("spells out a length", () => {
    expect(termValue(term("duration", "~32s", 1))).toBe("About 32 s");
    expect(termValue(term("duration", "~64s", 1))).toBe("About 64 s");
    expect(termValue(term("duration", "~128s", 1))).toBe("About 2 min");
    expect(termValue(term("duration", "~512s", 1))).toBe("About 9 min");
    expect(termValue(term("duration", "open", 1))).toBe("Still going");
    expect(termValue(term("duration", "instant", 1))).toBe("An instant");
    expect(termValue(term("kind", "person", 1))).toBe("person");
  });

  it("says which way a signal points, and when it says nothing", () => {
    expect(termDirection(term("clock", "02:00", 2.1))).toBe("rarer than chance");
    expect(termDirection(term("kind", "person", -0.8))).toBe("more usual");
    expect(termDirection(term("weekend", "weekday", 0.01))).toBe("as by chance");
  });

  it("shows the journal's kinds as the camera's event types", () => {
    expect(kindType("forgotten_item")).toBe("FORGOTTEN_ITEM");
    expect(kindType("tamper")).toBe("TAMPER");
  });
});

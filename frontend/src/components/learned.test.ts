import { afterEach, describe, expect, it } from "vitest";

import { makeHass, okDevices, type FakeHass } from "../test-fixtures";
import type { LearnedKind, LearnedProfile } from "../types";
import { LIST_ROWS, clockSummary, kindName } from "./learned";

const flush = async () => {
  for (let i = 0; i < 4; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
};

const values = (rows: [string, number][]) => {
  const total = rows.reduce((sum, [, n]) => sum + n, 0);
  return rows.map(([label, events]) => ({ value: label, label, events, share: events / total }));
};

function kind(name: string, hours: Record<number, number>): LearnedKind {
  const clock = Array.from({ length: 24 }, (_, hour) => ({ hour, events: hours[hour] ?? 0, weight: hours[hour] ?? 0 }));
  return {
    kind: name,
    events: clock.reduce((sum, h) => sum + h.events, 0),
    days: 12,
    clock,
    duration: values([["About 8 s", 40], ["About 16 s", 20], ["About 4 min", 3]]),
    predecessor: values([
      ["Nothing fired first", 30],
      ["Front Yard Left, within 30 s", 12],
      ["Doorbell, within 30 s", 9],
      ["Garage Camera, within 1 min", 6],
      ["Back Yard, within 1 min", 5],
      ["Dogs, within 2 min", 1],
    ]),
    day_of_week: values(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => [d, i === 6 ? 0 : 9])),
  };
}

const PROFILE: LearnedProfile = {
  enabled: true,
  built: true,
  state: { marking: true, days: 12, events: 2400, needs_days: 0, needs_events: 0, line: 0 },
  known_after: 10,
  kinds: [kind("person", { 8: 20, 18: 40, 19: 3 }), kind("package", { 11: 4, 12: 2 })],
};

function learnedHass(answer: LearnedProfile | Error): FakeHass {
  const hass = makeHass(okDevices());
  hass.callWS = <T,>(message: Record<string, unknown>) => {
    hass.sent.push(message);
    if (message.type === "reolink_viewer/unusual/profile") {
      return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer as T);
    }
    return Promise.resolve({} as T);
  };
  return hass;
}

async function mount(hass: FakeHass, camera = "cam-door") {
  const el = document.createElement("rv-learned");
  el.hass = hass;
  el.camera = camera;
  document.body.appendChild(el);
  await flush();
  await el.updateComplete;
  const text = () => (el.shadowRoot?.textContent ?? "").replace(/\s+/g, " ");
  return { el, text };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("rv-learned", () => {
  it("shows, per kind, when, which days, how long and what fired first", async () => {
    const hass = learnedHass(PROFILE);
    const { el, text } = await mount(hass);
    expect(hass.sent).toEqual([{ type: "reolink_viewer/unusual/profile", camera_id: "cam-door" }]);
    expect(el.hidden).toBe(false);
    expect(text()).toContain("What it has learned");
    expect(text()).toContain("It marks what is unusual for this camera.");
    expect(text()).toContain("What it has seen 10 times is normal here");
    const kinds = [...(el.shadowRoot?.querySelectorAll("details.kind") ?? [])];
    expect(kinds.map((k) => k.querySelector(".name")?.textContent)).toEqual(["Person", "Package"]);
    // The commonest kind open, the rest a tap away.
    expect(kinds.map((k) => (k as HTMLDetailsElement).open)).toEqual([true, false]);
    const person = kinds[0];
    expect(person.querySelector("summary")?.textContent).toContain("63 seen in 12 days");
    const hours = person.querySelector(".hours .bars");
    expect(hours?.getAttribute("role")).toBe("img");
    expect(hours?.getAttribute("aria-label")).toBe("Most often 18:00 to 19:00 (40 of 63); never in 21 of the 24 hours.");
    expect(hours?.querySelectorAll(".bar")).toHaveLength(24);
    expect(hours?.querySelectorAll(".bar")[18]?.getAttribute("title")).toBe("18:00–19:00: 40");
    expect(person.querySelector(".days .bars")?.getAttribute("aria-label")).toBe(
      "Mon 9, Tue 9, Wed 9, Thu 9, Fri 9, Sat 9, Sun 0",
    );
    // Lists: what it has seen fewer than 10 times can still stand out; past five, a sum.
    const lists = [...person.querySelectorAll(".list")];
    const rows = (list: Element | undefined) =>
      [...(list?.querySelectorAll("li") ?? [])].map((li) => li.textContent.replace(/\s+/g, " ").trim());
    expect(rows(lists[0])).toEqual(["About 8 s 63%", "About 16 s 32%", "About 4 min Can stand out 5%"]);
    expect(rows(lists[1])).toHaveLength(LIST_ROWS);
    expect(lists[1]?.textContent.replace(/\s+/g, " ")).toContain("And 1 more, 2% between them.");
  });

  it("says when it is still learning, and is not there when learning is off or cannot be read", async () => {
    const learning = await mount(
      learnedHass({ ...PROFILE, state: { ...(PROFILE.state as NonNullable<LearnedProfile["state"]>), marking: false, needs_days: 2, needs_events: 145 } }),
    );
    expect(learning.text()).toContain("Still learning before it marks: 2 more days and 145 more detections.");
    document.body.innerHTML = "";
    const off = await mount(learnedHass({ enabled: false }));
    expect(off.el.hidden).toBe(true);
    expect(off.text().trim()).toBe("");
    document.body.innerHTML = "";
    const failing = await mount(learnedHass(new Error("Unknown command")));
    expect(failing.el.hidden).toBe(true);
    document.body.innerHTML = "";
    const empty = await mount(learnedHass({ ...PROFILE, kinds: [] }));
    expect(empty.text()).toContain("Nothing yet: this camera has not detected anything since learning began.");
  });

  it("names kinds as the panel does, and says the day's shape in words", () => {
    expect(kindName("person")).toBe("Person");
    expect(kindName("forgotten_item")).toMatch(/^[A-Z]/);
    expect(clockSummary(kind("animal", {}).clock)).toBe("Not seen at any hour yet.");
    expect(clockSummary(kind("animal", { 1: 2, 23: 5 }).clock)).toBe("Most often 23:00 to 00:00 (5 of 7); never in 22 of the 24 hours.");
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

import type { HomeAssistant, JournalStatus, UnusualCheck } from "../types";
import { learningCheckLines, learningCheckReport } from "./learning-check";
import "./learning";

const DAY = Date.UTC(2026, 10, 3, 14);
const ZONE = "America/New_York";
const NAMES = new Map([
  ["cam-drive", "Drive"],
  ["cam-yard", "Yard"],
]);

type Check = Extract<UnusualCheck, { enabled: true }>;

function mark(overrides: Partial<Check["marks"][number]> = {}): Check["marks"][number] {
  return {
    kind: "person",
    start: DAY,
    end: DAY + 20_000,
    camera: "cam-drive",
    cameras: ["Drive"],
    reason: "Person at 09:00 on Drive",
    fired: 1,
    delay: 0.8,
    when: "start",
    automations: ["automation.notify"],
    ...overrides,
  };
}

function check(overrides: Partial<Check> = {}): Check {
  return {
    enabled: true,
    built: true,
    since: DAY - 3 * 86_400_000,
    until: DAY + 3_600_000,
    signals: [{ entity_id: "alarm_control_panel.house", name: "House alarm", state: "armed_away", changes: 12 }],
    marks: [mark(), mark({ kind: "vehicle", start: DAY + 600_000, cameras: ["Yard"], camera: "cam-yard" })],
    unmarked: [],
    automations: [
      {
        entity_id: "automation.notify",
        name: "Notify unusual",
        how: "the event",
        on: true,
        last_triggered: new Date(DAY + 600_000).toISOString(),
      },
    ],
    prompt_s: 2,
    ...overrides,
  };
}

const marks = (lines: ReturnType<typeof learningCheckLines>) => lines.map((l) => [l.ok, l.text]);

describe("the learning check's lines", () => {
  it("passes when each mark fired once, at its start, and the automation ran on each", () => {
    const lines = learningCheckLines(check(), ZONE, NAMES);
    expect(marks(lines)).toEqual([
      [true, "Learning is on, and it has learned from the journal."],
      [true, "House-wide signal House alarm: armed_away now, 12 changes learned with"],
      [true, "2 marks since Oct 31, 2026, 10:00: 2 of 2 fired its event once"],
      [true, "2 of 2 fired within 2 s of the detection's start"],
      [true, "No event fired that is not marked"],
      [true, "Automation Notify unusual (by the event): ran on 2 of 2 events fired; last ran Nov 3, 2026, 09:10"],
    ]);
    expect(learningCheckReport(lines, DAY + 3_600_000, ZONE).split("\n").slice(0, 3)).toEqual([
      "Reolink Viewer learning check · Nov 3, 2026, 10:00",
      "Everything checked is as it should be.",
      "✓ Learning is on, and it has learned from the journal.",
    ]);
  });

  it("says what the nightly relearn judged again as a note, not a fault (v0.63.13: the owner's 3 fired for no mark)", () => {
    const built = DAY + 3_000_000;
    const vehicle = mark({
      kind: "vehicle",
      start: DAY + 600_000,
      camera: "cam-yard",
      cameras: ["Yard"],
      fired: 0,
      delay: null,
      when: null,
      automations: [],
    });
    const lines = learningCheckLines(
      check({
        built_at: built,
        // Marked by the relearn; before it, no alert fired for it.
        marks: [mark(), vehicle],
        unmarked: [
          // Fired before the relearn, and not marked since.
          { camera: "cam-drive", kind: "person", start: DAY - 3_600_000, delay: 0.6, relearned: true },
          { camera: "cam-yard", kind: "animal", start: DAY + 120_000, delay: 0.4, relearned: true },
        ],
      }),
      ZONE,
      NAMES,
    );
    expect(marks(lines)).toEqual([
      [true, "Learning is on, and it has learned from the journal."],
      [true, "House-wide signal House alarm: armed_away now, 12 changes learned with"],
      [true, "2 marks since Oct 31, 2026, 10:00: 1 of 2 fired its event once"],
      [true, "1 of 1 fired within 2 s of the detection's start"],
      [true, "No event fired that is not marked"],
      [
        undefined,
        "2 events fired before the last nightly relearn, and not marked since: the relearn judged them again with what it had learned since (expected now and then)",
      ],
      [true, "Automation Notify unusual (by the event): ran on 1 of 1 event fired; last ran Nov 3, 2026, 09:10"],
    ]);
    expect(lines[2]?.details).toEqual(["not fired, marked since by the nightly relearn: Nov 3, 2026, 09:10, vehicle on Yard"]);
    expect(lines[5]?.details).toEqual(["Nov 3, 2026, 08:00, person on Drive", "Nov 3, 2026, 09:02, animal on Yard"]);
    // One fired after the relearn and not marked: that is still a fault.
    const after = learningCheckLines(
      check({ built_at: built, unmarked: [{ camera: "cam-yard", kind: "animal", start: built + 60_000, delay: 0.5, relearned: false }] }),
      ZONE,
      NAMES,
    );
    expect(marks(after)).toContainEqual([false, "1 event fired for no mark"]);
  });

  it("counts a mark kept quiet within its camera's visit as right (v0.63.14: one alert per visit)", () => {
    const quiet = mark({ start: DAY + 300_000, fired: 0, quiet: 1, delay: null, when: null, automations: [] });
    const lines = learningCheckLines(check({ marks: [mark(), quiet] }), ZONE, NAMES);
    expect(marks(lines)).toContainEqual([true, "2 marks since Oct 31, 2026, 10:00: 1 of 2 fired its event once"]);
    expect(lines[2]?.details).toEqual([
      "kept quiet, its camera's visit had fired already (one alert per visit): Nov 3, 2026, 09:05, person on Drive",
    ]);
  });

  it("says each thing to look at: not fired, twice, late, unmarked, a signal gone, an automation that did not run", () => {
    const lines = learningCheckLines(
      check({
        signals: [{ entity_id: "lock.gate", name: "Gate", state: "unavailable", changes: 0 }],
        marks: [
          mark({ fired: 0, delay: null, when: null, automations: [] }),
          mark({ start: DAY + 60_000, fired: 2 }),
          mark({ start: DAY + 120_000, delay: 31, when: "late", automations: [] }),
          mark({ start: DAY + 180_000, delay: 600, when: "end" }),
        ],
        unmarked: [{ camera: "cam-yard", kind: "animal", start: DAY + 240_000, delay: 0.5 }],
      }),
      ZONE,
      NAMES,
    );
    const report = learningCheckReport(lines, DAY, ZONE);
    expect(report).toContain("5 things to look at.");
    expect(report).toContain("✗ House-wide signal Gate: unavailable now, 0 changes learned with");
    expect(report).toContain("✗ 4 marks since Oct 31, 2026, 10:00: 2 of 4 fired its event once");
    expect(report).toContain("    not fired: Nov 3, 2026, 09:00, person on Drive");
    expect(report).toContain("    fired 2 times: Nov 3, 2026, 09:01, person on Drive");
    expect(report).toContain(
      "✗ 1 of 3 fired within 2 s of the detection's start, 1 at its end (it stood out by its length)",
    );
    expect(report).toContain("    late, after 31 s: Nov 3, 2026, 09:02, person on Drive");
    expect(report).toContain("✗ 1 event fired for no mark");
    expect(report).toContain("    Nov 3, 2026, 09:04, animal on Yard");
    expect(report).toContain("✗ Automation Notify unusual (by the event): ran on 2 of 3 events fired");
  });

  it("says when nothing listens, nothing is marked yet, or learning is off", () => {
    const quiet = learningCheckLines(check({ signals: [], marks: [], automations: [] }), ZONE, NAMES);
    expect(marks(quiet)).toEqual([
      [true, "Learning is on, and it has learned from the journal."],
      [undefined, "No house-wide signal is chosen (optional: Reolink Viewer's options → House-wide signals to learn with)."],
      [
        undefined,
        "No mark since Oct 31, 2026, 10:00: nothing to compare yet. Each mark from now on is compared with the event fired for it; open this again in a few days.",
      ],
      [
        false,
        "No automation listens for unusual activity, so nothing is notified: make the user guide's example (Settings → Automations & scenes, triggered by Reolink Viewer's Unusual activity).",
      ],
    ]);
    expect(marks(learningCheckLines({ enabled: false }, ZONE, NAMES))).toEqual([
      [false, "Learning is off: turn on Learn what is normal in Reolink Viewer's options."],
    ]);
  });
});

describe("the Learning card's check", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("runs the check on a press and shows each line marked", async () => {
    const status: JournalStatus = {
      enabled: true,
      created: DAY,
      imported: 0,
      changes: 10,
      detections: 5,
      sensors: 2,
      bytes: 1000,
      cameras: [{ id: "cam-drive", name: "Drive", changes: 10, detections: 5, first: DAY, last: DAY }],
    };
    const hass = {
      config: { time_zone: ZONE },
      callWS: vi.fn((message: { type: string }) =>
        Promise.resolve(message.type === "reolink_viewer/unusual/check" ? check() : status),
      ),
    } as unknown as HomeAssistant;
    const el = document.createElement("rv-learning");
    el.hass = hass;
    document.body.appendChild(el);
    for (let i = 0; i < 4; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await el.updateComplete;
    }
    const button = [...(el.shadowRoot?.querySelectorAll("button") ?? [])].find((b) => b.textContent.includes("Run the check"));
    expect(button).toBeDefined();
    button?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await el.updateComplete;
    const items = [...(el.shadowRoot?.querySelectorAll("ul.check > li") ?? [])];
    expect(items).toHaveLength(6);
    expect(items.every((li) => li.classList.contains("pass"))).toBe(true);
    expect(items[0]?.querySelector(".mark")?.getAttribute("aria-label")).toBe("passed");
    expect([...(el.shadowRoot?.querySelectorAll("button") ?? [])].some((b) => b.textContent.includes("Copy the report"))).toBe(
      true,
    );
  });
});

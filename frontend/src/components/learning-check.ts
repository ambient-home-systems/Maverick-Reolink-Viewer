// The learning check (Phase 8's hand checks, automated at the owner's ask):
// what the server's reolink_viewer/unusual/check says, as lines that pass or
// fail, and as a report to copy. Pure, for the Learning card and the tests.

import { formatStamp } from "../playback/time";
import type { UnusualCheck } from "../types";

/** A line of the check: passed (true), failed (false) or said only (undefined), with details. */
export interface CheckLine {
  ok?: boolean;
  text: string;
  details?: string[];
}

type Check = Extract<UnusualCheck, { enabled: true }>;

const plural = (n: number, noun: string) => `${n.toLocaleString("en-US")} ${noun}${n === 1 ? "" : "s"}`;
const kindText = (kind: string) => kind.replace(/_/g, " ");

/** The check's lines, in the order the owner's checklist had them. */
export function learningCheckLines(check: UnusualCheck, zone: string | undefined, names: ReadonlyMap<string, string>): CheckLine[] {
  if (!check.enabled) {
    return [{ ok: false, text: "Learning is off: turn on Learn what is normal in Reolink Viewer's options." }];
  }
  const when = (ms: number) => formatStamp(ms, zone);
  const camera = (id: string) => names.get(id) ?? id;
  const lines: CheckLine[] = [];
  lines.push(
    check.built
      ? { ok: true, text: "Learning is on, and it has learned from the journal." }
      : { text: "Learning is on; it has not learned yet (a minute or so after Home Assistant starts)." },
  );

  // The house-wide signals chosen: each there, and learned with.
  if (!check.signals.length) {
    lines.push({
      text: "No house-wide signal is chosen (optional: Reolink Viewer's options → House-wide signals to learn with).",
    });
  } else {
    for (const signal of check.signals) {
      const missing = signal.state === null || signal.state === "unavailable" || signal.state === "unknown";
      lines.push({
        ok: !missing && signal.changes > 0,
        text: `House-wide signal ${signal.name}: ${missing ? `${signal.state ?? "not found"} now` : `${signal.state} now`}, ${plural(signal.changes, "change")} learned with`,
      });
    }
  }

  // The marks since the log began, each fired once and at its start.
  const since = `since ${when(check.since)}`;
  const marks = check.marks;
  if (!marks.length) {
    lines.push({
      text: `No mark ${since}: nothing to compare yet. Each mark from now on is compared with the event fired for it; open this again in a few days.`,
    });
  } else {
    const once = marks.filter((m) => m.fired === 1);
    // A detection before the relearn the marks are scored with was judged, as it
    // happened, by the model before: it may not have fired (v0.63.13).
    const built = check.built_at ?? undefined;
    const notFired = marks.filter((m) => m.fired === 0 && (built === undefined || m.start >= built));
    const markedByRelearn = marks.filter((m) => m.fired === 0 && built !== undefined && m.start < built);
    const twice = marks.filter((m) => m.fired > 1);
    const describe = (m: Check["marks"][number]) =>
      `${when(m.start)}, ${kindText(m.kind)} on ${(m.cameras ?? []).join(", ") || camera(m.camera)}`;
    lines.push({
      ok: once.length + markedByRelearn.length === marks.length,
      text: `${plural(marks.length, "mark")} ${since}: ${String(once.length)} of ${String(marks.length)} fired its event once`,
      details: [
        ...notFired.map((m) => `not fired: ${describe(m)}`),
        ...twice.map((m) => `fired ${String(m.fired)} times: ${describe(m)}`),
        ...markedByRelearn.map((m) => `not fired, marked since by the nightly relearn: ${describe(m)}`),
      ],
    });
    const fired = marks.filter((m) => m.fired > 0);
    if (fired.length) {
      const atStart = fired.filter((m) => m.when === "start");
      const atEnd = fired.filter((m) => m.when === "end");
      const late = fired.filter((m) => m.when === "late");
      lines.push({
        ok: late.length === 0,
        text:
          `${String(atStart.length)} of ${String(fired.length)} fired within ${String(check.prompt_s)} s of the detection's start` +
          (atEnd.length ? `, ${String(atEnd.length)} at its end (it stood out by its length)` : ""),
        details: late.map((m) => `late, after ${String(m.delay ?? "?")} s: ${describe(m)}`),
      });
    }
  }
  // Fired before the relearn the marks are scored with: it judged them again
  // with what it learned since, so a few now and then are expected (v0.63.13).
  const unmarked = check.unmarked.filter((e) => !e.relearned);
  const relearned = check.unmarked.filter((e) => e.relearned);
  const firedText = (e: Check["unmarked"][number]) => `${when(e.start)}, ${kindText(e.kind)} on ${camera(e.camera)}`;
  if (unmarked.length) {
    lines.push({
      ok: false,
      text: `${plural(unmarked.length, "event")} fired for no mark`,
      details: unmarked.map(firedText),
    });
  } else if (marks.length) {
    lines.push({ ok: true, text: "No event fired that is not marked" });
  }
  if (relearned.length) {
    lines.push({
      text:
        `${plural(relearned.length, "event")} fired before the last nightly relearn, and not marked since: ` +
        "the relearn judged them again with what it had learned since (expected now and then)",
      details: relearned.map(firedText),
    });
  }

  // Who listens, and whether each ran on every event fired.
  if (!check.automations.length) {
    lines.push({
      ok: false,
      text: "No automation listens for unusual activity, so nothing is notified: make the user guide's example (Settings → Automations & scenes, triggered by Reolink Viewer's Unusual activity).",
    });
  } else {
    const events = marks.filter((m) => m.fired > 0);
    for (const automation of check.automations) {
      const ran = events.filter((m) => m.automations.includes(automation.entity_id)).length;
      lines.push({
        ok: automation.on && ran === events.length,
        text:
          `Automation ${automation.name} (by ${automation.how})${automation.on ? "" : ", turned off"}: ` +
          (events.length ? `ran on ${String(ran)} of ${plural(events.length, "event")} fired` : "no event fired yet to run on") +
          (automation.last_triggered ? `; last ran ${when(Date.parse(automation.last_triggered))}` : ""),
      });
    }
  }
  return lines;
}

/** The check as text, to paste: a heading, then each line with ✓ or ✗ and its details. */
export function learningCheckReport(lines: readonly CheckLine[], at: number, zone: string | undefined): string {
  const mark = (ok: boolean | undefined) => (ok === undefined ? "·" : ok ? "✓" : "✗");
  const failed = lines.filter((l) => l.ok === false).length;
  return [
    `Reolink Viewer learning check · ${formatStamp(at, zone)}`,
    failed ? `${plural(failed, "thing")} to look at.` : "Everything checked is as it should be.",
    ...lines.flatMap((l) => [`${mark(l.ok)} ${l.text}`, ...(l.details ?? []).map((d) => `    ${d}`)]),
  ].join("\n");
}

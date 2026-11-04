// Phase 8.3: the incidents marked unusual (unusual/marks), joined to the
// timetable's rows. The camera's own events are the rows; a mark's events (one
// per camera that saw its incident) are joined to them by camera and
// overlapping time, a little slack either side. An event of a marked incident
// that no row matches (a camera whose events cannot be searched, or one the
// search has not listed yet) becomes a row of its own, "seen only by the
// journal".
import type { RecentEvent, UnusualEvent, UnusualTerm } from "./types";

/** Either side of a journal event, for the camera's event to overlap it. */
export const SLACK_MS = 30_000;

/** The journal's kinds of thing, as the camera's event types. */
const KIND_TYPES: Record<string, string> = {
  person: "PERSON",
  vehicle: "VEHICLE",
  animal: "ANIMAL",
  doorbell: "DOORBELL",
  package: "PACKAGE",
  face: "FACE",
  crying: "CRYING",
  forgotten_item: "FORGOTTEN_ITEM",
  taken_item: "TAKEN_ITEM",
  motion: "MOTION",
};

/** The event type a journal kind is shown as (tamper and others: their own word). */
export function kindType(kind: string): string {
  return KIND_TYPES[kind] ?? kind.toUpperCase();
}

/** A row's key: its camera and start. */
export function rowKey(event: { camera_id: string; start: number }): string {
  return `${event.camera_id}:${String(event.start)}`;
}

export interface MarkedRows {
  /** The mark of each marked row, by `rowKey`. */
  marks: Map<string, UnusualEvent>;
  /** Rows of their own for a marked incident's events no row matched. */
  journal: RecentEvent[];
}

/**
 * Join marks to rows. Each mark's events (`members`) mark the rows of their
 * camera that overlap them (with SLACK_MS either side), those showing the mark's
 * kind first; one that matches none becomes a journal row, if it began in
 * [from, to).
 */
export function markRows(
  rows: readonly RecentEvent[],
  marks: readonly UnusualEvent[],
  from: number,
  to: number,
): MarkedRows {
  const byCamera = new Map<string, RecentEvent[]>();
  for (const row of rows)
    byCamera.set(row.camera_id, [...(byCamera.get(row.camera_id) ?? []), row]);
  const marked = new Map<string, UnusualEvent>();
  const journal: RecentEvent[] = [];
  for (const mark of marks) {
    const type = kindType(mark.kind);
    for (const member of mark.members ?? [
      { camera: mark.camera, start: mark.start, end: mark.end },
    ]) {
      const end = member.end ?? member.start;
      const near = (byCamera.get(member.camera) ?? []).filter(
        (row) =>
          row.start <= end + SLACK_MS && row.end >= member.start - SLACK_MS,
      );
      const same = near.filter((row) => row.types.includes(type));
      const chosen = same.length ? same : near;
      if (chosen.length) {
        for (const row of chosen) marked.set(rowKey(row), mark);
      } else if (member.start >= from && member.start < to) {
        const row: RecentEvent = {
          camera_id: member.camera,
          start: member.start,
          end: Math.max(end, member.start),
          types: [type],
          segment: null,
          new: false,
          journal: true,
        };
        journal.push(row);
        marked.set(rowKey(row), mark);
      }
    }
  }
  return { marks: marked, journal };
}

/** What each signal is called beside its bar. */
const TERM_NAMES: Record<string, string> = {
  kind: "What it was",
  clock: "Time of day",
  solar: "Light",
  duration: "How long",
  predecessor: "What came before",
  weekend: "Day",
};

export function termName(term: UnusualTerm): string {
  return term.name === "signal"
    ? term.subject || "Signal"
    : (TERM_NAMES[term.name] ?? term.name);
}

/** A term's value as read: a length's bucket ("~32s") spelled out. */
export function termValue(term: UnusualTerm): string {
  if (term.name !== "duration") return term.label;
  if (term.label === "open") return "Still going";
  if (term.label === "instant") return "An instant";
  const seconds = Number(term.label.replace(/^~/, "").replace(/s$/, ""));
  if (!Number.isFinite(seconds)) return term.label;
  if (seconds < 90) return `About ${String(seconds)} s`;
  const minutes = Math.round(seconds / 60);
  return minutes >= 2 ? `About ${String(minutes)} min` : "About a minute";
}

/** Below this, in nats, a signal says nothing either way. */
export const NEUTRAL = 0.05;

/** Which way a signal points, in words. */
export function termDirection(term: UnusualTerm): string {
  if (term.contribution > NEUTRAL) return "rarer than chance";
  if (term.contribution < -NEUTRAL) return "more usual";
  return "as by chance";
}

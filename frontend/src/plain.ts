// What a check found, in plain words: a grade anyone can read at a glance, a
// sentence, and what to do about it when anything. The checks put these at
// the top of their reports as "In short", so a report saved on one device and
// read on another still opens with them (parsed back by `parseInShort`).

export type Grade = "good" | "fine" | "slow" | "problem" | "note" | "pending";

export interface Finding {
  grade: Grade;
  /** What was found, in a sentence. */
  text: string;
  /** What to do about it. */
  advice?: string;
}

/** The plain-language summary of a check: a headline, then its findings. */
export interface InShort {
  headline: string;
  findings: Finding[];
}

export const GRADE_WORD: Record<Grade, string> = {
  good: "Good",
  fine: "Fine",
  slow: "Slow",
  problem: "Problem",
  note: "Note",
  pending: "Not yet",
};

/** What each word means, for the key under a summary. */
export const GRADE_MEANING: Record<Grade, string> = {
  good: "as it should be",
  fine: "a little slower, nothing to do",
  slow: "works, but worth a look",
  problem: "something is wrong",
  note: "for your information",
  pending: "still to come",
};

const ADVICE = " What to do: ";

/** "under 0.1 s", "0.4 s", "1.8 s", "12 s". */
export function secondsText(ms: number): string {
  if (ms < 100) return "under 0.1 s";
  const s = ms / 1000;
  return s < 10 ? `${s.toFixed(1)} s` : `${String(Math.round(s))} s`;
}

/** How a wait felt: good under `good` ms, fine under `fine`, slow after; none: a problem. */
export function speed(ms: number | undefined, good: number, fine: number): Grade {
  if (ms === undefined) return "problem";
  return ms < good ? "good" : ms < fine ? "fine" : "slow";
}

/** The worst of some grades (a problem before slow before fine before good). */
export function worst(grades: readonly Grade[]): Grade {
  const order: Grade[] = ["problem", "slow", "fine", "good", "pending", "note"];
  return order.find((g) => grades.includes(g)) ?? "note";
}

/** The middle value (the lower of the two middles). */
export function middle(values: readonly number[]): number | undefined {
  if (!values.length) return undefined;
  return [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) / 2)];
}

/** "1 camera", "3 cameras". */
export function count(n: number, one: string, many = `${one}s`): string {
  return `${String(n)} ${n === 1 ? one : many}`;
}

/** The report text's "In short" block. */
export function inShortLines(summary: InShort): string[] {
  return [
    `In short: ${summary.headline}`,
    ...summary.findings.map((f) => `- ${GRADE_WORD[f.grade]}: ${f.text}${f.advice ? `${ADVICE}${f.advice}` : ""}`),
  ];
}

/** The "In short" block of a report's text, if it has one. */
export function parseInShort(text: string): InShort | undefined {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => line.startsWith("In short: "));
  if (start < 0) return undefined;
  const words = new Map(Object.entries(GRADE_WORD).map(([grade, word]) => [word, grade as Grade]));
  const findings: Finding[] = [];
  for (const line of lines.slice(start + 1)) {
    const match = /^- (Good|Fine|Slow|Problem|Note|Not yet): (.*)$/.exec(line);
    if (!match) break;
    const [, word, rest] = match;
    const [text = "", advice] = rest.split(ADVICE);
    findings.push({ grade: words.get(word) ?? "note", text, ...(advice ? { advice } : {}) });
  }
  return { headline: lines[start]?.slice("In short: ".length) ?? "", findings };
}

// The "Dashboard cards" report (Phase 7 step 2): what the cards on each device
// saw (live/card_log, sent by card/tablet.ts), summed up and as text. It
// answers what a wall tablet needs: does video stop while the screen is off or
// a screensaver shows, and how soon is it back when the screen comes on.
import { formatClock, formatDay } from "../playback/time";
import type { CardLogDevice, TabletEvent } from "../types";

/** What wakes the cards: the page shown, Fully Kiosk's screen on, its screensaver gone, a load. */
const WAKES = new Set(["visible", "screen on", "screensaver off", "page loaded", "page show", "resumed"]);
const SLEEPS = new Set(["screen off", "screensaver on"]);
/** A card back later than this after a wake is not counted as back from it. */
export const BACK_WITHIN_MS = 10 * 60_000;
const FRAMES = /^(\d+) frames; (visible|hidden)(; asleep)?/;

export interface CardLogSummary {
  /** Fully Kiosk's JavaScript interface, as the last page load said (undefined: no load seen). */
  fully: boolean | undefined;
  /** Fully Kiosk's screen off or screensaver on. */
  asleep: number;
  hidden: number;
  /** Seconds from each wake to each card playing again. */
  back: number[];
  /** Cards that started after a wake and were not playing by the next one. */
  notBack: number;
  /** Frames decoded while the page was hidden or Fully asleep, and by which cards. */
  unseenFrames: number;
  unseenCards: string[];
  rings: number;
  /** Failed starts, per card. */
  retries: Record<string, number>;
}

export function summarize(events: readonly TabletEvent[]): CardLogSummary {
  const summary: CardLogSummary = {
    fully: undefined,
    asleep: 0,
    hidden: 0,
    back: [],
    notBack: 0,
    unseenFrames: 0,
    unseenCards: [],
    rings: 0,
    retries: {},
  };
  const cards = new Set<string>();
  // Per card, the wake it has yet to come back from, and whether it started since.
  const pending = new Map<string, { at: number; started: boolean }>();
  let lastWake: number | undefined;
  const settle = () => {
    for (const wait of pending.values()) if (wait.started) summary.notBack += 1;
    pending.clear();
  };
  for (const event of events) {
    const card = event.card;
    if (event.what === "page loaded") summary.fully = event.detail?.includes("interface on") ?? false;
    if (SLEEPS.has(event.what)) summary.asleep += 1;
    if (event.what === "hidden") summary.hidden += 1;
    if (event.what === "ring") summary.rings += 1;
    if (WAKES.has(event.what)) {
      settle();
      lastWake = event.at;
      for (const name of cards) pending.set(name, { at: event.at, started: false });
    }
    if (!card) continue;
    if (!cards.has(card)) {
      cards.add(card);
      // A card first seen after a wake (a page load) comes back from it too.
      if (lastWake !== undefined) pending.set(card, { at: lastWake, started: false });
    }
    const wait = pending.get(card);
    if (event.what === "starting" || event.what === "retrying") {
      if (wait) wait.started = true;
      if (event.what === "retrying") summary.retries[card] = (summary.retries[card] ?? 0) + 1;
    } else if (event.what === "playing" && wait) {
      pending.delete(card);
      if (event.at - wait.at <= BACK_WITHIN_MS) summary.back.push((event.at - wait.at) / 1000);
    } else if (event.what === "frames") {
      const match = FRAMES.exec(event.detail ?? "");
      if (match && (match[2] === "hidden" || match[3])) {
        const frames = Number(match[1]);
        if (frames > 0) {
          summary.unseenFrames += frames;
          if (!summary.unseenCards.includes(card)) summary.unseenCards.push(card);
        }
      }
    }
  }
  settle();
  return summary;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? (sorted[mid] ?? 0) : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

const times = (n: number) => `${String(n)} ${n === 1 ? "time" : "times"}`;

/** The summary in plain lines. */
export function summaryLines(summary: CardLogSummary): string[] {
  const lines = [
    `Fully Kiosk's JavaScript interface: ${summary.fully === undefined ? "not seen" : summary.fully ? "on" : "off"}`,
    `Screen off or screensaver (Fully Kiosk): ${times(summary.asleep)} · page hidden: ${times(summary.hidden)}`,
  ];
  if (summary.back.length) {
    lines.push(
      `Video back after the screen came on or the page was shown: median ${median(summary.back).toFixed(1)} s, slowest ${Math.max(...summary.back).toFixed(1)} s (${times(summary.back.length)})`,
    );
  } else {
    lines.push("Video back after the screen came on or the page was shown: not seen yet");
  }
  if (summary.notBack) lines.push(`Started but not playing again before the next wake: ${times(summary.notBack)}`);
  lines.push(
    summary.unseenFrames
      ? `Video decoded while nobody could see it: ${summary.unseenFrames.toLocaleString("en-US")} frames (${summary.unseenCards.join(", ")})`
      : "Video decoded while nobody could see it: none",
  );
  lines.push(`Doorbell rings: ${String(summary.rings)}`);
  const retries = Object.entries(summary.retries);
  lines.push(
    `Failed starts: ${retries.length ? retries.map(([card, n]) => `${card} ${String(n)}`).join(", ") : "none"}`,
  );
  return lines;
}

/** A device's events as lines, with the day where it changes. */
export function eventLines(events: readonly TabletEvent[], zone?: string): string[] {
  const lines: string[] = [];
  let day = "";
  for (const event of events) {
    const today = formatDay(event.at, zone);
    if (today !== day) {
      day = today;
      lines.push(today);
    }
    const who = (event.card ?? "page").padEnd(18);
    const what = event.what.padEnd(16);
    lines.push(`${formatClock(event.at, zone, true)}  ${who} ${what} ${event.detail ?? ""}`.trimEnd());
  }
  return lines;
}

/** The whole report, as text to copy. */
export function cardReport(devices: readonly CardLogDevice[], version: string, zone?: string): string {
  const lines = [`Reolink Viewer dashboard cards report v${version}`];
  if (!devices.length) lines.push("", "No dashboard card has reported yet.");
  for (const device of devices) {
    lines.push("", `${device.device} · last heard from ${device.updated}`);
    lines.push(...summaryLines(summarize(device.events)));
    lines.push("", ...eventLines(device.events, zone));
  }
  return lines.join("\n");
}

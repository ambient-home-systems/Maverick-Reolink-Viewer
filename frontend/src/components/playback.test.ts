import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeHass, okDevices, type FakeHass } from "../test-fixtures";
import type { PlaybackUrl, TimelineDay } from "../types";
import { playsProgressive } from "../playback/codec";
import "./playback";
import { TOAST_EVENT } from "./navigation";
import { STALE_TODAY_S, describeCache, type RvPlayback } from "./playback";

const T0 = Date.UTC(2026, 9, 17, 4, 0); // midnight EDT, 17 Oct 2026
const MIN = 60_000;
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function makeDay(overrides: Partial<TimelineDay> = {}): TimelineDay {
  return {
    date: "2026-10-17",
    start: T0,
    end: T0 + 24 * 60 * MIN,
    now: T0 + 12 * 60 * MIN,
    segments: [
      { id: "s1", start: T0 + 60 * MIN, end: T0 + 62 * MIN, triggers: ["PERSON"], ambiguous: false },
      { id: "s2", start: T0 + 62 * MIN, end: T0 + 64 * MIN, triggers: ["MOTION"], ambiguous: false },
    ],
    events: [
      { start: T0 + 60 * MIN + 10_000, end: T0 + 61 * MIN, types: ["MOTION", "PERSON"], segment: "s1", ambiguous: false },
      { start: T0 + 63 * MIN, end: T0 + 63 * MIN + 20_000, types: ["ANIMAL"], segment: "s2", ambiguous: false },
    ],
    complete: false,
    events_error: null,
    hint_source: null,
    timing: { cache: "fresh", search_ms: 900 },
    ...overrides,
  };
}

function playbackUrl(segmentId: string, start: number): PlaybackUrl {
  return {
    url: `/api/reolink_viewer/vod/${segmentId}?authSig=x`,
    clip_url: `/api/reolink_viewer/clip/${segmentId}?authSig=y`,
    stream: "sub",
    segment_id: segmentId,
    start,
    end: start + 2 * MIN,
    media: { codec: "avc1.640033", width: 640, height: 360, audio: "mp4a.40.2" },
    cache: { complete: false, bytes: 1000, error: null },
    expires_in: 1800,
    timing: { total_ms: 40 },
  };
}

function playbackHass(day: TimelineDay = makeDay()): FakeHass {
  const hass = makeHass(okDevices());
  hass.config = { time_zone: "America/New_York" };
  const answers: Partial<Record<string, (msg: Record<string, unknown>) => unknown>> = {
    "reolink_viewer/timeline/day": () => day,
    "reolink_viewer/timeline/days": () => ({ days: [16, 17], timing: {} }),
    "reolink_viewer/playback/media_info": () => ({
      main: { codec: "hvc1.1.6.L153.B0", width: 7680, height: 2160, audio: null },
      sub: null,
    }),
    "reolink_viewer/playback/url": (msg) => {
      const seg = day.segments.find((s) => s.id === msg.segment_id);
      return playbackUrl(String(msg.segment_id), seg?.start ?? 0);
    },
    "reolink_viewer/playback/prefetch": () => ({ cache: { complete: false } }),
    "reolink_viewer/thumbnail/urls": (msg) => ({
      urls: (msg.times as number[]).map((t) => ({ time: t, bucket: t, url: `/thumb/${t}` })),
    }),
  };
  hass.callWS = <T,>(message: Record<string, unknown>) => {
    hass.sent.push(message);
    const answer = answers[String(message.type)];
    return Promise.resolve((answer ? answer(message) : hass.responses[String(message.type)]) as T);
  };
  return hass;
}

async function mount(hass: FakeHass): Promise<RvPlayback> {
  const el = document.createElement("rv-playback");
  el.hass = hass;
  el.deviceId = "dev-cam";
  el.cameraName = "Front Yard";
  document.body.appendChild(el);
  for (let i = 0; i < 4; i += 1) await flush();
  await el.updateComplete;
  return el;
}

const sentOf = (hass: FakeHass, type: string) => hass.sent.filter((m) => m.type === type);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(T0 + 12 * 60 * MIN));
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("rv-playback", () => {
  it("loads today's timeline, the month and HD capability", async () => {
    const hass = playbackHass();
    const el = await mount(hass);
    expect(sentOf(hass, "reolink_viewer/timeline/day")[0]).toMatchObject({ device_id: "dev-cam", date: "2026-10-17" });
    expect(sentOf(hass, "reolink_viewer/timeline/days")[0]).toMatchObject({ year: 2026, month: 10 });
    expect(el._day?.segments).toHaveLength(2);
    // The cursor starts on the latest event.
    expect(el._cursor).toBe(T0 + 63 * MIN);
    expect(el._metrics.timelineMs).toBeGreaterThanOrEqual(0);
    expect(el._metrics.timelineServer?.cache).toBe("fresh");
    // happy-dom has no MediaCapabilities: HD stays off, with the reason shown.
    expect(el._hd.main).toBe(false);
    const hd = [...el.renderRoot.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent.trim() === "HD");
    expect(hd?.disabled).toBe(true);
    expect(hd?.title).toMatch(/cannot report/);
    expect(el.renderRoot.querySelector("rv-calendar")?.days.has(17)).toBe(true);
    expect(el.renderRoot.textContent).toContain("Debug");
  });

  it("plays an event, preloads the next recording and moves on", async () => {
    const hass = playbackHass();
    const el = await mount(hass);
    const event = el._day?.events[0];
    if (!event) throw new Error("no event");
    await el.playAt(event.start);
    await flush();
    const urls = sentOf(hass, "reolink_viewer/playback/url");
    expect(urls[0]).toMatchObject({
      segment_id: "s1",
      stream: "sub",
      progressive: playsProgressive(),
      date: "2026-10-17",
    });
    // The next recording is preloaded.
    expect(urls[1]).toMatchObject({ segment_id: "s2" });
    const player = el.renderRoot.querySelector("rv-player");
    expect(player?.current?.segmentId).toBe("s1");
    expect(player?.preloaded?.segmentId).toBe("s2");
    const videos = player?.renderRoot.querySelectorAll("video");
    expect(videos?.[0]?.getAttribute("src")).toContain("/vod/s1");
    expect(el._metrics.urlMs).toBeGreaterThanOrEqual(0);
    const clip = el.renderRoot.querySelector<HTMLAnchorElement>("a[download]");
    expect(clip?.getAttribute("href")).toContain("/clip/s1");

    // First frame on screen, then the end of the file: swap to s2.
    videos?.[0]?.dispatchEvent(new Event("playing"));
    expect(el._metrics.firstFrameMs).toBeGreaterThanOrEqual(0);
    videos?.[0]?.dispatchEvent(new Event("ended"));
    videos?.[1]?.dispatchEvent(new Event("playing"));
    await flush();
    expect(el._metrics.gapMs).toBeGreaterThanOrEqual(0);
    expect(el._cursor).toBe(T0 + 62 * MIN);
    // s2 is the last recording: nothing more to preload.
    expect(sentOf(hass, "reolink_viewer/playback/url")).toHaveLength(2);
  });

  it("steps between events, filters types and toasts when nothing is left", async () => {
    const hass = playbackHass();
    const el = await mount(hass);
    const toasts: string[] = [];
    el.addEventListener(TOAST_EVENT, (e) => toasts.push((e as CustomEvent<{ message: string }>).detail.message));
    const button = (label: string) =>
      el.renderRoot.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
    button("Previous event")?.click();
    await flush();
    expect(el._cursor).toBe(T0 + 60 * MIN + 10_000);
    button("Previous event")?.click();
    expect(toasts).toContain("No earlier event");
    button("Next event")?.click();
    await flush();
    expect(el._cursor).toBe(T0 + 63 * MIN);

    const chips = [...el.renderRoot.querySelectorAll<HTMLButtonElement>("button.chip")];
    expect(chips.map((c) => c.textContent.replace(/\s+/g, " ").trim())).toEqual([
      "Person 1",
      "Animal 1",
      "Motion 1",
    ]);
    chips[1]?.click();
    await el.updateComplete;
    expect(el._hidden.has("ANIMAL")).toBe(true);
    expect(el.renderRoot.querySelector("rv-event-list")?.events).toHaveLength(1);
    chips[1]?.click();
    expect(el._hidden.size).toBe(0);

    await el.playAt(T0 + 20 * 60 * MIN);
    expect(toasts).toContain("No recording after this time on this day");
  });

  it("warms long recordings, changes days and asks for thumbnails", async () => {
    const long = makeDay({
      segments: [{ id: "h", start: T0 + 60 * MIN, end: T0 + 120 * MIN, triggers: [], ambiguous: false }],
      events: [],
    });
    const hass = playbackHass(long);
    const el = await mount(hass);
    expect(sentOf(hass, "reolink_viewer/playback/prefetch")[0]).toMatchObject({ segment_id: "h" });
    expect(el.renderRoot.querySelector<HTMLButtonElement>('button[aria-label="Next day"]')?.disabled).toBe(true);

    el.renderRoot.querySelector<HTMLButtonElement>('button[aria-label="Previous day"]')?.click();
    await flush();
    expect(sentOf(hass, "reolink_viewer/timeline/day").at(-1)).toMatchObject({ date: "2026-10-16" });

    const timeline = el.renderRoot.querySelector("rv-timeline");
    timeline?.dispatchEvent(
      new CustomEvent("rv-hover", { detail: { time: T0 + 90 * MIN, x: 300 }, bubbles: true, composed: true }),
    );
    await flush();
    expect(sentOf(hass, "reolink_viewer/thumbnail/urls").at(-1)).toMatchObject({ bucket: 300 });
    expect(el._hover?.url).toBe(`/thumb/${T0 + 90 * MIN}`);
    timeline?.dispatchEvent(new CustomEvent("rv-hover-end", { bubbles: true, composed: true }));
    expect(el._hover).toBeUndefined();
    // Over a gap: just the time, no thumbnail request.
    const asked = sentOf(hass, "reolink_viewer/thumbnail/urls").length;
    timeline?.dispatchEvent(
      new CustomEvent("rv-hover", { detail: { time: T0 + 300 * MIN, x: 300 }, bubbles: true, composed: true }),
    );
    await el.updateComplete;
    expect(el._hover?.gap).toBe(true);
    expect(el.renderRoot.querySelector(".hover")?.textContent).toContain("no recording");
    expect(sentOf(hass, "reolink_viewer/thumbnail/urls")).toHaveLength(asked);

    const list = el.renderRoot.querySelector("rv-event-list");
    list?.dispatchEvent(
      new CustomEvent("rv-thumbs-needed", { detail: { times: [1, 2] }, bubbles: true, composed: true }),
    );
    await flush();
    expect(sentOf(hass, "reolink_viewer/thumbnail/urls").at(-1)).toMatchObject({ times: [1, 2], bucket: 10 });
    expect(el._thumbs.get(2)).toBe("/thumb/2");

    const calendar = el.renderRoot.querySelector("rv-calendar");
    calendar?.dispatchEvent(
      new CustomEvent("rv-day", { detail: { date: "2026-09-30" }, bubbles: true, composed: true }),
    );
    await flush();
    expect(sentOf(hass, "reolink_viewer/timeline/days").at(-1)).toMatchObject({ month: 9 });
  });

  it("falls back from HD to SD when the main stream fails", async () => {
    const hass = playbackHass();
    const el = await mount(hass);
    el._stream = "main";
    el._cursor = T0 + 61 * MIN;
    el.renderRoot
      .querySelector("rv-player")
      ?.dispatchEvent(
        new CustomEvent("rv-player-error", { detail: { message: "decode" }, bubbles: true, composed: true }),
      );
    await flush();
    expect(el._stream).toBe("sub");
    // Replayed on the sub stream (then the next recording is preloaded).
    expect(sentOf(hass, "reolink_viewer/playback/url")[0]).toMatchObject({ stream: "sub", segment_id: "s1" });
  });

  it("keeps a sub stream failure on screen until the next play", async () => {
    const hass = playbackHass();
    const el = await mount(hass);
    el.renderRoot
      .querySelector("rv-player")
      ?.dispatchEvent(
        new CustomEvent("rv-player-error", { detail: { message: "no supported streams" }, bubbles: true, composed: true }),
      );
    await el.updateComplete;
    expect(el.renderRoot.textContent).toContain("Playback failed: no supported streams");
    await el.playAt(T0 + 61 * MIN);
    await el.updateComplete;
    expect(el._playFailure).toBeUndefined();
  });

  it("shows a recent copy of today at once, then refreshes it", async () => {
    const hass = playbackHass(makeDay({ timing: { cache: "stale", age_s: 300 } }));
    const el = await mount(hass);
    const days = sentOf(hass, "reolink_viewer/timeline/day");
    expect(days[0]).toMatchObject({ date: "2026-10-17", max_age: STALE_TODAY_S });
    // The refresh asks for the current copy (no max_age).
    expect(days).toHaveLength(2);
    expect(days[1]).not.toHaveProperty("max_age");
    expect(el._metrics.timelineServer?.cache).toBe("stale");
    expect(el._loading).toBe(false);
  });

  it("describes the cache state", () => {
    expect(describeCache({ complete: true, bytes: 12_345_678, error: null })).toBe("cached (12.3 MB)");
    expect(describeCache({ complete: false, bytes: 500_000, error: null })).toBe("filling (0.5 MB so far)");
    expect(describeCache({ complete: false, bytes: 0, error: "HTTP 500" })).toBe("failed: HTTP 500");
  });

  it("shows load errors", async () => {
    const hass = playbackHass();
    const base = hass.callWS.bind(hass);
    hass.callWS = <T,>(message: Record<string, unknown>) =>
      message.type === "reolink_viewer/timeline/day"
        ? // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
          Promise.reject({ code: "search_failed", message: "day search failed" })
        : base<T>(message);
    const el = await mount(hass);
    expect(el.renderRoot.textContent).toContain("Could not load recordings: day search failed");
  });
});

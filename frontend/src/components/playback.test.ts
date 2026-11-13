import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fakePip, makeHass, okDevices, type FakeHass } from "../test-fixtures";
import type { PlaybackUrl, TimelineDay } from "../types";
import { playsProgressive } from "../playback/codec";
import { PlaybackCheck, type CheckTarget } from "../playback/check";
import { FILTERS_KEY, loadFilters } from "../playback/event-filters";
import type { ScrubPicture, SocketLike } from "../playback/scrub-client";
import type { KeyFramePainter } from "../playback/scrub-paint";
import { ThumbLoader } from "../playback/thumb-loader";
import "./playback";
import { TOAST_EVENT } from "./navigation";
import {
  EVENTS_RETRIES,
  EVENTS_RETRY_MS,
  STALE_TODAY_S,
  SCRUB_HOLD_MS,
  clipSize,
  deliveryOf,
  describeCache,
  describeScrub,
  videoCodec,
  type RvPlayback,
} from "./playback";

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

/** happy-dom never loads images: these load as soon as they get a URL. */
const instantImage = () => {
  const image = {
    onload: null as (() => void) | null,
    onerror: null as (() => void) | null,
    set src(value: string) {
      if (value) queueMicrotask(() => image.onload?.());
    },
  };
  return image;
};

async function mount(hass: FakeHass, at?: number): Promise<RvPlayback> {
  const el = document.createElement("rv-playback");
  el.thumbLoader = new ThumbLoader(2, instantImage);
  el.at = at;
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
  vi.restoreAllMocks();
  // Each camera's filters are kept between visits: not between tests.
  window.localStorage.removeItem(FILTERS_KEY);
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
    expect(el.renderRoot.textContent).toContain("Details and playback check");
  });

  it("in HD, keeps the timeline's recordings though HD copies start apart from them", async () => {
    const day = makeDay();
    day.segments.push({ id: "s3", start: T0 + 64 * MIN, end: T0 + 66 * MIN, triggers: ["MOTION"], ambiguous: false });
    const hass = playbackHass(day);
    const base = hass.callWS.bind(hass);
    hass.callWS = <T,>(message: Record<string, unknown>) => {
      if (message.type === "reolink_viewer/playback/url" && message.stream === "main") {
        hass.sent.push(message);
        // The server names the HD copy by its own start, 1.5 s after the SD one.
        const seg = day.segments.find((s) => s.id === message.segment_id);
        const start = (seg?.start ?? 0) + 1500;
        return Promise.resolve({ ...playbackUrl(String(start), start), stream: "main" } as T);
      }
      return base<T>(message);
    };
    const el = await mount(hass);
    el._stream = "main";
    await el.playAt(T0 + 60 * MIN + 10_000);
    await flush();
    const player = el.renderRoot.querySelector("rv-player");
    expect(player?.current?.segmentId).toBe("s1");
    expect(player?.preloaded?.segmentId).toBe("s2");
    // It moves on to s2, then preloads s3: it still knows where it is.
    const videos = player?.renderRoot.querySelectorAll("video");
    videos?.[0]?.dispatchEvent(new Event("playing"));
    videos?.[0]?.dispatchEvent(new Event("ended"));
    videos?.[1]?.dispatchEvent(new Event("playing"));
    for (let i = 0; i < 4; i += 1) await flush();
    expect(el._cursor).toBe(T0 + 62 * MIN);
    const urls = sentOf(hass, "reolink_viewer/playback/url").map((m) => m.segment_id);
    expect(urls).toEqual(["s1", "s2", "s3"]);
  });

  it("opens on the day of a time it is given, and plays from it (an event from the timetable)", async () => {
    const hass = playbackHass();
    const at = T0 + 63 * MIN;
    const el = await mount(hass, at);
    for (let i = 0; i < 4; i += 1) await flush();
    expect(el._cursor).toBe(at);
    expect(sentOf(hass, "reolink_viewer/playback/url")[0]).toMatchObject({ segment_id: "s2", at });
    // Given another day: that day is loaded.
    el.at = T0 - 12 * 60 * MIN;
    await el.updateComplete;
    await flush();
    expect(sentOf(hass, "reolink_viewer/timeline/day").at(-1)).toMatchObject({ date: "2026-10-16" });
    expect(el._date).toBe("2026-10-16");
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
    // Where it starts goes along (a copy of a growing recording may not reach it).
    expect(urls[0]?.at).toBe(event.start);
    // The next recording is preloaded, from its start.
    expect(urls[1]).toMatchObject({ segment_id: "s2", at: T0 + 62 * MIN });
    const player = el.renderRoot.querySelector("rv-player");
    expect(player?.current?.segmentId).toBe("s1");
    expect(player?.preloaded?.segmentId).toBe("s2");
    const videos = player?.renderRoot.querySelectorAll("video");
    expect(videos?.[0]?.getAttribute("src")).toContain("/vod/s1");
    expect(el._metrics.urlMs).toBeGreaterThanOrEqual(0);
    const clip = el.renderRoot.querySelector<HTMLAnchorElement>("a[download]");
    expect(clip?.getAttribute("href")).toContain("/clip/s1");
    // No picture-in-picture in this browser: no button for it.
    expect(el.renderRoot.querySelector("button.pip")).toBeNull();

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

  it("says a saved clip's size as a person reads it", () => {
    expect(clipSize(2_400_000)).toBe("2.4 MB");
    expect(clipSize(830_000)).toBe("830 KB");
    expect(clipSize(12)).toBe("1 KB");
  });

  describe("filters that start useful (Phase 11 step 3)", () => {
    /** A camera recording all the time: an hour's recording, mostly motion. */
    function continuousDay(): TimelineDay {
      const at = (minutes: number) => T0 + 60 * MIN + minutes * MIN;
      const motion = (minutes: number) => ({
        start: at(minutes),
        end: at(minutes) + 20_000,
        types: ["MOTION"],
        segment: "h1",
        ambiguous: false,
      });
      return makeDay({
        segments: [{ id: "h1", start: T0 + 60 * MIN, end: T0 + 120 * MIN, triggers: ["MOTION", "PERSON"], ambiguous: false }],
        events: [
          motion(1),
          motion(5),
          { start: at(10), end: at(11), types: ["MOTION", "PERSON"], segment: "h1", ambiguous: false },
          motion(20),
          motion(40),
          motion(55),
        ],
      });
    }
    const chip = (el: RvPlayback, text: string) =>
      [...el.renderRoot.querySelectorAll<HTMLButtonElement>(".chips button")].find((b) =>
        b.textContent.replace(/\s+/g, " ").includes(text),
      );
    const heading = (el: RvPlayback) =>
      el.renderRoot.querySelector(".events-head .muted")?.textContent.replace(/\s+/g, " ").trim();

    it("hide motion-only events at a continuously recording camera's first visit, until the chip brings them back", async () => {
      const el = await mount(playbackHass(continuousDay()));
      expect(el._hideMotion).toBe(true);
      expect(el.renderRoot.querySelector("rv-event-list")?.events.map((e) => e.types)).toEqual([["MOTION", "PERSON"]]);
      expect(el.renderRoot.querySelector("rv-timeline")?.events).toHaveLength(1);
      expect(heading(el)).toBe("1 of 6 events");
      // The play point starts on the latest event shown, not a hidden one.
      expect(el._cursor).toBe(T0 + 70 * MIN);
      // Motion has no chip of its own while hidden: this one brings them back.
      expect(chip(el, "Motion only 5")?.classList.contains("hidden-motion")).toBe(true);
      expect(chip(el, "Motion only")?.getAttribute("aria-label")).toBe("Show motion-only events: 5 hidden");
      expect([...el.renderRoot.querySelectorAll(".chips button.chip:not(.hidden-motion)")].map((b) => b.textContent.trim().split(/\s+/)[0])).toEqual(["Person"]);
      // Kept: the next visit starts so too.
      expect(loadFilters("dev-cam")).toEqual({ only: [], hideMotion: true });

      chip(el, "Motion only")?.click();
      await el.updateComplete;
      expect(el.renderRoot.querySelector("rv-event-list")?.events).toHaveLength(6);
      expect(heading(el)).toBe("6 events");
      expect(chip(el, "Motion only")).toBeUndefined();
      expect(chip(el, "Motion 5")).toBeDefined();
      expect(loadFilters("dev-cam")).toEqual({ only: [], hideMotion: false });
      // And hidden again.
      chip(el, "Hide motion only")?.click();
      await el.updateComplete;
      expect(el.renderRoot.querySelector("rv-event-list")?.events).toHaveLength(1);
      expect(loadFilters("dev-cam")?.hideMotion).toBe(true);
    });

    it("remembers each camera's filters, and leaves them as left", async () => {
      const first = await mount(playbackHass(continuousDay()));
      chip(first, "Motion only")?.click();
      await first.updateComplete;
      chip(first, "Person")?.click();
      await first.updateComplete;
      expect(loadFilters("dev-cam")).toEqual({ only: ["PERSON"], hideMotion: false });
      first.remove();

      // The next visit: as left, not decided again.
      const again = await mount(playbackHass(continuousDay()));
      expect(again._hideMotion).toBe(false);
      expect(chip(again, "Person")?.getAttribute("aria-pressed")).toBe("true");
      expect(heading(again)).toBe("1 of 6 events");
      chip(again, "Show every event")?.click();
      await again.updateComplete;
      expect(heading(again)).toBe("6 events");
      expect(loadFilters("dev-cam")).toEqual({ only: [], hideMotion: false });
    });

    it("shows every event at the first visit of a camera that records events only", async () => {
      const el = await mount(playbackHass());
      expect(el._hideMotion).toBe(false);
      expect(heading(el)).toBe("2 events");
      expect(chip(el, "Hide motion only")).toBeUndefined();
      expect(loadFilters("dev-cam")).toEqual({ only: [], hideMotion: false });
    });

    it("decides nothing on a day without recordings", async () => {
      const el = await mount(playbackHass(makeDay({ segments: [], events: [] })));
      expect(el._hideMotion).toBe(false);
      expect(loadFilters("dev-cam")).toBeUndefined();
    });
  });

  it("saves the event playing as an MP4, and keeps its link (Phase 11 step 2)", async () => {
    const hass = playbackHass();
    let answer: (clip: unknown) => void = () => undefined;
    let fail: (err: unknown) => void = () => undefined;
    const base = hass.callWS.bind(hass);
    hass.callWS = <T,>(message: Record<string, unknown>) => {
      if (message.type !== "reolink_viewer/playback/save_event") return base<T>(message);
      hass.sent.push(message);
      return new Promise<T>((resolve, reject) => {
        answer = resolve as (clip: unknown) => void;
        fail = reject;
      });
    };
    const el = await mount(hass);
    const toasts: string[] = [];
    el.addEventListener(TOAST_EVENT, (e) => toasts.push((e as CustomEvent<{ message: string }>).detail.message));
    const event = el._day?.events[0];
    if (!event) throw new Error("no event");
    const save = () => el.renderRoot.querySelector<HTMLButtonElement>("button.save");
    // Nothing playing: nothing to save.
    expect(save()).toBeNull();
    await el.playAt(event.start + 5_000);
    await el.updateComplete;
    expect(save()?.textContent.trim()).toBe("Save event");
    // The whole recording is still there, named for what it is.
    const recording = el.renderRoot.querySelector<HTMLAnchorElement>("a.download");
    expect(recording?.textContent.trim()).toBe("Download recording");
    expect(recording?.getAttribute("href")).toContain("/clip/s1");

    save()?.click();
    await el.updateComplete;
    expect(sentOf(hass, "reolink_viewer/playback/save_event")[0]).toEqual({
      type: "reolink_viewer/playback/save_event",
      device_id: "dev-cam",
      date: "2026-10-17",
      segment_id: "s1",
      stream: "sub",
      start: event.start,
      end: event.end,
      label: "Person",
    });
    expect(save()?.textContent.trim()).toBe("Saving event…");
    expect(save()?.disabled).toBe(true);

    // Made: downloaded at once, and its link stays for another go.
    const clicks = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    answer({
      url: "/api/reolink_viewer/event_clip/tok?authSig=z",
      name: "front-yard-20261017-010010-person.mp4",
      size: 2_400_000,
      start: event.start - 10_000,
      end: event.end + 10_000,
      plain: true,
      expires_in: 900,
    });
    await flush();
    await el.updateComplete;
    expect(clicks).toHaveBeenCalledTimes(1);
    expect(clicks.mock.contexts[0]).toMatchObject({
      href: expect.stringContaining("/event_clip/tok") as unknown,
      download: "front-yard-20261017-010010-person.mp4",
    });
    expect(el.renderRoot.querySelectorAll("a[hidden]")).toHaveLength(0);
    const saved = el.renderRoot.querySelector<HTMLAnchorElement>("a.saved");
    expect(saved?.textContent.trim()).toBe("Event saved (2.4 MB)");
    expect(saved?.getAttribute("download")).toBe("front-yard-20261017-010010-person.mp4");
    expect(save()).toBeNull();
    expect(toasts).toContain("Saved front-yard-20261017-010010-person.mp4");

    // Another event: its own button, free to save.
    const other = el._day?.events[1];
    if (!other) throw new Error("no second event");
    await el.playAt(other.start);
    await el.updateComplete;
    expect(el.renderRoot.querySelector("a.saved")).toBeNull();
    expect(save()?.disabled).toBe(false);
    save()?.click();
    fail(new Error("the recording took too long to download"));
    await flush();
    await el.updateComplete;
    expect(toasts.at(-1)).toBe("Could not save the event: the recording took too long to download");
    expect(save()?.textContent.trim()).toBe("Save event");
    expect(save()?.disabled).toBe(false);
  });

  it("preloads the next recording only once the start shows its first frame", async () => {
    // The video starts when the test says (happy-dom would start it at once).
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => new Promise<void>(() => undefined));
    const hass = playbackHass();
    const el = await mount(hass);
    // A minute before s1's end: what comes after it is wanted soon.
    await el.playAt(T0 + 61 * MIN);
    for (let i = 0; i < 3; i += 1) await flush();
    const player = el.renderRoot.querySelector("rv-player");
    const asked = () => sentOf(hass, "reolink_viewer/playback/url").map((m) => m.segment_id);
    // Nothing of s2 shares the connection with the start.
    expect(asked()).toEqual(["s1"]);
    expect(player?.preloaded).toBeUndefined();
    player?.renderRoot.querySelector("video")?.dispatchEvent(new Event("playing"));
    for (let i = 0; i < 3; i += 1) await flush();
    expect(asked()).toEqual(["s1", "s2"]);
    expect(player?.preloaded?.segmentId).toBe("s2");
  });

  it("offers picture-in-picture where the browser has it, and shows when it is on", async () => {
    const pip = fakePip();
    try {
      const hass = playbackHass();
      const el = await mount(hass);
      expect(el.renderRoot.querySelector("button.pip")).toBeNull(); // nothing playing yet
      const event = el._day?.events[0];
      if (!event) throw new Error("no event");
      await el.playAt(event.start);
      await flush();
      await el.updateComplete;
      const button = el.renderRoot.querySelector<HTMLButtonElement>("button.pip");
      expect(button?.textContent).toContain("Picture in picture");
      expect(button?.getAttribute("aria-pressed")).toBe("false");
      button?.click();
      await flush();
      await el.updateComplete;
      expect(pip.element()).not.toBeNull();
      expect(button?.getAttribute("aria-pressed")).toBe("true");
    } finally {
      pip.restore();
    }
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
    // What was seen, motion only when nothing more is known; none chosen shows all.
    expect(chips.map((c) => c.textContent.replace(/\s+/g, " ").trim())).toEqual(["Person 1", "Animal 1"]);
    chips[1]?.click();
    await el.updateComplete;
    expect(el._only).toEqual(new Set(["ANIMAL"]));
    expect(chips[1]?.getAttribute("aria-pressed")).toBe("true");
    expect(el.renderRoot.querySelector("rv-event-list")?.events.map((e) => e.types)).toEqual([["ANIMAL"]]);
    expect(el.renderRoot.querySelector(".events-head")?.textContent.replace(/\s+/g, " ")).toContain("1 of 2 events");
    [...el.renderRoot.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent.trim() === "Show every event")?.click();
    expect(el._only.size).toBe(0);

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
    await flush();
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
    const toasts: string[] = [];
    el.addEventListener(TOAST_EVENT, (e) => toasts.push((e as CustomEvent<{ message: string }>).detail.message));
    el.renderRoot
      .querySelector("rv-player")
      ?.dispatchEvent(
        new CustomEvent("rv-player-error", { detail: { message: "decode" }, bubbles: true, composed: true }),
      );
    await flush();
    expect(el._stream).toBe("sub");
    expect(toasts).toContain("HD could not play: This browser cannot play this recording. Back to SD.");
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
    // Plain words first; the player's own words under Details, for support.
    const banner = el.renderRoot.querySelector(".problem");
    expect(banner?.querySelector("strong")?.textContent).toBe("This browser cannot play this recording.");
    expect(banner?.textContent).toContain("Try Chrome or Safari, or play it in SD.");
    expect(banner?.querySelector("details")?.textContent).toContain("Playback failed: no supported streams");
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

  it("starts where asked even if the playing video moves the cursor meanwhile", async () => {
    const hass = playbackHass();
    const base = hass.callWS.bind(hass);
    let release: () => void = () => undefined;
    hass.callWS = <T,>(message: Record<string, unknown>) =>
      message.type === "reolink_viewer/playback/url" && message.segment_id === "s2"
        ? new Promise<T>((resolve) => {
            release = () => {
              resolve(base<T>(message));
            };
          })
        : base<T>(message);
    const el = await mount(hass);
    const player = el.renderRoot.querySelector("rv-player");
    if (!player) throw new Error("no player");
    await el.playAt(T0 + 60 * MIN + 30_000);
    const play = vi.spyOn(player, "play");
    const wanted = T0 + 63 * MIN;
    const playing = el.playAt(wanted);
    await flush();
    // The video still on screen reports its time while the URL is on its way.
    player.dispatchEvent(new CustomEvent("rv-time", { detail: { time: T0 + 60 * MIN + 31_000 }, bubbles: true, composed: true }));
    release();
    await playing;
    expect(play).toHaveBeenCalledTimes(1);
    expect(play.mock.calls[0]?.[1]).toBe(wanted - (T0 + 62 * MIN));
    expect(el._cursor).toBe(wanted);
  });

  it("asks for the next hour's URL near the end, warming its cache at once", async () => {
    const long = (id: string, start: number) => ({ id, start, end: start + 60 * MIN, triggers: [], ambiguous: false });
    const day = makeDay({ segments: [long("h1", T0 + 60 * MIN), long("h2", T0 + 120 * MIN)], events: [] });
    const hass = playbackHass(day);
    const el = await mount(hass);
    await el.playAt(T0 + 70 * MIN);
    await flush();
    const urls = () => sentOf(hass, "reolink_viewer/playback/url").map((m) => m.segment_id);
    expect(urls()).toEqual(["h1"]);
    expect(sentOf(hass, "reolink_viewer/playback/prefetch").map((m) => m.segment_id)).toContain("h2");
    const player = el.renderRoot.querySelector("rv-player");
    expect(player?.preloaded).toBeUndefined();
    const time = (t: number) => {
      vi.setSystemTime(Date.now() + 1000); // past the cursor's repaint throttle
      vi.spyOn(performance, "now").mockReturnValue(Date.now());
      player?.dispatchEvent(new CustomEvent("rv-time", { detail: { time: t }, bubbles: true, composed: true }));
    };
    time(T0 + 100 * MIN);
    await flush();
    expect(urls()).toEqual(["h1"]);
    time(T0 + 118 * MIN);
    await flush();
    expect(urls()).toEqual(["h1", "h2"]);
    await flush();
    expect(player?.preloaded?.segmentId).toBe("h2");
  });

  it("reloads a recording that fails mid-way where it was, once a minute", async () => {
    const hass = playbackHass();
    const el = await mount(hass);
    await el.playAt(T0 + 60 * MIN + 30_000);
    await flush();
    const player = el.renderRoot.querySelector("rv-player");
    if (!player) throw new Error("no player");
    const video = player.renderRoot.querySelector<HTMLVideoElement>("video.active");
    if (!video) throw new Error("no video");
    Object.defineProperty(video, "currentTime", { value: 50, configurable: true });
    const fail = () => {
      player.dispatchEvent(
        new CustomEvent("rv-player-error", {
          detail: { message: "PIPELINE_ERROR_READ", segmentId: "s1", played: true },
          bubbles: true,
          composed: true,
        }),
      );
    };
    const before = sentOf(hass, "reolink_viewer/playback/url").length;
    fail();
    await flush();
    await flush();
    const after = sentOf(hass, "reolink_viewer/playback/url");
    // The recording again; its successor stays preloaded.
    expect(after).toHaveLength(before + 1);
    expect(after[before]).toMatchObject({ segment_id: "s1", progressive: false });
    expect(el._cursor).toBe(T0 + 60 * MIN + 50_000);
    expect(el._metrics.recoveries).toBe(1);
    expect(el._playFailure).toBeUndefined();
    // A second failure right after is shown, not retried.
    fail();
    await flush();
    expect(el._playFailure).toBe("PIPELINE_ERROR_READ");
    await el.updateComplete;
    expect(el.renderRoot.textContent).toContain("1× (last: PIPELINE_ERROR_READ)");
  });

  it("asks for the whole file to start deep inside a recording", async () => {
    const hass = playbackHass();
    const el = await mount(hass);
    // A browser that plays while downloading (happy-dom reports WebKit).
    Object.defineProperty(el, "_progressive", { value: true });
    await el.playAt(T0 + 60 * MIN + 1_000);
    await el.playAt(T0 + 60 * MIN + 10_000);
    const urls = sentOf(hass, "reolink_viewer/playback/url").filter((m) => m.segment_id === "s1");
    // Near the start: progressive. Ten seconds in: the whole file, to seek.
    expect(urls.map((m) => m.progressive)).toEqual([true, false]);
    expect(el._metrics.delivery).toBe("whole file first (to seek)");
    expect(deliveryOf(true, true, false)).toBe("progressive");
    expect(deliveryOf(false, false, false)).toBe("whole file first (WebKit)");
    expect(deliveryOf(false, true, true)).toBe("cached file (Range)");
  });

  it("holds back thumbnails while a recording starts", async () => {
    const hass = playbackHass();
    const el = await mount(hass);
    const loader = el.thumbLoader;
    const pause = vi.spyOn(loader, "pause");
    const resume = vi.spyOn(loader, "resume");
    // happy-dom refuses video.play(), which counts as a failed start (resume).
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    await el.playAt(T0 + 60 * MIN + 1_000);
    expect(pause).toHaveBeenCalled();
    expect(resume).not.toHaveBeenCalled();
    const video = el.renderRoot.querySelector("rv-player")?.renderRoot.querySelector("video");
    video?.dispatchEvent(new Event("playing"));
    expect(resume).toHaveBeenCalledTimes(1);
    // A day change drops the thumbnails still queued.
    const clear = vi.spyOn(loader, "clear");
    el.renderRoot.querySelector<HTMLButtonElement>('button[aria-label="Previous day"]')?.click();
    expect(clear).toHaveBeenCalled();
  });

  it("asks again soon when the event search failed", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(new Date(T0 + 12 * 60 * MIN));
    const hass = playbackHass(makeDay({ events: [], events_error: "ApiError -12" }));
    const el = document.createElement("rv-playback");
    el.thumbLoader = new ThumbLoader(2, instantImage);
    el.hass = hass;
    el.deviceId = "dev-cam";
    document.body.appendChild(el);
    await vi.advanceTimersByTimeAsync(0);
    expect(sentOf(hass, "reolink_viewer/timeline/day")).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(EVENTS_RETRY_MS);
    const days = sentOf(hass, "reolink_viewer/timeline/day");
    expect(days).toHaveLength(2);
    expect(days[1]).not.toHaveProperty("max_age");
    // While it keeps failing: a few quick tries, then the normal refresh.
    await vi.advanceTimersByTimeAsync(EVENTS_RETRY_MS * 5);
    expect(sentOf(hass, "reolink_viewer/timeline/day")).toHaveLength(1 + EVENTS_RETRIES);
  });

  it("describes the cache state", () => {
    expect(describeCache({ complete: true, bytes: 12_345_678, error: null })).toBe("cached (12.3 MB)");
    expect(describeCache({ complete: false, bytes: 500_000, error: null })).toBe("filling (0.5 MB so far)");
    expect(describeCache({ complete: false, bytes: 0, error: "HTTP 500" })).toBe("failed: HTTP 500");
    // Phase 5c: the download stopped where the cut begins.
    expect(describeCache({ complete: false, bytes: 240_000_000, error: null, stopped_ms: 3_420_000, cut: { login: "shared" } })).toBe(
      "copied to 57.0 min (240.0 MB) · Reolink protocol cut: no fragment, shared login",
    );
    // Phase 5b: a deep start the device's cut served.
    expect(
      describeCache({ complete: false, bytes: 500_000, error: null, cut: { first_fragment_ms: 380.4, login: "new" } }),
    ).toBe("filling (0.5 MB so far) · Reolink protocol cut: first fragment 380 ms, new login");
    expect(describeCache({ complete: true, bytes: 500_000, error: null, cut: { login: "shared" } })).toBe(
      "cached (0.5 MB) · Reolink protocol cut: no fragment, shared login",
    );
    expect(describeCache({ complete: false, bytes: 0, error: null, cut: { error: "timeout" } })).toBe(
      "filling (0.0 MB so far) · Reolink protocol cut: failed (timeout)",
    );
    expect(
      describeCache({ complete: false, bytes: 0, error: null, cut: {}, cut_error: "no stream slot within 5 s (7 of 7 in use)" }),
    ).toBe("filling (0.0 MB so far) · Reolink protocol cut not used: no stream slot within 5 s (7 of 7 in use)");
  });

  it("offers the playback check and its saved reports under Details", async () => {
    const hass = playbackHass();
    hass.responses["reolink_viewer/playback/check_reports"] = {
      reports: [
        { id: "r1", setup: "iPhone app, Nabu Casa", text: "report text", done: false, updated: "2026-10-17T12:00:00Z" },
        { id: "l1", setup: "Live check · Desktop Chrome, LAN", text: "live report", done: true, updated: "2026-10-17T12:00:00Z" },
      ],
    };
    const el = await mount(hass);
    const buttons = () => [...el.renderRoot.querySelectorAll<HTMLButtonElement>(".check button")];
    const named = (name: string) => buttons().find((b) => b.textContent.trim() === name);
    expect(named("Run playback check")).toBeDefined();
    // No report yet: nothing to copy.
    expect(named("Copy report")).toBeUndefined();
    expect([...el.renderRoot.querySelectorAll(".check option")].map((o) => o.textContent)).toContain(
      "iPhone app, Tailscale",
    );
    // HD is on for local setups, off for remote ones (it fetches a main recording).
    const hdBox = () =>
      [...el.renderRoot.querySelectorAll<HTMLLabelElement>(".check label")]
        .find((l) => l.textContent.includes("Switch to HD and back"))
        ?.querySelector("input");
    const setup = el.renderRoot.querySelector<HTMLSelectElement>(".check select");
    if (!setup) throw new Error("no setup select");
    setup.value = "iPhone app, Nabu Casa";
    setup.dispatchEvent(new Event("change"));
    await el.updateComplete;
    expect(hdBox()?.checked).toBe(false);
    setup.value = "Desktop Chrome, LAN";
    setup.dispatchEvent(new Event("change"));
    await el.updateComplete;
    expect(hdBox()?.checked).toBe(true);
    named("Saved reports")?.click();
    await flush();
    await el.updateComplete;
    expect(el.renderRoot.querySelector(".reports")?.textContent).toContain("iPhone app, Nabu Casa · running or cut short");
    // The live check's reports are not this check's.
    expect(el.renderRoot.querySelectorAll(".reports li")).toHaveLength(1);
    [...el.renderRoot.querySelectorAll<HTMLButtonElement>(".reports button")].find((b) => b.textContent.trim() === "Show")?.click();
    await el.updateComplete;
    expect(el.renderRoot.querySelector("pre.report")?.textContent).toBe("report text");
    expect(named("Copy report")?.disabled).toBe(false);
    // A report without a plain summary shows none.
    expect(el.renderRoot.querySelector(".check rv-findings")).toBeNull();
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
    const banner = el.renderRoot.querySelector(".problem");
    expect(banner?.querySelector("strong")?.textContent).toBe(
      "The recorder did not answer when asked for this day's recordings.",
    );
    expect(banner?.querySelector("details")?.textContent).toContain("Could not load recordings: day search failed");
    expect(banner?.querySelector("a.help-link")?.getAttribute("href")).toMatch(/troubleshooting\.md#recordings-and-events$/);
    // Not "no events": none could be read.
    expect(el.renderRoot.querySelector("rv-event-list")).toBeNull();
    expect(el.renderRoot.textContent).toContain("This day's events could not be read.");
  });

  it("says a camera that is offline is why its SD card cannot be read", async () => {
    const hass = playbackHass();
    const base = hass.callWS.bind(hass);
    hass.callWS = <T,>(message: Record<string, unknown>) =>
      message.type === "reolink_viewer/timeline/day"
        ? // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
          Promise.reject({ code: "search_failed", message: "camera unreachable" })
        : base<T>(message);
    const el = document.createElement("rv-playback");
    el.offline = true;
    el.hass = hass;
    el.deviceId = "dev-cam";
    el.cameraName = "Front Yard";
    document.body.appendChild(el);
    for (let i = 0; i < 4; i += 1) await flush();
    await el.updateComplete;
    const banner = el.renderRoot.querySelector(".problem");
    expect(banner?.querySelector("strong")?.textContent).toBe(
      "Front Yard is offline, so the recordings on its SD card cannot be read.",
    );
    expect(banner?.textContent).toContain("They come back when it does.");
  });

  it("warns when the disk keeping the recordings is not ready", async () => {
    const el = await mount(playbackHass());
    expect(el.renderRoot.querySelector(".banner.warning")).toBeNull();
    el.storage = "not_ready";
    await el.updateComplete;
    expect(el.renderRoot.querySelector(".banner.warning")?.textContent).toContain("Front Yard's SD card is not ready");
    el.recorder = "nvr";
    await el.updateComplete;
    const warning = el.renderRoot.querySelector(".banner.warning")?.textContent ?? "";
    expect(warning).toContain("The NVR's hard disk is not ready");
    expect(warning).toContain("Format it in the Reolink app, or replace it.");
  });
});

describe("rv-playback with MSE", () => {
  /** A MediaSource that never opens: enough to choose the MSE player. */
  class IdleMediaSource extends EventTarget {
    static isTypeSupported = () => true;
    readyState = "closed";
  }

  function mseHass(): FakeHass {
    const hass = playbackHass();
    const day = makeDay();
    const base = hass.callWS.bind(hass);
    hass.fetchWithAuth = vi.fn(() => new Promise<Response>(() => undefined));
    hass.callWS = <T,>(message: Record<string, unknown>) => {
      if (message.type === "reolink_viewer/playback/mse") {
        hass.sent.push(message);
        const seg = day.segments.find((s) => s.id === message.segment_id);
        const playback: PlaybackUrl = {
          ...playbackUrl(String(message.segment_id), seg?.start ?? 0),
          base: `/api/reolink_viewer/mse/tok-${String(message.segment_id)}-${hass.sent.length}`,
        };
        delete playback.url;
        return Promise.resolve(playback as T);
      }
      if (message.type === "reolink_viewer/playback/cache_status") {
        hass.sent.push(message);
        return Promise.resolve({ cache: { complete: false, bytes: 40_000_000, error: null }, expected_bytes: 260_000_000 } as T);
      }
      return base<T>(message);
    };
    return hass;
  }

  beforeEach(() => {
    vi.stubGlobal("MediaSource", IdleMediaSource);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mse");
    vi.spyOn(URL, "revokeObjectURL").mockReturnValue(undefined);
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("plays through MSE, and seeks within the recording on screen without a new URL", async () => {
    const hass = mseHass();
    const el = await mount(hass);
    await el.playAt(T0 + 60 * MIN + 30_000);
    await flush();
    const mse = sentOf(hass, "reolink_viewer/playback/mse");
    expect(mse[0]).toMatchObject({ segment_id: "s1", at: T0 + 60 * MIN + 30_000 });
    expect(sentOf(hass, "reolink_viewer/playback/url").filter((m) => m.segment_id === "s1")).toHaveLength(0);
    const player = el.renderRoot.querySelector("rv-player");
    expect(player?.mse).toBe(true);
    expect(player?.current?.mse?.base).toContain("/api/reolink_viewer/mse/tok-s1");
    expect(el._metrics.delivery).toBe("MSE (MediaSource)");
    expect(el._describeMode()).toBe("MSE (MediaSource)");
    // The next recording is preloaded through MSE too.
    expect(mse.some((m) => m.segment_id === "s2")).toBe(true);
    const before = sentOf(hass, "reolink_viewer/playback/mse").length;
    await el.playAt(T0 + 61 * MIN);
    await flush();
    expect(sentOf(hass, "reolink_viewer/playback/mse")).toHaveLength(before);
    expect(el._metrics.delivery).toBe("MSE (MediaSource), same recording");
    expect(el._cursor).toBe(T0 + 61 * MIN);
  });

  it("hands a stream to the file player when MSE cannot play it", async () => {
    const hass = mseHass();
    const el = await mount(hass);
    await el.playAt(T0 + 60 * MIN + 30_000);
    await flush();
    const player = el.renderRoot.querySelector("rv-player");
    player?.dispatchEvent(
      new CustomEvent("rv-player-error", {
        detail: { message: "MSE cannot play hvc1", segmentId: "s1", played: false, fallback: true },
        bubbles: true,
        composed: true,
      }),
    );
    await flush();
    await flush();
    expect(sentOf(hass, "reolink_viewer/playback/url").at(-1)).toMatchObject({
      segment_id: "s1",
      at: T0 + 60 * MIN + 30_000,
    });
    expect(el._metrics).toMatchObject({ fallbacks: 1, lastFallback: "MSE cannot play hvc1" });
    expect(el._describeMode()).toBe("MSE (MediaSource), file player for sub after a failure");
    expect(player?.mse).toBe(false);
    await el.updateComplete;
    expect(el.renderRoot.textContent).toContain("1× (last: MSE cannot play hvc1)");
  });

  it("can be told to use the file player only", async () => {
    const hass = mseHass();
    const el = await mount(hass);
    await el.playAt(T0 + 60 * MIN + 30_000);
    await flush();
    const select = el.renderRoot.querySelector<HTMLSelectElement>('select[aria-label="Player"]');
    if (!select) throw new Error("no player select");
    select.value = "file";
    select.dispatchEvent(new Event("change"));
    await flush();
    await flush();
    expect(window.localStorage.getItem("reolink-viewer-player")).toBe("file");
    expect(sentOf(hass, "reolink_viewer/playback/url").at(-1)).toMatchObject({ segment_id: "s1" });
    expect(el._describeMode()).toBe("file player only (set under Details)");
  });

  it("sets the speed, and shows the recorder's download while a start waits", async () => {
    const hass = mseHass();
    const el = await mount(hass);
    const speed = el.renderRoot.querySelector<HTMLSelectElement>('select[aria-label="Playback speed"]');
    if (!speed) throw new Error("no speed select");
    expect([...speed.options].map((o) => o.textContent)).toEqual(["0.5×", "1×", "2×", "4×", "8×"]);
    speed.value = "4";
    speed.dispatchEvent(new Event("change"));
    await el.updateComplete;
    const player = el.renderRoot.querySelector("rv-player");
    expect(player?.rate).toBe(4);
    // The video waits for its first frame (happy-dom would report one at once).
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => new Promise<void>(() => undefined));
    await el.playAt(T0 + 60 * MIN + 30_000);
    await new Promise((resolve) => setTimeout(resolve, 1_100));
    expect(el._note).toBe("Fetching the recording from the recorder: 40 MB of about 260 MB");
    expect(String(sentOf(hass, "reolink_viewer/playback/cache_status")[0]?.token)).toMatch(/^tok-s1-/);
  });

  it("says it asks the recorder while its cut serves a start, and searches the HD list ahead", async () => {
    const hass = mseHass();
    const base = hass.callWS.bind(hass);
    hass.callWS = <T,>(message: Record<string, unknown>) => {
      if (message.type === "reolink_viewer/playback/cache_status") {
        hass.sent.push(message);
        const cache = { complete: false, bytes: 1_000_000, error: null, cut: { login: "new", error: null } };
        return Promise.resolve({ cache, expected_bytes: 260_000_000 } as T);
      }
      return base<T>(message);
    };
    const el = await mount(hass);
    // Where HD plays, the day's HD list is searched in the background, once.
    el._hd = { main: true, reason: "avc1.640033 at 2560×1440 is supported" };
    await el._loadDay("2026-10-17");
    await el._loadDay("2026-10-17");
    const ahead = sentOf(hass, "reolink_viewer/timeline/day").filter((m) => m.stream === "main");
    expect(ahead).toEqual([expect.objectContaining({ date: "2026-10-17", background: true })]);
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => new Promise<void>(() => undefined));
    await el.playAt(T0 + 60 * MIN + 30_000);
    await new Promise((resolve) => setTimeout(resolve, 1_100));
    expect(el._note).toBe("Asking the recorder for this moment…");
  });
});

describe("rv-playback while dragging (Phase 10)", () => {
  /** A scrub session that answers each moment with the key frame half a second before it. */
  class ScrubSocket implements SocketLike {
    binaryType = "blob";
    readyState = 0;
    onopen: ((event: unknown) => void) | null = null;
    onmessage: ((event: { data: unknown }) => void) | null = null;
    onclose: ((event: unknown) => void) | null = null;
    onerror: ((event: unknown) => void) | null = null;
    asked: number[] = [];
    closed = false;

    constructor(readonly url: string) {
      queueMicrotask(() => {
        this.readyState = 1;
        this.onopen?.({});
      });
    }

    send(data: string): void {
      const { seq, at } = JSON.parse(data) as { seq: number; at: number };
      this.asked.push(at);
      // As the server (views._scrub_request): a moment is whole milliseconds.
      if (!Number.isInteger(at)) return;
      const header = { seq, at, time: at - 500, source: "store", kind: "fmp4", codec: "avc1", timing: { ms: 2 }, interval: 4000 };
      const json = new TextEncoder().encode(JSON.stringify({ ...header, init: 1, data: 1 }));
      const out = new Uint8Array(4 + json.length + 2);
      new DataView(out.buffer).setUint32(0, json.length);
      out.set(json, 4);
      queueMicrotask(() => this.onmessage?.({ data: out.buffer }));
    }

    close(): void {
      this.closed = true;
      this.readyState = 3;
    }
  }

  async function scrubMount(hass = playbackHass()) {
    const base = hass.callWS.bind(hass);
    hass.callWS = <T,>(message: Record<string, unknown>) => {
      if (message.type === "reolink_viewer/playback/scrub") {
        hass.sent.push(message);
        return Promise.resolve({ url: "/api/reolink_viewer/scrub?authSig=s", expires_in: 600 } as T);
      }
      return base<T>(message);
    };
    const el = await mount(hass);
    const sockets: ScrubSocket[] = [];
    el.scrubSocket = (url) => {
      const socket = new ScrubSocket(url);
      sockets.push(socket);
      return socket;
    };
    const picture = el.renderRoot.querySelector("rv-scrub-picture");
    if (!picture) throw new Error("no scrub picture");
    const painted: number[] = [];
    picture.codecs = {
      available: true,
      paint: (p: ScrubPicture) => {
        painted.push(p.time);
        return Promise.resolve(true);
      },
      close: () => undefined,
    } as unknown as KeyFramePainter;
    const timeline = el.renderRoot.querySelector("rv-timeline");
    const player = el.renderRoot.querySelector("rv-player");
    if (!timeline || !player) throw new Error("no timeline or player");
    const send = (target: Element, type: string, detail: unknown = {}) =>
      target.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
    return { el, hass, sockets, picture, painted, timeline, player, send };
  }

  const settle = async (el: RvPlayback) => {
    for (let i = 0; i < 6; i += 1) await flush();
    await el.updateComplete;
  };

  it("paints the server's picture where the video has none, until the video starts there", async () => {
    const { el, hass, sockets, picture, painted, timeline, player, send } = await scrubMount();
    const at = T0 + 61 * MIN;
    // A drag's time comes from the pointer's pixel: a fraction of a millisecond.
    const pointer = at + 0.37;
    send(timeline, "rv-scrub", { time: pointer });
    await settle(el);
    expect(sentOf(hass, "reolink_viewer/playback/scrub")).toEqual([
      expect.objectContaining({ device_id: "dev-cam", date: "2026-10-17" }),
    ]);
    expect(sockets[0]?.url).toBe("/api/reolink_viewer/scrub?authSig=s");
    expect(sockets[0]?.asked).toEqual([at]);
    expect(el._scrubPicture?.time).toBe(at - 500);
    expect(painted).toEqual([at - 500]);
    await picture.updateComplete;
    expect(picture.renderRoot.querySelector(".frame")?.classList.contains("on")).toBe(true);
    // The pointer is the time while dragging, whatever the playing video says.
    send(player, "rv-time", { time: T0 + 60 * MIN });
    expect(el._cursor).toBe(pointer);
    // The hover shows the time alone: the picture is in the player.
    const thumbs = sentOf(hass, "reolink_viewer/thumbnail/urls").length;
    send(timeline, "rv-hover", { time: at, x: 200 });
    await settle(el);
    expect(el._hover?.bare).toBe(true);
    expect(el.renderRoot.querySelector(".hover img, .hover .noimg")).toBeNull();
    expect(sentOf(hass, "reolink_viewer/thumbnail/urls")).toHaveLength(thumbs);
    expect(el._metrics.scrub).toMatchObject({ asked: 1, shown: 1, missed: 0, last: "store, 0 ms, 0.5 s before" });

    // Released: it plays from there; the picture stays until the video's first frame.
    const play = vi.spyOn(player, "play").mockResolvedValue(undefined);
    send(timeline, "rv-seek", { time: at });
    await settle(el);
    expect(play).toHaveBeenCalledTimes(1);
    expect(el._scrubPicture).toBeDefined();
    send(player, "rv-first-frame", { ms: 300 });
    await el.updateComplete;
    expect(el._scrubPicture).toBeUndefined();

    // Another day: the session closes.
    el.renderRoot.querySelector<HTMLButtonElement>('button[aria-label="Previous day"]')?.click();
    await settle(el);
    expect(sockets[0]?.closed).toBe(true);
  });

  it("shows the video's own frame where it has it buffered, and asks the server nothing", async () => {
    const { el, hass, timeline, player, send } = await scrubMount();
    player.buffers = () => true;
    const preview = vi.spyOn(player, "preview").mockReturnValue(true);
    send(timeline, "rv-scrub", { time: T0 + 61 * MIN });
    await settle(el);
    expect(preview).toHaveBeenCalledWith(T0 + 61 * MIN);
    expect(sentOf(hass, "reolink_viewer/playback/scrub")).toHaveLength(0);
    expect(el._scrubPicture).toBeUndefined();
  });

  it("asks nothing between recordings, and takes the picture away when the browser takes the drag", async () => {
    const { el, sockets, timeline, send } = await scrubMount();
    send(timeline, "rv-scrub", { time: T0 + 300 * MIN });
    await settle(el);
    expect(sockets).toHaveLength(0);
    send(timeline, "rv-scrub", { time: T0 + 61 * MIN });
    await settle(el);
    expect(el._scrubPicture).toBeDefined();
    send(timeline, "rv-hover-end");
    await el.updateComplete;
    expect(el._scrubPicture).toBeUndefined();
  });

  it("pauses the video while dragging: a cancelled drag plays on, a release plays from there", async () => {
    const { el, timeline, player, send } = await scrubMount();
    const hold = vi.spyOn(player, "hold").mockReturnValue(true);
    const resume = vi.spyOn(player, "resume").mockImplementation(() => undefined);
    const playAt = vi.spyOn(el, "playAt").mockResolvedValue(undefined);
    send(timeline, "rv-scrub", { time: T0 + 61 * MIN });
    send(timeline, "rv-scrub", { time: T0 + 61 * MIN + 500 });
    await settle(el);
    expect(hold).toHaveBeenCalledTimes(1);
    // The browser took the drag: the video plays on.
    send(timeline, "rv-hover-end");
    expect(resume).toHaveBeenCalledTimes(1);
    // Released: it plays from there, not on from where it was.
    send(timeline, "rv-scrub", { time: T0 + 61 * MIN });
    send(timeline, "rv-seek", { time: T0 + 61 * MIN });
    expect(hold).toHaveBeenCalledTimes(2);
    expect(resume).toHaveBeenCalledTimes(1);
    expect(playAt).toHaveBeenCalledTimes(1);
    // A drag over a video already paused leaves it paused when cancelled.
    hold.mockReturnValue(false);
    send(timeline, "rv-scrub", { time: T0 + 61 * MIN });
    send(timeline, "rv-hover-end");
    expect(resume).toHaveBeenCalledTimes(1);
  });

  it("a release plays from the picture on screen when it is the pointer's, else from the pointer", async () => {
    const { el, picture, timeline, send } = await scrubMount();
    const playAt = vi.spyOn(el, "playAt").mockResolvedValue(undefined);
    const drag = async (time: number) => {
      send(timeline, "rv-scrub", { time });
      await settle(el);
      await picture.updateComplete;
    };
    // The picture is the key frame 0.5 s before the moment asked (the stand-in session's).
    const at = T0 + 61 * MIN;
    await drag(at + 0.37);
    expect(picture.shown?.time).toBe(at - 500);
    send(timeline, "rv-seek", { time: at + 0.37 });
    expect(playAt).toHaveBeenLastCalledWith(at - 500);
    // Late (the pointer went on, past the camera's interval and half a second): from the pointer.
    await drag(at);
    send(timeline, "rv-seek", { time: at + 30_000 });
    expect(playAt).toHaveBeenLastCalledWith(at + 30_000);
    // In the recording before the pointer's: from the pointer.
    const next = T0 + 62 * MIN + 200;
    await drag(next);
    expect(picture.shown?.time).toBe(next - 500);
    send(timeline, "rv-seek", { time: next });
    expect(playAt).toHaveBeenLastCalledWith(next);
    // A click (no drag): from the click, whatever was shown before.
    send(timeline, "rv-seek", { time: at + 0.37 });
    expect(playAt).toHaveBeenLastCalledWith(at + 0.37);
  });

  it("lets a released picture go after a while if the video never starts", async () => {
    const { el, timeline, send } = await scrubMount();
    vi.spyOn(el, "playAt").mockResolvedValue(undefined);
    send(timeline, "rv-scrub", { time: T0 + 61 * MIN });
    await settle(el);
    vi.useFakeTimers();
    try {
      send(timeline, "rv-seek", { time: T0 + 61 * MIN });
      vi.advanceTimersByTime(SCRUB_HOLD_MS - 1);
      expect(el._scrubPicture).toBeDefined();
      vi.advanceTimersByTime(1);
      expect(el._scrubPicture).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("falls back to the buffer for the day when the session cannot open", async () => {
    const { el, hass, timeline, send } = await scrubMount();
    el.scrubSocket = () => {
      const socket = {
        binaryType: "",
        readyState: 3,
        onopen: null,
        onmessage: null,
        onclose: null,
        onerror: null as ((event: unknown) => void) | null,
        send: () => undefined,
        close: () => undefined,
      };
      queueMicrotask(() => socket.onerror?.({}));
      return socket;
    };
    send(timeline, "rv-scrub", { time: T0 + 61 * MIN });
    await settle(el);
    expect(el._scrubPicture).toBeUndefined();
    // Hovering fetches thumbnails as before.
    send(timeline, "rv-hover", { time: T0 + 61 * MIN, x: 200 });
    await settle(el);
    expect(sentOf(hass, "reolink_viewer/thumbnail/urls").length).toBeGreaterThan(0);
  });

  it("the playback check's P row drags the timeline itself, and reports what it showed", async () => {
    const hass = playbackHass();
    hass.responses["reolink_viewer/playback/peek"] = { segment_id: "s", cache: null };
    hass.responses["reolink_viewer/playback/stats"] = {
      vod: {
        filling: 2,
        prefetching: 1,
        rewriting: 1,
        baichuan: { enabled: true, logged_in: 1, logins: 3, logouts: 2, cuts_running: 0 },
      },
      // Home Assistant's event loop held 1.3 s (v0.62.2's diagnostics), and where (v0.63.3).
      loop: {
        held_10s_ms: 1320,
        held_60s_ms: 1320,
        period_ms: 250,
        held_by: [
          { ago_s: 3, seen_ms: 900, where: ["reolink_viewer/vodcache.py:120 in _scan", "reolink_viewer/vodcache.py:80 in fill"] },
          { ago_s: 40, seen_ms: 2000, where: ["homeassistant/components/recorder/core.py:9 in old"] },
        ],
      },
    };
    hass.responses["reolink_viewer/playback/check_report"] = null;
    const { el, sockets, player } = await scrubMount(hass);
    // Every player (the tab's and the second viewer's) starts a recording at once: its first frame.
    const Player = customElements.get("rv-player") as unknown as { prototype: { play: (...args: unknown[]) => Promise<void> } };
    let started: number | undefined;
    vi.spyOn(Player.prototype, "play").mockImplementation(function (this: HTMLElement, ...args: unknown[]) {
      const [item, offset] = args as [{ start: number }, number];
      if (this === player) started = item.start + offset;
      setTimeout(() => this.dispatchEvent(new CustomEvent("rv-first-frame", { detail: { ms: 200 } })), 5);
      return Promise.resolve();
    });
    Object.defineProperty(player, "time", { get: () => started });
    const target = (el as unknown as { _checkTarget(): CheckTarget })._checkTarget();
    const check = new PlaybackCheck(target, { setup: "test", soakMinutes: 0 });
    check.timeScale = 0.02;
    await (check as unknown as { _drag(): Promise<void> })._drag();
    const report = check.text;
    expect(report).toContain("P  Pictures while dragging (Phase 10): painted with WebCodecs");
    expect(report).toMatch(/ {3}slow \(30 s of recording in 10 s\): \d+ pictures, the first after/);
    expect(report).toContain("within the camera's 4.0 s of their moment (0.5 to 0.5 s before)");
    // Released, the video began at the picture shown (the key frame 0.5 s before the pointer).
    expect(report).toContain("   release: the picture stayed until the video's first frame");
    expect(report).toMatch(/; it began under 0\.1 s from the picture's own time \(0\.5 s before the pointer\) ✓/);
    // Where the release's start spent its time: the page's steps, then the server's.
    expect(report).toMatch(/ {5}\[URL \d+ ms( \(server [\d.]+ ms\))?\] /);
    // How busy Home Assistant was as the release started, and the note in "In short".
    expect(report).toContain(
      "     Home Assistant: its event loop held up to 1320 ms in the last 10 s · 2 downloads from the recorder (1 for no viewer: next files, warm hours) · 1 plain-copy rewrite · held by reolink_viewer/vodcache.py:120 in _scan ← reolink_viewer/vodcache.py:80 in fill · HOME ASSISTANT HELD UP",
    );
    expect(check.inShort(true).findings.map((f) => f.text)).toContain(
      "Home Assistant itself was busy during starts: its event loop was held up to 1.3 s, by reolink_viewer/vodcache.py:120 in _scan ← reolink_viewer/vodcache.py:80 in fill, so it answered late.",
    );
    expect(report).toContain("     server: ");
    expect(report).toContain("   hovering while dragging: the time alone, no thumbnail ✓");
    expect(report).toContain("   the NVR: 0 more logins while dragging ✓");
    // Every moment asked in whole milliseconds; the fast drag rested inside a recording.
    const asked = sockets.flatMap((socket) => socket.asked);
    expect(asked.length).toBeGreaterThan(3);
    expect(asked.every((at) => Number.isInteger(at))).toBe(true);
    // The fast drag rests inside the last recording, and the last picture shows it.
    expect(report).toMatch(/ {3}fast \(2\.8 min in 5 s\): .*at rest, 0\.5 s from the pointer.* ✓/);
    // The next 30 s beside a second viewer of the camera, playing the other recording; it went away again.
    expect(report).toMatch(/ {3}beside another viewer \(playing the \d{1,2}:\d{2}:\d{2} [AP]M recording, [\d.]+ (?:s|min) long, started in \d+ ms\): \d+ pictures, .*; the viewer played .*, longest stall .* ✓/);
    expect(document.querySelectorAll("body > rv-player")).toHaveLength(0);
    expect(report).toContain("   over what the video has buffered: skipped, nothing playing");
    expect(check.inShort(true).findings.map((f) => f.text)).toContain("While dragging, pictures are decoded with WebCodecs.");
  });

  it("the P row's drag over what the video has buffered asks the server nothing", async () => {
    const hass = playbackHass();
    hass.responses["reolink_viewer/playback/peek"] = { segment_id: "s", cache: null };
    hass.responses["reolink_viewer/playback/stats"] = { vod: {} };
    hass.responses["reolink_viewer/playback/check_report"] = null;
    const { el, sockets, player } = await scrubMount(hass);
    // s1 plays, at its 60th second, with 4 s either side buffered.
    const now = T0 + 61 * MIN;
    Object.defineProperty(player, "current", { get: () => ({ segmentId: "s1", start: T0 + 60 * MIN, end: T0 + 62 * MIN }) });
    Object.defineProperty(player, "time", { get: () => now });
    player.buffers = (time: number) => Math.abs(time - now) < 4000;
    const preview = vi.spyOn(player, "preview").mockReturnValue(true);
    vi.spyOn(player, "play").mockImplementation(() => {
      setTimeout(() => player.dispatchEvent(new CustomEvent("rv-first-frame", { detail: { ms: 200 } })), 5);
      return Promise.resolve();
    });
    const target = (el as unknown as { _checkTarget(): CheckTarget })._checkTarget();
    const check = new PlaybackCheck(target, { setup: "test", soakMinutes: 0 });
    check.timeScale = 0.02;
    await (check as unknown as { _drag(): Promise<void> })._drag();
    const report = check.text;
    expect(report).toContain("   over what the video has buffered: 8 of 8 moments shown by the video, 0 pictures asked of the server ✓");
    expect(preview).toHaveBeenCalled();
    // The drag went over s2, the other recording; none was left to play meanwhile.
    expect(Math.min(...sockets.flatMap((socket) => socket.asked))).toBeGreaterThanOrEqual(T0 + 62 * MIN);
    expect(report).toContain("   beside another viewer: none (no second recording not cached on this day)");
    // The drag paused the tab's video.
    expect(report).toContain("   this tab's video while dragging: paused ✓");
  });

  it("the playback check's V row plays two viewers on one camera and waits for the NVR to be back at rest", async () => {
    const hass = playbackHass();
    hass.responses["reolink_viewer/playback/peek"] = { segment_id: "s", cache: null };
    hass.responses["reolink_viewer/playback/check_report"] = null;
    // The NVR's users: 2 at rest, 3 while viewing, 3 just after, then 2 again.
    const users = [2, 3, 3, 3, 2];
    const loggedIn = [1, 0];
    const base = hass.callWS.bind(hass);
    hass.callWS = <T,>(message: Record<string, unknown>) => {
      if (message.type === "reolink_viewer/playback/online_users") {
        hass.sent.push(message);
        return Promise.resolve({ count: users.length > 1 ? users.shift() : users[0], error: null } as T);
      }
      if (message.type === "reolink_viewer/playback/stats") {
        const logged = loggedIn.length > 1 ? loggedIn.shift() : loggedIn[0];
        return Promise.resolve({ vod: { baichuan: { enabled: true, logged_in: logged, logins: 1, logouts: 0, cuts_running: 0 } } } as T);
      }
      return base<T>(message);
    };
    const { el } = await scrubMount(hass);
    // Every player (the tab's and the second viewer's) starts at once.
    const Player = customElements.get("rv-player") as unknown as { prototype: { play: (...args: unknown[]) => Promise<void> } };
    const released: string[] = [];
    vi.spyOn(Player.prototype, "play").mockImplementation(function (this: HTMLElement, ...args: unknown[]) {
      const item = args[0] as { segmentId: string; release?: () => void };
      released.push(item.release ? "has release" : "none");
      setTimeout(() => this.dispatchEvent(new CustomEvent("rv-first-frame", { detail: { ms: 200 } })), 5);
      return Promise.resolve();
    });
    const target = (el as unknown as { _checkTarget(): CheckTarget })._checkTarget();
    const check = new PlaybackCheck(target, { setup: "test", soakMinutes: 0 });
    check.timeScale = 0.01;
    await (check as unknown as { _viewers(): Promise<void> })._viewers();
    const report = check.text;
    expect(report).toContain("V  Two viewers on one camera (Phase 5): the NVR's users at rest 2, with one viewer 3, with two 3");
    expect(report).toMatch(/ {3}the second viewer: first frame \d+ ms ✓; then far into the first one's recording: \d+ ms/);
    expect(report).toMatch(/ {3}both stopped \(the second as a closed tab\): back at rest after .* \(the NVR lists 2, no Reolink protocol login left\) ✓/);
    // The second viewer went off screen and away again.
    expect(document.querySelectorAll("body > rv-player")).toHaveLength(0);
    expect(sentOf(hass, "reolink_viewer/playback/online_users").every((m) => m.device_id === "dev-cam")).toBe(true);
  });

  it("the V row says when the NVR is not back at rest", async () => {
    const hass = playbackHass();
    hass.responses["reolink_viewer/playback/peek"] = { segment_id: "s", cache: null };
    hass.responses["reolink_viewer/playback/check_report"] = null;
    hass.responses["reolink_viewer/playback/stats"] = { vod: { baichuan: { enabled: true, logged_in: 1, logins: 1, logouts: 0, cuts_running: 0 } } };
    const users = [2, 3];
    const base = hass.callWS.bind(hass);
    hass.callWS = <T,>(message: Record<string, unknown>) =>
      message.type === "reolink_viewer/playback/online_users"
        ? Promise.resolve({ count: users.length > 1 ? users.shift() : users[0], error: null } as T)
        : base<T>(message);
    const { el } = await scrubMount(hass);
    const Player = customElements.get("rv-player") as unknown as { prototype: { play: () => Promise<void> } };
    vi.spyOn(Player.prototype, "play").mockImplementation(function (this: HTMLElement) {
      setTimeout(() => this.dispatchEvent(new CustomEvent("rv-first-frame", { detail: { ms: 200 } })), 5);
      return Promise.resolve();
    });
    const target = (el as unknown as { _checkTarget(): CheckTarget })._checkTarget();
    const check = new PlaybackCheck(target, { setup: "test", soakMinutes: 0 });
    check.timeScale = 0.01;
    await (check as unknown as { _viewers(): Promise<void> })._viewers();
    // 75 s at the test's speed (a hundredth).
    expect(check.text).toContain("NOT back at rest after 1 s: the NVR lists 3 (2 at rest), 1 Reolink protocol login(s) left ✗");
    expect(check.inShort(true).findings.find((f) => f.text.startsWith("When both viewers stopped"))?.grade).toBe("problem");
  });

  it("the V row passes nothing it could not read: an older Home Assistant without the NVR's list", async () => {
    const hass = playbackHass();
    hass.responses["reolink_viewer/playback/peek"] = { segment_id: "s", cache: null };
    hass.responses["reolink_viewer/playback/check_report"] = null;
    hass.responses["reolink_viewer/playback/stats"] = { vod: { baichuan: { enabled: true, logged_in: 0, logins: 1, logouts: 1, cuts_running: 0 } } };
    const base = hass.callWS.bind(hass);
    // As a Home Assistant still running 0.60.0 answers a command it does not have.
    hass.callWS = <T,>(message: Record<string, unknown>) =>
      message.type === "reolink_viewer/playback/online_users" ? Promise.reject(new Error("Unknown command.")) : base<T>(message);
    const { el } = await scrubMount(hass);
    const Player = customElements.get("rv-player") as unknown as { prototype: { play: () => Promise<void> } };
    vi.spyOn(Player.prototype, "play").mockImplementation(function (this: HTMLElement) {
      setTimeout(() => this.dispatchEvent(new CustomEvent("rv-first-frame", { detail: { ms: 200 } })), 5);
      return Promise.resolve();
    });
    const target = (el as unknown as { _checkTarget(): CheckTarget })._checkTarget();
    const check = new PlaybackCheck(target, { setup: "test", soakMinutes: 0 });
    check.timeScale = 0.01;
    await (check as unknown as { _viewers(): Promise<void> })._viewers();
    const line = check.text.split("\n").find((l) => l.includes("both stopped")) ?? "";
    expect(line).toContain("the NVR's list of users could not be read (Home Assistant runs an older Reolink Viewer than this page: restart it, then run the check again)");
    expect(line).not.toContain("✓");
    expect(check.inShort(true).findings.find((f) => f.text.startsWith("When both viewers stopped"))?.grade).toBe("note");
  });

  it("describes the pictures while dragging for the debug panel, with how they are painted", () => {
    const webCodecs = { how: "WebCodecs" as const };
    expect(describeScrub(undefined, false, webCodecs)).toBe("painted with WebCodecs · none yet");
    expect(describeScrub(undefined, false, { how: "none", why: "this browser has neither WebCodecs nor MSE" })).toBe(
      "not here: this browser has neither WebCodecs nor MSE",
    );
    expect(describeScrub(undefined, true, webCodecs)).toContain("could not open");
    expect(
      describeScrub({ asked: 5, shown: 4, missed: 1, last: "device, 270 ms, 0.4 s before" }, false, {
        how: "MSE",
        why: "this browser has no VideoDecoder",
      }),
    ).toBe("painted with MSE (this browser has no VideoDecoder) · 4 shown of 5 asked, 1 missed (last: device, 270 ms, 0.4 s before)");
    expect(describeScrub(undefined, false, undefined)).toBe("none yet");
  });
});

describe("videoCodec", () => {
  it("takes the video codec from an MSE type", () => {
    expect(videoCodec('video/mp4; codecs="avc1.640033,mp4a.40.2"')).toBe("avc1.640033");
    expect(videoCodec('video/mp4; codecs="hvc1.1.6.L153.B0"')).toBe("hvc1.1.6.L153.B0");
    expect(videoCodec("")).toBeNull();
    expect(videoCodec(undefined)).toBeNull();
  });
});

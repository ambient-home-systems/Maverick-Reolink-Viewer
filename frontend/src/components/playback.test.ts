import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fakePip, makeHass, okDevices, type FakeHass } from "../test-fixtures";
import type { PlaybackUrl, TimelineDay } from "../types";
import { playsProgressive } from "../playback/codec";
import { ThumbLoader } from "../playback/thumb-loader";
import "./playback";
import { TOAST_EVENT } from "./navigation";
import {
  EVENTS_RETRIES,
  EVENTS_RETRY_MS,
  STALE_TODAY_S,
  deliveryOf,
  describeCache,
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
    expect(el.renderRoot.textContent).toContain("Could not load recordings: day search failed");
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
});

describe("videoCodec", () => {
  it("takes the video codec from an MSE type", () => {
    expect(videoCodec('video/mp4; codecs="avc1.640033,mp4a.40.2"')).toBe("avc1.640033");
    expect(videoCodec('video/mp4; codecs="hvc1.1.6.L153.B0"')).toBe("hvc1.1.6.L153.B0");
    expect(videoCodec("")).toBeNull();
    expect(videoCodec(undefined)).toBeNull();
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

import { parseInShort } from "../plain";
import { makeHass, okDevices, type FakeHass } from "../test-fixtures";
import { VERSION } from "../version";
import type { TimelineDay } from "../types";
import { PlaybackCheck, hdByDefault, noteInterruptedCheck, requestReport, type CheckTarget } from "./check";
import { MSE_SAMPLES } from "./mse-sample";
import type { RvPlayer } from "./player";

const T0 = Date.UTC(2026, 9, 17, 4, 0);

function emptyDay(): TimelineDay {
  return {
    date: "2026-10-17",
    start: T0,
    end: T0 + 86_400_000,
    now: T0 + 43_200_000,
    segments: [],
    events: [],
    complete: false,
    events_error: null,
    hint_source: null,
    timing: { cache: "fresh" },
  };
}

function reportingHass(): FakeHass {
  const hass = makeHass(okDevices());
  const saved = new Map<string, { report_id: string; setup: string; text: string; done: boolean; updated: string }>();
  hass.callWS = <T,>(message: Record<string, unknown>) => {
    hass.sent.push(message);
    switch (message.type) {
      case "reolink_viewer/playback/check_report":
        saved.set(String(message.report_id), {
          report_id: String(message.report_id),
          setup: String(message.setup),
          text: String(message.text),
          done: Boolean(message.done),
          updated: "2026-10-17T12:00:00+00:00",
        });
        return Promise.resolve(null as T);
      case "reolink_viewer/playback/check_reports":
        return Promise.resolve({
          reports: [...saved.values()].map((r) => ({ ...r, id: r.report_id })),
        } as T);
      case "reolink_viewer/playback/media_info":
        return Promise.resolve({ sub: { codec: "avc1.640033", width: 640, height: 360, audio: null }, main: null } as T);
      case "reolink_viewer/timeline/day":
        return Promise.resolve(emptyDay() as T);
      default:
        return Promise.reject(new Error(`unexpected ${String(message.type)}`));
    }
  };
  return hass;
}

function stubTarget(hass: FakeHass): CheckTarget {
  return {
    hass,
    deviceId: "cam1",
    cameraName: "Garage",
    date: "2026-10-17",
    today: "2026-10-17",
    day: emptyDay(),
    loading: false,
    metrics: { timelineMs: 120, timelineServer: { cache: "memory", total_ms: 4 } },
    playFailure: undefined,
    hd: { main: false, reason: "this browser cannot decode hvc1 at 7680×2160" },
    progressive: true,
    mode: "file player (this browser has no MSE)",
    stream: "sub",
    setStream: () => undefined,
    monthDays: new Set<number>(),
    player: null,
    playing: undefined,
    timeline: null,
    scrubView: null,
    scrub: undefined,
    hover: undefined,
    openViewer: () => ({ playAt: () => Promise.resolve(undefined), position: undefined, source: undefined, close: () => undefined }),
    selectDate: () => undefined,
    playAt: () => Promise.resolve(),
  };
}

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

/**
 * A player on a recording (T0 + 1 h, an hour long), at T0 + 1 h 5 min; a
 * preview within 12 s of that is "buffered" and moves it there.
 */
function fakePlayer(): RvPlayer {
  const root = document.createElement("div");
  const video = document.createElement("video");
  video.className = "active";
  root.append(video);
  const item = { key: "k", recording: "sub:r1:0", segmentId: "r1", start: T0 + 3_600_000, end: T0 + 7_200_000 };
  let time = T0 + 3_900_000;
  return {
    renderRoot: root,
    current: item,
    get time() {
      return time;
    },
    preview(at: number) {
      if (Math.abs(at - T0 - 3_900_000) > 12_000) return false;
      time = at;
      setTimeout(() => video.dispatchEvent(new Event("seeked")), 1);
      return true;
    },
    resume: () => undefined,
    pause: () => undefined,
  } as unknown as RvPlayer;
}

describe("PlaybackCheck", () => {
  it("reports what it could measure and saves the report", async () => {
    const hass = reportingHass();
    const changes: number[] = [];
    const check = new PlaybackCheck(stubTarget(hass), { setup: "Desktop Chrome, LAN", soakMinutes: 0 }, () =>
      changes.push(1),
    );
    const report = await check.run();
    expect(report).toContain("Reolink Viewer playback check v0.9.1 · Desktop Chrome, LAN · Garage");
    expect(report).toContain("A1 Time to timeline, today (as the tab opened): 120 ms (server: memory, total 4 ms)");
    expect(report).toContain("A2/A3 skipped: no earlier recording day this month");
    expect(report).toContain("B  skipped: no events today");
    expect(report).toContain("D  skipped: no recording of 20 min or more");
    expect(report).toContain("C  skipped: no two touching recordings on 2026-10-17");
    expect(report).toContain("R  skipped: no recording on this day");
    expect(report).toContain("L  skipped: nothing played");
    expect(report).toContain("S  skipped: nothing playing");
    expect(report).toContain("K  SD skipped: nothing playing through MSE (the file player has no fragments to read)");
    expect(report).toContain("F  skipped: no recording on this day");
    expect(report).toContain("P  skipped: no timeline or recording on screen");
    expect(report).toContain("V  skipped: no recording on screen");
    // The device list could not be read here: the versions are said, not judged.
    expect(report).toContain(`Reolink Viewer: this page ${VERSION}, Home Assistant not read`);
    expect(report).toContain('H  skipped: not asked for (tick "with HD")');
    expect(report).toContain("HD as the tab opened: this browser cannot decode hvc1 at 7680×2160");
    expect(report).toContain("Summary:");
    expect(report).toContain("- Timeline: today 120 ms ✓");
    // In plain words first.
    expect(parseInShort(report)).toEqual({
      headline: "Garage's recordings play well on this device.",
      findings: [
        { grade: "good", text: "Today's recordings appear on the timeline in 0.1 s." },
        { grade: "note", text: "There were no events today to try opening." },
        { grade: "note", text: "HD is not offered on this device: this browser cannot decode hvc1 at 7680×2160." },
      ],
    });
    expect(check.inShort().headline).toBe("Garage's recordings play well on this device.");
    expect(changes.length).toBeGreaterThan(5);
    expect(check.running).toBe(false);
    const saves = hass.sent.filter((m) => m.type === "reolink_viewer/playback/check_report");
    expect(saves.at(-1)).toMatchObject({ report_id: check.id, setup: "Desktop Chrome, LAN", text: report, done: true });
    // Nothing is left marked as running.
    expect(window.localStorage.getItem("reolink-viewer-check-running")).toBeNull();
    expect(await noteInterruptedCheck(hass)).toBeUndefined();
  });

  it("asks again when today's event search failed, and says so, not \"no events today\" (v0.8.8)", async () => {
    // The owner's run just after a restart: the search the panel began as the tab opened, joined;
    // its event search failed, and B said "no events today" of a day with events.
    const timing = { cache: "fresh", files_ms: 6158, events_ms: 9263, total_ms: 938 };
    const failedDay: TimelineDay = { ...emptyDay(), events_error: "ReolinkError 1", timing };
    const run = async (answer: TimelineDay) => {
      const hass = reportingHass();
      const asked: Record<string, unknown>[] = [];
      const base = hass.callWS.bind(hass);
      hass.callWS = <T,>(message: Record<string, unknown>) => {
        if (message.type !== "reolink_viewer/timeline/day") return base<T>(message);
        asked.push(message);
        return Promise.resolve(answer as T);
      };
      const target = { ...stubTarget(hass), day: failedDay, metrics: { timelineMs: 948, timelineServer: timing } };
      const report = await new PlaybackCheck(target, { setup: "Desktop Chrome, LAN", soakMinutes: 0 }).run();
      return { report, asked };
    };
    // Failed again when asked: a problem, with the error.
    const still = await run({ ...emptyDay(), events_error: "ReolinkError 2" });
    expect(still.report).toContain(
      "A1 Time to timeline, today (as the tab opened): 948 ms (server: fresh, recordings 6158 ms, events 9263 ms, total 938 ms," +
        " joined a search already running) · event search failed (ReolinkError 1)",
    );
    expect(still.asked).toEqual([{ type: "reolink_viewer/timeline/day", device_id: "cam1", date: "2026-10-17" }]);
    expect(still.report).toContain(
      "B  skipped: today's event search failed (ReolinkError 1), and again when asked once more (ReolinkError 2)",
    );
    expect(still.report).not.toContain("no events today");
    expect(still.report).toContain("- Events: today's event search failed (ReolinkError 2)");
    expect(parseInShort(still.report)?.findings).toContainEqual({
      grade: "problem",
      text: "Today's events could not be listed: the camera's event search failed (ReolinkError 2), so the timeline shows no events for today.",
      advice: "The timeline searches again by itself; if today's events stay missing, run the check again and include the details below in a report.",
    });
    // Found when asked: said, and the day's events are what B goes by.
    const found = await run({ ...emptyDay(), timing: { cache: "fresh", search_ms: 2100, total_ms: 2104 } });
    expect(found.report).toContain(
      "B  today's event search had failed (ReolinkError 1); asked once more, it found 0 events (server: fresh, total 2104 ms)",
    );
    expect(found.report).toContain("B  skipped: no events today");
    expect(parseInShort(found.report)?.findings).toContainEqual({
      grade: "note",
      text: "Today's event search failed at first (ReolinkError 1); asked again, it found 0 events.",
    });
  });

  it("stops when asked", async () => {
    const hass = reportingHass();
    const target = { ...stubTarget(hass), day: undefined };
    const check = new PlaybackCheck(target, { setup: "Other", soakMinutes: 0 });
    const running = check.run();
    check.stop();
    const report = await running;
    expect(report).toContain("Stopped.");
  });

  it("notes a run that the page reload cut short", async () => {
    const hass = reportingHass();
    await hass.callWS({
      type: "reolink_viewer/playback/check_report",
      report_id: "run1",
      setup: "iPhone app, Wi-Fi (local)",
      text: "M  12 min: …",
      done: false,
    });
    window.localStorage.setItem(
      "reolink-viewer-check-running",
      JSON.stringify({
        id: "run1",
        setup: "iPhone app, Wi-Fi (local)",
        started: "2026-10-17T10:00:00Z",
        updated: "2026-10-17T10:13:00Z",
        minute: 12,
      }),
    );
    const note = await noteInterruptedCheck(hass);
    expect(note).toContain("stopped without finishing in minute 12 of the one-hour session");
    const last = hass.sent.at(-1);
    expect(last).toMatchObject({ report_id: "run1", done: true });
    expect(String(last?.text)).toContain("INTERRUPTED:");
    expect(window.localStorage.getItem("reolink-viewer-check-running")).toBeNull();
  });
});

describe("PlaybackCheck: deep starts", () => {
  it("checks SD on a tab left on HD, and does not call a start whose copy is still being made a failure", async () => {
    vi.spyOn(PlaybackCheck.prototype as unknown as { _pause: () => Promise<void> }, "_pause").mockResolvedValue();
    const hass = reportingHass();
    const base = hass.callWS.bind(hass);
    hass.callWS = <T,>(message: Record<string, unknown>) => {
      if (message.type === "reolink_viewer/playback/peek") {
        hass.sent.push(message);
        return Promise.resolve({ segment_id: "long", cache: null } as T);
      }
      return base<T>(message);
    };
    const day = { ...emptyDay(), segments: [{ id: "long", start: T0, end: T0 + 3_600_000, triggers: [], ambiguous: false }] };
    let stream: "sub" | "main" = "main";
    const streams: string[] = [];
    const metrics: Record<string, unknown> = { timelineMs: 120 };
    let playing: Record<string, unknown> | undefined;
    const target: CheckTarget = {
      ...stubTarget(hass),
      day,
      metrics,
      get stream() {
        return stream;
      },
      setStream: (next) => {
        stream = next;
        streams.push(next);
      },
      get playing() {
        return playing as CheckTarget["playing"];
      },
      playAt: () => {
        // Each start opens the recording, still being copied (2.3 GB in HD).
        playing = { cache: { complete: false, bytes: 900_000_000, error: null } };
        metrics.firstFrameMs = undefined;
        setTimeout(() => Object.assign(metrics, { firstFrameMs: 490, stream }), 5);
        return Promise.resolve();
      },
    };
    const report = await new PlaybackCheck(target, { setup: "Desktop Chrome, LAN", soakMinutes: 0 }).run();
    expect(streams).toEqual(["sub"]);
    expect(report).toContain("The tab was on HD: switched to SD for the check (H checks HD).");
    expect(report).toMatch(/D2 Still being copied when played \(not counted\), /);
    expect(parseInShort(report)?.findings).toContainEqual({
      grade: "fine",
      text: "Jumping into the middle of a long recording starts in 0.5 s (not judged: its copy was still being made).",
    });
  });
});

describe("PlaybackCheck: the link", () => {
  it("reads the MSE player's fragments from what is on disk, not the clip", async () => {
    vi.spyOn(PlaybackCheck.prototype as unknown as { _pause: () => Promise<void> }, "_pause").mockResolvedValue();
    const hass = reportingHass();
    const asked: string[] = [];
    hass.fetchWithAuth = (path: string) => {
      asked.push(path);
      return Promise.resolve(new Response(new Uint8Array(2_000_000), { status: 200 }));
    };
    const playing = { base: "/api/reolink_viewer/mse/tok1", clip_url: "/clip/x", cache: { complete: false, bytes: 1, error: null } };
    const target: CheckTarget = { ...stubTarget(hass), playing: playing as unknown as CheckTarget["playing"] };
    const report = await new PlaybackCheck(target, { setup: "Desktop Chrome, LAN", soakMinutes: 0 }).run();
    expect(asked).toEqual(["/api/reolink_viewer/mse/tok1/frags?first=0&ms=300000&bytes=33554432"]);
    expect(report).toMatch(/L {2}Link to Home Assistant: 2\.0 MB of fragments in \d+ ms after the answer = [\d.]+ Mbit\/s \(answer \d+ ms, HTTP 200\)/);
  });
});

describe("PlaybackCheck: scrubbing and HD", () => {
  it("previews points in the buffer and switches to HD and back at the same moment", async () => {
    // The check's waits are for real devices; here they pass at once.
    vi.spyOn(PlaybackCheck.prototype as unknown as { _pause: () => Promise<void> }, "_pause").mockResolvedValue();
    const hass = reportingHass();
    const player = fakePlayer();
    let stream: "sub" | "main" = "sub";
    const metrics: Record<string, unknown> = { timelineMs: 120 };
    const target: CheckTarget = {
      ...stubTarget(hass),
      hd: { main: true, reason: "hvc1.1.6.L153.B0 at 3840×2160 is supported" },
      metrics,
      player,
      get stream() {
        return stream;
      },
      setStream: (next) => {
        stream = next;
        metrics.firstFrameMs = undefined;
        setTimeout(() => {
          Object.assign(metrics, { stream: next, firstFrameMs: next === "main" ? 2840 : 210, codec: "hvc1.1.6.L153.B0" });
        }, 5);
      },
    };
    const report = await new PlaybackCheck(target, { setup: "Desktop Chrome, LAN", soakMinutes: 0, hd: true }).run();
    expect(report).toMatch(/S {2}Scrub preview \(frames from the buffer while dragging\): 4 of 5 points shown, median \d+ ms/);
    expect(report).toContain("not buffered: +15 s");
    expect(report).toContain("10.0 min ahead: not buffered (the thumbnail shows instead)");
    expect(report).toMatch(/H {2}HD at .*: first frame 2840 ms, started 0\.00 s from where SD was \(kept the moment\)/);
    expect(report).toMatch(/Back to SD at .*: first frame 210 ms, started 0\.00 s from where HD was/);
    expect(report).toContain("- HD switch: to HD 2840 ms, kept the moment (0.00 s); back to SD 210 ms, kept the moment (0.00 s)");
    expect(report).toMatch(/H {2}HD at .* · main hvc1\.1\.6\.L153\.B0 · /);
    // The tab's decision from before HD played is not the summary's word on HD.
    expect(report).toContain("HD as the tab opened: hvc1.1.6.L153.B0 at 3840×2160 is supported (played in H above)");
    expect(report).not.toContain("- HD: offered");
    expect(parseInShort(report)?.findings).toContainEqual({
      grade: "good",
      text: "Switching to HD takes 2.8 s and keeps your place; back to SD, 0.2 s.",
    });
    expect(parseInShort(report)?.findings).toContainEqual({
      grade: "fine",
      text: "Dragging along the timeline shows the video at 4 of 5 points; elsewhere a thumbnail shows instead.",
    });
    expect(stream).toBe("sub");
  });

  it("decodes the key frames of the recording playing, one at a time (Phase 10's gate)", async () => {
    vi.spyOn(PlaybackCheck.prototype as unknown as { _pause: () => Promise<void> }, "_pause").mockResolvedValue();
    const bytes = (base64: string) => Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const sample = MSE_SAMPLES.h264;
    const asked: string[] = [];
    const player = fakePlayer();
    const item = player.current as unknown as Record<string, unknown>;
    item.mse = {
      base: "/api/reolink_viewer/mse/tok1",
      durationMs: 3_600_000,
      fetch: (path: string) => {
        asked.push(path);
        const headers = { "X-RV-Mime": `video/mp4; codecs="${sample.codec}"`, "X-RV-Source": "cut" };
        if (path.includes("/init")) return Promise.resolve(new Response(bytes(sample.init), { headers }));
        const window = new Uint8Array([...bytes(sample.normalized), ...bytes(sample.mdat)]);
        return Promise.resolve(new Response(window, { headers }));
      },
    };
    const target = { ...stubTarget(reportingHass()), player };
    // No WebCodecs here: said so.
    let report = await new PlaybackCheck(target, { setup: "Desktop Chrome, LAN", soakMinutes: 0 }).run();
    expect(asked).toEqual([
      // From the play position, where S's previews left it (5 min 8 s in).
      "/api/reolink_viewer/mse/tok1/frags?at=308000&ms=20000&bytes=8388608",
      // The init of the source that served the window.
      "/api/reolink_viewer/mse/tok1/init?source=cut",
    ]);
    expect(report).toContain(
      "K  SD avc1.42C00A 64×64: 1 key frame, 1 KB–1 KB (median 1 KB) · VideoDecoder absent: a scrub would decode" +
        " through a hidden MSE video here · from the cut",
    );
    expect(report).toContain("- Key frames: SD: no VideoDecoder");
    // With WebCodecs: each decoded on its own.
    const decoded: unknown[] = [];
    class Decoder {
      static isConfigSupported = () => Promise.resolve({ supported: true });
      constructor(private readonly init: { output: (frame: unknown) => void }) {}
      configure(): void {
        // Nothing to set up.
      }
      decode(chunk: unknown): void {
        decoded.push(chunk);
        this.init.output({ displayWidth: 64, displayHeight: 64, close: () => undefined });
      }
      flush = () => Promise.resolve();
      close(): void {
        // Nothing held.
      }
    }
    vi.stubGlobal("VideoDecoder", Decoder);
    // As WebCodecs' chunk: its type, time and data.
    vi.stubGlobal("EncodedVideoChunk", Object);
    try {
      report = await new PlaybackCheck(target, { setup: "Desktop Chrome, LAN", soakMinutes: 0 }).run();
    } finally {
      vi.unstubAllGlobals();
    }
    expect(decoded).toHaveLength(1);
    expect(report).toMatch(/K {2}SD avc1\.42C00A 64×64: 1 key frame, .* · VideoDecoder: one in \d+\.\d ms \(median of 1\)/);
    expect(report).toMatch(/gate 30 ms: (passes|fails) · from the cut/);
  });

  it("asks the server for pictures over the day, twice (Phase 10 step 1)", async () => {
    vi.spyOn(PlaybackCheck.prototype as unknown as { _pause: () => Promise<void> }, "_pause").mockResolvedValue();
    const bytes = (base64: string) => Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const sample = MSE_SAMPLES.h264;
    const fragment = new Uint8Array([...bytes(sample.normalized), ...bytes(sample.mdat)]);
    const init = bytes(sample.init);
    const opened: string[] = [];
    const asked: number[] = [];
    // The server: the first pass from the device (one moment between
    // recordings), the second from its store.
    class Socket {
      binaryType = "blob";
      readyState = 0;
      onopen: ((e: unknown) => void) | null = null;
      onmessage: ((e: { data: unknown }) => void) | null = null;
      onclose: ((e: unknown) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      constructor(url: string) {
        opened.push(url);
        setTimeout(() => {
          this.readyState = 1;
          this.onopen?.({});
        }, 1);
      }
      send(text: string): void {
        const { seq, at } = JSON.parse(text) as { seq: number; at: number };
        asked.push(at);
        const second = asked.length > 10;
        setTimeout(() => {
          if (!second && asked.length === 2) {
            this.onmessage?.({ data: JSON.stringify({ seq, at, error: "no recording at that moment" }) });
            return;
          }
          const header = new TextEncoder().encode(
            JSON.stringify({
              seq,
              at,
              time: at - 1000,
              source: second ? "store" : "device",
              kind: "fmp4",
              codec: sample.codec,
              init: init.length,
              data: fragment.length,
            }),
          );
          const out = new Uint8Array(4 + header.length + init.length + fragment.length);
          new DataView(out.buffer).setUint32(0, header.length);
          out.set(header, 4);
          out.set(init, 4 + header.length);
          out.set(fragment, 4 + header.length + init.length);
          this.onmessage?.({ data: out.buffer });
        }, 1);
      }
      close(): void {
        this.readyState = 3;
      }
    }
    vi.stubGlobal("WebSocket", Socket);
    const day = emptyDay();
    day.segments = [
      { id: "a", start: T0, end: T0 + 3_000_000, triggers: [], ambiguous: false },
      { id: "b", start: T0 + 5_000_000, end: T0 + 6_000_000, triggers: [], ambiguous: false },
    ];
    const hass = reportingHass();
    const fallback = hass.callWS.bind(hass);
    hass.callWS = <T,>(message: Record<string, unknown>) =>
      message.type === "reolink_viewer/playback/scrub"
        ? Promise.resolve({ url: "/api/reolink_viewer/scrub/tok?authSig=x", expires_in: 600 } as T)
        : fallback<T>(message);
    const check = new PlaybackCheck({ ...stubTarget(hass), day }, { setup: "Desktop Chrome, LAN", soakMinutes: 0 });
    try {
      await (check as unknown as { _serverPictures(): Promise<void> })._serverPictures();
    } finally {
      vi.unstubAllGlobals();
    }
    const report = check.text + "\n- " + (check as unknown as { _summary: string[] })._summary.join("\n- ");
    expect(opened).toHaveLength(1);
    expect(opened[0]).toMatch(/^ws:\/\/.*\/api\/reolink_viewer\/scrub\/tok\?authSig=x$/);
    // Ten moments over the 4000 s of recordings, asked twice.
    expect(asked).toHaveLength(20);
    expect(asked.slice(0, 3)).toEqual([T0 + 200_000, T0 + 600_000, T0 + 1_000_000]);
    expect(asked.slice(10)).toEqual(asked.slice(0, 10));
    expect(report).toMatch(
      /F {2}Pictures from the server \(scrub, 10 moments over the day\): first 9 of 10, median \d+ ms \(device 9\) · none for 1: no recording at that moment · again 10 of 10, median \d+ ms \(store 10\) · each 1\.0 to 1\.0 s before its moment · VideoDecoder absent/,
    );
    expect(report).toMatch(/- Pictures from the server: first 9 of 10, median \d+ ms \(device 9\)/);
  });

  it("says in plain words when going back from HD to SD fails, with the video's state", async () => {
    vi.spyOn(PlaybackCheck.prototype as unknown as { _pause: () => Promise<void> }, "_pause").mockResolvedValue();
    const hass = reportingHass();
    const player = fakePlayer();
    let stream: "sub" | "main" = "sub";
    let failure: string | undefined;
    const metrics: Record<string, unknown> = { timelineMs: 120 };
    const target: CheckTarget = {
      ...stubTarget(hass),
      hd: { main: true, reason: "avc1.640033 at 2560×1440 is supported" },
      metrics,
      player,
      get stream() {
        return stream;
      },
      get playFailure() {
        return failure;
      },
      setStream: (next) => {
        stream = next;
        metrics.firstFrameMs = undefined;
        setTimeout(() => {
          // As Safari did (v0.61.1, the owner's Mac): HD plays, SD again fails.
          if (next === "sub") failure = "media error 4";
          else Object.assign(metrics, { stream: next, firstFrameMs: 744, codec: "avc1.640033" });
        }, 5);
      },
    };
    const report = await new PlaybackCheck(target, { setup: "Desktop Safari, LAN", soakMinutes: 0, hd: true }).run();
    expect(report).toMatch(/Back to SD at .*: FAILED: media error 4 \(back on the sub stream\)/);
    expect(report).toMatch(/ {5}video: at 0\.0 s of NaN s, ready state 0, network 0, paused, buffered \[nothing\] · not through MSE/);
    expect(parseInShort(report)?.findings).toContainEqual(
      expect.objectContaining({
        grade: "problem",
        text: "Going back from HD to SD failed (media error 4).",
      }),
    );
  });

  it("reports an HD failure, and skips HD where it is not offered", async () => {
    vi.spyOn(PlaybackCheck.prototype as unknown as { _pause: () => Promise<void> }, "_pause").mockResolvedValue();
    const hass = reportingHass();
    const metrics: Record<string, unknown> = { timelineMs: 120 };
    const target: CheckTarget = {
      ...stubTarget(hass),
      hd: { main: true, reason: "not tried yet" },
      metrics,
      player: fakePlayer(),
      setStream: () => {
        setTimeout(() => Object.assign(metrics, { hdFailures: 1, lastHdFailure: "MEDIA_ERR_DECODE" }), 5);
      },
    };
    const report = await new PlaybackCheck(target, { setup: "iPhone app, Wi-Fi (local)", soakMinutes: 0, hd: true }).run();
    expect(report).toContain("FAILED: MEDIA_ERR_DECODE (back on the sub stream)");
    expect(parseInShort(report)?.headline).toBe("1 problem found with Garage's recordings on this device.");
    expect(parseInShort(report)?.findings).toContainEqual({
      grade: "problem",
      text: "HD did not play; the viewer went back to SD.",
      advice: "SD still works. Include the details below if you report it.",
    });
    const off = await new PlaybackCheck({ ...stubTarget(reportingHass()), player: fakePlayer() }, {
      setup: "Other",
      soakMinutes: 0,
      hd: true,
    }).run();
    expect(off).toContain("H  skipped: HD not offered (this browser cannot decode hvc1 at 7680×2160)");
  });

  it("runs HD by default except on remote setups", () => {
    expect(hdByDefault("Desktop Chrome, LAN")).toBe(true);
    expect(hdByDefault("iPhone app, Wi-Fi (local)")).toBe(true);
    expect(hdByDefault("iPhone app, Tailscale")).toBe(false);
    expect(hdByDefault("Desktop Chrome, Nabu Casa")).toBe(false);
  });
});

describe("PlaybackCheck: starts that waited for the recorder", () => {
  /** A day with one hour-long recording (T0 + 1 h) and a MOTION event 55 min into it. */
  function longDay(): TimelineDay {
    const start = T0 + 3_600_000;
    return {
      ...emptyDay(),
      segments: [{ id: "long", start, end: start + 3_600_000, triggers: ["MOTION"], ambiguous: false }],
      events: [{ start: start + 3_300_000, end: start + 3_310_000, types: ["MOTION"], segment: "long", ambiguous: false }],
    };
  }

  /** Each start opens the recording as the next of `held` says the server had it (then whole). */
  async function run(held: { complete: boolean; bytes: number; firstMs?: number }[], stats?: unknown): Promise<string> {
    vi.spyOn(PlaybackCheck.prototype as unknown as { _pause: () => Promise<void> }, "_pause").mockResolvedValue();
    const hass = reportingHass();
    const answer = hass.callWS.bind(hass);
    hass.callWS = <T,>(message: Record<string, unknown>) =>
      message.type === "reolink_viewer/playback/peek"
        ? Promise.resolve({ segment_id: String(message.segment_id), cache: null } as T)
        : message.type === "reolink_viewer/playback/stats" && stats !== undefined
          ? Promise.resolve(stats as T)
          : answer<T>(message);
    const metrics: Record<string, unknown> = { timelineMs: 120 };
    let playing: CheckTarget["playing"];
    const target: CheckTarget = {
      ...stubTarget(hass),
      day: longDay(),
      metrics,
      get playing() {
        return playing;
      },
      playAt: () => {
        const cache = held.shift() ?? { complete: true, bytes: 1 };
        metrics.firstFrameMs = undefined;
        playing = { cache: { ...cache, error: null } } as CheckTarget["playing"];
        setTimeout(() => (metrics.firstFrameMs = cache.firstMs ?? (cache.complete ? 70 : 2250)), 1);
        return Promise.resolve();
      },
    };
    return new PlaybackCheck(target, { setup: "Desktop Chrome, LAN", soakMinutes: 0 }).run();
  }

  it("marks an event start that waited, and counts only a deep start that waited", async () => {
    // B waited; D1's recording was fetched (a prefetch) between choosing and playing it.
    const report = await run([
      { complete: false, bytes: 0 },
      { complete: true, bytes: 178_800_000 },
      { complete: true, bytes: 178_800_000 },
    ]);
    expect(report).toContain("- Events → first frame (sub): 2250 ms ✗ (not cached)");
    expect(report).toContain("D1 Not cached when chosen, but on disk when played (not counted), 55.0 min into a 60.0 min recording");
    expect(report).toContain("D2 Cached, ");
    expect(report).toContain("- Deep start (sub, 60.0 min recording): not cached not measured, cached 70 ms ✓");
  });

  it("says on a start's own line that Home Assistant was held up during it (v0.63.2)", async () => {
    const report = await run([{ complete: true, bytes: 1 }], {
      vod: { filling: 0 },
      loop: { held_10s_ms: 900, held_60s_ms: 900, period_ms: 250 },
    });
    expect(report).toMatch(/^B {2}MOTION at .*: first frame 70 ms .* · HOME ASSISTANT HELD UP 900 ms$/m);
    // The note names the rows whose starts found it held (a row's own start line is not always printed: v0.63.3).
    expect(report).toMatch(/Home Assistant itself was busy during starts in rows B, D(, [A-Z]+)*: its event loop was held up to 0\.9 s, so it answered late\./);
  });

  /** Home Assistant held up during each start (it just ended), by whose code. */
  const heldBy = (by: string) => ({
    vod: { filling: 0 },
    loop: {
      held_10s_ms: 1083,
      held_10s_count: 2,
      held_10s_total_ms: 2150,
      held_60s_ms: 1292,
      period_ms: 250,
      held_by: [
        {
          ago_s: 0.1,
          seen_ms: 1083,
          by,
          where: ["site-packages/jinja2/lexer.py:706 in tokeniter", "custom_components/spook/template_extraction.py:195 in _lexed"],
        },
      ],
    },
  });

  it("says a start another integration held Home Assistant up during, and does not fail it (v0.63.5)", async () => {
    // The owner's run of v0.63.4: a cached jump of 2.5 s, its server work 2 ms, Spook's template scan holding the loop.
    const slow = { complete: true, bytes: 1, firstMs: 2457 };
    const report = await run([slow, slow, slow], heldBy("custom_components/spook"));
    // Who, on the start's own line and its Home Assistant line, with the holds counted and added up.
    expect(report).toMatch(/^B {2}MOTION at .*: first frame 2457 ms .* · HOME ASSISTANT HELD UP 1083 ms \(by the Spook integration\)$/m);
    expect(report).toContain("     Home Assistant: its event loop held up to 1083 ms in the last 10 s (2 holds, 2150 ms in all)");
    expect(report).toContain(
      "held by the Spook integration: site-packages/jinja2/lexer.py:706 in tokeniter ← custom_components/spook/template_extraction.py:195 in _lexed",
    );
    // Said, not failed.
    expect(report).toContain("- Events → first frame (sub): 2457 ms (slowed by the Spook integration)");
    expect(report).toContain("cached 2457 ms (slowed by the Spook integration)");
    expect(report).not.toContain("2457 ms ✗");
    const findings = report.split("\n");
    expect(findings).toContain(
      "- Note: Opening an event starts its video in 2.5 s, but the Spook integration held Home Assistant up meanwhile (not judged).",
    );
    expect(findings).toContain(
      "- Note: Jumping into the middle of a long recording starts in 2.5 s, but the Spook integration held Home Assistant up 1.1 s meanwhile (not judged).",
    );
    expect(report).toMatch(
      /- Note: Home Assistant itself was busy during starts in rows B, D[^:]*: its event loop was held up to 1\.1 s, by the Spook integration, not Reolink Viewer \(site-packages\/jinja2\/lexer\.py:706 in tokeniter ← custom_components\/spook\/template_extraction\.py:195 in _lexed\), so it answered late\./,
    );
  });

  it("names the thread that ran while Home Assistant's loop waited, or the computer (v0.63.9)", async () => {
    const slow = { complete: true, bytes: 1, firstMs: 2457 };
    const radarr = heldBy("homeassistant/components/radarr");
    Object.assign(radarr.loop.held_by[0], { thread: "SyncWorker_3" });
    const report = await run([slow, slow, slow], radarr);
    expect(report).toContain("held by Home Assistant's Radarr integration, in another thread (SyncWorker_3): ");
    expect(report).toContain("(slowed by Home Assistant's Radarr integration, in another thread (SyncWorker_3))");
    const system = await run([slow, slow, slow], heldBy("system"));
    expect(system).toContain("held by the computer Home Assistant runs on (none of its threads was running): ");
    expect(system).toContain("2457 ms (slowed by the computer Home Assistant runs on (none of its threads was running))");
  });

  it("fails a slow start Reolink Viewer itself held Home Assistant up during (v0.63.5)", async () => {
    const slow = { complete: true, bytes: 1, firstMs: 2457 };
    const report = await run([slow, slow, slow], heldBy("custom_components/reolink_viewer"));
    expect(report).toContain("- Events → first frame (sub): 2457 ms ✗");
    expect(report).toContain("cached 2457 ms ✗");
    expect(report).toMatch(/- Problem: Home Assistant itself was busy during starts in rows B, D[^:]*: its event loop was held up to 1\.1 s, by Reolink Viewer itself \(/);
  });

  it("judges a start under its budget as ever, Home Assistant held up or not (v0.63.5)", async () => {
    const report = await run([{ complete: true, bytes: 1 }], heldBy("custom_components/spook"));
    expect(report).toContain("- Events → first frame (sub): 70 ms ✓");
    expect(report).toContain("cached 70 ms ✓");
  });

  it("says a row that fails, and runs the rest (v0.63.2: a lost connection ended the check)", async () => {
    // Home Assistant's connection gave up on a command: the result, its error inside.
    vi.spyOn(PlaybackCheck.prototype as unknown as { _drag: () => Promise<void> }, "_drag").mockRejectedValue({
      type: "result",
      success: false,
      error: { code: 3, message: "Connection lost" },
    });
    const report = await run([{ complete: true, bytes: 1 }]);
    expect(report).toContain("P  FAILED: Connection lost");
    expect(report).not.toContain("[object Object]");
    // The rows after it ran, and the report ends as ever.
    expect(report).toMatch(/^V {2}/m);
    expect(report).toContain("Summary:");
    expect(report).toContain("- Problem: The check's P row could not finish: Connection lost.");
  });

  it("counts a deep start that waited, with what was fetched already", async () => {
    const report = await run([
      { complete: true, bytes: 1 },
      { complete: false, bytes: 12_000_000 },
      { complete: true, bytes: 178_800_000 },
    ]);
    expect(report).toContain("- Events → first frame (sub): 70 ms ✓");
    expect(report).toContain("D1 Not cached (12.0 MB already fetched when played), 55.0 min into a 60.0 min recording");
    expect(report).toContain("- Deep start (sub, 60.0 min recording): not cached 2250 ms, cached 70 ms ✓");
  });
});

describe("a release that showed no first frame (v0.63.6)", () => {
  /** The tab's player as the check sees it: a paused video at 368 s, fed through ManagedMediaSource. */
  function stuckPlayer(answer: string | undefined, refusedAt?: number, time?: number): RvPlayer {
    const video = document.createElement("video");
    Object.defineProperty(video, "currentTime", { value: 368 });
    return {
      time,
      lastRefusal: refusedAt === undefined ? undefined : { name: "NotAllowedError", text: "NotAllowedError: not allowed", at: refusedAt },
      mseStats: { api: "ManagedMediaSource", windows: 1, bytes: 300_000, source: "file", fetching: false, ahead: 2.9, streaming: false },
      renderRoot: { querySelector: () => video },
      tryPlay: () => Promise.resolve(answer),
    } as unknown as RvPlayer;
  }

  /** Let go at T0 + 368 s. */
  async function stuck(player: RvPlayer, began: number) {
    const check = new PlaybackCheck(stubTarget(reportingHass()), { setup: "Mac Safari, LAN", soakMinutes: 0 }) as unknown as {
      _releaseStuck(player: RvPlayer, began: number, at: number): Promise<{ text: string; plain: string; detail: string[] }>;
    };
    return check._releaseStuck(player, began, T0 + 368_000);
  }

  it("says what the video was doing, and that pressing play started it: the browser held it back", async () => {
    const began = performance.now();
    const result = await stuck(stuckPlayer(undefined, began + 5, T0 + 368_000), began);
    expect(result.text).toBe("no first frame in 20 s");
    expect(result.detail[0]).toMatch(/^then: under 0\.1 s before where it was let go; video: at 368\.0 s of .*paused.* · MSE \(ManagedMediaSource\): 1 windows, 0\.3 MB, from the file, not fetching, 2\.9 s ahead, the browser asked to pause fetching; its play\(\) was refused: NotAllowedError: not allowed$/);
    expect(result.detail[1]).toMatch(/^pressing play then: it played after /);
    expect(result.plain).toBe("Letting go did not start the video until play was pressed: the browser held it back.");
  });

  it("says when it waited for video it did not get", async () => {
    const began = performance.now();
    // A refusal from before the release is not this one's.
    // Still on the recording before: far from where it was let go.
    const result = await stuck(stuckPlayer("no answer", began - 60_000, T0 - 3_600_000), began);
    expect(result.detail[0]).toMatch(/^then: 66\.1 min before where it was let go; /);
    expect(result.detail[0]).not.toContain("refused");
    expect(result.detail[1]).toBe("pressing play then: still nothing after 5 s (it waits for video)");
    expect(result.plain).toBe("Letting go did not start the video: it waited for video it did not get, and pressing play did not help.");
  });

  it("says when the browser refused to play it", async () => {
    const result = await stuck(stuckPlayer("NotAllowedError: not allowed"), performance.now());
    expect(result.detail[1]).toBe("pressing play then: refused (NotAllowedError: not allowed)");
    expect(result.plain).toBe("Letting go did not start the video: the browser refused to play it (NotAllowedError: not allowed).");
  });
});

describe("the month's recording days", () => {
  it("are asked of the server once a run, not taken from the tab's list alone (v0.9.1)", async () => {
    // The tablet: today shown at once, the tab's month list not come yet.
    const hass = reportingHass();
    const asked: Record<string, unknown>[] = [];
    const base = hass.callWS.bind(hass);
    hass.callWS = <T,>(message: Record<string, unknown>) => {
      if (message.type !== "reolink_viewer/timeline/days") return base<T>(message);
      asked.push(message);
      return Promise.resolve({ days: [9, 10, 12], timing: {} } as T);
    };
    const check = new PlaybackCheck({ ...stubTarget(hass), monthDays: new Set<number>() }, { setup: "test", soakMinutes: 0 }) as unknown as {
      _recordingDays(): Promise<ReadonlySet<number>>;
    };
    expect([...(await check._recordingDays())]).toEqual([9, 10, 12]);
    expect([...(await check._recordingDays())]).toEqual([9, 10, 12]);
    expect(asked).toEqual([{ type: "reolink_viewer/timeline/days", device_id: "cam1", year: 2026, month: 10 }]);
    // The server cannot say: the tab's list.
    const offline = new PlaybackCheck({ ...stubTarget(reportingHass()), monthDays: new Set([3]) }, { setup: "test", soakMinutes: 0 }) as unknown as typeof check;
    expect([...(await offline._recordingDays())]).toEqual([3]);
  });
});

describe("the rates' recording", () => {
  it("takes one long enough for every rate, from an earlier day when today has none (v0.9.0)", async () => {
    // The tablet at 6:27 AM: today one 40 s recording; the 16th a 3.7 min one.
    const seg = (start: number, ms: number) => ({ id: String(start), start, end: start + ms, triggers: [], ambiguous: false });
    const today = { ...emptyDay(), segments: [seg(T0 + 3_600_000, 40_000)] };
    const earlier = { ...emptyDay(), date: "2026-10-16", now: T0, segments: [seg(T0 - 50_000_000, 222_000), seg(T0 - 40_000_000, 60_000)] };
    const hass = reportingHass();
    const asked: string[] = [];
    const base = hass.callWS.bind(hass);
    hass.callWS = <T,>(message: Record<string, unknown>) => {
      if (message.type !== "reolink_viewer/timeline/day") return base<T>(message);
      asked.push(String(message.date));
      return Promise.resolve((message.date === "2026-10-16" ? earlier : today) as T);
    };
    const target = { ...stubTarget(hass), day: today, monthDays: new Set([16]) };
    const check = new PlaybackCheck(target, { setup: "test", soakMinutes: 0 }) as unknown as {
      _rateRecording(): Promise<{ date: string; segment: { start: number; end: number } } | undefined>;
    };
    const found = await check._rateRecording();
    expect(found?.date).toBe("2026-10-16");
    expect(found?.segment.end).toBe(T0 - 50_000_000 + 222_000);
    expect(asked).toEqual(["2026-10-16"]);
    // Today long enough: today's, asked of no one.
    const long = { ...today, segments: [seg(T0 + 3_600_000, 180_000)] };
    const own = new PlaybackCheck({ ...target, day: long }, { setup: "test", soakMinutes: 0 }) as unknown as typeof check;
    expect((await own._rateRecording())?.date).toBe("2026-10-17");
  });
});

describe("the drag beside a second viewer", () => {
  it("says why the viewer did not start, and leaves the row to go on (v0.63.2)", async () => {
    const hass = reportingHass();
    const target: CheckTarget = {
      ...stubTarget(hass),
      openViewer: () => ({
        // As Home Assistant's connection rejects a command it gave up on: not an Error.
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- the shape under test
        playAt: () => Promise.reject({ type: "result", success: false, error: { code: 3, message: "Connection lost" } }),
        position: undefined,
        source: undefined,
        close: () => undefined,
      }),
    };
    const check = new PlaybackCheck(target, { setup: "test", soakMinutes: 0 }) as unknown as {
      _dragBeside(other: { start: number; end: number }, from: number, spanMs: number): Promise<unknown>;
      _besideText(beside: unknown, s: undefined): string;
    };
    const beside = await check._dragBeside({ start: T0, end: T0 + 3_600_000 }, T0, 30_000);
    expect(check._besideText(beside, undefined)).toMatch(
      /^beside another viewer: it did not start, playing the \d{1,2}:00:00 [AP]M recording, 60\.0 min long \(Connection lost\)$/,
    );
  });

  it("names the recording, and what the server did where it did not start (v0.8.9: 27.5 s on the owner's iPhone)", async () => {
    const hass = reportingHass();
    const base = hass.callWS.bind(hass);
    const asked: string[] = [];
    hass.callWS = <T,>(message: Record<string, unknown>) => {
      if (message.type !== "reolink_viewer/playback/cache_status") return base<T>(message);
      asked.push(String(message.token));
      return Promise.resolve({
        cache: { cache: "fill", priority: "playback", wait_ms: 0, headers_ms: 25_000, fill_ms: 27_000, bytes: 2_000_000, complete: true },
      } as T);
    };
    const target: CheckTarget = {
      ...stubTarget(hass),
      openViewer: () => ({
        // No first frame in time.
        playAt: () => Promise.resolve(undefined),
        position: undefined,
        source: "file",
        url: "/api/reolink_viewer/mse/tok123?authSig=x",
        close: () => undefined,
      }),
    };
    const check = new PlaybackCheck(target, { setup: "test", soakMinutes: 0 }) as unknown as {
      _dragBeside(other: { start: number; end: number }, from: number, spanMs: number): Promise<{ server?: string }>;
      _besideText(beside: unknown, s: undefined): string;
    };
    const beside = await check._dragBeside({ start: T0, end: T0 + 84_000 }, T0, 30_000);
    expect(asked).toEqual(["tok123"]);
    expect(beside.server).toBe("server: fill (playback), queue 0 ms, NVR headers 25000 ms, download 27000 ms, 2.0 MB");
    expect(check._besideText(beside, undefined)).toMatch(
      /^beside another viewer: it did not start, playing the \d{1,2}:00:00 [AP]M recording, 1\.4 min long, from the recording's download$/,
    );
  });
});

describe("the request lines", () => {
  it("give the server's own time beside each answer where the browser has it (v0.62.2)", () => {
    const base = "https://ha.example/api/reolink_viewer/mse/tok";
    const entry = (name: string, start: number, serverTiming?: { name: string; duration: number }[]) => ({
      name,
      initiatorType: "fetch",
      startTime: start,
      requestStart: start + 1,
      responseStart: start + 1939,
      responseEnd: start + 1940,
      encodedBodySize: 0,
      nextHopProtocol: "h2",
      serverTiming,
    });
    vi.spyOn(performance, "getEntriesByType").mockReturnValue([
      entry(`${base}/init?at=1`, 100, [{ name: "rv", duration: 612.4 }]),
      // A browser without serverTiming (or a plain-HTTP page) says nothing more.
      entry(`${base}/frags?at=1`, 2100),
    ] as unknown as PerformanceEntryList);
    expect(requestReport(0, base)).toBe(
      "requests (h2): 2 sent: #1 +100 ms: wait 1 · answer 1938 (server 612) · ran 1 ms | #2 +2100 ms: wait 1 · answer 1938 · ran 1 ms",
    );
  });
});


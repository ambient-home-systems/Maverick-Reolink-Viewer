import { describe, expect, it, vi } from "vitest";

import type { Segment, TimelineEvent } from "../types";
import {
  DRAG_INTERVAL_MS,
  browserLabel,
  bufferedSeconds,
  caughtUp,
  checkSetup,
  classifyHost,
  cutReport,
  deepTarget,
  describeDrag,
  describeRate,
  deviceSetup,
  heldByName,
  heldByUs,
  holdsDuring,
  isMacSafari,
  loginReport,
  longRecordings,
  mb,
  frameStep,
  rateFindings,
  referenceFps,
  restInside,
  sampleStalls,
  setupMismatch,
  slope,
  smooth,
  sourceLabel,
  span,
  summarizeDrag,
  touchingPairs,
  within,
  type DragPass,
  type RateSample,
} from "./check-util";

const MIN = 60_000;
const seg = (id: string, start: number, minutes: number): Segment => ({
  id,
  start,
  end: start + minutes * MIN,
  triggers: [],
  ambiguous: false,
});
const ev = (start: number): TimelineEvent => ({ start, end: start + 5000, types: ["PERSON"], segment: null, ambiguous: false });

describe("classifyHost", () => {
  it("tells local, Tailscale, Nabu Casa and other remote access apart", () => {
    expect(classifyHost("homeassistant.local")).toBe("local");
    expect(classifyHost("homeassistant")).toBe("local");
    expect(classifyHost("192.168.1.20")).toBe("local");
    expect(classifyHost("172.20.0.5")).toBe("local");
    expect(classifyHost("10.0.0.2")).toBe("local");
    expect(classifyHost("100.101.102.103")).toBe("Tailscale");
    expect(classifyHost("ha.tail1234.ts.net")).toBe("Tailscale");
    expect(classifyHost("abcdef123.ui.nabu.casa")).toBe("Nabu Casa");
    expect(classifyHost("ha.example.com")).toBe("own domain");
    expect(classifyHost("8.8.8.8")).toBe("remote");
  });
});

describe("browserLabel", () => {
  it("names the iOS app, Safari and desktop browsers", () => {
    expect(
      browserLabel(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Home Assistant/2025.10.1 (io.robbie.HomeAssistant; build:2025.1234; iOS 18.1.0)",
      ),
    ).toBe("iOS 18.1, Companion app 2025.10.1");
    expect(
      browserLabel(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
      ),
    ).toBe("iOS 17.4, Safari");
    // Since iOS 26 WebKit's part says 18.x; the app's part has the real version.
    expect(
      browserLabel(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Home Assistant/2026.10.1 (io.robbie.HomeAssistant; build:2026.3213; iOS 27.0.0) Mobile/HomeAssistant, like Safari",
      ),
    ).toBe("iOS 27.0, Companion app 2026.10.1");
    expect(
      browserLabel(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
      ),
    ).toBe("Chrome 141 (macOS)");
    expect(browserLabel("Mozilla/5.0 (Windows NT 10.0) Chrome/141.0 Safari/537.36 Edg/141.0")).toBe("Edge 141 (Windows)");
    expect(browserLabel("Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0")).toBe("Firefox 140 (Linux)");
    expect(browserLabel("something")).toBe("unknown browser (?)");
  });
});

describe("setups", () => {
  const IPHONE_APP =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Home Assistant/2026.10.1 (io.robbie.HomeAssistant; build:2026.3213; iOS 27.0.0) Mobile/HomeAssistant, like Safari";
  const MAC_CHROME =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36";

  it("starts on this device's setup", () => {
    expect(deviceSetup(IPHONE_APP)).toBe("iPhone app, Wi-Fi (local)");
    expect(deviceSetup(MAC_CHROME)).toBe("Desktop Chrome, LAN");
  });

  it("notices a setup naming another device", () => {
    expect(setupMismatch("iPhone app, Tailscale", MAC_CHROME)).toBe(true);
    expect(setupMismatch("Desktop Chrome, LAN", IPHONE_APP)).toBe(true);
    expect(setupMismatch("iPhone app, Nabu Casa", IPHONE_APP)).toBe(false);
    expect(setupMismatch("Desktop Chrome, Tailscale", MAC_CHROME)).toBe(false);
    expect(setupMismatch("Other", IPHONE_APP)).toBe(false);
  });

  it("knows Safari on a Mac from Chrome there (v0.63.6)", () => {
    // The owner's Safari run of v0.63.5, as "Desktop Chrome, LAN": there was no Safari setup.
    const MAC_SAFARI =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5.2 Safari/605.1.15";
    expect(isMacSafari(MAC_SAFARI)).toBe(true);
    expect(isMacSafari(MAC_CHROME)).toBe(false);
    expect(isMacSafari(IPHONE_APP)).toBe(false);
    expect(checkSetup(MAC_SAFARI)).toBe("Mac Safari, LAN");
    expect(checkSetup(MAC_CHROME)).toBe("Desktop Chrome, LAN");
    expect(checkSetup(IPHONE_APP)).toBe("iPhone app, Wi-Fi (local)");
    expect(setupMismatch("Mac Safari, Nabu Casa", MAC_SAFARI)).toBe(false);
    expect(setupMismatch("Mac Safari, LAN", MAC_CHROME)).toBe(true);
  });
});

describe("recording choices", () => {
  it("finds long finished recordings, newest first", () => {
    const now = 10 * 60 * MIN;
    const segments = [seg("a", 0, 60), seg("b", 60 * MIN, 5), seg("c", 2 * 60 * MIN, 30), seg("live", now - 25 * MIN, 25)];
    expect(longRecordings(segments, now).map((s) => s.id)).toEqual(["c", "a"]);
  });

  it("aims at the latest event in a stretch, else at a point", () => {
    const s = seg("a", 0, 60);
    const events = [ev(10 * MIN), ev(40 * MIN), ev(50 * MIN)];
    expect(deepTarget(s, events, 0.5, 0.95, 0.75)).toEqual({ time: 50 * MIN, event: events[2] });
    expect(deepTarget(s, [], 0.5, 0.95, 0.75)).toEqual({ time: 45 * MIN, event: undefined });
  });

  it("pairs touching recordings, shortest first", () => {
    const segments = [seg("a", 0, 60), seg("b", 60 * MIN, 2), seg("c", 62 * MIN + 1000, 3), seg("d", 80 * MIN, 1)];
    expect(touchingPairs(segments).map(([x, y]) => `${x.id}${y.id}`)).toEqual(["bc", "ab"]);
  });
});

describe("rates and sums", () => {
  const sample = (over: Partial<RateSample>): RateSample => ({
    rate: 2,
    applied: 2,
    wallMs: 6000,
    mediaS: 12,
    painted: 300,
    maxGapMs: 45,
    decoded: 300,
    dropped: 0,
    stalls: 0,
    stalledMs: 0,
    ended: false,
    focused: true,
    ...over,
  });

  it("says rates measured with the page behind as not measured, never as a stutter", () => {
    // The owner's Mac (v0.61.1): 2× to 8× with the window behind played nothing.
    const behind = (rate: number) => sample({ rate, mediaS: 0, painted: 0, decoded: 0, focused: false });
    expect(rateFindings([sample({ rate: 0.5, mediaS: 3 }), sample({ rate: 1, mediaS: 6 }), behind(2), behind(4), behind(8)])).toEqual([
      { grade: "good", text: "Slow motion and fast forward (0.5× to 1×) play smoothly." },
      {
        grade: "note",
        text: "Playback at 2×, 4×, 8× was not measured: the page was not in front.",
        advice: "Keep the page in front, and the screen on, while the check runs.",
      },
    ]);
    expect(rateFindings([sample({ dropped: 10 })])).toEqual([{ grade: "slow", text: "Playback stutters at 2× speed." }]);
    expect(rateFindings([])).toEqual([]);
  });

  it("describes a rate and judges smoothness", () => {
    expect(describeRate(sample({}))).toBe(
      "  2×: 2.00× effective, 50 fps painted of 50, longest frame gap 45 ms, dropped 0 of 300 frames (0.0 %), 0 stalls",
    );
    expect(smooth(sample({}))).toBe(true);
    expect(smooth(sample({ dropped: 10 }))).toBe(false);
    // One frame of a short sample is not a trend.
    expect(smooth(sample({ rate: 0.5, mediaS: 3, decoded: 46, dropped: 1, painted: 45, maxGapMs: 200 }))).toBe(true);
    expect(smooth(sample({ rate: 0.5, mediaS: 3, decoded: 46, dropped: 2, painted: 44, maxGapMs: 200 }))).toBe(false);
    expect(smooth(sample({ mediaS: 8 }))).toBe(false);
    expect(smooth(sample({ stalls: 1, stalledMs: 300 }))).toBe(false);
    expect(smooth(sample({ stalls: 1, stalledMs: 1 }))).toBe(true);
    expect(describeRate(sample({ focused: false }))).toContain("PAGE NOT IN FRONT");
    expect(smooth(sample({ maxGapMs: 400 }))).toBe(false);
    // 8× of 25 fps is 200 fps: a 60 Hz display drops most, and that is fine.
    const fast = sample({ rate: 8, mediaS: 48, decoded: 1200, dropped: 700, painted: 360, maxGapMs: 34 });
    expect(smooth(fast)).toBe(true);
    expect(smooth({ ...fast, maxGapMs: 300 })).toBe(false);
    // Chrome on macOS: every frame counted dropped, every frame painted.
    const mac = sample({ rate: 1, wallMs: 6000, mediaS: 6, decoded: 90, dropped: 90, painted: 90, maxGapMs: 70 });
    expect(smooth(mac)).toBe(true);
    expect(describeRate(mac)).toContain("disagrees");
    // Frames missed: fewer painted, and a gap of more than a frame (v0.8.9: a gap of one frame is none skipped).
    expect(smooth({ ...mac, painted: 70, maxGapMs: 200 })).toBe(false);
    // WebKit: the counter lags (60 counted, 90 painted).
    expect(smooth(sample({ rate: 1, wallMs: 6000, mediaS: 6, decoded: 60, dropped: 0, painted: 90, maxGapMs: 100 }))).toBe(true);
    // A browser drawing in software: the counters agree, and they count.
    expect(smooth(sample({ rate: 1, wallMs: 6000, mediaS: 6, decoded: 90, dropped: 9, painted: 81, maxGapMs: 120 }))).toBe(false);
    const clamped = describeRate(sample({ rate: 8, applied: 2, painted: undefined, maxGapMs: undefined, ended: true }));
    expect(clamped).toContain("browser set 2×");
    expect(clamped).toContain("the file ended");
    expect(clamped).not.toContain("painted");
  });

  it("judges 0.5× by the frame rate at 1× where WebKit's counter disagrees (v0.8.9: the owner's iPhone)", () => {
    // 0.5×: 7 frames a second painted, each one frame apart (136 ms); WebKit counted 96 for the 45 there were.
    const half = sample({ rate: 0.5, applied: 0.5, mediaS: 3, decoded: 96, dropped: 0, painted: 44, maxGapMs: 136, frameS: 1 / 15 });
    // 1×: its counter agrees with the frames painted (94 and 90): the reference is its count.
    const one = sample({ rate: 1, applied: 1, mediaS: 6, decoded: 94, dropped: 0, painted: 90, maxGapMs: 103, frameS: 1 / 15 });
    // By the counter alone, as v0.8.8 judged it: a stutter.
    expect(smooth(half)).toBe(false);
    const reference = referenceFps([half, one]);
    expect(reference).toBeCloseTo(94 / 6);
    expect(smooth(half, reference)).toBe(true);
    expect(describeRate(half, reference)).toBe(
      "0.5×: 0.50× effective, 7.3 fps painted of 7.8, longest frame gap 136 ms, dropped 0 of 96 frames (0.0 %), 0 stalls," +
        " the dropped-frame counter disagrees with the frames painted: judged by those",
    );
    expect(rateFindings([half, one])).toEqual([{ grade: "good", text: "Slow motion and fast forward (0.5× to 1×) play smoothly." }]);
    // A real stutter at 0.5×: frames skipped and fewer painted.
    expect(smooth({ ...half, painted: 30, maxGapMs: 270 }, reference)).toBe(false);
    // Fewer counted at the edges, but none skipped (no gap of two frames): smooth.
    expect(smooth({ ...half, painted: 39, maxGapMs: 140 }, reference)).toBe(true);
    // 1×'s counter lagging (WebKit: 60 counted, 90 painted): the frames painted, a frame apart.
    expect(referenceFps([half, { ...one, decoded: 60 }])).toBeCloseTo(15);
    // No 1× pass, one not in front, or one that ran out of recording: the counter, as before.
    expect(referenceFps([half])).toBeUndefined();
    expect(referenceFps([half, { ...one, focused: false }])).toBeUndefined();
    expect(referenceFps([half, { ...one, ended: true }])).toBeUndefined();
    // Where the counter agrees, it counts.
    expect(smooth(sample({ rate: 1, mediaS: 6, decoded: 90, dropped: 9, painted: 81, maxGapMs: 120 }), reference)).toBe(false);
  });

  it("takes the 1× frame rate from the counter when it agrees (v0.9.0: the tablet's median step read 17 fps for 15)", () => {
    // The tablet's 1×: 2 of 90 dropped, 84 painted (the counter agrees), the median step 1/17 s.
    const one = sample({ rate: 1, applied: 1, mediaS: 6, decoded: 90, dropped: 2, painted: 84, maxGapMs: 134, frameS: 1 / 17 });
    expect(referenceFps([one])).toBeCloseTo(15);
    // Its 2×: 24 of 30 painted, the counter disagreeing: a stutter, against 30 (not 34).
    const two = sample({ rate: 2, applied: 2, mediaS: 12, decoded: 181, dropped: 0, painted: 144, maxGapMs: 100 });
    expect(describeRate(two, referenceFps([one]))).toContain("24 fps painted of 30");
  });

  it("gives the frame interval from the steps between painted frames, without the skipped ones", () => {
    // A camera whose frame times vary: the mean, not the median.
    expect(frameStep([0.05, 0.083, 0.05, 0.083, 0.05, 0.083, 0.0665])).toBeCloseTo(0.0665, 3);
    // A skipped frame (two frames' step) is left out.
    expect(frameStep([0.0667, 0.0667, 0.1333, 0.0667])).toBeCloseTo(0.0667, 4);
    expect(frameStep([])).toBeUndefined();
  });

  it("says a rate whose recording ran out was not measured, never a stutter (v0.9.0: the tablet's 4×)", () => {
    const ran = sample({ rate: 4, applied: 4, mediaS: 11, wallMs: 6000, painted: 120, decoded: 159, dropped: 24, ended: true });
    expect(rateFindings([sample({ rate: 2, applied: 2 }), ran])).toEqual([
      { grade: "good", text: "Slow motion and fast forward (2× to 2×) play smoothly." },
      {
        grade: "note",
        text: "Playback at 4× was not measured: the recording ran out.",
        advice: "Run the check later in the day, when the camera has a recording of 2 minutes or more.",
      },
    ]);
  });

  it("fits a slope and sums buffered ranges", () => {
    expect(
      slope([
        [0, 10],
        [1, 12],
        [2, 14],
      ]),
    ).toBeCloseTo(2);
    expect(slope([[0, 1]])).toBeUndefined();
    expect(
      slope([
        [1, 1],
        [1, 2],
      ]),
    ).toBeUndefined();
    const ranges = { length: 2, start: (i: number) => [0, 10][i] ?? 0, end: (i: number) => [5, 12][i] ?? 0 };
    expect(bufferedSeconds(ranges)).toBe(7);
  });

  it("formats spans and budgets", () => {
    expect(span(45_000)).toBe("45 s");
    expect(span(12.5 * MIN)).toBe("12.5 min");
    expect(within(900, 1000)).toBe("900 ms ✓");
    expect(within(1200, 1000)).toBe("1200 ms ✗");
    expect(within(undefined, 1000)).toBe("not measured");
    expect(mb(2_500_000)).toBe("2.5 MB");
    expect(mb(8_589_934_592)).toBe("8.59 GB");
    expect(mb(undefined)).toBe("–");
  });
});

describe("Phase 5b reports", () => {
  it("names the source, describes a cut and the logins", () => {
    expect(sourceLabel("cut")).toBe("the Reolink protocol cut");
    expect(sourceLabel("file")).toBe("the recording's download");
    expect(sourceLabel(undefined)).toBe("?");
    expect(
      cutReport({
        first_fragment_ms: 412.6,
        slot_ms: 0.4,
        login: "new",
        login_ms: 180,
        reply_ms: 151,
        fragments: 12,
        bytes: 3_400_000,
        complete: true,
        mbit_s: 92.5,
        mux: { anchor: "key frame time", counter_rate: 1_000_000, rate_learned: true },
      }),
    ).toBe(
      "Reolink protocol cut: first fragment 413 ms, slot 0 ms, login (an extra user) 180 ms, reply 151 ms, 12 fragments, 3.4 MB, 92.5 Mbit/s, complete, placed by key frame time, counter 1000000/s (learned)",
    );
    expect(cutReport({ login: "shared", running: true })).toBe(
      "Reolink protocol cut: login shared, 0 fragments, 0.0 MB, running",
    );
    expect(cutReport({ error: "no stream slot within 5 s (7 of 7 in use)", mux: {} })).toBe(
      "Reolink protocol cut: 0 fragments, 0.0 MB, error no stream slot within 5 s (7 of 7 in use), placed by ?, counter ?/s",
    );
    expect(cutReport({})).toBe("Reolink protocol cut: 0 fragments, 0.0 MB, stopped");
    // Phase 5c: no slot was free, so it took its recording's download's.
    expect(cutReport({ slot_ms: 35, borrowed: 1, complete: true })).toBe(
      "Reolink protocol cut: slot 35 ms (the download's), 0 fragments, 0.0 MB, complete",
    );
    // Phase 5c: it paused for another viewer's new cut of the camera.
    expect(cutReport({ gave_way: 2, complete: true })).toBe(
      "Reolink protocol cut: gave way to another viewer 2×, 0 fragments, 0.0 MB, complete",
    );
    // Phase 5c: the camera's rate kept from an earlier cut, and the muxer's time.
    expect(
      cutReport({ complete: true, mux_ms: 41.6, mux: { anchor: "key frame time", counter_rate: 999_790, rate_source: "stored" } }),
    ).toBe("Reolink protocol cut: 0 fragments, 0.0 MB, complete, placed by key frame time, counter 999790/s (stored), mux 42 ms");
    // v0.63.1: the cut before's last blocks, skipped at the start.
    expect(cutReport({ complete: true, mux: { anchor: "key frame time", counter_rate: 999_790, foreign_skipped: 9 } })).toBe(
      "Reolink protocol cut: 0 fragments, 0.0 MB, complete, placed by key frame time, counter 999790/s, 9 blocks of another cut skipped",
    );
    expect(loginReport(undefined)).toBe("Reolink protocol: no statistics");
    expect(
      loginReport({
        enabled: true,
        logged_in: 0,
        logins: 1,
        logouts: 1,
        cuts_running: 0,
        unsupported: ["connection refused (its port for the protocol is closed)"],
      }),
    ).toBe(
      "Reolink protocol: 0 host(s) logged in now, 1 logins, 1 logouts, 0 cuts running; not supported by 1 device(s): connection refused (its port for the protocol is closed)",
    );
    expect(loginReport({ enabled: false, logged_in: 0, logins: 0, logouts: 0, cuts_running: 0 })).toBe(
      "Reolink protocol: off (turned off in the options)",
    );
    expect(loginReport({ enabled: true, logged_in: 1, logins: 2, logouts: 1, cuts_running: 1 })).toBe(
      "Reolink protocol: 1 host(s) logged in now, 2 logins, 1 logouts, 1 cuts running",
    );
  });
});

describe("the P row: pictures while dragging", () => {
  const paint = (wall: number, pointer: number, at: number, time: number, source = "device", interval = 1000) => ({
    wall,
    pointer,
    at,
    time,
    source,
    interval,
  });

  it("times the pictures of a drag: how often, how near their moment, how far behind the pointer", () => {
    const pass: DragPass = {
      movedMs: 1000,
      rest: 10_000,
      asked: 5,
      missed: 1,
      paints: [
        paint(300, 3000, 2900, 2500),
        paint(600, 6000, 5800, 5200, "store"),
        paint(850, 8500, 8400, 7500),
        // After the pointer stopped: the catch-up.
        paint(1300, 10_000, 10_000, 9600),
      ],
    };
    const s = summarizeDrag(pass);
    expect(s).toMatchObject({ pictures: 4, firstMs: 300, gapMs: 250, onTime: 4, interval: 1000, sources: { device: 3, store: 1 } });
    expect(s.before).toEqual([0.4, 0.9]);
    expect(s.lagMs).toBe(800);
    expect(s.restMs).toBe(400);
    expect(caughtUp(s)).toBe(true);
    expect(describeDrag(s, pass)).toBe(
      "4 pictures, the first after 0.30 s, a new one every 0.25 s (median), 4 of 4 within the camera's 1.0 s of their moment" +
        " (0.4 to 0.9 s before), 0.8 s behind the moving pointer; at rest, 0.4 s from the pointer · device 3, store 1 · 1 of 5 asked missed",
    );
  });

  it("counts a picture too far before its moment as not on time, and a far last picture as not caught up", () => {
    const pass: DragPass = { movedMs: 500, rest: 20_000, asked: 2, missed: 0, paints: [paint(200, 5000, 5000, 2000)] };
    const s = summarizeDrag(pass);
    expect(s.onTime).toBe(0);
    expect(s.gapMs).toBeUndefined();
    expect(caughtUp(s)).toBe(false);
    // Without the camera's interval from the server: 4 s.
    expect(summarizeDrag({ ...pass, paints: [{ wall: 1, pointer: 1, at: 5000, time: 2000, source: "cache" }] }).interval).toBe(
      DRAG_INTERVAL_MS,
    );
  });

  it("says a drag that showed nothing, with the last answer", () => {
    const pass: DragPass = { movedMs: 500, rest: 0, asked: 3, missed: 3, lastMiss: "no picture from the device: busy", paints: [] };
    expect(describeDrag(summarizeDrag(pass), pass)).toBe("no picture in 3 asked (3 missed, last: no picture from the device: busy)");
    // v0.63.9: pictures came, and the browser could not show them (MSE): why.
    const shown = { ...pass, missed: 0, paintFailure: "the picture was refused (video error 4)" };
    expect(describeDrag(summarizeDrag(shown), shown)).toBe(
      "no picture in 3 asked; they could not be shown: the picture was refused (video error 4)",
    );
  });

  it("rests a drag's pointer inside a recording", () => {
    const segments = [
      { start: 0, end: 60_000 },
      { start: 120_000, end: 180_000 },
    ];
    expect(restInside(segments, 10_000, 50_000)).toBe(50_000);
    // Past the first recording, in the gap: just before its end.
    expect(restInside(segments, 10_000, 100_000)).toBe(58_000);
    expect(restInside(segments, 10_000, 150_000)).toBe(150_000);
    // Past the last: just before its end.
    expect(restInside(segments, 130_000, 400_000)).toBe(178_000);
  });

  it("samples a video's progress for its longest stall", () => {
    vi.useFakeTimers();
    try {
      let time = 10;
      const watch = sampleStalls(() => time, 250);
      for (let i = 0; i < 4; i += 1) {
        time += 0.25;
        vi.advanceTimersByTime(250);
      }
      // Stuck for a second.
      vi.advanceTimersByTime(1000);
      time += 0.5;
      vi.advanceTimersByTime(250);
      const played = watch.stop();
      expect(played.playedMs).toBe(1500);
      expect(played.longestStallMs).toBeGreaterThanOrEqual(1000);
      expect(played.longestStallMs).toBeLessThan(1500);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("whose code held Home Assistant (v0.63.5)", () => {
  it("names the integration in plain words", () => {
    expect(heldByName("custom_components/spook")).toBe("the Spook integration");
    expect(heldByName("custom_components/frigate_proxy")).toBe("the Frigate Proxy integration");
    expect(heldByName("homeassistant/components/recorder")).toBe("Home Assistant's Recorder integration");
    expect(heldByName("homeassistant")).toBe("Home Assistant's own code");
    // v0.63.9: its loop waited, and none of its threads ran.
    expect(heldByName("system")).toBe("the computer Home Assistant runs on (none of its threads was running)");
    expect(heldByName("custom_components/reolink_viewer")).toBe("Reolink Viewer itself");
    expect(heldByName(null)).toBeUndefined();
    expect(heldByName(undefined)).toBeUndefined();
    expect(heldByName("site-packages/jinja2")).toBeUndefined();
    expect(heldByUs("custom_components/reolink_viewer")).toBe(true);
    expect(heldByUs("custom_components/spook")).toBe(false);
  });

  it("counts the holds that touched a start, not those before or after it", () => {
    const hold = (ago: number, held: number) => ({ ago_s: ago, seen_ms: held, where: ["x.py:1 in f"] });
    // The start began 3 s ago and showed its first frame 0.5 s ago.
    const { totalMs, longest } = holdsDuring(
      [
        hold(1, 1100), // during it
        hold(2.5, 400), // during it
        hold(8, 1300), // over before it began
        hold(0.1, 300), // after its first frame: began 0.4 s ago, ended 0.1 s ago
      ],
      3,
      0.5,
    );
    expect(totalMs).toBe(1500);
    expect(longest?.seen_ms).toBe(1100);
    // A hold that began before the start and ended in it counts.
    expect(holdsDuring([hold(2.9, 2000)], 3, 0.5).totalMs).toBe(2000);
    expect(holdsDuring([], 3, 0.5)).toEqual({ totalMs: 0, longest: undefined });
  });
});

import { describe, expect, it } from "vitest";

import type { Segment, TimelineEvent } from "../types";
import {
  browserLabel,
  bufferedSeconds,
  classifyHost,
  cutReport,
  deepTarget,
  describeRate,
  deviceSetup,
  loginReport,
  longRecordings,
  mb,
  setupMismatch,
  slope,
  smooth,
  sourceLabel,
  span,
  touchingPairs,
  within,
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
    expect(smooth({ ...mac, painted: 70 })).toBe(false);
    // WebKit: the counter lags (60 counted, 90 painted).
    expect(smooth(sample({ rate: 1, wallMs: 6000, mediaS: 6, decoded: 60, dropped: 0, painted: 90, maxGapMs: 100 }))).toBe(true);
    // A browser drawing in software: the counters agree, and they count.
    expect(smooth(sample({ rate: 1, wallMs: 6000, mediaS: 6, decoded: 90, dropped: 9, painted: 81, maxGapMs: 120 }))).toBe(false);
    const clamped = describeRate(sample({ rate: 8, applied: 2, painted: undefined, maxGapMs: undefined, ended: true }));
    expect(clamped).toContain("browser set 2×");
    expect(clamped).toContain("the file ended");
    expect(clamped).not.toContain("painted");
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
    expect(loginReport(undefined)).toBe("Reolink protocol: no statistics");
    expect(loginReport({ enabled: false, logged_in: 0, logins: 0, logouts: 0, cuts_running: 0 })).toBe(
      "Reolink protocol: off (the option is not set)",
    );
    expect(loginReport({ enabled: true, logged_in: 1, logins: 2, logouts: 1, cuts_running: 1 })).toBe(
      "Reolink protocol: 1 host(s) logged in now, 2 logins, 1 logouts, 1 cuts running",
    );
  });
});

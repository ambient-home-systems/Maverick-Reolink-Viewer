import { describe, expect, it } from "vitest";

import type { Segment, TimelineEvent } from "../types";
import {
  browserLabel,
  bufferedSeconds,
  classifyHost,
  deepTarget,
  describeRate,
  longRecordings,
  mb,
  slope,
  smooth,
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
    expect(classifyHost("ha.example.com")).toBe("remote");
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
    ...over,
  });

  it("describes a rate and judges smoothness", () => {
    expect(describeRate(sample({}))).toBe(
      "  2×: 2.00× effective, 50 fps painted of 50, longest frame gap 45 ms, dropped 0 of 300 frames (0.0 %), 0 stalls",
    );
    expect(smooth(sample({}))).toBe(true);
    expect(smooth(sample({ dropped: 10 }))).toBe(false);
    expect(smooth(sample({ mediaS: 8 }))).toBe(false);
    expect(smooth(sample({ stalls: 1, stalledMs: 300 }))).toBe(false);
    expect(smooth(sample({ maxGapMs: 400 }))).toBe(false);
    // 8× of 25 fps is 200 fps: a 60 Hz display drops most, and that is fine.
    const fast = sample({ rate: 8, mediaS: 48, decoded: 1200, dropped: 700, painted: 360, maxGapMs: 34 });
    expect(smooth(fast)).toBe(true);
    expect(smooth({ ...fast, maxGapMs: 300 })).toBe(false);
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

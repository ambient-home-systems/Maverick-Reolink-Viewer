import { afterEach, describe, expect, it, vi } from "vitest";

import type { HomeAssistant } from "../types";
import { SOAK_REPORT_MS } from "./soak";
import { SoakTally, deviceLabel } from "./soak-tally";

afterEach(() => {
  vi.useRealTimers();
});

function setup(fail: () => boolean = () => false) {
  vi.useFakeTimers();
  let now = 1_000_000;
  const sent: Record<string, unknown>[] = [];
  const hass = {
    callWS: vi.fn((message: Record<string, unknown>) => {
      if (fail()) return Promise.reject(new Error("connection lost"));
      sent.push(message);
      return Promise.resolve({ started_at: 0 });
    }),
  } as unknown as HomeAssistant;
  const tally = new SoakTally(
    () => "Mac · Chrome",
    () => now,
  );
  const advance = async (ms: number) => {
    now += ms;
    await vi.advanceTimersByTimeAsync(ms);
  };
  return { tally, hass, sent, advance };
}

describe("SoakTally", () => {
  it("sends what the grid counted every minute while it is open", async () => {
    const { tally, hass, sent, advance } = setup();
    tally.opened(() => hass, true);
    expect(tally.open).toBe(true);
    tally.count("Garage", "plays");
    tally.count("Garage", "drops");
    tally.count("Door", "failures");
    await advance(SOAK_REPORT_MS);
    expect(sent).toEqual([
      {
        type: "reolink_viewer/live/soak/count",
        device: "Mac · Chrome",
        opens: 1,
        open_ms: SOAK_REPORT_MS,
        visible_ms: SOAK_REPORT_MS,
        tiles: [
          { camera: "Garage", plays: 1, drops: 1, failures: 0 },
          { camera: "Door", plays: 0, drops: 0, failures: 1 },
        ],
      },
    ]);
    // Hidden for half the next minute: open, not visible.
    await advance(SOAK_REPORT_MS / 2);
    tally.visibility(false);
    await advance(SOAK_REPORT_MS / 2);
    expect(sent.at(-1)).toEqual({
      type: "reolink_viewer/live/soak/count",
      device: "Mac · Chrome",
      opens: 0,
      open_ms: SOAK_REPORT_MS,
      visible_ms: SOAK_REPORT_MS / 2,
      tiles: [],
    });
    // Closed: the rest goes with a last flush, and nothing more is sent.
    await advance(1000);
    tally.closed();
    expect(tally.open).toBe(false);
    tally.visibility(true);
    await tally.flush(hass);
    expect(sent.at(-1)).toMatchObject({ opens: 0, open_ms: 1000, visible_ms: 0 });
    await advance(SOAK_REPORT_MS * 3);
    await tally.flush(hass);
    expect(sent).toHaveLength(3);
  });

  it("keeps what it could not send for the next send", async () => {
    let failing = true;
    const { tally, hass, sent, advance } = setup(() => failing);
    tally.opened(() => hass, false);
    tally.count("Garage", "plays");
    await advance(SOAK_REPORT_MS);
    tally.count("Garage", "plays");
    tally.count("Door", "drops");
    await advance(SOAK_REPORT_MS);
    expect(sent).toEqual([]);
    failing = false;
    await tally.flush(hass);
    expect(sent).toEqual([
      {
        type: "reolink_viewer/live/soak/count",
        device: "Mac · Chrome",
        opens: 1,
        open_ms: 2 * SOAK_REPORT_MS,
        visible_ms: 0,
        tiles: [
          { camera: "Garage", plays: 2, drops: 0, failures: 0 },
          { camera: "Door", plays: 0, drops: 1, failures: 0 },
        ],
      },
    ]);
  });

  it("drops what it counted when the run starts over, and opens again", async () => {
    const { tally, hass, sent, advance } = setup();
    tally.opened(() => hass, true);
    tally.count("Garage", "drops");
    await advance(1000);
    tally.discard();
    await advance(500);
    await tally.flush(hass);
    expect(sent).toEqual([
      expect.objectContaining({ opens: 0, open_ms: 500, visible_ms: 500, tiles: [] }),
    ]);
    // Opened again (Home Assistant attached the grid again): counted, one timer.
    tally.opened(() => hass, true);
    await advance(SOAK_REPORT_MS);
    expect(sent).toHaveLength(2);
    expect(sent.at(-1)).toMatchObject({ opens: 1 });
    // Nothing counted: nothing sent.
    tally.closed();
    await tally.flush(hass);
    await tally.flush(hass);
    expect(sent).toHaveLength(2);
  });
});

describe("deviceLabel", () => {
  it.each([
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
      "Mac · Chrome",
    ],
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15",
      "Mac · Safari",
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1",
      "iPhone · Safari",
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Home Assistant/2026.10 (io.robbie.HomeAssistant; build:2026.1; iOS 26.0.0)",
      "iPhone · Home Assistant app",
    ],
    [
      "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0 Mobile/15E148 Safari/604.1",
      "iPad · Chrome",
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0",
      "Windows · Edge",
    ],
    ["Mozilla/5.0 (X11; Linux x86_64; rv:144.0) Gecko/20100101 Firefox/144.0", "Linux · Firefox"],
    ["Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36", "Android · Chrome"],
    ["curl/8.0", "Browser"],
  ])("%s", (userAgent, label) => {
    expect(deviceLabel(userAgent)).toBe(label);
  });
});

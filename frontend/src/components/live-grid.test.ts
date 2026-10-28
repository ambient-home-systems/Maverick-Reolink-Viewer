import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PlayerOptions, PlayerState } from "../live/player";
import { formatClock } from "../playback/time";
import { fakePip } from "../test-fixtures";
import type { HomeAssistant, LiveCamera, LiveImagesEvent } from "../types";
import { routeFromHash, routeToHash, type Route } from "./navigation";

// Players that record what the tiles ask of them.
const players = vi.hoisted(
  () =>
    [] as {
      ref: { connectionId: string; stream: string };
      options: PlayerOptions;
      onCount(kind: "plays" | "drops" | "failures"): void;
      running: boolean;
      starts: number;
      retries: number;
      setState(state: PlayerState): void;
    }[],
);

vi.mock("../live/player", async () => {
  const actual = await vi.importActual<typeof import("../live/player")>("../live/player");
  class FakePlayer {
    running = false;
    starts = 0;
    retries = 0;
    events: { at: number; text: string }[] = [];
    onCount: (kind: "plays" | "drops" | "failures") => void = () => undefined;
    state: PlayerState = { kind: "idle" };
    constructor(
      _hass: unknown,
      _video: HTMLVideoElement,
      readonly ref: { connectionId: string; stream: string },
      readonly options: PlayerOptions,
      private readonly _onState: (state: PlayerState) => void,
    ) {
      players.push(this);
    }
    start(): void {
      this.running = true;
      this.starts += 1;
      this.setState({ kind: "starting", transport: this.options.warm ? "MSE" : "WebRTC" });
    }
    stop(): void {
      this.running = false;
      this.setState({ kind: "idle" });
    }
    retryNow(): void {
      this.retries += 1;
    }
    setState(state: PlayerState): void {
      this.state = state;
      this._onState(state);
    }
  }
  return { ...actual, LivePlayer: FakePlayer };
});

const { boardOrder, playingCount, tileFit, tileShape } = await import("./live-grid");
const { OFFSCREEN_GRACE_MS } = await import("./live-tile");

const encoding = { codec: "h264", frame_rate: 15, bit_rate: 512 };
const CAMERAS: LiveCamera[] = [
  {
    id: "cam1",
    name: "Garage",
    model: "RLC-520A",
    records: true,
    connections: [
      {
        connection_id: "direct1",
        via: "direct",
        entry_title: "Garage",
        is_battery: false,
        streams: { sub: { encoding, entity_id: null, warm: false } },
      },
      {
        connection_id: "nvr1",
        via: "nvr",
        entry_title: "RLN36",
        is_battery: false,
        status_entity: "camera.garage_fluent",
        // Not warm yet on the server: its switch, just turned on, says it will be.
        streams: { sub: { encoding, entity_id: null, warm: false }, main: { encoding, entity_id: null, warm: false } },
      },
    ],
    keep_warm_entity: "switch.garage_keep_live_view_warm",
    controls: { siren: "siren.garage_siren" },
  },
  {
    id: "cam2",
    name: "Doorbell",
    model: "Video Doorbell",
    records: false,
    connections: [
      {
        connection_id: "bell",
        via: "direct",
        entry_title: "Doorbell",
        is_battery: true,
        streams: { sub: { encoding, entity_id: null } },
      },
    ],
  },
  {
    // The E1 Zoom: records nowhere, so it is watched for its picture.
    id: "cam3",
    name: "Laundry Room",
    model: "E1 Zoom",
    records: false,
    connections: [
      {
        connection_id: "laundry",
        via: "direct",
        entry_title: "Laundry Room",
        is_battery: false,
        streams: { sub: { encoding, entity_id: null, warm: false } },
      },
    ],
  },
];

function fakeHass(fail = false) {
  const sent: Record<string, unknown>[] = [];
  const services: unknown[][] = [];
  let failService = false;
  let failSoak = false;
  let unsubscribed = 0;
  let images: ((event: LiveImagesEvent) => void) | undefined;
  const hass = {
    user: { is_admin: false },
    states: { "switch.garage_keep_live_view_warm": { state: "on" } },
    callService: vi.fn((...args: unknown[]) => {
      services.push(args);
      return failService ? Promise.reject(new Error("not allowed")) : Promise.resolve(undefined);
    }),
    callWS: vi.fn((message: Record<string, unknown>) => {
      sent.push(message);
      if (message.type === "reolink_viewer/live/cameras") {
        return fail ? Promise.reject(new Error("not loaded")) : Promise.resolve({ cameras: CAMERAS });
      }
      if (message.type === "web_rtc/ice_servers") return Promise.resolve([{ urls: ["stun:s"] }]);
      if (message.type === "reolink_viewer/live/state") {
        return Promise.resolve({ state: null, holds: 1, preloaded: false, cache: null });
      }
      if (message.type === "reolink_viewer/live/soak") {
        if (failSoak) return Promise.reject(new Error("not loaded"));
        const now = {
          at: Date.now(),
          go2rtc: { state: "running", restarts: 0, memory_kb: 40_960 },
          webrtc_sessions: 0,
          feeds: { feeds: 1, warm: 1, viewers: 1, ends: 0 },
          hosts: [{ name: "RLN36", streams: 1, limit: 7, waiting: 0, cpu: null }],
          battery: [],
        };
        const run = {
          started_at: Date.now() - 4 * 3_600_000,
          opens: 2,
          open_ms: 4 * 3_600_000,
          visible_ms: 3 * 3_600_000,
          tiles: { Garage: { plays: 2, drops: 0, failures: 0 } },
          devices: { "Mac · Chrome": Date.now() },
        };
        return Promise.resolve({ sample_s: 300, keep_s: 129_600, warmup_s: 300, started_at: 0, run, samples: [], now });
      }
      if (message.type === "reolink_viewer/live/soak/count") return Promise.resolve({ started_at: 0 });
      return Promise.resolve(null);
    }),
    connection: {
      subscribeMessage: vi.fn((callback: (event: LiveImagesEvent) => void, message: Record<string, unknown>) => {
        sent.push(message);
        images = callback;
        setTimeout(() => {
          callback({ images: { cam1: { url: "/api/reolink_viewer/live/image/t1?authSig=x", taken: 1 } } });
        }, 0);
        return Promise.resolve(() => {
          unsubscribed += 1;
          return Promise.resolve();
        });
      }),
    },
  } as unknown as HomeAssistant;
  return {
    hass,
    sent,
    services,
    failService: () => {
      failService = true;
    },
    failSoak: () => {
      failSoak = true;
    },
    unsubscribed: () => unsubscribed,
    image: (event: LiveImagesEvent) => images?.(event),
  };
}

const flush = async () => {
  for (let i = 0; i < 4; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

async function mountGrid(hass: HomeAssistant) {
  const el = document.createElement("rv-live-grid");
  el.hass = hass;
  document.body.appendChild(el);
  await flush();
  await el.updateComplete;
  const tiles = () => [...(el.shadowRoot?.querySelectorAll("rv-live-tile") ?? [])];
  for (const tile of tiles()) await tile.updateComplete;
  await flush();
  return { el, tiles };
}

const tileBox = (tile: Element) => {
  const box = tile.shadowRoot?.querySelector<HTMLElement>(".tile");
  if (!box) throw new Error("no tile");
  return box;
};

/** Tiles see themselves on screen (happy-dom's observer never calls back). */
const observers: { callback: (entries: { isIntersecting: boolean }[]) => void; target: Element | undefined }[] = [];
class FakeObserver {
  target: Element | undefined;
  constructor(readonly callback: (entries: { isIntersecting: boolean }[]) => void) {
    observers.push(this);
  }
  observe(target: Element): void {
    this.target = target;
    setTimeout(() => {
      this.callback([{ isIntersecting: true }]);
    }, 0);
  }
  disconnect(): void {
    return undefined;
  }
}

beforeEach(() => {
  players.length = 0;
  observers.length = 0;
  vi.stubGlobal("IntersectionObserver", FakeObserver);
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("rv-live-grid", () => {
  it("shows every camera's picture and plays it, through the NVR", async () => {
    const { hass, sent } = fakeHass();
    const { tiles } = await mountGrid(hass);
    expect(sent.map((m) => m.type)).toEqual(
      expect.arrayContaining(["reolink_viewer/live/images", "reolink_viewer/live/cameras", "web_rtc/ice_servers"]),
    );
    const garage = tiles().at(0);
    if (!garage) throw new Error("no tiles");
    expect(garage.shadowRoot?.querySelector("img")?.getAttribute("src")).toBe(
      "/api/reolink_viewer/live/image/t1?authSig=x",
    );
    expect(garage.shadowRoot?.textContent).toContain("Garage");
    // The NVR connection, kept warm (its switch is on): over MSE.
    const player = players.find((p) => p.ref.connectionId === "nvr1");
    expect(player?.ref).toEqual({ connectionId: "nvr1", stream: "sub" });
    expect(player?.starts).toBe(1);
    expect(player?.options.warm).toBe(true);
    expect(player?.options.iceServers).toEqual([{ urls: ["stun:s"] }]);
    // Playing: the video shows over the picture.
    player?.setState({ kind: "playing", transport: "MSE", result: { ok: true, steps: {} } });
    await garage.updateComplete;
    expect(tileBox(garage).classList.contains("playing")).toBe(true);
  });

  it("wakes a battery camera only when asked, and opens a camera", async () => {
    const { hass } = fakeHass();
    const { el, tiles } = await mountGrid(hass);
    const doorbell = tiles().at(1);
    if (!doorbell) throw new Error("no doorbell");
    const bell = () => players.find((p) => p.ref.connectionId === "bell");
    expect(bell()?.running ?? false).toBe(false);
    expect(doorbell.shadowRoot?.textContent).toContain("Asleep");
    expect(doorbell.shadowRoot?.textContent).toContain("Tap to wake it and watch");
    tileBox(doorbell).click();
    await doorbell.updateComplete;
    await flush();
    expect(bell()?.starts).toBe(1);
    expect(doorbell.shadowRoot?.textContent).not.toContain("Tap to wake");
    expect(doorbell.shadowRoot?.textContent).not.toContain("Asleep");

    const routes: Route[] = [];
    el.addEventListener("rv-navigate", (e) => routes.push((e as CustomEvent<Route>).detail));
    tileBox(doorbell).click();
    // The tile is a button for the keyboard and screen readers, named for what it does.
    const open = doorbell.shadowRoot?.querySelector<HTMLButtonElement>("button.open");
    expect(open?.getAttribute("aria-label")).toBe("Open Doorbell");
    expect(open?.getAttribute("aria-describedby")).toBe("state status");
    open?.click();
    expect(routes).toEqual([
      { view: "device", id: "cam2", tab: "live" },
      { view: "device", id: "cam2", tab: "live" },
    ]);
  });

  it("shows a camera that records nowhere as its picture until tapped", async () => {
    const fake = fakeHass();
    const { tiles } = await mountGrid(fake.hass);
    const laundry = tiles().at(2);
    if (!laundry) throw new Error("no laundry tile");
    const player = () => players.find((p) => p.ref.connectionId === "laundry");
    expect(player()?.running ?? false).toBe(false);
    const text = () => laundry.shadowRoot?.textContent ?? "";
    expect(text()).toContain("No picture yet");
    expect(text()).toContain("Tap to watch live");
    expect(text()).not.toContain("Asleep");
    // Its picture shows, with when it was taken.
    const taken = new Date(2026, 9, 22, 14, 5).getTime();
    fake.image({ images: { cam3: { url: "/api/reolink_viewer/live/image/t3?authSig=y", taken } } });
    await flush();
    await laundry.updateComplete;
    expect(laundry.shadowRoot?.querySelector("img")?.getAttribute("src")).toBe(
      "/api/reolink_viewer/live/image/t3?authSig=y",
    );
    expect(text()).toContain(`Picture ${formatClock(taken)}`);
    // A tap plays its video.
    tileBox(laundry).click();
    await laundry.updateComplete;
    await flush();
    expect(player()?.starts).toBe(1);
    expect(text()).not.toContain("Tap to watch live");
  });

  it("stops when the page is hidden or the tile scrolls away, and starts again", async () => {
    const { hass } = fakeHass();
    const { tiles } = await mountGrid(hass);
    const garage = tiles().at(0);
    if (!garage) throw new Error("no tile");
    const observed = (visible: boolean) => {
      observers.find((o) => o.target === garage)?.callback([{ isIntersecting: visible }]);
    };
    const player = () => players.find((p) => p.ref.connectionId === "nvr1");
    expect(player()?.running).toBe(true);

    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    await garage.updateComplete;
    expect(player()?.running).toBe(false);
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    await garage.updateComplete;
    expect(player()?.running).toBe(true);

    vi.useFakeTimers();
    observed(false);
    await garage.updateComplete;
    expect(player()?.running).toBe(true); // a quick scroll back keeps it
    vi.advanceTimersByTime(OFFSCREEN_GRACE_MS);
    expect(player()?.running).toBe(false);
    observed(true);
    await garage.updateComplete;
    expect(player()?.starts).toBe(3);
  });

  it("says why a stream cannot play, and retries when asked", async () => {
    const { hass } = fakeHass();
    const { tiles } = await mountGrid(hass);
    const garage = tiles().at(0);
    if (!garage) throw new Error("no tile");
    const player = players.find((p) => p.ref.connectionId === "nvr1");
    player?.setState({ kind: "waiting", error: "MSE: the server closed the stream", retryAt: Date.now() + 1000 });
    await garage.updateComplete;
    // In plain words, with what to do; the technical text is in its ⓘ view.
    expect(garage.shadowRoot?.querySelector(".status .what")?.textContent).toBe("The camera's video stopped.");
    expect(garage.shadowRoot?.textContent).toContain("It starts again by itself.");
    expect(garage.shadowRoot?.textContent).not.toContain("MSE:");
    garage.shadowRoot?.querySelector<HTMLButtonElement>(".status button")?.click();
    expect(player?.retries).toBe(1);
  });

  it("shows a camera Home Assistant cannot reach as offline, and plays it again when it is back", async () => {
    const { hass } = fakeHass();
    const states = hass.states as Record<string, unknown>;
    const since = new Date(Date.now() - 5 * 60_000);
    states["camera.garage_fluent"] = { state: "unavailable", last_changed: since.toISOString() };
    const { el, tiles } = await mountGrid(hass);
    const garage = tiles().at(0);
    if (!garage) throw new Error("no tile");
    const player = () => players.find((p) => p.ref.connectionId === "nvr1");
    expect(player()?.running ?? false).toBe(false);
    expect(garage.shadowRoot?.querySelector(".state")?.textContent).toContain("Offline");
    expect(garage.shadowRoot?.querySelector(".status .what")?.textContent).toBe(
      `Offline since ${formatClock(since.getTime(), undefined)}`,
    );
    expect(garage.shadowRoot?.textContent).toContain("Home Assistant cannot reach this camera.");
    expect(el.shadowRoot?.querySelector(".count")?.textContent).toContain("· 1 offline");
    // Back: it plays.
    const back = { ...hass, states: { ...hass.states, "camera.garage_fluent": { state: "streaming", last_changed: "" } } };
    el.hass = back as unknown as HomeAssistant;
    await el.updateComplete;
    for (const tile of tiles()) await tile.updateComplete;
    expect(player()?.running).toBe(true);
    expect(garage.shadowRoot?.textContent).not.toContain("Offline since");
    expect(el.shadowRoot?.querySelector(".count")?.textContent).not.toContain("offline");
  });

  it("shows what a tile plays, and how, behind its info button", async () => {
    const { hass, sent } = fakeHass();
    const { tiles } = await mountGrid(hass);
    const garage = tiles().at(0);
    if (!garage) throw new Error("no tile");
    const info = garage.shadowRoot?.querySelector<HTMLButtonElement>(".corner-button.info");
    if (!info) throw new Error("no info button");
    expect(garage.shadowRoot?.querySelector("rv-live-debug")).toBeNull();
    const routes: unknown[] = [];
    garage.addEventListener("rv-live-open", (e) => routes.push(e));
    info.click();
    await garage.updateComplete;
    await flush();
    expect(routes).toEqual([]); // it does not open the camera
    const debug = garage.shadowRoot?.querySelector("rv-live-debug");
    await debug?.updateComplete;
    const text = debug?.shadowRoot?.querySelector("pre")?.textContent ?? "";
    expect(text).toContain("Garage · through the NVR (RLN36)");
    expect(text).toContain("SD (sub, kept warm): starting over MSE");
    expect(text).toContain("server: not in go2rtc, held 1×");
    expect(text).not.toContain("Network:");
    expect(sent).toContainEqual({ type: "reolink_viewer/live/state", connection_id: "nvr1", stream: "sub" });
    // Its Close, or the info button again, hides it.
    [...(debug?.shadowRoot?.querySelectorAll("button") ?? [])].find((b) => b.textContent.trim() === "Close")?.click();
    await garage.updateComplete;
    expect(garage.shadowRoot?.querySelector("rv-live-debug")).toBeNull();
    info.click();
    await garage.updateComplete;
    info.click();
    await garage.updateComplete;
    expect(garage.shadowRoot?.querySelector("rv-live-debug")).toBeNull();
    // On a page whose network cut MSE twice, it says WebRTC goes first.
    const { pageCuts } = await import("../live/player");
    pageCuts.note(Date.now() - 60_000);
    pageCuts.note(Date.now());
    info.click();
    await garage.updateComplete;
    await flush();
    const again = garage.shadowRoot?.querySelector("rv-live-debug");
    await again?.updateComplete;
    expect(again?.shadowRoot?.querySelector("pre")?.textContent).toContain(
      "Network: it cut MSE's connections twice, so WebRTC goes first until",
    );
    pageCuts.giveUp();
  });

  it("plays again when a tile is attached again", async () => {
    const { hass } = fakeHass();
    const { tiles } = await mountGrid(hass);
    const garage = tiles().at(0);
    if (!garage) throw new Error("no tile");
    const player = () => players.find((p) => p.ref.connectionId === "nvr1");
    const parent = garage.parentNode;
    garage.remove();
    expect(player()?.running).toBe(false);
    await flush(); // its updates while detached are over
    parent?.appendChild(garage);
    await garage.updateComplete;
    await flush();
    expect(player()?.running).toBe(true);
  });

  it("stops everything when it goes away", async () => {
    const { hass, unsubscribed } = fakeHass();
    const { el } = await mountGrid(hass);
    expect(players.some((p) => p.running)).toBe(true);
    el.remove();
    await flush();
    expect(players.some((p) => p.running)).toBe(false);
    expect(unsubscribed()).toBe(1);
  });

  it("shows a load error and loads again on Try again", async () => {
    const failing = fakeHass(true);
    const { el } = await mountGrid(failing.hass);
    const banner = el.shadowRoot?.querySelector(".problem");
    expect(banner?.querySelector("strong")?.textContent).toBe("Live view could not load: Reolink Viewer is not running.");
    expect(banner?.querySelector("details")?.textContent).toContain("not loaded");
    expect(failing.unsubscribed()).toBe(1); // the pictures are not watched for nothing
    el.shadowRoot?.querySelector<HTMLButtonElement>(".banner button")?.click();
    await flush();
    expect(failing.sent.filter((m) => m.type === "reolink_viewer/live/cameras")).toHaveLength(2);
  });
});

describe("full screen", () => {
  type RvLiveTile = HTMLElementTagNameMap["rv-live-tile"];
  const fullButton = (tile: Element) => {
    const button = tile.shadowRoot?.querySelector<HTMLButtonElement>(".corner-button.full");
    if (!button) throw new Error("no full-screen button");
    return button;
  };
  const settle = async (tile: RvLiveTile) => {
    await flush();
    await tile.updateComplete;
    await flush();
    await tile.updateComplete;
  };

  async function garageAndBell() {
    const { hass } = fakeHass();
    const { tiles } = await mountGrid(hass);
    const garage = tiles().at(0);
    const doorbell = tiles().at(1);
    if (!garage || !doorbell) throw new Error("no tiles");
    return { garage, doorbell };
  }

  it("plays HD in the background and swaps it in on its first frame", async () => {
    const { garage, doorbell } = await garageAndBell();
    const sub = () => players.find((p) => p.ref.connectionId === "nvr1" && p.ref.stream === "sub");
    const hd = () => players.find((p) => p.ref.stream === "main");
    const bell = () => players.find((p) => p.ref.connectionId === "bell");
    // The doorbell is watched too (a tap), then the garage goes full screen.
    tileBox(doorbell).click();
    await settle(doorbell);
    expect(bell()?.running).toBe(true);
    fullButton(garage).click();
    await settle(garage);
    await settle(doorbell);
    expect(garage.full).toBe(true);
    expect(garage.hasAttribute("full")).toBe(true);
    // The main stream (H.264 here) starts cold, over WebRTC; the sub keeps playing.
    expect(hd()?.ref).toEqual({ connectionId: "nvr1", stream: "main" });
    expect(hd()?.options.warm).toBe(false);
    expect(hd()?.running).toBe(true);
    expect(sub()?.running).toBe(true);
    expect(garage.shadowRoot?.textContent).toContain("HD starting…");
    // The other tiles stop while it is full screen.
    expect(bell()?.running).toBe(false);
    // A click in full screen does not open the camera.
    const routes: unknown[] = [];
    garage.addEventListener("rv-live-open", (e) => routes.push(e));
    tileBox(garage).click();
    expect(routes).toEqual([]);

    // HD's first frame: it shows, and the sub stream stops.
    hd()?.setState({ kind: "playing", transport: "WebRTC", result: { ok: true, steps: {} } });
    await settle(garage);
    expect(tileBox(garage).classList.contains("hd-on")).toBe(true);
    expect(garage.hdShown).toBe(true);
    expect(sub()?.running).toBe(false);
    // At home: HD is on, and its button says so.
    expect(garage.shadowRoot?.querySelector(".hd-status .hd-toggle")?.getAttribute("aria-pressed")).toBe("true");
    expect(garage.shadowRoot?.querySelector(".hd-status .small")).toBeNull();

    // HD ends and starts again: the sub stream plays meanwhile.
    hd()?.setState({ kind: "starting", transport: "WebRTC" });
    await settle(garage);
    expect(sub()?.running).toBe(true);
    expect(tileBox(garage).classList.contains("hd-on")).toBe(false);

    // Back: HD stops, the sub stream plays, and so do the other tiles.
    fullButton(garage).click();
    await settle(garage);
    await settle(doorbell);
    expect(garage.full).toBe(false);
    expect(garage.hasAttribute("full")).toBe(false);
    expect(hd()?.running).toBe(false);
    expect(sub()?.running).toBe(true);
    expect(bell()?.running).toBe(true);
  });

  it("says why it stays in SD, and why HD cannot play", async () => {
    const { garage, doorbell } = await garageAndBell();
    // The doorbell has no main or ext stream here; full screen wakes it.
    fullButton(doorbell).click();
    await settle(doorbell);
    expect(players.find((p) => p.ref.connectionId === "bell")?.running).toBe(true);
    expect(doorbell.shadowRoot?.textContent).toContain("SD only: no main stream, and there is no ext stream");
    doorbell.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, composed: true }));
    await settle(doorbell);
    expect(doorbell.full).toBe(false);

    fullButton(garage).click();
    await settle(garage);
    const hd = players.find((p) => p.ref.stream === "main");
    hd?.setState({ kind: "waiting", error: "WebRTC: every stream slot of this host is in use", retryAt: Date.now() + 1000 });
    await settle(garage);
    expect(garage.shadowRoot?.textContent).toContain(
      "HD cannot play: Too many cameras are streaming from this recorder at once.",
    );
    expect(players.find((p) => p.ref.connectionId === "nvr1" && p.ref.stream === "sub")?.running).toBe(true);
    // Esc leaves full screen when it fills the window.
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await settle(garage);
    expect(garage.full).toBe(false);
    expect(hd?.running).toBe(false);
  });

  it("stays in the lighter SD away from home, with an HD button, and remembers the choice", async () => {
    localStorage.clear();
    Object.defineProperty(navigator, "connection", { value: { type: "cellular" }, configurable: true });
    try {
      const { garage } = await garageAndBell();
      const sub = () => players.find((p) => p.ref.connectionId === "nvr1" && p.ref.stream === "sub");
      const hd = () => players.find((p) => p.ref.stream === "main");
      const toggle = () => garage.shadowRoot?.querySelector<HTMLButtonElement>(".hd-toggle");
      const text = () => garage.shadowRoot?.querySelector(".hd-status")?.textContent ?? "";
      fullButton(garage).click();
      await settle(garage);
      expect(toggle()?.getAttribute("aria-pressed")).toBe("false");
      expect(text()).toContain("Lighter SD on mobile data. Tap HD for full quality.");
      expect(hd()?.running ?? false).toBe(false);
      expect(sub()?.running).toBe(true);
      // Tapped: HD starts, and is remembered for away from home.
      toggle()?.click();
      await settle(garage);
      expect(toggle()?.getAttribute("aria-pressed")).toBe("true");
      expect(hd()?.running).toBe(true);
      expect(text()).toContain("HD starting…");
      fullButton(garage).click();
      await settle(garage);
      fullButton(garage).click();
      await settle(garage);
      expect(hd()?.running).toBe(true);
      // Off again: HD stops, the sub stream plays, and that is remembered.
      hd()?.setState({ kind: "playing", transport: "WebRTC", result: { ok: true, steps: {} } });
      await settle(garage);
      expect(garage.hdShown).toBe(true);
      toggle()?.click();
      await settle(garage);
      expect(hd()?.running).toBe(false);
      expect(sub()?.running).toBe(true);
      expect(text()).toContain("SD, as chosen on this device. Tap HD for full quality.");
      expect(JSON.parse(localStorage.getItem("reolink-viewer.full-screen-hd") ?? "{}")).toEqual({ away: false });
      fullButton(garage).click();
      await settle(garage);
      // At home, HD as before: the choice away is its own.
      Reflect.deleteProperty(navigator, "connection");
      fullButton(garage).click();
      await settle(garage);
      expect(toggle()?.getAttribute("aria-pressed")).toBe("true");
    } finally {
      Reflect.deleteProperty(navigator, "connection");
      localStorage.clear();
    }
  });

  it("uses the browser's full screen where it has one, and follows it", async () => {
    const { garage } = await garageAndBell();
    let element: Element | null = null;
    Object.defineProperty(document, "fullscreenEnabled", { value: true, configurable: true });
    Object.defineProperty(document, "fullscreenElement", { get: () => element, configurable: true });
    const exitFullscreen = vi.fn(() => {
      element = null;
      return Promise.resolve();
    });
    Object.defineProperty(document, "exitFullscreen", { value: exitFullscreen, configurable: true });
    const requestFullscreen = vi.fn(() => {
      element = garage;
      return Promise.resolve();
    });
    garage.requestFullscreen = requestFullscreen;
    try {
      fullButton(garage).click();
      await settle(garage);
      expect(requestFullscreen).toHaveBeenCalledTimes(1);
      // Esc is the browser's then: the tile follows when it leaves.
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      expect(garage.full).toBe(true);
      element = null;
      document.dispatchEvent(new Event("fullscreenchange"));
      await settle(garage);
      expect(garage.full).toBe(false);
      expect(exitFullscreen).not.toHaveBeenCalled();

      // Its own button leaves the browser's full screen too.
      fullButton(garage).click();
      await settle(garage);
      fullButton(garage).click();
      await settle(garage);
      expect(exitFullscreen).toHaveBeenCalledTimes(1);
      expect(garage.full).toBe(false);
    } finally {
      for (const name of ["fullscreenEnabled", "fullscreenElement", "exitFullscreen"]) {
        Reflect.deleteProperty(document, name);
      }
    }
  });

  it("shows the camera's controls in full screen, not on its grid tile", async () => {
    const { garage, doorbell } = await garageAndBell();
    const controls = (tile: Element) => tile.shadowRoot?.querySelector("rv-live-controls");
    expect(controls(garage)).toBeNull();
    fullButton(garage).click();
    await settle(garage);
    expect(controls(garage)?.controls).toEqual({ siren: "siren.garage_siren" });
    expect(controls(garage)?.cameraName).toBe("Garage");
    // A camera without controls has none, full screen or not.
    fullButton(doorbell).click();
    await settle(doorbell);
    expect(controls(doorbell)).toBeNull();
  });

  it("keeps watching in picture-in-picture: in HD, hidden, behind another camera, off screen", async () => {
    const pip = fakePip();
    try {
      const { garage, doorbell } = await garageAndBell();
      const sub = () => players.find((p) => p.ref.connectionId === "nvr1" && p.ref.stream === "sub");
      const hd = () => players.find((p) => p.ref.stream === "main");
      const pipButton = () => garage.shadowRoot?.querySelector<HTMLButtonElement>(".corner-button.pip");
      const playing: PlayerState = { kind: "playing", transport: "MSE", result: { ok: true, steps: {} } };
      sub()?.setState(playing);
      await settle(garage);
      // On the board a tile opens its camera: no button there.
      expect(pipButton()).toBeNull();
      fullButton(garage).click();
      await settle(garage);
      expect(pipButton()?.getAttribute("aria-pressed")).toBe("false");
      pipButton()?.click();
      await settle(garage);
      expect(pip.element()?.classList.contains("sub")).toBe(true);
      expect(pipButton()?.getAttribute("aria-pressed")).toBe("true");
      // HD's first frame: the sub stream keeps playing in its window.
      hd()?.setState({ ...playing, transport: "WebRTC" });
      await settle(garage);
      expect(garage.hdShown).toBe(true);
      expect(sub()?.running).toBe(true);
      // Back on the board, with the page hidden: still playing.
      fullButton(garage).click();
      await settle(garage);
      expect(hd()?.running).toBe(false);
      Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
      await settle(garage);
      expect(sub()?.running).toBe(true);
      Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
      // Another camera full screen: the others stop, not this one.
      fullButton(doorbell).click();
      await settle(doorbell);
      await settle(garage);
      expect(garage.suspended).toBe(true);
      expect(sub()?.running).toBe(true);
      fullButton(doorbell).click();
      await settle(doorbell);
      await settle(garage);
      // Scrolled away, past the grace: still playing; its window closed, it stops.
      vi.useFakeTimers();
      observers.find((o) => o.target === garage)?.callback([{ isIntersecting: false }]);
      await garage.updateComplete;
      vi.advanceTimersByTime(OFFSCREEN_GRACE_MS);
      expect(sub()?.running).toBe(true);
      await document.exitPictureInPicture();
      await garage.updateComplete;
      vi.advanceTimersByTime(OFFSCREEN_GRACE_MS);
      expect(sub()?.running).toBe(false);
    } finally {
      pip.restore();
    }
  });

  it("puts HD in picture-in-picture when it shows, and keeps it after full screen", async () => {
    const pip = fakePip();
    try {
      const { garage } = await garageAndBell();
      const hd = () => players.find((p) => p.ref.stream === "main");
      fullButton(garage).click();
      await settle(garage);
      hd()?.setState({ kind: "playing", transport: "WebRTC", result: { ok: true, steps: {} } });
      await settle(garage);
      garage.shadowRoot?.querySelector<HTMLButtonElement>(".corner-button.pip")?.click();
      await settle(garage);
      expect(pip.element()?.classList.contains("hd")).toBe(true);
      fullButton(garage).click();
      await settle(garage);
      expect(hd()?.running).toBe(true);
      // The browser refuses (no click behind it): nothing changes, nothing breaks.
      await document.exitPictureInPicture();
      await settle(garage);
      expect(hd()?.running).toBe(false);
      pip.refuse(true);
      fullButton(garage).click();
      players.find((p) => p.ref.connectionId === "nvr1" && p.ref.stream === "sub")?.setState({
        kind: "playing",
        transport: "MSE",
        result: { ok: true, steps: {} },
      });
      await settle(garage);
      const button = garage.shadowRoot?.querySelector<HTMLButtonElement>(".corner-button.pip");
      expect(button).not.toBeNull();
      button?.click();
      await settle(garage);
      expect(pip.requested.at(-1)?.classList.contains("sub")).toBe(true);
      expect(pip.element()).toBeNull();
      expect(button?.getAttribute("aria-pressed")).toBe("false");
      // Gone: its window closes.
      pip.refuse(false);
      button?.click();
      await settle(garage);
      expect(pip.element()).not.toBeNull();
      garage.remove();
      await flush();
      expect(pip.element()).toBeNull();
    } finally {
      pip.restore();
    }
  });

  it("stops HD when the tile goes away", async () => {
    const { garage } = await garageAndBell();
    fullButton(garage).click();
    await settle(garage);
    const hd = players.find((p) => p.ref.stream === "main");
    expect(hd?.running).toBe(true);
    garage.remove();
    expect(hd?.running).toBe(false);
    expect(garage.full).toBe(false);
  });
});

describe("soak run", () => {
  const visibility = (state: "visible" | "hidden") => {
    Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  };
  const counts = (sent: Record<string, unknown>[]) =>
    sent
      .filter((m) => m.type === "reolink_viewer/live/soak/count")
      .map((m) => ({ opens: m.opens, open_ms: m.open_ms, visible_ms: m.visible_ms, tiles: m.tiles }));

  it("sends what its tiles counted, and how long it was open and visible, to the run that outlives it", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const opened = new Date(2026, 9, 22, 16, 0).getTime();
    vi.setSystemTime(opened);
    const fake = fakeHass();
    const { el } = await mountGrid(fake.hass);
    // Opening starts (or joins) the run at once.
    expect(counts(fake.sent)).toEqual([{ opens: 1, open_ms: 0, visible_ms: 0, tiles: [] }]);
    const garage = players.find((p) => p.ref.connectionId === "nvr1");
    if (!garage) throw new Error("no player");
    garage.onCount("plays");
    garage.onCount("plays");
    garage.onCount("drops");

    // An hour visible, then hidden: what it counted goes before Home Assistant unloads it.
    vi.setSystemTime(opened + 3_600_000);
    visibility("hidden");
    await flush();
    expect(counts(fake.sent).at(-1)).toEqual({
      opens: 0,
      open_ms: 3_600_000,
      visible_ms: 3_600_000,
      tiles: [{ camera: "Garage", plays: 2, drops: 1, failures: 0 }],
    });
    // Unloaded after 5 minutes hidden, attached again when the page shows.
    vi.setSystemTime(opened + 3_900_000);
    el.remove();
    await flush();
    expect(counts(fake.sent).at(-1)).toEqual({ opens: 0, open_ms: 300_000, visible_ms: 0, tiles: [] });
    vi.setSystemTime(opened + 7_200_000);
    visibility("visible");
    document.body.appendChild(el);
    await flush();
    expect(counts(fake.sent).at(-1)).toEqual({ opens: 1, open_ms: 0, visible_ms: 0, tiles: [] });
    expect(counts(fake.sent)).toHaveLength(4);
  });
});

describe("the board", () => {
  const camera = (id: string, width?: number, height?: number): LiveCamera => ({
    id,
    name: id,
    model: null,
    records: true,
    connections: [
      {
        connection_id: id,
        via: "direct",
        entry_title: id,
        is_battery: false,
        streams: { sub: { encoding: { ...encoding, width: width ?? null, height: height ?? null }, entity_id: null } },
      },
    ],
  });

  it("packs cameras by their shape, the tall ones first", () => {
    const door = camera("door", 720, 720);
    const pano = camera("pano", 1536, 432);
    const yard = camera("yard", 640, 360);
    const unknown = camera("unknown");
    expect(tileShape(door.connections[0])).toBe("tall");
    expect(tileShape(pano.connections[0])).toBe("wide");
    expect(tileShape(yard.connections[0])).toBeUndefined();
    expect(tileShape(unknown.connections[0])).toBeUndefined();
    expect(boardOrder([yard, pano, door, unknown]).map((c) => c.id)).toEqual(["door", "yard", "pano", "unknown"]);
  });

  it("counts the cameras playing, or the cameras while none plays yet", () => {
    const cameras = [camera("door"), camera("yard"), camera("pano")];
    expect(playingCount(cameras, new Set())).toBe("3 cameras");
    expect(playingCount(cameras, new Set(["door", "yard", "gone"]))).toBe("2 of 3 playing");
    expect(playingCount([camera("door")], new Set())).toBe("1 camera");
    expect(playingCount(cameras, new Set(["door"]), 1)).toBe("1 of 3 playing · 1 offline");
    expect(playingCount(cameras, new Set(), 3)).toBe("3 cameras · 3 offline");
  });

  it("crops a picture's top and bottom to fill its cell, never its sides", () => {
    const fit = (c: LiveCamera, column: number) => tileFit(c.connections[0], tileShape(c.connections[0]), column);
    // A square doorbell in a cell two rows tall (a little narrower than square): whole.
    expect(fit(camera("door", 720, 720), 272)).toBe("contain");
    expect(fit(camera("door", 720, 720), 0)).toBe("contain");
    // 16:9 fills exactly; 4:3 loses a little top and bottom.
    expect(fit(camera("yard", 640, 360), 272)).toBe("cover");
    expect(fit(camera("garage", 640, 480), 272)).toBe("cover");
    // The Duo's panorama in two columns.
    expect(fit(camera("pano", 1536, 432), 272)).toBe("cover");
    // Too wide for its cell (not wide enough to span two columns): whole.
    expect(fit(camera("wide", 2304, 1080), 272)).toBe("contain");
    expect(fit(camera("unknown"), 272)).toBe("cover");
  });

  it("tells the page how it numbers its cameras", async () => {
    const { hass } = fakeHass();
    const el = document.createElement("rv-live-grid");
    const told: { cameras: { id: string; name: string; number: number }[] }[] = [];
    el.addEventListener("rv-board", (e) => told.push((e as CustomEvent<(typeof told)[number]>).detail));
    el.hass = hass;
    document.body.appendChild(el);
    await flush();
    await el.updateComplete;
    expect(told).toHaveLength(1);
    expect(told[0]?.cameras).toEqual(CAMERAS.map((c, i) => ({ id: c.id, name: c.name, number: i + 1 })));
  });

  it("numbers its tiles, which fill their cells", async () => {
    const { hass } = fakeHass();
    const { tiles } = await mountGrid(hass);
    expect(tiles().map((t) => t.shadowRoot?.querySelector(".num")?.textContent)).toEqual(
      CAMERAS.map((_, i) => String(i + 1)),
    );
    expect(tiles().every((t) => t.hasAttribute("fill") && t.getAttribute("fit") === "cover")).toBe(true);
  });
});

describe("rv-live-camera", () => {
  it("turns keep warm on and off through Home Assistant's switch", async () => {
    const fake = fakeHass();
    const el = document.createElement("rv-live-camera");
    el.hass = fake.hass;
    el.deviceId = "cam1";
    document.body.appendChild(el);
    await flush();
    await el.updateComplete;
    const box = el.shadowRoot?.querySelector<HTMLInputElement>(".keep-warm input");
    if (!box) throw new Error("no keep-warm toggle");
    expect(box.checked).toBe(true);
    box.checked = false;
    box.dispatchEvent(new Event("change"));
    expect(fake.services).toEqual([["switch", "turn_off", { entity_id: "switch.garage_keep_live_view_warm" }]]);
    fake.failService();
    box.checked = true;
    box.dispatchEvent(new Event("change"));
    await flush();
    await el.updateComplete;
    expect(el.shadowRoot?.textContent).toContain("Could not change it: not allowed");
    // A battery camera has no switch.
    el.deviceId = "cam2";
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector(".keep-warm")).toBeNull();
  });

  it("plays the camera a device id names, large", async () => {
    const { hass } = fakeHass();
    const el = document.createElement("rv-live-camera");
    el.hass = hass;
    el.deviceId = "nvr1"; // a connection's id names the camera too
    document.body.appendChild(el);
    await flush();
    await el.updateComplete;
    const tile = el.shadowRoot?.querySelector("rv-live-tile");
    expect(tile?.camera?.id).toBe("cam1");
    expect(tile?.openable).toBe(false);
    // Its own view: the controls show without full screen.
    await tile?.updateComplete;
    expect(tile?.shadowRoot?.querySelector("rv-live-controls")?.controls).toEqual({ siren: "siren.garage_siren" });
    el.deviceId = "nope";
    await el.updateComplete;
    expect(el.shadowRoot?.textContent).toContain("cannot be watched live");
  });
});

describe("routes", () => {
  it("has a Live view (the home view, and the old #live) and a Live tab", () => {
    expect(routeFromHash("")).toEqual({ view: "live" });
    expect(routeFromHash("#live")).toEqual({ view: "live" });
    expect(routeToHash({ view: "live" })).toBe("");
    expect(routeFromHash("#device/x/live")).toEqual({ view: "device", id: "x", tab: "live" });
  });
});

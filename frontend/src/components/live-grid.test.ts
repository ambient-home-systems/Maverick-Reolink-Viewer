import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PlayerOptions, PlayerState } from "../live/player";
import type { HomeAssistant, LiveCamera, LiveImagesEvent } from "../types";
import { routeFromHash, routeToHash, type Route } from "./navigation";

// Players that record what the tiles ask of them.
const players = vi.hoisted(
  () =>
    [] as {
      ref: { connectionId: string; stream: string };
      options: PlayerOptions;
      running: boolean;
      starts: number;
      retries: number;
      setState(state: PlayerState): void;
    }[],
);

vi.mock("../live/player", () => {
  class FakePlayer {
    running = false;
    starts = 0;
    retries = 0;
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
  return { LivePlayer: FakePlayer };
});

await import("./live-grid");
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
        // Not warm yet on the server: its switch, just turned on, says it will be.
        streams: { sub: { encoding, entity_id: null, warm: false }, main: { encoding, entity_id: null, warm: false } },
      },
    ],
    keep_warm_entity: "switch.garage_keep_live_view_warm",
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
];

function fakeHass(fail = false) {
  const sent: Record<string, unknown>[] = [];
  const services: unknown[][] = [];
  let failService = false;
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
    expect(doorbell.shadowRoot?.textContent).toContain("Tap to watch");
    tileBox(doorbell).click();
    await doorbell.updateComplete;
    await flush();
    expect(bell()?.starts).toBe(1);
    expect(doorbell.shadowRoot?.textContent).not.toContain("Tap to watch");

    const routes: Route[] = [];
    el.addEventListener("rv-navigate", (e) => routes.push((e as CustomEvent<Route>).detail));
    tileBox(doorbell).click();
    tileBox(doorbell).dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(routes).toEqual([
      { view: "device", id: "cam2", tab: "live" },
      { view: "device", id: "cam2", tab: "live" },
    ]);
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
    expect(garage.shadowRoot?.textContent).toContain("Cannot play: MSE: the server closed the stream");
    garage.shadowRoot?.querySelector<HTMLButtonElement>(".status button")?.click();
    expect(player?.retries).toBe(1);
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

  it("shows a load error and loads again on Retry", async () => {
    const failing = fakeHass(true);
    const { el } = await mountGrid(failing.hass);
    expect(el.shadowRoot?.textContent).toContain("Could not load live view: not loaded");
    expect(failing.unsubscribed()).toBe(1); // the pictures are not watched for nothing
    el.shadowRoot?.querySelector<HTMLButtonElement>(".banner button")?.click();
    await flush();
    expect(failing.sent.filter((m) => m.type === "reolink_viewer/live/cameras")).toHaveLength(2);
  });
});

describe("full screen", () => {
  type RvLiveTile = HTMLElementTagNameMap["rv-live-tile"];
  const fullButton = (tile: Element) => {
    const button = tile.shadowRoot?.querySelector<HTMLButtonElement>(".corner-button");
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
    expect(garage.shadowRoot?.querySelector(".hd-status .badge")?.textContent).toBe("HD");

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
    hd?.setState({ kind: "waiting", error: "WebRTC: the NVR is busy", retryAt: Date.now() + 1000 });
    await settle(garage);
    expect(garage.shadowRoot?.textContent).toContain("HD cannot play: WebRTC: the NVR is busy");
    expect(players.find((p) => p.ref.connectionId === "nvr1" && p.ref.stream === "sub")?.running).toBe(true);
    // Esc leaves full screen when it fills the window.
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await settle(garage);
    expect(garage.full).toBe(false);
    expect(hd?.running).toBe(false);
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
    el.deviceId = "nope";
    await el.updateComplete;
    expect(el.shadowRoot?.textContent).toContain("cannot be watched live");
  });
});

describe("routes", () => {
  it("has a Live view and a Live tab", () => {
    expect(routeFromHash("#live")).toEqual({ view: "live" });
    expect(routeToHash({ view: "live" })).toBe("#live");
    expect(routeFromHash("#device/x/live")).toEqual({ view: "device", id: "x", tab: "live" });
  });
});

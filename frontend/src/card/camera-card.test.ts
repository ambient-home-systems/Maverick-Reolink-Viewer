import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PlayerOptions, PlayerState } from "../live/player";
import type { HomeAssistant, LiveCamera, LiveImagesEvent } from "../types";

// Players that record what the card's tile asks of them.
const players = vi.hoisted(
  () =>
    [] as {
      ref: { connectionId: string; stream: string };
      options: PlayerOptions;
      running: boolean;
      starts: number;
      setState(state: PlayerState): void;
    }[],
);

vi.mock("../live/player", async () => {
  const actual = await vi.importActual<typeof import("../live/player")>("../live/player");
  class FakePlayer {
    running = false;
    starts = 0;
    events: { at: number; text: string }[] = [];
    onCount: () => void = () => undefined;
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
      return undefined;
    }
    setState(state: PlayerState): void {
      this._onState(state);
    }
  }
  return { ...actual, LivePlayer: FakePlayer };
});

const { ReolinkViewerCameraCard } = await import("./index");
const { CARD_DOCS, cardConfig, cardSize, rememberRatio, storedConfig, GRID_OPTIONS } = await import("./config");
const { PANEL_PATH, pictureRatio } = await import("./camera-card");
await import("./editor");
const { tablet } = await import("./tablet");

type Card = InstanceType<typeof ReolinkViewerCameraCard>;
type Tile = HTMLElementTagNameMap["rv-live-tile"];

const sd = { codec: "h264", frame_rate: 15, bit_rate: 512, width: 640, height: 360 };
const hd = { codec: "h264", frame_rate: 15, bit_rate: 4096, width: 2560, height: 1440 };
const CAMERAS: LiveCamera[] = [
  {
    id: "cam1",
    name: "Front Yard",
    model: "CX810",
    records: true,
    connections: [
      {
        connection_id: "nvr1",
        via: "nvr",
        entry_title: "RLN36",
        is_battery: false,
        streams: { sub: { encoding: sd, entity_id: null, warm: false }, main: { encoding: hd, entity_id: null } },
      },
    ],
    keep_warm_entity: "switch.front_yard_keep_live_view_warm",
    controls: { siren: "siren.front_yard_siren" },
  },
  {
    id: "cam2",
    name: "Doorbell",
    model: "Video Doorbell",
    records: true,
    connections: [
      {
        connection_id: "bell",
        via: "direct",
        entry_title: "Doorbell",
        is_battery: true,
        streams: { sub: { encoding: { ...sd, width: 480, height: 640 }, entity_id: null } },
      },
    ],
    visitor_entity: "binary_sensor.doorbell_visitor",
  },
];

/** Home Assistant's next state: the same, with the Doorbell's visitor sensor as given. */
function withVisitor(hass: HomeAssistant, state: string, at: string): HomeAssistant {
  return {
    ...hass,
    states: { ...hass.states, "binary_sensor.doorbell_visitor": { state, last_changed: at } },
  } as unknown as HomeAssistant;
}

function fakeHass({ fail = false, warm = "off" }: { fail?: boolean; warm?: string } = {}) {
  const sent: Record<string, unknown>[] = [];
  const services: unknown[][] = [];
  let failing = fail;
  const unsubscribed: Record<string, unknown>[] = [];
  const hass = {
    user: { is_admin: false },
    states: { "switch.front_yard_keep_live_view_warm": { state: warm } },
    themes: { darkMode: false },
    callService: vi.fn((...args: unknown[]) => {
      services.push(args);
      return Promise.resolve(undefined);
    }),
    callWS: vi.fn((message: Record<string, unknown>) => {
      sent.push(message);
      if (message.type === "reolink_viewer/live/cameras") {
        return failing ? Promise.reject(new Error("not loaded")) : Promise.resolve({ cameras: CAMERAS });
      }
      if (message.type === "web_rtc/ice_servers") return Promise.resolve([{ urls: ["stun:s"] }]);
      return Promise.resolve(null);
    }),
    connection: {
      subscribeMessage: vi.fn((callback: (event: LiveImagesEvent) => void, message: Record<string, unknown>) => {
        sent.push(message);
        const ids = (message.camera_ids as string[] | undefined) ?? CAMERAS.map((c) => c.id);
        setTimeout(() => {
          callback({
            images: Object.fromEntries(ids.map((id) => [id, { url: `/api/reolink_viewer/live/image/${id}?authSig=x`, taken: 1 }])),
          });
        }, 0);
        return Promise.resolve(() => {
          unsubscribed.push(message);
          return Promise.resolve();
        });
      }),
    },
  } as unknown as HomeAssistant;
  return {
    hass,
    sent,
    services,
    unsubscribed,
    recover: () => {
      failing = false;
    },
  };
}

const flush = async () => {
  for (let i = 0; i < 6; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
};

/** The tile sees itself on screen (happy-dom's observer never calls back). */
class FakeObserver {
  constructor(readonly callback: (entries: { isIntersecting: boolean }[]) => void) {}
  observe(): void {
    setTimeout(() => {
      this.callback([{ isIntersecting: true }]);
    }, 0);
  }
  disconnect(): void {
    return undefined;
  }
}

async function mount(hass: HomeAssistant, config: Record<string, unknown>) {
  const card = document.createElement("reolink-viewer-camera");
  card.setConfig({ type: "custom:reolink-viewer-camera", ...config });
  card.hass = hass;
  document.body.appendChild(card);
  const body = () => card.shadowRoot?.querySelector("rv-camera-card");
  const tile = () => body()?.shadowRoot?.querySelector<Tile>("rv-live-tile") ?? null;
  const settle = async () => {
    for (let i = 0; i < 3; i += 1) {
      await flush();
      await card.updateComplete;
      await body()?.updateComplete;
      await tile()?.updateComplete;
    }
  };
  await settle();
  const text = () => (body()?.shadowRoot?.textContent ?? "").replace(/\s+/g, " ");
  return { card, body, tile, settle, text };
}

beforeEach(() => {
  players.length = 0;
  vi.stubGlobal("IntersectionObserver", FakeObserver);
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("the card's settings", () => {
  it("has plain defaults, and says what is wrong", () => {
    expect(cardConfig({ type: "custom:reolink-viewer-camera", camera: "cam1" })).toEqual({
      type: "custom:reolink-viewer-camera",
      camera: "cam1",
      quality: "sd",
      tap_action: "full_screen",
      show_name: true,
      show_state: true,
      fit: "cover",
      ring_full_screen: 0,
    });
    expect(cardConfig({ type: "x" }).camera).toBeUndefined();
    expect(() => cardConfig({ quality: "4k" })).toThrow("quality: one of sd, hd.");
    expect(() => cardConfig({ tap_action: "more-info" })).toThrow("tap_action: one of full_screen, open_panel, none.");
    expect(() => cardConfig({ show_name: "yes" })).toThrow("show_name: true or false.");
    expect(() => cardConfig({ camera: 3 })).toThrow("camera: the camera's id");
    expect(cardConfig({ ring_full_screen: 45 }).ring_full_screen).toBe(45);
    expect(cardConfig({ ring_full_screen: 0 }).ring_full_screen).toBe(0);
    for (const ring of [3, 601, 12.5, "30"]) {
      expect(() => cardConfig({ ring_full_screen: ring })).toThrow("ring_full_screen: seconds, 5 to 600 (0: not).");
    }
    expect(() => cardConfig(null)).toThrow("The card needs its settings.");
  });

  it("keeps only what differs from the defaults, and what it does not know", () => {
    const raw = { type: "custom:reolink-viewer-camera", camera: "cam1", grid_options: { rows: 4 } };
    expect(storedConfig(raw, { quality: "hd", show_name: true })).toEqual({ ...raw, quality: "hd" });
    expect(storedConfig({ ...raw, quality: "hd" }, { quality: "sd", camera: "" })).toEqual({
      type: "custom:reolink-viewer-camera",
      grid_options: { rows: 4 },
    });
  });

  it("sizes the card from its camera's picture", () => {
    expect(cardSize(undefined)).toBe(4); // 16:9 until the camera is known
    rememberRatio("square", 1);
    expect(cardSize("square")).toBe(8);
    expect(GRID_OPTIONS).toEqual({ columns: 12, rows: "auto", min_columns: 3, min_rows: 2 });
    const connection = CAMERAS[0]?.connections[0];
    expect(pictureRatio(connection, "sub")).toBeCloseTo(16 / 9);
    expect(pictureRatio(connection, "ext")).toBeCloseTo(16 / 9); // no size of its own: the sub stream's
    expect(pictureRatio(undefined, "sub")).toBeUndefined();
  });

  it("is in the card picker, with the user guide's section", () => {
    expect(window.customCards).toContainEqual(
      expect.objectContaining({ type: "reolink-viewer-camera", name: "Reolink camera", preview: false }),
    );
    const guide = readFileSync(join(__dirname, "..", "..", "..", "docs", "user-guide.md"), "utf8");
    const anchor = CARD_DOCS.split("#")[1];
    const headings = [...guide.matchAll(/^#{1,6} (.+)$/gm)].map((m) =>
      m[1]
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s_-]/gu, "")
        .replace(/\s/g, "-"),
    );
    expect(headings).toContain(anchor);
  });

  it("starts a new card on the first camera", async () => {
    const { hass } = fakeHass();
    expect(await ReolinkViewerCameraCard.getStubConfig(hass)).toEqual({ camera: "cam1" });
    const failing = fakeHass({ fail: true });
    expect(await ReolinkViewerCameraCard.getStubConfig(failing.hass)).toEqual({});
    const editor = await ReolinkViewerCameraCard.getConfigElement();
    expect(editor.tagName.toLowerCase()).toBe("reolink-viewer-camera-editor");
  });
});

describe("custom:reolink-viewer-camera", () => {
  it("plays its camera's sub stream, and watches only its picture", async () => {
    const { hass, sent } = fakeHass();
    const { card, body, tile } = await mount(hass, { camera: "cam1" });
    expect(card.getCardSize()).toBe(4);
    expect(card.getGridOptions()).toBe(GRID_OPTIONS);
    // Only this camera's picture is kept fresh for the card.
    expect(sent.filter((m) => m.type === "reolink_viewer/live/images")).toEqual([
      { type: "reolink_viewer/live/images", camera_ids: ["cam1"] },
    ]);
    const shown = tile();
    expect(shown?.camera?.id).toBe("cam1");
    expect(shown?.image?.url).toContain("/live/image/cam1");
    expect(shown?.hasAttribute("fill")).toBe(true);
    expect(shown?.fit).toBe("cover");
    expect(players.map((p) => [p.ref.connectionId, p.ref.stream, p.running])).toEqual([["nvr1", "sub", true]]);
    // As tall as the picture.
    const frame = body()?.shadowRoot?.querySelector<HTMLElement>(".frame");
    expect(frame?.getAttribute("style")).toBe(`--ratio: ${(16 / 9).toFixed(4)}`);
    // Compact: its controls only in full screen.
    expect(shown?.shadowRoot?.querySelector("rv-live-controls")).toBeNull();
    expect(shown?.shadowRoot?.querySelector(".corner-button.pip")).toBeNull();
    expect(shown?.shadowRoot?.querySelector(".name")?.textContent).toBe("Front Yard");
    expect(shown?.hasAttribute("hide-state")).toBe(false);
  });

  it("starts at once on a camera kept warm", async () => {
    const { hass } = fakeHass({ warm: "on" });
    const { tile } = await mount(hass, { camera: "cam1" });
    expect(tile()?.warm).toBe(true);
    expect(players[0]?.options.warm).toBe(true);
  });

  it("goes full screen on a tap, with its controls, and stops the other cards", async () => {
    const { hass } = fakeHass();
    const front = await mount(hass, { camera: "cam1" });
    const other = await mount(hass, { camera: "cam1", tap_action: "none" });
    const open = front.tile()?.shadowRoot?.querySelector<HTMLButtonElement>("button.open");
    expect(open?.getAttribute("aria-label")).toBe("Front Yard full screen");
    // The other card's tap does nothing: no button.
    expect(other.tile()?.shadowRoot?.querySelector("button.open")).toBeNull();
    expect(players.filter((p) => p.running)).toHaveLength(2);

    open?.click();
    await front.settle();
    await other.settle();
    expect(front.tile()?.full).toBe(true);
    expect(front.tile()?.shadowRoot?.querySelector("rv-live-controls")).not.toBeNull();
    // The other card is behind it: stopped until it is back.
    expect(other.tile()?.suspended).toBe(true);
    const otherPlayer = players.find((p) => p.ref.stream === "sub" && p !== players[0]);
    expect(otherPlayer?.running).toBe(false);

    front.tile()?.exitFull();
    await front.settle();
    await other.settle();
    expect(other.tile()?.suspended).toBe(false);
    expect(otherPlayer?.running).toBe(true);
  });

  it("opens the camera in the panel on a tap", async () => {
    const { hass } = fakeHass();
    const { tile } = await mount(hass, { camera: "cam1", tap_action: "open_panel" });
    const moved = vi.fn();
    window.addEventListener("location-changed", moved);
    const open = tile()?.shadowRoot?.querySelector<HTMLButtonElement>("button.open");
    expect(open?.getAttribute("aria-label")).toBe("Open Front Yard in Reolink");
    open?.click();
    expect(window.location.pathname + window.location.hash).toBe(`${PANEL_PATH}#device/cam1/live`);
    expect(moved).toHaveBeenCalledTimes(1);
    expect(tile()?.full).toBe(false);
    window.removeEventListener("location-changed", moved);
    history.replaceState(null, "", "/");
  });

  it("plays HD on the card itself, and shows that one larger in full screen", async () => {
    const { hass } = fakeHass();
    const { tile, settle, body } = await mount(hass, { camera: "cam1", quality: "hd" });
    expect(players.map((p) => [p.ref.stream, p.running])).toEqual([["main", true]]);
    expect(tile()?.warm).toBeUndefined();
    const frame = body()?.shadowRoot?.querySelector<HTMLElement>(".frame");
    expect(frame?.getAttribute("style")).toBe(`--ratio: ${(16 / 9).toFixed(4)}`);
    tile()?.enterFull();
    await settle();
    // No second HD player: the card's stream is HD already.
    expect(players).toHaveLength(1);
    expect(tile()?.shadowRoot?.querySelector(".hd-status")?.textContent.trim()).toBe("HD");
  });

  it("hides the name and state when asked, and still says them", async () => {
    const { hass } = fakeHass();
    const { tile } = await mount(hass, { camera: "cam1", show_name: false, show_state: false });
    expect(tile()?.shadowRoot?.querySelector(".name")).toBeNull();
    expect(tile()?.hasAttribute("hide-state")).toBe(true);
    expect(tile()?.shadowRoot?.querySelector(".state")?.textContent).toContain("Starting");
    expect(tile()?.shadowRoot?.querySelector("video")?.getAttribute("aria-label")).toBe("Front Yard live");
  });

  it("waits for a tap on a battery camera, its picture shaped as it is", async () => {
    const { hass } = fakeHass();
    const { tile, card, settle } = await mount(hass, { camera: "cam2", fit: "contain" });
    expect(players.every((p) => !p.running)).toBe(true);
    expect(tile()?.fit).toBe("contain");
    expect(card.getCardSize()).toBe(10); // 3:4, from what the card saw
    tile()?.shadowRoot?.querySelector<HTMLButtonElement>("button.open")?.click();
    await settle();
    expect(players.find((p) => p.ref.connectionId === "bell")?.running).toBe(true);
  });

  it("watches another camera when its settings change", async () => {
    const { hass, sent, unsubscribed } = fakeHass();
    const { card, settle, tile } = await mount(hass, { camera: "cam1" });
    card.setConfig({ type: "custom:reolink-viewer-camera", camera: "cam2" });
    await settle();
    expect(unsubscribed).toEqual([{ type: "reolink_viewer/live/images", camera_ids: ["cam1"] }]);
    expect(sent.filter((m) => m.type === "reolink_viewer/live/images").at(-1)).toEqual({
      type: "reolink_viewer/live/images",
      camera_ids: ["cam2"],
    });
    expect(tile()?.camera?.id).toBe("cam2");
  });

  it("says what to do when it has no camera, or cannot show it", async () => {
    const { hass } = fakeHass();
    const none = await mount(hass, {});
    expect(none.text()).toContain("Choose a camera in this card's settings.");
    const gone = await mount(hass, { camera: "removed" });
    expect(gone.text()).toContain("This camera cannot be watched live. Choose another in this card's settings.");
  });

  it("shows a load error, and loads again on Try again", async () => {
    const failing = fakeHass({ fail: true });
    const { body, text, settle, tile } = await mount(failing.hass, { camera: "cam1" });
    expect(text()).toContain("Could not load live view: not loaded");
    failing.recover();
    body()?.shadowRoot?.querySelector<HTMLButtonElement>(".banner button")?.click();
    await settle();
    expect(tile()?.camera?.id).toBe("cam1");
  });

  it("stops and lets go of its picture when it goes away", async () => {
    const { hass, unsubscribed } = fakeHass();
    const { card } = await mount(hass, { camera: "cam1" });
    card.remove();
    await flush();
    expect(players.every((p) => !p.running)).toBe(true);
    expect(unsubscribed).toHaveLength(1);
  });

  it("goes full screen when the doorbell rings, for its seconds, waking Fully Kiosk's screen", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const note = vi.spyOn(tablet, "note");
      const wake = vi.spyOn(tablet, "wake");
      const { hass } = fakeHass();
      const quiet = withVisitor(hass, "off", "2026-11-03T03:00:00Z");
      const { card, tile, settle } = await mount(quiet, { camera: "cam2", ring_full_screen: 5 });
      // A ring before the card was shown is not one.
      const ringing = await mount(withVisitor(hass, "on", "2026-11-03T02:59:00Z"), { camera: "cam2", ring_full_screen: 5 });
      expect(ringing.tile()?.full).toBe(false);
      ringing.card.remove();
      expect(tile()?.full).toBe(false);

      card.hass = withVisitor(hass, "on", "2026-11-03T03:01:00Z");
      await settle();
      expect(tile()?.full).toBe(true);
      expect(wake).toHaveBeenCalledTimes(1);
      expect(note).toHaveBeenCalledWith("ring", "Doorbell", "full screen for 5 s");
      // The battery doorbell plays: someone asked for it.
      expect(players.find((p) => p.ref.connectionId === "bell")?.running).toBe(true);
      // Its state stays on a while: still the same ring.
      card.hass = withVisitor(hass, "on", "2026-11-03T03:01:00Z");
      await settle();
      expect(wake).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(5000);
      await settle();
      expect(tile()?.full).toBe(false);

      // Full screen by hand before a ring: it stays when the ring's time is up.
      tile()?.enterFull();
      card.hass = withVisitor(hass, "off", "2026-11-03T03:02:00Z");
      await settle();
      card.hass = withVisitor(hass, "on", "2026-11-03T03:03:00Z");
      await settle();
      await vi.advanceTimersByTimeAsync(5000);
      await settle();
      expect(tile()?.full).toBe(true);
      tile()?.exitFull();

      // Without the setting, a ring does nothing.
      const plain = await mount(quiet, { camera: "cam2" });
      plain.card.hass = withVisitor(hass, "on", "2026-11-03T03:04:00Z");
      await plain.settle();
      expect(plain.tile()?.full).toBe(false);
    } finally {
      vi.useRealTimers();
      vi.restoreAllMocks();
    }
  });

  it("sleeps while Fully Kiosk's screensaver shows, and plays again after", async () => {
    const fullyEvent = (event: string) => {
      (tablet as unknown as { _fullyEvent(event: string): void })._fullyEvent(event);
    };
    const { hass } = fakeHass();
    const { tile, settle } = await mount(hass, { camera: "cam1" });
    const player = players.find((p) => p.ref.connectionId === "nvr1");
    expect(player?.running).toBe(true);
    fullyEvent("onScreensaverStart");
    await settle();
    expect(tile()?.suspended).toBe(true);
    expect(player?.running).toBe(false);
    fullyEvent("onScreensaverStop");
    await settle();
    expect(tile()?.suspended).toBe(false);
    expect(player?.running).toBe(true);
  });

  it("notes for the report what its video does", async () => {
    const note = vi.spyOn(tablet, "note");
    try {
      const { hass } = fakeHass();
      await mount(hass, { camera: "cam1" });
      expect(note).toHaveBeenCalledWith("starting", "Front Yard", "SD WebRTC");
      players[0]?.setState({ kind: "playing", transport: "WebRTC", result: {} as never });
      expect(note).toHaveBeenLastCalledWith("playing", "Front Yard", expect.stringMatching(/^SD WebRTC, \d+\.\d s$/));
      players[0]?.setState({ kind: "waiting", error: "camera unreachable", retryAt: 0 });
      expect(note).toHaveBeenLastCalledWith("retrying", "Front Yard", expect.stringMatching(/^SD: /));
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("refuses wrong settings, which Home Assistant shows", () => {
    const card: Card = document.createElement("reolink-viewer-camera");
    expect(() => {
      card.setConfig({ type: "custom:reolink-viewer-camera", fit: "stretch" });
    }).toThrow("fit: one of cover, contain.");
  });
});

describe("the card's editor", () => {
  async function mountEditor(hass: HomeAssistant, config: Record<string, unknown>) {
    const editor = document.createElement("reolink-viewer-camera-editor");
    editor.setConfig({ type: "custom:reolink-viewer-camera", ...config });
    editor.hass = hass;
    document.body.appendChild(editor);
    const changes: Record<string, unknown>[] = [];
    editor.addEventListener("config-changed", (e) => {
      changes.push((e as CustomEvent<{ config: Record<string, unknown> }>).detail.config);
    });
    await flush();
    await editor.updateComplete;
    const root = () => editor.shadowRoot;
    const text = () => (root()?.textContent ?? "").replace(/\s+/g, " ");
    return { editor, root, text, changes };
  }

  it("chooses the camera, and keeps what differs from the defaults", async () => {
    const { hass } = fakeHass();
    const { root, changes, editor } = await mountEditor(hass, {});
    const select = root()?.querySelector("select");
    expect([...(select?.options ?? [])].map((o) => o.textContent)).toEqual(["Choose a camera", "Front Yard", "Doorbell"]);
    if (!select) throw new Error("no select");
    select.value = "cam2";
    select.dispatchEvent(new Event("change"));
    expect(changes.at(-1)).toEqual({ type: "custom:reolink-viewer-camera", camera: "cam2" });
    await editor.updateComplete;
    const hdRadio = [...(root()?.querySelectorAll<HTMLInputElement>('input[name="quality"]') ?? [])].at(1);
    hdRadio?.click();
    expect(changes.at(-1)).toEqual({ type: "custom:reolink-viewer-camera", camera: "cam2", quality: "hd" });
    const showName = [...(root()?.querySelectorAll<HTMLLabelElement>("fieldset label.check") ?? [])]
      .find((label) => label.textContent.includes("The camera's name"))
      ?.querySelector("input");
    showName?.click();
    expect(changes.at(-1)).toMatchObject({ show_name: false });
    const tap = root()?.querySelectorAll("select")[1];
    if (!tap) throw new Error("no tap select");
    tap.value = "none";
    tap.dispatchEvent(new Event("change"));
    expect(changes.at(-1)).toMatchObject({ tap_action: "none" });
  });

  it("warns when the camera is not kept warm, with its switch", async () => {
    const { hass, services } = fakeHass();
    const { text, root } = await mountEditor(hass, { camera: "cam1" });
    expect(text()).toContain("Not kept warm: its video starts in 2–10 s. Keep it warm to start at once.");
    const keepWarm = root()?.querySelector<HTMLInputElement>(".warm input");
    expect(keepWarm?.checked).toBe(false);
    keepWarm?.click();
    expect(services).toEqual([["switch", "turn_on", { entity_id: "switch.front_yard_keep_live_view_warm" }]]);
    const warm = await mountEditor(fakeHass({ warm: "on" }).hass, { camera: "cam1" });
    expect(warm.text()).not.toContain("Not kept warm");
  });

  it("says a battery camera is never kept warm", async () => {
    const { hass } = fakeHass();
    const { text } = await mountEditor(hass, { camera: "cam2" });
    expect(text()).toContain("A battery camera is never kept warm");
    expect(text()).not.toContain("Not kept warm");
  });

  it("offers a doorbell's card full screen when it rings, for a number of seconds", async () => {
    const { hass } = fakeHass();
    const front = await mountEditor(hass, { camera: "cam1" });
    expect(front.text()).not.toContain("When it rings");
    const { root, changes, text, editor } = await mountEditor(hass, { camera: "cam2" });
    expect(text()).toContain("When it rings");
    const ring = root()?.querySelector<HTMLInputElement>("fieldset input[type=checkbox]");
    ring?.click();
    expect(changes.at(-1)).toEqual({ type: "custom:reolink-viewer-camera", camera: "cam2", ring_full_screen: 30 });
    await editor.updateComplete;
    const seconds = root()?.querySelector<HTMLInputElement>("input[type=number]");
    if (!seconds) throw new Error("no seconds");
    seconds.value = "2";
    seconds.dispatchEvent(new Event("change"));
    expect(changes.at(-1)).toMatchObject({ ring_full_screen: 5 });
    seconds.value = "45";
    seconds.dispatchEvent(new Event("change"));
    expect(changes.at(-1)).toMatchObject({ ring_full_screen: 45 });
  });

  it("leaves settings it cannot show to the YAML", async () => {
    const { hass } = fakeHass();
    const { text } = await mountEditor(hass, { quality: "4k" });
    expect(text()).toContain("These settings can only be changed in the card's YAML.");
  });
});

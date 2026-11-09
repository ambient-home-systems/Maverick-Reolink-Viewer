import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { HomeAssistant, LiveCamera, WallLayout } from "../types";
import { rememberedLayout, rememberedMode, rememberLayout, rememberMode } from "../wall/remember";
import { routeFromHash, routeToHash, type Route } from "./navigation";

// Players that do nothing: the Wall's tiles are the board's (tested there).
vi.mock("../live/player", async () => {
  const actual = await vi.importActual<typeof import("../live/player")>("../live/player");
  class FakePlayer {
    running = false;
    events: { at: number; text: string }[] = [];
    onCount: () => void = () => undefined;
    state = { kind: "idle" };
    constructor(
      _hass: unknown,
      _video: unknown,
      readonly ref: unknown,
      readonly options: Record<string, unknown>,
    ) {}
    start(): void {
      this.running = true;
    }
    stop(): void {
      this.running = false;
    }
    retryNow(): void {
      // Nothing to retry.
    }
  }
  return { ...actual, LivePlayer: FakePlayer };
});

const { ALL_CAMERAS, IDLE_CURSOR_MS, wallCameras } = await import("./wall");

const encoding = { codec: "h264", frame_rate: 15, bit_rate: 512, width: 896, height: 512 };
const camera = (id: string, name: string, size = encoding): LiveCamera => ({
  id,
  name,
  model: "RLC-520A",
  records: true,
  connections: [
    {
      connection_id: `${id}-conn`,
      via: "direct",
      entry_title: name,
      is_battery: false,
      streams: { sub: { encoding: size, entity_id: null, warm: false } },
    },
  ],
});
// The doorbell is square: first on the board, two rows tall.
const CAMERAS: LiveCamera[] = [
  camera("yard", "Front Yard"),
  camera("door", "Doorbell", { ...encoding, width: 1600, height: 1600 }),
  camera("garage", "Garage"),
];

function fakeHass(layouts: WallLayout[], cameras: LiveCamera[] = CAMERAS, answers: Record<string, unknown> = {}) {
  const sent: Record<string, unknown>[] = [];
  const hass = {
    user: { is_admin: false },
    states: {},
    config: { time_zone: "UTC" },
    callService: vi.fn(() => Promise.resolve(undefined)),
    callWS: vi.fn((message: Record<string, unknown>) => {
      sent.push(message);
      if (message.type === "reolink_viewer/live/cameras") return Promise.resolve({ cameras });
      if (typeof message.type === "string" && message.type in answers) return Promise.resolve(answers[message.type]);
      if (message.type === "web_rtc/ice_servers") return Promise.resolve([]);
      if (message.type === "reolink_viewer/wall/layouts") return Promise.resolve({ layouts: [...layouts] });
      if (message.type === "reolink_viewer/wall/layouts/save") {
        const layout: WallLayout = {
          id: (message.layout_id as string | undefined) ?? "porch",
          name: String(message.name),
          grid: message.grid as WallLayout["grid"],
          cameras: message.cameras as string[],
          tour_s: null,
          ...(message.siren === false ? { siren: false } : {}),
        };
        const at = layouts.findIndex((l) => l.id === layout.id);
        if (at >= 0) layouts[at] = layout;
        else layouts.push(layout);
        return Promise.resolve({ layout });
      }
      if (message.type === "reolink_viewer/wall/layouts/delete") {
        layouts.splice(
          layouts.findIndex((l) => l.id === message.layout_id),
          1,
        );
        return Promise.resolve({});
      }
      return Promise.resolve(null);
    }),
    connection: {
      subscribeMessage: vi.fn(() => Promise.resolve(() => Promise.resolve())),
    },
  } as unknown as HomeAssistant;
  return { hass, sent };
}

const flush = async () => {
  for (let i = 0; i < 4; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
};

async function mount(hass: HomeAssistant, layoutId?: string) {
  const el = document.createElement("rv-wall");
  el.hass = hass;
  el.layoutId = layoutId;
  const routes: Route[] = [];
  el.addEventListener("rv-navigate", (e) => routes.push((e as CustomEvent<Route>).detail));
  document.body.appendChild(el);
  await flush();
  await el.updateComplete;
  const root = el.shadowRoot;
  const tiles = () => [...(root?.querySelectorAll("rv-live-tile") ?? [])];
  const cells = () => [...(root?.querySelector(".cells")?.children ?? [])];
  const button = (text: string) =>
    [...(root?.querySelectorAll<HTMLButtonElement>("button") ?? [])].find((b) => b.textContent.trim() === text);
  const text = () => (root?.textContent ?? "").replace(/\s+/g, " ");
  return { el, routes, tiles, cells, button, text };
}

const FRONT: WallLayout = { id: "front", name: "Front", grid: "1+5", cameras: ["door", null, "yard", "gone"], tour_s: null };

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("rv-wall", () => {
  it("shows a saved layout's cameras in its cells, the large one first, and remembers it", async () => {
    const { hass } = fakeHass([FRONT]);
    const { el, tiles, cells, text } = await mount(hass, "front");
    expect(rememberedMode()).toBe("wall");
    expect(rememberedLayout()).toBe("front");
    const grid = el.shadowRoot?.querySelector<HTMLElement>(".cells");
    expect(grid?.getAttribute("style")).toContain("repeat(3, minmax(0, 1fr))");
    // Six cells: the doorbell large, an empty one, the yard, and three empty
    // (one for a camera that is gone).
    expect(cells()).toHaveLength(6);
    expect(tiles().map((t) => t.camera?.id)).toEqual(["door", "yard"]);
    expect(cells()[0]?.getAttribute("style")).toContain("grid-column: 1 / span 2; grid-row: 1 / span 2");
    // Numbered as on the board (the doorbell first: it is tall).
    expect(tiles().map((t) => t.number)).toEqual([1, 2]);
    expect(el.shadowRoot?.querySelector("select")?.value).toBe("front");
    expect(text()).not.toContain("than cells");
  });

  it("without a layout shows every camera, packed by shape; one not saved says so", async () => {
    const { hass } = fakeHass([FRONT]);
    const all = await mount(hass);
    expect(all.tiles().map((t) => t.camera?.id)).toEqual(["door", "yard", "garage"]);
    expect(all.el.shadowRoot?.querySelector("select")?.value).toBe("");
    document.body.innerHTML = "";
    const missing = await mount(hass, "gone");
    expect(missing.text()).toContain("No layout “gone”: every camera instead");
    expect(missing.tiles()).toHaveLength(3);
    expect(wallCameras(ALL_CAMERAS, CAMERAS).map((c) => c?.id)).toEqual(["door", "yard", "garage"]);
  });

  it("pages through more cameras than cells, by hand and on a tour", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    try {
      const { hass } = fakeHass([{ ...FRONT, grid: "1", cameras: [], tour_s: 10 }]);
      const { el, tiles, button, text } = await mount(hass, "front");
      expect(tiles().map((t) => t.camera?.id)).toEqual(["door"]);
      expect(text()).toContain("1 / 3");
      el.shadowRoot?.querySelector<HTMLButtonElement>('button[aria-label="Next page"]')?.click();
      await el.updateComplete;
      expect(tiles().map((t) => t.camera?.id)).toEqual(["yard"]);
      expect(el.shadowRoot?.querySelector(".said")?.textContent).toBe("Page 2 of 3.");
      // The tour turns the page every 10 s, round to the first.
      vi.advanceTimersByTime(10_000);
      await el.updateComplete;
      expect(tiles().map((t) => t.camera?.id)).toEqual(["garage"]);
      vi.advanceTimersByTime(10_000);
      await el.updateComplete;
      expect(tiles().map((t) => t.camera?.id)).toEqual(["door"]);
      // Not while arranging.
      button("Arrange")?.click();
      await el.updateComplete;
      vi.advanceTimersByTime(30_000);
      await el.updateComplete;
      expect(tiles().map((t) => t.camera?.id)).toEqual(["door"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("moves between cells from the keyboard, and moves a camera with Shift, kept in the layout", async () => {
    const { hass, sent } = fakeHass([{ ...FRONT, grid: "2x2", cameras: [] }]);
    const { el, tiles, cells } = await mount(hass, "front");
    const focusable = () => cells().map((c) => c.getAttribute("tabindex"));
    expect(focusable()).toEqual(["0", "-1", "-1", "-1"]);
    expect(cells()[0]?.getAttribute("aria-label")).toBe("Doorbell, cell 1 of 4");
    const key = (cell: Element | undefined, k: string, shiftKey = false) => {
      cell?.dispatchEvent(new KeyboardEvent("keydown", { key: k, shiftKey, bubbles: true, cancelable: true }));
    };
    key(cells()[0], "ArrowRight");
    await el.updateComplete;
    expect(focusable()).toEqual(["-1", "0", "-1", "-1"]);
    // Shift: the yard goes down, to the empty cell, and the focus with it.
    key(cells()[1], "ArrowDown", true);
    await el.updateComplete;
    await flush();
    expect(tiles().map((t) => t.camera?.id)).toEqual(["door", "garage", "yard"]);
    expect(focusable()).toEqual(["-1", "-1", "-1", "0"]);
    expect(el.shadowRoot?.querySelector(".said")?.textContent).toBe("Front Yard swapped with an empty cell.");
    expect(sent.filter((m) => m.type === "reolink_viewer/wall/layouts/save").at(-1)).toMatchObject({
      layout_id: "front",
      cameras: ["door", null, "garage", "yard"],
    });
  });

  it("puts a camera in the large slot, or alone on the screen and back", async () => {
    const { hass } = fakeHass([FRONT, { ...FRONT, id: "four", name: "Four", grid: "2x2", cameras: [] }]);
    const large = await mount(hass, "front");
    // Enter on the yard (cell 3): into the large slot.
    large.cells()[2]?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await large.el.updateComplete;
    expect(large.tiles().map((t) => t.camera?.id)).toEqual(["yard", "door"]);
    expect(large.el.shadowRoot?.querySelector(".said")?.textContent).toBe("Front Yard in the large slot.");
    document.body.innerHTML = "";
    const four = await mount(hass, "four");
    four.cells()[1]?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    await four.el.updateComplete;
    expect(four.tiles().map((t) => t.camera?.id)).toEqual(["yard"]);
    expect(four.cells()[0]?.getAttribute("aria-label")).toBe("Front Yard, alone on the screen");
    four.cells()[0]?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await four.el.updateComplete;
    expect(four.tiles()).toHaveLength(3);
    // And back by its button, for a touch screen.
    four.cells()[2]?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    await four.el.updateComplete;
    expect(four.tiles()).toHaveLength(1);
    four.button("Back to the layout")?.click();
    await four.el.updateComplete;
    expect(four.tiles()).toHaveLength(3);
  });

  it("plays the large slot in HD; the others on the same NVR stay in SD, and say why", async () => {
    // On the NVR, each with an HD stream; the NVR plays one HD tile at once.
    const main = { encoding: { ...encoding, width: 2560, height: 1440 }, entity_id: null };
    const onNvr = CAMERAS.map((c) => ({
      ...c,
      connections: c.connections.map((x) => ({ ...x, entry_title: "RLN36", host: "nvr", hd_tiles: 1, streams: { ...x.streams, main } })),
    }));
    const { hass } = fakeHass([{ ...FRONT, cameras: ["garage", "yard", "door"] }], onNvr);
    const { el, tiles } = await mount(hass, "front");
    const size = (width: number, height: number) => {
      (el as unknown as { _size: { width: number; height: number } })._size = { width, height };
    };
    // A 1500 × 860 window: the small cells are smaller than the 896 × 512 sub streams.
    size(1500, 860);
    await el.updateComplete;
    const [garage, yard, door] = tiles();
    expect(garage.tileHd).toEqual({ hd: true, reason: "HD: the large slot" });
    expect(yard.tileHd).toEqual({ hd: false, reason: "SD: the tile is no larger than its sub stream (896×512)" });
    // A 4K screen: larger, but the NVR's one HD tile is the large slot's.
    size(3840, 2100);
    await el.updateComplete;
    expect(yard.tileHd).toEqual({ hd: false, reason: "SD: RLN36 plays 1 HD tile at once, and Garage has it" });
    expect(door.tileHd?.hd).toBe(false);
    // A double tap moves the yard into the large slot: the HD tile is its now.
    yard.closest(".cell")?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    await el.updateComplete;
    expect(tiles()[0]?.camera?.id).toBe("yard");
    expect(tiles()[0]?.tileHd).toEqual({ hd: true, reason: "HD: the large slot" });
    expect(tiles()[1]?.tileHd?.reason).toBe("SD: RLN36 plays 1 HD tile at once, and Front Yard has it");
  });

  it("swaps two tiles dragged one onto the other", async () => {
    const { hass } = fakeHass([{ ...FRONT, grid: "2x2", cameras: [] }]);
    const { el, tiles, cells } = await mount(hass, "front");
    const data = new DataTransfer();
    cells()[0]?.dispatchEvent(new DragEvent("dragstart", { dataTransfer: data, bubbles: true }));
    cells()[2]?.dispatchEvent(new DragEvent("dragover", { dataTransfer: data, bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(cells()[2]?.classList.contains("over")).toBe(true);
    cells()[2]?.dispatchEvent(new DragEvent("drop", { dataTransfer: data, bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(tiles().map((t) => t.camera?.id)).toEqual(["garage", "yard", "door"]);
    expect(cells()[2]?.classList.contains("over")).toBe(false);
  });

  it("arranges by tapping a camera, then where it goes; All cameras says to save it", async () => {
    const { hass, sent } = fakeHass([]);
    const { el, tiles, button, text } = await mount(hass);
    button("Arrange")?.click();
    await el.updateComplete;
    const picks = () => [...(el.shadowRoot?.querySelectorAll<HTMLButtonElement>("button.pick") ?? [])];
    expect(picks().map((b) => b.getAttribute("aria-label"))).toEqual(["Move Doorbell", "Move Front Yard", "Move Garage"]);
    picks()[0]?.click();
    await el.updateComplete;
    expect(picks()[0]?.getAttribute("aria-pressed")).toBe("true");
    picks()[2]?.click();
    await el.updateComplete;
    expect(tiles().map((t) => t.camera?.id)).toEqual(["garage", "yard", "door"]);
    // Not a saved layout: shown, not kept.
    expect(sent.filter((m) => m.type === "reolink_viewer/wall/layouts/save")).toEqual([]);
    expect(text()).toContain("Save it as a layout to keep this order");
  });
  it("saves a new layout and opens it; saves as new, and deletes", async () => {
    const layouts: WallLayout[] = [];
    const { hass, sent } = fakeHass(layouts);
    const { el, routes, button, cells } = await mount(hass);
    button("Layout")?.click();
    await el.updateComplete;
    const form = el.shadowRoot?.querySelector("form");
    expect(form).not.toBeNull();
    // Nothing named yet: said, not saved.
    form?.dispatchEvent(new Event("submit", { cancelable: true }));
    await flush();
    expect(el.shadowRoot?.textContent).toContain("Give the layout a name.");
    const name = form?.querySelector<HTMLInputElement>("input:not([type])");
    if (!name) throw new Error("no name");
    name.value = "Porch";
    name.dispatchEvent(new Event("input"));
    const twoByTwo = form?.querySelector<HTMLInputElement>('input[value="2x2"]');
    twoByTwo?.click();
    twoByTwo?.dispatchEvent(new Event("change"));
    await el.updateComplete;
    // The grid shows the choice at once.
    expect(cells()).toHaveLength(4);
    // Step 4: the wall tablet's layout leaves out the feeds' siren buttons.
    const siren = [...(form?.querySelectorAll<HTMLLabelElement>(".shows label") ?? [])].find((l) =>
      l.textContent.includes("Siren buttons"),
    );
    const sirenBox = siren?.querySelector("input");
    if (!sirenBox) throw new Error("no siren switch");
    sirenBox.checked = false;
    sirenBox.dispatchEvent(new Event("change"));
    form?.dispatchEvent(new Event("submit", { cancelable: true }));
    await flush();
    expect(sent.filter((m) => m.type === "reolink_viewer/wall/layouts/save")).toEqual([
      {
        type: "reolink_viewer/wall/layouts/save",
        name: "Porch",
        grid: "2x2",
        cameras: [],
        tour_s: null,
        floodlight: true,
        siren: false,
        strip: true,
      },
    ]);
    expect(routes.at(-1)).toEqual({ view: "wall", layout: "porch" });

    // Opened by its address: saved again as new, then deleted.
    el.layoutId = "porch";
    await el.updateComplete;
    button("Layout")?.click();
    await el.updateComplete;
    button("Save as new")?.click();
    await flush();
    expect(sent.filter((m) => m.type === "reolink_viewer/wall/layouts/save").at(-1)).not.toHaveProperty("layout_id");
    button("Layout")?.click();
    await el.updateComplete;
    button("Delete")?.click();
    await flush();
    expect(sent.filter((m) => m.type === "reolink_viewer/wall/layouts/delete")).toEqual([
      { type: "reolink_viewer/wall/layouts/delete", layout_id: "porch" },
    ]);
    expect(routes.at(-1)).toEqual({ view: "wall" });
  });

  it("changes layout from its bar, and goes back to the board, remembered", async () => {
    rememberLayout("front");
    rememberMode("wall");
    const { hass } = fakeHass([FRONT]);
    const { el, routes, button } = await mount(hass);
    const select = el.shadowRoot?.querySelector("select");
    expect(select?.value).toBe("front");
    if (!select) throw new Error("no select");
    select.value = "";
    select.dispatchEvent(new Event("change"));
    expect(routes.at(-1)).toEqual({ view: "wall" });
    expect(rememberedLayout()).toBeUndefined();
    button("Board")?.click();
    expect(routes.at(-1)).toEqual({ view: "live" });
    expect(rememberedMode()).toBe("board");
  });
});

describe("the latest detections, and what a layout shows (step 4)", () => {
  const NOW = Date.parse("2026-11-09T15:00:00Z");
  const sensored = CAMERAS.map((c) => ({
    ...c,
    detection: { [`binary_sensor.${c.id}_person`]: "PERSON", [`binary_sensor.${c.id}_motion`]: "MOTION" },
    controls: { siren: `siren.${c.id}`, floodlight: `light.${c.id}`, preset: `select.${c.id}_preset` },
  }));
  const latest = {
    events: [
      { camera_id: "yard", start: NOW - 60_000, end: NOW - 30_000, types: ["MOTION", "PERSON"], segment: "1", new: true },
      { camera_id: "garage", start: NOW - 7_200_000, end: NOW - 7_180_000, types: ["VEHICLE"], segment: "2", new: false },
    ],
    cameras: 3,
    failed: [],
    since: 0,
    now: NOW,
  };
  const marks = {
    enabled: true,
    built: true,
    marks: [
      {
        camera: "garage",
        kind: "vehicle",
        start: NOW - 7_200_000,
        end: NOW - 7_180_000,
        score: 3,
        line: 1,
        unusual: true,
        reason: "Vehicle at night.",
        terms: [],
      },
    ],
    cameras: {},
  };
  const answers = {
    "reolink_viewer/events/latest": latest,
    "reolink_viewer/unusual/marks": marks,
    "reolink_viewer/thumbnail/urls": { urls: [{ time: 0, url: "/thumb.jpg" }] },
    "reolink_viewer/events/seen": {},
  };
  const strip = (el: HTMLElement) => el.shadowRoot?.querySelector("rv-wall-strip");
  const cards = (el: HTMLElement) => [...(strip(el)?.shadowRoot?.querySelectorAll<HTMLButtonElement>("button.card") ?? [])];
  /** A card's words, as its visible text (its name) reads, the board's number aside. */
  const words = (card: HTMLElement | undefined) => {
    const copy = card?.cloneNode(true) as HTMLElement | undefined;
    copy?.querySelector(".num")?.remove();
    return (copy?.textContent ?? "").replace(/\s+/g, " ").trim();
  };
  const settle = async (el: HTMLElement & { updateComplete: Promise<boolean> }) => {
    await flush();
    await el.updateComplete;
    const s = strip(el);
    await s?.updateComplete;
    await flush();
    await s?.updateComplete;
  };

  it("shows each camera's newest detection, New and Unusual, and opens its recording", async () => {
    const { hass, sent } = fakeHass([], sensored, answers);
    const { el, routes } = await mount(hass);
    await settle(el);
    // Newest first: the yard's person (new), then the garage's vehicle (marked unusual).
    expect(cards(el).map(words)).toEqual(["Person New Front Yard 14:59", "Vehicle Unusual Garage 13:00"]);
    expect(cards(el)[0]?.title).toBe("Open the recording");
    expect(cards(el)[0]?.querySelector(".tag")?.textContent).toBe("New");
    expect(cards(el)[1]?.querySelector(".badge.unusual")?.textContent).toBe("Unusual");
    expect(cards(el)[0]?.querySelector(".num")?.textContent).toBe("2");
    expect(cards(el)[0]?.querySelector("img")?.getAttribute("src")).toBe("/thumb.jpg");
    expect(sent.some((m) => m.type === "reolink_viewer/unusual/marks")).toBe(true);
    // A tap opens the recording, and it is new no more.
    cards(el)[0]?.click();
    await settle(el);
    expect(sent).toContainEqual({ type: "reolink_viewer/events/seen", camera_id: "yard", start: NOW - 60_000 });
    expect(routes.at(-1)).toEqual({ view: "device", id: "yard", tab: "playback", at: NOW - 60_000 });
    expect(cards(el)[0]?.textContent).not.toContain("New");
  });

  it("lights a tile while its camera detects, says so first on the strip, and asks again when it ends", async () => {
    const { hass, sent } = fakeHass([], sensored, answers);
    const { el, tiles } = await mount(hass);
    await settle(el);
    const asked = () => sent.filter((m) => m.type === "reolink_viewer/events/latest").length;
    const before = asked();
    // The garage's person sensor turns on: its tile at once, and a Now card first.
    el.hass = {
      ...hass,
      states: { "binary_sensor.garage_person": { state: "on", last_changed: new Date(NOW).toISOString() } },
    } as unknown as HomeAssistant;
    await settle(el);
    const garage = tiles().find((t) => t.camera?.id === "garage");
    expect(garage?.detecting).toEqual({ label: "Person", icon: "person" });
    expect(garage?.hasAttribute("detecting")).toBe(true);
    expect(garage?.closest(".cell")?.getAttribute("aria-label")).toContain("now: Person");
    expect(words(cards(el)[0])).toBe("Person Now Garage 15:00");
    expect(cards(el)[0]?.title).toBe("Show it large");
    expect(cards(el)[0]?.querySelector(".tag")?.textContent).toBe("Now");
    // A tap on it shows the camera large.
    cards(el)[0]?.click();
    await settle(el);
    expect(garage?.full).toBe(true);
    garage?.exitFull();
    // It ends: the tile goes dark and the strip asks again.
    el.hass = { ...hass, states: { "binary_sensor.garage_person": { state: "off", last_changed: "" } } } as unknown as HomeAssistant;
    await settle(el);
    expect(garage?.detecting).toBeUndefined();
    expect(asked()).toBeGreaterThan(before);
  });

  it("leaves out the feeds' floodlight and siren buttons, and the strip, as the layout says", async () => {
    const quiet: WallLayout = { id: "kiosk", name: "Kiosk", grid: "2x2", cameras: [], tour_s: null, floodlight: false, siren: false, strip: false };
    const { hass } = fakeHass([quiet], sensored, answers);
    const { el, tiles } = await mount(hass, "kiosk");
    await settle(el);
    expect(tiles()[0]?.controls).toEqual({ preset: "select.door_preset" });
    expect(strip(el)).toBeNull();
    // All cameras shows them all.
    const all = await mount(fakeHass([], sensored, answers).hass);
    await settle(all.el);
    expect(all.tiles()[0]?.controls).toEqual({ siren: "siren.door", floodlight: "light.door", preset: "select.door_preset" });
    expect(strip(all.el)).not.toBeNull();
  });
});

describe("the Wall as a kiosk (step 5)", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(window, "fully");
  });

  it("hides the pointer after a few seconds still, and shows it when it moves", async () => {
    const { hass } = fakeHass([]);
    const { el } = await mount(hass);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    el.dispatchEvent(new PointerEvent("pointermove"));
    expect(el.hasAttribute("idle")).toBe(false);
    vi.advanceTimersByTime(IDLE_CURSOR_MS - 10);
    expect(el.hasAttribute("idle")).toBe(false);
    vi.advanceTimersByTime(20);
    expect(el.hasAttribute("idle")).toBe(true);
    el.dispatchEvent(new PointerEvent("pointermove"));
    expect(el.hasAttribute("idle")).toBe(false);
  });

  it("keeps the screen awake while it shows, where the browser can, and lets go after", async () => {
    const release = vi.fn(() => Promise.resolve());
    const request = vi.fn(() => Promise.resolve({ release, addEventListener: vi.fn() }));
    vi.stubGlobal("navigator", Object.assign(Object.create(navigator) as Navigator, { wakeLock: { request } }));
    const { hass } = fakeHass([]);
    const { el } = await mount(hass);
    expect(request).toHaveBeenCalledWith("screen");
    el.remove();
    expect(release).toHaveBeenCalled();
  });

  it("under Fully Kiosk, leaves the screen to Fully, and its tiles sleep while its screen is off", async () => {
    const request = vi.fn();
    vi.stubGlobal("navigator", Object.assign(Object.create(navigator) as Navigator, { wakeLock: { request } }));
    const bind = vi.fn();
    Object.assign(window, { fully: { bind } });
    const { hass } = fakeHass([]);
    const { el, tiles } = await mount(hass);
    expect(request).not.toHaveBeenCalled();
    expect(bind).toHaveBeenCalledWith("screenOff", expect.stringContaining("__reolinkViewerFully"));
    const fully = (event: string) => {
      window.__reolinkViewerFully?.(event);
    };
    fully("screenOff");
    await el.updateComplete;
    expect(tiles().every((t) => t.suspended)).toBe(true);
    fully("screenOn");
    await el.updateComplete;
    expect(tiles().some((t) => t.suspended)).toBe(false);
  });
});

describe("wall routes", () => {
  it("has an address for the Wall and for each saved layout", () => {
    expect(routeFromHash("#wall")).toEqual({ view: "wall" });
    expect(routeFromHash("#wall/front-of-house")).toEqual({ view: "wall", layout: "front-of-house" });
    expect(routeToHash({ view: "wall" })).toBe("#wall");
    expect(routeToHash({ view: "wall", layout: "night watch" })).toBe("#wall/night%20watch");
    expect(routeFromHash("#wall/night%20watch")).toEqual({ view: "wall", layout: "night watch" });
  });
});

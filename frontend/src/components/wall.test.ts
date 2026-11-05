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

const { ALL_CAMERAS, wallCameras } = await import("./wall");

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

function fakeHass(layouts: WallLayout[]) {
  const sent: Record<string, unknown>[] = [];
  const hass = {
    user: { is_admin: false },
    states: {},
    config: { time_zone: "UTC" },
    callService: vi.fn(() => Promise.resolve(undefined)),
    callWS: vi.fn((message: Record<string, unknown>) => {
      sent.push(message);
      if (message.type === "reolink_viewer/live/cameras") return Promise.resolve({ cameras: CAMERAS });
      if (message.type === "web_rtc/ice_servers") return Promise.resolve([]);
      if (message.type === "reolink_viewer/wall/layouts") return Promise.resolve({ layouts: [...layouts] });
      if (message.type === "reolink_viewer/wall/layouts/save") {
        const layout: WallLayout = {
          id: (message.layout_id as string | undefined) ?? "porch",
          name: String(message.name),
          grid: message.grid as WallLayout["grid"],
          cameras: message.cameras as string[],
          tour_s: null,
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
    expect(tiles()[0]?.getAttribute("style")).toContain("grid-column: 1 / span 2; grid-row: 1 / span 2");
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

  it("says when there are more cameras than cells", async () => {
    const { hass } = fakeHass([{ ...FRONT, grid: "1", cameras: [] }]);
    const { tiles, text } = await mount(hass, "front");
    expect(tiles()).toHaveLength(1);
    expect(text()).toContain("2 more cameras than cells");
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
    form?.dispatchEvent(new Event("submit", { cancelable: true }));
    await flush();
    expect(sent.filter((m) => m.type === "reolink_viewer/wall/layouts/save")).toEqual([
      { type: "reolink_viewer/wall/layouts/save", name: "Porch", grid: "2x2", cameras: [], tour_s: null },
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

describe("wall routes", () => {
  it("has an address for the Wall and for each saved layout", () => {
    expect(routeFromHash("#wall")).toEqual({ view: "wall" });
    expect(routeFromHash("#wall/front-of-house")).toEqual({ view: "wall", layout: "front-of-house" });
    expect(routeToHash({ view: "wall" })).toBe("#wall");
    expect(routeToHash({ view: "wall", layout: "night watch" })).toBe("#wall/night%20watch");
    expect(routeFromHash("#wall/night%20watch")).toEqual({ view: "wall", layout: "night watch" });
  });
});

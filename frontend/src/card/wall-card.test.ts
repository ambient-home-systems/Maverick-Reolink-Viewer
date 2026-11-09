import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { HomeAssistant, LiveCamera, WallLayout } from "../types";
import { rememberedMode, rememberedLayout } from "../wall/remember";

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

const { ReolinkViewerWallCard } = await import("./index");
const { WALL_CARD_DOCS, WALL_GRID_OPTIONS, storedWallConfig, wallCardConfig } = await import("./wall-config");
const { PANEL_PATH } = await import("./panel");

const encoding = { codec: "h264", frame_rate: 15, bit_rate: 512, width: 896, height: 512 };
const CAMERAS: LiveCamera[] = ["yard", "door", "garage"].map((id) => ({
  id,
  name: id,
  model: "RLC-520A",
  records: true,
  connections: [
    {
      connection_id: `${id}-conn`,
      via: "direct",
      entry_title: id,
      is_battery: false,
      streams: { sub: { encoding, entity_id: null, warm: false } },
    },
  ],
}));
const NIGHT: WallLayout = { id: "night", name: "Night", grid: "2x2", cameras: ["garage", "yard"], tour_s: null };

function fakeHass(layouts: WallLayout[] = [NIGHT]) {
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
      if (message.type === "reolink_viewer/wall/layouts") return Promise.resolve({ layouts });
      return Promise.resolve(null);
    }),
    connection: { subscribeMessage: vi.fn(() => Promise.resolve(() => Promise.resolve())) },
  } as unknown as HomeAssistant;
  return { hass, sent };
}

const flush = async () => {
  for (let i = 0; i < 6; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
};

async function mountCard(config: Record<string, unknown>, hass: HomeAssistant) {
  const card = document.createElement("reolink-viewer-wall");
  card.setConfig({ type: "custom:reolink-viewer-wall", ...config });
  card.hass = hass;
  document.body.appendChild(card);
  await customElements.whenDefined("rv-wall-card");
  await flush();
  await card.updateComplete;
  const body = card.shadowRoot?.querySelector("rv-wall-card");
  await body?.updateComplete;
  const wall = body?.shadowRoot?.querySelector("rv-wall");
  await flush();
  await wall?.updateComplete;
  return { card, wall };
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("the Wall card's settings", () => {
  it("has plain defaults, keeps what differs, and says what is wrong", () => {
    expect(wallCardConfig({ type: "custom:reolink-viewer-wall" })).toEqual({
      type: "custom:reolink-viewer-wall",
      show_bar: true,
    });
    expect(wallCardConfig({ layout: "night", show_bar: false })).toEqual({
      type: "custom:reolink-viewer-wall",
      layout: "night",
      show_bar: false,
    });
    expect(() => wallCardConfig({ layout: 3 })).toThrow(/layout: a saved layout's id/);
    expect(() => wallCardConfig({ show_bar: "no" })).toThrow(/show_bar: true or false/);
    expect(() => wallCardConfig(null)).toThrow(/needs its settings/);
    expect(storedWallConfig({ type: "custom:reolink-viewer-wall", extra: 1 }, { layout: "night", show_bar: true })).toEqual(
      { type: "custom:reolink-viewer-wall", extra: 1, layout: "night" },
    );
    expect(storedWallConfig({ type: "x", layout: "night" }, { layout: "", show_bar: false })).toEqual({
      type: "x",
      show_bar: false,
    });
  });

  it("is in the card picker beside the camera card, with the user guide's section", () => {
    const cards = window.customCards ?? [];
    expect(cards.map((c) => c.type)).toEqual(expect.arrayContaining(["reolink-viewer-camera", "reolink-viewer-wall"]));
    const wall = cards.find((c) => c.type === "reolink-viewer-wall");
    expect(wall).toMatchObject({ name: "Reolink Wall", preview: false, documentationURL: WALL_CARD_DOCS });
    const card = new ReolinkViewerWallCard();
    expect(card.getCardSize()).toBeGreaterThanOrEqual(6);
    expect(card.getGridOptions()).toEqual(WALL_GRID_OPTIONS);
    expect(ReolinkViewerWallCard.getStubConfig()).toEqual({});
  });
});

describe("custom:reolink-viewer-wall", () => {
  it("shows its saved layout, with a short bar and nothing remembered on the device", async () => {
    const { hass } = fakeHass();
    const { wall } = await mountCard({ layout: "night" }, hass);
    expect(wall?.card).toBe(true);
    expect(wall?.hasAttribute("card")).toBe(true);
    const root = wall?.shadowRoot;
    const tiles = [...(root?.querySelectorAll("rv-live-tile") ?? [])];
    expect(tiles.map((t) => t.camera?.id)).toEqual(["garage", "yard"]);
    expect(root?.querySelector(".bar .name")?.textContent).toBe("Night");
    // No layout list, no editing, no way to the board: a card shows what it is given.
    expect(root?.querySelector(".bar select")).toBeNull();
    const words = [...(root?.querySelectorAll(".bar button") ?? [])].map((b) => b.textContent.trim());
    expect(words).not.toContain("Arrange");
    expect(words.some((w) => w.startsWith("Layout"))).toBe(false);
    expect(words.some((w) => w.endsWith("Board"))).toBe(false);
    // Nothing remembered: the panel on this device still opens as it did.
    expect(rememberedMode()).toBe("board");
    expect(rememberedLayout()).toBeUndefined();
  });

  it("shows every camera without a layout, says so for one not the user's, and can hide its bar", async () => {
    const { hass } = fakeHass();
    const { wall } = await mountCard({}, hass);
    expect(wall?.shadowRoot?.querySelectorAll("rv-live-tile")).toHaveLength(3);
    document.body.innerHTML = "";
    const other = await mountCard({ layout: "someone-elses" }, hass);
    expect(other.wall?.shadowRoot?.querySelector(".bar")?.textContent).toContain(
      "No layout “someone-elses” of yours: every camera instead",
    );
    document.body.innerHTML = "";
    const bare = await mountCard({ layout: "night", show_bar: false }, hass);
    expect(bare.wall?.shadowRoot?.querySelector(".bar")).toBeNull();
  });

  it("opens what a tap opens in the panel", async () => {
    const { hass } = fakeHass();
    const { wall } = await mountCard({ layout: "night" }, hass);
    const changed: unknown[] = [];
    window.addEventListener("location-changed", (e) => changed.push(e), { once: true });
    wall?.dispatchEvent(
      new CustomEvent("rv-navigate", {
        detail: { view: "device", id: "yard", tab: "playback", at: 5 },
        bubbles: true,
        composed: true,
      }),
    );
    expect(window.location.pathname + window.location.hash).toBe(`${PANEL_PATH}#device/yard/playback/5`);
    expect(changed).toHaveLength(1);
  });
});

describe("the Wall card's editor", () => {
  async function mountEditor(config: Record<string, unknown>, layouts: WallLayout[] = [NIGHT]) {
    const element = (await ReolinkViewerWallCard.getConfigElement()) as HTMLElement & {
      hass?: HomeAssistant;
      setConfig(config: Record<string, unknown>): void;
      updateComplete: Promise<boolean>;
    };
    element.setConfig({ type: "custom:reolink-viewer-wall", ...config });
    element.hass = fakeHass(layouts).hass;
    const changes: Record<string, unknown>[] = [];
    element.addEventListener("config-changed", (e) => changes.push((e as CustomEvent<{ config: Record<string, unknown> }>).detail.config));
    document.body.appendChild(element);
    await flush();
    await element.updateComplete;
    return { element, changes };
  }

  it("chooses one of the user's layouts, or every camera, and the bar", async () => {
    const { element, changes } = await mountEditor({});
    const select = element.shadowRoot?.querySelector("select");
    expect([...(select?.options ?? [])].map((o) => o.textContent.trim())).toEqual(["All cameras", "Night"]);
    if (!select) throw new Error("no layout list");
    select.value = "night";
    select.dispatchEvent(new Event("change"));
    expect(changes.at(-1)).toEqual({ type: "custom:reolink-viewer-wall", layout: "night" });
    const bar = element.shadowRoot?.querySelector<HTMLInputElement>('input[type="checkbox"]');
    if (!bar) throw new Error("no bar switch");
    bar.checked = false;
    bar.dispatchEvent(new Event("change"));
    expect(changes.at(-1)).toEqual({ type: "custom:reolink-viewer-wall", layout: "night", show_bar: false });
    expect(element.shadowRoot?.textContent).toContain("Layouts are made on the Reolink panel's Wall");
  });

  it("keeps a layout that is not the user's, saying so, and leaves wrong settings to the YAML", async () => {
    const { element } = await mountEditor({ layout: "theirs" });
    const options = [...(element.shadowRoot?.querySelectorAll("option") ?? [])].map((o) => o.textContent.trim());
    expect(options).toContain("“theirs” (not one of yours)");
    document.body.innerHTML = "";
    const wrong = await mountEditor({ show_bar: "maybe" });
    expect(wrong.element.shadowRoot?.textContent).toContain("can only be changed in the card's YAML");
  });
});

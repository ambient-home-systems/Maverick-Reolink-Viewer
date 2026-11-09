import { LitElement, css, html, nothing, svg, type PropertyValues, type TemplateResult } from "lit";

import { deleteWallLayout, fetchWallLayouts, saveWallLayout, toError } from "../api";
import { icon } from "../icons";
import { LiveData, isWarm, liveConnection } from "../live/data";
import { formatClock } from "../playback/time";
import { sharedStyles } from "../styles";
import type { HomeAssistant, LiveCamera, LiveControls, WallGrid, WallLayout } from "../types";
import { ARROWS, neighbour, pageCount, swapCells, wallOrder } from "../wall/arrange";
import { WALL_GAP, WALL_GRIDS, slotSize, wallFit, wallPlan, type WallPlan } from "../wall/geometry";
import { tilesInHd, type WallCell } from "../wall/hd";
import { rememberLayout, rememberMode, rememberedLayout } from "../wall/remember";
import { boardOrder, tileShape } from "./live-grid";
import "./live-tile";
import { navigate } from "./navigation";
import { eventLabel, pictogram } from "./timetable";
import type { DetectingNow } from "./wall-strip";
import "./wall-strip";

/** Every camera, in the board's order, packed by Auto: what the Wall shows without a layout. */
export const ALL_CAMERAS: WallLayout = { id: "", name: "All cameras", grid: "auto", cameras: [], tour_s: null };

/**
 * The camera in each cell of a layout: its own cameras by id (one gone, or a
 * cell left empty, is undefined), or every camera in the board's order.
 */
export function wallCameras(layout: WallLayout, all: readonly LiveCamera[]): (LiveCamera | undefined)[] {
  if (!layout.cameras.length) return boardOrder([...all]);
  const byId = new Map(all.map((c) => [c.id, c]));
  return layout.cameras.map((id) => (id ? byId.get(id) : undefined));
}

/** The sub stream's width over its height, when the camera reported its size. */
function pictureRatio(camera: LiveCamera): number | undefined {
  const encoding = liveConnection(camera)?.streams.sub?.encoding;
  return encoding?.width && encoding.height ? encoding.width / encoding.height : undefined;
}

/**
 * The Wall (Phase 9 step 1): the cameras' feeds only, large, fitted to the
 * screen like an NVR's monitor, in a saved layout (per Home Assistant user,
 * on the server; each device remembers which it shows). A thin bar holds the
 * layout, the clock, full screen and the way back to the board.
 *
 * Arranging (step 2): drag a tile onto another, or Arrange and tap two, to
 * swap them; a double tap (or Enter) puts a camera in the large slot, or
 * alone on the screen and back. From the keyboard, the arrows move between
 * cells and Shift with an arrow moves the camera, each move said to a screen
 * reader. A saved layout keeps its order. More cameras than cells make pages,
 * and a layout's tour turns them.
 *
 * The latest detections (step 4): a tile lights up red with what its camera
 * detects while one of its sensors is on (from Home Assistant's states, at
 * once), and a strip along the bottom holds each camera's newest detection,
 * asked again when one ends. A layout may leave out the feeds' floodlight
 * and siren buttons (the owner's ask) and the strip.
 */
export class RvWall extends LitElement {
  static override properties = {
    hass: { attribute: false },
    layoutId: { attribute: false },
    _layouts: { state: true },
    _editing: { state: true },
    _draft: { state: true },
    _error: { state: true },
    _size: { state: true },
    _full: { state: true },
    _wallFull: { state: true },
    _now: { state: true },
    _order: { state: true },
    _page: { state: true },
    _alone: { state: true },
    _arranging: { state: true },
    _picked: { state: true },
    _focus: { state: true },
    _said: { state: true },
    _over: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  /** The saved layout asked for (#wall/<id>); none: the one this device showed last. */
  declare layoutId: string | undefined;
  declare _layouts: WallLayout[] | undefined;
  declare _editing: boolean;
  declare _draft: { name: string; grid: WallGrid; tour_s: number | null } & Shown;
  declare _error: string | undefined;
  declare _size: { width: number; height: number };
  /** The camera full screen, if any (the others pause). */
  declare _full: string | undefined;
  declare _wallFull: boolean;
  declare _now: number;
  /** The order arranged here, not yet in a saved layout (All cameras) or saving. */
  declare _order: (string | null)[] | undefined;
  declare _page: number;
  /** A camera shown alone on the screen (a double tap), until the next. */
  declare _alone: string | undefined;
  /** Arrange: a tap picks a cell, a tap on another swaps them. */
  declare _arranging: boolean;
  declare _picked: number | undefined;
  /** The cell the keyboard is on, on this page. */
  declare _focus: number;
  /** What a screen reader is told of the last move. */
  declare _said: string;
  /** The cell a dragged tile is over. */
  declare _over: number | undefined;

  private readonly _data = new LiveData(this);
  private _resize: ResizeObserver | undefined;
  private _clock: ReturnType<typeof setTimeout> | undefined;
  private _tour: ReturnType<typeof setInterval> | undefined;
  private _tourEvery = 0;
  private _asked = false;
  /** The layout the arrangement is of (another one starts afresh). */
  private _arranged: string | undefined;
  /** Focus follows the keyboard's move once rendered. */
  private _refocus = false;
  /** The cell being dragged (its index across pages). */
  private _dragged: number | undefined;
  /** The cameras whose sensors detected something at the last look. */
  private _wasDetecting = new Set<string>();

  constructor() {
    super();
    this._editing = false;
    this._draft = { name: "", grid: "auto", tour_s: null, ...SHOW_ALL };
    this._page = 0;
    this._arranging = false;
    this._focus = 0;
    this._said = "";
    this._size = { width: 0, height: 0 };
    this._wallFull = false;
    this._now = Date.now();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    rememberMode("wall");
    document.addEventListener("fullscreenchange", this._onFullscreen);
    this._tick();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener("fullscreenchange", this._onFullscreen);
    this._resize?.disconnect();
    this._resize = undefined;
    clearTimeout(this._clock);
    this._stopTour();
  }

  private readonly _onFullscreen = (): void => {
    this._wallFull = document.fullscreenElement === this;
  };

  private _tick(): void {
    this._now = Date.now();
    clearTimeout(this._clock);
    this._clock = setTimeout(
      () => {
        this._tick();
      },
      60_000 - (this._now % 60_000) + 50,
    );
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    this._data.hass = this.hass;
    if (changed.has("hass")) {
      // A detection that ended is listed by the camera soon: the strip asks again.
      const on = new Set(this._detecting().keys());
      const ended = [...this._wasDetecting].some((id) => !on.has(id));
      this._wasDetecting = on;
      if (ended) this.shadowRoot?.querySelector("rv-wall-strip")?.refreshSoon();
    }
    if (changed.has("hass") && this.hass && !this._asked) {
      this._asked = true;
      void this._loadLayouts(this.hass);
    }
    // Another layout: its own order, from its first page.
    const shown = this._layout.id;
    if (shown !== this._arranged) {
      this._arranged = shown;
      this._order = undefined;
      this._page = 0;
      this._alone = undefined;
      this._picked = undefined;
      this._focus = 0;
    }
  }

  protected override updated(): void {
    // The cells' own size, which fits the grid and each picture to the screen.
    const cells = this.shadowRoot?.querySelector<HTMLElement>(".cells");
    if (cells && !this._resize && typeof ResizeObserver !== "undefined") {
      this._resize = new ResizeObserver((entries) => {
        const box = entries.at(-1)?.contentRect;
        if (box && (Math.abs(box.width - this._size.width) >= 1 || Math.abs(box.height - this._size.height) >= 1)) {
          this._size = { width: box.width, height: box.height };
        }
      });
      this._resize.observe(cells);
    }
    const layout = this._layout;
    if (this._layouts !== undefined) rememberLayout(layout.id || undefined);
    this._syncTour();
    if (this._refocus) {
      this._refocus = false;
      this.shadowRoot?.querySelector<HTMLElement>(`.cell[data-slot="${String(this._focus)}"]`)?.focus();
    }
  }

  private async _loadLayouts(hass: HomeAssistant): Promise<void> {
    try {
      this._layouts = (await fetchWallLayouts(hass)).layouts;
    } catch (err) {
      this._layouts = [];
      this._error = `The saved layouts could not be read: ${toError(err).message}`;
    }
  }

  /** The layout shown: the one asked for, else the one this device showed last, else every camera. */
  private get _layout(): WallLayout {
    const layouts = this._layouts ?? [];
    const id = this.layoutId ?? rememberedLayout();
    return layouts.find((l) => l.id === id) ?? ALL_CAMERAS;
  }

  /** What the layout shows (the editor's choice while editing): the feeds' buttons, the strip. */
  private get _shown(): Shown {
    if (this._editing) {
      const { floodlight, siren, strip } = this._draft;
      return { floodlight, siren, strip };
    }
    return shownBy(this._layout);
  }

  /** A camera's controls on this layout's feeds: its floodlight and siren buttons only if shown. */
  private _controls(camera: LiveCamera): LiveControls | undefined {
    const controls = camera.controls;
    if (!controls) return undefined;
    const { floodlight, siren, ...rest } = controls;
    const shown = this._shown;
    return {
      ...rest,
      ...(shown.floodlight && floodlight ? { floodlight } : {}),
      ...(shown.siren && siren ? { siren } : {}),
    };
  }

  /** What each camera's sensors detect now (Phase 9 step 4), by camera id. */
  private _detecting(): Map<string, DetectingNow> {
    const states = this.hass?.states ?? {};
    const found = new Map<string, DetectingNow>();
    for (const camera of this._data.cameras ?? []) {
      const types: string[] = [];
      let since = Number.POSITIVE_INFINITY;
      for (const [entity, type] of Object.entries(camera.detection ?? {})) {
        const state = states[entity];
        if (state?.state !== "on") continue;
        if (!types.includes(type)) types.push(type);
        since = Math.min(since, Date.parse(state.last_changed));
      }
      if (types.length) found.set(camera.id, { types, since: Number.isFinite(since) ? since : Date.now() });
    }
    return found;
  }

  /** A detection going on, from the strip: that camera large (full screen, or alone if not on this page). */
  private _showLarge(id: string): void {
    const tile = [...(this.shadowRoot?.querySelectorAll("rv-live-tile") ?? [])].find((t) => t.camera?.id === id);
    if (tile) {
      tile.enterFull();
      return;
    }
    this._alone = id;
    this._said = `${this._name(id)} alone on the screen. Escape, or a double tap, to go back.`;
  }

  private _toggleFull(): void {
    if (document.fullscreenElement === this) void document.exitFullscreen().catch(() => undefined);
    else void this.requestFullscreen().catch(() => undefined);
  }

  private _show(id: string): void {
    if (!id) rememberLayout(undefined);
    navigate(this, id ? { view: "wall", layout: id } : { view: "wall" });
  }

  private _edit(): void {
    const layout = this._layout;
    this._draft = { name: layout.id ? layout.name : "", grid: layout.grid, tour_s: layout.tour_s, ...shownBy(layout) };
    this._error = undefined;
    this._editing = true;
  }

  private async _save(asNew: boolean): Promise<void> {
    const hass = this.hass;
    if (!hass) return;
    const layout = this._layout;
    const name = this._draft.name.trim();
    if (!name) {
      this._error = "Give the layout a name.";
      return;
    }
    try {
      const { layout: saved } = await saveWallLayout(hass, {
        ...(layout.id && !asNew ? { id: layout.id } : {}),
        name,
        grid: this._draft.grid,
        cameras: this._order ?? layout.cameras,
        tour_s: this._draft.tour_s,
        floodlight: this._draft.floodlight,
        siren: this._draft.siren,
        strip: this._draft.strip,
      });
      await this._loadLayouts(hass);
      this._editing = false;
      this._error = undefined;
      navigate(this, { view: "wall", layout: saved.id });
    } catch (err) {
      this._error = `Could not save it: ${toError(err).message}`;
    }
  }

  private async _delete(): Promise<void> {
    const hass = this.hass;
    const layout = this._layout;
    if (!hass || !layout.id) return;
    try {
      await deleteWallLayout(hass, layout.id);
      await this._loadLayouts(hass);
      this._editing = false;
      this._show("");
    } catch (err) {
      this._error = `Could not delete it: ${toError(err).message}`;
    }
  }

  /** What is on the screen: the order, its pages, this page's cameras and their cells. */
  private get _view(): {
    order: (string | null)[];
    perPage: number;
    pages: number;
    page: number;
    shown: (LiveCamera | undefined)[];
    plan: WallPlan;
  } {
    const layout = this._layout;
    const grid = this._editing ? this._draft.grid : layout.grid;
    const cameras = this._data.cameras ?? [];
    const byId = new Map(cameras.map((c) => [c.id, c]));
    const order = this._order ?? wallOrder(layout, boardOrder([...cameras]).map((c) => c.id));
    const { width, height } = this._size;
    const shapes = (list: (LiveCamera | undefined)[]) =>
      list.map((camera) => (camera ? tileShape(liveConnection(camera)) : undefined));
    if (this._alone && byId.has(this._alone)) {
      return { order, perPage: 1, pages: 1, page: 0, shown: [byId.get(this._alone)], plan: wallPlan("1", [], width, height) };
    }
    // Auto fits every camera on one page; a fixed grid has its cells per page.
    const perPage = grid === "auto" ? Math.max(1, order.length) : wallPlan(grid, [], width, height).slots.length;
    const pages = pageCount(order.length, perPage);
    const page = Math.min(this._page, pages - 1);
    const shown = order.slice(page * perPage, (page + 1) * perPage).map((id) => (id ? byId.get(id) : undefined));
    return { order, perPage, pages, page, shown, plan: wallPlan(grid, shapes(shown), width, height) };
  }

  private _name(id: string | null | undefined): string {
    return this._data.cameras?.find((c) => c.id === id)?.name ?? "An empty cell";
  }

  /** Swap two cells of the order (indices across pages); a saved layout keeps it. */
  private _swap(a: number, b: number): void {
    const { order } = this._view;
    if (a === b) return;
    const next = swapCells(order, a, b);
    this._order = next;
    this._said = `${this._name(order[a])} swapped with ${this._name(order[b]).toLowerCase() === "an empty cell" ? "an empty cell" : this._name(order[b])}.`;
    void this._keep(next);
  }

  /** Keep a saved layout's new order on the server (All cameras keeps it on the screen). */
  private async _keep(order: (string | null)[]): Promise<void> {
    const hass = this.hass;
    const layout = this._layout;
    if (!hass || !layout.id) return;
    try {
      const { layout: saved } = await saveWallLayout(hass, { ...layout, cameras: order });
      this._layouts = (this._layouts ?? []).map((l) => (l.id === saved.id ? saved : l));
    } catch (err) {
      this._error = `Could not keep the new order: ${toError(err).message}`;
    }
  }

  /** A double tap or Enter: into the large slot (1+5, 1+7), else alone on the screen and back. */
  private _enlarge(slot: number): void {
    const view = this._view;
    if (this._alone) {
      this._said = `${this._name(this._alone)} back in its cell.`;
      this._alone = undefined;
      return;
    }
    const index = view.page * view.perPage + slot;
    const id = view.order[index];
    if (!id) return;
    const grid = this._layout.grid;
    if (grid === "1+5" || grid === "1+7") {
      const large = view.page * view.perPage;
      if (index !== large) {
        this._swap(index, large);
        this._said = `${this._name(id)} in the large slot.`;
      }
      this._focus = 0;
      return;
    }
    this._alone = id;
    this._said = `${this._name(id)} alone on the screen. Escape, or a double tap, to go back.`;
  }

  private _goPage(page: number): void {
    const { pages } = this._view;
    this._page = ((page % pages) + pages) % pages;
    this._focus = 0;
    this._picked = undefined;
    this._said = `Page ${String(this._page + 1)} of ${String(pages)}.`;
  }

  private _onKey(e: KeyboardEvent, slot: number): void {
    // Only the cell's own keys: a tile's buttons keep theirs.
    if (e.target !== e.currentTarget) return;
    const view = this._view;
    const direction = ARROWS[e.key];
    if (direction) {
      e.preventDefault();
      const next = neighbour(view.plan, slot, direction);
      if (next === undefined) return;
      if (e.shiftKey && !this._alone) {
        const base = view.page * view.perPage;
        this._swap(base + slot, base + next);
      }
      this._focus = next;
      this._refocus = true;
    } else if (e.key === "Enter") {
      e.preventDefault();
      this._enlarge(slot);
      this._refocus = true;
    } else if (e.key === "Escape" && this._alone) {
      e.preventDefault();
      this._enlarge(slot);
      this._refocus = true;
    } else if (e.key === "PageDown" || e.key === "PageUp") {
      e.preventDefault();
      this._goPage(view.page + (e.key === "PageDown" ? 1 : -1));
      this._refocus = true;
    }
  }

  /** Arrange: the first tap picks a cell, the next swaps it with another. */
  private _tap(slot: number): void {
    const view = this._view;
    const index = view.page * view.perPage + slot;
    if (this._picked === undefined) {
      this._picked = index;
      this._said = `${this._name(view.order[index])} picked: tap where it goes.`;
    } else {
      if (this._picked !== index) this._swap(this._picked, index);
      else this._said = "Put back.";
      this._picked = undefined;
    }
  }

  /** The next page every tour_s seconds, while nothing else is going on. */
  private _syncTour(): void {
    const view = this._view;
    const every = this._layout.tour_s ?? 0;
    const touring = every > 0 && view.pages > 1 && !this._arranging && !this._editing && !this._alone && !this._full;
    if (!touring) {
      this._stopTour();
      return;
    }
    if (this._tour !== undefined && this._tourEvery === every) return;
    this._stopTour();
    this._tourEvery = every;
    this._tour = setInterval(() => {
      const { pages, page } = this._view;
      this._page = (page + 1) % pages;
    }, every * 1000);
  }

  private _stopTour(): void {
    clearInterval(this._tour);
    this._tour = undefined;
    this._tourEvery = 0;
  }

  protected override render(): TemplateResult {
    const layout = this._layout;
    const cameras = this._data.cameras;
    const view = this._view;
    const { width, height } = this._size;
    const missing = this.layoutId !== undefined && this._layouts !== undefined && layout.id !== this.layoutId;
    const canFull = document.fullscreenEnabled && typeof this.requestFullscreen === "function";
    const detecting = this._detecting();
    const numbers = new Map(boardOrder([...(cameras ?? [])]).map((c, i) => [c.id, i + 1]));
    return html`<div class="bar">
        <select
          aria-label="Layout"
          .value=${layout.id}
          @change=${(e: Event) => {
            this._show((e.target as HTMLSelectElement).value);
          }}
        >
          <option value="" ?selected=${!layout.id}>All cameras</option>
          ${(this._layouts ?? []).map(
            (l) => html`<option value=${l.id} ?selected=${l.id === layout.id}>${l.name}</option>`,
          )}
        </select>
        ${view.pages > 1
          ? html`<span class="pages" role="group" aria-label="Pages">
              <button
                class="text icon-only"
                aria-label="Previous page"
                @click=${() => {
                  this._goPage(view.page - 1);
                }}
              >
                ${icon("chevronBack")}
              </button>
              <span>${view.page + 1} / ${view.pages}</span>
              <button
                class="text icon-only"
                aria-label="Next page"
                @click=${() => {
                  this._goPage(view.page + 1);
                }}
              >
                ${icon("chevron")}
              </button>
            </span>`
          : nothing}
        ${this._alone
          ? html`<button
              class="text with-icon"
              @click=${() => {
                this._enlarge(0);
              }}
            >
              ${icon("chevronBack")}Back to the layout
            </button>`
          : nothing}
        ${this._order && !layout.id ? html`<span class="note">Save it as a layout to keep this order</span>` : nothing}
        ${missing ? html`<span class="note">No layout “${this.layoutId}”: every camera instead</span>` : nothing}
        <time class="clock" aria-label="Time">${formatClock(this._now, this.hass?.config?.time_zone)}</time>
        <button
          class="text"
          aria-pressed=${this._arranging ? "true" : "false"}
          @click=${() => {
            this._arranging = !this._arranging;
            this._picked = undefined;
            this._said = this._arranging ? "Arrange: tap a camera, then where it goes." : "";
          }}
        >
          Arrange
        </button>
        <button
          class="text with-icon"
          aria-expanded=${this._editing ? "true" : "false"}
          @click=${() => {
            if (this._editing) this._editing = false;
            else this._edit();
          }}
        >
          Layout${icon("chevronDown")}
        </button>
        ${canFull
          ? html`<button
              class="text with-icon"
              @click=${() => {
                this._toggleFull();
              }}
            >
              ${icon(this._wallFull ? "exitFull" : "enterFull")}${this._wallFull ? "Exit full screen" : "Full screen"}
            </button>`
          : nothing}
        <button
          class="text with-icon"
          @click=${() => {
            rememberMode("board");
            navigate(this, { view: "live" });
          }}
        >
          ${icon("close")}Board
        </button>
      </div>
      ${this._editing ? this._renderEditor(layout) : this._error ? html`<p class="error" role="alert">${this._error}</p>` : nothing}
      ${cameras === undefined
        ? html`<p class="note pad">${this._data.error ? `Live view could not load: ${this._data.error}` : "Loading…"}</p>`
        : this._renderCells(view.plan, view.shown, width, height, detecting, numbers)}
      ${cameras && this._shown.strip
        ? html`<rv-wall-strip
            .hass=${this.hass}
            .cameras=${boardOrder([...cameras])}
            .numbers=${numbers}
            .now=${detecting}
            .pictures=${this._data.images}
            @rv-strip-live=${(e: CustomEvent<{ cameraId: string }>) => {
              this._showLarge(e.detail.cameraId);
            }}
          ></rv-wall-strip>`
        : nothing}
      <p class="said" role="status" aria-live="polite">${this._said}</p>`;
  }

  private _renderCells(
    plan: WallPlan,
    shown: (LiveCamera | undefined)[],
    width: number,
    height: number,
    detecting: ReadonlyMap<string, DetectingNow>,
    numbers: ReadonlyMap<string, number>,
  ): TemplateResult {
    // HD in the tiles drawn larger than their sub stream, the large slot first.
    const grid = this._editing ? this._draft.grid : this._layout.grid;
    const cells = plan.slots.map((slot, i): WallCell | undefined => {
      const camera = shown[i];
      if (!camera) return undefined;
      const size = slotSize(plan, slot, width, height);
      const large = this._alone ? "alone on the screen" : (grid === "1+5" || grid === "1+7") && i === 0 ? "the large slot" : undefined;
      return { camera, ...size, fit: wallFit(pictureRatio(camera), size), ...(large ? { large } : {}) };
    });
    const hd = tilesInHd(cells, globalThis.devicePixelRatio || 1);
    return html`<div
      class="cells"
      style=${`grid-template-columns: repeat(${String(plan.cols)}, minmax(0, 1fr)); grid-template-rows: repeat(${String(plan.rows)}, minmax(0, 1fr))`}
      @rv-live-full=${(e: CustomEvent<{ cameraId: string; full: boolean }>) => {
        if (e.detail.full) this._full = e.detail.cameraId;
        else if (this._full === e.detail.cameraId) this._full = undefined;
      }}
    >
      ${plan.slots.map((slot, i) => {
        const place = `grid-column: ${String(slot.col + 1)} / span ${String(slot.cols)}; grid-row: ${String(slot.row + 1)} / span ${String(slot.rows)}`;
        const camera = shown[i];
        const view = this._view;
        const index = view.page * view.perPage + i;
        const name = camera?.name ?? "Empty cell";
        const now = camera ? detecting.get(camera.id) : undefined;
        const where = this._alone ? "alone on the screen" : `cell ${String(i + 1)} of ${String(plan.slots.length)}`;
        return html`<div
          class="cell ${this._picked === index ? "picked" : ""} ${this._over === i ? "over" : ""}"
          style=${place}
          data-slot=${i}
          tabindex=${this._focus === i ? "0" : "-1"}
          aria-label=${`${name}, ${where}${now ? `, now: ${eventLabel(now.types)}` : ""}`}
          role="group"
          aria-roledescription="Wall cell"
          draggable=${this._alone ? "false" : "true"}
          @keydown=${(e: KeyboardEvent) => {
            this._onKey(e, i);
          }}
          @focus=${() => {
            this._focus = i;
          }}
          @dblclick=${() => {
            this._focus = i;
            this._enlarge(i);
          }}
          @dragstart=${(e: DragEvent) => {
            this._dragged = index;
            e.dataTransfer?.setData("text/plain", String(index));
            if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
          }}
          @dragend=${() => {
            this._dragged = undefined;
            this._over = undefined;
          }}
          @dragover=${(e: DragEvent) => {
            e.preventDefault();
            this._over = i;
          }}
          @dragleave=${() => {
            if (this._over === i) this._over = undefined;
          }}
          @drop=${(e: DragEvent) => {
            e.preventDefault();
            this._over = undefined;
            // Ours, or one a browser carried in its data (a WebView may not).
            const carried = e.dataTransfer?.getData("text/plain");
            const from = carried ? Number(carried) : this._dragged;
            this._dragged = undefined;
            if (from !== undefined && Number.isInteger(from)) this._swap(from, index);
          }}
        >
          ${camera
            ? html`<rv-live-tile
                fill
                .fit=${cells[i]?.fit ?? "cover"}
                .tileHd=${hd.get(camera.id)}
                .number=${numbers.get(camera.id)}
                .hass=${this.hass}
                .camera=${camera}
                .connection=${liveConnection(camera)}
                .image=${this._data.images[camera.id]}
                .iceServers=${this._data.iceServers}
                .warm=${isWarm(this.hass, camera)}
                .suspended=${this._full !== undefined && this._full !== camera.id}
                .controls=${this._controls(camera)}
                .detecting=${now ? { label: eventLabel(now.types), icon: pictogram(now.types) } : undefined}
              ></rv-live-tile>`
            : html`<div class="empty"></div>`}
          ${this._arranging
            ? html`<button
                class="pick"
                aria-pressed=${this._picked === index ? "true" : "false"}
                aria-label=${camera ? `Move ${camera.name}` : `Empty cell ${String(i + 1)}`}
                @click=${() => {
                  this._tap(i);
                }}
              ></button>`
            : nothing}
        </div>`;
      })}
    </div>`;
  }

  private _renderEditor(layout: WallLayout): TemplateResult {
    return html`<form
      class="editor"
      aria-label="Layout"
      @submit=${(e: Event) => {
        e.preventDefault();
        void this._save(false);
      }}
    >
      <label class="name">
        <span>Name</span>
        <input
          maxlength="60"
          .value=${this._draft.name}
          placeholder="Front of the house"
          @input=${(e: Event) => {
            this._draft = { ...this._draft, name: (e.target as HTMLInputElement).value };
          }}
        />
      </label>
      <fieldset class="grids">
        <legend>Grid</legend>
        ${WALL_GRIDS.map(
          ({ grid, label }) =>
            html`<label class="grid-choice">
              <input
                type="radio"
                name="grid"
                value=${grid}
                .checked=${this._draft.grid === grid}
                @change=${() => {
                  this._draft = { ...this._draft, grid };
                }}
              />${miniature(grid)}<span>${label}</span>
            </label>`,
        )}
      </fieldset>
      <label class="name">
        <span>Tour</span>
        <select
          .value=${String(this._draft.tour_s ?? "")}
          @change=${(e: Event) => {
            const value = (e.target as HTMLSelectElement).value;
            this._draft = { ...this._draft, tour_s: value ? Number(value) : null };
          }}
        >
          ${TOURS.map(
            ([seconds, label]) =>
              html`<option value=${String(seconds ?? "")} ?selected=${this._draft.tour_s === seconds}>${label}</option>`,
          )}
        </select>
      </label>
      <fieldset class="shows">
        <legend>Show</legend>
        ${SHOWN_CHOICES.map(
          ([key, label]) =>
            html`<label class="check">
              <input
                type="checkbox"
                .checked=${this._draft[key]}
                @change=${(e: Event) => {
                  this._draft = { ...this._draft, [key]: (e.target as HTMLInputElement).checked };
                }}
              />${label}
            </label>`,
        )}
      </fieldset>
      <div class="actions">
        <button type="submit">${layout.id ? "Save" : "Save layout"}</button>
        ${layout.id
          ? html`<button
                type="button"
                @click=${() => {
                  void this._save(true);
                }}
              >
                Save as new
              </button>
              <button
                type="button"
                class="text danger"
                @click=${() => {
                  void this._delete();
                }}
              >
                Delete
              </button>`
          : nothing}
        <button
          type="button"
          class="text"
          @click=${() => {
            this._editing = false;
            this._error = undefined;
          }}
        >
          Cancel
        </button>
      </div>
      ${this._error ? html`<p class="error" role="alert">${this._error}</p>` : nothing}
      <p class="note">
        Saved for you on this Home Assistant: every device you sign in on can show it, at
        <code>#wall/${layout.id || "<name>"}</code>. This device remembers the one it shows.
      </p>
    </form>`;
  }

  static override styles = [
    sharedStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        height: 100vh;
        height: 100dvh;
        overflow: hidden;
        color: var(--rv-on-board);
        background: var(--rv-board);
      }
      .bar {
        flex: none;
        display: flex;
        align-items: center;
        gap: 6px 14px;
        min-height: 40px;
        padding: 0 12px;
        flex-wrap: wrap;
      }
      .bar select {
        max-width: 40vw;
        min-height: 32px;
        padding: 0 8px;
        border: 1px solid var(--rv-on-board-muted);
        border-radius: 0;
        background: transparent;
        color: var(--rv-on-board);
        font: inherit;
        font-size: 15px;
        font-weight: 500;
      }
      .bar select option {
        color: var(--rv-text);
        background: var(--rv-ground);
      }
      .clock {
        margin-left: auto;
        font-family: var(--rv-font-cond);
        font-size: 20px;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
      }
      .bar button.text {
        min-height: 32px;
        color: var(--rv-on-board);
      }
      .bar button:focus-visible,
      .bar select:focus-visible {
        outline-color: var(--rv-on-board);
      }
      .note {
        margin: 0;
        color: var(--rv-on-board-muted);
        font-size: 14px;
      }
      .pad {
        padding: 12px;
      }
      .error {
        margin: 0;
        padding: 6px 12px;
        color: var(--rv-fault);
      }
      .cells {
        flex: 1;
        min-height: 0;
        display: grid;
        gap: ${WALL_GAP}px;
        padding: 0 ${WALL_GAP}px ${WALL_GAP}px;
      }
      .cell {
        position: relative;
        display: grid;
        min-width: 0;
        min-height: 0;
      }
      .cell > rv-live-tile,
      .cell > .empty {
        min-width: 0;
        min-height: 0;
      }
      .cell:focus-visible {
        outline: 3px solid var(--rv-on-board);
        outline-offset: -3px;
        z-index: 1;
      }
      .cell.over {
        outline: 3px dashed var(--rv-on-board);
        outline-offset: -3px;
      }
      .empty {
        background: color-mix(in srgb, var(--rv-on-board) 4%, transparent);
      }
      /* Arrange: a tap target over each cell, the picked one ringed. */
      .pick {
        position: absolute;
        inset: 0;
        border: 2px dashed color-mix(in srgb, var(--rv-on-board) 50%, transparent);
        border-radius: 0;
        background: color-mix(in srgb, var(--rv-board) 25%, transparent);
        cursor: pointer;
      }
      .pick[aria-pressed="true"] {
        border: 4px solid var(--rv-on-board);
        background: color-mix(in srgb, var(--rv-on-board) 15%, transparent);
      }
      .pick:focus-visible {
        outline: 3px solid var(--rv-on-board);
        outline-offset: -6px;
      }
      .pages {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        font-variant-numeric: tabular-nums;
      }
      .pages button svg {
        width: 20px;
        height: 20px;
      }
      .bar button[aria-pressed="true"] {
        text-decoration: underline;
        text-underline-offset: 4px;
      }
      .editor select {
        min-height: 34px;
        padding: 0 8px;
        border: 1px solid var(--rv-on-board-muted);
        border-radius: 0;
        background: transparent;
        color: var(--rv-on-board);
        font: inherit;
      }
      .editor select option {
        color: var(--rv-text);
        background: var(--rv-ground);
      }
      .said {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }
      .editor {
        flex: none;
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        gap: 10px 20px;
        padding: 10px 12px 12px;
        border-top: 1px solid color-mix(in srgb, var(--rv-on-board) 20%, transparent);
        border-bottom: 1px solid color-mix(in srgb, var(--rv-on-board) 20%, transparent);
      }
      .editor .name {
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: 14px;
      }
      .editor input:not([type]) {
        min-height: 34px;
        width: 16rem;
        max-width: 70vw;
        padding: 0 8px;
        border: 1px solid var(--rv-on-board-muted);
        background: transparent;
        color: var(--rv-on-board);
        font: inherit;
      }
      .grids {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin: 0;
        padding: 0;
        border: none;
      }
      .grids legend {
        padding: 0 0 4px;
        font-size: 14px;
      }
      .grid-choice {
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        padding: 4px 6px;
        border: 1px solid color-mix(in srgb, var(--rv-on-board) 30%, transparent);
        font-size: 13px;
        cursor: pointer;
      }
      .grid-choice:has(input:checked) {
        border-color: var(--rv-on-board);
        background: color-mix(in srgb, var(--rv-on-board) 12%, transparent);
      }
      .grid-choice input {
        position: absolute;
        opacity: 0;
        width: 1px;
        height: 1px;
      }
      .grid-choice:has(input:focus-visible) {
        outline: 2px solid var(--rv-on-board);
        outline-offset: 2px;
      }
      .grid-choice svg {
        width: 32px;
        height: 20px;
      }
      .grid-choice rect {
        fill: currentColor;
        opacity: 0.7;
      }
      .actions {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .actions button:not(.text) {
        min-height: 34px;
      }
      /* On the board's ink: the page's blue is too dark to read here. */
      .actions button.text {
        color: var(--rv-on-board);
      }
      .actions button.text:focus-visible,
      .editor input:focus-visible {
        outline-color: var(--rv-on-board);
      }
      .actions .danger {
        color: var(--rv-fault);
      }
      .editor .note {
        flex-basis: 100%;
      }
      .shows {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 14px;
        margin: 0;
        padding: 0;
        border: none;
        font-size: 14px;
      }
      .shows legend {
        padding: 0 0 4px;
      }
      .shows .check {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-height: 32px;
      }
      .editor code {
        font-family: var(--rv-mono);
      }
    `,
  ];
}

/** What a layout may leave out (step 4): the feeds' floodlight and siren buttons, the strip. */
interface Shown {
  floodlight: boolean;
  siren: boolean;
  strip: boolean;
}

const SHOW_ALL: Shown = { floodlight: true, siren: true, strip: true };

/** The editor's switches, as said there. */
const SHOWN_CHOICES: readonly [keyof Shown, string][] = [
  ["floodlight", "Floodlight buttons"],
  ["siren", "Siren buttons"],
  ["strip", "Latest detections"],
];

/** What a layout shows: everything it does not leave out (a layout kept before shows all). */
export function shownBy(layout: WallLayout): Shown {
  return { floodlight: layout.floodlight !== false, siren: layout.siren !== false, strip: layout.strip !== false };
}

/** A tour's choices: the next page every so many seconds, or none. */
const TOURS: readonly [number | null, string][] = [
  [null, "Off"],
  [10, "Every 10 s"],
  [20, "Every 20 s"],
  [30, "Every 30 s"],
  [60, "Every minute"],
  [120, "Every 2 minutes"],
];

/** A grid as a small picture of its cells, for the grid choices. */
function miniature(grid: WallGrid): TemplateResult {
  const plan = wallPlan(grid, Array.from({ length: 6 }, () => undefined), 160, 90);
  const cellW = 32 / plan.cols;
  const cellH = 20 / plan.rows;
  return html`<svg viewBox="0 0 32 20" aria-hidden="true">
    ${plan.slots.map(
      (s) =>
        svg`<rect
          x=${(s.col * cellW + 0.5).toFixed(2)}
          y=${(s.row * cellH + 0.5).toFixed(2)}
          width=${(s.cols * cellW - 1).toFixed(2)}
          height=${(s.rows * cellH - 1).toFixed(2)}
        ></rect>`,
    )}
  </svg>`;
}

if (!customElements.get("rv-wall")) {
  customElements.define("rv-wall", RvWall);
}

declare global {
  interface HTMLElementTagNameMap {
    "rv-wall": RvWall;
  }
}

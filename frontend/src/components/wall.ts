import { LitElement, css, html, nothing, svg, type PropertyValues, type TemplateResult } from "lit";

import { deleteWallLayout, fetchWallLayouts, saveWallLayout, toError } from "../api";
import { icon } from "../icons";
import { LiveData, isWarm, liveConnection } from "../live/data";
import { formatClock } from "../playback/time";
import { sharedStyles } from "../styles";
import type { HomeAssistant, LiveCamera, WallGrid, WallLayout } from "../types";
import { WALL_GAP, WALL_GRIDS, slotSize, wallFit, wallPlan, type WallPlan } from "../wall/geometry";
import { rememberLayout, rememberMode, rememberedLayout } from "../wall/remember";
import { boardOrder, tileShape } from "./live-grid";
import "./live-tile";
import { navigate } from "./navigation";

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
  };

  declare hass: HomeAssistant | undefined;
  /** The saved layout asked for (#wall/<id>); none: the one this device showed last. */
  declare layoutId: string | undefined;
  declare _layouts: WallLayout[] | undefined;
  declare _editing: boolean;
  declare _draft: { name: string; grid: WallGrid };
  declare _error: string | undefined;
  declare _size: { width: number; height: number };
  /** The camera full screen, if any (the others pause). */
  declare _full: string | undefined;
  declare _wallFull: boolean;
  declare _now: number;

  private readonly _data = new LiveData(this);
  private _resize: ResizeObserver | undefined;
  private _clock: ReturnType<typeof setTimeout> | undefined;
  private _asked = false;

  constructor() {
    super();
    this._editing = false;
    this._draft = { name: "", grid: "auto" };
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
    if (changed.has("hass") && this.hass && !this._asked) {
      this._asked = true;
      void this._loadLayouts(this.hass);
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
    this._draft = { name: layout.id ? layout.name : "", grid: layout.grid };
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
        cameras: layout.cameras,
        tour_s: layout.tour_s,
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

  protected override render(): TemplateResult {
    const layout = this._layout;
    const grid = this._editing ? this._draft.grid : layout.grid;
    const cameras = this._data.cameras;
    const shown = cameras ? wallCameras(layout, cameras) : [];
    const { width, height } = this._size;
    const plan = wallPlan(
      grid,
      shown.map((camera) => (camera ? tileShape(liveConnection(camera)) : undefined)),
      width,
      height,
    );
    const hidden = Math.max(0, shown.filter(Boolean).length - plan.slots.length);
    const missing = this.layoutId !== undefined && this._layouts !== undefined && layout.id !== this.layoutId;
    const canFull = document.fullscreenEnabled && typeof this.requestFullscreen === "function";
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
        ${hidden
          ? html`<span class="note">${hidden} more ${hidden === 1 ? "camera" : "cameras"} than cells</span>`
          : nothing}
        ${missing ? html`<span class="note">No layout “${this.layoutId}”: every camera instead</span>` : nothing}
        <time class="clock" aria-label="Time">${formatClock(this._now, this.hass?.config?.time_zone)}</time>
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
        : this._renderCells(plan, shown, width, height)}`;
  }

  private _renderCells(
    plan: WallPlan,
    shown: (LiveCamera | undefined)[],
    width: number,
    height: number,
  ): TemplateResult {
    const numbers = new Map(boardOrder([...(this._data.cameras ?? [])]).map((c, i) => [c.id, i + 1]));
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
        if (!camera) return html`<div class="empty" style=${place} aria-hidden="true"></div>`;
        return html`<rv-live-tile
          style=${place}
          fill
          .fit=${wallFit(pictureRatio(camera), slotSize(plan, slot, width, height))}
          .number=${numbers.get(camera.id)}
          .hass=${this.hass}
          .camera=${camera}
          .connection=${liveConnection(camera)}
          .image=${this._data.images[camera.id]}
          .iceServers=${this._data.iceServers}
          .warm=${isWarm(this.hass, camera)}
          .suspended=${this._full !== undefined && this._full !== camera.id}
          .controls=${camera.controls}
        ></rv-live-tile>`;
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
      .cells > * {
        min-width: 0;
        min-height: 0;
      }
      .empty {
        background: color-mix(in srgb, var(--rv-on-board) 4%, transparent);
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
      .editor code {
        font-family: var(--rv-mono);
      }
    `,
  ];
}

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

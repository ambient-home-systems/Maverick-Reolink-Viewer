import { LitElement, css, html, nothing, type TemplateResult } from "lit";

import { toError } from "../api";
import { icon } from "../icons";
import { LiveData, cameraFor, isWarm, liveConnection } from "../live/data";
import { soakTally } from "../live/soak-tally";
import { sharedStyles } from "../styles";
import type { HomeAssistant, LiveCamera, LiveConnection } from "../types";
import "./live-tile";
import type { LiveCountDetail } from "./live-tile";
import { navigate } from "./navigation";

const GAP = 8;

/** A camera as the board numbers it (the timetable shows the same numbers). */
export interface BoardCamera {
  id: string;
  name: string;
  number: number;
}

/** Fired when the board's cameras are known or change: `{ cameras: BoardCamera[] }`. */
export const BOARD_EVENT = "rv-board";

/**
 * Every camera live, on its sub stream (Reolink → Live): the live board.
 * Each tile shows the camera's last picture at once and fades into video; a
 * click opens the camera's Live tab. Tiles are numbered, and packed by the
 * camera's shape: a square doorbell runs two rows tall, a panorama two
 * columns wide. While one tile is full screen, the others stop.
 *
 * For Phase 3's 24-hour soak, the grid counts how long it is open and
 * visible (tiles pause while the page is hidden) and what its tiles count,
 * and sends it to the server's soak run every minute (soakTally): the run
 * outlives the grid, which Home Assistant unloads when its page has been
 * hidden for 5 minutes. The soak report (Devices → Checks) reads the run.
 */
export class RvLiveGrid extends LitElement {
  static override properties = {
    hass: { attribute: false },
    _full: { state: true },
    _boardFull: { state: true },
    _width: { state: true },
    _live: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  /** The camera full screen, if any. */
  declare _full: string | undefined;
  /** The whole board is in the browser's full screen. */
  declare _boardFull: boolean;
  /** The grid's width, which sets its columns and row height. */
  declare _width: number;
  /** The cameras playing live now. */
  declare _live: ReadonlySet<string>;

  private readonly _data = new LiveData(this);
  private _resize: ResizeObserver | undefined;
  /** The cameras last announced to the page (BOARD_EVENT). */
  private _announced: LiveCamera[] | undefined;

  constructor() {
    super();
    this._boardFull = false;
    this._width = 0;
    this._live = new Set();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    soakTally.opened(() => this.hass, document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", this._onVisibility);
    document.addEventListener("fullscreenchange", this._onFullscreen);
    if (typeof ResizeObserver !== "undefined") {
      this._resize = new ResizeObserver((entries) => {
        const entry = entries.at(-1);
        if (entry && Math.abs(entry.contentRect.width - this._width) >= 1) {
          this._width = entry.contentRect.width;
        }
      });
      this._resize.observe(this);
    }
    this._flush();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener("visibilitychange", this._onVisibility);
    document.removeEventListener("fullscreenchange", this._onFullscreen);
    this._resize?.disconnect();
    this._resize = undefined;
    soakTally.closed();
    this._flush();
  }

  private readonly _onFullscreen = (): void => {
    this._boardFull = document.fullscreenElement === this;
  };

  private _toggleBoardFull(): void {
    if (document.fullscreenElement === this) void document.exitFullscreen().catch(() => undefined);
    else void this.requestFullscreen().catch(() => undefined);
  }

  private readonly _onVisibility = (): void => {
    const visible = document.visibilityState !== "hidden";
    soakTally.visibility(visible);
    // Hidden for 5 minutes, the grid is unloaded: send what it counted now.
    if (!visible) this._flush();
  };

  private _flush(): void {
    if (this.hass) void soakTally.flush(this.hass);
  }

  protected override willUpdate(): void {
    this._data.hass = this.hass;
  }

  protected override updated(): void {
    // Tell the page how the board numbers its cameras.
    const cameras = this._data.cameras;
    if (cameras && cameras !== this._announced) {
      this._announced = cameras;
      const board = boardCameras(cameras);
      this.dispatchEvent(
        new CustomEvent<{ cameras: BoardCamera[] }>(BOARD_EVENT, { detail: { cameras: board }, bubbles: true, composed: true }),
      );
    }
  }

  protected override render(): TemplateResult {
    const data = this._data;
    const cameras = data.cameras;
    const canFull = document.fullscreenEnabled && typeof this.requestFullscreen === "function";
    return html`<div class="head">
        <h1>Live</h1>
        ${cameras?.length ? html`<p class="count">${playingCount(cameras, this._live)}</p>` : nothing}
        ${canFull && cameras?.length
          ? html`<button class="text with-icon full" @click=${() => {
              this._toggleBoardFull();
            }}>
              ${icon(this._boardFull ? "exitFull" : "enterFull")}${this._boardFull ? "Exit full screen" : "Full screen"}
            </button>`
          : nothing}
      </div>
      ${data.error
        ? html`<div class="banner error" role="alert">
            Could not load live view: ${data.error}
            <button
              @click=${() => {
                data.reload();
              }}
            >
              Retry
            </button>
          </div>`
        : nothing}
      ${cameras === undefined
        ? data.error
          ? nothing
          : html`<p class="note">Loading…</p>`
        : cameras.length === 0
          ? html`<p class="note">No camera can be watched live.</p>`
          : this._renderGrid(cameras)}`;
  }

  private _renderGrid(all: LiveCamera[]): TemplateResult {
    const data = this._data;
    const cameras = boardOrder(all);
    const shapes = cameras.map((camera) => tileShape(liveConnection(camera)));
    const cells = shapes.reduce((n, shape) => n + (shape ? 2 : 1), 0);
    const width = this._width;
    const maxCols = width >= 1100 ? 5 : width >= 800 ? 4 : width >= 540 ? 3 : 2;
    const cols = Math.max(2, Math.min(maxCols, cells));
    const column = width ? (width - (cols - 1) * GAP) / cols : 0;
    const row = column * (9 / 16);
    return html`<div
      class="grid"
      style=${`--cols: ${cols}; --row: ${row ? `${row.toFixed(1)}px` : "auto"}`}
      @rv-live-open=${(e: CustomEvent<{ cameraId: string }>) => {
        navigate(this, {
          view: "device",
          id: e.detail.cameraId,
          tab: "live",
        });
      }}
      @rv-live-full=${(e: CustomEvent<{ cameraId: string; full: boolean }>) => {
        if (e.detail.full) this._full = e.detail.cameraId;
        else if (this._full === e.detail.cameraId) this._full = undefined;
      }}
      @rv-live-count=${(e: CustomEvent<LiveCountDetail>) => {
        soakTally.count(e.detail.camera, e.detail.kind);
      }}
      @rv-live-state=${(e: CustomEvent<{ cameraId: string; live: boolean }>) => {
        const live = new Set(this._live);
        if (e.detail.live) live.add(e.detail.cameraId);
        else live.delete(e.detail.cameraId);
        this._live = live;
      }}
    >
      ${cameras.map(
        (camera, i) =>
          html`<rv-live-tile
            class=${shapes[i] ?? ""}
            fill
            .fit=${tileFit(liveConnection(camera), shapes[i], column)}
            .number=${i + 1}
            .hass=${this.hass}
            .camera=${camera}
            .connection=${liveConnection(camera)}
            .image=${data.images[camera.id]}
            .iceServers=${data.iceServers}
            .warm=${isWarm(this.hass, camera)}
            .suspended=${this._full !== undefined && this._full !== camera.id}
            .controls=${camera.controls}
            openable
          ></rv-live-tile>`,
      )}
    </div>`;
  }

  static override styles = [
    sharedStyles,
    css`
      :host {
        display: block;
        padding: 16px 24px 28px;
        color: var(--rv-on-board);
        background: var(--rv-board);
      }
      .head {
        display: flex;
        align-items: baseline;
        gap: 14px;
        margin-bottom: 12px;
      }
      h1 {
        margin: 0;
        font-family: var(--rv-font-cond);
        font-size: 22px;
        font-weight: 600;
      }
      .count,
      .note {
        margin: 0;
        color: var(--rv-on-board-muted);
        font-size: 15px;
      }
      button.full {
        margin-left: auto;
        color: var(--rv-on-board);
      }
      button.full:focus-visible {
        outline-color: var(--rv-on-board);
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(var(--cols, 2), minmax(0, 1fr));
        grid-auto-rows: var(--row, auto);
        grid-auto-flow: dense;
        gap: ${GAP}px;
      }
      rv-live-tile.tall {
        grid-row: span 2;
      }
      rv-live-tile.wide {
        grid-column: span 2;
      }
      @media (max-width: 600px) {
        :host {
          padding: 12px 12px 20px;
        }
      }
    `,
  ];
}

/** The board's cameras, numbered as its tiles are. */
/** The board's count: "6 of 8 playing", or the cameras while none plays yet. */
export function playingCount(cameras: readonly LiveCamera[], live: ReadonlySet<string>): string {
  const playing = cameras.filter((c) => live.has(c.id)).length;
  if (!playing) return `${String(cameras.length)} ${cameras.length === 1 ? "camera" : "cameras"}`;
  return `${String(playing)} of ${String(cameras.length)} playing`;
}

export function boardCameras(cameras: LiveCamera[]): BoardCamera[] {
  return boardOrder(cameras).map((c, i) => ({ id: c.id, name: c.name, number: i + 1 }));
}

/**
 * The board's order, which numbers its tiles: tall cameras first, so they
 * stand in the first columns and the rest pack around them.
 */
export function boardOrder(cameras: LiveCamera[]): LiveCamera[] {
  const tall = cameras.filter((c) => tileShape(liveConnection(c)) === "tall");
  return [...tall, ...cameras.filter((c) => !tall.includes(c))];
}

/**
 * How a tile shows its picture in its cell: filling it ("cover") may crop
 * the picture's top and bottom, never its sides, so a picture wider than its
 * cell (a square doorbell in a cell a little narrower than square) is shown
 * whole ("contain"), with bars above and below. `column` is the column's
 * width in pixels, 0 before the board is measured.
 */
export function tileFit(
  connection: LiveConnection | undefined,
  shape: "tall" | "wide" | undefined,
  column: number,
): "cover" | "contain" {
  const picture = pictureRatio(connection);
  if (!picture) return "cover";
  const gap = column ? GAP / column : 0; // in columns
  const row = 9 / 16;
  const cell = shape === "tall" ? 1 / (2 * row + gap) : shape === "wide" ? (2 + gap) / row : 1 / row;
  return picture > cell * 1.02 ? "contain" : "cover";
}

/** A square or portrait camera runs two rows tall; a panorama two columns wide. */
export function tileShape(connection: LiveConnection | undefined): "tall" | "wide" | undefined {
  const ratio = pictureRatio(connection);
  if (!ratio) return undefined;
  if (ratio < 1.2) return "tall";
  if (ratio > 2.4) return "wide";
  return undefined;
}

/** The sub stream's width over its height, when the camera reported its size. */
function pictureRatio(connection: LiveConnection | undefined): number | undefined {
  const encoding = connection?.streams.sub?.encoding;
  const width = encoding?.width;
  const height = encoding?.height;
  return width && height ? width / height : undefined;
}

/** One camera live, large (the camera's Live tab). */
export class RvLiveCamera extends LitElement {
  static override properties = {
    hass: { attribute: false },
    deviceId: { attribute: false },
    _error: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  /** The camera's id, or the id of one of its connections. */
  declare deviceId: string;
  declare _error: string | undefined;

  private readonly _data = new LiveData(this);

  protected override willUpdate(): void {
    this._data.hass = this.hass;
  }

  protected override render(): TemplateResult {
    const data = this._data;
    if (data.error) {
      return html`<div class="banner error" role="alert">
        Could not load live view: ${data.error}
        <button
          @click=${() => {
            data.reload();
          }}
        >
          Retry
        </button>
      </div>`;
    }
    if (!data.cameras) return html`<p class="muted">Loading…</p>`;
    const camera = cameraFor(data.cameras, this.deviceId);
    if (!camera)
      return html`<p class="muted">This camera cannot be watched live.</p>`;
    return html`<div class="board">
        <rv-live-tile
          .hass=${this.hass}
          .camera=${camera}
          .connection=${liveConnection(camera)}
          .image=${data.images[camera.id]}
          .iceServers=${data.iceServers}
          .warm=${isWarm(this.hass, camera)}
          .controls=${camera.controls}
        ></rv-live-tile>
      </div>
      ${this._renderKeepWarm(camera)}`;
  }

  /** The camera's keep-warm switch, through Home Assistant's switch actions. */
  private _renderKeepWarm(camera: LiveCamera): TemplateResult | typeof nothing {
    const entity = camera.keep_warm_entity;
    if (!entity) return nothing;
    const state = this.hass?.states[entity]?.state;
    return html`<label class="keep-warm">
      <input
        type="checkbox"
        .checked=${state === "on"}
        ?disabled=${state !== "on" && state !== "off"}
        @change=${(e: Event) => {
          const on = (e.target as HTMLInputElement).checked;
          this.hass
            ?.callService("switch", on ? "turn_on" : "turn_off", {
              entity_id: entity,
            })
            .catch((err: unknown) => {
              this._error = toError(err).message;
            });
        }}
      />
      <span>
        <strong>Keep warm</strong>
        <span class="muted small"
          >Keeps the camera connected so its live view starts at once. Uses one of
          its NVR's or camera's stream slots all the time.</span
        >
      </span>
    </label>
    ${this._error
      ? html`<div class="banner error" role="alert">Could not change it: ${this._error}</div>`
      : nothing}`;
  }

  static override styles = [
    sharedStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        gap: 12px;
        max-width: 1280px;
      }
      /* Video sits on the board's ink, with a margin of it. */
      .board {
        padding: 10px;
        background: var(--rv-board);
      }
      .keep-warm {
        display: flex;
        gap: 8px;
        align-items: flex-start;
      }
      .keep-warm > span {
        display: flex;
        flex-direction: column;
      }
    `,
  ];
}

if (!customElements.get("rv-live-grid")) {
  customElements.define("rv-live-grid", RvLiveGrid);
}
if (!customElements.get("rv-live-camera")) {
  customElements.define("rv-live-camera", RvLiveCamera);
}

declare global {
  interface HTMLElementTagNameMap {
    "rv-live-grid": RvLiveGrid;
    "rv-live-camera": RvLiveCamera;
  }
}

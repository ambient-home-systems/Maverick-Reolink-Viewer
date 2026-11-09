// The dashboard card's body (custom:reolink-viewer-camera, see ./index.ts):
// the panel's live tile for one camera, with its last picture at once, warm
// MSE, the WebRTC fallback, HD in full screen and its error states. Fetched
// the first time a card is shown, beside the panel's own files.
//
// On a wall tablet (Phase 7 step 2) it notes what it sees for the panel's
// "Dashboard cards" report (./tablet.ts), sleeps while Fully Kiosk's screen is
// off or its screensaver on, and a doorbell's card can go full screen for a
// while when it rings (ring_full_screen), waking Fully's screen first.
import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from "lit";

import "../components/live-tile";
import type { PlayerDetail, RvLiveTile } from "../components/live-tile";
import { loadFonts } from "../fonts";
import { LiveData, cameraFor, isWarm, liveConnection } from "../live/data";
import { explainLive } from "../live/explain";
import { chooseHd } from "../live/hd";
import { rvTokens, sharedStyles } from "../styles";
import type { HomeAssistant, LiveCamera, LiveConnection, LiveStreamKind } from "../types";
import { rememberRatio, type CameraCardConfig } from "./config";
import { PANEL_PATH, openPanel } from "./panel";
import { tablet } from "./tablet";

export { PANEL_PATH };

/** The cards on the page: while one is full screen, the others stop (it hides them). */
const cards = new Set<RvCameraCard>();
let fullCard: RvCameraCard | undefined;

function setFull(card: RvCameraCard | undefined): void {
  if (fullCard === card) return;
  fullCard = card;
  for (const other of cards) other.requestUpdate();
}

// Fully Kiosk's screen off or screensaver on: every card stops, and starts again.
tablet.onSleep(() => {
  for (const card of cards) card.requestUpdate();
});

/** Open a camera's Live tab in the panel, as Home Assistant's own links do. */
export function openInPanel(cameraId: string): void {
  openPanel(`#device/${encodeURIComponent(cameraId)}/live`);
}

/** The picture's shape (width over height) on the stream the card plays, when the camera says. */
export function pictureRatio(connection: LiveConnection | undefined, stream: LiveStreamKind): number | undefined {
  const encoding = connection?.streams[stream]?.encoding ?? connection?.streams.sub?.encoding;
  const width = encoding?.width;
  const height = encoding?.height;
  return width && height ? width / height : undefined;
}

export class RvCameraCard extends LitElement {
  static override properties = {
    hass: { attribute: false },
    config: { attribute: false },
    _hd: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  declare config: CameraCardConfig | undefined;
  /** The HD stream a card in HD plays, once chosen for its connection (null: none better than SD). */
  declare _hd: { connectionId: string; stream: LiveStreamKind | null } | undefined;

  private readonly _data = new LiveData(this);
  /** The connection an HD stream is being chosen for. */
  private _choosing: string | undefined;
  private _unwatch: (() => void) | undefined;
  /** What the log says it is doing, and since when each player started. */
  private _doing = "loading";
  private readonly _startedAt = new Map<string, number>();
  /** The visitor sensor's state last seen (`state@last_changed`); undefined until first seen. */
  private _ringSeen: string | undefined;
  /** It went full screen for a ring, and leaves it at this timer. */
  private _ringTimer: ReturnType<typeof setTimeout> | undefined;
  private _ringFull = false;

  /** The camera's name, as the log says it. */
  private get _name(): string {
    const camera = this._data.cameras && this.config?.camera ? cameraFor(this._data.cameras, this.config.camera) : undefined;
    return camera?.name ?? this.config?.camera ?? "Card";
  }

  override connectedCallback(): void {
    super.connectedCallback();
    loadFonts(import.meta.url);
    cards.add(this);
    tablet.start(() => this.hass);
    this._unwatch = tablet.watch({
      name: () => this._name,
      video: () => this._tileElement()?.renderRoot.querySelector<HTMLVideoElement>("video.sub") ?? null,
      state: () => this._doing,
    });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    cards.delete(this);
    if (fullCard === this) setFull(undefined);
    this._unwatch?.();
    this._unwatch = undefined;
    clearTimeout(this._ringTimer);
    this._ringFull = false;
    this._ringSeen = undefined;
  }

  private _tileElement(): RvLiveTile | null {
    return this.renderRoot.querySelector<RvLiveTile>("rv-live-tile");
  }

  protected override updated(): void {
    const camera = this._data.cameras && this.config?.camera ? cameraFor(this._data.cameras, this.config.camera) : undefined;
    if (camera) this._ring(camera);
  }

  /**
   * A doorbell's ring (its visitor sensor turning on, as Home Assistant says
   * at once): wake Fully Kiosk's screen, and go full screen for the card's
   * seconds. A ring before the card was shown is not one.
   */
  private _ring(camera: LiveCamera): void {
    const entity = camera.visitor_entity;
    const state = entity ? this.hass?.states[entity] : undefined;
    const seen = state ? `${state.state}@${state.last_changed}` : "";
    const first = this._ringSeen === undefined;
    if (seen === this._ringSeen) return;
    this._ringSeen = seen;
    const seconds = this.config?.ring_full_screen ?? 0;
    if (first || !seconds || state?.state !== "on") return;
    const tile = this._tileElement();
    if (!tile) return;
    const woke = tablet.wake();
    tablet.note("ring", camera.name, `full screen for ${String(seconds)} s${woke ? "; woke Fully Kiosk's screen" : ""}`);
    // Already full screen by hand: it stays so, and is not left for the ring.
    if (!tile.full) {
      tile.enterFull();
      this._ringFull = true;
    }
    clearTimeout(this._ringTimer);
    this._ringTimer = setTimeout(() => {
      // Still full screen from the ring (not left by hand): back to the card.
      if (this._ringFull) this._tileElement()?.exitFull();
      this._ringFull = false;
    }, seconds * 1000);
  }

  /** What one of the tile's players did, for the log. */
  private _logPlayer(name: string, detail: PlayerDetail): void {
    const { which, state } = detail;
    const now = Date.now();
    switch (state.kind) {
      case "starting": {
        // The other transport after the first failed: its time counts from the first.
        const since = state.after ? this._startedAt.get(which) : undefined;
        if (since === undefined) this._startedAt.set(which, now);
        this._doing = "starting";
        tablet.note(
          "starting",
          name,
          `${which} ${state.transport}${
            state.after && since !== undefined
              ? `, after ${((now - since) / 1000).toFixed(1)} s: ${state.after}`
              : ""
          }`,
        );
        break;
      }
      case "playing": {
        const since = this._startedAt.get(which);
        this._doing = "playing";
        tablet.note(
          "playing",
          name,
          `${which} ${state.transport}${since === undefined ? "" : `, ${((now - since) / 1000).toFixed(1)} s`}`,
        );
        break;
      }
      case "waiting":
        this._doing = "retrying";
        tablet.note("retrying", name, `${which}: ${explainLive(state.error).text}`);
        break;
      default:
        if (which === "SD" || this.config?.quality === "hd") this._doing = "stopped";
        tablet.note("stopped", name, which);
    }
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    // Home Assistant's dark mode, as the panel follows it.
    this.toggleAttribute("dark", this.hass?.themes?.darkMode === true);
    const camera = this.config?.camera;
    const watched = camera ? [camera] : [];
    if (changed.has("config") && this._data.cameraIds?.join() !== watched.join()) {
      // Only this camera's picture is kept fresh for the card.
      const loaded = this._data.cameraIds !== undefined;
      this._data.cameraIds = watched;
      if (loaded) this._data.reload();
    }
    this._data.hass = this.hass;
  }

  /** The stream the card plays: the sub stream, or in HD the one full screen would choose. */
  private _stream(connection: LiveConnection): LiveStreamKind | undefined {
    if (this.config?.quality !== "hd") return "sub";
    const id = connection.connection_id;
    if (this._hd?.connectionId === id) return this._hd.stream ?? "sub";
    if (this._choosing !== id) {
      this._choosing = id;
      void chooseHd(connection).then((choice) => {
        if (this._choosing === id) this._hd = { connectionId: id, stream: choice.stream };
      });
    }
    return undefined;
  }

  protected override render(): TemplateResult {
    const config = this.config;
    const data = this._data;
    if (!config?.camera) {
      return this._card(html`<p class="note">Choose a camera in this card's settings.</p>`);
    }
    if (data.error) {
      return this._card(
        html`<div class="banner error" role="alert">
          Could not load live view: ${data.error}
          <button
            @click=${() => {
              data.reload();
            }}
          >
            Try again
          </button>
        </div>`,
      );
    }
    if (!data.cameras) return this._card(html`<p class="note on-board">Loading…</p>`, true);
    const camera = cameraFor(data.cameras, config.camera);
    if (!camera) {
      return this._card(
        html`<p class="note">This camera cannot be watched live. Choose another in this card's settings.</p>`,
      );
    }
    const connection = liveConnection(camera);
    const stream = connection ? this._stream(connection) : "sub";
    const ratio = pictureRatio(connection, stream ?? "sub");
    if (ratio) rememberRatio(camera.id, ratio);
    return this._card(
      stream === undefined ? html`<p class="note on-board">Loading…</p>` : this._tile(camera, connection, stream),
      true,
      ratio,
    );
  }

  private _tile(camera: LiveCamera, connection: LiveConnection | undefined, stream: LiveStreamKind): TemplateResult {
    const config = this.config;
    const tap = config?.tap_action ?? "full_screen";
    const name = camera.name;
    return html`<rv-live-tile
      fill
      compact
      .fit=${config?.fit ?? "cover"}
      .hass=${this.hass}
      .camera=${camera}
      .connection=${connection}
      .stream=${stream}
      .image=${this._data.images[camera.id]}
      .iceServers=${this._data.iceServers}
      .warm=${stream === "sub" ? isWarm(this.hass, camera) : undefined}
      .controls=${camera.controls}
      .suspended=${tablet.asleep || (fullCard !== undefined && fullCard !== this)}
      .hideName=${config?.show_name === false}
      .hideState=${config?.show_state === false}
      .tapLabel=${tap === "open_panel" ? `Open ${name} in Reolink` : `${name} full screen`}
      ?openable=${tap !== "none"}
      @rv-live-open=${(e: Event) => {
        e.stopPropagation();
        if (tap === "open_panel") openInPanel(camera.id);
        else (e.target as RvLiveTile).enterFull();
      }}
      @rv-live-full=${(e: CustomEvent<{ full: boolean }>) => {
        e.stopPropagation();
        if (e.detail.full) setFull(this);
        else {
          this._ringFull = false;
          if (fullCard === this) setFull(undefined);
        }
      }}
      @rv-live-player=${(e: CustomEvent<PlayerDetail>) => {
        this._logPlayer(name, e.detail);
      }}
    ></rv-live-tile>`;
  }

  /** The card around what it shows: on the board's ink where there is video, its height from the picture. */
  private _card(content: TemplateResult, video = false, ratio?: number): TemplateResult {
    return html`<ha-card>
      ${video
        ? html`<div class="frame" style=${ratio ? `--ratio: ${ratio.toFixed(4)}` : nothing}>${content}</div>`
        : html`<div class="message">${content}</div>`}
    </ha-card>`;
  }

  static override styles = [
    rvTokens,
    sharedStyles,
    css`
      /* Around the video, Home Assistant's theme (the panel's own is inside it). */
      :host {
        display: block;
        height: 100%;
        color: var(--primary-text-color, var(--rv-text));
      }
      ha-card {
        display: block;
        height: 100%;
        overflow: hidden;
      }
      /* As tall as the picture, unless the dashboard sets the card's height. */
      .frame {
        position: relative;
        width: 100%;
        height: 100%;
        aspect-ratio: var(--ratio, 16 / 9);
        background: var(--rv-board);
      }
      rv-live-tile {
        position: absolute;
        inset: 0;
      }
      .message {
        padding: 16px;
      }
      .note {
        margin: 0;
        color: var(--secondary-text-color, var(--rv-muted));
      }
      .note.on-board {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        color: var(--rv-on-board-muted);
      }
    `,
  ];
}

if (!customElements.get("rv-camera-card")) {
  customElements.define("rv-camera-card", RvCameraCard);
}

declare global {
  interface HTMLElementTagNameMap {
    "rv-camera-card": RvCameraCard;
  }
}

import {
  LitElement,
  css,
  html,
  nothing,
  type PropertyValues,
  type TemplateResult,
} from "lit";

import { LivePlayer, type PlayerState } from "../live/player";
import { sharedStyles } from "../styles";
import type {
  HomeAssistant,
  LiveCamera,
  LiveConnection,
  LiveImage,
  LiveStreamKind,
} from "../types";

/** Scrolled out of view this long, a tile stops its stream (a quick scroll back keeps it). */
export const OFFSCREEN_GRACE_MS = 3000;
/** Fired by an openable tile when it is clicked (or Enter/Space). */
export const TILE_OPEN_EVENT = "rv-live-open";

/**
 * One camera live: its last picture at once, then the stream fading in over
 * it. It plays while it is on screen and the page is visible, and stops
 * otherwise (the stream, if kept warm, stays warm on the server). A battery
 * camera waits for a tap, so it is woken only when someone wants to watch.
 */
export class RvLiveTile extends LitElement {
  static override properties = {
    hass: { attribute: false },
    camera: { attribute: false },
    connection: { attribute: false },
    stream: { attribute: false },
    image: { attribute: false },
    iceServers: { attribute: false },
    openable: { type: Boolean },
    _state: { state: true },
    _onScreen: { state: true },
    _pageVisible: { state: true },
    _wanted: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  declare camera: LiveCamera | undefined;
  declare connection: LiveConnection | undefined;
  declare stream: LiveStreamKind;
  declare image: LiveImage | undefined;
  /** Undefined until loaded: a cold start (WebRTC) waits for them. */
  declare iceServers: RTCIceServer[] | undefined;
  /** Clicking it opens the camera (the grid); otherwise it is the camera's own view. */
  declare openable: boolean;
  declare _state: PlayerState;
  declare _onScreen: boolean;
  declare _pageVisible: boolean;
  declare _wanted: boolean;

  private _player: LivePlayer | undefined;
  private _observer: IntersectionObserver | undefined;
  private _offscreenTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    super();
    this.stream = "sub";
    this.openable = false;
    this._state = { kind: "idle" };
    this._onScreen = typeof IntersectionObserver === "undefined";
    this._pageVisible = document.visibilityState !== "hidden";
    this._wanted = true;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener("visibilitychange", this._onVisibility);
    if (typeof IntersectionObserver !== "undefined") {
      this._observer = new IntersectionObserver(
        (entries) => {
          this._onScreen = entries.some((e) => e.isIntersecting);
        },
        { rootMargin: "100px" },
      );
      this._observer.observe(this);
    }
    // Attached again: play again if it should (nothing else may change).
    this.requestUpdate();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener("visibilitychange", this._onVisibility);
    this._observer?.disconnect();
    this._observer = undefined;
    clearTimeout(this._offscreenTimer);
    this._player?.stop();
  }

  private readonly _onVisibility = (): void => {
    this._pageVisible = document.visibilityState !== "hidden";
  };

  /** Whether the tile should be playing now. */
  get shouldPlay(): boolean {
    return (
      this.isConnected &&
      this._wanted &&
      this._pageVisible &&
      this._onScreen &&
      this.connection?.streams[this.stream] !== undefined
    );
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has("connection") || changed.has("stream")) {
      // Another stream: a new player (a battery camera asks for a tap again).
      this._player?.stop();
      this._player = undefined;
      this._wanted = !this.connection?.is_battery;
    }
  }

  protected override updated(): void {
    const player = this._ensurePlayer();
    if (!player) return;
    player.options.warm = this.connection?.streams[this.stream]?.warm === true;
    if (this.shouldPlay) {
      clearTimeout(this._offscreenTimer);
      this._offscreenTimer = undefined;
      // A cold start goes over WebRTC: wait for the ICE servers.
      if (!player.running && (player.options.warm || this.iceServers)) {
        player.options.iceServers = this.iceServers ?? [];
        player.start();
      }
    } else if (player.running) {
      if (!this._pageVisible || !this._wanted) {
        player.stop();
      } else {
        this._offscreenTimer ??= setTimeout(() => {
          this._offscreenTimer = undefined;
          if (!this.shouldPlay) this._player?.stop();
        }, OFFSCREEN_GRACE_MS);
      }
    }
  }

  private _ensurePlayer(): LivePlayer | undefined {
    if (this._player) return this._player;
    const video = this.renderRoot.querySelector("video");
    const connection = this.connection;
    if (!this.hass || !video || !connection) return undefined;
    this._player = new LivePlayer(
      this.hass,
      video,
      { connectionId: connection.connection_id, stream: this.stream },
      { warm: false, iceServers: [] },
      (state) => {
        this._state = state;
      },
    );
    return this._player;
  }

  private _activate(): void {
    if (!this._wanted) {
      this._wanted = true;
      return;
    }
    if (this.openable && this.camera) {
      this.dispatchEvent(
        new CustomEvent(TILE_OPEN_EVENT, {
          detail: { cameraId: this.camera.id },
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  protected override render(): TemplateResult {
    const state = this._state;
    const playing = state.kind === "playing";
    const name = this.camera?.name ?? "Camera";
    const interactive = this.openable || !this._wanted;
    return html`<div
      class="tile ${playing ? "playing" : ""}"
      role=${interactive ? "button" : nothing}
      tabindex=${interactive ? "0" : nothing}
      aria-label=${interactive
        ? this._wanted
          ? `Open ${name}`
          : `Watch ${name}`
        : nothing}
      @click=${() => {
        this._activate();
      }}
      @keydown=${(e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          this._activate();
        }
      }}
    >
      ${this.image
        ? html`<img class="poster" src=${this.image.url} alt="" />`
        : nothing}
      <video muted playsinline aria-label=${`${name} live`}></video>
      <div class="label">${name}</div>
      ${this._renderStatus(state)}
    </div>`;
  }

  private _renderStatus(state: PlayerState): TemplateResult | typeof nothing {
    if (!this._wanted) {
      return html`<div class="status center">
        <span class="badge">Tap to watch</span>
        <span class="small">Battery camera: it wakes when you watch it</span>
      </div>`;
    }
    if (!this.connection?.streams[this.stream]) {
      return html`<div class="status center">
        <span class="badge">No ${this.stream} stream</span>
      </div>`;
    }
    if (state.kind === "starting") {
      return html`<div class="status corner">
        <span class="spinner" aria-label="Connecting"></span>
      </div>`;
    }
    if (state.kind === "waiting") {
      return html`<div class="status center" role="alert">
        <span class="small">Cannot play: ${state.error}</span>
        <button
          @click=${(e: Event) => {
            e.stopPropagation();
            this._player?.retryNow();
          }}
        >
          Retry now
        </button>
      </div>`;
    }
    return nothing;
  }

  static override styles = [
    sharedStyles,
    css`
      :host {
        display: block;
      }
      .tile {
        position: relative;
        aspect-ratio: 16 / 9;
        background: #000;
        border-radius: 8px;
        overflow: hidden;
        color: #fff;
      }
      .tile[role="button"] {
        cursor: pointer;
      }
      .tile:focus-visible {
        outline: 2px solid var(--primary-color);
        outline-offset: 2px;
      }
      .poster,
      video {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
      video {
        opacity: 0;
        transition: opacity 0.3s;
      }
      .playing video {
        opacity: 1;
      }
      .label {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        padding: 16px 8px 4px;
        font-size: 13px;
        background: linear-gradient(transparent, rgba(0, 0, 0, 0.6));
        pointer-events: none;
      }
      .status {
        position: absolute;
        display: flex;
        gap: 6px;
      }
      .status.center {
        inset: 0;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 8px;
        background: rgba(0, 0, 0, 0.45);
      }
      .status.corner {
        top: 8px;
        right: 8px;
      }
      .spinner {
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255, 255, 255, 0.4);
        border-top-color: #fff;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        video {
          transition: none;
        }
        .spinner {
          animation: none;
        }
      }
    `,
  ];
}

if (!customElements.get("rv-live-tile")) {
  customElements.define("rv-live-tile", RvLiveTile);
}

declare global {
  interface HTMLElementTagNameMap {
    "rv-live-tile": RvLiveTile;
  }
}

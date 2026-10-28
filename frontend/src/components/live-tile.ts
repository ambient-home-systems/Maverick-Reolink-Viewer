import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from "lit";

import { icon } from "../icons";
import type { DebugPlayer, TileDebug } from "../live/debug";
import { offlineSince } from "../live/data";
import { explainLive } from "../live/explain";
import { chooseHd, type HdChoice } from "../live/hd";
import { LivePlayer, pageCuts, type PlayerState } from "../live/player";
import { currentLink, fullScreenHd, rememberFullScreenHd, type Link } from "../network";
import { formatClock, formatStamp } from "../playback/time";
import { enterPip, exitPip, inPip, pipSupported } from "../pip";
import { sharedStyles } from "../styles";
import type {
  HomeAssistant,
  LiveCamera,
  LiveConnection,
  LiveControls,
  LiveImage,
  LiveStreamKind,
  SoakCounts,
} from "../types";
import "./live-controls";
import "./live-debug";

/** Scrolled out of view this long, a tile stops its stream (a quick scroll back keeps it). */
export const OFFSCREEN_GRACE_MS = 3000;
/** Fired by an openable tile when it is clicked (or Enter/Space). */
export const TILE_OPEN_EVENT = "rv-live-open";
/** Fired when a tile goes full screen or back: `{ cameraId, full }`. */
export const TILE_FULL_EVENT = "rv-live-full";
/** Fired (bubbling) on each first frame, end after one and failed start of its players. */
export const TILE_COUNT_EVENT = "rv-live-count";
/** Fired (bubbling) when the tile starts or stops playing live: `{ cameraId, live }`. */
export const TILE_STATE_EVENT = "rv-live-state";

export interface LiveCountDetail {
  camera: string;
  kind: keyof SoakCounts;
}

/**
 * One camera live: its last picture at once, then the stream fading in over
 * it. It plays while it is on screen and the page is visible, and stops
 * otherwise (the stream, if kept warm, stays warm on the server). A battery
 * camera waits for a tap, so it is woken only when someone wants to watch.
 * So does a camera that records nowhere (the E1 Zoom): it is watched for its
 * picture, kept fresh while shown, and its video plays when tapped.
 *
 * Full screen plays HD: the stream `chooseHd` picks starts in the background
 * while the sub stream keeps playing, and replaces it on its first frame (the
 * sub stream then stops). If HD ends, the sub stream plays again until HD is
 * back. Away from home or on mobile data it stays in the lighter SD, with an
 * HD button; the choice either way is remembered on the device (network.ts). Full screen uses the Fullscreen API where the browser has it for any
 * element, and fills the window otherwise (the iPhone has it only for video).
 *
 * A camera Home Assistant cannot reach (its entities unavailable) shows its
 * last picture as offline, since when, and does not try to play until it is
 * back. When video cannot play, the tile says why in plain words and what to
 * do (live/explain.ts); the technical text is in its debug view.
 *
 * Picture-in-picture (in full screen, and on the camera's own view) takes the
 * video showing. The stream in it keeps playing while the tile is off screen
 * or the page is hidden, and when HD replaces it or another tile goes full
 * screen: someone is watching it. It ends when the tile goes away.
 */
export class RvLiveTile extends LitElement {
  static override properties = {
    hass: { attribute: false },
    camera: { attribute: false },
    connection: { attribute: false },
    stream: { attribute: false },
    image: { attribute: false },
    iceServers: { attribute: false },
    warm: { attribute: false },
    openable: { type: Boolean },
    fill: { type: Boolean, reflect: true },
    fit: { reflect: true },
    number: { attribute: false },
    suspended: { attribute: false },
    controls: { attribute: false },
    _state: { state: true },
    _onScreen: { state: true },
    _pageVisible: { state: true },
    _wanted: { state: true },
    _full: { state: true },
    _hd: { state: true },
    _hdState: { state: true },
    _debug: { state: true },
    _pip: { state: true },
    _hdWanted: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  declare camera: LiveCamera | undefined;
  declare connection: LiveConnection | undefined;
  declare stream: LiveStreamKind;
  declare image: LiveImage | undefined;
  /** Undefined until loaded: a cold start (WebRTC) waits for them. */
  declare iceServers: RTCIceServer[] | undefined;
  /** Kept warm (start over MSE); undefined: as the server said in live/cameras. */
  declare warm: boolean | undefined;
  /** Clicking it opens the camera (the grid); otherwise it is the camera's own view. */
  declare openable: boolean;
  /** On the board: fill the grid cell, the picture cropped to it. */
  declare fill: boolean;
  /** Filling its cell: crop the picture to it, or show it whole (the board says which). */
  declare fit: "cover" | "contain";
  /** Its number on the board. */
  declare number: number | undefined;
  /** Another tile is full screen: stop now (it is hidden behind it). */
  declare suspended: boolean;
  /** The camera's controls, shown on its own view and in full screen. */
  declare controls: LiveControls | undefined;
  declare _state: PlayerState;
  declare _onScreen: boolean;
  declare _pageVisible: boolean;
  declare _wanted: boolean;
  declare _full: boolean;
  /** The HD stream for this connection, once chosen (at the first full screen). */
  declare _hd: HdChoice | undefined;
  declare _hdState: PlayerState;
  /** Its debug view is shown. */
  declare _debug: boolean;
  /** Which of its videos is in picture-in-picture. */
  declare _pip: "sub" | "hd" | undefined;
  /** Full screen plays HD (at home, or as chosen on this device). */
  declare _hdWanted: boolean;
  /** Where the page was when full screen began, and whether HD there was chosen. */
  private _link: Link & { chosen: boolean } = { where: "home", why: "at home", chosen: false };

  private _player: LivePlayer | undefined;
  private _hdPlayer: LivePlayer | undefined;
  /** The connection an HD choice is being made for. */
  private _hdChoosing: LiveConnection | undefined;
  /** In the browser's full screen (not just filling the window). */
  private _native = false;
  private _observer: IntersectionObserver | undefined;
  private _offscreenTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    super();
    this.stream = "sub";
    this.openable = false;
    this.fill = false;
    this.fit = "cover";
    this.suspended = false;
    this._state = { kind: "idle" };
    this._hdState = { kind: "idle" };
    this._onScreen = typeof IntersectionObserver === "undefined";
    this._pageVisible = document.visibilityState !== "hidden";
    this._wanted = true;
    this._full = false;
    this._debug = false;
    this._hdWanted = true;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener("visibilitychange", this._onVisibility);
    document.addEventListener("fullscreenchange", this._onFullscreenChange);
    document.addEventListener("keydown", this._onKeydown);
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
    document.removeEventListener("fullscreenchange", this._onFullscreenChange);
    document.removeEventListener("keydown", this._onKeydown);
    this._observer?.disconnect();
    this._observer = undefined;
    clearTimeout(this._offscreenTimer);
    void exitPip(this._pipVideo).catch(() => undefined);
    this._pip = undefined;
    this._player?.stop();
    this._hdPlayer?.stop();
    this.exitFull();
  }

  private _video(which: "sub" | "hd"): HTMLVideoElement | null {
    return this.renderRoot.querySelector<HTMLVideoElement>(`video.${which}`);
  }

  /** The video in picture-in-picture, if one is. */
  private get _pipVideo(): HTMLVideoElement | null {
    return this._pip ? this._video(this._pip) : null;
  }

  private readonly _onPipChange = (): void => {
    this._pip = inPip(this._video("sub")) ? "sub" : inPip(this._video("hd")) ? "hd" : undefined;
  };

  /** Into picture-in-picture with the video showing, or out of it. */
  private async _togglePip(): Promise<void> {
    try {
      if (this._pip) await exitPip(this._pipVideo);
      else {
        const video = this._video(this.hdShown ? "hd" : "sub");
        if (video) await enterPip(video);
      }
    } catch {
      // Refused (no video yet, or the browser said no): nothing changes.
    }
  }

  private readonly _onVisibility = (): void => {
    this._pageVisible = document.visibilityState !== "hidden";
  };

  /** Tell the grid what a player counted (its soak run adds it up). */
  private readonly _count = (kind: keyof SoakCounts): void => {
    this.dispatchEvent(
      new CustomEvent<LiveCountDetail>(TILE_COUNT_EVENT, {
        detail: { camera: this.camera?.name ?? "Camera", kind },
        bubbles: true,
      }),
    );
  };

  private readonly _onFullscreenChange = (): void => {
    // The browser left full screen (Esc, its own button): so does the tile.
    if (this._native && !document.fullscreenElement) {
      this._native = false;
      this.exitFull();
    }
  };

  private readonly _onKeydown = (e: KeyboardEvent): void => {
    // Filling the window: Esc leaves (the browser's full screen handles its own).
    if (e.key === "Escape" && this._full && !this._native) this.exitFull();
  };

  /** Whether the tile should be playing now. */
  get shouldPlay(): boolean {
    return (
      this.isConnected &&
      this._wanted &&
      !this.suspended &&
      this._pageVisible &&
      this._onScreen &&
      this.offlineSince === undefined &&
      this.connection?.streams[this.stream] !== undefined
    );
  }

  /** Since when Home Assistant cannot reach the camera (epoch ms), if it cannot. */
  get offlineSince(): number | undefined {
    return offlineSince(this.hass, this.connection);
  }

  /** Video only when tapped: a battery camera, or one watched for its picture. */
  get waitsForTap(): boolean {
    return this.connection?.is_battery === true || this.camera?.records === false;
  }

  /** Full screen, with HD showing (the sub stream is stopped). */
  get hdShown(): boolean {
    return this._full && this._hdState.kind === "playing";
  }

  get full(): boolean {
    return this._full;
  }

  /** Go full screen, in HD. */
  enterFull(): void {
    if (this._full) return;
    const link = currentLink();
    const choice = fullScreenHd(link);
    this._link = { ...link, chosen: choice.chosen };
    this._hdWanted = choice.hd;
    this._full = true;
    this._wanted = true; // a camera waiting for a tap: asking for it is watching it
    if (document.fullscreenEnabled && typeof this.requestFullscreen === "function") {
      this.requestFullscreen()
        .then(() => {
          this._native = true;
          // Left again before the browser was done.
          if (!this._full) void document.exitFullscreen().catch(() => undefined);
        })
        .catch(() => undefined); // it fills the window instead
    }
    this._fullChanged();
  }

  /** Back from full screen (to the sub stream). */
  exitFull(): void {
    if (!this._full) return;
    this._full = false;
    if (this._native && document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    }
    this._native = false;
    this._fullChanged();
  }

  private _fullChanged(): void {
    this.dispatchEvent(
      new CustomEvent(TILE_FULL_EVENT, {
        detail: { cameraId: this.camera?.id, full: this._full },
        bubbles: true,
        composed: true,
      }),
    );
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has("connection") || changed.has("stream")) {
      // Another stream: new players (a battery camera asks for a tap again).
      this._player?.stop();
      this._player = undefined;
      this._hdPlayer?.stop();
      this._hdPlayer = undefined;
      this._hd = undefined;
      this._hdChoosing = undefined;
      this._wanted = this._full || !this.waitsForTap;
    }
    this.toggleAttribute("full", this._full);
  }

  protected override updated(): void {
    this._driveSub();
    this._driveHd();
  }

  private _driveSub(): void {
    const player = this._ensurePlayer();
    if (!player) return;
    player.options.warm = this.warm ?? this.connection?.streams[this.stream]?.warm === true;
    if ((this.shouldPlay && !this.hdShown) || this._pip === "sub") {
      clearTimeout(this._offscreenTimer);
      this._offscreenTimer = undefined;
      this._start(player);
    } else if (player.running) {
      if (!this._pageVisible || !this._wanted || this.suspended || this.hdShown) {
        player.stop();
      } else {
        this._offscreenTimer ??= setTimeout(() => {
          this._offscreenTimer = undefined;
          if (!this.shouldPlay) {
            if (this._pip !== "sub") this._player?.stop();
            if (this._pip !== "hd") this._hdPlayer?.stop();
          }
        }, OFFSCREEN_GRACE_MS);
      }
    }
  }

  /** HD on or off in full screen, remembered on this device for here (at home, or away). */
  private _toggleHd(): void {
    this._hdWanted = !this._hdWanted;
    this._link = { ...this._link, chosen: true };
    rememberFullScreenHd(this._link.where, this._hdWanted);
  }

  private _driveHd(): void {
    const connection = this.connection;
    const full = this._full && this.shouldPlay;
    const wanted = (full && this._hdWanted) || this._pip === "hd";
    // Choose the HD stream in full screen even in SD: its button needs to know.
    if (full && connection && !this._hd && this._hdChoosing !== connection) {
      this._hdChoosing = connection;
      void chooseHd(connection).then((choice) => {
        if (this.connection === connection) this._hd = choice;
      });
    }
    const player = this._ensureHdPlayer();
    if (!player) return;
    if (wanted) this._start(player);
    else if (
      player.running &&
      (!this._full || !this._pageVisible || this.suspended || !this._wanted || !this._hdWanted)
    ) {
      player.stop();
    }
  }

  /** Start a player that is not running; a cold start (WebRTC) waits for the ICE servers. */
  private _start(player: LivePlayer): void {
    if (!player.running && (player.options.warm || this.iceServers)) {
      player.options.iceServers = this.iceServers ?? [];
      player.start();
    }
  }

  private _ensurePlayer(): LivePlayer | undefined {
    if (this._player) return this._player;
    const video = this.renderRoot.querySelector<HTMLVideoElement>("video.sub");
    const connection = this.connection;
    if (!this.hass || !video || !connection) return undefined;
    this._player = new LivePlayer(
      this.hass,
      video,
      { connectionId: connection.connection_id, stream: this.stream },
      { warm: false, iceServers: [] },
      (state) => {
        const live = state.kind === "playing";
        if (live !== (this._state.kind === "playing")) {
          this.dispatchEvent(
            new CustomEvent(TILE_STATE_EVENT, { detail: { cameraId: this.camera?.id ?? "", live }, bubbles: true }),
          );
        }
        this._state = state;
      },
    );
    this._player.onCount = this._count;
    return this._player;
  }

  private _ensureHdPlayer(): LivePlayer | undefined {
    if (this._hdPlayer) return this._hdPlayer;
    const stream = this._hd?.stream;
    const video = this.renderRoot.querySelector<HTMLVideoElement>("video.hd");
    const connection = this.connection;
    if (!this.hass || !stream || !video || !connection) return undefined;
    this._hdPlayer = new LivePlayer(
      this.hass,
      video,
      { connectionId: connection.connection_id, stream },
      { warm: connection.streams[stream]?.warm === true, iceServers: [] },
      (state) => {
        this._hdState = state;
      },
    );
    this._hdPlayer.onCount = this._count;
    return this._hdPlayer;
  }

  private _activate(): void {
    if (this._full) return;
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
    const interactive = !this._full && (this.openable || !this._wanted);
    return html`<div class="frame">
      <div
        class="tile ${playing ? "playing" : ""} ${this.hdShown ? "hd-on" : ""} ${interactive ? "interactive" : ""}"
        @click=${() => {
          this._activate();
        }}
      >
        ${this.image
          ? html`<img class="poster" src=${this.image.url} alt="" />`
          : nothing}
        <video
          class="sub"
          muted
          playsinline
          aria-label=${`${name} live`}
          @enterpictureinpicture=${this._onPipChange}
          @leavepictureinpicture=${this._onPipChange}
          @webkitpresentationmodechanged=${this._onPipChange}
        ></video>
        ${this._hd?.stream
          ? html`<video
              class="hd"
              muted
              playsinline
              aria-label=${`${name} live in HD`}
              @enterpictureinpicture=${this._onPipChange}
              @leavepictureinpicture=${this._onPipChange}
              @webkitpresentationmodechanged=${this._onPipChange}
            ></video>`
          : nothing}
        ${interactive
          ? // The whole tile is this button (its click is the tile's); it says what the tile shows.
            html`<button
              class="open"
              aria-label=${this._wanted ? `Open ${name}` : `Watch ${name}`}
              aria-describedby="state status"
            ></button>`
          : nothing}
        ${this.number !== undefined && !this._full
          ? html`<span class="num" aria-hidden="true">${this.number}</span>`
          : nothing}
        <div class="label">
          <span class="name">${name}</span>
          ${this._wanted
            ? nothing
            : html`<span class="hint">
                ${this.connection?.is_battery ? "Tap to wake it and watch" : "Tap to watch live"}
              </span>`}
        </div>
        ${this.hdShown ? nothing : this._renderStatus(state)}
        ${this._renderHd()}
      </div>
      ${this._debug
        ? html`<rv-live-debug
            .hass=${this.hass}
            .info=${this._debugInfo(name)}
            @rv-live-debug-close=${() => {
              this._debug = false;
              // Back to the button that opened it.
              void this.updateComplete.then(() => {
                this.renderRoot.querySelector<HTMLElement>(".corner-button.info")?.focus();
              });
            }}
          ></rv-live-debug>`
        : nothing}
      <button
        class="corner-button info"
        aria-label=${`${name} debug info`}
        aria-pressed=${this._debug ? "true" : "false"}
        title="What this tile plays, and how"
        @click=${() => {
          this._debug = !this._debug;
        }}
      >
        ${icon("info")}
      </button>
      ${this.controls && (this._full || !this.openable)
        ? html`<rv-live-controls
            .hass=${this.hass}
            .controls=${this.controls}
            .cameraName=${name}
          ></rv-live-controls>`
        : nothing}
      ${(this._full || !this.openable) && (playing || this.hdShown || this._pip) && pipSupported()
        ? html`<button
            class="corner-button pip"
            aria-label=${this._pip ? "Leave picture in picture" : `${name} in picture in picture`}
            aria-pressed=${this._pip ? "true" : "false"}
            title=${this._pip ? "Leave picture in picture" : "Picture in picture: keep watching in a small window"}
            @click=${() => void this._togglePip()}
          >
            ${icon("pip")}
          </button>`
        : nothing}
      <button
        class="corner-button full"
        aria-label=${this._full ? "Exit full screen" : `${name} full screen`}
        title=${this._full ? "Exit full screen" : "Full screen (HD)"}
        @click=${() => {
          if (this._full) this.exitFull();
          else this.enterFull();
        }}
      >
        ${icon(this._full ? "exitFull" : "enterFull")}
      </button>
    </div>`;
  }

  /** What the debug view shows: the players, their state and their last events. */
  private _debugInfo(name: string): TileDebug {
    const players: DebugPlayer[] = [];
    const add = (label: string, stream: LiveStreamKind, player: LivePlayer | undefined, state: PlayerState) => {
      if (player) players.push({ label, stream, warm: player.options.warm, state, events: [...player.events] });
    };
    add("SD", this.stream, this._player, this._state);
    if (this._hd?.stream) add("HD", this._hd.stream, this._hdPlayer, this._hdState);
    return {
      camera: name,
      connection: this.connection,
      players,
      hd: this._hd?.reason,
      webRtcFirstUntil: pageCuts.preferWebRtc() ? pageCuts.until : undefined,
    };
  }

  /** Full screen: SD or HD, a button to switch where there is an HD stream, and why. */
  private _renderHd(): TemplateResult | typeof nothing {
    if (!this._full) return nothing;
    const hd = this._hd;
    if (!hd?.stream) {
      return html`<div class="hd-status" title=${hd?.reason ?? nothing}>
        <span class="badge">SD</span>
        <span class="small">${hd ? hd.reason : "Choosing the HD stream…"}</span>
      </div>`;
    }
    const hdState = this._hdState;
    let detail: string | undefined;
    if (!this._hdWanted) {
      detail = this._link.chosen
        ? "SD, as chosen on this device. Tap HD for full quality."
        : `Lighter SD ${this._link.why}. Tap HD for full quality.`;
    } else if (this.hdShown) detail = undefined;
    else if (hdState.kind === "waiting") detail = `HD cannot play: ${explainLive(hdState.error).text}`;
    else detail = "HD starting…";
    return html`<div class="hd-status" title=${hd.reason}>
      <button
        class="hd-toggle"
        aria-pressed=${this._hdWanted ? "true" : "false"}
        aria-label=${this._hdWanted ? "HD on: switch to the lighter SD" : "HD off: switch to HD"}
        @click=${(e: Event) => {
          e.stopPropagation();
          this._toggleHd();
        }}
      >
        HD
      </button>
      ${detail ? html`<span class="small">${detail}</span>` : nothing}
    </div>`;
  }

  /** What the tile is doing, in a fixed set of words, top right. */
  private _renderStatus(state: PlayerState): TemplateResult | typeof nothing {
    const offline = this.offlineSince;
    if (offline !== undefined) {
      const zone = this.hass?.config?.time_zone;
      // Since today: the time; since before: the date too.
      const since = Date.now() - offline < 12 * 3_600_000 ? formatClock(offline, zone) : formatStamp(offline, zone);
      return html`${stateChip("Offline", html`<i class="dot fault"></i>`)}
        <div class="status center offline" id="status" role="status">
          <span class="what">Offline since ${since}</span>
          <span class="small">Home Assistant cannot reach this camera. It plays again when it is back.</span>
        </div>`;
    }
    if (!this._wanted) {
      if (this.connection?.is_battery) return stateChip("Asleep");
      // Watched for its picture: show it as it is, with when it was taken.
      const taken = this.image ? formatClock(this.image.taken, this.hass?.config?.time_zone) : undefined;
      return stateChip(taken ? `Picture ${taken}` : "No picture yet", icon("picture"));
    }
    if (!this.connection?.streams[this.stream]) return stateChip(`No ${this.stream} stream`);
    switch (state.kind) {
      case "playing":
        return stateChip("Live", html`<i class="dot"></i>`);
      case "starting":
        return stateChip("Starting");
      case "waiting": {
        const why = explainLive(state.error, this.connection.is_battery);
        return html`${stateChip("Retrying")}
          <div class="status center" id="status" role="status">
            <span class="what">${why.text}</span>
            ${why.advice ? html`<span class="small">${why.advice}</span>` : nothing}
            <button
              aria-label=${`Retry now: ${this.camera?.name ?? "camera"}`}
              @click=${(e: Event) => {
                e.stopPropagation();
                this._player?.retryNow();
              }}
            >
              Retry now
            </button>
          </div>`;
      }
      default:
        return nothing;
    }
  }

  static override styles = [
    sharedStyles,
    css`
      :host {
        display: block;
        container-type: inline-size;
      }
      /* On the board: fill the cell. */
      :host([fill]),
      :host([fill]) .frame,
      :host([fill]) .tile {
        height: 100%;
      }
      :host([fill]) .tile {
        aspect-ratio: auto;
      }
      /* A board cell is as tall as the board makes it: what it says fits that. */
      :host([fill]:not([full])) .tile {
        container: board-tile / size;
      }
      :host([fill][fit="cover"]) .poster,
      :host([fill][fit="cover"]) video.sub {
        object-fit: cover;
      }
      /* Full screen: the browser's, or filling the window (the iPhone). */
      :host([full]) {
        position: fixed;
        inset: 0;
        z-index: 10000;
        background: #000;
        overscroll-behavior: contain;
      }
      .frame {
        position: relative;
      }
      :host([full]) .frame,
      :host([full]) .tile {
        height: 100%;
      }
      :host([full]) .tile {
        aspect-ratio: auto;
      }
      :host([full]) .poster,
      :host([full]) video {
        object-fit: contain;
      }
      .tile {
        position: relative;
        aspect-ratio: 16 / 9;
        background: #000;
        border-radius: 2px;
        overflow: hidden;
        color: #f4f4f1;
      }
      .tile.interactive {
        cursor: pointer;
      }
      /* Over the picture, under what the tile says: the tile as a button. */
      .open {
        position: absolute;
        inset: 0;
        width: 100%;
        min-height: 0;
        margin: 0;
        padding: 0;
        border: none;
        border-radius: 0;
        background: transparent;
        cursor: pointer;
      }
      .open:hover:not(:disabled) {
        background: transparent;
      }
      .open:focus-visible {
        outline: 2px solid #f4f4f1;
        outline-offset: -4px;
      }
      /* What the tile says lets a press through to it, but for its own buttons. */
      .num,
      .state,
      .status {
        pointer-events: none;
      }
      .status button {
        pointer-events: auto;
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
      .playing video.sub {
        opacity: 1;
      }
      /* HD replaces the sub stream at once, on its first frame. */
      video.hd {
        transition: none;
        background: #000;
      }
      .hd-on video.hd {
        opacity: 1;
      }
      .num {
        position: absolute;
        top: 8px;
        left: 8px;
        min-width: 26px;
        height: 26px;
        padding: 0 5px;
        box-sizing: border-box;
        display: grid;
        place-items: center;
        background: #f4f4f1;
        color: #111418;
        font-family: var(--rv-font-cond);
        font-size: 16px;
        font-weight: 600;
        line-height: 1;
      }
      .state {
        position: absolute;
        top: 8px;
        right: 8px;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 3px 8px;
        background: rgba(17, 20, 24, 0.74);
        font-size: 13px;
        font-weight: 500;
        line-height: 18px;
        white-space: nowrap;
      }
      /* A camera's own view has its controls top right, and no number. */
      :host(:not([fill])) .state {
        left: 8px;
        right: auto;
      }
      /* Full screen says SD or HD, top left. */
      :host([full]) .state {
        display: none;
      }
      .state .dot {
        width: 7px;
        height: 7px;
        background: currentColor;
      }
      /* Amber is a fault: a camera Home Assistant cannot reach. */
      .state .dot.fault {
        background: var(--rv-fault);
      }
      .state svg {
        width: 16px;
        height: 16px;
      }
      .label {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        flex-direction: column;
        padding: 26px 48px 8px 10px;
        background: linear-gradient(to top, rgba(0, 0, 0, 0.72), rgba(0, 0, 0, 0));
        pointer-events: none;
      }
      .name {
        font-size: 15px;
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .hint {
        font-size: 13px;
        color: #c9cede;
      }
      .hd-status {
        position: absolute;
        top: 8px;
        left: 8px;
        display: flex;
        gap: 6px;
        align-items: center;
        max-width: calc(100% - 64px);
        text-shadow: 0 0 3px #000;
      }
      .hd-status .badge {
        color: #f4f4f1;
        border-color: rgba(244, 244, 241, 0.5);
      }
      .hd-toggle {
        min-height: 32px;
        padding: 0 10px;
        border: 1.5px solid rgba(244, 244, 241, 0.6);
        border-radius: 2px;
        background: rgba(17, 20, 24, 0.6);
        color: #f4f4f1;
        font-family: var(--rv-font-cond);
        font-size: 15px;
        font-weight: 600;
        text-shadow: none;
      }
      .hd-toggle:hover:not(:disabled) {
        background: rgba(17, 20, 24, 0.85);
      }
      .hd-toggle[aria-pressed="true"] {
        border-color: var(--rv-action);
        background: var(--rv-action);
        color: var(--rv-on-action);
      }
      .hd-toggle:focus-visible {
        outline-color: #f4f4f1;
      }
      .corner-button {
        position: absolute;
        right: 6px;
        bottom: 6px;
        width: 34px;
        height: 34px;
        min-height: 0;
        padding: 6px;
        border: none;
        border-radius: 2px;
        background: rgba(17, 20, 24, 0.6);
        color: #f4f4f1;
      }
      .corner-button:hover:not(:disabled) {
        background: rgba(17, 20, 24, 0.85);
      }
      .corner-button:focus-visible {
        outline-color: #f4f4f1;
      }
      .corner-button.info {
        bottom: 44px;
        opacity: 0.85;
      }
      .corner-button.info[aria-pressed="true"] {
        background: var(--rv-action);
        color: var(--rv-on-action);
        opacity: 1;
      }
      .corner-button.pip {
        right: 44px;
      }
      .corner-button.pip[aria-pressed="true"] {
        background: var(--rv-action);
        color: var(--rv-on-action);
      }
      .corner-button svg {
        width: 22px;
        height: 22px;
      }
      /* On the board, its buttons show on hover; a touch screen has full screen only. */
      @media (hover: hover) {
        :host([fill]:not([full])) .corner-button {
          opacity: 0;
          transition: opacity 0.15s;
        }
        :host([fill]:not([full])) .frame:hover .corner-button,
        :host([fill]:not([full])) .corner-button:focus-visible,
        :host([fill]:not([full])) .corner-button[aria-pressed="true"] {
          opacity: 1;
        }
      }
      @media (hover: none) {
        :host([fill]:not([full])) .corner-button.info {
          display: none;
        }
      }
      .status.center {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        text-align: center;
        /* Clear of the number and state above, and the name below. */
        padding: 36px 12px 34px;
        background: rgba(17, 20, 24, 0.55);
      }
      .status.center .what {
        max-width: 34ch;
        color: #f4f4f1;
        font-family: var(--rv-font-cond);
        font-size: 17px;
        font-weight: 600;
        line-height: 1.25;
      }
      .status.center .small {
        max-width: 42ch;
        color: rgba(244, 244, 241, 0.85);
      }
      .status.center.offline {
        background: rgba(17, 20, 24, 0.7);
      }
      /* The tile's number, state and name stay readable over a message. */
      .num,
      .state,
      .label {
        z-index: 1;
      }
      .status.center button {
        color: #f4f4f1;
        border-color: #f4f4f1;
      }
      .status.center button:hover:not(:disabled) {
        background: rgba(244, 244, 241, 0.12);
      }
      @container (max-width: 260px) {
        .num {
          top: 6px;
          left: 6px;
          min-width: 22px;
          height: 22px;
          font-size: 14px;
        }
        .state {
          top: 6px;
          right: 6px;
          padding: 2px 6px;
          font-size: 12px;
        }
        .label {
          padding: 20px 44px 6px 8px;
        }
        .name {
          font-size: 13px;
        }
        .hint {
          font-size: 12px;
        }
        .corner-button.info {
          display: none;
        }
        /* A small tile says what happened; what to do is on the camera's own view. */
        .status.center {
          padding: 30px 8px 26px;
          gap: 6px;
        }
        .status.center .what {
          font-size: 14px;
        }
        .status.center .small {
          display: none;
        }
      }
      /* A short board tile says what happened; what to do is on the camera's own view. */
      @container board-tile (max-height: 220px) {
        .status.center .small {
          display: none;
        }
      }
      /* Too short for a button as well: tapping it opens the camera's view, which has it. */
      @container board-tile (max-height: 130px) {
        .status.center button {
          display: none;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        video,
        .corner-button {
          transition: none;
        }
      }
    `,
  ];
}

function stateChip(label: string, mark?: TemplateResult): TemplateResult {
  return html`<span class="state" id="state">${mark ?? nothing}${label}</span>`;
}

if (!customElements.get("rv-live-tile")) {
  customElements.define("rv-live-tile", RvLiveTile);
}

declare global {
  interface HTMLElementTagNameMap {
    "rv-live-tile": RvLiveTile;
  }
}

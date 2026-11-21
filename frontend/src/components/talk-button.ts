import { LitElement, css, html, nothing, type TemplateResult } from "lit";

import { toError } from "../api";
import { icon } from "../icons";
import { TalkClient, talkUnavailable, type TalkStats } from "../live/talk";
import { sharedStyles } from "../styles";
import type { HomeAssistant } from "../types";

/** A press held this long is push-to-talk: the release ends it. */
export const HOLD_MS = 400;
/** How long a message stays on screen. */
export const MESSAGE_MS = 6000;

type TalkState = "idle" | "starting" | "talking" | "stopping";

/** Say how a talk ended, if it is worth saying. */
export function talkEndedMessage(stats: TalkStats | null): string | undefined {
  if (!stats) return undefined;
  if (stats.ended === "idle") return "Talk ended: no sound from the microphone for a while.";
  if (stats.ended === "limit") return "Talk ended: it lasts 5 minutes at most.";
  if (stats.ended === "error") return `Talk ended: the camera could not be sent the sound (${stats.error ?? "?"}).`;
  return undefined;
}

/**
 * Talk through a camera from its live view (Phase 12c). Hold the button to
 * talk and let go to stop, or tap it to start and tap again to stop; the
 * keyboard toggles. The microphone is asked for first, then the camera; live
 * view keeps playing. Shown only for a camera that takes talk and a user who
 * may (the server says which).
 */
export class RvTalk extends LitElement {
  static override properties = {
    hass: { attribute: false },
    deviceId: { attribute: false },
    cameraName: { attribute: false },
    _state: { state: true },
    _message: { state: true },
    _seconds: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  declare deviceId: string;
  declare cameraName: string;
  declare _state: TalkState;
  declare _message: string | undefined;
  declare _seconds: number;

  /** The running talk; tests replace how one is made. */
  client: TalkClient | undefined;
  makeClient = (hass: HomeAssistant, deviceId: string, ended: (stats: TalkStats) => void): TalkClient =>
    new TalkClient(hass, deviceId, ended);
  /** The last talk's numbers (for the live debug view). */
  lastStats: TalkStats | null = null;
  private _pressAt = 0;
  private _stopOnRelease = false;
  private _stopWhenStarted = false;
  private _timer: ReturnType<typeof setInterval> | undefined;
  private _messageTimer: ReturnType<typeof setTimeout> | undefined;
  private _since = 0;

  constructor() {
    super();
    this.deviceId = "";
    this.cameraName = "Camera";
    this._state = "idle";
    this._seconds = 0;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    void this.stop();
    clearTimeout(this._messageTimer);
  }

  /** Start talking (the microphone, then the camera). */
  async start(): Promise<void> {
    const hass = this.hass;
    if (!hass || this._state !== "idle") return;
    const unavailable = talkUnavailable();
    if (unavailable) {
      this._say(unavailable);
      return;
    }
    this._state = "starting";
    this._say(undefined);
    const client = this.makeClient(hass, this.deviceId, (stats) => {
      if (this.client !== client) return;
      this._ended(stats);
    });
    this.client = client;
    try {
      await client.start();
    } catch (err) {
      if (this.client === client) {
        this.client = undefined;
        this._state = "idle";
        this._say(startError(err));
      }
      return;
    }
    if (this.client !== client) return;
    this._state = "talking";
    this._since = performance.now();
    this._seconds = 0;
    this._timer = setInterval(() => {
      this._seconds = Math.floor((performance.now() - this._since) / 1000);
    }, 500);
    if (this._stopWhenStarted) void this.stop();
  }

  /** Stop talking: what was said plays out, then the camera closes the talk. */
  async stop(): Promise<void> {
    const client = this.client;
    this._stopWhenStarted = false;
    if (!client) return;
    if (this._state === "starting") {
      // Ended as soon as it has started.
      this._stopWhenStarted = true;
      return;
    }
    this.client = undefined;
    clearInterval(this._timer);
    this._state = "stopping";
    const stats = await client.stop();
    this.lastStats = stats;
    this._state = "idle";
    this._say(talkEndedMessage(stats));
  }

  private _ended(stats: TalkStats): void {
    this.client = undefined;
    clearInterval(this._timer);
    this.lastStats = stats;
    this._state = "idle";
    this._say(talkEndedMessage(stats) ?? "Talk ended.");
  }

  private _say(message: string | undefined): void {
    clearTimeout(this._messageTimer);
    this._message = message;
    if (message) {
      this._messageTimer = setTimeout(() => {
        this._message = undefined;
      }, MESSAGE_MS);
    }
  }

  private _down(): void {
    this._pressAt = performance.now();
    if (this._state === "talking") this._stopOnRelease = true;
    else if (this._state === "idle") void this.start();
  }

  private _up(): void {
    const held = performance.now() - this._pressAt >= HOLD_MS;
    if (this._stopOnRelease) {
      this._stopOnRelease = false;
      void this.stop();
    } else if (held && (this._state === "talking" || this._state === "starting")) {
      // Push-to-talk: let go to stop.
      void this.stop();
    }
  }

  override render(): TemplateResult {
    const talking = this._state === "talking";
    const label =
      this._state === "starting"
        ? "Starting…"
        : this._state === "stopping"
          ? "Ending…"
          : talking
            ? `Talking ${String(Math.floor(this._seconds / 60))}:${String(this._seconds % 60).padStart(2, "0")}`
            : "Talk";
    return html`<button
        class="talk ${talking ? "on" : ""}"
        aria-pressed=${talking || this._state === "starting" ? "true" : "false"}
        aria-label=${talking ? `Stop talking through ${this.cameraName}` : `Talk through ${this.cameraName}`}
        title="Talk through the camera: hold to talk, or tap to start and tap again to stop"
        ?disabled=${this._state === "stopping"}
        @pointerdown=${(e: PointerEvent) => {
          if (e.button !== 0) return;
          this._down();
        }}
        @pointerup=${() => {
          this._up();
        }}
        @keydown=${(e: KeyboardEvent) => {
          if (e.repeat || (e.key !== "Enter" && e.key !== " ")) return;
          e.preventDefault();
          if (this._state === "idle") void this.start();
          else void this.stop();
        }}
        @contextmenu=${(e: Event) => {
          e.preventDefault();
        }}
      >
        ${icon("mic")}<span>${label}</span>
      </button>
      ${this._message ? html`<div class="message" role="alert">${this._message}</div>` : nothing}`;
  }

  static override styles = [
    sharedStyles,
    css`
      :host {
        position: absolute;
        left: 50%;
        bottom: 8px;
        transform: translateX(-50%);
        display: flex;
        flex-direction: column-reverse;
        align-items: center;
        gap: 6px;
        pointer-events: none;
        color: var(--rv-on-board);
      }
      .talk,
      .message {
        pointer-events: auto;
      }
      .talk {
        display: flex;
        gap: 6px;
        align-items: center;
        min-height: 40px;
        padding: 6px 16px;
        border: none;
        border-radius: 20px;
        background: rgba(17, 20, 24, 0.72);
        color: var(--rv-on-board);
        touch-action: none;
        user-select: none;
        -webkit-user-select: none;
        -webkit-touch-callout: none;
      }
      .talk.on {
        background: var(--rv-fault);
        color: var(--rv-on-fault);
      }
      .talk svg {
        width: 20px;
        height: 20px;
      }
      .talk:disabled {
        opacity: 0.6;
      }
      .message {
        max-width: min(360px, 90vw);
        padding: 6px 12px;
        font-size: 13px;
        background: var(--rv-board);
        border-top: 2px solid var(--rv-fault);
      }
    `,
  ];
}

/** Why a talk did not start, in plain words. */
export function startError(err: unknown): string {
  const error = toError(err);
  if (error.name === "NotAllowedError" || /permission|denied/i.test(error.message)) {
    return "The microphone is blocked for this page: allow it in the browser's (or the app's) settings.";
  }
  if (error.name === "NotFoundError") return "No microphone found.";
  if (/already talking/i.test(error.message)) return "Someone is already talking through this camera.";
  if (/only administrators/i.test(error.message)) return "Only administrators may talk through cameras here.";
  return `Talk did not start: ${error.message}`;
}

if (!customElements.get("rv-talk")) {
  customElements.define("rv-talk", RvTalk);
}

declare global {
  interface HTMLElementTagNameMap {
    "rv-talk": RvTalk;
  }
}

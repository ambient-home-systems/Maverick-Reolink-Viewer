import { LitElement, css, html, nothing, svg, type TemplateResult } from "lit";

import { toError } from "../api";
import { icon } from "../icons";
import { sharedStyles } from "../styles";
import type { HassEntity, HomeAssistant, LiveControls, PtzMove } from "../types";

/** How long an error stays on screen. */
export const ERROR_MS = 5000;

/** The pad's cells, row by row; a move the camera lacks leaves its cell empty. */
const PAD: (PtzMove | null)[] = ["left_up", "up", "right_up", "left", null, "right", "left_down", "down", "right_down"];
/** Each move's arrow: a left chevron turned this far. */
const TURN: Partial<Record<PtzMove, number>> = {
  left: 0,
  left_up: 45,
  up: 90,
  right_up: 135,
  right: 180,
  right_down: 225,
  down: 270,
  left_down: 315,
};
const LABEL: Record<PtzMove, string> = {
  left: "Move left",
  right: "Move right",
  up: "Move up",
  down: "Move down",
  left_up: "Move left and up",
  left_down: "Move left and down",
  right_up: "Move right and up",
  right_down: "Move right and down",
  zoom_in: "Zoom in",
  zoom_out: "Zoom out",
};

/**
 * A camera's controls over its live view, through Home Assistant's own
 * entities and standard actions (Home Assistant's state is what they show):
 * PTZ moves held down (a press of the move's button starts it, PTZ stop ends
 * it on release, sent once the move's press is done), presets, zoom and
 * focus, the floodlight, and the siren (after a confirmation, as it is loud
 * and keeps sounding until it is stopped).
 */
export class RvLiveControls extends LitElement {
  static override properties = {
    hass: { attribute: false },
    controls: { attribute: false },
    cameraName: { attribute: false },
    _moving: { state: true },
    _confirmSiren: { state: true },
    _error: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  declare controls: LiveControls | undefined;
  declare cameraName: string;
  declare _moving: PtzMove | undefined;
  declare _confirmSiren: boolean;
  declare _error: string | undefined;

  /** The press that started the current move (stop is sent after it). */
  private _movement: Promise<unknown> | undefined;
  private _errorTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    super();
    this.cameraName = "Camera";
    this._confirmSiren = false;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.release();
    clearTimeout(this._errorTimer);
  }

  /** Start a PTZ move (held until release). */
  press(move: PtzMove): void {
    const entity = this.controls?.ptz?.[move];
    if (this._moving || !entity || !this._usable(entity)) return;
    this._moving = move;
    this._movement = this._call("button", "press", entity, LABEL[move].toLowerCase());
  }

  /** End the current PTZ move, once its start has been sent. */
  release(): void {
    if (!this._moving) return;
    this._moving = undefined;
    const stop = this.controls?.ptz?.stop;
    const started = this._movement ?? Promise.resolve();
    this._movement = undefined;
    if (stop) void started.finally(() => this._call("button", "press", stop, "stop moving"));
  }

  private _state(entity: string | undefined): HassEntity | undefined {
    return entity ? this.hass?.states[entity] : undefined;
  }

  private _usable(entity: string | undefined): boolean {
    const state = this._state(entity)?.state;
    return state !== undefined && state !== "unavailable";
  }

  private async _call(
    domain: string,
    service: string,
    entity: string,
    what: string,
    data: Record<string, unknown> = {},
  ): Promise<void> {
    try {
      await this.hass?.callService(domain, service, data, { entity_id: entity }, false);
    } catch (err) {
      this._showError(`Could not ${what}: ${toError(err).message}`);
    }
  }

  private _showError(message: string): void {
    this._error = message;
    clearTimeout(this._errorTimer);
    this._errorTimer = setTimeout(() => {
      this._error = undefined;
    }, ERROR_MS);
  }

  /** Step a zoom or focus number by a tenth of its range. */
  private _step(entity: string, direction: 1 | -1, what: string): void {
    const state = this._state(entity);
    const value = Number(state?.state);
    if (!state || !Number.isFinite(value)) return;
    const attrs = state.attributes as { min?: number; max?: number; step?: number };
    const min = attrs.min ?? 0;
    const max = attrs.max ?? 100;
    const step = Math.max(attrs.step ?? 1, Math.round((max - min) / 10));
    const next = Math.min(max, Math.max(min, value + direction * step));
    if (next !== value) void this._call("number", "set_value", entity, what, { value: next });
  }

  protected override render(): TemplateResult {
    const controls = this.controls ?? {};
    return html`${this._renderTop(controls)} ${this._renderPad(controls)} ${this._renderZoom(controls)}
    ${this._confirmSiren ? this._renderConfirm() : nothing}
    ${this._error ? html`<div class="error" role="alert">${this._error}</div>` : nothing}`;
  }

  private _renderTop(controls: LiveControls): TemplateResult | typeof nothing {
    const { preset, floodlight, siren } = controls;
    if (!preset && !floodlight && !siren) return nothing;
    const presetState = this._state(preset);
    const options = (presetState?.attributes as { options?: string[] } | undefined)?.options ?? [];
    const lightOn = this._state(floodlight)?.state === "on";
    const sirenOn = this._state(siren)?.state === "on";
    return html`<div class="top">
      ${preset && options.length
        ? html`<select
            aria-label="Go to a preset"
            ?disabled=${!this._usable(preset)}
            @change=${(e: Event) => {
              const select = e.target as HTMLSelectElement;
              const option = select.value;
              select.value = "";
              if (option) void this._call("select", "select_option", preset, "go to the preset", { option });
            }}
          >
            <option value="">Preset…</option>
            ${options.map((option) => html`<option value=${option}>${option}</option>`)}
          </select>`
        : nothing}
      ${floodlight
        ? html`<button
            class="toggle ${lightOn ? "on" : ""}"
            aria-pressed=${lightOn ? "true" : "false"}
            ?disabled=${!this._usable(floodlight)}
            @click=${() => {
              void this._call("light", lightOn ? "turn_off" : "turn_on", floodlight, "switch the floodlight");
            }}
          >
            Light
          </button>`
        : nothing}
      ${siren
        ? html`<button
            class="toggle siren ${sirenOn ? "on" : ""}"
            aria-pressed=${sirenOn ? "true" : "false"}
            ?disabled=${!this._usable(siren)}
            @click=${() => {
              if (sirenOn) void this._call("siren", "turn_off", siren, "stop the siren");
              else this._confirmSiren = true;
            }}
          >
            ${sirenOn ? "Stop siren" : "Siren"}
          </button>`
        : nothing}
    </div>`;
  }

  private _renderConfirm(): TemplateResult {
    const siren = this.controls?.siren;
    return html`<div class="confirm" role="alertdialog" aria-labelledby="siren-title">
      <strong id="siren-title">Sound the siren on ${this.cameraName}?</strong>
      <span class="small">It is loud, and keeps sounding until you stop it.</span>
      <span class="actions">
        <button
          @click=${() => {
            this._confirmSiren = false;
          }}
        >
          Cancel
        </button>
        <button
          class="danger"
          @click=${() => {
            this._confirmSiren = false;
            if (siren) void this._call("siren", "turn_on", siren, "sound the siren");
          }}
        >
          Sound it
        </button>
      </span>
    </div>`;
  }

  private _renderPad(controls: LiveControls): TemplateResult | typeof nothing {
    const ptz = controls.ptz;
    if (!ptz?.stop) return nothing;
    return html`<div class="pad" role="group" aria-label="Move the camera">
      ${PAD.map((move) =>
        move && ptz[move]
          ? this._holdButton(move, html`<svg viewBox="0 0 24 24" aria-hidden="true" style="transform: rotate(${TURN[move] ?? 0}deg)">
              ${svg`<path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />`}
            </svg>`)
          : html`<span></span>`,
      )}
    </div>`;
  }

  private _renderZoom(controls: LiveControls): TemplateResult | typeof nothing {
    const ptz = controls.ptz;
    const buttons = ptz?.stop && ptz.zoom_in && ptz.zoom_out;
    const zoom = buttons ? undefined : controls.zoom;
    const focus = controls.focus;
    if (!buttons && !zoom && !focus) return nothing;
    const stepper = (entity: string, what: string, label: string) =>
      html`<span class="stepper" role="group" aria-label=${label}>
        <button
          aria-label=${`${label} out`}
          ?disabled=${!this._usable(entity)}
          @click=${() => {
            this._step(entity, -1, what);
          }}
        >
          ${icon("minus")}
        </button>
        <span class="small">${label}</span>
        <button
          aria-label=${`${label} in`}
          ?disabled=${!this._usable(entity)}
          @click=${() => {
            this._step(entity, 1, what);
          }}
        >
          ${icon("plus")}
        </button>
      </span>`;
    return html`<div class="zoom">
      ${focus ? stepper(focus, "focus", "Focus") : nothing}
      ${buttons
        ? html`<span class="stepper" role="group" aria-label="Zoom">
            ${this._holdButton("zoom_out", icon("minus"))}<span class="small">Zoom</span>${this._holdButton("zoom_in", icon("plus"))}
          </span>`
        : zoom
          ? stepper(zoom, "zoom", "Zoom")
          : nothing}
    </div>`;
  }

  /** A button that moves while it is held (pointer, or Enter/Space). */
  private _holdButton(move: PtzMove, content: TemplateResult): TemplateResult {
    const entity = this.controls?.ptz?.[move];
    return html`<button
      class="hold ${this._moving === move ? "held" : ""}"
      aria-label=${LABEL[move]}
      ?disabled=${!this._usable(entity)}
      @pointerdown=${(e: PointerEvent) => {
        e.preventDefault();
        try {
          // Its release comes here even if the finger slides off the button.
          (e.currentTarget as Element).setPointerCapture(e.pointerId);
        } catch {
          // Not an active pointer (a synthetic event): pointerup still releases.
        }
        this.press(move);
      }}
      @pointerup=${() => {
        this.release();
      }}
      @pointercancel=${() => {
        this.release();
      }}
      @lostpointercapture=${() => {
        this.release();
      }}
      @keydown=${(e: KeyboardEvent) => {
        if ((e.key === "Enter" || e.key === " ") && !e.repeat) {
          e.preventDefault();
          this.press(move);
        }
      }}
      @keyup=${(e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") this.release();
      }}
      @blur=${() => {
        this.release();
      }}
      @contextmenu=${(e: Event) => {
        e.preventDefault();
      }}
    >
      ${content}
    </button>`;
  }

  static override styles = [
    sharedStyles,
    css`
      :host {
        position: absolute;
        inset: 0;
        pointer-events: none;
        color: var(--rv-on-board);
      }
      .top,
      .pad,
      .zoom,
      .confirm,
      .error {
        position: absolute;
        pointer-events: auto;
      }
      /* Square controls in the board's ink over the video. */
      button,
      select {
        border: none;
        border-radius: 2px;
        background: rgba(17, 20, 24, 0.72);
        color: var(--rv-on-board);
        min-height: 32px;
      }
      button:disabled {
        opacity: 0.4;
      }
      .top {
        top: 8px;
        right: 36px;
        display: flex;
        gap: 6px;
        align-items: center;
      }
      .top select {
        padding: 4px 8px;
        max-width: 140px;
      }
      .toggle {
        padding: 4px 12px;
      }
      .toggle.on {
        background: var(--rv-on-board);
        color: var(--rv-board);
      }
      .toggle.siren.on {
        background: var(--rv-fault);
        color: var(--rv-on-fault);
      }
      .pad {
        left: 8px;
        bottom: 28px;
        display: grid;
        grid-template-columns: repeat(3, 32px);
        grid-template-rows: repeat(3, 32px);
        gap: 2px;
      }
      .hold {
        width: 32px;
        height: 32px;
        padding: 4px;
        touch-action: none;
        user-select: none;
        -webkit-user-select: none;
        -webkit-touch-callout: none;
      }
      .hold.held {
        background: var(--rv-on-board);
        color: var(--rv-board);
      }
      .hold svg {
        display: block;
        width: 24px;
        height: 24px;
      }
      .zoom {
        right: 48px;
        bottom: 6px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        align-items: flex-end;
      }
      .stepper {
        display: flex;
        gap: 4px;
        align-items: center;
        text-shadow: 0 0 3px #000;
      }
      .stepper button {
        width: 32px;
        padding: 0;
        font-size: 18px;
      }
      .confirm {
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        display: flex;
        flex-direction: column;
        gap: 6px;
        max-width: min(320px, 90%);
        padding: 12px 16px;
        border-top: 2px solid var(--rv-fault);
        background: var(--rv-board);
      }
      .confirm .actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
      }
      .confirm button {
        padding: 4px 12px;
      }
      .confirm button.danger {
        background: var(--rv-fault);
        color: var(--rv-on-fault);
      }
      .error {
        left: 50%;
        top: 44px;
        transform: translateX(-50%);
        max-width: 90%;
        padding: 6px 12px;
        font-size: 13px;
        background: var(--rv-fault);
        color: var(--rv-on-fault);
      }
    `,
  ];
}

if (!customElements.get("rv-live-controls")) {
  customElements.define("rv-live-controls", RvLiveControls);
}

declare global {
  interface HTMLElementTagNameMap {
    "rv-live-controls": RvLiveControls;
  }
}

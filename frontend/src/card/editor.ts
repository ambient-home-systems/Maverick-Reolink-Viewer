// The dashboard card's editor (Home Assistant's visual editor for
// custom:reolink-viewer-camera): the camera, SD or HD, what a tap does, the
// name and state, how the picture fits; and whether the camera is kept warm,
// with its switch. Fetched when the editor opens. Plain form controls in Home
// Assistant's theme colours, so it reads like the dialog around it.
import { LitElement, css, html, nothing, type TemplateResult } from "lit";

import { fetchLiveCameras, toError } from "../api";
import { isWarm, liveConnection } from "../live/data";
import type { HomeAssistant, LiveCamera } from "../types";
import { EDITOR_ELEMENT, cardConfig, storedConfig, type CameraCardConfig } from "./config";

/** Fired with the new settings: Home Assistant's editor event. */
export const CONFIG_CHANGED = "config-changed";

export class ReolinkViewerCameraEditor extends LitElement {
  static override properties = {
    hass: { attribute: false },
    _raw: { state: true },
    _cameras: { state: true },
    _error: { state: true },
    _switchError: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  /** The settings as the dashboard has them. */
  declare _raw: Record<string, unknown>;
  declare _cameras: LiveCamera[] | undefined;
  declare _error: string | undefined;
  declare _switchError: string | undefined;

  private _loading = false;

  constructor() {
    super();
    this._raw = {};
  }

  setConfig(config: Record<string, unknown>): void {
    this._raw = { ...config };
  }

  private get _config(): CameraCardConfig | undefined {
    try {
      return cardConfig(this._raw);
    } catch {
      return undefined;
    }
  }

  protected override willUpdate(): void {
    if (this.hass && !this._cameras && !this._loading && !this._error) void this._load(this.hass);
  }

  private async _load(hass: HomeAssistant): Promise<void> {
    this._loading = true;
    try {
      this._cameras = (await fetchLiveCameras(hass)).cameras;
    } catch (err) {
      this._error = toError(err).message;
    } finally {
      this._loading = false;
    }
  }

  private _change(change: Partial<CameraCardConfig>): void {
    this._raw = storedConfig(this._raw, change);
    this.dispatchEvent(
      new CustomEvent(CONFIG_CHANGED, { detail: { config: this._raw }, bubbles: true, composed: true }),
    );
  }

  protected override render(): TemplateResult {
    const config = this._config;
    if (!config) {
      return html`<p class="note">These settings can only be changed in the card's YAML.</p>`;
    }
    const cameras = this._cameras;
    const camera = cameras?.find((c) => c.id === config.camera);
    return html`<div class="form">
      <label class="field">
        <span class="name">Camera</span>
        ${cameras
          ? html`<select
              @change=${(e: Event) => {
                this._change({ camera: (e.target as HTMLSelectElement).value });
              }}
            >
              ${camera ? nothing : html`<option value="" selected disabled>Choose a camera</option>`}
              ${cameras.map(
                (c) => html`<option value=${c.id} ?selected=${c.id === config.camera}>${c.name}</option>`,
              )}
            </select>`
          : html`<span class="note">${this._error ? `Could not load the cameras: ${this._error}` : "Loading the cameras…"}</span>`}
      </label>
      ${camera ? this._renderWarm(camera, config) : nothing}

      <fieldset>
        <legend class="name">Quality</legend>
        ${this._radio("quality", "sd", config.quality, "SD", "The camera's sub stream: light, and at once on a camera kept warm.")}
        ${this._radio(
          "quality",
          "hd",
          config.quality,
          "HD",
          "Its full-quality stream on the card itself. It starts in 2–10 s each time, and takes one more of the NVR's or camera's streams while shown. Full screen plays HD either way.",
        )}
      </fieldset>

      <label class="field">
        <span class="name">Tap the card to</span>
        <select
          @change=${(e: Event) => {
            this._change({ tap_action: (e.target as HTMLSelectElement).value as CameraCardConfig["tap_action"] });
          }}
        >
          <option value="full_screen" ?selected=${config.tap_action === "full_screen"}>Go full screen, in HD</option>
          <option value="open_panel" ?selected=${config.tap_action === "open_panel"}>Open the camera in Reolink</option>
          <option value="none" ?selected=${config.tap_action === "none"}>Nothing</option>
        </select>
      </label>

      <fieldset>
        <legend class="name">Over the picture</legend>
        ${this._check("show_name", config.show_name, "The camera's name")}
        ${this._check("show_state", config.show_state, "Its state (Live, Starting); problems always show")}
      </fieldset>

      <fieldset>
        <legend class="name">The picture</legend>
        ${this._radio("fit", "cover", config.fit, "Fill the card", "Crops the picture when the card's shape differs from it.")}
        ${this._radio("fit", "contain", config.fit, "Show it whole", "With bars where the card's shape differs from it.")}
      </fieldset>
    </div>`;
  }

  /** Not kept warm: its video waits for the camera. The switch is Home Assistant's (switch actions). */
  private _renderWarm(camera: LiveCamera, config: CameraCardConfig): TemplateResult | typeof nothing {
    if (liveConnection(camera)?.is_battery) {
      return html`<p class="note">
        A battery camera is never kept warm, so it can sleep: the card shows its last picture, and its video plays when
        tapped.
      </p>`;
    }
    const entity = camera.keep_warm_entity;
    if (!entity) return nothing;
    const warm = isWarm(this.hass, camera);
    const state = this.hass?.states[entity]?.state;
    return html`<div class=${warm ? "warm" : "warm cold"}>
      ${warm || config.quality === "hd"
        ? nothing
        : html`<p class="warning" role="status">
            Not kept warm: its video starts in 2–10 s. Keep it warm to start at once.
          </p>`}
      <label class="check">
        <input
          type="checkbox"
          .checked=${state === "on"}
          ?disabled=${state !== "on" && state !== "off"}
          @change=${(e: Event) => {
            const on = (e.target as HTMLInputElement).checked;
            this._switchError = undefined;
            this.hass
              ?.callService("switch", on ? "turn_on" : "turn_off", { entity_id: entity })
              .catch((err: unknown) => {
                this._switchError = toError(err).message;
              });
          }}
        />
        <span>
          Keep warm
          <span class="note">Keeps the camera connected, using one of its NVR's or camera's streams all the time.</span>
        </span>
      </label>
      ${this._switchError ? html`<p class="warning" role="alert">Could not change it: ${this._switchError}</p>` : nothing}
    </div>`;
  }

  private _radio<K extends "quality" | "fit">(
    key: K,
    value: CameraCardConfig[K],
    current: CameraCardConfig[K],
    label: string,
    about: string,
  ): TemplateResult {
    return html`<label class="check">
      <input
        type="radio"
        name=${key}
        .checked=${value === current}
        @change=${() => {
          this._change({ [key]: value });
        }}
      />
      <span>${label} <span class="note">${about}</span></span>
    </label>`;
  }

  private _check(key: "show_name" | "show_state", checked: boolean, label: string): TemplateResult {
    return html`<label class="check">
      <input
        type="checkbox"
        .checked=${checked}
        @change=${(e: Event) => {
          this._change({ [key]: (e.target as HTMLInputElement).checked });
        }}
      />
      <span>${label}</span>
    </label>`;
  }

  static override styles = css`
    :host {
      display: block;
      color: var(--primary-text-color);
    }
    .form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .name {
      font-weight: 500;
    }
    select {
      min-height: 40px;
      padding: 0 8px;
      border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.2));
      border-radius: 4px;
      color: var(--primary-text-color);
      background: var(--card-background-color, transparent);
      font: inherit;
    }
    fieldset {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin: 0;
      padding: 0;
      border: none;
    }
    legend {
      padding: 0;
      margin-bottom: 6px;
    }
    .check {
      display: flex;
      gap: 8px;
      align-items: flex-start;
    }
    .check input {
      margin: 3px 0 0;
      accent-color: var(--primary-color);
    }
    .check > span {
      display: flex;
      flex-direction: column;
    }
    .note {
      margin: 0;
      color: var(--secondary-text-color);
      font-size: 0.9em;
    }
    .warm {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    /* As Home Assistant's own alerts: a light tint of its warning colour. */
    .warning {
      margin: 0;
      padding: 8px 12px;
      border-radius: 4px;
      background: color-mix(in srgb, var(--warning-color, #ffa600) 16%, transparent);
    }
  `;
}

if (!customElements.get(EDITOR_ELEMENT)) {
  customElements.define(EDITOR_ELEMENT, ReolinkViewerCameraEditor);
}

declare global {
  interface HTMLElementTagNameMap {
    "reolink-viewer-camera-editor": ReolinkViewerCameraEditor;
  }
}

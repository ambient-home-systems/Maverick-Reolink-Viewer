// The Wall card's editor (Home Assistant's visual editor for
// custom:reolink-viewer-wall, Phase 9 step 5): which saved layout, and whether
// the bar shows. Layouts are made on the Reolink panel's Wall and are the
// user's own, so the card shows them to that user. Fetched when the editor
// opens. Plain form controls in Home Assistant's theme colours, as the camera
// card's editor.
import { LitElement, css, html, nothing, type TemplateResult } from "lit";

import { fetchWallLayouts, toError } from "../api";
import type { HomeAssistant, WallLayout } from "../types";
import { CONFIG_CHANGED } from "./editor-event";
import { WALL_EDITOR_ELEMENT, storedWallConfig, wallCardConfig, type WallCardConfig } from "./wall-config";

export class ReolinkViewerWallEditor extends LitElement {
  static override properties = {
    hass: { attribute: false },
    _raw: { state: true },
    _layouts: { state: true },
    _error: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  /** The settings as the dashboard has them. */
  declare _raw: Record<string, unknown>;
  declare _layouts: WallLayout[] | undefined;
  declare _error: string | undefined;

  private _loading = false;

  constructor() {
    super();
    this._raw = {};
  }

  setConfig(config: Record<string, unknown>): void {
    this._raw = { ...config };
  }

  private get _config(): WallCardConfig | undefined {
    try {
      return wallCardConfig(this._raw);
    } catch {
      return undefined;
    }
  }

  protected override willUpdate(): void {
    if (this.hass && !this._layouts && !this._loading && !this._error) void this._load(this.hass);
  }

  private async _load(hass: HomeAssistant): Promise<void> {
    this._loading = true;
    try {
      this._layouts = (await fetchWallLayouts(hass)).layouts;
    } catch (err) {
      this._error = toError(err).message;
    } finally {
      this._loading = false;
    }
  }

  private _change(change: Partial<WallCardConfig>): void {
    this._raw = storedWallConfig(this._raw, change);
    this.dispatchEvent(
      new CustomEvent(CONFIG_CHANGED, { detail: { config: this._raw }, bubbles: true, composed: true }),
    );
  }

  protected override render(): TemplateResult {
    const config = this._config;
    if (!config) {
      return html`<p class="note">These settings can only be changed in the card's YAML.</p>`;
    }
    const layouts = this._layouts;
    const known = !config.layout || (layouts?.some((l) => l.id === config.layout) ?? true);
    return html`<div class="form">
      <label class="field">
        <span class="name">Layout</span>
        ${layouts
          ? html`<select
              @change=${(e: Event) => {
                const value = (e.target as HTMLSelectElement).value;
                this._change(value ? { layout: value } : { layout: "" });
              }}
            >
              <option value="" ?selected=${!config.layout}>All cameras</option>
              ${layouts.map((l) => html`<option value=${l.id} ?selected=${l.id === config.layout}>${l.name}</option>`)}
              ${known
                ? nothing
                : html`<option value=${config.layout ?? ""} selected>“${config.layout}” (not one of yours)</option>`}
            </select>`
          : html`<span class="note">${this._error ? `Could not load the layouts: ${this._error}` : "Loading the layouts…"}</span>`}
        <span class="note">
          Layouts are made on the Reolink panel's Wall (Layout ⌄), and are your own: shown to another Home
          Assistant user, the card shows every camera.
        </span>
      </label>
      <label class="check">
        <input
          type="checkbox"
          .checked=${config.show_bar}
          @change=${(e: Event) => {
            this._change({ show_bar: (e.target as HTMLInputElement).checked });
          }}
        />
        <span>
          Show the bar
          <span class="note">The layout's name, its pages, the time and full screen, above the video.</span>
        </span>
      </label>
    </div>`;
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
  `;
}

if (!customElements.get(WALL_EDITOR_ELEMENT)) {
  customElements.define(WALL_EDITOR_ELEMENT, ReolinkViewerWallEditor);
}

declare global {
  interface HTMLElementTagNameMap {
    "reolink-viewer-wall-editor": ReolinkViewerWallEditor;
  }
}

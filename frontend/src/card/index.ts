// The dashboard card's module (Phase 7 step 1, docs/IMPLEMENTATION_PLAN.md):
// custom:reolink-viewer-camera, one camera live as the panel shows it. The
// integration adds this module to every Home Assistant page
// (frontend.add_extra_js_url), so there is no dashboard resource to add; it is
// kept small: the card's settings, its size, and its entry in the card
// picker. What plays the camera (the panel's live tile) is its own file,
// fetched once a card is shown; the editor too, once it is opened.
import { LitElement, css, html, nothing, type TemplateResult } from "lit";

import type { HomeAssistant } from "../types";
import {
  CARD_DOCS,
  CARD_ELEMENT,
  EDITOR_ELEMENT,
  GRID_OPTIONS,
  cardConfig,
  cardSize,
  type CameraCardConfig,
} from "./config";

let body: Promise<unknown> | undefined;

/** The card's body (the live tile and what it needs), fetched once. */
function loadBody(): Promise<unknown> {
  body ??= import("./camera-card").catch((err: unknown) => {
    body = undefined; // tried again the next time a card is shown
    throw err;
  });
  return body;
}

export class ReolinkViewerCameraCard extends LitElement {
  static override properties = {
    hass: { attribute: false },
    _config: { state: true },
    _loadError: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  declare _config: CameraCardConfig | undefined;
  declare _loadError: string | undefined;

  /** The card's settings from the dashboard; a wrong one is shown as Home Assistant's error card. */
  setConfig(config: unknown): void {
    this._config = cardConfig(config);
  }

  /** Its height in a masonry view (rows of about 50 px). */
  getCardSize(): number {
    return cardSize(this._config?.camera);
  }

  /** Its size in a sections view. */
  getGridOptions(): typeof GRID_OPTIONS {
    return GRID_OPTIONS;
  }

  static async getConfigElement(): Promise<HTMLElement> {
    await import("./editor");
    return document.createElement(EDITOR_ELEMENT);
  }

  /** A new card from the card picker: the first camera. */
  static async getStubConfig(hass: HomeAssistant): Promise<{ camera?: string }> {
    try {
      const { cameras } = await hass.callWS<{ cameras: { id: string }[] }>({ type: "reolink_viewer/live/cameras" });
      return cameras[0] ? { camera: cameras[0].id } : {};
    } catch {
      return {};
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this._load();
  }

  private _load(): void {
    this._loadError = undefined;
    loadBody().catch((err: unknown) => {
      this._loadError = err instanceof Error ? err.message : String(err);
    });
  }

  protected override render(): TemplateResult | typeof nothing {
    if (!this._config) return nothing;
    if (this._loadError) {
      return html`<div class="error" role="alert">
        Could not load the camera card: ${this._loadError}
        <button
          @click=${() => {
            this._load();
          }}
        >
          Try again
        </button>
      </div>`;
    }
    return html`<rv-camera-card .hass=${this.hass} .config=${this._config}></rv-camera-card>`;
  }

  static override styles = css`
    :host {
      display: block;
      height: 100%;
    }
    rv-camera-card {
      display: block;
      height: 100%;
    }
    .error {
      padding: 16px;
      color: var(--primary-text-color);
      background: var(--card-background-color, #fff);
    }
  `;
}

interface CustomCard {
  type: string;
  name: string;
  description: string;
  preview?: boolean;
  documentationURL?: string;
}

declare global {
  interface Window {
    customCards?: CustomCard[];
  }
  interface HTMLElementTagNameMap {
    "reolink-viewer-camera": ReolinkViewerCameraCard;
  }
}

if (!customElements.get(CARD_ELEMENT)) {
  customElements.define(CARD_ELEMENT, ReolinkViewerCameraCard);
  // In the dashboard's card picker. No preview there: it would start a stream.
  window.customCards ??= [];
  window.customCards.push({
    type: CARD_ELEMENT,
    name: "Reolink camera",
    description: "One camera live, as fast as the Reolink panel shows it: its last picture at once, then video.",
    preview: false,
    documentationURL: CARD_DOCS,
  });
}

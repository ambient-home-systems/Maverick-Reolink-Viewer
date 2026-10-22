import { LitElement, css, html, nothing, type TemplateResult } from "lit";

import { LiveData, cameraFor, liveConnection } from "../live/data";
import { sharedStyles } from "../styles";
import type { HomeAssistant } from "../types";
import "./live-tile";
import { navigate } from "./navigation";

/**
 * Every camera live, on its sub stream (Reolink → Live). Each tile shows the
 * camera's last picture at once and fades into video; a click opens the
 * camera's Live tab.
 */
export class RvLiveGrid extends LitElement {
  static override properties = {
    hass: { attribute: false },
  };

  declare hass: HomeAssistant | undefined;

  private readonly _data = new LiveData(this);

  protected override willUpdate(): void {
    this._data.hass = this.hass;
  }

  protected override render(): TemplateResult {
    const data = this._data;
    const cameras = data.cameras;
    return html`<div class="header">
        <button
          class="text back"
          @click=${() => {
            navigate(this, { view: "list" });
          }}
        >
          ← Devices
        </button>
        <h2>Live</h2>
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
          : html`<p class="muted">Loading…</p>`
        : cameras.length === 0
          ? html`<p class="muted">No camera can be watched live.</p>`
          : html`<div
              class="grid"
              @rv-live-open=${(e: CustomEvent<{ cameraId: string }>) => {
                navigate(this, {
                  view: "device",
                  id: e.detail.cameraId,
                  tab: "live",
                });
              }}
            >
              ${cameras.map(
                (camera) =>
                  html`<rv-live-tile
                    .hass=${this.hass}
                    .camera=${camera}
                    .connection=${liveConnection(camera)}
                    .image=${data.images[camera.id]}
                    .iceServers=${data.iceServers}
                    openable
                  ></rv-live-tile>`,
              )}
            </div>`}`;
  }

  static override styles = [
    sharedStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .header {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .header h2 {
        margin: 0;
      }
      .back {
        padding-left: 0;
        color: var(--primary-color);
      }
      .grid {
        display: grid;
        gap: 8px;
        grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
      }
    `,
  ];
}

/** One camera live, large (the camera's Live tab). */
export class RvLiveCamera extends LitElement {
  static override properties = {
    hass: { attribute: false },
    deviceId: { attribute: false },
  };

  declare hass: HomeAssistant | undefined;
  /** The camera's id, or the id of one of its connections. */
  declare deviceId: string;

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
    return html`<rv-live-tile
      .hass=${this.hass}
      .camera=${camera}
      .connection=${liveConnection(camera)}
      .image=${data.images[camera.id]}
      .iceServers=${data.iceServers}
    ></rv-live-tile>`;
  }

  static override styles = [
    sharedStyles,
    css`
      :host {
        display: block;
        max-width: 1280px;
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

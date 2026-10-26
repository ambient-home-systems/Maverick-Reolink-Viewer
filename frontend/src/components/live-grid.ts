import { LitElement, css, html, nothing, type TemplateResult } from "lit";

import { toError } from "../api";
import { LiveData, cameraFor, isWarm, liveConnection } from "../live/data";
import { soakTally } from "../live/soak-tally";
import { sharedStyles } from "../styles";
import type { HomeAssistant, LiveCamera } from "../types";
import "./live-soak";
import "./live-tile";
import type { LiveCountDetail } from "./live-tile";
import { navigate } from "./navigation";

/**
 * Every camera live, on its sub stream (Reolink → Live). Each tile shows the
 * camera's last picture at once and fades into video; a click opens the
 * camera's Live tab. While one tile is full screen, the others stop.
 *
 * For Phase 3's 24-hour soak, the grid counts how long it is open and
 * visible (tiles pause while the page is hidden) and what its tiles count,
 * and sends it to the server's soak run every minute (soakTally): the run
 * outlives the grid, which Home Assistant unloads when its page has been
 * hidden for 5 minutes. Its soak report reads the run.
 */
export class RvLiveGrid extends LitElement {
  static override properties = {
    hass: { attribute: false },
    _full: { state: true },
    _soak: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  /** The camera full screen, if any. */
  declare _full: string | undefined;
  /** The soak report is shown. */
  declare _soak: boolean;

  private readonly _data = new LiveData(this);

  constructor() {
    super();
    this._soak = false;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    soakTally.opened(() => this.hass, document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", this._onVisibility);
    this._flush();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener("visibilitychange", this._onVisibility);
    soakTally.closed();
    this._flush();
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
        <button
          class="text soak-button"
          title="After 24 hours with the grid open: did live view hold up?"
          @click=${() => {
            this._soak = true;
          }}
        >
          Soak report
        </button>
      </div>
      ${this._soak
        ? html`<rv-live-soak
            class="soak"
            closable
            .hass=${this.hass}
            @rv-live-soak-close=${() => {
              this._soak = false;
            }}
          ></rv-live-soak>`
        : nothing}
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
              @rv-live-full=${(e: CustomEvent<{ cameraId: string; full: boolean }>) => {
                if (e.detail.full) this._full = e.detail.cameraId;
                else if (this._full === e.detail.cameraId) this._full = undefined;
              }}
              @rv-live-count=${(e: CustomEvent<LiveCountDetail>) => {
                soakTally.count(e.detail.camera, e.detail.kind);
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
                    .warm=${isWarm(this.hass, camera)}
                    .suspended=${this._full !== undefined && this._full !== camera.id}
                    .controls=${camera.controls}
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
      .soak-button {
        margin-left: auto;
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
    return html`<rv-live-tile
        .hass=${this.hass}
        .camera=${camera}
        .connection=${liveConnection(camera)}
        .image=${data.images[camera.id]}
        .iceServers=${data.iceServers}
        .warm=${isWarm(this.hass, camera)}
        .controls=${camera.controls}
      ></rv-live-tile>
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

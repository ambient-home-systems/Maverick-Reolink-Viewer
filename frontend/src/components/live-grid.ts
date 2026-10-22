import { LitElement, css, html, nothing, type TemplateResult } from "lit";

import { fetchLiveSoak, toError } from "../api";
import { copyText } from "../clipboard";
import { LIVE_CHECK_VERSION } from "../live/check";
import { LiveData, cameraFor, isWarm, liveConnection } from "../live/data";
import { soakReport } from "../live/soak";
import { sharedStyles } from "../styles";
import type { HomeAssistant, LiveCamera } from "../types";
import "./live-tile";
import { navigate } from "./navigation";

/**
 * Every camera live, on its sub stream (Reolink → Live). Each tile shows the
 * camera's last picture at once and fades into video; a click opens the
 * camera's Live tab. While one tile is full screen, the others stop.
 *
 * Its soak report (Phase 3's 24-hour soak) reads the server's samples since
 * the grid opened (live/soak) and what each tile counted, and says whether
 * each exit criterion held. The grid counts how long the page was visible
 * (tiles pause while it is hidden).
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
  /** The soak report shown: its text, why it failed, or still loading. */
  declare _soak: { text: string; copied?: boolean } | { error: string } | "loading" | undefined;

  private readonly _data = new LiveData(this);
  private _openedAt = Date.now();
  private _visibleMs = 0;
  /** Since when the page has been visible (undefined while hidden). */
  private _visibleSince: number | undefined;

  override connectedCallback(): void {
    super.connectedCallback();
    this._openedAt = Date.now();
    this._visibleMs = 0;
    this._visibleSince = document.visibilityState === "hidden" ? undefined : this._openedAt;
    document.addEventListener("visibilitychange", this._onVisibility);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener("visibilitychange", this._onVisibility);
  }

  private readonly _onVisibility = (): void => {
    const now = Date.now();
    if (this._visibleSince !== undefined) this._visibleMs += now - this._visibleSince;
    this._visibleSince = document.visibilityState === "hidden" ? undefined : now;
  };

  private async _openSoak(): Promise<void> {
    const hass = this.hass;
    if (!hass) return;
    this._soak = "loading";
    try {
      const soak = await fetchLiveSoak(hass, this._openedAt);
      const now = Date.now();
      const tiles = [...(this.shadowRoot?.querySelectorAll("rv-live-tile") ?? [])].map((tile) => tile.soakCounts());
      const text = soakReport({
        version: LIVE_CHECK_VERSION,
        openedAt: this._openedAt,
        now,
        visibleMs: this._visibleMs + (this._visibleSince !== undefined ? now - this._visibleSince : 0),
        sampleS: soak.sample_s,
        samples: [...soak.samples, soak.now],
        tiles,
      });
      this._soak = { text };
    } catch (err) {
      this._soak = { error: toError(err).message };
    }
  }

  private _renderSoak(): TemplateResult | typeof nothing {
    const soak = this._soak;
    if (!soak) return nothing;
    const close = html`<button
      @click=${() => {
        this._soak = undefined;
      }}
    >
      Close
    </button>`;
    if (soak === "loading") return html`<div class="card soak"><p class="muted">Reading the samples…</p></div>`;
    if ("error" in soak) {
      return html`<div class="banner error soak" role="alert">
        Could not make the soak report: ${soak.error} ${close}
      </div>`;
    }
    return html`<div class="card soak" role="region" aria-label="Soak report">
      <pre>${soak.text}</pre>
      <div class="actions">
        <button
          @click=${() => {
            void copyText(soak.text).then((ok) => {
              this._soak = { ...soak, copied: ok };
            });
          }}
        >
          ${soak.copied === undefined ? "Copy" : soak.copied ? "Copied" : "Could not copy"}
        </button>
        <button
          @click=${() => {
            void this._openSoak();
          }}
        >
          Refresh
        </button>
        ${close}
      </div>
    </div>`;
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
            void this._openSoak();
          }}
        >
          Soak report
        </button>
      </div>
      ${this._renderSoak()}
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
      .soak pre {
        margin: 0 0 8px;
        font-size: 12px;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
      .soak .actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
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

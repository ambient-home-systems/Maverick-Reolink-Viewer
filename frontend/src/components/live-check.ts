import { LitElement, css, html, nothing, type TemplateResult } from "lit";

import { fetchLiveCameras, fetchLiveStatus, toError } from "../api";
import { LIVE_REPORT_PREFIX, LIVE_SETUPS, LiveCheck, type LiveCheckOptions } from "../live/check";
import { fetchCheckReports, type SavedReport } from "../playback/check";
import { sharedStyles } from "../styles";
import { LIVE_STREAMS, type HomeAssistant, type LiveCamera, type LiveStatus, type LiveStreamKind } from "../types";

/** The capacity test downloads a recording at full speed: on by default only at home. */
export function capacityByDefault(setup: string): boolean {
  return !/Tailscale|Nabu Casa/.test(setup);
}

/**
 * The live check page (Reolink → Live check): measures live view on this
 * device for every camera, with the options of the Phase 3 step 1 gate.
 */
export class RvLiveCheck extends LitElement {
  static override properties = {
    hass: { attribute: false },
    _status: { state: true },
    _cameras: { state: true },
    _setup: { state: true },
    _streams: { state: true },
    _warm: { state: true },
    _stock: { state: true },
    _capacity: { state: true },
    _camera: { state: true },
    _check: { state: true },
    _checkText: { state: true },
    _checkStatus: { state: true },
    _reports: { state: true },
    _error: { state: true },
    _copied: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  declare _status: LiveStatus | undefined;
  declare _cameras: LiveCamera[] | undefined;
  declare _setup: string;
  declare _streams: LiveStreamKind[];
  declare _warm: boolean;
  declare _stock: boolean;
  declare _capacity: boolean;
  declare _camera: string;
  declare _check: LiveCheck | undefined;
  declare _checkText: string;
  declare _checkStatus: string;
  declare _reports: SavedReport[] | undefined;
  declare _error: string | undefined;
  declare _copied: string | undefined;

  private _loaded = false;

  constructor() {
    super();
    this._setup = LIVE_SETUPS[0];
    this._streams = [...LIVE_STREAMS];
    this._warm = true;
    this._stock = true;
    this._capacity = true;
    this._camera = "";
    this._checkText = "";
    this._checkStatus = "";
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._check?.stop();
  }

  protected override updated(): void {
    if (this.hass && !this._loaded) {
      this._loaded = true;
      void this._load();
    }
  }

  private async _load(): Promise<void> {
    const hass = this.hass;
    if (!hass) return;
    try {
      const [status, cameras] = await Promise.all([fetchLiveStatus(hass), fetchLiveCameras(hass)]);
      this._status = status;
      this._cameras = cameras.cameras;
    } catch (err) {
      this._error = toError(err).message;
    }
    void this._loadReports();
  }

  private async _loadReports(): Promise<void> {
    if (!this.hass) return;
    try {
      const { reports } = await fetchCheckReports(this.hass);
      this._reports = reports.filter((r) => r.setup.startsWith(LIVE_REPORT_PREFIX));
    } catch {
      this._reports = [];
    }
  }

  private get _admin(): boolean {
    return this.hass?.user?.is_admin === true;
  }

  /** Run the check (the panel's button, or scripts/desktop-check); resolves with the report. */
  async runCheck(options: Partial<LiveCheckOptions> & { setup: string }): Promise<string> {
    const hass = this.hass;
    const stage = this.renderRoot.querySelector<HTMLElement>(".stage");
    if (!hass || !stage) throw new Error("the page is not ready");
    if (this._check?.running) throw new Error("a check is running");
    const check = new LiveCheck(
      hass,
      {
        setup: options.setup,
        streams: options.streams ?? this._streams,
        warm: options.warm ?? this._warm,
        stock: options.stock ?? this._stock,
        capacity: options.capacity ?? (this._capacity && capacityByDefault(options.setup)),
        cameraIds: options.cameraIds ?? (this._camera ? [this._camera] : []),
      },
      stage,
      () => {
        this._checkText = check.text;
        this._checkStatus = check.status;
      },
    );
    this._check = check;
    this._copied = undefined;
    try {
      return await check.run();
    } finally {
      this._checkStatus = "";
      void this._loadReports();
      void this._refreshStatus();
    }
  }

  private async _refreshStatus(): Promise<void> {
    if (!this.hass) return;
    this._status = await fetchLiveStatus(this.hass).catch(() => this._status);
  }

  private async _copy(text: string, which: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this._copied = which;
    } catch {
      this._copied = undefined;
    }
  }

  protected override render(): TemplateResult {
    const running = this._check?.running === true;
    return html`<section class="card">
      <h2>Live check</h2>
      <p class="muted">
        Measures live view on this device, for every camera: the time to the first image and to the
        first live frame, over WebRTC and MSE, cold and kept warm, and the same in Home Assistant's own
        camera view. Run it on each setup (desktop on the LAN, the iPhone app on Wi-Fi, through
        Tailscale and through Nabu Casa) and send the reports. It only watches: it changes no camera
        setting. It takes several minutes; keep this page in front.
      </p>
      ${this._renderStatus()}
      <div class="options">
        <label
          >Setup
          <select
            .value=${this._setup}
            ?disabled=${running}
            @change=${(e: Event) => {
              this._setup = (e.target as HTMLSelectElement).value;
            }}
          >
            ${LIVE_SETUPS.map((s) => html`<option value=${s} ?selected=${s === this._setup}>${s}</option>`)}
          </select>
        </label>
        <label
          >Cameras
          <select
            ?disabled=${running}
            @change=${(e: Event) => {
              this._camera = (e.target as HTMLSelectElement).value;
            }}
          >
            <option value="">All cameras</option>
            ${(this._cameras ?? []).map(
              (c) => html`<option value=${c.id} ?selected=${c.id === this._camera}>${c.name}</option>`,
            )}
          </select>
        </label>
        <span class="streams"
          >Streams
          ${LIVE_STREAMS.map(
            (stream) => html`<label class="inline"
              ><input
                type="checkbox"
                .checked=${this._streams.includes(stream)}
                ?disabled=${running}
                @change=${(e: Event) => {
                  const on = (e.target as HTMLInputElement).checked;
                  this._streams = LIVE_STREAMS.filter((s) => (s === stream ? on : this._streams.includes(s)));
                }}
              />${stream}</label
            >`,
          )}
        </span>
        <label class="inline"
          ><input
            type="checkbox"
            .checked=${this._stock}
            ?disabled=${running}
            @change=${(e: Event) => {
              this._stock = (e.target as HTMLInputElement).checked;
            }}
          />Compare with Home Assistant's camera view</label
        >
        ${this._admin
          ? html`<label class="inline"
                ><input
                  type="checkbox"
                  .checked=${this._warm}
                  ?disabled=${running}
                  @change=${(e: Event) => {
                    this._warm = (e.target as HTMLInputElement).checked;
                  }}
                />Kept warm too (keeps each stream's camera connection open while it measures)</label
              >
              <label class="inline"
                ><input
                  type="checkbox"
                  .checked=${this._capacity}
                  ?disabled=${running}
                  @change=${(e: Event) => {
                    this._capacity = (e.target as HTMLInputElement).checked;
                  }}
                />NVR capacity test (on the LAN setups: all sub streams, a main, a recording download)</label
              >`
          : nothing}
      </div>
      <div class="actions">
        ${running
          ? html`<button @click=${() => this._check?.stop()}>Stop</button>`
          : html`<button
              class="primary"
              ?disabled=${!this._streams.length || !this._cameras}
              @click=${() => {
                this.runCheck({ setup: this._setup }).catch((err: unknown) => {
                  this._error = toError(err).message;
                });
              }}
            >
              Run live check
            </button>`}
        ${this._checkText
          ? html`<button @click=${() => void this._copy(this._checkText, "current")}>
              ${this._copied === "current" ? "Copied" : "Copy report"}
            </button>`
          : nothing}
      </div>
      ${this._checkStatus ? html`<p class="muted" aria-live="polite">${this._checkStatus}…</p>` : nothing}
      ${this._error ? html`<div class="banner error" role="alert">${this._error}</div>` : nothing}
      <div class="stage" ?hidden=${!running} aria-label="Live video being measured"></div>
      ${this._checkText ? html`<pre class="report">${this._checkText}</pre>` : nothing}
      ${this._renderReports()}
    </section>`;
  }

  private _renderStatus(): TemplateResult | typeof nothing {
    const status = this._status;
    if (!status) return nothing;
    const g = status.go2rtc;
    return html`<p class="muted small">
        go2rtc: ${g.state}${g.version ? ` ${g.version}` : ""}${g.error ? html` · <span class="error">${g.error}</span>` : nothing}
        ${g.state === "stopped" ? " (it starts with the first live stream)" : nothing}
      </p>
      ${g.log?.length
        ? html`<details>
            <summary>go2rtc log</summary>
            <pre>${g.log.join("\n")}</pre>
          </details>`
        : nothing}`;
  }

  private _renderReports(): TemplateResult | typeof nothing {
    const reports = this._reports;
    if (!reports?.length) return nothing;
    return html`<details>
      <summary>Saved reports (${reports.length})</summary>
      <ul class="reports">
        ${reports.map(
          (r) => html`<li>
            <span>${r.setup.slice(LIVE_REPORT_PREFIX.length)} · ${new Date(r.updated).toLocaleString()}${r.done ? "" : " (not finished)"}</span>
            <button class="text" @click=${() => void this._copy(r.text, r.id)}>
              ${this._copied === r.id ? "Copied" : "Copy"}
            </button>
          </li>`,
        )}
      </ul>
    </details>`;
  }

  static override styles = [
    sharedStyles,
    css`
      :host {
        display: block;
      }
      .options {
        margin-top: 12px;
        display: flex;
        flex-wrap: wrap;
        gap: 8px 16px;
        align-items: center;
      }
      label.inline {
        display: inline-flex;
        gap: 4px;
        align-items: center;
      }
      .streams {
        display: inline-flex;
        gap: 8px;
        align-items: center;
      }
      .actions {
        display: flex;
        gap: 8px;
        margin: 12px 0;
      }
      .stage[hidden] {
        display: none;
      }
      .stage {
        margin-bottom: 12px;
        width: 100%;
        max-width: 480px;
        aspect-ratio: 16 / 9;
        background: #000;
        border-radius: 8px;
        overflow: hidden;
      }
      .stage video {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
      pre {
        max-height: 480px;
        overflow: auto;
        font-size: 12px;
        white-space: pre-wrap;
        background: var(--secondary-background-color, #f5f5f5);
        padding: 8px;
      }
      .reports {
        padding-inline-start: 16px;
      }
      .reports li {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .error {
        color: var(--error-color, #db4437);
      }
    `,
  ];
}

if (!customElements.get("rv-live-check")) {
  customElements.define("rv-live-check", RvLiveCheck);
}

declare global {
  interface HTMLElementTagNameMap {
    "rv-live-check": RvLiveCheck;
  }
}

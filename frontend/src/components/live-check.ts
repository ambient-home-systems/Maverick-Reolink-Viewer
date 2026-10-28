import { LitElement, css, html, nothing, type TemplateResult } from "lit";

import { fetchLiveCameras, fetchLiveStatus, toError } from "../api";
import { copyText } from "../clipboard";
import { LIVE_REPORT_PREFIX, LIVE_SETUPS, LiveCheck, type LiveCheckOptions } from "../live/check";
import { reportSource } from "../live/check-util";
import { fetchCheckReports, type SavedReport } from "../playback/check";
import { deviceSetup, setupMismatch } from "../playback/check-util";
import { formatStamp } from "../playback/time";
import { icon } from "../icons";
import { parseInShort } from "../plain";
import { sharedStyles } from "../styles";
import { LIVE_STREAMS, type HomeAssistant, type LiveCamera, type LiveStatus, type LiveStreamKind } from "../types";
import "./findings";
import { toast } from "./navigation";

const SETUP_KEY = "reolink-viewer-live-check-setup";

/** The streams, as the live board and full screen use them. */
const STREAM_WORDS: Record<LiveStreamKind, string> = {
  sub: "Low (the live board)",
  ext: "Medium",
  main: "High (full screen)",
};

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
    _shown: { state: true },
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
  /** A saved report whose text is on the page, because copying it was blocked. */
  declare _shown: string | undefined;

  private _loaded = false;

  constructor() {
    super();
    this._setup = rememberedSetup();
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
        this._checkStatus = check.plainStatus;
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
    if (await copyText(text)) {
      this._copied = which;
      return;
    }
    this._copied = undefined;
    this._shown = which;
    toast(this, "Copying is blocked here: select the text instead, or copy it from Saved reports on a computer", "error");
  }

  protected override render(): TemplateResult {
    const running = this._check?.running === true;
    return html`<p class="intro">
        How quickly each camera's live video starts on this device. The check plays each camera in turn
        for a few seconds, so it takes a few minutes: keep this page open and in front. It only watches;
        it changes no camera setting.
      </p>
      <p class="muted">
        Run it on each device you use, at home and away, and compare. Each run is saved, so you can read
        it later on any device.
      </p>
      ${this._renderStatus()}
      <div class="form">
        <span class="label" id="setup">This device and network</span>
        <div class="field">
          <select
            aria-labelledby="setup"
            .value=${this._setup}
            ?disabled=${running}
            @change=${(e: Event) => {
              this._setup = (e.target as HTMLSelectElement).value;
              rememberSetup(this._setup);
            }}
          >
            ${LIVE_SETUPS.map((s) => html`<option value=${s} ?selected=${s === this._setup}>${s}</option>`)}
          </select>
        </div>
        <span class="label" id="cameras">Cameras</span>
        <div class="field">
          <select
            aria-labelledby="cameras"
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
        </div>
        <span class="label">Video quality</span>
        <div class="field" role="group" aria-label="Video quality">
          ${LIVE_STREAMS.map(
            (stream) => html`<label class="option"
              ><input
                type="checkbox"
                .checked=${this._streams.includes(stream)}
                ?disabled=${running}
                @change=${(e: Event) => {
                  const on = (e.target as HTMLInputElement).checked;
                  this._streams = LIVE_STREAMS.filter((s) => (s === stream ? on : this._streams.includes(s)));
                }}
              />${STREAM_WORDS[stream]}</label
            >`,
          )}
        </div>
        <span class="label">Also</span>
        <div class="field stack">
          <label class="option"
            ><input
              type="checkbox"
              .checked=${this._stock}
              ?disabled=${running}
              @change=${(e: Event) => {
                this._stock = (e.target as HTMLInputElement).checked;
              }}
            />Compare with Home Assistant's own camera view</label
          >
          ${this._admin
            ? html`<label class="option"
                  ><input
                    type="checkbox"
                    .checked=${this._warm}
                    ?disabled=${running}
                    @change=${(e: Event) => {
                      this._warm = (e.target as HTMLInputElement).checked;
                    }}
                  />Kept warm too: how fast cameras start when their connection is kept open</label
                >
                <label class="option"
                  ><input
                    type="checkbox"
                    .checked=${this._capacity}
                    ?disabled=${running}
                    @change=${(e: Event) => {
                      this._capacity = (e.target as HTMLInputElement).checked;
                    }}
                  />NVR capacity test: how many streams each NVR serves at once (at home only)</label
                >`
            : nothing}
        </div>
      </div>
      ${setupMismatch(this._setup, navigator.userAgent)
        ? html`<div class="banner warning" role="alert">
            “${this._setup}” is for another kind of device: pick the one for this device, so the report is
            filed under it.
          </div>`
        : nothing}
      <div class="actions run">
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
              ${this._check ? "Run it again" : "Run live check"}
            </button>`}
      </div>
      ${running && this._checkStatus ? html`<p class="progress" aria-live="polite">${this._checkStatus}…</p>` : nothing}
      ${this._error ? html`<div class="banner error" role="alert">${this._error}</div>` : nothing}
      <div class="stage" ?hidden=${!running} aria-label="Live video being measured"></div>
      ${this._check ? html`<rv-findings class="result" .summary=${this._check.inShort()}></rv-findings>` : nothing}
      ${this._checkText
        ? html`<details class="support">
            <summary>Details for support${icon("chevronDown")}</summary>
            <p class="muted small">Every measurement, for a bug report or to compare devices.</p>
            <div class="actions">
              <button @click=${() => void this._copy(this._checkText, "current")}>
                ${this._copied === "current" ? "Copied" : "Copy report"}
              </button>
            </div>
            <pre class="report">${this._checkText}</pre>
          </details>`
        : nothing}
      ${this._renderReports()}`;
  }

  private _renderStatus(): TemplateResult | typeof nothing {
    const status = this._status;
    if (!status) return nothing;
    const g = status.go2rtc;
    return html`<p class="small service">
        <span class="muted">Video service (go2rtc):</span>
        ${g.state}${g.version ? `, version ${g.version}` : ""}${g.error ? html` · <span class="error">${g.error}</span>` : nothing}
        ${g.state === "stopped" ? html`<span class="muted">(it starts with the first live video)</span>` : nothing}
      </p>
      ${g.log?.length
        ? html`<details>
            <summary class="small">Its log${icon("chevronDown")}</summary>
            <pre class="report">${g.log.join("\n")}</pre>
          </details>`
        : nothing}`;
  }

  private _renderReports(): TemplateResult | typeof nothing {
    const reports = this._reports;
    if (!reports?.length) return nothing;
    return html`<details class="saved">
      <summary>Saved reports (${reports.length})${icon("chevronDown")}</summary>
      <ul class="reports">
        ${reports.map(
          (r) => html`<li>
            <div class="report-row">
              <span class="when"
                >${[formatStamp(Date.parse(r.updated), this.hass?.config?.time_zone), r.setup.slice(LIVE_REPORT_PREFIX.length), reportSource(r.text)]
                  .filter(Boolean)
                  .join(" · ")}${r.done ? "" : " (not finished)"}</span
              >
              <button class="text" @click=${() => void this._copy(r.text, r.id)}>
                ${this._copied === r.id ? "Copied" : "Copy"}
              </button>
              <button
                class="text"
                aria-expanded=${this._shown === r.id ? "true" : "false"}
                @click=${() => {
                  this._shown = this._shown === r.id ? undefined : r.id;
                }}
              >
                ${this._shown === r.id ? "Hide" : "Show"}
              </button>
            </div>
            ${this._shown === r.id ? this._renderSaved(r.text) : nothing}
          </li>`,
        )}
      </ul>
    </details>`;
  }

  /** A saved report: its plain summary, with every measurement behind it; one from before the summary, as it is. */
  private _renderSaved(text: string): TemplateResult {
    const summary = parseInShort(text);
    if (!summary) return html`<pre class="report">${text}</pre>`;
    return html`<rv-findings .summary=${summary}></rv-findings>
      <details>
        <summary class="small">Details for support${icon("chevronDown")}</summary>
        <pre class="report">${text}</pre>
      </details>`;
  }

  static override styles = [
    sharedStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      p {
        margin: 0;
      }
      .intro {
        font-size: 17px;
      }
      .service {
        display: flex;
        flex-wrap: wrap;
        gap: 0 6px;
      }
      .run {
        margin-top: 4px;
      }
      .progress {
        font-family: var(--rv-font-cond);
        font-size: 19px;
        font-weight: 600;
      }
      .stage[hidden] {
        display: none;
      }
      .stage {
        width: 100%;
        max-width: 480px;
        aspect-ratio: 16 / 9;
        background: var(--rv-board);
        overflow: hidden;
      }
      .stage video {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
      .result {
        margin-top: 6px;
      }
      details.support,
      details.saved {
        border-top: 2px solid var(--rv-rule-strong);
        padding-top: 6px;
      }
      details > p,
      details > .actions {
        margin: 6px 0 10px;
      }
      .reports {
        list-style: none;
        margin: 6px 0 0;
        padding: 0;
      }
      .reports li {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 6px 0;
        border-bottom: 1px solid var(--rv-rule);
      }
      .report-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px 12px;
      }
      .when {
        flex: 1;
        min-width: 14em;
        font-size: 15px;
      }
      .error {
        color: var(--rv-fault-ink);
        font-weight: 600;
      }
    `,
  ];
}

/** The setup chosen last on this device, else a guess from the browser. */
function rememberedSetup(): string {
  try {
    const saved = window.localStorage.getItem(SETUP_KEY);
    if (saved && (LIVE_SETUPS as readonly string[]).includes(saved)) return saved;
  } catch {
    // No storage: guess from the browser.
  }
  return deviceSetup(navigator.userAgent);
}

function rememberSetup(setup: string): void {
  try {
    window.localStorage.setItem(SETUP_KEY, setup);
  } catch {
    // Not remembered.
  }
}

if (!customElements.get("rv-live-check")) {
  customElements.define("rv-live-check", RvLiveCheck);
}

declare global {
  interface HTMLElementTagNameMap {
    "rv-live-check": RvLiveCheck;
  }
}

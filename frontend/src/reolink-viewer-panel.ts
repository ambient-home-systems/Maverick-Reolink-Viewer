import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from "lit";

import { fetchDevices, runProbe, toError, type ProbeRun } from "./api";
import { downloadJson } from "./download";
import {
  channelStatus,
  deviceTypeLabel,
  encodingLabel,
  portLabel,
  probeFilename,
} from "./format";
import type { DevicesResponse, HomeAssistant, HostInfo, ProbeReport } from "./types";

const MAX_LOG_LINES = 8;

type ProbeState =
  | { status: "idle" }
  | { status: "running"; started: number; log: string[] }
  | { status: "done"; report: ProbeReport; filename: string }
  | { status: "error"; message: string };

export class ReolinkViewerPanel extends LitElement {
  static override properties = {
    hass: { attribute: false },
    narrow: { type: Boolean },
    _devices: { state: true },
    _loadError: { state: true },
    _probe: { state: true },
    _includeBattery: { state: true },
    _concurrency: { state: true },
    _maxStreams: { state: true },
    _copied: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  declare narrow: boolean;
  declare _devices: DevicesResponse | undefined;
  declare _loadError: string | undefined;
  declare _probe: ProbeState;
  declare _includeBattery: boolean;
  declare _concurrency: boolean;
  declare _maxStreams: number;
  declare _copied: boolean;

  private _run: ProbeRun | undefined;
  private _loading = false;

  constructor() {
    super();
    this.narrow = false;
    this._probe = { status: "idle" };
    this._includeBattery = false;
    this._concurrency = false;
    this._maxStreams = 4;
    this._copied = false;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._run?.cancel();
    this._run = undefined;
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (changed.has("hass") && this.hass && !this._devices && !this._loading) {
      void this._load();
    }
  }

  async _load(): Promise<void> {
    if (!this.hass) return;
    this._loading = true;
    try {
      this._devices = await fetchDevices(this.hass);
      this._loadError = undefined;
    } catch (err) {
      this._loadError = toError(err).message;
    } finally {
      this._loading = false;
    }
  }

  private get _isAdmin(): boolean {
    return this.hass?.user?.is_admin === true;
  }

  protected override render(): TemplateResult {
    return html`
      <div class="toolbar">
        <ha-menu-button .hass=${this.hass} .narrow=${this.narrow}></ha-menu-button>
        <div class="title">Reolink</div>
        <button class="text" @click=${() => void this._load()} ?disabled=${this._loading}>
          Refresh
        </button>
      </div>
      <main>
        ${this._renderBanner()} ${this._renderDevices()}
        ${this._isAdmin ? this._renderProbe() : nothing}
      </main>
    `;
  }

  private _renderBanner(): TemplateResult | typeof nothing {
    if (this._loadError) {
      return html`<div class="banner error" role="alert">
        Could not load devices: ${this._loadError}
      </div>`;
    }
    const devices = this._devices;
    if (!devices?.degraded) return nothing;
    return html`<div class="banner warning" role="alert">
      <strong>Degraded mode.</strong> The Reolink integration's internals changed in this
      Home Assistant release, so only basic device information is shown and the probe is
      disabled.
      <ul>
        ${devices.compat.errors.map((e) => html`<li>${e}</li>`)}
      </ul>
    </div>`;
  }

  private _renderDevices(): TemplateResult {
    const devices = this._devices;
    if (!devices) {
      return html`<p class="muted">${this._loadError ? "" : "Loading devices…"}</p>`;
    }
    if (devices.degraded) {
      const list = devices.devices ?? [];
      return html`<section class="card">
        <h2>Devices</h2>
        ${list.length
          ? html`<ul class="plain">
              ${list.map(
                (d) =>
                  html`<li>
                    <strong>${d.name ?? "Unnamed"}</strong>
                    <span class="muted">${d.model ?? ""} ${d.firmware_version ?? ""}</span>
                  </li>`,
              )}
            </ul>`
          : html`<p class="muted">No Reolink devices found.</p>`}
      </section>`;
    }
    if (!devices.hosts.length) {
      return html`<section class="card">
        <h2>No Reolink devices</h2>
        <p class="muted">
          Set up your cameras, NVRs or Home Hubs in the Reolink integration first; they
          appear here once loaded.
        </p>
      </section>`;
    }
    return html`${devices.hosts.map((host) => this._renderHost(host))}`;
  }

  private _renderHost(host: HostInfo): TemplateResult {
    return html`<section class="card">
      <div class="host-header">
        <h2>${host.name}</h2>
        <span class="badge">${deviceTypeLabel(host.device_type)}</span>
      </div>
      <p class="muted">
        ${host.model} · firmware ${host.firmware_version} · hardware ${host.hardware_version}
      </p>
      <p class="ports">
        RTSP ${portLabel(host.rtsp_enabled)} · RTMP ${portLabel(host.rtmp_enabled)} · ONVIF
        ${portLabel(host.onvif_enabled)} · stream protocol ${host.protocol}
      </p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Ch</th>
              <th>Name</th>
              <th>Model</th>
              <th>Main stream</th>
              <th>Sub stream</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${host.channels.map(
              (ch) =>
                html`<tr>
                  <td>${ch.channel}</td>
                  <td>${ch.name}</td>
                  <td>${ch.model}</td>
                  <td>${encodingLabel(ch.main)}</td>
                  <td>${encodingLabel(ch.sub)}</td>
                  <td>
                    ${channelStatus(ch)}${ch.is_battery ? html` · battery` : nothing}
                  </td>
                </tr>`,
            )}
          </tbody>
        </table>
      </div>
    </section>`;
  }

  private _renderProbe(): TemplateResult {
    const probe = this._probe;
    const running = probe.status === "running";
    const disabled = running || !this._devices || this._devices.degraded;
    return html`<section class="card">
      <h2>Hardware probe</h2>
      <p class="muted">
        Measures which live and recorded-video methods work on each camera and how fast
        they start. It only reads: it never changes camera settings. The result is a JSON
        file with passwords, tokens, UIDs, serial numbers and addresses removed.
      </p>
      <label>
        <input
          type="checkbox"
          .checked=${this._includeBattery}
          ?disabled=${running}
          @change=${(e: Event) => {
            this._includeBattery = (e.target as HTMLInputElement).checked;
          }}
        />
        Include battery cameras (wakes them and uses battery)
      </label>
      <label>
        <input
          type="checkbox"
          .checked=${this._concurrency}
          ?disabled=${running}
          @change=${(e: Event) => {
            this._concurrency = (e.target as HTMLInputElement).checked;
          }}
        />
        Test concurrent streams: opens up to
        <select
          .value=${String(this._maxStreams)}
          ?disabled=${running || !this._concurrency}
          @change=${(e: Event) => {
            this._maxStreams = Number((e.target as HTMLSelectElement).value);
          }}
        >
          ${[2, 3, 4, 5, 6].map(
            (n) =>
              html`<option value=${n} ?selected=${n === this._maxStreams}>${n}</option>`,
          )}
        </select>
        sub streams at once on one camera per device, stopping at the first failure
      </label>
      <div class="actions">
        ${running
          ? html`<button @click=${() => {
              this._cancelProbe();
            }}>
              Cancel
            </button>`
          : html`<button class="primary" ?disabled=${disabled} @click=${() => {
              this._startProbe();
            }}>
              Run probe
            </button>`}
      </div>
      ${this._renderProbeState()}
    </section>`;
  }

  private _renderProbeState(): TemplateResult | typeof nothing {
    const probe = this._probe;
    switch (probe.status) {
      case "idle":
        return nothing;
      case "running":
        return html`<div class="progress" aria-live="polite">
          <p>Probing… this can take several minutes on an NVR.</p>
          <ol class="log">
            ${probe.log.map((line) => html`<li>${line}</li>`)}
          </ol>
        </div>`;
      case "error":
        return html`<div class="banner error" role="alert">Probe failed: ${probe.message}</div>`;
      case "done":
        return html`<div class="done">
          <p>
            Done. The report was saved as <code>${probe.filename}</code>. If your browser or
            the Companion app blocked the download, use Copy JSON instead.
          </p>
          <div class="actions">
            <button @click=${() => {
              downloadJson(probe.report, probe.filename);
            }}>
              Download again
            </button>
            <button @click=${() => void this._copy(probe.report)}>
              ${this._copied ? "Copied" : "Copy JSON"}
            </button>
          </div>
          <details>
            <summary>Show report</summary>
            <pre>${JSON.stringify(probe.report, null, 2)}</pre>
          </details>
        </div>`;
    }
  }

  _startProbe(): void {
    if (!this.hass) return;
    const log: string[] = [];
    this._copied = false;
    this._probe = { status: "running", started: Date.now(), log };
    const run = runProbe(
      this.hass,
      {
        include_battery: this._includeBattery,
        concurrency_test: this._concurrency,
        max_streams: this._maxStreams,
      },
      (message) => {
        if (this._probe.status !== "running") return;
        this._probe = {
          ...this._probe,
          log: [...this._probe.log, message].slice(-MAX_LOG_LINES),
        };
      },
    );
    this._run = run;
    run.result.then(
      (report) => {
        if (this._run !== run) return;
        this._run = undefined;
        const filename = probeFilename(new Date());
        this._probe = { status: "done", report, filename };
        downloadJson(report, filename);
      },
      (err: unknown) => {
        if (this._run !== run) return;
        this._run = undefined;
        this._probe = { status: "error", message: toError(err).message };
      },
    );
  }

  _cancelProbe(): void {
    const run = this._run;
    this._run = undefined;
    run?.cancel();
    this._probe = { status: "idle" };
  }

  private async _copy(report: ProbeReport): Promise<void> {
    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      this._copied = true;
    } catch {
      this._copied = false;
    }
  }

  static override styles = css`
    :host {
      display: block;
      min-height: 100%;
      background: var(--primary-background-color);
      color: var(--primary-text-color);
      font-family: var(--paper-font-body1_-_font-family, Roboto, sans-serif);
    }
    .toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      height: var(--header-height, 56px);
      padding: 0 12px;
      background: var(--app-header-background-color, var(--primary-color));
      color: var(--app-header-text-color, white);
      box-sizing: border-box;
    }
    .title {
      flex: 1;
      min-width: 0;
      font-size: 20px;
    }
    main {
      max-width: 1100px;
      margin: 0 auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    main > * {
      /* Let wide tables scroll inside their card instead of widening the page. */
      min-width: 0;
    }
    .card {
      overflow-wrap: anywhere;
      background: var(--card-background-color, white);
      border-radius: var(--ha-card-border-radius, 12px);
      box-shadow: var(--ha-card-box-shadow, none);
      border: 1px solid var(--divider-color, #e0e0e0);
      padding: 16px;
    }
    h2 {
      margin: 0 0 4px;
      font-size: 18px;
      font-weight: 500;
    }
    .host-header {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .badge {
      font-size: 12px;
      padding: 2px 8px;
      border-radius: 10px;
      background: var(--secondary-background-color, #eee);
    }
    .muted {
      color: var(--secondary-text-color);
    }
    .ports {
      font-size: 14px;
    }
    .table-wrap {
      overflow-x: auto;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      font-size: 14px;
    }
    th,
    td {
      text-align: left;
      padding: 6px 8px;
      border-bottom: 1px solid var(--divider-color, #e0e0e0);
      white-space: nowrap;
    }
    label {
      display: block;
      margin: 8px 0;
    }
    .actions {
      display: flex;
      gap: 8px;
      margin-top: 12px;
    }
    button {
      font: inherit;
      padding: 8px 16px;
      border-radius: 4px;
      border: 1px solid var(--divider-color, #ccc);
      background: var(--card-background-color, white);
      color: var(--primary-text-color);
      cursor: pointer;
    }
    button.primary {
      background: var(--primary-color);
      color: var(--text-primary-color, white);
      border-color: var(--primary-color);
    }
    button.text {
      background: transparent;
      color: inherit;
      border: none;
    }
    button:disabled {
      opacity: 0.5;
      cursor: default;
    }
    .banner {
      padding: 12px 16px;
      border-radius: 8px;
    }
    .banner.warning {
      background: var(--warning-color, #ffa600);
      color: var(--text-primary-color, black);
    }
    .banner.error {
      background: var(--error-color, #db4437);
      color: var(--text-primary-color, white);
    }
    .log {
      font-family: var(--code-font-family, monospace);
      font-size: 13px;
      color: var(--secondary-text-color);
    }
    pre {
      max-height: 400px;
      overflow: auto;
      font-size: 12px;
      background: var(--secondary-background-color, #f5f5f5);
      padding: 8px;
    }
    ul.plain {
      list-style: none;
      padding: 0;
    }
  `;
}

if (!customElements.get("reolink-viewer-panel")) {
  customElements.define("reolink-viewer-panel", ReolinkViewerPanel);
}

declare global {
  interface HTMLElementTagNameMap {
    "reolink-viewer-panel": ReolinkViewerPanel;
  }
}

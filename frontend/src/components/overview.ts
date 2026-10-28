import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from "lit";

import { deviceTypeLabel, encodingLabel, portLabel } from "../format";
import { icon } from "../icons";
import { sharedStyles } from "../styles";
import type {
  CameraNode,
  ChannelDetails,
  DeviceConnection,
  DeviceResponse,
  DevicesResponse,
  HomeAssistant,
  HostDetails,
} from "../types";
import "./device-list";
import type { BoardCamera } from "./live-grid";
import { connectionLabel } from "./settings";

/** Snapshot-only cameras refresh their picture this often while shown. */
export const SNAPSHOT_REFRESH_MS = 30_000;

const AI_LABELS: Record<string, string> = {
  people: "person",
  dog_cat: "animal",
  "non-motor_vehicle": "bicycle",
};

/** Overview tab: latest snapshot, connections and device details. */
export class RvOverview extends LitElement {
  static override properties = {
    hass: { attribute: false },
    device: { attribute: false },
    devices: { attribute: false },
    cameras: { attribute: false },
    _stamp: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  declare device: DeviceResponse | undefined;
  /** Every device, for an NVR's or Home Hub's cameras. */
  declare devices: DevicesResponse | undefined;
  /** The board's cameras, numbered. */
  declare cameras: BoardCamera[];
  declare _stamp: number;

  private _timer: ReturnType<typeof setInterval> | undefined;

  constructor() {
    super();
    this.cameras = [];
    this._stamp = 0;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this._startTimer();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    clearInterval(this._timer);
    this._timer = undefined;
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (changed.has("device")) this._startTimer();
  }

  private _startTimer(): void {
    clearInterval(this._timer);
    this._timer = undefined;
    const node = this.device?.node;
    if (node?.kind === "camera" && node.primary_view === "snapshot" && this.isConnected) {
      this._timer = setInterval(() => {
        if (document.visibilityState === "visible") this._stamp = Date.now();
      }, SNAPSHOT_REFRESH_MS);
    }
  }

  /** The camera entity's entity_picture: an HA-signed proxy URL, no camera address. */
  snapshotUrl(): string | null {
    const node = this.device?.node;
    if (node?.kind !== "camera" || !node.snapshot_entity_id) return null;
    const picture = this.hass?.states[node.snapshot_entity_id]?.attributes.entity_picture;
    if (typeof picture !== "string" || !picture) return null;
    if (!this._stamp) return picture;
    return `${picture}${picture.includes("?") ? "&" : "?"}_=${this._stamp}`;
  }

  protected override render(): TemplateResult {
    const device = this.device;
    if (!device) return html``;
    const node = device.node;
    return html`
      ${node.kind === "camera" ? this._renderSnapshot(node) : this._renderCameras()}
      <div class="connections">${device.connections.map((conn) => this._renderConnection(conn, device))}</div>
    `;
  }

  private _renderSnapshot(node: CameraNode): TemplateResult {
    const url = this.snapshotUrl();
    const primary = node.primary_view === "snapshot";
    return html`<figure class="snapshot ${primary ? "primary" : ""}">
      <div class="frame">
        ${url
          ? html`<img src=${url} alt="Latest snapshot of ${node.name ?? "the camera"}" />`
          : html`<p class="none">
              No snapshot: enable one of this camera's stream entities (for example
              <em>Fluent</em>) in the Settings tab.
            </p>`}
      </div>
      <figcaption>
        <span>Latest snapshot</span>
        <button
          class="text with-icon"
          ?disabled=${!url}
          @click=${() => {
            this._stamp = Date.now();
          }}
        >
          ${icon("refresh")}Refresh
        </button>
      </figcaption>
      ${primary
        ? html`<p class="muted small">
            This camera does not record, so snapshots are its main view. The picture refreshes
            every ${SNAPSHOT_REFRESH_MS / 1000} seconds while this page is open.
          </p>`
        : nothing}
    </figure>`;
  }

  private _renderCameras(): TemplateResult | typeof nothing {
    const node = this.device?.node;
    if (node?.kind === "camera") return nothing;
    const count = node?.camera_ids.length ?? 0;
    return html`<section class="card">
      <h2>Cameras</h2>
      ${this.devices && node
        ? html`<rv-device-list .devices=${this.devices} .cameras=${this.cameras} .hostId=${node.id}></rv-device-list>`
        : html`<p class="muted">
            ${count} ${count === 1 ? "camera" : "cameras"} on this ${deviceTypeLabel(node?.kind ?? "nvr")}.
          </p>`}
    </section>`;
  }

  private _renderConnection(conn: DeviceConnection, device: DeviceResponse): TemplateResult {
    const details = conn.details;
    const isCamera = device.node.kind === "camera";
    const notes = [
      conn.channel !== undefined && conn.channel !== null && conn.via === "nvr"
        ? `channel ${String(conn.channel + 1)}`
        : undefined,
      conn.playback_source ? "playback source" : undefined,
    ].filter((n): n is string => n !== undefined);
    return html`<section class="card">
      <div class="header">
        <h2>${isCamera ? connectionLabel(conn) : "Device"}</h2>
        ${notes.length ? html`<span class="muted">${notes.join(" · ")}</span>` : nothing}
      </div>
      ${details === null
        ? html`<p class="muted">
            Details are unavailable${device.degraded ? " in degraded mode" : ""}.
          </p>`
        : html`
            ${details.channel ? renderChannel(details.channel) : nothing}
            ${conn.via === "direct" || !isCamera ? renderHost(details.host) : nothing}
          `}
      <p class="muted small">
        ${conn.entities.length} entities
        (${conn.entities.filter((e) => e.disabled_by !== null).length} disabled)
      </p>
    </section>`;
  }

  static override styles = [
    sharedStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        gap: 28px;
      }
      .header {
        display: flex;
        align-items: baseline;
        gap: 4px 14px;
        flex-wrap: wrap;
      }
      .header h2 {
        margin: 0;
      }
      .snapshot {
        margin: 0;
        max-width: 760px;
      }
      .snapshot.primary {
        max-width: none;
      }
      /* The picture sits on the board's ink, with a margin of it. */
      .frame {
        aspect-ratio: 16 / 9;
        display: grid;
        place-items: center;
        padding: 10px;
        box-sizing: border-box;
        background: var(--rv-board);
        color: var(--rv-on-board-muted);
      }
      .frame img {
        display: block;
        width: 100%;
        height: 100%;
        min-height: 0;
        object-fit: contain;
      }
      .none {
        max-width: 40ch;
        padding: 16px;
        text-align: center;
      }
      figcaption {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 0;
        border-bottom: 1px solid var(--rv-rule);
        color: var(--rv-muted);
        font-size: 14px;
      }
      .connections {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr));
        gap: 28px;
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }
    `,
  ];
}

function renderChannel(ch: ChannelDetails): TemplateResult {
  const status = !ch.online ? "Offline" : ch.sleeping ? "Asleep" : "Online";
  return html`<dl class="facts">
    <dt>Model</dt>
    <dd>${ch.model}${ch.model_id ? html` <span class="muted">(${ch.model_id})</span>` : nothing}</dd>
    <dt>Hardware</dt>
    <dd>${ch.hardware_version}</dd>
    <dt>Firmware</dt>
    <dd>${ch.firmware_version}</dd>
    <dt>Status</dt>
    <dd>${status}</dd>
    <dt>Clear stream</dt>
    <dd>${encodingLabel(ch.encodings.main)}</dd>
    <dt>Fluent stream</dt>
    <dd>${encodingLabel(ch.encodings.sub)}</dd>
    <dt>Network</dt>
    <dd>${networkLabel(ch.network)}</dd>
    ${ch.battery
      ? html`<dt>Battery</dt>
          <dd>
            ${ch.battery.percent ?? "?"}%${ch.battery.status ? ` · ${ch.battery.status}` : ""}${ch
              .battery.temperature_c !== null
              ? ` · ${ch.battery.temperature_c} °C`
              : ""}${ch.wired_power ? " · on wired power" : ""}
          </dd>`
      : nothing}
    <dt>Recordings</dt>
    <dd>${ch.supports_replay ? "Playback supported" : "No playback"}</dd>
    ${ch.ai_types.length
      ? html`<dt>AI detection</dt>
          <dd>${ch.ai_types.map((t) => AI_LABELS[t] ?? t).join(", ")}</dd>`
      : nothing}
    ${ch.capabilities.length
      ? html`<dt>Features</dt>
          <dd class="chips">${ch.capabilities.map((c) => html`<span class="badge">${c}</span>`)}</dd>`
      : nothing}
  </dl>`;
}

function renderHost(host: HostDetails): TemplateResult {
  const p = host.ports;
  return html`<dl class="facts">
    ${host.device_type !== "camera"
      ? html`<dt>Model</dt>
          <dd>${host.model ?? "?"}${host.model_id ? html` <span class="muted">(${host.model_id})</span>` : nothing}</dd>
          <dt>Hardware</dt>
          <dd>${host.hardware_version ?? "?"}</dd>
          <dt>Firmware</dt>
          <dd>${host.firmware_version ?? "?"}</dd>
          <dt>Channels</dt>
          <dd>${host.channels}</dd>`
      : nothing}
    <dt>Connection</dt>
    <dd>
      ${networkLabel(host.network)} · ${p.http.https ? "HTTPS" : "HTTP"}${p.http.port
        ? ` port ${p.http.port}`
        : ""}${host.baichuan_only ? " · Baichuan only" : ""}
    </dd>
    <dt>Protocols</dt>
    <dd>
      RTSP ${portLabel(p.rtsp.enabled)}${p.rtsp.port ? ` (${p.rtsp.port})` : ""} · RTMP
      ${portLabel(p.rtmp.enabled)}${p.rtmp.port ? ` (${p.rtmp.port})` : ""} · ONVIF
      ${portLabel(p.onvif.enabled)}${p.onvif.port ? ` (${p.onvif.port})` : ""}
    </dd>
    <dt>HA stream protocol</dt>
    <dd>${host.stream_protocol ?? "?"}</dd>
    <dt>Storage</dt>
    <dd>
      ${host.storage.length
        ? host.storage.map(
            (s, i) =>
              html`${i ? html`<br />` : nothing}${s.type ?? "disk"} ${s.index + 1}:
              ${s.used_percent !== null ? `${s.used_percent}% used` : "?"}${s.available === false
                ? " (not available)"
                : ""}`,
          )
        : "none"}
    </dd>
    ${host.cpu_usage !== null
      ? html`<dt>CPU</dt>
          <dd>${host.cpu_usage}%</dd>`
      : nothing}
    ${host.capabilities.length
      ? html`<dt>Host features</dt>
          <dd class="chips">${host.capabilities.map((c) => html`<span class="badge">${c}</span>`)}</dd>`
      : nothing}
  </dl>`;
}

function networkLabel(network: { connection: string; wifi_signal_dbm: number | null }): string {
  if (network.connection !== "wifi") return "Ethernet";
  return network.wifi_signal_dbm !== null ? `Wi-Fi, ${network.wifi_signal_dbm} dBm` : "Wi-Fi";
}

if (!customElements.get("rv-overview")) {
  customElements.define("rv-overview", RvOverview);
}

declare global {
  interface HTMLElementTagNameMap {
    "rv-overview": RvOverview;
  }
}

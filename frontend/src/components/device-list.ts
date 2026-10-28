import { LitElement, css, html, nothing, type TemplateResult } from "lit";

import { deviceTypeLabel } from "../format";
import { icon } from "../icons";
import { sharedStyles } from "../styles";
import type { CameraNode, DevicesResponse, HostNode } from "../types";
import type { BoardCamera } from "./live-grid";
import { navigate } from "./navigation";

/**
 * The devices, as ruled tables: each NVR or Home Hub with its cameras (by
 * channel), then the cameras added directly. A camera carries its number on
 * the live board; a row opens the camera.
 */
export class RvDeviceList extends LitElement {
  static override properties = {
    devices: { attribute: false },
    cameras: { attribute: false },
    hostId: { attribute: false },
  };

  declare devices: DevicesResponse | undefined;
  /** The board's cameras, numbered. */
  declare cameras: BoardCamera[];
  /** Only this NVR's or Home Hub's cameras, without its heading (its own page). */
  declare hostId: string | undefined;

  constructor() {
    super();
    this.cameras = [];
  }

  protected override render(): TemplateResult {
    const devices = this.devices;
    if (!devices) return html`<p class="muted">Loading devices…</p>`;
    if (!devices.hosts.length && !devices.cameras.length) {
      return html`<section class="card">
        <h2>No Reolink devices</h2>
        <p class="muted">
          Set up your cameras, NVRs or Home Hubs in the Reolink integration first; they appear
          here once loaded.
        </p>
      </section>`;
    }
    const byId = new Map(devices.cameras.map((c) => [c.id, c]));
    if (this.hostId !== undefined) {
      const host = devices.hosts.find((h) => h.id === this.hostId);
      return host ? this._renderCameras(host, byId) : html``;
    }
    const direct = devices.cameras.filter((c) => c.host_id === null);
    return html`
      ${devices.hosts.map((host) => this._renderHost(host, byId))}
      ${direct.length
        ? html`<section class="card">
            <div class="head"><h2>Cameras added directly</h2></div>
            ${this._renderTable(direct.map((camera) => this._renderCamera(camera)))}
          </section>`
        : nothing}
    `;
  }

  private _renderHost(host: HostNode, byId: Map<string, CameraNode>): TemplateResult {
    const kind = deviceTypeLabel(host.kind);
    return html`<section class="card">
      <div class="head">
        <h2>
          <button class="link host" @click=${() => {
            navigate(this, { view: "device", id: host.id, tab: "overview" });
          }}>${host.name ?? host.entry_title}</button>
        </h2>
        <p class="muted">
          ${[kind, host.model, host.sw_version && `firmware ${host.sw_version}`].filter(Boolean).join(" · ")}
        </p>
      </div>
      ${this._renderCameras(host, byId)}
    </section>`;
  }

  private _renderCameras(host: HostNode, byId: Map<string, CameraNode>): TemplateResult {
    const cameras = host.camera_ids
      .map((id) => byId.get(id))
      .filter((c): c is CameraNode => c !== undefined);
    return cameras.length
      ? this._renderTable(cameras.map((camera) => this._renderCamera(camera, host)))
      : html`<p class="muted">No cameras on this ${deviceTypeLabel(host.kind)}.</p>`;
  }

  private _renderTable(rows: TemplateResult[]): TemplateResult {
    return html`<div class="cols" aria-hidden="true">
        <span></span><span>Camera</span><span>Channel</span><span class="model">Model</span><span>State</span><span></span>
      </div>
      <ul class="devices">
        ${rows}
      </ul>`;
  }

  private _renderCamera(camera: CameraNode, host?: HostNode): TemplateResult {
    const channel = host ? camera.connections.find((c) => c.host_id === host.id)?.channel : undefined;
    const alsoDirect = host !== undefined && camera.connections.some((c) => c.via === "direct");
    const number = this.cameras.find((c) => c.id === camera.id)?.number;
    const flags = [
      alsoDirect ? "Also added directly" : undefined,
      camera.primary_view === "snapshot" ? "Snapshots only" : undefined,
    ].filter((f): f is string => f !== undefined);
    return html`<li>
      <button
        class="row"
        @click=${() => {
          navigate(this, { view: "device", id: camera.id, tab: "overview" });
        }}
      >
        <span class="plat-cell">${number !== undefined ? html`<span class="plat" aria-hidden="true">${number}</span>` : nothing}</span>
        <span class="name">${camera.name ?? "Camera"}</span>
        <span class="ch muted">${channel !== undefined && channel !== null ? `Ch ${String(channel + 1)}` : "Direct"}</span>
        <span class="model muted">${camera.model ?? ""}</span>
        <span class="state">${stateWord(camera)}${flags.length
          ? html`<span class="flags muted">${flags.join(" · ")}</span>`
          : nothing}</span>
        ${icon("chevron")}
      </button>
    </li>`;
  }

  static override styles = [
    sharedStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        gap: 28px;
        container-type: inline-size;
      }
      .head {
        display: flex;
        align-items: baseline;
        flex-wrap: wrap;
        gap: 4px 14px;
        margin-bottom: 10px;
      }
      .head h2 {
        margin: 0;
      }
      .head p {
        margin: 0;
        font-size: 15px;
      }
      .host {
        font: inherit;
      }
      .cols,
      .row {
        display: grid;
        grid-template-columns: 34px minmax(0, 2fr) 72px minmax(0, 1.2fr) minmax(0, 1.6fr) 20px;
        column-gap: 14px;
        align-items: center;
      }
      .cols {
        padding: 0 4px 6px;
        border-bottom: 1px solid var(--rv-rule-strong);
        color: var(--rv-muted);
        font-size: 13px;
        font-weight: 500;
      }
      ul.devices {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      li {
        border-bottom: 1px solid var(--rv-rule);
      }
      .row {
        width: 100%;
        min-height: 52px;
        padding: 6px 4px;
        border: none;
        border-radius: 0;
        background: transparent;
        color: inherit;
        text-align: left;
        font-weight: 400;
      }
      .row:focus-visible {
        outline-offset: -2px;
      }
      .plat {
        width: max-content;
        min-width: 26px;
        height: 26px;
        padding: 0 4px;
        box-sizing: border-box;
        display: grid;
        place-items: center;
        background: var(--rv-platform);
        color: var(--rv-on-rail);
        font-family: var(--rv-font-cond);
        font-size: 16px;
        font-weight: 600;
        line-height: 1;
      }
      .name {
        font-size: 17px;
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .row .ch,
      .row .model {
        font-size: 15px;
      }
      .state {
        display: flex;
        flex-direction: column;
        font-size: 15px;
      }
      .offline {
        color: var(--rv-fault-ink);
        font-weight: 600;
      }
      .flags {
        font-size: 13px;
      }
      .row svg {
        width: 18px;
        height: 18px;
        color: var(--rv-muted);
      }
      @container (max-width: 640px) {
        .cols {
          display: none;
        }
        .row {
          grid-template-columns: 30px minmax(0, 1fr) auto 18px;
        }
        .model {
          display: none;
        }
        .plat-cell {
          grid-row: 1 / span 2;
        }
        .name {
          grid-column: 2;
          grid-row: 1;
        }
        .ch {
          grid-column: 2;
          grid-row: 2;
          font-size: 14px;
        }
        .state {
          grid-column: 3;
          grid-row: 1 / span 2;
          text-align: right;
        }
        .row svg {
          grid-column: 4;
          grid-row: 1 / span 2;
        }
      }
    `,
  ];
}

/** What the camera is doing, when Home Assistant knows. */
function stateWord(camera: CameraNode): TemplateResult | typeof nothing {
  const status = camera.status;
  if (status.online === false) return html`<span class="offline">Offline</span>`;
  if (status.sleeping) return html`<span>Asleep</span>`;
  return status.online ? html`<span>Online</span>` : nothing;
}

if (!customElements.get("rv-device-list")) {
  customElements.define("rv-device-list", RvDeviceList);
}

declare global {
  interface HTMLElementTagNameMap {
    "rv-device-list": RvDeviceList;
  }
}

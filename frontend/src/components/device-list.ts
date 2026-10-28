import { LitElement, css, html, nothing, type TemplateResult } from "lit";

import { deviceTypeLabel } from "../format";
import { sharedStyles } from "../styles";
import type { CameraNode, DevicesResponse, HostNode } from "../types";
import { navigate } from "./navigation";

/** Grouped device list: NVR/Hub → channels, then cameras added directly. */
export class RvDeviceList extends LitElement {
  static override properties = {
    devices: { attribute: false },
  };

  declare devices: DevicesResponse | undefined;

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
    const direct = devices.cameras.filter((c) => c.host_id === null);
    return html`
      ${devices.hosts.map((host) => this._renderHost(host, byId))}
      ${direct.length
        ? html`<section class="card">
            <h2>Cameras added directly</h2>
            <ul class="devices">
              ${direct.map((camera) => this._renderCamera(camera))}
            </ul>
          </section>`
        : nothing}
    `;
  }

  private _renderHost(host: HostNode, byId: Map<string, CameraNode>): TemplateResult {
    const cameras = host.camera_ids
      .map((id) => byId.get(id))
      .filter((c): c is CameraNode => c !== undefined);
    return html`<section class="card">
      <div class="host-header">
        <button class="link title" @click=${() => {
          navigate(this, { view: "device", id: host.id, tab: "overview" });
        }}>
          ${host.name ?? host.entry_title}
        </button>
        <span class="badge">${deviceTypeLabel(host.kind)}</span>
      </div>
      <p class="muted small">
        ${[host.model, host.sw_version && `firmware ${host.sw_version}`]
          .filter(Boolean)
          .join(" · ")}
      </p>
      ${cameras.length
        ? html`<ul class="devices">
            ${cameras.map((camera) => this._renderCamera(camera, host))}
          </ul>`
        : html`<p class="muted">No cameras on this ${deviceTypeLabel(host.kind)}.</p>`}
    </section>`;
  }

  private _renderCamera(camera: CameraNode, host?: HostNode): TemplateResult {
    const channel = host
      ? camera.connections.find((c) => c.host_id === host.id)?.channel
      : undefined;
    const alsoDirect = host !== undefined && camera.connections.some((c) => c.via === "direct");
    return html`<li>
      <button
        class="row"
        @click=${() => {
          navigate(this, { view: "device", id: camera.id, tab: "overview" });
        }}
      >
        <span class="name">
          ${channel !== undefined && channel !== null
            ? html`<span class="muted">Ch ${channel + 1}</span> `
            : nothing}${camera.name ?? "Camera"}
        </span>
        <span class="muted small">${camera.model ?? ""}</span>
        <span class="badges">
          ${statusBadge(camera)}
          ${alsoDirect
            ? html`<span class="badge" title="Also added to Home Assistant directly"
                >+ direct</span
              >`
            : nothing}
          ${camera.primary_view === "snapshot"
            ? html`<span class="badge" title="Does not record: snapshots are its main view"
                >snapshots</span
              >`
            : nothing}
        </span>
      </button>
    </li>`;
  }

  static override styles = [
    sharedStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .host-header {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .title {
        font-size: 18px;
        font-weight: 500;
      }
      ul.devices {
        list-style: none;
        margin: 8px 0 0;
        padding: 0;
      }
      ul.devices li + li {
        border-top: 1px solid var(--divider-color, #e0e0e0);
      }
      .row {
        display: grid;
        grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(0, 160px);
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 10px 4px;
        border: none;
        border-radius: 0;
        background: transparent;
        text-align: left;
      }
      .row:hover {
        background: var(--secondary-background-color, #f5f5f5);
      }
      .badges {
        display: flex;
        gap: 4px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }
      @media (max-width: 600px) {
        .row {
          grid-template-columns: 1fr auto;
        }
        .row > .small {
          display: none;
        }
      }
    `,
  ];
}

function statusBadge(camera: CameraNode): TemplateResult | typeof nothing {
  const status = camera.status;
  if (status.online === false) return html`<span class="badge warning">offline</span>`;
  if (status.sleeping) return html`<span class="badge">sleeping</span>`;
  return nothing;
}

if (!customElements.get("rv-device-list")) {
  customElements.define("rv-device-list", RvDeviceList);
}

declare global {
  interface HTMLElementTagNameMap {
    "rv-device-list": RvDeviceList;
  }
}

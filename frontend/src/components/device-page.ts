import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from "lit";

import { fetchCatalog, fetchDevice, toError } from "../api";
import { deviceTypeLabel } from "../format";
import { statesChanged } from "../render-filter";
import { sharedStyles } from "../styles";
import type { Catalog, DeviceResponse, HassEntities, HomeAssistant, Unsubscribe } from "../types";
import { navigate, type Tab } from "./navigation";
import "./overview";
import "./settings";

/** Wait this long after a registry change before reloading (changes come in bursts). */
const REGISTRY_DEBOUNCE_MS = 1_000;

interface RegistryEvent {
  data?: { action?: string; entity_id?: string };
}

/**
 * One device with Overview and Settings tabs.
 *
 * The panel passes a new `hass` on every state change in Home Assistant; this
 * element re-renders only when a state of one of its own entities changed.
 */
export class RvDevicePage extends LitElement {
  static override properties = {
    hass: { attribute: false },
    deviceId: { attribute: false },
    tab: { attribute: false },
    _device: { state: true },
    _catalog: { state: true },
    _error: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  declare deviceId: string;
  declare tab: Tab;
  declare _device: DeviceResponse | undefined;
  declare _catalog: Catalog | undefined;
  declare _error: string | undefined;

  /** Number of renders; used by tests and the debug readout. */
  renderCount = 0;

  private _watched: string[] = [];
  private _renderedStates: HassEntities | undefined;
  private _loadSeq = 0;
  private _unsubRegistry: Promise<Unsubscribe | undefined> | undefined;
  private _reloadTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    super();
    this.deviceId = "";
    this.tab = "overview";
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hass && !this._unsubRegistry) this._subscribeRegistry(this.hass);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this._reloadTimer);
    const unsub = this._unsubRegistry;
    this._unsubRegistry = undefined;
    void unsub?.then((fn) => fn?.()).catch(() => undefined);
  }

  protected override shouldUpdate(changed: PropertyValues<this>): boolean {
    // A new hass alone: render only if one of this device's states changed.
    if (changed.size === 1 && changed.has("hass") && this._renderedStates !== undefined) {
      return statesChanged(this._renderedStates, this.hass?.states, this._watched);
    }
    return true;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has("deviceId") || (changed.has("hass") && !this._device && !this._error)) {
      if (this.hass) void this._load();
    }
    if (changed.has("hass") && this.hass && this.isConnected && !this._unsubRegistry) {
      this._subscribeRegistry(this.hass);
    }
  }

  protected override updated(): void {
    this._renderedStates = this.hass?.states;
  }

  /** Reload the device (after an entity registry change). */
  async reload(): Promise<void> {
    await this._load(true);
  }

  private async _load(keep = false): Promise<void> {
    const hass = this.hass;
    if (!hass || !this.deviceId) return;
    const seq = ++this._loadSeq;
    if (!keep) {
      this._device = undefined;
      this._error = undefined;
    }
    try {
      const [device, catalog] = await Promise.all([
        fetchDevice(hass, this.deviceId),
        fetchCatalog(hass),
      ]);
      if (seq !== this._loadSeq) return;
      this._catalog = catalog;
      this._device = device;
      this._error = undefined;
      this._watched = watchedEntities(device);
    } catch (err) {
      if (seq !== this._loadSeq) return;
      this._error = toError(err).message;
    }
  }

  private _subscribeRegistry(hass: HomeAssistant): void {
    this._unsubRegistry = hass.connection
      .subscribeEvents<RegistryEvent>((event) => {
        const id = event.data?.entity_id;
        if (id && !this._device?.connections.some((c) => c.entities.some((e) => e.entity_id === id)))
          return;
        clearTimeout(this._reloadTimer);
        this._reloadTimer = setTimeout(() => void this.reload(), REGISTRY_DEBOUNCE_MS);
      }, "entity_registry_updated")
      .catch(() => undefined);
  }

  protected override render(): TemplateResult {
    this.renderCount += 1;
    const device = this._device;
    const node = device?.node;
    return html`
      <div class="header">
        <button class="text back" @click=${() => {
          navigate(this, { view: "list" });
        }} aria-label="Back to all devices">← All devices</button>
      </div>
      ${this._error
        ? html`<div class="banner error" role="alert">Could not load the device: ${this._error}</div>`
        : nothing}
      ${node
        ? html`<div class="title">
              <h2>${node.name ?? "Reolink device"}</h2>
              <span class="badge">${deviceTypeLabel(node.kind)}</span>
              ${node.kind === "camera" && node.connections.length > 1
                ? html`<span class="badge" title="In Home Assistant via the NVR and directly"
                    >${node.connections.length} connections</span
                  >`
                : nothing}
              <span class="muted small">${node.model ?? ""}</span>
            </div>
            <div class="tabs" role="tablist">
              ${(["overview", "settings"] as const).map(
                (tab) => html`<button
                  role="tab"
                  aria-selected=${this.tab === tab ? "true" : "false"}
                  class=${this.tab === tab ? "active" : ""}
                  @click=${() => {
                    navigate(this, { view: "device", id: this.deviceId, tab });
                  }}
                >
                  ${tab === "overview" ? "Overview" : "Settings"}
                </button>`,
              )}
            </div>
            ${device.degraded
              ? html`<div class="banner warning small">
                  Degraded mode: the Reolink integration's internals changed, so device details are
                  missing. Settings still work.
                </div>`
              : nothing}
            ${this.tab === "overview"
              ? html`<rv-overview .hass=${this.hass} .device=${device}></rv-overview>`
              : html`<rv-settings
                  .hass=${this.hass}
                  .device=${device}
                  .catalog=${this._catalog}
                  @rv-entity-enabled=${() => void this.reload()}
                ></rv-settings>`}`
        : this._error
          ? nothing
          : html`<p class="muted">Loading…</p>`}
    `;
  }

  static override styles = [
    sharedStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .back {
        padding-left: 0;
        color: var(--primary-color);
      }
      .title {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
      }
      .title h2 {
        margin: 0;
      }
      .tabs {
        display: flex;
        gap: 4px;
        border-bottom: 1px solid var(--divider-color, #e0e0e0);
      }
      .tabs button {
        border: none;
        border-radius: 0;
        background: transparent;
        padding: 8px 16px;
        border-bottom: 2px solid transparent;
      }
      .tabs button.active {
        border-bottom-color: var(--primary-color);
        color: var(--primary-color);
      }
    `,
  ];
}

/** Every entity whose state the page shows. */
export function watchedEntities(device: DeviceResponse): string[] {
  const ids = device.connections.flatMap((c) => c.entities.map((e) => e.entity_id));
  if (device.node.kind === "camera" && device.node.snapshot_entity_id) {
    ids.push(device.node.snapshot_entity_id);
  }
  return ids;
}

if (!customElements.get("rv-device-page")) {
  customElements.define("rv-device-page", RvDevicePage);
}

declare global {
  interface HTMLElementTagNameMap {
    "rv-device-page": RvDevicePage;
  }
}

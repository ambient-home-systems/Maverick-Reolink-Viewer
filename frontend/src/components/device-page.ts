import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from "lit";

import { fetchCatalog, fetchDevice, toError } from "../api";
import { deviceTypeLabel } from "../format";
import { statesChanged } from "../render-filter";
import { icon } from "../icons";
import { sharedStyles } from "../styles";
import type { Catalog, DeviceResponse, DevicesResponse, HassEntities, HomeAssistant, Unsubscribe } from "../types";
import "./live-grid";
import type { BoardCamera } from "./live-grid";
import { navigate, type Tab } from "./navigation";
import "./overview";
import "./playback";
import "./settings";

/** Wait this long after a registry change before reloading (changes come in bursts). */
const REGISTRY_DEBOUNCE_MS = 1_000;

interface RegistryEvent {
  data?: { action?: string; entity_id?: string };
}

/**
 * One device with Overview, Settings and (for cameras with recordings) Playback tabs.
 *
 * The panel passes a new `hass` on every state change in Home Assistant; this
 * element re-renders only when a state of one of its own entities changed.
 */
export class RvDevicePage extends LitElement {
  static override properties = {
    hass: { attribute: false },
    deviceId: { attribute: false },
    tab: { attribute: false },
    at: { attribute: false },
    cameras: { attribute: false },
    devices: { attribute: false },
    _device: { state: true },
    _catalog: { state: true },
    _error: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  declare deviceId: string;
  declare tab: Tab;
  /** On the Playback tab: a time to play (an event opened from the timetable). */
  declare at: number | undefined;
  /** The board's cameras, numbered. */
  declare cameras: BoardCamera[];
  /** Every device, for an NVR's or Home Hub's cameras. */
  declare devices: DevicesResponse | undefined;
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
    this.cameras = [];
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

  /** The camera's number on the live board. */
  private _number(id: string): number | undefined {
    return this.cameras.find((c) => c.id === id)?.number;
  }

  protected override render(): TemplateResult {
    this.renderCount += 1;
    const device = this._device;
    const node = device?.node;
    return html`
      <div class="header">
        <button class="text with-icon back" @click=${() => {
          navigate(this, { view: "list" });
        }}>${icon("back")}All devices</button>
      </div>
      ${this._error
        ? html`<div class="banner error" role="alert">Could not load the device: ${this._error}</div>`
        : nothing}
      ${node
        ? html`<div class="title">
              ${this._number(node.id) !== undefined
                ? html`<span class="plat" aria-hidden="true">${this._number(node.id)}</span>`
                : nothing}
              <h1>${node.name ?? "Reolink device"}</h1>
              <p class="kind muted">${kindLine(device)}</p>
            </div>
            <div class="tabs" role="tablist">
              ${tabsFor(device).map(
                (tab) => html`<button
                  role="tab"
                  aria-selected=${this.tab === tab ? "true" : "false"}
                  class=${this.tab === tab ? "active" : ""}
                  @click=${() => {
                    navigate(this, { view: "device", id: this.deviceId, tab });
                  }}
                >
                  ${TAB_LABELS[tab]}
                </button>`,
              )}
            </div>
            ${device.degraded
              ? html`<div class="banner warning small">
                  Degraded mode: the Reolink integration's internals changed, so device details are
                  missing. Settings still work.
                </div>`
              : nothing}
            ${this.tab === "live" && hasLive(device)
              ? html`<rv-live-camera .hass=${this.hass} .deviceId=${node.id}></rv-live-camera>`
              : this.tab === "playback" && hasPlayback(device)
              ? html`<rv-playback
                  .hass=${this.hass}
                  .deviceId=${node.id}
                  .cameraName=${node.name ?? ""}
                  .at=${this.at}
                ></rv-playback>`
              : this.tab === "overview" || this.tab === "playback" || this.tab === "live"
              ? html`<rv-overview
                  .hass=${this.hass}
                  .device=${device}
                  .devices=${this.devices}
                  .cameras=${this.cameras}
                ></rv-overview>`
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
        gap: 14px;
      }
      .back {
        padding-left: 0;
      }
      .title {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 6px 14px;
      }
      .title h1 {
        margin: 0;
        font-family: var(--rv-font-cond);
        font-size: 30px;
        font-weight: 600;
        line-height: 1.1;
      }
      .kind {
        flex-basis: 100%;
        margin: 0;
        font-size: 15px;
      }
      .plat {
        min-width: 30px;
        height: 30px;
        padding: 0 5px;
        box-sizing: border-box;
        display: grid;
        place-items: center;
        background: var(--rv-platform);
        color: var(--rv-on-rail);
        font-family: var(--rv-font-cond);
        font-size: 18px;
        font-weight: 600;
        line-height: 1;
      }
      .tabs {
        display: flex;
        gap: 4px;
        border-bottom: 1px solid var(--rv-rule-strong);
        overflow-x: auto;
        scrollbar-width: none;
      }
      .tabs button {
        min-height: 44px;
        padding: 0 14px;
        border: none;
        border-radius: 0;
        background: transparent;
        color: var(--rv-muted);
        font-size: 16px;
        box-shadow: inset 0 -3px 0 transparent;
      }
      .tabs button:hover:not(:disabled) {
        background: transparent;
        color: var(--rv-text);
      }
      .tabs button.active {
        color: var(--rv-text);
        box-shadow: inset 0 -3px 0 var(--rv-text);
      }
      .tabs button:focus-visible {
        outline-offset: -4px;
      }
    `,
  ];
}

/** "Camera · CX410 · on the NVR and added directly". */
export function kindLine(device: DeviceResponse): string {
  const node = device.node;
  const parts = [deviceTypeLabel(node.kind), node.model ?? undefined];
  if (node.kind === "camera" && node.connections.length > 1) {
    const vias = new Set(node.connections.map((c) => c.via));
    parts.push(
      vias.has("nvr") && vias.has("direct")
        ? "on the NVR and added directly"
        : `${String(node.connections.length)} connections`,
    );
  }
  return parts.filter(Boolean).join(" · ");
}

const TAB_LABELS: Record<Tab, string> = {
  overview: "Overview",
  live: "Live",
  playback: "Playback",
  settings: "Settings",
};

/** A camera has playback when one of its connections records (NVR, Hub, SD card). */
export function hasPlayback(device: DeviceResponse): boolean {
  return device.node.kind === "camera" && device.node.connections.some((c) => c.playback_source);
}

/** A camera can be watched live, unless the integration runs degraded (no live service). */
export function hasLive(device: DeviceResponse): boolean {
  return device.node.kind === "camera" && !device.degraded;
}

export function tabsFor(device: DeviceResponse): Tab[] {
  return [
    "overview",
    ...(hasLive(device) ? (["live"] as const) : []),
    ...(hasPlayback(device) ? (["playback"] as const) : []),
    "settings",
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

import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from "lit";

import { enableEntity, toError } from "../api";
import {
  catalogEntry,
  confirmationFor,
  entityLabel,
  matchesSearch,
  orderedCategories,
  relatedEntry,
  type Action,
} from "../catalog";
import { icon } from "../icons";
import { connectionLabel } from "../format";

export { connectionLabel };
import { brightnessCall, serviceFor, type ServiceCall } from "../services";
import { sharedStyles } from "../styles";
import type {
  Catalog,
  CatalogEntry,
  DeviceConnection,
  DeviceResponse,
  EntityInfo,
  HassEntity,
  HomeAssistant,
} from "../types";
import { PendingWrites, SETTLE_TIMEOUT_MS, type WriteValue } from "../writes";
import { toast } from "./navigation";

// HA's UpdateEntityFeature.INSTALL.
const UPDATE_INSTALL = 1;

interface Row {
  entity: EntityInfo;
  entry: CatalogEntry | undefined;
  label: string;
}

interface ConfirmState {
  title: string;
  message: string;
  resolve: (ok: boolean) => void;
}

/** Settings tab: every entity of the device, grouped by category. */
export class RvSettings extends LitElement {
  static override properties = {
    hass: { attribute: false },
    device: { attribute: false },
    catalog: { attribute: false },
    _connection: { state: true },
    _search: { state: true },
    _showDisabled: { state: true },
    _open: { state: true },
    _confirm: { state: true },
    _enabling: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  declare device: DeviceResponse | undefined;
  declare catalog: Catalog | undefined;
  declare _connection: number | undefined;
  declare _search: string;
  declare _showDisabled: boolean;
  declare _open: ReadonlySet<string>;
  declare _confirm: ConfirmState | undefined;
  declare _enabling: ReadonlySet<string>;

  /** Optimistic values of writes in flight. */
  readonly writes = new PendingWrites();
  /** Milliseconds from creation to the first rendered frame of settings. */
  renderMs: number | undefined;

  private readonly _created = performance.now();
  private _settleTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    super();
    this._search = "";
    this._showDisabled = false;
    this._open = new Set();
    this._enabling = new Set();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this._settleTimer);
    this._confirm?.resolve(false);
    this._confirm = undefined;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has("hass") && this.hass) this.writes.settle(this.hass.states);
  }

  protected override firstUpdated(): void {
    this.renderMs = performance.now() - this._created;
    this.dataset.renderMs = this.renderMs.toFixed(1);
  }

  /** The connection whose entities are shown (the one with the most by default). */
  get connection(): DeviceConnection | undefined {
    const connections = this.device?.connections ?? [];
    if (this._connection !== undefined) return connections[this._connection];
    let best: DeviceConnection | undefined;
    for (const conn of connections) {
      if (!best || conn.entities.length > best.entities.length) best = conn;
    }
    return best;
  }

  private _rows(conn: DeviceConnection): Map<string, Row[]> {
    const rows = new Map<string, Row[]>();
    for (const entity of conn.entities) {
      if (entity.disabled_by !== null && !this._showDisabled) continue;
      const entry = catalogEntry(this.catalog, entity.domain, entity.key);
      if (!matchesSearch(entity, entry, this._search)) continue;
      const list = rows.get(entity.category) ?? [];
      list.push({ entity, entry, label: entityLabel(entity, entry) });
      rows.set(entity.category, list);
    }
    for (const list of rows.values()) {
      list.sort((a, b) => a.label.localeCompare(b.label));
    }
    return rows;
  }

  protected override render(): TemplateResult {
    const conn = this.connection;
    if (!this.device || !conn) return html`<p class="muted">No settings.</p>`;
    const rows = this._rows(conn);
    const disabled = conn.entities.filter((e) => e.disabled_by !== null).length;
    const categories = orderedCategories(this.catalog).filter((c) => rows.has(c.id));
    return html`
      <div class="toolbar">
        <input
          class="search"
          type="search"
          placeholder="Search settings"
          aria-label="Search settings"
          .value=${this._search}
          @input=${(e: Event) => {
            this._search = (e.target as HTMLInputElement).value;
          }}
        />
        <label class="small">
          <input
            type="checkbox"
            .checked=${this._showDisabled}
            @change=${(e: Event) => {
              this._showDisabled = (e.target as HTMLInputElement).checked;
            }}
          />
          Show disabled entities (${disabled})
        </label>
      </div>
      ${this._renderConnections()}
      ${this._showDisabled
        ? html`<p class="banner info small">
            Home Assistant creates some Reolink entities disabled.
            ${this.hass?.user?.is_admin
              ? "Enabling one makes Home Assistant reload the Reolink integration entry for this device after about 30 seconds; its entities are briefly unavailable and the new one appears then."
              : "An administrator can enable them."}
          </p>`
        : nothing}
      ${categories.length
        ? categories.map(
            (category) => html`<section class="category">
              <h3>${category.title}</h3>
              <p class="muted small">${category.description}</p>
              <ul class="rows">
                ${(rows.get(category.id) ?? []).map((row) => this._renderRow(row))}
              </ul>
            </section>`,
          )
        : html`<p class="muted">No settings match “${this._search}”.</p>`}
      ${this._renderConfirm()}
    `;
  }

  private _renderConnections(): TemplateResult | typeof nothing {
    const connections = this.device?.connections ?? [];
    if (connections.length < 2) return nothing;
    const current = this.connection;
    return html`<div class="connections" role="radiogroup" aria-label="Settings through">
      <span class="small muted">Settings through</span>
      ${connections.map(
        (conn, index) => html`<button
          role="radio"
          aria-checked=${conn === current ? "true" : "false"}
          class=${conn === current ? "primary" : ""}
          @click=${() => {
            this._connection = index;
          }}
        >
          ${connectionLabel(conn)} · ${conn.entities.length} settings
        </button>`,
      )}
      <span class="small muted">
        Both connections reach the same camera; a change made through either applies to it.
      </span>
    </div>`;
  }

  private _renderRow(row: Row): TemplateResult {
    const { entity, entry, label } = row;
    const open = this._open.has(entity.entity_id);
    return html`<li class="row" data-entity-id=${entity.entity_id}>
      <div class="info">
        <div class="label">
          ${label}
          ${entity.sub_device ? html`<span class="badge">${entity.sub_device}</span>` : nothing}
          ${entity.disabled_by !== null ? html`<span class="badge">Turned off</span>` : nothing}
          ${entity.hidden_by !== null ? html`<span class="badge">Hidden</span>` : nothing}
          ${entity.entity_category === "diagnostic"
            ? html`<span class="badge">Read only</span>`
            : nothing}
          ${entry?.impact === "disruptive"
            ? html`<span class="badge warning" title=${entry.impact_note ?? ""}>Asks first</span>`
            : nothing}
        </div>
        ${entry ? html`<div class="muted small">${entry.summary}</div>` : nothing}
      </div>
      <div class="control">${this._renderControl(entity, label)}</div>
      ${entry
        ? html`<details
            class="about"
            .open=${open}
            @toggle=${(e: Event) => {
              this._setOpen(entity.entity_id, (e.target as HTMLDetailsElement).open);
            }}
          >
            <summary class="small">About this setting${icon("chevronDown")}</summary>
            ${open ? this._renderAbout(entry) : nothing}
          </details>`
        : nothing}
    </li>`;
  }

  private _setOpen(entityId: string, open: boolean): void {
    if (this._open.has(entityId) === open) return;
    const next = new Set(this._open);
    if (open) next.add(entityId);
    else next.delete(entityId);
    this._open = next;
  }

  private _renderAbout(entry: CatalogEntry): TemplateResult {
    const related = entry.related
      .map((ref) => relatedEntry(this.catalog, ref)?.title)
      .filter((t): t is string => t !== undefined);
    return html`<div class="about-body small">
      ${entry.verification === "unverified"
        ? html`<p class="unverified">
            <span class="badge warning">unverified</span> Reolink does not document exactly what
            this does; the text says only what is known.
          </p>`
        : nothing}
      <p>${entry.what_it_does}</p>
      ${entry.tradeoffs ? html`<p><strong>Trade-offs:</strong> ${entry.tradeoffs}</p>` : nothing}
      ${entry.impact === "disruptive"
        ? html`<p><strong>Impact:</strong> ${entry.impact_note}</p>`
        : nothing}
      <p><strong>Requires:</strong> ${entry.requires}</p>
      ${entry.notes ? html`<p>${entry.notes}</p>` : nothing}
      ${related.length ? html`<p><strong>Related:</strong> ${related.join(", ")}</p>` : nothing}
      <p>
        <strong>Sources:</strong>
        ${entry.sources.map(
          (s, i) => html`${i ? ", " : ""}<a href=${s.url} target="_blank" rel="noreferrer"
              >${s.title}</a
            >`,
        )}
      </p>
    </div>`;
  }

  // ---- Controls ----

  private _renderControl(entity: EntityInfo, label: string): TemplateResult {
    if (entity.disabled_by !== null) {
      if (!this.hass?.user?.is_admin) return html`<span class="muted small">Disabled</span>`;
      const busy = this._enabling.has(entity.entity_id);
      return html`<button ?disabled=${busy} @click=${() => void this._enable(entity, label)}>
        ${busy ? "Enabling…" : "Enable"}
      </button>`;
    }
    const state = this.hass?.states[entity.entity_id];
    if (!state) return html`<span class="muted small">Not loaded yet</span>`;
    const id = entity.entity_id;
    const pending = this.writes.isPending(id);
    const optimistic = this.writes.valueFor(id);
    // "unknown" is normal (buttons until first pressed, write-only selects).
    const unavailable = state.state === "unavailable";
    const off = unavailable || pending;

    switch (entity.domain) {
      case "switch":
      case "siren":
        return this._toggle(entity, label, optimistic ?? state.state === "on", off && !pending);
      case "light":
        return this._light(entity, label, state, optimistic, off && !pending);
      case "number":
        return this._number(entity, label, state, optimistic, off);
      case "select":
        return this._select(entity, label, state, optimistic, off);
      case "time":
        return html`<input
          type="time"
          step="1"
          aria-label=${label}
          .value=${String(optimistic ?? (/^\d\d:\d\d/.test(state.state) ? state.state : ""))}
          ?disabled=${off}
          @change=${(e: Event) => {
            const value = (e.target as HTMLInputElement).value;
            if (value) void this._write(entity, label, value, "any");
          }}
        />`;
      case "button":
        return html`<button
          ?disabled=${off}
          @click=${() => void this._write(entity, label, "press", "any")}
        >
          ${pending ? "Working…" : label}
        </button>`;
      case "update":
        return this._update(entity, label, state, pending);
      default:
        return html`<span class="value">${formatState(state, entity.domain)}</span>`;
    }
  }

  private _toggle(
    entity: EntityInfo,
    label: string,
    on: WriteValue,
    disabled: boolean,
  ): TemplateResult {
    const checked = on === true;
    return html`<button
      class="toggle ${checked ? "on" : ""}"
      role="switch"
      aria-label=${label}
      aria-checked=${checked ? "true" : "false"}
      ?disabled=${disabled}
      @click=${() => void this._write(entity, label, !checked, checked ? "off" : "on")}
    >
      <span class="knob"></span>
    </button>`;
  }

  private _light(
    entity: EntityInfo,
    label: string,
    state: HassEntity,
    optimistic: WriteValue | undefined,
    disabled: boolean,
  ): TemplateResult {
    const modes = state.attributes.supported_color_modes;
    const dimmable = Array.isArray(modes) && modes.some((m) => m !== "onoff");
    const brightness = state.attributes.brightness;
    const percent = typeof brightness === "number" ? Math.round((brightness / 255) * 100) : 0;
    const on = typeof optimistic === "boolean" ? optimistic : state.state === "on";
    return html`<span class="light">
      ${dimmable && on
        ? html`<input
            type="range"
            min="1"
            max="100"
            aria-label="${label} brightness"
            .value=${String(typeof optimistic === "number" ? optimistic : percent)}
            ?disabled=${disabled}
            @change=${(e: Event) => {
              const value = Number((e.target as HTMLInputElement).value);
              void this._write(entity, label, value, "on", brightnessCall(value));
            }}
          />`
        : nothing}
      ${this._toggle(entity, label, on, disabled)}
    </span>`;
  }

  private _number(
    entity: EntityInfo,
    label: string,
    state: HassEntity,
    optimistic: WriteValue | undefined,
    disabled: boolean,
  ): TemplateResult {
    const attrs = state.attributes;
    const min = numberAttr(attrs.min, 0);
    const max = numberAttr(attrs.max, 100);
    const step = numberAttr(attrs.step, 1);
    const unit = typeof attrs.unit_of_measurement === "string" ? attrs.unit_of_measurement : "";
    const current = Number(state.state);
    const value = typeof optimistic === "number" ? optimistic : current;
    const shown = Number.isFinite(value) ? String(value) : "";
    const commit = (e: Event) => {
      const input = e.target as HTMLInputElement;
      const next = Number(input.value);
      if (input.value === "" || !Number.isFinite(next) || next < min || next > max) {
        input.value = shown;
        return;
      }
      if (next !== value) void this._write(entity, label, next, "any");
    };
    return html`<span class="number">
      ${attrs.mode === "box"
        ? nothing
        : html`<input
            type="range"
            min=${min}
            max=${max}
            step=${step}
            aria-label=${label}
            .value=${shown}
            ?disabled=${disabled}
            @input=${(e: Event) => {
              // Show the value while dragging; write on release.
              const box = (e.target as HTMLElement).nextElementSibling as HTMLInputElement | null;
              if (box) box.value = (e.target as HTMLInputElement).value;
            }}
            @change=${commit}
          />`}
      <input
        class="box"
        type="number"
        min=${min}
        max=${max}
        step=${step}
        aria-label="${label} value"
        .value=${shown}
        ?disabled=${disabled}
        @change=${commit}
      />
      ${unit ? html`<span class="unit muted small">${unit}</span>` : nothing}
    </span>`;
  }

  private _select(
    entity: EntityInfo,
    label: string,
    state: HassEntity,
    optimistic: WriteValue | undefined,
    disabled: boolean,
  ): TemplateResult {
    const options = Array.isArray(state.attributes.options)
      ? state.attributes.options.map(String)
      : [];
    const value = typeof optimistic === "string" ? optimistic : state.state;
    return html`<select
      aria-label=${label}
      ?disabled=${disabled}
      @change=${(e: Event) => {
        const select = e.target as HTMLSelectElement;
        const option = select.value;
        select.value = value;
        void this._write(entity, label, option, { option });
      }}
    >
      ${options.includes(value) ? nothing : html`<option value="" selected>—</option>`}
      ${options.map(
        (option) => html`<option value=${option} ?selected=${option === value}>${optionLabel(option)}</option>`,
      )}
    </select>`;
  }

  private _update(
    entity: EntityInfo,
    label: string,
    state: HassEntity,
    pending: boolean,
  ): TemplateResult {
    const attrs = state.attributes;
    const installed = typeof attrs.installed_version === "string" ? attrs.installed_version : "?";
    const latest = typeof attrs.latest_version === "string" ? attrs.latest_version : null;
    const features = typeof attrs.supported_features === "number" ? attrs.supported_features : 0;
    const inProgress = attrs.in_progress === true || pending;
    const canInstall = state.state === "on" && (features & UPDATE_INSTALL) !== 0;
    return html`<span class="update small">
      <span>
        ${installed}${latest && latest !== installed ? html` → <strong>${latest}</strong>` : nothing}
        ${state.state === "off" ? html`<span class="muted">(up to date)</span>` : nothing}
      </span>
      ${canInstall || inProgress
        ? html`<button
            ?disabled=${inProgress}
            @click=${() => void this._write(entity, label, "install", "any")}
          >
            ${inProgress ? "Installing…" : "Install"}
          </button>`
        : nothing}
    </span>`;
  }

  // ---- Writes ----

  /**
   * Change an entity through a standard HA action: confirm if the catalog
   * marks the action disruptive, show the new value at once, roll back with
   * a message if HA rejects it.
   */
  private async _write(
    entity: EntityInfo,
    label: string,
    value: WriteValue,
    action: Action,
    call?: ServiceCall,
  ): Promise<void> {
    const hass = this.hass;
    if (!hass) return;
    const entry = catalogEntry(this.catalog, entity.domain, entity.key);
    const warning = confirmationFor(entry, action);
    if (warning !== null && !(await this.confirm(label, warning))) return;

    const service =
      call ??
      serviceFor(
        entity.domain,
        entity.domain === "button" ? "press" : entity.domain === "update" ? "install" : value,
      );
    const id = entity.entity_id;
    const token = this.writes.begin(id, value, hass.states[id]);
    this.requestUpdate();
    try {
      await hass.callService(service.domain, service.service, service.data, { entity_id: id }, false);
      this.writes.confirm(id, token);
      this._scheduleSettle();
    } catch (err) {
      if (this.writes.fail(id, token)) {
        toast(this, `Could not change ${label}: ${toError(err).message}`, "error");
      }
    }
    this.requestUpdate();
  }

  private _scheduleSettle(): void {
    clearTimeout(this._settleTimer);
    this._settleTimer = setTimeout(() => {
      if (this.hass && this.writes.settle(this.hass.states)) this.requestUpdate();
      if (this.writes.size) this._scheduleSettle();
    }, SETTLE_TIMEOUT_MS + 100);
  }

  /** Ask before a disruptive action. Resolves true to go ahead. */
  confirm(title: string, message: string): Promise<boolean> {
    this._confirm?.resolve(false);
    return new Promise((resolve) => {
      this._confirm = {
        title,
        message,
        resolve: (ok) => {
          this._confirm = undefined;
          resolve(ok);
        },
      };
    });
  }

  private _renderConfirm(): TemplateResult | typeof nothing {
    const confirm = this._confirm;
    if (!confirm) return nothing;
    return html`<div class="scrim" @click=${() => {
      confirm.resolve(false);
    }}>
      <div
        class="dialog card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        @click=${(e: Event) => {
          e.stopPropagation();
        }}
      >
        <h3 id="confirm-title">${confirm.title}</h3>
        <p>${confirm.message}</p>
        <p class="muted small">Do you want to continue?</p>
        <div class="actions">
          <button @click=${() => {
            confirm.resolve(false);
          }}>Cancel</button>
          <button class="danger" @click=${() => {
            confirm.resolve(true);
          }}>Continue</button>
        </div>
      </div>
    </div>`;
  }

  private async _enable(entity: EntityInfo, label: string): Promise<void> {
    const hass = this.hass;
    if (!hass) return;
    this._enabling = new Set([...this._enabling, entity.entity_id]);
    try {
      const result = await enableEntity(hass, entity.entity_id);
      const delay = result.reload_delay;
      toast(
        this,
        `${label} enabled. Home Assistant reloads the Reolink entry${
          delay ? ` in about ${delay} seconds` : ""
        }; the entity becomes available after that.`,
      );
      this.dispatchEvent(new CustomEvent("rv-entity-enabled", { bubbles: true, composed: true }));
    } catch (err) {
      toast(this, `Could not enable ${label}: ${toError(err).message}`, "error");
    } finally {
      const next = new Set(this._enabling);
      next.delete(entity.entity_id);
      this._enabling = next;
    }
  }

  static override styles = [
    sharedStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .toolbar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 12px;
      }
      .search {
        flex: 1;
        min-width: 180px;
        padding: 8px 10px;
      }
      .connections {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
      }
      .connections button {
        min-height: 34px;
        padding: 0 12px;
        border: 1px solid var(--rv-rule);
        font-size: 15px;
      }
      .connections button[aria-checked="true"],
      .connections button[aria-checked="true"]:hover {
        background: var(--rv-text);
        border-color: var(--rv-text);
        color: var(--rv-ground);
      }
      .category {
        margin-top: 16px;
        padding-top: 14px;
        border-top: 2px solid var(--rv-rule-strong);
      }
      .category h3 {
        margin: 0 0 2px;
        font-family: var(--rv-font-cond);
        font-size: 21px;
        font-weight: 600;
      }
      .category > p {
        margin: 0;
      }
      ul.rows {
        list-style: none;
        margin: 10px 0 0;
        padding: 0;
      }
      .row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 4px 16px;
        align-items: center;
        padding: 10px 0;
        border-top: 1px solid var(--rv-rule);
      }
      .label {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: center;
        font-size: 16px;
        font-weight: 500;
      }
      .control {
        justify-self: end;
      }
      .about {
        grid-column: 1 / -1;
      }
      .about summary {
        min-height: 28px;
        color: var(--rv-action);
        font-weight: 400;
      }
      .about-body p {
        margin: 6px 0;
      }
      .number,
      .light,
      .update {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }
      .number input[type="range"],
      .light input[type="range"] {
        width: 160px;
        padding: 0;
        border: none;
        background: transparent;
        accent-color: var(--rv-action);
      }
      .box {
        width: 72px;
      }
      /* A switch: a square knob on a rail, the action colour when on. */
      .toggle {
        position: relative;
        width: 46px;
        min-height: 0;
        height: 26px;
        padding: 0;
        border-radius: 2px;
        border: 1px solid var(--rv-rule-strong);
        background: transparent;
      }
      .toggle:hover:not(:disabled) {
        background: var(--rv-ground-2);
      }
      .toggle .knob {
        position: absolute;
        top: 3px;
        left: 3px;
        width: 18px;
        height: 18px;
        border-radius: 1px;
        background: var(--rv-muted);
        transition: left 0.15s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .toggle.on,
      .toggle.on:hover:not(:disabled) {
        border-color: var(--rv-action);
        background: var(--rv-action);
      }
      .toggle.on .knob {
        left: 23px;
        background: var(--rv-on-action);
      }
      .value {
        font-size: 14px;
      }
      .scrim {
        position: fixed;
        inset: 0;
        z-index: 10;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(17, 20, 24, 0.55);
      }
      .dialog {
        max-width: 440px;
        margin: 16px;
        padding: 20px 22px;
        border-top: 6px solid var(--rv-fault);
        background: var(--rv-ground);
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
      }
      .dialog h3 {
        font-family: var(--rv-font-cond);
        font-size: 22px;
      }
      .actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }
      @media (max-width: 600px) {
        .row {
          grid-template-columns: 1fr;
        }
        .control {
          justify-self: start;
        }
        .number input[type="range"] {
          width: 120px;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .toggle .knob {
          transition: none;
        }
      }
    `,
  ];
}


/** A select's raw option as words: "black&white" → "Black & white". */
export function optionLabel(option: string): string {
  const words = option.replace(/_/g, " ").replace(/\s*&\s*/g, " & ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function numberAttr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function formatState(state: HassEntity, domain: string): string {
  if (state.state === "unavailable") return "Unavailable";
  if (state.state === "unknown") return "Unknown";
  if (domain === "binary_sensor") {
    const motion = ["motion", "occupancy", "presence"].includes(
      String(state.attributes.device_class),
    );
    if (state.state === "on") return motion ? "Detected" : "On";
    if (state.state === "off") return motion ? "Clear" : "Off";
  }
  const unit = state.attributes.unit_of_measurement;
  return typeof unit === "string" && unit ? `${state.state} ${unit}` : state.state;
}

if (!customElements.get("rv-settings")) {
  customElements.define("rv-settings", RvSettings);
}

declare global {
  interface HTMLElementTagNameMap {
    "rv-settings": RvSettings;
  }
}

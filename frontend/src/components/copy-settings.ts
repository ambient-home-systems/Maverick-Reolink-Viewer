import { LitElement, css, html, nothing, type TemplateResult } from "lit";

import { fetchDevice, toError } from "../api";
import { catalogEntry, confirmationFor, entityLabel, orderedCategories } from "../catalog";
import {
  COPY_CATEGORIES,
  applied,
  copyAction,
  copyCall,
  copyableCounts,
  planCopy,
  sourceSettings,
  type PlanItem,
} from "../copy-settings";
import { sharedStyles } from "../styles";
import type { CameraNode, Catalog, DeviceConnection, EntityInfo, HomeAssistant } from "../types";
import { SETTLE_TIMEOUT_MS } from "../writes";
import { optionLabel } from "../format";

/** One target camera's plan, or why it could not be read. */
interface TargetPlan {
  camera: CameraNode;
  items: PlanItem[];
  error?: string;
}

/** A change sent: refused, or sent at (performance.now()). */
type Sent = { refused: string } | { at: number };

/** What became of a change, as HA's state shows it. */
type CopyStatus =
  | { kind: "pending" }
  | { kind: "sending" }
  | { kind: "changed" }
  | { kind: "refused"; reason: string }
  | { kind: "unchanged"; shows: string };

type Stage = "choose" | "preview" | "applying" | "done";

/** The connection with the most entities (as the Settings tab shows by default). */
export function fullestConnection<T extends { entities: readonly unknown[] }>(connections: readonly T[]): T | undefined {
  let best: T | undefined;
  for (const conn of connections) if (!best || conn.entities.length > best.entities.length) best = conn;
  return best;
}

/**
 * "Copy to…" (Phase 11 step 4): a camera's settings, by category, to other
 * cameras. Choose; see each change and what each camera cannot take; then
 * each is set through its standard HA action, one at a time, with a result
 * for each as HA's state shows it.
 */
export class RvCopySettings extends LitElement {
  static override properties = {
    hass: { attribute: false },
    source: { attribute: false },
    sourceId: { attribute: false },
    sourceName: { attribute: false },
    sourceModel: { attribute: false },
    cameras: { attribute: false },
    catalog: { attribute: false },
    _stage: { state: true },
    _categories: { state: true },
    _targets: { state: true },
    _plans: { state: true },
    _sent: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  /** The connection whose settings are copied (the one the Settings tab shows). */
  declare source: DeviceConnection | undefined;
  declare sourceId: string;
  declare sourceName: string;
  declare sourceModel: string | null;
  declare cameras: readonly CameraNode[];
  declare catalog: Catalog | undefined;
  declare _stage: Stage;
  declare _categories: ReadonlySet<string>;
  declare _targets: ReadonlySet<string>;
  declare _plans: TargetPlan[] | undefined;
  declare _sent: ReadonlyMap<string, Sent>;

  private _settleTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    super();
    this.sourceId = "";
    this.sourceName = "";
    this.sourceModel = null;
    this.cameras = [];
    this._stage = "choose";
    this._categories = new Set();
    this._targets = new Set();
    this._sent = new Map();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener("keydown", this._onKey);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener("keydown", this._onKey);
    clearTimeout(this._settleTimer);
  }

  protected override firstUpdated(): void {
    this.renderRoot.querySelector<HTMLElement>("h2")?.focus();
  }

  private readonly _onKey = (e: KeyboardEvent): void => {
    if (e.key === "Escape" && this._stage !== "applying") this._close();
  };

  private _close(): void {
    this.dispatchEvent(new CustomEvent("rv-close", { bubbles: true, composed: true }));
  }

  /** The other cameras, same model first, then by name. */
  private get _otherCameras(): CameraNode[] {
    const same = (c: CameraNode) => (this.sourceModel !== null && c.model === this.sourceModel ? 0 : 1);
    return this.cameras
      .filter((c) => c.id !== this.sourceId && c.connections.length > 0)
      .sort((a, b) => same(a) - same(b) || (a.name ?? "").localeCompare(b.name ?? ""));
  }

  private _label(entity: EntityInfo): string {
    const entry = catalogEntry(this.catalog, entity.domain, entity.key);
    return entry?.title ?? entityLabel(entity, entry);
  }

  private _value(entity: EntityInfo, value: string): string {
    if (entity.domain === "switch" || entity.domain === "light") return value === "on" ? "On" : "Off";
    if (entity.domain === "select") return optionLabel(value);
    if (entity.domain === "time") return value.slice(0, 5);
    const unit = this.hass?.states[entity.entity_id]?.attributes.unit_of_measurement;
    return typeof unit === "string" && unit ? `${value} ${unit}` : value;
  }

  // ---- Stages ----

  private async _preview(): Promise<void> {
    const hass = this.hass;
    const source = this.source;
    if (!hass || !source) return;
    this._stage = "preview";
    this._plans = undefined;
    const settings = sourceSettings(source.entities, hass.states, this._categories);
    const chosen = this._otherCameras.filter((c) => this._targets.has(c.id));
    this._plans = await Promise.all(
      chosen.map(async (camera): Promise<TargetPlan> => {
        try {
          const device = await fetchDevice(hass, camera.id);
          const conn = fullestConnection(device.connections);
          return { camera, items: planCopy(settings, conn?.entities ?? [], this.hass?.states ?? hass.states) };
        } catch (err) {
          return { camera, items: [], error: toError(err).message };
        }
      }),
    );
  }

  /** Each change through its HA action, one at a time (each is a request to a camera). */
  private async _apply(): Promise<void> {
    const hass = this.hass;
    const plans = this._plans;
    if (!hass || !plans) return;
    this._stage = "applying";
    for (const plan of plans) {
      for (const item of plan.items) {
        if (item.verdict.kind !== "change" || !item.target) continue;
        const call = copyCall(item.target.domain, item.setting.value);
        let sent: Sent;
        try {
          await hass.callService(call.domain, call.service, call.data, { entity_id: item.target.entity_id }, false);
          sent = { at: performance.now() };
        } catch (err) {
          sent = { refused: toError(err).message };
        }
        this._sent = new Map([...this._sent, [item.target.entity_id, sent]]);
      }
    }
    this._stage = "done";
    // A camera takes a moment to show a change: look again once it should have.
    this._settleTimer = setTimeout(() => {
      this.requestUpdate();
    }, SETTLE_TIMEOUT_MS + 100);
  }

  // ---- Rendering ----

  protected override render(): TemplateResult {
    return html`<div class="scrim">
      <div class="dialog card" role="dialog" aria-modal="true" aria-labelledby="copy-title">
        <h2 id="copy-title" tabindex="-1">Copy settings from ${this.sourceName}</h2>
        ${this._stage === "choose" ? this._renderChoose() : this._renderPlans()}
      </div>
    </div>`;
  }

  private _renderChoose(): TemplateResult {
    const counts = this.hass && this.source ? copyableCounts(this.source.entities, this.hass.states) : new Map<string, number>();
    const categories = orderedCategories(this.catalog).filter((c) => COPY_CATEGORIES.includes(c.id) && counts.get(c.id));
    const cameras = this._otherCameras;
    const toggle = (set: ReadonlySet<string>, id: string, on: boolean) => {
      const next = new Set(set);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    };
    return html`
      <p class="muted small">Choose what to copy, and to which cameras. Nothing changes until you have seen what will.</p>
      <fieldset>
        <legend>What</legend>
        ${categories.length
          ? categories.map(
              (c) => html`<label class="choice">
                <input
                  type="checkbox"
                  .checked=${this._categories.has(c.id)}
                  @change=${(e: Event) => {
                    this._categories = toggle(this._categories, c.id, (e.target as HTMLInputElement).checked);
                  }}
                />
                <span>${c.title} <span class="muted">${counts.get(c.id)}</span></span>
              </label>`,
            )
          : html`<p class="muted small">This camera has no settings that can be copied.</p>`}
      </fieldset>
      <fieldset>
        <legend>To</legend>
        ${cameras.length
          ? cameras.map(
              (c) => html`<label class="choice">
                <input
                  type="checkbox"
                  .checked=${this._targets.has(c.id)}
                  @change=${(e: Event) => {
                    this._targets = toggle(this._targets, c.id, (e.target as HTMLInputElement).checked);
                  }}
                />
                <span
                  >${c.name ?? c.id}
                  ${c.model ? html`<span class="muted small">${c.model}</span>` : nothing}
                  ${this.sourceModel !== null && c.model === this.sourceModel
                    ? html`<span class="badge">Same model</span>`
                    : nothing}</span
                >
              </label>`,
            )
          : html`<p class="muted small">There is no other camera to copy to.</p>`}
      </fieldset>
      <p class="muted small">
        Never copied: the camera's name and on-screen text, and its pan, tilt and zoom, privacy and system settings.
      </p>
      <div class="actions">
        <button @click=${() => {
          this._close();
        }}>Cancel</button>
        <button
          class="primary"
          ?disabled=${!this._categories.size || !this._targets.size}
          @click=${() => void this._preview()}
        >
          Preview
        </button>
      </div>
    `;
  }

  private _renderPlans(): TemplateResult {
    const plans = this._plans;
    if (!plans) return html`<p class="muted" role="status">Reading the other cameras' settings…</p>`;
    const changes = plans.reduce((n, p) => n + p.items.filter((i) => i.verdict.kind === "change").length, 0);
    const stage = this._stage;
    return html`
      ${stage === "preview"
        ? html`<p class="muted small">
            ${changes
              ? `${String(changes)} ${changes === 1 ? "setting changes" : "settings change"}, each through Home Assistant, one at a time.`
              : "Nothing to change: these cameras already have these settings, or cannot take them."}
          </p>`
        : this._renderSummary(plans)}
      <div class="plans">${plans.map((plan) => this._renderPlan(plan))}</div>
      <div class="actions">
        ${stage === "preview"
          ? html`<button @click=${() => {
                this._stage = "choose";
              }}>Back</button>
              <button class="primary" ?disabled=${!changes} @click=${() => void this._apply()}>
                ${changes ? `Copy ${String(changes)} ${changes === 1 ? "change" : "changes"}` : "Nothing to copy"}
              </button>`
          : html`<button class="primary" ?disabled=${stage === "applying"} @click=${() => {
              this._close();
            }}>Done</button>`}
      </div>
    `;
  }

  private _renderSummary(plans: TargetPlan[]): TemplateResult {
    let changed = 0;
    let refused = 0;
    let waiting = 0;
    for (const plan of plans) {
      for (const item of plan.items) {
        if (item.verdict.kind !== "change" || !item.target) continue;
        const status = this._status(item);
        if (status.kind === "changed") changed += 1;
        else if (status.kind === "refused" || status.kind === "unchanged") refused += 1;
        else waiting += 1;
      }
    }
    const parts = [`${String(changed)} changed`];
    if (refused) parts.push(`${String(refused)} not`);
    if (waiting) parts.push(`${String(waiting)} waiting for the camera`);
    return html`<p class="small" role="status">${this._stage === "applying" ? "Copying… " : ""}${parts.join(", ")}.</p>`;
  }

  /** What became of a change, as HA's state shows it now. */
  private _status(item: PlanItem): CopyStatus {
    const target = item.target;
    if (!target) return { kind: "pending" };
    const sent = this._sent.get(target.entity_id);
    if (!sent) return { kind: this._stage === "applying" ? "sending" : "pending" };
    if ("refused" in sent) return { kind: "refused", reason: sent.refused };
    const state = this.hass?.states[target.entity_id];
    if (applied(target.domain, item.setting.value, state)) return { kind: "changed" };
    if (performance.now() - sent.at < SETTLE_TIMEOUT_MS) return { kind: "sending" };
    return { kind: "unchanged", shows: state ? this._value(target, state.state) : "nothing" };
  }

  private _renderPlan(plan: TargetPlan): TemplateResult {
    const changes = plan.items.filter((i) => i.verdict.kind === "change");
    const same = plan.items.filter((i) => i.verdict.kind === "same").length;
    const cannot = plan.items.filter((i) => i.verdict.kind === "cannot");
    const sameModel = this.sourceModel !== null && plan.camera.model === this.sourceModel;
    return html`<section class="plan">
      <h3>
        ${plan.camera.name ?? plan.camera.id}
        ${sameModel ? html`<span class="badge">Same model</span>` : nothing}
      </h3>
      ${plan.error
        ? html`<p class="small fault">Its settings could not be read: ${plan.error}</p>`
        : html`
            ${changes.length
              ? html`<ul class="changes">
                  ${changes.map((item) => this._renderChange(item))}
                </ul>`
              : nothing}
            ${same ? html`<p class="muted small">${same} already the same.</p>` : nothing}
            ${cannot.length
              ? html`<p class="small cannot-head">Cannot take</p>
                  <ul class="cannot">
                    ${cannot.map(
                      (item) => html`<li class="small">
                        ${this._label(item.setting.entity)}:
                        <span class="muted">${item.verdict.kind === "cannot" ? item.verdict.reason : ""}</span>
                      </li>`,
                    )}
                  </ul>`
              : nothing}
          `}
    </section>`;
  }

  private _renderChange(item: PlanItem): TemplateResult {
    const entity = item.setting.entity;
    const from = item.verdict.kind === "change" ? item.verdict.from : "";
    const warning = confirmationFor(
      catalogEntry(this.catalog, entity.domain, entity.key),
      copyAction(entity.domain, item.setting.value),
    );
    const status = this._stage === "preview" ? undefined : this._status(item);
    return html`<li data-entity-id=${item.target?.entity_id ?? ""}>
      <span class="what">${this._label(entity)}</span>
      <span class="values">
        <span class="muted">${this._value(entity, from)}</span> → <strong>${this._value(entity, item.setting.value)}</strong>
      </span>
      ${status ? html`<span class="status ${status.kind}">${statusText(status)}</span>` : nothing}
      ${warning ? html`<span class="warning small">${warning}</span>` : nothing}
    </li>`;
  }

  static override styles = [
    sharedStyles,
    css`
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
        width: min(640px, calc(100vw - 32px));
        max-height: calc(100vh - 32px);
        overflow: auto;
        margin: 16px;
        padding: 20px 22px;
        background: var(--rv-ground);
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
      }
      h2 {
        margin: 0 0 6px;
        font-family: var(--rv-font-cond);
        font-size: 22px;
        font-weight: 600;
      }
      h2:focus {
        outline: none;
      }
      fieldset {
        margin: 12px 0 0;
        padding: 0;
        border: 0;
      }
      legend {
        margin-bottom: 4px;
        font-weight: 600;
      }
      .choice {
        display: flex;
        align-items: center;
        gap: 10px;
        min-height: 36px;
      }
      .choice input {
        width: 18px;
        height: 18px;
        margin: 0;
      }
      .badge {
        margin-left: 6px;
      }
      .plans {
        display: grid;
        gap: 14px;
        margin-top: 10px;
      }
      h3 {
        margin: 0 0 6px;
        font-size: 17px;
      }
      ul {
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .changes li {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 2px 12px;
        padding: 6px 0;
        border-top: 1px solid var(--rv-rule);
      }
      .changes .status,
      .changes .warning {
        grid-column: 1 / -1;
      }
      .status.changed {
        color: var(--rv-good, inherit);
      }
      .status.refused,
      .status.unchanged,
      .fault {
        color: var(--rv-fault);
      }
      .warning {
        color: var(--rv-muted);
      }
      .cannot-head {
        margin: 8px 0 2px;
        font-weight: 600;
      }
      .actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 16px;
      }
    `,
  ];
}

function statusText(status: CopyStatus): string {
  switch (status.kind) {
    case "pending":
      return "Not sent";
    case "sending":
      return "Sending…";
    case "changed":
      return "Changed";
    case "refused":
      return `Refused: ${status.reason}`;
    case "unchanged":
      return `Sent, but it still shows ${status.shows}`;
  }
}

if (!customElements.get("rv-copy-settings")) {
  customElements.define("rv-copy-settings", RvCopySettings);
}

declare global {
  interface HTMLElementTagNameMap {
    "rv-copy-settings": RvCopySettings;
  }
}

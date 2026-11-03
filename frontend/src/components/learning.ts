import { LitElement, css, html, nothing, type TemplateResult } from "lit";

import { fetchJournalStatus, toError } from "../api";
import { formatStamp } from "../playback/time";
import { sharedStyles } from "../styles";
import type { HomeAssistant, JournalStatus } from "../types";

type LearningState = "loading" | JournalStatus | { error: string };

/**
 * "Learning what is normal" (Phase 8 step 1), on the Devices page: whether
 * the detection journal records, since when, and how much, per camera; or how
 * to turn it on (Reolink Viewer's options). Read when shown.
 */
export class RvLearning extends LitElement {
  static override properties = {
    hass: { attribute: false },
    _state: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  declare _state: LearningState;

  private _read = false;

  constructor() {
    super();
    this._state = "loading";
  }

  protected override updated(): void {
    if (!this._read && this.hass) void this._load(this.hass);
  }

  private async _load(hass: HomeAssistant): Promise<void> {
    this._read = true;
    try {
      this._state = await fetchJournalStatus(hass);
    } catch (err) {
      this._state = { error: toError(err).message };
    }
  }

  protected override render(): TemplateResult {
    return html`<section class="card">
      <h2>Learning what is normal</h2>
      ${this._renderState()}
    </section>`;
  }

  private _renderState(): TemplateResult | typeof nothing {
    const state = this._state;
    if (state === "loading") return html`<p class="muted">Reading the journal…</p>`;
    if ("error" in state) return html`<p class="muted">Could not read the journal: ${state.error}</p>`;
    if (!state.enabled) {
      return html`<p class="muted">
        Off. Turn on <strong>Learn what is normal</strong> in Reolink Viewer's options (Settings → Devices &amp;
        services → Reolink Viewer → Configure), and Reolink Viewer keeps a journal of what each camera detects and when,
        so it can learn what is normal for each and, later, mark what is unusual. The journal stays on this Home
        Assistant.
      </p>`;
    }
    const zone = this.hass?.config?.time_zone;
    const cameras = state.cameras;
    return html`<p>
        On since ${formatStamp(state.created, zone)}: ${count(state.detections, "detection")} from
        ${count(cameras.length, "camera")} so far (${size(state.bytes)}).${state.imported
          ? ` It started with ${count(state.imported, "change")} from Home Assistant's history.`
          : ""}
      </p>
      ${cameras.length
        ? html`<ul>
            ${cameras.map(
              (camera) => html`<li>
                <span class="name">${camera.name}</span>:
                <span class="muted">${count(camera.detections, "detection")}, since ${formatStamp(camera.first, zone)}</span>
              </li>`,
            )}
          </ul>`
        : nothing}
      <p class="muted small">
        Marking what is unusual comes once each camera has a week of history: until then, it only learns.
      </p>`;
  }

  static override styles = [
    sharedStyles,
    css`
      :host {
        display: block;
      }
      ul {
        margin: 0 0 8px;
        padding-left: 20px;
      }
      li .name {
        font-weight: 500;
      }
    `,
  ];
}

const count = (n: number, noun: string) => `${n.toLocaleString("en-US")} ${noun}${n === 1 ? "" : "s"}`;

function size(bytes: number): string {
  return bytes < 1_000_000 ? `${Math.max(1, Math.round(bytes / 1000))} KB` : `${(bytes / 1_000_000).toFixed(1)} MB`;
}

if (!customElements.get("rv-learning")) {
  customElements.define("rv-learning", RvLearning);
}

declare global {
  interface HTMLElementTagNameMap {
    "rv-learning": RvLearning;
  }
}

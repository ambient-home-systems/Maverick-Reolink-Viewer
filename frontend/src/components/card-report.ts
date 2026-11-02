import { LitElement, css, html, nothing, type TemplateResult } from "lit";

import { clearCardLog, fetchCardLog, toError } from "../api";
import { copyText } from "../clipboard";
import { downloadJson } from "../download";
import { icon } from "../icons";
import { cardReport, summarize, summaryLines } from "../live/card-report";
import { formatStamp } from "../playback/time";
import { sharedStyles } from "../styles";
import type { CardLogDevice, HomeAssistant } from "../types";
import { VERSION } from "../version";

type ReportState = "loading" | { devices: CardLogDevice[]; copied?: boolean } | { error: string };

/**
 * The "Dashboard cards" report (#cards, Phase 7 step 2): what the Reolink
 * camera cards saw on each device (live/card_log): the screen off and on, the
 * page hidden and shown, video stopping and coming back, frames decoded while
 * nobody could see them, doorbell rings. A wall tablet's night, read on any
 * device; Download gives it whole to send.
 */
export class RvCardReport extends LitElement {
  static override properties = {
    hass: { attribute: false },
    _state: { state: true },
    _confirm: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  declare _state: ReportState;
  /** Start over was pressed once: asks to confirm. */
  declare _confirm: boolean;

  private _read = false;

  constructor() {
    super();
    this._state = "loading";
    this._confirm = false;
  }

  protected override updated(): void {
    if (!this._read && this.hass) void this.refresh();
  }

  async refresh(): Promise<void> {
    const hass = this.hass;
    if (!hass) return;
    this._read = true;
    this._state = "loading";
    try {
      this._state = { devices: (await fetchCardLog(hass)).devices };
    } catch (err) {
      this._state = { error: toError(err).message };
    }
  }

  private async _startOver(): Promise<void> {
    this._confirm = false;
    if (!this.hass) return;
    try {
      await clearCardLog(this.hass);
      await this.refresh();
    } catch (err) {
      this._state = { error: toError(err).message };
    }
  }

  protected override render(): TemplateResult {
    const state = this._state;
    const zone = this.hass?.config?.time_zone;
    return html`<div class="report-view" role="region" aria-label="Dashboard cards">
      <p class="intro">
        What the Reolink camera cards on your dashboards saw, on each device: the screen going off and on, video
        stopping and coming back, and whether any played while nobody could see it. Leave a wall tablet overnight, then
        read its night here.
      </p>
      <div class="actions">
        <button
          class="with-icon"
          @click=${() => {
            void this.refresh();
          }}
        >
          ${icon("refresh")}Refresh
        </button>
        ${typeof state === "object" && "devices" in state && state.devices.length
          ? html`<button
              @click=${() => {
                downloadJson({ version: VERSION, devices: state.devices }, `reolink-viewer-cards-${String(Date.now())}.json`);
              }}
            >
              Download
            </button>`
          : nothing}
        ${this._confirm
          ? nothing
          : html`<button
              @click=${() => {
                this._confirm = true;
              }}
            >
              Start over…
            </button>`}
      </div>
      ${this._confirm
        ? html`<div class="banner warning confirm" role="alert">
            <span>Start over? What every device's cards noted is dropped.</span>
            <button
              @click=${() => {
                void this._startOver();
              }}
            >
              Start over
            </button>
            <button
              @click=${() => {
                this._confirm = false;
              }}
            >
              Cancel
            </button>
          </div>`
        : nothing}
      ${state === "loading"
        ? html`<p class="muted">Reading what the cards noted…</p>`
        : "error" in state
          ? html`<div class="banner error" role="alert">Could not read what the cards noted: ${state.error}</div>`
          : this._renderDevices(state, zone)}
    </div>`;
  }

  private _renderDevices(state: { devices: CardLogDevice[]; copied?: boolean }, zone: string | undefined): TemplateResult {
    if (!state.devices.length) {
      return html`<p class="muted">No dashboard card has reported yet. Add a Reolink camera card to a dashboard and open it.</p>`;
    }
    const text = cardReport(state.devices, VERSION, zone);
    return html`${state.devices.map(
        (device) => html`<section class="device">
          <h2>${device.device}</h2>
          <p class="muted small">Last heard from ${lastHeard(device.updated, zone)}</p>
          <ul>
            ${summaryLines(summarize(device.events)).map((line) => html`<li>${line}</li>`)}
          </ul>
        </section>`,
      )}
      <details class="support">
        <summary>Every event${icon("chevronDown")}</summary>
        <div class="actions">
          <button
            @click=${() => {
              void copyText(text).then((ok) => {
                this._state = { ...state, copied: ok };
              });
            }}
          >
            ${state.copied === undefined ? "Copy report" : state.copied ? "Copied" : "Could not copy"}
          </button>
        </div>
        <pre class="report">${text}</pre>
      </details>`;
  }

  static override styles = [
    sharedStyles,
    css`
      :host {
        display: block;
      }
      .report-view {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .intro {
        margin: 0;
        font-size: 17px;
      }
      .device h2 {
        margin: 0;
        font-size: 18px;
      }
      .device p {
        margin: 2px 0 6px;
      }
      .device ul {
        margin: 0;
        padding-left: 20px;
      }
      .confirm {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px 12px;
      }
      .confirm span {
        flex: 1;
        min-width: 14em;
        font-weight: 500;
      }
      details.support {
        border-top: 2px solid var(--rv-rule-strong);
        padding-top: 6px;
      }
      details.support > .actions {
        margin: 6px 0 10px;
      }
    `,
  ];
}

/** When a device last reported, in Home Assistant's time zone. */
function lastHeard(updated: string, zone: string | undefined): string {
  const at = Date.parse(updated);
  return Number.isNaN(at) ? updated : formatStamp(at, zone);
}

if (!customElements.get("rv-card-report")) {
  customElements.define("rv-card-report", RvCardReport);
}

declare global {
  interface HTMLElementTagNameMap {
    "rv-card-report": RvCardReport;
  }
}

import { LitElement, css, html, nothing, type TemplateResult } from "lit";

import { fetchLiveSoak, startSoakOver, toError } from "../api";
import { copyText } from "../clipboard";
import { icon } from "../icons";
import { GRID_HOURS, SERVER_HOURS, soakReport, soakSummary, type SoakInput } from "../live/soak";
import { deviceLabel, soakTally } from "../live/soak-tally";
import type { InShort } from "../plain";
import { sharedStyles } from "../styles";
import type { HomeAssistant } from "../types";
import { VERSION } from "../version";
import "./findings";

/** Fired when the report's Close is pressed. */
export const SOAK_CLOSE_EVENT = "rv-live-soak-close";

type SoakState = "loading" | { text: string; summary: InShort; copied?: boolean } | { error: string };

/**
 * The soak report: the soak run the server keeps and its samples since the
 * run started (every sample kept, before a grid has reported; live/soak), as
 * text with a verdict per criterion. Shown over the grid, or on its own page
 * (#soak) on any device: the run outlives the page that counted it. Start
 * over begins a new run.
 */
export class RvLiveSoak extends LitElement {
  static override properties = {
    hass: { attribute: false },
    closable: { type: Boolean },
    _state: { state: true },
    _confirm: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  /** Shows Close (over the grid). */
  declare closable: boolean;
  declare _state: SoakState;
  /** Start over was pressed once: asks to confirm. */
  declare _confirm: boolean;

  constructor() {
    super();
    this.closable = false;
    this._state = "loading";
    this._confirm = false;
  }

  private _read = false;

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hass) void this.refresh();
  }

  protected override updated(): void {
    // Made before Home Assistant was set: read once it is.
    if (!this._read && this.hass) void this.refresh();
  }

  /** Send what this page counted, then read the run and make the report. */
  async refresh(): Promise<void> {
    const hass = this.hass;
    if (!hass) return;
    this._read = true;
    this._state = "loading";
    try {
      await soakTally.flush(hass);
      const soak = await fetchLiveSoak(hass);
      const input: SoakInput = {
        version: VERSION,
        now: Date.now(),
        sampleS: soak.sample_s,
        keepS: soak.keep_s,
        warmupS: soak.warmup_s,
        startedAt: soak.started_at,
        run: soak.run,
        samples: soak.now ? [...soak.samples, soak.now] : soak.samples,
      };
      this._state = { text: soakReport(input), summary: soakSummary(input) };
    } catch (err) {
      this._state = { error: toError(err).message };
    }
  }

  private async _startOver(): Promise<void> {
    const hass = this.hass;
    this._confirm = false;
    if (!hass) return;
    // What this page counted belongs to the run that ends.
    soakTally.discard();
    try {
      await startSoakOver(hass, deviceLabel(navigator.userAgent), soakTally.open);
      await this.refresh();
    } catch (err) {
      this._state = { error: toError(err).message };
    }
  }

  protected override render(): TemplateResult {
    const state = this._state;
    const text = typeof state === "object" && "text" in state ? state : undefined;
    return html`<div class="soak" role="region" aria-label="Soak report">
      <p class="intro">
        A day-long test of live view. Home Assistant keeps watch for ${SERVER_HOURS} hours, and the live board
        counts what happens whenever it is on screen: ${GRID_HOURS} hours in all, on any of your devices. It
        tells you whether live video kept playing, whether connections to your cameras piled up, and whether
        battery cameras slept when nobody watched.
      </p>
      ${state === "loading"
        ? html`<p class="muted">Reading the soak run…</p>`
        : "error" in state
          ? html`<div class="banner error" role="alert">Could not make the soak report: ${state.error}</div>`
          : html`<rv-findings .summary=${state.summary}></rv-findings>`}
      <div class="actions">
        <button
          class="with-icon"
          @click=${() => {
            void this.refresh();
          }}
        >
          ${icon("refresh")}Refresh
        </button>
        ${this._confirm
          ? nothing
          : html`<button
              @click=${() => {
                this._confirm = true;
              }}
            >
              Start over…
            </button>`}
        ${this.closable
          ? html`<button
              @click=${() => {
                this.dispatchEvent(new CustomEvent(SOAK_CLOSE_EVENT, { bubbles: true, composed: true }));
              }}
            >
              Close
            </button>`
          : nothing}
      </div>
      ${this._confirm
        ? html`<div class="banner warning confirm" role="alert">
            <span>Start the soak over? What was counted is dropped.</span>
            <button
              class="danger"
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
      ${text
        ? html`<details class="support">
            <summary>Details for support${icon("chevronDown")}</summary>
            <div class="actions">
              <button
                @click=${() => {
                  void copyText(text.text).then((ok) => {
                    this._state = { ...text, copied: ok };
                  });
                }}
              >
                ${text.copied === undefined ? "Copy report" : text.copied ? "Copied" : "Could not copy"}
              </button>
            </div>
            <pre class="report">${text.text}</pre>
          </details>`
        : nothing}
    </div>`;
  }

  static override styles = [
    sharedStyles,
    css`
      :host {
        display: block;
      }
      .soak {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .intro {
        margin: 0;
        font-size: 17px;
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
      .confirm button.danger {
        background: var(--rv-on-fault);
        border-color: var(--rv-on-fault);
        color: var(--rv-fault);
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

if (!customElements.get("rv-live-soak")) {
  customElements.define("rv-live-soak", RvLiveSoak);
}

declare global {
  interface HTMLElementTagNameMap {
    "rv-live-soak": RvLiveSoak;
  }
}

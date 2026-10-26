import { LitElement, css, html, nothing, type TemplateResult } from "lit";

import { fetchLiveSoak, startSoakOver, toError } from "../api";
import { copyText } from "../clipboard";
import { LIVE_CHECK_VERSION } from "../live/check";
import { SOAK_HOURS, soakReport } from "../live/soak";
import { deviceLabel, soakTally } from "../live/soak-tally";
import { sharedStyles } from "../styles";
import type { HomeAssistant } from "../types";

/** Fired when the report's Close is pressed. */
export const SOAK_CLOSE_EVENT = "rv-live-soak-close";

type SoakState =
  | "loading"
  | { text: string; copied?: boolean }
  | { none: true }
  | { error: string };

/**
 * The soak report: the soak run the server keeps and its samples since the
 * run started (live/soak), as text with a verdict per criterion. Shown over
 * the grid, or on its own page (#soak) on any device: the run outlives the
 * page that counted it. Start over begins a new run.
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
      const run = soak.run;
      this._state = run
        ? {
            text: soakReport({
              version: LIVE_CHECK_VERSION,
              now: Date.now(),
              sampleS: soak.sample_s,
              keepS: soak.keep_s,
              run,
              samples: [...soak.samples, soak.now],
            }),
          }
        : { none: true };
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
    return html`<div class="card" role="region" aria-label="Soak report">
      ${state === "loading"
        ? html`<p class="muted">Reading the soak run…</p>`
        : "error" in state
          ? html`<div class="banner error" role="alert">Could not make the soak report: ${state.error}</div>`
          : "none" in state
            ? html`<p class="muted">
                No soak yet. Open Watch live and leave the grid open and showing for ${SOAK_HOURS} hours;
                it reports what its tiles counted every minute, and this report reads it on any device.
              </p>`
            : html`<pre>${state.text}</pre>`}
      <div class="actions">
        ${text
          ? html`<button
              @click=${() => {
                void copyText(text.text).then((ok) => {
                  this._state = { ...text, copied: ok };
                });
              }}
            >
              ${text.copied === undefined ? "Copy" : text.copied ? "Copied" : "Could not copy"}
            </button>`
          : nothing}
        <button
          @click=${() => {
            void this.refresh();
          }}
        >
          Refresh
        </button>
        ${this._confirm
          ? html`<span class="confirm">
              Start the soak over? What was counted is dropped.
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
            </span>`
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
    </div>`;
  }

  static override styles = [
    sharedStyles,
    css`
      :host {
        display: block;
      }
      pre {
        margin: 0 0 8px;
        font-size: 12px;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        justify-content: flex-end;
        align-items: center;
      }
      .confirm {
        display: inline-flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
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

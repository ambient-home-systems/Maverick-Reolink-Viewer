import { LitElement, css, html, nothing, type TemplateResult } from "lit";

import { sharedStyles } from "../styles";
import type { UnusualEvent } from "../types";
import { NEUTRAL, termDirection, termName, termValue } from "../unusual";

/** A signal's contribution (nats) that fills its half of the bar. */
const FULL = 4;

/**
 * Why an event was marked unusual (Phase 8.3): its sentence, then each signal
 * with what it was and which way it pointed, and a bar either side of a centre
 * line (right: rarer than chance; left: more usual). The words carry it all;
 * the bars only show the sizes at a glance.
 */
export class RvUnusualReason extends LitElement {
  static override properties = {
    mark: { attribute: false },
  };

  declare mark: UnusualEvent | undefined;

  protected override render(): TemplateResult | typeof nothing {
    const mark = this.mark;
    if (!mark) return nothing;
    return html`<p class="sentence">${mark.reason}</p>
      <ul class="terms" aria-label="Each signal">
        ${mark.terms.map((term) => {
          const size = Math.abs(term.contribution);
          // As by chance: no bar, as the words say.
          const share = size > NEUTRAL ? Math.min(1, size / FULL) * 50 : 0;
          const side = term.contribution >= 0 ? "rarer" : "usual";
          return html`<li>
            <span class="name">${termName(term)}</span>
            <span class="value">${termValue(term)}</span>
            <span class="way">${termDirection(term)}</span>
            <span class="bar" aria-hidden="true">
              <span
                class="fill ${side}"
                style="width: ${share.toFixed(1)}%"
              ></span>
            </span>
          </li>`;
        })}
      </ul>`;
  }

  static override styles = [
    sharedStyles,
    css`
      :host {
        display: block;
      }
      .sentence {
        margin: 0 0 10px;
        font-size: 15px;
      }
      .terms {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        grid-template-columns:
          max-content minmax(0, max-content) max-content
          minmax(120px, 200px);
        justify-content: start;
        column-gap: 14px;
        row-gap: 6px;
        align-items: center;
        font-size: 14px;
      }
      li {
        display: contents;
      }
      .name {
        color: var(--rv-muted);
      }
      .value {
        overflow-wrap: anywhere;
      }
      .way {
        color: var(--rv-muted);
      }
      /* A centre line; a signal's bar grows right (rarer) or left (more usual). */
      .bar {
        position: relative;
        height: 10px;
        background: linear-gradient(
            var(--rv-rule-strong),
            var(--rv-rule-strong)
          )
          center / 1px 100% no-repeat;
      }
      .fill {
        position: absolute;
        top: 1px;
        bottom: 1px;
        background: var(--rv-text);
      }
      .fill.rarer {
        left: 50%;
        border-radius: 0 4px 4px 0;
      }
      .fill.usual {
        right: 50%;
        border-radius: 4px 0 0 4px;
        background: var(--rv-muted);
      }
      @container (max-width: 640px) {
        .terms {
          grid-template-columns: minmax(0, 1fr) minmax(80px, 120px);
          justify-content: stretch;
        }
        .name {
          grid-column: 1 / -1;
          margin-top: 4px;
        }
        .way {
          display: none;
        }
      }
    `,
  ];
}

if (!customElements.get("rv-unusual-reason")) {
  customElements.define("rv-unusual-reason", RvUnusualReason);
}

declare global {
  interface HTMLElementTagNameMap {
    "rv-unusual-reason": RvUnusualReason;
  }
}

import { LitElement, css, html, nothing, type TemplateResult } from "lit";

import { GRADE_MEANING, GRADE_WORD, type Grade, type InShort } from "../plain";
import { sharedStyles } from "../styles";

/**
 * A check's plain-language summary: its headline, then one ruled row per
 * finding with its grade as a word (as the board's tiles say what they are
 * doing), what was found and what to do about it.
 */
export class RvFindings extends LitElement {
  static override properties = {
    summary: { attribute: false },
  };

  declare summary: InShort | undefined;

  protected override render(): TemplateResult | typeof nothing {
    const summary = this.summary;
    if (!summary) return nothing;
    const order: Grade[] = ["good", "fine", "slow", "problem", "pending"];
    const used = order.filter((g) => summary.findings.some((f) => f.grade === g));
    return html`<p class="headline">${summary.headline}</p>
      ${summary.findings.length
        ? html`<ul>
            ${summary.findings.map(
              (f) => html`<li class=${f.grade}>
                <span class="grade">${GRADE_WORD[f.grade]}</span>
                <span class="what">
                  <span>${f.text}</span>
                  ${f.advice ? html`<span class="advice">${f.advice}</span>` : nothing}
                </span>
              </li>`,
            )}
          </ul>
          ${used.length > 1
            ? html`<p class="key">${used.map((g) => `${GRADE_WORD[g]}: ${GRADE_MEANING[g]}`).join(" · ")}</p>`
            : nothing}`
        : nothing}`;
  }

  static override styles = [
    sharedStyles,
    css`
      :host {
        display: block;
      }
      .headline {
        margin: 0 0 10px;
        max-width: none;
        font-family: var(--rv-font-cond);
        font-size: 22px;
        font-weight: 600;
        line-height: 1.2;
      }
      ul {
        list-style: none;
        margin: 0;
        padding: 0;
        border-top: 1px solid var(--rv-rule-strong);
      }
      li {
        display: grid;
        grid-template-columns: 86px minmax(0, 1fr);
        column-gap: 14px;
        align-items: baseline;
        padding: 10px 0;
        border-bottom: 1px solid var(--rv-rule);
        font-size: 16px;
      }
      .grade {
        justify-self: start;
        font-family: var(--rv-font-cond);
        font-size: 16px;
        font-weight: 600;
      }
      /* What needs a look stands out: a problem in the fault colour, slow ruled in it. */
      .problem .grade,
      .slow .grade {
        padding: 0 6px;
        border: 1.5px solid var(--rv-fault);
      }
      .problem .grade {
        background: var(--rv-fault);
        color: var(--rv-on-fault);
      }
      .slow .grade {
        color: var(--rv-fault-ink);
      }
      .note .grade,
      .pending .grade {
        color: var(--rv-muted);
      }
      .what {
        display: flex;
        flex-direction: column;
        gap: 3px;
        max-width: 72ch;
      }
      .advice {
        color: var(--rv-muted);
        font-size: 15px;
      }
      .key {
        margin: 8px 0 0;
        max-width: none;
        color: var(--rv-muted);
        font-size: 13px;
      }
      @media (max-width: 600px) {
        li {
          grid-template-columns: 72px minmax(0, 1fr);
          column-gap: 10px;
          font-size: 15px;
        }
        .headline {
          font-size: 20px;
        }
      }
    `,
  ];
}

if (!customElements.get("rv-findings")) {
  customElements.define("rv-findings", RvFindings);
}

declare global {
  interface HTMLElementTagNameMap {
    "rv-findings": RvFindings;
  }
}

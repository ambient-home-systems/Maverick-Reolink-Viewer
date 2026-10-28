// A problem in plain words: what happened, in bold, what to do, an action
// (Try again) and the technical text under Details, for support (Phase 4
// step 4). Its styles are `.problem` in sharedStyles.
import { html, nothing, type TemplateResult } from "lit";

import type { Explained } from "./live/explain";

export function problem(
  explained: Explained,
  technical?: string,
  options: { kind?: "error" | "warning"; action?: TemplateResult } = {},
): TemplateResult {
  return html`<div class="banner ${options.kind ?? "error"} problem" role="alert">
    <strong>${explained.text}</strong>${explained.advice ? html` ${explained.advice}` : nothing}
    ${options.action ?? nothing}
    ${technical
      ? html`<details>
          <summary>Details</summary>
          <span class="technical">${technical}</span>
        </details>`
      : nothing}
  </div>`;
}

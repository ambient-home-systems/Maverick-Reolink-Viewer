// A problem in plain words: what happened, in bold, what to do, an action
// (Try again), a link to more help in the docs, and the technical text under
// Details, for support (Phase 4 steps 4 and 7). Its styles are `.problem` in
// sharedStyles.
import { html, nothing, type TemplateResult } from "lit";

import { helpUrl, type HelpTopic } from "./help";
import { icon } from "./icons";
import type { Explained } from "./live/explain";

export function problem(
  explained: Explained,
  technical?: string,
  options: { kind?: "error" | "warning"; action?: TemplateResult; help?: HelpTopic } = {},
): TemplateResult {
  return html`<div class="banner ${options.kind ?? "error"} problem" role="alert">
    <strong>${explained.text}</strong>${explained.advice ? html` ${explained.advice}` : nothing}
    ${options.action ?? nothing} ${options.help ? helpLink(options.help) : nothing}
    ${technical
      ? html`<details>
          <summary>Details</summary>
          <span class="technical">${technical}</span>
        </details>`
      : nothing}
  </div>`;
}

/** "More help", opening the docs' section on `topic` in a new tab. */
export function helpLink(topic: HelpTopic, label = "More help"): TemplateResult {
  return html`<a class="help-link" href=${helpUrl(topic)} target="_blank" rel="noopener noreferrer"
    >${label}${icon("external")}</a
  >`;
}

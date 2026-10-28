// Drawn icons: one 24 × 24 grid, one stroke weight, rounded ends. Pictograms
// for the camera's detections, and the controls' glyphs.
import { html, svg, type TemplateResult } from "lit";

const PATHS = {
  person: svg`<circle cx="12" cy="7" r="3.2" /><path d="M5.5 20.5v-1.8a6.5 6.5 0 0 1 13 0v1.8" />`,
  visitor: svg`<path d="M6.2 16.5v-5.3a5.8 5.8 0 0 1 11.6 0v5.3l1.7 1.8H4.5z" /><path d="M10 21a2.1 2.1 0 0 0 4 0" />`,
  vehicle: svg`<path d="M3.5 16.5v-3.8l2.1-5a1.6 1.6 0 0 1 1.5-1h9.8a1.6 1.6 0 0 1 1.5 1l2.1 5v3.8z" /><path d="M3.8 12.5h16.4" /><circle cx="7.6" cy="16.6" r="1.9" /><circle cx="16.4" cy="16.6" r="1.9" />`,
  animal: svg`<circle cx="6.6" cy="10" r="1.7" /><circle cx="10" cy="6.4" r="1.7" /><circle cx="14" cy="6.4" r="1.7" /><circle cx="17.4" cy="10" r="1.7" /><path d="M8.3 17.6c0-3.1 1.7-5.6 3.7-5.6s3.7 2.5 3.7 5.6c0 1.6-1.3 2.1-2.3 1.7a3.7 3.7 0 0 0-2.8 0c-1 .4-2.3-.1-2.3-1.7z" />`,
  package: svg`<path d="M4 7.6 12 3.6l8 4v8.8l-8 4-8-4z" /><path d="m4 7.6 8 4 8-4M12 11.6v8.8M8 5.6l8 4" />`,
  motion: svg`<path d="M3 12.5h3.6l2.3-5.6 4.2 11 2.4-5.4H21" />`,
  picture: svg`<rect x="3.5" y="5.5" width="17" height="13" rx="1.5" /><circle cx="9" cy="10" r="1.6" /><path d="m4 17 5-4.5 3.5 3 3-2.5 4.5 4" />`,
  back: svg`<path d="M19 12H5.5M11 5.5 4.5 12l6.5 6.5" />`,
  chevron: svg`<path d="m9.5 5.5 6.5 6.5-6.5 6.5" />`,
  chevronBack: svg`<path d="m14.5 5.5-6.5 6.5 6.5 6.5" />`,
  chevronDown: svg`<path d="m5.5 9.5 6.5 6.5 6.5-6.5" />`,
  close: svg`<path d="M6 6l12 12M18 6 6 18" />`,
  info: svg`<circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" />`,
  enterFull: svg`<path d="M4.5 9V4.5H9M15 4.5h4.5V9M19.5 15v4.5H15M9 19.5H4.5V15" />`,
  exitFull: svg`<path d="M9 4.5V9H4.5M15 4.5V9h4.5M19.5 15H15v4.5M4.5 15H9v4.5" />`,
  play: svg`<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />`,
  pause: svg`<path d="M8.5 5.5v13M15.5 5.5v13" />`,
  previous: svg`<path d="M6 5.5v13M18.5 5.5 9 12l9.5 6.5z" />`,
  next: svg`<path d="M18 5.5v13M5.5 5.5 15 12l-9.5 6.5z" />`,
  plus: svg`<path d="M12 5v14M5 12h14" />`,
  minus: svg`<path d="M5 12h14" />`,
  refresh: svg`<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" /><path d="M19.5 4.5v4h-4" />`,
  download: svg`<path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14" />`,
  pip: svg`<rect x="3.5" y="5.5" width="17" height="13" rx="1.5" /><rect x="11.5" y="11.5" width="6" height="4.5" fill="currentColor" />`,
} as const;

export type IconName = keyof typeof PATHS;

/** An icon; the CSS sizes it (a button's is 20 px). */
export function icon(name: IconName): TemplateResult {
  return html`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${PATHS[name]}</svg>`;
}

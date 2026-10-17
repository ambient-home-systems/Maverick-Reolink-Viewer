import { LitElement, css, html, nothing, type TemplateResult } from "lit";

import { sharedStyles } from "../styles";
import type { TimelineEvent } from "../types";
import { formatClock, formatDuration } from "./time";
import { primaryType, typeColor, typeLabel } from "./timeline-math";

/** Show this many events at first; more on request. */
export const PAGE = 60;

/**
 * Event cards (newest first): thumbnail, types, time and duration. Clicking a
 * card plays it. Event: `rv-pick` ({event}); `rv-thumbs-needed` ({times})
 * asks the page for thumbnail URLs of the cards on show.
 */
export class RvEventList extends LitElement {
  static override properties = {
    events: { attribute: false },
    thumbs: { attribute: false },
    current: { attribute: false },
    timeZone: { attribute: false },
    _shown: { state: true },
  };

  declare events: TimelineEvent[];
  /** Thumbnail URL by event start time. */
  declare thumbs: ReadonlyMap<number, string>;
  declare current: number | undefined;
  declare timeZone: string | undefined;
  declare _shown: number;

  constructor() {
    super();
    this.events = [];
    this.thumbs = new Map();
    this._shown = PAGE;
  }

  /** The events on show, newest first. */
  get visible(): TimelineEvent[] {
    return [...this.events].reverse().slice(0, this._shown);
  }

  protected override updated(): void {
    const missing = this.visible.filter((e) => !this.thumbs.has(e.start)).map((e) => e.start);
    if (missing.length) {
      this.dispatchEvent(
        new CustomEvent("rv-thumbs-needed", { detail: { times: missing }, bubbles: true, composed: true }),
      );
    }
  }

  private _card(event: TimelineEvent): TemplateResult {
    const type = primaryType(event.types);
    const thumb = this.thumbs.get(event.start);
    const active = this.current !== undefined && this.current >= event.start && this.current < event.end;
    return html`<li>
      <button
        class="card ${active ? "active" : ""}"
        aria-label="${event.types.map(typeLabel).join(", ")} at ${formatClock(event.start, this.timeZone, true)}"
        @click=${() => {
          this.dispatchEvent(new CustomEvent("rv-pick", { detail: { event }, bubbles: true, composed: true }));
        }}
      >
        <span class="thumb" style="border-color: ${typeColor(type)}">
          ${thumb ? html`<img src=${thumb} alt="" loading="lazy" decoding="async" />` : nothing}
        </span>
        <span class="meta">
          <span class="types">
            ${event.types.map(
              (t) => html`<span class="badge" style="background: ${typeColor(t)}; color: white">${typeLabel(t)}</span>`,
            )}
          </span>
          <span class="when">
            ${formatClock(event.start, this.timeZone, true)}
            <span class="muted">· ${formatDuration(event.end - event.start)}</span>
            ${event.ambiguous
              ? html`<span class="muted" title="Recorded in the hour repeated when clocks went back"> · time ±1 h</span>`
              : nothing}
          </span>
        </span>
      </button>
    </li>`;
  }

  protected override render(): TemplateResult {
    if (!this.events.length) return html`<p class="muted">No events for the selected filters.</p>`;
    const rest = this.events.length - this._shown;
    return html`<ul>
        ${this.visible.map((e) => this._card(e))}
      </ul>
      ${rest > 0
        ? html`<button class="more" @click=${() => {
            this._shown += PAGE;
          }}>Show ${Math.min(rest, PAGE)} more (${rest} left)</button>`
        : nothing}`;
  }

  static override styles = [
    sharedStyles,
    css`
      ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 8px;
      }
      .card {
        display: flex;
        gap: 8px;
        width: 100%;
        padding: 6px;
        text-align: left;
        align-items: center;
      }
      .card.active {
        border-color: var(--primary-color);
        box-shadow: 0 0 0 1px var(--primary-color);
      }
      .thumb {
        flex: none;
        width: 96px;
        height: 54px;
        border-radius: 4px;
        border-left: 4px solid;
        background: var(--secondary-background-color, #eee);
        overflow: hidden;
      }
      .thumb img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .meta {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
      }
      .types {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }
      .when {
        font-size: 13px;
      }
      .more {
        margin-top: 8px;
      }
    `,
  ];
}

if (!customElements.get("rv-event-list")) {
  customElements.define("rv-event-list", RvEventList);
}

declare global {
  interface HTMLElementTagNameMap {
    "rv-event-list": RvEventList;
  }
}

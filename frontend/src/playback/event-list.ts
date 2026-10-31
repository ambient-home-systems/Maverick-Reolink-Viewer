import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from "lit";

import { eventLabel, formatLength, pictogram } from "../components/timetable";
import { icon } from "../icons";
import { sharedStyles } from "../styles";
import type { TimelineEvent } from "../types";
import { formatClock } from "./time";

/** Show this many events at first; more on request. */
export const PAGE = 60;

/**
 * The day's events as timetable rows (newest first): the time, what was seen,
 * how long and a thumbnail; the one playing is marked. Clicking a row plays
 * it. Event: `rv-pick` ({event}); `rv-thumbs-needed` ({times}) asks the page
 * for thumbnail URLs of the rows on show.
 */
export class RvEventList extends LitElement {
  static override properties = {
    events: { attribute: false },
    thumbs: { attribute: false },
    current: { attribute: false },
    playing: { attribute: false },
    timeZone: { attribute: false },
    _shown: { state: true },
  };

  declare events: TimelineEvent[];
  /** Thumbnail URL by event start time. */
  declare thumbs: ReadonlyMap<number, string>;
  declare current: number | undefined;
  /** A recording is loaded at `current` (else the row there is only selected). */
  declare playing: boolean;
  declare timeZone: string | undefined;
  declare _shown: number;

  constructor() {
    super();
    this.events = [];
    this.thumbs = new Map();
    this.playing = false;
    this._shown = PAGE;
  }

  /** The events on show, newest first. */
  get visible(): TimelineEvent[] {
    return [...this.events].reverse().slice(0, this._shown);
  }

  /** The start of the event at `current`, if one is (the row marked). */
  private _activeAt(at: number | undefined): number | undefined {
    if (at === undefined) return undefined;
    return this.events.find((e) => at >= e.start && at < e.end)?.start;
  }

  /**
   * Dragging the timeline moves `current` many times a second: the rows change
   * only when the marked event does.
   */
  protected override shouldUpdate(changed: PropertyValues<this>): boolean {
    if (changed.size !== 1 || !changed.has("current")) return true;
    const before = changed.get("current");
    return this._activeAt(before) !== this._activeAt(this.current);
  }

  protected override updated(): void {
    const missing = this.visible.filter((e) => !this.thumbs.has(e.start)).map((e) => e.start);
    if (missing.length) {
      this.dispatchEvent(
        new CustomEvent("rv-thumbs-needed", { detail: { times: missing }, bubbles: true, composed: true }),
      );
    }
  }

  private _row(event: TimelineEvent): TemplateResult {
    const thumb = this.thumbs.get(event.start);
    const active = this.current !== undefined && this.current >= event.start && this.current < event.end;
    const label = eventLabel(event.types);
    const clock = formatClock(event.start, this.timeZone, true);
    return html`<li>
      <button
        class="row ${active ? "active" : ""}"
        aria-current=${active ? "true" : "false"}
        @click=${() => {
          this.dispatchEvent(new CustomEvent("rv-pick", { detail: { event }, bubbles: true, composed: true }));
        }}
      >
        <span class="t">${clock.slice(0, -3)}<small>${clock.slice(-3)}</small></span>
        <span class="ev">
          ${icon(pictogram(event.types))}<span class="label">${label}</span>
        </span>
        <span class="meta">
          ${active ? html`<span class="tag">${this.playing ? "Playing" : "Selected"}</span>` : nothing}
          <span>${formatLength(event.end - event.start)}</span>
          ${event.ambiguous
            ? html`<span title="Recorded in the hour repeated when clocks went back">time ±1 h</span>`
            : nothing}
        </span>
        <span class="thumb">${thumb ? html`<img src=${thumb} alt="" loading="lazy" decoding="async" />` : nothing}</span>
      </button>
    </li>`;
  }

  protected override render(): TemplateResult {
    if (!this.events.length) return html`<p class="muted empty">No events for the chosen kinds.</p>`;
    const rest = this.events.length - this._shown;
    return html`<ol>
        ${this.visible.map((e) => this._row(e))}
      </ol>
      ${rest > 0
        ? html`<button class="text more" @click=${() => {
            this._shown += PAGE;
          }}>Show ${Math.min(rest, PAGE)} more (${rest} left)</button>`
        : nothing}`;
  }

  static override styles = [
    sharedStyles,
    css`
      :host {
        display: block;
      }
      ol {
        list-style: none;
        margin: 0;
        padding: 0;
        border-top: 1px solid var(--rv-rule-strong);
      }
      li {
        border-bottom: 1px solid var(--rv-rule);
      }
      .row {
        display: grid;
        grid-template-columns: 70px minmax(0, 1fr) 84px;
        grid-template-areas: "t ev thumb" "t meta thumb";
        column-gap: 12px;
        align-items: center;
        width: 100%;
        min-height: 62px;
        padding: 7px 4px;
        border: none;
        border-radius: 0;
        background: transparent;
        color: inherit;
        text-align: left;
        font-weight: 400;
      }
      .row:hover:not(:disabled) {
        background: var(--rv-ground-2);
      }
      .row:focus-visible {
        outline-offset: -2px;
      }
      .row.active {
        background: var(--rv-ground-2);
      }
      .t {
        grid-area: t;
        font-family: var(--rv-font-cond);
        font-size: 24px;
        font-weight: 600;
        line-height: 1;
        white-space: nowrap;
      }
      .t small {
        margin-left: 1px;
        color: var(--rv-muted);
        font-size: 14px;
        font-weight: 500;
      }
      .ev {
        grid-area: ev;
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        font-size: 15px;
        font-weight: 500;
      }
      .ev svg {
        flex: none;
        width: 18px;
        height: 18px;
      }
      .label {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .meta {
        grid-area: meta;
        display: flex;
        flex-wrap: wrap;
        gap: 0 10px;
        color: var(--rv-muted);
        font-size: 14px;
      }
      .tag {
        color: var(--rv-text);
        font-weight: 600;
      }
      .thumb {
        grid-area: thumb;
        width: 84px;
        height: 47px;
        background: var(--rv-ground-2);
        overflow: hidden;
      }
      .thumb img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .more {
        margin-top: 8px;
        padding-left: 0;
      }
      .empty {
        margin: 10px 0;
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

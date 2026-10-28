import { LitElement, css, html, nothing, type TemplateResult } from "lit";

import { icon } from "../icons";
import { sharedStyles } from "../styles";
import { addMonths, isoDate, monthGrid } from "./timeline-math";

const WEEKDAYS_FROM_SUNDAY = [0, 1, 2, 3, 4, 5, 6];

/**
 * A month of days, with a dot under each day that has recordings.
 * Events: `rv-month` ({year, month}) and `rv-day` ({date: YYYY-MM-DD}).
 */
export class RvCalendar extends LitElement {
  static override properties = {
    year: { type: Number },
    month: { type: Number },
    days: { attribute: false },
    selected: { attribute: false },
    today: { attribute: false },
    firstDay: { type: Number },
    loading: { type: Boolean },
  };

  declare year: number;
  declare month: number;
  /** Day numbers of this month that have recordings. */
  declare days: ReadonlySet<number>;
  declare selected: string | undefined;
  declare today: string | undefined;
  declare firstDay: number;
  declare loading: boolean;

  constructor() {
    super();
    const now = new Date();
    this.year = now.getFullYear();
    this.month = now.getMonth() + 1;
    this.days = new Set();
    this.firstDay = 1;
    this.loading = false;
  }

  private _emit(name: string, detail: object): void {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  private _move(delta: number): void {
    const [year, month] = addMonths(this.year, this.month, delta);
    this._emit("rv-month", { year, month });
  }

  protected override render(): TemplateResult {
    const title = new Date(Date.UTC(this.year, this.month - 1, 15)).toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
    const names = WEEKDAYS_FROM_SUNDAY.map((i) => (i + this.firstDay) % 7).map((weekday) =>
      // 2023-01-01 was a Sunday.
      new Date(Date.UTC(2023, 0, 1 + weekday)).toLocaleDateString(undefined, {
        weekday: "narrow",
        timeZone: "UTC",
      }),
    );
    const [nextYear, nextMonth] = addMonths(this.year, this.month, 1);
    const future = this.today !== undefined && isoDate(nextYear, nextMonth, 1) > this.today;
    return html`<div class="head">
        <button class="text" aria-label="Previous month" @click=${() => {
          this._move(-1);
        }}>${icon("chevronBack")}</button>
        <span class="title">${title}${this.loading ? html` <span class="muted small">…</span>` : nothing}</span>
        <button class="text" aria-label="Next month" ?disabled=${future} @click=${() => {
          this._move(1);
        }}>${icon("chevron")}</button>
      </div>
      <div class="grid" role="grid">
        ${names.map((n) => html`<span class="dow" role="columnheader">${n}</span>`)}
        ${monthGrid(this.year, this.month, this.firstDay)
          .flat()
          .map((day) => {
            if (day === null) return html`<span></span>`;
            const date = isoDate(this.year, this.month, day);
            const later = this.today !== undefined && date > this.today;
            const has = this.days.has(day);
            return html`<button
              role="gridcell"
              class="day ${date === this.selected ? "selected" : ""} ${date === this.today ? "today" : ""}"
              ?disabled=${later}
              aria-pressed=${date === this.selected ? "true" : "false"}
              aria-label="${date}${has ? ", has recordings" : ""}"
              @click=${() => {
                this._emit("rv-day", { date });
              }}
            >
              ${day}${has ? html`<span class="dot"></span>` : nothing}
            </button>`;
          })}
      </div>`;
  }

  static override styles = [
    sharedStyles,
    css`
      :host {
        display: block;
        min-width: 240px;
      }
      .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .title {
        font-weight: 500;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 2px;
        text-align: center;
      }
      .dow {
        font-size: 12px;
        color: var(--secondary-text-color);
        padding: 4px 0;
      }
      .day {
        position: relative;
        padding: 6px 0 10px;
        border: none;
        border-radius: 0;
        background: transparent;
      }
      .day.today {
        font-weight: 700;
      }
      /* The chosen day in ink, as a pressed chip; a day with recordings marked in their rail blue. */
      .day.selected {
        background: var(--rv-text);
        color: var(--rv-ground);
      }
      .dot {
        position: absolute;
        left: 50%;
        bottom: 3px;
        width: 5px;
        height: 5px;
        margin-left: -2.5px;
        background: var(--rv-recording);
      }
      .day.selected .dot {
        background: var(--rv-ground);
      }
    `,
  ];
}

if (!customElements.get("rv-calendar")) {
  customElements.define("rv-calendar", RvCalendar);
}

declare global {
  interface HTMLElementTagNameMap {
    "rv-calendar": RvCalendar;
  }
}

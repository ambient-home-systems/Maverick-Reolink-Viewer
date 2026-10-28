import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from "lit";

import { icon } from "../icons";
import { sharedStyles } from "../styles";
import { addMonths, isoDate, monthGrid } from "./timeline-math";

const WEEKDAYS_FROM_SUNDAY = [0, 1, 2, 3, 4, 5, 6];

/** Keys that move between days, and by how many days. */
const DAY_KEYS: Partial<Record<string, number>> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };

/**
 * A month of days, with a dot under each day that has recordings.
 * Events: `rv-month` ({year, month}) and `rv-day` ({date: YYYY-MM-DD}).
 *
 * For the keyboard it is one stop, a grid of days: the arrow keys move by a
 * day and a week, Home and End to the week's ends, Page Up and Page Down by a
 * month; Enter or Space picks the day.
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
    _focus: { state: true },
  };

  declare year: number;
  declare month: number;
  /** Day numbers of this month that have recordings. */
  declare days: ReadonlySet<number>;
  declare selected: string | undefined;
  declare today: string | undefined;
  declare firstDay: number;
  declare loading: boolean;
  /** The day the keyboard is on, in this month (its one tab stop). */
  declare _focus: number | undefined;
  /** A day to move the focus to once its month (YYYY-MM) shows. */
  private _focusAfter: { month: string; day: number } | undefined;

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

  /** The day holding the tab stop: the one moved to, else the chosen day, today or the 1st. */
  private _stop(length: number): number {
    const inMonth = (date: string | undefined) => (date?.startsWith(`${this._shown}-`) ? Number(date.slice(8)) : undefined);
    const day = this._focus ?? inMonth(this.selected) ?? inMonth(this.today) ?? 1;
    return Math.min(Math.max(day, 1), length);
  }

  private _onKey(event: KeyboardEvent, day: number): void {
    const date = new Date(Date.UTC(this.year, this.month - 1, day));
    const weekday = (date.getUTCDay() - (this.firstDay % 7) + 7) % 7;
    const length = new Date(Date.UTC(this.year, this.month, 0)).getUTCDate();
    let target: Date;
    if (DAY_KEYS[event.key] !== undefined) target = new Date(date.getTime() + (DAY_KEYS[event.key] ?? 0) * 86_400_000);
    else if (event.key === "Home") target = new Date(date.getTime() - weekday * 86_400_000);
    else if (event.key === "End") target = new Date(date.getTime() + (6 - weekday) * 86_400_000);
    else if (event.key === "PageUp" || event.key === "PageDown") {
      const [year, month] = addMonths(this.year, this.month, event.key === "PageUp" ? -1 : 1);
      const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
      target = new Date(Date.UTC(year, month - 1, Math.min(day, last)));
    } else return;
    event.preventDefault();
    const iso = target.toISOString().slice(0, 10);
    if (this.today !== undefined && iso > this.today) return; // days to come have nothing
    const months = (target.getUTCFullYear() - this.year) * 12 + target.getUTCMonth() + 1 - this.month;
    this._focusAfter = { month: iso.slice(0, 7), day: target.getUTCDate() };
    if (months) {
      this._move(months);
      return;
    }
    this._focus = Math.min(target.getUTCDate(), length);
  }

  private get _shown(): string {
    return isoDate(this.year, this.month, 1).slice(0, 7);
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    // Another month: the keyboard starts again from the day moved to, else its chosen day.
    if (changed.has("month") || changed.has("year")) {
      this._focus = this._focusAfter?.month === this._shown ? this._focusAfter.day : undefined;
    }
  }

  protected override updated(): void {
    const after = this._focusAfter;
    if (after?.month !== this._shown) return;
    this._focusAfter = undefined;
    this.renderRoot.querySelector<HTMLButtonElement>(`button[data-day="${String(after.day)}"]`)?.focus();
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
    const longNames = WEEKDAYS_FROM_SUNDAY.map((i) => (i + this.firstDay) % 7).map((weekday) =>
      new Date(Date.UTC(2023, 0, 1 + weekday)).toLocaleDateString(undefined, { weekday: "long", timeZone: "UTC" }),
    );
    const stop = this._stop(new Date(Date.UTC(this.year, this.month, 0)).getUTCDate());
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
      <div class="grid" role="grid" aria-label=${title}>
        <div class="week" role="row">
          ${names.map((n, i) => html`<span class="dow" role="columnheader" aria-label=${longNames[i] ?? n}>${n}</span>`)}
        </div>
        ${monthGrid(this.year, this.month, this.firstDay).map(
          (week) => html`<div class="week" role="row">
            ${week.map((day) => {
              if (day === null) return html`<span role="gridcell"></span>`;
              const date = isoDate(this.year, this.month, day);
              const later = this.today !== undefined && date > this.today;
              const has = this.days.has(day);
              const name = new Date(Date.UTC(this.year, this.month - 1, day)).toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
                timeZone: "UTC",
              });
              return html`<button
                role="gridcell"
                data-day=${day}
                class="day ${date === this.selected ? "selected" : ""} ${date === this.today ? "today" : ""}"
                tabindex=${day === stop ? "0" : "-1"}
                ?disabled=${later}
                aria-selected=${date === this.selected ? "true" : "false"}
                aria-current=${date === this.today ? "date" : nothing}
                aria-label="${name}${has ? ", has recordings" : ""}"
                @click=${() => {
                  this._focus = day;
                  this._emit("rv-day", { date });
                }}
                @keydown=${(e: KeyboardEvent) => {
                  this._onKey(e, day);
                }}
              >
                ${day}${has ? html`<span class="dot"></span>` : nothing}
              </button>`;
            })}
          </div>`,
        )}
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
        display: flex;
        flex-direction: column;
        gap: 2px;
        text-align: center;
      }
      .week {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 2px;
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

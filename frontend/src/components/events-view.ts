import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from "lit";

import { fetchEventDays } from "../api";
import { icon } from "../icons";
import "../playback/calendar";
import { dateIn, firstDayOfWeek } from "../playback/time";
import { shownTypes, sortTypes, typeLabel } from "../playback/timeline-math";
import { sharedStyles } from "../styles";
import type { HomeAssistant, RecentEvents } from "../types";
import type { BoardCamera } from "./live-grid";
import { navigate } from "./navigation";
import { pictogram } from "./timetable";
import "./timetable";

/**
 * Reolink → Events: any day's events across cameras, every one, as a
 * timetable. A day picker (the day before and after, and a calendar with the
 * days that have recordings), and filters by camera and by what was seen.
 */
export class RvEvents extends LitElement {
  static override properties = {
    hass: { attribute: false },
    cameras: { attribute: false },
    date: { attribute: false },
    _feed: { state: true },
    _calendar: { state: true },
    _month: { state: true },
    _days: { state: true },
    _daysLoading: { state: true },
    _cameraFilter: { state: true },
    _typeFilter: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  /** The board's cameras, numbered. */
  declare cameras: BoardCamera[];
  /** The day shown (YYYY-MM-DD); undefined: today. */
  declare date: string | undefined;
  declare _feed: RecentEvents | undefined;
  /** The calendar is open. */
  declare _calendar: boolean;
  declare _month: { year: number; month: number } | undefined;
  /** Days of `_month` with recordings on any camera. */
  declare _days: ReadonlySet<number>;
  declare _daysLoading: boolean;
  declare _cameraFilter: ReadonlySet<string>;
  declare _typeFilter: ReadonlySet<string>;

  private _monthSeq = 0;

  constructor() {
    super();
    this.cameras = [];
    this._calendar = false;
    this._days = new Set();
    this._daysLoading = false;
    this._cameraFilter = new Set();
    this._typeFilter = new Set();
  }

  private get _zone(): string | undefined {
    return this.hass?.config?.time_zone;
  }

  private get _today(): string {
    return dateIn(Date.now(), this._zone);
  }

  /** The day shown. */
  private get _day(): string {
    return this.date ?? this._today;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has("date")) this._feed = undefined;
    if ((changed.has("date") || changed.has("hass")) && this.hass) {
      const [year, month] = this._day.split("-").map(Number);
      if (year && month && (this._month?.year !== year || this._month.month !== month)) {
        void this._loadMonth(year, month);
      }
    }
  }

  private async _loadMonth(year: number, month: number): Promise<void> {
    const hass = this.hass;
    if (!hass) return;
    const seq = ++this._monthSeq;
    this._month = { year, month };
    this._daysLoading = true;
    try {
      const { days } = await fetchEventDays(hass, year, month);
      if (seq === this._monthSeq) this._days = new Set(days);
    } catch {
      if (seq === this._monthSeq) this._days = new Set();
    } finally {
      if (seq === this._monthSeq) this._daysLoading = false;
    }
  }

  /** Show a day (today has no date in the URL). */
  private _go(date: string): void {
    this._calendar = false;
    navigate(this, date >= this._today ? { view: "events" } : { view: "events", date });
  }

  private _shift(delta: number): void {
    const [y, m, d] = this._day.split("-").map(Number);
    if (!y || !m || !d) return;
    this._go(new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10));
  }

  private _toggle<T>(set: ReadonlySet<T>, value: T): ReadonlySet<T> {
    const next = new Set(set);
    if (!next.delete(value)) next.add(value);
    return next;
  }

  protected override render(): TemplateResult {
    const day = this._day;
    const today = day === this._today;
    const label = dayLabel(day);
    return html`<div class="head">
        <h1>Events</h1>
        <div class="day-nav" role="group" aria-label="Day">
          <button class="step" aria-label="The day before" @click=${() => {
            this._shift(-1);
          }}>${icon("chevronBack")}</button>
          <button
            class="pick"
            aria-expanded=${this._calendar ? "true" : "false"}
            aria-label="${today ? "Today, " : ""}${label}: pick a day"
            @click=${() => {
              this._calendar = !this._calendar;
            }}
          >
            ${today ? "Today" : shortDay(day)}${icon("chevronDown")}
          </button>
          <button class="step" aria-label="The day after" ?disabled=${today} @click=${() => {
            this._shift(1);
          }}>${icon("chevron")}</button>
          ${today
            ? nothing
            : html`<button class="text" @click=${() => {
                this._go(this._today);
              }}>Today</button>`}
        </div>
      </div>
      ${this._calendar && this._month ? this._renderCalendar(day) : nothing}
      ${this._renderFilters()}
      <rv-timetable
        .hass=${this.hass}
        .cameras=${this.cameras}
        .date=${this.date}
        .heading=${today ? "Today" : label}
        .limit=${Number.POSITIVE_INFINITY}
        .cameraFilter=${this._cameraFilter}
        .typeFilter=${this._typeFilter}
        @rv-timetable-feed=${(e: CustomEvent<{ feed: RecentEvents }>) => {
          this._feed = e.detail.feed;
        }}
      ></rv-timetable>`;
  }

  private _renderCalendar(day: string): TemplateResult {
    const month = this._month ?? { year: 0, month: 0 };
    return html`<div class="calendar">
      <rv-calendar
        .year=${month.year}
        .month=${month.month}
        .days=${this._days}
        .selected=${day}
        .today=${this._today}
        .firstDay=${firstDayOfWeek(this.hass?.locale?.language)}
        ?loading=${this._daysLoading}
        @rv-month=${(e: CustomEvent<{ year: number; month: number }>) => void this._loadMonth(e.detail.year, e.detail.month)}
        @rv-day=${(e: CustomEvent<{ date: string }>) => {
          this._go(e.detail.date);
        }}
      ></rv-calendar>
    </div>`;
  }

  /** Cameras and kinds of event in the day, to show only some. */
  private _renderFilters(): TemplateResult | typeof nothing {
    const events = this._feed?.events ?? [];
    const present = new Set(events.map((e) => e.camera_id));
    const cameras = this.cameras.filter((c) => present.has(c.id) || this._cameraFilter.has(c.id));
    const types = [...new Set([...events.flatMap((e) => shownTypes(e.types)), ...this._typeFilter])];
    if (!cameras.length && !types.length) return nothing;
    const any = this._cameraFilter.size > 0 || this._typeFilter.size > 0;
    return html`<div class="filters">
      ${cameras.length
        ? html`<div class="group" role="group" aria-label="Cameras">
            <span class="label">Cameras</span>
            ${cameras.map(
              (c) => html`<button
                class="chip"
                aria-pressed=${this._cameraFilter.has(c.id) ? "true" : "false"}
                @click=${() => {
                  this._cameraFilter = this._toggle(this._cameraFilter, c.id);
                }}
              >
                <span class="plat" aria-hidden="true">${c.number}</span>${c.name}
              </button>`,
            )}
          </div>`
        : nothing}
      ${types.length
        ? html`<div class="group" role="group" aria-label="What was seen">
            <span class="label">Seen</span>
            ${sortTypes(types).map(
              (t) => html`<button
                class="chip"
                aria-pressed=${this._typeFilter.has(t) ? "true" : "false"}
                @click=${() => {
                  this._typeFilter = this._toggle(this._typeFilter, t);
                }}
              >
                ${icon(pictogram([t]))}${typeLabel(t)}
              </button>`,
            )}
          </div>`
        : nothing}
      ${any
        ? html`<button class="text clear" @click=${() => {
            this._cameraFilter = new Set();
            this._typeFilter = new Set();
          }}>Show every event</button>`
        : nothing}
    </div>`;
  }

  static override styles = [
    sharedStyles,
    css`
      :host {
        display: block;
      }
      .head {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px 24px;
        padding: 20px 24px 14px;
      }
      h1 {
        margin: 0;
        font-family: var(--rv-font-cond);
        font-size: 28px;
        font-weight: 600;
        line-height: 1.1;
      }
      .day-nav {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .step {
        width: 36px;
        padding: 0;
        display: grid;
        place-items: center;
      }
      .pick {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 4px 10px 4px 14px;
        font-family: var(--rv-font-cond);
        font-size: 19px;
        font-weight: 600;
      }
      .pick svg {
        width: 18px;
        height: 18px;
      }
      .calendar {
        padding: 0 24px 14px;
      }
      rv-calendar {
        display: block;
        max-width: 340px;
      }
      .filters {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
        padding: 0 24px 6px;
      }
      .group {
        display: flex;
        align-items: center;
        gap: 6px;
        max-width: 100%;
        overflow-x: auto;
        scrollbar-width: none;
      }
      .label {
        flex: none;
        width: 64px;
        color: var(--rv-muted);
        font-size: 13px;
        font-weight: 500;
      }
      .chip {
        flex: none;
        display: inline-flex;
        align-items: center;
        gap: 7px;
        min-height: 34px;
        padding: 0 12px 0 5px;
        border: 1px solid var(--rv-rule);
        font-size: 15px;
        font-weight: 500;
        white-space: nowrap;
      }
      .chip svg {
        width: 18px;
        height: 18px;
        margin-left: 4px;
      }
      .chip[aria-pressed="true"] {
        background: var(--rv-text);
        border-color: var(--rv-text);
        color: var(--rv-ground);
      }
      .chip[aria-pressed="true"]:hover {
        background: var(--rv-text);
      }
      .plat {
        min-width: 22px;
        height: 22px;
        padding: 0 3px;
        box-sizing: border-box;
        display: grid;
        place-items: center;
        background: var(--rv-platform);
        color: var(--rv-on-rail);
        font-family: var(--rv-font-cond);
        font-size: 14px;
        font-weight: 600;
        line-height: 1;
      }
      .clear {
        padding-left: 0;
      }
      @media (max-width: 600px) {
        .head {
          padding: 14px 12px 10px;
        }
        .calendar,
        .filters {
          padding-left: 12px;
          padding-right: 12px;
        }
        h1 {
          font-size: 24px;
        }
        .label {
          width: auto;
          margin-right: 4px;
        }
      }
    `,
  ];
}

/** "Tuesday 27 October" (a calendar date, not a time: no time zone shift). */
export function dayLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

/** "Tue 27 Oct". */
export function shortDay(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

if (!customElements.get("rv-events")) {
  customElements.define("rv-events", RvEvents);
}

declare global {
  interface HTMLElementTagNameMap {
    "rv-events": RvEvents;
  }
}

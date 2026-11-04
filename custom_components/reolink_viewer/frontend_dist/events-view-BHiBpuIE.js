import { a as e, n as t, r as n, t as r } from "./lit-DdRjbP0M.js";
import { X as i, c as a, it as o, j as s, u as c } from "./live-13uUozrt.js";
import { B as l, D as u, O as d, P as f, b as p, h as m, u as h, x as g } from "./home-C5UYFJa8.js";
//#region src/playback/calendar.ts
var _ = [
	0,
	1,
	2,
	3,
	4,
	5,
	6
], v = {
	ArrowLeft: -1,
	ArrowRight: 1,
	ArrowUp: -7,
	ArrowDown: 7
}, y = class extends r {
	static properties = {
		year: { type: Number },
		month: { type: Number },
		days: { attribute: !1 },
		selected: { attribute: !1 },
		today: { attribute: !1 },
		firstDay: { type: Number },
		loading: { type: Boolean },
		_focus: { state: !0 }
	};
	_focusAfter;
	constructor() {
		super();
		let e = /* @__PURE__ */ new Date();
		this.year = e.getFullYear(), this.month = e.getMonth() + 1, this.days = /* @__PURE__ */ new Set(), this.firstDay = 1, this.loading = !1;
	}
	_emit(e, t) {
		this.dispatchEvent(new CustomEvent(e, {
			detail: t,
			bubbles: !0,
			composed: !0
		}));
	}
	_move(e) {
		let [t, n] = m(this.year, this.month, e);
		this._emit("rv-month", {
			year: t,
			month: n
		});
	}
	_stop(e) {
		let t = (e) => e?.startsWith(`${this._shown}-`) ? Number(e.slice(8)) : void 0, n = this._focus ?? t(this.selected) ?? t(this.today) ?? 1;
		return Math.min(Math.max(n, 1), e);
	}
	_onKey(e, t) {
		let n = new Date(Date.UTC(this.year, this.month - 1, t)), r = (n.getUTCDay() - this.firstDay % 7 + 7) % 7, i = new Date(Date.UTC(this.year, this.month, 0)).getUTCDate(), a;
		if (v[e.key] !== void 0) a = new Date(n.getTime() + (v[e.key] ?? 0) * 864e5);
		else if (e.key === "Home") a = /* @__PURE__ */ new Date(n.getTime() - r * 864e5);
		else if (e.key === "End") a = new Date(n.getTime() + (6 - r) * 864e5);
		else if (e.key === "PageUp" || e.key === "PageDown") {
			let [n, r] = m(this.year, this.month, e.key === "PageUp" ? -1 : 1), i = new Date(Date.UTC(n, r, 0)).getUTCDate();
			a = new Date(Date.UTC(n, r - 1, Math.min(t, i)));
		} else return;
		e.preventDefault();
		let o = a.toISOString().slice(0, 10);
		if (this.today !== void 0 && o > this.today) return;
		let s = (a.getUTCFullYear() - this.year) * 12 + a.getUTCMonth() + 1 - this.month;
		this._focusAfter = {
			month: o.slice(0, 7),
			day: a.getUTCDate()
		}, s ? this._move(s) : this._focus = Math.min(a.getUTCDate(), i);
	}
	get _shown() {
		return p(this.year, this.month, 1).slice(0, 7);
	}
	willUpdate(e) {
		(e.has("month") || e.has("year")) && (this._focus = this._focusAfter?.month === this._shown ? this._focusAfter.day : void 0);
	}
	updated() {
		let e = this._focusAfter;
		e?.month === this._shown && (this._focusAfter = void 0, this.renderRoot.querySelector(`button[data-day="${String(e.day)}"]`)?.focus());
	}
	render() {
		let e = new Date(Date.UTC(this.year, this.month - 1, 15)).toLocaleDateString(void 0, {
			month: "long",
			year: "numeric",
			timeZone: "UTC"
		}), r = _.map((e) => (e + this.firstDay) % 7).map((e) => new Date(Date.UTC(2023, 0, 1 + e)).toLocaleDateString(void 0, {
			weekday: "narrow",
			timeZone: "UTC"
		})), a = _.map((e) => (e + this.firstDay) % 7).map((e) => new Date(Date.UTC(2023, 0, 1 + e)).toLocaleDateString(void 0, {
			weekday: "long",
			timeZone: "UTC"
		})), o = this._stop(new Date(Date.UTC(this.year, this.month, 0)).getUTCDate()), [s, c] = m(this.year, this.month, 1), l = this.today !== void 0 && p(s, c, 1) > this.today;
		return n`<div class="head">
        <button class="text" aria-label="Previous month" @click=${() => {
			this._move(-1);
		}}>${i("chevronBack")}</button>
        <span class="title">${e}${this.loading ? n` <span class="muted small">…</span>` : t}</span>
        <button class="text" aria-label="Next month" ?disabled=${l} @click=${() => {
			this._move(1);
		}}>${i("chevron")}</button>
      </div>
      <div class="grid" role="grid" aria-label=${e}>
        <div class="week" role="row">
          ${r.map((e, t) => n`<span class="dow" role="columnheader" aria-label=${a[t] ?? e}>${e}</span>`)}
        </div>
        ${g(this.year, this.month, this.firstDay).map((e) => n`<div class="week" role="row">
            ${e.map((e) => {
			if (e === null) return n`<span role="gridcell"></span>`;
			let r = p(this.year, this.month, e), i = this.today !== void 0 && r > this.today, a = this.days.has(e), s = new Date(Date.UTC(this.year, this.month - 1, e)).toLocaleDateString(void 0, {
				weekday: "long",
				month: "long",
				day: "numeric",
				timeZone: "UTC"
			});
			return n`<button
                role="gridcell"
                data-day=${e}
                class="day ${r === this.selected ? "selected" : ""} ${r === this.today ? "today" : ""}"
                tabindex=${e === o ? "0" : "-1"}
                ?disabled=${i}
                aria-selected=${r === this.selected ? "true" : "false"}
                aria-current=${r === this.today ? "date" : t}
                aria-label="${s}${a ? ", has recordings" : ""}"
                @click=${() => {
				this._focus = e, this._emit("rv-day", { date: r });
			}}
                @keydown=${(t) => {
				this._onKey(t, e);
			}}
              >
                ${e}${a ? n`<span class="dot"></span>` : t}
              </button>`;
		})}
          </div>`)}
      </div>`;
	}
	static styles = [s, e`
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
    `];
};
customElements.get("rv-calendar") || customElements.define("rv-calendar", y);
//#endregion
//#region src/components/events-view.ts
var b = class extends r {
	static properties = {
		hass: { attribute: !1 },
		cameras: { attribute: !1 },
		date: { attribute: !1 },
		_feed: { state: !0 },
		_calendar: { state: !0 },
		_month: { state: !0 },
		_days: { state: !0 },
		_daysLoading: { state: !0 },
		_cameraFilter: { state: !0 },
		_typeFilter: { state: !0 },
		_unusualOnly: { state: !0 },
		_marks: { state: !0 }
	};
	_monthSeq = 0;
	constructor() {
		super(), this.cameras = [], this._calendar = !1, this._days = /* @__PURE__ */ new Set(), this._daysLoading = !1, this._cameraFilter = /* @__PURE__ */ new Set(), this._typeFilter = /* @__PURE__ */ new Set(), this._unusualOnly = !1;
	}
	get _zone() {
		return this.hass?.config?.time_zone;
	}
	get _today() {
		return a(Date.now(), this._zone);
	}
	get _day() {
		return this.date ?? this._today;
	}
	willUpdate(e) {
		if (e.has("date") && (this._feed = void 0), (e.has("date") || e.has("hass")) && this.hass) {
			let [e, t] = this._day.split("-").map(Number);
			e && t && (this._month?.year !== e || this._month.month !== t) && this._loadMonth(e, t);
		}
	}
	async _loadMonth(e, t) {
		let n = this.hass;
		if (!n) return;
		let r = ++this._monthSeq;
		this._month = {
			year: e,
			month: t
		}, this._daysLoading = !0;
		try {
			let { days: i } = await o(n, e, t);
			r === this._monthSeq && (this._days = new Set(i));
		} catch {
			r === this._monthSeq && (this._days = /* @__PURE__ */ new Set());
		} finally {
			r === this._monthSeq && (this._daysLoading = !1);
		}
	}
	_go(e) {
		this._calendar = !1, l(this, e >= this._today ? { view: "events" } : {
			view: "events",
			date: e
		});
	}
	_shift(e) {
		let [t, n, r] = this._day.split("-").map(Number);
		t && n && r && this._go(new Date(Date.UTC(t, n - 1, r + e)).toISOString().slice(0, 10));
	}
	_toggle(e, t) {
		let n = new Set(e);
		return n.delete(t) || n.add(t), n;
	}
	render() {
		let e = this._day, r = e === this._today, a = C(e);
		return n`<div class="head">
        <h1>Events</h1>
        <div class="day-nav" role="group" aria-label="Day">
          <button
            class="step"
            aria-label="The day before"
            @click=${() => {
			this._shift(-1);
		}}
          >
            ${i("chevronBack")}
          </button>
          <button
            class="pick"
            aria-expanded=${this._calendar ? "true" : "false"}
            aria-label="${r ? "Today, " : ""}${a}: pick a day"
            @click=${() => {
			this._calendar = !this._calendar;
		}}
          >
            ${r ? "Today" : w(e)}${i("chevronDown")}
          </button>
          <button
            class="step"
            aria-label="The day after"
            ?disabled=${r}
            @click=${() => {
			this._shift(1);
		}}
          >
            ${i("chevron")}
          </button>
          ${r ? t : n`<button
                class="text"
                @click=${() => {
			this._go(this._today);
		}}
              >
                Today
              </button>`}
        </div>
      </div>
      ${this._calendar && this._month ? this._renderCalendar(e) : t}
      ${this._renderFilters()}
      <rv-timetable
        .hass=${this.hass}
        .cameras=${this.cameras}
        .date=${this.date}
        .heading=${r ? "Today" : a}
        .limit=${Infinity}
        .cameraFilter=${this._cameraFilter}
        .typeFilter=${this._typeFilter}
        .unusualOnly=${this._unusualOnly}
        @rv-timetable-feed=${(e) => {
			this._feed = e.detail.feed;
		}}
        @rv-timetable-marks=${(e) => {
			this._marks = e.detail.marks;
		}}
      ></rv-timetable>`;
	}
	_renderCalendar(e) {
		let t = this._month ?? {
			year: 0,
			month: 0
		};
		return n`<div class="calendar">
      <rv-calendar
        .year=${t.year}
        .month=${t.month}
        .days=${this._days}
        .selected=${e}
        .today=${this._today}
        .firstDay=${c(this.hass?.locale?.language)}
        ?loading=${this._daysLoading}
        @rv-month=${(e) => void this._loadMonth(e.detail.year, e.detail.month)}
        @rv-day=${(e) => {
			this._go(e.detail.date);
		}}
      ></rv-calendar>
    </div>`;
	}
	_renderFilters() {
		let e = this._feed?.events ?? [], r = new Set(e.map((e) => e.camera_id)), a = this.cameras.filter((e) => r.has(e.id) || this._cameraFilter.has(e.id)), o = [.../* @__PURE__ */ new Set([...e.flatMap((e) => u(e.types)), ...this._typeFilter])], s = this._marks?.enabled ? this._marks : void 0;
		if (!a.length && !o.length && !s) return t;
		let c = this._cameraFilter.size > 0 || this._typeFilter.size > 0 || this._unusualOnly;
		return n`<div class="filters">
      ${a.length ? n`<div class="group" role="group" aria-label="Cameras">
            <span class="label">Cameras</span>
            ${a.map((e) => n`<button
                  class="chip"
                  aria-pressed=${this._cameraFilter.has(e.id) ? "true" : "false"}
                  @click=${() => {
			this._cameraFilter = this._toggle(this._cameraFilter, e.id);
		}}
                >
                  <span class="plat" aria-hidden="true">${e.number}</span
                  >${e.name}
                </button>`)}
          </div>` : t}
      ${o.length ? n`<div class="group" role="group" aria-label="What was detected">
            <span class="label">Detected</span>
            ${d(o).map((e) => n`<button
                  class="chip"
                  aria-pressed=${this._typeFilter.has(e) ? "true" : "false"}
                  @click=${() => {
			this._typeFilter = this._toggle(this._typeFilter, e);
		}}
                >
                  ${i(h([e]))}${f(e)}
                </button>`)}
          </div>` : t}
      ${s ? this._renderUnusual(s) : t}
      ${c ? n`<button
            class="text clear"
            @click=${() => {
			this._cameraFilter = /* @__PURE__ */ new Set(), this._typeFilter = /* @__PURE__ */ new Set(), this._unusualOnly = !1;
		}}
          >
            Show every event
          </button>` : t}
    </div>`;
	}
	_renderUnusual(e) {
		let t = e.built !== !1 && Object.values(e.cameras).some((e) => e.marking);
		return n`<div class="group" role="group" aria-label="Unusual events">
      <span class="label">Marked</span>
      ${t ? n`<button
            class="chip plain"
            aria-pressed=${this._unusualOnly ? "true" : "false"}
            @click=${() => {
			this._unusualOnly = !this._unusualOnly;
		}}
          >
            Unusual
          </button>` : n`<button class="chip plain" disabled>Learning…</button>`}
    </div>`;
	}
	static styles = [s, e`
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
      .chip.plain {
        padding: 0 12px;
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
    `];
}, x = new Intl.DateTimeFormat(void 0, {
	weekday: "long",
	day: "numeric",
	month: "long",
	timeZone: "UTC"
}), S = new Intl.DateTimeFormat(void 0, {
	weekday: "short",
	day: "numeric",
	month: "short",
	timeZone: "UTC"
});
function C(e) {
	return x.format(/* @__PURE__ */ new Date(`${e}T00:00:00Z`));
}
function w(e) {
	return S.format(/* @__PURE__ */ new Date(`${e}T00:00:00Z`));
}
customElements.get("rv-events") || customElements.define("rv-events", b);
//#endregion
export { b as RvEvents, C as dayLabel, w as shortDay };

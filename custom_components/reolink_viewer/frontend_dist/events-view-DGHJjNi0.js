import { E as e, Et as t, F as n, Jt as r, M as i, T as a, U as o, W as s, Xt as c, Yt as l, bt as u, it as d, l as f, p, qt as m, v as h, y as g } from "./home-kUcGXot0.js";
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
}, y = class extends m {
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
		let [t, n] = p(this.year, this.month, e);
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
			let [n, r] = p(this.year, this.month, e.key === "PageUp" ? -1 : 1), i = new Date(Date.UTC(n, r, 0)).getUTCDate();
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
		return h(this.year, this.month, 1).slice(0, 7);
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
		}), t = _.map((e) => (e + this.firstDay) % 7).map((e) => new Date(Date.UTC(2023, 0, 1 + e)).toLocaleDateString(void 0, {
			weekday: "narrow",
			timeZone: "UTC"
		})), n = _.map((e) => (e + this.firstDay) % 7).map((e) => new Date(Date.UTC(2023, 0, 1 + e)).toLocaleDateString(void 0, {
			weekday: "long",
			timeZone: "UTC"
		})), i = this._stop(new Date(Date.UTC(this.year, this.month, 0)).getUTCDate()), [a, o] = p(this.year, this.month, 1), s = this.today !== void 0 && h(a, o, 1) > this.today;
		return l`<div class="head">
        <button class="text" aria-label="Previous month" @click=${() => {
			this._move(-1);
		}}>${u("chevronBack")}</button>
        <span class="title">${e}${this.loading ? l` <span class="muted small">…</span>` : r}</span>
        <button class="text" aria-label="Next month" ?disabled=${s} @click=${() => {
			this._move(1);
		}}>${u("chevron")}</button>
      </div>
      <div class="grid" role="grid" aria-label=${e}>
        <div class="week" role="row">
          ${t.map((e, t) => l`<span class="dow" role="columnheader" aria-label=${n[t] ?? e}>${e}</span>`)}
        </div>
        ${g(this.year, this.month, this.firstDay).map((e) => l`<div class="week" role="row">
            ${e.map((e) => {
			if (e === null) return l`<span role="gridcell"></span>`;
			let t = h(this.year, this.month, e), n = this.today !== void 0 && t > this.today, a = this.days.has(e), o = new Date(Date.UTC(this.year, this.month - 1, e)).toLocaleDateString(void 0, {
				weekday: "long",
				month: "long",
				day: "numeric",
				timeZone: "UTC"
			});
			return l`<button
                role="gridcell"
                data-day=${e}
                class="day ${t === this.selected ? "selected" : ""} ${t === this.today ? "today" : ""}"
                tabindex=${e === i ? "0" : "-1"}
                ?disabled=${n}
                aria-selected=${t === this.selected ? "true" : "false"}
                aria-current=${t === this.today ? "date" : r}
                aria-label="${o}${a ? ", has recordings" : ""}"
                @click=${() => {
				this._focus = e, this._emit("rv-day", { date: t });
			}}
                @keydown=${(t) => {
				this._onKey(t, e);
			}}
              >
                ${e}${a ? l`<span class="dot"></span>` : r}
              </button>`;
		})}
          </div>`)}
      </div>`;
	}
	static styles = [d, c`
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
var b = class extends m {
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
		_typeFilter: { state: !0 }
	};
	_monthSeq = 0;
	constructor() {
		super(), this.cameras = [], this._calendar = !1, this._days = /* @__PURE__ */ new Set(), this._daysLoading = !1, this._cameraFilter = /* @__PURE__ */ new Set(), this._typeFilter = /* @__PURE__ */ new Set();
	}
	get _zone() {
		return this.hass?.config?.time_zone;
	}
	get _today() {
		return o(Date.now(), this._zone);
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
	async _loadMonth(e, n) {
		let r = this.hass;
		if (!r) return;
		let i = ++this._monthSeq;
		this._month = {
			year: e,
			month: n
		}, this._daysLoading = !0;
		try {
			let { days: a } = await t(r, e, n);
			i === this._monthSeq && (this._days = new Set(a));
		} catch {
			i === this._monthSeq && (this._days = /* @__PURE__ */ new Set());
		} finally {
			i === this._monthSeq && (this._daysLoading = !1);
		}
	}
	_go(e) {
		this._calendar = !1, n(this, e >= this._today ? { view: "events" } : {
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
		let e = this._day, t = e === this._today, n = x(e);
		return l`<div class="head">
        <h1>Events</h1>
        <div class="day-nav" role="group" aria-label="Day">
          <button class="step" aria-label="The day before" @click=${() => {
			this._shift(-1);
		}}>${u("chevronBack")}</button>
          <button
            class="pick"
            aria-expanded=${this._calendar ? "true" : "false"}
            aria-label="${t ? "Today, " : ""}${n}: pick a day"
            @click=${() => {
			this._calendar = !this._calendar;
		}}
          >
            ${t ? "Today" : S(e)}${u("chevronDown")}
          </button>
          <button class="step" aria-label="The day after" ?disabled=${t} @click=${() => {
			this._shift(1);
		}}>${u("chevron")}</button>
          ${t ? r : l`<button class="text" @click=${() => {
			this._go(this._today);
		}}>Today</button>`}
        </div>
      </div>
      ${this._calendar && this._month ? this._renderCalendar(e) : r}
      ${this._renderFilters()}
      <rv-timetable
        .hass=${this.hass}
        .cameras=${this.cameras}
        .date=${this.date}
        .heading=${t ? "Today" : n}
        .limit=${Infinity}
        .cameraFilter=${this._cameraFilter}
        .typeFilter=${this._typeFilter}
        @rv-timetable-feed=${(e) => {
			this._feed = e.detail.feed;
		}}
      ></rv-timetable>`;
	}
	_renderCalendar(e) {
		let t = this._month ?? {
			year: 0,
			month: 0
		};
		return l`<div class="calendar">
      <rv-calendar
        .year=${t.year}
        .month=${t.month}
        .days=${this._days}
        .selected=${e}
        .today=${this._today}
        .firstDay=${s(this.hass?.locale?.language)}
        ?loading=${this._daysLoading}
        @rv-month=${(e) => void this._loadMonth(e.detail.year, e.detail.month)}
        @rv-day=${(e) => {
			this._go(e.detail.date);
		}}
      ></rv-calendar>
    </div>`;
	}
	_renderFilters() {
		let t = this._feed?.events ?? [], n = new Set(t.map((e) => e.camera_id)), o = this.cameras.filter((e) => n.has(e.id) || this._cameraFilter.has(e.id)), s = [.../* @__PURE__ */ new Set([...t.flatMap((e) => a(e.types)), ...this._typeFilter])];
		if (!o.length && !s.length) return r;
		let c = this._cameraFilter.size > 0 || this._typeFilter.size > 0;
		return l`<div class="filters">
      ${o.length ? l`<div class="group" role="group" aria-label="Cameras">
            <span class="label">Cameras</span>
            ${o.map((e) => l`<button
                class="chip"
                aria-pressed=${this._cameraFilter.has(e.id) ? "true" : "false"}
                @click=${() => {
			this._cameraFilter = this._toggle(this._cameraFilter, e.id);
		}}
              >
                <span class="plat" aria-hidden="true">${e.number}</span>${e.name}
              </button>`)}
          </div>` : r}
      ${s.length ? l`<div class="group" role="group" aria-label="What was detected">
            <span class="label">Detected</span>
            ${e(s).map((e) => l`<button
                class="chip"
                aria-pressed=${this._typeFilter.has(e) ? "true" : "false"}
                @click=${() => {
			this._typeFilter = this._toggle(this._typeFilter, e);
		}}
              >
                ${u(f([e]))}${i(e)}
              </button>`)}
          </div>` : r}
      ${c ? l`<button class="text clear" @click=${() => {
			this._cameraFilter = /* @__PURE__ */ new Set(), this._typeFilter = /* @__PURE__ */ new Set();
		}}>Show every event</button>` : r}
    </div>`;
	}
	static styles = [d, c`
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
    `];
};
function x(e) {
	return (/* @__PURE__ */ new Date(`${e}T00:00:00Z`)).toLocaleDateString(void 0, {
		weekday: "long",
		day: "numeric",
		month: "long",
		timeZone: "UTC"
	});
}
function S(e) {
	return (/* @__PURE__ */ new Date(`${e}T00:00:00Z`)).toLocaleDateString(void 0, {
		weekday: "short",
		day: "numeric",
		month: "short",
		timeZone: "UTC"
	});
}
customElements.get("rv-events") || customElements.define("rv-events", b);
//#endregion
export { b as RvEvents, x as dayLabel, S as shortDay };

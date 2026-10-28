import { Bt as e, E as t, F as n, Ht as r, Q as i, R as a, T as o, Vt as s, ft as c, j as l, l as u, p as d, v as f, vt as p, y as m, z as h, zt as g } from "./home-CkkHTxZF.js";
//#region src/playback/calendar.ts
var _ = [
	0,
	1,
	2,
	3,
	4,
	5,
	6
], v = class extends g {
	static properties = {
		year: { type: Number },
		month: { type: Number },
		days: { attribute: !1 },
		selected: { attribute: !1 },
		today: { attribute: !1 },
		firstDay: { type: Number },
		loading: { type: Boolean }
	};
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
		let [t, n] = d(this.year, this.month, e);
		this._emit("rv-month", {
			year: t,
			month: n
		});
	}
	render() {
		let t = new Date(Date.UTC(this.year, this.month - 1, 15)).toLocaleDateString(void 0, {
			month: "long",
			year: "numeric",
			timeZone: "UTC"
		}), n = _.map((e) => (e + this.firstDay) % 7).map((e) => new Date(Date.UTC(2023, 0, 1 + e)).toLocaleDateString(void 0, {
			weekday: "narrow",
			timeZone: "UTC"
		})), [r, i] = d(this.year, this.month, 1), a = this.today !== void 0 && f(r, i, 1) > this.today;
		return s`<div class="head">
        <button class="text" aria-label="Previous month" @click=${() => {
			this._move(-1);
		}}>${c("chevronBack")}</button>
        <span class="title">${t}${this.loading ? s` <span class="muted small">…</span>` : e}</span>
        <button class="text" aria-label="Next month" ?disabled=${a} @click=${() => {
			this._move(1);
		}}>${c("chevron")}</button>
      </div>
      <div class="grid" role="grid">
        ${n.map((e) => s`<span class="dow" role="columnheader">${e}</span>`)}
        ${m(this.year, this.month, this.firstDay).flat().map((t) => {
			if (t === null) return s`<span></span>`;
			let n = f(this.year, this.month, t), r = this.today !== void 0 && n > this.today, i = this.days.has(t);
			return s`<button
              role="gridcell"
              class="day ${n === this.selected ? "selected" : ""} ${n === this.today ? "today" : ""}"
              ?disabled=${r}
              aria-pressed=${n === this.selected ? "true" : "false"}
              aria-label="${n}${i ? ", has recordings" : ""}"
              @click=${() => {
				this._emit("rv-day", { date: n });
			}}
            >
              ${t}${i ? s`<span class="dot"></span>` : e}
            </button>`;
		})}
      </div>`;
	}
	static styles = [i, r`
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
    `];
};
customElements.get("rv-calendar") || customElements.define("rv-calendar", v);
//#endregion
//#region src/components/events-view.ts
var y = class extends g {
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
			let { days: i } = await p(n, e, t);
			r === this._monthSeq && (this._days = new Set(i));
		} catch {
			r === this._monthSeq && (this._days = /* @__PURE__ */ new Set());
		} finally {
			r === this._monthSeq && (this._daysLoading = !1);
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
		let t = this._day, n = t === this._today, r = b(t);
		return s`<div class="head">
        <h1>Events</h1>
        <div class="day-nav" role="group" aria-label="Day">
          <button class="step" aria-label="The day before" @click=${() => {
			this._shift(-1);
		}}>${c("chevronBack")}</button>
          <button
            class="pick"
            aria-expanded=${this._calendar ? "true" : "false"}
            aria-label="${n ? "Today, " : ""}${r}: pick a day"
            @click=${() => {
			this._calendar = !this._calendar;
		}}
          >
            ${n ? "Today" : x(t)}${c("chevronDown")}
          </button>
          <button class="step" aria-label="The day after" ?disabled=${n} @click=${() => {
			this._shift(1);
		}}>${c("chevron")}</button>
          ${n ? e : s`<button class="text" @click=${() => {
			this._go(this._today);
		}}>Today</button>`}
        </div>
      </div>
      ${this._calendar && this._month ? this._renderCalendar(t) : e}
      ${this._renderFilters()}
      <rv-timetable
        .hass=${this.hass}
        .cameras=${this.cameras}
        .date=${this.date}
        .heading=${n ? "Today" : r}
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
		return s`<div class="calendar">
      <rv-calendar
        .year=${t.year}
        .month=${t.month}
        .days=${this._days}
        .selected=${e}
        .today=${this._today}
        .firstDay=${h(this.hass?.locale?.language)}
        ?loading=${this._daysLoading}
        @rv-month=${(e) => void this._loadMonth(e.detail.year, e.detail.month)}
        @rv-day=${(e) => {
			this._go(e.detail.date);
		}}
      ></rv-calendar>
    </div>`;
	}
	_renderFilters() {
		let n = this._feed?.events ?? [], r = new Set(n.map((e) => e.camera_id)), i = this.cameras.filter((e) => r.has(e.id) || this._cameraFilter.has(e.id)), a = [.../* @__PURE__ */ new Set([...n.flatMap((e) => o(e.types)), ...this._typeFilter])];
		if (!i.length && !a.length) return e;
		let d = this._cameraFilter.size > 0 || this._typeFilter.size > 0;
		return s`<div class="filters">
      ${i.length ? s`<div class="group" role="group" aria-label="Cameras">
            <span class="label">Cameras</span>
            ${i.map((e) => s`<button
                class="chip"
                aria-pressed=${this._cameraFilter.has(e.id) ? "true" : "false"}
                @click=${() => {
			this._cameraFilter = this._toggle(this._cameraFilter, e.id);
		}}
              >
                <span class="plat" aria-hidden="true">${e.number}</span>${e.name}
              </button>`)}
          </div>` : e}
      ${a.length ? s`<div class="group" role="group" aria-label="What was detected">
            <span class="label">Detected</span>
            ${t(a).map((e) => s`<button
                class="chip"
                aria-pressed=${this._typeFilter.has(e) ? "true" : "false"}
                @click=${() => {
			this._typeFilter = this._toggle(this._typeFilter, e);
		}}
              >
                ${c(u([e]))}${l(e)}
              </button>`)}
          </div>` : e}
      ${d ? s`<button class="text clear" @click=${() => {
			this._cameraFilter = /* @__PURE__ */ new Set(), this._typeFilter = /* @__PURE__ */ new Set();
		}}>Show every event</button>` : e}
    </div>`;
	}
	static styles = [i, r`
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
function b(e) {
	return (/* @__PURE__ */ new Date(`${e}T00:00:00Z`)).toLocaleDateString(void 0, {
		weekday: "long",
		day: "numeric",
		month: "long",
		timeZone: "UTC"
	});
}
function x(e) {
	return (/* @__PURE__ */ new Date(`${e}T00:00:00Z`)).toLocaleDateString(void 0, {
		weekday: "short",
		day: "numeric",
		month: "short",
		timeZone: "UTC"
	});
}
customElements.get("rv-events") || customElements.define("rv-events", y);
//#endregion
export { y as RvEvents, b as dayLabel, x as shortDay };

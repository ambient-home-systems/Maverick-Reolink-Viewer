import { E as e, F as t, Gt as n, Jt as r, Kt as i, M as a, T as o, U as s, W as c, it as l, l as u, p as d, qt as f, v as p, vt as m, wt as h, y as g } from "./home-B--azFjF.js";
//#region src/playback/calendar.ts
var _ = [
	0,
	1,
	2,
	3,
	4,
	5,
	6
], v = class extends n {
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
		let e = new Date(Date.UTC(this.year, this.month - 1, 15)).toLocaleDateString(void 0, {
			month: "long",
			year: "numeric",
			timeZone: "UTC"
		}), t = _.map((e) => (e + this.firstDay) % 7).map((e) => new Date(Date.UTC(2023, 0, 1 + e)).toLocaleDateString(void 0, {
			weekday: "narrow",
			timeZone: "UTC"
		})), [n, r] = d(this.year, this.month, 1), a = this.today !== void 0 && p(n, r, 1) > this.today;
		return f`<div class="head">
        <button class="text" aria-label="Previous month" @click=${() => {
			this._move(-1);
		}}>${m("chevronBack")}</button>
        <span class="title">${e}${this.loading ? f` <span class="muted small">…</span>` : i}</span>
        <button class="text" aria-label="Next month" ?disabled=${a} @click=${() => {
			this._move(1);
		}}>${m("chevron")}</button>
      </div>
      <div class="grid" role="grid">
        ${t.map((e) => f`<span class="dow" role="columnheader">${e}</span>`)}
        ${g(this.year, this.month, this.firstDay).flat().map((e) => {
			if (e === null) return f`<span></span>`;
			let t = p(this.year, this.month, e), n = this.today !== void 0 && t > this.today, r = this.days.has(e);
			return f`<button
              role="gridcell"
              class="day ${t === this.selected ? "selected" : ""} ${t === this.today ? "today" : ""}"
              ?disabled=${n}
              aria-pressed=${t === this.selected ? "true" : "false"}
              aria-label="${t}${r ? ", has recordings" : ""}"
              @click=${() => {
				this._emit("rv-day", { date: t });
			}}
            >
              ${e}${r ? f`<span class="dot"></span>` : i}
            </button>`;
		})}
      </div>`;
	}
	static styles = [l, r`
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
var y = class extends n {
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
		return s(Date.now(), this._zone);
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
			let { days: i } = await h(n, e, t);
			r === this._monthSeq && (this._days = new Set(i));
		} catch {
			r === this._monthSeq && (this._days = /* @__PURE__ */ new Set());
		} finally {
			r === this._monthSeq && (this._daysLoading = !1);
		}
	}
	_go(e) {
		this._calendar = !1, t(this, e >= this._today ? { view: "events" } : {
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
		let e = this._day, t = e === this._today, n = b(e);
		return f`<div class="head">
        <h1>Events</h1>
        <div class="day-nav" role="group" aria-label="Day">
          <button class="step" aria-label="The day before" @click=${() => {
			this._shift(-1);
		}}>${m("chevronBack")}</button>
          <button
            class="pick"
            aria-expanded=${this._calendar ? "true" : "false"}
            aria-label="${t ? "Today, " : ""}${n}: pick a day"
            @click=${() => {
			this._calendar = !this._calendar;
		}}
          >
            ${t ? "Today" : x(e)}${m("chevronDown")}
          </button>
          <button class="step" aria-label="The day after" ?disabled=${t} @click=${() => {
			this._shift(1);
		}}>${m("chevron")}</button>
          ${t ? i : f`<button class="text" @click=${() => {
			this._go(this._today);
		}}>Today</button>`}
        </div>
      </div>
      ${this._calendar && this._month ? this._renderCalendar(e) : i}
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
		return f`<div class="calendar">
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
		let t = this._feed?.events ?? [], n = new Set(t.map((e) => e.camera_id)), r = this.cameras.filter((e) => n.has(e.id) || this._cameraFilter.has(e.id)), s = [.../* @__PURE__ */ new Set([...t.flatMap((e) => o(e.types)), ...this._typeFilter])];
		if (!r.length && !s.length) return i;
		let c = this._cameraFilter.size > 0 || this._typeFilter.size > 0;
		return f`<div class="filters">
      ${r.length ? f`<div class="group" role="group" aria-label="Cameras">
            <span class="label">Cameras</span>
            ${r.map((e) => f`<button
                class="chip"
                aria-pressed=${this._cameraFilter.has(e.id) ? "true" : "false"}
                @click=${() => {
			this._cameraFilter = this._toggle(this._cameraFilter, e.id);
		}}
              >
                <span class="plat" aria-hidden="true">${e.number}</span>${e.name}
              </button>`)}
          </div>` : i}
      ${s.length ? f`<div class="group" role="group" aria-label="What was detected">
            <span class="label">Detected</span>
            ${e(s).map((e) => f`<button
                class="chip"
                aria-pressed=${this._typeFilter.has(e) ? "true" : "false"}
                @click=${() => {
			this._typeFilter = this._toggle(this._typeFilter, e);
		}}
              >
                ${m(u([e]))}${a(e)}
              </button>`)}
          </div>` : i}
      ${c ? f`<button class="text clear" @click=${() => {
			this._cameraFilter = /* @__PURE__ */ new Set(), this._typeFilter = /* @__PURE__ */ new Set();
		}}>Show every event</button>` : i}
    </div>`;
	}
	static styles = [l, r`
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

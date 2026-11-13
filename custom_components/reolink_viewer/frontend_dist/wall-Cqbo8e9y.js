import { a as e, i as t, n, r, t as i } from "./lit-DdRjbP0M.js";
import { At as a, B as o, Bt as s, Ct as c, Dt as l, Ft as u, Ot as d, P as f, R as p, V as m, d as h, et as g, ft as _, g as v, m as y, nt as b } from "./live-BD2sk3pJ.js";
import { G as x, H as ee, V as S, X as C, Y as w, Z as T, c as E, f as D, p as O, u as k } from "./home-DJZam5_I.js";
import { t as A } from "./tablet-Dzrlz5mg.js";
//#region src/wall/arrange.ts
function te(e, t) {
	return e.cameras.length ? [...e.cameras] : [...t];
}
function ne(e, t) {
	return Math.max(1, Math.ceil(e / Math.max(1, t)));
}
function re(e, t, n) {
	let r = [...e];
	for (; r.length <= Math.max(t, n);) r.push(null);
	for ([r[t], r[n]] = [r[n] ?? null, r[t] ?? null]; r.length && r.at(-1) === null;) r.pop();
	return r;
}
function ie(e, t, n) {
	if (t < 0 || t >= e.slots.length) return;
	let r = e.slots[t], i = (e, t, n, r) => e < n + r && n < e + t, a;
	return e.slots.forEach((e, o) => {
		if (o === t) return;
		let s, c;
		if (n === "left" || n === "right") {
			if (!i(e.row, e.rows, r.row, r.rows)) return;
			s = n === "right" ? e.col - (r.col + r.cols) : r.col - (e.col + e.cols), c = Math.abs(e.row - r.row);
		} else {
			if (!i(e.col, e.cols, r.col, r.cols)) return;
			s = n === "down" ? e.row - (r.row + r.rows) : r.row - (e.row + e.rows), c = Math.abs(e.col - r.col);
		}
		s < 0 || (!a || s < a.distance || s === a.distance && c < a.offset) && (a = {
			index: o,
			distance: s,
			offset: c
		});
	}), a?.index;
}
var j = {
	ArrowLeft: "left",
	ArrowRight: "right",
	ArrowUp: "up",
	ArrowDown: "down"
}, M = [
	{
		grid: "auto",
		label: "Auto"
	},
	{
		grid: "1",
		label: "1"
	},
	{
		grid: "2x2",
		label: "2 × 2"
	},
	{
		grid: "3x3",
		label: "3 × 3"
	},
	{
		grid: "4x4",
		label: "4 × 4"
	},
	{
		grid: "1+5",
		label: "1 + 5"
	},
	{
		grid: "1+7",
		label: "1 + 7"
	}
], N = (e) => ({
	cols: e,
	rows: e,
	slots: Array.from({ length: e * e }, (t, n) => ({
		col: n % e,
		row: Math.floor(n / e),
		cols: 1,
		rows: 1
	}))
}), P = (e) => {
	let t = [{
		col: 0,
		row: 0,
		cols: e - 1,
		rows: e - 1
	}];
	for (let n = 0; n < e - 1; n += 1) t.push({
		col: e - 1,
		row: n,
		cols: 1,
		rows: 1
	});
	for (let n = 0; n < e; n += 1) t.push({
		col: n,
		row: e - 1,
		cols: 1,
		rows: 1
	});
	return {
		cols: e,
		rows: e,
		slots: t
	};
};
function F(e, t) {
	let n = [], r = (e, t) => !n[e]?.[t], i = [], a = 0;
	for (let o of e) {
		let e = o === "wide" && t >= 2 ? 2 : 1, s = o === "tall" ? 2 : 1, c;
		for (let n = 0; !c; n += 1) for (let i = 0; i + e <= t && !c; i += 1) {
			let t = !0;
			for (let a = n; a < n + s && t; a += 1) for (let n = i; n < i + e && t; n += 1) t = r(a, n);
			t && (c = {
				col: i,
				row: n,
				cols: e,
				rows: s
			});
		}
		for (let t = c.row; t < c.row + s; t += 1) {
			let r = n[t] ??= [];
			for (let t = c.col; t < c.col + e; t += 1) r[t] = !0;
		}
		a = Math.max(a, c.row + s), i.push(c);
	}
	return {
		slots: i,
		rows: Math.max(1, a)
	};
}
function I(e, t, n) {
	let r = e.length ? e : [void 0], i = r.reduce((e, t) => e + (t ? 2 : 1), 0), a;
	for (let e = 1; e <= i; e += 1) {
		let { slots: i, rows: o } = F(r, e), s = (t - (e - 1) * 4) / e, c = (n - (o - 1) * 4) / o, l = Math.min(s, c * 16 / 9);
		(!a || l > a.size + .5 || Math.abs(l - a.size) <= .5 && e * o < a.cols * a.rows) && (a = {
			cols: e,
			rows: o,
			slots: i,
			size: l
		});
	}
	let { cols: o, rows: s, slots: c } = a ?? {
		cols: 1,
		rows: 1,
		slots: []
	};
	return {
		cols: o,
		rows: s,
		slots: e.length ? c : []
	};
}
function L(e, t, n, r) {
	switch (e) {
		case "1": return N(1);
		case "2x2": return N(2);
		case "3x3": return N(3);
		case "4x4": return N(4);
		case "1+5": return P(3);
		case "1+7": return P(4);
		case "auto": return I(t, n, r);
	}
}
function R(e, t, n, r) {
	let i = (n - (e.cols - 1) * 4) / e.cols, a = (r - (e.rows - 1) * 4) / e.rows;
	return {
		width: i * t.cols + (t.cols - 1) * 4,
		height: a * t.rows + (t.rows - 1) * 4
	};
}
function z(e, t) {
	return !e || !t.width || !t.height ? "cover" : e > t.width / t.height * 1.02 ? "contain" : "cover";
}
function B(e, t, n = 1) {
	let r = e?.streams.sub?.encoding;
	if (!r?.width || !r.height || !t.width || !t.height) return;
	let i = t.width * n / r.width, a = t.height * n / r.height;
	return t.fit === "cover" ? Math.max(i, a) : Math.min(i, a);
}
var V = (e, t) => `${String(e)} ${t}${e === 1 ? "" : "s"}`;
function H(e, t = 1) {
	let n = /* @__PURE__ */ new Map(), r = [];
	e.forEach((e, i) => {
		if (!e) return;
		let a = m(e.camera);
		if (!a) return;
		let o = a.streams.sub?.encoding, s = o?.width && o.height ? `${String(o.width)}×${String(o.height)}` : void 0;
		if (!a.streams.main && !a.streams.ext) {
			n.set(e.camera.id, {
				hd: !1,
				reason: "SD: it has no HD stream"
			});
			return;
		}
		if (a.is_battery) {
			n.set(e.camera.id, {
				hd: !1,
				reason: "SD: on its battery, it plays when tapped"
			});
			return;
		}
		let c = B(a, e, t);
		if (e.large) r.push({
			cell: e,
			connection: a,
			scale: c ?? Infinity,
			index: i,
			why: e.large
		});
		else if (c !== void 0 && c > 1) r.push({
			cell: e,
			connection: a,
			scale: c,
			index: i,
			why: `drawn at ${c.toFixed(1)}× its sub stream (${s ?? "?"})`
		});
		else {
			let t = `SD: the tile is no larger than its sub stream (${s ?? "?"})`;
			s ? (!e.width || !e.height) && (t = "SD: the tile's size is not known yet") : t = "SD: its sub stream's size is not known", n.set(e.camera.id, {
				hd: !1,
				reason: t
			});
		}
	}), r.sort((e, t) => Number(!!t.cell.large) - Number(!!e.cell.large) || t.scale - e.scale || e.index - t.index);
	let i = /* @__PURE__ */ new Map();
	for (let { cell: e, connection: t, why: a } of r) {
		let r = t.host ?? t.connection_id, o = t.hd_tiles ?? 1, s = i.get(r) ?? [];
		s.length < o ? (s.push(e.camera.name), i.set(r, s), n.set(e.camera.id, {
			hd: !0,
			reason: `HD: ${a}`
		})) : n.set(e.camera.id, {
			hd: !1,
			reason: `SD: ${t.entry_title} plays ${V(o, "HD tile")} at once, and ${s.join(", ")} ${s.length === 1 ? "has" : "have"} it`
		});
	}
	return n;
}
//#endregion
//#region src/components/wall-strip.ts
var U = 12e4, W = 2e4, G = 120, K = 10, q = 60474e4, J = "rv-strip-live", ae = class extends i {
	static properties = {
		hass: { attribute: !1 },
		cameras: { attribute: !1 },
		numbers: { attribute: !1 },
		now: { attribute: !1 },
		pictures: { attribute: !1 },
		_feed: { state: !0 },
		_thumbs: { state: !0 },
		_marked: { state: !0 }
	};
	_timer;
	_again;
	_asked = /* @__PURE__ */ new Set();
	_seq = 0;
	_started = !1;
	constructor() {
		super(), this.cameras = [], this.numbers = /* @__PURE__ */ new Map(), this.now = /* @__PURE__ */ new Map(), this.pictures = {}, this._thumbs = /* @__PURE__ */ new Map(), this._marked = /* @__PURE__ */ new Set();
	}
	connectedCallback() {
		super.connectedCallback(), this._timer = setInterval(() => {
			this._load(!0);
		}, U);
	}
	disconnectedCallback() {
		super.disconnectedCallback(), clearInterval(this._timer), clearTimeout(this._again), this._started = !1;
	}
	updated() {
		this.hass && !this._started && (this._started = !0, this._load(!1));
	}
	refreshSoon() {
		this._load(!0), clearTimeout(this._again), this._again = setTimeout(() => {
			this._load(!0);
		}, W);
	}
	async _load(e) {
		let t = this.hass;
		if (!t) return;
		let n = ++this._seq;
		try {
			let r = await _(t, e ? { background: e } : { maxAge: G });
			if (n !== this._seq) return;
			this._feed = r, this._loadThumbs(t, r.events), this._loadMarks(t, r, n);
		} catch {}
	}
	async _loadThumbs(e, t) {
		let n = t.filter((e) => !this._asked.has(O(e)));
		for (let e of n) this._asked.add(O(e));
		await Promise.all(n.map(async (t) => {
			try {
				let { urls: n } = await c(e, t.camera_id, [t.start], K), r = n[0]?.url;
				r && (this._thumbs = new Map(this._thumbs).set(O(t), r));
			} catch {}
		}));
	}
	async _loadMarks(e, t, n) {
		if (!t.events.length) return;
		let r = t.now, i = Math.max(Math.min(...t.events.map((e) => e.start)), r - q);
		try {
			let { marks: a } = await l(e, i, r);
			if (n !== this._seq) return;
			this._marked = new Set(D(t.events, a, i, r).marks.keys());
		} catch {}
	}
	get _cards() {
		let e = new Map((this._feed?.events ?? []).map((e) => [e.camera_id, e])), t = [];
		for (let n of this.cameras) {
			let r = this.now.get(n.id), i = e.get(n.id);
			(r || i) && t.push({
				camera: n,
				...r ? { now: r } : {},
				...i ? { event: i } : {}
			});
		}
		let n = (e) => e.now?.since ?? e.event?.start ?? 0;
		return t.sort((e, t) => Number(!!t.now) - Number(!!e.now) || n(t) - n(e));
	}
	_open(e) {
		if (e.now) {
			this.dispatchEvent(new CustomEvent(J, {
				detail: { cameraId: e.camera.id },
				bubbles: !0,
				composed: !0
			}));
			return;
		}
		let t = e.event, n = this.hass;
		if (t) {
			if (n && t.new) {
				a(n, t.camera_id, t.start).catch(() => void 0);
				let e = this._feed;
				e && (this._feed = {
					...e,
					events: e.events.map((e) => e === t ? {
						...e,
						new: !1
					} : e)
				});
			}
			x(this, {
				view: "device",
				id: t.camera_id,
				tab: "playback",
				at: t.start
			});
		}
	}
	render() {
		let e = this._cards, t = this.hass?.config?.time_zone, n = this._feed ? h(this._feed.now, t) : void 0;
		return r`<ul class="strip" aria-label="Latest detections">
      ${e.length ? e.map((e) => this._renderCard(e, t, n)) : r`<li class="none">${this._feed ? "No detections yet" : "Loading the latest detections…"}</li>`}
    </ul>`;
	}
	_renderCard(e, t, i) {
		let { camera: a, now: o, event: s } = e, c = o ? o.types : s?.types ?? [], l = o ? o.since : s?.start ?? 0, u = E(c), d = o || i === void 0 || h(l, t) === i ? y(l, t) : v(l, t), f = o ? this.pictures[a.id]?.url : s ? this._thumbs.get(O(s)) : void 0, p = !o && s !== void 0 && this._marked.has(O(s)), m = o ? "Now" : s?.new ? "New" : void 0, _ = this.numbers.get(a.id);
		return r`<li>
      <button
        class="card ${o ? "now" : ""}"
        title=${o ? "Show it large" : "Open the recording"}
        @click=${() => {
			this._open(e);
		}}
      >
        <span class="thumb">${f ? r`<img src=${f} alt="" loading="lazy" />` : n}</span>
        <span class="text">
          <span class="what">
            ${g(k(c))} <span class="label">${u}</span>
            ${m ? r`<span class="tag">${m}</span>` : n}
            ${p ? r`<span class="badge unusual">Unusual</span>` : n}
          </span>
          <span class="where">
            ${_ === void 0 ? n : r`<span class="num" aria-hidden="true">${_}</span>`}
            <span class="name">${a.name}</span> <span class="time">${d}</span>
          </span>
        </span>
      </button>
    </li>`;
	}
	static styles = [f, e`
      :host {
        display: block;
        flex: none;
        color: var(--rv-on-board);
      }
      .strip {
        display: flex;
        gap: 6px;
        margin: 0;
        padding: 0 6px 6px;
        list-style: none;
        overflow-x: auto;
        scrollbar-width: thin;
      }
      .strip > li {
        flex: none;
      }
      .none {
        padding: 6px 6px 2px;
        color: var(--rv-on-board-muted);
        font-size: 14px;
      }
      .card {
        display: flex;
        align-items: stretch;
        gap: 8px;
        width: 264px;
        height: 64px;
        min-height: 0;
        padding: 0 8px 0 0;
        border: 1px solid color-mix(in srgb, var(--rv-on-board) 18%, transparent);
        border-radius: 0;
        background: color-mix(in srgb, var(--rv-on-board) 6%, transparent);
        color: var(--rv-on-board);
        text-align: left;
        cursor: var(--rv-pointer, pointer);
      }
      .card:hover {
        background: color-mix(in srgb, var(--rv-on-board) 12%, transparent);
      }
      .card:focus-visible {
        outline: 2px solid var(--rv-on-board);
        outline-offset: 2px;
      }
      .card.now {
        border-color: var(--rv-on-board-red);
      }
      .thumb {
        flex: none;
        width: 112px;
        background: #000;
      }
      .thumb img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .text {
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 2px;
        min-width: 0;
      }
      .what {
        display: flex;
        align-items: center;
        gap: 5px;
        min-width: 0;
        font-size: 15px;
        font-weight: 600;
      }
      .what svg {
        flex: none;
        width: 18px;
        height: 18px;
      }
      .label {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .tag {
        flex: none;
        color: var(--rv-on-board-red);
        font-size: 13px;
      }
      .badge.unusual {
        flex: none;
        border-color: var(--rv-on-board-muted);
        color: var(--rv-on-board);
        font-size: 12px;
        line-height: 18px;
        padding: 0 5px;
      }
      .where {
        display: flex;
        align-items: baseline;
        gap: 6px;
        min-width: 0;
        color: var(--rv-on-board-muted);
        font-size: 13px;
      }
      .num {
        flex: none;
        font-family: var(--rv-font-cond);
        font-weight: 600;
      }
      .name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .time {
        flex: none;
        margin-left: auto;
        font-variant-numeric: tabular-nums;
      }
    `];
};
customElements.get("rv-wall-strip") || customElements.define("rv-wall-strip", ae);
//#endregion
//#region src/components/wall.ts
var Y = {
	id: "",
	name: "All cameras",
	grid: "auto",
	cameras: [],
	tour_s: null
};
function oe(e, t) {
	if (!e.cameras.length) return S([...t]);
	let n = new Map(t.map((e) => [e.id, e]));
	return e.cameras.map((e) => e ? n.get(e) : void 0);
}
function se(e) {
	let t = m(e)?.streams.sub?.encoding;
	return t?.width && t.height ? t.width / t.height : void 0;
}
var X = 3e3, Z = class extends i {
	static properties = {
		hass: { attribute: !1 },
		layoutId: { attribute: !1 },
		card: {
			type: Boolean,
			reflect: !0
		},
		showBar: { attribute: !1 },
		_asleep: { state: !0 },
		_layouts: { state: !0 },
		_editing: { state: !0 },
		_draft: { state: !0 },
		_error: { state: !0 },
		_size: { state: !0 },
		_full: { state: !0 },
		_wallFull: { state: !0 },
		_now: { state: !0 },
		_order: { state: !0 },
		_page: { state: !0 },
		_alone: { state: !0 },
		_arranging: { state: !0 },
		_picked: { state: !0 },
		_focus: { state: !0 },
		_said: { state: !0 },
		_over: { state: !0 }
	};
	_data = new p(this);
	_resize;
	_clock;
	_tour;
	_tourEvery = 0;
	_asked = !1;
	_arranged;
	_refocus = !1;
	_dragged;
	_wasDetecting = /* @__PURE__ */ new Set();
	_idleTimer;
	_wake;
	_waking = !1;
	_unsleep;
	constructor() {
		super(), this._editing = !1, this._draft = {
			name: "",
			grid: "auto",
			tour_s: null,
			...Q
		}, this._page = 0, this._arranging = !1, this._focus = 0, this._said = "", this._size = {
			width: 0,
			height: 0
		}, this._wallFull = !1, this._now = Date.now(), this.card = !1, this.showBar = !0, this._asleep = !1;
	}
	connectedCallback() {
		super.connectedCallback(), this.card || C("wall"), document.addEventListener("fullscreenchange", this._onFullscreen), document.addEventListener("visibilitychange", this._onVisibility), this.addEventListener("pointermove", this._onPointer), this.addEventListener("pointerdown", this._onPointer), this._onPointer(), this._keepAwake(), A.listenToFully(), this._asleep = A.asleep, this._unsleep = A.onSleep(() => {
			this._asleep = A.asleep;
		}), this._tick();
	}
	disconnectedCallback() {
		super.disconnectedCallback(), document.removeEventListener("fullscreenchange", this._onFullscreen), document.removeEventListener("visibilitychange", this._onVisibility), this.removeEventListener("pointermove", this._onPointer), this.removeEventListener("pointerdown", this._onPointer), clearTimeout(this._idleTimer), this.removeAttribute("idle"), this._wake?.release().catch(() => void 0), this._wake = void 0, this._unsleep?.(), this._unsleep = void 0, this._resize?.disconnect(), this._resize = void 0, clearTimeout(this._clock), this._stopTour();
	}
	_onPointer = () => {
		this.removeAttribute("idle"), clearTimeout(this._idleTimer), this._idleTimer = setTimeout(() => {
			this.setAttribute("idle", "");
		}, X);
	};
	_onVisibility = () => {
		document.visibilityState === "visible" && this._keepAwake();
	};
	async _keepAwake() {
		let e = navigator.wakeLock;
		if (!(!e || A.fully || this._wake || this._waking || document.visibilityState !== "visible")) {
			this._waking = !0;
			try {
				let t = await e.request("screen");
				if (!this.isConnected) {
					await t.release();
					return;
				}
				this._wake = t, t.addEventListener("release", () => {
					this._wake === t && (this._wake = void 0);
				});
			} catch {} finally {
				this._waking = !1;
			}
		}
	}
	_onFullscreen = () => {
		this._wallFull = document.fullscreenElement === this;
	};
	_tick() {
		this._now = Date.now(), clearTimeout(this._clock), this._clock = setTimeout(() => {
			this._tick();
		}, 6e4 - this._now % 6e4 + 50);
	}
	willUpdate(e) {
		if (this._data.hass = this.hass, e.has("hass")) {
			let e = new Set(this._detecting().keys()), t = [...this._wasDetecting].some((t) => !e.has(t));
			this._wasDetecting = e, t && this.shadowRoot?.querySelector("rv-wall-strip")?.refreshSoon();
		}
		e.has("hass") && this.hass && !this._asked && (this._asked = !0, this._loadLayouts(this.hass));
		let t = this._layout.id;
		e.has("card") && this.card && (this._editing = !1), t !== this._arranged && (this._arranged = t, this._order = void 0, this._page = 0, this._alone = void 0, this._picked = void 0, this._focus = 0);
	}
	updated() {
		let e = this.shadowRoot?.querySelector(".cells");
		e && !this._resize && typeof ResizeObserver < "u" && (this._resize = new ResizeObserver((e) => {
			let t = e.at(-1)?.contentRect;
			t && (Math.abs(t.width - this._size.width) >= 1 || Math.abs(t.height - this._size.height) >= 1) && (this._size = {
				width: t.width,
				height: t.height
			});
		}), this._resize.observe(e));
		let t = this._layout;
		this._layouts !== void 0 && !this.card && w(t.id || void 0), this._syncTour(), this._refocus && (this._refocus = !1, this.shadowRoot?.querySelector(`.cell[data-slot="${String(this._focus)}"]`)?.focus());
	}
	async _loadLayouts(e) {
		try {
			this._layouts = (await d(e)).layouts;
		} catch (e) {
			this._layouts = [], this._error = `The saved layouts could not be read: ${s(e).message}`;
		}
	}
	get _layout() {
		let e = this._layouts ?? [], t = this.layoutId ?? (this.card ? void 0 : T());
		return e.find((e) => e.id === t) ?? Y;
	}
	get _shown() {
		if (this._editing) {
			let { floodlight: e, siren: t, strip: n } = this._draft;
			return {
				floodlight: e,
				siren: t,
				strip: n
			};
		}
		return $(this._layout);
	}
	_controls(e) {
		let t = e.controls;
		if (!t) return;
		let { floodlight: n, siren: r, ...i } = t, a = this._shown;
		return {
			...i,
			...a.floodlight && n ? { floodlight: n } : {},
			...a.siren && r ? { siren: r } : {}
		};
	}
	_detecting() {
		let e = this.hass?.states ?? {}, t = /* @__PURE__ */ new Map();
		for (let n of this._data.cameras ?? []) {
			let r = [], i = Infinity;
			for (let [t, a] of Object.entries(n.detection ?? {})) {
				let n = e[t];
				n?.state === "on" && (r.includes(a) || r.push(a), i = Math.min(i, Date.parse(n.last_changed)));
			}
			r.length && t.set(n.id, {
				types: r,
				since: Number.isFinite(i) ? i : Date.now()
			});
		}
		return t;
	}
	_showLarge(e) {
		let t = [...this.shadowRoot?.querySelectorAll("rv-live-tile") ?? []].find((t) => t.camera?.id === e);
		t ? t.enterFull() : (this._alone = e, this._said = `${this._name(e)} alone on the screen. Escape, or a double tap, to go back.`);
	}
	_toggleFull() {
		document.fullscreenElement === this ? document.exitFullscreen().catch(() => void 0) : this.requestFullscreen().catch(() => void 0);
	}
	_show(e) {
		e || w(void 0), x(this, e ? {
			view: "wall",
			layout: e
		} : { view: "wall" });
	}
	_edit() {
		let e = this._layout;
		this._draft = {
			name: e.id ? e.name : "",
			grid: e.grid,
			tour_s: e.tour_s,
			...$(e)
		}, this._error = void 0, this._editing = !0;
	}
	async _save(e) {
		let t = this.hass;
		if (!t) return;
		let n = this._layout, r = this._draft.name.trim();
		if (!r) this._error = "Give the layout a name.";
		else try {
			let { layout: i } = await u(t, {
				...n.id && !e ? { id: n.id } : {},
				name: r,
				grid: this._draft.grid,
				cameras: this._order ?? n.cameras,
				tour_s: this._draft.tour_s,
				floodlight: this._draft.floodlight,
				siren: this._draft.siren,
				strip: this._draft.strip
			});
			await this._loadLayouts(t), this._editing = !1, this._error = void 0, x(this, {
				view: "wall",
				layout: i.id
			});
		} catch (e) {
			this._error = `Could not save it: ${s(e).message}`;
		}
	}
	async _delete() {
		let e = this.hass, t = this._layout;
		if (e && t.id) try {
			await b(e, t.id), await this._loadLayouts(e), this._editing = !1, this._show("");
		} catch (e) {
			this._error = `Could not delete it: ${s(e).message}`;
		}
	}
	get _view() {
		let e = this._layout, t = this._editing ? this._draft.grid : e.grid, n = this._data.cameras ?? [], r = new Map(n.map((e) => [e.id, e])), i = this._order ?? te(e, S([...n]).map((e) => e.id)), { width: a, height: o } = this._size, s = (e) => e.map((e) => e ? ee(m(e)) : void 0);
		if (this._alone && r.has(this._alone)) return {
			order: i,
			perPage: 1,
			pages: 1,
			page: 0,
			shown: [r.get(this._alone)],
			plan: L("1", [], a, o)
		};
		let c = t === "auto" ? Math.max(1, i.length) : L(t, [], a, o).slots.length, l = ne(i.length, c), u = Math.min(this._page, l - 1), d = i.slice(u * c, (u + 1) * c).map((e) => e ? r.get(e) : void 0);
		return {
			order: i,
			perPage: c,
			pages: l,
			page: u,
			shown: d,
			plan: L(t, s(d), a, o)
		};
	}
	_name(e) {
		return this._data.cameras?.find((t) => t.id === e)?.name ?? "An empty cell";
	}
	_swap(e, t) {
		let { order: n } = this._view;
		if (e === t) return;
		let r = re(n, e, t);
		this._order = r, this._said = `${this._name(n[e])} swapped with ${this._name(n[t]).toLowerCase() === "an empty cell" ? "an empty cell" : this._name(n[t])}.`, this._keep(r);
	}
	async _keep(e) {
		let t = this.hass, n = this._layout;
		if (t && n.id) try {
			let { layout: r } = await u(t, {
				...n,
				cameras: e
			});
			this._layouts = (this._layouts ?? []).map((e) => e.id === r.id ? r : e);
		} catch (e) {
			this._error = `Could not keep the new order: ${s(e).message}`;
		}
	}
	_enlarge(e) {
		let t = this._view;
		if (this._alone) {
			this._said = `${this._name(this._alone)} back in its cell.`, this._alone = void 0;
			return;
		}
		let n = t.page * t.perPage + e, r = t.order[n];
		if (!r) return;
		let i = this._layout.grid;
		if (i === "1+5" || i === "1+7") {
			let e = t.page * t.perPage;
			n !== e && (this._swap(n, e), this._said = `${this._name(r)} in the large slot.`), this._focus = 0;
		} else this._alone = r, this._said = `${this._name(r)} alone on the screen. Escape, or a double tap, to go back.`;
	}
	_goPage(e) {
		let { pages: t } = this._view;
		this._page = (e % t + t) % t, this._focus = 0, this._picked = void 0, this._said = `Page ${String(this._page + 1)} of ${String(t)}.`;
	}
	_onKey(e, t) {
		if (e.target !== e.currentTarget) return;
		let n = this._view, r = j[e.key];
		if (r) {
			e.preventDefault();
			let i = ie(n.plan, t, r);
			if (i === void 0) return;
			if (e.shiftKey && !this._alone) {
				let e = n.page * n.perPage;
				this._swap(e + t, e + i);
			}
			this._focus = i, this._refocus = !0;
		} else e.key === "Enter" || e.key === "Escape" && this._alone ? (e.preventDefault(), this._enlarge(t), this._refocus = !0) : (e.key === "PageDown" || e.key === "PageUp") && (e.preventDefault(), this._goPage(n.page + (e.key === "PageDown" ? 1 : -1)), this._refocus = !0);
	}
	_tap(e) {
		let t = this._view, n = t.page * t.perPage + e;
		this._picked === void 0 ? (this._picked = n, this._said = `${this._name(t.order[n])} picked: tap where it goes.`) : (this._picked === n ? this._said = "Put back." : this._swap(this._picked, n), this._picked = void 0);
	}
	_syncTour() {
		let e = this._view, t = this._layout.tour_s ?? 0;
		t > 0 && e.pages > 1 && !this._arranging && !this._editing && !this._alone && !this._full ? (this._tour === void 0 || this._tourEvery !== t) && (this._stopTour(), this._tourEvery = t, this._tour = setInterval(() => {
			let { pages: e, page: t } = this._view;
			this._page = (t + 1) % e;
		}, t * 1e3)) : this._stopTour();
	}
	_stopTour() {
		clearInterval(this._tour), this._tour = void 0, this._tourEvery = 0;
	}
	render() {
		let e = this._layout, t = this._data.cameras, i = this._view, { width: a, height: o } = this._size, s = this.layoutId !== void 0 && this._layouts !== void 0 && e.id !== this.layoutId, c = document.fullscreenEnabled && typeof this.requestFullscreen == "function", l = this._detecting(), u = new Map(S([...t ?? []]).map((e, t) => [e.id, t + 1]));
		return r`${this.card ? this._renderCardBar(e, i, s, c) : this._renderBar(e, i, s, c)}
      ${this._editing ? this._renderEditor(e) : this._error ? r`<p class="error" role="alert">${this._error}</p>` : n}
      ${t === void 0 ? r`<p class="note pad">${this._data.error ? `Live view could not load: ${this._data.error}` : "Loading…"}</p>` : this._renderCells(i.plan, i.shown, a, o, l, u)}
      ${t && this._shown.strip ? r`<rv-wall-strip
            .hass=${this.hass}
            .cameras=${S([...t])}
            .numbers=${u}
            .now=${l}
            .pictures=${this._data.images}
            @rv-strip-live=${(e) => {
			this._showLarge(e.detail.cameraId);
		}}
          ></rv-wall-strip>` : n}
      <p class="said" role="status" aria-live="polite">${this._said}</p>`;
	}
	_renderBar(e, t, i, a) {
		return r`<div class="bar">
        <select
          aria-label="Layout"
          .value=${e.id}
          @change=${(e) => {
			this._show(e.target.value);
		}}
        >
          <option value="" ?selected=${!e.id}>All cameras</option>
          ${(this._layouts ?? []).map((t) => r`<option value=${t.id} ?selected=${t.id === e.id}>${t.name}</option>`)}
        </select>
        ${t.pages > 1 ? this._renderPages(t) : n}
        ${this._alone ? r`<button
              class="text with-icon"
              @click=${() => {
			this._enlarge(0);
		}}
            >
              ${g("chevronBack")}Back to the layout
            </button>` : n}
        ${this._order && !e.id ? r`<span class="note">Save it as a layout to keep this order</span>` : n}
        ${i ? r`<span class="note">No layout “${this.layoutId}”: every camera instead</span>` : n}
        <time class="clock" aria-label="Time">${y(this._now, this.hass?.config?.time_zone)}</time>
        <button
          class="text"
          aria-pressed=${this._arranging ? "true" : "false"}
          @click=${() => {
			this._arranging = !this._arranging, this._picked = void 0, this._said = this._arranging ? "Arrange: tap a camera, then where it goes." : "";
		}}
        >
          Arrange
        </button>
        <button
          class="text with-icon"
          aria-expanded=${this._editing ? "true" : "false"}
          @click=${() => {
			this._editing ? this._editing = !1 : this._edit();
		}}
        >
          Layout${g("chevronDown")}
        </button>
        ${a ? this._renderFullButton() : n}
        <button
          class="text with-icon"
          @click=${() => {
			C("board"), x(this, { view: "live" });
		}}
        >
          ${g("close")}Board
        </button>
      </div>`;
	}
	_renderPages(e) {
		return r`<span class="pages" role="group" aria-label="Pages">
      <button
        class="text icon-only"
        aria-label="Previous page"
        @click=${() => {
			this._goPage(e.page - 1);
		}}
      >
        ${g("chevronBack")}
      </button>
      <span>${e.page + 1} / ${e.pages}</span>
      <button
        class="text icon-only"
        aria-label="Next page"
        @click=${() => {
			this._goPage(e.page + 1);
		}}
      >
        ${g("chevron")}
      </button>
    </span>`;
	}
	_renderFullButton() {
		return r`<button
      class="text with-icon"
      @click=${() => {
			this._toggleFull();
		}}
    >
      ${g(this._wallFull ? "exitFull" : "enterFull")}${this._wallFull ? "Exit full screen" : "Full screen"}
    </button>`;
	}
	_renderCardBar(e, t, i, a) {
		return this.showBar ? r`<div class="bar">
      <span class="name">${e.name}</span>
      ${t.pages > 1 ? this._renderPages(t) : n}
      ${i ? r`<span class="note">No layout “${this.layoutId ?? ""}” of yours: every camera instead</span>` : n}
      <time class="clock" aria-label="Time">${y(this._now, this.hass?.config?.time_zone)}</time>
      ${a ? this._renderFullButton() : n}
    </div>` : n;
	}
	_renderCells(e, t, i, a, s, c) {
		let l = this._editing ? this._draft.grid : this._layout.grid, u = e.slots.map((n, r) => {
			let o = t[r];
			if (!o) return;
			let s = R(e, n, i, a), c = this._alone ? "alone on the screen" : (l === "1+5" || l === "1+7") && r === 0 ? "the large slot" : void 0;
			return {
				camera: o,
				...s,
				fit: z(se(o), s),
				...c ? { large: c } : {}
			};
		}), d = H(u, globalThis.devicePixelRatio || 1);
		return r`<div
      class="cells"
      style=${`grid-template-columns: repeat(${String(e.cols)}, minmax(0, 1fr)); grid-template-rows: repeat(${String(e.rows)}, minmax(0, 1fr))`}
      @rv-live-full=${(e) => {
			e.detail.full ? this._full = e.detail.cameraId : this._full === e.detail.cameraId && (this._full = void 0);
		}}
    >
      ${e.slots.map((i, a) => {
			let l = `grid-column: ${String(i.col + 1)} / span ${String(i.cols)}; grid-row: ${String(i.row + 1)} / span ${String(i.rows)}`, f = t[a], p = this._view, h = p.page * p.perPage + a, g = f?.name ?? "Empty cell", _ = f ? s.get(f.id) : void 0, v = this._alone ? "alone on the screen" : `cell ${String(a + 1)} of ${String(e.slots.length)}`;
			return r`<div
          class="cell ${this._picked === h ? "picked" : ""} ${this._over === a ? "over" : ""}"
          style=${l}
          data-slot=${a}
          tabindex=${this._focus === a ? "0" : "-1"}
          aria-label=${`${g}, ${v}${_ ? `, now: ${E(_.types)}` : ""}`}
          role="group"
          aria-roledescription="Wall cell"
          draggable=${this._alone ? "false" : "true"}
          @keydown=${(e) => {
				this._onKey(e, a);
			}}
          @focus=${() => {
				this._focus = a;
			}}
          @dblclick=${() => {
				this._focus = a, this._enlarge(a);
			}}
          @dragstart=${(e) => {
				this._dragged = h, e.dataTransfer?.setData("text/plain", String(h)), e.dataTransfer && (e.dataTransfer.effectAllowed = "move");
			}}
          @dragend=${() => {
				this._dragged = void 0, this._over = void 0;
			}}
          @dragover=${(e) => {
				e.preventDefault(), this._over = a;
			}}
          @dragleave=${() => {
				this._over === a && (this._over = void 0);
			}}
          @drop=${(e) => {
				e.preventDefault(), this._over = void 0;
				let t = e.dataTransfer?.getData("text/plain"), n = t ? Number(t) : this._dragged;
				this._dragged = void 0, n !== void 0 && Number.isInteger(n) && this._swap(n, h);
			}}
        >
          ${f ? r`<rv-live-tile
                fill
                .fit=${u[a]?.fit ?? "cover"}
                .tileHd=${d.get(f.id)}
                .number=${c.get(f.id)}
                .hass=${this.hass}
                .camera=${f}
                .connection=${m(f)}
                .image=${this._data.images[f.id]}
                .iceServers=${this._data.iceServers}
                .warm=${o(this.hass, f)}
                .suspended=${this._full !== void 0 && this._full !== f.id || this._asleep}
                .controls=${this._controls(f)}
                .detecting=${_ ? {
				label: E(_.types),
				icon: k(_.types)
			} : void 0}
              ></rv-live-tile>` : r`<div class="empty"></div>`}
          ${this._arranging ? r`<button
                class="pick"
                aria-pressed=${this._picked === h ? "true" : "false"}
                aria-label=${f ? `Move ${f.name}` : `Empty cell ${String(a + 1)}`}
                @click=${() => {
				this._tap(a);
			}}
              ></button>` : n}
        </div>`;
		})}
    </div>`;
	}
	_renderEditor(e) {
		return r`<form
      class="editor"
      aria-label="Layout"
      @submit=${(e) => {
			e.preventDefault(), this._save(!1);
		}}
    >
      <label class="name">
        <span>Name</span>
        <input
          maxlength="60"
          .value=${this._draft.name}
          placeholder="Front of the house"
          @input=${(e) => {
			this._draft = {
				...this._draft,
				name: e.target.value
			};
		}}
        />
      </label>
      <fieldset class="grids">
        <legend>Grid</legend>
        ${M.map(({ grid: e, label: t }) => r`<label class="grid-choice">
              <input
                type="radio"
                name="grid"
                value=${e}
                .checked=${this._draft.grid === e}
                @change=${() => {
			this._draft = {
				...this._draft,
				grid: e
			};
		}}
              />${ue(e)}<span>${t}</span>
            </label>`)}
      </fieldset>
      <label class="name">
        <span>Tour</span>
        <select
          .value=${String(this._draft.tour_s ?? "")}
          @change=${(e) => {
			let t = e.target.value;
			this._draft = {
				...this._draft,
				tour_s: t ? Number(t) : null
			};
		}}
        >
          ${le.map(([e, t]) => r`<option value=${String(e ?? "")} ?selected=${this._draft.tour_s === e}>${t}</option>`)}
        </select>
      </label>
      <fieldset class="shows">
        <legend>Show</legend>
        ${ce.map(([e, t]) => r`<label class="check">
              <input
                type="checkbox"
                .checked=${this._draft[e]}
                @change=${(t) => {
			this._draft = {
				...this._draft,
				[e]: t.target.checked
			};
		}}
              />${t}
            </label>`)}
      </fieldset>
      <div class="actions">
        <button type="submit">${e.id ? "Save" : "Save layout"}</button>
        ${e.id ? r`<button
                type="button"
                @click=${() => {
			this._save(!0);
		}}
              >
                Save as new
              </button>
              <button
                type="button"
                class="text danger"
                @click=${() => {
			this._delete();
		}}
              >
                Delete
              </button>` : n}
        <button
          type="button"
          class="text"
          @click=${() => {
			this._editing = !1, this._error = void 0;
		}}
        >
          Cancel
        </button>
      </div>
      ${this._error ? r`<p class="error" role="alert">${this._error}</p>` : n}
      <p class="note">
        Saved for you on this Home Assistant: every device you sign in on can show it, at
        <code>#wall/${e.id || "<name>"}</code>. This device remembers the one it shows.
      </p>
    </form>`;
	}
	static styles = [f, e`
      :host {
        display: flex;
        flex-direction: column;
        height: 100vh;
        height: 100dvh;
        overflow: hidden;
        color: var(--rv-on-board);
        background: var(--rv-board);
      }
      /* A dashboard card: as tall as the dashboard makes it. */
      :host([card]) {
        height: 100%;
      }
      /* Still for IDLE_CURSOR_MS: no pointer over the feeds (step 5's kiosk). */
      :host([idle]) {
        cursor: none;
        --rv-pointer: none;
      }
      .bar .name {
        font-size: 15px;
        font-weight: 500;
      }
      .bar {
        flex: none;
        display: flex;
        align-items: center;
        gap: 6px 14px;
        min-height: 40px;
        padding: 0 12px;
        flex-wrap: wrap;
      }
      .bar select {
        max-width: 40vw;
        min-height: 32px;
        padding: 0 8px;
        border: 1px solid var(--rv-on-board-muted);
        border-radius: 0;
        background: transparent;
        color: var(--rv-on-board);
        font: inherit;
        font-size: 15px;
        font-weight: 500;
      }
      .bar select option {
        color: var(--rv-text);
        background: var(--rv-ground);
      }
      .clock {
        margin-left: auto;
        font-family: var(--rv-font-cond);
        font-size: 20px;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
      }
      .bar button.text {
        min-height: 32px;
        color: var(--rv-on-board);
      }
      .bar button:focus-visible,
      .bar select:focus-visible {
        outline-color: var(--rv-on-board);
      }
      .note {
        margin: 0;
        color: var(--rv-on-board-muted);
        font-size: 14px;
      }
      .pad {
        padding: 12px;
      }
      .error {
        margin: 0;
        padding: 6px 12px;
        color: var(--rv-fault);
      }
      .cells {
        flex: 1;
        min-height: 0;
        display: grid;
        gap: ${4}px;
        padding: 0 ${4}px ${4}px;
      }
      .cell {
        position: relative;
        display: grid;
        min-width: 0;
        min-height: 0;
      }
      .cell > rv-live-tile,
      .cell > .empty {
        min-width: 0;
        min-height: 0;
      }
      .cell:focus-visible {
        outline: 3px solid var(--rv-on-board);
        outline-offset: -3px;
        z-index: 1;
      }
      .cell.over {
        outline: 3px dashed var(--rv-on-board);
        outline-offset: -3px;
      }
      .empty {
        background: color-mix(in srgb, var(--rv-on-board) 4%, transparent);
      }
      /* Arrange: a tap target over each cell, the picked one ringed. */
      .pick {
        position: absolute;
        inset: 0;
        border: 2px dashed color-mix(in srgb, var(--rv-on-board) 50%, transparent);
        border-radius: 0;
        background: color-mix(in srgb, var(--rv-board) 25%, transparent);
        cursor: var(--rv-pointer, pointer);
      }
      .pick[aria-pressed="true"] {
        border: 4px solid var(--rv-on-board);
        background: color-mix(in srgb, var(--rv-on-board) 15%, transparent);
      }
      .pick:focus-visible {
        outline: 3px solid var(--rv-on-board);
        outline-offset: -6px;
      }
      .pages {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        font-variant-numeric: tabular-nums;
      }
      .pages button svg {
        width: 20px;
        height: 20px;
      }
      .bar button[aria-pressed="true"] {
        text-decoration: underline;
        text-underline-offset: 4px;
      }
      .editor select {
        min-height: 34px;
        padding: 0 8px;
        border: 1px solid var(--rv-on-board-muted);
        border-radius: 0;
        background: transparent;
        color: var(--rv-on-board);
        font: inherit;
      }
      .editor select option {
        color: var(--rv-text);
        background: var(--rv-ground);
      }
      .said {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }
      .editor {
        flex: none;
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        gap: 10px 20px;
        padding: 10px 12px 12px;
        border-top: 1px solid color-mix(in srgb, var(--rv-on-board) 20%, transparent);
        border-bottom: 1px solid color-mix(in srgb, var(--rv-on-board) 20%, transparent);
      }
      .editor .name {
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: 14px;
      }
      .editor input:not([type]) {
        min-height: 34px;
        width: 16rem;
        max-width: 70vw;
        padding: 0 8px;
        border: 1px solid var(--rv-on-board-muted);
        background: transparent;
        color: var(--rv-on-board);
        font: inherit;
      }
      .grids {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin: 0;
        padding: 0;
        border: none;
      }
      .grids legend {
        padding: 0 0 4px;
        font-size: 14px;
      }
      .grid-choice {
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        padding: 4px 6px;
        border: 1px solid color-mix(in srgb, var(--rv-on-board) 30%, transparent);
        font-size: 13px;
        cursor: var(--rv-pointer, pointer);
      }
      .grid-choice:has(input:checked) {
        border-color: var(--rv-on-board);
        background: color-mix(in srgb, var(--rv-on-board) 12%, transparent);
      }
      .grid-choice input {
        position: absolute;
        opacity: 0;
        width: 1px;
        height: 1px;
      }
      .grid-choice:has(input:focus-visible) {
        outline: 2px solid var(--rv-on-board);
        outline-offset: 2px;
      }
      .grid-choice svg {
        width: 32px;
        height: 20px;
      }
      .grid-choice rect {
        fill: currentColor;
        opacity: 0.7;
      }
      .actions {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .actions button:not(.text) {
        min-height: 34px;
      }
      /* On the board's ink: the page's blue is too dark to read here. */
      .actions button.text {
        color: var(--rv-on-board);
      }
      .actions button.text:focus-visible,
      .editor input:focus-visible {
        outline-color: var(--rv-on-board);
      }
      .actions .danger {
        color: var(--rv-fault);
      }
      .editor .note {
        flex-basis: 100%;
      }
      .shows {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 14px;
        margin: 0;
        padding: 0;
        border: none;
        font-size: 14px;
      }
      .shows legend {
        padding: 0 0 4px;
      }
      .shows .check {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-height: 32px;
      }
      .editor code {
        font-family: var(--rv-mono);
      }
    `];
}, Q = {
	floodlight: !0,
	siren: !0,
	strip: !0
}, ce = [
	["floodlight", "Floodlight buttons"],
	["siren", "Siren buttons"],
	["strip", "Latest detections"]
];
function $(e) {
	return {
		floodlight: e.floodlight !== !1,
		siren: e.siren !== !1,
		strip: e.strip !== !1
	};
}
var le = [
	[null, "Off"],
	[10, "Every 10 s"],
	[20, "Every 20 s"],
	[30, "Every 30 s"],
	[60, "Every minute"],
	[120, "Every 2 minutes"]
];
function ue(e) {
	let n = L(e, Array.from({ length: 6 }, () => void 0), 160, 90), i = 32 / n.cols, a = 20 / n.rows;
	return r`<svg viewBox="0 0 32 20" aria-hidden="true">
    ${n.slots.map((e) => t`<rect
          x=${(e.col * i + .5).toFixed(2)}
          y=${(e.row * a + .5).toFixed(2)}
          width=${(e.cols * i - 1).toFixed(2)}
          height=${(e.rows * a - 1).toFixed(2)}
        ></rect>`)}
  </svg>`;
}
customElements.get("rv-wall") || customElements.define("rv-wall", Z);
//#endregion
export { Y as ALL_CAMERAS, X as IDLE_CURSOR_MS, Z as RvWall, $ as shownBy, oe as wallCameras };

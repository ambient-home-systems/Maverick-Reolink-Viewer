import { a as e, i as t, n, r, t as i } from "./lit-DdRjbP0M.js";
import { F as a, L as o, Nt as s, Ot as c, Q as l, R as u, St as d, X as f, d as p, j as m } from "./live-Cc-EfYb9.js";
import { H as h, J as g, K as _, R as v, q as y, z as b } from "./home-DwvOEeee.js";
//#region src/wall/arrange.ts
function x(e, t) {
	return e.cameras.length ? [...e.cameras] : [...t];
}
function S(e, t) {
	return Math.max(1, Math.ceil(e / Math.max(1, t)));
}
function C(e, t, n) {
	let r = [...e];
	for (; r.length <= Math.max(t, n);) r.push(null);
	for ([r[t], r[n]] = [r[n] ?? null, r[t] ?? null]; r.length && r.at(-1) === null;) r.pop();
	return r;
}
function w(e, t, n) {
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
var T = {
	ArrowLeft: "left",
	ArrowRight: "right",
	ArrowUp: "up",
	ArrowDown: "down"
}, E = [
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
], D = (e) => ({
	cols: e,
	rows: e,
	slots: Array.from({ length: e * e }, (t, n) => ({
		col: n % e,
		row: Math.floor(n / e),
		cols: 1,
		rows: 1
	}))
}), O = (e) => {
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
function k(e, t) {
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
function A(e, t, n) {
	let r = e.length ? e : [void 0], i = r.reduce((e, t) => e + (t ? 2 : 1), 0), a;
	for (let e = 1; e <= i; e += 1) {
		let { slots: i, rows: o } = k(r, e), s = (t - (e - 1) * 4) / e, c = (n - (o - 1) * 4) / o, l = Math.min(s, c * 16 / 9);
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
function j(e, t, n, r) {
	switch (e) {
		case "1": return D(1);
		case "2x2": return D(2);
		case "3x3": return D(3);
		case "4x4": return D(4);
		case "1+5": return O(3);
		case "1+7": return O(4);
		case "auto": return A(t, n, r);
	}
}
function M(e, t, n, r) {
	let i = (n - (e.cols - 1) * 4) / e.cols, a = (r - (e.rows - 1) * 4) / e.rows;
	return {
		width: i * t.cols + (t.cols - 1) * 4,
		height: a * t.rows + (t.rows - 1) * 4
	};
}
function N(e, t) {
	return !e || !t.width || !t.height ? "cover" : e > t.width / t.height * 1.02 ? "contain" : "cover";
}
function P(e, t, n = 1) {
	let r = e?.streams.sub?.encoding;
	if (!r?.width || !r.height || !t.width || !t.height) return;
	let i = t.width * n / r.width, a = t.height * n / r.height;
	return t.fit === "cover" ? Math.max(i, a) : Math.min(i, a);
}
var F = (e, t) => `${String(e)} ${t}${e === 1 ? "" : "s"}`;
function I(e, t = 1) {
	let n = /* @__PURE__ */ new Map(), r = [];
	e.forEach((e, i) => {
		if (!e) return;
		let a = u(e.camera);
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
		let c = P(a, e, t);
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
			reason: `SD: ${t.entry_title} plays ${F(o, "HD tile")} at once, and ${s.join(", ")} ${s.length === 1 ? "has" : "have"} it`
		});
	}
	return n;
}
//#endregion
//#region src/components/wall.ts
var L = {
	id: "",
	name: "All cameras",
	grid: "auto",
	cameras: [],
	tour_s: null
};
function R(e, t) {
	if (!e.cameras.length) return v([...t]);
	let n = new Map(t.map((e) => [e.id, e]));
	return e.cameras.map((e) => e ? n.get(e) : void 0);
}
function z(e) {
	let t = u(e)?.streams.sub?.encoding;
	return t?.width && t.height ? t.width / t.height : void 0;
}
var B = class extends i {
	static properties = {
		hass: { attribute: !1 },
		layoutId: { attribute: !1 },
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
	_data = new a(this);
	_resize;
	_clock;
	_tour;
	_tourEvery = 0;
	_asked = !1;
	_arranged;
	_refocus = !1;
	_dragged;
	constructor() {
		super(), this._editing = !1, this._draft = {
			name: "",
			grid: "auto",
			tour_s: null
		}, this._page = 0, this._arranging = !1, this._focus = 0, this._said = "", this._size = {
			width: 0,
			height: 0
		}, this._wallFull = !1, this._now = Date.now();
	}
	connectedCallback() {
		super.connectedCallback(), y("wall"), document.addEventListener("fullscreenchange", this._onFullscreen), this._tick();
	}
	disconnectedCallback() {
		super.disconnectedCallback(), document.removeEventListener("fullscreenchange", this._onFullscreen), this._resize?.disconnect(), this._resize = void 0, clearTimeout(this._clock), this._stopTour();
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
		this._data.hass = this.hass, e.has("hass") && this.hass && !this._asked && (this._asked = !0, this._loadLayouts(this.hass));
		let t = this._layout.id;
		t !== this._arranged && (this._arranged = t, this._order = void 0, this._page = 0, this._alone = void 0, this._picked = void 0, this._focus = 0);
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
		this._layouts !== void 0 && _(t.id || void 0), this._syncTour(), this._refocus && (this._refocus = !1, this.shadowRoot?.querySelector(`.cell[data-slot="${String(this._focus)}"]`)?.focus());
	}
	async _loadLayouts(e) {
		try {
			this._layouts = (await d(e)).layouts;
		} catch (e) {
			this._layouts = [], this._error = `The saved layouts could not be read: ${s(e).message}`;
		}
	}
	get _layout() {
		let e = this._layouts ?? [], t = this.layoutId ?? g();
		return e.find((e) => e.id === t) ?? L;
	}
	_toggleFull() {
		document.fullscreenElement === this ? document.exitFullscreen().catch(() => void 0) : this.requestFullscreen().catch(() => void 0);
	}
	_show(e) {
		e || _(void 0), h(this, e ? {
			view: "wall",
			layout: e
		} : { view: "wall" });
	}
	_edit() {
		let e = this._layout;
		this._draft = {
			name: e.id ? e.name : "",
			grid: e.grid,
			tour_s: e.tour_s
		}, this._error = void 0, this._editing = !0;
	}
	async _save(e) {
		let t = this.hass;
		if (!t) return;
		let n = this._layout, r = this._draft.name.trim();
		if (!r) this._error = "Give the layout a name.";
		else try {
			let { layout: i } = await c(t, {
				...n.id && !e ? { id: n.id } : {},
				name: r,
				grid: this._draft.grid,
				cameras: this._order ?? n.cameras,
				tour_s: this._draft.tour_s
			});
			await this._loadLayouts(t), this._editing = !1, this._error = void 0, h(this, {
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
			await l(e, t.id), await this._loadLayouts(e), this._editing = !1, this._show("");
		} catch (e) {
			this._error = `Could not delete it: ${s(e).message}`;
		}
	}
	get _view() {
		let e = this._layout, t = this._editing ? this._draft.grid : e.grid, n = this._data.cameras ?? [], r = new Map(n.map((e) => [e.id, e])), i = this._order ?? x(e, v([...n]).map((e) => e.id)), { width: a, height: o } = this._size, s = (e) => e.map((e) => e ? b(u(e)) : void 0);
		if (this._alone && r.has(this._alone)) return {
			order: i,
			perPage: 1,
			pages: 1,
			page: 0,
			shown: [r.get(this._alone)],
			plan: j("1", [], a, o)
		};
		let c = t === "auto" ? Math.max(1, i.length) : j(t, [], a, o).slots.length, l = S(i.length, c), d = Math.min(this._page, l - 1), f = i.slice(d * c, (d + 1) * c).map((e) => e ? r.get(e) : void 0);
		return {
			order: i,
			perPage: c,
			pages: l,
			page: d,
			shown: f,
			plan: j(t, s(f), a, o)
		};
	}
	_name(e) {
		return this._data.cameras?.find((t) => t.id === e)?.name ?? "An empty cell";
	}
	_swap(e, t) {
		let { order: n } = this._view;
		if (e === t) return;
		let r = C(n, e, t);
		this._order = r, this._said = `${this._name(n[e])} swapped with ${this._name(n[t]).toLowerCase() === "an empty cell" ? "an empty cell" : this._name(n[t])}.`, this._keep(r);
	}
	async _keep(e) {
		let t = this.hass, n = this._layout;
		if (t && n.id) try {
			let { layout: r } = await c(t, {
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
		let n = this._view, r = T[e.key];
		if (r) {
			e.preventDefault();
			let i = w(n.plan, t, r);
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
		let e = this._layout, t = this._data.cameras, i = this._view, { width: a, height: o } = this._size, s = this.layoutId !== void 0 && this._layouts !== void 0 && e.id !== this.layoutId, c = document.fullscreenEnabled && typeof this.requestFullscreen == "function";
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
        ${i.pages > 1 ? r`<span class="pages" role="group" aria-label="Pages">
              <button
                class="text icon-only"
                aria-label="Previous page"
                @click=${() => {
			this._goPage(i.page - 1);
		}}
              >
                ${f("chevronBack")}
              </button>
              <span>${i.page + 1} / ${i.pages}</span>
              <button
                class="text icon-only"
                aria-label="Next page"
                @click=${() => {
			this._goPage(i.page + 1);
		}}
              >
                ${f("chevron")}
              </button>
            </span>` : n}
        ${this._alone ? r`<button
              class="text with-icon"
              @click=${() => {
			this._enlarge(0);
		}}
            >
              ${f("chevronBack")}Back to the layout
            </button>` : n}
        ${this._order && !e.id ? r`<span class="note">Save it as a layout to keep this order</span>` : n}
        ${s ? r`<span class="note">No layout “${this.layoutId}”: every camera instead</span>` : n}
        <time class="clock" aria-label="Time">${p(this._now, this.hass?.config?.time_zone)}</time>
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
          Layout${f("chevronDown")}
        </button>
        ${c ? r`<button
              class="text with-icon"
              @click=${() => {
			this._toggleFull();
		}}
            >
              ${f(this._wallFull ? "exitFull" : "enterFull")}${this._wallFull ? "Exit full screen" : "Full screen"}
            </button>` : n}
        <button
          class="text with-icon"
          @click=${() => {
			y("board"), h(this, { view: "live" });
		}}
        >
          ${f("close")}Board
        </button>
      </div>
      ${this._editing ? this._renderEditor(e) : this._error ? r`<p class="error" role="alert">${this._error}</p>` : n}
      ${t === void 0 ? r`<p class="note pad">${this._data.error ? `Live view could not load: ${this._data.error}` : "Loading…"}</p>` : this._renderCells(i.plan, i.shown, a, o)}
      <p class="said" role="status" aria-live="polite">${this._said}</p>`;
	}
	_renderCells(e, t, i, a) {
		let s = new Map(v([...this._data.cameras ?? []]).map((e, t) => [e.id, t + 1])), c = this._editing ? this._draft.grid : this._layout.grid, l = e.slots.map((n, r) => {
			let o = t[r];
			if (!o) return;
			let s = M(e, n, i, a), l = this._alone ? "alone on the screen" : (c === "1+5" || c === "1+7") && r === 0 ? "the large slot" : void 0;
			return {
				camera: o,
				...s,
				fit: N(z(o), s),
				...l ? { large: l } : {}
			};
		}), d = I(l, globalThis.devicePixelRatio || 1);
		return r`<div
      class="cells"
      style=${`grid-template-columns: repeat(${String(e.cols)}, minmax(0, 1fr)); grid-template-rows: repeat(${String(e.rows)}, minmax(0, 1fr))`}
      @rv-live-full=${(e) => {
			e.detail.full ? this._full = e.detail.cameraId : this._full === e.detail.cameraId && (this._full = void 0);
		}}
    >
      ${e.slots.map((i, a) => {
			let c = `grid-column: ${String(i.col + 1)} / span ${String(i.cols)}; grid-row: ${String(i.row + 1)} / span ${String(i.rows)}`, f = t[a], p = this._view, m = p.page * p.perPage + a, h = f?.name ?? "Empty cell", g = this._alone ? "alone on the screen" : `cell ${String(a + 1)} of ${String(e.slots.length)}`;
			return r`<div
          class="cell ${this._picked === m ? "picked" : ""} ${this._over === a ? "over" : ""}"
          style=${c}
          data-slot=${a}
          tabindex=${this._focus === a ? "0" : "-1"}
          aria-label=${`${h}, ${g}`}
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
				this._dragged = m, e.dataTransfer?.setData("text/plain", String(m)), e.dataTransfer && (e.dataTransfer.effectAllowed = "move");
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
				this._dragged = void 0, n !== void 0 && Number.isInteger(n) && this._swap(n, m);
			}}
        >
          ${f ? r`<rv-live-tile
                fill
                .fit=${l[a]?.fit ?? "cover"}
                .tileHd=${d.get(f.id)}
                .number=${s.get(f.id)}
                .hass=${this.hass}
                .camera=${f}
                .connection=${u(f)}
                .image=${this._data.images[f.id]}
                .iceServers=${this._data.iceServers}
                .warm=${o(this.hass, f)}
                .suspended=${this._full !== void 0 && this._full !== f.id}
                .controls=${f.controls}
              ></rv-live-tile>` : r`<div class="empty"></div>`}
          ${this._arranging ? r`<button
                class="pick"
                aria-pressed=${this._picked === m ? "true" : "false"}
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
        ${E.map(({ grid: e, label: t }) => r`<label class="grid-choice">
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
              />${H(e)}<span>${t}</span>
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
          ${V.map(([e, t]) => r`<option value=${String(e ?? "")} ?selected=${this._draft.tour_s === e}>${t}</option>`)}
        </select>
      </label>
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
	static styles = [m, e`
      :host {
        display: flex;
        flex-direction: column;
        height: 100vh;
        height: 100dvh;
        overflow: hidden;
        color: var(--rv-on-board);
        background: var(--rv-board);
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
        cursor: pointer;
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
        cursor: pointer;
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
      .editor code {
        font-family: var(--rv-mono);
      }
    `];
}, V = [
	[null, "Off"],
	[10, "Every 10 s"],
	[20, "Every 20 s"],
	[30, "Every 30 s"],
	[60, "Every minute"],
	[120, "Every 2 minutes"]
];
function H(e) {
	let n = j(e, Array.from({ length: 6 }, () => void 0), 160, 90), i = 32 / n.cols, a = 20 / n.rows;
	return r`<svg viewBox="0 0 32 20" aria-hidden="true">
    ${n.slots.map((e) => t`<rect
          x=${(e.col * i + .5).toFixed(2)}
          y=${(e.row * a + .5).toFixed(2)}
          width=${(e.cols * i - 1).toFixed(2)}
          height=${(e.rows * a - 1).toFixed(2)}
        ></rect>`)}
  </svg>`;
}
customElements.get("rv-wall") || customElements.define("rv-wall", B);
//#endregion
export { L as ALL_CAMERAS, B as RvWall, R as wallCameras };

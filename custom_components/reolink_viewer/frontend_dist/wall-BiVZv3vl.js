import { a as e, i as t, n, r, t as i } from "./lit-DdRjbP0M.js";
import { F as a, L as o, Nt as s, Ot as c, Q as l, R as u, St as d, X as f, d as p, j as m } from "./live-BgF9G32W.js";
import { H as h, J as g, K as _, R as v, q as y, z as b } from "./home-5sgcocLr.js";
var x = [
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
], S = (e) => ({
	cols: e,
	rows: e,
	slots: Array.from({ length: e * e }, (t, n) => ({
		col: n % e,
		row: Math.floor(n / e),
		cols: 1,
		rows: 1
	}))
}), C = (e) => {
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
function w(e, t) {
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
function T(e, t, n) {
	let r = e.length ? e : [void 0], i = r.reduce((e, t) => e + (t ? 2 : 1), 0), a;
	for (let e = 1; e <= i; e += 1) {
		let { slots: i, rows: o } = w(r, e), s = (t - (e - 1) * 4) / e, c = (n - (o - 1) * 4) / o, l = Math.min(s, c * 16 / 9);
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
function E(e, t, n, r) {
	switch (e) {
		case "1": return S(1);
		case "2x2": return S(2);
		case "3x3": return S(3);
		case "4x4": return S(4);
		case "1+5": return C(3);
		case "1+7": return C(4);
		case "auto": return T(t, n, r);
	}
}
function D(e, t, n, r) {
	let i = (n - (e.cols - 1) * 4) / e.cols, a = (r - (e.rows - 1) * 4) / e.rows;
	return {
		width: i * t.cols + (t.cols - 1) * 4,
		height: a * t.rows + (t.rows - 1) * 4
	};
}
function O(e, t) {
	return !e || !t.width || !t.height ? "cover" : e > t.width / t.height * 1.02 ? "contain" : "cover";
}
//#endregion
//#region src/components/wall.ts
var k = {
	id: "",
	name: "All cameras",
	grid: "auto",
	cameras: [],
	tour_s: null
};
function A(e, t) {
	if (!e.cameras.length) return v([...t]);
	let n = new Map(t.map((e) => [e.id, e]));
	return e.cameras.map((e) => e ? n.get(e) : void 0);
}
function j(e) {
	let t = u(e)?.streams.sub?.encoding;
	return t?.width && t.height ? t.width / t.height : void 0;
}
var M = class extends i {
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
		_now: { state: !0 }
	};
	_data = new a(this);
	_resize;
	_clock;
	_asked = !1;
	constructor() {
		super(), this._editing = !1, this._draft = {
			name: "",
			grid: "auto"
		}, this._size = {
			width: 0,
			height: 0
		}, this._wallFull = !1, this._now = Date.now();
	}
	connectedCallback() {
		super.connectedCallback(), y("wall"), document.addEventListener("fullscreenchange", this._onFullscreen), this._tick();
	}
	disconnectedCallback() {
		super.disconnectedCallback(), document.removeEventListener("fullscreenchange", this._onFullscreen), this._resize?.disconnect(), this._resize = void 0, clearTimeout(this._clock);
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
		this._layouts !== void 0 && _(t.id || void 0);
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
		return e.find((e) => e.id === t) ?? k;
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
			grid: e.grid
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
				cameras: n.cameras,
				tour_s: n.tour_s
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
	render() {
		let e = this._layout, t = this._editing ? this._draft.grid : e.grid, i = this._data.cameras, a = i ? A(e, i) : [], { width: o, height: s } = this._size, c = E(t, a.map((e) => e ? b(u(e)) : void 0), o, s), l = Math.max(0, a.filter(Boolean).length - c.slots.length), d = this.layoutId !== void 0 && this._layouts !== void 0 && e.id !== this.layoutId, m = document.fullscreenEnabled && typeof this.requestFullscreen == "function";
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
        ${l ? r`<span class="note">${l} more ${l === 1 ? "camera" : "cameras"} than cells</span>` : n}
        ${d ? r`<span class="note">No layout “${this.layoutId}”: every camera instead</span>` : n}
        <time class="clock" aria-label="Time">${p(this._now, this.hass?.config?.time_zone)}</time>
        <button
          class="text with-icon"
          aria-expanded=${this._editing ? "true" : "false"}
          @click=${() => {
			this._editing ? this._editing = !1 : this._edit();
		}}
        >
          Layout${f("chevronDown")}
        </button>
        ${m ? r`<button
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
      ${i === void 0 ? r`<p class="note pad">${this._data.error ? `Live view could not load: ${this._data.error}` : "Loading…"}</p>` : this._renderCells(c, a, o, s)}`;
	}
	_renderCells(e, t, n, i) {
		let a = new Map(v([...this._data.cameras ?? []]).map((e, t) => [e.id, t + 1]));
		return r`<div
      class="cells"
      style=${`grid-template-columns: repeat(${String(e.cols)}, minmax(0, 1fr)); grid-template-rows: repeat(${String(e.rows)}, minmax(0, 1fr))`}
      @rv-live-full=${(e) => {
			e.detail.full ? this._full = e.detail.cameraId : this._full === e.detail.cameraId && (this._full = void 0);
		}}
    >
      ${e.slots.map((s, c) => {
			let l = `grid-column: ${String(s.col + 1)} / span ${String(s.cols)}; grid-row: ${String(s.row + 1)} / span ${String(s.rows)}`, d = t[c];
			return d ? r`<rv-live-tile
          style=${l}
          fill
          .fit=${O(j(d), D(e, s, n, i))}
          .number=${a.get(d.id)}
          .hass=${this.hass}
          .camera=${d}
          .connection=${u(d)}
          .image=${this._data.images[d.id]}
          .iceServers=${this._data.iceServers}
          .warm=${o(this.hass, d)}
          .suspended=${this._full !== void 0 && this._full !== d.id}
          .controls=${d.controls}
        ></rv-live-tile>` : r`<div class="empty" style=${l} aria-hidden="true"></div>`;
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
        ${x.map(({ grid: e, label: t }) => r`<label class="grid-choice">
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
              />${N(e)}<span>${t}</span>
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
      .cells > * {
        min-width: 0;
        min-height: 0;
      }
      .empty {
        background: color-mix(in srgb, var(--rv-on-board) 4%, transparent);
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
};
function N(e) {
	let n = E(e, Array.from({ length: 6 }, () => void 0), 160, 90), i = 32 / n.cols, a = 20 / n.rows;
	return r`<svg viewBox="0 0 32 20" aria-hidden="true">
    ${n.slots.map((e) => t`<rect
          x=${(e.col * i + .5).toFixed(2)}
          y=${(e.row * a + .5).toFixed(2)}
          width=${(e.cols * i - 1).toFixed(2)}
          height=${(e.rows * a - 1).toFixed(2)}
        ></rect>`)}
  </svg>`;
}
customElements.get("rv-wall") || customElements.define("rv-wall", M);
//#endregion
export { k as ALL_CAMERAS, M as RvWall, A as wallCameras };

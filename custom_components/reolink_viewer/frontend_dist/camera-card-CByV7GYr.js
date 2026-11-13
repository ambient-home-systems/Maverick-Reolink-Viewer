import { a as e, n as t, r as n, t as r } from "./lit-DdRjbP0M.js";
import { B as i, M as a, N as o, P as s, R as c, V as l, k as u, t as d, z as f } from "./live-BD2sk3pJ.js";
import { s as p } from "./config-D80frQMF.js";
import { n as m, t as h } from "./panel-C_Oja-Tm.js";
import { t as g } from "./tablet-Dzrlz5mg.js";
//#region src/card/camera-card.ts
var _ = /* @__PURE__ */ new Set(), v;
function y(e) {
	if (v !== e) {
		v = e;
		for (let e of _) e.requestUpdate();
	}
}
g.onSleep(() => {
	for (let e of _) e.requestUpdate();
});
function b(e) {
	m(`#device/${encodeURIComponent(e)}/live`);
}
function x(e, t) {
	let n = e?.streams[t]?.encoding ?? e?.streams.sub?.encoding, r = n?.width, i = n?.height;
	return r && i ? r / i : void 0;
}
var S = class extends r {
	static properties = {
		hass: { attribute: !1 },
		config: { attribute: !1 },
		_hd: { state: !0 }
	};
	_data = new c(this);
	_choosing;
	_unwatch;
	_doing = "loading";
	_startedAt = /* @__PURE__ */ new Map();
	_ringSeen;
	_ringTimer;
	_ringFull = !1;
	get _name() {
		return (this._data.cameras && this.config?.camera ? f(this._data.cameras, this.config.camera) : void 0)?.name ?? this.config?.camera ?? "Card";
	}
	connectedCallback() {
		super.connectedCallback(), d(import.meta.url), _.add(this), g.start(() => this.hass), this._unwatch = g.watch({
			name: () => this._name,
			video: () => this._tileElement()?.renderRoot.querySelector("video.sub") ?? null,
			state: () => this._doing
		});
	}
	disconnectedCallback() {
		super.disconnectedCallback(), _.delete(this), v === this && y(void 0), this._unwatch?.(), this._unwatch = void 0, clearTimeout(this._ringTimer), this._ringFull = !1, this._ringSeen = void 0;
	}
	_tileElement() {
		return this.renderRoot.querySelector("rv-live-tile");
	}
	updated() {
		let e = this._data.cameras && this.config?.camera ? f(this._data.cameras, this.config.camera) : void 0;
		e && this._ring(e);
	}
	_ring(e) {
		let t = e.visitor_entity, n = t ? this.hass?.states[t] : void 0, r = n ? `${n.state}@${n.last_changed}` : "", i = this._ringSeen === void 0;
		if (r === this._ringSeen) return;
		this._ringSeen = r;
		let a = this.config?.ring_full_screen ?? 0;
		if (i || !a || n?.state !== "on") return;
		let o = this._tileElement();
		if (!o) return;
		let s = g.wake();
		g.note("ring", e.name, `full screen for ${String(a)} s${s ? "; woke Fully Kiosk's screen" : ""}`), o.full || (o.enterFull(), this._ringFull = !0), clearTimeout(this._ringTimer), this._ringTimer = setTimeout(() => {
			this._ringFull && this._tileElement()?.exitFull(), this._ringFull = !1;
		}, a * 1e3);
	}
	_logPlayer(e, t) {
		let { which: n, state: r } = t, i = Date.now();
		switch (r.kind) {
			case "starting": {
				let t = r.after ? this._startedAt.get(n) : void 0;
				t === void 0 && this._startedAt.set(n, i), this._doing = "starting", g.note("starting", e, `${n} ${r.transport}${r.after && t !== void 0 ? `, after ${((i - t) / 1e3).toFixed(1)} s: ${r.after}` : ""}`);
				break;
			}
			case "playing": {
				let t = this._startedAt.get(n);
				this._doing = "playing", g.note("playing", e, `${n} ${r.transport}${t === void 0 ? "" : `, ${((i - t) / 1e3).toFixed(1)} s`}`);
				break;
			}
			case "waiting":
				this._doing = "retrying", g.note("retrying", e, `${n}: ${a(r.error).text}`);
				break;
			default: (n === "SD" || this.config?.quality === "hd") && (this._doing = "stopped"), g.note("stopped", e, n);
		}
	}
	willUpdate(e) {
		this.toggleAttribute("dark", this.hass?.themes?.darkMode === !0);
		let t = this.config?.camera, n = t ? [t] : [];
		if (e.has("config") && this._data.cameraIds?.join() !== n.join()) {
			let e = this._data.cameraIds !== void 0;
			this._data.cameraIds = n, e && this._data.reload();
		}
		this._data.hass = this.hass;
	}
	_stream(e) {
		if (this.config?.quality !== "hd") return "sub";
		let t = e.connection_id;
		if (this._hd?.connectionId === t) return this._hd.stream ?? "sub";
		this._choosing !== t && (this._choosing = t, u(e).then((e) => {
			this._choosing === t && (this._hd = {
				connectionId: t,
				stream: e.stream
			});
		}));
	}
	render() {
		let e = this.config, t = this._data;
		if (!e?.camera) return this._card(n`<p class="note">Choose a camera in this card's settings.</p>`);
		if (t.error) return this._card(n`<div class="banner error" role="alert">
          Could not load live view: ${t.error}
          <button
            @click=${() => {
			t.reload();
		}}
          >
            Try again
          </button>
        </div>`);
		if (!t.cameras) return this._card(n`<p class="note on-board">Loading…</p>`, !0);
		let r = f(t.cameras, e.camera);
		if (!r) return this._card(n`<p class="note">This camera cannot be watched live. Choose another in this card's settings.</p>`);
		let i = l(r), a = i ? this._stream(i) : "sub", o = x(i, a ?? "sub");
		return o && p(r.id, o), this._card(a === void 0 ? n`<p class="note on-board">Loading…</p>` : this._tile(r, i, a), !0, o);
	}
	_tile(e, t, r) {
		let a = this.config, o = a?.tap_action ?? "full_screen", s = e.name;
		return n`<rv-live-tile
      fill
      compact
      .fit=${a?.fit ?? "cover"}
      .hass=${this.hass}
      .camera=${e}
      .connection=${t}
      .stream=${r}
      .image=${this._data.images[e.id]}
      .iceServers=${this._data.iceServers}
      .warm=${r === "sub" ? i(this.hass, e) : void 0}
      .controls=${e.controls}
      .suspended=${g.asleep || v !== void 0 && v !== this}
      .hideName=${a?.show_name === !1}
      .hideState=${a?.show_state === !1}
      .tapLabel=${o === "open_panel" ? `Open ${s} in Reolink` : `${s} full screen`}
      ?openable=${o !== "none"}
      @rv-live-open=${(t) => {
			t.stopPropagation(), o === "open_panel" ? b(e.id) : t.target.enterFull();
		}}
      @rv-live-full=${(e) => {
			e.stopPropagation(), e.detail.full ? y(this) : (this._ringFull = !1, v === this && y(void 0));
		}}
      @rv-live-player=${(e) => {
			this._logPlayer(s, e.detail);
		}}
    ></rv-live-tile>`;
	}
	_card(e, r = !1, i) {
		return n`<ha-card>
      ${r ? n`<div class="frame" style=${i ? `--ratio: ${i.toFixed(4)}` : t}>${e}</div>` : n`<div class="message">${e}</div>`}
    </ha-card>`;
	}
	static styles = [
		o,
		s,
		e`
      /* Around the video, Home Assistant's theme (the panel's own is inside it). */
      :host {
        display: block;
        height: 100%;
        color: var(--primary-text-color, var(--rv-text));
      }
      ha-card {
        display: block;
        height: 100%;
        overflow: hidden;
      }
      /* As tall as the picture, unless the dashboard sets the card's height. */
      .frame {
        position: relative;
        width: 100%;
        height: 100%;
        aspect-ratio: var(--ratio, 16 / 9);
        background: var(--rv-board);
      }
      rv-live-tile {
        position: absolute;
        inset: 0;
      }
      .message {
        padding: 16px;
      }
      .note {
        margin: 0;
        color: var(--secondary-text-color, var(--rv-muted));
      }
      .note.on-board {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        color: var(--rv-on-board-muted);
      }
    `
	];
};
customElements.get("rv-camera-card") || customElements.define("rv-camera-card", S);
//#endregion
export { h as PANEL_PATH, S as RvCameraCard, b as openInPanel, x as pictureRatio };

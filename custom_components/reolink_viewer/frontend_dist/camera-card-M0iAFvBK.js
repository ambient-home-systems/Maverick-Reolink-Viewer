import { a as e, n as t, r as n, t as r } from "./lit-DdRjbP0M.js";
import { A as i, D as a, M as o, N as s, O as c, j as l, t as u, w as d } from "./live-D27fF3SV.js";
import { s as f } from "./config-BH0q64XG.js";
//#region src/card/camera-card.ts
var p = "/reolink-viewer", m = /* @__PURE__ */ new Set(), h;
function g(e) {
	if (h !== e) {
		h = e;
		for (let e of m) e.requestUpdate();
	}
}
function _(e) {
	history.pushState(null, "", `${p}#device/${encodeURIComponent(e)}/live`), window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: !1 } }));
}
function v(e, t) {
	let n = e?.streams[t]?.encoding ?? e?.streams.sub?.encoding, r = n?.width, i = n?.height;
	return r && i ? r / i : void 0;
}
var y = class extends r {
	static properties = {
		hass: { attribute: !1 },
		config: { attribute: !1 },
		_hd: { state: !0 }
	};
	_data = new i(this);
	_choosing;
	connectedCallback() {
		super.connectedCallback(), u(import.meta.url), m.add(this);
	}
	disconnectedCallback() {
		super.disconnectedCallback(), m.delete(this), h === this && g(void 0);
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
		this._choosing !== t && (this._choosing = t, d(e).then((e) => {
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
		let r = l(t.cameras, e.camera);
		if (!r) return this._card(n`<p class="note">This camera cannot be watched live. Choose another in this card's settings.</p>`);
		let i = s(r), a = i ? this._stream(i) : "sub", o = v(i, a ?? "sub");
		return o && f(r.id, o), this._card(a === void 0 ? n`<p class="note on-board">Loading…</p>` : this._tile(r, i, a), !0, o);
	}
	_tile(e, t, r) {
		let i = this.config, a = i?.tap_action ?? "full_screen", s = e.name;
		return n`<rv-live-tile
      fill
      compact
      .fit=${i?.fit ?? "cover"}
      .hass=${this.hass}
      .camera=${e}
      .connection=${t}
      .stream=${r}
      .image=${this._data.images[e.id]}
      .iceServers=${this._data.iceServers}
      .warm=${r === "sub" ? o(this.hass, e) : void 0}
      .controls=${e.controls}
      .suspended=${h !== void 0 && h !== this}
      .hideName=${i?.show_name === !1}
      .hideState=${i?.show_state === !1}
      .tapLabel=${a === "open_panel" ? `Open ${s} in Reolink` : `${s} full screen`}
      ?openable=${a !== "none"}
      @rv-live-open=${(t) => {
			t.stopPropagation(), a === "open_panel" ? _(e.id) : t.target.enterFull();
		}}
      @rv-live-full=${(e) => {
			e.stopPropagation(), e.detail.full ? g(this) : h === this && g(void 0);
		}}
    ></rv-live-tile>`;
	}
	_card(e, r = !1, i) {
		return n`<ha-card>
      ${r ? n`<div class="frame" style=${i ? `--ratio: ${i.toFixed(4)}` : t}>${e}</div>` : n`<div class="message">${e}</div>`}
    </ha-card>`;
	}
	static styles = [
		a,
		c,
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
customElements.get("rv-camera-card") || customElements.define("rv-camera-card", y);
//#endregion
export { p as PANEL_PATH, y as RvCameraCard, _ as openInPanel, v as pictureRatio };

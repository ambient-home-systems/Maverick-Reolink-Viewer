import { a as e, n as t, r as n, t as r } from "./lit-DdRjbP0M.js";
import { A as i, F as a, I as o, L as s, M as c, O as l, P as u, T as d, k as f, t as p } from "./live-DWqtt9-p.js";
import { s as m } from "./config-D80frQMF.js";
//#region src/card/tablet.ts
var h = 6e4, g = 3e5, _ = 300, v = {
	screenOff: "screen off",
	screenOn: "screen on",
	onScreensaverStart: "screensaver on",
	onScreensaverStop: "screensaver off"
}, y = new class {
	_win;
	_now;
	_pending = [];
	_hass = () => void 0;
	_started = !1;
	_sending = !1;
	_screenOff = !1;
	_screensaver = !1;
	_sleepers = /* @__PURE__ */ new Set();
	_watched = /* @__PURE__ */ new Set();
	_frames = /* @__PURE__ */ new Map();
	_lastFrames = /* @__PURE__ */ new Map();
	constructor(e = window, t = () => Date.now()) {
		this._win = e, this._now = t;
	}
	get asleep() {
		return this._screenOff || this._screensaver;
	}
	get fully() {
		return this._win.fully;
	}
	get device() {
		let e = c(this._win.navigator.userAgent);
		return this.fully ? `${e.split(" · ")[0] ?? "Android"} · Fully Kiosk` : e;
	}
	start(e) {
		if (this._hass = e, this._started) return;
		this._started = !0;
		let t = this._win.document;
		this.note("page loaded", void 0, `${t.visibilityState}; Fully Kiosk's JavaScript interface ${this.fully ? "on" : "off"}`), t.addEventListener("visibilitychange", () => {
			let e = t.visibilityState === "hidden";
			this._page(e ? "hidden" : "visible"), e && this.flush();
		}), this._win.addEventListener("pagehide", (e) => {
			this._page("page hide", e.persisted ? "kept" : void 0), this.flush();
		}), this._win.addEventListener("pageshow", (e) => {
			e.persisted && this._page("page show", "from the cache");
		}), t.addEventListener("freeze", () => {
			this._page("frozen");
		}), t.addEventListener("resume", () => {
			this._page("resumed");
		}), this._win.addEventListener("online", () => {
			this._page("online");
		}), this._win.addEventListener("offline", () => {
			this._page("offline");
		}), this._bindFully(), setInterval(() => void this.flush(), h), setInterval(() => {
			this._countFrames();
		}, g);
	}
	watch(e) {
		return this._watched.add(e), () => {
			this._watched.delete(e), this._frames.delete(e), this._lastFrames.delete(e);
		};
	}
	onSleep(e) {
		return this._sleepers.add(e), () => this._sleepers.delete(e);
	}
	wake() {
		let e = this.fully;
		if (!e) return !1;
		try {
			e.stopScreensaver?.(), e.turnScreenOn?.();
		} catch {}
		return !0;
	}
	note(e, t, n) {
		this._pending.push({
			at: this._now(),
			what: e.slice(0, 40),
			...t ? { card: t.slice(0, 80) } : {},
			...n ? { detail: n.slice(0, 200) } : {}
		}), this._pending.length > _ && this._pending.splice(0, this._pending.length - _);
	}
	async flush() {
		let e = this._hass();
		if (!e || !this._pending.length || this._sending) return;
		let t = this._pending.splice(0);
		this._sending = !0;
		try {
			await e.callWS({
				type: "reolink_viewer/live/card_log/add",
				device: this.device,
				events: t
			});
		} catch {
			this._pending.unshift(...t), this._pending.length > _ && this._pending.splice(0, this._pending.length - _);
		} finally {
			this._sending = !1;
		}
	}
	_page(e, t) {
		this._watched.size && this.note(e, void 0, t);
	}
	_bindFully() {
		let e = this.fully;
		if (e?.bind) {
			this._win.__reolinkViewerFully = (e) => {
				this._fullyEvent(e);
			};
			for (let t of Object.keys(v)) try {
				e.bind(t, `window.__reolinkViewerFully && window.__reolinkViewerFully(${JSON.stringify(t)})`);
			} catch {}
		}
	}
	_fullyEvent(e) {
		this.note(v[e] ?? e, void 0, "Fully Kiosk");
		let t = this.asleep;
		if (e === "screenOff" && (this._screenOff = !0), e === "screenOn" && (this._screenOff = !1), e === "onScreensaverStart" && (this._screensaver = !0), e === "onScreensaverStop" && (this._screensaver = !1), t !== this.asleep) for (let e of [...this._sleepers]) e();
	}
	_countFrames() {
		let e = this._win.document.visibilityState === "hidden" ? "hidden" : "visible";
		for (let t of this._watched) {
			let n = t.video()?.getVideoPlaybackQuality?.().totalVideoFrames;
			if (n === void 0) continue;
			let r = this._frames.get(t);
			if (this._frames.set(t, n), r === void 0) continue;
			let i = n >= r ? n - r : n, a = this._lastFrames.get(t) ?? 0;
			this._lastFrames.set(t, i), (i !== 0 || a !== 0) && this.note("frames", t.name(), `${String(i)} frames; ${e}${this.asleep ? "; asleep" : ""}; ${t.state()}`);
		}
	}
}(), b = "/reolink-viewer", x = /* @__PURE__ */ new Set(), S;
function C(e) {
	if (S !== e) {
		S = e;
		for (let e of x) e.requestUpdate();
	}
}
y.onSleep(() => {
	for (let e of x) e.requestUpdate();
});
function w(e) {
	history.pushState(null, "", `${b}#device/${encodeURIComponent(e)}/live`), window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: !1 } }));
}
function T(e, t) {
	let n = e?.streams[t]?.encoding ?? e?.streams.sub?.encoding, r = n?.width, i = n?.height;
	return r && i ? r / i : void 0;
}
var E = class extends r {
	static properties = {
		hass: { attribute: !1 },
		config: { attribute: !1 },
		_hd: { state: !0 }
	};
	_data = new u(this);
	_choosing;
	_unwatch;
	_doing = "loading";
	_startedAt = /* @__PURE__ */ new Map();
	_ringSeen;
	_ringTimer;
	_ringFull = !1;
	get _name() {
		return (this._data.cameras && this.config?.camera ? a(this._data.cameras, this.config.camera) : void 0)?.name ?? this.config?.camera ?? "Card";
	}
	connectedCallback() {
		super.connectedCallback(), p(import.meta.url), x.add(this), y.start(() => this.hass), this._unwatch = y.watch({
			name: () => this._name,
			video: () => this._tileElement()?.renderRoot.querySelector("video.sub") ?? null,
			state: () => this._doing
		});
	}
	disconnectedCallback() {
		super.disconnectedCallback(), x.delete(this), S === this && C(void 0), this._unwatch?.(), this._unwatch = void 0, clearTimeout(this._ringTimer), this._ringFull = !1, this._ringSeen = void 0;
	}
	_tileElement() {
		return this.renderRoot.querySelector("rv-live-tile");
	}
	updated() {
		let e = this._data.cameras && this.config?.camera ? a(this._data.cameras, this.config.camera) : void 0;
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
		let s = y.wake();
		y.note("ring", e.name, `full screen for ${String(a)} s${s ? "; woke Fully Kiosk's screen" : ""}`), o.full || (o.enterFull(), this._ringFull = !0), clearTimeout(this._ringTimer), this._ringTimer = setTimeout(() => {
			this._ringFull && this._tileElement()?.exitFull(), this._ringFull = !1;
		}, a * 1e3);
	}
	_logPlayer(e, t) {
		let { which: n, state: r } = t, i = Date.now();
		switch (r.kind) {
			case "starting": {
				let t = r.after ? this._startedAt.get(n) : void 0;
				t === void 0 && this._startedAt.set(n, i), this._doing = "starting", y.note("starting", e, `${n} ${r.transport}${r.after && t !== void 0 ? `, after ${((i - t) / 1e3).toFixed(1)} s: ${r.after}` : ""}`);
				break;
			}
			case "playing": {
				let t = this._startedAt.get(n);
				this._doing = "playing", y.note("playing", e, `${n} ${r.transport}${t === void 0 ? "" : `, ${((i - t) / 1e3).toFixed(1)} s`}`);
				break;
			}
			case "waiting":
				this._doing = "retrying", y.note("retrying", e, `${n}: ${l(r.error).text}`);
				break;
			default: (n === "SD" || this.config?.quality === "hd") && (this._doing = "stopped"), y.note("stopped", e, n);
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
		let r = a(t.cameras, e.camera);
		if (!r) return this._card(n`<p class="note">This camera cannot be watched live. Choose another in this card's settings.</p>`);
		let i = s(r), o = i ? this._stream(i) : "sub", c = T(i, o ?? "sub");
		return c && m(r.id, c), this._card(o === void 0 ? n`<p class="note on-board">Loading…</p>` : this._tile(r, i, o), !0, c);
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
      .suspended=${y.asleep || S !== void 0 && S !== this}
      .hideName=${i?.show_name === !1}
      .hideState=${i?.show_state === !1}
      .tapLabel=${a === "open_panel" ? `Open ${s} in Reolink` : `${s} full screen`}
      ?openable=${a !== "none"}
      @rv-live-open=${(t) => {
			t.stopPropagation(), a === "open_panel" ? w(e.id) : t.target.enterFull();
		}}
      @rv-live-full=${(e) => {
			e.stopPropagation(), e.detail.full ? C(this) : (this._ringFull = !1, S === this && C(void 0));
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
		f,
		i,
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
customElements.get("rv-camera-card") || customElements.define("rv-camera-card", E);
//#endregion
export { b as PANEL_PATH, E as RvCameraCard, w as openInPanel, T as pictureRatio };

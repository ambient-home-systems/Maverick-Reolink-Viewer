import { I as e } from "./live-B3rIzIdQ.js";
//#region src/card/tablet.ts
var t = 6e4, n = 3e5, r = 300, i = {
	screenOff: "screen off",
	screenOn: "screen on",
	onScreensaverStart: "screensaver on",
	onScreensaverStop: "screensaver off"
}, a = new class {
	_win;
	_now;
	_pending = [];
	_hass = () => void 0;
	_started = !1;
	_sending = !1;
	_screenOff = !1;
	_screensaver = !1;
	_fullyBound = !1;
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
		let t = e(this._win.navigator.userAgent);
		return this.fully ? `${t.split(" · ")[0] ?? "Android"} · Fully Kiosk` : t;
	}
	start(e) {
		if (this._hass = e, this._started) return;
		this._started = !0;
		let r = this._win.document;
		this.note("page loaded", void 0, `${r.visibilityState}; Fully Kiosk's JavaScript interface ${this.fully ? "on" : "off"}`), r.addEventListener("visibilitychange", () => {
			let e = r.visibilityState === "hidden";
			this._page(e ? "hidden" : "visible"), e && this.flush();
		}), this._win.addEventListener("pagehide", (e) => {
			this._page("page hide", e.persisted ? "kept" : void 0), this.flush();
		}), this._win.addEventListener("pageshow", (e) => {
			e.persisted && this._page("page show", "from the cache");
		}), r.addEventListener("freeze", () => {
			this._page("frozen");
		}), r.addEventListener("resume", () => {
			this._page("resumed");
		}), this._win.addEventListener("online", () => {
			this._page("online");
		}), this._win.addEventListener("offline", () => {
			this._page("offline");
		}), this._bindFully(), setInterval(() => void this.flush(), t), setInterval(() => {
			this._countFrames();
		}, n);
	}
	watch(e) {
		return this._watched.add(e), () => {
			this._watched.delete(e), this._frames.delete(e), this._lastFrames.delete(e);
		};
	}
	listenToFully() {
		this._bindFully();
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
		}), this._pending.length > r && this._pending.splice(0, this._pending.length - r);
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
			this._pending.unshift(...t), this._pending.length > r && this._pending.splice(0, this._pending.length - r);
		} finally {
			this._sending = !1;
		}
	}
	_page(e, t) {
		this._watched.size && this.note(e, void 0, t);
	}
	_bindFully() {
		let e = this.fully;
		if (e?.bind && !this._fullyBound) {
			this._fullyBound = !0, this._win.__reolinkViewerFully = (e) => {
				this._fullyEvent(e);
			};
			for (let t of Object.keys(i)) try {
				e.bind(t, `window.__reolinkViewerFully && window.__reolinkViewerFully(${JSON.stringify(t)})`);
			} catch {}
		}
	}
	_fullyEvent(e) {
		this.note(i[e] ?? e, void 0, "Fully Kiosk");
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
}();
//#endregion
export { a as t };

import { Dt as e, Gt as t, I as n, J as r, Jt as i, K as a, L as o, Mt as s, Ot as c, Tt as l, Ut as u, Vt as d, Wt as f, X as p, Xt as m, Y as h, Yt as g, Z as _, _t as v, bt as y, dt as b, et as ee, ft as te, gt as x, ht as S, it as C, jt as w, kt as T, lt as E, mt as D, ot as O, pt as ne, qt as re, tt as ie, ut as k, vt as A, yt as ae } from "./home-CGlX2y7Y.js";
import { c as oe, o as se, r as ce, s as j } from "./check-DpaujiJe.js";
import { a as M, i as N, n as P, o as F, r as I, t as L } from "./findings-Dqmk7bWJ.js";
//#region src/live/check.ts
var R = [
	"Desktop Chrome, LAN",
	"Desktop Chrome, Tailscale",
	"Desktop Chrome, Nabu Casa",
	"iPhone app, Wi-Fi (local)",
	"iPhone app, Tailscale",
	"iPhone app, Nabu Casa",
	"Other"
], z = 2e4, B = 12e3, V = 1e4, H = 2e3, U = 15e3, W = 1e3, le = 1e4, G = class extends Error {}, ue = 2e3, de = 4e3, K = (e) => new Promise((t) => setTimeout(t, e)), fe = class {
	_hass;
	options;
	_stage;
	_onChange;
	id;
	lines = [];
	running = !1;
	status = "";
	plainStatus = "";
	afterFrameMs = 300;
	_stopped = !1;
	_session;
	_lastSave = 0;
	_saving = Promise.resolve();
	_ice = [];
	_measured = [];
	_posters = [];
	_capacity = [];
	_capacityFailed = [];
	_chosen = [];
	constructor(e, t, n, r = () => void 0) {
		this._hass = e, this.options = t, this._stage = n, this._onChange = r, this.id = `live-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 19)}-${Math.random().toString(36).slice(2, 6)}`;
	}
	get text() {
		return this.lines.join("\n");
	}
	stop() {
		this._stopped = !0, this._session?.close();
	}
	async run() {
		this.running = !0;
		try {
			this.plainStatus = "Getting ready", await this._header();
			let e = await this._cameras();
			this._chosen = e, this.plainStatus = "Loading a still picture of each camera", await this._ourImages(e), await this._hdChoices(e);
			for (let [t, n] of e.entries()) {
				this.plainStatus = `Measuring ${n.name}, camera ${String(t + 1)} of ${String(e.length)}`;
				for (let e of n.connections) for (let t of this.options.streams) await this._measureStream(n, e, t);
			}
			this.options.capacity && (this.plainStatus = "Testing how many streams each NVR serves at once", await this._capacityTests()), this._summary(e);
		} catch (e) {
			this._log(e instanceof G ? "Stopped." : `Check failed: ${t(e).message}`);
		} finally {
			this._session?.close(), await this._go2rtcLog(), this.running = !1, this.status = "", this.plainStatus = "", this._log(`Done at ${(/* @__PURE__ */ new Date()).toLocaleTimeString()}.`), await this._save(!0);
		}
		return this.text;
	}
	async _go2rtcLog() {
		let e = (await s(this._hass).catch(() => void 0))?.go2rtc.log;
		if (e?.length) {
			this._log(""), this._log(`go2rtc log (last ${String(e.length)} lines):`);
			for (let t of e) this._log(`  ${t}`);
		}
	}
	_log(e) {
		this.lines.push(e), this._onChange(), performance.now() - this._lastSave > le && this._save(!1);
	}
	_status(e) {
		this.status = e, this._onChange();
	}
	_save(e) {
		return this._lastSave = performance.now(), this._saving = this._saving.then(() => this._hass.callWS({
			type: "reolink_viewer/playback/check_report",
			report_id: this.id,
			setup: `${k}${this.options.setup}`,
			text: this.text,
			done: e
		})).then(() => void 0).catch(() => void 0), this._saving;
	}
	_checkStopped() {
		if (this._stopped) throw new G();
	}
	async _header() {
		let t = this._hass.user?.is_admin === !0;
		this._log(`Reolink Viewer live check v${O} · ${this.options.setup} · ${(/* @__PURE__ */ new Date()).toLocaleString()}`), this._log(`Browser: ${se(navigator.userAgent)} · page ${r(location.hostname)} over ${location.protocol.replace(":", "")} · screen ${screen.width}×${screen.height} @${window.devicePixelRatio}x`), this._log(`User agent: ${navigator.userAgent}`);
		let n = ee(), i = n ? window[n] : void 0;
		this._log(`MSE: ${n ?? "none"}${i ? `, takes ${S((e) => i.isTypeSupported(e)) || "none of go2rtc's codecs"}` : ""}`), this._log(`WebRTC receives: ${he()}`);
		let a = await e(this._hass).catch(() => []);
		this._ice = v(a), this._log(`ICE servers (Home Assistant's): ${ne(a)}`);
		let o = this.options;
		this._log(`Streams: ${o.streams.join(", ")} · warm: ${o.warm && t ? "yes" : t ? "no" : "no (not an admin)"} · Home Assistant's view: ${o.stock ? "yes" : "no"} · capacity test: ${o.capacity && t ? "yes" : "no"}`);
		let c = performance.now(), l = (await s(this._hass)).go2rtc;
		this._log(`go2rtc: ${l.state}${l.version ? ` ${l.version}` : ""}${l.binary ? ` (${l.binary === "system" ? "Home Assistant's binary" : "downloaded, checksum verified"})` : ""}${l.error ? ` · error: ${l.error}` : ""} · restarts ${l.restarts} · WebRTC port ${l.webrtc_port} · status in ${Math.round(performance.now() - c)} ms`);
	}
	async _cameras() {
		let { cameras: e } = await c(this._hass), t = this.options.cameraIds?.length ? new Set(this.options.cameraIds) : void 0, n = e.filter((e) => !t || t.has(e.id));
		return this._log(`Cameras: ${n.map((e) => `${e.name}${e.connections.length > 1 ? ` (${e.connections.map((e) => e.via).join(" + ")})` : ""}`).join(", ")}`), n;
	}
	async _ourImages(e) {
		this._checkStopped(), this._status("our pictures");
		let n = /* @__PURE__ */ new Map(), r, i = () => void 0, a = performance.now(), o;
		this._log("");
		try {
			o = await f(this._hass, (e) => {
				r ??= performance.now() - a;
				for (let [t, r] of Object.entries(e.images)) n.set(t, r);
				i();
			});
		} catch (e) {
			this._log(`First images (ours): failed (${t(e).message})`);
			return;
		}
		let s = () => new Promise((e) => {
			i = e, setTimeout(e, 100);
		});
		try {
			let t = a + U;
			for (; r === void 0 && performance.now() < t;) await s();
			if (r === void 0) {
				this._log(`First images (ours): no list in ${A(U)}`);
				return;
			}
			this._log(`First images (ours, kept on the server): listed in ${Math.round(r)} ms`);
			for (let t of e) {
				this._checkStopped();
				let e = performance.now();
				for (; !n.has(t.id) && performance.now() < e + U;) await s();
				let i = n.get(t.id);
				if (!i) {
					this._log(`  ${t.name}: none in ${A(U)}`);
					continue;
				}
				let a = performance.now() - e, o = await J(i.url);
				o.ms !== void 0 && this._posters.push({
					kind: "ours",
					ms: r + a + o.ms,
					cameraId: t.id
				});
				let c = Math.max(0, Date.now() - i.taken) / 1e3;
				this._log(`  ${t.name}: ${o.text}, taken ${c < 100 ? c.toFixed(1) : Math.round(c)} s before` + (a >= 50 ? ` (none kept: waited ${Math.round(a)} ms for it)` : ""));
			}
		} finally {
			await o().catch(() => void 0);
		}
	}
	async _hdChoices(e) {
		this._log(""), this._log("Full screen (HD), in this browser:");
		for (let t of e) {
			let e = E(t);
			e && this._log(`  ${t.name}: ${(await ie(e)).reason}`);
		}
	}
	async _measureStream(e, n, r) {
		this._checkStopped();
		let i = {
			connectionId: n.connection_id,
			stream: r
		}, a = n.streams[r], o = n.via === "nvr" ? `via ${n.entry_title}` : "direct";
		if (this._log(""), !a) {
			this._log(`${e.name}${e.model ? ` (${e.model})` : ""} · ${o} · ${r}: not served by this connection`);
			return;
		}
		this._log(`${e.name}${e.model ? ` (${e.model})` : ""} · ${o} · ${ae(r, a.encoding)}`);
		let s = `${e.name} ${o} ${r}`, c = (t, i, a) => {
			this._measured.push({
				cameraId: e.id,
				camera: e.name,
				connection: n,
				stream: r,
				phase: t,
				transport: i,
				result: a
			});
		}, l = [], u = (e.keep_warm_entity ? this._hass.states[e.keep_warm_entity]?.state === "on" : !1) && r === "sub" && E(e) === n, f = u ? "kept warm by its switch; turn it off to measure cold" : "a viewer kept it running";
		for (let e of ["WebRTC", "MSE"]) {
			this._status(`${s}: cold ${e}`);
			let t = !u && await this._waitCold(i), n = await this._session_(e, i, z);
			c("cold", e, n), l.push(`${e} ${q(n)}${t ? "" : ` (${f}: not cold)`}`), e === "MSE" && l.push(...await this._videoOnly(n, i, z, s));
		}
		if (this._log(`  cold: ${l.join(" · ")}`), this.options.stock) {
			let e = a.entity_id;
			if (!e) this._log(`  Home Assistant's view: no enabled camera entity for ${r}`);
			else {
				this._status(`${s}: Home Assistant's view`);
				let t = await this._stockPoster(e), n = await this._stock(e);
				c("stock", "WebRTC", n), this._log(`  Home Assistant's view (${e}): snapshot ${t} · WebRTC ${q(n)}`);
			}
		}
		if (this.options.warm && this._hass.user?.is_admin) {
			if (n.is_battery) {
				this._log("  warm: not measured (battery camera: never kept warm)");
				return;
			}
			this._status(`${s}: keeping it warm`);
			let e = performance.now(), r;
			try {
				({key_frame: r} = await d(this._hass, i, !0));
			} catch (e) {
				this._log(`  warm: keeping it warm failed: ${t(e).message}`);
				return;
			}
			let a = performance.now() - e;
			try {
				await this._pause(H);
				let e = await this._frame(i), t = [];
				for (let e of ["WebRTC", "MSE"]) {
					this._status(`${s}: warm ${e}`);
					let n = await this._session_(e, i, B);
					c("warm", e, n), t.push(`${e} ${q(n)}`), e === "MSE" && t.push(...await this._videoOnly(n, i, B, s));
				}
				let n = (await w(this._hass, i).catch(() => void 0))?.cache, o = r ? `key frame cached in ${A(a)}` : `no key frame in ${A(a)}`;
				this._log(`  warm (${o}${b(n)}): frame ${e} · ${t.join(" · ")}`);
			} finally {
				await d(this._hass, i, !1).catch(() => void 0);
			}
		}
	}
	async _waitCold(e) {
		let t = performance.now() + V;
		for (; performance.now() < t;) {
			if (this._checkStopped(), !(await w(this._hass, e).catch(() => void 0))?.state?.active) return !0;
			await K(250);
		}
		return !1;
	}
	async _pause(e) {
		let t = performance.now() + e;
		for (; performance.now() < t;) this._checkStopped(), await K(Math.min(250, t - performance.now()));
	}
	async _session_(e, t, n) {
		return this._watch((r) => e === "WebRTC" ? new p(this._hass, r, t, this._ice, n) : new h(this._hass, r, t, n));
	}
	async _videoOnly(e, t, n, r) {
		return !e.ok || e.firstFrameMs === void 0 || !("appended" in e.steps) || e.firstFrameMs - e.steps.appended <= W ? [] : (this._status(`${r}: MSE video only`), [`MSE video only ${q(await this._watch((e) => new h(this._hass, e, t, n, location.href, !0)))}`]);
	}
	_stock(e) {
		return this._watch((t) => new _(this._hass, t, e, z));
	}
	async _watch(e) {
		this._checkStopped();
		let t = document.createElement("video");
		this._stage.replaceChildren(t);
		let n = e(t);
		this._session = n;
		try {
			let e = await n.done;
			return e.ok && await K(this.afterFrameMs), e;
		} finally {
			n.close(), this._session = void 0, t.remove();
		}
	}
	async _stockPoster(e) {
		let t = this._hass.states[e]?.attributes.entity_picture;
		if (typeof t != "string") return "no picture";
		let n = await J(`${t}${t.includes("?") ? "&" : "?"}_=${Date.now()}`);
		return n.ms !== void 0 && this._posters.push({
			kind: "HA snapshot",
			ms: n.ms
		}), n.text;
	}
	async _frame(e) {
		try {
			let { path: t } = await T(this._hass, e), n = await J(t);
			return n.ms !== void 0 && this._posters.push({
				kind: "go2rtc frame",
				ms: n.ms
			}), n.text;
		} catch (e) {
			return `failed (${t(e).message})`;
		}
	}
	async _capacityTests() {
		if (!this._hass.user?.is_admin) {
			this._log(""), this._log("Capacity test: not run (admins only).");
			return;
		}
		let e = await l(this._hass);
		for (let t of e.hosts) {
			this._checkStopped();
			let e = t.name ?? t.id;
			this._log(""), this._log(`Capacity test: ${e} (sub streams one by one, then a main, then a recording download)`), this._status(`capacity test: ${e}`);
			let n = await this._capacity_(t.id, (t) => {
				this._status(`capacity test: ${e}: ${t}`);
			});
			if ("message" in n) this._log(`  failed: ${n.message}${n.advice ? ` ${n.advice}` : ""}`), this._capacityFailed.push({
				host: e,
				...n
			});
			else {
				this._capacity.push({
					host: e,
					report: n
				});
				for (let e of te(n)) this._log(e);
			}
		}
	}
	_capacity_(e, n) {
		return new Promise((r) => {
			let i, a = !1, o = (e) => {
				a || (a = !0, i?.().catch(() => void 0), r(e));
			};
			u(this._hass, e, (e) => {
				e.type === "progress" ? n(e.message) : e.type === "result" ? o(e.report) : o(e.advice ? {
					message: e.message,
					advice: e.advice
				} : { message: e.message });
			}).then((e) => {
				i = e, a && e().catch(() => void 0);
			}).catch((e) => {
				o({ message: t(e).message });
			});
		});
	}
	inShort(e = !this.running) {
		let t = [], n = [], r = [], i = 0, a = 0, o = (e) => {
			let t = e.filter((e) => e.result.ok).map((e) => e.result.firstFrameMs ?? 0);
			return t.length ? Math.min(...t) : void 0;
		};
		for (let e of this._chosen) {
			let s = E(e), c = this._measured.filter((t) => t.cameraId === e.id && t.connection === s), l = c.filter((e) => e.phase === "cold");
			if (!l.length) continue;
			i += 1;
			let u = l.filter((e) => e.stream === "sub"), d = o(u.length ? u : l);
			if (d === void 0) {
				a += 1, t.push({
					grade: "problem",
					text: `${e.name}: live video did not start.`,
					advice: "Check that the camera is online (for example in the Reolink app), then run the check again."
				});
				continue;
			}
			n.push(d);
			let f = u.length ? o(l.filter((e) => e.stream !== "sub")) : void 0, p = o(c.filter((e) => e.phase === "warm" && e.stream === "sub")), m = F(d, ue, de);
			m === "slow" && r.push(e.name);
			let h = [`live video starts in ${M(d)}`];
			f !== void 0 && h.push(`full screen in HD in ${M(f)}`), p !== void 0 && h.push(`kept warm, in ${M(p)}`);
			let g;
			m !== "good" && s?.is_battery ? g = "Battery cameras wake up before they stream, so a few seconds is normal." : m !== "good" && e.keep_warm_entity && this._hass.states[e.keep_warm_entity]?.state !== "on" && (g = "Turn on its “keep live view warm” switch in Home Assistant to make it start faster" + (p === void 0 ? "." : ` (about ${M(p)} here).`)), t.push({
				grade: m,
				text: `${e.name}: ${h.join("; ")}.`,
				...g ? { advice: g } : {}
			});
		}
		let s = this._posters.filter((e) => e.kind === "ours").map((e) => e.ms), c = I(s);
		c !== void 0 && t.push({
			grade: F(c, 1e3, 2500),
			text: `A still picture of each camera shows in ${c < 100 ? "" : "about "}${M(c)}, while its live video starts.`
		});
		let l = this._measured.filter((e) => e.phase === "stock"), u = [];
		for (let e of l) {
			let t = o(this._measured.filter((t) => t.connection === e.connection && t.stream === e.stream && t.phase !== "stock"));
			t !== void 0 && e.result.ok && u.push([t, e.result.firstFrameMs ?? 0]);
		}
		if (u.length) {
			let e = u.filter(([e, t]) => e < t).length, n = I(u.map(([e]) => e)) ?? 0, r = I(u.map(([, e]) => e)) ?? 0;
			t.push({
				grade: "note",
				text: `Compared with Home Assistant's own camera view: this viewer was quicker on ${String(e)} of ${L(u.length, "stream")} (typically ${M(n)} against ${M(r)}).`
			});
		}
		let d = this._measured.filter((e) => e.transport === "WebRTC" && e.phase !== "stock"), f = this._measured.some((e) => e.transport === "MSE" && e.result.ok);
		d.length && !d.some((e) => "connected" in e.result.steps) && f && t.push({
			grade: "note",
			text: "WebRTC could not connect from this device, so live video used the viewer's other way of streaming (MSE), which worked."
		});
		for (let { host: e, report: n } of this._capacity) {
			let r = n.verdict.first_failing_level;
			if (r === null) {
				let r = Math.max(0, ...n.levels.map((e) => e.streams.length));
				t.push({
					grade: "good",
					text: `${e} kept up with ${L(r, "video stream")} at once.`
				});
			} else {
				let i = n.levels.find((e) => e.level === r)?.streams.length;
				t.push({
					grade: "slow",
					text: `${e} struggled with ${i === void 0 ? "several streams" : L(i, "video stream")} at once.`,
					advice: "Keep fewer of its cameras warm, or watch fewer of them in full screen at the same time."
				});
			}
			let i = (n.main_left_out ?? []).map((e) => e.camera);
			i.length && t.push({
				grade: "note",
				text: i.length === 1 ? `${e}'s capacity test left out ${i.join("")}'s full-resolution stream: it sent no video, even on its own.` : `${e}'s capacity test left out the full-resolution streams of ${pe(i)}: they sent no video, even on their own.`,
				advice: `If ${i.length === 1 ? "its full picture does" : "their full pictures do"} not play in the Reolink app either, restart ${i.length === 1 ? "the camera" : "those cameras"}.`
			});
		}
		for (let { host: e, message: n, advice: r } of this._capacityFailed) t.push({
			grade: "note",
			text: `${e}'s capacity test could not run${/^[A-Z]/.test(n) ? "." : ":"} ${n}${/[.!?]$/.test(n) ? "" : "."}`,
			...r ? { advice: r } : {}
		});
		let p = I(n), m = i - a, h = a ? `${String(m)} of ${L(i, "camera")} started live video; ${String(a)} did not` : `${i === 1 ? "The camera" : i === 2 ? "Both cameras" : `All ${L(i, "camera")}`} started live video` + (p === void 0 ? "" : `, typically in ${M(p)}`), g = r.length ? `; ${String(r.length)} ${r.length === 1 ? "is" : "are"} slow: ${r.join(", ")}` : "";
		return {
			headline: i ? `${e ? "" : "So far: "}${h}${g}.` : e ? "No camera was measured." : "Measuring…",
			findings: t
		};
	}
	_summary(e) {
		let t = this._measured;
		this._log("");
		for (let e of P(this.inShort(!0))) this._log(e);
		this._log(""), this._log("Summary:");
		let n = t.filter((e) => e.transport === "WebRTC" && e.phase !== "stock"), r = n.filter((e) => "connected" in e.result.steps), i = me(r.map((e) => `${e.result.pair?.local ?? "?"} ↔ ${e.result.pair?.remote ?? "?"}`));
		this._log(`- WebRTC connected ${r.length} of ${n.length} sessions${i ? ` (${i})` : ""}`);
		for (let e of ["cold", "warm"]) for (let n of ["WebRTC", "MSE"]) for (let r of [["sub"], ["main", "ext"]]) {
			let i = t.filter((t) => t.phase === e && t.transport === n && r.includes(t.stream)).filter((e) => e.result.ok).map((e) => e.result.firstFrameMs ?? 0), a = t.filter((t) => t.phase === e && t.transport === n && r.includes(t.stream)).length;
			a && this._log(`- ${e} ${n}, ${r.join("/")}: median ${A(D(i))}, ${i.length} of ${a} played` + (i.length ? ` (${A(Math.min(...i))}–${A(Math.max(...i))})` : ""));
		}
		let a = t.filter((e) => e.phase === "stock");
		if (a.length) {
			let e = 0, n = 0;
			for (let r of a) {
				let i = t.filter((e) => e.connection === r.connection && e.stream === r.stream && e.phase !== "stock" && e.result.ok), a = i.length ? Math.min(...i.map((e) => e.result.firstFrameMs ?? Infinity)) : void 0;
				a !== void 0 && r.result.ok && (n += 1, a < (r.result.firstFrameMs ?? Infinity) && (e += 1));
			}
			let r = a.filter((e) => e.result.ok).map((e) => e.result.firstFrameMs ?? 0);
			this._log(`- Home Assistant's view: median ${A(D(r))}, ${r.length} of ${a.length} played; ours (best of cold/warm) faster on ${e} of ${n}`);
		}
		for (let e of [
			"ours",
			"HA snapshot",
			"go2rtc frame"
		]) {
			let t = this._posters.filter((t) => t.kind === e).map((e) => e.ms);
			t.length && this._log(`- first image, ${e}: median ${A(D(t))} (${t.length}), slowest ${A(Math.max(...t))}`);
		}
		for (let n of e.filter((e) => e.connections.length > 1)) {
			let e = n.connections.map((e) => {
				let n = t.filter((t) => t.connection === e && t.stream === "sub" && t.phase === "cold" && t.result.ok), r = D(n.map((e) => e.result.firstFrameMs ?? 0));
				return `${e.via === "nvr" ? "via NVR" : "direct"} cold sub ${A(r)}`;
			});
			this._log(`- ${n.name}: ${e.join(" vs ")}`);
		}
		for (let { host: e, report: t } of this._capacity) {
			let n = t.verdict;
			this._log(`- capacity ${e}: ${n.first_failing_level === null ? `kept up at every level (${t.levels.length})` : `level ${n.first_failing_level} fails or slows down (${n.reasons.join("; ")})`}`);
		}
	}
};
function q(e) {
	let t = Object.entries(e.steps).filter(([e]) => [
		"answer",
		"connected",
		"url",
		"open",
		"mime",
		"first data",
		"appended"
	].includes(e)).sort(([, e], [, t]) => e - t).map(([e, t]) => `${e} ${t} ms`), n = e.pair, r = n?.local ? `${n.local} ↔ ${n.remote ?? "?"}${n.rttMs === void 0 ? "" : `, rtt ${n.rttMs} ms`}` : void 0, i = [n?.codec ?? e.mse?.mime.replace(/^video\/mp4; codecs=/, "").replace(/"/g, ""), e.width ? `${e.width}×${e.height}` : void 0].filter(Boolean).join(" "), a = [
		t.join(", "),
		r,
		i
	].filter(Boolean).join("; ");
	return e.ok ? `${A(e.firstFrameMs)}${a ? ` (${a})` : ""}` : `✗ ${e.error ?? "failed"}${a ? ` (${a})` : ""}`;
}
function pe(e) {
	return e.length < 2 ? e.join("") : `${e.slice(0, -1).join(", ")} and ${e.at(-1) ?? ""}`;
}
function me(e) {
	let t = /* @__PURE__ */ new Map();
	for (let n of e) t.set(n, (t.get(n) ?? 0) + 1);
	return [...t].map(([e, t]) => `${t}× ${e}`).join(", ");
}
function he() {
	let e = typeof RTCRtpReceiver < "u" ? RTCRtpReceiver.getCapabilities("video") : null;
	return e ? [...new Set(e.codecs.map((e) => e.mimeType.replace(/^video\//, "")).filter((e) => !/rtx|red|ulpfec|flexfec/i.test(e)))].join(", ") : "unknown";
}
function J(e) {
	return new Promise((t) => {
		let n = performance.now(), r = new Image(), i = setTimeout(() => {
			t({ text: "timed out" });
		}, U);
		r.onload = () => {
			clearTimeout(i);
			let e = performance.now() - n;
			t({
				ms: e,
				text: `${Math.round(e)} ms (${r.naturalWidth}×${r.naturalHeight})`
			});
		}, r.onerror = () => {
			clearTimeout(i), t({ text: "failed" });
		}, r.src = e;
	});
}
//#endregion
//#region src/types.ts
var Y = [
	"sub",
	"main",
	"ext"
], X = "reolink-viewer-live-check-setup", Z = {
	sub: "Low (the live board)",
	ext: "Medium",
	main: "High (full screen)"
};
function Q(e) {
	return !/Tailscale|Nabu Casa/.test(e);
}
var $ = class extends re {
	static properties = {
		hass: { attribute: !1 },
		_status: { state: !0 },
		_cameras: { state: !0 },
		_setup: { state: !0 },
		_streams: { state: !0 },
		_warm: { state: !0 },
		_stock: { state: !0 },
		_capacity: { state: !0 },
		_camera: { state: !0 },
		_check: { state: !0 },
		_checkText: { state: !0 },
		_checkStatus: { state: !0 },
		_reports: { state: !0 },
		_error: { state: !0 },
		_copied: { state: !0 },
		_shown: { state: !0 }
	};
	_loaded = !1;
	constructor() {
		super(), this._setup = ge(), this._streams = [...Y], this._warm = !0, this._stock = !0, this._capacity = !0, this._camera = "", this._checkText = "", this._checkStatus = "";
	}
	disconnectedCallback() {
		super.disconnectedCallback(), this._check?.stop();
	}
	updated() {
		this.hass && !this._loaded && (this._loaded = !0, this._load());
	}
	async _load() {
		let e = this.hass;
		if (e) {
			try {
				let [t, n] = await Promise.all([s(e), c(e)]);
				this._status = t, this._cameras = n.cameras;
			} catch (e) {
				this._error = t(e).message;
			}
			this._loadReports();
		}
	}
	async _loadReports() {
		if (this.hass) try {
			let { reports: e } = await ce(this.hass);
			this._reports = e.filter((e) => e.setup.startsWith(k));
		} catch {
			this._reports = [];
		}
	}
	get _admin() {
		return this.hass?.user?.is_admin === !0;
	}
	async runCheck(e) {
		let t = this.hass, n = this.renderRoot.querySelector(".stage");
		if (!t || !n) throw Error("the page is not ready");
		if (this._check?.running) throw Error("a check is running");
		let r = new fe(t, {
			setup: e.setup,
			streams: e.streams ?? this._streams,
			warm: e.warm ?? this._warm,
			stock: e.stock ?? this._stock,
			capacity: e.capacity ?? (this._capacity && Q(e.setup)),
			cameraIds: e.cameraIds ?? (this._camera ? [this._camera] : [])
		}, n, () => {
			this._checkText = r.text, this._checkStatus = r.plainStatus;
		});
		this._check = r, this._copied = void 0;
		try {
			return await r.run();
		} finally {
			this._checkStatus = "", this._loadReports(), this._refreshStatus();
		}
	}
	async _refreshStatus() {
		this.hass && (this._status = await s(this.hass).catch(() => this._status));
	}
	async _copy(e, t) {
		await o(e) ? this._copied = t : (this._copied = void 0, this._shown = t, n(this, "Copying is blocked here: select the text instead, or copy it from Saved reports on a computer", "error"));
	}
	render() {
		let e = this._check?.running === !0;
		return g`<p class="intro">
        How quickly each camera's live video starts on this device. The check plays each camera in turn
        for a few seconds, so it takes a few minutes: keep this page open and in front. It only watches;
        it changes no camera setting.
      </p>
      <p class="muted">
        Run it on each device you use, at home and away, and compare. Each run is saved, so you can read
        it later on any device.
      </p>
      ${this._renderStatus()}
      <div class="form">
        <span class="label" id="setup">This device and network</span>
        <div class="field">
          <select
            aria-labelledby="setup"
            .value=${this._setup}
            ?disabled=${e}
            @change=${(e) => {
			this._setup = e.target.value, _e(this._setup);
		}}
          >
            ${R.map((e) => g`<option value=${e} ?selected=${e === this._setup}>${e}</option>`)}
          </select>
        </div>
        <span class="label" id="cameras">Cameras</span>
        <div class="field">
          <select
            aria-labelledby="cameras"
            ?disabled=${e}
            @change=${(e) => {
			this._camera = e.target.value;
		}}
          >
            <option value="">All cameras</option>
            ${(this._cameras ?? []).map((e) => g`<option value=${e.id} ?selected=${e.id === this._camera}>${e.name}</option>`)}
          </select>
        </div>
        <span class="label">Video quality</span>
        <div class="field" role="group" aria-label="Video quality">
          ${Y.map((t) => g`<label class="option"
              ><input
                type="checkbox"
                .checked=${this._streams.includes(t)}
                ?disabled=${e}
                @change=${(e) => {
			let n = e.target.checked;
			this._streams = Y.filter((e) => e === t ? n : this._streams.includes(e));
		}}
              />${Z[t]}</label
            >`)}
        </div>
        <span class="label">Also</span>
        <div class="field stack">
          <label class="option"
            ><input
              type="checkbox"
              .checked=${this._stock}
              ?disabled=${e}
              @change=${(e) => {
			this._stock = e.target.checked;
		}}
            />Compare with Home Assistant's own camera view</label
          >
          ${this._admin ? g`<label class="option"
                  ><input
                    type="checkbox"
                    .checked=${this._warm}
                    ?disabled=${e}
                    @change=${(e) => {
			this._warm = e.target.checked;
		}}
                  />Kept warm too: how fast cameras start when their connection is kept open</label
                >
                <label class="option"
                  ><input
                    type="checkbox"
                    .checked=${this._capacity}
                    ?disabled=${e}
                    @change=${(e) => {
			this._capacity = e.target.checked;
		}}
                  />NVR capacity test: how many streams each NVR serves at once (at home only)</label
                >` : i}
        </div>
      </div>
      ${oe(this._setup, navigator.userAgent) ? g`<div class="banner warning" role="alert">
            “${this._setup}” is for another kind of device: pick the one for this device, so the report is
            filed under it.
          </div>` : i}
      <div class="actions run">
        ${e ? g`<button @click=${() => this._check?.stop()}>Stop</button>` : g`<button
              class="primary"
              ?disabled=${!this._streams.length || !this._cameras}
              @click=${() => {
			this.runCheck({ setup: this._setup }).catch((e) => {
				this._error = t(e).message;
			});
		}}
            >
              ${this._check ? "Run it again" : "Run live check"}
            </button>`}
      </div>
      ${e && this._checkStatus ? g`<p class="progress" aria-live="polite">${this._checkStatus}…</p>` : i}
      ${this._error ? g`<div class="banner error" role="alert">${this._error}</div>` : i}
      <div class="stage" ?hidden=${!e} aria-label="Live video being measured"></div>
      ${this._check ? g`<rv-findings class="result" .summary=${this._check.inShort()}></rv-findings>` : i}
      ${this._checkText ? g`<details class="support">
            <summary>Details for support${y("chevronDown")}</summary>
            <p class="muted small">Every measurement, for a bug report or to compare devices.</p>
            <div class="actions">
              <button @click=${() => void this._copy(this._checkText, "current")}>
                ${this._copied === "current" ? "Copied" : "Copy report"}
              </button>
            </div>
            <pre class="report">${this._checkText}</pre>
          </details>` : i}
      ${this._renderReports()}`;
	}
	_renderStatus() {
		let e = this._status;
		if (!e) return i;
		let t = e.go2rtc;
		return g`<p class="small service">
        <span class="muted">Video service (go2rtc):</span>
        ${t.state}${t.version ? `, version ${t.version}` : ""}${t.error ? g` · <span class="error">${t.error}</span>` : i}
        ${t.state === "stopped" ? g`<span class="muted">(it starts with the first live video)</span>` : i}
      </p>
      ${t.log?.length ? g`<details>
            <summary class="small">Its log${y("chevronDown")}</summary>
            <pre class="report">${t.log.join("\n")}</pre>
          </details>` : i}`;
	}
	_renderReports() {
		let e = this._reports;
		return e?.length ? g`<details class="saved">
      <summary>Saved reports (${e.length})${y("chevronDown")}</summary>
      <ul class="reports">
        ${e.map((e) => g`<li>
            <div class="report-row">
              <span class="when"
                >${[
			a(Date.parse(e.updated), this.hass?.config?.time_zone),
			e.setup.slice(k.length),
			x(e.text)
		].filter(Boolean).join(" · ")}${e.done ? "" : " (not finished)"}</span
              >
              <button class="text" @click=${() => void this._copy(e.text, e.id)}>
                ${this._copied === e.id ? "Copied" : "Copy"}
              </button>
              <button
                class="text"
                aria-expanded=${this._shown === e.id ? "true" : "false"}
                @click=${() => {
			this._shown = this._shown === e.id ? void 0 : e.id;
		}}
              >
                ${this._shown === e.id ? "Hide" : "Show"}
              </button>
            </div>
            ${this._shown === e.id ? this._renderSaved(e.text) : i}
          </li>`)}
      </ul>
    </details>` : i;
	}
	_renderSaved(e) {
		let t = N(e);
		return t ? g`<rv-findings .summary=${t}></rv-findings>
      <details>
        <summary class="small">Details for support${y("chevronDown")}</summary>
        <pre class="report">${e}</pre>
      </details>` : g`<pre class="report">${e}</pre>`;
	}
	static styles = [C, m`
      :host {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      p {
        margin: 0;
      }
      .intro {
        font-size: 17px;
      }
      .service {
        display: flex;
        flex-wrap: wrap;
        gap: 0 6px;
      }
      .run {
        margin-top: 4px;
      }
      .progress {
        font-family: var(--rv-font-cond);
        font-size: 19px;
        font-weight: 600;
      }
      .stage[hidden] {
        display: none;
      }
      .stage {
        width: 100%;
        max-width: 480px;
        aspect-ratio: 16 / 9;
        background: var(--rv-board);
        overflow: hidden;
      }
      .stage video {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
      .result {
        margin-top: 6px;
      }
      details.support,
      details.saved {
        border-top: 2px solid var(--rv-rule-strong);
        padding-top: 6px;
      }
      details > p,
      details > .actions {
        margin: 6px 0 10px;
      }
      .reports {
        list-style: none;
        margin: 6px 0 0;
        padding: 0;
      }
      .reports li {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 6px 0;
        border-bottom: 1px solid var(--rv-rule);
      }
      .report-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px 12px;
      }
      .when {
        flex: 1;
        min-width: 14em;
        font-size: 15px;
      }
      .error {
        color: var(--rv-fault-ink);
        font-weight: 600;
      }
    `];
};
function ge() {
	try {
		let e = window.localStorage.getItem(X);
		if (e && R.includes(e)) return e;
	} catch {}
	return j(navigator.userAgent);
}
function _e(e) {
	try {
		window.localStorage.setItem(X, e);
	} catch {}
}
customElements.get("rv-live-check") || customElements.define("rv-live-check", $);
//#endregion
export { $ as RvLiveCheck, Q as capacityByDefault };

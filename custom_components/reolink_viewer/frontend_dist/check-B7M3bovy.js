import { $ as e, Bt as t, Et as n, Ht as r, J as i, Ot as a, Rt as o, St as s, Tt as c, Vt as l, X as u, Y as d, ct as f, dt as p, et as m, ft as h, gt as g, ht as _, kt as v, lt as y, mt as b, ot as x, st as S, ut as C, wt as w } from "./home-D5-WNgzo.js";
import { a as T, d as E, l as D, n as O, o as k, r as A, t as j } from "./findings-CjZkQ2Pp.js";
//#region src/live/check.ts
var M = "0.25.0", N = [
	"Desktop Chrome, LAN",
	"Desktop Chrome, Tailscale",
	"Desktop Chrome, Nabu Casa",
	"iPhone app, Wi-Fi (local)",
	"iPhone app, Tailscale",
	"iPhone app, Nabu Casa",
	"Other"
], P = 2e4, F = 12e3, I = 1e4, L = 2e3, R = 15e3, z = 1e3, B = 1e4, V = class extends Error {}, H = 2e3, U = 4e3, W = (e) => new Promise((t) => setTimeout(t, e)), G = class {
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
			this._log(e instanceof V ? "Stopped." : `Check failed: ${r(e).message}`);
		} finally {
			this._session?.close(), await this._go2rtcLog(), this.running = !1, this.status = "", this.plainStatus = "", this._log(`Done at ${(/* @__PURE__ */ new Date()).toLocaleTimeString()}.`), await this._save(!0);
		}
		return this.text;
	}
	async _go2rtcLog() {
		let e = (await v(this._hass).catch(() => void 0))?.go2rtc.log;
		if (e?.length) {
			this._log(""), this._log(`go2rtc log (last ${String(e.length)} lines):`);
			for (let t of e) this._log(`  ${t}`);
		}
	}
	_log(e) {
		this.lines.push(e), this._onChange(), performance.now() - this._lastSave > B && this._save(!1);
	}
	_status(e) {
		this.status = e, this._onChange();
	}
	_save(e) {
		return this._lastSave = performance.now(), this._saving = this._saving.then(() => this._hass.callWS({
			type: "reolink_viewer/playback/check_report",
			report_id: this.id,
			setup: `${S}${this.options.setup}`,
			text: this.text,
			done: e
		})).then(() => void 0).catch(() => void 0), this._saving;
	}
	_checkStopped() {
		if (this._stopped) throw new V();
	}
	async _header() {
		let t = this._hass.user?.is_admin === !0;
		this._log(`Reolink Viewer live check v${M} · ${this.options.setup} · ${(/* @__PURE__ */ new Date()).toLocaleString()}`), this._log(`Browser: ${D(navigator.userAgent)} · page ${E(location.hostname)} over ${location.protocol.replace(":", "")} · screen ${screen.width}×${screen.height} @${window.devicePixelRatio}x`), this._log(`User agent: ${navigator.userAgent}`);
		let n = e(), r = n ? window[n] : void 0;
		this._log(`MSE: ${n ?? "none"}${r ? `, takes ${h((e) => r.isTypeSupported(e)) || "none of go2rtc's codecs"}` : ""}`), this._log(`WebRTC receives: ${J()}`);
		let i = await w(this._hass).catch(() => []);
		this._ice = b(i), this._log(`ICE servers (Home Assistant's): ${C(i)}`);
		let a = this.options;
		this._log(`Streams: ${a.streams.join(", ")} · warm: ${a.warm && t ? "yes" : t ? "no" : "no (not an admin)"} · Home Assistant's view: ${a.stock ? "yes" : "no"} · capacity test: ${a.capacity && t ? "yes" : "no"}`);
		let o = performance.now(), s = (await v(this._hass)).go2rtc;
		this._log(`go2rtc: ${s.state}${s.version ? ` ${s.version}` : ""}${s.binary ? ` (${s.binary === "system" ? "Home Assistant's binary" : "downloaded, checksum verified"})` : ""}${s.error ? ` · error: ${s.error}` : ""} · restarts ${s.restarts} · WebRTC port ${s.webrtc_port} · status in ${Math.round(performance.now() - o)} ms`);
	}
	async _cameras() {
		let { cameras: e } = await c(this._hass), t = this.options.cameraIds?.length ? new Set(this.options.cameraIds) : void 0, n = e.filter((e) => !t || t.has(e.id));
		return this._log(`Cameras: ${n.map((e) => `${e.name}${e.connections.length > 1 ? ` (${e.connections.map((e) => e.via).join(" + ")})` : ""}`).join(", ")}`), n;
	}
	async _ourImages(e) {
		this._checkStopped(), this._status("our pictures");
		let t = /* @__PURE__ */ new Map(), n, i = () => void 0, a = performance.now(), o;
		this._log("");
		try {
			o = await l(this._hass, (e) => {
				n ??= performance.now() - a;
				for (let [n, r] of Object.entries(e.images)) t.set(n, r);
				i();
			});
		} catch (e) {
			this._log(`First images (ours): failed (${r(e).message})`);
			return;
		}
		let s = () => new Promise((e) => {
			i = e, setTimeout(e, 100);
		});
		try {
			let r = a + R;
			for (; n === void 0 && performance.now() < r;) await s();
			if (n === void 0) {
				this._log(`First images (ours): no list in ${_(R)}`);
				return;
			}
			this._log(`First images (ours, kept on the server): listed in ${Math.round(n)} ms`);
			for (let r of e) {
				this._checkStopped();
				let e = performance.now();
				for (; !t.has(r.id) && performance.now() < e + R;) await s();
				let i = t.get(r.id);
				if (!i) {
					this._log(`  ${r.name}: none in ${_(R)}`);
					continue;
				}
				let a = performance.now() - e, o = await Y(i.url);
				o.ms !== void 0 && this._posters.push({
					kind: "ours",
					ms: n + a + o.ms,
					cameraId: r.id
				});
				let c = Math.max(0, Date.now() - i.taken) / 1e3;
				this._log(`  ${r.name}: ${o.text}, taken ${c < 100 ? c.toFixed(1) : Math.round(c)} s before` + (a >= 50 ? ` (none kept: waited ${Math.round(a)} ms for it)` : ""));
			}
		} finally {
			await o().catch(() => void 0);
		}
	}
	async _hdChoices(e) {
		this._log(""), this._log("Full screen (HD), in this browser:");
		for (let t of e) {
			let e = x(t);
			e && this._log(`  ${t.name}: ${(await m(e)).reason}`);
		}
	}
	async _measureStream(e, t, n) {
		this._checkStopped();
		let i = {
			connectionId: t.connection_id,
			stream: n
		}, s = t.streams[n], c = t.via === "nvr" ? `via ${t.entry_title}` : "direct";
		if (this._log(""), !s) {
			this._log(`${e.name}${e.model ? ` (${e.model})` : ""} · ${c} · ${n}: not served by this connection`);
			return;
		}
		this._log(`${e.name}${e.model ? ` (${e.model})` : ""} · ${c} · ${g(n, s.encoding)}`);
		let l = `${e.name} ${c} ${n}`, u = (r, i, a) => {
			this._measured.push({
				cameraId: e.id,
				camera: e.name,
				connection: t,
				stream: n,
				phase: r,
				transport: i,
				result: a
			});
		}, d = [], p = (e.keep_warm_entity ? this._hass.states[e.keep_warm_entity]?.state === "on" : !1) && n === "sub" && x(e) === t, m = p ? "kept warm by its switch; turn it off to measure cold" : "a viewer kept it running";
		for (let e of ["WebRTC", "MSE"]) {
			this._status(`${l}: cold ${e}`);
			let t = !p && await this._waitCold(i), n = await this._session_(e, i, P);
			u("cold", e, n), d.push(`${e} ${K(n)}${t ? "" : ` (${m}: not cold)`}`), e === "MSE" && d.push(...await this._videoOnly(n, i, P, l));
		}
		if (this._log(`  cold: ${d.join(" · ")}`), this.options.stock) {
			let e = s.entity_id;
			if (!e) this._log(`  Home Assistant's view: no enabled camera entity for ${n}`);
			else {
				this._status(`${l}: Home Assistant's view`);
				let t = await this._stockPoster(e), n = await this._stock(e);
				u("stock", "WebRTC", n), this._log(`  Home Assistant's view (${e}): snapshot ${t} · WebRTC ${K(n)}`);
			}
		}
		if (this.options.warm && this._hass.user?.is_admin) {
			if (t.is_battery) {
				this._log("  warm: not measured (battery camera: never kept warm)");
				return;
			}
			this._status(`${l}: keeping it warm`);
			let e = performance.now(), n;
			try {
				({key_frame: n} = await o(this._hass, i, !0));
			} catch (e) {
				this._log(`  warm: keeping it warm failed: ${r(e).message}`);
				return;
			}
			let s = performance.now() - e;
			try {
				await this._pause(L);
				let e = await this._frame(i), t = [];
				for (let e of ["WebRTC", "MSE"]) {
					this._status(`${l}: warm ${e}`);
					let n = await this._session_(e, i, F);
					u("warm", e, n), t.push(`${e} ${K(n)}`), e === "MSE" && t.push(...await this._videoOnly(n, i, F, l));
				}
				let r = (await a(this._hass, i).catch(() => void 0))?.cache, o = n ? `key frame cached in ${_(s)}` : `no key frame in ${_(s)}`;
				this._log(`  warm (${o}${f(r)}): frame ${e} · ${t.join(" · ")}`);
			} finally {
				await o(this._hass, i, !1).catch(() => void 0);
			}
		}
	}
	async _waitCold(e) {
		let t = performance.now() + I;
		for (; performance.now() < t;) {
			if (this._checkStopped(), !(await a(this._hass, e).catch(() => void 0))?.state?.active) return !0;
			await W(250);
		}
		return !1;
	}
	async _pause(e) {
		let t = performance.now() + e;
		for (; performance.now() < t;) this._checkStopped(), await W(Math.min(250, t - performance.now()));
	}
	async _session_(e, t, n) {
		return this._watch((r) => e === "WebRTC" ? new d(this._hass, r, t, this._ice, n) : new i(this._hass, r, t, n));
	}
	async _videoOnly(e, t, n, r) {
		return !e.ok || e.firstFrameMs === void 0 || !("appended" in e.steps) || e.firstFrameMs - e.steps.appended <= z ? [] : (this._status(`${r}: MSE video only`), [`MSE video only ${K(await this._watch((e) => new i(this._hass, e, t, n, location.href, !0)))}`]);
	}
	_stock(e) {
		return this._watch((t) => new u(this._hass, t, e, P));
	}
	async _watch(e) {
		this._checkStopped();
		let t = document.createElement("video");
		this._stage.replaceChildren(t);
		let n = e(t);
		this._session = n;
		try {
			let e = await n.done;
			return e.ok && await W(this.afterFrameMs), e;
		} finally {
			n.close(), this._session = void 0, t.remove();
		}
	}
	async _stockPoster(e) {
		let t = this._hass.states[e]?.attributes.entity_picture;
		if (typeof t != "string") return "no picture";
		let n = await Y(`${t}${t.includes("?") ? "&" : "?"}_=${Date.now()}`);
		return n.ms !== void 0 && this._posters.push({
			kind: "HA snapshot",
			ms: n.ms
		}), n.text;
	}
	async _frame(e) {
		try {
			let { path: t } = await n(this._hass, e), r = await Y(t);
			return r.ms !== void 0 && this._posters.push({
				kind: "go2rtc frame",
				ms: r.ms
			}), r.text;
		} catch (e) {
			return `failed (${r(e).message})`;
		}
	}
	async _capacityTests() {
		if (!this._hass.user?.is_admin) {
			this._log(""), this._log("Capacity test: not run (admins only).");
			return;
		}
		let e = await s(this._hass);
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
				for (let e of y(n)) this._log(e);
			}
		}
	}
	_capacity_(e, n) {
		return new Promise((i) => {
			let a, o = !1, s = (e) => {
				o || (o = !0, a?.().catch(() => void 0), i(e));
			};
			t(this._hass, e, (e) => {
				e.type === "progress" ? n(e.message) : e.type === "result" ? s(e.report) : s(e.advice ? {
					message: e.message,
					advice: e.advice
				} : { message: e.message });
			}).then((e) => {
				a = e, o && e().catch(() => void 0);
			}).catch((e) => {
				s({ message: r(e).message });
			});
		});
	}
	inShort(e = !this.running) {
		let t = [], n = [], r = [], i = 0, a = 0, o = (e) => {
			let t = e.filter((e) => e.result.ok).map((e) => e.result.firstFrameMs ?? 0);
			return t.length ? Math.min(...t) : void 0;
		};
		for (let e of this._chosen) {
			let s = x(e), c = this._measured.filter((t) => t.cameraId === e.id && t.connection === s), l = c.filter((e) => e.phase === "cold");
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
			let f = u.length ? o(l.filter((e) => e.stream !== "sub")) : void 0, p = o(c.filter((e) => e.phase === "warm" && e.stream === "sub")), m = k(d, H, U);
			m === "slow" && r.push(e.name);
			let h = [`live video starts in ${T(d)}`];
			f !== void 0 && h.push(`full screen in HD in ${T(f)}`), p !== void 0 && h.push(`kept warm, in ${T(p)}`);
			let g;
			m !== "good" && s?.is_battery ? g = "Battery cameras wake up before they stream, so a few seconds is normal." : m !== "good" && e.keep_warm_entity && this._hass.states[e.keep_warm_entity]?.state !== "on" && (g = "Turn on its “keep live view warm” switch in Home Assistant to make it start faster" + (p === void 0 ? "." : ` (about ${T(p)} here).`)), t.push({
				grade: m,
				text: `${e.name}: ${h.join("; ")}.`,
				...g ? { advice: g } : {}
			});
		}
		let s = this._posters.filter((e) => e.kind === "ours").map((e) => e.ms), c = A(s);
		c !== void 0 && t.push({
			grade: k(c, 1e3, 2500),
			text: `A still picture of each camera shows in ${c < 100 ? "" : "about "}${T(c)}, while its live video starts.`
		});
		let l = this._measured.filter((e) => e.phase === "stock"), u = [];
		for (let e of l) {
			let t = o(this._measured.filter((t) => t.connection === e.connection && t.stream === e.stream && t.phase !== "stock"));
			t !== void 0 && e.result.ok && u.push([t, e.result.firstFrameMs ?? 0]);
		}
		if (u.length) {
			let e = u.filter(([e, t]) => e < t).length, n = A(u.map(([e]) => e)) ?? 0, r = A(u.map(([, e]) => e)) ?? 0;
			t.push({
				grade: "note",
				text: `Compared with Home Assistant's own camera view: this viewer was quicker on ${String(e)} of ${j(u.length, "stream")} (typically ${T(n)} against ${T(r)}).`
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
					text: `${e} kept up with ${j(r, "video stream")} at once.`
				});
			} else {
				let i = n.levels.find((e) => e.level === r)?.streams.length;
				t.push({
					grade: "slow",
					text: `${e} struggled with ${i === void 0 ? "several streams" : j(i, "video stream")} at once.`,
					advice: "Keep fewer of its cameras warm, or watch fewer of them in full screen at the same time."
				});
			}
		}
		for (let { host: e, message: n, advice: r } of this._capacityFailed) t.push({
			grade: "note",
			text: `${e}'s capacity test could not run${/^[A-Z]/.test(n) ? "." : ":"} ${n}${/[.!?]$/.test(n) ? "" : "."}`,
			...r ? { advice: r } : {}
		});
		let p = A(n), m = i - a, h = a ? `${String(m)} of ${j(i, "camera")} started live video; ${String(a)} did not` : `${i === 1 ? "The camera" : i === 2 ? "Both cameras" : `All ${j(i, "camera")}`} started live video` + (p === void 0 ? "" : `, typically in ${T(p)}`), g = r.length ? `; ${String(r.length)} ${r.length === 1 ? "is" : "are"} slow: ${r.join(", ")}` : "";
		return {
			headline: i ? `${e ? "" : "So far: "}${h}${g}.` : e ? "No camera was measured." : "Measuring…",
			findings: t
		};
	}
	_summary(e) {
		let t = this._measured;
		this._log("");
		for (let e of O(this.inShort(!0))) this._log(e);
		this._log(""), this._log("Summary:");
		let n = t.filter((e) => e.transport === "WebRTC" && e.phase !== "stock"), r = n.filter((e) => "connected" in e.result.steps), i = q(r.map((e) => `${e.result.pair?.local ?? "?"} ↔ ${e.result.pair?.remote ?? "?"}`));
		this._log(`- WebRTC connected ${r.length} of ${n.length} sessions${i ? ` (${i})` : ""}`);
		for (let e of ["cold", "warm"]) for (let n of ["WebRTC", "MSE"]) for (let r of [["sub"], ["main", "ext"]]) {
			let i = t.filter((t) => t.phase === e && t.transport === n && r.includes(t.stream)).filter((e) => e.result.ok).map((e) => e.result.firstFrameMs ?? 0), a = t.filter((t) => t.phase === e && t.transport === n && r.includes(t.stream)).length;
			a && this._log(`- ${e} ${n}, ${r.join("/")}: median ${_(p(i))}, ${i.length} of ${a} played` + (i.length ? ` (${_(Math.min(...i))}–${_(Math.max(...i))})` : ""));
		}
		let a = t.filter((e) => e.phase === "stock");
		if (a.length) {
			let e = 0, n = 0;
			for (let r of a) {
				let i = t.filter((e) => e.connection === r.connection && e.stream === r.stream && e.phase !== "stock" && e.result.ok), a = i.length ? Math.min(...i.map((e) => e.result.firstFrameMs ?? Infinity)) : void 0;
				a !== void 0 && r.result.ok && (n += 1, a < (r.result.firstFrameMs ?? Infinity) && (e += 1));
			}
			let r = a.filter((e) => e.result.ok).map((e) => e.result.firstFrameMs ?? 0);
			this._log(`- Home Assistant's view: median ${_(p(r))}, ${r.length} of ${a.length} played; ours (best of cold/warm) faster on ${e} of ${n}`);
		}
		for (let e of [
			"ours",
			"HA snapshot",
			"go2rtc frame"
		]) {
			let t = this._posters.filter((t) => t.kind === e).map((e) => e.ms);
			t.length && this._log(`- first image, ${e}: median ${_(p(t))} (${t.length}), slowest ${_(Math.max(...t))}`);
		}
		for (let n of e.filter((e) => e.connections.length > 1)) {
			let e = n.connections.map((e) => {
				let n = t.filter((t) => t.connection === e && t.stream === "sub" && t.phase === "cold" && t.result.ok), r = p(n.map((e) => e.result.firstFrameMs ?? 0));
				return `${e.via === "nvr" ? "via NVR" : "direct"} cold sub ${_(r)}`;
			});
			this._log(`- ${n.name}: ${e.join(" vs ")}`);
		}
		for (let { host: e, report: t } of this._capacity) {
			let n = t.verdict;
			this._log(`- capacity ${e}: ${n.first_failing_level === null ? `kept up at every level (${t.levels.length})` : `level ${n.first_failing_level} fails or slows down (${n.reasons.join("; ")})`}`);
		}
	}
};
function K(e) {
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
	return e.ok ? `${_(e.firstFrameMs)}${a ? ` (${a})` : ""}` : `✗ ${e.error ?? "failed"}${a ? ` (${a})` : ""}`;
}
function q(e) {
	let t = /* @__PURE__ */ new Map();
	for (let n of e) t.set(n, (t.get(n) ?? 0) + 1);
	return [...t].map(([e, t]) => `${t}× ${e}`).join(", ");
}
function J() {
	let e = typeof RTCRtpReceiver < "u" ? RTCRtpReceiver.getCapabilities("video") : null;
	return e ? [...new Set(e.codecs.map((e) => e.mimeType.replace(/^video\//, "")).filter((e) => !/rtx|red|ulpfec|flexfec/i.test(e)))].join(", ") : "unknown";
}
function Y(e) {
	return new Promise((t) => {
		let n = performance.now(), r = new Image(), i = setTimeout(() => {
			t({ text: "timed out" });
		}, R);
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
export { N as n, G as r, M as t };

import { a as e, n as t, r as n, t as r } from "./lit-DdRjbP0M.js";
import { B as i, E as a, Ft as o, G as s, H as c, It as l, J as u, K as d, Lt as f, Nt as p, R as m, S as h, T as g, U as _, V as ee, W as v, Y as y, Z as b, at as x, b as S, dt as C, ft as te, h as w, ht as T, j as E, mt as D, n as O, p as k, q as ne, st as re, x as ie } from "./live-DbkkZT-0.js";
import { J as ae, nt as oe } from "./home-xPpoRa6e.js";
import { a as A, i as se, n as ce, o as j, r as M, t as N } from "./findings-DW6UZzjC.js";
import { d as P, m as F, p as I, r as L } from "./check-DPXS4aiq.js";
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
			this._log(e instanceof G ? "Stopped." : `Check failed: ${f(e).message}`);
		} finally {
			this._session?.close(), await this._go2rtcLog(), this.running = !1, this.status = "", this.plainStatus = "", this._log(`Done at ${(/* @__PURE__ */ new Date()).toLocaleTimeString()}.`), await this._save(!0);
		}
		return this.text;
	}
	async _go2rtcLog() {
		let e = (await T(this._hass).catch(() => void 0))?.go2rtc.log;
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
			setup: `${i}${this.options.setup}`,
			text: this.text,
			done: e
		})).then(() => void 0).catch(() => void 0), this._saving;
	}
	_checkStopped() {
		if (this._stopped) throw new G();
	}
	async _header() {
		let e = this._hass.user?.is_admin === !0;
		this._log(`Reolink Viewer live check v${oe} · ${this.options.setup} · ${(/* @__PURE__ */ new Date()).toLocaleString()}`), this._log(`Browser: ${P(navigator.userAgent)} · page ${w(location.hostname)} over ${location.protocol.replace(":", "")} · screen ${screen.width}×${screen.height} @${window.devicePixelRatio}x`), this._log(`User agent: ${navigator.userAgent}`);
		let t = g(), n = t ? window[t] : void 0;
		this._log(`MSE: ${t ?? "none"}${n ? `, takes ${s((e) => n.isTypeSupported(e)) || "none of go2rtc's codecs"}` : ""}`), this._log(`WebRTC receives: ${he()}`);
		let r = await re(this._hass).catch(() => []);
		this._ice = ne(r), this._log(`ICE servers (Home Assistant's): ${_(r)}`);
		let i = this.options;
		this._log(`Streams: ${i.streams.join(", ")} · warm: ${i.warm && e ? "yes" : e ? "no" : "no (not an admin)"} · Home Assistant's view: ${i.stock ? "yes" : "no"} · capacity test: ${i.capacity && e ? `yes${(i.capacityMains ?? 1) > 1 ? ` (${String(i.capacityMains)} mains)` : ""}` : "no"}`);
		let a = performance.now(), o = (await T(this._hass)).go2rtc;
		this._log(`go2rtc: ${o.state}${o.version ? ` ${o.version}` : ""}${o.binary ? ` (${o.binary === "system" ? "Home Assistant's binary" : "downloaded, checksum verified"})` : ""}${o.error ? ` · error: ${o.error}` : ""} · restarts ${o.restarts} · WebRTC port ${o.webrtc_port} · status in ${Math.round(performance.now() - a)} ms`);
	}
	async _cameras() {
		let { cameras: e } = await C(this._hass), t = this.options.cameraIds?.length ? new Set(this.options.cameraIds) : void 0, n = e.filter((e) => !t || t.has(e.id));
		return this._log(`Cameras: ${n.map((e) => `${e.name}${e.connections.length > 1 ? ` (${e.connections.map((e) => e.via).join(" + ")})` : ""}`).join(", ")}`), n;
	}
	async _ourImages(e) {
		this._checkStopped(), this._status("our pictures");
		let t = /* @__PURE__ */ new Map(), n, r = () => void 0, i = performance.now(), a;
		this._log("");
		try {
			a = await l(this._hass, (e) => {
				n ??= performance.now() - i;
				for (let [n, r] of Object.entries(e.images)) t.set(n, r);
				r();
			});
		} catch (e) {
			this._log(`First images (ours): failed (${f(e).message})`);
			return;
		}
		let o = () => new Promise((e) => {
			r = e, setTimeout(e, 100);
		});
		try {
			let r = i + U;
			for (; n === void 0 && performance.now() < r;) await o();
			if (n === void 0) {
				this._log(`First images (ours): no list in ${u(U)}`);
				return;
			}
			this._log(`First images (ours, kept on the server): listed in ${Math.round(n)} ms`);
			for (let r of e) {
				this._checkStopped();
				let e = performance.now();
				for (; !t.has(r.id) && performance.now() < e + U;) await o();
				let i = t.get(r.id);
				if (!i) {
					this._log(`  ${r.name}: none in ${u(U)}`);
					continue;
				}
				let a = performance.now() - e, s = await J(i.url);
				s.ms !== void 0 && this._posters.push({
					kind: "ours",
					ms: n + a + s.ms,
					cameraId: r.id
				});
				let c = Math.max(0, Date.now() - i.taken) / 1e3;
				this._log(`  ${r.name}: ${s.text}, taken ${c < 100 ? c.toFixed(1) : Math.round(c)} s before` + (a >= 50 ? ` (none kept: waited ${Math.round(a)} ms for it)` : ""));
			}
		} finally {
			await a().catch(() => void 0);
		}
	}
	async _hdChoices(e) {
		this._log(""), this._log("Full screen (HD), in this browser:");
		for (let t of e) {
			let e = m(t);
			e && this._log(`  ${t.name}: ${(await a(e)).reason}`);
		}
	}
	async _measureStream(e, t, n) {
		this._checkStopped();
		let r = {
			connectionId: t.connection_id,
			stream: n
		}, i = t.streams[n], a = t.via === "nvr" ? `via ${t.entry_title}` : "direct";
		if (this._log(""), !i) {
			this._log(`${e.name}${e.model ? ` (${e.model})` : ""} · ${a} · ${n}: not served by this connection`);
			return;
		}
		this._log(`${e.name}${e.model ? ` (${e.model})` : ""} · ${a} · ${y(n, i.encoding)}`);
		let o = `${e.name} ${a} ${n}`, s = (r, i, a) => {
			this._measured.push({
				cameraId: e.id,
				camera: e.name,
				connection: t,
				stream: n,
				phase: r,
				transport: i,
				result: a
			});
		}, c = [], l = (e.keep_warm_entity ? this._hass.states[e.keep_warm_entity]?.state === "on" : !1) && n === "sub" && m(e) === t, d = l ? "kept warm by its switch; turn it off to measure cold" : "a viewer kept it running";
		for (let e of ["WebRTC", "MSE"]) {
			this._status(`${o}: cold ${e}`);
			let t = !l && await this._waitCold(r), n = await this._session_(e, r, z);
			s("cold", e, n), c.push(`${e} ${q(n)}${t ? "" : ` (${d}: not cold)`}`), e === "MSE" && c.push(...await this._videoOnly(n, r, z, o));
		}
		if (this._log(`  cold: ${c.join(" · ")}`), this.options.stock) {
			let e = i.entity_id;
			if (!e) this._log(`  Home Assistant's view: no enabled camera entity for ${n}`);
			else {
				this._status(`${o}: Home Assistant's view`);
				let t = await this._stockPoster(e), n = await this._stock(e);
				s("stock", "WebRTC", n), this._log(`  Home Assistant's view (${e}): snapshot ${t} · WebRTC ${q(n)}`);
			}
		}
		if (this.options.warm && this._hass.user?.is_admin) {
			if (t.is_battery) {
				this._log("  warm: not measured (battery camera: never kept warm)");
				return;
			}
			this._status(`${o}: keeping it warm`);
			let e = performance.now(), n;
			try {
				({key_frame: n} = await p(this._hass, r, !0));
			} catch (e) {
				this._log(`  warm: keeping it warm failed: ${f(e).message}`);
				return;
			}
			let i = performance.now() - e;
			try {
				await this._pause(H);
				let e = await this._frame(r), t = [];
				for (let e of ["WebRTC", "MSE"]) {
					this._status(`${o}: warm ${e}`);
					let n = await this._session_(e, r, B);
					s("warm", e, n), t.push(`${e} ${q(n)}`), e === "MSE" && t.push(...await this._videoOnly(n, r, B, o));
				}
				let a = (await D(this._hass, r).catch(() => void 0))?.cache, c = n ? `key frame cached in ${u(i)}` : `no key frame in ${u(i)}`;
				this._log(`  warm (${c}${ee(a)}): frame ${e} · ${t.join(" · ")}`);
			} finally {
				await p(this._hass, r, !1).catch(() => void 0);
			}
		}
	}
	async _waitCold(e) {
		let t = performance.now() + V;
		for (; performance.now() < t;) {
			if (this._checkStopped(), !(await D(this._hass, e).catch(() => void 0))?.state?.active) return !0;
			await K(250);
		}
		return !1;
	}
	async _pause(e) {
		let t = performance.now() + e;
		for (; performance.now() < t;) this._checkStopped(), await K(Math.min(250, t - performance.now()));
	}
	async _session_(e, t, n) {
		return this._watch((r) => e === "WebRTC" ? new ie(this._hass, r, t, this._ice, n) : new S(this._hass, r, t, n));
	}
	async _videoOnly(e, t, n, r) {
		return !e.ok || e.firstFrameMs === void 0 || !("appended" in e.steps) || e.firstFrameMs - e.steps.appended <= W ? [] : (this._status(`${r}: MSE video only`), [`MSE video only ${q(await this._watch((e) => new S(this._hass, e, t, n, location.href, !0)))}`]);
	}
	_stock(e) {
		return this._watch((t) => new h(this._hass, t, e, z));
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
			let { path: t } = await te(this._hass, e), n = await J(t);
			return n.ms !== void 0 && this._posters.push({
				kind: "go2rtc frame",
				ms: n.ms
			}), n.text;
		} catch (e) {
			return `failed (${f(e).message})`;
		}
	}
	async _capacityTests() {
		if (!this._hass.user?.is_admin) {
			this._log(""), this._log("Capacity test: not run (admins only).");
			return;
		}
		let e = await x(this._hass);
		for (let t of e.hosts) {
			this._checkStopped();
			let e = t.name ?? t.id;
			this._log("");
			let n = this.options.capacityMains ?? 1;
			this._log(`Capacity test: ${e} (sub streams one by one, then ${n > 1 ? `${String(n)} mains` : "a main"}, then a recording download)`), this._status(`capacity test: ${e}`);
			let r = await this._capacity_(t.id, (t) => {
				this._status(`capacity test: ${e}: ${t}`);
			});
			if ("message" in r) this._log(`  failed: ${r.message}${r.advice ? ` ${r.advice}` : ""}`), this._capacityFailed.push({
				host: e,
				...r
			});
			else {
				this._capacity.push({
					host: e,
					report: r
				});
				for (let e of c(r)) this._log(e);
			}
		}
	}
	_capacity_(e, t) {
		return new Promise((n) => {
			let r, i = !1, a = (e) => {
				i || (i = !0, r?.().catch(() => void 0), n(e));
			}, s = this.options.capacityMains ?? 1;
			o(this._hass, e, (e) => {
				e.type === "progress" ? t(e.message) : e.type === "result" ? a(e.report) : a(e.advice ? {
					message: e.message,
					advice: e.advice
				} : { message: e.message });
			}, s > 1 ? { mains: s } : {}).then((e) => {
				r = e, i && e().catch(() => void 0);
			}).catch((e) => {
				a({ message: f(e).message });
			});
		});
	}
	inShort(e = !this.running) {
		let t = [], n = [], r = [], i = 0, a = 0, o = (e) => {
			let t = e.filter((e) => e.result.ok).map((e) => e.result.firstFrameMs ?? 0);
			return t.length ? Math.min(...t) : void 0;
		};
		for (let e of this._chosen) {
			let s = m(e), c = this._measured.filter((t) => t.cameraId === e.id && t.connection === s), l = c.filter((e) => e.phase === "cold");
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
			let f = u.length ? o(l.filter((e) => e.stream !== "sub")) : void 0, p = o(c.filter((e) => e.phase === "warm" && e.stream === "sub")), h = j(d, ue, de);
			h === "slow" && r.push(e.name);
			let g = [`live video starts in ${A(d)}`];
			f !== void 0 && g.push(`full screen in HD in ${A(f)}`), p !== void 0 && g.push(`kept warm, in ${A(p)}`);
			let _;
			h !== "good" && s?.is_battery ? _ = "Battery cameras wake up before they stream, so a few seconds is normal." : h !== "good" && e.keep_warm_entity && this._hass.states[e.keep_warm_entity]?.state !== "on" && (_ = "Turn on its “keep live view warm” switch in Home Assistant to make it start faster" + (p === void 0 ? "." : ` (about ${A(p)} here).`)), t.push({
				grade: h,
				text: `${e.name}: ${g.join("; ")}.`,
				..._ ? { advice: _ } : {}
			});
		}
		let s = this._posters.filter((e) => e.kind === "ours").map((e) => e.ms), c = M(s);
		c !== void 0 && t.push({
			grade: j(c, 1e3, 2500),
			text: `A still picture of each camera shows in ${c < 100 ? "" : "about "}${A(c)}, while its live video starts.`
		});
		let l = this._measured.filter((e) => e.phase === "stock"), u = [];
		for (let e of l) {
			let t = o(this._measured.filter((t) => t.connection === e.connection && t.stream === e.stream && t.phase !== "stock"));
			t !== void 0 && e.result.ok && u.push([t, e.result.firstFrameMs ?? 0]);
		}
		if (u.length) {
			let e = u.filter(([e, t]) => e < t).length, n = M(u.map(([e]) => e)) ?? 0, r = M(u.map(([, e]) => e)) ?? 0;
			t.push({
				grade: "note",
				text: `Compared with Home Assistant's own camera view: this viewer was quicker on ${String(e)} of ${N(u.length, "stream")} (typically ${A(n)} against ${A(r)}).`
			});
		}
		let d = this._measured.filter((e) => e.transport === "WebRTC" && e.phase !== "stock"), f = this._measured.some((e) => e.transport === "MSE" && e.result.ok);
		d.length && !d.some((e) => "connected" in e.result.steps) && f && t.push({
			grade: "note",
			text: "WebRTC could not connect from this device, so live video used the viewer's other way of streaming (MSE), which worked."
		});
		for (let { host: e, report: n } of this._capacity) {
			let r = n.verdict.first_failing_level, i = new Set(n.no_video ?? []);
			if (r === null) {
				let r = Math.max(0, ...n.levels.map((e) => e.streams.filter((e) => !i.has(e.stream)).length));
				t.push({
					grade: "good",
					text: `${e} kept up with ${N(r, "video stream")} at once.`
				});
			} else {
				let i = n.levels.find((e) => e.level === r)?.streams.length;
				t.push({
					grade: "slow",
					text: `${e} struggled with ${i === void 0 ? "several streams" : N(i, "video stream")} at once.`,
					advice: "Keep fewer of its cameras warm, or watch fewer of them in full screen at the same time."
				});
			}
			for (let n of i) {
				let [, r = n, i] = /^(.*) (main|ext|sub)$/.exec(n) ?? [], a = i === "main" ? "full-resolution stream" : i === "sub" ? "lighter stream" : "stream";
				t.push({
					grade: "note",
					text: `${r}'s ${a} sent no video in ${e}'s capacity test, while a stream added after it played: the camera's, not ${e}'s limit.`,
					advice: "If its picture does not play in the Reolink app either, restart the camera."
				});
			}
			let a = (n.main_left_out ?? []).map((e) => e.camera);
			a.length && t.push({
				grade: "note",
				text: a.length === 1 ? `${e}'s capacity test left out ${a.join("")}'s full-resolution stream: it sent no video, even on its own.` : `${e}'s capacity test left out the full-resolution streams of ${pe(a)}: they sent no video, even on their own.`,
				advice: `If ${a.length === 1 ? "its full picture does" : "their full pictures do"} not play in the Reolink app either, restart ${a.length === 1 ? "the camera" : "those cameras"}.`
			});
		}
		for (let { host: e, message: n, advice: r } of this._capacityFailed) t.push({
			grade: "note",
			text: `${e}'s capacity test could not run${/^[A-Z]/.test(n) ? "." : ":"} ${n}${/[.!?]$/.test(n) ? "" : "."}`,
			...r ? { advice: r } : {}
		});
		let p = M(n), h = i - a, g = a ? `${String(h)} of ${N(i, "camera")} started live video; ${String(a)} did not` : `${i === 1 ? "The camera" : i === 2 ? "Both cameras" : `All ${N(i, "camera")}`} started live video` + (p === void 0 ? "" : `, typically in ${A(p)}`), _ = r.length ? `; ${String(r.length)} ${r.length === 1 ? "is" : "are"} slow: ${r.join(", ")}` : "";
		return {
			headline: i ? `${e ? "" : "So far: "}${g}${_}.` : e ? "No camera was measured." : "Measuring…",
			findings: t
		};
	}
	_summary(e) {
		let t = this._measured;
		this._log("");
		for (let e of ce(this.inShort(!0))) this._log(e);
		this._log(""), this._log("Summary:");
		let n = t.filter((e) => e.transport === "WebRTC" && e.phase !== "stock"), r = n.filter((e) => "connected" in e.result.steps), i = me(r.map((e) => `${e.result.pair?.local ?? "?"} ↔ ${e.result.pair?.remote ?? "?"}`));
		this._log(`- WebRTC connected ${r.length} of ${n.length} sessions${i ? ` (${i})` : ""}`);
		for (let e of ["cold", "warm"]) for (let n of ["WebRTC", "MSE"]) for (let r of [["sub"], ["main", "ext"]]) {
			let i = t.filter((t) => t.phase === e && t.transport === n && r.includes(t.stream)).filter((e) => e.result.ok).map((e) => e.result.firstFrameMs ?? 0), a = t.filter((t) => t.phase === e && t.transport === n && r.includes(t.stream)).length;
			a && this._log(`- ${e} ${n}, ${r.join("/")}: median ${u(v(i))}, ${i.length} of ${a} played` + (i.length ? ` (${u(Math.min(...i))}–${u(Math.max(...i))})` : ""));
		}
		let a = t.filter((e) => e.phase === "stock");
		if (a.length) {
			let e = 0, n = 0;
			for (let r of a) {
				let i = t.filter((e) => e.connection === r.connection && e.stream === r.stream && e.phase !== "stock" && e.result.ok), a = i.length ? Math.min(...i.map((e) => e.result.firstFrameMs ?? Infinity)) : void 0;
				a !== void 0 && r.result.ok && (n += 1, a < (r.result.firstFrameMs ?? Infinity) && (e += 1));
			}
			let r = a.filter((e) => e.result.ok).map((e) => e.result.firstFrameMs ?? 0);
			this._log(`- Home Assistant's view: median ${u(v(r))}, ${r.length} of ${a.length} played; ours (best of cold/warm) faster on ${e} of ${n}`);
		}
		for (let e of [
			"ours",
			"HA snapshot",
			"go2rtc frame"
		]) {
			let t = this._posters.filter((t) => t.kind === e).map((e) => e.ms);
			t.length && this._log(`- first image, ${e}: median ${u(v(t))} (${t.length}), slowest ${u(Math.max(...t))}`);
		}
		for (let n of e.filter((e) => e.connections.length > 1)) {
			let e = n.connections.map((e) => {
				let n = t.filter((t) => t.connection === e && t.stream === "sub" && t.phase === "cold" && t.result.ok), r = v(n.map((e) => e.result.firstFrameMs ?? 0));
				return `${e.via === "nvr" ? "via NVR" : "direct"} cold sub ${u(r)}`;
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
	return e.ok ? `${u(e.firstFrameMs)}${a ? ` (${a})` : ""}` : `✗ ${e.error ?? "failed"}${a ? ` (${a})` : ""}`;
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
var $ = class extends r {
	static properties = {
		hass: { attribute: !1 },
		_status: { state: !0 },
		_cameras: { state: !0 },
		_setup: { state: !0 },
		_streams: { state: !0 },
		_warm: { state: !0 },
		_stock: { state: !0 },
		_capacity: { state: !0 },
		_mains: { state: !0 },
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
		super(), this._setup = ge(), this._streams = [...Y], this._warm = !0, this._stock = !0, this._capacity = !0, this._mains = 1, this._camera = "", this._checkText = "", this._checkStatus = "";
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
				let [t, n] = await Promise.all([T(e), C(e)]);
				this._status = t, this._cameras = n.cameras;
			} catch (e) {
				this._error = f(e).message;
			}
			this._loadReports();
		}
	}
	async _loadReports() {
		if (this.hass) try {
			let { reports: e } = await L(this.hass);
			this._reports = e.filter((e) => e.setup.startsWith(i));
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
			capacityMains: e.capacityMains ?? this._mains,
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
		this.hass && (this._status = await T(this.hass).catch(() => this._status));
	}
	async _copy(e, t) {
		await O(e) ? this._copied = t : (this._copied = void 0, this._shown = t, ae(this, "Copying is blocked here: select the text instead, or copy it from Saved reports on a computer", "error"));
	}
	render() {
		let e = this._check?.running === !0;
		return n`<p class="intro">
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
            ${R.map((e) => n`<option value=${e} ?selected=${e === this._setup}>${e}</option>`)}
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
            ${(this._cameras ?? []).map((e) => n`<option value=${e.id} ?selected=${e.id === this._camera}>${e.name}</option>`)}
          </select>
        </div>
        <span class="label">Video quality</span>
        <div class="field" role="group" aria-label="Video quality">
          ${Y.map((t) => n`<label class="option"
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
          ${this._admin ? n`<label class="option"
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
                >
                ${this._capacity ? n`<label class="option nested"
                      >Full-resolution streams in it
                      <select
                        .value=${String(this._mains)}
                        ?disabled=${e}
                        @change=${(e) => {
			this._mains = Number(e.target.value);
		}}
                      >
                        <option value="1">1 (full screen)</option>
                        <option value="2">2</option>
                        <option value="3">3 (HD in the Wall's tiles)</option>
                      </select></label
                    >` : t}` : t}
        </div>
      </div>
      ${F(this._setup, navigator.userAgent) ? n`<div class="banner warning" role="alert">
            “${this._setup}” is for another kind of device: pick the one for this device, so the report is
            filed under it.
          </div>` : t}
      <div class="actions run">
        ${e ? n`<button @click=${() => this._check?.stop()}>Stop</button>` : n`<button
              class="primary"
              ?disabled=${!this._streams.length || !this._cameras}
              @click=${() => {
			this.runCheck({ setup: this._setup }).catch((e) => {
				this._error = f(e).message;
			});
		}}
            >
              ${this._check ? "Run it again" : "Run live check"}
            </button>`}
      </div>
      ${e && this._checkStatus ? n`<p class="progress" aria-live="polite">${this._checkStatus}…</p>` : t}
      ${this._error ? n`<div class="banner error" role="alert">${this._error}</div>` : t}
      <div class="stage" ?hidden=${!e} aria-label="Live video being measured"></div>
      ${this._check ? n`<rv-findings class="result" .summary=${this._check.inShort()}></rv-findings>` : t}
      ${this._checkText ? n`<details class="support">
            <summary>Details for support${b("chevronDown")}</summary>
            <p class="muted small">Every measurement, for a bug report or to compare devices.</p>
            <div class="actions">
              <button @click=${() => void this._copy(this._checkText, "current")}>
                ${this._copied === "current" ? "Copied" : "Copy report"}
              </button>
            </div>
            <pre class="report">${this._checkText}</pre>
          </details>` : t}
      ${this._renderReports()}`;
	}
	_renderStatus() {
		let e = this._status;
		if (!e) return t;
		let r = e.go2rtc;
		return n`<p class="small service">
        <span class="muted">Video service (go2rtc):</span>
        ${r.state}${r.version ? `, version ${r.version}` : ""}${r.error ? n` · <span class="error">${r.error}</span>` : t}
        ${r.state === "stopped" ? n`<span class="muted">(it starts with the first live video)</span>` : t}
      </p>
      ${r.log?.length ? n`<details>
            <summary class="small">Its log${b("chevronDown")}</summary>
            <pre class="report">${r.log.join("\n")}</pre>
          </details>` : t}`;
	}
	_renderReports() {
		let e = this._reports;
		return e?.length ? n`<details class="saved">
      <summary>Saved reports (${e.length})${b("chevronDown")}</summary>
      <ul class="reports">
        ${e.map((e) => n`<li>
            <div class="report-row">
              <span class="when"
                >${[
			k(Date.parse(e.updated), this.hass?.config?.time_zone),
			e.setup.slice(i.length),
			d(e.text)
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
            ${this._shown === e.id ? this._renderSaved(e.text) : t}
          </li>`)}
      </ul>
    </details>` : t;
	}
	_renderSaved(e) {
		let t = se(e);
		return t ? n`<rv-findings .summary=${t}></rv-findings>
      <details>
        <summary class="small">Details for support${b("chevronDown")}</summary>
        <pre class="report">${e}</pre>
      </details>` : n`<pre class="report">${e}</pre>`;
	}
	static styles = [E, e`
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
	return I(navigator.userAgent);
}
function _e(e) {
	try {
		window.localStorage.setItem(X, e);
	} catch {}
}
customElements.get("rv-live-check") || customElements.define("rv-live-check", $);
//#endregion
export { $ as RvLiveCheck, Q as capacityByDefault };

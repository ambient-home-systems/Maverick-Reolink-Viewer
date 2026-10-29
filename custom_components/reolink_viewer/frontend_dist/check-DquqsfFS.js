import { Gt as e, J as t, Kt as n, Lt as r, Nt as i, St as a } from "./home-BVFyq3Vg.js";
import { a as o, n as s, o as c, r as l, s as u, t as d } from "./findings-D5gkZ5S1.js";
//#region src/playback/check-util.ts
var f = (e) => /iPhone|iPad|iPod/.test(e);
function p(e) {
	return f(e) ? "iPhone app, Wi-Fi (local)" : "Desktop Chrome, LAN";
}
function m(e, t) {
	return e.startsWith("iPhone") ? !f(t) : e.startsWith("Desktop") ? f(t) : !1;
}
function h(e) {
	let t = /Home ?Assistant\/([\d.]+)/i.exec(e), n = /(?:iPhone|iPad|iPod).*? OS (\d+)[_.](\d+)/.exec(e), r = /;\s*iOS (\d+)\.(\d+)/.exec(e);
	if (n) {
		let i = r ? `${r[1]}.${r[2]}` : `${n[1]}.${n[2]}`;
		return t ? `iOS ${i}, Companion app ${t[1]}` : /CriOS/.test(e) ? `iOS ${i}, Chrome` : /Safari\//.test(e) ? `iOS ${i}, Safari` : `iOS ${i}, web view`;
	}
	let i = /Mac OS X/.test(e) ? "macOS" : /Windows/.test(e) ? "Windows" : /Android/.test(e) ? "Android" : /Linux/.test(e) ? "Linux" : "?", a = /Edg\/(\d+)/.exec(e);
	if (a) return `Edge ${a[1]} (${i})`;
	let o = /(?:Chrome|Chromium)\/(\d+)/.exec(e);
	if (o) return `${/HeadlessChrome/.test(e) ? "Headless Chrome" : "Chrome"} ${o[1]} (${i})`;
	let s = /Firefox\/(\d+)/.exec(e);
	if (s) return `Firefox ${s[1]} (${i})`;
	let c = /Version\/([\d.]+).*Safari/.exec(e);
	return c ? `Safari ${c[1]} (${i})` : t ? `Companion app ${t[1]} (${i})` : `unknown browser (${i})`;
}
var g = (e) => e === void 0 ? "–" : `${Math.round(e)} ms`, _ = (e) => e === void 0 ? "–" : Math.abs(e) >= 1e9 ? `${(e / 1e9).toFixed(2)} GB` : `${(e / 1e6).toFixed(1)} MB`;
function v(e) {
	return e < 6e4 ? `${Math.round(e / 1e3)} s` : `${(e / 6e4).toFixed(1)} min`;
}
function y(e, t, n, r, i) {
	let a = e.end - e.start, o = e.start + a * n, s = e.start + a * r, c = t.filter((e) => e.start >= o && e.start <= s).at(-1);
	return {
		time: c ? c.start : Math.round(e.start + a * i),
		event: c
	};
}
function b(e, t) {
	return e.filter((e) => e.end - e.start >= 12e5 && t - e.end > 6e4).sort((e, t) => t.start - e.start);
}
function x(e) {
	let t = [];
	return e.forEach((n, r) => {
		let i = e.at(r + 1);
		i && i.start - n.end < 2e3 && t.push([n, i]);
	}), t.sort((e, t) => e[0].end - e[0].start - (t[0].end - t[0].start));
}
function S(e) {
	return e.decoded && e.mediaS > 0 ? e.decoded / e.mediaS : void 0;
}
function C(e) {
	let t = [`${(e.wallMs > 0 ? e.mediaS * 1e3 / e.wallMs : 0).toFixed(2)}× effective`];
	e.applied !== e.rate && t.push(`browser set ${e.applied}×`);
	let n = S(e);
	if (e.painted !== void 0) {
		let r = `${(e.painted * 1e3 / e.wallMs).toFixed(0)} fps painted`;
		t.push(n ? `${r} of ${(n * e.rate).toFixed(0)}` : r);
	}
	if (e.maxGapMs !== void 0 && t.push(`longest frame gap ${Math.round(e.maxGapMs)} ms`), e.decoded !== void 0 && e.dropped !== void 0) {
		let n = e.decoded ? (e.dropped * 100 / e.decoded).toFixed(1) : "0.0";
		t.push(`dropped ${e.dropped} of ${e.decoded} frames (${n} %)`);
	}
	return t.push(`${e.stalls} stalls${e.stalls ? ` (${Math.round(e.stalledMs)} ms)` : ""}`), e.ended && t.push("the file ended"), T(e) || t.push("the dropped-frame counter disagrees with the frames painted: judged by those"), e.focused || t.push("PAGE NOT IN FRONT"), `${String(e.rate).padStart(3)}×: ${t.join(", ")}`;
}
var w = "on pace (±10 %), stalls under 100 ms, no frame gap over 2.5 frames (250 ms at least); below 50 fps to show, ≤ 2 % (or 1 frame) dropped, or 90 % painted where the dropped-frame counter disagrees with the frames painted";
function T(e) {
	if (e.painted === void 0 || e.decoded === void 0 || e.dropped === void 0) return !0;
	let t = e.decoded - e.dropped;
	return Math.abs(t - e.painted) <= Math.max(3, e.decoded * .1);
}
function E(e) {
	let t = e.wallMs > 0 ? e.mediaS * 1e3 / e.wallMs : 0;
	if (Math.abs(t - e.rate) > e.rate * .1 || e.stalledMs >= 100) return !1;
	let n = S(e), r = n === void 0 ? void 0 : n * e.rate;
	if (r !== void 0 && e.maxGapMs !== void 0) {
		let t = Math.max(250, 2500 / Math.min(r, 60));
		if (e.maxGapMs > t) return !1;
	}
	return r === void 0 || r > 50 ? !0 : !T(e) && e.painted !== void 0 ? e.painted * 1e3 / e.wallMs >= r * .9 : !e.decoded || (e.dropped ?? 0) <= Math.max(1, e.decoded * .02);
}
function ee(e) {
	if (e.length < 2) return;
	let t = e.length, n = e.reduce((e, [t]) => e + t, 0) / t, r = e.reduce((e, [, t]) => e + t, 0) / t, i = 0, a = 0;
	for (let [t, o] of e) i += (t - n) * (o - r), a += (t - n) ** 2;
	return a ? i / a : void 0;
}
function te(e) {
	let t = 0;
	for (let n = 0; n < e.length; n += 1) t += e.end(n) - e.start(n);
	return t;
}
var D = (e, t) => e === void 0 ? "not measured" : `${g(e)} ${e < t ? "✓" : "✗"}`, O = {
	h264: {
		codec: "avc1.42C00A",
		init: "AAAAHGZ0eXBpc281AAACAGlzbzVpc282bXA0MQAAAuhtb292AAAAbG12aGQAAAAAAAAAAAAAAAAAAAPoAAAAAAABAAABAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAB6nRyYWsAAABcdGtoZAAAAAMAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAQAAAAEAAAAAAAYZtZGlhAAAAIG1kaGQAAAAAAAAAAAAAAAAAACgAAAAAAFXEAAAAAAAtaGRscgAAAAAAAAAAdmlkZQAAAAAAAAAAAAAAAFZpZGVvSGFuZGxlcgAAAAExbWluZgAAABR2bWhkAAAAAQAAAAAAAAAAAAAAJGRpbmYAAAAcZHJlZgAAAAAAAAABAAAADHVybCAAAAABAAAA8XN0YmwAAAClc3RzZAAAAAAAAAABAAAAlWF2YzEAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAQABAAEgAAABIAAAAAAAAAAEVTGF2YzYwLjMxLjEwMiBsaWJ4MjY0AAAAAAAAAAAAAAAY//8AAAAvYXZjQwFCwAr/4QAXZ0LACtkEJsBEAAADAAQAAAMAUDxImSABAAVoy4PLIAAAABBwYXNwAAAAAQAAAAEAAAAQc3R0cwAAAAAAAAAAAAAAEHN0c2MAAAAAAAAAAAAAABRzdHN6AAAAAAAAAAAAAAAAAAAAEHN0Y28AAAAAAAAAAAAAAChtdmV4AAAAIHRyZXgAAAAAAAAAAQAAAAEAAAAAAAAAAAAAAAAAAABidWR0YQAAAFptZXRhAAAAAAAAACFoZGxyAAAAAAAAAABtZGlyYXBwbAAAAAAAAAAAAAAAAC1pbHN0AAAAJal0b28AAAAdZGF0YQAAAAEAAAAATGF2ZjYwLjE2LjEwMA==",
		mdat: "AAAC+G1kYXQAAAJvBgX//2vcRem95tlIt5Ys2CDZI+7veDI2NCAtIGNvcmUgMTY0IHIzMTA4IDMxZTE5ZjkgLSBILjI2NC9NUEVHLTQgQVZDIGNvZGVjIC0gQ29weWxlZnQgMjAwMy0yMDIzIC0gaHR0cDovL3d3dy52aWRlb2xhbi5vcmcveDI2NC5odG1sIC0gb3B0aW9uczogY2FiYWM9MCByZWY9MyBkZWJsb2NrPTE6MDowIGFuYWx5c2U9MHgxOjB4MTExIG1lPWhleCBzdWJtZT03IHBzeT0xIHBzeV9yZD0xLjAwOjAuMDAgbWl4ZWRfcmVmPTEgbWVfcmFuZ2U9MTYgY2hyb21hX21lPTEgdHJlbGxpcz0xIDh4OGRjdD0wIGNxbT0wIGRlYWR6b25lPTIxLDExIGZhc3RfcHNraXA9MSBjaHJvbWFfcXBfb2Zmc2V0PS0yIHRocmVhZHM9MiBsb29rYWhlYWRfdGhyZWFkcz0xIHNsaWNlZF90aHJlYWRzPTAgbnI9MCBkZWNpbWF0ZT0xIGludGVybGFjZWQ9MCBibHVyYXlfY29tcGF0PTAgY29uc3RyYWluZWRfaW50cmE9MCBiZnJhbWVzPTAgd2VpZ2h0cD0wIGtleWludD0xMCBrZXlpbnRfbWluPTEgc2NlbmVjdXQ9NDAgaW50cmFfcmVmcmVzaD0wIHJjX2xvb2thaGVhZD0xMCByYz1jcmYgbWJ0cmVlPTEgY3JmPTIzLjAgcWNvbXA9MC42MCBxcG1pbj0wIHFwbWF4PTY5IHFwc3RlcD00IGlwX3JhdGlvPTEuNDAgYXE9MToxLjAwAIAAAAAfZYiED/EYoAAlRxwABGYjgACJPJycnXXXXXXXXXXXXgAAAAZBmjgf4RgAAAAGQZpUB/hGAAAABkGaYD/CMAAAAAZBmoA/wjAAAAAGQZqgP8IwAAAABkGawD/CMAAAAAZBmuA/wjAAAAAGQZsAO8IwAAAABkGbIDfCMA==",
		normalized: "AAAAkG1vb2YAAAAQbWZoZAAAAAAAAAABAAAAeHRyYWYAAAAcdGZoZAACADgAAAABAAAEAAAAApYBAQAAAAAAFHRmZHQBAAAAAAAAAAAAAAAAAABAdHJ1bgAAAgUAAAAKAAAAmAIAAAAAAAKWAAAACgAAAAoAAAAKAAAACgAAAAoAAAAKAAAACgAAAAoAAAAK",
		absolute: "AAAAmG1vb2YAAAAQbWZoZAAAAAAAAAABAAAAgHRyYWYAAAAkdGZoZAAAADkAAAABAAAAAAAAAwQAAAQAAAAClgEBAAAAAAAUdGZkdAEAAAAAAAAAAAAAAAAAAEB0cnVuAAACBQAAAAoAAACgAgAAAAAAApYAAAAKAAAACgAAAAoAAAAKAAAACgAAAAoAAAAKAAAACgAAAAo=",
		noTfdt: "AAAAfG1vb2YAAAAQbWZoZAAAAAAAAAABAAAAZHRyYWYAAAAcdGZoZAACADgAAAABAAAEAAAAApYBAQAAAAAAQHRydW4AAAIFAAAACgAAAIQCAAAAAAAClgAAAAoAAAAKAAAACgAAAAoAAAAKAAAACgAAAAoAAAAKAAAACg==",
		nvr: "AAAAhG1vb2YAAAAQbWZoZAAAAAAAAAABAAAAbHRyYWYAAAAkdGZoZAAAADkAAAABAAAAAAAAAwQAAAQAAAAClgEBAAAAAABAdHJ1bgAAAgUAAAAKAAAAjAIAAAAAAAKWAAAACgAAAAoAAAAKAAAACgAAAAoAAAAKAAAACgAAAAoAAAAK"
	},
	vp9: {
		codec: "vp09.00.10.08",
		init: "AAAAHGZ0eXBpc281AAACAGlzbzVpc282bXA0MQAAAuttb292AAAAbG12aGQAAAAAAAAAAAAAAAAAAAPoAAAAAAABAAABAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAB7XRyYWsAAABcdGtoZAAAAAMAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAQAAAAEAAAAAAAYltZGlhAAAAIG1kaGQAAAAAAAAAAAAAAAAAACgAAAAAAFXEAAAAAAAtaGRscgAAAAAAAAAAdmlkZQAAAAAAAAAAAAAAAFZpZGVvSGFuZGxlcgAAAAE0bWluZgAAABR2bWhkAAAAAQAAAAAAAAAAAAAAJGRpbmYAAAAcZHJlZgAAAAAAAAABAAAADHVybCAAAAABAAAA9HN0YmwAAACoc3RzZAAAAAAAAAABAAAAmHZwMDkAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAQABAAEgAAABIAAAAAAAAAAEYTGF2YzYwLjMxLjEwMiBsaWJ2cHgtdnA5AAAAAAAAAAAY//8AAAAUdnBjQwEAAAAACoICAgIAAAAAAApmaWVsAQAAAAAQcGFzcAAAAAEAAAABAAAAFGJ0cnQAAAAAAABOIAAATiAAAAAQc3R0cwAAAAAAAAAAAAAAEHN0c2MAAAAAAAAAAAAAABRzdHN6AAAAAAAAAAAAAAAAAAAAEHN0Y28AAAAAAAAAAAAAAChtdmV4AAAAIHRyZXgAAAAAAAAAAQAAAAEAAAAAAAAAAAAAAAAAAABidWR0YQAAAFptZXRhAAAAAAAAACFoZGxyAAAAAAAAAABtZGlyYXBwbAAAAAAAAAAAAAAAAC1pbHN0AAAAJal0b28AAAAdZGF0YQAAAAEAAAAATGF2ZjYwLjE2LjEwMA==",
		mdat: "AAAAuG1kYXSCSYNCAAPwA/YAOCQcGEIAADBgAAB4uf/+btv////RJ////Lkc/S6IAIYAQJKcAElAAAMgAABUcIYAQJKcAErAAAMgAABUcIYAQJKcAEnAAAMgAABUcIYAQJKcAEigAAMgAABUcIYAQJKcAEeAAAMgAABUcIYAQJKcAEbgAAMgAABUcIYAQJKcAEZAAAMgAABUcIYAQJKcAEXAAAMgAABUcIYAQJKcAEVAAAMgAABUcA==",
		normalized: "AAAAkG1vb2YAAAAQbWZoZAAAAAAAAAABAAAAeHRyYWYAAAAcdGZoZAACADgAAAABAAAEAAAAACkBAQAAAAAAFHRmZHQBAAAAAAAAAAAAAAAAAABAdHJ1bgAAAgUAAAAKAAAAmAIAAAAAAAApAAAADwAAAA8AAAAPAAAADwAAAA8AAAAPAAAADwAAAA8AAAAP",
		absolute: "AAAAmG1vb2YAAAAQbWZoZAAAAAAAAAABAAAAgHRyYWYAAAAkdGZoZAAAADkAAAABAAAAAAAAAwcAAAQAAAAAKQEBAAAAAAAUdGZkdAEAAAAAAAAAAAAAAAAAAEB0cnVuAAACBQAAAAoAAACgAgAAAAAAACkAAAAPAAAADwAAAA8AAAAPAAAADwAAAA8AAAAPAAAADwAAAA8=",
		noTfdt: "AAAAfG1vb2YAAAAQbWZoZAAAAAAAAAABAAAAZHRyYWYAAAAcdGZoZAACADgAAAABAAAEAAAAACkBAQAAAAAAQHRydW4AAAIFAAAACgAAAIQCAAAAAAAAKQAAAA8AAAAPAAAADwAAAA8AAAAPAAAADwAAAA8AAAAPAAAADw==",
		nvr: "AAAAhG1vb2YAAAAQbWZoZAAAAAAAAAABAAAAbHRyYWYAAAAkdGZoZAAAADkAAAABAAAAAAAAAwcAAAQAAAAAKQEBAAAAAABAdHJ1bgAAAgUAAAAKAAAAjAIAAAAAAAApAAAADwAAAA8AAAAPAAAADwAAAA8AAAAPAAAADwAAAA8AAAAP"
	}
}, ne = [
	{
		shape: "normalized",
		label: "MSE-ready fragment"
	},
	{
		shape: "absolute",
		label: "absolute offsets"
	},
	{
		shape: "noTfdt",
		label: "no tfdt"
	},
	{
		shape: "nvr",
		label: "NVR shape (both)"
	}
];
function k(e) {
	let t = window[e];
	return typeof t == "function" ? t : void 0;
}
function A(e, t) {
	let n = k(e);
	if (n) try {
		return n.isTypeSupported(`video/mp4; codecs="${t}"`);
	} catch {
		return !1;
	}
}
function re(e) {
	for (let [t, n] of Object.entries(O)) if (A(e, n.codec)) return {
		name: t,
		sample: n
	};
}
var j = (e) => Uint8Array.from(atob(e), (e) => e.charCodeAt(0));
function ie(e, t) {
	let n = new Uint8Array(e.length + t.length);
	return n.set(e), n.set(t, e.length), n;
}
function M(e, t) {
	return new Promise((n, r) => {
		let i = () => {
			e.removeEventListener("updateend", i), e.removeEventListener("error", a), n();
		}, a = () => {
			e.removeEventListener("updateend", i), e.removeEventListener("error", a), r(/* @__PURE__ */ Error("append error"));
		};
		e.addEventListener("updateend", i), e.addEventListener("error", a), e.appendBuffer(t);
	});
}
async function ae(e, t, n, r = 5e3) {
	let i = k(e);
	if (!i) return "not available";
	let a = performance.now(), o = document.createElement("video");
	o.muted = !0, o.playsInline = !0, o.disableRemotePlayback = !0, o.style.cssText = "position:fixed;left:-10px;top:-10px;width:2px;height:2px;opacity:0", document.body.append(o);
	let s = new i(), c = URL.createObjectURL(s), l;
	try {
		let e = new Promise((e) => {
			l = setTimeout(() => {
				e(s.readyState === "open" ? "timed out" : "timed out (source never opened)");
			}, r), s.addEventListener("sourceopen", () => {
				(async () => {
					let i;
					try {
						i = s.addSourceBuffer(`video/mp4; codecs="${t.codec}"`);
					} catch (t) {
						e(`addSourceBuffer failed (${String(t)})`);
						return;
					}
					try {
						await M(i, j(t.init)), await M(i, ie(j(t[n]), j(t.mdat)));
					} catch {
						e("append error");
						return;
					}
					if (!i.buffered.length) e("appended, nothing buffered");
					else {
						try {
							s.endOfStream();
						} catch {}
						e(await oe(o, r) ? `plays (${Math.round(performance.now() - a)} ms)` : "buffered, does not play");
					}
				})();
			}, { once: !0 });
		});
		return o.src = c, await e;
	} finally {
		clearTimeout(l), o.removeAttribute("src"), o.load(), o.remove(), URL.revokeObjectURL(c);
	}
}
function oe(e, t) {
	return new Promise((n) => {
		let r = setTimeout(() => {
			n(e.currentTime > 0);
		}, t), i = () => {
			e.currentTime > .05 && (clearTimeout(r), e.removeEventListener("timeupdate", i), n(!0));
		};
		e.addEventListener("timeupdate", i), e.play().catch(() => void 0);
	});
}
//#endregion
//#region src/playback/check.ts
var se = "0.3.2", ce = [
	"Desktop Chrome, LAN",
	"Desktop Chrome, Tailscale",
	"Desktop Chrome, Nabu Casa",
	"iPhone app, Wi-Fi (local)",
	"iPhone app, Tailscale",
	"iPhone app, Nabu Casa",
	"Other"
];
function le(e) {
	return !/Tailscale|Nabu Casa/.test(e);
}
var ue = [
	.5,
	1,
	2,
	4,
	8
], N = 6e3, de = 1e3, fe = 6e4, pe = 3e3, me = 1e4, he = [
	-10,
	-5,
	3,
	8,
	15
], P = 6e5, F = 3e5, I = 15, L = 7, R = "reolink-viewer-check-running", z = class extends Error {}, B = (e) => new Promise((t) => setTimeout(t, e)), V = (e) => e.time;
function ge(e, t, n) {
	return new Promise((r) => {
		let i = setTimeout(() => {
			e.removeEventListener(t, a), r(!1);
		}, n), a = () => {
			clearTimeout(i), r(!0);
		};
		e.addEventListener(t, a, { once: !0 });
	});
}
var H = (e) => new Date(e).toLocaleTimeString(), _e = class {
	_t;
	options;
	_onChange;
	id;
	lines = [];
	running = !1;
	_stopped = !1;
	_lastSave = 0;
	_saving = Promise.resolve();
	_long;
	_hdPlayed = !1;
	_summary = [];
	_plain = [];
	constructor(e, t, n = () => void 0) {
		this._t = e, this.options = t, this._onChange = n, this.id = `${(/* @__PURE__ */ new Date()).toISOString().slice(0, 19)}-${Math.random().toString(36).slice(2, 6)}`;
	}
	get text() {
		return this.lines.join("\n");
	}
	stop() {
		this._stopped = !0;
	}
	async run() {
		this.running = !0, $(this.id, this.options.setup);
		try {
			await this._header(), await this._timelines(), await this._events(), await this._deep(), await this._advance(), await this._rates(), await this._scrub(), await this._switchHd(), await this._link(), await this._capabilities(), this.options.soakMinutes > 0 && await this._soak();
			for (let e of s(this.inShort(!0))) this._log(e);
			this._log(""), this._log("Summary:");
			for (let e of this._summary) this._log(`- ${e}`);
		} catch (t) {
			this._log(t instanceof z ? "Stopped." : `Check failed: ${e(t).message}`);
		} finally {
			this._t.player?.pause(), this.running = !1, this._log(`Done at ${(/* @__PURE__ */ new Date()).toLocaleTimeString()}.`), await this._save(!0), Se(this.id);
		}
		return this.text;
	}
	inShort(e = !this.running) {
		let t = [...this._plain], n = t.filter((e) => e.grade === "problem").length, r = t.filter((e) => e.grade === "slow").length, i = this._t.cameraName;
		return {
			headline: t.length ? `${e ? "" : "So far: "}${n ? `${d(n, "problem")} found with ${i}'s recordings on this device.` : r ? `${i}'s recordings play on this device, but ${d(r, "thing")} ${r === 1 ? "is" : "are"} slow.` : `${i}'s recordings play well on this device.`}` : e ? "Nothing was measured." : "Measuring…",
			findings: t
		};
	}
	_log(e) {
		this.lines.push(e), this._onChange(), performance.now() - this._lastSave > me && this._save(!1);
	}
	_save(e) {
		return this._lastSave = performance.now(), this._saving = this._saving.then(() => this._t.hass.callWS({
			type: "reolink_viewer/playback/check_report",
			report_id: this.id,
			setup: this.options.setup,
			text: this.text,
			done: e
		})).then(() => void 0).catch(() => void 0), this._saving;
	}
	_checkStopped() {
		if (this._stopped) throw new z();
	}
	async _wait(e, t) {
		let n = performance.now() + t;
		for (; performance.now() < n;) {
			if (this._checkStopped(), e()) return !0;
			await B(100);
		}
		return e();
	}
	async _pause(e) {
		let t = performance.now() + e;
		for (; performance.now() < t;) this._checkStopped(), await B(Math.min(250, t - performance.now()));
	}
	async _header() {
		let e = this._t, n = navigator.connection;
		this._log(`Reolink Viewer playback check v${se} · ${this.options.setup} · ${e.cameraName} · ${(/* @__PURE__ */ new Date()).toLocaleString()}`), this._log(`Browser: ${h(navigator.userAgent)} · page ${t(location.hostname)} over ${location.protocol.replace(":", "")} · screen ${screen.width}×${screen.height} @${window.devicePixelRatio}x` + (n?.effectiveType ? ` · network ${n.effectiveType}, ${n.downlink ?? "?"} Mbit/s (browser estimate)` : ""));
		let r = performance.getEntriesByType("navigation")[0];
		this._log(`User agent: ${navigator.userAgent}`), this._log(`Connection: page loaded over ${r?.nextHopProtocol || "? (from the app's cache)"}; each video request line gives its own (h2/h3 share one connection; http/1.1 allows 6 at once)`), this._log(`Player: ${e.mode} · file player delivery: ${e.progressive ? "progressive" : "whole file first (WebKit)"}`), this._summary.push(`Player: ${e.mode}`), await this._wait(() => !!e.day && !e.loading, 3e4);
	}
	async _loadDay(e) {
		let t = this._t, n = t.metrics.timelineMs;
		return t.selectDate(e), await this._wait(() => !t.loading && t.day?.date === e && t.metrics.timelineMs !== n, 6e4), t.metrics;
	}
	async _timelines() {
		let e = this._t, t = e.today;
		e.date !== t && await this._loadDay(t);
		let n = e.metrics;
		this._log(`A1 Time to timeline, today (as the tab opened): ${g(n.timelineMs)} (server: ${Z(n.timelineServer)})`);
		let r = Number(t.slice(8, 10)), i = [...e.monthDays].filter((e) => e < r).sort((e, t) => t - e), a = i.at(Math.min(2, i.length - 1));
		if (a === void 0) {
			this._log("A2/A3 skipped: no earlier recording day this month"), this._summary.push(`Timeline: today ${D(n.timelineMs, 1e3)}`), this._plain.push(n.timelineMs === void 0 ? {
				grade: "problem",
				text: "Today's recordings did not load."
			} : {
				grade: c(n.timelineMs, 1e3, 3e3),
				text: `Today's recordings appear on the timeline in ${o(n.timelineMs)}.`
			});
			return;
		}
		let s = `${t.slice(0, 8)}${String(a).padStart(2, "0")}`, l = await this._loadDay(s);
		this._log(`A2 Time to timeline, ${s}: ${g(l.timelineMs)} (server: ${Z(l.timelineServer)})`), await this._loadDay(t);
		let d = await this._loadDay(s);
		this._log(`A3 Time to timeline, ${s} again: ${g(d.timelineMs)} (server: ${Z(d.timelineServer)})`);
		let f = await this._loadDay(t);
		this._log(`A4 Time to timeline, today again: ${g(f.timelineMs)} (server: ${Z(f.timelineServer)})`);
		let p = l.timelineServer?.cache === "fresh", m = [
			c(n.timelineMs, 1e3, 3e3),
			c(l.timelineMs, p ? 3e3 : 1e3, p ? 6e3 : 3e3),
			c(d.timelineMs, 1e3, 3e3)
		];
		this._plain.push(n.timelineMs === void 0 || l.timelineMs === void 0 || d.timelineMs === void 0 ? {
			grade: "problem",
			text: "The timeline of recordings did not always load."
		} : {
			grade: u(m),
			text: `Recordings appear on the timeline in ${o(n.timelineMs)} for today; an earlier day takes ${o(l.timelineMs)} the first time and ${o(d.timelineMs)} after that.`
		}), this._summary.push(`Timeline: today ${D(n.timelineMs, 1e3)}, past day first ${D(l.timelineMs, p ? 3e3 : 1e3)} (${p ? "cold, < 3 s" : "cached, < 1 s"}), again ${D(d.timelineMs, 1e3)}`);
	}
	async _play(e) {
		let t = this._t;
		performance.clearResourceTimings(), performance.setResourceTimingBufferSize(1e3);
		let n = performance.now(), r = Y(t.player, n), i = t.playing;
		await t.playAt(e, n);
		let a = t.playing === i ? void 0 : t.playing?.cache, o = await this._wait(() => t.metrics.firstFrameMs !== void 0 || !!t.playFailure, 12e4);
		r.stop();
		let s = t.metrics, c = t.player?.time, l = c === void 0 ? void 0 : c - e, u = l === void 0 || Math.abs(l) <= 2e3 ? "" : ` · STARTED AT ${H(c ?? 0)}, ${v(Math.abs(l))} ${l < 0 ? "before" : "after"} the time asked`, d = t.playing?.file ? ` · ${t.playing.file} file` : "", f = `first frame ${o && !t.playFailure ? g(s.firstFrameMs) : "none"} [URL ${g(s.urlMs)} · metadata ${g(r.seen.loadedmetadata)} · seeked ${g(r.seen.seeked)} · playing ${g(r.seen.playing)}] ${s.delivery ?? "?"}${d} · ${s.stream ?? "?"} ${s.codec ?? ""}${u}${t.playFailure ? ` FAILED: ${t.playFailure}` : ""}`;
		return {
			ok: o && !t.playFailure && !u,
			line: f,
			began: n,
			source: t.playing?.base ?? t.playing?.url,
			held: a
		};
	}
	async _events() {
		let e = this._t, t = e.day, n = (t?.events ?? []).slice(-3).reverse();
		if (!t || !n.length) {
			this._log("B  skipped: no events today"), this._plain.push({
				grade: "note",
				text: "There were no events today to try opening."
			});
			return;
		}
		let r = [], i = [];
		for (let a of n) {
			let n = t.segments.find((e) => a.start >= e.start && a.start < e.end), o = n ? `${v(a.start - n.start)} into a ${v(n.end - n.start)} recording` : "no recording", s = await this._play(a.start);
			s.ok && e.metrics.firstFrameMs !== void 0 && (r.push(`${D(e.metrics.firstFrameMs, 2e3)}${s.held?.complete === !1 ? " (not cached)" : ""}`), i.push(e.metrics.firstFrameMs)), this._log(`B  ${a.types.join("+")} at ${H(a.start)} (${o}): ${s.line}`), await B(300), this._log(`     ${X(s.began, s.source)}`), n && this._log(`     ${await this._fillReport()}`), await this._pause(1500);
		}
		this._summary.push(`Events → first frame (sub): ${r.join(", ") || "none played"}`);
		let a = l(i);
		this._plain.push(a === void 0 ? {
			grade: "problem",
			text: "Events would not play.",
			advice: "Run the check again; if it happens again, include the details below in a report."
		} : {
			grade: c(a, 2e3, 4e3),
			text: `Opening an event starts its video in ${i.length > 1 ? "about " : ""}${o(a)}${i.length < n.length ? `; ${String(n.length - i.length)} of ${d(n.length, "event")} did not play` : ""}.`
		});
	}
	async _peek(e, t) {
		let n = this._t;
		try {
			return await n.hass.callWS({
				type: "reolink_viewer/playback/peek",
				device_id: n.deviceId,
				date: e,
				segment_id: t,
				stream: "sub"
			});
		} catch {
			return;
		}
	}
	async _fillReport() {
		let e = this._t.playing, t = n(e?.base ?? e?.url ?? "");
		if (!t) return "server: nothing played";
		let r = e?.file === "plain", i = null;
		for (let e = 0; e < 90; e += 1) {
			try {
				i = (await a(this._t.hass, t)).cache;
			} catch {
				i = null;
			}
			if (!i || i.error || i.complete && (!r || i.flat !== void 0)) break;
			await this._pause(1e3);
		}
		if (!i) return "server: not cached (or its URL expired)";
		let o = [i.cache === "disk" ? "from disk" : `fill (${G(i.priority)})`];
		for (let [e, t] of [
			["wait_ms", "queue"],
			["headers_ms", "NVR headers"],
			["ttfb_ms", "NVR first byte"],
			["fill_ms", "download"]
		]) typeof i[e] == "number" && o.push(`${t} ${g(i[e])}`);
		return typeof i.mbit_s == "number" && o.push(`${i.mbit_s} Mbit/s`), o.push(_(i.bytes)), i.indexed !== void 0 && o.push(`index ${G(i.indexed)}`), (r || i.flat !== void 0) && o.push(`plain MP4 ${i.flat === void 0 ? "not yet" : G(i.flat)}`), typeof i.flat_ms == "number" && o.push(`rewrite ${g(i.flat_ms)}`), typeof i.flat_moov_bytes == "number" && o.push(`moov ${_(i.flat_moov_bytes)}`), i.error && o.push(`error ${i.error}`), `server: ${o.join(", ")}`;
	}
	async _findLong() {
		let e = this._t, t = e.today, n = Number(t.slice(8, 10)), i = [t, ...[...e.monthDays].filter((e) => e < n).sort((e, t) => t - e).slice(0, L).map((e) => `${t.slice(0, 8)}${String(e).padStart(2, "0")}`)], a = 0, o;
		for (let t of i) {
			let n;
			try {
				n = t === e.date && e.day ? e.day : await r(e.hass, e.deviceId, t);
			} catch {
				continue;
			}
			for (let e of b(n.segments, n.now)) {
				if (a >= I) return o;
				a += 1;
				let r = await this._peek(t, e.id);
				if (r && !r.cache) return {
					date: t,
					day: n,
					segment: e,
					cached: !1
				};
				r?.cache?.complete && !o && (o = {
					date: t,
					day: n,
					segment: e,
					cached: !0
				});
			}
		}
		return o;
	}
	async _deep() {
		let e = this._t, t = await this._findLong();
		if (this._long = t, !t) {
			this._log("D  skipped: no recording of 20 min or more in the last 7 days (events-only camera?)");
			return;
		}
		e.date !== t.date && await this._loadDay(t.date);
		let n = t.segment, r = v(n.end - n.start), i = (e) => `${v(e.time - n.start)} into a ${r} recording of ${t.date}` + (e.event ? ` (event ${e.event.types.join("+")} at ${H(e.event.start)})` : " (no event there: a point)"), a;
		if (t.cached) this._log("D1 skipped: every long recording looked at is cached already (try again after other recordings were viewed)");
		else {
			let r = y(n, t.day.events, .5, .95, .75), o = await this._play(r.time), s = o.held;
			o.ok && s?.complete === !1 && (a = e.metrics.firstFrameMs);
			let c = s?.complete ? "Not cached when chosen, but on disk when played (not counted)" : s?.bytes ? `Not cached (${_(s.bytes)} already fetched when played)` : "Not cached";
			this._log(`D1 ${c}, ${i(r)}: ${o.line}`), await B(300), this._log(`     ${X(o.began, o.source)}`), this._log(`     ${await this._fillReport()}`);
		}
		await this._pause(1500);
		let s = y(n, t.day.events, .1, .45, .4), l = await this._play(s.time), u = l.held?.complete === !1, d = l.ok && !u ? e.metrics.firstFrameMs : void 0;
		this._log(`D2 ${u ? "Cached when chosen, but not on disk when played (not counted)" : "Cached"}, ${i(s)}: ${l.line}`), await B(300), this._log(`     ${X(l.began, l.source)}`), this._summary.push(`Deep start (sub, ${r} recording): not cached ${a === void 0 ? "not measured" : g(a)}, cached ${D(d, 2e3)}`), this._plain.push(d === void 0 ? {
			grade: "problem",
			text: "Jumping into the middle of a long recording did not play."
		} : {
			grade: c(d, 2e3, 4e3),
			text: `Jumping into the middle of a long recording starts in ${o(d)}` + (a === void 0 ? "." : `; the first time, ${o(a)}, while the recorder sends it over.`)
		});
	}
	async _advance() {
		let e = this._t, t = x(e.day?.segments ?? []);
		!t.length && e.date !== e.today && (await this._loadDay(e.today), t = x(e.day?.segments ?? []));
		let n = this._long, r = (n && n.date === e.day?.date ? t.find(([e]) => e.id === n.segment.id) : void 0) ?? t.at(0);
		if (!r) {
			this._log(`C  skipped: no two touching recordings on ${e.date}`);
			return;
		}
		let [i, a] = r, s = [], c = e.player, l = () => s.push("advanced"), u = () => s.push("ended");
		c?.addEventListener("rv-advanced", l), c?.addEventListener("rv-ended", u);
		try {
			await e.playAt(Math.max(i.start, i.end - 8e3), performance.now()), await this._wait(() => e.metrics.firstFrameMs !== void 0 || !!e.playFailure, 12e4);
			let t = await this._wait(() => e.player?.current?.segmentId === a.id && s.length > 0, 45e3);
			t && !s.includes("advanced") && await this._wait(() => e.metrics.firstFrameMs !== void 0 || !!e.playFailure, 6e4);
			let n = e.player, r;
			r = t ? s.includes("advanced") ? `yes (preloaded) · gap ${g(e.metrics.gapMs)}` : `yes, by reloading (the next file was not preloaded) · first frame ${g(e.metrics.firstFrameMs)}` : `no: on ${n?.current?.segmentId === i.id ? "the first" : n?.current ? "another" : "no"} recording at ${n?.time === void 0 ? "?" : H(n.time)}, ${n?.paused ? "paused" : "playing"}, next ${n?.preloaded ? "preloaded" : "not preloaded"}, events [${s.join(", ")}]`, this._log(`C  Moved on by itself at ${H(i.end)} (from a ${v(i.end - i.start)} recording): ${r}` + (e.playFailure ? ` FAILED: ${e.playFailure}` : "")), this._summary.push(`Auto-advance: ${t && s.includes("advanced") ? `gap ${g(e.metrics.gapMs)}` : r}`);
			let c = e.metrics.gapMs ?? 0;
			this._plain.push(t ? s.includes("advanced") ? {
				grade: c < 500 ? "good" : c < 2e3 ? "fine" : "slow",
				text: `It plays straight on from one recording to the next${c < 100 ? ", without a noticeable pause" : `, with a pause of ${o(c)}`}.`
			} : {
				grade: "fine",
				text: `It moves on to the next recording by itself, after ${o(e.metrics.firstFrameMs ?? 0)} to load it.`
			} : {
				grade: "problem",
				text: "It did not move on to the next recording by itself.",
				advice: "Press Next, or tap the timeline, to carry on."
			});
		} finally {
			c?.removeEventListener("rv-advanced", l), c?.removeEventListener("rv-ended", u);
		}
	}
	async _rates() {
		let e = this._t, t = e.day?.segments ?? [], n = this._long, r = n && n.date === e.day?.date ? n.segment : [...t].sort((e, t) => t.end - t.start - (e.end - e.start)).at(0);
		if (!r) {
			this._log("R  skipped: no recording on this day");
			return;
		}
		let i = await this._play(r.start + (r.end - r.start) * .05);
		if (!i.ok) {
			this._log(`R  skipped: the recording did not play (${i.line})`);
			return;
		}
		this._log(`R  Playback rates, ${v(r.end - r.start)} recording, ${N / 1e3} s each (sub stream):`);
		let a = [];
		try {
			for (let t of ue) {
				let n = J(e.player);
				if (!n) break;
				let r = await this._measureRate(n, t);
				if (a.push(r), this._log(`     ${C(r)}`), r.ended) break;
			}
		} finally {
			let t = J(e.player);
			t && (t.playbackRate = 1);
		}
		this._summary.push(`Rates: ${a.map((e) => `${e.rate}× ${E(e) ? "✓" : "✗"}`).join(" ") || "not measured"} (smooth = ${w})`);
		let o = a.filter((e) => !E(e));
		a.length && this._plain.push(o.length ? {
			grade: "slow",
			text: `Playback stutters at ${o.map((e) => `${String(e.rate)}×`).join(", ")} speed.`
		} : {
			grade: "good",
			text: `Slow motion and fast forward (${String(a[0]?.rate)}× to ${String(a.at(-1)?.rate)}×) play smoothly.`
		});
	}
	async _scrub() {
		let e = this._t.player, t = e?.current, n = J(e);
		if (!e || !t || !n || e.time === void 0) {
			this._log("S  skipped: nothing playing");
			return;
		}
		await this._pause(3e3);
		let r = V(e) ?? t.start, i = [], a = [], s = 0;
		for (let o of he) {
			let c = r + o * 1e3;
			if (c < t.start || c > t.end) continue;
			let l = performance.now(), u = ge(n, "seeked", 3e3);
			e.preview(c) ? await u && (i.push(performance.now() - l), s = Math.max(s, Math.abs((V(e) ?? c) - c))) : a.push(o);
		}
		let l = r + P, u = l < t.end ? ` · ${v(P)} ahead: ${e.preview(l) ? "buffered, shown" : "not buffered (the thumbnail shows instead)"}` : "", d = i.length + a.length, f = i.length ? [...i].sort((e, t) => e - t)[Math.floor(i.length / 2)] : void 0;
		this._log(`S  Scrub preview (frames from the buffer while dragging): ${i.length} of ${d} points shown` + (f === void 0 ? "" : `, median ${g(f)}, each within ${(s / 1e3).toFixed(2)} s of its point`) + (a.length ? ` · not buffered: ${a.map((e) => `${e > 0 ? "+" : ""}${e} s`).join(", ")}` : "") + u), this._summary.push(`Scrub: ${i.length} of ${d} points in the buffer shown${f === void 0 ? "" : ` (median ${g(f)})`}`), d && this._plain.push(i.length === d ? {
			grade: c(f, 500, 1500),
			text: `Dragging along the timeline shows the video at once (in about ${o(f ?? 0)}).`
		} : {
			grade: "fine",
			text: `Dragging along the timeline shows the video at ${String(i.length)} of ${String(d)} points; elsewhere a thumbnail shows instead.`
		}), e.resume();
	}
	async _switchHd() {
		let e = this._t;
		if (!this.options.hd) {
			this._log("H  skipped: not asked for (tick \"with HD\")");
			return;
		}
		if (!e.hd.main) {
			this._log(`H  skipped: HD not offered (${e.hd.reason})`);
			return;
		}
		let t = e.player, n = t?.current;
		if (!t || !n || e.stream !== "sub") {
			this._log("H  skipped: nothing playing on the sub stream");
			return;
		}
		let r = e.day?.segments.find((e) => e.id === n.segmentId), i = r ? ` (${v((t.time ?? r.start) - r.start)} into a ${v(r.end - r.start)} recording)` : "", a = await this._switchTo("main");
		if (!a.ok) {
			this._log(`H  HD at ${H(a.at)}${i}: ${a.line}`), this._summary.push(`HD switch: ${a.line}`), this._plain.push({
				grade: "problem",
				text: "HD did not play; the viewer went back to SD.",
				advice: "SD still works. Include the details below if you report it."
			});
			return;
		}
		this._hdPlayed = !0, this._log(`H  HD at ${H(a.at)}${i}: ${a.line} · ${e.metrics.stream ?? "?"} ${e.metrics.codec ?? "?"} · ${e.metrics.delivery ?? "?"}`), this._log(`     ${await this._fillReport()}`), await this._pause(5e3);
		let s = await this._switchTo("sub");
		this._log(`     Back to SD at ${H(s.at)}: ${s.line}`), this._summary.push(`HD switch: to HD ${a.short}; back to SD ${s.short}`), this._plain.push({
			grade: u([c(a.ms, 3e3, 8e3), a.kept ? "good" : "fine"]),
			text: `Switching to HD takes ${o(a.ms ?? 0)}${a.kept ? " and keeps your place" : ", but starts at another moment"}${s.ok ? `; back to SD, ${o(s.ms ?? 0)}` : ""}.`
		});
	}
	async _switchTo(e) {
		let t = this._t, n = t.player, r = n?.time ?? 0, i = t.metrics.hdFailures ?? 0, a = () => (t.metrics.hdFailures ?? 0) > i;
		t.setStream(e);
		let o = await this._wait(() => t.metrics.stream === e && t.metrics.firstFrameMs !== void 0 || a() || !!t.playFailure, F), s = a() ? t.metrics.lastHdFailure ?? "HD failed" : t.playFailure;
		if (!o || s) {
			let e = s ? `FAILED: ${s} (back on the sub stream)` : `no first frame within ${v(F)}`;
			return {
				ok: !1,
				at: r,
				line: e,
				short: e
			};
		}
		let c = t.metrics.firstFrameMs ?? 0, l = ((n?.time ?? r) - r) / 1e3, u = Math.abs(l) <= 1.5 ? "kept the moment" : "MOVED";
		return {
			ok: !0,
			at: r,
			ms: c,
			kept: u === "kept the moment",
			line: `first frame ${g(c)}, started ${l.toFixed(2)} s from where ${e === "main" ? "SD" : "HD"} was (${u})`,
			short: `${g(c)}, ${u} (${l.toFixed(2)} s)`
		};
	}
	async _measureRate(e, t) {
		e.playbackRate = t;
		let n = e.playbackRate;
		await this._pause(de);
		let r = W(), i = setInterval(() => {
			r &&= W();
		}, 250), a = q(e), o = e.currentTime, s = performance.now(), c = 0, l, u = 0, d = !1, f = () => {
			c += 1, l ??= performance.now();
		}, p = () => {
			l !== void 0 && (u += performance.now() - l), l = void 0;
		}, m = () => {
			d = !0;
		};
		e.addEventListener("waiting", f), e.addEventListener("playing", p), e.addEventListener("ended", m);
		let h = be(e);
		try {
			await this._pause(N);
		} finally {
			clearInterval(i), h.stop(), e.removeEventListener("waiting", f), e.removeEventListener("playing", p), e.removeEventListener("ended", m);
		}
		l !== void 0 && (u += performance.now() - l);
		let g = q(e);
		return {
			rate: t,
			applied: n,
			wallMs: performance.now() - s,
			mediaS: Math.max(0, e.currentTime - o),
			painted: h.painted,
			maxGapMs: h.maxGap,
			decoded: a && g ? g.totalVideoFrames - a.totalVideoFrames : void 0,
			dropped: a && g ? g.droppedVideoFrames - a.droppedVideoFrames : void 0,
			stalls: c,
			stalledMs: u,
			ended: d,
			focused: r && W()
		};
	}
	async _link() {
		let t = this._t.playing?.url ?? this._t.playing?.clip_url;
		if (!t) {
			this._log("L  skipped: nothing played");
			return;
		}
		let n = performance.now(), r = new AbortController(), i = setTimeout(() => {
			r.abort();
		}, pe);
		try {
			let e = await fetch(t, {
				headers: { Range: "bytes=0-33554431" },
				cache: "no-store",
				signal: r.signal
			}), i = performance.now() - n, a = 0, o = e.body?.getReader();
			try {
				for (;;) {
					let e = await o?.read();
					if (!e || e.done) break;
					a += e.value.byteLength;
				}
			} catch {}
			let s = performance.now() - n, c = a * 8 / ((s - i) * 1e3);
			this._log(`L  Link to Home Assistant: ${_(a)} of the cached recording in ${g(s - i)} after the answer = ${c.toFixed(1)} Mbit/s (answer ${g(i)}, HTTP ${e.status})`), this._summary.push(`Link: ${c.toFixed(1)} Mbit/s`), this._plain.push({
				grade: c >= 16 ? "good" : c >= 4 ? "fine" : "slow",
				text: `Recordings come from Home Assistant at ${c.toFixed(0)} Mbit/s: ` + (c >= 16 ? "plenty for HD." : c >= 4 ? "enough for SD; HD may pause to load." : "SD may pause to load.")
			});
		} catch (t) {
			this._log(`L  Link test failed: ${e(t).message}`);
		} finally {
			clearTimeout(i);
		}
	}
	async _capabilities() {
		let e = this._t, t = {};
		try {
			t = await i(e.hass, e.deviceId);
		} catch {}
		let n = t.sub?.codec, r = t.main?.codec, a = (e) => [["sub", n], ["main", r]].map(([t, n]) => n ? `${t} ${n} ${U(A(e, n))}` : `${t} codec unknown (not cached yet)`).join(", "), o = ["MediaSource", "ManagedMediaSource"];
		this._log(`MSE: ${o.map((e) => k(e) ? `${e} present (${a(e)})` : `${e} absent`).join(" · ")}`);
		let s = [];
		for (let e of o) {
			if (!k(e)) continue;
			let t = re(e);
			if (!t) {
				this._log(`MSE probe (${e}): no sample codec supported`);
				continue;
			}
			let n = [];
			for (let { shape: r, label: i } of ne) this._checkStopped(), n.push(`${i} ${await ae(e, t.sample, r)}`);
			this._log(`MSE probe (${e}, ${t.name} sample): ${n.join(" · ")}`), s.push(`${e} ${n[0]?.includes("plays") ? "plays MSE-ready fragments" : "fails"}`);
		}
		this._summary.push(`MSE: ${s.join(", ") || "neither MediaSource nor ManagedMediaSource"}`);
		let c = document.createElement("video"), l = (e) => e ? `"${c.canPlayType(`video/mp4; codecs="${e}"`)}"` : "unknown";
		this._log(`Video: canPlayType sub ${l(n)}, main ${l(r)} · getVideoPlaybackQuality ${U("getVideoPlaybackQuality" in c)} · requestVideoFrameCallback ${U("requestVideoFrameCallback" in c)} · performance.memory ${U(K() !== void 0)}`), this._log(`HD as the tab opened: ${e.hd.reason}${this._hdPlayed ? " (played in H above)" : ""}`), t.main?.width && t.main.height && r && this._log(`HD decodingInfo for ${r} at ${t.main.width}×${t.main.height}: ${await xe(r, t.main.width, t.main.height)}`), this._hdPlayed || this._summary.push(`HD: ${e.hd.main ? "offered" : "not offered"} (${e.hd.reason})`), e.hd.main || this._plain.push({
			grade: "note",
			text: `HD is not offered on this device: ${e.hd.reason}.`
		});
	}
	async _soak() {
		let e = this._t, t = this.options.soakMinutes, n = this._long, r = n?.date ?? e.date;
		e.date !== r && await this._loadDay(r);
		let i = n?.segment ?? e.day?.segments[0];
		if (!i) {
			this._log("M  skipped: no recording to play");
			return;
		}
		this._log(`M  One-hour session: playing from ${H(i.start)} on ${r} for ${t} min, a sample a minute`);
		let a = e.player, o = 0, s = 0, c = [], l = () => {
			o += 1;
		}, u = (e) => {
			s += 1, c.push(e.detail.gapMs);
		}, f = [...a?.renderRoot.querySelectorAll("video") ?? []], p = [], m = [], h = 0, v = new ve(), y = { minute: !0 }, b = setInterval(() => {
			y.minute &&= W();
		}, 1e3), x = performance.now();
		try {
			await this._play(i.start), f.forEach((e) => {
				e.addEventListener("waiting", l);
			}), a?.addEventListener("rv-advanced", u);
			for (let n = 1; n <= t; n += 1) {
				if (await this._pause(fe), e.player?.paused && document.visibilityState === "visible") {
					let t = e.day?.segments[0];
					this._log(`M  ${n} min: playback had stopped${e.playFailure ? ` (${e.playFailure})` : ""}; starting again from the day's first recording`), t && await e.playAt(t.start, performance.now());
				}
				let t = J(e.player), r = v.update(f), i = y.minute && W();
				y.minute = !0;
				let a = t ? Math.max(0, ye(t) - t.currentTime) : 0;
				h = Math.max(h, a);
				let c = K();
				c !== void 0 && p.push([(performance.now() - x) / 36e5, c]);
				let l = await this._stats();
				l?.vod.disk_bytes !== void 0 && m.push(l.vod.disk_bytes);
				let u = f.reduce((e, t) => e + te(t.buffered), 0);
				this._log(`M  ${n} min: ${e.player?.time === void 0 ? "?" : H(e.player.time)} ${e.player?.paused ? "paused" : "playing"}` + (document.visibilityState === "visible" ? "" : " (page hidden: the system pauses video)") + (i ? "" : " · PAGE NOT IN FRONT this minute") + ` · heap ${c === void 0 ? "n/a" : _(c)} · ${a.toFixed(0)} s ahead, ${u.toFixed(0)} s buffered in both videos · dropped ${r} this minute, ${v.dropped} of ${v.decoded} in all · ${o} stalls · ${s} file changes` + (e.metrics.recoveries ? ` · ${e.metrics.recoveries} reloads mid-way` : "") + (l ? ` · cache ${_(l.vod.disk_bytes)} on disk + ${_(l.vod.reserved_bytes)} reserved, ${l.vod.leased ?? "?"} leased` : "")), $(this.id, this.options.setup, n);
			}
		} finally {
			clearInterval(b), f.forEach((e) => {
				e.removeEventListener("waiting", l);
			}), a?.removeEventListener("rv-advanced", u);
		}
		let S = ee(p), C = p.length ? `heap ${_(p[0]?.[1])} → ${_(p.at(-1)?.[1])} (max ${_(Math.max(...p.map(([, e]) => e)))}${S === void 0 ? "" : `, ${S >= 0 ? "+" : ""}${_(S)}/h`})` : "heap not measurable in this browser (the page was not reloaded)", w = (await this._stats())?.vod.max_bytes, T = m.length ? `cache ${_(Math.min(...m))}–${_(Math.max(...m))} on disk (cap ${_(w)})` : "cache use unknown", E = `${t} min: ${C}, at most ${h.toFixed(0)} s buffered ahead, ${v.dropped} of ${v.decoded} frames dropped, ${o} stalls, ${s} file changes${c.length ? ` (gaps ${c.map((e) => g(e)).join(", ")})` : ""}, ${e.metrics.recoveries ?? 0} reloads mid-way, ${T}`;
		this._log(`M  Summary: ${E}`), this._summary.push(`Session: ${E}`);
		let D = v.decoded ? v.dropped / v.decoded : 0, O = e.metrics.recoveries ?? 0;
		this._plain.push({
			grade: !o && !O && D < .005 ? "good" : o <= 2 && D < .02 ? "fine" : "slow",
			text: `Played for ${d(t, "minute")}: ` + [
				o ? `it paused to load ${d(o, "time")}` : "it never paused to load",
				v.decoded ? `${D < .001 ? "no" : `${(D * 100).toFixed(1)}% of`} frames skipped` : void 0,
				O ? `reloaded ${d(O, "time")}` : void 0
			].filter(Boolean).join(", ") + "."
		});
	}
	async _stats() {
		try {
			return await this._t.hass.callWS({ type: "reolink_viewer/playback/stats" });
		} catch {
			return;
		}
	}
}, U = (e) => e === void 0 ? "n/a" : e ? "yes" : "no", W = () => document.visibilityState === "visible" && document.hasFocus(), G = (e) => typeof e == "string" || typeof e == "number" ? String(e) : "?";
function K() {
	return performance.memory?.usedJSHeapSize;
}
var ve = class {
	decoded = 0;
	dropped = 0;
	_last = /* @__PURE__ */ new Map();
	update(e) {
		let t = this.dropped;
		for (let t of e) {
			let e = q(t);
			if (!e) continue;
			let n = this._last.get(t), r = !n || e.totalVideoFrames < n.totalVideoFrames;
			this.decoded += r ? e.totalVideoFrames : e.totalVideoFrames - n.totalVideoFrames, this.dropped += r ? e.droppedVideoFrames : e.droppedVideoFrames - n.droppedVideoFrames, this._last.set(t, e);
		}
		return this.dropped - t;
	}
};
function q(e) {
	return typeof e.getVideoPlaybackQuality == "function" ? e.getVideoPlaybackQuality() : void 0;
}
function ye(e) {
	let t = e.buffered;
	for (let n = 0; n < t.length; n += 1) if (t.start(n) <= e.currentTime + .5 && t.end(n) >= e.currentTime) return t.end(n);
	return e.currentTime;
}
function J(e) {
	return e?.renderRoot.querySelector("video.active") ?? null;
}
function be(e) {
	if (typeof e.requestVideoFrameCallback != "function") return {
		painted: void 0,
		maxGap: void 0,
		stop: () => void 0
	};
	let t, n = 0, r = !1, i = {
		painted: 0,
		maxGap: 0,
		stop: () => {
			r = !0, e.cancelVideoFrameCallback(n);
		}
	}, a = (o) => {
		r || (i.painted = (i.painted ?? 0) + 1, t !== void 0 && (i.maxGap = Math.max(i.maxGap ?? 0, o - t)), t = o, n = e.requestVideoFrameCallback(a));
	};
	return n = e.requestVideoFrameCallback(a), i;
}
function Y(e, t) {
	let n = {}, r = [...e?.renderRoot.querySelectorAll("video") ?? []], i = [
		"loadedmetadata",
		"seeked",
		"playing"
	].map((e) => {
		let i = (r) => {
			r.target.classList.contains("active") && (n[e] ??= performance.now() - t);
		};
		return r.forEach((t) => {
			t.addEventListener(e, i);
		}), [e, i];
	});
	return {
		seen: n,
		stop: () => {
			for (let [e, t] of i) for (let n of r) n.removeEventListener(e, t);
		}
	};
}
function X(e, t) {
	let n = t ? new URL(t, location.href).pathname : "", r = performance.getEntriesByType("resource").filter((t) => (t.initiatorType === "video" || t.initiatorType === "fetch" && t.name.includes("/api/reolink_viewer/mse/")) && t.startTime >= e - 5);
	if (!r.length) return "requests: none reported (this browser may not report video requests)";
	let i = r.filter((e) => e.requestStart > 0), a = i.slice(0, 10).map((t, r) => {
		let i = n && new URL(t.name).pathname.startsWith(n) ? "" : " (other file)", a = t.encodedBodySize ? ` · ${_(t.encodedBodySize)}` : "";
		return `#${r + 1}${i} +${Math.round(t.startTime - e)} ms: wait ${Math.round(t.requestStart - t.startTime)} · answer ${Math.round(t.responseStart - t.requestStart)} · ran ${Math.round(t.responseEnd - t.responseStart)} ms${a}`;
	}), o = i.length > 10 ? ` | … ${i.length - 10} more` : "", s = r.length - i.length, c = [...new Set(i.map((e) => e.nextHopProtocol).filter(Boolean))].join("/");
	return `requests${c ? ` (${c})` : ""}: ${i.length} sent${s ? `, ${s} cancelled before sending` : ""}: ${a.join(" | ")}${o}`;
}
async function xe(t, n, r) {
	let i = navigator.mediaCapabilities;
	if (!i?.decodingInfo) return "MediaCapabilities absent";
	let a = [];
	for (let o of ["file", "media-source"]) try {
		let e = await i.decodingInfo({
			type: o,
			video: {
				contentType: `video/mp4; codecs="${t}"`,
				width: n,
				height: r,
				bitrate: 8e6,
				framerate: 25
			}
		});
		a.push(`${o}: ${e.supported ? "supported" : "not supported"}${e.supported ? `, ${e.smooth ? "smooth" : "not smooth"}, ${e.powerEfficient ? "power efficient" : "not power efficient"}` : ""}`);
	} catch (t) {
		a.push(`${o}: ${e(t).message}`);
	}
	return a.join(" · ");
}
function Z(e) {
	if (!e) return "?";
	let t = [e.cache ?? "?"];
	e.age_s !== void 0 && t.push(`${G(e.age_s)} s old`);
	for (let [n, r] of [
		["queue_ms", "queue"],
		["files_ms", "recordings"],
		["events_ms", "events"],
		["total_ms", "total"]
	]) {
		let i = e[n];
		typeof i == "number" && t.push(`${r} ${g(i)}`);
	}
	return typeof e.warm == "string" && t.push(`background fetch: ${e.warm}`), t.join(", ");
}
function Q() {
	try {
		return window.localStorage;
	} catch {
		return;
	}
}
function $(e, t, n) {
	try {
		let r = Q()?.getItem(R), i = {
			id: e,
			setup: t,
			started: r ? JSON.parse(r).started : (/* @__PURE__ */ new Date()).toISOString(),
			updated: (/* @__PURE__ */ new Date()).toISOString(),
			...n ? { minute: n } : {}
		};
		Q()?.setItem(R, JSON.stringify(i));
	} catch {}
}
function Se(e) {
	try {
		let t = Q()?.getItem(R);
		t && JSON.parse(t).id === e && Q()?.removeItem(R);
	} catch {}
}
async function Ce(e) {
	let t;
	try {
		let e = Q()?.getItem(R);
		if (!e) return;
		t = JSON.parse(e), Q()?.removeItem(R);
	} catch {
		return;
	}
	let n = t.minute ? ` in minute ${t.minute} of the one-hour session` : "", r = `The playback check started ${new Date(t.started).toLocaleString()} (${t.setup}) stopped without finishing${n}: the page was reloaded or closed after ${new Date(t.updated).toLocaleTimeString()}. In the iOS app this usually means the app ran out of memory.`;
	try {
		let { reports: n } = await e.callWS({ type: "reolink_viewer/playback/check_reports" }), i = n.find((e) => e.id === t.id);
		i && !i.done && await e.callWS({
			type: "reolink_viewer/playback/check_report",
			report_id: i.id,
			setup: i.setup,
			text: `${i.text}\nINTERRUPTED: ${r}`,
			done: !0
		});
	} catch {}
	return r;
}
var we = (e) => e.callWS({ type: "reolink_viewer/playback/check_reports" });
//#endregion
export { Ce as a, m as c, le as i, ce as n, h as o, we as r, p as s, _e as t };

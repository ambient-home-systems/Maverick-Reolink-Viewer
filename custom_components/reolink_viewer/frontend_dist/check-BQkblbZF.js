import { Lt as e, Ot as t, Rt as n, X as r, gt as i, h as a, tt as o, xt as s } from "./live-BlvcqnUk.js";
import { it as c, tt as l } from "./home-DMJ1HaF0.js";
import { a as u, n as d, o as f, r as p, s as m, t as h } from "./findings-CGXJtbfY.js";
//#region src/playback/check-util.ts
var g = (e) => /iPhone|iPad|iPod/.test(e);
function _(e) {
	return g(e) ? "iPhone app, Wi-Fi (local)" : "Desktop Chrome, LAN";
}
function v(e, t) {
	return e.startsWith("iPhone") ? !g(t) : e.startsWith("Desktop") ? g(t) : !1;
}
function y(e) {
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
var b = (e) => e === void 0 ? "–" : `${Math.round(e)} ms`, x = (e) => e === void 0 ? "–" : Math.abs(e) >= 1e9 ? `${(e / 1e9).toFixed(2)} GB` : `${(e / 1e6).toFixed(1)} MB`;
function S(e) {
	return e < 6e4 ? `${Math.round(e / 1e3)} s` : `${(e / 6e4).toFixed(1)} min`;
}
function C(e, t, n, r, i) {
	let a = e.end - e.start, o = e.start + a * n, s = e.start + a * r, c = t.filter((e) => e.start >= o && e.start <= s).at(-1);
	return {
		time: c ? c.start : Math.round(e.start + a * i),
		event: c
	};
}
function w(e, t) {
	return e.filter((e) => e.end - e.start >= 12e5 && t - e.end > 6e4).sort((e, t) => t.start - e.start);
}
function T(e) {
	let t = [];
	return e.forEach((n, r) => {
		let i = e.at(r + 1);
		i && i.start - n.end < 2e3 && t.push([n, i]);
	}), t.sort((e, t) => e[0].end - e[0].start - (t[0].end - t[0].start));
}
function E(e) {
	return e.decoded && e.mediaS > 0 ? e.decoded / e.mediaS : void 0;
}
function D(e) {
	let t = [`${(e.wallMs > 0 ? e.mediaS * 1e3 / e.wallMs : 0).toFixed(2)}× effective`];
	e.applied !== e.rate && t.push(`browser set ${e.applied}×`);
	let n = E(e);
	if (e.painted !== void 0) {
		let r = `${(e.painted * 1e3 / e.wallMs).toFixed(0)} fps painted`;
		t.push(n ? `${r} of ${(n * e.rate).toFixed(0)}` : r);
	}
	if (e.maxGapMs !== void 0 && t.push(`longest frame gap ${Math.round(e.maxGapMs)} ms`), e.decoded !== void 0 && e.dropped !== void 0) {
		let n = e.decoded ? (e.dropped * 100 / e.decoded).toFixed(1) : "0.0";
		t.push(`dropped ${e.dropped} of ${e.decoded} frames (${n} %)`);
	}
	return t.push(`${e.stalls} stalls${e.stalls ? ` (${Math.round(e.stalledMs)} ms)` : ""}`), e.ended && t.push("the file ended"), k(e) || t.push("the dropped-frame counter disagrees with the frames painted: judged by those"), e.focused || t.push("PAGE NOT IN FRONT"), `${String(e.rate).padStart(3)}×: ${t.join(", ")}`;
}
var O = "on pace (±10 %), stalls under 100 ms, no frame gap over 2.5 frames (250 ms at least); below 50 fps to show, ≤ 2 % (or 1 frame) dropped, or 90 % painted where the dropped-frame counter disagrees with the frames painted";
function k(e) {
	if (e.painted === void 0 || e.decoded === void 0 || e.dropped === void 0) return !0;
	let t = e.decoded - e.dropped;
	return Math.abs(t - e.painted) <= Math.max(3, e.decoded * .1);
}
function ee(e) {
	let t = e.filter((e) => e.focused), n = e.filter((e) => !e.focused), r = t.filter((e) => !A(e)), i = (e) => e.map((e) => `${String(e.rate)}×`).join(", "), a = [];
	return t.length && a.push(r.length ? {
		grade: "slow",
		text: `Playback stutters at ${i(r)} speed.`
	} : {
		grade: "good",
		text: `Slow motion and fast forward (${String(t[0]?.rate)}× to ${String(t.at(-1)?.rate)}×) play smoothly.`
	}), n.length && a.push({
		grade: "note",
		text: `Playback at ${i(n)} was not measured: the page was not in front.`,
		advice: "Keep the page in front, and the screen on, while the check runs."
	}), a;
}
function A(e) {
	let t = e.wallMs > 0 ? e.mediaS * 1e3 / e.wallMs : 0;
	if (Math.abs(t - e.rate) > e.rate * .1 || e.stalledMs >= 100) return !1;
	let n = E(e), r = n === void 0 ? void 0 : n * e.rate;
	if (r !== void 0 && e.maxGapMs !== void 0) {
		let t = Math.max(250, 2500 / Math.min(r, 60));
		if (e.maxGapMs > t) return !1;
	}
	return r === void 0 || r > 50 ? !0 : !k(e) && e.painted !== void 0 ? e.painted * 1e3 / e.wallMs >= r * .9 : !e.decoded || (e.dropped ?? 0) <= Math.max(1, e.decoded * .02);
}
function j(e) {
	if (e.length < 2) return;
	let t = e.length, n = e.reduce((e, [t]) => e + t, 0) / t, r = e.reduce((e, [, t]) => e + t, 0) / t, i = 0, a = 0;
	for (let [t, o] of e) i += (t - n) * (o - r), a += (t - n) ** 2;
	return a ? i / a : void 0;
}
function M(e) {
	let t = 0;
	for (let n = 0; n < e.length; n += 1) t += e.end(n) - e.start(n);
	return t;
}
var N = (e, t) => e === void 0 ? "not measured" : `${b(e)} ${e < t ? "✓" : "✗"}`;
function te(e) {
	return e === "cut" ? "the Reolink protocol cut" : e === "file" ? "the recording's download" : "?";
}
function ne(e) {
	let t = [];
	typeof e.first_fragment_ms == "number" && t.push(`first fragment ${Math.round(e.first_fragment_ms)} ms`), typeof e.slot_ms == "number" && t.push(`slot ${Math.round(e.slot_ms)} ms${e.borrowed ? " (the download's)" : ""}`), e.login === "new" ? t.push(`login (an extra user)${typeof e.login_ms == "number" ? ` ${Math.round(e.login_ms)} ms` : ""}`) : e.login && t.push("login shared"), typeof e.reply_ms == "number" && t.push(`reply ${Math.round(e.reply_ms)} ms`), e.gave_way && t.push(`gave way to another viewer ${String(e.gave_way)}×`), t.push(`${e.fragments ?? 0} fragments, ${((e.bytes ?? 0) / 1e6).toFixed(1)} MB`), typeof e.mbit_s == "number" && t.push(`${e.mbit_s} Mbit/s`), t.push(e.error ? `error ${e.error}` : e.complete ? "complete" : e.running ? "running" : "stopped");
	let n = e.mux;
	if (n) {
		let e = n.rate_source ?? (n.rate_learned ? "learned" : "nominal");
		t.push(`placed by ${n.anchor ?? "?"}, counter ${n.counter_rate ?? "?"}/s${e === "nominal" ? "" : ` (${e})`}`), n.foreign_skipped && t.push(`${String(n.foreign_skipped)} blocks of another cut skipped`);
	}
	return typeof e.mux_ms == "number" && t.push(`mux ${Math.round(e.mux_ms)} ms`), `Reolink protocol cut: ${t.join(", ")}`;
}
function re(e) {
	return e ? e.enabled ? `Reolink protocol: ${e.logged_in} host(s) logged in now, ${e.logins} logins, ${e.logouts} logouts, ${e.cuts_running} cuts running` + (e.unsupported?.length ? `; not supported by ${String(e.unsupported.length)} device(s): ${e.unsupported.join("; ")}` : "") : "Reolink protocol: off (turned off in the options)" : "Reolink protocol: no statistics";
}
function ie(e, t) {
	let n = e.reduce((e, t) => e + Math.max(0, t.end - t.start), 0);
	if (!n || t <= 0) return [];
	let r = [];
	for (let i = 0; i < t; i += 1) {
		let a = (i + .5) / t * n;
		for (let t of e) {
			let e = Math.max(0, t.end - t.start);
			if (a < e) {
				r.push(Math.round(t.start + a));
				break;
			}
			a -= e;
		}
	}
	return r;
}
function P(e, t) {
	let n = e.find((e) => e.start <= t && t < e.end);
	if (!n) return "in no recording";
	let r = t - n.start, i = n.end - t, a = (e) => e < 1e4 ? `${(e / 1e3).toFixed(1)} s` : S(e), o = S(n.end - n.start);
	return r <= i ? `${a(r)} into a ${o} recording` : `${a(i)} before the end of a ${o} recording`;
}
function F(e) {
	let t = e.answered.length + e.missed.length, n = e.answered.map((e) => e.ms).sort((e, t) => e - t), r = n.length ? n[Math.floor((n.length - 1) / 2)] : void 0, i = /* @__PURE__ */ new Map();
	for (let t of e.answered) i.set(t.source, (i.get(t.source) ?? 0) + 1);
	let a = [...i].map(([e, t]) => `${e} ${String(t)}`).join(", "), o = /* @__PURE__ */ new Map();
	for (let t of e.missed) o.set(t, (o.get(t) ?? 0) + 1);
	let s = [...o].map(([e, t]) => `${String(t)}: ${e}`).join("; ");
	return `${String(e.answered.length)} of ${String(t)}` + (r === void 0 ? "" : `, median ${b(r)}${a ? ` (${a})` : ""}`) + (s ? ` · none for ${s}` : "");
}
var I = (e) => {
	if (!e.length) return;
	let t = [...e].sort((e, t) => e - t);
	return t[Math.floor((t.length - 1) / 2)];
};
function L(e) {
	let t = e.paints, n = t.find((e) => e.interval !== void 0)?.interval ?? 4e3, r = t.filter((t) => t.wall <= e.movedMs), i = r.slice(1).map((e, t) => e.wall - (r[t]?.wall ?? e.wall)), a = t.map((e) => e.at - e.time), o = t.at(-1), s = {};
	for (let e of t) s[e.source] = (s[e.source] ?? 0) + 1;
	let c = {
		pictures: t.length,
		onTime: a.filter((e) => e >= -500 && e <= n + 500).length,
		interval: n,
		sources: s
	}, l = I(i), u = I(r.map((e) => e.pointer - e.time));
	return t[0] && (c.firstMs = t[0].wall), l !== void 0 && (c.gapMs = l), a.length && (c.before = [Math.min(...a) / 1e3, Math.max(...a) / 1e3]), u !== void 0 && (c.lagMs = u), o && (c.restMs = Math.abs(e.rest - o.time)), c;
}
var ae = (e) => e.restMs !== void 0 && e.restMs <= e.interval + 500;
function R(e, t) {
	if (!e.pictures) return `no picture in ${String(t.asked)} asked${t.missed ? ` (${String(t.missed)} missed${t.lastMiss ? `, last: ${t.lastMiss}` : ""})` : ""}`;
	let n = Object.entries(e.sources).map(([e, t]) => `${e} ${String(t)}`).join(", ");
	return h(e.pictures, "picture") + (e.firstMs === void 0 ? "" : `, the first after ${(e.firstMs / 1e3).toFixed(2)} s`) + (e.gapMs === void 0 ? "" : `, a new one every ${(e.gapMs / 1e3).toFixed(2)} s (median)`) + `, ${String(e.onTime)} of ${String(e.pictures)} within the camera's ${(e.interval / 1e3).toFixed(1)} s of their moment` + (e.before ? ` (${e.before[0].toFixed(1)} to ${e.before[1].toFixed(1)} s before)` : "") + (e.lagMs === void 0 ? "" : `, ${(e.lagMs / 1e3).toFixed(1)} s behind the moving pointer`) + (e.restMs === void 0 ? "" : `; at rest, ${(e.restMs / 1e3).toFixed(1)} s from the pointer`) + ` · ${n}` + (t.missed ? ` · ${String(t.missed)} of ${String(t.asked)} asked missed${t.lastMiss ? ` (last: ${t.lastMiss})` : ""}` : "");
}
function z(e, t = 250) {
	let n = performance.now(), r = e(), i = r, a = n, o = 0, s = setInterval(() => {
		let t = performance.now(), n = e();
		n !== void 0 && i !== void 0 && n > i ? a = t : o = Math.max(o, t - a), i = n;
	}, t);
	return { stop: () => {
		clearInterval(s);
		let t = e();
		return {
			wallMs: performance.now() - n,
			playedMs: r !== void 0 && t !== void 0 ? Math.max(0, (t - r) * 1e3) : 0,
			longestStallMs: o
		};
	} };
}
function oe(e, t, n) {
	let r = [...e].reverse().find((e) => e.start <= n && e.end > t);
	return !r || n < r.end ? n : Math.max(t, Math.min(n, r.end - 2e3));
}
//#endregion
//#region src/playback/keyframes.ts
var se = 65536;
function* B(e, t, n) {
	let r = new DataView(e.buffer, e.byteOffset, e.byteLength), i = t;
	for (; i + 8 <= n;) {
		let t = r.getUint32(i), a = String.fromCharCode(e[i + 4] ?? 0, e[i + 5] ?? 0, e[i + 6] ?? 0, e[i + 7] ?? 0), o = i + 8;
		if (t === 1) {
			if (i + 16 > n) return;
			t = Number(r.getBigUint64(i + 8)), o = i + 16;
		} else t === 0 && (t = n - i);
		if (t < o - i || i + t > n) return;
		yield {
			type: a,
			start: i,
			body: o,
			end: i + t
		}, i += t;
	}
}
function V(e, t, n, r = 0) {
	for (let i of B(e, t.body + r, t.end)) if (i.type === n) return i;
}
function ce(e, t, ...n) {
	let r = t;
	for (let t of n) {
		if (!r) return;
		r = V(e, r, t);
	}
	return r;
}
function le(e) {
	let t = new DataView(e.buffer, e.byteOffset, e.byteLength), n = [...B(e, 0, e.length)].find((e) => e.type === "moov");
	if (n) for (let r of B(e, n.body, n.end)) {
		if (r.type !== "trak") continue;
		let i = ce(e, r, "mdia", "hdlr");
		if (!i || String.fromCharCode(...e.subarray(i.body + 8, i.body + 12)) !== "vide") continue;
		let a = V(e, r, "tkhd"), o = ce(e, r, "mdia", "mdhd"), s = ce(e, r, "mdia", "minf", "stbl", "stsd");
		if (!a || !o || !s) continue;
		let c = t.getUint32(a.body + (e[a.body] === 1 ? 20 : 12)), l = t.getUint32(o.body + (e[o.body] === 1 ? 20 : 12)), u;
		for (let t of B(e, s.body + 8, s.end)) {
			u = t;
			break;
		}
		if (!u) continue;
		let d = [...B(e, u.body + 78, u.end)].find((e) => e.type === "avcC" || e.type === "hvcC"), f = {
			trackId: c,
			timescale: l,
			entry: u.type,
			description: d ? e.slice(d.body, d.end) : void 0,
			width: t.getUint16(u.body + 24),
			height: t.getUint16(u.body + 26),
			defaultDuration: 0,
			defaultSize: 0,
			defaultFlags: 0
		}, p = V(e, n, "mvex");
		for (let n of p ? B(e, p.body, p.end) : []) n.type === "trex" && t.getUint32(n.body + 4) === c && (f.defaultDuration = t.getUint32(n.body + 12), f.defaultSize = t.getUint32(n.body + 16), f.defaultFlags = t.getUint32(n.body + 20));
		return f;
	}
}
function ue(e, t) {
	let n = new DataView(e.buffer, e.byteOffset, e.byteLength), r = [];
	for (let i of B(e, 0, e.length)) if (i.type === "moof") for (let a of B(e, i.body, i.end)) {
		if (a.type !== "traf") continue;
		let o = V(e, a, "tfhd");
		if (!o || n.getUint32(o.body + 4) !== t.trackId) continue;
		let s = n.getUint32(o.body) & 16777215;
		if (s & 1) continue;
		let c = o.body + 8;
		s & 2 && (c += 4);
		let l = t.defaultDuration, u = t.defaultSize, d = t.defaultFlags;
		s & 8 && (l = n.getUint32((c += 4) - 4)), s & 16 && (u = n.getUint32((c += 4) - 4)), s & 32 && (d = n.getUint32(c));
		let f = V(e, a, "tfdt"), p = f ? e[f.body] === 1 ? Number(n.getBigUint64(f.body + 4)) : n.getUint32(f.body + 4) : 0, m = i.start;
		for (let o of B(e, a.body, a.end)) {
			if (o.type !== "trun") continue;
			let a = n.getUint32(o.body) & 16777215, s = n.getUint32(o.body + 4), c = o.body + 8;
			a & 1 && (m = i.start + n.getInt32((c += 4) - 4));
			let f;
			a & 4 && (f = n.getUint32((c += 4) - 4));
			for (let i = 0; i < s; i += 1) {
				let o = a & 256 ? n.getUint32((c += 4) - 4) : l, s = a & 512 ? n.getUint32((c += 4) - 4) : u, h = a & 1024 ? n.getUint32((c += 4) - 4) : d;
				a & 2048 && (c += 4), i === 0 && f !== void 0 && (h = f), !(h & se) && m + s <= e.length && r.push({
					timeS: p / t.timescale,
					data: e.subarray(m, m + s)
				}), m += s, p += o;
			}
		}
	}
	return r;
}
function de(e) {
	return (/codecs="([^"]*)"/.exec(e)?.[1] ?? "").split(",").map((e) => e.trim()).find((e) => /^(avc|hev|hvc)/.test(e));
}
var fe = 3e3;
function pe() {
	let e = window;
	return {
		VideoDecoder: typeof e.VideoDecoder == "function" ? e.VideoDecoder : void 0,
		EncodedVideoChunk: e.EncodedVideoChunk
	};
}
function me() {
	let e = window, t = document.createElement("canvas"), n = t.getContext("2d");
	return {
		VideoDecoder: typeof e.VideoDecoder == "function" ? e.VideoDecoder : void 0,
		EncodedVideoChunk: e.EncodedVideoChunk,
		draw: n ? (e) => {
			t.width = e.displayWidth, t.height = e.displayHeight, n.drawImage(e, 0, 0);
		} : void 0,
		now: () => performance.now()
	};
}
async function he(e, t, n, r = me()) {
	let i = {
		available: r.VideoDecoder !== void 0,
		decodeMs: [],
		drawMs: []
	}, a = r.VideoDecoder;
	if (!a) return i;
	let o = {
		codec: e,
		codedWidth: t.width,
		codedHeight: t.height,
		optimizeForLatency: !0,
		...t.description ? { description: t.description } : {}
	};
	try {
		i.supported = (await a.isConfigSupported(o)).supported === !0;
	} catch (e) {
		i.supported = !1, i.error = String(e);
	}
	if (!i.supported) return i;
	let s, c = new a({
		output: (e) => {
			s ? s.resolve({
				frame: e,
				at: r.now()
			}) : e.close();
		},
		error: (e) => s?.reject(e)
	});
	try {
		c.configure(o);
		for (let e of n.slice(0, 12)) {
			let t, n = new Promise((e, n) => {
				s = {
					resolve: e,
					reject: n
				}, t = setTimeout(() => {
					n(/* @__PURE__ */ Error(`no frame within ${String(fe)} ms`));
				}, fe);
			}), a = r.now();
			c.decode(new r.EncodedVideoChunk({
				type: "key",
				timestamp: Math.round(e.timeS * 1e6),
				data: e.data
			}));
			let [{ frame: o, at: l }] = await Promise.all([n, c.flush()]).finally(() => {
				clearTimeout(t), s = void 0;
			});
			if (i.decodeMs.push(l - a), i.width = o.displayWidth, i.height = o.displayHeight, r.draw) {
				let e = r.now();
				r.draw(o), i.drawMs.push(r.now() - e);
			}
			o.close();
		}
	} catch (e) {
		i.error = e instanceof Error ? e.message : String(e);
	} finally {
		try {
			c.close();
		} catch {}
	}
	return i;
}
var H = (e) => `${e.toFixed(1)} ms`;
function U(e) {
	if (!e.length) return;
	let t = [...e].sort((e, t) => e - t), n = Math.floor(t.length / 2);
	return t.length % 2 ? t[n] : ((t[n - 1] ?? 0) + (t[n] ?? 0)) / 2;
}
var ge = (e) => `${String(Math.round(e / 1024))} KB`;
function _e(e, t, n, r, i) {
	let a = r.map((e) => e.data.length), o = U(r.slice(1).map((e, t) => e.timeS - (r[t]?.timeS ?? e.timeS)).filter((e) => e > 0)), s = r.length > 1 ? (r.at(-1)?.timeS ?? 0) - (r[0]?.timeS ?? 0) : 0, c = `${e} ${t} ${String(n.width)}×${String(n.height)}: ${String(r.length)} key frame${r.length === 1 ? "" : "s"}` + (r.length > 1 ? ` in ${s.toFixed(1)} s of media, every ${(o ?? 0).toFixed(1)} s` : "") + (a.length ? `, ${ge(Math.min(...a))}–${ge(Math.max(...a))} (median ${ge(U(a) ?? 0)})` : "");
	if (!i.available) return {
		text: `${c} · VideoDecoder absent: a scrub would decode through a hidden MSE video here`,
		short: `${e}: no VideoDecoder`,
		decodeMs: void 0
	};
	if (!i.supported) return {
		text: `${c} · VideoDecoder does not decode ${t}${i.error ? ` (${i.error})` : ""}`,
		short: `${e}: VideoDecoder refuses ${t}`,
		decodeMs: void 0
	};
	let [l, ...u] = i.decodeMs, d = U(u.length ? u : i.decodeMs), f = U(i.drawMs), p = d !== void 0 && d <= 30;
	return {
		text: `${c} · ${d === void 0 ? `VideoDecoder decoded none${i.error ? ` (${i.error})` : ""}` : `VideoDecoder: one in ${H(d)} (median of ${String(u.length || i.decodeMs.length)}${u.length ? `; the first ${H(l)}` : ""})` + (f === void 0 ? "" : `, drawn on a canvas in ${H(f)}`) + (i.width ? ` at ${String(i.width)}×${String(i.height ?? 0)}` : "") + (i.error ? ` · then failed: ${i.error}` : "") + ` · gate 30 ms: ${p ? "passes" : "fails"}`}`,
		short: d === void 0 ? `${e}: none decoded` : `${e} ${H(d)} to decode (VideoDecoder)${o ? `, every ${o.toFixed(1)} s` : ""}`,
		decodeMs: d
	};
}
//#endregion
//#region src/playback/scrub-client.ts
var ve = (e) => "data" in e, ye = 1;
function be(e, t) {
	let n = new DataView(e).getUint32(0), r = JSON.parse(new TextDecoder().decode(new Uint8Array(e, 4, n))), i = 4 + n;
	return {
		seq: r.seq,
		at: r.at,
		time: r.time,
		source: r.source,
		kind: r.kind,
		codec: r.codec,
		init: new Uint8Array(e, i, r.init),
		data: new Uint8Array(e, i + r.init, r.data),
		serverMs: r.timing?.ms,
		ms: t,
		...typeof r.interval == "number" ? { interval: r.interval } : {}
	};
}
var xe = 5e3, Se = class {
	_socket;
	_now;
	_seq = 0;
	_waiting;
	_closed = !1;
	_ready;
	constructor(e, t = () => performance.now()) {
		this._socket = e, this._now = t, e.binaryType = "arraybuffer", this._ready = new Promise((t, n) => {
			e.onopen = () => {
				t();
			}, e.onerror = () => {
				n(/* @__PURE__ */ Error("the scrub session could not open"));
			};
		}), e.onmessage = (e) => {
			this._message(e.data);
		}, e.onclose = () => {
			this._closed = !0, this._settle({ error: "the scrub session closed" });
		};
	}
	ready(e = 1e4) {
		let t, n = new Promise((n, r) => {
			t = setTimeout(() => {
				r(/* @__PURE__ */ Error("the scrub session did not open in time"));
			}, e);
		});
		return Promise.race([this._ready, n]).finally(() => {
			clearTimeout(t);
		});
	}
	async ask(e, t = xe) {
		let n = Math.round(e);
		await this._ready;
		let r = this._now();
		if (this._closed || this._socket.readyState !== ye) return {
			at: n,
			error: "the scrub session closed",
			ms: 0
		};
		this._settle({
			error: "a newer moment was asked",
			superseded: !0
		}), this._seq += 1;
		let i = this._seq, a = new Promise((e) => {
			let a = setTimeout(() => {
				this._waiting?.seq === i && this._settle({ error: "no answer in time" });
			}, t);
			this._waiting = {
				seq: i,
				at: n,
				began: r,
				resolve: e,
				timer: a
			};
		});
		return this._socket.send(JSON.stringify({
			seq: i,
			at: n
		})), a;
	}
	close() {
		this._closed = !0, this._settle({ error: "the scrub session closed" }), this._socket.close();
	}
	_settle(e) {
		let t = this._take();
		t?.resolve({
			at: t.at,
			ms: this._now() - t.began,
			...e
		});
	}
	_take() {
		let e = this._waiting;
		return this._waiting = void 0, clearTimeout(e?.timer), e;
	}
	_message(e) {
		let t = this._waiting;
		if (!t) return;
		let n = this._now() - t.began;
		if (e instanceof ArrayBuffer) {
			let { seq: r, ...i } = be(e, n);
			if (r !== t.seq) return;
			this._take(), t.resolve(i);
			return;
		}
		if (typeof e != "string") return;
		let r;
		try {
			r = JSON.parse(e);
		} catch {
			return;
		}
		r.seq === t.seq && (this._take(), t.resolve({
			at: t.at,
			error: r.error ?? "no picture",
			ms: n
		}));
	}
}, Ce = {
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
}, we = [
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
function W(e) {
	let t = window[e];
	return typeof t == "function" ? t : void 0;
}
function Te(e, t) {
	let n = W(e);
	if (n) try {
		return n.isTypeSupported(`video/mp4; codecs="${t}"`);
	} catch {
		return !1;
	}
}
function Ee(e) {
	for (let [t, n] of Object.entries(Ce)) if (Te(e, n.codec)) return {
		name: t,
		sample: n
	};
}
var De = (e) => Uint8Array.from(atob(e), (e) => e.charCodeAt(0));
function Oe(e, t) {
	let n = new Uint8Array(e.length + t.length);
	return n.set(e), n.set(t, e.length), n;
}
function ke(e, t) {
	return new Promise((n, r) => {
		let i = () => {
			e.removeEventListener("updateend", i), e.removeEventListener("error", a), n();
		}, a = () => {
			e.removeEventListener("updateend", i), e.removeEventListener("error", a), r(/* @__PURE__ */ Error("append error"));
		};
		e.addEventListener("updateend", i), e.addEventListener("error", a), e.appendBuffer(t);
	});
}
async function Ae(e, t, n, r = 5e3) {
	let i = W(e);
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
						await ke(i, De(t.init)), await ke(i, Oe(De(t[n]), De(t.mdat)));
					} catch {
						e("append error");
						return;
					}
					if (!i.buffered.length) e("appended, nothing buffered");
					else {
						try {
							s.endOfStream();
						} catch {}
						e(await je(o, r) ? `plays (${Math.round(performance.now() - a)} ms)` : "buffered, does not play");
					}
				})();
			}, { once: !0 });
		});
		return o.src = c, await e;
	} finally {
		clearTimeout(l), o.removeAttribute("src"), o.load(), o.remove(), URL.revokeObjectURL(c);
	}
}
function je(e, t) {
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
var Me = "0.8.3", Ne = [
	"Desktop Chrome, LAN",
	"Desktop Chrome, Tailscale",
	"Desktop Chrome, Nabu Casa",
	"iPhone app, Wi-Fi (local)",
	"iPhone app, Tailscale",
	"iPhone app, Nabu Casa",
	"Other"
];
function Pe(e) {
	return !/Tailscale|Nabu Casa/.test(e);
}
var Fe = [
	.5,
	1,
	2,
	4,
	8
], Ie = 6e3, Le = 1e3, Re = 6e4, ze = 33554432, Be = 3e3, Ve = 3e5, He = 1e4, Ue = [
	-10,
	-5,
	3,
	8,
	15
], We = 6e5, Ge = 2e4, Ke = 8388608, qe = 10, Je = 50, Ye = 5e3, G = {
	spanMs: 3e4,
	ms: 1e4
}, Xe = {
	spanMs: 3e5,
	ms: 5e3
}, Ze = 2e3, Qe = 2e4, $e = 5, et = .37, tt = 300, nt = 100, rt = 1e3, it = 500, at = 8e3, ot = 5e3, st = 75e3, K = 1500, ct = 3e5, lt = 15, ut = 7, q = "reolink-viewer-check-running", J = class extends Error {}, Y = (e) => new Promise((t) => setTimeout(t, e)), dt = (e) => e.time;
function ft(e, t, n) {
	return new Promise((r) => {
		let i = setTimeout(() => {
			e.removeEventListener(t, a), r(!1);
		}, n), a = () => {
			clearTimeout(i), r(!0);
		};
		e.addEventListener(t, a, { once: !0 });
	});
}
var X = (e) => new Date(e).toLocaleTimeString(), pt = class {
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
	_busyNote;
	_busiest = 0;
	_busyRows = /* @__PURE__ */ new Set();
	_busiestBy;
	_rowName = "";
	_releaseBusy;
	timeScale = 1;
	constructor(e, t, n = () => void 0) {
		this._t = e, this.options = t, this._onChange = n, this.id = `${(/* @__PURE__ */ new Date()).toISOString().slice(0, 19)}-${Math.random().toString(36).slice(2, 6)}`;
	}
	get text() {
		return this.lines.join("\n");
	}
	stop() {
		this._stopped = !0;
	}
	async _row(t, n) {
		this._rowName = t;
		try {
			await n();
		} catch (n) {
			if (n instanceof J) throw n;
			let r = e(n).message;
			this._log(`${t}  FAILED: ${r}`), this._plain.push({
				grade: "problem",
				text: `The check's ${t} row could not finish: ${r}.`
			});
		}
	}
	async run() {
		this.running = !0, Et(this.id, this.options.setup);
		try {
			await this._header(), this._sd(), await this._stats(), await this._row("A", () => this._timelines()), await this._row("B", () => this._events()), await this._row("D", () => this._deep()), await this._row("C", () => this._advance()), await this._row("R", () => this._rates()), await this._row("S", () => this._scrub()), await this._row("K", () => this._keyFrames()), await this._row("F", () => this._serverPictures()), await this._row("P", () => this._drag()), await this._row("H", () => this._switchHd()), await this._row("L", () => this._link()), await this._row("MSE", () => this._capabilities()), this.options.soakMinutes > 0 && await this._row("Soak", () => this._soak()), await this._row("V", () => this._viewers());
			for (let e of d(this.inShort(!0))) this._log(e);
			this._log(""), this._log("Summary:");
			for (let e of this._summary) this._log(`- ${e}`);
		} catch (t) {
			this._log(t instanceof J ? "Stopped." : `Check failed: ${e(t).message}`);
		} finally {
			this._t.player?.pause(), this.running = !1, this._log(`Done at ${(/* @__PURE__ */ new Date()).toLocaleTimeString()}.`), await this._save(!0), Dt(this.id);
		}
		return this.text;
	}
	inShort(e = !this.running) {
		let t = [...this._plain], n = t.filter((e) => e.grade === "problem").length, r = t.filter((e) => e.grade === "slow").length, i = this._t.cameraName;
		return {
			headline: t.length ? `${e ? "" : "So far: "}${n ? `${h(n, "problem")} found with ${i}'s recordings on this device.` : r ? `${i}'s recordings play on this device, but ${h(r, "thing")} ${r === 1 ? "is" : "are"} slow.` : `${i}'s recordings play well on this device.`}` : e ? "Nothing was measured." : "Measuring…",
			findings: t
		};
	}
	_log(e) {
		this.lines.push(e), this._onChange(), performance.now() - this._lastSave > He && this._save(!1);
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
		if (this._stopped) throw new J();
	}
	async _wait(e, t) {
		let n = performance.now() + t;
		for (; performance.now() < n;) {
			if (this._checkStopped(), e()) return !0;
			await Y(100);
		}
		return e();
	}
	async _pause(e) {
		let t = performance.now() + e;
		for (; performance.now() < t;) this._checkStopped(), await Y(Math.min(250, t - performance.now()));
	}
	async _header() {
		let e = this._t, t = navigator.connection;
		this._log(`Reolink Viewer playback check v${Me} · ${this.options.setup} · ${e.cameraName} · ${(/* @__PURE__ */ new Date()).toLocaleString()}`), this._log(`Browser: ${y(navigator.userAgent)} · page ${a(location.hostname)} over ${location.protocol.replace(":", "")} · screen ${screen.width}×${screen.height} @${window.devicePixelRatio}x` + (t?.effectiveType ? ` · network ${t.effectiveType}, ${t.downlink ?? "?"} Mbit/s (browser estimate)` : ""));
		let n = performance.getEntriesByType("navigation")[0];
		this._log(`User agent: ${navigator.userAgent}`), this._log(`Connection: page loaded over ${n?.nextHopProtocol || "? (from the app's cache)"}; each video request line gives its own (h2/h3 share one connection; http/1.1 allows 6 at once)`), this._log(`Player: ${e.mode} · file player delivery: ${e.progressive ? "progressive" : "whole file first (WebKit)"}`), this._summary.push(`Player: ${e.mode}`);
		let r = await e.hass.callWS({ type: "reolink_viewer/devices" }).catch(() => void 0), i = c(r, l);
		this._log(`Reolink Viewer: this page ${l}, Home Assistant ${r ? r.version ?? "older than 0.61.1" : "not read"}` + (i ? ` · NOT THE SAME: ${i.advice ?? ""}` : "")), i && this._plain.push({
			grade: "problem",
			text: i.text,
			...i.advice ? { advice: i.advice } : {}
		}), await this._wait(() => !!e.day && !e.loading, 3e4);
	}
	async _loadDay(e) {
		let t = this._t, n = t.metrics.timelineMs;
		return t.selectDate(e), await this._wait(() => !t.loading && t.day?.date === e && t.metrics.timelineMs !== n, 6e4), t.metrics;
	}
	async _timelines() {
		let e = this._t, t = e.today;
		e.date !== t && await this._loadDay(t);
		let n = e.metrics;
		this._log(`A1 Time to timeline, today (as the tab opened): ${b(n.timelineMs)} (server: ${Tt(n.timelineServer)})`);
		let r = Number(t.slice(8, 10)), i = [...e.monthDays].filter((e) => e < r).sort((e, t) => t - e), a = i.at(Math.min(2, i.length - 1));
		if (a === void 0) {
			this._log("A2/A3 skipped: no earlier recording day this month"), this._summary.push(`Timeline: today ${N(n.timelineMs, 1e3)}`), this._plain.push(n.timelineMs === void 0 ? {
				grade: "problem",
				text: "Today's recordings did not load."
			} : {
				grade: f(n.timelineMs, 1e3, 3e3),
				text: `Today's recordings appear on the timeline in ${u(n.timelineMs)}.`
			});
			return;
		}
		let o = `${t.slice(0, 8)}${String(a).padStart(2, "0")}`, s = await this._loadDay(o);
		this._log(`A2 Time to timeline, ${o}: ${b(s.timelineMs)} (server: ${Tt(s.timelineServer)})`), await this._loadDay(t);
		let c = await this._loadDay(o);
		this._log(`A3 Time to timeline, ${o} again: ${b(c.timelineMs)} (server: ${Tt(c.timelineServer)})`);
		let l = await this._loadDay(t);
		this._log(`A4 Time to timeline, today again: ${b(l.timelineMs)} (server: ${Tt(l.timelineServer)})`);
		let d = s.timelineServer?.cache === "fresh", p = [
			f(n.timelineMs, 1e3, 3e3),
			f(s.timelineMs, d ? 3e3 : 1e3, d ? 6e3 : 3e3),
			f(c.timelineMs, 1e3, 3e3)
		];
		this._plain.push(n.timelineMs === void 0 || s.timelineMs === void 0 || c.timelineMs === void 0 ? {
			grade: "problem",
			text: "The timeline of recordings did not always load."
		} : {
			grade: m(p),
			text: `Recordings appear on the timeline in ${u(n.timelineMs)} for today; an earlier day takes ${u(s.timelineMs)} the first time and ${u(c.timelineMs)} after that.`
		}), this._summary.push(`Timeline: today ${N(n.timelineMs, 1e3)}, past day first ${N(s.timelineMs, d ? 3e3 : 1e3)} (${d ? "cold, < 3 s" : "cached, < 1 s"}), again ${N(c.timelineMs, 1e3)}`);
	}
	async _play(e) {
		let t = this._t;
		performance.clearResourceTimings(), performance.setResourceTimingBufferSize(1e3);
		let n = performance.now(), r = St(t.player, n), i = t.playing;
		await t.playAt(e, n);
		let a = t.playing === i ? void 0 : t.playing?.cache, o = await this._wait(() => t.metrics.firstFrameMs !== void 0 || !!t.playFailure, 12e4);
		r.stop();
		let { text: s, heldMs: c } = await this._busy(), l = t.metrics, u = t.player?.time, d = u === void 0 ? void 0 : u - e, f = d === void 0 || Math.abs(d) <= 2e3 ? "" : ` · STARTED AT ${X(u ?? 0)}, ${S(Math.abs(d))} ${d < 0 ? "before" : "after"} the time asked`, p = t.playing?.file ? ` · ${t.playing.file} file` : "", m = t.player?.mseStats?.atSource, h = m ? ` · from ${te(m)}` : "", g = a === void 0 ? void 0 : t.playing?.timing?.total_ms, _ = `first frame ${o && !t.playFailure ? b(l.firstFrameMs) : "none"} [URL ${b(l.urlMs)}${g === void 0 ? "" : ` (server ${b(g)})`} · metadata ${b(r.seen.loadedmetadata)} · seeked ${b(r.seen.seeked)} · playing ${b(r.seen.playing)}] ${l.delivery ?? "?"}${p}${h} · ${l.stream ?? "?"} ${l.codec ?? ""}${f}${t.playFailure ? ` FAILED: ${t.playFailure}` : ""}` + (c !== void 0 && c >= it ? ` · HOME ASSISTANT HELD UP ${b(c)}` : "");
		return {
			ok: o && !t.playFailure && !f,
			line: _,
			served: m,
			began: n,
			source: t.playing?.base ?? t.playing?.url,
			held: a,
			busy: s
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
			let n = t.segments.find((e) => a.start >= e.start && a.start < e.end), o = n ? `${S(a.start - n.start)} into a ${S(n.end - n.start)} recording` : "no recording", s = await this._play(a.start);
			s.ok && e.metrics.firstFrameMs !== void 0 && (r.push(`${N(e.metrics.firstFrameMs, 2e3)}${s.held?.complete === !1 ? " (not cached)" : ""}`), i.push(e.metrics.firstFrameMs)), this._log(`B  ${a.types.join("+")} at ${X(a.start)} (${o}): ${s.line}`), await Y(300), this._log(`     ${Ct(s.began, s.source)}`), this._log(`     ${s.busy}`), n && this._log(`     ${await this._fillReport()}`), await this._pause(1500);
		}
		this._summary.push(`Events → first frame (sub): ${r.join(", ") || "none played"}`);
		let a = p(i);
		this._plain.push(a === void 0 ? {
			grade: "problem",
			text: "Events would not play.",
			advice: "Run the check again; if it happens again, include the details below in a report."
		} : {
			grade: f(a, 2e3, 4e3),
			text: `Opening an event starts its video in ${i.length > 1 ? "about " : ""}${u(a)}${i.length < n.length ? `; ${String(n.length - i.length)} of ${h(n.length, "event")} did not play` : ""}.`
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
				i = (await o(this._t.hass, t)).cache;
			} catch {
				i = null;
			}
			if (!i || i.error || i.complete && (!r || i.flat !== void 0) || typeof i.stopped_ms == "number") break;
			await this._pause(1e3);
		}
		if (!i) return "server: not cached (or its URL expired)";
		let a = [i.cache === "disk" ? "from disk" : `fill (${ht(i.priority)})`];
		for (let [e, t] of [
			["wait_ms", "queue"],
			["headers_ms", "NVR headers"],
			["ttfb_ms", "NVR first byte"],
			["fill_ms", "download"]
		]) typeof i[e] == "number" && a.push(`${t} ${b(i[e])}`);
		typeof i.mbit_s == "number" && a.push(`${i.mbit_s} Mbit/s`), a.push(x(i.bytes)), typeof i.stopped_ms == "number" && a.push(`stopped at ${S(i.stopped_ms)} (the cut has the rest)`), typeof i.yields == "number" && a.push(`gave its slot to the cut ${String(i.yields)}×`), typeof i.cut_offset_ms == "number" && a.push(`cut ${i.cut_offset_ms >= 0 ? "+" : ""}${String(Math.round(i.cut_offset_ms))} ms from the copy`), i.indexed !== void 0 && a.push(`index ${ht(i.indexed)}`), (r || i.flat !== void 0) && a.push(`plain MP4 ${i.flat === void 0 ? "not yet" : ht(i.flat)}`), typeof i.flat_ms == "number" && a.push(`rewrite ${b(i.flat_ms)}`), typeof i.flat_moov_bytes == "number" && a.push(`moov ${x(i.flat_moov_bytes)}`), i.error && a.push(`error ${i.error}`), typeof i.cut_error == "string" && a.push(`cut not used: ${i.cut_error}`);
		let s = i.cut;
		return `server: ${a.join(", ")}${s ? ` | ${ne(s)}` : ""}`;
	}
	async _findLong() {
		let e = this._t, t = e.today, n = Number(t.slice(8, 10)), r = [t, ...[...e.monthDays].filter((e) => e < n).sort((e, t) => t - e).slice(0, ut).map((e) => `${t.slice(0, 8)}${String(e).padStart(2, "0")}`)], i = 0, a;
		for (let t of r) {
			let n;
			try {
				n = t === e.date && e.day ? e.day : await s(e.hass, e.deviceId, t);
			} catch {
				continue;
			}
			for (let e of w(n.segments, n.now)) {
				if (i >= lt) return a;
				i += 1;
				let r = await this._peek(t, e.id);
				if (r && !r.cache) return {
					date: t,
					day: n,
					segment: e,
					cached: !1
				};
				r?.cache?.complete && !a && (a = {
					date: t,
					day: n,
					segment: e,
					cached: !0
				});
			}
		}
		return a;
	}
	_sd() {
		let e = this._t;
		e.stream !== "sub" && (e.player?.pause(), e.setStream("sub"), this._log("The tab was on HD: switched to SD for the check (H checks HD)."));
	}
	async _deep() {
		let e = this._t, t = await this._findLong();
		if (this._long = t, !t) {
			this._log("D  skipped: no recording of 20 min or more in the last 7 days (events-only camera?)");
			return;
		}
		e.date !== t.date && await this._loadDay(t.date);
		let n = t.segment, r = S(n.end - n.start), i = (e) => `${S(e.time - n.start)} into a ${r} recording of ${t.date}` + (e.event ? ` (event ${e.event.types.join("+")} at ${X(e.event.start)})` : " (no event there: a point)"), a, o;
		if (t.cached) this._log("D1 skipped: every long recording looked at is cached already (try again after other recordings were viewed)");
		else {
			let r = C(n, t.day.events, .5, .95, .75), s = await this._play(r.time), c = s.held;
			s.ok && c?.complete === !1 && (a = e.metrics.firstFrameMs, o = s.served);
			let l = c?.complete ? "Not cached when chosen, but on disk when played (not counted)" : c?.bytes ? `Not cached (${x(c.bytes)} already fetched when played)` : "Not cached";
			this._log(`D1 ${l}, ${i(r)}: ${s.line}`), await Y(300), this._log(`     ${Ct(s.began, s.source)}`), this._log(`     ${s.busy}`), this._log(`     ${await this._fillReport()}`), this._log(`     ${re((await this._stats())?.vod.baichuan)}`);
		}
		await this._pause(1500);
		let s = C(n, t.day.events, .1, .45, .4), c = await this._play(s.time), l = c.held?.complete === !1, d = c.ok && !l ? e.metrics.firstFrameMs : void 0, p = t.cached ? "Cached when chosen, but not on disk when played" : "Still being copied when played";
		this._log(`D2 ${l ? `${p} (not counted)` : "Cached"}, ${i(s)}: ${c.line}`), await Y(300), this._log(`     ${Ct(c.began, c.source)}`), this._summary.push(`Deep start (sub, ${r} recording): not cached ${a === void 0 ? "not measured" : `${b(a)}${o ? ` from ${te(o)}` : ""}`}, cached ${N(d, 2e3)}`), this._plain.push(d === void 0 ? c.ok ? {
			grade: "fine",
			text: `Jumping into the middle of a long recording starts in ${u(e.metrics.firstFrameMs ?? 0)} (not judged: its copy was still being made).`
		} : {
			grade: "problem",
			text: "Jumping into the middle of a long recording did not play."
		} : {
			grade: f(d, 2e3, 4e3),
			text: `Jumping into the middle of a long recording starts in ${u(d)}` + (a === void 0 ? "." : `; the first time, ${u(a)}, while the recorder sends it over.`)
		});
	}
	async _advance() {
		let e = this._t, t = T(e.day?.segments ?? []);
		!t.length && e.date !== e.today && (await this._loadDay(e.today), t = T(e.day?.segments ?? []));
		let n = this._long, r = (n && n.date === e.day?.date ? t.find(([e]) => e.id === n.segment.id) : void 0) ?? t.at(0);
		if (!r) {
			this._log(`C  skipped: no two touching recordings on ${e.date}`);
			return;
		}
		let [i, a] = r, o = [], s = e.player, c = () => o.push("advanced"), l = () => o.push("ended");
		s?.addEventListener("rv-advanced", c), s?.addEventListener("rv-ended", l);
		try {
			await e.playAt(Math.max(i.start, i.end - 8e3), performance.now()), await this._wait(() => e.metrics.firstFrameMs !== void 0 || !!e.playFailure, 12e4);
			let t = await this._wait(() => e.player?.current?.segmentId === a.id && o.length > 0, 45e3);
			t && !o.includes("advanced") && await this._wait(() => e.metrics.firstFrameMs !== void 0 || !!e.playFailure, 6e4);
			let n = e.player, r;
			r = t ? o.includes("advanced") ? `yes (preloaded) · gap ${b(e.metrics.gapMs)}` : `yes, by reloading (the next file was not preloaded) · first frame ${b(e.metrics.firstFrameMs)}` : `no: on ${n?.current?.segmentId === i.id ? "the first" : n?.current ? "another" : "no"} recording at ${n?.time === void 0 ? "?" : X(n.time)}, ${n?.paused ? "paused" : "playing"}, next ${n?.preloaded ? "preloaded" : "not preloaded"}, events [${o.join(", ")}]`, this._log(`C  Moved on by itself at ${X(i.end)} (from a ${S(i.end - i.start)} recording): ${r}` + (e.playFailure ? ` FAILED: ${e.playFailure}` : "")), t || this._log(`     ${bt(e.player)}`), this._summary.push(`Auto-advance: ${t && o.includes("advanced") ? `gap ${b(e.metrics.gapMs)}` : r}`);
			let s = e.metrics.gapMs ?? 0;
			this._plain.push(t ? o.includes("advanced") ? {
				grade: s < 500 ? "good" : s < 2e3 ? "fine" : "slow",
				text: `It plays straight on from one recording to the next${s < 100 ? ", without a noticeable pause" : `, with a pause of ${u(s)}`}.`
			} : {
				grade: "fine",
				text: `It moves on to the next recording by itself, after ${u(e.metrics.firstFrameMs ?? 0)} to load it.`
			} : {
				grade: "problem",
				text: "It did not move on to the next recording by itself.",
				advice: "Press Next, or tap the timeline, to carry on."
			});
		} finally {
			s?.removeEventListener("rv-advanced", c), s?.removeEventListener("rv-ended", l);
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
		this._log(`R  Playback rates, ${S(r.end - r.start)} recording, ${Ie / 1e3} s each (sub stream):`);
		let a = [];
		try {
			for (let t of Fe) {
				let n = Q(e.player);
				if (!n) break;
				let r = await this._measureRate(n, t);
				if (a.push(r), this._log(`     ${D(r)}`), r.ended) break;
			}
		} finally {
			let t = Q(e.player);
			t && (t.playbackRate = 1);
		}
		this._summary.push(`Rates: ${a.map((e) => `${e.rate}× ${e.focused ? A(e) ? "✓" : "✗" : "– (not in front)"}`).join(" ") || "not measured"} (smooth = ${O})`), this._plain.push(...ee(a));
	}
	async _scrub() {
		let e = this._t.player, t = e?.current, n = Q(e);
		if (!e || !t || !n || e.time === void 0) {
			this._log("S  skipped: nothing playing");
			return;
		}
		await this._pause(3e3);
		let r = dt(e) ?? t.start, i = [], a = [], o = 0;
		for (let s of Ue) {
			let c = r + s * 1e3;
			if (c < t.start || c > t.end) continue;
			let l = performance.now(), u = ft(n, "seeked", 3e3);
			e.preview(c) ? await u && (i.push(performance.now() - l), o = Math.max(o, Math.abs((dt(e) ?? c) - c))) : a.push(s);
		}
		let s = r + We, c = s < t.end ? ` · ${S(We)} ahead: ${e.preview(s) ? "buffered, shown" : "not buffered (the thumbnail shows instead)"}` : "", l = i.length + a.length, d = i.length ? [...i].sort((e, t) => e - t)[Math.floor(i.length / 2)] : void 0;
		this._log(`S  Scrub preview (frames from the buffer while dragging): ${i.length} of ${l} points shown` + (d === void 0 ? "" : `, median ${b(d)}, each within ${(o / 1e3).toFixed(2)} s of its point`) + (a.length ? ` · not buffered: ${a.map((e) => `${e > 0 ? "+" : ""}${e} s`).join(", ")}` : "") + c), this._summary.push(`Scrub: ${i.length} of ${l} points in the buffer shown${d === void 0 ? "" : ` (median ${b(d)})`}`), l && this._plain.push(i.length === l ? {
			grade: f(d, 500, 1500),
			text: `Dragging along the timeline shows the video at once (in about ${u(d ?? 0)}).`
		} : {
			grade: "fine",
			text: `Dragging along the timeline shows the video at ${String(i.length)} of ${String(l)} points; elsewhere a thumbnail shows instead.`
		}), e.resume();
	}
	async _keyFrames() {
		let e = await this._keyLine("SD");
		this._log(`K  ${e.text}`), this._summary.push(`Key frames: ${e.short}`);
	}
	async _serverPictures() {
		let n = this._t, i = ie(n.day?.segments ?? [], qe);
		if (!i.length) {
			this._log("F  skipped: no recording on this day");
			return;
		}
		let a;
		try {
			let { url: e } = await t(n.hass, n.deviceId, n.date);
			a = new Se(new WebSocket(r(e, location.href))), await a.ready();
		} catch (t) {
			this._log(`F  the scrub session did not open: ${e(t).message}`), this._summary.push("Pictures from the server: the session did not open");
			return;
		}
		try {
			let e = [], t = await this._askPass(a, i, e), r = await this._askPass(a, i, []), o = await this._decodePictures(e), s = e.map((e) => (e.at - e.time) / 1e3), c = s.length ? ` · each ${Math.min(...s).toFixed(1)} to ${Math.max(...s).toFixed(1)} s before its moment` : "";
			this._log(`F  Pictures from the server (scrub, ${String(i.length)} moments over the day): first ${F(t)} · again ${F(r)}${c}${o}`);
			let l = n.day?.segments ?? [];
			(t.missedAt ?? []).forEach((e, n) => {
				this._log(`   no picture at ${X(e)}, ${P(l, e)}: ${t.missed[n] ?? "?"}`);
			}), this._summary.push(`Pictures from the server: first ${F(t)}; again ${F(r)}`);
		} finally {
			a.close();
		}
	}
	async _drag() {
		let e = this._t, t = e.scrubView, n = e.day;
		if (!t || !e.timeline || !e.player || !n?.segments.length) {
			this._log("P  skipped: no timeline or recording on screen");
			return;
		}
		let r = t.path, i = `painted with ${r.how}${r.why ? ` (${r.why})` : ""}`;
		if (r.how === "none") {
			this._log(`P  Pictures while dragging: not here (${r.why ?? "no way to paint"})`), this._summary.push("Dragging: no pictures in this browser"), this._plain.push({
				grade: "problem",
				text: "Dragging along the timeline cannot show pictures in this browser: it has neither WebCodecs nor MSE."
			});
			return;
		}
		let a = (await this._stats())?.vod.baichuan?.logins, o = await this._dragBuffered(), { stretch: s, other: c, cached: l } = await this._dragStretch();
		if (!s) {
			this._log("P  skipped: no recording to drag over on this day");
			return;
		}
		let d = this.timeScale, p = s.end - s.start, m = Math.min(G.spanMs, Math.max(5e3, (p - 15e3) / 2)), g = s.start + Math.min(5e3, p / 10), _ = e.player.current !== void 0, v = await this._dragPass(g, m, G.ms * d), y = e.hover?.bare === !0, x = Q(e.player)?.paused !== !1, C = await this._dragPass(g, m, G.ms * d), w = g + m + Ye, T = c ? await this._dragBeside(c, w, m) : void 0, E = w + m, D = oe(n.segments, E, E + Xe.spanMs), O = await this._dragPass(E, D - E, Xe.ms * d), k = await this._dragRelease(O.rest), ee = (await this._stats())?.vod.baichuan?.logins, A = a !== void 0 && ee !== void 0 ? ee - a : void 0, j = L(v), M = L(C), N = L(O), ne = l ? nt : tt, re = this._dragGrade(j, ne), ie = this._dragGrade(M, nt), P = ae(N), F = T?.pass ? L(T.pass) : void 0, I = T?.played ? T.played.longestStallMs < rt : void 0, z = (e) => e === void 0 ? "" : e ? " ✓" : " ✗", se = (e) => e === "good" || e === "fine";
		if (this._log(`P  Pictures while dragging (Phase 10): ${i} · over ${X(g)}, a recording ${l ? "already cached" : "not cached"}` + (e.scrub?.unavailable ? " · THE SCRUB SESSION DID NOT OPEN" : "")), this._log(`   slow (${S(m)} of recording in ${S(G.ms)}): ${R(j, v)}${z(se(re))}`), _ && this._log(`   this tab's video while dragging: ${x ? "paused" : "PLAYED ON"}${z(x)}`), this._log(`   again over the same stretch: ${R(M, C)}${z(se(ie))}`), this._log(`   ${this._besideText(T, F)}${z(I)}`), this._log(`   fast (${((e) => `${(e / 6e4).toFixed(1)} min`)(D - E)} in ${S(Xe.ms)}): ${R(N, O)}${z(P)}`), this._log(`   release: ${k.text}${z(k.ok)}`), k.firstMs !== void 0) {
			let t = e.metrics, n = e.player.mseStats?.atSource, r = t.urlMs ? e.playing?.timing?.total_ms : void 0;
			this._log(`     [URL ${b(t.urlMs)}${r === void 0 ? "" : ` (server ${b(r)})`}] ${t.delivery ?? "?"}${n ? ` · from ${te(n)}` : ""} · ${t.stream ?? "?"} ${t.codec ?? ""}`), this._releaseBusy && this._log(`     ${this._releaseBusy}`), this._log(`     ${await this._fillReport()}`);
		}
		this._log(`   over what the video has buffered: ${o.text}${z(o.ok)}`), this._log(`   hovering while dragging: ${y ? "the time alone, no thumbnail" : "a thumbnail was fetched"}${z(y)}`), A !== void 0 && this._log(`   the NVR: ${h(A, "more login")} while dragging${z(A <= 1)}`);
		let B = (e) => e.gapMs === void 0 ? "–" : u(e.gapMs);
		if (this._summary.push(`Dragging (${r.how}): slow ${String(j.pictures)} pictures every ${B(j)}; again every ${B(M)}; ` + (F && T?.played ? `beside another viewer every ${B(F)}, its longest stall ${S(T.played.longestStallMs)}; ` : "") + `fast ${P ? "caught up" : "did not catch up"}; release ${k.ok ? "held the picture" : "NOT CLEAN"}`), this._plain.push({
			grade: "note",
			text: r.how === "WebCodecs" ? "While dragging, pictures are decoded with WebCodecs." : `While dragging, pictures are played through MSE: ${r.why ?? ""}.`
		}), this._plain.push(j.pictures ? {
			grade: re,
			text: `Dragging over a recording ${l ? "already cached" : "not cached yet"} shows a new picture every ${B(j)}, ${String(j.onTime)} of ${String(j.pictures)} within the camera's key-frame interval of their moment.`
		} : {
			grade: "problem",
			text: `Dragging over a recording showed no picture (${String(v.asked)} asked, ${String(v.missed)} missed).`
		}), M.pictures && this._plain.push({
			grade: ie,
			text: `Dragging over the same stretch again shows a new picture every ${B(M)}.`
		}), this._plain.push({
			grade: P ? "good" : "slow",
			text: P ? `A fast drag catches up when the pointer stops (the last picture ${u(N.restMs ?? 0)} from it).` : "A fast drag did not catch up with the pointer when it stopped."
		}), this._plain.push({
			grade: k.ok ? f(k.firstMs, 1e3, 2500) : "problem",
			text: k.plain
		}), o.ok !== void 0 && this._plain.push({
			grade: o.ok ? "good" : "problem",
			text: o.ok ? "Over what the video has loaded, the video itself shows the moment." : "Over what the video has loaded, the server was asked anyway."
		}), _ && !x && this._plain.push({
			grade: "problem",
			text: "The video played on while dragging (a drag pauses it)."
		}), T?.played) {
			let e = F?.pictures ? ` (a new picture every ${B(F)} meanwhile)` : "";
			this._plain.push({
				grade: I ? "good" : "problem",
				text: I ? `Another viewer of this camera played on while dragging${e}.` : `Another viewer of this camera stalled ${u(T.played.longestStallMs)} while dragging${e}.`
			});
		}
		A !== void 0 && A > 1 && this._plain.push({
			grade: "problem",
			text: `Dragging logged in to the NVR ${String(A)} more times (at most 1 expected).`
		});
	}
	_dragGrade(e, t) {
		if (!e.pictures) return "problem";
		let n = f(e.gapMs, t, t * 2);
		return m([n, e.onTime >= e.pictures * .8 ? "good" : "slow"]);
	}
	async _dragPass(e, t, n) {
		let r = this._t, i = r.timeline, a = r.scrubView;
		if (!i || !a) return {
			movedMs: 0,
			rest: e,
			paints: [],
			asked: 0,
			missed: 0
		};
		let o = r.scrub?.counts, s = [], c = e, l = performance.now(), u = (e) => {
			let t = e.detail;
			s.push({
				wall: performance.now() - l,
				pointer: c,
				time: t.time,
				at: t.at,
				source: t.source,
				...t.interval === void 0 ? {} : { interval: t.interval }
			});
		};
		a.addEventListener("rv-scrub-painted", u);
		let d = Math.max(1, Math.round(n / (Je * this.timeScale))), f = i.clientWidth / 2, p;
		try {
			for (let r = 0; r <= d; r += 1) this._checkStopped(), c = e + t * r / d + et, i.dispatchEvent(new CustomEvent("rv-scrub", { detail: { time: c } })), r % $e === 0 && i.dispatchEvent(new CustomEvent("rv-hover", { detail: {
				time: c,
				x: f
			} })), await Y(n / d);
			p = performance.now() - l, await this._pause(Ze * this.timeScale);
		} finally {
			a.removeEventListener("rv-scrub-painted", u);
		}
		let m = r.scrub?.counts, h = (m?.asked ?? 0) - (o?.asked ?? 0), g = (m?.missed ?? 0) - (o?.missed ?? 0), _ = r.metrics.scrub?.last;
		return {
			movedMs: p,
			rest: c,
			paints: s,
			asked: h,
			missed: g,
			...g && !s.length && _ ? { lastMiss: _ } : {}
		};
	}
	async _dragBeside(t, n, r) {
		let i = this._t.openViewer();
		try {
			let a;
			try {
				a = await i.playAt(t.start + (t.end - t.start) * .6);
			} catch (t) {
				return {
					startMs: void 0,
					source: i.source,
					why: e(t).message
				};
			}
			if (a === void 0) return {
				startMs: a,
				source: i.source
			};
			let o = z(() => i.position), s = await this._dragPass(n, r, G.ms * this.timeScale);
			return {
				startMs: a,
				source: i.source,
				pass: s,
				played: o.stop()
			};
		} finally {
			i.close();
		}
	}
	_besideText(e, t) {
		if (!e) return "beside another viewer: none (no second recording not cached on this day)";
		let n = e.source ? `, from ${te(e.source)}` : "";
		if (!e.pass || !e.played || !t) return `beside another viewer: it did not start${n}${e.why ? ` (${e.why})` : ""}`;
		let { played: r } = e;
		return `beside another viewer (playing another recording${n}, started in ${b(e.startMs)}): ${R(t, e.pass)}; the viewer played ${S(r.playedMs)} in ${S(r.wallMs)}, longest stall ${S(r.longestStallMs)}`;
	}
	async _dragBuffered() {
		let e = this._t, t = e.player, n = e.timeline, r = e.scrubView, i = t?.time;
		if (!t || !n || !r || !t.current || i === void 0) return {
			text: "skipped, nothing playing",
			ok: void 0
		};
		let a = e.scrub?.counts.asked ?? 0, o = 0, s = 0;
		for (let e = 0; e < 8; e += 1) {
			this._checkStopped();
			let a = i - 3e3 + e * 750 + et;
			t.buffers(a) && (o += 1, n.dispatchEvent(new CustomEvent("rv-scrub", { detail: { time: a } })), await Y(120 * this.timeScale), r.showing || (s += 1));
		}
		n.dispatchEvent(new CustomEvent("rv-hover-end"));
		let c = (e.scrub?.counts.asked ?? 0) - a;
		return o ? {
			text: `${String(s)} of ${String(o)} moments shown by the video, ${h(c, "picture")} asked of the server`,
			ok: s === o && c === 0
		} : {
			text: "skipped, the video had nothing buffered around its time",
			ok: void 0
		};
	}
	async _dragStretch() {
		let e = this._t, t = e.player?.current?.segmentId, n = [...e.day?.segments ?? []].filter((e) => e.id !== t).sort((e, t) => t.end - t.start - (e.end - e.start)).slice(0, lt), r = [];
		for (let t of n) {
			this._checkStopped();
			let n = await this._peek(e.date, t.id);
			if (n && !n.cache?.complete && r.push(t), r.length >= 2) break;
		}
		let i = r.at(0) ?? n.at(0);
		return {
			stretch: i,
			other: r.find((e) => e !== i),
			cached: i !== void 0 && !r.includes(i)
		};
	}
	async _dragRelease(e) {
		let t = this._t, n = t.timeline, r = t.scrubView, i = t.player;
		if (!n || !r || !i) return {
			text: "skipped",
			plain: "Letting go was not measured.",
			ok: !1
		};
		let a = r.showing, o = r.shown, s = !1, c, l = performance.now(), d = new Promise((e) => {
			let t = setTimeout(() => {
				e(!1);
			}, Qe);
			i.addEventListener("rv-first-frame", () => {
				s = !0, clearTimeout(t), e(!0);
			}, { once: !0 });
		}), f = setInterval(() => {
			!s && c === void 0 && !r.showing && (c = performance.now() - l);
		}, 25);
		n.dispatchEvent(new CustomEvent("rv-seek", { detail: { time: e } }));
		let p = await d;
		clearInterval(f);
		let m = performance.now() - l, h = i.time;
		n.dispatchEvent(new CustomEvent("rv-hover-end"));
		let g = await this._busy();
		if (this._releaseBusy = g.text + (g.heldMs !== void 0 && g.heldMs >= it ? " · HOME ASSISTANT HELD UP" : ""), !p) return {
			text: `no first frame in ${S(Qe)}`,
			plain: "Letting go did not start the video.",
			ok: !1
		};
		if (!a) return {
			text: `the video's first frame after ${u(m)} (no picture was on screen at the release)`,
			plain: `Letting go starts the video in ${u(m)}.`,
			ok: !0,
			firstMs: m
		};
		if (c !== void 0) return {
			text: `the picture went ${u(m - c)} before the video's first frame (${u(m)})`,
			plain: `Letting go left the screen without a picture for ${u(m - c)} before the video started.`,
			ok: !1,
			firstMs: m
		};
		let _ = o && h !== void 0 ? `; it began ${u(Math.abs(h - o.time))} from the picture's own time (${((e, t) => `${u(Math.abs(e - t))} ${e <= t ? "before" : "after"}`)(o.time, e)} the pointer)` : "";
		return {
			text: `the picture stayed until the video's first frame, ${u(m)} after letting go${_}`,
			plain: `Letting go plays from there in ${u(m)}, the picture staying until the video shows.`,
			ok: !0,
			firstMs: m
		};
	}
	async _viewers() {
		let e = this._t;
		if (!e.day?.segments.length || !e.player) {
			this._log("V  skipped: no recording on screen");
			return;
		}
		let t = await this._uncached(2), n = t.at(0);
		if (!n) {
			this._log("V  skipped: no recording to play on this day");
			return;
		}
		let r = this.timeScale, i = await this._onlineUsers(), a = (e, t) => e.start + (e.end - e.start) * t, o = await this._play(a(n, .5)), s = await this._onlineUsers(), c = e.openViewer(), l, d, p, h, g;
		try {
			let i = z(() => Q(e.player)?.currentTime), o = t.at(1);
			l = await c.playAt(o ? a(o, .5) : a(n, .2)), await this._pause(at * r), p = await this._onlineUsers();
			let s = c.position;
			d = await c.playAt(a(n, .85)), await this._pause(at * r), g = c.position !== void 0 && (s === void 0 || c.position !== s), h = i.stop();
		} finally {
			c.close();
		}
		e.player.stop();
		let _ = await this._backAtRest(i, st * r), v = (e) => e.count === void 0 ? `? (${e.error ?? "not said"})` : String(e.count), y = (e) => e !== void 0 && e < K * 2, x = h.longestStallMs < rt, C = (e) => e === void 0 ? "" : e ? " ✓" : " ✗";
		this._log(`V  Two viewers on one camera (Phase 5): the NVR's users at rest ${v(i)}, with one viewer ${v(s)}, with two ${v(p)}`), this._log(`   the first viewer (this tab, ${X(a(n, .5))}): ${o.line}${C(o.ok)}`), this._log(`   the second viewer: first frame ${l === void 0 ? "none" : b(l)}${C(y(l))}; then far into the first one's recording: ${d === void 0 ? "none" : b(d)}${C(y(d) && g)}`), this._log(`   the first viewer meanwhile: played ${S(h.playedMs)} in ${S(h.wallMs)}, longest stall ${S(h.longestStallMs)}${C(x)}`), this._log(`   both stopped (the second as a closed tab): ${_.text}${C(_.ok)}`), this._summary.push(`Two viewers: first viewer's longest stall ${S(h.longestStallMs)}; second started in ${l === void 0 ? "–" : b(l)}, jumped in ${d === void 0 ? "–" : b(d)}; ${_.ok === void 0 ? "the NVR's list not read" : _.ok ? "the NVR back at rest" : "the NVR NOT back at rest"}`), this._plain.push({
			grade: x ? "good" : "problem",
			text: x ? "Two viewers on one camera play on: the first did not stall while the second started and jumped into its recording." : `With two viewers on one camera, the first stalled ${u(h.longestStallMs)} while the second started.`
		}), this._plain.push({
			grade: y(l) && y(d) ? m([f(l, K, K * 2), f(d, K, K * 2)]) : "problem",
			text: l === void 0 || d === void 0 ? "A second viewer of the same camera did not start." : `A second viewer of the same camera starts in ${u(l)}, and in ${u(d)} far into the first one's recording.`
		}), this._plain.push({
			grade: _.ok === void 0 ? "note" : _.ok ? "good" : "problem",
			text: _.plain
		});
	}
	async _uncached(e) {
		let t = this._t, n = t.player?.current?.segmentId, r = [...t.day?.segments ?? []].filter((e) => e.id !== n).sort((e, t) => t.end - t.start - (e.end - e.start)).slice(0, lt), i = [];
		for (let n of r) {
			this._checkStopped();
			let r = await this._peek(t.date, n.id);
			if (r && !r.cache?.complete && i.push(n), i.length >= e) break;
		}
		return i.length ? i : r.slice(0, e);
	}
	async _onlineUsers() {
		let t = this._t;
		try {
			let e = await t.hass.callWS({
				type: "reolink_viewer/playback/online_users",
				device_id: t.deviceId
			});
			return e.count === null ? { error: e.error ?? "not said" } : { count: e.count };
		} catch (t) {
			return { error: e(t).message };
		}
	}
	async _backAtRest(e, t) {
		let n = performance.now(), r, i;
		for (;;) {
			r = await this._onlineUsers(), i = (await this._stats())?.vod.baichuan?.logged_in;
			let a = e.count === void 0 || r.count !== void 0 && r.count <= e.count, o = i === void 0 || i === 0, s = performance.now() - n;
			if (e.count === void 0 && o) {
				let t = /unknown command/i.test(e.error ?? "") ? "Home Assistant runs an older Reolink Viewer than this page: restart it, then run the check again" : e.error ?? "not said";
				return {
					ok: void 0,
					text: `no Reolink protocol login left after ${u(s)}, but the NVR's list of users could not be read (${t})`,
					plain: `When both viewers stopped, no Reolink protocol login was left, but the NVR's list of users could not be read (${t}).`
				};
			}
			if (a && o) {
				let e = u(s);
				return {
					ok: !0,
					text: `back at rest after ${e} (the NVR lists ${r.count === void 0 ? "?" : String(r.count)}, no Reolink protocol login left)`,
					plain: `When both viewers stop, the NVR is back at rest within ${e}.`
				};
			}
			if (s >= t) break;
			await this._pause(Math.min(ot * this.timeScale, t - s));
		}
		let a = `the NVR lists ${r.count === void 0 ? "?" : String(r.count)} (${e.count === void 0 ? "?" : String(e.count)} at rest), ${i === void 0 ? "?" : String(i)} Reolink protocol login(s) left`;
		return {
			ok: !1,
			text: `NOT back at rest after ${S(t)}: ${a}`,
			plain: `When both viewers stopped, the NVR was not back at rest after ${u(t)}: ${a}.`
		};
	}
	async _askPass(e, t, n) {
		let r = {
			answered: [],
			missed: [],
			missedAt: []
		};
		for (let i of t) {
			this._checkStopped();
			let t = await e.ask(i);
			ve(t) ? (r.answered.push({
				ms: t.ms,
				source: t.source,
				offsetMs: t.at - t.time
			}), n.push(t)) : (r.missed.push(t.error), r.missedAt?.push(i));
		}
		return r;
	}
	async _decodePictures(e) {
		let t = e.filter((e) => e.kind === "fmp4");
		if (!t.length) return "";
		let n = [], r = !0;
		for (let e of t) {
			let t = le(e.init), i = e.codec ?? void 0, a = t ? ue(e.data, t) : [];
			if (!t || !i || !a.length) continue;
			let o = await he(i, t, a);
			if (r = o.available, !r) break;
			n.push(...o.decodeMs.slice(0, 1));
		}
		if (!r) return " · VideoDecoder absent";
		let i = [...n].sort((e, t) => e - t), a = i.length ? i[Math.floor((i.length - 1) / 2)] : void 0;
		return ` · VideoDecoder: ${String(n.length)} of ${String(t.length)} decode` + (a === void 0 ? "" : `, median ${a.toFixed(1)} ms each with its own decoder`);
	}
	async _keyLine(t) {
		let n = this._t.player, r = n?.current, i = r?.mse;
		if (!n || !r || !i) return {
			text: `${t} skipped: nothing playing through MSE (the file player has no fragments to read)`,
			short: `${t} skipped`
		};
		let a = Math.round(Math.max(0, (n.time ?? r.start) - r.start));
		try {
			let e = await i.fetch(`${i.base}/frags?at=${String(a)}&ms=${String(Ge)}&bytes=${String(Ke)}`), n = e.headers.get("X-RV-Source") ?? "file", r = await i.fetch(`${i.base}/init?source=${n}`);
			if (!e.ok || !r.ok) return {
				text: `${t}: the fragments did not come (HTTP ${String(e.status)}, init ${String(r.status)})`,
				short: `${t} not read`
			};
			let o = le(new Uint8Array(await r.arrayBuffer())), s = de(r.headers.get("X-RV-Mime") ?? "");
			if (!o || !s) return {
				text: `${t}: no video track in the init segment`,
				short: `${t} not read`
			};
			let c = ue(new Uint8Array(await e.arrayBuffer()), o);
			if (!c.length) return {
				text: `${t}: no key frame in ${S(Ge)} of fragments`,
				short: `${t}: none`
			};
			this._checkStopped();
			let l = _e(t, s, o, c, await he(s, o, c));
			return {
				text: `${l.text} · from the ${n}`,
				short: l.short
			};
		} catch (n) {
			if (n instanceof J) throw n;
			return {
				text: `${t}: ${e(n).message}`,
				short: `${t} failed`
			};
		}
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
		let r = e.day?.segments.find((e) => e.id === n.segmentId), i = r ? ` (${S((t.time ?? r.start) - r.start)} into a ${S(r.end - r.start)} recording)` : "", a = await this._switchTo("main");
		if (!a.ok) {
			this._log(`H  HD at ${X(a.at)}${i}: ${a.line}`), this._summary.push(`HD switch: ${a.line}`), this._plain.push({
				grade: "problem",
				text: "HD did not play; the viewer went back to SD.",
				advice: "SD still works. Include the details below if you report it."
			});
			return;
		}
		this._hdPlayed = !0, this._log(`H  HD at ${X(a.at)}${i}: ${a.line} · ${e.metrics.stream ?? "?"} ${e.metrics.codec ?? "?"} · ${e.metrics.delivery ?? "?"}`), this._log(`     ${await this._fillReport()}`);
		let o = await this._keyLine("HD");
		this._log(`     K ${o.text}`), this._summary.push(`Key frames: ${o.short}`), await this._pause(5e3);
		let s = await this._switchTo("sub");
		this._log(`     Back to SD at ${X(s.at)}: ${s.line}`), s.ok || this._log(`     ${bt(e.player)}`), this._summary.push(`HD switch: to HD ${a.short}; back to SD ${s.short}`), s.ok || this._plain.push({
			grade: "problem",
			text: `Going back from HD to SD failed (${s.line.replace(/^FAILED: /, "").replace(/ \(back on the sub stream\)$/, "")}).`,
			advice: "Pressing SD again, or playing another moment, plays it. Include the details below if you report it."
		}), this._plain.push({
			grade: m([f(a.ms, 3e3, 8e3), a.kept ? "good" : "fine"]),
			text: `Switching to HD takes ${u(a.ms ?? 0)}${a.kept ? " and keeps your place" : ", but starts at another moment"}${s.ok ? `; back to SD, ${u(s.ms ?? 0)}` : ""}.`
		});
	}
	async _switchTo(e) {
		let t = this._t, n = t.player, r = n?.time ?? 0, i = t.metrics.hdFailures ?? 0, a = () => (t.metrics.hdFailures ?? 0) > i;
		t.setStream(e);
		let o = await this._wait(() => t.metrics.stream === e && t.metrics.firstFrameMs !== void 0 || a() || !!t.playFailure, ct), s = a() ? t.metrics.lastHdFailure ?? "HD failed" : t.playFailure;
		if (!o || s) {
			let e = s ? `FAILED: ${s} (back on the sub stream)` : `no first frame within ${S(ct)}`;
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
			line: `first frame ${b(c)}, started ${l.toFixed(2)} s from where ${e === "main" ? "SD" : "HD"} was (${u})`,
			short: `${b(c)}, ${u} (${l.toFixed(2)} s)`
		};
	}
	async _measureRate(e, t) {
		e.playbackRate = t;
		let n = e.playbackRate;
		await this._pause(Le);
		let r = Z(), i = setInterval(() => {
			r &&= Z();
		}, 250), a = vt(e), o = e.currentTime, s = performance.now(), c = 0, l, u = 0, d = !1, f = () => {
			c += 1, l ??= performance.now();
		}, p = () => {
			l !== void 0 && (u += performance.now() - l), l = void 0;
		}, m = () => {
			d = !0;
		};
		e.addEventListener("waiting", f), e.addEventListener("playing", p), e.addEventListener("ended", m);
		let h = xt(e);
		try {
			await this._pause(Ie);
		} finally {
			clearInterval(i), h.stop(), e.removeEventListener("waiting", f), e.removeEventListener("playing", p), e.removeEventListener("ended", m);
		}
		l !== void 0 && (u += performance.now() - l);
		let g = vt(e);
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
			focused: r && Z()
		};
	}
	async _link() {
		let t = this._t, n = t.playing, r = t.hass.fetchWithAuth?.bind(t.hass), i = n?.base, a = n?.url ?? n?.clip_url, o, s = "of the cached recording";
		if (i && r ? (s = "of fragments", o = (e) => r(`${i}/frags?first=0&ms=${String(Ve)}&bytes=${String(ze)}`, {
			cache: "no-store",
			signal: e
		})) : a && (o = (e) => fetch(a, {
			headers: { Range: "bytes=0-33554431" },
			cache: "no-store",
			signal: e
		})), !o) {
			this._log("L  skipped: nothing played");
			return;
		}
		let c = performance.now(), l = new AbortController(), u = setTimeout(() => {
			l.abort();
		}, Be);
		try {
			let e = await o(l.signal), t = performance.now() - c, n = 0, r = e.body?.getReader();
			try {
				for (;;) {
					let e = await r?.read();
					if (!e || e.done) break;
					n += e.value.byteLength;
				}
			} catch {}
			let i = performance.now() - c, a = n * 8 / ((i - t) * 1e3);
			this._log(`L  Link to Home Assistant: ${x(n)} ${s} in ${b(i - t)} after the answer = ${a.toFixed(1)} Mbit/s (answer ${b(t)}, HTTP ${e.status})`), this._summary.push(`Link: ${a.toFixed(1)} Mbit/s`), this._plain.push({
				grade: a >= 16 ? "good" : a >= 4 ? "fine" : "slow",
				text: `Recordings come from Home Assistant at ${a.toFixed(0)} Mbit/s: ` + (a >= 16 ? "plenty for HD." : a >= 4 ? "enough for SD; HD may pause to load." : "SD may pause to load.")
			});
		} catch (t) {
			this._log(`L  Link test failed: ${e(t).message}`);
		} finally {
			clearTimeout(u);
		}
	}
	async _capabilities() {
		let e = this._t, t = {};
		try {
			t = await i(e.hass, e.deviceId);
		} catch {}
		let n = t.sub?.codec, r = t.main?.codec, a = (e) => [["sub", n], ["main", r]].map(([t, n]) => n ? `${t} ${n} ${mt(Te(e, n))}` : `${t} codec unknown (not cached yet)`).join(", "), o = ["MediaSource", "ManagedMediaSource"];
		this._log(`MSE: ${o.map((e) => W(e) ? `${e} present (${a(e)})` : `${e} absent`).join(" · ")}`);
		let s = [];
		for (let e of o) {
			if (!W(e)) continue;
			let t = Ee(e);
			if (!t) {
				this._log(`MSE probe (${e}): no sample codec supported`);
				continue;
			}
			let n = [];
			for (let { shape: r, label: i } of we) this._checkStopped(), n.push(`${i} ${await Ae(e, t.sample, r)}`);
			this._log(`MSE probe (${e}, ${t.name} sample): ${n.join(" · ")}`), s.push(`${e} ${n[0]?.includes("plays") ? "plays MSE-ready fragments" : "fails"}`);
		}
		this._summary.push(`MSE: ${s.join(", ") || "neither MediaSource nor ManagedMediaSource"}`);
		let c = document.createElement("video"), l = (e) => e ? `"${c.canPlayType(`video/mp4; codecs="${e}"`)}"` : "unknown";
		this._log(`Video: canPlayType sub ${l(n)}, main ${l(r)} · getVideoPlaybackQuality ${mt("getVideoPlaybackQuality" in c)} · requestVideoFrameCallback ${mt("requestVideoFrameCallback" in c)} · performance.memory ${mt(gt() !== void 0)}`), this._log(`HD as the tab opened: ${e.hd.reason}${this._hdPlayed ? " (played in H above)" : ""}`), t.main?.width && t.main.height && r && this._log(`HD decodingInfo for ${r} at ${t.main.width}×${t.main.height}: ${await wt(r, t.main.width, t.main.height)}`), this._hdPlayed || this._summary.push(`HD: ${e.hd.main ? "offered" : "not offered"} (${e.hd.reason})`), e.hd.main || this._plain.push({
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
		this._log(`M  One-hour session: playing from ${X(i.start)} on ${r} for ${t} min, a sample a minute`);
		let a = e.player, o = 0, s = 0, c = [], l = () => {
			o += 1;
		}, u = (e) => {
			s += 1, c.push(e.detail.gapMs);
		}, d = [...a?.renderRoot.querySelectorAll("video") ?? []], f = [], p = [], m = 0, g = new _t(), _ = { minute: !0 }, v = setInterval(() => {
			_.minute &&= Z();
		}, 1e3), y = performance.now();
		try {
			await this._play(i.start), d.forEach((e) => {
				e.addEventListener("waiting", l);
			}), a?.addEventListener("rv-advanced", u);
			for (let n = 1; n <= t; n += 1) {
				if (await this._pause(Re), e.player?.paused && document.visibilityState === "visible") {
					let t = e.day?.segments[0];
					this._log(`M  ${n} min: playback had stopped${e.playFailure ? ` (${e.playFailure})` : ""}; starting again from the day's first recording`), t && await e.playAt(t.start, performance.now());
				}
				let t = Q(e.player), r = g.update(d), i = _.minute && Z();
				_.minute = !0;
				let a = t ? Math.max(0, yt(t) - t.currentTime) : 0;
				m = Math.max(m, a);
				let c = gt();
				c !== void 0 && f.push([(performance.now() - y) / 36e5, c]);
				let l = await this._stats();
				l?.vod.disk_bytes !== void 0 && p.push(l.vod.disk_bytes);
				let u = d.reduce((e, t) => e + M(t.buffered), 0);
				this._log(`M  ${n} min: ${e.player?.time === void 0 ? "?" : X(e.player.time)} ${e.player?.paused ? "paused" : "playing"}` + (document.visibilityState === "visible" ? "" : " (page hidden: the system pauses video)") + (i ? "" : " · PAGE NOT IN FRONT this minute") + ` · heap ${c === void 0 ? "n/a" : x(c)} · ${a.toFixed(0)} s ahead, ${u.toFixed(0)} s buffered in both videos · dropped ${r} this minute, ${g.dropped} of ${g.decoded} in all · ${o} stalls · ${s} file changes` + (e.metrics.recoveries ? ` · ${e.metrics.recoveries} reloads mid-way` : "") + (l ? ` · cache ${x(l.vod.disk_bytes)} on disk + ${x(l.vod.reserved_bytes)} reserved, ${l.vod.leased ?? "?"} leased` : "")), Et(this.id, this.options.setup, n);
			}
		} finally {
			clearInterval(v), d.forEach((e) => {
				e.removeEventListener("waiting", l);
			}), a?.removeEventListener("rv-advanced", u);
		}
		let S = j(f), C = f.length ? `heap ${x(f[0]?.[1])} → ${x(f.at(-1)?.[1])} (max ${x(Math.max(...f.map(([, e]) => e)))}${S === void 0 ? "" : `, ${S >= 0 ? "+" : ""}${x(S)}/h`})` : "heap not measurable in this browser (the page was not reloaded)", w = (await this._stats())?.vod.max_bytes, T = p.length ? `cache ${x(Math.min(...p))}–${x(Math.max(...p))} on disk (cap ${x(w)})` : "cache use unknown", E = `${t} min: ${C}, at most ${m.toFixed(0)} s buffered ahead, ${g.dropped} of ${g.decoded} frames dropped, ${o} stalls, ${s} file changes${c.length ? ` (gaps ${c.map((e) => b(e)).join(", ")})` : ""}, ${e.metrics.recoveries ?? 0} reloads mid-way, ${T}`;
		this._log(`M  Summary: ${E}`), this._summary.push(`Session: ${E}`);
		let D = g.decoded ? g.dropped / g.decoded : 0, O = e.metrics.recoveries ?? 0;
		this._plain.push({
			grade: !o && !O && D < .005 ? "good" : o <= 2 && D < .02 ? "fine" : "slow",
			text: `Played for ${h(t, "minute")}: ` + [
				o ? `it paused to load ${h(o, "time")}` : "it never paused to load",
				g.decoded ? `${D < .001 ? "no" : `${(D * 100).toFixed(1)}% of`} frames skipped` : void 0,
				O ? `reloaded ${h(O, "time")}` : void 0
			].filter(Boolean).join(", ") + "."
		});
	}
	async _busy() {
		let e = await this._stats(), t = e?.loop?.held_10s_ms ?? void 0, n = e?.vod, r = [t === void 0 ? "its event loop not measured (Home Assistant runs an older Reolink Viewer)" : `its event loop held up to ${b(t)} in the last 10 s`];
		n?.filling !== void 0 && r.push(`${h(n.filling, "download")} from the recorder` + (n.prefetching ? ` (${String(n.prefetching)} for no viewer: next files, warm hours)` : "")), n?.rewriting && r.push(h(n.rewriting, "plain-copy rewrite"));
		let i = (e?.loop?.held_by ?? []).filter((e) => e.ago_s <= 10 && e.where.length).reduce((e, t) => e && e.seen_ms >= t.seen_ms ? e : t, void 0), a = i ? i.where.slice(0, 2).join(" ← ") : void 0;
		return a && r.push(`held by ${a}`), t !== void 0 && t >= it && this._noteBusy(t, a), {
			text: `Home Assistant: ${r.join(" · ")}`,
			heldMs: t
		};
	}
	_noteBusy(e, t) {
		this._rowName && this._busyRows.add(this._rowName), e > this._busiest && (this._busiest = e, this._busiestBy = t);
		let n = [...this._busyRows], r = `Home Assistant itself was busy during starts${n.length ? ` in ${n.length === 1 ? "row" : "rows"} ${n.join(", ")}` : ""}: its event loop was held up to ${u(this._busiest)}${this._busiestBy ? `, by ${this._busiestBy}` : ""}, so it answered late.`;
		this._busyNote ? this._busyNote.text = r : (this._busyNote = {
			grade: "note",
			text: r
		}, this._plain.push(this._busyNote));
	}
	async _stats() {
		try {
			return await this._t.hass.callWS({ type: "reolink_viewer/playback/stats" });
		} catch {
			return;
		}
	}
}, mt = (e) => e === void 0 ? "n/a" : e ? "yes" : "no", Z = () => document.visibilityState === "visible" && document.hasFocus(), ht = (e) => typeof e == "string" || typeof e == "number" ? String(e) : "?";
function gt() {
	return performance.memory?.usedJSHeapSize;
}
var _t = class {
	decoded = 0;
	dropped = 0;
	_last = /* @__PURE__ */ new Map();
	update(e) {
		let t = this.dropped;
		for (let t of e) {
			let e = vt(t);
			if (!e) continue;
			let n = this._last.get(t), r = !n || e.totalVideoFrames < n.totalVideoFrames;
			this.decoded += r ? e.totalVideoFrames : e.totalVideoFrames - n.totalVideoFrames, this.dropped += r ? e.droppedVideoFrames : e.droppedVideoFrames - n.droppedVideoFrames, this._last.set(t, e);
		}
		return this.dropped - t;
	}
};
function vt(e) {
	return typeof e.getVideoPlaybackQuality == "function" ? e.getVideoPlaybackQuality() : void 0;
}
function yt(e) {
	let t = e.buffered;
	for (let n = 0; n < t.length; n += 1) if (t.start(n) <= e.currentTime + .5 && t.end(n) >= e.currentTime) return t.end(n);
	return e.currentTime;
}
function bt(e) {
	let t = Q(e);
	if (!t) return "video: none on screen";
	let n = [];
	for (let e = 0; e < t.buffered.length; e += 1) n.push(`${t.buffered.start(e).toFixed(1)}–${t.buffered.end(e).toFixed(1)} s`);
	let r = t.error ? `, error ${String(t.error.code)}${t.error.message ? ` (${t.error.message})` : ""}` : "", i = e?.mseStats;
	return `video: at ${t.currentTime.toFixed(1)} s of ${Number.isFinite(t.duration) ? t.duration.toFixed(1) : String(t.duration)} s, ready state ${String(t.readyState)}, network ${String(t.networkState)}, ${t.paused ? "paused" : "not paused"}${t.ended ? ", ended" : ""}${t.seeking ? ", seeking" : ""}, buffered [${n.join(", ") || "nothing"}]${r}` + (i ? ` · MSE (${i.api}): ${String(i.windows)} windows, ${x(i.bytes)}, from the ${i.source}, ${i.fetching ? "fetching" : "not fetching"}, ${i.ahead.toFixed(1)} s ahead` : " · not through MSE");
}
function Q(e) {
	return e?.renderRoot.querySelector("video.active") ?? null;
}
function xt(e) {
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
function St(e, t) {
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
function Ct(e, t) {
	let n = t ? new URL(t, location.href).pathname : "", r = performance.getEntriesByType("resource").filter((t) => (t.initiatorType === "video" || t.initiatorType === "fetch" && t.name.includes("/api/reolink_viewer/mse/")) && t.startTime >= e - 5);
	if (!r.length) return "requests: none reported (this browser may not report video requests)";
	let i = r.filter((e) => e.requestStart > 0), a = i.slice(0, 10).map((t, r) => {
		let i = n && new URL(t.name).pathname.startsWith(n) ? "" : " (other file)", a = t.encodedBodySize ? ` · ${x(t.encodedBodySize)}` : "", o = t.serverTiming?.find((e) => e.name === "rv")?.duration;
		return `#${r + 1}${i} +${Math.round(t.startTime - e)} ms: wait ${Math.round(t.requestStart - t.startTime)} · answer ${Math.round(t.responseStart - t.requestStart)}${o === void 0 ? "" : ` (server ${Math.round(o)})`} · ran ${Math.round(t.responseEnd - t.responseStart)} ms${a}`;
	}), o = i.length > 10 ? ` | … ${i.length - 10} more` : "", s = r.length - i.length, c = [...new Set(i.map((e) => e.nextHopProtocol).filter(Boolean))].join("/");
	return `requests${c ? ` (${c})` : ""}: ${i.length} sent${s ? `, ${s} cancelled before sending` : ""}: ${a.join(" | ")}${o}`;
}
async function wt(t, n, r) {
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
function Tt(e) {
	if (!e) return "?";
	let t = [e.cache ?? "?"];
	e.age_s !== void 0 && t.push(`${ht(e.age_s)} s old`);
	for (let [n, r] of [
		["queue_ms", "queue"],
		["files_ms", "recordings"],
		["events_ms", "events"],
		["total_ms", "total"]
	]) {
		let i = e[n];
		typeof i == "number" && t.push(`${r} ${b(i)}`);
	}
	return typeof e.warm == "string" && t.push(`background fetch: ${e.warm}`), t.join(", ");
}
function $() {
	try {
		return window.localStorage;
	} catch {
		return;
	}
}
function Et(e, t, n) {
	try {
		let r = $()?.getItem(q), i = {
			id: e,
			setup: t,
			started: r ? JSON.parse(r).started : (/* @__PURE__ */ new Date()).toISOString(),
			updated: (/* @__PURE__ */ new Date()).toISOString(),
			...n ? { minute: n } : {}
		};
		$()?.setItem(q, JSON.stringify(i));
	} catch {}
}
function Dt(e) {
	try {
		let t = $()?.getItem(q);
		t && JSON.parse(t).id === e && $()?.removeItem(q);
	} catch {}
}
async function Ot(e) {
	let t;
	try {
		let e = $()?.getItem(q);
		if (!e) return;
		t = JSON.parse(e), $()?.removeItem(q);
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
var kt = (e) => e.callWS({ type: "reolink_viewer/playback/check_reports" });
//#endregion
export { Ot as a, ue as c, y as d, _ as f, Pe as i, le as l, Ne as n, Se as o, v as p, kt as r, ve as s, pt as t, pe as u };

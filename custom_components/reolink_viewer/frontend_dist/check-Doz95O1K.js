import { Ft as e, Pt as t, bt as n, et as r, h as i, ht as a } from "./live-BazhJ5O3.js";
import { a as o, n as s, o as c, r as l, s as u, t as d } from "./findings-DsjCt-Hh.js";
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
function ee(e, t) {
	return e.filter((e) => e.end - e.start >= 12e5 && t - e.end > 6e4).sort((e, t) => t.start - e.start);
}
function b(e) {
	let t = [];
	return e.forEach((n, r) => {
		let i = e.at(r + 1);
		i && i.start - n.end < 2e3 && t.push([n, i]);
	}), t.sort((e, t) => e[0].end - e[0].start - (t[0].end - t[0].start));
}
function x(e) {
	return e.decoded && e.mediaS > 0 ? e.decoded / e.mediaS : void 0;
}
function te(e) {
	let t = [`${(e.wallMs > 0 ? e.mediaS * 1e3 / e.wallMs : 0).toFixed(2)}× effective`];
	e.applied !== e.rate && t.push(`browser set ${e.applied}×`);
	let n = x(e);
	if (e.painted !== void 0) {
		let r = `${(e.painted * 1e3 / e.wallMs).toFixed(0)} fps painted`;
		t.push(n ? `${r} of ${(n * e.rate).toFixed(0)}` : r);
	}
	if (e.maxGapMs !== void 0 && t.push(`longest frame gap ${Math.round(e.maxGapMs)} ms`), e.decoded !== void 0 && e.dropped !== void 0) {
		let n = e.decoded ? (e.dropped * 100 / e.decoded).toFixed(1) : "0.0";
		t.push(`dropped ${e.dropped} of ${e.decoded} frames (${n} %)`);
	}
	return t.push(`${e.stalls} stalls${e.stalls ? ` (${Math.round(e.stalledMs)} ms)` : ""}`), e.ended && t.push("the file ended"), C(e) || t.push("the dropped-frame counter disagrees with the frames painted: judged by those"), e.focused || t.push("PAGE NOT IN FRONT"), `${String(e.rate).padStart(3)}×: ${t.join(", ")}`;
}
var S = "on pace (±10 %), stalls under 100 ms, no frame gap over 2.5 frames (250 ms at least); below 50 fps to show, ≤ 2 % (or 1 frame) dropped, or 90 % painted where the dropped-frame counter disagrees with the frames painted";
function C(e) {
	if (e.painted === void 0 || e.decoded === void 0 || e.dropped === void 0) return !0;
	let t = e.decoded - e.dropped;
	return Math.abs(t - e.painted) <= Math.max(3, e.decoded * .1);
}
function w(e) {
	let t = e.wallMs > 0 ? e.mediaS * 1e3 / e.wallMs : 0;
	if (Math.abs(t - e.rate) > e.rate * .1 || e.stalledMs >= 100) return !1;
	let n = x(e), r = n === void 0 ? void 0 : n * e.rate;
	if (r !== void 0 && e.maxGapMs !== void 0) {
		let t = Math.max(250, 2500 / Math.min(r, 60));
		if (e.maxGapMs > t) return !1;
	}
	return r === void 0 || r > 50 ? !0 : !C(e) && e.painted !== void 0 ? e.painted * 1e3 / e.wallMs >= r * .9 : !e.decoded || (e.dropped ?? 0) <= Math.max(1, e.decoded * .02);
}
function ne(e) {
	if (e.length < 2) return;
	let t = e.length, n = e.reduce((e, [t]) => e + t, 0) / t, r = e.reduce((e, [, t]) => e + t, 0) / t, i = 0, a = 0;
	for (let [t, o] of e) i += (t - n) * (o - r), a += (t - n) ** 2;
	return a ? i / a : void 0;
}
function re(e) {
	let t = 0;
	for (let n = 0; n < e.length; n += 1) t += e.end(n) - e.start(n);
	return t;
}
var T = (e, t) => e === void 0 ? "not measured" : `${g(e)} ${e < t ? "✓" : "✗"}`;
function E(e) {
	return e === "cut" ? "the Reolink protocol cut" : e === "file" ? "the recording's download" : "?";
}
function ie(e) {
	let t = [];
	typeof e.first_fragment_ms == "number" && t.push(`first fragment ${Math.round(e.first_fragment_ms)} ms`), typeof e.slot_ms == "number" && t.push(`slot ${Math.round(e.slot_ms)} ms${e.borrowed ? " (the download's)" : ""}`), e.login === "new" ? t.push(`login (an extra user)${typeof e.login_ms == "number" ? ` ${Math.round(e.login_ms)} ms` : ""}`) : e.login && t.push("login shared"), typeof e.reply_ms == "number" && t.push(`reply ${Math.round(e.reply_ms)} ms`), e.gave_way && t.push(`gave way to another viewer ${String(e.gave_way)}×`), t.push(`${e.fragments ?? 0} fragments, ${((e.bytes ?? 0) / 1e6).toFixed(1)} MB`), typeof e.mbit_s == "number" && t.push(`${e.mbit_s} Mbit/s`), t.push(e.error ? `error ${e.error}` : e.complete ? "complete" : e.running ? "running" : "stopped");
	let n = e.mux;
	if (n) {
		let e = n.rate_source ?? (n.rate_learned ? "learned" : "nominal");
		t.push(`placed by ${n.anchor ?? "?"}, counter ${n.counter_rate ?? "?"}/s${e === "nominal" ? "" : ` (${e})`}`);
	}
	return typeof e.mux_ms == "number" && t.push(`mux ${Math.round(e.mux_ms)} ms`), `Reolink protocol cut: ${t.join(", ")}`;
}
function ae(e) {
	return e ? e.enabled ? `Reolink protocol: ${e.logged_in} host(s) logged in now, ${e.logins} logins, ${e.logouts} logouts, ${e.cuts_running} cuts running` + (e.unsupported?.length ? `; not supported by ${String(e.unsupported.length)} device(s): ${e.unsupported.join("; ")}` : "") : "Reolink protocol: off (turned off in the options)" : "Reolink protocol: no statistics";
}
//#endregion
//#region src/playback/keyframes.ts
var oe = 65536;
function* D(e, t, n) {
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
function O(e, t, n, r = 0) {
	for (let i of D(e, t.body + r, t.end)) if (i.type === n) return i;
}
function k(e, t, ...n) {
	let r = t;
	for (let t of n) {
		if (!r) return;
		r = O(e, r, t);
	}
	return r;
}
function se(e) {
	let t = new DataView(e.buffer, e.byteOffset, e.byteLength), n = [...D(e, 0, e.length)].find((e) => e.type === "moov");
	if (n) for (let r of D(e, n.body, n.end)) {
		if (r.type !== "trak") continue;
		let i = k(e, r, "mdia", "hdlr");
		if (!i || String.fromCharCode(...e.subarray(i.body + 8, i.body + 12)) !== "vide") continue;
		let a = O(e, r, "tkhd"), o = k(e, r, "mdia", "mdhd"), s = k(e, r, "mdia", "minf", "stbl", "stsd");
		if (!a || !o || !s) continue;
		let c = t.getUint32(a.body + (e[a.body] === 1 ? 20 : 12)), l = t.getUint32(o.body + (e[o.body] === 1 ? 20 : 12)), u;
		for (let t of D(e, s.body + 8, s.end)) {
			u = t;
			break;
		}
		if (!u) continue;
		let d = [...D(e, u.body + 78, u.end)].find((e) => e.type === "avcC" || e.type === "hvcC"), f = {
			trackId: c,
			timescale: l,
			entry: u.type,
			description: d ? e.slice(d.body, d.end) : void 0,
			width: t.getUint16(u.body + 24),
			height: t.getUint16(u.body + 26),
			defaultDuration: 0,
			defaultSize: 0,
			defaultFlags: 0
		}, p = O(e, n, "mvex");
		for (let n of p ? D(e, p.body, p.end) : []) n.type === "trex" && t.getUint32(n.body + 4) === c && (f.defaultDuration = t.getUint32(n.body + 12), f.defaultSize = t.getUint32(n.body + 16), f.defaultFlags = t.getUint32(n.body + 20));
		return f;
	}
}
function ce(e, t) {
	let n = new DataView(e.buffer, e.byteOffset, e.byteLength), r = [];
	for (let i of D(e, 0, e.length)) if (i.type === "moof") for (let a of D(e, i.body, i.end)) {
		if (a.type !== "traf") continue;
		let o = O(e, a, "tfhd");
		if (!o || n.getUint32(o.body + 4) !== t.trackId) continue;
		let s = n.getUint32(o.body) & 16777215;
		if (s & 1) continue;
		let c = o.body + 8;
		s & 2 && (c += 4);
		let l = t.defaultDuration, u = t.defaultSize, d = t.defaultFlags;
		s & 8 && (l = n.getUint32((c += 4) - 4)), s & 16 && (u = n.getUint32((c += 4) - 4)), s & 32 && (d = n.getUint32(c));
		let f = O(e, a, "tfdt"), p = f ? e[f.body] === 1 ? Number(n.getBigUint64(f.body + 4)) : n.getUint32(f.body + 4) : 0, m = i.start;
		for (let o of D(e, a.body, a.end)) {
			if (o.type !== "trun") continue;
			let a = n.getUint32(o.body) & 16777215, s = n.getUint32(o.body + 4), c = o.body + 8;
			a & 1 && (m = i.start + n.getInt32((c += 4) - 4));
			let f;
			a & 4 && (f = n.getUint32((c += 4) - 4));
			for (let i = 0; i < s; i += 1) {
				let o = a & 256 ? n.getUint32((c += 4) - 4) : l, s = a & 512 ? n.getUint32((c += 4) - 4) : u, h = a & 1024 ? n.getUint32((c += 4) - 4) : d;
				a & 2048 && (c += 4), i === 0 && f !== void 0 && (h = f), !(h & oe) && m + s <= e.length && r.push({
					timeS: p / t.timescale,
					data: e.subarray(m, m + s)
				}), m += s, p += o;
			}
		}
	}
	return r;
}
function le(e) {
	return (/codecs="([^"]*)"/.exec(e)?.[1] ?? "").split(",").map((e) => e.trim()).find((e) => /^(avc|hev|hvc)/.test(e));
}
var A = 3e3;
function ue() {
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
async function de(e, t, n, r = ue()) {
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
					n(/* @__PURE__ */ Error(`no frame within ${String(A)} ms`));
				}, A);
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
var j = (e) => `${e.toFixed(1)} ms`;
function M(e) {
	if (!e.length) return;
	let t = [...e].sort((e, t) => e - t), n = Math.floor(t.length / 2);
	return t.length % 2 ? t[n] : ((t[n - 1] ?? 0) + (t[n] ?? 0)) / 2;
}
var N = (e) => `${String(Math.round(e / 1024))} KB`;
function fe(e, t, n, r, i) {
	let a = r.map((e) => e.data.length), o = M(r.slice(1).map((e, t) => e.timeS - (r[t]?.timeS ?? e.timeS)).filter((e) => e > 0)), s = r.length > 1 ? (r.at(-1)?.timeS ?? 0) - (r[0]?.timeS ?? 0) : 0, c = `${e} ${t} ${String(n.width)}×${String(n.height)}: ${String(r.length)} key frame${r.length === 1 ? "" : "s"}` + (r.length > 1 ? ` in ${s.toFixed(1)} s of media, every ${(o ?? 0).toFixed(1)} s` : "") + (a.length ? `, ${N(Math.min(...a))}–${N(Math.max(...a))} (median ${N(M(a) ?? 0)})` : "");
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
	let [l, ...u] = i.decodeMs, d = M(u.length ? u : i.decodeMs), f = M(i.drawMs), p = d !== void 0 && d <= 30;
	return {
		text: `${c} · ${d === void 0 ? `VideoDecoder decoded none${i.error ? ` (${i.error})` : ""}` : `VideoDecoder: one in ${j(d)} (median of ${String(u.length || i.decodeMs.length)}${u.length ? `; the first ${j(l)}` : ""})` + (f === void 0 ? "" : `, drawn on a canvas in ${j(f)}`) + (i.width ? ` at ${String(i.width)}×${String(i.height ?? 0)}` : "") + (i.error ? ` · then failed: ${i.error}` : "") + ` · gate 30 ms: ${p ? "passes" : "fails"}`}`,
		short: d === void 0 ? `${e}: none decoded` : `${e} ${j(d)} to decode (VideoDecoder)${o ? `, every ${o.toFixed(1)} s` : ""}`,
		decodeMs: d
	};
}
//#endregion
//#region src/playback/mse-sample.ts
var pe = {
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
}, me = [
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
function P(e) {
	let t = window[e];
	return typeof t == "function" ? t : void 0;
}
function he(e, t) {
	let n = P(e);
	if (n) try {
		return n.isTypeSupported(`video/mp4; codecs="${t}"`);
	} catch {
		return !1;
	}
}
function ge(e) {
	for (let [t, n] of Object.entries(pe)) if (he(e, n.codec)) return {
		name: t,
		sample: n
	};
}
var F = (e) => Uint8Array.from(atob(e), (e) => e.charCodeAt(0));
function _e(e, t) {
	let n = new Uint8Array(e.length + t.length);
	return n.set(e), n.set(t, e.length), n;
}
function I(e, t) {
	return new Promise((n, r) => {
		let i = () => {
			e.removeEventListener("updateend", i), e.removeEventListener("error", a), n();
		}, a = () => {
			e.removeEventListener("updateend", i), e.removeEventListener("error", a), r(/* @__PURE__ */ Error("append error"));
		};
		e.addEventListener("updateend", i), e.addEventListener("error", a), e.appendBuffer(t);
	});
}
async function ve(e, t, n, r = 5e3) {
	let i = P(e);
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
						await I(i, F(t.init)), await I(i, _e(F(t[n]), F(t.mdat)));
					} catch {
						e("append error");
						return;
					}
					if (!i.buffered.length) e("appended, nothing buffered");
					else {
						try {
							s.endOfStream();
						} catch {}
						e(await ye(o, r) ? `plays (${Math.round(performance.now() - a)} ms)` : "buffered, does not play");
					}
				})();
			}, { once: !0 });
		});
		return o.src = c, await e;
	} finally {
		clearTimeout(l), o.removeAttribute("src"), o.load(), o.remove(), URL.revokeObjectURL(c);
	}
}
function ye(e, t) {
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
var be = "0.5.0", xe = [
	"Desktop Chrome, LAN",
	"Desktop Chrome, Tailscale",
	"Desktop Chrome, Nabu Casa",
	"iPhone app, Wi-Fi (local)",
	"iPhone app, Tailscale",
	"iPhone app, Nabu Casa",
	"Other"
];
function Se(e) {
	return !/Tailscale|Nabu Casa/.test(e);
}
var Ce = [
	.5,
	1,
	2,
	4,
	8
], L = 6e3, we = 1e3, Te = 6e4, Ee = 33554432, De = 3e3, Oe = 3e5, ke = 1e4, Ae = [
	-10,
	-5,
	3,
	8,
	15
], R = 6e5, z = 2e4, je = 8388608, B = 3e5, Me = 15, Ne = 7, V = "reolink-viewer-check-running", H = class extends Error {}, U = (e) => new Promise((t) => setTimeout(t, e)), Pe = (e) => e.time;
function Fe(e, t, n) {
	return new Promise((r) => {
		let i = setTimeout(() => {
			e.removeEventListener(t, a), r(!1);
		}, n), a = () => {
			clearTimeout(i), r(!0);
		};
		e.addEventListener(t, a, { once: !0 });
	});
}
var W = (e) => new Date(e).toLocaleTimeString(), Ie = class {
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
		this.running = !0, He(this.id, this.options.setup);
		try {
			await this._header(), this._sd(), await this._timelines(), await this._events(), await this._deep(), await this._advance(), await this._rates(), await this._scrub(), await this._keyFrames(), await this._switchHd(), await this._link(), await this._capabilities(), this.options.soakMinutes > 0 && await this._soak();
			for (let e of s(this.inShort(!0))) this._log(e);
			this._log(""), this._log("Summary:");
			for (let e of this._summary) this._log(`- ${e}`);
		} catch (e) {
			this._log(e instanceof H ? "Stopped." : `Check failed: ${t(e).message}`);
		} finally {
			this._t.player?.pause(), this.running = !1, this._log(`Done at ${(/* @__PURE__ */ new Date()).toLocaleTimeString()}.`), await this._save(!0), Ue(this.id);
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
		this.lines.push(e), this._onChange(), performance.now() - this._lastSave > ke && this._save(!1);
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
		if (this._stopped) throw new H();
	}
	async _wait(e, t) {
		let n = performance.now() + t;
		for (; performance.now() < n;) {
			if (this._checkStopped(), e()) return !0;
			await U(100);
		}
		return e();
	}
	async _pause(e) {
		let t = performance.now() + e;
		for (; performance.now() < t;) this._checkStopped(), await U(Math.min(250, t - performance.now()));
	}
	async _header() {
		let e = this._t, t = navigator.connection;
		this._log(`Reolink Viewer playback check v${be} · ${this.options.setup} · ${e.cameraName} · ${(/* @__PURE__ */ new Date()).toLocaleString()}`), this._log(`Browser: ${h(navigator.userAgent)} · page ${i(location.hostname)} over ${location.protocol.replace(":", "")} · screen ${screen.width}×${screen.height} @${window.devicePixelRatio}x` + (t?.effectiveType ? ` · network ${t.effectiveType}, ${t.downlink ?? "?"} Mbit/s (browser estimate)` : ""));
		let n = performance.getEntriesByType("navigation")[0];
		this._log(`User agent: ${navigator.userAgent}`), this._log(`Connection: page loaded over ${n?.nextHopProtocol || "? (from the app's cache)"}; each video request line gives its own (h2/h3 share one connection; http/1.1 allows 6 at once)`), this._log(`Player: ${e.mode} · file player delivery: ${e.progressive ? "progressive" : "whole file first (WebKit)"}`), this._summary.push(`Player: ${e.mode}`), await this._wait(() => !!e.day && !e.loading, 3e4);
	}
	async _loadDay(e) {
		let t = this._t, n = t.metrics.timelineMs;
		return t.selectDate(e), await this._wait(() => !t.loading && t.day?.date === e && t.metrics.timelineMs !== n, 6e4), t.metrics;
	}
	async _timelines() {
		let e = this._t, t = e.today;
		e.date !== t && await this._loadDay(t);
		let n = e.metrics;
		this._log(`A1 Time to timeline, today (as the tab opened): ${g(n.timelineMs)} (server: ${Q(n.timelineServer)})`);
		let r = Number(t.slice(8, 10)), i = [...e.monthDays].filter((e) => e < r).sort((e, t) => t - e), a = i.at(Math.min(2, i.length - 1));
		if (a === void 0) {
			this._log("A2/A3 skipped: no earlier recording day this month"), this._summary.push(`Timeline: today ${T(n.timelineMs, 1e3)}`), this._plain.push(n.timelineMs === void 0 ? {
				grade: "problem",
				text: "Today's recordings did not load."
			} : {
				grade: c(n.timelineMs, 1e3, 3e3),
				text: `Today's recordings appear on the timeline in ${o(n.timelineMs)}.`
			});
			return;
		}
		let s = `${t.slice(0, 8)}${String(a).padStart(2, "0")}`, l = await this._loadDay(s);
		this._log(`A2 Time to timeline, ${s}: ${g(l.timelineMs)} (server: ${Q(l.timelineServer)})`), await this._loadDay(t);
		let d = await this._loadDay(s);
		this._log(`A3 Time to timeline, ${s} again: ${g(d.timelineMs)} (server: ${Q(d.timelineServer)})`);
		let f = await this._loadDay(t);
		this._log(`A4 Time to timeline, today again: ${g(f.timelineMs)} (server: ${Q(f.timelineServer)})`);
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
		}), this._summary.push(`Timeline: today ${T(n.timelineMs, 1e3)}, past day first ${T(l.timelineMs, p ? 3e3 : 1e3)} (${p ? "cold, < 3 s" : "cached, < 1 s"}), again ${T(d.timelineMs, 1e3)}`);
	}
	async _play(e) {
		let t = this._t;
		performance.clearResourceTimings(), performance.setResourceTimingBufferSize(1e3);
		let n = performance.now(), r = Be(t.player, n), i = t.playing;
		await t.playAt(e, n);
		let a = t.playing === i ? void 0 : t.playing?.cache, o = await this._wait(() => t.metrics.firstFrameMs !== void 0 || !!t.playFailure, 12e4);
		r.stop();
		let s = t.metrics, c = t.player?.time, l = c === void 0 ? void 0 : c - e, u = l === void 0 || Math.abs(l) <= 2e3 ? "" : ` · STARTED AT ${W(c ?? 0)}, ${v(Math.abs(l))} ${l < 0 ? "before" : "after"} the time asked`, d = t.playing?.file ? ` · ${t.playing.file} file` : "", f = t.player?.mseStats?.atSource, p = f ? ` · from ${E(f)}` : "", m = `first frame ${o && !t.playFailure ? g(s.firstFrameMs) : "none"} [URL ${g(s.urlMs)} · metadata ${g(r.seen.loadedmetadata)} · seeked ${g(r.seen.seeked)} · playing ${g(r.seen.playing)}] ${s.delivery ?? "?"}${d}${p} · ${s.stream ?? "?"} ${s.codec ?? ""}${u}${t.playFailure ? ` FAILED: ${t.playFailure}` : ""}`;
		return {
			ok: o && !t.playFailure && !u,
			line: m,
			served: f,
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
			s.ok && e.metrics.firstFrameMs !== void 0 && (r.push(`${T(e.metrics.firstFrameMs, 2e3)}${s.held?.complete === !1 ? " (not cached)" : ""}`), i.push(e.metrics.firstFrameMs)), this._log(`B  ${a.types.join("+")} at ${W(a.start)} (${o}): ${s.line}`), await U(300), this._log(`     ${Z(s.began, s.source)}`), n && this._log(`     ${await this._fillReport()}`), await this._pause(1500);
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
		let t = this._t.playing, n = e(t?.base ?? t?.url ?? "");
		if (!n) return "server: nothing played";
		let i = t?.file === "plain", a = null;
		for (let e = 0; e < 90; e += 1) {
			try {
				a = (await r(this._t.hass, n)).cache;
			} catch {
				a = null;
			}
			if (!a || a.error || a.complete && (!i || a.flat !== void 0) || typeof a.stopped_ms == "number") break;
			await this._pause(1e3);
		}
		if (!a) return "server: not cached (or its URL expired)";
		let o = [a.cache === "disk" ? "from disk" : `fill (${q(a.priority)})`];
		for (let [e, t] of [
			["wait_ms", "queue"],
			["headers_ms", "NVR headers"],
			["ttfb_ms", "NVR first byte"],
			["fill_ms", "download"]
		]) typeof a[e] == "number" && o.push(`${t} ${g(a[e])}`);
		typeof a.mbit_s == "number" && o.push(`${a.mbit_s} Mbit/s`), o.push(_(a.bytes)), typeof a.stopped_ms == "number" && o.push(`stopped at ${v(a.stopped_ms)} (the cut has the rest)`), typeof a.yields == "number" && o.push(`gave its slot to the cut ${String(a.yields)}×`), typeof a.cut_offset_ms == "number" && o.push(`cut ${a.cut_offset_ms >= 0 ? "+" : ""}${String(Math.round(a.cut_offset_ms))} ms from the copy`), a.indexed !== void 0 && o.push(`index ${q(a.indexed)}`), (i || a.flat !== void 0) && o.push(`plain MP4 ${a.flat === void 0 ? "not yet" : q(a.flat)}`), typeof a.flat_ms == "number" && o.push(`rewrite ${g(a.flat_ms)}`), typeof a.flat_moov_bytes == "number" && o.push(`moov ${_(a.flat_moov_bytes)}`), a.error && o.push(`error ${a.error}`), typeof a.cut_error == "string" && o.push(`cut not used: ${a.cut_error}`);
		let s = a.cut;
		return `server: ${o.join(", ")}${s ? ` | ${ie(s)}` : ""}`;
	}
	async _findLong() {
		let e = this._t, t = e.today, r = Number(t.slice(8, 10)), i = [t, ...[...e.monthDays].filter((e) => e < r).sort((e, t) => t - e).slice(0, Ne).map((e) => `${t.slice(0, 8)}${String(e).padStart(2, "0")}`)], a = 0, o;
		for (let t of i) {
			let r;
			try {
				r = t === e.date && e.day ? e.day : await n(e.hass, e.deviceId, t);
			} catch {
				continue;
			}
			for (let e of ee(r.segments, r.now)) {
				if (a >= Me) return o;
				a += 1;
				let n = await this._peek(t, e.id);
				if (n && !n.cache) return {
					date: t,
					day: r,
					segment: e,
					cached: !1
				};
				n?.cache?.complete && !o && (o = {
					date: t,
					day: r,
					segment: e,
					cached: !0
				});
			}
		}
		return o;
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
		let n = t.segment, r = v(n.end - n.start), i = (e) => `${v(e.time - n.start)} into a ${r} recording of ${t.date}` + (e.event ? ` (event ${e.event.types.join("+")} at ${W(e.event.start)})` : " (no event there: a point)"), a, s;
		if (t.cached) this._log("D1 skipped: every long recording looked at is cached already (try again after other recordings were viewed)");
		else {
			let r = y(n, t.day.events, .5, .95, .75), o = await this._play(r.time), c = o.held;
			o.ok && c?.complete === !1 && (a = e.metrics.firstFrameMs, s = o.served);
			let l = c?.complete ? "Not cached when chosen, but on disk when played (not counted)" : c?.bytes ? `Not cached (${_(c.bytes)} already fetched when played)` : "Not cached";
			this._log(`D1 ${l}, ${i(r)}: ${o.line}`), await U(300), this._log(`     ${Z(o.began, o.source)}`), this._log(`     ${await this._fillReport()}`), this._log(`     ${ae((await this._stats())?.vod.baichuan)}`);
		}
		await this._pause(1500);
		let l = y(n, t.day.events, .1, .45, .4), u = await this._play(l.time), d = u.held?.complete === !1, f = u.ok && !d ? e.metrics.firstFrameMs : void 0, p = t.cached ? "Cached when chosen, but not on disk when played" : "Still being copied when played";
		this._log(`D2 ${d ? `${p} (not counted)` : "Cached"}, ${i(l)}: ${u.line}`), await U(300), this._log(`     ${Z(u.began, u.source)}`), this._summary.push(`Deep start (sub, ${r} recording): not cached ${a === void 0 ? "not measured" : `${g(a)}${s ? ` from ${E(s)}` : ""}`}, cached ${T(f, 2e3)}`), this._plain.push(f === void 0 ? u.ok ? {
			grade: "fine",
			text: `Jumping into the middle of a long recording starts in ${o(e.metrics.firstFrameMs ?? 0)} (not judged: its copy was still being made).`
		} : {
			grade: "problem",
			text: "Jumping into the middle of a long recording did not play."
		} : {
			grade: c(f, 2e3, 4e3),
			text: `Jumping into the middle of a long recording starts in ${o(f)}` + (a === void 0 ? "." : `; the first time, ${o(a)}, while the recorder sends it over.`)
		});
	}
	async _advance() {
		let e = this._t, t = b(e.day?.segments ?? []);
		!t.length && e.date !== e.today && (await this._loadDay(e.today), t = b(e.day?.segments ?? []));
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
			r = t ? s.includes("advanced") ? `yes (preloaded) · gap ${g(e.metrics.gapMs)}` : `yes, by reloading (the next file was not preloaded) · first frame ${g(e.metrics.firstFrameMs)}` : `no: on ${n?.current?.segmentId === i.id ? "the first" : n?.current ? "another" : "no"} recording at ${n?.time === void 0 ? "?" : W(n.time)}, ${n?.paused ? "paused" : "playing"}, next ${n?.preloaded ? "preloaded" : "not preloaded"}, events [${s.join(", ")}]`, this._log(`C  Moved on by itself at ${W(i.end)} (from a ${v(i.end - i.start)} recording): ${r}` + (e.playFailure ? ` FAILED: ${e.playFailure}` : "")), this._summary.push(`Auto-advance: ${t && s.includes("advanced") ? `gap ${g(e.metrics.gapMs)}` : r}`);
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
		this._log(`R  Playback rates, ${v(r.end - r.start)} recording, ${L / 1e3} s each (sub stream):`);
		let a = [];
		try {
			for (let t of Ce) {
				let n = X(e.player);
				if (!n) break;
				let r = await this._measureRate(n, t);
				if (a.push(r), this._log(`     ${te(r)}`), r.ended) break;
			}
		} finally {
			let t = X(e.player);
			t && (t.playbackRate = 1);
		}
		this._summary.push(`Rates: ${a.map((e) => `${e.rate}× ${w(e) ? "✓" : "✗"}`).join(" ") || "not measured"} (smooth = ${S})`);
		let o = a.filter((e) => !w(e));
		a.length && this._plain.push(o.length ? {
			grade: "slow",
			text: `Playback stutters at ${o.map((e) => `${String(e.rate)}×`).join(", ")} speed.`
		} : {
			grade: "good",
			text: `Slow motion and fast forward (${String(a[0]?.rate)}× to ${String(a.at(-1)?.rate)}×) play smoothly.`
		});
	}
	async _scrub() {
		let e = this._t.player, t = e?.current, n = X(e);
		if (!e || !t || !n || e.time === void 0) {
			this._log("S  skipped: nothing playing");
			return;
		}
		await this._pause(3e3);
		let r = Pe(e) ?? t.start, i = [], a = [], s = 0;
		for (let o of Ae) {
			let c = r + o * 1e3;
			if (c < t.start || c > t.end) continue;
			let l = performance.now(), u = Fe(n, "seeked", 3e3);
			e.preview(c) ? await u && (i.push(performance.now() - l), s = Math.max(s, Math.abs((Pe(e) ?? c) - c))) : a.push(o);
		}
		let l = r + R, u = l < t.end ? ` · ${v(R)} ahead: ${e.preview(l) ? "buffered, shown" : "not buffered (the thumbnail shows instead)"}` : "", d = i.length + a.length, f = i.length ? [...i].sort((e, t) => e - t)[Math.floor(i.length / 2)] : void 0;
		this._log(`S  Scrub preview (frames from the buffer while dragging): ${i.length} of ${d} points shown` + (f === void 0 ? "" : `, median ${g(f)}, each within ${(s / 1e3).toFixed(2)} s of its point`) + (a.length ? ` · not buffered: ${a.map((e) => `${e > 0 ? "+" : ""}${e} s`).join(", ")}` : "") + u), this._summary.push(`Scrub: ${i.length} of ${d} points in the buffer shown${f === void 0 ? "" : ` (median ${g(f)})`}`), d && this._plain.push(i.length === d ? {
			grade: c(f, 500, 1500),
			text: `Dragging along the timeline shows the video at once (in about ${o(f ?? 0)}).`
		} : {
			grade: "fine",
			text: `Dragging along the timeline shows the video at ${String(i.length)} of ${String(d)} points; elsewhere a thumbnail shows instead.`
		}), e.resume();
	}
	async _keyFrames() {
		let e = await this._keyLine("SD");
		this._log(`K  ${e.text}`), this._summary.push(`Key frames: ${e.short}`);
	}
	async _keyLine(e) {
		let n = this._t.player, r = n?.current, i = r?.mse;
		if (!n || !r || !i) return {
			text: `${e} skipped: nothing playing through MSE (the file player has no fragments to read)`,
			short: `${e} skipped`
		};
		let a = Math.round(Math.max(0, (n.time ?? r.start) - r.start));
		try {
			let t = await i.fetch(`${i.base}/frags?at=${String(a)}&ms=${String(z)}&bytes=${String(je)}`), n = t.headers.get("X-RV-Source") ?? "file", r = await i.fetch(`${i.base}/init?source=${n}`);
			if (!t.ok || !r.ok) return {
				text: `${e}: the fragments did not come (HTTP ${String(t.status)}, init ${String(r.status)})`,
				short: `${e} not read`
			};
			let o = se(new Uint8Array(await r.arrayBuffer())), s = le(r.headers.get("X-RV-Mime") ?? "");
			if (!o || !s) return {
				text: `${e}: no video track in the init segment`,
				short: `${e} not read`
			};
			let c = ce(new Uint8Array(await t.arrayBuffer()), o);
			if (!c.length) return {
				text: `${e}: no key frame in ${v(z)} of fragments`,
				short: `${e}: none`
			};
			this._checkStopped();
			let l = fe(e, s, o, c, await de(s, o, c));
			return {
				text: `${l.text} · from the ${n}`,
				short: l.short
			};
		} catch (n) {
			if (n instanceof H) throw n;
			return {
				text: `${e}: ${t(n).message}`,
				short: `${e} failed`
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
		let r = e.day?.segments.find((e) => e.id === n.segmentId), i = r ? ` (${v((t.time ?? r.start) - r.start)} into a ${v(r.end - r.start)} recording)` : "", a = await this._switchTo("main");
		if (!a.ok) {
			this._log(`H  HD at ${W(a.at)}${i}: ${a.line}`), this._summary.push(`HD switch: ${a.line}`), this._plain.push({
				grade: "problem",
				text: "HD did not play; the viewer went back to SD.",
				advice: "SD still works. Include the details below if you report it."
			});
			return;
		}
		this._hdPlayed = !0, this._log(`H  HD at ${W(a.at)}${i}: ${a.line} · ${e.metrics.stream ?? "?"} ${e.metrics.codec ?? "?"} · ${e.metrics.delivery ?? "?"}`), this._log(`     ${await this._fillReport()}`);
		let s = await this._keyLine("HD");
		this._log(`     K ${s.text}`), this._summary.push(`Key frames: ${s.short}`), await this._pause(5e3);
		let l = await this._switchTo("sub");
		this._log(`     Back to SD at ${W(l.at)}: ${l.line}`), this._summary.push(`HD switch: to HD ${a.short}; back to SD ${l.short}`), this._plain.push({
			grade: u([c(a.ms, 3e3, 8e3), a.kept ? "good" : "fine"]),
			text: `Switching to HD takes ${o(a.ms ?? 0)}${a.kept ? " and keeps your place" : ", but starts at another moment"}${l.ok ? `; back to SD, ${o(l.ms ?? 0)}` : ""}.`
		});
	}
	async _switchTo(e) {
		let t = this._t, n = t.player, r = n?.time ?? 0, i = t.metrics.hdFailures ?? 0, a = () => (t.metrics.hdFailures ?? 0) > i;
		t.setStream(e);
		let o = await this._wait(() => t.metrics.stream === e && t.metrics.firstFrameMs !== void 0 || a() || !!t.playFailure, B), s = a() ? t.metrics.lastHdFailure ?? "HD failed" : t.playFailure;
		if (!o || s) {
			let e = s ? `FAILED: ${s} (back on the sub stream)` : `no first frame within ${v(B)}`;
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
		await this._pause(we);
		let r = K(), i = setInterval(() => {
			r &&= K();
		}, 250), a = Y(e), o = e.currentTime, s = performance.now(), c = 0, l, u = 0, d = !1, f = () => {
			c += 1, l ??= performance.now();
		}, p = () => {
			l !== void 0 && (u += performance.now() - l), l = void 0;
		}, m = () => {
			d = !0;
		};
		e.addEventListener("waiting", f), e.addEventListener("playing", p), e.addEventListener("ended", m);
		let h = ze(e);
		try {
			await this._pause(L);
		} finally {
			clearInterval(i), h.stop(), e.removeEventListener("waiting", f), e.removeEventListener("playing", p), e.removeEventListener("ended", m);
		}
		l !== void 0 && (u += performance.now() - l);
		let g = Y(e);
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
			focused: r && K()
		};
	}
	async _link() {
		let e = this._t, n = e.playing, r = e.hass.fetchWithAuth?.bind(e.hass), i = n?.base, a = n?.url ?? n?.clip_url, o, s = "of the cached recording";
		if (i && r ? (s = "of fragments", o = (e) => r(`${i}/frags?first=0&ms=${String(Oe)}&bytes=${String(Ee)}`, {
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
		}, De);
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
			this._log(`L  Link to Home Assistant: ${_(n)} ${s} in ${g(i - t)} after the answer = ${a.toFixed(1)} Mbit/s (answer ${g(t)}, HTTP ${e.status})`), this._summary.push(`Link: ${a.toFixed(1)} Mbit/s`), this._plain.push({
				grade: a >= 16 ? "good" : a >= 4 ? "fine" : "slow",
				text: `Recordings come from Home Assistant at ${a.toFixed(0)} Mbit/s: ` + (a >= 16 ? "plenty for HD." : a >= 4 ? "enough for SD; HD may pause to load." : "SD may pause to load.")
			});
		} catch (e) {
			this._log(`L  Link test failed: ${t(e).message}`);
		} finally {
			clearTimeout(u);
		}
	}
	async _capabilities() {
		let e = this._t, t = {};
		try {
			t = await a(e.hass, e.deviceId);
		} catch {}
		let n = t.sub?.codec, r = t.main?.codec, i = (e) => [["sub", n], ["main", r]].map(([t, n]) => n ? `${t} ${n} ${G(he(e, n))}` : `${t} codec unknown (not cached yet)`).join(", "), o = ["MediaSource", "ManagedMediaSource"];
		this._log(`MSE: ${o.map((e) => P(e) ? `${e} present (${i(e)})` : `${e} absent`).join(" · ")}`);
		let s = [];
		for (let e of o) {
			if (!P(e)) continue;
			let t = ge(e);
			if (!t) {
				this._log(`MSE probe (${e}): no sample codec supported`);
				continue;
			}
			let n = [];
			for (let { shape: r, label: i } of me) this._checkStopped(), n.push(`${i} ${await ve(e, t.sample, r)}`);
			this._log(`MSE probe (${e}, ${t.name} sample): ${n.join(" · ")}`), s.push(`${e} ${n[0]?.includes("plays") ? "plays MSE-ready fragments" : "fails"}`);
		}
		this._summary.push(`MSE: ${s.join(", ") || "neither MediaSource nor ManagedMediaSource"}`);
		let c = document.createElement("video"), l = (e) => e ? `"${c.canPlayType(`video/mp4; codecs="${e}"`)}"` : "unknown";
		this._log(`Video: canPlayType sub ${l(n)}, main ${l(r)} · getVideoPlaybackQuality ${G("getVideoPlaybackQuality" in c)} · requestVideoFrameCallback ${G("requestVideoFrameCallback" in c)} · performance.memory ${G(J() !== void 0)}`), this._log(`HD as the tab opened: ${e.hd.reason}${this._hdPlayed ? " (played in H above)" : ""}`), t.main?.width && t.main.height && r && this._log(`HD decodingInfo for ${r} at ${t.main.width}×${t.main.height}: ${await Ve(r, t.main.width, t.main.height)}`), this._hdPlayed || this._summary.push(`HD: ${e.hd.main ? "offered" : "not offered"} (${e.hd.reason})`), e.hd.main || this._plain.push({
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
		this._log(`M  One-hour session: playing from ${W(i.start)} on ${r} for ${t} min, a sample a minute`);
		let a = e.player, o = 0, s = 0, c = [], l = () => {
			o += 1;
		}, u = (e) => {
			s += 1, c.push(e.detail.gapMs);
		}, f = [...a?.renderRoot.querySelectorAll("video") ?? []], p = [], m = [], h = 0, v = new Le(), y = { minute: !0 }, ee = setInterval(() => {
			y.minute &&= K();
		}, 1e3), b = performance.now();
		try {
			await this._play(i.start), f.forEach((e) => {
				e.addEventListener("waiting", l);
			}), a?.addEventListener("rv-advanced", u);
			for (let n = 1; n <= t; n += 1) {
				if (await this._pause(Te), e.player?.paused && document.visibilityState === "visible") {
					let t = e.day?.segments[0];
					this._log(`M  ${n} min: playback had stopped${e.playFailure ? ` (${e.playFailure})` : ""}; starting again from the day's first recording`), t && await e.playAt(t.start, performance.now());
				}
				let t = X(e.player), r = v.update(f), i = y.minute && K();
				y.minute = !0;
				let a = t ? Math.max(0, Re(t) - t.currentTime) : 0;
				h = Math.max(h, a);
				let c = J();
				c !== void 0 && p.push([(performance.now() - b) / 36e5, c]);
				let l = await this._stats();
				l?.vod.disk_bytes !== void 0 && m.push(l.vod.disk_bytes);
				let u = f.reduce((e, t) => e + re(t.buffered), 0);
				this._log(`M  ${n} min: ${e.player?.time === void 0 ? "?" : W(e.player.time)} ${e.player?.paused ? "paused" : "playing"}` + (document.visibilityState === "visible" ? "" : " (page hidden: the system pauses video)") + (i ? "" : " · PAGE NOT IN FRONT this minute") + ` · heap ${c === void 0 ? "n/a" : _(c)} · ${a.toFixed(0)} s ahead, ${u.toFixed(0)} s buffered in both videos · dropped ${r} this minute, ${v.dropped} of ${v.decoded} in all · ${o} stalls · ${s} file changes` + (e.metrics.recoveries ? ` · ${e.metrics.recoveries} reloads mid-way` : "") + (l ? ` · cache ${_(l.vod.disk_bytes)} on disk + ${_(l.vod.reserved_bytes)} reserved, ${l.vod.leased ?? "?"} leased` : "")), He(this.id, this.options.setup, n);
			}
		} finally {
			clearInterval(ee), f.forEach((e) => {
				e.removeEventListener("waiting", l);
			}), a?.removeEventListener("rv-advanced", u);
		}
		let x = ne(p), te = p.length ? `heap ${_(p[0]?.[1])} → ${_(p.at(-1)?.[1])} (max ${_(Math.max(...p.map(([, e]) => e)))}${x === void 0 ? "" : `, ${x >= 0 ? "+" : ""}${_(x)}/h`})` : "heap not measurable in this browser (the page was not reloaded)", S = (await this._stats())?.vod.max_bytes, C = m.length ? `cache ${_(Math.min(...m))}–${_(Math.max(...m))} on disk (cap ${_(S)})` : "cache use unknown", w = `${t} min: ${te}, at most ${h.toFixed(0)} s buffered ahead, ${v.dropped} of ${v.decoded} frames dropped, ${o} stalls, ${s} file changes${c.length ? ` (gaps ${c.map((e) => g(e)).join(", ")})` : ""}, ${e.metrics.recoveries ?? 0} reloads mid-way, ${C}`;
		this._log(`M  Summary: ${w}`), this._summary.push(`Session: ${w}`);
		let T = v.decoded ? v.dropped / v.decoded : 0, E = e.metrics.recoveries ?? 0;
		this._plain.push({
			grade: !o && !E && T < .005 ? "good" : o <= 2 && T < .02 ? "fine" : "slow",
			text: `Played for ${d(t, "minute")}: ` + [
				o ? `it paused to load ${d(o, "time")}` : "it never paused to load",
				v.decoded ? `${T < .001 ? "no" : `${(T * 100).toFixed(1)}% of`} frames skipped` : void 0,
				E ? `reloaded ${d(E, "time")}` : void 0
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
}, G = (e) => e === void 0 ? "n/a" : e ? "yes" : "no", K = () => document.visibilityState === "visible" && document.hasFocus(), q = (e) => typeof e == "string" || typeof e == "number" ? String(e) : "?";
function J() {
	return performance.memory?.usedJSHeapSize;
}
var Le = class {
	decoded = 0;
	dropped = 0;
	_last = /* @__PURE__ */ new Map();
	update(e) {
		let t = this.dropped;
		for (let t of e) {
			let e = Y(t);
			if (!e) continue;
			let n = this._last.get(t), r = !n || e.totalVideoFrames < n.totalVideoFrames;
			this.decoded += r ? e.totalVideoFrames : e.totalVideoFrames - n.totalVideoFrames, this.dropped += r ? e.droppedVideoFrames : e.droppedVideoFrames - n.droppedVideoFrames, this._last.set(t, e);
		}
		return this.dropped - t;
	}
};
function Y(e) {
	return typeof e.getVideoPlaybackQuality == "function" ? e.getVideoPlaybackQuality() : void 0;
}
function Re(e) {
	let t = e.buffered;
	for (let n = 0; n < t.length; n += 1) if (t.start(n) <= e.currentTime + .5 && t.end(n) >= e.currentTime) return t.end(n);
	return e.currentTime;
}
function X(e) {
	return e?.renderRoot.querySelector("video.active") ?? null;
}
function ze(e) {
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
function Be(e, t) {
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
function Z(e, t) {
	let n = t ? new URL(t, location.href).pathname : "", r = performance.getEntriesByType("resource").filter((t) => (t.initiatorType === "video" || t.initiatorType === "fetch" && t.name.includes("/api/reolink_viewer/mse/")) && t.startTime >= e - 5);
	if (!r.length) return "requests: none reported (this browser may not report video requests)";
	let i = r.filter((e) => e.requestStart > 0), a = i.slice(0, 10).map((t, r) => {
		let i = n && new URL(t.name).pathname.startsWith(n) ? "" : " (other file)", a = t.encodedBodySize ? ` · ${_(t.encodedBodySize)}` : "";
		return `#${r + 1}${i} +${Math.round(t.startTime - e)} ms: wait ${Math.round(t.requestStart - t.startTime)} · answer ${Math.round(t.responseStart - t.requestStart)} · ran ${Math.round(t.responseEnd - t.responseStart)} ms${a}`;
	}), o = i.length > 10 ? ` | … ${i.length - 10} more` : "", s = r.length - i.length, c = [...new Set(i.map((e) => e.nextHopProtocol).filter(Boolean))].join("/");
	return `requests${c ? ` (${c})` : ""}: ${i.length} sent${s ? `, ${s} cancelled before sending` : ""}: ${a.join(" | ")}${o}`;
}
async function Ve(e, n, r) {
	let i = navigator.mediaCapabilities;
	if (!i?.decodingInfo) return "MediaCapabilities absent";
	let a = [];
	for (let o of ["file", "media-source"]) try {
		let t = await i.decodingInfo({
			type: o,
			video: {
				contentType: `video/mp4; codecs="${e}"`,
				width: n,
				height: r,
				bitrate: 8e6,
				framerate: 25
			}
		});
		a.push(`${o}: ${t.supported ? "supported" : "not supported"}${t.supported ? `, ${t.smooth ? "smooth" : "not smooth"}, ${t.powerEfficient ? "power efficient" : "not power efficient"}` : ""}`);
	} catch (e) {
		a.push(`${o}: ${t(e).message}`);
	}
	return a.join(" · ");
}
function Q(e) {
	if (!e) return "?";
	let t = [e.cache ?? "?"];
	e.age_s !== void 0 && t.push(`${q(e.age_s)} s old`);
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
function $() {
	try {
		return window.localStorage;
	} catch {
		return;
	}
}
function He(e, t, n) {
	try {
		let r = $()?.getItem(V), i = {
			id: e,
			setup: t,
			started: r ? JSON.parse(r).started : (/* @__PURE__ */ new Date()).toISOString(),
			updated: (/* @__PURE__ */ new Date()).toISOString(),
			...n ? { minute: n } : {}
		};
		$()?.setItem(V, JSON.stringify(i));
	} catch {}
}
function Ue(e) {
	try {
		let t = $()?.getItem(V);
		t && JSON.parse(t).id === e && $()?.removeItem(V);
	} catch {}
}
async function We(e) {
	let t;
	try {
		let e = $()?.getItem(V);
		if (!e) return;
		t = JSON.parse(e), $()?.removeItem(V);
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
var Ge = (e) => e.callWS({ type: "reolink_viewer/playback/check_reports" });
//#endregion
export { We as a, m as c, Se as i, xe as n, h as o, Ge as r, p as s, Ie as t };

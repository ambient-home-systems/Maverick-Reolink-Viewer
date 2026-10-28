import { Bt as e, Ht as t, Q as n, Vt as r, zt as i } from "./home-BgEtUrjD.js";
//#region src/playback/check-util.ts
function a(e) {
	let t = e.toLowerCase();
	if (t.endsWith(".ui.nabu.casa")) return "Nabu Casa";
	if (t.endsWith(".ts.net")) return "Tailscale";
	let n = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(t);
	if (n) {
		let [e = 0, t = 0] = n.slice(1, 3).map(Number);
		return e === 100 && t >= 64 && t < 128 ? "Tailscale" : e === 10 || e === 127 || e === 192 && t === 168 || e === 172 && t >= 16 && t < 32 ? "local" : "remote";
	}
	return t === "localhost" || t.endsWith(".local") || t.endsWith(".lan") || !t.includes(".") ? "local" : "own domain";
}
var o = (e) => /iPhone|iPad|iPod/.test(e);
function s(e) {
	return o(e) ? "iPhone app, Wi-Fi (local)" : "Desktop Chrome, LAN";
}
function c(e, t) {
	return e.startsWith("iPhone") ? !o(t) : e.startsWith("Desktop") ? o(t) : !1;
}
function l(e) {
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
var u = (e) => e === void 0 ? "–" : `${Math.round(e)} ms`, d = (e) => e === void 0 ? "–" : Math.abs(e) >= 1e9 ? `${(e / 1e9).toFixed(2)} GB` : `${(e / 1e6).toFixed(1)} MB`;
function f(e) {
	return e < 6e4 ? `${Math.round(e / 1e3)} s` : `${(e / 6e4).toFixed(1)} min`;
}
function p(e, t, n, r, i) {
	let a = e.end - e.start, o = e.start + a * n, s = e.start + a * r, c = t.filter((e) => e.start >= o && e.start <= s).at(-1);
	return {
		time: c ? c.start : Math.round(e.start + a * i),
		event: c
	};
}
function m(e, t) {
	return e.filter((e) => e.end - e.start >= 12e5 && t - e.end > 6e4).sort((e, t) => t.start - e.start);
}
function h(e) {
	let t = [];
	return e.forEach((n, r) => {
		let i = e.at(r + 1);
		i && i.start - n.end < 2e3 && t.push([n, i]);
	}), t.sort((e, t) => e[0].end - e[0].start - (t[0].end - t[0].start));
}
function g(e) {
	return e.decoded && e.mediaS > 0 ? e.decoded / e.mediaS : void 0;
}
function _(e) {
	let t = [`${(e.wallMs > 0 ? e.mediaS * 1e3 / e.wallMs : 0).toFixed(2)}× effective`];
	e.applied !== e.rate && t.push(`browser set ${e.applied}×`);
	let n = g(e);
	if (e.painted !== void 0) {
		let r = `${(e.painted * 1e3 / e.wallMs).toFixed(0)} fps painted`;
		t.push(n ? `${r} of ${(n * e.rate).toFixed(0)}` : r);
	}
	if (e.maxGapMs !== void 0 && t.push(`longest frame gap ${Math.round(e.maxGapMs)} ms`), e.decoded !== void 0 && e.dropped !== void 0) {
		let n = e.decoded ? (e.dropped * 100 / e.decoded).toFixed(1) : "0.0";
		t.push(`dropped ${e.dropped} of ${e.decoded} frames (${n} %)`);
	}
	return t.push(`${e.stalls} stalls${e.stalls ? ` (${Math.round(e.stalledMs)} ms)` : ""}`), e.ended && t.push("the file ended"), y(e) || t.push("the dropped-frame counter disagrees with the frames painted: judged by those"), e.focused || t.push("PAGE NOT IN FRONT"), `${String(e.rate).padStart(3)}×: ${t.join(", ")}`;
}
var v = "on pace (±10 %), stalls under 100 ms, no frame gap over 2.5 frames (250 ms at least); below 50 fps to show, ≤ 2 % (or 1 frame) dropped, or 90 % painted where the dropped-frame counter disagrees with the frames painted";
function y(e) {
	if (e.painted === void 0 || e.decoded === void 0 || e.dropped === void 0) return !0;
	let t = e.decoded - e.dropped;
	return Math.abs(t - e.painted) <= Math.max(3, e.decoded * .1);
}
function b(e) {
	let t = e.wallMs > 0 ? e.mediaS * 1e3 / e.wallMs : 0;
	if (Math.abs(t - e.rate) > e.rate * .1 || e.stalledMs >= 100) return !1;
	let n = g(e), r = n === void 0 ? void 0 : n * e.rate;
	if (r !== void 0 && e.maxGapMs !== void 0) {
		let t = Math.max(250, 2500 / Math.min(r, 60));
		if (e.maxGapMs > t) return !1;
	}
	return r === void 0 || r > 50 ? !0 : !y(e) && e.painted !== void 0 ? e.painted * 1e3 / e.wallMs >= r * .9 : !e.decoded || (e.dropped ?? 0) <= Math.max(1, e.decoded * .02);
}
function x(e) {
	if (e.length < 2) return;
	let t = e.length, n = e.reduce((e, [t]) => e + t, 0) / t, r = e.reduce((e, [, t]) => e + t, 0) / t, i = 0, a = 0;
	for (let [t, o] of e) i += (t - n) * (o - r), a += (t - n) ** 2;
	return a ? i / a : void 0;
}
function S(e) {
	let t = 0;
	for (let n = 0; n < e.length; n += 1) t += e.end(n) - e.start(n);
	return t;
}
var C = (e, t) => e === void 0 ? "not measured" : `${u(e)} ${e < t ? "✓" : "✗"}`, w = {
	good: "Good",
	fine: "Fine",
	slow: "Slow",
	problem: "Problem",
	note: "Note",
	pending: "Not yet"
}, T = {
	good: "as it should be",
	fine: "a little slower, nothing to do",
	slow: "works, but worth a look",
	problem: "something is wrong",
	note: "for your information",
	pending: "still to come"
}, E = " What to do: ";
function D(e) {
	if (e < 100) return "under 0.1 s";
	let t = e / 1e3;
	return t < 10 ? `${t.toFixed(1)} s` : `${String(Math.round(t))} s`;
}
function O(e, t, n) {
	return e === void 0 ? "problem" : e < t ? "good" : e < n ? "fine" : "slow";
}
function k(e) {
	return [
		"problem",
		"slow",
		"fine",
		"good",
		"pending",
		"note"
	].find((t) => e.includes(t)) ?? "note";
}
function A(e) {
	if (e.length) return [...e].sort((e, t) => e - t)[Math.floor((e.length - 1) / 2)];
}
function j(e, t, n = `${t}s`) {
	return `${String(e)} ${e === 1 ? t : n}`;
}
function M(e) {
	return [`In short: ${e.headline}`, ...e.findings.map((e) => `- ${w[e.grade]}: ${e.text}${e.advice ? `${E}${e.advice}` : ""}`)];
}
function N(e) {
	let t = e.split("\n"), n = t.findIndex((e) => e.startsWith("In short: "));
	if (n < 0) return;
	let r = new Map(Object.entries(w).map(([e, t]) => [t, e])), i = [];
	for (let e of t.slice(n + 1)) {
		let t = /^- (Good|Fine|Slow|Problem|Note|Not yet): (.*)$/.exec(e);
		if (!t) break;
		let [, n, a] = t, [o = "", s] = a.split(E);
		i.push({
			grade: r.get(n) ?? "note",
			text: o,
			...s ? { advice: s } : {}
		});
	}
	return {
		headline: t[n]?.slice(10) ?? "",
		findings: i
	};
}
//#endregion
//#region src/components/findings.ts
var P = class extends i {
	static properties = { summary: { attribute: !1 } };
	render() {
		let t = this.summary;
		if (!t) return e;
		let n = [
			"good",
			"fine",
			"slow",
			"problem",
			"pending"
		].filter((e) => t.findings.some((t) => t.grade === e));
		return r`<p class="headline">${t.headline}</p>
      ${t.findings.length ? r`<ul>
            ${t.findings.map((t) => r`<li class=${t.grade}>
                <span class="grade">${w[t.grade]}</span>
                <span class="what">
                  <span>${t.text}</span>
                  ${t.advice ? r`<span class="advice">${t.advice}</span>` : e}
                </span>
              </li>`)}
          </ul>
          ${n.length > 1 ? r`<p class="key">${n.map((e) => `${w[e]}: ${T[e]}`).join(" · ")}</p>` : e}` : e}`;
	}
	static styles = [n, t`
      :host {
        display: block;
      }
      .headline {
        margin: 0 0 10px;
        max-width: none;
        font-family: var(--rv-font-cond);
        font-size: 22px;
        font-weight: 600;
        line-height: 1.2;
      }
      ul {
        list-style: none;
        margin: 0;
        padding: 0;
        border-top: 1px solid var(--rv-rule-strong);
      }
      li {
        display: grid;
        grid-template-columns: 86px minmax(0, 1fr);
        column-gap: 14px;
        align-items: baseline;
        padding: 10px 0;
        border-bottom: 1px solid var(--rv-rule);
        font-size: 16px;
      }
      .grade {
        justify-self: start;
        font-family: var(--rv-font-cond);
        font-size: 16px;
        font-weight: 600;
      }
      /* What needs a look stands out: a problem in the fault colour, slow ruled in it. */
      .problem .grade,
      .slow .grade {
        padding: 0 6px;
        border: 1.5px solid var(--rv-fault);
      }
      .problem .grade {
        background: var(--rv-fault);
        color: var(--rv-on-fault);
      }
      .slow .grade {
        color: var(--rv-fault-ink);
      }
      .note .grade,
      .pending .grade {
        color: var(--rv-muted);
      }
      .what {
        display: flex;
        flex-direction: column;
        gap: 3px;
        max-width: 72ch;
      }
      .advice {
        color: var(--rv-muted);
        font-size: 15px;
      }
      .key {
        margin: 8px 0 0;
        max-width: none;
        color: var(--rv-muted);
        font-size: 13px;
      }
      @media (max-width: 600px) {
        li {
          grid-template-columns: 72px minmax(0, 1fr);
          column-gap: 10px;
          font-size: 15px;
        }
        .headline {
          font-size: 20px;
        }
      }
    `];
};
customElements.get("rv-findings") || customElements.define("rv-findings", P);
//#endregion
export { C, h as S, u as _, D as a, b, v as c, a as d, p as f, d as g, m as h, N as i, l, s as m, M as n, O as o, _ as p, A as r, k as s, j as t, S as u, c as v, f as x, x as y };

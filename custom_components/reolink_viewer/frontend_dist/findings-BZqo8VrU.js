import { Jt as e, Kt as t, Yt as n, it as r, qt as i } from "./home-CRi9TKP3.js";
//#region src/playback/check-util.ts
var a = (e) => /iPhone|iPad|iPod/.test(e);
function o(e) {
	return a(e) ? "iPhone app, Wi-Fi (local)" : "Desktop Chrome, LAN";
}
function s(e, t) {
	return e.startsWith("iPhone") ? !a(t) : e.startsWith("Desktop") ? a(t) : !1;
}
function c(e) {
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
var l = (e) => e === void 0 ? "–" : `${Math.round(e)} ms`, u = (e) => e === void 0 ? "–" : Math.abs(e) >= 1e9 ? `${(e / 1e9).toFixed(2)} GB` : `${(e / 1e6).toFixed(1)} MB`;
function d(e) {
	return e < 6e4 ? `${Math.round(e / 1e3)} s` : `${(e / 6e4).toFixed(1)} min`;
}
function f(e, t, n, r, i) {
	let a = e.end - e.start, o = e.start + a * n, s = e.start + a * r, c = t.filter((e) => e.start >= o && e.start <= s).at(-1);
	return {
		time: c ? c.start : Math.round(e.start + a * i),
		event: c
	};
}
function p(e, t) {
	return e.filter((e) => e.end - e.start >= 12e5 && t - e.end > 6e4).sort((e, t) => t.start - e.start);
}
function m(e) {
	let t = [];
	return e.forEach((n, r) => {
		let i = e.at(r + 1);
		i && i.start - n.end < 2e3 && t.push([n, i]);
	}), t.sort((e, t) => e[0].end - e[0].start - (t[0].end - t[0].start));
}
function h(e) {
	return e.decoded && e.mediaS > 0 ? e.decoded / e.mediaS : void 0;
}
function g(e) {
	let t = [`${(e.wallMs > 0 ? e.mediaS * 1e3 / e.wallMs : 0).toFixed(2)}× effective`];
	e.applied !== e.rate && t.push(`browser set ${e.applied}×`);
	let n = h(e);
	if (e.painted !== void 0) {
		let r = `${(e.painted * 1e3 / e.wallMs).toFixed(0)} fps painted`;
		t.push(n ? `${r} of ${(n * e.rate).toFixed(0)}` : r);
	}
	if (e.maxGapMs !== void 0 && t.push(`longest frame gap ${Math.round(e.maxGapMs)} ms`), e.decoded !== void 0 && e.dropped !== void 0) {
		let n = e.decoded ? (e.dropped * 100 / e.decoded).toFixed(1) : "0.0";
		t.push(`dropped ${e.dropped} of ${e.decoded} frames (${n} %)`);
	}
	return t.push(`${e.stalls} stalls${e.stalls ? ` (${Math.round(e.stalledMs)} ms)` : ""}`), e.ended && t.push("the file ended"), v(e) || t.push("the dropped-frame counter disagrees with the frames painted: judged by those"), e.focused || t.push("PAGE NOT IN FRONT"), `${String(e.rate).padStart(3)}×: ${t.join(", ")}`;
}
var _ = "on pace (±10 %), stalls under 100 ms, no frame gap over 2.5 frames (250 ms at least); below 50 fps to show, ≤ 2 % (or 1 frame) dropped, or 90 % painted where the dropped-frame counter disagrees with the frames painted";
function v(e) {
	if (e.painted === void 0 || e.decoded === void 0 || e.dropped === void 0) return !0;
	let t = e.decoded - e.dropped;
	return Math.abs(t - e.painted) <= Math.max(3, e.decoded * .1);
}
function y(e) {
	let t = e.wallMs > 0 ? e.mediaS * 1e3 / e.wallMs : 0;
	if (Math.abs(t - e.rate) > e.rate * .1 || e.stalledMs >= 100) return !1;
	let n = h(e), r = n === void 0 ? void 0 : n * e.rate;
	if (r !== void 0 && e.maxGapMs !== void 0) {
		let t = Math.max(250, 2500 / Math.min(r, 60));
		if (e.maxGapMs > t) return !1;
	}
	return r === void 0 || r > 50 ? !0 : !v(e) && e.painted !== void 0 ? e.painted * 1e3 / e.wallMs >= r * .9 : !e.decoded || (e.dropped ?? 0) <= Math.max(1, e.decoded * .02);
}
function b(e) {
	if (e.length < 2) return;
	let t = e.length, n = e.reduce((e, [t]) => e + t, 0) / t, r = e.reduce((e, [, t]) => e + t, 0) / t, i = 0, a = 0;
	for (let [t, o] of e) i += (t - n) * (o - r), a += (t - n) ** 2;
	return a ? i / a : void 0;
}
function x(e) {
	let t = 0;
	for (let n = 0; n < e.length; n += 1) t += e.end(n) - e.start(n);
	return t;
}
var S = (e, t) => e === void 0 ? "not measured" : `${l(e)} ${e < t ? "✓" : "✗"}`, C = {
	good: "Good",
	fine: "Fine",
	slow: "Slow",
	problem: "Problem",
	note: "Note",
	pending: "Not yet"
}, w = {
	good: "as it should be",
	fine: "a little slower, nothing to do",
	slow: "works, but worth a look",
	problem: "something is wrong",
	note: "for your information",
	pending: "still to come"
}, T = " What to do: ";
function E(e) {
	if (e < 100) return "under 0.1 s";
	let t = e / 1e3;
	return t < 10 ? `${t.toFixed(1)} s` : `${String(Math.round(t))} s`;
}
function D(e, t, n) {
	return e === void 0 ? "problem" : e < t ? "good" : e < n ? "fine" : "slow";
}
function O(e) {
	return [
		"problem",
		"slow",
		"fine",
		"good",
		"pending",
		"note"
	].find((t) => e.includes(t)) ?? "note";
}
function k(e) {
	if (e.length) return [...e].sort((e, t) => e - t)[Math.floor((e.length - 1) / 2)];
}
function A(e, t, n = `${t}s`) {
	return `${String(e)} ${e === 1 ? t : n}`;
}
function j(e) {
	return [`In short: ${e.headline}`, ...e.findings.map((e) => `- ${C[e.grade]}: ${e.text}${e.advice ? `${T}${e.advice}` : ""}`)];
}
function M(e) {
	let t = e.split("\n"), n = t.findIndex((e) => e.startsWith("In short: "));
	if (n < 0) return;
	let r = new Map(Object.entries(C).map(([e, t]) => [t, e])), i = [];
	for (let e of t.slice(n + 1)) {
		let t = /^- (Good|Fine|Slow|Problem|Note|Not yet): (.*)$/.exec(e);
		if (!t) break;
		let [, n, a] = t, [o = "", s] = a.split(T);
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
var N = class extends t {
	static properties = { summary: { attribute: !1 } };
	render() {
		let t = this.summary;
		if (!t) return i;
		let n = [
			"good",
			"fine",
			"slow",
			"problem",
			"pending"
		].filter((e) => t.findings.some((t) => t.grade === e));
		return e`<p class="headline">${t.headline}</p>
      ${t.findings.length ? e`<ul>
            ${t.findings.map((t) => e`<li class=${t.grade}>
                <span class="grade">${C[t.grade]}</span>
                <span class="what">
                  <span>${t.text}</span>
                  ${t.advice ? e`<span class="advice">${t.advice}</span>` : i}
                </span>
              </li>`)}
          </ul>
          ${n.length > 1 ? e`<p class="key">${n.map((e) => `${C[e]}: ${w[e]}`).join(" · ")}</p>` : i}` : i}`;
	}
	static styles = [r, n`
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
customElements.get("rv-findings") || customElements.define("rv-findings", N);
//#endregion
export { S, s as _, E as a, d as b, _ as c, f as d, g as f, l as g, u as h, M as i, c as l, p as m, j as n, D as o, o as p, k as r, O as s, A as t, x as u, b as v, m as x, y };

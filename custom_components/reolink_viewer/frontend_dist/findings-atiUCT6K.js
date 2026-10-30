import { Jt as e, Xt as t, Yt as n, it as r, qt as i } from "./home-DaNMrOZP.js";
//#region src/plain.ts
var a = {
	good: "Good",
	fine: "Fine",
	slow: "Slow",
	problem: "Problem",
	note: "Note",
	pending: "Not yet"
}, o = {
	good: "as it should be",
	fine: "a little slower, nothing to do",
	slow: "works, but worth a look",
	problem: "something is wrong",
	note: "for your information",
	pending: "still to come"
}, s = " What to do: ";
function c(e) {
	if (e < 100) return "under 0.1 s";
	let t = e / 1e3;
	return t < 10 ? `${t.toFixed(1)} s` : `${String(Math.round(t))} s`;
}
function l(e, t, n) {
	return e === void 0 ? "problem" : e < t ? "good" : e < n ? "fine" : "slow";
}
function u(e) {
	return [
		"problem",
		"slow",
		"fine",
		"good",
		"pending",
		"note"
	].find((t) => e.includes(t)) ?? "note";
}
function d(e) {
	if (e.length) return [...e].sort((e, t) => e - t)[Math.floor((e.length - 1) / 2)];
}
function f(e, t, n = `${t}s`) {
	return `${String(e)} ${e === 1 ? t : n}`;
}
function p(e) {
	return [`In short: ${e.headline}`, ...e.findings.map((e) => `- ${a[e.grade]}: ${e.text}${e.advice ? `${s}${e.advice}` : ""}`)];
}
function m(e) {
	let t = e.split("\n"), n = t.findIndex((e) => e.startsWith("In short: "));
	if (n < 0) return;
	let r = new Map(Object.entries(a).map(([e, t]) => [t, e])), i = [];
	for (let e of t.slice(n + 1)) {
		let t = /^- (Good|Fine|Slow|Problem|Note|Not yet): (.*)$/.exec(e);
		if (!t) break;
		let [, n, a] = t, [o = "", c] = a.split(s);
		i.push({
			grade: r.get(n) ?? "note",
			text: o,
			...c ? { advice: c } : {}
		});
	}
	return {
		headline: t[n]?.slice(10) ?? "",
		findings: i
	};
}
//#endregion
//#region src/components/findings.ts
var h = class extends i {
	static properties = { summary: { attribute: !1 } };
	render() {
		let t = this.summary;
		if (!t) return e;
		let r = [
			"good",
			"fine",
			"slow",
			"problem",
			"pending"
		].filter((e) => t.findings.some((t) => t.grade === e));
		return n`<p class="headline">${t.headline}</p>
      ${t.findings.length ? n`<ul>
            ${t.findings.map((t) => n`<li class=${t.grade}>
                <span class="grade">${a[t.grade]}</span>
                <span class="what">
                  <span>${t.text}</span>
                  ${t.advice ? n`<span class="advice">${t.advice}</span>` : e}
                </span>
              </li>`)}
          </ul>
          ${r.length > 1 ? n`<p class="key">${r.map((e) => `${a[e]}: ${o[e]}`).join(" · ")}</p>` : e}` : e}`;
	}
	static styles = [r, t`
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
customElements.get("rv-findings") || customElements.define("rv-findings", h);
//#endregion
export { c as a, m as i, p as n, l as o, d as r, u as s, f as t };

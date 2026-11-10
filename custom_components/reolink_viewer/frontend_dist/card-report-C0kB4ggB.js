import { a as e, n as t, r as n, t as r } from "./lit-DdRjbP0M.js";
import { Lt as i, Q as a, Z as o, d as s, f as c, j as l, n as u, nt as d, p as f } from "./live-49uKNz9D.js";
import { s as p, tt as m } from "./home-CG6KWgxh.js";
//#region src/live/card-report.ts
var h = /* @__PURE__ */ new Set([
	"visible",
	"screen on",
	"screensaver off",
	"page loaded",
	"page show",
	"resumed"
]), g = /* @__PURE__ */ new Set(["screen off", "screensaver on"]), _ = /^(\d+) frames; (visible|hidden)(; asleep)?/;
function v(e) {
	let t = {
		fully: void 0,
		asleep: 0,
		hidden: 0,
		back: [],
		notBack: 0,
		unseenFrames: 0,
		unseenCards: [],
		rings: 0,
		retries: {}
	}, n = /* @__PURE__ */ new Set(), r = /* @__PURE__ */ new Map(), i, a = () => {
		for (let e of r.values()) e.started && (t.notBack += 1);
		r.clear();
	};
	for (let o of e) {
		let e = o.card;
		if (o.what === "page loaded" && (t.fully = o.detail?.includes("interface on") ?? !1), g.has(o.what) && (t.asleep += 1), o.what === "hidden" && (t.hidden += 1), o.what === "ring" && (t.rings += 1), h.has(o.what)) {
			a(), i = o.at;
			for (let e of n) r.set(e, {
				at: o.at,
				started: !1
			});
		}
		if (!e) continue;
		n.has(e) || (n.add(e), i !== void 0 && r.set(e, {
			at: i,
			started: !1
		}));
		let s = r.get(e);
		if (o.what === "starting" || o.what === "retrying") s && (s.started = !0), o.what === "retrying" && (t.retries[e] = (t.retries[e] ?? 0) + 1);
		else if (o.what === "playing" && s) r.delete(e), o.at - s.at <= 6e5 && t.back.push((o.at - s.at) / 1e3);
		else if (o.what === "frames") {
			let n = _.exec(o.detail ?? "");
			if (n && (n[2] === "hidden" || n[3])) {
				let r = Number(n[1]);
				r > 0 && (t.unseenFrames += r, t.unseenCards.includes(e) || t.unseenCards.push(e));
			}
		}
	}
	return a(), t;
}
function y(e) {
	let t = [...e].sort((e, t) => e - t), n = Math.floor(t.length / 2);
	return t.length % 2 ? t[n] ?? 0 : ((t[n - 1] ?? 0) + (t[n] ?? 0)) / 2;
}
var b = (e) => `${String(e)} ${e === 1 ? "time" : "times"}`;
function x(e) {
	let t = [`Fully Kiosk's JavaScript interface: ${e.fully === void 0 ? "not seen" : e.fully ? "on" : "off"}`, `Screen off or screensaver (Fully Kiosk): ${b(e.asleep)} · page hidden: ${b(e.hidden)}`];
	e.back.length ? t.push(`Video back after the screen came on or the page was shown: median ${y(e.back).toFixed(1)} s, slowest ${Math.max(...e.back).toFixed(1)} s (${b(e.back.length)})`) : t.push("Video back after the screen came on or the page was shown: not seen yet"), e.notBack && t.push(`Started but not playing again before the next wake: ${b(e.notBack)}`), t.push(e.unseenFrames ? `Video decoded while nobody could see it: ${e.unseenFrames.toLocaleString("en-US")} frames (${e.unseenCards.join(", ")})` : "Video decoded while nobody could see it: none"), t.push(`Doorbell rings: ${String(e.rings)}`);
	let n = Object.entries(e.retries);
	return t.push(`Failed starts: ${n.length ? n.map(([e, t]) => `${e} ${String(t)}`).join(", ") : "none"}`), t;
}
function S(e, t) {
	let n = [], r = "";
	for (let i of e) {
		let e = c(i.at, t);
		e !== r && (r = e, n.push(e));
		let a = (i.card ?? "page").padEnd(18), o = i.what.padEnd(16);
		n.push(`${s(i.at, t, !0)}  ${a} ${o} ${i.detail ?? ""}`.trimEnd());
	}
	return n;
}
function C(e, t, n) {
	let r = [`Reolink Viewer dashboard cards report v${t}`];
	e.length || r.push("", "No dashboard card has reported yet.");
	for (let t of e) r.push("", `${t.device} · last heard from ${t.updated}`), r.push(...x(v(t.events))), r.push("", ...S(t.events, n));
	return r.join("\n");
}
//#endregion
//#region src/components/card-report.ts
var w = class extends r {
	static properties = {
		hass: { attribute: !1 },
		_state: { state: !0 },
		_confirm: { state: !0 }
	};
	_read = !1;
	constructor() {
		super(), this._state = "loading", this._confirm = !1;
	}
	updated() {
		!this._read && this.hass && this.refresh();
	}
	async refresh() {
		let e = this.hass;
		if (e) {
			this._read = !0, this._state = "loading";
			try {
				this._state = { devices: (await d(e)).devices };
			} catch (e) {
				this._state = { error: i(e).message };
			}
		}
	}
	async _startOver() {
		if (this._confirm = !1, this.hass) try {
			await a(this.hass), await this.refresh();
		} catch (e) {
			this._state = { error: i(e).message };
		}
	}
	render() {
		let e = this._state, r = this.hass?.config?.time_zone;
		return n`<div class="report-view" role="region" aria-label="Dashboard cards">
      <p class="intro">
        What the Reolink camera cards on your dashboards saw, on each device: the screen going off and on, video
        stopping and coming back, and whether any played while nobody could see it. Leave a wall tablet overnight, then
        read its night here.
      </p>
      <div class="actions">
        <button
          class="with-icon"
          @click=${() => {
			this.refresh();
		}}
        >
          ${o("refresh")}Refresh
        </button>
        ${typeof e == "object" && "devices" in e && e.devices.length ? n`<button
              @click=${() => {
			p({
				version: m,
				devices: e.devices
			}, `reolink-viewer-cards-${String(Date.now())}.json`);
		}}
            >
              Download
            </button>` : t}
        ${this._confirm ? t : n`<button
              @click=${() => {
			this._confirm = !0;
		}}
            >
              Start over…
            </button>`}
      </div>
      ${this._confirm ? n`<div class="banner warning confirm" role="alert">
            <span>Start over? What every device's cards noted is dropped.</span>
            <button
              @click=${() => {
			this._startOver();
		}}
            >
              Start over
            </button>
            <button
              @click=${() => {
			this._confirm = !1;
		}}
            >
              Cancel
            </button>
          </div>` : t}
      ${e === "loading" ? n`<p class="muted">Reading what the cards noted…</p>` : "error" in e ? n`<div class="banner error" role="alert">Could not read what the cards noted: ${e.error}</div>` : this._renderDevices(e, r)}
    </div>`;
	}
	_renderDevices(e, t) {
		if (!e.devices.length) return n`<p class="muted">No dashboard card has reported yet. Add a Reolink camera card to a dashboard and open it.</p>`;
		let r = C(e.devices, m, t);
		return n`${e.devices.map((e) => n`<section class="device">
          <h2>${e.device}</h2>
          <p class="muted small">Last heard from ${T(e.updated, t)}</p>
          <ul>
            ${x(v(e.events)).map((e) => n`<li>${e}</li>`)}
          </ul>
        </section>`)}
      <details class="support">
        <summary>Every event${o("chevronDown")}</summary>
        <div class="actions">
          <button
            @click=${() => {
			u(r).then((t) => {
				this._state = {
					...e,
					copied: t
				};
			});
		}}
          >
            ${e.copied === void 0 ? "Copy report" : e.copied ? "Copied" : "Could not copy"}
          </button>
        </div>
        <pre class="report">${r}</pre>
      </details>`;
	}
	static styles = [l, e`
      :host {
        display: block;
      }
      .report-view {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .intro {
        margin: 0;
        font-size: 17px;
      }
      .device h2 {
        margin: 0;
        font-size: 18px;
      }
      .device p {
        margin: 2px 0 6px;
      }
      .device ul {
        margin: 0;
        padding-left: 20px;
      }
      .confirm {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px 12px;
      }
      .confirm span {
        flex: 1;
        min-width: 14em;
        font-weight: 500;
      }
      details.support {
        border-top: 2px solid var(--rv-rule-strong);
        padding-top: 6px;
      }
      details.support > .actions {
        margin: 6px 0 10px;
      }
    `];
};
function T(e, t) {
	let n = Date.parse(e);
	return Number.isNaN(n) ? e : f(n, t);
}
customElements.get("rv-card-report") || customElements.define("rv-card-report", w);
//#endregion
export { w as RvCardReport };

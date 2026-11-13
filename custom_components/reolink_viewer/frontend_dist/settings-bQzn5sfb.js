import { a as e, n as t, r as n, t as r } from "./lit-DdRjbP0M.js";
import { P as i, Vt as a, et as o, rt as s, st as c } from "./live-B3rIzIdQ.js";
import { $ as l, a as u, n as d } from "./home-PCSob070.js";
//#region src/catalog.ts
var f = {
	id: "other",
	title: "Other",
	description: "Entities this version of Reolink Viewer does not know yet."
};
function p(e, t, n) {
	if (e && n !== null) return e.entities[t]?.[n];
}
function m(e, t) {
	let n = t.indexOf(".");
	if (!(n < 0)) return p(e, t.slice(0, n), t.slice(n + 1));
}
function h(e) {
	return [...e?.categories ?? [], f];
}
function g(e, t) {
	if (e?.impact !== "disruptive") return null;
	let n = e.disruptive_when ?? "any", r;
	return r = Array.isArray(n) ? typeof t == "object" && n.includes(t.option) : n === "any" || t === n, r ? e.impact_note ?? "This action can disrupt the camera." : null;
}
function _(e, t) {
	return e.name ?? t?.title ?? e.entity_id;
}
var v = (e) => e.toLowerCase();
function y(e, t, n) {
	let r = v(n).split(/\s+/).filter(Boolean);
	if (!r.length) return !0;
	let i = v([
		e.name ?? "",
		e.entity_id,
		e.sub_device ?? "",
		t?.title ?? "",
		t?.summary ?? "",
		t?.what_it_does ?? ""
	].join(" "));
	return r.every((e) => i.includes(e));
}
//#endregion
//#region src/services.ts
function b(e, t) {
	switch (e) {
		case "switch":
		case "light":
		case "siren": return {
			domain: e,
			service: t === !0 ? "turn_on" : "turn_off",
			data: {}
		};
		case "number": return {
			domain: e,
			service: "set_value",
			data: { value: t }
		};
		case "select": return {
			domain: e,
			service: "select_option",
			data: { option: t }
		};
		case "time": return {
			domain: e,
			service: "set_value",
			data: { time: t }
		};
		case "button": return {
			domain: e,
			service: "press",
			data: {}
		};
		case "update": return {
			domain: e,
			service: "install",
			data: {}
		};
		default: throw Error(`${e} entities cannot be changed`);
	}
}
function x(e) {
	return {
		domain: "light",
		service: "turn_on",
		data: { brightness_pct: e }
	};
}
//#endregion
//#region src/writes.ts
var S = 1e4, C = class {
	_now;
	_pending = /* @__PURE__ */ new Map();
	constructor(e = () => Date.now()) {
		this._now = e;
	}
	begin(e, t, n) {
		let r = {
			value: t,
			base: n,
			confirmedAt: null
		};
		return this._pending.set(e, r), r;
	}
	confirm(e, t) {
		this._pending.get(e) === t && (t.confirmedAt = this._now());
	}
	fail(e, t) {
		return this._pending.get(e) === t && (this._pending.delete(e), !0);
	}
	isPending(e) {
		return this._pending.get(e)?.confirmedAt === null;
	}
	valueFor(e) {
		return this._pending.get(e)?.value;
	}
	settle(e) {
		let t = !1, n = this._now();
		for (let [r, i] of this._pending) {
			let a = i.confirmedAt !== null && n - i.confirmedAt > 1e4;
			(e[r] !== i.base || a) && (this._pending.delete(r), t = !0);
		}
		return t;
	}
	get size() {
		return this._pending.size;
	}
}, w = [
	"detection",
	"smart_zones",
	"image",
	"lighting",
	"streams",
	"recording",
	"notifications",
	"audio",
	"siren",
	"power"
], T = /* @__PURE__ */ new Set([
	"switch",
	"number",
	"select",
	"light",
	"time"
]), E = {
	"switch.manual_record": "starts a recording now",
	"select.play_quick_reply_message": "plays a message now",
	"light.floodlight": "turns the light on now"
};
function D(e) {
	return e.domain === "text" || /(^|_)(osd|name)(_|$)/.test(e.key ?? "");
}
var O = /* @__PURE__ */ new Set(["unavailable", "unknown"]);
function k(e) {
	return e.key !== null && e.sub_device === null && e.disabled_by === null && e.entity_category !== "diagnostic" && T.has(e.domain) && w.includes(e.category) && !(`${e.domain}.${e.key}` in E) && !D(e);
}
var A = (e) => `${e.domain}.${e.key ?? ""}`;
function j(e) {
	let t = /* @__PURE__ */ new Map(), n = /* @__PURE__ */ new Set();
	for (let r of e) {
		if (r.key === null || r.sub_device !== null) continue;
		let e = A(r);
		t.has(e) && n.add(e), t.set(e, r);
	}
	for (let e of n) t.delete(e);
	return t;
}
function M(e, t, n) {
	let r = j(e), i = [];
	for (let e of r.values()) {
		if (!k(e) || !n.has(e.category)) continue;
		let r = t[e.entity_id];
		r && !O.has(r.state) && (e.domain !== "switch" && e.domain !== "light" || ["on", "off"].includes(r.state)) && i.push({
			entity: e,
			value: r.state
		});
	}
	return i;
}
function N(e, t) {
	let n = /* @__PURE__ */ new Map();
	for (let r of M(e, t, new Set(w))) n.set(r.entity.category, (n.get(r.entity.category) ?? 0) + 1);
	return n;
}
function P(e, t) {
	let n = e.attributes[t];
	return typeof n == "number" && Number.isFinite(n) ? n : void 0;
}
var F = (e) => e.length === 5 ? `${e}:00` : e;
function I(e, t, n) {
	return e === "number" ? Number(t) === Number(n) : e === "time" ? F(t) === F(n) : t === n;
}
function L(e, t, n) {
	if (e === "select") {
		let e = n.attributes.options;
		if (Array.isArray(e) && !e.includes(t)) return `It does not offer “${t}”`;
	}
	if (e === "number") {
		let e = Number(t), r = P(n, "min"), i = P(n, "max"), a = P(n, "step");
		if (!Number.isFinite(e)) return "Not a number";
		if (r !== void 0 && e < r || i !== void 0 && e > i) return `It takes ${String(r ?? "…")} to ${String(i ?? "…")}`;
		if (a !== void 0 && a > 0) {
			let t = (e - (r ?? 0)) / a;
			if (Math.abs(t - Math.round(t)) > 1e-6) return `It takes steps of ${String(a)}`;
		}
	}
}
function R(e, t, n) {
	let r = j(t);
	return e.map((e) => {
		let t = r.get(A(e.entity)), i = e.entity.domain, a, o = t ? n[t.entity_id] : void 0;
		if (!t) a = {
			kind: "cannot",
			reason: "This camera has no such setting"
		};
		else if (t.disabled_by !== null) a = {
			kind: "cannot",
			reason: "Turned off in Home Assistant on this camera"
		};
		else if (!o || O.has(o.state)) a = {
			kind: "cannot",
			reason: "Not available now"
		};
		else if (I(i, o.state, e.value)) a = { kind: "same" };
		else {
			let t = L(i, e.value, o);
			a = t ? {
				kind: "cannot",
				reason: t
			} : {
				kind: "change",
				from: o.state
			};
		}
		return {
			setting: e,
			target: t,
			verdict: a
		};
	});
}
function z(e, t) {
	return e === "switch" || e === "light" ? b(e, t === "on") : e === "number" ? b(e, Number(t)) : b(e, t);
}
function B(e, t, n) {
	return n !== void 0 && I(e, n.state, t);
}
function V(e, t) {
	return e === "switch" || e === "light" ? t === "on" ? "on" : "off" : e === "select" ? { option: t } : "any";
}
//#endregion
//#region src/components/copy-settings.ts
function H(e) {
	let t;
	for (let n of e) (!t || n.entities.length > t.entities.length) && (t = n);
	return t;
}
var U = class extends r {
	static properties = {
		hass: { attribute: !1 },
		source: { attribute: !1 },
		sourceId: { attribute: !1 },
		sourceName: { attribute: !1 },
		sourceModel: { attribute: !1 },
		cameras: { attribute: !1 },
		catalog: { attribute: !1 },
		_stage: { state: !0 },
		_categories: { state: !0 },
		_targets: { state: !0 },
		_plans: { state: !0 },
		_sent: { state: !0 }
	};
	_settleTimer;
	constructor() {
		super(), this.sourceId = "", this.sourceName = "", this.sourceModel = null, this.cameras = [], this._stage = "choose", this._categories = /* @__PURE__ */ new Set(), this._targets = /* @__PURE__ */ new Set(), this._sent = /* @__PURE__ */ new Map();
	}
	connectedCallback() {
		super.connectedCallback(), document.addEventListener("keydown", this._onKey);
	}
	disconnectedCallback() {
		super.disconnectedCallback(), document.removeEventListener("keydown", this._onKey), clearTimeout(this._settleTimer);
	}
	firstUpdated() {
		this.renderRoot.querySelector("h2")?.focus();
	}
	_onKey = (e) => {
		e.key === "Escape" && this._stage !== "applying" && this._close();
	};
	_close() {
		this.dispatchEvent(new CustomEvent("rv-close", {
			bubbles: !0,
			composed: !0
		}));
	}
	get _otherCameras() {
		let e = (e) => this.sourceModel !== null && e.model === this.sourceModel ? 0 : 1;
		return this.cameras.filter((e) => e.id !== this.sourceId && e.connections.length > 0).sort((t, n) => e(t) - e(n) || (t.name ?? "").localeCompare(n.name ?? ""));
	}
	_label(e) {
		let t = p(this.catalog, e.domain, e.key);
		return t?.title ?? _(e, t);
	}
	_value(e, t) {
		if (e.domain === "switch" || e.domain === "light") return t === "on" ? "On" : "Off";
		if (e.domain === "select") return u(t);
		if (e.domain === "time") return t.slice(0, 5);
		let n = this.hass?.states[e.entity_id]?.attributes.unit_of_measurement;
		return typeof n == "string" && n ? `${t} ${n}` : t;
	}
	async _preview() {
		let e = this.hass, t = this.source;
		if (!e || !t) return;
		this._stage = "preview", this._plans = void 0;
		let n = M(t.entities, e.states, this._categories), r = this._otherCameras.filter((e) => this._targets.has(e.id));
		this._plans = await Promise.all(r.map(async (t) => {
			try {
				let r = H((await c(e, t.id)).connections);
				return {
					camera: t,
					items: R(n, r?.entities ?? [], this.hass?.states ?? e.states)
				};
			} catch (e) {
				return {
					camera: t,
					items: [],
					error: a(e).message
				};
			}
		}));
	}
	async _apply() {
		let e = this.hass, t = this._plans;
		if (e && t) {
			this._stage = "applying";
			for (let n of t) for (let t of n.items) {
				if (t.verdict.kind !== "change" || !t.target) continue;
				let n = z(t.target.domain, t.setting.value), r;
				try {
					await e.callService(n.domain, n.service, n.data, { entity_id: t.target.entity_id }, !1), r = { at: performance.now() };
				} catch (e) {
					r = { refused: a(e).message };
				}
				this._sent = new Map([...this._sent, [t.target.entity_id, r]]);
			}
			this._stage = "done", this._settleTimer = setTimeout(() => {
				this.requestUpdate();
			}, S + 100);
		}
	}
	render() {
		return n`<div class="scrim">
      <div class="dialog card" role="dialog" aria-modal="true" aria-labelledby="copy-title">
        <h2 id="copy-title" tabindex="-1">Copy settings from ${this.sourceName}</h2>
        ${this._stage === "choose" ? this._renderChoose() : this._renderPlans()}
      </div>
    </div>`;
	}
	_renderChoose() {
		let e = this.hass && this.source ? N(this.source.entities, this.hass.states) : /* @__PURE__ */ new Map(), r = h(this.catalog).filter((t) => w.includes(t.id) && e.get(t.id)), i = this._otherCameras, a = (e, t, n) => {
			let r = new Set(e);
			return n ? r.add(t) : r.delete(t), r;
		};
		return n`
      <p class="muted small">Choose what to copy, and to which cameras. Nothing changes until you have seen what will.</p>
      <fieldset>
        <legend>What</legend>
        ${r.length ? r.map((t) => n`<label class="choice">
                <input
                  type="checkbox"
                  .checked=${this._categories.has(t.id)}
                  @change=${(e) => {
			this._categories = a(this._categories, t.id, e.target.checked);
		}}
                />
                <span>${t.title} <span class="muted">${e.get(t.id)}</span></span>
              </label>`) : n`<p class="muted small">This camera has no settings that can be copied.</p>`}
      </fieldset>
      <fieldset>
        <legend>To</legend>
        ${i.length ? i.map((e) => n`<label class="choice">
                <input
                  type="checkbox"
                  .checked=${this._targets.has(e.id)}
                  @change=${(t) => {
			this._targets = a(this._targets, e.id, t.target.checked);
		}}
                />
                <span
                  >${e.name ?? e.id}
                  ${e.model ? n`<span class="muted small">${e.model}</span>` : t}
                  ${this.sourceModel !== null && e.model === this.sourceModel ? n`<span class="badge">Same model</span>` : t}</span
                >
              </label>`) : n`<p class="muted small">There is no other camera to copy to.</p>`}
      </fieldset>
      <p class="muted small">
        Never copied: the camera's name and on-screen text, and its pan, tilt and zoom, privacy and system settings.
      </p>
      <div class="actions">
        <button @click=${() => {
			this._close();
		}}>Cancel</button>
        <button
          class="primary"
          ?disabled=${!this._categories.size || !this._targets.size}
          @click=${() => void this._preview()}
        >
          Preview
        </button>
      </div>
    `;
	}
	_renderPlans() {
		let e = this._plans;
		if (!e) return n`<p class="muted" role="status">Reading the other cameras' settings…</p>`;
		let t = e.reduce((e, t) => e + t.items.filter((e) => e.verdict.kind === "change").length, 0), r = this._stage;
		return n`
      ${r === "preview" ? n`<p class="muted small">
            ${t ? `${String(t)} ${t === 1 ? "setting changes" : "settings change"}, each through Home Assistant, one at a time.` : "Nothing to change: these cameras already have these settings, or cannot take them."}
          </p>` : this._renderSummary(e)}
      <div class="plans">${e.map((e) => this._renderPlan(e))}</div>
      <div class="actions">
        ${r === "preview" ? n`<button @click=${() => {
			this._stage = "choose";
		}}>Back</button>
              <button class="primary" ?disabled=${!t} @click=${() => void this._apply()}>
                ${t ? `Copy ${String(t)} ${t === 1 ? "change" : "changes"}` : "Nothing to copy"}
              </button>` : n`<button class="primary" ?disabled=${r === "applying"} @click=${() => {
			this._close();
		}}>Done</button>`}
      </div>
    `;
	}
	_renderSummary(e) {
		let t = 0, r = 0, i = 0;
		for (let n of e) for (let e of n.items) {
			if (e.verdict.kind !== "change" || !e.target) continue;
			let n = this._status(e);
			n.kind === "changed" ? t += 1 : n.kind === "refused" || n.kind === "unchanged" ? r += 1 : i += 1;
		}
		let a = [`${String(t)} changed`];
		return r && a.push(`${String(r)} not`), i && a.push(`${String(i)} waiting for the camera`), n`<p class="small" role="status">${this._stage === "applying" ? "Copying… " : ""}${a.join(", ")}.</p>`;
	}
	_status(e) {
		let t = e.target;
		if (!t) return { kind: "pending" };
		let n = this._sent.get(t.entity_id);
		if (!n) return { kind: this._stage === "applying" ? "sending" : "pending" };
		if ("refused" in n) return {
			kind: "refused",
			reason: n.refused
		};
		let r = this.hass?.states[t.entity_id];
		return B(t.domain, e.setting.value, r) ? { kind: "changed" } : performance.now() - n.at < 1e4 ? { kind: "sending" } : {
			kind: "unchanged",
			shows: r ? this._value(t, r.state) : "nothing"
		};
	}
	_renderPlan(e) {
		let r = e.items.filter((e) => e.verdict.kind === "change"), i = e.items.filter((e) => e.verdict.kind === "same").length, a = e.items.filter((e) => e.verdict.kind === "cannot"), o = this.sourceModel !== null && e.camera.model === this.sourceModel;
		return n`<section class="plan">
      <h3>
        ${e.camera.name ?? e.camera.id}
        ${o ? n`<span class="badge">Same model</span>` : t}
      </h3>
      ${e.error ? n`<p class="small fault">Its settings could not be read: ${e.error}</p>` : n`
            ${r.length ? n`<ul class="changes">
                  ${r.map((e) => this._renderChange(e))}
                </ul>` : t}
            ${i ? n`<p class="muted small">${i} already the same.</p>` : t}
            ${a.length ? n`<p class="small cannot-head">Cannot take</p>
                  <ul class="cannot">
                    ${a.map((e) => n`<li class="small">
                        ${this._label(e.setting.entity)}:
                        <span class="muted">${e.verdict.kind === "cannot" ? e.verdict.reason : ""}</span>
                      </li>`)}
                  </ul>` : t}
          `}
    </section>`;
	}
	_renderChange(e) {
		let r = e.setting.entity, i = e.verdict.kind === "change" ? e.verdict.from : "", a = g(p(this.catalog, r.domain, r.key), V(r.domain, e.setting.value)), o = this._stage === "preview" ? void 0 : this._status(e);
		return n`<li data-entity-id=${e.target?.entity_id ?? ""}>
      <span class="what">${this._label(r)}</span>
      <span class="values">
        <span class="muted">${this._value(r, i)}</span> → <strong>${this._value(r, e.setting.value)}</strong>
      </span>
      ${o ? n`<span class="status ${o.kind}">${W(o)}</span>` : t}
      ${a ? n`<span class="warning small">${a}</span>` : t}
    </li>`;
	}
	static styles = [i, e`
      .scrim {
        position: fixed;
        inset: 0;
        z-index: 10;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(17, 20, 24, 0.55);
      }
      .dialog {
        width: min(640px, calc(100vw - 32px));
        max-height: calc(100vh - 32px);
        overflow: auto;
        margin: 16px;
        padding: 20px 22px;
        background: var(--rv-ground);
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
      }
      h2 {
        margin: 0 0 6px;
        font-family: var(--rv-font-cond);
        font-size: 22px;
        font-weight: 600;
      }
      h2:focus {
        outline: none;
      }
      fieldset {
        margin: 12px 0 0;
        padding: 0;
        border: 0;
      }
      legend {
        margin-bottom: 4px;
        font-weight: 600;
      }
      .choice {
        display: flex;
        align-items: center;
        gap: 10px;
        min-height: 36px;
      }
      .choice input {
        width: 18px;
        height: 18px;
        margin: 0;
      }
      .badge {
        margin-left: 6px;
      }
      .plans {
        display: grid;
        gap: 14px;
        margin-top: 10px;
      }
      h3 {
        margin: 0 0 6px;
        font-size: 17px;
      }
      ul {
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .changes li {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 2px 12px;
        padding: 6px 0;
        border-top: 1px solid var(--rv-rule);
      }
      .changes .status,
      .changes .warning {
        grid-column: 1 / -1;
      }
      .status.changed {
        color: var(--rv-good, inherit);
      }
      .status.refused,
      .status.unchanged,
      .fault {
        color: var(--rv-fault);
      }
      .warning {
        color: var(--rv-muted);
      }
      .cannot-head {
        margin: 8px 0 2px;
        font-weight: 600;
      }
      .actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 16px;
      }
    `];
};
function W(e) {
	switch (e.kind) {
		case "pending": return "Not sent";
		case "sending": return "Sending…";
		case "changed": return "Changed";
		case "refused": return `Refused: ${e.reason}`;
		case "unchanged": return `Sent, but it still shows ${e.shows}`;
	}
}
customElements.get("rv-copy-settings") || customElements.define("rv-copy-settings", U);
//#endregion
//#region src/components/settings.ts
var G = 1, K = class extends r {
	static properties = {
		hass: { attribute: !1 },
		device: { attribute: !1 },
		catalog: { attribute: !1 },
		cameras: { attribute: !1 },
		_connection: { state: !0 },
		_copying: { state: !0 },
		_search: { state: !0 },
		_showDisabled: { state: !0 },
		_open: { state: !0 },
		_confirm: { state: !0 },
		_enabling: { state: !0 }
	};
	writes = new C();
	renderMs;
	_created = performance.now();
	_settleTimer;
	constructor() {
		super(), this._search = "", this.cameras = [], this._copying = !1, this._showDisabled = !1, this._open = /* @__PURE__ */ new Set(), this._enabling = /* @__PURE__ */ new Set();
	}
	disconnectedCallback() {
		super.disconnectedCallback(), clearTimeout(this._settleTimer), this._confirm?.resolve(!1), this._confirm = void 0;
	}
	willUpdate(e) {
		e.has("hass") && this.hass && this.writes.settle(this.hass.states);
	}
	firstUpdated() {
		this.renderMs = performance.now() - this._created, this.dataset.renderMs = this.renderMs.toFixed(1);
	}
	get connection() {
		let e = this.device?.connections ?? [];
		if (this._connection !== void 0) return e[this._connection];
		let t;
		for (let n of e) (!t || n.entities.length > t.entities.length) && (t = n);
		return t;
	}
	_rows(e) {
		let t = /* @__PURE__ */ new Map();
		for (let n of e.entities) {
			if (n.disabled_by !== null && !this._showDisabled) continue;
			let e = p(this.catalog, n.domain, n.key);
			if (!y(n, e, this._search)) continue;
			let r = t.get(n.category) ?? [];
			r.push({
				entity: n,
				entry: e,
				label: _(n, e)
			}), t.set(n.category, r);
		}
		for (let e of t.values()) e.sort((e, t) => e.label.localeCompare(t.label));
		return t;
	}
	render() {
		let e = this.connection;
		if (!this.device || !e) return n`<p class="muted">No settings.</p>`;
		let r = this._rows(e), i = e.entities.filter((e) => e.disabled_by !== null).length, a = h(this.catalog).filter((e) => r.has(e.id));
		return n`
      <div class="toolbar">
        <input
          class="search"
          type="search"
          placeholder="Search settings"
          aria-label="Search settings"
          .value=${this._search}
          @input=${(e) => {
			this._search = e.target.value;
		}}
        />
        <label class="small">
          <input
            type="checkbox"
            .checked=${this._showDisabled}
            @change=${(e) => {
			this._showDisabled = e.target.checked;
		}}
          />
          Show disabled entities (${i})
        </label>
        ${this._canCopy() ? n`<button class="copy" @click=${() => {
			this._copying = !0;
		}}>Copy to…</button>` : t}
      </div>
      ${this._renderConnections()}
      ${this._showDisabled ? n`<p class="banner info small">
            Home Assistant creates some Reolink entities disabled.
            ${this.hass?.user?.is_admin ? "Enabling one makes Home Assistant reload the Reolink integration entry for this device after about 30 seconds; its entities are briefly unavailable and the new one appears then." : "An administrator can enable them."}
          </p>` : t}
      ${a.length ? a.map((e) => n`<section class="category">
              <h2>${e.title}</h2>
              <p class="muted small">${e.description}</p>
              <ul class="rows">
                ${(r.get(e.id) ?? []).map((e) => this._renderRow(e))}
              </ul>
            </section>`) : n`<p class="muted">No settings match “${this._search}”.</p>`}
      ${this._renderConfirm()}
      ${this._copying && this.device.node.kind === "camera" ? n`<rv-copy-settings
            .hass=${this.hass}
            .source=${e}
            .sourceId=${this.device.node.id}
            .sourceName=${this.device.node.name ?? "this camera"}
            .sourceModel=${this.device.node.model}
            .cameras=${this.cameras}
            .catalog=${this.catalog}
            @rv-close=${() => {
			this._copying = !1;
		}}
          ></rv-copy-settings>` : t}
    `;
	}
	_canCopy() {
		let e = this.device?.node;
		return e?.kind === "camera" && this.cameras.some((t) => t.id !== e.id && t.connections.length > 0);
	}
	_renderConnections() {
		let e = this.device?.connections ?? [];
		if (e.length < 2) return t;
		let r = this.connection;
		return n`<div class="connections" role="radiogroup" aria-label="Settings through">
      <span class="small muted">Settings through</span>
      ${e.map((e, t) => n`<button
          role="radio"
          aria-checked=${e === r ? "true" : "false"}
          class=${e === r ? "primary" : ""}
          @click=${() => {
			this._connection = t;
		}}
        >
          ${d(e)} · ${e.entities.length} settings
        </button>`)}
      <span class="small muted">
        Both connections reach the same camera; a change made through either applies to it.
      </span>
    </div>`;
	}
	_renderRow(e) {
		let { entity: r, entry: i, label: a } = e, s = this._open.has(r.entity_id);
		return n`<li class="row" data-entity-id=${r.entity_id}>
      <div class="info">
        <div class="label">
          ${a}
          ${r.sub_device ? n`<span class="badge">${r.sub_device}</span>` : t}
          ${r.disabled_by === null ? t : n`<span class="badge">Turned off</span>`}
          ${r.hidden_by === null ? t : n`<span class="badge">Hidden</span>`}
          ${r.entity_category === "diagnostic" ? n`<span class="badge">Read only</span>` : t}
          ${i?.impact === "disruptive" ? n`<span class="badge warning" title=${i.impact_note ?? ""}>Asks first</span>` : t}
        </div>
        ${i ? n`<div class="muted small">${i.summary}</div>` : t}
      </div>
      <div class="control">${this._renderControl(r, a)}</div>
      ${i ? n`<details
            class="about"
            .open=${s}
            @toggle=${(e) => {
			this._setOpen(r.entity_id, e.target.open);
		}}
          >
            <summary class="small" aria-label=${`About this setting: ${a}`}>About this setting${o("chevronDown")}</summary>
            ${s ? this._renderAbout(i) : t}
          </details>` : t}
    </li>`;
	}
	_setOpen(e, t) {
		if (this._open.has(e) === t) return;
		let n = new Set(this._open);
		t ? n.add(e) : n.delete(e), this._open = n;
	}
	_renderAbout(e) {
		let r = e.related.map((e) => m(this.catalog, e)?.title).filter((e) => e !== void 0);
		return n`<div class="about-body small">
      ${e.verification === "unverified" ? n`<p class="unverified">
            <span class="badge warning">unverified</span> Reolink does not document exactly what
            this does; the text says only what is known.
          </p>` : t}
      <p>${e.what_it_does}</p>
      ${e.tradeoffs ? n`<p><strong>Trade-offs:</strong> ${e.tradeoffs}</p>` : t}
      ${e.impact === "disruptive" ? n`<p><strong>Impact:</strong> ${e.impact_note}</p>` : t}
      <p><strong>Requires:</strong> ${e.requires}</p>
      ${e.notes ? n`<p>${e.notes}</p>` : t}
      ${r.length ? n`<p><strong>Related:</strong> ${r.join(", ")}</p>` : t}
      <p>
        <strong>Sources:</strong>
        ${e.sources.map((e, t) => n`${t ? ", " : ""}<a href=${e.url} target="_blank" rel="noreferrer"
              >${e.title}</a
            >`)}
      </p>
    </div>`;
	}
	_renderControl(e, t) {
		if (e.disabled_by !== null) {
			if (!this.hass?.user?.is_admin) return n`<span class="muted small">Disabled</span>`;
			let r = this._enabling.has(e.entity_id);
			return n`<button ?disabled=${r} @click=${() => void this._enable(e, t)}>
        ${r ? "Enabling…" : "Enable"}
      </button>`;
		}
		let r = this.hass?.states[e.entity_id];
		if (!r) return n`<span class="muted small">Not loaded yet</span>`;
		let i = e.entity_id, a = this.writes.isPending(i), o = this.writes.valueFor(i), s = r.state === "unavailable" || a;
		switch (e.domain) {
			case "switch":
			case "siren": return this._toggle(e, t, o ?? r.state === "on", s && !a);
			case "light": return this._light(e, t, r, o, s && !a);
			case "number": return this._number(e, t, r, o, s);
			case "select": return this._select(e, t, r, o, s);
			case "time": return n`<input
          type="time"
          step="1"
          aria-label=${t}
          .value=${String(o ?? (/^\d\d:\d\d/.test(r.state) ? r.state : ""))}
          ?disabled=${s}
          @change=${(n) => {
				let r = n.target.value;
				r && this._write(e, t, r, "any");
			}}
        />`;
			case "button": return n`<button
          ?disabled=${s}
          @click=${() => void this._write(e, t, "press", "any")}
        >
          ${a ? "Working…" : t}
        </button>`;
			case "update": return this._update(e, t, r, a);
			default: return n`<span class="value">${J(r, e.domain)}</span>`;
		}
	}
	_toggle(e, t, r, i) {
		let a = r === !0;
		return n`<button
      class="toggle ${a ? "on" : ""}"
      role="switch"
      aria-label=${t}
      aria-checked=${a ? "true" : "false"}
      ?disabled=${i}
      @click=${() => void this._write(e, t, !a, a ? "off" : "on")}
    >
      <span class="knob"></span>
    </button>`;
	}
	_light(e, r, i, a, o) {
		let s = i.attributes.supported_color_modes, c = Array.isArray(s) && s.some((e) => e !== "onoff"), l = i.attributes.brightness, u = typeof l == "number" ? Math.round(l / 255 * 100) : 0, d = typeof a == "boolean" ? a : i.state === "on";
		return n`<span class="light">
      ${c && d ? n`<input
            type="range"
            min="1"
            max="100"
            aria-label="${r} brightness"
            .value=${String(typeof a == "number" ? a : u)}
            ?disabled=${o}
            @change=${(t) => {
			let n = Number(t.target.value);
			this._write(e, r, n, "on", x(n));
		}}
          />` : t}
      ${this._toggle(e, r, d, o)}
    </span>`;
	}
	_number(e, r, i, a, o) {
		let s = i.attributes, c = q(s.min, 0), l = q(s.max, 100), u = q(s.step, 1), d = typeof s.unit_of_measurement == "string" ? s.unit_of_measurement : "", f = Number(i.state), p = typeof a == "number" ? a : f, m = Number.isFinite(p) ? String(p) : "", h = (t) => {
			let n = t.target, i = Number(n.value);
			n.value === "" || !Number.isFinite(i) || i < c || i > l ? n.value = m : i !== p && this._write(e, r, i, "any");
		};
		return n`<span class="number">
      ${s.mode === "box" ? t : n`<input
            type="range"
            min=${c}
            max=${l}
            step=${u}
            aria-label=${r}
            .value=${m}
            ?disabled=${o}
            @input=${(e) => {
			let t = e.target.nextElementSibling;
			t && (t.value = e.target.value);
		}}
            @change=${h}
          />`}
      <input
        class="box"
        type="number"
        min=${c}
        max=${l}
        step=${u}
        aria-label="${r} value"
        .value=${m}
        ?disabled=${o}
        @change=${h}
      />
      ${d ? n`<span class="unit muted small">${d}</span>` : t}
    </span>`;
	}
	_select(e, r, i, a, o) {
		let s = Array.isArray(i.attributes.options) ? i.attributes.options.map(String) : [], c = typeof a == "string" ? a : i.state;
		return n`<select
      aria-label=${r}
      ?disabled=${o}
      @change=${(t) => {
			let n = t.target, i = n.value;
			n.value = c, this._write(e, r, i, { option: i });
		}}
    >
      ${s.includes(c) ? t : n`<option value="" selected>—</option>`}
      ${s.map((e) => n`<option value=${e} ?selected=${e === c}>${u(e)}</option>`)}
    </select>`;
	}
	_update(e, r, i, a) {
		let o = i.attributes, s = typeof o.installed_version == "string" ? o.installed_version : "?", c = typeof o.latest_version == "string" ? o.latest_version : null, l = typeof o.supported_features == "number" ? o.supported_features : 0, u = o.in_progress === !0 || a, d = i.state === "on" && (l & G) !== 0;
		return n`<span class="update small">
      <span>
        ${s}${c && c !== s ? n` → <strong>${c}</strong>` : t}
        ${i.state === "off" ? n`<span class="muted">(up to date)</span>` : t}
      </span>
      ${d || u ? n`<button
            ?disabled=${u}
            @click=${() => void this._write(e, r, "install", "any")}
          >
            ${u ? "Installing…" : "Install"}
          </button>` : t}
    </span>`;
	}
	async _write(e, t, n, r, i) {
		let o = this.hass;
		if (!o) return;
		let s = g(p(this.catalog, e.domain, e.key), r);
		if (s !== null && !await this.confirm(t, s)) return;
		let c = i ?? b(e.domain, e.domain === "button" ? "press" : e.domain === "update" ? "install" : n), u = e.entity_id, d = this.writes.begin(u, n, o.states[u]);
		this.requestUpdate();
		try {
			await o.callService(c.domain, c.service, c.data, { entity_id: u }, !1), this.writes.confirm(u, d), this._scheduleSettle();
		} catch (e) {
			this.writes.fail(u, d) && l(this, `Could not change ${t}: ${a(e).message}`, "error");
		}
		this.requestUpdate();
	}
	_scheduleSettle() {
		clearTimeout(this._settleTimer), this._settleTimer = setTimeout(() => {
			this.hass && this.writes.settle(this.hass.states) && this.requestUpdate(), this.writes.size && this._scheduleSettle();
		}, S + 100);
	}
	confirm(e, t) {
		return this._confirm?.resolve(!1), new Promise((n) => {
			this._confirm = {
				title: e,
				message: t,
				resolve: (e) => {
					this._confirm = void 0, n(e);
				}
			};
		});
	}
	_renderConfirm() {
		let e = this._confirm;
		return e ? n`<div class="scrim" @click=${() => {
			e.resolve(!1);
		}}>
      <div
        class="dialog card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        @click=${(e) => {
			e.stopPropagation();
		}}
      >
        <h2 id="confirm-title">${e.title}</h2>
        <p>${e.message}</p>
        <p class="muted small">Do you want to continue?</p>
        <div class="actions">
          <button @click=${() => {
			e.resolve(!1);
		}}>Cancel</button>
          <button class="danger" @click=${() => {
			e.resolve(!0);
		}}>Continue</button>
        </div>
      </div>
    </div>` : t;
	}
	async _enable(e, t) {
		let n = this.hass;
		if (n) {
			this._enabling = /* @__PURE__ */ new Set([...this._enabling, e.entity_id]);
			try {
				let r = (await s(n, e.entity_id)).reload_delay;
				l(this, `${t} enabled. Home Assistant reloads the Reolink entry${r ? ` in about ${r} seconds` : ""}; the entity becomes available after that.`), this.dispatchEvent(new CustomEvent("rv-entity-enabled", {
					bubbles: !0,
					composed: !0
				}));
			} catch (e) {
				l(this, `Could not enable ${t}: ${a(e).message}`, "error");
			} finally {
				let t = new Set(this._enabling);
				t.delete(e.entity_id), this._enabling = t;
			}
		}
	}
	static styles = [i, e`
      :host {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .toolbar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 12px;
      }
      .search {
        flex: 1;
        min-width: 180px;
        padding: 8px 10px;
      }
      .connections {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
      }
      .connections button {
        min-height: 34px;
        padding: 0 12px;
        border: 1px solid var(--rv-rule);
        font-size: 15px;
      }
      .connections button[aria-checked="true"],
      .connections button[aria-checked="true"]:hover {
        background: var(--rv-text);
        border-color: var(--rv-text);
        color: var(--rv-ground);
      }
      .category {
        margin-top: 16px;
        padding-top: 14px;
        border-top: 2px solid var(--rv-rule-strong);
      }
      .category h2 {
        margin: 0 0 2px;
        font-family: var(--rv-font-cond);
        font-size: 21px;
        font-weight: 600;
      }
      .category > p {
        margin: 0;
      }
      ul.rows {
        list-style: none;
        margin: 10px 0 0;
        padding: 0;
      }
      .row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 4px 16px;
        align-items: center;
        padding: 10px 0;
        border-top: 1px solid var(--rv-rule);
      }
      .label {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: center;
        font-size: 16px;
        font-weight: 500;
      }
      .control {
        justify-self: end;
      }
      .about {
        grid-column: 1 / -1;
      }
      .about summary {
        min-height: 28px;
        color: var(--rv-action);
        font-weight: 400;
      }
      .about-body p {
        margin: 6px 0;
      }
      .number,
      .light,
      .update {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }
      .number input[type="range"],
      .light input[type="range"] {
        width: 160px;
        padding: 0;
        border: none;
        background: transparent;
        accent-color: var(--rv-action);
      }
      .box {
        width: 72px;
      }
      /* A switch: a square knob on a rail, the action colour when on. */
      .toggle {
        position: relative;
        width: 46px;
        min-height: 0;
        height: 26px;
        padding: 0;
        border-radius: 2px;
        border: 1px solid var(--rv-rule-strong);
        background: transparent;
      }
      .toggle:hover:not(:disabled) {
        background: var(--rv-ground-2);
      }
      .toggle .knob {
        position: absolute;
        top: 3px;
        left: 3px;
        width: 18px;
        height: 18px;
        border-radius: 1px;
        background: var(--rv-muted);
        transition: left 0.15s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .toggle.on,
      .toggle.on:hover:not(:disabled) {
        border-color: var(--rv-action);
        background: var(--rv-action);
      }
      .toggle.on .knob {
        left: 23px;
        background: var(--rv-on-action);
      }
      .value {
        font-size: 14px;
      }
      .scrim {
        position: fixed;
        inset: 0;
        z-index: 10;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(17, 20, 24, 0.55);
      }
      .dialog {
        max-width: 440px;
        margin: 16px;
        padding: 20px 22px;
        border-top: 6px solid var(--rv-fault);
        background: var(--rv-ground);
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
      }
      .dialog h2 {
        font-family: var(--rv-font-cond);
        font-size: 22px;
      }
      .actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }
      @media (max-width: 600px) {
        .row {
          grid-template-columns: 1fr;
        }
        .control {
          justify-self: start;
        }
        .number input[type="range"] {
          width: 120px;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .toggle .knob {
          transition: none;
        }
      }
    `];
};
function q(e, t) {
	return typeof e == "number" && Number.isFinite(e) ? e : t;
}
function J(e, t) {
	if (e.state === "unavailable") return "Unavailable";
	if (e.state === "unknown") return "Unknown";
	if (t === "binary_sensor") {
		let t = [
			"motion",
			"occupancy",
			"presence"
		].includes(String(e.attributes.device_class));
		if (e.state === "on") return t ? "Detected" : "On";
		if (e.state === "off") return t ? "Clear" : "Off";
	}
	let n = e.attributes.unit_of_measurement;
	return typeof n == "string" && n ? `${e.state} ${n}` : e.state;
}
customElements.get("rv-settings") || customElements.define("rv-settings", K);
//#endregion
export { K as RvSettings, d as connectionLabel, J as formatState, u as optionLabel };

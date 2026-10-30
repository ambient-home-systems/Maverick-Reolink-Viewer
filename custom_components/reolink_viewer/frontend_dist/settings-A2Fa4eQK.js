import { Gt as e, I as t, Jt as n, Xt as r, Yt as i, bt as a, it as o, qt as s, r as c, xt as l } from "./home-CE8p8jR0.js";
//#region src/catalog.ts
var u = {
	id: "other",
	title: "Other",
	description: "Entities this version of Reolink Viewer does not know yet."
};
function d(e, t, n) {
	if (e && n !== null) return e.entities[t]?.[n];
}
function f(e, t) {
	let n = t.indexOf(".");
	if (!(n < 0)) return d(e, t.slice(0, n), t.slice(n + 1));
}
function p(e) {
	return [...e?.categories ?? [], u];
}
function m(e, t) {
	if (e?.impact !== "disruptive") return null;
	let n = e.disruptive_when ?? "any", r;
	return r = Array.isArray(n) ? typeof t == "object" && n.includes(t.option) : n === "any" || t === n, r ? e.impact_note ?? "This action can disrupt the camera." : null;
}
function h(e, t) {
	return e.name ?? t?.title ?? e.entity_id;
}
var g = (e) => e.toLowerCase();
function _(e, t, n) {
	let r = g(n).split(/\s+/).filter(Boolean);
	if (!r.length) return !0;
	let i = g([
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
function v(e, t) {
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
function y(e) {
	return {
		domain: "light",
		service: "turn_on",
		data: { brightness_pct: e }
	};
}
//#endregion
//#region src/writes.ts
var b = 1e4, x = class {
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
}, S = 1, C = class extends s {
	static properties = {
		hass: { attribute: !1 },
		device: { attribute: !1 },
		catalog: { attribute: !1 },
		_connection: { state: !0 },
		_search: { state: !0 },
		_showDisabled: { state: !0 },
		_open: { state: !0 },
		_confirm: { state: !0 },
		_enabling: { state: !0 }
	};
	writes = new x();
	renderMs;
	_created = performance.now();
	_settleTimer;
	constructor() {
		super(), this._search = "", this._showDisabled = !1, this._open = /* @__PURE__ */ new Set(), this._enabling = /* @__PURE__ */ new Set();
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
			let e = d(this.catalog, n.domain, n.key);
			if (!_(n, e, this._search)) continue;
			let r = t.get(n.category) ?? [];
			r.push({
				entity: n,
				entry: e,
				label: h(n, e)
			}), t.set(n.category, r);
		}
		for (let e of t.values()) e.sort((e, t) => e.label.localeCompare(t.label));
		return t;
	}
	render() {
		let e = this.connection;
		if (!this.device || !e) return i`<p class="muted">No settings.</p>`;
		let t = this._rows(e), r = e.entities.filter((e) => e.disabled_by !== null).length, a = p(this.catalog).filter((e) => t.has(e.id));
		return i`
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
          Show disabled entities (${r})
        </label>
      </div>
      ${this._renderConnections()}
      ${this._showDisabled ? i`<p class="banner info small">
            Home Assistant creates some Reolink entities disabled.
            ${this.hass?.user?.is_admin ? "Enabling one makes Home Assistant reload the Reolink integration entry for this device after about 30 seconds; its entities are briefly unavailable and the new one appears then." : "An administrator can enable them."}
          </p>` : n}
      ${a.length ? a.map((e) => i`<section class="category">
              <h2>${e.title}</h2>
              <p class="muted small">${e.description}</p>
              <ul class="rows">
                ${(t.get(e.id) ?? []).map((e) => this._renderRow(e))}
              </ul>
            </section>`) : i`<p class="muted">No settings match “${this._search}”.</p>`}
      ${this._renderConfirm()}
    `;
	}
	_renderConnections() {
		let e = this.device?.connections ?? [];
		if (e.length < 2) return n;
		let t = this.connection;
		return i`<div class="connections" role="radiogroup" aria-label="Settings through">
      <span class="small muted">Settings through</span>
      ${e.map((e, n) => i`<button
          role="radio"
          aria-checked=${e === t ? "true" : "false"}
          class=${e === t ? "primary" : ""}
          @click=${() => {
			this._connection = n;
		}}
        >
          ${c(e)} · ${e.entities.length} settings
        </button>`)}
      <span class="small muted">
        Both connections reach the same camera; a change made through either applies to it.
      </span>
    </div>`;
	}
	_renderRow(e) {
		let { entity: t, entry: r, label: o } = e, s = this._open.has(t.entity_id);
		return i`<li class="row" data-entity-id=${t.entity_id}>
      <div class="info">
        <div class="label">
          ${o}
          ${t.sub_device ? i`<span class="badge">${t.sub_device}</span>` : n}
          ${t.disabled_by === null ? n : i`<span class="badge">Turned off</span>`}
          ${t.hidden_by === null ? n : i`<span class="badge">Hidden</span>`}
          ${t.entity_category === "diagnostic" ? i`<span class="badge">Read only</span>` : n}
          ${r?.impact === "disruptive" ? i`<span class="badge warning" title=${r.impact_note ?? ""}>Asks first</span>` : n}
        </div>
        ${r ? i`<div class="muted small">${r.summary}</div>` : n}
      </div>
      <div class="control">${this._renderControl(t, o)}</div>
      ${r ? i`<details
            class="about"
            .open=${s}
            @toggle=${(e) => {
			this._setOpen(t.entity_id, e.target.open);
		}}
          >
            <summary class="small" aria-label=${`About this setting: ${o}`}>About this setting${a("chevronDown")}</summary>
            ${s ? this._renderAbout(r) : n}
          </details>` : n}
    </li>`;
	}
	_setOpen(e, t) {
		if (this._open.has(e) === t) return;
		let n = new Set(this._open);
		t ? n.add(e) : n.delete(e), this._open = n;
	}
	_renderAbout(e) {
		let t = e.related.map((e) => f(this.catalog, e)?.title).filter((e) => e !== void 0);
		return i`<div class="about-body small">
      ${e.verification === "unverified" ? i`<p class="unverified">
            <span class="badge warning">unverified</span> Reolink does not document exactly what
            this does; the text says only what is known.
          </p>` : n}
      <p>${e.what_it_does}</p>
      ${e.tradeoffs ? i`<p><strong>Trade-offs:</strong> ${e.tradeoffs}</p>` : n}
      ${e.impact === "disruptive" ? i`<p><strong>Impact:</strong> ${e.impact_note}</p>` : n}
      <p><strong>Requires:</strong> ${e.requires}</p>
      ${e.notes ? i`<p>${e.notes}</p>` : n}
      ${t.length ? i`<p><strong>Related:</strong> ${t.join(", ")}</p>` : n}
      <p>
        <strong>Sources:</strong>
        ${e.sources.map((e, t) => i`${t ? ", " : ""}<a href=${e.url} target="_blank" rel="noreferrer"
              >${e.title}</a
            >`)}
      </p>
    </div>`;
	}
	_renderControl(e, t) {
		if (e.disabled_by !== null) {
			if (!this.hass?.user?.is_admin) return i`<span class="muted small">Disabled</span>`;
			let n = this._enabling.has(e.entity_id);
			return i`<button ?disabled=${n} @click=${() => void this._enable(e, t)}>
        ${n ? "Enabling…" : "Enable"}
      </button>`;
		}
		let n = this.hass?.states[e.entity_id];
		if (!n) return i`<span class="muted small">Not loaded yet</span>`;
		let r = e.entity_id, a = this.writes.isPending(r), o = this.writes.valueFor(r), s = n.state === "unavailable" || a;
		switch (e.domain) {
			case "switch":
			case "siren": return this._toggle(e, t, o ?? n.state === "on", s && !a);
			case "light": return this._light(e, t, n, o, s && !a);
			case "number": return this._number(e, t, n, o, s);
			case "select": return this._select(e, t, n, o, s);
			case "time": return i`<input
          type="time"
          step="1"
          aria-label=${t}
          .value=${String(o ?? (/^\d\d:\d\d/.test(n.state) ? n.state : ""))}
          ?disabled=${s}
          @change=${(n) => {
				let r = n.target.value;
				r && this._write(e, t, r, "any");
			}}
        />`;
			case "button": return i`<button
          ?disabled=${s}
          @click=${() => void this._write(e, t, "press", "any")}
        >
          ${a ? "Working…" : t}
        </button>`;
			case "update": return this._update(e, t, n, a);
			default: return i`<span class="value">${E(n, e.domain)}</span>`;
		}
	}
	_toggle(e, t, n, r) {
		let a = n === !0;
		return i`<button
      class="toggle ${a ? "on" : ""}"
      role="switch"
      aria-label=${t}
      aria-checked=${a ? "true" : "false"}
      ?disabled=${r}
      @click=${() => void this._write(e, t, !a, a ? "off" : "on")}
    >
      <span class="knob"></span>
    </button>`;
	}
	_light(e, t, r, a, o) {
		let s = r.attributes.supported_color_modes, c = Array.isArray(s) && s.some((e) => e !== "onoff"), l = r.attributes.brightness, u = typeof l == "number" ? Math.round(l / 255 * 100) : 0, d = typeof a == "boolean" ? a : r.state === "on";
		return i`<span class="light">
      ${c && d ? i`<input
            type="range"
            min="1"
            max="100"
            aria-label="${t} brightness"
            .value=${String(typeof a == "number" ? a : u)}
            ?disabled=${o}
            @change=${(n) => {
			let r = Number(n.target.value);
			this._write(e, t, r, "on", y(r));
		}}
          />` : n}
      ${this._toggle(e, t, d, o)}
    </span>`;
	}
	_number(e, t, r, a, o) {
		let s = r.attributes, c = T(s.min, 0), l = T(s.max, 100), u = T(s.step, 1), d = typeof s.unit_of_measurement == "string" ? s.unit_of_measurement : "", f = Number(r.state), p = typeof a == "number" ? a : f, m = Number.isFinite(p) ? String(p) : "", h = (n) => {
			let r = n.target, i = Number(r.value);
			r.value === "" || !Number.isFinite(i) || i < c || i > l ? r.value = m : i !== p && this._write(e, t, i, "any");
		};
		return i`<span class="number">
      ${s.mode === "box" ? n : i`<input
            type="range"
            min=${c}
            max=${l}
            step=${u}
            aria-label=${t}
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
        aria-label="${t} value"
        .value=${m}
        ?disabled=${o}
        @change=${h}
      />
      ${d ? i`<span class="unit muted small">${d}</span>` : n}
    </span>`;
	}
	_select(e, t, r, a, o) {
		let s = Array.isArray(r.attributes.options) ? r.attributes.options.map(String) : [], c = typeof a == "string" ? a : r.state;
		return i`<select
      aria-label=${t}
      ?disabled=${o}
      @change=${(n) => {
			let r = n.target, i = r.value;
			r.value = c, this._write(e, t, i, { option: i });
		}}
    >
      ${s.includes(c) ? n : i`<option value="" selected>—</option>`}
      ${s.map((e) => i`<option value=${e} ?selected=${e === c}>${w(e)}</option>`)}
    </select>`;
	}
	_update(e, t, r, a) {
		let o = r.attributes, s = typeof o.installed_version == "string" ? o.installed_version : "?", c = typeof o.latest_version == "string" ? o.latest_version : null, l = typeof o.supported_features == "number" ? o.supported_features : 0, u = o.in_progress === !0 || a, d = r.state === "on" && (l & S) !== 0;
		return i`<span class="update small">
      <span>
        ${s}${c && c !== s ? i` → <strong>${c}</strong>` : n}
        ${r.state === "off" ? i`<span class="muted">(up to date)</span>` : n}
      </span>
      ${d || u ? i`<button
            ?disabled=${u}
            @click=${() => void this._write(e, t, "install", "any")}
          >
            ${u ? "Installing…" : "Install"}
          </button>` : n}
    </span>`;
	}
	async _write(n, r, i, a, o) {
		let s = this.hass;
		if (!s) return;
		let c = m(d(this.catalog, n.domain, n.key), a);
		if (c !== null && !await this.confirm(r, c)) return;
		let l = o ?? v(n.domain, n.domain === "button" ? "press" : n.domain === "update" ? "install" : i), u = n.entity_id, f = this.writes.begin(u, i, s.states[u]);
		this.requestUpdate();
		try {
			await s.callService(l.domain, l.service, l.data, { entity_id: u }, !1), this.writes.confirm(u, f), this._scheduleSettle();
		} catch (n) {
			this.writes.fail(u, f) && t(this, `Could not change ${r}: ${e(n).message}`, "error");
		}
		this.requestUpdate();
	}
	_scheduleSettle() {
		clearTimeout(this._settleTimer), this._settleTimer = setTimeout(() => {
			this.hass && this.writes.settle(this.hass.states) && this.requestUpdate(), this.writes.size && this._scheduleSettle();
		}, b + 100);
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
		return e ? i`<div class="scrim" @click=${() => {
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
    </div>` : n;
	}
	async _enable(n, r) {
		let i = this.hass;
		if (i) {
			this._enabling = /* @__PURE__ */ new Set([...this._enabling, n.entity_id]);
			try {
				let e = (await l(i, n.entity_id)).reload_delay;
				t(this, `${r} enabled. Home Assistant reloads the Reolink entry${e ? ` in about ${e} seconds` : ""}; the entity becomes available after that.`), this.dispatchEvent(new CustomEvent("rv-entity-enabled", {
					bubbles: !0,
					composed: !0
				}));
			} catch (n) {
				t(this, `Could not enable ${r}: ${e(n).message}`, "error");
			} finally {
				let e = new Set(this._enabling);
				e.delete(n.entity_id), this._enabling = e;
			}
		}
	}
	static styles = [o, r`
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
function w(e) {
	let t = e.replace(/_/g, " ").replace(/\s*&\s*/g, " & ").trim();
	return t.charAt(0).toUpperCase() + t.slice(1);
}
function T(e, t) {
	return typeof e == "number" && Number.isFinite(e) ? e : t;
}
function E(e, t) {
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
customElements.get("rv-settings") || customElements.define("rv-settings", C);
//#endregion
export { C as RvSettings, c as connectionLabel, E as formatState, w as optionLabel };

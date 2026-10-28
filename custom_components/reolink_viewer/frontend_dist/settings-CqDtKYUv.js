import { I as e, Jt as t, Kt as n, Wt as r, Yt as i, bt as a, it as o, qt as s, r as c, yt as l } from "./home-U1fpKtN8.js";
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
}, S = 1, C = class extends n {
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
		if (!this.device || !e) return t`<p class="muted">No settings.</p>`;
		let n = this._rows(e), r = e.entities.filter((e) => e.disabled_by !== null).length, i = p(this.catalog).filter((e) => n.has(e.id));
		return t`
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
      ${this._showDisabled ? t`<p class="banner info small">
            Home Assistant creates some Reolink entities disabled.
            ${this.hass?.user?.is_admin ? "Enabling one makes Home Assistant reload the Reolink integration entry for this device after about 30 seconds; its entities are briefly unavailable and the new one appears then." : "An administrator can enable them."}
          </p>` : s}
      ${i.length ? i.map((e) => t`<section class="category">
              <h2>${e.title}</h2>
              <p class="muted small">${e.description}</p>
              <ul class="rows">
                ${(n.get(e.id) ?? []).map((e) => this._renderRow(e))}
              </ul>
            </section>`) : t`<p class="muted">No settings match “${this._search}”.</p>`}
      ${this._renderConfirm()}
    `;
	}
	_renderConnections() {
		let e = this.device?.connections ?? [];
		if (e.length < 2) return s;
		let n = this.connection;
		return t`<div class="connections" role="radiogroup" aria-label="Settings through">
      <span class="small muted">Settings through</span>
      ${e.map((e, r) => t`<button
          role="radio"
          aria-checked=${e === n ? "true" : "false"}
          class=${e === n ? "primary" : ""}
          @click=${() => {
			this._connection = r;
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
		let { entity: n, entry: r, label: i } = e, a = this._open.has(n.entity_id);
		return t`<li class="row" data-entity-id=${n.entity_id}>
      <div class="info">
        <div class="label">
          ${i}
          ${n.sub_device ? t`<span class="badge">${n.sub_device}</span>` : s}
          ${n.disabled_by === null ? s : t`<span class="badge">Turned off</span>`}
          ${n.hidden_by === null ? s : t`<span class="badge">Hidden</span>`}
          ${n.entity_category === "diagnostic" ? t`<span class="badge">Read only</span>` : s}
          ${r?.impact === "disruptive" ? t`<span class="badge warning" title=${r.impact_note ?? ""}>Asks first</span>` : s}
        </div>
        ${r ? t`<div class="muted small">${r.summary}</div>` : s}
      </div>
      <div class="control">${this._renderControl(n, i)}</div>
      ${r ? t`<details
            class="about"
            .open=${a}
            @toggle=${(e) => {
			this._setOpen(n.entity_id, e.target.open);
		}}
          >
            <summary class="small" aria-label=${`About this setting: ${i}`}>About this setting${l("chevronDown")}</summary>
            ${a ? this._renderAbout(r) : s}
          </details>` : s}
    </li>`;
	}
	_setOpen(e, t) {
		if (this._open.has(e) === t) return;
		let n = new Set(this._open);
		t ? n.add(e) : n.delete(e), this._open = n;
	}
	_renderAbout(e) {
		let n = e.related.map((e) => f(this.catalog, e)?.title).filter((e) => e !== void 0);
		return t`<div class="about-body small">
      ${e.verification === "unverified" ? t`<p class="unverified">
            <span class="badge warning">unverified</span> Reolink does not document exactly what
            this does; the text says only what is known.
          </p>` : s}
      <p>${e.what_it_does}</p>
      ${e.tradeoffs ? t`<p><strong>Trade-offs:</strong> ${e.tradeoffs}</p>` : s}
      ${e.impact === "disruptive" ? t`<p><strong>Impact:</strong> ${e.impact_note}</p>` : s}
      <p><strong>Requires:</strong> ${e.requires}</p>
      ${e.notes ? t`<p>${e.notes}</p>` : s}
      ${n.length ? t`<p><strong>Related:</strong> ${n.join(", ")}</p>` : s}
      <p>
        <strong>Sources:</strong>
        ${e.sources.map((e, n) => t`${n ? ", " : ""}<a href=${e.url} target="_blank" rel="noreferrer"
              >${e.title}</a
            >`)}
      </p>
    </div>`;
	}
	_renderControl(e, n) {
		if (e.disabled_by !== null) {
			if (!this.hass?.user?.is_admin) return t`<span class="muted small">Disabled</span>`;
			let r = this._enabling.has(e.entity_id);
			return t`<button ?disabled=${r} @click=${() => void this._enable(e, n)}>
        ${r ? "Enabling…" : "Enable"}
      </button>`;
		}
		let r = this.hass?.states[e.entity_id];
		if (!r) return t`<span class="muted small">Not loaded yet</span>`;
		let i = e.entity_id, a = this.writes.isPending(i), o = this.writes.valueFor(i), s = r.state === "unavailable" || a;
		switch (e.domain) {
			case "switch":
			case "siren": return this._toggle(e, n, o ?? r.state === "on", s && !a);
			case "light": return this._light(e, n, r, o, s && !a);
			case "number": return this._number(e, n, r, o, s);
			case "select": return this._select(e, n, r, o, s);
			case "time": return t`<input
          type="time"
          step="1"
          aria-label=${n}
          .value=${String(o ?? (/^\d\d:\d\d/.test(r.state) ? r.state : ""))}
          ?disabled=${s}
          @change=${(t) => {
				let r = t.target.value;
				r && this._write(e, n, r, "any");
			}}
        />`;
			case "button": return t`<button
          ?disabled=${s}
          @click=${() => void this._write(e, n, "press", "any")}
        >
          ${a ? "Working…" : n}
        </button>`;
			case "update": return this._update(e, n, r, a);
			default: return t`<span class="value">${E(r, e.domain)}</span>`;
		}
	}
	_toggle(e, n, r, i) {
		let a = r === !0;
		return t`<button
      class="toggle ${a ? "on" : ""}"
      role="switch"
      aria-label=${n}
      aria-checked=${a ? "true" : "false"}
      ?disabled=${i}
      @click=${() => void this._write(e, n, !a, a ? "off" : "on")}
    >
      <span class="knob"></span>
    </button>`;
	}
	_light(e, n, r, i, a) {
		let o = r.attributes.supported_color_modes, c = Array.isArray(o) && o.some((e) => e !== "onoff"), l = r.attributes.brightness, u = typeof l == "number" ? Math.round(l / 255 * 100) : 0, d = typeof i == "boolean" ? i : r.state === "on";
		return t`<span class="light">
      ${c && d ? t`<input
            type="range"
            min="1"
            max="100"
            aria-label="${n} brightness"
            .value=${String(typeof i == "number" ? i : u)}
            ?disabled=${a}
            @change=${(t) => {
			let r = Number(t.target.value);
			this._write(e, n, r, "on", y(r));
		}}
          />` : s}
      ${this._toggle(e, n, d, a)}
    </span>`;
	}
	_number(e, n, r, i, a) {
		let o = r.attributes, c = T(o.min, 0), l = T(o.max, 100), u = T(o.step, 1), d = typeof o.unit_of_measurement == "string" ? o.unit_of_measurement : "", f = Number(r.state), p = typeof i == "number" ? i : f, m = Number.isFinite(p) ? String(p) : "", h = (t) => {
			let r = t.target, i = Number(r.value);
			r.value === "" || !Number.isFinite(i) || i < c || i > l ? r.value = m : i !== p && this._write(e, n, i, "any");
		};
		return t`<span class="number">
      ${o.mode === "box" ? s : t`<input
            type="range"
            min=${c}
            max=${l}
            step=${u}
            aria-label=${n}
            .value=${m}
            ?disabled=${a}
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
        aria-label="${n} value"
        .value=${m}
        ?disabled=${a}
        @change=${h}
      />
      ${d ? t`<span class="unit muted small">${d}</span>` : s}
    </span>`;
	}
	_select(e, n, r, i, a) {
		let o = Array.isArray(r.attributes.options) ? r.attributes.options.map(String) : [], c = typeof i == "string" ? i : r.state;
		return t`<select
      aria-label=${n}
      ?disabled=${a}
      @change=${(t) => {
			let r = t.target, i = r.value;
			r.value = c, this._write(e, n, i, { option: i });
		}}
    >
      ${o.includes(c) ? s : t`<option value="" selected>—</option>`}
      ${o.map((e) => t`<option value=${e} ?selected=${e === c}>${w(e)}</option>`)}
    </select>`;
	}
	_update(e, n, r, i) {
		let a = r.attributes, o = typeof a.installed_version == "string" ? a.installed_version : "?", c = typeof a.latest_version == "string" ? a.latest_version : null, l = typeof a.supported_features == "number" ? a.supported_features : 0, u = a.in_progress === !0 || i, d = r.state === "on" && (l & S) !== 0;
		return t`<span class="update small">
      <span>
        ${o}${c && c !== o ? t` → <strong>${c}</strong>` : s}
        ${r.state === "off" ? t`<span class="muted">(up to date)</span>` : s}
      </span>
      ${d || u ? t`<button
            ?disabled=${u}
            @click=${() => void this._write(e, n, "install", "any")}
          >
            ${u ? "Installing…" : "Install"}
          </button>` : s}
    </span>`;
	}
	async _write(t, n, i, a, o) {
		let s = this.hass;
		if (!s) return;
		let c = m(d(this.catalog, t.domain, t.key), a);
		if (c !== null && !await this.confirm(n, c)) return;
		let l = o ?? v(t.domain, t.domain === "button" ? "press" : t.domain === "update" ? "install" : i), u = t.entity_id, f = this.writes.begin(u, i, s.states[u]);
		this.requestUpdate();
		try {
			await s.callService(l.domain, l.service, l.data, { entity_id: u }, !1), this.writes.confirm(u, f), this._scheduleSettle();
		} catch (t) {
			this.writes.fail(u, f) && e(this, `Could not change ${n}: ${r(t).message}`, "error");
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
		return e ? t`<div class="scrim" @click=${() => {
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
    </div>` : s;
	}
	async _enable(t, n) {
		let i = this.hass;
		if (i) {
			this._enabling = /* @__PURE__ */ new Set([...this._enabling, t.entity_id]);
			try {
				let r = (await a(i, t.entity_id)).reload_delay;
				e(this, `${n} enabled. Home Assistant reloads the Reolink entry${r ? ` in about ${r} seconds` : ""}; the entity becomes available after that.`), this.dispatchEvent(new CustomEvent("rv-entity-enabled", {
					bubbles: !0,
					composed: !0
				}));
			} catch (t) {
				e(this, `Could not enable ${n}: ${r(t).message}`, "error");
			} finally {
				let e = new Set(this._enabling);
				e.delete(t.entity_id), this._enabling = e;
			}
		}
	}
	static styles = [o, i`
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

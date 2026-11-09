import { a as e, n as t, r as n, t as r } from "./lit-DdRjbP0M.js";
import { Ct as i, Pt as a } from "./live-BazhJ5O3.js";
import { a as o, o as s, r as c } from "./wall-config-CRjQhRDF.js";
import { t as l } from "./editor-event-DOL4ACcL.js";
//#region src/card/wall-editor.ts
var u = class extends r {
	static properties = {
		hass: { attribute: !1 },
		_raw: { state: !0 },
		_layouts: { state: !0 },
		_error: { state: !0 }
	};
	_loading = !1;
	constructor() {
		super(), this._raw = {};
	}
	setConfig(e) {
		this._raw = { ...e };
	}
	get _config() {
		try {
			return s(this._raw);
		} catch {
			return;
		}
	}
	willUpdate() {
		this.hass && !this._layouts && !this._loading && !this._error && this._load(this.hass);
	}
	async _load(e) {
		this._loading = !0;
		try {
			this._layouts = (await i(e)).layouts;
		} catch (e) {
			this._error = a(e).message;
		} finally {
			this._loading = !1;
		}
	}
	_change(e) {
		this._raw = o(this._raw, e), this.dispatchEvent(new CustomEvent(l, {
			detail: { config: this._raw },
			bubbles: !0,
			composed: !0
		}));
	}
	render() {
		let e = this._config;
		if (!e) return n`<p class="note">These settings can only be changed in the card's YAML.</p>`;
		let r = this._layouts, i = !e.layout || (r?.some((t) => t.id === e.layout) ?? !0);
		return n`<div class="form">
      <label class="field">
        <span class="name">Layout</span>
        ${r ? n`<select
              @change=${(e) => {
			let t = e.target.value;
			this._change(t ? { layout: t } : { layout: "" });
		}}
            >
              <option value="" ?selected=${!e.layout}>All cameras</option>
              ${r.map((t) => n`<option value=${t.id} ?selected=${t.id === e.layout}>${t.name}</option>`)}
              ${i ? t : n`<option value=${e.layout ?? ""} selected>“${e.layout}” (not one of yours)</option>`}
            </select>` : n`<span class="note">${this._error ? `Could not load the layouts: ${this._error}` : "Loading the layouts…"}</span>`}
        <span class="note">
          Layouts are made on the Reolink panel's Wall (Layout ⌄), and are your own: shown to another Home
          Assistant user, the card shows every camera.
        </span>
      </label>
      <label class="check">
        <input
          type="checkbox"
          .checked=${e.show_bar}
          @change=${(e) => {
			this._change({ show_bar: e.target.checked });
		}}
        />
        <span>
          Show the bar
          <span class="note">The layout's name, its pages, the time and full screen, above the video.</span>
        </span>
      </label>
    </div>`;
	}
	static styles = e`
    :host {
      display: block;
      color: var(--primary-text-color);
    }
    .form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .name {
      font-weight: 500;
    }
    select {
      min-height: 40px;
      padding: 0 8px;
      border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.2));
      border-radius: 4px;
      color: var(--primary-text-color);
      background: var(--card-background-color, transparent);
      font: inherit;
    }
    .check {
      display: flex;
      gap: 8px;
      align-items: flex-start;
    }
    .check input {
      margin: 3px 0 0;
      accent-color: var(--primary-color);
    }
    .check > span {
      display: flex;
      flex-direction: column;
    }
    .note {
      margin: 0;
      color: var(--secondary-text-color);
      font-size: 0.9em;
    }
  `;
};
customElements.get("reolink-viewer-wall-editor") || customElements.define(c, u);
//#endregion

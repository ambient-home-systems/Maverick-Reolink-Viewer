import { a as e, n as t, r as n, t as r } from "./lit-DdRjbP0M.js";
import { It as i, L as a, R as o, dt as s } from "./live-D6mEGytR.js";
import { a as c, c as l, r as u } from "./config-D80frQMF.js";
import { t as d } from "./editor-event-DOL4ACcL.js";
//#region src/card/editor.ts
var f = class extends r {
	static properties = {
		hass: { attribute: !1 },
		_raw: { state: !0 },
		_cameras: { state: !0 },
		_error: { state: !0 },
		_switchError: { state: !0 }
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
			return c(this._raw);
		} catch {
			return;
		}
	}
	willUpdate() {
		this.hass && !this._cameras && !this._loading && !this._error && this._load(this.hass);
	}
	async _load(e) {
		this._loading = !0;
		try {
			this._cameras = (await s(e)).cameras;
		} catch (e) {
			this._error = i(e).message;
		} finally {
			this._loading = !1;
		}
	}
	_change(e) {
		this._raw = l(this._raw, e), this.dispatchEvent(new CustomEvent(d, {
			detail: { config: this._raw },
			bubbles: !0,
			composed: !0
		}));
	}
	render() {
		let e = this._config;
		if (!e) return n`<p class="note">These settings can only be changed in the card's YAML.</p>`;
		let r = this._cameras, i = r?.find((t) => t.id === e.camera);
		return n`<div class="form">
      <label class="field">
        <span class="name">Camera</span>
        ${r ? n`<select
              @change=${(e) => {
			this._change({ camera: e.target.value });
		}}
            >
              ${i ? t : n`<option value="" selected disabled>Choose a camera</option>`}
              ${r.map((t) => n`<option value=${t.id} ?selected=${t.id === e.camera}>${t.name}</option>`)}
            </select>` : n`<span class="note">${this._error ? `Could not load the cameras: ${this._error}` : "Loading the cameras…"}</span>`}
      </label>
      ${i ? this._renderWarm(i, e) : t}

      <fieldset>
        <legend class="name">Quality</legend>
        ${this._radio("quality", "sd", e.quality, "SD", "The camera's sub stream: light, and at once on a camera kept warm.")}
        ${this._radio("quality", "hd", e.quality, "HD", "Its full-quality stream on the card itself. It takes a few seconds to start each time, and one more of the NVR's or camera's streams while shown. Full screen plays HD either way.")}
      </fieldset>

      <label class="field">
        <span class="name">Tap the card to</span>
        <select
          @change=${(e) => {
			this._change({ tap_action: e.target.value });
		}}
        >
          <option value="full_screen" ?selected=${e.tap_action === "full_screen"}>Go full screen, in HD</option>
          <option value="open_panel" ?selected=${e.tap_action === "open_panel"}>Open the camera in Reolink</option>
          <option value="none" ?selected=${e.tap_action === "none"}>Nothing</option>
        </select>
      </label>
      ${i?.visitor_entity ? this._renderRing(e) : t}

      <fieldset>
        <legend class="name">Over the picture</legend>
        ${this._check("show_name", e.show_name, "The camera's name")}
        ${this._check("show_state", e.show_state, "Its state (Live, Starting); problems always show")}
      </fieldset>

      <fieldset>
        <legend class="name">The picture</legend>
        ${this._radio("fit", "cover", e.fit, "Fill the card", "Crops the picture when the card's shape differs from it.")}
        ${this._radio("fit", "contain", e.fit, "Show it whole", "With bars where the card's shape differs from it.")}
      </fieldset>
    </div>`;
	}
	_renderWarm(e, r) {
		if (o(e)?.is_battery) return n`<p class="note">
        A battery camera is never kept warm, so it can sleep: the card shows its last picture, and its video plays when
        tapped.
      </p>`;
		let s = e.keep_warm_entity;
		if (!s) return t;
		let c = a(this.hass, e), l = this.hass?.states[s]?.state;
		return n`<div class=${c ? "warm" : "warm cold"}>
      ${c || r.quality === "hd" ? t : n`<p class="warning" role="status">
            Not kept warm: its video takes a few seconds to start. Keep it warm to start at once.
          </p>`}
      <label class="check">
        <input
          type="checkbox"
          .checked=${l === "on"}
          ?disabled=${l !== "on" && l !== "off"}
          @change=${(e) => {
			let t = e.target.checked;
			this._switchError = void 0, this.hass?.callService("switch", t ? "turn_on" : "turn_off", { entity_id: s }).catch((e) => {
				this._switchError = i(e).message;
			});
		}}
        />
        <span>
          Keep warm
          <span class="note">Keeps the camera connected, using one of its NVR's or camera's streams all the time.</span>
        </span>
      </label>
      ${this._switchError ? n`<p class="warning" role="alert">Could not change it: ${this._switchError}</p>` : t}
    </div>`;
	}
	_radio(e, t, r, i, a) {
		return n`<label class="check">
      <input
        type="radio"
        name=${e}
        .checked=${t === r}
        @change=${() => {
			this._change({ [e]: t });
		}}
      />
      <span>${i} <span class="note">${a}</span></span>
    </label>`;
	}
	_renderRing(e) {
		let r = e.ring_full_screen;
		return n`<fieldset>
      <legend class="name">When it rings</legend>
      <label class="check">
        <input
          type="checkbox"
          .checked=${r > 0}
          @change=${(e) => {
			this._change({ ring_full_screen: e.target.checked ? 30 : 0 });
		}}
        />
        <span
          >Go full screen
          <span class="note"
            >On every screen showing this card. On a Fully Kiosk tablet with its JavaScript interface on, it wakes the
            screen first.</span
          ></span
        >
      </label>
      ${r > 0 ? n`<label class="seconds">
            For
            <input
              type="number"
              min=${5}
              max=${600}
              step="5"
              .value=${String(r)}
              @change=${(e) => {
			let t = e.target, n = Math.round(Number(t.value)), r = Number.isFinite(n) ? Math.min(600, Math.max(5, n)) : 30;
			t.value = String(r), this._change({ ring_full_screen: r });
		}}
            />
            seconds
          </label>` : t}
    </fieldset>`;
	}
	_check(e, t, r) {
		return n`<label class="check">
      <input
        type="checkbox"
        .checked=${t}
        @change=${(t) => {
			this._change({ [e]: t.target.checked });
		}}
      />
      <span>${r}</span>
    </label>`;
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
    fieldset {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin: 0;
      padding: 0;
      border: none;
    }
    legend {
      padding: 0;
      margin-bottom: 6px;
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
    .seconds {
      display: flex;
      gap: 8px;
      align-items: center;
      padding-left: 24px;
    }
    .seconds input {
      width: 5em;
      min-height: 36px;
      padding: 0 8px;
      border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.2));
      border-radius: 4px;
      color: var(--primary-text-color);
      background: var(--card-background-color, transparent);
      font: inherit;
    }
    .note {
      margin: 0;
      color: var(--secondary-text-color);
      font-size: 0.9em;
    }
    .warm {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    /* As Home Assistant's own alerts: a light tint of its warning colour. */
    .warning {
      margin: 0;
      padding: 8px 12px;
      border-radius: 4px;
      background: color-mix(in srgb, var(--warning-color, #ffa600) 16%, transparent);
    }
  `;
};
customElements.get("reolink-viewer-camera-editor") || customElements.define(u, f);
//#endregion

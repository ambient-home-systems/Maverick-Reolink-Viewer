import { F as e, Gt as t, Ht as n, Kt as r, Wt as i, _t as a, bt as o, i as s, qt as c, rt as l, xt as u } from "./home-D5-WNgzo.js";
//#region src/render-filter.ts
function d(e, t, n) {
	if (e === t) return !1;
	if (!e || !t) return !0;
	for (let r of n) if (e[r] !== t[r]) return !0;
	return !1;
}
//#endregion
//#region src/components/device-page.ts
var f = {
	overview: () => import("./overview-CvLX-nls.js"),
	playback: () => import("./playback-B5i3yP6R.js"),
	settings: () => import("./settings-D6N75Svi.js")
}, p = 1e3, m = class extends i {
	static properties = {
		hass: { attribute: !1 },
		deviceId: { attribute: !1 },
		tab: { attribute: !1 },
		at: { attribute: !1 },
		cameras: { attribute: !1 },
		devices: { attribute: !1 },
		_device: { state: !0 },
		_catalog: { state: !0 },
		_error: { state: !0 },
		_tabError: { state: !0 }
	};
	renderCount = 0;
	_watched = [];
	_renderedStates;
	_loadSeq = 0;
	_unsubRegistry;
	_reloadTimer;
	constructor() {
		super(), this.deviceId = "", this.tab = "overview", this.cameras = [];
	}
	connectedCallback() {
		super.connectedCallback(), this.hass && !this._unsubRegistry && this._subscribeRegistry(this.hass);
	}
	disconnectedCallback() {
		super.disconnectedCallback(), clearTimeout(this._reloadTimer);
		let e = this._unsubRegistry;
		this._unsubRegistry = void 0, e?.then((e) => e?.()).catch(() => void 0);
	}
	shouldUpdate(e) {
		return e.size === 1 && e.has("hass") && this._renderedStates !== void 0 ? d(this._renderedStates, this.hass?.states, this._watched) : !0;
	}
	willUpdate(e) {
		(e.has("deviceId") || e.has("hass") && !this._device && !this._error) && this.hass && this._load(), e.has("hass") && this.hass && this.isConnected && !this._unsubRegistry && this._subscribeRegistry(this.hass), (e.has("tab") || e.has("_device")) && this._device && this._loadTab(h(this.tab, this._device));
	}
	_loadTab(e) {
		e !== "live" && (this._tabError = void 0, f[e]().catch((e) => {
			this._tabError = n(e).message;
		}));
	}
	updated() {
		this._renderedStates = this.hass?.states;
	}
	async reload() {
		await this._load(!0);
	}
	async _load(e = !1) {
		let t = this.hass;
		if (!t || !this.deviceId) return;
		let r = ++this._loadSeq;
		e || (this._device = void 0, this._error = void 0);
		try {
			let [e, n] = await Promise.all([u(t, this.deviceId), o(t)]);
			if (r !== this._loadSeq) return;
			this._catalog = n, this._device = e, this._error = void 0, this._watched = x(e);
		} catch (e) {
			if (r !== this._loadSeq) return;
			this._error = n(e).message;
		}
	}
	_subscribeRegistry(e) {
		this._unsubRegistry = e.connection.subscribeEvents((e) => {
			let t = e.data?.entity_id;
			(!t || this._device?.connections.some((e) => e.entities.some((e) => e.entity_id === t))) && (clearTimeout(this._reloadTimer), this._reloadTimer = setTimeout(() => void this.reload(), p));
		}, "entity_registry_updated").catch(() => void 0);
	}
	_number(e) {
		return this.cameras.find((t) => t.id === e)?.number;
	}
	render() {
		this.renderCount += 1;
		let n = this._device, i = n?.node;
		return r`
      <div class="header">
        <button class="text with-icon back" @click=${() => {
			e(this, { view: "list" });
		}}>${a("back")}All devices</button>
      </div>
      ${this._error ? r`<div class="banner error" role="alert">Could not load the device: ${this._error}</div>` : t}
      ${i ? r`<div class="title">
              ${this._number(i.id) === void 0 ? t : r`<span class="plat" aria-hidden="true">${this._number(i.id)}</span>`}
              <h1>${i.name ?? "Reolink device"}</h1>
              <p class="kind muted">${g(n)}</p>
            </div>
            <div class="tabs" role="tablist">
              ${b(n).map((t) => r`<button
                  role="tab"
                  aria-selected=${this.tab === t ? "true" : "false"}
                  class=${this.tab === t ? "active" : ""}
                  @click=${() => {
			e(this, {
				view: "device",
				id: this.deviceId,
				tab: t
			});
		}}
                >
                  ${_[t]}
                </button>`)}
            </div>
            ${n.degraded ? r`<div class="banner warning small">
                  Degraded mode: the Reolink integration's internals changed, so device details are
                  missing. Settings still work.
                </div>` : t}
            ${this._tabError ? r`<div class="banner error" role="alert">
                  Could not load this tab: ${this._tabError}.
                  <button
                    @click=${() => {
			this._loadTab(h(this.tab, n));
		}}
                  >
                    Try again
                  </button>
                </div>` : t}
            ${h(this.tab, n) === "live" ? r`<rv-live-camera .hass=${this.hass} .deviceId=${i.id}></rv-live-camera>` : h(this.tab, n) === "playback" ? r`<rv-playback
                  .hass=${this.hass}
                  .deviceId=${i.id}
                  .cameraName=${i.name ?? ""}
                  .at=${this.at}
                ></rv-playback>` : h(this.tab, n) === "overview" ? r`<rv-overview
                  .hass=${this.hass}
                  .device=${n}
                  .devices=${this.devices}
                  .cameras=${this.cameras}
                ></rv-overview>` : r`<rv-settings
                  .hass=${this.hass}
                  .device=${n}
                  .catalog=${this._catalog}
                  @rv-entity-enabled=${() => void this.reload()}
                ></rv-settings>`}` : this._error ? t : r`<p class="muted">Loading…</p>`}
    `;
	}
	static styles = [l, c`
      :host {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .back {
        padding-left: 0;
      }
      .title {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 6px 14px;
      }
      .title h1 {
        margin: 0;
        font-family: var(--rv-font-cond);
        font-size: 30px;
        font-weight: 600;
        line-height: 1.1;
      }
      .kind {
        flex-basis: 100%;
        margin: 0;
        font-size: 15px;
      }
      .plat {
        min-width: 30px;
        height: 30px;
        padding: 0 5px;
        box-sizing: border-box;
        display: grid;
        place-items: center;
        background: var(--rv-platform);
        color: var(--rv-on-rail);
        font-family: var(--rv-font-cond);
        font-size: 18px;
        font-weight: 600;
        line-height: 1;
      }
      .tabs {
        display: flex;
        gap: 4px;
        border-bottom: 1px solid var(--rv-rule-strong);
        overflow-x: auto;
        scrollbar-width: none;
      }
      .tabs button {
        min-height: 44px;
        padding: 0 14px;
        border: none;
        border-radius: 0;
        background: transparent;
        color: var(--rv-muted);
        font-size: 16px;
        box-shadow: inset 0 -3px 0 transparent;
      }
      .tabs button:hover:not(:disabled) {
        background: transparent;
        color: var(--rv-text);
      }
      .tabs button.active {
        color: var(--rv-text);
        box-shadow: inset 0 -3px 0 var(--rv-text);
      }
      .tabs button:focus-visible {
        outline-offset: -4px;
      }
    `];
};
function h(e, t) {
	return e === "live" ? y(t) ? "live" : "overview" : e === "playback" ? v(t) ? "playback" : "overview" : e;
}
function g(e) {
	let t = e.node, n = [s(t.kind), t.model ?? void 0];
	if (t.kind === "camera" && t.connections.length > 1) {
		let e = new Set(t.connections.map((e) => e.via));
		n.push(e.has("nvr") && e.has("direct") ? "on the NVR and added directly" : `${String(t.connections.length)} connections`);
	}
	return n.filter(Boolean).join(" · ");
}
var _ = {
	overview: "Overview",
	live: "Live",
	playback: "Playback",
	settings: "Settings"
};
function v(e) {
	return e.node.kind === "camera" && e.node.connections.some((e) => e.playback_source);
}
function y(e) {
	return e.node.kind === "camera" && !e.degraded;
}
function b(e) {
	return [
		"overview",
		...y(e) ? ["live"] : [],
		...v(e) ? ["playback"] : [],
		"settings"
	];
}
function x(e) {
	let t = e.connections.flatMap((e) => e.entities.map((e) => e.entity_id));
	return e.node.kind === "camera" && e.node.snapshot_entity_id && t.push(e.node.snapshot_entity_id), t;
}
customElements.get("rv-device-page") || customElements.define("rv-device-page", m);
//#endregion
export { m as RvDevicePage, y as hasLive, v as hasPlayback, g as kindLine, h as shownTab, b as tabsFor, x as watchedEntities };

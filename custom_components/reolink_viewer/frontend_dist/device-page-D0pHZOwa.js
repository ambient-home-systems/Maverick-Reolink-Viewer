import { Bt as e, F as t, Ht as n, Lt as r, Q as i, Vt as a, ft as o, gt as s, ht as c, i as l, zt as u } from "./home-BgEtUrjD.js";
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
	overview: () => import("./overview-DLhhKFsu.js"),
	playback: () => import("./playback-nXZen4fY.js"),
	settings: () => import("./settings-CNyf0l0_.js")
}, p = 1e3, m = class extends u {
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
			this._tabError = r(e).message;
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
		let n = ++this._loadSeq;
		e || (this._device = void 0, this._error = void 0);
		try {
			let [e, r] = await Promise.all([s(t, this.deviceId), c(t)]);
			if (n !== this._loadSeq) return;
			this._catalog = r, this._device = e, this._error = void 0, this._watched = x(e);
		} catch (e) {
			if (n !== this._loadSeq) return;
			this._error = r(e).message;
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
		let n = this._device, r = n?.node;
		return a`
      <div class="header">
        <button class="text with-icon back" @click=${() => {
			t(this, { view: "list" });
		}}>${o("back")}All devices</button>
      </div>
      ${this._error ? a`<div class="banner error" role="alert">Could not load the device: ${this._error}</div>` : e}
      ${r ? a`<div class="title">
              ${this._number(r.id) === void 0 ? e : a`<span class="plat" aria-hidden="true">${this._number(r.id)}</span>`}
              <h1>${r.name ?? "Reolink device"}</h1>
              <p class="kind muted">${g(n)}</p>
            </div>
            <div class="tabs" role="tablist">
              ${b(n).map((e) => a`<button
                  role="tab"
                  aria-selected=${this.tab === e ? "true" : "false"}
                  class=${this.tab === e ? "active" : ""}
                  @click=${() => {
			t(this, {
				view: "device",
				id: this.deviceId,
				tab: e
			});
		}}
                >
                  ${_[e]}
                </button>`)}
            </div>
            ${n.degraded ? a`<div class="banner warning small">
                  Degraded mode: the Reolink integration's internals changed, so device details are
                  missing. Settings still work.
                </div>` : e}
            ${this._tabError ? a`<div class="banner error" role="alert">
                  Could not load this tab: ${this._tabError}.
                  <button
                    @click=${() => {
			this._loadTab(h(this.tab, n));
		}}
                  >
                    Try again
                  </button>
                </div>` : e}
            ${h(this.tab, n) === "live" ? a`<rv-live-camera .hass=${this.hass} .deviceId=${r.id}></rv-live-camera>` : h(this.tab, n) === "playback" ? a`<rv-playback
                  .hass=${this.hass}
                  .deviceId=${r.id}
                  .cameraName=${r.name ?? ""}
                  .at=${this.at}
                ></rv-playback>` : h(this.tab, n) === "overview" ? a`<rv-overview
                  .hass=${this.hass}
                  .device=${n}
                  .devices=${this.devices}
                  .cameras=${this.cameras}
                ></rv-overview>` : a`<rv-settings
                  .hass=${this.hass}
                  .device=${n}
                  .catalog=${this._catalog}
                  @rv-entity-enabled=${() => void this.reload()}
                ></rv-settings>`}` : this._error ? e : a`<p class="muted">Loading…</p>`}
    `;
	}
	static styles = [i, n`
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
	let t = e.node, n = [l(t.kind), t.model ?? void 0];
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

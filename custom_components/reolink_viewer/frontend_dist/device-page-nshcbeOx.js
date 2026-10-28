import { Ct as e, F as t, Jt as n, Kt as r, St as i, Wt as a, Yt as o, i as s, it as c, qt as l, yt as u } from "./home-CRi9TKP3.js";
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
	overview: () => import("./overview-Pg-tbnII.js"),
	playback: () => import("./playback-C5Vhy_6H.js"),
	settings: () => import("./settings-C9XJKXhM.js")
}, p = 1e3, m = class extends r {
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
		e !== "live" && e !== "no-recordings" && (this._tabError = void 0, f[e]().catch((e) => {
			this._tabError = a(e).message;
		}));
	}
	updated() {
		this._renderedStates = this.hass?.states;
	}
	async reload() {
		await this._load(!0);
	}
	async _load(t = !1) {
		let n = this.hass;
		if (!n || !this.deviceId) return;
		let r = ++this._loadSeq;
		t || (this._device = void 0, this._error = void 0);
		try {
			let [t, a] = await Promise.all([e(n, this.deviceId), i(n)]);
			if (r !== this._loadSeq) return;
			this._catalog = a, this._device = t, this._error = void 0, this._watched = w(t);
		} catch (e) {
			if (r !== this._loadSeq) return;
			this._error = a(e).message;
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
		let e = this._device, r = e?.node;
		return n`
      <div class="header">
        <button class="text with-icon back" @click=${() => {
			t(this, { view: "list" });
		}}>${u("back")}All devices</button>
      </div>
      ${this._error ? n`<div class="banner error" role="alert">Could not load the device: ${this._error}</div>` : l}
      ${r ? n`<div class="title">
              ${this._number(r.id) === void 0 ? l : n`<span class="plat" aria-hidden="true">${this._number(r.id)}</span>`}
              <h1>${r.name ?? "Reolink device"}</h1>
              <p class="kind muted">${y(e)}</p>
            </div>
            <div class="tabs" role="tablist">
              ${C(e).map((e) => n`<button
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
                  ${b[e]}
                </button>`)}
            </div>
            ${this._tabError ? n`<div class="banner error" role="alert">
                  Could not load this tab: ${this._tabError}.
                  <button
                    @click=${() => {
			this._loadTab(h(this.tab, e));
		}}
                  >
                    Try again
                  </button>
                </div>` : l}
            ${h(this.tab, e) === "live" ? n`<rv-live-camera .hass=${this.hass} .deviceId=${r.id}></rv-live-camera>` : h(this.tab, e) === "playback" ? n`<rv-playback
                  .hass=${this.hass}
                  .deviceId=${r.id}
                  .cameraName=${r.name ?? ""}
                  .at=${this.at}
                  .offline=${_(e)}
                  .storage=${r.kind === "camera" ? r.recordings?.storage ?? null : null}
                  .recorder=${g(e)}
                ></rv-playback>` : h(this.tab, e) === "no-recordings" ? v(e) : h(this.tab, e) === "overview" ? n`<rv-overview
                  .hass=${this.hass}
                  .device=${e}
                  .devices=${this.devices}
                  .cameras=${this.cameras}
                ></rv-overview>` : n`<rv-settings
                  .hass=${this.hass}
                  .device=${e}
                  .catalog=${this._catalog}
                  @rv-entity-enabled=${() => void this.reload()}
                ></rv-settings>`}` : this._error ? l : n`<p class="muted">Loading…</p>`}
    `;
	}
	static styles = [c, o`
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
      /* A tab with nothing to show: why, and what to do, as plain prose. */
      .empty-tab {
        max-width: 64ch;
        padding: 20px 0;
      }
      .empty-tab h2 {
        margin: 0 0 8px;
        font-family: var(--rv-font-cond);
        font-size: 22px;
        font-weight: 600;
      }
      .empty-tab p {
        margin: 0 0 8px;
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
	return e === "live" ? S(t) ? "live" : "overview" : e === "playback" ? x(t) ? "playback" : t.node.kind === "camera" ? "no-recordings" : "overview" : e;
}
function g(e) {
	return (e.node.kind === "camera" ? e.node.connections.find((e) => e.playback_source) : void 0)?.via === "nvr" ? "nvr" : "camera";
}
function _(e) {
	return e.node.kind === "camera" && g(e) === "camera" && e.node.status.online === !1;
}
function v(e) {
	let t = e.node, r = t.name ?? "This camera", i = t.kind === "camera" ? t.recordings?.where : void 0;
	if (e.degraded) return n`<div class="empty-tab">
      <h2>Recordings cannot be played right now</h2>
      <p>
        ${e.compat.ok ? `Home Assistant's Reolink integration is not running, so ${r}'s recordings cannot be read.` : `Reolink Viewer needs an update to read ${r}'s recordings since Home Assistant's last update.`}
        Whatever it has recorded plays here again once this is fixed.
      </p>
    </div>`;
	if (i === "elsewhere") {
		let e = t.kind === "camera" ? t.connections.find((e) => e.via === "nvr") : void 0;
		return n`<div class="empty-tab">
      <h2>Recordings kept where they cannot be played here</h2>
      <p>
        ${e ? `${r}'s recordings are on ${e.host_name ?? "its NVR"}, which cannot send them to Home Assistant.` : `${r} records to its SD card, but cannot send its recordings to Home Assistant.`}
        Play them in the Reolink app.
      </p>
    </div>`;
	}
	return n`<div class="empty-tab">
    <h2>No recordings to play</h2>
    <p>${r} keeps no recordings: it has no SD card, and it is not on a Reolink NVR in Home Assistant.</p>
    <p class="muted">To record, put a microSD card in it and format it in the Reolink app, or add it to a Reolink NVR. Its live view and pictures work either way.</p>
  </div>`;
}
function y(e) {
	let t = e.node, n = [s(t.kind), t.model ?? void 0];
	if (t.kind === "camera" && t.connections.length > 1) {
		let e = new Set(t.connections.map((e) => e.via));
		n.push(e.has("nvr") && e.has("direct") ? "on the NVR and added directly" : `${String(t.connections.length)} connections`);
	}
	return n.filter(Boolean).join(" · ");
}
var b = {
	overview: "Overview",
	live: "Live",
	playback: "Playback",
	settings: "Settings"
};
function x(e) {
	return e.node.kind === "camera" && e.node.connections.some((e) => e.playback_source);
}
function S(e) {
	return e.node.kind === "camera" && !e.degraded;
}
function C(e) {
	return [
		"overview",
		...S(e) ? ["live"] : [],
		...e.node.kind === "camera" ? ["playback"] : [],
		"settings"
	];
}
function w(e) {
	let t = e.connections.flatMap((e) => e.entities.map((e) => e.entity_id));
	return e.node.kind === "camera" && e.node.snapshot_entity_id && t.push(e.node.snapshot_entity_id), t;
}
customElements.get("rv-device-page") || customElements.define("rv-device-page", m);
//#endregion
export { m as RvDevicePage, S as hasLive, x as hasPlayback, y as kindLine, _ as playbackOffline, g as playbackRecorder, h as shownTab, C as tabsFor, w as watchedEntities };

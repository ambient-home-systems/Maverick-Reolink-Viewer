import { F as e, Gt as t, Jt as n, Kt as r, St as i, Ut as a, i as o, it as s, qt as c, vt as l, xt as u } from "./home-DANJK4HC.js";
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
	overview: () => import("./overview-DkAupEjN.js"),
	playback: () => import("./playback-D2rLMXgs.js"),
	settings: () => import("./settings-JPCJCEbV.js")
}, p = 1e3, m = class extends t {
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
	async _load(e = !1) {
		let t = this.hass;
		if (!t || !this.deviceId) return;
		let n = ++this._loadSeq;
		e || (this._device = void 0, this._error = void 0);
		try {
			let [e, r] = await Promise.all([i(t, this.deviceId), u(t)]);
			if (n !== this._loadSeq) return;
			this._catalog = r, this._device = e, this._error = void 0, this._watched = w(e);
		} catch (e) {
			if (n !== this._loadSeq) return;
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
		let t = this._device, n = t?.node;
		return c`
      <div class="header">
        <button class="text with-icon back" @click=${() => {
			e(this, { view: "list" });
		}}>${l("back")}All devices</button>
      </div>
      ${this._error ? c`<div class="banner error" role="alert">Could not load the device: ${this._error}</div>` : r}
      ${n ? c`<div class="title">
              ${this._number(n.id) === void 0 ? r : c`<span class="plat" aria-hidden="true">${this._number(n.id)}</span>`}
              <h1>${n.name ?? "Reolink device"}</h1>
              <p class="kind muted">${y(t)}</p>
            </div>
            <div class="tabs" role="tablist">
              ${C(t).map((t) => c`<button
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
                  ${b[t]}
                </button>`)}
            </div>
            ${t.degraded ? c`<div class="banner warning small">
                  Degraded mode: the Reolink integration's internals changed, so device details are
                  missing. Settings still work.
                </div>` : r}
            ${this._tabError ? c`<div class="banner error" role="alert">
                  Could not load this tab: ${this._tabError}.
                  <button
                    @click=${() => {
			this._loadTab(h(this.tab, t));
		}}
                  >
                    Try again
                  </button>
                </div>` : r}
            ${h(this.tab, t) === "live" ? c`<rv-live-camera .hass=${this.hass} .deviceId=${n.id}></rv-live-camera>` : h(this.tab, t) === "playback" ? c`<rv-playback
                  .hass=${this.hass}
                  .deviceId=${n.id}
                  .cameraName=${n.name ?? ""}
                  .at=${this.at}
                  .offline=${_(t)}
                  .storage=${n.kind === "camera" ? n.recordings?.storage ?? null : null}
                  .recorder=${g(t)}
                ></rv-playback>` : h(this.tab, t) === "no-recordings" ? v(t) : h(this.tab, t) === "overview" ? c`<rv-overview
                  .hass=${this.hass}
                  .device=${t}
                  .devices=${this.devices}
                  .cameras=${this.cameras}
                ></rv-overview>` : c`<rv-settings
                  .hass=${this.hass}
                  .device=${t}
                  .catalog=${this._catalog}
                  @rv-entity-enabled=${() => void this.reload()}
                ></rv-settings>`}` : this._error ? r : c`<p class="muted">Loading…</p>`}
    `;
	}
	static styles = [s, n`
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
	let t = e.node, n = t.name ?? "This camera", r = t.kind === "camera" ? t.recordings?.where : void 0;
	if (e.degraded) return c`<div class="empty-tab">
      <h2>No playback in degraded mode</h2>
      <p>The Reolink integration's internals changed in this Home Assistant release, so its recordings cannot be read. Update Reolink Viewer when a new version is out.</p>
    </div>`;
	if (r === "elsewhere") {
		let e = t.kind === "camera" ? t.connections.find((e) => e.via === "nvr") : void 0;
		return c`<div class="empty-tab">
      <h2>Recordings kept where they cannot be played here</h2>
      <p>
        ${e ? `${n}'s recordings are on ${e.host_name ?? "its NVR"}, which cannot send them to Home Assistant.` : `${n} records to its SD card, but cannot send its recordings to Home Assistant.`}
        Play them in the Reolink app.
      </p>
    </div>`;
	}
	return c`<div class="empty-tab">
    <h2>No recordings to play</h2>
    <p>${n} keeps no recordings: it has no SD card, and it is not on a Reolink NVR in Home Assistant.</p>
    <p class="muted">To record, put a microSD card in it and format it in the Reolink app, or add it to a Reolink NVR. Its live view and pictures work either way.</p>
  </div>`;
}
function y(e) {
	let t = e.node, n = [o(t.kind), t.model ?? void 0];
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

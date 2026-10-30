import { Ct as e, F as t, Gt as n, Jt as r, Xt as i, Yt as a, bt as o, i as s, it as c, qt as l, wt as u } from "./home-CE8p8jR0.js";
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
	overview: () => import("./overview-8QXvOMBU.js"),
	playback: () => import("./playback-DRftUPRv.js"),
	settings: () => import("./settings-A2Fa4eQK.js")
}, p = 1e3, m = class extends l {
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
	_onTabKey(e, t) {
		let n = [...this.renderRoot.querySelectorAll("[role=\"tab\"]")], r = n.findIndex((e) => e === this.renderRoot.activeElement);
		if (r < 0) return;
		let i = e.key === "ArrowRight" ? (r + 1) % t.length : e.key === "ArrowLeft" ? (r - 1 + t.length) % t.length : e.key === "Home" ? 0 : e.key === "End" ? t.length - 1 : void 0;
		i !== void 0 && (e.preventDefault(), n[i]?.focus());
	}
	_loadTab(e) {
		e !== "live" && e !== "no-recordings" && (this._tabError = void 0, f[e]().catch((e) => {
			this._tabError = n(e).message;
		}));
	}
	updated() {
		this._renderedStates = this.hass?.states;
	}
	async reload() {
		await this._load(!0);
	}
	async _load(t = !1) {
		let r = this.hass;
		if (!r || !this.deviceId) return;
		let i = ++this._loadSeq;
		t || (this._device = void 0, this._error = void 0);
		try {
			let [t, n] = await Promise.all([u(r, this.deviceId), e(r)]);
			if (i !== this._loadSeq) return;
			this._catalog = n, this._device = t, this._error = void 0, this._watched = w(t);
		} catch (e) {
			if (i !== this._loadSeq) return;
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
		let e = this._device, n = e?.node;
		return a`
      <div class="header">
        <button class="text with-icon back" @click=${() => {
			t(this, { view: "list" });
		}}>${o("back")}All devices</button>
      </div>
      ${this._error ? a`<div class="banner error" role="alert">Could not load the device: ${this._error}</div>` : r}
      ${n ? a`<div class="title">
              ${this._number(n.id) === void 0 ? r : a`<span class="plat" aria-hidden="true">${this._number(n.id)}</span>`}
              <h1>${n.name ?? "Reolink device"}</h1>
              <p class="kind muted">${y(e)}</p>
            </div>
            <div
              class="tabs"
              role="tablist"
              aria-label=${n.name ?? "Device"}
              @keydown=${(t) => {
			this._onTabKey(t, C(e));
		}}
            >
              ${C(e).map((e) => a`<button
                  role="tab"
                  id=${`tab-${e}`}
                  aria-controls="tab-panel"
                  aria-selected=${this.tab === e ? "true" : "false"}
                  tabindex=${this.tab === e ? "0" : "-1"}
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
            ${this._tabError ? a`<div class="banner error" role="alert">
                  Could not load this tab: ${this._tabError}.
                  <button
                    @click=${() => {
			this._loadTab(h(this.tab, e));
		}}
                  >
                    Try again
                  </button>
                </div>` : r}
            <div class="panel" role="tabpanel" id="tab-panel" aria-labelledby=${`tab-${this.tab}`}>
            ${h(this.tab, e) === "live" ? a`<rv-live-camera .hass=${this.hass} .deviceId=${n.id}></rv-live-camera>` : h(this.tab, e) === "playback" ? a`<rv-playback
                  .hass=${this.hass}
                  .deviceId=${n.id}
                  .cameraName=${n.name ?? ""}
                  .at=${this.at}
                  .offline=${_(e)}
                  .storage=${n.kind === "camera" ? n.recordings?.storage ?? null : null}
                  .recorder=${g(e)}
                ></rv-playback>` : h(this.tab, e) === "no-recordings" ? v(e) : h(this.tab, e) === "overview" ? a`<rv-overview
                  .hass=${this.hass}
                  .device=${e}
                  .devices=${this.devices}
                  .cameras=${this.cameras}
                ></rv-overview>` : a`<rv-settings
                  .hass=${this.hass}
                  .device=${e}
                  .catalog=${this._catalog}
                  @rv-entity-enabled=${() => void this.reload()}
                ></rv-settings>`}
            </div>` : this._error ? r : a`<p class="muted">Loading…</p>`}
    `;
	}
	static styles = [c, i`
      :host {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .back {
        padding-left: 0;
      }
      .panel {
        min-width: 0;
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
	if (e.degraded) return a`<div class="empty-tab">
      <h2>Recordings cannot be played right now</h2>
      <p>
        ${e.compat.ok ? `Home Assistant's Reolink integration is not running, so ${n}'s recordings cannot be read.` : `Reolink Viewer needs an update to read ${n}'s recordings since Home Assistant's last update.`}
        Whatever it has recorded plays here again once this is fixed.
      </p>
    </div>`;
	if (r === "elsewhere") {
		let e = t.kind === "camera" ? t.connections.find((e) => e.via === "nvr") : void 0;
		return a`<div class="empty-tab">
      <h2>Recordings kept where they cannot be played here</h2>
      <p>
        ${e ? `${n}'s recordings are on ${e.host_name ?? "its NVR"}, which cannot send them to Home Assistant.` : `${n} records to its SD card, but cannot send its recordings to Home Assistant.`}
        Play them in the Reolink app.
      </p>
    </div>`;
	}
	return a`<div class="empty-tab">
    <h2>No recordings to play</h2>
    <p>${n} keeps no recordings: it has no SD card, and it is not on a Reolink NVR in Home Assistant.</p>
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

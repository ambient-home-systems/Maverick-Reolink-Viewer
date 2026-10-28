import { Jt as e, Kt as t, Yt as n, a as r, i, it as a, o, qt as s, r as c, yt as l } from "./home-CRi9TKP3.js";
import "./device-list-pHZneJA8.js";
//#region src/components/overview.ts
var u = 3e4, d = {
	people: "person",
	dog_cat: "animal",
	"non-motor_vehicle": "bicycle"
}, f = class extends t {
	static properties = {
		hass: { attribute: !1 },
		device: { attribute: !1 },
		devices: { attribute: !1 },
		cameras: { attribute: !1 },
		_stamp: { state: !0 }
	};
	_timer;
	constructor() {
		super(), this.cameras = [], this._stamp = 0;
	}
	connectedCallback() {
		super.connectedCallback(), this._startTimer();
	}
	disconnectedCallback() {
		super.disconnectedCallback(), clearInterval(this._timer), this._timer = void 0;
	}
	updated(e) {
		e.has("device") && this._startTimer();
	}
	_startTimer() {
		clearInterval(this._timer), this._timer = void 0;
		let e = this.device?.node;
		e?.kind === "camera" && e.primary_view === "snapshot" && this.isConnected && (this._timer = setInterval(() => {
			document.visibilityState === "visible" && (this._stamp = Date.now());
		}, u));
	}
	snapshotUrl() {
		let e = this.device?.node;
		if (e?.kind !== "camera" || !e.snapshot_entity_id) return null;
		let t = this.hass?.states[e.snapshot_entity_id]?.attributes.entity_picture;
		return typeof t != "string" || !t ? null : this._stamp ? `${t}${t.includes("?") ? "&" : "?"}_=${this._stamp}` : t;
	}
	render() {
		let t = this.device;
		if (!t) return e``;
		let n = t.node;
		return e`
      ${n.kind === "camera" ? this._renderSnapshot(n) : this._renderCameras()}
      <div class="connections">${t.connections.map((e) => this._renderConnection(e, t))}</div>
    `;
	}
	_renderSnapshot(t) {
		let n = this.snapshotUrl(), r = t.primary_view === "snapshot";
		return e`<figure class="snapshot ${r ? "primary" : ""}">
      <div class="frame">
        ${n ? e`<img src=${n} alt="Latest snapshot of ${t.name ?? "the camera"}" />` : e`<p class="none">
              No snapshot: enable one of this camera's stream entities (for example
              <em>Fluent</em>) in the Settings tab.
            </p>`}
      </div>
      <figcaption>
        <span>Latest snapshot</span>
        <button
          class="text with-icon"
          ?disabled=${!n}
          @click=${() => {
			this._stamp = Date.now();
		}}
        >
          ${l("refresh")}Refresh
        </button>
      </figcaption>
      ${r ? e`<p class="muted small">
            This camera does not record, so snapshots are its main view. The picture refreshes
            every ${u / 1e3} seconds while this page is open.
          </p>` : s}
    </figure>`;
	}
	_renderCameras() {
		let t = this.device?.node;
		if (t?.kind === "camera") return s;
		let n = t?.camera_ids.length ?? 0;
		return e`<section class="card">
      <h2>Cameras</h2>
      ${this.devices && t ? e`<rv-device-list .devices=${this.devices} .cameras=${this.cameras} .hostId=${t.id}></rv-device-list>` : e`<p class="muted">
            ${n} ${n === 1 ? "camera" : "cameras"} on this ${i(t?.kind ?? "nvr")}.
          </p>`}
    </section>`;
	}
	_renderConnection(t, n) {
		let r = t.details, i = n.node.kind === "camera", a = [t.channel !== void 0 && t.channel !== null && t.via === "nvr" ? `channel ${String(t.channel + 1)}` : void 0, t.playback_source ? "playback source" : void 0].filter((e) => e !== void 0);
		return e`<section class="card">
      <div class="header">
        <h2>${i ? c(t) : "Device"}</h2>
        ${a.length ? e`<span class="muted">${a.join(" · ")}</span>` : s}
      </div>
      ${r === null ? e`<p class="muted">
            ${n.degraded ? "Details are unavailable while Reolink Viewer cannot reach the Reolink integration." : "Details are unavailable."}
          </p>` : e`
            ${t.via === "direct" || !i ? g(r.host) : s}
            ${r.channel ? p(r.channel) : s}
            ${t.via === "direct" || !i ? m(r.host) : s}
          `}
      <p class="muted small">
        ${t.entities.length} entities
        (${t.entities.filter((e) => e.disabled_by !== null).length} disabled)
      </p>
    </section>`;
	}
	static styles = [a, n`
      :host {
        display: flex;
        flex-direction: column;
        gap: 28px;
      }
      .header {
        display: flex;
        align-items: baseline;
        gap: 4px 14px;
        flex-wrap: wrap;
      }
      .header h2 {
        margin: 0;
      }
      .snapshot {
        margin: 0;
        max-width: 760px;
      }
      .snapshot.primary {
        max-width: none;
      }
      /* The picture sits on the board's ink, with a margin of it. */
      .frame {
        aspect-ratio: 16 / 9;
        display: grid;
        place-items: center;
        padding: 10px;
        box-sizing: border-box;
        background: var(--rv-board);
        color: var(--rv-on-board-muted);
      }
      .frame img {
        display: block;
        width: 100%;
        height: 100%;
        min-height: 0;
        object-fit: contain;
      }
      .none {
        max-width: 40ch;
        padding: 16px;
        text-align: center;
      }
      figcaption {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 0;
        border-bottom: 1px solid var(--rv-rule);
        color: var(--rv-muted);
        font-size: 14px;
      }
      .connections {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr));
        gap: 28px;
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }
      .connections .banner {
        margin: 8px 0 4px;
      }
      .storage {
        display: block;
      }
      .storage.fault {
        color: var(--rv-fault-ink);
      }
    `];
};
function p(t) {
	let n = t.online ? t.sleeping ? "Asleep" : "Online" : "Offline";
	return e`<dl class="facts">
    <dt>Model</dt>
    <dd>${t.model}${t.model_id ? e` <span class="muted">(${t.model_id})</span>` : s}</dd>
    <dt>Hardware</dt>
    <dd>${t.hardware_version}</dd>
    <dt>Firmware</dt>
    <dd>${t.firmware_version}</dd>
    <dt>Status</dt>
    <dd>${n}</dd>
    <dt>Clear stream</dt>
    <dd>${r(t.encodings.main)}</dd>
    <dt>Fluent stream</dt>
    <dd>${r(t.encodings.sub)}</dd>
    <dt>Network</dt>
    <dd>${_(t.network)}</dd>
    ${t.battery ? e`<dt>Battery</dt>
          <dd>
            ${t.battery.percent ?? "?"}%${t.battery.status ? ` · ${t.battery.status}` : ""}${t.battery.temperature_c === null ? "" : ` · ${t.battery.temperature_c} °C`}${t.wired_power ? " · on wired power" : ""}
          </dd>` : s}
    <dt>Recordings</dt>
    <dd>${t.supports_replay ? "Playback supported" : "No playback"}</dd>
    ${t.ai_types.length ? e`<dt>AI detection</dt>
          <dd>${t.ai_types.map((e) => d[e] ?? e).join(", ")}</dd>` : s}
    ${t.capabilities.length ? e`<dt>Features</dt>
          <dd class="chips">${t.capabilities.map((t) => e`<span class="badge">${t}</span>`)}</dd>` : s}
  </dl>`;
}
function m(t) {
	let n = t.ports;
	return e`<dl class="facts">
    ${t.device_type === "camera" ? s : e`<dt>Model</dt>
          <dd>${t.model ?? "?"}${t.model_id ? e` <span class="muted">(${t.model_id})</span>` : s}</dd>
          <dt>Hardware</dt>
          <dd>${t.hardware_version ?? "?"}</dd>
          <dt>Firmware</dt>
          <dd>${t.firmware_version ?? "?"}</dd>
          <dt>Channels</dt>
          <dd>${t.channels}</dd>`}
    <dt>Connection</dt>
    <dd>
      ${_(t.network)} · ${n.http.https ? "HTTPS" : "HTTP"}${n.http.port ? ` port ${n.http.port}` : ""}${t.baichuan_only ? " · Baichuan only" : ""}
    </dd>
    <dt>Protocols</dt>
    <dd>
      RTSP ${o(n.rtsp.enabled)}${n.rtsp.port ? ` (${n.rtsp.port})` : ""} · RTMP
      ${o(n.rtmp.enabled)}${n.rtmp.port ? ` (${n.rtmp.port})` : ""} · ONVIF
      ${o(n.onvif.enabled)}${n.onvif.port ? ` (${n.onvif.port})` : ""}
    </dd>
    <dt>HA stream protocol</dt>
    <dd>${t.stream_protocol ?? "?"}</dd>
    <dt>Storage</dt>
    <dd>
      ${t.storage.length ? t.storage.map((n) => e`<span class="storage ${n.available === !1 ? "fault" : ""}"
              >${h(n, t.storage.length)}:
              ${n.available === !1 ? "not ready (not formatted, or failed)" : n.used_percent === null ? "in use" : `${String(n.used_percent)}% used`}</span
            >`) : t.device_type === "camera" ? "None: no SD card, so it keeps no recordings of its own" : "None: no hard disk, so it keeps no recordings"}
    </dd>
    ${t.cpu_usage === null ? s : e`<dt>CPU</dt>
          <dd>${t.cpu_usage}%</dd>`}
    ${t.capabilities.length ? e`<dt>Host features</dt>
          <dd class="chips">${t.capabilities.map((t) => e`<span class="badge">${t}</span>`)}</dd>` : s}
  </dl>`;
}
function h(e, t) {
	let n = e.type?.toUpperCase(), r = n === "SD" ? "SD card" : n === "HDD" ? "Hard disk" : "Disk";
	return t > 1 ? `${r} ${String(e.index + 1)}` : r;
}
function g(t) {
	let n = t.storage.filter((e) => e.available === !1);
	if (!n.length) return s;
	let r = n.map((e) => h(e, t.storage.length)).join(" and ");
	return e`<div class="banner warning" role="status">
    <strong>${r} ${n.length === 1 ? "is" : "are"} not ready</strong>: not formatted, or failed, so
    recordings may not be kept. Format ${n.length === 1 ? "it" : "them"} in the Reolink app, or replace
    ${n.length === 1 ? "it" : "them"}.
  </div>`;
}
function _(e) {
	return e.connection === "wifi" ? e.wifi_signal_dbm === null ? "Wi-Fi" : `Wi-Fi, ${e.wifi_signal_dbm} dBm` : "Ethernet";
}
customElements.get("rv-overview") || customElements.define("rv-overview", f);
//#endregion
export { f as RvOverview, u as SNAPSHOT_REFRESH_MS };

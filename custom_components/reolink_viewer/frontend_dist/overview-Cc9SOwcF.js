import { a as e, n as t, r as n, t as r } from "./lit-DdRjbP0M.js";
import { A as i, Y as a } from "./live-DWqtt9-p.js";
import { a as o, i as s, n as c, r as l } from "./home-f48M3oXR.js";
import "./device-list-CtzpBbJ7.js";
//#region src/components/overview.ts
var u = 3e4, d = {
	people: "person",
	dog_cat: "animal",
	"non-motor_vehicle": "bicycle"
}, f = class extends r {
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
		let e = this.device;
		if (!e) return n``;
		let t = e.node;
		return n`
      ${t.kind === "camera" ? this._renderSnapshot(t) : this._renderCameras()}
      <div class="connections">${e.connections.map((t) => this._renderConnection(t, e))}</div>
    `;
	}
	_renderSnapshot(e) {
		let r = this.snapshotUrl(), i = e.primary_view === "snapshot";
		return n`<figure class="snapshot ${i ? "primary" : ""}">
      <div class="frame">
        ${r ? n`<img src=${r} alt="Latest snapshot of ${e.name ?? "the camera"}" />` : n`<p class="none">
              No snapshot: enable one of this camera's stream entities (for example
              <em>Fluent</em>) in the Settings tab.
            </p>`}
      </div>
      <figcaption>
        <span>Latest snapshot</span>
        <button
          class="text with-icon"
          ?disabled=${!r}
          @click=${() => {
			this._stamp = Date.now();
		}}
        >
          ${a("refresh")}Refresh
        </button>
      </figcaption>
      ${i ? n`<p class="muted small">
            This camera does not record, so snapshots are its main view. The picture refreshes
            every ${u / 1e3} seconds while this page is open.
          </p>` : t}
    </figure>`;
	}
	_renderCameras() {
		let e = this.device?.node;
		if (e?.kind === "camera") return t;
		let r = e?.camera_ids.length ?? 0;
		return n`<section class="card">
      <h2>Cameras</h2>
      ${this.devices && e ? n`<rv-device-list .devices=${this.devices} .cameras=${this.cameras} .hostId=${e.id}></rv-device-list>` : n`<p class="muted">
            ${r} ${r === 1 ? "camera" : "cameras"} on this ${l(e?.kind ?? "nvr")}.
          </p>`}
    </section>`;
	}
	_renderConnection(e, r) {
		let i = e.details, a = r.node.kind === "camera", o = [e.channel !== void 0 && e.channel !== null && e.via === "nvr" ? `channel ${String(e.channel + 1)}` : void 0, e.playback_source ? "playback source" : void 0].filter((e) => e !== void 0);
		return n`<section class="card">
      <div class="header">
        <h2>${a ? c(e) : "Device"}</h2>
        ${o.length ? n`<span class="muted">${o.join(" · ")}</span>` : t}
      </div>
      ${i === null ? n`<p class="muted">
            ${r.degraded ? "Details are unavailable while Reolink Viewer cannot reach the Reolink integration." : "Details are unavailable."}
          </p>` : n`
            ${e.via === "direct" || !a ? g(i.host) : t}
            ${i.channel ? p(i.channel) : t}
            ${e.via === "direct" || !a ? m(i.host) : t}
          `}
      <p class="muted small">
        ${e.entities.length} entities
        (${e.entities.filter((e) => e.disabled_by !== null).length} disabled)
      </p>
    </section>`;
	}
	static styles = [i, e`
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
function p(e) {
	let r = e.online ? e.sleeping ? "Asleep" : "Online" : "Offline";
	return n`<dl class="facts">
    <dt>Model</dt>
    <dd>${e.model}${e.model_id ? n` <span class="muted">(${e.model_id})</span>` : t}</dd>
    <dt>Hardware</dt>
    <dd>${e.hardware_version}</dd>
    <dt>Firmware</dt>
    <dd>${e.firmware_version}</dd>
    <dt>Status</dt>
    <dd>${r}</dd>
    <dt>Clear stream</dt>
    <dd>${s(e.encodings.main)}</dd>
    <dt>Fluent stream</dt>
    <dd>${s(e.encodings.sub)}</dd>
    <dt>Network</dt>
    <dd>${_(e.network)}</dd>
    ${e.battery ? n`<dt>Battery</dt>
          <dd>
            ${e.battery.percent ?? "?"}%${e.battery.status ? ` · ${e.battery.status}` : ""}${e.battery.temperature_c === null ? "" : ` · ${e.battery.temperature_c} °C`}${e.wired_power ? " · on wired power" : ""}
          </dd>` : t}
    <dt>Recordings</dt>
    <dd>${e.supports_replay ? "Playback supported" : "No playback"}</dd>
    ${e.ai_types.length ? n`<dt>AI detection</dt>
          <dd>${e.ai_types.map((e) => d[e] ?? e).join(", ")}</dd>` : t}
    ${e.capabilities.length ? n`<dt>Features</dt>
          <dd class="chips">${e.capabilities.map((e) => n`<span class="badge">${e}</span>`)}</dd>` : t}
  </dl>`;
}
function m(e) {
	let r = e.ports;
	return n`<dl class="facts">
    ${e.device_type === "camera" ? t : n`<dt>Model</dt>
          <dd>${e.model ?? "?"}${e.model_id ? n` <span class="muted">(${e.model_id})</span>` : t}</dd>
          <dt>Hardware</dt>
          <dd>${e.hardware_version ?? "?"}</dd>
          <dt>Firmware</dt>
          <dd>${e.firmware_version ?? "?"}</dd>
          <dt>Channels</dt>
          <dd>${e.channels}</dd>`}
    <dt>Connection</dt>
    <dd>
      ${_(e.network)} · ${r.http.https ? "HTTPS" : "HTTP"}${r.http.port ? ` port ${r.http.port}` : ""}${e.baichuan_only ? " · Baichuan only" : ""}
    </dd>
    <dt>Protocols</dt>
    <dd>
      RTSP ${o(r.rtsp.enabled)}${r.rtsp.port ? ` (${r.rtsp.port})` : ""} · RTMP
      ${o(r.rtmp.enabled)}${r.rtmp.port ? ` (${r.rtmp.port})` : ""} · ONVIF
      ${o(r.onvif.enabled)}${r.onvif.port ? ` (${r.onvif.port})` : ""}
    </dd>
    <dt>HA stream protocol</dt>
    <dd>${e.stream_protocol ?? "?"}</dd>
    <dt>Storage</dt>
    <dd>
      ${e.storage.length ? e.storage.map((t) => n`<span class="storage ${t.available === !1 ? "fault" : ""}"
              >${h(t, e.storage.length)}:
              ${t.available === !1 ? "not ready (not formatted, or failed)" : t.used_percent === null ? "in use" : `${String(t.used_percent)}% used`}</span
            >`) : e.device_type === "camera" ? "None: no SD card, so it keeps no recordings of its own" : "None: no hard disk, so it keeps no recordings"}
    </dd>
    ${e.cpu_usage === null ? t : n`<dt>CPU</dt>
          <dd>${e.cpu_usage}%</dd>`}
    ${e.capabilities.length ? n`<dt>Host features</dt>
          <dd class="chips">${e.capabilities.map((e) => n`<span class="badge">${e}</span>`)}</dd>` : t}
  </dl>`;
}
function h(e, t) {
	let n = e.type?.toUpperCase(), r = n === "SD" ? "SD card" : n === "HDD" ? "Hard disk" : "Disk";
	return t > 1 ? `${r} ${String(e.index + 1)}` : r;
}
function g(e) {
	let r = e.storage.filter((e) => e.available === !1);
	if (!r.length) return t;
	let i = r.map((t) => h(t, e.storage.length)).join(" and ");
	return n`<div class="banner warning" role="status">
    <strong>${i} ${r.length === 1 ? "is" : "are"} not ready</strong>: not formatted, or failed, so
    recordings may not be kept. Format ${r.length === 1 ? "it" : "them"} in the Reolink app, or replace
    ${r.length === 1 ? "it" : "them"}.
  </div>`;
}
function _(e) {
	return e.connection === "wifi" ? e.wifi_signal_dbm === null ? "Wi-Fi" : `Wi-Fi, ${e.wifi_signal_dbm} dBm` : "Ethernet";
}
customElements.get("rv-overview") || customElements.define("rv-overview", f);
//#endregion
export { f as RvOverview, u as SNAPSHOT_REFRESH_MS };

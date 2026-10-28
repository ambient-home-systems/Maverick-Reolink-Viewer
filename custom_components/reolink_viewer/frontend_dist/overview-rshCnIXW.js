import { Jt as e, Xt as t, Yt as n, a as r, bt as i, i as a, it as o, o as s, qt as c, r as l } from "./home-DgrbDGsx.js";
import "./device-list-CDwN-T-J.js";
//#region src/components/overview.ts
var u = 3e4, d = {
	people: "person",
	dog_cat: "animal",
	"non-motor_vehicle": "bicycle"
}, f = class extends c {
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
	_renderSnapshot(t) {
		let r = this.snapshotUrl(), a = t.primary_view === "snapshot";
		return n`<figure class="snapshot ${a ? "primary" : ""}">
      <div class="frame">
        ${r ? n`<img src=${r} alt="Latest snapshot of ${t.name ?? "the camera"}" />` : n`<p class="none">
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
          ${i("refresh")}Refresh
        </button>
      </figcaption>
      ${a ? n`<p class="muted small">
            This camera does not record, so snapshots are its main view. The picture refreshes
            every ${u / 1e3} seconds while this page is open.
          </p>` : e}
    </figure>`;
	}
	_renderCameras() {
		let t = this.device?.node;
		if (t?.kind === "camera") return e;
		let r = t?.camera_ids.length ?? 0;
		return n`<section class="card">
      <h2>Cameras</h2>
      ${this.devices && t ? n`<rv-device-list .devices=${this.devices} .cameras=${this.cameras} .hostId=${t.id}></rv-device-list>` : n`<p class="muted">
            ${r} ${r === 1 ? "camera" : "cameras"} on this ${a(t?.kind ?? "nvr")}.
          </p>`}
    </section>`;
	}
	_renderConnection(t, r) {
		let i = t.details, a = r.node.kind === "camera", o = [t.channel !== void 0 && t.channel !== null && t.via === "nvr" ? `channel ${String(t.channel + 1)}` : void 0, t.playback_source ? "playback source" : void 0].filter((e) => e !== void 0);
		return n`<section class="card">
      <div class="header">
        <h2>${a ? l(t) : "Device"}</h2>
        ${o.length ? n`<span class="muted">${o.join(" · ")}</span>` : e}
      </div>
      ${i === null ? n`<p class="muted">
            ${r.degraded ? "Details are unavailable while Reolink Viewer cannot reach the Reolink integration." : "Details are unavailable."}
          </p>` : n`
            ${t.via === "direct" || !a ? g(i.host) : e}
            ${i.channel ? p(i.channel) : e}
            ${t.via === "direct" || !a ? m(i.host) : e}
          `}
      <p class="muted small">
        ${t.entities.length} entities
        (${t.entities.filter((e) => e.disabled_by !== null).length} disabled)
      </p>
    </section>`;
	}
	static styles = [o, t`
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
	let i = t.online ? t.sleeping ? "Asleep" : "Online" : "Offline";
	return n`<dl class="facts">
    <dt>Model</dt>
    <dd>${t.model}${t.model_id ? n` <span class="muted">(${t.model_id})</span>` : e}</dd>
    <dt>Hardware</dt>
    <dd>${t.hardware_version}</dd>
    <dt>Firmware</dt>
    <dd>${t.firmware_version}</dd>
    <dt>Status</dt>
    <dd>${i}</dd>
    <dt>Clear stream</dt>
    <dd>${r(t.encodings.main)}</dd>
    <dt>Fluent stream</dt>
    <dd>${r(t.encodings.sub)}</dd>
    <dt>Network</dt>
    <dd>${_(t.network)}</dd>
    ${t.battery ? n`<dt>Battery</dt>
          <dd>
            ${t.battery.percent ?? "?"}%${t.battery.status ? ` · ${t.battery.status}` : ""}${t.battery.temperature_c === null ? "" : ` · ${t.battery.temperature_c} °C`}${t.wired_power ? " · on wired power" : ""}
          </dd>` : e}
    <dt>Recordings</dt>
    <dd>${t.supports_replay ? "Playback supported" : "No playback"}</dd>
    ${t.ai_types.length ? n`<dt>AI detection</dt>
          <dd>${t.ai_types.map((e) => d[e] ?? e).join(", ")}</dd>` : e}
    ${t.capabilities.length ? n`<dt>Features</dt>
          <dd class="chips">${t.capabilities.map((e) => n`<span class="badge">${e}</span>`)}</dd>` : e}
  </dl>`;
}
function m(t) {
	let r = t.ports;
	return n`<dl class="facts">
    ${t.device_type === "camera" ? e : n`<dt>Model</dt>
          <dd>${t.model ?? "?"}${t.model_id ? n` <span class="muted">(${t.model_id})</span>` : e}</dd>
          <dt>Hardware</dt>
          <dd>${t.hardware_version ?? "?"}</dd>
          <dt>Firmware</dt>
          <dd>${t.firmware_version ?? "?"}</dd>
          <dt>Channels</dt>
          <dd>${t.channels}</dd>`}
    <dt>Connection</dt>
    <dd>
      ${_(t.network)} · ${r.http.https ? "HTTPS" : "HTTP"}${r.http.port ? ` port ${r.http.port}` : ""}${t.baichuan_only ? " · Baichuan only" : ""}
    </dd>
    <dt>Protocols</dt>
    <dd>
      RTSP ${s(r.rtsp.enabled)}${r.rtsp.port ? ` (${r.rtsp.port})` : ""} · RTMP
      ${s(r.rtmp.enabled)}${r.rtmp.port ? ` (${r.rtmp.port})` : ""} · ONVIF
      ${s(r.onvif.enabled)}${r.onvif.port ? ` (${r.onvif.port})` : ""}
    </dd>
    <dt>HA stream protocol</dt>
    <dd>${t.stream_protocol ?? "?"}</dd>
    <dt>Storage</dt>
    <dd>
      ${t.storage.length ? t.storage.map((e) => n`<span class="storage ${e.available === !1 ? "fault" : ""}"
              >${h(e, t.storage.length)}:
              ${e.available === !1 ? "not ready (not formatted, or failed)" : e.used_percent === null ? "in use" : `${String(e.used_percent)}% used`}</span
            >`) : t.device_type === "camera" ? "None: no SD card, so it keeps no recordings of its own" : "None: no hard disk, so it keeps no recordings"}
    </dd>
    ${t.cpu_usage === null ? e : n`<dt>CPU</dt>
          <dd>${t.cpu_usage}%</dd>`}
    ${t.capabilities.length ? n`<dt>Host features</dt>
          <dd class="chips">${t.capabilities.map((e) => n`<span class="badge">${e}</span>`)}</dd>` : e}
  </dl>`;
}
function h(e, t) {
	let n = e.type?.toUpperCase(), r = n === "SD" ? "SD card" : n === "HDD" ? "Hard disk" : "Disk";
	return t > 1 ? `${r} ${String(e.index + 1)}` : r;
}
function g(t) {
	let r = t.storage.filter((e) => e.available === !1);
	if (!r.length) return e;
	let i = r.map((e) => h(e, t.storage.length)).join(" and ");
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

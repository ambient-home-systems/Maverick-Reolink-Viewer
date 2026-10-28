import { Gt as e, Jt as t, Kt as n, a as r, i, it as a, o, qt as s, r as c, vt as l } from "./home-B--azFjF.js";
import "./device-list-hWsSKSQk.js";
//#region src/components/overview.ts
var u = 3e4, d = {
	people: "person",
	dog_cat: "animal",
	"non-motor_vehicle": "bicycle"
}, f = class extends e {
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
		if (!e) return s``;
		let t = e.node;
		return s`
      ${t.kind === "camera" ? this._renderSnapshot(t) : this._renderCameras()}
      <div class="connections">${e.connections.map((t) => this._renderConnection(t, e))}</div>
    `;
	}
	_renderSnapshot(e) {
		let t = this.snapshotUrl(), r = e.primary_view === "snapshot";
		return s`<figure class="snapshot ${r ? "primary" : ""}">
      <div class="frame">
        ${t ? s`<img src=${t} alt="Latest snapshot of ${e.name ?? "the camera"}" />` : s`<p class="none">
              No snapshot: enable one of this camera's stream entities (for example
              <em>Fluent</em>) in the Settings tab.
            </p>`}
      </div>
      <figcaption>
        <span>Latest snapshot</span>
        <button
          class="text with-icon"
          ?disabled=${!t}
          @click=${() => {
			this._stamp = Date.now();
		}}
        >
          ${l("refresh")}Refresh
        </button>
      </figcaption>
      ${r ? s`<p class="muted small">
            This camera does not record, so snapshots are its main view. The picture refreshes
            every ${u / 1e3} seconds while this page is open.
          </p>` : n}
    </figure>`;
	}
	_renderCameras() {
		let e = this.device?.node;
		if (e?.kind === "camera") return n;
		let t = e?.camera_ids.length ?? 0;
		return s`<section class="card">
      <h2>Cameras</h2>
      ${this.devices && e ? s`<rv-device-list .devices=${this.devices} .cameras=${this.cameras} .hostId=${e.id}></rv-device-list>` : s`<p class="muted">
            ${t} ${t === 1 ? "camera" : "cameras"} on this ${i(e?.kind ?? "nvr")}.
          </p>`}
    </section>`;
	}
	_renderConnection(e, t) {
		let r = e.details, i = t.node.kind === "camera", a = [e.channel !== void 0 && e.channel !== null && e.via === "nvr" ? `channel ${String(e.channel + 1)}` : void 0, e.playback_source ? "playback source" : void 0].filter((e) => e !== void 0);
		return s`<section class="card">
      <div class="header">
        <h2>${i ? c(e) : "Device"}</h2>
        ${a.length ? s`<span class="muted">${a.join(" · ")}</span>` : n}
      </div>
      ${r === null ? s`<p class="muted">
            Details are unavailable${t.degraded ? " in degraded mode" : ""}.
          </p>` : s`
            ${r.channel ? p(r.channel) : n}
            ${e.via === "direct" || !i ? m(r.host) : n}
          `}
      <p class="muted small">
        ${e.entities.length} entities
        (${e.entities.filter((e) => e.disabled_by !== null).length} disabled)
      </p>
    </section>`;
	}
	static styles = [a, t`
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
    `];
};
function p(e) {
	let t = e.online ? e.sleeping ? "Asleep" : "Online" : "Offline";
	return s`<dl class="facts">
    <dt>Model</dt>
    <dd>${e.model}${e.model_id ? s` <span class="muted">(${e.model_id})</span>` : n}</dd>
    <dt>Hardware</dt>
    <dd>${e.hardware_version}</dd>
    <dt>Firmware</dt>
    <dd>${e.firmware_version}</dd>
    <dt>Status</dt>
    <dd>${t}</dd>
    <dt>Clear stream</dt>
    <dd>${r(e.encodings.main)}</dd>
    <dt>Fluent stream</dt>
    <dd>${r(e.encodings.sub)}</dd>
    <dt>Network</dt>
    <dd>${h(e.network)}</dd>
    ${e.battery ? s`<dt>Battery</dt>
          <dd>
            ${e.battery.percent ?? "?"}%${e.battery.status ? ` · ${e.battery.status}` : ""}${e.battery.temperature_c === null ? "" : ` · ${e.battery.temperature_c} °C`}${e.wired_power ? " · on wired power" : ""}
          </dd>` : n}
    <dt>Recordings</dt>
    <dd>${e.supports_replay ? "Playback supported" : "No playback"}</dd>
    ${e.ai_types.length ? s`<dt>AI detection</dt>
          <dd>${e.ai_types.map((e) => d[e] ?? e).join(", ")}</dd>` : n}
    ${e.capabilities.length ? s`<dt>Features</dt>
          <dd class="chips">${e.capabilities.map((e) => s`<span class="badge">${e}</span>`)}</dd>` : n}
  </dl>`;
}
function m(e) {
	let t = e.ports;
	return s`<dl class="facts">
    ${e.device_type === "camera" ? n : s`<dt>Model</dt>
          <dd>${e.model ?? "?"}${e.model_id ? s` <span class="muted">(${e.model_id})</span>` : n}</dd>
          <dt>Hardware</dt>
          <dd>${e.hardware_version ?? "?"}</dd>
          <dt>Firmware</dt>
          <dd>${e.firmware_version ?? "?"}</dd>
          <dt>Channels</dt>
          <dd>${e.channels}</dd>`}
    <dt>Connection</dt>
    <dd>
      ${h(e.network)} · ${t.http.https ? "HTTPS" : "HTTP"}${t.http.port ? ` port ${t.http.port}` : ""}${e.baichuan_only ? " · Baichuan only" : ""}
    </dd>
    <dt>Protocols</dt>
    <dd>
      RTSP ${o(t.rtsp.enabled)}${t.rtsp.port ? ` (${t.rtsp.port})` : ""} · RTMP
      ${o(t.rtmp.enabled)}${t.rtmp.port ? ` (${t.rtmp.port})` : ""} · ONVIF
      ${o(t.onvif.enabled)}${t.onvif.port ? ` (${t.onvif.port})` : ""}
    </dd>
    <dt>HA stream protocol</dt>
    <dd>${e.stream_protocol ?? "?"}</dd>
    <dt>Storage</dt>
    <dd>
      ${e.storage.length ? e.storage.map((e, t) => s`${t ? s`<br />` : n}${e.type ?? "disk"} ${e.index + 1}:
              ${e.used_percent === null ? "?" : `${e.used_percent}% used`}${e.available === !1 ? " (not available)" : ""}`) : "none"}
    </dd>
    ${e.cpu_usage === null ? n : s`<dt>CPU</dt>
          <dd>${e.cpu_usage}%</dd>`}
    ${e.capabilities.length ? s`<dt>Host features</dt>
          <dd class="chips">${e.capabilities.map((e) => s`<span class="badge">${e}</span>`)}</dd>` : n}
  </dl>`;
}
function h(e) {
	return e.connection === "wifi" ? e.wifi_signal_dbm === null ? "Wi-Fi" : `Wi-Fi, ${e.wifi_signal_dbm} dBm` : "Ethernet";
}
customElements.get("rv-overview") || customElements.define("rv-overview", f);
//#endregion
export { f as RvOverview, u as SNAPSHOT_REFRESH_MS };

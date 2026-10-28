import { Bt as e, Ht as t, Q as n, Vt as r, a as i, ft as a, i as o, o as s, r as c, zt as l } from "./home-CkkHTxZF.js";
import "./device-list-D4yJ8c1U.js";
//#region src/components/overview.ts
var u = 3e4, d = {
	people: "person",
	dog_cat: "animal",
	"non-motor_vehicle": "bicycle"
}, f = class extends l {
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
		if (!e) return r``;
		let t = e.node;
		return r`
      ${t.kind === "camera" ? this._renderSnapshot(t) : this._renderCameras()}
      <div class="connections">${e.connections.map((t) => this._renderConnection(t, e))}</div>
    `;
	}
	_renderSnapshot(t) {
		let n = this.snapshotUrl(), i = t.primary_view === "snapshot";
		return r`<figure class="snapshot ${i ? "primary" : ""}">
      <div class="frame">
        ${n ? r`<img src=${n} alt="Latest snapshot of ${t.name ?? "the camera"}" />` : r`<p class="none">
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
          ${a("refresh")}Refresh
        </button>
      </figcaption>
      ${i ? r`<p class="muted small">
            This camera does not record, so snapshots are its main view. The picture refreshes
            every ${u / 1e3} seconds while this page is open.
          </p>` : e}
    </figure>`;
	}
	_renderCameras() {
		let t = this.device?.node;
		if (t?.kind === "camera") return e;
		let n = t?.camera_ids.length ?? 0;
		return r`<section class="card">
      <h2>Cameras</h2>
      ${this.devices && t ? r`<rv-device-list .devices=${this.devices} .cameras=${this.cameras} .hostId=${t.id}></rv-device-list>` : r`<p class="muted">
            ${n} ${n === 1 ? "camera" : "cameras"} on this ${o(t?.kind ?? "nvr")}.
          </p>`}
    </section>`;
	}
	_renderConnection(t, n) {
		let i = t.details, a = n.node.kind === "camera", o = [t.channel !== void 0 && t.channel !== null && t.via === "nvr" ? `channel ${String(t.channel + 1)}` : void 0, t.playback_source ? "playback source" : void 0].filter((e) => e !== void 0);
		return r`<section class="card">
      <div class="header">
        <h2>${a ? c(t) : "Device"}</h2>
        ${o.length ? r`<span class="muted">${o.join(" · ")}</span>` : e}
      </div>
      ${i === null ? r`<p class="muted">
            Details are unavailable${n.degraded ? " in degraded mode" : ""}.
          </p>` : r`
            ${i.channel ? p(i.channel) : e}
            ${t.via === "direct" || !a ? m(i.host) : e}
          `}
      <p class="muted small">
        ${t.entities.length} entities
        (${t.entities.filter((e) => e.disabled_by !== null).length} disabled)
      </p>
    </section>`;
	}
	static styles = [n, t`
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
function p(t) {
	let n = t.online ? t.sleeping ? "Asleep" : "Online" : "Offline";
	return r`<dl class="facts">
    <dt>Model</dt>
    <dd>${t.model}${t.model_id ? r` <span class="muted">(${t.model_id})</span>` : e}</dd>
    <dt>Hardware</dt>
    <dd>${t.hardware_version}</dd>
    <dt>Firmware</dt>
    <dd>${t.firmware_version}</dd>
    <dt>Status</dt>
    <dd>${n}</dd>
    <dt>Clear stream</dt>
    <dd>${i(t.encodings.main)}</dd>
    <dt>Fluent stream</dt>
    <dd>${i(t.encodings.sub)}</dd>
    <dt>Network</dt>
    <dd>${h(t.network)}</dd>
    ${t.battery ? r`<dt>Battery</dt>
          <dd>
            ${t.battery.percent ?? "?"}%${t.battery.status ? ` · ${t.battery.status}` : ""}${t.battery.temperature_c === null ? "" : ` · ${t.battery.temperature_c} °C`}${t.wired_power ? " · on wired power" : ""}
          </dd>` : e}
    <dt>Recordings</dt>
    <dd>${t.supports_replay ? "Playback supported" : "No playback"}</dd>
    ${t.ai_types.length ? r`<dt>AI detection</dt>
          <dd>${t.ai_types.map((e) => d[e] ?? e).join(", ")}</dd>` : e}
    ${t.capabilities.length ? r`<dt>Features</dt>
          <dd class="chips">${t.capabilities.map((e) => r`<span class="badge">${e}</span>`)}</dd>` : e}
  </dl>`;
}
function m(t) {
	let n = t.ports;
	return r`<dl class="facts">
    ${t.device_type === "camera" ? e : r`<dt>Model</dt>
          <dd>${t.model ?? "?"}${t.model_id ? r` <span class="muted">(${t.model_id})</span>` : e}</dd>
          <dt>Hardware</dt>
          <dd>${t.hardware_version ?? "?"}</dd>
          <dt>Firmware</dt>
          <dd>${t.firmware_version ?? "?"}</dd>
          <dt>Channels</dt>
          <dd>${t.channels}</dd>`}
    <dt>Connection</dt>
    <dd>
      ${h(t.network)} · ${n.http.https ? "HTTPS" : "HTTP"}${n.http.port ? ` port ${n.http.port}` : ""}${t.baichuan_only ? " · Baichuan only" : ""}
    </dd>
    <dt>Protocols</dt>
    <dd>
      RTSP ${s(n.rtsp.enabled)}${n.rtsp.port ? ` (${n.rtsp.port})` : ""} · RTMP
      ${s(n.rtmp.enabled)}${n.rtmp.port ? ` (${n.rtmp.port})` : ""} · ONVIF
      ${s(n.onvif.enabled)}${n.onvif.port ? ` (${n.onvif.port})` : ""}
    </dd>
    <dt>HA stream protocol</dt>
    <dd>${t.stream_protocol ?? "?"}</dd>
    <dt>Storage</dt>
    <dd>
      ${t.storage.length ? t.storage.map((t, n) => r`${n ? r`<br />` : e}${t.type ?? "disk"} ${t.index + 1}:
              ${t.used_percent === null ? "?" : `${t.used_percent}% used`}${t.available === !1 ? " (not available)" : ""}`) : "none"}
    </dd>
    ${t.cpu_usage === null ? e : r`<dt>CPU</dt>
          <dd>${t.cpu_usage}%</dd>`}
    ${t.capabilities.length ? r`<dt>Host features</dt>
          <dd class="chips">${t.capabilities.map((e) => r`<span class="badge">${e}</span>`)}</dd>` : e}
  </dl>`;
}
function h(e) {
	return e.connection === "wifi" ? e.wifi_signal_dbm === null ? "Wi-Fi" : `Wi-Fi, ${e.wifi_signal_dbm} dBm` : "Ethernet";
}
customElements.get("rv-overview") || customElements.define("rv-overview", f);
//#endregion
export { f as RvOverview, u as SNAPSHOT_REFRESH_MS };

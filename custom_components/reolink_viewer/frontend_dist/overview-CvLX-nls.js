import { Gt as e, Kt as t, Wt as n, _t as r, a as i, i as a, o, qt as s, r as c, rt as l } from "./home-D5-WNgzo.js";
import "./device-list-CErJp_jc.js";
//#region src/components/overview.ts
var u = 3e4, d = {
	people: "person",
	dog_cat: "animal",
	"non-motor_vehicle": "bicycle"
}, f = class extends n {
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
		if (!e) return t``;
		let n = e.node;
		return t`
      ${n.kind === "camera" ? this._renderSnapshot(n) : this._renderCameras()}
      <div class="connections">${e.connections.map((t) => this._renderConnection(t, e))}</div>
    `;
	}
	_renderSnapshot(n) {
		let i = this.snapshotUrl(), a = n.primary_view === "snapshot";
		return t`<figure class="snapshot ${a ? "primary" : ""}">
      <div class="frame">
        ${i ? t`<img src=${i} alt="Latest snapshot of ${n.name ?? "the camera"}" />` : t`<p class="none">
              No snapshot: enable one of this camera's stream entities (for example
              <em>Fluent</em>) in the Settings tab.
            </p>`}
      </div>
      <figcaption>
        <span>Latest snapshot</span>
        <button
          class="text with-icon"
          ?disabled=${!i}
          @click=${() => {
			this._stamp = Date.now();
		}}
        >
          ${r("refresh")}Refresh
        </button>
      </figcaption>
      ${a ? t`<p class="muted small">
            This camera does not record, so snapshots are its main view. The picture refreshes
            every ${u / 1e3} seconds while this page is open.
          </p>` : e}
    </figure>`;
	}
	_renderCameras() {
		let n = this.device?.node;
		if (n?.kind === "camera") return e;
		let r = n?.camera_ids.length ?? 0;
		return t`<section class="card">
      <h2>Cameras</h2>
      ${this.devices && n ? t`<rv-device-list .devices=${this.devices} .cameras=${this.cameras} .hostId=${n.id}></rv-device-list>` : t`<p class="muted">
            ${r} ${r === 1 ? "camera" : "cameras"} on this ${a(n?.kind ?? "nvr")}.
          </p>`}
    </section>`;
	}
	_renderConnection(n, r) {
		let i = n.details, a = r.node.kind === "camera", o = [n.channel !== void 0 && n.channel !== null && n.via === "nvr" ? `channel ${String(n.channel + 1)}` : void 0, n.playback_source ? "playback source" : void 0].filter((e) => e !== void 0);
		return t`<section class="card">
      <div class="header">
        <h2>${a ? c(n) : "Device"}</h2>
        ${o.length ? t`<span class="muted">${o.join(" · ")}</span>` : e}
      </div>
      ${i === null ? t`<p class="muted">
            Details are unavailable${r.degraded ? " in degraded mode" : ""}.
          </p>` : t`
            ${i.channel ? p(i.channel) : e}
            ${n.via === "direct" || !a ? m(i.host) : e}
          `}
      <p class="muted small">
        ${n.entities.length} entities
        (${n.entities.filter((e) => e.disabled_by !== null).length} disabled)
      </p>
    </section>`;
	}
	static styles = [l, s`
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
function p(n) {
	let r = n.online ? n.sleeping ? "Asleep" : "Online" : "Offline";
	return t`<dl class="facts">
    <dt>Model</dt>
    <dd>${n.model}${n.model_id ? t` <span class="muted">(${n.model_id})</span>` : e}</dd>
    <dt>Hardware</dt>
    <dd>${n.hardware_version}</dd>
    <dt>Firmware</dt>
    <dd>${n.firmware_version}</dd>
    <dt>Status</dt>
    <dd>${r}</dd>
    <dt>Clear stream</dt>
    <dd>${i(n.encodings.main)}</dd>
    <dt>Fluent stream</dt>
    <dd>${i(n.encodings.sub)}</dd>
    <dt>Network</dt>
    <dd>${h(n.network)}</dd>
    ${n.battery ? t`<dt>Battery</dt>
          <dd>
            ${n.battery.percent ?? "?"}%${n.battery.status ? ` · ${n.battery.status}` : ""}${n.battery.temperature_c === null ? "" : ` · ${n.battery.temperature_c} °C`}${n.wired_power ? " · on wired power" : ""}
          </dd>` : e}
    <dt>Recordings</dt>
    <dd>${n.supports_replay ? "Playback supported" : "No playback"}</dd>
    ${n.ai_types.length ? t`<dt>AI detection</dt>
          <dd>${n.ai_types.map((e) => d[e] ?? e).join(", ")}</dd>` : e}
    ${n.capabilities.length ? t`<dt>Features</dt>
          <dd class="chips">${n.capabilities.map((e) => t`<span class="badge">${e}</span>`)}</dd>` : e}
  </dl>`;
}
function m(n) {
	let r = n.ports;
	return t`<dl class="facts">
    ${n.device_type === "camera" ? e : t`<dt>Model</dt>
          <dd>${n.model ?? "?"}${n.model_id ? t` <span class="muted">(${n.model_id})</span>` : e}</dd>
          <dt>Hardware</dt>
          <dd>${n.hardware_version ?? "?"}</dd>
          <dt>Firmware</dt>
          <dd>${n.firmware_version ?? "?"}</dd>
          <dt>Channels</dt>
          <dd>${n.channels}</dd>`}
    <dt>Connection</dt>
    <dd>
      ${h(n.network)} · ${r.http.https ? "HTTPS" : "HTTP"}${r.http.port ? ` port ${r.http.port}` : ""}${n.baichuan_only ? " · Baichuan only" : ""}
    </dd>
    <dt>Protocols</dt>
    <dd>
      RTSP ${o(r.rtsp.enabled)}${r.rtsp.port ? ` (${r.rtsp.port})` : ""} · RTMP
      ${o(r.rtmp.enabled)}${r.rtmp.port ? ` (${r.rtmp.port})` : ""} · ONVIF
      ${o(r.onvif.enabled)}${r.onvif.port ? ` (${r.onvif.port})` : ""}
    </dd>
    <dt>HA stream protocol</dt>
    <dd>${n.stream_protocol ?? "?"}</dd>
    <dt>Storage</dt>
    <dd>
      ${n.storage.length ? n.storage.map((n, r) => t`${r ? t`<br />` : e}${n.type ?? "disk"} ${n.index + 1}:
              ${n.used_percent === null ? "?" : `${n.used_percent}% used`}${n.available === !1 ? " (not available)" : ""}`) : "none"}
    </dd>
    ${n.cpu_usage === null ? e : t`<dt>CPU</dt>
          <dd>${n.cpu_usage}%</dd>`}
    ${n.capabilities.length ? t`<dt>Host features</dt>
          <dd class="chips">${n.capabilities.map((e) => t`<span class="badge">${e}</span>`)}</dd>` : e}
  </dl>`;
}
function h(e) {
	return e.connection === "wifi" ? e.wifi_signal_dbm === null ? "Wi-Fi" : `Wi-Fi, ${e.wifi_signal_dbm} dBm` : "Ethernet";
}
customElements.get("rv-overview") || customElements.define("rv-overview", f);
//#endregion
export { f as RvOverview, u as SNAPSHOT_REFRESH_MS };

import { a as e, n as t, r as n, t as r } from "./lit-DdRjbP0M.js";
import { Z as i, j as a, ut as o } from "./live-DVtibn8r.js";
import { I as s, a as c, d as l, i as u, n as d, r as f } from "./home-CuIbfSe_.js";
import "./device-list-DLC6atjT.js";
var p = (e) => `${String(e % 24).padStart(2, "0")}:00`, m = (e) => e.toLocaleString("en-US");
function h(e) {
	let t = s(l(e));
	return t.charAt(0).toUpperCase() + t.slice(1);
}
function g(e) {
	let t = e.reduce((e, t) => e + t.events, 0);
	if (!t) return "Not seen at any hour yet.";
	let n = e.reduce((e, t) => t.events > e.events ? t : e), r = e.filter((e) => e.events === 0).length;
	return `Most often ${p(n.hour)} to ${p(n.hour + 1)} (${m(n.events)} of ${m(t)})${r ? `; never in ${String(r)} of the 24 hours` : ""}.`;
}
var _ = class extends r {
	static properties = {
		hass: { attribute: !1 },
		camera: {},
		_profile: { state: !0 }
	};
	_asked;
	updated(e) {
		(e.has("camera") || e.has("hass")) && this.hass && this.camera && this._asked !== this.camera && (this._asked = this.camera, this._load(this.hass, this.camera));
	}
	willUpdate() {
		this.hidden = !this._profile?.enabled;
	}
	async _load(e, t) {
		try {
			let n = await o(e, t);
			t === this.camera && (this._profile = n);
		} catch {}
	}
	render() {
		let e = this._profile;
		if (!e?.enabled) return t;
		let r = e.kinds ?? [], i = e.known_after ?? 10, a = e.state;
		return n`<section class="card">
      <h2>What it has learned</h2>
      ${e.built ? r.length ? n`<p class="intro">
                ${a?.marking ? "It marks what is unusual for this camera." : a ? `Still learning before it marks: ${y(a)}.` : t}
                What it has seen ${i} times is normal here; whatever it has seen less often can
                still make an event stand out.
              </p>
              ${r.map((e, t) => this._renderKind(e, i, t === 0))}` : n`<p class="muted">Nothing yet: this camera has not detected anything since learning began.</p>` : n`<p class="muted">It is learning from the journal; this shows once it has.</p>`}
    </section>`;
	}
	_renderKind(e, r, a) {
		let o = h(e.kind);
		return n`<details class="kind" ?open=${a}>
      <summary>
        <span class="name">${o}</span>
        <span class="muted">${m(e.events)} seen${e.days >= 1 ? ` in ${String(Math.round(e.days))} days` : ""}</span>
        ${i("chevronDown")}
      </summary>
      <div class="charts">
        ${this._renderHours(e)} ${this._renderDays(e)}
      </div>
      <div class="lists">
        ${this._renderList("How long", e.duration, r)}
        ${this._renderList("What fired first", e.predecessor, r)}
        ${(e.signals ?? []).map((e) => this._renderList(e.label, e.values, r))}
      </div>
      ${e.kind === "motion" ? n`<p class="muted small">Motion is learned from, never marked.</p>` : t}
    </details>`;
	}
	_renderHours(e) {
		let t = Math.max(1, ...e.clock.map((e) => e.events));
		return n`<figure class="hours">
      <figcaption>Time of day</figcaption>
      <div class="bars" role="img" aria-label=${g(e.clock)}>
        ${e.clock.map((e) => n`<span
              class="bar"
              title="${p(e.hour)}–${p(e.hour + 1)}: ${m(e.events)}"
              ><span class="fill" style="height: ${(e.events / t * 100).toFixed(1)}%"></span
            ></span>`)}
      </div>
      <div class="axis" aria-hidden="true">
        <span>00</span><span>06</span><span>12</span><span>18</span><span>24</span>
      </div>
    </figure>`;
	}
	_renderDays(e) {
		let t = Math.max(1, ...e.day_of_week.map((e) => e.events)), r = e.day_of_week.map((e) => `${e.label} ${m(e.events)}`).join(", ");
		return n`<figure class="days">
      <figcaption>Day of the week</figcaption>
      <div class="bars" role="img" aria-label=${r}>
        ${e.day_of_week.map((e) => n`<span class="bar" title="${e.label}: ${m(e.events)}"
              ><span class="fill" style="height: ${(e.events / t * 100).toFixed(1)}%"></span
            ></span>`)}
      </div>
      <div class="axis" aria-hidden="true">${e.day_of_week.map((e) => n`<span>${e.label.charAt(0)}</span>`)}</div>
    </figure>`;
	}
	_renderList(e, r, i) {
		let a = r.slice(0, 5), o = r.slice(5), s = o.reduce((e, t) => e + t.share, 0);
		return n`<div class="list">
      <h3>${e}</h3>
      ${a.length ? n`<ul>
            ${a.map((e) => n`<li>
                  <span class="label"
                    >${e.label}${e.events < i ? n` <span class="badge">Can stand out</span>` : t}</span
                  >
                  <span class="share">${v(e.share)}</span>
                  <span class="meter" aria-hidden="true"
                    ><span class="fill" style="width: ${(e.share * 100).toFixed(1)}%"></span
                  ></span>
                </li>`)}
          </ul>` : n`<p class="muted">Nothing yet.</p>`}
      ${o.length ? n`<p class="muted small">
            And ${o.length} more, ${v(s)} between them.
          </p>` : t}
    </div>`;
	}
	static styles = [a, e`
      :host {
        display: block;
        container-type: inline-size;
      }
      :host([hidden]) {
        display: none;
      }
      h2 {
        margin: 0 0 6px;
      }
      .intro {
        margin: 0 0 12px;
        max-width: 72ch;
      }
      .kind {
        border-top: 1px solid var(--rv-rule);
      }
      .kind > summary {
        display: flex;
        align-items: center;
        gap: 10px;
        min-height: 44px;
        padding: 10px 0;
        cursor: pointer;
      }
      .kind > summary .name {
        font-size: 17px;
        font-weight: 500;
      }
      .kind > summary svg {
        width: 18px;
        height: 18px;
        margin-left: auto;
      }
      .charts {
        display: grid;
        grid-template-columns: minmax(0, 3fr) minmax(0, 1fr);
        gap: 24px;
        margin-bottom: 14px;
      }
      figure {
        margin: 0;
      }
      figcaption,
      .list h3 {
        margin: 0 0 6px;
        color: var(--rv-muted);
        font-size: 14px;
        font-weight: 500;
      }
      .bars {
        display: grid;
        grid-auto-flow: column;
        grid-auto-columns: minmax(0, 1fr);
        gap: 2px;
        align-items: end;
        height: 72px;
        border-bottom: 1px solid var(--rv-rule-strong);
      }
      .bar {
        position: relative;
        height: 100%;
        display: flex;
        align-items: flex-end;
      }
      .bar .fill {
        width: 100%;
        min-height: 0;
        background: var(--rv-text);
        border-radius: 3px 3px 0 0;
      }
      .axis {
        display: flex;
        justify-content: space-between;
        margin-top: 4px;
        color: var(--rv-muted);
        font-size: 12px;
        font-variant-numeric: tabular-nums;
      }
      .days .axis {
        display: grid;
        grid-auto-flow: column;
        grid-auto-columns: minmax(0, 1fr);
        gap: 2px;
        text-align: center;
      }
      .lists {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 24px;
        padding-bottom: 14px;
      }
      ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        grid-template-columns: minmax(0, 1fr) max-content minmax(60px, 120px);
        column-gap: 10px;
        row-gap: 6px;
        align-items: center;
        font-size: 14px;
      }
      li {
        display: contents;
      }
      .label {
        overflow-wrap: anywhere;
      }
      .share {
        font-variant-numeric: tabular-nums;
        text-align: right;
      }
      .meter {
        height: 8px;
        background: var(--rv-rule);
        border-radius: 4px;
        overflow: hidden;
      }
      .meter .fill {
        display: block;
        height: 100%;
        background: var(--rv-text);
        border-radius: 0 4px 4px 0;
      }
      .badge {
        font-size: 12px;
        white-space: nowrap;
      }
      .list p {
        margin: 6px 0 0;
      }
      @container (max-width: 640px) {
        .charts,
        .lists {
          grid-template-columns: minmax(0, 1fr);
          gap: 16px;
        }
        .days {
          max-width: 240px;
        }
        .days .bars {
          height: 48px;
        }
      }
    `];
};
function v(e) {
	let t = e * 100;
	return t > 0 && t < 1 ? "<1%" : `${String(Math.round(t))}%`;
}
function y(e) {
	return [e.needs_days ? `${String(e.needs_days)} more ${e.needs_days === 1 ? "day" : "days"}` : "", e.needs_events ? `${m(e.needs_events)} more detections` : ""].filter(Boolean).join(" and ") || "a little longer";
}
customElements.get("rv-learned") || customElements.define("rv-learned", _);
//#endregion
//#region src/components/overview.ts
var b = 3e4, x = {
	people: "person",
	dog_cat: "animal",
	"non-motor_vehicle": "bicycle"
}, S = class extends r {
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
		}, b));
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
		let r = e.node;
		return n`
      ${r.kind === "camera" ? this._renderSnapshot(r) : this._renderCameras()}
      ${r.kind === "camera" ? n`<rv-learned .hass=${this.hass} .camera=${r.id}></rv-learned>` : t}
      <div class="connections">${e.connections.map((t) => this._renderConnection(t, e))}</div>
    `;
	}
	_renderSnapshot(e) {
		let r = this.snapshotUrl(), a = e.primary_view === "snapshot";
		return n`<figure class="snapshot ${a ? "primary" : ""}">
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
          ${i("refresh")}Refresh
        </button>
      </figcaption>
      ${a ? n`<p class="muted small">
            This camera does not record, so snapshots are its main view. The picture refreshes
            every ${b / 1e3} seconds while this page is open.
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
            ${r} ${r === 1 ? "camera" : "cameras"} on this ${f(e?.kind ?? "nvr")}.
          </p>`}
    </section>`;
	}
	_renderConnection(e, r) {
		let i = e.details, a = r.node.kind === "camera", o = [e.channel !== void 0 && e.channel !== null && e.via === "nvr" ? `channel ${String(e.channel + 1)}` : void 0, e.playback_source ? "playback source" : void 0].filter((e) => e !== void 0);
		return n`<section class="card">
      <div class="header">
        <h2>${a ? d(e) : "Device"}</h2>
        ${o.length ? n`<span class="muted">${o.join(" · ")}</span>` : t}
      </div>
      ${i === null ? n`<p class="muted">
            ${r.degraded ? "Details are unavailable while Reolink Viewer cannot reach the Reolink integration." : "Details are unavailable."}
          </p>` : n`
            ${e.via === "direct" || !a ? E(i.host) : t}
            ${i.channel ? C(i.channel) : t}
            ${e.via === "direct" || !a ? w(i.host) : t}
          `}
      <p class="muted small">
        ${e.entities.length} entities
        (${e.entities.filter((e) => e.disabled_by !== null).length} disabled)
      </p>
    </section>`;
	}
	static styles = [a, e`
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
function C(e) {
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
    <dd>${u(e.encodings.main)}</dd>
    <dt>Fluent stream</dt>
    <dd>${u(e.encodings.sub)}</dd>
    <dt>Network</dt>
    <dd>${D(e.network)}</dd>
    ${e.battery ? n`<dt>Battery</dt>
          <dd>
            ${e.battery.percent ?? "?"}%${e.battery.status ? ` · ${e.battery.status}` : ""}${e.battery.temperature_c === null ? "" : ` · ${e.battery.temperature_c} °C`}${e.wired_power ? " · on wired power" : ""}
          </dd>` : t}
    <dt>Recordings</dt>
    <dd>${e.supports_replay ? "Playback supported" : "No playback"}</dd>
    ${e.ai_types.length ? n`<dt>AI detection</dt>
          <dd>${e.ai_types.map((e) => x[e] ?? e).join(", ")}</dd>` : t}
    ${e.capabilities.length ? n`<dt>Features</dt>
          <dd class="chips">${e.capabilities.map((e) => n`<span class="badge">${e}</span>`)}</dd>` : t}
  </dl>`;
}
function w(e) {
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
      ${D(e.network)} · ${r.http.https ? "HTTPS" : "HTTP"}${r.http.port ? ` port ${r.http.port}` : ""}${e.baichuan_only ? " · Baichuan only" : ""}
    </dd>
    <dt>Protocols</dt>
    <dd>
      RTSP ${c(r.rtsp.enabled)}${r.rtsp.port ? ` (${r.rtsp.port})` : ""} · RTMP
      ${c(r.rtmp.enabled)}${r.rtmp.port ? ` (${r.rtmp.port})` : ""} · ONVIF
      ${c(r.onvif.enabled)}${r.onvif.port ? ` (${r.onvif.port})` : ""}
    </dd>
    <dt>HA stream protocol</dt>
    <dd>${e.stream_protocol ?? "?"}</dd>
    <dt>Storage</dt>
    <dd>
      ${e.storage.length ? e.storage.map((t) => n`<span class="storage ${t.available === !1 ? "fault" : ""}"
              >${T(t, e.storage.length)}:
              ${t.available === !1 ? "not ready (not formatted, or failed)" : t.used_percent === null ? "in use" : `${String(t.used_percent)}% used`}</span
            >`) : e.device_type === "camera" ? "None: no SD card, so it keeps no recordings of its own" : "None: no hard disk, so it keeps no recordings"}
    </dd>
    ${e.cpu_usage === null ? t : n`<dt>CPU</dt>
          <dd>${e.cpu_usage}%</dd>`}
    ${e.capabilities.length ? n`<dt>Host features</dt>
          <dd class="chips">${e.capabilities.map((e) => n`<span class="badge">${e}</span>`)}</dd>` : t}
  </dl>`;
}
function T(e, t) {
	let n = e.type?.toUpperCase(), r = n === "SD" ? "SD card" : n === "HDD" ? "Hard disk" : "Disk";
	return t > 1 ? `${r} ${String(e.index + 1)}` : r;
}
function E(e) {
	let r = e.storage.filter((e) => e.available === !1);
	if (!r.length) return t;
	let i = r.map((t) => T(t, e.storage.length)).join(" and ");
	return n`<div class="banner warning" role="status">
    <strong>${i} ${r.length === 1 ? "is" : "are"} not ready</strong>: not formatted, or failed, so
    recordings may not be kept. Format ${r.length === 1 ? "it" : "them"} in the Reolink app, or replace
    ${r.length === 1 ? "it" : "them"}.
  </div>`;
}
function D(e) {
	return e.connection === "wifi" ? e.wifi_signal_dbm === null ? "Wi-Fi" : `Wi-Fi, ${e.wifi_signal_dbm} dBm` : "Ethernet";
}
customElements.get("rv-overview") || customElements.define("rv-overview", S);
//#endregion
export { S as RvOverview, b as SNAPSHOT_REFRESH_MS };

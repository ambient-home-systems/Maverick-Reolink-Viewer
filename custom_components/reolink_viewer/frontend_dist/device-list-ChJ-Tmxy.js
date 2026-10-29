import { F as e, Jt as t, Xt as n, Yt as r, bt as i, i as a, it as o, qt as s } from "./home-BVFyq3Vg.js";
//#region src/components/device-list.ts
var c = class extends s {
	static properties = {
		devices: { attribute: !1 },
		cameras: { attribute: !1 },
		hostId: { attribute: !1 }
	};
	constructor() {
		super(), this.cameras = [];
	}
	render() {
		let e = this.devices;
		if (!e) return r`<p class="muted">Loading devices…</p>`;
		if (!e.hosts.length && !e.cameras.length) return r`<section class="card">
        <h2>No Reolink devices</h2>
        <p class="muted">
          Set up your cameras, NVRs or Home Hubs in the Reolink integration first; they appear
          here once loaded.
        </p>
      </section>`;
		let n = new Map(e.cameras.map((e) => [e.id, e]));
		if (this.hostId !== void 0) {
			let t = e.hosts.find((e) => e.id === this.hostId);
			return t ? this._renderCameras(t, n) : r``;
		}
		let i = e.cameras.filter((e) => e.host_id === null);
		return r`
      ${e.hosts.map((e) => this._renderHost(e, n))}
      ${i.length ? r`<section class="card">
            <div class="head"><h2>Cameras added directly</h2></div>
            ${this._renderTable(i.map((e) => this._renderCamera(e)))}
          </section>` : t}
    `;
	}
	_renderHost(t, n) {
		let i = a(t.kind);
		return r`<section class="card">
      <div class="head">
        <h2>
          <button class="link host" @click=${() => {
			e(this, {
				view: "device",
				id: t.id,
				tab: "overview"
			});
		}}>${t.name ?? t.entry_title}</button>
        </h2>
        <p class="muted">
          ${[
			i,
			t.model,
			t.sw_version && `firmware ${t.sw_version}`
		].filter(Boolean).join(" · ")}
        </p>
      </div>
      ${this._renderCameras(t, n)}
    </section>`;
	}
	_renderCameras(e, t) {
		let n = e.camera_ids.map((e) => t.get(e)).filter((e) => e !== void 0);
		return n.length ? this._renderTable(n.map((t) => this._renderCamera(t, e))) : r`<p class="muted">No cameras on this ${a(e.kind)}.</p>`;
	}
	_renderTable(e) {
		return r`<div class="cols" aria-hidden="true">
        <span></span><span>Camera</span><span>Channel</span><span class="model">Model</span><span>State</span><span></span>
      </div>
      <ul class="devices">
        ${e}
      </ul>`;
	}
	_renderCamera(n, a) {
		let o = a ? n.connections.find((e) => e.host_id === a.id)?.channel : void 0, s = a !== void 0 && n.connections.some((e) => e.via === "direct"), c = this.cameras.find((e) => e.id === n.id)?.number, u = [s ? "Also added directly" : void 0, n.primary_view === "snapshot" ? "Snapshots only" : void 0].filter((e) => e !== void 0);
		return r`<li>
      <button
        class="row"
        @click=${() => {
			e(this, {
				view: "device",
				id: n.id,
				tab: "overview"
			});
		}}
      >
        <span class="plat-cell">${c === void 0 ? t : r`<span class="plat" aria-hidden="true">${c}</span>`}</span>
        <span class="name">${n.name ?? "Camera"}</span>
        <span class="ch muted">${o == null ? "Direct" : `Ch ${String(o + 1)}`}</span>
        <span class="model muted">${n.model ?? ""}</span>
        <span class="state">${l(n)}${u.length ? r`<span class="flags muted">${u.join(" · ")}</span>` : t}</span>
        ${i("chevron")}
      </button>
    </li>`;
	}
	static styles = [o, n`
      :host {
        display: flex;
        flex-direction: column;
        gap: 28px;
        container-type: inline-size;
      }
      .head {
        display: flex;
        align-items: baseline;
        flex-wrap: wrap;
        gap: 4px 14px;
        margin-bottom: 10px;
      }
      .head h2 {
        margin: 0;
      }
      .head p {
        margin: 0;
        font-size: 15px;
      }
      .host {
        font: inherit;
      }
      .cols,
      .row {
        display: grid;
        grid-template-columns: 34px minmax(0, 2fr) 72px minmax(0, 1.2fr) minmax(0, 1.6fr) 20px;
        column-gap: 14px;
        align-items: center;
      }
      .cols {
        padding: 0 4px 6px;
        border-bottom: 1px solid var(--rv-rule-strong);
        color: var(--rv-muted);
        font-size: 13px;
        font-weight: 500;
      }
      ul.devices {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      li {
        border-bottom: 1px solid var(--rv-rule);
      }
      .row {
        width: 100%;
        min-height: 52px;
        padding: 6px 4px;
        border: none;
        border-radius: 0;
        background: transparent;
        color: inherit;
        text-align: left;
        font-weight: 400;
      }
      .row:focus-visible {
        outline-offset: -2px;
      }
      .plat {
        width: max-content;
        min-width: 26px;
        height: 26px;
        padding: 0 4px;
        box-sizing: border-box;
        display: grid;
        place-items: center;
        background: var(--rv-platform);
        color: var(--rv-on-rail);
        font-family: var(--rv-font-cond);
        font-size: 16px;
        font-weight: 600;
        line-height: 1;
      }
      .name {
        font-size: 17px;
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .row .ch,
      .row .model {
        font-size: 15px;
      }
      .state {
        display: flex;
        flex-direction: column;
        font-size: 15px;
      }
      .offline {
        color: var(--rv-fault-ink);
        font-weight: 600;
      }
      .flags {
        font-size: 13px;
      }
      .row svg {
        width: 18px;
        height: 18px;
        color: var(--rv-muted);
      }
      @container (max-width: 640px) {
        .cols {
          display: none;
        }
        .row {
          grid-template-columns: 30px minmax(0, 1fr) auto 18px;
        }
        .model {
          display: none;
        }
        .plat-cell {
          grid-row: 1 / span 2;
        }
        .name {
          grid-column: 2;
          grid-row: 1;
        }
        .ch {
          grid-column: 2;
          grid-row: 2;
          font-size: 14px;
        }
        .state {
          grid-column: 3;
          grid-row: 1 / span 2;
          text-align: right;
        }
        .row svg {
          grid-column: 4;
          grid-row: 1 / span 2;
        }
      }
    `];
};
function l(e) {
	let n = e.status;
	return n.online === !1 ? r`<span class="offline">Offline</span>` : n.sleeping ? r`<span>Asleep</span>` : n.online ? r`<span>Online</span>` : t;
}
customElements.get("rv-device-list") || customElements.define("rv-device-list", c);
//#endregion
export { c as RvDeviceList };

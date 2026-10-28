import { Gt as e, Ht as t, I as n, K as r, Kt as i, L as a, Tt as o, Wt as s, _t as c, kt as l, pt as u, qt as d, rt as f, st as p } from "./home-D5-WNgzo.js";
import { i as m, m as h, v as g } from "./findings-CjZkQ2Pp.js";
import { n as _, r as v } from "./check-B7M3bovy.js";
import { r as y } from "./check-O1kqbi0u.js";
//#region src/types.ts
var b = [
	"sub",
	"main",
	"ext"
], x = "reolink-viewer-live-check-setup", S = {
	sub: "Low (the live board)",
	ext: "Medium",
	main: "High (full screen)"
};
function C(e) {
	return !/Tailscale|Nabu Casa/.test(e);
}
var w = class extends s {
	static properties = {
		hass: { attribute: !1 },
		_status: { state: !0 },
		_cameras: { state: !0 },
		_setup: { state: !0 },
		_streams: { state: !0 },
		_warm: { state: !0 },
		_stock: { state: !0 },
		_capacity: { state: !0 },
		_camera: { state: !0 },
		_check: { state: !0 },
		_checkText: { state: !0 },
		_checkStatus: { state: !0 },
		_reports: { state: !0 },
		_error: { state: !0 },
		_copied: { state: !0 },
		_shown: { state: !0 }
	};
	_loaded = !1;
	constructor() {
		super(), this._setup = T(), this._streams = [...b], this._warm = !0, this._stock = !0, this._capacity = !0, this._camera = "", this._checkText = "", this._checkStatus = "";
	}
	disconnectedCallback() {
		super.disconnectedCallback(), this._check?.stop();
	}
	updated() {
		this.hass && !this._loaded && (this._loaded = !0, this._load());
	}
	async _load() {
		let e = this.hass;
		if (e) {
			try {
				let [t, n] = await Promise.all([l(e), o(e)]);
				this._status = t, this._cameras = n.cameras;
			} catch (e) {
				this._error = t(e).message;
			}
			this._loadReports();
		}
	}
	async _loadReports() {
		if (this.hass) try {
			let { reports: e } = await y(this.hass);
			this._reports = e.filter((e) => e.setup.startsWith(p));
		} catch {
			this._reports = [];
		}
	}
	get _admin() {
		return this.hass?.user?.is_admin === !0;
	}
	async runCheck(e) {
		let t = this.hass, n = this.renderRoot.querySelector(".stage");
		if (!t || !n) throw Error("the page is not ready");
		if (this._check?.running) throw Error("a check is running");
		let r = new v(t, {
			setup: e.setup,
			streams: e.streams ?? this._streams,
			warm: e.warm ?? this._warm,
			stock: e.stock ?? this._stock,
			capacity: e.capacity ?? (this._capacity && C(e.setup)),
			cameraIds: e.cameraIds ?? (this._camera ? [this._camera] : [])
		}, n, () => {
			this._checkText = r.text, this._checkStatus = r.plainStatus;
		});
		this._check = r, this._copied = void 0;
		try {
			return await r.run();
		} finally {
			this._checkStatus = "", this._loadReports(), this._refreshStatus();
		}
	}
	async _refreshStatus() {
		this.hass && (this._status = await l(this.hass).catch(() => this._status));
	}
	async _copy(e, t) {
		await a(e) ? this._copied = t : (this._copied = void 0, this._shown = t, n(this, "Copying is blocked here: select the text instead, or copy it from Saved reports on a computer", "error"));
	}
	render() {
		let n = this._check?.running === !0;
		return i`<p class="intro">
        How quickly each camera's live video starts on this device. The check plays each camera in turn
        for a few seconds, so it takes a few minutes: keep this page open and in front. It only watches;
        it changes no camera setting.
      </p>
      <p class="muted">
        Run it on each device you use, at home and away, and compare. Each run is saved, so you can read
        it later on any device.
      </p>
      ${this._renderStatus()}
      <div class="form">
        <span class="label" id="setup">This device and network</span>
        <div class="field">
          <select
            aria-labelledby="setup"
            .value=${this._setup}
            ?disabled=${n}
            @change=${(e) => {
			this._setup = e.target.value, E(this._setup);
		}}
          >
            ${_.map((e) => i`<option value=${e} ?selected=${e === this._setup}>${e}</option>`)}
          </select>
        </div>
        <span class="label" id="cameras">Cameras</span>
        <div class="field">
          <select
            aria-labelledby="cameras"
            ?disabled=${n}
            @change=${(e) => {
			this._camera = e.target.value;
		}}
          >
            <option value="">All cameras</option>
            ${(this._cameras ?? []).map((e) => i`<option value=${e.id} ?selected=${e.id === this._camera}>${e.name}</option>`)}
          </select>
        </div>
        <span class="label">Video quality</span>
        <div class="field" role="group" aria-label="Video quality">
          ${b.map((e) => i`<label class="option"
              ><input
                type="checkbox"
                .checked=${this._streams.includes(e)}
                ?disabled=${n}
                @change=${(t) => {
			let n = t.target.checked;
			this._streams = b.filter((t) => t === e ? n : this._streams.includes(t));
		}}
              />${S[e]}</label
            >`)}
        </div>
        <span class="label">Also</span>
        <div class="field stack">
          <label class="option"
            ><input
              type="checkbox"
              .checked=${this._stock}
              ?disabled=${n}
              @change=${(e) => {
			this._stock = e.target.checked;
		}}
            />Compare with Home Assistant's own camera view</label
          >
          ${this._admin ? i`<label class="option"
                  ><input
                    type="checkbox"
                    .checked=${this._warm}
                    ?disabled=${n}
                    @change=${(e) => {
			this._warm = e.target.checked;
		}}
                  />Kept warm too: how fast cameras start when their connection is kept open</label
                >
                <label class="option"
                  ><input
                    type="checkbox"
                    .checked=${this._capacity}
                    ?disabled=${n}
                    @change=${(e) => {
			this._capacity = e.target.checked;
		}}
                  />NVR capacity test: how many streams each NVR serves at once (at home only)</label
                >` : e}
        </div>
      </div>
      ${g(this._setup, navigator.userAgent) ? i`<div class="banner warning" role="alert">
            “${this._setup}” is for another kind of device: pick the one for this device, so the report is
            filed under it.
          </div>` : e}
      <div class="actions run">
        ${n ? i`<button @click=${() => this._check?.stop()}>Stop</button>` : i`<button
              class="primary"
              ?disabled=${!this._streams.length || !this._cameras}
              @click=${() => {
			this.runCheck({ setup: this._setup }).catch((e) => {
				this._error = t(e).message;
			});
		}}
            >
              ${this._check ? "Run it again" : "Run live check"}
            </button>`}
      </div>
      ${n && this._checkStatus ? i`<p class="progress" aria-live="polite">${this._checkStatus}…</p>` : e}
      ${this._error ? i`<div class="banner error" role="alert">${this._error}</div>` : e}
      <div class="stage" ?hidden=${!n} aria-label="Live video being measured"></div>
      ${this._check ? i`<rv-findings class="result" .summary=${this._check.inShort()}></rv-findings>` : e}
      ${this._checkText ? i`<details class="support">
            <summary>Details for support${c("chevronDown")}</summary>
            <p class="muted small">Every measurement, for a bug report or to compare devices.</p>
            <div class="actions">
              <button @click=${() => void this._copy(this._checkText, "current")}>
                ${this._copied === "current" ? "Copied" : "Copy report"}
              </button>
            </div>
            <pre class="report">${this._checkText}</pre>
          </details>` : e}
      ${this._renderReports()}`;
	}
	_renderStatus() {
		let t = this._status;
		if (!t) return e;
		let n = t.go2rtc;
		return i`<p class="small service">
        <span class="muted">Video service (go2rtc):</span>
        ${n.state}${n.version ? `, version ${n.version}` : ""}${n.error ? i` · <span class="error">${n.error}</span>` : e}
        ${n.state === "stopped" ? i`<span class="muted">(it starts with the first live video)</span>` : e}
      </p>
      ${n.log?.length ? i`<details>
            <summary class="small">Its log${c("chevronDown")}</summary>
            <pre class="report">${n.log.join("\n")}</pre>
          </details>` : e}`;
	}
	_renderReports() {
		let t = this._reports;
		return t?.length ? i`<details class="saved">
      <summary>Saved reports (${t.length})${c("chevronDown")}</summary>
      <ul class="reports">
        ${t.map((t) => i`<li>
            <div class="report-row">
              <span class="when"
                >${[
			r(Date.parse(t.updated), this.hass?.config?.time_zone),
			t.setup.slice(p.length),
			u(t.text)
		].filter(Boolean).join(" · ")}${t.done ? "" : " (not finished)"}</span
              >
              <button class="text" @click=${() => void this._copy(t.text, t.id)}>
                ${this._copied === t.id ? "Copied" : "Copy"}
              </button>
              <button
                class="text"
                aria-expanded=${this._shown === t.id ? "true" : "false"}
                @click=${() => {
			this._shown = this._shown === t.id ? void 0 : t.id;
		}}
              >
                ${this._shown === t.id ? "Hide" : "Show"}
              </button>
            </div>
            ${this._shown === t.id ? this._renderSaved(t.text) : e}
          </li>`)}
      </ul>
    </details>` : e;
	}
	_renderSaved(e) {
		let t = m(e);
		return t ? i`<rv-findings .summary=${t}></rv-findings>
      <details>
        <summary class="small">Details for support${c("chevronDown")}</summary>
        <pre class="report">${e}</pre>
      </details>` : i`<pre class="report">${e}</pre>`;
	}
	static styles = [f, d`
      :host {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      p {
        margin: 0;
      }
      .intro {
        font-size: 17px;
      }
      .service {
        display: flex;
        flex-wrap: wrap;
        gap: 0 6px;
      }
      .run {
        margin-top: 4px;
      }
      .progress {
        font-family: var(--rv-font-cond);
        font-size: 19px;
        font-weight: 600;
      }
      .stage[hidden] {
        display: none;
      }
      .stage {
        width: 100%;
        max-width: 480px;
        aspect-ratio: 16 / 9;
        background: var(--rv-board);
        overflow: hidden;
      }
      .stage video {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
      .result {
        margin-top: 6px;
      }
      details.support,
      details.saved {
        border-top: 2px solid var(--rv-rule-strong);
        padding-top: 6px;
      }
      details > p,
      details > .actions {
        margin: 6px 0 10px;
      }
      .reports {
        list-style: none;
        margin: 6px 0 0;
        padding: 0;
      }
      .reports li {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 6px 0;
        border-bottom: 1px solid var(--rv-rule);
      }
      .report-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px 12px;
      }
      .when {
        flex: 1;
        min-width: 14em;
        font-size: 15px;
      }
      .error {
        color: var(--rv-fault-ink);
        font-weight: 600;
      }
    `];
};
function T() {
	try {
		let e = window.localStorage.getItem(x);
		if (e && _.includes(e)) return e;
	} catch {}
	return h(navigator.userAgent);
}
function E(e) {
	try {
		window.localStorage.setItem(x, e);
	} catch {}
}
customElements.get("rv-live-check") || customElements.define("rv-live-check", w);
//#endregion
export { w as RvLiveCheck, C as capacityByDefault };

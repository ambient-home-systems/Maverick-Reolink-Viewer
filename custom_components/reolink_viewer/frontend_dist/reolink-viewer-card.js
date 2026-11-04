import { a as e, n as t, r as n, t as r } from "./lit-DdRjbP0M.js";
import { a as i, i as a, n as o, o as s, r as c, t as l } from "./config-D80frQMF.js";
//#region src/card/index.ts
var u;
function d() {
	return u ??= import("./camera-card-e8bFzZIY.js").catch((e) => {
		throw u = void 0, e;
	}), u;
}
var f = class extends r {
	static properties = {
		hass: { attribute: !1 },
		_config: { state: !0 },
		_loadError: { state: !0 }
	};
	setConfig(e) {
		this._config = i(e);
	}
	getCardSize() {
		return s(this._config?.camera);
	}
	getGridOptions() {
		return a;
	}
	static async getConfigElement() {
		return await import("./editor-B5CCAi1X.js"), document.createElement(c);
	}
	static async getStubConfig(e) {
		try {
			let { cameras: t } = await e.callWS({ type: "reolink_viewer/live/cameras" });
			return t[0] ? { camera: t[0].id } : {};
		} catch {
			return {};
		}
	}
	connectedCallback() {
		super.connectedCallback(), this._load();
	}
	_load() {
		this._loadError = void 0, d().catch((e) => {
			this._loadError = e instanceof Error ? e.message : String(e);
		});
	}
	render() {
		return this._config ? this._loadError ? n`<div class="error" role="alert">
        Could not load the camera card: ${this._loadError}
        <button
          @click=${() => {
			this._load();
		}}
        >
          Try again
        </button>
      </div>` : n`<rv-camera-card .hass=${this.hass} .config=${this._config}></rv-camera-card>` : t;
	}
	static styles = e`
    :host {
      display: block;
      height: 100%;
    }
    rv-camera-card {
      display: block;
      height: 100%;
    }
    .error {
      padding: 16px;
      color: var(--primary-text-color);
      background: var(--card-background-color, #fff);
    }
  `;
};
customElements.get("reolink-viewer-camera") || (customElements.define(o, f), window.customCards ??= [], window.customCards.push({
	type: o,
	name: "Reolink camera",
	description: "One camera live, as fast as the Reolink panel shows it: its last picture at once, then video.",
	preview: !1,
	documentationURL: l
}));
//#endregion
export { f as ReolinkViewerCameraCard };

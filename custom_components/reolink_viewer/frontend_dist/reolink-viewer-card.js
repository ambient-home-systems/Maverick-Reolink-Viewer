import { a as e, n as t, r as n, t as r } from "./lit-DdRjbP0M.js";
import { a as i, i as a, n as o, o as s, r as c, t as l } from "./config-D80frQMF.js";
import { i as u, n as d, o as f, r as p, t as m } from "./wall-config-CRjQhRDF.js";
//#region src/card/index.ts
var h;
function g() {
	return h ??= import("./camera-card-CnLBIFgO.js").catch((e) => {
		throw h = void 0, e;
	}), h;
}
var _ = class extends r {
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
		return await import("./editor-COlDPCVb.js"), document.createElement(c);
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
		this._loadError = void 0, g().catch((e) => {
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
}, v;
function y() {
	return v ??= import("./wall-card-KyjVr5KW.js").catch((e) => {
		throw v = void 0, e;
	}), v;
}
var b = class extends r {
	static properties = {
		hass: { attribute: !1 },
		_config: { state: !0 },
		_loadError: { state: !0 }
	};
	setConfig(e) {
		this._config = f(e);
	}
	getCardSize() {
		return 6;
	}
	getGridOptions() {
		return u;
	}
	static async getConfigElement() {
		return await import("./wall-editor-CvvXFSym.js"), document.createElement(p);
	}
	static getStubConfig() {
		return {};
	}
	connectedCallback() {
		super.connectedCallback(), this._load();
	}
	_load() {
		this._loadError = void 0, y().catch((e) => {
			this._loadError = e instanceof Error ? e.message : String(e);
		});
	}
	render() {
		return this._config ? this._loadError ? n`<div class="error" role="alert">
        Could not load the Wall card: ${this._loadError}
        <button
          @click=${() => {
			this._load();
		}}
        >
          Try again
        </button>
      </div>` : n`<rv-wall-card .hass=${this.hass} .config=${this._config}></rv-wall-card>` : t;
	}
	static styles = e`
    :host {
      display: block;
      height: 100%;
    }
    rv-wall-card {
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
customElements.get("reolink-viewer-camera") || (customElements.define(o, _), window.customCards ??= [], window.customCards.push({
	type: o,
	name: "Reolink camera",
	description: "One camera live, as fast as the Reolink panel shows it: its last picture at once, then video.",
	preview: !1,
	documentationURL: l
})), customElements.get("reolink-viewer-wall") || (customElements.define(d, b), window.customCards ??= [], window.customCards.push({
	type: d,
	name: "Reolink Wall",
	description: "A saved layout of the Reolink panel's Wall: the cameras' video, the latest detections, a tour.",
	preview: !1,
	documentationURL: m
}));
//#endregion
export { _ as ReolinkViewerCameraCard, b as ReolinkViewerWallCard };

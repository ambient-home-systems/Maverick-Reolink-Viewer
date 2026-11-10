import { a as e, r as t, t as n } from "./lit-DdRjbP0M.js";
import { A as r, t as i } from "./live-D6mEGytR.js";
import { K as a } from "./home-JfWrSIyA.js";
import { n as o } from "./panel-C_Oja-Tm.js";
import "./wall-m9M6mwIx.js";
//#region src/card/wall-card.ts
var s = class extends n {
	static properties = {
		hass: { attribute: !1 },
		config: { attribute: !1 }
	};
	connectedCallback() {
		super.connectedCallback(), i(import.meta.url);
	}
	render() {
		return t`<ha-card>
      <div class="frame">
        <rv-wall
        card
        .hass=${this.hass}
        .layoutId=${this.config?.layout}
        .showBar=${this.config?.show_bar ?? !0}
        @rv-navigate=${(e) => {
			e.stopPropagation(), o(a(e.detail));
		}}
        ></rv-wall>
      </div>
    </ha-card>`;
	}
	static styles = [r, e`
      :host {
        display: block;
        height: 100%;
      }
      ha-card {
        display: block;
        height: 100%;
        overflow: hidden;
      }
      /* 16:9, unless the dashboard sets the card's height (a sections view);
         the Wall inside never sizes the card (its strip scrolls sideways). */
      .frame {
        position: relative;
        width: 100%;
        height: 100%;
        min-height: 240px;
        aspect-ratio: 16 / 9;
      }
      rv-wall {
        position: absolute;
        inset: 0;
        height: auto;
      }
    `];
};
customElements.get("rv-wall-card") || customElements.define("rv-wall-card", s);
//#endregion
export { s as RvWallCard };

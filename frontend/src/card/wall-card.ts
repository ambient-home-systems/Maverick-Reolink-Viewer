// The Wall's dashboard card's body (custom:reolink-viewer-wall, see
// ./index.ts, Phase 9 step 5): the panel's Wall showing a saved layout, as the
// panel shows it but for its bar (a short one, or none) and its editing (done
// in the panel). Fetched the first time a Wall card is shown. A tap that
// opens something (a detection's recording) opens it in the panel.
import { LitElement, css, html, type TemplateResult } from "lit";

import type { Route } from "../components/navigation";
import { routeToHash } from "../components/navigation";
import "../components/wall";
import { loadFonts } from "../fonts";
import { rvTokens } from "../styles";
import type { HomeAssistant } from "../types";
import { openPanel } from "./panel";
import type { WallCardConfig } from "./wall-config";

export class RvWallCard extends LitElement {
  static override properties = {
    hass: { attribute: false },
    config: { attribute: false },
  };

  declare hass: HomeAssistant | undefined;
  declare config: WallCardConfig | undefined;

  override connectedCallback(): void {
    super.connectedCallback();
    loadFonts(import.meta.url);
  }

  protected override render(): TemplateResult {
    return html`<ha-card>
      <div class="frame">
        <rv-wall
        card
        .hass=${this.hass}
        .layoutId=${this.config?.layout}
        .showBar=${this.config?.show_bar ?? true}
        @rv-navigate=${(e: CustomEvent<Route>) => {
          e.stopPropagation();
          openPanel(routeToHash(e.detail));
        }}
        ></rv-wall>
      </div>
    </ha-card>`;
  }

  static override styles = [
    rvTokens,
    css`
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
    `,
  ];
}

if (!customElements.get("rv-wall-card")) {
  customElements.define("rv-wall-card", RvWallCard);
}

declare global {
  interface HTMLElementTagNameMap {
    "rv-wall-card": RvWallCard;
  }
}

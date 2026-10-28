import { LitElement, css, html, type TemplateResult } from "lit";

import { fetchLiveState, toError } from "../api";
import { copyText } from "../clipboard";
import { debugText, type DebugStates, type TileDebug } from "../live/debug";
import { sharedStyles } from "../styles";
import type { HomeAssistant, LiveStreamState } from "../types";

/** How often the server's state of the tile's streams is read while shown. */
export const DEBUG_POLL_MS = 2000;
/** Fired when the debug view's Close is pressed. */
export const DEBUG_CLOSE_EVENT = "rv-live-debug-close";

/**
 * A tile's debug view, over the tile: what it plays and how, what the server
 * holds for its streams (live/state, read every DEBUG_POLL_MS while shown;
 * no camera I/O), and its players' last events. Copy puts the text on the
 * clipboard, for a report.
 */
export class RvLiveDebug extends LitElement {
  static override properties = {
    hass: { attribute: false },
    info: { attribute: false },
    _states: { state: true },
    _copied: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  declare info: TileDebug | undefined;
  declare _states: DebugStates;
  declare _copied: boolean | undefined;

  private _timer: ReturnType<typeof setInterval> | undefined;

  constructor() {
    super();
    this._states = {};
  }

  override connectedCallback(): void {
    super.connectedCallback();
    void this._poll();
    this._timer = setInterval(() => {
      void this._poll();
    }, DEBUG_POLL_MS);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    clearInterval(this._timer);
  }

  private async _poll(): Promise<void> {
    const hass = this.hass;
    const info = this.info;
    const connection = info?.connection;
    if (!hass || !info || !connection) return;
    const read = async (stream: TileDebug["players"][number]["stream"]): Promise<LiveStreamState | string> => {
      try {
        return await fetchLiveState(hass, { connectionId: connection.connection_id, stream });
      } catch (err) {
        return toError(err).message;
      }
    };
    const entries = await Promise.all(info.players.map(async (p) => [p.label, await read(p.stream)] as const));
    this._states = Object.fromEntries(entries);
  }

  protected override firstUpdated(): void {
    // Opened from the keyboard or not, a screen reader starts here.
    this.renderRoot.querySelector<HTMLElement>(".panel")?.focus();
  }

  private _close(): void {
    this.dispatchEvent(new CustomEvent(DEBUG_CLOSE_EVENT, { bubbles: true, composed: true }));
  }

  protected override render(): TemplateResult {
    const info = this.info;
    const text = info ? debugText(info, this._states) : "";
    return html`<div
      class="panel"
      role="dialog"
      tabindex="-1"
      aria-label=${`${info?.camera ?? "Camera"}: debug`}
      @keydown=${(e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          this._close();
        }
      }}
    >
      <pre tabindex="0" aria-label="Debug text">${text}</pre>
      <div class="actions">
        <button
          @click=${() => {
            void copyText(text).then((ok) => {
              this._copied = ok;
            });
          }}
        >
          ${this._copied === undefined ? "Copy" : this._copied ? "Copied" : "Could not copy"}
        </button>
        <button
          @click=${() => {
            this._close();
          }}
        >
          Close
        </button>
      </div>
    </div>`;
  }

  static override styles = [
    sharedStyles,
    css`
      :host {
        position: absolute;
        inset: 0;
        color: #fff;
      }
      .panel {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        background: rgba(0, 0, 0, 0.85);
        border-radius: inherit;
      }
      pre {
        flex: 1;
        margin: 0;
        padding: 8px;
        overflow: auto;
        font-size: 11px;
        line-height: 1.4;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
      .actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
        padding: 6px 8px;
      }
      .actions button {
        padding: 4px 12px;
      }
    `,
  ];
}

if (!customElements.get("rv-live-debug")) {
  customElements.define("rv-live-debug", RvLiveDebug);
}

declare global {
  interface HTMLElementTagNameMap {
    "rv-live-debug": RvLiveDebug;
  }
}

import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from "lit";

import {
  fetchCatalog,
  fetchDevices,
  fetchLiveCameras,
  runProbe,
  toError,
  warmTimelines,
  type ProbeRun,
} from "./api";
import "./components/device-list";
import "./components/device-page";
import "./components/live-check";
import "./components/live-grid";
import "./components/events-view";
import "./components/live-soak";
import "./components/timetable";
import { boardCameras, type BoardCamera } from "./components/live-grid";
import {
  NAVIGATE_EVENT,
  TOAST_EVENT,
  routeFromHash,
  routeToHash,
  type Route,
  type ToastDetail,
} from "./components/navigation";
import { downloadJson } from "./download";
import { loadFonts } from "./fonts";
import { probeFilename } from "./format";
import { icon } from "./icons";
import { formatClock } from "./playback/time";
import { sharedStyles, themeTokens } from "./styles";
import type { DevicesResponse, HomeAssistant, ProbeReport } from "./types";

const MAX_LOG_LINES = 8;
const TOAST_MS = 6_000;

type ProbeState =
  | { status: "idle" }
  | { status: "running"; started: number; log: string[] }
  | { status: "done"; report: ProbeReport; filename: string }
  | { status: "error"; message: string };

export class ReolinkViewerPanel extends LitElement {
  static override properties = {
    hass: { attribute: false },
    narrow: { type: Boolean, reflect: true },
    _now: { state: true },
    _board: { state: true },
    _devices: { state: true },
    _loadError: { state: true },
    _probe: { state: true },
    _includeBattery: { state: true },
    _concurrency: { state: true },
    _maxStreams: { state: true },
    _playback: { state: true },
    _playbackOnly: { state: true },
    _playbackConcurrency: { state: true },
    _playbackStreams: { state: true },
    _copied: { state: true },
    _route: { state: true },
    _toast: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  declare narrow: boolean;
  /** The band's clock. */
  declare _now: number;
  /** The live board's cameras, numbered (the timetable shows the numbers). */
  declare _board: BoardCamera[];
  declare _devices: DevicesResponse | undefined;
  declare _loadError: string | undefined;
  declare _probe: ProbeState;
  declare _includeBattery: boolean;
  declare _concurrency: boolean;
  declare _maxStreams: number;
  declare _playback: boolean;
  declare _playbackOnly: boolean;
  declare _playbackConcurrency: boolean;
  declare _playbackStreams: number;
  declare _copied: boolean;
  declare _route: Route;
  declare _toast: ToastDetail | undefined;

  private _run: ProbeRun | undefined;
  private _loading = false;
  private _warmed = false;
  private _toastTimer: ReturnType<typeof setTimeout> | undefined;
  private _clockTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly _onHashChange = () => {
    this._route = routeFromHash(window.location.hash);
  };

  constructor() {
    super();
    this.narrow = false;
    this._now = Date.now();
    this._board = [];
    this._probe = { status: "idle" };
    this._includeBattery = false;
    this._concurrency = false;
    this._maxStreams = 4;
    this._playback = false;
    this._playbackOnly = false;
    this._playbackConcurrency = false;
    this._playbackStreams = 4;
    this._copied = false;
    this._route = { view: "live" };
    this.addEventListener(NAVIGATE_EVENT, (e) => {
      this.navigate((e as CustomEvent<Route>).detail);
    });
    this.addEventListener(TOAST_EVENT, (e) => {
      this.showToast((e as CustomEvent<ToastDetail>).detail);
    });
  }

  override connectedCallback(): void {
    super.connectedCallback();
    loadFonts(import.meta.url);
    this._route = routeFromHash(window.location.hash);
    window.addEventListener("hashchange", this._onHashChange);
    this._tick();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener("hashchange", this._onHashChange);
    clearTimeout(this._toastTimer);
    clearTimeout(this._clockTimer);
    this._run?.cancel();
    this._run = undefined;
  }

  /** The clock moves on at the start of each minute. */
  private _tick(): void {
    this._now = Date.now();
    clearTimeout(this._clockTimer);
    this._clockTimer = setTimeout(() => {
      this._tick();
    }, 60_000 - (this._now % 60_000) + 50);
  }

  protected override willUpdate(): void {
    // Home Assistant's dark mode picks the timetable's paper or navy.
    this.toggleAttribute("dark", this.hass?.themes?.darkMode === true);
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (changed.has("hass") && this.hass && !this._devices && !this._loading) {
      void this._load();
      // Warm the catalog so the Settings tab renders without waiting for it.
      fetchCatalog(this.hass).catch(() => undefined);
    }
  }

  /** Go to a view; the URL hash mirrors it so browser back works. */
  navigate(route: Route): void {
    const hash = routeToHash(route);
    if (window.location.hash !== hash) {
      const url = `${window.location.pathname}${window.location.search}${hash}`;
      window.history.pushState(null, "", url);
    }
    if (route.view === "list" && this._route.view !== "list") void this._load();
    this._route = route;
  }

  showToast(toast: ToastDetail): void {
    clearTimeout(this._toastTimer);
    this._toast = toast;
    this._toastTimer = setTimeout(() => {
      this._toast = undefined;
    }, TOAST_MS);
  }

  async _load(): Promise<void> {
    if (!this.hass) return;
    this._loading = true;
    try {
      this._devices = await fetchDevices(this.hass);
      this._loadError = undefined;
      if (!this._board.length && !this._devices.degraded) {
        // The board's numbering, for the timetables (the board itself may not be open).
        fetchLiveCameras(this.hass)
          .then(({ cameras }) => {
            if (!this._board.length) this._board = boardCameras(cameras);
          })
          .catch(() => undefined);
      }
      if (!this._warmed && !this._devices.degraded) {
        // Fetch today's timeline of every recording camera in the background.
        this._warmed = true;
        warmTimelines(this.hass).catch(() => undefined);
      }
    } catch (err) {
      this._loadError = toError(err).message;
    } finally {
      this._loading = false;
    }
  }

  private get _isAdmin(): boolean {
    return this.hass?.user?.is_admin === true;
  }

  protected override render(): TemplateResult {
    const route = this._route;
    return html`
      <header class="band">
        <ha-menu-button .hass=${this.hass} .narrow=${this.narrow}></ha-menu-button>
        <div class="title">Reolink</div>
        <nav aria-label="Reolink">
          ${this._renderTab("Live", { view: "live" }, route.view === "live")}
          ${this._renderTab("Events", { view: "events" }, route.view === "events")}
          ${this._renderTab("Devices", { view: "list" }, route.view !== "live" && route.view !== "events")}
        </nav>
        <time class="clock" aria-label="Time">
          ${formatClock(this._now, this.hass?.config?.time_zone)}
        </time>
      </header>
      <main class=${route.view === "live" || route.view === "events" ? "wide" : "page"}>${this._renderView()}</main>
      ${this._toast
        ? html`<div class="toast ${this._toast.kind}" role="status" aria-live="polite">
            <span>${this._toast.message}</span>
            <button class="dismiss" aria-label="Dismiss" @click=${() => {
              this._toast = undefined;
            }}>${icon("close")}</button>
          </div>`
        : nothing}
    `;
  }

  private _renderTab(label: string, to: Route, current: boolean): TemplateResult {
    return html`<button
      class="tab"
      aria-current=${current ? "page" : nothing}
      @click=${() => {
        this.navigate(to);
      }}
    >
      ${label}
    </button>`;
  }

  private _renderView(): TemplateResult {
    const route = this._route;
    switch (route.view) {
      case "live":
        return html`<rv-live-grid
            .hass=${this.hass}
            @rv-board=${(e: CustomEvent<{ cameras: BoardCamera[] }>) => {
              this._board = e.detail.cameras;
            }}
          ></rv-live-grid>
          <rv-timetable .hass=${this.hass} .cameras=${this._board} .filters=${true}></rv-timetable>`;
      case "events":
        return html`<rv-events .hass=${this.hass} .cameras=${this._board} .date=${route.date}></rv-events>`;
      case "device":
        return html`<rv-device-page
          .hass=${this.hass}
          .cameras=${this._board}
          .devices=${this._devices}
          .deviceId=${route.id}
          .tab=${route.tab}
          .at=${route.at}
        ></rv-device-page>`;
      case "live-check":
        return html`${this._renderBack()}
          <h1>Live check</h1>
          <rv-live-check .hass=${this.hass}></rv-live-check>`;
      case "soak":
        return html`${this._renderBack()}
          <h1>Soak report</h1>
          <rv-live-soak .hass=${this.hass}></rv-live-soak>`;
      case "list":
        return html`<div class="heading">
            <h1>Devices</h1>
            <button class="text with-icon" @click=${() => void this._load()} ?disabled=${this._loading}>
              ${icon("refresh")}Refresh
            </button>
          </div>
          ${this._renderBanner()}
          ${this._loadError
            ? nothing
            : html`<rv-device-list .devices=${this._devices} .cameras=${this._board}></rv-device-list>`}
          ${this._renderChecks()} ${this._isAdmin ? this._renderProbe() : nothing}`;
    }
  }

  private _renderBack(): TemplateResult {
    return html`<div>
      <button class="text with-icon back" @click=${() => {
        this.navigate({ view: "list" });
      }}>${icon("back")}All devices</button>
    </div>`;
  }

  private _renderBanner(): TemplateResult | typeof nothing {
    if (this._loadError) {
      return html`<div class="banner error" role="alert">
        Could not load devices: ${this._loadError}
      </div>`;
    }
    const devices = this._devices;
    if (!devices?.degraded) return nothing;
    return html`<div class="banner warning" role="alert">
      <strong>Degraded mode.</strong> The Reolink integration's internals changed in this
      Home Assistant release, so only the device registry's information is shown, duplicate
      cameras are not merged and the probe is disabled. Settings still work.
      <ul>
        ${devices.compat.errors.map((e) => html`<li>${e}</li>`)}
      </ul>
    </div>`;
  }

  /** How live view does on this device, and how it held up over a day. */
  private _renderChecks(): TemplateResult | typeof nothing {
    if (!this._devices || this._devices.degraded) return nothing;
    const check = (name: string, about: string, route: Route) => html`<li>
      <button
        class="row"
        @click=${() => {
          this.navigate(route);
        }}
      >
        <span class="what"><span class="name">${name}</span><span class="muted">${about}</span></span>
        ${icon("chevron")}
      </button>
    </li>`;
    return html`<section class="card">
      <h2>Checks</h2>
      <p class="muted">See how well live view works on your devices, in plain words.</p>
      <ul class="checks">
        ${check(
          "Live check",
          "How quickly each camera's live video starts on this device. Takes a few minutes.",
          { view: "live-check" },
        )}
        ${check(
          "Soak report",
          "Whether live view keeps working through a day of use: video that drops, connections that pile up, battery cameras that stay awake.",
          { view: "soak" },
        )}
      </ul>
      <p class="muted small">
        To check recordings, open a camera's Playback tab, then “Details and playback check” under the
        player.
      </p>
    </section>`;
  }

  private _renderProbe(): TemplateResult {
    const probe = this._probe;
    const running = probe.status === "running";
    const disabled = running || !this._devices || this._devices.degraded;
    return html`<section class="card">
      <h2>Hardware probe</h2>
      <p>
        Tests which ways of getting live and recorded video work on each of your cameras, and how fast
        they are. Run it when you report a problem with a camera model: it makes a file to attach to
        your report.
      </p>
      <p class="muted">
        It only reads from your cameras and changes no settings. Passwords, addresses, serial numbers and
        other private details are left out of the file.
      </p>
      <div class="options">
        <label class="option">
          <input
            type="checkbox"
            .checked=${this._includeBattery}
            ?disabled=${running}
            @change=${(e: Event) => {
              this._includeBattery = (e.target as HTMLInputElement).checked;
            }}
          />
          <span>Include battery cameras <span class="muted">(this wakes them, which uses some battery)</span></span>
        </label>
        <label class="option">
          <input
            type="checkbox"
            .checked=${this._concurrency}
            ?disabled=${running}
            @change=${(e: Event) => {
              this._concurrency = (e.target as HTMLInputElement).checked;
            }}
          />
          <span
            >Test several live streams at once: up to
            <select
              aria-label="Most live streams at once"
              .value=${String(this._maxStreams)}
              ?disabled=${running || !this._concurrency}
              @change=${(e: Event) => {
                this._maxStreams = Number((e.target as HTMLSelectElement).value);
              }}
            >
              ${[2, 3, 4, 5, 6].map((n) => html`<option value=${n} ?selected=${n === this._maxStreams}>${n}</option>`)}
            </select>
            on one camera of each device, stopping at the first that fails</span
          >
        </label>
        <label class="option">
          <input
            type="checkbox"
            .checked=${this._playback}
            ?disabled=${running}
            @change=${(e: Event) => {
              this._playback = (e.target as HTMLInputElement).checked;
            }}
          />
          <span>Test recordings: how they download and play, on one recent recording per camera</span>
        </label>
        <label class="option nested">
          <input
            type="checkbox"
            .checked=${this._playbackOnly}
            ?disabled=${running || !this._playback}
            @change=${(e: Event) => {
              this._playbackOnly = (e.target as HTMLInputElement).checked;
            }}
          />
          <span>Only test recordings (skip the live video tests)</span>
        </label>
        <label class="option nested">
          <input
            type="checkbox"
            .checked=${this._playbackConcurrency}
            ?disabled=${running || !this._playback}
            @change=${(e: Event) => {
              this._playbackConcurrency = (e.target as HTMLInputElement).checked;
            }}
          />
          <span
            >Test several recordings at once: up to
            <select
              aria-label="Most recordings at once"
              .value=${String(this._playbackStreams)}
              ?disabled=${running || !this._playback || !this._playbackConcurrency}
              @change=${(e: Event) => {
                this._playbackStreams = Number((e.target as HTMLSelectElement).value);
              }}
            >
              ${[2, 3, 4, 5, 6].map((n) => html`<option value=${n} ?selected=${n === this._playbackStreams}>${n}</option>`)}
            </select>
            , one per camera, stopping at the first that fails</span
          >
        </label>
      </div>
      <div class="actions">
        ${running
          ? html`<button @click=${() => {
              this._cancelProbe();
            }}>
              Cancel
            </button>`
          : html`<button class="primary" ?disabled=${disabled} @click=${() => {
              this._startProbe();
            }}>
              Run probe
            </button>`}
      </div>
      ${this._renderProbeState()}
    </section>`;
  }

  private _renderProbeState(): TemplateResult | typeof nothing {
    const probe = this._probe;
    switch (probe.status) {
      case "idle":
        return nothing;
      case "running":
        return html`<div class="progress" aria-live="polite">
          <p class="now">Testing your cameras… this can take several minutes with an NVR.</p>
          ${probe.log.length ? html`<p class="muted small">Now: ${probe.log.at(-1)}</p>` : nothing}
          <details>
            <summary class="small">Every step so far${icon("chevronDown")}</summary>
            <ol class="log">
              ${probe.log.map((line) => html`<li>${line}</li>`)}
            </ol>
          </details>
        </div>`;
      case "error":
        return html`<div class="banner error" role="alert">The probe stopped: ${probe.message}</div>`;
      case "done":
        return html`<div class="done">
          <p>
            <strong>Done.</strong> The file was saved as <code>${probe.filename}</code>. Attach it to your
            report. If your browser or the Companion app blocked the download, copy it instead.
          </p>
          <div class="actions">
            <button @click=${() => {
              downloadJson(probe.report, probe.filename);
            }}>
              Download again
            </button>
            <button @click=${() => void this._copy(probe.report)}>
              ${this._copied ? "Copied" : "Copy JSON"}
            </button>
          </div>
          <details>
            <summary class="small">Show what is in the file${icon("chevronDown")}</summary>
            <pre class="report">${JSON.stringify(probe.report, null, 2)}</pre>
          </details>
        </div>`;
    }
  }

  _startProbe(): void {
    if (!this.hass) return;
    const log: string[] = [];
    this._copied = false;
    this._probe = { status: "running", started: Date.now(), log };
    const run = runProbe(
      this.hass,
      {
        include_battery: this._includeBattery,
        concurrency_test: this._concurrency,
        max_streams: this._maxStreams,
        playback_test: this._playback,
        playback_only: this._playback && this._playbackOnly,
        playback_concurrency_test: this._playback && this._playbackConcurrency,
        playback_max_streams: this._playbackStreams,
      },
      (message) => {
        if (this._probe.status !== "running") return;
        this._probe = {
          ...this._probe,
          log: [...this._probe.log, message].slice(-MAX_LOG_LINES),
        };
      },
    );
    this._run = run;
    run.result.then(
      (report) => {
        if (this._run !== run) return;
        this._run = undefined;
        const filename = probeFilename(new Date());
        this._probe = { status: "done", report, filename };
        downloadJson(report, filename);
      },
      (err: unknown) => {
        if (this._run !== run) return;
        this._run = undefined;
        this._probe = { status: "error", message: toError(err).message };
      },
    );
  }

  _cancelProbe(): void {
    const run = this._run;
    this._run = undefined;
    run?.cancel();
    this._probe = { status: "idle" };
  }

  private async _copy(report: ProbeReport): Promise<void> {
    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      this._copied = true;
    } catch {
      this._copied = false;
    }
  }

  static override styles = [
    themeTokens,
    sharedStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
        min-height: 100dvh;
        background: var(--rv-ground);
        color: var(--rv-text);
        -webkit-font-smoothing: antialiased;
      }
      /* The band: where you are, and the time. */
      .band {
        display: flex;
        align-items: stretch;
        gap: 24px;
        height: 64px;
        padding: 0 20px;
        background: var(--rv-rail);
        color: var(--rv-on-rail);
        box-sizing: border-box;
        flex: none;
      }
      ha-menu-button {
        align-self: center;
      }
      .title {
        display: flex;
        align-items: center;
        font-family: var(--rv-font-cond);
        font-size: 22px;
        font-weight: 600;
      }
      nav {
        display: flex;
      }
      .tab {
        min-height: 0;
        padding: 0 14px;
        border: none;
        border-radius: 0;
        background: transparent;
        color: var(--rv-on-rail-muted);
        font-size: 16px;
        box-shadow: inset 0 -3px 0 transparent;
      }
      .tab:hover:not(:disabled) {
        background: transparent;
        color: var(--rv-on-rail);
      }
      .tab[aria-current] {
        color: var(--rv-on-rail);
        box-shadow: inset 0 -3px 0 var(--rv-on-rail);
      }
      .tab:focus-visible {
        outline-color: var(--rv-on-rail);
        outline-offset: -6px;
      }
      .clock {
        margin-left: auto;
        align-self: center;
        font-family: var(--rv-font-cond);
        font-size: 30px;
        font-weight: 600;
        line-height: 1;
      }
      :host([narrow]) .band {
        flex-wrap: wrap;
        height: auto;
        gap: 0;
        padding: 0 16px 0 4px;
      }
      :host([narrow]) .title {
        height: 56px;
        font-size: 20px;
        padding-left: 8px;
      }
      :host([narrow]) nav {
        order: 3;
        width: 100%;
        height: 44px;
      }
      :host([narrow]) .tab {
        flex: 1;
        font-size: 15px;
      }
      :host([narrow]) .clock {
        font-size: 24px;
      }
      main {
        flex: 1;
        min-width: 0;
      }
      main.page {
        width: 100%;
        max-width: 1100px;
        margin: 0 auto;
        padding: 20px 24px 40px;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        gap: 20px;
      }
      :host([narrow]) main.page {
        padding: 14px 16px 32px;
      }
      main.page > * {
        min-width: 0;
      }
      h1 {
        margin: 0;
        font-family: var(--rv-font-cond);
        font-size: 28px;
        font-weight: 600;
        line-height: 1.1;
      }
      .heading {
        display: flex;
        align-items: baseline;
        gap: 16px;
      }
      .back {
        padding-left: 0;
      }
      .checks {
        list-style: none;
        margin: 10px 0 12px;
        padding: 0;
        border-top: 1px solid var(--rv-rule-strong);
      }
      .checks li {
        border-bottom: 1px solid var(--rv-rule);
      }
      .checks .row {
        display: flex;
        align-items: center;
        gap: 16px;
        width: 100%;
        min-height: 64px;
        padding: 10px 4px;
        border: none;
        border-radius: 0;
        background: transparent;
        color: inherit;
        text-align: left;
        font-weight: 400;
      }
      .checks .row:hover:not(:disabled) {
        background: var(--rv-ground-2);
      }
      .checks .row:focus-visible {
        outline-offset: -2px;
      }
      .checks .what {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .checks .name {
        font-size: 17px;
        font-weight: 600;
      }
      .checks .row svg {
        flex: none;
        width: 18px;
        height: 18px;
        color: var(--rv-muted);
      }
      .card > p {
        margin: 6px 0;
      }
      .options {
        display: flex;
        flex-direction: column;
        gap: 2px;
        margin: 12px 0 14px;
      }
      .options select {
        margin: -4px 4px 0;
        padding: 2px 6px;
      }
      .progress .now {
        font-family: var(--rv-font-cond);
        font-size: 19px;
        font-weight: 600;
      }
      .progress,
      .done {
        margin-top: 14px;
      }
      .done .actions {
        margin: 10px 0;
      }
      .log {
        margin: 6px 0 0;
        padding-left: 22px;
        color: var(--rv-muted);
        font-family: var(--rv-mono);
        font-size: 13px;
      }
      .toast {
        position: fixed;
        left: 50%;
        bottom: 24px;
        transform: translateX(-50%);
        z-index: 20;
        display: flex;
        align-items: center;
        gap: 12px;
        max-width: min(560px, calc(100vw - 32px));
        padding: 8px 8px 8px 16px;
        background: var(--rv-board);
        color: var(--rv-on-board);
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.28);
      }
      .toast.error {
        background: var(--rv-fault);
        color: var(--rv-on-fault);
      }
      .toast .dismiss {
        min-height: 0;
        padding: 6px;
        border: none;
        background: transparent;
        color: inherit;
      }
    `,
  ];
}

if (!customElements.get("reolink-viewer-panel")) {
  customElements.define("reolink-viewer-panel", ReolinkViewerPanel);
}

declare global {
  interface HTMLElementTagNameMap {
    "reolink-viewer-panel": ReolinkViewerPanel;
  }
}

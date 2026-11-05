import { a as e, n as t, r as n, t as r } from "./lit-DdRjbP0M.js";
import { At as i, M as a, Mt as o, Tt as s, X as c, _ as l, ct as u, d, g as f, j as p, rt as m, t as h, tt as g, v as _, y as v } from "./live-13uUozrt.js";
import { G as y, H as b, J as x, K as S, L as C, R as w, V as T, W as E, Y as D, o as O, q as k, s as A, t as j, z as M } from "./home-CrFnHhPZ.js";
//#region src/reolink-viewer-panel.ts
var N = {
	live: "Live",
	events: "Events",
	list: "Devices",
	device: "Device",
	"live-check": "Live check",
	soak: "Soak report",
	cards: "Dashboard cards"
}, P = 6e3, F = class extends r {
	static properties = {
		hass: { attribute: !1 },
		narrow: {
			type: Boolean,
			reflect: !0
		},
		_now: { state: !0 },
		_board: { state: !0 },
		_devices: { state: !0 },
		_loadError: { state: !0 },
		_probe: { state: !0 },
		_includeBattery: { state: !0 },
		_concurrency: { state: !0 },
		_maxStreams: { state: !0 },
		_playback: { state: !0 },
		_playbackOnly: { state: !0 },
		_playbackConcurrency: { state: !0 },
		_playbackStreams: { state: !0 },
		_baichuan: { state: !0 },
		_baichuanOnly: { state: !0 },
		_baichuanMain: { state: !0 },
		_baichuanDownload: { state: !0 },
		_baichuanSession: { state: !0 },
		_baichuanCameras: { state: !0 },
		_baichuanHold: { state: !0 },
		_events: { state: !0 },
		_eventsOnly: { state: !0 },
		_copied: { state: !0 },
		_route: { state: !0 },
		_toast: { state: !0 },
		_viewError: { state: !0 }
	};
	_run;
	_loading = !1;
	_warmed = !1;
	_toastTimer;
	_clockTimer;
	_onHashChange = () => {
		this._route = T(window.location.hash);
	};
	constructor() {
		super(), this.narrow = !1, this._now = Date.now(), this._board = [], this._probe = { status: "idle" }, this._includeBattery = !1, this._concurrency = !1, this._maxStreams = 4, this._playback = !1, this._playbackOnly = !1, this._playbackConcurrency = !1, this._playbackStreams = 4, this._baichuan = !1, this._baichuanOnly = !0, this._baichuanMain = !1, this._baichuanDownload = !0, this._baichuanSession = !1, this._baichuanCameras = "", this._baichuanHold = 5, this._events = !1, this._eventsOnly = !0, this._copied = !1, this._route = { view: "live" }, this.addEventListener(w, (e) => {
			this.navigate(e.detail);
		}), this.addEventListener(M, (e) => {
			this.showToast(e.detail);
		});
	}
	connectedCallback() {
		super.connectedCallback(), h(import.meta.url), this._route = T(window.location.hash), window.addEventListener("hashchange", this._onHashChange), this._tick();
	}
	disconnectedCallback() {
		super.disconnectedCallback(), window.removeEventListener("hashchange", this._onHashChange), clearTimeout(this._toastTimer), clearTimeout(this._clockTimer), this._run?.cancel(), this._run = void 0;
	}
	_tick() {
		this._now = Date.now(), clearTimeout(this._clockTimer), this._clockTimer = setTimeout(() => {
			this._tick();
		}, 6e4 - this._now % 6e4 + 50);
	}
	willUpdate(e) {
		if (this.toggleAttribute("dark", this.hass?.themes?.darkMode === !0), e.has("_route")) {
			let e = this._route.view;
			this._viewError = void 0, j(e).catch((t) => {
				this._route.view === e && (this._viewError = i(t).message);
			});
		}
	}
	updated(e) {
		if (e.has("hass") && this.hass && !this._devices && !this._loading && (this._load(), g(this.hass).catch(() => void 0)), e.get("_route") !== void 0 && !this.shadowRoot?.activeElement) {
			let e = document.activeElement;
			(!e || e === document.body) && this.shadowRoot?.querySelector("main")?.focus({ preventScroll: !0 });
		}
	}
	navigate(e) {
		let t = b(e);
		if (window.location.hash !== t) {
			let e = `${window.location.pathname}${window.location.search}${t}`;
			window.history.pushState(null, "", e);
		}
		e.view === "list" && this._route.view !== "list" && this._load(), this._route = e;
	}
	showToast(e) {
		clearTimeout(this._toastTimer), this._toast = e, this._toastTimer = setTimeout(() => {
			this._toast = void 0;
		}, P);
	}
	async _load() {
		if (this.hass) {
			this._loading = !0;
			try {
				this._devices = await m(this.hass), this._loadError = void 0, !this._board.length && !this._devices.degraded && u(this.hass).then(({ cameras: e }) => {
					this._board.length || (this._board = C(e));
				}).catch(() => void 0), !this._warmed && !this._devices.degraded && (this._warmed = !0, o(this.hass).catch(() => void 0));
			} catch (e) {
				this._loadError = i(e).message;
			} finally {
				this._loading = !1;
			}
		}
	}
	get _isAdmin() {
		return this.hass?.user?.is_admin === !0;
	}
	render() {
		let e = this._route;
		return n`
      <header class="band">
        <ha-menu-button .hass=${this.hass} .narrow=${this.narrow}></ha-menu-button>
        <div class="title">Reolink</div>
        <nav aria-label="Reolink">
          ${this._renderTab("Live", { view: "live" }, e.view === "live")}
          ${this._renderTab("Events", { view: "events" }, e.view === "events")}
          ${this._renderTab("Devices", { view: "list" }, e.view !== "live" && e.view !== "events")}
        </nav>
        <time class="clock" aria-label="Time">
          ${d(this._now, this.hass?.config?.time_zone)}
        </time>
      </header>
      <main
        class=${e.view === "live" || e.view === "events" ? "wide" : "page"}
        tabindex="-1"
        aria-label=${N[e.view]}
      >${this._renderView()}</main>
      ${this._toast ? n`<div class="toast ${this._toast.kind}" role="status" aria-live="polite">
            <span>${this._toast.message}</span>
            <button class="dismiss" aria-label="Dismiss" @click=${() => {
			this._toast = void 0;
		}}>${c("close")}</button>
          </div>` : t}
    `;
	}
	_renderTab(e, r, i) {
		return n`<button
      class="tab"
      aria-current=${i ? "page" : t}
      @click=${() => {
			this.navigate(r);
		}}
    >
      ${e}
    </button>`;
	}
	_renderView() {
		let e = this._route;
		if (this._viewError) return n`<div class="banner error" role="alert">
        Could not load this page: ${this._viewError}. Check the connection to Home Assistant, then
        <button
          @click=${() => {
			this._viewError = void 0, j(e.view).catch((e) => {
				this._viewError = i(e).message;
			});
		}}
        >
          Try again
        </button>
      </div>`;
		let r = D(this._devices), a = r ? this._renderIntegration(r) : t;
		switch (e.view) {
			case "live": return r ? n`<div class="wide-note">${a}</div>` : n`<rv-live-grid
            .hass=${this.hass}
            @rv-board=${(e) => {
				this._board = e.detail.cameras;
			}}
          ></rv-live-grid>
          <rv-timetable .hass=${this.hass} .cameras=${this._board} .filters=${!0}></rv-timetable>`;
			case "events": return r ? n`<div class="wide-note">${a}</div>` : n`<rv-events .hass=${this.hass} .cameras=${this._board} .date=${e.date}></rv-events>`;
			case "device": return n`${a}<rv-device-page
          .hass=${this.hass}
          .cameras=${this._board}
          .devices=${this._devices}
          .deviceId=${e.id}
          .tab=${e.tab}
          .at=${e.at}
        ></rv-device-page>`;
			case "live-check": return n`${this._renderBack()}
          <h1>Live check</h1>
          ${a}
          <rv-live-check .hass=${this.hass}></rv-live-check>`;
			case "soak": return n`${this._renderBack()}
          <h1>Soak report</h1>
          ${a}
          <rv-live-soak .hass=${this.hass}></rv-live-soak>`;
			case "cards": return n`${this._renderBack()}
          <h1>Dashboard cards</h1>
          ${a}
          <rv-card-report .hass=${this.hass}></rv-card-report>`;
			case "list": return n`<div class="heading">
            <h1>Devices</h1>
            <button class="text with-icon" @click=${() => void this._load()} ?disabled=${this._loading}>
              ${c("refresh")}Refresh
            </button>
          </div>
          ${this._renderBanner()}
          ${this._loadError ? t : n`<rv-device-list .devices=${this._devices} .cameras=${this._board}></rv-device-list>`}
          ${this._renderChecks()}
          ${this._devices && !this._devices.degraded ? n`<rv-learning .hass=${this.hass}></rv-learning>` : t}
          ${this._renderThisDevice()} ${this._renderHelp()}
          ${this._isAdmin ? this._renderProbe() : t}`;
		}
	}
	_renderBack() {
		return n`<div>
      <button class="text with-icon back" @click=${() => {
			this.navigate({ view: "list" });
		}}>${c("back")}All devices</button>
    </div>`;
	}
	_renderBanner() {
		if (this._loadError) return y(x(this._loadError, "Your devices"), this._loadError, {
			action: n`<button @click=${() => void this._load()} ?disabled=${this._loading}>Try again</button>`,
			help: "loading"
		});
		let e = D(this._devices);
		return !e || e.kind === "none" ? t : this._renderIntegration(e);
	}
	_renderIntegration(e) {
		let r = e.kind !== "none";
		return n`<section class="integration ${r ? "fault" : ""}" role=${r ? "alert" : "status"}>
      <h2>${e.title}</h2>
      <p class="what">${e.text}</p>
      <p>${e.advice}</p>
      <div class="actions">
        <button class="check" @click=${() => void this._load()} ?disabled=${this._loading}>
          ${c("refresh")}${this._loading ? "Checking…" : "Check again"}
        </button>
        ${E(e.kind)}
      </div>
      ${e.technical ? n`<details>
            <summary>Details</summary>
            <span class="technical">${e.technical}</span>
          </details>` : t}
    </section>`;
	}
	_renderChecks() {
		if (!this._devices || this._devices.degraded) return t;
		let e = (e, t, r) => n`<li>
      <button
        class="row"
        @click=${() => {
			this.navigate(r);
		}}
      >
        <span class="what"><span class="name">${e}</span><span class="muted">${t}</span></span>
        ${c("chevron")}
      </button>
    </li>`;
		return n`<section class="card">
      <h2>Checks</h2>
      <p class="muted">See how well live view works on your devices, in plain words.</p>
      <ul class="checks">
        ${e("Live check", "How quickly each camera's live video starts on this device. Takes a few minutes.", { view: "live-check" })}
        ${e("Soak report", "Whether live view keeps working through a day of use: video that drops, connections that pile up, battery cameras that stay awake.", { view: "soak" })}
        ${e("Dashboard cards", "What the Reolink camera cards saw on each device: a wall tablet's screen going off and on, and how soon video came back.", { view: "cards" })}
      </ul>
      <p class="muted small">
        To check recordings, open a camera's Playback tab, then “Details and playback check” under the
        player.
      </p>
    </section>`;
	}
	_renderThisDevice() {
		let e = (e, t, r) => {
			let i = f({
				where: e,
				why: ""
			}).hd;
			return n`<label class="option">
        <span
          >${t}
          <select
            aria-label=${t}
            @change=${(t) => {
				_(e, t.target.value === "hd"), this.requestUpdate();
			}}
          >
            <option value="hd" ?selected=${i}>${r[0]}</option>
            <option value="sd" ?selected=${!i}>${r[1]}</option>
          </select></span
        >
      </label>`;
		};
		return n`<section class="card">
      <h2>This device</h2>
      <p class="muted">How a camera plays in full screen here. Each phone and computer keeps its own.</p>
      <div class="options">
        ${e("home", "At home, full screen starts in", ["HD", "SD"])}
        ${e("away", "Away from home or on mobile data, it starts in", ["HD", "the lighter SD"])}
        <label class="option">
          <input
            type="checkbox"
            .checked=${l()}
            @change=${(e) => {
			v(e.target.checked), this.requestUpdate();
		}}
          />
          <span
            >Remember HD or SD when I tap it in full screen
            <span class="muted">(off: full screen starts as set here every time)</span></span
          >
        </label>
      </div>
    </section>`;
	}
	_renderHelp() {
		let e = (e, t, r) => n`<li>
      <a class="row" href=${S(r)} target="_blank" rel="noopener noreferrer">
        <span class="what"><span class="name">${e}</span><span class="muted">${t}</span></span>
        ${c("external")}
      </a>
    </li>`;
		return n`<section class="card">
      <h2>Help</h2>
      <p class="muted">The guides to this version of Reolink Viewer (${k}). They open in a new tab.</p>
      <ul class="checks">
        ${e("User guide", "What each part of the panel does, and how to use it.", "guide")}
        ${e("Troubleshooting", "What a message means, and what to do about it.", "troubleshooting")}
        ${e("Cameras and NVRs", "What to expect from each Reolink model, and the camera settings that help.", "cameras")}
      </ul>
    </section>`;
	}
	_renderProbe() {
		let e = this._probe.status === "running", t = e || !this._devices || this._devices.degraded;
		return n`<section class="card">
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
            ?disabled=${e}
            @change=${(e) => {
			this._includeBattery = e.target.checked;
		}}
          />
          <span>Include battery cameras <span class="muted">(this wakes them, which uses some battery)</span></span>
        </label>
        <label class="option">
          <input
            type="checkbox"
            .checked=${this._concurrency}
            ?disabled=${e}
            @change=${(e) => {
			this._concurrency = e.target.checked;
		}}
          />
          <span
            >Test several live streams at once: up to
            <select
              aria-label="Most live streams at once"
              .value=${String(this._maxStreams)}
              ?disabled=${e || !this._concurrency}
              @change=${(e) => {
			this._maxStreams = Number(e.target.value);
		}}
            >
              ${[
			2,
			3,
			4,
			5,
			6
		].map((e) => n`<option value=${e} ?selected=${e === this._maxStreams}>${e}</option>`)}
            </select>
            on one camera of each device, stopping at the first that fails</span
          >
        </label>
        <label class="option">
          <input
            type="checkbox"
            .checked=${this._playback}
            ?disabled=${e}
            @change=${(e) => {
			this._playback = e.target.checked;
		}}
          />
          <span>Test recordings: how they download and play, on one recent recording per camera</span>
        </label>
        <label class="option nested">
          <input
            type="checkbox"
            .checked=${this._playbackOnly}
            ?disabled=${e || !this._playback}
            @change=${(e) => {
			this._playbackOnly = e.target.checked;
		}}
          />
          <span>Only test recordings (skip the live video tests)</span>
        </label>
        <label class="option nested">
          <input
            type="checkbox"
            .checked=${this._playbackConcurrency}
            ?disabled=${e || !this._playback}
            @change=${(e) => {
			this._playbackConcurrency = e.target.checked;
		}}
          />
          <span
            >Test several recordings at once: up to
            <select
              aria-label="Most recordings at once"
              .value=${String(this._playbackStreams)}
              ?disabled=${e || !this._playback || !this._playbackConcurrency}
              @change=${(e) => {
			this._playbackStreams = Number(e.target.value);
		}}
            >
              ${[
			2,
			3,
			4,
			5,
			6
		].map((e) => n`<option value=${e} ?selected=${e === this._playbackStreams}>${e}</option>`)}
            </select>
            , one per camera, stopping at the first that fails</span
          >
        </label>
        <label class="option">
          <input
            type="checkbox"
            .checked=${this._baichuan}
            ?disabled=${e}
            @change=${(e) => {
			this._baichuan = e.target.checked;
		}}
          />
          <span
            >Test replay over the Reolink app's own protocol (Phase 5): start a long recording of
            a recorder 75 % in over Baichuan and over HTTP, and compare; decode what arrives.
            Read-only, a few seconds of video per camera. It signs in on a connection of its own:
            one more logged-in user on the recorder while it runs.</span
          >
        </label>
        <label class="option nested">
          <input
            type="checkbox"
            .checked=${this._baichuanOnly}
            ?disabled=${e || !this._baichuan}
            @change=${(e) => {
			this._baichuanOnly = e.target.checked;
		}}
          />
          <span>Only this test (skip the live video and recording checks on every camera)</span>
        </label>
        <label class="option nested">
          <input
            type="checkbox"
            .checked=${this._baichuanMain}
            ?disabled=${e || !this._baichuan}
            @change=${(e) => {
			this._baichuanMain = e.target.checked;
		}}
          />
          <span>Also the HD (main) recordings</span>
        </label>
        <label class="option nested">
          <input
            type="checkbox"
            .checked=${this._baichuanDownload}
            ?disabled=${e || !this._baichuan}
            @change=${(e) => {
			this._baichuanDownload = e.target.checked;
		}}
          />
          <span>Also a download cut by time range (143) from the same point</span>
        </label>
        <label class="option nested">
          <input
            type="checkbox"
            .checked=${this._baichuanSession}
            ?disabled=${e || !this._baichuan}
            @change=${(e) => {
			this._baichuanSession = e.target.checked;
		}}
          />
          <span
            >Session test: hold a replay open beside a full-speed download, then two replays at
            once, and count the recorder's logged-in users</span
          >
        </label>
        <label class="option nested">
          <span
            >Cameras:
            <input
              type="text"
              aria-label="Cameras to test, names separated by commas"
              placeholder="every camera"
              .value=${this._baichuanCameras}
              ?disabled=${e || !this._baichuan}
              @input=${(e) => {
			this._baichuanCameras = e.target.value;
		}}
            />
            (names or models, separated by commas; empty for every camera, up to 8)</span
          >
        </label>
        <label class="option nested">
          <span
            >Hold each stream for
            <select
              aria-label="Seconds to hold each stream"
              .value=${String(this._baichuanHold)}
              ?disabled=${e || !this._baichuan}
              @change=${(e) => {
			this._baichuanHold = Number(e.target.value);
		}}
            >
              ${[
			5,
			10,
			30,
			90
		].map((e) => n`<option value=${e} ?selected=${e === this._baichuanHold}>${e}</option>`)}
            </select>
            seconds (90 leaves time to run the Live check's capacity test alongside)</span
          >
        </label>
        <label class="option">
          <input
            type="checkbox"
            .checked=${this._events}
            ?disabled=${e}
            @change=${(e) => {
			this._events = e.target.checked;
		}}
          />
          <span
            >Test the events of cameras that record where Reolink Viewer cannot play it, such as a
            doorbell's SD card (Phase 6): the day and event searches, and a few pictures. Read-only.
            A camera on its battery is tested only with "Include battery cameras"; one on wired
            power is tested either way.</span
          >
        </label>
        <label class="option nested">
          <input
            type="checkbox"
            .checked=${this._eventsOnly}
            ?disabled=${e || !this._events}
            @change=${(e) => {
			this._eventsOnly = e.target.checked;
		}}
          />
          <span>Only this test (skip the live video and recording checks on every camera)</span>
        </label>
      </div>
      <div class="actions">
        ${e ? n`<button @click=${() => {
			this._cancelProbe();
		}}>
              Cancel
            </button>` : n`<button class="primary" ?disabled=${t} @click=${() => {
			this._startProbe();
		}}>
              Run probe
            </button>`}
      </div>
      ${this._renderProbeState()}
    </section>`;
	}
	_renderProbeState() {
		let e = this._probe;
		switch (e.status) {
			case "idle": return t;
			case "running": return n`<div class="progress" aria-live="polite">
          <p class="now">Testing your cameras… this can take several minutes with an NVR.</p>
          ${e.log.length ? n`<p class="muted small">Now: ${e.log.at(-1)}</p>` : t}
          <details>
            <summary class="small">Every step so far${c("chevronDown")}</summary>
            <ol class="log">
              ${e.log.map((e) => n`<li>${e}</li>`)}
            </ol>
          </details>
        </div>`;
			case "error": return n`<div class="banner error" role="alert">The probe stopped: ${e.message}</div>`;
			case "done": return n`<div class="done">
          <p>
            <strong>Done.</strong> The file was saved as <code>${e.filename}</code>. Attach it to your
            report. If your browser or the Companion app blocked the download, copy it instead.
          </p>
          <div class="actions">
            <button @click=${() => {
				A(e.report, e.filename);
			}}>
              Download again
            </button>
            <button @click=${() => void this._copy(e.report)}>
              ${this._copied ? "Copied" : "Copy JSON"}
            </button>
          </div>
          <details>
            <summary class="small">Show what is in the file${c("chevronDown")}</summary>
            <pre class="report">${JSON.stringify(e.report, null, 2)}</pre>
          </details>
        </div>`;
		}
	}
	_startProbe() {
		if (!this.hass) return;
		let e = [];
		this._copied = !1, this._probe = {
			status: "running",
			started: Date.now(),
			log: e
		};
		let t = s(this.hass, {
			include_battery: this._includeBattery,
			concurrency_test: this._concurrency,
			max_streams: this._maxStreams,
			playback_test: this._playback,
			playback_only: this._playback && this._playbackOnly,
			playback_concurrency_test: this._playback && this._playbackConcurrency,
			playback_max_streams: this._playbackStreams,
			baichuan_test: this._baichuan,
			baichuan_only: this._baichuan && this._baichuanOnly,
			baichuan_streams: this._baichuanMain ? ["sub", "main"] : ["sub"],
			baichuan_download: this._baichuanDownload,
			baichuan_session: this._baichuanSession,
			baichuan_cameras: this._baichuanCameras.trim(),
			baichuan_hold: this._baichuanHold,
			baichuan_cut: 20,
			events_test: this._events,
			events_only: this._events && this._eventsOnly
		}, (e) => {
			this._probe.status === "running" && (this._probe = {
				...this._probe,
				log: [...this._probe.log, e].slice(-8)
			});
		});
		this._run = t, t.result.then((e) => {
			if (this._run !== t) return;
			this._run = void 0;
			let n = O(/* @__PURE__ */ new Date());
			this._probe = {
				status: "done",
				report: e,
				filename: n
			}, A(e, n);
		}, (e) => {
			this._run === t && (this._run = void 0, this._probe = {
				status: "error",
				message: i(e).message
			});
		});
	}
	_cancelProbe() {
		let e = this._run;
		this._run = void 0, e?.cancel(), this._probe = { status: "idle" };
	}
	async _copy(e) {
		try {
			await navigator.clipboard.writeText(JSON.stringify(e, null, 2)), this._copied = !0;
		} catch {
			this._copied = !1;
		}
	}
	static styles = [
		a,
		p,
		e`
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
      /* Focused by the panel after a change of view, not by the user: no ring. */
      main:focus {
        outline: none;
      }
      /* Over the board and the events, when neither can work. */
      .wide-note {
        max-width: 760px;
        padding: 24px;
      }
      :host([narrow]) .wide-note {
        padding: 14px 16px;
      }
      /* Reolink Viewer cannot reach the cameras: why, what still works, what to do. */
      .integration {
        padding: 18px 20px;
        background: var(--rv-ground-2);
      }
      .integration.fault {
        background: var(--rv-fault);
        color: var(--rv-on-fault);
      }
      .integration h2 {
        margin: 0 0 6px;
        font-family: var(--rv-font-cond);
        font-size: 24px;
        font-weight: 600;
        line-height: 1.15;
      }
      .integration p {
        margin: 0 0 8px;
        max-width: 64ch;
      }
      .integration .what {
        font-weight: 600;
      }
      .integration .actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px 20px;
        margin-top: 4px;
      }
      .integration .check {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .integration.fault a {
        color: var(--rv-on-fault);
      }
      .integration.fault .check {
        border-color: var(--rv-on-fault);
        color: var(--rv-on-fault);
      }
      .integration .check svg {
        width: 18px;
        height: 18px;
      }
      .integration details {
        margin-top: 12px;
        font-size: 13px;
      }
      .integration summary {
        cursor: pointer;
        font-weight: 500;
      }
      .integration .technical {
        display: block;
        margin-top: 4px;
        font-family: var(--rv-mono);
        white-space: pre-wrap;
        overflow-wrap: anywhere;
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
      .checks a.row {
        text-decoration: none;
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
    `
	];
};
customElements.get("reolink-viewer-panel") || customElements.define("reolink-viewer-panel", F);
//#endregion
export { F as ReolinkViewerPanel, j as loadView };

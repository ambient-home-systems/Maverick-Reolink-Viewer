import { a as e, n as t, r as n, t as r } from "./lit-DdRjbP0M.js";
import { A as i, G as a, M as o, N as s, O as c, P as l, c as u, ct as d, dt as ee, ft as f, gt as p, j as te, st as ne, u as m, xt as h } from "./live-D27fF3SV.js";
//#region src/integration.ts
function re(e) {
	if (e?.degraded) return e.compat.ok ? !e.hosts.length && !e.cameras.length ? {
		kind: "none",
		title: "No Reolink devices yet",
		text: "Set up your cameras or NVR in Home Assistant's Reolink integration first.",
		advice: "Settings → Devices & services → Add integration → Reolink. They appear here once it has loaded them."
	} : {
		kind: "stopped",
		title: "The Reolink integration is not running",
		text: "Home Assistant's Reolink integration has not loaded your cameras or NVR, so Reolink Viewer cannot reach them.",
		advice: "Check it under Settings → Devices & services → Reolink: it may be waiting for a camera or NVR to come back online. Live view, recordings and events come back once it runs."
	} : {
		kind: "changed",
		title: "Reolink Viewer needs an update",
		text: "A Home Assistant update changed its Reolink integration, and this version of Reolink Viewer cannot work with it.",
		advice: "Update Reolink Viewer in HACS when a new version is out. Until then, live view, recordings and events are off here. Your cameras keep recording, the Reolink app still works, and your devices and their settings are still here.",
		technical: g(e.compat)
	};
}
function g(e) {
	return [...e.errors, ...e.reolink_aio_version ? [`reolink-aio ${e.reolink_aio_version}`] : []].join("\n");
}
function _(e, t) {
	return /not loaded/i.test(e) ? {
		text: `${t} could not load: Reolink Viewer is not running.`,
		advice: "Check it under Settings → Devices & services, then try again."
	} : /internals changed|incompatible/i.test(e) ? {
		text: `${t} could not load: Reolink Viewer needs an update to work with this Home Assistant release.`,
		advice: "Update it in HACS when a new version is out."
	} : /unknown command/i.test(e) ? {
		text: `${t} could not load: Reolink Viewer was updated, but Home Assistant has not restarted since.`,
		advice: "Restart Home Assistant, then reload this page."
	} : {
		text: `${t} could not load from Home Assistant.`,
		advice: "Check the connection to Home Assistant, then try again."
	};
}
//#endregion
//#region src/live/soak-tally.ts
var ie = 6e4, v = new class {
	_device;
	_now;
	_opens = 0;
	_openMs = 0;
	_visibleMs = 0;
	_tiles = /* @__PURE__ */ new Map();
	_openSince;
	_visibleSince;
	_timer;
	_sending = Promise.resolve();
	constructor(e = () => y(navigator.userAgent), t = () => Date.now()) {
		this._device = e, this._now = t;
	}
	get open() {
		return this._openSince !== void 0;
	}
	opened(e, t) {
		let n = this._now();
		this._opens += 1, this._openSince = n, this._visibleSince = t ? n : void 0, clearInterval(this._timer), this._timer = setInterval(() => {
			let t = e();
			t && this.flush(t);
		}, ie);
	}
	closed() {
		this._accrue(), this._openSince = void 0, this._visibleSince = void 0, clearInterval(this._timer), this._timer = void 0;
	}
	visibility(e) {
		this.open && (this._accrue(), this._visibleSince = e ? this._now() : void 0);
	}
	count(e, t) {
		let n = this._tiles.get(e);
		n || (n = {
			plays: 0,
			drops: 0,
			failures: 0
		}, this._tiles.set(e, n)), n[t] += 1;
	}
	discard() {
		this._accrue(), this._take();
	}
	flush(e) {
		return this._sending = this._sending.then(() => this._send(e)), this._sending;
	}
	async _send(e) {
		this._accrue();
		let t = this._take();
		if (t) try {
			await p(e, this._device(), t);
		} catch {
			this._putBack(t);
		}
	}
	_accrue() {
		let e = this._now();
		this._openSince !== void 0 && (this._openMs += e - this._openSince, this._openSince = e), this._visibleSince !== void 0 && (this._visibleMs += e - this._visibleSince, this._visibleSince = e);
	}
	_take() {
		let e = {
			opens: this._opens,
			open_ms: Math.round(this._openMs),
			visible_ms: Math.round(this._visibleMs),
			tiles: [...this._tiles].map(([e, t]) => ({
				camera: e,
				...t
			}))
		};
		return this._opens = 0, this._openMs = 0, this._visibleMs = 0, this._tiles = /* @__PURE__ */ new Map(), !e.opens && !e.open_ms && !e.visible_ms && !e.tiles.length ? void 0 : e;
	}
	_putBack(e) {
		this._opens += e.opens, this._openMs += e.open_ms, this._visibleMs += e.visible_ms;
		for (let { camera: t, plays: n, drops: r, failures: i } of e.tiles) {
			let e = this._tiles.get(t) ?? {
				plays: 0,
				drops: 0,
				failures: 0
			};
			this._tiles.set(t, {
				plays: e.plays + n,
				drops: e.drops + r,
				failures: e.failures + i
			});
		}
	}
}();
function y(e) {
	let t = /iPhone/.test(e) ? "iPhone" : /iPad/.test(e) ? "iPad" : /Android/.test(e) ? "Android" : /Macintosh|Mac OS X/.test(e) ? "Mac" : /Windows/.test(e) ? "Windows" : /Linux|X11/.test(e) ? "Linux" : "Browser", n = /Home ?Assistant\//.test(e) ? "Home Assistant app" : /Edg(A|iOS)?\//.test(e) ? "Edge" : /Firefox\/|FxiOS\//.test(e) ? "Firefox" : /Chrome\/|CriOS\//.test(e) ? "Chrome" : /Safari\//.test(e) ? "Safari" : void 0;
	return n ? `${t} · ${n}` : t;
}
//#endregion
//#region src/version.ts
var b = "0.44.0", ae = "https://github.com/ambient-home-systems/Maverick-Reolink-Viewer", oe = {
	guide: ["user-guide"],
	troubleshooting: ["troubleshooting"],
	cameras: ["cameras"],
	changed: ["troubleshooting", "reolink-viewer-needs-an-update"],
	stopped: ["troubleshooting", "the-reolink-integration-is-not-running"],
	none: ["troubleshooting", "no-reolink-devices-yet"],
	loading: ["troubleshooting", "a-page-could-not-load"],
	recordings: ["troubleshooting", "recordings-and-events"]
};
function x(e) {
	let [t, n] = oe[e];
	return `${ae}/blob/v${b}/docs/${t}.md${n ? `#${n}` : ""}`;
}
//#endregion
//#region src/problem.ts
function S(e, r, i = {}) {
	return n`<div class="banner ${i.kind ?? "error"} problem" role="alert">
    <strong>${e.text}</strong>${e.advice ? n` ${e.advice}` : t}
    ${i.action ?? t} ${i.help ? C(i.help) : t}
    ${r ? n`<details>
          <summary>Details</summary>
          <span class="technical">${r}</span>
        </details>` : t}
  </div>`;
}
function C(e, t = "More help") {
	return n`<a class="help-link" href=${x(e)} target="_blank" rel="noopener noreferrer"
    >${t}${a("external")}</a
  >`;
}
//#endregion
//#region src/components/navigation.ts
var w = "rv-navigate", T = "rv-toast";
function E(e, t) {
	e.dispatchEvent(new CustomEvent(w, {
		detail: t,
		bubbles: !0,
		composed: !0
	}));
}
function se(e, t, n = "info") {
	e.dispatchEvent(new CustomEvent(T, {
		detail: {
			message: t,
			kind: n
		},
		bubbles: !0,
		composed: !0
	}));
}
function ce(e) {
	if (e.view === "live-check") return "#live-check";
	if (e.view === "soak") return "#soak";
	if (e.view === "list") return "#devices";
	if (e.view === "events") return e.date ? `#events/${e.date}` : "#events";
	if (e.view === "live") return "";
	let t = e.tab === "playback" && e.at !== void 0 ? `/${e.at}` : "";
	return `#device/${encodeURIComponent(e.id)}/${e.tab}${t}`;
}
function le(e) {
	if (e === "#live-check") return { view: "live-check" };
	if (e === "#soak") return { view: "soak" };
	if (e === "#devices") return { view: "list" };
	if (e === "#events") return { view: "events" };
	let t = /^#events\/(\d{4}-\d{2}-\d{2})$/.exec(e);
	if (t?.[1]) return {
		view: "events",
		date: t[1]
	};
	let n = /^#device\/([^/]+)(?:\/(overview|live|settings|playback)(?:\/(\d+))?)?$/.exec(e);
	if (!n?.[1]) return { view: "live" };
	let r = n[2], i = decodeURIComponent(n[1]);
	return r === "playback" && n[3] ? {
		view: "device",
		id: i,
		tab: r,
		at: Number(n[3])
	} : {
		view: "device",
		id: i,
		tab: r === "live" || r === "settings" || r === "playback" ? r : "overview"
	};
}
//#endregion
//#region src/components/live-grid.ts
var D = 8, ue = "rv-board", de = class extends r {
	static properties = {
		hass: { attribute: !1 },
		_full: { state: !0 },
		_boardFull: { state: !0 },
		_width: { state: !0 },
		_live: { state: !0 }
	};
	_data = new i(this);
	_resize;
	_announced;
	constructor() {
		super(), this._boardFull = !1, this._width = 0, this._live = /* @__PURE__ */ new Set();
	}
	connectedCallback() {
		super.connectedCallback(), v.opened(() => this.hass, document.visibilityState !== "hidden"), document.addEventListener("visibilitychange", this._onVisibility), document.addEventListener("fullscreenchange", this._onFullscreen), typeof ResizeObserver < "u" && (this._resize = new ResizeObserver((e) => {
			let t = e.at(-1);
			t && Math.abs(t.contentRect.width - this._width) >= 1 && (this._width = t.contentRect.width);
		}), this._resize.observe(this)), this._flush();
	}
	disconnectedCallback() {
		super.disconnectedCallback(), document.removeEventListener("visibilitychange", this._onVisibility), document.removeEventListener("fullscreenchange", this._onFullscreen), this._resize?.disconnect(), this._resize = void 0, v.closed(), this._flush();
	}
	_onFullscreen = () => {
		this._boardFull = document.fullscreenElement === this;
	};
	_toggleBoardFull() {
		document.fullscreenElement === this ? document.exitFullscreen().catch(() => void 0) : this.requestFullscreen().catch(() => void 0);
	}
	_onVisibility = () => {
		let e = document.visibilityState !== "hidden";
		v.visibility(e), e || this._flush();
	};
	_flush() {
		this.hass && v.flush(this.hass);
	}
	willUpdate() {
		this._data.hass = this.hass;
	}
	updated() {
		let e = this._data.cameras;
		if (e && e !== this._announced) {
			this._announced = e;
			let t = O(e);
			this.dispatchEvent(new CustomEvent(ue, {
				detail: { cameras: t },
				bubbles: !0,
				composed: !0
			}));
		}
	}
	render() {
		let e = this._data, r = e.cameras, i = document.fullscreenEnabled && typeof this.requestFullscreen == "function";
		return n`<div class="head">
        <h1>Live</h1>
        ${r?.length ? n`<p class="count">
              ${fe(r, this._live, r.filter((e) => l(this.hass, s(e)) !== void 0).length)}
            </p>` : t}
        ${i && r?.length ? n`<button class="text with-icon full" @click=${() => {
			this._toggleBoardFull();
		}}>
              ${a(this._boardFull ? "exitFull" : "enterFull")}${this._boardFull ? "Exit full screen" : "Full screen"}
            </button>` : t}
      </div>
      ${e.error ? S(_(e.error, "Live view"), e.error, {
			action: n`<button
              @click=${() => {
				e.reload();
			}}
            >
              Try again
            </button>`,
			help: "loading"
		}) : t}
      ${r === void 0 ? e.error ? t : n`<p class="note">Loading…</p>` : r.length === 0 ? n`<p class="note">No camera can be watched live.</p>` : this._renderGrid(r)}`;
	}
	_renderGrid(e) {
		let t = this._data, r = k(e), i = r.map((e) => A(s(e))), a = i.reduce((e, t) => e + (t ? 2 : 1), 0), c = this._width, l = Math.max(2, Math.min(c >= 1100 ? 5 : c >= 800 ? 4 : c >= 540 ? 3 : 2, a)), u = c ? (c - (l - 1) * D) / l : 0, d = 9 / 16 * u;
		return n`<div
      class="grid"
      style=${`--cols: ${l}; --row: ${d ? `${d.toFixed(1)}px` : "auto"}`}
      @rv-live-open=${(e) => {
			E(this, {
				view: "device",
				id: e.detail.cameraId,
				tab: "live"
			});
		}}
      @rv-live-full=${(e) => {
			e.detail.full ? this._full = e.detail.cameraId : this._full === e.detail.cameraId && (this._full = void 0);
		}}
      @rv-live-count=${(e) => {
			v.count(e.detail.camera, e.detail.kind);
		}}
      @rv-live-state=${(e) => {
			let t = new Set(this._live);
			e.detail.live ? t.add(e.detail.cameraId) : t.delete(e.detail.cameraId), this._live = t;
		}}
    >
      ${r.map((e, r) => n`<rv-live-tile
            class=${i[r] ?? ""}
            fill
            .fit=${pe(s(e), i[r], u)}
            .number=${r + 1}
            .hass=${this.hass}
            .camera=${e}
            .connection=${s(e)}
            .image=${t.images[e.id]}
            .iceServers=${t.iceServers}
            .warm=${o(this.hass, e)}
            .suspended=${this._full !== void 0 && this._full !== e.id}
            .controls=${e.controls}
            openable
          ></rv-live-tile>`)}
    </div>`;
	}
	static styles = [c, e`
      :host {
        display: block;
        padding: 16px 24px 28px;
        color: var(--rv-on-board);
        background: var(--rv-board);
      }
      .head {
        display: flex;
        align-items: baseline;
        gap: 14px;
        margin-bottom: 12px;
      }
      h1 {
        margin: 0;
        font-family: var(--rv-font-cond);
        font-size: 22px;
        font-weight: 600;
      }
      .count,
      .note {
        margin: 0;
        color: var(--rv-on-board-muted);
        font-size: 15px;
      }
      button.full {
        margin-left: auto;
        color: var(--rv-on-board);
      }
      button.full:focus-visible {
        outline-color: var(--rv-on-board);
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(var(--cols, 2), minmax(0, 1fr));
        grid-auto-rows: var(--row, auto);
        grid-auto-flow: dense;
        gap: ${D}px;
      }
      rv-live-tile.tall {
        grid-row: span 2;
      }
      rv-live-tile.wide {
        grid-column: span 2;
      }
      @media (max-width: 600px) {
        :host {
          padding: 12px 12px 20px;
        }
      }
    `];
};
function fe(e, t, n = 0) {
	let r = e.filter((e) => t.has(e.id)).length, i = r ? `${String(r)} of ${String(e.length)} playing` : `${String(e.length)} ${e.length === 1 ? "camera" : "cameras"}`;
	return n ? `${i} · ${String(n)} offline` : i;
}
function O(e) {
	return k(e).map((e, t) => ({
		id: e.id,
		name: e.name,
		number: t + 1
	}));
}
function k(e) {
	let t = e.filter((e) => A(s(e)) === "tall");
	return [...t, ...e.filter((e) => !t.includes(e))];
}
function pe(e, t, n) {
	let r = j(e);
	if (!r) return "cover";
	let i = n ? D / n : 0, a = 9 / 16;
	return r > (t === "tall" ? 1 / (2 * a + i) : t === "wide" ? (2 + i) / a : 1 / a) * 1.02 ? "contain" : "cover";
}
function A(e) {
	let t = j(e);
	if (t) {
		if (t < 1.2) return "tall";
		if (t > 2.4) return "wide";
	}
}
function j(e) {
	let t = e?.streams.sub?.encoding, n = t?.width, r = t?.height;
	return n && r ? n / r : void 0;
}
var me = class extends r {
	static properties = {
		hass: { attribute: !1 },
		deviceId: { attribute: !1 },
		_error: { state: !0 }
	};
	_data = new i(this);
	willUpdate() {
		this._data.hass = this.hass;
	}
	render() {
		let e = this._data;
		if (e.error) return n`<div class="banner error" role="alert">
        Could not load live view: ${e.error}
        <button
          @click=${() => {
			e.reload();
		}}
        >
          Retry
        </button>
      </div>`;
		if (!e.cameras) return n`<p class="muted">Loading…</p>`;
		let t = te(e.cameras, this.deviceId);
		return t ? n`<div class="board">
        <rv-live-tile
          .hass=${this.hass}
          .camera=${t}
          .connection=${s(t)}
          .image=${e.images[t.id]}
          .iceServers=${e.iceServers}
          .warm=${o(this.hass, t)}
          .controls=${t.controls}
        ></rv-live-tile>
      </div>
      ${this._renderKeepWarm(t)}` : n`<p class="muted">This camera cannot be watched live.</p>`;
	}
	_renderKeepWarm(e) {
		let r = e.keep_warm_entity;
		if (!r) return t;
		let i = this.hass?.states[r]?.state;
		return n`<label class="keep-warm">
      <input
        type="checkbox"
        aria-labelledby="keep-warm-name"
        aria-describedby="keep-warm-about"
        .checked=${i === "on"}
        ?disabled=${i !== "on" && i !== "off"}
        @change=${(e) => {
			let t = e.target.checked;
			this.hass?.callService("switch", t ? "turn_on" : "turn_off", { entity_id: r }).catch((e) => {
				this._error = h(e).message;
			});
		}}
      />
      <span>
        <strong id="keep-warm-name">Keep warm</strong>
        <span class="muted small" id="keep-warm-about"
          >Keeps the camera connected so its live view starts at once. Uses one of
          its NVR's or camera's stream slots all the time.</span
        >
      </span>
    </label>
    ${this._error ? n`<div class="banner error" role="alert">Could not change it: ${this._error}</div>` : t}`;
	}
	static styles = [c, e`
      :host {
        display: flex;
        flex-direction: column;
        gap: 12px;
        max-width: 1280px;
      }
      /* Video sits on the board's ink, with a margin of it. */
      .board {
        padding: 10px;
        background: var(--rv-board);
      }
      .keep-warm {
        display: flex;
        gap: 8px;
        align-items: flex-start;
      }
      .keep-warm > span {
        display: flex;
        flex-direction: column;
      }
    `];
};
customElements.get("rv-live-grid") || customElements.define("rv-live-grid", de), customElements.get("rv-live-camera") || customElements.define("rv-live-camera", me);
//#endregion
//#region src/playback/timeline-math.ts
var M = 6e4, N = 60 * M, P = 24 * N, F = [
	P,
	6 * N,
	N,
	15 * M,
	5 * M
];
function I(e, t, n) {
	return (e - t.start) / t.span * n;
}
function L(e, t, n) {
	return t.start + e / n * t.span;
}
function R(e, t) {
	let n = t.end - t.start, r = F[F.length - 1] ?? 6e4, i = Math.min(Math.max(e.span, r), Math.max(n, r));
	return i >= n ? {
		start: t.start,
		span: n
	} : {
		start: Math.min(Math.max(e.start, t.start), t.end - i),
		span: i
	};
}
function z(e, t, n, r) {
	return R({
		start: n - (n - e.start) / e.span * t,
		span: t
	}, r);
}
function he(e, t) {
	let n = e * .01;
	return t > 0 ? F.find((t) => t < e - n) : [...F].reverse().find((t) => t > e + n);
}
function ge(e, t, n) {
	return R({
		start: t - e.span / 2,
		span: e.span
	}, n);
}
var B = [
	1e4,
	3e4,
	M,
	5 * M,
	10 * M,
	15 * M,
	30 * M,
	N,
	2 * N,
	3 * N,
	6 * N
];
function V(e, t, n = 60) {
	for (let r of B) if (r / e.span * t >= n) return r;
	return B[B.length - 1] ?? 36e5;
}
function _e(e, t, n) {
	let r = V(e, t), i = [], a = e.start + e.span, o = n(e.start), s = Math.ceil((e.start + o) / r) * r - o;
	for (let e = 0; s <= a && e < 500; e += 1) i.push(s), s += r;
	return i;
}
function ve(e, t, n, r = 1) {
	let i = r / n * t.span, a = t.start + t.span, o = [];
	for (let n of e) {
		if (n.end < t.start || n.start > a) continue;
		let e = o.at(-1);
		e && n.start - e.end <= i ? e.end = Math.max(e.end, n.end) : o.push({
			start: n.start,
			end: n.end
		});
	}
	return o;
}
function H(e, t) {
	let n = 0, r = e.length - 1, i;
	for (; n <= r;) {
		let a = n + r >> 1, o = e.at(a);
		if (!o) break;
		o.start <= t ? (t < o.end && (i = o), n = a + 1) : r = a - 1;
	}
	return i;
}
function ye(e, t) {
	return e.find((e) => e.start > t);
}
function be(e, t) {
	let n = H(e, t);
	if (n) return {
		segment: n,
		offset: t - n.start
	};
	let r = ye(e, t);
	return r ? {
		segment: r,
		offset: 0
	} : void 0;
}
function xe(e, t) {
	return t.size === 0 ? e : e.filter((e) => q(e.types).some((e) => t.has(e)));
}
function Se(e, t) {
	return e.find((e) => e.start > t + 500);
}
function Ce(e, t) {
	let n;
	for (let r of e) if (r.start < t - 1500) n = r;
	else break;
	return n;
}
var U = [
	{
		type: "PERSON",
		label: "Person"
	},
	{
		type: "VEHICLE",
		label: "Vehicle"
	},
	{
		type: "ANIMAL",
		label: "Animal"
	},
	{
		type: "CROSSLINE",
		label: "Line crossing"
	},
	{
		type: "INTRUSION",
		label: "Intrusion"
	},
	{
		type: "LINGER",
		label: "Loitering"
	},
	{
		type: "FACE",
		label: "Face"
	},
	{
		type: "DOORBELL",
		label: "Doorbell"
	},
	{
		type: "PACKAGE",
		label: "Package"
	},
	{
		type: "FORGOTTEN_ITEM",
		label: "Item left"
	},
	{
		type: "TAKEN_ITEM",
		label: "Item taken"
	},
	{
		type: "CRYING",
		label: "Crying"
	},
	{
		type: "IO",
		label: "Alarm input"
	},
	{
		type: "MOTION",
		label: "Motion"
	},
	{
		type: "TIMER",
		label: "Scheduled"
	}
], W = new Map(U.map((e, t) => [e.type, t]));
function we(e) {
	let t;
	for (let n of e) (t === void 0 || (W.get(n) ?? 99) < (W.get(t) ?? 99)) && (t = n);
	return t ?? "MOTION";
}
function G(e) {
	return U[W.get(e) ?? -1]?.label ?? e.toLowerCase();
}
function K(e) {
	return [...e].sort((e, t) => (W.get(e) ?? 99) - (W.get(t) ?? 99));
}
function q(e) {
	let t = e.filter((e) => e !== "MOTION");
	return K(t.length ? t : e.length ? e : ["MOTION"]);
}
function Te(e) {
	return K(new Set(e.flatMap((e) => q(e.types))));
}
function Ee(e) {
	return e >= 216e5 ? 300 : e >= 36e5 ? 60 : e >= 9e5 ? 10 : 5;
}
function De(e, t, n) {
	let r = new Date(Date.UTC(e, t - 1, 1)).getUTCDay(), i = new Date(Date.UTC(e, t, 0)).getUTCDate(), a = (r - n % 7 + 7) % 7, o = [...Array.from({ length: a }, () => null), ...Array.from({ length: i }, (e, t) => t + 1)];
	for (; o.length % 7;) o.push(null);
	let s = [];
	for (let e = 0; e < o.length; e += 7) s.push(o.slice(e, e + 7));
	return s;
}
function Oe(e, t, n) {
	let r = e * 12 + (t - 1) + n;
	return [Math.floor(r / 12), r % 12 + 1];
}
function ke(e, t, n) {
	return `${String(e).padStart(4, "0")}-${String(t).padStart(2, "0")}-${String(n).padStart(2, "0")}`;
}
var Ae = 12e4, je = 3600, Me = 10, Ne = "rv-timetable-feed", Pe = class extends r {
	static properties = {
		hass: { attribute: !1 },
		cameras: { attribute: !1 },
		date: { attribute: !1 },
		heading: { attribute: !1 },
		limit: { attribute: !1 },
		cameraFilter: { attribute: !1 },
		typeFilter: { attribute: !1 },
		filters: { attribute: !1 },
		_feed: { state: !0 },
		_pick: { state: !0 },
		_error: { state: !0 },
		_all: { state: !0 },
		_thumbs: { state: !0 },
		_now: { state: !0 }
	};
	_seq = 0;
	_refresh;
	_clock;
	_thumbsAsked = /* @__PURE__ */ new Set();
	_newestBefore;
	constructor() {
		super(), this.cameras = [], this.heading = "Today", this.limit = 8, this.cameraFilter = /* @__PURE__ */ new Set(), this.typeFilter = /* @__PURE__ */ new Set(), this.filters = !1, this._pick = /* @__PURE__ */ new Set(), this._all = !1, this._thumbs = /* @__PURE__ */ new Map(), this._now = Date.now();
	}
	connectedCallback() {
		super.connectedCallback(), document.addEventListener("visibilitychange", this._onVisibility), this._refresh = setInterval(() => {
			document.visibilityState !== "hidden" && this._isToday && this._load(!0);
		}, Ae), this._tick();
	}
	disconnectedCallback() {
		super.disconnectedCallback(), document.removeEventListener("visibilitychange", this._onVisibility), clearInterval(this._refresh), clearTimeout(this._clock);
	}
	_onVisibility = () => {
		document.visibilityState !== "hidden" && this._feed && this._isToday && this._load(!0);
	};
	_tick() {
		this._now = Date.now(), clearTimeout(this._clock), this._clock = setTimeout(() => {
			this._tick();
		}, 6e4 - this._now % 6e4 + 50);
	}
	get _isToday() {
		return this.date === void 0 || this.date === u(this._now, this.hass?.config?.time_zone);
	}
	willUpdate(e) {
		e.has("date") && e.get("date") !== void 0 && (this._feed = void 0, this._error = void 0, this._all = !1, this._newestBefore = void 0);
	}
	updated(e) {
		let t = e.has("hass") && this.hass && !this._feed && this._seq === 0, n = e.has("date") && e.get("date") !== void 0;
		(t || n) && this._load(!1).then(() => this._isToday ? this._load(!0) : void 0), (e.has("cameraFilter") || e.has("typeFilter") || e.has("_pick")) && this._loadThumbs();
	}
	async _load(e) {
		let t = this.hass;
		if (!t) return;
		let n = ++this._seq, r = this.date;
		try {
			let i = await ne(t, {
				...r === void 0 ? {} : { date: r },
				...e ? { background: e } : { maxAge: je }
			});
			if (n !== this._seq || r !== this.date) return;
			this._newestBefore = e ? this._feed?.events[0]?.start : void 0, this._feed = i, this._error = void 0, this.dispatchEvent(new CustomEvent(Ne, { detail: { feed: i } })), this._loadThumbs();
		} catch (e) {
			n === this._seq && (this._error = h(e).message);
		}
	}
	get _matching() {
		let e = this.cameraFilter.size ? this.cameraFilter : this._pick, t = this.typeFilter;
		return (this._feed?.events ?? []).filter((n) => (!e.size || e.has(n.camera_id)) && (!t.size || q(n.types).some((e) => t.has(e))));
	}
	get _shown() {
		let e = this._matching;
		return this._all ? e : e.slice(0, this.limit);
	}
	async _loadThumbs() {
		let e = this.hass;
		if (!e) return;
		let t = /* @__PURE__ */ new Map();
		for (let e of this._shown) {
			let n = J(e);
			this._thumbsAsked.has(n) || (this._thumbsAsked.add(n), t.set(e.camera_id, [...t.get(e.camera_id) ?? [], e.start]));
		}
		await Promise.all([...t].map(async ([t, n]) => {
			try {
				let { urls: r } = await d(e, t, n, Me), i = new Map(this._thumbs);
				r.forEach((e, r) => i.set(`${t}:${String(n[r] ?? e.time)}`, e.url)), this._thumbs = i;
			} catch {}
		}));
	}
	_open(e) {
		let t = this.hass;
		t && e.new && (this._markOpened(e), f(t, e.camera_id, e.start).catch(() => void 0)), E(this, {
			view: "device",
			id: e.camera_id,
			tab: "playback",
			at: e.start
		});
	}
	_markOpened(e) {
		let t = this._feed;
		t && (this._feed = {
			...t,
			events: t.events.map((t) => t === e ? {
				...t,
				new: !1
			} : t)
		});
	}
	async _allSeen() {
		let e = this.hass, t = this._feed;
		if (e && t) {
			this._feed = {
				...t,
				events: t.events.map((e) => ({
					...e,
					new: !1
				}))
			};
			try {
				await ee(e);
			} catch (e) {
				this._error = h(e).message;
			}
		}
	}
	render() {
		let e = this._feed, r = this._matching, i = this.hass?.config?.time_zone, o = new Set(r.map((e) => e.camera_id)).size, s = this.cameraFilter.size > 0 || this.typeFilter.size > 0 || this._pick.size > 0, c = this._isToday ? "today's" : "this day's";
		return n`<div class="head">
        ${this.heading ? n`<h2>${this.heading}</h2>` : t}
        ${e ? n`<p class="count">
              ${r.length ? `${String(r.length)} ${r.length === 1 ? "event" : "events"} on ${String(o)} ${o === 1 ? "camera" : "cameras"}` : s ? "None match" : this._isToday ? "No events yet" : "No events"}
            </p>` : t}
        ${(e?.events ?? []).some((e) => e.new) ? n`<button class="text all-seen" @click=${() => void this._allSeen()}>Mark all seen</button>` : t}
        ${this.filters ? n`<button class="text with-icon all-events" @click=${() => {
			E(this, { view: "events" });
		}}>All events${a("chevron")}</button>` : t}
      </div>
      ${this.filters && e ? this._renderPick(e) : t}
      ${this._error ? S(_(this._error, this._isToday ? "Today's events" : "This day's events"), this._error, {
			action: n`<button @click=${() => void this._load(!1)}>Try again</button>`,
			help: "loading"
		}) : t}
      ${e ? this._renderTable(e, i) : this._error ? t : n`<p class="muted">Reading ${c} events…</p>`}`;
	}
	_renderPick(e) {
		let r = new Set(e.events.map((e) => e.camera_id)), i = this.cameras.filter((e) => r.has(e.id) || this._pick.has(e.id));
		return i.length < 2 ? t : n`<div class="pick" role="group" aria-label="Cameras">
      ${i.map((e) => n`<button
          class="chip"
          aria-pressed=${this._pick.has(e.id) ? "true" : "false"}
          @click=${() => {
			let t = new Set(this._pick);
			t.delete(e.id) || t.add(e.id), this._pick = t;
		}}
        >
          <span class="plat" aria-hidden="true">${e.number}</span>${e.name}
        </button>`)}
    </div>`;
	}
	_renderTable(e, r) {
		let i = this._matching, a = new Map(this.cameras.map((e) => [e.id, e])), o = i.length - this._shown.length, s = this._isToday, c = e.events.length ? "No events match these filters." : s ? "Nothing recorded an event since midnight." : "Nothing recorded an event on this day.";
		return n`<div class="cols" aria-hidden="true">
        <span>Time</span><span>Event</span><span>Camera</span><span class="right">Length</span><span></span>
      </div>
      ${s ? n`<div class="now"><b>${m(this._now, r)} now</b></div>` : t}
      ${i.length ? n`<ol class="rows">
            ${this._shown.map((e) => this._renderRow(e, a.get(e.camera_id), r))}
          </ol>` : n`<p class="muted empty">${c}</p>`}
      ${o > 0 ? n`<button
            class="text more"
            @click=${() => {
			this._all = !0, this.updateComplete.then(() => this._loadThumbs());
		}}
          >
            Show all ${i.length} events
          </button>` : t}
      ${e.failed.length ? n`<p class="failed">
            ${Fe(e.failed.map((e) => a.get(e.camera_id)?.name ?? "A camera"), s)}
          </p>` : t}`;
	}
	_renderRow(e, r, i) {
		let o = X(e.types), s = m(e.start, i), c = r?.name ?? "Camera", l = this._thumbs.get(J(e)), u = this._newestBefore !== void 0 && e.start > this._newestBefore;
		return n`<li class=${u ? "arrived" : ""}>
      <button
        class="row ${e.new ? "new" : ""}"
        @click=${() => {
			this._open(e);
		}}
      >
        <span class="t">${s}</span>
        <span class="ev">
          ${a(Z(e.types))}<span>${o}</span>${e.new ? n`<span class="tag">New</span>` : t}
        </span>
        <span class="cam">${Y(r)}<span class="name">${c}</span></span>
        <span class="len">${Q(e.end - e.start)}</span>
        <span class="thumb">${l ? n`<img src=${l} alt="" loading="lazy" />` : t}</span>
        <span class="meta">${Y(r)}${c} · ${Q(e.end - e.start)}</span>
      </button>
    </li>`;
	}
	static styles = [c, e`
      :host {
        display: block;
        padding: 18px 24px 40px;
        container-type: inline-size;
      }
      .head {
        display: flex;
        align-items: baseline;
        gap: 14px;
        margin-bottom: 12px;
      }
      h2 {
        margin: 0;
        font-size: 26px;
      }
      .count {
        margin: 0;
        color: var(--rv-muted);
        font-size: 15px;
      }
      .all-seen {
        margin-left: auto;
      }
      .all-events {
        gap: 2px;
        padding-right: 0;
      }
      .all-seen + .all-events {
        margin-left: 8px;
      }
      .count + .all-events {
        margin-left: auto;
      }
      .all-events svg {
        width: 18px;
        height: 18px;
      }
      .pick {
        display: flex;
        gap: 6px;
        margin: -2px 0 14px;
        overflow-x: auto;
        scrollbar-width: none;
      }
      .chip {
        flex: none;
        display: inline-flex;
        align-items: center;
        gap: 7px;
        min-height: 34px;
        padding: 0 12px 0 5px;
        border: 1px solid var(--rv-rule);
        font-size: 15px;
        font-weight: 500;
        white-space: nowrap;
      }
      .chip .plat {
        min-width: 22px;
        height: 22px;
        font-size: 14px;
      }
      .chip[aria-pressed="true"] {
        background: var(--rv-text);
        border-color: var(--rv-text);
        color: var(--rv-ground);
      }
      .chip[aria-pressed="true"]:hover {
        background: var(--rv-text);
      }
      .cols,
      .row {
        display: grid;
        grid-template-columns: 96px minmax(0, 1.3fr) minmax(0, 1fr) 80px 104px;
        column-gap: 20px;
        align-items: center;
      }
      .cols {
        padding: 0 8px 6px;
        border-bottom: 1px solid var(--rv-rule-strong);
        color: var(--rv-muted);
        font-size: 13px;
        font-weight: 500;
      }
      .right {
        text-align: right;
      }
      .now {
        display: flex;
        align-items: center;
        gap: 12px;
        height: 30px;
        color: var(--rv-red);
      }
      .now b {
        font-family: var(--rv-font-cond);
        font-size: 15px;
        font-weight: 600;
      }
      .now::after {
        content: "";
        flex: 1;
        height: 2px;
        background: var(--rv-red);
      }
      ol {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      li {
        border-bottom: 1px solid var(--rv-rule);
      }
      .row {
        width: 100%;
        min-height: 62px;
        padding: 0 8px;
        border: none;
        border-radius: 0;
        background: transparent;
        color: inherit;
        text-align: left;
        font-weight: 400;
      }
      .row:hover:not(:disabled) {
        background: var(--rv-ground-2);
      }
      .row:focus-visible {
        outline-offset: -2px;
      }
      .t {
        font-family: var(--rv-font-cond);
        font-size: 32px;
        font-weight: 600;
        line-height: 1;
      }
      .new .t {
        color: var(--rv-red);
      }
      .ev {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
        font-size: 17px;
        font-weight: 500;
      }
      .ev svg {
        width: 22px;
        height: 22px;
        flex: none;
      }
      .tag {
        color: var(--rv-red);
        font-size: 13px;
        font-weight: 600;
      }
      .cam {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
        font-size: 16px;
      }
      .name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .plat {
        flex: none;
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
      .len {
        text-align: right;
        color: var(--rv-muted);
        font-size: 16px;
      }
      .thumb {
        width: 104px;
        height: 58px;
        background: var(--rv-ground-2);
        overflow: hidden;
      }
      .thumb img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .meta {
        display: none;
      }
      .arrived {
        animation: arrive 0.5s cubic-bezier(0.16, 1, 0.3, 1);
      }
      @keyframes arrive {
        from {
          opacity: 0;
          transform: translateY(-8px);
        }
      }
      .more {
        margin-top: 10px;
      }
      .empty {
        padding: 14px 8px;
      }
      .failed {
        margin: 12px 0 0;
        padding: 8px 12px;
        background: var(--rv-fault);
        color: var(--rv-on-fault);
        font-size: 14px;
      }
      @container (max-width: 640px) {
        h2 {
          font-size: 22px;
        }
        .cols {
          display: none;
        }
        .row {
          grid-template-columns: 58px minmax(0, 1fr) 84px;
          column-gap: 12px;
          padding: 8px 4px;
          grid-template-areas: "t ev thumb" "t meta thumb";
        }
        .t {
          grid-area: t;
          font-size: 24px;
        }
        .ev {
          grid-area: ev;
          font-size: 15px;
        }
        .ev svg {
          width: 18px;
          height: 18px;
        }
        .cam,
        .len {
          display: none;
        }
        .thumb {
          grid-area: thumb;
          width: 84px;
          height: 47px;
        }
        .meta {
          grid-area: meta;
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
          color: var(--rv-muted);
          font-size: 14px;
        }
        .meta .plat {
          min-width: 20px;
          height: 20px;
          font-size: 13px;
        }
      }
      @media (max-width: 600px) {
        :host {
          padding: 14px 12px 32px;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .arrived {
          animation: none;
        }
      }
    `];
};
function Fe(e, t) {
	return `${e.join(", ")}: ${t ? "today's" : "this day's"} recordings could not be searched, so some events may be missing.`;
}
function J(e) {
	return `${e.camera_id}:${String(e.start)}`;
}
function Y(e) {
	return e ? n`<span class="plat" aria-hidden="true">${e.number}</span>` : t;
}
function X(e) {
	return q(e).map(G).join(" · ");
}
function Z(e) {
	if (e.includes("DOORBELL")) return "visitor";
	switch (we(e)) {
		case "PERSON":
		case "FACE": return "person";
		case "VEHICLE": return "vehicle";
		case "ANIMAL": return "animal";
		case "PACKAGE":
		case "FORGOTTEN_ITEM":
		case "TAKEN_ITEM": return "package";
		default: return "motion";
	}
}
function Q(e) {
	let t = Math.max(0, Math.round(e / 1e3)), n = Math.floor(t / 3600), r = Math.floor(t % 3600 / 60), i = String(t % 60).padStart(2, "0");
	return n ? `${String(n)}:${String(r).padStart(2, "0")}:${i}` : `${String(r)}:${i}`;
}
customElements.get("rv-timetable") || customElements.define("rv-timetable", Pe);
//#endregion
//#region src/download.ts
function Ie(e, t, n = document) {
	let r = new Blob([JSON.stringify(e, null, 2)], { type: "application/json" }), i = URL.createObjectURL(r), a = n.createElement("a");
	a.href = i, a.download = t, a.rel = "noopener", n.body.appendChild(a), a.click(), a.remove(), setTimeout(() => {
		URL.revokeObjectURL(i);
	}, 1e3);
}
//#endregion
//#region src/format.ts
var Le = {
	camera: "Camera",
	nvr: "NVR",
	hub: "Home Hub"
}, Re = (e) => Le[e];
function ze(e) {
	let t = [];
	return e.codec && t.push(Be(e.codec)), e.width && e.height && t.push(`${e.width}×${e.height}`), e.frame_rate && t.push(`${e.frame_rate} fps`), e.bit_rate && t.push(`${e.bit_rate} kbps`), t.length ? t.join(" · ") : "unknown";
}
function Be(e) {
	switch (e.toLowerCase()) {
		case "h264": return "H.264";
		case "h265":
		case "hevc": return "H.265";
		default: return e;
	}
}
function Ve(e) {
	return e === null ? "unknown" : e ? "on" : "off";
}
function He(e) {
	return `reolink-viewer-probe-${e.toISOString().slice(0, 19).replace(/:/g, "-")}.json`;
}
function Ue(e) {
	return e.via === "nvr" ? `Through ${e.host_name ?? e.entry_title}` : "Added directly";
}
//#endregion
//#region src/views.ts
var We = {
	events: () => import("./events-view-jJ1Rgo9L.js"),
	list: () => import("./device-list-B3_WdSJ1.js"),
	device: () => import("./device-page-BnDpTWkF.js"),
	"live-check": () => import("./live-check-Ck9C7sM6.js"),
	soak: () => import("./live-soak-CcbEmr1s.js")
}, $ = /* @__PURE__ */ new Map();
function Ge(e) {
	let t = We[e];
	if (!t) return Promise.resolve();
	let n = $.get(e);
	return n || (n = t().catch((t) => {
		throw $.delete(e), t;
	}), $.set(e, n)), n;
}
//#endregion
export { V as A, le as B, Te as C, K as D, q as E, z as F, x as G, se as H, O as I, v as J, b as K, w as L, I as M, G as N, he as O, L as P, T as R, be as S, H as T, C as U, ce as V, S as W, re as X, _ as Y, R as _, Ve as a, De as b, X as c, P as d, M as f, ge as g, ve as h, ze as i, _e as j, Ee as k, Q as l, Oe as m, Ue as n, He as o, F as p, y as q, Re as r, Ie as s, Ge as t, Z as u, xe as v, Ce as w, Se as x, ke as y, E as z };

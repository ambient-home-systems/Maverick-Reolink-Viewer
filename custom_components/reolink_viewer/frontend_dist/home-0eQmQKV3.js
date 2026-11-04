import { a as e, n as t, r as n, t as r } from "./lit-DdRjbP0M.js";
import { A as i, Dt as a, F as o, I as s, L as c, N as l, P as u, R as d, Y as f, c as ee, ht as te, mt as ne, u as p, vt as re, yt as ie } from "./live-DWqtt9-p.js";
//#region src/integration.ts
function ae(e) {
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
		technical: oe(e.compat)
	};
}
function oe(e) {
	return [...e.errors, ...e.reolink_aio_version ? [`reolink-aio ${e.reolink_aio_version}`] : []].join("\n");
}
function m(e, t) {
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
//#region src/version.ts
var h = "0.47.4", se = "https://github.com/ambient-home-systems/Maverick-Reolink-Viewer", ce = {
	guide: ["user-guide"],
	troubleshooting: ["troubleshooting"],
	cameras: ["cameras"],
	changed: ["troubleshooting", "reolink-viewer-needs-an-update"],
	stopped: ["troubleshooting", "the-reolink-integration-is-not-running"],
	none: ["troubleshooting", "no-reolink-devices-yet"],
	loading: ["troubleshooting", "a-page-could-not-load"],
	recordings: ["troubleshooting", "recordings-and-events"]
};
function g(e) {
	let [t, n] = ce[e];
	return `${se}/blob/v${h}/docs/${t}.md${n ? `#${n}` : ""}`;
}
//#endregion
//#region src/problem.ts
function _(e, r, i = {}) {
	return n`<div class="banner ${i.kind ?? "error"} problem" role="alert">
    <strong>${e.text}</strong>${e.advice ? n` ${e.advice}` : t}
    ${i.action ?? t} ${i.help ? v(i.help) : t}
    ${r ? n`<details>
          <summary>Details</summary>
          <span class="technical">${r}</span>
        </details>` : t}
  </div>`;
}
function v(e, t = "More help") {
	return n`<a class="help-link" href=${g(e)} target="_blank" rel="noopener noreferrer"
    >${t}${f("external")}</a
  >`;
}
//#endregion
//#region src/components/navigation.ts
var y = "rv-navigate", b = "rv-toast";
function x(e, t) {
	e.dispatchEvent(new CustomEvent(y, {
		detail: t,
		bubbles: !0,
		composed: !0
	}));
}
function S(e, t, n = "info") {
	e.dispatchEvent(new CustomEvent(b, {
		detail: {
			message: t,
			kind: n
		},
		bubbles: !0,
		composed: !0
	}));
}
function C(e) {
	if (e.view === "live-check") return "#live-check";
	if (e.view === "soak") return "#soak";
	if (e.view === "cards") return "#cards";
	if (e.view === "list") return "#devices";
	if (e.view === "events") return e.date ? `#events/${e.date}` : "#events";
	if (e.view === "live") return "";
	let t = e.tab === "playback" && e.at !== void 0 ? `/${e.at}` : "";
	return `#device/${encodeURIComponent(e.id)}/${e.tab}${t}`;
}
function le(e) {
	if (e === "#live-check") return { view: "live-check" };
	if (e === "#soak") return { view: "soak" };
	if (e === "#cards") return { view: "cards" };
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
var w = 8, ue = "rv-board", de = class extends r {
	static properties = {
		hass: { attribute: !1 },
		_full: { state: !0 },
		_boardFull: { state: !0 },
		_width: { state: !0 },
		_live: { state: !0 }
	};
	_data = new u(this);
	_resize;
	_announced;
	constructor() {
		super(), this._boardFull = !1, this._width = 0, this._live = /* @__PURE__ */ new Set();
	}
	connectedCallback() {
		super.connectedCallback(), l.opened(() => this.hass, document.visibilityState !== "hidden"), document.addEventListener("visibilitychange", this._onVisibility), document.addEventListener("fullscreenchange", this._onFullscreen), typeof ResizeObserver < "u" && (this._resize = new ResizeObserver((e) => {
			let t = e.at(-1);
			t && Math.abs(t.contentRect.width - this._width) >= 1 && (this._width = t.contentRect.width);
		}), this._resize.observe(this)), this._flush();
	}
	disconnectedCallback() {
		super.disconnectedCallback(), document.removeEventListener("visibilitychange", this._onVisibility), document.removeEventListener("fullscreenchange", this._onFullscreen), this._resize?.disconnect(), this._resize = void 0, l.closed(), this._flush();
	}
	_onFullscreen = () => {
		this._boardFull = document.fullscreenElement === this;
	};
	_toggleBoardFull() {
		document.fullscreenElement === this ? document.exitFullscreen().catch(() => void 0) : this.requestFullscreen().catch(() => void 0);
	}
	_onVisibility = () => {
		let e = document.visibilityState !== "hidden";
		l.visibility(e), e || this._flush();
	};
	_flush() {
		this.hass && l.flush(this.hass);
	}
	willUpdate() {
		this._data.hass = this.hass;
	}
	updated() {
		let e = this._data.cameras;
		if (e && e !== this._announced) {
			this._announced = e;
			let t = T(e);
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
              ${fe(r, this._live, r.filter((e) => d(this.hass, c(e)) !== void 0).length)}
            </p>` : t}
        ${i && r?.length ? n`<button class="text with-icon full" @click=${() => {
			this._toggleBoardFull();
		}}>
              ${f(this._boardFull ? "exitFull" : "enterFull")}${this._boardFull ? "Exit full screen" : "Full screen"}
            </button>` : t}
      </div>
      ${e.error ? _(m(e.error, "Live view"), e.error, {
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
		let t = this._data, r = E(e), i = r.map((e) => D(c(e))), a = i.reduce((e, t) => e + (t ? 2 : 1), 0), o = this._width, u = Math.max(2, Math.min(o >= 1100 ? 5 : o >= 800 ? 4 : o >= 540 ? 3 : 2, a)), d = o ? (o - (u - 1) * w) / u : 0, f = 9 / 16 * d;
		return n`<div
      class="grid"
      style=${`--cols: ${u}; --row: ${f ? `${f.toFixed(1)}px` : "auto"}`}
      @rv-live-open=${(e) => {
			x(this, {
				view: "device",
				id: e.detail.cameraId,
				tab: "live"
			});
		}}
      @rv-live-full=${(e) => {
			e.detail.full ? this._full = e.detail.cameraId : this._full === e.detail.cameraId && (this._full = void 0);
		}}
      @rv-live-count=${(e) => {
			l.count(e.detail.camera, e.detail.kind);
		}}
      @rv-live-state=${(e) => {
			let t = new Set(this._live);
			e.detail.live ? t.add(e.detail.cameraId) : t.delete(e.detail.cameraId), this._live = t;
		}}
    >
      ${r.map((e, r) => n`<rv-live-tile
            class=${i[r] ?? ""}
            fill
            .fit=${pe(c(e), i[r], d)}
            .number=${r + 1}
            .hass=${this.hass}
            .camera=${e}
            .connection=${c(e)}
            .image=${t.images[e.id]}
            .iceServers=${t.iceServers}
            .warm=${s(this.hass, e)}
            .suspended=${this._full !== void 0 && this._full !== e.id}
            .controls=${e.controls}
            openable
          ></rv-live-tile>`)}
    </div>`;
	}
	static styles = [i, e`
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
        gap: ${w}px;
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
function T(e) {
	return E(e).map((e, t) => ({
		id: e.id,
		name: e.name,
		number: t + 1
	}));
}
function E(e) {
	let t = e.filter((e) => D(c(e)) === "tall");
	return [...t, ...e.filter((e) => !t.includes(e))];
}
function pe(e, t, n) {
	let r = O(e);
	if (!r) return "cover";
	let i = n ? w / n : 0, a = 9 / 16;
	return r > (t === "tall" ? 1 / (2 * a + i) : t === "wide" ? (2 + i) / a : 1 / a) * 1.02 ? "contain" : "cover";
}
function D(e) {
	let t = O(e);
	if (t) {
		if (t < 1.2) return "tall";
		if (t > 2.4) return "wide";
	}
}
function O(e) {
	let t = e?.streams.sub?.encoding, n = t?.width, r = t?.height;
	return n && r ? n / r : void 0;
}
var me = class extends r {
	static properties = {
		hass: { attribute: !1 },
		deviceId: { attribute: !1 },
		_error: { state: !0 }
	};
	_data = new u(this);
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
		let t = o(e.cameras, this.deviceId);
		return t ? n`<div class="board">
        <rv-live-tile
          .hass=${this.hass}
          .camera=${t}
          .connection=${c(t)}
          .image=${e.images[t.id]}
          .iceServers=${e.iceServers}
          .warm=${s(this.hass, t)}
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
				this._error = a(e).message;
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
	static styles = [i, e`
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
var k = 6e4, A = 60 * k, j = 24 * A, M = [
	j,
	6 * A,
	A,
	15 * k,
	5 * k
];
function N(e, t, n) {
	return (e - t.start) / t.span * n;
}
function P(e, t, n) {
	return t.start + e / n * t.span;
}
function F(e, t) {
	let n = t.end - t.start, r = M[M.length - 1] ?? 6e4, i = Math.min(Math.max(e.span, r), Math.max(n, r));
	return i >= n ? {
		start: t.start,
		span: n
	} : {
		start: Math.min(Math.max(e.start, t.start), t.end - i),
		span: i
	};
}
function I(e, t, n, r) {
	return F({
		start: n - (n - e.start) / e.span * t,
		span: t
	}, r);
}
function L(e, t) {
	let n = e * .01;
	return t > 0 ? M.find((t) => t < e - n) : [...M].reverse().find((t) => t > e + n);
}
function R(e, t, n) {
	return F({
		start: t - e.span / 2,
		span: e.span
	}, n);
}
var z = [
	1e4,
	3e4,
	k,
	5 * k,
	10 * k,
	15 * k,
	30 * k,
	A,
	2 * A,
	3 * A,
	6 * A
];
function B(e, t, n = 60) {
	for (let r of z) if (r / e.span * t >= n) return r;
	return z[z.length - 1] ?? 36e5;
}
function he(e, t, n) {
	let r = B(e, t), i = [], a = e.start + e.span, o = n(e.start), s = Math.ceil((e.start + o) / r) * r - o;
	for (let e = 0; s <= a && e < 500; e += 1) i.push(s), s += r;
	return i;
}
function ge(e, t, n, r = 1) {
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
function V(e, t) {
	let n = 0, r = e.length - 1, i;
	for (; n <= r;) {
		let a = n + r >> 1, o = e.at(a);
		if (!o) break;
		o.start <= t ? (t < o.end && (i = o), n = a + 1) : r = a - 1;
	}
	return i;
}
function _e(e, t) {
	return e.find((e) => e.start > t);
}
function ve(e, t) {
	let n = V(e, t);
	if (n) return {
		segment: n,
		offset: t - n.start
	};
	let r = _e(e, t);
	return r ? {
		segment: r,
		offset: 0
	} : void 0;
}
function ye(e, t) {
	return t.size === 0 ? e : e.filter((e) => K(e.types).some((e) => t.has(e)));
}
function be(e, t) {
	return e.find((e) => e.start > t + 500);
}
function xe(e, t) {
	let n;
	for (let r of e) if (r.start < t - 1500) n = r;
	else break;
	return n;
}
var H = [
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
], U = new Map(H.map((e, t) => [e.type, t]));
function Se(e) {
	let t;
	for (let n of e) (t === void 0 || (U.get(n) ?? 99) < (U.get(t) ?? 99)) && (t = n);
	return t ?? "MOTION";
}
function W(e) {
	return H[U.get(e) ?? -1]?.label ?? e.toLowerCase();
}
function G(e) {
	return [...e].sort((e, t) => (U.get(e) ?? 99) - (U.get(t) ?? 99));
}
function K(e) {
	let t = e.filter((e) => e !== "MOTION");
	return G(t.length ? t : e.length ? e : ["MOTION"]);
}
function Ce(e) {
	return G(new Set(e.flatMap((e) => K(e.types))));
}
function we(e) {
	return e >= 216e5 ? 300 : e >= 36e5 ? 60 : e >= 9e5 ? 10 : 5;
}
function Te(e, t, n) {
	let r = new Date(Date.UTC(e, t - 1, 1)).getUTCDay(), i = new Date(Date.UTC(e, t, 0)).getUTCDate(), a = (r - n % 7 + 7) % 7, o = [...Array.from({ length: a }, () => null), ...Array.from({ length: i }, (e, t) => t + 1)];
	for (; o.length % 7;) o.push(null);
	let s = [];
	for (let e = 0; e < o.length; e += 7) s.push(o.slice(e, e + 7));
	return s;
}
function Ee(e, t, n) {
	let r = e * 12 + (t - 1) + n;
	return [Math.floor(r / 12), r % 12 + 1];
}
function De(e, t, n) {
	return `${String(e).padStart(4, "0")}-${String(t).padStart(2, "0")}-${String(n).padStart(2, "0")}`;
}
var Oe = 12e4, ke = 3600, Ae = 10, je = "rv-timetable-feed", Me = class extends r {
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
		}, Oe), this._tick();
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
		return this.date === void 0 || this.date === ee(this._now, this.hass?.config?.time_zone);
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
				...e ? { background: e } : { maxAge: ke }
			});
			if (n !== this._seq || r !== this.date) return;
			this._newestBefore = e ? this._feed?.events[0]?.start : void 0, this._feed = i, this._error = void 0, this.dispatchEvent(new CustomEvent(je, { detail: { feed: i } })), this._loadThumbs();
		} catch (e) {
			n === this._seq && (this._error = a(e).message);
		}
	}
	get _matching() {
		let e = this.cameraFilter.size ? this.cameraFilter : this._pick, t = this.typeFilter;
		return (this._feed?.events ?? []).filter((n) => (!e.size || e.has(n.camera_id)) && (!t.size || K(n.types).some((e) => t.has(e))));
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
			let n = q(e);
			this._thumbsAsked.has(n) || (this._thumbsAsked.add(n), t.set(e.camera_id, [...t.get(e.camera_id) ?? [], e.start]));
		}
		await Promise.all([...t].map(async ([t, n]) => {
			try {
				let { urls: r } = await te(e, t, n, Ae), i = new Map(this._thumbs);
				r.forEach((e, r) => i.set(`${t}:${String(n[r] ?? e.time)}`, e.url)), this._thumbs = i;
			} catch {}
		}));
	}
	_open(e) {
		let t = this.hass;
		t && e.new && (this._markOpened(e), ie(t, e.camera_id, e.start).catch(() => void 0)), x(this, {
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
				await re(e);
			} catch (e) {
				this._error = a(e).message;
			}
		}
	}
	render() {
		let e = this._feed, r = this._matching, i = this.hass?.config?.time_zone, a = new Set(r.map((e) => e.camera_id)).size, o = this.cameraFilter.size > 0 || this.typeFilter.size > 0 || this._pick.size > 0, s = this._isToday ? "today's" : "this day's";
		return n`<div class="head">
        ${this.heading ? n`<h2>${this.heading}</h2>` : t}
        ${e ? n`<p class="count">
              ${r.length ? `${String(r.length)} ${r.length === 1 ? "event" : "events"} on ${String(a)} ${a === 1 ? "camera" : "cameras"}` : o ? "None match" : this._isToday ? "No events yet" : "No events"}
            </p>` : t}
        ${(e?.events ?? []).some((e) => e.new) ? n`<button class="text all-seen" @click=${() => void this._allSeen()}>Mark all seen</button>` : t}
        ${this.filters ? n`<button class="text with-icon all-events" @click=${() => {
			x(this, { view: "events" });
		}}>All events${f("chevron")}</button>` : t}
      </div>
      ${this.filters && e ? this._renderPick(e) : t}
      ${this._error ? _(m(this._error, this._isToday ? "Today's events" : "This day's events"), this._error, {
			action: n`<button @click=${() => void this._load(!1)}>Try again</button>`,
			help: "loading"
		}) : t}
      ${e ? this._renderTable(e, i) : this._error ? t : n`<p class="muted">Reading ${s} events…</p>`}`;
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
      ${s ? n`<div class="now"><b>${p(this._now, r)} now</b></div>` : t}
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
            ${Ne(e.failed.map((e) => a.get(e.camera_id)?.name ?? "A camera"), s)}
          </p>` : t}`;
	}
	_renderRow(e, r, i) {
		let a = Y(e.types), o = p(e.start, i), s = r?.name ?? "Camera", c = this._thumbs.get(q(e)), l = this._newestBefore !== void 0 && e.start > this._newestBefore;
		return n`<li class=${l ? "arrived" : ""}>
      <button
        class="row ${e.new ? "new" : ""}"
        @click=${() => {
			this._open(e);
		}}
      >
        <span class="t">${o}</span>
        <span class="ev">
          ${f(X(e.types))}<span>${a}</span>${e.new ? n`<span class="tag">New</span>` : t}
        </span>
        <span class="cam">${J(r)}<span class="name">${s}</span></span>
        <span class="len">${Z(e.end - e.start)}</span>
        <span class="thumb">${c ? n`<img src=${c} alt="" loading="lazy" />` : t}</span>
        <span class="meta">${J(r)}${s} · ${Z(e.end - e.start)}</span>
      </button>
    </li>`;
	}
	static styles = [i, e`
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
function Ne(e, t) {
	return `${e.join(", ")}: ${t ? "today's" : "this day's"} recordings could not be searched, so some events may be missing.`;
}
function q(e) {
	return `${e.camera_id}:${String(e.start)}`;
}
function J(e) {
	return e ? n`<span class="plat" aria-hidden="true">${e.number}</span>` : t;
}
function Y(e) {
	return K(e).map(W).join(" · ");
}
function X(e) {
	if (e.includes("DOORBELL")) return "visitor";
	switch (Se(e)) {
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
function Z(e) {
	let t = Math.max(0, Math.round(e / 1e3)), n = Math.floor(t / 3600), r = Math.floor(t % 3600 / 60), i = String(t % 60).padStart(2, "0");
	return n ? `${String(n)}:${String(r).padStart(2, "0")}:${i}` : `${String(r)}:${i}`;
}
customElements.get("rv-timetable") || customElements.define("rv-timetable", Me);
//#endregion
//#region src/download.ts
function Pe(e, t, n = document) {
	let r = new Blob([JSON.stringify(e, null, 2)], { type: "application/json" }), i = URL.createObjectURL(r), a = n.createElement("a");
	a.href = i, a.download = t, a.rel = "noopener", n.body.appendChild(a), a.click(), a.remove(), setTimeout(() => {
		URL.revokeObjectURL(i);
	}, 1e3);
}
//#endregion
//#region src/format.ts
var Fe = {
	camera: "Camera",
	nvr: "NVR",
	hub: "Home Hub"
}, Ie = (e) => Fe[e];
function Le(e) {
	let t = [];
	return e.codec && t.push(Re(e.codec)), e.width && e.height && t.push(`${e.width}×${e.height}`), e.frame_rate && t.push(`${e.frame_rate} fps`), e.bit_rate && t.push(`${e.bit_rate} kbps`), t.length ? t.join(" · ") : "unknown";
}
function Re(e) {
	switch (e.toLowerCase()) {
		case "h264": return "H.264";
		case "h265":
		case "hevc": return "H.265";
		default: return e;
	}
}
function Q(e) {
	return e === null ? "unknown" : e ? "on" : "off";
}
function ze(e) {
	return `reolink-viewer-probe-${e.toISOString().slice(0, 19).replace(/:/g, "-")}.json`;
}
function Be(e) {
	return e.via === "nvr" ? `Through ${e.host_name ?? e.entry_title}` : "Added directly";
}
//#endregion
//#region src/views.ts
var Ve = {
	events: () => import("./events-view-ByiN7aU0.js"),
	list: () => import("./device-list-DSq8m5eq.js"),
	device: () => import("./device-page-CyI3McNC.js"),
	"live-check": () => import("./live-check-BGXpfMWA.js"),
	soak: () => import("./live-soak-BRkTzZ6T.js"),
	cards: () => import("./card-report-MGyAfowA.js")
}, $ = /* @__PURE__ */ new Map();
function He(e) {
	let t = Ve[e];
	if (!t) return Promise.resolve();
	let n = $.get(e);
	return n || (n = t().catch((t) => {
		throw $.delete(e), t;
	}), $.set(e, n)), n;
}
//#endregion
export { B as A, le as B, Ce as C, G as D, K as E, I as F, g as G, S as H, T as I, ae as J, h as K, y as L, N as M, W as N, L as O, P, b as R, ve as S, V as T, v as U, C as V, _ as W, F as _, Q as a, Te as b, Y as c, j as d, k as f, R as g, ge as h, Le as i, he as j, we as k, Z as l, Ee as m, Be as n, ze as o, M as p, m as q, Ie as r, Pe as s, He as t, X as u, ye as v, xe as w, be as x, De as y, x as z };

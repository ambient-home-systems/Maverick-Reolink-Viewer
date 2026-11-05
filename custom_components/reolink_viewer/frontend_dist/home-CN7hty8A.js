import { a as e, n as t, r as n, t as r } from "./lit-DdRjbP0M.js";
import { Ct as i, F as a, I as o, L as s, Nt as c, P as l, R as u, X as d, _t as f, c as p, d as m, j as h, l as ee, vt as te, wt as ne, xt as re, z as ie } from "./live-Ck1mNv_c.js";
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
function g(e, t) {
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
var _ = "0.54.0", se = "https://github.com/ambient-home-systems/Maverick-Reolink-Viewer", ce = {
	guide: ["user-guide"],
	troubleshooting: ["troubleshooting"],
	cameras: ["cameras"],
	changed: ["troubleshooting", "reolink-viewer-needs-an-update"],
	stopped: ["troubleshooting", "the-reolink-integration-is-not-running"],
	none: ["troubleshooting", "no-reolink-devices-yet"],
	loading: ["troubleshooting", "a-page-could-not-load"],
	recordings: ["troubleshooting", "recordings-and-events"]
};
function v(e) {
	let [t, n] = ce[e];
	return `${se}/blob/v${_}/docs/${t}.md${n ? `#${n}` : ""}`;
}
//#endregion
//#region src/problem.ts
function y(e, r, i = {}) {
	return n`<div class="banner ${i.kind ?? "error"} problem" role="alert">
    <strong>${e.text}</strong>${e.advice ? n` ${e.advice}` : t}
    ${i.action ?? t} ${i.help ? b(i.help) : t}
    ${r ? n`<details>
          <summary>Details</summary>
          <span class="technical">${r}</span>
        </details>` : t}
  </div>`;
}
function b(e, t = "More help") {
	return n`<a class="help-link" href=${v(e)} target="_blank" rel="noopener noreferrer"
    >${t}${d("external")}</a
  >`;
}
//#endregion
//#region src/wall/remember.ts
var x = "rv-live-mode", le = "rv-wall-layout";
function S(e) {
	try {
		return window.localStorage.getItem(e);
	} catch {
		return null;
	}
}
function C(e, t) {
	try {
		t === void 0 ? window.localStorage.removeItem(e) : window.localStorage.setItem(e, t);
	} catch {}
}
function ue() {
	return S(x) === "wall" ? "wall" : "board";
}
function w(e) {
	C(x, e);
}
function de() {
	return S(le) ?? void 0;
}
function fe(e) {
	C(le, e);
}
//#endregion
//#region src/components/navigation.ts
var T = "rv-navigate", E = "rv-toast";
function D(e, t) {
	e.dispatchEvent(new CustomEvent(T, {
		detail: t,
		bubbles: !0,
		composed: !0
	}));
}
function pe(e, t, n = "info") {
	e.dispatchEvent(new CustomEvent(E, {
		detail: {
			message: t,
			kind: n
		},
		bubbles: !0,
		composed: !0
	}));
}
function me(e) {
	if (e.view === "live-check") return "#live-check";
	if (e.view === "soak") return "#soak";
	if (e.view === "cards") return "#cards";
	if (e.view === "wall") return e.layout ? `#wall/${encodeURIComponent(e.layout)}` : "#wall";
	if (e.view === "list") return "#devices";
	if (e.view === "events") return e.date ? `#events/${e.date}` : "#events";
	if (e.view === "live") return "";
	let t = e.tab === "playback" && e.at !== void 0 ? `/${e.at}` : "";
	return `#device/${encodeURIComponent(e.id)}/${e.tab}${t}`;
}
function he(e) {
	if (e === "#live-check") return { view: "live-check" };
	if (e === "#soak") return { view: "soak" };
	if (e === "#cards") return { view: "cards" };
	if (e === "#wall") return { view: "wall" };
	let t = /^#wall\/([^/]+)$/.exec(e);
	if (t?.[1]) return {
		view: "wall",
		layout: decodeURIComponent(t[1])
	};
	if (e === "#devices") return { view: "list" };
	if (e === "#events") return { view: "events" };
	let n = /^#events\/(\d{4}-\d{2}-\d{2})$/.exec(e);
	if (n?.[1]) return {
		view: "events",
		date: n[1]
	};
	let r = /^#device\/([^/]+)(?:\/(overview|live|settings|playback)(?:\/(\d+))?)?$/.exec(e);
	if (!r?.[1]) return { view: "live" };
	let i = r[2], a = decodeURIComponent(r[1]);
	return i === "playback" && r[3] ? {
		view: "device",
		id: a,
		tab: i,
		at: Number(r[3])
	} : {
		view: "device",
		id: a,
		tab: i === "live" || i === "settings" || i === "playback" ? i : "overview"
	};
}
//#endregion
//#region src/components/live-grid.ts
var O = 8, ge = "rv-board", _e = class extends r {
	static properties = {
		hass: { attribute: !1 },
		_full: { state: !0 },
		_boardFull: { state: !0 },
		_width: { state: !0 },
		_live: { state: !0 }
	};
	_data = new a(this);
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
			let t = k(e);
			this.dispatchEvent(new CustomEvent(ge, {
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
              ${ve(r, this._live, r.filter((e) => ie(this.hass, u(e)) !== void 0).length)}
            </p>` : t}
        ${r?.length ? n`<button
              class="text with-icon wall"
              @click=${() => {
			w("wall"), D(this, { view: "wall" });
		}}
            >
              ${d("enterFull")}Wall
            </button>` : t}
        ${i && r?.length ? n`<button class="text with-icon full" @click=${() => {
			this._toggleBoardFull();
		}}>
              ${d(this._boardFull ? "exitFull" : "enterFull")}${this._boardFull ? "Exit full screen" : "Full screen"}
            </button>` : t}
      </div>
      ${e.error ? y(g(e.error, "Live view"), e.error, {
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
		let t = this._data, r = A(e), i = r.map((e) => j(u(e))), a = i.reduce((e, t) => e + (t ? 2 : 1), 0), o = this._width, c = Math.max(2, Math.min(o >= 1100 ? 5 : o >= 800 ? 4 : o >= 540 ? 3 : 2, a)), d = o ? (o - (c - 1) * O) / c : 0, f = 9 / 16 * d;
		return n`<div
      class="grid"
      style=${`--cols: ${c}; --row: ${f ? `${f.toFixed(1)}px` : "auto"}`}
      @rv-live-open=${(e) => {
			D(this, {
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
            .fit=${ye(u(e), i[r], d)}
            .number=${r + 1}
            .hass=${this.hass}
            .camera=${e}
            .connection=${u(e)}
            .image=${t.images[e.id]}
            .iceServers=${t.iceServers}
            .warm=${s(this.hass, e)}
            .suspended=${this._full !== void 0 && this._full !== e.id}
            .controls=${e.controls}
            openable
          ></rv-live-tile>`)}
    </div>`;
	}
	static styles = [h, e`
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
      button.wall {
        margin-left: auto;
      }
      button.full,
      button.wall {
        color: var(--rv-on-board);
      }
      button.wall + button.full {
        margin-left: 0;
      }
      button.full:focus-visible,
      button.wall:focus-visible {
        outline-color: var(--rv-on-board);
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(var(--cols, 2), minmax(0, 1fr));
        grid-auto-rows: var(--row, auto);
        grid-auto-flow: dense;
        gap: ${O}px;
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
function ve(e, t, n = 0) {
	let r = e.filter((e) => t.has(e.id)).length, i = r ? `${String(r)} of ${String(e.length)} playing` : `${String(e.length)} ${e.length === 1 ? "camera" : "cameras"}`;
	return n ? `${i} · ${String(n)} offline` : i;
}
function k(e) {
	return A(e).map((e, t) => ({
		id: e.id,
		name: e.name,
		number: t + 1
	}));
}
function A(e) {
	let t = e.filter((e) => j(u(e)) === "tall");
	return [...t, ...e.filter((e) => !t.includes(e))];
}
function ye(e, t, n) {
	let r = M(e);
	if (!r) return "cover";
	let i = n ? O / n : 0, a = 9 / 16;
	return r > (t === "tall" ? 1 / (2 * a + i) : t === "wide" ? (2 + i) / a : 1 / a) * 1.02 ? "contain" : "cover";
}
function j(e) {
	let t = M(e);
	if (t) {
		if (t < 1.2) return "tall";
		if (t > 2.4) return "wide";
	}
}
function M(e) {
	let t = e?.streams.sub?.encoding, n = t?.width, r = t?.height;
	return n && r ? n / r : void 0;
}
var be = class extends r {
	static properties = {
		hass: { attribute: !1 },
		deviceId: { attribute: !1 },
		_error: { state: !0 }
	};
	_data = new a(this);
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
          .connection=${u(t)}
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
				this._error = c(e).message;
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
	static styles = [h, e`
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
customElements.get("rv-live-grid") || customElements.define("rv-live-grid", _e), customElements.get("rv-live-camera") || customElements.define("rv-live-camera", be);
//#endregion
//#region src/playback/timeline-math.ts
var N = 6e4, P = 60 * N, F = 24 * P, I = [
	F,
	6 * P,
	P,
	15 * N,
	5 * N
];
function xe(e, t, n) {
	return (e - t.start) / t.span * n;
}
function Se(e, t, n) {
	return t.start + e / n * t.span;
}
function L(e, t) {
	let n = t.end - t.start, r = I[I.length - 1] ?? 6e4, i = Math.min(Math.max(e.span, r), Math.max(n, r));
	return i >= n ? {
		start: t.start,
		span: n
	} : {
		start: Math.min(Math.max(e.start, t.start), t.end - i),
		span: i
	};
}
function Ce(e, t, n, r) {
	return L({
		start: n - (n - e.start) / e.span * t,
		span: t
	}, r);
}
function we(e, t) {
	let n = e * .01;
	return t > 0 ? I.find((t) => t < e - n) : [...I].reverse().find((t) => t > e + n);
}
function Te(e, t, n) {
	return L({
		start: t - e.span / 2,
		span: e.span
	}, n);
}
var R = [
	1e4,
	3e4,
	N,
	5 * N,
	10 * N,
	15 * N,
	30 * N,
	P,
	2 * P,
	3 * P,
	6 * P
];
function z(e, t, n = 60) {
	for (let r of R) if (r / e.span * t >= n) return r;
	return R[R.length - 1] ?? 36e5;
}
function Ee(e, t, n) {
	let r = z(e, t), i = [], a = e.start + e.span, o = n(e.start), s = Math.ceil((e.start + o) / r) * r - o;
	for (let e = 0; s <= a && e < 500; e += 1) i.push(s), s += r;
	return i;
}
function De(e, t, n, r = 1) {
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
function B(e, t) {
	let n = 0, r = e.length - 1, i;
	for (; n <= r;) {
		let a = n + r >> 1, o = e.at(a);
		if (!o) break;
		o.start <= t ? (t < o.end && (i = o), n = a + 1) : r = a - 1;
	}
	return i;
}
function Oe(e, t) {
	return e.find((e) => e.start > t);
}
function ke(e, t) {
	let n = B(e, t);
	if (n) return {
		segment: n,
		offset: t - n.start
	};
	let r = Oe(e, t);
	return r ? {
		segment: r,
		offset: 0
	} : void 0;
}
function Ae(e, t) {
	return t.size === 0 ? e : e.filter((e) => G(e.types).some((e) => t.has(e)));
}
function je(e, t) {
	return e.find((e) => e.start > t + 500);
}
function Me(e, t) {
	let n;
	for (let r of e) if (r.start < t - 1500) n = r;
	else break;
	return n;
}
var V = [
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
], H = new Map(V.map((e, t) => [e.type, t]));
function Ne(e) {
	let t;
	for (let n of e) (t === void 0 || (H.get(n) ?? 99) < (H.get(t) ?? 99)) && (t = n);
	return t ?? "MOTION";
}
function U(e) {
	return V[H.get(e) ?? -1]?.label ?? e.toLowerCase();
}
function W(e) {
	return [...e].sort((e, t) => (H.get(e) ?? 99) - (H.get(t) ?? 99));
}
function G(e) {
	let t = e.filter((e) => e !== "MOTION");
	return W(t.length ? t : e.length ? e : ["MOTION"]);
}
function Pe(e) {
	return W(new Set(e.flatMap((e) => G(e.types))));
}
function Fe(e) {
	return e >= 216e5 ? 300 : e >= 36e5 ? 60 : e >= 9e5 ? 10 : 5;
}
function Ie(e, t, n) {
	let r = new Date(Date.UTC(e, t - 1, 1)).getUTCDay(), i = new Date(Date.UTC(e, t, 0)).getUTCDate(), a = (r - n % 7 + 7) % 7, o = [...Array.from({ length: a }, () => null), ...Array.from({ length: i }, (e, t) => t + 1)];
	for (; o.length % 7;) o.push(null);
	let s = [];
	for (let e = 0; e < o.length; e += 7) s.push(o.slice(e, e + 7));
	return s;
}
function Le(e, t, n) {
	let r = e * 12 + (t - 1) + n;
	return [Math.floor(r / 12), r % 12 + 1];
}
function Re(e, t, n) {
	return `${String(e).padStart(4, "0")}-${String(t).padStart(2, "0")}-${String(n).padStart(2, "0")}`;
}
var ze = {
	person: "PERSON",
	vehicle: "VEHICLE",
	animal: "ANIMAL",
	doorbell: "DOORBELL",
	package: "PACKAGE",
	face: "FACE",
	crying: "CRYING",
	forgotten_item: "FORGOTTEN_ITEM",
	taken_item: "TAKEN_ITEM",
	motion: "MOTION"
};
function K(e) {
	return ze[e] ?? e.toUpperCase();
}
function q(e) {
	return `${e.camera_id}:${String(e.start)}`;
}
function Be(e, t, n, r) {
	let i = /* @__PURE__ */ new Map();
	for (let t of e) i.set(t.camera_id, [...i.get(t.camera_id) ?? [], t]);
	let a = /* @__PURE__ */ new Map(), o = [];
	for (let e of t) {
		let t = K(e.kind);
		for (let s of e.members ?? [{
			camera: e.camera,
			start: e.start,
			end: e.end
		}]) {
			let c = s.end ?? s.start, l = (i.get(s.camera) ?? []).filter((e) => e.start <= c + 3e4 && e.end >= s.start - 3e4), u = l.filter((e) => e.types.includes(t)), d = u.length ? u : l;
			if (d.length) for (let t of d) a.set(q(t), e);
			else if (s.start >= n && s.start < r) {
				let n = {
					camera_id: s.camera,
					start: s.start,
					end: Math.max(c, s.start),
					types: [t],
					segment: null,
					new: !1,
					journal: !0
				};
				o.push(n), a.set(q(n), e);
			}
		}
	}
	return {
		marks: a,
		journal: o
	};
}
var Ve = {
	kind: "What it was",
	clock: "Time of day",
	solar: "Light",
	duration: "How long",
	predecessor: "What came before",
	weekend: "Day"
};
function He(e) {
	return e.name === "signal" ? e.subject || "Signal" : Ve[e.name] ?? e.name;
}
function Ue(e) {
	let t = e.replace(/_/g, " ").trim();
	return t.charAt(0).toUpperCase() + t.slice(1);
}
function We(e) {
	if (e.name === "signal") return Ue(e.label);
	if (e.name !== "duration") return e.label;
	if (e.label === "open") return "Still going";
	if (e.label === "instant") return "An instant";
	let t = Number(e.label.replace(/^~/, "").replace(/s$/, ""));
	if (!Number.isFinite(t)) return e.label;
	if (t < 90) return `About ${String(t)} s`;
	let n = Math.round(t / 60);
	return n >= 2 ? `About ${String(n)} min` : "About a minute";
}
function Ge(e) {
	return e.contribution > .05 ? "rarer than chance" : e.contribution < -.05 ? "more usual" : "as by chance";
}
//#endregion
//#region src/components/unusual-reason.ts
var Ke = 4, qe = class extends r {
	static properties = { mark: { attribute: !1 } };
	render() {
		let e = this.mark;
		return e ? n`<p class="sentence">${e.reason}</p>
      <ul class="terms" aria-label="Each signal">
        ${e.terms.map((e) => {
			let t = Math.abs(e.contribution), r = t > .05 ? Math.min(1, t / Ke) * 50 : 0, i = e.contribution >= 0 ? "rarer" : "usual";
			return n`<li>
            <span class="name">${He(e)}</span>
            <span class="value">${We(e)}</span>
            <span class="way">${Ge(e)}</span>
            <span class="bar" aria-hidden="true">
              <span
                class="fill ${i}"
                style="width: ${r.toFixed(1)}%"
              ></span>
            </span>
          </li>`;
		})}
      </ul>` : t;
	}
	static styles = [h, e`
      :host {
        display: block;
      }
      .sentence {
        margin: 0 0 10px;
        font-size: 15px;
      }
      .terms {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        grid-template-columns:
          max-content minmax(0, max-content) max-content
          minmax(120px, 200px);
        justify-content: start;
        column-gap: 14px;
        row-gap: 6px;
        align-items: center;
        font-size: 14px;
      }
      li {
        display: contents;
      }
      .name {
        color: var(--rv-muted);
      }
      .value {
        overflow-wrap: anywhere;
      }
      .way {
        color: var(--rv-muted);
      }
      /* A centre line; a signal's bar grows right (rarer) or left (more usual). */
      .bar {
        position: relative;
        height: 10px;
        background: linear-gradient(
            var(--rv-rule-strong),
            var(--rv-rule-strong)
          )
          center / 1px 100% no-repeat;
      }
      .fill {
        position: absolute;
        top: 1px;
        bottom: 1px;
        background: var(--rv-text);
      }
      .fill.rarer {
        left: 50%;
        border-radius: 0 4px 4px 0;
      }
      .fill.usual {
        right: 50%;
        border-radius: 4px 0 0 4px;
        background: var(--rv-muted);
      }
      @container (max-width: 640px) {
        .terms {
          grid-template-columns: minmax(0, 1fr) minmax(80px, 120px);
          justify-content: stretch;
        }
        .name {
          grid-column: 1 / -1;
          margin-top: 4px;
        }
        .way {
          display: none;
        }
      }
    `];
};
customElements.get("rv-unusual-reason") || customElements.define("rv-unusual-reason", qe);
var Je = 12e4, Ye = 3600, Xe = 10, Ze = "rv-timetable-feed", Qe = "rv-timetable-marks", $e = class extends r {
	static properties = {
		hass: { attribute: !1 },
		cameras: { attribute: !1 },
		date: { attribute: !1 },
		heading: { attribute: !1 },
		limit: { attribute: !1 },
		cameraFilter: { attribute: !1 },
		typeFilter: { attribute: !1 },
		unusualOnly: { attribute: !1 },
		filters: { attribute: !1 },
		_feed: { state: !0 },
		_marks: { state: !0 },
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
		super(), this.cameras = [], this.heading = "Today", this.limit = 8, this.cameraFilter = /* @__PURE__ */ new Set(), this.typeFilter = /* @__PURE__ */ new Set(), this.unusualOnly = !1, this.filters = !1, this._pick = /* @__PURE__ */ new Set(), this._all = !1, this._thumbs = /* @__PURE__ */ new Map(), this._now = Date.now();
	}
	connectedCallback() {
		super.connectedCallback(), document.addEventListener("visibilitychange", this._onVisibility), this._refresh = setInterval(() => {
			document.visibilityState !== "hidden" && this._isToday && this._load(!0);
		}, Je), this._tick();
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
		return this.date === void 0 || this.date === p(this._now, this.hass?.config?.time_zone);
	}
	willUpdate(e) {
		e.has("date") && e.get("date") !== void 0 && (this._feed = void 0, this._marks = void 0, this._error = void 0, this._all = !1, this._newestBefore = void 0);
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
			let i = await f(t, {
				...r === void 0 ? {} : { date: r },
				...e ? { background: e } : { maxAge: Ye }
			});
			if (n !== this._seq || r !== this.date) return;
			this._newestBefore = e ? this._feed?.events[0]?.start : void 0, this._feed = i, this._error = void 0, this.dispatchEvent(new CustomEvent(Ze, { detail: { feed: i } })), this._loadMarks(t, i, n), this._loadThumbs();
		} catch (e) {
			n === this._seq && (this._error = c(e).message);
		}
	}
	async _loadMarks(e, t, n) {
		try {
			let r = e.config?.time_zone, [i, a] = ee(this.date ?? p(t.now, r), r), o = await re(e, i, a);
			if (n !== this._seq) return;
			this._marks = Be(t.events, o.marks, i, a), this.dispatchEvent(new CustomEvent(Qe, { detail: { marks: o } }));
		} catch {}
	}
	get _rows() {
		let e = this._feed?.events ?? [], t = this._marks?.journal ?? [];
		return t.length ? [...e, ...t].sort((e, t) => t.start - e.start) : e;
	}
	_markOf(e) {
		return this._marks?.marks.get(q(e));
	}
	get _matching() {
		let e = this.cameraFilter.size ? this.cameraFilter : this._pick, t = this.typeFilter;
		return this._rows.filter((n) => (!e.size || e.has(n.camera_id)) && (!t.size || G(n.types).some((e) => t.has(e))) && (!this.unusualOnly || this._markOf(n) !== void 0));
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
				let { urls: r } = await te(e, t, n, Xe), i = new Map(this._thumbs);
				r.forEach((e, r) => i.set(`${t}:${String(n[r] ?? e.time)}`, e.url)), this._thumbs = i;
			} catch {}
		}));
	}
	_open(e) {
		let t = this.hass;
		t && e.new && (this._markOpened(e), ne(t, e.camera_id, e.start).catch(() => void 0)), D(this, {
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
				await i(e);
			} catch (e) {
				this._error = c(e).message;
			}
		}
	}
	render() {
		let e = this._feed, r = this._matching, i = this.hass?.config?.time_zone, a = new Set(r.map((e) => e.camera_id)).size, o = this.cameraFilter.size > 0 || this.typeFilter.size > 0 || this._pick.size > 0 || this.unusualOnly, s = this._isToday ? "today's" : "this day's";
		return n`<div class="head">
        ${this.heading ? n`<h2>${this.heading}</h2>` : t}
        ${e ? n`<p class="count">
              ${r.length ? `${String(r.length)} ${r.length === 1 ? "event" : "events"} on ${String(a)} ${a === 1 ? "camera" : "cameras"}` : o ? "None match" : this._isToday ? "No events yet" : "No events"}
            </p>` : t}
        ${(e?.events ?? []).some((e) => e.new) ? n`<button
              class="text all-seen"
              @click=${() => void this._allSeen()}
            >
              Mark all seen
            </button>` : t}
        ${this.filters ? n`<button
              class="text with-icon all-events"
              @click=${() => {
			D(this, { view: "events" });
		}}
            >
              All events${d("chevron")}
            </button>` : t}
      </div>
      ${this.filters && e ? this._renderPick(e) : t}
      ${this._error ? y(g(this._error, this._isToday ? "Today's events" : "This day's events"), this._error, {
			action: n`<button @click=${() => void this._load(!1)}>
                Try again
              </button>`,
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
		let i = this._matching, a = new Map(this.cameras.map((e) => [e.id, e])), o = i.length - this._shown.length, s = this._isToday, c = this.unusualOnly && !this._rows.some((e) => this._markOf(e)) ? s ? "Nothing unusual today." : "Nothing unusual on this day." : e.events.length ? "No events match these filters." : s ? "Nothing recorded an event since midnight." : "Nothing recorded an event on this day.";
		return n`<div class="cols" aria-hidden="true">
        <span>Time</span><span>Event</span><span>Camera</span
        ><span class="right">Length</span><span></span>
      </div>
      ${s ? n`<div class="now">
            <b>${m(this._now, r)} now</b>
          </div>` : t}
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
            ${et(e.failed.map((e) => a.get(e.camera_id)?.name ?? "A camera"), s)}
          </p>` : t}`;
	}
	_renderRow(e, r, i) {
		let a = X(e.types), o = m(e.start, i), s = r?.name ?? "Camera", c = this._thumbs.get(J(e)), l = this._newestBefore !== void 0 && e.start > this._newestBefore, u = this._markOf(e);
		return n`<li class=${l ? "arrived" : ""}>
      <button
        class="row ${e.new ? "new" : ""}"
        @click=${() => {
			this._open(e);
		}}
      >
        <span class="t">${o}</span>
        <span class="ev">
          ${d(Z(e.types))}<span>${a}</span>${e.new ? n`<span class="tag">New</span>` : t}${u ? n`<span class="badge unusual">Unusual</span>` : t}
        </span>
        <span class="cam"
          >${Y(r)}<span class="name">${s}</span></span
        >
        <span class="len">${Q(e.end - e.start)}</span>
        <span class="thumb"
          >${c ? n`<img src=${c} alt="" loading="lazy" />` : t}</span
        >
        <span class="meta"
          >${Y(r)}${s} ·
          ${Q(e.end - e.start)}</span
        >
      </button>
      ${u ? n`<details class="why">
            <summary>Why it is unusual${d("chevronDown")}</summary>
            <rv-unusual-reason .mark=${u}></rv-unusual-reason>
            ${e.journal ? n`<p class="muted small">
                  Seen by Home Assistant's sensors; the camera's own events do
                  not list it.
                </p>` : t}
          </details>` : t}
    </li>`;
	}
	static styles = [h, e`
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
      .ev .badge {
        flex: none;
      }
      /* Why a row is unusual (Phase 8.3): a disclosure under it, in line with its event. */
      .why {
        padding: 0 8px 10px 124px;
      }
      .why > summary {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        min-height: 32px;
        color: var(--rv-action);
        font-size: 14px;
        font-weight: 500;
      }
      .why rv-unusual-reason {
        margin-top: 6px;
        max-width: 720px;
      }
      .why p {
        margin: 8px 0 0;
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
        .why {
          padding: 0 4px 10px 74px;
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
function et(e, t) {
	return `${e.join(", ")}: ${t ? "today's" : "this day's"} recordings could not be searched, so some events may be missing.`;
}
function J(e) {
	return `${e.camera_id}:${String(e.start)}`;
}
function Y(e) {
	return e ? n`<span class="plat" aria-hidden="true">${e.number}</span>` : t;
}
function X(e) {
	return G(e).map(U).join(" · ");
}
function Z(e) {
	if (e.includes("DOORBELL")) return "visitor";
	switch (Ne(e)) {
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
customElements.get("rv-timetable") || customElements.define("rv-timetable", $e);
//#endregion
//#region src/download.ts
function tt(e, t, n = document) {
	let r = new Blob([JSON.stringify(e, null, 2)], { type: "application/json" }), i = URL.createObjectURL(r), a = n.createElement("a");
	a.href = i, a.download = t, a.rel = "noopener", n.body.appendChild(a), a.click(), a.remove(), setTimeout(() => {
		URL.revokeObjectURL(i);
	}, 1e3);
}
//#endregion
//#region src/format.ts
var nt = {
	camera: "Camera",
	nvr: "NVR",
	hub: "Home Hub"
}, rt = (e) => nt[e];
function it(e) {
	let t = [];
	return e.codec && t.push(at(e.codec)), e.width && e.height && t.push(`${e.width}×${e.height}`), e.frame_rate && t.push(`${e.frame_rate} fps`), e.bit_rate && t.push(`${e.bit_rate} kbps`), t.length ? t.join(" · ") : "unknown";
}
function at(e) {
	switch (e.toLowerCase()) {
		case "h264": return "H.264";
		case "h265":
		case "hevc": return "H.265";
		default: return e;
	}
}
function ot(e) {
	return e === null ? "unknown" : e ? "on" : "off";
}
function st(e) {
	return `reolink-viewer-probe-${e.toISOString().slice(0, 19).replace(/:/g, "-")}.json`;
}
function ct(e) {
	return e.via === "nvr" ? `Through ${e.host_name ?? e.entry_title}` : "Added directly";
}
//#endregion
//#region src/views.ts
var lt = {
	events: () => import("./events-view-DLgFj5H1.js"),
	list: () => import("./device-list-D-BUr12o.js"),
	device: () => import("./device-page-CP5rQoA8.js"),
	"live-check": () => import("./live-check-DQ-z5TEZ.js"),
	soak: () => import("./live-soak-DaFFI93h.js"),
	cards: () => import("./card-report-DlVFQc0F.js"),
	wall: () => import("./wall-CaYhz7Dc.js")
}, $ = /* @__PURE__ */ new Map();
function ut(e) {
	let t = lt[e];
	if (!t) return Promise.resolve();
	let n = $.get(e);
	return n || (n = t().catch((t) => {
		throw $.delete(e), t;
	}), $.set(e, n)), n;
}
//#endregion
export { _ as $, Fe as A, T as B, ke as C, G as D, B as E, Se as F, pe as G, D as H, Ce as I, de as J, fe as K, k as L, Ee as M, xe as N, W as O, U as P, v as Q, A as R, je as S, Me as T, he as U, E as V, me as W, b as X, ue as Y, y as Z, Te as _, ot as a, Re as b, X as c, K as d, g as et, F as f, De as g, Le as h, it as i, z as j, we as k, Q as l, I as m, ct as n, st as o, N as p, w as q, rt as r, tt as s, ut as t, ae as tt, Z as u, L as v, Pe as w, Ie as x, Ae as y, j as z };

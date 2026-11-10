import { a as e, n as t, r as n, t as r } from "./lit-DdRjbP0M.js";
import { B as i, C as a, D as o, It as s, Lt as c, O as l, Ot as u, St as d, T as f, Z as p, _t as m, a as h, bt as g, c as _, d as v, gt as ee, i as y, j as b, kt as te, m as ne, n as re, o as ie, p as ae, r as oe, s as se, tt as x, u as ce, vt as S, w as le, xt as C } from "./live-D6mEGytR.js";
import { $ as w, D as ue, E as de, F as fe, I as pe, L as me, M as he, N as ge, O as T, P as _e, R as E, T as ve, b as D, c as ye, g as O, h as k, j as A, k as be, l as xe, m as Se, q as j, u as M, v as Ce, w as we, x as Te, y as N } from "./home-D2hbHRQT.js";
import { dayLabel as Ee, shortDay as De } from "./events-view-BEHh2z4J.js";
import { a as Oe, i as P, n as F, r as ke, s as Ae, t as je } from "./check-vnuvOAva.js";
import { i as Me } from "./findings-0DTL4xoa.js";
var Ne = class extends r {
	static properties = {
		events: { attribute: !1 },
		thumbs: { attribute: !1 },
		current: { attribute: !1 },
		playing: { attribute: !1 },
		timeZone: { attribute: !1 },
		_shown: { state: !0 }
	};
	constructor() {
		super(), this.events = [], this.thumbs = /* @__PURE__ */ new Map(), this.playing = !1, this._shown = 60;
	}
	get visible() {
		return [...this.events].reverse().slice(0, this._shown);
	}
	_activeAt(e) {
		if (e !== void 0) return this.events.find((t) => e >= t.start && e < t.end)?.start;
	}
	shouldUpdate(e) {
		if (e.size !== 1 || !e.has("current")) return !0;
		let t = e.get("current");
		return this._activeAt(t) !== this._activeAt(this.current);
	}
	updated() {
		let e = this.visible.filter((e) => !this.thumbs.has(e.start)).map((e) => e.start);
		e.length && this.dispatchEvent(new CustomEvent("rv-thumbs-needed", {
			detail: { times: e },
			bubbles: !0,
			composed: !0
		}));
	}
	_row(e) {
		let r = this.thumbs.get(e.start), i = this.current !== void 0 && this.current >= e.start && this.current < e.end, a = ye(e.types), o = v(e.start, this.timeZone, !0);
		return n`<li>
      <button
        class="row ${i ? "active" : ""}"
        aria-current=${i ? "true" : "false"}
        @click=${() => {
			this.dispatchEvent(new CustomEvent("rv-pick", {
				detail: { event: e },
				bubbles: !0,
				composed: !0
			}));
		}}
      >
        <span class="t">${o.slice(0, -3)}<small>${o.slice(-3)}</small></span>
        <span class="ev">
          ${p(M(e.types))}<span class="label">${a}</span>
        </span>
        <span class="meta">
          ${i ? n`<span class="tag">${this.playing ? "Playing" : "Selected"}</span>` : t}
          <span>${xe(e.end - e.start)}</span>
          ${e.ambiguous ? n`<span title="Recorded in the hour repeated when clocks went back">time ±1 h</span>` : t}
        </span>
        <span class="thumb">${r ? n`<img src=${r} alt="" loading="lazy" decoding="async" />` : t}</span>
      </button>
    </li>`;
	}
	render() {
		if (!this.events.length) return n`<p class="muted empty">No events for the chosen kinds.</p>`;
		let e = this.events.length - this._shown;
		return n`<ol>
        ${this.visible.map((e) => this._row(e))}
      </ol>
      ${e > 0 ? n`<button class="text more" @click=${() => {
			this._shown += 60;
		}}>Show ${Math.min(e, 60)} more (${e} left)</button>` : t}`;
	}
	static styles = [b, e`
      :host {
        display: block;
      }
      ol {
        list-style: none;
        margin: 0;
        padding: 0;
        border-top: 1px solid var(--rv-rule-strong);
      }
      li {
        border-bottom: 1px solid var(--rv-rule);
      }
      .row {
        display: grid;
        grid-template-columns: 70px minmax(0, 1fr) 84px;
        grid-template-areas: "t ev thumb" "t meta thumb";
        column-gap: 12px;
        align-items: center;
        width: 100%;
        min-height: 62px;
        padding: 7px 4px;
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
      .row.active {
        background: var(--rv-ground-2);
      }
      .t {
        grid-area: t;
        font-family: var(--rv-font-cond);
        font-size: 24px;
        font-weight: 600;
        line-height: 1;
        white-space: nowrap;
      }
      .t small {
        margin-left: 1px;
        color: var(--rv-muted);
        font-size: 14px;
        font-weight: 500;
      }
      .ev {
        grid-area: ev;
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        font-size: 15px;
        font-weight: 500;
      }
      .ev svg {
        flex: none;
        width: 18px;
        height: 18px;
      }
      .label {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .meta {
        grid-area: meta;
        display: flex;
        flex-wrap: wrap;
        gap: 0 10px;
        color: var(--rv-muted);
        font-size: 14px;
      }
      .tag {
        color: var(--rv-text);
        font-weight: 600;
      }
      .thumb {
        grid-area: thumb;
        width: 84px;
        height: 47px;
        background: var(--rv-ground-2);
        overflow: hidden;
      }
      .thumb img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .more {
        margin-top: 8px;
        padding-left: 0;
      }
      .empty {
        margin: 10px 0;
      }
    `];
};
customElements.get("rv-event-list") || customElements.define("rv-event-list", Ne);
//#endregion
//#region src/playback/player.ts
var Pe = [
	.5,
	1,
	2,
	4,
	8
], Fe = class extends r {
	static properties = {
		muted: { type: Boolean },
		rate: { type: Number },
		note: { attribute: !1 },
		_active: { state: !0 },
		_paused: { state: !0 },
		_waiting: { state: !0 },
		_started: { state: !0 },
		_pip: { state: !0 }
	};
	_items = [void 0, void 0];
	_keys = [void 0, void 0];
	_feeders = [void 0, void 0];
	_requestedAt;
	_firstOnSeeked = !1;
	_endedAt;
	_pendingOffset = [0, 0];
	constructor() {
		super(), this.muted = !0, this.rate = 1, this._active = 0, this._paused = !0, this._waiting = !1, this._started = !1, this._pip = !1;
	}
	disconnectedCallback() {
		super.disconnectedCallback();
		for (let e of [0, 1]) y(this._video(e)).catch(() => void 0);
	}
	get pip() {
		return this._pip;
	}
	async togglePip() {
		let e = this._video(this._active);
		if (e) try {
			if (this._pip) for (let e of [0, 1]) await y(this._video(e));
			else await oe(e);
		} catch {}
	}
	_onPipChange = () => {
		let e = h(this._video(0)) || h(this._video(1));
		e !== this._pip && (this._pip = e, this._emit("rv-pip", { pip: e }));
	};
	_carryPip(e, t) {
		e && t && h(e) && ie(e, t);
	}
	updated(e) {
		if (e.has("rate")) for (let e of [0, 1]) this._applyRate(this._video(e));
	}
	get mseStats() {
		let e = this._feeders[this._active];
		return e ? {
			...e.stats,
			...e.around
		} : void 0;
	}
	get mse() {
		let e = this._feeders[this._active];
		return e !== void 0 && !e.closed;
	}
	get current() {
		return this._items[this._active];
	}
	get preloaded() {
		return this._items[this._other];
	}
	get time() {
		let e = this.current, t = this._video(this._active);
		return e && t ? e.start + t.currentTime * 1e3 : void 0;
	}
	get paused() {
		return this._paused;
	}
	get _other() {
		return +(this._active === 0);
	}
	_video(e) {
		return this.renderRoot.querySelector(`video[data-slot="${e}"]`);
	}
	async play(e, t = 0, n = performance.now()) {
		await this.updateComplete, this._started = !0, this._requestedAt = n, this._firstOnSeeked = !1, this._endedAt = void 0;
		let r = this.preloaded?.recording === e.recording;
		if (r) {
			let e = this._video(this._active);
			e?.pause(), this._active = this._other, this._carryPip(e, this._video(this._active));
		}
		let i = this._active, a = this._video(i);
		a && (this._pendingOffset[i] = t, r ? this._seekTo(a, t) : (this._setItem(i, e), this._load(i, a, e, t)), this._start(a), this.requestUpdate());
	}
	async preload(e) {
		await this.updateComplete;
		let t = this._other, n = this._video(t);
		!n || this._items[t]?.recording === e?.recording ? e && e !== this._items[t] && e.release?.() : (this._setItem(t, e), this._pendingOffset[t] = 0, n.pause(), e ? (n.preload = "auto", this._load(t, n, e, 0)) : this._unload(t, n));
	}
	seek(e) {
		let t = this._video(this._active);
		t && this._seekTo(t, e);
	}
	seekWithin(e, t = performance.now()) {
		let n = this._video(this._active);
		n && (this._requestedAt = t, this._firstOnSeeked = !0, this._seekTo(n, e), this._start(n));
	}
	preview(e) {
		let t = this.current, n = this._video(this._active);
		if (!t || !n || e < t.start || e > t.end) return !1;
		let r = (e - t.start) / 1e3, i = n.buffered;
		for (let e = 0; e < i.length; e += 1) if (r >= i.start(e) && r <= i.end(e)) return typeof n.fastSeek == "function" ? n.fastSeek(r) : n.currentTime = r, !0;
		return !1;
	}
	pause() {
		this._video(this._active)?.pause();
	}
	resume() {
		let e = this._video(this._active);
		e && this._start(e);
	}
	stop() {
		for (let e of [0, 1]) {
			let t = this._video(e);
			t?.pause(), t && this._unload(e, t), this._setItem(e, void 0);
		}
		this._paused = !0, this._waiting = !1;
	}
	_setItem(e, t) {
		let n = this._items[e];
		this._items[e] = t, n && n !== t && !this._items.includes(n) && n.release?.();
	}
	_load(e, t, n, r) {
		if (this._feeders[e]?.destroy(), this._feeders[e] = void 0, this._keys[e] = n.key, n.mse) {
			let i = new a(t, n.mse, (t) => {
				this._feederFailed(e, n, t);
			});
			this._feeders[e] = i, i.start(r).catch((t) => {
				i.closed || this._feederFailed(e, n, t instanceof Error ? t : Error(String(t)));
			});
		} else n.url && (t.disableRemotePlayback = !1, t.setAttribute("src", n.url), t.load());
		this._applyRate(t);
	}
	_unload(e, t) {
		this._feeders[e]?.destroy(), this._feeders[e] = void 0, this._keys[e] = void 0, t.getAttribute("src") && (t.removeAttribute("src"), t.load());
	}
	_applyRate(e) {
		e && (e.defaultPlaybackRate = this.rate, e.playbackRate = this.rate);
	}
	_feederFailed(e, t, n) {
		if (this._items[e] !== t) return;
		if (e !== this._active) {
			this._setItem(e, void 0);
			let t = this._video(e);
			t && this._unload(e, t);
			return;
		}
		let r = this._video(e);
		r && this._fail(n.message, r, n instanceof le);
	}
	_seekTo(e, t) {
		let n = Math.max(0, t / 1e3);
		e.readyState >= 1 ? e.currentTime = n : this._pendingOffset[Number(e.dataset.slot)] = t;
	}
	_start(e) {
		e.play()?.catch((t) => {
			t instanceof DOMException && t.name === "NotAllowedError" ? this._paused = !0 : t instanceof DOMException && t.name === "AbortError" || this._fail(String(t), e, !1);
		});
	}
	_fail(e, t, n) {
		let r = {
			message: e,
			segmentId: this.current?.segmentId,
			played: t.currentTime > 0,
			fallback: n
		};
		this.dispatchEvent(new CustomEvent("rv-player-error", {
			detail: r,
			bubbles: !0,
			composed: !0
		}));
	}
	_emit(e, t) {
		this.dispatchEvent(new CustomEvent(e, {
			detail: t,
			bubbles: !0,
			composed: !0
		}));
	}
	_onMetadata(e, t) {
		let n = t.target, r = this._pendingOffset[e];
		r > 0 && (n.currentTime = r / 1e3), this._pendingOffset[e] = 0;
	}
	_onPlaying(e) {
		if (e !== this._active) return;
		this._paused = !1, this._waiting = !1;
		let t = this.current;
		if (!t) return;
		let n = performance.now();
		if (this._endedAt !== void 0) {
			let e = {
				segmentId: t.segmentId,
				gapMs: n - this._endedAt
			};
			this._emit("rv-advanced", e), this._endedAt = void 0;
		} else if (this._requestedAt !== void 0) {
			let e = {
				segmentId: t.segmentId,
				ms: n - this._requestedAt
			};
			this._emit("rv-first-frame", e);
		}
		this._requestedAt = void 0;
	}
	_onSeeked(e) {
		if (e !== this._active) return;
		this._waiting = !1;
		let t = this.current;
		if (!this._firstOnSeeked || this._requestedAt === void 0 || !t) return;
		let n = {
			segmentId: t.segmentId,
			ms: performance.now() - this._requestedAt
		};
		this._emit("rv-first-frame", n), this._requestedAt = void 0, this._firstOnSeeked = !1;
	}
	_onEnded(e) {
		if (e !== this._active) return;
		let t = this.current;
		if (this._endedAt = performance.now(), this.preloaded) {
			this._setItem(e, void 0);
			let t = this._video(e);
			this._active = this._other;
			let n = this._video(this._active);
			this._carryPip(t, n), t && this._unload(e, t), n && this._start(n);
		} else this._endedAt = void 0, this._paused = !0, this._emit("rv-ended", { segmentId: t?.segmentId });
	}
	_onTime(e) {
		if (e !== this._active) return;
		let t = this.time;
		t !== void 0 && this._emit("rv-time", { time: t });
	}
	_onError(e, t) {
		let n = t.target;
		if (!n.getAttribute("src")) return;
		if (e !== this._active) {
			this._setItem(e, void 0);
			return;
		}
		let r = this._feeders[e] !== void 0;
		this._fail(n.error?.message || `media error ${n.error?.code ?? "?"}`, n, r);
	}
	_renderVideo(e) {
		return n`<video
      data-slot=${e}
      class=${e === this._active ? "active" : "hidden"}
      playsinline
      .muted=${this.muted}
      ?controls=${e === this._active && this._started}
      preload="auto"
      @loadedmetadata=${(t) => {
			this._onMetadata(e, t);
		}}
      @playing=${() => {
			this._onPlaying(e);
		}}
      @seeked=${() => {
			this._onSeeked(e);
		}}
      @waiting=${() => {
			e === this._active && (this._waiting = !0);
		}}
      @pause=${() => {
			e === this._active && (this._paused = !0);
		}}
      @ended=${() => {
			this._onEnded(e);
		}}
      @timeupdate=${() => {
			this._onTime(e);
		}}
      @error=${(t) => {
			this._onError(e, t);
		}}
      @enterpictureinpicture=${this._onPipChange}
      @leavepictureinpicture=${this._onPipChange}
      @webkitpresentationmodechanged=${this._onPipChange}
    ></video>`;
	}
	render() {
		let e = this._waiting || this._requestedAt !== void 0 && this.note ? this.note : void 0;
		return n`<div class="frame">
      ${this._renderVideo(0)}${this._renderVideo(1)}
      ${e ? n`<div class="note" role="status">${e}</div>` : t}
      ${this._started ? t : n`<p class="empty">Pick an event or a time on the timeline to play it.</p>`}
    </div>`;
	}
	static styles = e`
    :host {
      display: block;
    }
    .frame {
      position: relative;
      width: 100%;
      aspect-ratio: 16 / 9;
      background: var(--rv-board, #000);
      overflow: hidden;
    }
    video {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: var(--rv-board, #000);
    }
    .note {
      position: absolute;
      left: 50%;
      bottom: 48px;
      transform: translateX(-50%);
      max-width: calc(100% - 32px);
      padding: 6px 12px;
      background: rgba(17, 20, 24, 0.82);
      color: var(--rv-on-board, #fff);
      font-family: var(--rv-font, sans-serif);
      font-size: 14px;
      font-weight: 500;
      text-align: center;
      pointer-events: none;
    }
    .empty {
      position: absolute;
      inset: 0;
      margin: 0;
      display: grid;
      place-items: center;
      padding: 16px;
      color: var(--rv-on-board-muted, #a9b0c4);
      font-family: var(--rv-font, sans-serif);
      font-size: 15px;
      text-align: center;
    }
    /* The hidden buffer stays laid out (some browsers do not load hidden video). */
    video.hidden {
      opacity: 0;
      pointer-events: none;
    }
  `;
};
customElements.get("rv-player") || customElements.define("rv-player", Fe);
//#endregion
//#region src/playback/thumb-loader.ts
var Ie = class {
	_concurrency;
	_create;
	_queue = [];
	_active = /* @__PURE__ */ new Set();
	_paused = !1;
	constructor(e = 2, t = () => new Image()) {
		this._concurrency = e, this._create = t;
	}
	load(e) {
		return new Promise((t) => {
			this._queue.push({
				url: e,
				resolve: t
			}), this._pump();
		});
	}
	pause() {
		this._paused = !0;
	}
	resume() {
		this._paused = !1, this._pump();
	}
	clear() {
		for (let e of this._queue.splice(0)) e.resolve(!1);
		for (let { job: e, image: t } of this._active) t.onload = t.onerror = null, t.src = "", e.resolve(!1);
		this._active.clear();
	}
	get pending() {
		return this._queue.length + this._active.size;
	}
	_pump() {
		for (; !this._paused && this._active.size < this._concurrency;) {
			let e = this._queue.shift();
			if (!e) return;
			let t = this._create(), n = {
				job: e,
				image: t
			}, r = (t) => {
				this._active.delete(n) && (e.resolve(t), this._pump());
			};
			t.onload = () => {
				r(!0);
			}, t.onerror = () => {
				r(!1);
			}, this._active.add(n), t.src = e.url;
		}
	}
}, Le = 4, I = 24, Re = .01, L = 76, R = 18, z = 22, ze = 26, Be = 52, Ve = 16, He = [
	1e4,
	3e4,
	k,
	5 * k,
	10 * k,
	15 * k,
	30 * k,
	60 * k
];
function Ue(e) {
	return He.find((t) => t >= e / 48) ?? 36e5;
}
var We = class extends r {
	static properties = {
		day: { attribute: !1 },
		events: { attribute: !1 },
		view: { attribute: !1 },
		cursor: { attribute: !1 },
		timeZone: { attribute: !1 },
		_keyTime: { state: !0 }
	};
	_width = 0;
	_observed = 0;
	_resize;
	_drag;
	_pointers = /* @__PURE__ */ new Map();
	_pinch;
	_pinched = !1;
	_hoverTimer;
	_keySeek;
	constructor() {
		super(), this.events = [], this.view = {
			start: 0,
			span: O[0] ?? 864e5
		};
	}
	connectedCallback() {
		super.connectedCallback(), typeof ResizeObserver < "u" && (this._resize = new ResizeObserver((e) => {
			let t = e.at(-1)?.contentRect.width;
			this._observed = t ? Math.max(1, Math.round(t)) : 0, this._draw();
		}), this._resize.observe(this));
	}
	disconnectedCallback() {
		super.disconnectedCallback(), this._resize?.disconnect(), clearTimeout(this._hoverTimer), clearTimeout(this._keySeek);
	}
	get _canvas() {
		return this.renderRoot.querySelector("canvas");
	}
	get _bounds() {
		let e = this.day;
		return e ? {
			start: e.start,
			end: e.end
		} : {
			start: this.view.start,
			end: this.view.start + this.view.span
		};
	}
	timeAt(e) {
		return me(e, this.view, this._width || 1);
	}
	updated() {
		this._draw();
	}
	_emit(e, t) {
		this.dispatchEvent(new CustomEvent(e, {
			detail: t,
			bubbles: !0,
			composed: !0
		}));
	}
	_setView(e) {
		let t = D(e, this._bounds);
		(t.start !== this.view.start || t.span !== this.view.span) && (this.view = t, this._emit("rv-view-change", { view: t }));
	}
	zoom(e, t) {
		let n = A(this.view.span, e);
		if (n === void 0) return;
		let r = t ?? this.cursor ?? this.view.start + this.view.span / 2;
		this._setView(E(this.view, n, r, this._bounds));
	}
	_span(e) {
		let t = O[O.length - 1] ?? 6e4, { start: n, end: r } = this._bounds;
		return Math.min(Math.max(e, t), Math.max(r - n, t));
	}
	pan(e) {
		this._setView({
			start: this.view.start + e * this.view.span,
			span: this.view.span
		});
	}
	_x(e) {
		let t = this._canvas?.getBoundingClientRect();
		return e.clientX - (t?.left ?? 0);
	}
	_onWheel(e) {
		if (e.preventDefault(), e.ctrlKey) {
			let t = this._span(this.view.span * Math.exp(e.deltaY * Re));
			this._setView(E(this.view, t, this.timeAt(this._x(e)), this._bounds));
		} else if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
			let t = e.shiftKey ? e.deltaY : e.deltaX;
			this.pan(Math.sign(t) * .25);
		} else e.deltaY !== 0 && this.zoom(e.deltaY < 0 ? 1 : -1, this.timeAt(this._x(e)));
	}
	_onPointerDown(e) {
		if (e.button !== 0) return;
		e.isPrimary && (this._pointers.clear(), this._pinch = void 0, this._pinched = !1);
		let t = this._x(e);
		this._pointers.set(e.pointerId, t), B(this._canvas, e.pointerId, !0), this._pointers.size === 2 ? this._startPinch() : this._pinched || this._pointers.size > 2 || (this._drag = {
			pointerId: e.pointerId,
			x: t,
			moved: !1
		});
	}
	_twoFingers = {
		handleEvent: (e) => {
			("targetTouches" in e ? e.targetTouches.length : 2) >= 2 && e.cancelable && e.preventDefault();
		},
		passive: !1
	};
	_startPinch() {
		let e = this._drag;
		e?.moved && e.time !== void 0 && this._emit("rv-seek", { time: e.time }), this._drag = void 0, this._pinched = !0, this._endHover();
		let [t = 0, n = 0] = this._pointers.values();
		this._pinch = {
			span: this.view.span,
			dist: Math.abs(t - n),
			anchor: this.timeAt((t + n) / 2)
		};
	}
	_movePinch() {
		let e = this._pinch, t = [...this._pointers.values()];
		if (!e || t.length < 2) return;
		let [n = 0, r = 0] = t, i = Math.abs(n - r), a = e.dist >= I && i >= I ? this._span(e.span * e.dist / i) : this.view.span, o = (n + r) / 2;
		this._setView({
			start: e.anchor - o / (this._width || 1) * a,
			span: a
		});
	}
	_onPointerMove(e) {
		let t = this._x(e);
		if (this._pointers.has(e.pointerId) && this._pointers.set(e.pointerId, t), this._pinch) {
			this._movePinch();
			return;
		}
		let n = this._drag;
		if (n && n.pointerId === e.pointerId) {
			if (Math.abs(t - n.x) > Le && (n.moved = !0), n.moved) {
				let e = this.timeAt(t);
				n.time = e, this._emit("rv-scrub", { time: e }), this._scheduleHover(e, t);
			}
		} else e.pointerType === "mouse" && this._scheduleHover(this.timeAt(t), t);
	}
	_onPointerUp(e) {
		if (this._pointers.delete(e.pointerId), B(this._canvas, e.pointerId, !1), this._pinched) {
			this._pinch = void 0, this._pointers.size || (this._pinched = !1);
			return;
		}
		let t = this._drag;
		t && t.pointerId === e.pointerId && (this._drag = void 0, this._emit("rv-seek", { time: this.timeAt(this._x(e)) }), e.pointerType !== "mouse" && this._endHover());
	}
	_onPointerCancel(e) {
		this._pointers.delete(e.pointerId), this._drag = void 0, this._pinch = void 0, this._pointers.size || (this._pinched = !1), this._endHover();
	}
	_scheduleHover(e, t) {
		clearTimeout(this._hoverTimer), this._hoverTimer = setTimeout(() => {
			this._emit("rv-hover", {
				time: e,
				x: t
			});
		}, 150);
	}
	_endHover() {
		clearTimeout(this._hoverTimer), this._emit("rv-hover-end", {});
	}
	_onKey(e) {
		let t = this._keyTime ?? this.cursor ?? this.view.start + this.view.span / 2, n = Ue(this.view.span), { start: r, end: i } = this._bounds, a = {
			ArrowLeft: t - n,
			ArrowDown: t - n,
			ArrowRight: t + n,
			ArrowUp: t + n,
			PageDown: t - 6 * n,
			PageUp: t + 6 * n,
			Home: r,
			End: Math.min(i, this.day?.now ?? i)
		}, o = {
			Enter: () => {
				this._seekNow(t);
			},
			" ": () => {
				this._seekNow(t);
			},
			"+": () => {
				this.zoom(1);
			},
			"=": () => {
				this.zoom(1);
			},
			"-": () => {
				this.zoom(-1);
			}
		}, s = a[e.key], c = o[e.key];
		s === void 0 ? c && (e.preventDefault(), c()) : (e.preventDefault(), this._keyTo(Math.min(Math.max(s, r), i)));
	}
	_keyTo(e) {
		this._keyTime = e;
		let { start: t, span: n } = this.view, r = n * .1;
		(e < t + r || e > t + n - r) && this._setView({
			start: e - n / 2,
			span: n
		}), this._emit("rv-scrub", { time: e }), clearTimeout(this._keySeek), this._keySeek = setTimeout(() => {
			this._seekNow(e);
		}, 500);
	}
	_seekNow(e) {
		clearTimeout(this._keySeek), this._keyTime = void 0, this._emit("rv-seek", { time: e });
	}
	_draw() {
		let e = this._canvas;
		if (!e) return;
		let t = this._observed || Math.max(1, Math.round(this.getBoundingClientRect().width || e.clientWidth || 300));
		this._width = t;
		let n = window.devicePixelRatio || 1;
		e.width !== t * n && (e.width = t * n, e.height = L * n);
		let r = e.getContext("2d");
		if (!r) return;
		r.setTransform(n, 0, 0, n, 0, 0);
		let i = getComputedStyle(this), a = (e, t) => i.getPropertyValue(e).trim() || t, o = a("--rv-text", "#111418"), s = a("--rv-muted", "#5d6370");
		r.clearRect(0, 0, t, L);
		let c = this.view, l = (e) => fe(e, c, t);
		r.font = `500 12px ${a("--rv-font", "sans-serif")}`, r.textBaseline = "top", r.fillStyle = s, r.strokeStyle = a("--rv-rule", "#e0e0e0"), r.lineWidth = 1;
		let u = this.timeZone, d = ge(c, t) < k;
		for (let e of _e(c, t, (e) => ne(e, u))) {
			let n = Math.round(l(e)) + .5;
			r.beginPath(), r.moveTo(n, 14), r.lineTo(n, L), r.stroke();
			let i = v(e, u, d);
			n + 3 + r.measureText(i).width <= t && r.fillText(i, n + 3, 2);
		}
		let f = this.day;
		if (f) {
			if (f.now < f.end) {
				r.fillStyle = a("--rv-ground-2", "#f2f2f2");
				let e = Math.max(0, l(f.now));
				r.fillRect(e, z, t - e, 54);
			}
			r.fillStyle = a("--rv-recording", "#1b2a6e");
			for (let e of Ce(f.segments, c, t)) {
				let n = Math.max(0, l(e.start)), i = Math.min(t, l(e.end));
				r.fillRect(n, z, Math.max(1, i - n), ze);
			}
			r.fillStyle = o;
			for (let e of this.events) {
				if (e.end < c.start || e.start > c.start + c.span) continue;
				let t = l(e.start), n = Math.max(3, l(e.end) - t);
				r.fillRect(t, Be, n, Ve);
			}
			f.now < f.end && f.now >= c.start && f.now <= c.start + c.span && (r.fillStyle = a("--rv-red", "#e10600"), r.fillRect(Math.round(l(f.now)) - 1, R, 2, 58));
		}
		if (this.cursor !== void 0) {
			let e = Math.round(l(this.cursor));
			r.fillStyle = o, r.fillRect(e - 1, R, 2, 58), r.beginPath(), r.moveTo(e - 6, 14), r.lineTo(e + 6, 14), r.lineTo(e, 21), r.closePath(), r.fill();
		}
	}
	render() {
		return n`<canvas
      role="slider"
      tabindex="0"
      aria-label="Recording timeline"
      aria-describedby="keys"
      aria-valuemin=${this.day?.start ?? 0}
      aria-valuemax=${this.day?.end ?? 0}
      aria-valuenow=${this.cursor ?? 0}
      aria-valuetext=${this._valueText()}
      @wheel=${(e) => {
			this._onWheel(e);
		}}
      @pointerdown=${(e) => {
			this._onPointerDown(e);
		}}
      @pointermove=${(e) => {
			this._onPointerMove(e);
		}}
      @pointerup=${(e) => {
			this._onPointerUp(e);
		}}
      @pointercancel=${(e) => {
			this._onPointerCancel(e);
		}}
      @pointerleave=${(e) => {
			!this._drag && e.pointerType === "mouse" && this._endHover();
		}}
      @touchstart=${this._twoFingers}
      @touchmove=${this._twoFingers}
      @gesturestart=${this._twoFingers}
      @keydown=${(e) => {
			this._onKey(e);
		}}
      @blur=${() => {
			this._keyTime = void 0;
		}}
    ></canvas>
    <span id="keys" class="hidden">
      Arrow keys move the time, Page Up and Page Down further, Home and End to the start and end of the
      day. It plays from there; Enter plays at once. Plus and minus zoom.
    </span>`;
	}
	_valueText() {
		let e = this._keyTime ?? this.cursor;
		if (e === void 0) return "no time chosen";
		let t = this.day?.segments.some((t) => t.start <= e && e < t.end) ?? !1;
		return `${v(e, this.timeZone, this._keyTime !== void 0)}, ${t ? "recorded" : "nothing recorded"}`;
	}
	static styles = e`
    :host {
      display: block;
      position: relative;
    }
    /* For screen readers only. */
    .hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
    canvas {
      display: block;
      width: 100%;
      height: ${L}px;
      /* One finger scrolls the page up and down; the rest is the timeline's. */
      touch-action: pan-y;
      cursor: pointer;
      border-bottom: 1px solid var(--rv-rule-strong);
      user-select: none;
      -webkit-user-select: none;
      -webkit-touch-callout: none;
      -webkit-tap-highlight-color: transparent;
    }
    canvas:focus-visible {
      outline: 2px solid var(--rv-action);
      outline-offset: 2px;
    }
  `;
};
function B(e, t, n) {
	try {
		n ? e?.setPointerCapture(t) : e?.releasePointerCapture(t);
	} catch {}
}
customElements.get("rv-timeline") || customElements.define("rv-timeline", We);
//#endregion
//#region src/playback/explain.ts
function Ge(e, t) {
	return t.offline ? {
		text: `${t.name} is offline, so the recordings on its SD card cannot be read.`,
		advice: "They come back when it does."
	} : /not loaded/i.test(e) ? {
		text: "Reolink Viewer is not running.",
		advice: "Check it under Settings → Devices & services, then open the day again."
	} : /search failed|timeout|timed? ?out|connection|unreachable/i.test(e) ? {
		text: "The recorder did not answer when asked for this day's recordings.",
		advice: "Try again in a moment. If it stays, check that the NVR or camera is online."
	} : {
		text: "The recordings could not be read.",
		advice: "Try again in a moment."
	};
}
function V(e) {
	return /not enough free disk space/i.test(e) ? {
		text: "Home Assistant's disk is too full to fetch this recording.",
		advice: "Free some space on it, then play the recording again."
	} : /no main-stream recording/i.test(e) ? {
		text: "There is no HD copy of this recording.",
		advice: "Play it in SD."
	} : /unknown segment/i.test(e) ? {
		text: "This recording is no longer there: the recorder may have recorded over it.",
		advice: "Open the day again."
	} : /empty recording/i.test(e) ? {
		text: "This recording is empty.",
		advice: "Pick another event."
	} : /media error 4|SRC_NOT_SUPPORTED|not supported|no supported|codec|no moov|not playable|decod|demux|pipeline/i.test(e) ? {
		text: "This browser cannot play this recording.",
		advice: "Try Chrome or Safari, or play it in SD."
	} : /\b40[34]\b|expired|forbidden|not found/i.test(e) ? {
		text: "The recording's link has expired.",
		advice: "Play it again."
	} : /search failed|cache failed|timeout|timed? ?out|network|failed to fetch|\b5\d\d\b|abort/i.test(e) ? {
		text: "The recording could not be fetched.",
		advice: "Check the connection to Home Assistant, then play it again."
	} : {
		text: "This recording could not play.",
		advice: "Try it again, or pick another event."
	};
}
//#endregion
//#region src/components/playback.ts
var H = 6e4, Ke = 3e3, U = 1e4, qe = 3, W = 86400, Je = 10 * k, Ye = 10, G = 8e3, K = 3 * k, Xe = 6e4, Ze = 60, q = 1e3, Qe = 6e4, J = "reolink-viewer-check-setup", Y = "reolink-viewer-player", X = !1, Z = class extends r {
	static properties = {
		hass: { attribute: !1 },
		deviceId: { attribute: !1 },
		cameraName: { attribute: !1 },
		at: { attribute: !1 },
		offline: { attribute: !1 },
		storage: { attribute: !1 },
		recorder: { attribute: !1 },
		_date: { state: !0 },
		_day: { state: !0 },
		_error: { state: !0 },
		_playFailure: { state: !0 },
		_loading: { state: !0 },
		_view: { state: !0 },
		_cursor: { state: !0 },
		_only: { state: !0 },
		_month: { state: !0 },
		_monthDays: { state: !0 },
		_monthLoading: { state: !0 },
		_stream: { state: !0 },
		_hd: { state: !0 },
		_playing: { state: !0 },
		_hover: { state: !0 },
		_thumbs: { state: !0 },
		_metrics: { state: !0 },
		_checkText: { state: !0 },
		_checkRunning: { state: !0 },
		_checkSetup: { state: !0 },
		_checkSession: { state: !0 },
		_checkHdPart: { state: !0 },
		_checkNote: { state: !0 },
		_reports: { state: !0 },
		_rate: { state: !0 },
		_note: { state: !0 },
		_mode: { state: !0 }
	};
	_daySeq = 0;
	_hdWarmed = /* @__PURE__ */ new Set();
	_openedAt;
	_playSeq = 0;
	_hoverSeq = 0;
	_monthSeq = 0;
	_thumbsRequested = /* @__PURE__ */ new Set();
	thumbLoader = new Ie();
	_thumbPause;
	_eventsRetry;
	_eventsRetries = 0;
	_refreshTimer;
	_lastCursorPaint = 0;
	_progressive = l();
	_check;
	_starting;
	_preloadPending;
	_recoveredAt = -Infinity;
	_mseFailed = /* @__PURE__ */ new Set();
	_lastPreview = 0;
	constructor() {
		super(), this.deviceId = "", this.cameraName = "", this._date = "", this._loading = !1, this._view = {
			start: 0,
			span: Se
		}, this.offline = !1, this.storage = null, this.recorder = "camera", this._only = /* @__PURE__ */ new Set();
		let e = /* @__PURE__ */ new Date();
		this._month = {
			year: e.getFullYear(),
			month: e.getMonth() + 1
		}, this._monthDays = /* @__PURE__ */ new Set(), this._monthLoading = !1, this._stream = "sub", this._hd = {
			main: !1,
			reason: "checking…"
		}, this._thumbs = /* @__PURE__ */ new Map(), this._metrics = {}, this._checkText = "", this._checkRunning = !1, this._checkSetup = rt(), this._checkSession = !1, this._checkHdPart = P(this._checkSetup), this._rate = 1, this._mode = it();
	}
	get _zone() {
		return this.hass?.config?.time_zone;
	}
	get _today() {
		return _(Date.now(), this._zone);
	}
	get _player() {
		return this.renderRoot.querySelector("rv-player");
	}
	get _timeline() {
		return this.renderRoot.querySelector("rv-timeline");
	}
	get _events() {
		return Te(this._day?.events ?? [], this._only);
	}
	connectedCallback() {
		super.connectedCallback(), this._refreshTimer = setInterval(() => {
			this._date === this._today && document.visibilityState !== "hidden" && this._loadDay(this._date, {
				keepView: !0,
				quiet: !0
			});
		}, H);
	}
	disconnectedCallback() {
		super.disconnectedCallback(), clearInterval(this._refreshTimer), this._player?.stop(), this.thumbLoader.clear(), clearTimeout(this._thumbPause), clearTimeout(this._eventsRetry), this._check?.stop();
	}
	willUpdate(e) {
		if ((e.has("deviceId") || e.has("hass")) && this.hass && this.deviceId && !this._date) {
			this._date = this.at === void 0 ? this._today : _(this.at, this._zone);
			let [e, t] = this._date.split("-").map(Number);
			e && t && (this._month = {
				year: e,
				month: t
			}), this._loadDay(this._date).then(() => {
				this._openAt();
			}), this._loadMonth(this._month.year, this._month.month), this._checkHd(), X || (X = !0, Oe(this.hass).then((e) => {
				this._checkNote = e;
			}));
		} else if (e.has("at") && this.at !== void 0 && this._date) {
			let e = _(this.at, this._zone);
			e === this._date ? this._openAt() : this._selectDate(e).then(() => {
				this._openAt();
			});
		}
	}
	_openAt() {
		let e = this.at, t = this._day;
		e !== void 0 && e !== this._openedAt && t && _(e, this._zone) === t.date && (this._openedAt = e, this._cursor = e, this._view = N(this._view, e, t), this.playAt(e));
	}
	async _loadDay(e, t = {}) {
		let n = this.hass;
		if (!n) return;
		let r = ++this._daySeq, i = performance.now(), a = !1;
		t.quiet || (this._loading = !0);
		try {
			let o = await C(n, this.deviceId, e, t.quiet ? 0 : W);
			if (r !== this._daySeq) return;
			let s = !this._day || this._day.date !== o.date;
			if (this._day = o, this._error = void 0, s || !t.keepView) {
				this._view = D({
					start: o.start,
					span: o.end - o.start
				}, o);
				let e = o.events.at(-1)?.start ?? o.segments.at(-1)?.start;
				this._cursor = e;
			} else this._view = D(this._view, o);
			await this.updateComplete, t.quiet || (this._metrics = {
				...this._metrics,
				timelineMs: performance.now() - i,
				timelineServer: o.timing
			}), this._warmLongRecording(o), this._warmHdDay(o), a = !t.quiet && o.timing.cache === "stale", this._retryEventsSoon(o);
		} catch (e) {
			r === this._daySeq && (this._error = s(e).message);
		} finally {
			r === this._daySeq && (this._loading = !1);
		}
		a && await this._loadDay(e, {
			keepView: !0,
			quiet: !0
		});
	}
	_retryEventsSoon(e) {
		clearTimeout(this._eventsRetry), !e.events_error || e.complete ? this._eventsRetries = 0 : this._eventsRetries >= 3 || (this._eventsRetries += 1, this._eventsRetry = setTimeout(() => {
			this._date === e.date && this._loadDay(e.date, {
				keepView: !0,
				quiet: !0
			});
		}, U));
	}
	async _loadMonth(e, t) {
		let n = this.hass;
		if (!n) return;
		let r = ++this._monthSeq;
		this._month = {
			year: e,
			month: t
		}, this._monthLoading = !0;
		try {
			let i = await d(n, this.deviceId, e, t);
			r === this._monthSeq && (this._monthDays = new Set(i.days));
		} catch {
			r === this._monthSeq && (this._monthDays = /* @__PURE__ */ new Set());
		} finally {
			r === this._monthSeq && (this._monthLoading = !1);
		}
	}
	async _checkHd() {
		let e = this.hass;
		if (e) try {
			let t = await ee(e, this.deviceId);
			this._hd = await o(t.main), this._metrics = {
				...this._metrics,
				hd: this._hd.reason
			}, this._day && this._warmHdDay(this._day);
		} catch {
			this._hd = {
				main: !1,
				reason: "main stream information unavailable"
			};
		}
	}
	_warmHdDay(e) {
		let t = this.hass, n = `${this.deviceId}|${e.date}`;
		t && this._hd.main && e.segments.length && !this._hdWarmed.has(n) && (this._hdWarmed.add(n), C(t, this.deviceId, e.date, 0, {
			stream: "main",
			background: !0
		}).catch(() => {
			this._hdWarmed.delete(n);
		}));
	}
	_warmLongRecording(e) {
		let t = this.hass, n = this._cursor === void 0 ? e.segments.at(-1) : T(e.segments, this._cursor);
		!t || !n || n.end - n.start < Je || u(t, this._ref(n)).catch(() => void 0);
	}
	_ref(e, t = this._stream) {
		return {
			deviceId: this.deviceId,
			date: this._date,
			segmentId: e.id,
			stream: t
		};
	}
	async playAt(e, t = performance.now()) {
		let n = this.hass, r = this._day;
		if (!n || !r) return;
		let i = ve(r.segments, e);
		if (!i) {
			j(this, "No recording after this time on this day");
			return;
		}
		let a = ++this._playSeq;
		this._playFailure = void 0, this._pauseThumbs();
		let o = i.segment.start + i.offset;
		if (this._cursor = o, this._seekWithin(i.segment, o, t)) {
			this._schedulePreload(i.segment, a, o);
			return;
		}
		this._starting = a;
		let c = performance.now();
		try {
			let e = this._useMse(this._stream), r = this._progressive && i.offset < 3e3, s = this._ref(i.segment), l = e ? await m(n, s, o) : await S(n, s, r, o);
			if (a !== this._playSeq) {
				this._release(l);
				return;
			}
			this._playing = l, this._metrics = {
				...this._metrics,
				urlMs: performance.now() - c,
				firstFrameMs: void 0,
				gapMs: void 0,
				stream: l.stream,
				cache: l.cache,
				codec: l.media?.codec ?? null,
				delivery: e ? `MSE (${f() ?? "?"})${l.cache.complete ? ", cached" : ""}` : tt(r, this._progressive, l.cache.complete)
			};
			let u = Math.max(0, o - l.start);
			await this._player?.play(this._toItem(l, i.segment), u, t), this._showDownload(l, a), this._schedulePreload(i.segment, a, o);
		} catch (e) {
			a === this._playSeq && this._playError(s(e).message);
		} finally {
			this._starting === a && (this._starting = void 0);
		}
	}
	_seekWithin(e, t, n) {
		let r = this._player, i = r?.current;
		return !r?.mse || !this._useMse(this._stream) || !i || i.segmentId !== e.id || this._playing?.stream !== this._stream || i.end < e.end && t > i.end - Qe ? !1 : (this._metrics = {
			...this._metrics,
			urlMs: 0,
			firstFrameMs: void 0,
			delivery: `MSE (${f() ?? "?"}), same recording`
		}, r.seekWithin(Math.max(0, t - i.start), n), !0);
	}
	_describeMode() {
		let e = f();
		if (this._mode === "file") return "file player only (set under Details)";
		if (!e) return "file player (this browser has no MSE)";
		if (typeof this.hass?.fetchWithAuth != "function") return "file player (no authenticated fetch)";
		let t = [...this._mseFailed];
		return `MSE (${e})${t.length ? `, file player for ${t.join(", ")} after a failure` : ""}`;
	}
	_useMse(e) {
		return this._mode === "auto" && f() !== void 0 && typeof this.hass?.fetchWithAuth == "function" && !this._mseFailed.has(e);
	}
	_release(e) {
		let t = this.hass, n = c(e.base ?? e.url ?? "");
		t && n && te(t, [n]).catch(() => void 0);
	}
	_toItem(e, t) {
		let n = {
			recording: `${e.stream}:${t.id}:${e.end}`,
			segmentId: t.id,
			start: e.start,
			end: e.end,
			release: () => {
				this._release(e);
			}
		}, r = this.hass;
		if (e.base && r?.fetchWithAuth) {
			let t = r.fetchWithAuth.bind(r);
			return {
				...n,
				key: e.base,
				mse: {
					base: e.base,
					fetch: t,
					durationMs: e.end - e.start
				}
			};
		}
		let i = e.url ?? "";
		return {
			...n,
			key: i,
			url: i
		};
	}
	async _showDownload(e, t) {
		let n = this.hass, r = c(e.base ?? e.url ?? "");
		if (!n || !r || e.cache.complete) return;
		let i = () => t === this._playSeq && this._metrics.firstFrameMs === void 0 && !this._playFailure;
		for (; i() && (await $e(q), i());) try {
			let t = await x(n, r);
			if (!i() || !t.cache || t.cache.complete || t.cache.error) break;
			let a = e.stream === "main" ? "HD " : "", o = t.cache.cut;
			this._note = o && !o.error && t.cache.cut_error === void 0 ? `Asking the recorder for this moment${a ? " in HD" : ""}…` : `Fetching the ${a}recording from the recorder: ${Q(t.cache.bytes)} of about ${Q(t.expected_bytes)}`;
		} catch {
			break;
		}
		t === this._playSeq && (this._note = void 0);
		try {
			let e = await x(n, r);
			t === this._playSeq && e.cache?.cut && (this._metrics = {
				...this._metrics,
				cache: e.cache
			});
		} catch {}
	}
	_schedulePreload(e, t, n) {
		this._preloadPending = void 0;
		let r = this.hass, i = this._nextSegment(e);
		!r || !i || e.end - n <= K ? this._preloadAfter(e, t) : (this._player?.preload(void 0), u(r, this._ref(i)).catch(() => void 0), this._preloadPending = {
			segment: e,
			seq: t
		});
	}
	_nextSegment(e) {
		let t = this._day?.segments ?? [], n = t.findIndex((t) => t.id === e.id);
		return n >= 0 ? t.at(n + 1) : void 0;
	}
	async _preloadAfter(e, t) {
		let n = this.hass, r = this._nextSegment(e);
		if (!n || !r) await this._player?.preload(void 0);
		else if (!this._player?.preloaded?.recording.startsWith(`${this._stream}:${r.id}:`)) try {
			let e = this._ref(r), i = this._useMse(this._stream) ? await m(n, e, r.start) : await S(n, e, this._progressive, r.start);
			if (t !== this._playSeq) {
				this._release(i);
				return;
			}
			await this._player?.preload(this._toItem(i, r));
		} catch {}
	}
	_onAdvanced(e) {
		let t = this._day?.segments.find((t) => t.id === e.segmentId);
		this._metrics = {
			...this._metrics,
			gapMs: e.gapMs
		}, t && (this._cursor = t.start, this._schedulePreload(t, this._playSeq, t.start));
	}
	_onEnded(e) {
		let t = this._day?.segments ?? [], n = t.findIndex((t) => t.id === e), r = n >= 0 ? t[n + 1] : void 0;
		r && this.playAt(r.start);
	}
	_pauseThumbs() {
		this.thumbLoader.pause(), clearTimeout(this._thumbPause), this._thumbPause = setTimeout(() => {
			this._resumeThumbs();
		}, G);
	}
	_resumeThumbs() {
		clearTimeout(this._thumbPause), this.thumbLoader.resume();
	}
	_onPlayerError(e) {
		if (e.fallback && this._useMse(this._stream)) {
			this._mseFailed.add(this._stream), this._metrics = {
				...this._metrics,
				fallbacks: (this._metrics.fallbacks ?? 0) + 1,
				lastFallback: e.message
			};
			let t = e.played ? this._player?.time ?? this._cursor : this._cursor;
			t !== void 0 && this.playAt(t);
			return;
		}
		let t = this._player?.time, n = performance.now();
		e.played && t !== void 0 && n - this._recoveredAt > 6e4 ? (this._recoveredAt = n, this._metrics = {
			...this._metrics,
			recoveries: (this._metrics.recoveries ?? 0) + 1,
			lastRecovery: e.message
		}, this.playAt(t)) : this._playError(e.message);
	}
	_playError(e) {
		this._resumeThumbs(), this._stream === "main" ? (this._stream = "sub", this._metrics = {
			...this._metrics,
			hdFailures: (this._metrics.hdFailures ?? 0) + 1,
			lastHdFailure: e
		}, j(this, `HD could not play: ${V(e).text} Back to SD.`, "error"), this._cursor !== void 0 && this.playAt(this._cursor)) : (this._playFailure = e, j(this, V(e).text, "error"));
	}
	_onTime(e) {
		if (this._starting !== void 0) return;
		let t = performance.now();
		if (t - this._lastCursorPaint < 250) return;
		this._lastCursorPaint = t;
		let n = this._preloadPending;
		n && n.seq === this._playSeq && n.segment.end - e <= K && (this._preloadPending = void 0, this._preloadAfter(n.segment, n.seq)), this._cursor = e, (e > this._view.start + this._view.span || e < this._view.start) && (this._view = N(this._view, e, this._day ?? {
			start: e,
			end: e + this._view.span
		}));
	}
	_onScrub(e) {
		this._cursor = e;
		let t = performance.now();
		t - this._lastPreview < 80 || (this._lastPreview = t, this._player?.preview(e));
	}
	_jump(e) {
		let t = this._cursor ?? this._view.start, n = e > 0 ? we(this._events, t) : ue(this._events, t);
		n ? (this._cursor = n.start, this._day && (this._view = N(this._view, n.start, this._day)), this.playAt(n.start)) : j(this, e > 0 ? "No later event" : "No earlier event");
	}
	_setRate(e) {
		this._rate = e;
	}
	_setMode(e) {
		this._mode = e, this._mseFailed.clear(), at(e);
		let t = this._player?.time ?? this._cursor;
		this._playing && t !== void 0 && this.playAt(t);
	}
	_setStream(e) {
		if (e === this._stream) return;
		this._stream = e;
		let t = this._player?.time ?? this._cursor;
		this._playing && t !== void 0 && this.playAt(t);
	}
	_changeDay(e) {
		let [t, n, r] = this._date.split("-").map(Number);
		if (!t || !n || !r) return;
		let i = new Date(Date.UTC(t, n - 1, r + e)).toISOString().slice(0, 10);
		i > this._today || this._selectDate(i);
	}
	_selectDate(e) {
		this._date = e, this._player?.stop(), this._playing = void 0, this._preloadPending = void 0, this.thumbLoader.clear(), this._thumbs = /* @__PURE__ */ new Map(), this._thumbsRequested.clear();
		let t = this._loadDay(e), [n, r] = e.split("-").map(Number);
		return n && r && (n !== this._month.year || r !== this._month.month) && this._loadMonth(n, r), t;
	}
	async _onHover(e) {
		let t = this.hass;
		if (!t || !this._day || !T(this._day.segments, e.time)) {
			this._hoverSeq += 1, this._hover = {
				x: e.x,
				time: e.time,
				gap: !0
			};
			return;
		}
		let n = ++this._hoverSeq, r = {
			x: e.x,
			time: e.time
		};
		this._hover = r;
		try {
			let i = (await g(t, this.deviceId, [e.time], he(this._view.span))).urls[0]?.url;
			n === this._hoverSeq && (this._hover = i ? {
				...r,
				url: i
			} : r);
		} catch {}
	}
	async _loadThumbs(e) {
		let t = this.hass, n = e.filter((e) => !this._thumbsRequested.has(e));
		if (t && n.length) {
			n.forEach((e) => this._thumbsRequested.add(e));
			try {
				let e = await g(t, this.deviceId, n, Ye), r = this._date;
				e.urls.forEach((e, t) => {
					let i = n[t] ?? e.time;
					this.thumbLoader.load(e.url).then((t) => {
						!t || r !== this._date ? this._thumbsRequested.delete(i) : this._thumbs = new Map(this._thumbs).set(i, e.url);
					});
				});
			} catch {
				n.forEach((e) => this._thumbsRequested.delete(e));
			}
		}
	}
	async runCheck(e) {
		if (this._check?.running) return this._check.text;
		let t = new je(this._checkTarget(), e, () => {
			this._checkText = t.text;
		});
		this._check = t, this._checkRunning = !0, this._checkText = "";
		try {
			return await t.run();
		} finally {
			this._checkRunning = !1, this._checkText = t.text, this._reports = void 0;
		}
	}
	_checkTarget() {
		let e = this;
		return {
			get hass() {
				if (!e.hass) throw Error("not connected");
				return e.hass;
			},
			get deviceId() {
				return e.deviceId;
			},
			get cameraName() {
				return e.cameraName;
			},
			get date() {
				return e._date;
			},
			get today() {
				return e._today;
			},
			get day() {
				return e._day;
			},
			get loading() {
				return e._loading;
			},
			get metrics() {
				return e._metrics;
			},
			get playFailure() {
				return e._playFailure;
			},
			get hd() {
				return e._hd;
			},
			get progressive() {
				return e._progressive;
			},
			get mode() {
				return e._describeMode();
			},
			get stream() {
				return e._stream;
			},
			setStream: (t) => {
				e._setStream(t);
			},
			get monthDays() {
				return e._monthDays;
			},
			get player() {
				return e._player;
			},
			get playing() {
				return e._playing;
			},
			selectDate: (t) => {
				e._selectDate(t);
			},
			playAt: (t, n) => e.playAt(t, n)
		};
	}
	async _loadReports() {
		if (this.hass) try {
			this._reports = (await ke(this.hass)).reports.filter((e) => !e.setup.startsWith(i));
		} catch (e) {
			j(this, `Could not load the reports: ${s(e).message}`, "error");
		}
	}
	async _copy(e) {
		await re(e) ? j(this, "Report copied") : j(this, "Copying is blocked here: select the report text and copy it", "error");
	}
	_renderCheck() {
		let e = this._checkRunning, r = e ? this._check?.inShort() : Me(this._checkText);
		return n`<div class="check">
      <h3>Playback check</h3>
      <p class="small">
        How quickly ${this.cameraName}'s recordings open and play on this device: the timeline, events,
        long recordings, fast forward and HD. It takes a few minutes; keep this page open and in front.
        Each run is saved, so you can read it later on any device.
      </p>
      ${this._checkNote ? n`<div class="banner error" role="alert">${this._checkNote}</div>` : t}
      <div class="form">
        <span class="label" id="check-setup">This device and network</span>
        <div class="field">
          <select
            aria-labelledby="check-setup"
            ?disabled=${e}
            @change=${(e) => {
			this._checkSetup = e.target.value, this._checkHdPart = P(this._checkSetup), ot(this._checkSetup);
		}}
          >
            ${F.map((e) => n`<option .value=${e} ?selected=${e === this._checkSetup}>${e}</option>`)}
          </select>
        </div>
        <span class="label">Also</span>
        <div class="field stack">
          <label class="option"
            ><input
              type="checkbox"
              .checked=${this._checkHdPart}
              ?disabled=${e}
              @change=${(e) => {
			this._checkHdPart = e.target.checked;
		}}
            /><span
              >Switch to HD and back
              <span class="muted">(Home Assistant fetches the high-quality recording from the camera first)</span></span
            ></label
          >
          <label class="option"
            ><input
              type="checkbox"
              .checked=${this._checkSession}
              ?disabled=${e}
              @change=${(e) => {
			this._checkSession = e.target.checked;
		}}
            /><span
              >Then play for ${60} minutes
              <span class="muted">(to see that it keeps playing smoothly)</span></span
            ></label
          >
        </div>
      </div>
      <div class="actions">
        ${e ? n`<button
              @click=${() => {
			this._check?.stop();
		}}
            >
              Stop
            </button>` : n`<button
              class="primary"
              @click=${() => void this.runCheck({
			setup: this._checkSetup,
			soakMinutes: this._checkSession ? 60 : 0,
			hd: this._checkHdPart
		})}
            >
              Run playback check
            </button>`}
        <button @click=${() => void this._loadReports()}>Saved reports</button>
      </div>
      <!-- What it finds is said as it finds it, while it runs. -->
      <div aria-live=${e ? "polite" : "off"}>
        ${r ? n`<rv-findings .summary=${r}></rv-findings>` : t}
      </div>
      ${this._checkText ? n`<details class="support">
            <summary class="small">Details for support${p("chevronDown")}</summary>
            <div class="actions">
              <button @click=${() => void this._copy(this._checkText)}>Copy report</button>
            </div>
            <pre class="report">${this._checkText}</pre>
          </details>` : t}
      ${this._reports ? n`<ul class="reports">
            ${this._reports.length ? this._reports.map((e) => n`<li>
                    <span class="when">${ae(Date.parse(e.updated), this._zone)} · ${e.setup}${e.done ? "" : " · running or cut short"}</span>
                    <button class="text" @click=${() => void this._copy(e.text)}>Copy</button>
                    <button
                      class="text"
                      @click=${() => {
			this._checkText = e.text;
		}}
                    >
                      Show
                    </button>
                  </li>`) : n`<li class="muted">No saved reports yet</li>`}
          </ul>` : t}
    </div>`;
	}
	_renderStorage() {
		if (this.storage !== "not_ready") return t;
		let e = this.recorder === "nvr" ? "The NVR's hard disk" : `${this.cameraName || "The camera"}'s SD card`;
		return n`<div class="banner warning" role="status">
      <strong>${e} is not ready</strong>: not formatted, or failed, so recent recordings may be
      missing. Format it in the Reolink app, or replace it.
    </div>`;
	}
	_renderToolbar() {
		let e = this._view.span;
		return n`<div class="toolbar">
      <div class="group transport">
        <button aria-label="Previous event" title="Previous event" @click=${() => {
			this._jump(-1);
		}}>${p("previous")}</button>
        <button
          class="play"
          aria-label=${this._player?.paused === !1 ? "Pause" : "Play"}
          @click=${() => {
			let e = this._player;
			e?.current ? e.paused ? e.resume() : e.pause() : this._cursor !== void 0 && this.playAt(this._cursor), this.requestUpdate();
		}}
        >${p(this._player?.paused === !1 ? "pause" : "play")}</button>
        <button aria-label="Next event" title="Next event" @click=${() => {
			this._jump(1);
		}}>${p("next")}</button>
      </div>
      <div class="group" role="group" aria-label="Zoom">
        <button aria-label="Zoom out" ?disabled=${A(e, -1) === void 0} @click=${() => this._timeline?.zoom(-1)}>${p("minus")}</button>
        <span class="zoom">${st(this._view.span)}</span>
        <button
          aria-label="Zoom in"
          ?disabled=${A(e, 1) === void 0}
          @click=${() => this._timeline?.zoom(1)}
        >${p("plus")}</button>
      </div>
      <div class="group quality" role="group" aria-label="Quality">
        <button
          class="seg"
          aria-pressed=${this._stream === "sub" ? "true" : "false"}
          @click=${() => {
			this._setStream("sub");
		}}
        >SD</button>
        <button
          class="seg"
          aria-pressed=${this._stream === "main" ? "true" : "false"}
          ?disabled=${!this._hd.main}
          title=${this._hd.reason}
          @click=${() => {
			this._setStream("main");
		}}
        >HD</button>
      </div>
      <div class="group">
        <label class="speed"
          >Speed
          <select
            aria-label="Playback speed"
            @change=${(e) => {
			this._setRate(Number(e.target.value));
		}}
          >
            ${Pe.map((e) => n`<option .value=${String(e)} ?selected=${e === this._rate}>${e}×</option>`)}
          </select></label
        >
        ${this._playing && se() ? n`<button
              class="pip"
              aria-pressed=${this._player?.pip ? "true" : "false"}
              title="Keep watching in a small window over other windows and apps"
              @click=${() => void this._player?.togglePip()}
            >
              ${p("pip")}Picture in picture
            </button>` : t}
        ${this._playing ? n`<a class="download" href=${this._playing.clip_url} download>${p("download")}Download clip</a>` : t}
      </div>
    </div>`;
	}
	_renderFilters() {
		let e = this._day?.events ?? [], r = [.../* @__PURE__ */ new Set([...de(e), ...this._only])];
		return r.length ? n`<div class="chips" role="group" aria-label="What was detected">
      ${r.map((t) => {
			let r = this._only.has(t);
			return n`<button
          class="chip"
          aria-pressed=${r ? "true" : "false"}
          @click=${() => {
				let e = new Set(this._only);
				e.delete(t) || e.add(t), this._only = e;
			}}
        >
          ${p(M([t]))}${pe(t)}
          <span class="count">${e.filter((e) => be(e.types).includes(t)).length}</span>
        </button>`;
		})}
      ${this._only.size ? n`<button class="text clear" @click=${() => {
			this._only = /* @__PURE__ */ new Set();
		}}>Show every event</button>` : t}
    </div>` : t;
	}
	_renderHover() {
		let e = this._hover;
		return e ? n`<div class="hover" style="left: ${Math.max(0, e.x - 80)}px">
      ${e.gap ? t : e.url ? n`<img src=${e.url} alt="" />` : n`<div class="noimg"></div>`}
      <span>${v(e.time, this._zone, !0)}${e.gap ? " · no recording" : ""}</span>
    </div>` : t;
	}
	_renderDebug() {
		let e = this._metrics, r = (e) => e === void 0 ? "–" : `${Math.round(e)} ms`, i = e.timelineServer;
		return n`<details class="debug">
      <summary class="small">Details and playback check${p("chevronDown")}</summary>
      ${this._renderCheck()}
      <details class="tech">
        <summary class="small">Technical details${p("chevronDown")}</summary>
        <dl class="facts">
        <dt>Time to timeline</dt>
        <dd>
          ${r(e.timelineMs)}
          ${i ? n`<span class="muted">(server: ${i.cache ?? "?"}${i.search_ms === void 0 ? "" : `, search ${Math.round(i.search_ms)} ms`})</span>` : t}
        </dd>
        <dt>Time to first frame</dt>
        <dd>${r(e.firstFrameMs)} <span class="muted">(URL ${r(e.urlMs)})</span></dd>
        <dt>Gap at last file change</dt>
        <dd>${r(e.gapMs)}</dd>
        <dt>Reloaded mid-way</dt>
        <dd>${e.recoveries ? `${e.recoveries}× (last: ${e.lastRecovery ?? "?"})` : "never"}</dd>
        <dt>Stream</dt>
        <dd>${e.stream ?? this._stream}${e.codec ? ` · ${e.codec}` : ""}</dd>
        <dt>Cache</dt>
        <dd>${e.cache ? nt(e.cache) : "–"}</dd>
        <dt>HD</dt>
        <dd>${this._hd.reason}</dd>
        <dt>HD failures</dt>
        <dd>${e.hdFailures ? `${e.hdFailures}× (last: ${e.lastHdFailure ?? "?"})` : "none"}</dd>
        <dt>Delivery</dt>
        <dd>
          ${e.delivery ?? (this._progressive ? "progressive" : "whole file first (WebKit)")}${this._playing?.file ? ` · ${this._playing.file} file` : ""}
        </dd>
        <dt>Player</dt>
        <dd>
          ${et(this._player)}
          <select
            aria-label="Player"
            @change=${(e) => {
			this._setMode(e.target.value);
		}}
          >
            <option value="auto" ?selected=${this._mode === "auto"}>MSE where possible</option>
            <option value="file" ?selected=${this._mode === "file"}>File player only</option>
          </select>
        </dd>
        <dt>Fell back to the file player</dt>
        <dd>${e.fallbacks ? `${e.fallbacks}× (last: ${e.lastFallback ?? "?"})` : "never"}</dd>
        <dt>Day</dt>
        <dd>
          ${this._day ? `${this._day.segments.length} recordings, ${this._day.events.length} events${this._day.complete ? ", final" : ""}${this._day.events_error ? `, event search failed (${this._day.events_error})` : ""}` : "–"}
        </dd>
        </dl>
      </details>
    </details>`;
	}
	render() {
		let e = this._day, r = this._zone;
		return n`
      <div class="layout">
        <div class="main">
          <rv-player
            .rate=${this._rate}
            .note=${this._note}
            @rv-first-frame=${(e) => {
			let t = this._metrics.codec ?? $(this._player?.mseStats?.mime);
			this._metrics = {
				...this._metrics,
				firstFrameMs: e.detail.ms,
				codec: t
			}, this._resumeThumbs();
		}}
            @rv-advanced=${(e) => {
			this._onAdvanced(e.detail);
		}}
            @rv-ended=${(e) => {
			this._onEnded(e.detail.segmentId);
		}}
            @rv-time=${(e) => {
			this._onTime(e.detail.time);
		}}
            @rv-player-error=${(e) => {
			this._onPlayerError(e.detail);
		}}
            @rv-pip=${() => {
			this.requestUpdate();
		}}
          ></rv-player>
          <div class="dayline">
            <div class="day-nav" role="group" aria-label="Day">
              <button class="step" aria-label="Previous day" @click=${() => {
			this._changeDay(-1);
		}}>${p("chevronBack")}</button>
              <span class="day" title=${Ee(this._date)}>
                ${this._date === this._today ? "Today" : De(this._date)}
              </span>
              <button
                class="step"
                aria-label="Next day"
                ?disabled=${this._date >= this._today}
                @click=${() => {
			this._changeDay(1);
		}}
              >${p("chevron")}</button>
            </div>
            ${this._loading ? n`<span class="muted small">Loading…</span>` : t}
            <span class="clock">
              ${this._cursor === void 0 ? "--:--:--" : v(this._cursor, r, !0)}
            </span>
          </div>
          ${this._renderStorage()}
          ${this._error ? w(Ge(this._error, {
			name: this.cameraName || "This camera",
			offline: this.offline
		}), `Could not load recordings: ${this._error}`, { help: "recordings" }) : t}
          ${this._playFailure ? w(V(this._playFailure), `Playback failed: ${this._playFailure}`, { help: "recordings" }) : t}
          <div class="timeline-wrap">
            ${this._renderHover()}
            <rv-timeline
              .day=${e}
              .events=${this._events}
              .view=${this._view}
              .cursor=${this._cursor}
              .timeZone=${r}
              @rv-view-change=${(e) => {
			this._view = e.detail.view;
		}}
              @rv-seek=${(e) => {
			this.playAt(e.detail.time);
		}}
              @rv-scrub=${(e) => {
			this._onScrub(e.detail.time);
		}}
              @rv-hover=${(e) => void this._onHover(e.detail)}
              @rv-hover-end=${() => {
			this._hoverSeq += 1, this._hover = void 0;
		}}
            ></rv-timeline>
          </div>
          ${this._renderToolbar()} ${this._renderFilters()}
          ${e && !e.segments.length && !this._loading ? n`<p class="muted">No recordings on this day.</p>` : t}
          ${this._renderDebug()}
        </div>
        <div class="side">
          <rv-calendar
            .year=${this._month.year}
            .month=${this._month.month}
            .days=${this._monthDays}
            .selected=${this._date}
            .today=${this._today}
            .firstDay=${ce(this.hass?.locale?.language)}
            ?loading=${this._monthLoading}
            @rv-month=${(e) => void this._loadMonth(e.detail.year, e.detail.month)}
            @rv-day=${(e) => {
			this._selectDate(e.detail.date);
		}}
          ></rv-calendar>
          <div class="events-head">
            <h2>Events</h2>
            ${e ? n`<span class="muted">
                  ${this._only.size ? `${String(this._events.length)} of ` : ""}${e.events.length}
                  ${e.events.length === 1 ? "event" : "events"}
                </span>` : t}
          </div>
          ${e ? n`<rv-event-list
                .events=${this._events}
                .thumbs=${this._thumbs}
                .current=${this._cursor}
                .playing=${this._playing !== void 0}
                .timeZone=${r}
                @rv-pick=${(e) => {
			this._cursor = e.detail.event.start, this._day && (this._view = N(this._view, e.detail.event.start, this._day)), this.playAt(e.detail.event.start);
		}}
                @rv-thumbs-needed=${(e) => void this._loadThumbs(e.detail.times)}
              ></rv-event-list>` : n`<p class="muted">${this._error ? "This day's events could not be read." : "Reading this day's events…"}</p>`}
        </div>
      </div>
    `;
	}
	static styles = [b, e`
      .layout {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 340px;
        gap: 24px;
      }
      .main,
      .side {
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-width: 0;
      }
      .side {
        gap: 14px;
      }
      @media (max-width: 900px) {
        .layout {
          grid-template-columns: minmax(0, 1fr);
        }
        /* On one column the day's events come before the calendar. */
        .side rv-calendar {
          order: 2;
        }
      }
      .dayline {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px 14px;
        margin-top: 4px;
      }
      .day-nav {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .step {
        width: 36px;
        padding: 0;
        display: grid;
        place-items: center;
      }
      .day {
        min-width: 7.5em;
        text-align: center;
        font-family: var(--rv-font-cond);
        font-size: 19px;
        font-weight: 600;
      }
      .clock {
        margin-left: auto;
        font-family: var(--rv-font-cond);
        font-size: 30px;
        font-weight: 600;
        line-height: 1;
        letter-spacing: 0.01em;
      }
      .timeline-wrap {
        position: relative;
      }
      .hover {
        position: absolute;
        bottom: calc(100% + 6px);
        z-index: 2;
        width: 160px;
        background: var(--rv-board);
        color: var(--rv-on-board);
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.28);
        font-family: var(--rv-font-cond);
        font-size: 15px;
        font-weight: 600;
        text-align: center;
        pointer-events: none;
      }
      .hover span {
        display: block;
        padding: 4px 6px 5px;
      }
      .hover img,
      .hover .noimg {
        display: block;
        width: 100%;
        aspect-ratio: 16 / 9;
        object-fit: cover;
        background: var(--rv-board);
      }
      .toolbar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px 22px;
        padding-top: 2px;
      }
      .group {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .group > button {
        width: 40px;
        padding: 0;
        display: grid;
        place-items: center;
      }
      .group > button.play {
        width: 48px;
        background: var(--rv-text);
        border-color: var(--rv-text);
        color: var(--rv-ground);
      }
      .group > button.play:hover {
        background: var(--rv-text);
        opacity: 0.88;
      }
      .zoom {
        min-width: 48px;
        text-align: center;
        font-family: var(--rv-font-cond);
        font-size: 17px;
        font-weight: 600;
      }
      .quality {
        gap: 0;
      }
      .group > button.seg {
        width: 46px;
        font-family: var(--rv-font-cond);
        font-size: 16px;
        font-weight: 600;
      }
      .group > button.seg + button.seg {
        margin-left: -1px;
      }
      .group > button.seg[aria-pressed="true"] {
        background: var(--rv-text);
        border-color: var(--rv-text);
        color: var(--rv-ground);
      }
      .speed {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        color: var(--rv-muted);
        font-size: 15px;
      }
      .speed select {
        min-height: 36px;
      }
      button.pip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-left: 6px;
      }
      button.pip svg {
        width: 18px;
        height: 18px;
      }
      button.pip[aria-pressed="true"] {
        background: var(--rv-text);
        border-color: var(--rv-text);
        color: var(--rv-ground);
      }
      .download {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-left: 6px;
        font-weight: 500;
        text-decoration: none;
      }
      .download:hover {
        text-decoration: underline;
      }
      .download svg {
        width: 18px;
        height: 18px;
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
      }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        min-height: 34px;
        padding: 0 10px 0 9px;
        border: 1px solid var(--rv-rule);
        font-size: 15px;
        font-weight: 500;
        white-space: nowrap;
      }
      .chip svg {
        width: 18px;
        height: 18px;
      }
      .chip .count {
        color: var(--rv-muted);
        font-weight: 400;
      }
      .chip[aria-pressed="true"] {
        background: var(--rv-text);
        border-color: var(--rv-text);
        color: var(--rv-ground);
      }
      .chip[aria-pressed="true"] .count {
        color: inherit;
        opacity: 0.75;
      }
      .chip[aria-pressed="true"]:hover {
        background: var(--rv-text);
      }
      .clear {
        padding-left: 4px;
      }
      .events-head {
        display: flex;
        align-items: baseline;
        gap: 12px;
      }
      .events-head h2 {
        margin: 0;
      }
      .events-head span {
        font-size: 15px;
      }

      @media (max-width: 600px) {
        .clock {
          font-size: 24px;
        }
        .toolbar {
          gap: 10px 14px;
        }
      }
      .debug dl {
        font-size: 13px;
      }
      .tech {
        margin-top: 12px;
      }
      .check {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-top: 10px;
        padding-top: 12px;
        border-top: 2px solid var(--rv-rule-strong);
      }
      .check h3 {
        margin: 0;
        font-family: var(--rv-font-cond);
        font-size: 21px;
      }
      .check p {
        margin: 0;
      }
      .check .support > .actions {
        margin: 6px 0 10px;
      }
      .reports {
        list-style: none;
        margin: 0;
        padding: 0;
        border-top: 1px solid var(--rv-rule);
      }
      .reports li {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px 12px;
        padding: 6px 0;
        border-bottom: 1px solid var(--rv-rule);
      }
      .reports .when {
        flex: 1;
        min-width: 14em;
        font-size: 15px;
      }
    `];
}, $e = (e) => new Promise((t) => {
	setTimeout(t, e);
}), Q = (e) => `${Math.round(e / 1e6)} MB`;
function $(e) {
	return /codecs="?([^",]+)/.exec(e ?? "")?.[1] ?? null;
}
function et(e) {
	let t = e?.mseStats;
	return t ? [
		t.api,
		t.mime.replace(/^video\/mp4; codecs=/, ""),
		`${t.windows} windows, ${(t.bytes / 1e6).toFixed(1)} MB${t.lastWaitMs === void 0 ? "" : `, last in ${Math.round(t.lastWaitMs)} ms`}`,
		`${Math.round(t.ahead)} s ahead, ${Math.round(t.behind)} s behind`,
		`${t.trims} trims`,
		`from ${t.source === "cut" ? "Reolink protocol cut" : "download"}` + (t.switches ? ` (${t.switches} source switches)` : "")
	].join(" · ") : e?.current ? "file player" : "–";
}
function tt(e, t, n) {
	return n ? "cached file (Range)" : e ? "progressive" : t ? "whole file first (to seek)" : "whole file first (WebKit)";
}
function nt(e) {
	let t = `${(e.bytes / 1e6).toFixed(1)} MB`;
	if (e.error) return `failed: ${e.error}`;
	let n = typeof e.stopped_ms == "number" ? `copied to ${(e.stopped_ms / 6e4).toFixed(1)} min (${t})` : void 0, r = e.complete ? `cached (${t})` : n ?? `filling (${t} so far)`;
	if (typeof e.cut_error == "string") return `${r} · Reolink protocol cut not used: ${e.cut_error}`;
	let i = e.cut;
	if (!i) return r;
	let a = typeof i.first_fragment_ms == "number" ? `first fragment ${Math.round(i.first_fragment_ms)} ms` : "no fragment", o = i.login === "new" ? ", new login" : i.login ? ", shared login" : "";
	return `${r} · Reolink protocol cut: ${i.error ? `failed (${i.error})` : `${a}${o}`}`;
}
function rt() {
	try {
		let e = window.localStorage.getItem(J);
		if (e && F.includes(e)) return e;
	} catch {}
	return Ae(navigator.userAgent);
}
function it() {
	try {
		return window.localStorage.getItem(Y) === "file" ? "file" : "auto";
	} catch {
		return "auto";
	}
}
function at(e) {
	try {
		window.localStorage.setItem(Y, e);
	} catch {}
}
function ot(e) {
	try {
		window.localStorage.setItem(J, e);
	} catch {}
}
function st(e) {
	return e >= 36e5 ? `${Math.round(e / 36e5)} h` : `${Math.round(e / k)} min`;
}
customElements.get("rv-playback") || customElements.define("rv-playback", Z);
//#endregion
export { Ze as CHECK_SESSION_MIN, qe as EVENTS_RETRIES, U as EVENTS_RETRY_MS, K as PRELOAD_LEAD_MS, Ke as PROGRESSIVE_SEEK_LIMIT_MS, q as PROGRESS_EVERY_MS, Xe as RECOVER_EVERY_MS, Z as RvPlayback, W as STALE_TODAY_S, G as THUMB_PAUSE_MAX_MS, H as TODAY_REFRESH_MS, tt as deliveryOf, nt as describeCache, et as describePlayer, $ as videoCodec };

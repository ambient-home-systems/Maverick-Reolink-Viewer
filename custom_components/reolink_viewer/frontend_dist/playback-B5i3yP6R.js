import { $ as e, A as t, At as n, B as r, C as i, D as a, Ft as o, G as s, Gt as c, H as l, Ht as u, I as d, It as f, K as p, Kt as m, L as ee, Lt as te, M as ne, Mt as h, N as re, Nt as g, O as ie, P as _, Pt as ae, Q as oe, R as se, S as ce, T as le, U as v, Ut as y, V as ue, W as de, Wt as b, Z as fe, _ as pe, _t as x, b as me, c as he, d as S, f as C, g as w, h as T, j as ge, jt as E, k as _e, l as D, m as ve, nt as ye, q as be, qt as O, rt as k, s as xe, st as Se, tt as Ce, u as we, w as A, x as Te, yt as Ee, z as j } from "./home-D5-WNgzo.js";
import { dayLabel as De, shortDay as Oe } from "./events-view-BEv24Svj.js";
import { i as ke, m as Ae } from "./findings-CjZkQ2Pp.js";
import { a as je, i as M, n as N, r as Me, t as Ne } from "./check-O1kqbi0u.js";
var Pe = class extends b {
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
	updated() {
		let e = this.visible.filter((e) => !this.thumbs.has(e.start)).map((e) => e.start);
		e.length && this.dispatchEvent(new CustomEvent("rv-thumbs-needed", {
			detail: { times: e },
			bubbles: !0,
			composed: !0
		}));
	}
	_row(e) {
		let t = this.thumbs.get(e.start), n = this.current !== void 0 && this.current >= e.start && this.current < e.end, r = xe(e.types), i = s(e.start, this.timeZone, !0);
		return m`<li>
      <button
        class="row ${n ? "active" : ""}"
        aria-current=${n ? "true" : "false"}
        aria-label="${r}, ${i}${n ? this.playing ? ", playing" : ", selected" : ""}: play"
        @click=${() => {
			this.dispatchEvent(new CustomEvent("rv-pick", {
				detail: { event: e },
				bubbles: !0,
				composed: !0
			}));
		}}
      >
        <span class="t">${i.slice(0, -3)}<small>${i.slice(-3)}</small></span>
        <span class="ev">
          ${x(D(e.types))}<span class="label">${r}</span>
        </span>
        <span class="meta">
          ${n ? m`<span class="tag">${this.playing ? "Playing" : "Selected"}</span>` : c}
          <span>${he(e.end - e.start)}</span>
          ${e.ambiguous ? m`<span title="Recorded in the hour repeated when clocks went back">time ±1 h</span>` : c}
        </span>
        <span class="thumb">${t ? m`<img src=${t} alt="" loading="lazy" decoding="async" />` : c}</span>
      </button>
    </li>`;
	}
	render() {
		if (!this.events.length) return m`<p class="muted empty">No events for the chosen kinds.</p>`;
		let e = this.events.length - this._shown;
		return m`<ol>
        ${this.visible.map((e) => this._row(e))}
      </ol>
      ${e > 0 ? m`<button class="text more" @click=${() => {
			this._shown += 60;
		}}>Show ${Math.min(e, 60)} more (${e} left)</button>` : c}`;
	}
	static styles = [k, O`
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
customElements.get("rv-event-list") || customElements.define("rv-event-list", Pe);
//#endregion
//#region src/playback/player.ts
var Fe = [
	.5,
	1,
	2,
	4,
	8
], Ie = class extends b {
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
		for (let e of [0, 1]) j(this._video(e)).catch(() => void 0);
	}
	get pip() {
		return this._pip;
	}
	async togglePip() {
		let e = this._video(this._active);
		if (e) try {
			if (this._pip) for (let e of [0, 1]) await j(this._video(e));
			else await se(e);
		} catch {}
	}
	_onPipChange = () => {
		let e = r(this._video(0)) || r(this._video(1));
		e !== this._pip && (this._pip = e, this._emit("rv-pip", { pip: e }));
	};
	_carryPip(e, t) {
		e && t && r(e) && ue(e, t);
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
			let i = new fe(t, n.mse, (t) => {
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
		r && this._fail(n.message, r, n instanceof oe);
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
		return m`<video
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
		return m`<div class="frame">
      ${this._renderVideo(0)}${this._renderVideo(1)}
      ${e ? m`<div class="note" role="status">${e}</div>` : c}
      ${this._started ? c : m`<p class="empty">Pick an event or a time on the timeline to play it.</p>`}
    </div>`;
	}
	static styles = O`
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
customElements.get("rv-player") || customElements.define("rv-player", Ie);
//#endregion
//#region src/playback/thumb-loader.ts
var Le = class {
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
}, Re = 4, P = 24, ze = .01, F = 76, I = 18, L = 22, Be = 26, Ve = 52, He = 16, Ue = class extends b {
	static properties = {
		day: { attribute: !1 },
		events: { attribute: !1 },
		view: { attribute: !1 },
		cursor: { attribute: !1 },
		timeZone: { attribute: !1 }
	};
	_width = 0;
	_resize;
	_drag;
	_pointers = /* @__PURE__ */ new Map();
	_pinch;
	_pinched = !1;
	_hoverTimer;
	constructor() {
		super(), this.events = [], this.view = {
			start: 0,
			span: C[0] ?? 864e5
		};
	}
	connectedCallback() {
		super.connectedCallback(), typeof ResizeObserver < "u" && (this._resize = new ResizeObserver(() => {
			this._draw();
		}), this._resize.observe(this));
	}
	disconnectedCallback() {
		super.disconnectedCallback(), this._resize?.disconnect(), clearTimeout(this._hoverTimer);
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
		return re(e, this.view, this._width || 1);
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
		let t = w(e, this._bounds);
		(t.start !== this.view.start || t.span !== this.view.span) && (this.view = t, this._emit("rv-view-change", { view: t }));
	}
	zoom(e, t) {
		let n = a(this.view.span, e);
		if (n === void 0) return;
		let r = t ?? this.cursor ?? this.view.start + this.view.span / 2;
		this._setView(_(this.view, n, r, this._bounds));
	}
	_span(e) {
		let t = C[C.length - 1] ?? 6e4, { start: n, end: r } = this._bounds;
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
			let t = this._span(this.view.span * Math.exp(e.deltaY * ze));
			this._setView(_(this.view, t, this.timeAt(this._x(e)), this._bounds));
		} else if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
			let t = e.shiftKey ? e.deltaY : e.deltaX;
			this.pan(Math.sign(t) * .25);
		} else e.deltaY !== 0 && this.zoom(e.deltaY < 0 ? 1 : -1, this.timeAt(this._x(e)));
	}
	_onPointerDown(e) {
		if (e.button !== 0) return;
		e.isPrimary && (this._pointers.clear(), this._pinch = void 0, this._pinched = !1);
		let t = this._x(e);
		this._pointers.set(e.pointerId, t), R(this._canvas, e.pointerId, !0), this._pointers.size === 2 ? this._startPinch() : this._pinched || this._pointers.size > 2 || (this._drag = {
			pointerId: e.pointerId,
			x: t,
			moved: !1
		});
	}
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
		let [n = 0, r = 0] = t, i = Math.abs(n - r), a = e.dist >= P && i >= P ? this._span(e.span * e.dist / i) : this.view.span, o = (n + r) / 2;
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
			if (Math.abs(t - n.x) > Re && (n.moved = !0), n.moved) {
				let e = this.timeAt(t);
				n.time = e, this._emit("rv-scrub", { time: e }), this._scheduleHover(e, t);
			}
		} else e.pointerType === "mouse" && this._scheduleHover(this.timeAt(t), t);
	}
	_onPointerUp(e) {
		if (this._pointers.delete(e.pointerId), R(this._canvas, e.pointerId, !1), this._pinched) {
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
		let t = {
			ArrowLeft: () => {
				this.pan(-.25);
			},
			ArrowRight: () => {
				this.pan(.25);
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
		}[e.key];
		t && (e.preventDefault(), t());
	}
	_draw() {
		let e = this._canvas;
		if (!e) return;
		let n = Math.max(1, Math.round(this.getBoundingClientRect().width || e.clientWidth || 300));
		this._width = n;
		let r = window.devicePixelRatio || 1;
		e.width !== n * r && (e.width = n * r, e.height = F * r);
		let i = e.getContext("2d");
		if (!i) return;
		i.setTransform(r, 0, 0, r, 0, 0);
		let a = getComputedStyle(this), o = (e, t) => a.getPropertyValue(e).trim() || t, c = o("--rv-text", "#111418"), l = o("--rv-muted", "#5d6370");
		i.clearRect(0, 0, n, F);
		let u = this.view, d = (e) => ge(e, u, n);
		i.font = `500 12px ${o("--rv-font", "sans-serif")}`, i.textBaseline = "top", i.fillStyle = l, i.strokeStyle = o("--rv-rule", "#e0e0e0"), i.lineWidth = 1;
		let f = this.timeZone, p = _e(u, n) < S;
		for (let e of t(u, n, (e) => be(e, f))) {
			let t = Math.round(d(e)) + .5;
			i.beginPath(), i.moveTo(t, 14), i.lineTo(t, F), i.stroke();
			let r = s(e, f, p);
			t + 3 + i.measureText(r).width <= n && i.fillText(r, t + 3, 2);
		}
		let m = this.day;
		if (m) {
			if (m.now < m.end) {
				i.fillStyle = o("--rv-ground-2", "#f2f2f2");
				let e = Math.max(0, d(m.now));
				i.fillRect(e, L, n - e, 54);
			}
			i.fillStyle = o("--rv-recording", "#1b2a6e");
			for (let e of ve(m.segments, u, n)) {
				let t = Math.max(0, d(e.start)), r = Math.min(n, d(e.end));
				i.fillRect(t, L, Math.max(1, r - t), Be);
			}
			i.fillStyle = c;
			for (let e of this.events) {
				if (e.end < u.start || e.start > u.start + u.span) continue;
				let t = d(e.start), n = Math.max(3, d(e.end) - t);
				i.fillRect(t, Ve, n, He);
			}
			m.now < m.end && m.now >= u.start && m.now <= u.start + u.span && (i.fillStyle = o("--rv-red", "#e10600"), i.fillRect(Math.round(d(m.now)) - 1, I, 2, 58));
		}
		if (this.cursor !== void 0) {
			let e = Math.round(d(this.cursor));
			i.fillStyle = c, i.fillRect(e - 1, I, 2, 58), i.beginPath(), i.moveTo(e - 6, 14), i.lineTo(e + 6, 14), i.lineTo(e, 21), i.closePath(), i.fill();
		}
	}
	render() {
		return m`<canvas
      role="slider"
      tabindex="0"
      aria-label="Recording timeline"
      aria-valuemin=${this.day?.start ?? 0}
      aria-valuemax=${this.day?.end ?? 0}
      aria-valuenow=${this.cursor ?? 0}
      aria-valuetext=${this.cursor === void 0 ? "no position" : s(this.cursor, this.timeZone, !0)}
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
      @keydown=${(e) => {
			this._onKey(e);
		}}
    ></canvas>`;
	}
	static styles = O`
    :host {
      display: block;
      position: relative;
    }
    canvas {
      display: block;
      width: 100%;
      height: ${F}px;
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
function R(e, t, n) {
	try {
		n ? e?.setPointerCapture(t) : e?.releasePointerCapture(t);
	} catch {}
}
customElements.get("rv-timeline") || customElements.define("rv-timeline", Ue);
//#endregion
//#region src/components/playback.ts
var z = 6e4, We = 3e3, B = 1e4, Ge = 3, V = 86400, Ke = 10 * S, qe = 10, H = 8e3, U = 3 * S, Je = 6e4, Ye = 60, W = 1e3, Xe = 6e4, G = "reolink-viewer-check-setup", K = "reolink-viewer-player", q = !1, J = class extends b {
	static properties = {
		hass: { attribute: !1 },
		deviceId: { attribute: !1 },
		cameraName: { attribute: !1 },
		at: { attribute: !1 },
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
	_openedAt;
	_playSeq = 0;
	_hoverSeq = 0;
	_monthSeq = 0;
	_thumbsRequested = /* @__PURE__ */ new Set();
	thumbLoader = new Le();
	_thumbPause;
	_eventsRetry;
	_eventsRetries = 0;
	_refreshTimer;
	_lastCursorPaint = 0;
	_progressive = ye();
	_check;
	_starting;
	_preloadPending;
	_recoveredAt = -Infinity;
	_mseFailed = /* @__PURE__ */ new Set();
	_lastPreview = 0;
	constructor() {
		super(), this.deviceId = "", this.cameraName = "", this._date = "", this._loading = !1, this._view = {
			start: 0,
			span: we
		}, this._only = /* @__PURE__ */ new Set();
		let e = /* @__PURE__ */ new Date();
		this._month = {
			year: e.getFullYear(),
			month: e.getMonth() + 1
		}, this._monthDays = /* @__PURE__ */ new Set(), this._monthLoading = !1, this._stream = "sub", this._hd = {
			main: !1,
			reason: "checking…"
		}, this._thumbs = /* @__PURE__ */ new Map(), this._metrics = {}, this._checkText = "", this._checkRunning = !1, this._checkSetup = Qe(), this._checkSession = !1, this._checkHdPart = M(this._checkSetup), this._rate = 1, this._mode = $e();
	}
	get _zone() {
		return this.hass?.config?.time_zone;
	}
	get _today() {
		return v(Date.now(), this._zone);
	}
	get _player() {
		return this.renderRoot.querySelector("rv-player");
	}
	get _timeline() {
		return this.renderRoot.querySelector("rv-timeline");
	}
	get _events() {
		return pe(this._day?.events ?? [], this._only);
	}
	connectedCallback() {
		super.connectedCallback(), this._refreshTimer = setInterval(() => {
			this._date === this._today && document.visibilityState !== "hidden" && this._loadDay(this._date, {
				keepView: !0,
				quiet: !0
			});
		}, z);
	}
	disconnectedCallback() {
		super.disconnectedCallback(), clearInterval(this._refreshTimer), this._player?.stop(), this.thumbLoader.clear(), clearTimeout(this._thumbPause), clearTimeout(this._eventsRetry), this._check?.stop();
	}
	willUpdate(e) {
		if ((e.has("deviceId") || e.has("hass")) && this.hass && this.deviceId && !this._date) {
			this._date = this.at === void 0 ? this._today : v(this.at, this._zone);
			let [e, t] = this._date.split("-").map(Number);
			e && t && (this._month = {
				year: e,
				month: t
			}), this._loadDay(this._date).then(() => {
				this._openAt();
			}), this._loadMonth(this._month.year, this._month.month), this._checkHd(), q || (q = !0, je(this.hass).then((e) => {
				this._checkNote = e;
			}));
		} else if (e.has("at") && this.at !== void 0 && this._date) {
			let e = v(this.at, this._zone);
			e === this._date ? this._openAt() : this._selectDate(e).then(() => {
				this._openAt();
			});
		}
	}
	_openAt() {
		let e = this.at, t = this._day;
		e !== void 0 && e !== this._openedAt && t && v(e, this._zone) === t.date && (this._openedAt = e, this._cursor = e, this._view = T(this._view, e, t), this.playAt(e));
	}
	async _loadDay(e, t = {}) {
		let n = this.hass;
		if (!n) return;
		let r = ++this._daySeq, i = performance.now(), a = !1;
		t.quiet || (this._loading = !0);
		try {
			let o = await ae(n, this.deviceId, e, t.quiet ? 0 : V);
			if (r !== this._daySeq) return;
			let s = !this._day || this._day.date !== o.date;
			if (this._day = o, this._error = void 0, s || !t.keepView) {
				this._view = w({
					start: o.start,
					span: o.end - o.start
				}, o);
				let e = o.events.at(-1)?.start ?? o.segments.at(-1)?.start;
				this._cursor = e;
			} else this._view = w(this._view, o);
			await this.updateComplete, t.quiet || (this._metrics = {
				...this._metrics,
				timelineMs: performance.now() - i,
				timelineServer: o.timing
			}), this._warmLongRecording(o), a = !t.quiet && o.timing.cache === "stale", this._retryEventsSoon(o);
		} catch (e) {
			r === this._daySeq && (this._error = u(e).message);
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
		}, B));
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
			let i = await o(n, this.deviceId, e, t);
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
			let t = await n(e, this.deviceId);
			this._hd = await Ce(t.main), this._metrics = {
				...this._metrics,
				hd: this._hd.reason
			};
		} catch {
			this._hd = {
				main: !1,
				reason: "main stream information unavailable"
			};
		}
	}
	_warmLongRecording(e) {
		let t = this.hass, n = this._cursor === void 0 ? e.segments.at(-1) : A(e.segments, this._cursor);
		!t || !n || n.end - n.start < Ke || f(t, this._ref(n)).catch(() => void 0);
	}
	_ref(e, t = this._stream) {
		return {
			deviceId: this.deviceId,
			date: this._date,
			segmentId: e.id,
			stream: t
		};
	}
	async playAt(t, n = performance.now()) {
		let r = this.hass, i = this._day;
		if (!r || !i) return;
		let a = Te(i.segments, t);
		if (!a) {
			d(this, "No recording after this time on this day");
			return;
		}
		let o = ++this._playSeq;
		this._playFailure = void 0, this._pauseThumbs();
		let s = a.segment.start + a.offset;
		if (this._cursor = s, this._seekWithin(a.segment, s, n)) {
			this._schedulePreload(a.segment, o, s);
			return;
		}
		this._starting = o;
		let c = performance.now();
		try {
			let t = this._useMse(this._stream), i = this._progressive && a.offset < 3e3, l = this._ref(a.segment), u = t ? await E(r, l, s) : await h(r, l, i, s);
			if (o !== this._playSeq) {
				this._release(u);
				return;
			}
			this._playing = u, this._metrics = {
				...this._metrics,
				urlMs: performance.now() - c,
				firstFrameMs: void 0,
				gapMs: void 0,
				stream: u.stream,
				cache: u.cache,
				codec: u.media?.codec ?? null,
				delivery: t ? `MSE (${e() ?? "?"})${u.cache.complete ? ", cached" : ""}` : Q(i, this._progressive, u.cache.complete)
			};
			let d = Math.max(0, s - u.start);
			await this._player?.play(this._toItem(u), d, n), this._showDownload(u, o), this._schedulePreload(a.segment, o, s);
		} catch (e) {
			o === this._playSeq && this._playError(u(e).message);
		} finally {
			this._starting === o && (this._starting = void 0);
		}
	}
	_seekWithin(t, n, r) {
		let i = this._player, a = i?.current;
		return !i?.mse || !this._useMse(this._stream) || !a || a.segmentId !== t.id || this._playing?.stream !== this._stream || a.end < t.end && n > a.end - Xe ? !1 : (this._metrics = {
			...this._metrics,
			urlMs: 0,
			firstFrameMs: void 0,
			delivery: `MSE (${e() ?? "?"}), same recording`
		}, i.seekWithin(Math.max(0, n - a.start), r), !0);
	}
	_describeMode() {
		let t = e();
		if (this._mode === "file") return "file player only (set under Details)";
		if (!t) return "file player (this browser has no MSE)";
		if (typeof this.hass?.fetchWithAuth != "function") return "file player (no authenticated fetch)";
		let n = [...this._mseFailed];
		return `MSE (${t})${n.length ? `, file player for ${n.join(", ")} after a failure` : ""}`;
	}
	_useMse(t) {
		return this._mode === "auto" && e() !== void 0 && typeof this.hass?.fetchWithAuth == "function" && !this._mseFailed.has(t);
	}
	_release(e) {
		let t = this.hass, n = y(e.base ?? e.url ?? "");
		t && n && te(t, [n]).catch(() => void 0);
	}
	_toItem(e) {
		let t = {
			recording: `${e.stream}:${e.segment_id}:${e.end}`,
			segmentId: e.segment_id,
			start: e.start,
			end: e.end,
			release: () => {
				this._release(e);
			}
		}, n = this.hass;
		if (e.base && n?.fetchWithAuth) {
			let r = n.fetchWithAuth.bind(n);
			return {
				...t,
				key: e.base,
				mse: {
					base: e.base,
					fetch: r,
					durationMs: e.end - e.start
				}
			};
		}
		let r = e.url ?? "";
		return {
			...t,
			key: r,
			url: r
		};
	}
	async _showDownload(e, t) {
		let n = this.hass, r = y(e.base ?? e.url ?? "");
		if (!n || !r || e.cache.complete) return;
		let i = () => t === this._playSeq && this._metrics.firstFrameMs === void 0 && !this._playFailure;
		for (; i() && (await Ze(W), i());) try {
			let t = await Ee(n, r);
			if (!i() || !t.cache || t.cache.complete || t.cache.error) break;
			let a = e.stream === "main" ? "HD " : "";
			this._note = `Fetching the ${a}recording from the recorder: ${Y(t.cache.bytes)} of about ${Y(t.expected_bytes)}`;
		} catch {
			break;
		}
		t === this._playSeq && (this._note = void 0);
	}
	_schedulePreload(e, t, n) {
		this._preloadPending = void 0;
		let r = this.hass, i = this._nextSegment(e);
		!r || !i || e.end - n <= U ? this._preloadAfter(e, t) : (this._player?.preload(void 0), f(r, this._ref(i)).catch(() => void 0), this._preloadPending = {
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
			let e = this._ref(r), i = this._useMse(this._stream) ? await E(n, e, r.start) : await h(n, e, this._progressive, r.start);
			if (t !== this._playSeq) {
				this._release(i);
				return;
			}
			await this._player?.preload(this._toItem(i));
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
		}, H);
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
		}, d(this, `HD failed (${e}); back to the sub stream`, "error"), this._cursor !== void 0 && this.playAt(this._cursor)) : (this._playFailure = e, d(this, `Playback failed: ${e}`, "error"));
	}
	_onTime(e) {
		if (this._starting !== void 0) return;
		let t = performance.now();
		if (t - this._lastCursorPaint < 250) return;
		this._lastCursorPaint = t;
		let n = this._preloadPending;
		n && n.seq === this._playSeq && n.segment.end - e <= U && (this._preloadPending = void 0, this._preloadAfter(n.segment, n.seq)), this._cursor = e, (e > this._view.start + this._view.span || e < this._view.start) && (this._view = T(this._view, e, this._day ?? {
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
		let t = this._cursor ?? this._view.start, n = e > 0 ? me(this._events, t) : i(this._events, t);
		n ? (this._cursor = n.start, this._day && (this._view = T(this._view, n.start, this._day)), this.playAt(n.start)) : d(this, e > 0 ? "No later event" : "No earlier event");
	}
	_setRate(e) {
		this._rate = e;
	}
	_setMode(e) {
		this._mode = e, this._mseFailed.clear(), et(e);
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
		if (!t || !this._day || !A(this._day.segments, e.time)) {
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
			let i = (await g(t, this.deviceId, [e.time], ie(this._view.span))).urls[0]?.url;
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
				let e = await g(t, this.deviceId, n, qe), r = this._date;
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
		let t = new Ne(this._checkTarget(), e, () => {
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
			this._reports = (await Me(this.hass)).reports.filter((e) => !e.setup.startsWith(Se));
		} catch (e) {
			d(this, `Could not load the reports: ${u(e).message}`, "error");
		}
	}
	async _copy(e) {
		await ee(e) ? d(this, "Report copied") : d(this, "Copying is blocked here: select the report text and copy it", "error");
	}
	_renderCheck() {
		let e = this._checkRunning, t = e ? this._check?.inShort() : ke(this._checkText);
		return m`<div class="check">
      <h3>Playback check</h3>
      <p class="small">
        How quickly ${this.cameraName}'s recordings open and play on this device: the timeline, events,
        long recordings, fast forward and HD. It takes a few minutes; keep this page open and in front.
        Each run is saved, so you can read it later on any device.
      </p>
      ${this._checkNote ? m`<div class="banner error" role="alert">${this._checkNote}</div>` : c}
      <div class="form">
        <span class="label" id="check-setup">This device and network</span>
        <div class="field">
          <select
            aria-labelledby="check-setup"
            ?disabled=${e}
            @change=${(e) => {
			this._checkSetup = e.target.value, this._checkHdPart = M(this._checkSetup), tt(this._checkSetup);
		}}
          >
            ${N.map((e) => m`<option .value=${e} ?selected=${e === this._checkSetup}>${e}</option>`)}
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
        ${e ? m`<button
              @click=${() => {
			this._check?.stop();
		}}
            >
              Stop
            </button>` : m`<button
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
      ${t ? m`<rv-findings .summary=${t}></rv-findings>` : c}
      ${this._checkText ? m`<details class="support">
            <summary class="small">Details for support${x("chevronDown")}</summary>
            <div class="actions">
              <button @click=${() => void this._copy(this._checkText)}>Copy report</button>
            </div>
            <pre class="report">${this._checkText}</pre>
          </details>` : c}
      ${this._reports ? m`<ul class="reports">
            ${this._reports.length ? this._reports.map((e) => m`<li>
                    <span class="when">${p(Date.parse(e.updated), this._zone)} · ${e.setup}${e.done ? "" : " · running or cut short"}</span>
                    <button class="text" @click=${() => void this._copy(e.text)}>Copy</button>
                    <button
                      class="text"
                      @click=${() => {
			this._checkText = e.text;
		}}
                    >
                      Show
                    </button>
                  </li>`) : m`<li class="muted">No saved reports yet</li>`}
          </ul>` : c}
    </div>`;
	}
	_renderToolbar() {
		let e = this._view.span;
		return m`<div class="toolbar">
      <div class="group transport">
        <button aria-label="Previous event" title="Previous event" @click=${() => {
			this._jump(-1);
		}}>${x("previous")}</button>
        <button
          class="play"
          aria-label=${this._player?.paused === !1 ? "Pause" : "Play"}
          @click=${() => {
			let e = this._player;
			e?.current ? e.paused ? e.resume() : e.pause() : this._cursor !== void 0 && this.playAt(this._cursor), this.requestUpdate();
		}}
        >${x(this._player?.paused === !1 ? "pause" : "play")}</button>
        <button aria-label="Next event" title="Next event" @click=${() => {
			this._jump(1);
		}}>${x("next")}</button>
      </div>
      <div class="group" role="group" aria-label="Zoom">
        <button aria-label="Zoom out" ?disabled=${a(e, -1) === void 0} @click=${() => this._timeline?.zoom(-1)}>${x("minus")}</button>
        <span class="zoom">${nt(this._view.span)}</span>
        <button
          aria-label="Zoom in"
          ?disabled=${a(e, 1) === void 0}
          @click=${() => this._timeline?.zoom(1)}
        >${x("plus")}</button>
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
            ${Fe.map((e) => m`<option .value=${String(e)} ?selected=${e === this._rate}>${e}×</option>`)}
          </select></label
        >
        ${this._playing && l() ? m`<button
              class="pip"
              aria-pressed=${this._player?.pip ? "true" : "false"}
              title="Keep watching in a small window over other windows and apps"
              @click=${() => void this._player?.togglePip()}
            >
              ${x("pip")}Picture in picture
            </button>` : c}
        ${this._playing ? m`<a class="download" href=${this._playing.clip_url} download>${x("download")}Download clip</a>` : c}
      </div>
    </div>`;
	}
	_renderFilters() {
		let e = this._day?.events ?? [], t = [.../* @__PURE__ */ new Set([...ce(e), ...this._only])];
		return t.length ? m`<div class="chips" role="group" aria-label="What was detected">
      ${t.map((t) => {
			let n = this._only.has(t);
			return m`<button
          class="chip"
          aria-pressed=${n ? "true" : "false"}
          @click=${() => {
				let e = new Set(this._only);
				e.delete(t) || e.add(t), this._only = e;
			}}
        >
          ${x(D([t]))}${ne(t)}
          <span class="count">${e.filter((e) => le(e.types).includes(t)).length}</span>
        </button>`;
		})}
      ${this._only.size ? m`<button class="text clear" @click=${() => {
			this._only = /* @__PURE__ */ new Set();
		}}>Show every event</button>` : c}
    </div>` : c;
	}
	_renderHover() {
		let e = this._hover;
		return e ? m`<div class="hover" style="left: ${Math.max(0, e.x - 80)}px">
      ${e.gap ? c : e.url ? m`<img src=${e.url} alt="" />` : m`<div class="noimg"></div>`}
      <span>${s(e.time, this._zone, !0)}${e.gap ? " · no recording" : ""}</span>
    </div>` : c;
	}
	_renderDebug() {
		let e = this._metrics, t = (e) => e === void 0 ? "–" : `${Math.round(e)} ms`, n = e.timelineServer;
		return m`<details class="debug">
      <summary class="small">Details and playback check${x("chevronDown")}</summary>
      ${this._renderCheck()}
      <details class="tech">
        <summary class="small">Technical details${x("chevronDown")}</summary>
        <dl class="facts">
        <dt>Time to timeline</dt>
        <dd>
          ${t(e.timelineMs)}
          ${n ? m`<span class="muted">(server: ${n.cache ?? "?"}${n.search_ms === void 0 ? "" : `, search ${Math.round(n.search_ms)} ms`})</span>` : c}
        </dd>
        <dt>Time to first frame</dt>
        <dd>${t(e.firstFrameMs)} <span class="muted">(URL ${t(e.urlMs)})</span></dd>
        <dt>Gap at last file change</dt>
        <dd>${t(e.gapMs)}</dd>
        <dt>Reloaded mid-way</dt>
        <dd>${e.recoveries ? `${e.recoveries}× (last: ${e.lastRecovery ?? "?"})` : "never"}</dd>
        <dt>Stream</dt>
        <dd>${e.stream ?? this._stream}${e.codec ? ` · ${e.codec}` : ""}</dd>
        <dt>Cache</dt>
        <dd>${e.cache ? $(e.cache) : "–"}</dd>
        <dt>HD</dt>
        <dd>${this._hd.reason}</dd>
        <dt>Delivery</dt>
        <dd>
          ${e.delivery ?? (this._progressive ? "progressive" : "whole file first (WebKit)")}${this._playing?.file ? ` · ${this._playing.file} file` : ""}
        </dd>
        <dt>Player</dt>
        <dd>
          ${Z(this._player)}
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
		let e = this._day, t = this._zone;
		return m`
      <div class="layout">
        <div class="main">
          <rv-player
            .rate=${this._rate}
            .note=${this._note}
            @rv-first-frame=${(e) => {
			let t = this._metrics.codec ?? X(this._player?.mseStats?.mime);
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
		}}>${x("chevronBack")}</button>
              <span class="day" title=${De(this._date)}>
                ${this._date === this._today ? "Today" : Oe(this._date)}
              </span>
              <button
                class="step"
                aria-label="Next day"
                ?disabled=${this._date >= this._today}
                @click=${() => {
			this._changeDay(1);
		}}
              >${x("chevron")}</button>
            </div>
            ${this._loading ? m`<span class="muted small">Loading…</span>` : c}
            <span class="clock">
              ${this._cursor === void 0 ? "--:--:--" : s(this._cursor, t, !0)}
            </span>
          </div>
          ${this._error ? m`<div class="banner error" role="alert">Could not load recordings: ${this._error}</div>` : c}
          ${this._playFailure ? m`<div class="banner error" role="alert">Playback failed: ${this._playFailure}</div>` : c}
          <div class="timeline-wrap">
            ${this._renderHover()}
            <rv-timeline
              .day=${e}
              .events=${this._events}
              .view=${this._view}
              .cursor=${this._cursor}
              .timeZone=${t}
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
          ${e && !e.segments.length && !this._loading ? m`<p class="muted">No recordings on this day.</p>` : c}
          ${this._renderDebug()}
        </div>
        <div class="side">
          <rv-calendar
            .year=${this._month.year}
            .month=${this._month.month}
            .days=${this._monthDays}
            .selected=${this._date}
            .today=${this._today}
            .firstDay=${de(this.hass?.locale?.language)}
            ?loading=${this._monthLoading}
            @rv-month=${(e) => void this._loadMonth(e.detail.year, e.detail.month)}
            @rv-day=${(e) => {
			this._selectDate(e.detail.date);
		}}
          ></rv-calendar>
          <div class="events-head">
            <h2>Events</h2>
            ${e ? m`<span class="muted">
                  ${this._only.size ? `${String(this._events.length)} of ` : ""}${e.events.length}
                  ${e.events.length === 1 ? "event" : "events"}
                </span>` : c}
          </div>
          <rv-event-list
            .events=${this._events}
            .thumbs=${this._thumbs}
            .current=${this._cursor}
            .playing=${this._playing !== void 0}
            .timeZone=${t}
            @rv-pick=${(e) => {
			this._cursor = e.detail.event.start, this._day && (this._view = T(this._view, e.detail.event.start, this._day)), this.playAt(e.detail.event.start);
		}}
            @rv-thumbs-needed=${(e) => void this._loadThumbs(e.detail.times)}
          ></rv-event-list>
        </div>
      </div>
    `;
	}
	static styles = [k, O`
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
}, Ze = (e) => new Promise((t) => {
	setTimeout(t, e);
}), Y = (e) => `${Math.round(e / 1e6)} MB`;
function X(e) {
	return /codecs="?([^",]+)/.exec(e ?? "")?.[1] ?? null;
}
function Z(e) {
	let t = e?.mseStats;
	return t ? [
		t.api,
		t.mime.replace(/^video\/mp4; codecs=/, ""),
		`${t.windows} windows, ${(t.bytes / 1e6).toFixed(1)} MB${t.lastWaitMs === void 0 ? "" : `, last in ${Math.round(t.lastWaitMs)} ms`}`,
		`${Math.round(t.ahead)} s ahead, ${Math.round(t.behind)} s behind`,
		`${t.trims} trims`
	].join(" · ") : e?.current ? "file player" : "–";
}
function Q(e, t, n) {
	return n ? "cached file (Range)" : e ? "progressive" : t ? "whole file first (to seek)" : "whole file first (WebKit)";
}
function $(e) {
	let t = `${(e.bytes / 1e6).toFixed(1)} MB`;
	return e.error ? `failed: ${e.error}` : e.complete ? `cached (${t})` : `filling (${t} so far)`;
}
function Qe() {
	try {
		let e = window.localStorage.getItem(G);
		if (e && N.includes(e)) return e;
	} catch {}
	return Ae(navigator.userAgent);
}
function $e() {
	try {
		return window.localStorage.getItem(K) === "file" ? "file" : "auto";
	} catch {
		return "auto";
	}
}
function et(e) {
	try {
		window.localStorage.setItem(K, e);
	} catch {}
}
function tt(e) {
	try {
		window.localStorage.setItem(G, e);
	} catch {}
}
function nt(e) {
	return e >= 36e5 ? `${Math.round(e / 36e5)} h` : `${Math.round(e / S)} min`;
}
customElements.get("rv-playback") || customElements.define("rv-playback", J);
//#endregion
export { Ye as CHECK_SESSION_MIN, Ge as EVENTS_RETRIES, B as EVENTS_RETRY_MS, U as PRELOAD_LEAD_MS, We as PROGRESSIVE_SEEK_LIMIT_MS, W as PROGRESS_EVERY_MS, Je as RECOVER_EVERY_MS, J as RvPlayback, V as STALE_TODAY_S, H as THUMB_PAUSE_MAX_MS, z as TODAY_REFRESH_MS, Q as deliveryOf, $ as describeCache, Z as describePlayer, X as videoCodec };

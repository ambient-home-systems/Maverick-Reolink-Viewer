import { a as e, n as t, r as n, t as r } from "./lit-DdRjbP0M.js";
import { X as i, _t as a, c as o, d as s, gt as c, j as l, kt as u } from "./live-_jyOGRi0.js";
import { c as d, l as f } from "./home-C-2P8fU_.js";
//#region src/components/event-pictures.ts
var p = 5e3, m = 15, h = 5, g = 1e3;
function _(e) {
	let t = Math.floor(Math.max(0, e.end - e.start) / p) + 1;
	return Array.from({ length: Math.min(15, t) }, (t, n) => e.start + n * p);
}
function v(e, t) {
	if (!e.length) return;
	if (t === void 0) return e.reduce((e, t) => t.start > e.start ? t : e);
	let n = e.find((e) => e.start <= t && t <= e.end);
	if (n) return n;
	let r = e.filter((e) => e.start <= t);
	return r.length ? r.reduce((e, t) => t.start > e.start ? t : e) : e[0];
}
var y = class extends r {
	static properties = {
		hass: { attribute: !1 },
		deviceId: { attribute: !1 },
		cameraName: { attribute: !1 },
		at: { attribute: !1 },
		_date: { state: !0 },
		_day: { state: !0 },
		_error: { state: !0 },
		_selected: { state: !0 },
		_urls: { state: !0 },
		_index: { state: !0 },
		_picture: { state: !0 },
		_playing: { state: !0 }
	};
	_loadSeq = 0;
	_picturesSeq = 0;
	_timer;
	constructor() {
		super(), this.deviceId = "", this.cameraName = "", this._urls = [], this._index = 0, this._picture = "loading", this._playing = !1;
	}
	disconnectedCallback() {
		super.disconnectedCallback(), this._stop();
	}
	get _zone() {
		return this.hass?.config?.time_zone;
	}
	get _today() {
		return o(Date.now(), this._zone);
	}
	willUpdate(e) {
		if (this.hass && this.deviceId && (e.has("at") || e.has("deviceId") || this._date === void 0)) {
			let e = o(this.at ?? Date.now(), this._zone);
			this._date = e, this._load(e, this.at);
		}
	}
	async _load(e, t) {
		let n = this.hass;
		if (!n) return;
		let r = ++this._loadSeq;
		this._stop(), this._day = void 0, this._error = void 0, this._selected = void 0, this._urls = [];
		try {
			let i = await a(n, this.deviceId, e);
			if (r !== this._loadSeq) return;
			this._day = i;
			let o = v(i.events, t);
			o && this._open(o);
		} catch (e) {
			r === this._loadSeq && (this._error = u(e).message);
		}
	}
	async _open(e) {
		let t = this.hass;
		if (!t) return;
		let n = ++this._picturesSeq;
		this._stop(), this._selected = e.start, this._urls = [], this._index = 0, this._picture = "loading";
		try {
			let { urls: r } = await c(t, this.deviceId, _(e), h);
			if (n !== this._picturesSeq) return;
			this._urls = r.map((e) => e.url), this._preload(1);
		} catch {
			n === this._picturesSeq && (this._picture = "missing");
		}
	}
	_preload(e) {
		let t = this._urls[e];
		t && typeof Image < "u" && (new Image().src = t);
	}
	_show(e) {
		e < 0 || e >= this._urls.length || e === this._index || (this._index = e, this._picture = "loading", this._preload(e + 1));
	}
	_togglePlay() {
		this._playing ? this._stop() : (this._index >= this._urls.length - 1 && this._show(0), this._playing = !0, this._timer = setInterval(() => {
			this._index >= this._urls.length - 1 ? this._stop() : this._show(this._index + 1);
		}, g));
	}
	_stop() {
		clearInterval(this._timer), this._timer = void 0, this._playing = !1;
	}
	_shift(e) {
		let [t, n, r] = (this._date ?? this._today).split("-").map(Number);
		if (!t || !n || !r) return;
		let i = new Date(Date.UTC(t, n - 1, r + e)).toISOString().slice(0, 10);
		i > this._today || (this._date = i, this._load(i, void 0));
	}
	render() {
		let e = this.cameraName || "This camera", t = (this._date ?? this._today) === this._today;
		return n`<div class="note">
        <h2>Pictures of its events</h2>
        <p>
          ${e} keeps its recordings where Reolink Viewer cannot play them yet. Here are its events, with
          pictures from each; play the recordings in the Reolink app.
        </p>
      </div>
      <div class="day-nav" role="group" aria-label="Day">
        <button class="step" aria-label="The day before" @click=${() => {
			this._shift(-1);
		}}>${i("chevronBack")}</button>
        <span class="day">${t ? "Today" : x(this._date ?? this._today)}</span>
        <button class="step" aria-label="The day after" ?disabled=${t} @click=${() => {
			this._shift(1);
		}}>${i("chevron")}</button>
      </div>
      ${this._renderBody()}`;
	}
	_renderBody() {
		if (this._error) return n`<p class="muted" role="alert">
        Could not load this day's events: ${this._error}.
        <button class="text" @click=${() => {
			this._date && this._load(this._date, this.at);
		}}>Try again</button>
      </p>`;
		let e = this._day;
		if (!e) return n`<p class="muted" aria-live="polite">Looking for events…</p>`;
		if (!e.events.length) return n`<p class="muted">No events on this day.</p>`;
		let r = [...e.events].sort((e, t) => t.start - e.start), i = e.events.find((e) => e.start === this._selected);
		return n`<div class="layout">
      ${i ? this._renderViewer(i) : t}
      <ol class="events" aria-label="The day's events">
        ${r.map((e) => n`<li>
            <button aria-pressed=${e.start === this._selected ? "true" : "false"} @click=${() => {
			this._open(e);
		}}>
              <span class="time">${s(e.start, this._zone, !0)}</span>
              <span class="what">${d(e.types)}</span>
              <span class="muted">${f(e.end - e.start)}</span>
            </button>
          </li>`)}
      </ol>
    </div>`;
	}
	_renderViewer(e) {
		let r = this._urls.length, a = this._urls[this._index], o = e.start + this._index * p, c = d(e.types);
		return n`<figure class="viewer">
      <div class="frame">
        ${a ? n`<img
              src=${a}
              alt=${`${c} at ${s(o, this._zone, !0)}`}
              class=${this._picture === "shown" ? "" : "hidden"}
              @load=${() => {
			this._picture = "shown";
		}}
              @error=${() => {
			this._picture = "missing";
		}}
            />` : t}
        ${this._picture === "loading" ? n`<span class="wait" aria-live="polite">Asking the camera for the picture…</span>` : this._picture === "missing" ? n`<span class="wait">No picture of this moment.</span>` : t}
      </div>
      <figcaption>
        <strong>${s(e.start, this._zone, !0)}</strong> · ${c} ·
        ${f(e.end - e.start)}
      </figcaption>
      <div class="controls" role="group" aria-label="Pictures">
        <button class="step" aria-label="The picture before" ?disabled=${this._index <= 0} @click=${() => {
			this._stop(), this._show(this._index - 1);
		}}>${i("previous")}</button>
        <button class="step" aria-label=${this._playing ? "Pause" : "Play the pictures"} ?disabled=${r < 2} @click=${() => {
			this._togglePlay();
		}}>${i(this._playing ? "pause" : "play")}</button>
        <button class="step" aria-label="The picture after" ?disabled=${this._index >= r - 1} @click=${() => {
			this._stop(), this._show(this._index + 1);
		}}>${i("next")}</button>
        <span class="count" aria-live="polite">${r ? `Picture ${String(this._index + 1)} of ${String(r)}` : ""}</span>
      </div>
    </figure>`;
	}
	static styles = [l, e`
      :host {
        display: block;
        padding: 16px 0;
      }
      .note {
        max-width: 64ch;
      }
      .note h2 {
        margin: 0 0 8px;
        font-family: var(--rv-font-cond);
        font-size: 22px;
        font-weight: 600;
      }
      .note p {
        margin: 0 0 12px;
      }
      .day-nav {
        display: flex;
        align-items: center;
        gap: 6px;
        margin: 4px 0 16px;
      }
      .day {
        min-width: 10ch;
        text-align: center;
        font-family: var(--rv-font-cond);
        font-size: 19px;
        font-weight: 600;
      }
      .step {
        width: 36px;
        padding: 0;
        display: grid;
        place-items: center;
      }
      .layout {
        display: grid;
        grid-template-columns: minmax(0, 2fr) minmax(220px, 1fr);
        gap: 20px;
        align-items: start;
      }
      .viewer {
        margin: 0;
      }
      .frame {
        position: relative;
        display: grid;
        place-items: center;
        aspect-ratio: 1;
        max-height: 70vh;
        background: var(--rv-board);
        border-radius: 2px;
        overflow: hidden;
      }
      .frame img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
      .frame img.hidden {
        visibility: hidden;
      }
      .wait {
        position: absolute;
        color: var(--rv-on-board-muted);
      }
      figcaption {
        margin: 10px 0 6px;
        font-family: var(--rv-font-cond);
        font-size: 17px;
      }
      .controls {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .count {
        margin-left: 8px;
        color: var(--rv-muted);
        font-variant-numeric: tabular-nums;
      }
      .events {
        list-style: none;
        margin: 0;
        padding: 0;
        border-top: 1px solid var(--rv-rule);
        max-height: 70vh;
        overflow-y: auto;
      }
      .events li {
        border-bottom: 1px solid var(--rv-rule);
      }
      .events button {
        display: grid;
        grid-template-columns: auto 1fr auto;
        gap: 12px;
        width: 100%;
        padding: 10px 8px;
        border: 0;
        border-radius: 0;
        background: none;
        text-align: left;
        font: inherit;
        color: inherit;
      }
      .events button[aria-pressed="true"] {
        background: var(--rv-ground-2);
        font-weight: 600;
      }
      .time {
        font-variant-numeric: tabular-nums;
      }
      @media (max-width: 700px) {
        .layout {
          grid-template-columns: 1fr;
        }
      }
    `];
}, b = new Intl.DateTimeFormat(void 0, {
	weekday: "short",
	day: "numeric",
	month: "short",
	timeZone: "UTC"
});
function x(e) {
	let [t, n, r] = e.split("-").map(Number);
	return t && n && r ? b.format(new Date(Date.UTC(t, n - 1, r))) : e;
}
customElements.get("rv-event-pictures") || customElements.define("rv-event-pictures", y);
//#endregion
export { m as MAX_PICTURES, p as PICTURE_STEP_MS, g as PLAY_STEP_MS, y as RvEventPictures, v as eventAt, x as pictureDay, _ as pictureTimes };

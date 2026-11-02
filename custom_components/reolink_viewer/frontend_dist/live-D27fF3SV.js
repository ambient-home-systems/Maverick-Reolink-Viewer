import { a as e, i as t, n, r, t as i } from "./lit-DdRjbP0M.js";
//#region src/api.ts
var a = (e) => e.callWS({ type: "reolink_viewer/devices" }), o = (e, t) => e.callWS({
	type: "reolink_viewer/device",
	device_id: t
}), s = /* @__PURE__ */ new WeakMap();
function c(e) {
	let t = s.get(e.connection);
	return t || (t = e.callWS({ type: "reolink_viewer/catalog" }), s.set(e.connection, t), t.catch(() => s.delete(e.connection))), t;
}
var l = (e, t) => e.callWS({
	type: "config/entity_registry/update",
	entity_id: t,
	disabled_by: null
});
function u(e, t, n) {
	let r, i = !1, a = () => void 0, o = () => {
		let e = r;
		r = void 0, e && e().catch(() => void 0);
	};
	return {
		result: new Promise((s, c) => {
			a = c, e.connection.subscribeMessage((e) => {
				if (!i) switch (e.type) {
					case "progress":
						n(e.message);
						return;
					case "result":
						i = !0, o(), s(e.report);
						return;
					case "error":
						i = !0, o(), c(Error(e.message));
						return;
				}
			}, {
				type: "reolink_viewer/probe",
				...t
			}).then((e) => {
				r = e, i && o();
			}).catch((e) => {
				i = !0, c(d(e));
			});
		}),
		cancel: () => {
			i || (i = !0, o(), a(/* @__PURE__ */ Error("Probe cancelled")));
		}
	};
}
function d(e) {
	return e instanceof Error ? e : typeof e == "object" && e && "message" in e ? Error(String(e.message)) : Error(String(e));
}
var ee = (e, t, n, r) => e.callWS({
	type: "reolink_viewer/timeline/days",
	device_id: t,
	year: n,
	month: r
}), te = (e, t, n, r = 0, i = {}) => e.callWS({
	type: "reolink_viewer/timeline/day",
	device_id: t,
	date: n,
	...r > 0 ? { max_age: r } : {},
	...i.stream && i.stream !== "sub" ? { stream: i.stream } : {},
	...i.background ? { background: !0 } : {}
}), ne = (e, t = {}) => e.callWS({
	type: "reolink_viewer/events/recent",
	...t.date ? { date: t.date } : {},
	...t.maxAge ? { max_age: t.maxAge } : {},
	...t.background ? { background: !0 } : {}
}), re = (e, t, n) => e.callWS({
	type: "reolink_viewer/events/days",
	year: t,
	month: n
}), ie = (e, t, n) => e.callWS({
	type: "reolink_viewer/events/seen",
	camera_id: t,
	start: n
}), ae = (e) => e.callWS({
	type: "reolink_viewer/events/seen",
	all: !0
}), oe = (e) => e.callWS({ type: "reolink_viewer/timeline/warm" }), se = (e, t, n, r) => e.callWS({
	type: "reolink_viewer/playback/url",
	device_id: t.deviceId,
	date: t.date,
	segment_id: t.segmentId,
	stream: t.stream,
	progressive: n,
	...r === void 0 ? {} : { at: Math.round(r) }
}), ce = (e, t, n) => e.callWS({
	type: "reolink_viewer/playback/mse",
	device_id: t.deviceId,
	date: t.date,
	segment_id: t.segmentId,
	stream: t.stream,
	...n === void 0 ? {} : { at: Math.round(n) }
});
function le(e) {
	return e.split("?")[0]?.split("/").at(-1) ?? "";
}
var ue = (e, t) => e.callWS({
	type: "reolink_viewer/playback/release",
	tokens: t
}), de = (e, t) => e.callWS({
	type: "reolink_viewer/playback/cache_status",
	token: t
}), fe = (e, t) => e.callWS({
	type: "reolink_viewer/playback/prefetch",
	device_id: t.deviceId,
	date: t.date,
	segment_id: t.segmentId,
	stream: t.stream
}), pe = (e, t, n, r) => e.callWS({
	type: "reolink_viewer/thumbnail/urls",
	device_id: t,
	times: n,
	bucket: r
}), me = (e, t) => e.callWS({
	type: "reolink_viewer/playback/media_info",
	device_id: t
}), he = (e) => e.callWS({ type: "reolink_viewer/live/status" }), ge = (e) => e.callWS({ type: "reolink_viewer/live/cameras" }), f = (e) => ({
	connection_id: e.connectionId,
	stream: e.stream
}), _e = (e, t) => e.callWS({
	type: "reolink_viewer/live/mse",
	...f(t)
}), ve = (e, t) => e.callWS({
	type: "reolink_viewer/live/frame",
	...f(t)
}), p = (e, t) => e.callWS({
	type: "reolink_viewer/live/state",
	...f(t)
}), ye = (e) => e.callWS({ type: "reolink_viewer/live/soak" }), be = (e, t, n) => e.callWS({
	type: "reolink_viewer/live/soak/count",
	device: t,
	...n
}), xe = (e, t, n) => e.callWS({
	type: "reolink_viewer/live/soak/start",
	device: t,
	grid_open: n
}), Se = (e, t, n) => e.callWS({
	type: "reolink_viewer/live/preload",
	...f(t),
	enabled: n
}), m = (e) => e.callWS({ type: "web_rtc/ice_servers" }), Ce = (e, t, n, r) => e.connection.subscribeMessage(r, {
	type: "reolink_viewer/live/webrtc",
	...f(t),
	offer: n
}), we = (e, t, n) => e.callWS({
	type: "reolink_viewer/live/candidate",
	session_id: t,
	candidate: n
}), h = (e, t, n) => e.connection.subscribeMessage(t, {
	type: "reolink_viewer/live/images",
	...n ? { camera_ids: [...n] } : {}
}), Te = (e, t, n, r = {}) => e.connection.subscribeMessage(n, {
	type: "reolink_viewer/live/capacity",
	host_id: t,
	...r
}), Ee = {
	person: t`<circle cx="12" cy="7" r="3.2" /><path d="M5.5 20.5v-1.8a6.5 6.5 0 0 1 13 0v1.8" />`,
	visitor: t`<path d="M6.2 16.5v-5.3a5.8 5.8 0 0 1 11.6 0v5.3l1.7 1.8H4.5z" /><path d="M10 21a2.1 2.1 0 0 0 4 0" />`,
	vehicle: t`<path d="M3.5 16.5v-3.8l2.1-5a1.6 1.6 0 0 1 1.5-1h9.8a1.6 1.6 0 0 1 1.5 1l2.1 5v3.8z" /><path d="M3.8 12.5h16.4" /><circle cx="7.6" cy="16.6" r="1.9" /><circle cx="16.4" cy="16.6" r="1.9" />`,
	animal: t`<circle cx="6.6" cy="10" r="1.7" /><circle cx="10" cy="6.4" r="1.7" /><circle cx="14" cy="6.4" r="1.7" /><circle cx="17.4" cy="10" r="1.7" /><path d="M8.3 17.6c0-3.1 1.7-5.6 3.7-5.6s3.7 2.5 3.7 5.6c0 1.6-1.3 2.1-2.3 1.7a3.7 3.7 0 0 0-2.8 0c-1 .4-2.3-.1-2.3-1.7z" />`,
	package: t`<path d="M4 7.6 12 3.6l8 4v8.8l-8 4-8-4z" /><path d="m4 7.6 8 4 8-4M12 11.6v8.8M8 5.6l8 4" />`,
	motion: t`<path d="M3 12.5h3.6l2.3-5.6 4.2 11 2.4-5.4H21" />`,
	picture: t`<rect x="3.5" y="5.5" width="17" height="13" rx="1.5" /><circle cx="9" cy="10" r="1.6" /><path d="m4 17 5-4.5 3.5 3 3-2.5 4.5 4" />`,
	back: t`<path d="M19 12H5.5M11 5.5 4.5 12l6.5 6.5" />`,
	chevron: t`<path d="m9.5 5.5 6.5 6.5-6.5 6.5" />`,
	chevronBack: t`<path d="m14.5 5.5-6.5 6.5 6.5 6.5" />`,
	chevronDown: t`<path d="m5.5 9.5 6.5 6.5 6.5-6.5" />`,
	close: t`<path d="M6 6l12 12M18 6 6 18" />`,
	info: t`<circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" />`,
	enterFull: t`<path d="M4.5 9V4.5H9M15 4.5h4.5V9M19.5 15v4.5H15M9 19.5H4.5V15" />`,
	exitFull: t`<path d="M9 4.5V9H4.5M15 4.5V9h4.5M19.5 15H15v4.5M4.5 15H9v4.5" />`,
	play: t`<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />`,
	pause: t`<path d="M8.5 5.5v13M15.5 5.5v13" />`,
	previous: t`<path d="M6 5.5v13M18.5 5.5 9 12l9.5 6.5z" />`,
	next: t`<path d="M18 5.5v13M5.5 5.5 15 12l-9.5 6.5z" />`,
	plus: t`<path d="M12 5v14M5 12h14" />`,
	minus: t`<path d="M5 12h14" />`,
	refresh: t`<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" /><path d="M19.5 4.5v4h-4" />`,
	download: t`<path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14" />`,
	pip: t`<rect x="3.5" y="5.5" width="17" height="13" rx="1.5" /><rect x="11.5" y="11.5" width="6" height="4.5" fill="currentColor" />`,
	external: t`<path d="M13.5 4.5h6v6M19.5 4.5l-8 8" /><path d="M17.5 13.5v5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1h5" />`
};
function g(e) {
	return r`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${Ee[e]}</svg>`;
}
//#endregion
//#region src/live/check-util.ts
var De = "Live check · ", Oe = [
	"avc1.640029",
	"avc1.64002A",
	"avc1.640033",
	"hvc1.1.6.L153.B0",
	"mp4a.40.2",
	"mp4a.40.5",
	"flac",
	"opus"
];
function ke(e, t = !1) {
	return Oe.filter((n) => (!t || /^(avc1|hvc1)\./.test(n)) && e(`video/mp4; codecs="${n}"`)).join(",");
}
function Ae(e) {
	return [/live check (v[\w.-]+)/.exec(e)?.[1], /^Browser: (.+?)(?: · |$)/m.exec(e)?.[1]].filter((e) => e !== void 0).join(" · ");
}
function je(e) {
	let t = 0, n = 0, r = !1;
	for (let i of e) for (let e of Array.isArray(i.urls) ? i.urls : [i.urls]) /^turns?:/i.test(e) ? n += 1 : /^stun:/i.test(e) && (t += 1), /nabucasa|nabu\.casa/i.test(e) && (r = !0);
	return [`${t} STUN`, `${n} TURN${r && n ? " (Nabu Casa)" : ""}`].join(", ");
}
function Me(e) {
	return e.map((e) => ({
		urls: e.urls,
		...e.username ? { username: e.username } : {},
		...e.credential ? { credential: e.credential } : {}
	}));
}
function Ne(e) {
	let t = /* @__PURE__ */ new Map();
	e.forEach((e) => {
		t.set(String(e.id), e);
	});
	let n;
	for (let e of t.values()) e.type === "transport" && typeof e.selectedCandidatePairId == "string" && (n = t.get(e.selectedCandidatePairId));
	n ??= [...t.values()].find((e) => e.type === "candidate-pair" && e.nominated && e.state === "succeeded");
	let r = {}, i = (e) => {
		let n = t.get(String(e));
		if (n) return `${typeof n.candidateType == "string" ? n.candidateType : "?"}/${typeof n.protocol == "string" ? n.protocol : "?"}${typeof n.relayProtocol == "string" ? ` (TURN over ${n.relayProtocol})` : ""}`;
	};
	if (n) {
		let e = i(n.localCandidateId), t = i(n.remoteCandidateId);
		e && (r.local = e), t && (r.remote = t), typeof n.currentRoundTripTime == "number" && (r.rttMs = Math.round(n.currentRoundTripTime * 1e3));
	}
	for (let e of t.values()) if (e.type === "inbound-rtp" && e.kind === "video") {
		let n = t.get(String(e.codecId));
		n && typeof n.mimeType == "string" && (r.codec = n.mimeType.replace(/^video\//, "").toLowerCase()), typeof e.frameWidth == "number" && (r.width = e.frameWidth), typeof e.frameHeight == "number" && (r.height = e.frameHeight), typeof e.framesDecoded == "number" && (r.framesDecoded = e.framesDecoded);
	}
	return r;
}
function _(e) {
	return e === void 0 ? "–" : `${(e / 1e3).toFixed(2)} s`;
}
function Pe(e) {
	if (!e.length) return;
	let t = [...e].sort((e, t) => e - t), n = Math.floor(t.length / 2);
	return t.length % 2 ? t[n] : ((t[n - 1] ?? 0) + (t[n] ?? 0)) / 2;
}
function Fe(e) {
	if (!e) return "";
	let t = [
		e.key_interval_ms === null ? void 0 : `key frames every ${_(e.key_interval_ms)}`,
		e.parameter_sets === null ? void 0 : `parameter sets: ${e.parameter_sets}`,
		e.frame_order ? `frame order: ${e.frame_order}` : void 0,
		e.ends ? `feed ended ${String(e.ends)}× (${e.last_end ?? "?"})` : void 0,
		`feed opened ${_(e.age_ms)} before`
	].filter(Boolean);
	return t.length ? `; ${t.join("; ")}` : "";
}
function Ie(e, t) {
	if (!t) return e;
	let n = [
		t.codec,
		t.width && t.height ? `${t.width}×${t.height}` : void 0,
		t.frame_rate ? `${t.frame_rate} fps` : void 0,
		t.bit_rate ? `${t.bit_rate} kbps` : void 0
	].filter(Boolean);
	return n.length ? `${e} (${n.join(", ")})` : e;
}
function Le(e) {
	let t = [], n = typeof e.fill == "string" ? e.fill : e.fill ? `ch${e.fill.channel + 1}, ${Math.round(e.fill.duration_s / 60)} min recording` : "not run";
	e.warm_set_aside && t.push(`  cameras kept warm, set aside while it ran: ${String(e.warm_set_aside)}`), t.push(`  logged-in clients (GetOnline) before: ${e.online_users_before}, after: ${e.online_users_after}`), t.push(`  download: ${n}${e.fill_alone_mbit_s == null ? "" : `, alone ${e.fill_alone_mbit_s} Mbit/s`}`);
	for (let { camera: n, why: r } of e.main_left_out ?? []) t.push(`  main left out: ${n} main (${r}, on its own)`);
	for (let n of e.levels) {
		let e = n.first_frame_s == null ? "" : `, first frame ${n.first_frame_s} s`, r = n.fill ? `, download ${n.fill.mbit_s ?? "?"} Mbit/s${n.fill.error ? ` (${n.fill.error})` : ""}` : "", i = n.streams.map((e) => {
			let t = e.expected_fps ? `${e.fps}/${e.expected_fps}` : `${e.fps}`, n = e.longest_gap_s > 1 ? ` gap ${e.longest_gap_s} s` : "";
			return `${e.stream} ${t} fps${n}${e.error ? ` (${e.error})` : ""}`;
		}).join("; "), a = n.online_users == null ? "" : ` · clients ${n.online_users}`;
		t.push(`  L${n.level} + ${n.added}${e}${r}${a}: ${i}`);
	}
	let r = e.verdict;
	return t.push(r.first_failing_level === null ? "  verdict: every level kept up" : `  verdict: level ${r.first_failing_level} fails or slows down: ${r.reasons.join("; ")}`), t;
}
function Re(e, t) {
	let n = new URL(e, t);
	return n.protocol = n.protocol === "https:" ? "wss:" : "ws:", n.toString();
}
//#endregion
//#region src/live/data.ts
var ze = class {
	_host;
	cameraIds;
	cameras;
	images = {};
	iceServers;
	error;
	_hass;
	_connected = !1;
	_started = !1;
	_run = 0;
	_unsubscribe;
	constructor(e) {
		this._host = e, e.addController(this);
	}
	set hass(e) {
		this._hass = e, this._maybeLoad();
	}
	hostConnected() {
		this._connected = !0, this._maybeLoad();
	}
	hostDisconnected() {
		this._connected = !1, this._reset();
	}
	reload() {
		this._reset(), this.error = void 0, this._maybeLoad();
	}
	_reset() {
		this._started = !1, this._run += 1, this._unsubscribe?.().catch(() => void 0), this._unsubscribe = void 0;
	}
	_maybeLoad() {
		this._hass && this._connected && !this._started && (this._started = !0, this._load(this._hass, this._run));
	}
	async _load(e, t) {
		let n = h(e, (e) => {
			t === this._run && (this.images = {
				...this.images,
				...e.images
			}, this._host.requestUpdate());
		}, this.cameraIds), r = m(e).then(Me, () => []);
		try {
			let [i, { cameras: a }, o] = await Promise.all([
				n,
				ge(e),
				r
			]);
			if (t !== this._run) {
				i().catch(() => void 0);
				return;
			}
			this._unsubscribe = i, this.cameras = a, this.iceServers = o, this.error = void 0;
		} catch (e) {
			if (n.then((e) => e()).catch(() => void 0), t !== this._run) return;
			this.error = d(e).message;
		}
		this._host.requestUpdate();
	}
};
function Be(e, t) {
	let n = t.keep_warm_entity;
	return n && e?.states[n]?.state === "on" ? !0 : He(t)?.streams.sub?.warm === !0;
}
function Ve(e, t) {
	let n = t?.status_entity, r = n ? e?.states[n] : void 0;
	if (r?.state !== "unavailable") return;
	let i = Date.parse(r.last_changed);
	return Number.isNaN(i) ? Date.now() : i;
}
function He(e) {
	return e.connections.find((e) => e.via === "nvr") ?? e.connections[0];
}
function Ue(e, t) {
	return e.find((e) => e.id === t || e.connections.some((e) => e.connection_id === t));
}
//#endregion
//#region src/styles.ts
var v = e`
  :host {
    --rv-rail: #1b2a6e;
    --rv-on-rail: #f4f4f1;
    --rv-platform: #1b2a6e;
    --rv-recording: #1b2a6e;
    --rv-on-rail-muted: #b4bbd3;
    --rv-board: #111418;
    --rv-on-board: #f4f4f1;
    --rv-on-board-muted: #a9b0c4;
    --rv-ground: #f4f4f1;
    --rv-ground-2: #e9e9e4;
    --rv-text: #111418;
    --rv-muted: #5d6370;
    --rv-rule: rgba(17, 20, 24, 0.14);
    --rv-rule-strong: #111418;
    --rv-red: #e10600;
    --rv-action: #2140c4;
    --rv-on-action: #ffffff;
    --rv-fault: #f2b100;
    --rv-on-fault: #111418;
    --rv-fault-ink: #8a5a00;
    --rv-font: Barlow, system-ui, sans-serif;
    --rv-font-cond: "Barlow Semi Condensed", Barlow, system-ui, sans-serif;
    --rv-mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    color-scheme: light;
  }
  :host([dark]) {
    --rv-ground: #0e1530;
    --rv-ground-2: #18224a;
    --rv-text: #eef0f6;
    --rv-muted: #9aa3c0;
    --rv-rule: rgba(238, 240, 246, 0.16);
    --rv-rule-strong: #eef0f6;
    --rv-red: #ff4a3d;
    --rv-action: #8fa6ff;
    --rv-on-action: #0e1530;
    --rv-fault-ink: #f2b100;
    --rv-platform: #3349a8;
    --rv-recording: #5a6cb4;
    color-scheme: dark;
  }
`, We = e`
  ${v}
  :host {
    --primary-color: var(--rv-action);
    --accent-color: var(--rv-action);
    --primary-text-color: var(--rv-text);
    --secondary-text-color: var(--rv-muted);
    --text-primary-color: var(--rv-on-action);
    --primary-background-color: var(--rv-ground);
    --secondary-background-color: var(--rv-ground-2);
    --card-background-color: var(--rv-ground);
    --divider-color: var(--rv-rule);
    --error-color: var(--rv-fault-ink);
    --warning-color: var(--rv-fault);
    --disabled-color: var(--rv-muted);
    --ha-card-border-radius: 2px;
    --ha-card-box-shadow: none;
    --code-font-family: var(--rv-mono);
    --switch-checked-track-color: var(--rv-action);
    --switch-checked-button-color: var(--rv-action);
  }
`, y = e`
  :host {
    color: var(--rv-text);
    font-family: var(--rv-font);
    font-variant-numeric: tabular-nums;
  }
  ::selection {
    background: var(--rv-action);
    color: var(--rv-on-action);
  }
  /* A section of a page: ruled at the top, no box. */
  .card {
    overflow-wrap: anywhere;
    border-top: 2px solid var(--rv-rule-strong);
    padding: 14px 0 4px;
  }
  h2 {
    margin: 0 0 6px;
    font-family: var(--rv-font-cond);
    font-size: 22px;
    font-weight: 600;
    line-height: 1.15;
  }
  h3 {
    margin: 0 0 4px;
    font-size: 17px;
    font-weight: 600;
  }
  p {
    max-width: 72ch;
  }
  .muted {
    color: var(--rv-muted);
  }
  .small {
    font-size: 14px;
  }
  .badge {
    display: inline-block;
    font-size: 13px;
    font-weight: 500;
    line-height: 20px;
    padding: 0 7px;
    border: 1px solid var(--rv-rule);
    color: var(--rv-text);
    white-space: nowrap;
  }
  .badge.accent {
    background: var(--rv-action);
    border-color: var(--rv-action);
    color: var(--rv-on-action);
  }
  .badge.warning {
    background: var(--rv-fault);
    border-color: var(--rv-fault);
    color: var(--rv-on-fault);
  }
  button {
    font: inherit;
    font-weight: 500;
    min-height: 36px;
    padding: 6px 14px;
    border-radius: 2px;
    border: 1px solid var(--rv-rule-strong);
    background: transparent;
    color: var(--rv-text);
    cursor: pointer;
  }
  button:hover:not(:disabled) {
    background: var(--rv-ground-2);
  }
  button.primary {
    background: var(--rv-action);
    border-color: var(--rv-action);
    color: var(--rv-on-action);
  }
  button.primary:hover:not(:disabled) {
    background: var(--rv-action);
    filter: brightness(1.1);
  }
  button.danger {
    background: var(--rv-fault);
    border-color: var(--rv-fault);
    color: var(--rv-on-fault);
  }
  button.text,
  button.link {
    min-height: 0;
    background: transparent;
    border: none;
    color: var(--rv-action);
  }
  button.text {
    padding: 6px 4px;
  }
  button.link {
    padding: 0;
    text-align: left;
  }
  button.text:hover:not(:disabled),
  button.link:hover:not(:disabled) {
    background: transparent;
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  button:disabled {
    opacity: 0.45;
    cursor: default;
  }
  button svg {
    display: block;
    width: 20px;
    height: 20px;
  }
  button.with-icon {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  :focus-visible {
    outline: 2px solid var(--rv-action);
    outline-offset: 2px;
  }
  input,
  select,
  textarea {
    font: inherit;
    color: var(--rv-text);
    background: var(--rv-ground);
    border: 1px solid var(--rv-rule-strong);
    border-radius: 2px;
    padding: 5px 8px;
    accent-color: var(--rv-action);
    caret-color: var(--rv-action);
  }
  input[type="checkbox"],
  input[type="radio"] {
    width: 18px;
    height: 18px;
    padding: 0;
    vertical-align: -3px;
  }
  a {
    color: var(--rv-action);
    text-underline-offset: 3px;
  }
  code,
  pre {
    font-family: var(--rv-mono);
  }
  .banner {
    padding: 12px 16px;
  }
  .banner.warning,
  .banner.error {
    background: var(--rv-fault);
    color: var(--rv-on-fault);
  }
  .banner.warning button,
  .banner.error button {
    border-color: var(--rv-on-fault);
    color: var(--rv-on-fault);
  }
  .banner.warning a,
  .banner.error a {
    color: var(--rv-on-fault);
  }
  .banner.info {
    background: var(--rv-ground-2);
  }
  /* More help in the docs, which open in a new tab. */
  .help-link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
  }
  .help-link svg {
    width: 15px;
    height: 15px;
  }
  .problem .help-link {
    margin-left: 10px;
  }
  /* A problem's technical text, for support, under its plain words. */
  .problem details {
    margin-top: 6px;
    font-size: 13px;
  }
  .problem summary {
    cursor: pointer;
    font-weight: 500;
  }
  .problem .technical {
    display: block;
    margin-top: 4px;
    font-family: var(--rv-mono);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  /* Facts as ruled rows: a label, then its value. */
  dl.facts {
    display: grid;
    grid-template-columns: minmax(0, 10em) minmax(0, 1fr);
    margin: 8px 0;
    font-size: 15px;
  }
  dl.facts dt,
  dl.facts dd {
    margin: 0;
    padding: 8px 0;
    border-bottom: 1px solid var(--rv-rule);
  }
  dl.facts dt {
    padding-right: 20px;
    color: var(--rv-muted);
  }
  /* A form: each setting's label in a column, then its controls. */
  .form {
    display: grid;
    grid-template-columns: minmax(0, 12em) minmax(0, 1fr);
    border-top: 1px solid var(--rv-rule);
  }
  .form > .label {
    padding: 13px 16px 13px 0;
    border-bottom: 1px solid var(--rv-rule);
    color: var(--rv-muted);
    font-size: 15px;
  }
  .form > .field {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px 22px;
    min-width: 0;
    padding: 8px 0;
    border-bottom: 1px solid var(--rv-rule);
  }
  .form > .field.stack {
    flex-direction: column;
    align-items: flex-start;
  }
  .form select {
    min-height: 36px;
    max-width: 100%;
  }
  label.option {
    display: inline-flex;
    align-items: flex-start;
    gap: 10px;
    min-height: 32px;
    padding: 4px 0;
    box-sizing: border-box;
    line-height: 1.35;
  }
  label.option input {
    flex: none;
    margin: 0;
  }
  label.option.nested {
    margin-left: 28px;
  }
  @media (max-width: 600px) {
    .form {
      grid-template-columns: minmax(0, 1fr);
    }
    .form > .label {
      padding: 12px 0 0;
      border-bottom: none;
    }
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  /* A report to read and copy: a sheet under a rule. */
  pre.report {
    margin: 0;
    padding: 14px 16px;
    max-height: 480px;
    overflow: auto;
    background: var(--rv-ground-2);
    border-top: 2px solid var(--rv-rule-strong);
    font-size: 12.5px;
    line-height: 1.55;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    user-select: text;
    -webkit-user-select: text;
  }
  /* A disclosure: its drawn arrow turns when open. */
  summary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 32px;
    cursor: pointer;
    list-style: none;
    font-weight: 500;
  }
  summary::-webkit-details-marker {
    display: none;
  }
  summary svg {
    flex: none;
    width: 16px;
    height: 16px;
  }
  details[open] > summary svg {
    transform: rotate(180deg);
  }
  * {
    scrollbar-width: thin;
    scrollbar-color: var(--rv-rule) transparent;
  }
`, Ge = {
	text: "Too many cameras are streaming from this recorder at once.",
	advice: "Close live view on another screen, or keep fewer cameras warm."
}, Ke = {
	text: "Live view's video service is not running.",
	advice: "Restart Home Assistant. If it stays, run the live check."
}, qe = {
	text: "This browser cannot play this camera's video.",
	advice: "Try Chrome or Safari, or set the camera's video to H.264 in the Reolink app."
}, Je = {
	text: "The camera refused Home Assistant's login.",
	advice: "Check its password in the Reolink integration."
}, Ye = {
	text: "It could not be woken.",
	advice: "It may be out of Wi-Fi range or low on battery. Try again in a moment."
}, Xe = {
	text: "The camera did not answer.",
	advice: "Check that it is powered and connected. It tries again by itself."
}, Ze = {
	text: "No connection for live video could be made from here.",
	advice: "It tries again by itself. If it stays, run the live check on this device."
}, Qe = {
	text: "The camera sent no picture in time.",
	advice: "It may be busy, or far from its Wi-Fi. It tries again by itself."
}, $e = {
	text: "The camera's video stopped.",
	advice: "It starts again by itself."
}, b = /did not give its stream address|i\/o timeout|timed? ?out|connection refused|no route to host|unreachable|dial tcp|\bEOF\b/i;
function et(e, t = !1) {
	return /every stream slot|slots? .*in use/i.test(e) ? Ge : /go2rtc (is not running|is not installed|did not start)|did not start within|exited with code/i.test(e) ? Ke : /refused (video|audio)|MSE refused|codec|no MediaSource|append failed|not supported/i.test(e) ? qe : /\b401\b|unauthori[sz]ed|wrong (user|password)|password/i.test(e) ? Je : t && (b.test(e) || /no frame|closed the stream/i.test(e)) ? Ye : b.test(e) ? Xe : /ICE failed|no path/i.test(e) ? Ze : /no frame within|no new frame/i.test(e) ? Qe : /closed the stream|stream ended/i.test(e) ? $e : {
		text: "Live video stopped.",
		advice: "It tries again by itself. The ⓘ view has the details."
	};
}
//#endregion
//#region src/playback/codec.ts
function tt() {
	let e = navigator.mediaCapabilities, t = e?.decodingInfo;
	return t ? t.bind(e) : void 0;
}
async function nt(e, t = tt()) {
	if (!e) return {
		main: !0,
		reason: "not tried yet: falls back to SD if this browser cannot play it"
	};
	if (!e.width || !e.height) return {
		main: !1,
		reason: "main stream size unknown"
	};
	let n = `${e.codec} at ${e.width}×${e.height}`;
	if (!t) return {
		main: !1,
		reason: "this browser cannot report what it decodes"
	};
	try {
		let r = await t({
			type: "file",
			video: {
				contentType: `video/mp4; codecs="${e.codec}"`,
				width: e.width,
				height: e.height,
				bitrate: 8e6,
				framerate: 25
			}
		});
		return r.supported ? r.smooth ? {
			main: !0,
			reason: `${n} is supported`
		} : {
			main: !1,
			reason: `${n} would not play smoothly here`
		} : {
			main: !1,
			reason: `this browser cannot decode ${n}`
		};
	} catch {
		return {
			main: !1,
			reason: `this browser cannot check ${n}`
		};
	}
}
function rt(e = navigator.userAgent) {
	return !(/AppleWebKit/.test(e) && !/Chrome|Chromium|CriOS|Edg|Android|FxiOS/.test(e));
}
//#endregion
//#region src/live/hd.ts
var it = 4096, at = Oe.find((e) => e.startsWith("hvc1.")) ?? "hvc1.1.6.L153.B0";
async function x(e, t = tt()) {
	let n = (t) => e.streams.ext ? {
		stream: "ext",
		reason: `ext: ${t}`
	} : {
		stream: null,
		reason: `SD only: ${t}, and there is no ext stream`
	}, r = e.streams.main;
	if (!r) return n("no main stream");
	let i = r.encoding, a = i?.width ?? void 0, o = i?.height ?? void 0, s = a && o ? `${a}×${o}` : void 0;
	if (a && a > 4096) return n(`the main stream's ${s ?? `${a} pixels`} is wider than ${it} pixels`);
	let c = i?.codec?.toLowerCase();
	if (c === "h264") return {
		stream: "main",
		reason: `main: H.264${s ? ` at ${s}` : ""}`
	};
	if (c !== "h265" && c !== "hevc") return n(`the main stream's codec is ${c ?? "unknown"}`);
	if (!a || !o || !s) return n("the main stream is H.265 at an unknown size");
	if (!t) return n("this browser cannot say whether it decodes H.265");
	try {
		let e = await t({
			type: "media-source",
			video: {
				contentType: `video/mp4; codecs="${at}"`,
				width: a,
				height: o,
				bitrate: (i?.bit_rate ?? 8e3) * 1e3,
				framerate: i?.frame_rate ?? 25
			}
		});
		return e.supported ? e.smooth ? {
			stream: "main",
			reason: `main: H.265 at ${s}, smooth here`
		} : n(`H.265 at ${s} would not play smoothly here`) : n(`this browser cannot decode H.265 at ${s}`);
	} catch {
		return n(`this browser cannot check H.265 at ${s}`);
	}
}
//#endregion
//#region src/playback/mse-feeder.ts
var S = class extends Error {}, C = 4e3, ot = 2e4, st = 12e4, ct = 16777216, lt = 50331648, ut = 1e3;
function w() {
	let e = window;
	if (typeof e.ManagedMediaSource == "function") return "ManagedMediaSource";
	if (typeof e.MediaSource == "function") return "MediaSource";
}
function dt(e) {
	return window[e];
}
function T(e) {
	let t = [];
	for (let n = 0; n < e.length; n += 1) {
		let r = {
			start: e.start(n),
			end: e.end(n)
		}, i = t.at(-1);
		i && r.start - i.end < .5 ? i.end = Math.max(i.end, r.end) : t.push(r);
	}
	return t;
}
function ft(e, t) {
	let n = Math.min(30 * Math.max(1, e), 240);
	return t > 0 ? Math.max(4, Math.min(n, lt / t)) : n;
}
function E(e) {
	return e.aborted;
}
function pt(e) {
	return e instanceof DOMException && e.name === "QuotaExceededError";
}
var mt = class {
	_video;
	_src;
	_onError;
	stats;
	_source;
	_buffer;
	_url;
	_pending;
	_next;
	_runStartS;
	_endS;
	_bytesPerSecond = 0;
	_ready = !1;
	_closed = !1;
	_listeners = [];
	constructor(e, t, n) {
		this._video = e, this._src = t, this._onError = n, this.stats = {
			api: "MediaSource",
			mime: "",
			source: "file",
			firstSource: void 0,
			atSource: void 0,
			switches: 0,
			windows: 0,
			bytes: 0,
			lastWaitMs: void 0,
			trims: 0,
			fetching: !1
		};
	}
	get closed() {
		return this._closed;
	}
	get around() {
		let e = this._video.currentTime, t = this._buffer ? this._rangeAt(e) : void 0;
		return t ? {
			ahead: t.end - e,
			behind: e - t.start
		} : {
			ahead: 0,
			behind: 0
		};
	}
	async start(e) {
		let t = w();
		if (!t) throw new S("this browser has no MediaSource");
		this.stats.api = t;
		let n = dt(t), r = new n();
		this._source = r, this._video.disableRemotePlayback = !0, this._url = URL.createObjectURL(r);
		let i = new Promise((e) => {
			r.addEventListener("sourceopen", () => {
				e();
			}, { once: !0 });
		});
		if (this._video.src = this._url, await i, this._gone()) return;
		let a = await this._get(`init?at=${Math.round(e)}`), o = a.headers.get("X-RV-Mime") ?? "";
		if (this.stats.mime = o, this.stats.source = a.headers.get("X-RV-Source") ?? "file", !o || !n.isTypeSupported(o)) throw new S(`MSE cannot play ${o || "this recording"}`);
		let s = new Uint8Array(await a.arrayBuffer());
		if (!this._gone()) {
			this._buffer = r.addSourceBuffer(o), this._src.durationMs > 0 && (r.duration = this._src.durationMs / 1e3);
			for (let e of [
				"timeupdate",
				"seeking",
				"ratechange",
				"progress"
			]) this._listen(this._video, e, this._pump);
			this._listen(this._video, "waiting", this._jumpGap), this._listen(r, "startstreaming", this._pump), this._listen(this._buffer, "updateend", this._pump), this._listen(this._buffer, "bufferedchange", this._pump), await this._append(s), await this._fetch({ at: e }, C, !0), e > 0 && this._video.currentTime === 0 && (this._video.currentTime = e / 1e3), this._ready = !0, this._pump();
		}
	}
	destroy() {
		this._closed = !0, this._pending?.controller.abort(), this._pending = void 0;
		for (let [e, t, n] of this._listeners) e.removeEventListener(t, n);
		this._listeners.length = 0, this._url && URL.revokeObjectURL(this._url);
	}
	_gone() {
		return this._closed;
	}
	_settle(e) {
		this._pending && this._pending.controller === e && (this._pending = void 0), this.stats.fetching = this._pending !== void 0;
	}
	_listen(e, t, n) {
		e.addEventListener(t, n), this._listeners.push([
			e,
			t,
			n
		]);
	}
	async _get(e, t) {
		let n = await this._src.fetch(`${this._src.base}/${e}`, t ? { signal: t } : {});
		if (!n.ok) {
			let e = await n.text().catch(() => "");
			throw e.startsWith("not playable as fragments") ? new S(e) : Error(`HTTP ${n.status}${e ? `: ${e}` : ""}`);
		}
		return n;
	}
	_pump = () => {
		let e = this._buffer;
		if (this._closed || !this._ready || !e) return;
		let t = this._video.currentTime, n = this._rangeAt(t);
		if (!n && this._endS !== void 0 && t >= this._endS - .5) return;
		let r = this._pending;
		if (r) {
			if (n || t >= r.fromS - .1 && t < r.toS) return;
			r.controller.abort(), this._pending = void 0;
		}
		if (e.updating) return;
		if (!n) {
			let e = this._next, n = this._runStartS;
			e && n !== void 0 && t >= e.atS - .5 && t < e.atS + .5 ? this._fetch({ first: e.index }, C, !1) : this._fetch({ at: t * 1e3 }, C, !1);
			return;
		}
		if (this._trim(t, n)) return;
		if (this._endS !== void 0 && n.end >= this._endS - .5) {
			this._endOfStream();
			return;
		}
		if (this._source?.streaming === !1 || n.end - t >= ft(this._video.playbackRate, this._bytesPerSecond)) return;
		let i = this._next, a = i && Math.abs(i.atS - n.end) < .5 ? { first: i.index } : { at: n.end * 1e3 }, o = Math.min(ot * Math.max(1, this._video.playbackRate), st);
		this._fetch(a, o, !1);
	};
	async _fetch(e, t, n) {
		let r = new AbortController(), i = e.at === void 0 ? this._next?.atS ?? 0 : e.at / 1e3;
		this._pending = {
			controller: r,
			fromS: i,
			toS: i + t / 1e3
		}, this.stats.fetching = !0;
		let a = performance.now(), o = e.first === void 0 ? `at=${Math.round(e.at ?? 0)}` : `first=${e.first}`;
		try {
			let n = await this._get(`frags?${o}&ms=${Math.round(t)}&bytes=${ct}`, r.signal), i = new Uint8Array(await n.arrayBuffer());
			if (this._closed || r.signal.aborted) return;
			let s = (e) => Number(n.headers.get(`X-RV-${e}`)), [c, l, u, d] = [
				s("First"),
				s("Count"),
				s("Start"),
				s("End")
			];
			if (this.stats.windows += 1, this.stats.bytes += i.length, this.stats.lastWaitMs = performance.now() - a, l > 0) {
				let t = n.headers.get("X-RV-Source") ?? "file";
				if (t !== this.stats.source && (await this._switch(t, r.signal), this._gone() || E(r.signal))) return;
				await this._append(i), this.stats.firstSource ??= t, e.at !== void 0 && (this.stats.atSource = t), (e.first === void 0 || this._runStartS === void 0) && (this._runStartS = u / 1e3), this._next = {
					index: c + l,
					atS: d / 1e3
				}, d > u && (this._bytesPerSecond = i.length * 1e3 / (d - u));
			}
			if (n.headers.get("X-RV-Last") === "1") {
				let t = e.first === void 0 ? void 0 : this._next?.atS;
				this._endS = l > 0 ? d / 1e3 : t ?? this._video.duration, this._endOfStream();
			}
			if (l === 0) {
				this._settle(r), setTimeout(this._pump, ut);
				return;
			}
		} catch (e) {
			if (this._closed || r.signal.aborted) return;
			if (n) throw e;
			this._closed = !0, this._onError(e instanceof Error ? e : Error(String(e)));
			return;
		} finally {
			this._settle(r);
		}
		this._pump();
	}
	async _switch(e, t) {
		let n = await this._get(`init?source=${e}`, t), r = n.headers.get("X-RV-Mime") ?? "", i = new Uint8Array(await n.arrayBuffer());
		if (this._gone() || E(t)) return;
		let a = this._buffer;
		r && r !== this.stats.mime && a && typeof a.changeType == "function" && (a.changeType(r), this.stats.mime = r), await this._append(i), this.stats.source = e, this.stats.switches += 1;
	}
	async _append(e) {
		let t = this._buffer;
		if (t) {
			await this._idle(t);
			try {
				t.appendBuffer(e);
			} catch (n) {
				if (!pt(n)) throw n;
				await this._removeAllBut(t, 2), t.appendBuffer(e);
			}
			await this._idle(t);
		}
	}
	_idle(e) {
		return e.updating ? new Promise((t, n) => {
			let r = () => {
				e.removeEventListener("error", i), t();
			}, i = () => {
				e.removeEventListener("updateend", r), n(new S("append error"));
			};
			e.addEventListener("updateend", r, { once: !0 }), e.addEventListener("error", i, { once: !0 });
		}) : Promise.resolve();
	}
	async _removeAllBut(e, t) {
		let n = this._video.currentTime;
		for (let r of T(e.buffered)) {
			let i = Math.max(r.start, n - t), a = Math.min(r.end, n + t);
			a <= i ? (this._remove(e, r.start, r.end), await this._idle(e)) : (i > r.start && (this._remove(e, r.start, i), await this._idle(e)), r.end > a && (this._remove(e, a, r.end), await this._idle(e)));
		}
		this.stats.trims += 1;
	}
	_trim(e, t) {
		let n = this._buffer;
		if (!n) return !1;
		for (let r of T(n.buffered)) if (r.start !== t.start && (r.end < e - 30 || r.start > e + 240)) return this._remove(n, r.start, r.end), this.stats.trims += 1, !0;
		return e - t.start > 40 && (this._remove(n, t.start, e - 30), this.stats.trims += 1, !0);
	}
	_remove(e, t, n) {
		e.remove(t, n);
		let r = this._runStartS, i = this._next;
		r === void 0 || !i || n <= r || t >= i.atS || (this._runStartS = n >= i.atS - .5 ? void 0 : n);
	}
	_endOfStream() {
		let e = this._source, t = this._buffer;
		if (e && t && e.readyState === "open") {
			if (t.updating) t.addEventListener("updateend", () => {
				this._endOfStream();
			}, { once: !0 });
			else try {
				e.endOfStream();
			} catch {}
		}
	}
	_rangeAt(e) {
		let t = this._buffer;
		if (t) return T(t.buffered).find((t) => e >= t.start - .05 && e < t.end);
	}
	_jumpGap = () => {
		let e = this._buffer;
		if (this._closed || !e) return;
		let t = this._video.currentTime, n = e.buffered;
		for (let e = 0; e < n.length; e += 1) {
			let r = n.start(e);
			if (r > t && r - t < .5) {
				this._video.currentTime = r + .001;
				return;
			}
		}
	};
}, ht = 10, gt = 2, _t = .5, vt = 1e4;
function yt(e) {
	return new Promise((t) => {
		let n = !1, r = () => {
			n || (n = !0, t(performance.now()));
		};
		typeof e.requestVideoFrameCallback == "function" ? e.requestVideoFrameCallback(() => {
			r();
		}) : e.addEventListener("playing", r, { once: !0 });
	});
}
var D = class {
	video;
	done;
	onEnd;
	t0 = performance.now();
	steps = {};
	closed = !1;
	_resolve;
	_timer;
	_playing = !1;
	_ended = !1;
	_lastFrame = 0;
	_stallTimer;
	constructor(e, t) {
		this.video = e, this.done = new Promise((e) => {
			this._resolve = e;
		}), this._timer = setTimeout(() => {
			this.fail(`no frame within ${Math.round(t / 1e3)} s`);
		}, t), e.muted = !0, e.playsInline = !0, e.autoplay = !0, yt(e).then(async (t) => {
			if (this.closed) return;
			clearTimeout(this._timer), this._playing = !0, this._watchFrames();
			let n = await this.describe().catch(() => ({}));
			this._resolve({
				ok: !0,
				firstFrameMs: t - this.t0,
				steps: this.steps,
				...e.videoWidth ? {
					width: e.videoWidth,
					height: e.videoHeight
				} : {},
				...n
			});
		}, () => void 0);
	}
	step(e) {
		this.steps[e] ??= Math.round(performance.now() - this.t0);
	}
	fail(e, t = !1) {
		if (clearTimeout(this._timer), this._playing) {
			if (this._ended || this.closed) return;
			this._ended = !0, clearInterval(this._stallTimer), this.onEnd?.(e, t);
		} else this.describe().catch(() => ({})).then((t) => {
			this._resolve({
				ok: !1,
				error: e,
				steps: this.steps,
				...t
			});
		});
	}
	describe() {
		return Promise.resolve({});
	}
	play() {
		this.video.play().catch(() => void 0);
	}
	_watchFrames() {
		let e = this.video;
		this._lastFrame = performance.now();
		let t = () => {
			this._lastFrame = performance.now();
		};
		if (typeof e.requestVideoFrameCallback == "function") {
			let n = () => {
				t(), !this.closed && !this._ended && e.requestVideoFrameCallback(n);
			};
			e.requestVideoFrameCallback(n);
		} else e.addEventListener("timeupdate", t);
		this._stallTimer = setInterval(() => {
			performance.now() - this._lastFrame > 1e4 && this.fail(`no new frame for ${Math.round(vt / 1e3)} s`);
		}, 1e3);
	}
	close() {
		this.closed = !0, clearTimeout(this._timer), clearInterval(this._stallTimer);
		let e = this.video;
		e.pause(), e.srcObject = null, e.removeAttribute("src"), e.load();
	}
}, O = class extends D {
	pc;
	async connect(e) {
		let t = new RTCPeerConnection({ iceServers: e });
		this.pc = t, t.addTransceiver("video", { direction: "recvonly" }), t.addTransceiver("audio", { direction: "recvonly" }), t.addEventListener("track", (e) => {
			this.step("track"), this.video.srcObject || (this.video.srcObject = e.streams[0] ?? new MediaStream([e.track]), this.play());
		}), t.addEventListener("iceconnectionstatechange", () => {
			let e = t.iceConnectionState;
			(e === "connected" || e === "completed") && this.step("connected"), e === "failed" && this.fail("ICE failed: no path between the browser and the server");
		}), t.addEventListener("icegatheringstatechange", () => {
			t.iceGatheringState === "complete" && this.step("gathered");
		});
		let n = await t.createOffer();
		return await t.setLocalDescription(n), this.step("offer"), n;
	}
	async describe() {
		return this.pc ? { pair: Ne(await this.pc.getStats()) } : {};
	}
	close() {
		super.close(), this.pc?.close();
	}
}, k = class extends O {
	_hass;
	_unsubscribe;
	_session;
	_early = [];
	constructor(e, t, n, r, i) {
		super(t, i), this._hass = e, this._start(n, r);
	}
	async _start(e, t) {
		try {
			let n = await this.connect(t);
			this.pc?.addEventListener("icecandidate", (e) => {
				let t = e.candidate?.candidate;
				t && (this._session ? this._send(t) : this._early.push(t));
			}), this._unsubscribe = await Ce(this._hass, e, n.sdp ?? "", (e) => {
				this._signal(e);
			}), this.closed && this._unsubscribe();
		} catch (e) {
			this.fail(d(e).message);
		}
	}
	async _send(e) {
		this._session && !this.closed && await we(this._hass, this._session, e).catch(() => void 0);
	}
	async _signal(e) {
		let t = this.pc;
		if (t && !this.closed) try {
			switch (e.type) {
				case "session":
					this._session = e.session_id;
					for (let e of this._early.splice(0)) this._send(e);
					return;
				case "answer":
					this.step("answer"), await t.setRemoteDescription({
						type: "answer",
						sdp: e.sdp
					});
					return;
				case "candidate":
					e.candidate && await t.addIceCandidate({
						candidate: e.candidate,
						sdpMid: "0"
					});
					return;
				case "error":
					this.fail(e.message);
					return;
				case "closed":
					this.step("closed");
					return;
			}
		} catch (e) {
			this.fail(d(e).message);
		}
	}
	close() {
		super.close(), this._unsubscribe?.().catch(() => void 0);
	}
}, bt = class extends O {
	_hass;
	_entityId;
	_unsubscribe;
	_session;
	_early = [];
	constructor(e, t, n, r) {
		super(t, r), this._hass = e, this._entityId = n, this._start();
	}
	async _start() {
		try {
			let e = await this._hass.callWS({
				type: "camera/webrtc/get_client_config",
				entity_id: this._entityId
			});
			this.step("config");
			let t = await this.connect(e.configuration.iceServers ?? []);
			this.pc?.addEventListener("icecandidate", (e) => {
				if (!e.candidate) return;
				let t = e.candidate.toJSON();
				this._session ? this._send(t) : this._early.push(t);
			}), this._unsubscribe = await this._hass.connection.subscribeMessage((e) => {
				this._signal(e);
			}, {
				type: "camera/webrtc/offer",
				entity_id: this._entityId,
				offer: t.sdp ?? ""
			}), this.closed && this._unsubscribe();
		} catch (e) {
			this.fail(d(e).message);
		}
	}
	async _send(e) {
		this._session && !this.closed && await this._hass.callWS({
			type: "camera/webrtc/candidate",
			entity_id: this._entityId,
			session_id: this._session,
			candidate: e
		}).catch(() => void 0);
	}
	async _signal(e) {
		let t = this.pc;
		if (t && !this.closed) try {
			switch (e.type) {
				case "session":
					this._session = e.session_id;
					for (let e of this._early.splice(0)) this._send(e);
					return;
				case "answer":
					this.step("answer"), await t.setRemoteDescription({
						type: "answer",
						sdp: e.answer
					});
					return;
				case "candidate":
					await t.addIceCandidate(e.candidate);
					return;
				case "error":
					this.fail(`${e.code}: ${e.message}`);
					return;
			}
		} catch (e) {
			this.fail(d(e).message);
		}
	}
	close() {
		super.close(), this._unsubscribe?.().catch(() => void 0);
	}
}, A = class extends D {
	_hass;
	_base;
	_videoOnly;
	_ws;
	_buffer;
	_url;
	_queue = [];
	_api;
	_mime = "";
	_started = !1;
	constructor(e, t, n, r, i = location.href, a = !1) {
		super(t, r), this._hass = e, this._base = i, this._videoOnly = a, this._start(n);
	}
	async _start(e) {
		let t = w();
		if (!t) {
			this.fail("this browser has no MediaSource");
			return;
		}
		this._api = t;
		let n = window[t];
		try {
			let { path: t } = await _e(this._hass, e);
			if (this.step("url"), this.closed) return;
			let r = new WebSocket(Re(t, this._base));
			r.binaryType = "arraybuffer", this._ws = r, r.addEventListener("open", () => {
				this.step("open");
				let e = ke((e) => n.isTypeSupported(e), this._videoOnly);
				r.send(JSON.stringify({
					type: "mse",
					value: e
				}));
			}), r.addEventListener("message", (e) => {
				typeof e.data == "string" ? this._text(e.data, n) : this._media(e.data);
			}), r.addEventListener("close", () => {
				this.closed || this.fail("the server closed the stream", !0);
			});
		} catch (e) {
			this.fail(d(e).message);
		}
	}
	_text(e, t) {
		let n;
		try {
			n = JSON.parse(e);
		} catch {
			return;
		}
		if (n.type === "error") {
			this.fail(n.value ?? "error");
			return;
		}
		if (n.type !== "mse" || !n.value) return;
		this.step("mime"), this._mime = n.value;
		let r = new t();
		this.video.disableRemotePlayback = !0, this._url = URL.createObjectURL(r), r.addEventListener("sourceopen", () => {
			try {
				this._buffer = r.addSourceBuffer(n.value ?? ""), this._buffer.mode = "segments", this._buffer.addEventListener("updateend", () => {
					this._appended();
				}), this._next();
			} catch (e) {
				this.fail(`MSE refused ${n.value ?? ""}: ${d(e).message}`);
			}
		}, { once: !0 }), this.video.src = this._url;
	}
	_media(e) {
		this.step("first data"), this._queue.push(e), this._next();
	}
	_next() {
		let e = this._buffer;
		if (!e || e.updating || this.closed) return;
		let t = this._queue.shift();
		if (t) try {
			e.appendBuffer(t);
		} catch (e) {
			this.fail(`append failed: ${d(e).message}`);
		}
	}
	_appended() {
		let e = this._buffer, t = this.video;
		if (!e || this.closed) return;
		let n = e.buffered;
		if (n.length) {
			let r = n.start(0), i = n.end(n.length - 1);
			if (!this._started && i > r ? (this._started = !0, this.step("appended"), t.currentTime = Math.max(r, i - _t), this.play()) : i - t.currentTime > gt && (t.currentTime = i - .3), t.currentTime - r > 20 && !e.updating) {
				e.remove(r, t.currentTime - ht);
				return;
			}
		}
		this._next();
	}
	describe() {
		return Promise.resolve(this._api ? { mse: {
			api: this._api,
			mime: this._mime
		} } : {});
	}
	close() {
		this._ws?.close(), super.close(), this._url && URL.revokeObjectURL(this._url);
	}
}, xt = {
	WebRTC: 15e3,
	MSE: 12e3
}, j = [
	1,
	2,
	5,
	10,
	30
], M = 12e5, N = 36e5, P = new class {
	_cuts = [];
	until = 0;
	note(e = Date.now()) {
		let t = this._cuts.at(-1);
		return t !== void 0 && e - t < 1e4 || (this._cuts = [...this._cuts.filter((t) => e - t < M), e], this._cuts.length < 2 || this.preferWebRtc(e)) ? !1 : (this.until = e + N, this._cuts = [], !0);
	}
	preferWebRtc(e = Date.now()) {
		return e < this.until;
	}
	giveUp() {
		this.until = 0;
	}
}(), F = 6048e5, I = "reolink-viewer.webrtc-blocked", L = new class {
	_host;
	_storage;
	_until = 0;
	constructor(e = location.host, t = () => localStorage) {
		this._host = e, this._storage = t;
	}
	get until() {
		let e = this._read()[this._host];
		return Math.max(this._until, typeof e == "number" ? e : 0);
	}
	preferMse(e = Date.now()) {
		return e < this.until;
	}
	note(e = Date.now()) {
		return !this.preferMse(e) && (this._keep(e + F), !0);
	}
	works() {
		this.until && this._keep(0);
	}
	_keep(e) {
		this._until = e;
		try {
			let t = Object.fromEntries(Object.entries(this._read()).filter(([e]) => e !== this._host));
			e && (t[this._host] = e), this._storage()?.setItem(I, JSON.stringify(t));
		} catch {}
	}
	_read() {
		try {
			let e = JSON.parse(this._storage()?.getItem(I) ?? "{}");
			return e && typeof e == "object" ? e : {};
		} catch {
			return {};
		}
	}
}(), St = (e, t, n, r, i, a) => e === "MSE" ? new A(t, n, r, a) : new k(t, n, r, i, a), R = class {
	_hass;
	_video;
	ref;
	options;
	_onState;
	_factory;
	_cuts;
	_webRtc;
	state = { kind: "idle" };
	events = [];
	onCount = () => void 0;
	_session;
	_timer;
	_failures = 0;
	_switchNoted = !1;
	_blockedNoted = !1;
	_run = 0;
	constructor(e, t, n, r, i = () => void 0, a = St, o = P, s = L) {
		this._hass = e, this._video = t, this.ref = n, this.options = r, this._onState = i, this._factory = a, this._cuts = o, this._webRtc = s;
	}
	get running() {
		return this.state.kind !== "idle";
	}
	start() {
		this.running || (this._failures = 0, this._attempt(this._run));
	}
	retryNow() {
		this.state.kind === "waiting" && (clearTimeout(this._timer), this._attempt(this._run));
	}
	stop() {
		this._run += 1, clearTimeout(this._timer), this._session?.close(), this._session = void 0, this.state.kind !== "idle" && this._note("stopped"), this._set({ kind: "idle" });
	}
	async _attempt(e) {
		let t = this._webRtc.preferMse(), n = t || this.options.warm && !this._cuts.preferWebRtc(), r = this.options.warm && !n;
		r && !this._switchNoted && this._note("WebRTC first: this network cuts MSE's connections"), this._switchNoted = r;
		let i = t && !this.options.warm;
		i && !this._blockedNoted && this._note("MSE first: WebRTC does not connect from here"), this._blockedNoted = i;
		let a = n ? ["MSE", "WebRTC"] : ["WebRTC", "MSE"], o = "failed", s = !1;
		for (let t of a) {
			this._note(`${t}: starting`), this._set({
				kind: "starting",
				transport: t
			});
			let n = this._factory(t, this._hass, this._video, this.ref, this.options.iceServers, xt[t]);
			this._session = n;
			let i = Date.now();
			n.onEnd = (r, a) => {
				this._ended(e, n, i, r, t === "MSE" && a);
			};
			let a = await n.done;
			if (e !== this._run || this._session !== n) return;
			if (a.ok) {
				let e = a.firstFrameMs;
				this._note(`${t}: playing${e === void 0 ? "" : `, first frame in ${(e / 1e3).toFixed(2)} s`}`), this.onCount("plays"), t === "WebRTC" ? this._webRtc.works() : s && this._webRtc.note() && this._note(`WebRTC could not connect but MSE played: MSE goes first from here for ${F / 864e5} days`), this._set({
					kind: "playing",
					transport: t,
					result: a
				});
				return;
			}
			n.close(), this._session = void 0, o = `${t}: ${a.error ?? "failed"}`, this._note(o), this.onCount("failures"), t === "WebRTC" && "answer" in a.steps && !("connected" in a.steps) && (s = !0), r && t === "WebRTC" && this._cuts.preferWebRtc() && (this._cuts.giveUp(), this._note("WebRTC could not start either: MSE goes first again"));
		}
		this._failures += 1, this._wait(e, o);
	}
	_ended(e, t, n, r, i) {
		if (e !== this._run || this._session !== t) return;
		t.close(), this._session = void 0;
		let a = Date.now() - n;
		this._note(`ended after ${Math.round(a / 1e3)} s: ${r}`), this.onCount("drops"), i && a >= 6e4 && this._cuts.note() && this._note(`this page's MSE connections were cut twice within ${M / 6e4} min: WebRTC goes first for ${N / 6e4} min`), a >= 3e4 ? (this._failures = 0, this._attempt(e)) : (this._failures += 1, this._wait(e, r));
	}
	_wait(e, t) {
		let n = j[Math.min(this._failures, j.length) - 1] ?? j[0];
		this._note(`next try in ${n} s`), this._set({
			kind: "waiting",
			error: t,
			retryAt: Date.now() + n * 1e3
		}), this._timer = setTimeout(() => {
			e === this._run && this._attempt(e);
		}, n * 1e3);
	}
	_note(e) {
		this.events.push({
			at: Date.now(),
			text: e
		}), this.events.length > 20 && this.events.splice(0, this.events.length - 20);
	}
	_set(e) {
		this.state = e, this._onState(e);
	}
};
//#endregion
//#region src/network.ts
function z(e) {
	let t = e.toLowerCase();
	if (t.endsWith(".ui.nabu.casa")) return "Nabu Casa";
	if (t.endsWith(".ts.net")) return "Tailscale";
	let n = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(t);
	if (n) {
		let [e = 0, t = 0] = n.slice(1, 3).map(Number);
		return e === 100 && t >= 64 && t < 128 ? "Tailscale" : e === 10 || e === 127 || e === 192 && t === 168 || e === 172 && t >= 16 && t < 32 ? "local" : "remote";
	}
	return t === "localhost" || t.endsWith(".local") || t.endsWith(".lan") || !t.includes(".") ? "local" : "own domain";
}
var Ct = () => navigator.connection;
function wt(e = location.hostname, t = Ct()) {
	if (t?.saveData) return {
		where: "away",
		why: "with data saver on"
	};
	if (t?.type === "cellular") return {
		where: "away",
		why: "on mobile data"
	};
	if (t?.effectiveType && /2g|3g/.test(t.effectiveType)) return {
		where: "away",
		why: "on a slow connection"
	};
	switch (z(e)) {
		case "Nabu Casa": return {
			where: "away",
			why: "through Nabu Casa"
		};
		case "Tailscale": return {
			where: "away",
			why: "through Tailscale"
		};
		case "remote": return {
			where: "away",
			why: "away from home"
		};
		default: return {
			where: "home",
			why: "at home"
		};
	}
}
var B = "reolink-viewer.full-screen-hd";
function Tt() {
	try {
		let e = JSON.parse(localStorage.getItem(B) ?? "{}");
		return e && typeof e == "object" ? e : {};
	} catch {
		return {};
	}
}
function V(e) {
	let t = Tt()[e.where];
	return typeof t == "boolean" ? {
		hd: t,
		chosen: !0
	} : {
		hd: e.where === "home",
		chosen: !1
	};
}
function H(e, t) {
	try {
		localStorage.setItem(B, JSON.stringify({
			...Tt(),
			[e]: t
		}));
	} catch {}
}
var U = "reolink-viewer.full-screen-keep-taps";
function W() {
	try {
		return localStorage.getItem(U) !== "off";
	} catch {
		return !0;
	}
}
function Et(e) {
	try {
		localStorage.setItem(U, e ? "on" : "off");
	} catch {}
}
//#endregion
//#region src/playback/time.ts
var G = /* @__PURE__ */ new Map();
function K(e, t) {
	let n = `${e ?? ""}|${JSON.stringify(t)}`, r = G.get(n);
	if (!r) {
		try {
			r = new Intl.DateTimeFormat(void 0, {
				...t,
				...e ? { timeZone: e } : {}
			});
		} catch {
			r = new Intl.DateTimeFormat(void 0, t);
		}
		G.set(n, r);
	}
	return r;
}
function Dt(e, t) {
	return K(t, {
		day: "numeric",
		month: "short",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23"
	}).format(e);
}
function q(e, t, n = !1) {
	return K(t, {
		hour: "2-digit",
		minute: "2-digit",
		...n ? { second: "2-digit" } : {},
		hourCycle: "h23"
	}).format(e);
}
function Ot(e, t) {
	let n = K(t, {
		year: "numeric",
		month: "2-digit",
		day: "2-digit"
	}).formatToParts(e), r = (e) => n.find((t) => t.type === e)?.value ?? "";
	return `${r("year")}-${r("month")}-${r("day")}`;
}
function kt(e, t) {
	let n = K(t, {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hourCycle: "h23"
	}).formatToParts(e), r = (e) => Number(n.find((t) => t.type === e)?.value ?? 0);
	return Date.UTC(r("year"), r("month") - 1, r("day"), r("hour"), r("minute"), r("second")) - Math.floor(e / 1e3) * 1e3;
}
function At(e) {
	try {
		let t = new Intl.Locale(e ?? navigator.language), n = t.getWeekInfo?.() ?? t.weekInfo;
		if (n) return n.firstDay % 7;
	} catch {}
	return +!/^en-(US|CA)|^ja|^he/.test(e ?? navigator.language);
}
//#endregion
//#region src/pip.ts
var J = "picture-in-picture";
function jt() {
	return document.pictureInPictureEnabled && typeof HTMLVideoElement.prototype.requestPictureInPicture == "function";
}
function Mt(e = document.createElement("video")) {
	if (jt()) return !0;
	let t = e;
	return typeof t.webkitSupportsPresentationMode == "function" && t.webkitSupportsPresentationMode(J);
}
function Y(e) {
	return e ? document.pictureInPictureElement === e || e.webkitPresentationMode === J : !1;
}
async function X(e) {
	if (jt()) {
		await e.requestPictureInPicture();
		return;
	}
	let t = e;
	if (typeof t.webkitSetPresentationMode != "function") throw Error("this browser has no picture-in-picture");
	t.webkitSetPresentationMode(J);
}
async function Z(e) {
	if (!e) return;
	if (document.pictureInPictureElement === e) {
		await document.exitPictureInPicture();
		return;
	}
	let t = e;
	t.webkitPresentationMode === J && t.webkitSetPresentationMode?.("inline");
}
async function Nt(e, t) {
	if (!Y(e)) return !1;
	try {
		return await X(t), !0;
	} catch {
		return await Z(e).catch(() => void 0), !1;
	}
}
//#endregion
//#region src/components/live-controls.ts
var Pt = 5e3, Ft = [
	"left_up",
	"up",
	"right_up",
	"left",
	null,
	"right",
	"left_down",
	"down",
	"right_down"
], It = {
	left: 0,
	left_up: 45,
	up: 90,
	right_up: 135,
	right: 180,
	right_down: 225,
	down: 270,
	left_down: 315
}, Lt = {
	left: "Move left",
	right: "Move right",
	up: "Move up",
	down: "Move down",
	left_up: "Move left and up",
	left_down: "Move left and down",
	right_up: "Move right and up",
	right_down: "Move right and down",
	zoom_in: "Zoom in",
	zoom_out: "Zoom out"
}, Rt = class extends i {
	static properties = {
		hass: { attribute: !1 },
		controls: { attribute: !1 },
		cameraName: { attribute: !1 },
		_moving: { state: !0 },
		_confirmSiren: { state: !0 },
		_error: { state: !0 }
	};
	_movement;
	_errorTimer;
	constructor() {
		super(), this.cameraName = "Camera", this._confirmSiren = !1;
	}
	disconnectedCallback() {
		super.disconnectedCallback(), this.release(), clearTimeout(this._errorTimer);
	}
	press(e) {
		let t = this.controls?.ptz?.[e];
		!this._moving && t && this._usable(t) && (this._moving = e, this._movement = this._call("button", "press", t, Lt[e].toLowerCase()));
	}
	release() {
		if (!this._moving) return;
		this._moving = void 0;
		let e = this.controls?.ptz?.stop, t = this._movement ?? Promise.resolve();
		this._movement = void 0, e && t.finally(() => this._call("button", "press", e, "stop moving"));
	}
	_state(e) {
		return e ? this.hass?.states[e] : void 0;
	}
	_usable(e) {
		let t = this._state(e)?.state;
		return t !== void 0 && t !== "unavailable";
	}
	async _call(e, t, n, r, i = {}) {
		try {
			await this.hass?.callService(e, t, i, { entity_id: n }, !1);
		} catch (e) {
			this._showError(`Could not ${r}: ${d(e).message}`);
		}
	}
	_showError(e) {
		this._error = e, clearTimeout(this._errorTimer), this._errorTimer = setTimeout(() => {
			this._error = void 0;
		}, Pt);
	}
	_step(e, t, n) {
		let r = this._state(e), i = Number(r?.state);
		if (!r || !Number.isFinite(i)) return;
		let a = r.attributes, o = a.min ?? 0, s = a.max ?? 100, c = Math.max(a.step ?? 1, Math.round((s - o) / 10)), l = Math.min(s, Math.max(o, i + t * c));
		l !== i && this._call("number", "set_value", e, n, { value: l });
	}
	render() {
		let e = this.controls ?? {};
		return r`${this._renderTop(e)} ${this._renderPad(e)} ${this._renderZoom(e)}
    ${this._confirmSiren ? this._renderConfirm() : n}
    ${this._error ? r`<div class="error" role="alert">${this._error}</div>` : n}`;
	}
	_renderTop(e) {
		let { preset: t, floodlight: i, siren: a } = e;
		if (!t && !i && !a) return n;
		let o = this._state(t)?.attributes?.options ?? [], s = this._state(i)?.state === "on", c = this._state(a)?.state === "on";
		return r`<div class="top">
      ${t && o.length ? r`<select
            aria-label="Go to a preset"
            ?disabled=${!this._usable(t)}
            @change=${(e) => {
			let n = e.target, r = n.value;
			n.value = "", r && this._call("select", "select_option", t, "go to the preset", { option: r });
		}}
          >
            <option value="">Preset…</option>
            ${o.map((e) => r`<option value=${e}>${e}</option>`)}
          </select>` : n}
      ${i ? r`<button
            class="toggle ${s ? "on" : ""}"
            aria-pressed=${s ? "true" : "false"}
            ?disabled=${!this._usable(i)}
            @click=${() => {
			this._call("light", s ? "turn_off" : "turn_on", i, "switch the floodlight");
		}}
          >
            Light
          </button>` : n}
      ${a ? r`<button
            class="toggle siren ${c ? "on" : ""}"
            aria-pressed=${c ? "true" : "false"}
            ?disabled=${!this._usable(a)}
            @click=${() => {
			c ? this._call("siren", "turn_off", a, "stop the siren") : this._confirmSiren = !0;
		}}
          >
            ${c ? "Stop siren" : "Siren"}
          </button>` : n}
    </div>`;
	}
	updated(e) {
		if (!e.has("_confirmSiren")) return;
		let t = this._confirmSiren ? ".confirm button" : "button.siren";
		(this._confirmSiren || e.get("_confirmSiren") === !0) && this.renderRoot.querySelector(t)?.focus();
	}
	_renderConfirm() {
		let e = this.controls?.siren;
		return r`<div
      class="confirm"
      role="alertdialog"
      aria-labelledby="siren-title"
      @keydown=${(e) => {
			e.key === "Escape" && (e.stopPropagation(), this._confirmSiren = !1);
		}}
    >
      <strong id="siren-title">Sound the siren on ${this.cameraName}?</strong>
      <span class="small">It is loud, and keeps sounding until you stop it.</span>
      <span class="actions">
        <button
          @click=${() => {
			this._confirmSiren = !1;
		}}
        >
          Cancel
        </button>
        <button
          class="danger"
          @click=${() => {
			this._confirmSiren = !1, e && this._call("siren", "turn_on", e, "sound the siren");
		}}
        >
          Sound it
        </button>
      </span>
    </div>`;
	}
	_renderPad(e) {
		let i = e.ptz;
		return i?.stop ? r`<div class="pad" role="group" aria-label="Move the camera">
      ${Ft.map((e) => e && i[e] ? this._holdButton(e, r`<svg viewBox="0 0 24 24" aria-hidden="true" style="transform: rotate(${It[e] ?? 0}deg)">
              ${t`<path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />`}
            </svg>`) : r`<span></span>`)}
    </div>` : n;
	}
	_renderZoom(e) {
		let t = e.ptz, i = t?.stop && t.zoom_in && t.zoom_out, a = i ? void 0 : e.zoom, o = e.focus;
		if (!i && !a && !o) return n;
		let s = (e, t, n) => r`<span class="stepper" role="group" aria-label=${n}>
        <button
          aria-label=${`${n} out`}
          ?disabled=${!this._usable(e)}
          @click=${() => {
			this._step(e, -1, t);
		}}
        >
          ${g("minus")}
        </button>
        <span class="small">${n}</span>
        <button
          aria-label=${`${n} in`}
          ?disabled=${!this._usable(e)}
          @click=${() => {
			this._step(e, 1, t);
		}}
        >
          ${g("plus")}
        </button>
      </span>`;
		return r`<div class="zoom">
      ${o ? s(o, "focus", "Focus") : n}
      ${i ? r`<span class="stepper" role="group" aria-label="Zoom">
            ${this._holdButton("zoom_out", g("minus"))}<span class="small">Zoom</span>${this._holdButton("zoom_in", g("plus"))}
          </span>` : a ? s(a, "zoom", "Zoom") : n}
    </div>`;
	}
	_holdButton(e, t) {
		let n = this.controls?.ptz?.[e];
		return r`<button
      class="hold ${this._moving === e ? "held" : ""}"
      aria-label=${Lt[e]}
      ?disabled=${!this._usable(n)}
      @pointerdown=${(t) => {
			t.preventDefault();
			try {
				t.currentTarget.setPointerCapture(t.pointerId);
			} catch {}
			this.press(e);
		}}
      @pointerup=${() => {
			this.release();
		}}
      @pointercancel=${() => {
			this.release();
		}}
      @lostpointercapture=${() => {
			this.release();
		}}
      @keydown=${(t) => {
			(t.key === "Enter" || t.key === " ") && !t.repeat && (t.preventDefault(), this.press(e));
		}}
      @keyup=${(e) => {
			(e.key === "Enter" || e.key === " ") && this.release();
		}}
      @blur=${() => {
			this.release();
		}}
      @contextmenu=${(e) => {
			e.preventDefault();
		}}
    >
      ${t}
    </button>`;
	}
	static styles = [y, e`
      :host {
        position: absolute;
        inset: 0;
        pointer-events: none;
        color: var(--rv-on-board);
      }
      .top,
      .pad,
      .zoom,
      .confirm,
      .error {
        position: absolute;
        pointer-events: auto;
      }
      /* Square controls in the board's ink over the video. */
      button,
      select {
        border: none;
        border-radius: 2px;
        background: rgba(17, 20, 24, 0.72);
        color: var(--rv-on-board);
        min-height: 32px;
      }
      button:disabled {
        opacity: 0.4;
      }
      .top {
        top: 8px;
        right: 36px;
        display: flex;
        gap: 6px;
        align-items: center;
      }
      .top select {
        padding: 4px 8px;
        max-width: 140px;
      }
      .toggle {
        padding: 4px 12px;
      }
      .toggle.on {
        background: var(--rv-on-board);
        color: var(--rv-board);
      }
      .toggle.siren.on {
        background: var(--rv-fault);
        color: var(--rv-on-fault);
      }
      .pad {
        left: 8px;
        bottom: 28px;
        display: grid;
        grid-template-columns: repeat(3, 32px);
        grid-template-rows: repeat(3, 32px);
        gap: 2px;
      }
      .hold {
        width: 32px;
        height: 32px;
        padding: 4px;
        touch-action: none;
        user-select: none;
        -webkit-user-select: none;
        -webkit-touch-callout: none;
      }
      .hold.held {
        background: var(--rv-on-board);
        color: var(--rv-board);
      }
      .hold svg {
        display: block;
        width: 24px;
        height: 24px;
      }
      .zoom {
        right: 48px;
        bottom: 6px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        align-items: flex-end;
      }
      .stepper {
        display: flex;
        gap: 4px;
        align-items: center;
        text-shadow: 0 0 3px #000;
      }
      .stepper button {
        width: 32px;
        padding: 0;
        font-size: 18px;
      }
      .confirm {
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        display: flex;
        flex-direction: column;
        gap: 6px;
        max-width: min(320px, 90%);
        padding: 12px 16px;
        border-top: 2px solid var(--rv-fault);
        background: var(--rv-board);
      }
      .confirm .actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
      }
      .confirm button {
        padding: 4px 12px;
      }
      .confirm button.danger {
        background: var(--rv-fault);
        color: var(--rv-on-fault);
      }
      .error {
        left: 50%;
        top: 44px;
        transform: translateX(-50%);
        max-width: 90%;
        padding: 6px 12px;
        font-size: 13px;
        background: var(--rv-fault);
        color: var(--rv-on-fault);
      }
    `];
};
customElements.get("rv-live-controls") || customElements.define("rv-live-controls", Rt);
//#endregion
//#region src/clipboard.ts
async function zt(e) {
	let t = navigator.clipboard;
	try {
		if (window.isSecureContext && t) return await t.writeText(e), !0;
	} catch {}
	let n = document.createElement("textarea");
	n.value = e, n.setAttribute("readonly", ""), n.style.cssText = `position:absolute;left:-9999px;top:${window.scrollY}px;font-size:12pt;border:0;padding:0;margin:0`, document.body.append(n), n.select(), n.setSelectionRange(0, e.length);
	try {
		return document.execCommand("copy");
	} catch {
		return !1;
	} finally {
		n.remove();
	}
}
//#endregion
//#region src/live/debug.ts
var Q = (e) => `${(e / 1e3).toFixed(e < 1e4 ? 2 : 0)} s`;
function Bt(e, t, n = Date.now()) {
	let r = e.connection, i = [`${e.camera}${r ? ` · ${r.via === "nvr" ? "through the NVR" : "direct"} (${r.entry_title})${r.is_battery ? " · on battery" : ""}` : ""}`];
	for (let r of e.players) {
		if (i.push(`${r.label} (${r.stream}, ${r.warm ? "kept warm" : "cold"}): ${Vt(r.state, n)}`), r.state.kind === "playing") {
			let e = r.state.result.pair;
			e?.local && i.push(`  path: ${e.local} ↔ ${e.remote ?? "?"}${e.rttMs === void 0 ? "" : `, rtt ${e.rttMs} ms`}`);
		}
		i.push(`  server: ${Ht(t[r.label])}`);
	}
	e.hd && i.push(`HD choice: ${e.hd}`), e.webRtcFirstUntil !== void 0 && e.webRtcFirstUntil > n && i.push(`Network: it cut MSE's connections twice, so WebRTC goes first until ${Ut(e.webRtcFirstUntil)}`), e.mseFirstUntil !== void 0 && e.mseFirstUntil > n && i.push(`Network: WebRTC does not connect from here, so MSE goes first until ${Wt(e.mseFirstUntil)}`);
	for (let t of e.players) if (t.events.length) {
		i.push(`Events (${t.label}):`);
		for (let e of t.events) i.push(`  ${Ut(e.at)} ${e.text}`);
	}
	return i.join("\n");
}
function Vt(e, t) {
	switch (e.kind) {
		case "idle": return "stopped";
		case "starting": return `starting over ${e.transport}`;
		case "waiting": return `${e.error}; next try in ${Q(Math.max(0, e.retryAt - t))}`;
		case "playing": {
			let t = e.result, n = t.width ?? t.pair?.width, r = t.height ?? t.pair?.height, i = t.pair?.codec ?? /codecs="?([^"]+)/.exec(t.mse?.mime ?? "")?.[1];
			return [
				`playing over ${e.transport}`,
				t.firstFrameMs === void 0 ? void 0 : `first frame in ${Q(t.firstFrameMs)}`,
				n && r ? `${n}×${r}` : void 0,
				i
			].filter((e) => e !== void 0).join(" · ");
		}
	}
}
function Ht(e) {
	if (e === void 0) return "…";
	if (typeof e == "string") return `cannot read: ${e}`;
	let t = [e.state ? `go2rtc ${e.state.active ? "streaming" : "idle"}, ${e.state.consumers} consumer${e.state.consumers === 1 ? "" : "s"}` : "not in go2rtc", `held ${e.holds}×`], n = e.cache;
	return n ? (t.push(`${n.warm ? "warm feed" : "feed"} ${Q(n.age_ms)} old, ${n.viewers} viewer${n.viewers === 1 ? "" : "s"}`), n.key_frame_age_ms !== null && t.push(`key frame ${Q(n.key_frame_age_ms)} ago${n.key_interval_ms === null ? "" : `, every ${Q(n.key_interval_ms)}`}`), n.parameter_sets && t.push(`parameter sets ${n.parameter_sets}`), n.ends && t.push(`${n.ends} feed${n.ends === 1 ? "" : "s"} dropped (last: ${n.last_end ?? "?"})`)) : t.push("no MSE feed"), t.join(", ");
}
function Ut(e) {
	return new Date(e).toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit"
	});
}
function Wt(e) {
	return new Date(e).toLocaleString([], {
		weekday: "short",
		hour: "2-digit",
		minute: "2-digit"
	});
}
//#endregion
//#region src/components/live-debug.ts
var Gt = 2e3, Kt = "rv-live-debug-close", qt = class extends i {
	static properties = {
		hass: { attribute: !1 },
		info: { attribute: !1 },
		_states: { state: !0 },
		_copied: { state: !0 }
	};
	_timer;
	constructor() {
		super(), this._states = {};
	}
	connectedCallback() {
		super.connectedCallback(), this._poll(), this._timer = setInterval(() => {
			this._poll();
		}, Gt);
	}
	disconnectedCallback() {
		super.disconnectedCallback(), clearInterval(this._timer);
	}
	async _poll() {
		let e = this.hass, t = this.info, n = t?.connection;
		if (!e || !t || !n) return;
		let r = async (t) => {
			try {
				return await p(e, {
					connectionId: n.connection_id,
					stream: t
				});
			} catch (e) {
				return d(e).message;
			}
		}, i = await Promise.all(t.players.map(async (e) => [e.label, await r(e.stream)]));
		this._states = Object.fromEntries(i);
	}
	firstUpdated() {
		this.renderRoot.querySelector(".panel")?.focus();
	}
	_close() {
		this.dispatchEvent(new CustomEvent(Kt, {
			bubbles: !0,
			composed: !0
		}));
	}
	render() {
		let e = this.info, t = e ? Bt(e, this._states) : "";
		return r`<div
      class="panel"
      role="dialog"
      tabindex="-1"
      aria-label=${`${e?.camera ?? "Camera"}: debug`}
      @keydown=${(e) => {
			e.key === "Escape" && (e.stopPropagation(), this._close());
		}}
    >
      <pre tabindex="0" aria-label="Debug text">${t}</pre>
      <div class="actions">
        <button
          @click=${() => {
			zt(t).then((e) => {
				this._copied = e;
			});
		}}
        >
          ${this._copied === void 0 ? "Copy" : this._copied ? "Copied" : "Could not copy"}
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
	static styles = [y, e`
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
    `];
};
customElements.get("rv-live-debug") || customElements.define("rv-live-debug", qt);
//#endregion
//#region src/components/live-tile.ts
var Jt = 3e3, Yt = "rv-live-open", Xt = "rv-live-full", Zt = "rv-live-count", Qt = "rv-live-state", $t = class extends i {
	static properties = {
		hass: { attribute: !1 },
		camera: { attribute: !1 },
		connection: { attribute: !1 },
		stream: { attribute: !1 },
		image: { attribute: !1 },
		iceServers: { attribute: !1 },
		warm: { attribute: !1 },
		openable: { type: Boolean },
		compact: { type: Boolean },
		tapLabel: { attribute: !1 },
		hideName: { attribute: !1 },
		hideState: {
			type: Boolean,
			reflect: !0,
			attribute: "hide-state"
		},
		fill: {
			type: Boolean,
			reflect: !0
		},
		fit: { reflect: !0 },
		number: { attribute: !1 },
		suspended: { attribute: !1 },
		controls: { attribute: !1 },
		_state: { state: !0 },
		_onScreen: { state: !0 },
		_pageVisible: { state: !0 },
		_wanted: { state: !0 },
		_full: { state: !0 },
		_hd: { state: !0 },
		_hdState: { state: !0 },
		_debug: { state: !0 },
		_pip: { state: !0 },
		_hdWanted: { state: !0 }
	};
	_link = {
		where: "home",
		why: "at home",
		chosen: !1
	};
	_player;
	_hdPlayer;
	_hdChoosing;
	_native = !1;
	_observer;
	_offscreenTimer;
	constructor() {
		super(), this.stream = "sub", this.openable = !1, this.compact = !1, this.hideName = !1, this.hideState = !1, this.fill = !1, this.fit = "cover", this.suspended = !1, this._state = { kind: "idle" }, this._hdState = { kind: "idle" }, this._onScreen = typeof IntersectionObserver > "u", this._pageVisible = document.visibilityState !== "hidden", this._wanted = !0, this._full = !1, this._debug = !1, this._hdWanted = !0;
	}
	connectedCallback() {
		super.connectedCallback(), document.addEventListener("visibilitychange", this._onVisibility), document.addEventListener("fullscreenchange", this._onFullscreenChange), document.addEventListener("keydown", this._onKeydown), typeof IntersectionObserver < "u" && (this._observer = new IntersectionObserver((e) => {
			this._onScreen = e.some((e) => e.isIntersecting);
		}, { rootMargin: "100px" }), this._observer.observe(this)), this.requestUpdate();
	}
	disconnectedCallback() {
		super.disconnectedCallback(), document.removeEventListener("visibilitychange", this._onVisibility), document.removeEventListener("fullscreenchange", this._onFullscreenChange), document.removeEventListener("keydown", this._onKeydown), this._observer?.disconnect(), this._observer = void 0, clearTimeout(this._offscreenTimer), Z(this._pipVideo).catch(() => void 0), this._pip = void 0, this._player?.stop(), this._hdPlayer?.stop(), this.exitFull();
	}
	_video(e) {
		return this.renderRoot.querySelector(`video.${e}`);
	}
	get _pipVideo() {
		return this._pip ? this._video(this._pip) : null;
	}
	_onPipChange = () => {
		this._pip = Y(this._video("sub")) ? "sub" : Y(this._video("hd")) ? "hd" : void 0;
	};
	async _togglePip() {
		try {
			if (this._pip) await Z(this._pipVideo);
			else {
				let e = this._video(this.hdShown ? "hd" : "sub");
				e && await X(e);
			}
		} catch {}
	}
	_onVisibility = () => {
		this._pageVisible = document.visibilityState !== "hidden";
	};
	_count = (e) => {
		this.dispatchEvent(new CustomEvent(Zt, {
			detail: {
				camera: this.camera?.name ?? "Camera",
				kind: e
			},
			bubbles: !0
		}));
	};
	_onFullscreenChange = () => {
		this._native && !document.fullscreenElement && (this._native = !1, this.exitFull());
	};
	_onKeydown = (e) => {
		e.key === "Escape" && this._full && !this._native && this.exitFull();
	};
	get shouldPlay() {
		return this.isConnected && this._wanted && !this.suspended && this._pageVisible && this._onScreen && this.offlineSince === void 0 && this.connection?.streams[this.stream] !== void 0;
	}
	get offlineSince() {
		return Ve(this.hass, this.connection);
	}
	get waitsForTap() {
		return this.connection?.is_battery === !0 || this.camera?.records === !1;
	}
	get playsHd() {
		return this.stream !== "sub";
	}
	get hdShown() {
		return this._full && this._hdState.kind === "playing";
	}
	get full() {
		return this._full;
	}
	enterFull() {
		if (this._full) return;
		let e = wt(), t = V(e);
		this._link = {
			...e,
			chosen: t.chosen
		}, this._hdWanted = t.hd, this._full = !0, this._wanted = !0, document.fullscreenEnabled && typeof this.requestFullscreen == "function" && this.requestFullscreen().then(() => {
			this._native = !0, this._full || document.exitFullscreen().catch(() => void 0);
		}).catch(() => void 0), this._fullChanged();
	}
	exitFull() {
		this._full && (this._full = !1, this._native && document.fullscreenElement && document.exitFullscreen().catch(() => void 0), this._native = !1, this._fullChanged());
	}
	_fullChanged() {
		this.dispatchEvent(new CustomEvent(Xt, {
			detail: {
				cameraId: this.camera?.id,
				full: this._full
			},
			bubbles: !0,
			composed: !0
		}));
	}
	willUpdate(e) {
		(e.has("connection") || e.has("stream")) && (this._player?.stop(), this._player = void 0, this._hdPlayer?.stop(), this._hdPlayer = void 0, this._hd = void 0, this._hdChoosing = void 0, this._wanted = this._full || !this.waitsForTap), this.toggleAttribute("full", this._full);
	}
	updated() {
		this._driveSub(), this._driveHd();
	}
	_driveSub() {
		let e = this._ensurePlayer();
		e && (e.options.warm = this.warm ?? this.connection?.streams[this.stream]?.warm === !0, this.shouldPlay && !this.hdShown || this._pip === "sub" ? (clearTimeout(this._offscreenTimer), this._offscreenTimer = void 0, this._start(e)) : e.running && (!this._pageVisible || !this._wanted || this.suspended || this.hdShown ? e.stop() : this._offscreenTimer ??= setTimeout(() => {
			this._offscreenTimer = void 0, this.shouldPlay || (this._pip !== "sub" && this._player?.stop(), this._pip !== "hd" && this._hdPlayer?.stop());
		}, Jt)));
	}
	_toggleHd() {
		this._hdWanted = !this._hdWanted, this._link = {
			...this._link,
			chosen: !0
		}, W() && H(this._link.where, this._hdWanted);
	}
	_driveHd() {
		if (this.playsHd) return;
		let e = this.connection, t = this._full && this.shouldPlay, n = t && this._hdWanted || this._pip === "hd";
		t && e && !this._hd && this._hdChoosing !== e && (this._hdChoosing = e, x(e).then((t) => {
			this.connection === e && (this._hd = t);
		}));
		let r = this._ensureHdPlayer();
		r && (n ? this._start(r) : r.running && (!this._full || !this._pageVisible || this.suspended || !this._wanted || !this._hdWanted) && r.stop());
	}
	_start(e) {
		!e.running && (e.options.warm || this.iceServers) && (e.options.iceServers = this.iceServers ?? [], e.start());
	}
	_ensurePlayer() {
		if (this._player) return this._player;
		let e = this.renderRoot.querySelector("video.sub"), t = this.connection;
		if (this.hass && e && t) return this._player = new R(this.hass, e, {
			connectionId: t.connection_id,
			stream: this.stream
		}, {
			warm: !1,
			iceServers: []
		}, (e) => {
			let t = e.kind === "playing";
			t !== (this._state.kind === "playing") && this.dispatchEvent(new CustomEvent(Qt, {
				detail: {
					cameraId: this.camera?.id ?? "",
					live: t
				},
				bubbles: !0
			})), this._state = e;
		}), this._player.onCount = this._count, this._player;
	}
	_ensureHdPlayer() {
		if (this._hdPlayer) return this._hdPlayer;
		let e = this._hd?.stream, t = this.renderRoot.querySelector("video.hd"), n = this.connection;
		if (this.hass && e && t && n) return this._hdPlayer = new R(this.hass, t, {
			connectionId: n.connection_id,
			stream: e
		}, {
			warm: n.streams[e]?.warm === !0,
			iceServers: []
		}, (e) => {
			this._hdState = e;
		}), this._hdPlayer.onCount = this._count, this._hdPlayer;
	}
	_activate() {
		this._full || (this._wanted ? this.openable && this.camera && this.dispatchEvent(new CustomEvent(Yt, {
			detail: { cameraId: this.camera.id },
			bubbles: !0,
			composed: !0
		})) : this._wanted = !0);
	}
	render() {
		let e = this._state, t = e.kind === "playing", i = this.camera?.name ?? "Camera", a = !this._full && (this.openable || !this._wanted), o = !this.openable && !this.compact;
		return r`<div class="frame">
      <div
        class="tile ${t ? "playing" : ""} ${this.hdShown ? "hd-on" : ""} ${a ? "interactive" : ""}"
        @click=${() => {
			this._activate();
		}}
      >
        ${this.image ? r`<img class="poster" src=${this.image.url} alt="" />` : n}
        <video
          class="sub"
          muted
          playsinline
          aria-label=${`${i} live`}
          @enterpictureinpicture=${this._onPipChange}
          @leavepictureinpicture=${this._onPipChange}
          @webkitpresentationmodechanged=${this._onPipChange}
        ></video>
        ${this._hd?.stream ? r`<video
              class="hd"
              muted
              playsinline
              aria-label=${`${i} live in HD`}
              @enterpictureinpicture=${this._onPipChange}
              @leavepictureinpicture=${this._onPipChange}
              @webkitpresentationmodechanged=${this._onPipChange}
            ></video>` : n}
        ${a ? r`<button
              class="open"
              aria-label=${this._wanted ? this.tapLabel ?? `Open ${i}` : `Watch ${i}`}
              aria-describedby="state status"
            ></button>` : n}
        ${this.number !== void 0 && !this._full ? r`<span class="num" aria-hidden="true">${this.number}</span>` : n}
        <div class="label">
          ${this.hideName ? n : r`<span class="name">${i}</span>`}
          ${this._wanted ? n : r`<span class="hint">
                ${this.connection?.is_battery ? "Tap to wake it and watch" : "Tap to watch live"}
              </span>`}
        </div>
        ${this.hdShown ? n : this._renderStatus(e)}
        ${this._renderHd()}
      </div>
      ${this._debug ? r`<rv-live-debug
            .hass=${this.hass}
            .info=${this._debugInfo(i)}
            @rv-live-debug-close=${() => {
			this._debug = !1, this.updateComplete.then(() => {
				this.renderRoot.querySelector(".corner-button.info")?.focus();
			});
		}}
          ></rv-live-debug>` : n}
      <button
        class="corner-button info"
        aria-label=${`${i} debug info`}
        aria-pressed=${this._debug ? "true" : "false"}
        title="What this tile plays, and how"
        @click=${() => {
			this._debug = !this._debug;
		}}
      >
        ${g("info")}
      </button>
      ${this.controls && (this._full || o) ? r`<rv-live-controls
            .hass=${this.hass}
            .controls=${this.controls}
            .cameraName=${i}
          ></rv-live-controls>` : n}
      ${(this._full || o) && (t || this.hdShown || this._pip) && Mt() ? r`<button
            class="corner-button pip"
            aria-label=${this._pip ? "Leave picture in picture" : `${i} in picture in picture`}
            aria-pressed=${this._pip ? "true" : "false"}
            title=${this._pip ? "Leave picture in picture" : "Picture in picture: keep watching in a small window"}
            @click=${() => void this._togglePip()}
          >
            ${g("pip")}
          </button>` : n}
      <button
        class="corner-button full"
        aria-label=${this._full ? "Exit full screen" : `${i} full screen`}
        title=${this._full ? "Exit full screen" : "Full screen (HD)"}
        @click=${() => {
			this._full ? this.exitFull() : this.enterFull();
		}}
      >
        ${g(this._full ? "exitFull" : "enterFull")}
      </button>
    </div>`;
	}
	_debugInfo(e) {
		let t = [], n = (e, n, r, i) => {
			r && t.push({
				label: e,
				stream: n,
				warm: r.options.warm,
				state: i,
				events: [...r.events]
			});
		};
		return n("SD", this.stream, this._player, this._state), this._hd?.stream && n("HD", this._hd.stream, this._hdPlayer, this._hdState), {
			camera: e,
			connection: this.connection,
			players: t,
			hd: this._hd?.reason,
			webRtcFirstUntil: P.preferWebRtc() ? P.until : void 0,
			mseFirstUntil: L.preferMse() ? L.until : void 0
		};
	}
	_renderHd() {
		if (!this._full) return n;
		if (this.playsHd) return r`<div class="hd-status"><span class="badge">HD</span></div>`;
		let e = this._hd;
		if (!e?.stream) return r`<div class="hd-status" title=${e?.reason ?? n}>
        <span class="badge">SD</span>
        <span class="small">${e ? e.reason : "Choosing the HD stream…"}</span>
      </div>`;
		let t = this._hdState, i;
		return i = this._hdWanted ? this.hdShown ? void 0 : t.kind === "waiting" ? `HD cannot play: ${et(t.error).text}` : "HD starting…" : this._link.chosen ? "SD, as chosen on this device. Tap HD for full quality." : `Lighter SD ${this._link.why}. Tap HD for full quality.`, r`<div class="hd-status" title=${e.reason}>
      <button
        class="hd-toggle"
        aria-pressed=${this._hdWanted ? "true" : "false"}
        aria-label=${this._hdWanted ? "HD on: switch to the lighter SD" : "HD off: switch to HD"}
        @click=${(e) => {
			e.stopPropagation(), this._toggleHd();
		}}
      >
        HD
      </button>
      ${i ? r`<span class="small">${i}</span>` : n}
    </div>`;
	}
	_renderStatus(e) {
		let t = this.offlineSince;
		if (t !== void 0) {
			let e = this.hass?.config?.time_zone, n = Date.now() - t < 432e5 ? q(t, e) : Dt(t, e);
			return r`${$("Offline", r`<i class="dot fault"></i>`)}
        <div class="status center offline" id="status" role="status">
          <span class="what">Offline since ${n}</span>
          <span class="small">Home Assistant cannot reach this camera. It plays again when it is back.</span>
        </div>`;
		}
		if (!this._wanted) {
			if (this.connection?.is_battery) return $("Asleep");
			let e = this.image ? q(this.image.taken, this.hass?.config?.time_zone) : void 0;
			return $(e ? `Picture ${e}` : "No picture yet", g("picture"));
		}
		if (!this.connection?.streams[this.stream]) return $(`No ${this.stream} stream`);
		switch (e.kind) {
			case "playing": return $("Live", r`<i class="dot"></i>`);
			case "starting": return $("Starting");
			case "waiting": {
				let t = et(e.error, this.connection.is_battery);
				return r`${$("Retrying")}
          <div class="status center" id="status" role="status">
            <span class="what">${t.text}</span>
            ${t.advice ? r`<span class="small">${t.advice}</span>` : n}
            <button
              aria-label=${`Retry now: ${this.camera?.name ?? "camera"}`}
              @click=${(e) => {
					e.stopPropagation(), this._player?.retryNow();
				}}
            >
              Retry now
            </button>
          </div>`;
			}
			default: return n;
		}
	}
	static styles = [y, e`
      :host {
        display: block;
        container-type: inline-size;
      }
      /* On the board: fill the cell. */
      :host([fill]),
      :host([fill]) .frame,
      :host([fill]) .tile {
        height: 100%;
      }
      :host([fill]) .tile {
        aspect-ratio: auto;
      }
      /* A board cell is as tall as the board makes it: what it says fits that. */
      :host([fill]:not([full])) .tile {
        container: board-tile / size;
      }
      /* On the board, never in full screen: there the whole picture shows, SD too. */
      :host([fill][fit="cover"]:not([full])) .poster,
      :host([fill][fit="cover"]:not([full])) video.sub {
        object-fit: cover;
      }
      /* Full screen: the browser's, or filling the window (the iPhone). The
         picture and its buttons stay clear of a phone's rounded corners, notch
         and home bar (its safe area); black fills the rest. */
      :host([full]) {
        position: fixed;
        inset: 0;
        z-index: 10000;
        box-sizing: border-box;
        padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px)
          env(safe-area-inset-left, 0px);
        background: #000;
        overscroll-behavior: contain;
      }
      .frame {
        position: relative;
      }
      :host([full]) .frame,
      :host([full]) .tile {
        height: 100%;
      }
      :host([full]) .tile {
        aspect-ratio: auto;
      }
      :host([full]) .poster,
      :host([full]) video {
        object-fit: contain;
      }
      .tile {
        position: relative;
        aspect-ratio: 16 / 9;
        background: #000;
        border-radius: 2px;
        overflow: hidden;
        color: #f4f4f1;
      }
      .tile.interactive {
        cursor: pointer;
      }
      /* Over the picture, under what the tile says: the tile as a button. */
      .open {
        position: absolute;
        inset: 0;
        width: 100%;
        min-height: 0;
        margin: 0;
        padding: 0;
        border: none;
        border-radius: 0;
        background: transparent;
        cursor: pointer;
      }
      .open:hover:not(:disabled) {
        background: transparent;
      }
      .open:focus-visible {
        outline: 2px solid #f4f4f1;
        outline-offset: -4px;
      }
      /* What the tile says lets a press through to it, but for its own buttons. */
      .num,
      .state,
      .status {
        pointer-events: none;
      }
      .status button {
        pointer-events: auto;
      }
      .poster,
      video {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
      video {
        opacity: 0;
        transition: opacity 0.3s;
      }
      .playing video.sub {
        opacity: 1;
      }
      /* HD replaces the sub stream at once, on its first frame. */
      video.hd {
        transition: none;
        background: #000;
      }
      .hd-on video.hd {
        opacity: 1;
      }
      .num {
        position: absolute;
        top: 8px;
        left: 8px;
        min-width: 26px;
        height: 26px;
        padding: 0 5px;
        box-sizing: border-box;
        display: grid;
        place-items: center;
        background: #f4f4f1;
        color: #111418;
        font-family: var(--rv-font-cond);
        font-size: 16px;
        font-weight: 600;
        line-height: 1;
      }
      .state {
        position: absolute;
        top: 8px;
        right: 8px;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 3px 8px;
        background: rgba(17, 20, 24, 0.74);
        font-size: 13px;
        font-weight: 500;
        line-height: 18px;
        white-space: nowrap;
      }
      /* A camera's own view has its controls top right, and no number. */
      :host(:not([fill])) .state {
        left: 8px;
        right: auto;
      }
      /* Full screen says SD or HD, top left. */
      :host([full]) .state {
        display: none;
      }
      /* A card that hides its state still says it to a screen reader. */
      :host([hide-state]) .state {
        width: 1px;
        height: 1px;
        padding: 0;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }
      .state .dot {
        width: 7px;
        height: 7px;
        background: currentColor;
      }
      /* Amber is a fault: a camera Home Assistant cannot reach. */
      .state .dot.fault {
        background: var(--rv-fault);
      }
      .state svg {
        width: 16px;
        height: 16px;
      }
      .label {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        flex-direction: column;
        padding: 26px 48px 8px 10px;
        background: linear-gradient(to top, rgba(0, 0, 0, 0.72), rgba(0, 0, 0, 0));
        pointer-events: none;
      }
      .name {
        font-size: 15px;
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .hint {
        font-size: 13px;
        color: #c9cede;
      }
      .hd-status {
        position: absolute;
        top: 8px;
        left: 8px;
        display: flex;
        gap: 6px;
        align-items: center;
        max-width: calc(100% - 64px);
        text-shadow: 0 0 3px #000;
      }
      .hd-status .badge {
        color: #f4f4f1;
        border-color: rgba(244, 244, 241, 0.5);
      }
      .hd-toggle {
        min-height: 32px;
        padding: 0 10px;
        border: 1.5px solid rgba(244, 244, 241, 0.6);
        border-radius: 2px;
        background: rgba(17, 20, 24, 0.6);
        color: #f4f4f1;
        font-family: var(--rv-font-cond);
        font-size: 15px;
        font-weight: 600;
        text-shadow: none;
      }
      .hd-toggle:hover:not(:disabled) {
        background: rgba(17, 20, 24, 0.85);
      }
      .hd-toggle[aria-pressed="true"] {
        border-color: var(--rv-action);
        background: var(--rv-action);
        color: var(--rv-on-action);
      }
      .hd-toggle:focus-visible {
        outline-color: #f4f4f1;
      }
      .corner-button {
        position: absolute;
        right: 6px;
        bottom: 6px;
        width: 34px;
        height: 34px;
        min-height: 0;
        padding: 6px;
        border: none;
        border-radius: 2px;
        background: rgba(17, 20, 24, 0.6);
        color: #f4f4f1;
      }
      .corner-button:hover:not(:disabled) {
        background: rgba(17, 20, 24, 0.85);
      }
      .corner-button:focus-visible {
        outline-color: #f4f4f1;
      }
      .corner-button.info {
        bottom: 44px;
        opacity: 0.85;
      }
      .corner-button.info[aria-pressed="true"] {
        background: var(--rv-action);
        color: var(--rv-on-action);
        opacity: 1;
      }
      .corner-button.pip {
        right: 44px;
      }
      .corner-button.pip[aria-pressed="true"] {
        background: var(--rv-action);
        color: var(--rv-on-action);
      }
      .corner-button svg {
        width: 22px;
        height: 22px;
      }
      /* On the board, its buttons show on hover; a touch screen has full screen only. */
      @media (hover: hover) {
        :host([fill]:not([full])) .corner-button {
          opacity: 0;
          transition: opacity 0.15s;
        }
        :host([fill]:not([full])) .frame:hover .corner-button,
        :host([fill]:not([full])) .corner-button:focus-visible,
        :host([fill]:not([full])) .corner-button[aria-pressed="true"] {
          opacity: 1;
        }
      }
      @media (hover: none) {
        :host([fill]:not([full])) .corner-button.info {
          display: none;
        }
      }
      .status.center {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        text-align: center;
        /* Clear of the number and state above, and the name below. */
        padding: 36px 12px 34px;
        background: rgba(17, 20, 24, 0.55);
      }
      .status.center .what {
        max-width: 34ch;
        color: #f4f4f1;
        font-family: var(--rv-font-cond);
        font-size: 17px;
        font-weight: 600;
        line-height: 1.25;
      }
      .status.center .small {
        max-width: 42ch;
        color: rgba(244, 244, 241, 0.85);
      }
      .status.center.offline {
        background: rgba(17, 20, 24, 0.7);
      }
      /* The tile's number, state and name stay readable over a message. */
      .num,
      .state,
      .label {
        z-index: 1;
      }
      .status.center button {
        color: #f4f4f1;
        border-color: #f4f4f1;
      }
      .status.center button:hover:not(:disabled) {
        background: rgba(244, 244, 241, 0.12);
      }
      @container (max-width: 260px) {
        .num {
          top: 6px;
          left: 6px;
          min-width: 22px;
          height: 22px;
          font-size: 14px;
        }
        .state {
          top: 6px;
          right: 6px;
          padding: 2px 6px;
          font-size: 12px;
        }
        .label {
          padding: 20px 44px 6px 8px;
        }
        .name {
          font-size: 13px;
        }
        .hint {
          font-size: 12px;
        }
        .corner-button.info {
          display: none;
        }
        /* A small tile says what happened; what to do is on the camera's own view. */
        .status.center {
          padding: 30px 8px 26px;
          gap: 6px;
        }
        .status.center .what {
          font-size: 14px;
        }
        .status.center .small {
          display: none;
        }
      }
      /* A short board tile says what happened; what to do is on the camera's own view. */
      @container board-tile (max-height: 220px) {
        .status.center .small {
          display: none;
        }
      }
      /* Too short for a button as well: tapping it opens the camera's view, which has it. */
      @container board-tile (max-height: 130px) {
        .status.center button {
          display: none;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        video,
        .corner-button {
          transition: none;
        }
      }
    `];
};
function $(e, t) {
	return r`<span class="state" id="state">${t ?? n}${e}</span>`;
}
customElements.get("rv-live-tile") || customElements.define("rv-live-tile", $t);
//#endregion
//#region src/fonts.ts
var en = [
	[
		"Barlow",
		400,
		"barlow-400.woff2"
	],
	[
		"Barlow",
		500,
		"barlow-500.woff2"
	],
	[
		"Barlow",
		600,
		"barlow-600.woff2"
	],
	[
		"Barlow Semi Condensed",
		500,
		"barlow-semi-condensed-500.woff2"
	],
	[
		"Barlow Semi Condensed",
		600,
		"barlow-semi-condensed-600.woff2"
	]
], tn = "reolink-viewer-fonts";
function nn(e, t = document) {
	if (t.getElementById(tn)) return;
	let n = t.createElement("style");
	n.id = tn, n.textContent = en.map(([t, n, r]) => `@font-face{font-family:"${t}";font-style:normal;font-weight:${n};font-display:swap;src:url("${new URL(`fonts/${r}`, e).href}") format("woff2");}`).join("\n"), t.head.appendChild(n);
}
//#endregion
export { ge as $, ze as A, ke as B, w as C, oe as Ct, v as D, rt as E, De as F, g as G, Me as H, Fe as I, c as J, l as K, Le as L, Be as M, He as N, y as O, Ve as P, m as Q, je as R, S, le as St, nt as T, _ as U, Ae as V, Ie as W, a as X, o as Y, re as Z, Et as _, Se as _t, Y as a, ce as at, bt as b, h as bt, Ot as c, pe as ct, Dt as d, ae as dt, ve as et, kt as f, ie as ft, H as g, be as gt, W as h, u as ht, Z as i, me as it, Ue as j, We as k, At as l, te as lt, V as m, ue as mt, zt as n, p as nt, Nt as o, se as ot, z as p, fe as pt, de as q, X as r, he as rt, Mt as s, ne as st, nn as t, ye as tt, q as u, ee as ut, A as v, xe as vt, x as w, mt as x, d as xt, k as y, Te as yt, Pe as z };

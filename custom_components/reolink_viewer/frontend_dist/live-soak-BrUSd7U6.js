import { At as e, Gt as t, Ht as n, Jt as r, L as i, Xt as a, Yt as o, bt as s, ct as c, it as l, ot as u, qt as d, st as f } from "./home-kUcGXot0.js";
import { n as p, t as m } from "./findings-D1f6xVTw.js";
function h(e) {
	return v(e).text;
}
function g(e) {
	return v(e).inShort;
}
var _ = "Open Reolink → Live whenever it suits you; the hours add up across sittings and devices.";
function v(e) {
	let { samples: t, run: n } = e, r = [], i = e.sampleS * 1e3, a = [`Reolink Viewer soak report v${e.version} · ${new Date(e.now).toLocaleString()}`], o = 0;
	if (n) {
		let t = Math.max(0, e.now - n.started_at);
		o = Math.min(n.visible_ms, t) / 36e5;
		let r = Object.entries(n.devices).sort(([, e], [, t]) => t - e);
		a.push(`Soak started ${new Date(n.started_at).toLocaleString()} (${y(t)} h ago) · grid open ${y(n.open_ms)} h, visible ${o.toFixed(1)} h · opened ${n.opens} time${n.opens === 1 ? "" : "s"}`, `Reported by: ${r.length ? r.map(([t, n]) => `${t} (${x(e.now - n)})`).join(", ") : "no grid yet"}`);
	} else a.push("No grid has reported yet: open Reolink → Live and leave it showing; its hours add up.");
	let s = t.at(0), c = t.at(-1);
	if (!s || !c) {
		let t = Math.round(e.warmupS / 60);
		return a.push("", e.startedAt === null ? `No samples yet: Home Assistant is still starting. The first comes ${t} minutes after it has, once live view is up.` : `No samples yet: Home Assistant started at ${new Date(e.startedAt).toLocaleString()}. The first comes ${t} minutes after, once live view is up (go2rtc and the kept-warm feeds).`), r.push({
			grade: "pending",
			text: e.startedAt === null ? `Home Assistant is still starting. Its first measurement comes ${String(t)} minutes after it has.` : `Home Assistant's first measurement comes ${String(t)} minutes after it started (at ${new Date(e.startedAt).toLocaleTimeString()}).`
		}), n || r.push({
			grade: "pending",
			text: "The live board has not been on screen yet.",
			advice: _
		}), {
			text: a.join("\n"),
			inShort: {
				headline: "The test has not started yet.",
				findings: r
			}
		};
	}
	let l = c.at - s.at;
	a.push(`Home Assistant's samples: ${t.length} over ${y(l)} h, since ${new Date(s.at).toLocaleString()} (every ${Math.round(e.sampleS / 60)} min; the last ${Math.round(e.keepS / 3600)} h are kept)`, "");
	let u = [], d = t.map((e) => e.go2rtc.memory_kb).filter((e) => e !== null), f = c.go2rtc.restarts - s.go2rtc.restarts, h = t.filter((e) => e.go2rtc.state !== "running").length;
	a.push(`go2rtc: ${c.go2rtc.state} · restarts ${s.go2rtc.restarts} → ${c.go2rtc.restarts}` + (d.length ? ` · memory ${b(d[0] ?? 0)} → ${b(d.at(-1) ?? 0)} MB (peak ${b(Math.max(...d))} MB)` : " · memory not known")), u.push(f === 0 && h === 0 ? ["✓", "go2rtc ran throughout: no restart"] : ["✗", `go2rtc restarted ${f} time${f === 1 ? "" : "s"}${h ? `, and was not running in ${h} sample${h === 1 ? "" : "s"}` : ""}`]), r.push(f === 0 && h === 0 ? {
		grade: "good",
		text: "The video service (go2rtc) ran the whole time without restarting."
	} : {
		grade: "problem",
		text: `The video service (go2rtc) restarted ${m(f, "time")}${h ? ` and was down for about ${String(h * Math.round(e.sampleS / 60))} minutes` : ""}.`,
		advice: "Look for go2rtc errors in Home Assistant's log, and include the details below if you report it."
	});
	let g = d.at(0), v = d.at(-1);
	g !== void 0 && v !== void 0 && (u.push(v <= g * 2 ? ["✓", `go2rtc's memory steady: ${b(g)} → ${b(v)} MB`] : ["⚠", `go2rtc's memory grew: ${b(g)} → ${b(v)} MB`]), r.push(v <= g * 2 ? {
		grade: "good",
		text: `The video service's memory use stayed steady (about ${b(v)} MB).`
	} : {
		grade: "note",
		text: `The video service's memory use grew from ${b(g)} to ${b(v)} MB.`,
		advice: "If it keeps growing, restart Home Assistant and report it with the details below."
	})), a.push(`WebRTC sessions: ${s.webrtc_sessions} → ${c.webrtc_sessions} (peak ${((e) => Math.max(...t.map(e)))((e) => e.webrtc_sessions)})`, `MSE feeds: ${s.feeds.feeds} → ${c.feeds.feeds}, kept warm ${s.feeds.warm} → ${c.feeds.warm}, viewers ${s.feeds.viewers} → ${c.feeds.viewers} · feeds dropped ${s.feeds.ends} → ${c.feeds.ends}`, "Stream slots in use (the sessions to the cameras), per host:");
	let S = t.filter((e) => e.webrtc_sessions === 0 && e.feeds.viewers === 0), C = S.at(0), w = S.at(-1), T = S.length >= 2 && C !== void 0 && w !== void 0, E = T ? C : s, D = T ? w : c, O = (e, t) => e.hosts.find((e) => e.name === t)?.streams ?? 0, k = [], A = [], j = [], M = [], N = [], P = [], F = 0, I = [...new Set(t.flatMap((e) => e.hosts.map((e) => e.name)))];
	for (let e of I) {
		let n = t.map((t) => t.hosts.find((t) => t.name === e)), r = n.find((e) => e !== void 0), i = n.at(-1), o = i?.limit ?? r?.limit ?? 0, s = Math.max(...n.map((e) => e?.streams ?? 0)), c = Math.max(...n.map((e) => e?.waiting ?? 0)), l = n.map((e) => e?.cpu).filter((e) => e != null);
		a.push(`  ${e}: ${n[0]?.streams ?? 0} → ${i?.streams ?? 0} of ${o} (peak ${s}${c ? `, up to ${c} waiting` : ""}) · CPU ${l.length ? `${l.at(0)}% → ${l.at(-1)}% (peak ${Math.max(...l)}%)` : "not reported"}`);
		let u = O(E, e), d = O(D, e);
		j.push(`${e} ${u} → ${d}`), d > u && (k.push(`${e} ${u} → ${d}`), A.push(`${e}: ${String(u)} to ${String(d)}`)), n.some((e) => e !== void 0 && e.streams > e.limit) && M.push(e), l.length && (N.push(`${e} peak ${Math.max(...l)}%`), P.push(`${e} ${String(Math.max(...l))}%`), F = Math.max(F, ...l));
	}
	T && a.push(`While nobody watched (${S.length} samples, ${new Date(E.at).toLocaleString()} → ${new Date(D.at).toLocaleString()}): ${j.join(", ")}`), u.push(k.length ? ["✗", T ? `Camera sessions grew while nobody watched: ${k.join(", ")}` : `Camera sessions grew: ${k.join(", ")} (close full screen before the report)`] : ["✓", T ? "No growth in camera sessions: while nobody watched, no host held more stream slots at the end than at the start" : "No growth in camera sessions: each host ends with no more stream slots in use than it started with"], M.length ? ["✗", `Above the stream limit: ${M.join(", ")}`] : ["✓", "Within the stream limits: no host above its limit"], ["–", `Camera CPU (Phase 0 set no CPU limit): ${N.length ? N.join(", ") : "not reported (the hosts' CPU sensors are off)"}`]), r.push(k.length ? {
		grade: "problem",
		text: `Connections to your cameras piled up (${A.join(", ")})${T ? " while nobody was watching" : ""}.`,
		advice: "Restarting Home Assistant clears them. Please report it with the details below."
	} : {
		grade: "good",
		text: "Connections to your cameras did not pile up."
	}, M.length ? {
		grade: "problem",
		text: `${M.join(", ")} ${M.length === 1 ? "was" : "were"} asked for more video streams than ${M.length === 1 ? "it" : "they"} can serve.`,
		advice: "Keep fewer cameras warm, and close full screen on other devices."
	} : {
		grade: "good",
		text: "No camera or NVR was asked for more video streams than it can serve."
	}), P.length && r.push(F < 85 ? {
		grade: "note",
		text: `Processor load at its highest: ${P.join(", ")}, ${F < 60 ? "well within what it can handle" : "busy but coping"}.`
	} : {
		grade: "slow",
		text: `Processor load at its highest: ${P.join(", ")}, near its limit.`,
		advice: "Keep fewer cameras warm, or watch fewer of them at once."
	});
	let L = [...new Set(t.flatMap((e) => e.battery.map((e) => e.camera)))];
	L.length || (a.push("Battery cameras: none on battery"), u.push(["–", "Battery cameras: none on battery"]));
	for (let e of L) {
		let n = t.map((t) => t.battery.find((t) => t.camera === e)).filter((e) => e !== void 0).filter((e) => !e.watched), i = n.filter((e) => e.sleeping === !0).length;
		a.push(`Battery camera ${e}: asleep in ${i} of ${n.length} samples while not watched`), u.push(n.length ? i ? ["✓", `${e} slept while not watched`] : ["✗", `${e} never slept while not watched`] : ["–", `${e}: watched in every sample`]), r.push(n.length ? i ? {
			grade: "good",
			text: `${e} slept when nobody was watching, saving its battery.`
		} : {
			grade: "problem",
			text: `${e} stayed awake when nobody was watching, which drains its battery.`,
			advice: "Make sure nothing else streams it (another app, or a dashboard card showing it live)."
		} : {
			grade: "note",
			text: `${e} was being watched the whole time, so whether it sleeps could not be checked.`
		});
	}
	let R = Object.entries(n?.tiles ?? {});
	a.push("Tiles (plays · drops · failed starts):"), R.length || a.push(n ? "  none counted yet" : "  no grid yet");
	let z = [], B = [];
	for (let [e, t] of R) {
		a.push(`  ${e}: ${t.plays} · ${t.drops} · ${t.failures}`);
		let n = t.drops + t.failures;
		n > Math.max(2, o) && (z.push(`${e} (${n} in ${o.toFixed(1)} h)`), B.push(`${e} (${m(n, "time")} in ${o.toFixed(1)} hours)`));
	}
	n && r.unshift(z.length ? {
		grade: "problem",
		text: `Live video kept dropping and reconnecting on ${B.join(", ")}.`,
		advice: "Check those cameras' network (Wi-Fi signal or cable) and power."
	} : {
		grade: "good",
		text: "Live video kept playing: no camera kept dropping and reconnecting."
	}), u.unshift(n ? z.length ? ["✗", `Reconnect loops: ${z.join(", ")}`] : ["✓", "No reconnect loops: no tile dropped or failed to start more than once an hour"] : ["–", "Reconnect loops: no grid has reported yet"]);
	let V = l / 36e5;
	u.push(V >= 24 ? ["✓", `Home Assistant ran live view ${V.toFixed(1)} h (24 needed)`] : ["✗", `Home Assistant's samples cover ${V.toFixed(1)} h of 24: it has to run that long without restarting (no page needs to be open)`], n ? o >= 8 ? ["✓", `The grid was visible ${o.toFixed(1)} h (8 needed), opened ${n.opens} time${n.opens === 1 ? "" : "s"}`] : ["✗", `The grid has been visible ${o.toFixed(1)} h of 8: open it whenever it suits; the hours add up across sittings and devices`] : ["✗", "The grid has been visible 0.0 h of 8: no grid has reported yet"]), r.push(V >= 24 ? {
		grade: "good",
		text: `Home Assistant ran live view for ${V.toFixed(1)} hours.`
	} : {
		grade: "pending",
		text: `Home Assistant has run live view for ${V.toFixed(1)} of 24 hours.`,
		advice: "Leave Home Assistant running; no page needs to be open."
	}, n ? o >= 8 ? {
		grade: "good",
		text: `The live board was on screen for ${o.toFixed(1)} hours, opened ${m(n.opens, "time")}.`
	} : {
		grade: "pending",
		text: `The live board has been on screen for ${o.toFixed(1)} of 8 hours.`,
		advice: _
	} : {
		grade: "pending",
		text: "The live board has not been on screen yet.",
		advice: _
	}), n && e.startedAt !== null && e.startedAt > n.started_at + i && (u.push(["–", `Home Assistant started again at ${new Date(e.startedAt).toLocaleString()}, after the soak began: its samples start then; the grid's hours carry on`]), r.push({
		grade: "note",
		text: `Home Assistant restarted at ${new Date(e.startedAt).toLocaleString()}, after the test began: its hours count from then. The live board's hours carry on.`
	}));
	let H = Math.floor(l / i) + 1;
	t.length < .9 * H && (u.push(["⚠", `${t.length} samples of about ${H} in ${V.toFixed(1)} h: sampling stopped for a while`]), r.push({
		grade: "note",
		text: `Some measurements are missing (${String(t.length)} of about ${String(H)}): Home Assistant was busy or stopped for a while.`
	}));
	let U = u.filter(([e]) => e === "✗").length, W = r.filter((e) => e.grade === "problem").length, G = r.some((e) => e.grade === "pending"), K = {
		headline: W ? `${m(W, "problem")} found${G ? " so far" : ""}.` : G ? "Running: nothing wrong so far." : "Passed: live view held up for the whole test.",
		findings: r
	};
	return a.push("", ...p(K)), a.push("", "Verdict:", ...u.map(([e, t]) => `${e} ${t}`)), a.push("", U ? `Not passed: ${U} ${U === 1 ? "criterion" : "criteria"} not met.` : "Passed."), {
		text: a.join("\n"),
		inShort: K
	};
}
function y(e) {
	return (Math.max(0, e) / 36e5).toFixed(1);
}
function b(e) {
	return (e / 1024).toFixed(1);
}
function x(e) {
	let t = Math.max(0, e) / 6e4;
	return t < 1 ? "now" : t < 60 ? `${Math.floor(t)} min ago` : `${(t / 60).toFixed(1)} h ago`;
}
//#endregion
//#region src/components/live-soak.ts
var S = "rv-live-soak-close", C = class extends d {
	static properties = {
		hass: { attribute: !1 },
		closable: { type: Boolean },
		_state: { state: !0 },
		_confirm: { state: !0 }
	};
	constructor() {
		super(), this.closable = !1, this._state = "loading", this._confirm = !1;
	}
	_read = !1;
	connectedCallback() {
		super.connectedCallback(), this.hass && this.refresh();
	}
	updated() {
		!this._read && this.hass && this.refresh();
	}
	async refresh() {
		let n = this.hass;
		if (n) {
			this._read = !0, this._state = "loading";
			try {
				await c.flush(n);
				let t = await e(n), r = {
					version: u,
					now: Date.now(),
					sampleS: t.sample_s,
					keepS: t.keep_s,
					warmupS: t.warmup_s,
					startedAt: t.started_at,
					run: t.run,
					samples: t.now ? [...t.samples, t.now] : t.samples
				};
				this._state = {
					text: h(r),
					summary: g(r)
				};
			} catch (e) {
				this._state = { error: t(e).message };
			}
		}
	}
	async _startOver() {
		let e = this.hass;
		if (this._confirm = !1, e) {
			c.discard();
			try {
				await n(e, f(navigator.userAgent), c.open), await this.refresh();
			} catch (e) {
				this._state = { error: t(e).message };
			}
		}
	}
	render() {
		let e = this._state, t = typeof e == "object" && "text" in e ? e : void 0;
		return o`<div class="soak" role="region" aria-label="Soak report">
      <p class="intro">
        A day-long test of live view. Home Assistant keeps watch for ${24} hours, and the live board
        counts what happens whenever it is on screen: ${8} hours in all, on any of your devices. It
        tells you whether live video kept playing, whether connections to your cameras piled up, and whether
        battery cameras slept when nobody watched.
      </p>
      ${e === "loading" ? o`<p class="muted">Reading the soak run…</p>` : "error" in e ? o`<div class="banner error" role="alert">Could not make the soak report: ${e.error}</div>` : o`<rv-findings .summary=${e.summary}></rv-findings>`}
      <div class="actions">
        <button
          class="with-icon"
          @click=${() => {
			this.refresh();
		}}
        >
          ${s("refresh")}Refresh
        </button>
        ${this._confirm ? r : o`<button
              @click=${() => {
			this._confirm = !0;
		}}
            >
              Start over…
            </button>`}
        ${this.closable ? o`<button
              @click=${() => {
			this.dispatchEvent(new CustomEvent(S, {
				bubbles: !0,
				composed: !0
			}));
		}}
            >
              Close
            </button>` : r}
      </div>
      ${this._confirm ? o`<div class="banner warning confirm" role="alert">
            <span>Start the soak over? What was counted is dropped.</span>
            <button
              class="danger"
              @click=${() => {
			this._startOver();
		}}
            >
              Start over
            </button>
            <button
              @click=${() => {
			this._confirm = !1;
		}}
            >
              Cancel
            </button>
          </div>` : r}
      ${t ? o`<details class="support">
            <summary>Details for support${s("chevronDown")}</summary>
            <div class="actions">
              <button
                @click=${() => {
			i(t.text).then((e) => {
				this._state = {
					...t,
					copied: e
				};
			});
		}}
              >
                ${t.copied === void 0 ? "Copy report" : t.copied ? "Copied" : "Could not copy"}
              </button>
            </div>
            <pre class="report">${t.text}</pre>
          </details>` : r}
    </div>`;
	}
	static styles = [l, a`
      :host {
        display: block;
      }
      .soak {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .intro {
        margin: 0;
        font-size: 17px;
      }
      .confirm {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px 12px;
      }
      .confirm span {
        flex: 1;
        min-width: 14em;
        font-weight: 500;
      }
      .confirm button.danger {
        background: var(--rv-on-fault);
        border-color: var(--rv-on-fault);
        color: var(--rv-fault);
      }
      details.support {
        border-top: 2px solid var(--rv-rule-strong);
        padding-top: 6px;
      }
      details.support > .actions {
        margin: 6px 0 10px;
      }
    `];
};
customElements.get("rv-live-soak") || customElements.define("rv-live-soak", C);
//#endregion
export { C as RvLiveSoak, S as SOAK_CLOSE_EVENT };

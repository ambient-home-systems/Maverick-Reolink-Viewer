import { a as e, n as t, r as n, t as r } from "./lit-DdRjbP0M.js";
import { Ct as i, Lt as a, Z as o, ct as s, j as c, n as l, p as u } from "./live-49uKNz9D.js";
import { W as d, q as f, r as p } from "./home-BHJMpmeP.js";
//#region src/components/learning-check.ts
var m = (e, t) => `${e.toLocaleString("en-US")} ${t}${e === 1 ? "" : "s"}`, h = (e) => e.replace(/_/g, " ");
function g(e, t, n) {
	if (!e.enabled) return [{
		ok: !1,
		text: "Learning is off: turn on Learn what is normal in Reolink Viewer's options."
	}];
	let r = (e) => u(e, t), i = (e) => n.get(e) ?? e, a = [];
	if (a.push(e.built ? {
		ok: !0,
		text: "Learning is on, and it has learned from the journal."
	} : { text: "Learning is on; it has not learned yet (a minute or so after Home Assistant starts)." }), !e.signals.length) a.push({ text: "No house-wide signal is chosen (optional: Reolink Viewer's options → House-wide signals to learn with)." });
	else for (let t of e.signals) {
		let e = t.state === null || t.state === "unavailable" || t.state === "unknown";
		a.push({
			ok: !e && t.changes > 0,
			text: `House-wide signal ${t.name}: ${e ? `${t.state ?? "not found"} now` : `${t.state} now`}, ${m(t.changes, "change")} learned with`
		});
	}
	let o = `since ${r(e.since)}`, s = e.marks;
	if (!s.length) a.push({ text: `No mark ${o}: nothing to compare yet. Each mark from now on is compared with the event fired for it; open this again in a few days.` });
	else {
		let t = s.filter((e) => e.fired === 1), n = s.filter((e) => e.fired === 0), c = s.filter((e) => e.fired > 1), l = (e) => `${r(e.start)}, ${h(e.kind)} on ${(e.cameras ?? []).join(", ") || i(e.camera)}`;
		a.push({
			ok: t.length === s.length,
			text: `${m(s.length, "mark")} ${o}: ${String(t.length)} of ${String(s.length)} fired its event once`,
			details: [...n.map((e) => `not fired: ${l(e)}`), ...c.map((e) => `fired ${String(e.fired)} times: ${l(e)}`)]
		});
		let u = s.filter((e) => e.fired > 0);
		if (u.length) {
			let t = u.filter((e) => e.when === "start"), n = u.filter((e) => e.when === "end"), r = u.filter((e) => e.when === "late");
			a.push({
				ok: r.length === 0,
				text: `${String(t.length)} of ${String(u.length)} fired within ${String(e.prompt_s)} s of the detection's start` + (n.length ? `, ${String(n.length)} at its end (it stood out by its length)` : ""),
				details: r.map((e) => `late, after ${String(e.delay ?? "?")} s: ${l(e)}`)
			});
		}
	}
	if (e.unmarked.length ? a.push({
		ok: !1,
		text: `${m(e.unmarked.length, "event")} fired for no mark`,
		details: e.unmarked.map((e) => `${r(e.start)}, ${h(e.kind)} on ${i(e.camera)}`)
	}) : s.length && a.push({
		ok: !0,
		text: "No event fired that is not marked"
	}), !e.automations.length) a.push({
		ok: !1,
		text: "No automation listens for unusual activity, so nothing is notified: make the user guide's example (Settings → Automations & scenes, triggered by Reolink Viewer's Unusual activity)."
	});
	else {
		let t = s.filter((e) => e.fired > 0);
		for (let n of e.automations) {
			let e = t.filter((e) => e.automations.includes(n.entity_id)).length;
			a.push({
				ok: n.on && e === t.length,
				text: `Automation ${n.name} (by ${n.how})${n.on ? "" : ", turned off"}: ` + (t.length ? `ran on ${String(e)} of ${m(t.length, "event")} fired` : "no event fired yet to run on") + (n.last_triggered ? `; last ran ${r(Date.parse(n.last_triggered))}` : "")
			});
		}
	}
	return a;
}
function _(e, t, n) {
	let r = (e) => e === void 0 ? "·" : e ? "✓" : "✗", i = e.filter((e) => e.ok === !1).length;
	return [
		`Reolink Viewer learning check · ${u(t, n)}`,
		i ? `${m(i, "thing")} to look at.` : "Everything checked is as it should be.",
		...e.flatMap((e) => [`${r(e.ok)} ${e.text}`, ...(e.details ?? []).map((e) => `    ${e}`)])
	].join("\n");
}
//#endregion
//#region src/components/learning.ts
var v = class extends r {
	static properties = {
		hass: { attribute: !1 },
		_state: { state: !0 },
		_check: { state: !0 }
	};
	_read = !1;
	constructor() {
		super(), this._state = "loading", this._check = "idle";
	}
	updated() {
		!this._read && this.hass && this._load(this.hass);
	}
	async _load(e) {
		this._read = !0;
		try {
			this._state = await s(e);
		} catch (e) {
			this._state = { error: a(e).message };
		}
	}
	render() {
		let e = this._state !== "loading" && !("error" in this._state) && this._state.enabled;
		return n`<section class="card">
      <h2>Learning what is normal</h2>
      ${this._renderState()} ${e ? this._renderCheck() : t}
    </section>`;
	}
	async runCheck() {
		let e = this.hass;
		if (e) {
			this._check = "running";
			try {
				let t = await i(e), n = e.config?.time_zone, r = this._state, a = g(t, n, new Map(r !== "loading" && !("error" in r) && r.enabled ? r.cameras.map((e) => [e.id, e.name]) : []));
				this._check = {
					lines: a,
					report: _(a, Date.now(), n)
				};
			} catch (e) {
				this._check = { error: a(e).message };
			}
		}
	}
	_renderCheck() {
		let e = this._check;
		return n`<h3>The learning check</h3>
      <p class="muted small">
        Compares each mark since the check began keeping its record with the event
        fired for it (once, within 2 s), and says which automations listen and
        whether each ran. It reads what Home Assistant kept: nothing to watch.
      </p>
      <div class="actions">
        <button class="text" ?disabled=${e === "running"} @click=${() => void this.runCheck()}>
          ${e === "running" ? "Checking…" : "Run the check"}
        </button>
        ${typeof e == "object" && "report" in e ? n`<button
              class="text"
              @click=${async () => {
			f(this, await l(e.report) ? "Report copied" : "Could not copy the report", "info");
		}}
            >
              Copy the report
            </button>` : t}
      </div>
      ${typeof e == "object" && "error" in e ? n`<p class="muted">The check could not run: ${e.error}</p>` : t}
      ${typeof e == "object" && "lines" in e ? n`<ul class="check">
            ${e.lines.map((e) => n`<li class=${e.ok === void 0 ? "said" : e.ok ? "pass" : "fail"}>
                  <span class="mark" aria-label=${e.ok === void 0 ? "noted" : e.ok ? "passed" : "failed"}
                    >${e.ok === void 0 ? "·" : e.ok ? "✓" : "✗"}</span
                  >
                  <span>${e.text}</span>
                  ${e.details?.length ? n`<ul>
                        ${e.details.map((e) => n`<li>${e}</li>`)}
                      </ul>` : t}
                </li>`)}
          </ul>` : t}`;
	}
	_renderState() {
		let e = this._state;
		if (e === "loading") return n`<p class="muted">Reading the journal…</p>`;
		if ("error" in e) return n`<p class="muted">
        Could not read the journal: ${e.error}
      </p>`;
		if (!e.enabled) return n`<p class="muted">
        Off. Turn on <strong>Learn what is normal</strong> in Reolink Viewer's
        options (Settings → Devices &amp; services → Reolink Viewer →
        Configure), and Reolink Viewer keeps a journal of what each camera
        detects and when, so it can learn what is normal for each and, later,
        mark what is unusual. The journal stays on this Home Assistant.
      </p>`;
		let r = this.hass?.config?.time_zone, i = e.cameras, a = e.unusual;
		return n`<p>
        On since ${u(e.created, r)}:
        ${y(e.detections, "detection")} from
        ${y(i.length, "camera")} so far
        (${T(e.bytes)}).${e.imported ? ` It started with ${y(e.imported, "change")} from Home Assistant's history.` : ""}
      </p>
      ${i.length ? n`<ul>
            ${i.map((e) => n`<li>
                  <span class="name">${e.name}</span>:
                  <span class="muted"
                    >${y(e.detections, "detection")}, since
                    ${u(e.first, r)}</span
                  >${a?.built ? n`. ${C(a.cameras[e.id])}` : t}
                </li>`)}
          </ul>` : t}
      ${e.signals?.length ? n`<p>
            Learned with
            ${e.signals.map((t, i) => n`${i ? i === (e.signals?.length ?? 0) - 1 ? " and " : ", " : ""}<span
                    class="name"
                    >${t.name}</span
                  >
                  <span class="muted"
                    >(${y(t.changes, "change")} since ${u(t.first, r)})</span
                  >`)}.
          </p>` : t}
      ${a ? this._renderUnusual(a, r, new Map(i.map((e) => [e.id, e.name]))) : t}`;
	}
	_renderUnusual(e, r, i) {
		if (!e.built) return n`<p class="muted small">
        It is learning from the journal; what it makes of each camera shows here
        once it has (a minute or so after Home Assistant starts).
      </p>`;
		let a = Object.values(e.cameras).some((e) => e.marking), o = e.marks / e.days;
		return n`<h3>Unusual in the last ${e.days} days</h3>
      ${a ? n`<p>
            ${y(e.marks, "mark")}, about
            ${o < 10 ? o.toFixed(1) : Math.round(o)} a day, of
            ${y(e.events, "event")}, at
            <strong>${b[e.sensitivity]}</strong>.
          </p>` : n`<p class="muted">
            None yet: no camera has a week of history and 200 detections.
          </p>`}
      ${e.latest.length ? n`<ol class="marks">
            ${e.latest.map((e) => n`<li>
                  <span class="when">${u(e.start, r)}</span>
                  <span>${e.reason}</span>
                </li>`)}
          </ol>` : t}
      <details>
        <summary>The numbers behind it</summary>
        <dl>
          <dt>Without the daily cap</dt>
          <dd>
            ${y(e.uncapped, "mark")} (the cap keeps a busy property to
            about its sensitivity's number a day)
          </dd>
          <dt>The line a score must pass</dt>
          <dd>
            ${e.cap === null ? `the floor, ${e.floor}` : `${e.cap} (the daily cap; the floor is ${e.floor})`}
          </dd>
          <dt>Marks by kind</dt>
          <dd>${w(e.by_kind, (e) => e.replace(/_/g, " "))}</dd>
          <dt>What stood out most</dt>
          <dd>${w(e.by_reason, (e) => S[e] ?? e)}</dd>
          <dt>Each camera's own line</dt>
          <dd>
            ${Object.entries(e.cameras).filter(([, e]) => e.line !== null).map(([e, t]) => `${i.get(e) ?? e} ${t.line}`).join(", ") || "none yet"}
          </dd>
          <dt>Compared with</dt>
          <dd>${x[e.scope]}</dd>
          <dt>Learned</dt>
          <dd>
            ${u(e.built, r)}, in ${e.built_in_s}
            s${e.computed_s === void 0 ? "" : `, ${e.computed_s} s of it computing`}
          </dd>
        </dl>
      </details>
      <p class="muted small">
        Unusual means rare for that camera, never dangerous. Motion is learned
        from, never marked, and the same thing seen on several cameras within a
        minute is one mark. It learns again each night at 03:17, and scores what
        it has seen since against that.
      </p>`;
	}
	static styles = [c, e`
      :host {
        display: block;
      }
      ul {
        margin: 0 0 8px;
        padding-left: 20px;
      }
      li .name {
        font-weight: 500;
      }
      h3 {
        margin: 16px 0 8px;
        font-size: 1em;
        font-weight: 500;
      }
      ol.marks {
        margin: 0 0 8px;
        padding-left: 20px;
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin: 8px 0;
      }
      ul.check {
        list-style: none;
        padding-left: 0;
      }
      ul.check > li {
        display: grid;
        grid-template-columns: 20px 1fr;
        margin-bottom: 4px;
      }
      ul.check > li > ul {
        grid-column: 2;
        margin: 2px 0 0;
        padding-left: 16px;
        color: var(--secondary-text-color);
      }
      ul.check .mark {
        font-weight: 600;
      }
      ul.check .pass .mark {
        color: var(--rv-text);
      }
      /* What needs a look, in the fault colour (as the playback check's findings). */
      ul.check .fail .mark,
      ul.check .fail > span:nth-child(2) {
        color: var(--rv-fault-ink);
      }
      ul.check .said .mark {
        color: var(--rv-muted);
      }
      ol.marks li {
        margin-bottom: 4px;
      }
      ol.marks .when {
        color: var(--secondary-text-color);
        margin-right: 4px;
      }
      details {
        margin: 8px 0;
      }
      summary {
        cursor: pointer;
        min-height: 24px;
      }
      dl {
        display: grid;
        grid-template-columns: max-content 1fr;
        gap: 4px 12px;
        margin: 8px 0 0;
      }
      dt {
        color: var(--secondary-text-color);
      }
      dd {
        margin: 0;
      }
      @media (max-width: 600px) {
        dl {
          grid-template-columns: 1fr;
        }
        dd {
          margin-bottom: 6px;
        }
      }
    `];
}, y = (e, t) => `${e.toLocaleString("en-US")} ${t}${e === 1 ? "" : "s"}`, b = {
	few: "Only the strangest",
	balanced: "Balanced",
	many: "More, including borderline ones"
}, x = {
	together: "All cameras together",
	host: "Each NVR, Home Hub or camera on its own connection",
	camera: "Each camera on its own"
}, S = {
	kind: "what it was",
	clock: "the time of day",
	solar: "the light (time from sunset)",
	duration: "how long it lasted",
	predecessor: "what fired before it",
	weekend: "the day of the week",
	signal: "a house-wide signal"
};
function C(e) {
	return e ? e.marking ? "Marks what is unusual" : `Learning: ${[e.needs_days ? y(e.needs_days, "more day") : "", e.needs_events ? y(e.needs_events, "more detection") : ""].filter(Boolean).join(" and ") || "almost there"}` : "Learning";
}
function w(e, t) {
	let n = Object.entries(e).sort((e, t) => t[1] - e[1]);
	return n.length ? n.map(([e, n]) => `${t(e)} ${n}`).join(", ") : "none";
}
function T(e) {
	return e < 1e6 ? `${Math.max(1, Math.round(e / 1e3))} KB` : `${(e / 1e6).toFixed(1)} MB`;
}
customElements.get("rv-learning") || customElements.define("rv-learning", v);
//#endregion
//#region src/components/device-list.ts
var E = class extends r {
	static properties = {
		devices: { attribute: !1 },
		cameras: { attribute: !1 },
		hostId: { attribute: !1 }
	};
	constructor() {
		super(), this.cameras = [];
	}
	render() {
		let e = this.devices;
		if (!e) return n`<p class="muted">Loading devices…</p>`;
		if (!e.hosts.length && !e.cameras.length) return n`<section class="card">
        <h2>No Reolink devices</h2>
        <p class="muted">
          Set up your cameras, NVRs or Home Hubs in the Reolink integration first; they appear
          here once loaded.
        </p>
      </section>`;
		let r = new Map(e.cameras.map((e) => [e.id, e]));
		if (this.hostId !== void 0) {
			let t = e.hosts.find((e) => e.id === this.hostId);
			return t ? this._renderCameras(t, r) : n``;
		}
		let i = e.cameras.filter((e) => e.host_id === null);
		return n`
      ${e.hosts.map((e) => this._renderHost(e, r))}
      ${i.length ? n`<section class="card">
            <div class="head"><h2>Cameras added directly</h2></div>
            ${this._renderTable(i.map((e) => this._renderCamera(e)))}
          </section>` : t}
    `;
	}
	_renderHost(e, t) {
		let r = p(e.kind);
		return n`<section class="card">
      <div class="head">
        <h2>
          <button class="link host" @click=${() => {
			d(this, {
				view: "device",
				id: e.id,
				tab: "overview"
			});
		}}>${e.name ?? e.entry_title}</button>
        </h2>
        <p class="muted">
          ${[
			r,
			e.model,
			e.sw_version && `firmware ${e.sw_version}`
		].filter(Boolean).join(" · ")}
        </p>
      </div>
      ${this._renderCameras(e, t)}
    </section>`;
	}
	_renderCameras(e, t) {
		let r = e.camera_ids.map((e) => t.get(e)).filter((e) => e !== void 0);
		return r.length ? this._renderTable(r.map((t) => this._renderCamera(t, e))) : n`<p class="muted">No cameras on this ${p(e.kind)}.</p>`;
	}
	_renderTable(e) {
		return n`<div class="cols" aria-hidden="true">
        <span></span><span>Camera</span><span>Channel</span><span class="model">Model</span><span>State</span><span></span>
      </div>
      <ul class="devices">
        ${e}
      </ul>`;
	}
	_renderCamera(e, r) {
		let i = r ? e.connections.find((e) => e.host_id === r.id)?.channel : void 0, a = r !== void 0 && e.connections.some((e) => e.via === "direct"), s = this.cameras.find((t) => t.id === e.id)?.number, c = [a ? "Also added directly" : void 0, e.primary_view === "snapshot" ? "Snapshots only" : void 0].filter((e) => e !== void 0);
		return n`<li>
      <button
        class="row"
        @click=${() => {
			d(this, {
				view: "device",
				id: e.id,
				tab: "overview"
			});
		}}
      >
        <span class="plat-cell">${s === void 0 ? t : n`<span class="plat" aria-hidden="true">${s}</span>`}</span>
        <span class="name">${e.name ?? "Camera"}</span>
        <span class="ch muted">${i == null ? "Direct" : `Ch ${String(i + 1)}`}</span>
        <span class="model muted">${e.model ?? ""}</span>
        <span class="state">${D(e)}${c.length ? n`<span class="flags muted">${c.join(" · ")}</span>` : t}</span>
        ${o("chevron")}
      </button>
    </li>`;
	}
	static styles = [c, e`
      :host {
        display: flex;
        flex-direction: column;
        gap: 28px;
        container-type: inline-size;
      }
      .head {
        display: flex;
        align-items: baseline;
        flex-wrap: wrap;
        gap: 4px 14px;
        margin-bottom: 10px;
      }
      .head h2 {
        margin: 0;
      }
      .head p {
        margin: 0;
        font-size: 15px;
      }
      .host {
        font: inherit;
      }
      .cols,
      .row {
        display: grid;
        grid-template-columns: 34px minmax(0, 2fr) 72px minmax(0, 1.2fr) minmax(0, 1.6fr) 20px;
        column-gap: 14px;
        align-items: center;
      }
      .cols {
        padding: 0 4px 6px;
        border-bottom: 1px solid var(--rv-rule-strong);
        color: var(--rv-muted);
        font-size: 13px;
        font-weight: 500;
      }
      ul.devices {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      li {
        border-bottom: 1px solid var(--rv-rule);
      }
      .row {
        width: 100%;
        min-height: 52px;
        padding: 6px 4px;
        border: none;
        border-radius: 0;
        background: transparent;
        color: inherit;
        text-align: left;
        font-weight: 400;
      }
      .row:focus-visible {
        outline-offset: -2px;
      }
      .plat {
        width: max-content;
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
      .name {
        font-size: 17px;
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .row .ch,
      .row .model {
        font-size: 15px;
      }
      .state {
        display: flex;
        flex-direction: column;
        font-size: 15px;
      }
      .offline {
        color: var(--rv-fault-ink);
        font-weight: 600;
      }
      .flags {
        font-size: 13px;
      }
      .row svg {
        width: 18px;
        height: 18px;
        color: var(--rv-muted);
      }
      @container (max-width: 640px) {
        .cols {
          display: none;
        }
        .row {
          grid-template-columns: 30px minmax(0, 1fr) auto 18px;
        }
        .model {
          display: none;
        }
        .plat-cell {
          grid-row: 1 / span 2;
        }
        .name {
          grid-column: 2;
          grid-row: 1;
        }
        .ch {
          grid-column: 2;
          grid-row: 2;
          font-size: 14px;
        }
        .state {
          grid-column: 3;
          grid-row: 1 / span 2;
          text-align: right;
        }
        .row svg {
          grid-column: 4;
          grid-row: 1 / span 2;
        }
      }
    `];
};
function D(e) {
	let r = e.status;
	return r.online === !1 ? n`<span class="offline">Offline</span>` : r.sleeping ? n`<span>Asleep</span>` : r.online ? n`<span>Online</span>` : t;
}
customElements.get("rv-device-list") || customElements.define("rv-device-list", E);
//#endregion
export { E as RvDeviceList };

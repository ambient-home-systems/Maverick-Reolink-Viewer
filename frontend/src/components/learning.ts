import { LitElement, css, html, nothing, type TemplateResult } from "lit";

import { fetchJournalStatus, fetchUnusualCheck, toError } from "../api";
import { copyText } from "../clipboard";
import { formatStamp } from "../playback/time";
import { sharedStyles } from "../styles";
import { learningCheckLines, learningCheckReport, type CheckLine } from "./learning-check";
import { toast } from "./navigation";
import type {
  HomeAssistant,
  JournalStatus,
  UnusualCamera,
  UnusualSensitivity,
  UnusualStatus,
} from "../types";

type LearningState = "loading" | JournalStatus | { error: string };
type CheckState = "idle" | "running" | { lines: CheckLine[]; report: string } | { error: string };

/**
 * "Learning what is normal" (Phase 8), on the Devices page: whether the
 * detection journal records, since when, and how much, per camera, or how to
 * turn it on (Reolink Viewer's options); whether each camera marks what is
 * unusual yet, or what it is short of; the last week's marks with their
 * sentences, and the numbers behind them for tuning. Read when shown.
 */
export class RvLearning extends LitElement {
  static override properties = {
    hass: { attribute: false },
    _state: { state: true },
    _check: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  declare _state: LearningState;
  declare _check: CheckState;

  private _read = false;

  constructor() {
    super();
    this._state = "loading";
    this._check = "idle";
  }

  protected override updated(): void {
    if (!this._read && this.hass) void this._load(this.hass);
  }

  private async _load(hass: HomeAssistant): Promise<void> {
    this._read = true;
    try {
      this._state = await fetchJournalStatus(hass);
    } catch (err) {
      this._state = { error: toError(err).message };
    }
  }

  protected override render(): TemplateResult {
    const on = this._state !== "loading" && !("error" in this._state) && this._state.enabled;
    return html`<section class="card">
      <h2>Learning what is normal</h2>
      ${this._renderState()} ${on ? this._renderCheck() : nothing}
    </section>`;
  }

  /** Run the learning check: the marks compared with the events fired, and who listens. */
  async runCheck(): Promise<void> {
    const hass = this.hass;
    if (!hass) return;
    this._check = "running";
    try {
      const result = await fetchUnusualCheck(hass);
      const zone = hass.config?.time_zone;
      const state = this._state;
      const names = new Map(
        state !== "loading" && !("error" in state) && state.enabled ? state.cameras.map((c) => [c.id, c.name]) : [],
      );
      const lines = learningCheckLines(result, zone, names);
      this._check = { lines, report: learningCheckReport(lines, Date.now(), zone) };
    } catch (err) {
      this._check = { error: toError(err).message };
    }
  }

  private _renderCheck(): TemplateResult {
    const check = this._check;
    return html`<h3>The learning check</h3>
      <p class="muted small">
        Compares each mark since the check began keeping its record with the event
        fired for it (once, within 2 s), and says which automations listen and
        whether each ran. It reads what Home Assistant kept: nothing to watch.
      </p>
      <div class="actions">
        <button class="text" ?disabled=${check === "running"} @click=${() => void this.runCheck()}>
          ${check === "running" ? "Checking…" : "Run the check"}
        </button>
        ${typeof check === "object" && "report" in check
          ? html`<button
              class="text"
              @click=${async () => {
                toast(this, (await copyText(check.report)) ? "Report copied" : "Could not copy the report", "info");
              }}
            >
              Copy the report
            </button>`
          : nothing}
      </div>
      ${typeof check === "object" && "error" in check
        ? html`<p class="muted">The check could not run: ${check.error}</p>`
        : nothing}
      ${typeof check === "object" && "lines" in check
        ? html`<ul class="check">
            ${check.lines.map(
              (line) =>
                html`<li class=${line.ok === undefined ? "said" : line.ok ? "pass" : "fail"}>
                  <span class="mark" aria-label=${line.ok === undefined ? "noted" : line.ok ? "passed" : "failed"}
                    >${line.ok === undefined ? "·" : line.ok ? "✓" : "✗"}</span
                  >
                  <span>${line.text}</span>
                  ${line.details?.length
                    ? html`<ul>
                        ${line.details.map((detail) => html`<li>${detail}</li>`)}
                      </ul>`
                    : nothing}
                </li>`,
            )}
          </ul>`
        : nothing}`;
  }

  private _renderState(): TemplateResult | typeof nothing {
    const state = this._state;
    if (state === "loading")
      return html`<p class="muted">Reading the journal…</p>`;
    if ("error" in state)
      return html`<p class="muted">
        Could not read the journal: ${state.error}
      </p>`;
    if (!state.enabled) {
      return html`<p class="muted">
        Off. Turn on <strong>Learn what is normal</strong> in Reolink Viewer's
        options (Settings → Devices &amp; services → Reolink Viewer →
        Configure), and Reolink Viewer keeps a journal of what each camera
        detects and when, so it can learn what is normal for each and, later,
        mark what is unusual. The journal stays on this Home Assistant.
      </p>`;
    }
    const zone = this.hass?.config?.time_zone;
    const cameras = state.cameras;
    const unusual = state.unusual;
    return html`<p>
        On since ${formatStamp(state.created, zone)}:
        ${count(state.detections, "detection")} from
        ${count(cameras.length, "camera")} so far
        (${size(state.bytes)}).${state.imported
          ? ` It started with ${count(state.imported, "change")} from Home Assistant's history.`
          : ""}
      </p>
      ${cameras.length
        ? html`<ul>
            ${cameras.map(
              (camera) =>
                html`<li>
                  <span class="name">${camera.name}</span>:
                  <span class="muted"
                    >${count(camera.detections, "detection")}, since
                    ${formatStamp(camera.first, zone)}</span
                  >${unusual?.built
                    ? html`. ${cameraState(unusual.cameras[camera.id])}`
                    : nothing}
                </li>`,
            )}
          </ul>`
        : nothing}
      ${state.signals?.length
        ? html`<p>
            Learned with
            ${state.signals.map(
              (signal, index) =>
                html`${index ? (index === (state.signals?.length ?? 0) - 1 ? " and " : ", ") : ""}<span
                    class="name"
                    >${signal.name}</span
                  >
                  <span class="muted"
                    >(${count(signal.changes, "change")} since ${formatStamp(signal.first, zone)})</span
                  >`,
            )}.
          </p>`
        : nothing}
      ${unusual
        ? this._renderUnusual(
            unusual,
            zone,
            new Map(cameras.map((c) => [c.id, c.name])),
          )
        : nothing}`;
  }

  private _renderUnusual(
    unusual: UnusualStatus,
    zone: string | undefined,
    names: Map<string, string>,
  ): TemplateResult {
    if (!unusual.built) {
      return html`<p class="muted small">
        It is learning from the journal; what it makes of each camera shows here
        once it has (a minute or so after Home Assistant starts).
      </p>`;
    }
    const marking = Object.values(unusual.cameras).some(
      (camera) => camera.marking,
    );
    const perDay = unusual.marks / unusual.days;
    return html`<h3>Unusual in the last ${unusual.days} days</h3>
      ${marking
        ? html`<p>
            ${count(unusual.marks, "mark")}, about
            ${perDay < 10 ? perDay.toFixed(1) : Math.round(perDay)} a day, of
            ${count(unusual.events, "event")}, at
            <strong>${SENSITIVITY[unusual.sensitivity]}</strong>.
          </p>`
        : html`<p class="muted">
            None yet: no camera has a week of history and 200 detections.
          </p>`}
      ${unusual.latest.length
        ? html`<ol class="marks">
            ${unusual.latest.map(
              (mark) =>
                html`<li>
                  <span class="when">${formatStamp(mark.start, zone)}</span>
                  <span>${mark.reason}</span>
                </li>`,
            )}
          </ol>`
        : nothing}
      <details>
        <summary>The numbers behind it</summary>
        <dl>
          <dt>Without the daily cap</dt>
          <dd>
            ${count(unusual.uncapped, "mark")} (the cap keeps a busy property to
            about its sensitivity's number a day)
          </dd>
          <dt>The line a score must pass</dt>
          <dd>
            ${unusual.cap === null
              ? `the floor, ${unusual.floor}`
              : `${unusual.cap} (the daily cap; the floor is ${unusual.floor})`}
          </dd>
          <dt>Marks by kind</dt>
          <dd>${tally(unusual.by_kind, (kind) => kind.replace(/_/g, " "))}</dd>
          <dt>What stood out most</dt>
          <dd>${tally(unusual.by_reason, (term) => REASONS[term] ?? term)}</dd>
          <dt>Each camera's own line</dt>
          <dd>
            ${Object.entries(unusual.cameras)
              .filter(([, camera]) => camera.line !== null)
              .map(([id, camera]) => `${names.get(id) ?? id} ${camera.line}`)
              .join(", ") || "none yet"}
          </dd>
          <dt>Compared with</dt>
          <dd>${SCOPE[unusual.scope]}</dd>
          <dt>Learned</dt>
          <dd>
            ${formatStamp(unusual.built, zone)}, in ${unusual.built_in_s}
            s${unusual.computed_s === undefined
              ? ""
              : `, ${unusual.computed_s} s of it computing`}
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

  static override styles = [
    sharedStyles,
    css`
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
    `,
  ];
}

const count = (n: number, noun: string) =>
  `${n.toLocaleString("en-US")} ${noun}${n === 1 ? "" : "s"}`;

const SENSITIVITY: Record<UnusualSensitivity, string> = {
  few: "Only the strangest",
  balanced: "Balanced",
  many: "More, including borderline ones",
};

const SCOPE: Record<UnusualStatus["scope"], string> = {
  together: "All cameras together",
  host: "Each NVR, Home Hub or camera on its own connection",
  camera: "Each camera on its own",
};

/** What each signal is, for "what stood out most". */
const REASONS: Record<string, string> = {
  kind: "what it was",
  clock: "the time of day",
  solar: "the light (time from sunset)",
  duration: "how long it lasted",
  predecessor: "what fired before it",
  weekend: "the day of the week",
  signal: "a house-wide signal",
};

/** Whether a camera marks yet, or what it is short of. */
function cameraState(camera: UnusualCamera | undefined): string {
  if (!camera) return "Learning";
  if (camera.marking) return "Marks what is unusual";
  const short = [
    camera.needs_days ? count(camera.needs_days, "more day") : "",
    camera.needs_events ? count(camera.needs_events, "more detection") : "",
  ].filter(Boolean);
  return `Learning: ${short.join(" and ") || "almost there"}`;
}

/** "person 3, animal 2", most first. */
function tally(
  counts: Record<string, number>,
  label: (key: string) => string,
): string {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return entries.length
    ? entries.map(([key, n]) => `${label(key)} ${n}`).join(", ")
    : "none";
}

function size(bytes: number): string {
  return bytes < 1_000_000
    ? `${Math.max(1, Math.round(bytes / 1000))} KB`
    : `${(bytes / 1_000_000).toFixed(1)} MB`;
}

if (!customElements.get("rv-learning")) {
  customElements.define("rv-learning", RvLearning);
}

declare global {
  interface HTMLElementTagNameMap {
    "rv-learning": RvLearning;
  }
}

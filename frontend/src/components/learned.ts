import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from "lit";

import { fetchLearnedProfile } from "../api";
import { icon } from "../icons";
import { typeLabel } from "../playback/timeline-math";
import { sharedStyles } from "../styles";
import type { HomeAssistant, LearnedKind, LearnedProfile, LearnedValue } from "../types";
import { kindType } from "../unusual";

/** Values shown per list; the rest are summed in a line. */
export const LIST_ROWS = 5;

const hour = (h: number): string => `${String(h % 24).padStart(2, "0")}:00`;
const number = (n: number): string => n.toLocaleString("en-US");

/** A kind of thing seen, as the panel names it: "Person", "Doorbell". */
export function kindName(kind: string): string {
  const label = typeLabel(kindType(kind));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** The time of day in words, for a screen reader (the bars are a picture of it). */
export function clockSummary(clock: LearnedKind["clock"]): string {
  const total = clock.reduce((sum, h) => sum + h.events, 0);
  if (!total) return "Not seen at any hour yet.";
  const busiest = clock.reduce((best, h) => (h.events > best.events ? h : best));
  const empty = clock.filter((h) => h.events === 0).length;
  return `Most often ${hour(busiest.hour)} to ${hour(busiest.hour + 1)} (${number(busiest.events)} of ${number(total)})${
    empty ? `; never in ${String(empty)} of the 24 hours` : ""
  }.`;
}

/**
 * What one camera has learned (Phase 8.3), on its Overview: per kind of thing
 * it sees, when (each hour), on which days, for how long and what fired first.
 * Values seen fewer times than it takes to know them are marked: they can
 * still make an event stand out. The way to spot a camera that learned
 * something wrong (a spider every night is normal to it now).
 */
export class RvLearned extends LitElement {
  static override properties = {
    hass: { attribute: false },
    camera: {},
    _profile: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  /** The camera's device id. */
  declare camera: string | undefined;
  declare _profile: LearnedProfile | undefined;

  private _asked: string | undefined;

  protected override updated(changed: PropertyValues<this>): void {
    if ((changed.has("camera") || changed.has("hass")) && this.hass && this.camera && this._asked !== this.camera) {
      this._asked = this.camera;
      void this._load(this.hass, this.camera);
    }
  }

  protected override willUpdate(): void {
    // Not even a gap on the page while there is nothing to show (learning off).
    this.hidden = !this._profile?.enabled;
  }

  private async _load(hass: HomeAssistant, camera: string): Promise<void> {
    try {
      const profile = await fetchLearnedProfile(hass, camera);
      if (camera === this.camera) this._profile = profile;
    } catch {
      // Nothing to show: learning is a page of its own, and this only adds to it.
    }
  }

  protected override render(): TemplateResult | typeof nothing {
    const profile = this._profile;
    if (!profile?.enabled) return nothing;
    const kinds = profile.kinds ?? [];
    const knownAfter = profile.known_after ?? 10;
    const state = profile.state;
    return html`<section class="card">
      <h2>What it has learned</h2>
      ${!profile.built
        ? html`<p class="muted">It is learning from the journal; this shows once it has.</p>`
        : !kinds.length
          ? html`<p class="muted">Nothing yet: this camera has not detected anything since learning began.</p>`
          : html`<p class="intro">
                ${state?.marking
                  ? "It marks what is unusual for this camera."
                  : state
                    ? `Still learning before it marks: ${learningShort(state)}.`
                    : nothing}
                What it has seen ${knownAfter} times is normal here; whatever it has seen less often can
                still make an event stand out.
              </p>
              ${kinds.map((kind, index) => this._renderKind(kind, knownAfter, index === 0))}`}
    </section>`;
  }

  private _renderKind(kind: LearnedKind, knownAfter: number, open: boolean): TemplateResult {
    const name = kindName(kind.kind);
    return html`<details class="kind" ?open=${open}>
      <summary>
        <span class="name">${name}</span>
        <span class="muted">${number(kind.events)} seen${kind.days >= 1 ? ` in ${String(Math.round(kind.days))} days` : ""}</span>
        ${icon("chevronDown")}
      </summary>
      <div class="charts">
        ${this._renderHours(kind)} ${this._renderDays(kind)}
      </div>
      <div class="lists">
        ${this._renderList("How long", kind.duration, knownAfter)}
        ${this._renderList("What fired first", kind.predecessor, knownAfter)}
      </div>
      ${kind.kind === "motion"
        ? html`<p class="muted small">Motion is learned from, never marked.</p>`
        : nothing}
    </details>`;
  }

  private _renderHours(kind: LearnedKind): TemplateResult {
    const most = Math.max(1, ...kind.clock.map((h) => h.events));
    return html`<figure class="hours">
      <figcaption>Time of day</figcaption>
      <div class="bars" role="img" aria-label=${clockSummary(kind.clock)}>
        ${kind.clock.map(
          (h) =>
            html`<span
              class="bar"
              title="${hour(h.hour)}–${hour(h.hour + 1)}: ${number(h.events)}"
              ><span class="fill" style="height: ${((h.events / most) * 100).toFixed(1)}%"></span
            ></span>`,
        )}
      </div>
      <div class="axis" aria-hidden="true">
        <span>00</span><span>06</span><span>12</span><span>18</span><span>24</span>
      </div>
    </figure>`;
  }

  private _renderDays(kind: LearnedKind): TemplateResult {
    const most = Math.max(1, ...kind.day_of_week.map((d) => d.events));
    const said = kind.day_of_week.map((d) => `${d.label} ${number(d.events)}`).join(", ");
    return html`<figure class="days">
      <figcaption>Day of the week</figcaption>
      <div class="bars" role="img" aria-label=${said}>
        ${kind.day_of_week.map(
          (d) =>
            html`<span class="bar" title="${d.label}: ${number(d.events)}"
              ><span class="fill" style="height: ${((d.events / most) * 100).toFixed(1)}%"></span
            ></span>`,
        )}
      </div>
      <div class="axis" aria-hidden="true">${kind.day_of_week.map((d) => html`<span>${d.label.charAt(0)}</span>`)}</div>
    </figure>`;
  }

  private _renderList(title: string, values: LearnedValue[], knownAfter: number): TemplateResult {
    const shown = values.slice(0, LIST_ROWS);
    const rest = values.slice(LIST_ROWS);
    const restShare = rest.reduce((sum, v) => sum + v.share, 0);
    return html`<div class="list">
      <h3>${title}</h3>
      ${shown.length
        ? html`<ul>
            ${shown.map(
              (v) =>
                html`<li>
                  <span class="label"
                    >${v.label}${v.events < knownAfter
                      ? html` <span class="badge">Can stand out</span>`
                      : nothing}</span
                  >
                  <span class="share">${percent(v.share)}</span>
                  <span class="meter" aria-hidden="true"
                    ><span class="fill" style="width: ${(v.share * 100).toFixed(1)}%"></span
                  ></span>
                </li>`,
            )}
          </ul>`
        : html`<p class="muted">Nothing yet.</p>`}
      ${rest.length
        ? html`<p class="muted small">
            And ${rest.length} more, ${percent(restShare)} between them.
          </p>`
        : nothing}
    </div>`;
  }

  static override styles = [
    sharedStyles,
    css`
      :host {
        display: block;
        container-type: inline-size;
      }
      :host([hidden]) {
        display: none;
      }
      h2 {
        margin: 0 0 6px;
      }
      .intro {
        margin: 0 0 12px;
        max-width: 72ch;
      }
      .kind {
        border-top: 1px solid var(--rv-rule);
      }
      .kind > summary {
        display: flex;
        align-items: center;
        gap: 10px;
        min-height: 44px;
        padding: 10px 0;
        cursor: pointer;
      }
      .kind > summary .name {
        font-size: 17px;
        font-weight: 500;
      }
      .kind > summary svg {
        width: 18px;
        height: 18px;
        margin-left: auto;
      }
      .charts {
        display: grid;
        grid-template-columns: minmax(0, 3fr) minmax(0, 1fr);
        gap: 24px;
        margin-bottom: 14px;
      }
      figure {
        margin: 0;
      }
      figcaption,
      .list h3 {
        margin: 0 0 6px;
        color: var(--rv-muted);
        font-size: 14px;
        font-weight: 500;
      }
      .bars {
        display: grid;
        grid-auto-flow: column;
        grid-auto-columns: minmax(0, 1fr);
        gap: 2px;
        align-items: end;
        height: 72px;
        border-bottom: 1px solid var(--rv-rule-strong);
      }
      .bar {
        position: relative;
        height: 100%;
        display: flex;
        align-items: flex-end;
      }
      .bar .fill {
        width: 100%;
        min-height: 0;
        background: var(--rv-text);
        border-radius: 3px 3px 0 0;
      }
      .axis {
        display: flex;
        justify-content: space-between;
        margin-top: 4px;
        color: var(--rv-muted);
        font-size: 12px;
        font-variant-numeric: tabular-nums;
      }
      .days .axis {
        display: grid;
        grid-auto-flow: column;
        grid-auto-columns: minmax(0, 1fr);
        gap: 2px;
        text-align: center;
      }
      .lists {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 24px;
        padding-bottom: 14px;
      }
      ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        grid-template-columns: minmax(0, 1fr) max-content minmax(60px, 120px);
        column-gap: 10px;
        row-gap: 6px;
        align-items: center;
        font-size: 14px;
      }
      li {
        display: contents;
      }
      .label {
        overflow-wrap: anywhere;
      }
      .share {
        font-variant-numeric: tabular-nums;
        text-align: right;
      }
      .meter {
        height: 8px;
        background: var(--rv-rule);
        border-radius: 4px;
        overflow: hidden;
      }
      .meter .fill {
        display: block;
        height: 100%;
        background: var(--rv-text);
        border-radius: 0 4px 4px 0;
      }
      .badge {
        font-size: 12px;
        white-space: nowrap;
      }
      .list p {
        margin: 6px 0 0;
      }
      @container (max-width: 640px) {
        .charts,
        .lists {
          grid-template-columns: minmax(0, 1fr);
          gap: 16px;
        }
        .days {
          max-width: 240px;
        }
        .days .bars {
          height: 48px;
        }
      }
    `,
  ];
}

function percent(share: number): string {
  const value = share * 100;
  return value > 0 && value < 1 ? "<1%" : `${String(Math.round(value))}%`;
}

function learningShort(state: { needs_days: number; needs_events: number }): string {
  const parts = [
    state.needs_days ? `${String(state.needs_days)} more ${state.needs_days === 1 ? "day" : "days"}` : "",
    state.needs_events ? `${number(state.needs_events)} more detections` : "",
  ].filter(Boolean);
  return parts.join(" and ") || "a little longer";
}

if (!customElements.get("rv-learned")) {
  customElements.define("rv-learned", RvLearned);
}

declare global {
  interface HTMLElementTagNameMap {
    "rv-learned": RvLearned;
  }
}

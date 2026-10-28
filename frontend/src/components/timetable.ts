import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from "lit";

import { fetchRecentEvents, fetchThumbnailUrls, markAllEventsSeen, markEventSeen, toError } from "../api";
import { icon, type IconName } from "../icons";
import { formatClock } from "../playback/time";
import { primaryType, sortTypes, typeLabel } from "../playback/timeline-math";
import { sharedStyles } from "../styles";
import type { HomeAssistant, RecentEvent, RecentEvents } from "../types";
import type { BoardCamera } from "./live-grid";
import { navigate } from "./navigation";

/** Rows shown before "Show all". */
export const FIRST_ROWS = 8;
/** Refreshed this often while the page is visible. */
export const REFRESH_MS = 120_000;
/** The first read accepts copies of today this old (s), then refreshes them. */
const FIRST_MAX_AGE_S = 3600;
const THUMB_BUCKET_S = 10;

/**
 * Today's events across cameras, under the live board, set as a timetable:
 * the time, what was seen, the camera (its number on the board), how long.
 * The newest is at the top, under a red line at the time now. An event this
 * Home Assistant user has not opened stays lit (its time in red) until they
 * open it or mark everything seen; a row opens the recording at the event.
 */
export class RvTimetable extends LitElement {
  static override properties = {
    hass: { attribute: false },
    cameras: { attribute: false },
    _feed: { state: true },
    _error: { state: true },
    _all: { state: true },
    _thumbs: { state: true },
    _now: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  /** The board's cameras, numbered. */
  declare cameras: BoardCamera[];
  declare _feed: RecentEvents | undefined;
  declare _error: string | undefined;
  /** Every event of today is shown, not only the first rows. */
  declare _all: boolean;
  /** Thumbnail URL by event key. */
  declare _thumbs: ReadonlyMap<string, string>;
  declare _now: number;

  private _seq = 0;
  private _refresh: ReturnType<typeof setInterval> | undefined;
  private _clock: ReturnType<typeof setTimeout> | undefined;
  private readonly _thumbsAsked = new Set<string>();
  /** The newest event before the last refresh: later ones arrive. */
  private _newestBefore: number | undefined;

  constructor() {
    super();
    this.cameras = [];
    this._all = false;
    this._thumbs = new Map();
    this._now = Date.now();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener("visibilitychange", this._onVisibility);
    this._refresh = setInterval(() => {
      if (document.visibilityState !== "hidden") void this._load(true);
    }, REFRESH_MS);
    this._tick();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener("visibilitychange", this._onVisibility);
    clearInterval(this._refresh);
    clearTimeout(this._clock);
  }

  private readonly _onVisibility = (): void => {
    if (document.visibilityState !== "hidden" && this._feed) void this._load(true);
  };

  /** The "now" line moves on at the start of each minute. */
  private _tick(): void {
    this._now = Date.now();
    clearTimeout(this._clock);
    this._clock = setTimeout(() => {
      this._tick();
    }, 60_000 - (this._now % 60_000) + 50);
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (changed.has("hass") && this.hass && !this._feed && this._seq === 0) {
      // Cached copies at once, then today searched again behind them.
      void this._load(false).then(() => this._load(true));
    }
  }

  private async _load(background: boolean): Promise<void> {
    const hass = this.hass;
    if (!hass) return;
    const seq = ++this._seq;
    try {
      const feed = await fetchRecentEvents(hass, background ? { background } : { maxAge: FIRST_MAX_AGE_S });
      if (seq !== this._seq) return;
      this._newestBefore = this._feed?.events[0]?.start;
      this._feed = feed;
      this._error = undefined;
      void this._loadThumbs();
    } catch (err) {
      if (seq === this._seq) this._error = toError(err).message;
    }
  }

  private get _shown(): RecentEvent[] {
    const events = this._feed?.events ?? [];
    return this._all ? events : events.slice(0, FIRST_ROWS);
  }

  /** Thumbnails of the rows on show, asked for once each, per camera. */
  private async _loadThumbs(): Promise<void> {
    const hass = this.hass;
    if (!hass) return;
    const byCamera = new Map<string, number[]>();
    for (const event of this._shown) {
      const key = eventKey(event);
      if (this._thumbsAsked.has(key)) continue;
      this._thumbsAsked.add(key);
      byCamera.set(event.camera_id, [...(byCamera.get(event.camera_id) ?? []), event.start]);
    }
    await Promise.all(
      [...byCamera].map(async ([camera, times]) => {
        try {
          const { urls } = await fetchThumbnailUrls(hass, camera, times, THUMB_BUCKET_S);
          const thumbs = new Map(this._thumbs);
          urls.forEach((u, i) => thumbs.set(`${camera}:${String(times[i] ?? u.time)}`, u.url));
          this._thumbs = thumbs;
        } catch {
          // No thumbnails: the rows still say everything.
        }
      }),
    );
  }

  private _open(event: RecentEvent): void {
    const hass = this.hass;
    if (hass && event.new) {
      this._markOpened(event);
      markEventSeen(hass, event.camera_id, event.start).catch(() => undefined);
    }
    navigate(this, { view: "device", id: event.camera_id, tab: "playback", at: event.start });
  }

  private _markOpened(opened: RecentEvent): void {
    const feed = this._feed;
    if (!feed) return;
    this._feed = { ...feed, events: feed.events.map((e) => (e === opened ? { ...e, new: false } : e)) };
  }

  private async _allSeen(): Promise<void> {
    const hass = this.hass;
    const feed = this._feed;
    if (!hass || !feed) return;
    this._feed = { ...feed, events: feed.events.map((e) => ({ ...e, new: false })) };
    try {
      await markAllEventsSeen(hass);
    } catch (err) {
      this._error = toError(err).message;
    }
  }

  protected override render(): TemplateResult {
    const feed = this._feed;
    const events = feed?.events ?? [];
    const zone = this.hass?.config?.time_zone;
    const cameras = new Set(events.map((e) => e.camera_id)).size;
    return html`<div class="head">
        <h2>Today</h2>
        ${feed
          ? html`<p class="count">
              ${events.length
                ? `${String(events.length)} ${events.length === 1 ? "event" : "events"} on ${String(cameras)} ${cameras === 1 ? "camera" : "cameras"}`
                : "No events yet"}
            </p>`
          : nothing}
        ${events.some((e) => e.new)
          ? html`<button class="text all-seen" @click=${() => void this._allSeen()}>Mark all seen</button>`
          : nothing}
      </div>
      ${this._error ? html`<p class="banner error" role="alert">Could not read today's events: ${this._error}</p>` : nothing}
      ${feed ? this._renderTable(feed, zone) : this._error ? nothing : html`<p class="muted">Reading today's events…</p>`}`;
  }

  private _renderTable(feed: RecentEvents, zone: string | undefined): TemplateResult {
    const events = feed.events;
    const byId = new Map(this.cameras.map((c) => [c.id, c]));
    const hidden = events.length - this._shown.length;
    return html`<div class="cols" aria-hidden="true">
        <span>Time</span><span>Event</span><span>Camera</span><span class="right">Length</span><span></span>
      </div>
      <div class="now"><b>${formatClock(this._now, zone)} now</b></div>
      ${events.length
        ? html`<ol class="rows">
            ${this._shown.map((event) => this._renderRow(event, byId.get(event.camera_id), zone))}
          </ol>`
        : html`<p class="muted empty">Nothing recorded an event since midnight.</p>`}
      ${hidden > 0
        ? html`<button
            class="text more"
            @click=${() => {
              this._all = true;
              void this.updateComplete.then(() => this._loadThumbs());
            }}
          >
            Show all ${events.length} events
          </button>`
        : nothing}
      ${feed.failed.length
        ? html`<p class="failed">${failedNote(feed.failed.map((f) => byId.get(f.camera_id)?.name ?? "A camera"))}</p>`
        : nothing}`;
  }

  private _renderRow(event: RecentEvent, camera: BoardCamera | undefined, zone: string | undefined): TemplateResult {
    const label = eventLabel(event.types);
    const time = formatClock(event.start, zone);
    const name = camera?.name ?? "Camera";
    const thumb = this._thumbs.get(eventKey(event));
    const arrived = this._newestBefore !== undefined && event.start > this._newestBefore;
    return html`<li class=${arrived ? "arrived" : ""}>
      <button
        class="row ${event.new ? "new" : ""}"
        aria-label="${label}, ${name}, ${time}${event.new ? ", new" : ""}: play the recording"
        @click=${() => {
          this._open(event);
        }}
      >
        <span class="t">${time}</span>
        <span class="ev">
          ${icon(pictogram(event.types))}<span>${label}</span>${event.new ? html`<span class="tag">New</span>` : nothing}
        </span>
        <span class="cam">${platform(camera)}<span class="name">${name}</span></span>
        <span class="len">${formatLength(event.end - event.start)}</span>
        <span class="thumb">${thumb ? html`<img src=${thumb} alt="" loading="lazy" />` : nothing}</span>
        <span class="meta">${platform(camera)}${name} · ${formatLength(event.end - event.start)}</span>
      </button>
    </li>`;
  }

  static override styles = [
    sharedStyles,
    css`
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
      .cols,
      .row {
        display: grid;
        grid-template-columns: 96px minmax(0, 1fr) minmax(0, 280px) 80px 104px;
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
    `,
  ];
}

function failedNote(names: string[]): string {
  return `${names.join(", ")}: today's recordings could not be searched, so some events may be missing.`;
}

function eventKey(event: RecentEvent): string {
  return `${event.camera_id}:${String(event.start)}`;
}

function platform(camera: BoardCamera | undefined): TemplateResult | typeof nothing {
  return camera ? html`<span class="plat" aria-hidden="true">${camera.number}</span>` : nothing;
}

/** What was seen: the specific types, motion only when nothing more is known. */
export function eventLabel(types: readonly string[]): string {
  const specific = types.filter((t) => t !== "MOTION");
  const shown = specific.length ? specific : types.length ? types : ["MOTION"];
  return sortTypes(shown).map(typeLabel).join(" · ");
}

/** The pictogram: a ring at the door first, then the most specific type. */
export function pictogram(types: readonly string[]): IconName {
  if (types.includes("DOORBELL")) return "visitor";
  switch (primaryType(types)) {
    case "PERSON":
    case "FACE":
      return "person";
    case "VEHICLE":
      return "vehicle";
    case "ANIMAL":
      return "animal";
    case "PACKAGE":
    case "FORGOTTEN_ITEM":
    case "TAKEN_ITEM":
      return "package";
    default:
      return "motion";
  }
}

/** A length as m:ss (h:mm:ss from an hour). */
export function formatLength(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h ? `${String(h)}:${String(m).padStart(2, "0")}:${s}` : `${String(m)}:${s}`;
}

if (!customElements.get("rv-timetable")) {
  customElements.define("rv-timetable", RvTimetable);
}

declare global {
  interface HTMLElementTagNameMap {
    "rv-timetable": RvTimetable;
  }
}

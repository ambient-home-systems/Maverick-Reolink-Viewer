import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from "lit";

import { fetchRecentEvents, fetchThumbnailUrls, markAllEventsSeen, markEventSeen, toError } from "../api";
import { icon, type IconName } from "../icons";
import { dateIn, formatClock } from "../playback/time";
import { primaryType, shownTypes, typeLabel } from "../playback/timeline-math";
import { sharedStyles } from "../styles";
import type { HomeAssistant, RecentEvent, RecentEvents } from "../types";
import type { BoardCamera } from "./live-grid";
import { navigate } from "./navigation";

/** Rows shown before "Show all", unless told otherwise. */
export const FIRST_ROWS = 8;
/** Today is refreshed this often while the page is visible. */
export const REFRESH_MS = 120_000;
/** The first read accepts copies of today this old (s), then refreshes them. */
const FIRST_MAX_AGE_S = 3600;
const THUMB_BUCKET_S = 10;
/** Fired with each feed read: `{ feed: RecentEvents }` (the Events view's filters). */
export const FEED_EVENT = "rv-timetable-feed";

/**
 * A day's events across cameras, set as a timetable: the time, what was
 * seen, the camera (its number on the board), how long. The newest is at the
 * top; on today, under a red line at the time now. An event this Home
 * Assistant user has not opened stays lit (its time in red) until they open
 * it or mark everything seen; a row opens the recording at the event.
 *
 * Under the live board it shows today's first rows; the Events view gives it
 * a `date`, every row and its filters.
 */
export class RvTimetable extends LitElement {
  static override properties = {
    hass: { attribute: false },
    cameras: { attribute: false },
    date: { attribute: false },
    heading: { attribute: false },
    limit: { attribute: false },
    cameraFilter: { attribute: false },
    typeFilter: { attribute: false },
    filters: { attribute: false },
    _feed: { state: true },
    _pick: { state: true },
    _error: { state: true },
    _all: { state: true },
    _thumbs: { state: true },
    _now: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  /** The board's cameras, numbered. */
  declare cameras: BoardCamera[];
  /** The day (YYYY-MM-DD); undefined: each camera's today. */
  declare date: string | undefined;
  declare heading: string;
  /** Rows shown before "Show all". */
  declare limit: number;
  /** Only these cameras' events (none: all). */
  declare cameraFilter: ReadonlySet<string>;
  /** Only events showing one of these types (`shownTypes`; none: all). */
  declare typeFilter: ReadonlySet<string>;
  /** Its own camera filter and a way to every event (the home view; the Events view has its own). */
  declare filters: boolean;
  declare _feed: RecentEvents | undefined;
  /** The cameras picked in its own filter. */
  declare _pick: ReadonlySet<string>;
  declare _error: string | undefined;
  /** Every event of the day is shown, not only the first rows. */
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
    this.heading = "Today";
    this.limit = FIRST_ROWS;
    this.cameraFilter = new Set();
    this.typeFilter = new Set();
    this.filters = false;
    this._pick = new Set();
    this._all = false;
    this._thumbs = new Map();
    this._now = Date.now();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener("visibilitychange", this._onVisibility);
    this._refresh = setInterval(() => {
      if (document.visibilityState !== "hidden" && this._isToday) void this._load(true);
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
    if (document.visibilityState !== "hidden" && this._feed && this._isToday) void this._load(true);
  };

  /** The "now" line moves on at the start of each minute. */
  private _tick(): void {
    this._now = Date.now();
    clearTimeout(this._clock);
    this._clock = setTimeout(() => {
      this._tick();
    }, 60_000 - (this._now % 60_000) + 50);
  }

  /** Showing today (which is refreshed, and has a line at the time now). */
  private get _isToday(): boolean {
    return this.date === undefined || this.date === dateIn(this._now, this.hass?.config?.time_zone);
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has("date") && changed.get("date") !== undefined) {
      // Another day: start afresh.
      this._feed = undefined;
      this._error = undefined;
      this._all = false;
      this._newestBefore = undefined;
    }
  }

  protected override updated(changed: PropertyValues<this>): void {
    const first = changed.has("hass") && this.hass && !this._feed && this._seq === 0;
    const otherDay = changed.has("date") && changed.get("date") !== undefined;
    if (first || otherDay) {
      // Cached copies at once, then today searched again behind them.
      void this._load(false).then(() => (this._isToday ? this._load(true) : undefined));
    }
    if (changed.has("cameraFilter") || changed.has("typeFilter") || changed.has("_pick")) void this._loadThumbs();
  }

  private async _load(background: boolean): Promise<void> {
    const hass = this.hass;
    if (!hass) return;
    const seq = ++this._seq;
    const date = this.date;
    try {
      const feed = await fetchRecentEvents(hass, {
        ...(date !== undefined ? { date } : {}),
        ...(background ? { background } : { maxAge: FIRST_MAX_AGE_S }),
      });
      if (seq !== this._seq || date !== this.date) return;
      this._newestBefore = background ? this._feed?.events[0]?.start : undefined;
      this._feed = feed;
      this._error = undefined;
      this.dispatchEvent(new CustomEvent(FEED_EVENT, { detail: { feed } }));
      void this._loadThumbs();
    } catch (err) {
      if (seq === this._seq) this._error = toError(err).message;
    }
  }

  /** The day's events that pass the filters. */
  private get _matching(): RecentEvent[] {
    const cameras = this.cameraFilter.size ? this.cameraFilter : this._pick;
    const types = this.typeFilter;
    return (this._feed?.events ?? []).filter(
      (e) => (!cameras.size || cameras.has(e.camera_id)) && (!types.size || shownTypes(e.types).some((t) => types.has(t))),
    );
  }

  private get _shown(): RecentEvent[] {
    const events = this._matching;
    return this._all ? events : events.slice(0, this.limit);
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
    const events = this._matching;
    const zone = this.hass?.config?.time_zone;
    const cameras = new Set(events.map((e) => e.camera_id)).size;
    const filtered = this.cameraFilter.size > 0 || this.typeFilter.size > 0 || this._pick.size > 0;
    const day = this._isToday ? "today's" : "this day's";
    return html`<div class="head">
        ${this.heading ? html`<h2>${this.heading}</h2>` : nothing}
        ${feed
          ? html`<p class="count">
              ${events.length
                ? `${String(events.length)} ${events.length === 1 ? "event" : "events"} on ${String(cameras)} ${cameras === 1 ? "camera" : "cameras"}`
                : filtered
                  ? "None match"
                  : this._isToday
                    ? "No events yet"
                    : "No events"}
            </p>`
          : nothing}
        ${(feed?.events ?? []).some((e) => e.new)
          ? html`<button class="text all-seen" @click=${() => void this._allSeen()}>Mark all seen</button>`
          : nothing}
        ${this.filters
          ? html`<button class="text with-icon all-events" @click=${() => {
              navigate(this, { view: "events" });
            }}>All events${icon("chevron")}</button>`
          : nothing}
      </div>
      ${this.filters && feed ? this._renderPick(feed) : nothing}
      ${this._error ? html`<p class="banner error" role="alert">Could not read ${day} events: ${this._error}</p>` : nothing}
      ${feed ? this._renderTable(feed, zone) : this._error ? nothing : html`<p class="muted">Reading ${day} events…</p>`}`;
  }

  /** The day's cameras, by their number on the board, to show only some. */
  private _renderPick(feed: RecentEvents): TemplateResult | typeof nothing {
    const present = new Set(feed.events.map((e) => e.camera_id));
    const cameras = this.cameras.filter((c) => present.has(c.id) || this._pick.has(c.id));
    if (cameras.length < 2) return nothing;
    return html`<div class="pick" role="group" aria-label="Cameras">
      ${cameras.map(
        (c) => html`<button
          class="chip"
          aria-pressed=${this._pick.has(c.id) ? "true" : "false"}
          @click=${() => {
            const pick = new Set(this._pick);
            if (!pick.delete(c.id)) pick.add(c.id);
            this._pick = pick;
          }}
        >
          <span class="plat" aria-hidden="true">${c.number}</span>${c.name}
        </button>`,
      )}
    </div>`;
  }

  private _renderTable(feed: RecentEvents, zone: string | undefined): TemplateResult {
    const events = this._matching;
    const byId = new Map(this.cameras.map((c) => [c.id, c]));
    const hidden = events.length - this._shown.length;
    const today = this._isToday;
    const empty = feed.events.length
      ? "No events match these filters."
      : today
        ? "Nothing recorded an event since midnight."
        : "Nothing recorded an event on this day.";
    return html`<div class="cols" aria-hidden="true">
        <span>Time</span><span>Event</span><span>Camera</span><span class="right">Length</span><span></span>
      </div>
      ${today ? html`<div class="now"><b>${formatClock(this._now, zone)} now</b></div>` : nothing}
      ${events.length
        ? html`<ol class="rows">
            ${this._shown.map((event) => this._renderRow(event, byId.get(event.camera_id), zone))}
          </ol>`
        : html`<p class="muted empty">${empty}</p>`}
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
        ? html`<p class="failed">
            ${failedNote(
              feed.failed.map((f) => byId.get(f.camera_id)?.name ?? "A camera"),
              today,
            )}
          </p>`
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

function failedNote(names: string[], today: boolean): string {
  return `${names.join(", ")}: ${today ? "today's" : "this day's"} recordings could not be searched, so some events may be missing.`;
}

function eventKey(event: RecentEvent): string {
  return `${event.camera_id}:${String(event.start)}`;
}

function platform(camera: BoardCamera | undefined): TemplateResult | typeof nothing {
  return camera ? html`<span class="plat" aria-hidden="true">${camera.number}</span>` : nothing;
}

export function eventLabel(types: readonly string[]): string {
  return shownTypes(types).map(typeLabel).join(" · ");
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

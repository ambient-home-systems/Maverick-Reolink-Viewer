import { LitElement, css, html, nothing, type TemplateResult } from "lit";

import { fetchLatestEvents, fetchThumbnailUrls, fetchUnusualMarks, markEventSeen } from "../api";
import { icon } from "../icons";
import { dateIn, formatClock, formatStamp } from "../playback/time";
import { sharedStyles } from "../styles";
import type { HomeAssistant, LiveCamera, LiveImage, RecentEvent, RecentEvents } from "../types";
import { markRows, rowKey } from "../unusual";
import { navigate } from "./navigation";
import { eventLabel, pictogram } from "./timetable";

/** The strip asks for each camera's newest event this often, as the timetable does. */
export const STRIP_REFRESH_MS = 120_000;
/** After a detection ends, asked at once and again this much later (the camera lists it once it ends). */
export const STRIP_AGAIN_MS = 20_000;
/** A first look may take a copy of today this old (then it is asked again). */
const FIRST_MAX_AGE_S = 120;
const THUMB_BUCKET_S = 10;
/** The marks are asked for at most this far back (unusual/marks reads 7 days at most). */
const MARKS_SPAN_MS = 7 * 86_400_000 - 60_000;
/** Fired (bubbling) by a card of a detection going on: the Wall shows that camera large. */
export const STRIP_LIVE_EVENT = "rv-strip-live";

/** A detection going on now, from a camera's sensors: its types, since when (epoch ms). */
export interface DetectingNow {
  types: string[];
  since: number;
}

interface Card {
  camera: LiveCamera;
  /** A detection going on now (before the camera lists it). */
  now?: DetectingNow;
  /** The camera's newest event (events/latest). */
  event?: RecentEvent;
}

/**
 * The Wall's strip (Phase 9 step 4): along the bottom, one card per camera
 * with its newest detection: its picture, pictogram and type, camera and
 * time, "New" in red until opened, and "Unusual" when Phase 8 marked it. A
 * tap opens the recording. A detection going on now (the camera's sensors,
 * at once) comes first as "Now" with the camera's last picture; a tap shows
 * the camera large. Asked for every 2 minutes, and when a detection ends.
 */
export class RvWallStrip extends LitElement {
  static override properties = {
    hass: { attribute: false },
    cameras: { attribute: false },
    numbers: { attribute: false },
    now: { attribute: false },
    pictures: { attribute: false },
    _feed: { state: true },
    _thumbs: { state: true },
    _marked: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  /** Every camera, in the board's order. */
  declare cameras: readonly LiveCamera[];
  /** Each camera's number on the board. */
  declare numbers: ReadonlyMap<string, number>;
  /** The detections going on now, by camera id. */
  declare now: ReadonlyMap<string, DetectingNow>;
  /** Each camera's last picture (for a detection going on). */
  declare pictures: Readonly<Partial<Record<string, LiveImage>>>;
  declare _feed: RecentEvents | undefined;
  declare _thumbs: ReadonlyMap<string, string>;
  /** The newest events that Phase 8 marked unusual, by rowKey. */
  declare _marked: ReadonlySet<string>;

  private _timer: ReturnType<typeof setInterval> | undefined;
  private _again: ReturnType<typeof setTimeout> | undefined;
  private _asked = new Set<string>();
  private _seq = 0;
  private _started = false;

  constructor() {
    super();
    this.cameras = [];
    this.numbers = new Map();
    this.now = new Map();
    this.pictures = {};
    this._thumbs = new Map();
    this._marked = new Set();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this._timer = setInterval(() => {
      void this._load(true);
    }, STRIP_REFRESH_MS);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    clearInterval(this._timer);
    clearTimeout(this._again);
    this._started = false;
  }

  protected override updated(): void {
    if (this.hass && !this._started) {
      this._started = true;
      void this._load(false);
    }
  }

  /** A detection ended: ask now, and again once the camera has listed it. */
  refreshSoon(): void {
    void this._load(true);
    clearTimeout(this._again);
    this._again = setTimeout(() => {
      void this._load(true);
    }, STRIP_AGAIN_MS);
  }

  private async _load(background: boolean): Promise<void> {
    const hass = this.hass;
    if (!hass) return;
    const seq = ++this._seq;
    try {
      const feed = await fetchLatestEvents(hass, background ? { background } : { maxAge: FIRST_MAX_AGE_S });
      if (seq !== this._seq) return;
      this._feed = feed;
      void this._loadThumbs(hass, feed.events);
      void this._loadMarks(hass, feed, seq);
    } catch {
      // Nothing new: the cards on show stay (the sensors still light them).
    }
  }

  private async _loadThumbs(hass: HomeAssistant, events: readonly RecentEvent[]): Promise<void> {
    const wanted = events.filter((e) => !this._asked.has(rowKey(e)));
    for (const event of wanted) this._asked.add(rowKey(event));
    await Promise.all(
      wanted.map(async (event) => {
        try {
          const { urls } = await fetchThumbnailUrls(hass, event.camera_id, [event.start], THUMB_BUCKET_S);
          const url = urls[0]?.url;
          if (url) this._thumbs = new Map(this._thumbs).set(rowKey(event), url);
        } catch {
          // No picture: the card still says what and when.
        }
      }),
    );
  }

  /** Which newest events were marked unusual; none if the marks cannot be read. */
  private async _loadMarks(hass: HomeAssistant, feed: RecentEvents, seq: number): Promise<void> {
    if (!feed.events.length) return;
    const to = feed.now;
    const from = Math.max(Math.min(...feed.events.map((e) => e.start)), to - MARKS_SPAN_MS);
    try {
      const { marks } = await fetchUnusualMarks(hass, from, to);
      if (seq !== this._seq) return;
      this._marked = new Set(markRows(feed.events, marks, from, to).marks.keys());
    } catch {
      // Learning what is normal is off, or not built: no marks.
    }
  }

  /** The cards: detections going on first, then each camera's newest event, newest first. */
  private get _cards(): Card[] {
    const latest = new Map((this._feed?.events ?? []).map((e) => [e.camera_id, e]));
    const cards: Card[] = [];
    for (const camera of this.cameras) {
      const now = this.now.get(camera.id);
      const event = latest.get(camera.id);
      if (now || event) cards.push({ camera, ...(now ? { now } : {}), ...(event ? { event } : {}) });
    }
    const when = (card: Card) => card.now?.since ?? card.event?.start ?? 0;
    return cards.sort((a, b) => Number(Boolean(b.now)) - Number(Boolean(a.now)) || when(b) - when(a));
  }

  private _open(card: Card): void {
    if (card.now) {
      this.dispatchEvent(
        new CustomEvent(STRIP_LIVE_EVENT, { detail: { cameraId: card.camera.id }, bubbles: true, composed: true }),
      );
      return;
    }
    const event = card.event;
    const hass = this.hass;
    if (!event) return;
    if (hass && event.new) {
      markEventSeen(hass, event.camera_id, event.start).catch(() => undefined);
      const feed = this._feed;
      if (feed) {
        this._feed = { ...feed, events: feed.events.map((e) => (e === event ? { ...e, new: false } : e)) };
      }
    }
    navigate(this, { view: "device", id: event.camera_id, tab: "playback", at: event.start });
  }

  protected override render(): TemplateResult {
    const cards = this._cards;
    const zone = this.hass?.config?.time_zone;
    const today = this._feed ? dateIn(this._feed.now, zone) : undefined;
    return html`<ul class="strip" aria-label="Latest detections">
      ${cards.length
        ? cards.map((card) => this._renderCard(card, zone, today))
        : html`<li class="none">${this._feed ? "No detections yet" : "Loading the latest detections…"}</li>`}
    </ul>`;
  }

  private _renderCard(card: Card, zone: string | undefined, today: string | undefined): TemplateResult {
    const { camera, now, event } = card;
    const types = now ? now.types : (event?.types ?? []);
    const at = now ? now.since : (event?.start ?? 0);
    const label = eventLabel(types);
    // Going on now, or today: the time; another day: the date too.
    const time = now || today === undefined || dateIn(at, zone) === today ? formatClock(at, zone) : formatStamp(at, zone);
    const picture = now ? this.pictures[camera.id]?.url : event ? this._thumbs.get(rowKey(event)) : undefined;
    const unusual = !now && event !== undefined && this._marked.has(rowKey(event));
    const tag = now ? "Now" : event?.new ? "New" : undefined;
    const number = this.numbers.get(camera.id);
    // Its visible text is its name (a voice says what it sees); the hint is the title.
    return html`<li>
      <button
        class="card ${now ? "now" : ""}"
        title=${now ? "Show it large" : "Open the recording"}
        @click=${() => {
          this._open(card);
        }}
      >
        <span class="thumb">${picture ? html`<img src=${picture} alt="" loading="lazy" />` : nothing}</span>
        <span class="text">
          <span class="what">
            ${icon(pictogram(types))} <span class="label">${label}</span>
            ${tag ? html`<span class="tag">${tag}</span>` : nothing}
            ${unusual ? html`<span class="badge unusual">Unusual</span>` : nothing}
          </span>
          <span class="where">
            ${number !== undefined ? html`<span class="num" aria-hidden="true">${number}</span>` : nothing}
            <span class="name">${camera.name}</span> <span class="time">${time}</span>
          </span>
        </span>
      </button>
    </li>`;
  }

  static override styles = [
    sharedStyles,
    css`
      :host {
        display: block;
        flex: none;
        color: var(--rv-on-board);
      }
      .strip {
        display: flex;
        gap: 6px;
        margin: 0;
        padding: 0 6px 6px;
        list-style: none;
        overflow-x: auto;
        scrollbar-width: thin;
      }
      .strip > li {
        flex: none;
      }
      .none {
        padding: 6px 6px 2px;
        color: var(--rv-on-board-muted);
        font-size: 14px;
      }
      .card {
        display: flex;
        align-items: stretch;
        gap: 8px;
        width: 264px;
        height: 64px;
        min-height: 0;
        padding: 0 8px 0 0;
        border: 1px solid color-mix(in srgb, var(--rv-on-board) 18%, transparent);
        border-radius: 0;
        background: color-mix(in srgb, var(--rv-on-board) 6%, transparent);
        color: var(--rv-on-board);
        text-align: left;
        cursor: pointer;
      }
      .card:hover {
        background: color-mix(in srgb, var(--rv-on-board) 12%, transparent);
      }
      .card:focus-visible {
        outline: 2px solid var(--rv-on-board);
        outline-offset: 2px;
      }
      .card.now {
        border-color: var(--rv-on-board-red);
      }
      .thumb {
        flex: none;
        width: 112px;
        background: #000;
      }
      .thumb img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .text {
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 2px;
        min-width: 0;
      }
      .what {
        display: flex;
        align-items: center;
        gap: 5px;
        min-width: 0;
        font-size: 15px;
        font-weight: 600;
      }
      .what svg {
        flex: none;
        width: 18px;
        height: 18px;
      }
      .label {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .tag {
        flex: none;
        color: var(--rv-on-board-red);
        font-size: 13px;
      }
      .badge.unusual {
        flex: none;
        border-color: var(--rv-on-board-muted);
        color: var(--rv-on-board);
        font-size: 12px;
        line-height: 18px;
        padding: 0 5px;
      }
      .where {
        display: flex;
        align-items: baseline;
        gap: 6px;
        min-width: 0;
        color: var(--rv-on-board-muted);
        font-size: 13px;
      }
      .num {
        flex: none;
        font-family: var(--rv-font-cond);
        font-weight: 600;
      }
      .name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .time {
        flex: none;
        margin-left: auto;
        font-variant-numeric: tabular-nums;
      }
    `,
  ];
}

if (!customElements.get("rv-wall-strip")) {
  customElements.define("rv-wall-strip", RvWallStrip);
}

declare global {
  interface HTMLElementTagNameMap {
    "rv-wall-strip": RvWallStrip;
  }
}

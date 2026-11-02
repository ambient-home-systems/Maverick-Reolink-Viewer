import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from "lit";

import { fetchThumbnailUrls, fetchTimelineDay, toError } from "../api";
import { icon } from "../icons";
import { dateIn, formatClock } from "../playback/time";
import { sharedStyles } from "../styles";
import type { HomeAssistant, TimelineDay, TimelineEvent } from "../types";
import { eventLabel, formatLength } from "./timetable";

/** One picture every this long through an event. */
export const PICTURE_STEP_MS = 5_000;
/** At most this many pictures of one event. */
export const MAX_PICTURES = 15;
/** The thumbnail bucket the pictures are asked in (s): one per step. */
const PICTURE_BUCKET_S = 5;
/** Playing the pictures shows each this long. */
export const PLAY_STEP_MS = 1_000;

/** The times to show an event at: its start, then every step to its end, at most MAX_PICTURES. */
export function pictureTimes(event: Pick<TimelineEvent, "start" | "end">): number[] {
  const steps = Math.floor(Math.max(0, event.end - event.start) / PICTURE_STEP_MS) + 1;
  return Array.from({ length: Math.min(MAX_PICTURES, steps) }, (_, i) => event.start + i * PICTURE_STEP_MS);
}

/**
 * The event to open for a time: the one it falls in, else the last that began
 * before it, else the first of the day; with no time, the newest.
 */
export function eventAt(events: readonly TimelineEvent[], at: number | undefined): TimelineEvent | undefined {
  if (!events.length) return undefined;
  if (at === undefined) return events.reduce((a, b) => (b.start > a.start ? b : a));
  const within = events.find((e) => e.start <= at && at <= e.end);
  if (within) return within;
  const before = events.filter((e) => e.start <= at);
  return before.length ? before.reduce((a, b) => (b.start > a.start ? b : a)) : events[0];
}

type PictureState = "loading" | "shown" | "missing";

/**
 * The Playback tab of a camera whose recordings are kept where Reolink Viewer
 * cannot play them (Phase 6: the battery Doorbell's SD card): the day's
 * events, from its event search, and pictures of the one opened (the camera's
 * past pictures, every 5 s through it) in place of the video.
 */
export class RvEventPictures extends LitElement {
  static override properties = {
    hass: { attribute: false },
    deviceId: { attribute: false },
    cameraName: { attribute: false },
    at: { attribute: false },
    _date: { state: true },
    _day: { state: true },
    _error: { state: true },
    _selected: { state: true },
    _urls: { state: true },
    _index: { state: true },
    _picture: { state: true },
    _playing: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  declare deviceId: string;
  declare cameraName: string;
  /** A time to open (an event opened from the timetable). */
  declare at: number | undefined;
  /** The day shown (camera-local, as the timeline's). */
  declare _date: string | undefined;
  declare _day: TimelineDay | undefined;
  declare _error: string | undefined;
  /** The event open: its start. */
  declare _selected: number | undefined;
  /** Its pictures' signed URLs, in order. */
  declare _urls: string[];
  declare _index: number;
  declare _picture: PictureState;
  declare _playing: boolean;

  private _loadSeq = 0;
  private _picturesSeq = 0;
  private _timer: ReturnType<typeof setInterval> | undefined;

  constructor() {
    super();
    this.deviceId = "";
    this.cameraName = "";
    this._urls = [];
    this._index = 0;
    this._picture = "loading";
    this._playing = false;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._stop();
  }

  private get _zone(): string | undefined {
    return this.hass?.config?.time_zone;
  }

  private get _today(): string {
    return dateIn(Date.now(), this._zone);
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (!this.hass || !this.deviceId) return;
    // The day of the time opened (else today): once hass is there, and again
    // when another event or camera is opened.
    if (changed.has("at") || changed.has("deviceId") || this._date === undefined) {
      const date = dateIn(this.at ?? Date.now(), this._zone);
      this._date = date;
      void this._load(date, this.at);
    }
  }

  private async _load(date: string, at: number | undefined): Promise<void> {
    const hass = this.hass;
    if (!hass) return;
    const seq = ++this._loadSeq;
    this._stop();
    this._day = undefined;
    this._error = undefined;
    this._selected = undefined;
    this._urls = [];
    try {
      const day = await fetchTimelineDay(hass, this.deviceId, date);
      if (seq !== this._loadSeq) return;
      this._day = day;
      const open = eventAt(day.events, at);
      if (open) void this._open(open);
    } catch (err) {
      if (seq === this._loadSeq) this._error = toError(err).message;
    }
  }

  private async _open(event: TimelineEvent): Promise<void> {
    const hass = this.hass;
    if (!hass) return;
    const seq = ++this._picturesSeq;
    this._stop();
    this._selected = event.start;
    this._urls = [];
    this._index = 0;
    this._picture = "loading";
    try {
      const { urls } = await fetchThumbnailUrls(hass, this.deviceId, pictureTimes(event), PICTURE_BUCKET_S);
      if (seq !== this._picturesSeq) return;
      this._urls = urls.map((u) => u.url);
      this._preload(1);
    } catch {
      if (seq === this._picturesSeq) this._picture = "missing";
    }
  }

  /** Ask for the picture after the one shown, so stepping on is quick. */
  private _preload(index: number): void {
    const url = this._urls[index];
    if (url && typeof Image !== "undefined") new Image().src = url;
  }

  private _show(index: number): void {
    if (index < 0 || index >= this._urls.length || index === this._index) return;
    this._index = index;
    this._picture = "loading";
    this._preload(index + 1);
  }

  private _togglePlay(): void {
    if (this._playing) {
      this._stop();
      return;
    }
    if (this._index >= this._urls.length - 1) this._show(0);
    this._playing = true;
    this._timer = setInterval(() => {
      if (this._index >= this._urls.length - 1) {
        this._stop();
        return;
      }
      this._show(this._index + 1);
    }, PLAY_STEP_MS);
  }

  private _stop(): void {
    clearInterval(this._timer);
    this._timer = undefined;
    this._playing = false;
  }

  private _shift(delta: number): void {
    const [y, m, d] = (this._date ?? this._today).split("-").map(Number);
    if (!y || !m || !d) return;
    const date = new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
    if (date > this._today) return;
    this._date = date;
    void this._load(date, undefined);
  }

  protected override render(): TemplateResult {
    const name = this.cameraName || "This camera";
    const today = (this._date ?? this._today) === this._today;
    return html`<div class="note">
        <h2>Pictures of its events</h2>
        <p>
          ${name} keeps its recordings where Reolink Viewer cannot play them yet. Here are its events, with
          pictures from each; play the recordings in the Reolink app.
        </p>
      </div>
      <div class="day-nav" role="group" aria-label="Day">
        <button class="step" aria-label="The day before" @click=${() => {
          this._shift(-1);
        }}>${icon("chevronBack")}</button>
        <span class="day">${today ? "Today" : pictureDay(this._date ?? this._today)}</span>
        <button class="step" aria-label="The day after" ?disabled=${today} @click=${() => {
          this._shift(1);
        }}>${icon("chevron")}</button>
      </div>
      ${this._renderBody()}`;
  }

  private _renderBody(): TemplateResult {
    if (this._error) {
      return html`<p class="muted" role="alert">
        Could not load this day's events: ${this._error}.
        <button class="text" @click=${() => {
          if (this._date) void this._load(this._date, this.at);
        }}>Try again</button>
      </p>`;
    }
    const day = this._day;
    if (!day) return html`<p class="muted" aria-live="polite">Looking for events…</p>`;
    if (!day.events.length) return html`<p class="muted">No events on this day.</p>`;
    const newest = [...day.events].sort((a, b) => b.start - a.start);
    const open = day.events.find((e) => e.start === this._selected);
    return html`<div class="layout">
      ${open ? this._renderViewer(open) : nothing}
      <ol class="events" aria-label="The day's events">
        ${newest.map(
          (event) => html`<li>
            <button aria-pressed=${event.start === this._selected ? "true" : "false"} @click=${() => {
              void this._open(event);
            }}>
              <span class="time">${formatClock(event.start, this._zone, true)}</span>
              <span class="what">${eventLabel(event.types)}</span>
              <span class="muted">${formatLength(event.end - event.start)}</span>
            </button>
          </li>`,
        )}
      </ol>
    </div>`;
  }

  private _renderViewer(event: TimelineEvent): TemplateResult {
    const count = this._urls.length;
    const url = this._urls[this._index];
    const at = event.start + this._index * PICTURE_STEP_MS;
    const what = eventLabel(event.types);
    return html`<figure class="viewer">
      <div class="frame">
        ${url
          ? html`<img
              src=${url}
              alt=${`${what} at ${formatClock(at, this._zone, true)}`}
              class=${this._picture === "shown" ? "" : "hidden"}
              @load=${() => {
                this._picture = "shown";
              }}
              @error=${() => {
                this._picture = "missing";
              }}
            />`
          : nothing}
        ${this._picture === "loading"
          ? html`<span class="wait" aria-live="polite">Asking the camera for the picture…</span>`
          : this._picture === "missing"
            ? html`<span class="wait">No picture of this moment.</span>`
            : nothing}
      </div>
      <figcaption>
        <strong>${formatClock(event.start, this._zone, true)}</strong> · ${what} ·
        ${formatLength(event.end - event.start)}
      </figcaption>
      <div class="controls" role="group" aria-label="Pictures">
        <button class="step" aria-label="The picture before" ?disabled=${this._index <= 0} @click=${() => {
          this._stop();
          this._show(this._index - 1);
        }}>${icon("previous")}</button>
        <button class="step" aria-label=${this._playing ? "Pause" : "Play the pictures"} ?disabled=${count < 2} @click=${() => {
          this._togglePlay();
        }}>${icon(this._playing ? "pause" : "play")}</button>
        <button class="step" aria-label="The picture after" ?disabled=${this._index >= count - 1} @click=${() => {
          this._stop();
          this._show(this._index + 1);
        }}>${icon("next")}</button>
        <span class="count" aria-live="polite">${count ? `Picture ${String(this._index + 1)} of ${String(count)}` : ""}</span>
      </div>
    </figure>`;
  }

  static override styles = [
    sharedStyles,
    css`
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
    `,
  ];
}

const DAY_LABEL = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** "Sun 1 Nov" for a camera-local date ("2026-11-01"). */
export function pictureDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return y && m && d ? DAY_LABEL.format(new Date(Date.UTC(y, m - 1, d))) : date;
}

if (!customElements.get("rv-event-pictures")) {
  customElements.define("rv-event-pictures", RvEventPictures);
}

declare global {
  interface HTMLElementTagNameMap {
    "rv-event-pictures": RvEventPictures;
  }
}

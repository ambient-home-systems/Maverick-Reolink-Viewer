// What a dashboard card's page sees on a wall tablet (Phase 7 step 2): the
// page hidden and shown, Fully Kiosk's screen and screensaver, each card's
// video starting, playing and stopping, and how many frames it decoded. Sent
// to Home Assistant every minute (live/card_log/add), so the panel's
// "Dashboard cards" report can show a tablet's night on any device.
//
// Where Fully Kiosk's JavaScript interface is on, its screen and screensaver
// events also put the cards to sleep (no stream while nobody can see it, so
// the tablet stays cool), and a doorbell ring can wake the screen.
import { deviceLabel } from "../live/soak-tally";
import type { HomeAssistant, TabletEvent } from "../types";

/** Fully Kiosk's JavaScript interface (Settings → Advanced Web Settings), as far as the cards use it. */
interface Fully {
  bind?(event: string, code: string): void;
  turnScreenOn?(): void;
  stopScreensaver?(): void;
}

declare global {
  interface Window {
    fully?: Fully;
    __reolinkViewerFully?: (event: string) => void;
  }
}

/** A card the log counts frames for. */
export interface Watched {
  name(): string;
  video(): HTMLVideoElement | null;
  /** What it is doing, in a word or two ("playing", "stopped"). */
  state(): string;
}

export const FLUSH_MS = 60_000;
export const FRAMES_MS = 5 * 60_000;
const MAX_PENDING = 300;
/** Fully Kiosk's events, and what the log calls them. */
const FULLY_EVENTS: Record<string, string> = {
  screenOff: "screen off",
  screenOn: "screen on",
  onScreensaverStart: "screensaver on",
  onScreensaverStop: "screensaver off",
};

export class TabletLog {
  private _pending: TabletEvent[] = [];
  private _hass: () => HomeAssistant | undefined = () => undefined;
  private _started = false;
  private _sending = false;
  private _screenOff = false;
  private _screensaver = false;
  private _fullyBound = false;
  private readonly _sleepers = new Set<() => void>();
  private readonly _watched = new Set<Watched>();
  private readonly _frames = new Map<Watched, number>();
  private readonly _lastFrames = new Map<Watched, number>();

  constructor(
    private readonly _win: Window = window,
    private readonly _now: () => number = () => Date.now(),
  ) {}

  /** Fully Kiosk's screen is off or its screensaver on: nobody sees the cards. */
  get asleep(): boolean {
    return this._screenOff || this._screensaver;
  }

  get fully(): Fully | undefined {
    return this._win.fully;
  }

  /** What the report calls this device: "Android · Fully Kiosk", "iPhone · Home Assistant app". */
  get device(): string {
    const label = deviceLabel(this._win.navigator.userAgent);
    return this.fully ? `${label.split(" · ")[0] ?? "Android"} · Fully Kiosk` : label;
  }

  /** Start once per page, from the first card shown. */
  start(hass: () => HomeAssistant | undefined): void {
    this._hass = hass;
    if (this._started) return;
    this._started = true;
    const doc = this._win.document;
    this.note(
      "page loaded",
      undefined,
      `${doc.visibilityState}; Fully Kiosk's JavaScript interface ${this.fully ? "on" : "off"}`,
    );
    doc.addEventListener("visibilitychange", () => {
      const hidden = doc.visibilityState === "hidden";
      this._page(hidden ? "hidden" : "visible");
      if (hidden) void this.flush();
    });
    this._win.addEventListener("pagehide", (e) => {
      this._page("page hide", e.persisted ? "kept" : undefined);
      void this.flush();
    });
    this._win.addEventListener("pageshow", (e) => {
      if (e.persisted) this._page("page show", "from the cache");
    });
    doc.addEventListener("freeze", () => {
      this._page("frozen");
    });
    doc.addEventListener("resume", () => {
      this._page("resumed");
    });
    this._win.addEventListener("online", () => {
      this._page("online");
    });
    this._win.addEventListener("offline", () => {
      this._page("offline");
    });
    this._bindFully();
    setInterval(() => void this.flush(), FLUSH_MS);
    setInterval(() => {
      this._countFrames();
    }, FRAMES_MS);
  }

  /** A card on the page: its frames are counted, and the page's events noted, while it is. */
  watch(card: Watched): () => void {
    this._watched.add(card);
    return () => {
      this._watched.delete(card);
      this._frames.delete(card);
      this._lastFrames.delete(card);
    };
  }

  /**
   * Fully Kiosk's screen and screensaver, without the log (the Wall, Phase 9
   * step 5: its tiles sleep too). Once per page, as start() binds them.
   */
  listenToFully(): void {
    this._bindFully();
  }

  /** Called when the cards should sleep or wake (Fully Kiosk's screen). */
  onSleep(callback: () => void): () => void {
    this._sleepers.add(callback);
    return () => this._sleepers.delete(callback);
  }

  /** Wake Fully Kiosk's screen (a doorbell ring); false where there is no Fully. */
  wake(): boolean {
    const fully = this.fully;
    if (!fully) return false;
    try {
      fully.stopScreensaver?.();
      fully.turnScreenOn?.();
    } catch {
      // An older Fully without them: the screen stays as it is.
    }
    return true;
  }

  note(what: string, card?: string, detail?: string): void {
    this._pending.push({
      at: this._now(),
      what: what.slice(0, 40),
      ...(card ? { card: card.slice(0, 80) } : {}),
      ...(detail ? { detail: detail.slice(0, 200) } : {}),
    });
    if (this._pending.length > MAX_PENDING) this._pending.splice(0, this._pending.length - MAX_PENDING);
  }

  /** Send what is noted; kept for the next try if Home Assistant cannot take it. */
  async flush(): Promise<void> {
    const hass = this._hass();
    if (!hass || !this._pending.length || this._sending) return;
    const events = this._pending.splice(0);
    this._sending = true;
    try {
      await hass.callWS({ type: "reolink_viewer/live/card_log/add", device: this.device, events });
    } catch {
      this._pending.unshift(...events);
      if (this._pending.length > MAX_PENDING) this._pending.splice(0, this._pending.length - MAX_PENDING);
    } finally {
      this._sending = false;
    }
  }

  /** A page event, noted while a card is on the page. */
  private _page(what: string, detail?: string): void {
    if (this._watched.size) this.note(what, undefined, detail);
  }

  private _bindFully(): void {
    const fully = this.fully;
    if (!fully?.bind || this._fullyBound) return;
    this._fullyBound = true;
    this._win.__reolinkViewerFully = (event) => {
      this._fullyEvent(event);
    };
    for (const event of Object.keys(FULLY_EVENTS)) {
      try {
        fully.bind(event, `window.__reolinkViewerFully && window.__reolinkViewerFully(${JSON.stringify(event)})`);
      } catch {
        // An event this Fully does not have.
      }
    }
  }

  private _fullyEvent(event: string): void {
    this.note(FULLY_EVENTS[event] ?? event, undefined, "Fully Kiosk");
    const asleep = this.asleep;
    if (event === "screenOff") this._screenOff = true;
    if (event === "screenOn") this._screenOff = false;
    if (event === "onScreensaverStart") this._screensaver = true;
    if (event === "onScreensaverStop") this._screensaver = false;
    if (asleep !== this.asleep) for (const callback of [...this._sleepers]) callback();
  }

  /**
   * Each card's frames since the last count, while it decodes any: whether
   * video plays where nobody can see it (a hidden page, a screen off). Noted
   * as "<n> frames; visible|hidden[; asleep]; <state>".
   */
  private _countFrames(): void {
    const visibility = this._win.document.visibilityState === "hidden" ? "hidden" : "visible";
    for (const card of this._watched) {
      // Not every browser counts frames.
      const video: Partial<HTMLVideoElement> | null = card.video();
      const total = video?.getVideoPlaybackQuality?.().totalVideoFrames;
      if (total === undefined) continue;
      const before = this._frames.get(card);
      this._frames.set(card, total);
      if (before === undefined) continue;
      // A new stream counts from 0 again.
      const frames = total >= before ? total - before : total;
      const last = this._lastFrames.get(card) ?? 0;
      this._lastFrames.set(card, frames);
      if (frames === 0 && last === 0) continue;
      this.note(
        "frames",
        card.name(),
        `${String(frames)} frames; ${visibility}${this.asleep ? "; asleep" : ""}; ${card.state()}`,
      );
    }
  }
}

/** The page's log, shared by its cards. */
export const tablet = new TabletLog();

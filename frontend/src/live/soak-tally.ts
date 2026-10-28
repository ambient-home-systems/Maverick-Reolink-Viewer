// What the grid counted for the soak run, until it is sent: every
// SOAK_REPORT_MS while the grid is open, when the page hides and when the
// grid closes. It lives as long as the page, not the grid: Home Assistant
// unloads a panel whose page was hidden for 5 minutes and attaches it again
// when the page shows. The server keeps the run, so a reload carries on too.
import { sendSoakCounts, type SoakDelta } from "../api";
import type { HomeAssistant, SoakCounts } from "../types";

/** How often an open grid reports what it counted. */
export const SOAK_REPORT_MS = 60_000;

export type CountKind = keyof SoakCounts;

export class SoakTally {
  private _opens = 0;
  private _openMs = 0;
  private _visibleMs = 0;
  private _tiles = new Map<string, SoakCounts>();
  /** Since when the grid has been open (undefined while closed). */
  private _openSince: number | undefined;
  /** Since when it has been open and visible. */
  private _visibleSince: number | undefined;
  private _timer: ReturnType<typeof setInterval> | undefined;
  private _sending: Promise<void> = Promise.resolve();

  constructor(
    private readonly _device: () => string = () => deviceLabel(navigator.userAgent),
    private readonly _now: () => number = () => Date.now(),
  ) {}

  /** Whether the grid is open on this page. */
  get open(): boolean {
    return this._openSince !== undefined;
  }

  /** The grid opened: count it, and report every SOAK_REPORT_MS while it is open. */
  opened(hass: () => HomeAssistant | undefined, visible: boolean): void {
    const now = this._now();
    this._opens += 1;
    this._openSince = now;
    this._visibleSince = visible ? now : undefined;
    clearInterval(this._timer);
    this._timer = setInterval(() => {
      const current = hass();
      if (current) void this.flush(current);
    }, SOAK_REPORT_MS);
  }

  /** The grid closed. */
  closed(): void {
    this._accrue();
    this._openSince = undefined;
    this._visibleSince = undefined;
    clearInterval(this._timer);
    this._timer = undefined;
  }

  /** The page was shown or hidden. */
  visibility(visible: boolean): void {
    if (!this.open) return;
    this._accrue();
    this._visibleSince = visible ? this._now() : undefined;
  }

  count(camera: string, kind: CountKind): void {
    let counts = this._tiles.get(camera);
    if (!counts) {
      counts = { plays: 0, drops: 0, failures: 0 };
      this._tiles.set(camera, counts);
    }
    counts[kind] += 1;
  }

  /** Drop what was counted and not sent (the run is starting over). */
  discard(): void {
    this._accrue();
    this._take();
  }

  /** Send what was counted since the last send; if it fails, it goes with the next one. */
  flush(hass: HomeAssistant): Promise<void> {
    this._sending = this._sending.then(() => this._send(hass));
    return this._sending;
  }

  private async _send(hass: HomeAssistant): Promise<void> {
    this._accrue();
    const delta = this._take();
    if (!delta) return;
    try {
      await sendSoakCounts(hass, this._device(), delta);
    } catch {
      this._putBack(delta);
    }
  }

  private _accrue(): void {
    const now = this._now();
    if (this._openSince !== undefined) {
      this._openMs += now - this._openSince;
      this._openSince = now;
    }
    if (this._visibleSince !== undefined) {
      this._visibleMs += now - this._visibleSince;
      this._visibleSince = now;
    }
  }

  /** What was counted since the last send (none if nothing was), counting from zero again. */
  private _take(): SoakDelta | undefined {
    const delta: SoakDelta = {
      opens: this._opens,
      open_ms: Math.round(this._openMs),
      visible_ms: Math.round(this._visibleMs),
      tiles: [...this._tiles].map(([camera, counts]) => ({ camera, ...counts })),
    };
    this._opens = 0;
    this._openMs = 0;
    this._visibleMs = 0;
    this._tiles = new Map();
    const empty = !delta.opens && !delta.open_ms && !delta.visible_ms && !delta.tiles.length;
    return empty ? undefined : delta;
  }

  private _putBack(delta: SoakDelta): void {
    this._opens += delta.opens;
    this._openMs += delta.open_ms;
    this._visibleMs += delta.visible_ms;
    for (const { camera, plays, drops, failures } of delta.tiles) {
      const counts = this._tiles.get(camera) ?? { plays: 0, drops: 0, failures: 0 };
      this._tiles.set(camera, {
        plays: counts.plays + plays,
        drops: counts.drops + drops,
        failures: counts.failures + failures,
      });
    }
  }
}

/** The page's tally: the grid's, whichever grid element is attached. */
export const soakTally = new SoakTally();

/** What the report calls this device: "Mac · Chrome", "iPhone · Home Assistant app". */
export function deviceLabel(userAgent: string): string {
  const device = /iPhone/.test(userAgent)
    ? "iPhone"
    : /iPad/.test(userAgent)
      ? "iPad"
      : /Android/.test(userAgent)
        ? "Android"
        : /Macintosh|Mac OS X/.test(userAgent)
          ? "Mac"
          : /Windows/.test(userAgent)
            ? "Windows"
            : /Linux|X11/.test(userAgent)
              ? "Linux"
              : "Browser";
  const app = /Home ?Assistant\//.test(userAgent)
    ? "Home Assistant app"
    : /Edg(A|iOS)?\//.test(userAgent)
      ? "Edge"
      : /Firefox\/|FxiOS\//.test(userAgent)
        ? "Firefox"
        : /Chrome\/|CriOS\//.test(userAgent)
          ? "Chrome"
          : /Safari\//.test(userAgent)
            ? "Safari"
            : undefined;
  return app ? `${device} · ${app}` : device;
}

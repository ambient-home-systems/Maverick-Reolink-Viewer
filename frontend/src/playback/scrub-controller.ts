// Drives a scrub (Phase 10 step 2): while the pointer drags along the
// timeline over what the player has not buffered, it asks the server for the
// picture at the moment under the pointer (a scrub session, scrub-client.ts)
// and hands each answer to whoever paints it.
//
// One ask at a time: while one is answered, only the newest moment the pointer
// reached waits, and it is asked next. (Asking anew on every move would cancel
// each ask before its answer came, and a steady drag would show nothing.) The
// session opens on the first ask of a day, is reused while the day shows, and
// closes when the day changes, the tab goes, or after SESSION_IDLE_MS unused.

import type { ScrubAnswer, ScrubClient, ScrubPicture } from "./scrub-client";
import { isPicture } from "./scrub-client";

/** An unused session closes after this long (it opens again at the next drag). */
export const SESSION_IDLE_MS = 60_000;

export interface ScrubControllerOptions {
  /** Open a session for the day (the camera and day are the caller's). */
  open: () => Promise<ScrubClient>;
  /** A picture to show (only while a drag is under way). */
  show: (picture: ScrubPicture) => void;
  /** An ask that brought none, and why (for the debug view). */
  miss?: (answer: ScrubAnswer) => void;
}

export class ScrubController {
  private _session: Promise<ScrubClient> | undefined;
  private _pending: number | undefined;
  private _asking = false;
  private _active = false;
  private _idle: ReturnType<typeof setTimeout> | undefined;
  private _failed = false;
  /** Asks sent and pictures shown (the debug view and the tests). */
  readonly counts = { asked: 0, shown: 0, missed: 0 };

  constructor(private readonly _options: ScrubControllerOptions) {}

  /** The session could not be opened: this day's drags show what the buffer has. */
  get unavailable(): boolean {
    return this._failed;
  }

  /** The pointer is at `time` (UTC ms) over what is not buffered. */
  move(time: number): void {
    if (this._failed) return;
    this._active = true;
    this._pending = time;
    clearTimeout(this._idle);
    if (!this._asking) void this._pump();
  }

  /** The drag ended (released, or the pointer left): nothing more is shown. */
  end(): void {
    this._active = false;
    this._pending = undefined;
    this._armIdle();
  }

  /** Close the session (the day or the camera changed, or the tab went). */
  close(): void {
    this.end();
    clearTimeout(this._idle);
    const session = this._session;
    this._session = undefined;
    this._failed = false;
    void session?.then((client) => {
      client.close();
    }).catch(() => undefined);
  }

  private async _pump(): Promise<void> {
    this._asking = true;
    try {
      while (this._pending !== undefined) {
        const at = this._pending;
        this._pending = undefined;
        let client: ScrubClient;
        try {
          client = await this._client();
        } catch {
          this._failed = true;
          this._session = undefined;
          return;
        }
        this.counts.asked += 1;
        const answer = await client.ask(at);
        if (isPicture(answer)) {
          if (this._active) {
            this.counts.shown += 1;
            this._options.show(answer);
          }
        } else {
          this.counts.missed += 1;
          this._options.miss?.(answer);
          if (answer.error === "the scrub session closed") this._session = undefined;
        }
      }
    } finally {
      this._asking = false;
      this._armIdle();
    }
  }

  private _client(): Promise<ScrubClient> {
    this._session ??= this._options.open().then(async (client) => {
      await client.ready();
      return client;
    });
    return this._session;
  }

  private _armIdle(): void {
    clearTimeout(this._idle);
    if (this._asking || !this._session) return;
    this._idle = setTimeout(() => {
      if (this._active || this._asking) return;
      const session = this._session;
      this._session = undefined;
      void session?.then((client) => {
        client.close();
      }).catch(() => undefined);
    }, SESSION_IDLE_MS);
  }
}

// A live stream that keeps playing on one <video>. It starts over MSE when
// the stream is kept warm (its cached key frame shows at once) and over WebRTC
// otherwise, the other transport being the fallback (step 1's decision for
// every setup, docs/IMPLEMENTATION_PLAN.md). When a playing session ends it
// starts again at once; after a failed start it waits 1, 2, 5, 10, then 30 s.
import type { LiveRef } from "../api";
import type { HomeAssistant, SoakCounts } from "../types";
import {
  OurMse,
  OurWebRtc,
  type LiveSession,
  type SessionResult,
} from "./session";

export type Transport = "WebRTC" | "MSE";

export type PlayerState =
  | { kind: "idle" }
  | { kind: "starting"; transport: Transport }
  | { kind: "playing"; transport: Transport; result: SessionResult }
  /** A start failed; the next one is at `retryAt` (epoch ms). */
  | { kind: "waiting"; error: string; retryAt: number };

export interface PlayerOptions {
  /** Kept warm: start over MSE (from the cached key frame). */
  warm: boolean;
  iceServers: RTCIceServer[];
}

export type SessionFactory = (
  transport: Transport,
  hass: HomeAssistant,
  video: HTMLVideoElement,
  ref: LiveRef,
  iceServers: RTCIceServer[],
  timeoutMs: number,
) => LiveSession;

/** A start may take this long: a cold stream waits for the camera's next key frame (up to ~4 s). */
export const START_TIMEOUT_MS: Record<Transport, number> = {
  WebRTC: 15_000,
  MSE: 12_000,
};
export const RETRY_S = [1, 2, 5, 10, 30] as const;
/** A session that played this long before it ended starts again at once. */
export const STABLE_MS = 30_000;
/** The events a player keeps for its tile's debug view. */
export const EVENT_LOG = 20;

/** Something the player did, for the debug view: when (epoch ms) and what. */
export interface PlayerEvent {
  at: number;
  text: string;
}

const sessionFor: SessionFactory = (
  transport,
  hass,
  video,
  ref,
  iceServers,
  timeoutMs,
) =>
  transport === "MSE"
    ? new OurMse(hass, video, ref, timeoutMs)
    : new OurWebRtc(hass, video, ref, iceServers, timeoutMs);

export class LivePlayer {
  state: PlayerState = { kind: "idle" };
  /** Its last EVENT_LOG events, oldest first. */
  readonly events: PlayerEvent[] = [];
  /** Told of each first frame, end after one and failed start (the soak run counts them). */
  onCount: (kind: keyof SoakCounts) => void = () => undefined;
  private _session: LiveSession | undefined;
  private _timer: ReturnType<typeof setTimeout> | undefined;
  private _failures = 0;
  /** Bumped by stop(): what an older run finds afterwards is dropped. */
  private _run = 0;

  constructor(
    private readonly _hass: HomeAssistant,
    private readonly _video: HTMLVideoElement,
    readonly ref: LiveRef,
    /** Read at each start (keeping a stream warm may change it). */
    readonly options: PlayerOptions,
    private readonly _onState: (state: PlayerState) => void = () => undefined,
    private readonly _factory: SessionFactory = sessionFor,
  ) {}

  get running(): boolean {
    return this.state.kind !== "idle";
  }

  start(): void {
    if (this.running) return;
    this._failures = 0;
    void this._attempt(this._run);
  }

  /** Start again now, not when the wait after a failure is over. */
  retryNow(): void {
    if (this.state.kind !== "waiting") return;
    clearTimeout(this._timer);
    void this._attempt(this._run);
  }

  stop(): void {
    this._run += 1;
    clearTimeout(this._timer);
    this._session?.close();
    this._session = undefined;
    if (this.state.kind !== "idle") this._note("stopped");
    this._set({ kind: "idle" });
  }

  private async _attempt(run: number): Promise<void> {
    const order: Transport[] = this.options.warm
      ? ["MSE", "WebRTC"]
      : ["WebRTC", "MSE"];
    let error = "failed";
    for (const transport of order) {
      this._note(`${transport}: starting`);
      this._set({ kind: "starting", transport });
      const session = this._factory(
        transport,
        this._hass,
        this._video,
        this.ref,
        this.options.iceServers,
        START_TIMEOUT_MS[transport],
      );
      this._session = session;
      const began = Date.now();
      session.onEnd = (reason) => {
        this._ended(run, session, began, reason);
      };
      const result = await session.done;
      if (run !== this._run || this._session !== session) return;
      if (result.ok) {
        const first = result.firstFrameMs;
        this._note(`${transport}: playing${first !== undefined ? `, first frame in ${(first / 1000).toFixed(2)} s` : ""}`);
        this.onCount("plays");
        this._set({ kind: "playing", transport, result });
        return;
      }
      session.close();
      this._session = undefined;
      error = `${transport}: ${result.error ?? "failed"}`;
      this._note(error);
      this.onCount("failures");
    }
    this._failures += 1;
    this._wait(run, error);
  }

  /** A playing session ended: start again, at once if it had played a while. */
  private _ended(
    run: number,
    session: LiveSession,
    began: number,
    reason: string,
  ): void {
    if (run !== this._run || this._session !== session) return;
    session.close();
    this._session = undefined;
    this._note(`ended after ${Math.round((Date.now() - began) / 1000)} s: ${reason}`);
    this.onCount("drops");
    if (Date.now() - began >= STABLE_MS) {
      this._failures = 0;
      void this._attempt(run);
      return;
    }
    this._failures += 1;
    this._wait(run, reason);
  }

  private _wait(run: number, error: string): void {
    const delayS =
      RETRY_S[Math.min(this._failures, RETRY_S.length) - 1] ?? RETRY_S[0];
    this._note(`next try in ${delayS} s`);
    this._set({ kind: "waiting", error, retryAt: Date.now() + delayS * 1000 });
    this._timer = setTimeout(() => {
      if (run === this._run) void this._attempt(run);
    }, delayS * 1000);
  }

  private _note(text: string): void {
    this.events.push({ at: Date.now(), text });
    if (this.events.length > EVENT_LOG) this.events.splice(0, this.events.length - EVENT_LOG);
  }

  private _set(state: PlayerState): void {
    this.state = state;
    this._onState(state);
  }
}

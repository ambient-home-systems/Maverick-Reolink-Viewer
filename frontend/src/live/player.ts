// A live stream that keeps playing on one <video>. It starts over MSE when
// the stream is kept warm (its cached key frame shows at once) and over WebRTC
// otherwise, the other transport being the fallback (step 1's decision for
// every setup, docs/IMPLEMENTATION_PLAN.md). When a playing session ends it
// starts again at once; after a failed start it waits 1, 2, 5, 10, then 30 s.
//
// Some networks cut long-lived websockets (Phase 3's soak, run 15: a filtered
// work network closed every MSE tile's every 5½ minutes), and MSE's video
// crosses one; WebRTC's does not. When this page's MSE sessions are cut twice
// within CUT_WINDOW_MS, every player on it starts over WebRTC first for
// PREFER_WEBRTC_MS (CutWatch), then tries MSE first again; at once if WebRTC
// cannot start there either.
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

/** An MSE session that played this long and was cut counts (a short one is a failing stream). */
export const CUT_MIN_PLAY_MS = 60_000;
/** Cuts this close together are one: a restart or a blip cuts every tile at once. */
export const CUT_SAME_MS = 10_000;
/** Two cuts within this long: the network cuts long-lived websockets. */
export const CUT_WINDOW_MS = 20 * 60_000;
/** Then WebRTC goes first for this long (the page may have moved to another network since). */
export const PREFER_WEBRTC_MS = 60 * 60_000;

/** The cuts of this page's MSE sessions, and whether they made WebRTC go first. */
export class CutWatch {
  /** Epoch ms of each cut counted (a cut within CUT_SAME_MS of the last is the same one). */
  private _cuts: number[] = [];
  /** WebRTC goes first until then (epoch ms). */
  until = 0;

  /** Note a cut; true if it makes WebRTC go first. */
  note(at: number = Date.now()): boolean {
    const last = this._cuts.at(-1);
    if (last !== undefined && at - last < CUT_SAME_MS) return false;
    this._cuts = [...this._cuts.filter((t) => at - t < CUT_WINDOW_MS), at];
    if (this._cuts.length < 2 || this.preferWebRtc(at)) return false;
    this.until = at + PREFER_WEBRTC_MS;
    this._cuts = [];
    return true;
  }

  preferWebRtc(at: number = Date.now()): boolean {
    return at < this.until;
  }

  /** WebRTC could not start either: MSE goes first again. */
  giveUp(): void {
    this.until = 0;
  }
}

/** The page's: the network is the same for every tile on it. */
export const pageCuts = new CutWatch();

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
  /** It said that WebRTC goes first (once per switch). */
  private _switchNoted = false;
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
    private readonly _cuts: CutWatch = pageCuts,
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
    const mseFirst = this.options.warm && !this._cuts.preferWebRtc();
    const switched = this.options.warm && !mseFirst;
    if (switched && !this._switchNoted) this._note("WebRTC first: this network cuts MSE's connections");
    this._switchNoted = switched;
    const order: Transport[] = mseFirst ? ["MSE", "WebRTC"] : ["WebRTC", "MSE"];
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
      session.onEnd = (reason, cut) => {
        this._ended(run, session, began, reason, transport === "MSE" && cut);
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
      if (switched && transport === "WebRTC" && this._cuts.preferWebRtc()) {
        // A network that blocks WebRTC too: each start would wait for it to fail.
        this._cuts.giveUp();
        this._note("WebRTC could not start either: MSE goes first again");
      }
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
    mseCut: boolean,
  ): void {
    if (run !== this._run || this._session !== session) return;
    session.close();
    this._session = undefined;
    const played = Date.now() - began;
    this._note(`ended after ${Math.round(played / 1000)} s: ${reason}`);
    this.onCount("drops");
    if (mseCut && played >= CUT_MIN_PLAY_MS && this._cuts.note()) {
      this._note(
        `this page's MSE connections were cut twice within ${CUT_WINDOW_MS / 60_000} min: WebRTC goes first for ${PREFER_WEBRTC_MS / 60_000} min`,
      );
    }
    if (played >= STABLE_MS) {
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

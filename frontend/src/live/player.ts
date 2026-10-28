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
//
// Other networks block WebRTC (the work PC, 2026-10-28: no frame in 15 s, then
// MSE in 1 s), so a stream not kept warm would wait 15 s at each start. Once
// WebRTC is answered but never connects, and MSE then plays the stream, streams
// start over MSE first for PREFER_MSE_MS on this device and Home Assistant
// (WebRtcWatch); WebRTC playing again forgets it.
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

/** After WebRTC failed and MSE played, MSE goes first for this long (a week: each wrong WebRTC try costs 15 s). */
export const PREFER_MSE_MS = 7 * 24 * 60 * 60_000;
const BLOCKED_KEY = "reolink-viewer.webrtc-blocked";

/** Whether WebRTC is known not to connect from this device to this Home Assistant, kept across page loads. */
export class WebRtcWatch {
  /** MSE goes first until then (epoch ms), when the device cannot remember it. */
  private _until = 0;

  constructor(
    /** The Home Assistant address it is kept for: the network to it decides. */
    private readonly _host: string = location.host,
    private readonly _storage: () => Storage | undefined = () => localStorage,
  ) {}

  /** MSE goes first until then (epoch ms); 0 when WebRTC goes first. */
  get until(): number {
    const kept = this._read()[this._host];
    return Math.max(this._until, typeof kept === "number" ? kept : 0);
  }

  preferMse(at: number = Date.now()): boolean {
    return at < this.until;
  }

  /** WebRTC could not connect and MSE then played; true if it makes MSE go first. */
  note(at: number = Date.now()): boolean {
    if (this.preferMse(at)) return false;
    this._keep(at + PREFER_MSE_MS);
    return true;
  }

  /** WebRTC played: it connects from here after all. */
  works(): void {
    if (this.until) this._keep(0);
  }

  private _keep(until: number): void {
    this._until = until;
    try {
      const kept = Object.fromEntries(Object.entries(this._read()).filter(([host]) => host !== this._host));
      if (until) kept[this._host] = until;
      this._storage()?.setItem(BLOCKED_KEY, JSON.stringify(kept));
    } catch {
      // Not remembered (private browsing): it holds until the page closes.
    }
  }

  private _read(): Record<string, unknown> {
    try {
      const value: unknown = JSON.parse(this._storage()?.getItem(BLOCKED_KEY) ?? "{}");
      return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
}

/** The page's: this device's way to this Home Assistant is the same for every tile. */
export const pageWebRtc = new WebRtcWatch();

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
  /** It said that MSE goes first because WebRTC does not connect (once per switch). */
  private _blockedNoted = false;
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
    private readonly _webRtc: WebRtcWatch = pageWebRtc,
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
    const blocked = this._webRtc.preferMse();
    const mseFirst = blocked || (this.options.warm && !this._cuts.preferWebRtc());
    const switched = this.options.warm && !mseFirst;
    if (switched && !this._switchNoted) this._note("WebRTC first: this network cuts MSE's connections");
    this._switchNoted = switched;
    const mseInstead = blocked && !this.options.warm;
    if (mseInstead && !this._blockedNoted) this._note("MSE first: WebRTC does not connect from here");
    this._blockedNoted = mseInstead;
    const order: Transport[] = mseFirst ? ["MSE", "WebRTC"] : ["WebRTC", "MSE"];
    let error = "failed";
    /**
     * WebRTC failed though the server answered, without ever connecting: no
     * path from here. (A camera slow to wake has no answer yet; one slow to
     * send a frame had connected.)
     */
    let webRtcUnreachable = false;
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
        if (transport === "WebRTC") {
          this._webRtc.works();
        } else if (webRtcUnreachable && this._webRtc.note()) {
          this._note(`WebRTC could not connect but MSE played: MSE goes first from here for ${PREFER_MSE_MS / 86_400_000} days`);
        }
        this._set({ kind: "playing", transport, result });
        return;
      }
      session.close();
      this._session = undefined;
      error = `${transport}: ${result.error ?? "failed"}`;
      this._note(error);
      this.onCount("failures");
      if (transport === "WebRTC" && "answer" in result.steps && !("connected" in result.steps)) {
        webRtcUnreachable = true;
      }
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

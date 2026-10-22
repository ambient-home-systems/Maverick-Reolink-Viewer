// One live session on a <video>, measured: over WebRTC (ours, signaled through
// reolink_viewer/live/webrtc; or Home Assistant's own, camera/webrtc/offer) or
// over MSE (ours, go2rtc's fragments through the signed websocket proxy).
// Each records when its steps happened (ms from the start) and when the first
// frame was painted.
import {
  fetchLiveMsePath,
  sendLiveCandidate,
  subscribeLiveWebRtc,
  toError,
  type LiveRef,
} from "../api";
import { mseApiName, type MseApi } from "../playback/mse-feeder";
import type { HomeAssistant, LiveSignal, StockSignal } from "../types";
import { mseCodecs, pairInfo, wsUrl, type PairInfo } from "./check-util";

/** Live media kept behind the play position (s), and how far it may lag the edge. */
const KEEP_BEHIND_S = 10;
const MAX_LAG_S = 2;
/** A start lands this far before the newest buffered frame (s). */
const LIVE_EDGE_S = 0.5;
/** A playing session with no new frame for this long has ended. */
export const STALL_MS = 10_000;

export interface SessionResult {
  ok: boolean;
  firstFrameMs?: number;
  /** Named steps, ms from the start (e.g. answer, connected, mime). */
  steps: Record<string, number>;
  error?: string;
  pair?: PairInfo;
  /** MSE: the API and the MIME type go2rtc chose. */
  mse?: { api: MseApi; mime: string };
  width?: number;
  height?: number;
}

export interface LiveSession {
  /** Resolves when the first frame is painted (or the session fails). */
  readonly done: Promise<SessionResult>;
  /**
   * Called once if the session ends after its first frame: the server closed
   * it, the connection failed, or no new frame came for STALL_MS.
   */
  onEnd?: (error: string) => void;
  close(): void;
}

/** Wait for the first painted frame of a video; resolves with performance.now(). */
export function firstFrame(video: HTMLVideoElement): Promise<number> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve(performance.now());
    };
    if (typeof video.requestVideoFrameCallback === "function") {
      video.requestVideoFrameCallback(() => {
        finish();
      });
    } else {
      video.addEventListener("playing", finish, { once: true });
    }
  });
}

/** Common to the sessions: timing, timeout, the first frame, closing. */
abstract class BaseSession implements LiveSession {
  readonly done: Promise<SessionResult>;
  onEnd?: (error: string) => void;
  protected readonly t0 = performance.now();
  protected readonly steps: Record<string, number> = {};
  protected closed = false;
  private _resolve!: (result: SessionResult) => void;
  private _timer: ReturnType<typeof setTimeout>;
  private _playing = false;
  private _ended = false;
  private _lastFrame = 0;
  private _stallTimer: ReturnType<typeof setInterval> | undefined;

  constructor(
    protected readonly video: HTMLVideoElement,
    timeoutMs: number,
  ) {
    this.done = new Promise((resolve) => {
      this._resolve = resolve;
    });
    this._timer = setTimeout(() => {
      this.fail(`no frame within ${Math.round(timeoutMs / 1000)} s`);
    }, timeoutMs);
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    firstFrame(video).then(
      async (at) => {
        if (this.closed) return;
        clearTimeout(this._timer);
        this._playing = true;
        this._watchFrames();
        const extra = await this.describe().catch(() => ({}));
        this._resolve({
          ok: true,
          firstFrameMs: at - this.t0,
          steps: this.steps,
          ...(video.videoWidth ? { width: video.videoWidth, height: video.videoHeight } : {}),
          ...extra,
        });
      },
      () => undefined,
    );
  }

  protected step(name: string): void {
    this.steps[name] ??= Math.round(performance.now() - this.t0);
  }

  protected fail(error: string): void {
    clearTimeout(this._timer);
    if (this._playing) {
      // After the first frame: an end, once (the player reconnects).
      if (this._ended || this.closed) return;
      this._ended = true;
      clearInterval(this._stallTimer);
      this.onEnd?.(error);
      return;
    }
    void this.describe()
      .catch(() => ({}))
      .then((extra) => {
        this._resolve({ ok: false, error, steps: this.steps, ...extra });
      });
  }

  /** What the result adds (the candidate pair, the MSE type). */
  protected describe(): Promise<Partial<SessionResult>> {
    return Promise.resolve({});
  }

  protected play(): void {
    this.video.play().catch(() => undefined);
  }

  /** While playing, note each new frame; none for STALL_MS ends the session. */
  private _watchFrames(): void {
    const video = this.video;
    this._lastFrame = performance.now();
    const seen = () => {
      this._lastFrame = performance.now();
    };
    if (typeof video.requestVideoFrameCallback === "function") {
      const tick = () => {
        seen();
        if (!this.closed && !this._ended) video.requestVideoFrameCallback(tick);
      };
      video.requestVideoFrameCallback(tick);
    } else {
      video.addEventListener("timeupdate", seen);
    }
    this._stallTimer = setInterval(() => {
      if (performance.now() - this._lastFrame > STALL_MS) {
        this.fail(`no new frame for ${Math.round(STALL_MS / 1000)} s`);
      }
    }, 1000);
  }

  close(): void {
    this.closed = true;
    clearTimeout(this._timer);
    clearInterval(this._stallTimer);
    const video = this.video;
    video.pause();
    video.srcObject = null;
    video.removeAttribute("src");
    video.load();
  }
}

/** WebRTC with a peer connection; signaling is the subclass's. */
abstract class WebRtcBase extends BaseSession {
  protected pc: RTCPeerConnection | undefined;

  protected async connect(iceServers: RTCIceServer[]): Promise<RTCSessionDescriptionInit> {
    const pc = new RTCPeerConnection({ iceServers });
    this.pc = pc;
    pc.addTransceiver("video", { direction: "recvonly" });
    pc.addTransceiver("audio", { direction: "recvonly" });
    pc.addEventListener("track", (event) => {
      this.step("track");
      if (!this.video.srcObject) {
        this.video.srcObject = event.streams[0] ?? new MediaStream([event.track]);
        this.play();
      }
    });
    pc.addEventListener("iceconnectionstatechange", () => {
      const state = pc.iceConnectionState;
      if (state === "connected" || state === "completed") this.step("connected");
      if (state === "failed") this.fail("ICE failed: no path between the browser and the server");
    });
    pc.addEventListener("icegatheringstatechange", () => {
      if (pc.iceGatheringState === "complete") this.step("gathered");
    });
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.step("offer");
    return offer;
  }

  protected override async describe(): Promise<Partial<SessionResult>> {
    if (!this.pc) return {};
    return { pair: pairInfo(await this.pc.getStats()) };
  }

  override close(): void {
    super.close();
    this.pc?.close();
  }
}

/** Our WebRTC: reolink_viewer/live/webrtc to our go2rtc, trickle ICE. */
export class OurWebRtc extends WebRtcBase {
  private _unsubscribe: (() => Promise<void>) | undefined;
  private _session: string | undefined;
  private readonly _early: string[] = [];

  constructor(
    private readonly _hass: HomeAssistant,
    video: HTMLVideoElement,
    ref: LiveRef,
    iceServers: RTCIceServer[],
    timeoutMs: number,
  ) {
    super(video, timeoutMs);
    void this._start(ref, iceServers);
  }

  private async _start(ref: LiveRef, iceServers: RTCIceServer[]): Promise<void> {
    try {
      const offer = await this.connect(iceServers);
      this.pc?.addEventListener("icecandidate", (event) => {
        const candidate = event.candidate?.candidate;
        if (!candidate) return;
        if (this._session) void this._send(candidate);
        else this._early.push(candidate);
      });
      this._unsubscribe = await subscribeLiveWebRtc(this._hass, ref, offer.sdp ?? "", (signal) => {
        void this._signal(signal);
      });
      if (this.closed) void this._unsubscribe();
    } catch (err) {
      this.fail(toError(err).message);
    }
  }

  private async _send(candidate: string): Promise<void> {
    if (!this._session || this.closed) return;
    await sendLiveCandidate(this._hass, this._session, candidate).catch(() => undefined);
  }

  private async _signal(signal: LiveSignal): Promise<void> {
    const pc = this.pc;
    if (!pc || this.closed) return;
    try {
      switch (signal.type) {
        case "session":
          this._session = signal.session_id;
          for (const candidate of this._early.splice(0)) void this._send(candidate);
          return;
        case "answer":
          this.step("answer");
          await pc.setRemoteDescription({ type: "answer", sdp: signal.sdp });
          return;
        case "candidate":
          if (signal.candidate) await pc.addIceCandidate({ candidate: signal.candidate, sdpMid: "0" });
          return;
        case "error":
          this.fail(signal.message);
          return;
        case "closed":
          this.step("closed");
          return;
      }
    } catch (err) {
      this.fail(toError(err).message);
    }
  }

  override close(): void {
    super.close();
    void this._unsubscribe?.().catch(() => undefined);
  }
}

/** Home Assistant's own camera WebRTC (its go2rtc), as its camera view uses it. */
export class StockWebRtc extends WebRtcBase {
  private _unsubscribe: (() => Promise<void>) | undefined;
  private _session: string | undefined;
  private readonly _early: RTCIceCandidateInit[] = [];

  constructor(
    private readonly _hass: HomeAssistant,
    video: HTMLVideoElement,
    private readonly _entityId: string,
    timeoutMs: number,
  ) {
    super(video, timeoutMs);
    void this._start();
  }

  private async _start(): Promise<void> {
    try {
      const config = await this._hass.callWS<{ configuration: RTCConfiguration }>({
        type: "camera/webrtc/get_client_config",
        entity_id: this._entityId,
      });
      this.step("config");
      const offer = await this.connect(config.configuration.iceServers ?? []);
      this.pc?.addEventListener("icecandidate", (event) => {
        if (!event.candidate) return;
        const init = event.candidate.toJSON();
        if (this._session) void this._send(init);
        else this._early.push(init);
      });
      this._unsubscribe = await this._hass.connection.subscribeMessage<StockSignal>(
        (signal) => {
          void this._signal(signal);
        },
        { type: "camera/webrtc/offer", entity_id: this._entityId, offer: offer.sdp ?? "" },
      );
      if (this.closed) void this._unsubscribe();
    } catch (err) {
      this.fail(toError(err).message);
    }
  }

  private async _send(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this._session || this.closed) return;
    await this._hass
      .callWS({
        type: "camera/webrtc/candidate",
        entity_id: this._entityId,
        session_id: this._session,
        candidate,
      })
      .catch(() => undefined);
  }

  private async _signal(signal: StockSignal): Promise<void> {
    const pc = this.pc;
    if (!pc || this.closed) return;
    try {
      switch (signal.type) {
        case "session":
          this._session = signal.session_id;
          for (const candidate of this._early.splice(0)) void this._send(candidate);
          return;
        case "answer":
          this.step("answer");
          await pc.setRemoteDescription({ type: "answer", sdp: signal.answer });
          return;
        case "candidate":
          await pc.addIceCandidate(signal.candidate);
          return;
        case "error":
          this.fail(`${signal.code}: ${signal.message}`);
          return;
      }
    } catch (err) {
      this.fail(toError(err).message);
    }
  }

  override close(): void {
    super.close();
    void this._unsubscribe?.().catch(() => undefined);
  }
}

interface MediaSourceCtor {
  new (): MediaSource;
  isTypeSupported(type: string): boolean;
}

/** Our MSE: go2rtc's fragmented MP4 through the signed websocket proxy. */
export class OurMse extends BaseSession {
  private _ws: WebSocket | undefined;
  private _buffer: SourceBuffer | undefined;
  private _url: string | undefined;
  private readonly _queue: ArrayBuffer[] = [];
  private _api: MseApi | undefined;
  private _mime = "";
  private _started = false;

  constructor(
    private readonly _hass: HomeAssistant,
    video: HTMLVideoElement,
    ref: LiveRef,
    timeoutMs: number,
    private readonly _base: string = location.href,
    /** Ask for video only (the check's test of whether audio holds a start back). */
    private readonly _videoOnly = false,
  ) {
    super(video, timeoutMs);
    void this._start(ref);
  }

  private async _start(ref: LiveRef): Promise<void> {
    const api = mseApiName();
    if (!api) {
      this.fail("this browser has no MediaSource");
      return;
    }
    this._api = api;
    const Ctor = (window as unknown as Record<MseApi, MediaSourceCtor>)[api];
    try {
      const { path } = await fetchLiveMsePath(this._hass, ref);
      this.step("url");
      if (this.closed) return;
      const ws = new WebSocket(wsUrl(path, this._base));
      ws.binaryType = "arraybuffer";
      this._ws = ws;
      ws.addEventListener("open", () => {
        this.step("open");
        const codecs = mseCodecs((type) => Ctor.isTypeSupported(type), this._videoOnly);
        ws.send(JSON.stringify({ type: "mse", value: codecs }));
      });
      ws.addEventListener("message", (event: MessageEvent<string | ArrayBuffer>) => {
        if (typeof event.data === "string") this._text(event.data, Ctor);
        else this._media(event.data);
      });
      ws.addEventListener("close", () => {
        if (!this.closed) this.fail("the server closed the stream");
      });
    } catch (err) {
      this.fail(toError(err).message);
    }
  }

  private _text(data: string, Ctor: MediaSourceCtor): void {
    let message: { type?: string; value?: string };
    try {
      message = JSON.parse(data) as { type?: string; value?: string };
    } catch {
      return;
    }
    if (message.type === "error") {
      this.fail(message.value ?? "error");
      return;
    }
    if (message.type !== "mse" || !message.value) return;
    this.step("mime");
    this._mime = message.value;
    const source = new Ctor();
    // ManagedMediaSource plays only with remote playback (AirPlay) off.
    this.video.disableRemotePlayback = true;
    this._url = URL.createObjectURL(source);
    source.addEventListener(
      "sourceopen",
      () => {
        try {
          this._buffer = source.addSourceBuffer(message.value ?? "");
          this._buffer.mode = "segments";
          this._buffer.addEventListener("updateend", () => {
            this._appended();
          });
          this._next();
        } catch (err) {
          this.fail(`MSE refused ${message.value ?? ""}: ${toError(err).message}`);
        }
      },
      { once: true },
    );
    this.video.src = this._url;
  }

  private _media(data: ArrayBuffer): void {
    this.step("first data");
    this._queue.push(data);
    this._next();
  }

  private _next(): void {
    const buffer = this._buffer;
    if (!buffer || buffer.updating || this.closed) return;
    const data = this._queue.shift();
    if (!data) return;
    try {
      buffer.appendBuffer(data);
    } catch (err) {
      this.fail(`append failed: ${toError(err).message}`);
    }
  }

  /** After each append: start, stay near the live edge, trim behind. */
  private _appended(): void {
    const buffer = this._buffer;
    const video = this.video;
    if (!buffer || this.closed) return;
    const ranges = buffer.buffered;
    if (ranges.length) {
      const start = ranges.start(0);
      const end = ranges.end(ranges.length - 1);
      if (!this._started && end > start) {
        this._started = true;
        this.step("appended");
        // The key-frame cache sends every frame since the last key frame at
        // once: start near the newest (the browser decodes from the key frame).
        video.currentTime = Math.max(start, end - LIVE_EDGE_S);
        this.play();
      } else if (end - video.currentTime > MAX_LAG_S) {
        video.currentTime = end - 0.3;
      }
      if (video.currentTime - start > KEEP_BEHIND_S * 2 && !buffer.updating) {
        buffer.remove(start, video.currentTime - KEEP_BEHIND_S);
        return;
      }
    }
    this._next();
  }

  protected override describe(): Promise<Partial<SessionResult>> {
    return Promise.resolve(this._api ? { mse: { api: this._api, mime: this._mime } } : {});
  }

  override close(): void {
    this._ws?.close();
    super.close();
    if (this._url) URL.revokeObjectURL(this._url);
  }
}

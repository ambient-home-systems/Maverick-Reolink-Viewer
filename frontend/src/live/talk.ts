// Talk through a camera from its live view (Phase 12c): the microphone, as
// 16-bit mono PCM at the camera's sample rate, to Home Assistant over its own
// websocket (binary messages to the talk's handler). The server encodes it
// for the camera (ADPCM) and sends it at real time.
import type { HomeAssistant, Unsubscribe } from "../types";

/** The talk has started on the camera: where its audio goes, and its limits. */
export interface TalkStarted {
  type: "started";
  /** The binary handler: each audio message starts with this byte. */
  handler_id: number;
  /** The camera's rate: the PCM sent is at this rate. */
  sample_rate: number;
  /** No audio this long ends the talk; it lasts at most ``max_s``. */
  idle_s: number;
  max_s: number;
  open_ms: number | null;
}

/** A talk's numbers, from the server. */
export interface TalkStats {
  open_ms: number | null;
  /** Audio blocks sent to the camera, and how much audio that was. */
  blocks: number;
  seconds: number;
  /** Times the camera ran out of audio (the microphone's came late). */
  gaps: number;
  /** Audio dropped, too late to send. */
  dropped_s: number;
  /** How it ended: stopped, idle, limit, error, closed, unloaded. */
  ended: string | null;
  error: string | null;
  /** "ok", or why the camera's close failed. */
  close: string | null;
}

interface TalkEnded extends TalkStats {
  type: "ended";
}

type TalkEvent = TalkStarted | TalkEnded;

/** How long the camera may take to start the talk. */
export const START_TIMEOUT_MS = 15_000;
/** Audio is captured and sent in pieces of about this long. */
export const PIECE_S = 0.064;

/** Why talk cannot work on this page, or undefined if it can. */
export function talkUnavailable(win: Window = window): string | undefined {
  if (!win.isSecureContext) {
    return "Talk needs a secure page: open Home Assistant over https (Nabu Casa, or a certificate) or in its app.";
  }
  if (!("mediaDevices" in win.navigator) || typeof win.navigator.mediaDevices.getUserMedia !== "function") {
    return "This browser does not let pages use the microphone.";
  }
  if (typeof (win as Window & { AudioContext?: unknown }).AudioContext !== "function") {
    return "This browser cannot capture audio.";
  }
  return undefined;
}

/**
 * Float audio (-1..1) at one rate to 16-bit PCM at another. Going down, it is
 * low-passed first (two poles at 0.45 of the new rate) and read between
 * samples; the state carries over from one piece to the next.
 */
export class PcmConverter {
  private readonly _step: number;
  private readonly _alpha: number;
  private _low1 = 0;
  private _low2 = 0;
  private _pending: number[] = [];
  private _position = 0;

  constructor(
    readonly inRate: number,
    readonly outRate: number,
  ) {
    this._step = inRate / outRate;
    this._alpha = inRate > outRate ? 1 - Math.exp((-2 * Math.PI * 0.45 * outRate) / inRate) : 1;
  }

  push(input: Float32Array): Int16Array {
    for (const sample of input) {
      this._low1 += this._alpha * (sample - this._low1);
      this._low2 += this._alpha * (this._low1 - this._low2);
      this._pending.push(this._low2);
    }
    const out: number[] = [];
    while (this._position + 1 < this._pending.length) {
      const at = Math.floor(this._position);
      const part = this._position - at;
      const value = (this._pending[at] ?? 0) * (1 - part) + (this._pending[at + 1] ?? 0) * part;
      out.push(Math.max(-32768, Math.min(32767, Math.round(value * 32767))));
      this._position += this._step;
    }
    const used = Math.floor(this._position);
    this._pending = this._pending.slice(used);
    this._position -= used;
    return Int16Array.from(out);
  }
}

/**
 * The browser's audio, opened in the press that starts a talk (Safari on an
 * iPhone runs audio only from a user's gesture, and the microphone and the
 * camera are awaited after it). ``start`` then captures the microphone:
 * pieces of float audio at ``rate`` go to ``piece``.
 */
export interface AudioCapture {
  start(stream: MediaStream, piece: (audio: Float32Array) => void): Promise<{ rate: number; stop: () => void }>;
  /** Close it without capturing (the talk did not start). */
  close(): void;
}

/** Open the browser's audio at about ``sampleRate``, now (in the press). */
export type OpenCapture = (sampleRate: number) => AudioCapture;

/** Talk's usual rate (the Doorbell's): the audio is opened at it before the camera says. */
export const USUAL_RATE = 16000;

// The capture's worklet: it gathers the input into pieces for the page.
const WORKLET = `class RvTalkCapture extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.piece = new Float32Array(options.processorOptions.size);
    this.filled = 0;
  }
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) {
      for (let i = 0; i < channel.length; i++) {
        this.piece[this.filled++] = channel[i];
        if (this.filled === this.piece.length) {
          this.port.postMessage(this.piece.slice(0));
          this.filled = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor("rv-talk-capture", RvTalkCapture);
`;

async function captureIn(
  context: AudioContext,
  stream: MediaStream,
  piece: (audio: Float32Array) => void,
): Promise<{ rate: number; stop: () => void }> {
  if (context.state === "suspended") await context.resume();
  const source = context.createMediaStreamSource(stream);
  // Pulled by the output, silent (a node nothing pulls may never run).
  const mute = context.createGain();
  mute.gain.value = 0;
  mute.connect(context.destination);
  const size = Math.max(128, Math.round(context.sampleRate * PIECE_S));
  let node: AudioNode;
  if (typeof AudioWorkletNode === "function" && "audioWorklet" in context) {
    const url = URL.createObjectURL(new Blob([WORKLET], { type: "text/javascript" }));
    try {
      await context.audioWorklet.addModule(url);
    } finally {
      URL.revokeObjectURL(url);
    }
    const worklet = new AudioWorkletNode(context, "rv-talk-capture", { processorOptions: { size } });
    worklet.port.onmessage = (event: MessageEvent<Float32Array>) => {
      piece(event.data);
    };
    node = worklet;
  } else {
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- browsers without AudioWorklet
    const processor = context.createScriptProcessor(2048, 1, 1);
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- as above
    processor.onaudioprocess = (event: AudioProcessingEvent) => {
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- as above
      piece(new Float32Array(event.inputBuffer.getChannelData(0)));
    };
    node = processor;
  }
  source.connect(node);
  node.connect(mute);
  return {
    rate: context.sampleRate,
    stop: () => {
      source.disconnect();
      node.disconnect();
      void context.close().catch(() => undefined);
    },
  };
}

/**
 * The browser's capture: an AudioWorklet, or a ScriptProcessor where there is
 * none. Opened at the camera's rate where the browser allows; Firefox will
 * not take a microphone into a context at another rate than its own, so the
 * capture falls back to the browser's rate (resampled here).
 */
export const openWebAudio: OpenCapture = (sampleRate) => {
  let context: AudioContext;
  // At the camera's rate, the browser resamples (better than here).
  let ownRate = false;
  try {
    context = new AudioContext({ sampleRate });
  } catch {
    context = new AudioContext();
    ownRate = true;
  }
  // In the press: Safari lets audio start only from it.
  void context.resume().catch(() => undefined);
  return {
    start: async (stream, piece) => {
      try {
        return await captureIn(context, stream, piece);
      } catch (err) {
        void context.close().catch(() => undefined);
        if (ownRate) throw err;
        context = new AudioContext();
        try {
          return await captureIn(context, stream, piece);
        } catch (again) {
          void context.close().catch(() => undefined);
          throw again;
        }
      }
    },
    close: () => {
      void context.close().catch(() => undefined);
    },
  };
};

/** The microphone, with what a voice call asks of it. */
export const microphone = (): Promise<MediaStream> =>
  navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });

/** Send a talk's audio to its handler (binary: the handler's byte, then 16-bit PCM). */
export function sendPcm(socket: WebSocket | undefined, handlerId: number, pcm: Int16Array): boolean {
  if (!socket || socket.readyState !== 1 || pcm.length === 0) return false;
  const message = new Uint8Array(1 + pcm.byteLength);
  message[0] = handlerId;
  // Little-endian, as every browser's typed arrays are on the hardware they run on.
  message.set(new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength), 1);
  socket.send(message);
  return true;
}

/**
 * One talk through a camera: the microphone asked for first (its prompt
 * before the camera is), then the talk started on the camera, then the
 * audio sent as it comes. ``ended`` is called if the server ends the talk
 * (no audio, its limit, a failure); ``stop`` ends it from here.
 */
export class TalkClient {
  started: TalkStarted | undefined;
  /** Seconds of audio sent from here (for the panel's numbers). */
  sentS = 0;
  private _mic: MediaStream | undefined;
  private _unsub: Unsubscribe | undefined;
  private _audio: AudioCapture | undefined;
  private _stopCapture: (() => void) | undefined;
  private _over = false;

  constructor(
    private readonly hass: HomeAssistant,
    private readonly deviceId: string,
    private readonly ended: (stats: TalkStats) => void,
    private readonly openCapture: OpenCapture = openWebAudio,
    private readonly getMicrophone: () => Promise<MediaStream> = microphone,
  ) {}

  /** Start the talk; call it from the press itself (its audio opens before any wait). */
  async start(): Promise<TalkStarted> {
    const audio = this.openCapture(USUAL_RATE);
    this._audio = audio;
    try {
      this._mic = await this.getMicrophone();
    } catch (err) {
      this._release();
      throw err;
    }
    try {
      const started = await new Promise<TalkStarted>((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error("The camera did not start the talk in time."));
        }, START_TIMEOUT_MS);
        this.hass.connection
          .subscribeMessage<TalkEvent>(
            (event) => {
              if (event.type === "started") {
                clearTimeout(timer);
                resolve(event);
              } else {
                clearTimeout(timer);
                reject(new Error(event.error ?? "The talk ended."));
                this._serverEnded(event);
              }
            },
            { type: "reolink_viewer/talk/start", device_id: this.deviceId },
          )
          .then(
            (unsub) => {
              this._unsub = unsub;
              if (this._over) void unsub().catch(() => undefined);
            },
            (err: unknown) => {
              clearTimeout(timer);
              reject(err instanceof Error ? err : new Error(String((err as { message?: string }).message ?? err)));
            },
          );
      });
      this.started = started;
      const socket = (this.hass.connection as unknown as { socket?: WebSocket }).socket;
      const mic = this._mic;
      // The capture's rate is known once it has started.
      const convert: { to?: PcmConverter } = {};
      const capture = await audio.start(mic, (piece) => {
        if (!convert.to || this._over) return;
        const pcm = convert.to.push(piece);
        if (sendPcm(socket, started.handler_id, pcm)) this.sentS += pcm.length / started.sample_rate;
      });
      this._audio = undefined;
      convert.to = new PcmConverter(capture.rate, started.sample_rate);
      this._stopCapture = capture.stop;
      if (this._over) this._release();
      return started;
    } catch (err) {
      await this.stop();
      throw err;
    }
  }

  /** End the talk; resolves with its numbers once the camera has closed it (or none). */
  async stop(): Promise<TalkStats | null> {
    const wasStarted = this.started !== undefined && !this._over;
    this._over = true;
    this._release();
    let stats: TalkStats | null = null;
    if (wasStarted) {
      try {
        stats = (
          await this.hass.callWS<{ stats: TalkStats | null }>({
            type: "reolink_viewer/talk/stop",
            device_id: this.deviceId,
          })
        ).stats;
      } catch {
        // The websocket closing ends the talk anyway.
      }
    }
    const unsub = this._unsub;
    this._unsub = undefined;
    if (unsub) await unsub().catch(() => undefined);
    return stats;
  }

  private _serverEnded(stats: TalkStats): void {
    if (this._over) return;
    this._over = true;
    this._release();
    const unsub = this._unsub;
    this._unsub = undefined;
    if (unsub) void unsub().catch(() => undefined);
    this.ended(stats);
  }

  private _release(): void {
    this._audio?.close();
    this._audio = undefined;
    this._stopCapture?.();
    this._stopCapture = undefined;
    for (const track of this._mic?.getTracks() ?? []) track.stop();
    this._mic = undefined;
  }
}

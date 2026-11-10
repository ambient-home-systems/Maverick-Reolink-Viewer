// A scrub session (Phase 10 step 1): the picture at each moment the pointer
// passes, from the server (views.ScrubView, scrub.py). The session is a
// websocket behind a signed path for one camera's day; each `ask` sends the
// moment, and the server answers it with the key frame showing it (an init
// segment of the video track alone and a fragment of that one sample) or a
// JPEG where the camera cannot be cut. Newest wins: an ask still waiting when
// a newer one is sent resolves as superseded, and the server does not answer
// it.

/** A picture the server sent for a moment. */
export interface ScrubPicture {
  /** The moment asked for and the picture's own time (UTC ms). */
  at: number;
  time: number;
  /** "store" (found earlier), "cache" or "cut" (the disk), "device" (a cut now), "thumbnail". */
  source: string;
  kind: "fmp4" | "jpeg";
  codec: string | null;
  init: Uint8Array;
  /** The one-sample fragment, or the JPEG. */
  data: Uint8Array;
  /** The server's time for it, and the round trip from the ask (ms). */
  serverMs: number | undefined;
  ms: number;
  /** The camera's key-frame interval (ms), as the server knows it. */
  interval?: number;
}

/** No picture: why, in plain words, or that a newer moment was asked. */
export interface ScrubMiss {
  at: number;
  error: string;
  superseded?: boolean;
  ms: number;
}

export type ScrubAnswer = ScrubPicture | ScrubMiss;

export const isPicture = (answer: ScrubAnswer): answer is ScrubPicture => "data" in answer;

/** What the client needs of a WebSocket (a stand-in in the tests). */
export interface SocketLike {
  binaryType: string;
  readyState: number;
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  send(data: string): void;
  close(): void;
}

const OPEN = 1;

/** Read the server's binary message: a 4-byte length, a JSON header, init, data. */
export function readPicture(buffer: ArrayBuffer, ms: number): ScrubPicture & { seq: number } {
  const view = new DataView(buffer);
  const length = view.getUint32(0);
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 4, length))) as {
    seq: number;
    at: number;
    time: number;
    source: string;
    kind: "fmp4" | "jpeg";
    codec: string | null;
    init: number;
    data: number;
    timing?: { ms?: number };
    interval?: number | null;
  };
  const body = 4 + length;
  return {
    seq: header.seq,
    at: header.at,
    time: header.time,
    source: header.source,
    kind: header.kind,
    codec: header.codec,
    init: new Uint8Array(buffer, body, header.init),
    data: new Uint8Array(buffer, body + header.init, header.data),
    serverMs: header.timing?.ms,
    ms,
    ...(typeof header.interval === "number" ? { interval: header.interval } : {}),
  };
}

interface Waiting {
  seq: number;
  at: number;
  began: number;
  resolve: (answer: ScrubAnswer) => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * An ask unanswered this long (ms) is given up as a miss, so a lost answer
 * cannot hold up the asks after it (the server's slowest, a cut from the
 * device, gives up within about 2 s).
 */
export const ASK_TIMEOUT_MS = 5000;

export class ScrubClient {
  private _seq = 0;
  private _waiting: Waiting | undefined;
  private _closed = false;
  private readonly _ready: Promise<void>;

  constructor(
    private readonly _socket: SocketLike,
    private readonly _now: () => number = () => performance.now(),
  ) {
    _socket.binaryType = "arraybuffer";
    this._ready = new Promise((resolve, reject) => {
      _socket.onopen = () => {
        resolve();
      };
      _socket.onerror = () => {
        reject(new Error("the scrub session could not open"));
      };
    });
    _socket.onmessage = (event) => {
      this._message(event.data);
    };
    _socket.onclose = () => {
      this._closed = true;
      this._settle({ error: "the scrub session closed" });
    };
  }

  /** Wait until the session is open (rejects if it cannot open within `timeoutMs`). */
  ready(timeoutMs = 10_000): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const late = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(new Error("the scrub session did not open in time"));
      }, timeoutMs);
    });
    return Promise.race([this._ready, late]).finally(() => {
      clearTimeout(timer);
    });
  }

  /**
   * Ask for the picture at `at` (UTC ms, sent as whole milliseconds: a drag's
   * time has fractions, which the server did not take before v0.60.0); a
   * newer ask supersedes this one, and one unanswered in `timeoutMs` is a miss.
   */
  async ask(time: number, timeoutMs = ASK_TIMEOUT_MS): Promise<ScrubAnswer> {
    const at = Math.round(time);
    await this._ready;
    const began = this._now();
    if (this._closed || this._socket.readyState !== OPEN) {
      return { at, error: "the scrub session closed", ms: 0 };
    }
    this._settle({ error: "a newer moment was asked", superseded: true });
    this._seq += 1;
    const seq = this._seq;
    const answer = new Promise<ScrubAnswer>((resolve) => {
      const timer = setTimeout(() => {
        if (this._waiting?.seq === seq) this._settle({ error: "no answer in time" });
      }, timeoutMs);
      this._waiting = { seq, at, began, resolve, timer };
    });
    this._socket.send(JSON.stringify({ seq, at }));
    return answer;
  }

  close(): void {
    this._closed = true;
    this._settle({ error: "the scrub session closed" });
    this._socket.close();
  }

  private _settle(miss: { error: string; superseded?: boolean }): void {
    const waiting = this._take();
    waiting?.resolve({ at: waiting.at, ms: this._now() - waiting.began, ...miss });
  }

  /** The ask waiting, now answered: it waits no more. */
  private _take(): Waiting | undefined {
    const waiting = this._waiting;
    this._waiting = undefined;
    clearTimeout(waiting?.timer);
    return waiting;
  }

  private _message(data: unknown): void {
    const waiting = this._waiting;
    if (!waiting) return;
    const ms = this._now() - waiting.began;
    if (data instanceof ArrayBuffer) {
      const { seq, ...picture } = readPicture(data, ms);
      if (seq !== waiting.seq) return;
      this._take();
      waiting.resolve(picture);
      return;
    }
    if (typeof data !== "string") return;
    let reply: { seq?: number; error?: string };
    try {
      reply = JSON.parse(data) as { seq?: number; error?: string };
    } catch {
      return;
    }
    if (reply.seq !== waiting.seq) return;
    this._take();
    waiting.resolve({ at: waiting.at, error: reply.error ?? "no picture", ms });
  }
}

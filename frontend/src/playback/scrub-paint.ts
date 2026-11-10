// Painting a scrub's pictures (Phase 10 step 2): a key frame from the server
// (an init segment and a one-sample fragment, scrub-client.ts) decoded on its
// own and drawn where the player's video is. With WebCodecs, one VideoDecoder,
// kept while the stream's configuration stays the same, decodes each key
// frame and is flushed so it gives it up at once; where the browser has no
// VideoDecoder, a video element of its own plays it through Media Source
// Extensions, its buffer holding that one picture.

import {
  keyFrames,
  videoTrack,
  webCodecs,
  type Codecs,
  type DecoderLike,
  type FrameLike,
  type VideoTrack,
} from "./keyframes";
import type { ScrubPicture } from "./scrub-client";

const FRAME_TIMEOUT_MS = 2000;

/** The key frame in a picture: its track, codec and sample, if it has them. */
function sampleOf(picture: ScrubPicture): { track: VideoTrack; codec: string; data: Uint8Array; timeS: number } | undefined {
  if (picture.kind !== "fmp4" || !picture.codec) return undefined;
  const track = videoTrack(picture.init);
  const frame = track ? keyFrames(picture.data, track)[0] : undefined;
  if (!track || !frame) return undefined;
  return { track, codec: picture.codec, data: frame.data, timeS: frame.timeS };
}

/** Decodes key frames with WebCodecs and hands each frame to `draw`. */
export class KeyFramePainter {
  private _decoder: DecoderLike | undefined;
  private _config = "";
  private _waiting: { resolve: (frame: FrameLike) => void; reject: (err: Error) => void } | undefined;

  constructor(private readonly _codecs: Pick<Codecs, "VideoDecoder" | "EncodedVideoChunk"> = webCodecs()) {}

  /** Whether this browser decodes with WebCodecs. */
  get available(): boolean {
    return this._codecs.VideoDecoder !== undefined;
  }

  /** Decode a picture and draw it; resolves false if it could not. */
  async paint(picture: ScrubPicture, draw: (frame: FrameLike) => void): Promise<boolean> {
    const sample = sampleOf(picture);
    const Decoder = this._codecs.VideoDecoder;
    if (!sample || !Decoder) return false;
    const description = sample.track.description;
    const key = `${sample.codec}|${String(sample.track.width)}x${String(sample.track.height)}|${description ? [...description].join(",") : ""}`;
    try {
      if (!this._decoder || key !== this._config) {
        this.close();
        this._config = key;
        const decoder: DecoderLike = new Decoder({
          output: (frame) => {
            // One frame per picture: any other is let go at once.
            const waiting = this._waiting;
            this._waiting = undefined;
            if (waiting) waiting.resolve(frame);
            else frame.close();
          },
          error: (err) => {
            // WebCodecs closes a decoder that failed: the next picture makes another.
            this._waiting?.reject(err);
            if (this._decoder === decoder) {
              this._decoder = undefined;
              this._config = "";
            }
          },
        });
        this._decoder = decoder;
        decoder.configure({
          codec: sample.codec,
          codedWidth: sample.track.width,
          codedHeight: sample.track.height,
          optimizeForLatency: true,
          ...(description ? { description } : {}),
        });
      }
      const decoder = this._decoder;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const output = new Promise<FrameLike>((resolve, reject) => {
        this._waiting = { resolve, reject };
        timer = setTimeout(() => {
          reject(new Error("no frame in time"));
        }, FRAME_TIMEOUT_MS);
      });
      decoder.decode(
        new this._codecs.EncodedVideoChunk({ type: "key", timestamp: Math.round(sample.timeS * 1e6), data: sample.data }),
      );
      // The flush makes the decoder give the frame up now; a failed one is the decoder's error.
      const flushed = decoder.flush().catch(() => undefined);
      let frame: FrameLike;
      try {
        frame = await output;
      } finally {
        clearTimeout(timer);
        this._waiting = undefined;
      }
      try {
        draw(frame);
      } finally {
        frame.close();
      }
      await flushed;
      return true;
    } catch {
      // A broken decoder is made again for the next picture.
      this.close();
      return false;
    }
  }

  close(): void {
    try {
      this._decoder?.close();
    } catch {
      // Closed already.
    }
    this._decoder = undefined;
    this._config = "";
  }
}

interface MediaSourceLike extends EventTarget {
  readyState: string;
  addSourceBuffer(type: string): SourceBuffer;
}

type MediaSourceCtor = new () => MediaSourceLike;

function mediaSource(): MediaSourceCtor | undefined {
  const w = window as unknown as Record<string, unknown>;
  const ctor = w.ManagedMediaSource ?? w.MediaSource;
  return typeof ctor === "function" ? (ctor as MediaSourceCtor) : undefined;
}

function once(target: EventTarget, type: string, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      target.removeEventListener(type, done);
      resolve(false);
    }, timeoutMs);
    const done = () => {
      clearTimeout(timer);
      target.removeEventListener(type, done);
      resolve(true);
    };
    target.addEventListener(type, done);
  });
}

async function update(buffer: SourceBuffer, run: () => void): Promise<void> {
  const ended = once(buffer, "updateend", FRAME_TIMEOUT_MS);
  run();
  if (!(await ended)) throw new Error("the buffer did not take it");
}

/**
 * Plays pictures through MSE where WebCodecs is missing: each picture's init
 * segment (when it changes) and its one-sample fragment are appended, the
 * picture before it removed, and the video set to its time.
 */
export class MsePainter {
  private _buffer: SourceBuffer | undefined;
  private _codec = "";
  private _init: Uint8Array | undefined;
  private _url: string | undefined;

  constructor(private readonly _ctor: MediaSourceCtor | undefined = mediaSource()) {}

  get available(): boolean {
    return this._ctor !== undefined;
  }

  async paint(picture: ScrubPicture, video: HTMLVideoElement): Promise<boolean> {
    const sample = sampleOf(picture);
    const Ctor = this._ctor;
    if (!sample || !Ctor) return false;
    try {
      if (!this._buffer || sample.codec !== this._codec) {
        this.close(video);
        const source = new Ctor();
        video.disableRemotePlayback = true;
        this._url = URL.createObjectURL(source as unknown as MediaSource);
        const opened = once(source, "sourceopen", FRAME_TIMEOUT_MS);
        video.src = this._url;
        if (!(await opened)) throw new Error("the source did not open");
        this._buffer = source.addSourceBuffer(`video/mp4; codecs="${sample.codec}"`);
        this._codec = sample.codec;
        this._init = undefined;
      }
      const buffer = this._buffer;
      if (buffer.buffered.length) {
        await update(buffer, () => {
          buffer.remove(0, Number.POSITIVE_INFINITY);
        });
      }
      if (!this._init || !same(this._init, picture.init)) {
        await update(buffer, () => {
          buffer.appendBuffer(picture.init as Uint8Array<ArrayBuffer>);
        });
        this._init = picture.init;
      }
      await update(buffer, () => {
        buffer.appendBuffer(picture.data as Uint8Array<ArrayBuffer>);
      });
      const seeked = once(video, "seeked", FRAME_TIMEOUT_MS);
      video.currentTime = sample.timeS + 0.001;
      return await seeked;
    } catch {
      this.close(video);
      return false;
    }
  }

  close(video?: HTMLVideoElement): void {
    if (video && this._url) {
      video.removeAttribute("src");
      video.load();
    }
    if (this._url) URL.revokeObjectURL(this._url);
    this._url = undefined;
    this._buffer = undefined;
    this._codec = "";
    this._init = undefined;
  }
}

function same(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

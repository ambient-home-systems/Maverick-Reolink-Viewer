// Thumbnail images, loaded a few at a time.
//
// Over plain HTTP the browser opens at most 6 connections to Home Assistant,
// and each thumbnail request waits while the server pulls a frame from the
// NVR. A page of event cards asking for all its thumbnails at once took every
// connection, and a recording clicked meanwhile waited for them: 19 s in a
// test with 1.5 s thumbnails. So thumbnails are preloaded here, at most
// `concurrency` at a time, and not at all while a recording is starting
// (`pause`/`resume`). Thumbnails are cacheable, so the <img> showing one
// afterwards is served from the browser cache.

/** What the loader needs from an image element (an `Image` in the browser). */
export interface LoadableImage {
  onload: ((event: Event) => unknown) | null;
  onerror: ((event: Event) => unknown) | null;
  src: string;
}

interface Job {
  url: string;
  resolve: (loaded: boolean) => void;
}

export class ThumbLoader {
  private readonly _queue: Job[] = [];
  private readonly _active = new Set<{ job: Job; image: LoadableImage }>();
  private _paused = false;

  constructor(
    private readonly _concurrency = 2,
    private readonly _create: () => LoadableImage = () => new Image(),
  ) {}

  /** Load `url`; resolves true once loaded, false if it failed or was cleared. */
  load(url: string): Promise<boolean> {
    return new Promise((resolve) => {
      this._queue.push({ url, resolve });
      this._pump();
    });
  }

  /** Start no new loads until `resume` (loads already running finish). */
  pause(): void {
    this._paused = true;
  }

  resume(): void {
    this._paused = false;
    this._pump();
  }

  /** Drop every queued and running load (each resolves false). */
  clear(): void {
    for (const job of this._queue.splice(0)) job.resolve(false);
    for (const { job, image } of this._active) {
      image.onload = image.onerror = null;
      image.src = "";
      job.resolve(false);
    }
    this._active.clear();
  }

  get pending(): number {
    return this._queue.length + this._active.size;
  }

  private _pump(): void {
    while (!this._paused && this._active.size < this._concurrency) {
      const job = this._queue.shift();
      if (!job) return;
      const image = this._create();
      const slot = { job, image };
      const done = (loaded: boolean) => {
        if (!this._active.delete(slot)) return;
        job.resolve(loaded);
        this._pump();
      };
      image.onload = () => {
        done(true);
      };
      image.onerror = () => {
        done(false);
      };
      this._active.add(slot);
      image.src = job.url;
    }
  }
}

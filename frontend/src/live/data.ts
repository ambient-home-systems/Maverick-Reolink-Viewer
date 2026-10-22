// What the live views share, loaded once per view: the cameras and their
// streams (with which are kept warm), Home Assistant's ICE servers, and every
// camera's last picture (live/images: watched while the view is open, which
// is also what keeps the pictures fresh on the server).
import type { ReactiveController, ReactiveControllerHost } from "lit";

import {
  fetchIceServers,
  fetchLiveCameras,
  subscribeLiveImages,
  toError,
} from "../api";
import type {
  HomeAssistant,
  LiveCamera,
  LiveConnection,
  LiveImage,
} from "../types";
import { rtcIceServers } from "./check-util";

export class LiveData implements ReactiveController {
  cameras: LiveCamera[] | undefined;
  images: Record<string, LiveImage> = {};
  /** Undefined until loaded (WebRTC waits for them; MSE does not need them). */
  iceServers: RTCIceServer[] | undefined;
  error: string | undefined;
  private _hass: HomeAssistant | undefined;
  private _connected = false;
  /** Loaded (or failed) once per connection; reload() asks again. */
  private _started = false;
  /** Bumped on disconnect: a load still running then is dropped. */
  private _run = 0;
  private _unsubscribe: (() => Promise<void>) | undefined;

  constructor(private readonly _host: ReactiveControllerHost) {
    _host.addController(this);
  }

  /** Give it Home Assistant (each update); it loads once it has it and is connected. */
  set hass(hass: HomeAssistant | undefined) {
    this._hass = hass;
    this._maybeLoad();
  }

  hostConnected(): void {
    this._connected = true;
    this._maybeLoad();
  }

  hostDisconnected(): void {
    this._connected = false;
    this._reset();
  }

  /** Load again (after an error). */
  reload(): void {
    this._reset();
    this.error = undefined;
    this._maybeLoad();
  }

  private _reset(): void {
    this._started = false;
    this._run += 1;
    void this._unsubscribe?.().catch(() => undefined);
    this._unsubscribe = undefined;
  }

  private _maybeLoad(): void {
    if (!this._hass || !this._connected || this._started) return;
    this._started = true;
    void this._load(this._hass, this._run);
  }

  private async _load(hass: HomeAssistant, run: number): Promise<void> {
    const images = subscribeLiveImages(hass, (event) => {
      if (run !== this._run) return;
      this.images = { ...this.images, ...event.images };
      this._host.requestUpdate();
    });
    const ice = fetchIceServers(hass).then(rtcIceServers, () => []);
    try {
      const [unsubscribe, { cameras }, iceServers] = await Promise.all([
        images,
        fetchLiveCameras(hass),
        ice,
      ]);
      if (run !== this._run) {
        void unsubscribe().catch(() => undefined);
        return;
      }
      this._unsubscribe = unsubscribe;
      this.cameras = cameras;
      this.iceServers = iceServers;
      this.error = undefined;
    } catch (err) {
      void images.then((unsubscribe) => unsubscribe()).catch(() => undefined);
      if (run !== this._run) return;
      this.error = toError(err).message;
    }
    this._host.requestUpdate();
  }
}

/**
 * Whether a camera's sub stream is (or is about to be) kept warm: its switch
 * is on (Home Assistant's state is the truth), or the server says so.
 */
export function isWarm(hass: HomeAssistant | undefined, camera: LiveCamera): boolean {
  const entity = camera.keep_warm_entity;
  if (entity && hass?.states[entity]?.state === "on") return true;
  return liveConnection(camera)?.streams.sub?.warm === true;
}

/** The connection live view watches a camera through: the NVR's where it has one. */
export function liveConnection(camera: LiveCamera): LiveConnection | undefined {
  return (
    camera.connections.find((c) => c.via === "nvr") ?? camera.connections[0]
  );
}

/** The camera a device id names: the camera's own id or one of its connections'. */
export function cameraFor(
  cameras: LiveCamera[],
  deviceId: string,
): LiveCamera | undefined {
  return cameras.find(
    (c) =>
      c.id === deviceId ||
      c.connections.some((x) => x.connection_id === deviceId),
  );
}

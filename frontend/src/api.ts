import type {
  CacheStatusResult,
  CapacityEvent,
  IceServer,
  LiveCamera,
  LiveImagesEvent,
  LiveSignal,
  LiveStatus,
  LiveStreamKind,
  LiveSoak,
  LiveStreamState,
  SoakCounts,
  SoakRun,
  Catalog,
  MediaInfoResponse,
  PlaybackUrl,
  Stream,
  ThumbnailUrl,
  TimelineDay,
  TimelineDays,
  DeviceResponse,
  DevicesResponse,
  EntityRegistryUpdateResult,
  HassConnection,
  HomeAssistant,
  ProbeEvent,
  ProbeOptions,
  ProbeReport,
  RecentEvents,
} from "./types";

export const fetchDevices = (hass: HomeAssistant): Promise<DevicesResponse> =>
  hass.callWS<DevicesResponse>({ type: "reolink_viewer/devices" });

export const fetchDevice = (hass: HomeAssistant, deviceId: string): Promise<DeviceResponse> =>
  hass.callWS<DeviceResponse>({ type: "reolink_viewer/device", device_id: deviceId });

// The catalog only changes with an integration update: fetch it once per connection.
const catalogs = new WeakMap<HassConnection, Promise<Catalog>>();

export function fetchCatalog(hass: HomeAssistant): Promise<Catalog> {
  let catalog = catalogs.get(hass.connection);
  if (!catalog) {
    catalog = hass.callWS<Catalog>({ type: "reolink_viewer/catalog" });
    catalogs.set(hass.connection, catalog);
    // Let a failed fetch be retried.
    catalog.catch(() => catalogs.delete(hass.connection));
  }
  return catalog;
}

/** Enable a disabled entity (admin only). HA reloads the config entry afterwards. */
export const enableEntity = (
  hass: HomeAssistant,
  entityId: string,
): Promise<EntityRegistryUpdateResult> =>
  hass.callWS<EntityRegistryUpdateResult>({
    type: "config/entity_registry/update",
    entity_id: entityId,
    disabled_by: null,
  });

export interface ProbeRun {
  /** Resolves with the redacted report, rejects on error or cancel. */
  result: Promise<ProbeReport>;
  /** Stops the probe on the server. */
  cancel: () => void;
}

/**
 * Run the probe. The server streams progress events and then one result (or
 * error) event over a websocket subscription; unsubscribing cancels it.
 */
export function runProbe(
  hass: HomeAssistant,
  options: ProbeOptions,
  onProgress: (message: string) => void,
): ProbeRun {
  let unsubscribe: (() => Promise<void>) | undefined;
  let settled = false;
  let rejectRun: (reason: Error) => void = () => undefined;

  const stop = () => {
    const unsub = unsubscribe;
    unsubscribe = undefined;
    if (unsub) {
      unsub().catch(() => undefined);
    }
  };

  const result = new Promise<ProbeReport>((resolve, reject) => {
    rejectRun = reject;
    const onEvent = (event: ProbeEvent) => {
      if (settled) return;
      switch (event.type) {
        case "progress":
          onProgress(event.message);
          return;
        case "result":
          settled = true;
          stop();
          resolve(event.report);
          return;
        case "error":
          settled = true;
          stop();
          reject(new Error(event.message));
          return;
      }
    };
    hass.connection
      .subscribeMessage<ProbeEvent>(onEvent, { type: "reolink_viewer/probe", ...options })
      .then((unsub) => {
        unsubscribe = unsub;
        // The probe may have finished before the subscription resolved.
        if (settled) stop();
      })
      .catch((err: unknown) => {
        settled = true;
        reject(toError(err));
      });
  });

  return {
    result,
    cancel: () => {
      if (settled) return;
      settled = true;
      stop();
      rejectRun(new Error("Probe cancelled"));
    },
  };
}

/** HA websocket errors arrive as {code, message} objects. */
export function toError(err: unknown): Error {
  if (err instanceof Error) return err;
  if (typeof err === "object" && err !== null && "message" in err) {
    return new Error(String(err.message));
  }
  return new Error(String(err));
}

// ---- Playback ----

export const fetchTimelineDays = (
  hass: HomeAssistant,
  deviceId: string,
  year: number,
  month: number,
): Promise<TimelineDays> =>
  hass.callWS<TimelineDays>({
    type: "reolink_viewer/timeline/days",
    device_id: deviceId,
    year,
    month,
  });

/**
 * `maxAge` (s): accept a copy of today that old at once (timing cache "stale").
 * `stream`: the HD (main) list instead of SD; `background`: a search nobody
 * waits for (it yields to what someone asked for).
 */
export const fetchTimelineDay = (
  hass: HomeAssistant,
  deviceId: string,
  date: string,
  maxAge = 0,
  options: { stream?: Stream; background?: boolean } = {},
): Promise<TimelineDay> =>
  hass.callWS<TimelineDay>({
    type: "reolink_viewer/timeline/day",
    device_id: deviceId,
    date,
    ...(maxAge > 0 ? { max_age: maxAge } : {}),
    ...(options.stream && options.stream !== "sub" ? { stream: options.stream } : {}),
    ...(options.background ? { background: true } : {}),
  });

/**
 * A day's events of every recording camera (by default each one's today),
 * newest first. `maxAge` (s):
 * accept cached copies of today that old; `background`: a refresh nobody
 * waits for (it yields to what someone asked for).
 */
export const fetchRecentEvents = (
  hass: HomeAssistant,
  options: { date?: string; maxAge?: number; background?: boolean } = {},
): Promise<RecentEvents> =>
  hass.callWS<RecentEvents>({
    type: "reolink_viewer/events/recent",
    ...(options.date ? { date: options.date } : {}),
    ...(options.maxAge ? { max_age: options.maxAge } : {}),
    ...(options.background ? { background: true } : {}),
  });

/** The days of a month with recordings on any camera. */
export const fetchEventDays = (
  hass: HomeAssistant,
  year: number,
  month: number,
): Promise<{ days: number[]; failed: { camera_id: string; error: string }[] }> =>
  hass.callWS({ type: "reolink_viewer/events/days", year, month });

/** This user opened an event. */
export const markEventSeen = (hass: HomeAssistant, cameraId: string, start: number): Promise<unknown> =>
  hass.callWS({ type: "reolink_viewer/events/seen", camera_id: cameraId, start });

/** Nothing until now is new for this user. */
export const markAllEventsSeen = (hass: HomeAssistant): Promise<unknown> =>
  hass.callWS({ type: "reolink_viewer/events/seen", all: true });

/** Fetch today's timeline of every recording camera in the background. */
export const warmTimelines = (hass: HomeAssistant): Promise<{ cameras: number }> =>
  hass.callWS<{ cameras: number }>({ type: "reolink_viewer/timeline/warm" });

export interface SegmentRef {
  deviceId: string;
  date: string;
  segmentId: string;
  stream: Stream;
}

/**
 * `at` (UTC ms): where playback will start. A recording still being written
 * grows; the server uses a copy made earlier only if it reaches that far.
 */
export const fetchPlaybackUrl = (
  hass: HomeAssistant,
  ref: SegmentRef,
  progressive: boolean,
  at?: number,
): Promise<PlaybackUrl> =>
  hass.callWS<PlaybackUrl>({
    type: "reolink_viewer/playback/url",
    device_id: ref.deviceId,
    date: ref.date,
    segment_id: ref.segmentId,
    stream: ref.stream,
    progressive,
    ...(at === undefined ? {} : { at: Math.round(at) }),
  });

/** The MSE player's fragment path for a recording (see fetchPlaybackUrl for `at`). */
export const fetchPlaybackMse = (hass: HomeAssistant, ref: SegmentRef, at?: number): Promise<PlaybackUrl> =>
  hass.callWS<PlaybackUrl>({
    type: "reolink_viewer/playback/mse",
    device_id: ref.deviceId,
    date: ref.date,
    segment_id: ref.segmentId,
    stream: ref.stream,
    ...(at === undefined ? {} : { at: Math.round(at) }),
  });

/** The token of a playback URL or fragment path (its last path segment). */
export function urlToken(path: string): string {
  return path.split("?")[0]?.split("/").at(-1) ?? "";
}

/**
 * End the leases of playback URLs (by token): the player no longer holds
 * their recordings, so the server may evict them for others.
 */
export const releasePlayback = (hass: HomeAssistant, tokens: string[]): Promise<unknown> =>
  hass.callWS({ type: "reolink_viewer/playback/release", tokens });

/** The download of the copy a URL (by its token) serves. */
export const fetchCacheStatus = (hass: HomeAssistant, token: string): Promise<CacheStatusResult> =>
  hass.callWS<CacheStatusResult>({ type: "reolink_viewer/playback/cache_status", token });

export const prefetchSegment = (hass: HomeAssistant, ref: SegmentRef): Promise<unknown> =>
  hass.callWS({
    type: "reolink_viewer/playback/prefetch",
    device_id: ref.deviceId,
    date: ref.date,
    segment_id: ref.segmentId,
    stream: ref.stream,
  });

export const fetchThumbnailUrls = (
  hass: HomeAssistant,
  deviceId: string,
  times: number[],
  bucket: number,
): Promise<{ urls: ThumbnailUrl[] }> =>
  hass.callWS<{ urls: ThumbnailUrl[] }>({
    type: "reolink_viewer/thumbnail/urls",
    device_id: deviceId,
    times,
    bucket,
  });

export const fetchMediaInfo = (hass: HomeAssistant, deviceId: string): Promise<MediaInfoResponse> =>
  hass.callWS<MediaInfoResponse>({ type: "reolink_viewer/playback/media_info", device_id: deviceId });

// ---- Live view ----

export const fetchLiveStatus = (hass: HomeAssistant): Promise<LiveStatus> =>
  hass.callWS<LiveStatus>({ type: "reolink_viewer/live/status" });

export const fetchLiveCameras = (hass: HomeAssistant): Promise<{ cameras: LiveCamera[] }> =>
  hass.callWS<{ cameras: LiveCamera[] }>({ type: "reolink_viewer/live/cameras" });

export interface LiveRef {
  connectionId: string;
  stream: LiveStreamKind;
}

const liveRef = (ref: LiveRef) => ({ connection_id: ref.connectionId, stream: ref.stream });

/** The signed path of a stream's MSE websocket (open it within 2 minutes). */
export const fetchLiveMsePath = (hass: HomeAssistant, ref: LiveRef): Promise<{ path: string }> =>
  hass.callWS<{ path: string }>({ type: "reolink_viewer/live/mse", ...liveRef(ref) });

/** The signed path of a JPEG from a stream (from go2rtc). */
export const fetchLiveFramePath = (hass: HomeAssistant, ref: LiveRef): Promise<{ path: string }> =>
  hass.callWS<{ path: string }>({ type: "reolink_viewer/live/frame", ...liveRef(ref) });

export const fetchLiveState = (hass: HomeAssistant, ref: LiveRef): Promise<LiveStreamState> =>
  hass.callWS<LiveStreamState>({ type: "reolink_viewer/live/state", ...liveRef(ref) });

/** The soak report's server samples since a time (epoch ms), and one now. */
export const fetchLiveSoak = (hass: HomeAssistant): Promise<LiveSoak> =>
  hass.callWS<LiveSoak>({ type: "reolink_viewer/live/soak" });

/** What a grid counted since it last reported, for the soak run. */
export interface SoakDelta {
  opens: number;
  open_ms: number;
  visible_ms: number;
  tiles: ({ camera: string } & SoakCounts)[];
}

/** Add what a grid counted to the soak run (the first report starts one). */
export const sendSoakCounts = (
  hass: HomeAssistant,
  device: string,
  delta: SoakDelta,
): Promise<{ started_at: number }> =>
  hass.callWS({ type: "reolink_viewer/live/soak/count", device, ...delta });

/** Start the soak run over (with the grid open on this page, or not). */
export const startSoakOver = (hass: HomeAssistant, device: string, gridOpen: boolean): Promise<{ run: SoakRun }> =>
  hass.callWS({ type: "reolink_viewer/live/soak/start", device, grid_open: gridOpen });

/**
 * Keep a stream warm (its feed open, its last key frame cached), or stop
 * (admin). Turning it on resolves once a key frame is cached (or after 15 s).
 */
export const setLivePreload = (
  hass: HomeAssistant,
  ref: LiveRef,
  enabled: boolean,
): Promise<{ preloaded: string[]; key_frame: boolean }> =>
  hass.callWS({ type: "reolink_viewer/live/preload", ...liveRef(ref), enabled });

/** Home Assistant's ICE servers (with Nabu Casa's TURN for subscribers). */
export const fetchIceServers = (hass: HomeAssistant): Promise<IceServer[]> =>
  hass.callWS<IceServer[]>({ type: "web_rtc/ice_servers" });

/** Start a WebRTC session; events arrive through `onSignal`. Resolves with the unsubscribe. */
export const subscribeLiveWebRtc = (
  hass: HomeAssistant,
  ref: LiveRef,
  offer: string,
  onSignal: (signal: LiveSignal) => void,
): Promise<() => Promise<void>> =>
  hass.connection.subscribeMessage<LiveSignal>(onSignal, {
    type: "reolink_viewer/live/webrtc",
    ...liveRef(ref),
    offer,
  });

export const sendLiveCandidate = (hass: HomeAssistant, sessionId: string, candidate: string): Promise<unknown> =>
  hass.callWS({ type: "reolink_viewer/live/candidate", session_id: sessionId, candidate });

/**
 * Watch the cameras' last pictures: every camera's at once, then each new one.
 * Pictures are taken while anyone watches. Resolves with the unsubscribe.
 */
export const subscribeLiveImages = (
  hass: HomeAssistant,
  onEvent: (event: LiveImagesEvent) => void,
): Promise<() => Promise<void>> =>
  hass.connection.subscribeMessage<LiveImagesEvent>(onEvent, { type: "reolink_viewer/live/images" });

/** Run the capacity test of a host (admin). Resolves with the unsubscribe. */
export const subscribeCapacity = (
  hass: HomeAssistant,
  hostId: string,
  onEvent: (event: CapacityEvent) => void,
  options: { include_main?: boolean; include_fill?: boolean } = {},
): Promise<() => Promise<void>> =>
  hass.connection.subscribeMessage<CapacityEvent>(onEvent, {
    type: "reolink_viewer/live/capacity",
    host_id: hostId,
    ...options,
  });

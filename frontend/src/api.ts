import type {
  CacheStatusResult,
  CardLogDevice,
  CapacityEvent,
  IceServer,
  JournalStatus,
  UnusualCheck,
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
  LearnedProfile,
  UnusualMarks,
  WallLayout,
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

/**
 * Each recording camera's newest event, newest first (the Wall's strip):
 * today's, else the newest of a day kept on the server. As fetchRecentEvents
 * for `maxAge` and `background`.
 */
export const fetchLatestEvents = (
  hass: HomeAssistant,
  options: { maxAge?: number; background?: boolean } = {},
): Promise<RecentEvents> =>
  hass.callWS<RecentEvents>({
    type: "reolink_viewer/events/latest",
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

/** A scrub session for a camera's day (Phase 10): its signed websocket path. */
export const openScrubSession = (
  hass: HomeAssistant,
  deviceId: string,
  date: string,
): Promise<{ url: string; expires_in: number }> =>
  hass.callWS({ type: "reolink_viewer/playback/scrub", device_id: deviceId, date });

// ---- Live view ----

export const fetchLiveStatus = (hass: HomeAssistant): Promise<LiveStatus> =>
  hass.callWS<LiveStatus>({ type: "reolink_viewer/live/status" });

/** The detection journal: whether it records, and what it holds (Phase 8). */
export const fetchJournalStatus = (hass: HomeAssistant): Promise<JournalStatus> =>
  hass.callWS<JournalStatus>({ type: "reolink_viewer/journal/status" });

/** The learning check: the marks compared with the events fired, and who listens (Phase 8). */
export const fetchUnusualCheck = (hass: HomeAssistant): Promise<UnusualCheck> =>
  hass.callWS<UnusualCheck>({ type: "reolink_viewer/unusual/check" });

/** The incidents marked unusual in [since, until) (epoch ms), for the panel (Phase 8.3). */
export const fetchUnusualMarks = (hass: HomeAssistant, since: number, until: number): Promise<UnusualMarks> =>
  hass.callWS<UnusualMarks>({ type: "reolink_viewer/unusual/marks", since, until });

/** What one camera has learned (Phase 8.3): when, how long, after what, which days. */
export const fetchLearnedProfile = (hass: HomeAssistant, cameraId: string): Promise<LearnedProfile> =>
  hass.callWS<LearnedProfile>({ type: "reolink_viewer/unusual/profile", camera_id: cameraId });

/** What the dashboard cards saw, per device (the one heard from last first). */
export const fetchCardLog = (hass: HomeAssistant): Promise<{ devices: CardLogDevice[] }> =>
  hass.callWS<{ devices: CardLogDevice[] }>({ type: "reolink_viewer/live/card_log" });

/** Start the dashboard cards' log over. */
export const clearCardLog = (hass: HomeAssistant): Promise<unknown> =>
  hass.callWS({ type: "reolink_viewer/live/card_log/clear" });

export const fetchLiveCameras = (hass: HomeAssistant): Promise<{ cameras: LiveCamera[] }> =>
  hass.callWS<{ cameras: LiveCamera[] }>({ type: "reolink_viewer/live/cameras" });

export interface LiveRef {
  connectionId: string;
  stream: LiveStreamKind;
  /**
   * HD in a Wall tile (Phase 9 step 3): a stream not running yet starts only
   * on a free stream slot of its host, and ends when another stream needs it.
   */
  spare?: boolean;
}

const liveRef = (ref: LiveRef) => ({ connection_id: ref.connectionId, stream: ref.stream });
/** What starts a stream (MSE, WebRTC) also says whether it is spare. */
const startRef = (ref: LiveRef) => ({ ...liveRef(ref), ...(ref.spare ? { spare: true } : {}) });

/** The signed path of a stream's MSE websocket (open it within 2 minutes). */
export const fetchLiveMsePath = (hass: HomeAssistant, ref: LiveRef): Promise<{ path: string }> =>
  hass.callWS<{ path: string }>({ type: "reolink_viewer/live/mse", ...startRef(ref) });

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
    ...startRef(ref),
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
  /** Only these cameras' (a dashboard card's): the others are not refreshed for it. */
  cameraIds?: readonly string[],
): Promise<() => Promise<void>> =>
  hass.connection.subscribeMessage<LiveImagesEvent>(onEvent, {
    type: "reolink_viewer/live/images",
    ...(cameraIds ? { camera_ids: [...cameraIds] } : {}),
  });

/** Run the capacity test of a host (admin). Resolves with the unsubscribe. */
export const subscribeCapacity = (
  hass: HomeAssistant,
  hostId: string,
  onEvent: (event: CapacityEvent) => void,
  /** `mains`: 1 to 3 main streams at once (Phase 9 step 3 asks whether more than one fits). */
  options: { include_main?: boolean; include_fill?: boolean; mains?: number } = {},
): Promise<() => Promise<void>> =>
  hass.connection.subscribeMessage<CapacityEvent>(onEvent, {
    type: "reolink_viewer/live/capacity",
    host_id: hostId,
    ...options,
  });

/** This user's saved Wall layouts (Phase 9). */
export const fetchWallLayouts = (hass: HomeAssistant): Promise<{ layouts: WallLayout[] }> =>
  hass.callWS<{ layouts: WallLayout[] }>({ type: "reolink_viewer/wall/layouts" });

/** Keep a Wall layout: a new one without an id, else the one with that id. */
export const saveWallLayout = (
  hass: HomeAssistant,
  layout: Omit<WallLayout, "id"> & { id?: string },
): Promise<{ layout: WallLayout }> => {
  const { id, ...rest } = layout;
  return hass.callWS<{ layout: WallLayout }>({
    type: "reolink_viewer/wall/layouts/save",
    ...rest,
    ...(id ? { layout_id: id } : {}),
  });
};

/** Forget a saved Wall layout. */
export const deleteWallLayout = (hass: HomeAssistant, id: string): Promise<unknown> =>
  hass.callWS({ type: "reolink_viewer/wall/layouts/delete", layout_id: id });

import type {
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

/** `maxAge` (s): accept a copy of today that old at once (timing cache "stale"). */
export const fetchTimelineDay = (
  hass: HomeAssistant,
  deviceId: string,
  date: string,
  maxAge = 0,
): Promise<TimelineDay> =>
  hass.callWS<TimelineDay>({
    type: "reolink_viewer/timeline/day",
    device_id: deviceId,
    date,
    ...(maxAge > 0 ? { max_age: maxAge } : {}),
  });

/** Fetch today's timeline of every recording camera in the background. */
export const warmTimelines = (hass: HomeAssistant): Promise<{ cameras: number }> =>
  hass.callWS<{ cameras: number }>({ type: "reolink_viewer/timeline/warm" });

export interface SegmentRef {
  deviceId: string;
  date: string;
  segmentId: string;
  stream: Stream;
}

export const fetchPlaybackUrl = (
  hass: HomeAssistant,
  ref: SegmentRef,
  progressive: boolean,
): Promise<PlaybackUrl> =>
  hass.callWS<PlaybackUrl>({
    type: "reolink_viewer/playback/url",
    device_id: ref.deviceId,
    date: ref.date,
    segment_id: ref.segmentId,
    stream: ref.stream,
    progressive,
  });

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

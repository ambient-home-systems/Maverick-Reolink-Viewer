import type {
  Catalog,
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

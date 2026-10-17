// Shared fixtures for the Vitest suites.
import type {
  CameraNode,
  Catalog,
  CatalogEntry,
  DeviceConnection,
  DeviceResponse,
  DevicesResponse,
  EntityInfo,
  HassEntities,
  HassEntity,
  HomeAssistant,
  HostNode,
  ProbeEvent,
} from "./types";

const COMPAT = { ok: true, errors: [], reolink_aio_version: "0.21.18" };

export function makeHostNode(overrides: Partial<HostNode> = {}): HostNode {
  return {
    id: "dev-nvr",
    kind: "nvr",
    group_id: null,
    device_id: "dev-nvr",
    name: "Garage NVR",
    manufacturer: "Reolink",
    model: "RLN36",
    model_id: null,
    hw_version: "N5MB01",
    sw_version: "v3.6.5",
    area_id: null,
    disabled_by: null,
    entry_id: "entry-nvr",
    entry_title: "Garage NVR",
    camera_ids: ["dev-cam"],
    entities: 10,
    disabled_entities: 2,
    ...overrides,
  };
}

export function makeCamera(overrides: Partial<CameraNode> = {}): CameraNode {
  return {
    id: "dev-cam",
    kind: "camera",
    group_id: null,
    device_id: "dev-cam",
    name: "Front Yard",
    manufacturer: "Reolink",
    model: "CX810",
    model_id: null,
    hw_version: "IPC",
    sw_version: "v3.1.0",
    area_id: null,
    disabled_by: null,
    host_id: "dev-nvr",
    connections: [
      {
        device_id: "dev-cam",
        entry_id: "entry-nvr",
        entry_title: "Garage NVR",
        via: "nvr",
        channel: 0,
        host_id: "dev-nvr",
        host_name: "Garage NVR",
        playback_source: true,
        entities: 5,
        disabled_entities: 1,
      },
    ],
    status: { online: true, sleeping: false },
    primary_view: "live",
    snapshot_entity_id: "camera.front_yard_fluent",
    entities: 5,
    disabled_entities: 1,
    ...overrides,
  };
}

export const okDevices = (
  hosts: HostNode[] = [makeHostNode()],
  cameras: CameraNode[] = [makeCamera()],
): DevicesResponse => ({ degraded: false, compat: COMPAT, hosts, cameras });

export function makeEntity(entityId: string, overrides: Partial<EntityInfo> = {}): EntityInfo {
  const [domain = "switch", object = ""] = entityId.split(".");
  return {
    entity_id: entityId,
    domain,
    key: object,
    translation_key: object,
    category: "system",
    entity_category: null,
    disabled_by: null,
    hidden_by: null,
    name: null,
    device_id: "dev-cam",
    sub_device: null,
    ...overrides,
  };
}

export const ENTITIES: EntityInfo[] = [
  makeEntity("light.status_led", { category: "lighting" }),
  makeEntity("switch.record", { category: "recording" }),
  makeEntity("number.motion_sensitivity", { category: "detection" }),
  makeEntity("select.day_night_mode", { category: "image" }),
  makeEntity("button.reboot", { key: "reboot", translation_key: null, category: "system" }),
  makeEntity("sensor.wifi_signal", { category: "system", entity_category: "diagnostic" }),
  makeEntity("switch.ftp_upload", { category: "notifications", disabled_by: "integration" }),
  makeEntity("camera.front_yard_fluent", { key: "sub", translation_key: "sub", category: "streams" }),
];

export function makeConnection(overrides: Partial<DeviceConnection> = {}): DeviceConnection {
  return {
    device_id: "dev-cam",
    entry_id: "entry-nvr",
    entry_title: "Garage NVR",
    via: "nvr",
    channel: 0,
    host_id: "dev-nvr",
    host_name: "Garage NVR",
    playback_source: true,
    details: null,
    entities: ENTITIES,
    ...overrides,
  };
}

export function makeDevice(overrides: Partial<DeviceResponse> = {}): DeviceResponse {
  return {
    degraded: false,
    compat: COMPAT,
    node: makeCamera(),
    connections: [makeConnection()],
    ...overrides,
  };
}

function entry(title: string, overrides: Partial<CatalogEntry> = {}): CatalogEntry {
  return {
    title,
    summary: `${title} summary.`,
    what_it_does: `What ${title} does.`,
    tradeoffs: "",
    related: [],
    requires: "Any Reolink camera",
    impact: "safe",
    sources: [{ title: "HA docs", url: "https://www.home-assistant.io/integrations/reolink/" }],
    verification: "verified",
    verified_against: ["ha_docs"],
    ...overrides,
  };
}

export const CATALOG: Catalog = {
  version: 1,
  categories: [
    { id: "detection", title: "Detection tuning", description: "d" },
    { id: "image", title: "Image", description: "i" },
    { id: "lighting", title: "Lights and night vision", description: "l" },
    { id: "streams", title: "Streams and encoding", description: "s" },
    { id: "recording", title: "Recording", description: "r" },
    { id: "notifications", title: "Notifications and alerts", description: "n" },
    { id: "system", title: "System and maintenance", description: "y" },
  ],
  entities: {
    light: { status_led: entry("Status LED", { related: ["switch.record", "nope.x"] }) },
    switch: {
      record: entry("Record", {
        impact: "disruptive",
        disruptive_when: "off",
        impact_note: "Stops recording.",
      }),
      ftp_upload: entry("FTP upload"),
    },
    number: { motion_sensitivity: entry("Motion sensitivity", { verification: "unverified" }) },
    select: {
      day_night_mode: entry("Day night mode", {
        impact: "disruptive",
        disruptive_when: ["blackwhite"],
        impact_note: "Forced black and white.",
      }),
    },
    button: {
      reboot: entry("Restart", {
        impact: "disruptive",
        disruptive_when: "any",
        impact_note: "Restarts the camera.",
      }),
    },
    sensor: { wifi_signal: entry("Wi-Fi signal", { impact: "read_only" }) },
    camera: { sub: entry("Fluent", { impact: "read_only" }) },
  },
};

export function makeState(
  entityId: string,
  state: string,
  attributes: Record<string, unknown> = {},
): HassEntity {
  return {
    entity_id: entityId,
    state,
    attributes,
    last_changed: "2026-10-17T00:00:00Z",
    last_updated: "2026-10-17T00:00:00Z",
  };
}

export const STATES: HassEntities = {
  "light.status_led": makeState("light.status_led", "on", { supported_color_modes: ["onoff"] }),
  "switch.record": makeState("switch.record", "on"),
  "number.motion_sensitivity": makeState("number.motion_sensitivity", "30", {
    min: 1,
    max: 50,
    step: 1,
    unit_of_measurement: "",
    mode: "auto",
  }),
  "select.day_night_mode": makeState("select.day_night_mode", "auto", {
    options: ["auto", "color", "blackwhite"],
  }),
  "button.reboot": makeState("button.reboot", "unknown"),
  "sensor.wifi_signal": makeState("sensor.wifi_signal", "-45", { unit_of_measurement: "dBm" }),
  "camera.front_yard_fluent": makeState("camera.front_yard_fluent", "idle", {
    entity_picture: "/api/camera_proxy/camera.front_yard_fluent?token=abc",
  }),
  "sensor.elsewhere": makeState("sensor.elsewhere", "1"),
};

export interface ServiceCallRecord {
  domain: string;
  service: string;
  data: Record<string, unknown> | undefined;
  target: { entity_id: string } | undefined;
}

export interface FakeHass extends HomeAssistant {
  sent: Record<string, unknown>[];
  calls: ServiceCallRecord[];
  emit: (event: ProbeEvent) => void;
  emitEvent: (event: unknown) => void;
  unsubscribed: number;
  failSubscribe?: { code: string; message: string };
  failService?: { code: string; message: string };
  responses: Record<string, unknown>;
}

/** A fake hass. callWS answers from `responses` by message type. */
export function makeHass(devices: DevicesResponse, isAdmin = true): FakeHass {
  let listener: ((event: ProbeEvent) => void) | undefined;
  let eventListener: ((event: unknown) => void) | undefined;
  const hass: FakeHass = {
    sent: [],
    calls: [],
    unsubscribed: 0,
    states: { ...STATES },
    responses: {
      "reolink_viewer/devices": devices,
      "reolink_viewer/device": makeDevice(),
      "reolink_viewer/catalog": CATALOG,
      "config/entity_registry/update": { reload_delay: 30 },
    },
    user: { is_admin: isAdmin },
    emit: (event) => listener?.(event),
    emitEvent: (event) => eventListener?.(event),
    callWS: <T>(message: Record<string, unknown>) => {
      hass.sent.push(message);
      return Promise.resolve(hass.responses[String(message.type)] as T);
    },
    callService: (domain, service, data, target) => {
      hass.calls.push({ domain, service, data, target });
      if (hass.failService) {
        // HA rejects with plain {code, message} objects, not Errors.
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
        return Promise.reject(hass.failService);
      }
      return Promise.resolve(undefined);
    },
    connection: {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- HA's signature
      subscribeMessage: <T>(callback: (message: T) => void, message: Record<string, unknown>) => {
        hass.sent.push(message);
        if (hass.failSubscribe) {
          // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
          return Promise.reject(hass.failSubscribe);
        }
        listener = callback as (event: ProbeEvent) => void;
        return Promise.resolve(() => {
          hass.unsubscribed += 1;
          listener = undefined;
          return Promise.resolve();
        });
      },
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- HA's signature
      subscribeEvents: <T>(callback: (event: T) => void, eventType: string) => {
        hass.sent.push({ type: "subscribe_events", event_type: eventType });
        eventListener = callback as (event: unknown) => void;
        return Promise.resolve(() => {
          eventListener = undefined;
          return Promise.resolve();
        });
      },
    },
  };
  return hass;
}

/** HA replaces the hass object (and changed state objects) on every state change. */
export function withStates(hass: FakeHass, changes: HassEntities): FakeHass {
  const next = Object.assign(Object.create(Object.getPrototypeOf(hass) as object) as FakeHass, hass);
  next.states = { ...hass.states, ...changes };
  return next;
}

/** Text of an element including the shadow roots of its descendants. */
export function deepText(root: Node): string {
  const parts: string[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      parts.push(node.textContent ?? "");
      return;
    }
    if (node instanceof Element && node.shadowRoot) walk(node.shadowRoot);
    node.childNodes.forEach(walk);
  };
  walk(root);
  return parts.join("").replace(/\s+/g, " ");
}

/** All elements matching a selector, searching through shadow roots. */
export function deepQueryAll<T extends Element = HTMLElement>(root: Node, selector: string): T[] {
  const found: T[] = [];
  const walk = (node: Node) => {
    if (node instanceof Element) {
      if (node.matches(selector)) found.push(node as T);
      if (node.shadowRoot) walk(node.shadowRoot);
    }
    node.childNodes.forEach(walk);
  };
  walk(root);
  return found;
}

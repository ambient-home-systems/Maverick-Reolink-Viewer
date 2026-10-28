// A fake Home Assistant for the design preview: the owner's setup (an RLN36
// NVR with six cameras, two of them also added directly, an E1 Zoom and a
// wired Video Doorbell), a day of events and recordings, and synthetic camera
// pictures (preview/public/media, from make-media.sh). Nothing here is real
// footage or a real measurement; it exists so every view can be rendered and
// looked at without a Home Assistant.
import categories from "../../custom_components/reolink_viewer/catalog/categories.json";
import settings from "../../custom_components/reolink_viewer/catalog/settings-catalog.json";
import type {
  CameraNode,
  Catalog,
  DeviceConnection,
  DeviceResponse,
  DevicesResponse,
  EntityInfo,
  HassEntities,
  HomeAssistant,
  HostNode,
  LiveCamera,
  LiveConnection,
  Segment,
  StreamEncoding,
  RecentEvent,
  RecentEvents,
  TimelineDay,
  TimelineEvent,
} from "../src/types";

const COMPAT = { ok: true, errors: [], reolink_aio_version: "0.21.18" };
const NOW = Date.parse("2026-10-27T21:24:13-05:00");

interface Cam {
  id: string;
  name: string;
  model: string;
  channel: number | null;
  direct: boolean;
  media: string;
  sub: StreamEncoding;
  main: StreamEncoding;
  warm: boolean;
  records: boolean;
  battery?: boolean;
  doorbell?: boolean;
  snapshot?: boolean;
}

const h264 = (width: number, height: number, frame_rate: number, bit_rate: number): StreamEncoding => ({
  codec: "h264",
  width,
  height,
  frame_rate,
  bit_rate,
});
const h265 = (width: number, height: number, frame_rate: number, bit_rate: number): StreamEncoding => ({
  codec: "h265",
  width,
  height,
  frame_rate,
  bit_rate,
});

const CAMS: Cam[] = [
  { id: "cam-fyr", name: "Front Yard Right", model: "CX410", channel: 0, direct: true, media: "front-yard-right", sub: h264(640, 360, 15, 512), main: h264(2560, 1440, 30, 5120), warm: true, records: true },
  { id: "cam-garage", name: "Garage Camera", model: "RLC-520A", channel: 1, direct: false, media: "garage-camera", sub: h264(640, 480, 15, 512), main: h265(2560, 1920, 30, 6144), warm: true, records: true },
  { id: "cam-fyl", name: "Front Yard Left", model: "CX810", channel: 2, direct: true, media: "front-yard-left", sub: h264(640, 360, 15, 256), main: h265(3840, 2160, 25, 6144), warm: true, records: true },
  { id: "cam-back", name: "Back Yard", model: "Reolink Duo 3 PoE", channel: 3, direct: false, media: "back-yard", sub: h264(1536, 432, 20, 1024), main: h265(7680, 2160, 20, 10240), warm: true, records: true },
  { id: "cam-dogs", name: "Dogs", model: "RLC-520A", channel: 4, direct: false, media: "dogs", sub: h264(640, 480, 10, 256), main: h264(2560, 1920, 30, 6144), warm: true, records: true },
  { id: "cam-hall", name: "Hallway Camera", model: "E1 Pro", channel: 5, direct: false, media: "hallway-camera", sub: h264(640, 360, 7, 160), main: h264(2560, 1440, 25, 3072), warm: true, records: true },
  { id: "cam-laundry", name: "Laundry Room", model: "E1 Zoom", channel: null, direct: true, media: "laundry-room", sub: h264(640, 360, 10, 256), main: h265(3840, 2160, 20, 4096), warm: false, records: false, snapshot: true },
  { id: "cam-door", name: "Doorbell", model: "Reolink Video Doorbell", channel: null, direct: true, media: "doorbell", sub: h264(720, 720, 15, 256), main: h265(2048, 2048, 15, 2048), warm: false, records: true, battery: true, doorbell: true },
];

const NVR: HostNode = {
  id: "dev-nvr",
  kind: "nvr",
  group_id: null,
  device_id: "dev-nvr",
  name: "NVR",
  manufacturer: "Reolink",
  model: "RLN36",
  model_id: null,
  hw_version: "N5MB01",
  sw_version: "v3.6.5.597_26082822",
  area_id: null,
  disabled_by: null,
  entry_id: "entry-nvr",
  entry_title: "NVR",
  camera_ids: CAMS.filter((c) => c.channel !== null).map((c) => c.id),
  entities: 31,
  disabled_entities: 9,
};

function cameraNode(cam: Cam): CameraNode {
  const connections: CameraNode["connections"] = [];
  if (cam.channel !== null) {
    connections.push({ device_id: `${cam.id}-nvr`, entry_id: "entry-nvr", entry_title: "NVR", via: "nvr", channel: cam.channel, host_id: "dev-nvr", host_name: "NVR", playback_source: true, entities: 24, disabled_entities: 6 });
  }
  if (cam.direct) {
    connections.push({ device_id: `${cam.id}-direct`, entry_id: `entry-${cam.id}`, entry_title: cam.name, via: "direct", channel: 0, host_id: null, host_name: null, playback_source: cam.channel === null && cam.records, entities: 38, disabled_entities: 11 });
  }
  return {
    id: cam.id,
    kind: "camera",
    group_id: null,
    device_id: connections[0]?.device_id ?? cam.id,
    name: cam.name,
    manufacturer: "Reolink",
    model: cam.model,
    model_id: null,
    hw_version: "IPC",
    sw_version: "v3.1.0.3429",
    area_id: null,
    disabled_by: null,
    host_id: cam.channel === null ? null : "dev-nvr",
    connections,
    status: { online: true, sleeping: false, is_battery: cam.battery === true, is_doorbell: cam.doorbell === true },
    primary_view: cam.snapshot ? "snapshot" : "live",
    snapshot_entity_id: `camera.${cam.media.replace(/-/g, "_")}_fluent`,
    entities: connections.reduce((n, c) => n + c.entities, 0),
    disabled_entities: connections.reduce((n, c) => n + c.disabled_entities, 0),
  };
}

const DEVICES: DevicesResponse = { degraded: false, compat: COMPAT, hosts: [NVR], cameras: CAMS.map(cameraNode) };

// ---- Settings: a typical camera's entities, keyed as the catalog knows them ----

const SETTING_KEYS: [string, string, string][] = [
  ["number", "motion_sensitivity", "41"],
  ["number", "ai_person_sensitivity", "60"],
  ["number", "ai_vehicle_sensitivity", "55"],
  ["number", "ai_animal_sensitivity", "50"],
  ["number", "ai_person_delay", "1"],
  ["select", "day_night_mode", "auto"],
  ["number", "image_brightness", "128"],
  ["number", "image_contrast", "128"],
  ["number", "image_saturation", "128"],
  ["light", "floodlight", "off"],
  ["light", "status_led", "on"],
  ["number", "ir_brightness", "100"],
  ["switch", "record", "on"],
  ["number", "pre_record_time", "5"],
  ["switch", "email", "off"],
  ["switch", "push_notifications", "on"],
  ["siren", "siren", "off"],
  ["number", "volume", "70"],
  ["button", "reboot", "unknown"],
  ["sensor", "wifi_signal", "-52"],
  ["binary_sensor", "person", "off"],
  ["binary_sensor", "vehicle", "off"],
  ["binary_sensor", "motion", "off"],
  ["camera", "sub", "streaming"],
  ["camera", "main", "streaming"],
];

const categoryOf = (domain: string, key: string): string =>
  (categories.entities as Record<string, Record<string, string> | undefined>)[domain]?.[key] ?? "other";

function entities(prefix: string, deviceId: string): EntityInfo[] {
  return SETTING_KEYS.map(([domain, key]) => ({
    entity_id: `${domain}.${prefix}_${key}`,
    domain,
    key,
    translation_key: key,
    category: categoryOf(domain, key),
    entity_category: domain === "sensor" ? "diagnostic" : domain === "button" ? "config" : null,
    disabled_by: key === "email" ? "integration" : null,
    hidden_by: null,
    name: null,
    device_id: deviceId,
    sub_device: null,
  }));
}

function states(): HassEntities {
  const out: HassEntities = {};
  for (const cam of CAMS) {
    const prefix = cam.media.replace(/-/g, "_");
    for (const [domain, key, state] of SETTING_KEYS) {
      const entityId = `${domain}.${prefix}_${key}`;
      const attributes: Record<string, unknown> =
        domain === "number"
          ? { min: 0, max: key.startsWith("image") ? 255 : 100, step: 1, mode: "slider" }
          : domain === "select"
            ? { options: ["auto", "color", "black&white"] }
            : {};
      out[entityId] = { entity_id: entityId, state, attributes, last_changed: "", last_updated: "" };
    }
    if (cam.warm || cam.channel !== null) {
      const id = `switch.${prefix}_keep_live_view_warm`;
      out[id] = { entity_id: id, state: cam.warm ? "on" : "off", attributes: {}, last_changed: "", last_updated: "" };
    }
  }
  return out;
}

function device(id: string): DeviceResponse {
  const cam = CAMS.find((c) => c.id === id);
  if (!cam) {
    const connection: DeviceConnection = { device_id: "dev-nvr", entry_id: "entry-nvr", entry_title: "NVR", via: "nvr", channel: null, host_id: "dev-nvr", host_name: "NVR", playback_source: false, details: null, entities: entities("nvr", "dev-nvr").slice(18, 20) };
    return { degraded: false, compat: COMPAT, node: NVR, connections: [connection] };
  }
  const node = cameraNode(cam);
  const prefix = cam.media.replace(/-/g, "_");
  return {
    degraded: false,
    compat: COMPAT,
    node,
    connections: node.connections.map((c) => ({
      ...c,
      details: {
        host: {
          model: c.via === "nvr" ? "RLN36" : cam.model,
          model_id: null,
          hardware_version: c.via === "nvr" ? "N5MB01" : "IPC_523128M5MP",
          firmware_version: c.via === "nvr" ? "v3.6.5.597_26082822" : "v3.1.0.3429_2404181313",
          device_type: c.via === "nvr" ? "nvr" : "camera",
          channels: c.via === "nvr" ? 12 : 1,
          stream_protocol: "rtsp",
          baichuan_only: cam.doorbell === true,
          network: { connection: cam.doorbell ? "wifi" : "lan", wifi_signal_dbm: cam.doorbell ? -52 : null },
          ports: { http: { port: 80, https: false }, rtsp: { enabled: true, port: 554 }, rtmp: { enabled: true, port: 1935 }, onvif: { enabled: true, port: 8000 } },
          storage: c.via === "nvr" ? [{ index: 0, type: "hdd", used_percent: 87.2, available: true }] : cam.doorbell ? [{ index: 0, type: "sd", used_percent: 47.16, available: true }] : [],
          cpu_usage: cam.snapshot ? 60 : null,
          capabilities: [],
        },
        channel: {
          channel: c.channel ?? 0,
          name: cam.name,
          model: cam.model,
          model_id: null,
          hardware_version: "IPC",
          firmware_version: "v3.1.0.3429",
          online: true,
          sleeping: false,
          is_battery: cam.battery === true,
          wired_power: cam.battery === true,
          is_doorbell: cam.doorbell === true,
          is_dual_lens: cam.model.includes("Duo"),
          supports_replay: cam.records && cam.channel !== null,
          supports_stream: true,
          encodings: { main: cam.main, sub: cam.sub },
          network: { connection: cam.doorbell ? "wifi" : "lan", wifi_signal_dbm: cam.doorbell ? -52 : null },
          battery: cam.battery ? { percent: 100, temperature_c: 29, status: "chargecomplete" } : null,
          ai_types: ["person", "vehicle", "animal"],
          capabilities: [],
        },
      },
      entities: entities(prefix, c.device_id),
    })),
  };
}

// ---- Live view ----

function liveCamera(cam: Cam): LiveCamera {
  const connection = (via: "nvr" | "direct"): LiveConnection => ({
    connection_id: `${cam.id}-${via}`,
    via,
    entry_title: via === "nvr" ? "NVR" : cam.name,
    is_battery: false,
    streams: {
      sub: { encoding: cam.sub, entity_id: `camera.${cam.media.replace(/-/g, "_")}_fluent`, warm: cam.warm && via === "nvr" },
      main: { encoding: cam.main, entity_id: `camera.${cam.media.replace(/-/g, "_")}_clear`, warm: false },
      ...(cam.doorbell ? {} : { ext: { encoding: null, entity_id: null, warm: false } }),
    },
  });
  const connections = [
    ...(cam.channel !== null ? [connection("nvr")] : []),
    ...(cam.direct ? [connection("direct")] : []),
  ];
  const prefix = cam.media.replace(/-/g, "_");
  return {
    id: cam.id,
    name: cam.name,
    model: cam.model,
    records: cam.records,
    connections,
    keep_warm_entity: cam.channel !== null || cam.snapshot ? `switch.${prefix}_keep_live_view_warm` : null,
    controls: cam.snapshot
      ? { ptz: { left: `button.${prefix}_ptz_left`, right: `button.${prefix}_ptz_right`, up: `button.${prefix}_ptz_up`, down: `button.${prefix}_ptz_down`, stop: `button.${prefix}_ptz_stop` }, zoom: `number.${prefix}_zoom` }
      : cam.id === "cam-fyl"
        ? { floodlight: `light.${prefix}_floodlight`, siren: `siren.${prefix}_siren` }
        : {},
  };
}

// ---- Events and recordings: one day ----

const DAY_START = Date.parse("2026-10-27T00:00:00-05:00");
const at = (h: number, m: number, s = 0) => DAY_START + ((h * 60 + m) * 60 + s) * 1000;

// Hour, minute, length (s), the camera's VOD triggers, which camera.
const EVENTS: [number, number, number, string[], string][] = [
  [6, 12, 40, ["MOTION"], "cam-back"],
  [7, 48, 70, ["MOTION", "VEHICLE"], "cam-fyl"],
  [8, 3, 35, ["MOTION", "PERSON"], "cam-fyr"],
  [9, 31, 95, ["MOTION", "PERSON", "VEHICLE"], "cam-fyl"],
  [11, 20, 25, ["MOTION", "ANIMAL"], "cam-dogs"],
  [12, 55, 60, ["MOTION", "PACKAGE", "PERSON"], "cam-door"],
  [13, 41, 263, ["MOTION"], "cam-garage"],
  [15, 11, 66, ["MOTION"], "cam-dogs"],
  [15, 47, 78, ["MOTION", "ANIMAL", "PERSON"], "cam-back"],
  [17, 2, 50, ["MOTION", "VEHICLE"], "cam-fyl"],
  [18, 25, 43, ["MOTION"], "cam-hall"],
  [19, 40, 30, ["MOTION", "PERSON"], "cam-fyr"],
  [20, 58, 85, ["DOORBELL", "PERSON"], "cam-door"],
];

/** A day's events across cameras, newest first; today's after 19:00 not seen yet. */
function recent(date?: string): RecentEvents {
  const offset = date && date !== "2026-10-27" ? Date.parse("2026-10-27") - Date.parse(date) : 0;
  const events: RecentEvent[] = EVENTS.map(([h, m, len, types, camera], i) => ({
    camera_id: camera,
    start: at(h, m) - offset,
    end: at(h, m) - offset + len * 1000,
    types,
    segment: `seg-${String(i)}`,
    new: !offset && at(h, m) > at(19, 0),
  })).reverse();
  return { events, cameras: CAMS.filter((c) => c.records).length, failed: [], since: at(19, 0), now: NOW };
}

function day(date: string): TimelineDay {
  const offset = date === "2026-10-27" ? 0 : (Date.parse("2026-10-27") - Date.parse(date));
  const events: TimelineEvent[] = EVENTS.map(([h, m, len, types], i) => ({
    start: at(h, m) - offset,
    end: at(h, m) - offset + len * 1000,
    types,
    segment: `seg-${i}`,
    ambiguous: false,
  }));
  const segments: Segment[] = events.map((e, i) => ({
    id: `seg-${i}`,
    start: e.start - 8000,
    end: e.end + 12000,
    triggers: e.types,
    ambiguous: false,
  }));
  return {
    date,
    start: DAY_START - offset,
    end: DAY_START - offset + 86_400_000,
    now: NOW,
    segments,
    events,
    complete: offset > 0,
    events_error: null,
    hint_source: null,
    timing: { cache: "memory", total_ms: 0 },
  };
}

// ---- The fake ----

type Handler = (message: Record<string, unknown>) => unknown;

const pending = <T>(): Promise<T> => new Promise<T>(() => undefined);

export function fakeHass(options: { admin: boolean; dark: boolean }): HomeAssistant {
  const catalog: Catalog = {
    version: settings.version,
    categories: categories.categories,
    entities: settings.entities,
  } as unknown as Catalog;
  const media = (cam: Cam) => `media/${cam.media}.jpg`;
  const handlers: Partial<Record<string, Handler>> = {
    "reolink_viewer/devices": () => DEVICES,
    "reolink_viewer/device": (m) => device(String(m.device_id)),
    "reolink_viewer/catalog": () => catalog,
    "reolink_viewer/live/cameras": () => ({ cameras: CAMS.map(liveCamera) }),
    "reolink_viewer/live/status": () => ({ go2rtc: { state: "running", version: "1.9.14", restarts: 0 }, running: {}, preloaded: [], sessions: 0 }),
    "web_rtc/ice_servers": () => [],
    "reolink_viewer/timeline/days": () => ({ days: [21, 22, 23, 24, 25, 26, 27], timing: { cache: "memory", total_ms: 0 } }),
    "reolink_viewer/timeline/day": (m) => day(String(m.date)),
    "reolink_viewer/timeline/warm": () => ({ cameras: 6 }),
    "reolink_viewer/playback/media_info": () => ({ sub: { codec: "avc1.640016", width: 640, height: 480, audio: "mp4a.40.2" }, main: { codec: "avc1.640032", width: 2560, height: 1920, audio: "mp4a.40.2" } }),
    "reolink_viewer/thumbnail/urls": (m) => {
      const times = (m.times as number[] | undefined) ?? [];
      const camera = CAMS.find((c) => c.id === m.device_id);
      const cams = CAMS.filter((c) => c.records);
      return {
        urls: times.map((time, i) => ({ time, bucket: Number(m.bucket), url: media(camera ?? cams[i % cams.length]) })),
      };
    },
    "reolink_viewer/events/recent": (m) => recent(typeof m.date === "string" ? m.date : undefined),
    "reolink_viewer/events/days": () => ({ days: [21, 22, 23, 24, 25, 26, 27], failed: [] }),
    "reolink_viewer/events/seen": () => ({}),
    "reolink_viewer/playback/check_reports": () => ({ reports: [] }),
    "reolink_viewer/live/soak": () => ({ sample_s: 300, keep_s: 129_600, warmup_s: 300, started_at: NOW - 3_600_000, run: null, samples: [], now: null }),
  };
  const hass: HomeAssistant = {
    callWS: <T>(message: Record<string, unknown>): Promise<T> => {
      const handler = handlers[String(message.type)];
      // Live and playback streams never start here: tiles stay on their picture.
      if (!handler) return pending<T>();
      return Promise.resolve(handler(message) as T);
    },
    callService: () => Promise.resolve(undefined),
    connection: {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- HA's signature
      subscribeMessage: <T>(callback: (message: T) => void, message: Record<string, unknown>) => {
        if (message.type === "reolink_viewer/live/images") {
          const images = Object.fromEntries(CAMS.map((c) => [c.id, { url: media(c), taken: NOW - 125_000 }]));
          setTimeout(() => {
            callback({ images } as T);
          }, 0);
        }
        return Promise.resolve(() => Promise.resolve());
      },
      subscribeEvents: () => Promise.resolve(() => Promise.resolve()),
    },
    states: states(),
    user: { is_admin: options.admin, name: "Owner" },
    themes: { darkMode: options.dark },
    config: { time_zone: "America/Chicago" },
    locale: { language: "en" },
  };
  return hass;
}

export const PREVIEW_NOW = NOW;

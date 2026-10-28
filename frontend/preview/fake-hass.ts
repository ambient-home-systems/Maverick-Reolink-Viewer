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
/** What the compatibility check finds after an update that changed the integration (?degraded=changed). */
const CHANGED = { ok: false, errors: ["Reolink runtime_data.host has no 'api'"], reolink_aio_version: "0.22.0" };
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

/** Disks that are not ready: "dev-nvr" for the NVR's, or a camera's id for its SD card (?disk=). */
let badDisks: readonly string[] = [];
/** Cameras Home Assistant cannot reach (?offline=). */
let offlineCams: readonly string[] = [];
/**
 * Reolink Viewer cannot reach the cameras (?degraded=): an update changed the
 * Reolink integration, it is not running, or no devices are set up yet.
 */
let trouble: "changed" | "stopped" | "none" | undefined;

/** Whether the disk keeping a camera's recordings is ready. */
function diskOf(cam: Cam): "ready" | "not_ready" {
  return badDisks.includes(cam.channel === null ? cam.id : "dev-nvr") ? "not_ready" : "ready";
}

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
    status: { online: !offlineCams.includes(cam.id), sleeping: false, is_battery: cam.battery === true, is_doorbell: cam.doorbell === true },
    primary_view: cam.snapshot ? "snapshot" : "live",
    recordings: cam.records ? { where: "playable", storage: diskOf(cam) } : { where: "none", storage: null },
    snapshot_entity_id: `camera.${cam.media.replace(/-/g, "_")}_fluent`,
    entities: connections.reduce((n, c) => n + c.entities, 0),
    disabled_entities: connections.reduce((n, c) => n + c.disabled_entities, 0),
  };
}

function devices(): DevicesResponse {
  if (trouble === "none") return { degraded: true, compat: COMPAT, hosts: [], cameras: [] };
  const cameras = CAMS.map(cameraNode);
  if (!trouble) return { degraded: false, compat: COMPAT, hosts: [NVR], cameras };
  // From the device registry only: nothing known of their connections or recordings.
  return {
    degraded: true,
    compat: trouble === "changed" ? CHANGED : COMPAT,
    hosts: [NVR],
    cameras: cameras.map((c) => ({
      ...c,
      connections: c.connections.map((conn) => ({ ...conn, playback_source: false })),
      recordings: { where: "none", storage: null },
    })),
  };
}

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

function states(offline: readonly string[] = []): HassEntities {
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
    const snapshot = `camera.${prefix}_fluent`;
    out[snapshot] = offline.includes(cam.id)
      ? // Home Assistant cannot reach it: since 25 minutes ago.
        { entity_id: snapshot, state: "unavailable", attributes: {}, last_changed: new Date(Date.now() - 25 * 60_000).toISOString(), last_updated: "" }
      : { entity_id: snapshot, state: "idle", attributes: { entity_picture: `media/${cam.media}.jpg` }, last_changed: "", last_updated: "" };
    if (cam.warm || cam.channel !== null) {
      const id = `switch.${prefix}_keep_live_view_warm`;
      out[id] = { entity_id: id, state: cam.warm ? "on" : "off", attributes: {}, last_changed: "", last_updated: "" };
    }
  }
  return out;
}

function device(id: string): DeviceResponse {
  const cam = CAMS.find((c) => c.id === id);
  if (trouble) {
    const node = devices().cameras.find((c) => c.id === id) ?? NVR;
    const connections = node.kind === "camera" ? node.connections : [];
    return {
      degraded: true,
      compat: trouble === "changed" ? CHANGED : COMPAT,
      node,
      connections: connections.map((c) => ({ ...c, details: null, entities: entities(cam?.media.replace(/-/g, "_") ?? "nvr", c.device_id) })),
    };
  }
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
          storage: c.via === "nvr" ? [{ index: 0, type: "HDD", used_percent: 87.2, available: !badDisks.includes("dev-nvr") }] : cam.doorbell ? [{ index: 0, type: "SD", used_percent: 47.16, available: diskOf(cam) === "ready" }] : [],
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
          online: !offlineCams.includes(cam.id),
          sleeping: false,
          is_battery: cam.battery === true,
          wired_power: cam.battery === true,
          is_doorbell: cam.doorbell === true,
          is_dual_lens: cam.model.includes("Duo"),
          supports_replay: cam.records,
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
    status_entity: `camera.${cam.media.replace(/-/g, "_")}_fluent`,
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

// ---- Checks: a live check saved on the iPhone, and a soak run half-way ----

const LIVE_REPORT = [
  "Reolink Viewer live check v0.21.0 · iPhone app, Wi-Fi (local) · 10/27/2026, 8:10:00 PM",
  "Browser: iOS 27.0, Companion app 2026.10.1 · page LAN over https · screen 402×874 @3x",
  "",
  "In short: All 8 cameras started live video, typically in 1.4 s; 1 is slow: Back Yard.",
  "- Good: Front Yard Right: live video starts in 1.1 s; full screen in HD in 1.6 s.",
  "- Good: Garage Camera: live video starts in 1.3 s; full screen in HD in 1.9 s.",
  "- Good: Front Yard Left: live video starts in 1.2 s; full screen in HD in 2.4 s.",
  "- Slow: Back Yard: live video starts in 4.6 s; full screen in HD in 5.3 s. What to do: Turn on its “keep live view warm” switch in Home Assistant to make it start faster.",
  "- Good: Dogs: live video starts in 1.4 s; full screen in HD in 1.8 s.",
  "- Good: Hallway Camera: live video starts in 1.5 s; full screen in HD in 2.0 s.",
  "- Fine: Laundry Room: live video starts in 2.6 s.",
  "- Fine: Doorbell: live video starts in 3.1 s. What to do: Battery cameras wake up before they stream, so a few seconds is normal.",
  "- Good: A still picture of each camera shows in about 0.3 s, while its live video starts.",
  "- Note: Compared with Home Assistant's own camera view: this viewer was quicker on 7 of 8 streams (typically 1.4 s against 3.2 s).",
  "",
  "Summary:",
  "- WebRTC connected 16 of 16 sessions (16× host/udp ↔ host/udp)",
].join("\n");

const PLAYBACK_REPORT = [
  "Reolink Viewer playback check v0.3.2 · iPhone app, Wi-Fi (local) · Front Yard Right · 10/27/2026, 8:30:00 PM",
  "",
  "In short: Front Yard Right's recordings play on this device, but 1 thing is slow.",
  "- Good: Recordings appear on the timeline in 0.3 s for today; an earlier day takes 1.6 s the first time and 0.2 s after that.",
  "- Good: Opening an event starts its video in about 0.7 s.",
  "- Slow: Jumping into the middle of a long recording starts in 4.4 s; the first time, 13 s, while the recorder sends it over.",
  "- Good: It plays straight on from one recording to the next, without a noticeable pause.",
  "- Good: Slow motion and fast forward (0.5× to 8×) play smoothly.",
  "- Good: Switching to HD takes 2.1 s and keeps your place; back to SD, 0.3 s.",
  "- Good: Recordings come from Home Assistant at 48 Mbit/s: plenty for HD.",
  "",
  "Summary:",
  "- Timeline: today 312 ms ✓",
].join("\n");

function soak(): unknown {
  const now = Date.now();
  const started = now - 14 * 3_600_000;
  const samples = Array.from({ length: 168 }, (_, i) => ({
    at: started + (i + 1) * 300_000,
    go2rtc: { state: "running", restarts: 0, memory_kb: 43_008 + (i % 7) * 120 },
    webrtc_sessions: 0,
    feeds: { feeds: 6, warm: 6, viewers: i % 12 < 4 ? 6 : 0, ends: 1 },
    hosts: [
      { name: "NVR", streams: 6, limit: 7, waiting: 0, cpu: 28 + (i % 5) },
      { name: "Doorbell", streams: 0, limit: 2, waiting: 0, cpu: null },
    ],
    battery: [{ camera: "Doorbell", sleeping: true, watched: false }],
  }));
  const tiles = Object.fromEntries(CAMS.map((c) => [c.name, { plays: 9, drops: c.id === "cam-dogs" ? 1 : 0, failures: 0 }]));
  return {
    sample_s: 300,
    keep_s: 129_600,
    warmup_s: 300,
    started_at: started - 300_000,
    run: { started_at: started, opens: 4, open_ms: 6.5 * 3_600_000, visible_ms: 5.2 * 3_600_000, tiles, devices: { "Mac · Chrome": now - 60_000, "iPhone · Safari": now - 3 * 3_600_000 } },
    samples,
    now: null,
  };
}

/** What a request fails with when the preview is told to (?fail=). */
const FAILURES: Record<string, { code: string; message: string }> = {
  board: { code: "not_loaded", message: "Reolink Viewer is not loaded" },
  events: { code: "not_loaded", message: "Reolink Viewer is not loaded" },
  day: { code: "search_failed", message: "day search failed: Timeout error" },
  tiles: { code: "stream_failed", message: "streams: dial tcp 192.168.1.31:554: i/o timeout" },
  // Reolink Viewer updated, Home Assistant not restarted since.
  devices: { code: "unknown_command", message: "Unknown command." },
};
const REQUESTS: Record<string, string> = {
  "reolink_viewer/live/cameras": "board",
  "reolink_viewer/events/recent": "events",
  "reolink_viewer/timeline/day": "day",
  "reolink_viewer/live/mse": "tiles",
  "reolink_viewer/live/webrtc": "tiles",
  "reolink_viewer/devices": "devices",
};

export function fakeHass(options: {
  admin: boolean;
  dark: boolean;
  offline?: readonly string[];
  disks?: readonly string[];
  degraded?: string | null;
  fail?: readonly string[];
}): HomeAssistant {
  badDisks = options.disks ?? [];
  offlineCams = options.offline ?? [];
  trouble = options.degraded === "changed" || options.degraded === "stopped" || options.degraded === "none" ? options.degraded : undefined;
  const fails = options.fail ?? [];
  /** The error a request fails with, when the preview is told to fail it. */
  const failure = (type: unknown) => {
    const what = REQUESTS[String(type)];
    return what && fails.includes(what) ? FAILURES[what] : undefined;
  };
  const catalog: Catalog = {
    version: settings.version,
    categories: categories.categories,
    entities: settings.entities,
  } as unknown as Catalog;
  const media = (cam: Cam) => `media/${cam.media}.jpg`;
  const handlers: Partial<Record<string, Handler>> = {
    "reolink_viewer/devices": devices,
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
    "reolink_viewer/playback/check_reports": () => ({
      reports: [
        { id: "live-1", setup: "Live check · iPhone app, Wi-Fi (local)", text: LIVE_REPORT, done: true, updated: "2026-10-28T01:10:00Z" },
        { id: "play-1", setup: "iPhone app, Wi-Fi (local)", text: PLAYBACK_REPORT, done: true, updated: "2026-10-28T01:30:00Z" },
      ],
    }),
    "reolink_viewer/live/soak": soak,
  };
  const hass: HomeAssistant = {
    callWS: <T>(message: Record<string, unknown>): Promise<T> => {
      const handler = handlers[String(message.type)];
      const failed = failure(message.type);
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- HA rejects with {code, message}
      if (failed) return Promise.reject(failed);
      // Live and playback streams never start here: tiles stay on their picture.
      if (!handler) return pending<T>();
      return Promise.resolve(handler(message) as T);
    },
    callService: () => Promise.resolve(undefined),
    connection: {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- HA's signature
      subscribeMessage: <T>(callback: (message: T) => void, message: Record<string, unknown>) => {
        const failed = failure(message.type);
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- HA rejects with {code, message}
        if (failed) return Promise.reject(failed);
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
    states: states(options.offline),
    user: { is_admin: options.admin, name: "Owner" },
    themes: { darkMode: options.dark },
    config: { time_zone: "America/Chicago" },
    locale: { language: "en" },
  };
  return hass;
}

export const PREVIEW_NOW = NOW;

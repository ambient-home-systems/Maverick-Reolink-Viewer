// Minimal slices of HA's frontend types, and the shapes of our websocket API.

export interface HassUser {
  is_admin: boolean;
  name?: string;
}

export type Unsubscribe = () => Promise<void>;

export interface HassConnection {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- HA's signature
  subscribeMessage<T>(
    callback: (message: T) => void,
    message: Record<string, unknown>,
  ): Promise<Unsubscribe>;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- HA's signature
  subscribeEvents<T>(callback: (event: T) => void, eventType: string): Promise<Unsubscribe>;
}

export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
}

export type HassEntities = Record<string, HassEntity | undefined>;

export interface ServiceTarget {
  entity_id: string;
}

export interface HassConfig {
  time_zone?: string;
}

export interface HassLocale {
  language?: string;
}

export interface HassThemes {
  /** Home Assistant is showing its dark theme. */
  darkMode?: boolean;
}

export interface HomeAssistant {
  callWS<T>(message: Record<string, unknown>): Promise<T>;
  /** fetch with the user's access token (refreshed as needed). */
  fetchWithAuth?(path: string, init?: RequestInit): Promise<Response>;
  callService(
    domain: string,
    service: string,
    serviceData?: Record<string, unknown>,
    target?: ServiceTarget,
    notifyOnError?: boolean,
  ): Promise<unknown>;
  connection: HassConnection;
  states: HassEntities;
  user?: HassUser;
  config?: HassConfig;
  locale?: HassLocale;
  themes?: HassThemes;
}

export interface CompatReport {
  ok: boolean;
  errors: string[];
  reolink_aio_version: string | null;
}

// ---- Device model (reolink_viewer/devices, reolink_viewer/device) ----

export interface StreamEncoding {
  codec: string | null;
  bit_rate: number | null;
  frame_rate: number | null;
  /** The configured picture size, when the device reported it. */
  width?: number | null;
  height?: number | null;
}

export type DeviceKind = "camera" | "nvr" | "hub";

interface RegistryInfo {
  device_id: string;
  name: string | null;
  manufacturer: string | null;
  model: string | null;
  model_id: string | null;
  hw_version: string | null;
  sw_version: string | null;
  area_id: string | null;
  disabled_by: string | null;
}

interface EntityCounts {
  entities: number;
  disabled_entities: number;
}

export interface Connection extends EntityCounts {
  device_id: string;
  entry_id: string;
  entry_title: string;
  via: "nvr" | "direct";
  channel: number | null;
  host_id: string | null;
  host_name: string | null;
  playback_source: boolean;
}

export interface HostNode extends RegistryInfo, EntityCounts {
  id: string;
  kind: "nvr" | "hub";
  group_id: null;
  entry_id: string;
  entry_title: string;
  camera_ids: string[];
}

export interface CameraStatus {
  online?: boolean;
  sleeping?: boolean;
  is_battery?: boolean;
  is_doorbell?: boolean;
}

export interface CameraNode extends RegistryInfo, EntityCounts {
  id: string;
  kind: "camera";
  group_id: string | null;
  host_id: string | null;
  connections: Connection[];
  status: CameraStatus;
  /**
   * Where its recordings are: playable here, kept where this cannot play
   * them (a battery camera's SD card), or nowhere; and the state of the disk
   * or SD card keeping them.
   */
  recordings?: { where: "playable" | "elsewhere" | "none"; storage: "ready" | "not_ready" | "none" | null };
  primary_view: "live" | "snapshot";
  snapshot_entity_id: string | null;
}

export type DeviceNode = HostNode | CameraNode;

export interface DevicesResponse {
  degraded: boolean;
  compat: CompatReport;
  /** The Reolink Viewer Home Assistant runs (absent before 0.61.1). */
  version?: string;
  hosts: HostNode[];
  cameras: CameraNode[];
}

export interface PortInfo {
  enabled: boolean | null;
  port: number | null;
}

export interface StorageInfo {
  index: number;
  type: string | null;
  used_percent: number | null;
  available: boolean | null;
}

export interface NetworkInfo {
  connection: "wifi" | "lan";
  wifi_signal_dbm: number | null;
}

export interface HostDetails {
  model: string | null;
  model_id: string | null;
  hardware_version: string | null;
  firmware_version: string | null;
  device_type: DeviceKind;
  channels: number;
  stream_protocol: string | null;
  baichuan_only: boolean;
  network: NetworkInfo;
  ports: {
    http: { port: number | null; https: boolean | null };
    rtsp: PortInfo;
    rtmp: PortInfo;
    onvif: PortInfo;
  };
  storage: StorageInfo[];
  cpu_usage: number | null;
  capabilities: string[];
}

export interface ChannelDetails {
  channel: number;
  name: string;
  model: string;
  model_id: string | null;
  hardware_version: string;
  firmware_version: string;
  online: boolean;
  sleeping: boolean;
  is_battery: boolean;
  /** A battery camera running on wired power (it never sleeps). */
  wired_power?: boolean;
  is_doorbell: boolean;
  is_dual_lens: boolean;
  supports_replay: boolean;
  supports_stream: boolean;
  encodings: { main: StreamEncoding; sub: StreamEncoding };
  network: NetworkInfo;
  battery: { percent: number | null; temperature_c: number | null; status: string | null } | null;
  ai_types: string[];
  capabilities: string[];
}

export interface DeviceDetails {
  host: HostDetails;
  channel: ChannelDetails | null;
}

export interface EntityInfo {
  entity_id: string;
  domain: string;
  key: string | null;
  translation_key: string | null;
  category: string;
  entity_category: string | null;
  disabled_by: string | null;
  hidden_by: string | null;
  name: string | null;
  device_id: string | null;
  sub_device: string | null;
}

export interface DeviceConnection extends Partial<Omit<Connection, "entities">> {
  device_id: string;
  entry_title: string;
  via: "nvr" | "direct";
  details: DeviceDetails | null;
  entities: EntityInfo[];
}

export interface DeviceResponse {
  degraded: boolean;
  compat: CompatReport;
  node: DeviceNode;
  connections: DeviceConnection[];
}

// ---- Settings catalog (reolink_viewer/catalog) ----

export type Impact = "read_only" | "safe" | "disruptive";

export interface CatalogSource {
  title: string;
  url: string;
}

export interface CatalogEntry {
  title: string;
  summary: string;
  what_it_does: string;
  tradeoffs: string;
  related: string[];
  requires: string;
  impact: Impact;
  disruptive_when?: "on" | "off" | "any" | string[];
  impact_note?: string;
  sources: CatalogSource[];
  verification: "verified" | "unverified";
  verified_against: string[];
  notes?: string;
}

export interface Category {
  id: string;
  title: string;
  description: string;
}

export interface Catalog {
  version: number;
  categories: Category[];
  entities: Record<string, Record<string, CatalogEntry> | undefined>;
}

// ---- Probe ----

export interface ProbeOptions {
  include_battery: boolean;
  concurrency_test: boolean;
  max_streams: number;
  /** Recording playback check (Phase 2 gate). */
  playback_test?: boolean;
  playback_only?: boolean;
  playback_concurrency_test?: boolean;
  playback_max_streams?: number;
  /** Baichuan replay and download check (Phase 5a, 5b step 1). */
  baichuan_test?: boolean;
  baichuan_only?: boolean;
  baichuan_streams?: Stream[];
  baichuan_download?: boolean;
  baichuan_session?: boolean;
  /** Scrub cuts on the sub stream (Phase 10 step 0). */
  baichuan_scrub?: boolean;
  baichuan_cameras?: string;
  baichuan_hold?: number;
  baichuan_cut?: number;
  /** Events of cameras that record but cannot be played (Phase 6, step 1). */
  events_test?: boolean;
  events_only?: boolean;
  /** Factory values of each camera's settings (Phase 11 step 5, research). */
  factory_test?: boolean;
  factory_only?: boolean;
}

export type ProbeReport = Record<string, unknown>;

export type ProbeEvent =
  | { type: "progress"; message: string }
  | { type: "result"; report: ProbeReport }
  | { type: "error"; message: string };

export interface EntityRegistryUpdateResult {
  require_restart?: boolean;
  reload_delay?: number;
}

// ---- Playback (reolink_viewer/timeline/*, reolink_viewer/playback/*) ----
// All times are UTC epoch milliseconds.

export type Stream = "sub" | "main";

export interface Timing {
  cache?: string;
  search_ms?: number;
  total_ms?: number;
  [key: string]: unknown;
}

export interface Segment {
  id: string;
  start: number;
  end: number;
  triggers: string[];
  ambiguous: boolean;
}

export interface TimelineEvent {
  start: number;
  end: number;
  types: string[];
  segment: string | null;
  ambiguous: boolean;
}

/** One event of one camera, in today's events across cameras (events/recent). */
export interface RecentEvent {
  camera_id: string;
  start: number;
  end: number;
  types: string[];
  segment: string | null;
  /** Not yet opened by this Home Assistant user, and after their first look. */
  new: boolean;
  /** Seen only by the detection journal (Phase 8.3): no event of the camera's matched it. */
  journal?: boolean;
}

export interface RecentEvents {
  /** Newest first. */
  events: RecentEvent[];
  /** Cameras that record, asked. */
  cameras: number;
  /** Cameras whose search failed (their cached events, if any, still show). */
  failed: { camera_id: string; error: string }[];
  /** Events after this are new (this user's first look, or "all seen"). */
  since: number;
  now: number;
}

export interface TimelineDay {
  date: string;
  start: number;
  end: number;
  now: number;
  segments: Segment[];
  events: TimelineEvent[];
  complete: boolean;
  events_error: string | null;
  hint_source: string | null;
  timing: Timing;
}

export interface TimelineDays {
  days: number[];
  timing: Timing;
}

export interface MediaInfo {
  codec: string;
  width: number | null;
  height: number | null;
  audio: string | null;
}

export interface CacheStatus {
  complete: boolean;
  bytes: number;
  error: string | null;
  [key: string]: unknown;
}

export interface PlaybackUrl {
  /** The file player's signed URL (playback/url). */
  url?: string;
  /** The MSE player's fragment path (playback/mse), fetched with HA's auth. */
  base?: string;
  clip_url: string;
  stream: Stream;
  segment_id: string;
  start: number;
  end: number;
  media: MediaInfo | null;
  cache: CacheStatus;
  /** The file the URL serves: the plain copy (made on demand) or the original. */
  file?: "plain" | "original";
  expires_in: number;
  /** The server's time to the answer (``total_ms``). */
  timing?: Timing;
}

/** An event saved as an MP4 (playback/save_event, Phase 11 step 2). */
export interface SavedClip {
  /** Signed: the file, as a download, for `expires_in` seconds. */
  url: string;
  /** `<camera>-<date>-<time>-<type>.mp4` */
  name: string;
  size: number;
  /** What it holds (UTC ms): from the key frame at or before the margin before the event. */
  start: number;
  end: number;
  /** A plain MP4 (else fragmented, as ffmpeg could not rewrite it). */
  plain: boolean;
  expires_in: number;
  timing?: Timing;
}

export interface CacheStatusResult {
  /** The download of the copy a URL serves (null once evicted). */
  cache: CacheStatus | null;
  expected_bytes: number;
}

export interface ThumbnailUrl {
  time: number;
  bucket: number;
  url: string;
}

export type MediaInfoResponse = Record<Stream, MediaInfo | null>;

// ---- Live view (reolink_viewer/live/*) ----

export type LiveStreamKind = "sub" | "main" | "ext";
export const LIVE_STREAMS: readonly LiveStreamKind[] = ["sub", "main", "ext"];

export interface LiveConnection {
  /** The connection's device id: what the live commands take. */
  connection_id: string;
  via: "nvr" | "direct";
  entry_title: string;
  /** Its host's stream budget (the NVR, or the camera itself), as a key that names nothing. */
  host?: string;
  /** How many of the Wall's tiles its host plays in HD at once (Phase 9 step 3). */
  hd_tiles?: number;
  is_battery: boolean;
  /** An entity of the camera: "unavailable" while Home Assistant cannot reach it. */
  status_entity?: string | null;
  /**
   * Per stream the connection can serve (no ext without HTTP-FLV): its
   * configured encoding (none for ext), HA's camera entity showing it, and
   * whether it is kept warm (then it plays over MSE from its cached key frame).
   */
  streams: Partial<Record<LiveStreamKind, LiveStreamInfo>>;
}

export interface LiveStreamInfo {
  encoding: StreamEncoding | null;
  entity_id: string | null;
  warm?: boolean;
}

/** The detection journal (Phase 8, journal/status): off, or what it holds. */
/** The learning check (Phase 8's hand checks, automated): reolink_viewer/unusual/check. */
export type UnusualCheck =
  | { enabled: false }
  | {
      enabled: true;
      built: boolean;
      /** The period compared (epoch ms): from when the log of fired events began, at most a week. */
      since: number;
      until: number;
      /** The house-wide signals chosen: their state now, and the changes learned. */
      signals: { entity_id: string; name: string; state: string | null; changes: number }[];
      /** The panel's marks, each with what fired for it. */
      marks: {
        kind: string;
        start: number;
        end: number | null;
        camera: string;
        cameras: string[] | null;
        reason: string | null;
        /** How many events fired for it (one is right), the first's delay (s) and when it came. */
        fired: number;
        /** How many were kept quiet, as part of a visit already said (v0.63.14). */
        quiet?: number;
        delay: number | null;
        when: "start" | "end" | "late" | null;
        automations: string[];
      }[];
      /**
       * Events fired for no mark; `relearned` when it fired before the model the
       * marks are scored with was built (the nightly relearn may judge it otherwise).
       */
      unmarked: { camera: string; kind: string; start: number; delay: number; relearned?: boolean }[];
      /** When the model the panel's marks are scored with was built (epoch ms, v0.63.13). */
      built_at?: number | null;
      /** The automations listening, and how. */
      automations: { entity_id: string; name: string; how: string; on: boolean; last_triggered: string | null }[];
      /** Seconds from a detection's start within which its event should fire. */
      prompt_s: number;
    };

export type JournalStatus =
  | { enabled: false }
  | {
      enabled: true;
      /** When it was started (epoch ms). */
      created: number;
      /** Changes imported from Home Assistant's history at the start. */
      imported: number;
      changes: number;
      detections: number;
      sensors: number;
      bytes: number;
      cameras: { id: string; name: string; changes: number; detections: number; first: number; last: number }[];
      /** The house-wide signals learned with (chosen in the options), as Home Assistant names them. */
      signals?: { entity_id: string; name: string; changes: number; first: number; last: number }[];
      /** Phase 8 step 2: what the model makes of it (absent on an older server). */
      unusual?: UnusualStatus;
    };

/** One signal's part in how unusual an event is (unusual/score.py's Term). */
export interface UnusualTerm {
  /** kind, clock, solar, duration, predecessor, weekend or signal. */
  name: string;
  label: string;
  subject: string;
  /** In nats: positive is rarer than chance, negative more common. */
  contribution: number;
  /** How many times it was seen before. */
  seen: number;
}

/** A journal event and its score (unusual/model.py's mark_payload). */
export interface UnusualEvent {
  camera: string;
  kind: string;
  start: number;
  end: number | null;
  score: number;
  /** The line it was measured against; null while its camera learns. */
  line: number | null;
  unusual: boolean;
  reason: string;
  terms: UnusualTerm[];
  /** unusual/events: its incident (the same kind on several cameras within a minute). */
  incident?: number;
  /** A mark in the status: every camera that saw its incident. */
  cameras?: string[];
  /** A mark: the cameras' ids, as `cameras` names them. */
  camera_ids?: string[];
  /** A mark (unusual/marks): every event of its incident, on every camera. */
  members?: { camera: string; start: number; end: number | null }[];
}

/** The incidents marked unusual in a window (unusual/marks), for the panel (Phase 8.3). */
export interface UnusualMarks {
  /** Learn what is normal is on. */
  enabled: boolean;
  /** The model is built (it learns for a minute or so after a start). */
  built?: boolean;
  /** Oldest first. */
  marks: UnusualEvent[];
  /** Whether each camera marks yet, or what it is short of. */
  cameras: Record<string, UnusualCamera>;
}

/** One value of a learned distribution (unusual/profile), commonest first. */
export interface LearnedValue {
  value: string;
  /** As read: "About 8 s", "Front Yard Left, within 30 s", "Fri". */
  label: string;
  /** How many times it was seen (unweighted). */
  events: number;
  /** Its recency-weighted share, 0–1. */
  share: number;
}

/** What a camera has learned about one kind of thing it sees. */
export interface LearnedKind {
  kind: string;
  events: number;
  days: number;
  /** Each hour of the day, 0–23. */
  clock: { hour: number; events: number; weight: number }[];
  duration: LearnedValue[];
  predecessor: LearnedValue[];
  /** Monday to Sunday. */
  day_of_week: LearnedValue[];
  /** Each house-wide signal: what it stood at when this was seen (unread states left out). */
  signals?: { entity_id: string; label: string; values: LearnedValue[] }[];
}

/** What one camera has learned (unusual/profile, Phase 8.3). */
export interface LearnedProfile {
  enabled: boolean;
  built?: boolean;
  state?: UnusualCamera;
  /** Seen this many times, a value is known there and no longer stands out. */
  known_after?: number;
  kinds?: LearnedKind[];
}

export interface UnusualCamera {
  marking: boolean;
  days: number;
  events: number;
  needs_days: number;
  needs_events: number;
  line: number | null;
}

export type UnusualSensitivity = "few" | "balanced" | "many";
export type UnusualScope = "together" | "host" | "camera";

/** The model's state and its marks of the last days (journal/status's `unusual`). */
export interface UnusualStatus {
  /** When it was last built (epoch ms); null before its first build. */
  built: number | null;
  built_in_s: number;
  /** Of that, what its thread computed (the rest it waited, behind others). */
  computed_s?: number;
  sensitivity: UnusualSensitivity;
  scope: UnusualScope;
  floor: number;
  /** The daily cap's line; null when the property is under its daily marks. */
  cap: number | null;
  cameras: Record<string, UnusualCamera>;
  days: number;
  events: number;
  marks: number;
  /** What the camera's own line and the floor alone would have marked. */
  uncapped: number;
  per_day: Record<string, number>;
  by_kind: Record<string, number>;
  /** What stood out most in each mark, by signal name. */
  by_reason: Record<string, number>;
  /** The latest marks, newest first. */
  latest: UnusualEvent[];
}

/** One thing a dashboard card's page saw (card/tablet.ts, live/card_log). */
export interface TabletEvent {
  at: number;
  what: string;
  card?: string;
  detail?: string;
}

/** What the dashboard cards on one device saw (live/card_log). */
export interface CardLogDevice {
  device: string;
  /** When it last reported (ISO 8601, UTC). */
  updated: string;
  events: TabletEvent[];
}

export interface LiveCamera {
  id: string;
  name: string;
  model: string | null;
  /** An NVR or its SD card keeps its recordings (playable here or not). */
  records: boolean;
  connections: LiveConnection[];
  /** Its "keep live view warm" switch (mains-powered cameras only). */
  keep_warm_entity?: string | null;
  /** Home Assistant's entities to control it with while watching. */
  controls?: LiveControls;
  /** A doorbell's visitor sensor: on while it rings. */
  visitor_entity?: string | null;
  /** Its detection sensors (Phase 9 step 4), by entity id, with the event type each stands for. */
  detection?: Record<string, string>;
}

/** A PTZ move: a press of its button starts it, PTZ stop ends it. */
export type PtzMove =
  | "left"
  | "right"
  | "up"
  | "down"
  | "left_up"
  | "left_down"
  | "right_up"
  | "right_down"
  | "zoom_in"
  | "zoom_out";

/** A camera's controls, as entity ids of the Reolink integration's entities. */
export interface LiveControls {
  /** PTZ buttons by move, with "stop" (always there when PTZ is). */
  ptz?: Partial<Record<PtzMove | "stop", string>>;
  preset?: string;
  zoom?: string;
  focus?: string;
  siren?: string;
  floodlight?: string;
}

export interface Go2rtcStatus {
  state: "stopped" | "starting" | "running" | "restarting" | "failed";
  version: string | null;
  /** "system" (Home Assistant's own binary) or "downloaded". */
  binary: string | null;
  error: string | null;
  restarts: number;
  generation: number;
  started_at: string | null;
  webrtc_port: number;
  /** Its last log lines (admins only), addresses and URLs removed. */
  log?: string[];
}

export interface LiveStatus {
  go2rtc: Go2rtcStatus;
  /** Running streams (go2rtc name → holds). */
  running: Record<string, number>;
  preloaded: string[];
  sessions: number;
}

/** A stream's key-frame cache (its shared MSE feed). */
export interface LiveCacheState {
  viewers: number;
  warm: boolean;
  mime: string;
  key_frame_age_ms: number | null;
  /** Between the last two key frames: the camera's key-frame interval. */
  key_interval_ms: number | null;
  /** Media kept since the last key frame. */
  cached_ms: number | null;
  cached_bytes: number;
  /**
   * The init segment's parameter sets (go2rtc takes them from the stream's
   * description) against the first key frame's: "rebuilt" when they differed
   * and the init segment was rebuilt from the key frame's, "differ" when it
   * could not be, "none" if the key frame carries none; null before a key
   * frame, or without H.264/H.265 video.
   */
  parameter_sets: "same" | "rebuilt" | "differ" | "none" | "unknown" | null;
  /**
   * H.264: "decode order" (POC type 2), "reorder N" (the stream's own limit) or
   * "limit added" (the SPS said nothing; the relay's says decode order, or
   * Chrome on macOS holds up to 16 frames back over MSE). Null otherwise.
   */
  frame_order: string | null;
  /** Since this feed opened (a warm feed younger than expected was replaced). */
  age_ms: number;
  /** The stream's feeds that ended on their own (go2rtc dropped them), and why. */
  ends: number;
  last_end: string | null;
}

export interface LiveStreamState {
  /** Null: go2rtc does not know the stream yet. */
  state: { active: boolean; bytes: number; producers: number; consumers: number; codecs?: string[] } | null;
  holds: number;
  preloaded: boolean;
  /** Null: no feed (nobody watches it over MSE, and it is not kept warm). */
  cache: LiveCacheState | null;
}

/** What live view held at one time, for the soak report (live/soak). */
export interface SoakSample {
  /** Epoch ms. */
  at: number;
  go2rtc: { state: string; restarts: number; memory_kb: number | null };
  webrtc_sessions: number;
  feeds: { feeds: number; warm: number; viewers: number; ends: number };
  /** Per host: its stream slots in use (the sessions to its cameras), its limit, and its CPU as reported. */
  hosts: { name: string; streams: number; limit: number; waiting: number; cpu: number | null }[];
  /** Each camera on battery: whether it sleeps, and whether a stream of it is held. */
  battery: { camera: string; sleeping: boolean | null; watched: boolean }[];
}

/** What a grid's tiles counted for one camera: first frames, ends after one, failed starts. */
export interface SoakCounts {
  plays: number;
  drops: number;
  failures: number;
}

/**
 * The soak run, kept by the server so that it outlives the page: since when,
 * how long a grid was open and visible, how many times one opened, and what
 * the tiles counted. Grids add to it every minute.
 */
export interface SoakRun {
  /** Epoch ms. */
  started_at: number;
  /** Times a grid opened (a reload, or Home Assistant unloading the panel while hidden, opens it again). */
  opens: number;
  open_ms: number;
  visible_ms: number;
  tiles: Record<string, SoakCounts>;
  /** The devices that reported, and when each last did (epoch ms). */
  devices: Record<string, number>;
}

/** live/soak: the soak run, the samples since it started, and one taken now. */
export interface LiveSoak {
  sample_s: number;
  /** How long the server keeps samples (s). */
  keep_s: number;
  /** How long after Home Assistant started the first sample is taken (s): live view comes up first. */
  warmup_s: number;
  /** When sampling started (epoch ms; Home Assistant had started), or null before it has. */
  started_at: number | null;
  run: SoakRun | null;
  samples: SoakSample[];
  /** Taken now; null while live view may still be coming up. */
  now: SoakSample | null;
}

/** A camera's last picture (live/images): a signed URL, and when it was taken (epoch ms). */
export interface LiveImage {
  url: string;
  taken: number;
}

/** live/images events: every camera's picture first, then each new one. */
export interface LiveImagesEvent {
  images: Record<string, LiveImage>;
}

/** HA's RTCIceServer (web_rtc/ice_servers). */
export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export type LiveSignal =
  | { type: "session"; session_id: string }
  | { type: "answer"; sdp: string; timing?: Record<string, number> }
  | { type: "candidate"; candidate: string }
  | { type: "error"; message: string }
  | { type: "closed" };

/** HA's own camera WebRTC events (camera/webrtc/offer). */
export type StockSignal =
  | { type: "session"; session_id: string }
  | { type: "answer"; answer: string }
  | { type: "candidate"; candidate: RTCIceCandidateInit }
  | { type: "error"; code: string; message: string };

export interface CapacityStream {
  stream: string;
  fps: number;
  expected_fps: number | null;
  longest_gap_s: number;
  error?: string;
}

export interface CapacityLevel {
  level: number;
  added: string;
  first_frame_s?: number | null;
  streams: CapacityStream[];
  online_users: number | null;
  fill?: { mbit_s?: number | null; ttfb_ms?: number | null; error?: string };
}

export interface CapacityReport {
  levels: CapacityLevel[];
  online_users_before: number | string;
  online_users_after: number | string;
  fill?: { channel: number; duration_s: number } | string;
  fill_alone_mbit_s?: number | null;
  verdict: { first_failing_level: number | null; reasons: string[] };
  /** The cameras kept warm on the host, set aside while the test ran. */
  warm_set_aside?: number;
  /** Mains left out of the main level: they sent no video on their own. */
  main_left_out?: { camera: string; why: string }[];
  /** Asked for more than one main (Phase 9 step 3): how many, and how many played on their own. */
  mains?: { asked: number; playing: number };
  /** Streams that sent no video at their level while one added after played: the camera's, left out of the verdict. */
  no_video?: string[];
}

export type CapacityEvent =
  | { type: "progress"; message: string }
  | { type: "result"; report: CapacityReport }
  | { type: "error"; message: string; advice?: string };

/** The Wall's grids (Phase 9): Auto packs every camera; 1+5 and 1+7 have one large slot. */
export type WallGrid = "auto" | "1" | "2x2" | "3x3" | "4x4" | "1+5" | "1+7";

/** A saved Wall layout (wall/layouts), per Home Assistant user. */
export interface WallLayout {
  /** Its address: #wall/<id>. */
  id: string;
  name: string;
  grid: WallGrid;
  /** The camera in each cell, in order (null: empty); none: every camera, in the board's order. */
  cameras: (string | null)[];
  /** A tour's seconds per page (step 2); null for none. */
  tour_s: number | null;
  /** Step 4: the feeds' floodlight and siren buttons, and the strip of latest detections (shown unless false). */
  floodlight?: boolean;
  siren?: boolean;
  strip?: boolean;
}

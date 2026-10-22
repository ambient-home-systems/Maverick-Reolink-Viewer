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
  primary_view: "live" | "snapshot";
  snapshot_entity_id: string | null;
}

export type DeviceNode = HostNode | CameraNode;

export interface DevicesResponse {
  degraded: boolean;
  compat: CompatReport;
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
  timing: Timing;
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
  is_battery: boolean;
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

export interface LiveCamera {
  id: string;
  name: string;
  model: string | null;
  records: boolean;
  connections: LiveConnection[];
  /** Its "keep live view warm" switch (mains-powered cameras only). */
  keep_warm_entity?: string | null;
  /** Home Assistant's entities to control it with while watching. */
  controls?: LiveControls;
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
}

export type CapacityEvent =
  | { type: "progress"; message: string }
  | { type: "result"; report: CapacityReport }
  | { type: "error"; message: string };

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
  url: string;
  clip_url: string;
  stream: Stream;
  segment_id: string;
  start: number;
  end: number;
  media: MediaInfo | null;
  cache: CacheStatus;
  expires_in: number;
  timing: Timing;
}

export interface ThumbnailUrl {
  time: number;
  bucket: number;
  url: string;
}

export type MediaInfoResponse = Record<Stream, MediaInfo | null>;

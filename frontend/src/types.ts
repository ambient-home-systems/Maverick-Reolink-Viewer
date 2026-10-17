// Minimal slices of HA's frontend types, and the shapes of our websocket API.

export interface HassUser {
  is_admin: boolean;
  name?: string;
}

export interface HassConnection {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- HA's signature
  subscribeMessage<T>(
    callback: (message: T) => void,
    message: Record<string, unknown>,
  ): Promise<() => Promise<void>>;
}

export interface HomeAssistant {
  callWS<T>(message: Record<string, unknown>): Promise<T>;
  connection: HassConnection;
  user?: HassUser;
}

export interface CompatReport {
  ok: boolean;
  errors: string[];
  reolink_aio_version: string | null;
}

export interface StreamEncoding {
  codec: string | null;
  bit_rate: number | null;
  frame_rate: number | null;
}

export interface ChannelInfo {
  channel: number;
  name: string;
  model: string;
  hardware_version: string;
  firmware_version: string;
  online: boolean;
  sleeping: boolean;
  is_battery: boolean;
  is_doorbell: boolean;
  supports_replay: boolean;
  supports_stream: boolean;
  main: StreamEncoding;
  sub: StreamEncoding;
}

export type DeviceType = "camera" | "nvr" | "hub";

export interface HostInfo {
  entry_id: string;
  title: string;
  name: string;
  model: string;
  hardware_version: string;
  firmware_version: string;
  device_type: DeviceType;
  is_nvr: boolean;
  is_hub: boolean;
  is_battery: boolean;
  baichuan_only: boolean;
  protocol: string;
  rtsp_enabled: boolean | null;
  rtmp_enabled: boolean | null;
  onvif_enabled: boolean | null;
  supports_rtsp: boolean;
  supports_rtmp: boolean;
  supports_flv: boolean;
  channels: ChannelInfo[];
}

export interface RegistryDevice {
  entry_id: string;
  device_id: string;
  name: string | null;
  model: string | null;
  firmware_version: string | null;
  hardware_version: string | null;
  via_device_id: string | null;
}

export interface DevicesResponse {
  degraded: boolean;
  compat: CompatReport;
  hosts: HostInfo[];
  devices?: RegistryDevice[];
}

export interface ProbeOptions {
  include_battery: boolean;
  concurrency_test: boolean;
  max_streams: number;
}

export type ProbeReport = Record<string, unknown>;

export type ProbeEvent =
  | { type: "progress"; message: string }
  | { type: "result"; report: ProbeReport }
  | { type: "error"; message: string };

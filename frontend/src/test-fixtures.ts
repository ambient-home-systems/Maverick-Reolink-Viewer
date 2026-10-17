// Shared fixtures for the Vitest suites.
import type { ChannelInfo, DevicesResponse, HomeAssistant, HostInfo, ProbeEvent } from "./types";

export function makeChannel(overrides: Partial<ChannelInfo> = {}): ChannelInfo {
  return {
    channel: 0,
    name: "Front door",
    model: "RLC-810A",
    hardware_version: "IPC_523128M8MP",
    firmware_version: "v3.1.0.2368",
    online: true,
    sleeping: false,
    is_battery: false,
    is_doorbell: false,
    supports_replay: true,
    supports_stream: true,
    main: { codec: "h265", bit_rate: 6144, frame_rate: 25 },
    sub: { codec: "h264", bit_rate: 512, frame_rate: 15 },
    ...overrides,
  };
}

export function makeHost(overrides: Partial<HostInfo> = {}): HostInfo {
  return {
    entry_id: "entry1",
    title: "NVR",
    name: "Garage NVR",
    model: "RLN16-410",
    hardware_version: "N3MB01",
    firmware_version: "v3.5.1.368",
    device_type: "nvr",
    is_nvr: true,
    is_hub: false,
    is_battery: false,
    baichuan_only: false,
    protocol: "rtsp",
    rtsp_enabled: true,
    rtmp_enabled: false,
    onvif_enabled: true,
    supports_rtsp: true,
    supports_rtmp: true,
    supports_flv: true,
    channels: [makeChannel(), makeChannel({ channel: 1, name: "Driveway", is_battery: true })],
    ...overrides,
  };
}

export interface FakeHass extends HomeAssistant {
  sent: Record<string, unknown>[];
  emit: (event: ProbeEvent) => void;
  unsubscribed: number;
  failSubscribe?: { code: string; message: string };
}

export function makeHass(devices: DevicesResponse, isAdmin = true): FakeHass {
  let listener: ((event: ProbeEvent) => void) | undefined;
  const hass: FakeHass = {
    sent: [],
    unsubscribed: 0,
    user: { is_admin: isAdmin },
    emit: (event) => listener?.(event),
    callWS: <T>(message: Record<string, unknown>) => {
      hass.sent.push(message);
      return Promise.resolve(devices as T);
    },
    connection: {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- HA's signature
      subscribeMessage: <T>(callback: (message: T) => void, message: Record<string, unknown>) => {
        hass.sent.push(message);
        if (hass.failSubscribe) {
          // HA rejects with plain {code, message} objects, not Errors.
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
    },
  };
  return hass;
}

export const okDevices = (hosts: HostInfo[] = [makeHost()]): DevicesResponse => ({
  degraded: false,
  compat: { ok: true, errors: [], reolink_aio_version: "0.21.18" },
  hosts,
});

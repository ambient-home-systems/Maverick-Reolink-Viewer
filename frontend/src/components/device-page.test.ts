import { afterEach, describe, expect, it, vi } from "vitest";

import {
  deepQueryAll,
  deepText,
  makeCamera,
  makeConnection,
  makeDevice,
  makeHass,
  makeHostNode,
  makeState,
  okDevices,
  withStates,
  type FakeHass,
} from "../test-fixtures";
import type { DeviceDetails } from "../types";
import "./device-page";
import { hasPlayback, tabsFor, watchedEntities, type RvDevicePage } from "./device-page";
import type { Tab } from "./navigation";
import { SNAPSHOT_REFRESH_MS, type RvOverview } from "./overview";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

async function mount(hass: FakeHass, tab: Tab = "overview"): Promise<RvDevicePage> {
  const el = document.createElement("rv-device-page");
  el.hass = hass;
  el.deviceId = "dev-cam";
  el.tab = tab;
  document.body.appendChild(el);
  await flush();
  await flush();
  await el.updateComplete;
  // A tab's elements load on demand: wait for the shown tab's, then for it.
  for (const tag of ["rv-overview", "rv-playback", "rv-settings"]) {
    const shown = el.shadowRoot?.querySelector(tag);
    if (!shown) continue;
    await customElements.whenDefined(tag);
    await flush();
    await (shown as HTMLElement & { updateComplete?: Promise<unknown> }).updateComplete;
    await flush();
  }
  return el;
}

const DETAILS: DeviceDetails = {
  host: {
    model: "CX810",
    model_id: null,
    hardware_version: "IPC_1",
    firmware_version: "v3.1",
    device_type: "camera",
    channels: 1,
    stream_protocol: "rtsp",
    baichuan_only: false,
    network: { connection: "wifi", wifi_signal_dbm: -52 },
    ports: {
      http: { port: 443, https: true },
      rtsp: { enabled: true, port: 554 },
      rtmp: { enabled: false, port: 1935 },
      onvif: { enabled: true, port: 8000 },
    },
    storage: [{ index: 0, type: "SD", used_percent: 42, available: true }],
    cpu_usage: 7,
    capabilities: ["Wi-Fi"],
  },
  channel: {
    channel: 0,
    name: "Front Yard",
    model: "CX810",
    model_id: "P123",
    hardware_version: "IPC_1",
    firmware_version: "v3.1",
    online: true,
    sleeping: false,
    is_battery: true,
    wired_power: true,
    is_doorbell: false,
    is_dual_lens: false,
    supports_replay: true,
    supports_stream: true,
    encodings: {
      main: { codec: "h265", bit_rate: 6144, frame_rate: 25 },
      sub: { codec: "h264", bit_rate: 256, frame_rate: 15 },
    },
    network: { connection: "lan", wifi_signal_dbm: null },
    battery: { percent: 80, temperature_c: 21, status: "charging" },
    ai_types: ["people", "dog_cat"],
    capabilities: ["Floodlight", "Siren"],
  },
};

describe("rv-device-page", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("loads the device and the catalog and shows the snapshot", async () => {
    const hass = makeHass(okDevices());
    const el = await mount(hass);
    expect(hass.sent).toContainEqual({ type: "reolink_viewer/device", device_id: "dev-cam" });
    expect(deepText(el)).toContain("Front Yard");
    const img = deepQueryAll<HTMLImageElement>(el, "img").at(0);
    expect(img?.getAttribute("src")).toBe("/api/camera_proxy/camera.front_yard_fluent?token=abc");
    expect(deepText(el)).toContain("playback source");
  });

  it("re-renders only when one of its own entities changes", async () => {
    const hass = makeHass(okDevices());
    const el = await mount(hass);
    const renders = el.renderCount;

    let current = withStates(hass, { "sensor.elsewhere": makeState("sensor.elsewhere", "2") });
    el.hass = current;
    await el.updateComplete;
    expect(el.renderCount).toBe(renders);

    current = withStates(current, { "switch.record": makeState("switch.record", "off") });
    el.hass = current;
    await el.updateComplete;
    expect(el.renderCount).toBe(renders + 1);

    // A new picture URL (HA rotates the token) re-renders the snapshot.
    el.hass = withStates(current, {
      "camera.front_yard_fluent": makeState("camera.front_yard_fluent", "idle", {
        entity_picture: "/api/camera_proxy/camera.front_yard_fluent?token=new",
      }),
    });
    await el.updateComplete;
    expect(el.renderCount).toBe(renders + 2);
    const img = deepQueryAll<HTMLImageElement>(el, "img").at(0);
    expect(img?.getAttribute("src")).toContain("token=new");
  });

  it("shows the Settings tab", async () => {
    const el = await mount(makeHass(okDevices()), "settings");
    const settings = el.shadowRoot?.querySelector("rv-settings");
    expect(settings?.catalog?.version).toBe(1);
    expect(deepText(el)).toContain("Status LED");
  });

  it("navigates between tabs and back to the list", async () => {
    const el = await mount(makeHass(okDevices()));
    const routes: unknown[] = [];
    el.addEventListener("rv-navigate", (e) => routes.push((e as CustomEvent).detail));
    const buttons = [...(el.shadowRoot?.querySelectorAll("button") ?? [])];
    buttons.find((b) => b.textContent.trim() === "Settings")?.click();
    buttons.find((b) => b.textContent.includes("All devices"))?.click();
    expect(routes).toEqual([
      { view: "device", id: "dev-cam", tab: "settings" },
      { view: "list" },
    ]);
  });

  it("offers Live for cameras and Playback only for cameras that record", async () => {
    const hass = makeHass(okDevices());
    const el = await mount(hass, "playback");
    const tabs = () => [...(el.shadowRoot?.querySelectorAll('[role="tab"]') ?? [])].map((b) => b.textContent.trim());
    expect(tabs()).toEqual(["Overview", "Live", "Playback", "Settings"]);
    const playback = el.shadowRoot?.querySelector("rv-playback");
    expect(playback?.deviceId).toBe("dev-cam");
    expect(playback?.cameraName).toBe("Front Yard");

    // A camera that records nowhere (e.g. the E1 Zoom): its Playback tab says why, and what to do.
    const nvrConnection = makeCamera().connections.at(0);
    if (!nvrConnection) throw new Error("fixture has no connection");
    const snapshotOnly = makeDevice({
      node: makeCamera({
        connections: [{ ...nvrConnection, playback_source: false }],
        recordings: { where: "none", storage: null },
      }),
    });
    hass.responses["reolink_viewer/device"] = snapshotOnly;
    expect(hasPlayback(snapshotOnly)).toBe(false);
    expect(tabsFor(snapshotOnly)).toEqual(["overview", "live", "playback", "settings"]);
    await el.reload();
    await el.updateComplete;
    expect(tabs()).toEqual(["Overview", "Live", "Playback", "Settings"]);
    expect(el.shadowRoot?.querySelector("rv-playback")).toBeNull();
    const why = () => el.shadowRoot?.querySelector(".empty-tab")?.textContent ?? "";
    expect(why()).toContain("No recordings to play");
    expect(why()).toContain("it has no SD card, and it is not on a Reolink NVR");
    expect(why()).toContain("put a microSD card in it");
    // Kept where they cannot be played here: on an NVR, or the battery Doorbell's SD card.
    hass.responses["reolink_viewer/device"] = makeDevice({
      node: makeCamera({
        connections: [{ ...nvrConnection, playback_source: false }],
        recordings: { where: "elsewhere", storage: "ready" },
      }),
    });
    await el.reload();
    await el.updateComplete;
    expect(why()).toContain("Front Yard's recordings are on Garage NVR, which cannot send them to Home Assistant.");
    expect(why()).toContain("Play them in the Reolink app");
    hass.responses["reolink_viewer/device"] = makeDevice({
      node: makeCamera({
        connections: [{ ...nvrConnection, via: "direct", host_id: null, host_name: null, playback_source: false }],
        recordings: { where: "elsewhere", storage: "ready" },
      }),
    });
    await el.reload();
    await el.updateComplete;
    expect(why()).toContain("Front Yard records to its SD card, but cannot send its recordings to Home Assistant.");
    hass.responses["reolink_viewer/device"] = snapshotOnly;
    await el.reload();
    await el.updateComplete;

    // The Live tab watches the camera; degraded mode has no live service.
    el.tab = "live";
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector("rv-live-camera")?.deviceId).toBe("dev-cam");
    // Degraded mode: no live service, and its Playback tab says why there is none.
    const degraded = { ...snapshotOnly, degraded: true };
    expect(tabsFor(degraded)).toEqual(["overview", "playback", "settings"]);
    hass.responses["reolink_viewer/device"] = degraded;
    el.tab = "playback";
    await el.reload();
    await el.updateComplete;
    expect(why()).toContain("Recordings cannot be played right now");
    expect(why()).toContain("Home Assistant's Reolink integration is not running, so Front Yard's recordings cannot be read.");
    hass.responses["reolink_viewer/device"] = {
      ...degraded,
      compat: { ok: false, errors: ["Reolink runtime_data has no 'host'"], reolink_aio_version: "0.19.0" },
    };
    await el.reload();
    await el.updateComplete;
    expect(why()).toContain("Reolink Viewer needs an update to read Front Yard's recordings since Home Assistant's last update.");
  });

  it("reloads after an entity registry change of its own entities", async () => {
    vi.useFakeTimers();
    const hass = makeHass(okDevices());
    const el = document.createElement("rv-device-page");
    el.hass = hass;
    el.deviceId = "dev-cam";
    document.body.appendChild(el);
    await vi.advanceTimersByTimeAsync(0);
    const count = () => hass.sent.filter((m) => m.type === "reolink_viewer/device").length;
    expect(count()).toBe(1);
    expect(hass.sent).toContainEqual({ type: "subscribe_events", event_type: "entity_registry_updated" });

    hass.emitEvent({ data: { action: "update", entity_id: "sensor.elsewhere" } });
    await vi.advanceTimersByTimeAsync(2000);
    expect(count()).toBe(1);

    hass.emitEvent({ data: { action: "update", entity_id: "switch.ftp_upload" } });
    await vi.advanceTimersByTimeAsync(2000);
    expect(count()).toBe(2);
  });

  it("shows load errors", async () => {
    const hass = makeHass(okDevices());
    hass.callWS = () =>
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      Promise.reject({ code: "not_found", message: "Reolink device not found" });
    const el = await mount(hass);
    expect(deepText(el)).toContain("Could not load the device: Reolink device not found");
  });

  it("watches the device's entities and its snapshot camera", () => {
    const ids = watchedEntities(makeDevice());
    expect(ids).toContain("switch.record");
    expect(ids).toContain("camera.front_yard_fluent");
    const host = makeDevice({ node: makeHostNode(), connections: [makeConnection({ entities: [] })] });
    expect(watchedEntities(host)).toEqual([]);
  });
});

describe("rv-overview", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  async function overview(hass: FakeHass, device = makeDevice()): Promise<RvOverview> {
    const el = document.createElement("rv-overview");
    el.hass = hass;
    el.device = device;
    document.body.appendChild(el);
    await el.updateComplete;
    return el;
  }

  it("shows details of each connection", async () => {
    const direct = makeConnection({ via: "direct", playback_source: false, details: DETAILS });
    const el = await overview(
      makeHass(okDevices()),
      makeDevice({ connections: [makeConnection({ details: DETAILS }), direct] }),
    );
    const text = deepText(el);
    expect(text).toContain("Through Garage NVR");
    expect(text).toContain("Added directly");
    expect(text).toContain("channel 1");
    expect(text).toContain("H.265 · 25 fps · 6144 kbps");
    expect(text).toContain("80% · charging · 21 °C · on wired power");
    expect(text).toContain("person, animal");
    expect(text).toContain("Wi-Fi, -52 dBm");
    expect(text).toContain("RTSP on (554) · RTMP off (1935) · ONVIF on (8000)");
    expect(text).toContain("SD card: 42% used");
    expect(text).toContain("Floodlight");
  });

  it("warns, in plain words, about a disk that is not ready, and says when there is none", async () => {
    const failing = { ...DETAILS, host: { ...DETAILS.host, storage: [{ index: 0, type: "SD", used_percent: null, available: false }] } };
    const direct = makeConnection({ via: "direct", details: failing });
    let el = await overview(makeHass(okDevices()), makeDevice({ connections: [direct] }));
    let text = deepText(el);
    expect(text).toContain("SD card: not ready (not formatted, or failed)");
    expect(text).toContain("SD card is not ready");
    expect(text).toContain("Format it in the Reolink app, or replace it.");
    document.body.innerHTML = "";

    const bare = { ...DETAILS, host: { ...DETAILS.host, storage: [] } };
    el = await overview(makeHass(okDevices()), makeDevice({ connections: [makeConnection({ via: "direct", details: bare })] }));
    text = deepText(el);
    expect(text).toContain("None: no SD card, so it keeps no recordings of its own");
    expect(text).not.toContain("not ready");
  });

  it("makes the snapshot the main view of a camera that does not record", async () => {
    vi.useFakeTimers();
    const camera = makeCamera({ primary_view: "snapshot", host_id: null });
    const el = await overview(makeHass(okDevices()), makeDevice({ node: camera }));
    expect(deepText(el)).toContain("does not record, so snapshots are its main view");
    expect(el.snapshotUrl()).toBe("/api/camera_proxy/camera.front_yard_fluent?token=abc");
    vi.advanceTimersByTime(SNAPSHOT_REFRESH_MS);
    expect(el.snapshotUrl()).toMatch(/token=abc&_=\d+$/);
  });

  it("explains a missing snapshot and degraded details", async () => {
    const camera = makeCamera({ snapshot_entity_id: null });
    const el = await overview(makeHass(okDevices()), makeDevice({ node: camera, degraded: true }));
    expect(deepText(el)).toContain("No snapshot: enable one of this camera's stream entities");
    expect(deepText(el)).toContain("Details are unavailable while Reolink Viewer cannot reach the Reolink integration.");
  });

  it("summarizes an NVR", async () => {
    const host = makeDevice({
      node: makeHostNode(),
      connections: [makeConnection({ via: "direct", details: { ...DETAILS, channel: null, host: { ...DETAILS.host, device_type: "nvr" } } })],
    });
    const el = await overview(makeHass(okDevices()), host);
    expect(deepText(el)).toContain("1 camera on this NVR.");
    expect(deepText(el)).toContain("Channels");
    // With the device list: the NVR's cameras, ruled by channel, without its heading.
    el.devices = okDevices();
    el.cameras = [{ id: "dev-cam", name: "Front Yard", number: 3 }];
    await el.updateComplete;
    const list = el.shadowRoot?.querySelector("rv-device-list");
    expect(list?.hostId).toBe("dev-nvr");
    await list?.updateComplete;
    expect(list?.shadowRoot?.querySelector(".plat")?.textContent).toBe("3");
    expect(list?.shadowRoot?.querySelector(".head")).toBeNull();
    expect(list?.shadowRoot?.querySelectorAll("button.row")).toHaveLength(1);
  });
});

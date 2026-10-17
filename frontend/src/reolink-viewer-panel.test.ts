import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "./reolink-viewer-panel";
import type { ReolinkViewerPanel } from "./reolink-viewer-panel";
import {
  deepText,
  makeCamera,
  makeHass,
  makeHostNode,
  okDevices,
  type FakeHass,
} from "./test-fixtures";
import type { DevicesResponse } from "./types";

const download = vi.hoisted(() => vi.fn());
vi.mock("./download", () => ({ downloadJson: download }));

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

async function mount(hass: FakeHass): Promise<ReolinkViewerPanel> {
  const el = document.createElement("reolink-viewer-panel");
  el.hass = hass;
  document.body.appendChild(el);
  await flush();
  await el.updateComplete;
  return el;
}

const text = (el: ReolinkViewerPanel) => deepText(el);

const button = (el: ReolinkViewerPanel, label: string) =>
  [...(el.shadowRoot?.querySelectorAll("button") ?? [])].find(
    (b) => b.textContent.trim() === label,
  );

describe("reolink-viewer-panel", () => {
  beforeEach(() => {
    download.mockReset();
  });
  afterEach(() => {
    document.body.innerHTML = "";
    window.history.replaceState(null, "", "/");
  });

  it("lists NVRs with their cameras and cameras added directly", async () => {
    const direct = makeCamera({
      id: "dev-zoom",
      name: "Laundry",
      model: "E1 Zoom",
      host_id: null,
      primary_view: "snapshot",
    });
    const nvrConnection = makeCamera().connections.at(0);
    if (!nvrConnection) throw new Error("no connection");
    const merged = makeCamera({
      connections: [
        nvrConnection,
        { ...nvrConnection, via: "direct", device_id: "dev-direct", host_id: null },
      ],
    });
    const el = await mount(makeHass(okDevices([makeHostNode()], [merged, direct])));
    const content = text(el);
    expect(content).toContain("Garage NVR");
    expect(content).toContain("NVR");
    expect(content).toContain("Ch 1 Front Yard");
    expect(content).toContain("+ direct");
    expect(content).toContain("Cameras added directly");
    expect(content).toContain("Laundry");
    expect(content).toContain("snapshots");
    // The merged camera is listed once.
    expect(content.match(/Front Yard/g)).toHaveLength(1);
  });

  it("shows an empty state", async () => {
    const el = await mount(makeHass(okDevices([], [])));
    expect(text(el)).toContain("No Reolink devices");
  });

  it("shows the degraded banner", async () => {
    const degraded: DevicesResponse = {
      ...okDevices(),
      degraded: true,
      compat: { ok: false, errors: ["ReolinkData no longer has a 'host' field"], reolink_aio_version: null },
    };
    const el = await mount(makeHass(degraded));
    const content = text(el);
    expect(content).toContain("Degraded mode.");
    expect(content).toContain("no longer has a 'host' field");
    expect(content).toContain("Garage NVR");
    expect(button(el, "Run probe")?.disabled).toBe(true);
  });

  it("opens a device and goes back to the list", async () => {
    const hass = makeHass(okDevices());
    const el = await mount(hass);
    const list = el.shadowRoot?.querySelector("rv-device-list");
    const row = [...(list?.shadowRoot?.querySelectorAll("button") ?? [])].find((b) =>
      b.textContent.includes("Front Yard"),
    );
    row?.click();
    await flush();
    await el.updateComplete;
    expect(window.location.hash).toBe("#device/dev-cam/overview");
    const page = el.shadowRoot?.querySelector("rv-device-page");
    expect(page?.deviceId).toBe("dev-cam");
    await flush();
    await page?.updateComplete;
    expect(hass.sent).toContainEqual({ type: "reolink_viewer/device", device_id: "dev-cam" });

    window.history.pushState(null, "", "#");
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector("rv-device-list")).not.toBeNull();
  });

  it("shows toasts from child elements", async () => {
    const el = await mount(makeHass(okDevices()));
    el.dispatchEvent(
      new CustomEvent("rv-toast", { detail: { message: "Saved", kind: "info" } }),
    );
    await el.updateComplete;
    expect(text(el)).toContain("Saved");
  });

  it("shows a load error", async () => {
    const hass = makeHass(okDevices());
    // HA rejects with plain {code, message} objects, not Errors.
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
    hass.callWS = () => Promise.reject({ code: "not_loaded", message: "Reolink Viewer is not loaded" });
    const el = await mount(hass);
    expect(text(el)).toContain("Could not load devices: Reolink Viewer is not loaded");
  });

  it("hides the probe from non-admins", async () => {
    const el = await mount(makeHass(okDevices(), false));
    expect(text(el)).not.toContain("Hardware probe");
  });

  it("runs the probe, shows progress and downloads the report", async () => {
    const hass = makeHass(okDevices());
    const el = await mount(hass);
    const concurrency = el.shadowRoot?.querySelectorAll<HTMLInputElement>("input[type=checkbox]")[1];
    if (!concurrency) throw new Error("no checkbox");
    concurrency.checked = true;
    concurrency.dispatchEvent(new Event("change"));
    await el.updateComplete;

    button(el, "Run probe")?.click();
    await flush();
    expect(hass.sent.at(-1)).toEqual({
      type: "reolink_viewer/probe",
      include_battery: false,
      concurrency_test: true,
      max_streams: 4,
      playback_test: false,
      playback_only: false,
      playback_concurrency_test: false,
      playback_max_streams: 4,
    });
    hass.emit({ type: "progress", message: "ch0 live rtsp main" });
    await el.updateComplete;
    expect(text(el)).toContain("ch0 live rtsp main");
    expect(button(el, "Cancel")).toBeDefined();

    hass.emit({ type: "result", report: { schema_version: 1 } });
    await flush();
    await el.updateComplete;
    expect(download).toHaveBeenCalledTimes(1);
    expect(download.mock.calls[0]?.[0]).toEqual({ schema_version: 1 });
    expect(String(download.mock.calls[0]?.[1])).toMatch(/^reolink-viewer-probe-.*\.json$/);
    expect(text(el)).toContain("Done.");
    button(el, "Download again")?.click();
    expect(download).toHaveBeenCalledTimes(2);
  });

  it("sends the recording playback options", async () => {
    const hass = makeHass(okDevices());
    const el = await mount(hass);
    const boxes = () =>
      Array.from(el.shadowRoot?.querySelectorAll<HTMLInputElement>("input[type=checkbox]") ?? []);
    const toggle = async (index: number) => {
      const box = boxes().at(index);
      if (!box) throw new Error(`no checkbox ${String(index)}`);
      box.checked = !box.checked;
      box.dispatchEvent(new Event("change"));
      await el.updateComplete;
    };
    expect(boxes()[3]?.disabled).toBe(true);
    expect(boxes()[4]?.disabled).toBe(true);
    await toggle(2);
    expect(boxes()[3]?.disabled).toBe(false);
    await toggle(3);
    await toggle(4);
    const select = el.shadowRoot?.querySelectorAll<HTMLSelectElement>("select")[1];
    if (!select) throw new Error("no select");
    expect(select.disabled).toBe(false);
    select.value = "6";
    select.dispatchEvent(new Event("change"));
    await el.updateComplete;

    button(el, "Run probe")?.click();
    await flush();
    expect(hass.sent.at(-1)).toMatchObject({
      playback_test: true,
      playback_only: true,
      playback_concurrency_test: true,
      playback_max_streams: 6,
    });
    button(el, "Cancel")?.click();
    await flush();

    // Turning the check off turns its sub-options off too.
    await toggle(2);
    button(el, "Run probe")?.click();
    await flush();
    expect(hass.sent.at(-1)).toMatchObject({
      playback_test: false,
      playback_only: false,
      playback_concurrency_test: false,
    });
  });

  it("shows probe errors and supports cancel", async () => {
    const hass = makeHass(okDevices());
    const el = await mount(hass);
    button(el, "Run probe")?.click();
    await flush();
    hass.emit({ type: "error", message: "boom" });
    await flush();
    await el.updateComplete;
    expect(text(el)).toContain("Probe failed: boom");

    button(el, "Run probe")?.click();
    await flush();
    button(el, "Cancel")?.click();
    await flush();
    await el.updateComplete;
    expect(hass.unsubscribed).toBe(2);
    expect(button(el, "Run probe")).toBeDefined();
    expect(text(el)).not.toContain("Probe failed");
  });

  it("cancels a running probe when removed", async () => {
    const hass = makeHass(okDevices());
    const el = await mount(hass);
    button(el, "Run probe")?.click();
    await flush();
    el.remove();
    await flush();
    expect(hass.unsubscribed).toBe(1);
  });
});

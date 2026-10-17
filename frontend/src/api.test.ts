import { describe, expect, it, vi } from "vitest";

import { enableEntity, fetchCatalog, fetchDevice, fetchDevices, runProbe, toError } from "./api";
import { makeHass, okDevices } from "./test-fixtures";

const OPTIONS = { include_battery: false, concurrency_test: true, max_streams: 3 };

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("api", () => {
  it("fetches devices", async () => {
    const hass = makeHass(okDevices());
    const result = await fetchDevices(hass);
    expect(result.hosts).toHaveLength(1);
    expect(hass.sent).toEqual([{ type: "reolink_viewer/devices" }]);
  });

  it("fetches one device and enables entities", async () => {
    const hass = makeHass(okDevices());
    await fetchDevice(hass, "dev-cam");
    await expect(enableEntity(hass, "switch.ftp_upload")).resolves.toEqual({ reload_delay: 30 });
    expect(hass.sent).toEqual([
      { type: "reolink_viewer/device", device_id: "dev-cam" },
      { type: "config/entity_registry/update", entity_id: "switch.ftp_upload", disabled_by: null },
    ]);
  });

  it("fetches the catalog once per connection and retries failures", async () => {
    const hass = makeHass(okDevices());
    const callWS = hass.callWS.bind(hass);
    let fail = true;
    hass.callWS = <T>(message: Record<string, unknown>) =>
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      fail ? Promise.reject({ code: "x", message: "down" }) : callWS<T>(message);
    await expect(fetchCatalog(hass)).rejects.toEqual({ code: "x", message: "down" });
    fail = false;
    const first = await fetchCatalog(hass);
    const second = await fetchCatalog(hass);
    expect(first).toBe(second);
    expect(hass.sent.filter((m) => m.type === "reolink_viewer/catalog")).toHaveLength(1);
  });

  it("streams progress and resolves with the report", async () => {
    const hass = makeHass(okDevices());
    const progress = vi.fn();
    const run = runProbe(hass, OPTIONS, progress);
    await flush();
    expect(hass.sent[0]).toEqual({ type: "reolink_viewer/probe", ...OPTIONS });
    hass.emit({ type: "progress", message: "host1: RLN16-410 (nvr)" });
    hass.emit({ type: "result", report: { schema_version: 1 } });
    await expect(run.result).resolves.toEqual({ schema_version: 1 });
    expect(progress).toHaveBeenCalledWith("host1: RLN16-410 (nvr)");
    expect(hass.unsubscribed).toBe(1);
    // Late events are ignored.
    hass.emit({ type: "progress", message: "late" });
    expect(progress).toHaveBeenCalledTimes(1);
  });

  it("rejects on an error event", async () => {
    const hass = makeHass(okDevices());
    const run = runProbe(hass, OPTIONS, () => undefined);
    await flush();
    hass.emit({ type: "error", message: "boom" });
    await expect(run.result).rejects.toThrow("boom");
    expect(hass.unsubscribed).toBe(1);
  });

  it("rejects when the subscription is refused", async () => {
    const hass = makeHass(okDevices());
    hass.failSubscribe = { code: "probe_running", message: "A probe is already running" };
    const run = runProbe(hass, OPTIONS, () => undefined);
    await expect(run.result).rejects.toThrow("A probe is already running");
  });

  it("cancels by unsubscribing", async () => {
    const hass = makeHass(okDevices());
    const run = runProbe(hass, OPTIONS, () => undefined);
    await flush();
    run.cancel();
    await expect(run.result).rejects.toThrow("Probe cancelled");
    expect(hass.unsubscribed).toBe(1);
    run.cancel();
    expect(hass.unsubscribed).toBe(1);
  });

  it("unsubscribes when the result arrives before the subscription resolves", async () => {
    const hass = makeHass(okDevices());
    const original = hass.connection.subscribeMessage.bind(hass.connection);
    hass.connection.subscribeMessage = (callback, message) => {
      const unsub = original(callback, message);
      hass.emit({ type: "result", report: {} });
      return unsub;
    };
    const run = runProbe(hass, OPTIONS, () => undefined);
    await expect(run.result).resolves.toEqual({});
    await flush();
    expect(hass.unsubscribed).toBe(1);
  });

  it("normalizes errors", () => {
    expect(toError(new Error("x")).message).toBe("x");
    expect(toError({ code: "c", message: "from ws" }).message).toBe("from ws");
    expect(toError("plain").message).toBe("plain");
  });
});

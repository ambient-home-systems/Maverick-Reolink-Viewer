import { afterEach, describe, expect, it } from "vitest";

import { makeCamera, makeDevice, makeHostNode, okDevices } from "../test-fixtures";
import "./device-list";
import { kindLine } from "./device-page";
import type { Route } from "./navigation";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("rv-device-list", () => {
  it("rules each NVR's cameras by channel, with their board numbers, state and flags", async () => {
    const nvrConnection = makeCamera().connections.at(0);
    if (!nvrConnection) throw new Error("no connection");
    const yard = makeCamera({
      connections: [nvrConnection, { ...nvrConnection, via: "direct", device_id: "dev-direct", host_id: null }],
    });
    const porch = makeCamera({
      id: "dev-porch",
      name: "Porch",
      status: { online: false, sleeping: false },
      connections: [{ ...nvrConnection, device_id: "dev-porch", channel: 1 }],
    });
    const zoom = makeCamera({ id: "dev-zoom", name: "Laundry", host_id: null, primary_view: "snapshot", status: { online: true, sleeping: true } });
    const host = makeHostNode({ camera_ids: ["dev-cam", "dev-porch"] });
    const el = document.createElement("rv-device-list");
    el.devices = okDevices([host], [yard, porch, zoom]);
    el.cameras = [{ id: "dev-cam", name: "Front Yard", number: 2 }];
    document.body.appendChild(el);
    await el.updateComplete;
    const routes: Route[] = [];
    el.addEventListener("rv-navigate", (e) => routes.push((e as CustomEvent<Route>).detail));

    const rows = [...(el.shadowRoot?.querySelectorAll<HTMLButtonElement>("button.row") ?? [])];
    const cell = (row: HTMLButtonElement | undefined, name: string) => row?.querySelector(`.${name}`)?.textContent.trim();
    expect(rows.map((r) => cell(r, "name"))).toEqual(["Front Yard", "Porch", "Laundry"]);
    expect(rows.map((r) => cell(r, "plat-cell"))).toEqual(["2", "", ""]);
    expect(rows.map((r) => cell(r, "ch"))).toEqual(["Ch 1", "Ch 2", "Direct"]);
    expect(cell(rows.at(0), "state")).toBe("OnlineAlso added directly");
    expect(rows.at(1)?.querySelector(".offline")?.textContent).toBe("Offline");
    expect(cell(rows.at(2), "state")).toBe("AsleepSnapshots only");
    expect(el.shadowRoot?.querySelector(".head p")?.textContent.trim()).toBe("NVR · RLN36 · firmware v3.6.5");

    rows.at(1)?.click();
    el.shadowRoot?.querySelector<HTMLButtonElement>("button.host")?.click();
    expect(routes).toEqual([
      { view: "device", id: "dev-porch", tab: "overview" },
      { view: "device", id: "dev-nvr", tab: "overview" },
    ]);
  });

  it("says when an NVR has no cameras", async () => {
    const el = document.createElement("rv-device-list");
    el.devices = okDevices([makeHostNode({ camera_ids: [] })], []);
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot?.textContent).toContain("No cameras on this NVR.");
  });
});

describe("kindLine", () => {
  it("names the kind, the model and where a camera is connected", () => {
    expect(kindLine(makeDevice())).toBe("Camera · CX810");
    const nvrConnection = makeCamera().connections.at(0);
    if (!nvrConnection) throw new Error("no connection");
    const both = makeCamera({ connections: [nvrConnection, { ...nvrConnection, via: "direct", host_id: null }] });
    expect(kindLine(makeDevice({ node: both }))).toBe("Camera · CX810 · on the NVR and added directly");
    const twice = makeCamera({ connections: [nvrConnection, nvrConnection] });
    expect(kindLine(makeDevice({ node: twice }))).toBe("Camera · CX810 · 2 connections");
    expect(kindLine(makeDevice({ node: makeHostNode({ model: null }) }))).toBe("NVR");
  });
});

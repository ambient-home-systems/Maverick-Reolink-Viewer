// When Reolink Viewer cannot work with Home Assistant's Reolink integration,
// in plain words, and what to do (Phase 4 step 4.3). The panel shows it over
// every view; the technical text stays under Details, for support.
import type { Explained } from "./live/explain";
import type { CompatReport, DevicesResponse } from "./types";

export interface IntegrationProblem extends Explained {
  /**
   * changed: a Home Assistant update changed the Reolink integration's
   * internals; stopped: it has none of the devices loaded; none: no devices
   * set up yet (not a fault).
   */
  kind: "changed" | "stopped" | "none";
  title: string;
  /** What the compatibility check found. */
  technical?: string;
}

/** Why Reolink Viewer cannot reach the cameras, if it cannot. */
export function integrationProblem(devices: DevicesResponse | undefined): IntegrationProblem | undefined {
  if (!devices?.degraded) return undefined;
  if (!devices.compat.ok) {
    return {
      kind: "changed",
      title: "Reolink Viewer needs an update",
      text: "A Home Assistant update changed its Reolink integration, and this version of Reolink Viewer cannot work with it.",
      advice:
        "Update Reolink Viewer in HACS when a new version is out. Until then, live view, recordings and events are off here. Your cameras keep recording, the Reolink app still works, and your devices and their settings are still here.",
      technical: compatText(devices.compat),
    };
  }
  if (!devices.hosts.length && !devices.cameras.length) {
    return {
      kind: "none",
      title: "No Reolink devices yet",
      text: "Set up your cameras or NVR in Home Assistant's Reolink integration first.",
      advice: "Settings → Devices & services → Add integration → Reolink. They appear here once it has loaded them.",
    };
  }
  return {
    kind: "stopped",
    title: "The Reolink integration is not running",
    text: "Home Assistant's Reolink integration has not loaded your cameras or NVR, so Reolink Viewer cannot reach them.",
    advice:
      "Check it under Settings → Devices & services → Reolink: it may be waiting for a camera or NVR to come back online. Live view, recordings and events come back once it runs.",
  };
}

/** Whether `a` is a later version than `b` ("0.61.1" after "0.61.0"). */
export function laterVersion(a: string, b: string): boolean {
  const parts = (v: string) => v.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d) return d > 0;
  }
  return false;
}

/**
 * An update half done: this page and the Reolink Viewer Home Assistant runs
 * differ. A newer page (Home Assistant has not restarted since HACS updated
 * the files, or runs one from before it said its version) needs a restart; an
 * older page, from the browser's cache, needs a reload.
 */
export function versionProblem(devices: DevicesResponse | undefined, page: string): Explained | undefined {
  if (!devices) return undefined;
  const server = devices.version;
  if (server === page) return undefined;
  if (server === undefined || laterVersion(page, server)) {
    return {
      text: `This page is Reolink Viewer ${page}, but Home Assistant is still running ${server ?? "an older version"}: it has not restarted since the update.`,
      advice: "Restart Home Assistant (Settings → System → Restart), then reload this page.",
    };
  }
  return {
    text: `Home Assistant runs Reolink Viewer ${server}, but this page is still ${page}, from the browser's cache.`,
    advice: "Reload this page: Ctrl+F5 on a computer; in the Home Assistant app, pull down on the page.",
  };
}

/** The compatibility check's findings, one per line, with the library's version. */
export function compatText(compat: CompatReport): string {
  return [...compat.errors, ...(compat.reolink_aio_version ? [`reolink-aio ${compat.reolink_aio_version}`] : [])].join(
    "\n",
  );
}

/** Why something (`what`: "Live view", "Today's events") could not be loaded. */
export function explainLoad(error: string, what: string): Explained {
  if (/not loaded/i.test(error)) {
    return {
      text: `${what} could not load: Reolink Viewer is not running.`,
      advice: "Check it under Settings → Devices & services, then try again.",
    };
  }
  if (/internals changed|incompatible/i.test(error)) {
    return {
      text: `${what} could not load: Reolink Viewer needs an update to work with this Home Assistant release.`,
      advice: "Update it in HACS when a new version is out.",
    };
  }
  if (/unknown command/i.test(error)) {
    return {
      text: `${what} could not load: Reolink Viewer was updated, but Home Assistant has not restarted since.`,
      advice: "Restart Home Assistant, then reload this page.",
    };
  }
  return {
    text: `${what} could not load from Home Assistant.`,
    advice: "Check the connection to Home Assistant, then try again.",
  };
}

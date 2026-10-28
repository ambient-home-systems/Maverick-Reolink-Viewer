import { describe, expect, it } from "vitest";

import { explainLoad, integrationProblem } from "./integration";
import { okDevices } from "./test-fixtures";

describe("integrationProblem", () => {
  it("is nothing while the integration works, or before the devices load", () => {
    expect(integrationProblem(undefined)).toBeUndefined();
    expect(integrationProblem(okDevices())).toBeUndefined();
  });

  it("tells an update that changed the integration from one that is not running, or not set up", () => {
    const changed = integrationProblem({
      ...okDevices(),
      degraded: true,
      compat: { ok: false, errors: ["Reolink runtime_data has no 'host'", "reolink_aio Host is missing: api"], reolink_aio_version: "0.19.0" },
    });
    expect(changed?.kind).toBe("changed");
    expect(changed?.title).toBe("Reolink Viewer needs an update");
    expect(changed?.technical).toBe("Reolink runtime_data has no 'host'\nreolink_aio Host is missing: api\nreolink-aio 0.19.0");

    const stopped = integrationProblem({ ...okDevices(), degraded: true });
    expect(stopped?.kind).toBe("stopped");
    expect(stopped?.title).toBe("The Reolink integration is not running");
    expect(stopped?.technical).toBeUndefined();

    expect(integrationProblem({ ...okDevices([], []), degraded: true })?.kind).toBe("none");
  });
});

describe("explainLoad", () => {
  it.each([
    ["Reolink Viewer is not loaded", "Live view could not load: Reolink Viewer is not running."],
    [
      "Reolink integration internals changed: Reolink runtime_data has no 'host'",
      "Live view could not load: Reolink Viewer needs an update to work with this Home Assistant release.",
    ],
    ["Unknown command.", "Live view could not load: Reolink Viewer was updated, but Home Assistant has not restarted since."],
    ["Connection lost", "Live view could not load from Home Assistant."],
  ])("%s", (error, text) => {
    const explained = explainLoad(error, "Live view");
    expect(explained.text).toBe(text);
    expect(explained.advice).toBeTruthy();
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

import { downloadJson } from "./download";

describe("downloadJson", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("clicks a temporary link with the JSON blob", async () => {
    vi.useFakeTimers();
    const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fake");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    downloadJson({ a: 1 }, "probe.json");
    const clicked = click.mock.contexts[0] as HTMLAnchorElement | undefined;

    expect(clicked?.download).toBe("probe.json");
    expect(clicked?.href).toBe("blob:fake");
    expect(document.querySelector("a")).toBeNull();
    const blob = create.mock.calls[0]?.[0] as Blob;
    expect(blob.type).toBe("application/json");
    expect(JSON.parse(await blob.text())).toEqual({ a: 1 });
    vi.advanceTimersByTime(1000);
    expect(revoke).toHaveBeenCalledWith("blob:fake");
  });
});

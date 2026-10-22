import { describe, expect, it, vi } from "vitest";

import { copyText } from "./clipboard";

describe("copyText", () => {
  it("copies text without the Clipboard API (plain-HTTP pages)", async () => {
    const exec = vi.fn(() => true);
    Object.defineProperty(document, "execCommand", { value: exec, configurable: true });
    expect(await copyText("hello")).toBe(true);
    expect(exec).toHaveBeenCalledWith("copy");
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("says when copying is blocked", async () => {
    Object.defineProperty(document, "execCommand", {
      value: () => {
        throw new Error("blocked");
      },
      configurable: true,
    });
    expect(await copyText("hello")).toBe(false);
    expect(document.querySelector("textarea")).toBeNull();
  });
});

import { afterEach, describe, expect, it } from "vitest";

import { enterPip, exitPip, inPip, movePip, pipSupported } from "./pip";
import { fakePip } from "./test-fixtures";

let pip: ReturnType<typeof fakePip> | undefined;

afterEach(() => {
  pip?.restore();
  pip = undefined;
});

/** A video as WebKit on the iPhone has it: presentation modes, no standard API. */
function webkitVideo(): HTMLVideoElement & { webkitPresentationMode: string } {
  const video = document.createElement("video") as HTMLVideoElement & {
    webkitPresentationMode: string;
    webkitSupportsPresentationMode: (mode: string) => boolean;
    webkitSetPresentationMode: (mode: string) => void;
  };
  video.webkitPresentationMode = "inline";
  video.webkitSupportsPresentationMode = (mode) => mode === "picture-in-picture";
  video.webkitSetPresentationMode = (mode) => {
    video.webkitPresentationMode = mode;
    video.dispatchEvent(new Event("webkitpresentationmodechanged"));
  };
  return video;
}

describe("picture-in-picture", () => {
  it("uses the standard API, and moves the window from one video to another", async () => {
    expect(pipSupported()).toBe(false); // none in this test browser
    pip = fakePip();
    expect(pipSupported()).toBe(true);
    const a = document.createElement("video");
    const b = document.createElement("video");
    await enterPip(a);
    expect(inPip(a)).toBe(true);
    expect(inPip(b)).toBe(false);
    expect(await movePip(a, b)).toBe(true);
    expect(pip.element()).toBe(b);
    expect(await movePip(a, b)).toBe(false); // a is not in it now
    await exitPip(a); // not in it: nothing
    expect(inPip(b)).toBe(true);
    await exitPip(b);
    expect(inPip(b)).toBe(false);
    expect(inPip(null)).toBe(false);
  });

  it("closes the window when the browser will not move it, rather than leave it empty", async () => {
    pip = fakePip();
    const a = document.createElement("video");
    const b = document.createElement("video");
    await enterPip(a);
    pip.refuse(true);
    expect(await movePip(a, b)).toBe(false);
    expect(pip.element()).toBeNull();
  });

  it("uses WebKit's presentation mode where the standard API is missing", async () => {
    const video = webkitVideo();
    expect(pipSupported(video)).toBe(true);
    await enterPip(video);
    expect(video.webkitPresentationMode).toBe("picture-in-picture");
    expect(inPip(video)).toBe(true);
    await exitPip(video);
    expect(video.webkitPresentationMode).toBe("inline");
    await expect(enterPip(document.createElement("video"))).rejects.toThrow("no picture-in-picture");
  });
});

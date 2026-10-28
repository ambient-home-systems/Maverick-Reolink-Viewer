import { describe, expect, it } from "vitest";

import { explainLive } from "./explain";

describe("live errors in plain words", () => {
  const text = (error: string, battery = false) => explainLive(error, battery).text;

  it("says what happened, whatever the transport said it with", () => {
    expect(text("MSE: every stream slot of this host is in use")).toBe(
      "Too many cameras are streaming from this recorder at once.",
    );
    expect(text("WebRTC: go2rtc is not running")).toBe("Live view's video service is not running.");
    expect(text("WebRTC: did not start within 30 s")).toBe("Live view's video service is not running.");
    expect(text('MSE: MSE refused video/mp4; codecs="hvc1.1.6.L153.B0": NotSupportedError')).toBe(
      "This browser cannot play this camera's video.",
    );
    expect(text("MSE: this browser has no MediaSource")).toBe("This browser cannot play this camera's video.");
    expect(text("WebRTC: streams: wrong user/pass")).toBe("The camera refused Home Assistant's login.");
    expect(text("WebRTC: 401 Unauthorized")).toBe("The camera refused Home Assistant's login.");
    expect(text("MSE: streams: dial tcp 192.168.1.5:554: i/o timeout")).toBe("The camera did not answer.");
    expect(text("WebRTC: the camera did not give its stream address")).toBe("The camera did not answer.");
    expect(text("WebRTC: ICE failed: no path between the browser and the server")).toBe(
      "No connection for live video could be made from here.",
    );
    expect(text("MSE: no frame within 12 s")).toBe("The camera sent no picture in time.");
    expect(text("MSE: the server closed the stream")).toBe("The camera's video stopped.");
    expect(text("MSE: go2rtc closed the stream")).toBe("The camera's video stopped.");
    expect(text("something new")).toBe("Live video stopped.");
  });

  it("says a battery camera that does not answer could not be woken", () => {
    expect(text("WebRTC: no frame within 15 s", true)).toBe("It could not be woken.");
    expect(text("MSE: streams: dial tcp: connection refused", true)).toBe("It could not be woken.");
    expect(explainLive("WebRTC: no frame within 15 s", true).advice).toContain("low on battery");
    // What is not about waking says so, battery or not.
    expect(text("MSE: every stream slot of this host is in use", true)).toBe(
      "Too many cameras are streaming from this recorder at once.",
    );
  });

  it("always says what to do", () => {
    for (const error of ["MSE: no frame within 12 s", "x", "WebRTC: 401", "MSE: the server closed the stream"]) {
      expect(explainLive(error).advice).toBeTruthy();
    }
  });
});

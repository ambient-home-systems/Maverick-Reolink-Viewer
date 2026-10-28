import { describe, expect, it } from "vitest";

import { explainPlayback, explainRecordings } from "./explain";

describe("explainRecordings", () => {
  const online = { name: "Front Yard", offline: false };

  it("puts a camera being offline first, whatever the error says", () => {
    expect(explainRecordings("timeout", { name: "Front Yard", offline: true })).toEqual({
      text: "Front Yard is offline, so the recordings on its SD card cannot be read.",
      advice: "They come back when it does.",
    });
  });

  it.each([
    ["Reolink Viewer is not loaded", "Reolink Viewer is not running."],
    ["day search failed", "The recorder did not answer when asked for this day's recordings."],
    ["Timed out after 30 s", "The recorder did not answer when asked for this day's recordings."],
    ["host unreachable", "The recorder did not answer when asked for this day's recordings."],
    ["something new", "The recordings could not be read."],
  ])("%s", (error, text) => {
    const explained = explainRecordings(error, online);
    expect(explained.text).toBe(text);
    expect(explained.advice).toBeTruthy();
  });
});

describe("explainPlayback", () => {
  it.each([
    ["Not enough free disk space for the recording", "Home Assistant's disk is too full to fetch this recording."],
    ["no main-stream recording for this time", "There is no HD copy of this recording."],
    ["unknown segment s1", "This recording is no longer there: the recorder may have recorded over it."],
    ["empty recording", "This recording is empty."],
    ["media error 4", "This browser cannot play this recording."],
    ["MEDIA_ERR_SRC_NOT_SUPPORTED", "This browser cannot play this recording."],
    ["no supported streams", "This browser cannot play this recording."],
    ["decode", "This browser cannot play this recording."],
    ["HTTP 403", "The recording's link has expired."],
    ["signed URL expired", "The recording's link has expired."],
    ["cache failed: reset by peer", "The recording could not be fetched."],
    ["Failed to fetch", "The recording could not be fetched."],
    ["HTTP 502", "The recording could not be fetched."],
    ["AbortError", "The recording could not be fetched."],
    ["something new", "This recording could not play."],
  ])("%s", (error, text) => {
    const explained = explainPlayback(error);
    expect(explained.text).toBe(text);
    expect(explained.advice).toBeTruthy();
  });
});

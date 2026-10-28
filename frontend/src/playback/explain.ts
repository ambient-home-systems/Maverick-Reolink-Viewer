// Why recordings cannot be read or played, in plain words, and what to do
// (Phase 4 step 4.2). The Playback tab shows these; the technical text stays
// under Details, where support can read it.
import type { Explained } from "../live/explain";

/** Why a day's (or a month's) recordings could not be read. */
export function explainRecordings(error: string, context: { name: string; offline: boolean }): Explained {
  if (context.offline) {
    return {
      text: `${context.name} is offline, so the recordings on its SD card cannot be read.`,
      advice: "They come back when it does.",
    };
  }
  if (/not loaded/i.test(error)) {
    return {
      text: "Reolink Viewer is not running.",
      advice: "Check it under Settings → Devices & services, then open the day again.",
    };
  }
  if (/search failed|timeout|timed? ?out|connection|unreachable/i.test(error)) {
    return {
      text: "The recorder did not answer when asked for this day's recordings.",
      advice: "Try again in a moment. If it stays, check that the NVR or camera is online.",
    };
  }
  return { text: "The recordings could not be read.", advice: "Try again in a moment." };
}

/** Why a recording could not play. */
export function explainPlayback(error: string): Explained {
  if (/not enough free disk space/i.test(error)) {
    return {
      text: "Home Assistant's disk is too full to fetch this recording.",
      advice: "Free some space on it, then play the recording again.",
    };
  }
  if (/no main-stream recording/i.test(error)) {
    return { text: "There is no HD copy of this recording.", advice: "Play it in SD." };
  }
  if (/unknown segment/i.test(error)) {
    return {
      text: "This recording is no longer there: the recorder may have recorded over it.",
      advice: "Open the day again.",
    };
  }
  if (/empty recording/i.test(error)) {
    return { text: "This recording is empty.", advice: "Pick another event." };
  }
  if (/media error 4|SRC_NOT_SUPPORTED|not supported|no supported|codec|no moov|not playable|decod|demux|pipeline/i.test(error)) {
    return {
      text: "This browser cannot play this recording.",
      advice: "Try Chrome or Safari, or play it in SD.",
    };
  }
  if (/\b40[34]\b|expired|forbidden|not found/i.test(error)) {
    return { text: "The recording's link has expired.", advice: "Play it again." };
  }
  if (/search failed|cache failed|timeout|timed? ?out|network|failed to fetch|\b5\d\d\b|abort/i.test(error)) {
    return {
      text: "The recording could not be fetched.",
      advice: "Check the connection to Home Assistant, then play it again.",
    };
  }
  return { text: "This recording could not play.", advice: "Try it again, or pick another event." };
}

// Why live video cannot play, in plain words, and what to do (Phase 4 step 4).
// A tile shows these; the technical text stays in its debug view (ⓘ), where
// support can read it.

export interface Explained {
  /** What happened, in a sentence. */
  text: string;
  /** What to do about it, if anything. */
  advice?: string;
}

const BUSY: Explained = {
  text: "Too many cameras are streaming from this recorder at once.",
  advice: "Close live view on another screen, or keep fewer cameras warm.",
};
const SERVICE: Explained = {
  text: "Live view's video service is not running.",
  advice: "Restart Home Assistant. If it stays, run the live check.",
};
const FORMAT: Explained = {
  text: "This browser cannot play this camera's video.",
  advice: "Try Chrome or Safari, or set the camera's video to H.264 in the Reolink app.",
};
const LOGIN: Explained = {
  text: "The camera refused Home Assistant's login.",
  advice: "Check its password in the Reolink integration.",
};
const WAKE: Explained = {
  text: "It could not be woken.",
  advice: "It may be out of Wi-Fi range or low on battery. Try again in a moment.",
};
const NO_ANSWER: Explained = {
  text: "The camera did not answer.",
  advice: "Check that it is powered and connected. It tries again by itself.",
};
const NO_PATH: Explained = {
  text: "No connection for live video could be made from here.",
  advice: "It tries again by itself. If it stays, run the live check on this device.",
};
const NO_PICTURE: Explained = {
  text: "The camera sent no picture in time.",
  advice: "It may be busy, or far from its Wi-Fi. It tries again by itself.",
};
const ENDED: Explained = { text: "The camera's video stopped.", advice: "It starts again by itself." };

/** What a camera's failure to answer looks like, whatever said it. */
const UNANSWERED = /did not give its stream address|i\/o timeout|timed? ?out|connection refused|no route to host|unreachable|dial tcp|\bEOF\b/i;

/** Why live video cannot play: `error` as a player gives it ("MSE: …"). */
export function explainLive(error: string, battery = false): Explained {
  if (/every stream slot|slots? .*in use/i.test(error)) return BUSY;
  if (/go2rtc (is not running|is not installed|did not start)|did not start within|exited with code/i.test(error)) {
    return SERVICE;
  }
  if (/refused (video|audio)|MSE refused|codec|no MediaSource|append failed|not supported/i.test(error)) return FORMAT;
  if (/\b401\b|unauthori[sz]ed|wrong (user|password)|password/i.test(error)) return LOGIN;
  // A battery camera that does not answer was asleep and did not wake.
  if (battery && (UNANSWERED.test(error) || /no frame|closed the stream/i.test(error))) return WAKE;
  if (UNANSWERED.test(error)) return NO_ANSWER;
  if (/ICE failed|no path/i.test(error)) return NO_PATH;
  if (/no frame within|no new frame/i.test(error)) return NO_PICTURE;
  if (/closed the stream|stream ended/i.test(error)) return ENDED;
  return { text: "Live video stopped.", advice: "It tries again by itself. The ⓘ view has the details." };
}

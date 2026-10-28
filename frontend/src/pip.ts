// Picture-in-picture: a video in a small window that stays on top while the
// page is behind other windows or apps. The standard API where the browser
// has it (Chrome, Edge, Safari on the Mac), else WebKit's presentation mode
// (the iPhone and iPad). Firefox has no API: it offers its own button on
// videos, so the panel shows none there.

type WebKitVideo = HTMLVideoElement & {
  webkitSupportsPresentationMode?: (mode: string) => boolean;
  webkitSetPresentationMode?: (mode: string) => void;
  webkitPresentationMode?: string;
};

const PIP = "picture-in-picture";

function standard(): boolean {
  return document.pictureInPictureEnabled && typeof HTMLVideoElement.prototype.requestPictureInPicture === "function";
}

/** Whether this browser can put a video in picture-in-picture. */
export function pipSupported(video: HTMLVideoElement = document.createElement("video")): boolean {
  if (standard()) return true;
  const webkit = video as WebKitVideo;
  return typeof webkit.webkitSupportsPresentationMode === "function" && webkit.webkitSupportsPresentationMode(PIP);
}

/** Whether a video is in picture-in-picture now. */
export function inPip(video: HTMLVideoElement | null | undefined): boolean {
  if (!video) return false;
  return document.pictureInPictureElement === video || (video as WebKitVideo).webkitPresentationMode === PIP;
}

/**
 * Put a video in picture-in-picture. Browsers allow it from a click, or to
 * move a picture-in-picture window to another video.
 */
export async function enterPip(video: HTMLVideoElement): Promise<void> {
  if (standard()) {
    await video.requestPictureInPicture();
    return;
  }
  const webkit = video as WebKitVideo;
  if (typeof webkit.webkitSetPresentationMode !== "function") {
    throw new Error("this browser has no picture-in-picture");
  }
  webkit.webkitSetPresentationMode(PIP);
}

/** Take a video out of picture-in-picture (nothing if it is not in it). */
export async function exitPip(video: HTMLVideoElement | null | undefined): Promise<void> {
  if (!video) return;
  if (document.pictureInPictureElement === video) {
    await document.exitPictureInPicture();
    return;
  }
  const webkit = video as WebKitVideo;
  if (webkit.webkitPresentationMode === PIP) webkit.webkitSetPresentationMode?.("inline");
}

/**
 * Move picture-in-picture from one video to another (a player swapping its
 * videos); if the browser will not, close it rather than leave it empty.
 * Returns whether it moved.
 */
export async function movePip(from: HTMLVideoElement, to: HTMLVideoElement): Promise<boolean> {
  if (!inPip(from)) return false;
  try {
    await enterPip(to);
    return true;
  } catch {
    await exitPip(from).catch(() => undefined);
    return false;
  }
}

/** The video events that say a video entered or left picture-in-picture. */
export const PIP_EVENTS = ["enterpictureinpicture", "leavepictureinpicture", "webkitpresentationmodechanged"] as const;

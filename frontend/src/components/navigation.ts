// In-panel navigation, mirrored in the URL hash so back/forward work.

export type Tab = "overview" | "live" | "settings" | "playback";

export type Route =
  | { view: "list" }
  | { view: "live" }
  | { view: "live-check" }
  | { view: "soak" }
  | { view: "device"; id: string; tab: Tab };

export const NAVIGATE_EVENT = "rv-navigate";
export const TOAST_EVENT = "rv-toast";

export interface ToastDetail {
  message: string;
  kind: "info" | "error";
}

export function navigate(from: HTMLElement, route: Route): void {
  from.dispatchEvent(
    new CustomEvent<Route>(NAVIGATE_EVENT, { detail: route, bubbles: true, composed: true }),
  );
}

export function toast(from: HTMLElement, message: string, kind: ToastDetail["kind"] = "info"): void {
  from.dispatchEvent(
    new CustomEvent<ToastDetail>(TOAST_EVENT, {
      detail: { message, kind },
      bubbles: true,
      composed: true,
    }),
  );
}

/** Live is the home view (no hash); the device list is #devices. */
export function routeToHash(route: Route): string {
  if (route.view === "live-check") return "#live-check";
  if (route.view === "soak") return "#soak";
  if (route.view === "list") return "#devices";
  return route.view === "live" ? "" : `#device/${encodeURIComponent(route.id)}/${route.tab}`;
}

export function routeFromHash(hash: string): Route {
  if (hash === "#live-check") return { view: "live-check" };
  if (hash === "#soak") return { view: "soak" };
  if (hash === "#devices") return { view: "list" };
  const match = /^#device\/([^/]+)(?:\/(overview|live|settings|playback))?$/.exec(hash);
  if (!match?.[1]) return { view: "live" };
  const tab = match[2];
  return {
    view: "device",
    id: decodeURIComponent(match[1]),
    tab: tab === "live" || tab === "settings" || tab === "playback" ? tab : "overview",
  };
}

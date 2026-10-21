// In-panel navigation, mirrored in the URL hash so back/forward work.

export type Tab = "overview" | "settings" | "playback";

export type Route = { view: "list" } | { view: "live-check" } | { view: "device"; id: string; tab: Tab };

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

export function routeToHash(route: Route): string {
  if (route.view === "live-check") return "#live-check";
  return route.view === "list" ? "" : `#device/${encodeURIComponent(route.id)}/${route.tab}`;
}

export function routeFromHash(hash: string): Route {
  if (hash === "#live-check") return { view: "live-check" };
  const match = /^#device\/([^/]+)(?:\/(overview|settings|playback))?$/.exec(hash);
  if (!match?.[1]) return { view: "list" };
  const tab = match[2];
  return {
    view: "device",
    id: decodeURIComponent(match[1]),
    tab: tab === "settings" || tab === "playback" ? tab : "overview",
  };
}

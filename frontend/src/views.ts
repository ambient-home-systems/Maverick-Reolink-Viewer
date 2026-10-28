// The views beyond the home page load the first time they are shown, so the
// panel's first download is the live board and today's timetable (Phase 4's
// performance budget: the rest are separate files beside the panel's module).
// An element rendered before its file arrives is upgraded when it does.
import type { Route } from "./components/navigation";

const LOADERS: Partial<Record<Route["view"], () => Promise<unknown>>> = {
  events: () => import("./components/events-view"),
  list: () => import("./components/device-list"),
  device: () => import("./components/device-page"),
  "live-check": () => import("./components/live-check"),
  soak: () => import("./components/live-soak"),
};

const loading = new Map<string, Promise<unknown>>();

/** Load a view's elements once; resolves when they are defined (the home view's are). */
export function loadView(view: Route["view"]): Promise<unknown> {
  const loader = LOADERS[view];
  if (!loader) return Promise.resolve();
  let promise = loading.get(view);
  if (!promise) {
    promise = loader().catch((err: unknown) => {
      // A failed download is tried again the next time the view is shown.
      loading.delete(view);
      throw err;
    });
    loading.set(view, promise);
  }
  return promise;
}

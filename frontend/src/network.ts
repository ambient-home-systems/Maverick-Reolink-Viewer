// Where this page reaches Home Assistant from, and what full screen plays
// there (Phase 4 step 3.3): HD at home, the lighter SD away from home or on
// mobile data, unless the viewer chose otherwise on this device. The choice
// is remembered per device, for at home and for away, in the browser.

/** How Home Assistant is reached, from the page's host name (never reported). */
export function classifyHost(hostname: string): string {
  const host = hostname.toLowerCase();
  if (host.endsWith(".ui.nabu.casa")) return "Nabu Casa";
  if (host.endsWith(".ts.net")) return "Tailscale";
  const ip = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(host);
  if (ip) {
    const [a = 0, b = 0] = ip.slice(1, 3).map(Number);
    // Tailscale hands out addresses in 100.64.0.0/10.
    if (a === 100 && b >= 64 && b < 128) return "Tailscale";
    if (a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b < 32)) return "local";
    return "remote";
  }
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".lan") || !host.includes(".")) {
    return "local";
  }
  // A name of your own: through a proxy, a tunnel or local DNS, it cannot tell.
  return "own domain";
}

export type Where = "home" | "away";

export interface Link {
  where: Where;
  /** Why, in words that follow "Lighter SD": "through Nabu Casa", "on mobile data". */
  why: string;
}

/** What the browser says of its network, where it says anything (Chrome on Android). */
export interface NetworkInfo {
  type?: string;
  saveData?: boolean;
  effectiveType?: string;
}

const browserNetwork = (): NetworkInfo | undefined => (navigator as { connection?: NetworkInfo }).connection;

/** Where this page is: at home, or away (a remote link, mobile data, data saver). */
export function currentLink(hostname: string = location.hostname, net: NetworkInfo | undefined = browserNetwork()): Link {
  if (net?.saveData) return { where: "away", why: "with data saver on" };
  if (net?.type === "cellular") return { where: "away", why: "on mobile data" };
  if (net?.effectiveType && /2g|3g/.test(net.effectiveType)) return { where: "away", why: "on a slow connection" };
  switch (classifyHost(hostname)) {
    case "Nabu Casa":
      return { where: "away", why: "through Nabu Casa" };
    case "Tailscale":
      return { where: "away", why: "through Tailscale" };
    case "remote":
      return { where: "away", why: "away from home" };
    default:
      // At home, or a name of your own that cannot tell: as at home.
      return { where: "home", why: "at home" };
  }
}

const KEY = "reolink-viewer.full-screen-hd";

function remembered(): Partial<Record<Where, boolean>> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

/** Whether full screen plays HD here, and whether the viewer chose it on this device. */
export function fullScreenHd(link: Link): { hd: boolean; chosen: boolean } {
  const choice: unknown = remembered()[link.where];
  return typeof choice === "boolean" ? { hd: choice, chosen: true } : { hd: link.where === "home", chosen: false };
}

/** Remember the viewer's choice of HD in full screen, at home or away, on this device. */
export function rememberFullScreenHd(where: Where, hd: boolean): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...remembered(), [where]: hd }));
  } catch {
    // Not remembered (private browsing): it holds until the page closes.
  }
}

// The design preview: the real panel, mounted with a fake Home Assistant and
// Home Assistant's default theme (light or dark). Query: ?theme=dark&admin=0,
// &offline=cam-fyr,cam-dogs for cameras Home Assistant cannot reach,
// &disk=cam-door,dev-nvr for an SD card or the NVR's disk that is not ready,
// &degraded=changed|stopped|none when Reolink Viewer cannot reach the cameras
// (an update changed the Reolink integration, it is not running, no devices),
// &fail=board,events,day,tiles,devices to fail the board's, the events', a
// day's recordings', the tiles' or the device list's requests;
// the view is the URL hash, as in Home Assistant (none for Live, #devices,
// #device/cam-fyr/playback). &dashboard=1 shows a dashboard instead, with the
// Reolink camera card (Phase 7) and its editor.
import "../src/reolink-viewer-panel";
import "../src/card/index";
import { fakeHass } from "./fake-hass";

// Home Assistant's default theme variables (2026), light and dark.
const THEMES: Partial<Record<string, Record<string, string>>> = {
  light: {
    "--primary-color": "#03a9f4",
    "--accent-color": "#ff9800",
    "--primary-background-color": "#fafafa",
    "--secondary-background-color": "#e5e5e5",
    "--card-background-color": "#ffffff",
    "--primary-text-color": "#212121",
    "--secondary-text-color": "#727272",
    "--text-primary-color": "#ffffff",
    "--divider-color": "rgba(0, 0, 0, 0.12)",
    "--error-color": "#db4437",
    "--warning-color": "#ffa600",
    "--success-color": "#43a047",
    "--app-header-background-color": "#03a9f4",
    "--app-header-text-color": "#ffffff",
  },
  dark: {
    "--primary-color": "#03a9f4",
    "--accent-color": "#ff9800",
    "--primary-background-color": "#111111",
    "--secondary-background-color": "#282828",
    "--card-background-color": "#1c1c1c",
    "--primary-text-color": "#e1e1e1",
    "--secondary-text-color": "#9b9b9b",
    "--text-primary-color": "#ffffff",
    "--divider-color": "rgba(225, 225, 225, 0.12)",
    "--error-color": "#db4437",
    "--warning-color": "#ffa600",
    "--success-color": "#43a047",
    "--app-header-background-color": "#101e24",
    "--app-header-text-color": "#e1e1e1",
  },
};

const params = new URLSearchParams(window.location.search);
const theme = THEMES[params.get("theme") ?? "light"] ?? THEMES.light ?? {};
for (const [name, value] of Object.entries(theme)) document.documentElement.style.setProperty(name, value);
document.body.style.margin = "0";
document.body.style.background = "var(--primary-background-color)";
document.body.style.fontFamily = "Roboto, Noto, 'Noto Sans', sans-serif";

const hass = fakeHass({
  admin: params.get("admin") !== "0",
  dark: params.get("theme") === "dark",
  offline: (params.get("offline") ?? "").split(",").filter(Boolean),
  disks: (params.get("disk") ?? "").split(",").filter(Boolean),
  elsewhere: (params.get("elsewhere") ?? "").split(",").filter(Boolean),
  degraded: params.get("degraded"),
  fail: (params.get("fail") ?? "").split(",").filter(Boolean),
});

/** Home Assistant's card, as its dashboards draw it (the real one is HA's own). */
class FakeHaCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" }).innerHTML =
      "<style>:host{display:block;background:var(--card-background-color);border:1px solid var(--divider-color);border-radius:12px;color:var(--primary-text-color)}</style><slot></slot>";
  }
}

/** A dashboard's two columns: the Doorbell and the front yard, a card with no camera, and the editor. */
function dashboard(): void {
  customElements.define("ha-card", FakeHaCard);
  const page = document.createElement("main");
  page.style.cssText =
    "display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:8px;padding:8px;max-width:980px;align-items:start";
  const title = document.createElement("h1");
  title.textContent = "Wall tablet";
  title.style.cssText = "grid-column:1/-1;margin:8px 4px;font-size:20px;font-weight:400;color:var(--primary-text-color)";
  page.append(title);
  const column = () => {
    const div = document.createElement("div");
    div.style.cssText = "display:flex;flex-direction:column;gap:8px;min-width:0";
    page.append(div);
    return div;
  };
  const card = (into: HTMLElement, config: Record<string, unknown>) => {
    const el = document.createElement("reolink-viewer-camera");
    el.setConfig({ type: "custom:reolink-viewer-camera", ...config });
    el.hass = hass;
    into.append(el);
  };
  const left = column();
  const right = column();
  card(left, { camera: "cam-door", fit: "contain" });
  card(right, { camera: "cam-fyr", tap_action: "open_panel", show_state: false });
  card(right, {});
  const box = document.createElement("ha-card");
  box.style.padding = "16px";
  const heading = document.createElement("h2");
  heading.textContent = "Card settings";
  heading.style.cssText = "margin:0 0 12px;font-size:16px;font-weight:500";
  void customElements.whenDefined("reolink-viewer-camera").then(async () => {
    const editor = await (
      customElements.get("reolink-viewer-camera") as unknown as { getConfigElement(): Promise<HTMLElement> }
    ).getConfigElement();
    (editor as HTMLElement & { setConfig(c: unknown): void; hass: unknown }).setConfig({
      type: "custom:reolink-viewer-camera",
      camera: "cam-fyr",
    });
    (editor as HTMLElement & { hass: unknown }).hass = hass;
    box.append(heading, editor);
  });
  left.append(box);
  document.body.append(page);
}

if (params.get("dashboard")) dashboard();
else {
  const panel = document.createElement("reolink-viewer-panel");
  panel.hass = hass;
  panel.narrow = window.innerWidth < 870;
  document.body.appendChild(panel);
}

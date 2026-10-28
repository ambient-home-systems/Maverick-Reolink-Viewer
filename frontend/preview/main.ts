// The design preview: the real panel, mounted with a fake Home Assistant and
// Home Assistant's default theme (light or dark). Query: ?theme=dark&admin=0;
// the view is the URL hash, as in Home Assistant (none for Live, #devices,
// #device/cam-fyr/playback).
import "../src/reolink-viewer-panel";
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

const panel = document.createElement("reolink-viewer-panel");
panel.hass = fakeHass({ admin: params.get("admin") !== "0", dark: params.get("theme") === "dark" });
panel.narrow = window.innerWidth < 870;
document.body.appendChild(panel);

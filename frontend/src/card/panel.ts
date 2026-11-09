// Opening the Reolink panel from a dashboard card, as Home Assistant's own
// links do: the address changes and Home Assistant shows the panel.

/** The panel's address (const.py's PANEL_URL_PATH). */
export const PANEL_PATH = "/reolink-viewer";

/** Open the panel at one of its own addresses ("#device/<id>/live", ""). */
export function openPanel(hash: string): void {
  history.pushState(null, "", `${PANEL_PATH}${hash}`);
  window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
}

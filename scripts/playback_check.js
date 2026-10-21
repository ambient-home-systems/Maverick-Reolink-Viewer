// Playback check (Phase 2B): paste into Chrome DevTools (Console) while the
// Reolink panel's Playback tab is open for a camera. It runs the check built
// into the panel (the same as Playback tab → Debug → Run playback check, which
// is how to run it on a phone) and prints the report, also copying it to the
// clipboard. Read-only: it loads timelines and plays recordings, like clicking
// through the tab. Run it on one camera at a time: two runs share the NVR.
//
// For the one-hour session (memory and disk), set SESSION_MIN to 60. WITH_HD
// switches to HD and back (the server fetches a main recording from the NVR).
// To run it without opening DevTools, see scripts/desktop-check/.
(async () => {
  const SETUP = "Desktop Chrome, LAN";
  const SESSION_MIN = 0;
  const WITH_HD = true;
  const deep = (root, sel) => {
    const hit = root.querySelector(sel);
    if (hit) return hit;
    for (const el of root.querySelectorAll("*")) {
      const found = el.shadowRoot && deep(el.shadowRoot, sel);
      if (found) return found;
    }
    return null;
  };
  const el = deep(document, "rv-playback");
  if (!el) return console.error("Open a camera's Playback tab first.");
  if (typeof el.runCheck !== "function") {
    return console.error("This panel has no built-in check: update Reolink Viewer to v0.2.8 or later and reload.");
  }
  console.log("Running the playback check… (the report also appears under Debug in the tab)");
  const report = await el.runCheck({ setup: SETUP, soakMinutes: SESSION_MIN, hd: WITH_HD });
  console.log(report);
  try {
    // DevTools' copy() works without page focus; the Clipboard API needs it.
    if (typeof copy === "function") copy(report);
    else await navigator.clipboard.writeText(report);
    console.log("%cReport copied to the clipboard.", "font-weight:bold");
  } catch {
    console.log("%cSelect the report above and copy it.", "font-weight:bold");
  }
})();

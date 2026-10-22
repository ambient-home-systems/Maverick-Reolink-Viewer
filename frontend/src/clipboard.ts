// Copying a report: the Clipboard API exists only on secure pages, and the
// Companion app on the LAN often loads Home Assistant over plain HTTP.

/** Copy text: the Clipboard API (secure pages), else a selected textarea. */
export async function copyText(text: string): Promise<boolean> {
  // Undefined on plain-HTTP pages (as Home Assistant is on the LAN).
  const clipboard = (navigator as { clipboard?: Clipboard }).clipboard;
  try {
    if (window.isSecureContext && clipboard) {
      await clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall back below.
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.cssText = "position:fixed;top:0;left:0;opacity:0";
  document.body.append(area);
  area.select();
  area.setSelectionRange(0, text.length);
  try {
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- the only way on plain-HTTP pages
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area.remove();
  }
}

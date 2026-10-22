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
  // Off screen rather than invisible, read-only (no keyboard) and 12 pt (no
  // zoom): what iOS WebKit selects and copies, as clipboard.js does it.
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.cssText = `position:absolute;left:-9999px;top:${window.scrollY}px;font-size:12pt;border:0;padding:0;margin:0`;
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

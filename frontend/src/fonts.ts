// Barlow and Barlow Semi Condensed (SIL Open Font License, fonts/OFL.txt),
// the latin subset, served by the integration beside the panel's module: the
// panel needs no font CDN, so it works without internet access. @font-face
// only takes effect in the document, not in a shadow root.

const FACES: [family: string, weight: number, file: string][] = [
  ["Barlow", 400, "barlow-400.woff2"],
  ["Barlow", 500, "barlow-500.woff2"],
  ["Barlow", 600, "barlow-600.woff2"],
  ["Barlow Semi Condensed", 500, "barlow-semi-condensed-500.woff2"],
  ["Barlow Semi Condensed", 600, "barlow-semi-condensed-600.woff2"],
];

const STYLE_ID = "reolink-viewer-fonts";

/** Add the faces to the document, once; `moduleUrl` is the panel module's URL. */
export function loadFonts(moduleUrl: string, doc: Document = document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = FACES.map(([family, weight, file]) => {
    const url = new URL(`fonts/${file}`, moduleUrl).href;
    return `@font-face{font-family:"${family}";font-style:normal;font-weight:${weight};font-display:swap;src:url("${url}") format("woff2");}`;
  }).join("\n");
  doc.head.appendChild(style);
}

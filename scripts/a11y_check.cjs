// The accessibility check (docs/IMPLEMENTATION_PLAN.md, Phase 4 step 5): every
// view of the design preview (frontend/.preview, from `npx vite build -c
// vite.preview.config.ts`), light and dark, desktop and phone, is checked by
// axe-core against WCAG 2.1 AA, inside the panel's shadow roots. Then the
// keyboard: Tab goes through each view, and everything it reaches must have a
// name, and show where the focus is.
//
//   node scripts/a11y_check.cjs [preview-dir] [--tabs]
//
// --tabs prints each view's Tab order. Any violation fails the check.
const { chromium } = require("playwright");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const args = process.argv.slice(2);
const ROOT = path.resolve(args.find((a) => !a.startsWith("--")) ?? path.join(__dirname, "..", "frontend", ".preview"));
const SHOW_TABS = args.includes("--tabs");
const AXE = require.resolve("axe-core/axe.min.js", { paths: [path.join(__dirname, "..", "frontend")] });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".jpg": "image/jpeg", ".woff2": "font/woff2" };

// Every view, and the states that change what is on it: a query and hash,
// or that and what to press first (a selector, through the shadow roots).
const VIEWS = {
  live: "",
  events: "#events",
  devices: "#devices",
  overview: "#device/cam-fyr/overview",
  "live-tab": "#device/cam-fyr/live",
  settings: "#device/cam-fyr/settings",
  playback: "#device/cam-fyr/playback",
  "live-check": "#live-check",
  soak: "#soak",
  "no-recordings": "#device/cam-laundry/playback",
  "offline-board": "&offline=cam-dogs,cam-garage",
  "tile-errors": "&fail=tiles",
  "day-error": "&fail=day#device/cam-fyr/playback",
  "disk-not-ready": "&disk=cam-door#device/cam-door/overview",
  "changed-board": "&degraded=changed",
  "changed-devices": "&degraded=changed#devices",
  "ptz-controls": "#device/cam-laundry/live",
  "light-and-siren": "#device/cam-fyl/live",
  "siren-confirm": { hash: "#device/cam-fyl/live", press: "button.siren" },
  "full-screen": { hash: "", press: ".corner-button.full" },
  "debug-view": { hash: "", press: ".corner-button.info" },
};
const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  phone: { width: 390, height: 844 },
};
const MAX_TABS = 160;

function serve() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    const file = path.join(ROOT, decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname));
    if (!file.startsWith(ROOT) || !fs.existsSync(file)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

/** axe's WCAG 2.1 AA rules over the page, shadow roots included. */
async function axe(page) {
  await page.addScriptTag({ path: AXE });
  return page.evaluate(async () => {
    const result = await window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
      resultTypes: ["violations"],
    });
    return result.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.map((n) => ({ target: n.target.flat().join(" > "), summary: n.failureSummary })),
    }));
  });
}

/** What Tab reaches, in order: each element's name and role, and whether its focus shows. */
async function tabWalk(page) {
  const cdp = await page.context().newCDPSession(page);
  await page.evaluate(() => {
    document.activeElement?.blur?.();
  });
  const seen = [];
  for (let i = 0; i < MAX_TABS; i += 1) {
    await page.keyboard.press("Tab");
    // The browser's own accessible name and role of the focused element (through shadow roots).
    const { result } = await cdp.send("Runtime.evaluate", {
      expression: "(() => { let el = document.activeElement; while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement; return el; })()",
    });
    let ax = { name: "", role: "" };
    if (result.objectId) {
      const { node } = await cdp.send("DOM.describeNode", { objectId: result.objectId });
      const { nodes } = await cdp.send("Accessibility.getPartialAXTree", { backendNodeId: node.backendNodeId, fetchRelatives: false });
      const own = nodes.find((n) => n.backendDOMNodeId === node.backendNodeId) ?? nodes[0];
      ax = { name: own?.name?.value ?? "", role: own?.role?.value ?? "" };
    }
    const info = await page.evaluate(() => {
      let el = document.activeElement;
      while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
      if (!el || el === document.body) return null;
      const style = getComputedStyle(el);
      const outline = style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0;
      const ring = style.boxShadow !== "none";
      // A path to tell the elements apart, through their shadow hosts.
      const parts = [];
      for (let node = el; node; ) {
        parts.unshift(node.tagName.toLowerCase() + (node.className && typeof node.className === "string" ? `.${node.className.trim().split(/\s+/).join(".")}` : ""));
        const root = node.getRootNode();
        node = node.parentElement ?? (root instanceof ShadowRoot ? root.host : null);
        if (parts.length > 3) break;
      }
      return {
        key: parts.join(" > "),
        tag: el.tagName.toLowerCase(),
        visible: outline || ring,
        rect: el.getBoundingClientRect().toJSON(),
      };
    });
    if (!info) break;
    info.role = ax.role;
    info.name = ax.name.replace(/\s+/g, " ").trim().slice(0, 80);
    const id = `${info.key}|${info.name}|${Math.round(info.rect.x)},${Math.round(info.rect.y)}`;
    if (seen.some((s) => s.id === id)) break; // round the page
    seen.push({ id, ...info });
  }
  return seen;
}

async function main() {
  const server = await serve();
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  let failures = 0;
  try {
    for (const [name, view] of Object.entries(VIEWS)) {
      const { hash, press } = typeof view === "string" ? { hash: view, press: undefined } : view;
      for (const theme of ["light", "dark"]) {
        for (const [size, viewport] of Object.entries(VIEWPORTS)) {
          const page = await browser.newPage({ viewport });
          const errors = [];
          page.on("pageerror", (err) => errors.push(String(err)));
          await page.goto(`${origin}/index.html?theme=${theme}${hash}`);
          await page.waitForTimeout(hash.includes("fail=tiles") ? 6000 : 1500);
          if (press) {
            // The keyboard's way in: focus it, then Enter.
            await page.locator(press).first().focus();
            await page.keyboard.press("Enter");
            await page.waitForTimeout(500);
          }
          const where = `${name} · ${theme} · ${size}`;
          const violations = await axe(page);
          for (const v of violations) {
            failures += 1;
            console.log(`✗ ${where}: ${v.id} (${v.impact}) ${v.help}`);
            for (const n of v.nodes.slice(0, 6)) console.log(`    ${n.target}\n      ${n.summary.split("\n").slice(0, 3).join(" ")}`);
            if (v.nodes.length > 6) console.log(`    … and ${v.nodes.length - 6} more`);
          }
          // The keyboard: once per view (the order does not change with the theme).
          if (theme === "light" && !press) {
            const tabs = await tabWalk(page);
            const unnamed = tabs.filter((t) => !t.name);
            const hidden = tabs.filter((t) => !t.visible);
            for (const t of unnamed) {
              failures += 1;
              console.log(`✗ ${where}: Tab reaches ${t.key} with no name`);
            }
            for (const t of hidden) {
              failures += 1;
              console.log(`✗ ${where}: Tab reaches ${t.key} ("${t.name}") without showing it`);
            }
            if (SHOW_TABS) {
              console.log(`  ${where}: ${tabs.length} stops`);
              for (const t of tabs) console.log(`    ${t.role ?? t.tag}: ${t.name || "(no name)"}${t.visible ? "" : " [focus not shown]"}`);
            }
          }
          for (const e of errors) {
            failures += 1;
            console.log(`✗ ${where}: page error ${e}`);
          }
          await page.close();
        }
      }
      console.log(`checked ${name}`);
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failures ? `${failures} accessibility problems` : "No accessibility problems found");
  if (failures) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

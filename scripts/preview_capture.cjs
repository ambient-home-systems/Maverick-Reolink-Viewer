// Screenshots of the design preview (frontend/preview, built into
// frontend/.preview by `npx vite build -c vite.preview.config.ts`): every
// view, light and dark, at desktop (1440) and phone (390) width.
//
//   node scripts/preview_capture.cjs <out-dir> [view ...]
//   node scripts/preview_capture.cjs <out-dir> errors
//   node scripts/preview_capture.cjs docs/images guide
//
// A view is one of the names below, or any hash (#device/cam-fyl/live), after
// the preview's query if any (&offline=cam-dogs#device/cam-dogs/live).
// Views: live (home), events, devices, overview, live-tab, settings, playback, live-check, soak.
// `errors` takes every error state instead (ERRORS below). `guide` takes the
// user docs' pictures (GUIDE below): light, as JPEGs, each at its own size.
// The pictures are synthetic (frontend/preview/make-media.sh).
const { chromium } = require("playwright");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..", "frontend", ".preview");
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
};
// Every error state the panel has (Phase 4 step 4), as the preview shows them.
const ERRORS = {
  "offline-board": "&offline=cam-dogs,cam-garage",
  "tile-errors": "&fail=tiles",
  "board-error": "&fail=board,events",
  "storage-playback": "&disk=cam-door#device/cam-door/playback",
  "storage-overview": "&disk=cam-door#device/cam-door/overview",
  "nvr-disk-playback": "&disk=dev-nvr#device/cam-garage/playback",
  "no-recordings": "#device/cam-laundry/playback",
  "day-error": "&fail=day#device/cam-fyr/playback",
  "offline-playback": "&offline=cam-door&fail=day#device/cam-door/playback",
  "changed-board": "&degraded=changed",
  "changed-devices": "&degraded=changed#devices",
  "changed-playback": "&degraded=changed#device/cam-fyr/playback",
  "stopped-board": "&degraded=stopped",
  "none-board": "&degraded=none",
  "devices-error": "&fail=devices#devices",
};
// The pictures in docs/user-guide.md and docs/troubleshooting.md: the view,
// and the window it is seen in (the part of the page in it).
const GUIDE_NOW = "2026-10-27T21:30:00-05:00";
const GUIDE = {
  "live-board": { hash: "", width: 1200, height: 760 },
  "live-board-phone": { hash: "", width: 390, height: 844, scale: 2 },
  events: { hash: "#events", width: 1200, height: 700 },
  devices: { hash: "#devices", width: 1200, height: 1360 },
  playback: { hash: "#device/cam-fyr/playback", width: 1200, height: 860 },
  "soak-report": { hash: "#soak", width: 1200, height: 800 },
  "needs-an-update": { hash: "&degraded=changed", width: 1200, height: 420 },
  "sd-card-not-ready": { hash: "&disk=cam-door#device/cam-door/playback", width: 1200, height: 860 },
};
const VIEWPORTS = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1 },
  mobile: { width: 390, height: 844, deviceScaleFactor: 2 },
};
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".jpg": "image/jpeg", ".json": "application/json", ".woff2": "font/woff2" };

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

async function main() {
  const [out = "preview-shots", ...wanted] = process.argv.slice(2);
  fs.mkdirSync(out, { recursive: true });
  const server = await serve();
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  const errors = [];
  try {
    if (wanted.length === 1 && wanted[0] === "guide") {
      for (const [name, shot] of Object.entries(GUIDE)) {
        const page = await browser.newPage({ viewport: { width: shot.width, height: shot.height }, deviceScaleFactor: shot.scale ?? 1 });
        page.on("pageerror", (err) => errors.push(`${name}: ${err}`));
        // The preview's day: its events end at 21:24 in Home Assistant's time zone.
        await page.clock.setFixedTime(new Date(GUIDE_NOW));
        await page.goto(`${origin}/index.html?theme=light${shot.hash}`);
        await page.waitForTimeout(1500);
        const file = path.join(out, `${name}.jpg`);
        await page.screenshot({ path: file, type: "jpeg", quality: 82 });
        await page.close();
        console.log(file);
      }
    }
    const views =
      wanted.length === 1 && wanted[0] === "guide"
        ? []
        : wanted.length === 1 && wanted[0] === "errors"
        ? Object.entries(ERRORS)
        : wanted.length
          ? wanted.map((view) => [view.replace(/^#/, "").replace(/[/&=,]/g, "-"), VIEWS[view] ?? view])
          : Object.entries(VIEWS);
    for (const [name, hash] of views) {
      for (const theme of ["light", "dark"]) {
        for (const [size, viewport] of Object.entries(VIEWPORTS)) {
          const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: viewport.deviceScaleFactor });
          page.on("pageerror", (err) => errors.push(`${name}/${theme}/${size}: ${err}`));
          await page.goto(`${origin}/index.html?theme=${theme}${hash}`);
          // Long enough for a failing tile to give up its first try.
          await page.waitForTimeout(hash.includes("fail=tiles") ? 6000 : 1500);
          const file = path.join(out, `${name}-${theme}-${size}.png`);
          await page.screenshot({ path: file, fullPage: true });
          await page.close();
          console.log(file);
        }
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
  if (errors.length) console.log(`page errors:\n${errors.join("\n")}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

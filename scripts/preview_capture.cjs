// Screenshots of the design preview (frontend/preview, built into
// frontend/.preview by `npx vite build -c vite.preview.config.ts`): every
// view, light and dark, at desktop (1440) and phone (390) width.
//
//   node scripts/preview_capture.cjs <out-dir> [view ...]
//
// A view is one of the names below, or any hash (#device/cam-fyl/live).
// Views: live (home), events, devices, overview, live-tab, settings, playback, live-check, soak.
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
    const views = wanted.length
      ? wanted.map((view) => [view.replace(/^#/, "").replace(/\//g, "-"), VIEWS[view] ?? view])
      : Object.entries(VIEWS);
    for (const [name, hash] of views) {
      for (const theme of ["light", "dark"]) {
        for (const [size, viewport] of Object.entries(VIEWPORTS)) {
          const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: viewport.deviceScaleFactor });
          page.on("pageerror", (err) => errors.push(`${name}/${theme}/${size}: ${err}`));
          await page.goto(`${origin}/index.html?theme=${theme}${hash}`);
          await page.waitForTimeout(1500);
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

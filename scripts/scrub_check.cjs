// The performance budget's scrubbing check (docs/IMPLEMENTATION_PLAN.md,
// Phase 4 step 2): drag along the Playback timeline of the design preview
// (frontend/.preview, from `npx vite build -c vite.preview.config.ts`) and
// count the main thread's long tasks. None may pass LONG_TASK_MS on the
// desktop; the same with the CPU slowed 4× (a phone) is reported, not judged,
// as shared CI machines vary. The preview plays no video, so this covers the
// timeline, its hover thumbnails and the page, not the browser's own seeking.
// CI runs it without the preview's synthetic pictures (make-media.sh), so
// there the thumbnails are empty frames.
//
//   node scripts/scrub_check.cjs [preview-dir]
const { chromium } = require("playwright");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const LONG_TASK_MS = 50;
const ROOT = path.resolve(process.argv[2] ?? path.join(__dirname, "..", "frontend", ".preview"));
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".jpg": "image/jpeg", ".woff2": "font/woff2" };
const RUNS = [
  { label: "desktop", viewport: { width: 1440, height: 900 }, cpu: 1, judged: true },
  { label: "desktop, CPU 4× slower", viewport: { width: 1440, height: 900 }, cpu: 4, judged: false },
  { label: "phone, CPU 4× slower", viewport: { width: 390, height: 844 }, cpu: 4, judged: false },
];

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

/** Drag the playhead to and fro across the timeline, then hover along it. */
async function scrub(page) {
  const box = await page.locator("rv-timeline canvas").boundingBox();
  if (!box) throw new Error("no timeline on the Playback tab");
  const y = box.y + box.height / 2;
  const at = (i) => box.x + 10 + ((box.width - 20) * i) / 60;
  await page.mouse.move(at(0), y);
  await page.mouse.down();
  for (let pass = 0; pass < 3; pass += 1) {
    for (let i = 0; i <= 60; i += 1) {
      await page.mouse.move(at(i), y);
      await page.waitForTimeout(16);
    }
    for (let i = 60; i >= 0; i -= 1) {
      await page.mouse.move(at(i), y);
      await page.waitForTimeout(16);
    }
  }
  await page.mouse.up();
  for (let i = 0; i <= 60; i += 1) {
    await page.mouse.move(at(i), y);
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(500);
}

async function main() {
  const server = await serve();
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  let failed = false;
  try {
    for (const run of RUNS) {
      const page = await browser.newPage({ viewport: run.viewport });
      const errors = [];
      page.on("pageerror", (err) => errors.push(String(err)));
      await page.goto(`${origin}/index.html?theme=light#device/cam-fyr/playback`);
      await page.locator("rv-timeline canvas").waitFor({ timeout: 15_000 });
      await page.waitForTimeout(1000);
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: run.cpu });
      await page.evaluate(() => {
        window.__longTasks = [];
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) window.__longTasks.push(Math.round(entry.duration));
        }).observe({ type: "longtask" });
      });
      await scrub(page);
      const long = await page.evaluate(() => window.__longTasks);
      const worst = long.length ? Math.max(...long) : 0;
      console.log(
        `${run.label}: ${long.length} long tasks${long.length ? `, the longest ${worst} ms` : ""}${run.judged ? "" : " (reported, not judged)"}`,
      );
      if (errors.length) console.log(`  page errors: ${errors.join("; ")}`);
      if (run.judged && (long.length || errors.length)) failed = true;
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  if (failed) {
    console.error(`Scrubbing the timeline blocked the page (a task over ${LONG_TASK_MS} ms) or failed.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

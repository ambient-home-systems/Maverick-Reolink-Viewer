// Zooming into the picture (Phase 11 step 1) with a real browser's input, on
// the design preview (frontend/.preview, from `npx vite build -c
// vite.preview.config.ts`): what happy-dom's tests cannot show, as the
// browser's own pointer capture, click targeting and wheel cancelling decide
// them.
//
// v0.64.0's Reset did nothing on a click in Chrome: a press on it began a pan,
// whose pointer capture sent the click to the picture instead. So, with the
// mouse and with a phone's touch, on a camera in full screen and on the
// Playback player:
//
// - Reset, clicked or tapped, goes back to 1×;
// - a plain wheel on the unzoomed picture is the page's; Ctrl and the wheel
//   zoom, each event cancelled (so the browser's own zoom does not);
// - a drag pans the zoomed picture;
// - two fingers spreading zoom in, and the page's own zoom stays at 1;
//   double taps zoom in and back out.
//
// The browser's own full screen in headless Chromium takes input only within
// its 800 × 600 screen (on a bare page too), so the desktop runs at that size.
// The preview plays no video: the player is marked started to take gestures.
//
//   node scripts/zoom_check.cjs [preview-dir]
const { chromium, devices } = require("playwright");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(process.argv[2] ?? path.join(__dirname, "..", "frontend", ".preview"));
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".jpg": "image/jpeg", ".woff2": "font/woff2" };

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

/** In the page: the element (`tile`: the full-screen camera, `player`: the Playback player) and its zoom. */
function zoomOf(which) {
  const find = (root) => {
    for (const el of root.querySelectorAll("*")) {
      if (which === "tile" ? el.tagName === "RV-LIVE-TILE" && el.hasAttribute("full") : el.tagName === "RV-PLAYER") return el;
      if (el.shadowRoot) {
        const found = find(el.shadowRoot);
        if (found) return found;
      }
    }
    return null;
  };
  const el = find(document);
  return el ? { ...el._zoom.zoom, page: window.visualViewport ? window.visualViewport.scale : 1 } : null;
}

const results = [];
function judge(label, ok, detail) {
  results.push({ label, ok });
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? `: ${detail}` : ""}`);
}

/** Whether each wheel event's default was prevented, read after its handlers ran. */
async function watchWheels(page) {
  await page.evaluate(() => {
    window.__wheels = [];
    window.addEventListener("wheel", (e) => window.__wheels.push({ ctrl: e.ctrlKey, prevented: e.defaultPrevented }));
  });
}

async function desktop(browser, origin) {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    // A camera in full screen.
    await page.goto(`${origin}/index.html?theme=dark`);
    await page.waitForTimeout(1500);
    await page.locator(".corner-button.full").first().click();
    await page.waitForTimeout(800);
    const tile = () => page.evaluate(zoomOf, "tile");
    await watchWheels(page);
    await page.mouse.move(500, 250);
    await page.mouse.wheel(0, -100);
    await page.waitForTimeout(150);
    let wheels = await page.evaluate(() => window.__wheels.splice(0));
    judge("live: a plain wheel on the unzoomed picture is the page's", (await tile()).scale === 1 && wheels.every((w) => !w.prevented));
    await page.keyboard.down("Control");
    for (let i = 0; i < 3; i += 1) await page.mouse.wheel(0, -40);
    await page.keyboard.up("Control");
    await page.waitForTimeout(150);
    wheels = await page.evaluate(() => window.__wheels.splice(0));
    const pinched = await tile();
    judge(
      "live: Ctrl and the wheel zoom, each cancelled",
      pinched.scale > 1.5 && wheels.length === 3 && wheels.every((w) => w.prevented),
      `${pinched.scale.toFixed(2)}×, ${wheels.filter((w) => w.prevented).length} of ${wheels.length} cancelled`,
    );
    await page.mouse.move(300, 300);
    await page.mouse.down();
    await page.mouse.move(400, 360, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(150);
    const dragged = await tile();
    judge("live: a drag pans", dragged.x !== pinched.x || dragged.y !== pinched.y, `by ${dragged.x - pinched.x}, ${dragged.y - pinched.y} px`);
    await page.locator(".zoom-pill button").click();
    await page.waitForTimeout(200);
    judge("live: Reset, clicked, goes back to 1×", (await tile()).scale === 1);

    // The Playback player.
    await page.goto(`${origin}/index.html?theme=dark#device/cam-fyr/playback`);
    await page.waitForTimeout(1500);
    const player = () => page.evaluate(zoomOf, "player");
    const started = await page.evaluate(() => {
      const find = (root) => {
        for (const el of root.querySelectorAll("*")) {
          if (el.tagName === "RV-PLAYER") return el;
          if (el.shadowRoot) {
            const found = find(el.shadowRoot);
            if (found) return found;
          }
        }
        return null;
      };
      const el = find(document);
      if (!el) return false;
      el._started = true;
      return true;
    });
    if (!started) throw new Error("no player on the Playback tab");
    await page.waitForTimeout(200);
    const frame = await page.locator("rv-player .frame").first().boundingBox();
    await page.mouse.move(frame.x + frame.width / 2, frame.y + frame.height / 2);
    await page.keyboard.down("Control");
    for (let i = 0; i < 3; i += 1) await page.mouse.wheel(0, -40);
    await page.keyboard.up("Control");
    await page.waitForTimeout(150);
    judge("playback: Ctrl and the wheel zoom", (await player()).scale > 1.5, `${(await player()).scale.toFixed(2)}×`);
    await page.locator("rv-player .zoom-pill button").click();
    await page.waitForTimeout(200);
    judge("playback: Reset, clicked, goes back to 1×", (await player()).scale === 1);
  } finally {
    if (errors.length) judge("desktop: no page errors", false, errors.join("; "));
    await page.close();
  }
}

async function phone(browser, origin) {
  const context = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    const cdp = await context.newCDPSession(page);
    const touch = (type, points) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points.map(([x, y], id) => ({ x, y, id })) });
    const tap = async (x, y) => {
      await touch("touchStart", [[x, y]]);
      await touch("touchEnd", []);
    };
    const pinch = async (x, y) => {
      await touch("touchStart", [[x - 45, y], [x + 45, y]]);
      for (let i = 1; i <= 8; i += 1) await touch("touchMove", [[x - 45 - i * 10, y], [x + 45 + i * 10, y]]);
      await touch("touchEnd", []);
      await page.waitForTimeout(150);
    };
    const doubleTap = async (x, y) => {
      await tap(x, y);
      await page.waitForTimeout(60);
      await tap(x, y);
      await page.waitForTimeout(200);
    };

    await page.goto(`${origin}/index.html?theme=dark`);
    await page.waitForTimeout(1500);
    await page.locator(".corner-button.full").first().tap();
    await page.waitForTimeout(800);
    const tile = () => page.evaluate(zoomOf, "tile");
    await pinch(195, 300);
    const pinched = await tile();
    judge("phone, live: two fingers zoom in, not the page", pinched.scale > 2 && pinched.page === 1, `${pinched.scale.toFixed(2)}×, the page at ${pinched.page}`);
    await page.locator(".zoom-pill button").tap();
    await page.waitForTimeout(200);
    judge("phone, live: Reset, tapped, goes back to 1×", (await tile()).scale === 1);
    await page.waitForTimeout(400);
    await doubleTap(195, 300);
    const tapped = await tile();
    await page.waitForTimeout(400);
    await doubleTap(195, 300);
    judge("phone, live: double taps zoom in and back out", tapped.scale === 2.5 && (await tile()).scale === 1, `${tapped.scale}× then ${(await tile()).scale}×`);
  } finally {
    if (errors.length) judge("phone: no page errors", false, errors.join("; "));
    await context.close();
  }
}

async function main() {
  const server = await serve();
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  try {
    await desktop(browser, origin);
    await phone(browser, origin);
  } finally {
    await browser.close();
    server.close();
  }
  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.error(`Zooming into the picture failed: ${failed.map((r) => r.label).join("; ")}.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

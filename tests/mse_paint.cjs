// v0.63.10: does the drag painter (frontend/src/playback/scrub-paint.ts,
// MsePainter: where there is no WebCodecs) show a lone key frame from a stream
// whose decoder holds frames back?
//
// The owner's Chrome on the LAN showed no picture while dragging: each was
// buffered at its time, but the video stayed at ready state 1 and never
// seeked, as the Mac's decoder held the frame for more. Chromium's own decoder
// does the same when the stream's SPS says its frames are reordered (an x264
// recording with B-frames), so that is what this runs, through the painter's
// own code, built with the frontend's Vite.
//
// Run by tests/test_mse_browser.py with a JSON file of pictures (made by the
// server's key_sample: init, data, codec, time in s, base64). Prints one line
// of JSON: the control (the same pictures appended and sought without the
// painter: held, if the stream holds frames) and each painted picture. Needs
// Playwright's Chromium and frontend/node_modules.
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const FRONTEND = path.join(__dirname, "..", "frontend");
const pictures = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));

/** The painter's module, bundled as one ES module (no files written). */
async function painterCode() {
  const vite = await import(pathToFileURL(path.join(FRONTEND, "node_modules", "vite", "dist", "node", "index.js")).href);
  const built = await vite.build({
    configFile: false,
    root: FRONTEND,
    logLevel: "silent",
    build: {
      write: false,
      minify: false,
      target: "es2022",
      lib: { entry: path.join(FRONTEND, "src", "playback", "scrub-paint.ts"), formats: ["es"], fileName: "paint" },
    },
  });
  const outputs = Array.isArray(built) ? built : [built];
  const chunk = outputs.flatMap((o) => o.output).find((o) => o.type === "chunk" && o.isEntry);
  if (!chunk) throw new Error("the painter did not build");
  return chunk.code;
}

async function main() {
  const code = await painterCode();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(
      "<video id=painter muted playsinline style='width:320px;height:240px'></video>" +
        "<video id=control muted playsinline style='width:320px;height:240px'></video>" +
        "<canvas id=c width=64 height=48></canvas>",
    );
    await page.addScriptTag({ type: "module", content: `${code}\nwindow.__painter = MsePainter;` });
    await page.waitForFunction(() => window.__painter !== undefined, null, { timeout: 10_000 });
    return await page.evaluate(run, pictures);
  } finally {
    await browser.close();
  }
}

// Runs in the page.
async function run(pictures) {
  const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const once = (target, type, ms) =>
    new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), ms);
      target.addEventListener(type, () => { clearTimeout(timer); resolve(true); }, { once: true });
    });
  const canvas = document.getElementById("c").getContext("2d", { willReadFrequently: true });
  const lit = (video) => {
    canvas.clearRect(0, 0, 64, 48);
    canvas.drawImage(video, 0, 0, 64, 48);
    const [r, g, b] = canvas.getImageData(32, 24, 1, 1).data;
    return r + g + b > 0;
  };
  // The control: the first picture appended and sought without ending the stream.
  const control = document.getElementById("control");
  const source = new MediaSource();
  control.src = URL.createObjectURL(source);
  await once(source, "sourceopen", 2000);
  const buffer = source.addSourceBuffer(`video/mp4; codecs="${pictures[0].codec}"`);
  for (const bytes of [pictures[0].init, pictures[0].data]) {
    const done = once(buffer, "updateend", 2000);
    buffer.appendBuffer(b64(bytes));
    await done;
  }
  const seeked = once(control, "seeked", 2000);
  control.currentTime = pictures[0].time + 0.001;
  const result = { control: { seeked: await seeked, readyState: control.readyState }, painted: [] };
  // The painter, as a drag uses it: each picture in turn, then back to the first.
  const Painter = window.__painter;
  const painter = new Painter();
  const video = document.getElementById("painter");
  for (const p of [...pictures, pictures[0]]) {
    const picture = { at: 0, time: 0, source: "cache", kind: "fmp4", codec: p.codec, init: b64(p.init), data: b64(p.data), serverMs: 0, ms: 0 };
    const ok = await painter.paint(picture, video);
    result.painted.push({
      ok,
      failure: painter.lastFailure ?? null,
      at: Number(video.currentTime.toFixed(3)),
      for: p.time,
      readyState: video.readyState,
      lit: lit(video),
    });
  }
  return result;
}

main().then(
  (result) => console.log(JSON.stringify(result)),
  (err) => {
    console.log(JSON.stringify({ error: String(err && err.stack ? err.stack : err) }));
    process.exitCode = 1;
  },
);

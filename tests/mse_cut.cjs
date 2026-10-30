// Phase 5b step 2: does Chromium play a deep start the device's cut serves?
//
// Run by tests/test_mse_browser.py with: the HA test server's origin, the MSE
// path of a recording (playback/mse), an access token and the start (ms into
// the recording). Asks the init of the source serving that start, then two
// windows from it, appends them, plays from the start and prints one line of
// JSON with what happened. Needs Playwright's Chromium with H.264 and AAC.
const { chromium } = require("playwright");

const [origin, base, token, at] = process.argv.slice(2);

async function main() {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`${origin}/api/`);
    return await page.evaluate(run, { base, token, at: Number(at) });
  } finally {
    await browser.close();
  }
}

// Runs in the page.
async function run({ base, token, at }) {
  const result = {};
  const get = async (path) => {
    const began = performance.now();
    const response = await fetch(`${base}/${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status} ${await response.text()}`);
    const header = (name) => response.headers.get(`X-RV-${name}`);
    return {
      bytes: new Uint8Array(await response.arrayBuffer()),
      ms: performance.now() - began,
      mime: header("Mime"),
      source: header("Source"),
      first: Number(header("First")),
      count: Number(header("Count")),
      start: Number(header("Start")),
      end: Number(header("End")),
      last: header("Last") === "1",
    };
  };
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const append = (buffer, data) =>
    new Promise((resolve, reject) => {
      buffer.addEventListener("updateend", resolve, { once: true });
      buffer.addEventListener("error", () => reject(new Error("append error")), { once: true });
      buffer.appendBuffer(data);
    });
  const video = document.createElement("video");
  video.muted = true;
  document.body.append(video);
  try {
    const init = await get(`init?at=${at}`);
    result.mime = init.mime;
    result.initSource = init.source;
    result.initMs = Math.round(init.ms);
    result.supported = MediaSource.isTypeSupported(init.mime);
    if (!result.supported) return result;
    const source = new MediaSource();
    video.src = URL.createObjectURL(source);
    await new Promise((resolve) => source.addEventListener("sourceopen", resolve, { once: true }));
    const buffer = source.addSourceBuffer(init.mime);
    await append(buffer, init.bytes);
    const first = await get(`frags?at=${at}&ms=4000`);
    result.firstWindow = { source: first.source, first: first.first, count: first.count, start: first.start, end: first.end, ms: Math.round(first.ms) };
    await append(buffer, first.bytes);
    const second = await get(`frags?first=${first.first + first.count}&ms=4000`);
    result.secondWindow = { source: second.source, first: second.first, count: second.count, start: second.start, end: second.end };
    await append(buffer, second.bytes);
    const ranges = [];
    for (let i = 0; i < buffer.buffered.length; i += 1) ranges.push([buffer.buffered.start(i), buffer.buffered.end(i)]);
    result.buffered = ranges;
    video.currentTime = at / 1000;
    await new Promise((resolve) => video.addEventListener("seeked", resolve, { once: true }));
    await video.play();
    result.startedAt = video.currentTime;
    // Play across the windows' boundary.
    const boundary = first.end / 1000;
    const end = performance.now() + 15000;
    while (performance.now() < end && video.currentTime < boundary + 0.5) await wait(50);
    result.playedTo = video.currentTime;
    result.crossed = video.currentTime > boundary;
    const quality = video.getVideoPlaybackQuality();
    result.frames = { total: quality.totalVideoFrames, dropped: quality.droppedVideoFrames };
    result.size = [video.videoWidth, video.videoHeight];
    result.error = video.error ? video.error.message : undefined;
  } catch (err) {
    result.error = String(err);
  }
  return result;
}

main().then(
  (result) => console.log(JSON.stringify(result)),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);

// Phase 2B step 2: does Chromium play what the MSE view serves?
//
// Run by tests/test_mse_browser.py with: the HA test server's origin, the MSE
// path of a recording (playback/mse), an access token, and the recording's
// raw first fragment as the NVR stores it (base64, the control). Prints one
// line of JSON with what happened. Needs Playwright's Chromium.
const { chromium } = require("playwright");

const [origin, base, token, rawInit, rawFragment] = process.argv.slice(2);

async function main() {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    // Any page of the server: the fetches below are then same-origin.
    await page.goto(`${origin}/api/`);
    return await page.evaluate(run, { base, token, rawInit, rawFragment });
  } finally {
    await browser.close();
  }
}

// Runs in the page.
async function run({ base, token, rawInit, rawFragment }) {
  const result = { steps: [] };
  const note = (step) => result.steps.push(step);
  const get = async (path) => {
    const response = await fetch(`${base}/${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    const header = (name) => response.headers.get(`X-RV-${name}`);
    return {
      bytes: new Uint8Array(await response.arrayBuffer()),
      mime: header("Mime"),
      first: Number(header("First")),
      count: Number(header("Count")),
      start: Number(header("Start")),
      end: Number(header("End")),
      last: header("Last") === "1",
    };
  };
  const bytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const until = async (test, ms) => {
    const end = performance.now() + ms;
    while (performance.now() < end) {
      if (test()) return true;
      await wait(20);
    }
    return false;
  };
  const open = async (video) => {
    const source = new MediaSource();
    video.src = URL.createObjectURL(source);
    await new Promise((resolve) => source.addEventListener("sourceopen", resolve, { once: true }));
    return source;
  };
  const append = (buffer, data) =>
    new Promise((resolve, reject) => {
      const done = () => {
        buffer.removeEventListener("error", failed);
        resolve();
      };
      const failed = () => {
        buffer.removeEventListener("updateend", done);
        reject(new Error("append error"));
      };
      buffer.addEventListener("updateend", done, { once: true });
      buffer.addEventListener("error", failed, { once: true });
      buffer.appendBuffer(data);
    });
  const video = document.createElement("video");
  video.muted = true;
  document.body.append(video);
  try {
    const init = await get("init");
    result.mime = init.mime;
    result.supported = MediaSource.isTypeSupported(init.mime);
    const source = await open(video);
    const buffer = source.addSourceBuffer(init.mime);
    source.duration = 8;
    await append(buffer, init.bytes);
    note("init appended");
    // A deep start: the window holding 3.5 s, then play from there.
    const first = await get("frags?at=3500&ms=2000");
    result.firstWindow = { first: first.first, count: first.count, start: first.start, end: first.end };
    await append(buffer, first.bytes);
    video.currentTime = 3.5;
    await video.play();
    result.startedAt = (await until(() => video.currentTime > 3.6, 5000)) ? 3.5 : null;
    note("playing from 3.5 s");
    // The next window, by index, played across the boundary to the end.
    const rest = await get(`frags?first=${first.first + first.count}&ms=60000`);
    result.secondWindow = { first: rest.first, count: rest.count, last: rest.last };
    await append(buffer, rest.bytes);
    result.crossed = await until(() => video.currentTime > first.end / 1000 + 0.3, 8000);
    note("crossed the window boundary");
    if (rest.last) source.endOfStream();
    result.ended = await until(() => video.ended, 8000);
    result.endTime = video.currentTime;
    const quality = video.getVideoPlaybackQuality();
    result.frames = { total: quality.totalVideoFrames, dropped: quality.droppedVideoFrames };
  } catch (err) {
    result.error = String(err);
  }
  // The control: the NVR's own fragment is refused.
  const raw = document.createElement("video");
  try {
    const source = await open(raw);
    const buffer = source.addSourceBuffer(result.mime);
    await append(buffer, bytes(rawInit));
    await append(buffer, bytes(rawFragment));
    result.raw = "appended";
  } catch (err) {
    result.raw = String(err);
  }
  return result;
}

main().then(
  (result) => {
    console.log(JSON.stringify(result));
  },
  (err) => {
    console.log(JSON.stringify({ error: String(err) }));
    process.exitCode = 1;
  },
);

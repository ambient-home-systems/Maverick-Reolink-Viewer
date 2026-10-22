// Phase 3 step 2: the panel's live grid in a real browser.
//
// Run by tests/test_live_browser.py with the HA test server's origin and an
// access token. In the page: a minimal `hass` over Home Assistant's websocket
// API (what the panel gets from HA's frontend), the panel bundle as HA serves
// it, and the live grid: the tile's picture from the image cache, then its
// stream starting (cold: a WebRTC session through HA, seen in live/status).
// go2rtc sends only H.264 and H.265 video, which Playwright's Chromium cannot
// decode, so no frame shows here: the hardware runs check that. Then the grid
// goes away and the server must hold nothing. Prints one line of JSON.
const { chromium } = require("playwright");

const [origin, token] = process.argv.slice(2);

async function main() {
  const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  try {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on("pageerror", (err) => pageErrors.push(String(err)));
    await page.goto(`${origin}/api/`);
    const result = await page.evaluate(run, { origin, token });
    return { ...result, pageErrors };
  } finally {
    await browser.close();
  }
}

// Runs in the page.
async function run({ origin, token }) {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const ws = new WebSocket(`${origin.replace(/^http/, "ws")}/api/websocket`);
  let nextId = 1;
  const pending = new Map();
  const listeners = new Map();
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === "auth_required") ws.send(JSON.stringify({ type: "auth", access_token: token }));
    else if (msg.type === "auth_ok") pending.get("auth")?.();
    else if (msg.type === "result") pending.get(msg.id)?.(msg);
    else if (msg.type === "event") listeners.get(msg.id)?.(msg.event);
  };
  await new Promise((resolve) => pending.set("auth", resolve));
  const send = (message, onEvent) => {
    const id = nextId++;
    if (onEvent) listeners.set(id, onEvent);
    return new Promise((resolve, reject) => {
      pending.set(id, (msg) => (msg.success ? resolve({ id, result: msg.result }) : reject(new Error(msg.error.message))));
      ws.send(JSON.stringify({ id, ...message }));
    });
  };
  const hass = {
    user: { is_admin: true },
    states: {},
    callWS: (message) => send(message).then(({ result }) => result),
    connection: {
      subscribeMessage: (callback, message) =>
        send(message, callback).then(({ id }) => () => send({ type: "unsubscribe_events", subscription: id }).then(() => undefined)),
    },
  };

  await import(`${origin}/reolink_viewer_static/reolink-viewer-panel.js`);
  const began = performance.now();
  const grid = document.createElement("rv-live-grid");
  grid.hass = hass;
  document.body.appendChild(grid);

  const result = {};
  const tileOf = () => grid.shadowRoot?.querySelector("rv-live-tile");
  const status = () => hass.callWS({ type: "reolink_viewer/live/status" });
  const deadline = began + 20_000;
  while (performance.now() < deadline && (result.pictureMs === undefined || result.sessionMs === undefined)) {
    const tile = tileOf();
    const picture = tile?.shadowRoot?.querySelector("img");
    if (result.pictureMs === undefined && picture?.complete && picture.naturalWidth > 0) {
      result.pictureMs = Math.round(performance.now() - began);
      result.pictureWidth = picture.naturalWidth;
    }
    if (result.sessionMs === undefined && tile?._state?.kind === "starting") {
      const now = await status();
      if (now.sessions > 0 && Object.values(now.running).some((holds) => holds > 0)) {
        result.sessionMs = Math.round(performance.now() - began);
        result.state = tile._state;
        result.running = now.running;
      }
    }
    await sleep(100);
  }
  result.tiles = grid.shadowRoot?.querySelectorAll("rv-live-tile").length ?? 0;
  grid.remove();
  await sleep(1000);
  const after = await status();
  result.after = { sessions: after.sessions, running: after.running };
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

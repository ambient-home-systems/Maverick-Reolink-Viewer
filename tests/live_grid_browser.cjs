// Phase 3 step 2: the panel's live grid in a real browser.
//
// Run by tests/test_live_browser.py with the HA test server's origin and an
// access token. In the page: a minimal `hass` over Home Assistant's websocket
// API (what the panel gets from HA's frontend), the panel bundle as HA serves
// it, and the live grid: the tile's picture from the image cache, then its
// stream starting: held through HA (live/status), over MSE as its keep-warm
// switch is on, or over WebRTC after it.
// Then full screen: the HD stream starts as well, the camera's controls show
// (a PTZ arrow held and let go), and HD stops on the way back.
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
    callService: (domain, service, serviceData, target) =>
      send({ type: "call_service", domain, service, service_data: serviceData, target }).then(() => undefined),
    connection: {
      subscribeMessage: (callback, message) =>
        send(message, callback).then(({ id }) => () => send({ type: "unsubscribe_events", subscription: id }).then(() => undefined)),
    },
  };

  // Entity states, as HA's frontend has them (the controls show what they say).
  const { result: states } = await send({ type: "get_states" });
  hass.states = Object.fromEntries(states.map((state) => [state.entity_id, state]));

  const panel = await import(`${origin}/reolink_viewer_static/reolink-viewer-panel.js`);
  // The views beyond the home page are their own files beside the panel's
  // module, fetched the first time each is shown.
  const views = {};
  for (const view of ["events", "list", "device", "live-check", "soak"]) {
    const at = performance.now();
    try {
      await panel.loadView(view);
      views[view] = Math.round(performance.now() - at);
    } catch (err) {
      views[view] = String(err);
    }
  }
  const began = performance.now();
  const grid = document.createElement("rv-live-grid");
  grid.hass = hass;
  document.body.appendChild(grid);

  const result = { views };
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
      // Held by either transport: WebRTC fails at once here (this Chromium
      // offers go2rtc no H.264), so its session is too short to wait for.
      if (Object.values(now.running).some((holds) => holds > 0)) {
        result.sessionMs = Math.round(performance.now() - began);
        result.state = tile._state;
        result.running = now.running;
      }
    }
    await sleep(100);
  }
  result.tiles = grid.shadowRoot?.querySelectorAll("rv-live-tile").length ?? 0;

  // The tile's debug view: what it plays, and the server's state of its stream.
  const tile = tileOf();
  tile?.shadowRoot?.querySelector(".corner-button.info")?.click();
  const debugAt = performance.now();
  while (performance.now() < debugAt + 5000) {
    const text = tile?.shadowRoot?.querySelector("rv-live-debug")?.shadowRoot?.querySelector("pre")?.textContent ?? "";
    if (text.includes("server: go2rtc")) {
      result.debug = text.split("\n").slice(0, 3);
      break;
    }
    await sleep(100);
  }
  tile?.shadowRoot?.querySelector(".corner-button.info")?.click();

  // The soak report (Devices → Checks), open next to the grid: the run the
  // grid reports to, and the server's samples (and one now).
  const soak = document.createElement("rv-live-soak");
  soak.hass = hass;
  document.body.appendChild(soak);
  const soakAt = performance.now();
  while (performance.now() < soakAt + 5000) {
    const text = soak.shadowRoot?.querySelector("pre")?.textContent ?? "";
    if (text.includes("Verdict:")) {
      result.soak = text.split("\n");
      break;
    }
    await sleep(100);
  }
  soak.remove();

  // Full screen: HD (the main stream, H.264 here) starts next to the sub stream.
  const holding = (now, kind) => Object.entries(now.running).some(([name, holds]) => name.endsWith(`_${kind}`) && holds > 0);
  tile?.shadowRoot?.querySelector(".corner-button.full")?.click();
  const fullAt = performance.now();
  while (performance.now() < fullAt + 20_000) {
    const now = await status();
    if (holding(now, "main")) {
      // The sub stream's player keeps running (its sessions here fail over to MSE and retry).
      result.hd = { ms: Math.round(performance.now() - fullAt), sub: tile?._player?.running, state: tile?._hdState, full: tile?.full };
      break;
    }
    await sleep(100);
  }
  // Full screen shows the camera's controls: hold "Move left", then let go.
  const controls = tile?.shadowRoot?.querySelector("rv-live-controls");
  await controls?.updateComplete;
  const left = controls?.shadowRoot?.querySelector('button[aria-label="Move left"]');
  result.ptz = left ? "found" : "missing";
  left?.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 1, bubbles: true }));
  await sleep(300);
  left?.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1, bubbles: true }));
  await sleep(500);
  result.ptzError = controls?._error ?? null;

  // Back: HD stops; the sub stream keeps playing.
  tile?.shadowRoot?.querySelector(".corner-button.full")?.click();
  const backAt = performance.now();
  while (performance.now() < backAt + 10_000) {
    const now = await status();
    if (!holding(now, "main")) {
      result.back = { sub: tile?._player?.running, full: tile?.full };
      break;
    }
    await sleep(100);
  }
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

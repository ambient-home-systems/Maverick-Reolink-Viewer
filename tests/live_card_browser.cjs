// Phase 7 step 1: the dashboard card in a real browser.
//
// Run by tests/test_live_browser.py with the HA test server's origin, an access
// token and whether its user is an admin. In the page: a minimal `hass` over
// Home Assistant's websocket API (what a dashboard gets from HA's frontend), the
// card's module as HA serves it (frontend.add_extra_js_url adds it to every
// page), and a card in a fake dashboard column: in the card picker, its
// camera's picture from the image cache, then its stream held through HA; its
// editor with the cameras; full screen on a tap. Then the card goes away and the
// server must hold nothing. Prints one line of JSON.
const { chromium } = require("playwright");

const [origin, token, admin] = process.argv.slice(2);

async function main() {
  const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  try {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on("pageerror", (err) => pageErrors.push(String(err)));
    await page.goto(`${origin}/api/`);
    const result = await page.evaluate(run, { origin, token, admin: admin === "admin" });
    return { ...result, pageErrors };
  } finally {
    await browser.close();
  }
}

// Runs in the page.
async function run({ origin, token, admin }) {
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
    user: { is_admin: admin },
    states: {},
    themes: { darkMode: false },
    callWS: (message) => send(message).then(({ result }) => result),
    callService: (domain, service, serviceData, target) =>
      send({ type: "call_service", domain, service, service_data: serviceData, target }).then(() => undefined),
    connection: {
      subscribeMessage: (callback, message) =>
        send(message, callback).then(({ id }) => () => send({ type: "unsubscribe_events", subscription: id }).then(() => undefined)),
    },
  };
  const { result: states } = await send({ type: "get_states" });
  hass.states = Object.fromEntries(states.map((state) => [state.entity_id, state]));

  await import(`${origin}/reolink_viewer_static/reolink-viewer-card.js`);
  const result = {};
  result.picker = (window.customCards ?? []).filter((c) => c.type === "reolink-viewer-camera").map((c) => c.name);
  const Card = customElements.get("reolink-viewer-camera");
  const stub = await Card.getStubConfig(hass);
  result.stub = stub;

  // A dashboard column, as a masonry view has it, contained as Home Assistant's
  // grids are (container queries): a fixed position inside stays in it.
  const column = document.createElement("div");
  column.style.width = "480px";
  column.style.containerType = "inline-size";
  document.body.appendChild(column);
  const began = performance.now();
  const card = document.createElement("reolink-viewer-camera");
  card.setConfig({ type: "custom:reolink-viewer-camera", ...stub });
  card.hass = hass;
  column.appendChild(card);
  result.cardSize = card.getCardSize();
  result.gridOptions = card.getGridOptions();

  const body = () => card.shadowRoot?.querySelector("rv-camera-card");
  const tileOf = () => body()?.shadowRoot?.querySelector("rv-live-tile");
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
      if (Object.values(now.running).some((holds) => holds > 0)) {
        result.sessionMs = Math.round(performance.now() - began);
        result.state = tile._state;
        result.running = now.running;
      }
    }
    await sleep(100);
  }
  // As tall as the picture: the column's width over the camera's shape.
  const frame = body()?.shadowRoot?.querySelector(".frame")?.getBoundingClientRect();
  result.frame = frame ? { width: Math.round(frame.width), height: Math.round(frame.height) } : null;
  result.tapLabel = tileOf()?.shadowRoot?.querySelector("button.open")?.getAttribute("aria-label") ?? null;

  // Its editor: the cameras to choose from.
  const editor = await Card.getConfigElement();
  editor.setConfig({ type: "custom:reolink-viewer-camera", ...stub });
  editor.hass = hass;
  document.body.appendChild(editor);
  const editorAt = performance.now();
  while (performance.now() < editorAt + 5000) {
    const options = [...(editor.shadowRoot?.querySelector("select")?.options ?? [])].map((o) => o.textContent);
    if (options.length) {
      result.editorCameras = options;
      break;
    }
    await sleep(100);
  }
  editor.remove();

  // A tap: full screen. Here the browser refuses its own full screen, as it
  // does on the tablet for a doorbell's ring (no person's tap): the card fills
  // the window from the top layer, out of the column's layout.
  const refusing = tileOf();
  if (refusing) refusing.requestFullscreen = () => Promise.reject(new TypeError("Permissions check failed"));
  tileOf()?.shadowRoot?.querySelector("button.open")?.click();
  await sleep(300);
  result.full = tileOf()?.full ?? null;
  result.topLayer = tileOf()?.matches(":popover-open") ?? null;
  const filled = tileOf()?.getBoundingClientRect();
  result.filled = filled
    ? { width: Math.round(filled.width), height: Math.round(filled.height), window: [innerWidth, innerHeight] }
    : null;
  tileOf()?.exitFull();
  await sleep(300);
  result.afterFull = { topLayer: tileOf()?.matches(":popover-open") ?? null, popover: tileOf()?.getAttribute("popover") ?? null };

  card.remove();
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

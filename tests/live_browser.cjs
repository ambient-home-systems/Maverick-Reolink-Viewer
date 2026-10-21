// Phase 3 step 1: a real browser through the live view's server side.
//
// Run by tests/test_live_browser.py with: the HA test server's origin, an
// access token and a camera connection id whose sub stream is the fake
// camera's Opus-only stream (Playwright's Chromium has no H.264). In the page:
// Home Assistant's websocket API, a WebRTC session through
// reolink_viewer/live/webrtc (trickle ICE both ways) to our go2rtc, then MSE
// through the signed websocket proxy. Prints one line of JSON.
const { chromium } = require("playwright");

const [origin, token, connectionId] = process.argv.slice(2);

async function main() {
  const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  try {
    const page = await browser.newPage();
    await page.goto(`${origin}/api/`);
    return await page.evaluate(run, { origin, token, connectionId });
  } finally {
    await browser.close();
  }
}

// Runs in the page.
async function run({ origin, token, connectionId }) {
  const result = { steps: [] };
  const note = (step) => result.steps.push(step);
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
  note("auth");
  const call = (message, onEvent) => {
    const id = nextId++;
    if (onEvent) listeners.set(id, onEvent);
    return new Promise((resolve, reject) => {
      pending.set(id, (msg) => (msg.success ? resolve(msg.result) : reject(new Error(msg.error.message))));
      ws.send(JSON.stringify({ id, ...message }));
    });
  };
  const ref = { connection_id: connectionId, stream: "sub" };

  // ---- WebRTC through reolink_viewer/live/webrtc ----
  const ice = await call({ type: "web_rtc/ice_servers" });
  result.iceServers = ice.length;
  const pc = new RTCPeerConnection({ iceServers: [] });
  pc.addTransceiver("audio", { direction: "recvonly" });
  let session;
  const early = [];
  pc.onicecandidate = (event) => {
    if (!event.candidate) return;
    const candidate = event.candidate.candidate;
    if (session) call({ type: "reolink_viewer/live/candidate", session_id: session, candidate }).catch(() => undefined);
    else early.push(candidate);
  };
  const connected = new Promise((resolve) => {
    pc.oniceconnectionstatechange = () => {
      if (["connected", "completed"].includes(pc.iceConnectionState)) resolve(true);
      if (pc.iceConnectionState === "failed") resolve(false);
    };
  });
  const track = new Promise((resolve) => {
    pc.ontrack = (event) => resolve(event.track.kind);
  });
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  const signals = [];
  await call({ type: "reolink_viewer/live/webrtc", ...ref, offer: offer.sdp }, async (event) => {
    signals.push(event.type);
    if (event.type === "session") {
      session = event.session_id;
      for (const candidate of early.splice(0)) {
        call({ type: "reolink_viewer/live/candidate", session_id: session, candidate }).catch(() => undefined);
      }
    } else if (event.type === "answer") {
      await pc.setRemoteDescription({ type: "answer", sdp: event.sdp });
    } else if (event.type === "candidate" && event.candidate) {
      await pc.addIceCandidate({ candidate: event.candidate, sdpMid: "0" });
    } else if (event.type === "error") {
      result.webrtcError = event.message;
    }
  });
  const timeout = (ms, value) => new Promise((resolve) => setTimeout(() => resolve(value), ms));
  result.connected = await Promise.race([connected, timeout(15000, "timeout")]);
  result.track = await Promise.race([track, timeout(5000, "timeout")]);
  await timeout(1500);
  let packets = 0;
  (await pc.getStats()).forEach((s) => {
    if (s.type === "inbound-rtp" && s.kind === "audio") packets = s.packetsReceived;
  });
  result.audioPackets = packets;
  result.signals = [...new Set(signals)];
  pc.close();
  note("webrtc");

  // ---- MSE through the signed websocket proxy ----
  const { path } = await call({ type: "reolink_viewer/live/mse", ...ref });
  const codecs = ["avc1.640029", "mp4a.40.2", "opus"].filter((c) => MediaSource.isTypeSupported(`video/mp4; codecs="${c}"`));
  const socket = new WebSocket(`${origin.replace(/^http/, "ws")}${path}`);
  socket.binaryType = "arraybuffer";
  const video = document.createElement("video");
  video.muted = true;
  document.body.append(video);
  const mse = await new Promise((resolve) => {
    let buffer;
    const queue = [];
    const next = () => {
      if (buffer && !buffer.updating && queue.length) buffer.appendBuffer(queue.shift());
    };
    setTimeout(() => resolve({ error: "timeout" }), 15000);
    socket.onopen = () => socket.send(JSON.stringify({ type: "mse", value: codecs.join(",") }));
    socket.onmessage = (event) => {
      if (typeof event.data === "string") {
        const msg = JSON.parse(event.data);
        if (msg.type !== "mse") return resolve({ error: msg.value });
        const source = new MediaSource();
        video.src = URL.createObjectURL(source);
        source.onsourceopen = () => {
          buffer = source.addSourceBuffer(msg.value);
          buffer.mode = "segments";
          buffer.onupdateend = () => {
            const ranges = buffer.buffered;
            if (ranges.length && ranges.end(ranges.length - 1) - ranges.start(0) > 1) {
              resolve({ mime: msg.value, buffered: ranges.end(ranges.length - 1) - ranges.start(0) });
            }
            next();
          };
          next();
        };
      } else {
        queue.push(event.data);
        next();
      }
    };
  });
  socket.close();
  result.mse = mse;
  note("mse");
  ws.close();
  return result;
}

main()
  .then((result) => console.log(JSON.stringify(result)))
  .catch((err) => {
    console.log(JSON.stringify({ error: String(err) }));
  });

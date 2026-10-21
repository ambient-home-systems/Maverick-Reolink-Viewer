#!/usr/bin/env node
// Runs the Reolink Viewer playback check in Google Chrome on this computer,
// without clicking: it logs in to Home Assistant with a long-lived access
// token, opens a camera's Playback tab, runs the check (the same one as
// Playback tab → Debug → Run playback check) and saves the report. Give it
// several addresses (LAN, Tailscale, Nabu Casa) to run it through each.
//
//   cd scripts/desktop-check && npm install
//   HA_TOKEN=... node run-check.mjs --camera "Front Yard Right" \
//     --url http://homeassistant.local:8123 --url https://xxxx.ui.nabu.casa
//
// See README.md here. The token goes only to the addresses given, in this
// browser's memory (a fresh profile each run, nothing written to disk).
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { chromium } from "playwright-core";

const HELP = `Usage: HA_TOKEN=<long-lived token> node run-check.mjs --url <HA address> [--url ...] [options]

  --url <address>      Home Assistant as this computer reaches it, e.g.
                       http://homeassistant.local:8123 (LAN),
                       https://<name>.<tailnet>.ts.net (Tailscale),
                       https://<id>.ui.nabu.casa (Nabu Casa). Repeat for each.
  --camera <name>      the camera to check (default: the first that records)
  --session <minutes>  then play for this long (memory and disk), on the
                       first address only (default 0)
  --hd <which>         switch to HD and back: "local" (default: LAN only),
                       "all" or "none". HD makes the server fetch a main
                       recording from the NVR (up to 3.8 GB for an hour).
  --browser <name>     chrome (default), msedge or chromium (Chromium has no
                       H.264: recordings would not play)
  --headless           no window (the check then cannot tell the page is in
                       front; rates may be judged in the background)
  --out <folder>       where to save the reports (default: reports)`;

const { values } = parseArgs({
  options: {
    url: { type: "string", multiple: true },
    camera: { type: "string" },
    session: { type: "string", default: "0" },
    hd: { type: "string", default: "local" },
    browser: { type: "string", default: "chrome" },
    headless: { type: "boolean", default: false },
    out: { type: "string", default: "reports" },
    help: { type: "boolean", short: "h", default: false },
  },
});

if (values.help || !values.url?.length) {
  console.log(HELP);
  process.exit(values.help ? 0 : 2);
}
const token = process.env.HA_TOKEN;
if (!token) {
  console.error("Set HA_TOKEN to a long-lived access token (Home Assistant → your profile → Security).");
  process.exit(2);
}

/** How the address reaches Home Assistant (the check's setup names). */
function setupFor(address) {
  const host = new URL(address).hostname.toLowerCase();
  if (host.endsWith(".ui.nabu.casa")) return "Desktop Chrome, Nabu Casa";
  const ip = /^(\d+)\.(\d+)\.\d+\.\d+$/.exec(host);
  const tailscaleIp = ip && Number(ip[1]) === 100 && Number(ip[2]) >= 64 && Number(ip[2]) < 128;
  if (host.endsWith(".ts.net") || tailscaleIp) return "Desktop Chrome, Tailscale";
  return "Desktop Chrome, LAN";
}

function slug(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function login(page, base) {
  // Home Assistant's frontend keeps its tokens in localStorage ("hassTokens");
  // a long-lived token does not expire, so no refresh token is needed.
  await page.goto(`${base}/`, { waitUntil: "domcontentloaded" });
  const tokens = {
    access_token: token,
    token_type: "Bearer",
    expires_in: 1800,
    hassUrl: base,
    clientId: `${base}/`,
    expires: Date.now() + 365 * 24 * 3600 * 1000,
    refresh_token: "",
  };
  await page.evaluate((value) => {
    localStorage.setItem("hassTokens", value);
  }, JSON.stringify(tokens));
  await page.goto(`${base}/reolink-viewer`, { waitUntil: "domcontentloaded" });
  try {
    await page.waitForFunction(() => document.querySelector("home-assistant")?.hass?.connected === true, null, {
      timeout: 45_000,
    });
  } catch {
    throw new Error(`could not log in at ${base} with HA_TOKEN (a long-lived access token from your profile → Security)`);
  }
}

async function findCamera(page, wanted) {
  const cameras = await page.evaluate(async () => {
    const hass = document.querySelector("home-assistant").hass;
    const devices = await hass.callWS({ type: "reolink_viewer/devices" });
    return devices.cameras.map((c) => ({
      id: c.id,
      name: c.name ?? c.id,
      recorded: c.connections.some((x) => x.playback_source),
    }));
  });
  const recording = cameras.filter((c) => c.recorded);
  const camera = wanted
    ? recording.find((c) => c.name.toLowerCase() === wanted.toLowerCase())
    : recording.at(0);
  if (!camera) {
    const names = recording.map((c) => c.name).join(", ") || "none";
    throw new Error(`no recording camera ${wanted ? `named "${wanted}"` : ""} (cameras with recordings: ${names})`);
  }
  return camera;
}

/** Find the Playback tab's element (inside the panel's shadow roots). */
function playbackElement() {
  const deep = (root) => {
    const hit = root.querySelector("rv-playback");
    if (hit) return hit;
    for (const el of root.querySelectorAll("*")) {
      const found = el.shadowRoot && deep(el.shadowRoot);
      if (found) return found;
    }
    return null;
  };
  return deep(document);
}

async function runAt(browser, base, options) {
  const setup = setupFor(base);
  console.log(`\n=== ${setup} · ${base}`);
  const context = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  const page = await context.newPage();
  try {
    await login(page, base);
    const camera = await findCamera(page, options.camera);
    console.log(`Camera: ${camera.name}`);
    await page.goto(`${base}/reolink-viewer#device/${encodeURIComponent(camera.id)}/playback`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForFunction(`(${playbackElement.toString()})()?._day !== undefined`, null, { timeout: 60_000 });
    // The check judges rates with the page in front.
    await page.bringToFront();
    const hd = options.hd === "all" || (options.hd === "local" && setup.endsWith("LAN"));
    console.log(`Running the check${options.session ? ` with a ${options.session}-min session` : ""}${hd ? ", with HD" : ""}…`);
    let shown = 0;
    const progress = setInterval(() => {
      page
        .evaluate(`(${playbackElement.toString()})()?._checkText ?? ""`)
        .then((text) => {
          const lines = text.split("\n");
          for (const line of lines.slice(shown)) if (line.trim()) console.log(`  ${line.slice(0, 160)}`);
          shown = lines.length;
        })
        .catch(() => undefined);
    }, 5_000);
    let report;
    try {
      const run = { setup, soakMinutes: options.session, hd };
      report = await page.evaluate(`(${playbackElement.toString()})().runCheck(${JSON.stringify(run)})`);
    } finally {
      clearInterval(progress);
    }
    await mkdir(options.out, { recursive: true });
    // e.g. 20261021-1430 (UTC)
    const stamp = new Date().toISOString().slice(0, 16).replace(/-/g, "").replace("T", "-").replace(":", "");
    const file = path.join(options.out, `check-${slug(setup)}-${slug(camera.name)}-${stamp}.txt`);
    await writeFile(file, `${report}\n`);
    const summary = report.split("\n").filter((line) => line.startsWith("- "));
    console.log(`Summary:\n${summary.join("\n")}\nSaved ${file} (also under Debug → Saved reports).`);
    return true;
  } catch (err) {
    console.error(`Failed at ${base}: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  } finally {
    await context.close();
  }
}

const browser = await chromium.launch({
  channel: values.browser === "chromium" ? undefined : values.browser,
  headless: values.headless,
  args: [
    "--autoplay-policy=no-user-gesture-required",
    // Keep timers and video running even if the window is covered.
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
  ],
});
let ok = true;
try {
  for (const [i, url] of values.url.entries()) {
    const base = url.replace(/\/+$/, "");
    const session = i === 0 ? Number(values.session) || 0 : 0;
    ok = (await runAt(browser, base, { camera: values.camera, session, hd: values.hd, out: values.out })) && ok;
  }
} finally {
  await browser.close();
}
process.exit(ok ? 0 : 1);

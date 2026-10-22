// The live check: measures live view on the device it runs on and writes a
// report, for the Phase 3 step 1 gate (docs/IMPLEMENTATION_PLAN.md).
//
// It runs inside the panel (Reolink → Live check), so it works in the iOS
// Companion app too. For each camera connection and stream it measures, on
// this device and this network path:
//
// - time to the first image: Home Assistant's camera snapshot (its view's
//   poster) and a frame from our go2rtc (warm);
// - time to the first live frame over WebRTC and over MSE, cold (go2rtc not
//   connected to the camera) and warm (kept open, its last key frame cached:
//   MSE starts from that key frame, WebRTC still waits for the next one);
// - the same in Home Assistant's own camera view (its WebRTC), where the
//   camera's HA entity is enabled;
// - how WebRTC connected (host, server-reflexive or relayed candidates).
//
// And, for admins, the capacity test of each NVR (server side). Reports are
// saved on the server as the check runs (with the playback check's).
import {
  fetchDevices,
  fetchIceServers,
  fetchLiveCameras,
  fetchLiveFramePath,
  fetchLiveState,
  fetchLiveStatus,
  setLivePreload,
  subscribeCapacity,
  toError,
  type LiveRef,
} from "../api";
import { browserLabel, classifyHost } from "../playback/check-util";
import { mseApiName } from "../playback/mse-feeder";
import type { CapacityReport, HomeAssistant, LiveCamera, LiveConnection, LiveStreamKind } from "../types";
import {
  cacheLabel,
  capacityLines,
  describeIceServers,
  median,
  mseCodecs,
  rtcIceServers,
  seconds,
  streamLabel,
} from "./check-util";
import { OurMse, OurWebRtc, StockWebRtc, type LiveSession, type SessionResult } from "./session";

export const LIVE_CHECK_VERSION = "0.5.2";
/** Saved reports share the playback check's store; this marks a live one. */
export const LIVE_REPORT_PREFIX = "Live check · ";
export const LIVE_SETUPS = [
  "Desktop Chrome, LAN",
  "Desktop Chrome, Tailscale",
  "Desktop Chrome, Nabu Casa",
  "iPhone app, Wi-Fi (local)",
  "iPhone app, Tailscale",
  "iPhone app, Nabu Casa",
  "Other",
] as const;

const COLD_TIMEOUT_MS = 20_000;
const WARM_TIMEOUT_MS = 12_000;
/** How long to wait for go2rtc to let go of a camera before a cold start. */
const COLD_WAIT_MS = 10_000;
/** After keeping a stream warm starts, let it settle before measuring. */
const WARM_SETTLE_MS = 2_000;
const IMAGE_TIMEOUT_MS = 15_000;
/** An MSE start that paints this long after its data came gets a video-only retry. */
const LATE_PAINT_MS = 1_000;
const SAVE_EVERY_MS = 10_000;

export interface LiveCheckOptions {
  setup: string;
  streams: LiveStreamKind[];
  /** Keep-warm measurements (admin: they keep streams warm while measuring). */
  warm: boolean;
  /** Compare with Home Assistant's own camera view. */
  stock: boolean;
  /** The NVRs' capacity test (admin). */
  capacity: boolean;
  /** Only these cameras (ids); all when empty. */
  cameraIds?: string[];
}

type Phase = "cold" | "warm" | "stock";
type Transport = "WebRTC" | "MSE";

interface Measured {
  camera: string;
  connection: LiveConnection;
  stream: LiveStreamKind;
  phase: Phase;
  transport: Transport;
  result: SessionResult;
}

class Stopped extends Error {}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class LiveCheck {
  readonly id: string;
  readonly lines: string[] = [];
  running = false;
  /** What it is doing now (for the panel). */
  status = "";
  /** After a first frame, the session plays this long (the stats settle). */
  afterFrameMs = 300;
  private _stopped = false;
  private _session: LiveSession | undefined;
  private _lastSave = 0;
  private _saving: Promise<void> = Promise.resolve();
  private _ice: RTCIceServer[] = [];
  private readonly _measured: Measured[] = [];
  private readonly _posters: { kind: "HA snapshot" | "go2rtc frame"; ms: number }[] = [];
  private readonly _capacity: { host: string; report: CapacityReport }[] = [];

  constructor(
    private readonly _hass: HomeAssistant,
    readonly options: LiveCheckOptions,
    /** Where each session's <video> is shown while it runs. */
    private readonly _stage: HTMLElement,
    private readonly _onChange: () => void = () => undefined,
  ) {
    this.id = `live-${new Date().toISOString().slice(0, 19)}-${Math.random().toString(36).slice(2, 6)}`;
  }

  get text(): string {
    return this.lines.join("\n");
  }

  stop(): void {
    this._stopped = true;
    this._session?.close();
  }

  async run(): Promise<string> {
    this.running = true;
    try {
      await this._header();
      const cameras = await this._cameras();
      for (const camera of cameras) {
        for (const connection of camera.connections) {
          for (const stream of this.options.streams) {
            await this._measureStream(camera, connection, stream);
          }
        }
      }
      if (this.options.capacity) await this._capacityTests();
      this._summary(cameras);
    } catch (err) {
      this._log(err instanceof Stopped ? "Stopped." : `Check failed: ${toError(err).message}`);
    } finally {
      this._session?.close();
      await this._go2rtcLog();
      this.running = false;
      this.status = "";
      this._log(`Done at ${new Date().toLocaleTimeString()}.`);
      await this._save(true);
    }
    return this.text;
  }

  // ---- Reporting ----

  /** go2rtc's last log lines (admins; addresses and credentials removed). */
  private async _go2rtcLog(): Promise<void> {
    const status = await fetchLiveStatus(this._hass).catch(() => undefined);
    const lines = status?.go2rtc.log;
    if (!lines?.length) return;
    this._log("");
    this._log(`go2rtc log (last ${String(lines.length)} lines):`);
    for (const line of lines) this._log(`  ${line}`);
  }

  private _log(line: string): void {
    this.lines.push(line);
    this._onChange();
    if (performance.now() - this._lastSave > SAVE_EVERY_MS) void this._save(false);
  }

  private _status(text: string): void {
    this.status = text;
    this._onChange();
  }

  private _save(done: boolean): Promise<void> {
    this._lastSave = performance.now();
    this._saving = this._saving
      .then(() =>
        this._hass.callWS({
          type: "reolink_viewer/playback/check_report",
          report_id: this.id,
          setup: `${LIVE_REPORT_PREFIX}${this.options.setup}`,
          text: this.text,
          done,
        }),
      )
      .then(() => undefined)
      .catch(() => undefined);
    return this._saving;
  }

  private _checkStopped(): void {
    if (this._stopped) throw new Stopped();
  }

  // ---- Parts ----

  private async _header(): Promise<void> {
    const admin = this._hass.user?.is_admin === true;
    this._log(
      `Reolink Viewer live check v${LIVE_CHECK_VERSION} · ${this.options.setup} · ${new Date().toLocaleString()}`,
    );
    this._log(
      `Browser: ${browserLabel(navigator.userAgent)} · page ${classifyHost(location.hostname)} over ${location.protocol.replace(":", "")}` +
        ` · screen ${screen.width}×${screen.height} @${window.devicePixelRatio}x`,
    );
    this._log(`User agent: ${navigator.userAgent}`);
    const api = mseApiName();
    const ctor = api ? (window as unknown as Record<string, { isTypeSupported(t: string): boolean }>)[api] : undefined;
    this._log(`MSE: ${api ?? "none"}${ctor ? `, takes ${mseCodecs((t) => ctor.isTypeSupported(t)) || "none of go2rtc's codecs"}` : ""}`);
    this._log(`WebRTC receives: ${receiveCodecs()}`);
    const ice = await fetchIceServers(this._hass).catch(() => []);
    this._ice = rtcIceServers(ice);
    this._log(`ICE servers (Home Assistant's): ${describeIceServers(ice)}`);
    const options = this.options;
    this._log(
      `Streams: ${options.streams.join(", ")} · warm: ${options.warm && admin ? "yes" : admin ? "no" : "no (not an admin)"}` +
        ` · Home Assistant's view: ${options.stock ? "yes" : "no"} · capacity test: ${options.capacity && admin ? "yes" : "no"}`,
    );
    const began = performance.now();
    const status = await fetchLiveStatus(this._hass);
    const g = status.go2rtc;
    this._log(
      `go2rtc: ${g.state}${g.version ? ` ${g.version}` : ""}${g.binary ? ` (${g.binary === "system" ? "Home Assistant's binary" : "downloaded, checksum verified"})` : ""}` +
        `${g.error ? ` · error: ${g.error}` : ""} · restarts ${g.restarts} · WebRTC port ${g.webrtc_port} · status in ${Math.round(performance.now() - began)} ms`,
    );
  }

  private async _cameras(): Promise<LiveCamera[]> {
    const { cameras } = await fetchLiveCameras(this._hass);
    const wanted = this.options.cameraIds?.length ? new Set(this.options.cameraIds) : undefined;
    const chosen = cameras.filter((c) => !wanted || wanted.has(c.id));
    this._log(
      `Cameras: ${chosen.map((c) => `${c.name}${c.connections.length > 1 ? ` (${c.connections.map((x) => x.via).join(" + ")})` : ""}`).join(", ")}`,
    );
    return chosen;
  }

  private async _measureStream(camera: LiveCamera, connection: LiveConnection, stream: LiveStreamKind): Promise<void> {
    this._checkStopped();
    const ref: LiveRef = { connectionId: connection.connection_id, stream };
    const info = connection.streams[stream];
    const via = connection.via === "nvr" ? `via ${connection.entry_title}` : "direct";
    this._log("");
    if (!info) {
      this._log(`${camera.name}${camera.model ? ` (${camera.model})` : ""} · ${via} · ${stream}: not served by this connection`);
      return;
    }
    this._log(`${camera.name}${camera.model ? ` (${camera.model})` : ""} · ${via} · ${streamLabel(stream, info.encoding)}`);
    const where = `${camera.name} ${via} ${stream}`;
    const record = (phase: Phase, transport: Transport, result: SessionResult) => {
      this._measured.push({ camera: camera.name, connection, stream, phase, transport, result });
    };

    // Cold: go2rtc is not connected to the camera.
    const cold: string[] = [];
    for (const transport of ["WebRTC", "MSE"] as const) {
      this._status(`${where}: cold ${transport}`);
      const isCold = await this._waitCold(ref);
      const result = await this._session_(transport, ref, COLD_TIMEOUT_MS);
      record("cold", transport, result);
      cold.push(`${transport} ${describe(result)}${isCold ? "" : " (a viewer kept it running: not cold)"}`);
      if (transport === "MSE") cold.push(...(await this._videoOnly(result, ref, COLD_TIMEOUT_MS, where)));
    }
    this._log(`  cold: ${cold.join(" · ")}`);

    // Home Assistant's own view: its snapshot, then its WebRTC.
    if (this.options.stock) {
      const entity = info.entity_id;
      if (!entity) {
        this._log(`  Home Assistant's view: no enabled camera entity for ${stream}`);
      } else {
        this._status(`${where}: Home Assistant's view`);
        const poster = await this._stockPoster(entity);
        const result = await this._stock(entity);
        record("stock", "WebRTC", result);
        this._log(`  Home Assistant's view (${entity}): snapshot ${poster} · WebRTC ${describe(result)}`);
      }
    }

    // Warm: the stream kept open, its last key frame cached.
    if (this.options.warm && this._hass.user?.is_admin) {
      if (connection.is_battery) {
        this._log("  warm: not measured (battery camera: never kept warm)");
        return;
      }
      this._status(`${where}: keeping it warm`);
      const began = performance.now();
      let keyFrame: boolean;
      try {
        ({ key_frame: keyFrame } = await setLivePreload(this._hass, ref, true));
      } catch (err) {
        this._log(`  warm: keeping it warm failed: ${toError(err).message}`);
        return;
      }
      const upMs = performance.now() - began;
      try {
        await this._pause(WARM_SETTLE_MS);
        const frame = await this._frame(ref);
        const warm: string[] = [];
        for (const transport of ["WebRTC", "MSE"] as const) {
          this._status(`${where}: warm ${transport}`);
          const result = await this._session_(transport, ref, WARM_TIMEOUT_MS);
          record("warm", transport, result);
          warm.push(`${transport} ${describe(result)}`);
          if (transport === "MSE") warm.push(...(await this._videoOnly(result, ref, WARM_TIMEOUT_MS, where)));
        }
        const cache = (await fetchLiveState(this._hass, ref).catch(() => undefined))?.cache;
        const cached = keyFrame ? `key frame cached in ${seconds(upMs)}` : `no key frame in ${seconds(upMs)}`;
        this._log(`  warm (${cached}${cacheLabel(cache)}): frame ${frame} · ${warm.join(" · ")}`);
      } finally {
        await setLivePreload(this._hass, ref, false).catch(() => undefined);
      }
    }
  }

  /** Wait until go2rtc has let go of the camera; false if it stays connected. */
  private async _waitCold(ref: LiveRef): Promise<boolean> {
    const end = performance.now() + COLD_WAIT_MS;
    while (performance.now() < end) {
      this._checkStopped();
      const state = await fetchLiveState(this._hass, ref).catch(() => undefined);
      if (!state?.state?.active) return true;
      await sleep(250);
    }
    return false;
  }

  private async _pause(ms: number): Promise<void> {
    const end = performance.now() + ms;
    while (performance.now() < end) {
      this._checkStopped();
      await sleep(Math.min(250, end - performance.now()));
    }
  }

  /** One session on a fresh <video> in the stage. */
  private async _session_(transport: Transport, ref: LiveRef, timeoutMs: number): Promise<SessionResult> {
    return this._watch((video) =>
      transport === "WebRTC"
        ? new OurWebRtc(this._hass, video, ref, this._ice, timeoutMs)
        : new OurMse(this._hass, video, ref, timeoutMs),
    );
  }

  /**
   * An MSE start that painted long after its data came: the same over video
   * only, to tell whether audio held it back. Not in the summary.
   */
  private async _videoOnly(result: SessionResult, ref: LiveRef, timeoutMs: number, where: string): Promise<string[]> {
    if (!result.ok || result.firstFrameMs === undefined || !("appended" in result.steps)) return [];
    if (result.firstFrameMs - result.steps.appended <= LATE_PAINT_MS) return [];
    this._status(`${where}: MSE video only`);
    const retry = await this._watch((video) => new OurMse(this._hass, video, ref, timeoutMs, location.href, true));
    return [`MSE video only ${describe(retry)}`];
  }

  private _stock(entityId: string): Promise<SessionResult> {
    return this._watch((video) => new StockWebRtc(this._hass, video, entityId, COLD_TIMEOUT_MS));
  }

  private async _watch(open: (video: HTMLVideoElement) => LiveSession): Promise<SessionResult> {
    this._checkStopped();
    const video = document.createElement("video");
    this._stage.replaceChildren(video);
    const session = open(video);
    this._session = session;
    try {
      const result = await session.done;
      // Let it play a moment: the frame shows, the stats settle.
      if (result.ok) await sleep(this.afterFrameMs);
      return result;
    } finally {
      session.close();
      this._session = undefined;
      video.remove();
    }
  }

  private async _stockPoster(entityId: string): Promise<string> {
    const picture = this._hass.states[entityId]?.attributes.entity_picture;
    if (typeof picture !== "string") return "no picture";
    const result = await loadImage(`${picture}${picture.includes("?") ? "&" : "?"}_=${Date.now()}`);
    if (result.ms !== undefined) this._posters.push({ kind: "HA snapshot", ms: result.ms });
    return result.text;
  }

  private async _frame(ref: LiveRef): Promise<string> {
    try {
      const { path } = await fetchLiveFramePath(this._hass, ref);
      const result = await loadImage(path);
      if (result.ms !== undefined) this._posters.push({ kind: "go2rtc frame", ms: result.ms });
      return result.text;
    } catch (err) {
      return `failed (${toError(err).message})`;
    }
  }

  private async _capacityTests(): Promise<void> {
    if (!this._hass.user?.is_admin) {
      this._log("");
      this._log("Capacity test: not run (admins only).");
      return;
    }
    const devices = await fetchDevices(this._hass);
    for (const host of devices.hosts) {
      this._checkStopped();
      const name = host.name ?? host.id;
      this._log("");
      this._log(`Capacity test: ${name} (sub streams one by one, then a main, then a recording download)`);
      this._status(`capacity test: ${name}`);
      const report = await this._capacity_(host.id, (message) => {
        this._status(`capacity test: ${name}: ${message}`);
      });
      if (typeof report === "string") {
        this._log(`  failed: ${report}`);
        continue;
      }
      this._capacity.push({ host: name, report });
      for (const line of capacityLines(report)) this._log(line);
    }
  }

  private _capacity_(hostId: string, progress: (message: string) => void): Promise<CapacityReport | string> {
    return new Promise((resolve) => {
      let unsubscribe: (() => Promise<void>) | undefined;
      let settled = false;
      const finish = (value: CapacityReport | string) => {
        if (settled) return;
        settled = true;
        void unsubscribe?.().catch(() => undefined);
        resolve(value);
      };
      subscribeCapacity(this._hass, hostId, (event) => {
        if (event.type === "progress") progress(event.message);
        else if (event.type === "result") finish(event.report);
        else finish(event.message);
      })
        .then((unsub) => {
          unsubscribe = unsub;
          if (settled) void unsub().catch(() => undefined);
        })
        .catch((err: unknown) => {
          finish(toError(err).message);
        });
    });
  }

  // ---- Summary ----

  private _summary(cameras: LiveCamera[]): void {
    const all = this._measured;
    this._log("");
    this._log("Summary:");
    const webrtc = all.filter((m) => m.transport === "WebRTC" && m.phase !== "stock");
    const connected = webrtc.filter((m) => "connected" in m.result.steps);
    const pairs = countBy(connected.map((m) => `${m.result.pair?.local ?? "?"} ↔ ${m.result.pair?.remote ?? "?"}`));
    this._log(
      `- WebRTC connected ${connected.length} of ${webrtc.length} sessions${pairs ? ` (${pairs})` : ""}`,
    );
    for (const phase of ["cold", "warm"] as const) {
      for (const transport of ["WebRTC", "MSE"] as const) {
        for (const group of [["sub"], ["main", "ext"]] as const) {
          const values = all
            .filter((m) => m.phase === phase && m.transport === transport && (group as readonly string[]).includes(m.stream))
            .filter((m) => m.result.ok)
            .map((m) => m.result.firstFrameMs ?? 0);
          const total = all.filter(
            (m) => m.phase === phase && m.transport === transport && (group as readonly string[]).includes(m.stream),
          ).length;
          if (!total) continue;
          this._log(
            `- ${phase} ${transport}, ${group.join("/")}: median ${seconds(median(values))}, ${values.length} of ${total} played` +
              (values.length ? ` (${seconds(Math.min(...values))}–${seconds(Math.max(...values))})` : ""),
          );
        }
      }
    }
    const stock = all.filter((m) => m.phase === "stock");
    if (stock.length) {
      let faster = 0;
      let compared = 0;
      for (const s of stock) {
        const ours = all.filter(
          (m) =>
            m.connection === s.connection &&
            m.stream === s.stream &&
            m.phase !== "stock" &&
            m.result.ok,
        );
        const best = ours.length ? Math.min(...ours.map((m) => m.result.firstFrameMs ?? Infinity)) : undefined;
        if (best === undefined || !s.result.ok) continue;
        compared += 1;
        if (best < (s.result.firstFrameMs ?? Infinity)) faster += 1;
      }
      const played = stock.filter((m) => m.result.ok).map((m) => m.result.firstFrameMs ?? 0);
      this._log(
        `- Home Assistant's view: median ${seconds(median(played))}, ${played.length} of ${stock.length} played;` +
          ` ours (best of cold/warm) faster on ${faster} of ${compared}`,
      );
    }
    for (const kind of ["HA snapshot", "go2rtc frame"] as const) {
      const values = this._posters.filter((p) => p.kind === kind).map((p) => p.ms);
      if (values.length) this._log(`- first image, ${kind}: median ${seconds(median(values))} (${values.length})`);
    }
    for (const camera of cameras.filter((c) => c.connections.length > 1)) {
      const parts = camera.connections.map((connection) => {
        const sub = all.filter((m) => m.connection === connection && m.stream === "sub" && m.phase === "cold" && m.result.ok);
        const ms = median(sub.map((m) => m.result.firstFrameMs ?? 0));
        return `${connection.via === "nvr" ? "via NVR" : "direct"} cold sub ${seconds(ms)}`;
      });
      this._log(`- ${camera.name}: ${parts.join(" vs ")}`);
    }
    for (const { host, report } of this._capacity) {
      const verdict = report.verdict;
      this._log(
        `- capacity ${host}: ${verdict.first_failing_level === null ? `kept up at every level (${report.levels.length})` : `level ${verdict.first_failing_level} fails or slows down (${verdict.reasons.join("; ")})`}`,
      );
    }
  }
}

/** "1.23 s (answer 120 ms, connected 300 ms; host/udp ↔ host/udp, h264 640×360)". */
export function describe(result: SessionResult): string {
  const steps = Object.entries(result.steps)
    .filter(([name]) => ["answer", "connected", "url", "open", "mime", "first data", "appended"].includes(name))
    .sort(([, a], [, b]) => a - b)
    .map(([name, ms]) => `${name} ${ms} ms`);
  const pair = result.pair;
  const path = pair?.local ? `${pair.local} ↔ ${pair.remote ?? "?"}${pair.rttMs !== undefined ? `, rtt ${pair.rttMs} ms` : ""}` : undefined;
  const media = [
    pair?.codec ?? result.mse?.mime.replace(/^video\/mp4; codecs=/, "").replace(/"/g, ""),
    result.width ? `${result.width}×${result.height}` : undefined,
  ]
    .filter(Boolean)
    .join(" ");
  const details = [steps.join(", "), path, media].filter(Boolean).join("; ");
  if (!result.ok) return `✗ ${result.error ?? "failed"}${details ? ` (${details})` : ""}`;
  return `${seconds(result.firstFrameMs)}${details ? ` (${details})` : ""}`;
}

function countBy(values: string[]): string {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].map(([value, count]) => `${count}× ${value}`).join(", ");
}

/** The video codecs this browser's WebRTC can receive. */
function receiveCodecs(): string {
  const caps = typeof RTCRtpReceiver !== "undefined" ? RTCRtpReceiver.getCapabilities("video") : null;
  if (!caps) return "unknown";
  const names = new Set(caps.codecs.map((c) => c.mimeType.replace(/^video\//, "")).filter((n) => !/rtx|red|ulpfec|flexfec/i.test(n)));
  return [...names].join(", ");
}

/** Load an image; its time to onload. */
function loadImage(url: string): Promise<{ ms?: number; text: string }> {
  return new Promise((resolve) => {
    const began = performance.now();
    const image = new Image();
    const timer = setTimeout(() => {
      resolve({ text: "timed out" });
    }, IMAGE_TIMEOUT_MS);
    image.onload = () => {
      clearTimeout(timer);
      const ms = performance.now() - began;
      resolve({ ms, text: `${Math.round(ms)} ms (${image.naturalWidth}×${image.naturalHeight})` });
    };
    image.onerror = () => {
      clearTimeout(timer);
      resolve({ text: "failed" });
    };
    image.src = url;
  });
}

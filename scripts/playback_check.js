// Phase 2A playback check: paste into Chrome DevTools (Console) while the
// Reolink panel's Playback tab is open for a camera. Read-only: it only loads
// timelines and plays recordings, like clicking through the tab by hand.
// It prints a report and copies it to the clipboard.
(async () => {
  const deep = (root, sel) => {
    const hit = root.querySelector(sel);
    if (hit) return hit;
    for (const el of root.querySelectorAll("*")) {
      const found = el.shadowRoot && deep(el.shadowRoot, sel);
      if (found) return found;
    }
    return null;
  };
  const el = deep(document, "rv-playback");
  if (!el) return console.error("Open a camera's Playback tab first.");
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const waitFor = async (test, ms) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (test()) return true;
      await sleep(100);
    }
    return false;
  };
  const ms = (v) => (v === undefined ? "–" : `${Math.round(v)} ms`);
  const lines = [];
  const log = (s) => {
    lines.push(s);
    console.log(s);
  };
  const clock = (t) => new Date(t).toLocaleTimeString();
  // The server's timing: cache state, queue wait, the two NVR searches.
  const server = (t) => {
    if (!t) return "?";
    const parts = [t.cache ?? "?"];
    if (t.age_s !== undefined) parts.push(`${t.age_s} s old`);
    for (const [key, label] of [
      ["queue_ms", "queue"],
      ["files_ms", "recordings"],
      ["events_ms", "events"],
      ["total_ms", "total"],
    ]) {
      if (typeof t[key] === "number") parts.push(`${label} ${ms(t[key])}`);
    }
    return parts.join(", ");
  };
  const mins = (v) => (v < 60000 ? `${Math.round(v / 1000)} s` : `${(v / 60000).toFixed(1)} min`);
  const player = () => el.renderRoot.querySelector("rv-player");
  // Times of the video element's events after a play request.
  const watchVideo = (began) => {
    const seen = {};
    const videos = [...(player()?.renderRoot.querySelectorAll("video") ?? [])];
    const handlers = ["loadedmetadata", "seeked", "playing"].map((name) => {
      const fn = (e) => {
        if (e.target.classList.contains("active")) seen[name] ??= performance.now() - began;
      };
      videos.forEach((v) => v.addEventListener(name, fn));
      return [name, fn];
    });
    return {
      seen,
      stop: () => handlers.forEach(([name, fn]) => videos.forEach((v) => v.removeEventListener(name, fn))),
    };
  };

  await waitFor(() => el._day && !el._loading, 30000);
  const today = el._date;
  const m0 = el._metrics;
  log(`Reolink Viewer playback check · ${navigator.userAgent.includes("Edg/") ? "Edge" : "Chrome"} · ${el.cameraName}`);
  log(`Delivery: ${el._progressive ? "progressive" : "whole file first (WebKit)"}`);
  log(`A1 Time to timeline, today (as the tab opened): ${ms(m0.timelineMs)} (server: ${server(m0.timelineServer)})`);

  // A2 / A3: a past day with recordings that has not been opened yet, then again.
  const loadDay = async (date) => {
    const before = el._metrics.timelineMs;
    el._selectDate(date);
    await waitFor(() => !el._loading && el._day?.date === date && el._metrics.timelineMs !== before, 60000);
    return el._metrics;
  };
  const [y, mo, d] = today.split("-").map(Number);
  const past = [...el._monthDays].filter((n) => n < d).sort((a, b) => b - a);
  const pastDate = past.length
    ? `${y}-${String(mo).padStart(2, "0")}-${String(past.at(Math.min(2, past.length - 1))).padStart(2, "0")}`
    : null;
  if (pastDate) {
    const a2 = await loadDay(pastDate);
    log(`A2 Time to timeline, ${pastDate}: ${ms(a2.timelineMs)} (server: ${server(a2.timelineServer)})`);
    await loadDay(today);
    const a3 = await loadDay(pastDate);
    log(`A3 Time to timeline, ${pastDate} again: ${ms(a3.timelineMs)} (server: ${server(a3.timelineServer)})`);
    const a4 = await loadDay(today);
    log(`A4 Time to timeline, today again: ${ms(a4.timelineMs)} (server: ${server(a4.timelineServer)})`);
  } else {
    log("A2/A3 skipped: no earlier recording day this month");
  }

  // B: click-to-video for the three latest events of today.
  const day = el._day;
  const events = (day?.events ?? []).slice(-3).reverse();
  if (!events.length) log("B skipped: no events today");
  for (const ev of events) {
    const seg = day.segments.find((s) => ev.start >= s.start && ev.start < s.end);
    const began = performance.now();
    const video = watchVideo(began);
    await el.playAt(ev.start, began);
    const ok = await waitFor(() => el._metrics.firstFrameMs !== undefined || el._playFailure, 90000);
    video.stop();
    const m = el._metrics;
    const c = el._playing?.cache ?? {};
    const state = c.complete ? "cached" : "filling";
    const where = seg ? `${mins(ev.start - seg.start)} into a ${mins(seg.end - seg.start)} recording` : "no recording";
    log(
      `B  ${ev.types.join("+")} at ${clock(ev.start)} (${where}): first frame ${ok ? ms(m.firstFrameMs) : "none after 90 s"}` +
        ` [URL ${ms(m.urlMs)} · metadata ${ms(video.seen.loadedmetadata)} · seeked ${ms(video.seen.seeked)} · playing ${ms(video.seen.playing)}]` +
        ` cache ${state} (${(c.bytes / 1e6).toFixed(1)} MB, index ${c.indexed ?? "?"}${c.fill_ms !== undefined ? `, fill ${ms(c.fill_ms)}` : ""})` +
        ` ${m.stream ?? "?"} ${m.codec ?? ""}${el._playFailure ? ` FAILED: ${el._playFailure}` : ""}`,
    );
    await sleep(2000);
  }

  // C: auto-advance between two touching recordings (shortest pair first).
  const segs = day?.segments ?? [];
  const pairs = segs
    .slice(0, -1)
    .map((s, i) => [s, segs[i + 1]])
    .filter(([a, b]) => b.start - a.end < 2000)
    .sort((p, q) => p[0].end - p[0].start - (q[0].end - q[0].start));
  if (!pairs.length) {
    log("C  skipped: no two touching recordings today");
  } else {
    const [a, b] = pairs[0];
    await el.playAt(Math.max(a.start, a.end - 8000), performance.now());
    await waitFor(() => el._metrics.firstFrameMs !== undefined || el._playFailure, 120000);
    const before = el._metrics.gapMs;
    const moved = await waitFor(
      () => el.renderRoot.querySelector("rv-player")?.current?.segmentId === b.id && el._metrics.gapMs !== before,
      45000,
    );
    log(
      `C  Moved on by itself at ${clock(a.end)} (from a ${mins(a.end - a.start)} recording): ${moved ? "yes" : "no"}` +
        ` · gap ${moved ? ms(el._metrics.gapMs) : "–"}${el._playFailure ? ` FAILED: ${el._playFailure}` : ""}`,
    );
  }
  player()?.pause();
  log(`Day: ${segs.length} recordings, ${day?.events.length ?? 0} events${day?.events_error ? `, event search failed (${day.events_error})` : ""}`);
  log(`HD: ${el._hd.reason}`);
  const report = lines.join("\n");
  try {
    await navigator.clipboard.writeText(report);
    console.log("%cReport copied to the clipboard.", "font-weight:bold");
  } catch {
    console.log("%cSelect the lines above and copy them.", "font-weight:bold");
  }
})();

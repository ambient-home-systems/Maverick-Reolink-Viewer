// Describe the MP4 structure of a cached recording, to see why a browser can
// or cannot seek in it quickly. Paste into Chrome DevTools (Console) on a
// camera's Playback tab after playing a recording (the one playing is used).
// Read-only: it downloads that recording from Home Assistant once and prints
// box types, sizes, track settings and the segment index; no video leaves
// the browser. The summary is copied to the clipboard.
(async () => {
  const deep = (root, sel) => {
    const hit = root.querySelector(sel);
    if (hit) return hit;
    for (const node of root.querySelectorAll("*")) {
      const found = node.shadowRoot && deep(node.shadowRoot, sel);
      if (found) return found;
    }
    return null;
  };
  const el = deep(document, "rv-playback");
  const url = window.__inspectUrl ?? el?._playing?.url;
  if (!url) return console.error("Play a recording on a camera's Playback tab first.");
  const lines = [];
  const log = (s) => {
    lines.push(s);
    console.log(s);
  };
  const u32 = (b, o) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
  const u64 = (b, o) => u32(b, o) * 2 ** 32 + u32(b, o + 4);
  const u24 = (b, o) => (b[o] << 16) | (b[o + 1] << 8) | b[o + 2];
  const fourcc = (b, o) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
  const children = (b, start, end) => {
    const out = [];
    let o = start;
    while (o + 8 <= end) {
      let size = u32(b, o);
      let header = 8;
      if (size === 1) {
        size = u64(b, o + 8);
        header = 16;
      } else if (size === 0) size = end - o;
      if (size < header || o + size > end) break;
      out.push({ type: fourcc(b, o + 4), start: o, payload: o + header, end: o + size });
      o += size;
    }
    return out;
  };

  // Read the whole file (recordings are tens to a few hundred MB).
  const began = performance.now();
  const resp = await fetch(url);
  const buf = new Uint8Array(await resp.arrayBuffer());
  const fileSize = buf.length;
  const seconds = (performance.now() - began) / 1000;
  log(`Recording: ${(fileSize / 1e6).toFixed(1)} MB, read in ${seconds.toFixed(1)} s (${resp.status}, ${resp.headers.get("content-type")})`);
  const top = children(buf, 0, fileSize).map((b) => ({ ...b, size: b.end - b.start }));
  const tail = top.at(-1);
  if (!tail || tail.end !== fileSize) log(`!! Top-level boxes stop at ${tail?.end ?? 0} of ${fileSize} bytes`);
  const kept = new Map();
  for (const b of top) {
    if (!["moov", "sidx", "moof"].includes(b.type)) continue;
    const list = kept.get(b.type) ?? [];
    list.push({ start: b.start, data: buf.subarray(b.start, b.end) });
    kept.set(b.type, list);
  }

  const counts = {};
  for (const b of top) counts[b.type] = (counts[b.type] ?? 0) + 1;
  log(`Top-level boxes: ${Object.entries(counts).map(([t, n]) => `${t}×${n}`).join(", ")}`);
  log(`First boxes: ${top.slice(0, 8).map((b) => `${b.type}@${b.start}(${b.size})`).join(" ")}`);
  log(`Last boxes: ${top.slice(-3).map((b) => `${b.type}@${b.start}(${b.size})`).join(" ")}`);

  // moov: movie header, tracks, fragment defaults.
  const moov = kept.get("moov")?.[0]?.data;
  if (moov) {
    for (const box of children(moov, 8, moov.length)) {
      if (box.type === "mvhd") {
        const v = moov[box.payload];
        const ts = u32(moov, box.payload + (v ? 20 : 12));
        const dur = v ? u64(moov, box.payload + 24) : u32(moov, box.payload + 16);
        log(`mvhd: v${v}, timescale ${ts}, duration ${dur} (${(dur / ts).toFixed(1)} s)`);
      } else if (box.type === "trak") {
        const parts = [];
        for (const c of children(moov, box.payload, box.end)) {
          if (c.type === "tkhd") {
            const v = moov[c.payload];
            parts.push(`tkhd v${v} id ${u32(moov, c.payload + (v ? 20 : 12))} flags ${u24(moov, c.payload + 1)}`);
          } else if (c.type === "edts") parts.push("edts");
          else if (c.type === "mdia") {
            for (const m of children(moov, c.payload, c.end)) {
              if (m.type === "mdhd") {
                const v = moov[m.payload];
                const ts = u32(moov, m.payload + (v ? 20 : 12));
                const dur = v ? u64(moov, m.payload + 24) : u32(moov, m.payload + 16);
                parts.push(`mdhd timescale ${ts} duration ${dur}`);
              } else if (m.type === "hdlr") parts.push(`hdlr ${fourcc(moov, m.payload + 8)}`);
              else if (m.type === "minf") {
                const stbl = children(moov, m.payload, m.end).find((x) => x.type === "stbl");
                const stsd = stbl && children(moov, stbl.payload, stbl.end).find((x) => x.type === "stsd");
                if (stsd) parts.push(`entry ${fourcc(moov, stsd.payload + 12)}`);
                const stts = stbl && children(moov, stbl.payload, stbl.end).find((x) => x.type === "stts");
                if (stts) parts.push(`stts entries ${u32(moov, stts.payload + 4)}`);
              }
            }
          }
        }
        log(`trak: ${parts.join(", ")}`);
      } else if (box.type === "mvex") {
        for (const c of children(moov, box.payload, box.end)) {
          if (c.type === "mehd") {
            const v = moov[c.payload];
            log(`mehd: fragment duration ${v ? u64(moov, c.payload + 4) : u32(moov, c.payload + 4)}`);
          } else if (c.type === "trex") {
            log(`trex: track ${u32(moov, c.payload + 4)}, default duration ${u32(moov, c.payload + 12)}, size ${u32(moov, c.payload + 16)}, flags 0x${u32(moov, c.payload + 20).toString(16)}`);
          }
        }
      } else log(`moov child: ${box.type} (${box.end - box.start} bytes)`);
    }
  } else log("!! no moov kept");

  // The first moof, in detail.
  const moofs = top.filter((b) => b.type === "moof");
  const moofKept = kept.get("moof") ?? [];
  const describeMoof = (m, label) => {
    const b = m.data;
    const trafs = children(b, 8, b.length).filter((x) => x.type === "traf");
    const parts = trafs.map((traf) => {
      const out = [];
      for (const c of children(b, traf.payload, traf.end)) {
        const flags = u24(b, c.payload + 1);
        if (c.type === "tfhd") {
          let at = c.payload + 8;
          let text = `tfhd track ${u32(b, c.payload + 4)} flags 0x${flags.toString(16)}`;
          if (flags & 1) {
            text += ` base ${u64(b, at)}${u64(b, at) === m.start ? " (= moof)" : ` (moof at ${m.start})`}`;
            at += 8;
          }
          if (flags & 2) at += 4;
          if (flags & 8) text += ` defdur ${u32(b, at)}`, (at += 4);
          out.push(text);
        } else if (c.type === "tfdt") {
          const v = b[c.payload];
          out.push(`tfdt v${v} ${v ? u64(b, c.payload + 4) : u32(b, c.payload + 4)}`);
        } else if (c.type === "trun") {
          const count = u32(b, c.payload + 4);
          let at = c.payload + 8;
          if (flags & 1) at += 4;
          if (flags & 4) at += 4;
          const fields = [0x100, 0x200, 0x400, 0x800].filter((f) => flags & f).length;
          let dur = 0;
          if (flags & 0x100) for (let k = 0; k < count; k++) dur += u32(b, at + k * 4 * fields);
          out.push(`trun flags 0x${flags.toString(16)} samples ${count}${flags & 0x100 ? ` dur ${dur}` : ""}`);
        } else out.push(c.type);
      }
      return out.join(" / ");
    });
    log(`${label} @${m.start}: ${parts.join(" | ")}`);
  };
  if (moofKept[0]) describeMoof(moofKept[0], "first moof");
  if (moofKept.at(-1) && moofKept.length > 1) describeMoof(moofKept.at(-1), "last moof");

  // The segment index: does every reference land on a moof, ending at the file end?
  const sidxs = kept.get("sidx") ?? [];
  if (!sidxs.length) log("sidx: none");
  const moofStarts = new Set(moofs.map((m) => m.start));
  for (const s of sidxs) {
    const b = s.data;
    const v = b[8];
    const ref = u32(b, 12);
    const ts = u32(b, 16);
    const ept = v ? u64(b, 20) : u32(b, 20);
    const first = v ? u64(b, 28) : u32(b, 24);
    let at = v ? 36 : 28;
    const count = (b[at + 2] << 8) | b[at + 3];
    at += 4;
    let offset = s.start + b.length + first;
    let duration = 0;
    let misses = 0;
    let zero = 0;
    for (let k = 0; k < count; k++) {
      if (!moofStarts.has(offset)) misses += 1;
      const size = u32(b, at) & 0x7fffffff;
      const d = u32(b, at + 4);
      if (!d) zero += 1;
      duration += d;
      offset += size;
      at += 12;
    }
    log(
      `sidx track ${ref}: timescale ${ts}, earliest ${ept}, ${count} refs over ${(duration / ts).toFixed(1)} s` +
        `, ${misses} not on a moof, ${zero} with zero duration, ends at ${offset}${offset === fileSize ? " (file end)" : ` — file is ${fileSize}`}`,
    );
  }
  log(`moofs: ${moofs.length}${moofs.length ? `, first at ${moofs[0].start}` : ""}`);
  try {
    await navigator.clipboard.writeText(lines.join("\n"));
    console.log("%cSummary copied to the clipboard.", "font-weight:bold");
  } catch {
    console.log("%cSelect the lines above and copy them.", "font-weight:bold");
  }
})();

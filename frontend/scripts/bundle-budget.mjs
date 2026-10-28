// The panel's performance budget (docs/IMPLEMENTATION_PLAN.md, Phase 4 step 2):
// what the home view downloads (the entry and every file it imports, gzipped)
// stays under BUDGET_KB. The other views are their own files, loaded the first
// time they are shown; this prints what each adds.
//
//   node scripts/bundle-budget.mjs [dist-dir]
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const BUDGET_KB = 200;
const ENTRY = "reolink-viewer-panel.js";
const dist = process.argv[2] ?? new URL("../../custom_components/reolink_viewer/frontend_dist", import.meta.url).pathname;

const source = (file) => readFileSync(join(dist, file), "utf8");
const gzipKb = (file) => gzipSync(readFileSync(join(dist, file))).length / 1024;
const staticImports = (file) =>
  [...source(file).matchAll(/^(?:import|export)\b[^;'"]*?["']\.\/([^"']+\.js)["']/gm)].map((m) => m[1]);
const dynamicImports = (file) => [...source(file).matchAll(/import\(\s*["']\.\/([^"']+\.js)["']\s*\)/g)].map((m) => m[1]);

/** A file and everything it imports statically, in load order. */
function closure(file, seen = new Set()) {
  if (seen.has(file)) return seen;
  seen.add(file);
  for (const dep of staticImports(file)) closure(dep, seen);
  return seen;
}

const sum = (files) => [...files].reduce((total, file) => total + gzipKb(file), 0);
const fileCount = (n) => `${n} ${n === 1 ? "file" : "files"}`;
const initial = closure(ENTRY);
const initialKb = sum(initial);
const lines = [`Home view: ${initialKb.toFixed(1)} KB gzipped in ${fileCount(initial.size)} (budget ${BUDGET_KB} KB)`];

// Each view loaded on demand: what it adds to what is already loaded.
const lazy = new Set([...initial].flatMap((file) => dynamicImports(file)));
for (const file of [...lazy].sort()) {
  const extra = [...closure(file)].filter((f) => !initial.has(f));
  const nested = new Set(extra.flatMap((f) => dynamicImports(f)).filter((f) => !initial.has(f)));
  lines.push(`  + ${file.replace(/-[\w-]{8}\.js$/, "")}: ${sum(extra).toFixed(1)} KB in ${fileCount(extra.length)}`);
  for (const inner of nested) {
    const more = [...closure(inner)].filter((f) => !initial.has(f) && !extra.includes(f));
    lines.push(`    + ${inner.replace(/-[\w-]{8}\.js$/, "")}: ${sum(more).toFixed(1)} KB`);
  }
}
const all = readdirSync(dist).filter((f) => f.endsWith(".js"));
lines.push(`Every file: ${sum(all).toFixed(1)} KB gzipped in ${fileCount(all.length)}`);
console.log(lines.join("\n"));

if (initialKb > BUDGET_KB) {
  console.error(`The home view's JavaScript is ${initialKb.toFixed(1)} KB gzipped, over the ${BUDGET_KB} KB budget.`);
  process.exit(1);
}

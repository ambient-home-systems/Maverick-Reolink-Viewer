// Reduced motion (Phase 4 step 5): every element that moves or fades has a
// prefers-reduced-motion rule beside it that stops it.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [path] : [];
  });
}

describe("reduced motion", () => {
  it("is honoured wherever the panel animates", () => {
    const moving = sources(join(__dirname))
      .map((path) => ({ path, text: readFileSync(path, "utf8") }))
      .filter(({ text }) => /^\s*(transition|animation):(?!\s*none)/m.test(text));
    expect(moving.length).toBeGreaterThan(0);
    for (const { path, text } of moving) {
      expect(text, path).toMatch(/@media \(prefers-reduced-motion: reduce\)[^@]*(transition|animation): none/);
    }
  });
});

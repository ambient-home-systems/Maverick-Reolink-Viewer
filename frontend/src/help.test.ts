// The panel's help (Phase 4 step 7): its links reach real sections of the
// docs, and the troubleshooting guide explains every message the panel can
// show, word for word, so a user can find the one they see.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import packageJson from "../package.json";
import { HELP, helpUrl, type HelpDoc } from "./help";
import { VERSION } from "./version";

const DOCS = join(__dirname, "..", "..", "docs");

function doc(name: HelpDoc): string {
  return readFileSync(join(DOCS, `${name}.md`), "utf8");
}

function source(path: string): string {
  return readFileSync(join(__dirname, path), "utf8");
}

/** The anchor GitHub gives a heading. */
function slug(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-");
}

function anchors(markdown: string): string[] {
  return [...markdown.matchAll(/^#{1,6} (.+)$/gm)].map((m) => slug(m[1]));
}

/** Text as a reader finds it: no quote marks, one space between words, plain apostrophes. */
function plain(text: string): string {
  return text
    .replace(/^> ?/gm, "")
    .replace(/\s+/g, " ")
    .replace(/[‘’]/g, "'");
}

/**
 * What a module tells the user: the strings after `text:` and `title:`. A
 * template's fixed parts count, where they are long enough to search for.
 */
function messages(path: string): string[] {
  const found: string[] = [];
  for (const m of source(path).matchAll(/\b(?:text|title):\s*("(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)/g)) {
    const literal = m[1].slice(1, -1);
    for (const part of literal.split(/\$\{[^}]*\}/)) {
      const text = part.trim().replace(/^[:,]\s*/, "");
      if (text.length >= 15) found.push(text);
    }
  }
  return found;
}

describe("help", () => {
  it("opens the docs of this release", () => {
    expect(VERSION).toBe(packageJson.version);
    expect(helpUrl("troubleshooting")).toBe(
      `https://github.com/ambient-home-systems/Maverick-Reolink-Viewer/blob/v${VERSION}/docs/troubleshooting.md`,
    );
    expect(helpUrl("changed")).toMatch(/troubleshooting\.md#reolink-viewer-needs-an-update$/);
  });

  it("links only to sections the docs have", () => {
    for (const [topic, [name, section]] of Object.entries(HELP) as [string, readonly [HelpDoc, string?]][]) {
      const markdown = doc(name);
      if (section) expect(anchors(markdown), `${topic}: ${name}.md#${section}`).toContain(section);
    }
  });

  it("explains every message the panel shows, word for word", () => {
    const guide = plain(doc("troubleshooting"));
    const shown = [
      ...messages("live/explain.ts"),
      ...messages("playback/explain.ts"),
      ...messages("integration.ts"),
      // A camera Home Assistant cannot reach; a disk that is not ready.
      "Home Assistant cannot reach this camera. It plays again when it is back.",
      "not formatted, or failed",
      // Why a camera's Playback tab has nothing to play.
      ...[...source("components/device-page.ts").matchAll(/<h2>([^<$]+)<\/h2>/g)].map((m) => m[1]),
    ];
    expect(shown.length).toBeGreaterThan(30);
    const missing = shown.map(plain).filter((text) => !guide.includes(text));
    expect(missing).toEqual([]);
  });

  it("has docs whose links and pictures all lead somewhere", () => {
    for (const name of ["user-guide", "troubleshooting", "cameras"] as const) {
      const markdown = doc(name);
      for (const m of markdown.matchAll(/\]\(([^)\s]+)\)|src="([^"]+)"/g)) {
        // One of the two alternatives matched.
        const target = (m[1] as string | undefined) ?? m[2];
        if (/^https?:/.test(target)) continue;
        const [file, section] = target.split("#");
        // Reading it fails for a file that is not there (a picture too).
        const linked = file ? readFileSync(join(DOCS, file), "utf8") : markdown;
        if (section) expect(anchors(linked), `${name}.md: ${target}`).toContain(section);
      }
    }
  });

  it("says what each word on a camera's tile means", () => {
    const guide = doc("troubleshooting");
    const words = [...source("components/live-tile.ts").matchAll(/stateChip\("([^"]+)"/g)].map((m) => m[1]);
    expect(words).toEqual(expect.arrayContaining(["Live", "Starting", "Retrying", "Offline", "Asleep"]));
    for (const word of [...words, "Picture", "No sub stream"]) expect(guide).toContain(`**${word}**`);
  });
});

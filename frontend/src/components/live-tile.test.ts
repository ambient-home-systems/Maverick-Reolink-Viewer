// Full screen's layout, from the tile's own stylesheet: the browsers that run
// these tests do not lay out shadow roots, and Chromium's check of it is in
// docs/IMPLEMENTATION_PLAN.md (Phase 4, the owner's iPhone, 2026-10-28).
import type { CSSResult } from "lit";
import { describe, expect, it } from "vitest";

import { RvLiveTile } from "./live-tile";

const css = ([RvLiveTile.styles].flat(Infinity) as CSSResult[]).map((s) => s.cssText).join("\n");

/** The selectors of the rules that set a declaration. */
function selectorsOf(declaration: RegExp): string[] {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, , body]) => declaration.test(body))
    .map(([, selector]) => selector.replace(/\/\*[\s\S]*?\*\//g, "").trim());
}

describe("full screen", () => {
  it("shows the whole picture, SD too: the board's crop never applies there", () => {
    const cover = selectorsOf(/object-fit:\s*cover/);
    expect(cover.length).toBeGreaterThan(0);
    for (const selector of cover.flatMap((s) => s.split(","))) {
      expect(selector, selector).toContain(":not([full])");
    }
    expect(selectorsOf(/object-fit:\s*contain/).join(",")).toMatch(/:host\(\[full\]\) video/);
  });

  it("keeps the picture and its buttons inside a phone's safe area", () => {
    const [rule] = [...css.matchAll(/:host\(\[full\]\)\s*\{([^}]*)\}/g)].map(([, body]) => body);
    expect(rule).toMatch(/position:\s*fixed/);
    expect(rule).toMatch(/box-sizing:\s*border-box/);
    for (const side of ["top", "right", "bottom", "left"]) {
      expect(rule).toContain(`env(safe-area-inset-${side}`);
    }
  });
});

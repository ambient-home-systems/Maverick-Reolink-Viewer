import { readFileSync, readdirSync } from "node:fs";

import { defineConfig, type Plugin } from "vite";

// The panel loads its fonts from fonts/ beside its module; in the preview
// that module is assets/index-*.js.
const panelFonts: Plugin = {
  name: "panel-fonts",
  generateBundle() {
    const dir = new URL("public/fonts/", import.meta.url);
    for (const name of readdirSync(dir)) {
      this.emitFile({ type: "asset", fileName: `assets/fonts/${name}`, source: readFileSync(new URL(name, dir)) });
    }
  },
};

// The design preview (preview/): the real panel with a fake Home Assistant,
// built into .preview/ for screenshots (scripts/preview_capture.cjs). Not
// shipped.
export default defineConfig({
  root: "preview",
  base: "./",
  build: { outDir: "../.preview", emptyOutDir: true, target: "es2022" },
  plugins: [panelFonts],
});

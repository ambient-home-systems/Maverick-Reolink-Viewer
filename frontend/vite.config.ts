import { defineConfig } from "vitest/config";

// Builds a single ES module that HA loads via panel_custom (module_url).
// Lit is bundled in: HA's own copy is not exposed to custom panels.
export default defineConfig({
  build: {
    outDir: "../custom_components/reolink_viewer/frontend_dist",
    emptyOutDir: true,
    target: "es2022",
    sourcemap: false,
    lib: {
      entry: "src/reolink-viewer-panel.ts",
      formats: ["es"],
      fileName: () => "reolink-viewer-panel.js",
    },
  },
  test: {
    environment: "happy-dom",
    include: ["src/**/*.test.ts"],
  },
});

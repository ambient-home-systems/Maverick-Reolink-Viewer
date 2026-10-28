import { defineConfig } from "vitest/config";

// Builds the ES module that HA loads via panel_custom (module_url). Lit is
// bundled in: HA's own copy is not exposed to custom panels. The views beyond
// the home page (src/views.ts) are their own files beside it, loaded when
// first shown; what the home view needs is one more file ("home"), so it
// arrives in two requests rather than a chain of them.
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
    rolldownOptions: {
      output: {
        codeSplitting: { groups: [{ name: "home", tags: ["$initial"] }] },
      },
    },
  },
  test: {
    environment: "happy-dom",
    include: ["src/**/*.test.ts"],
  },
});

import { defineConfig } from "vitest/config";

// Builds the ES modules that HA loads: the panel (via panel_custom's
// module_url) and the dashboard card (added to every page with
// frontend.add_extra_js_url). Lit is bundled in: HA's own copy is not exposed
// to custom panels or cards.
//
// - The panel: the views beyond the home page (src/views.ts) are their own
//   files beside it, loaded when first shown; what the home view needs is in
//   three more files ("home", "live" and "lit"), which the panel's module
//   imports at once rather than as a chain.
// - The card: its module is only its settings and Lit (it loads on every page,
//   card or not); its body, the live tile ("live", shared with the panel's
//   home view), comes once a card is shown; its editor once that opens.
//   `npm run budget` holds each to its budget.
const HOME_EXCLUDES = /[\\/]src[\\/](card[\\/]|reolink-viewer-panel\.ts$)/;
const LIVE = /[\\/]src[\\/](components[\\/]live-tile|live[\\/]data|live[\\/]hd|fonts|styles)\.ts$/;

export default defineConfig({
  build: {
    outDir: "../custom_components/reolink_viewer/frontend_dist",
    emptyOutDir: true,
    target: "es2022",
    sourcemap: false,
    lib: {
      entry: {
        "reolink-viewer-panel": "src/reolink-viewer-panel.ts",
        "reolink-viewer-card": "src/card/index.ts",
      },
      formats: ["es"],
      fileName: (_format, name) => `${name}.js`,
    },
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: "lit", test: /[\\/]node_modules[\\/](lit|lit-html|lit-element|@lit[\\/][^\\/]+)[\\/]/, priority: 3 },
            // What the card's body imports, and everything that imports.
            { name: "live", test: LIVE, priority: 2 },
            // The rest of the home view, but for the panel's own module, which
            // so imports all three at once.
            { name: "home", tags: ["$initial"], test: (id) => !HOME_EXCLUDES.test(id), priority: 1 },
          ],
        },
      },
    },
  },
  test: {
    environment: "happy-dom",
    include: ["src/**/*.test.ts"],
  },
});

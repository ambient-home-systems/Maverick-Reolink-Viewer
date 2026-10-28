import { defineConfig } from "vite";

// The design preview (preview/): the real panel with a fake Home Assistant,
// built into .preview/ for screenshots (preview/capture.mjs). Not shipped.
export default defineConfig({
  root: "preview",
  base: "./",
  build: { outDir: "../.preview", emptyOutDir: true, target: "es2022" },
});

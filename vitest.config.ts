import { fileURLToPath } from "node:url";
import vue from "@vitejs/plugin-vue";
import wasm from "vite-plugin-wasm";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [vue(), wasm()],
  resolve: {
    // Rapier only declares a browser "module" entry, which Node resolution skips.
    alias: { "@dimforge/rapier2d": fileURLToPath(new URL("node_modules/@dimforge/rapier2d/rapier.js", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts", "worker/**/*.test.ts"],
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    server: { deps: { inline: [/@dimforge\/rapier2d/] } },
  },
});

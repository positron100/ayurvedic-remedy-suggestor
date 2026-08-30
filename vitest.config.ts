import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

/**
 * Engine tests run in Node (no DOM). Component tests opt into jsdom with a
 * `// @vitest-environment jsdom` docblock at the top of the file.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}", "api/**/*.test.ts"],
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
    // The App-flow tests drive a full framer-motion + lazy/Suspense tree through
    // compose → processing → result; give them headroom over the async-util
    // window so they don't flake under parallel-worker load.
    testTimeout: 15000,
  },
});

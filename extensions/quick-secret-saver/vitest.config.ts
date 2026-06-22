// vitest.config.ts
import { defineConfig } from "vitest/config";
import path from "node:path";

// @raycast/api ships only TypeScript types + a CLI; it has no runnable JS entry
// (the real API is injected by Raycast at runtime). Vitest therefore can't
// resolve the bare specifier when a test imports it. We alias it to an
// in-memory mock so tests run without Raycast. tsc still uses the real types.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    alias: {
      "@raycast/api": path.resolve(__dirname, "src/test/raycast-api-mock.ts"),
    },
  },
});

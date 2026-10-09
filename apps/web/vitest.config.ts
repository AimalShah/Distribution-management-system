import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

/**
 * Component tests for the web app. The environment is jsdom and the seam every
 * page is tested at is `../../lib/api` (mocked with `vi.mock`) — the same seam
 * the pages themselves program against, so a test survives a transport swap.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    globals: false,
  },
});

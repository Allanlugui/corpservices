import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3102",
  },
  webServer: {
    command: "npx next dev --port 3102",
    url: "http://localhost:3102/api/health",
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      PORT: "3102",
    },
  },
});

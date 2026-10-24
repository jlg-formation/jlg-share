import { defineConfig } from "@playwright/test";
const baseURL = process.env.E2E_DEV_PROXY
  ? "http://127.0.0.1:4174"
  : "http://127.0.0.1:4173";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  use: {
    baseURL,
    channel: process.env.CI ? undefined : "msedge",
    timezoneId: "Europe/Paris",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "bun scripts/e2e-server.ts",
    url: baseURL + "/api/health",
    reuseExistingServer: false,
  },
});

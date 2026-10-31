import { defineConfig, devices } from "@playwright/test";

/**
 * E2E against a running app (`npm run dev` locally; reused if already running).
 * Uses the seeded demo accounts (`npm run db:seed`) and the dev database.
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "mobile", use: { ...devices["iPhone 14"], browserName: "chromium" } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/en",
    reuseExistingServer: true,
    timeout: 180_000,
    env: { E2E_TEST_HOOKS: "1" },
  },
});

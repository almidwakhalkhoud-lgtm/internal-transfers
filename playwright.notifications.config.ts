import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "notifications.spec.ts",
  workers: 1,
  fullyParallel: false,
  timeout: 45_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: "http://127.0.0.1:3102",
    browserName: "chromium",
    viewport: { width: 1440, height: 1000 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  reporter: [
    ["list"],
    ["html", { outputFolder: "output/qa/notification-report", open: "never" }],
  ],
  webServer: {
    command:
      "node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3102",
    env: { BUZZ_TEST: "0" },
    url: "http://127.0.0.1:3102/login",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});

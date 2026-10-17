import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://localhost:3001",
    launchOptions: {
      executablePath: "/usr/bin/chromium",
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--no-proxy-server"],
    },
  },
  webServer: {
    command: "npm run dev -- --port 3001",
    url: "http://localhost:3001/login",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});

import { defineConfig, devices } from "@playwright/test";
const useRunningServer = process.env.PLAYWRIGHT_USE_RUNNING_SERVER === "1";
const port = useRunningServer ? Number(process.env.PLAYWRIGHT_PORT || 3000) : 3001;
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: `http://localhost:${port}`,
    launchOptions: {
      executablePath: "/usr/bin/chromium",
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--no-proxy-server"],
    },
  },
  webServer: {
    command: `npm run dev -- --port ${port}`,
    url: `http://localhost:${port}/login`,
    reuseExistingServer: useRunningServer,
    timeout: 60_000,
  },
});

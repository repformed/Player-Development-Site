import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests",
  testMatch: "public-usability.spec.ts",
  workers: 1,
  retries: 0,
  timeout: 30000,
  reporter: "list",
  outputDir: "test-results/public-usability",
  use: {
    baseURL: "http://127.0.0.1:5220",
    serviceWorkers: "block",
    launchOptions: {
      executablePath: "/usr/bin/chromium",
      args: ["--no-sandbox"],
    },
  },
  webServer: {
    command: "python3 -m http.server 5220 --bind 127.0.0.1 --directory dist",
    url: "http://127.0.0.1:5220",
    reuseExistingServer: false,
  },
});

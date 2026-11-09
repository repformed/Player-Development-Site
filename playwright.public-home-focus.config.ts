import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests",
  testMatch: ["public-home-focus.spec.ts", "public-usability.spec.ts"],
  workers: 1,
  retries: 0,
  timeout: 30000,
  reporter: "list",
  outputDir: "test-results/public-home-focus",
  use: {
    baseURL: "http://127.0.0.1:5221",
    serviceWorkers: "block",
    launchOptions: {
      executablePath: "/usr/bin/chromium",
      args: ["--no-sandbox"],
    },
  },
  webServer: {
    command: "python3 -m http.server 5221 --bind 127.0.0.1 --directory dist",
    url: "http://127.0.0.1:5221",
    reuseExistingServer: false,
  },
});

const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({
  testDir: "./tests/e2e",
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:4000",
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
        (require("fs").existsSync("/opt/google/chrome/chrome")
          ? "/opt/google/chrome/chrome"
          : undefined),
      args: ["--disable-gpu"],
    },
    headless: true,
  },
  workers: 1,
  reporter: "list",
});

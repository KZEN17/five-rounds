import { defineConfig, devices } from "@playwright/test";

const PORT = 3210;
const DB_DIR = ".pglite-e2e";

/**
 * Smoke test against a dev server with its own throwaway PGlite database.
 * Set PW_CHROMIUM to use a locally installed Chromium instead of Playwright's download.
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 240_000,
  retries: 0,
  reporter: [["list"]],
  use: {
    ...devices["Pixel 7"],
    baseURL: `http://localhost:${PORT}`,
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
    trace: "retain-on-failure",
  },
  webServer: {
    command: `rm -rf ${DB_DIR} && mkdir -p ${DB_DIR} && npx drizzle-kit migrate && npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 180_000,
    reuseExistingServer: false,
    env: {
      DATABASE_URL: `pglite://${DB_DIR}`,
      AUTH_URL: `http://localhost:${PORT}`,
      MAIL_SINK_FILE: `${DB_DIR}/mail.log`,
      SIGNUP_MODE: "open",
    },
  },
});

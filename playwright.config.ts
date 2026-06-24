import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
// 127.0.0.1 (not localhost) to match the local Supabase SiteURL, so the session
// cookie host stays consistent across the magic-link confirm → dashboard hop.
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL,
    trace: "on-first-retry",
    // Bound each action so a missed selector fails fast (~15s) instead of hanging the whole window.
    actionTimeout: 15_000,
    // `npm run test:e2e:watch` sets E2E_SLOWMO to slow every action down so the run is watchable
    // in a headed window (the --headed flag flips headless off). Unset in CI → full-speed headless.
    launchOptions: { slowMo: Number(process.env.E2E_SLOWMO) || 0 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Boot the app for E2E. Reuses a running dev server locally.
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

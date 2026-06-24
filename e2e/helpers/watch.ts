import type { Page } from "@playwright/test";

// True when running the headed watch tour (`npm run test:e2e:watch` sets E2E_HEADED).
export const WATCHING = !!process.env.E2E_HEADED;

// A short beat between major steps so a human can read each screen — only when watching (headed).
// No-op in headless CI runs, so they stay fast.
export async function beat(page: Page, ms = 1200): Promise<void> {
  if (WATCHING) await page.waitForTimeout(ms);
}

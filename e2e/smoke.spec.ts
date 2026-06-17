import { test, expect } from "@playwright/test";

// Smoke test: the app boots and serves the home page.
// Replace/extend with the booking-flow E2E once slice 1 exists — that's the
// critical path (availability hold -> deposit -> confirmation) we most need covered.
test("home page renders", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/.+/);
});

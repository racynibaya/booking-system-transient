import { expect, test } from "@playwright/test";

import { signUpOperator } from "./helpers/operator";
import { beat } from "./helpers/watch";

// ───────────────────────────────────────────────────────────────────────────────────────────────
// Scenario 6 — operator authentication.
//
// New operator SIGNS UP (lands authenticated on the dashboard) → SIGNS OUT → SIGNS IN again with the
// same credentials → and the FORGOT-PASSWORD path returns its neutral notice. Covers the whole
// password-auth surface (signup/signin/reset) the operator console is gated behind.
// ───────────────────────────────────────────────────────────────────────────────────────────────

test("operator can sign up, sign out, sign in, and request a reset", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1366, height: 900 });

  const creds = await test.step("Sign up", async () => {
    const c = await signUpOperator(page);
    await expect(page).toHaveURL(/\/dashboard|\/verification|\/properties/);
    console.log(`\n▶ Signed up ${c.email}\n`);
    return c;
  });

  await test.step("Sign out", async () => {
    await page.getByRole("button", { name: /sign out/i }).click();
    await page.waitForURL(/\/login/, { timeout: 15_000 });
    await beat(page);
  });

  await test.step("Sign back in", async () => {
    await page.getByPlaceholder(/you@example\.com/i).fill(creds.email);
    await page.getByPlaceholder(/at least 8 characters/i).fill(creds.password);
    await beat(page);
    await page.getByRole("button", { name: /^Sign in$/ }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
    await beat(page);
  });

  await test.step("Forgot-password returns a neutral notice", async () => {
    await page.goto("/login");
    await page.getByRole("button", { name: /forgot password/i }).click();
    await page.getByPlaceholder(/you@example\.com/i).fill(creds.email);
    await beat(page);
    await page.getByRole("button", { name: /send reset link/i }).click();
    await expect(page.getByText(/if an account exists/i)).toBeVisible({ timeout: 15_000 });
    await beat(page, 1600);
  });

  console.log("\n✓ Auth: signup → signout → signin → reset notice.\n");
});

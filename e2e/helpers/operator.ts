import { expect, type Page } from "@playwright/test";

import { beat } from "./watch";

// Sign in an existing operator through the real login form (password auth). Lands on the dashboard
// (or /admin for the admin account). Used by flows that need a seeded operator's existing inventory.
export async function signInAsOperator(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.getByPlaceholder(/you@example\.com/i).fill(email);
  await page.getByPlaceholder(/at least 8 characters/i).fill(password);
  await beat(page);
  await page.getByRole("button", { name: /^Sign in$/ }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
  await beat(page);
}

// Create a brand-new operator account via the signup form. Local Supabase has email confirmation
// OFF (config.toml: enable_confirmations=false), so signup sets a session and redirects straight to
// the dashboard. A fresh, isolated tenant — the right starting point for onboarding-style flows.
export async function signUpOperator(
  page: Page,
): Promise<{ email: string; password: string; name: string }> {
  const stamp = Date.now();
  const creds = {
    email: `e2e-op-${stamp}@example.com`,
    password: "e2e-password-123",
    name: `E2E Operator ${stamp}`,
  };

  await page.goto("/login");
  await page.getByRole("button", { name: /create an account/i }).click();
  await page.getByPlaceholder(/juan dela cruz/i).fill(creds.name);
  await page.getByPlaceholder(/you@example\.com/i).fill(creds.email);
  await page.getByPlaceholder(/at least 8 characters/i).fill(creds.password);
  await beat(page);
  await page.getByRole("button", { name: /^Create account$/ }).click();
  await page.waitForURL(/\/dashboard|\/admin|\/verification|\/properties/, { timeout: 20_000 });
  await expect(page).not.toHaveURL(/\/login/);
  await beat(page);

  return creds;
}

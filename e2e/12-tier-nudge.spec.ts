import { expect, test } from "@playwright/test";

import { signUpOperator } from "./helpers/operator";
import { beat } from "./helpers/watch";

// ───────────────────────────────────────────────────────────────────────────────────────────────
// Scenario 12 — room-gated tiers (the upgrade nudge).
//
// A fresh operator is on Solo (cap 4 rooms). Adding a room that pushes them past the cap is gently
// blocked with the "Upgrade to add more rooms" prompt — the visible edge of the room-gated pricing.
// ───────────────────────────────────────────────────────────────────────────────────────────────

test("adding rooms past the plan cap shows the upgrade nudge", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1366, height: 900 });

  await signUpOperator(page);
  const propertyName = `E2E Big Hotel ${Date.now()}`;
  console.log(`\n▶ Solo operator tries to add 5 rooms (cap is 4) on "${propertyName}"\n`);

  await test.step("Create a property", async () => {
    await page.goto("/properties/new");
    await page.getByPlaceholder(/kahuna beach house/i).fill(propertyName);
    await beat(page);
    await page.getByRole("button", { name: /^Create property$/ }).click();
    await page.waitForURL(/\/properties\/[0-9a-f-]{36}/, { timeout: 20_000 });
    await beat(page);
  });

  await test.step("Adding a 5-room type trips the upgrade nudge", async () => {
    await page.getByRole("button", { name: /^Add room type$/ }).click();
    const form = page.locator("form").filter({ has: page.getByPlaceholder(/deluxe double/i) });
    await form.getByPlaceholder(/deluxe double/i).fill("Standard Room");
    const numbers = form.getByRole("spinbutton");
    await numbers.nth(0).fill("2"); // capacity
    await numbers.nth(1).fill("5"); // quantity → 5 > Solo cap of 4
    await numbers.nth(2).fill("1200"); // price
    await beat(page);
    await form.getByRole("button", { name: /^Add room type$/ }).click();

    await expect(page.getByText(/upgrade to add more rooms/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: /upgrade your plan/i })).toBeVisible();
    await beat(page, 2000);
  });

  console.log("\n✓ Tier nudge shown — Solo cap enforced.\n");
});

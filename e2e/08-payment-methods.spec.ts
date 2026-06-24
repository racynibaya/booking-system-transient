import { expect, test } from "@playwright/test";

import { pickStay, randomFutureStay } from "./helpers/calendar";
import { pickBookableListing } from "./helpers/listing";
import { signInAsOperator } from "./helpers/operator";
import { beat } from "./helpers/watch";

// ───────────────────────────────────────────────────────────────────────────────────────────────
// Scenario 8 — payout methods, end to end.
//
// The OPERATOR adds a GCash payout method in Settings → signs out → a GUEST books one of their rooms
// and sees that exact number on the deposit screen. Proves the payout details flow from the operator
// console to the place a guest actually pays (delivered with the hold, never on the public listing).
// ───────────────────────────────────────────────────────────────────────────────────────────────

test("operator adds a payout method and the guest sees it at deposit time", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1366, height: 900 });

  const listing = await pickBookableListing();
  const gcashNumber = `0917${String(Date.now()).slice(-7)}`; // unique, recognizable
  console.log(`\n▶ ${listing.operatorEmail} adds GCash ${gcashNumber}; guest should see it\n`);

  await test.step("Operator adds a GCash payout method", async () => {
    await signInAsOperator(page, listing.operatorEmail, listing.operatorPassword);
    await page.goto("/settings");
    await page.getByRole("button", { name: /add payment method/i }).click();
    await page.getByPlaceholder(/juan dela cruz/i).fill("E2E Payout");
    await page.getByPlaceholder(/0917 123 4567/).fill(gcashNumber);
    await beat(page);
    await page.getByRole("button", { name: /^Add method$/ }).click();
    await expect(page.getByText(/payment method added/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(gcashNumber)).toBeVisible();
    await beat(page);
  });

  await test.step("Operator signs out", async () => {
    await page.getByRole("button", { name: /sign out/i }).click();
    await page.waitForURL(/\/login/, { timeout: 15_000 });
  });

  await test.step("Guest books the room and reaches the deposit screen", async () => {
    await page.goto(`/${listing.slug}`);
    const card = page.getByRole("complementary");

    const roomSelect = card.getByRole("combobox").first();
    if (await roomSelect.isVisible().catch(() => false)) {
      await roomSelect.selectOption(listing.roomTypeId).catch(() => {});
    }
    await card.getByRole("button", { name: /check-in/i }).click();
    await pickStay(card.locator(".booking-calendar"), page, randomFutureStay());
    await card.getByRole("button", { name: /^Reserve$/ }).click();
    await card.getByLabel(/your name/i).fill(`E2E Guest ${Date.now()}`);
    await beat(page);
    await card.getByRole("button", { name: /confirm reservation/i }).click();

    await expect(card.getByText(/Pay your deposit/i)).toBeVisible({ timeout: 15_000 });
    await expect(card.getByText(gcashNumber)).toBeVisible();
    await beat(page, 1800);
  });

  console.log("\n✓ Payout method flows operator → guest deposit screen.\n");
});

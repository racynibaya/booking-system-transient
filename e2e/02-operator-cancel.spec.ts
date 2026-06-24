import { expect, test } from "@playwright/test";

import { randomFutureStay } from "./helpers/calendar";
import { createHoldViaRpc, pickBookableListing } from "./helpers/listing";
import { signInAsOperator } from "./helpers/operator";
import { beat } from "./helpers/watch";

// ───────────────────────────────────────────────────────────────────────────────────────────────
// Scenario 2 — cancel / free the dates.
//
// A guest hold already exists (created off-screen through the same public RPC the booking card uses).
// The OPERATOR signs in, finds it on the board, and CANCELS it — freeing the dates and updating the
// row's status in place. Mirrors the everyday "this one fell through" action.
// ───────────────────────────────────────────────────────────────────────────────────────────────

test("operator cancels a booking and frees the dates", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1366, height: 900 });

  const listing = await pickBookableListing();
  const guestName = `E2E Cancel ${Date.now()}`;
  const stay = randomFutureStay();
  await createHoldViaRpc({
    roomTypeId: listing.roomTypeId,
    guestName,
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
  });
  console.log(`\n▶ Cancelling "${guestName}" as ${listing.operatorEmail}\n`);

  await test.step("Operator signs in", async () => {
    await signInAsOperator(page, listing.operatorEmail, listing.operatorPassword);
  });

  await test.step("Operator finds the booking and cancels it", async () => {
    await page.goto(`/bookings?view=action&q=${encodeURIComponent(guestName)}`);
    await expect(page.getByText(guestName, { exact: true })).toBeVisible({ timeout: 15_000 });
    await beat(page);

    await page
      .getByRole("button", { name: /^Cancel$/ })
      .first()
      .click();
    await expect(page.getByRole("button", { name: /yes, cancel it/i })).toBeVisible();
    await beat(page);
    await page.getByRole("button", { name: /yes, cancel it/i }).click();

    await expect(page.getByText(/booking cancelled/i)).toBeVisible({ timeout: 15_000 });
    await beat(page, 1800);
  });

  console.log("\n✓ Booking cancelled — dates freed.\n");
});

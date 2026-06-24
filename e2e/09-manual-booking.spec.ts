import { expect, test } from "@playwright/test";

import { pickStay, randomFutureStay } from "./helpers/calendar";
import { pickBookableListing } from "./helpers/listing";
import { signInAsOperator } from "./helpers/operator";
import { beat } from "./helpers/watch";

// ───────────────────────────────────────────────────────────────────────────────────────────────
// Scenario 9 — manual booking (walk-in / phone / messenger).
//
// The OPERATOR records a booking themselves on the same booking engine the public flow uses
// (create_booking_hold). Pick property → room → dates → guest, mark it confirmed, and it lands on
// the board.
// ───────────────────────────────────────────────────────────────────────────────────────────────

test("operator records a manual booking", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1366, height: 900 });

  const listing = await pickBookableListing();
  const guestName = `E2E Walk-in ${Date.now()}`;
  console.log(`\n▶ Recording "${guestName}" on ${listing.propertyName} / ${listing.roomName}\n`);

  await signInAsOperator(page, listing.operatorEmail, listing.operatorPassword);

  await test.step("Fill the manual booking form", async () => {
    await page.goto("/bookings/new");
    const form = page.locator("form");

    // Property + room are the first two <select>s; status is the third. Guests is a number input.
    const selects = form.getByRole("combobox");
    await selects.nth(0).selectOption(listing.propertyId);
    await selects.nth(1).selectOption(listing.roomTypeId);
    await beat(page);

    await pickStay(form.locator(".operator-calendar"), page, randomFutureStay());

    await form.getByRole("spinbutton").first().fill("1"); // guests
    await form.getByPlaceholder(/juan dela cruz/i).fill(guestName);
    await beat(page);
  });

  await test.step("Create it and see it on the board", async () => {
    await page.getByRole("button", { name: /^Create booking$/ }).click();
    await page.waitForURL(/\/bookings(\?|$)/, { timeout: 20_000 });
    await page.goto(`/bookings?q=${encodeURIComponent(guestName)}`);
    await expect(page.getByText(guestName, { exact: true })).toBeVisible({ timeout: 15_000 });
    await beat(page, 1800);
  });

  console.log("\n✓ Manual booking recorded.\n");
});

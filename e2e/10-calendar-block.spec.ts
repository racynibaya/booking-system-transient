import { expect, test } from "@playwright/test";

import { pickStay, randomFutureStay } from "./helpers/calendar";
import { pickBookableListing } from "./helpers/listing";
import { signInAsOperator } from "./helpers/operator";
import { beat } from "./helpers/watch";

// ───────────────────────────────────────────────────────────────────────────────────────────────
// Scenario 10 — block dates on the availability calendar.
//
// The OPERATOR opens a room's calendar, selects a future range, and blocks it (maintenance / personal
// use). The block lands in the list — and would render those days un-bookable on the public page
// (the same rule scenario 3 verifies from the guest side).
// ───────────────────────────────────────────────────────────────────────────────────────────────

test("operator blocks a date range on the calendar", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1366, height: 900 });

  const listing = await pickBookableListing();
  console.log(`\n▶ Blocking dates on ${listing.propertyName} (${listing.roomName})\n`);

  await signInAsOperator(page, listing.operatorEmail, listing.operatorPassword);

  await test.step("Open the room's availability calendar", async () => {
    await page.goto(`/properties/${listing.propertyId}/calendar`);
    await expect(page.getByRole("heading", { name: /availability/i })).toBeVisible();
    await beat(page);
  });

  await test.step("Select a future range and block it", async () => {
    // The page renders one RoomCalendar per room; act within the first room's section.
    const section = page
      .locator("section")
      .filter({ has: page.locator(".operator-calendar") })
      .first();
    await pickStay(section.locator(".operator-calendar"), page, randomFutureStay());
    await section.getByPlaceholder(/reason/i).fill("E2E maintenance");
    await beat(page);
    await section.getByRole("button", { name: /block selected dates/i }).click();

    await expect(page.getByText(/dates blocked/i)).toBeVisible({ timeout: 15_000 });
    await expect(section.getByText(/E2E maintenance/i)).toBeVisible();
    await beat(page, 1800);
  });

  console.log("\n✓ Date range blocked.\n");
});

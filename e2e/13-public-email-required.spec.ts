import { expect, test } from "@playwright/test";

import { pickStay, randomFutureStay } from "./helpers/calendar";
import { pickBookableListing } from "./helpers/listing";
import { beat } from "./helpers/watch";

// ───────────────────────────────────────────────────────────────────────────────────────────────
// Scenario 13 — guest email is required.
//
// A guest can't reserve without an email, so there's always an address for the booking confirmation.
// We drive the public card to the details step and assert the gate: "Confirm reservation" stays
// disabled until a valid-looking email is entered. We deliberately DON'T submit — this test only
// verifies the gate, so it creates no hold and sends no email.
// ───────────────────────────────────────────────────────────────────────────────────────────────

test("guest cannot reserve without an email", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1366, height: 900 });

  const listing = await pickBookableListing();
  const stay = randomFutureStay();

  await test.step("Guest opens the listing and picks dates", async () => {
    await page.goto(`/${listing.slug}`);
    await beat(page);
  });

  // Desktop booking card lives in the aside; scope to it so the hidden mobile copy can't match.
  const card = page.getByRole("complementary");

  await test.step("Guest reaches the details step", async () => {
    await card.getByRole("button", { name: /check-in/i }).click();
    await pickStay(card.locator(".booking-calendar"), page, stay);
    await expect(card.getByText(/Total/i)).toBeVisible();

    await card.getByRole("button", { name: /^Reserve$/ }).click();
    await card.getByLabel(/your name/i).fill("Email Gate Tester");
    await beat(page);
  });

  const confirm = card.getByRole("button", { name: /confirm reservation/i });

  await test.step("With no email, the reserve button is disabled", async () => {
    await expect(confirm).toBeDisabled();
  });

  await test.step("With a valid email, the reserve button enables", async () => {
    await card.getByLabel(/email/i).fill("e2e-gate@example.com");
    await expect(confirm).toBeEnabled();
    await beat(page);
  });
});

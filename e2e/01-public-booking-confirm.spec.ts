import { expect, test } from "@playwright/test";

import { pickStay, randomFutureStay } from "./helpers/calendar";
import { pickBookableListing, RECEIPT_PNG } from "./helpers/listing";
import { beat } from "./helpers/watch";

// ───────────────────────────────────────────────────────────────────────────────────────────────
// Scenario 1 — the critical path, top to bottom.
//
//   GUEST   visits a real public listing → picks a room + dates → leaves their details (this fires
//           the atomic create_booking_hold) → "pays" the deposit and uploads a receipt.
//   OPERATOR signs in → opens the bookings board → confirms that exact booking.
//
// Part of the watchable tour:  npm run test:e2e:watch  (opens a real Chrome window, slowed down).
// Needs the local stack + seed:  npm run db:start && npm run db:reset  (200 operators, password123).
// ───────────────────────────────────────────────────────────────────────────────────────────────

test("guest books a stay and the operator confirms it", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1366, height: 900 });

  const listing = await pickBookableListing();
  const stay = randomFutureStay();
  const guestName = `E2E Guest ${Date.now()}`;
  console.log(
    `\n▶ Booking "${listing.roomName}" at /${listing.slug} as "${guestName}", ` +
      `then confirming as ${listing.operatorEmail}\n`,
  );

  // ── GUEST: open the public listing ──────────────────────────────────────────────────────────
  await test.step("Guest opens the public listing", async () => {
    await page.goto(`/${listing.slug}`);
    await expect(page).toHaveTitle(/.+/);
    await beat(page);
  });

  // The desktop booking card lives in the aside (role=complementary); scope to it so the hidden
  // mobile bottom-sheet copy of the card can never satisfy a selector.
  const card = page.getByRole("complementary");

  // ── GUEST: pick dates ───────────────────────────────────────────────────────────────────────
  await test.step("Guest picks check-in and check-out", async () => {
    await card.getByRole("button", { name: /check-in/i }).click();
    await pickStay(card.locator(".booking-calendar"), page, stay);

    // Total breakdown only renders once a valid range is set — proves the dates took.
    await expect(card.getByText(/Total/i)).toBeVisible();
  });

  // ── GUEST: reserve → details ────────────────────────────────────────────────────────────────
  await test.step("Guest fills in their details", async () => {
    await card.getByRole("button", { name: /^Reserve$/ }).click();

    await card.getByLabel(/your name/i).fill(guestName);
    await card.getByLabel(/phone/i).fill("+639171234567");
    await card.getByLabel(/email/i).fill("e2e-guest@example.com");
    await beat(page);

    await card.getByRole("button", { name: /confirm reservation/i }).click();
  });

  // ── GUEST: deposit + proof upload → done ────────────────────────────────────────────────────
  await test.step("Guest uploads the deposit receipt", async () => {
    // The hold landed → we're on the "Pay your deposit" screen.
    await expect(card.getByText(/Pay your deposit/i)).toBeVisible({ timeout: 15_000 });
    await beat(page);

    await card.getByLabel(/upload your payment receipt/i).setInputFiles({
      name: "receipt.png",
      mimeType: "image/png",
      buffer: RECEIPT_PNG,
    });
    await beat(page);

    await card.getByRole("button", { name: /i've paid/i }).click();

    await expect(card.getByText(/Proof received/i)).toBeVisible({ timeout: 15_000 });
    await beat(page, 1600);
  });

  // ── OPERATOR: sign in ───────────────────────────────────────────────────────────────────────
  await test.step("Operator signs in", async () => {
    await page.goto("/login");
    await page.getByPlaceholder(/you@example\.com/i).fill(listing.operatorEmail);
    await page.getByPlaceholder(/at least 8 characters/i).fill(listing.operatorPassword);
    await beat(page);
    await page.getByRole("button", { name: /^Sign in$/ }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
    await beat(page);
  });

  // ── OPERATOR: find the booking and confirm it ───────────────────────────────────────────────
  await test.step("Operator confirms the new booking", async () => {
    // Land straight on the Needs-action board, filtered to this guest, so the row is unmistakable.
    await page.goto(`/bookings?view=action&q=${encodeURIComponent(guestName)}`);

    const row = page.getByText(guestName, { exact: true });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await beat(page);

    await page
      .getByRole("button", { name: /^Confirm$/ })
      .first()
      .click();
    await expect(page.getByRole("button", { name: /yes, confirm/i })).toBeVisible();
    await beat(page);
    await page.getByRole("button", { name: /yes, confirm/i }).click();

    // Success toast (sonner) — both parties notified.
    await expect(page.getByText(/booking confirmed/i)).toBeVisible({ timeout: 15_000 });
    await beat(page, 2000);
  });

  console.log("\n✓ Full loop complete: guest booked → operator confirmed.\n");
});

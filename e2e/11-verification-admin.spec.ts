import { expect, test } from "@playwright/test";

import { RECEIPT_PNG } from "./helpers/listing";
import { signInAsOperator, signUpOperator } from "./helpers/operator";
import { beat } from "./helpers/watch";

// ───────────────────────────────────────────────────────────────────────────────────────────────
// Scenario 11 — trust: operator verification → admin approval.
//
// A fresh OPERATOR uploads a verification document, then the ADMIN (seed-op-1) reviews the queue and
// APPROVES them — the gate that takes a booking page live. The anti-scam spine of the marketplace.
// ───────────────────────────────────────────────────────────────────────────────────────────────

const ADMIN_EMAIL = "seed-op-1@example.com";
const ADMIN_PASSWORD = "password123";

test("operator uploads a document and the admin approves them", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1366, height: 900 });

  const op = await signUpOperator(page);
  console.log(`\n▶ ${op.email} uploads ID; admin approves\n`);

  await test.step("Operator uploads a Government ID", async () => {
    await page.goto("/verification");
    await expect(page.getByRole("heading", { name: /verification/i })).toBeVisible();
    // The file inputs are hidden behind "Upload" buttons; set files on the first one (gov_id) directly.
    await page.locator('input[type="file"]').first().setInputFiles({
      name: "gov-id.png",
      mimeType: "image/png",
      buffer: RECEIPT_PNG,
    });
    // On success the gov_id slot's button flips Upload → Replace (persistent, unlike the toast).
    await expect(page.getByRole("button", { name: /^Replace$/ })).toBeVisible({ timeout: 20_000 });
    await beat(page, 1600);
  });

  await test.step("Operator signs out", async () => {
    await page.getByRole("button", { name: /sign out/i }).click();
    await page.waitForURL(/\/login/, { timeout: 15_000 });
  });

  await test.step("Admin reviews the queue and approves", async () => {
    await signInAsOperator(page, ADMIN_EMAIL, ADMIN_PASSWORD); // admin lands on /admin
    await page.goto("/admin/operators");
    await expect(page.getByText(op.email)).toBeVisible({ timeout: 15_000 });
    await beat(page);

    // Narrow to the operator's card (it holds this unique email AND an Approve button), then approve.
    const card = page
      .locator("div")
      .filter({ has: page.getByText(op.email, { exact: true }) })
      .filter({ has: page.getByRole("button", { name: /^Approve$/ }) })
      .last();
    await card.getByRole("button", { name: /^Approve$/ }).click();
    await expect(page.getByText(/operator approved/i)).toBeVisible({ timeout: 15_000 });
    await beat(page, 2000);
  });

  console.log("\n✓ Verification: uploaded → admin approved.\n");
});

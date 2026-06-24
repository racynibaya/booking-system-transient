import { expect, test } from "@playwright/test";

import { signUpOperator } from "./helpers/operator";
import { beat } from "./helpers/watch";

// ───────────────────────────────────────────────────────────────────────────────────────────────
// Scenario 7 — operator onboarding: create a property + a room type.
//
// A fresh operator (signed up at the start) creates their first PROPERTY, then adds a ROOM TYPE to
// it. This is the inventory the whole booking engine hangs off — the first thing a new host does.
// ───────────────────────────────────────────────────────────────────────────────────────────────

test("operator creates a property and adds a room type", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1366, height: 900 });

  await signUpOperator(page);
  const propertyName = `E2E Beach House ${Date.now()}`;
  const roomName = "Deluxe Double";
  console.log(`\n▶ Creating property "${propertyName}" + room "${roomName}"\n`);

  await test.step("Create the property", async () => {
    await page.goto("/properties/new");
    await page.getByPlaceholder(/kahuna beach house/i).fill(propertyName);
    await beat(page);
    await page.getByRole("button", { name: /^Create property$/ }).click();
    // createProperty redirects to the new property's page.
    await page.waitForURL(/\/properties\/[0-9a-f-]{36}/, { timeout: 20_000 });
    await expect(page.getByText(propertyName).first()).toBeVisible();
    await beat(page);
  });

  await test.step("Add a room type", async () => {
    await page.getByRole("button", { name: /^Add room type$/ }).click();
    const form = page.locator("form").filter({ has: page.getByPlaceholder(/deluxe double/i) });
    await form.getByPlaceholder(/deluxe double/i).fill(roomName);
    const numbers = form.getByRole("spinbutton");
    await numbers.nth(0).fill("2"); // capacity
    await numbers.nth(1).fill("3"); // quantity
    await numbers.nth(2).fill("1500"); // price ₱/night
    await beat(page);
    // When the form is open the reveal button is hidden, so this submit is unambiguous.
    await form.getByRole("button", { name: /^Add room type$/ }).click();

    await expect(page.getByText(/room type added/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(roomName).first()).toBeVisible();
    await beat(page, 1800);
  });

  console.log("\n✓ Property + room created.\n");
});

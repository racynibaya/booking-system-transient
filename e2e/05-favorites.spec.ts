import { expect, test } from "@playwright/test";

import { beat } from "./helpers/watch";

// ───────────────────────────────────────────────────────────────────────────────────────────────
// Scenario 5 — favourites (guest wishlist, browser-local).
//
// A guest taps the heart on a card → it saves (toast + count pill) → opens the favourites drawer
// and sees the saved stay → removes it. No account needed; the picks live in the browser.
// ───────────────────────────────────────────────────────────────────────────────────────────────

test("guest saves a stay to favourites and sees it in the drawer", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1366, height: 900 });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /stay in san juan/i })).toBeVisible();

  const savedName = (await page.getByRole("heading", { level: 3 }).first().innerText()).trim();
  console.log(`\n▶ Favouriting "${savedName}"\n`);

  await test.step("Tap the heart on the first card", async () => {
    await page
      .getByRole("button", { name: /add .* to favourites/i })
      .first()
      .click();
    await expect(page.getByText(/added to favourites/i)).toBeVisible();
    await beat(page);
  });

  await test.step("Open the favourites drawer", async () => {
    // Nav button name starts with "Favourites" (+ a count badge); card hearts are "Add … to
    // favourites", so anchoring to the start disambiguates.
    await page.getByRole("button", { name: /^Favourites/ }).click();
    const drawer = page.getByRole("dialog", { name: /favourites/i });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText(savedName, { exact: true })).toBeVisible();
    await beat(page);
  });

  await test.step("Remove it from the drawer", async () => {
    const drawer = page.getByRole("dialog", { name: /favourites/i });
    await drawer
      .getByRole("button", { name: new RegExp(`remove ${escapeRe(savedName)}`, "i") })
      .click();
    await expect(page.getByText(/no favourites yet/i)).toBeVisible();
    await beat(page, 1600);
  });

  console.log("\n✓ Favourites: saved, viewed, removed.\n");
});

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

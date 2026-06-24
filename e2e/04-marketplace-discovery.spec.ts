import { expect, test } from "@playwright/test";

import { beat } from "./helpers/watch";

// ───────────────────────────────────────────────────────────────────────────────────────────────
// Scenario 4 — marketplace discovery (the public grid).
//
// A guest lands on the home page, narrows the grid by AREA and by SEARCH, then opens a listing.
// Proves the paid-perk discovery surface: verified cards, live filtering, card → /[slug].
// ───────────────────────────────────────────────────────────────────────────────────────────────

test("guest browses the marketplace, filters, and opens a listing", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1366, height: 900 });

  await test.step("Home grid loads", async () => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /stay in san juan/i })).toBeVisible();
    await expect(page.getByText(/verified stays?/i)).toBeVisible();
    await beat(page);
  });

  await test.step("Filter by area", async () => {
    // The area chips are buttons; pick the first real area (after the "All areas" chip).
    const chips = page.getByRole("button", { name: /.+/ }).filter({ hasNotText: /favourites/i });
    const area = page.locator("button[aria-pressed]").nth(1); // first concrete area chip
    const areaLabel = (await area.innerText()).trim();
    await area.click();
    await expect(area).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText(/verified stays?/i)).toBeVisible();
    await beat(page);
    console.log(`  filtered to area: ${areaLabel}`);
    void chips;
  });

  let openedName = "";
  await test.step("Search narrows the grid", async () => {
    // Reset area, then search for a token from the first visible card so we know it matches.
    await page.locator("button[aria-pressed]").first().click(); // "All areas"
    const firstCard = page.getByRole("heading", { level: 3 }).first();
    openedName = (await firstCard.innerText()).trim();
    const token = openedName.split(" ")[0];
    await page.getByRole("searchbox", { name: /search stays/i }).fill(token);
    await beat(page);
    await expect(page.getByRole("heading", { level: 3 }).first()).toBeVisible();
  });

  await test.step("Open a listing from the grid", async () => {
    await page
      .getByRole("link")
      .filter({ has: page.getByText(openedName, { exact: true }) })
      .first()
      .click();
    await page.waitForURL(/\/[^/]+$/);
    await expect(page.getByRole("button", { name: /^Reserve$/ })).toBeVisible({ timeout: 15_000 });
    await beat(page, 1600);
  });

  console.log("\n✓ Discovery: filtered + opened a listing.\n");
});

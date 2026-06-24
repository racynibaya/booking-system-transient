import { expect, test } from "@playwright/test";

import { pickSoldOutDate } from "./helpers/listing";
import { beat } from "./helpers/watch";

// ───────────────────────────────────────────────────────────────────────────────────────────────
// Scenario 3 — availability guard (the no-double-booking invariant, made visible).
//
// A real seeded availability block closes a room on a known date. On the public listing, the guest
// opens that room's calendar, lands on the blocked month, and finds the sold-out day NOT selectable
// — the same per-day rule the booking RPC enforces, surfaced in the UI.
// ───────────────────────────────────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

test("a sold-out date is not selectable in the booking calendar", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1366, height: 900 });

  const { slug, roomTypeId, roomName, date } = await pickSoldOutDate();
  const [year, month, day] = date.split("-").map(Number);
  console.log(`\n▶ "${roomName}" at /${slug} is blocked on ${date} — it must be un-bookable\n`);

  await page.goto(`/${slug}`);
  const card = page.getByRole("complementary");

  await test.step("Select the blocked room", async () => {
    // The room <select> is the first combobox in the card; pick by its value (room id).
    const roomSelect = card.getByRole("combobox").first();
    if (await roomSelect.isVisible().catch(() => false)) {
      await roomSelect.selectOption(roomTypeId).catch(() => {});
    }
    await beat(page);
  });

  await test.step("Open the calendar and navigate to the blocked month", async () => {
    await card.getByRole("button", { name: /check-in/i }).click();
    const calendar = page.locator(".booking-calendar");
    await expect(calendar).toBeVisible();

    // Advance to the block's month (calendar opens on the current month).
    const now = new Date();
    const monthsAhead = (year - now.getFullYear()) * 12 + (month - 1 - now.getMonth());
    const nextMonth = calendar.getByRole("button", { name: /next month/i });
    for (let i = 0; i < monthsAhead; i++) {
      await nextMonth.click();
      await beat(page, 350);
    }
  });

  await test.step("The sold-out day is disabled", async () => {
    const calendar = page.locator(".booking-calendar");
    const dayBtn = calendar
      .locator(".rdp-day_button")
      .filter({ hasText: new RegExp(`^${day}$`) })
      .first();
    await expect(dayBtn).toBeVisible();
    await expect(dayBtn).toBeDisabled();
    console.log(`  ✓ ${MONTH_NAMES[month - 1]} ${day} is not selectable`);
    await beat(page, 1800);
  });

  console.log("\n✓ Availability guard holds — sold-out day blocked in the UI.\n");
});

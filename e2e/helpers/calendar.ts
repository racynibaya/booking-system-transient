import { expect, type Locator, type Page } from "@playwright/test";

import { beat } from "./watch";

export type Stay = {
  monthsAhead: number; // how many times to click "next month" from today's month
  checkInDay: number;
  checkOutDay: number;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
};

// A random 2-night stay several months out — well past the seeded data, and randomized so
// independent scenarios (and repeat runs that leave confirmed bookings behind) don't collide on the
// same room+dates and sell each other out.
export function randomFutureStay(): Stay {
  const monthsAhead = 4 + Math.floor(Math.random() * 6); // 4..9
  const checkInDay = 4 + Math.floor(Math.random() * 18); // 4..21
  const checkOutDay = checkInDay + 2;
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + monthsAhead);
  const pad = (n: number) => String(n).padStart(2, "0");
  const ym = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  return {
    monthsAhead,
    checkInDay,
    checkOutDay,
    checkIn: `${ym}-${pad(checkInDay)}`,
    checkOut: `${ym}-${pad(checkOutDay)}`,
  };
}

// Drive a react-day-picker (v10) range calendar to the given stay. `scope` wraps the calendar (the
// booking card's `.booking-calendar`, or an operator `.operator-calendar`). Day cells are matched by
// their visible number, so it's locale-independent.
export async function pickStay(scope: Locator, page: Page, stay: Stay): Promise<void> {
  await expect(scope.locator(".rdp-day_button").first()).toBeVisible({ timeout: 10_000 });
  const nextMonth = scope.getByRole("button", { name: /next month/i });
  for (let i = 0; i < stay.monthsAhead; i++) {
    await nextMonth.click();
    await beat(page, 250);
  }
  const day = (n: number) =>
    scope
      .locator(".rdp-day_button")
      .filter({ hasText: new RegExp(`^${n}$`) })
      .first();
  await day(stay.checkInDay).click();
  await beat(page, 350);
  await day(stay.checkOutDay).click();
  await beat(page, 350);
}
